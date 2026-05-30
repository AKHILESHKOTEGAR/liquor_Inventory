import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@liquor/db';

const setupSchema = z.object({
  storeName: z.string().min(2).max(100).trim(),
  ownerName: z.string().min(2).max(100).trim(),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4–6 digits'),
});

export async function setupRoutes(fastify: FastifyInstance) {
  // GET /api/setup/status — is there already an OWNER account?
  fastify.get('/status', async (_request, reply) => {
    const ownerCount = await prisma.user.count({ where: { role: 'OWNER' } });
    return reply.send({ ready: ownerCount > 0 });
  });

  // POST /api/setup — create first OWNER + store; disabled once any OWNER exists
  fastify.post('/', async (request, reply) => {
    const ownerCount = await prisma.user.count({ where: { role: 'OWNER' } });
    if (ownerCount > 0) {
      return reply.status(409).send({ error: 'System already initialized. Contact your administrator.' });
    }

    const body = setupSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        details: body.error.flatten().fieldErrors,
      });
    }

    const { storeName, ownerName, pin } = body.data;
    const hashedPin = await bcrypt.hash(pin, parseInt(process.env.BCRYPT_ROUNDS ?? '10'));

    const result = await prisma.$transaction(async (tx) => {
      const store = await tx.store.create({ data: { name: storeName } });

      const owner = await tx.user.create({
        data: {
          employeeId: 'EMP-0001',
          name: ownerName,
          pin: hashedPin,
          role: 'OWNER',
          isActive: true,
        },
      });

      await tx.storeOwner.create({
        data: { userId: owner.id, storeId: store.id },
      });

      return { owner, store };
    });

    return reply.status(201).send({
      message: 'Setup complete',
      credentials: {
        employeeId: result.owner.employeeId,
        pin,
      },
      store: { id: result.store.id, name: result.store.name },
    });
  });
}
