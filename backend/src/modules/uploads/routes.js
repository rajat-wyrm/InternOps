const fs = require('fs');
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
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF
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
  // Upload / replace the current user's avatar
  fastify.post('/avatar', { preHandler: [auth] }, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const ext = path.extname(data.filename || '').toLowerCase();
    if (!ALLOWED.includes(data.mimetype) || !ALLOWED_EXTS.includes(ext)) {
      return reply.status(400).send({ error: 'Unsupported file type' });
    }

    const buffer = await data.toBuffer();

    // Magic-byte verification — defends against MIME spoofing
    const detectedMime = detectMimeFromBuffer(buffer);
    if (!detectedMime || detectedMime !== data.mimetype) {
      return reply
        .status(400)
        .send({ error: 'File contents do not match declared image type' });
    }

    const fileName = `avatar_${req.user.id}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    const uploadPath = path.join(__dirname, '..', '..', '..', config.uploadDir);
    fs.mkdirSync(uploadPath, { recursive: true });
    fs.writeFileSync(path.join(uploadPath, fileName), buffer);

    const url = `/uploads/${fileName}`;
    await repo.updateAvatarUrl(req.user.id, url);

    return { success: true, avatar_url: url };
  });
}

module.exports = routes;
