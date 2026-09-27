// ============================================================
// MEDVAULT DATABASE MIGRATION SCRIPT
// Executes database-schema.sql against the configured MySQL DB
// ============================================================

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    console.log('🚀 Starting MedVault Database Migration...');

    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: parseInt(process.env.DB_PORT) || 3306,
        multipleStatements: true,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true, minVersion: 'TLSv1.2' } : false
    };

    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log(`✅ Connected to MySQL server at ${config.host}:${config.port}`);

        const dbName = process.env.DB_NAME || 'health_id_system';
        console.log(`📦 Ensuring database '${dbName}' exists...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await connection.query(`USE \`${dbName}\`;`);

        const schemaPath = path.join(__dirname, '..', 'database-schema.sql');
        console.log(`📄 Reading schema from ${schemaPath}...`);
        let schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Remove DELIMITER blocks (stored procedures & triggers meant for MySQL CLI)
        schemaSql = schemaSql.replace(/DELIMITER\s+\/\/[\s\S]*?DELIMITER\s+;/gi, '');

        // Remove CREATE DATABASE and USE statements since already handled above
        schemaSql = schemaSql.replace(/CREATE DATABASE[\s\S]*?health_id_system;/gi, '');
        schemaSql = schemaSql.replace(/USE\s+health_id_system;/gi, '');

        // Split by semicolons, filtering out comments and empty strings
        const rawStatements = schemaSql.split(/;\s*[\r\n]+/);
        console.log(`⚡ Executing ${rawStatements.length} schema definition statements...`);

        let executedCount = 0;
        for (const raw of rawStatements) {
            const stmt = raw.trim();
            // Skip empty or comment-only blocks
            if (!stmt || stmt.startsWith('--') && !stmt.includes('\n')) continue;
            const cleanStmt = stmt.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();
            if (!cleanStmt) continue;

            try {
                await connection.query(cleanStmt);
                executedCount++;
            } catch (err) {
                // If it's fulltext index warning or already exists, log and proceed
                if (err.message.includes('already exists') || err.message.includes('Duplicate key')) {
                    // ignore idempotent errors
                } else {
                    console.warn(`⚠️ Notice on statement: ${err.message.split('\n')[0]}`);
                }
            }
        }

        console.log(`🎉 Migration completed! Executed ${executedCount} table and index statements successfully.`);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.log('\n💡 Troubleshooting Tips:');
        console.log('1. Ensure your local MySQL server is running (e.g. XAMPP, Docker, or native service).');
        console.log('2. Verify DB_USER and DB_PASSWORD in your .env file.');
        console.log('3. If using cloud MySQL (e.g., TiDB / Aiven / PlanetScale), set DB_SSL=true in .env.\n');
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
