const merchantRoutes = require('./adapters/incoming/merchants.routes');

async function merchantModule(fastify, options) {
  const { prefix, ...pluginOptions } = options;
  await fastify.register(merchantRoutes, pluginOptions);
}

module.exports = merchantModule;
