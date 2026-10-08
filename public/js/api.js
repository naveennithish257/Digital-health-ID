// ============================================
// MEDVAULT - API CLIENT
// ============================================

const API_BASE_URL = window.MEDVAULT_API_URL || 
    (window.location.hostname.includes('web.app') || window.location.hostname.includes('firebaseapp.com')
        ? 'https://medvault-backend-api.onrender.com/api'
        : window.location.origin + '/api');

class APIClient {
    constructor() {
        this.token = localStorage.getItem('authToken');
    }

    // Set auth token
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
        }
    }

    // Get auth headers
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...(options.headers || {})
            }
        };

        try {
            const response = await fetch(url, config);
            let data = {};
            const text = await response.text();
            try {
                data = JSON.parse(text);
            } catch (jsonErr) {
                throw new APIError('Server returned non-JSON response', response.status, {});
            }

            if (!response.ok) {
                throw new APIError(data.error?.message || data.message || 'Request failed', response.status, data);
            }

            return data;
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(error.message || 'Network error', 0, {});
        }
    }

    // GET request
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    // POST request
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT request
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE request
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // Upload file
    async upload(endpoint, formData) {
        const url = `${API_BASE_URL}${endpoint}`;
        const headers = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: formData
            });
            const data = await response.json();

            if (!response.ok) {
                throw new APIError(data.error?.message || 'Upload failed', response.status, data);
            }

            return data;
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(error.message || 'Network error', 0, {});
        }
    }
}

// Custom API Error
class APIError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

// Initialize API client
const api = new APIClient();

// API Endpoints
const API = {
    // Authentication
    auth: {
        register: (data) => api.post('/auth/register', data),
        sendOTP: (healthId, phone) => api.post('/auth/send-otp', { health_id: healthId, phone_number: phone }),
        verifyOTP: (healthId, phone, otp) => api.post('/auth/verify-otp', { health_id: healthId, phone_number: phone, otp }),
        getFirebaseConfig: () => api.get('/auth/firebase-config'),
        firebaseLogin: (healthId, idToken) => api.post('/auth/firebase-login', { health_id: healthId, id_token: idToken }),
        demoLogin: () => api.post('/auth/demo-login'),
        logout: () => api.post('/auth/logout')
    },

    // Patient
    patient: {
        getProfile: () => api.get('/patient/profile'),
        updateProfile: (data) => api.put('/patient/profile', data),
        getDashboard: () => api.get('/patient/dashboard'),
        downloadHealthPassport: async () => {
            const token = localStorage.getItem('authToken');
            const url = `${API_BASE_URL}/patient/health-passport/pdf`;
            const resp = await fetch(url, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (!resp.ok) throw new Error("Failed to download Health Passport");
            const blob = await resp.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `MedVault-Health-Passport.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
        },
        exportData: async () => {
            const token = localStorage.getItem('authToken');
            const resp = await fetch(`${API_BASE_URL}/patient/export-data`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (!resp.ok) throw new Error("Failed to export health data");
            const blob = await resp.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `MedVault-Health-Data-Export.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
        },
        deleteAccount: () => api.delete('/patient/account')
    },

    // Medical Records
    records: {
        getAll: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return api.get(`/records${query ? '?' + query : ''}`);
        },
        getById: (id) => api.get(`/records/${id}`),
        create: (data) => api.post('/records', data),
        update: (id, data) => api.put(`/records/${id}`, data),
        delete: (id) => api.delete(`/records/${id}`),
        upload: (formData) => api.upload('/records/upload', formData)
    },

    // Prescriptions
    prescriptions: {
        getAll: () => api.get('/prescriptions'),
        getActive: () => api.get('/prescriptions/active'),
        getById: (id) => api.get(`/prescriptions/${id}`)
    },

    // Appointments
    appointments: {
        getAll: () => api.get('/appointments'),
        getUpcoming: () => api.get('/appointments/upcoming'),
        create: (data) => api.post('/appointments', data),
        book: (data) => api.post('/appointments', data),
        cancel: (id) => api.put(`/appointments/${id}/cancel`)
    },

    // Emergency QR Code Lifecycle
    emergency: {
        generateQR: () => api.post('/emergency/qr'),
        revokeQR: () => api.post('/emergency/qr/revoke'),
        getAccess: (token) => api.get(`/emergency/access/${token}`)
    },

    // Patient Consent Engine
    consent: {
        getAll: () => api.get('/consent'),
        grant: (data) => api.post('/consent', data),
        revoke: (id) => api.delete(`/consent/${id}`)
    },

    // Gemini / Groq / Clinical AI Health Assistant
    assistant: {
        ask: (message, vitalsContext = null) => api.post('/assistant', { message, vitalsContext }),
        chat: (message, vitalsContext = null) => api.post('/assistant/chat', { message, vitalsContext })
    },

    // Vital Signs & Smartwatch AI
    vitals: {
        getAll: (days = 30) => api.get(`/vitals?days=${days}`),
        getLatest: () => api.get('/vitals/latest'),
        log: (data) => api.post('/vitals', data),
        analyzeAI: (vitals = []) => api.post('/vitals/ai-analyze', { vitals })
    },

    // Insurance & Claims
    insurance: {
        getAll: () => api.get('/patient/insurance'),
        add: (data) => api.post('/patient/insurance', data),
        getClaims: () => api.get('/patient/insurance/claims'),
        fileClaim: (data) => api.post('/patient/insurance/claims', data)
    },

    // Vaccinations & Immunizations
    vaccinations: {
        getAll: () => api.get('/patient/vaccinations'),
        record: (data) => api.post('/patient/vaccinations', data)
    },

    // Lab Results & Biomarkers
    labResults: {
        getAll: () => api.get('/patient/lab-results')
    },

    // Hospitals & Doctors
    hospitals: {
        getAll: () => api.get('/hospitals'),
        getDoctors: (hospitalId) => api.get(`/hospitals/${hospitalId}/doctors`)
    },

    // Real-time Notifications & Doctor Access Alerts
    notifications: {
        getAll: () => api.get('/notifications'),
        markRead: (id) => api.put(`/notifications/${id}/read`),
        markAllRead: () => api.post('/notifications/mark-all-read'),
        testDoctorAccess: (data = {}) => api.post('/notifications/test-doctor-access', data)
    },

    // Patient Access Logs
    accessLogs: {
        getAll: () => api.get('/access-logs')
    }
};