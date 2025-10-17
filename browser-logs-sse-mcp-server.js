/**
 * Browser Logs MCP Server - SSE Consumer
 * Simplified implementation - MCP server consuming SSE streams from backend
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { EventSource } = require('eventsource');

class BrowserLogsMCPServer {
    constructor() {
        this.server = new Server({
            name: 'Browser Logs MCP Server (SSE)',
            version: '2.0.0'
        }, {
            capabilities: {
                tools: {}
            }
        });

        // Support custom backend host and port from environment
        const backendHost = process.env.BACKEND_HOST || 'localhost';
        const backendPort = process.env.BACKEND_PORT || process.env.PORT || 22345;
        this.backendUrl = `http://${backendHost}:${backendPort}`;

        this.eventSource = null;
        this.currentLogs = [];
        this.hostStatus = new Map();
        this.defaultApp = process.env.FILTER_APP || null; // Default app from environment
        this.setupTools();
    }

    setupTools() {
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            if (name === 'get_logs') {
                return await this.handleGetLogs(args);
            }

            throw new Error(`Unknown tool: ${name}`);
        });

        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'get_logs',
                        description: 'Retrieve browser console logs and application logs from frontend applications via SSE streaming',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                app: {
                                    type: 'string',
                                    description: `Application name${this.defaultApp ? ` (default: "${this.defaultApp}")` : ' (REQUIRED)'} - e.g., "my-app", "dashboard"`
                                },
                                lines: {
                                    type: 'number',
                                    description: 'Number of log lines to retrieve (1-100, default: 20)',
                                    minimum: 1,
                                    maximum: 100,
                                    default: 20
                                },
                                filter: {
                                    type: 'string',
                                    description: 'Text filter to search log content',
                                    default: ''
                                },
                                frontend_host: {
                                    type: 'string',
                                    description: 'Frontend host to retrieve logs from (e.g., "localhost:3000")',
                                    default: ''
                                },
                                namespace: {
                                    type: 'string',
                                    description: 'Log namespace to retrieve (e.g., "browser", "user-actions")',
                                    default: ''
                                }
                            },
                            required: this.defaultApp ? [] : ['app']
                        }
                    }
                ]
            };
        });
    }

    async handleGetLogs(args = {}) {
        const requestedApp = args.app || this.defaultApp || '';
        const lines = Math.min(args.lines || 20, 100);
        const filter = args.filter || '';
        const requestedHost = args.frontend_host || '';
        const requestedNamespace = args.namespace || '';

        // App is mandatory (unless FILTER_APP is set)
        if (!requestedApp) {
            return this.createErrorResponse('❌ **Missing required parameter: app**\n\nYou must specify the application name.\n\nExample: get_logs(app="my-app")\n\nOr set FILTER_APP environment variable when starting the MCP server.');
        }

        try {
            // Ensure SSE connection is active
            if (!this.eventSource || this.eventSource.readyState === EventSource.CLOSED) {
                await this.connectSSE();
            }

            // Get current status via HTTP for host/namespace selection
            const statusResponse = await fetch(`${this.backendUrl}/api/logs/status`);
            if (!statusResponse.ok) {
                throw new Error(`Backend server not responding: ${statusResponse.status}`);
            }

            const statusData = await statusResponse.json();
            const apps = statusData.apps || [];

            // Find the requested app
            const appData = apps.find(a => a.app === requestedApp);
            if (!appData) {
                const availableApps = apps.map(a => `- ${a.app} (${a.totalLogs} entries)`).join('\n') || 'None';
                return this.createErrorResponse(`❌ **App not found**\n\nApp "${requestedApp}" is not currently connected.\n\nAvailable apps:\n${availableApps}`);
            }

            const hosts = appData.hosts || [];

            const hostSelection = this.selectHost(hosts, requestedHost);
            if (!hostSelection.success) {
                return this.createErrorResponse(hostSelection.message);
            }

            const hostData = hosts.find(h => h.host === hostSelection.host);
            const namespaces = hostData ? hostData.namespaces : [];

            const namespaceSelection = this.selectNamespace(namespaces, requestedNamespace);
            if (!namespaceSelection.success) {
                return this.createErrorResponse(namespaceSelection.message);
            }

            // Connect to SSE stream for real-time logs
            const logData = await this.getLogsViaSSE(
                requestedApp,
                hostSelection.host,
                namespaceSelection.namespace,
                { lines, filter }
            );

            const formattedOutput = this.formatLogs(
                logData,
                requestedApp,
                hostSelection.host,
                namespaceSelection.namespace,
                hostSelection.autoSelected && namespaceSelection.autoSelected
            );

            return this.createSuccessResponse(formattedOutput);

        } catch (error) {
            return this.createErrorResponse(
                `❌ **Error retrieving logs**\n\nError: ${error.message}\n\nMake sure the backend logger server is running on http://localhost:22345`
            );
        }
    }

    async connectSSE() {
        return new Promise((resolve, reject) => {
            try {
                this.eventSource = new EventSource(`${this.backendUrl}/api/logs/stream`);

                this.eventSource.onopen = () => {
                    console.log('🌊 SSE connection established');
                    resolve();
                };

                this.eventSource.onerror = (error) => {
                    console.error('❌ SSE connection error:', error);
                    reject(new Error('Failed to establish SSE connection'));
                };

                this.eventSource.addEventListener('connected', (event) => {
                    console.log('🌊 SSE client connected');
                });

                this.eventSource.addEventListener('new_logs', (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.processNewLogs(data);
                    } catch (error) {
                        console.error('Error processing new logs:', error);
                    }
                });

                this.eventSource.addEventListener('initial_logs', (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.processInitialLogs(data);
                    } catch (error) {
                        console.error('Error processing initial logs:', error);
                    }
                });

                this.eventSource.addEventListener('keepalive', (event) => {
                    // Keep-alive received, connection is stable
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    processNewLogs(data) {
        // Update our internal cache with new logs
        const { app, host, logs } = data;
        const cacheKey = `${app}:${host}`;

        if (!this.hostStatus.has(cacheKey)) {
            this.hostStatus.set(cacheKey, { namespaces: new Map() });
        }

        const hostData = this.hostStatus.get(cacheKey);

        for (const [namespace, logData] of Object.entries(logs)) {
            if (!hostData.namespaces.has(namespace)) {
                hostData.namespaces.set(namespace, []);
            }

            const namespaceLogs = hostData.namespaces.get(namespace);

            if (Array.isArray(logData)) {
                namespaceLogs.push(...logData);
            } else {
                namespaceLogs.push({
                    namespace,
                    data: logData,
                    timestamp: Date.now()
                });
            }

            // Keep only recent logs (last 1000 per namespace)
            if (namespaceLogs.length > 1000) {
                hostData.namespaces.set(namespace, namespaceLogs.slice(-1000));
            }
        }
    }

    processInitialLogs(data) {
        // Process initial log dump from SSE connection
        const { app, host, namespace, logs } = data;
        const cacheKey = `${app}:${host}`;

        if (!this.hostStatus.has(cacheKey)) {
            this.hostStatus.set(cacheKey, { namespaces: new Map() });
        }

        const hostData = this.hostStatus.get(cacheKey);
        hostData.namespaces.set(namespace, logs);

        console.log(`📋 Loaded ${logs.length} initial logs for ${app}@${host}/${namespace}`);
    }

    async getLogsViaSSE(app, host, namespace, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                const cacheKey = `${app}:${host}`;
                // Check if we have cached logs
                if (this.hostStatus.has(cacheKey) && this.hostStatus.get(cacheKey).namespaces.has(namespace)) {
                    let logs = [...this.hostStatus.get(cacheKey).namespaces.get(namespace)];

                    // Apply filter
                    if (options.filter) {
                        const filterLower = options.filter.toLowerCase();
                        logs = logs.filter(log => {
                            if (log.namespace === 'browser') {
                                return log.message.toLowerCase().includes(filterLower);
                            } else {
                                return JSON.stringify(log.data).toLowerCase().includes(filterLower);
                            }
                        });
                    }

                    // Apply lines limit
                    if (logs.length > options.lines) {
                        logs = logs.slice(-options.lines);
                    }

                    resolve({
                        logs,
                        totalEntries: this.hostStatus.get(cacheKey).namespaces.get(namespace).length,
                        options
                    });
                } else {
                    // No cached logs available, fetch via HTTP
                    this.fetchLogsViaHTTP(app, host, namespace, options).then(resolve).catch(reject);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    async fetchLogsViaHTTP(app, host, namespace, options = {}) {
        try {
            const params = new URLSearchParams();
            if (options.lines) params.append('lines', options.lines);
            if (options.filter) params.append('filter', options.filter);

            const response = await fetch(`${this.backendUrl}/api/logs/${encodeURIComponent(app)}/${encodeURIComponent(host)}/${encodeURIComponent(namespace)}?${params}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            throw new Error(`Failed to fetch logs from backend: ${error.message}`);
        }
    }

    selectHost(hosts, requestedHost) {
        if (!requestedHost) {
            if (hosts.length === 0) {
                return {
                    success: false,
                    message: '❌ **No frontend hosts connected**\n\nMake sure frontend applications are running with logging enabled.'
                };
            } else if (hosts.length === 1) {
                return {
                    success: true,
                    host: hosts[0].host,
                    autoSelected: true,
                    message: `Auto-selected host: ${hosts[0].host} (${hosts[0].totalLogs} entries)`
                };
            } else {
                const hostList = hosts.map(h => `- ${h.host} (${h.totalLogs} entries)`).join('\n');
                return {
                    success: false,
                    message: `🔄 **Multiple Hosts Available**\n\nPlease specify frontend_host:\n${hostList}\n\nExample: get_logs(frontend_host="${hosts[0].host}")`
                };
            }
        } else {
            const hostExists = hosts.find(h => h.host === requestedHost);
            if (!hostExists) {
                const availableHosts = hosts.map(h => `- ${h.host} (${h.totalLogs} entries)`).join('\n') || 'None';
                return {
                    success: false,
                    message: `❌ **Host not found**\n\nHost "${requestedHost}" is not currently connected.\n\nAvailable hosts:\n${availableHosts}`
                };
            }
            return {
                success: true,
                host: requestedHost,
                autoSelected: false
            };
        }
    }

    selectNamespace(namespaces, requestedNamespace) {
        if (!requestedNamespace) {
            if (namespaces.length === 0) {
                return {
                    success: false,
                    message: '❌ **No namespaces found** for the selected host'
                };
            } else if (namespaces.length === 1 && namespaces[0].namespace === 'browser') {
                return {
                    success: true,
                    namespace: namespaces[0].namespace,
                    autoSelected: true
                };
            } else {
                const namespaceList = namespaces.map(ns => `- ${ns.namespace} (${ns.count} entries)`).join('\n');
                return {
                    success: false,
                    message: `📂 **Multiple Namespaces Available**\n\nPlease specify namespace:\n${namespaceList}\n\nExample: get_logs(namespace="${namespaces[0].namespace}")`
                };
            }
        } else {
            const namespaceExists = namespaces.find(ns => ns.namespace === requestedNamespace);
            if (!namespaceExists) {
                const availableNamespaces = namespaces.map(ns => `- ${ns.namespace} (${ns.count} entries)`).join('\n') || 'None';
                return {
                    success: false,
                    message: `❌ **Namespace not found**\n\nNamespace "${requestedNamespace}" does not exist.\n\nAvailable namespaces:\n${availableNamespaces}`
                };
            }
            return {
                success: true,
                namespace: requestedNamespace,
                autoSelected: false
            };
        }
    }

    formatLogs(data, app, host, namespace, autoSelected = false) {
        let output = `📋 **Frontend Logs (SSE)** (${data.logs.length} entries`;

        if (data.options && data.options.filter) {
            output += `, filtered by "${data.options.filter}"`;
        }
        output += `)\n\n`;

        output += `**App:** ${app}\n`;
        output += `**Host:** ${host}\n`;
        output += `**Namespace:** ${namespace}\n`;
        output += `**Total Available:** ${data.totalEntries} entries\n`;
        output += `**Connection:** SSE Streaming 🌊\n\n`;

        data.logs.forEach(log => {
            const timestamp = new Date(log.timestamp).toLocaleTimeString();

            if (log.namespace === 'browser') {
                const level = log.level ? log.level.padEnd(5) : 'LOG'.padEnd(5);
                output += `[${timestamp}] ${level} ${log.message}\n`;
            } else {
                output += `[${timestamp}] ${log.namespace.padEnd(15)} ${JSON.stringify(log.data)}\n`;
            }
        });

        if (data.logs.length === 0) {
            output += '_No logs found matching the specified criteria._\n';
        }

        if (autoSelected) {
            output += `\n**Auto-selected** (single host & namespace available for this app)`;
        }

        return output;
    }

    createErrorResponse(message) {
        return {
            content: [
                {
                    type: 'text',
                    text: message
                }
            ]
        };
    }

    createSuccessResponse(text) {
        return {
            content: [
                {
                    type: 'text',
                    text: text
                }
            ]
        };
    }

    async run() {
        console.log('🚀 Browser Logs MCP Server (SSE) starting...');
        console.log('📋 Providing get_logs tool for frontend log access via SSE streaming');

        if (this.defaultApp) {
            console.log(`🎯 Default app filter: ${this.defaultApp}`);
        }

        console.log('🌊 Connecting to SSE stream: http://localhost:22345/api/logs/stream');
        console.log('🔗 Backend status: http://localhost:22345/api/logs/status');

        try {
            // Establish SSE connection
            await this.connectSSE();
            console.log('✅ SSE connection established successfully');
        } catch (error) {
            console.error('⚠️  Warning: Could not establish SSE connection, will fall back to HTTP');
        }

        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Browser Logs MCP Server (SSE) running on stdio');
    }

    shutdown() {
        if (this.eventSource) {
            this.eventSource.close();
            console.log('SSE connection closed');
        }
    }
}

if (require.main === module) {
    // Check for help command
    if (process.argv.includes('mcp-help') || process.argv.includes('--help') || process.argv.includes('-h')) {
        const scriptPath = require('path').resolve(__filename);
        console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                    Browser Logs MCP Server - Setup Guide                  ║
╚════════════════════════════════════════════════════════════════════════════╝

Add this MCP server to Claude Code:

  claude mcp remove FE-logs # remove existing one
  claude mcp add FE-logs node ${scriptPath} --env FILTER_APP=my-app-name --scope local

Comments:
  FE-logs
    MCP server name, can be changed
  --env FILTER_APP=my-app-name
    defines your app name (frontend app shall declare this name) 
  --scope local
    install only for current project

Environment Variables:
  FILTER_APP=app-name    Set default app for get_logs (makes app parameter optional)

Usage in Claude Code:

  Without FILTER_APP:
    get_logs(app="my-app")
    get_logs(app="my-app", filter="error", lines=50)

  With FILTER_APP set:
    get_logs()                                    # Uses default app
    get_logs(app="other-app")                     # Override default
    get_logs(filter="error", lines=50)            # Uses default app

Backend Requirements:
  - Backend server must be running: npm run start-backend
  - Backend URL: http://localhost:22345

More Information:
  - README: See README.md in this directory
  - Configuration: See CLAUDE.md for detailed setup
`);
        process.exit(0);
    }

    const server = new BrowserLogsMCPServer();

    // Handle shutdown gracefully
    process.on('SIGTERM', () => {
        console.log('Shutting down Browser Logs MCP Server...');
        server.shutdown();
        process.exit(0);
    });

    process.on('SIGINT', () => {
        console.log('Shutting down Browser Logs MCP Server...');
        server.shutdown();
        process.exit(0);
    });

    server.run().catch(console.error);
}

module.exports = BrowserLogsMCPServer;