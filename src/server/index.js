const Fastify = require('fastify');
const { loadConfig } = require('./config');
const authModule = require('./modules/auth');
const organizationModule = require('./modules/organizations');
const employeeModule = require('./modules/employees');
const merchantModule = require('./modules/merchants');
const transactionModule = require('./modules/transactions');
const payrollModule = require('./modules/payroll');

async function buildServer(options = {}) {
  const config = loadConfig();

  const fastify = Fastify({
    logger: options.logger ?? {
      level: config.LOG_LEVEL,
      redact: ['req.headers.authorization', 'body.password', 'body.passwordHash'],
    },
    genReqId: () => require('node:crypto').randomUUID(),
  });

  // Plugins
  await fastify.register(require('@fastify/cors'), {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });
  await fastify.register(require('@fastify/helmet'), {
    contentSecurityPolicy: false,
  });
  await fastify.register(require('@fastify/cookie'));
  await fastify.register(require('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute',
  });

  // Register Modules under /api/v1
  await fastify.register(authModule, { prefix: '/api/v1', ...options });
  await fastify.register(organizationModule, { prefix: '/api/v1', ...options });
  await fastify.register(employeeModule, { prefix: '/api/v1', ...options });
  await fastify.register(merchantModule, { prefix: '/api/v1', ...options });
  await fastify.register(transactionModule, { prefix: '/api/v1', ...options });
  await fastify.register(payrollModule, { prefix: '/api/v1', ...options });

  // System Health endpoint
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  fastify.get('/api/v1/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  return fastify;
}

async function start() {
  const config = loadConfig();
  const server = await buildServer();
  await server.listen({ port: config.PORT, host: '0.0.0.0' });
  console.log(`FlexPay v2 server listening at http://localhost:${config.PORT}`);
  return server;
}

if (require.main === module) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { buildServer, start };
