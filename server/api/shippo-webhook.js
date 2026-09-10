const log = require('../log');
const { getIntegrationSdk } = require('../api-util/sdk');
const shippoInstance = require('../services/shippo/instance');

const integrationSdk = getIntegrationSdk();

const CONFIRM_PAYMENT = 'transition/confirm-payment';
const MARK_DELIVERED = 'transition/mark-delivered';
const OPERATOR_MARK_DELIVERED = 'transition/operator-mark-delivered';
const OPERATOR_MARK_RECEIVED = 'transition/operator-mark-received';
const MARK_RECEIVED_FROM_PURCHASED = 'transition/mark-received-from-purchased';

const registerWebhook = async () => {
  try {
    const rootUrl = process.env.WEBHOOK_ORIGIN || process.env.REACT_APP_MARKETPLACE_ROOT_URL;
    if (!rootUrl) {
      log.error(
        new Error('WEBHOOK_ORIGIN or REACT_APP_MARKETPLACE_ROOT_URL not set'),
        'shippo-webhook-config'
      );
      return;
    }

    const webhookUrl = `${rootUrl}/api/shippo-webhook`;
    const apiKey = process.env.SHIPPO_API_KEY_HEADER || '';
    const isTestMode = apiKey.toLowerCase().includes('test');

    const existingWebhooks = await shippoInstance.webhooks.listWebhooks();
    const existingWebhook = existingWebhooks.results?.find(
      webhook => webhook.url === webhookUrl && webhook.event === 'track_updated'
    );

    if (existingWebhook && existingWebhook.active) {
      return;
    }

    await shippoInstance.webhooks.createWebhook({
      event: 'track_updated',
      url: webhookUrl,
      active: true,
      isTest: isTestMode,
    });
  } catch (error) {
    log.error(error, 'shippo-webhook-registration-failed');
  }
};

registerWebhook().catch(err => {
  log.error(err, 'shippo-webhook-registration-failed');
});

const findTransactionByTrackingNumber = async trackingNumber => {
  try {
    const response = await integrationSdk.transactions.query({
      meta_shippingTrackingNumber: trackingNumber,
      include: ['customer', 'provider'],
    });
    if (response.data?.data?.length > 0) {
      return response.data.data[0];
    }
    return null;
  } catch (error) {
    log.error(error, 'find-transaction-by-tracking-number-failed', { trackingNumber });
    return null;
  }
};

const updateTransactionTracking = async (transaction, trackData) => {
  const transactionId = transaction.id.uuid;
  const currentMetadata = transaction.attributes.metadata || {};
  const currentShippingDetails = currentMetadata.shippingDetails || {};

  const trackingStatus = trackData.tracking_status?.status || 'UNKNOWN';
  const trackingSubstatus = trackData.tracking_status?.substatus || null;
  const lastTrackingUpdateMs = trackData.tracking_status?.status_date
    ? new Date(trackData.tracking_status.status_date).getTime()
    : Date.now();

  const historyEntry = {
    status: trackingStatus,
    substatus: trackingSubstatus,
    timestampMs: lastTrackingUpdateMs,
    location: trackData.tracking_status?.location || null,
    statusDetails: trackData.tracking_status?.status_details || null,
  };

  const existingHistory = currentShippingDetails.trackingHistory || [];
  const trackingHistory = [...existingHistory, historyEntry];

  await integrationSdk.transactions.updateMetadata({
    id: transactionId,
    metadata: {
      ...currentMetadata,
      shippingDetails: {
        ...currentShippingDetails,
        trackingStatus,
        trackingSubstatus,
        lastTrackingUpdateMs,
        trackingHistory,
        carrier: trackData.carrier,
        eta: trackData.eta || null,
        originalEta: trackData.original_eta || null,
      },
    },
  });
};

const transitionExchange = async (transactionId, transition) => {
  return integrationSdk.transactions.transition({
    id: transactionId,
    transition,
    params: {},
  });
};

const autoTransitionTransaction = async (transaction, trackingStatus) => {
  const transactionId = transaction.id.uuid;
  const lastTransition = transaction.attributes.lastTransition;
  const inPurchased = lastTransition === CONFIRM_PAYMENT;
  const inDelivered =
    lastTransition === OPERATOR_MARK_DELIVERED || lastTransition === MARK_DELIVERED;

  try {
    if (trackingStatus === 'TRANSIT' && inPurchased) {
      await transitionExchange(transactionId, OPERATOR_MARK_DELIVERED);
      return OPERATOR_MARK_DELIVERED;
    }

    if (trackingStatus === 'DELIVERED') {
      if (inPurchased) {
        try {
          await transitionExchange(transactionId, OPERATOR_MARK_DELIVERED);
          await transitionExchange(transactionId, OPERATOR_MARK_RECEIVED);
        } catch (error) {
          await transitionExchange(transactionId, MARK_RECEIVED_FROM_PURCHASED);
        }
        return OPERATOR_MARK_RECEIVED;
      }
      if (inDelivered) {
        await transitionExchange(transactionId, OPERATOR_MARK_RECEIVED);
        return OPERATOR_MARK_RECEIVED;
      }
    }
  } catch (error) {
    log.error(error, 'auto-transition-failed', {
      transactionId,
      trackingStatus,
      lastTransition,
    });
  }
  return null;
};

const processTrackingUpdate = async webhookPayload => {
  const { event, test, data } = webhookPayload;

  if (test) {
    return { success: true, test: true };
  }
  if (event !== 'track_updated') {
    return { success: false, error: 'Unsupported event type' };
  }
  if (!data || !data.tracking_number) {
    return { success: false, error: 'Missing tracking number' };
  }

  const transaction = await findTransactionByTrackingNumber(data.tracking_number);
  if (!transaction) {
    return { success: false, error: 'Transaction not found' };
  }

  await updateTransactionTracking(transaction, data);
  const trackingStatus = data.tracking_status?.status;
  await autoTransitionTransaction(transaction, trackingStatus);

  return {
    success: true,
    transactionId: transaction.id.uuid,
    trackingNumber: data.tracking_number,
    status: trackingStatus,
  };
};

const handleShippoWebhook = async (req, res) => {
  try {
    const result = await processTrackingUpdate(req.body);
    if (result.success) {
      return res.status(200).json({ received: true });
    }
    return res.status(400).json({ error: result.error });
  } catch (error) {
    log.error(error, 'shippo-webhook-handler-failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = handleShippoWebhook;
