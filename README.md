# `MCP-logger` - Logging System + MCP Server + Browser Integration

A lightweight logging system that captures frontend console logs and makes them accessible via MCP (Model Context Protocol). Perfect for development and debugging environments.

## 🚀 Quick Start (5-Minute Setup)

### Step 1: Install Dependencies
```bash
cd mcp-logger
npm install
```

### Step 2: Configure (Optional)
```bash
# Copy the example configuration file
cp .env.example .env

# Edit .env to customize settings (optional):
# PORT=3000
# HOST=0.0.0.0
# MAX_LOG_ENTRIES=500
```

### Step 3: Start Backend Server
```bash
# Terminal 1
node logger-server.js
# Expected: 🚀 Browser Logger Server running on http://localhost:22345
```

### Step 4: Start MCP Server
```bash
# Terminal 2
node mcp-server.js
# Expected: 🚀 Browser Logs MCP Server starting...
```

### Step 5: Add to Frontend Application

Add this single script to your HTML file - it handles both online and offline scenarios automatically:

```html
<script>
window.MCP_LOGGING_ENABLED = true;
window.MCP_LOGGING_APP_NAME = 'my-app';  // REQUIRED: Set your app name
window.MCP_LOGGING_BACKEND_URL = 'http://localhost:22345';
(function() {
    // Try to load from server first, fallback to local file
    var script = document.createElement('script');
    script.src = 'http://localhost:22345/mcp-logger.js';
    script.onerror = function() {
        // Server is down, create a simple fallback logger
        console.log('MCP Logger server offline, using local fallback');
        window.logger = {
            log: function(namespace, data) {
                console.debug('[' + namespace + ']', data);
            }
        };
    };
    document.head.appendChild(script);
})();
</script>
```

### Step 6: Configure MCP in your LLM client
If you want to use the MCP server with AI Client:
```bash
# Quick setup with Claude Code CLI
node mcp-server.js mcp-help
```
With default app `my-app` (LLM will use MCP `FE-logs` only for the app a `my-app`)
```bash
claude mcp add FE-logs node $(pwd)/mcp-server.js \
    --scope local --env FILTER_APP=my-app
```
Or use base setup
```bash
claude mcp add FE-logs node $(pwd)/mcp-server.js
```
##### Test With inspector
```bash
npx @modelcontextprotocol/inspector --cli node $(pwd)/mcp-server.js \
  -e FILTER_APP=my-app --method tools/call --tool-name 'get_logs'
```

### Step 7: Test Your Setup
Use the `get_logs()` tool in your MCP client to retrieve logs from your frontend application.

## 📋 System Overview

The Browser Logging System consists of three main components:

1. **Frontend Logger** (`mcp-logger.js`) - Captures console logs and sends to backend
2. **Backend Server** (`logger-server.js`) - Receives and stores logs from frontend
3. **MCP Server** (`mcp-server.js`) - Provides MCP access to stored logs

### 🏗️ Architecture Overview

#### System Context (C4 Level 1)

```mermaid
graph TB
    subgraph "Logger System"
        LS["Logger Server"]
        MS["MCP Server"]
    end

    user["Developer"]
    frontend["Frontend (or Backend) Application"]
    claude["AI Client"]

    user --> frontend
    frontend -->|"HTTP POST"| LS
    LS -->|"SSE"| MS
    MS -->|"STDIO"| claude

    user -->|"ask: 'read logs'"| claude
    claude -->|"get_logs tool"| MS
    MS -->|"HTTP GET"| LS

    classDef system fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef external fill:#f5f5f5,stroke:#666,stroke-width:1px

    class LS,MS system
    class user,frontend,claude external
```

#### Component Architecture (C4 Level 2)

```mermaid
graph TB
    subgraph "Frontend Application"
        console["Console API"]
        logger["mcp-logger.js"]
    end

    subgraph "Logger Server :22345"
        api["HTTP API"]
        storage["Log Storage"]
        sse["SSE Stream"]
        script["Script Server"]
    end

    subgraph "MCP Server"
        client["SSE Client"]
        tools["get_logs Tool"]
    end

    subgraph "AI Assistant"
        claude["AI Client"]
    end

    console --> logger
    logger -->|"POST /api/logs/submit"| api
    api --> storage
    storage --> sse
    script -->|"GET /mcp-logger.js"| logger

    sse --> client
    client --> tools

    tools -.->|"HTTP GET"| api
    tools -->|"log data"| claude

    classDef frontend fill:#e3f2fd,stroke:#1976d2
    classDef backend fill:#f3e5f5,stroke:#7b1fa2
    classDef mcp fill:#e8f5e8,stroke:#388e3c
    classDef external fill:#fff3e0,stroke:#f57c00

    class console,logger frontend
    class api,storage,sse,script backend
    class client,tools mcp
    class claude external
```

## 🔧 Configuration

### Environment Variables (.env file)

Create a `.env` file from `.env.example` to customize your setup:

```bash
# Copy the example configuration
cp .env.example .env
```

**Backend Server Configuration:**
```bash
PORT=22345                              # Server port
HOST=localhost                          # Server host (use 0.0.0.0 for external access)
MAX_LOG_ENTRIES=500                     # Max log entries per namespace
```

**MCP Server Configuration:**
```bash
BACKEND_HOST=localhost                  # Host where MCP server can reach backend
BACKEND_PORT=22345                      # Port where MCP server can reach backend
FILTER_APP=my-app                       # Default app name for get_logs tool
```

### Custom Host/Port Examples

**Different Port:**
```bash
# .env file
PORT=3000
HOST=localhost

# Frontend script
window.MCP_LOGGING_BACKEND_URL = 'http://localhost:3000';
```

**External Access:**
```bash
# .env file
PORT=22345
HOST=0.0.0.0
BACKEND_HOST=192.168.1.100

# Frontend script
window.MCP_LOGGING_BACKEND_URL = 'http://192.168.1.100:22345';
```

**Complete Remote Setup:**
```bash
# .env file
PORT=3000
HOST=0.0.0.0
BACKEND_HOST=192.168.1.100
BACKEND_PORT=3000
FILTER_APP=dashboard
```

## 📖 Usage Examples

### Console Logging (Automatic)
```javascript
// All console methods are automatically captured
console.log('Application started');
console.info('User logged in');
console.warn('Deprecated API used');
console.error('Network request failed');
```

### Application Logging (Structured)
```javascript
// User interaction logging
logger.log('user-actions', {
    action: 'click',
    target: 'submit-button',
    page: '/checkout',
    timestamp: Date.now()
});

// API call logging
logger.log('api-calls', {
    method: 'POST',
    url: '/api/users',
    status: 200,
    duration: 150
});

// Error logging
logger.log('errors', {
    type: 'validation',
    message: 'Invalid email format',
    field: 'email'
});
```

### MCP Tool Usage
```javascript
// Basic log retrieval
// auto-selects single host
// use app=unknown-app or defined in app=${FILTER_APP} env variable
get_logs()

// Retrieve with filtering
get_logs(filter="error", lines=10)

// Specific host and namespace
get_logs(frontend_host="localhost:3000", namespace="user-actions")
```

## 🧪 Testing and Verification

### Basic Connectivity Test
```bash
# Test backend health
curl http://localhost:22345/api/health
```

### Frontend Integration Test

Try to open [test/test-frontend.html](./test/test-frontend.html)

## 🔧 Frontend Configuration

```javascript
// Set before loading mcp-logger.js
window.MCP_LOGGING_ENABLED = true;                    // Enable/disable logging
window.MCP_LOGGING_APP_NAME = 'my-app';               // REQUIRED: Your app name
window.MCP_LOGGING_BACKEND_URL = 'http://localhost:22345'; // Backend URL
window.MCP_LOGGING_BUFFER_SIZE = 100;                 // Log buffer size
```

**Note:** Backend configuration is handled through the `.env` file (see Configuration section above).

## 🐛 Troubleshooting

### Common Issues

**Backend server won't start:**
```bash
# Check if port is in use
lsof -i :22345

# Check .env file configuration
cat .env

# Use different port if needed
PORT=3001 node logger-server.js

# Or use environment variables directly
HOST=0.0.0.0 PORT=3001 node logger-server.js
```

**Frontend can't connect:**
```bash
# Check backend health
curl http://localhost:22345/api/health
```

**Logs not appearing in MCP:**
- Check browser console for errors
- Verify network requests are being sent to `/api/logs/submit`
- Ensure backend server is running

**MCP tool not available:**
- Verify AI Client configuration path is correct
- Check that args array contains absolute path to `mcp-server.js`

## 🔒 Security Note

This system is designed for development environments only. It uses HTTP communication and assumes trusted local networks. For production use, implement proper authentication and use HTTPS.

## 📁 File Structure

```
mcp-logger/
├── mcp-logger.js                    # Frontend logger
├── inject-logger.js                 # Auto-loading script
├── logger-server.js                 # Backend HTTP server
├── mcp-server.js                     # MCP server
├── .env.example                     # Example configuration
├── .env                             # Your configuration (create from .env.example)
├── test-*.html                      # Test files
├── package.json                     # Dependencies
└── README.md                        # This file
```

## 📞 Backend Integration

### Backend System Logging

This logger can be simply used from any backend system as well, just use `http://localhost:22345/api/logs/submit` endpoint with 
```
POST /api/logs/submit
Content-Type: application/json
```
```json
{
    "app": "my-backend-app",
    "host": "localhost:3000",
    "logs": {
        "{your namespace}": [  ]
    }
}
```

## 📞 Support

For technical support:
1. Check the troubleshooting section above
2. Review individual task documentation in the `docs/` folder
3. Create an issue with detailed information

## 📚 API Documentation

### 📖 Local Documentation
- **🔗 Interactive Swagger UI**: [docs/openapi.html](./docs/openapi.html) - Test API endpoints directly in your browser
- **📚 Beautiful Documentation**: [docs/redoc.html](./docs/redoc.html) - Developer-friendly API reference
- **🧪 Interactive Testing**: [docs/api-test-examples.html](./docs/api-test-examples.html) - Complete testing interface

### 🌐 Online Documentation
- **📖 API Specification**: [openapi.yaml](./openapi.yaml) - Complete OpenAPI 3.1 specification
- **📚 Developer Guide**: [API.md](./docs/API.md) - Comprehensive integration guide
