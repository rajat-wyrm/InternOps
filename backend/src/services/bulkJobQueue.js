const { Queue, Worker } = require('bullmq');
const config = require('../config');
const logger = require('../logger');
const repo = require('../modules/certificates/repository');

const QUEUE_NAME = 'bulk-certificate-generation';

function getRedisConnection() {
  const redisConfig = config.redis;
  if (!redisConfig?.enabled || !redisConfig.host) {
    return null;
  }
  return {
    host: redisConfig.host,
    port: redisConfig.port || 6379,
    username: redisConfig.username || undefined,
    password: redisConfig.password || undefined,
    tls:
      redisConfig.tls !== false && process.env.REDIS_TLS === 'true'
        ? {}
        : undefined,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (times > 2) {
        return null;
      }
      return 200;
    },
  };
}

class BulkJobQueueService {
  constructor() {
    this.queue = null;
    this.worker = null;
    this.connection = null;
    this.isBullMQActive = false;
  }

  async init() {
    try {
      this.connection = getRedisConnection();

      if (this.connection && process.env.NODE_ENV !== 'test') {
        this.queue = new Queue(QUEUE_NAME, {
          connection: this.connection,
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 500 },
          },
        });

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
            await repo.updateBulkJob(jobId, { status: 'processing' });
            await processBulkGeneration(jobId, data, userId);
          },
          {
            connection: this.connection,
            concurrency: 5,
          }
        );

        this.queue.on('error', (err) => {
          logger.warn(
            { err: err?.message || err },
            'BullMQ Queue connection error'
          );
        });

        this.worker.on('error', (err) => {
          logger.warn(
            { err: err?.message || err },
            'BullMQ Worker connection error'
          );
        });

        this.worker.on('completed', (job) => {
          logger.info(`BullMQ job ${job.id} completed successfully`);
        });

        this.worker.on('failed', async (job, err) => {
          logger.error(
            { err, jobId: job?.data?.jobId },
            `BullMQ job ${job?.id} failed`
          );
          if (job?.data?.jobId) {
            await repo
              .updateBulkJob(job.data.jobId, {
                status: 'failed',
                error_log: [{ error: err.message, stack: err.stack }],
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
        logger.info(
          'BullMQ disabled or Redis not configured. Running queue service in direct mode.'
        );
      }

      await this.recoverPendingJobs();
    } catch (err) {
      logger.warn(
        { err },
        'Failed to initialize BullMQ. Fallback to direct execution.'
      );
      this.isBullMQActive = false;
      await this.recoverPendingJobs().catch(() => {});
    }
  }

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

  async addJob(jobId, data, userId) {
    if (this.isBullMQActive && this.queue) {
      try {
        const job = await this.queue.add(
          'process-bulk',
          { jobId, data, userId },
          { jobId: `bulk-${jobId}` }
        );
        logger.info(`Enqueued bulk job ${jobId} to BullMQ (Job ID: ${job.id})`);
        return job;
      } catch (err) {
        logger.error(
          { err, jobId },
          'Failed to add job to BullMQ, falling back to direct execution'
        );
      }
    }

    // Direct execution fallback if Redis/BullMQ is not active or fails
    const {
      processBulkGeneration,
    } = require('../modules/certificates/service');
    setImmediate(async () => {
      try {
        await repo.updateBulkJob(jobId, { status: 'processing' });
        await processBulkGeneration(jobId, data, userId);
      } catch (err) {
        logger.error({ err, jobId }, 'Direct execution of bulk job failed');
        await repo
          .updateBulkJob(jobId, {
            status: 'failed',
            error_log: [{ error: err.message }],
            completed_at: new Date().toISOString(),
          })
          .catch(() => {});
      }
    });
  }

  async close() {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
    this.isBullMQActive = false;
  }
}

const bulkJobQueueService = new BulkJobQueueService();
module.exports = bulkJobQueueService;
