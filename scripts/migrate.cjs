require('dotenv/config');
const { Pool } = require('pg');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// Upgrade an existing Sprint 1 database without recreating its tables.
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 5432)
});
(async () => {
    try {
        await pool.query(readFileSync(join(__dirname, '../src/database/migrations/002_user_profiles.sql'), 'utf8'));
        console.log('Sprint 2 database migration completed.');
    } catch (error) {
        console.error('Database migration failed:', error.message);
        process.exitCode = 1;
    } finally { await pool.end(); }
})();
