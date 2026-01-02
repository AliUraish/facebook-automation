const express = require('express');
const config = require('./config/env');
const webhookRoutes = require('./routes/webhook');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Facebook Automation Webhook Server',
        timestamp: new Date().toISOString()
    });
});

// Webhook routes
app.use('/webhook', webhookRoutes);

// Start server
app.listen(config.port, () => {
    console.log(`🚀 Server running on port ${config.port}`);
    console.log(`📌 Webhook URL: http://localhost:${config.port}/webhook`);
});

module.exports = app;
