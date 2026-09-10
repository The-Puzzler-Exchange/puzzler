const shippo = require('../instance');

const listShipmentRatesByCurrencyCode = async ({ shipmentId, currencyCode }) => {
  return shippo.rates.listShipmentRatesByCurrencyCode({
    shipmentId,
    currencyCode,
  });
};

module.exports = listShipmentRatesByCurrencyCode;
