const { Client } = require('pg');

const passwords = ['Rebound@123', 'Rebound%40123', 'rebound@123', 'rebound%40123'];
const ports = [5432, 6543];

async function test() {
    for (const pw of passwords) {
        for (const port of ports) {
            const url = `postgresql://postgres.qlbvmqjhzgaurgjnfolv:${pw}@aws-1-ap-northeast-1.pooler.supabase.com:${port}/postgres${port === 6543 ? '?pgbouncer=true' : ''}`;
            const displayUrl = url.replace(/:[^:@]+@/, ':****@');
            console.log(`Testing: pw=${pw.includes('%') ? 'encoded' : 'plain'}, port=${port}`);
            const client = new Client({ connectionString: url });
            try {
                await client.connect();
                console.log('--> CONNECTION SUCCESSFUL!');
                console.log('Working Connection String:', url);
                await client.end();
                process.exit(0);
            } catch (e) {
                console.log('--> FAILED:', e.message);
            }
        }
    }
    console.log('All combinations failed.');
    process.exit(1);
}

test();
