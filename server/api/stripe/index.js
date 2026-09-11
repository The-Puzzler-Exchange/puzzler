const express = require('express');

const middleware = require('../../middleware');
const webhooks = require('./webhooks');
const createBillingPortalSession = require('./create-billing-portal-session');
const createCreditCheckoutSession = require('./create-credit-checkout-session');

const stripeRouter = express.Router();

// Stripe signs the webhook payload, so the body must not be parsed before the
// signature has been verified.
stripeRouter.post('/webhooks', express.raw({ type: 'application/json' }), webhooks);
stripeRouter.get('/create-billing-portal-session', createBillingPortalSession);
stripeRouter.post('/create-credit-checkout-session', middleware.auth, createCreditCheckoutSession);

module.exports = stripeRouter;
