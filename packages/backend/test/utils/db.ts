import { PrismaClient } from '@prisma/client';

import { SEED_USERS, seedPasswordHash } from '../../prisma/seed-data';

/**
 * The e2e suite now runs against a real, persistent Postgres database
 * (warehouse_hq_test — see package.json's test:e2e script, which loads
 * .env.test via dotenv-cli) instead of a fresh in-memory store per test.
 * Every spec file's `beforeEach` used to get an empty store for free;
 * now it must be reset+reseeded explicitly, or state from one test
 * leaks into the next (e.g. a test that removes the seed admin would
 * break every subsequent test's `loginAs('admin@warehousehq.dev')`).
 *
 * One PrismaClient shared across a whole spec file (not one per test)
 * to avoid opening/closing a DB connection for every single `it()`.
 */
const prisma = new PrismaClient();

export async function resetDatabase(): Promise<void> {
  // Order matters only in that none of these models have DB-level FK
  // constraints between them (see schema.prisma's comment on why) — so
  // any order works, but deleting "leaf" data before Users keeps intent
  // readable.
  await prisma.orderPrepTask.deleteMany();
  await prisma.orderPrepSession.deleteMany();
  await prisma.putAwayTask.deleteMany();
  await prisma.sellerStockPallet.deleteMany();
  await prisma.reception.deleteMany();
  await prisma.break.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = seedPasswordHash();
  for (const user of SEED_USERS) {
    await prisma.user.create({ data: { ...user, passwordHash } });
  }

  // Reset the pallet human-index sequence too, so palletIndex assertions
  // (if any test ever adds one) stay predictable across runs.
  await prisma.$executeRawUnsafe('ALTER SEQUENCE "SellerStockPallet_seq_seq" RESTART WITH 1');
}

export async function closeTestDb(): Promise<void> {
  await prisma.$disconnect();
}
