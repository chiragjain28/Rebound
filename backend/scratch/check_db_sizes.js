const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Counting table sizes...');
  const tables = ['staff', 'table', 'menuItem', 'session', 'order', 'payment', 'udhar', 'tableBooking', 'tablePlay'];
  for (const t of tables) {
    try {
      const count = await prisma[t].count();
      console.log(`Table ${t}: ${count} rows`);
    } catch (e) {
      console.log(`Failed to count table ${t}:`, e.message);
    }
  }
  await prisma.$disconnect();
}

main();
