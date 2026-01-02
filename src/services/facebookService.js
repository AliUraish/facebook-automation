const axios = require('axios');
const config = require('../config/env');

const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Send a text message to a user via Facebook Messenger
 */
const sendMessage = async (recipientId, messageText) => {
    if (!config.fbPageAccessToken) {
        console.log('⚠️ Facebook Page Access Token not configured');
        console.log(`   📤 Would send to ${recipientId}: ${messageText}`);
        return { success: false, reason: 'FB token not configured' };
    }

    try {
        const response = await axios.post(
            `${FACEBOOK_API_URL}/me/messages`,
            {
                recipient: { id: recipientId },
                message: { text: messageText },
            },
            {
                params: { access_token: config.fbPageAccessToken },
                headers: { 'Content-Type': 'application/json' },
            }
        );

        console.log(`✅ Message sent to ${recipientId}`);
        return { success: true, messageId: response.data?.message_id };
    } catch (error) {
        console.error('❌ Error sending Facebook message:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendMessage,
};
