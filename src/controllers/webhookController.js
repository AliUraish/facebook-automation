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
    console.log(`   Mode: ${mode}`);
    console.log(`   Token: ${token}`);
    console.log(`   Challenge: ${challenge}`);

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

    // Return 200 immediately to avoid timeout
    res.status(200).send('EVENT_RECEIVED');

    // Process messages asynchronously
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
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
    }
};

/**
 * Process individual messaging events
 */
const processMessagingEvent = async (event, pageId, timestamp) => {
    const senderId = event.sender?.id;
    const recipientId = event.recipient?.id;
    const message = event.message;

    // Skip if no message or no text
    if (!message || !message.text) {
        console.log('⚠️ Skipping event without text message');
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
        // Check if customer exists in database
        const customer = await supabaseService.getCustomerByPSID(senderId);

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
                // Onboarding complete - check for spam
                console.log('👤 Existing customer found, checking message...');
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
