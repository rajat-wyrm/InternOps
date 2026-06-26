const auth = require('../../middleware/auth');
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
    { preHandler: [auth, rbac('INTERN')] },
    async (req, reply) => {
      const data = await req.file();

      if (!data)
        return reply.status(400).send({ error: 'Image file required' });

      const task_id = data.fields?.task_id?.value;

      if (!task_id)
        return reply.status(400).send({ error: 'task_id required' });

      // Validate MIME type and extension (declared values)
      const ext = path.extname(data.filename).toLowerCase();
      if (
        !ALLOWED_MIMES.includes(data.mimetype) ||
        !ALLOWED_EXTS.includes(ext)
      ) {
        return reply
          .status(400)
          .send({ error: 'Only JPEG, PNG, GIF images are allowed' });
      }
      if (data.file.truncated) {
        return reply.status(400).send({ error: 'File size exceeds limit' });
      }

      // Buffer the upload to validate contents, then persist

      // Authorization: the intern must actually be assigned to the task
      const isAssigned = await repo.isTaskAssignedToUser(task_id, req.user.id);
      if (!isAssigned) {
        return reply
          .status(403)
          .send({ error: 'You are not assigned to this task' });
      }

      // Generate UUID filename (use forward slashes only — works on Windows too)
      const filename = uuidv4() + ext;
      const absoluteUploadDir = path.resolve(
        __dirname,
        '..',
        '..',
        config.uploadDir
      );
      await fs.promises.mkdir(absoluteUploadDir, { recursive: true });
      const uploadPath = path.join(absoluteUploadDir, filename);

      const firstChunk = await data.file.read(16);

      const detectedMime = detectMimeFromBuffer(firstChunk);
      if (!detectedMime || detectedMime !== data.mimetype) {
        return reply
          .status(400)
          .send({ error: 'File contents do not match declared image type' });
      }

      const writeStream = fs.createWriteStream(uploadPath);

      writeStream.write(firstChunk);

      await pipeline(data.file, writeStream);

      const dbSavedPath = ['uploads', filename].join('/');
      const proof = await repo.submitProof(task_id, req.user.id, dbSavedPath);
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
    { preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN')] },
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
    { preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN')] },
    async (req) => {
      return repo.getProofsByTask(req.params.taskId);
    }
  );

  fastify.get('/my', { preHandler: [auth] }, async (req) => {
    return repo.getProofsByIntern(req.user.id);
  });
}

module.exports = routes;
