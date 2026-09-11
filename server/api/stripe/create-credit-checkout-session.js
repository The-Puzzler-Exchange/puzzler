const { CREDIT_PURCHASE_TYPE } = require('./credit-purchase');
const log = require('../../log');
const stripe = require('./client');

const ROOT_URL = process.env.REACT_APP_MARKETPLACE_ROOT_URL;
const CREDITS_PATH = '/account/manage-credits';

// The price of a single credit. Keep in sync with the price shown in the web app,
// which reads the same environment variable.
const CREDIT_PRICE_IN_SUBUNITS = Number(process.env.REACT_APP_CREDIT_PRICE_IN_SUBUNITS) || 1599;
const CREDIT_CURRENCY = (process.env.REACT_APP_CREDIT_CURRENCY || 'USD').toLowerCase();

/**
 * POST /api/stripe/create-credit-checkout-session
 *
 * Creates a Stripe Checkout session for buying a single credit. Responds with the URL
 * that the member is redirected to. The credit itself is awarded by the webhook handler
 * (see ./credit-purchase.js) once Stripe reports the session as paid.
 */
module.exports = async (req, res) => {
  const userId = req.tokenUserId;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: CREDIT_CURRENCY,
            unit_amount: CREDIT_PRICE_IN_SUBUNITS,
            product_data: {
              name: '1 exchange credit',
              description: 'One credit pays for one puzzle exchange.',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${ROOT_URL}${CREDITS_PATH}?purchase=success`,
      cancel_url: `${ROOT_URL}${CREDITS_PATH}?purchase=canceled`,
      // The webhook handler uses these to award the credits to the right member.
      client_reference_id: userId,
      customer_email: req.email,
      metadata: {
        type: CREDIT_PURCHASE_TYPE,
        credits: '1',
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    log.error(e, 'stripe-create-credit-checkout-session-failed', { userId });
    return res.status(500).json({ error: 'Failed to create the checkout session' });
  }
};
