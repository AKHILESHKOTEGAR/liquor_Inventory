import { FastifyInstance } from 'fastify';
import { prisma, ScanType, SessionStatus } from '@liquor/db';
import { authenticate, getAccessibleStoreIds, JwtPayload } from '../plugins/auth';
import { batchSyncSchema, boxScanSchema } from '../validators/scan.validator';
import path from 'path';
import fs from 'fs';

export async function scanRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Resolve a box barcode → return virtualBoxId and brand info
  fastify.post('/resolve-box', async (request, reply) => {
    const result = boxScanSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Validation Error', details: result.error.flatten() });
    }

    const { sessionId, boxBarcode } = result.data;

    const jwtPayload = request.user as JwtPayload;
    const session = await prisma.auditSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== SessionStatus.ACTIVE) {
      return reply.status(409).send({ error: 'Session is not active' });
    }
    const accessible = getAccessibleStoreIds(jwtPayload);
    if (!accessible.includes(session.storeId)) {
      return reply.status(403).send({ error: 'Access denied to this session' });
    }

    const boxes = await prisma.box.findMany({
      where: { boxBarcode, storeId: session.storeId },
      include: { brand: true, _count: { select: { bottles: true } } },
    });

    if (boxes.length === 0) {
      return reply.status(404).send({ error: 'Box barcode not found in this store' });
    }

    return reply.send({ boxes });
  });

  // Batch sync — primary endpoint for mobile device uploads
  // Uses optimistic conflict handling to safely ignore duplicate QR strings
  fastify.post('/batch-sync', async (request, reply) => {
    const result = batchSyncSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Validation Error', details: result.error.flatten() });
    }

    const payload = request.user as JwtPayload;
    const { sessionId, scans } = result.data;

    const session = await prisma.auditSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== SessionStatus.ACTIVE) {
      return reply.status(409).send({ error: 'Session is not active' });
    }
    const batchAccessible = getAccessibleStoreIds(payload);
    if (!batchAccessible.includes(session.storeId)) {
      return reply.status(403).send({ error: 'Access denied to this session' });
    }

    // Reject scans timestamped before session start or more than 5 minutes in the future
    const now = Date.now();
    const sessionStart = session.startedAt.getTime();
    const futureLimit = now + 5 * 60 * 1000;
    for (const scan of scans) {
      const ts = new Date(scan.scannedAt).getTime();
      if (ts < sessionStart) {
        return reply.status(400).send({
          error: `Scan timestamp ${scan.scannedAt} is before session start. Possible clock manipulation.`,
        });
      }
      if (ts > futureLimit) {
        return reply.status(400).send({
          error: `Scan timestamp ${scan.scannedAt} is too far in the future.`,
        });
      }
    }

    // Fix 11: Validate all boxIds belong to this session's store
    const batchBoxIds = [...new Set(scans.filter((s) => s.boxId).map((s) => s.boxId!))];
    if (batchBoxIds.length > 0) {
      const foreignBoxCount = await prisma.box.count({
        where: { id: { in: batchBoxIds }, storeId: { not: session.storeId } },
      });
      if (foreignBoxCount > 0) {
        return reply.status(400).send({ error: 'One or more boxes do not belong to this store.' });
      }
    }

    // Fix 7: Cap MANUAL_SERIAL scans per session at 10 to flag potential manipulation
    const manualInBatch = scans.filter((s) => s.scanType === ScanType.MANUAL_SERIAL).length;
    if (manualInBatch > 0) {
      const existingManual = await prisma.scanLog.count({
        where: { sessionId, scanType: ScanType.MANUAL_SERIAL, isDuplicate: false },
      });
      if (existingManual + manualInBatch > 10) {
        return reply.status(400).send({
          error: `Excessive manual entry: ${existingManual} existing + ${manualInBatch} new would exceed limit of 10 per session. Contact admin.`,
        });
      }
    }

    // Collect QR strings from this batch that are QR_CODE type
    const qrScans = scans.filter((s) => s.scanType === ScanType.QR_CODE);
    const qrValues = qrScans.map((s) => s.rawValue);

    // Find existing bottles matching scanned QR strings
    const existingBottles = await prisma.bottle.findMany({
      where: { stateExciseQrString: { in: qrValues } },
      select: { id: true, stateExciseQrString: true },
    });

    const bottleMap = new Map(existingBottles.map((b) => [b.stateExciseQrString, b.id]));

    // Find which QR strings were already scanned in this session (dedup check)
    const alreadyScanned = await prisma.scanLog.findMany({
      where: {
        sessionId,
        isDuplicate: false,
        bottle: { stateExciseQrString: { in: qrValues } },
      },
      select: { bottle: { select: { stateExciseQrString: true } } },
    });

    const alreadyScannedSet = new Set(
      alreadyScanned.flatMap((l) => (l.bottle ? [l.bottle.stateExciseQrString] : []))
    );

    // Cross-session dedup: reject bottles already counted in another ACTIVE session for this store
    const crossSessionConflicts = await prisma.scanLog.findMany({
      where: {
        session: { storeId: session.storeId, status: SessionStatus.ACTIVE, id: { not: sessionId } },
        isDuplicate: false,
        bottle: { stateExciseQrString: { in: qrValues } },
      },
      select: {
        bottle: { select: { stateExciseQrString: true } },
        session: { select: { sessionCode: true } },
      },
    });

    if (crossSessionConflicts.length > 0) {
      const conflictCode = crossSessionConflicts[0].session.sessionCode;
      return reply.status(409).send({
        error: `${crossSessionConflicts.length} bottle(s) already counted in another active session (${conflictCode}). Close that session first or use a single session per audit.`,
      });
    }

    const results = {
      processed: 0,
      duplicates: 0,
      unknown: 0,
      photoFallbacks: 0,
      localIds: [] as string[],
    };

    await prisma.$transaction(async (tx) => {
      for (const scan of scans) {
        const bottleId = bottleMap.get(scan.rawValue);
        const isDuplicate = alreadyScannedSet.has(scan.rawValue);

        if (scan.scanType === ScanType.PHOTO_FALLBACK) {
          await tx.scanLog.create({
            data: {
              sessionId,
              scannedBy: payload.sub,
              scanType: ScanType.PHOTO_FALLBACK,
              rawValue: scan.rawValue,
              boxId: scan.boxId,
              isDuplicate: false,
              scannedAt: scan.scannedAt ? new Date(scan.scannedAt) : new Date(),
            },
          });
          results.photoFallbacks++;
          results.localIds.push(scan.localId);
          continue;
        }

        if (!bottleId) {
          await tx.scanLog.create({
            data: {
              sessionId,
              scannedBy: payload.sub,
              scanType: scan.scanType,
              rawValue: scan.rawValue,
              boxId: scan.boxId,
              isDuplicate: false,
              scannedAt: scan.scannedAt ? new Date(scan.scannedAt) : new Date(),
            },
          });
          results.unknown++;
          results.localIds.push(scan.localId);
          continue;
        }

        await tx.scanLog.create({
          data: {
            sessionId,
            bottleId,
            scannedBy: payload.sub,
            scanType: scan.scanType,
            rawValue: scan.rawValue,
            boxId: scan.boxId,
            isDuplicate,
            scannedAt: scan.scannedAt ? new Date(scan.scannedAt) : new Date(),
          },
        });

        if (isDuplicate) {
          results.duplicates++;
        } else {
          results.processed++;
          alreadyScannedSet.add(scan.rawValue);
        }

        results.localIds.push(scan.localId);
      }
    });

    return reply.send({ success: true, results });
  });

  // Upload photo for damaged/unreadable cap
  fastify.post('/upload-photo', async (request, reply) => {
    const payload = request.user as JwtPayload;
    const parts = request.parts();

    let sessionId: string | undefined;
    let boxId: string | undefined;
    let filePath: string | undefined;

    for await (const part of parts) {
      if (part.type === 'field') {
        if (part.fieldname === 'sessionId') sessionId = part.value as string;
        if (part.fieldname === 'boxId') boxId = part.value as string;
      } else if (part.type === 'file') {
        const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
        const filename = `cap-${Date.now()}-${part.filename}`;
        filePath = path.join(uploadDir, filename);
        const ws = fs.createWriteStream(filePath);
        await new Promise<void>((resolve, reject) => {
          part.file.pipe(ws);
          part.file.on('end', resolve);
          part.file.on('error', reject);
        });
      }
    }

    if (!sessionId || !filePath) {
      return reply.status(400).send({ error: 'sessionId and photo file required' });
    }

    const photoRef = path.basename(filePath);

    const log = await prisma.scanLog.create({
      data: {
        sessionId,
        scannedBy: payload.sub,
        scanType: ScanType.PHOTO_FALLBACK,
        rawValue: photoRef,
        boxId: boxId ?? undefined,
        isDuplicate: false,
        scannedAt: new Date(),
      },
    });

    return reply.send({ success: true, logId: log.id, photoRef });
  });
}
