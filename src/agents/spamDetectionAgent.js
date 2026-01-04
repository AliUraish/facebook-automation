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

            // 🏷️ 1. Check if asking about brands
            console.log('🏷️ Checking for brand inquiry...');
            const brandInquiry = await geminiService.identifyBrandRequest(messageText);

            let brandsData = null;
            if (brandInquiry.is_asking_about_brands && brandInquiry.categories.length > 0) {
                console.log(`🔍 Fetching brands for categories: ${brandInquiry.categories.join(', ')}`);
                brandsData = {};
                for (const cat of brandInquiry.categories) {
                    const brands = await supabaseService.getBrandsByCategory(cat);
                    if (brands.length > 0) {
                        brandsData[cat] = brands;
                    }
                }
            }

            // 🤖 2. Generate AI response (Brand-aware & Policy-aware)
            const aiAnswer = await geminiService.generateQueryResponse(
                messageText,
                customer.name,
                brandsData,
                brandInquiry.is_asking_about_brands
            );

            await facebookService.sendMessage(psid, aiAnswer || "Sure, I will update the team about this.");
            console.log('💬 AI response sent to customer');

            // 📱 3. Forward to support for actionable requests
            // We'll forward it if it's NOT a general info query and NOT a brand/product query AI handled
            // EXCEPT if it's explicitly a Human Assistance Request or Gemini flagged escalation
            const classificationResult = await geminiService.classifyQuery(messageText);

            const isInfoQuery = classificationResult.category === 'General' || classificationResult.category === 'Information';
            const isSpeakerSizeQuery = messageText.toLowerCase().includes('small') || messageText.toLowerCase().includes('portable');
            const isBrandInquiryAIHandled = brandInquiry.is_asking_about_brands;
            const isEscalationRequested = classificationResult.category === 'Human Assistance Request' || classificationResult.escalation_needed;

            if (isEscalationRequested || (!isInfoQuery && !isSpeakerSizeQuery && !isBrandInquiryAIHandled)) {
                await whatsappService.sendToSupport(formattedMessage);
                console.log('📱 Genuine message forwarded to support');
            } else {
                console.log('ℹ️ Query handled by AI (Policy/Brand/Info), skipping support forwarding as requested');
            }

            return {
                success: true,
                action: 'answered_by_ai',
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
