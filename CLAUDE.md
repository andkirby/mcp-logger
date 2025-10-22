# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser Logging System - A lightweight MCP-integrated logging system that captures frontend console logs and makes them accessible via the Model Context Protocol. Designed for development and debugging environments.

## Core Architecture

The system consists of three independent components that work together:

```
Frontend App (with mcp-logger.js)
    ↓ HTTP POST
Backend Server (logger-server.js) :22345
    ↓ HTTP GET / SSE Stream
MCP Server (mcp-server.js)
    ↓ STDIO
AI Assistant (Claude Desktop)
```

### Key Components

**mcp-logger.js** - Frontend logger (browser-side)
- Console interception for all console methods (log, error, warn, info, debug)
- Application logging API: `logger.log('namespace', data)`
- HTTP transmission to backend with buffering and retry logic
- Auto-configuration when loaded from backend server
- Host identification via `window.location.host`
- Fallback buffer for backend unavailability (500 entries max)
- Duplicate log filtering and batching

**logger-server.js** - Backend HTTP server (Node.js)
- In-memory log storage (500 entries per namespace per host)
- Multi-host support (localhost:3000, localhost:5173, etc.)
- Rate limiting (200 req/10s for localhost, 1000 req/min for others)
- Serves mcp-logger.js with auto-configuration injection
- SSE streaming endpoint for real-time log delivery
- Duplicate filtering (5-second window)
- Web UI log viewer at http://localhost:22345

**mcp-server.js** - MCP server (Node.js)
- STDIO transport for Claude Desktop integration
- `get_logs` tool with intelligent host/namespace selection
- SSE-based real-time log streaming with HTTP fallback
- Auto-selection logic (single host → auto-select, multiple → prompt)
- Tool annotations: readOnlyHint=true, idempotentHint=false, openWorldHint=true
- Pagination support with offset parameter
- CHARACTER_LIMIT (5,000 chars) with automatic truncation

**shell-log.sh** - Shell command logging wrapper
- Captures stdout/stderr from shell commands in real-time
- Uses nohup with process substitution for background process capture
- Memory-only logging (no disk files)
- Auto-generates namespace from command name (truncated to 30 chars)
- Usage: `./shell-log.sh app-name command [args...]`

## Development Commands

### Running the System

```bash
# Install dependencies
npm install

# Start backend server (Terminal 1)
npm run start-backend
# or
node logger-server.js

# Start backend with auto-reload (Terminal 1)
npm run dev-backend

# Start MCP server (Terminal 2)
npm run start-mcp
# or
node mcp-server.js

# Run both in parallel (development)
npm run dev

# Test backend health
curl http://localhost:22345/api/health

# Test log status
curl http://localhost:22345/api/logs/status

# Open web log viewer
open http://localhost:22345
```

### Testing

```bash
# Serve test HTML files locally
python -m http.server 3000
# Then open: http://localhost:3000/test-frontend.html

# Test shell logging
./shell-log.sh test-app echo "Hello from shell"

# MCP inspector test
npx @modelcontextprotocol/inspector --cli \
  node mcp-server.js \
  -e FILTER_APP=my-app --method tools/call --tool-name 'get_logs'
```

## Configuration

### Frontend Configuration

Set before loading mcp-logger.js:
```javascript
window.MCP_LOGGING_ENABLED = true;              // Enable/disable logging
window.MCP_LOGGING_APP_NAME = 'my-app';         // Application name (REQUIRED)
window.MCP_LOGGING_BACKEND_URL = 'http://localhost:22345'; // Backend URL
window.MCP_LOGGING_BUFFER_SIZE = 100;           // Log buffer size
window.MCP_LOGGING_BATCH_INTERVAL = 100;        // Batch interval (ms)
```

**Important**: Application name (`MCP_LOGGING_APP_NAME`) is required for proper log organization and retrieval via MCP.

### Backend Configuration

Environment variables (.env file):
```bash
PORT=22345                    # Server port (default: 22345)
HOST=localhost                # Server host (use 0.0.0.0 for external access)
MAX_LOG_ENTRIES=500           # Max logs per namespace per host
```

### MCP Configuration

**Quick Setup (using Claude Code CLI):**

```bash
# Show help and copy commands
node mcp-server.js mcp-help

# Basic setup (app parameter required in get_logs)
claude mcp add FE-logs node /absolute/path/to/mcp-server.js

# With default app (recommended for single-app projects)
claude mcp add FE-logs node /absolute/path/to/mcp-server.js --env FILTER_APP=my-app

# Remove if needed
claude mcp remove FE-logs
```

**Manual Configuration (Claude Desktop):**

Add to config file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):
```json
{
  "mcpServers": {
    "browser-logs": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-logger/mcp-server.js"],
      "env": {
        "FILTER_APP": "my-app-name"
      }
    }
  }
}
```

**FILTER_APP Environment Variable:**
- Sets a default app for `get_logs` tool
- Makes `app` parameter optional in queries
- Useful for single-application projects
- Can still override by passing `app` explicitly

## Integration Patterns

### Auto-Loading (Recommended)

Uses inject-logger.js for automatic backend detection and script loading. Place in HTML:
```html
<script src="inject-logger.js"></script>
```

### Manual Integration

```html
<script>
  window.MCP_LOGGING_ENABLED = true;
  window.MCP_LOGGING_APP_NAME = 'my-app';  // Required!
  window.MCP_LOGGING_BACKEND_URL = 'http://localhost:22345';
</script>
<script src="mcp-logger.js"></script>
```

### Server-Side Loading

Load directly from backend for auto-configuration:
```html
<script src="http://localhost:22345/mcp-logger.js"></script>
```

## Key Implementation Details

### Log Storage Strategy

- **In-memory storage**: Map of apps → Map of hosts → Map of namespaces → Array of logs
- **Circular buffer**: Oldest logs removed when limit (500) exceeded per namespace
- **Multi-app support**: Each application tracked separately by name
- **Multi-host support**: Each frontend host (e.g., localhost:3000) tracked separately within an app
- **Namespace isolation**: browser, user-actions, api-calls, etc. stored independently

### Buffering and Retry Logic

Frontend logger implements sophisticated retry:
1. Initial transmission attempt via fetch()
2. On failure: logs moved to fallbackBuffer (max 500 entries)
3. Exponential backoff retry (5s × retry count)
4. Max 3 retry attempts before giving up
5. On successful reconnection: fallbackBuffer flushed to backend

### Duplicate Filtering

Backend filters duplicates with 5-second window:
- Browser logs: filtered by `level:message:source` key
- Application logs: filtered by namespace + JSON.stringify(data)
- Automatic cleanup of filter cache when >1000 entries

### SSE Streaming

Real-time log delivery via Server-Sent Events:
- MCP server maintains persistent SSE connection to backend
- New logs pushed immediately via `new_logs` event
- Keep-alive messages every 30 seconds
- Fallback to HTTP polling if SSE unavailable

### Auto-Configuration Injection

When mcp-logger.js is served from backend (GET /mcp-logger.js):
- Server injects configuration snippet at top of script
- Sets `window.MCP_LOGGING_BACKEND_URL` based on request host
- Auto-enables logging if not explicitly configured
- Client registration sent on first connection

### MCP Server Critical Implementation Notes

**STDIO Transport Protocol:**
- MCP servers using STDIO transport communicate via stdin/stdout
- **NEVER use `console.log()`** - it writes to stdout and breaks MCP JSON protocol
- **ALWAYS use `console.error()`** for logging - writes to stderr (safe)
- Claude Desktop reads MCP protocol messages from stdout
- Any non-JSON output to stdout causes "Unexpected token" JSON parsing errors

**Tool Annotations:**
- readOnlyHint: true (tool doesn't modify data)
- destructiveHint: false (tool doesn't delete anything)
- idempotentHint: false (results change as new logs stream in)
- openWorldHint: true (connects to external backend server)

**Pagination and Limits:**
- Default lines: 5 (reduced from 20 for better readability)
- Max lines: 20 (reduced from 100)
- Offset parameter: supports pagination (default: 0)
- CHARACTER_LIMIT: 5,000 chars (automatic truncation with helpful message)

## API Endpoints

### Backend Server

```
POST /api/logs/submit                    # Submit logs from frontend (requires app, host, logs)
GET  /api/logs/status                    # Get all apps, hosts, and namespaces
GET  /api/logs/:app/:host/:namespace     # Retrieve specific logs (query: ?lines=5&offset=0&filter=text)
GET  /api/health                         # Health check
GET  /mcp-logger.js                      # Serve logger script with auto-config
GET  /api/logs/stream                    # SSE streaming endpoint (supports app, frontend_host, namespace params)
GET  /                                   # Web log viewer UI
```

### MCP Tool

**Without FILTER_APP (app parameter required):**
```javascript
get_logs(app="my-app")
get_logs(app="my-app", filter="error", lines=10, offset=0)
get_logs(app="my-app", frontend_host="localhost:3000", namespace="user-actions")
```

**With FILTER_APP set (app parameter optional):**
```javascript
get_logs()                                  // Uses default app from FILTER_APP
get_logs(filter="error", lines=10)          // Uses default app
get_logs(offset=5)                          // Pagination with default app
get_logs(app="other-app")                   // Override default app
get_logs(app="other-app", namespace="api-calls")  // Override with specific namespace
```

**Parameters:**
- app: Application name (required unless FILTER_APP set)
- lines: Number of log lines (1-20, default: 5)
- offset: Pagination offset (min: 0, default: 0)
- filter: Text search filter
- frontend_host: Specific host to query
- namespace: Specific namespace to query

**Important**:
- The `app` parameter is mandatory unless `FILTER_APP` is set
- `FILTER_APP` provides a default but can be overridden per query
- Pagination works by skipping `offset` entries and returning `lines` entries

## Common Development Tasks

### Adding a New Namespace

Namespaces are created automatically when first log is sent:
```javascript
// Frontend
logger.log('my-new-namespace', { custom: 'data' });
```

### Debugging Connection Issues

1. Check backend health: `curl http://localhost:22345/api/health`
2. Check frontend console for "BrowserLogger:" messages
3. Verify CORS headers in network tab
4. Check rate limiting status in backend logs
5. Verify SSE connection in MCP server logs

### Debugging MCP Server Issues

1. **JSON parsing errors**: Check for `console.log()` usage (must be `console.error()`)
2. **Tool not found**: Verify MCP server is running and path is correct in Claude Desktop config
3. **Empty responses**: Check backend server is running on correct port
4. **SSE connection fails**: Backend may be down, will fall back to HTTP

### Modifying Log Format

**Frontend**: Edit `addConsoleLog()` in mcp-logger.js for browser logs, or pass custom data structure to `logger.log()`

**Backend**: Edit `buildLogOutput()` in mcp-server.js for MCP output formatting

### Changing Storage Limits

**Backend**: Modify `maxEntries` parameter in LogStorage constructor (logger-server.js:11)

**Frontend**: Set `window.MCP_LOGGING_BUFFER_SIZE` before loading script

**MCP Server**: Modify `this.CHARACTER_LIMIT` in constructor (mcp-server.js:31)

## File Structure

```
mcp-logger/
├── mcp-logger.js                    # Frontend logger (browser-side)
├── inject-logger.js                 # Auto-loading injection script
├── logger-server.js                 # Backend HTTP server
├── mcp-server.js                    # MCP server (STDIO transport, SSE-based)
├── shell-log.sh                     # Shell command logging wrapper
├── .env.example                     # Example environment configuration
├── test-*.html                      # Test/demo HTML files
├── assets/                          # Web viewer assets (CSS, JS)
├── templates/                       # HTML templates
├── docs/                            # Documentation
│   ├── SHELL_LOGGING.md             # Shell logging guide
│   └── CRs/                         # Change requests (gitignored)
├── test/                            # Test files
├── package.json                     # Dependencies and scripts
└── README.md                        # User documentation
```

## Testing Strategy

Use provided test HTML files for verification:
- `test-frontend.html` - Full integration test
- `test-simple.html` - Basic console logging test
- Web viewer at http://localhost:22345

## Dependencies

Runtime:
- `express` - Backend HTTP server
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `eventsource` - SSE client for MCP server
- `dotenv` - Environment variable management

Development:
- `nodemon` - Auto-reload during development
- `concurrently` - Run multiple processes in parallel

## Important Constraints

1. **Never include references to Claude, AI tools, or automated assistance in git commits** (messages, co-author tags, or any metadata)
2. **Never mention Co-Authored-By: Claude <noreply@anthropic.com>**
3. **MCP servers using STDIO must use console.error() for all logging** (never console.log())
4. **Application name is required** for proper log organization
5. **This system is for development environments only** - not production-ready (no auth, uses HTTP)
