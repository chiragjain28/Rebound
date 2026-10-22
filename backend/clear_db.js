const dotenv = require('dotenv');
const path = require('path');

// Safely load local development environment
dotenv.config({ path: path.join(__dirname, '.env.local'), override: true });
dotenv.config({ path: path.join(__dirname, '.env') });

// Strict safety guard to protect Supabase production database
const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes('localhost') && !dbUrl.includes('rebound_local')) {
  console.error('\n❌ SAFETY CHECK FAILED: Attempted to run clear_db against non-local database!');
  console.error('Target URL:', dbUrl);
  console.error('Aborting immediately to protect production data.\n');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearData() {
  try {
    console.log('🧹 Clearing local database (rebound_local)...');
    console.log('Connected to:', dbUrl.split('@')[1] || dbUrl);

    // Delete in order to avoid foreign key constraint errors
    await prisma.payment.deleteMany();
    console.log('✅ Cleared Payments');

    await prisma.order.deleteMany();
    console.log('✅ Cleared Orders');

    await prisma.tablePlay.deleteMany();
    console.log('✅ Cleared Table Plays');

    await prisma.udhar.deleteMany();
    console.log('✅ Cleared Udhar');

    await prisma.tableBooking.deleteMany();
    console.log('✅ Cleared Table Bookings');

    await prisma.session.deleteMany();
    console.log('✅ Cleared Sessions');

    await prisma.customer.deleteMany();
    console.log('✅ Cleared Customers');

    // Reset floor tables to available
    await prisma.table.updateMany({
      data: { status: 'available' }
    });
    console.log('✅ Reset all Tables to available');

    // Note: Staff (chirag, ajinkya, ayush), Tables, and MenuItem catalog are preserved
    console.log('\n🎉 Local database cleared successfully! (Staff, Tables & Menu preserved)');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearData();
