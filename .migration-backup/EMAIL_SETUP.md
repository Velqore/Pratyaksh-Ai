# Real Email OTP Setup for Pratyaksh Forensic AI

## Gmail SMTP Configuration

To enable real OTP email sending, you need to set up Gmail App Password:

### 1. Enable 2-Factor Authentication on Gmail
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification if not already enabled

### 2. Generate App Password
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Other (custom name)"
3. Enter "Pratyaksh Forensic AI" as the name
4. Copy the 16-character app password (e.g., "abcd efgh ijkl mnop")

### 3. Set Environment Variables
Set these environment variables in your deployment:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-character-app-password
```

### 4. Alternative Email Providers

#### SendGrid
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

#### Outlook/Hotmail
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password-or-app-password
```

## Testing

Once configured, the OTP emails will be sent automatically when users request sign-in codes. The emails include:

- Professional forensic-themed design
- 6-digit verification code
- 5-minute expiration
- Security warnings

## Production Deployment

For production deployment on Fly.dev, set the environment variables:

```bash
fly secrets set SMTP_HOST=smtp.gmail.com
fly secrets set SMTP_PORT=587
fly secrets set SMTP_SECURE=false
fly secrets set SMTP_USER=your-gmail@gmail.com
fly secrets set SMTP_PASS=your-app-password
```

Then redeploy:
```bash
fly deploy
```
