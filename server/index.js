// CourierOfHearts v3 backend entrypoint.
// Binds to 127.0.0.1 by default — nginx is the only public-facing service.
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { config, assertPathIsAbsolute } from './config.js';
import { runMigrations, migrateLegacyJson, integrityCheck } from './db.js';
import { registerRoutes } from './routes.js';

assertPathIsAbsolute();

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    redact: {
      // Belt-and-braces: these should never be logged anyway.
      paths: ['req.headers.authorization', 'req.headers.cookie'],
      censor: '[redacted]',
    },
  },
  bodyLimit: config.bodyLimit,
  trustProxy: true, // nginx sits in front; needed for per-IP rate limiting
});

await fastify.register(rateLimit, {
  global: true,
  max: 300,
  timeWindow: '1 minute',
});

fastify.addHook('onSend', async (request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Referrer-Policy', 'no-referrer');
  reply.header('X-Robots-Tag', 'noindex, nofollow, noarchive');
  reply.header('Cross-Origin-Resource-Policy', 'same-origin');
  if (String(request.raw.url || '').startsWith('/api')) reply.header('Cache-Control', 'no-store');
});

fastify.setErrorHandler((error, request, reply) => {
  if (error.statusCode === 429) {
    return reply.code(429).send({ success: false, error: 'Too many requests. Let the ink dry a moment.', code: 'RATE_LIMITED' });
  }
  if (error.statusCode === 413) {
    return reply.code(413).send({ success: false, error: 'Request too large', code: 'PAYLOAD_TOO_LARGE' });
  }
  if (error.validation || error.statusCode === 400) {
    return reply.code(400).send({ success: false, error: 'Invalid request', code: 'VALIDATION_ERROR' });
  }
  request.log.error({ err: { message: error.message, stack: error.stack } }, 'Unhandled server error');
  reply.code(500).send({ success: false, error: 'Internal server error', code: 'SERVER_ERROR' });
});

fastify.setNotFoundHandler((request, reply) => {
  reply.code(404).send({ success: false, error: 'Not found', code: 'NOT_FOUND' });
});

runMigrations();
if (!integrityCheck()) {
  fastify.log.error('SQLite integrity check failed — refusing to start.');
  process.exit(1);
}
migrateLegacyJson(fastify.log);
registerRoutes(fastify);

await fastify.listen({ port: config.port, host: config.host });
fastify.log.info(`CourierOfHearts v3 backend on ${config.host}:${config.port} (${config.nodeEnv})`);
