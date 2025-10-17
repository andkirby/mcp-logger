#!/bin/bash

# Browser Logging System - Quick Setup Script
# This script sets up the complete Browser Logging System MVP

echo "🚀 Browser Logging System - Quick Setup"
echo "========================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js version 18+ is required (current: $(node -v))"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if we're in the right directory
if [ ! -f "mcp-logger.js" ] || [ ! -f "logger-server.js" ]; then
    echo "❌ Error: Please run this script from the mcp-logger directory"
    exit 1
fi

echo "✅ Directory check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create test directory
mkdir -p test
echo "✅ Created test directory"

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Start backend server:     node logger-server.js"
echo "2. Start MCP server:         node browser-logs-mcp-server.js"
echo "3. Open test frontend:       open test/test-frontend.html"
echo "4. Test with MCP client:     Use get_logs() tool"
echo ""
echo "📖 For detailed instructions, see README.md"
echo ""
echo "🧪 Quick Test:"
echo "Run: node test-frontend-simulation.js"
echo ""

# Offer to start servers
read -p "Do you want to start the servers now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Starting backend server..."
    echo "Backend will run on http://localhost:22345"
    echo "Press Ctrl+C to stop"
    echo ""
    node logger-server.js
fi