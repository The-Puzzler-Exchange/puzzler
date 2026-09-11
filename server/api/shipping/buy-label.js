const { getIntegrationSdk, handleError } = require('../../api-util/sdk');
const { denormalisedResponseEntities } = require('../../api-util/data');
const buyLabelForExchange = require('../../services/shippo/buyLabelForExchange');
const log = require('../../log');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/shipping/buy-label
 *
 * Body: { transactionId }
 * Buys a Shippo label after the exchange is confirmed, or retries if the label is missing.
 * Customer (checkout) and provider (retry) may call this.
 */
module.exports = async (req, res) => {
  const { transactionId } = req.body || {};
  if (!transactionId || !UUID_REGEX.test(transactionId)) {
    return res.status(400).json({ error: 'A valid transactionId is required' });
  }

  try {
    const integrationSdk = getIntegrationSdk();
    const response = await integrationSdk.transactions.show({
      id: transactionId,
      include: ['customer', 'provider'],
    });
    const [transaction] = denormalisedResponseEntities(response);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const customerId = transaction.customer?.id?.uuid;
    const providerId = transaction.provider?.id?.uuid;
    if (req.tokenUserId !== customerId && req.tokenUserId !== providerId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const existingLabel = transaction.attributes?.metadata?.shippingDetails?.labelUrl;
    if (existingLabel) {
      return res.status(200).json({ shippingDetails: transaction.attributes.metadata.shippingDetails });
    }

    const rateId = transaction.attributes?.protectedData?.shippingRateId;
    if (!rateId) {
      return res.status(400).json({ error: 'Missing shippingRateId on the exchange' });
    }

    const shippoTransaction = await buyLabelForExchange(rateId, transactionId);
    if (!shippoTransaction || shippoTransaction.status !== 'SUCCESS') {
      return res.status(502).json({ error: 'Failed to buy the shipping label' });
    }

    return res.status(200).json({
      shippingDetails: {
        transactionId: shippoTransaction.objectId,
        trackingNumber: shippoTransaction.trackingNumber,
        trackingUrl: shippoTransaction.trackingUrlProvider,
        labelUrl: shippoTransaction.labelUrl,
      },
    });
  } catch (error) {
    log.error(error, 'buy-shipping-label-failed', {
      userId: req.tokenUserId,
      transactionId,
    });
    return handleError(res, error);
  }
};
