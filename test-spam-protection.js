#!/usr/bin/env node

/**
 * Test script to verify anti-spam protection
 */

// Node.js 18+ has built-in fetch, no need for node-fetch

const SERVER_URL = 'http://localhost:22345';

async function testSpamProtection() {
    console.log('🧪 Testing anti-spam protection...\n');

    // Test 1: Send multiple identical log requests quickly
    console.log('📝 Test 1: Sending duplicate log entries...');
    const duplicateLog = {
        host: 'localhost:63342',
        logs: {
            browser: [{
                level: 'info',
                message: 'Test duplicate message',
                timestamp: Date.now(),
                source: 'test-script'
            }]
        }
    };

    for (let i = 0; i < 10; i++) {
        try {
            const response = await fetch(`${SERVER_URL}/api/logs/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(duplicateLog)
            });
            const result = await response.json();
            console.log(`  Request ${i + 1}: ${result.status} (${result.stored || 0} stored, ${result.filtered || 0} filtered)`);
        } catch (error) {
            console.error(`  Request ${i + 1}: Error - ${error.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms between requests
    }

    console.log('\n⏱️  Test 2: Waiting 6 seconds and sending again...');
    await new Promise(resolve => setTimeout(resolve, 6000));

    try {
        const response = await fetch(`${SERVER_URL}/api/logs/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(duplicateLog)
        });
        const result = await response.json();
        console.log(`  After wait: ${result.status} (${result.stored || 0} stored, ${result.filtered || 0} filtered)`);
    } catch (error) {
        console.error(`  After wait: Error - ${error.message}`);
    }

    console.log('\n🚫 Test 3: Testing rate limit (50+ requests)...');
    let rateLimited = false;

    for (let i = 0; i < 60; i++) {
        try {
            const response = await fetch(`${SERVER_URL}/api/logs/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: 'localhost:63342',
                    logs: {
                        browser: [{
                            level: 'info',
                            message: `Rate limit test message ${i}`,
                            timestamp: Date.now(),
                            source: 'test-script'
                        }]
                    }
                })
            });

            if (response.status === 429) {
                console.log(`  Request ${i + 1}: Rate limited!`);
                rateLimited = true;
                break;
            }

            const result = await response.json();
            if (i % 10 === 0) {
                console.log(`  Request ${i + 1}: ${result.status}`);
            }
        } catch (error) {
            console.error(`  Request ${i + 1}: Error - ${error.message}`);
        }

        // Very small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (!rateLimited) {
        console.log('  No rate limiting triggered (may need more requests or different timing)');
    }

    console.log('\n✅ Spam protection test completed!');
    console.log('\n📊 Check the server output to see:');
    console.log('  - Duplicate filtering in action');
    console.log('  - Rate limiting warnings');
    console.log('  - High frequency request warnings');
}

// Only run if this script is executed directly
if (require.main === module) {
    testSpamProtection().catch(console.error);
}

module.exports = { testSpamProtection };