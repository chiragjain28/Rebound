const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.table.count();
  console.log("Total tables in DB:", count);
}
main().finally(() => prisma.$disconnect());
