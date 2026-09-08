const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearData() {
  try {
    console.log('Clearing database...');
    // Delete in order to avoid foreign key constraint errors
    await prisma.payment.deleteMany();
    console.log('Cleared Payments');
    await prisma.order.deleteMany();
    console.log('Cleared Orders');
    await prisma.tablePlay.deleteMany();
    console.log('Cleared Table Plays');
    await prisma.udhar.deleteMany();
    console.log('Cleared Udhar');
    await prisma.tableBooking.deleteMany();
    console.log('Cleared Table Bookings');
    await prisma.session.deleteMany();
    console.log('Cleared Sessions');
    await prisma.menuItem.deleteMany();
    console.log('Cleared Menu Items');
    await prisma.table.deleteMany();
    console.log('Cleared Tables');
    
    // We intentionally leave the Staff table alone so you don't lose your login!
    console.log('All dummy data cleared successfully! (Staff accounts preserved)');
  } catch (error) {
    console.error('Error clearing data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearData();
