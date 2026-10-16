const webhooksRoutes = require('./adapters/incoming/webhooks.routes');

async function transactionModule(fastify, options) {
  const { prefix, ...pluginOptions } = options;
  await fastify.register(webhooksRoutes, pluginOptions);
}

module.exports = transactionModule;
