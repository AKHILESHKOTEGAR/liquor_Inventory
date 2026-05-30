import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { prisma } from '@liquor/db';
import { loginSchema } from '../validators/auth.validator';
import { jtiDenyList } from '../plugins/jtiDenyList';
import { JwtPayload } from '../plugins/auth';

export async function authRoutes(fastify: FastifyInstance) {
  // Strict rate limit on login — 8 attempts per 15 minutes per IP
  fastify.post('/login', {
    config: {
      rateLimit: {
        max: 8,
        timeWindow: '15 minutes',
        errorResponseBuilder: () => ({
          error: 'Too many login attempts. Try again in 15 minutes.',
          statusCode: 429,
        }),
      },
    },
  }, async (request, reply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Validation Error', details: result.error.flatten().fieldErrors });
    }

    const { employeeId, pin } = result.data;

    const user = await prisma.user.findUnique({
      where: { employeeId, isActive: true },
      include: {
        store: { select: { id: true, name: true } },
        storeOwners: { include: { store: { select: { id: true, name: true } } } },
      },
    });

    if (!user) return reply.status(401).send({ error: 'Invalid credentials' });

    const pinMatch = await bcrypt.compare(pin, user.pin);
    if (!pinMatch) return reply.status(401).send({ error: 'Invalid credentials' });

    const ownedStoreIds = user.storeOwners.map((so) => so.storeId);
    const ownedStores = user.storeOwners.map((so) => ({ id: so.storeId, name: so.store.name }));

    const token = fastify.jwt.sign({
      sub: user.id,
      jti: randomUUID(),
      employeeId: user.employeeId,
      name: user.name,
      role: user.role,
      storeId: user.storeId ?? null,
      ownedStoreIds,
    });

    return reply.send({
      token,
      user: {
        id: user.id,
        employeeId: user.employeeId,
        name: user.name,
        role: user.role,
        storeId: user.storeId ?? null,
        ownedStores: user.role === 'OWNER' ? ownedStores : (user.store ? [{ id: user.store.id, name: user.store.name }] : []),
      },
    });
  });

  // Logout — revoke this token's JTI so it cannot be reused until expiry
  fastify.delete('/logout', {
    preHandler: [async (req, rep) => {
      try { await req.jwtVerify(); }
      catch { rep.status(401).send({ error: 'Unauthorized' }); }
    }],
  }, async (request, reply) => {
    const payload = request.user as JwtPayload & { jti?: string };
    if (payload.jti) jtiDenyList.add(payload.jti);
    return reply.send({ success: true });
  });

  fastify.get(
    '/me',
    {
      preHandler: [async (req, rep) => {
        try { await req.jwtVerify(); }
        catch { rep.status(401).send({ error: 'Unauthorized' }); }
      }],
    },
    async (request, reply) => {
      const payload = request.user as { sub: string };
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          employeeId: true,
          name: true,
          role: true,
          isActive: true,
          storeId: true,
          store: { select: { id: true, name: true } },
          storeOwners: { include: { store: { select: { id: true, name: true } } } },
        },
      });
      if (!user) return reply.status(404).send({ error: 'User not found' });
      return reply.send({ user });
    }
  );
}
