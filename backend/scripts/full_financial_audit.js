const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const REMOTE_URL = 'postgresql://postgres.wkgbyztenamsplozxgoc:Rebound%402april26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

async function fullFinancialAudit() {
  console.log('================================================================================');
  console.log('🔍 COMMENCING COMPREHENSIVE RUPEE-FOR-RUPEE FINANCIAL AUDIT ACROSS ALL CUSTOMERS');
  console.log('================================================================================\n');

  const remote = new Client({ connectionString: REMOTE_URL });
  await remote.connect();

  // 1. Fetch raw tables
  const customers = (await remote.query('SELECT * FROM "Customer" ORDER BY id ASC')).rows;
  const sessions = (await remote.query('SELECT * FROM "Session" ORDER BY "startTime" ASC')).rows;
  const udhars = (await remote.query('SELECT * FROM "Udhar" ORDER BY "createdAt" ASC')).rows;
  const payments = (await remote.query('SELECT * FROM "Payment" ORDER BY "createdAt" ASC')).rows;
  const orders = (await remote.query('SELECT * FROM "Order" ORDER BY id ASC')).rows;
  const tablePlays = (await remote.query('SELECT * FROM "TablePlay" ORDER BY id ASC')).rows;

  console.log(`Raw Record Counts:`);
  console.log(`- Customers: ${customers.length}`);
  console.log(`- Sessions: ${sessions.length}`);
  console.log(`- Udhars: ${udhars.length}`);
  console.log(`- Payments: ${payments.length}`);
  console.log(`- Orders: ${orders.length}`);
  console.log(`- TablePlays: ${tablePlays.length}\n`);

  // Build customer lookup map
  const phoneToCustomer = new Map();
  const nameToCustomer = new Map();
  const idToCustomer = new Map();

  let nextCustId = 1;
  const normalizedCustomers = [];

  for (const c of customers) {
    const cleanPhone = (c.phone || '').trim();
    const cleanName = (c.name || '').trim();
    const parts = cleanName.split(/\s+/);
    const firstName = (c.firstName || parts[0] || 'Guest').trim();
    const lastName = (c.lastName || parts.slice(1).join(' ') || '').trim();
    const fullName = cleanName || `${firstName} ${lastName}`.trim() || 'Guest';

    const entry = {
      id: c.id,
      firstName,
      lastName,
      name: fullName,
      phone: cleanPhone,
      source: 'Customer table',
      udhars: [],
      payments: [],
      sessions: []
    };
    if (c.id >= nextCustId) nextCustId = c.id + 1;
    normalizedCustomers.push(entry);
    idToCustomer.set(entry.id, entry);
    if (cleanPhone) phoneToCustomer.set(cleanPhone, entry);
    if (fullName) nameToCustomer.set(fullName.toLowerCase(), entry);
    if (cleanName) nameToCustomer.set(cleanName.toLowerCase(), entry);
  }

  // Check sessions for any unmapped customers
  for (const s of sessions) {
    const sPhone = (s.customerPhone || '').trim();
    const sName = (s.customerName || '').trim();
    if (sPhone && !phoneToCustomer.has(sPhone)) {
      const parts = sName.split(/\s+/);
      const firstName = parts[0] || 'Guest';
      const lastName = parts.slice(1).join(' ') || '';
      const fullName = sName || 'Guest';
      const newEntry = {
        id: nextCustId++,
        firstName,
        lastName,
        name: fullName,
        phone: sPhone,
        source: 'Session discovered',
        udhars: [],
        payments: [],
        sessions: []
      };
      normalizedCustomers.push(newEntry);
      idToCustomer.set(newEntry.id, newEntry);
      phoneToCustomer.set(sPhone, newEntry);
      if (fullName) nameToCustomer.set(fullName.toLowerCase(), newEntry);
    }
  }

  // Known customer aliases to ensure 100.0% mapping
  const adityaSinger = normalizedCustomers.find(c => c.id === 14 || c.name.toLowerCase().includes('aditya sharma'));
  if (adityaSinger) {
    nameToCustomer.set('aditya sharma', adityaSinger);
  }

  // Map Sessions to Customers
  const sessionToCustomer = new Map();
  for (const s of sessions) {
    const sPhone = (s.customerPhone || '').trim();
    const sName = (s.customerName || '').trim();
    const cust = phoneToCustomer.get(sPhone) || nameToCustomer.get(sName.toLowerCase());
    if (cust) {
      sessionToCustomer.set(s.id, cust);
      cust.sessions.push(s);
    } else {
      console.warn(`⚠️ Unmapped session: ${s.id} (${sName}, ${sPhone})`);
    }
  }

  // Map Udhar records to Customers
  let totalRawUdharAmount = 0;
  let totalUnpaidRawUdharAmount = 0;
  let totalPaidRawUdharAmount = 0;

  let unmappedUdhars = [];

  for (const u of udhars) {
    const amount = Number(u.amount) || 0;
    totalRawUdharAmount += amount;
    if (u.status === 'unpaid') totalUnpaidRawUdharAmount += amount;
    else totalPaidRawUdharAmount += amount;

    let cust = null;
    if (u.sessionId) {
      cust = sessionToCustomer.get(u.sessionId);
    }
    if (!cust) {
      const uName = (u.customerName || '').trim().toLowerCase();
      cust = nameToCustomer.get(uName);
    }

    if (cust) {
      cust.udhars.push(u);
    } else {
      unmappedUdhars.push(u);
    }
  }

  // Map Payments to Customers
  let totalRawPaymentsAmount = 0;
  let unmappedPayments = [];

  for (const p of payments) {
    const amount = Number(p.amount) || 0;
    totalRawPaymentsAmount += amount;

    let cust = null;
    if (p.sessionId) {
      cust = sessionToCustomer.get(p.sessionId);
    }
    if (!cust) {
      // Find session to get phone or name
      const sess = sessions.find(s => s.id === p.sessionId);
      if (sess) {
        cust = phoneToCustomer.get((sess.customerPhone || '').trim()) || nameToCustomer.get((sess.customerName || '').trim().toLowerCase());
      }
    }

    if (cust) {
      cust.payments.push(p);
    } else {
      unmappedPayments.push(p);
    }
  }

  console.log('--------------------------------------------------------------------------------');
  console.log('💰 GRAND TOTAL FINANCIAL RECONCILIATION:');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Total Udhar Records in Supabase:   ${udhars.length}`);
  console.log(`Total Raw Udhar Sum:               ₹${totalRawUdharAmount.toFixed(2)}`);
  console.log(`- Total UNPAID Outstanding Debt:   ₹${totalUnpaidRawUdharAmount.toFixed(2)}`);
  console.log(`- Total PAID Settled Credit:       ₹${totalPaidRawUdharAmount.toFixed(2)}`);
  console.log(`Total Payments Sum:                ₹${totalRawPaymentsAmount.toFixed(2)} (${payments.length} transactions)`);
  console.log(`Unmapped Udhar count:              ${unmappedUdhars.length}`);
  console.log(`Unmapped Payments count:           ${unmappedPayments.length}`);

  // Now aggregate per customer
  const debtorSummary = [];
  let sumMappedUnpaidCredit = 0;
  let sumMappedPaidCredit = 0;

  for (const cust of normalizedCustomers) {
    let custUnpaidCredit = 0;
    let custPaidCredit = 0;
    const dateWiseDebts = {};

    for (const u of cust.udhars) {
      const amt = Number(u.amount) || 0;
      const dateStr = new Date(u.createdAt).toISOString().slice(0, 10);

      if (u.status === 'unpaid') {
        custUnpaidCredit += amt;
        if (!dateWiseDebts[dateStr]) {
          dateWiseDebts[dateStr] = { date: dateStr, count: 0, amount: 0, items: [] };
        }
        dateWiseDebts[dateStr].count += 1;
        dateWiseDebts[dateStr].amount += amt;
        dateWiseDebts[dateStr].items.push({
          id: u.id,
          amount: amt,
          notes: u.notes || 'Udhar',
          sessionId: u.sessionId,
          createdAt: u.createdAt
        });
      } else {
        custPaidCredit += amt;
      }
    }

    sumMappedUnpaidCredit += custUnpaidCredit;
    sumMappedPaidCredit += custPaidCredit;

    if (custUnpaidCredit > 0 || cust.udhars.length > 0) {
      debtorSummary.push({
        id: cust.id,
        name: cust.name,
        phone: cust.phone,
        totalUnpaidOutstanding: custUnpaidCredit,
        totalPaidCredit: custPaidCredit,
        totalUdharCount: cust.udhars.length,
        totalSessions: cust.sessions.length,
        dateWiseDebts: Object.values(dateWiseDebts).sort((a, b) => a.date.localeCompare(b.date))
      });
    }
  }

  // Sort debtors by outstanding amount descending
  debtorSummary.sort((a, b) => b.totalUnpaidOutstanding - a.totalUnpaidOutstanding);

  const activeDebtors = debtorSummary.filter(d => d.totalUnpaidOutstanding > 0);

  console.log(`\n--------------------------------------------------------------------------------`);
  console.log(`👥 CUSTOMER-BY-CUSTOMER DEBT AUDIT`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`Total Customers with historical credit records: ${debtorSummary.length}`);
  console.log(`Total Customers with ACTIVE OUTSTANDING DEBT:   ${activeDebtors.length}`);
  console.log(`Sum of all Customer Outstandings:               ₹${sumMappedUnpaidCredit.toFixed(2)}`);
  console.log(`Discrepancy / Unaccounted Rupees:               ₹${(totalUnpaidRawUdharAmount - sumMappedUnpaidCredit).toFixed(2)}`);

  console.log(`\n📋 Top 20 Debtors by Outstanding Balance:`);
  console.log(String('Name').padEnd(25) + String('Phone').padEnd(15) + String('Outstanding').padEnd(15) + String('Dates with Debt').padEnd(20));
  console.log('-'.repeat(75));

  for (const d of activeDebtors.slice(0, 20)) {
    console.log(
      d.name.padEnd(25).slice(0, 24) + ' ' +
      d.phone.padEnd(14) + ' ' +
      (`₹${d.totalUnpaidOutstanding.toFixed(2)}`).padEnd(14) + ' ' +
      `${d.dateWiseDebts.length} date(s)`
    );
  }

  // Save complete JSON report to artifact
  const report = {
    auditTimestamp: new Date().toISOString(),
    totals: {
      totalRawUdharAmount,
      totalUnpaidRawUdharAmount,
      totalPaidRawUdharAmount,
      totalRawPaymentsAmount,
      sumMappedUnpaidCredit,
      discrepancy: totalUnpaidRawUdharAmount - sumMappedUnpaidCredit,
      activeDebtorsCount: activeDebtors.length,
      totalCustomers: normalizedCustomers.length
    },
    activeDebtors
  };

  const outPath = path.join(__dirname, '../../customer_debt_audit.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Saved detailed customer-by-customer audit report to: ${outPath}`);

  await remote.end();
  console.log('✅ Audit Completed Successfully!');
}

fullFinancialAudit().catch(console.error);
