const stripe = require('../stripe/client');
const { getTrustedSdk, handleError } = require('../../api-util/sdk');
const { denormalisedResponseEntities } = require('../../api-util/data');
const { ShippoServices } = require('../../services');
const { applyShippingMarkup, listedAmountToCents } = require('../../api-util/shippingMarkup');
const log = require('../../log');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/shipping/create-payment-intent
 *
 * Body: { listingId, shippingRateId, shipmentId }
 * Creates a platform PaymentIntent for the listed (marked-up) Shippo rate.
 */
module.exports = async (req, res) => {
  const { listingId, shippingRateId, shipmentId } = req.body || {};

  if (!listingId || !UUID_REGEX.test(listingId) || !shippingRateId || !shipmentId) {
    return res.status(400).json({ error: 'listingId, shippingRateId, and shipmentId are required' });
  }

  try {
    const trustedSdk = await getTrustedSdk(req, res);
    const listingResponse = await trustedSdk.listings.show({ id: listingId });
    const [listing] = denormalisedResponseEntities(listingResponse);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const rate = await ShippoServices.rates.get(shippingRateId);
    if (!rate || (rate.shipment && rate.shipment !== shipmentId && rate.shipmentId !== shipmentId)) {
      // Some SDK versions put shipment on the rate as shipment or nested object
      const rateShipmentId = rate?.shipment?.objectId || rate?.shipment || rate?.shipmentId;
      if (rateShipmentId && rateShipmentId !== shipmentId) {
        return res.status(400).json({ error: 'Shipping rate does not match the shipment' });
      }
    }

    const rawAmount = Number(rate.amountLocal || rate.amount);
    const listedAmount = applyShippingMarkup(rawAmount);
    const amountCents = listedAmountToCents(listedAmount);
    const currency = (rate.currencyLocal || rate.currency || listing.attributes.price?.currency || 'USD').toLowerCase();

    if (!amountCents || amountCents < 50) {
      return res.status(400).json({ error: 'Shipping amount is too small to charge' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        marketplaceUserId: req.tokenUserId,
        listingId,
        shippingRateId,
        shipmentId,
        listedAmount: String(listedAmount),
      },
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountCents,
      listedAmount,
      currency: currency.toUpperCase(),
    });
  } catch (error) {
    log.error(error, 'create-shipping-payment-intent-failed', { userId: req.tokenUserId });
    return handleError(res, error);
  }
};
