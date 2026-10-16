function requireRole(...roles) {
  return async (request, reply) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden: insufficient permissions' });
    }
  };
}

module.exports = { requireRole };
