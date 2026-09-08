const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const tables = await prisma.table.findMany();
    console.log('Seeded tables in database:', JSON.stringify(tables, null, 2));
    await prisma.$disconnect();
}

main().catch(console.error);
