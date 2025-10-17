# 📚 API Documentation

## Interactive API Documentation

### Swagger UI (Recommended)
[🔗 View Live API Documentation](https://[username].github.io/mcp-logger/)

Interactive API testing and exploration with Swagger UI. Try out all endpoints directly from your browser.

### Redoc Documentation
[🔗 Alternative Documentation](https://[username].github.io/mcp-logger/redoc.html)

Beautiful, developer-friendly API documentation with Redoc.

## Quick Start

1. **Health Check**: Test if the API is running
   ```bash
   curl http://localhost:22345/api/health
   ```

2. **View System Status**: See all connected applications
   ```bash
   curl http://localhost:22345/api/logs/status
   ```

3. **Submit Logs**: Send logs to the system
   ```bash
   curl -X POST http://localhost:22345/api/logs/submit \
     -H "Content-Type: application/json" \
     -d '{
       "app": "my-app",
       "host": "localhost:3000",
       "logs": {
         "browser": [
           {
             "level": "INFO",
             "message": "Hello World",
             "source": "app.js:1",
             "timestamp": 1760710400000
           }
         ]
       }
     }'
   ```

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Check server health |
| `GET` | `/api/logs/status` | View system status |
| `POST` | `/api/logs/submit` | Submit log entries |
| `GET` | `/api/logs/{app}/{host}/{namespace}` | Retrieve logs |
| `GET` | `/api/logs/stream` | Real-time log streaming |
| `GET` | `/mcp-logger.js` | Download client script |

## Development Setup

1. Start the backend server:
   ```bash
   node logger-server.js
   ```

2. View documentation:
   - Local: Open `docs/index.html` in your browser
   - Live: Visit the GitHub Pages URL

## OpenAPI Specification

The complete API specification is available in [`openapi.yaml`](./openapi.yaml).

You can import this file into:
- Postman
- Insomnia
- Swagger UI
- Redoc
- Any OpenAPI-compatible tool

## Rate Limits

- **Localhost**: 200 requests per 10 seconds
- **Remote**: 1000 requests per minute

## Data Model

### Applications
- Identified by `app` parameter
- Can have multiple frontend hosts
- Each host maintains separate log namespaces

### Namespaces
- `browser`: Console logs
- `user-actions`: User interaction events
- `api-calls`: API request/response logs
- `performance`: Performance metrics
- Custom namespaces supported

---

**Generated with ❤️ using OpenAPI 3.1**