const PERMISSIONS = {
  ADMIN: ['all'],
  TL: ['read:team', 'write:team', 'read:attendance'],
  CAPTAIN: ['read:team'],
  INTERN: ['read:own_profile']
};

function rbac(action) {
  return (req, reply, done) => {
    const userRole = req.user?.role;
    const allowedActions = PERMISSIONS[userRole] || [];

    if (allowedActions.includes('all') || allowedActions.includes(action)) {
      return done();
    }

    return reply.status(403).send({ error: 'Forbidden' });
  };
}

module.exports = rbac;