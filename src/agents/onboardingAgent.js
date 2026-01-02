const supabaseService = require('../services/supabaseService');
const whatsappService = require('../services/whatsappService');
const facebookService = require('../services/facebookService');

/**
 * Handle new customer onboarding
 * - Creates customer record in Supabase
 * - Sends welcome message via Messenger
 * - Notifies support via WhatsApp
 */
const handleNewCustomer = async (data) => {
    const { psid, pageId, messageText, messageId, timestamp } = data;

    console.log('🚀 Starting new customer onboarding...');

    try {
        // 1. Create customer record in Supabase
        const customer = await supabaseService.createCustomer({
            psid,
            pageId,
            firstMessage: messageText,
        });

        // 2. Send welcome message to customer via Messenger
        const welcomeMessage = `Hello! 👋 Welcome to our support. We've received your message and our team will get back to you shortly.\n\nTo help us serve you better, could you please share your name?`;

        await facebookService.sendMessage(psid, welcomeMessage);
        console.log('📤 Welcome message sent to customer');

        // 3. Notify support via WhatsApp
        const supportAlert = whatsappService.formatNewCustomerAlert({
            psid,
            messageText,
        });

        await whatsappService.sendToSupport(supportAlert);
        console.log('📱 Support notified via WhatsApp');

        return {
            success: true,
            customer,
            message: 'New customer onboarded successfully',
        };
    } catch (error) {
        console.error('❌ Error in onboarding:', error);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Handle customer response during onboarding
 * Updates customer info based on their responses
 */
const handleOnboardingResponse = async (psid, responseText, responseType) => {
    try {
        let updates = {};
        let nextPrompt = null;

        switch (responseType) {
            case 'name':
                updates.name = responseText;
                nextPrompt = `Thanks, ${responseText}! Could you also share your phone number so we can reach you faster?`;
                break;
            case 'phone':
                updates.phone = responseText;
                nextPrompt = `Perfect! We have your contact info now. Our team will reach out to you soon. Is there anything else you'd like to add?`;
                break;
            default:
                // General response - just acknowledge
                nextPrompt = `Thanks for your message! Our team will review and get back to you shortly.`;
        }

        // Update customer record
        if (Object.keys(updates).length > 0) {
            await supabaseService.updateCustomer(psid, updates);
        }

        // Send follow-up message
        if (nextPrompt) {
            await facebookService.sendMessage(psid, nextPrompt);
        }

        return { success: true };
    } catch (error) {
        console.error('❌ Error handling onboarding response:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    handleNewCustomer,
    handleOnboardingResponse,
};
