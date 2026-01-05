const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const {
    webhookPostLimiter,
    webhookGetLimiter,
    verifyFacebookSignature,
} = require('../middleware/security');

// GET - Facebook Webhook Verification
// Order: Rate limit → Handler
router.get('/', webhookGetLimiter, webhookController.verifyWebhook);

// POST - Handle incoming messages
// Order: Rate limit → Signature verification → Handler
router.post('/', webhookPostLimiter, verifyFacebookSignature, webhookController.handleMessage);

module.exports = router;
