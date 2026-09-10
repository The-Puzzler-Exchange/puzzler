const validateAddress = require('./address/validate');
const shipments = require('./shipments');
const rates = require('./rates');
const transactions = require('./transactions');

const shippo = {
  validateAddress,
  shipments,
  rates,
  transactions,
};

module.exports = shippo;
