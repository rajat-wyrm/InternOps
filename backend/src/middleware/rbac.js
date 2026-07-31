const PERMISSIONS = {
  ADMIN: ['all'],
  SENIOR_TL: [
    'read:team',
    'write:team',
    'read:attendance',
    'read:reports',
    'manage:team',
  ],
  TL: ['read:team', 'write:team', 'read:attendance'],
  CAPTAIN: ['read:team'],
  INTERN: ['read:own_profile'],
};

// By using '...requirements', we can accept multiple arguments (like in the previous code)
function rbac(...requirements) {
  return (req, reply, done) => {
    const userRole = req.user?.role;
    const allowedActions = PERMISSIONS[userRole] || [];

    // If the user is ADMIN, let them proceed directly
    if (allowedActions.includes('all') || userRole === 'ADMIN') {
      return done();
    }

    // Check if any of the passed requirements matches an allowed action or if the user's role matches the requirement.
    const hasPermission = requirements.some(
      (reqItem) => allowedActions.includes(reqItem) || userRole === reqItem
    );

    if (hasPermission) {
      return done();
    }

    return reply.status(403).send({ error: 'Forbidden' });
  };
}

module.exports = rbac;
