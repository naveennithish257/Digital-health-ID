const request = require('supertest');
const app = require('../server');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runOtpVerification() {
  console.log('\n========================================');
  console.log('🧪 MEDVAULT COMPREHENSIVE OTP TEST SUITE');
  console.log('========================================\n');

  let passed = 0;
  let total = 0;

  function report(name, isOk, detail) {
    total++;
    if (isOk) {
      passed++;
      console.log(`✅ [PASS] ${name}: ${detail}`);
    } else {
      console.log(`❌ [FAIL] ${name}: ${detail}`);
    }
  }

  // 1. Patient Demo OTP Send
  try {
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({ health_id: 'HID-2026-99999', phone_number: '+919876543210' });
    report(
      'Patient Demo Send OTP',
      res.status === 200 && res.body.status === 'success',
      res.body.message
    );
  } catch (e) {
    report('Patient Demo Send OTP', false, e.message);
  }

  // 2. Patient Demo OTP Verify
  try {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ health_id: 'HID-2026-99999', otp: '123456' });
    report(
      'Patient Demo Verify OTP (123456)',
      res.status === 200 && !!res.body.data?.token,
      `User: ${res.body.data?.user?.full_name}, Token: ${res.body.data?.token ? 'Granted' : 'Missing'}`
    );
  } catch (e) {
    report('Patient Demo Verify OTP', false, e.message);
  }

  // 3. Security Gate: Arbitrary user cannot use 123456
  try {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ health_id: 'HID-2026-00001', otp: '123456' });
    report(
      'Security Gate: Reject 123456 for arbitrary ID',
      res.status !== 200,
      `HTTP status ${res.status} (Properly blocked unauthorized access)`
    );
  } catch (e) {
    report('Security Gate', false, e.message);
  }

  // 4. Real Patient DB OTP Flow (HID-2026-12345)
  try {
    // Step A: Send OTP
    const sendRes = await request(app)
      .post('/api/auth/send-otp')
      .send({ health_id: 'HID-2026-12345', phone_number: '+919876543210' });
    
    // Step B: Fetch generated OTP from database
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 4000,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: true, minVersion: 'TLSv1.2' }
    });
    const [authRows] = await conn.query('SELECT otp, otp_expiry FROM authentication WHERE user_id = ?', ['PAT001']);
    const dbOtp = authRows[0]?.otp;
    await conn.end();

    report(
      'Real Patient Send OTP & DB Persistence',
      sendRes.status === 200 && !!dbOtp,
      `Generated 6-digit OTP: ${dbOtp} in DB`
    );

    // Step C: Verify with WRONG OTP first
    const badVerify = await request(app)
      .post('/api/auth/verify-otp')
      .send({ health_id: 'HID-2026-12345', otp: '000000' });
    report(
      'Real Patient Reject Bad OTP',
      badVerify.status === 400 && badVerify.body.error?.code === 'INVALID_OTP',
      `Correctly returned 400 INVALID_OTP`
    );

    // Step D: Verify with CORRECT OTP
    const goodVerify = await request(app)
      .post('/api/auth/verify-otp')
      .send({ health_id: 'HID-2026-12345', otp: dbOtp });
    report(
      'Real Patient Verify Correct DB OTP',
      goodVerify.status === 200 && !!goodVerify.body.data?.token,
      `User: ${goodVerify.body.data?.user?.full_name}, Token: Granted`
    );
  } catch (e) {
    report('Real Patient OTP Flow', false, e.message);
  }

  // 5. Doctor Demo OTP Flow
  try {
    const docSend = await request(app)
      .post('/api/auth/doctor/send-otp')
      .send({ license_number: 'MCI-2026-10001', phone_number: '+919876543211' });
    const docVerify = await request(app)
      .post('/api/auth/doctor/verify-otp')
      .send({ license_number: 'MCI-2026-10001', otp: '123456' });
    report(
      'Doctor Demo OTP Flow',
      docVerify.status === 200 && !!docVerify.body.data?.token,
      `Doctor: ${docVerify.body.data?.user?.full_name}, Token: Granted`
    );
  } catch (e) {
    report('Doctor Demo OTP Flow', false, e.message);
  }

  // 6. Doctor Real DB OTP Flow (MCI-DL-98214)
  try {
    const docSend = await request(app)
      .post('/api/auth/doctor/send-otp')
      .send({ license_number: 'MCI-DL-98214', phone_number: '+919811122334' });

    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 4000,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: true, minVersion: 'TLSv1.2' }
    });
    const [authRows] = await conn.query('SELECT otp FROM authentication WHERE user_id = ?', ['doc-001']);
    const docDbOtp = authRows[0]?.otp;
    await conn.end();

    report(
      'Doctor Real DB OTP Generation',
      docSend.status === 200 && !!docDbOtp,
      `Generated doctor OTP: ${docDbOtp}`
    );

    const docVerify = await request(app)
      .post('/api/auth/doctor/verify-otp')
      .send({ license_number: 'MCI-DL-98214', otp: docDbOtp });
    report(
      'Doctor Real DB OTP Verification',
      docVerify.status === 200 && !!docVerify.body.data?.token,
      `Verified doctor session token issued`
    );
  } catch (e) {
    report('Doctor Real DB OTP Flow', false, e.message);
  }

  console.log('\n----------------------------------------');
  console.log(`TOTAL: ${passed}/${total} OTP tests passed (${Math.round((passed/total)*100)}%)`);
  console.log('----------------------------------------\n');

  process.exit(passed === total ? 0 : 1);
}

runOtpVerification();
