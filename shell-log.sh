#!/bin/bash

# Simple Shell Logger - Basic nohup with process substitution
# Usage: ./shell-log-simple.sh [app-name] [command] [args...]

set -e

# Configuration
BACKEND_URL="${MCP_LOGGING_BACKEND_URL:-http://localhost:22345}"
APP_NAME="${1:-shell-commands}"
HOST_NAME="${HOSTNAME:-$(hostname)}"
COMMAND="${2:-}"
VERBOSE="${MCP_LOGGING_VERBOSE:-false}"
WORKING_DIR="$(pwd)"

# Generate namespace from command
if [ -n "$COMMAND" ]; then
    NAMESPACE="$COMMAND"
    if [ ${#NAMESPACE} -gt 30 ]; then
        NAMESPACE="${NAMESPACE:0:27}..."
    fi
    NAMESPACE=$(echo "$NAMESPACE" | sed 's/[^a-zA-Z0-9_-]/_/g')
else
    NAMESPACE="shell-output"
fi

# Shift to get remaining args
if [ $# -ge 2 ]; then
    shift 2
    COMMAND_ARGS=("$@")
else
    COMMAND_ARGS=()
fi

if [ -z "$COMMAND" ]; then
    echo "📜 Simple Shell Logger - nohup with process substitution"
    echo ""
    echo "🔧 USAGE:"
    echo "  $0 [app-name] [command] [args...]"
    echo ""
    echo "🌟️ FEATURES:"
    echo "  ✅ Background process capture with nohup"
    echo "  ✅ Memory-only logging"
    echo "  ✅ Real-time streaming"
    echo ""
    exit 1
fi

# Function to send log to MCP backend in standard format
send_log() {
    local log_entry="$1"

    if [ "$VERBOSE" = "true" ]; then
        echo "📤: $log_entry" >&2
    fi

    curl -s -X POST "${BACKEND_URL}/api/logs/submit" \
        -H "Content-Type: application/json" \
        -d "{\"app\":\"${APP_NAME}\",\"host\":\"${HOST_NAME}\",\"logs\":{\"${NAMESPACE}\":[${log_entry}]}}" \
        --max-time 5 \
        --connect-timeout 3 \
        > /dev/null 2>&1 || true
}

# Log command start
START_TIME=$(date +%s)
start_entry="{\"timestamp\":${START_TIME}000,\"level\":\"INFO\",\"message\":\"🚀 Starting: $COMMAND ${COMMAND_ARGS[*]}\",\"namespace\":\"${NAMESPACE}\",\"app\":\"${APP_NAME}\",\"host\":\"${HOST_NAME}\",\"source\":\"shell\"}"
send_log "$start_entry"

if [ "$VERBOSE" = "true" ]; then
    echo "🚀 Starting: $COMMAND ${COMMAND_ARGS[*]}"
fi

# Change to working directory
cd "$WORKING_DIR"

# Execute with nohup and process substitution
{
    nohup "$COMMAND" "${COMMAND_ARGS[@]}" \
        > >(
            while IFS= read -r line; do
                if [ -n "$line" ]; then
                    timestamp=$(date +%s)
                    escaped=$(echo "$line" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g')
                    log_entry="{\"timestamp\":${timestamp}000,\"level\":\"LOG\",\"message\":\"${escaped}\",\"namespace\":\"${NAMESPACE}\",\"app\":\"${APP_NAME}\",\"host\":\"${HOST_NAME}\",\"source\":\"shell\"}"
                    send_log "$log_entry"
                    if [ "$VERBOSE" = "true" ]; then
                        echo "[stdout] $line"
                    fi
                fi
            done
        ) \
        2> >(
            while IFS= read -r line; do
                if [ -n "$line" ]; then
                    timestamp=$(date +%s)
                    escaped=$(echo "$line" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g')
                    log_entry="{\"timestamp\":${timestamp}000,\"level\":\"ERROR\",\"message\":\"${escaped}\",\"namespace\":\"${NAMESPACE}\",\"app\":\"${APP_NAME}\",\"host\":\"${HOST_NAME}\",\"source\":\"shell\"}"
                    send_log "$log_entry"
                    if [ "$VERBOSE" = "true" ]; then
                        echo "[stderr] $line"
                    fi
                fi
            done
        ) &
}
PID=$!

# Wait for completion
wait $PID 2>/dev/null || true
EXIT_CODE=$?

# Log command completion
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
STATUS="✅"
if [ $EXIT_CODE -ne 0 ]; then
    STATUS="❌"
fi
completion_entry="{\"timestamp\":${END_TIME}000,\"level\":\"INFO\",\"message\":\"${STATUS} Completed: $COMMAND ${COMMAND_ARGS[*]} (${DURATION}s)\",\"namespace\":\"${NAMESPACE}\",\"app\":\"${APP_NAME}\",\"host\":\"${HOST_NAME}\",\"source\":\"shell\"}"
send_log "$completion_entry"

if [ "$VERBOSE" = "true" ]; then
    echo "✅ Completed with exit code: $EXIT_CODE (duration: ${DURATION}s)"
fi

exit $EXIT_CODE