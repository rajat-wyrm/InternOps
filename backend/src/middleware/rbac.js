const PERMISSIONS = {
  ADMIN: ['all'],

  MANAGEMENT: ['read:team', 'read:attendance', 'read:reports', 'read:tasks'],

  HR: [
    'read:users',
    'write:users',
    'read:team',
    'write:team',
    'read:attendance',
    'write:attendance',
    'read:tasks',
    'write:tasks',
    'read:reports',
  ],

  SENIOR_TL: [
    'read:team',
    'write:team',
    'read:attendance',
    'read:reports',
    'manage:team',
    'read:tasks',
    'write:tasks',
  ],

  TL: [
    'read:team',
    'write:team',
    'read:attendance',
    'read:tasks',
    'write:tasks',
  ],

  CAPTAIN: ['read:team', 'read:tasks', 'write:tasks'],

  INTERN: [
    'read:own_profile',
    'read:own_attendance',
    'write:own_attendance',
    'read:own_tasks',
    'write:own_tasks',
  ],
};

function rbac(...requirements) {
  return (req, reply, done) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User role is missing',
      });
    }

    const allowedActions = PERMISSIONS[userRole] || [];

    // ADMIN has complete access
    if (allowedActions.includes('all')) {
      return done();
    }

    const hasPermission = requirements.some((requirement) => {
      return allowedActions.includes(requirement) || userRole === requirement;
    });

    if (hasPermission) {
      return done();
    }

    return reply.status(403).send({
      error: 'Forbidden',
    });
  };
}

module.exports = rbac;
