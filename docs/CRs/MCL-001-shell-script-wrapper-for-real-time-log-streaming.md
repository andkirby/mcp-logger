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

# Shell Script Wrapper for Real-time Log Streaming

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

#### Approach A: Named Pipe Integration (Chosen)
**Description**: Shell script writes to named pipe, backend reads pipe and streams to logger
**Pros**: Real-time streaming, minimal latency, preserves output format, simple implementation
**Cons**: Requires pipe management, potential blocking if backend unavailable

#### Approach B: HTTP POST Streaming
**Description**: Script buffers output and sends via HTTP POST requests to existing /api/logs/submit endpoint
**Pros**: Uses existing infrastructure, familiar patterns, reliable delivery
**Cons**: Higher latency, potential request overhead, batching complexity

#### Approach C: WebSocket Connection
**Description**: Script establishes WebSocket connection for bidirectional real-time communication
**Pros**: Real-time bidirectional, connection state management, efficient protocol
**Cons**: Increased complexity, requires WebSocket server implementation, connection overhead

#### Approach D: SSE Client Integration
**Description**: Script acts as SSE client receiving configuration and posting logs via HTTP
**Pros**: Leverages existing SSE patterns, standardized protocol
**Cons**: SSE is server-to-client only, requires separate POST mechanism

### Decision Factors
- Real-time streaming requirements
- Integration complexity with existing infrastructure
- Performance impact on command execution
- Implementation maintainability
- Connection reliability and error handling

### Chosen Approach
Named pipe integration provides the most direct path to real-time streaming with minimal architectural changes. The approach preserves the streaming nature of shell output while leveraging existing log storage and retrieval mechanisms. The backend can read from the pipe and inject logs into the current system without modifying the core logging infrastructure.

### Rejected Alternatives
HTTP POST streaming introduces batching complexity and latency that conflicts with real-time requirements. WebSocket implementation adds unnecessary protocol overhead for unidirectional streaming needs.

## 4. Implementation Specification

### High-Level Architecture
```
Shell Command → log-shell.sh → Named Pipe → Backend Reader → Logger Storage → MCP Client
```

### Component Structure
- **log-shell.sh**: Wrapper script that redirects stdout/stderr to named pipe while preserving terminal output
- **Backend Pipe Reader**: Background process reading from named pipe and forwarding to log storage
- **Configuration Management**: Optional environment variables for pipe location and log namespace
- **Error Handling**: Graceful degradation when pipe unavailable or backend not running

### Integration Points
- Named pipe creation and management in backend server
- New log namespace type: "shell-commands" with command metadata
- Configuration injection for script location and pipe names
- MCP server support for shell command log filtering

### Key Patterns
- Process spawning with tee for dual output (terminal + pipe)
- Non-blocking pipe reads with backpressure handling
- Command metadata injection (command, timestamp, working directory)
- Graceful fallback when logging infrastructure unavailable

### Critical Requirements
- Real-time output streaming without buffering delays
- Preserves existing terminal visibility and behavior
- Minimal performance impact on command execution
- Clean resource cleanup on command completion or interruption

## 5. Acceptance Criteria

### Functional Requirements
- [ ] Shell script wrapper can execute any command and capture output
- [ ] Real-time streaming of stdout/stderr to logging system
- [ ] Output continues to display in terminal as expected
- [ ] Command metadata (command, working directory, timestamp) captured
- [ ] Integration with existing log filtering and retrieval via MCP
- [ ] Proper cleanup of named pipes and background processes

### Non-Functional Requirements
- **Reliability**: [ ] Graceful handling of backend unavailability, [ ] Automatic pipe creation/cleanup, [ ] Resource leak prevention
- **Maintainability**: [ ] Clear script documentation, [ ] Simple configuration mechanism, [ ] Minimal external dependencies
- **Security**: [ ] Input sanitization for command metadata, [ ] Pipe permission management, [ ] No privilege escalation risks
- **Performance**: [ ] Negligible impact on command execution time, [ ] Low memory overhead, [ ] Efficient pipe I/O operations

### Testing Requirements
- **Unit Tests**: Script argument parsing and pipe creation logic
- **Integration Tests**: End-to-end command execution and log verification
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

### For Developers (timeline)
- **Week 1**: Script implementation and basic pipe integration
- **Week 2**: Backend reader process and log namespace integration
- **Week 3**: MCP server updates and filtering capabilities
- **Week 4**: Documentation, testing, and refinement

### Rollback Plan
- Remove script and pipe components without affecting core logging system
- Disable backend pipe reader via configuration flag
- Fallback to traditional terminal-only output if issues arise
- Clear uninstallation process for all components

### Technical Implementation Notes

**Direct Server Communication Options**: Direct TCP/Unix socket connections are possible but add significant complexity for little benefit over named pipes. HTTP requests remain the most practical approach for external integration.

**SSE Streaming Viability**: Server-Sent Events are designed for server-to-client communication, making them unsuitable for shell-to-server data streaming. The chosen named pipe approach provides equivalent real-time streaming with simpler implementation.