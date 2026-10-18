const webhooksRoutes = require('./adapters/incoming/webhooks.routes');
const transactionRoutes = require('./adapters/incoming/transactions.routes');

async function transactionModule(fastify, options) {
  const { prefix, ...pluginOptions } = options;
  await fastify.register(webhooksRoutes, pluginOptions);
  await fastify.register(transactionRoutes, pluginOptions);
}

module.exports = transactionModule;
