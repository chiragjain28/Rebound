const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const plays = await prisma.tablePlay.findMany({ include: { table: true } });
  console.log("Plays:", JSON.stringify(plays, null, 2));
}
main().finally(() => prisma.$disconnect());
