const express = require('express');
const config = require('./config/env');
const webhookRoutes = require('./routes/webhook');
const {
    helmetMiddleware,
    healthLimiter,
    jsonParserOptions,
} = require('./middleware/security');

const app = express();

// Trust proxy - Required for accurate IP detection behind Render/Vercel/Heroku/Nginx
// This ensures rate limiting works correctly
app.set('trust proxy', 1);

// Security Headers (Helmet) - Applied first
app.use(helmetMiddleware);

// Body Size Limit + Raw Body Capture for Signature Verification
// Order: Size limit checked before parsing
app.use(express.json(jsonParserOptions));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Health check with light rate limiting
app.get('/', healthLimiter, (req, res) => {
    res.json({
        status: 'ok',
        message: 'Facebook Automation Webhook Server',
        timestamp: new Date().toISOString()
    });
});

// Webhook routes (rate limiting + signature verification applied in routes/webhook.js)
app.use('/webhook', webhookRoutes);

// Start server
app.listen(config.port, () => {
    console.log(`🚀 Server running on port ${config.port}`);
    console.log(`📌 Webhook URL: http://localhost:${config.port}/webhook`);
    console.log(`🔒 Security: Helmet enabled, Rate limiting active`);
    console.log(`🔐 Signature Verification: ${config.fbAppSecret ? 'Enabled' : 'Disabled (FB_APP_SECRET not set)'}`);
});

module.exports = app;
