const stripe = require('../stripe/client');
const { handleError } = require('../../api-util/sdk');
const log = require('../../log');

/**
 * POST /api/shipping/refund-payment-intent
 *
 * Body: { paymentIntentId }
 * Refunds a platform shipping charge after the exchange fails to complete.
 */
module.exports = async (req, res) => {
  const { paymentIntentId } = req.body || {};
  if (!paymentIntentId || typeof paymentIntentId !== 'string') {
    return res.status(400).json({ error: 'paymentIntentId is required' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.metadata?.marketplaceUserId !== req.tokenUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (paymentIntent.status === 'succeeded') {
      await stripe.refunds.create({ payment_intent: paymentIntentId });
    } else if (['requires_capture', 'requires_confirmation', 'requires_payment_method'].includes(paymentIntent.status)) {
      await stripe.paymentIntents.cancel(paymentIntentId);
    }

    return res.status(200).json({ refunded: true });
  } catch (error) {
    log.error(error, 'refund-shipping-payment-intent-failed', {
      userId: req.tokenUserId,
      paymentIntentId,
    });
    return handleError(res, error);
  }
};
