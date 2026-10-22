const { Client } = require('pg');

const REMOTE_URL = 'postgresql://postgres.wkgbyztenamsplozxgoc:Rebound%402april26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

async function runAudit() {
  console.log('🔍 Connecting to Supabase for Migration Audit & Preview...');
  const remote = new Client({ connectionString: REMOTE_URL });
  await remote.connect();
  console.log('✅ Connected to Supabase!');

  // Fetch all tables from Supabase
  const staff = (await remote.query('SELECT * FROM "Staff"')).rows;
  const tables = (await remote.query('SELECT * FROM "Table"')).rows;
  const menuItems = (await remote.query('SELECT * FROM "MenuItem"')).rows;
  const customers = (await remote.query('SELECT * FROM "Customer"')).rows;
  const sessions = (await remote.query('SELECT * FROM "Session"')).rows;
  const orders = (await remote.query('SELECT * FROM "Order"')).rows;
  const payments = (await remote.query('SELECT * FROM "Payment"')).rows;
  const udhars = (await remote.query('SELECT * FROM "Udhar"')).rows;
  const tablePlays = (await remote.query('SELECT * FROM "TablePlay"')).rows;

  console.log(`\n📊 Raw Supabase Records:`);
  console.log(`  - Staff: ${staff.length}`);
  console.log(`  - Tables: ${tables.length}`);
  console.log(`  - Menu Items: ${menuItems.length}`);
  console.log(`  - Customers: ${customers.length}`);
  console.log(`  - Sessions: ${sessions.length}`);
  console.log(`  - Orders: ${orders.length}`);
  console.log(`  - Payments: ${payments.length}`);
  console.log(`  - Udhars: ${udhars.length}`);
  console.log(`  - TablePlays: ${tablePlays.length}`);

  // Build customer lookup map
  const phoneToCustomer = new Map();
  const nameToCustomer = new Map();
  const idToCustomer = new Map();

  let nextCustId = 1;
  const cleanCustomers = [];

  for (const c of customers) {
    const cleanPhone = (c.phone || '').trim();
    const cleanName = (c.name || '').trim();
    const entry = {
      id: c.id,
      firstName: c.firstName || cleanName.split(' ')[0] || 'Guest',
      lastName: c.lastName || cleanName.split(' ').slice(1).join(' ') || '',
      name: cleanName || c.firstName || 'Guest',
      phone: cleanPhone,
      createdAt: c.createdAt || new Date()
    };
    if (c.id >= nextCustId) nextCustId = c.id + 1;
    cleanCustomers.push(entry);
    idToCustomer.set(entry.id, entry);
    if (cleanPhone) phoneToCustomer.set(cleanPhone, entry);
    if (cleanName) nameToCustomer.set(cleanName.toLowerCase(), entry);
  }

  // Check sessions for any unmapped customers
  let newCustomersCreated = 0;
  for (const s of sessions) {
    const sPhone = (s.customerPhone || '').trim();
    const sName = (s.customerName || '').trim();
    if (sPhone && !phoneToCustomer.has(sPhone)) {
      const parts = sName.split(/\s+/);
      const newEntry = {
        id: nextCustId++,
        firstName: parts[0] || 'Guest',
        lastName: parts.slice(1).join(' ') || '',
        name: sName || 'Guest',
        phone: sPhone,
        createdAt: s.startTime || new Date()
      };
      cleanCustomers.push(newEntry);
      idToCustomer.set(newEntry.id, newEntry);
      phoneToCustomer.set(sPhone, newEntry);
      if (sName) nameToCustomer.set(sName.toLowerCase(), newEntry);
      newCustomersCreated++;
    }
  }

  console.log(`\n👥 Customer Normalization:`);
  console.log(`  - Existing Customer rows: ${customers.length}`);
  console.log(`  - New Customers added from sessions: ${newCustomersCreated}`);
  console.log(`  - Total Normalized Customers: ${cleanCustomers.length}`);

  // Map Sessions to Visits
  const sessionToVisit = new Map();
  let mappedVisits = 0;
  let unmappedSessions = 0;

  for (const s of sessions) {
    const sPhone = (s.customerPhone || '').trim();
    const sName = (s.customerName || '').trim();
    const cust = phoneToCustomer.get(sPhone) || nameToCustomer.get(sName.toLowerCase());

    if (!cust) {
      unmappedSessions++;
      continue;
    }

    const visit = {
      id: s.id, // Keep the exact same ID so all foreign keys from Orders and TablePlays remain 100% valid!
      customerId: cust.id,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      staffUsername: s.staffUsername || 'ayush',
      itemsTotal: s.menuCost || 0,
      tablesTotal: s.gameCost || 0,
      customAmount: s.customAmount || 0,
      visitTotal: s.totalBill || 0,
      paidAmount: 0,
      balanceDue: 0,
      paymentStatus: s.paymentStatus || 'pending'
    };

    sessionToVisit.set(s.id, visit);
    mappedVisits++;
  }

  console.log(`\n🏛️ Session -> Visit Transformation:`);
  console.log(`  - Total Sessions: ${sessions.length}`);
  console.log(`  - Successfully Mapped Visits: ${mappedVisits}`);
  console.log(`  - Unmapped Sessions: ${unmappedSessions}`);

  // Map Payments to Customer and Visit
  let paymentsMapped = 0;
  let paymentsTotalAmount = 0;
  for (const p of payments) {
    const visit = sessionToVisit.get(p.sessionId);
    let custId = visit ? visit.customerId : null;

    if (!custId) {
      // Find session to get phone/name
      const sess = sessions.find(s => s.id === p.sessionId);
      if (sess) {
        const c = phoneToCustomer.get((sess.customerPhone || '').trim()) || nameToCustomer.get((sess.customerName || '').trim().toLowerCase());
        if (c) custId = c.id;
      }
    }

    if (custId) {
      paymentsMapped++;
      paymentsTotalAmount += (p.amount || 0);
    }
  }

  console.log(`\n💳 Payments Migration:`);
  console.log(`  - Total Payments: ${payments.length}`);
  console.log(`  - Successfully Mapped Payments: ${paymentsMapped}`);
  console.log(`  - Total Payments Revenue: ₹${paymentsTotalAmount.toFixed(2)}`);

  // Map Udhars to CreditRecords
  let udharsMapped = 0;
  let unpaidCreditTotal = 0;
  let paidCreditTotal = 0;
  const unmappedUdhars = [];

  for (const u of udhars) {
    let cust = null;
    if (u.sessionId) {
      const visit = sessionToVisit.get(u.sessionId);
      if (visit) cust = idToCustomer.get(visit.customerId);
    }

    if (!cust) {
      const uName = (u.customerName || '').trim().toLowerCase();
      cust = nameToCustomer.get(uName);
    }

    if (cust) {
      udharsMapped++;
      if (u.status === 'unpaid') unpaidCreditTotal += (u.amount || 0);
      else paidCreditTotal += (u.amount || 0);
    } else {
      unmappedUdhars.push(u);
    }
  }

  console.log(`\n📒 Credit (Udhar) Reconciliation:`);
  console.log(`  - Total Udhar Records: ${udhars.length}`);
  console.log(`  - Successfully Mapped to Customers: ${udharsMapped} (${(udharsMapped / udhars.length * 100).toFixed(1)}%)`);
  console.log(`  - Unpaid Credit Mapped: ₹${unpaidCreditTotal.toFixed(2)}`);
  console.log(`  - Paid Credit Mapped: ₹${paidCreditTotal.toFixed(2)}`);
  if (unmappedUdhars.length > 0) {
    console.log(`  - Unmapped Udhars count: ${unmappedUdhars.length}`);
    console.log(`    Sample:`, unmappedUdhars.slice(0, 5));
  }

  await remote.end();
  console.log('\n✅ Supabase Audit Completed Successfully!');
}

runAudit().catch(console.error);
