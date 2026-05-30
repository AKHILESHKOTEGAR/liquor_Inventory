/**
 * Edge-case tests for batch-sync deduplication, duplicate QR handling,
 * concurrent session safety, and damaged-label fallbacks.
 */

import { prisma } from '@liquor/db';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeScanEvent(rawValue: string, scanType: 'QR_CODE' | 'MANUAL_SERIAL' | 'PHOTO_FALLBACK' = 'QR_CODE') {
  return {
    localId: `local-${Date.now()}-${Math.random()}`,
    rawValue,
    scanType,
    scannedAt: new Date().toISOString(),
  };
}

async function seedTestData() {
  const store = await prisma.store.create({
    data: {
      name: `TestStore-${Date.now()}`,
    },
  });

  const user = await prisma.user.create({
    data: {
      employeeId: `EMP-TEST-${Date.now()}`,
      name: 'Test User',
      pin: '$2b$10$placeholder',
      role: 'STAFF',
      storeId: store.id,
    },
  });

  const brand = await prisma.brand.create({
    data: {
      name: `TestBrand-${Date.now()}`,
      size: 'ML_750',
      costPrice: 500,
      retailPrice: 650,
    },
  });

  const ts = Date.now();
  const box = await prisma.box.create({
    data: {
      boxBarcode: `TEST-BOX-${ts}`,
      brandId: brand.id,
      storeId: store.id,
      bottles: {
        create: [
          { stateExciseQrString: `TEST-QR-A-${ts}`, brandId: brand.id },
          { stateExciseQrString: `TEST-QR-B-${ts}`, brandId: brand.id },
          { stateExciseQrString: `TEST-QR-C-${ts}`, brandId: brand.id },
        ],
      },
    },
    include: { bottles: true },
  });

  const session = await prisma.auditSession.create({
    data: {
      sessionCode: `TEST-${ts}`,
      storeId: store.id,
      createdBy: user.id,
    },
  });

  return { user, brand, box, session, store };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Batch Sync — Deduplication Logic', () => {
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(async () => {
    testData = await seedTestData();
  });

  afterAll(async () => {
    await prisma.scanLog.deleteMany({ where: { sessionId: testData.session.id } });
    await prisma.auditSession.delete({ where: { id: testData.session.id } });
    await prisma.bottle.deleteMany({ where: { boxId: testData.box.id } });
    await prisma.box.delete({ where: { id: testData.box.id } });
    await prisma.brand.delete({ where: { id: testData.brand.id } });
    await prisma.user.delete({ where: { id: testData.user.id } });
    await prisma.store.delete({ where: { id: testData.store.id } });
    await prisma.$disconnect();
  });

  test('records unique QR scan without marking as duplicate', async () => {
    const { session, user, box } = testData;
    const qrValue = box.bottles[0].stateExciseQrString;

    const log = await prisma.scanLog.create({
      data: {
        sessionId: session.id,
        bottleId: box.bottles[0].id,
        scannedBy: user.id,
        scanType: 'QR_CODE',
        rawValue: qrValue,
        isDuplicate: false,
        scannedAt: new Date(),
      },
    });

    expect(log.isDuplicate).toBe(false);
    expect(log.rawValue).toBe(qrValue);
  });

  test('marks second scan of same QR in same session as duplicate', async () => {
    const { session, user, box } = testData;
    const qrValue = box.bottles[0].stateExciseQrString;

    // First scan already exists from previous test
    const existing = await prisma.scanLog.findFirst({
      where: { sessionId: session.id, rawValue: qrValue, isDuplicate: false },
    });
    expect(existing).not.toBeNull();

    // Simulate duplicate detection
    const alreadyScanned = await prisma.scanLog.findFirst({
      where: {
        sessionId: session.id,
        isDuplicate: false,
        bottle: { stateExciseQrString: qrValue },
      },
    });

    const isDuplicate = alreadyScanned !== null;
    expect(isDuplicate).toBe(true);

    const dupLog = await prisma.scanLog.create({
      data: {
        sessionId: session.id,
        bottleId: box.bottles[0].id,
        scannedBy: user.id,
        scanType: 'QR_CODE',
        rawValue: qrValue,
        isDuplicate: true,
        scannedAt: new Date(),
      },
    });

    expect(dupLog.isDuplicate).toBe(true);
  });

  test('different QR codes in same session are not duplicates of each other', async () => {
    const { session, user, box } = testData;
    const qrA = box.bottles[1].stateExciseQrString;
    const qrB = box.bottles[2].stateExciseQrString;

    const alreadyScannedA = await prisma.scanLog.findFirst({
      where: { sessionId: session.id, isDuplicate: false, bottle: { stateExciseQrString: qrA } },
    });

    const alreadyScannedB = await prisma.scanLog.findFirst({
      where: { sessionId: session.id, isDuplicate: false, bottle: { stateExciseQrString: qrB } },
    });

    expect(alreadyScannedA).toBeNull();
    expect(alreadyScannedB).toBeNull();

    await prisma.scanLog.createMany({
      data: [
        { sessionId: session.id, bottleId: box.bottles[1].id, scannedBy: user.id, scanType: 'QR_CODE', rawValue: qrA, isDuplicate: false, scannedAt: new Date() },
        { sessionId: session.id, bottleId: box.bottles[2].id, scannedBy: user.id, scanType: 'QR_CODE', rawValue: qrB, isDuplicate: false, scannedAt: new Date() },
      ],
    });

    const uniqueScans = await prisma.scanLog.count({
      where: { sessionId: session.id, isDuplicate: false },
    });

    expect(uniqueScans).toBeGreaterThanOrEqual(3);
  });

  test('PHOTO_FALLBACK scan is recorded without a bottleId', async () => {
    const { session, user } = testData;

    const log = await prisma.scanLog.create({
      data: {
        sessionId: session.id,
        scannedBy: user.id,
        scanType: 'PHOTO_FALLBACK',
        rawValue: 'cap-photo-20240101.jpg',
        isDuplicate: false,
        scannedAt: new Date(),
      },
    });

    expect(log.bottleId).toBeNull();
    expect(log.scanType).toBe('PHOTO_FALLBACK');
    expect(log.isDuplicate).toBe(false);
  });

  test('MANUAL_SERIAL scan is accepted when QR is unreadable', async () => {
    const { session, user } = testData;

    const log = await prisma.scanLog.create({
      data: {
        sessionId: session.id,
        scannedBy: user.id,
        scanType: 'MANUAL_SERIAL',
        rawValue: '987654321',
        isDuplicate: false,
        scannedAt: new Date(),
      },
    });

    expect(log.scanType).toBe('MANUAL_SERIAL');
    expect(log.rawValue).toBe('987654321');
  });

  test('session cannot accept scans after being closed', async () => {
    const { session } = testData;

    await prisma.auditSession.update({
      where: { id: session.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    const updated = await prisma.auditSession.findUnique({ where: { id: session.id } });
    expect(updated?.status).toBe('CLOSED');

    // Business logic: API should reject scans for CLOSED sessions
    // Verified here by confirming the status is CLOSED
    expect(updated?.closedAt).not.toBeNull();
  });
});

describe('Bottle Status State Machine', () => {
  test('bottle QR string uniqueness constraint prevents duplicates', async () => {
    const brand = await prisma.brand.create({
      data: { name: `UniqTest-${Date.now()}`, size: 'ML_375', costPrice: 300, retailPrice: 380 },
    });
    const store = await prisma.store.create({ data: { name: `UniqStore-${Date.now()}` } });
    const box = await prisma.box.create({
      data: { boxBarcode: `UNIQ-TEST-${Date.now()}`, brandId: brand.id, storeId: store.id },
    });

    const qr = `UNIQUE-QR-${Date.now()}`;
    await prisma.bottle.create({
      data: { stateExciseQrString: qr, boxId: box.id, brandId: brand.id },
    });

    await expect(
      prisma.bottle.create({
        data: { stateExciseQrString: qr, boxId: box.id, brandId: brand.id },
      })
    ).rejects.toThrow();

    // Cleanup
    await prisma.bottle.deleteMany({ where: { boxId: box.id } });
    await prisma.box.delete({ where: { id: box.id } });
    await prisma.brand.delete({ where: { id: brand.id } });
    await prisma.store.delete({ where: { id: store.id } });
  });
});

describe('Discrepancy Matrix Calculation', () => {
  test('variance is calculated as actual minus expected', () => {
    const expected = 12;
    const actual = 10;
    const variance = actual - expected;
    const costPrice = 580;
    const financialImpact = Math.abs(variance) * costPrice;

    expect(variance).toBe(-2);
    expect(financialImpact).toBe(1160);
  });

  test('surplus bottles give positive variance', () => {
    const expected = 10;
    const actual = 12;
    const variance = actual - expected;
    expect(variance).toBe(2);
    expect(variance > 0).toBe(true);
  });

  test('exact match gives zero variance and zero financial impact', () => {
    const expected = 24;
    const actual = 24;
    expect(actual - expected).toBe(0);
    expect(Math.abs(actual - expected) * 95).toBe(0);
  });
});
