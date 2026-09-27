# MedVault - Digital Health ID System - Quick Start Guide

## Overview
A complete, working Digital Health ID System with a beautiful pastel UI design and full backend functionality.

## Features
✅ Patient Registration & Authentication (OTP-based)
✅ Digital Health ID Management
✅ Medical Records Storage & Retrieval
✅ Prescription Tracking
✅ Appointment Booking
✅ Emergency QR Code Generation
✅ Responsive Pastel UI Design
✅ Demo Mode (no database required)

## Quick Start (Demo Mode)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

The server will start on `http://localhost:3000`

### 3. Access the Application
Open your browser and navigate to:
```
http://localhost:3000
```

### 4. Login (Demo Mode)

**Option 1: Use Demo Credentials**
- Health ID: `HID-2026-99999` (or any ID)
- Phone: `+91 98765 43210` (or any phone)
- OTP: `123456` (always works in demo mode)

**Option 2: Register New Account**
- Click "Register" tab
- Fill in the form
- You'll receive a new Health ID
- Use OTP `123456` to login

## Features & Functions

### Authentication
- ✅ Registration with personal details
- ✅ OTP-based login
- ✅ Session management
- ✅ Logout functionality

### Dashboard
- ✅ Health ID card display
- ✅ Statistics overview
- ✅ Recent medical records
- ✅ Quick actions

### Medical Records
- ✅ View all records
- ✅ Filter by type (Lab, Prescription, Vaccination)
- ✅ Add new records
- ✅ Record details

### Prescriptions
- ✅ View active prescriptions
- ✅ Medication details
- ✅ Dosage and frequency

### Appointments
- ✅ View upcoming appointments
- ✅ Book new appointments
- ✅ Hospital and department selection

### Health ID Management
- ✅ View complete Health ID
- ✅ Download ID card
- ✅ Share with doctors
- ✅ Update information

### Emergency Access
- ✅ Generate emergency QR code
- ✅ Download QR code
- ✅ Critical health information display

### Profile & Settings
- ✅ Update personal information
- ✅ Manage emergency contacts
- ✅ Privacy settings
- ✅ Notification preferences

## API Endpoints (Demo Mode)

All API endpoints work in demo mode without database:

```
POST   /api/auth/send-otp          - Send OTP
POST   /api/auth/verify-otp        - Verify OTP & login
GET    /api/patient/profile        - Get user profile
PUT    /api/patient/profile        - Update profile
GET    /api/records                - Get all records
POST   /api/records                - Add new record
GET    /api/prescriptions          - Get prescriptions
GET    /api/appointments           - Get appointments
POST   /api/appointments           - Book appointment
POST   /api/emergency/qr           - Generate QR code
```

## Production Setup (With Database)

### 1. Setup MySQL Database
```bash
mysql -u root -p < database-schema.sql
```

### 2. Configure Environment
```bash
cp env.example .env
```

Edit `.env` with your settings:
```env
# Database
DB_HOST=localhost
DB_USER=healthid_user
DB_PASSWORD=your_password
DB_NAME=health_id_system

# JWT Secret
JWT_SECRET=your-secret-key

# SMS/Email (Optional)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_password

# AWS S3 (Optional - for file storage)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_BUCKET_NAME=healthid-storage
```

### 3. Remove Demo Mode
In `server.js`, remove or comment out:
```javascript
process.env.DEMO_MODE = 'true'
```

### 4. Start Production Server
```bash
NODE_ENV=production npm start
```

## Tech Stack

### Frontend
- HTML5, CSS3, JavaScript (Vanilla)
- Pastel Color Scheme
- Responsive Design
- Modern UI Components

### Backend
- Node.js + Express.js
- MySQL Database
- JWT Authentication
- RESTful API

### Additional Services
- QR Code Generation
- SMS/Email Integration (Twilio/SMTP)
- File Storage (AWS S3)
- Session Management

## UI Design

### Color Scheme: Pastel
- Primary: Soft Indigo (#6366f1)
- Accents: Lavender, Sky Blue, Mint Green
- Background: Soft cream tones
- Cards: White with subtle shadows

### Typography
- Font: Inter (Modern Sans-serif)
- Clean, readable hierarchy
- Smooth transitions

### Layout
- Sidebar navigation
- Card-based content
- Grid system
- Fully responsive

## Browser Support
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Mobile Support
✅ Fully responsive
✅ Touch-friendly
✅ Mobile menu
✅ Optimized layouts

## Security Features
- JWT token authentication
- OTP verification
- Session management
- Input validation
- XSS protection
- CORS configured

## Troubleshooting

### Port Already in Use
```bash
# Change port in server.js or use:
PORT=3001 npm start
```

### Cannot Connect to Database
- Check MySQL is running
- Verify credentials in .env
- Ensure database exists
- Check firewall settings

### OTP Not Working
- In demo mode, always use `123456`
- For production, configure Twilio
- Check SMS provider settings

## Demo Login Flow

1. Open `http://localhost:3000`
2. Click "Login" (default tab)
3. Enter any Health ID (e.g., `HID-2026-99999`)
4. Enter any phone number (e.g., `+91 98765 43210`)
5. Click "Send OTP"
6. Enter OTP: `123456`
7. Click "Verify & Login"
8. You're in! 🎉

## Support

For issues or questions:
- Check API-DOCUMENTATION.md
- Review TESTING.md
- Check server logs
- Verify environment configuration

## License
MIT License - See LICENSE file for details

---

**Built with ❤️ for better healthcare**

MedVault - Secure, Paperless, Accessible Healthcare for Everyone