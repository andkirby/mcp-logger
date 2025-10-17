/**
 * Browser Logger Backend Server
 * MVP Implementation - Simple HTTP server with in-memory log storage
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');

class LogStorage {
    constructor(maxEntries = parseInt(process.env.MAX_LOG_ENTRIES) || 500) {
        this.maxEntries = maxEntries;
        this.apps = new Map(); // app -> hosts -> namespaces
    }

    addLogs(app, host, logs) {
        if (!this.apps.has(app)) {
            this.apps.set(app, {
                hosts: new Map(),
                appInfo: {
                    connectedAt: Date.now(),
                    lastActivity: Date.now()
                }
            });
        }

        const appData = this.apps.get(app);
        appData.appInfo.lastActivity = Date.now();

        if (!appData.hosts.has(host)) {
            appData.hosts.set(host, {
                namespaces: new Map(),
                hostInfo: {
                    connectedAt: Date.now(),
                    lastActivity: Date.now()
                }
            });
        }

        const hostData = appData.hosts.get(host);
        hostData.hostInfo.lastActivity = Date.now();

        for (const [namespace, data] of Object.entries(logs)) {
            if (!hostData.namespaces.has(namespace)) {
                hostData.namespaces.set(namespace, {
                    logs: [],
                    lastActivity: Date.now()
                });
            }

            const namespaceData = hostData.namespaces.get(namespace);

            if (namespace === 'browser' && Array.isArray(data)) {
                const formattedLogs = data.map(log => ({
                    ...log,
                    namespace,
                    app,
                    host,
                    timestamp: log.timestamp || Date.now()
                }));
                namespaceData.logs.push(...formattedLogs);
            } else {
                namespaceData.logs.push({
                    namespace,
                    app,
                    host,
                    data,
                    timestamp: Date.now()
                });
            }

            namespaceData.lastActivity = Date.now();

            if (namespaceData.logs.length > this.maxEntries) {
                namespaceData.logs = namespaceData.logs.slice(-this.maxEntries);
            }
        }
    }

    getLogs(app, host, namespace, options = {}) {
        if (!this.apps.has(app)) {
            return { logs: [], totalEntries: 0 };
        }

        const appData = this.apps.get(app);

        if (!appData.hosts.has(host)) {
            return { logs: [], totalEntries: 0 };
        }

        const hostData = appData.hosts.get(host);

        if (!hostData.namespaces.has(namespace)) {
            return { logs: [], totalEntries: 0 };
        }

        const namespaceData = hostData.namespaces.get(namespace);
        let logs = [...namespaceData.logs];

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

        const lines = options.lines || 20;
        if (logs.length > lines) {
            logs = logs.slice(-lines);
        }

        return { logs, totalEntries: namespaceData.logs.length };
    }

    getNamespaces(app, host) {
        if (!this.apps.has(app)) {
            return [];
        }

        const appData = this.apps.get(app);

        if (!appData.hosts.has(host)) {
            return [];
        }

        const hostData = appData.hosts.get(host);
        return Array.from(hostData.namespaces.keys()).map(namespace => ({
            namespace,
            count: hostData.namespaces.get(namespace).logs.length,
            lastActivity: hostData.namespaces.get(namespace).lastActivity
        }));
    }

    getHosts(app) {
        if (!this.apps.has(app)) {
            return [];
        }

        const appData = this.apps.get(app);
        return Array.from(appData.hosts.keys()).map(host => {
            const hostData = appData.hosts.get(host);
            const namespaces = this.getNamespaces(app, host);
            const totalLogs = namespaces.reduce((sum, ns) => sum + ns.count, 0);

            return {
                host,
                namespaces,
                totalLogs,
                lastActivity: Math.max(...namespaces.map(ns => ns.lastActivity)),
                connectedAt: hostData.hostInfo.connectedAt
            };
        });
    }

    getApps() {
        return Array.from(this.apps.keys()).map(app => {
            const appData = this.apps.get(app);
            const hosts = this.getHosts(app);
            const totalLogs = hosts.reduce((sum, host) => sum + host.totalLogs, 0);

            return {
                app,
                hosts,
                totalLogs,
                lastActivity: appData.appInfo.lastActivity,
                connectedAt: appData.appInfo.connectedAt
            };
        });
    }
}

class LoggerServer {
    constructor(port = 22345, host = 'localhost') {
        this.port = port;
        this.host = host;
        this.app = express();
        this.storage = new LogStorage();
        this.rateLimiter = new Map();
        this.sseClients = new Set(); // Track active SSE connections
        this.duplicateFilter = new Map(); // Filter duplicate logs
        this.logBuffer = new Map(); // Buffer for batching logs
    }

    start() {
        this.setupMiddleware();
        this.setupRoutes();

        this.server = this.app.listen(this.port, this.host, () => {
            const serverUrl = `http://${this.host}:${this.port}`;
            console.log(`🚀 Browser Logger Server running on ${serverUrl}`);
            console.log(`📊 Log submission: POST ${serverUrl}/api/logs/submit`);
            console.log(`📋 Status endpoint: GET ${serverUrl}/api/logs/status`);
            console.log(`❤️  Health check: GET ${serverUrl}/api/health`);
            console.log(`📜 Auto-loading script: GET ${serverUrl}/mcp-logger.js`);
            console.log(`🌊 SSE streaming: GET ${serverUrl}/api/logs/stream`);
            console.log(`🔄 Auto-reload enabled - running with nodemon`);
        });

        // Nodemon handles auto-reload, no need for custom file watching

        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
    }

    setupMiddleware() {
        // CORS middleware - must be before rate limiting
        this.app.use((req, res, next) => {
            const origin = req.headers.origin;

            // Allow all origins for development
            res.setHeader('Access-Control-Allow-Origin', origin || '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
            res.setHeader('Access-Control-Allow-Credentials', 'true');

            // Handle preflight requests
            if (req.method === 'OPTIONS') {
                res.status(200).end();
                return;
            }

            next();
        });

        this.app.use(express.json({ limit: '1mb' }));
        this.app.use((req, res, next) => this.applyRateLimit(req, res, next));
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        this.app.post('/api/logs/submit', (req, res) => this.handleLogSubmission(req, res));
        this.app.get('/api/logs/status', (req, res) => this.handleStatusRequest(req, res));
        this.app.get('/api/logs/:app/:host/:namespace', (req, res) => this.handleLogRetrieval(req, res));
        this.app.get('/api/health', (req, res) => this.handleHealthCheck(req, res));
        this.app.get('/mcp-logger.js', (req, res) => this.handleScriptServing(req, res));
        this.app.get('/api/logs/stream', (req, res) => this.handleSSEStream(req, res));
        this.app.use('*', (req, res) => {
            res.status(404).json({ error: 'Endpoint not found' });
        });
    }

    handleLogSubmission(req, res) {
        try {
            const { app, host, logs } = req.body;

            if (!app || !host || !logs) {
                return res.status(400).json({
                    error: 'Missing required fields: app, host, logs'
                });
            }

            if (typeof logs !== 'object' || Array.isArray(logs)) {
                return res.status(400).json({
                    error: 'logs must be an object with namespace keys'
                });
            }

            // Filter and batch logs to prevent spam
            const filteredLogs = this.filterAndBatchLogs(app, host, logs);

            if (Object.keys(filteredLogs).length === 0) {
                return res.json({
                    status: 'skipped',
                    reason: 'All logs filtered as duplicates or spam',
                    app,
                    host,
                    timestamp: Date.now()
                });
            }

            this.storage.addLogs(app, host, filteredLogs);

            const totalStored = Object.values(filteredLogs).reduce((sum, logData) => {
                return sum + (Array.isArray(logData) ? logData.length : 1);
            }, 0);
            const originalTotal = Object.values(logs).reduce((sum, logData) => {
                return sum + (Array.isArray(logData) ? logData.length : 1);
            }, 0);

            res.json({
                status: 'success',
                stored: totalStored,
                filtered: originalTotal - totalStored,
                app,
                host,
                timestamp: Date.now()
            });

            if (totalStored > 0) {
                // Build namespace info
                const namespaceInfo = Object.keys(filteredLogs).map(ns => {
                    const count = Array.isArray(filteredLogs[ns]) ? filteredLogs[ns].length : 1;
                    return `${ns}:${count}`;
                }).join(', ');

                console.log(`📝 Received ${totalStored} log entries from ${app}@${host} [${namespaceInfo}]${originalTotal > totalStored ? ` (${originalTotal - totalStored} filtered)` : ''}`);
            }

            // Notify SSE clients about new logs
            this.notifySSEClients(host, filteredLogs);

        } catch (error) {
            console.error('Error processing log submission:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }

    handleStatusRequest(req, res) {
        try {
            const apps = this.storage.getApps();
            const totalLogs = apps.reduce((sum, app) => sum + app.totalLogs, 0);

            res.json({
                apps: apps.map(a => ({
                    app: a.app,
                    totalLogs: a.totalLogs,
                    hosts: a.hosts.map(h => ({
                        host: h.host,
                        totalLogs: h.totalLogs,
                        namespaces: h.namespaces.map(ns => ({
                            namespace: ns.namespace,
                            count: ns.count
                        })),
                        lastActivity: h.lastActivity,
                        connectedAt: h.connectedAt
                    })),
                    lastActivity: a.lastActivity,
                    connectedAt: a.connectedAt
                })),
                totalLogs,
                serverTime: Date.now(),
                uptime: process.uptime()
            });

        } catch (error) {
            console.error('Error retrieving status:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }

    handleLogRetrieval(req, res) {
        try {
            const { app, host, namespace } = req.params;
            const { lines, filter } = req.query;

            if (!app || !host || !namespace) {
                return res.status(400).json({
                    error: 'Missing required parameters: app, host, namespace'
                });
            }

            const options = {
                lines: lines ? Math.min(parseInt(lines), 100) : 20,
                filter: filter || ''
            };

            const result = this.storage.getLogs(app, host, namespace, options);

            res.json({
                app,
                host,
                namespace,
                logs: result.logs,
                totalEntries: result.totalEntries,
                filtered: result.logs.length,
                options,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('Error retrieving logs:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }

    handleHealthCheck(req, res) {
        res.json({
            status: 'ok',
            timestamp: Date.now(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            activeApps: this.storage.getApps().length
        });
    }

    handleScriptServing(req, res) {
        try {
            const scriptPath = path.join(__dirname, 'mcp-logger.js');

            if (!fs.existsSync(scriptPath)) {
                return res.status(404).json({ error: 'Logger script not found' });
            }

            // Read the script file
            const scriptContent = fs.readFileSync(scriptPath, 'utf8');

            // Add auto-configuration injection at the top
            const modifiedScript = this.addAutoConfiguration(scriptContent, req);

            // Set appropriate headers for JavaScript file
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            res.send(modifiedScript);

            // Extract client info from referer or origin header
            const referer = req.headers.referer || req.headers.origin || 'unknown';
            let clientInfo = req.ip;

            if (referer !== 'unknown') {
                try {
                    const url = new URL(referer);
                    clientInfo = url.host; // hostname:port
                } catch {
                    clientInfo = referer;
                }
            }

            console.log(`🎯 Served mcp-logger.js to client: ${clientInfo}`);

        } catch (error) {
            console.error('Error serving logger script:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }

    addAutoConfiguration(scriptContent, req) {
        const protocol = req.protocol;
        const host = req.get('host');
        const backendUrl = `${protocol}://${host}`;

        // Auto-configuration injection
        const autoConfig = `
// Auto-configuration from backend server
(function() {
    if (typeof window !== 'undefined') {
        // Only set if not already configured
        if (!window.MCP_LOGGING_BACKEND_URL) {
            window.MCP_LOGGING_BACKEND_URL = '${backendUrl}';
            console.debug('BrowserLogger: Auto-configured backend URL:', '${backendUrl}');
        }

        // Auto-enable if not explicitly set
        if (window.MCP_LOGGING_ENABLED === undefined) {
            window.MCP_LOGGING_ENABLED = true;
            console.debug('BrowserLogger: Auto-enabled logging');
        }
    }
})();
`;

        return autoConfig + '\n' + scriptContent;
    }

    handleSSEStream(req, res) {
        try {
            const { lines, filter, app, frontend_host, namespace } = req.query;

            // Set SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });

            console.log(`🌊 SSE client connected from ${req.ip}`);

            // Send initial connection event
            res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now(), message: 'Connected to log stream' })}\n\n`);

            // Add client to tracking set
            this.sseClients.add(res);

            // Handle client disconnection
            req.on('close', () => {
                this.sseClients.delete(res);
                console.log(`🌊 SSE client disconnected from ${req.ip}`);
            });

            // Send initial logs if parameters provided
            if (app && frontend_host && namespace) {
                const options = {
                    lines: lines ? Math.min(parseInt(lines), 100) : 20,
                    filter: filter || ''
                };

                const result = this.storage.getLogs(app, frontend_host, namespace, options);

                res.write(`event: initial_logs\ndata: ${JSON.stringify({
                    app,
                    host: frontend_host,
                    namespace,
                    logs: result.logs,
                    totalEntries: result.totalEntries,
                    options,
                    timestamp: Date.now()
                })}\n\n`);
            }

            // Send periodic keep-alive messages
            const keepAliveInterval = setInterval(() => {
                if (this.sseClients.has(res)) {
                    res.write(`event: keepalive\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
                } else {
                    clearInterval(keepAliveInterval);
                }
            }, 30000); // Every 30 seconds

        } catch (error) {
            console.error('Error setting up SSE stream:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Internal server error',
                    message: error.message
                });
            }
        }
    }

    notifySSEClients(host, logs) {
        if (this.sseClients.size === 0) return;

        const eventData = {
            host,
            logs,
            timestamp: Date.now()
        };

        this.sseClients.forEach(client => {
            try {
                client.write(`event: new_logs\ndata: ${JSON.stringify(eventData)}\n\n`);
            } catch (error) {
                // Client disconnected, remove from tracking
                this.sseClients.delete(client);
            }
        });
    }

    applyRateLimit(req, res, next) {
        const clientIp = req.ip || req.connection.remoteAddress;
        const now = Date.now();

        // Development-friendly rate limiting for localhost
        const isLocalhost = clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.startsWith('::ffff:127');
        const windowMs = isLocalhost ? 10000 : 60000; // 10 seconds for localhost, 1 minute for others
        const maxRequests = isLocalhost ? 200 : 1000; // 200 requests for localhost (development), 1000 for others

        if (!this.rateLimiter.has(clientIp)) {
            this.rateLimiter.set(clientIp, {
                count: 0,
                resetTime: now + windowMs,
                lastWarning: 0
            });
        }

        const clientData = this.rateLimiter.get(clientIp);

        if (now > clientData.resetTime) {
            clientData.count = 0;
            clientData.resetTime = now + windowMs;
        }

        clientData.count++;

        // Log warnings for high-frequency requests from localhost
        if (isLocalhost && clientData.count > 150 && now - clientData.lastWarning > 5000) {
            console.warn(`⚠️  High frequency log requests from localhost: ${clientData.count} requests in ${windowMs/1000}s`);
            clientData.lastWarning = now;
        }

        if (clientData.count > maxRequests) {
            if (isLocalhost) {
                console.warn(`🚫 Rate limiting localhost: ${clientData.count} > ${maxRequests} requests`);
            }
            return res.status(429).json({
                error: 'Too many requests',
                retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
                requestCount: clientData.count,
                limit: maxRequests
            });
        }

        next();
    }

  filterAndBatchLogs(app, host, logs) {
        const filteredLogs = {};
        const now = Date.now();

        for (const [namespace, data] of Object.entries(logs)) {
            if (namespace === 'browser' && Array.isArray(data)) {
                const filteredEntries = data.filter(log => {
                    // Create a unique key for duplicate detection
                    const logKey = `${log.level || 'info'}:${log.message || ''}:${log.source || ''}`;
                    const key = `${app}:${host}:${namespace}:${logKey}`;

                    // Check if this is a duplicate log within the last 5 seconds
                    if (this.duplicateFilter.has(key)) {
                        const lastSeen = this.duplicateFilter.get(key);
                        if (now - lastSeen < 5000) {
                            return false; // Filter out duplicate
                        }
                    }

                    // Mark this log as seen
                    this.duplicateFilter.set(key, now);

                    // Clean up old entries from duplicate filter
                    if (this.duplicateFilter.size > 1000) {
                        for (const [k, timestamp] of this.duplicateFilter.entries()) {
                            if (now - timestamp > 30000) { // Remove entries older than 30 seconds
                                this.duplicateFilter.delete(k);
                            }
                        }
                    }

                    return true;
                });

                if (filteredEntries.length > 0) {
                    filteredLogs[namespace] = filteredEntries;
                }
            } else {
                // For non-browser logs, just check for exact duplicates
                const key = `${app}:${host}:${namespace}:${JSON.stringify(data)}`;
                if (!this.duplicateFilter.has(key) || now - this.duplicateFilter.get(key) > 5000) {
                    this.duplicateFilter.set(key, now);
                    filteredLogs[namespace] = data;
                }
            }
        }

        return filteredLogs;
    }

  
    shutdown() {
        console.log('Shutting down browser logger server...');
        if (this.server) {
            this.server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        }
    }
}

if (require.main === module) {
    const port = parseInt(process.env.PORT) || 22345;
    const host = process.env.HOST || 'localhost';
    const server = new LoggerServer(port, host);
    server.start();
}

module.exports = LoggerServer;