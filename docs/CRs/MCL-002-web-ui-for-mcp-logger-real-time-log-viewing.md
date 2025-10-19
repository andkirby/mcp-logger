---
code: MCL-002
title: Web UI Architecture for Real-time Log Viewing
status: Proposed
dateCreated: 2025-10-18T23:42:47.227Z
type: Architecture
priority: High
phaseEpic: User Interface Enhancement
assignee: Development Team
---

# Web UI Architecture for Real-time Log Viewing

## 1. Description

**Problem Statement**: The MCP Logger system provides comprehensive backend APIs but lacks a user-friendly web interface for real-time log monitoring. Users must rely on command-line tools or custom scripts to access log data, creating friction in development workflows.

**Current State**: Backend server with REST APIs and SSE streaming endpoints, CLI access through MCP tools, no web-based log viewing capability.

**Desired State**:
- Web interface accessible at root URL (http://localhost:22345/)
- Real-time log streaming with auto-scroll and pause capabilities
- Dynamic filtering by app, host, namespace, log level, and text search
- Theme switching (dark/light) with system preference detection
- Mobile-responsive design for cross-device compatibility

**Impact Areas**:
- MCP Logger backend server (route addition)
- User experience and developer workflows
- Cross-team collaboration and debugging efficiency

## 2. Decision Rationale

**Why This Change is Necessary**:
- Developer Experience: CLI-based log access requires technical knowledge and creates debugging friction
- Real-time Monitoring: Teams need immediate visibility into application behavior during development
- Collaboration: Shared web interface enables better team coordination and knowledge transfer
- Professional Standards: Modern logging solutions require polished UI components

**What It Accomplishes**:
- Reduces time-to-insight for debugging issues through real-time visualization
- Lowers barrier to entry for new developers accessing log data
- Enables pair programming and collaborative debugging sessions
- Provides export capabilities for incident documentation

**Alignment with Project Goals**:
- Enhances MCP Logger's position as a comprehensive logging solution
- Supports developer-friendly tooling objectives
- Enables real-time debugging capabilities for modern workflows

## 3. Solution Analysis

#### Approach A: Embedded HTML Integration (Chosen)
**Description**: Embed complete web interface as HTML string in backend server with integrated CSS/JavaScript
**Pros**:
- Zero additional dependencies or build processes
- Seamless integration with existing backend
- Immediate deployment and version control
- Low maintenance overhead
**Cons**: HTML content embedded in JavaScript code

#### Approach B: Static File Serving
**Description**: Serve separate HTML/CSS/JS files from backend's static file system
**Pros**: Clean separation of concerns, better development tooling
**Cons**: Additional file management complexity, build process requirements

#### Approach C: Front-end Framework Application
**Description**: Separate React/Vue application with build process and API integration
**Pros**: Professional development experience, component-based architecture
**Cons**: Significant complexity increase, over-engineering for requirements

**Decision Factors**:
- Development speed and immediate value delivery
- Maintenance overhead and long-term sustainability
- Integration simplicity with existing infrastructure
- Deployment and operational complexity

**Chosen Approach**: The embedded HTML integration provides the best balance of immediate value, low maintenance, and seamless integration with the existing MCP Logger backend. This approach eliminates additional build processes, reduces deployment complexity, and ensures the web interface is always available when the backend server is running.

## 4. Implementation Specification

**Architecture Overview**:
- **Backend Integration**: Add root route handler (GET /) to existing logger-server.js
- **Frontend Architecture**: Single-page application with vanilla JavaScript
- **Real-time Communication**: Server-Sent Events (SSE) for log streaming
- **State Management**: Client-side in-memory log storage with configurable limits
- **Styling**: CSS custom properties for theme switching and modern design

**Component Structure**:
- **LogViewer Class**: Main application controller with state management
- **API Integration**: Fetch-based communication with existing endpoints
- **Real-time Updates**: EventSource integration for SSE streaming
- **Filter Engine**: Client-side log filtering and search functionality
- **UI Components**: Responsive layout with modern CSS Grid and Flexbox

**Integration Points**:
- Status API: GET /api/logs/status for app/host/namespace population
- Log Retrieval: GET /api/logs/:app/:host/:namespace for historical data
- Streaming API: GET /api/logs/stream for real-time log updates
- CORS Headers: Leverage existing CORS configuration

## 5. Acceptance Criteria

**Functional**:
- [ ] Web interface accessible at http://localhost:22345/
- [ ] Real-time log streaming via SSE with auto-scroll capability
- [ ] Dynamic filtering by app, host, namespace, log level, and text search
- [ ] Theme switching between dark and light modes with persistence
- [ ] Export functionality to copy filtered logs to clipboard
- [ ] Pause/resume streaming with visual indicators
- [ ] Mobile-responsive design for phone and tablet viewing
- [ ] Connection status indicator with real-time updates

**Non-Functional**:
- **Reliability**:
  - [ ] Graceful handling of SSE connection interruptions
  - [ ] Automatic reconnection with exponential backoff
  - [ ] Error state handling with user-friendly messages
- **Maintainability**:
  - [ ] Clean separation of CSS, HTML, and JavaScript within file structure
  - [ ] Consistent code formatting and commenting standards
  - [ ] Semantic HTML structure for accessibility
- **Performance**:
  - [ ] Maximum 1000 logs stored in client memory
  - [ ] Sub-100ms response times for filter operations
  - [ ] Efficient DOM updates for real-time streaming
- **Security**:
  - [ ] Input sanitization for search and filter functionality
  - [ ] Safe clipboard API usage with user permission

**Testing**:
- **Unit Tests**: JavaScript functions for filtering, formatting, and state management
- **Integration Tests**: End-to-end testing of log streaming and API integration
- **Manual Testing**: User workflow verification across different devices and browsers

## 6. Success Metrics

**Qualitative Improvements**:
- Improved developer experience through intuitive log monitoring
- Reduced learning curve for new team members accessing log data
- Enhanced collaboration capabilities for debugging sessions
- Professional interface suitable for production environments

**Developer Experience**:
- Reduced setup complexity from CLI commands to single URL access
- Immediate visibility into application behavior without additional tools
- Mobile accessibility for on-call debugging scenarios
- Export capabilities for incident documentation and analysis

## 7. Deployment Strategy

**Simple Changes**:
- Add root route handler to existing logger-server.js
- No configuration changes required
- Server restart needed to load new route

**Rollback Plan**:
- Comment out root route handler to disable web interface
- Previous CLI access methods remain fully functional
- No breaking changes to existing API endpoints
- Immediate rollback with single line code change