const PERMISSIONS = {
  ADMIN: ['all'],
  SENIOR_TL: ['read:team', 'write:team', 'read:attendance', 'read:reports'],
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
    if (allowedActions.includes('all')) {
      return done();
    }

    // Check if any of the passed requirements matches an allowed action or the user's role
    const hasPermission = requirements.some(
      (reqItem) => allowedActions.includes(reqItem) || reqItem === userRole
    );

    if (hasPermission) {
      return done();
    }

    return reply.status(403).send({ error: 'Forbidden' });
  };
}

module.exports = rbac;
