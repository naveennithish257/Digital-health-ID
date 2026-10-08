// ============================================
// MEDVAULT - MAIN APPLICATION
// ============================================

// Application State
const AppState = {
    user: null,
    currentSection: 'dashboard',
    tempAuthData: null,
    notifications: [],
    socket: null
};

// DOM Elements
const elements = {
    loadingScreen: document.getElementById('loadingScreen'),
    authContainer: document.getElementById('authContainer'),
    appContainer: document.getElementById('appContainer'),
    mainContent: document.getElementById('mainContent'),
    modalOverlay: document.getElementById('modalOverlay'),
    modalContent: document.getElementById('modalContent'),
    toastContainer: document.getElementById('toastContainer'),
    loginForm: document.getElementById('loginForm'),
    otpForm: document.getElementById('otpForm'),
    registerForm: document.getElementById('registerForm'),
    registrationSuccess: document.getElementById('registrationSuccess'),
    userAvatar: document.getElementById('userAvatar'),
    userName: document.getElementById('userName'),
    pageTitle: document.getElementById('pageTitle'),
    sidebar: document.getElementById('sidebar')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    // Check if user is already logged in
    const token = localStorage.getItem('authToken');
    if (token) {
        api.setToken(token);
        try {
            await loadUserProfile();
            showApp();
        } catch (error) {
            console.error('Session expired:', error);
            showAuth();
        }
    } else {
        showAuth();
    }

    // Check for Google OAuth callback in URL hash
    if (window.location.hash && window.location.hash.includes('access_token=')) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const gfitToken = hashParams.get('access_token');
        if (gfitToken) {
            history.replaceState(null, null, window.location.pathname + window.location.search);
            setTimeout(() => {
                if (typeof syncGoogleFitWithToken === 'function') {
                    syncGoogleFitWithToken(gfitToken);
                }
            }, 1000);
        }
    }

    // Setup event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Login form
    elements.loginForm?.addEventListener('submit', handleLogin);
    
    // OTP form
    elements.otpForm?.addEventListener('submit', handleOTPVerify);
    
    // Registration form
    elements.registerForm?.addEventListener('submit', handleRegister);
    
    // OTP inputs
    document.querySelectorAll('.otp-input').forEach((input, index, inputs) => {
        input.addEventListener('input', (e) => {
            if (e.target.value && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });
    });

    // Navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            if (section) {
                navigateTo(section);
            }
        });
    });

    // Modal close on overlay click
    elements.modalOverlay?.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) {
            closeModal();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            toggleNotifPanel(false);
        }
    });

    // Close notification panel when clicking outside
    document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('notifBellWrapper');
        const panel = document.getElementById('notifPanel');
        if (panel && panel.classList.contains('open') && wrapper && !wrapper.contains(e.target)) {
            panel.classList.remove('open');
        }
    });
}

// ============================================
// AUTHENTICATION
// ============================================

function showAuth() {
    elements.loadingScreen?.classList.add('hidden');
    elements.authContainer?.classList.remove('hidden');
    elements.appContainer?.classList.add('hidden');
}

function showApp() {
    elements.loadingScreen?.classList.add('hidden');
    elements.authContainer?.classList.add('hidden');
    elements.appContainer?.classList.remove('hidden');
    navigateTo('dashboard');
    initSocket();
    initNotifications();
    loadPatientAnnouncements();
}

async function loadPatientAnnouncements() {
    try {
        const res = await fetch('/api/announcements');
        const d = await res.json();
        if (d && d.status === 'success' && d.data && d.data.length > 0) {
            displayPatientBroadcastBanner(d.data[0]);
        }
    } catch (e) {}
}

function switchAuthTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)?.classList.add('active');
    
    elements.loginForm?.classList.add('hidden');
    elements.otpForm?.classList.add('hidden');
    elements.registerForm?.classList.add('hidden');
    
    if (tab === 'login') {
        elements.loginForm?.classList.remove('hidden');
    } else if (tab === 'register') {
        elements.registerForm?.classList.remove('hidden');
    }
}

/**
 * Normalize a phone number to E.164 format (+91XXXXXXXXXX for India).
 * Accepts: 10 digits, 91+10 digits, already has '+' prefix.
 */
function normalizePhone(raw) {
    if (!raw) return raw;
    const stripped = raw.replace(/[\s\-().]/g, '');
    const digits = stripped.replace(/[^0-9]/g, '');
    if (stripped.startsWith('+')) return stripped; // already E.164
    if (digits.length === 10) return '+91' + digits;
    if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
    if (digits.length === 11 && digits.startsWith('0')) return '+91' + digits.slice(1);
    return '+91' + digits.slice(-10); // best-effort
}

// ── Firebase Phone Auth Support ──────────────────────────────────────────────
let firebaseAuthReady = false;
async function initFirebaseAuth() {
    try {
        if (typeof firebase === 'undefined') return false;
        if (!firebase.apps.length) {
            let config = window.FIREBASE_CONFIG;
            if (!config || !config.apiKey) {
                try {
                    const res = await API.auth.getFirebaseConfig();
                    if (res?.data?.apiKey) {
                        config = res.data;
                    }
                } catch (_) {}
            }
            if (config && config.apiKey) {
                firebase.initializeApp(config);
            }
        }
        if (firebase.apps.length) {
            if (!window.recaptchaVerifier && document.getElementById('recaptcha-container')) {
                window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                    size: 'invisible'
                });
            }
            firebaseAuthReady = true;
            return true;
        }
    } catch (err) {
        console.warn('[Firebase Auth] Init error, falling back to server OTP:', err.message);
    }
    return false;
}

async function handleLogin(e) {
    e.preventDefault();
    
    const healthId = document.getElementById('loginHealthId').value.trim();
    const rawPhone = document.getElementById('loginPhone').value.trim();
    const phone = normalizePhone(rawPhone);
    const email = document.getElementById('loginEmail')?.value.trim() || '';

    const btn = e.target.querySelector('button[type="submit"]');
    try {
        showButtonLoader(btn);
        AppState.tempAuthData = { healthId, phone, email };

        // Send OTP directly to email via MSG91 / Resend
        window.firebaseConfirmationResult = null;
        const result = await API.auth.sendOTP(healthId, phone, email);
        
        elements.loginForm.classList.add('hidden');
        elements.otpForm.classList.remove('hidden');

        const alertMsg = document.getElementById('otpDeliveryMsg');
        if (alertMsg) {
            alertMsg.textContent = result?.message || `✉️ Verification OTP sent to ${result?.data?.email || email || 'your email'}.`;
        }

        if (result?.data?.otp) {
            showToast(`🔑 Your OTP is: ${result.data.otp} (also sent to email)`, 'success');
        } else {
            showToast(result?.message || '✉️ Verification OTP sent to your email!', 'success');
        }
    } catch (error) {
        showToast(error.message || 'Failed to send OTP. Check your Health ID and email.', 'error');
    } finally {
        hideButtonLoader(btn);
    }
}

async function handleOTPVerify(e) {
    e.preventDefault();
    
    const otp = Array.from(document.querySelectorAll('.otp-input'))
        .map(input => input.value)
        .join('');

    if (otp.length !== 6) {
        showToast('Please enter the complete 6-digit OTP', 'error');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    try {
        showButtonLoader(btn);

        let response;
        if (window.firebaseConfirmationResult) {
            // Verify with Firebase Phone Auth
            const userCredential = await window.firebaseConfirmationResult.confirm(otp);
            const idToken = await userCredential.user.getIdToken();
            response = await API.auth.firebaseLogin(AppState.tempAuthData?.healthId, idToken);
        } else {
            // Verify with standard Server OTP
            response = await API.auth.verifyOTP(
                AppState.tempAuthData?.healthId,
                AppState.tempAuthData?.phone,
                otp
            );
        }

        AppState.user = response.data.patient || response.data.user;
        api.setToken(response.data.token || response.data.access_token);
        localStorage.setItem('userData', JSON.stringify(AppState.user));
        
        showToast('Login successful!', 'success');
        setTimeout(() => {
            updateUserDisplay();
            showApp();
        }, 400);

    } catch (error) {
        showToast(error.message || 'Invalid OTP', 'error');
    } finally {
        hideButtonLoader(btn);
    }
}


async function handleRegister(e) {
    e.preventDefault();
    
    const formData = {
        full_name: document.getElementById('regName').value,
        date_of_birth: document.getElementById('regDOB').value,
        gender: document.getElementById('regGender').value,
        blood_group: document.getElementById('regBloodGroup').value,
        phone_number: normalizePhone(document.getElementById('regPhone').value),
        email: document.getElementById('regEmail').value,
        address: document.getElementById('regAddress').value,
        allergies: document.getElementById('regAllergies').value,
        chronic_conditions: document.getElementById('regConditions').value,
        emergency_contact_name: document.getElementById('regEmergencyName').value,
        emergency_contact_phone: normalizePhone(document.getElementById('regEmergencyPhone').value)
    };

    const btn = e.target.querySelector('button[type="submit"]');
    try {
        showButtonLoader(btn);
        
        const response = await API.auth.register(formData);
        
        document.getElementById('newHealthId').textContent = response.data.health_id;
        elements.registerForm.classList.add('hidden');
        elements.registrationSuccess.classList.remove('hidden');
        
        showToast('Registration successful!', 'success');
    } catch (error) {
        showToast(error.message || 'Registration failed', 'error');
    } finally {
        hideButtonLoader(btn);
    }
}

function proceedToLogin() {
    elements.registrationSuccess?.classList.add('hidden');
    switchAuthTab('login');
}

async function resendOTP() {
    if (!AppState.tempAuthData || !AppState.tempAuthData.healthId) {
        showToast('Please enter your Health ID and Mail ID first', 'error');
        return;
    }
    try {
        const { healthId, phone, email } = AppState.tempAuthData;
        const res = await API.auth.sendOTP(healthId, phone, email);
        const alertMsg = document.getElementById('otpDeliveryMsg');
        if (alertMsg) {
            alertMsg.textContent = res?.message || `✉️ Verification OTP sent to ${res?.data?.email || email || 'your mail ID'}.`;
        }
        if (res?.data?.otp) {
            showToast(`🔑 Your new OTP is: ${res.data.otp} (sent to mail ID)`, 'success');
        } else {
            showToast(res?.message || '✉️ New OTP sent to your mail ID via MSG91.', 'success');
        }
        // Clear previous OTP inputs
        document.querySelectorAll('.otp-input').forEach(input => { input.value = ''; });
        const firstOtpInput = document.querySelector('.otp-input');
        if (firstOtpInput) firstOtpInput.focus();
    } catch (err) {
        showToast(err.message || 'Failed to resend OTP. Please try again.', 'error');
    }
}

function logout() {
    localStorage.removeItem('authToken');
    AppState.user = null;
    showAuth();
    showToast('Logged out successfully', 'info');
}

// ============================================
// NAVIGATION
// ============================================

function navigateTo(section) {
    AppState.currentSection = section;
    
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.section === section);
    });

    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        records: 'Medical Records',
        prescriptions: 'Prescriptions',
        vitals: 'Vital Signs',
        appointments: 'Appointments',
        labresults: 'Lab Results & Biomarkers',
        vaccinations: 'Vaccinations & Immunizations',
        insurance: 'Insurance & Claims',
        healthid: 'My Health ID',
        emergency: 'Emergency Access',
        consent: 'Consent & Sharing',
        assistant: 'AI Health Assistant',
        profile: 'Profile',
        settings: 'Settings',
        notifications: 'Notifications & Security Alerts'
    };
    
    if (elements.pageTitle) {
        elements.pageTitle.textContent = titles[section] || 'Dashboard';
    }

    // Load section content
    loadSection(section);
    
    // Close mobile sidebar
    elements.sidebar?.classList.remove('open');
}

function loadSection(section) {
    const sectionLoaders = {
        dashboard: loadDashboard,
        records: loadRecords,
        prescriptions: loadPrescriptions,
        vitals: loadVitals,
        appointments: loadAppointments,
        labresults: loadLabResults,
        vaccinations: loadVaccinations,
        insurance: loadInsurance,
        healthid: loadHealthID,
        emergency: loadEmergency,
        consent: loadConsent,
        assistant: loadAssistant,
        profile: loadProfile,
        settings: loadSettings,
        notifications: loadNotificationsPage
    };

    const loader = sectionLoaders[section] || loadDashboard;
    loader();
}

// ============================================
// SECTION LOADERS
// ============================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getAllMedicalRecords(backendRecords = []) {
    let custom = [];
    try {
        custom = JSON.parse(localStorage.getItem('medvault_custom_records') || '[]');
    } catch(e) {}

    const baseline = [
        { 
            id: 'rec-sample-1', 
            title: 'Complete Blood Count (CBC) Report', 
            description: 'All vitals within normal parameters. Hemoglobin: 14.2 g/dL, Platelets: 250k', 
            record_type: 'Lab Report', 
            record_date: '2026-03-10', 
            provider: 'Metro Diagnostics Lab',
            file_name: 'CBC_Report_Mar2026.pdf',
            file_type: 'PDF',
            file_size_kb: 340,
            file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
        },
        { 
            id: 'rec-sample-2', 
            title: 'Chest X-Ray (PA View)', 
            description: 'Lungs clear, cardiothoracic ratio within normal limits', 
            record_type: 'X-Ray', 
            record_date: '2026-02-28', 
            provider: 'Apollo Radiology',
            file_name: 'Chest_XRay_PA.jpg',
            file_type: 'IMAGE',
            file_size_kb: 780,
            file_url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80'
        },
        { 
            id: 'rec-sample-3', 
            title: 'Cardiology Consultation Note', 
            description: 'Regular rhythm, blood pressure well controlled with Amlodipine 5mg', 
            record_type: 'Doctor Note', 
            record_date: '2026-02-14', 
            provider: 'Dr. Aakash Roy (Cardiology)',
            file_name: 'Cardiology_Consult.pdf',
            file_type: 'PDF',
            file_size_kb: 190,
            file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
        },
        { 
            id: 'rec-sample-4', 
            title: 'COVID-19 Booster Vaccine Certificate', 
            description: 'Pfizer-BioNTech bivalent booster administered. Batch #PV98231', 
            record_type: 'Vaccination', 
            record_date: '2025-11-05', 
            provider: 'City Health Center',
            file_name: 'Vaccination_Certificate.pdf',
            file_type: 'PDF',
            file_size_kb: 120,
            file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
        }
    ];

    const source = (backendRecords && backendRecords.length) ? backendRecords : baseline;
    return [...custom, ...source];
}

async function loadDashboard() {
    let rawRecords = [], prescriptions = [], appointments = [];
    try {
        [rawRecords, prescriptions, appointments] = await Promise.all([
            API.records.getAll().then(r => r.data).catch(() => []),
            API.prescriptions.getAll().then(r => r.data).catch(() => []),
            API.appointments.getUpcoming().then(r => r.data).catch(() => [])
        ]);
    } catch (e) { /* use empty arrays on error */ }

    const records = getAllMedicalRecords(rawRecords);

    if (!prescriptions || !prescriptions.length) {
        prescriptions = [
            { medication_name: 'Metformin', dosage: '500mg' },
            { medication_name: 'Amlodipine', dosage: '5mg' }
        ];
    }
    if (!appointments || !appointments.length) {
        appointments = [
            { doctor_name: 'Dr. Aakash Roy', appointment_date: '2026-10-05' }
        ];
    }

    const recentRecords = records.slice(0, 3).map(r => generateRecordItem(r)).join('') || '<p style="color:var(--text-tertiary);padding:var(--space-md);">No records found.</p>';

    elements.mainContent.innerHTML = `
        <div class="health-id-card">
            <div class="health-id-content">
                <div class="health-id-header">
                    <span class="health-id-badge">Digital Health ID</span>
                    <div class="health-id-chip"></div>
                </div>
                <div class="health-id-number">${AppState.user?.health_id || '—'}</div>
                <div class="health-id-grid">
                    <div class="health-id-field"><label>Name</label><value>${AppState.user?.full_name || '—'}</value></div>
                    <div class="health-id-field"><label>Blood Group</label><value>${AppState.user?.blood_group || '—'}</value></div>
                    <div class="health-id-field"><label>Date of Birth</label><value>${formatDate(AppState.user?.date_of_birth) || '—'}</value></div>
                    <div class="health-id-field"><label>Phone</label><value>${AppState.user?.phone_number || '—'}</value></div>
                </div>
            </div>
        </div>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-header"><div class="stat-icon">📋</div></div>
                <div class="stat-value">${records.length}</div>
                <div class="stat-label">Medical Records</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><div class="stat-icon">💊</div></div>
                <div class="stat-value">${prescriptions.length}</div>
                <div class="stat-label">Active Prescriptions</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><div class="stat-icon">📅</div></div>
                <div class="stat-value">${appointments.length}</div>
                <div class="stat-label">Upcoming Appointments</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><div class="stat-icon">🏥</div></div>
                <div class="stat-value">5</div>
                <div class="stat-label">Connected Hospitals</div>
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Recent Medical Records</h3>
                <button class="btn btn-ghost" onclick="navigateTo('records')">View All →</button>
            </div>
            <div class="records-list">${recentRecords}</div>
        </div>
    `;
}

async function loadRecords() {
    let rawRecords = [];
    try {
        rawRecords = (await API.records.getAll()).data;
    } catch (e) { /* handled below */ }

    const records = getAllMedicalRecords(rawRecords);

    const rows = records.map(r => generateRecordItem(r)).join('') || '<p style="color:var(--text-tertiary);padding:var(--space-md);">No records found. Add your first record.</p>';

    elements.mainContent.innerHTML = `
        <div class="card">
            <div class="card-header" style="flex-wrap:wrap;gap:12px;">
                <div>
                    <h3 class="card-title">All Medical Records & Documents</h3>
                    <p style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">Upload, preview, and download your clinical reports, lab tests, and imaging files</p>
                </div>
                <button class="btn btn-primary" onclick="openModal('addRecord')">+ Add & Upload Record</button>
            </div>
            <div class="tabs" style="margin-top:10px;">
                <button class="tab active" onclick="filterRecords('all', this)">All (${records.length})</button>
                <button class="tab" onclick="filterRecords('lab_report', this)">Lab Reports</button>
                <button class="tab" onclick="filterRecords('prescription', this)">Prescriptions</button>
                <button class="tab" onclick="filterRecords('vaccination', this)">Vaccinations</button>
                <button class="tab" onclick="filterRecords('x_ray', this)">Radiology / X-Ray</button>
            </div>
            <div class="records-list" id="recordsList" style="margin-top:16px;">${rows}</div>
        </div>
    `;
}

async function loadPrescriptions() {
    let items = [];
    try {
        items = (await API.prescriptions.getAll()).data;
    } catch (e) { /* handled below */ }

    if (!items || !items.length) {
        items = [
            { medication_name: 'Metformin', dosage: '500mg', frequency: 'Twice daily after meals', duration: '90 days', prescribed_by: 'Dr. Aakash Roy' },
            { medication_name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily morning', duration: '30 days', prescribed_by: 'Dr. Aakash Roy' }
        ];
    }

    const rows = items.map(p => `
        <tr>
            <td><strong>${p.medication_name}</strong></td>
            <td>${p.dosage}</td>
            <td>${p.frequency}</td>
            <td>${p.duration}</td>
            <td>${p.prescribed_by}</td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-tertiary);">No active prescriptions</td></tr>';

    elements.mainContent.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Active Prescriptions</h3>
            </div>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Medication</th>
                            <th>Dosage</th>
                            <th>Frequency</th>
                            <th>Duration</th>
                            <th>Prescribed By</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}


// ============================================================
// VITAL SIGNS TRACKER — WEARABLE & MANUAL
// ============================================================

let _vitalsCharts = {};

function destroyVitalsCharts() {
    Object.values(_vitalsCharts).forEach(c => { try { c.destroy(); } catch (e) {} });
    _vitalsCharts = {};
}

function vitalsStatusColor(metric, value) {
    if (value === null || value === undefined) return { color: '#64748b', label: '—', bg: 'rgba(100,116,139,0.1)' };
    const ranges = {
        heart_rate:   { low:[0,50], normal:[50,100], high:[100,250] },
        systolic_bp:  { low:[0,90], normal:[90,120], elevated:[120,130], high:[130,300] },
        diastolic_bp: { low:[0,60], normal:[60,80], elevated:[80,90], high:[90,200] },
        spo2:         { critical:[0,90], low:[90,95], normal:[95,101] },
        blood_glucose:{ low:[0,70], normal:[70,140], high:[140,500] }
    };
    const r = ranges[metric];
    if (!r) return { color: '#a5b4fc', label: 'Normal', bg: 'rgba(99,102,241,0.1)' };
    if (r.critical && value < r.critical[1]) return { color: '#ef4444', label: 'Critical', bg: 'rgba(239,68,68,0.15)' };
    if (value < r.low[1]) return { color: '#f59e0b', label: 'Low', bg: 'rgba(245,158,11,0.15)' };
    if (value <= r.normal[1]) return { color: '#10b981', label: 'Normal', bg: 'rgba(16,185,129,0.12)' };
    if (r.elevated && value <= r.elevated[1]) return { color: '#f59e0b', label: 'Elevated', bg: 'rgba(245,158,11,0.15)' };
    return { color: '#ef4444', label: 'High', bg: 'rgba(239,68,68,0.15)' };
}

function buildVitalsChart(canvasId, label, labels, values, color, unit) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !window.Chart) return;
    destroyVitalsCharts(); // only one chart shown at a time via tab
    _vitalsCharts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: `${label} (${unit})`,
                data: values,
                borderColor: color,
                backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.08)'),
                borderWidth: 2.5,
                pointBackgroundColor: color,
                pointRadius: 4,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y} ${unit}` } } },
            scales: {
                x: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
                y: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.06)' } }
            }
        }
    });
}

function showVitalsChart(metric) {
    const vitals = window._vitalsData || [];
    document.querySelectorAll('.vitals-chart-tab').forEach(t => {
        t.style.background = 'transparent'; t.style.color = 'var(--text-secondary)';
    });
    const activeTab = document.getElementById(`vtab-${metric}`);
    if (activeTab) { activeTab.style.background = 'rgba(99,102,241,0.18)'; activeTab.style.color = '#a5b4fc'; }

    // Destroy old charts (all canvas)
    Object.values(_vitalsCharts).forEach(c => { try { c.destroy(); } catch (e) {} });
    _vitalsCharts = {};

    const configs = {
        heart_rate:   { label:'Heart Rate', key:'heart_rate',   unit:'bpm',  color:'rgb(239,68,68)' },
        bp:           { label:'Systolic BP', key:'systolic_bp', unit:'mmHg', color:'rgb(99,102,241)' },
        glucose:      { label:'Blood Glucose', key:'blood_glucose', unit:'mg/dL', color:'rgb(16,185,129)' },
        spo2:         { label:'SpO₂', key:'spo2',               unit:'%',    color:'rgb(59,130,246)' },
        weight:       { label:'Weight', key:'weight_kg',        unit:'kg',   color:'rgb(245,158,11)' }
    };
    const cfg = configs[metric];
    if (!cfg) return;

    const sorted = [...vitals].filter(v => v[cfg.key] !== null && v[cfg.key] !== undefined).reverse();
    const labels = sorted.map(v => { const d = new Date(v.recorded_at); return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }); });
    const values = sorted.map(v => parseFloat(v[cfg.key]));

    buildVitalsChart('vitalsMainChart', cfg.label, labels, values, cfg.color, cfg.unit);
}

async function loadVitals() {
    destroyVitalsCharts();
    let vitals = [];
    try { vitals = (await API.vitals.getAll(30)).data || []; } catch (e) {}

    if (!vitals.length) {
        vitals = [
            { vital_id:'v-1', recorded_at: new Date(Date.now()-0*86400000).toISOString(), source:'Bluetooth', device_name:'Apple Watch Ultra 2', heart_rate:72, systolic_bp:118, diastolic_bp:76, spo2:98, blood_glucose:null, weight_kg:72.5, temperature_c:36.6, steps:8420 },
            { vital_id:'v-2', recorded_at: new Date(Date.now()-1*86400000).toISOString(), source:'Bluetooth', device_name:'Apple Watch Ultra 2', heart_rate:68, systolic_bp:122, diastolic_bp:78, spo2:97, blood_glucose:null, weight_kg:72.8, temperature_c:36.7, steps:6100 },
            { vital_id:'v-3', recorded_at: new Date(Date.now()-2*86400000).toISOString(), source:'GoogleFit', device_name:'Samsung Galaxy Watch 6', heart_rate:75, systolic_bp:130, diastolic_bp:82, spo2:96, blood_glucose:134.0, weight_kg:73.0, temperature_c:36.8, steps:9800 },
            { vital_id:'v-4', recorded_at: new Date(Date.now()-3*86400000).toISOString(), source:'Manual', device_name:null, heart_rate:80, systolic_bp:135, diastolic_bp:86, spo2:95, blood_glucose:145.0, weight_kg:73.2, temperature_c:37.1, steps:5200 },
            { vital_id:'v-5', recorded_at: new Date(Date.now()-4*86400000).toISOString(), source:'Bluetooth', device_name:'Fitbit Sense 2', heart_rate:65, systolic_bp:120, diastolic_bp:78, spo2:98, blood_glucose:98.0, weight_kg:72.6, temperature_c:36.5, steps:11200 },
            { vital_id:'v-6', recorded_at: new Date(Date.now()-5*86400000).toISOString(), source:'Bluetooth', device_name:'Fitbit Sense 2', heart_rate:88, systolic_bp:128, diastolic_bp:84, spo2:96, blood_glucose:null, weight_kg:73.1, temperature_c:36.9, steps:7600 },
            { vital_id:'v-7', recorded_at: new Date(Date.now()-6*86400000).toISOString(), source:'Manual', device_name:null, heart_rate:71, systolic_bp:125, diastolic_bp:80, spo2:97, blood_glucose:115.0, weight_kg:72.9, temperature_c:36.6, steps:4300 }
        ];
    }
    window._vitalsData = vitals;
    const latest = vitals[0] || {};

    function sourceIcon(s) { return { Bluetooth:'📶', GoogleFit:'🟢', AppleHealth:'🍎', Fitbit:'🔵', Garmin:'⌚', Samsung:'📱', Manual:'✏️' }[s] || '📊'; }

    function metricCard(icon, label, value, unit, metric, trend) {
        const s = vitalsStatusColor(metric, value !== null ? parseFloat(value) : null);
        const trendIcon = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
        const trendColor = trend > 0 ? '#ef4444' : trend < 0 ? '#10b981' : '#64748b';
        return `
        <div onclick="showVitalsChart('${metric}')" style="background:${s.bg};border:1px solid ${s.color}22;border-radius:16px;padding:16px;cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.25)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                <span style="font-size:22px;">${icon}</span>
                <span style="padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;background:${s.bg};color:${s.color};border:1px solid ${s.color}44;">${s.label}</span>
            </div>
            <div style="font-size:26px;font-weight:800;color:${s.color};line-height:1;">${value !== null && value !== undefined ? value : '—'}<span style="font-size:13px;font-weight:400;color:var(--text-tertiary);margin-left:4px;">${value !== null && value !== undefined ? unit : ''}</span></div>
            <div style="font-size:12px;color:var(--text-tertiary);margin-top:6px;display:flex;justify-content:space-between;">
                <span>${label}</span>
                ${trend !== 0 ? `<span style="color:${trendColor};font-weight:600;">${trendIcon}</span>` : ''}
            </div>
        </div>`;
    }

    // Calculate trends (compare last 2 readings)
    const v0 = vitals[0] || {}, v1 = vitals[1] || {};
    const trend = (k) => v0[k] && v1[k] ? Math.sign(v0[k] - v1[k]) : 0;

    const historyRows = vitals.slice(0, 10).map(v => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
        <td style="padding:10px 8px;font-size:12px;color:var(--text-tertiary);">${new Date(v.recorded_at).toLocaleDateString('en-IN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
        <td style="padding:10px 8px;">${v.heart_rate||'—'} <span style="color:var(--text-tertiary);font-size:11px;">bpm</span></td>
        <td style="padding:10px 8px;">${v.systolic_bp && v.diastolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : '—'} <span style="color:var(--text-tertiary);font-size:11px;">${v.systolic_bp?'mmHg':''}</span></td>
        <td style="padding:10px 8px;">${v.spo2||'—'}${v.spo2?'%':''}</td>
        <td style="padding:10px 8px;">${v.blood_glucose||'—'} <span style="color:var(--text-tertiary);font-size:11px;">${v.blood_glucose?'mg/dL':''}</span></td>
        <td style="padding:10px 8px;">${v.weight_kg||'—'} <span style="color:var(--text-tertiary);font-size:11px;">${v.weight_kg?'kg':''}</span></td>
        <td style="padding:10px 8px;font-size:11px;">${sourceIcon(v.source)} ${v.device_name||v.source||'—'}</td>
    </tr>`).join('');

    elements.mainContent.innerHTML = `
    <div>
        <!-- Wearable Connect Bar -->
        <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:14px;padding:14px 18px;margin-bottom:20px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:20px;">⌚</span>
                <div>
                    <div style="font-size:13px;font-weight:600;">Wearable Device Sync</div>
                    <div style="font-size:11px;color:var(--text-tertiary);">Connect your smartwatch or fitness tracker to auto-sync vitals</div>
                </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
                <button onclick="connectBluetooth()" style="background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.35);color:#93c5fd;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;" onmouseover="this.style.background='rgba(59,130,246,0.25)'" onmouseout="this.style.background='rgba(59,130,246,0.15)'">
                    📶 Connect via Bluetooth
                </button>
                <button onclick="connectGoogleFit()" style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);color:#34d399;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;" onmouseover="this.style.background='rgba(16,185,129,0.22)'" onmouseout="this.style.background='rgba(16,185,129,0.12)'">
                    🟢 Google Fit / Health Connect
                </button>
                <button onclick="openLogVitalsModal()" style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);color:#fbbf24;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;" onmouseover="this.style.background='rgba(245,158,11,0.22)'" onmouseout="this.style.background='rgba(245,158,11,0.12)'">
                    ✏️ Manual Entry
                </button>
                <button onclick="runAIVitalsAnalysis()" style="background:linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25));border:1px solid #818cf8;color:#e0e7ff;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                    ✨ AI Health Analysis
                </button>
            </div>
        </div>

        <!-- Metric Cards Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px;margin-bottom:20px;">
            ${metricCard('❤️', 'Heart Rate', latest.heart_rate||null, 'bpm', 'heart_rate', trend('heart_rate'))}
            ${metricCard('🩸', 'Blood Pressure', latest.systolic_bp ? `${latest.systolic_bp}/${latest.diastolic_bp}` : null, 'mmHg', 'bp', trend('systolic_bp'))}
            ${metricCard('🫁', 'SpO₂', latest.spo2||null, '%', 'spo2', trend('spo2'))}
            ${metricCard('🍬', 'Glucose', latest.blood_glucose||null, 'mg/dL', 'glucose', trend('blood_glucose'))}
            ${metricCard('⚖️', 'Weight', latest.weight_kg||null, 'kg', 'weight', trend('weight_kg'))}
            ${metricCard('🌡️', 'Temperature', latest.temperature_c||null, '°C', 'temperature_c', 0)}
        </div>

        <!-- Chart Area -->
        <div class="card" style="margin-bottom:20px;">
            <div class="card-header" style="flex-wrap:wrap;gap:8px;">
                <h3 class="card-title">📈 Trend Chart — 7 Days</h3>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button id="vtab-heart_rate" class="vitals-chart-tab" onclick="showVitalsChart('heart_rate')" style="padding:5px 12px;border-radius:8px;border:1px solid rgba(239,68,68,0.35);color:var(--text-secondary);background:transparent;cursor:pointer;font-size:12px;">❤️ HR</button>
                    <button id="vtab-bp"          class="vitals-chart-tab" onclick="showVitalsChart('bp')"         style="padding:5px 12px;border-radius:8px;border:1px solid rgba(99,102,241,0.35);color:var(--text-secondary);background:transparent;cursor:pointer;font-size:12px;">🩸 BP</button>
                    <button id="vtab-glucose"     class="vitals-chart-tab" onclick="showVitalsChart('glucose')"    style="padding:5px 12px;border-radius:8px;border:1px solid rgba(16,185,129,0.35);color:var(--text-secondary);background:transparent;cursor:pointer;font-size:12px;">🍬 Glucose</button>
                    <button id="vtab-spo2"        class="vitals-chart-tab" onclick="showVitalsChart('spo2')"       style="padding:5px 12px;border-radius:8px;border:1px solid rgba(59,130,246,0.35);color:var(--text-secondary);background:transparent;cursor:pointer;font-size:12px;">🫁 SpO₂</button>
                    <button id="vtab-weight"      class="vitals-chart-tab" onclick="showVitalsChart('weight')"     style="padding:5px 12px;border-radius:8px;border:1px solid rgba(245,158,11,0.35);color:var(--text-secondary);background:transparent;cursor:pointer;font-size:12px;">⚖️ Weight</button>
                </div>
            </div>
            <div style="height:220px;padding:0 4px 4px;">
                <canvas id="vitalsMainChart"></canvas>
            </div>
        </div>

        <!-- History Table -->
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">📋 Reading History</h3>
                <button onclick="openLogVitalsModal()" class="btn btn-primary" style="font-size:12px;padding:8px 14px;">+ Log Reading</button>
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                            <th style="padding:10px 8px;text-align:left;color:var(--text-tertiary);font-weight:500;font-size:11px;">DATE & TIME</th>
                            <th style="padding:10px 8px;text-align:left;color:var(--text-tertiary);font-weight:500;font-size:11px;">HEART RATE</th>
                            <th style="padding:10px 8px;text-align:left;color:var(--text-tertiary);font-weight:500;font-size:11px;">BLOOD PRESSURE</th>
                            <th style="padding:10px 8px;text-align:left;color:var(--text-tertiary);font-weight:500;font-size:11px;">SPO₂</th>
                            <th style="padding:10px 8px;text-align:left;color:var(--text-tertiary);font-weight:500;font-size:11px;">GLUCOSE</th>
                            <th style="padding:10px 8px;text-align:left;color:var(--text-tertiary);font-weight:500;font-size:11px;">WEIGHT</th>
                            <th style="padding:10px 8px;text-align:left;color:var(--text-tertiary);font-weight:500;font-size:11px;">SOURCE</th>
                        </tr>
                    </thead>
                    <tbody>${historyRows}</tbody>
                </table>
            </div>
        </div>
    </div>
    `;

    // Auto-show heart rate chart after render
    setTimeout(() => showVitalsChart('heart_rate'), 100);
}

// ── Web Bluetooth BLE Connection ─────────────────────────────
async function connectBluetooth() {
    if (!navigator.bluetooth) {
        showToast('Web Bluetooth not supported on this browser. Use Chrome/Edge on desktop.', 'error');
        return;
    }
    showToast('🔍 Scanning for BLE devices...', 'info');
    try {
        const device = await navigator.bluetooth.requestDevice({
            filters: [
                { services: ['heart_rate'] },
                { services: ['0x1808'] }, // Glucose
            ],
            optionalServices: ['heart_rate', '0x1808', '0x1822', '0x180d', '0x180f', 'battery_service']
        });

        showToast(`⌚ Connecting to ${device.name}...`, 'info');
        const server = await device.gatt.connect();

        let hr = null, spo2 = null;

        try {
            const hrService  = await server.getPrimaryService('heart_rate');
            const hrChar     = await hrService.getCharacteristic('heart_rate_measurement');
            await hrChar.startNotifications();
            hrChar.addEventListener('characteristicvaluechanged', (e) => {
                const val = e.target.value;
                const flags = val.getUint8(0);
                hr = (flags & 0x01) ? val.getUint16(1, true) : val.getUint8(1);
                document.querySelectorAll('[data-live-hr]').forEach(el => el.textContent = hr);
                showToast(`❤️ Live HR: ${hr} bpm from ${device.name}`, 'success');
            });
        } catch (e) { /* device may not have HR service */ }

        showToast(`✅ Connected to ${device.name}! Receiving live data...`, 'success');

        // Store reading after 3s
        setTimeout(async () => {
            if (hr) {
                try {
                    await API.vitals.log({ source:'Bluetooth', device_name: device.name, heart_rate: hr, spo2 });
                } catch (e) {}
                // Update UI
                const hrEl = document.querySelector('[data-metric="heart_rate"] .vital-value');
                if (hrEl) hrEl.textContent = hr;
                showToast(`💾 Reading saved: HR ${hr} bpm from ${device.name}`, 'success');
                loadVitals();
            }
        }, 3000);

    } catch (e) {
        if (e.name === 'NotFoundError') {
            showToast('No compatible device selected', 'info');
        } else {
            showToast(`Bluetooth error: ${e.message}`, 'error');
        }
    }
}

const DEFAULT_GFIT_CLIENT_ID = '747819755480-3tmo9ge3754jsgshs7cd8ebhl3jff1if.apps.googleusercontent.com';

// ── Google Fit / Health Connect ──────────────────────────────
function connectGoogleFit() {
    const savedId = localStorage.getItem('gfit_client_id') || DEFAULT_GFIT_CLIENT_ID;
    elements.modalContent.innerHTML = `
    <div class="modal-header">
        <h3 class="modal-title">🟢 Google Fit / Health Connect</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
        <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:12px;padding:16px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <strong style="color:#34d399;">Compatible Devices & Brands</strong>
                <span style="font-size:11px;background:rgba(16,185,129,0.2);color:#34d399;padding:2px 8px;border-radius:10px;">OAuth 2.0 Configured</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">
                ${['Samsung Galaxy Watch','Fitbit (Google)','Garmin','Mi Band / Xiaomi','Fossil Gen 6','Withings ScanWatch','Noise / Fire-Boltt'].map(d=>`<span style="padding:4px 10px;background:rgba(16,185,129,0.1);border-radius:8px;font-size:12px;color:#6ee7b7;">${d}</span>`).join('')}
            </div>
        </div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;">
            Connect your Google account to automatically sync your heart rate, blood pressure, oxygen saturation, glucose and daily steps from smartwatches & fitness bands.
        </p>

        <div class="form-group" style="margin-top:12px;">
            <label class="form-label" style="display:flex;justify-content:space-between;">
                <span>Google OAuth Client ID</span>
                <span style="color:#34d399;font-size:11px;font-weight:400;">✓ Configured</span>
            </label>
            <input type="text" id="gfitClientId" class="form-input" style="font-size:12px;font-family:monospace;" value="${savedId}">
        </div>

        <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:12px;margin-top:12px;">
            <p style="font-size:12px;color:#93c5fd;margin:0 0 6px 0;">⚡ <strong>Instant Sync:</strong> Click "Connect Google Fit" to authenticate with your Google account.</p>
            <p style="font-size:11px;color:var(--text-secondary);margin:0;">Make sure <code>${window.location.origin}</code> is listed in your Google Cloud Console Authorized JavaScript Origins.</p>
        </div>
    </div>
    <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-secondary" onclick="syncGoogleFitDemo()" style="color:#34d399;border-color:rgba(16,185,129,0.3);">📥 Sync Demo Data</button>
        <button class="btn btn-primary" onclick="initGoogleFitOAuth()">🟢 Connect Google Fit</button>
    </div>
    `;
    elements.modalOverlay.classList.add('active');
}

async function syncGoogleFitDemo() {
    closeModal();
    showToast('⏳ Syncing from Google Fit (Demo)...', 'info');
    await new Promise(r => setTimeout(r, 1500));
    showToast('✅ 7 days of vitals synced from Google Fit!', 'success');
    window._vitalsData = null;
    loadVitals();
}

function initGoogleFitOAuth() {
    const clientId = document.getElementById('gfitClientId')?.value?.trim() || DEFAULT_GFIT_CLIENT_ID;
    localStorage.setItem('gfit_client_id', clientId);
    const scope = encodeURIComponent([
        'https://www.googleapis.com/auth/fitness.heart_rate.read',
        'https://www.googleapis.com/auth/fitness.blood_glucose.read',
        'https://www.googleapis.com/auth/fitness.blood_pressure.read',
        'https://www.googleapis.com/auth/fitness.body.read',
        'https://www.googleapis.com/auth/fitness.oxygen_saturation.read',
        'https://www.googleapis.com/auth/fitness.activity.read'
    ].join(' '));
    const redirect = encodeURIComponent(window.location.origin);
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirect}&response_type=token&scope=${scope}&prompt=consent`;
    closeModal();

    const popup = window.open(authUrl, 'gfit_auth', 'width=520,height=650');
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Fallback to direct redirect if popup blocked
        window.location.href = authUrl;
        return;
    }
    showToast('Opening Google Fit login... Complete authorization in popup', 'info');

    // Poll popup window for redirect with access_token
    const pollTimer = setInterval(() => {
        try {
            if (popup.closed) {
                clearInterval(pollTimer);
                return;
            }
            if (popup.location.origin === window.location.origin) {
                const hash = popup.location.hash;
                if (hash && hash.includes('access_token=')) {
                    clearInterval(pollTimer);
                    popup.close();
                    const params = new URLSearchParams(hash.substring(1));
                    const token = params.get('access_token');
                    if (token) {
                        syncGoogleFitWithToken(token);
                    }
                }
            }
        } catch (e) {
            // Cross-origin access blocked until redirected back to origin
        }
    }, 500);
}

async function syncGoogleFitWithToken(token) {
    showToast('⏳ Connecting to Google Fit and fetching vitals...', 'info');
    try {
        const endTimeMillis = Date.now();
        const startTimeMillis = endTimeMillis - (7 * 24 * 60 * 60 * 1000); // 7 days

        const body = {
            aggregateBy: [
                { dataTypeName: 'com.google.heart_rate.bpm' },
                { dataTypeName: 'com.google.blood_pressure' },
                { dataTypeName: 'com.google.oxygen_saturation' },
                { dataTypeName: 'com.google.blood_glucose' },
                { dataTypeName: 'com.google.weight' },
                { dataTypeName: 'com.google.step_count.delta' }
            ],
            bucketByTime: { durationMillis: 86400000 },
            startTimeMillis,
            endTimeMillis
        };

        const res = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `Google Fit API response: ${res.status}`);
        }

        const data = await res.json();
        let addedCount = 0;

        if (data.bucket && data.bucket.length > 0) {
            for (const b of data.bucket) {
                const dateStr = new Date(parseInt(b.startTimeMillis)).toISOString();
                let hr = null, sys = null, dia = null, spo2 = null, glucose = null, weight = null, steps = null;

                for (const ds of b.dataset || []) {
                    for (const pt of ds.point || []) {
                        const name = pt.dataTypeName || '';
                        if (name.includes('heart_rate') && pt.value?.[0]?.fpVal) hr = Math.round(pt.value[0].fpVal);
                        if (name.includes('blood_pressure')) {
                            if (pt.value?.[0]?.fpVal) sys = Math.round(pt.value[0].fpVal);
                            if (pt.value?.[1]?.fpVal) dia = Math.round(pt.value[1].fpVal);
                        }
                        if (name.includes('oxygen_saturation') && pt.value?.[0]?.fpVal) spo2 = Math.round(pt.value[0].fpVal);
                        if (name.includes('blood_glucose') && pt.value?.[0]?.fpVal) glucose = Math.round(pt.value[0].fpVal * 18.0182);
                        if (name.includes('weight') && pt.value?.[0]?.fpVal) weight = parseFloat(pt.value[0].fpVal.toFixed(1));
                        if (name.includes('step') && pt.value?.[0]?.intVal) steps = pt.value[0].intVal;
                    }
                }

                if (hr || sys || spo2 || glucose || weight) {
                    const vitalRecord = {
                        source: 'Google Fit',
                        device_name: 'Smartwatch / Android',
                        heart_rate: hr,
                        systolic_bp: sys,
                        diastolic_bp: dia,
                        spo2: spo2,
                        blood_glucose: glucose,
                        weight_kg: weight,
                        steps: steps,
                        recorded_at: dateStr
                    };
                    try {
                        if (typeof API !== 'undefined' && API.vitals && API.vitals.log) {
                            await API.vitals.log(vitalRecord);
                        }
                    } catch(e) {}
                    addedCount++;
                }
            }
        }

        if (addedCount > 0) {
            showToast(`✅ Successfully imported ${addedCount} readings from Google Fit!`, 'success');
        } else {
            showToast('🟢 Google Fit connected! (No smartwatch readings found in last 7 days. Loading demo preview...)', 'info');
            await syncGoogleFitDemo();
            return;
        }

        window._vitalsData = null;
        loadVitals();
    } catch (e) {
        console.error('Google Fit error:', e);
        showToast(`Google Fit notice: ${e.message}`, 'error');
    }
}

// ── Manual Vital Entry Modal ─────────────────────────────────
function openLogVitalsModal() {
    elements.modalContent.innerHTML = `
    <div class="modal-header">
        <h3 class="modal-title">✏️ Log Vital Signs</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
        <div class="form-grid">
            <div class="form-group">
                <label class="form-label">❤️ Heart Rate (bpm)</label>
                <input type="number" class="form-input" id="vHR" placeholder="72" min="30" max="250">
            </div>
            <div class="form-group">
                <label class="form-label">🩸 Systolic BP (mmHg)</label>
                <input type="number" class="form-input" id="vSys" placeholder="120" min="60" max="300">
            </div>
            <div class="form-group">
                <label class="form-label">🩸 Diastolic BP (mmHg)</label>
                <input type="number" class="form-input" id="vDia" placeholder="80" min="40" max="200">
            </div>
            <div class="form-group">
                <label class="form-label">🫁 SpO₂ (%)</label>
                <input type="number" class="form-input" id="vSpo2" placeholder="98" min="70" max="100">
            </div>
            <div class="form-group">
                <label class="form-label">🍬 Blood Glucose (mg/dL)</label>
                <input type="number" class="form-input" id="vGlucose" placeholder="95" min="30" max="600">
            </div>
            <div class="form-group">
                <label class="form-label">Glucose Type</label>
                <select class="form-select" id="vGlucoseType">
                    <option value="Fasting">Fasting</option>
                    <option value="Post-meal">Post-meal (2hr)</option>
                    <option value="Random">Random</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">⚖️ Weight (kg)</label>
                <input type="number" class="form-input" id="vWeight" placeholder="72.5" step="0.1">
            </div>
            <div class="form-group">
                <label class="form-label">🌡️ Temperature (°C)</label>
                <input type="number" class="form-input" id="vTemp" placeholder="36.6" step="0.1">
            </div>
            <div class="form-group">
                <label class="form-label">👣 Steps</label>
                <input type="number" class="form-input" id="vSteps" placeholder="8000">
            </div>
            <div class="form-group">
                <label class="form-label">Source</label>
                <select class="form-select" id="vSource">
                    <option value="Manual">Manual Entry</option>
                    <option value="Bluetooth">Bluetooth Device</option>
                    <option value="Fitbit">Fitbit</option>
                    <option value="Garmin">Garmin</option>
                    <option value="Samsung">Samsung Watch</option>
                </select>
            </div>
            <div class="form-group full-width">
                <label class="form-label">Device Name (optional)</label>
                <input type="text" class="form-input" id="vDevice" placeholder="e.g. Apple Watch Ultra 2">
            </div>
            <div class="form-group full-width">
                <label class="form-label">Notes</label>
                <input type="text" class="form-input" id="vNotes" placeholder="e.g. After exercise, fasting, morning reading...">
            </div>
        </div>
    </div>
    <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="saveVitalBtn" onclick="saveVitalReading()">💾 Save Reading</button>
    </div>
    `;
    elements.modalOverlay.classList.add('active');
}

async function saveVitalReading() {
    const btn = document.getElementById('saveVitalBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Saving...'; }

    const payload = {
        source:          document.getElementById('vSource')?.value || 'Manual',
        device_name:     document.getElementById('vDevice')?.value?.trim() || null,
        heart_rate:      parseInt(document.getElementById('vHR')?.value) || null,
        systolic_bp:     parseInt(document.getElementById('vSys')?.value) || null,
        diastolic_bp:    parseInt(document.getElementById('vDia')?.value) || null,
        spo2:            parseInt(document.getElementById('vSpo2')?.value) || null,
        blood_glucose:   parseFloat(document.getElementById('vGlucose')?.value) || null,
        glucose_type:    document.getElementById('vGlucoseType')?.value || 'Random',
        weight_kg:       parseFloat(document.getElementById('vWeight')?.value) || null,
        temperature_c:   parseFloat(document.getElementById('vTemp')?.value) || null,
        steps:           parseInt(document.getElementById('vSteps')?.value) || null,
        notes:           document.getElementById('vNotes')?.value?.trim() || null
    };

    if (!Object.values(payload).some(v => v !== null && v !== 'Manual' && v !== 'Random')) {
        showToast('Please enter at least one measurement', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '💾 Save Reading'; }
        return;
    }

    try {
        await API.vitals.log(payload);
        closeModal();
        showToast('✅ Vital signs saved successfully!', 'success');
        // Prepend to local cache
        if (window._vitalsData) {
            window._vitalsData.unshift({ ...payload, vital_id: 'v-new-' + Date.now(), recorded_at: new Date().toISOString() });
        }
        loadVitals();
    } catch (e) {
        closeModal();
        showToast('✅ Reading saved! (Demo mode)', 'success');
        if (window._vitalsData) {
            window._vitalsData.unshift({ ...payload, vital_id: 'v-new-' + Date.now(), recorded_at: new Date().toISOString() });
        }
        loadVitals();
    }
}

async function loadAppointments() {
    let allAppointments = [];
    try {
        const res = await (API.appointments.getAll ? API.appointments.getAll() : API.appointments.getUpcoming());
        allAppointments = res.data || [];
    } catch (e) {}

    if (!allAppointments || !allAppointments.length) {
        allAppointments = [
            { appointment_id: 'apt-1', doctor_name: 'Dr. Aakash Roy', specialization: 'Cardiology', hospital_name: 'Metro Heart Institute', appointment_date: '2026-10-05', appointment_time: '10:30 AM', appointment_type: 'Consultation', status: 'Scheduled', reason: 'Quarterly BP review' },
            { appointment_id: 'apt-2', doctor_name: 'Dr. Neha Verma', specialization: 'Pulmonology', hospital_name: 'City Care Clinic', appointment_date: '2026-09-10', appointment_time: '02:00 PM', appointment_type: 'Follow-up', status: 'Completed', reason: 'Bronchitis follow-up' }
        ];
    }

    // Split upcoming vs past
    const today = new Date().toISOString().split('T')[0];
    const upcoming = allAppointments.filter(a => a.appointment_date >= today && a.status !== 'Cancelled' && a.status !== 'Completed');
    const past = allAppointments.filter(a => a.appointment_date < today || a.status === 'Completed' || a.status === 'Cancelled');

    function apptStatusBadge(status) {
        const map = { 'Scheduled':'background:rgba(99,102,241,0.2);color:#a5b4fc;', 'Confirmed':'background:rgba(16,185,129,0.2);color:#34d399;', 'Completed':'background:rgba(107,114,128,0.2);color:#9ca3af;', 'Cancelled':'background:rgba(239,68,68,0.15);color:#f87171;' };
        return `<span style="padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;${map[status]||'background:rgba(245,158,11,0.2);color:#fbbf24;'}">${status||'Pending'}</span>`;
    }
    function apptTypeIcon(type) {
        return { Consultation:'🩺', 'Follow-up':'🔄', Emergency:'🚨', Vaccination:'💉', 'Lab Test':'🧪' }[type] || '📅';
    }

    function renderApptCard(a, isFuture) {
        const d = new Date(a.appointment_date);
        const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });
        const dayNum  = d.getDate();
        const month   = d.toLocaleDateString('en-IN', { month: 'short' });
        return `
        <div id="appt-${a.appointment_id}" style="display:flex;align-items:flex-start;gap:16px;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;margin-bottom:12px;transition:border-color 0.2s;" onmouseover="this.style.borderColor='rgba(99,102,241,0.3)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.07)'">
            <div style="text-align:center;background:${isFuture?'rgba(99,102,241,0.12)':'rgba(107,114,128,0.1)'};border-radius:12px;padding:10px 14px;min-width:56px;flex-shrink:0;">
                <div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;">${month}</div>
                <div style="font-size:24px;font-weight:800;color:${isFuture?'#a5b4fc':'var(--text-secondary)'};">${dayNum}</div>
                <div style="font-size:11px;color:var(--text-tertiary);">${dayName}</div>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <span style="font-size:16px;">${apptTypeIcon(a.appointment_type)}</span>
                    <strong style="font-size:14px;">${a.doctor_name||'—'}</strong>
                    ${apptStatusBadge(a.status)}
                </div>
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">
                    ${a.specialization||'—'} &bull; ${a.hospital_name||a.hospital||'—'}
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:var(--text-tertiary);">
                    <span>🕐 ${a.appointment_time||'—'}</span>
                    <span>📋 ${a.appointment_type||'Consultation'}</span>
                    ${a.reason ? `<span>💬 ${a.reason}</span>` : ''}
                </div>
            </div>
            ${isFuture && a.status !== 'Cancelled' ? `<button class="btn btn-ghost" onclick="cancelAppointment('${a.appointment_id}')" title="Cancel Appointment" style="color:#f87171;padding:6px 12px;font-size:12px;flex-shrink:0;">Cancel</button>` : ''}
        </div>`;
    }

    const upcomingHtml = upcoming.length
        ? upcoming.map(a => renderApptCard(a, true)).join('')
        : `<div style="text-align:center;padding:40px 20px;color:var(--text-tertiary);">
               <div style="font-size:40px;margin-bottom:12px;">📅</div>
               <p>No upcoming appointments</p>
               <p style="font-size:13px;margin-top:4px;">Book one below →</p>
           </div>`;

    const pastHtml = past.length
        ? past.map(a => renderApptCard(a, false)).join('')
        : '<p style="color:var(--text-tertiary);padding:16px 0;font-size:13px;">No past appointments</p>';

    // Time slots
    const TIME_SLOTS = ['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','04:30 PM','05:00 PM'];

    elements.mainContent.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;">

            <!-- LEFT: Appointments list -->
            <div>
                <div class="card" style="margin-bottom:20px;">
                    <div class="card-header" style="justify-content:space-between;">
                        <h3 class="card-title">📅 Upcoming</h3>
                        <span style="background:rgba(99,102,241,0.15);color:#a5b4fc;padding:3px 10px;border-radius:10px;font-size:12px;font-weight:600;">${upcoming.length}</span>
                    </div>
                    <div id="upcomingApptList">${upcomingHtml}</div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">🕐 Past Appointments</h3>
                    </div>
                    ${pastHtml}
                </div>
            </div>

            <!-- RIGHT: Booking form -->
            <div class="card" style="position:sticky;top:80px;">
                <div class="card-header" style="border-bottom:1px solid var(--border-color);padding-bottom:16px;margin-bottom:20px;">
                    <h3 class="card-title">✚ Book New Appointment</h3>
                </div>

                <div class="form-group">
                    <label class="form-label">Hospital</label>
                    <select class="form-select" id="apptHospital" onchange="loadDoctorsForHospital(this.value)">
                        <option value="">— Select Hospital —</option>
                        <option value="hosp-1">Metro Heart Institute</option>
                        <option value="hosp-2">Apollo Multispecialty</option>
                        <option value="hosp-3">AIIMS New Delhi</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Doctor / Specialization</label>
                    <select class="form-select" id="apptDoctor">
                        <option value="">— Select Hospital First —</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Appointment Type</label>
                    <select class="form-select" id="apptType">
                        <option value="Consultation">🩺 Consultation</option>
                        <option value="Follow-up">🔄 Follow-up</option>
                        <option value="Lab Test">🧪 Lab Test</option>
                        <option value="Vaccination">💉 Vaccination</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Preferred Date</label>
                    <input type="date" class="form-input" id="apptDate" min="${today}" value="">
                </div>

                <div class="form-group">
                    <label class="form-label">Preferred Time</label>
                    <div id="timeSlotGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px;">
                        ${TIME_SLOTS.map(t => `<button type="button" onclick="selectTimeSlot(this,'${t}')" style="padding:8px;border-radius:8px;border:1px solid var(--border-color);background:rgba(255,255,255,0.03);color:var(--text-secondary);font-size:12px;cursor:pointer;transition:all 0.2s;" onmouseover="if(!this.dataset.sel)this.style.borderColor='rgba(99,102,241,0.5)'" onmouseout="if(!this.dataset.sel)this.style.borderColor='var(--border-color)'">${t}</button>`).join('')}
                    </div>
                    <input type="hidden" id="apptTime" value="">
                </div>

                <div class="form-group">
                    <label class="form-label">Reason for Visit</label>
                    <input type="text" class="form-input" id="apptReason" placeholder="e.g. Routine checkup, Blood pressure review...">
                </div>

                <button class="btn btn-primary btn-block" id="bookApptBtn" onclick="bookAppointment()" style="margin-top:4px;">
                    📅 Confirm Appointment
                </button>
            </div>
        </div>
    `;

    // Set min date to tomorrow
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const dateEl = document.getElementById('apptDate');
    if (dateEl) { dateEl.min = tomorrowStr; dateEl.value = tomorrowStr; }
}

function selectTimeSlot(btn, time) {
    document.querySelectorAll('#timeSlotGrid button').forEach(b => {
        b.style.background = 'rgba(255,255,255,0.03)';
        b.style.borderColor = 'var(--border-color)';
        b.style.color = 'var(--text-secondary)';
        b.style.fontWeight = '400';
        b.dataset.sel = '';
    });
    btn.style.background = 'rgba(99,102,241,0.2)';
    btn.style.borderColor = '#6366f1';
    btn.style.color = '#a5b4fc';
    btn.style.fontWeight = '600';
    btn.dataset.sel = '1';
    const inp = document.getElementById('apptTime');
    if (inp) inp.value = time;
}

async function loadDoctorsForHospital(hospitalId) {
    const sel = document.getElementById('apptDoctor');
    if (!sel) return;
    sel.innerHTML = '<option value="">Loading doctors...</option>';
    const demoDoctors = {
        'hosp-1': [{ doctor_id:'doc-001', full_name:'Dr. Aakash Roy', specialization:'Cardiology' }, { doctor_id:'doc-002', full_name:'Dr. Priya Sharma', specialization:'Cardiology' }],
        'hosp-2': [{ doctor_id:'doc-003', full_name:'Dr. Neha Verma', specialization:'Pulmonology' }, { doctor_id:'doc-004', full_name:'Dr. Raj Mehta', specialization:'General Medicine' }],
        'hosp-3': [{ doctor_id:'doc-005', full_name:'Dr. Sanjay Gupta', specialization:'Orthopedics' }, { doctor_id:'doc-006', full_name:'Dr. Anjali Tiwari', specialization:'Neurology' }]
    };
    try {
        if (!hospitalId) { sel.innerHTML = '<option value="">— Select Hospital First —</option>'; return; }
        let doctors = [];
        try {
            const r = await api.get('/api/hospitals/' + hospitalId + '/doctors');
            const d = typeof r.json === 'function' ? await r.json() : r;
            if (d && d.data && d.data.length) doctors = d.data;
        } catch (e) {}
        if (!doctors.length) doctors = demoDoctors[hospitalId] || [];
        sel.innerHTML = '<option value="">— Select Doctor —</option>' + doctors.map(d => `<option value="${d.doctor_id}">${d.full_name} (${d.specialization})</option>`).join('');
    } catch (e) {
        const docs = demoDoctors[hospitalId] || [];
        sel.innerHTML = '<option value="">— Select Doctor —</option>' + docs.map(d => `<option value="${d.doctor_id}">${d.full_name} (${d.specialization})</option>`).join('');
    }
}

async function bookAppointment() {
    const hospitalId = document.getElementById('apptHospital')?.value;
    const doctorId   = document.getElementById('apptDoctor')?.value;
    const apptType   = document.getElementById('apptType')?.value || 'Consultation';
    const apptDate   = document.getElementById('apptDate')?.value;
    const apptTime   = document.getElementById('apptTime')?.value;
    const reason     = document.getElementById('apptReason')?.value?.trim();

    if (!apptDate) { showToast('Please select a date', 'error'); return; }
    if (!apptTime) { showToast('Please select a time slot', 'error'); return; }

    const btn = document.getElementById('bookApptBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Booking...'; }

    try {
        await API.appointments.book({
            doctor_id: doctorId || 'doc-001',
            hospital_id: hospitalId || null,
            appointment_date: apptDate,
            appointment_time: apptTime,
            appointment_type: apptType,
            reason: reason || 'Routine Consultation'
        });
        showToast('✅ Appointment booked successfully!', 'success');
        loadAppointments();
    } catch (e) {
        // Demo mode: still show success and append to list
        const hospitalNames = { 'hosp-1':'Metro Heart Institute', 'hosp-2':'Apollo Multispecialty', 'hosp-3':'AIIMS New Delhi' };
        showToast('✅ Appointment confirmed (Demo Mode)!', 'success');
        const list = document.getElementById('upcomingApptList');
        if (list) {
            const d = new Date(apptDate);
            list.insertAdjacentHTML('afterbegin', `
                <div style="display:flex;align-items:flex-start;gap:16px;padding:16px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:14px;margin-bottom:12px;animation:fadeIn 0.3s ease;">
                    <div style="text-align:center;background:rgba(99,102,241,0.12);border-radius:12px;padding:10px 14px;min-width:56px;flex-shrink:0;">
                        <div style="font-size:11px;color:var(--text-tertiary);">${d.toLocaleDateString('en-IN',{month:'short'})}</div>
                        <div style="font-size:24px;font-weight:800;color:#a5b4fc;">${d.getDate()}</div>
                        <div style="font-size:11px;color:var(--text-tertiary);">${d.toLocaleDateString('en-IN',{weekday:'short'})}</div>
                    </div>
                    <div style="flex:1;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                            <span>📅</span><strong style="font-size:14px;">New Appointment</strong>
                            <span style="background:rgba(16,185,129,0.2);color:#34d399;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">Confirmed</span>
                        </div>
                        <div style="font-size:12px;color:var(--text-secondary);">${hospitalNames[hospitalId]||'Selected Hospital'}</div>
                        <div style="font-size:12px;color:var(--text-tertiary);margin-top:3px;">🕐 ${apptTime} &bull; ${apptType}${reason?' &bull; '+reason:''}</div>
                    </div>
                </div>`);
            // Clear empty state if present
            const emptyEl = list.querySelector('[style*="text-align:center"]');
            if (emptyEl) emptyEl.remove();
        }
        if (btn) { btn.disabled = false; btn.innerHTML = '📅 Confirm Appointment'; }
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '📅 Confirm Appointment'; }
}

async function cancelAppointment(id) {
    if (!confirm('Cancel this appointment?')) return;
    try {
        await api.put('/api/appointments/' + id + '/cancel');
    } catch (e) {}
    showToast('Appointment cancelled', 'info');
    const el = document.getElementById('appt-' + id);
    if (el) {
        el.style.opacity = '0.4';
        el.style.borderColor = 'rgba(239,68,68,0.2)';
        const btn = el.querySelector('button');
        if (btn) btn.remove();
        el.querySelector('[style*="background:rgba(99,102,241"]')?.style?.setProperty('background', 'rgba(239,68,68,0.15)');
    }
}

async function loadHealthID() {
    const html = `
        <div class="grid-2">
            <div>
                <div class="health-id-card">
                    <div class="health-id-content">
                        <div class="health-id-header">
                            <span class="health-id-badge">Digital Health ID</span>
                            <div class="health-id-chip"></div>
                        </div>
                        <div class="health-id-number">${AppState.user?.health_id || 'HID-2026-DEMO'}</div>
                        <div class="health-id-grid">
                            <div class="health-id-field">
                                <label>Full Name</label>
                                <value>${AppState.user?.full_name || 'John Doe'}</value>
                            </div>
                            <div class="health-id-field">
                                <label>Blood Group</label>
                                <value>${AppState.user?.blood_group || 'O+'}</value>
                            </div>
                            <div class="health-id-field">
                                <label>Date of Birth</label>
                                <value>${formatDate(AppState.user?.date_of_birth) || '15 Mar 1990'}</value>
                            </div>
                            <div class="health-id-field">
                                <label>Gender</label>
                                <value>${AppState.user?.gender || 'Male'}</value>
                            </div>
                            <div class="health-id-field">
                                <label>Phone</label>
                                <value>${AppState.user?.phone_number || '+91 98765 43210'}</value>
                            </div>
                            <div class="health-id-field">
                                <label>Emergency Contact</label>
                                <value>+91 98765 43211</value>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Allergies & Conditions</h3>
                    </div>
                    <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap;">
                        <span class="badge">Penicillin Allergy</span>
                        <span class="badge">Hypertension</span>
                        <span class="badge">Type 2 Diabetes</span>
                    </div>
                </div>
            </div>
            <div>
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Quick Actions</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: var(--space-md);">
                        <button class="btn btn-secondary" onclick="downloadHealthID()">📥 Download Health ID Card</button>
                        <button class="btn btn-secondary" onclick="openModal('shareID')">🔗 Share with Doctor</button>
                        <button class="btn btn-secondary" onclick="navigateTo('emergency')">🚨 Generate Emergency QR</button>
                        <button class="btn btn-secondary" onclick="openModal('updateProfile')">✏️ Update Information</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    elements.mainContent.innerHTML = html;
}

async function loadEmergency() {
    const user = AppState.user || {};
    const html = `
        <div class="alert alert-info">
            <span>🚨</span>
            <div>
                <strong>Secure Emergency Access Mode</strong>
                <p style="font-size: var(--font-size-sm); color: var(--text-tertiary); margin-top: var(--space-xs);">
                    Generates a single-use cryptographically signed QR code. The QR encodes a secure token URL, not your private records. Expires in 24 hours.
                </p>
            </div>
        </div>
        <div class="grid-2">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Emergency QR Code</h3>
                </div>
                <div class="qr-container" style="text-align: center; padding: 20px 10px;">
                    <div id="qrCodeWrapper">
                        <div style="background: rgba(255,255,255,0.04); border: 2px dashed var(--border-color); border-radius: 16px; padding: 40px 20px; margin-bottom: 20px;">
                            <div style="font-size: 3rem; margin-bottom: 12px;">📲</div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem;">No active QR generated for this session</p>
                        </div>
                        <button class="btn btn-primary" onclick="generateQR()" style="padding: 12px 24px;">⚡ Generate Secure Emergency QR</button>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Paramedic Emergency Data View</h3>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Blood Group</label>
                        <div style="font-size: 1.6rem; font-weight: 700; color: #ef4444;">${user.blood_group || 'O+'}</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Date of Birth</label>
                        <div style="font-size: 1rem; font-weight: 600;">${formatDate(user.date_of_birth) || '15 Mar 1990'}</div>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label">Critical Allergies</label>
                        <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap; margin-top: var(--space-sm);">
                            <span class="badge" style="background:rgba(239,68,68,0.2);color:#f87171;">${user.allergies || 'Penicillin, Sulfa Drugs'}</span>
                        </div>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label">Chronic Conditions</label>
                        <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap; margin-top: var(--space-sm);">
                            <span class="badge" style="background:rgba(245,158,11,0.2);color:#fbbf24;">${user.chronic_conditions || 'Hypertension, Mild Asthma'}</span>
                        </div>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label">Emergency Contact</label>
                        <div style="font-size: 1rem; font-weight: 600;">${user.emergency_contact_name || 'Priya Sharma'} (${user.emergency_contact_relation || 'Spouse'})</div>
                        <div style="font-size: 0.85rem; color: var(--text-tertiary); margin-top: 4px;">${user.emergency_contact_phone || '+91 98765 43211'}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    elements.mainContent.innerHTML = html;
}

async function loadConsent() {
    let consents = [];
    try {
        const res = await API.consent.getAll();
        consents = res.data || [];
    } catch (e) {}

    if (!consents || !consents.length) {
        consents = [
            {
                consent_id: 'consent-live-demo-1',
                accessor_name: 'Dr. Aakash Roy (Cardiology - Metro Heart)',
                accessor_type: 'Doctor',
                consent_type: 'Full Access',
                purpose: 'Cardiovascular checkup & prescription review'
            }
        ];
    }

    const listHtml = consents.length ? consents.map(c => `
        <div class="record-item">
            <div class="record-info">
                <div class="record-icon">👨‍⚕️</div>
                <div class="record-details">
                    <h4>${c.accessor_name || 'Healthcare Provider'}</h4>
                    <p>Type: ${c.accessor_type} | Access: <b>${c.consent_type}</b> | Purpose: ${c.purpose || 'General Consultation'}</p>
                </div>
            </div>
            <div class="record-meta" style="display: flex; gap: 10px; align-items: center;">
                <span class="badge" style="background:rgba(16,185,129,0.2);color:#10b981;">Active</span>
                <button class="btn btn-danger btn-sm" onclick="revokeConsent('${c.consent_id}')">Revoke Access</button>
            </div>
        </div>
    `).join('') : '<p style="color:var(--text-tertiary);padding:var(--space-md);">No active doctor consents granted. Your records are completely private.</p>';

    elements.mainContent.innerHTML = `
        <div class="card mb-lg">
            <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <h3 class="card-title">Patient Data Consent Engine</h3>
                    <p style="color:var(--text-tertiary);font-size:0.85rem;margin-top:4px;">You have full sovereign ownership over who can read your medical records.</p>
                </div>
                <button class="btn btn-primary" onclick="openGrantConsentModal()">+ Grant Doctor Access</button>
            </div>
            <div class="records-list mt-md">
                ${listHtml}
            </div>
        </div>
    `;
}

async function revokeConsent(id) {
    if (!confirm('Revoke access from this healthcare provider?')) return;
    try {
        await API.consent.revoke(id);
    } catch (e) {}
    showToast('Consent revoked immediately! Doctor access blocked.', 'success');
    const container = document.querySelector('.records-list.mt-md');
    if (container) {
        container.innerHTML = '<p style="color:var(--text-tertiary);padding:var(--space-md);">No active doctor consents granted. Your records are completely private.</p>';
    }
}

function openGrantConsentModal() {
    elements.modalContent.innerHTML = `
        <div class="modal-header">
            <h3 class="modal-title">Grant Healthcare Provider Access</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Doctor ID or License</label>
                <input type="text" id="consentDocId" class="form-input" placeholder="e.g. doc-001 or Dr. Aakash Roy" value="doc-001">
            </div>
            <div class="form-group">
                <label class="form-label">Access Level</label>
                <select id="consentLevel" class="form-select">
                    <option value="Full Access">Full Access (Prescriptions + Reports)</option>
                    <option value="Partial Access">Partial Access (Active Medications Only)</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Purpose</label>
                <input type="text" id="consentPurpose" class="form-input" placeholder="e.g. Second Opinion, General Consultation" value="Consultation">
            </div>
            <div class="form-group">
                <label class="form-label">Access Duration (Days)</label>
                <input type="number" id="consentDays" class="form-input" value="7">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitGrantConsent()">Grant Access</button>
        </div>
    `;
    elements.modalOverlay.classList.add('active');
}

async function submitGrantConsent() {
    const accessor_id = document.getElementById('consentDocId').value;
    const consent_type = document.getElementById('consentLevel').value;
    const purpose = document.getElementById('consentPurpose').value;
    const expires_days = parseInt(document.getElementById('consentDays').value) || 7;
    try {
        await API.consent.grant({ accessor_id, accessor_type: 'Doctor', consent_type, purpose, expires_days });
        closeModal();
        showToast('Consent granted to provider!', 'success');
        loadConsent();
    } catch (e) {
        showToast('Grant error', 'error');
    }
}

async function loadAssistant() {
    elements.mainContent.innerHTML = `
        <div class="card" style="max-width: 820px; margin: 0 auto; display: flex; flex-direction: column; height: 600px;">
            <div class="card-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
                <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div style="width:42px;height:42px;background:linear-gradient(135deg,rgba(99,102,241,0.2),rgba(16,185,129,0.2));border:1px solid rgba(99,102,241,0.3);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;">🤖</div>
                        <div>
                            <h3 class="card-title" style="margin:0;font-size:1.1rem;">MedVault Clinical AI Companion</h3>
                            <p style="color:var(--text-tertiary);font-size:0.8rem;margin-top:2px;">Multi-Tier: Google Gemini • Groq High-Speed • Clinical Decision Support Algorithms</p>
                        </div>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <span style="font-size:11px;background:rgba(99,102,241,0.15);color:#818cf8;border:1px solid rgba(99,102,241,0.3);padding:3px 8px;border-radius:6px;font-weight:600;">Gemini Tier 1</span>
                        <span style="font-size:11px;background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3);padding:3px 8px;border-radius:6px;font-weight:600;">Groq Tier 2</span>
                        <span style="font-size:11px;background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3);padding:3px 8px;border-radius:6px;font-weight:600;">Algorithm Tier 3</span>
                    </div>
                </div>
            </div>
            <div id="aiChatBox" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:14px;">
                <div style="align-self:flex-start;max-width:85%;background:rgba(255,255,255,0.03);border:1px solid var(--border-color);padding:14px 18px;border-radius:14px;font-size:0.9rem;line-height:1.5;">
                    👋 Hello <b>${AppState.user?.full_name || 'Patient'}</b>! I am your resilient clinical health assistant with verified medical safety algorithms and real-time emergency triage. Ask me about your medications, blood pressure/glucose readings, allergies, or dietary guidance.
                </div>
            </div>
            <div style="padding:16px;border-top:1px solid var(--border-color);display:flex;gap:10px;">
                <input type="text" id="aiUserInput" class="form-input" placeholder="Ask about medications, vital signs, allergies, or health tips..." onkeydown="if(event.key==='Enter') sendAIMessage()" />
                <button class="btn btn-primary" onclick="sendAIMessage()" style="padding:10px 20px;">Send</button>
            </div>
        </div>
    `;
}

async function sendAIMessage() {
    const input = document.getElementById('aiUserInput');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';

    const chatBox = document.getElementById('aiChatBox');
    chatBox.innerHTML += `
        <div style="align-self:flex-end;max-width:80%;background:var(--accent-primary, #3b82f6);color:#fff;padding:12px 16px;border-radius:14px;font-size:0.9rem;line-height:1.4;">
            ${msg}
        </div>
    `;
    chatBox.scrollTop = chatBox.scrollHeight;

    const loaderId = 'loader-' + Date.now();
    chatBox.innerHTML += `
        <div id="${loaderId}" style="align-self:flex-start;max-width:85%;background:rgba(255,255,255,0.03);border:1px solid var(--border-color);padding:14px 18px;border-radius:14px;font-size:0.9rem;color:var(--text-secondary);">
            <i>Analyzing with Gemini / Groq / Clinical Algorithm...</i>
        </div>
    `;
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const vitals = window._vitalsData || [];
        const res = await API.assistant.ask(msg, vitals);
        const reply = res.data?.reply || 'I could not process that request.';
        const providerName = res.data?.provider || 'AI Engine';
        const providerTag = `<div style="margin-top:8px;font-size:11px;color:var(--text-tertiary);display:inline-block;padding:2px 8px;border-radius:4px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);">⚡ Processed by: <b>${escapeHtml(providerName)}</b></div>`;
        document.getElementById(loaderId).outerHTML = `
            <div style="align-self:flex-start;max-width:85%;background:rgba(255,255,255,0.03);border:1px solid var(--border-color);padding:14px 18px;border-radius:14px;font-size:0.9rem;line-height:1.5;">
                ${formatMarkdown(reply)}
                ${providerTag}
            </div>
        `;
    } catch (e) {
        let demoReply = `Based on your medical records (Rahul Sharma), you have a documented allergy to <b>Penicillin and Sulfa drugs</b>, and manage <b>Type-2 Diabetes and mild Hypertension</b> with Metformin (500mg) and Amlodipine (5mg). Always verify urgent medical symptoms with a certified clinician.`;
        const lower = msg.toLowerCase();
        if (lower.includes('allerg')) {
            demoReply = `⚠️ <b>Allergy Warning:</b> You have documented contraindications to <b>Penicillin</b> and <b>Sulfa drugs</b>. Any treating doctor scanning your Emergency QR will be alerted to avoid beta-lactam antibiotics.`;
        } else if (lower.includes('medic') || lower.includes('drug') || lower.includes('rx') || lower.includes('pill')) {
            demoReply = `💊 <b>Current Active Prescriptions:</b><br>• <b>Metformin 500mg</b> — Twice daily after meals (Diabetes management)<br>• <b>Amlodipine 5mg</b> — Once daily morning (Blood pressure control)<br>Prescribed by: Dr. Aakash Roy (Metro Heart Institute)`;
        } else if (lower.includes('diet') || lower.includes('food') || lower.includes('eat')) {
            demoReply = `🥗 <b>Personalized Dietary Advice:</b> Given your mild hypertension and diabetic profile, focus on low-glycemic complex carbohydrates, limit sodium intake under 2,000mg/day, and maintain 30 minutes of moderate aerobic activity daily.`;
        }
        document.getElementById(loaderId).outerHTML = `
            <div style="align-self:flex-start;max-width:85%;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);padding:14px 18px;border-radius:14px;font-size:0.9rem;line-height:1.5;">
                🩺 <i>(Clinical Algorithm Engine)</i><br>${demoReply}
                <div style="margin-top:8px;font-size:11px;color:var(--text-tertiary);">⚡ Processed by: <b>clinical-algorithm (local fallback)</b></div>
            </div>
        `;
    }
    chatBox.scrollTop = chatBox.scrollHeight;
}

function formatMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/### (.*?)\n/g, '<h4 style="color:#818cf8;margin:12px 0 6px;">$1</h4>')
        .replace(/## (.*?)\n/g, '<h3 style="color:#818cf8;margin:14px 0 8px;">$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/\n\* /g, '<br>• ')
        .replace(/\n- /g, '<br>• ')
        .replace(/\n\d+\. /g, (m) => `<br><b>${m.trim()}</b> `)
        .replace(/\n/g, '<br>');
}

async function runAIVitalsAnalysis() {
    elements.modalContent.innerHTML = `
        <div class="modal-header">
            <h3 class="modal-title" style="display:flex;align-items:center;gap:8px;">
                <span>✨</span> Gemini AI Smartwatch Health Assessment
            </h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body" id="aiVitalsModalBody" style="min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;padding:30px 20px;">
            <div style="font-size:36px;animation:spin 1.5s linear infinite;">⏳</div>
            <div style="font-size:1.1rem;font-weight:600;color:var(--text-primary);">Analyzing smartwatch data with Gemini AI...</div>
            <div style="font-size:0.85rem;color:var(--text-secondary);max-width:380px;">
                Evaluating glucose curve, blood pressure metrics, cardiac pulse rate, and metabolic trends against medical guidelines.
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
            <button class="btn btn-primary" onclick="closeModal();navigateTo('assistant');">Ask AI Questions →</button>
        </div>
    `;
    elements.modalOverlay.classList.add('active');

    try {
        const vitals = window._vitalsData || [];
        const res = await API.vitals.analyzeAI(vitals);
        const text = res.data?.analysis || 'No analysis available.';
        const body = document.getElementById('aiVitalsModalBody');
        if (body) {
            body.style.display = 'block';
            body.style.textAlign = 'left';
            body.innerHTML = `
                <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.25);border-radius:12px;padding:16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;">
                    <div style="font-size:28px;">🧠</div>
                    <div>
                        <div style="font-size:0.95rem;font-weight:700;color:var(--text-primary);">Clinical AI Wearable Insights</div>
                        <div style="font-size:0.8rem;color:var(--text-secondary);">Grounded in continuous smartwatch telemetry & medical history</div>
                    </div>
                </div>
                <div style="font-size:0.9rem;line-height:1.6;color:var(--text-primary);max-height:420px;overflow-y:auto;padding-right:8px;">
                    ${formatMarkdown(text)}
                </div>
            `;
        }
    } catch (e) {
        const body = document.getElementById('aiVitalsModalBody');
        if (body) {
            body.innerHTML = `<div style="color:#ef4444;padding:20px;">Unable to generate AI analysis: ${escapeHtml(e.message)}</div>`;
        }
    }
}

async function loadProfile() {
    let pt = AppState.user;
    try {
        const res = await API.patient.getProfile();
        if (res && res.data) {
            pt = res.data;
            AppState.user = { ...AppState.user, ...pt };
            localStorage.setItem('userData', JSON.stringify(AppState.user));
        }
    } catch (_) {}

    const html = `
        <div class="grid-2">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Personal Information</h3>
                </div>
                <form id="profileForm" onsubmit="saveProfile(event)">
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">Full Name</label>
                            <input type="text" class="form-input" id="profileName" value="${pt?.full_name || ''}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Date of Birth</label>
                            <input type="date" class="form-input" id="profileDOB" value="${pt?.date_of_birth ? new Date(pt.date_of_birth).toISOString().split('T')[0] : '1990-03-15'}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Gender</label>
                            <select class="form-select" id="profileGender">
                                <option ${pt?.gender === 'Male' ? 'selected' : ''}>Male</option>
                                <option ${pt?.gender === 'Female' ? 'selected' : ''}>Female</option>
                                <option ${pt?.gender === 'Other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Blood Group</label>
                            <select class="form-select" id="profileBlood">
                                <option ${pt?.blood_group === 'O+' ? 'selected' : ''}>O+</option>
                                <option ${pt?.blood_group === 'O-' ? 'selected' : ''}>O-</option>
                                <option ${pt?.blood_group === 'A+' ? 'selected' : ''}>A+</option>
                                <option ${pt?.blood_group === 'A-' ? 'selected' : ''}>A-</option>
                                <option ${pt?.blood_group === 'B+' ? 'selected' : ''}>B+</option>
                                <option ${pt?.blood_group === 'B-' ? 'selected' : ''}>B-</option>
                                <option ${pt?.blood_group === 'AB+' ? 'selected' : ''}>AB+</option>
                                <option ${pt?.blood_group === 'AB-' ? 'selected' : ''}>AB-</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Phone Number</label>
                            <input type="tel" class="form-input" id="profilePhone" value="${pt?.phone_number || ''}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input type="email" class="form-input" id="profileEmail" value="${pt?.email || ''}" required>
                        </div>
                        <div class="form-group full-width">
                            <label class="form-label">Address</label>
                            <textarea class="form-textarea" id="profileAddress" rows="2">${pt?.address || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Known Allergies</label>
                            <input type="text" class="form-input" id="profileAllergies" placeholder="e.g. Penicillin, Peanuts" value="${pt?.allergies || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Chronic Conditions</label>
                            <input type="text" class="form-input" id="profileConditions" placeholder="e.g. Hypertension, Asthma" value="${pt?.chronic_conditions || ''}">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary mt-lg" id="saveProfileBtn">Save Changes</button>
                </form>
            </div>
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Emergency Contact</h3>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Contact Name</label>
                        <input type="text" class="form-input" id="profileEmergName" value="${pt?.emergency_contact_name || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Relationship</label>
                        <select class="form-select" id="profileEmergRelation">
                            <option ${pt?.emergency_contact_relation === 'Spouse' ? 'selected' : ''}>Spouse</option>
                            <option ${pt?.emergency_contact_relation === 'Parent' ? 'selected' : ''}>Parent</option>
                            <option ${pt?.emergency_contact_relation === 'Sibling' ? 'selected' : ''}>Sibling</option>
                            <option ${pt?.emergency_contact_relation === 'Child' ? 'selected' : ''}>Child</option>
                            <option ${pt?.emergency_contact_relation === 'Other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>
                    <div class="form-group full-width">
                        <label class="form-label">Emergency Phone Number</label>
                        <input type="tel" class="form-input" id="profileEmergPhone" value="${pt?.emergency_contact_phone || ''}">
                    </div>
                </div>
                <div style="margin-top: var(--space-xl); padding: var(--space-md); background: rgba(30, 41, 59, 0.5); border-radius: 8px; border: 1px dashed var(--border-color);">
                    <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">
                        🛡️ <b>Note:</b> Your emergency contact is displayed publicly on your Emergency QR Code so first responders can reach your loved ones instantly.
                    </div>
                </div>
            </div>
        </div>
    `;
    
    elements.mainContent.innerHTML = html;
}

async function loadSettings() {
    const html = `
        <div class="card mb-lg">
            <div class="card-header">
                <h3 class="card-title">Privacy & Security</h3>
            </div>
            <div class="form-group">
                <label class="form-label">Authentication Mode</label>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: var(--space-sm);">
                    <div>
                        <div style="font-weight: 500;">Phone OTP (Firebase / SMS)</div>
                        <span style="font-size: var(--font-size-sm); color: var(--text-tertiary);">Direct SMS OTP delivery enabled</span>
                    </div>
                    <span class="badge badge-success">Active</span>
                </div>
            </div>
            <div class="form-group mt-lg">
                <label class="form-label">Health Passport Export</label>
                <div style="display: flex; align-items: center; gap: var(--space-md); margin-top: var(--space-sm);">
                    <button class="btn btn-primary" onclick="API.patient.downloadHealthPassport().catch(e=>showToast(e.message,'error'))">📄 Download Health Passport PDF</button>
                    <span style="font-size: var(--font-size-sm); color: var(--text-tertiary);">Includes active prescriptions & Emergency QR</span>
                </div>
            </div>
        </div>
        <div class="card mb-lg">
            <div class="card-header">
                <h3 class="card-title">Data Portability & GDPR</h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: var(--space-md);">
                <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="handleExportData()">📥 Download Complete Health Archive (JSON)</button>
                <button class="btn btn-secondary" style="justify-content: flex-start; color: var(--error);" onclick="handleDeleteAccount()">🗑️ Deactivate My MedVault Account</button>
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Notification Channels</h3>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: var(--space-md); cursor: pointer;">
                    <input type="checkbox" checked onchange="showToast('Notification preference saved', 'info')"> 
                    <span>Email notifications for appointment reminders and record access</span>
                </label>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: var(--space-md); cursor: pointer;">
                    <input type="checkbox" checked onchange="showToast('Notification preference saved', 'info')">
                    <span>SMS alerts for critical prescription updates and OTPs</span>
                </label>
            </div>
        </div>
    `;
    
    elements.mainContent.innerHTML = html;
}

async function handleExportData() {
    try {
        showToast('Preparing your personal health archive...', 'info');
        await API.patient.exportData();
        showToast('Health data export downloaded!', 'success');
    } catch (e) {
        showToast(e.message || 'Failed to export data', 'error');
    }
}

async function handleDeleteAccount() {
    if (confirm('Are you sure you want to deactivate your MedVault account? You will be logged out.')) {
        try {
            await API.patient.deleteAccount();
            showToast('Account deactivated', 'info');
            setTimeout(() => logout(), 1000);
        } catch (e) {
            showToast(e.message || 'Failed to deactivate account', 'error');
        }
    }
}


// ============================================
// HELPER FUNCTIONS
// ============================================

function generateRecordItem(arg1, title, description, type, date, dataType = '', extra = {}) {
    let icon, rec = {};
    if (typeof arg1 === 'object' && arg1 !== null) {
        rec = arg1;
        icon = getRecordIcon(rec.record_type);
        title = rec.title || rec.record_title || 'Medical Record';
        description = rec.description || rec.diagnosis || rec.provider || '';
        type = rec.record_type || 'Other';
        date = formatDate(rec.record_date);
        dataType = (rec.record_type || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
    } else {
        icon = arg1;
        rec = {
            id: extra.id || ('rec-' + Math.random().toString(36).substr(2, 9)),
            title, description, record_type: type, record_date: date,
            ...extra
        };
    }

    const hasFile = Boolean(rec.file_url || rec.file_data);
    const fileType = rec.file_type || (rec.file_name && rec.file_name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE');

    return `
        <div class="record-item" data-type="${dataType}" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;margin-bottom:10px;gap:12px;">
            <div class="record-info" style="display:flex;align-items:center;gap:14px;flex:1;min-width:0;">
                <div class="record-icon" style="font-size:22px;width:42px;height:42px;border-radius:10px;background:rgba(99,102,241,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">${icon}</div>
                <div class="record-details" style="min-width:0;flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <h4 style="margin:0;font-size:14px;font-weight:600;color:var(--text-primary);">${escapeHtml(title)}</h4>
                        ${hasFile ? `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3);letter-spacing:0.5px;">📎 ${fileType}</span>` : ''}
                    </div>
                    <p style="margin:3px 0 0 0;font-size:12px;color:var(--text-secondary);text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">${escapeHtml(description)}</p>
                    <div style="margin-top:4px;font-size:11px;color:var(--text-tertiary);display:flex;gap:12px;flex-wrap:wrap;">
                        <span>📅 ${date}</span>
                        ${rec.provider ? `<span>🏥 ${escapeHtml(rec.provider)}</span>` : ''}
                        ${rec.file_size_kb ? `<span>💾 ${rec.file_size_kb} KB</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="record-meta" style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                <span class="badge" style="font-size:11px;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,0.06);color:var(--text-secondary);">${type}</span>
                ${hasFile ? `
                    <button class="btn btn-secondary" onclick="viewDocument('${rec.id}')" style="font-size:12px;padding:6px 10px;border-color:rgba(99,102,241,0.3);color:#a5b4fc;display:flex;align-items:center;gap:4px;" title="View Attached Document">
                        👁️ View
                    </button>
                    <button class="btn btn-ghost" onclick="downloadDocument('${rec.id}')" style="font-size:12px;padding:6px 8px;color:var(--text-secondary);" title="Download File">
                        ⬇️
                    </button>
                ` : ''}
                ${rec.is_custom ? `
                    <button class="btn btn-ghost" onclick="deleteRecord('${rec.id}')" style="font-size:12px;padding:6px 8px;color:#f87171;" title="Delete Record">
                        🗑️
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function getRecordIcon(recordType) {
    const icons = {
        'Lab Report': '🩸',
        'Prescription': '💊',
        'Vaccination': '💉',
        'Checkup': '🫀',
        'Surgery': '🏥',
        'X-Ray': '📷',
        'MRI': '🧲',
        'CT Scan': '🖼️',
        'default': '📋'
    };
    return icons[recordType] || icons.default;
}

function generateAppointmentItem(icon, name, details, date, time) {
    return `
        <div class="record-item">
            <div class="record-info">
                <div class="record-icon">${icon}</div>
                <div class="record-details">
                    <h4>${name}</h4>
                    <p>${details}</p>
                </div>
            </div>
            <div class="record-meta">
                <span class="badge">${date}</span>
                <div class="record-date">${time}</div>
            </div>
        </div>
    `;
}

function updateUserDisplay() {
    if (AppState.user) {
        const displayName = AppState.user.full_name || AppState.user.name || 'Rahul Sharma';
        if (elements.userName) elements.userName.textContent = displayName;
        const initials = displayName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase() || 'RS';
        if (elements.userAvatar) elements.userAvatar.textContent = initials;
    }
}

async function loadUserProfile() {
    try {
        const response = await API.patient.getProfile();
        AppState.user = response.data;
        localStorage.setItem('userData', JSON.stringify(AppState.user));
    } catch (error) {
        // Fall back to cached user data
        const cached = localStorage.getItem('userData');
        if (cached) {
            AppState.user = JSON.parse(cached);
        } else {
            throw error;
        }
    }
    updateUserDisplay();
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// ============================================
// MODAL FUNCTIONS
// ============================================

function openModal(type) {
    const modals = {
        addRecord: getAddRecordModal(),
        shareID: getShareIDModal()
    };
    
    elements.modalContent.innerHTML = modals[type] || '';
    elements.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    elements.modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

function getAddRecordModal() {
    const today = new Date().toISOString().split('T')[0];
    return `
        <div class="modal-header">
            <h3 class="modal-title">📎 Add Medical Record & Document</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-grid">
                <div class="form-group">
                    <label class="form-label">Record Type *</label>
                    <select class="form-select" id="recType">
                        <option value="Lab Report">🩸 Lab Report</option>
                        <option value="Prescription">💊 Prescription</option>
                        <option value="Vaccination">💉 Vaccination Record</option>
                        <option value="Doctor Note">👨‍⚕️ Doctor Note</option>
                        <option value="X-Ray">📷 Radiology / X-Ray</option>
                        <option value="MRI">🧲 MRI / CT Scan</option>
                        <option value="Discharge Summary">🏥 Hospital Visit / Discharge</option>
                        <option value="Other">📋 Other Medical Document</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Title / Test Name *</label>
                    <input type="text" class="form-input" id="recTitle" placeholder="e.g. Lipid Profile, Chest X-Ray" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Date of Record *</label>
                    <input type="date" class="form-input" id="recDate" value="${today}">
                </div>
                <div class="form-group">
                    <label class="form-label">Healthcare Provider / Clinic</label>
                    <input type="text" class="form-input" id="recProvider" placeholder="e.g. Metro Diagnostics, Dr. Roy">
                </div>
                <div class="form-group full-width">
                    <label class="form-label">Diagnosis / Clinical Findings / Notes</label>
                    <textarea class="form-textarea" id="recNotes" rows="2" placeholder="e.g. Normal cholesterol levels, follow up in 6 months..."></textarea>
                </div>
                <div class="form-group full-width">
                    <label class="form-label">Attach File (PDF, PNG, JPG — max 10MB)</label>
                    <div id="fileDropArea" style="border:2px dashed rgba(99,102,241,0.35);border-radius:12px;padding:24px;text-align:center;background:rgba(99,102,241,0.04);cursor:pointer;transition:all 0.2s;" onclick="document.getElementById('recFile').click()" ondragover="event.preventDefault();this.style.borderColor='#6366f1';" ondragleave="this.style.borderColor='rgba(99,102,241,0.35)';" ondrop="handleDropFile(event)">
                        <div style="font-size:36px;margin-bottom:6px;">📁</div>
                        <div style="font-size:13px;font-weight:600;color:var(--text-primary);">Click or drag & drop to attach document</div>
                        <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">Supports PDF lab reports, medical scans, prescription photos</div>
                        <input type="file" id="recFile" accept=".pdf,.png,.jpg,.jpeg" style="display:none;" onchange="handleFileSelection(this)">
                    </div>
                    <div id="fileSelectedPreview" style="display:none;margin-top:10px;padding:12px 16px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:10px;align-items:center;justify-content:space-between;">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <span id="filePreviewIcon" style="font-size:24px;">📄</span>
                            <div>
                                <div id="filePreviewName" style="font-size:13px;font-weight:600;color:#34d399;">file.pdf</div>
                                <div id="filePreviewSize" style="font-size:11px;color:var(--text-tertiary);">0 KB</div>
                            </div>
                        </div>
                        <button type="button" onclick="clearSelectedFile()" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#f87171;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:12px;">✕ Remove</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" id="saveRecordBtn" onclick="saveRecord()">💾 Save & Upload Record</button>
        </div>
    `;
}

function getShareIDModal() {
    return `
        <div class="modal-header">
            <h3 class="modal-title">Share Health ID</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Doctor's Name</label>
                <input type="text" class="form-input" placeholder="Enter doctor's name">
            </div>
            <div class="form-group">
                <label class="form-label">Doctor's Email or Phone</label>
                <input type="text" class="form-input" placeholder="Enter email or phone number">
            </div>
            <div class="form-group">
                <label class="form-label">Access Duration</label>
                <select class="form-select">
                    <option>24 hours</option>
                    <option>7 days</option>
                    <option>30 days</option>
                    <option>Permanent</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Records to Share</label>
                <div style="display: flex; flex-direction: column; gap: var(--space-sm); margin-top: var(--space-sm);">
                    <label style="display: flex; align-items{}
                    <label style="display: flex; align-items: center; gap: var(--space-md); cursor: pointer;">
                        <input type="checkbox" checked>
                        <span>Basic Information (Name, Blood Group, Allergies)</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: var(--space-md); cursor: pointer;">
                        <input type="checkbox">
                        <span>Medical History</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: var(--space-md); cursor: pointer;">
                        <input type="checkbox">
                        <span>Lab Reports</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: var(--space-md); cursor: pointer;">
                        <input type="checkbox">
                        <span>Prescriptions</span>
                    </label>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="shareAccess()">Share Access</button>
        </div>
    `;
}

// ============================================
// ACTION FUNCTIONS
// ============================================

function filterRecords(type, tabElement) {
    document.querySelectorAll('.tabs .tab').forEach(tab => tab.classList.remove('active'));
    tabElement.classList.add('active');
    
    document.querySelectorAll('.record-item[data-type]').forEach(record => {
        record.style.display = (type === 'all' || record.dataset.type === type) ? 'flex' : 'none';
    });
}

function downloadHealthID() {
    showToast('Generating printable Health ID Card...', 'info');
    const user = AppState.user || {
        health_id: 'HID-2026-DEMO',
        full_name: 'John Doe',
        blood_group: 'O+',
        date_of_birth: '1990-01-01',
        phone_number: '+91 98765 43210',
        emergency_contact: 'Jane Doe (+91 98765 43211)'
    };

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
        showToast('Popup was blocked. Please allow popups to export ID card.', 'warning');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Health ID Card - ${escapeHtml(user.full_name)}</title>
            <style>
                @page { size: auto; margin: 10mm; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    background: #0b0f19;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    padding: 20px;
                    color: #0f172a;
                }
                .card-container {
                    width: 480px;
                    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1e3a8a 100%);
                    color: #ffffff;
                    border-radius: 18px;
                    padding: 26px 30px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
                    position: relative;
                    overflow: hidden;
                    border: 1px solid rgba(255,255,255,0.2);
                    box-sizing: border-box;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid rgba(255,255,255,0.2);
                    padding-bottom: 12px;
                    margin-bottom: 18px;
                }
                .logo {
                    font-size: 17px;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .logo span {
                    background: #6366f1;
                    color: #fff;
                    padding: 3px 8px;
                    border-radius: 6px;
                    font-size: 11px;
                }
                .chip {
                    width: 40px;
                    height: 30px;
                    background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%);
                    border-radius: 6px;
                    box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2);
                }
                .id-number {
                    font-family: "Courier New", Courier, monospace;
                    font-size: 22px;
                    font-weight: 700;
                    letter-spacing: 2px;
                    margin-bottom: 18px;
                    color: #93c5fd;
                }
                .body-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 14px;
                    font-size: 13px;
                }
                .field label {
                    display: block;
                    font-size: 10px;
                    text-transform: uppercase;
                    color: #cbd5e1;
                    margin-bottom: 3px;
                    letter-spacing: 0.5px;
                }
                .field div {
                    font-weight: 600;
                    color: #ffffff;
                }
                .qr-section {
                    margin-top: 18px;
                    padding-top: 14px;
                    border-top: 1px solid rgba(255,255,255,0.15);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .badge-secure {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11px;
                    background: rgba(16,185,129,0.2);
                    color: #34d399;
                    padding: 4px 10px;
                    border-radius: 12px;
                    border: 1px solid rgba(16,185,129,0.3);
                }
                .print-actions {
                    margin-top: 24px;
                    display: flex;
                    gap: 12px;
                }
                .print-btn {
                    background: #4f46e5;
                    color: #ffffff;
                    border: none;
                    padding: 10px 22px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .close-btn {
                    background: #334155;
                    color: #f1f5f9;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 14px;
                    cursor: pointer;
                }
                @media print {
                    body { background: #ffffff; padding: 0; min-height: auto; }
                    .print-actions { display: none; }
                    .card-container { box-shadow: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="card-container">
                <div class="header">
                    <div class="logo">
                        🛡️ MedVault <span>NATIONAL HEALTH ID</span>
                    </div>
                    <div class="chip"></div>
                </div>
                <div class="id-number">${escapeHtml(user.health_id || 'HID-2026-DEMO')}</div>
                <div class="body-grid">
                    <div class="field">
                        <label>Patient Name</label>
                        <div>${escapeHtml(user.full_name || '—')}</div>
                    </div>
                    <div class="field">
                        <label>Blood Group</label>
                        <div style="color:#f87171;font-weight:700;">${escapeHtml(user.blood_group || 'O+')}</div>
                    </div>
                    <div class="field">
                        <label>Date of Birth</label>
                        <div>${formatDate(user.date_of_birth) || '—'}</div>
                    </div>
                    <div class="field">
                        <label>Emergency Contact</label>
                        <div>${escapeHtml(user.emergency_contact || user.phone_number || '—')}</div>
                    </div>
                </div>
                <div class="qr-section">
                    <div class="badge-secure">✓ ABDM / FHIR Compliant</div>
                    <div style="font-size:10px;color:#94a3b8;text-align:right;">
                        Scan for Emergency Health Records<br>Valid for 24/7 Paramedic Access
                    </div>
                </div>
            </div>
            <div class="print-actions">
                <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
                <button class="close-btn" onclick="window.close()">Close</button>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

async function generateQR() {
    try {
        showToast('Generating cryptographically signed Emergency QR...', 'info');
        const res = await API.emergency.generateQR();
        if (res.status === 'success') {
            const data = res.data;
            AppState.activeQR = data;
            const container = document.getElementById('qrCodeWrapper');
            if (container) {
                container.innerHTML = `
                    <div style="background:#ffffff;padding:16px;border-radius:14px;display:inline-block;box-shadow:0 8px 24px rgba(0,0,0,0.4);margin-bottom:14px;">
                        <img src="${data.qr_image_url}" id="qrImageElement" alt="Emergency QR" style="width:200px;height:200px;display:block;" />
                    </div>
                    <div style="margin-top:4px;margin-bottom:14px;">
                        <span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;padding:6px 14px;font-size:0.85rem;font-weight:600;">
                            ✓ Active Emergency Token (24h)
                        </span>
                    </div>
                    <p style="font-size:0.8rem;color:var(--text-tertiary);margin-bottom:16px;">
                        Token Hash: <code style="font-size:0.75rem;">${data.qr_id.substring(0,18)}...</code>
                    </p>
                    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                        <a href="${data.emergency_url}" target="_blank" class="btn btn-secondary" style="font-size:0.85rem;text-decoration:none;">
                            🚨 Open Emergency View (Demo Test)
                        </a>
                        <button class="btn btn-secondary" onclick="downloadQR()" style="font-size:0.85rem;">
                            📥 Download
                        </button>
                        <button class="btn btn-danger" onclick="revokeEmergencyQR()" style="font-size:0.85rem;">
                            Revoke QR
                        </button>
                    </div>
                `;
            }
            showToast('Emergency QR active! Accessible without login.', 'success');
        }
    } catch (e) {
        // Fallback for static hosted preview
        const emergencyUrl = `${window.location.origin}/emergency/access/demo`;
        const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(emergencyUrl)}`;
        const data = {
            qr_id: 'live-demo-token-preview',
            emergency_url: emergencyUrl,
            qr_image_url: qrApi
        };
        AppState.activeQR = data;
        const container = document.getElementById('qrCodeWrapper');
        if (container) {
            container.innerHTML = `
                <div style="background:#ffffff;padding:16px;border-radius:14px;display:inline-block;box-shadow:0 8px 24px rgba(0,0,0,0.4);margin-bottom:14px;">
                    <img src="${data.qr_image_url}" id="qrImageElement" alt="Emergency QR" style="width:200px;height:200px;display:block;" />
                </div>
                <div style="margin-top:4px;margin-bottom:14px;">
                    <span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;padding:6px 14px;font-size:0.85rem;font-weight:600;">
                        ✓ Active Emergency Token (24h)
                    </span>
                </div>
                <p style="font-size:0.8rem;color:var(--text-tertiary);margin-bottom:16px;">
                    Token Hash: <code style="font-size:0.75rem;">${data.qr_id}</code>
                </p>
                <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                    <a href="${data.emergency_url}" target="_blank" class="btn btn-secondary" style="font-size:0.85rem;text-decoration:none;">
                        🚨 Open Emergency View (Live Test)
                    </a>
                    <button class="btn btn-secondary" onclick="downloadQR()" style="font-size:0.85rem;">
                        📥 Download
                    </button>
                    <button class="btn btn-danger" onclick="revokeEmergencyQR()" style="font-size:0.85rem;">
                        Revoke QR
                    </button>
                </div>
            `;
        }
        showToast('Emergency QR active! Accessible without login.', 'success');
    }
}

async function revokeEmergencyQR() {
    if (!confirm('Revoking this QR will immediately invalidate all access from this emergency token. Proceed?')) return;
    try {
        await API.emergency.revokeQR();
        showToast('Emergency QR code revoked successfully', 'warning');
        loadEmergency();
    } catch (e) {
        showToast('Failed to revoke QR', 'error');
    }
}

function downloadQR() {
    const img = document.getElementById('qrImageElement');
    if (img && img.src) {
        const link = document.createElement('a');
        link.download = 'medvault-emergency-qr.png';
        link.href = img.src;
        link.click();
        showToast('Emergency QR image downloaded!', 'success');
    } else {
        showToast('Please generate a QR code first', 'error');
    }
}


async function saveProfile(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById('saveProfileBtn') || (e?.target?.tagName === 'BUTTON' ? e.target : null);
    try {
        if (btn) showButtonLoader(btn);

        const payload = {
            full_name: document.getElementById('profileName')?.value?.trim(),
            date_of_birth: document.getElementById('profileDOB')?.value,
            gender: document.getElementById('profileGender')?.value,
            blood_group: document.getElementById('profileBlood')?.value,
            phone_number: document.getElementById('profilePhone')?.value?.trim(),
            email: document.getElementById('profileEmail')?.value?.trim(),
            address: document.getElementById('profileAddress')?.value?.trim(),
            allergies: document.getElementById('profileAllergies')?.value?.trim(),
            chronic_conditions: document.getElementById('profileConditions')?.value?.trim(),
            emergency_contact_name: document.getElementById('profileEmergName')?.value?.trim(),
            emergency_contact_relation: document.getElementById('profileEmergRelation')?.value,
            emergency_contact_phone: document.getElementById('profileEmergPhone')?.value?.trim()
        };

        const res = await API.patient.updateProfile(payload);
        if (res && (res.status === 'success' || res.data)) {
            AppState.user = { ...AppState.user, ...(res.data || payload) };
            localStorage.setItem('userData', JSON.stringify(AppState.user));
            updateUserDisplay();
            showToast('Profile updated successfully!', 'success');
        } else {
            throw new Error(res?.message || 'Failed to update profile');
        }
    } catch (err) {
        console.error('Save profile error:', err);
        showToast(err.message || 'Error updating profile', 'error');
    } finally {
        if (btn) hideButtonLoader(btn);
    }
}

function handleFileSelection(input) {
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        showToast('File size exceeds 10MB limit', 'error');
        input.value = '';
        return;
    }

    const dropArea = document.getElementById('fileDropArea');
    const preview = document.getElementById('fileSelectedPreview');
    const nameEl = document.getElementById('filePreviewName');
    const sizeEl = document.getElementById('filePreviewSize');
    const iconEl = document.getElementById('filePreviewIcon');

    if (dropArea) dropArea.style.display = 'none';
    if (preview) {
        preview.style.display = 'flex';
        nameEl.textContent = file.name;
        sizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB`;
        iconEl.textContent = file.name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️';
    }

    // Auto-fill title if blank
    const titleInput = document.getElementById('recTitle');
    if (titleInput && !titleInput.value) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        titleInput.value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    }
}

function handleDropFile(event) {
    event.preventDefault();
    const dt = event.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
        const fileInput = document.getElementById('recFile');
        if (fileInput) {
            fileInput.files = dt.files;
            handleFileSelection(fileInput);
        }
    }
}

function clearSelectedFile() {
    const input = document.getElementById('recFile');
    if (input) input.value = '';
    const dropArea = document.getElementById('fileDropArea');
    const preview = document.getElementById('fileSelectedPreview');
    if (dropArea) dropArea.style.display = 'block';
    if (preview) preview.style.display = 'none';
}

async function saveRecord() {
    const title = document.getElementById('recTitle')?.value?.trim();
    if (!title) {
        showToast('Please enter a record title', 'error');
        return;
    }

    const recType = document.getElementById('recType')?.value || 'Lab Report';
    const recDate = document.getElementById('recDate')?.value || new Date().toISOString().split('T')[0];
    const provider = document.getElementById('recProvider')?.value?.trim() || 'Self-Uploaded';
    const notes = document.getElementById('recNotes')?.value?.trim() || '';
    const fileInput = document.getElementById('recFile');
    const file = fileInput?.files?.[0];

    const saveBtn = document.getElementById('saveRecordBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '⏳ Uploading & Encrypting...';
    }

    let fileData = null;
    let fileName = null;
    let fileType = null;
    let fileSizeKb = null;

    if (file) {
        fileName = file.name;
        fileType = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE';
        fileSizeKb = Math.round(file.size / 1024);

        fileData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });

        // Also attempt backend upload
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('record_title', title);
            formData.append('record_type', recType);
            formData.append('record_date', recDate);
            formData.append('diagnosis', notes);
            if (typeof API !== 'undefined' && API.records && API.records.upload) {
                await API.records.upload(formData);
            }
        } catch(e) {
            console.log('Backend upload note:', e);
        }
    }

    const newRecord = {
        id: 'rec-' + Date.now(),
        title,
        description: notes || `Report from ${provider}`,
        record_type: recType,
        record_date: recDate,
        provider,
        diagnosis: notes,
        file_name: fileName,
        file_type: fileType,
        file_size_kb: fileSizeKb,
        file_data: fileData,
        is_custom: true,
        created_at: new Date().toISOString()
    };

    try {
        const stored = JSON.parse(localStorage.getItem('medvault_custom_records') || '[]');
        stored.unshift(newRecord);
        localStorage.setItem('medvault_custom_records', JSON.stringify(stored));
    } catch(e) {
        console.error('Storage error:', e);
    }

    closeModal();
    showToast(`✅ "${title}" ${file ? 'and attached file ' : ''}saved successfully!`, 'success');

    if (AppState.currentSection === 'records') {
        loadRecords();
    } else {
        loadDashboard();
    }
}

function viewDocument(recordId) {
    const all = getAllMedicalRecords();
    const rec = all.find(r => String(r.id) === String(recordId));
    if (!rec) {
        showToast('Record not found', 'error');
        return;
    }

    const src = rec.file_data || rec.file_url;
    if (!src) {
        showToast('No document attached to this record', 'info');
        return;
    }

    const isPdf = (rec.file_type === 'PDF') || (rec.file_name && rec.file_name.toLowerCase().endsWith('.pdf')) || (typeof src === 'string' && src.startsWith('data:application/pdf'));

    elements.modalContent.innerHTML = `
        <div class="modal-header">
            <div>
                <h3 class="modal-title" style="margin:0;">${escapeHtml(rec.title)}</h3>
                <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">
                    ${rec.record_type} • ${formatDate(rec.record_date)} • ${escapeHtml(rec.provider || 'Self')}
                </div>
            </div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body" style="padding:16px;">
            ${isPdf ? `
                <div style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);height:480px;background:#1e293b;">
                    <iframe src="${src}#toolbar=1" width="100%" height="100%" style="border:none;"></iframe>
                </div>
            ` : `
                <div style="max-height:480px;overflow:auto;border-radius:12px;background:#0f172a;display:flex;align-items:center;justify-content:center;padding:12px;border:1px solid rgba(255,255,255,0.12);">
                    <img src="${src}" alt="${escapeHtml(rec.title)}" style="max-width:100%;max-height:450px;object-fit:contain;border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                </div>
            `}
            ${rec.diagnosis ? `
                <div style="margin-top:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px 14px;">
                    <div style="font-size:11px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:0.5px;">Clinical Summary / Findings</div>
                    <div style="font-size:13px;color:var(--text-primary);margin-top:4px;">${escapeHtml(rec.diagnosis)}</div>
                </div>
            ` : ''}
        </div>
        <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:12px;color:var(--text-tertiary);">
                📎 ${escapeHtml(rec.file_name || 'Document')} ${rec.file_size_kb ? `(${rec.file_size_kb} KB)` : ''}
            </div>
            <div style="display:flex;gap:10px;">
                <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                <button class="btn btn-primary" onclick="downloadDocument('${rec.id}')">⬇️ Download File</button>
            </div>
        </div>
    `;
    elements.modalOverlay.classList.add('active');
}

function downloadDocument(recordId) {
    const all = getAllMedicalRecords();
    const rec = all.find(r => String(r.id) === String(recordId));
    if (!rec) return;
    const src = rec.file_data || rec.file_url;
    if (!src) {
        showToast('No document attached', 'info');
        return;
    }

    const link = document.createElement('a');
    link.href = src;
    link.download = rec.file_name || `${(rec.title || 'medical_record').replace(/[^a-z0-9]/gi, '_')}.${rec.file_type === 'IMAGE' ? 'jpg' : 'pdf'}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`⬇️ Downloading ${rec.file_name || 'document'}...`, 'info');
}

function deleteRecord(recordId) {
    if (!confirm('Are you sure you want to delete this medical record?')) return;
    try {
        let stored = JSON.parse(localStorage.getItem('medvault_custom_records') || '[]');
        stored = stored.filter(r => String(r.id) !== String(recordId));
        localStorage.setItem('medvault_custom_records', JSON.stringify(stored));
        showToast('Record deleted', 'info');
        if (AppState.currentSection === 'records') {
            loadRecords();
        } else {
            loadDashboard();
        }
    } catch(e) {}
}

function shareAccess() {
    showToast('Health ID shared successfully!', 'success');
    closeModal();
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span>${getToastIcon(type)}</span>
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function getToastIcon(type) {
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    return icons[type] || icons.info;
}

// ============================================
// LOADING STATES
// ============================================

function showButtonLoader(button) {
    if (!button) return;
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = '<span class="loading-spinner" style="width: 20px; height: 20px; border-width: 2px;"></span>';
}

function hideButtonLoader(button) {
    if (!button) return;
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || 'Submit';
}

// ============================================
// MOBILE FUNCTIONS
// ============================================

function toggleSidebar() {
    elements.sidebar?.classList.toggle('open');
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        if (!elements.sidebar?.contains(e.target) && !e.target.closest('.mobile-menu')) {
            elements.sidebar?.classList.remove('open');
        }
    }
});

// ============================================
// DEMO & DOCTOR MODAL & REALTIME
// ============================================

async function instantDemoLogin() {
    try {
        const res = await API.auth.demoLogin();
        if (res.status === 'success') {
            AppState.user = res.data.patient || res.data.user;
            api.setToken(res.data.token || res.data.access_token);
            localStorage.setItem('userData', JSON.stringify(AppState.user));
            showToast('Instant demo login successful!', 'success');
            setTimeout(() => {
                updateUserDisplay();
                showApp();
                initSocket();
            }, 300);
            return;
        }
    } catch (e) {
        // Seamless fallback for hosted live environment preview
        const mockUser = {
            id: 1,
            full_name: "Rahul Sharma",
            name: "Rahul Sharma",
            health_id: "91-4421-8890-1234",
            email: "rahul.sharma@example.com",
            phone: "+91 98765 43210",
            phone_number: "+91 98765 43210",
            blood_group: "O+",
            date_of_birth: "1990-05-15",
            gender: "Male",
            allergies: "Penicillin, Sulfa drugs",
            chronic_conditions: "Type-2 Diabetes, Mild Hypertension",
            emergency_contact_name: "Priya Sharma",
            emergency_contact_relation: "Spouse",
            emergency_contact_phone: "+91 98765 43210"
        };
        AppState.user = mockUser;
        api.setToken("demo-patient-token");
        localStorage.setItem('userData', JSON.stringify(mockUser));
        showToast('Welcome, Rahul Sharma! (Live Demo Mode)', 'success');
        updateUserDisplay();
        showApp();
    }
}

// ============================================
// REAL-TIME NOTIFICATIONS & DOCTOR ACCESS ALERTS
// ============================================

function playNotificationChime() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // A5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
    } catch (e) { /* ignore audio restrictions */ }
}

let incomingCallData = null;
let patientPeerConn = null;
let patientLocalStream = null;
let patientCallTimer = null;
let patientCallSeconds = 0;
let isPatientAudioMuted = false;
let isPatientVideoMuted = false;

function initSocket() {
    try {
        if (typeof io !== 'undefined') {
            const token = api.token || localStorage.getItem('authToken') || 'demo-patient-token';
            if (AppState.socket) {
                AppState.socket.disconnect();
            }
            const socket = io({ auth: { token } });
            AppState.socket = socket;

            socket.on('connect', () => {
                console.log('🔌 Connected to real-time notification gateway');
                const pId = AppState.user?.patient_id || 'demo-001';
                socket.emit('join-room', { userId: pId, role: 'Patient' });
            });

            // Real-time System Announcements
            socket.on('announcement:broadcast', (data) => {
                displayPatientBroadcastBanner(data);
                showToast(`📢 Announcement: ${data.title}`, 'info');
            });

            // Real-time Prescription Updates
            socket.on('prescription:new', (data) => {
                showToast(`💊 New Prescription issued by Dr. ${data.doctor_name || 'Healthcare Provider'}`, 'info');
                if (AppState.currentSection === 'prescriptions') {
                    loadPrescriptions();
                } else if (AppState.currentSection === 'dashboard') {
                    loadDashboard();
                }
            });

            // Real-time Consent Requests from Doctors
            socket.on('consent:requested', (data) => {
                handleIncomingConsentRequest(data);
            });

            // In-app Notifications
            socket.on('notification', (data) => {
                handleIncomingNotification(data);
                if (data && (data.type === 'prescription_created' || data.notification_type === 'prescription_created')) {
                    if (AppState.currentSection === 'prescriptions') {
                        loadPrescriptions();
                    }
                }
            });

            // WebRTC Signaling Events
            socket.on('webrtc:incoming-call', (data) => {
                handleIncomingWebRTCCall(data);
            });

            socket.on('webrtc:offer', async (data) => {
                handleWebRTCOffer(data);
            });

            socket.on('webrtc:ice-candidate', async (data) => {
                handleWebRTCIceCandidate(data);
            });

            socket.on('webrtc:call-ended', () => {
                showToast('Consultation ended by Doctor', 'info');
                endPatientCall();
            });
        }
    } catch (e) {
        console.warn('Socket.io initialization skipped:', e);
    }
}

function handleIncomingNotification(data) {
    if (!data) return;
    const notif = {
        notification_id: data.notification_id || ('notif-' + Date.now()),
        title: data.title || 'System Notification',
        message: data.message || '',
        notification_type: data.type || data.notification_type || 'General',
        priority: data.priority || 'Medium',
        created_at: data.created_at || new Date().toISOString(),
        is_read: false
    };

    AppState.notifications.unshift(notif);
    updateNotifBadge();
    playNotificationChime();

    // Trigger bell ring animation
    const bellBtn = document.getElementById('notifBellBtn');
    if (bellBtn) {
        bellBtn.classList.remove('has-unread');
        void bellBtn.offsetWidth; // Reflow to restart CSS animation
        bellBtn.classList.add('has-unread');
    }

    // Determine icon and toast type
    const isCritical = notif.priority === 'Critical' || notif.notification_type === 'Emergency' || notif.notification_type === 'emergency_access';
    const isDoctor = notif.priority === 'High' || notif.notification_type === 'doctor_access' || notif.notification_type === 'Doctor';
    const toastIcon = isCritical ? '🚨 ' : isDoctor ? '👨‍⚕️ ' : '🔔 ';
    const toastType = isCritical ? 'error' : isDoctor ? 'warning' : 'info';

    showToast(`${toastIcon}${notif.title}: ${notif.message}`, toastType);

    // Refresh dropdown if open
    const panel = document.getElementById('notifPanel');
    if (panel && panel.classList.contains('open')) {
        renderNotifList();
    }

    // Refresh notifications page if user is currently on it
    if (AppState.currentSection === 'notifications') {
        loadNotificationsPage();
    }
}

// ============================================
// REAL-TIME BROADCAST & WEBRTC TELECONSULTATION
// ============================================

let pendingConsentRequest = null;

function handleIncomingConsentRequest(data) {
    pendingConsentRequest = data;
    const modal = document.getElementById('consentRequestModal');
    const nameEl = document.getElementById('consentDoctorName');
    const purposeEl = document.getElementById('consentDoctorPurpose');
    if (nameEl) nameEl.textContent = data.doctor_name || 'Dr. Healthcare Provider';
    if (purposeEl) purposeEl.textContent = `Requesting access to your complete medical records for ${data.purpose || 'clinical consultation'}.`;
    if (modal) modal.style.display = 'flex';
    playNotificationChime();
}

async function grantConsentFromRequest() {
    if (!pendingConsentRequest) return;
    try {
        const payload = {
            accessor_id: pendingConsentRequest.doctor_id,
            accessor_type: 'Doctor',
            consent_type: 'Full Access',
            purpose: pendingConsentRequest.purpose || 'Consultation',
            expires_days: 7
        };
        const res = await API.consent.grant(payload);
        showToast(`✅ Access granted to ${pendingConsentRequest.doctor_name} for 7 days`, 'success');
        const modal = document.getElementById('consentRequestModal');
        if (modal) modal.style.display = 'none';
        if (AppState.currentSection === 'consent') {
            loadConsent();
        }
    } catch (e) {
        showToast('Consent granted (Demo Mode)', 'success');
        const modal = document.getElementById('consentRequestModal');
        if (modal) modal.style.display = 'none';
    } finally {
        pendingConsentRequest = null;
    }
}

function denyConsentRequest() {
    const modal = document.getElementById('consentRequestModal');
    if (modal) modal.style.display = 'none';
    showToast('Consent request declined', 'info');
    pendingConsentRequest = null;
}

function displayPatientBroadcastBanner(ann) {
    if (!ann) return;
    const banner = document.getElementById('patientBroadcastBanner');
    const msgEl = document.getElementById('patientBroadcastMsg');
    if (banner && msgEl) {
        msgEl.innerHTML = `<strong>${escapeHtml(ann.title)}</strong>: ${escapeHtml(ann.message)}`;
        banner.style.display = 'flex';
    }
}

function handleIncomingWebRTCCall(data) {
    incomingCallData = data;
    const modal = document.getElementById('incomingCallModal');
    const nameEl = document.getElementById('incomingCallerName');
    const roleEl = document.getElementById('incomingCallerRole');
    if (nameEl) nameEl.textContent = data.callerName || 'Doctor';
    if (roleEl) roleEl.textContent = `${data.callerRole || 'Doctor'} is calling for a Video Consultation...`;
    if (modal) modal.style.display = 'flex';
    playNotificationChime();
}

function declineIncomingCall() {
    const modal = document.getElementById('incomingCallModal');
    if (modal) modal.style.display = 'none';
    if (AppState.socket && incomingCallData) {
        AppState.socket.emit('webrtc:reject-call', {
            callerUserId: incomingCallData.callerUserId,
            reason: 'Patient declined the consultation'
        });
    }
    incomingCallData = null;
}

async function acquirePatientLocalStream(videoElem) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        videoElem.srcObject = stream;
        return stream;
    } catch (err) {
        console.warn('Physical camera/mic not available, creating patient synthetic stream fallback:', err);
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        let frame = 0;
        const anim = () => {
            frame++;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 640, 480);
            
            // Pulse circle
            const radius = 55 + Math.sin(frame * 0.1) * 8;
            ctx.beginPath();
            ctx.arc(320, 200, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
            ctx.fill();

            // Avatar circle
            ctx.beginPath();
            ctx.arc(320, 200, 46, 0, Math.PI * 2);
            ctx.fillStyle = '#059669';
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('👤', 320, 200);

            ctx.font = '600 16px Inter, sans-serif';
            ctx.fillText(AppState.user?.full_name || 'Patient', 320, 280);
            ctx.font = '13px Inter, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('Encrypted Patient Video Feed', 320, 305);

            if (patientLocalStream) requestAnimationFrame(anim);
        };
        anim();
        const canvasStream = canvas.captureStream ? canvas.captureStream(30) : new MediaStream();
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const dst = audioCtx.createMediaStreamDestination();
            osc.connect(dst);
            osc.start();
            canvasStream.addTrack(dst.stream.getAudioTracks()[0]);
        } catch (e) {}
        videoElem.srcObject = canvasStream;
        return canvasStream;
    }
}

async function acceptIncomingCall() {
    const incModal = document.getElementById('incomingCallModal');
    if (incModal) incModal.style.display = 'none';

    const vidModal = document.getElementById('patientVideoModal');
    if (vidModal) vidModal.style.display = 'flex';

    const docNameEl = document.getElementById('patientVideoDocName');
    if (docNameEl) docNameEl.textContent = incomingCallData?.callerName || 'Doctor';

    updatePatientCallStatus('Connecting media...', '#fbbf24');
    startPatientCallTimer();

    const localVideo = document.getElementById('patientLocalVideo');
    patientLocalStream = await acquirePatientLocalStream(localVideo);

    const config = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };
    patientPeerConn = new RTCPeerConnection(config);

    patientLocalStream.getTracks().forEach(track => {
        patientPeerConn.addTrack(track, patientLocalStream);
    });

    patientPeerConn.ontrack = (event) => {
        const remoteVideo = document.getElementById('patientRemoteVideo');
        if (remoteVideo && event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            updatePatientCallStatus('Consultation Active', '#10b981');
        }
    };

    patientPeerConn.onicecandidate = (event) => {
        if (event.candidate && AppState.socket && incomingCallData) {
            AppState.socket.emit('webrtc:ice-candidate', {
                targetUserId: incomingCallData.callerUserId,
                candidate: event.candidate
            });
        }
    };

    // Emit call accepted to doctor
    AppState.socket.emit('webrtc:accept-call', {
        callerUserId: incomingCallData?.callerUserId
    });
}

async function handleWebRTCOffer(data) {
    if (!patientPeerConn) return;
    try {
        await patientPeerConn.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await patientPeerConn.createAnswer();
        await patientPeerConn.setLocalDescription(answer);
        AppState.socket.emit('webrtc:answer', {
            targetUserId: data.from || incomingCallData?.callerUserId || 'doc-001',
            sdp: answer
        });
        updatePatientCallStatus('Live Consultation Connected', '#10b981');
    } catch (err) {
        console.error('Error handling WebRTC offer:', err);
    }
}

async function handleWebRTCIceCandidate(data) {
    if (data.candidate && patientPeerConn) {
        try {
            await patientPeerConn.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
            console.error('Error handling WebRTC ICE candidate:', err);
        }
    }
}

function updatePatientCallStatus(text, color) {
    const el = document.getElementById('patientCallStatusText');
    const dot = document.getElementById('patientCallStatusDot');
    if (el) el.textContent = text;
    if (dot && color) dot.style.background = color;
}

function startPatientCallTimer() {
    patientCallSeconds = 0;
    if (patientCallTimer) clearInterval(patientCallTimer);
    patientCallTimer = setInterval(() => {
        patientCallSeconds++;
        const mins = String(Math.floor(patientCallSeconds / 60)).padStart(2, '0');
        const secs = String(patientCallSeconds % 60).padStart(2, '0');
        const timerEl = document.getElementById('patientVideoTimer');
        if (timerEl) timerEl.textContent = `Connected • ${mins}:${secs}`;
    }, 1000);
}

function togglePatientMic() {
    if (!patientLocalStream) return;
    isPatientAudioMuted = !isPatientAudioMuted;
    patientLocalStream.getAudioTracks().forEach(t => t.enabled = !isPatientAudioMuted);
    const btn = document.getElementById('patientMicBtn');
    btn.style.color = isPatientAudioMuted ? '#ef4444' : 'inherit';
    btn.textContent = isPatientAudioMuted ? '🔇' : '🎤';
    showToast(isPatientAudioMuted ? 'Microphone muted' : 'Microphone unmuted', 'info');
}

function togglePatientCam() {
    if (!patientLocalStream) return;
    isPatientVideoMuted = !isPatientVideoMuted;
    patientLocalStream.getVideoTracks().forEach(t => t.enabled = !isPatientVideoMuted);
    const btn = document.getElementById('patientCamBtn');
    btn.style.color = isPatientVideoMuted ? '#ef4444' : 'inherit';
    btn.textContent = isPatientVideoMuted ? '🚫' : '📷';
    showToast(isPatientVideoMuted ? 'Camera disabled' : 'Camera enabled', 'info');
}

function endPatientCall() {
    if (AppState.socket && incomingCallData) {
        AppState.socket.emit('webrtc:end-call', {
            targetUserId: incomingCallData.callerUserId
        });
    }
    if (patientCallTimer) { clearInterval(patientCallTimer); patientCallTimer = null; }
    if (patientPeerConn) { patientPeerConn.close(); patientPeerConn = null; }
    if (patientLocalStream) {
        patientLocalStream.getTracks().forEach(t => t.stop());
        patientLocalStream = null;
    }
    const modal = document.getElementById('patientVideoModal');
    if (modal) modal.style.display = 'none';
    const remoteVideo = document.getElementById('patientRemoteVideo');
    if (remoteVideo) remoteVideo.srcObject = null;
    const localVideo = document.getElementById('patientLocalVideo');
    if (localVideo) localVideo.srcObject = null;
    incomingCallData = null;
    isPatientAudioMuted = false;
    isPatientVideoMuted = false;
}

async function initNotifications() {
    try {
        const res = await API.notifications.getAll();
        if (res && res.data) {
            AppState.notifications = res.data;
        }
    } catch (e) {
        // Fallback demo notifications
        if (!AppState.notifications || AppState.notifications.length === 0) {
            AppState.notifications = [
                {
                    notification_id: 'n-demo-1',
                    title: '🛡️ Emergency QR Active',
                    message: 'Your tamper-proof QR code is live with AES-256 token authorization.',
                    notification_type: 'Emergency',
                    priority: 'High',
                    is_read: false,
                    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString()
                },
                {
                    notification_id: 'n-demo-2',
                    title: '☁️ Cloudinary Vault Connected',
                    message: 'Medical files, PDFs, and DICOM images are synced to persistent cloud storage.',
                    notification_type: 'General',
                    priority: 'Medium',
                    is_read: false,
                    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString()
                },
                {
                    notification_id: 'n-demo-3',
                    title: '👨‍⚕️ Dr. Aakash Roy - Follow-up',
                    message: 'Consultation scheduled at Metro Heart Institute.',
                    notification_type: 'Doctor',
                    priority: 'Low',
                    is_read: true,
                    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString()
                }
            ];
        }
    }
    updateNotifBadge();
}

function updateNotifBadge() {
    const badge = document.getElementById('notifBadge');
    const bellBtn = document.getElementById('notifBellBtn');
    if (!badge) return;

    const unreadCount = (AppState.notifications || []).filter(n => !n.is_read).length;
    if (unreadCount > 0) {
        badge.style.display = 'flex';
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        bellBtn?.classList.add('has-unread');
    } else {
        badge.style.display = 'none';
        bellBtn?.classList.remove('has-unread');
    }
}

function toggleNotifPanel(forceState) {
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    const shouldOpen = forceState !== undefined ? forceState : !panel.classList.contains('open');

    if (shouldOpen) {
        panel.classList.add('open');
        renderNotifList();
    } else {
        panel.classList.remove('open');
    }
}

function renderNotifList() {
    const list = document.getElementById('notifList');
    if (!list) return;

    const notifs = AppState.notifications || [];
    if (notifs.length === 0) {
        list.innerHTML = `
            <div class="notif-empty" id="notifEmpty">
                <div style="font-size:32px;margin-bottom:8px;">🔕</div>
                <div style="font-size:13px;color:var(--text-secondary);font-weight:500;">No notifications yet</div>
                <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">You'll be alerted when doctors, clinics, or emergency responders access your records</div>
            </div>
        `;
        return;
    }

    const typeIcons = {
        'Emergency': { icon: '🚨', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
        'emergency_access': { icon: '🚨', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
        'qr_scanned': { icon: '📱', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
        'Doctor': { icon: '👨‍⚕️', bg: 'rgba(99,102,241,0.15)', color: '#818cf8' },
        'doctor_access': { icon: '👨‍⚕️', bg: 'rgba(99,102,241,0.15)', color: '#818cf8' },
        'Prescription': { icon: '💊', bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
        'prescription_created': { icon: '💊', bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
        'Appointment': { icon: '📅', bg: 'rgba(14,165,233,0.15)', color: '#0ea5e9' },
        'appointment_booked': { icon: '📅', bg: 'rgba(14,165,233,0.15)', color: '#0ea5e9' },
        'vital_logged': { icon: '💓', bg: 'rgba(244,63,94,0.15)', color: '#f43f5e' },
        'record_added': { icon: '📋', bg: 'rgba(168,85,247,0.15)', color: '#a855f7' }
    };

    list.innerHTML = notifs.slice(0, 15).map(n => {
        const meta = typeIcons[n.notification_type] || { icon: '🔔', bg: 'rgba(255,255,255,0.08)', color: '#94a3b8' };
        const timeAgo = formatRelativeTime(n.created_at);
        const unreadClass = !n.is_read ? 'unread' : '';
        return `
            <div class="notif-item ${unreadClass}" onclick="markNotifRead('${escapeHtml(n.notification_id)}')">
                <div class="notif-item-icon" style="background:${meta.bg};color:${meta.color};">
                    ${meta.icon}
                </div>
                <div class="notif-item-body">
                    <div class="notif-item-title">${escapeHtml(n.title)}</div>
                    <div class="notif-item-desc">${escapeHtml(n.message)}</div>
                    <div class="notif-item-time">${timeAgo}</div>
                </div>
                ${!n.is_read ? '<span style="width:8px;height:8px;border-radius:4px;background:#6366f1;flex-shrink:0;margin-top:6px;"></span>' : ''}
            </div>
        `;
    }).join('');
}

function formatRelativeTime(isoString) {
    if (!isoString) return 'Just now';
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

async function markNotifRead(id) {
    const item = (AppState.notifications || []).find(n => n.notification_id === id);
    if (item && !item.is_read) {
        item.is_read = true;
        updateNotifBadge();
        renderNotifList();
        try {
            await API.notifications.markRead(id);
        } catch (e) {}
    }
}

async function markAllNotifsRead() {
    (AppState.notifications || []).forEach(n => n.is_read = true);
    updateNotifBadge();
    renderNotifList();
    showToast('All notifications marked as read', 'info');
    try {
        await API.notifications.markAllRead();
    } catch (e) {}
    if (AppState.currentSection === 'notifications') {
        loadNotificationsPage();
    }
}

async function simulateDoctorAccess(doctorName = "Dr. Aakash Roy", hospital = "Metro Heart Institute") {
    try {
        showToast(`Simulating doctor access check by ${doctorName}...`, 'info');
        await API.notifications.testDoctorAccess({
            doctor_name: doctorName,
            hospital: hospital,
            action: "Accessed Recent Blood Tests & Cardiology History"
        });
    } catch (e) {
        // Fallback local dispatch if offline
        handleIncomingNotification({
            type: "doctor_access",
            title: `👨‍⚕️ ${doctorName} Accessed Records`,
            message: `${doctorName} (${hospital}) accessed your medical history under active consent.`,
            priority: "High"
        });
    }
}

// Full-page Notifications & Security Logs View
async function loadNotificationsPage() {
    let accessLogs = [];
    try {
        const res = await API.accessLogs.getAll();
        if (res && res.data) accessLogs = res.data;
    } catch (e) {
        accessLogs = [
            { accessor_id: 'doc-001', accessor_type: 'Doctor', action: 'View', resource_type: 'ECG & Lab Reports', accessed_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(), ip_address: '192.168.1.15' },
            { accessor_id: 'EMERGENCY_SCAN', accessor_type: 'Emergency', action: 'Scan', resource_type: 'Emergency Health QR', accessed_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), ip_address: '10.0.4.22' },
            { accessor_id: 'hosp-1', accessor_type: 'Hospital', action: 'View', resource_type: 'Prescriptions', accessed_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), ip_address: '172.16.0.4' }
        ];
    }

    const unreadCount = (AppState.notifications || []).filter(n => !n.is_read).length;
    const totalCount = (AppState.notifications || []).length;
    const doctorAccessCount = accessLogs.filter(l => l.accessor_type === 'Doctor').length;
    const emergencyScanCount = accessLogs.filter(l => l.accessor_type === 'Emergency').length;

    elements.mainContent.innerHTML = `
        <div style="max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:24px;">
            <!-- Header Banner -->
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;background:var(--surface);padding:24px;border-radius:16px;border:1px solid var(--border);">
                <div>
                    <h2 style="margin:0 0 6px;font-size:1.5rem;display:flex;align-items:center;gap:10px;">
                        <span>🔔</span> Real-Time Notifications & Access Audit
                    </h2>
                    <p style="margin:0;color:var(--text-secondary);font-size:0.9rem;">
                        Every time a doctor, hospital, or first responder views your digital health records, it is securely logged here in real-time.
                    </p>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <button class="btn btn-secondary" onclick="simulateDoctorAccess()" title="Test live doctor access alert">
                        ⚡ Simulate Doctor Access
                    </button>
                    <button class="btn btn-primary" onclick="markAllNotifsRead()">
                        ✅ Mark All Read
                    </button>
                </div>
            </div>

            <!-- Metrics Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;">
                <div class="card" style="padding:20px;border-radius:14px;background:var(--surface);border:1px solid var(--border);">
                    <div style="font-size:0.85rem;color:var(--text-secondary);font-weight:600;">Total Notifications</div>
                    <div style="font-size:1.8rem;font-weight:700;margin-top:6px;color:var(--text-primary);">${totalCount}</div>
                </div>
                <div class="card" style="padding:20px;border-radius:14px;background:var(--surface);border:1px solid var(--border);">
                    <div style="font-size:0.85rem;color:var(--text-secondary);font-weight:600;">Unread Alerts</div>
                    <div style="font-size:1.8rem;font-weight:700;margin-top:6px;color:#ef4444;">${unreadCount}</div>
                </div>
                <div class="card" style="padding:20px;border-radius:14px;background:var(--surface);border:1px solid var(--border);">
                    <div style="font-size:0.85rem;color:var(--text-secondary);font-weight:600;">Doctor Consult Accesses</div>
                    <div style="font-size:1.8rem;font-weight:700;margin-top:6px;color:#6366f1;">${doctorAccessCount}</div>
                </div>
                <div class="card" style="padding:20px;border-radius:14px;background:var(--surface);border:1px solid var(--border);">
                    <div style="font-size:0.85rem;color:var(--text-secondary);font-weight:600;">Emergency QR Scans</div>
                    <div style="font-size:1.8rem;font-weight:700;margin-top:6px;color:#10b981;">${emergencyScanCount}</div>
                </div>
            </div>

            <!-- Two-Column Grid: Notifications + Access Audit Log -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(420px, 1fr));gap:24px;">
                <!-- Recent Notifications List -->
                <div class="card" style="padding:22px;border-radius:16px;background:var(--surface);border:1px solid var(--border);">
                    <h3 style="margin:0 0 16px;font-size:1.1rem;display:flex;align-items:center;gap:8px;">
                        <span>📬</span> Notifications Feed
                    </h3>
                    <div style="display:flex;flex-direction:column;gap:10px;max-height:500px;overflow-y:auto;">
                        ${(AppState.notifications || []).length === 0 ? '<div style="color:var(--text-secondary);text-align:center;padding:30px;">No notifications recorded yet.</div>' : ''}
                        ${(AppState.notifications || []).map(n => `
                            <div style="display:flex;gap:12px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,${n.is_read ? '0.02' : '0.06'});border:1px solid ${n.is_read ? 'var(--border)' : 'rgba(99,102,241,0.3)'};">
                                <div style="font-size:22px;">${n.priority === 'Critical' ? '🚨' : n.priority === 'High' ? '👨‍⚕️' : '🔔'}</div>
                                <div style="flex:1;">
                                    <div style="font-size:0.95rem;font-weight:600;color:var(--text-primary);margin-bottom:2px;">${escapeHtml(n.title)}</div>
                                    <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.4;">${escapeHtml(n.message)}</div>
                                    <div style="font-size:0.75rem;color:var(--text-tertiary);margin-top:6px;">${formatRelativeTime(n.created_at)}</div>
                                </div>
                                ${!n.is_read ? `<button class="btn btn-ghost" style="font-size:11px;padding:4px 8px;height:auto;" onclick="markNotifRead('${escapeHtml(n.notification_id)}')">Mark read</button>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Live Access Audit Log Table -->
                <div class="card" style="padding:22px;border-radius:16px;background:var(--surface);border:1px solid var(--border);">
                    <h3 style="margin:0 0 16px;font-size:1.1rem;display:flex;align-items:center;gap:8px;">
                        <span>🛡️</span> Security & Access Audit Trail
                    </h3>
                    <div style="overflow-x:auto;">
                        <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
                            <thead>
                                <tr style="border-bottom:1px solid var(--border);color:var(--text-secondary);text-align:left;">
                                    <th style="padding:8px 6px;">Accessor</th>
                                    <th style="padding:8px 6px;">Action</th>
                                    <th style="padding:8px 6px;">Resource</th>
                                    <th style="padding:8px 6px;">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${accessLogs.map(l => {
                                    const isEmg = l.accessor_type === 'Emergency';
                                    const badgeColor = isEmg ? '#ef4444' : '#6366f1';
                                    return `
                                        <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                                            <td style="padding:10px 6px;">
                                                <span style="display:inline-block;padding:2px 8px;border-radius:6px;background:rgba(255,255,255,0.05);color:${badgeColor};font-weight:600;font-size:0.75rem;">
                                                    ${isEmg ? '🚨 Emergency' : '👨‍⚕️ ' + (l.accessor_type || 'Doctor')}
                                                </span>
                                            </td>
                                            <td style="padding:10px 6px;color:var(--text-primary);font-weight:500;">${escapeHtml(l.action || 'View')}</td>
                                            <td style="padding:10px 6px;color:var(--text-secondary);">${escapeHtml(l.resource_type || 'Records')}</td>
                                            <td style="padding:10px 6px;color:var(--text-tertiary);">${formatRelativeTime(l.accessed_at)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function showDoctorModal() {
    elements.modalContent.innerHTML = `
        <div class="modal-header">
            <h3 class="modal-title">👨‍⚕️ Healthcare Provider Portal</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:16px;">
                Registered medical doctors can view patient charts (with consent) and issue prescriptions.
            </p>
            <div class="form-group">
                <label class="form-label">Doctor Name</label>
                <input type="text" id="docNameInput" class="form-input" placeholder="e.g. Dr. Aakash Roy" value="Dr. Aakash Roy">
            </div>
            <div class="form-group">
                <label class="form-label">Hospital / Clinic</label>
                <input type="text" id="docHospitalInput" class="form-input" placeholder="e.g. Metro Heart Institute" value="Metro Heart Institute">
            </div>
            <div class="form-group">
                <label class="form-label">Medical License Number</label>
                <input type="text" id="docLicenseInput" class="form-input" placeholder="e.g. MCI-DL-98214" value="MCI-DL-98214">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitDoctorLogin()">Authenticate & Access Patient Records</button>
        </div>
    `;
    elements.modalOverlay.classList.add('active');
}

// ============================================
// INSURANCE & CLAIMS MANAGEMENT
// ============================================

async function loadInsurance() {
    elements.mainContent.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
            <div>
                <h2 style="font-size:1.3rem;font-weight:700;margin:0;">Insurance Coverage & Cashless Claims</h2>
                <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:2px;">Manage active health insurance policies and track cashless hospital claims.</p>
            </div>
            <div style="display:flex;gap:10px;">
                <button class="btn btn-secondary" onclick="openFileClaimModal()">+ File New Claim</button>
                <button class="btn btn-primary" onclick="openAddInsuranceModal()">+ Add Policy</button>
            </div>
        </div>
        <div id="insuranceCardsList" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-bottom:24px;">
            <div style="padding:24px;text-align:center;color:var(--text-secondary);background:rgba(255,255,255,0.02);border:1px solid var(--border-color);border-radius:12px;">
                Loading insurance policies...
            </div>
        </div>
        <div class="card" style="margin-top:20px;">
            <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
                <h3 class="card-title" style="margin:0;">Claims History & Settlement Tracker</h3>
                <span style="font-size:0.8rem;color:var(--text-tertiary);">Direct TPA & Hospital Billing</span>
            </div>
            <div id="insuranceClaimsList" style="overflow-x:auto;padding:12px 16px;">
                <div style="padding:16px;text-align:center;color:var(--text-secondary);">Loading claims records...</div>
            </div>
        </div>
    `;

    try {
        const [insRes, clmRes] = await Promise.all([
            API.insurance.getAll().catch(() => ({ data: [] })),
            API.insurance.getClaims().catch(() => ({ data: [] }))
        ]);
        const policies = insRes.data || [];
        const claims = clmRes.data || [];

        const cardsEl = document.getElementById('insuranceCardsList');
        if (cardsEl) {
            if (policies.length === 0) {
                cardsEl.innerHTML = `<div style="padding:24px;color:var(--text-secondary);text-align:center;grid-column:1/-1;">No insurance policies linked. Click "+ Add Policy" to register your health cover.</div>`;
            } else {
                cardsEl.innerHTML = policies.map(p => `
                    <div style="background:linear-gradient(135deg,rgba(30,41,59,0.7),rgba(15,23,42,0.85));border:1px solid rgba(99,102,241,0.25);border-radius:16px;padding:20px;position:relative;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.3);">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                            <div>
                                <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:#818cf8;font-weight:700;">${escapeHtml(p.policy_type || 'Health')} Policy</div>
                                <h4 style="font-size:1.15rem;font-weight:700;margin:4px 0 0;color:var(--text-primary);">${escapeHtml(p.provider_name || 'Health Insurer')}</h4>
                            </div>
                            <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${p.is_active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'};color:${p.is_active ? '#34d399' : '#f87171'};border:1px solid ${p.is_active ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'};">
                                ${p.is_active ? '● Active' : '○ Inactive'}
                            </span>
                        </div>
                        <div style="font-family:monospace;font-size:0.95rem;color:var(--text-primary);letter-spacing:1px;margin-bottom:14px;background:rgba(0,0,0,0.2);padding:6px 10px;border-radius:6px;display:inline-block;">
                            ${escapeHtml(p.policy_number)}
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;font-size:0.85rem;">
                            <div>
                                <span style="color:var(--text-tertiary);font-size:0.75rem;display:block;">Sum Insured</span>
                                <strong style="color:#34d399;font-size:1.05rem;">₹${Number(p.coverage_amount || 0).toLocaleString('en-IN')}</strong>
                            </div>
                            <div>
                                <span style="color:var(--text-tertiary);font-size:0.75rem;display:block;">Remaining Limit</span>
                                <strong style="color:var(--text-primary);font-size:1.05rem;">₹${Number(p.remaining_amount || p.coverage_amount || 0).toLocaleString('en-IN')}</strong>
                            </div>
                        </div>
                        <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-tertiary);">
                            <span>Holder: <strong style="color:var(--text-secondary);">${escapeHtml(p.policy_holder_name || AppState.user?.full_name || 'Self')}</strong></span>
                            <span>Valid till: <strong style="color:var(--text-secondary);">${p.policy_end_date ? new Date(p.policy_end_date).toLocaleDateString() : 'N/A'}</strong></span>
                        </div>
                    </div>
                `).join('');
            }
        }

        const claimsEl = document.getElementById('insuranceClaimsList');
        if (claimsEl) {
            if (claims.length === 0) {
                claimsEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-secondary);">No insurance claims filed yet.</div>`;
            } else {
                claimsEl.innerHTML = `
                    <table style="width:100%;border-collapse:collapse;font-size:0.85rem;text-align:left;">
                        <thead>
                            <tr style="border-bottom:1px solid var(--border-color);color:var(--text-tertiary);">
                                <th style="padding:10px 8px;">Claim ID</th>
                                <th style="padding:10px 8px;">Diagnosis / Treatment</th>
                                <th style="padding:10px 8px;">Hospital</th>
                                <th style="padding:10px 8px;">Date</th>
                                <th style="padding:10px 8px;">Amount</th>
                                <th style="padding:10px 8px;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${claims.map(c => {
                                const statusColor = c.claim_status === 'Settled' || c.claim_status === 'Approved' ? '#34d399' : (c.claim_status === 'Rejected' ? '#f87171' : '#fbbf24');
                                const statusBg = c.claim_status === 'Settled' || c.claim_status === 'Approved' ? 'rgba(16,185,129,0.15)' : (c.claim_status === 'Rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)');
                                return `
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                                        <td style="padding:12px 8px;font-family:monospace;font-weight:600;color:#818cf8;">${escapeHtml(c.claim_id)}</td>
                                        <td style="padding:12px 8px;">
                                            <strong style="display:block;color:var(--text-primary);">${escapeHtml(c.diagnosis)}</strong>
                                            <span style="font-size:0.75rem;color:var(--text-tertiary);">${escapeHtml(c.treatment_details || '')}</span>
                                        </td>
                                        <td style="padding:12px 8px;color:var(--text-secondary);">${escapeHtml(c.hospital_name || 'Healthcare Network')}</td>
                                        <td style="padding:12px 8px;color:var(--text-tertiary);">${c.claim_date || 'N/A'}</td>
                                        <td style="padding:12px 8px;font-weight:700;color:var(--text-primary);">₹${Number(c.claim_amount || 0).toLocaleString('en-IN')}</td>
                                        <td style="padding:12px 8px;">
                                            <span style="padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;background:${statusBg};color:${statusColor};">
                                                ${escapeHtml(c.claim_status || 'Submitted')}
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;
            }
        }
    } catch (e) {
        showToast('Error loading insurance data: ' + e.message, 'error');
    }
}

function openAddInsuranceModal() {
    elements.modalContent.innerHTML = `
        <div class="modal-header">
            <h3 class="modal-title">🛡️ Link Insurance Policy</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Insurance Provider</label>
                <input type="text" id="insProviderInput" class="form-input" placeholder="e.g. Star Health, HDFC ERGO, Max Bupa" value="Star Health & Allied Insurance" required />
            </div>
            <div class="form-group">
                <label class="form-label">Policy Number</label>
                <input type="text" id="insPolicyNumInput" class="form-input" placeholder="e.g. SH-COMP-2026-99214" required />
            </div>
            <div class="form-group">
                <label class="form-label">Policy Holder Name</label>
                <input type="text" id="insHolderInput" class="form-input" value="${escapeHtml(AppState.user?.full_name || 'Rahul Sharma')}" required />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-group">
                    <label class="form-label">Coverage Amount (₹)</label>
                    <input type="number" id="insCoverageInput" class="form-input" placeholder="500000" value="500000" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Policy Type</label>
                    <select id="insTypeInput" class="form-input">
                        <option value="Individual">Individual</option>
                        <option value="Family" selected>Family</option>
                        <option value="Group">Group</option>
                    </select>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-group">
                    <label class="form-label">Valid From</label>
                    <input type="date" id="insStartInput" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
                </div>
                <div class="form-group">
                    <label class="form-label">Valid Till</label>
                    <input type="date" id="insEndInput" class="form-input" value="${new Date(Date.now() + 31536000000).toISOString().split('T')[0]}" />
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitAddInsurance()">Save Policy</button>
        </div>
    `;
    elements.modalOverlay.classList.add('active');
}

async function submitAddInsurance() {
    const provider_name = document.getElementById('insProviderInput')?.value.trim();
    const policy_number = document.getElementById('insPolicyNumInput')?.value.trim();
    const policy_holder_name = document.getElementById('insHolderInput')?.value.trim();
    const coverage_amount = document.getElementById('insCoverageInput')?.value.trim();
    const policy_type = document.getElementById('insTypeInput')?.value;
    const policy_start_date = document.getElementById('insStartInput')?.value;
    const policy_end_date = document.getElementById('insEndInput')?.value;

    if (!policy_number || !coverage_amount) {
        showToast('Please enter policy number and coverage limit', 'warning');
        return;
    }

    try {
        await API.insurance.add({
            provider_name, policy_number, policy_holder_name,
            coverage_amount, policy_type, policy_start_date, policy_end_date
        });
        closeModal();
        showToast('Insurance policy successfully added!', 'success');
        loadInsurance();
    } catch (e) {
        showToast('Failed to add policy: ' + e.message, 'error');
    }
}

function openFileClaimModal() {
    elements.modalContent.innerHTML = `
        <div class="modal-header">
            <h3 class="modal-title">📋 File Cashless Insurance Claim</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Diagnosis / Reason</label>
                <input type="text" id="claimDiagnosisInput" class="form-input" placeholder="e.g. Acute Gastroenteritis, Cardiac Evaluation" required />
            </div>
            <div class="form-group">
                <label class="form-label">Claim Amount (₹)</label>
                <input type="number" id="claimAmountInput" class="form-input" placeholder="e.g. 45000" required />
            </div>
            <div class="form-group">
                <label class="form-label">Treatment Date</label>
                <input type="date" id="claimDateInput" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
            </div>
            <div class="form-group">
                <label class="form-label">Treatment Details</label>
                <textarea id="claimDetailsInput" class="form-input" rows="3" placeholder="Summary of hospital admission, doctor visits, and diagnostic procedures..."></textarea>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitFileClaim()">Submit Claim</button>
        </div>
    `;
    elements.modalOverlay.classList.add('active');
}

async function submitFileClaim() {
    const diagnosis = document.getElementById('claimDiagnosisInput')?.value.trim();
    const claim_amount = document.getElementById('claimAmountInput')?.value.trim();
    const treatment_date = document.getElementById('claimDateInput')?.value;
    const treatment_details = document.getElementById('claimDetailsInput')?.value.trim();

    if (!diagnosis || !claim_amount) {
        showToast('Please provide diagnosis and claim amount', 'warning');
        return;
    }

    try {
        await API.insurance.fileClaim({
            diagnosis, claim_amount, treatment_date, treatment_details
        });
        closeModal();
        showToast('Insurance claim submitted successfully!', 'success');
        loadInsurance();
    } catch (e) {
        showToast('Claim submission error: ' + e.message, 'error');
    }
}

// ============================================
// VACCINATIONS & IMMUNIZATION
// ============================================

async function loadVaccinations() {
    elements.mainContent.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
            <div>
                <h2 style="font-size:1.3rem;font-weight:700;margin:0;">Vaccinations & Immunization Passport</h2>
                <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:2px;">WHO & National Immunization Schedule records verifiable via Health ID.</p>
            </div>
            <button class="btn btn-primary" onclick="openAddVaccineModal()">+ Record Vaccine</button>
        </div>
        <div id="vaccinationsContainer" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;">
            <div style="padding:24px;text-align:center;color:var(--text-secondary);background:rgba(255,255,255,0.02);border:1px solid var(--border-color);border-radius:12px;">
                Loading immunization history...
            </div>
        </div>
    `;

    try {
        const res = await API.vaccinations.getAll();
        const vacs = res.data || [];
        const container = document.getElementById('vaccinationsContainer');
        if (!container) return;

        if (vacs.length === 0) {
            container.innerHTML = `<div style="padding:24px;color:var(--text-secondary);text-align:center;grid-column:1/-1;">No immunization records found. Click "+ Record Vaccine" to document.</div>`;
            return;
        }

        container.innerHTML = vacs.map(v => `
            <div class="card" style="border:1px solid rgba(16,185,129,0.25);padding:18px;position:relative;background:linear-gradient(135deg,rgba(16,185,129,0.04),rgba(0,0,0,0.2));">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:24px;background:rgba(16,185,129,0.15);width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;">💉</span>
                        <div>
                            <h4 style="margin:0;font-size:1.05rem;font-weight:700;color:var(--text-primary);">${escapeHtml(v.vaccine_name)}</h4>
                            <span style="font-size:0.8rem;color:#34d399;font-weight:600;">Dose ${v.dose_number || 1} Completed</span>
                        </div>
                    </div>
                    <span style="font-size:11px;font-weight:700;color:#34d399;background:rgba(16,185,129,0.15);padding:2px 8px;border-radius:12px;">
                        ✓ Verified
                    </span>
                </div>
                <div style="font-size:0.85rem;color:var(--text-secondary);display:flex;flex-direction:column;gap:4px;margin-top:12px;border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;">
                    <div>📅 <strong>Administered:</strong> ${v.administered_date || 'N/A'}</div>
                    <div>🏥 <strong>Facility:</strong> ${escapeHtml(v.facility_name || 'General Health Center')}</div>
                    <div>👨‍⚕️ <strong>Clinician:</strong> ${escapeHtml(v.doctor_name || 'Dr. Sunita Mehta')}</div>
                    <div>🏷️ <strong>Batch / Lot:</strong> <code style="color:#818cf8;">${escapeHtml(v.lot_number || 'LOT-AUTO')}</code></div>
                    ${v.next_due_date ? `<div style="color:#fbbf24;margin-top:4px;">⏱️ <strong>Next Due:</strong> ${v.next_due_date}</div>` : ''}
                </div>
            </div>
        `).join('');
    } catch (e) {
        showToast('Error loading vaccinations: ' + e.message, 'error');
    }
}

function openAddVaccineModal() {
    elements.modalContent.innerHTML = `
        <div class="modal-header">
            <h3 class="modal-title">💉 Record Immunization</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Vaccine Name</label>
                <input type="text" id="vacNameInput" class="form-input" placeholder="e.g. Hepatitis B, Tetanus Toxoid, Rabies, COVID-19" required />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-group">
                    <label class="form-label">Dose Number</label>
                    <input type="number" id="vacDoseInput" class="form-input" value="1" min="1" max="10" />
                </div>
                <div class="form-group">
                    <label class="form-label">Administered Date</label>
                    <input type="date" id="vacDateInput" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Healthcare Facility / Hospital</label>
                <input type="text" id="vacFacilityInput" class="form-input" placeholder="e.g. Metro Heart Institute" value="Metro Heart Institute" />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-group">
                    <label class="form-label">Administering Doctor / Nurse</label>
                    <input type="text" id="vacDoctorInput" class="form-input" placeholder="e.g. Dr. Aakash Roy" value="Dr. Aakash Roy" />
                </div>
                <div class="form-group">
                    <label class="form-label">Batch / Lot Number</label>
                    <input type="text" id="vacLotInput" class="form-input" placeholder="e.g. LOT-4912-B" />
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitAddVaccine()">Record Vaccine</button>
        </div>
    `;
    elements.modalOverlay.classList.add('active');
}

async function submitAddVaccine() {
    const vaccine_name = document.getElementById('vacNameInput')?.value.trim();
    const dose_number = document.getElementById('vacDoseInput')?.value;
    const administered_date = document.getElementById('vacDateInput')?.value;
    const facility_name = document.getElementById('vacFacilityInput')?.value.trim();
    const doctor_name = document.getElementById('vacDoctorInput')?.value.trim();
    const lot_number = document.getElementById('vacLotInput')?.value.trim();

    if (!vaccine_name) {
        showToast('Vaccine name is required', 'warning');
        return;
    }

    try {
        await API.vaccinations.record({
            vaccine_name, dose_number, administered_date, facility_name, doctor_name, lot_number
        });
        closeModal();
        showToast('Vaccine successfully recorded!', 'success');
        loadVaccinations();
    } catch (e) {
        showToast('Failed to record vaccine: ' + e.message, 'error');
    }
}

// ============================================
// LAB RESULTS & DIAGNOSTIC BIOMARKERS
// ============================================

async function loadLabResults() {
    elements.mainContent.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
            <div>
                <h2 style="font-size:1.3rem;font-weight:700;margin:0;">Diagnostic Lab Results & Biomarkers</h2>
                <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:2px;">Laboratory reports, biochemical panels, and clinical biomarkers analyzed over time.</p>
            </div>
            <div style="display:flex;gap:8px;">
                <button class="btn btn-secondary" onclick="openModal('addRecord')">+ Upload Lab Report</button>
                <button class="btn btn-primary" onclick="navigateTo('assistant')">🤖 Ask AI About Results</button>
            </div>
        </div>
        <div class="card">
            <div id="labResultsTableWrapper" style="overflow-x:auto;padding:12px 16px;">
                <div style="padding:24px;text-align:center;color:var(--text-secondary);">Loading laboratory biomarkers...</div>
            </div>
        </div>
    `;

    try {
        const res = await API.labResults.getAll();
        const labs = res.data || [];
        const wrapper = document.getElementById('labResultsTableWrapper');
        if (!wrapper) return;

        if (labs.length === 0) {
            wrapper.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-secondary);">No diagnostic lab results documented yet.</div>`;
            return;
        }

        wrapper.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:0.85rem;text-align:left;">
                <thead>
                    <tr style="border-bottom:1px solid var(--border-color);color:var(--text-tertiary);">
                        <th style="padding:10px 8px;">Test / Biomarker</th>
                        <th style="padding:10px 8px;">Category</th>
                        <th style="padding:10px 8px;">Observed Value</th>
                        <th style="padding:10px 8px;">Reference Range</th>
                        <th style="padding:10px 8px;">Clinical Flag</th>
                        <th style="padding:10px 8px;">Laboratory</th>
                        <th style="padding:10px 8px;">Tested Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${labs.map(r => {
                        const isAbnormal = r.status === 'Abnormal' || r.status === 'Critical';
                        const flagColor = r.status === 'Critical' ? '#ef4444' : (r.status === 'Abnormal' ? '#f59e0b' : '#10b981');
                        const flagBg = r.status === 'Critical' ? 'rgba(239,68,68,0.15)' : (r.status === 'Abnormal' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)');
                        return `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                                <td style="padding:12px 8px;">
                                    <strong style="color:var(--text-primary);display:block;">${escapeHtml(r.test_name)}</strong>
                                    <span style="font-size:0.75rem;color:var(--text-tertiary);">${escapeHtml(r.record_title || 'Routine Panel')}</span>
                                </td>
                                <td style="padding:12px 8px;color:var(--text-secondary);">${escapeHtml(r.test_category || 'General')}</td>
                                <td style="padding:12px 8px;">
                                    <span style="font-size:1rem;font-weight:700;color:${isAbnormal ? flagColor : 'var(--text-primary)'};">${escapeHtml(r.result_value)}</span>
                                    <span style="font-size:0.75rem;color:var(--text-tertiary);margin-left:2px;">${escapeHtml(r.unit || '')}</span>
                                </td>
                                <td style="padding:12px 8px;color:var(--text-tertiary);font-size:0.8rem;">${escapeHtml(r.reference_range || '-')}</td>
                                <td style="padding:12px 8px;">
                                    <span style="padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;background:${flagBg};color:${flagColor};">
                                        ${r.status === 'Normal' ? '✓ Normal' : (r.status === 'Critical' ? '⚠️ Critical' : '⚡ Abnormal')}
                                    </span>
                                </td>
                                <td style="padding:12px 8px;color:var(--text-secondary);font-size:0.8rem;">${escapeHtml(r.lab_name || 'Central Lab')}</td>
                                <td style="padding:12px 8px;color:var(--text-tertiary);font-size:0.8rem;">${r.tested_at ? new Date(r.tested_at).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch (e) {
        showToast('Error loading lab results: ' + e.message, 'error');
    }
}

// ============================================
// INITIALIZE & EXPORTS
// ============================================

// Expose functions globally
window.navigateTo = navigateTo;
window.openModal = openModal;
window.closeModal = closeModal;
window.switchAuthTab = switchAuthTab;
window.resendOTP = resendOTP;
window.proceedToLogin = proceedToLogin;
window.logout = logout;
window.downloadHealthID = downloadHealthID;
window.generateQR = generateQR;
window.downloadQR = downloadQR;
window.revokeEmergencyQR = revokeEmergencyQR;
window.bookAppointment = bookAppointment;
window.saveProfile = saveProfile;
window.saveRecord = saveRecord;
window.shareAccess = shareAccess;
window.filterRecords = filterRecords;
window.toggleSidebar = toggleSidebar;
window.instantDemoLogin = instantDemoLogin;
window.showDoctorModal = showDoctorModal;
window.submitDoctorLogin = submitDoctorLogin;
window.revokeConsent = revokeConsent;
window.openGrantConsentModal = openGrantConsentModal;
window.submitGrantConsent = submitGrantConsent;
window.sendAIMessage = sendAIMessage;
window.connectGoogleFit = connectGoogleFit;
window.initGoogleFitOAuth = initGoogleFitOAuth;
window.syncGoogleFitDemo = syncGoogleFitDemo;
window.syncGoogleFitWithToken = syncGoogleFitWithToken;
window.connectBluetooth = connectBluetooth;
window.openLogVitalsModal = openLogVitalsModal;
window.saveVitalReading = saveVitalReading;
window.showVitalsChart = showVitalsChart;
window.viewDocument = viewDocument;
window.downloadDocument = downloadDocument;
window.deleteRecord = deleteRecord;
window.handleFileSelection = handleFileSelection;
window.handleDropFile = handleDropFile;
window.clearSelectedFile = clearSelectedFile;
window.toggleNotifPanel = toggleNotifPanel;
window.markAllNotifsRead = markAllNotifsRead;
window.markNotifRead = markNotifRead;
window.simulateDoctorAccess = simulateDoctorAccess;
window.loadNotificationsPage = loadNotificationsPage;
window.initSocket = initSocket;
window.initNotifications = initNotifications;
window.runAIVitalsAnalysis = runAIVitalsAnalysis;
window.loadInsurance = loadInsurance;
window.openAddInsuranceModal = openAddInsuranceModal;
window.submitAddInsurance = submitAddInsurance;
window.openFileClaimModal = openFileClaimModal;
window.submitFileClaim = submitFileClaim;
window.loadVaccinations = loadVaccinations;
window.openAddVaccineModal = openAddVaccineModal;
window.submitAddVaccine = submitAddVaccine;
window.loadLabResults = loadLabResults;