const { getSdk } = require('../../api-util/sdk');
const { denormalisedResponseEntities } = require('../../api-util/data');
const log = require('../../log');
const stripe = require('./client');

const RETURN_URL = `${process.env.REACT_APP_MARKETPLACE_ROOT_URL}/account/manage-subscription`;

/**
 * GET /api/stripe/create-billing-portal-session
 *
 * Creates a Stripe Billing Portal session for the authenticated user. The Stripe
 * customer id is stored to the user's metadata when the subscription is created
 * (see ./membership.js). Responds with the URL that the member is redirected to
 * in order to update or cancel their subscription.
 */
module.exports = async (req, res) => {
  const sdk = getSdk(req, res);

  let currentUser;
  try {
    const response = await sdk.currentUser.show();
    currentUser = denormalisedResponseEntities(response)[0];
  } catch (e) {
    return res
      .status(401)
      .json({ error: 'Not authenticated' })
      .end();
  }

  const stripeCustomerId = currentUser?.attributes?.profile?.metadata?.stripeCustomerId;
  if (!stripeCustomerId) {
    return res
      .status(400)
      .json({ error: 'No Stripe customer found for this user' })
      .end();
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: RETURN_URL,
    });

    return res
      .status(200)
      .json({ url: session.url })
      .end();
  } catch (e) {
    log.error(e, 'stripe-create-billing-portal-session-failed');
    return res
      .status(500)
      .json({ error: e.message })
      .end();
  }
};
