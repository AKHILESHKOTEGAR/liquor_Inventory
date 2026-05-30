import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@liquor/db';
import { authenticate, requireAdmin, getAccessibleStoreIds, JwtPayload } from '../plugins/auth';

const reassignSchema = z.object({
  storeId: z.string().min(1),
});

const createWorkerSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4–6 digits'),
  storeId: z.string().min(1).optional(),
});

const updateWorkerSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4–6 digits').optional(),
  isActive: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

async function generateEmployeeId(): Promise<string> {
  const users = await prisma.user.findMany({ select: { employeeId: true } });
  let max = 0;
  for (const u of users) {
    const m = u.employeeId.match(/^EMP-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `EMP-${String(max + 1).padStart(4, '0')}`;
}

export async function workerRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/workers — list all STAFF for accessible stores, with live session info
  fastify.get('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const payload = request.user as JwtPayload;
    const accessibleStoreIds = getAccessibleStoreIds(payload);

    const workers = await prisma.user.findMany({
      where: {
        role: 'STAFF',
        storeId: { in: accessibleStoreIds },
      },
      include: {
        store: { select: { id: true, name: true } },
        sessions: {
          where: { status: 'ACTIVE' },
          take: 1,
          orderBy: { startedAt: 'desc' },
          include: { _count: { select: { scanLogs: true } } },
        },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayCounts = await prisma.scanLog.groupBy({
      by: ['scannedBy'],
      where: {
        scannedBy: { in: workers.map((w) => w.id) },
        scannedAt: { gte: todayStart },
      },
      _count: { id: true },
    });

    const countMap = new Map(todayCounts.map((c) => [c.scannedBy, c._count.id]));

    const result = workers.map((w) => ({
      id: w.id,
      employeeId: w.employeeId,
      name: w.name,
      isActive: w.isActive,
      storeId: w.storeId,
      store: w.store,
      activeSession: w.sessions[0] ?? null,
      todayScans: countMap.get(w.id) ?? 0,
      scanning: w.sessions.length > 0,
      createdAt: w.createdAt,
    }));

    return reply.send({ workers: result });
  });

  // POST /api/workers — create new STAFF worker
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const payload = request.user as JwtPayload;
    const body = createWorkerSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        details: body.error.flatten().fieldErrors,
      });
    }

    const { name, pin, storeId: requestedStore } = body.data;

    // Determine target store
    const accessible = getAccessibleStoreIds(payload);
    let targetStoreId: string;

    if (payload.role === 'ADMIN') {
      // ADMIN always creates for their own store
      if (!payload.storeId) {
        return reply.status(403).send({ error: 'Admin has no assigned store' });
      }
      targetStoreId = payload.storeId;
    } else {
      // OWNER must specify storeId
      if (!requestedStore) {
        return reply.status(422).send({ error: 'storeId required for OWNER' });
      }
      if (!accessible.includes(requestedStore)) {
        return reply.status(403).send({ error: 'Store not in your access scope' });
      }
      targetStoreId = requestedStore;
    }

    const employeeId = await generateEmployeeId();
    const hashedPin = await bcrypt.hash(pin, parseInt(process.env.BCRYPT_ROUNDS ?? '10'));

    const worker = await prisma.user.create({
      data: {
        employeeId,
        name,
        pin: hashedPin,
        role: 'STAFF',
        storeId: targetStoreId,
        isActive: true,
      },
      include: { store: { select: { id: true, name: true } } },
    });

    // Return raw PIN once — caller must relay to worker securely
    return reply.status(201).send({
      worker: {
        id: worker.id,
        employeeId: worker.employeeId,
        name: worker.name,
        isActive: worker.isActive,
        storeId: worker.storeId,
        store: worker.store,
        createdAt: worker.createdAt,
      },
      credentials: {
        employeeId: worker.employeeId,
        pin,   // raw PIN shown ONCE
      },
    });
  });

  // PATCH /api/workers/:id — update name, reset PIN, or toggle active
  fastify.patch('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const payload = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = updateWorkerSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        details: body.error.flatten().fieldErrors,
      });
    }

    const accessible = getAccessibleStoreIds(payload);
    const worker = await prisma.user.findUnique({ where: { id } });

    if (!worker || worker.role !== 'STAFF') {
      return reply.status(404).send({ error: 'Worker not found' });
    }
    if (!worker.storeId || !accessible.includes(worker.storeId)) {
      return reply.status(403).send({ error: 'Worker not under your access scope' });
    }

    const updates: Record<string, unknown> = {};
    if (body.data.name) updates.name = body.data.name;
    if (body.data.pin) {
      updates.pin = await bcrypt.hash(body.data.pin, parseInt(process.env.BCRYPT_ROUNDS ?? '10'));
    }
    if (body.data.isActive !== undefined) updates.isActive = body.data.isActive;

    const updated = await prisma.user.update({
      where: { id },
      data: updates,
      include: { store: { select: { id: true, name: true } } },
    });

    return reply.send({
      worker: {
        id: updated.id,
        employeeId: updated.employeeId,
        name: updated.name,
        isActive: updated.isActive,
        storeId: updated.storeId,
        store: updated.store,
      },
      ...(body.data.pin ? { credentials: { employeeId: updated.employeeId, pin: body.data.pin } } : {}),
    });
  });

  // PATCH /api/workers/:id/assign — reassign worker to a different store (OWNER only in practice)
  fastify.patch('/:id/assign', { preHandler: [requireAdmin] }, async (request, reply) => {
    const payload = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = reassignSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({ error: 'storeId required' });
    }

    const accessible = getAccessibleStoreIds(payload);
    if (!accessible.includes(body.data.storeId)) {
      return reply.status(403).send({ error: 'Cannot assign worker to a store outside your access' });
    }

    const worker = await prisma.user.findUnique({ where: { id } });
    if (!worker || worker.role !== 'STAFF') {
      return reply.status(404).send({ error: 'Worker not found' });
    }
    if (worker.storeId && !accessible.includes(worker.storeId)) {
      return reply.status(403).send({ error: 'Worker not under your stores' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { storeId: body.data.storeId },
      include: { store: { select: { id: true, name: true } } },
    });

    return reply.send({ worker: updated });
  });

  // GET /api/workers/stores — list all stores admin can see (for dropdowns)
  fastify.get('/stores', { preHandler: [requireAdmin] }, async (request, reply) => {
    const payload = request.user as JwtPayload;
    const accessibleStoreIds = getAccessibleStoreIds(payload);

    const stores = await prisma.store.findMany({
      where: { id: { in: accessibleStoreIds } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return reply.send({ stores });
  });
}
