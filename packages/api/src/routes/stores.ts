import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@liquor/db';
import { authenticate, requireOwner, requireAdmin, JwtPayload, getAccessibleStoreIds } from '../plugins/auth';

const createStoreSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  address: z.string().max(500).trim().optional(),
  gstin: z.string().max(15).trim().optional(),
  licenseNo: z.string().max(50).trim().optional(),
});

const updateStoreSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  address: z.string().max(500).trim().optional(),
  gstin: z.string().max(15).trim().optional(),
  licenseNo: z.string().max(50).trim().optional(),
  isActive: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

export async function storeRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/stores — ADMIN sees own store, OWNER sees all owned stores
  fastify.get('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const payload = request.user as JwtPayload;
    const accessibleStoreIds = getAccessibleStoreIds(payload);

    const stores = await prisma.store.findMany({
      where: { id: { in: accessibleStoreIds } },
      include: {
        _count: {
          select: {
            users: { where: { isActive: true } },
            auditSessions: { where: { status: 'ACTIVE' } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return reply.send({ stores });
  });

  // POST /api/stores — OWNER only: create store and auto-assign to self
  fastify.post('/', { preHandler: [requireOwner] }, async (request, reply) => {
    const result = createStoreSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Validation Error', details: result.error.flatten().fieldErrors });
    }

    const payload = request.user as JwtPayload;
    const { name, address, gstin, licenseNo } = result.data;

    const store = await prisma.store.create({
      data: { name, address, gstin, licenseNo },
    });

    // Auto-assign new store to the owner
    await prisma.storeOwner.create({
      data: { userId: payload.sub, storeId: store.id },
    });

    return reply.status(201).send({ store });
  });

  // PATCH /api/stores/:id — OWNER only: update store details
  fastify.patch('/:id', { preHandler: [requireOwner] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const payload = request.user as JwtPayload;

    const owned = await prisma.storeOwner.findUnique({
      where: { userId_storeId: { userId: payload.sub, storeId: id } },
    });
    if (!owned) return reply.status(403).send({ error: 'Not your store' });

    const result = updateStoreSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Validation Error', details: result.error.flatten().fieldErrors });
    }

    const store = await prisma.store.update({
      where: { id },
      data: result.data,
    });

    return reply.send({ store });
  });

  // GET /api/stores/:id/stats — OWNER/ADMIN: store detail stats
  fastify.get('/:id/stats', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const payload = request.user as JwtPayload;
    const accessible = getAccessibleStoreIds(payload);
    if (!accessible.includes(id)) return reply.status(403).send({ error: 'Not your store' });

    const [store, workerCount, activeSession, totalSessions] = await Promise.all([
      prisma.store.findUnique({ where: { id } }),
      prisma.user.count({ where: { storeId: id, isActive: true, role: 'STAFF' } }),
      prisma.auditSession.count({ where: { storeId: id, status: 'ACTIVE' } }),
      prisma.auditSession.count({ where: { storeId: id } }),
    ]);

    if (!store) return reply.status(404).send({ error: 'Store not found' });

    return reply.send({ store, stats: { workerCount, activeSession, totalSessions } });
  });
}
