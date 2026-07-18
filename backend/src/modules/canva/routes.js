const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const featureFlagMiddleware = require('../../middleware/featureFlag');
const audit = require('../../utils/audit');
const service = require('./service');
const repo = require('../certificates/repository');

async function routes(fastify) {
  // All routes require authentication + admin role
  fastify.addHook('onRequest', auth);
  fastify.addHook('onRequest', rbac('ADMIN'));
  // Gate entire module behind CANVA_INTEGRATION flag
  fastify.addHook('preHandler', featureFlagMiddleware('CANVA_INTEGRATION'));

  // Get Canva OAuth URL
  fastify.get(
    '/auth/url',
    {
      schema: {
        tags: ['Canva'],
        description: 'Get Canva OAuth authorization URL',
      },
    },
    async (req) => {
      const url = service.getAuthUrl();
      if (!url) {
        return {
          success: false,
          error:
            'Canva integration not configured. Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET in .env',
        };
      }
      return { success: true, data: { url } };
    }
  );

  // OAuth callback
  fastify.get(
    '/auth/callback',
    {
      schema: { tags: ['Canva'], description: 'Canva OAuth callback handler' },
    },
    async (req, reply) => {
      const { code, error } = req.query;
      if (error || !code) {
        return reply.redirect(
          `${process.env.APP_URL || 'http://localhost:5173'}/admin/canva-templates?error=${error || 'no_code'}`
        );
      }

      try {
        const tokens = await service.exchangeCodeForToken(code);
        await repo.saveCanvaSettings(
          {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: new Date(
              Date.now() + tokens.expires_in * 1000
            ).toISOString(),
            organization_id: tokens.team_id || null,
          },
          req.user.id
        );

        req.auditOnResponse = {
          userId: req.user.id,
          action: 'CANVA_CONNECT',
          resourceType: 'canva',
          details: { organization_id: tokens.team_id },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        };

        return reply.redirect(
          `${process.env.APP_URL || 'http://localhost:5173'}/admin/canva-templates?success=true`
        );
      } catch (err) {
        return reply.redirect(
          `${process.env.APP_URL || 'http://localhost:5173'}/admin/canva-templates?error=${err.message}`
        );
      }
    }
  );

  // Connection status
  fastify.get(
    '/status',
    {
      schema: { tags: ['Canva'], description: 'Check Canva connection status' },
    },
    async () => {
      const status = await service.getConnectionStatus();
      return { success: true, data: status };
    }
  );

  // List designs
  fastify.get(
    '/designs',
    {
      schema: { tags: ['Canva'], description: 'List user Canva designs' },
    },
    async () => {
      try {
        const designs = await service.listDesigns();
        return { success: true, data: designs };
      } catch {
        return { success: true, data: [] };
      }
    }
  );

  // Import design as template
  fastify.post(
    '/import/:designId',
    {
      schema: {
        tags: ['Canva'],
        description: 'Import Canva design as certificate template',
      },
    },
    async (req, reply) => {
      const template = await service.importDesignAsTemplate(
        req.params.designId,
        req.user.id
      );

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'CANVA_IMPORT',
        resourceType: 'template',
        resourceId: template.id,
        details: { canva_design_id: req.params.designId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      return reply.code(201).send({ success: true, data: template });
    }
  );

  // Export certificate to Canva
  fastify.post(
    '/export/:certificateId',
    {
      schema: {
        tags: ['Canva'],
        description: 'Export certificate as Canva design',
      },
    },
    async (req, reply) => {
      const design = await service.exportCertificateToCanva(
        req.params.certificateId
      );

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'CANVA_EXPORT',
        resourceType: 'certificate',
        resourceId: req.params.certificateId,
        details: { canva_design_id: design.id },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      return reply.code(201).send({ success: true, data: design });
    }
  );

  // List brands
  fastify.get(
    '/brands',
    {
      schema: { tags: ['Canva'], description: 'List Canva brand kits' },
    },
    async () => {
      const brands = await service.listBrands();
      return { success: true, data: brands };
    }
  );
}

module.exports = routes;
