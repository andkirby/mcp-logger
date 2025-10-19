class LogViewer {
    constructor() {
        this.logs = [];
        this.filteredLogs = [];
        this.isConnected = false;
        this.isPaused = false;
        this.autoScroll = true;
        this.logRateBuffer = [];
        this.eventSource = null;

        this.initializeElements();
        this.attachEventListeners();
        this.loadInitialData();
        this.startStatsUpdater();
    }

    initializeElements() {
        this.elements = {
            sourceSelect: document.getElementById('sourceSelect'),
            filterInput: document.getElementById('filterInput'),
            levelFilter: document.getElementById('levelFilter'),
            logDisplay: document.getElementById('logDisplay'),
            connectionStatus: document.getElementById('connectionStatus'),
            statusText: document.getElementById('statusText'),
            logCount: document.getElementById('logCount'),
            logRate: document.getElementById('logRate'),
            totalLogs: document.getElementById('totalLogs'),
            lastUpdate: document.getElementById('lastUpdate'),
            themeToggle: document.getElementById('themeToggle'),
            clearLogs: document.getElementById('clearLogs'),
            exportLogs: document.getElementById('exportLogs'),
            pauseStreaming: document.getElementById('pauseStreaming'),
            autoScrollIndicator: document.getElementById('autoScrollIndicator')
        };
    }

    attachEventListeners() {
        this.elements.sourceSelect.addEventListener('change', () => this.onSourceChange());
        this.elements.filterInput.addEventListener('input', () => this.applyFilters());
        this.elements.levelFilter.addEventListener('change', () => this.applyFilters());
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.elements.clearLogs.addEventListener('click', () => this.clearLogs());
        this.elements.exportLogs.addEventListener('click', () => this.exportLogs());
        this.elements.pauseStreaming.addEventListener('click', () => this.togglePause());

        // Auto-scroll detection
        this.elements.logDisplay.addEventListener('scroll', () => {
            const isAtBottom = this.elements.logDisplay.scrollTop + this.elements.logDisplay.clientHeight >=
                             this.elements.logDisplay.scrollHeight - 10;
            this.autoScroll = isAtBottom;
            this.updateAutoScrollIndicator();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'k':
                        e.preventDefault();
                        this.elements.filterInput.focus();
                        break;
                    case 'e':
                        e.preventDefault();
                        this.exportLogs();
                        break;
                    case ' ':
                        e.preventDefault();
                        this.togglePause();
                        break;
                }
            }
        });
    }

    async loadInitialData() {
        try {
            const response = await fetch('/api/logs/status');
            const data = await response.json();
            this.populateSourceSelect(data.apps);
        } catch (error) {
            this.showError('Failed to load applications: ' + error.message);
        }
    }

    populateSourceSelect(apps) {
        this.elements.sourceSelect.innerHTML = '<option value="">Select a source...</option>';

        apps.forEach(app => {
            app.hosts.forEach(host => {
                host.namespaces.forEach(ns => {
                    const option = document.createElement('option');
                    // Store data as JSON in value: app|host|namespace
                    option.value = JSON.stringify({
                        app: app.app,
                        host: host.host,
                        namespace: ns.namespace
                    });

                    // Display format: app@host:namespace (count logs)
                    option.textContent = `${app.app}@${host.host}:${ns.namespace} (${ns.count} logs)`;
                    this.elements.sourceSelect.appendChild(option);
                });
            });
        });
    }

    onSourceChange() {
        const selectedValue = this.elements.sourceSelect.value;

        if (selectedValue) {
            try {
                const source = JSON.parse(selectedValue);
                this.connectStream(source.app, source.host, source.namespace);
                this.loadHistoricalLogs(source.app, source.host, source.namespace);
            } catch (error) {
                this.showError('Invalid source selection: ' + error.message);
            }
        } else {
            this.disconnectStream();
        }
    }

    async loadHistoricalLogs(app, host, namespace) {
        try {
            const response = await fetch(`/api/logs/${app}/${host}/${namespace}?lines=50`);
            const data = await response.json();
            this.logs = data.logs.reverse(); // Show newest first
            this.applyFilters();
            this.updateStats();
        } catch (error) {
            this.showError('Failed to load historical logs: ' + error.message);
        }
    }

    connectStream(app, host, namespace) {
        this.disconnectStream();

        const url = `/api/logs/stream?app=${app}&frontend_host=${host}&namespace=${namespace}`;
        this.eventSource = new EventSource(url);

        this.eventSource.onopen = () => {
            this.isConnected = true;
            this.updateConnectionStatus(true);
        };

        this.eventSource.onmessage = (event) => {
            if (this.isPaused) return;

            try {
                const data = JSON.parse(event.data);
                this.handleNewLogs(data);
            } catch (error) {
                console.error('Failed to parse SSE message:', error);
            }
        };

        this.eventSource.onerror = () => {
            this.isConnected = false;
            this.updateConnectionStatus(false);
        };

        this.eventSource.addEventListener('new_logs', (event) => {
            if (this.isPaused) return;

            try {
                const data = JSON.parse(event.data);
                const selectedSource = JSON.parse(this.elements.sourceSelect.value);
                if (data.logs && data.logs[selectedSource.namespace]) {
                    const newLogs = data.logs[selectedSource.namespace];
                    if (Array.isArray(newLogs)) {
                        newLogs.forEach(log => this.addLog(log));
                    } else {
                        this.addLog(newLogs);
                    }
                }
            } catch (error) {
                console.error('Failed to parse new_logs event:', error);
            }
        });
    }

    disconnectStream() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.isConnected = false;
        this.updateConnectionStatus(false);
    }

    addLog(log) {
        this.logs.unshift(log); // Add to beginning
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(0, 1000); // Keep only last 1000
        }
        this.logRateBuffer.push(Date.now());
        this.applyFilters();
    }

    handleNewLogs(data) {
        // Handle initial logs from SSE connection
        if (data.logs && Array.isArray(data.logs)) {
            data.logs.forEach(log => this.addLog(log));
        }
    }

    applyFilters() {
        const filterText = this.elements.filterInput.value.toLowerCase();
        const levelFilter = this.elements.levelFilter.value;

        this.filteredLogs = this.logs.filter(log => {
            let matchesFilter = true;
            let matchesLevel = true;

            if (filterText) {
                matchesFilter = false;
                if (log.namespace === 'browser') {
                    matchesFilter = log.message.toLowerCase().includes(filterText);
                } else {
                    matchesFilter = JSON.stringify(log.data).toLowerCase().includes(filterText);
                }
            }

            if (levelFilter && log.level) {
                matchesLevel = log.level.toLowerCase() === levelFilter.toLowerCase();
            }

            return matchesFilter && matchesLevel;
        });

        this.renderLogs();
        this.updateStats();
    }

    renderLogs() {
        if (this.filteredLogs.length === 0) {
            this.elements.logDisplay.innerHTML = `
                <div class="empty-state">
                    <h2>No logs to display</h2>
                    <p>Try adjusting your filters or check if logs are being generated</p>
                </div>
            `;
            return;
        }

        const logHTML = this.filteredLogs.map(log => this.formatLog(log)).join('');
        this.elements.logDisplay.innerHTML = logHTML;

        if (this.autoScroll) {
            this.elements.logDisplay.scrollTop = 0;
        }
    }

    formatLog(log) {
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        const level = log.level || 'info';
        const namespace = log.namespace || 'unknown';
        let message = '';
        let dataHTML = '';

        if (namespace === 'browser') {
            message = log.message || '';
        } else {
            message = `Application log: ${namespace}`;
            dataHTML = `<div class="log-data">${JSON.stringify(log.data, null, 2)}</div>`;
        }

        return `
            <div class="log-entry">
                <div class="log-timestamp">${timestamp}</div>
                <div class="log-level">${level}</div>
                <div class="log-namespace">[${namespace}]</div>
                <div class="log-message">${message}</div>
                ${dataHTML}
            </div>
        `;
    }

    updateConnectionStatus(connected) {
        const indicator = this.elements.connectionStatus;
        const text = this.elements.statusText;

        if (connected) {
            indicator.classList.add('connected');
            text.textContent = 'Connected';
        } else {
            indicator.classList.remove('connected');
            text.textContent = 'Disconnected';
        }
    }

    updateStats() {
        this.elements.logCount.textContent = `${this.filteredLogs.length} logs`;
        this.elements.totalLogs.textContent = `${this.logs.length} total`;
        this.elements.lastUpdate.textContent = new Date().toLocaleTimeString();
    }

    startStatsUpdater() {
        setInterval(() => {
            const now = Date.now();
            this.logRateBuffer = this.logRateBuffer.filter(time => now - time < 1000);
            const rate = this.logRateBuffer.length;
            this.elements.logRate.textContent = `${rate.toFixed(1)}/s`;
        }, 1000);
    }

    updateAutoScrollIndicator() {
        const indicator = this.elements.autoScrollIndicator;
        if (this.autoScroll) {
            indicator.classList.add('visible');
        } else {
            indicator.classList.remove('visible');
        }
    }

    toggleTheme() {
        const body = document.body;
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        body.setAttribute('data-theme', newTheme);
        this.elements.themeToggle.textContent = newTheme === 'dark' ? '🌙' : '☀️';
        localStorage.setItem('theme', newTheme);
    }

    clearLogs() {
        this.logs = [];
        this.filteredLogs = [];
        this.renderLogs();
        this.updateStats();
    }

    exportLogs() {
        const exportData = this.filteredLogs.map(log => {
            const timestamp = new Date(log.timestamp).toISOString();
            const level = log.level || 'info';
            const namespace = log.namespace || 'unknown';
            let message = '';

            if (namespace === 'browser') {
                message = log.message || '';
            } else {
                message = JSON.stringify(log.data);
            }

            return `[${timestamp}] [${level}] [${namespace}] ${message}`;
        }).join('\n');

        navigator.clipboard.writeText(exportData).then(() => {
            const originalText = this.elements.exportLogs.textContent;
            this.elements.exportLogs.textContent = '✅ Copied!';
            setTimeout(() => {
                this.elements.exportLogs.textContent = originalText;
            }, 2000);
        }).catch(error => {
            this.showError('Failed to copy logs: ' + error.message);
        });
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const button = this.elements.pauseStreaming;
        button.textContent = this.isPaused ? '▶️ Resume' : '⏸️ Pause';
        button.title = this.isPaused ? 'Resume streaming' : 'Pause streaming';
    }

    showError(message) {
        console.error(message);
        // Could show a toast notification here
    }
}

// Initialize the log viewer
const logViewer = new LogViewer();

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'dark';
document.body.setAttribute('data-theme', savedTheme);
document.getElementById('themeToggle').textContent = savedTheme === 'dark' ? '🌙' : '☀️';