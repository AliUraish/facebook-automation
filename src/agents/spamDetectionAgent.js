const supabaseService = require('../services/supabaseService');
const whatsappService = require('../services/whatsappService');

// Spam detection keywords and patterns
const SPAM_INDICATORS = {
    keywords: [
        'buy now',
        'free money',
        'click here',
        'winner',
        'congratulations you won',
        'act now',
        'limited time offer',
        'make money fast',
        'work from home',
        'double your income',
        'risk free',
        'no obligation',
        'special promotion',
        'exclusive deal',
        'urgent action required',
    ],
    patterns: [
        /https?:\/\/bit\.ly/i,        // Shortened URLs
        /https?:\/\/t\.co/i,
        /https?:\/\/tinyurl/i,
        /\$\d+[,\d]*\s*(per|\/)\s*(day|week|month)/i,  // Money claims
        /earn\s+\$?\d+/i,
        /\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/g,  // Phone numbers in message
    ],
};

/**
 * Classify if a message is spam or genuine
 * Returns { isSpam: boolean, confidence: number, reason: string }
 */
const classifyMessage = (text) => {
    const lowerText = text.toLowerCase();
    let spamScore = 0;
    let reasons = [];

    // Check keywords
    for (const keyword of SPAM_INDICATORS.keywords) {
        if (lowerText.includes(keyword)) {
            spamScore += 0.3;
            reasons.push(`Contains keyword: "${keyword}"`);
        }
    }

    // Check patterns
    for (const pattern of SPAM_INDICATORS.patterns) {
        if (pattern.test(text)) {
            spamScore += 0.4;
            reasons.push(`Matches spam pattern`);
        }
    }

    // Cap confidence at 1.0
    const confidence = Math.min(spamScore, 1.0);
    const isSpam = confidence >= 0.5;

    return {
        isSpam,
        confidence,
        reason: reasons.length > 0 ? reasons.join('; ') : 'No spam indicators found',
    };
};

/**
 * Process message from existing customer
 * - Classifies message as spam or genuine
 * - If genuine: forwards to WhatsApp support
 * - If spam: logs to database
 */
const processMessage = async (data) => {
    const { customer, psid, pageId, messageText, messageId, timestamp } = data;

    console.log('🔍 Analyzing message for spam...');

    // Classify the message
    const classification = classifyMessage(messageText);

    console.log(`   Classification: ${classification.isSpam ? '🚫 SPAM' : '✅ GENUINE'}`);
    console.log(`   Confidence: ${(classification.confidence * 100).toFixed(0)}%`);
    console.log(`   Reason: ${classification.reason}`);

    try {
        if (classification.isSpam) {
            // Log spam to database
            await supabaseService.logSpam({
                psid,
                message: messageText,
                reason: classification.reason,
                confidence: classification.confidence,
            });

            console.log('🚫 Spam message logged, not forwarding to support');

            return {
                success: true,
                action: 'spam_logged',
                classification,
            };
        } else {
            // Forward genuine message to WhatsApp support
            const formattedMessage = whatsappService.formatCustomerMessage(
                customer,
                messageText,
                false
            );

            await whatsappService.sendToSupport(formattedMessage);
            console.log('📱 Genuine message forwarded to support');

            return {
                success: true,
                action: 'forwarded_to_support',
                classification,
            };
        }
    } catch (error) {
        console.error('❌ Error processing message:', error);
        return {
            success: false,
            error: error.message,
            classification,
        };
    }
};

module.exports = {
    classifyMessage,
    processMessage,
};
