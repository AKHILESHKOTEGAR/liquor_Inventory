import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import path from 'path';
import fs from 'fs';

import { prisma, SessionStatus } from '@liquor/db';
import { authRoutes } from './routes/auth';
import { auditRoutes } from './routes/audit';
import { scanRoutes } from './routes/scan';
import { brandRoutes } from './routes/brands';
import { boxRoutes } from './routes/boxes';
import { exportRoutes } from './routes/export';
import { workerRoutes } from './routes/workers';
import { storeRoutes } from './routes/stores';
import { setupRoutes } from './routes/setup';

const server = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
});

// Allow empty JSON bodies (e.g. PATCH close-session with no payload)
server.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
  if (!body || (body as string).trim() === '') { done(null, {}); return; }
  try { done(null, JSON.parse(body as string)); } catch (e) { done(e as Error, undefined); }
});

const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true;

server.register(cors, {
  origin: corsOrigins,
  credentials: true,
});

// Global rate limit — generous for normal use
server.register(rateLimit, {
  global: true,
  max: 200,
  timeWindow: '1 minute',
});

server.register(jwt, {
  secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-prod',
  sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' },
});

server.register(multipart, {
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB ?? '5') * 1024 * 1024),
  },
});

server.register(authRoutes, { prefix: '/api/auth' });
server.register(auditRoutes, { prefix: '/api/audit' });
server.register(scanRoutes, { prefix: '/api/scan' });
server.register(brandRoutes, { prefix: '/api/brands' });
server.register(boxRoutes, { prefix: '/api/boxes' });
server.register(exportRoutes, { prefix: '/api/export' });
server.register(workerRoutes, { prefix: '/api/workers' });
server.register(storeRoutes, { prefix: '/api/stores' });
server.register(setupRoutes, { prefix: '/api/setup' });

server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

const start = async () => {
  try {
    const port = parseInt(process.env.PORT ?? '3001');
    await server.listen({ port, host: '::' });
    console.log(`API server running on port ${port}`);

    // Fix 10: Auto-close ACTIVE sessions older than 12 hours — prevents ghost sessions from open locks
    const STALE_SESSION_MS = 12 * 60 * 60 * 1000;
    setInterval(async () => {
      const cutoff = new Date(Date.now() - STALE_SESSION_MS);
      const result = await prisma.auditSession.updateMany({
        where: { status: SessionStatus.ACTIVE, startedAt: { lt: cutoff } },
        data: { status: SessionStatus.CLOSED, closedAt: new Date() },
      });
      if (result.count > 0) {
        server.log.warn(`Auto-closed ${result.count} stale audit session(s) older than 12h`);
      }
    }, 30 * 60 * 1000);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
