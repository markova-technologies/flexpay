const Fastify = require('fastify');
const { loadConfig } = require('./config');
const { ensureSchema } = require('./infrastructure/database/migrator');
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

  // Dynamic CORS origin handler: allows localhost, vercel deployments, and configured CORS_ORIGIN
  await fastify.register(require('@fastify/cors'), {
    origin: (origin, cb) => {
      // Allow non-browser requests (no origin) like curl, server-to-server, mobile
      if (!origin) return cb(null, true);

      // Allow localhost, 127.0.0.1, Vercel deployments, Render internal services
      const allowedPatterns = [
        /^http:\/\/localhost(:\d+)?$/,
        /^http:\/\/127\.0\.0\.1(:\d+)?$/,
        /^https:\/\/.*\.vercel\.app$/,
        /^https:\/\/.*\.onrender\.com$/,
      ];

      if (config.CORS_ORIGIN) {
        const customOrigins = config.CORS_ORIGIN.split(',').map((o) => o.trim());
        if (customOrigins.includes(origin) || customOrigins.includes('*')) {
          return cb(null, true);
        }
      }

      const matches = allowedPatterns.some((pattern) => pattern.test(origin));
      if (matches) {
        return cb(null, true);
      }

      // Default allow with reflection
      return cb(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });
  await fastify.register(require('@fastify/helmet'), {
    contentSecurityPolicy: false,
  });
  await fastify.register(require('@fastify/cookie'));
  await fastify.register(require('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute',
  });

  // Root endpoint for Render health probes and pings
  fastify.get('/', async () => ({
    status: 'ok',
    service: 'flexpay-api',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  }));

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

  // Run schema verification without blocking port discovery for Cloud PaaS
  ensureSchema().catch((err) => {
    console.warn('[Migrator] Background schema verification warning:', err.message);
  });

  return server;
}

if (require.main === module) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { buildServer, start };
