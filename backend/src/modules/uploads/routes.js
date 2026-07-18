const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const fs = require('fs');
const { toSchema } = require('../../utils/schemaHelper');
const path = require('path');
const crypto = require('crypto');
const auth = require('../../middleware/auth');
const repo = require('./repository');
const config = require('../../config');

const ALLOWED = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
];

const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

const MAGIC_BYTES = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
};

function detectMimeFromBuffer(buf) {
  if (!buf || buf.length < 4) return null;

  // WebP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }

  for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const sig of signatures) {
      if (sig.every((byte, i) => buf[i] === byte)) {
        return mime;
      }
    }
  }

  return null;
}

async function routes(fastify) {
  // Upload / replace the current user's avatar
  fastify.post(
    '/avatar',
    {
      preHandler: [auth, sanitize],
      schema: {
        tags: ['Uploads'],
        description: 'Upload/replace avatar image (multipart)',
      },
    },
    async (req, reply) => {
      const data = await req.file();
      if (!data) return reply.status(400).send({ error: 'No file uploaded' });

      const ext = path.extname(data.filename || '').toLowerCase();
      if (!ALLOWED.includes(data.mimetype) || !ALLOWED_EXTS.includes(ext)) {
        return reply.status(400).send({ error: 'Unsupported file type' });
      }

      const buffer = await data.toBuffer();

      if (data.file.truncated) {
        return reply
          .status(413)
          .send({ error: 'File exceeds maximum size of 5MB' });
      }

      // Magic-byte verification — defends against MIME spoofing
      const detectedMime = detectMimeFromBuffer(buffer);
      if (!detectedMime || detectedMime !== data.mimetype) {
        return reply
          .status(400)
          .send({ error: 'File contents do not match declared image type' });
      }

      const fileName = `avatar_${req.user.id}_${crypto.randomBytes(6).toString('hex')}${ext}`;
      const uploadPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        config.uploadDir
      );

      // Calculate the absolute path of the target file
      const targetFilePath = path.resolve(uploadPath, fileName);
      const absoluteUploadPath = path.resolve(uploadPath);

      // Security Check: Path Traversal Protection
      if (!targetFilePath.startsWith(absoluteUploadPath)) {
        return reply.status(400).send({ error: 'Invalid file path' });
      }

      fs.mkdirSync(uploadPath, { recursive: true });
      fs.writeFileSync(targetFilePath, buffer);

      const url = `/uploads/${fileName}`;
      await repo.updateAvatarUrl(req.user.id, url);

      return { success: true, avatar_url: url };
    }
  );
}

module.exports = routes;
