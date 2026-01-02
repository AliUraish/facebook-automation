require('dotenv').config();

const config = {
  // Server
  port: process.env.PORT || 3000,

  // Facebook Webhook
  verifyToken: process.env.VERIFY_TOKEN || 'simai_verify_123',

  // Facebook Page
  fbPageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN,

  // Supabase
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,

  // WhatsApp
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  supportPhoneNumber: process.env.SUPPORT_PHONE_NUMBER,
};

module.exports = config;
