# Digital Health ID System - Backend API Documentation

## 🔌 API Overview

Base URL: `https://api.healthid.gov.in/v1`

Authentication: JWT Bearer Token + OTP Verification

Rate Limiting: 1000 requests per hour per user

## 📋 Table of Contents

1. [Authentication APIs](#authentication-apis)
2. [Patient APIs](#patient-apis)
3. [Medical Records APIs](#medical-records-apis)
4. [Prescription APIs](#prescription-apis)
5. [Appointment APIs](#appointment-apis)
6. [Insurance APIs](#insurance-apis)
7. [Emergency APIs](#emergency-apis)
8. [Doctor APIs](#doctor-apis)
9. [Hospital APIs](#hospital-apis)
10. [Chatbot APIs](#chatbot-apis)

---

## Authentication APIs

### 1. Patient Registration
**Endpoint:** `POST /auth/register`

**Request Body:**
```json
{
  "full_name": "John Doe",
  "date_of_birth": "1990-01-15",
  "gender": "Male",
  "blood_group": "A+",
  "phone_number": "+919876543210",
  "email": "john.doe@email.com",
  "address": "123 Main Street",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "allergies": "Penicillin",
  "chronic_conditions": "None",
  "emergency_contact_name": "Jane Doe",
  "emergency_contact_phone": "+919876500000",
  "emergency_contact_relation": "Spouse"
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "Registration successful. OTP sent to phone.",
  "data": {
    "patient_id": "PAT001",
    "health_id": "HID-2026-12345",
    "otp_expiry": "2026-02-16T10:15:00Z"
  }
}
```

### 2. Send OTP
**Endpoint:** `POST /auth/send-otp`

**Request Body:**
```json
{
  "health_id": "HID-2026-12345",
  "phone_number": "+919876543210"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "OTP sent successfully",
  "data": {
    "otp_expiry": "2026-02-16T10:15:00Z",
    "resend_allowed_after": "2026-02-16T10:11:00Z"
  }
}
```

### 3. Verify OTP & Login
**Endpoint:** `POST /auth/verify-otp`

**Request Body:**
```json
{
  "health_id": "HID-2026-12345",
  "otp": "123456"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": {
      "patient_id": "PAT001",
      "health_id": "HID-2026-12345",
      "full_name": "John Doe",
      "blood_group": "A+"
    }
  }
}
```

### 4. Biometric Authentication
**Endpoint:** `POST /auth/biometric`

**Request Body:**
```json
{
  "health_id": "HID-2026-12345",
  "biometric_data": "base64_encoded_fingerprint_or_face_data",
  "biometric_type": "fingerprint"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Biometric authentication successful",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}
```

### 5. Refresh Token
**Endpoint:** `POST /auth/refresh`

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "access_token": "new_access_token",
    "expires_in": 3600
  }
}
```

### 6. Logout
**Endpoint:** `POST /auth/logout`

**Headers:** `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Logged out successfully"
}
```

---

## Patient APIs

### 1. Get Patient Profile
**Endpoint:** `GET /patients/{health_id}`

**Headers:** `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "patient_id": "PAT001",
    "health_id": "HID-2026-12345",
    "full_name": "John Doe",
    "date_of_birth": "1990-01-15",
    "age": 36,
    "gender": "Male",
    "blood_group": "A+",
    "phone_number": "+919876543210",
    "email": "john.doe@email.com",
    "address": "123 Main Street, Mumbai, Maharashtra, 400001",
    "allergies": ["Penicillin"],
    "chronic_conditions": ["None"],
    "emergency_contact": {
      "name": "Jane Doe",
      "phone": "+919876500000",
      "relation": "Spouse"
    },
    "profile_photo_url": "https://storage.healthid.gov.in/photos/PAT001.jpg",
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-02-15T10:30:00Z"
  }
}
```

### 2. Update Patient Profile
**Endpoint:** `PUT /patients/{health_id}`

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "email": "newemail@email.com",
  "address": "New Address",
  "phone_number": "+919876543211",
  "allergies": "Penicillin, Peanuts",
  "emergency_contact_name": "Jane Doe",
  "emergency_contact_phone": "+919876500000"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Profile updated successfully",
  "data": { ... }
}
```

### 3. Get Patient Dashboard
**Endpoint:** `GET /patients/{health_id}/dashboard`

**Headers:** `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "patient_info": { ... },
    "statistics": {
      "total_records": 12,
      "active_prescriptions": 5,
      "total_appointments": 18,
      "upcoming_appointments": 3,
      "insurance_policies": 1
    },
    "recent_activities": [
      {
        "activity_type": "checkup",
        "title": "General Checkup",
        "hospital": "City Hospital",
        "date": "2026-02-14",
        "status": "Completed"
      },
      {
        "activity_type": "lab_report",
        "title": "Blood Test Report",
        "hospital": "MedLab Diagnostics",
        "date": "2026-02-12",
        "status": "Available"
      }
    ],
    "upcoming_appointments": [
      {
        "appointment_id": "APT001",
        "doctor_name": "Dr. Sarah Johnson",
        "specialization": "General Physician",
        "date": "2026-02-20",
        "time": "10:00 AM",
        "hospital": "City Hospital",
        "status": "Confirmed"
      }
    ]
  }
}
```

### 4. Upload Profile Photo
**Endpoint:** `POST /patients/{health_id}/photo`

**Headers:** 
- `Authorization: Bearer {token}`
- `Content-Type: multipart/form-data`

**Request Body:**
```
photo: [file]
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Photo uploaded successfully",
  "data": {
    "photo_url": "https://storage.healthid.gov.in/photos/PAT001.jpg"
  }
}
```

---

## Medical Records APIs

### 1. Get All Medical Records
**Endpoint:** `GET /patients/{health_id}/records`

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `record_type` (optional): Filter by type (Lab Report, X-Ray, etc.)
- `from_date` (optional): Start date (YYYY-MM-DD)
- `to_date` (optional): End date (YYYY-MM-DD)
- `page` (default: 1)
- `limit` (default: 20)

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "records": [
      {
        "record_id": "REC001",
        "record_type": "Lab Report",
        "record_title": "Complete Blood Count",
        "record_date": "2026-02-12",
        "hospital_name": "MedLab Diagnostics",
        "doctor_name": "Dr. Michael Chen",
        "diagnosis": "Normal CBC values",
        "file_url": "https://storage.healthid.gov.in/records/REC001.pdf",
        "file_type": "PDF",
        "file_size_kb": 2304,
        "is_critical": false,
        "created_at": "2026-02-12T14:30:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 3,
      "total_records": 12,
      "records_per_page": 20
    }
  }
}
```

### 2. Get Single Medical Record
**Endpoint:** `GET /patients/{health_id}/records/{record_id}`

**Headers:** `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "record_id": "REC001",
    "record_type": "Lab Report",
    "record_title": "Complete Blood Count",
    "record_date": "2026-02-12",
    "hospital": {
      "hospital_id": "HOS001",
      "name": "MedLab Diagnostics",
      "address": "456 Lab Street, Mumbai"
    },
    "doctor": {
      "doctor_id": "DOC002",
      "name": "Dr. Michael Chen",
      "specialization": "Pathologist"
    },
    "diagnosis": "Normal CBC values",
    "symptoms": "Routine checkup",
    "treatment_plan": "No treatment required",
    "notes": "All parameters within normal range",
    "lab_results": [
      {
        "test_name": "Hemoglobin",
        "result_value": "14.5",
        "unit": "g/dL",
        "reference_range": "13.5-17.5",
        "status": "Normal"
      },
      {
        "test_name": "WBC Count",
        "result_value": "7200",
        "unit": "/µL",
        "reference_range": "4000-11000",
        "status": "Normal"
      }
    ],
    "file_url": "https://storage.healthid.gov.in/records/REC001.pdf",
    "file_type": "PDF",
    "file_size_kb": 2304,
    "is_critical": false,
    "created_at": "2026-02-12T14:30:00Z",
    "updated_at": "2026-02-12T14:30:00Z"
  }
}
```

### 3. Upload Medical Record
**Endpoint:** `POST /patients/{health_id}/records`

**Headers:** 
- `Authorization: Bearer {token}`
- `Content-Type: multipart/form-data`

**Request Body:**
```
record_type: "Lab Report"
record_title: "Blood Test Report"
record_date: "2026-02-16"
hospital_id: "HOS001"
doctor_id: "DOC001"
diagnosis: "Normal results"
file: [file]
```

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "Record uploaded successfully",
  "data": {
    "record_id": "REC002",
    "record_title": "Blood Test Report",
    "file_url": "https://storage.healthid.gov.in/records/REC002.pdf"
  }
}
```

### 4. Delete Medical Record
**Endpoint:** `DELETE /patients/{health_id}/records/{record_id}`

**Headers:** `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Record deleted successfully"
}
```

### 5. Download Medical Record
**Endpoint:** `GET /patients/{health_id}/records/{record_id}/download`

**Headers:** `Authorization: Bearer {token}`

**Response:** Binary file download

---

## Prescription APIs

### 1. Get All Prescriptions
**Endpoint:** `GET /patients/{health_id}/prescriptions`

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `status` (optional): active, completed, cancelled
- `page` (default: 1)
- `limit` (default: 20)

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "prescriptions": [
      {
        "prescription_id": "PRE001",
        "doctor": {
          "doctor_id": "DOC001",
          "name": "Dr. Sarah Johnson",
          "specialization": "General Physician"
        },
        "hospital": {
          "hospital_id": "HOS001",
          "name": "City Hospital"
        },
        "visit_date": "2026-02-10",
        "diagnosis": "Common Cold",
        "symptoms": "Fever, Cough, Sore throat",
        "duration_days": 7,
        "follow_up_date": "2026-02-17",
        "prescription_status": "Active",
        "medications": [
          {
            "medication_id": "MED001",
            "medicine_name": "Paracetamol 500mg",
            "dosage": "500mg",
            "frequency": "3 times daily",
            "duration": "7 days",
            "timing": "After meals",
            "food_instruction": "After Food",
            "quantity": 21
          }
        ],
        "special_instructions": "Plenty of fluids and rest",
        "created_at": "2026-02-10T11:00:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

### 2. Get Single Prescription
**Endpoint:** `GET /patients/{health_id}/prescriptions/{prescription_id}`

**Headers:** `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "prescription_id": "PRE001",
    "patient": { ... },
    "doctor": { ... },
    "hospital": { ... },
    "visit_date": "2026-02-10",
    "diagnosis": "Common Cold",
    "symptoms": "Fever, Cough, Sore throat",
    "duration_days": 7,
    "follow_up_date": "2026-02-17",
    "medications": [ ... ],
    "special_instructions": "Plenty of fluids and rest",
    "prescription_status": "Active",
    "digital_signature_url": "https://storage.healthid.gov.in/signatures/DOC001.png",
    "created_at": "2026-02-10T11:00:00Z"
  }
}
```

### 3. Set Medication Reminder
**Endpoint:** `POST /patients/{health_id}/prescriptions/{prescription_id}/reminders`

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "medication_id": "MED001",
  "reminder_times": ["08:00", "14:00", "20:00"],
  "days_of_week": "Mon,Tue,Wed,Thu,Fri,Sat,Sun"
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "Reminders set successfully",
  "data": {
    "reminders": [
      {
        "reminder_id": "REM001",
        "reminder_time": "08:00",
        "is_active": true
      }
    ]
  }
}
```

---

## Appointment APIs

### 1. Get All Appointments
**Endpoint:** `GET /patients/{health_id}/appointments`

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `status` (optional): scheduled, confirmed, completed, cancelled
- `from_date` (optional)
- `to_date` (optional)

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "appointments": [
      {
        "appointment_id": "APT001",
        "doctor": {
          "doctor_id": "DOC001",
          "name": "Dr. Sarah Johnson",
          "specialization": "General Physician",
          "consultation_fee": 500
        },
        "hospital": {
          "hospital_id": "HOS001",
          "name": "City Hospital",
          "address": "123 Main Street, Mumbai"
        },
        "appointment_date": "2026-02-20",
        "appointment_time": "10:00",
        "appointment_type": "Consultation",
        "reason": "Regular checkup",
        "status": "Scheduled",
        "payment_status": "Pending",
        "created_at": "2026-02-16T09:00:00Z"
      }
    ]
  }
}
```

### 2. Book Appointment
**Endpoint:** `POST /patients/{health_id}/appointments`

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "doctor_id": "DOC001",
  "hospital_id": "HOS001",
  "appointment_date": "2026-02-20",
  "appointment_time": "10:00",
  "appointment_type": "Consultation",
  "reason": "Regular checkup"
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "Appointment booked successfully",
  "data": {
    "appointment_id": "APT002",
    "appointment_date": "2026-02-20",
    "appointment_time": "10:00",
    "status": "Scheduled",
    "payment_required": 500
  }
}
```

### 3. Cancel Appointment
**Endpoint:** `PUT /patients/{health_id}/appointments/{appointment_id}/cancel`

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "cancellation_reason": "Schedule conflict"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Appointment cancelled successfully",
  "data": {
    "appointment_id": "APT001",
    "status": "Cancelled",
    "refund_status": "Initiated"
  }
}
```

---

## Insurance APIs

### 1. Get Insurance Policies
**Endpoint:** `GET /patients/{health_id}/insurance`

**Headers:** `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "policies": [
      {
        "insurance_id": "INS001",
        "provider": {
          "provider_id": "PRO001",
          "name": "Star Health Insurance",
          "phone": "+911234567890"
        },
        "policy_number": "STAR2026001",
        "policy_holder_name": "John Doe",
        "policy_start_date": "2026-01-01",
        "policy_end_date": "2026-12-31",
        "coverage_amount": 500000,
        "remaining_amount": 450000,
        "policy_type": "Individual",
        "premium_amount": 12000,
        "premium_frequency": "Yearly",
        "is_active": true
      }
    ]
  }
}
```

### 2. Submit Insurance Claim
**Endpoint:** `POST /patients/{health_id}/insurance/{insurance_id}/claims`

**Headers:** 
- `Authorization: Bearer {token}`
- `Content-Type: multipart/form-data`

**Request Body:**
```
hospital_id: "HOS001"
claim_amount: 25000
treatment_date: "2026-02-15"
diagnosis: "Appendicitis Surgery"
treatment_details: "Emergency appendectomy performed"
documents: [files]
```

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "Claim submitted successfully",
  "data": {
    "claim_id": "CLM001",
    "claim_amount": 25000,
    "claim_status": "Submitted",
    "reference_number": "CLM2026001"
  }
}
```

### 3. Track Claim Status
**Endpoint:** `GET /patients/{health_id}/insurance/claims/{claim_id}`

**Headers:** `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "claim_id": "CLM001",
    "claim_amount": 25000,
    "approved_amount": 23000,
    "claim_status": "Approved",
    "submission_date": "2026-02-16",
    "approval_date": "2026-02-18",
    "expected_settlement_date": "2026-02-25",
    "status_history": [
      {
        "status": "Submitted",
        "timestamp": "2026-02-16T10:00:00Z"
      },
      {
        "status": "Under Review",
        "timestamp": "2026-02-17T09:00:00Z"
      },
      {
        "status": "Approved",
        "timestamp": "2026-02-18T14:30:00Z"
      }
    ]
  }
}
```

---

## Emergency APIs

### 1. Generate Emergency QR Code
**Endpoint:** `POST /patients/{health_id}/emergency/qr-code`

**Headers:** `Authorization: Bearer {token}`

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "Emergency QR code generated",
  "data": {
    "qr_id": "QR001",
    "qr_code_data": "encrypted_data_string",
    "qr_image_url": "https://storage.healthid.gov.in/qr/QR001.png",
    "generated_at": "2026-02-16T10:00:00Z",
    "expires_at": "2026-08-16T10:00:00Z"
  }
}
```

### 2. Scan Emergency QR Code
**Endpoint:** `POST /emergency/scan`

**Request Body:**
```json
{
  "qr_code_data": "encrypted_data_string",
  "scanner_id": "EMG001",
  "scanner_type": "Hospital",
  "location": {
    "latitude": 19.0760,
    "longitude": 72.8777
  }
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "patient": {
      "health_id": "HID-2026-12345",
      "full_name": "John Doe",
      "age": 36,
      "gender": "Male",
      "blood_group": "A+",
      "photo_url": "https://storage.healthid.gov.in/photos/PAT001.jpg"
    },
    "critical_info": {
      "allergies": ["Penicillin"],
      "chronic_conditions": ["Diabetes Type 2"],
      "current_medications": [
        {
          "medicine_name": "Metformin 850mg",
          "dosage": "2 times daily"
        }
      ],
      "emergency_contacts": [
        {
          "name": "Jane Doe",
          "relation": "Spouse",
          "phone": "+919876500000"
        }
      ]
    },
    "recent_vitals": {
      "blood_pressure": "120/80",
      "heart_rate": 75,
      "last_recorded": "2026-02-15T08:00:00Z"
    }
  }
}
```

### 3. Log Emergency Access
**Endpoint:** `POST /emergency/access-log`

**Request Body:**
```json
{
  "health_id": "HID-2026-12345",
  "accessor_id": "EMG001",
  "accessor_type": "Hospital",
  "reason": "Emergency treatment - accident",
  "location": "City Hospital Emergency Ward"
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "Emergency access logged",
  "data": {
    "log_id": "LOG001",
    "notification_sent": true
  }
}
```

---

## Doctor APIs

### 1. Doctor Login
**Endpoint:** `POST /doctors/login`

**Request Body:**
```json
{
  "license_number": "MED-2020-12345",
  "password": "secure_password"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "access_token": "jwt_token",
    "doctor": {
      "doctor_id": "DOC001",
      "full_name": "Dr. Sarah Johnson",
      "specialization": "General Physician"
    }
  }
}
```

### 2. Request Patient Access
**Endpoint:** `POST /doctors/{doctor_id}/request-access`

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "health_id": "HID-2026-12345",
  "consent_type": "Full Access",
  "purpose": "Treatment for fever and cough",
  "duration_days": 30
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "Access request sent to patient",
  "data": {
    "consent_id": "CON001",
    "status": "Pending",
    "notification_sent": true
  }
}
```

### 3. Get Patient Records (with consent)
**Endpoint:** `GET /doctors/{doctor_id}/patients/{health_id}/records`

**Headers:** `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "patient": { ... },
    "records": [ ... ],
    "prescriptions": [ ... ],
    "vitals": [ ... ],
    "consent_info": {
      "consent_id": "CON001",
      "consent_type": "Full Access",
      "expires_at": "2026-03-16T10:00:00Z"
    }
  }
}
```

### 4. Create Prescription
**Endpoint:** `POST /doctors/{doctor_id}/prescriptions`

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "health_id": "HID-2026-12345",
  "hospital_id": "HOS001",
  "diagnosis": "Common Cold",
  "symptoms": "Fever, Cough, Sore throat",
  "duration_days": 7,
  "follow_up_date": "2026-02-24",
  "medications": [
    {
      "medicine_name": "Paracetamol 500mg",
      "dosage": "500mg",
      "frequency": "3 times daily",
      "duration": "7 days",
      "timing": "After meals",
      "food_instruction": "After Food",
      "quantity": 21,
      "instructions": "Take with warm water"
    }
  ],
  "special_instructions": "Plenty of fluids and rest"
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "Prescription created successfully",
  "data": {
    "prescription_id": "PRE002",
    "created_at": "2026-02-16T11:00:00Z",
    "digital_signature_applied": true
  }
}
```

---

## Hospital APIs

### 1. Hospital Login
**Endpoint:** `POST /hospitals/login`

**Request Body:**
```json
{
  "registration_number": "HOSP-2010-001",
  "password": "secure_password"
}
```

### 2. Register Patient Visit
**Endpoint:** `POST /hospitals/{hospital_id}/visits`

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "health_id": "HID-2026-12345",
  "doctor_id": "DOC001",
  "visit_type": "OPD",
  "visit_date": "2026-02-16",
  "reason": "Follow-up consultation"
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "Patient visit registered",
  "data": {
    "visit_id": "VIS001",
    "token_number": "OPD-125"
  }
}
```

### 3. Upload Lab Results
**Endpoint:** `POST /hospitals/{hospital_id}/lab-results`

**Headers:** 
- `Authorization: Bearer {token}`
- `Content-Type: multipart/form-data`

**Request Body:**
```
health_id: "HID-2026-12345"
test_name: "Complete Blood Count"
results: [file]
test_date: "2026-02-16"
```

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "Lab results uploaded successfully",
  "data": {
    "result_id": "LAB001",
    "patient_notified": true
  }
}
```

---

## Chatbot APIs

### 1. Start Conversation
**Endpoint:** `POST /chatbot/conversations`

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "health_id": "HID-2026-12345"
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "conversation_id": "CONV001",
    "greeting": "Hello! I'm your AI health assistant. How can I help you today?"
  }
}
```

### 2. Send Message
**Endpoint:** `POST /chatbot/conversations/{conversation_id}/messages`

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "message": "What is my blood pressure reading from yesterday?"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "message_id": "MSG001",
    "user_message": "What is my blood pressure reading from yesterday?",
    "bot_response": "According to your records, your blood pressure yesterday (Feb 15, 2026) was 120/80 mmHg, which is within normal range.",
    "intent": "vital_signs_query",
    "confidence": 0.95,
    "sent_at": "2026-02-16T11:00:00Z"
  }
}
```

### 3. Get Conversation History
**Endpoint:** `GET /chatbot/conversations/{conversation_id}/messages`

**Headers:** `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "conversation_id": "CONV001",
    "messages": [
      {
        "message_id": "MSG001",
        "sender_type": "Patient",
        "message_text": "What is my blood pressure?",
        "sent_at": "2026-02-16T11:00:00Z"
      },
      {
        "message_id": "MSG002",
        "sender_type": "Bot",
        "message_text": "Your blood pressure yesterday was 120/80 mmHg.",
        "sent_at": "2026-02-16T11:00:05Z"
      }
    ]
  }
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or expired token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Invalid request data |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `OTP_EXPIRED` | 400 | OTP has expired |
| `INVALID_OTP` | 400 | Incorrect OTP |
| `CONSENT_REQUIRED` | 403 | Patient consent required |

---

## Rate Limiting

- **Default**: 1000 requests per hour per user
- **Authentication endpoints**: 10 requests per 15 minutes
- **File uploads**: 50 requests per hour
- **Emergency APIs**: No rate limit

**Headers returned:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1640995200
```

---

## Webhooks

### Event Notifications

Subscribe to events:

```json
POST /webhooks/subscribe
{
  "url": "https://your-server.com/webhook",
  "events": ["prescription.created", "appointment.confirmed", "claim.approved"]
}
```

### Event Types

- `prescription.created`
- `prescription.completed`
- `appointment.confirmed`
- `appointment.cancelled`
- `record.uploaded`
- `claim.approved`
- `claim.rejected`
- `emergency.access`

### Webhook Payload Example

```json
{
  "event": "prescription.created",
  "timestamp": "2026-02-16T11:00:00Z",
  "data": {
    "prescription_id": "PRE002",
    "patient_id": "PAT001",
    "health_id": "HID-2026-12345",
    "doctor_id": "DOC001"
  }
}
```

---

## Data Storage Compliance

### Encryption
- **At Rest**: AES-256 encryption
- **In Transit**: TLS 1.3
- **Backup**: Encrypted backups stored in multiple geographic locations

### Data Retention
- Medical records: 7 years (legally required)
- Prescriptions: 7 years
- Access logs: 3 years
- Chatbot conversations: 1 year

### Right to be Forgotten
Endpoint: `DELETE /patients/{health_id}/gdpr-delete`

---

## SDK & Libraries

### JavaScript/Node.js
```bash
npm install @healthid/sdk
```

```javascript
const HealthID = require('@healthid/sdk');

const client = new HealthID({
  apiKey: 'your_api_key',
  environment: 'production'
});

const patient = await client.patients.get('HID-2026-12345');
```

### Python
```bash
pip install healthid-sdk
```

```python
from healthid import HealthIDClient

client = HealthIDClient(api_key='your_api_key')
patient = client.patients.get('HID-2026-12345')
```

---

## Support

**Technical Support**: api-support@healthid.gov.in  
**API Status**: https://status.healthid.gov.in  
**Documentation**: https://docs.healthid.gov.in  
**Postman Collection**: Available on request

---

**Last Updated**: February 16, 2026  
**API Version**: v1.0.0
