require('./../env').configureEnv();

const shippo = {
  key: process.env.SHIPPO_API_KEY_HEADER,
  version: process.env.SHIPPO_API_VERSION,
};

module.exports = { shippo };
