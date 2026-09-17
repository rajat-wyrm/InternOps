const service = require('./service');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');

module.exports = async function routes(fastify) {
  // Create report template
  fastify.post(
    '/',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (request, reply) => {
      try {
        const {
          name,
          description,
          createdBy,
          departmentId,
          visibility,
          isDefault,
          configuration,
        } = request.body || {};

        const template = await service.createTemplate({
          name,
          description,
          createdBy: createdBy || request.user?.id,
          departmentId,
          visibility,
          isDefault,
          configuration,
        });

        return reply.code(201).send(template);
      } catch (err) {
        request.log.error({ err }, 'Failed to create report template');

        return reply.code(err.status || 500).send({
          error: err.message || 'Failed to create report template',
          detail: err.detail || null,
          code: err.code || null,
        });
      }
    }
  );

  // Get all report templates
  fastify.get(
    '/',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (request, reply) => {
      try {
        const { departmentId, visibility } = request.query;

        const templates = await service.getTemplates({
          departmentId,
          visibility,
        });

        return reply.code(200).send(templates);
      } catch (err) {
        request.log.error({ err }, 'Failed to get report templates');

        return reply.code(500).send({
          error: 'Failed to get report templates',
        });
      }
    }
  );

  // Get report template by ID
  fastify.get(
    '/:id',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (request, reply) => {
      try {
        const template = await service.getTemplate(request.params.id);

        return reply.code(200).send(template);
      } catch (err) {
        request.log.error({ err }, 'Failed to get report template');

        return reply.code(err.status || 500).send({
          error: err.message || 'Failed to get report template',
        });
      }
    }
  );

  // Update report template
  fastify.put(
    '/:id',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (request, reply) => {
      try {
        const {
          name,
          description,
          departmentId,
          visibility,
          isDefault,
          configuration,
        } = request.body || {};

        const template = await service.updateTemplate(request.params.id, {
          name,
          description,
          departmentId,
          visibility,
          isDefault,
          configuration,
        });

        return reply.code(200).send(template);
      } catch (err) {
        request.log.error({ err }, 'Failed to update report template');

        return reply.code(err.status || 500).send({
          error: err.message || 'Failed to update report template',
        });
      }
    }
  );

  // Delete report template
  fastify.delete(
    '/:id',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (request, reply) => {
      try {
        const deleted = await service.deleteTemplate(request.params.id);

        return reply.code(200).send({
          success: true,
          id: deleted.id,
        });
      } catch (err) {
        request.log.error({ err }, 'Failed to delete report template');

        return reply.code(err.status || 500).send({
          error: err.message || 'Failed to delete report template',
        });
      }
    }
  );

  // Get report template versions
  fastify.get(
    '/:id/versions',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (request, reply) => {
      try {
        const versions = await service.getVersions(request.params.id);

        return reply.code(200).send(versions);
      } catch (err) {
        request.log.error({ err }, 'Failed to get report template versions');

        return reply.code(err.status || 500).send({
          error: err.message || 'Failed to get report template versions',
        });
      }
    }
  );

  // Create a new report template version
  fastify.post(
    '/:id/versions',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (request, reply) => {
      try {
        const { configuration, createdBy } = request.body || {};

        const version = await service.createVersion(
          request.params.id,
          configuration,
          createdBy || request.user?.id
        );

        return reply.code(201).send(version);
      } catch (err) {
        request.log.error({ err }, 'Failed to create report template version');

        return reply.code(err.status || 500).send({
          error: err.message || 'Failed to create report template version',
        });
      }
    }
  );
};
