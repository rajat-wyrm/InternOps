const { Queue, Worker } = require('bullmq');
const logger = require('../logger');
const repo = require('../modules/certificates/repository');

const QUEUE_NAME = 'bulk-certificate-generation';

/**
 * Build BullMQ Redis connection from REDIS_URL.
 *
 * Render Key Value/Redis:
 *   redis://...
 *
 * TLS Redis:
 *   rediss://...
 *
 * BullMQ requires maxRetriesPerRequest to be null.
 */
function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    logger.warn(
      'REDIS_URL is not configured. BullMQ will run in direct-execution mode.'
    );
    return null;
  }

  try {
    const url = new URL(redisUrl);

    const connection = {
      host: url.hostname,
      port: Number(url.port) || 6379,

      username: url.username ? decodeURIComponent(url.username) : undefined,

      password: url.password ? decodeURIComponent(url.password) : undefined,

      // rediss:// = TLS
      tls: url.protocol === 'rediss:' ? {} : undefined,

      // Required by BullMQ for workers
      maxRetriesPerRequest: null,

      // Don't keep requests queued while Redis is unavailable
      enableOfflineQueue: false,

      retryStrategy(times) {
        if (times > 2) {
          return null;
        }

        return 200;
      },
    };

    logger.info(
      {
        host: connection.host,
        port: connection.port,
        tls: Boolean(connection.tls),
      },
      'Redis connection configured for BullMQ'
    );

    return connection;
  } catch (err) {
    logger.warn(
      {
        err: err?.message || err,
      },
      'Invalid REDIS_URL. BullMQ will run in direct-execution mode.'
    );

    return null;
  }
}

class BulkJobQueueService {
  constructor() {
    this.queue = null;
    this.worker = null;
    this.connection = null;
    this.isBullMQActive = false;
    this.initialized = false;
  }

  async init() {
    try {
      this.connection = getRedisConnection();

      const bullmqEnabled = process.env.BULLMQ_ENABLED !== 'false';

      if (this.connection && process.env.NODE_ENV !== 'test' && bullmqEnabled) {
        /*
         * Create BullMQ Queue
         */
        this.queue = new Queue(QUEUE_NAME, {
          connection: this.connection,

          defaultJobOptions: {
            attempts: 3,

            backoff: {
              type: 'exponential',
              delay: 2000,
            },

            removeOnComplete: {
              count: 100,
            },

            removeOnFail: {
              count: 500,
            },
          },
        });

        /*
         * Create BullMQ Worker
         */
        this.worker = new Worker(
          QUEUE_NAME,
          async (job) => {
            const { jobId, data, userId } = job.data;

            const {
              processBulkGeneration,
            } = require('../modules/certificates/service');

            logger.info(
              `BullMQ processing job ${job.id} for bulk_job_id: ${jobId}`
            );

            await repo.updateBulkJob(jobId, {
              status: 'processing',
            });

            await processBulkGeneration(jobId, data, userId);
          },
          {
            connection: this.connection,
            concurrency: 5,
          }
        );

        /*
         * Queue error handler
         */
        this.queue.on('error', (err) => {
          logger.warn(
            {
              err: err?.message || err,
            },
            'BullMQ Queue connection error'
          );
        });

        /*
         * Worker error handler
         */
        this.worker.on('error', (err) => {
          logger.warn(
            {
              err: err?.message || err,
            },
            'BullMQ Worker connection error'
          );
        });

        /*
         * Successful job
         */
        this.worker.on('completed', (job) => {
          logger.info(`BullMQ job ${job.id} completed successfully`);
        });

        /*
         * Failed job
         */
        this.worker.on('failed', async (job, err) => {
          logger.error(
            {
              err,
              jobId: job?.data?.jobId,
            },
            `BullMQ job ${job?.id} failed`
          );

          if (job?.data?.jobId) {
            await repo
              .updateBulkJob(job.data.jobId, {
                status: 'failed',

                error_log: [
                  {
                    error: err?.message || 'Unknown error',
                    stack: err?.stack,
                  },
                ],

                completed_at: new Date().toISOString(),
              })
              .catch(() => {});
          }
        });

        this.isBullMQActive = true;

        logger.info(
          'BullMQ Queue & Worker initialized successfully with Redis'
        );
      } else {
        if (!bullmqEnabled) {
          logger.info(
            'BullMQ disabled using BULLMQ_ENABLED=false. Running queue service in direct mode.'
          );
        } else if (!this.connection) {
          logger.info(
            'Redis not configured. Running queue service in direct mode.'
          );
        } else {
          logger.info(
            'BullMQ is disabled in test environment. Running queue service in direct mode.'
          );
        }
      }

      /*
       * Recover pending jobs after initialization.
       */
      await this.recoverPendingJobs();
    } catch (err) {
      logger.warn(
        {
          err,
        },
        'Failed to initialize BullMQ. Falling back to direct execution.'
      );

      this.isBullMQActive = false;

      /*
       * Do not crash the whole backend because Redis/BullMQ
       * is unavailable.
       */
      await this.recoverPendingJobs().catch((recoveryError) => {
        logger.error(
          {
            err: recoveryError,
          },
          'Failed to recover pending bulk jobs'
        );
      });
    } finally {
      this.initialized = true;
    }
  }

  getStatus() {
    return {
      mode: this.isBullMQActive ? 'bullmq' : 'direct',
      initialized: this.initialized,
    };
  }

  /**
   * Recover pending/processing jobs after server restart.
   */
  async recoverPendingJobs() {
    const pendingJobs = await repo.getPendingBulkJobs();

    if (!pendingJobs || pendingJobs.length === 0) {
      return;
    }

    logger.info(
      `Found ${pendingJobs.length} pending/processing bulk jobs for recovery.`
    );

    for (const job of pendingJobs) {
      await this.addJob(job.id, null, job.created_by);
    }
  }

  /**
   * Add a bulk certificate generation job.
   *
   * Uses BullMQ when Redis is available.
   * Falls back to direct execution when Redis/BullMQ
   * is unavailable.
   */
  async addJob(jobId, data, userId) {
    /*
     * BullMQ execution
     */
    if (this.isBullMQActive && this.queue) {
      try {
        const job = await this.queue.add(
          'process-bulk',
          {
            jobId,
            data,
            userId,
          },
          {
            jobId: `bulk-${jobId}`,
          }
        );

        logger.info(`Enqueued bulk job ${jobId} to BullMQ (Job ID: ${job.id})`);

        return job;
      } catch (err) {
        logger.error(
          {
            err,
            jobId,
          },
          'Failed to add job to BullMQ, falling back to direct execution'
        );
      }
    }

    /*
     * Direct execution fallback.
     *
     * This keeps bulk generation working even if Redis
     * becomes temporarily unavailable.
     */
    const {
      processBulkGeneration,
    } = require('../modules/certificates/service');

    setImmediate(async () => {
      try {
        await repo.updateBulkJob(jobId, {
          status: 'processing',
        });

        await processBulkGeneration(jobId, data, userId);
      } catch (err) {
        logger.error(
          {
            err,
            jobId,
          },
          'Direct execution of bulk job failed'
        );

        await repo
          .updateBulkJob(jobId, {
            status: 'failed',

            error_log: [
              {
                error: err?.message || 'Unknown error',
                stack: err?.stack,
              },
            ],

            completed_at: new Date().toISOString(),
          })
          .catch(() => {});
      }
    });

    return null;
  }

  /**
   * Gracefully close BullMQ connections.
   */
  async close() {
    try {
      if (this.worker) {
        await this.worker.close();
        this.worker = null;
      }

      if (this.queue) {
        await this.queue.close();
        this.queue = null;
      }
    } catch (err) {
      logger.warn(
        {
          err,
        },
        'Error while closing BullMQ connections'
      );
    } finally {
      this.isBullMQActive = false;
      this.connection = null;
    }
  }
}

const bulkJobQueueService = new BulkJobQueueService();

module.exports = bulkJobQueueService;
