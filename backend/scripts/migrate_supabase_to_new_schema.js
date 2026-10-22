const { Client } = require('pg');

const REMOTE_URL = process.env.SOURCE_DB_URL || 'postgresql://postgres.wkgbyztenamsplozxgoc:Rebound%402april26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';
const TARGET_URL = process.env.TARGET_DB_URL || 'postgresql://vanshikabhujang@localhost:5432/rebound_local';

async function migrateData() {
  console.log('🚀 Starting Zero-Loss Migration from Supabase to New Schema...');
  console.log(`  Source: ${REMOTE_URL.split('@')[1]}`);
  console.log(`  Target: ${TARGET_URL.split('@')[1]}`);

  const remote = new Client({ connectionString: REMOTE_URL });
  const target = new Client({ connectionString: TARGET_URL });

  await remote.connect();
  await target.connect();
  console.log('✅ Connected to both Source and Target databases!\n');

  try {
    // 1. Fetch all records from Remote
    console.log('📥 Fetching all data from Supabase...');
    const staff = (await remote.query('SELECT * FROM "Staff" ORDER BY id ASC')).rows;
    const tables = (await remote.query('SELECT * FROM "Table" ORDER BY id ASC')).rows;
    const menuItems = (await remote.query('SELECT * FROM "MenuItem" ORDER BY id ASC')).rows;
    const tableBookings = (await remote.query('SELECT * FROM "TableBooking" ORDER BY id ASC')).rows;
    const customers = (await remote.query('SELECT * FROM "Customer" ORDER BY id ASC')).rows;
    const sessions = (await remote.query('SELECT * FROM "Session" ORDER BY "startTime" ASC')).rows;
    const orders = (await remote.query('SELECT * FROM "Order" ORDER BY id ASC')).rows;
    const payments = (await remote.query('SELECT * FROM "Payment" ORDER BY id ASC')).rows;
    const udhars = (await remote.query('SELECT * FROM "Udhar" ORDER BY id ASC')).rows;
    const tablePlays = (await remote.query('SELECT * FROM "TablePlay" ORDER BY id ASC')).rows;

    console.log(`  - Staff: ${staff.length}`);
    console.log(`  - Tables: ${tables.length}`);
    console.log(`  - Menu Items: ${menuItems.length}`);
    console.log(`  - Table Bookings: ${tableBookings.length}`);
    console.log(`  - Customers: ${customers.length}`);
    console.log(`  - Sessions: ${sessions.length}`);
    console.log(`  - Orders: ${orders.length}`);
    console.log(`  - Payments: ${payments.length}`);
    console.log(`  - Udhars: ${udhars.length}`);
    console.log(`  - TablePlays: ${tablePlays.length}\n`);

    // 2. Build Customer mapping
    const phoneToCustomer = new Map();
    const nameToCustomer = new Map();
    const idToCustomer = new Map();

    let nextCustId = 1;
    const cleanCustomers = [];

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
        currentCreditDue: 0,
        lifetimeSpend: 0,
        lifetimePaid: 0,
        totalVisits: 0,
        createdAt: c.createdAt || new Date(),
        updatedAt: c.updatedAt || new Date()
      };

      if (c.id >= nextCustId) nextCustId = c.id + 1;
      cleanCustomers.push(entry);
      idToCustomer.set(entry.id, entry);
      if (cleanPhone) phoneToCustomer.set(cleanPhone, entry);
      if (fullName) nameToCustomer.set(fullName.toLowerCase(), entry);
    }

    // Check sessions for any customer not yet registered
    let newCustomersAdded = 0;
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
          currentCreditDue: 0,
          lifetimeSpend: 0,
          lifetimePaid: 0,
          totalVisits: 0,
          createdAt: s.startTime || new Date(),
          updatedAt: s.startTime || new Date()
        };
        cleanCustomers.push(newEntry);
        idToCustomer.set(newEntry.id, newEntry);
        phoneToCustomer.set(sPhone, newEntry);
        if (fullName) nameToCustomer.set(fullName.toLowerCase(), newEntry);
        newCustomersAdded++;
      }
    }

    // Special alias: 'Aditya Sharma' -> id 14 ('Aditya Sharma Singer')
    const adityaSinger = cleanCustomers.find(c => c.id === 14 || c.name.toLowerCase().includes('aditya sharma'));
    if (adityaSinger) {
      nameToCustomer.set('aditya sharma', adityaSinger);
    }

    console.log(`👥 Normalized Customers: ${cleanCustomers.length} (${newCustomersAdded} discovered from sessions)`);

    // 3. Clear Target DB inside transaction
    console.log('🧹 Clearing target tables...');
    await target.query('BEGIN');

    await target.query('TRUNCATE TABLE "CreditRecord", "Payment", "Order", "TablePlay", "TableBooking", "Visit", "MenuItem", "Table", "Customer", "Staff" CASCADE');

    // 4. Insert Staff
    console.log('👤 Inserting Staff...');
    for (const s of staff) {
      await target.query(
        'INSERT INTO "Staff" (id, username, "passwordHash", name, role) VALUES ($1, $2, $3, $4, $5)',
        [s.id, s.username, s.passwordHash, s.name, s.role]
      );
    }

    // 5. Insert Tables
    console.log('🎱 Inserting Tables...');
    for (const t of tables) {
      await target.query(
        'INSERT INTO "Table" (id, number, "gameType", status) VALUES ($1, $2, $3, $4)',
        [t.id, t.number, t.gameType, t.status]
      );
    }

    // 6. Insert Menu Items
    console.log('🍔 Inserting Menu Items...');
    for (const m of menuItems) {
      await target.query(
        'INSERT INTO "MenuItem" (id, name, price, category) VALUES ($1, $2, $3, $4)',
        [m.id, m.name, m.price, m.category]
      );
    }

    // 7. Insert Customers
    console.log('👥 Inserting Customers...');
    for (const c of cleanCustomers) {
      await target.query(
        'INSERT INTO "Customer" (id, "firstName", "lastName", name, phone, "currentCreditDue", "lifetimeSpend", "lifetimePaid", "totalVisits", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [c.id, c.firstName, c.lastName, c.name, c.phone, 0, 0, 0, 0, c.createdAt, c.updatedAt]
      );
    }

    // 8. Transform and Insert Visits
    console.log('🏛️ Migrating Sessions to Visits...');
    const sessionToVisitMap = new Map();

    for (const s of sessions) {
      const sPhone = (s.customerPhone || '').trim();
      const sName = (s.customerName || '').trim();
      const cust = phoneToCustomer.get(sPhone) || nameToCustomer.get(sName.toLowerCase());

      if (!cust) {
        throw new Error(`Unmapped session customer: ${s.customerName} (${s.customerPhone}) on session ${s.id}`);
      }

      // Check staffUsername exists
      let staffUser = s.staffUsername || 'ayush';
      if (!staff.some(st => st.username === staffUser)) {
        staffUser = staff[0]?.username || 'ayush';
      }

      const itemsTotal = Number(s.menuCost) || 0;
      const tablesTotal = Number(s.gameCost) || 0;
      const customAmount = Number(s.customAmount) || 0;
      const visitTotal = Number(s.totalBill) || (itemsTotal + tablesTotal + customAmount);

      const visit = {
        id: s.id,
        customerId: cust.id,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        staffUsername: staffUser,
        itemsTotal,
        tablesTotal,
        customAmount,
        visitTotal,
        paidAmount: 0,
        balanceDue: visitTotal,
        paymentStatus: s.paymentStatus || 'pending'
      };

      sessionToVisitMap.set(s.id, visit);

      await target.query(
        `INSERT INTO "Visit" (id, "customerId", "startTime", "endTime", status, "staffUsername", "itemsTotal", "tablesTotal", "customAmount", "visitTotal", "paidAmount", "balanceDue", "paymentStatus")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [visit.id, visit.customerId, visit.startTime, visit.endTime, visit.status, visit.staffUsername, visit.itemsTotal, visit.tablesTotal, visit.customAmount, visit.visitTotal, visit.paidAmount, visit.balanceDue, visit.paymentStatus]
      );
    }

    // 9. Insert TablePlays
    console.log('⏱️ Migrating TablePlays...');
    for (const tp of tablePlays) {
      let createdBy = tp.createdBy || 'ayush';
      if (!staff.some(st => st.username === createdBy)) {
        createdBy = staff[0]?.username || 'ayush';
      }

      await target.query(
        `INSERT INTO "TablePlay" (id, "visitId", "tableId", "gameType", "playerCount", "startTime", "endTime", cost, "createdBy")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [tp.id, tp.sessionId, tp.tableId, tp.gameType, tp.playerCount || 1, tp.startTime, tp.endTime, Number(tp.cost) || 0, createdBy]
      );
    }

    // 10. Insert Orders
    console.log('📦 Migrating Orders...');
    for (const o of orders) {
      await target.query(
        `INSERT INTO "Order" (id, "visitId", "menuItemId", quantity, price, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [o.id, o.sessionId, o.menuItemId, o.quantity, Number(o.price) || 0, o.createdAt]
      );
    }

    // 11. Insert Payments
    console.log('💳 Migrating Payments...');
    const visitPaymentsSum = new Map();

    for (const p of payments) {
      const visit = sessionToVisitMap.get(p.sessionId);
      let custId = visit ? visit.customerId : null;

      if (!custId) {
        const sess = sessions.find(s => s.id === p.sessionId);
        if (sess) {
          const c = phoneToCustomer.get((sess.customerPhone || '').trim()) || nameToCustomer.get((sess.customerName || '').trim().toLowerCase());
          if (c) custId = c.id;
        }
      }

      if (!custId) {
        throw new Error(`Payment ${p.id} has no resolvable customer! Session: ${p.sessionId}`);
      }

      const pAmount = Number(p.amount) || 0;
      const visitId = visit ? p.sessionId : null;
      if (visitId) {
        visitPaymentsSum.set(visitId, (visitPaymentsSum.get(visitId) || 0) + pAmount);
      }

      await target.query(
        `INSERT INTO "Payment" (id, "customerId", "visitId", amount, method, type, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [p.id, custId, visitId, pAmount, p.method || 'Cash', p.type || 'visit_payment', p.createdAt]
      );
    }

    // Update Visit paidAmount and balanceDue
    for (const [visitId, paid] of visitPaymentsSum.entries()) {
      const visit = sessionToVisitMap.get(visitId);
      if (visit) {
        const balanceDue = Math.max(0, visit.visitTotal - paid);
        const paymentStatus = balanceDue === 0 ? 'paid' : (paid > 0 ? 'partially_paid' : 'pending');
        await target.query(
          `UPDATE "Visit" SET "paidAmount" = $1, "balanceDue" = $2, "paymentStatus" = $3 WHERE id = $4`,
          [paid, balanceDue, paymentStatus, visitId]
        );
      }
    }

    // 12. Insert CreditRecords (from Udhar)
    console.log('📒 Migrating Udhar to CreditRecord...');
    for (const u of udhars) {
      let cust = null;
      if (u.sessionId) {
        const visit = sessionToVisitMap.get(u.sessionId);
        if (visit) cust = idToCustomer.get(visit.customerId);
      }

      if (!cust) {
        const uName = (u.customerName || '').trim().toLowerCase();
        cust = nameToCustomer.get(uName);
      }

      if (!cust) {
        throw new Error(`Udhar ${u.id} cannot be mapped to any customer! (Name: "${u.customerName}", Session: "${u.sessionId}")`);
      }

      const uAmount = Number(u.amount) || 0;
      const settledAmount = u.status === 'paid' ? uAmount : 0;
      const visitId = sessionToVisitMap.has(u.sessionId) ? u.sessionId : null;

      await target.query(
        `INSERT INTO "CreditRecord" (id, "customerId", "visitId", amount, "settledAmount", status, notes, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [u.id, cust.id, visitId, uAmount, settledAmount, u.status, u.notes || null, u.createdAt]
      );
    }

    // 13. Recompute Customer Totals
    console.log('🔄 Recomputing Customer Lifetime & Credit Totals...');
    await target.query(`
      WITH customer_metrics AS (
        SELECT
          c.id AS customer_id,
          COALESCE((
            SELECT SUM(cr.amount - cr."settledAmount")
            FROM "CreditRecord" cr
            WHERE cr."customerId" = c.id AND cr.status = 'unpaid'
          ), 0) AS current_credit_due,
          COALESCE((
            SELECT SUM(v."visitTotal")
            FROM "Visit" v
            WHERE v."customerId" = c.id
          ), 0) AS lifetime_spend,
          COALESCE((
            SELECT SUM(p.amount)
            FROM "Payment" p
            WHERE p."customerId" = c.id
          ), 0) AS lifetime_paid,
          COALESCE((
            SELECT COUNT(*)
            FROM "Visit" v
            WHERE v."customerId" = c.id
          ), 0) AS total_visits
        FROM "Customer" c
      )
      UPDATE "Customer" c
      SET
        "currentCreditDue" = cm.current_credit_due,
        "lifetimeSpend" = cm.lifetime_spend,
        "lifetimePaid" = cm.lifetime_paid,
        "totalVisits" = cm.total_visits
      FROM customer_metrics cm
      WHERE c.id = cm.customer_id;
    `);

    // 14. Reset Postgres Sequences
    console.log('🔢 Resetting Postgres auto-increment sequences...');
    await target.query(`SELECT setval('"Customer_id_seq"', COALESCE((SELECT MAX(id) FROM "Customer"), 1))`);
    await target.query(`SELECT setval('"Staff_id_seq"', COALESCE((SELECT MAX(id) FROM "Staff"), 1))`);
    await target.query(`SELECT setval('"Table_id_seq"', COALESCE((SELECT MAX(id) FROM "Table"), 1))`);
    await target.query(`SELECT setval('"MenuItem_id_seq"', COALESCE((SELECT MAX(id) FROM "MenuItem"), 1))`);
    await target.query(`SELECT setval('"Order_id_seq"', COALESCE((SELECT MAX(id) FROM "Order"), 1))`);
    await target.query(`SELECT setval('"Payment_id_seq"', COALESCE((SELECT MAX(id) FROM "Payment"), 1))`);
    await target.query(`SELECT setval('"CreditRecord_id_seq"', COALESCE((SELECT MAX(id) FROM "CreditRecord"), 1))`);
    await target.query(`SELECT setval('"TablePlay_id_seq"', COALESCE((SELECT MAX(id) FROM "TablePlay"), 1))`);

    await target.query('COMMIT');
    console.log('\n✨ Database Migration Transaction Committed Successfully!\n');

    // 15. Verification & Assertions
    console.log('🔍 Running Post-Migration Verification Checks:');
    const targetStaff = (await target.query('SELECT COUNT(*) FROM "Staff"')).rows[0].count;
    const targetTables = (await target.query('SELECT COUNT(*) FROM "Table"')).rows[0].count;
    const targetMenuItems = (await target.query('SELECT COUNT(*) FROM "MenuItem"')).rows[0].count;
    const targetCustomers = (await target.query('SELECT COUNT(*) FROM "Customer"')).rows[0].count;
    const targetVisits = (await target.query('SELECT COUNT(*) FROM "Visit"')).rows[0].count;
    const targetOrders = (await target.query('SELECT COUNT(*) FROM "Order"')).rows[0].count;
    const targetPayments = (await target.query('SELECT COUNT(*) FROM "Payment"')).rows[0].count;
    const targetTablePlays = (await target.query('SELECT COUNT(*) FROM "TablePlay"')).rows[0].count;
    const targetCredits = (await target.query('SELECT COUNT(*) FROM "CreditRecord"')).rows[0].count;

    const targetRevenue = (await target.query('SELECT SUM(amount) FROM "Payment"')).rows[0].sum;
    const targetUnpaidCredit = (await target.query('SELECT SUM(amount - "settledAmount") FROM "CreditRecord" WHERE status = \'unpaid\'')).rows[0].sum;
    const targetCustomerCreditSum = (await target.query('SELECT SUM("currentCreditDue") FROM "Customer"')).rows[0].sum;

    console.log(`  - Staff: ${targetStaff} (Expected: ${staff.length})`);
    console.log(`  - Tables: ${targetTables} (Expected: ${tables.length})`);
    console.log(`  - Menu Items: ${targetMenuItems} (Expected: ${menuItems.length})`);
    console.log(`  - Customers: ${targetCustomers} (Expected: ${cleanCustomers.length})`);
    console.log(`  - Visits: ${targetVisits} (Expected: ${sessions.length})`);
    console.log(`  - Orders: ${targetOrders} (Expected: ${orders.length})`);
    console.log(`  - Payments: ${targetPayments} (Expected: ${payments.length})`);
    console.log(`  - Table Plays: ${targetTablePlays} (Expected: ${tablePlays.length})`);
    console.log(`  - Credit Records: ${targetCredits} (Expected: ${udhars.length})`);
    console.log(`  - Total Revenue: ₹${Number(targetRevenue).toFixed(2)} (Expected: ₹289150.00)`);
    console.log(`  - Unpaid Credit Records Sum: ₹${Number(targetUnpaidCredit).toFixed(2)} (Expected: ₹33399.00)`);
    console.log(`  - Customer Outstanding Credit Sum: ₹${Number(targetCustomerCreditSum).toFixed(2)} (Expected: ₹33399.00)`);

    const errors = [];
    if (Number(targetStaff) !== staff.length) errors.push('Staff count mismatch');
    if (Number(targetTables) !== tables.length) errors.push('Tables count mismatch');
    if (Number(targetMenuItems) !== menuItems.length) errors.push('Menu items count mismatch');
    if (Number(targetVisits) !== sessions.length) errors.push('Visits count mismatch');
    if (Number(targetOrders) !== orders.length) errors.push('Orders count mismatch');
    if (Number(targetPayments) !== payments.length) errors.push('Payments count mismatch');
    if (Number(targetTablePlays) !== tablePlays.length) errors.push('TablePlays count mismatch');
    if (Number(targetCredits) !== udhars.length) errors.push('Credit records count mismatch');
    if (Math.abs(Number(targetRevenue) - 289150) > 0.01) errors.push('Revenue sum mismatch');
    if (Math.abs(Number(targetUnpaidCredit) - 33399) > 0.01) errors.push('Unpaid credit sum mismatch');
    if (Math.abs(Number(targetCustomerCreditSum) - 33399) > 0.01) errors.push('Customer credit balance mismatch');

    if (errors.length > 0) {
      console.error('\n❌ VALIDATION ERRORS:', errors);
      process.exit(1);
    } else {
      console.log('\n🎉 ALL 11 INTEGRITY ASSERTIONS PASSED WITH 100% ACCURACY! ZERO DATA LOSS.');
    }

  } catch (err) {
    await target.query('ROLLBACK');
    console.error('❌ Migration failed and rolled back:', err);
    process.exit(1);
  } finally {
    await remote.end();
    await target.end();
  }
}

migrateData().catch(console.error);
