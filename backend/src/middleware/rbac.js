const PERMISSIONS = {
  ADMIN: ['all'],
  TL: ['read:team', 'write:team', 'read:attendance'],
  CAPTAIN: ['read:team'],
  INTERN: ['read:own_profile'],
};

// '...requirements' use karke hum multiple arguments accept kar sakte hain (pehle wale code ki tarah)
function rbac(...requirements) {
  return (req, reply, done) => {
    const userRole = req.user?.role;
    const allowedActions = PERMISSIONS[userRole] || [];

    // Agar user ADMIN hai, toh seedha aage badhne do
    if (allowedActions.includes('all')) {
      return done();
    }

    // Check karo ki paas kiye gaye requirements mein se koi action ya legacy role match hota hai kya
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
