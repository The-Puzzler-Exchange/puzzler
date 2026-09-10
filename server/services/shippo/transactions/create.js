const shippoInstance = require('../instance');

const create = async body => {
  return shippoInstance.transactions.create(body);
};

module.exports = create;
