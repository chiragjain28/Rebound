const { Client } = require('pg');

async function run() {
  const connectionString = process.env.DATABASE_URL || "postgresql://postgres.wkgbyztenamsplozxgoc:Rebound%402april26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
  
  console.log('Connecting via pg client...');
  let start = Date.now();
  const client = new Client({ connectionString });
  await client.connect();
  console.log(`Connection established in: ${Date.now() - start}ms`);

  for (let i = 1; i <= 3; i++) {
    start = Date.now();
    const res = await client.query("SELECT * FROM \"Session\" WHERE status = 'active'");
    console.log(`Query ${i} took: ${Date.now() - start}ms (found ${res.rows.length} rows)`);
  }

  await client.end();
}

run();
