/**
 * Browser Logger - Frontend logging with HTTP transmission
 * MVP Implementation - Simple, lightweight, focused on core functionality
 */

(function() {
    'use strict';

    class BrowserLogger {
        constructor() {
            this.config = {
                backendUrl: window.MCP_LOGGING_BACKEND_URL || this.detectBackendUrl(),
                enabled: window.MCP_LOGGING_ENABLED !== false, // Default to enabled
                bufferSize: window.MCP_LOGGING_BUFFER_SIZE || 100,
                batchInterval: window.MCP_LOGGING_BATCH_INTERVAL || 100,
                appName: window.MCP_LOGGING_APP_NAME || 'unknown-app'
            };

            this.logBuffer = [];
            this.batchTimer = null;
            this.host = window.location.host;
            this.app = this.config.appName;
            this.isActive = false;
            this.originalConsole = {};
            this.fallbackBuffer = [];
            this.retryTimer = null;
            this.isBackendAvailable = true;
            this.retryCount = 0;
            this.maxRetries = 3;
            this.retryDelay = 5000; // 5 seconds
            this.isAutoLoaded = this.checkIfAutoLoaded();
        }

        async initialize() {
            if (!this.isEnabled()) {
                this.log_internal('debug', 'BrowserLogger: Logging disabled');
                return;
            }

            if (this.isActive) {
                this.log_internal('debug', 'BrowserLogger: Already active');
                return;
            }

            try {
                // Store original console methods BEFORE intercepting
                this.originalConsole = {
                    log: console.log,
                    error: console.error,
                    warn: console.warn,
                    info: console.info,
                    debug: console.debug
                };

                this.interceptConsole();
                this.captureErrors();
                this.isActive = true;

                this.log_internal('debug', `BrowserLogger: Active for app ${this.app} on host ${this.host}`);
                this.log_internal('debug', `BrowserLogger: Backend URL: ${this.config.backendUrl}`);

                // Register with backend if script was auto-loaded
                if (this.isAutoLoaded) {
                    await this.registerWithBackend();
                }

            } catch (error) {
                this.log_internal('error', 'BrowserLogger: Failed to initialize:', error);
            }
        }

        log_internal(level, ...args) {
            // Use original console methods for internal logger messages to avoid infinite loops
            if (this.originalConsole && this.originalConsole[level]) {
                this.originalConsole[level].apply(console, args);
            } else {
                console[level].apply(console, args);
            }
        }

        interceptConsole() {
            if (!this.isEnabled()) return;

            const methods = ['log', 'error', 'warn', 'info', 'debug'];

            methods.forEach(method => {
                console[method] = (...args) => {
                    // Call original console method first
                    this.originalConsole[method].apply(console, args);
                    // Then capture the log
                    this.addConsoleLog(method, args);
                };
            });
        }

        addConsoleLog(level, args) {
            const logEntry = {
                timestamp: Date.now(),
                level: level.toUpperCase(),
                message: args.map(arg => {
                    if (typeof arg === 'object') {
                        try {
                            return JSON.stringify(arg);
                        } catch {
                            return String(arg);
                        }
                    }
                    return String(arg);
                }).join(' ')
            };

            this.addToBuffer('browser', [logEntry]);
        }

        log(namespace, data) {
            if (!this.isEnabled()) return;

            if (!namespace || typeof namespace !== 'string') {
                this.log_internal('error', 'BrowserLogger: namespace must be a non-empty string');
                return;
            }

            const logEntry = {
                timestamp: Date.now(),
                namespace,
                data
            };

            this.addToBuffer(namespace, logEntry);
        }

        addToBuffer(namespace, data) {
            if (!this.logBuffer) {
                this.logBuffer = [];
            }

            this.logBuffer.push({
                namespace,
                data,
                timestamp: Date.now()
            });

            if (this.logBuffer.length >= this.config.bufferSize) {
                this.flushLogs();
            } else {
                this.scheduleFlush();
            }
        }

        async flushLogs() {
            if (!this.isEnabled() || this.logBuffer.length === 0) return;

            const logsToSend = [...this.logBuffer];
            this.logBuffer = [];

            try {
                const payload = {
                    app: this.app,
                    host: this.host,
                    logs: {}
                };

                logsToSend.forEach(log => {
                    if (!payload.logs[log.namespace]) {
                        payload.logs[log.namespace] = [];
                    }

                    if (Array.isArray(log.data)) {
                        payload.logs[log.namespace].push(...log.data);
                    } else {
                        payload.logs[log.namespace].push(log.data);
                    }
                });

                const response = await fetch(`${this.config.backendUrl}/api/logs/submit`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                // Backend is available again if we were in fallback mode
                if (!this.isBackendAvailable) {
                    this.isBackendAvailable = true;
                    this.retryCount = 0;
                    this.log_internal('debug', 'BrowserLogger: Backend connection restored');

                    // Try to flush any fallback logs
                    if (this.fallbackBuffer.length > 0) {
                        const fallbackLogs = [...this.fallbackBuffer];
                        this.fallbackBuffer = [];
                        this.logBuffer.unshift(...fallbackLogs);
                        this.scheduleFlush();
                    }
                }

                this.log_internal('debug', 'BrowserLogger: Logs sent successfully');

            } catch (error) {
                // Mark backend as unavailable
                this.isBackendAvailable = false;

                // Store in fallback buffer
                this.fallbackBuffer.unshift(...logsToSend);

                // Keep fallback buffer limited
                if (this.fallbackBuffer.length > 500) {
                    this.fallbackBuffer = this.fallbackBuffer.slice(-500);
                }

                this.log_internal('error', 'BrowserLogger: Failed to send logs:', error.message);
                this.log_internal('debug', 'BrowserLogger: Storing logs in fallback buffer');

                // Schedule retry if not already in progress
                if (!this.retryTimer && this.retryCount < this.maxRetries) {
                    this.scheduleRetry();
                }
            }
        }

        scheduleFlush() {
            if (this.batchTimer) return;

            this.batchTimer = setTimeout(() => {
                this.flushLogs();
                this.batchTimer = null;
            }, this.config.batchInterval);
        }

      scheduleRetry() {
            if (this.retryTimer) return;

            this.retryCount++;
            const delay = this.retryDelay * this.retryCount; // Exponential backoff

            this.log_internal('debug', `BrowserLogger: Scheduling retry ${this.retryCount}/${this.maxRetries} in ${delay}ms`);

            this.retryTimer = setTimeout(() => {
                this.retryTimer = null;

                if (this.fallbackBuffer.length > 0) {
                    // Move fallback logs to main buffer
                    const fallbackLogs = [...this.fallbackBuffer];
                    this.fallbackBuffer = [];
                    this.logBuffer.unshift(...fallbackLogs);
                }

                this.flushLogs();
            }, delay);
        }

        captureErrors() {
            window.addEventListener('error', (event) => {
                this.addConsoleLog('error', [
                    `WINDOW ERROR: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`
                ]);
            });

            window.addEventListener('unhandledrejection', (event) => {
                this.addConsoleLog('error', [
                    `UNHANDLED PROMISE REJECTION: ${event.reason}`
                ]);
            });

            const originalFetch = window.fetch;
            const logger = this;
            window.fetch = async function(...args) {
                try {
                    const response = await originalFetch.apply(this, args);
                    if (!response.ok) {
                        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
                        // Don't log fetch errors for logger's own requests to avoid infinite loop
                        if (!url.includes('/api/logs/submit')) {
                            logger.log_internal('error', `FETCH ${response.status} (${response.statusText}) ${url}`);
                        }
                    }
                    return response;
                } catch (error) {
                    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
                    // Don't log fetch errors for logger's own requests to avoid infinite loop
                    if (!url.includes('/api/logs/submit')) {
                        logger.log_internal('error', `FETCH ERROR ${url}: ${error.message}`);
                    }
                    throw error;
                }
            };
        }

        isEnabled() {
            return this.config.enabled === true;
        }

    detectBackendUrl() {
            // Auto-detect backend URL based on current page
            const defaultUrls = [
                'http://localhost:22345',
                `http://${window.location.hostname}:22345`,
                'http://127.0.0.1:22345'
            ];

            // If running on same host as backend, use current hostname
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return defaultUrls[0];
            }

            return defaultUrls[1]; // Use current hostname with default port
        }

        checkIfAutoLoaded() {
            // Check if script was loaded from backend server
            const scripts = document.querySelectorAll('script[src]');
            for (const script of scripts) {
                if (script.src.includes('/mcp-logger.js')) {
                    const scriptUrl = new URL(script.src);
                    const expectedBackend = this.config.backendUrl.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
                    const scriptHost = scriptUrl.hostname + (scriptUrl.port ? ':' + scriptUrl.port : '');

                    return scriptHost === expectedBackend.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
                }
            }
            return false;
        }

        isAutoLoaded() {
            return this.isAutoLoaded;
        }

      async registerWithBackend() {
            try {
                const response = await fetch(`${this.config.backendUrl}/api/logs/submit`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        app: this.app,
                        host: this.host,
                        logs: {
                            'client-registration': {
                                scriptUrl: document.currentScript ? document.currentScript.src : 'unknown',
                                userAgent: navigator.userAgent,
                                timestamp: Date.now(),
                                autoLoaded: true,
                                referrer: document.referrer,
                                appName: this.app
                            }
                        }
                    })
                });

                if (response.ok) {
                    this.log_internal('debug', 'BrowserLogger: Successfully registered with backend');
                } else {
                    this.log_internal('warn', 'BrowserLogger: Failed to register with backend:', response.status);
                }
            } catch (error) {
                this.log_internal('warn', 'BrowserLogger: Registration failed:', error.message);
            }
        }

        destroy() {
            if (this.batchTimer) {
                clearTimeout(this.batchTimer);
            }

            if (this.retryTimer) {
                clearTimeout(this.retryTimer);
            }

            Object.keys(this.originalConsole).forEach(method => {
                console[method] = this.originalConsole[method];
            });

            this.isActive = false;
        }
    }

    const logger = new BrowserLogger();

    if (logger.isEnabled()) {
        logger.initialize();
    }

    window.BrowserLogger = logger;
    window.logger = {
        log: (namespace, data) => logger.log(namespace, data)
    };

})();