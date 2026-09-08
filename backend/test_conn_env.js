require('dotenv').config();
const { Client } = require('pg');

async function test() {
    console.log('Testing DIRECT_URL from .env...');
    const client = new Client({ connectionString: process.env.DIRECT_URL });
    try {
        await client.connect();
        console.log('--> DIRECT_URL CONNECTION SUCCESSFUL!');
        await client.end();
    } catch (e) {
        console.log('--> DIRECT_URL CONNECTION FAILED:', e.message);
    }

    console.log('Testing DATABASE_URL from .env...');
    const clientTx = new Client({ connectionString: process.env.DATABASE_URL });
    try {
        await clientTx.connect();
        console.log('--> DATABASE_URL CONNECTION SUCCESSFUL!');
        await clientTx.end();
    } catch (e) {
        console.log('--> DATABASE_URL CONNECTION FAILED:', e.message);
    }
}

test();
