# Browser Logging System

A lightweight logging system that captures frontend console logs and makes them accessible via MCP (Model Context Protocol). Perfect for development and debugging environments.

## 🚀 Quick Start (5-Minute Setup)

### Step 1: Install Dependencies
```bash
cd mcp-logger
npm install
```

### Step 2: Start Backend Server
```bash
# Terminal 1
node logger-server.js
# Expected: 🚀 Browser Logger Server running on http://localhost:22345
```

### Step 3: Start MCP Server
```bash
# Terminal 2
node browser-logs-sse-mcp-server.js
# Expected: 🚀 Browser Logs MCP Server starting...
```

### Step 4: Add to Frontend Application

#### Option A: Auto-Loading Injection (Recommended)
```html
<!DOCTYPE html>
<html>
<head>
    <title>My App</title>
    <!-- Simple auto-loading injection -->
    <script src="inject-logger.js"></script>
</head>
<body>
    <h1>My Application</h1>
    <button onclick="testLogging()">Test Logging</button>

    <script>
        function testLogging() {
            console.log('Button clicked!');
            logger.log('user-actions', {
                action: 'click',
                element: 'test-button',
                timestamp: Date.now()
            });
        }
    </script>
</body>
</html>
```

#### Option B: Manual Configuration
```html
<!DOCTYPE html>
<html>
<head>
    <title>My App</title>
    <script>
        // Enable logging BEFORE loading logger script
        window.MCP_LOGGING_ENABLED = true;
        window.MCP_LOGGING_BACKEND_URL = 'http://localhost:22345';
    </script>
    <script src="mcp-logger.js"></script>
</head>
<body>
    <h1>My Application</h1>
    <button onclick="testLogging()">Test Logging</button>

    <script>
        function testLogging() {
            console.log('Button clicked!');
            logger.log('user-actions', {
                action: 'click',
                element: 'test-button',
                timestamp: Date.now()
            });
        }
    </script>
</body>
</html>
```

### Step 5: Configure Claude Desktop (Optional)
If you want to use the MCP server with Claude Desktop:

```bash
# Quick setup with Claude Code CLI
node browser-logs-sse-mcp-server.js mcp-help

# Basic setup
claude mcp add FE-logs node /absolute/path/to/browser-logs-sse-mcp-server.js

# With default app (recommended for single-app projects)
claude mcp add FE-logs node /absolute/path/to/browser-logs-sse-mcp-server.js --env FILTER_APP=my-app
```

### Step 6: Test Your Setup
Use the `get_logs()` tool in your MCP client to retrieve logs from your frontend application.

## 📋 System Overview

The Browser Logging System consists of three main components:

1. **Frontend Logger** (`mcp-logger.js`) - Captures console logs and sends to backend
2. **Backend Server** (`logger-server.js`) - Receives and stores logs from frontend
3. **MCP Server** (`browser-logs-sse-mcp-server.js`) - Provides MCP access to stored logs

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
// Basic log retrieval (auto-selects single host)
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
Create an HTML file to test integration:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Integration Test</title>
    <script src="inject-logger.js"></script>
</head>
<body>
    <h1>Integration Test</h1>
    <button onclick="runTests()">Run Tests</button>

    <script>
        function runTests() {
            console.log('Starting integration tests...');
            console.error('Test error log');

            logger.log('test-namespace', {
                test: true,
                message: 'Integration test data'
            });
        }
    </script>
</body>
</html>
```

## 🔧 Configuration Options

### Frontend Configuration
```javascript
// Set before loading mcp-logger.js
window.MCP_LOGGING_ENABLED = true;                    // Enable/disable logging
window.MCP_LOGGING_BACKEND_URL = 'http://localhost:22345'; // Backend URL
window.MCP_LOGGING_BUFFER_SIZE = 100;                 // Log buffer size
```

### Backend Configuration
```bash
# Environment variables
PORT=22345                              # Server port
MAX_LOG_ENTRIES=500                     # Max entries per namespace
```

## 🐛 Troubleshooting

### Common Issues

**Backend server won't start:**
```bash
# Check if port is in use
lsof -i :22345
# Use different port if needed
PORT=3001 node logger-server.js
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
- Verify Claude Desktop configuration path is correct
- Check that args array contains absolute path to `browser-logs-sse-mcp-server.js`

## 🔒 Security Note

This system is designed for development environments only. It uses HTTP communication and assumes trusted local networks. For production use, implement proper authentication and use HTTPS.

## 📁 File Structure

```
mcp-logger/
├── mcp-logger.js                    # Frontend logger
├── inject-logger.js                 # Auto-loading script
├── logger-server.js                 # Backend HTTP server
├── browser-logs-sse-mcp-server.js   # MCP server
├── test-*.html                      # Test files
├── package.json                     # Dependencies
└── README.md                        # This file
```

## 📞 Support

For technical support:
1. Check the troubleshooting section above
2. Review individual task documentation in the `docs/` folder
3. Create an issue with detailed information

---

**You're ready to go!** The Browser Logging System is now configured and ready for development use.