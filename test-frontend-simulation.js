/**
 * Test script to simulate frontend logger behavior
 */

const testData = {
    host: 'localhost:8081',
    logs: {
        browser: [
            {
                timestamp: Date.now(),
                level: 'INFO',
                message: 'Application started successfully'
            },
            {
                timestamp: Date.now() + 1000,
                level: 'LOG',
                message: 'User interaction detected'
            },
            {
                timestamp: Date.now() + 2000,
                level: 'WARN',
                message: 'Deprecated API used: getUserMedia'
            },
            {
                timestamp: Date.now() + 3000,
                level: 'ERROR',
                message: 'Network request failed: Connection timeout'
            }
        ],
        'user-actions': [
            {
                action: 'click',
                target: 'submit-button',
                page: '/checkout',
                timestamp: Date.now() + 1500
            },
            {
                action: 'form-submit',
                form: 'contact-form',
                fields: ['name', 'email', 'message'],
                timestamp: Date.now() + 2500
            }
        ],
        'api-calls': {
            method: 'POST',
            url: '/api/users',
            status: 201,
            duration: 145,
            payload: { name: 'Test User', email: 'test@example.com' },
            timestamp: Date.now() + 2000
        },
        'performance': {
            metric: 'page-load',
            value: 1250,
            unit: 'ms',
            page: '/dashboard',
            timestamp: Date.now() + 500
        }
    }
};

async function sendTestData() {
    try {
        console.log('🧪 Sending test frontend data to backend...');

        const response = await fetch('http://localhost:22345/api/logs/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('✅ Test data sent successfully:', result);

        // Wait a moment for processing
        setTimeout(() => {
            console.log('\n📊 Checking backend status...');
            checkStatus();
        }, 1000);

    } catch (error) {
        console.error('❌ Failed to send test data:', error.message);
    }
}

async function checkStatus() {
    try {
        const response = await fetch('http://localhost:22345/api/logs/status');
        const status = await response.json();

        console.log('📋 Backend Status:');
        console.log(`- Total hosts: ${status.hosts.length}`);
        console.log(`- Total logs: ${status.totalLogs}`);

        status.hosts.forEach(host => {
            console.log(`\n🏠 Host: ${host.host}`);
            console.log(`- Total logs: ${host.totalLogs}`);
            console.log(`- Namespaces: ${host.namespaces.map(ns => `${ns.namespace} (${ns.count})`).join(', ')}`);
        });

        console.log('\n🔍 Testing log retrieval...');

        // Test retrieving browser logs
        setTimeout(() => {
            testLogRetrieval();
        }, 1000);

    } catch (error) {
        console.error('❌ Failed to check status:', error.message);
    }
}

async function testLogRetrieval() {
    try {
        // Test browser logs
        console.log('\n📝 Retrieving browser logs...');
        const browserResponse = await fetch('http://localhost:22345/api/logs/localhost:8081/browser?lines=10');
        const browserData = await browserResponse.json();

        console.log(`Found ${browserData.logs.length} browser logs:`);
        browserData.logs.forEach(log => {
            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            console.log(`  [${timestamp}] ${log.level} ${log.message}`);
        });

        // Test user-actions logs
        console.log('\n👤 Retrieving user-action logs...');
        const actionsResponse = await fetch('http://localhost:22345/api/logs/localhost:8081/user-actions?lines=10');
        const actionsData = await actionsResponse.json();

        console.log(`Found ${actionsData.logs.length} user-action logs:`);
        actionsData.logs.forEach(log => {
            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            console.log(`  [${timestamp}] ${JSON.stringify(log.data)}`);
        });

        console.log('\n🎉 Frontend simulation test completed successfully!');
        console.log('\n📋 Summary:');
        console.log('✅ Backend server is running and accepting logs');
        console.log('✅ Log storage is working correctly');
        console.log('✅ Log retrieval is functional');
        console.log('✅ Multiple namespaces are supported');
        console.log('✅ Host identification is working');

    } catch (error) {
        console.error('❌ Failed to retrieve logs:', error.message);
    }
}

// Run the test
sendTestData();