const log = require('../../log');
const { ShippoServices } = require('../../services');
const updateTransactionMetadata = require('../transactions/updateMetadata');

/**
 * Buy a Shippo label for a Sharetribe exchange and store it on metadata.
 *
 * @param {string} rateId Raw Shippo rate object id
 * @param {string} transactionId Sharetribe transaction uuid
 * @returns {Promise<Object|null>} Shippo transaction or null on failure
 */
const buyLabelForExchange = async (rateId, transactionId) => {
  try {
    const shippoTransaction = await ShippoServices.transactions.create({
      rate: rateId,
      metadata: `Sharetribe Transaction ID #${transactionId}`,
      async: false,
    });

    if (shippoTransaction.status !== 'SUCCESS') {
      log.error(
        new Error(`Shippo transaction status ${shippoTransaction.status}`),
        'shippo-transaction-not-success',
        {
          shippoTransactionId: shippoTransaction.objectId,
          rateId,
          transactionId,
          messages: shippoTransaction.messages,
        }
      );
      return shippoTransaction;
    }

    await updateTransactionMetadata(transactionId, {
      shippingDetails: {
        transactionId: shippoTransaction.objectId,
        trackingNumber: shippoTransaction.trackingNumber,
        trackingUrl: shippoTransaction.trackingUrlProvider,
        labelUrl: shippoTransaction.labelUrl,
      },
      shippingTrackingNumber: shippoTransaction.trackingNumber,
    });
    return shippoTransaction;
  } catch (error) {
    log.error(error, 'buy-label-for-exchange-failed', { rateId, transactionId });
    return null;
  }
};

module.exports = buyLabelForExchange;
