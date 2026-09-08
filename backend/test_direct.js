const { Client } = require('pg');

async function test() {
    console.log('Testing direct host db.qlbvmqjhzgaurgjnfolv.supabase.co...');
    const url = 'postgresql://postgres:Rebound%402april26@db.qlbvmqjhzgaurgjnfolv.supabase.co:5432/postgres';
    const client = new Client({ connectionString: url });
    try {
        await client.connect();
        console.log('--> DIRECT HOST CONNECTION SUCCESSFUL!');
        await client.end();
    } catch (e) {
        console.log('--> DIRECT HOST CONNECTION FAILED:', e.message);
    }
}

test();
