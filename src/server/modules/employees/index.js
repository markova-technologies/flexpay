const employeeRoutes = require('./adapters/incoming/employees.routes');

async function employeeModule(fastify, options) {
  const { prefix, ...pluginOptions } = options;
  await fastify.register(employeeRoutes, pluginOptions);
}

module.exports = employeeModule;
