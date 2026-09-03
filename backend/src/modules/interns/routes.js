const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');

function normalize(body) {
  return {
    serial_no: Number(body.serial_no),
    record_date: body.record_date || null,
    intern_code: String(body.intern_code || '').trim(),
    full_name: String(body.full_name || '').trim(),
    email_id: String(body.email_id || '').trim() || null,
    mobile_no: String(body.mobile_no || '').trim() || null,
    domain: String(body.domain || '').trim() || null,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
  };
}

function validate(data) {
  if (!Number.isInteger(data.serial_no) || data.serial_no < 1)
    return 'Serial number must be a positive integer';
  if (!data.intern_code) return 'Intern code is required';
  if (!data.full_name) return 'Full name is required';
  return null;
}

async function routes(fastify) {
  fastify.get(
    '/',
    {
      preHandler: [auth, rbac('ADMIN')],
      schema: {
        tags: ['Interns'],
        description: 'List interns',
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string', maxLength: 100 },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 100 },
          },
        },
      },
    },
    async (req) => repo.listInterns(req.query)
  );

  fastify.post(
    '/',
    {
      preHandler: [auth, rbac('ADMIN'), sanitize],
      schema: { tags: ['Interns'] },
    },
    async (req, reply) => {
      const data = normalize(req.body || {});
      const error = validate(data);
      if (error) return reply.status(400).send({ error });
      const intern = await repo.createIntern(data);
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'INTERN_CREATED',
        resourceType: 'intern',
        resourceId: String(intern.id),
      };
      return reply.status(201).send(intern);
    }
  );

  fastify.put(
    '/:id',
    {
      preHandler: [auth, rbac('ADMIN'), sanitize],
      schema: {
        tags: ['Interns'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'integer' } },
        },
      },
    },
    async (req, reply) => {
      const data = normalize(req.body || {});
      const error = validate(data);
      if (error) return reply.status(400).send({ error });
      const intern = await repo.updateIntern(req.params.id, data);
      if (!intern) return reply.status(404).send({ error: 'Intern not found' });
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'INTERN_UPDATED',
        resourceType: 'intern',
        resourceId: String(req.params.id),
      };
      return intern;
    }
  );

  fastify.delete(
    '/:id',
    {
      preHandler: [auth, rbac('ADMIN')],
      schema: {
        tags: ['Interns'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'integer' } },
        },
      },
    },
    async (req, reply) => {
      const deleted = await repo.deleteIntern(req.params.id);
      if (!deleted)
        return reply.status(404).send({ error: 'Intern not found' });
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'INTERN_DELETED',
        resourceType: 'intern',
        resourceId: String(req.params.id),
      };
      return { message: 'Intern deleted' };
    }
  );
}

module.exports = routes;
