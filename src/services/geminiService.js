const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/env');

let genAI = null;
let model = null;

const getModel = () => {
    if (!model && config.geminiApiKey) {
        genAI = new GoogleGenerativeAI(config.geminiApiKey);
        model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }); // Lightning-fast & capable
    }
    return model;
};

/**
 * Call Gemini AI
 */
const generateContent = async (prompt, options = {}) => {
    const aiModel = getModel();

    if (!aiModel) {
        console.log('⚠️ Gemini API key not configured');
        return null;
    }

    try {
        const result = await aiModel.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('❌ Gemini API error:', error.message);
        return null;
    }
};

/**
 * Classify spam using Gemini AI
 */
const classifySpam = async (messageText) => {
    const prompt = `You are a spam detection AI for Desert Sound, an electronics company specializing in:
- Home theater systems
- Home automation
- Premium speakers

Classify this Facebook message as SPAM or GENUINE.

SPAM includes:
1. Mobile phone inquiries (repairs, sales, accessories) - NOT our business
2. Unrelated products (laptops, tablets, headphones, printers, etc.)
3. Generic scams (free money, prizes, work from home schemes)
4. Suspicious links or money-making claims

GENUINE includes:
- Questions about home theaters, speakers, automation
- Installation inquiries
- Product pricing and availability
- General customer support

Message: "${messageText}"

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "classification": "SPAM" or "GENUINE",
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}`;

    const response = await generateContent(prompt);

    if (!response) {
        return { classification: 'GENUINE', confidence: 0.5, reason: 'AI unavailable, defaulting to genuine' };
    }

    try {
        // Clean response - remove markdown code blocks if present
        let cleanResponse = response.trim();
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');

        return JSON.parse(cleanResponse);
    } catch (error) {
        console.error('Error parsing Gemini response:', error);
        console.log('Raw response:', response);
        return { classification: 'GENUINE', confidence: 0.5, reason: 'Parse error' };
    }
};

/**
 * Generate conversational response for onboarding using Gemini
 */
const generateOnboardingResponse = async (conversationHistory, customerData = {}) => {
    // Convert conversation history to text format
    const conversationText = conversationHistory
        .map(msg => `${msg.role === 'user' ? 'Customer' : 'AI'}: ${msg.content}`)
        .join('\n');

    const prompt = `You are a friendly customer service AI for Desert Sound, specializing in home theaters, automation, and speakers.

Your goal: Collect customer information naturally through conversation.

Required info to collect:
- Name
- Phone number
- Their specific need/inquiry

Guidelines:
- Be warm and professional
- Ask ONE question at a time
- Keep responses brief (2-3 sentences max)
- If they ask about products, answer briefly then continue collecting info
- Once you have all info, thank them and say support will contact them soon

Current customer data: ${JSON.stringify(customerData)}

Conversation so far:
${conversationText}

Generate the next AI response (plain text, no JSON, no formatting):`;

    return await generateContent(prompt);
};

/**
 * Extract customer information from conversation using Gemini
 */
const extractCustomerInfo = async (messageText, currentData = {}) => {
    const prompt = `Extract customer information from this message. Return ONLY valid JSON (no markdown, no code blocks):

Message: "${messageText}"

Return JSON with any found info:
{
  "name": "customer name if mentioned",
  "phone": "phone number if mentioned",
  "inquiry": "what they're asking about"
}

Only include fields that are clearly present. Return empty object {} if nothing found.`;

    const response = await generateContent(prompt);

    if (!response) return {};

    try {
        // Clean response - remove markdown code blocks if present
        let cleanResponse = response.trim();
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');

        return JSON.parse(cleanResponse);
    } catch (error) {
        console.error('Error parsing customer info:', error);
        return {};
    }
};

module.exports = {
    generateContent,
    classifySpam,
    generateOnboardingResponse,
    extractCustomerInfo,
};
