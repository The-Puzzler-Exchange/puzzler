/**
 * Keeps the marketplace membership in sync with the Stripe subscription.
 *
 * The membership state is stored to the user's metadata (readable by the web app)
 * and the right to post listings is granted and revoked through the user's
 * permission set. The marketplace must deny 'postListings' from new users by
 * default, otherwise members can post listings before they have subscribed.
 */
const { types: sdkTypes } = require('sharetribe-flex-integration-sdk');

const { getIntegrationSdk } = require('../../api-util/sdk');
const { denormalisedResponseEntities } = require('../../api-util/data');
const log = require('../../log');
const stripe = require('./client');

const { UUID } = sdkTypes;

// Sharetribe permission values.
// https://www.sharetribe.com/api-reference/integration.html#update-user-permissions
const PERMISSION_ALLOW = 'permission/allow';
const PERMISSION_DENY = 'permission/deny';

// Stripe subscription statuses that entitle a member to post listings. Every other
// status (past_due, unpaid, canceled, incomplete, incomplete_expired, paused)
// revokes the posting rights.
// https://docs.stripe.com/api/subscriptions/object#subscription_object-status
const ENTITLING_SUBSCRIPTION_STATUSES = ['active', 'trialing'];

/**
 * The end of the current billing period as a Unix timestamp (seconds).
 * NOTE: Since Stripe API version 2025-03-31.basil, the current period is stored on
 * the subscription items instead of the subscription itself.
 *
 * @param {Object} subscription Stripe subscription object
 * @returns {number|null} The end of the current billing period
 */
const currentPeriodEnd = subscription => subscription?.items?.data?.[0]?.current_period_end || null;

/**
 * Find the marketplace user that the given Stripe customer belongs to.
 * The link is created in handleCheckoutSessionCompleted.
 *
 * @param {Object} integrationSdk Integration SDK instance
 * @param {string} stripeCustomerId Stripe customer id
 * @returns {Promise<Object|undefined>} The user entity
 */
const findUserByStripeCustomerId = async (integrationSdk, stripeCustomerId) => {
  const response = await integrationSdk.users.query({ meta_stripeCustomerId: stripeCustomerId });
  const [user] = denormalisedResponseEntities(response);
  return user;
};

/**
 * Store the subscription state to the user's metadata and grant or revoke the
 * right to post listings accordingly.
 *
 * @param {Object} integrationSdk Integration SDK instance
 * @param {UUID} userId Marketplace user id
 * @param {Object} subscription Stripe subscription object
 * @param {string} [stripeCustomerId] Stripe customer id, saved on the first subscription
 * @returns {Promise}
 */
const syncMembership = async (integrationSdk, userId, subscription, stripeCustomerId) => {
  const isSubscriptionActive = ENTITLING_SUBSCRIPTION_STATUSES.includes(subscription.status);
  const stripeCustomerIdMaybe = stripeCustomerId ? { stripeCustomerId } : {};

  await integrationSdk.users.updateProfile({
    id: userId,
    metadata: {
      ...stripeCustomerIdMaybe,
      isSubscriptionActive,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionCurrentPeriodEnd: currentPeriodEnd(subscription),
      subscriptionCancelAtPeriodEnd: !!subscription.cancel_at_period_end,
    },
  });

  await integrationSdk.users.updatePermissions({
    id: userId,
    postListings: isSubscriptionActive ? PERMISSION_ALLOW : PERMISSION_DENY,
  });
};

/**
 * Handle a completed Stripe Checkout session (i.e. a new subscription).
 * This is the only event that knows which marketplace user the Stripe customer
 * belongs to: the user id is passed to Stripe as the client_reference_id of the
 * payment link.
 *
 * @param {Object} session Stripe checkout session object
 * @returns {Promise}
 */
const handleCheckoutSessionCompleted = async session => {
  const { client_reference_id: userId, customer, subscription: subscriptionId, mode } = session;

  if (mode !== 'subscription') {
    // Other payment modes don't affect the membership.
    return;
  }

  if (!userId || !subscriptionId) {
    log.error(
      new Error('Checkout session is missing client_reference_id or subscription'),
      'stripe-checkout-session-incomplete',
      { sessionId: session.id }
    );
    return;
  }

  // The session itself doesn't contain the subscription status, so it is fetched
  // from Stripe. This also keeps delayed payment methods from granting the rights
  // before the subscription is actually active.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const integrationSdk = getIntegrationSdk();

  await syncMembership(integrationSdk, new UUID(userId), subscription, customer);
};

/**
 * Handle a changed or ended Stripe subscription. The user is looked up with the
 * Stripe customer id that was stored when the subscription was created.
 *
 * @param {Object} subscription Stripe subscription object
 * @returns {Promise}
 */
const handleSubscriptionChange = async subscription => {
  const integrationSdk = getIntegrationSdk();
  const user = await findUserByStripeCustomerId(integrationSdk, subscription.customer);

  if (!user) {
    // Retrying doesn't help, if the customer has never subscribed through the marketplace.
    log.error(
      new Error('No marketplace user found for the Stripe customer'),
      'stripe-subscription-user-not-found',
      { stripeCustomerId: subscription.customer, subscriptionId: subscription.id }
    );
    return;
  }

  await syncMembership(integrationSdk, user.id, subscription);
};

module.exports = {
  handleCheckoutSessionCompleted,
  handleSubscriptionChange,
};
