const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const auth = require('../../middleware/auth');
const pool = require('../../config/db');
const config = require('../../config');

const ALLOWED = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
];

async function routes(fastify) {
  // Upload / replace the current user's avatar
  fastify.post('/avatar', { preHandler: [auth] }, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });
    if (!ALLOWED.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Unsupported file type' });
    }

    const buffer = await data.toBuffer();
    const ext = path.extname(data.filename || '') || '.png';
    const fileName = `avatar_${req.user.id}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    const uploadPath = path.join(__dirname, '..', '..', '..', config.uploadDir);
    fs.mkdirSync(uploadPath, { recursive: true });
    fs.writeFileSync(path.join(uploadPath, fileName), buffer);

    const url = `/uploads/${fileName}`;
    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [
      url,
      req.user.id,
    ]);

    return { success: true, avatar_url: url };
  });
}

module.exports = routes;
