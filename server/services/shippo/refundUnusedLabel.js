const shippoInstance = require('./instance');
const log = require('../../log');

/**
 * Refund an unused Shippo label. No-op when the carrier has already scanned it.
 *
 * @param {string} shippoTransactionId
 * @returns {Promise<boolean>}
 */
const refundUnusedLabel = async shippoTransactionId => {
  if (!shippoTransactionId) {
    return false;
  }
  try {
    await shippoInstance.refunds.create({
      transaction: shippoTransactionId,
      async: false,
    });
    return true;
  } catch (error) {
    log.error(error, 'shippo-unused-label-refund-failed', { shippoTransactionId });
    return false;
  }
};

module.exports = refundUnusedLabel;
