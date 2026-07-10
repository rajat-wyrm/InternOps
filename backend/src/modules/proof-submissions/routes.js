const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const auth = require('../../middleware/auth');
const { z } = require('zod');
const { toSchema } = require('../../utils/schemaHelper');
const rbac = require('../../middleware/rbac');
const repo = require('../social-tasks/repository');
const { checkHierarchyAccess } = require('../../utils/hierarchy');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const { pipeline } = require('stream/promises');
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif'];
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif'];
const uploadRepo = require('../uploads/repository');
const MAGIC_BYTES = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
};

function detectMimeFromBuffer(buf) {
  if (!buf || buf.length < 4) return null;
  for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const sig of signatures) {
      if (sig.every((byte, i) => buf[i] === byte)) return mime;
    }
  }
  return null;
}

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
      const parts = req.parts();
      let task_id = null;
      let didComment = false;
      let didRepost = false;
      let didShare = false;

      const filesData = [];

      for await (const part of parts) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          if (buffer.length > 0) {
            filesData.push({
              filename: part.filename,
              mimetype: part.mimetype,
              buffer: buffer,
              truncated: part.file.truncated,
            });
          }
        } else {
          switch (part.fieldname) {
            case 'task_id':
              task_id = part.value;
              break;
            case 'didComment':
              didComment = part.value === 'true';
              break;
            case 'didRepost':
              didRepost = part.value === 'true';
              break;
            case 'didShare':
              didShare = part.value === 'true';
              break;
          }
        }
      }

      if (!task_id) {
        return reply.status(400).send({ error: 'task_id required' });
      }

      if (filesData.length === 0)
        return reply.status(400).send({ error: 'Image file required' });

      if (filesData.length > 5)
        return reply.status(400).send({ error: 'Maximum 5 images allowed' });

      // Authorization: the intern must actually be assigned to the task
      const isAssigned = await repo.isTaskAssignedToUser(task_id, req.user.id);
      if (!isAssigned) {
        return reply
          .status(403)
          .send({ error: 'You are not assigned to this task' });
      }

      const absoluteUploadDir = path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        config.uploadDir
      );
      await fs.promises.mkdir(absoluteUploadDir, { recursive: true });

      const dbSavedPaths = [];
      const writtenFiles = [];

      try {
        for (const data of filesData) {
          const ext = path.extname(data.filename).toLowerCase();
          if (
            !ALLOWED_MIMES.includes(data.mimetype) ||
            !ALLOWED_EXTS.includes(ext)
          ) {
            return reply
              .status(400)
              .send({ error: 'Only JPEG, PNG, GIF images are allowed' });
          }
          if (data.truncated) {
            return reply.status(400).send({ error: 'File size exceeds limit' });
          }

          const firstChunk = data.buffer.subarray(0, 16);
          const detectedMime = detectMimeFromBuffer(firstChunk);
          if (!detectedMime || detectedMime !== data.mimetype) {
            return reply.status(400).send({
              error: 'File contents do not match declared image type',
            });
          }

          const filename = uuidv4() + ext;
          const uploadPath = path.join(absoluteUploadDir, filename);

          await fs.promises.writeFile(uploadPath, data.buffer);
          writtenFiles.push(uploadPath);
          dbSavedPaths.push(['uploads', filename].join('/'));
        }
      } catch (error) {
        for (const file of writtenFiles) {
          try {
            await fs.promises.unlink(file);
          } catch (_) {
            // Ignore cleanup errors
          }
        }
        throw error;
      }
      if (!didComment && !didRepost && !didShare) {
        return reply.status(400).send({
          error: 'At least one engagement action must be selected.',
        });
      }
      const proof = await repo.submitProofWithImages(
        task_id,
        req.user.id,
        dbSavedPaths,
        {
          didComment,
          didRepost,
          didShare,
        }
      );

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'PROOF_SUBMITTED',
        resourceType: 'proof',
        resourceId: proof.id,
      };
      return proof;
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
      // Repository enforces hierarchy check; the route only validates
      // existence and delegates authorization to the data layer.
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
      const proof = await repo.getProof(req.params.id);
      if (!proof) {
        return reply.status(404).send({ error: 'Proof not found' });
      }
      await repo.deleteProof(req.params.id);

      // Delete legacy image if it exists
      if (proof.image_path) {
        await uploadRepo.deleteFile(proof.image_path).catch(() => {});
      }

      // Delete multiple images if they exist
      if (proof.images && proof.images.length > 0) {
        await Promise.all(
          proof.images.map((imgPath) =>
            uploadRepo.deleteFile(imgPath).catch(() => {})
          )
        );
      }

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'PROOF_DELETED',
        resourceType: 'proof',
        resourceId: req.params.id,
      };

      return { success: true };
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
      const image = await repo.getProofImage(req.params.imageId);
      if (!image) {
        return reply.status(404).send({ error: 'Image not found' });
      }

      await repo.deleteProofImage(req.params.imageId);
      await uploadRepo.deleteFile(image.image_path).catch(() => {});

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'PROOF_IMAGE_DELETED',
        resourceType: 'proof_image',
        resourceId: req.params.imageId,
      };

      return { success: true };
    }
  );
}

module.exports = routes;
