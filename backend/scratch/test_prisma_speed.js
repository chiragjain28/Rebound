const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- TEST 1: Warm-up active sessions (No Join) ---');
  let start = Date.now();
  await prisma.session.findMany({
    where: { status: 'active' },
    include: {
      table: true,
      orders: { include: { menuItem: true } },
      payments: true,
      tablePlays: { include: { table: true } }
    }
  });
  console.log(`Warm-up Query took: ${Date.now() - start}ms`);

  console.log('--- TEST 2: Active sessions WITH RELATION JOIN ---');
  start = Date.now();
  await prisma.session.findMany({
    relationLoadStrategy: 'join',
    where: { status: 'active' },
    include: {
      table: true,
      orders: { include: { menuItem: true } },
      payments: true,
      tablePlays: { include: { table: true } }
    }
  });
  console.log(`Optimized Join Query took: ${Date.now() - start}ms`);

  console.log('--- TEST 3: Completed sessions WITH RELATION JOIN ---');
  start = Date.now();
  await prisma.session.findMany({
    relationLoadStrategy: 'join',
    where: { status: 'completed' },
    orderBy: { endTime: 'desc' },
    take: 10,
    include: {
      table: true,
      orders: { include: { menuItem: true } },
      payments: true,
      tablePlays: { include: { table: true } }
    }
  });
  console.log(`Completed Session Join Query took: ${Date.now() - start}ms`);

  await prisma.$disconnect();
}

run();
