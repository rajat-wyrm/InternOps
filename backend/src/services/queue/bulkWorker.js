const { Worker } = require('bullmq');
const connection = require('./redis');
const logger = require('../../logger');
const repo = require('../../modules/certificates/repository');

// Worker to process bulk generation jobs
const worker = new Worker(
  'bulk-jobs',
  async (job) => {
    const { jobId, initialData, userId } = job.data || {};
    const service = require('../../modules/certificates/service');
    if (typeof service.processBulkGeneration !== 'function') {
      throw new Error('processBulkGeneration is not a function');
    }
    // Delegate to the certificates service
    await service.processBulkGeneration(jobId, initialData, userId);
  },
  {
    connection,
    concurrency: 5,
  }
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.data?.jobId }, 'Bulk job completed by worker');
});

worker.on('failed', async (job, err) => {
  const jobId = job?.data?.jobId;
  logger.error({ jobId, err }, 'Bulk worker job failed');
  try {
    if (jobId) {
      await repo.updateBulkJob(jobId, {
        status: 'failed',
        error_log: [{ error: err.message }],
        completed_at: new Date().toISOString(),
      });
      await repo.failPendingBulkJobItems(jobId, err.message).catch(() => {});
    }
  } catch (e) {
    logger.error({ e, jobId }, 'Failed to record failure for bulk job');
  }
});

module.exports = worker;
