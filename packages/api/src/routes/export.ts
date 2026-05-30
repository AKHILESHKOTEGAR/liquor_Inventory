import { FastifyInstance } from 'fastify';
import { prisma, ScanType } from '@liquor/db';
import { requireAdmin, getAccessibleStoreIds, JwtPayload } from '../plugins/auth';
import PDFDocument from 'pdfkit';

const BRAND_COLORS = {
  header: '#1e293b',
  subheader: '#334155',
  accent: '#3b82f6',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  lightGray: '#f8fafc',
  borderGray: '#e2e8f0',
};

export async function exportRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAdmin);

  fastify.get('/:sessionId/pdf', async (request, reply) => {
    const jwtPayload = request.user as JwtPayload;
    const { sessionId } = request.params as { sessionId: string };

    const session = await prisma.auditSession.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { employeeId: true, name: true } },
        store: { select: { id: true, name: true } },
        scanLogs: {
          include: {
            user: { select: { employeeId: true, name: true } },
            bottle: { include: { brand: true, box: true } },
          },
          orderBy: { scannedAt: 'asc' },
        },
      },
    });

    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const accessible = getAccessibleStoreIds(jwtPayload);
    if (!accessible.includes(session.storeId)) {
      return reply.status(403).send({ error: 'Access denied to this session' });
    }

    // Build discrepancy matrix scoped to this store
    const brands = await prisma.brand.findMany({
      where: { isActive: true },
      include: {
        bottles: {
          where: {
            status: { in: ['INWARDED', 'ON_SHELF'] },
            box: { storeId: session.storeId },
          },
          select: { id: true },
        },
      },
      orderBy: [{ name: 'asc' }, { size: 'asc' }],
    });

    const uniqueLogs = session.scanLogs.filter((l) => !l.isDuplicate);
    const scannedBottleIds = new Set(uniqueLogs.map((l) => l.bottleId).filter(Boolean) as string[]);

    const scannedBottles = await prisma.bottle.findMany({
      where: { id: { in: [...scannedBottleIds] } },
      select: { brandId: true },
    });

    const scannedCountPerBrand: Record<string, number> = {};
    for (const b of scannedBottles) {
      scannedCountPerBrand[b.brandId] = (scannedCountPerBrand[b.brandId] ?? 0) + 1;
    }

    const matrix = brands.map((brand) => {
      const expected = brand.bottles.length;
      const actual = scannedCountPerBrand[brand.id] ?? 0;
      const variance = actual - expected;
      return {
        name: `${brand.name} (${brand.size.replace('ML_', '')}ml)`,
        expected,
        actual,
        variance,
        financialImpact: Math.abs(variance) * Number(brand.costPrice),
      };
    });

    const totalFinancialImpact = matrix.reduce((s, r) => s + r.financialImpact, 0);
    const workers = [...new Set(session.scanLogs.map((l) => `${l.user.name} (${l.user.employeeId})`))];

    // Worker audit trail
    const workerTrail: Record<string, { scans: number; duplicates: number; photos: number }> = {};
    for (const log of session.scanLogs) {
      const key = log.user.employeeId;
      if (!workerTrail[key]) workerTrail[key] = { scans: 0, duplicates: 0, photos: 0 };
      if (log.isDuplicate) workerTrail[key].duplicates++;
      else if (log.scanType === ScanType.PHOTO_FALLBACK) workerTrail[key].photos++;
      else workerTrail[key].scans++;
    }

    // Generate PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Audit Report ${session.sessionCode}`, Author: 'LiquorSafe System', Creator: 'LiquorSafe' } });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // ── Header ──
    doc.rect(0, 0, doc.page.width, 80).fill(BRAND_COLORS.header);
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold').text('LIQUORSAFE', 50, 20);
    doc.fontSize(10).font('Helvetica').text('Blind Inventory Audit — Compliance Report', 50, 46);
    doc.fillColor(BRAND_COLORS.accent).fontSize(10).text(`Generated: ${new Date().toLocaleString('en-IN')}`, 350, 46, { align: 'right', width: 200 });

    doc.moveDown(3);

    // ── Session Metadata ──
    doc.fillColor(BRAND_COLORS.header).fontSize(13).font('Helvetica-Bold').text('SESSION DETAILS', 50, doc.y);
    doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).strokeColor(BRAND_COLORS.accent).lineWidth(2).stroke();
    doc.moveDown(0.8);

    const meta = [
      ['Session ID', session.sessionCode],
      ['Status', session.status],
      ['Started', session.startedAt.toLocaleString('en-IN')],
      ['Closed', session.closedAt ? session.closedAt.toLocaleString('en-IN') : 'ACTIVE'],
      ['Store', session.store.name],
      ['Created By', `${session.user.name} (${session.user.employeeId})`],
      ['Workers', workers.join(', ')],
      ['Total Scans', session.scanLogs.length.toString()],
      ['Unique Bottles', uniqueLogs.length.toString()],
      ['Duplicate Attempts', session.scanLogs.filter((l) => l.isDuplicate).length.toString()],
    ];

    doc.fillColor(BRAND_COLORS.subheader).fontSize(10).font('Helvetica');
    for (const [label, value] of meta) {
      doc.text(`${label}:`, 55, doc.y, { continued: true, width: 160 });
      doc.font('Helvetica-Bold').text(` ${value}`, { width: 340 }).font('Helvetica');
    }

    doc.moveDown(1.5);

    // ── Discrepancy Matrix ──
    doc.fillColor(BRAND_COLORS.header).fontSize(13).font('Helvetica-Bold').text('DISCREPANCY MATRIX', 50, doc.y);
    doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).strokeColor(BRAND_COLORS.accent).lineWidth(2).stroke();
    doc.moveDown(0.8);

    const tableTop = doc.y;
    const colWidths = [160, 70, 70, 70, 110];
    const cols = [50, 210, 280, 350, 420];
    const headers = ['Brand / Size', 'Expected', 'Actual', 'Variance', 'Financial Impact (₹)'];

    // Table header
    doc.rect(50, tableTop, 495, 20).fill(BRAND_COLORS.subheader);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    headers.forEach((h, i) => doc.text(h, cols[i], tableTop + 5, { width: colWidths[i], align: i > 0 ? 'right' : 'left' }));

    let rowY = tableTop + 22;
    doc.fontSize(9).font('Helvetica');

    for (const row of matrix) {
      const rowBg = row.variance < 0 ? '#fef2f2' : row.variance > 0 ? '#f0fdf4' : 'white';
      doc.rect(50, rowY, 495, 18).fill(rowBg);

      doc.fillColor(BRAND_COLORS.subheader).text(row.name, cols[0], rowY + 4, { width: colWidths[0] });
      doc.text(row.expected.toString(), cols[1], rowY + 4, { width: colWidths[1], align: 'right' });
      doc.text(row.actual.toString(), cols[2], rowY + 4, { width: colWidths[2], align: 'right' });

      const varianceColor = row.variance < 0 ? BRAND_COLORS.danger : row.variance > 0 ? BRAND_COLORS.success : BRAND_COLORS.subheader;
      doc.fillColor(varianceColor).text(`${row.variance > 0 ? '+' : ''}${row.variance}`, cols[3], rowY + 4, { width: colWidths[3], align: 'right' });

      doc.fillColor(row.financialImpact > 0 ? BRAND_COLORS.danger : BRAND_COLORS.subheader)
        .text(`₹${row.financialImpact.toFixed(2)}`, cols[4], rowY + 4, { width: colWidths[4], align: 'right' });

      rowY += 18;
      if (rowY > doc.page.height - 100) {
        doc.addPage();
        rowY = 50;
      }
    }

    // Total row
    doc.rect(50, rowY, 495, 20).fill(BRAND_COLORS.header);
    doc.fillColor('white').font('Helvetica-Bold')
      .text('TOTAL FINANCIAL IMPACT', cols[0], rowY + 5, { width: 360 })
      .text(`₹${totalFinancialImpact.toFixed(2)}`, cols[4], rowY + 5, { width: colWidths[4], align: 'right' });

    doc.moveDown(2);

    // ── Worker Audit Trail ──
    doc.addPage();
    doc.fillColor(BRAND_COLORS.header).fontSize(13).font('Helvetica-Bold').text('WORKER AUDIT TRAIL', 50, 50);
    doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).strokeColor(BRAND_COLORS.accent).lineWidth(2).stroke();
    doc.moveDown(0.8);

    const trailHeaders = ['Employee', 'Unique Scans', 'Duplicates', 'Photo Fallbacks'];
    const trailCols = [50, 220, 330, 430];
    const trailWidths = [170, 110, 100, 115];

    const trailTop = doc.y;
    doc.rect(50, trailTop, 495, 20).fill(BRAND_COLORS.subheader);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    trailHeaders.forEach((h, i) => doc.text(h, trailCols[i], trailTop + 5, { width: trailWidths[i], align: i > 0 ? 'right' : 'left' }));

    let trailY = trailTop + 22;
    doc.fontSize(9).font('Helvetica').fillColor(BRAND_COLORS.subheader);

    for (const [empId, stats] of Object.entries(workerTrail)) {
      const workerName = session.scanLogs.find((l) => l.user.employeeId === empId)?.user.name ?? empId;
      doc.rect(50, trailY, 495, 18).fill(trailY % 36 === 0 ? BRAND_COLORS.lightGray : 'white');
      doc.fillColor(BRAND_COLORS.subheader);
      doc.text(`${workerName} (${empId})`, trailCols[0], trailY + 4, { width: trailWidths[0] });
      doc.text(stats.scans.toString(), trailCols[1], trailY + 4, { width: trailWidths[1], align: 'right' });
      doc.text(stats.duplicates.toString(), trailCols[2], trailY + 4, { width: trailWidths[2], align: 'right' });
      doc.text(stats.photos.toString(), trailCols[3], trailY + 4, { width: trailWidths[3], align: 'right' });
      trailY += 18;
    }

    // ── Footer ──
    doc.fontSize(8).fillColor('#94a3b8')
      .text(
        `This is a system-generated compliance document. Session: ${session.sessionCode} | Report ID: ${Date.now()}`,
        50,
        doc.page.height - 40,
        { align: 'center', width: 495 }
      );

    doc.end();

    await new Promise<void>((resolve) => doc.on('end', resolve));
    const pdfBuffer = Buffer.concat(chunks);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="audit-${session.sessionCode}.pdf"`);
    reply.header('Content-Length', pdfBuffer.length);
    reply.header('Cache-Control', 'no-store');
    return reply.send(pdfBuffer);
  });

  // Monthly collection report PDF — manager sends this to boss
  fastify.get('/monthly', async (request, reply) => {
    const payload = request.user as JwtPayload;
    const { year, month, storeId: requestedStore } = request.query as Record<string, string>;

    const accessible = getAccessibleStoreIds(payload, requestedStore);
    if (accessible.length === 0) return reply.status(403).send({ error: 'No store access' });

    const now = new Date();
    const y = parseInt(year ?? String(now.getFullYear()));
    const m = parseInt(month ?? String(now.getMonth() + 1)); // 1-based
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 1);

    const store = await prisma.store.findFirst({ where: { id: { in: accessible } } });

    // All closed sessions in the period for these stores
    const sessions = await prisma.auditSession.findMany({
      where: {
        storeId: { in: accessible },
        startedAt: { gte: from, lt: to },
      },
      include: {
        user: { select: { employeeId: true, name: true } },
        _count: { select: { scanLogs: true } },
      },
      orderBy: { startedAt: 'asc' },
    });

    // Brand-level collection totals
    const brandTotals = await prisma.scanLog.groupBy({
      by: ['bottleId'],
      where: {
        session: { storeId: { in: accessible }, startedAt: { gte: from, lt: to } },
        isDuplicate: false,
        scanType: 'QR_CODE',
        bottleId: { not: null },
      },
      _count: { id: true },
    });

    const bottleIds = brandTotals.map((b) => b.bottleId!).filter(Boolean);
    const bottles = await prisma.bottle.findMany({
      where: { id: { in: bottleIds } },
      include: { brand: true },
    });
    const bottleMap = new Map(bottles.map((b) => [b.id, b]));

    // Aggregate by brand
    const brandMap = new Map<string, { name: string; size: string; count: number }>();
    for (const row of brandTotals) {
      const bottle = bottleMap.get(row.bottleId!);
      if (!bottle) continue;
      const key = bottle.brandId;
      const existing = brandMap.get(key);
      brandMap.set(key, {
        name: bottle.brand.name,
        size: bottle.brand.size,
        count: (existing?.count ?? 0) + row._count.id,
      });
    }
    const brandRows = [...brandMap.values()].sort((a, b) => b.count - a.count);

    // Worker activity
    const workerMap = new Map<string, { name: string; employeeId: string; sessions: number; scans: number }>();
    for (const s of sessions) {
      const key = s.createdBy;
      const existing = workerMap.get(key);
      workerMap.set(key, {
        name: s.user.name,
        employeeId: s.user.employeeId,
        sessions: (existing?.sessions ?? 0) + 1,
        scans: (existing?.scans ?? 0) + s._count.scanLogs,
      });
    }
    const workerRows = [...workerMap.values()];

    const totalScans = sessions.reduce((a, s) => a + s._count.scanLogs, 0);
    const monthName = from.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    // Build PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));

    // Title block
    doc.fillColor('#0f172a').fontSize(22).font('Helvetica-Bold')
      .text('LiquorSafe', 50, 50);
    doc.fillColor('#475569').fontSize(11).font('Helvetica')
      .text('Monthly Collection Report', 50, 76);

    doc.moveTo(50, 96).lineTo(545, 96).strokeColor('#e2e8f0').lineWidth(1).stroke();

    doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold')
      .text(`${store?.name ?? 'All Stores'} — ${monthName}`, 50, 110);

    doc.fillColor('#64748b').fontSize(10).font('Helvetica')
      .text(`Total sessions: ${sessions.length}   ·   Total scans: ${totalScans}`, 50, 130);

    // Brand collection table
    let py = 160;
    doc.fillColor('#1e293b').fontSize(12).font('Helvetica-Bold').text('Brand-wise Collection', 50, py);
    py += 20;

    // Table header
    doc.fillColor('#f8fafc').rect(50, py, 495, 22).fill();
    doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold')
      .text('BRAND', 58, py + 7)
      .text('SIZE', 280, py + 7)
      .text('BOTTLES COUNTED', 390, py + 7);
    py += 22;

    if (brandRows.length === 0) {
      doc.fillColor('#94a3b8').fontSize(10).font('Helvetica').text('No bottle scans recorded this month.', 58, py + 8);
      py += 30;
    } else {
      for (const [i, row] of brandRows.entries()) {
        if (i % 2 === 0) doc.fillColor('#f8fafc').rect(50, py, 495, 20).fill();
        doc.fillColor('#1e293b').fontSize(10).font('Helvetica')
          .text(row.name, 58, py + 5, { width: 210 })
          .text(row.size, 280, py + 5)
          .text(String(row.count), 430, py + 5);
        py += 20;
        if (py > 720) { doc.addPage(); py = 60; }
      }
    }

    py += 20;
    doc.fillColor('#1e293b').fontSize(12).font('Helvetica-Bold').text('Worker Activity', 50, py);
    py += 20;

    doc.fillColor('#f8fafc').rect(50, py, 495, 22).fill();
    doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold')
      .text('WORKER', 58, py + 7)
      .text('EMP ID', 250, py + 7)
      .text('SESSIONS', 340, py + 7)
      .text('SCANS', 440, py + 7);
    py += 22;

    for (const [i, row] of workerRows.entries()) {
      if (i % 2 === 0) doc.fillColor('#f8fafc').rect(50, py, 495, 20).fill();
      doc.fillColor('#1e293b').fontSize(10).font('Helvetica')
        .text(row.name, 58, py + 5, { width: 180 })
        .text(row.employeeId, 250, py + 5)
        .text(String(row.sessions), 355, py + 5)
        .text(String(row.scans), 450, py + 5);
      py += 20;
      if (py > 720) { doc.addPage(); py = 60; }
    }

    py += 30;
    doc.fillColor('#64748b').fontSize(9).font('Helvetica')
      .text(`Generated: ${new Date().toLocaleString('en-IN')} · Prepared by: ${payload.name}`, 50, py);

    doc.end();
    await new Promise<void>((resolve) => doc.on('end', resolve));
    const pdfBuffer = Buffer.concat(chunks);

    const filename = `collection-${store?.name?.replace(/\s+/g, '-') ?? 'store'}-${year ?? now.getFullYear()}-${month ?? (now.getMonth() + 1)}.pdf`;
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.header('Content-Length', pdfBuffer.length);
    reply.header('Cache-Control', 'no-store');
    return reply.send(pdfBuffer);
  });
}
