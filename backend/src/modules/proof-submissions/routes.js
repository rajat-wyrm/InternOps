const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const auth = require('../../middleware/auth');
const { z } = require('zod');
const { toSchema } = require('../../utils/schemaHelper');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const service = require('./service');

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
    async (req) => {
      return repo.getProofsByTask(req.params.taskId);
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
