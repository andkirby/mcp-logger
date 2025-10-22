# Release Notes

## [0.2.0] - 2025-10-22

### Major New Features

**🐚 Shell Command Logging (MCL-001)**
- New `shell-log.sh` wrapper for capturing shell command output in real-time
- Uses nohup with process substitution for background process capture
- Automatic namespace generation from command names
- Memory-only logging with no disk files required
- Perfect for build processes, API testing, and backend operations

**🖥️ Web Log Viewer Interface (MCL-002)**
- New real-time web interface at `http://localhost:22345`
- Live log streaming with pause/resume functionality
- Dynamic filtering by app, host, namespace, log level, and text search
- Dark/light theme switching with persistence
- Export logs to clipboard
- Mobile-responsive design

**🔧 MCP Protocol Enhancements**
- Added proper MCP tool annotations (readOnlyHint, destructiveHint, etc.)
- Implemented pagination support with offset parameter
- Added character limit (5,000) with helpful truncation messages
- Improved tool descriptions and usage examples
- Better error handling and response formatting

### Improvements

**📝 Documentation & Guides**
- Comprehensive shell logging documentation (`docs/SHELL_LOGGING.md`)
- Updated README with shell logging examples and web interface features
- Better project structure documentation
- Improved troubleshooting guides

**🏗️ File Organization**
- Created `sandbox/` directory for non-tracked development files
- Moved test scripts and documentation to appropriate locations
- Cleaner gitignore and project structure

**🔍 MCP Output Formatting**
- Removed markdown formatting and emojis from MCP responses
- Simplified output for better LLM consumption
- Fixed console.log issues that were breaking MCP stdio protocol
- Cleaner plain text formatting with improved readability

### Bug Fixes

- **MCP Protocol Compliance**: Fixed console.log usage in MCP server that was breaking JSON protocol
- **Backend Integration**: Improved log format handling for shell-generated logs
- **Error Handling**: Better error messages and graceful degradation

### Breaking Changes

None. All changes are backward compatible.

### Migration Notes

No migration required. The upgrade maintains full backward compatibility with existing integrations.

### Getting Started

Quick setup for new features:

```bash
# Shell logging
./shell-log.sh my-app npm run build

# Web viewer (automatically available at http://localhost:22345)
npm run start-backend
open http://localhost:22345

# MCP server with enhanced features
node mcp-server.js mcp-help
```

---

## [0.1.0] - Previous Release

Initial release with core frontend logging, backend server, and MCP integration.