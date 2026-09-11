const log = require('../../log');
const stripe = require('./client');
const { handleCheckoutSessionCompleted, handleSubscriptionChange } = require('./membership');
const { handleCreditPurchaseCompleted } = require('./credit-purchase');

const { STRIPE_WEBHOOK_SECRET } = process.env;

/**
 * POST /api/stripe/webhooks
 *
 * Stripe events that this endpoint expects. Enable exactly these in the Stripe
 * dashboard (Developers > Webhooks):
 *   - checkout.session.completed: a member has subscribed, or bought credits. Links the
 *     Stripe customer to the marketplace user and grants the right to post listings, or
 *     awards the bought credits.
 *   - customer.subscription.updated: the subscription status has changed (e.g. renewal
 *     failed, subscription was cancelled at period end or reactivated).
 *   - customer.subscription.deleted: the subscription has ended. Revokes the rights.
 *
 * NOTE: customer.subscription.created is deliberately not handled. It can be delivered
 * before checkout.session.completed, and it doesn't carry the marketplace user id.
 */
module.exports = async (req, res) => {
  const signature = req.headers['stripe-signature'];

  // Stripe requires the unparsed request body for signature verification.
  // req.rawBody is set by the JSON body parser in server/index.js when CSP is enabled,
  // and req.body is a Buffer when express.raw() (see ./index.js) parses the request.
  const rawBody = req.rawBody || req.body;

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    log.error(e, 'stripe-webhook-signature-verification-failed');
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        // A completed session is either a new subscription or a credit purchase.
        // Each handler ignores the sessions that are not its own.
        await handleCheckoutSessionCompleted(event.data.object);
        await handleCreditPurchaseCompleted(event.data.object);
        break;

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionChange(event.data.object);
        break;

      default:
        // Unhandled event types are acknowledged, so that Stripe stops sending them.
        break;
    }

    return res.status(200).send();
  } catch (e) {
    log.error(e, 'stripe-webhook-handling-failed', { eventType: event.type, eventId: event.id });
    // Stripe retries the delivery when the endpoint responds with an error.
    return res.status(500).send();
  }
};
