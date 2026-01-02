# Facebook Automation Webhook

Facebook Webhook integration for message processing with Supabase database and WhatsApp support forwarding.

## Features

- ✅ **Webhook Verification** - Handles Facebook's GET verification challenge
- 📩 **Message Processing** - Receives and processes incoming Facebook messages
- 👤 **Customer Management** - Stores customer data in Supabase
- 🆕 **New Customer Onboarding** - Welcomes new customers and collects info
- 🔍 **Spam Detection** - Filters spam messages from genuine inquiries
- 📱 **WhatsApp Forwarding** - Sends genuine messages to support team

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `VERIFY_TOKEN` - Your webhook verify token (default: `simai_verify_123`)
- `FB_PAGE_ACCESS_TOKEN` - Facebook Page access token
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anon key
- `WHATSAPP_PHONE_NUMBER_ID` - WhatsApp Business phone number ID
- `WHATSAPP_ACCESS_TOKEN` - WhatsApp access token
- `SUPPORT_PHONE_NUMBER` - Support team's phone number

### 3. Set Up Supabase Tables

Create these tables in your Supabase project:

**customers**
```sql
CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  psid TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  page_id TEXT,
  first_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);
```

**spam_logs**
```sql
CREATE TABLE spam_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  psid TEXT NOT NULL,
  message TEXT NOT NULL,
  classification_reason TEXT,
  confidence NUMERIC(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4. Run the Server

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

## Testing

### Verify Webhook

```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=simai_verify_123&hub.challenge=test123"
# Should return: test123
```

### Test Message POST

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": [{
      "id": "PAGE_ID",
      "time": 1234567890,
      "messaging": [{
        "sender": {"id": "USER_123"},
        "recipient": {"id": "PAGE_ID"},
        "timestamp": 1234567890,
        "message": {"mid": "msg_1", "text": "Hello, I need help"}
      }]
    }]
  }'
# Should return: EVENT_RECEIVED
```

## Project Structure

```
src/
├── index.js                 # Express server entry
├── config/env.js           # Environment config
├── routes/webhook.js       # Webhook routes
├── controllers/
│   └── webhookController.js # Request handlers
├── services/
│   ├── supabaseService.js  # Database operations
│   ├── facebookService.js  # Messenger API
│   └── whatsappService.js  # WhatsApp API
└── agents/
    ├── onboardingAgent.js   # New customer flow
    └── spamDetectionAgent.js # Spam classification
```

## Deployment

Deploy to any Node.js hosting platform (Railway, Render, Vercel, etc.) and configure your Facebook webhook URL in the Meta Developer Console.

## License

MIT
