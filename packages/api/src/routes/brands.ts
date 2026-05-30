import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, BottleSize } from '@liquor/db';
import { authenticate, requireAdmin } from '../plugins/auth';

const createBrandSchema = z.object({
  name: z.string().min(1).max(100),
  size: z.nativeEnum(BottleSize),
  costPrice: z.number().positive(),
  retailPrice: z.number().positive(),
  imageRef: z.string().optional(),
});

export async function brandRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (_request, reply) => {
    const brands = await prisma.brand.findMany({
      where: { isActive: true },
      include: { _count: { select: { bottles: true } } },
      orderBy: [{ name: 'asc' }, { size: 'asc' }],
    });
    return reply.send({ brands });
  });

  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const result = createBrandSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Validation Error', details: result.error.flatten() });
    }

    const brand = await prisma.brand.create({ data: result.data });
    return reply.status(201).send({ brand });
  });

  fastify.patch('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = createBrandSchema.partial().safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Validation Error', details: result.error.flatten() });
    }

    const brand = await prisma.brand.update({ where: { id }, data: result.data });
    return reply.send({ brand });
  });
}
