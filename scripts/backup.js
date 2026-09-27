// ============================================================
// MEDVAULT DATABASE BACKUP SCRIPT
// Exports database tables into timestamped JSON / SQL archives
// ============================================================

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function backup() {
    console.log('📦 Starting MedVault Data Backup...');

    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `medvault-backup-${timestamp}.json`);

    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'health_id_system',
        port: parseInt(process.env.DB_PORT) || 3306,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false
    };

    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log(`✅ Connected to ${config.database} on ${config.host}`);

        const tables = ['patients', 'doctors', 'hospitals', 'medical_records', 'prescriptions', 'prescription_medications', 'appointments', 'patient_consent', 'emergency_qr_codes', 'access_logs'];
        const backupData = {
            metadata: {
                timestamp: new Date().toISOString(),
                database: config.database,
                version: "2.0.0"
            },
            tables: {}
        };

        for (const table of tables) {
            try {
                const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
                backupData.tables[table] = rows;
                console.log(`  ✓ Exported ${rows.length} rows from '${table}'`);
            } catch (err) {
                console.warn(`  ⚠️ Skipped '${table}': ${err.message}`);
            }
        }

        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
        console.log(`\n🎉 Backup successfully written to:\n📁 ${backupFile}`);
    } catch (error) {
        console.error('❌ Backup failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

backup();
