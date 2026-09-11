const { getIntegrationSdk } = require('../../api-util/sdk');

const integrationSdk = getIntegrationSdk();

const updateMetadata = async (transactionId, metadata) => {
  return integrationSdk.transactions.updateMetadata({
    id: transactionId,
    metadata,
  });
};

module.exports = updateMetadata;
