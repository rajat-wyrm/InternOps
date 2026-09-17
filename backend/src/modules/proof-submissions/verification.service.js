const { Queue, Worker } = require('bullmq');
const logger = require('../../logger');
const repo = require('./repository');
const socialTasksRepo = require('../social-tasks/repository');
const crawlerService = require('../social-tasks/crawler.service');
const aiVerifyService = require('../social-tasks/ai-verify.service');
const { checkHierarchyAccess } = require('../../utils/hierarchy');

const QUEUE_NAME = 'proof-verification';
const activeVerifications = new Set();

function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      tls: url.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 2) return null;
        return 200;
      },
    };
  } catch (err) {
    logger.warn(
      { err: err?.message || err },
      'Invalid REDIS_URL for proof verification queue'
    );
    return null;
  }
}

class ProofVerificationService {
  constructor() {
    this.queue = null;
    this.worker = null;
    this.connection = null;
    this.isBullMQActive = false;
    this.initialized = false;
  }

  async initQueue() {
    if (this.initialized) return;

    try {
      this.connection = getRedisConnection();
      const bullmqEnabled = process.env.BULLMQ_ENABLED !== 'false';

      if (this.connection && process.env.NODE_ENV !== 'test' && bullmqEnabled) {
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
            const { proofId, context } = job.data;
            logger.info(
              `BullMQ processing proof verification for proof: ${proofId}`
            );
            await this.verifyProof(proofId, context);
          },
          {
            connection: this.connection,
            concurrency: 5,
          }
        );

        this.worker.on('failed', (job, err) => {
          logger.error(
            { err, proofId: job?.data?.proofId },
            'Proof verification BullMQ job failed'
          );
        });

        this.isBullMQActive = true;
        logger.info(
          'Proof verification BullMQ Queue & Worker initialized successfully'
        );
      } else {
        this.isBullMQActive = false;
      }
    } catch (err) {
      logger.warn(
        { err },
        'Failed to initialize BullMQ for proof verification. Using direct execution mode.'
      );
      this.isBullMQActive = false;
    } finally {
      this.initialized = true;
    }
  }

  /**
   * Conceptual verification flow:
   * 1. Load proof submission.
   * 2. Verify authorization/ownership.
   * 3. Fetch proof content using fetchProofContent.
   * 4. Pass the fetched content/claim to verifyClaim.
   * 5. Store the verification result in proof_submissions.verification_result.
   * 6. Return/update verification status.
   *
   * Advisory only: Never modifies approval/rejection state (status).
   */
  async verifyProof(proofId, context = {}) {
    // 1. Load proof submission
    const proof = await repo.getProof(proofId);
    if (!proof) {
      const err = new Error('Proof not found');
      err.statusCode = 404;
      throw err;
    }

    // 2. Verify authorization/ownership if reviewer context is provided
    if (context.reviewer) {
      const reviewer = context.reviewer;
      const allowedRoles = ['CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN'];

      if (!allowedRoles.includes(reviewer.role)) {
        const err = new Error('Forbidden: insufficient reviewer permissions');
        err.statusCode = 403;
        throw err;
      }

      if (reviewer.id === proof.intern_id) {
        const err = new Error(
          'Forbidden: you cannot verify your own proof submission'
        );
        err.statusCode = 403;
        throw err;
      }

      if (reviewer.role !== 'ADMIN') {
        const allowed = await checkHierarchyAccess(
          reviewer.id,
          proof.intern_id
        );
        if (!allowed) {
          const err = new Error('Forbidden: not in intern hierarchy');
          err.statusCode = 403;
          throw err;
        }
      }
    }

    // 3. Load task and fetch proof content using fetchProofContent
    const task = await socialTasksRepo.getTaskById(proof.task_id);
    if (!task) {
      const failureResult = {
        status: 'failed',
        error: 'Task not found',
        advisory: true,
        verified_at: new Date().toISOString(),
      };
      await repo.saveVerificationResult(proof.id, failureResult);
      return failureResult;
    }

    if (!task.task_link) {
      const failureResult = {
        status: 'failed',
        error: 'Task does not have a proof URL',
        advisory: true,
        verified_at: new Date().toISOString(),
      };
      await repo.saveVerificationResult(proof.id, failureResult);
      return failureResult;
    }

    let crawlResult;
    try {
      crawlResult = await crawlerService.fetchProofContent(task.task_link);
    } catch (crawlErr) {
      logger.error(
        { err: crawlErr, proofId: proof.id },
        'fetchProofContent threw an error'
      );
      crawlResult = {
        success: false,
        error: crawlErr.message || 'Crawler error',
      };
    }

    if (!crawlResult || !crawlResult.success) {
      logger.warn(
        { proofId: proof.id, error: crawlResult?.error },
        'AI verification could not crawl proof URL'
      );
      const failureResult = {
        status: 'failed',
        error: crawlResult?.error || 'Unable to fetch proof URL',
        advisory: true,
        verified_at: new Date().toISOString(),
      };
      await repo.saveVerificationResult(proof.id, failureResult);
      return failureResult;
    }

    // 4. Pass the fetched content/claim to verifyClaim
    const claimedActions = {
      did_comment: Boolean(proof.did_comment),
      did_repost: Boolean(proof.did_repost),
      did_share: Boolean(proof.did_share),
    };

    let claimResult;
    try {
      claimResult = await aiVerifyService.verifyClaim({
        content: crawlResult.content,
        claimedActions,
      });
    } catch (verifyErr) {
      logger.error(
        { err: verifyErr, proofId: proof.id },
        'verifyClaim threw an error'
      );
      const failureResult = {
        status: 'failed',
        error: verifyErr.message || 'AI verification failed',
        advisory: true,
        verified_at: new Date().toISOString(),
      };
      await repo.saveVerificationResult(proof.id, failureResult);
      return failureResult;
    }

    // 5. Store the verification result in proof_submissions.verification_result
    const verificationResult = claimResult;

    try {
      await repo.saveVerificationResult(proof.id, verificationResult);
    } catch (saveErr) {
      logger.error(
        { err: saveErr, proofId: proof.id },
        'Failed to save verification result to database'
      );
      throw saveErr;
    }

    logger.info(
      { proofId: proof.id, verification: verificationResult },
      'AI verification completed'
    );

    // 6. Return verification status
    return {
      success: true,
      status: 'completed',
      verification: verificationResult,
      advisory: true,
    };
  }

  /**
   * Enqueue proof verification asynchronously.
   * Avoids duplicate concurrent jobs and never blocks caller.
   */
  async enqueueProofVerification(proofId, context = { isBackground: true }) {
    if (!proofId) return null;

    if (activeVerifications.has(proofId)) {
      logger.info(
        { proofId },
        'Proof verification already active, skipping duplicate trigger'
      );
      return { status: 'already_queued', proofId };
    }

    activeVerifications.add(proofId);

    const cleanup = () => {
      activeVerifications.delete(proofId);
    };

    if (this.isBullMQActive && this.queue) {
      try {
        const job = await this.queue.add(
          'verify-proof',
          { proofId, context },
          { jobId: `proof-verify-${proofId}` }
        );
        logger.info(`Enqueued proof verification job ${proofId} to BullMQ`);
        cleanup();
        return job;
      } catch (err) {
        logger.error(
          { err, proofId },
          'Failed to add verification job to BullMQ, falling back to direct execution'
        );
      }
    }

    // Asynchronous direct execution fallback (non-blocking)
    setImmediate(async () => {
      try {
        await this.verifyProof(proofId, context);
      } catch (err) {
        logger.error(
          { err, proofId },
          'Direct background proof verification failed'
        );
      } finally {
        cleanup();
      }
    });

    return { status: 'started', proofId };
  }

  async closeQueue() {
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
        { err },
        'Error while closing proof verification BullMQ connections'
      );
    } finally {
      this.isBullMQActive = false;
      this.connection = null;
      this.initialized = false;
    }
  }
}

const proofVerificationService = new ProofVerificationService();

module.exports = proofVerificationService;
