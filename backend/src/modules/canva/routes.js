const crypto = require('crypto');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const featureFlagMiddleware = require('../../middleware/featureFlag');
const audit = require('../../utils/audit');
const service = require('./service');
const repo = require('../certificates/repository');

// In-process store for OAuth state values: userId → { state, expiresAt }
// Single-use: deleted immediately after successful verification.
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const oauthStateStore = new Map();

function storeState(userId) {
  const state = crypto.randomBytes(16).toString('hex');
  oauthStateStore.set(userId, { state, expiresAt: Date.now() + STATE_TTL_MS });
  return state;
}

function consumeState(userId, incoming) {
  const entry = oauthStateStore.get(userId);
  oauthStateStore.delete(userId); // single-use regardless of outcome
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) return false;
  if (entry.state.length !== incoming.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(entry.state),
    Buffer.from(incoming)
  );
}

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
      const state = storeState(req.user.id);
      const url = service.getAuthUrl(state);
      if (!url) {
        oauthStateStore.delete(req.user.id);
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
      const { code, error, state } = req.query;
      if (error || !code) {
        return reply.redirect(
          `${process.env.APP_URL || 'http://localhost:5173'}/admin/canva-templates?error=${error || 'no_code'}`
        );
      }

      if (!state || !consumeState(req.user.id, state)) {
        return reply.redirect(
          `${process.env.APP_URL || 'http://localhost:5173'}/admin/canva-templates?error=invalid_state`
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
module.exports.oauthStateStore = oauthStateStore;
