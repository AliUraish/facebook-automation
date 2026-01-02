const axios = require('axios');
const config = require('../config/env');

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Send a message to WhatsApp support number
 */
const sendToSupport = async (message) => {
    if (!config.whatsappPhoneNumberId || !config.whatsappAccessToken || !config.supportPhoneNumber) {
        console.log('⚠️ WhatsApp not configured, logging message instead:');
        console.log(`   📱 Would send to support: ${message}`);
        return { success: false, reason: 'WhatsApp not configured' };
    }

    try {
        const response = await axios.post(
            `${WHATSAPP_API_URL}/${config.whatsappPhoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                to: config.supportPhoneNumber,
                type: 'text',
                text: { body: message },
            },
            {
                headers: {
                    'Authorization': `Bearer ${config.whatsappAccessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log('✅ WhatsApp message sent to support');
        return { success: true, messageId: response.data?.messages?.[0]?.id };
    } catch (error) {
        console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Format customer message for support
 */
const formatCustomerMessage = (customer, messageText, isNew = false) => {
    const header = isNew ? '🆕 NEW CUSTOMER' : '💬 CUSTOMER MESSAGE';
    const customerInfo = customer ?
        `Name: ${customer.name || 'Unknown'}\nPhone: ${customer.phone || 'Unknown'}` :
        'Customer info not available';

    return `${header}\n\n${customerInfo}\n\nMessage:\n${messageText}\n\nPSID: ${customer?.psid || 'Unknown'}`;
};

/**
 * Format new customer notification for support
 */
const formatNewCustomerAlert = (customerData) => {
    return `🆕 NEW CUSTOMER INQUIRY\n\nPSID: ${customerData.psid}\nFirst Message: ${customerData.messageText}\n\nPlease follow up!`;
};

module.exports = {
    sendToSupport,
    formatCustomerMessage,
    formatNewCustomerAlert,
};
