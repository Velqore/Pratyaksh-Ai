# Koyeb Deployment Guide for Pratyaksh Forensic AI

## 🚀 Quick Fix for Blank Page Issue

The blank page issue is likely due to incorrect build/start commands in your Koyeb configuration.

### ✅ Correct Koyeb Settings:

**Build Command:**
```bash
npm run build
```

**Run Command:**
```bash
npm start
```

**Port:**
```
8080
```

**Environment Variables (Required):**
```
NODE_ENV=production
PORT=8080
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
FROM_EMAIL=noreply@pratyaksh.gov.in
FROM_NAME=Pratyaksh Forensic AI
```

### 🔧 Alternative Deployment Methods:

#### Method 1: GitHub Auto-Deploy
1. Push this updated code to GitHub
2. In Koyeb dashboard: Connect your GitHub repo
3. Set build command: `npm run build`
4. Set run command: `npm start`
5. Set port: `8080`

#### Method 2: Docker Deployment
```bash
# In Koyeb, use Docker deployment
# Dockerfile is already configured properly
```

#### Method 3: Manual Configuration
If still blank, check these:

**In Koyeb Service Settings:**
- **Runtime**: Node.js 18+
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm start`
- **Port**: `8080`
- **Health Check**: `/health` endpoint

### 🔍 Debugging Steps:

1. **Check Logs**: Go to Koyeb dashboard → Your service → Logs
2. **Verify Build**: Ensure build completes successfully
3. **Check Health**: Visit `https://your-app.koyeb.app/health`
4. **Test API**: Try `https://your-app.koyeb.app/api/ping`

### 📱 Expected URLs:
- **Homepage**: `https://your-app.koyeb.app/`
- **API Health**: `https://your-app.koyeb.app/api/ping`
- **Health Check**: `https://your-app.koyeb.app/health`

### 🚨 Common Issues & Fixes:

**Issue**: Blank page
**Fix**: Ensure port 8080 and correct start command

**Issue**: Build fails
**Fix**: Use `npm ci && npm run build` as build command

**Issue**: 503 Error
**Fix**: Check if health endpoint `/health` is responding

**Issue**: Assets not loading
**Fix**: Ensure static files are served correctly (fixed in server config)

---

## 🏃‍♂️ Quick Action Plan:

1. **Update your Koyeb service settings** with the correct commands above
2. **Redeploy** from your GitHub repository
3. **Check the health endpoint** first: `/health`
4. **Monitor the deployment logs** in Koyeb dashboard

Your app should work perfectly after these changes! 🎯
