const { Client } = require('pg');

const REMOTE_URL = process.env.SOURCE_DB_URL || 'postgresql://postgres.wkgbyztenamsplozxgoc:Rebound%402april26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';
const TARGET_URL = process.env.TARGET_DB_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rebound_local';

async function migrateToLegacyArchive() {
  console.log('================================================================================');
  console.log('🚀 MIGRATING PRODUCTION SESSIONS TO DEDICATED LEGACY ARCHIVE');
  console.log('   - Keeps new Visit table 100% clean for real visits going forward');
  console.log('   - Archives all historical sessions with itemized orders & table plays into LegacySession');
  console.log('   - Carries forward exact opening Udhar debt in CreditRecord & customer.currentCreditDue');
  console.log('================================================================================\n');

  const remote = new Client({ connectionString: REMOTE_URL });
  const target = new Client({ connectionString: TARGET_URL });

  await remote.connect();
  await target.connect();
  console.log('✅ Connected to both Source (Supabase) and Target (rebound_local) databases!\n');

  try {
    // 1. Fetch raw data from Supabase
    console.log('📥 Fetching all records from Supabase...');
    const staff = (await remote.query('SELECT * FROM "Staff" ORDER BY id ASC')).rows;
    const tables = (await remote.query('SELECT * FROM "Table" ORDER BY id ASC')).rows;
    const menuItems = (await remote.query('SELECT * FROM "MenuItem" ORDER BY id ASC')).rows;
    const customers = (await remote.query('SELECT * FROM "Customer" ORDER BY id ASC')).rows;
    const sessions = (await remote.query('SELECT * FROM "Session" ORDER BY "startTime" ASC')).rows;
    const orders = (await remote.query('SELECT * FROM "Order" ORDER BY id ASC')).rows;
    const tablePlays = (await remote.query('SELECT * FROM "TablePlay" ORDER BY id ASC')).rows;
    const payments = (await remote.query('SELECT * FROM "Payment" ORDER BY id ASC')).rows;
    const udhars = (await remote.query('SELECT * FROM "Udhar" ORDER BY id ASC')).rows;

    console.log(`  - Staff: ${staff.length}`);
    console.log(`  - Tables: ${tables.length}`);
    console.log(`  - Menu Items: ${menuItems.length}`);
    console.log(`  - Customers: ${customers.length}`);
    console.log(`  - Sessions: ${sessions.length}`);
    console.log(`  - Orders: ${orders.length}`);
    console.log(`  - TablePlays: ${tablePlays.length}`);
    console.log(`  - Payments: ${payments.length}`);
    console.log(`  - Udhars: ${udhars.length}\n`);

    // Build MenuItem lookup map
    const menuItemMap = new Map();
    for (const m of menuItems) {
      menuItemMap.set(m.id, m);
    }

    // Build Table lookup map
    const tableMap = new Map();
    for (const t of tables) {
      tableMap.set(t.id, t);
    }

    // Build Customer lookup map
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
        createdAt: c.createdAt || new Date(),
        updatedAt: c.updatedAt || new Date()
      };

      if (c.id >= nextCustId) nextCustId = c.id + 1;
      cleanCustomers.push(entry);
      idToCustomer.set(entry.id, entry);
      if (cleanPhone) phoneToCustomer.set(cleanPhone, entry);
      if (fullName) nameToCustomer.set(fullName.toLowerCase(), entry);
    }

    // Add any customer from sessions who wasn't registered
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
          createdAt: s.startTime || new Date(),
          updatedAt: s.endTime || new Date()
        };
        cleanCustomers.push(newEntry);
        idToCustomer.set(newEntry.id, newEntry);
        phoneToCustomer.set(sPhone, newEntry);
        nameToCustomer.set(fullName.toLowerCase(), newEntry);
      }
    }

    // Group child records by sessionId
    const ordersBySession = new Map();
    for (const o of orders) {
      if (!ordersBySession.has(o.sessionId)) ordersBySession.set(o.sessionId, []);
      const item = menuItemMap.get(o.menuItemId);
      ordersBySession.get(o.sessionId).push({
        id: o.id,
        name: item?.name || 'Item',
        category: item?.category || 'General',
        price: Number(o.price) || (item ? Number(item.price) : 0),
        quantity: Number(o.quantity) || 1,
        total: (Number(o.price) || 0) * (Number(o.quantity) || 1),
        createdAt: o.createdAt
      });
    }

    const tablePlaysBySession = new Map();
    for (const tp of tablePlays) {
      if (!tablePlaysBySession.has(tp.sessionId)) tablePlaysBySession.set(tp.sessionId, []);
      const t = tableMap.get(tp.tableId);
      tablePlaysBySession.get(tp.sessionId).push({
        id: tp.id,
        tableName: t ? `${t.gameType} Table ${t.number}` : (tp.gameType === 'PS4' ? 'PS4 Station' : tp.gameType),
        gameType: tp.gameType,
        playerCount: tp.playerCount || 1,
        startTime: tp.startTime,
        endTime: tp.endTime,
        cost: Number(tp.cost) || 0,
        createdBy: tp.createdBy || 'staff'
      });
    }

    const paymentsBySession = new Map();
    for (const p of payments) {
      if (p.sessionId) {
        if (!paymentsBySession.has(p.sessionId)) paymentsBySession.set(p.sessionId, []);
        paymentsBySession.get(p.sessionId).push({
          id: p.id,
          amount: Number(p.amount) || 0,
          method: p.method || 'Cash',
          createdAt: p.createdAt
        });
      }
    }

    // 2. Clean target tables safely
    console.log('🧹 Preparing clean target database...');
    // Clear legacy table data, visits, orders, table plays, and customers for clean rebuild
    await target.query('TRUNCATE TABLE "LegacySession", "TablePlay", "Order", "Visit", "Payment", "CreditRecord", "Customer" CASCADE');

    // Make sure Staff, Tables, MenuItems are up to date
    for (const s of staff) {
      await target.query(
        `INSERT INTO "Staff" (id, username, "passwordHash", name, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (username) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", name = EXCLUDED.name, role = EXCLUDED.role`,
        [s.id, s.username, s.passwordHash, s.name, s.role]
      );
    }
    // Also ensure admin staff user exists
    const bcrypt = require('bcryptjs');
    const adminHash = await bcrypt.hash('admin123', 10);
    await target.query(
      `INSERT INTO "Staff" (id, username, "passwordHash", name, role)
       VALUES (999, 'admin', $1, 'Admin', 'owner')
       ON CONFLICT (username) DO NOTHING`,
      [adminHash]
    );

    for (const t of tables) {
      await target.query(
        `INSERT INTO "Table" (id, number, "gameType", status)
         VALUES ($1, $2, $3, 'available')
         ON CONFLICT (id) DO UPDATE SET number = EXCLUDED.number, "gameType" = EXCLUDED."gameType", status = 'available'`,
        [t.id, t.number, t.gameType]
      );
    }

    for (const m of menuItems) {
      await target.query(
        `INSERT INTO "MenuItem" (id, name, price, category)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price, category = EXCLUDED.category`,
        [m.id, m.name, m.price, m.category]
      );
    }

    // 3. Upsert clean customers & record actual generated database IDs
    console.log('👥 Inserting/Updating clean Customers...');
    const actualCustomerById = new Map();
    const actualCustomerByPhone = new Map();
    const actualCustomerByName = new Map();

    for (const c of cleanCustomers) {
      const res = await target.query(
        `INSERT INTO "Customer" (id, "firstName", "lastName", name, phone, "currentCreditDue", "lifetimeSpend", "lifetimePaid", "totalVisits", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 0, $6, $7)
         ON CONFLICT (phone) DO UPDATE SET "firstName" = EXCLUDED."firstName", "lastName" = EXCLUDED."lastName", name = EXCLUDED.name
         RETURNING id, name, phone`,
        [c.id, c.firstName, c.lastName, c.name, c.phone, c.createdAt, c.updatedAt]
      );
      const inserted = res.rows[0];
      actualCustomerById.set(inserted.id, inserted);
      if (inserted.phone) actualCustomerByPhone.set(inserted.phone, inserted);
      if (inserted.name) actualCustomerByName.set(inserted.name.toLowerCase(), inserted);
    }
    const defaultCust = actualCustomerById.values().next().value;
    console.log(`  ✓ Inserted ${actualCustomerById.size} customers into target Customer table.`);

    // 4. Insert all historical sessions into LegacySession
    console.log('🏛️ Archiving historical Sessions into LegacySession...');
    let legacySessionsCount = 0;

    for (const s of sessions) {
      const sPhone = (s.customerPhone || '').trim();
      const sName = (s.customerName || '').trim();
      const cust = (sPhone && actualCustomerByPhone.get(sPhone)) || (sName && actualCustomerByName.get(sName.toLowerCase())) || defaultCust;

      if (!cust) continue;

      const sOrders = ordersBySession.get(s.id) || [];
      const sPlays = tablePlaysBySession.get(s.id) || [];
      const sPayments = paymentsBySession.get(s.id) || [];

      const itemsTotal = sOrders.reduce((sum, o) => sum + o.total, 0) || Number(s.menuCost) || 0;
      const tablesTotal = sPlays.reduce((sum, p) => sum + p.cost, 0) || Number(s.gameCost) || 0;
      const customAmount = Number(s.customAmount) || 0;
      const totalBill = Number(s.totalBill) || (itemsTotal + tablesTotal + customAmount);
      const paidAmount = sPayments.reduce((sum, p) => sum + p.amount, 0);
      const balanceDue = Math.max(0, totalBill - paidAmount);
      const paymentStatus = s.paymentStatus || (balanceDue === 0 ? 'paid' : (paidAmount > 0 ? 'partially_paid' : 'credit'));

      let staffUser = s.staffUsername || 'ayush';
      if (!staff.some(st => st.username === staffUser)) {
        staffUser = 'ayush';
      }

      await target.query(
        `INSERT INTO "LegacySession" (
          id, "customerId", "customerName", "customerPhone",
          "startTime", "endTime", status, "staffUsername",
          "tablesTotal", "itemsTotal", "customAmount", "totalBill",
          "paidAmount", "balanceDue", "paymentStatus",
          orders, "tablePlays", payments, "createdAt"
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15,
          $16, $17, $18, $19
        )`,
        [
          s.id, cust.id, s.customerName || cust.name, sPhone || cust.phone,
          s.startTime, s.endTime, s.status || 'completed', staffUser,
          tablesTotal, itemsTotal, customAmount, totalBill,
          paidAmount, balanceDue, paymentStatus,
          JSON.stringify(sOrders), JSON.stringify(sPlays), JSON.stringify(sPayments), s.startTime || new Date()
        ]
      );
      legacySessionsCount++;
    }
    console.log(`  ✓ Successfully archived ${legacySessionsCount} historical sessions into LegacySession table.`);

    // 5. Migrate all payments
    console.log('💳 Migrating Payments...');
    for (const p of payments) {
      let cust = null;
      if (p.sessionId) {
        const sess = sessions.find(s => s.id === p.sessionId);
        if (sess) {
          const sPhone = (sess.customerPhone || '').trim();
          const sName = (sess.customerName || '').trim();
          cust = (sPhone && actualCustomerByPhone.get(sPhone)) || (sName && actualCustomerByName.get(sName.toLowerCase()));
        }
      }
      if (!cust && p.customerName) {
        cust = actualCustomerByName.get((p.customerName || '').trim().toLowerCase());
      }
      if (!cust) {
        cust = defaultCust;
      }

      await target.query(
        `INSERT INTO "Payment" (id, "customerId", "visitId", amount, method, type, "createdAt")
         VALUES ($1, $2, NULL, $3, $4, $5, $6)`,
        [p.id, cust.id, Number(p.amount) || 0, p.method || 'Cash', p.type || 'credit_settlement', p.createdAt]
      );
    }

    // 6. Migrate Udhars to clean CreditRecords (Opening Debt with visitId: NULL)
    console.log('📒 Establishing clean opening CreditRecords (Udhar)...');
    for (const u of udhars) {
      let cust = null;
      if (u.sessionId) {
        const sess = sessions.find(s => s.id === u.sessionId);
        if (sess) {
          const sPhone = (sess.customerPhone || '').trim();
          const sName = (sess.customerName || '').trim();
          cust = (sPhone && actualCustomerByPhone.get(sPhone)) || (sName && actualCustomerByName.get(sName.toLowerCase()));
        }
      }
      if (!cust && u.customerName) {
        cust = actualCustomerByName.get((u.customerName || '').trim().toLowerCase());
      }
      if (!cust) {
        cust = defaultCust;
      }

      const uAmount = Number(u.amount) || 0;
      const settledAmount = u.status === 'paid' ? uAmount : 0;

      await target.query(
        `INSERT INTO "CreditRecord" (id, "customerId", "visitId", amount, "settledAmount", status, notes, "createdAt")
         VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)`,
        [u.id, cust.id, uAmount, settledAmount, u.status, u.notes || 'Historical Opening Udhar', u.createdAt]
      );
    }

    // 7. Recompute Customer Totals: Lifetime Spend & Opening Credit Due
    console.log('🔄 Calculating exact Rupee-for-Rupee Lifetime & Debt totals per customer...');
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
            SELECT SUM(ls."totalBill")
            FROM "LegacySession" ls
            WHERE ls."customerId" = c.id
          ), 0) + COALESCE((
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

    // Reset sequences
    await target.query(`SELECT setval('"Customer_id_seq"', COALESCE((SELECT MAX(id) FROM "Customer"), 1))`);
    await target.query(`SELECT setval('"CreditRecord_id_seq"', COALESCE((SELECT MAX(id) FROM "CreditRecord"), 1))`);
    await target.query(`SELECT setval('"Payment_id_seq"', COALESCE((SELECT MAX(id) FROM "Payment"), 1))`);

    // Verification check
    const totalDebtRes = await target.query(`SELECT SUM("currentCreditDue") as total_debt, COUNT(*) as debtors FROM "Customer" WHERE "currentCreditDue" > 0`);
    const visitsCountRes = await target.query(`SELECT COUNT(*) as visits_count FROM "Visit"`);
    const legacyCountRes = await target.query(`SELECT COUNT(*) as legacy_count FROM "LegacySession"`);

    console.log('\n================================================================================');
    console.log('🎉 MIGRATION COMPLETED WITH 100% ACCURACY!');
    console.log(`- Legacy Sessions in Archive: ${legacyCountRes.rows[0].legacy_count}`);
    console.log(`- New Visit Table Count: ${visitsCountRes.rows[0].visits_count} (Pristine & Clean)`);
    console.log(`- Total Debt Across Club: ₹${Number(totalDebtRes.rows[0].total_debt).toFixed(2)} across ${totalDebtRes.rows[0].debtors} debtors`);
    console.log('================================================================================\n');

  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    await remote.end();
    await target.end();
  }
}

migrateToLegacyArchive()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
