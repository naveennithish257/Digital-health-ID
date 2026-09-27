// ============================================================
// MEDVAULT DATABASE SEED SCRIPT
// Populates MySQL database with rich demonstration healthcare data
// ============================================================

const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

async function seed() {
    console.log('🌱 Starting MedVault Database Seeding...');

    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'health_id_system',
        port: parseInt(process.env.DB_PORT) || 3306,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true, minVersion: 'TLSv1.2' } : false
    };

    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log(`✅ Connected to database: ${config.database}`);

        // 1. Seed Hospitals
        console.log('🏥 Seeding hospitals...');
        await connection.query(`
            INSERT IGNORE INTO hospitals (hospital_id, hospital_name, registration_number, hospital_type, phone_number, email, address, city, state, pincode, total_beds, emergency_services)
            VALUES 
            ('hosp-1', 'Metro Heart Institute', 'REG-DL-2015-091', 'Private', '+91 11 2345 6789', 'contact@metroheart.org', 'Sector 12, RK Puram', 'New Delhi', 'Delhi', '110022', 250, TRUE),
            ('hosp-2', 'Apollo Multispecialty Hospital', 'REG-DL-2012-044', 'Private', '+91 11 4567 8901', 'info@apollonewdelhi.com', 'Mathura Road, Sarita Vihar', 'New Delhi', 'Delhi', '110076', 500, TRUE),
            ('hosp-3', 'All India Institute of Medical Sciences (AIIMS)', 'REG-GOV-1956-001', 'Government', '+91 11 2658 8500', 'dean@aiims.edu', 'Ansari Nagar', 'New Delhi', 'Delhi', '110029', 2400, TRUE)
        `);

        // 2. Seed Doctors
        console.log('👨‍⚕️ Seeding healthcare providers...');
        await connection.query(`
            INSERT IGNORE INTO doctors (doctor_id, full_name, specialization, license_number, phone_number, email, hospital_id, qualification, experience_years, verification_status)
            VALUES 
            ('doc-001', 'Dr. Aakash Roy', 'Cardiology', 'MCI-DL-98214', '+91 98111 22334', 'aakash.roy@metroheart.org', 'hosp-1', 'MBBS, MD (Medicine), DM (Cardiology)', 12, 'Verified'),
            ('doc-002', 'Dr. Neha Verma', 'Pulmonology', 'MCI-DL-54321', '+91 98222 33445', 'neha.verma@apollonewdelhi.com', 'hosp-2', 'MBBS, MD (Pulmonary Medicine)', 8, 'Verified'),
            ('doc-pending-1', 'Dr. Rajesh Kumar', 'Neurology', 'MCI-DL-11223', '+91 98333 44556', 'rajesh.kumar@neurology.in', 'hosp-3', 'MBBS, MD, DM (Neurology)', 14, 'Pending')
        `);

        // 3. Seed Patients
        console.log('👤 Seeding demo patients...');
        await connection.query(`
            INSERT IGNORE INTO patients (patient_id, health_id, full_name, date_of_birth, gender, blood_group, phone_number, email, address, city, state, pincode, allergies, chronic_conditions, emergency_contact_name, emergency_contact_phone, emergency_contact_relation)
            VALUES 
            ('demo-001', 'HID-2026-99999', 'Arjun Sharma', '1990-03-15', 'Male', 'O+', '+91 98765 43210', 'arjun.sharma@example.com', '24 Healthway Enclave, Connaught Place', 'New Delhi', 'Delhi', '110001', 'Penicillin, Sulfa Drugs', 'Hypertension, Mild Asthma', 'Priya Sharma', '+91 98765 43211', 'Spouse'),
            ('pt-002', 'HID-2026-88888', 'Sunita Rao', '1985-07-22', 'Female', 'B+', '+91 98450 12345', 'sunita.rao@example.com', '14 Indiranagar 100ft Road', 'Bengaluru', 'Karnataka', '560038', 'None reported', 'Type 2 Diabetes', 'Ramesh Rao', '+91 98450 54321', 'Brother')
        `);

        // 4. Seed Medical Records
        console.log('📋 Seeding medical records...');
        await connection.query(`
            INSERT IGNORE INTO medical_records (record_id, patient_id, doctor_id, hospital_id, record_type, record_title, record_date, diagnosis)
            VALUES 
            ('rec-1', 'demo-001', 'doc-001', 'hosp-1', 'Lab Report', 'Complete Blood Count (CBC) & Lipid Profile', '2026-08-14', 'Total cholesterol mildly elevated at 210 mg/dL. Hemoglobin normal at 14.8 g/dL.'),
            ('rec-2', 'demo-001', 'doc-001', 'hosp-1', 'Hospital Visit', 'Quarterly Cardiac Follow-up', '2026-07-22', 'Blood pressure controlled at 122/82 mmHg on current anti-hypertensive regimen.'),
            ('rec-3', 'demo-001', 'doc-002', 'hosp-2', 'Hospital Visit', 'Pulmonary Consultation', '2026-05-10', 'Mild seasonal allergic bronchitis. Spirometry normal.')
        `);

        // 5. Seed Prescriptions & Medications
        console.log('💊 Seeding prescriptions...');
        await connection.query(`
            INSERT IGNORE INTO prescriptions (prescription_id, patient_id, doctor_id, hospital_id, visit_date, diagnosis, prescription_status, special_instructions)
            VALUES 
            ('rx-1', 'demo-001', 'doc-001', 'hosp-1', '2026-08-20', 'Essential Hypertension', 'Active', 'Maintain low-sodium diet. Daily 30 min brisk walk.')
        `);

        await connection.query(`
            INSERT IGNORE INTO prescription_medications (medication_id, prescription_id, medicine_name, dosage, frequency, duration, timing, food_instruction)
            VALUES 
            ('med-1', 'rx-1', 'Amlodipine', '5mg', 'Once daily', '30 days', 'Morning', 'After food'),
            ('med-2', 'rx-1', 'Telmisartan', '40mg', 'Once daily', '30 days', 'Morning', 'After food')
        `);

        // 6. Seed Consent
        console.log('🛡️ Seeding patient consent...');
        await connection.query(`
            INSERT IGNORE INTO patient_consent (consent_id, patient_id, accessor_id, accessor_type, consent_type, granted_at, expires_at, purpose)
            VALUES 
            ('consent-demo', 'demo-001', 'doc-001', 'Doctor', 'Full Access', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 'Regular Cardiac Care & Treatment Monitoring')
        `);

        console.log('🎉 Database seeding completed successfully! Test users and sample data are ready.');
    } catch (error) {
        console.error('❌ Seeding failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

seed();
