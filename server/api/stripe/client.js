/**
 * Shared Stripe client for the marketplace membership subscription.
 *
 * NOTE: STRIPE_SECRET_KEY is a server-side only environment variable. It is set
 * in a hidden file: .env
 */
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = stripe;
