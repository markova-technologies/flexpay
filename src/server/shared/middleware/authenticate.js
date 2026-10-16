const { verifyAccessToken } = require('../crypto/jwt');

async function authenticate(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7).trim();
  try {
    const payload = verifyAccessToken(token);
    request.user = payload;
  } catch (err) {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };
