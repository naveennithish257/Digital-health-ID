# Digital Health ID System - Deployment Guide

## 📋 Prerequisites

Before deploying the system, ensure you have:

### System Requirements
- **Server**: Ubuntu 20.04 LTS or later (recommended)
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: Minimum 50GB SSD
- **CPU**: 2+ cores recommended
- **Network**: Static IP address, SSL certificate

### Software Requirements
- Node.js 14+ and npm
- MySQL 8.0+
- Redis (optional, for caching)
- Nginx or Apache (for reverse proxy)
- PM2 (for process management)
- Git

## 🚀 Installation Steps

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version

# Install MySQL
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Install Nginx
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2

# Install Git
sudo apt install -y git
```

### Step 2: Database Setup

```bash
# Login to MySQL
sudo mysql -u root -p

# Create database and user
CREATE DATABASE health_id_system;
CREATE USER 'healthid_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON health_id_system.* TO 'healthid_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Import database schema
mysql -u healthid_user -p health_id_system < database-schema.sql
```

### Step 3: Application Setup

```bash
# Create application directory
sudo mkdir -p /var/www/healthid
cd /var/www/healthid

# Clone or copy application files
# (Upload your files via SCP, FTP, or git clone)

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit environment variables
nano .env
# Update all values with your actual credentials
```

### Step 4: Configure Environment Variables

Edit `.env` file:

```bash
# Required configurations
NODE_ENV=production
PORT=3000
DB_PASSWORD=your_actual_database_password
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# AWS Configuration (if using S3)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_BUCKET_NAME=your_bucket_name

# Twilio Configuration (for SMS)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### Step 5: SSL Certificate Setup

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Step 6: Nginx Configuration

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/healthid
```

Add configuration:

```nginx
# Backend API Server
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # API proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # File upload limits
    client_max_body_size 10M;
}

# Frontend Application
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/healthid/public;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable configuration:

```bash
sudo ln -s /etc/nginx/sites-available/healthid /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: Start Application with PM2

```bash
# Start application
pm2 start server.js --name healthid-api

# Configure PM2 to start on system boot
pm2 startup
pm2 save

# Monitor application
pm2 monit

# View logs
pm2 logs healthid-api

# Restart application
pm2 restart healthid-api
```

### Step 8: Setup Firewall

```bash
# Configure UFW firewall
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 3000
sudo ufw enable

# Check status
sudo ufw status
```

### Step 9: Database Backup Setup

Create backup script:

```bash
sudo nano /usr/local/bin/backup-healthid.sh
```

Add script:

```bash
#!/bin/bash

# Configuration
DB_NAME="health_id_system"
DB_USER="healthid_user"
DB_PASS="your_password"
BACKUP_DIR="/var/backups/healthid"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/healthid_$DATE.sql.gz

# Upload to S3 (optional)
# aws s3 cp $BACKUP_DIR/healthid_$DATE.sql.gz s3://your-backup-bucket/

# Delete old backups
find $BACKUP_DIR -name "healthid_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: healthid_$DATE.sql.gz"
```

Make executable and schedule:

```bash
sudo chmod +x /usr/local/bin/backup-healthid.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-healthid.sh >> /var/log/healthid-backup.log 2>&1
```

### Step 10: Monitoring Setup

Install monitoring tools:

```bash
# Install monitoring
sudo apt install -y prometheus node-exporter grafana

# Configure Prometheus
sudo nano /etc/prometheus/prometheus.yml
```

## 🔒 Security Checklist

### Application Security
- [ ] Change all default passwords
- [ ] Generate strong JWT secrets
- [ ] Enable HTTPS everywhere
- [ ] Configure CORS properly
- [ ] Implement rate limiting
- [ ] Enable SQL injection protection
- [ ] Validate all user inputs
- [ ] Sanitize file uploads
- [ ] Use prepared statements
- [ ] Enable audit logging

### Server Security
- [ ] Keep system updated
- [ ] Configure firewall rules
- [ ] Disable root SSH login
- [ ] Use SSH keys only
- [ ] Install fail2ban
- [ ] Regular security audits
- [ ] Monitor access logs
- [ ] Implement intrusion detection

### Database Security
- [ ] Strong database passwords
- [ ] Limit database access
- [ ] Enable encryption at rest
- [ ] Regular backups
- [ ] Test restore procedures
- [ ] Monitor query performance
- [ ] Audit database access

### Compliance
- [ ] HIPAA compliance review
- [ ] GDPR compliance (if applicable)
- [ ] Data encryption verification
- [ ] Privacy policy implementation
- [ ] Terms of service
- [ ] Consent management
- [ ] Right to be forgotten

## 📊 Performance Optimization

### Database Optimization

```sql
-- Add indexes for frequently queried fields
CREATE INDEX idx_patient_phone ON patients(phone_number);
CREATE INDEX idx_record_patient_date ON medical_records(patient_id, record_date);
CREATE INDEX idx_appointment_date ON appointments(appointment_date, status);

-- Optimize tables
OPTIMIZE TABLE patients;
OPTIMIZE TABLE medical_records;
OPTIMIZE TABLE prescriptions;
```

### Application Optimization

```bash
# Enable Gzip compression
# Already configured in Nginx

# Use Redis for caching (optional)
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Configure Redis in .env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### CDN Setup (Optional)

For serving static files:

```bash
# Use CloudFlare CDN
# 1. Point DNS to CloudFlare
# 2. Enable CDN caching
# 3. Configure cache rules
```

## 🔄 Continuous Deployment

### Setup Git Deployment

```bash
# Create deployment script
nano /var/www/healthid/deploy.sh
```

Add script:

```bash
#!/bin/bash

cd /var/www/healthid

# Pull latest code
git pull origin main

# Install dependencies
npm install --production

# Run migrations
npm run migrate

# Restart application
pm2 restart healthid-api

echo "Deployment completed successfully"
```

### Setup GitHub Webhook

1. Create webhook in GitHub repository
2. Point to: `https://yourdomain.com/api/deploy`
3. Secret: Generate random string
4. Events: Push events

## 🔍 Monitoring & Logging

### Log Management

```bash
# View PM2 logs
pm2 logs healthid-api

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# View system logs
sudo journalctl -u nginx -f
```

### Health Checks

Create health check script:

```bash
#!/bin/bash

# Check API health
response=$(curl -s -o /dev/null -w "%{http_code}" https://api.yourdomain.com/api/health)

if [ $response -eq 200 ]; then
    echo "API is healthy"
else
    echo "API is down! Status: $response"
    # Send alert (email, SMS, Slack, etc.)
fi
```

### Setup Alerts

Configure email alerts:

```bash
# Install mailutils
sudo apt install -y mailutils

# Test email
echo "Test email from HealthID server" | mail -s "Test" your@email.com
```

## 🆘 Troubleshooting

### Common Issues

**Issue: Application won't start**
```bash
# Check logs
pm2 logs healthid-api

# Verify environment variables
node -e "require('dotenv').config(); console.log(process.env.DB_HOST)"

# Test database connection
mysql -u healthid_user -p -h localhost health_id_system
```

**Issue: High CPU usage**
```bash
# Check process
pm2 monit

# Optimize database queries
# Review slow query log
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
# Enable: slow_query_log = 1
```

**Issue: Out of memory**
```bash
# Check memory
free -h

# Restart application
pm2 restart healthid-api

# Consider adding swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## 📞 Support & Maintenance

### Regular Maintenance Tasks

**Daily:**
- Monitor application logs
- Check API health
- Review error rates

**Weekly:**
- Review backup status
- Check disk space
- Update dependencies

**Monthly:**
- Security patches
- Database optimization
- Performance review
- Backup restoration test

### Escalation Procedures

1. **Critical Issues**: Page on-call engineer
2. **High Priority**: Email + Slack notification
3. **Medium Priority**: Create ticket
4. **Low Priority**: Scheduled maintenance

## 📚 Additional Resources

- **Documentation**: https://docs.healthid.gov.in
- **API Reference**: https://api.healthid.gov.in/docs
- **Support Portal**: https://support.healthid.gov.in
- **Status Page**: https://status.healthid.gov.in

---

**Deployment Completed! 🎉**

Your Digital Health ID System is now live and ready to serve millions of users.

Remember to:
- Monitor regularly
- Keep systems updated
- Backup frequently
- Test disaster recovery
- Review security regularly
