# Multi-stage build for production-ready Pratyaksh Forensic AI
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory and user
WORKDIR /app
RUN addgroup -g 1001 -S nodejs
RUN adduser -S pratyaksh -u 1001

# Copy built application from builder stage
COPY --from=builder --chown=pratyaksh:nodejs /app/dist ./dist
COPY --from=builder --chown=pratyaksh:nodejs /app/package*.json ./
COPY --from=builder --chown=pratyaksh:nodejs /app/node_modules ./node_modules

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Switch to non-root user
USER pratyaksh

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:8080/api/ping', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); });"

# Start application with dumb-init
CMD ["dumb-init", "node", "dist/server/node-build.mjs"]
