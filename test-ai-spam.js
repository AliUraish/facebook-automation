// Test Gemini AI-powered spam detection
// Make sure to set GEMINI_API_KEY in your .env file first

const geminiService = require('./src/services/geminiService');

console.log('🤖 Testing Gemini AI Spam Detection for Desert Sound\n');
console.log('='.repeat(70));

const testMessages = [
    // Legitimate Desert Sound inquiries
    { text: 'I need a home theater system for my living room', expected: 'GENUINE' },
    { text: 'Do you install Dolby Atmos?', expected: 'GENUINE' },
    { text: 'Looking for surround sound speakers', expected: 'GENUINE' },
    { text: 'Can you help with smart home automation?', expected: 'GENUINE' },
    { text: 'What brands of speakers do you carry?', expected: 'GENUINE' },
    { text: 'I want to automate my lights and curtains', expected: 'GENUINE' },

    // Mobile phone spam (not our business)
    { text: 'Do you repair iPhones?', expected: 'SPAM' },
    { text: 'I need a new smartphone', expected: 'SPAM' },
    { text: 'My Samsung screen is broken', expected: 'SPAM' },

    // Unrelated products
    { text: 'Do you fix laptops?', expected: 'SPAM' },
    { text: 'I need AirPods', expected: 'SPAM' },
    { text: 'Can you repair my printer?', expected: 'SPAM' },

    // Generic spam
    { text: 'Click here to win free money!', expected: 'SPAM' },
    { text: 'Congratulations you won $1000', expected: 'SPAM' },
    { text: 'Work from home and earn $500/day', expected: 'SPAM' },
];

async function runTests() {
    let passed = 0;
    let failed = 0;

    for (let i = 0; i < testMessages.length; i++) {
        const test = testMessages[i];

        console.log(`\n📝 Test ${i + 1}/${testMessages.length}`);
        console.log(`Message: "${test.text}"`);
        console.log(`Expected: ${test.expected}`);

        try {
            const result = await geminiService.classifySpam(test.text);

            if (!result) {
                console.log('❌ Gemini service unavailable - check GEMINI_API_KEY in .env');
                failed++;
                continue;
            }

            const match = result.classification === test.expected ? '✅' : '❌';

            console.log(`Got: ${result.classification} ${match}`);
            console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
            console.log(`Reason: ${result.reason}`);

            if (result.classification === test.expected) {
                passed++;
            } else {
                failed++;
            }

        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            failed++;
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(70));
    console.log(`\n📊 Results: ${passed}/${testMessages.length} tests passed`);

    if (failed === testMessages.length) {
        console.log('\n⚠️  All tests failed. Make sure to:');
        console.log('   1. Get your FREE Gemini API key from: https://aistudio.google.com/apikey');
        console.log('   2. Add to .env file: GEMINI_API_KEY=your-key-here');
    } else if (passed === testMessages.length) {
        console.log('\n🎉 Perfect! All tests passed with Gemini AI!');
        console.log('💰 Cost: $0 (Gemini is FREE!)');
    }
}

runTests().catch(console.error);
