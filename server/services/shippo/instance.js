const { Shippo } = require('shippo');
const config = require('../../config');

const shippo = new Shippo({
  apiKeyHeader: config.shippo.key,
  shippoApiVersion: config.shippo.version,
});

module.exports = shippo;
