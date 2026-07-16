/**
 * API v2 router
 *
 * Register this plugin in app.js with prefix '/api/v2'.
 * Only mount modules here when a BREAKING change is needed
 * (e.g. renamed/removed fields, changed HTTP semantics).
 *
 * Stable v1 routes continue to work alongside v2.
 * Follow the deprecation process in CONTRIBUTING.md:
 *   1. Add this module under /api/v2/
 *   2. Set V1_DEPRECATED=true in the environment on the day
 *      v1 of that module enters its sunset window.
 *   3. Add Deprecation + Sunset headers to the v1 route group
 *      (the onSend hook in routes.js picks these up automatically).
 *
 * Example — add a breaking change to the users module:
 *
 *   fastify.register(require('./modules/users/routes.v2'), {
 *     prefix: '/users',
 *   });
 */
module.exports = async function routesV2(fastify) {
  // No v2 routes yet.
  // When a module needs a breaking change, register it here.
};
