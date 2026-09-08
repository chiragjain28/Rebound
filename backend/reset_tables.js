require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const result = await prisma.table.updateMany({ data: { status: 'available' } });
    console.log('Reset all tables to available:', result);
    await prisma.$disconnect();
}
main().catch(console.error);
