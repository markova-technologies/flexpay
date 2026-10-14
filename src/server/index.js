/**
 * FlexPay Authoritative Backend Server
 * =====================================
 * Node.js Modular Monolith Server Entry Point.
 * Port: 4000 (Proxy target for Vite dev server on port 3100).
 */

const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const config = require('./config.js');
const { getDb } = require('./storage/db.js');
const { router } = require('./api/routes.js');

const app = express();

// Initialize database
const db = getDb();

// Middlewares
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`[HTTP] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next;
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    name: 'FlexPay Authoritative Core',
    env: config.safaricom.env,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    name: 'FlexPay Authoritative Core',
    env: config.safaricom.env,
    timestamp: new Date().toISOString(),
  });
});

// Mount Authoritative API routes
app.use('/api', router);

// Serve compiled client static assets if available
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  // SPA fallback for frontend client routing
  app.get('{*path}', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
}

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Cannot ${req.method} ${req.originalUrl}` },
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: err.message || 'An unexpected error occurred.' },
  });
});

const server = app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 FlexPay Authoritative Core active on port ${config.port}`);
  console.log(`   Gateway Environment: ${config.safaricom.env.toUpperCase()}`);
  console.log(`   Authoritative SQLite: ${config.dbPath}`);
  console.log(`=======================================================`);
});

// Handle graceful shutdown
function handleShutdown() {
  console.log('\n[FlexPay Core] Gracefully stopping server...');
  server.close(() => {
    console.log('[FlexPay Core] HTTP server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

module.exports = { app, server };
