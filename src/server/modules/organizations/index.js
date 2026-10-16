const organizationRoutes = require('./adapters/incoming/organizations.routes');

async function organizationModule(fastify, options) {
  const { prefix, ...pluginOptions } = options;
  await fastify.register(organizationRoutes, pluginOptions);
}

module.exports = organizationModule;
