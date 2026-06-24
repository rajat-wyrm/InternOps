const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const BATCH_SIZE = 20; // process 20 files at a time — no extra dependency needed

function setupCronJobs() {
  try {
    // Schedule: 0 * * * * (Runs exactly at the top of every hour: 01:00, 02:00, etc.)
    cron.schedule('0 * * * *', async () => {
      const jobName = 'proof-image-cleanup';
      const startTime = Date.now();

      // 1. Log Job Start
      console.info(
        JSON.stringify({
          job: jobName,
          startedAt: new Date(startTime),
        }),
        'Cron job started'
      );

      try {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

        // Find eligible records
        const { rows } = await pool.query(
          "SELECT id, image_path FROM proof_submissions WHERE status='VERIFIED' AND verified_at < $1 AND image_path IS NOT NULL",
          [cutoff]
        );

        let filesDeleted = 0;

        // Delete physical files in batches of BATCH_SIZE (fix #504)
        // Async fs.promises.unlink replaces blocking fs.existsSync + fs.unlinkSync.
        // Batching avoids EMFILE (too many open files) without any extra dependency.
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          await Promise.allSettled(
            batch.map(async (row) => {
              const fp = path.join(__dirname, '..', '..', row.image_path);
              try {
                await fs.promises.unlink(fp);
                filesDeleted++;
              } catch (err) {
                if (err.code !== 'ENOENT') throw err;
              }
            })
          );
        }

        // Update database records
        await pool.query(
          "UPDATE proof_submissions SET image_path=NULL WHERE status='VERIFIED' AND verified_at < $1",
          [cutoff]
        );

        const durationMs = Date.now() - startTime;

        // 2. Log Job Completion with Metrics
        console.info(
          JSON.stringify({
            job: jobName,
            durationMs: durationMs,
            recordsProcessed: rows.length,
            filesDeleted: filesDeleted,
          }),
          'Cron job completed'
        );
      } catch (err) {
        // 3. Log Job Failure
        console.error(
          JSON.stringify({
            job: jobName,
            err: err.message,
            stack: err.stack,
          }),
          'Cron job failed'
        );
      }
    });
  } catch (err) {
    // Initialisation errors must not bring the app down — log and continue
    // so tests and other consumers of the module can still load it.
    console.error(
      JSON.stringify({
        job: 'cron-initialization',
        err: err.message,
        stack: err.stack,
      }),
      'Failed to initialize cron jobs'
    );
  }
}

module.exports = { setupCronJobs };
