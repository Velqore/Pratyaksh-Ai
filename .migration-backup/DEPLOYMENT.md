# Pratyaksh Forensic AI - Deployment Guide

## Overview
Pratyaksh is a production-ready forensic AI assistant that can be deployed on multiple cloud platforms. This guide covers deployment on Vercel, Heroku, Railway, Render, and Koyeb.

## Prerequisites
- Node.js 18+ 
- npm or yarn
- Git repository

## Build Commands
```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test
```

## Platform-Specific Deployment

### 1. Vercel (Recommended for Frontend + Serverless)

**Auto-deployment via GitHub:**
1. Connect your GitHub repository to Vercel
2. Vercel will automatically detect the configuration from `vercel.json`
3. Deploy with zero configuration

**Manual deployment:**
```bash
npm install -g vercel
vercel login
vercel --prod
```

**Configuration:**
- Build Command: `npm run build`
- Output Directory: `dist/spa`
- Install Command: `npm install`
- Framework Preset: Other

### 2. Heroku

**Deployment steps:**
```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create new app
heroku create pratyaksh-forensic-ai

# Set environment variables
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

**Configuration:**
- Uses `Procfile` for startup command
- Automatic buildpack detection (Node.js)
- Environment variables via Heroku Dashboard

### 3. Railway

**Deployment:**
1. Connect GitHub repository to Railway
2. Railway auto-detects configuration from `railway.json`
3. Deploy with single click

**Manual via CLI:**
```bash
npm install -g @railway/cli
railway login
railway link
railway up
```

### 4. Render

**Deployment:**
1. Connect GitHub repository
2. Use `render.yaml` configuration
3. Auto-deploy on git push

**Manual configuration:**
- Build Command: `npm run build`
- Start Command: `npm start`
- Environment: Node
- Health Check Path: `/api/ping`

### 5. Koyeb

**Deployment:**
1. Create new app in Koyeb dashboard
2. Connect GitHub repository
3. Configure build settings:
   - Build command: `npm run build`
   - Run command: `npm start`
   - Port: 8080

### 6. Docker Deployment

**Build and run:**
```bash
# Build image
docker build -t pratyaksh-forensic-ai .

# Run container
docker run -p 8080:8080 pratyaksh-forensic-ai

# Or use docker-compose
docker-compose up -d
```

## Environment Variables

Required environment variables:
- `NODE_ENV=production`
- `PORT=8080` (default)

Optional environment variables:
- `LOG_LEVEL=info`
- `CORS_ORIGIN=*` (configure for production)

## Health Checks

All deployments include health check endpoint:
- **URL:** `/api/ping`
- **Method:** GET
- **Response:** `{"status": "ok", "timestamp": "..."}`

## Performance Optimization

### Production Settings
- Enable gzip compression
- Set proper cache headers
- Use CDN for static assets
- Configure monitoring and logging

### Scaling
- **Vercel:** Auto-scales serverless functions
- **Heroku:** Add dynos via dashboard
- **Railway:** Auto-scales based on traffic
- **Render:** Configure auto-scaling in dashboard

## Monitoring

### Built-in Endpoints
- `/api/ping` - Health check
- `/api/demo` - Demo endpoint

### Recommended Monitoring
- **Uptime:** UptimeRobot, StatusPage
- **Performance:** New Relic, DataDog
- **Errors:** Sentry integration
- **Analytics:** Google Analytics, Plausible

## SSL/HTTPS

All recommended platforms provide automatic SSL:
- **Vercel:** Automatic SSL with custom domains
- **Heroku:** SSL via Heroku SSL addon
- **Railway:** Automatic SSL for custom domains
- **Render:** Automatic SSL certificates

## Custom Domains

1. **Add domain in platform dashboard**
2. **Configure DNS records:**
   - Vercel: CNAME to `cname.vercel-dns.com`
   - Heroku: CNAME to your Heroku app domain
   - Railway: CNAME to Railway's provided domain
   - Render: CNAME to Render's domain

## Troubleshooting

### Common Issues

**Build failures:**
- Check Node.js version (requires 18+)
- Verify all dependencies are listed in package.json
- Check build logs for specific errors

**Runtime errors:**
- Verify PORT environment variable
- Check health check endpoint
- Review application logs

**Performance issues:**
- Enable compression
- Optimize image sizes
- Use appropriate instance sizes

### Debug Commands
```bash
# Check build output
npm run build

# Test production build locally
npm start

# Check health endpoint
curl http://localhost:8080/api/ping
```

## Security Considerations

1. **Environment Variables:** Never commit sensitive data
2. **CORS:** Configure appropriate origins for production
3. **Headers:** Security headers are pre-configured
4. **Dependencies:** Regular security updates via `npm audit`
5. **Rate Limiting:** Consider adding rate limiting for production

## Cost Optimization

### Free Tier Options
- **Vercel:** 100GB bandwidth, unlimited deployments
- **Heroku:** 550-1000 dyno hours/month
- **Railway:** $5 free credit monthly
- **Render:** 750 hours/month free

### Production Scaling
- Monitor usage and upgrade plans as needed
- Use CDNs for static asset delivery
- Implement caching strategies
- Optimize bundle sizes

## Support

For deployment issues:
1. Check platform-specific documentation
2. Review application logs
3. Test locally first
4. Use platform support channels

---

**Ready for Production:** Pratyaksh Forensic AI is production-ready with comprehensive deployment options, monitoring, and security configurations.
