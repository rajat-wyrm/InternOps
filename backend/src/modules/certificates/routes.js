const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const audit = require('../../utils/audit');
const service = require('./service');
const {
  templateCreateSchema,
  templateUpdateSchema,
  certificateGenerateSchema,
  bulkGenerateSchema,
  aiGenerateContentSchema,
  aiSuggestTemplateSchema,
} = require('./schemas');

async function routes(fastify) {
  // All routes require authentication + admin role
  fastify.addHook('onRequest', auth);
  fastify.addHook('onRequest', rbac('ADMIN'));

  // ============================================================
  // Templates
  // ============================================================

  fastify.get(
    '/templates',
    {
      schema: {
        tags: ['Certificates'],
        description: 'List certificate templates',
      },
    },
    async (req) => {
      const templates = await service.listTemplates(req.query);
      return { success: true, data: templates };
    }
  );

  fastify.get(
    '/templates/:id',
    {
      schema: { tags: ['Certificates'], description: 'Get template by ID' },
    },
    async (req, reply) => {
      const template = await service.getTemplate(req.params.id);
      if (!template)
        return reply.code(404).send({ error: 'Template not found' });
      return { success: true, data: template };
    }
  );

  fastify.post(
    '/templates',
    {
      schema: {
        tags: ['Certificates'],
        description: 'Create certificate template',
      },
    },
    async (req, reply) => {
      const data = templateCreateSchema.parse(req.body);
      const template = await service.createTemplate(data, req.user.id);
      return reply.code(201).send({ success: true, data: template });
    }
  );

  fastify.put(
    '/templates/:id',
    {
      schema: {
        tags: ['Certificates'],
        description: 'Update certificate template',
      },
    },
    async (req, reply) => {
      const data = templateUpdateSchema.parse(req.body);
      const template = await service.updateTemplate(req.params.id, data);
      if (!template)
        return reply.code(404).send({ error: 'Template not found' });
      return { success: true, data: template };
    }
  );

  fastify.delete(
    '/templates/:id',
    {
      schema: {
        tags: ['Certificates'],
        description: 'Delete certificate template',
      },
    },
    async (req, reply) => {
      const result = await service.deleteTemplate(req.params.id);
      if (!result) return reply.code(404).send({ error: 'Template not found' });
      return { success: true, message: 'Template deleted' };
    }
  );

  fastify.post(
    '/templates/seed',
    {
      schema: { tags: ['Certificates'], description: 'Seed default templates' },
    },
    async (req) => {
      const count = await service.seedDefaultTemplates(req.user.id);
      return { success: true, message: `${count} default templates seeded` };
    }
  );

  // ============================================================
  // Certificates
  // ============================================================

  fastify.get(
    '/',
    {
      schema: { tags: ['Certificates'], description: 'List all certificates' },
    },
    async (req) => {
      return service.listCertificates(req.query);
    }
  );

  fastify.get(
    '/:id',
    {
      schema: { tags: ['Certificates'], description: 'Get certificate by ID' },
    },
    async (req, reply) => {
      const cert = await service.getCertificate(req.params.id);
      if (!cert)
        return reply.code(404).send({ error: 'Certificate not found' });
      return { success: true, data: cert };
    }
  );

  fastify.post(
    '/generate',
    {
      schema: {
        tags: ['Certificates'],
        description: 'Generate a single certificate',
      },
    },
    async (req, reply) => {
      const data = certificateGenerateSchema.parse(req.body);
      const result = await service.generateCertificate(data, req.user.id);

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'CERTIFICATE_GENERATE',
        resourceType: 'certificate',
        resourceId: result.data.id,
        details: {
          recipient: data.recipient_name,
          type: data.certificate_type,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      return reply.code(201).send(result);
    }
  );

  fastify.delete(
    '/:id',
    {
      schema: {
        tags: ['Certificates'],
        description: 'Delete/revoke certificate',
      },
    },
    async (req, reply) => {
      const result = await service.deleteCertificate(req.params.id);
      if (!result)
        return reply.code(404).send({ error: 'Certificate not found' });

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'CERTIFICATE_DELETE',
        resourceType: 'certificate',
        resourceId: req.params.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      return { success: true, message: 'Certificate deleted' };
    }
  );

  // ============================================================
  // Bulk Operations
  // ============================================================

  fastify.post(
    '/bulk/generate',
    {
      schema: {
        tags: ['Certificates'],
        description: 'Bulk generate certificates',
      },
    },
    async (req, reply) => {
      const data = bulkGenerateSchema.parse(req.body);
      const result = await service.startBulkGeneration(data, req.user.id);

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'CERTIFICATE_BULK_GENERATE',
        resourceType: 'bulk_job',
        resourceId: result.data.job_id,
        details: {
          total: result.data.total,
          generated: result.data.generated,
          failed: result.data.failed,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      return reply.code(201).send(result);
    }
  );

  fastify.get(
    '/bulk/:jobId',
    {
      schema: { tags: ['Certificates'], description: 'Get bulk job status' },
    },
    async (req, reply) => {
      const job = await service.getBulkJobStatus(req.params.jobId);
      if (!job) return reply.code(404).send({ error: 'Bulk job not found' });
      return { success: true, data: job };
    }
  );

  // ============================================================
  // AI Features
  // ============================================================

  fastify.post(
    '/ai/generate-content',
    {
      schema: {
        tags: ['Certificates', 'AI'],
        description: 'AI-generate certificate content',
      },
    },
    async (req) => {
      const data = aiGenerateContentSchema.parse(req.body);
      return service.generateAIContent(data);
    }
  );

  fastify.post(
    '/ai/suggest-template',
    {
      schema: {
        tags: ['Certificates', 'AI'],
        description: 'AI-suggest best template',
      },
    },
    async (req) => {
      const data = aiSuggestTemplateSchema.parse(req.body);
      const template = await service.suggestTemplate(data);
      return { success: true, data: template };
    }
  );

  // ============================================================
  // Quick Generate — simple cert generation
  // ============================================================

  fastify.post(
    '/quick-generate',
    {
      schema: {
        tags: ['Certificates'],
        description: 'Quick generate certificate with name, domain, dates',
      },
    },
    async (req, reply) => {
      const {
        template_id,
        recipient_name,
        role,
        domain,
        start_date,
        end_date,
        issuer,
      } = req.body;

      if (!recipient_name || !domain || !start_date || !end_date) {
        return reply.code(400).send({
          error:
            'recipient_name, domain, start_date, and end_date are required',
        });
      }

      const result = await service.quickGenerate(
        {
          template_id,
          recipient_name,
          role,
          domain,
          start_date,
          end_date,
          issuer: issuer || 'InternOps',
        },
        req.user.id
      );

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'CERTIFICATE_QUICK_GENERATE',
        resourceType: 'certificate',
        resourceId: result.data.id,
        details: {
          recipient: recipient_name,
          domain,
          cert_number: result.data.certificate_number,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      return reply.code(201).send(result);
    }
  );

  // ============================================================
  // Public Verification (no auth required - handled by separate route)
  // ============================================================
}

module.exports = routes;
