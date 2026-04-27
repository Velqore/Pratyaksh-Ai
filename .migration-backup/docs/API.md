# 🔌 Pratyaksh API Reference

## Overview

The Pratyaksh Forensic AI API provides endpoints for health checks, demonstration, and future forensic analysis integrations. All endpoints return JSON responses and follow RESTful conventions.

## Base URL

```
https://your-app-domain.com/api
```

## Authentication

Currently, the API operates without authentication for demonstration purposes. Production deployments should implement appropriate security measures.

## Endpoints

### Health Check

**GET** `/api/ping`

Health check endpoint for monitoring and deployment verification.

#### Response
```json
{
  "status": "ok",
  "timestamp": "2024-01-18T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "system": "Pratyaksh Forensic AI"
}
```

#### Status Codes
- `200 OK` - System operational
- `500 Internal Server Error` - System issues

---

### Demo Endpoint

**GET** `/api/demo`

Demonstration endpoint showcasing API structure and response format.

#### Response
```json
{
  "message": "Pratyaksh Forensic AI Demo",
  "departments": [
    {
      "id": "fingerprint",
      "name": "Fingerprint Analysis",
      "accuracy": 98.5,
      "status": "operational"
    },
    {
      "id": "cyber",
      "name": "Cyber Forensics", 
      "accuracy": 97.8,
      "status": "operational"
    },
    {
      "id": "documents",
      "name": "Questioned Documents",
      "accuracy": 96.9,
      "status": "operational"
    }
  ],
  "features": [
    "AI-Powered Analysis",
    "Real-time Processing",
    "Expert-level Accuracy",
    "Court-admissible Reports"
  ],
  "timestamp": "2024-01-18T10:30:00.000Z"
}
```

#### Status Codes
- `200 OK` - Demo data returned successfully

---

## Future API Endpoints

The following endpoints are planned for future releases:

### Evidence Analysis

**POST** `/api/analyze`

Submit evidence for AI analysis across departments.

#### Request Body
```json
{
  "department": "fingerprint" | "cyber" | "documents",
  "evidence": {
    "type": "image" | "file" | "text",
    "data": "base64_encoded_data",
    "metadata": {
      "filename": "evidence.jpg",
      "size": 2048576,
      "format": "image/jpeg"
    }
  },
  "options": {
    "priority": "normal" | "high" | "urgent",
    "analysis_level": "basic" | "comprehensive" | "expert"
  }
}
```

#### Response
```json
{
  "analysis_id": "uuid-string",
  "status": "processing" | "completed" | "failed",
  "department": "fingerprint",
  "confidence": 97.3,
  "results": {
    "summary": "Analysis summary",
    "findings": ["Finding 1", "Finding 2"],
    "recommendations": ["Recommendation 1"],
    "evidence_found": ["Evidence item 1"],
    "next_actions": ["Next action 1"]
  },
  "processing_time": 2.3,
  "timestamp": "2024-01-18T10:30:00.000Z"
}
```

---

### Case Management

**GET** `/api/cases`
**POST** `/api/cases`
**GET** `/api/cases/:id`
**PUT** `/api/cases/:id`
**DELETE** `/api/cases/:id`

Manage forensic cases and evidence chains.

---

### User Authentication

**POST** `/api/auth/login`
**POST** `/api/auth/logout`
**POST** `/api/auth/register`
**GET** `/api/auth/profile`

User authentication and profile management.

---

### Reports

**GET** `/api/reports`
**POST** `/api/reports/generate`
**GET** `/api/reports/:id/download`

Generate and manage forensic reports.

---

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details",
    "timestamp": "2024-01-18T10:30:00.000Z",
    "request_id": "uuid-string"
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|---------|-------------|
| `INVALID_REQUEST` | 400 | Malformed request data |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

---

## Rate Limiting

API rate limiting (when implemented):

- **Free Tier**: 100 requests/hour
- **Professional**: 1,000 requests/hour  
- **Enterprise**: 10,000 requests/hour

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642518000
```

---

## SDK and Integration

### JavaScript/TypeScript
```typescript
import { PratyakshAPI } from '@pratyaksh/api-client';

const api = new PratyakshAPI({
  baseURL: 'https://your-app.com/api',
  apiKey: 'your-api-key'
});

// Health check
const health = await api.ping();

// Submit analysis
const result = await api.analyze({
  department: 'fingerprint',
  evidence: { /* evidence data */ }
});
```

### cURL Examples
```bash
# Health check
curl -X GET https://your-app.com/api/ping

# Demo endpoint
curl -X GET https://your-app.com/api/demo

# Future: Evidence analysis
curl -X POST https://your-app.com/api/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"department": "fingerprint", "evidence": {...}}'
```

---

## WebSocket Events (Planned)

Real-time analysis updates via WebSocket:

```typescript
const socket = new WebSocket('wss://your-app.com/ws');

socket.on('analysis_started', (data) => {
  console.log('Analysis started:', data.analysis_id);
});

socket.on('analysis_progress', (data) => {
  console.log('Progress:', data.progress, '%');
});

socket.on('analysis_completed', (data) => {
  console.log('Results:', data.results);
});
```

---

## Monitoring and Observability

### Health Metrics
- Response time: `< 200ms` (95th percentile)
- Uptime: `99.9%` availability
- Error rate: `< 0.1%`

### Logging
All API requests are logged with:
- Request ID
- User agent
- IP address
- Response time
- Status code

### Monitoring Endpoints
- **Health**: `/api/ping`
- **Metrics**: `/api/metrics` (planned)
- **Status**: `/api/status` (planned)

---

## Security

### HTTPS Only
All API communication must use HTTPS in production.

### Input Validation
- Request size limits: 50MB max
- File type validation
- Input sanitization
- SQL injection prevention

### CORS Policy
```javascript
{
  "origin": ["https://your-domain.com"],
  "methods": ["GET", "POST", "PUT", "DELETE"],
  "allowedHeaders": ["Content-Type", "Authorization"]
}
```

---

## Changelog

### v1.0.0 (Current)
- ✅ Health check endpoint
- ✅ Demo endpoint
- ✅ Error handling
- ✅ CORS configuration

### v1.1.0 (Planned)
- 🔄 Evidence analysis endpoints
- 🔄 User authentication
- 🔄 Rate limiting
- 🔄 WebSocket support

### v1.2.0 (Future)
- 📅 Case management
- 📅 Report generation
- 📅 Advanced analytics
- 📅 Team collaboration

---

For technical support or API questions, contact: api-support@pratyaksh-ai.com
