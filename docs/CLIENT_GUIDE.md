# MCP Logger Client Guide (Unified Server Architecture)

## Quick Start

Add this single script to your HTML `<head>`. It works whether the backend is online or offline:

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

This approach automatically detects if the backend server is running and provides a simple fallback when it's offline.

---

## Using Namespaced Logger

### Basic API
```javascript
logger.log('namespace-name', data);
```

**Works whether backend is online or offline!** When using the offline-first approach with the logger stub, all calls will:

1. **Online**: Send to backend server + console log
2. **Offline**: Store locally + console log (can sync later)

### Managing Offline Logs

```javascript
// Check if we have pre-logger or offline logs
const offlineLogs = logger.getOfflineLogs();
if (offlineLogs.length > 0) {
    console.log(`${offlineLogs.length} logs stored while offline or during loading`);

    // Optionally clear them after processing
    logger.clearOfflineLogs();
}
```

**Note**: The mcp-logger.js script has its own fallback buffer mechanism when the backend is available but temporarily unreachable. The offline logs shown here are specifically for when the backend server is completely down during initial page load.

### Examples

**User Actions:**
```javascript
logger.log('user-actions', {
    element: 'submit-button',
    action: 'click',
    timestamp: Date.now()
});
```

**API Calls:**
```javascript
logger.log('api', {
    endpoint: '/api/users',
    method: 'GET',
    status: 200,
    responseTime: 245
});
```

**Simple Messages:**
```javascript
logger.log('info', 'Application started');
logger.log('debug', 'Component mounted');
```

**Numbers:**
```javascript
logger.log('performance', 124.5);  // Response time
logger.log('counter', 42);        // Page views
```

**Data Types You Can Use:**
- ✅ Objects (recommended)
- ✅ Arrays
- ✅ Strings
- ✅ Numbers
- ✅ Booleans
- ✅ Any JSON-serializable data

---

## Adding MCP Server

### 1. Install Dependencies
```bash
cd mcp-logger
npm install
```

### 2. Start Backend Server
```bash
npm run start-backend
# or
node logger-server.js
# Server runs on http://localhost:22345
```

### 3. Configure MCP Server in Claude Code

**Show help and get full path:**
```bash
node mcp-server.js mcp-help
```

**Add to Claude Code (basic - app parameter required):**
```bash
claude mcp remove FE-logs --scope local
claude mcp add FE-logs node /absolute/path/to/mcp-server.js --scope local
```

**Add with default app (recommended for single-app projects):**
```bash
claude mcp add FE-logs node /absolute/path/to/mcp-server.js --env FILTER_APP=my-app --scope local
```

**Manual Configuration (Claude Desktop):**

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "browser-logs": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-logger/mcp-server.js"],
      "env": {
        "FILTER_APP": "my-app"
      }
    }
  }
}
```

### 4. Use the MCP Tool

**Without FILTER_APP (app parameter required):**
```javascript
get_logs(app="my-app")
get_logs(app="my-app", filter="error", lines=10)
get_logs(app="my-app", frontend_host="localhost:3000", namespace="user-actions")
```

**With FILTER_APP=my-app (app parameter optional):**
```javascript
get_logs()                                    // Uses default app
get_logs(filter="error", lines=50)            // Uses default app
get_logs(app="other-app")                     // Override default
get_logs(app="my-app", namespace="api-calls") // Specific namespace
```

---

## Architecture

### System Flow
```
Frontend (mcp-logger.js) → Backend Server (HTTP + SSE) ← MCP Server → Claude Code
```

### Key Features
1. **App-Based Organization** - Logs organized by app name, then host, then namespace
2. **Multi-App Support** - Track multiple applications separately
3. **Default App Filtering** - FILTER_APP env var for single-app projects
4. **SSE Streaming** - Real-time log updates to MCP server
5. **Flexible Deployment** - Two separate processes for stability

### Required Configuration
- **Frontend**: Must set `MCP_LOGGING_APP_NAME`
- **MCP Server**: App parameter required (or set FILTER_APP default)

---

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
    <!-- Compatible offline-first logger -->
    <script>
    (function() {
        // Store any logs that happen before the main logger loads
        if (!window._preLoggerBuffer) window._preLoggerBuffer = [];

        // Create a simple log function that stores logs temporarily
        var tempLog = function(namespace, data) {
            window._preLoggerBuffer.push({
                namespace: namespace,
                data: data,
                timestamp: new Date().toISOString()
            });

            // Also log to console for development
            console.log('[MCP Logger][offline][' + namespace + ']', data);
        };

        // Create initial logger stub (will be replaced by mcp-logger.js when it loads)
        window.logger = {
            log: tempLog,
            getOfflineLogs: function() {
                return window._preLoggerBuffer || [];
            },
            clearOfflineLogs: function() {
                window._preLoggerBuffer = [];
            }
        };

        window.MCP_LOGGING_ENABLED = true;
        window.MCP_LOGGING_APP_NAME = 'my-app';  // REQUIRED: Set your app name
        window.MCP_LOGGING_BACKEND_URL = 'http://localhost:22345';

        // Try to load the full logger, but keep working if it fails
        var script = document.createElement('script');
        script.src = 'http://localhost:22345/mcp-logger.js';
        script.onerror = function() {
            console.log('MCP Logger server offline, using local stub');
            // Logger stub already created above, so logs continue working
        };
        script.onload = function() {
            console.log('MCP Logger loaded successfully');
            // The real logger has taken over, but we keep the offline log methods
            if (window.logger && window.logger.log && !window.logger.getOfflineLogs) {
                // Add offline log methods to the real logger
                window.logger.getOfflineLogs = function() {
                    return window._preLoggerBuffer || [];
                };
                window.logger.clearOfflineLogs = function() {
                    window._preLoggerBuffer = [];
                };
            }
        };
        document.head.appendChild(script);
    })();
    </script>
</head>
<body>
    <button id="submit-btn">Submit</button>

    <script>
        // Use namespaced logger - works whether backend is online or not
        document.getElementById('submit-btn').addEventListener('click', () => {
            logger.log('user-actions', {
                element: 'submit-btn',
                action: 'click',
                timestamp: Date.now()
            });

            // Simulate API call
            logger.log('api', {
                endpoint: '/api/submit',
                method: 'POST',
                status: 'pending'
            });
        });

        // Application started
        logger.log('lifecycle', {
            event: 'page-load',
            timestamp: Date.now()
        });

        // Check if we have offline logs to sync later
        setTimeout(() => {
            const offlineLogs = logger.getOfflineLogs();
            if (offlineLogs.length > 0) {
                console.log(`Stored ${offlineLogs.length} logs while backend was offline`);
            }
        }, 1000);
    </script>
</body>
</html>
```

---

## Server Administration

### Backend Server Features
- **HTTP API**: Log submission and retrieval endpoints
- **SSE Streaming**: Real-time log updates to MCP server
- **Auto-configuration**: Serves configured mcp-logger.js
- **Health Monitoring**: `/api/health` endpoint
- **Multi-App Support**: Organizes logs by app → host → namespace

### Starting Servers
```bash
# Backend server (Terminal 1)
npm run start-backend
# or
node logger-server.js

# MCP server (Terminal 2 - if not using Claude Code CLI)
npm run start-mcp
# or
node mcp-server.js

# Or run both together
npm run dev
```

### Monitoring
```bash
# Check server status
curl http://localhost:22345/api/health

# View connected apps and hosts
curl http://localhost:22345/api/logs/status

# Test SSE stream
curl -N http://localhost:22345/api/logs/stream

# Get logs from specific app/host/namespace
curl "http://localhost:22345/api/logs/my-app/localhost:3000/browser?lines=10"
```
