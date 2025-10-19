---
code: MCL-001
title: Shell Script Wrapper for Real-time Log Streaming
status: Proposed
dateCreated: 2025-10-18T12:59:36.925Z
type: Feature Enhancement
priority: Medium
phaseEpic: Phase B (Tooling Integration)
assignee: Development Team
---

# Shell Script Wrapper for Real-time Log Streaming 11

## 1. Description

### Problem Statement
Developers currently cannot capture shell command output directly in the browser logging system, limiting visibility of server-side operations and build processes during development and debugging sessions.

### Current State
The mcp-logger system captures frontend browser logs and application logs via HTTP POST requests, but shell command output from terminal operations remains invisible to the centralized logging system. Server logs require separate monitoring tools.

### Desired State
- Developers can wrap any shell command with a simple script to capture stdout/stderr
- Real-time streaming of command output to the centralized logging system
- Seamless integration with existing mcp-logger infrastructure
- Minimal overhead on command execution
- Maintains existing command output visibility in terminal

### Rationale
- Unified logging visibility across frontend and shell operations
- Improved debugging capabilities for full-stack development
- Reduced context switching between terminal and browser logs
- Enhanced collaboration through shared command execution visibility

### Impact Areas
- mcp-logger backend server (new endpoint requirements)
- Development workflow and tooling
- MCP server integration (new log source type)
- Shell command execution patterns

## 2. Rationale

### Why This Change is Necessary
1. **Unified Observability**: Shell operations represent a significant blind spot in the current logging system
2. **Developer Experience**: Eliminates need to switch between terminal and browser logs during debugging
3. **Collaboration**: Team members can see command execution results without direct terminal access
4. **Audit Trail**: Provides persistent record of shell operations and their outcomes

### What It Accomplishes
- Real-time visibility of command execution in centralized logging system
- Preserves existing terminal output behavior
- Enables remote debugging and pair programming scenarios
- Creates searchable history of shell operations

### Alignment with Project Goals
- Extends logging system beyond browser scope
- Improves developer productivity and debugging capabilities
- Enhances the comprehensive logging infrastructure

## 3. Solution Analysis
## 3. Solution Analysis

### Chosen Approach: HTTP POST Integration

**Description**: Shell script captures command output and sends logs via HTTP POST to logger-server's existing `/api/logs/submit` endpoint. Server maintains in-memory circular buffer and broadcasts to SSE clients.

**Architecture**:
```
Logger-Wrapper → HTTP POST → Logger-Server (memory buffer) → SSE → Browser Clients
```

**Pros**:
- Works in Docker containers and across network
- Uses existing HTTP infrastructure
- Simple error handling with HTTP status codes
- Cross-platform and universal
- Flexible deployment (local, remote, containerized)
- Fast enough (~5-15ms in Docker, ~10-50ms remote)

**Cons**:
- Slightly higher latency than IPC methods
- Network overhead for serialization

**Why This Approach**:
- Docker-native communication pattern
- No filesystem coupling between containers
- Scales to distributed deployments
- Leverages existing REST endpoint
- Simple implementation and maintenance

### Alternative Approaches (Brief)

**Named Pipes**
- Pros: Fastest (~1-5ms), zero network overhead
- Cons: Same machine only, doesn't work between Docker containers without shared volumes, platform-specific
- Verdict: Not suitable for containerized environments

**WebSocket**
- Pros: Bidirectional, efficient protocol
- Cons: Overkill for unidirectional logging, requires WebSocket server
- Verdict: Unnecessary complexity for this use case

**Redis Pub/Sub**
- Pros: Built-in broadcasting, extremely fast, decouples components
- Cons: External dependency (Redis server), added complexity
- Verdict: Only beneficial for multi-server scenarios

**Shared Memory (mmap)**
- Pros: Nanosecond access, zero-copy
- Cons: Same machine only, requires synchronization code, doesn't work in containers
- Verdict: Not compatible with Docker deployment
## 4. Implementation Specification
## 4. Implementation Specification

### High-Level Architecture
```
Shell Command → log-shell.sh → HTTP POST → Logger-Server → In-Memory Buffer → SSE Broadcast → MCP Client
```

### Component Structure

**log-shell.sh Wrapper Script**:
- Spawns shell command and captures stdout/stderr
- Preserves terminal output visibility using `tee` pattern
- Posts log data to logger-server via HTTP
- Includes command metadata (command, timestamp, working directory)
- Graceful degradation when server unavailable

**Logger-Server Endpoints**:
- **POST /api/logs/submit**: Receives logs from wrapper
  - Validates and parses log payload
  - Adds to in-memory circular buffer
  - Broadcasts to all connected SSE clients
  - Returns 200 OK or appropriate error status

**In-Memory Storage**:
- Circular buffer maintaining last N logs (configurable, default 1000)
- No file I/O for fast response
- Automatic cleanup of old entries
- Thread-safe for concurrent access

**SSE Broadcasting**:
- Maintains list of active SSE client connections
- Broadcasts incoming logs immediately to all clients
- Handles client disconnections gracefully
- New clients receive recent buffer history on connection

### Integration Points
- HTTP endpoint integration with existing logger-server
- New log namespace type: "shell-commands" with command metadata
- Configuration for wrapper script location and server URL
- MCP server support for shell command log filtering
- Environment variables for customization (server URL, buffer size)

### Key Patterns
- Process spawning with dual output (terminal + HTTP)
- Non-blocking HTTP requests to avoid wrapper slowdown
- Exponential backoff retry on server unavailability
- Structured log format with command context
- Clean resource cleanup on command completion or interruption

### Critical Requirements
- Real-time output streaming without buffering delays
- Preserves existing terminal visibility and behavior
- Minimal performance impact on command execution (<5%)
- Works in Docker containerized environments
- No filesystem dependencies between components
- Graceful fallback when logging infrastructure unavailable
## 5. Acceptance Criteria
## 5. Acceptance Criteria

### Functional Requirements
- [ ] Shell script wrapper can execute any command and capture output
- [ ] Real-time streaming of stdout/stderr to logging system via HTTP POST
- [ ] Output continues to display in terminal as expected
- [ ] Command metadata (command, working directory, timestamp) captured
- [ ] Integration with existing log filtering and retrieval via MCP
- [ ] Works in Docker containerized environments
- [ ] Server maintains in-memory circular buffer (last 1000 logs)
- [ ] SSE clients receive real-time broadcasts of new logs
- [ ] New SSE clients receive recent log history from buffer

### Non-Functional Requirements
- **Reliability**: 
  - [ ] Graceful handling of server unavailability
  - [ ] Retry logic with exponential backoff
  - [ ] No log loss when server temporarily down (wrapper continues)
  - [ ] Resource leak prevention
  
- **Maintainability**: 
  - [ ] Clear script documentation
  - [ ] Simple configuration via environment variables
  - [ ] Minimal external dependencies
  
- **Security**: 
  - [ ] Input sanitization for command metadata
  - [ ] No privilege escalation risks
  - [ ] Safe handling of sensitive command output
  
- **Performance**: 
  - [ ] Command execution overhead <5%
  - [ ] HTTP POST latency <50ms (local network)
  - [ ] Low memory overhead (<10MB for buffer)
  - [ ] Non-blocking HTTP requests
  - [ ] Efficient SSE broadcasting

### Testing Requirements
- **Unit Tests**: Script argument parsing, HTTP request formatting
- **Integration Tests**: End-to-end command execution and log verification
- **Container Tests**: Docker-to-Docker communication validation
- **Load Tests**: Multiple concurrent wrappers posting to server
- **Manual Testing**: Various command types and output patterns verification
## 6. Success Metrics

### Quantifiable Measures
- Log latency: <100ms from shell output to logger availability
- Command execution overhead: <5% performance impact
- Setup time: <2 minutes for initial configuration
- Resource usage: <10MB additional memory for background processes

### Developer Experience
- One-command setup for logging integration
- Intuitive script usage matching standard shell patterns
- Clear documentation and example usage
- Seamless integration with existing debugging workflows

## 7. Migration Strategy
## 7. Migration Strategy

### For Developers (timeline)
- **Week 1**: 
  - Implement wrapper script with HTTP POST integration
  - Add in-memory circular buffer to logger-server
  - Basic SSE broadcasting functionality
  
- **Week 2**: 
  - Server endpoint enhancement and error handling
  - Retry logic and graceful degradation in wrapper
  - Docker compose configuration for testing
  
- **Week 3**: 
  - MCP server updates for shell command log filtering
  - Environment variable configuration
  - Integration testing in containerized environment
  
- **Week 4**: 
  - Documentation and usage examples
  - Performance testing and optimization
  - Developer onboarding materials

### Rollback Plan
- Remove wrapper script - no impact on core logging system
- Disable HTTP endpoint via feature flag if issues arise
- Fallback to traditional terminal-only output
- Clear uninstallation process for all components
- No persistent state to migrate or clean up

### Deployment Considerations
- Works immediately in Docker environments (no shared volumes needed)
- Environment variables for configuration (no hardcoded URLs)
- Optional: can be used locally or in distributed setups
- No breaking changes to existing logging infrastructure