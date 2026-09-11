/**
 * Buying credits with a Stripe Checkout session.
 *
 * The marketplace user id is passed to Stripe as the client_reference_id of the session,
 * and the credits are awarded when Stripe reports the session as completed and paid.
 */
const { awardPurchasedCredits } = require('../credits/credits');
const log = require('../../log');

// Marks the checkout sessions that this module is responsible for.
const CREDIT_PURCHASE_TYPE = 'creditPurchase';

/**
 * Award the bought credits once the checkout session has been completed. Sessions that
 * are not credit purchases are ignored, and so are sessions that have not been paid:
 * delayed payment methods complete the session before the money has arrived.
 *
 * @param {Object} session Stripe checkout session object
 * @returns {Promise}
 */
const handleCreditPurchaseCompleted = async session => {
  const { id, client_reference_id: userId, metadata, mode, payment_status } = session;

  if (mode !== 'payment' || metadata?.type !== CREDIT_PURCHASE_TYPE) {
    return;
  }

  if (payment_status !== 'paid') {
    log.error(
      new Error('Credit purchase completed without being paid'),
      'stripe-credit-purchase-unpaid',
      { sessionId: id, paymentStatus: payment_status }
    );
    return;
  }

  if (!userId) {
    log.error(
      new Error('Credit purchase is missing client_reference_id'),
      'stripe-credit-purchase-incomplete',
      { sessionId: id }
    );
    return;
  }

  const quantity = Number(metadata?.credits) || 1;
  await awardPurchasedCredits(userId, id, quantity);
};

module.exports = {
  CREDIT_PURCHASE_TYPE,
  handleCreditPurchaseCompleted,
};
