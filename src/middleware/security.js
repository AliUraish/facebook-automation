const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');
const config = require('../config/env');

/**
 * Helmet middleware for security headers
 */
const helmetMiddleware = helmet();

/**
 * Rate limiter for webhook POST (strict)
 * 100 requests per 15 minutes per IP
 */
const webhookPostLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many webhook requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use X-Forwarded-For if behind proxy, otherwise use IP
        return req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    },
});

/**
 * Rate limiter for webhook GET verification (moderate)
 * 20 requests per 15 minutes per IP
 */
const webhookGetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { error: 'Too many verification requests.' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter for health check (light)
 * 30 requests per minute per IP
 */
const healthLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: { error: 'Too many health check requests.' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Middleware to verify Facebook webhook signature
 * Uses raw body buffer captured during parsing
 */
const verifyFacebookSignature = (req, res, next) => {
    // Skip signature verification if FB_APP_SECRET is not configured
    if (!config.fbAppSecret) {
        console.warn('⚠️ FB_APP_SECRET not configured - skipping signature verification');
        return next();
    }

    const signature = req.headers['x-hub-signature-256'];

    if (!signature) {
        console.warn('⚠️ Missing X-Hub-Signature-256 header');
        return res.status(401).json({ error: 'Signature missing' });
    }

    // Ensure raw body exists (set up in index.js via express.json verify option)
    if (!req.rawBody) {
        console.error('❌ Raw body not available for signature verification');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const elements = signature.split('=');
    if (elements.length !== 2 || elements[0] !== 'sha256') {
        console.warn('⚠️ Invalid signature format');
        return res.status(401).json({ error: 'Invalid signature format' });
    }

    const signatureHash = elements[1];
    const expectedHash = crypto
        .createHmac('sha256', config.fbAppSecret)
        .update(req.rawBody)
        .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signatureHash), Buffer.from(expectedHash))) {
        console.warn('❌ Invalid Facebook signature - possible spoofed request');
        return res.status(401).json({ error: 'Invalid signature' });
    }

    console.log('✅ Facebook signature verified');
    next();
};

/**
 * Request body size limiter
 * Applied via express.json options in index.js
 */
const jsonParserOptions = {
    limit: '10kb',
    verify: (req, res, buf) => {
        // Store raw body buffer for signature verification
        req.rawBody = buf;
    },
};

module.exports = {
    helmetMiddleware,
    webhookPostLimiter,
    webhookGetLimiter,
    healthLimiter,
    verifyFacebookSignature,
    jsonParserOptions,
};
