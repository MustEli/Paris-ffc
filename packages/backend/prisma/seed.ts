import { PrismaClient } from '@prisma/client';

import { SEED_USERS, seedPasswordHash } from './seed-data';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = seedPasswordHash();
  for (const user of SEED_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, passwordHash },
    });
  }
  console.log(`Seeded ${SEED_USERS.length} dev accounts (password: see seed-data.ts).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
