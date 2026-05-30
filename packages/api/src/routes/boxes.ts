import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, BottleStatus } from '@liquor/db';
import { authenticate, requireAdmin, getAccessibleStoreIds, JwtPayload } from '../plugins/auth';

const inwardBoxSchema = z.object({
  boxBarcode: z.string().min(1),
  brandId: z.string().cuid(),
  storeId: z.string().cuid(),
  bottleCount: z.number().int().min(1).max(48),
  qrStrings: z.array(z.string().min(1)).optional(),
});

export async function boxRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const payload = request.user as JwtPayload;
    const { brandId, storeId: requestedStore, page = '1', limit = '20' } = request.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const accessibleStoreIds = getAccessibleStoreIds(payload, requestedStore);
    if (accessibleStoreIds.length === 0) {
      return reply.status(403).send({ error: 'No store access' });
    }

    const where = {
      storeId: { in: accessibleStoreIds },
      ...(brandId ? { brandId } : {}),
    };

    const boxes = await prisma.box.findMany({
      where,
      include: {
        brand: true,
        store: { select: { id: true, name: true } },
        _count: { select: { bottles: true } },
      },
      orderBy: { inwaredAt: 'desc' },
      skip,
      take: parseInt(limit),
    });

    return reply.send({ boxes });
  });

  fastify.get('/:id', async (request, reply) => {
    const payload = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const box = await prisma.box.findUnique({
      where: { id },
      include: {
        brand: true,
        store: { select: { id: true, name: true } },
        bottles: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!box) return reply.status(404).send({ error: 'Box not found' });

    const accessible = getAccessibleStoreIds(payload);
    if (!accessible.includes(box.storeId)) {
      return reply.status(403).send({ error: 'Access denied to this box' });
    }

    return reply.send({ box });
  });

  // Inward a new box with bottles
  fastify.post('/inward', { preHandler: [requireAdmin] }, async (request, reply) => {
    const payload = request.user as JwtPayload;
    const result = inwardBoxSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Validation Error', details: result.error.flatten() });
    }

    const { boxBarcode, brandId, storeId, bottleCount, qrStrings } = result.data;

    const accessible = getAccessibleStoreIds(payload);
    if (!accessible.includes(storeId)) {
      return reply.status(403).send({ error: 'Access denied to this store' });
    }

    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) return reply.status(404).send({ error: 'Brand not found' });

    const bottlesData = qrStrings
      ? qrStrings.map((qr) => ({
          stateExciseQrString: qr,
          brandId,
          status: BottleStatus.INWARDED,
        }))
      : Array.from({ length: bottleCount }, (_, i) => ({
          stateExciseQrString: `PENDING-${Date.now()}-${i}`,
          brandId,
          status: BottleStatus.INWARDED,
        }));

    const box = await prisma.box.create({
      data: {
        boxBarcode,
        brandId,
        storeId,
        bottles: { create: bottlesData },
      },
      include: {
        brand: true,
        store: { select: { id: true, name: true } },
        _count: { select: { bottles: true } },
      },
    });

    return reply.status(201).send({ box });
  });
}
