const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tables = await prisma.table.findMany();
  console.log("DB Tables:", tables);
}
main().finally(() => prisma.$disconnect());
