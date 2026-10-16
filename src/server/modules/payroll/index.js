const payrollRoutes = require('./adapters/incoming/payroll.routes');
const b2cWebhookRoutes = require('./adapters/incoming/b2c-webhook.routes');

async function payrollModule(fastify, options) {
  const { prefix, ...pluginOptions } = options;
  await fastify.register(payrollRoutes, pluginOptions);
  await fastify.register(b2cWebhookRoutes, pluginOptions);
}

module.exports = payrollModule;
