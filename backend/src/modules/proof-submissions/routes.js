const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const auth = require('../../middleware/auth');
const { z } = require('zod');
const { toSchema } = require('../../utils/schemaHelper');
const aiService = require('./ai.service');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const socialTasksRepo = require('../social-tasks/repository');
const service = require('./service');
const pLimit = require('p-limit');
const { fetchProofContent } = require('../social-tasks/crawler.service');
const { verifyClaim } = require('../social-tasks/ai-verify.service');
const { checkHierarchyAccess } = require('../../utils/hierarchy');

async function routes(fastify) {
  // Submit proof (intern only)
  fastify.post(
    '/submit',
    {
      preHandler: [auth, rbac('INTERN'), sanitize],
      schema: {
        tags: ['Proofs'],
        description: 'Submit proof with multiple image files (multipart)',
      },
    },
    async (req, reply) => {
      const parsed = await service.parseMultipartSubmission(req);

      if (!parsed.task_id) {
        return reply.status(400).send({ error: 'task_id required' });
      }

      try {
        const proof = await service.submitProof(req.user.id, parsed);

        req.auditOnResponse = {
          userId: req.user.id,
          action: 'PROOF_SUBMITTED',
          resourceType: 'proof',
          resourceId: proof.id,
        };

        return proof;
      } catch (err) {
        if (err.statusCode) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // AI-verify a submitted proof against its task link
  fastify.post(
    '/:id/ai-verify',
    {
      preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN')],
      schema: {
        tags: ['Proofs'],
        description: 'Start asynchronous AI verification for a proof',
        params: toSchema(z.object({ id: z.string() })),
      },
    },
    async (req, reply) => {
      try {
        const proof = await repo.getProof(req.params.id);

        if (!proof) {
          return reply.status(404).send({
            error: 'Proof not found',
          });
        }

        const hasAccess = await checkHierarchyAccess(
          req.user.id,
          proof.intern_id
        );

        if (!hasAccess && req.user.role !== 'ADMIN') {
          return reply.status(403).send({
            error: 'Forbidden: not in intern hierarchy',
          });
        }

        const task = await socialTasksRepo.getTaskById(proof.task_id);

        if (!task) {
          return reply.status(404).send({
            error: 'Task not found',
          });
        }

        if (!task.task_link) {
          return reply.status(400).send({
            error: 'Task does not have a proof URL',
          });
        }

        /*
         * Verification is intentionally asynchronous.
         * The reviewer request must not wait for crawling or Gemini.
         */
        void (async () => {
          try {
            const crawlResult = await fetchProofContent(task.task_link);

            if (!crawlResult.success) {
              req.log.warn(
                {
                  proofId: proof.id,
                  error: crawlResult.error,
                },
                'AI verification could not crawl proof URL'
              );
              return;
            }

            const verificationResult = await verifyClaim({
              content: crawlResult.content,
              claimedActions: {
                did_comment: proof.did_comment,
                did_repost: proof.did_repost,
                did_share: proof.did_share,
              },
            });

            await repo.saveVerificationResult(proof.id, verificationResult);

            req.log.info(
              {
                proofId: proof.id,
                verification: verificationResult,
              },
              'AI verification completed'
            );
          } catch (err) {
            req.log.error(
              err,
              'Background AI verification failed: ' + proof.id
            );
          }
        })();

        return reply.status(202).send({
          success: true,
          proofId: proof.id,
          status: 'verification_started',
          advisory: true,
        });
      } catch (err) {
        req.log.error(err, 'Failed to start AI verification: ' + req.params.id);

        return reply.status(500).send({
          error: 'AI verification failed to start',
        });
      }
    }
  );

  // Get AI verification result for a proof
  fastify.get(
    '/:id/verification',
    {
      preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN')],
      schema: {
        tags: ['Proofs'],
        description: 'Get the AI verification result for a proof',
        params: toSchema(z.object({ id: z.string() })),
      },
    },
    async (req, reply) => {
      try {
        const proof = await repo.getProof(req.params.id);

        if (!proof) {
          return reply.status(404).send({ error: 'Proof not found' });
        }

        const hasAccess = await checkHierarchyAccess(
          req.user.id,
          proof.intern_id
        );

        if (!hasAccess && req.user.role !== 'ADMIN') {
          return reply.status(403).send({
            error: 'Forbidden: not in intern hierarchy',
          });
        }

        return {
          proofId: proof.id,
          verification: proof.verification_result || null,
          advisory: true,
        };
      } catch (err) {
        req.log.error(
          err,
          'Failed to get AI verification result: ' + req.params.id
        );

        return reply.status(500).send({
          error: 'Failed to get verification result',
        });
      }
    }
  );

  // Verify proof (Captain, TL, Senior TL) with ownership over the intern
  fastify.patch(
    '/:id/verify',
    {
      preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN'), sanitize],
      schema: {
        tags: ['Proofs'],
        description: 'Verify a proof submission',
        params: toSchema(z.object({ id: z.string() })),
      },
    },
    async (req, reply) => {
      try {
        const verified = await repo.verifyProof(
          req.params.id,
          req.user.id,
          req.user.role
        );
        if (!verified) {
          return reply.status(404).send({ error: 'Proof not found' });
        }

        req.auditOnResponse = {
          userId: req.user.id,
          action: 'PROOF_VERIFIED',
          resourceType: 'proof',
          resourceId: verified.id,
        };

        return verified;
      } catch (err) {
        if (err.message === 'Proof not found') {
          return reply.status(404).send({ error: 'Proof not found' });
        }
        if (err.message.startsWith('Forbidden')) {
          return reply.status(403).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  fastify.get(
    '/task/:taskId',
    {
      preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN')],
      schema: {
        tags: ['Proofs'],
        description: 'Get proofs by task',
        params: toSchema(z.object({ taskId: z.string() })),
      },
    },
    async (req, reply) => {
      try {
        const task = await socialTasksRepo.getTaskById(req.params.taskId);
        if (!task) {
          return reply.status(404).send({ error: 'Task not found' });
        }
        const proofs = await repo.getProofsByTask(req.params.taskId);

        const limit = pLimit(3);

        const results = await Promise.all(
          proofs.map((p) =>
            limit(async () => {
              const submissionData = {
                ...p,
                target_platform: task?.target_platform,
                task_link: task?.task_link,
                title: task?.title,
                description: task?.description,
              };

              try {
                const ai = await aiService.generateTaskSummary(
                  submissionData,
                  req.user.id
                );

                return {
                  ...p,
                  aiSummary: ai.summary,
                  consistencyFlag: ai.consistencyFlag,
                };
              } catch (err) {
                req.log.error(
                  err,
                  'Failed to generate AI summary for proof: ' + p.id
                );
                return {
                  ...p,
                  aiSummary: null,
                  consistencyFlag: 'needs_review',
                };
              }
            })
          )
        );

        return results;
      } catch (err) {
        req.log.error(err, 'Error in GET /proofs/task/:taskId');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  fastify.get(
    '/my',
    {
      preHandler: [auth],
      schema: { tags: ['Proofs'], description: 'Get own proof submissions' },
    },
    async (req) => {
      return repo.getProofsByIntern(req.user.id);
    }
  );

  fastify.delete(
    '/:id',
    {
      preHandler: [auth, rbac('ADMIN')],
      schema: {
        tags: ['Proofs'],
        description: 'Delete a proof submission',
        params: toSchema(z.object({ id: z.string() })),
      },
    },
    async (req, reply) => {
      try {
        const proof = await service.deleteProofById(req.params.id);
        if (!proof) {
          return reply.status(404).send({ error: 'Proof not found' });
        }

        req.auditOnResponse = {
          userId: req.user.id,
          action: 'PROOF_DELETED',
          resourceType: 'proof',
          resourceId: req.params.id,
        };

        return { success: true };
      } catch (err) {
        if (err.statusCode) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  fastify.delete(
    '/images/:imageId',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'), sanitize],
      schema: {
        tags: ['Proofs'],
        description: 'Delete a single image from a proof submission',
      },
    },
    async (req, reply) => {
      try {
        const image = await service.deleteProofImageById(req.params.imageId);
        if (!image) {
          return reply.status(404).send({ error: 'Image not found' });
        }

        req.auditOnResponse = {
          userId: req.user.id,
          action: 'PROOF_IMAGE_DELETED',
          resourceType: 'proof_image',
          resourceId: req.params.imageId,
        };

        return { success: true };
      } catch (err) {
        if (err.statusCode) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    }
  );
}

module.exports = routes;
