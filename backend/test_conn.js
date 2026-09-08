const { Client } = require('pg');

const urls = [
    "postgresql://postgres.qlbvmqjhzgaurgjnfolv:Rebound%40123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres",
    "postgresql://postgres.qlbvmqjhzgaurgjnfolv:rebound%40123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres",
    "postgresql://postgres.qlbvmqjhzgaurgjnfolv:Rebound@123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres",
    "postgresql://postgres.qlbvmqjhzgaurgjnfolv:rebound@123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
];

async function test() {
    for (const url of urls) {
        // Redact password for logging
        const displayUrl = url.replace(/:[^:@]+@/, ':****@');
        console.log('Testing connection string:', displayUrl);
        const client = new Client({ connectionString: url });
        try {
            await client.connect();
            console.log('--> CONNECTION SUCCESSFUL!');
            console.log('Working Connection String:', url);
            await client.end();
            process.exit(0);
        } catch (e) {
            console.log('--> CONNECTION FAILED:', e.message);
        }
    }
    console.log('All connection strings failed.');
    process.exit(1);
}

test();
