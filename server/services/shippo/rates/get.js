const shippoInstance = require('../instance');

const get = async rateId => {
  return shippoInstance.rates.get(rateId);
};

module.exports = get;
