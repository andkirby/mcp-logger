# Shell Logging Guide

Comprehensive guide for capturing shell command output and forwarding it to the MCP Logger system.

## Overview

The MCP Logger system provides two powerful shell logging wrappers that capture command output in real-time and stream it to a web interface:

- **shell-log.sh** - Bash wrapper for simple shell command logging
- **shell-log.js** - Node.js wrapper with advanced configuration options

Both wrappers capture stdout/stderr, track command execution, and provide real-time streaming to the web log viewer at `http://localhost:22345`.

---

## shell-log.sh (Bash Wrapper)

### Quick Start

```bash
# Make executable
chmod +x shell-log.sh

# Basic usage - first argument is app name
./shell-log.sh [app-name] [command] [args...]
```

### Usage Examples

```bash
# Build process logging
./shell-log.sh my-app npm run build
./shell-log.sh build-tool webpack --mode production

# API testing
./shell-log.sh api-test curl -s http://api.example.com/health
./shell-log.sh api-client http POST http://localhost:3000/api/users name=John

# Docker operations
./shell-log.sh docker-monitor docker logs my-app
./shell-log.sh container-build docker build -t myapp .

# Git operations
./shell-log.sh git-deploy git pull origin main
./shell-log.sh repo-status git status --porcelain

# Database operations
./shell-log.sh db-runner npm run migrate
./shell-log.sh backup-tool pg_dump mydb > backup.sql

# File operations
./shell-log.sh sync-tool rsync -av src/ backup/
./shell-log.sh cleanup-job find /tmp -name "*.tmp" -delete
```

### Key Changes

- **App Name**: First argument is now the application name
- **Auto-Generated Namespace**: Created from command (truncated to 30 characters)
- **Simplified Usage**: No need to manually specify namespaces

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_LOGGING_BACKEND_URL` | `http://localhost:22345` | Backend server URL |
| `MCP_LOGGING_APP_NAME` | `shell-commands` | Application name for logs |
| `HOSTNAME` | `system hostname` | Host identifier |
| `MCP_LOGGING_VERBOSE` | `false` | Enable debug output |

### Configuration Examples

```bash
# Set custom backend URL
export MCP_LOGGING_BACKEND_URL=http://logger.example.com:22345

# Set custom app name for CI/CD pipeline
export MCP_LOGGING_APP_NAME=ci-pipeline

# Enable verbose debugging
export MCP_LOGGING_VERBOSE=true

# Use custom hostname
export HOSTNAME=build-server-01

# Run with custom configuration
./shell-log.sh build npm run build
```

### Features

- **Real-time Streaming**: Output appears immediately in web interface
- **Dual Stream Capture**: Captures both stdout and stderr separately
- **Command Tracking**: Logs command start, execution, and completion with exit codes
- **Working Directory Context**: Includes current directory in log entries
- **Retry Logic**: Automatic retry with exponential backoff on network failures
- **Timestamped Entries**: Each log line includes precise timestamps
- **Graceful Degradation**: Command execution continues even if logging fails

### Log Structure

Each shell command generates structured log entries:

```json
{
  "type": "command-start",
  "command": "npm run build",
  "workingDir": "/path/to/project",
  "timestamp": 1695123456789
}

{
  "type": "output",
  "stream": "stdout",
  "content": "Build completed successfully",
  "workingDir": "/path/to/project",
  "timestamp": 1695123456790
}

{
  "type": "command-complete",
  "command": "npm run build",
  "exitCode": 0,
  "duration": 15420,
  "workingDir": "/path/to/project",
  "timestamp": 1695123472209
}
```

---

## shell-log.js (Node.js Wrapper)

### Quick Start

```bash
# Simple mode - first argument is app name
node shell-log.js [app-name] [command] [args...]

# Advanced mode with options
node shell-log.js --app-name "my-app" -- [command] [args...]
```

### Usage Modes

#### Simple Mode (Recommended)
```bash
# First argument is app name, namespace auto-generated
node shell-log.js my-app npm test
node shell-log.js build-tool webpack --mode production
node shell-log.js api-test curl -s http://api.example.com/health
```

#### Advanced Mode (Full Control)
```bash
# Use -- separator for custom options
node shell-log.js --app-name "ci-cd" -- npm run build
node shell-log.js --backend-url "http://logger:22345" -- docker-compose up
node shell-log.js --verbose -- node server.js
```

### Command Line Options

| Option | Default | Description |
|--------|---------|-------------|
| `--app-name NAME` | `shell-commands` | Application name for logs |
| `--host-name NAME` | `OS hostname` | Host name for logs |
| `--namespace NAME` | `auto-generated` | Log namespace (from command) |
| `--backend-url URL` | `http://localhost:22345` | Backend server URL |
| `--batch-size NUM` | `10` | Log batch size |
| `--batch-timeout MS` | `500` | Batch timeout in milliseconds |
| `--max-retries NUM` | `3` | Maximum retry attempts |
| `--retry-delay MS` | `1000` | Base retry delay in milliseconds |
| `--working-dir PATH` | `current directory` | Working directory for command |
| `--verbose` | `false` | Enable verbose logging |
| `--help` | - | Show help information |

### Usage Examples

```bash
# Simple mode examples
node shell-log.js my-app npm test
node shell-log.js frontend npm run build
node shell-log.js backend python manage.py test
node shell-log.js monitoring curl -f http://api.example.com/health

# Advanced mode with custom backend
node shell-log.js --backend-url "http://logger.example.com:22345" -- docker-compose up

# Custom retry and batch settings
node shell-log.js --max-retries 5 --batch-size 20 -- npm run build:prod

# Execute in specific directory
node shell-log.js --working-dir "/path/to/frontend" -- npm run build

# Verbose output for debugging
node shell-log.js --verbose node script.js
```

### Key Features

- **Dual Mode**: Simple mode for quick usage, advanced mode for full control
- **Auto-Generated Namespace**: Command becomes namespace (truncated to 30 chars)
- **Flexible Arguments**: Choose between simple and advanced invocation patterns

### Advanced Configuration

```bash
# Production CI/CD pipeline
node shell-log.js \
  --app-name "production-build" \
  --namespace "pipeline" \
  --backend-url "http://build-logger.company.com:22345" \
  --max-retries 5 \
  --batch-size 50 \
  --verbose \
  -- npm run build:prod

# Development environment
node shell-log.js \
  --app-name "dev-server" \
  --namespace "development" \
  --batch-timeout 200 \
  --working-dir "/Users/developer/project" \
  -- npm run dev

# Monitoring and health checks
node shell-log.js \
  --app-name "system-monitor" \
  --namespace "health-checks" \
  --host-name "web-server-01" \
  -- curl -s -w "%{http_code}" http://localhost:8080/health
```

### Programmatic Usage

```javascript
const ShellLogger = require('./shell-log.js');

const logger = new ShellLogger({
  appName: 'my-application',
  namespace: 'custom-logs',
  backendUrl: 'http://localhost:22345',
  verbose: true,
  maxRetries: 5,
  batchSize: 20
});

async function runCommand() {
  try {
    const result = await logger.executeCommand('npm', ['run', 'build']);
    console.log(`Command completed in ${result.duration}ms`);
  } catch (error) {
    console.error('Command failed:', error.message);
  }
}

runCommand();
```

### Advanced Features

#### Batch Processing
The Node.js wrapper batches log entries for efficient transmission:

```bash
# Send logs in batches of 20
node shell-log.js --batch-size 20 -- npm run test

# Send batches every 2 seconds max
node shell-log.js --batch-timeout 2000 -- npm run build
```

#### Retry Logic
Configurable retry with exponential backoff:

```bash
# Up to 5 retries with 2-second base delay
node shell-log.js --max-retries 5 --retry-delay 2000 -- npm run deploy
```

#### Background Retry Queue
Failed logs are retried in the background without blocking command execution.

#### Working Directory Isolation
Execute commands in specific directories:

```bash
# Build frontend from project root
node shell-log.js --working-dir "./frontend" -- npm run build

# Run tests from backend directory
node shell-log.js --working-dir "./backend" -- python manage.py test
```

---

## Web Interface Integration

### Viewing Logs

1. Start the backend server:
   ```bash
   npm run start-backend
   ```

2. Open web interface:
   ```bash
   open http://localhost:22345
   ```

3. Select your log source:
   - **App**: Choose your application name (default: `shell-commands`)
   - **Host**: Select the hostname where commands were executed
   - **Namespace**: Choose the log namespace (default: `shell-output`)

### Real-time Features

- **Live Streaming**: See command output as it happens
- **Color Coding**: stdout (normal) vs stderr (red) vs system events (blue)
- **Search/Filter**: Find specific log entries or filter by content
- **Export**: Copy logs to clipboard for sharing
- **Pause/Resume**: Control streaming for detailed analysis

### Log Display Format

The web interface displays structured logs with:
- Timestamps in local timezone
- Command start/completion indicators
- Exit codes and duration information
- Working directory context
- Color-coded stream identification

---

## Integration Examples

### CI/CD Pipeline

```bash
#!/bin/bash
# ci-build.sh

set -e

export MCP_LOGGING_APP_NAME="ci-pipeline"
export MCP_LOGGING_BACKEND_URL="http://build-logger.company.com:22345"

echo "Starting CI pipeline..."

# Install dependencies
./shell-log.sh dependencies npm ci

# Run tests
./shell-log.sh tests npm test

# Build application
./shell-log.sh build npm run build

# Deploy to staging
./shell-log.sh deploy npm run deploy:staging

echo "CI pipeline completed!"
```

### Development Workflow

```bash
#!/bin/bash
# dev-setup.sh

export MCP_LOGGING_APP_NAME="development"
export MCP_LOGGING_VERBOSE=true

# Start development server with logging
./shell-log.sh dev-server npm run dev &

# Run linting in parallel
./shell-log.sh linting npm run lint &

# Run tests in background
./shell-log.sh tests npm run test:watch &

wait
```

### System Monitoring

```bash
#!/bin/bash
# monitor.sh

export MCP_LOGGING_APP_NAME="system-monitor"

while true; do
  # Check disk space
  ./shell-log.sh disk-usage df -h

  # Check memory usage
  ./shell-log.sh memory free -h

  # Check running processes
  ./shell-log.sh processes ps aux | head -20

  # Network connectivity
  ./shell-log.sh network ping -c 3 8.8.8.8

  sleep 300  # Every 5 minutes
done
```

### Database Operations

```bash
#!/bin/bash
# db-ops.sh

export MCP_LOGGING_APP_NAME="database-ops"

# Database migration
./shell-log.sh migration npm run migrate

# Database backup
./shell-log.sh backup pg_dump mydb > backup_$(date +%Y%m%d).sql

# Restore database
./shell-log.sh restore psql mydb < backup_20231019.sql

# Database health check
./shell-log.sh health-check psql -c "SELECT COUNT(*) FROM users;"
```

---

## Troubleshooting

### Common Issues

**Backend server not running:**
```bash
# Start backend server
npm run start-backend

# Check if port is available
lsof -i :22345
```

**Logs not appearing in web interface:**
1. Check backend URL is correct
2. Verify network connectivity
3. Check for CORS issues
4. Review shell script output for errors

**Command execution issues:**
- Use `MCP_LOGGING_VERBOSE=true` for debug output
- Check if command exists in PATH
- Verify working directory permissions
- Ensure proper shell escaping for complex commands

### Debug Mode

```bash
# Enable verbose logging
export MCP_LOGGING_VERBOSE=true

# Or use Node.js verbose flag
node shell-log.js --verbose -- npm run build
```

### Network Issues

```bash
# Test backend connectivity
curl http://localhost:22345/api/health

# Use custom backend URL
export MCP_LOGGING_BACKEND_URL=http://backup-logger:22345
```

---

## Performance Considerations

### Batching
The Node.js wrapper batches log entries to reduce network overhead:
- Default batch size: 10 entries
- Default batch timeout: 500ms
- Adjust based on command output volume

### Retry Logic
Both wrappers implement exponential backoff:
- Initial delay: 1 second (bash) / 1000ms (Node.js)
- Maximum 3 retries by default
- Configurable via environment variables or CLI options

### Resource Usage
- Minimal memory overhead
- Non-blocking log transmission
- Graceful degradation if backend unavailable
- Automatic cleanup of temporary resources

---

## Security Notes

- The shell wrappers execute commands with current user permissions
- Network communication uses HTTP (consider HTTPS for production)
- Log data is transmitted in plain text
- Validate command inputs to prevent injection attacks
- Use appropriate authentication in production environments

---

## Migration Guide

### From Basic Logging

Replace manual logging:
```bash
# Before
npm run build 2>&1 | tee build.log

# After
./shell-log.sh build npm run build
```

### From Custom Scripts

Replace custom log forwarding:
```bash
# Before
npm run build | curl -X POST http://logger:22345/api/logs

# After
./shell-log.sh build npm run build
```

### Integration Checklist

- [ ] Backend server running at `http://localhost:22345`
- [ ] Shell scripts made executable (`chmod +x`)
- [ ] Environment variables configured
- [ ] Web interface accessible
- [ ] Test command executed successfully
- [ ] Logs appearing in web interface