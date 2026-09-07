const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const auth = require('../../middleware/auth');
const repo = require('./repository');
const config = require('../../config');

const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];
const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const MAGIC_BYTES = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
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

      if (!data) {
        return reply.status(400).send({
          error: 'No file uploaded',
        });
      }

      const ext = path.extname(data.filename || '').toLowerCase();

      if (!ALLOWED.includes(data.mimetype) || !ALLOWED_EXTS.includes(ext)) {
        return reply.status(400).send({
          error: 'Unsupported file type',
        });
      }

      const buffer = await data.toBuffer();

      if (data.file.truncated) {
        return reply.status(413).send({
          error: 'File exceeds maximum size of 5MB',
        });
      }

      // Magic-byte verification
      const detectedMime = detectMimeFromBuffer(buffer);

      if (!detectedMime || detectedMime !== data.mimetype) {
        return reply.status(400).send({
          error: 'File contents do not match declared image type',
        });
      }

      const fileName =
        `avatar_${req.user.id}_` +
        `${crypto.randomBytes(6).toString('hex')}${ext}`;

      const uploadPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        config.uploadDir
      );

      const targetFilePath = path.resolve(uploadPath, fileName);
      const absoluteUploadPath = path.resolve(uploadPath);

      // Path traversal protection
      if (
        targetFilePath !== absoluteUploadPath &&
        !targetFilePath.startsWith(absoluteUploadPath + path.sep)
      ) {
        return reply.status(400).send({
          error: 'Invalid file path',
        });
      }

      fs.mkdirSync(uploadPath, { recursive: true });
      fs.writeFileSync(targetFilePath, buffer);

      const url = `/uploads/${fileName}`;

      try {
        await repo.createImage({
          userId: req.user.id,
          filePath: url,
          fileName,
          mimeType: data.mimetype,
          fileSize: buffer.length,
        });

        await repo.updateAvatarUrl(req.user.id, url);
        await repo.saveImageMetadata(
          req.user.id,
          fileName,
          url,
          detectedMime,
          buffer.length
        );
      } catch (err) {
        // Remove the uploaded file if database persistence fails.
        try {
          await fs.promises.unlink(targetFilePath);
        } catch (cleanupErr) {
          if (cleanupErr.code !== 'ENOENT') {
            req.log.error(
              { err: cleanupErr, filePath: targetFilePath },
              'Failed to clean up uploaded image after database error'
            );
          }
        }

        throw err;
      }

      return {
        success: true,
        avatar_url: url,
      };
    }
  );

  // Retrieve / download an uploaded image
  fastify.get(
    '/:fileName',
    {
      preHandler: [auth],
      schema: {
        tags: ['Uploads'],
        description: 'Retrieve an uploaded image',
      },
    },
    async (req, reply) => {
      const { fileName } = req.params;

      const safeFileName = path.basename(fileName);

      if (safeFileName !== fileName) {
        return reply.status(400).send({
          error: 'Invalid file name',
        });
      }

      const uploadPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        config.uploadDir
      );

      const filePath = path.resolve(uploadPath, safeFileName);
      const absoluteUploadPath = path.resolve(uploadPath);

      if (
        filePath !== absoluteUploadPath &&
        !filePath.startsWith(absoluteUploadPath + path.sep)
      ) {
        return reply.status(400).send({
          error: 'Invalid file path',
        });
      }

      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({
          error: 'Image not found',
        });
      }

      const mimeType = MIME_BY_EXT[path.extname(safeFileName).toLowerCase()];
      if (!mimeType) {
        return reply.status(400).send({
          error: 'Unsupported image type',
        });
      }
      return reply
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .type(mimeType)
        .send(fs.createReadStream(filePath));
    }
  );

  // Delete an uploaded image
  fastify.delete(
    '/:fileName',
    {
      preHandler: [auth, sanitize],
      schema: {
        tags: ['Uploads'],
        description: 'Delete an uploaded image',
      },
    },
    async (req, reply) => {
      const { fileName } = req.params;

      // Prevent path traversal
      const safeFileName = path.basename(fileName);

      if (safeFileName !== fileName) {
        return reply.status(400).send({
          error: 'Invalid file name',
        });
      }

      // Check that the image belongs to the current user
      const image = await repo.findImageByFileName(req.user.id, safeFileName);

      if (!image) {
        return reply.status(404).send({
          error: 'Image not found',
        });
      }

      // Delete the physical file
      await repo.deleteFile(image.file_path);

      // Delete metadata from database
      await repo.deleteImageMetadata(image.id);

      return {
        success: true,
        message: 'Image deleted successfully',
      };
    }
  );

  // Upload a notice image
  fastify.post(
    '/notice-image',
    {
      preHandler: [auth, sanitize],
      schema: {
        tags: ['Uploads'],
        description: 'Upload a notice image (multipart)',
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

      const detectedMime = detectMimeFromBuffer(buffer);
      if (!detectedMime || detectedMime !== data.mimetype) {
        return reply
          .status(400)
          .send({ error: 'File contents do not match declared image type' });
      }

      const fileName = `notice_${req.user.id}_${crypto.randomBytes(6).toString('hex')}${ext}`;
      const uploadPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        config.uploadDir
      );

      const targetFilePath = path.resolve(uploadPath, fileName);
      const absoluteUploadPath = path.resolve(uploadPath);

      if (!targetFilePath.startsWith(absoluteUploadPath)) {
        return reply.status(400).send({ error: 'Invalid file path' });
      }

      fs.mkdirSync(uploadPath, { recursive: true });
      fs.writeFileSync(targetFilePath, buffer);

      const url = `/uploads/${fileName}`;

      return { success: true, image_url: url };
    }
  );

  // Remove the current user's avatar
  fastify.delete(
    '/avatar',
    {
      preHandler: [auth, sanitize],
      schema: {
        tags: ['Uploads'],
        description: 'Remove the current avatar image',
      },
    },
    async (req, reply) => {
      const avatarUrl = await repo.getAvatarUrl(req.user.id);

      if (!avatarUrl) {
        return reply.status(400).send({
          error: 'No custom avatar to remove',
        });
      }

      await repo.updateAvatarUrl(req.user.id, null);

      if (avatarUrl.startsWith('/uploads/')) {
        await repo.deleteFile(avatarUrl).catch((err) => {
          req.log.warn(
            { err, userId: req.user.id },
            'Failed to delete avatar file'
          );
        });
      }

      return {
        success: true,
        avatar_url: null,
      };
    }
  );
}

module.exports = routes;
