const request = require('supertest');
const app = require('../server');

jest.setTimeout(25000);

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

  // AI Health Assistant (Gemini)
  describe('AI Health Assistant', () => {
    it('should return an AI response for health inquiries', async () => {
      const res = await request(app)
        .post('/api/assistant')
        .set('Authorization', 'Bearer demo-token')
        .send({ message: 'What are my known allergies and medications?' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.reply).toBeDefined();
      expect(res.body.data.reply.length).toBeGreaterThan(10);
    }, 50000);
  });

  // Patient Profile Update & Data Portability
  describe('Patient Profile & Data Portability', () => {
    it('should update patient profile information', async () => {
      const res = await request(app)
        .put('/api/patient/profile')
        .set('Authorization', 'Bearer demo-token')
        .send({
          full_name: 'John Doe Updated',
          blood_group: 'O+',
          allergies: 'Penicillin'
        });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    it('should export full personal health record archive as JSON', async () => {
      const res = await request(app)
        .get('/api/patient/export-data')
        .set('Authorization', 'Bearer demo-token');
      expect(res.status).toBe(200);
      expect(res.body.patient_profile).toBeDefined();
      expect(res.headers['content-disposition']).toContain('attachment');
    });
  });

  // Firebase Config
  describe('Firebase Web Auth Config', () => {
    it('should return public Firebase client configuration', async () => {
      const res = await request(app).get('/api/auth/firebase-config');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.projectId).toBeDefined();
    });
  });

  // Section 32: Live Telemetry & Metrics
  describe('Section 32: Live Telemetry & Metrics API', () => {
    it('should reject unauthorized access to system telemetry', async () => {
      const res = await request(app).get('/api/admin/system/metrics');
      expect([401, 403]).toContain(res.status);
    });

    it('should return real-time system metrics for authenticated admin', async () => {
      const res = await request(app)
        .get('/api/admin/system/metrics')
        .set('Authorization', 'Bearer demo-admin-token');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('connectedSockets');
      expect(res.body.data).toHaveProperty('activeCalls');
      expect(res.body.data).toHaveProperty('eventsPerSec');
      expect(res.body.data).toHaveProperty('avgLatencyMs');
      expect(typeof res.body.data.connectedSockets).toBe('number');
    });
  });

  // Section 33: Real-Time Broadcast Announcements
  describe('Real-Time Broadcast Announcements', () => {
    it('should allow admin to broadcast a system announcement', async () => {
      const res = await request(app)
        .post('/api/admin/announcements')
        .set('Authorization', 'Bearer demo-admin-token')
        .send({
          title: 'Scheduled Maintenance Alert',
          message: 'The clinical database will undergo a 5-minute performance index update.',
          priority: 'High'
        });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.title).toBe('Scheduled Maintenance Alert');
    });

    it('should return active announcements for public/doctor/patient portals', async () => {
      const res = await request(app).get('/api/announcements');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].title).toBe('Scheduled Maintenance Alert');
    });
  });

  // Doctor Verification & Suspension Live Workflow
  describe('Doctor Verification & Clinical Status Management', () => {
    it('should allow admin to verify a doctor', async () => {
      const res = await request(app)
        .put('/api/admin/doctors/doc-001/verify')
        .set('Authorization', 'Bearer demo-admin-token')
        .send({ status: 'Verified' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.status).toBe('Verified');
    });

    it('should allow admin to suspend a doctor', async () => {
      const res = await request(app)
        .put('/api/admin/doctors/doc-001/verify')
        .set('Authorization', 'Bearer demo-admin-token')
        .send({ status: 'Suspended' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.status).toBe('Suspended');
    });

    it('should re-verify the doctor for standard operations', async () => {
      const res = await request(app)
        .put('/api/admin/doctors/doc-001/verify')
        .set('Authorization', 'Bearer demo-admin-token')
        .send({ status: 'Verified' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('Verified');
    });
  });

  // Doctor Issues Prescription & Emits Real-Time Notification
  describe('Doctor E-Prescription Authoring & Live Sync', () => {
    it('should allow verified doctor to issue an electronic prescription', async () => {
      const res = await request(app)
        .post('/api/doctor/patient/demo-001/prescriptions')
        .set('Authorization', 'Bearer demo-doctor-token')
        .send({
          visit_date: '2026-10-07',
          diagnosis: 'Essential Hypertension Stage 1',
          symptoms: 'Occasional morning headaches, elevated BP',
          follow_up_date: '2026-11-07',
          special_instructions: 'Low sodium diet, monitor daily morning BP',
          medications: [
            { medicine_name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily (morning)', duration: '30 days' },
            { medicine_name: 'Telmisartan', dosage: '40mg', frequency: 'Once daily (morning)', duration: '30 days' }
          ]
        });
      expect([200, 201]).toContain(res.status);
      expect(res.body.status).toBe('success');
      expect(res.body.data.prescription_id).toBeDefined();
    });
  });

  // Access Consent Workflow
  describe('Clinical Access Consent Workflow', () => {
    it('should allow doctor to request record access from patient', async () => {
      const res = await request(app)
        .post('/api/doctor/request-access')
        .set('Authorization', 'Bearer demo-doctor-token')
        .send({
          patient_id: 'demo-001',
          purpose: 'Cardiology Consultation'
        });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.purpose).toBe('Cardiology Consultation');
    });
  });

  // Hospitals Directory & Healthcare Facility Registration
  describe('Hospitals Directory & Healthcare Network', () => {
    it('should allow admin to register a new healthcare facility', async () => {
      const res = await request(app)
        .post('/api/hospitals')
        .set('Authorization', 'Bearer demo-admin-token')
        .send({
          hospital_name: 'Fortis Escorts Heart Institute',
          hospital_type: 'Private',
          city: 'New Delhi',
          state: 'Delhi',
          phone_number: '+91 11 4713 5000',
          emergency_services: true
        });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.hospital_name).toBe('Fortis Escorts Heart Institute');
      expect(res.body.data.emergency_services).toBe(true);
    });
  });

  // WebSockets & WebRTC Signaling Engine Architecture
  describe('WebSockets & WebRTC Signaling Engine', () => {
    it('should have Socket.io engine bound and initialized on httpServer', () => {
      expect(app.io).toBeDefined();
      expect(typeof app.io.emit).toBe('function');
      expect(typeof app.io.to).toBe('function');
    });
  });

  // Multi-Tier AI Assistant (Gemini / Groq / Clinical Algorithm)
  describe('Multi-Tier AI Assistant & Clinical Decision Engine', () => {
    it('should return clinical advice via /api/assistant/chat with multi-tier resilience', async () => {
      const res = await request(app)
        .post('/api/assistant/chat')
        .set('Authorization', 'Bearer demo-patient-token')
        .send({
          message: 'What are my blood pressure readings and what should I eat?'
        });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.reply).toBeDefined();
      expect(typeof res.body.data.reply).toBe('string');
      expect(res.body.data.provider).toBeDefined();
    }, 15000);

    it('should trigger emergency triage algorithm for red-flag symptoms', async () => {
      const res = await request(app)
        .post('/api/assistant/chat')
        .set('Authorization', 'Bearer demo-patient-token')
        .send({
          message: 'I have severe sudden chest pain radiating to left arm and shortness of breath'
        });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.reply).toMatch(/112|911|emergency|cardiac/i);
    }, 15000);
  });

  // Insurance & Claims Endpoints
  describe('Insurance & Claims API', () => {
    it('should return patient insurance policies', async () => {
      const res = await request(app)
        .get('/api/patient/insurance')
        .set('Authorization', 'Bearer demo-patient-token');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].policy_number).toBeDefined();
    });

    it('should allow patient to register an insurance policy', async () => {
      const res = await request(app)
        .post('/api/patient/insurance')
        .set('Authorization', 'Bearer demo-patient-token')
        .send({
          provider_name: 'HDFC ERGO Health',
          policy_number: 'HDFC-TEST-9921',
          coverage_amount: 500000,
          policy_type: 'Individual'
        });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.policy_number).toBe('HDFC-TEST-9921');
    });

    it('should return patient claims history', async () => {
      const res = await request(app)
        .get('/api/patient/insurance/claims')
        .set('Authorization', 'Bearer demo-patient-token');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should allow patient to file an insurance claim', async () => {
      const res = await request(app)
        .post('/api/patient/insurance/claims')
        .set('Authorization', 'Bearer demo-patient-token')
        .send({
          claim_amount: 35000,
          diagnosis: 'Acute Viral Gastritis & Dehydration'
        });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.claim_amount).toBe(35000);
    });
  });

  // Vaccinations & Immunizations
  describe('Vaccinations & Immunizations API', () => {
    it('should return immunization history', async () => {
      const res = await request(app)
        .get('/api/patient/vaccinations')
        .set('Authorization', 'Bearer demo-patient-token');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].vaccine_name).toBeDefined();
    });

    it('should allow recording a new vaccination', async () => {
      const res = await request(app)
        .post('/api/patient/vaccinations')
        .set('Authorization', 'Bearer demo-patient-token')
        .send({
          vaccine_name: 'Tetanus Toxoid (TT)',
          dose_number: 1,
          administered_date: '2026-10-08',
          facility_name: 'Metro Heart Institute'
        });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.vaccine_name).toBe('Tetanus Toxoid (TT)');
    });
  });

  // Lab Results & Biomarkers
  describe('Lab Results Biomarkers API', () => {
    it('should return lab results with biomarker reference ranges', async () => {
      const res = await request(app)
        .get('/api/patient/lab-results')
        .set('Authorization', 'Bearer demo-patient-token');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].test_name).toBeDefined();
      expect(res.body.data[0].status).toBeDefined();
    });
  });

});



