'use strict';

const authenticate = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const service = require('./service');
const repository = require('./repository');
const FLAGS = require('./flags.config');
const { z } = require('zod');

// ─── Validation schemas ───────────────────────────────────────────────────────

const updateFlagSchema = z.object({
  enabled: z.boolean().optional(),
  rolloutPct: z.number().int().min(0).max(100).optional(),
  allowedRoles: z
    .array(z.enum(['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN']))
    .nullable()
    .optional(),
  description: z.string().max(500).optional(),
});

// ─── Route plugin ─────────────────────────────────────────────────────────────

module.exports = async function featureFlagsRoutes(fastify) {
  /**
   * GET /feature-flags
   * Returns all flags evaluated for the calling user (boolean map).
   * Used by the frontend on boot.
   */
  fastify.get('/', { preHandler: [authenticate] }, async (req, reply) => {
    const flagMap = await service.getAllForUser(req.user);
    return reply.send({ flags: flagMap });
  });

  /**
   * GET /feature-flags/definitions
   * Returns full admin view of all flag definitions with DB metadata.
   * ADMIN only.
   */
  fastify.get(
    '/definitions',
    { preHandler: [authenticate, rbac('ADMIN')] },
    async (req, reply) => {
      const definitions = await service.getAllDefinitions();
      return reply.send({ flags: definitions });
    }
  );

  /**
   * GET /feature-flags/:key
   * Returns the evaluated boolean for a single flag for the calling user.
   */
  fastify.get('/:key', { preHandler: [authenticate] }, async (req, reply) => {
    const { key } = req.params;

    if (!FLAGS[key]) {
      return reply.status(404).send({ error: `Unknown flag: ${key}` });
    }

    const enabled = await service.isEnabled(key, req.user);
    return reply.send({ key, enabled });
  });

  /**
   * PUT /feature-flags/:key
   * Update a flag's configuration. ADMIN only.
   * Immediately invalidates the cache for the flag.
   */
  fastify.put(
    '/:key',
    { preHandler: [authenticate, rbac('ADMIN')] },
    async (req, reply) => {
      const { key } = req.params;

      if (!FLAGS[key]) {
        return reply.status(404).send({ error: `Unknown flag: ${key}` });
      }

      const parsed = updateFlagSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation error',
          details: parsed.error.issues,
        });
      }

      const { enabled, rolloutPct, allowedRoles, description } = parsed.data;

      // Fetch current row to merge partial updates
      const current = await repository.findByKey(key);
      const staticDef = FLAGS[key];

      const updated = await repository.upsert({
        key,
        enabled: enabled ?? current?.enabled ?? staticDef.defaultEnabled,
        rolloutPct:
          rolloutPct ?? current?.rollout_pct ?? staticDef.rolloutPct ?? 100,
        allowedRoles:
          allowedRoles !== undefined
            ? allowedRoles
            : (current?.allowed_roles ?? null),
        description:
          description ?? current?.description ?? staticDef.description,
        updatedBy: req.user.id,
      });

      // Bust the cache so the new value takes effect instantly
      service.invalidate(key);

      return reply.send({ flag: updated });
    }
  );

  /**
   * POST /feature-flags/:key/disable
   * Kill-switch — instantly disables a flag. ADMIN only.
   * Cache is invalidated immediately.
   */
  fastify.post(
    '/:key/disable',
    { preHandler: [authenticate, rbac('ADMIN')] },
    async (req, reply) => {
      const { key } = req.params;

      if (!FLAGS[key]) {
        return reply.status(404).send({ error: `Unknown flag: ${key}` });
      }

      const updated = await repository.disable(key, req.user.id);

      if (!updated) {
        return reply
          .status(404)
          .send({ error: `Flag not found in database: ${key}` });
      }

      service.invalidate(key);

      return reply.send({ message: `Flag "${key}" disabled.`, flag: updated });
    }
  );

  /**
   * POST /feature-flags/:key/enable
   * Re-enable a previously disabled flag. ADMIN only.
   */
  fastify.post(
    '/:key/enable',
    { preHandler: [authenticate, rbac('ADMIN')] },
    async (req, reply) => {
      const { key } = req.params;

      if (!FLAGS[key]) {
        return reply.status(404).send({ error: `Unknown flag: ${key}` });
      }

      const current = await repository.findByKey(key);
      const staticDef = FLAGS[key];

      const updated = await repository.upsert({
        key,
        enabled: true,
        rolloutPct: current?.rollout_pct ?? staticDef.rolloutPct ?? 100,
        allowedRoles: current?.allowed_roles ?? null,
        description: current?.description ?? staticDef.description,
        updatedBy: req.user.id,
      });

      service.invalidate(key);

      return reply.send({ message: `Flag "${key}" enabled.`, flag: updated });
    }
  );
};
