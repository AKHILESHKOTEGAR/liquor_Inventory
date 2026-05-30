import { FastifyRequest, FastifyReply } from 'fastify';
import { jtiDenyList } from './jtiDenyList';

export interface JwtPayload {
  sub: string;
  employeeId: string;
  name: string;
  role: string;
  storeId: string | null;
  ownedStoreIds: string[];
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const p = request.user as JwtPayload & { jti?: string };
    if (p.jti && jtiDenyList.has(p.jti)) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Token revoked' });
    }
  } catch {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const user = request.user as JwtPayload;
  if (user.role !== 'ADMIN' && user.role !== 'OWNER') {
    return reply.status(403).send({ error: 'Forbidden', message: 'Admin or Owner access required' });
  }
}

export async function requireOwner(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const user = request.user as JwtPayload;
  if (user.role !== 'OWNER') {
    return reply.status(403).send({ error: 'Forbidden', message: 'Owner access required' });
  }
}

/**
 * Returns the store IDs the current user can access:
 * - OWNER  → all their ownedStoreIds (or override via ?storeId query param)
 * - ADMIN  → only their single storeId
 * - STAFF  → only their single storeId
 */
export function getAccessibleStoreIds(
  payload: JwtPayload,
  requestedStoreId?: string
): string[] {
  if (payload.role === 'OWNER') {
    if (requestedStoreId && payload.ownedStoreIds.includes(requestedStoreId)) {
      return [requestedStoreId];
    }
    return payload.ownedStoreIds;
  }
  return payload.storeId ? [payload.storeId] : [];
}
