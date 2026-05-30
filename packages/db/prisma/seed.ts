import { PrismaClient, Role, BottleSize, BottleStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding...');

  // ── Stores ──────────────────────────────────────────────────────────────────
  const store1 = await prisma.store.upsert({
    where: { id: 'store-mg-road' },
    update: {},
    create: {
      id: 'store-mg-road',
      name: 'MG Road Branch',
      address: '14, MG Road, Bengaluru - 560001',
      gstin: '29ABCDE1234F1Z5',
      licenseNo: 'KA-LIQ-2024-001',
    },
  });

  const store2 = await prisma.store.upsert({
    where: { id: 'store-koramangala' },
    update: {},
    create: {
      id: 'store-koramangala',
      name: 'Koramangala Branch',
      address: '36, 80 Feet Road, Koramangala, Bengaluru - 560034',
      gstin: '29ABCDE1234F1Z6',
      licenseNo: 'KA-LIQ-2024-002',
    },
  });

  const store3 = await prisma.store.upsert({
    where: { id: 'store-whitefield' },
    update: {},
    create: {
      id: 'store-whitefield',
      name: 'Whitefield Branch',
      address: '8, ITPL Main Road, Whitefield, Bengaluru - 560066',
      gstin: '29ABCDE1234F1Z7',
      licenseNo: 'KA-LIQ-2024-003',
    },
  });

  // ── Owner (boss, sees all stores) ────────────────────────────────────────────
  const ownerPin = await bcrypt.hash('0000', 10);
  const owner = await prisma.user.upsert({
    where: { employeeId: 'EMP-0001' },
    update: {},
    create: {
      employeeId: 'EMP-0001',
      name: 'Rajesh Sharma (Owner)',
      pin: ownerPin,
      role: Role.OWNER,
      storeId: null,
    },
  });

  // Link owner to all 3 stores
  for (const store of [store1, store2, store3]) {
    await prisma.storeOwner.upsert({
      where: { userId_storeId: { userId: owner.id, storeId: store.id } },
      update: {},
      create: { userId: owner.id, storeId: store.id },
    });
  }

  // ── Admins (store managers, one per store) ───────────────────────────────────
  const adminPin = await bcrypt.hash('1234', 10);

  const admin1 = await prisma.user.upsert({
    where: { employeeId: 'EMP-0011' },
    update: {},
    create: {
      employeeId: 'EMP-0011',
      name: 'Suresh Kumar (Manager)',
      pin: adminPin,
      role: Role.ADMIN,
      storeId: store1.id,
    },
  });

  const admin2 = await prisma.user.upsert({
    where: { employeeId: 'EMP-0021' },
    update: {},
    create: {
      employeeId: 'EMP-0021',
      name: 'Meena Pillai (Manager)',
      pin: adminPin,
      role: Role.ADMIN,
      storeId: store2.id,
    },
  });

  const admin3 = await prisma.user.upsert({
    where: { employeeId: 'EMP-0031' },
    update: {},
    create: {
      employeeId: 'EMP-0031',
      name: 'Arjun Nair (Manager)',
      pin: adminPin,
      role: Role.ADMIN,
      storeId: store3.id,
    },
  });

  // ── Staff (scanners, 2 per store) ────────────────────────────────────────────
  const staffPin = await bcrypt.hash('5678', 10);

  await prisma.user.upsert({
    where: { employeeId: 'EMP-0012' },
    update: {},
    create: { employeeId: 'EMP-0012', name: 'Ravi Kumar', pin: staffPin, role: Role.STAFF, storeId: store1.id },
  });
  await prisma.user.upsert({
    where: { employeeId: 'EMP-0013' },
    update: {},
    create: { employeeId: 'EMP-0013', name: 'Priya Singh', pin: await bcrypt.hash('9012', 10), role: Role.STAFF, storeId: store1.id },
  });

  await prisma.user.upsert({
    where: { employeeId: 'EMP-0022' },
    update: {},
    create: { employeeId: 'EMP-0022', name: 'Deepa Reddy', pin: staffPin, role: Role.STAFF, storeId: store2.id },
  });
  await prisma.user.upsert({
    where: { employeeId: 'EMP-0032' },
    update: {},
    create: { employeeId: 'EMP-0032', name: 'Kiran Rao', pin: staffPin, role: Role.STAFF, storeId: store3.id },
  });

  // ── Brands (shared master catalog) ──────────────────────────────────────────
  const whisky750 = await prisma.brand.upsert({
    where: { name_size: { name: 'Royal Stag', size: BottleSize.ML_750 } },
    update: {},
    create: { name: 'Royal Stag', size: BottleSize.ML_750, costPrice: 580, retailPrice: 720 },
  });
  const whisky375 = await prisma.brand.upsert({
    where: { name_size: { name: 'Royal Stag', size: BottleSize.ML_375 } },
    update: {},
    create: { name: 'Royal Stag', size: BottleSize.ML_375, costPrice: 310, retailPrice: 380 },
  });
  const vodka750 = await prisma.brand.upsert({
    where: { name_size: { name: 'Magic Moments', size: BottleSize.ML_750 } },
    update: {},
    create: { name: 'Magic Moments', size: BottleSize.ML_750, costPrice: 420, retailPrice: 530 },
  });
  const rum180 = await prisma.brand.upsert({
    where: { name_size: { name: 'Old Monk', size: BottleSize.ML_180 } },
    update: {},
    create: { name: 'Old Monk', size: BottleSize.ML_180, costPrice: 95, retailPrice: 130 },
  });

  // ── Boxes + Bottles per store ────────────────────────────────────────────────
  const storeSeeds = [
    { store: store1, prefix: 'S1' },
    { store: store2, prefix: 'S2' },
    { store: store3, prefix: 'S3' },
  ];

  for (const { store, prefix } of storeSeeds) {
    await prisma.box.create({
      data: {
        boxBarcode: `BOX-RS750-${prefix}`,
        brandId: whisky750.id,
        storeId: store.id,
        bottles: {
          create: Array.from({ length: 12 }, (_, i) => ({
            stateExciseQrString: `KA-EXC-RS750-${prefix}-${String(i + 1).padStart(4, '0')}`,
            brandId: whisky750.id,
            status: BottleStatus.ON_SHELF,
          })),
        },
      },
    });

    await prisma.box.create({
      data: {
        boxBarcode: `BOX-MM750-${prefix}`,
        brandId: vodka750.id,
        storeId: store.id,
        bottles: {
          create: Array.from({ length: 12 }, (_, i) => ({
            stateExciseQrString: `KA-EXC-MM750-${prefix}-${String(i + 1).padStart(4, '0')}`,
            brandId: vodka750.id,
            status: BottleStatus.ON_SHELF,
          })),
        },
      },
    });

    await prisma.box.create({
      data: {
        boxBarcode: `BOX-OM180-${prefix}`,
        brandId: rum180.id,
        storeId: store.id,
        bottles: {
          create: Array.from({ length: 24 }, (_, i) => ({
            stateExciseQrString: `KA-EXC-OM180-${prefix}-${String(i + 1).padStart(4, '0')}`,
            brandId: rum180.id,
            status: i < 20 ? BottleStatus.ON_SHELF : BottleStatus.SOLD,
          })),
        },
      },
    });
  }

  console.log('Stores:', store1.name, '|', store2.name, '|', store3.name);
  console.log('Owner: EMP-0001 / PIN: 0000 (all 3 stores)');
  console.log('Admins: EMP-0011/0021/0031 / PIN: 1234 (one store each)');
  console.log('Staff:  EMP-0012/0013/0022/0032 / PIN: 5678');
  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
