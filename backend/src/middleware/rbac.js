const PERMISSIONS = {
  ADMIN: ['all'],
  SENIOR_TL: ['read:team', 'write:team', 'read:attendance', 'read:reports'],
  TL: ['read:team', 'write:team', 'read:attendance'],
  CAPTAIN: ['read:team'],
  INTERN: ['read:own_profile'],
};

function rbac(...requirements) {
  return (req, reply, done) => {
    const userRole = req.user?.role;
    const allowedActions = PERMISSIONS[userRole] || [];

    if (allowedActions.includes('all')) {
      return done();
    }

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
