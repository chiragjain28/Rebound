const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const credits = await prisma.creditRecord.findMany({ include: { customer: true } });
  console.log('Total credit records:', credits.length);

  const months = {};
  credits.forEach(c => {
    const d = new Date(c.createdAt);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months[m]) months[m] = { count: 0, amount: 0, settled: 0, due: 0, customers: new Set() };
    months[m].count++;
    months[m].amount += c.amount;
    months[m].settled += c.settledAmount;
    if (c.status === 'unpaid') {
      months[m].due += (c.amount - c.settledAmount);
    }
    if (c.customerId) months[m].customers.add(c.customerId);
  });

  const formatted = Object.keys(months).sort().reverse().map(m => ({
    month: m,
    count: months[m].count,
    amount: months[m].amount,
    settled: months[m].settled,
    due: months[m].due,
    debtorsCount: months[m].customers.size
  }));
  console.log('Monthly summary:', formatted);

  const debtors = await prisma.customer.findMany({
    where: { currentCreditDue: { gt: 0 } },
    orderBy: { currentCreditDue: 'desc' }
  });
  console.log('Active debtors count:', debtors.length);
  debtors.slice(0, 5).forEach((d, i) => console.log(`  #${i+1} ${d.name} (${d.phone}): ₹${d.currentCreditDue}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
