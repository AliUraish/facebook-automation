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

const DESERT_SOUND_INFO = `
Desert Sound is a premium audio-visual and smart home solutions company based in Karachi. 
It specializes in custom-designed home theatres, high-fidelity audio systems, smart home automation, 
and professional AV installations for luxury residences and commercial spaces. 
The company provides end-to-end services including consultation, system design, installation, 
calibration, and ongoing support, delivering cinema-grade and intelligent living experiences.

IMPORTANT NOTES:
- Speakers: We do NOT carry small/portable speakers. All our speakers are BIG, HIGH-END, and PREMIUM systems.
- Amplifiers: We have both single and 2-channel amplifiers available.
- Brand Inquiries: If a brand is not in our portfolio, inform the customer it's not available with us.
- Contact Info: 
  Phone: (+92)21-111-570-111
  Email: info@desertsound.com.pk
  Website: https://desertsound.com.pk/
`;

/**
 * Generate conversational response for onboarding using Gemini
 */
const generateOnboardingResponse = async (conversationHistory, customerData = {}) => {
    // Convert conversation history to text format
    const conversationText = conversationHistory
        .map(msg => `${msg.role === 'user' ? 'Customer' : 'AI'}: ${msg.content}`)
        .join('\n');

    const prompt = `You are a friendly customer service AI for Desert Sound.
    
Company Background:
${DESERT_SOUND_INFO}

Your goal: Collect customer information naturally through conversation.

Required info to collect:
- Name
- Phone number
- Email address
- Their specific need/inquiry

Guidelines:
- Be warm and professional
- Use the Company Background to answer any questions about who we are or what we do in your own words.
- Ask ONE question at a time
- Keep responses brief (2-3 sentences max)
- Once you have all info (Name, Phone, Email, Inquiry), thank them and say support will contact them soon

Current customer data: ${JSON.stringify(customerData)}

Conversation so far:
${conversationText}

Generate the next AI response (plain text, no JSON, no formatting):`;

    return await generateContent(prompt);
};

/**
 * Identify if a message is asking about brands and which category
 */
const identifyBrandRequest = async (messageText) => {
    const prompt = `Identify if this message is asking about brands Desert Sound carries in specific categories.
    
    Allowed Categories:
    - Home Audio & Speakers
    - AV Receivers & Amplification
    - Projectors & Displays
    - Professional Audio
    - Smart Home & Control
    - Networking & Accessories
    - Microphones & Conferencing
    
    Message: "${messageText}"
    
    Return ONLY valid JSON:
    {
      "is_asking_about_brands": boolean,
      "categories": ["Category 1", "Category 2"]
    }`;

    const response = await generateContent(prompt);
    if (!response) return { is_asking_about_brands: false, categories: [] };

    try {
        let cleanResponse = response.trim();
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        return JSON.parse(cleanResponse);
    } catch (error) {
        return { is_asking_about_brands: false, categories: [] };
    }
};

/**
 * Generate a response for an existing customer's query
 */
const generateQueryResponse = async (messageText, customerName, brandsData = null, isBrandInquiry = false) => {
    let brandsContext = "";
    if (isBrandInquiry) {
        if (brandsData && Object.keys(brandsData).length > 0) {
            brandsContext = `Here are the brands we have for the categories requested:\n${JSON.stringify(brandsData)}`;
        } else {
            brandsContext = `The requested brand/category is NOT available with us. 
            Tell them it is not available and provide the specific contact info:
            Phone: (+92)21-111-570-111, Email: info@desertsound.com.pk, Web: https://desertsound.com.pk/`;
        }
    }

    const prompt = `You are a helpful customer service AI for Desert Sound.
    
Company Background & Policies:
${DESERT_SOUND_INFO}

${brandsContext}

Customer Name: ${customerName || 'Customer'}
Message: "${messageText}"

Guidelines:
1. If the customer asks for a human: Confirm you will forward their request, but ask for any missing details (if unknown) or simply acknowledge and say you're notifying the team.
2. If the query is complex or technical: Suggest "This might be best handled by our technical specialists. Shall I forward this conversation to them?"
3. If the message is about small/portable speakers, explain that we only carry BIG, HIGH-END premium systems.
4. If it's a brand inquiry and brandsContext indicates the brand is NOT available, follow the instructions in brandsContext to provide contact info.
5. If brandsData is provided, list the brands we carry professionally.
6. If the message is a general question about Desert Sound, answer it thoroughly.
7. If the message is a specific request (quote, repair, booking), acknowledge it and say you will update the team.
8. Be professional, premium, and concise.

Generate the AI response (plain text):`;

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
  "email": "email address if mentioned",
  "inquiry": "what they're asking about"
}

Only include fields that are clearly present. Return empty object {} if nothing found.`;

    const response = await generateContent(prompt);

    if (!response) return {};

    try {
        let cleanResponse = response.trim();
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        return JSON.parse(cleanResponse);
    } catch (error) {
        console.error('Error parsing customer info:', error);
        return {};
    }
};

/**
 * Classify and tag a customer query
 */
const classifyQuery = async (messageText) => {
    const prompt = `Analyze this customer message for Desert Sound (Home Theater/Automation company).
    
    1. Determine if it is SPAM or GENUINE.
    2. Assign a category (e.g., Installation, Product Inquiry, Repair, Pricing, Spam, General).
    
    Message: "${messageText}"
    
    Return ONLY valid JSON:
    {
      "is_spam": boolean,
      "category": "string",
      "confidence": 0.0-1.0,
      "reason": "string"
    }`;

    const response = await generateContent(prompt);
    if (!response) return { is_spam: false, category: 'General', confidence: 0.5 };

    try {
        let cleanResponse = response.trim();
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        return JSON.parse(cleanResponse);
    } catch (error) {
        return { is_spam: false, category: 'General', confidence: 0.5 };
    }
};

module.exports = {
    generateContent,
    classifySpam,
    classifyQuery,
    identifyBrandRequest,
    generateOnboardingResponse,
    generateQueryResponse,
    extractCustomerInfo,
};
