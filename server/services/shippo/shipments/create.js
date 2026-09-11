const shippoInstance = require('../instance');

const create = async shipment => {
  return shippoInstance.shipments.create(shipment);
};

module.exports = create;
