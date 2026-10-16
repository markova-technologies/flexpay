const authRoutes = require('./adapters/incoming/auth.routes');

async function authModule(fastify, options) {
  const { prefix, ...pluginOptions } = options;
  await fastify.register(authRoutes, pluginOptions);
}

module.exports = authModule;
