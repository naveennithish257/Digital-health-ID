# Digital Health ID System - Testing Guide

## 🧪 Testing Strategy

This document outlines comprehensive testing procedures for the Digital Health ID System to ensure reliability, security, and performance.

## 📋 Test Categories

### 1. Unit Tests
### 2. Integration Tests
### 3. API Tests
### 4. Security Tests
### 5. Performance Tests
### 6. User Acceptance Tests

---

## 🔬 Unit Tests

### Setup Jest for Testing

```bash
# Install testing dependencies
npm install --save-dev jest supertest @types/jest

# Run tests
npm test

# Run with coverage
npm test -- --coverage
```

### Example Unit Tests

```javascript
// tests/utils.test.js
const { generateHealthId, generateOTP } = require('../utils');

describe('Utility Functions', () => {
    test('Generate Health ID format', () => {
        const healthId = generateHealthId();
        expect(healthId).toMatch(/^HID-\d{4}-\d{5}$/);
    });

    test('Generate 6-digit OTP', () => {
        const otp = generateOTP();
        expect(otp).toHaveLength(6);
        expect(parseInt(otp)).toBeGreaterThanOrEqual(100000);
        expect(parseInt(otp)).toBeLessThanOrEqual(999999);
    });
});

// tests/auth.test.js
const request = require('supertest');
const app = require('../server');

describe('Authentication Endpoints', () => {
    test('POST /api/auth/register - Valid registration', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                full_name: 'Test User',
                date_of_birth: '1990-01-01',
                gender: 'Male',
                blood_group: 'A+',
                phone_number: '+919876543210',
                emergency_contact_phone: '+919876543211'
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.status).toBe('success');
        expect(response.body.data).toHaveProperty('health_id');
    });

    test('POST /api/auth/register - Invalid phone number', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                full_name: 'Test User',
                phone_number: 'invalid'
            });

        expect(response.statusCode).toBe(422);
        expect(response.body.status).toBe('error');
    });

    test('POST /api/auth/send-otp - Valid request', async () => {
        const response = await request(app)
            .post('/api/auth/send-otp')
            .send({
                health_id: 'HID-2026-12345',
                phone_number: '+919876543210'
            });

        expect(response.statusCode).toBe(200);
        expect(response.body.data).toHaveProperty('otp_expiry');
    });
});
```

---

## 🔗 Integration Tests

### Database Integration Tests

```javascript
// tests/database.test.js
const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');

describe('Database Operations', () => {
    let connection;

    beforeAll(async () => {
        connection = await mysql.createConnection(dbConfig);
    });

    afterAll(async () => {
        await connection.end();
    });

    test('Database connection', async () => {
        const [rows] = await connection.query('SELECT 1 as test');
        expect(rows[0].test).toBe(1);
    });

    test('Create patient record', async () => {
        const patientData = {
            patient_id: 'TEST001',
            health_id: 'HID-TEST-001',
            full_name: 'Test Patient',
            // ... other fields
        };

        await connection.query(
            'INSERT INTO patients SET ?',
            patientData
        );

        const [rows] = await connection.query(
            'SELECT * FROM patients WHERE patient_id = ?',
            ['TEST001']
        );

        expect(rows[0].health_id).toBe('HID-TEST-001');

        // Cleanup
        await connection.query('DELETE FROM patients WHERE patient_id = ?', ['TEST001']);
    });
});
```

### File Upload Integration Tests

```javascript
// tests/upload.test.js
const request = require('supertest');
const app = require('../server');
const fs = require('fs');
const path = require('path');

describe('File Upload', () => {
    let authToken;

    beforeAll(async () => {
        // Login and get token
        const response = await request(app)
            .post('/api/auth/verify-otp')
            .send({
                health_id: 'HID-2026-12345',
                otp: '123456'
            });
        authToken = response.body.data.access_token;
    });

    test('Upload medical record with file', async () => {
        const testFile = path.join(__dirname, 'fixtures', 'test-report.pdf');
        
        const response = await request(app)
            .post('/api/patients/HID-2026-12345/records')
            .set('Authorization', `Bearer ${authToken}`)
            .field('record_type', 'Lab Report')
            .field('record_title', 'Blood Test')
            .field('record_date', '2026-02-16')
            .attach('file', testFile);

        expect(response.statusCode).toBe(201);
        expect(response.body.data).toHaveProperty('record_id');
    });

    test('Upload without authentication', async () => {
        const response = await request(app)
            .post('/api/patients/HID-2026-12345/records')
            .send({});

        expect(response.statusCode).toBe(401);
    });
});
```

---

## 🔐 Security Tests

### Authentication & Authorization Tests

```javascript
// tests/security.test.js
describe('Security Tests', () => {
    test('JWT token expiration', async () => {
        const expiredToken = 'expired_jwt_token_here';
        
        const response = await request(app)
            .get('/api/patients/HID-2026-12345')
            .set('Authorization', `Bearer ${expiredToken}`);

        expect(response.statusCode).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
    });

    test('SQL injection prevention', async () => {
        const maliciousInput = "'; DROP TABLE patients; --";
        
        const response = await request(app)
            .post('/api/auth/send-otp')
            .send({
                health_id: maliciousInput,
                phone_number: '+919876543210'
            });

        // Should not crash, should return error or 404
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    test('XSS prevention', async () => {
        const xssPayload = '<script>alert("XSS")</script>';
        
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                full_name: xssPayload,
                // ... other fields
            });

        if (response.statusCode === 201) {
            expect(response.body.data.full_name).not.toContain('<script>');
        }
    });

    test('Rate limiting', async () => {
        const requests = [];
        
        // Make 15 requests rapidly
        for (let i = 0; i < 15; i++) {
            requests.push(
                request(app)
                    .post('/api/auth/send-otp')
                    .send({
                        health_id: 'HID-2026-12345',
                        phone_number: '+919876543210'
                    })
            );
        }

        const responses = await Promise.all(requests);
        const rateLimited = responses.some(r => r.statusCode === 429);
        
        expect(rateLimited).toBe(true);
    });
});
```

### Encryption Tests

```javascript
describe('Data Encryption', () => {
    test('Passwords are hashed', async () => {
        const plainPassword = 'TestPassword123';
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        
        expect(hashedPassword).not.toBe(plainPassword);
        expect(hashedPassword).toHaveLength(60); // bcrypt hash length
    });

    test('Sensitive data encryption', () => {
        const sensitiveData = 'Patient SSN: 123-45-6789';
        const encrypted = encrypt(sensitiveData);
        const decrypted = decrypt(encrypted);
        
        expect(encrypted).not.toBe(sensitiveData);
        expect(decrypted).toBe(sensitiveData);
    });
});
```

---

## ⚡ Performance Tests

### Load Testing with Artillery

Install Artillery:
```bash
npm install -g artillery
```

Create load test configuration:

```yaml
# artillery-config.yml
config:
  target: 'https://api.yourdomain.com'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100
      name: "Peak load"
  defaults:
    headers:
      Content-Type: 'application/json'

scenarios:
  - name: "Health Check"
    flow:
      - get:
          url: "/api/health"

  - name: "Patient Dashboard"
    flow:
      - post:
          url: "/api/auth/verify-otp"
          json:
            health_id: "HID-2026-12345"
            otp: "123456"
          capture:
            - json: "$.data.access_token"
              as: "token"
      - get:
          url: "/api/patients/HID-2026-12345/dashboard"
          headers:
            Authorization: "Bearer {{ token }}"

  - name: "Get Medical Records"
    flow:
      - get:
          url: "/api/patients/HID-2026-12345/records"
          headers:
            Authorization: "Bearer {{ token }}"
```

Run load tests:
```bash
artillery run artillery-config.yml
artillery report report.json
```

### Database Performance Tests

```sql
-- Test query performance
EXPLAIN SELECT * FROM medical_records 
WHERE patient_id = 'PAT001' 
ORDER BY record_date DESC;

-- Check slow queries
SELECT * FROM mysql.slow_log 
ORDER BY query_time DESC 
LIMIT 10;

-- Analyze table statistics
ANALYZE TABLE patients;
ANALYZE TABLE medical_records;

-- Check index usage
SHOW INDEX FROM medical_records;
```

### API Response Time Tests

```javascript
describe('Performance Tests', () => {
    test('API response time under 200ms', async () => {
        const start = Date.now();
        
        await request(app).get('/api/health');
        
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(200);
    });

    test('Dashboard loads under 1 second', async () => {
        const start = Date.now();
        
        await request(app)
            .get('/api/patients/HID-2026-12345/dashboard')
            .set('Authorization', `Bearer ${authToken}`);
        
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(1000);
    });
});
```

---

## 👥 User Acceptance Testing (UAT)

### Test Scenarios

#### Scenario 1: Patient Registration
```
1. Navigate to registration page
2. Fill in personal details
   - Name: John Doe
   - DOB: 01/01/1990
   - Blood Group: A+
   - Phone: +919876543210
3. Submit form
4. Verify OTP received
5. Enter OTP
6. Verify successful registration
7. Check Health ID generated

Expected: Health ID format HID-YYYY-XXXXX displayed
Actual: _______________
Status: Pass/Fail
```

#### Scenario 2: Upload Medical Record
```
1. Login with credentials
2. Navigate to Medical Records
3. Click "Upload Record"
4. Select file (PDF, < 10MB)
5. Fill record details
6. Submit
7. Verify record appears in list
8. Download and verify file

Expected: Record uploaded and accessible
Actual: _______________
Status: Pass/Fail
```

#### Scenario 3: Emergency QR Code
```
1. Login as patient
2. Navigate to Emergency Access
3. Click "Generate QR Code"
4. Verify QR code displayed
5. Download QR code
6. Scan with mobile device
7. Verify critical information displayed

Expected: QR shows blood group, allergies, emergency contact
Actual: _______________
Status: Pass/Fail
```

### UAT Checklist

**Patient Portal:**
- [ ] Registration works correctly
- [ ] OTP verification functions
- [ ] Login/logout functional
- [ ] Dashboard displays accurate data
- [ ] Profile editing works
- [ ] File upload successful (PDF, images)
- [ ] Records downloadable
- [ ] Appointments can be booked
- [ ] Prescriptions viewable
- [ ] QR code generation works
- [ ] Mobile responsive

**Doctor Portal:**
- [ ] Doctor login works
- [ ] Patient search functional
- [ ] Consent request system works
- [ ] Can view patient records (with consent)
- [ ] Prescription creation works
- [ ] Digital signature applied
- [ ] Appointment management

**Hospital Portal:**
- [ ] Hospital login works
- [ ] Patient registration
- [ ] Lab result upload
- [ ] Admission management
- [ ] Billing integration

**Security:**
- [ ] HTTPS enforced
- [ ] Session timeout works
- [ ] Password requirements enforced
- [ ] Failed login lockout
- [ ] Data encryption verified
- [ ] Audit logs created

---

## 🐛 Bug Reporting Template

```markdown
## Bug Report

**Title:** [Short description]

**Priority:** Critical / High / Medium / Low

**Environment:**
- Browser: Chrome 120.0
- OS: Windows 11
- Server: Production

**Steps to Reproduce:**
1. Go to login page
2. Enter credentials
3. Click login
4. [etc.]

**Expected Behavior:**
User should be logged in and redirected to dashboard

**Actual Behavior:**
Error message displayed: "Invalid token"

**Screenshots:**
[Attach screenshots]

**Additional Context:**
- User ID: HID-2026-12345
- Timestamp: 2026-02-16 10:30:00
- Error logs: [paste relevant logs]

**Possible Fix:**
[If you have suggestions]
```

---

## 📊 Test Coverage Report

### Target Coverage Goals
- **Unit Tests**: 80%+
- **Integration Tests**: 70%+
- **API Tests**: 90%+
- **Critical Paths**: 100%

### Generate Coverage Report

```bash
npm test -- --coverage --coverageReporters=html

# View report
open coverage/index.html
```

---

## 🔄 Continuous Testing

### GitHub Actions Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: test_health_id
        ports:
          - 3306:3306
        options: --health-cmd="mysqladmin ping" --health-interval=10s --health-timeout=5s --health-retries=3

    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
      env:
        DB_HOST: 127.0.0.1
        DB_USER: root
        DB_PASSWORD: root
        DB_NAME: test_health_id
    
    - name: Upload coverage
      uses: codecov/codecov-action@v2
```

---

## ✅ Pre-Deployment Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] Code coverage > 80%
- [ ] Security scan completed
- [ ] Performance benchmarks met
- [ ] UAT completed and signed off
- [ ] Database migrations tested
- [ ] Backup and restore tested
- [ ] Rollback plan documented
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] Documentation updated
- [ ] Change log updated

---

## 📞 Testing Support

**Questions or Issues?**
- Testing Team: testing@healthid.gov.in
- Bug Reports: bugs@healthid.gov.in
- Performance Issues: performance@healthid.gov.in

---

**Remember**: Testing is not just about finding bugs, it's about ensuring the system works reliably for millions of users! 🎯
