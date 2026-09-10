const shippoInstance = require('../instance');

/**
 * Validate an address with Shippo by creating it with validate: true.
 *
 * @param {Object} address Shippo address fields
 * @returns {Promise<Object>} Shippo address response
 */
const validate = async address => {
  if (!address || typeof address !== 'object') {
    const error = new Error('address object is required');
    error.status = 400;
    throw error;
  }

  const body = { ...address, validate: true };
  return shippoInstance.addresses.create(body);
};

module.exports = validate;
