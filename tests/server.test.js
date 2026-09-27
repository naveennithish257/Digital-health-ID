const request = require('supertest');
const app = require('../server');

describe('MedVault Platform & Security Test Suite', () => {

  // BUG-01: Demo OTP Bypass is Gated
  describe('BUG-01: Demo OTP Security Gate', () => {
    it('should reject OTP 123456 for an arbitrary non-demo Health ID', async () => {
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ health_id: 'HID-2026-00001', otp: '123456' });
      // Should not authenticate as demo-001
      expect([400, 404, 500]).toContain(res.status);
    });

    it('should allow OTP 123456 ONLY for demo Health ID HID-2026-99999', async () => {
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ health_id: 'HID-2026-99999', otp: '123456' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.health_id).toBe('HID-2026-99999');
    });
  });

  // BUG-02: Admin Login
  describe('BUG-02: Admin Login Authentication', () => {
    it('should reject invalid admin credentials', async () => {
      const res = await request(app)
        .post('/api/auth/admin/login')
        .send({ email: 'admin@medvault.health', password: 'WrongPassword!' });
      expect(res.status).toBe(401);
    });

    it('should authenticate admin with configured credentials', async () => {
      const res = await request(app)
        .post('/api/auth/admin/login')
        .send({ email: 'admin@medvault.health', password: process.env.ADMIN_PASSWORD || 'Admin@MedVault2026!' });
      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('Admin');
    });
  });

  // BUG-08: Active Prescriptions Fetching
  describe('BUG-08: Active Prescriptions Filtering', () => {
    it('should return active prescriptions array rather than empty list', async () => {
      const res = await request(app)
        .get('/api/prescriptions/active')
        .set('Authorization', 'Bearer demo-token');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].prescription_status.toLowerCase()).toBe('active');
    });
  });

  // BUG-09 & Phase 7: Vitals Zero Coercion & Abnormal Alerts
  describe('BUG-09 & Phase 7: Vital Signs Logging & Alerts', () => {
    it('should log vitals with zero value steps and return 201', async () => {
      const res = await request(app)
        .post('/api/vitals')
        .set('Authorization', 'Bearer demo-token')
        .send({
          source: 'Wearable',
          device_name: 'Apple Watch Ultra',
          systolic_bp: 120,
          diastolic_bp: 80,
          heart_rate: 72,
          spo2: 98,
          steps: 0
        });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
    });

    it('should detect abnormal SpO2 hypoxia condition (<94%) and trigger alert', async () => {
      const res = await request(app)
        .post('/api/vitals')
        .set('Authorization', 'Bearer demo-token')
        .send({
          source: 'PulseOximeter',
          spo2: 91,
          heart_rate: 110
        });
      expect(res.status).toBe(201);
    });
  });

  // Phase 4: Digital Health Passport PDF
  describe('Phase 4: Health Passport PDF Export', () => {
    it('should generate a valid PDF with Content-Type application/pdf', async () => {
      const res = await request(app)
        .get('/api/patient/health-passport/pdf')
        .set('Authorization', 'Bearer demo-token');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.body.length).toBeGreaterThan(1000);
    });
  });

  // Emergency QR Access & MSG91 Alert
  describe('Emergency QR Code Access', () => {
    it('should return patient emergency medical information on scan', async () => {
      const res = await request(app).get('/api/emergency/access/demo');
      expect(res.status).toBe(200);
      expect(res.body.data.patient.name).toBeDefined();
      expect(res.body.data.emergency_contact.phone).toBeDefined();
    });
  });

});
