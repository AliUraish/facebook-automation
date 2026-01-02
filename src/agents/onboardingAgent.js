const supabaseService = require('../services/supabaseService');
const whatsappService = require('../services/whatsappService');
const facebookService = require('../services/facebookService');
const geminiService = require('../services/geminiService');

// Store conversation history per customer (in-memory for now)
// In production, store this in Supabase
const conversationHistory = {};

/**
 * Handle new customer onboarding with AI
 * - Creates customer record in Supabase
 * - Uses AI for natural conversation
 * - Collects customer info intelligently
 * - Notifies support via WhatsApp
 */
const handleNewCustomer = async (data) => {
    const { psid, pageId, messageText, messageId, timestamp } = data;

    console.log('🚀 Starting AI-powered customer onboarding...');

    try {
        // 1. Create customer record in Supabase
        const customer = await supabaseService.createCustomer({
            psid,
            pageId,
            firstMessage: messageText,
        });

        // 2. Initialize conversation history
        conversationHistory[psid] = [
            { role: 'user', content: messageText }
        ];

        // 3. Extract any info from first message
        const extractedInfo = await geminiService.extractCustomerInfo(messageText);
        if (extractedInfo && Object.keys(extractedInfo).length > 0) {
            await supabaseService.updateCustomer(psid, extractedInfo);
            console.log('📝 Extracted info from first message:', extractedInfo);
        }

        // 4. Generate AI response
        const aiResponse = await geminiService.generateOnboardingResponse(
            conversationHistory[psid],
            extractedInfo
        );

        const welcomeMessage = aiResponse ||
            `Hello! 👋 Welcome to Desert Sound!\n\nWe specialize in home theaters, automation systems, and premium speakers. We've received your message and our team will get back to you shortly.\n\nTo help us serve you better, could you please share your name?`;

        // Store AI response in history
        conversationHistory[psid].push({ role: 'assistant', content: welcomeMessage });

        await facebookService.sendMessage(psid, welcomeMessage);
        console.log('📤 AI-generated welcome message sent');

        // 5. Notify support via WhatsApp
        const supportAlert = whatsappService.formatNewCustomerAlert({
            psid,
            messageText,
        });

        await whatsappService.sendToSupport(supportAlert);
        console.log('📱 Support notified via WhatsApp');

        return {
            success: true,
            customer,
            message: 'New customer onboarded with AI',
        };
    } catch (error) {
        console.error('❌ Error in AI onboarding:', error);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Handle customer response during onboarding with AI
 * Uses AI to understand context and respond naturally
 */
const handleOnboardingResponse = async (psid, responseText) => {
    try {
        console.log('🤖 Processing onboarding response with AI...');

        // Get conversation history
        if (!conversationHistory[psid]) {
            conversationHistory[psid] = [];
        }

        // Add user message to history
        conversationHistory[psid].push({ role: 'user', content: responseText });

        // Extract customer info from response
        const extractedInfo = await geminiService.extractCustomerInfo(responseText);

        if (extractedInfo && Object.keys(extractedInfo).length > 0) {
            await supabaseService.updateCustomer(psid, extractedInfo);
            console.log('📝 Updated customer info:', extractedInfo);
        }

        // Get current customer data
        const customer = await supabaseService.getCustomerByPSID(psid);

        // Generate AI response based on conversation
        const aiResponse = await geminiService.generateOnboardingResponse(
            conversationHistory[psid],
            customer
        );

        if (aiResponse) {
            // Store AI response in history
            conversationHistory[psid].push({ role: 'assistant', content: aiResponse });

            // Send response to customer
            await facebookService.sendMessage(psid, aiResponse);
            console.log('📤 AI response sent');

            // Check if we have all required info
            if (customer && customer.name && customer.phone) {
                console.log('✅ All customer info collected, notifying support');

                const completeAlert = `✅ COMPLETE CUSTOMER INFO\n\nName: ${customer.name}\nPhone: ${customer.phone}\nInquiry: ${customer.inquiry || customer.first_message}\n\nPSID: ${psid}`;

                await whatsappService.sendToSupport(completeAlert);

                // Clear conversation history to save memory
                delete conversationHistory[psid];
            }
        }

        return { success: true };
    } catch (error) {
        console.error('❌ Error handling onboarding response:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get conversation history for a customer
 */
const getConversationHistory = (psid) => {
    return conversationHistory[psid] || [];
};

module.exports = {
    handleNewCustomer,
    handleOnboardingResponse,
    getConversationHistory,
};
