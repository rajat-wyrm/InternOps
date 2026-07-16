'use strict';

const service = require('../modules/feature-flags/service');

/**
 * featureFlagMiddleware
 *
 * Route-level preHandler that blocks a route when a feature flag is disabled.
 * If the flag is off for the requesting user, a 404 is returned (the feature
 * simply doesn't exist yet as far as that user is concerned).
 *
 * Usage in any Fastify route file:
 *
 *   const featureFlagMiddleware = require('../../middleware/featureFlag');
 *
 *   fastify.get('/my-route', {
 *     preHandler: [authenticate, featureFlagMiddleware('NEW_DASHBOARD_V2')]
 *   }, handler);
 *
 * @param {string} flagKey  The flag key as defined in flags.config.js
 * @returns {Function} Fastify preHandler function
 */
function featureFlagMiddleware(flagKey) {
  return async function checkFeatureFlag(request, reply) {
    const enabled = await service.isEnabled(flagKey, request.user ?? null);
    if (!enabled) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `This feature is not available.`,
      });
    }
  };
}

module.exports = featureFlagMiddleware;
