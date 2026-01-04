const supabaseService = require('../services/supabaseService');
const whatsappService = require('../services/whatsappService');
const geminiService = require('../services/geminiService');

/**
 * Classify if a message is spam or genuine for Desert Sound using AI
 * Returns { isSpam: boolean, confidence: number, reason: string }
 */
const classifyMessage = async (text) => {
    console.log('🤖 Using Gemini AI to classify message...');

    const aiResult = await geminiService.classifySpam(text);

    if (!aiResult) {
        console.log('⚠️ AI classification failed, using fallback');
        return classifyMessageFallback(text);
    }

    const isSpam = aiResult.classification === 'SPAM';

    console.log(`   AI Classification: ${isSpam ? '🚫 SPAM' : '✅ GENUINE'}`);
    console.log(`   Confidence: ${(aiResult.confidence * 100).toFixed(0)}%`);
    console.log(`   Reason: ${aiResult.reason}`);

    return {
        isSpam,
        confidence: aiResult.confidence,
        reason: aiResult.reason,
    };
};

/**
 * Fallback keyword-based classification (if AI fails)
 */
const classifyMessageFallback = (text) => {
    const lowerText = text.toLowerCase();
    let spamScore = 0;
    let reasons = [];

    // Generic spam keywords
    const spamKeywords = ['free money', 'click here', 'winner', 'you won', 'buy now'];
    for (const keyword of spamKeywords) {
        if (lowerText.includes(keyword)) {
            spamScore += 0.3;
            reasons.push(`Spam keyword: "${keyword}"`);
        }
    }

    // Mobile phone keywords
    const mobileKeywords = ['iphone', 'smartphone', 'phone repair', 'phone case'];
    for (const keyword of mobileKeywords) {
        if (lowerText.includes(keyword)) {
            spamScore += 0.6;
            reasons.push(`Mobile phone: "${keyword}"`);
        }
    }

    // Unrelated products
    const unrelatedKeywords = ['laptop', 'printer', 'airpods', 'headphones'];
    for (const keyword of unrelatedKeywords) {
        if (lowerText.includes(keyword)) {
            spamScore += 0.5;
            reasons.push(`Unrelated: "${keyword}"`);
        }
    }

    const confidence = Math.min(spamScore, 1.0);
    const isSpam = confidence >= 0.4;

    return {
        isSpam,
        confidence,
        reason: reasons.length > 0 ? reasons.join('; ') : 'No spam indicators',
    };
};

const facebookService = require('../services/facebookService');

/**
 * Process message from existing customer
 * - Classifies message as spam or genuine using AI
 * - If genuine: forwards to WhatsApp support and confirms to customer
 * - If spam: logs to database and notifies support if repeated
 */
const processMessage = async (data) => {
    const { customer, psid, pageId, messageText, messageId, timestamp } = data;

    console.log('🔍 Analyzing message for spam...');

    // Classify the message using AI
    const classification = await classifyMessage(messageText);

    try {
        if (classification.isSpam) {
            // Log spam to database
            await supabaseService.logSpam({
                psid,
                message: messageText,
                reason: classification.reason,
                confidence: classification.confidence,
            });

            console.log('🚫 Spam message logged');

            // Check if they are spamming "one kind of message"
            const recentSpam = await supabaseService.getRecentSpamLogs(psid, 3);
            const isRepeating = recentSpam.length >= 2 &&
                recentSpam.every(log => log.message.trim().toLowerCase() === messageText.trim().toLowerCase());

            if (isRepeating) {
                console.log('⚠️ Repeated spam detected, notifying support...');
                await whatsappService.sendToSupport(
                    `🚨 *SPAM ALERT*\n\n` +
                    `The following person is spamming the same message:\n` +
                    `Name: ${customer.name || 'Unknown'}\n` +
                    `Phone: ${customer.phone || 'Unknown'}\n` +
                    `PSID: ${psid}\n\n` +
                    `Message: "${messageText}"\n\n` +
                    `Reason: ${classification.reason}`
                );
            } else {
                // Also forward initial spam for awareness as requested
                await whatsappService.sendToSupport(
                    `🚫 *SPAM FILTERED*\n\n` +
                    `User: ${customer.name || 'Unknown'}\n` +
                    `Message: "${messageText}"\n` +
                    `Reason: ${classification.reason}\n\n` +
                    `Note: This was NOT forwarded as a genuine query.`
                );
            }

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

            // NEW: Acknowledge the customer
            await facebookService.sendMessage(psid, "Sure, I will update the team about this.");
            console.log('💬 Acknowledgment sent to customer');

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
