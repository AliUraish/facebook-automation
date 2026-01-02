const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// GET - Facebook Webhook Verification
router.get('/', webhookController.verifyWebhook);

// POST - Handle incoming messages
router.post('/', webhookController.handleMessage);

module.exports = router;
