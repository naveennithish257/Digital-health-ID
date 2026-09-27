-- ============================================================
-- CENTRALIZED DIGITAL HEALTH ID SYSTEM - DATABASE SCHEMA
-- MySQL Database Design
-- ============================================================

-- Create Database
CREATE DATABASE IF NOT EXISTS health_id_system;
USE health_id_system;

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================

-- Patients Table
CREATE TABLE patients (
    patient_id VARCHAR(50) PRIMARY KEY,
    health_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    allergies TEXT,
    chronic_conditions TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relation VARCHAR(50),
    profile_photo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_health_id (health_id),
    INDEX idx_phone (phone_number),
    INDEX idx_email (email)
);

-- Doctors Table
CREATE TABLE doctors (
    doctor_id VARCHAR(50) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hospital_id VARCHAR(50),
    qualification TEXT,
    experience_years INT,
    profile_photo_url TEXT,
    digital_signature_url TEXT,
    verification_status ENUM('Pending', 'Verified', 'Rejected') DEFAULT 'Pending',
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_license (license_number),
    INDEX idx_specialization (specialization),
    INDEX idx_verification (verification_status)
);

-- Hospitals Table
CREATE TABLE hospitals (
    hospital_id VARCHAR(50) PRIMARY KEY,
    hospital_name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100) UNIQUE NOT NULL,
    hospital_type ENUM('Government', 'Private', 'Trust') NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    total_beds INT,
    emergency_services BOOLEAN DEFAULT TRUE,
    accreditation VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_city (city),
    INDEX idx_hospital_type (hospital_type)
);

-- Authentication Table
-- NOTE: phone_number is NOT UNIQUE here — a doctor and patient can share the same number
-- Uniqueness is enforced per (user_id, user_type) pair
CREATE TABLE authentication (
    auth_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    user_type ENUM('Patient', 'Doctor', 'Hospital', 'Admin') NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255),
    otp VARCHAR(10),
    otp_expiry TIMESTAMP,
    biometric_enabled BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    failed_login_attempts INT DEFAULT 0,
    account_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user (user_id, user_type),
    INDEX idx_phone (phone_number),
    INDEX idx_user_id (user_id)
);

-- Refresh Tokens Table (for secure logout + token rotation)
CREATE TABLE refresh_tokens (
    token_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    user_type ENUM('Patient', 'Doctor', 'Hospital', 'Admin') NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 of raw token
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_token_hash (token_hash)
);

-- ============================================================
-- MEDICAL RECORDS
-- ============================================================

-- Medical Records Table
CREATE TABLE medical_records (
    record_id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    doctor_id VARCHAR(50),
    hospital_id VARCHAR(50),
    record_type ENUM('Lab Report', 'X-Ray', 'MRI', 'CT Scan', 'Prescription', 
                     'Discharge Summary', 'Vaccination', 'Surgery', 'Other') NOT NULL,
    record_title VARCHAR(255) NOT NULL,
    record_date DATE NOT NULL,
    diagnosis TEXT,
    symptoms TEXT,
    treatment_plan TEXT,
    notes TEXT,
    file_url TEXT,
    file_type VARCHAR(20),
    file_size_kb INT,
    is_critical BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE SET NULL,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id) ON DELETE SET NULL,
    INDEX idx_patient (patient_id),
    INDEX idx_record_date (record_date),
    INDEX idx_record_type (record_type)
);

-- Lab Results Table
CREATE TABLE lab_results (
    result_id VARCHAR(50) PRIMARY KEY,
    record_id VARCHAR(50) NOT NULL,
    patient_id VARCHAR(50) NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    test_category VARCHAR(100),
    result_value VARCHAR(100),
    unit VARCHAR(50),
    reference_range VARCHAR(100),
    status ENUM('Normal', 'Abnormal', 'Critical') NOT NULL,
    tested_at TIMESTAMP NOT NULL,
    lab_name VARCHAR(255),
    technician_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES medical_records(record_id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    INDEX idx_patient (patient_id),
    INDEX idx_test_name (test_name)
);

-- ============================================================
-- PRESCRIPTIONS & MEDICATIONS
-- ============================================================

-- Prescriptions Table
CREATE TABLE prescriptions (
    prescription_id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    doctor_id VARCHAR(50) NOT NULL,
    hospital_id VARCHAR(50),
    visit_date DATE NOT NULL,
    diagnosis TEXT,
    symptoms TEXT,
    duration_days INT,
    follow_up_date DATE,
    special_instructions TEXT,
    prescription_status ENUM('Active', 'Completed', 'Cancelled') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id) ON DELETE SET NULL,
    INDEX idx_patient (patient_id),
    INDEX idx_doctor (doctor_id),
    INDEX idx_status (prescription_status)
);

-- Prescription Medications Table
CREATE TABLE prescription_medications (
    medication_id VARCHAR(50) PRIMARY KEY,
    prescription_id VARCHAR(50) NOT NULL,
    medicine_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration VARCHAR(100),
    timing VARCHAR(100),
    food_instruction ENUM('Before Food', 'After Food', 'With Food', 'Anytime'),
    quantity INT,
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(prescription_id) ON DELETE CASCADE,
    INDEX idx_prescription (prescription_id)
);

-- Medication Reminders Table
CREATE TABLE medication_reminders (
    reminder_id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    medication_id VARCHAR(50) NOT NULL,
    reminder_time TIME NOT NULL,
    days_of_week VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    last_reminded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES prescription_medications(medication_id) ON DELETE CASCADE,
    INDEX idx_patient (patient_id)
);

-- ============================================================
-- APPOINTMENTS
-- ============================================================

-- Appointments Table
CREATE TABLE appointments (
    appointment_id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    doctor_id VARCHAR(50) NOT NULL,
    hospital_id VARCHAR(50),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    appointment_type ENUM('Consultation', 'Follow-up', 'Emergency', 'Checkup') NOT NULL,
    reason TEXT,
    status ENUM('Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No-Show') DEFAULT 'Scheduled',
    consultation_fee DECIMAL(10, 2),
    payment_status ENUM('Pending', 'Paid', 'Refunded') DEFAULT 'Pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id) ON DELETE SET NULL,
    INDEX idx_patient (patient_id),
    INDEX idx_doctor (doctor_id),
    INDEX idx_appointment_date (appointment_date),
    INDEX idx_status (status)
);

-- ============================================================
-- INSURANCE
-- ============================================================

-- Insurance Providers Table
CREATE TABLE insurance_providers (
    provider_id VARCHAR(50) PRIMARY KEY,
    provider_name VARCHAR(255) NOT NULL,
    provider_code VARCHAR(50) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    website VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_provider_code (provider_code)
);

-- Patient Insurance Table
CREATE TABLE patient_insurance (
    insurance_id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    provider_id VARCHAR(50) NOT NULL,
    policy_number VARCHAR(100) UNIQUE NOT NULL,
    policy_holder_name VARCHAR(255) NOT NULL,
    policy_start_date DATE NOT NULL,
    policy_end_date DATE NOT NULL,
    coverage_amount DECIMAL(12, 2) NOT NULL,
    remaining_amount DECIMAL(12, 2),
    policy_type ENUM('Individual', 'Family', 'Group') NOT NULL,
    premium_amount DECIMAL(10, 2),
    premium_frequency ENUM('Monthly', 'Quarterly', 'Yearly'),
    policy_document_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES insurance_providers(provider_id) ON DELETE CASCADE,
    INDEX idx_patient (patient_id),
    INDEX idx_policy_number (policy_number)
);

-- Insurance Claims Table
CREATE TABLE insurance_claims (
    claim_id VARCHAR(50) PRIMARY KEY,
    insurance_id VARCHAR(50) NOT NULL,
    patient_id VARCHAR(50) NOT NULL,
    hospital_id VARCHAR(50),
    claim_amount DECIMAL(12, 2) NOT NULL,
    approved_amount DECIMAL(12, 2),
    claim_date DATE NOT NULL,
    treatment_date DATE NOT NULL,
    diagnosis TEXT NOT NULL,
    treatment_details TEXT,
    claim_status ENUM('Submitted', 'Under Review', 'Approved', 'Rejected', 'Settled') DEFAULT 'Submitted',
    rejection_reason TEXT,
    documents_url TEXT,
    settlement_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (insurance_id) REFERENCES patient_insurance(insurance_id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id) ON DELETE SET NULL,
    INDEX idx_patient (patient_id),
    INDEX idx_claim_status (claim_status)
);

-- ============================================================
-- ACCESS CONTROL & CONSENT
-- ============================================================

-- Patient Consent Table
CREATE TABLE patient_consent (
    consent_id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    accessor_id VARCHAR(50) NOT NULL,
    accessor_type ENUM('Doctor', 'Hospital', 'Emergency') NOT NULL,
    consent_type ENUM('Full Access', 'Partial Access', 'Emergency Access') NOT NULL,
    granted_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    purpose TEXT,
    records_accessible TEXT,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    INDEX idx_patient (patient_id),
    INDEX idx_accessor (accessor_id)
);

-- Access Logs Table
CREATE TABLE access_logs (
    log_id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    accessor_id VARCHAR(50) NOT NULL,
    accessor_type ENUM('Patient', 'Doctor', 'Hospital', 'Emergency', 'Admin') NOT NULL,
    action ENUM('View', 'Create', 'Update', 'Delete', 'Download') NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(50),
    ip_address VARCHAR(50),
    device_info TEXT,
    location VARCHAR(255),
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    INDEX idx_patient (patient_id),
    INDEX idx_accessed_at (accessed_at)
);

-- ============================================================
-- EMERGENCY ACCESS
-- ============================================================

-- Emergency Contacts Table
CREATE TABLE emergency_contacts (
    contact_id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    relation VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    alternate_phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    INDEX idx_patient (patient_id)
);

-- Emergency QR Codes Table (SECURE: token-based, no patient data in QR)
-- The QR encodes a URL with a raw token. Only the SHA-256 hash is stored.
CREATE TABLE emergency_qr_codes (
    qr_id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 of the raw token encoded in QR
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,
    last_used_at TIMESTAMP NULL,
    use_count INT DEFAULT 0,
    status ENUM('Active', 'Expired', 'Revoked') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    INDEX idx_patient (patient_id),
    INDEX idx_token_hash (token_hash),
    INDEX idx_status (status)
);

-- ============================================================
-- VACCINATIONS
-- ============================================================

-- Vaccinations Table
CREATE TABLE vaccinations (
    vaccination_id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    vaccine_name VARCHAR(255) NOT NULL,
    vaccine_type VARCHAR(100),
    dose_number INT,
    total_doses INT,
    administered_date DATE NOT NULL,
    next_dose_date DATE,
    administered_by VARCHAR(255),
    hospital_id VARCHAR(50),
    batch_number VARCHAR(100),
    manufacturer VARCHAR(255),
    site_of_injection VARCHAR(100),
    side_effects TEXT,
    certificate_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id) ON DELETE SET NULL,
    INDEX idx_patient (patient_id),
    INDEX idx_vaccine_name (vaccine_name)
);

-- ============================================================
-- HEALTH METRICS
-- ============================================================

-- Vital Signs Table
CREATE TABLE vital_signs (
    vital_id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    recorded_at TIMESTAMP NOT NULL,
    blood_pressure_systolic INT,
    blood_pressure_diastolic INT,
    heart_rate INT,
    temperature DECIMAL(4, 1),
    respiratory_rate INT,
    oxygen_saturation INT,
    blood_glucose DECIMAL(5, 2),
    weight DECIMAL(5, 2),
    height DECIMAL(5, 2),
    bmi DECIMAL(4, 2),
    recorded_by VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    INDEX idx_patient (patient_id),
    INDEX idx_recorded_at (recorded_at)
);

-- ============================================================
-- CHATBOT & AI ASSISTANCE
-- ============================================================

-- Chatbot Conversations Table
CREATE TABLE chatbot_conversations (
    conversation_id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    INDEX idx_patient (patient_id)
);

-- Chatbot Messages Table
CREATE TABLE chatbot_messages (
    message_id VARCHAR(50) PRIMARY KEY,
    conversation_id VARCHAR(50) NOT NULL,
    sender_type ENUM('Patient', 'Bot') NOT NULL,
    message_text TEXT NOT NULL,
    intent VARCHAR(100),
    confidence_score DECIMAL(3, 2),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES chatbot_conversations(conversation_id) ON DELETE CASCADE,
    INDEX idx_conversation (conversation_id)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

-- Notifications Table
CREATE TABLE notifications (
    notification_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    user_type ENUM('Patient', 'Doctor', 'Hospital') NOT NULL,
    notification_type ENUM('Appointment', 'Medication', 'Report Ready', 'Insurance', 'Emergency', 'General') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    priority ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_created_at (created_at)
);

-- ============================================================
-- AUDIT & COMPLIANCE
-- ============================================================

-- Data Encryption Keys Table (for end-to-end encryption)
CREATE TABLE encryption_keys (
    key_id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    public_key TEXT NOT NULL,
    key_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    INDEX idx_patient (patient_id)
);

-- System Audit Table
CREATE TABLE system_audit (
    audit_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    user_type VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id VARCHAR(50),
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- ============================================================
-- VIEWS FOR EASY DATA ACCESS
-- ============================================================

-- Patient Dashboard View
CREATE VIEW patient_dashboard AS
SELECT 
    p.patient_id,
    p.health_id,
    p.full_name,
    p.blood_group,
    COUNT(DISTINCT mr.record_id) as total_records,
    COUNT(DISTINCT pr.prescription_id) as total_prescriptions,
    COUNT(DISTINCT a.appointment_id) as total_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'Scheduled' THEN a.appointment_id END) as upcoming_appointments
FROM patients p
LEFT JOIN medical_records mr ON p.patient_id = mr.patient_id
LEFT JOIN prescriptions pr ON p.patient_id = pr.patient_id AND pr.prescription_status = 'Active'
LEFT JOIN appointments a ON p.patient_id = a.patient_id
WHERE p.is_active = TRUE
GROUP BY p.patient_id;

-- Doctor Patient List View
CREATE VIEW doctor_patient_list AS
SELECT 
    d.doctor_id,
    d.full_name as doctor_name,
    p.patient_id,
    p.health_id,
    p.full_name as patient_name,
    p.phone_number,
    MAX(a.appointment_date) as last_visit,
    COUNT(DISTINCT a.appointment_id) as total_visits
FROM doctors d
INNER JOIN appointments a ON d.doctor_id = a.doctor_id
INNER JOIN patients p ON a.patient_id = p.patient_id
WHERE d.is_active = TRUE AND p.is_active = TRUE
GROUP BY d.doctor_id, p.patient_id;

-- ============================================================
-- STORED PROCEDURES
-- ============================================================

DELIMITER //

-- Procedure to generate unique Health ID
CREATE PROCEDURE generate_health_id(OUT new_health_id VARCHAR(50))
BEGIN
    DECLARE year_part VARCHAR(4);
    DECLARE random_part VARCHAR(5);
    DECLARE id_exists INT;
    
    SET year_part = YEAR(CURRENT_DATE);
    
    REPEAT
        SET random_part = LPAD(FLOOR(10000 + RAND() * 90000), 5, '0');
        SET new_health_id = CONCAT('HID-', year_part, '-', random_part);
        
        SELECT COUNT(*) INTO id_exists FROM patients WHERE health_id = new_health_id;
    UNTIL id_exists = 0
    END REPEAT;
END //

-- Procedure to log access
CREATE PROCEDURE log_access(
    IN p_patient_id VARCHAR(50),
    IN p_accessor_id VARCHAR(50),
    IN p_accessor_type ENUM('Patient', 'Doctor', 'Hospital', 'Emergency', 'Admin'),
    IN p_action ENUM('View', 'Create', 'Update', 'Delete', 'Download'),
    IN p_resource_type VARCHAR(50),
    IN p_resource_id VARCHAR(50),
    IN p_ip_address VARCHAR(50)
)
BEGIN
    INSERT INTO access_logs (
        log_id, patient_id, accessor_id, accessor_type, action,
        resource_type, resource_id, ip_address
    ) VALUES (
        UUID(), p_patient_id, p_accessor_id, p_accessor_type, p_action,
        p_resource_type, p_resource_id, p_ip_address
    );
END //

-- Procedure to check consent
CREATE PROCEDURE check_consent(
    IN p_patient_id VARCHAR(50),
    IN p_accessor_id VARCHAR(50),
    OUT has_consent BOOLEAN
)
BEGIN
    SELECT COUNT(*) > 0 INTO has_consent
    FROM patient_consent
    WHERE patient_id = p_patient_id
    AND accessor_id = p_accessor_id
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW());
END //

DELIMITER ;

-- ============================================================
-- TRIGGERS
-- ============================================================

DELIMITER //

-- Trigger to update BMI automatically
CREATE TRIGGER calculate_bmi BEFORE INSERT ON vital_signs
FOR EACH ROW
BEGIN
    IF NEW.weight IS NOT NULL AND NEW.height IS NOT NULL AND NEW.height > 0 THEN
        SET NEW.bmi = NEW.weight / ((NEW.height / 100) * (NEW.height / 100));
    END IF;
END //

-- Trigger to send notification on new prescription
CREATE TRIGGER notify_new_prescription AFTER INSERT ON prescriptions
FOR EACH ROW
BEGIN
    INSERT INTO notifications (
        notification_id, user_id, user_type, notification_type,
        title, message, priority
    ) VALUES (
        UUID(), NEW.patient_id, 'Patient', 'Medication',
        'New Prescription Added',
        CONCAT('A new prescription has been added by your doctor. Valid for ', NEW.duration_days, ' days.'),
        'High'
    );
END //

-- Trigger to send reminder for upcoming appointments
CREATE TRIGGER notify_upcoming_appointment AFTER INSERT ON appointments
FOR EACH ROW
BEGIN
    INSERT INTO notifications (
        notification_id, user_id, user_type, notification_type,
        title, message, priority
    ) VALUES (
        UUID(), NEW.patient_id, 'Patient', 'Appointment',
        'Appointment Scheduled',
        CONCAT('Your appointment is scheduled for ', DATE_FORMAT(NEW.appointment_date, '%d %M %Y'), ' at ', TIME_FORMAT(NEW.appointment_time, '%h:%i %p')),
        'Medium'
    );
END //

DELIMITER ;

-- ============================================================
-- SAMPLE DATA INSERTION
-- ============================================================

-- Insert sample patient
INSERT INTO patients (
    patient_id, health_id, full_name, date_of_birth, gender, blood_group,
    phone_number, email, allergies, emergency_contact_name, emergency_contact_phone
) VALUES (
    'PAT001', 'HID-2026-12345', 'John Doe', '1990-01-15', 'Male', 'A+',
    '+919876543210', 'john.doe@email.com', 'Penicillin',
    'Jane Doe', '+919876500000'
);

-- Insert sample doctor
INSERT INTO doctors (
    doctor_id, full_name, specialization, license_number,
    phone_number, email, experience_years
) VALUES (
    'DOC001', 'Dr. Sarah Johnson', 'General Physician', 'MED-2020-12345',
    '+919876543211', 'dr.sarah@hospital.com', 10
);

-- Insert sample hospital
INSERT INTO hospitals (
    hospital_id, hospital_name, registration_number, hospital_type,
    phone_number, address, city, state, pincode, emergency_services
) VALUES (
    'HOS001', 'City General Hospital', 'HOSP-2010-001', 'Private',
    '+911234567890', '123 Main Street', 'Mumbai', 'Maharashtra', '400001', TRUE
);

-- Grant consent example
INSERT INTO patient_consent (
    consent_id, patient_id, accessor_id, accessor_type, consent_type,
    granted_at, purpose
) VALUES (
    'CON001', 'PAT001', 'DOC001', 'Doctor', 'Full Access',
    NOW(), 'Regular checkup and treatment'
);

-- ============================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================

-- Additional composite indexes
CREATE INDEX idx_patient_date ON medical_records(patient_id, record_date);
CREATE INDEX idx_appointment_date_status ON appointments(appointment_date, status);
CREATE INDEX idx_prescription_patient_status ON prescriptions(patient_id, prescription_status);

-- Full-text search indexes
ALTER TABLE patients ADD FULLTEXT INDEX ft_patient_name (full_name);
ALTER TABLE doctors ADD FULLTEXT INDEX ft_doctor_name (full_name);
ALTER TABLE hospitals ADD FULLTEXT INDEX ft_hospital_name (hospital_name);

-- ============================================================
-- BACKUP AND SECURITY RECOMMENDATIONS
-- ============================================================

/*
RECOMMENDED SECURITY MEASURES:

1. DATABASE ENCRYPTION:
   - Enable MySQL encryption at rest
   - Use SSL/TLS for connections
   
2. USER ROLES AND PERMISSIONS:
   - Create separate users for different access levels
   - Use principle of least privilege
   
3. BACKUP STRATEGY:
   - Daily automated backups
   - Replicate to multiple geographic locations
   - Test restore procedures regularly
   
4. COMPLIANCE:
   - HIPAA compliance for health data
   - GDPR compliance for EU users
   - Regular security audits
   
5. DATA RETENTION:
   - Archive old records after 7 years
   - Implement soft delete with retention period
   
6. MONITORING:
   - Set up alerts for suspicious activities
   - Monitor access logs regularly
   - Track failed login attempts
*/

-- ============================================================
-- VITAL SIGNS (Wearable & Manual)
-- ============================================================

CREATE TABLE IF NOT EXISTS vital_signs (
    vital_id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source ENUM('Manual','Bluetooth','GoogleFit','AppleHealth','Fitbit','Garmin','Samsung') DEFAULT 'Manual',
    device_name VARCHAR(100),
    -- Cardiovascular
    systolic_bp SMALLINT UNSIGNED,
    diastolic_bp SMALLINT UNSIGNED,
    heart_rate SMALLINT UNSIGNED,
    -- Metabolic
    blood_glucose DECIMAL(5,1),
    glucose_type ENUM('Fasting','Post-meal','Random') DEFAULT 'Random',
    -- Respiratory
    spo2 TINYINT UNSIGNED,
    respiratory_rate TINYINT UNSIGNED,
    -- Physical
    weight_kg DECIMAL(5,2),
    height_cm DECIMAL(5,1),
    bmi DECIMAL(4,1),
    temperature_c DECIMAL(4,1),
    -- Steps / Activity
    steps INT UNSIGNED,
    calories_burned INT UNSIGNED,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    INDEX idx_vital_patient (patient_id),
    INDEX idx_vital_recorded (recorded_at)
);

-- ============================================================
-- END OF SCHEMA
-- ============================================================
