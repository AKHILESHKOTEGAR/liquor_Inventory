import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, SessionStatus } from '@liquor/db';
import { authenticate, requireAdmin, getAccessibleStoreIds, JwtPayload } from '../plugins/auth';

const createSessionSchema = z.object({
  notes: z.string().optional(),
  storeId: z.string().cuid().optional(),
});

export async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Create a new audit session
  fastify.post('/sessions', async (request, reply) => {
    const payload = request.user as JwtPayload;
    const body = createSessionSchema.safeParse(request.body ?? {});

    // Determine which store this session belongs to
    let storeId: string;
    if (payload.role === 'OWNER') {
      const requested = body.success ? body.data.storeId : undefined;
      if (!requested) {
        return reply.status(400).send({ error: 'OWNER must specify storeId when creating a session' });
      }
      if (!payload.ownedStoreIds.includes(requested)) {
        return reply.status(403).send({ error: 'Store not under your ownership' });
      }
      storeId = requested;
    } else if (payload.storeId) {
      storeId = payload.storeId;
    } else {
      return reply.status(403).send({ error: 'User not assigned to any store' });
    }

    // Block new session if one is already active for this store
    const existingActive = await prisma.auditSession.findFirst({
      where: { storeId, status: SessionStatus.ACTIVE },
      select: { id: true, sessionCode: true, startedAt: true },
    });
    if (existingActive) {
      return reply.status(409).send({
        error: `Session ${existingActive.sessionCode} is already active for this store. Close it before starting a new one.`,
        existingSessionId: existingActive.id,
        existingSessionCode: existingActive.sessionCode,
      });
    }

    // Take stock snapshot: count expected bottles per brand at this moment
    const brandStock = await prisma.brand.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, size: true, costPrice: true,
        bottles: {
          where: {
            status: { in: ['INWARDED', 'ON_SHELF'] },
            box: { storeId },
          },
          select: { id: true },
        },
      },
    });

    const snapshotData: Record<string, { name: string; size: string; count: number; costPrice: number }> = {};
    for (const brand of brandStock) {
      if (brand.bottles.length > 0) {
        snapshotData[brand.id] = {
          name: brand.name,
          size: brand.size,
          count: brand.bottles.length,
          costPrice: Number(brand.costPrice),
        };
      }
    }

    const sessionCode = `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const session = await prisma.auditSession.create({
      data: {
        sessionCode,
        storeId,
        createdBy: payload.sub,
        notes: body.success ? body.data.notes : undefined,
        snapshotData,
      },
      include: {
        user: { select: { employeeId: true, name: true } },
        store: { select: { id: true, name: true } },
      },
    });

    return reply.status(201).send({ session });
  });

  // List sessions — scoped by store; STAFF sees their own store only
  fastify.get('/sessions', async (request, reply) => {
    const payload = request.user as JwtPayload;
    const { status, storeId: requestedStore, page = '1', limit = '20' } = request.query as Record<string, string>;

    const accessibleStoreIds = getAccessibleStoreIds(payload, requestedStore);
    if (accessibleStoreIds.length === 0) {
      return reply.status(403).send({ error: 'No store access' });
    }

    const where = {
      storeId: { in: accessibleStoreIds },
      ...(status ? { status: status as SessionStatus } : {}),
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [sessions, total] = await Promise.all([
      prisma.auditSession.findMany({
        where,
        include: {
          user: { select: { employeeId: true, name: true } },
          store: { select: { id: true, name: true } },
          _count: { select: { scanLogs: true } },
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.auditSession.count({ where }),
    ]);

    return reply.send({ sessions, total, page: parseInt(page), limit: parseInt(limit) });
  });

  // Get single session — verify store access
  fastify.get('/sessions/:id', async (request, reply) => {
    const payload = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const session = await prisma.auditSession.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, employeeId: true, name: true } },
        store: { select: { id: true, name: true } },
        scanLogs: {
          include: {
            user: { select: { employeeId: true, name: true } },
            bottle: { include: { brand: true } },
          },
          orderBy: { scannedAt: 'asc' },
        },
      },
    });

    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const accessible = getAccessibleStoreIds(payload);
    if (!accessible.includes(session.storeId) && payload.role !== 'OWNER') {
      return reply.status(403).send({ error: 'Access denied to this session' });
    }

    const uniqueScans = session.scanLogs.filter((l) => !l.isDuplicate);
    const duplicates = session.scanLogs.filter((l) => l.isDuplicate);
    const workers = [...new Set(session.scanLogs.map((l) => l.user.employeeId))];

    return reply.send({
      session: {
        ...session,
        summary: {
          totalScans: session.scanLogs.length,
          uniqueBottles: uniqueScans.length,
          duplicateAttempts: duplicates.length,
          workerCount: workers.length,
          workers,
        },
      },
    });
  });

  // Close a session — STAFF can close sessions they created
  fastify.patch('/sessions/:id/close', async (request, reply) => {
    const payload = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const session = await prisma.auditSession.findUnique({ where: { id } });
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const accessible = getAccessibleStoreIds(payload);
    if (!accessible.includes(session.storeId)) {
      return reply.status(403).send({ error: 'Access denied to this session' });
    }

    if (session.status !== SessionStatus.ACTIVE) {
      return reply.status(409).send({ error: 'Session is not active' });
    }

    // Fix 13: SURPLUS requires explanation before closing
    const snapshotAtClose = session.snapshotData as Record<string, { count: number }> | null;
    if (snapshotAtClose && Object.keys(snapshotAtClose).length > 0) {
      const scannedLogs = await prisma.scanLog.findMany({
        where: { sessionId: id, isDuplicate: false, bottleId: { not: null } },
        include: { bottle: { select: { brandId: true } } },
      });
      const scannedCountPerBrand: Record<string, number> = {};
      for (const log of scannedLogs) {
        if (log.bottle) {
          scannedCountPerBrand[log.bottle.brandId] = (scannedCountPerBrand[log.bottle.brandId] ?? 0) + 1;
        }
      }
      const hasSurplus = Object.entries(scannedCountPerBrand).some(
        ([brandId, actual]) => actual > (snapshotAtClose[brandId]?.count ?? 0)
      );
      if (hasSurplus) {
        const closeBody = z.object({ surplusNotes: z.string().min(5) }).safeParse(request.body ?? {});
        if (!closeBody.success) {
          return reply.status(422).send({
            error: 'Surplus detected. Provide surplusNotes (min 5 chars) explaining the extra bottles.',
            hasSurplus: true,
          });
        }
        await prisma.auditSession.update({ where: { id }, data: { surplusNotes: closeBody.data.surplusNotes } });
      }
    }

    const closed = await prisma.auditSession.update({
      where: { id },
      data: { status: SessionStatus.CLOSED, closedAt: new Date() },
    });

    return reply.send({ session: closed });
  });

  // Discrepancy matrix — store-scoped
  fastify.get('/sessions/:id/discrepancy', { preHandler: [requireAdmin] }, async (request, reply) => {
    const payload = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const session = await prisma.auditSession.findUnique({
      where: { id },
      include: { store: { select: { id: true, name: true } } },
    });
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const accessible = getAccessibleStoreIds(payload);
    if (!accessible.includes(session.storeId)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Fix 8: Use snapshotData (frozen at session start) — immune to stock changes during/after audit.
    // Fall back to live query only for legacy sessions without snapshot.
    type SnapEntry = { name: string; size: string; count: number; costPrice: number };
    const snapshot = session.snapshotData as Record<string, SnapEntry> | null;

    let expectedByBrand: Record<string, { name: string; size: string; expected: number; costPrice: number }> = {};

    if (snapshot && Object.keys(snapshot).length > 0) {
      for (const [brandId, data] of Object.entries(snapshot)) {
        expectedByBrand[brandId] = { name: data.name, size: data.size, expected: data.count, costPrice: data.costPrice };
      }
    } else {
      const brands = await prisma.brand.findMany({
        where: { isActive: true },
        include: {
          bottles: {
            where: { status: { in: ['INWARDED', 'ON_SHELF'] }, box: { storeId: session.storeId } },
            select: { id: true },
          },
        },
      });
      for (const brand of brands) {
        expectedByBrand[brand.id] = {
          name: brand.name,
          size: brand.size,
          expected: brand.bottles.length,
          costPrice: Number(brand.costPrice),
        };
      }
    }

    const scannedByBrand = await prisma.scanLog.findMany({
      where: { sessionId: id, isDuplicate: false, bottleId: { not: null } },
      select: { bottleId: true },
    });

    const scannedBottleIds = new Set(scannedByBrand.map((s) => s.bottleId!));

    const scannedBottles = await prisma.bottle.findMany({
      where: { id: { in: [...scannedBottleIds] } },
      select: { brandId: true },
    });

    const scannedCountPerBrand: Record<string, number> = {};
    for (const b of scannedBottles) {
      scannedCountPerBrand[b.brandId] = (scannedCountPerBrand[b.brandId] ?? 0) + 1;
    }

    // Include brands that were scanned but not in snapshot (unknown surplus)
    const allBrandIds = new Set([...Object.keys(expectedByBrand), ...Object.keys(scannedCountPerBrand)]);

    const matrix = [...allBrandIds].map((brandId) => {
      const info = expectedByBrand[brandId] ?? { name: `Unknown (${brandId.slice(-6)})`, size: '?', expected: 0, costPrice: 0 };
      const expected = info.expected;
      const actual = scannedCountPerBrand[brandId] ?? 0;
      const variance = actual - expected;
      const financialImpact = Math.abs(variance) * info.costPrice;
      return {
        brandId,
        brandName: info.name,
        size: info.size,
        expected,
        actual,
        variance,
        financialImpact: financialImpact.toFixed(2),
        costPrice: info.costPrice,
        status: variance === 0 ? 'MATCH' : variance < 0 ? 'SHORTAGE' : 'SURPLUS',
      };
    });

    matrix.sort((a, b) => a.variance - b.variance);

    return reply.send({ sessionId: id, storeName: session.store.name, matrix, usedSnapshot: !!(snapshot && Object.keys(snapshot).length > 0) });
  });

  // Owner: summary across all stores
  fastify.get('/stores/summary', { preHandler: [requireAdmin] }, async (request, reply) => {
    const payload = request.user as JwtPayload;
    const accessibleStoreIds = getAccessibleStoreIds(payload);

    const stores = await prisma.store.findMany({
      where: { id: { in: accessibleStoreIds }, isActive: true },
      include: {
        _count: { select: { boxes: true } },
        auditSessions: {
          where: { status: SessionStatus.ACTIVE },
          select: { id: true },
        },
      },
    });

    const summary = await Promise.all(
      stores.map(async (store) => {
        const bottleCount = await prisma.bottle.count({
          where: { box: { storeId: store.id }, status: { in: ['INWARDED', 'ON_SHELF'] } },
        });
        return {
          storeId: store.id,
          storeName: store.name,
          activeSessions: store.auditSessions.length,
          totalBoxes: store._count.boxes,
          totalBottles: bottleCount,
        };
      })
    );

    return reply.send({ summary });
  });

  // Fix 12: Manager sign-off — mark a CLOSED session as verified
  fastify.patch('/sessions/:id/verify', { preHandler: [requireAdmin] }, async (request, reply) => {
    const payload = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const session = await prisma.auditSession.findUnique({ where: { id } });
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const accessible = getAccessibleStoreIds(payload);
    if (!accessible.includes(session.storeId)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    if (session.status !== SessionStatus.CLOSED) {
      return reply.status(409).send({ error: 'Only CLOSED sessions can be verified' });
    }

    const body = z.object({ surplusNotes: z.string().min(5).optional() }).safeParse(request.body ?? {});

    const updated = await prisma.auditSession.update({
      where: { id },
      data: {
        verifiedBy: payload.sub,
        ...(body.success && body.data.surplusNotes ? { surplusNotes: body.data.surplusNotes } : {}),
      },
      include: { user: { select: { employeeId: true, name: true } } },
    });

    return reply.send({ session: updated });
  });
}
