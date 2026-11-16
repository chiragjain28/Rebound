const path = require('path');
const bcrypt = require(path.join(__dirname, '..', 'node_modules', 'bcryptjs'));
const { PrismaClient } = require(path.join(__dirname, '..', 'node_modules', '@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  const hashAdmin123 = await bcrypt.hash('admin123', 10);
  const hashRebound123 = await bcrypt.hash('rebound@123', 10);

  // 1. Ensure admin user exists with admin123
  await prisma.staff.upsert({
    where: { username: 'admin' },
    update: { passwordHash: hashAdmin123, name: 'Admin', role: 'owner' },
    create: { username: 'admin', passwordHash: hashAdmin123, name: 'Admin', role: 'owner' }
  });

  // 2. Ensure chirag exists with rebound@123
  await prisma.staff.upsert({
    where: { username: 'chirag' },
    update: { passwordHash: hashRebound123, name: 'Chirag', role: 'owner' },
    create: { username: 'chirag', passwordHash: hashRebound123, name: 'Chirag', role: 'owner' }
  });

  console.log('Successfully created/verified users: admin and chirag');
  const allStaff = await prisma.staff.findMany({ select: { username: true, name: true, role: true } });
  console.log('Current staff accounts:', allStaff);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
