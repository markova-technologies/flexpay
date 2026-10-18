const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fastify hook — validates that all URL params that look like IDs are valid UUIDs.
 * Returns HTTP 400 (not 500) on invalid UUID, preventing the PostgreSQL
 * "invalid input syntax for type uuid: undefined" error.
 */
function validateUUIDParams(paramNames = []) {
  return async function (request, reply) {
    for (const name of paramNames) {
      const val = request.params ? request.params[name] : undefined;
      if (val !== undefined && !UUID_RE.test(val)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: `Invalid ID format for param '${name}': '${val}'`,
          statusCode: 400,
        });
      }
    }
  };
}

module.exports = { validateUUIDParams };
