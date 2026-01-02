// Test spam detection for Desert Sound
const spamDetectionAgent = require('./src/agents/spamDetectionAgent');

console.log('🧪 Testing Desert Sound Spam Detection\n');
console.log('='.repeat(60));

const testMessages = [
    // Legitimate messages for Desert Sound
    { text: 'I need a home theater system for my living room', expected: 'GENUINE' },
    { text: 'Do you install automation systems?', expected: 'GENUINE' },
    { text: 'Looking for surround sound speakers', expected: 'GENUINE' },
    { text: 'What brands of speakers do you carry?', expected: 'GENUINE' },
    { text: 'Can you help with smart home installation?', expected: 'GENUINE' },

    // Mobile phone spam (not our business)
    { text: 'Do you repair iPhones?', expected: 'SPAM' },
    { text: 'I need a new smartphone', expected: 'SPAM' },
    { text: 'Do you sell phone cases?', expected: 'SPAM' },
    { text: 'My Samsung Galaxy screen is broken', expected: 'SPAM' },

    // Unrelated products
    { text: 'Do you fix laptops?', expected: 'SPAM' },
    { text: 'I need AirPods', expected: 'SPAM' },
    { text: 'Can you repair my printer?', expected: 'SPAM' },

    // Generic spam
    { text: 'Click here to win free money!', expected: 'SPAM' },
    { text: 'Congratulations you won $1000', expected: 'SPAM' },
    { text: 'Work from home and earn $500/day', expected: 'SPAM' },
];

testMessages.forEach((test, index) => {
    const result = spamDetectionAgent.classifyMessage(test.text);
    const status = result.isSpam ? 'SPAM' : 'GENUINE';
    const match = status === test.expected ? '✅' : '❌';

    console.log(`\nTest ${index + 1}: ${match}`);
    console.log(`Message: "${test.text}"`);
    console.log(`Expected: ${test.expected} | Got: ${status}`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    if (result.reason !== 'No spam indicators found') {
        console.log(`Reason: ${result.reason}`);
    }
});

console.log('\n' + '='.repeat(60));
