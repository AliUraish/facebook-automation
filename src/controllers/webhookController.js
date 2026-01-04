const config = require('../config/env');
const supabaseService = require('../services/supabaseService');
const onboardingAgent = require('../agents/onboardingAgent');
const spamDetectionAgent = require('../agents/spamDetectionAgent');

/**
 * GET /webhook - Facebook Webhook Verification
 * Validates hub.mode, hub.verify_token and returns hub.challenge
 */
const verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('📥 Webhook verification request received');
    console.log(`   Config Status:
       - Verify Token Set: ${!!config.verifyToken}
       - Supabase Set: ${!!config.supabaseUrl}
       - Gemini Set: ${!!config.geminiApiKey}
       - Facebook Set: ${!!config.fbPageAccessToken}`);

    // Check if mode and token are correct
    if (mode === 'subscribe' && token === config.verifyToken) {
        console.log('✅ Webhook verified successfully');
        // Return the challenge as plain text with 200 OK
        return res.status(200).send(challenge);
    }

    console.log('❌ Webhook verification failed');
    return res.status(403).json({ error: 'Verification failed' });
};

/**
 * POST /webhook - Handle incoming messages from Facebook
 */
const handleMessage = async (req, res) => {
    const body = req.body;

    // Verify this is a page subscription
    if (body.object !== 'page') {
        console.log('⚠️ Received non-page event');
        return res.sendStatus(404);
    }

    console.log('✅ Webhook event received, starting processing...');

    // Process messages
    try {
        // Iterate over each entry (there may be multiple)
        for (const entry of body.entry) {
            const pageId = entry.id;
            const timestamp = entry.time;

            // Iterate over messaging events
            if (entry.messaging) {
                for (const event of entry.messaging) {
                    await processMessagingEvent(event, pageId, timestamp);
                }
            }
        }

        // Return 200 after all processing is complete (better for Vercel/Serverless)
        console.log('🏁 Webhook processing complete');
        res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        // Still return 200 to acknowledge the event so Facebook doesn't retry infinitely
        res.status(200).send('ERROR_BUT_RECEIVED');
    }
};

const geminiService = require('../services/geminiService');
const whatsappService = require('../services/whatsappService');

/**
 * Process individual messaging events
 */
const processMessagingEvent = async (event, pageId, timestamp) => {
    const senderId = event.sender?.id;
    const recipientId = event.recipient?.id;
    const message = event.message;

    // Identify event type
    if (event.delivery) {
        console.log('🚚 Delivery receipt received');
        return;
    }
    if (event.read) {
        console.log('📖 Read receipt received');
        return;
    }

    // Handle Human Intervention (Echoes)
    if (message?.is_echo) {
        console.log('📣 Message echo (Page replied)');
        // If a human replier on the page sent this, the recipientId is the customer's PSID
        if (recipientId) {
            console.log(`👤 Human reply detected for ${recipientId}, pausing AI...`);
            await supabaseService.pauseCustomer(recipientId);
        }
        return;
    }

    // Skip if no message or no text (e.g. just an attachment or something else)
    if (!message || !message.text) {
        console.log('ℹ️ Non-text event skipped (likely attachment or unsupported event)');
        return;
    }

    const messageText = message.text;
    const messageId = message.mid;

    console.log('\n📩 New message received:');
    console.log(`   From: ${senderId}`);
    console.log(`   Page: ${pageId}`);
    console.log(`   Text: ${messageText}`);
    console.log(`   Time: ${new Date(timestamp).toISOString()}`);

    try {
        // 1. Get customer from database
        let customer = await supabaseService.getCustomerByPSID(senderId);

        // 2. Classify and log the query (regardless of pause state)
        console.log('🏷️ Classifying query...');
        const classification = await geminiService.classifyQuery(messageText);

        await supabaseService.logQuery({
            psid: senderId,
            messageText,
            category: classification.category,
            isSpam: classification.is_spam
        });

        // 3. Check for Human Intervention Pause
        if (customer && customer.is_paused) {
            // Determine if this was initiated by support (no first_message)
            const isSupportInitiated = !customer.first_message;

            // Check if we should auto-resume (1.5 hours) ONLY for customer-initiated chats
            // Support-initiated chats stay paused "until changed" (manually)
            const lastHumanReply = new Date(customer.last_human_reply_at).getTime();
            const hoursSinceHumanReply = (Date.now() - lastHumanReply) / (1000 * 60 * 60);

            if (isSupportInitiated || hoursSinceHumanReply < 1.5) {
                console.log(`⏸️ AI is PAUSED for this customer (${isSupportInitiated ? 'Permanent' : '1.5h limit'}). Logging query and skipping AI response.`);

                // Still notify support about the new message and its category
                await whatsappService.sendToSupport(
                    `💬 *NEW MESSAGE (AI PAUSED)*\n\n` +
                    `User: ${customer.name || 'Unknown'}\n` +
                    `Category: ${classification.category}\n` +
                    `Message: "${messageText}"\n\n` +
                    `Note: A human is currently handling this chat.`
                );
                return;
            } else {
                console.log('🔄 Auto-resuming AI after 1.5 hours of silence...');
                customer = await supabaseService.resumeCustomer(senderId);
            }
        }

        if (!customer) {
            // New customer - trigger onboarding
            console.log('👤 New customer detected, starting onboarding...');
            await onboardingAgent.handleNewCustomer({
                psid: senderId,
                pageId,
                messageText,
                messageId,
                timestamp,
            });
        } else {
            // Existing customer - check if onboarding is complete
            const isOnboardingComplete = customer.name && customer.phone;

            if (!isOnboardingComplete) {
                // Continue onboarding conversation
                console.log('👤 Continuing onboarding conversation...');
                await onboardingAgent.handleOnboardingResponse(senderId, messageText);
            } else {
                // Onboarding complete - process message (spam detection + escalation)
                console.log('👤 Existing customer found, processing message...');
                await spamDetectionAgent.processMessage({
                    customer,
                    psid: senderId,
                    pageId,
                    messageText,
                    messageId,
                    timestamp,
                });
            }
        }
    } catch (error) {
        console.error('❌ Error processing message:', error);
    }
};

module.exports = {
    verifyWebhook,
    handleMessage,
};
