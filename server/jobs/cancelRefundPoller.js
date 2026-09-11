const { getFirestore, FieldValue } = require('../api-util/firebase');
const { getIntegrationSdk } = require('../api-util/sdk');
const { denormalisedResponseEntities } = require('../api-util/data');
const { returnCreditForExchange } = require('../api/credits/credits');
const stripe = require('../api/stripe/client');
const refundUnusedLabel = require('../services/shippo/refundUnusedLabel');
const log = require('../log');

const JOB_COLLECTION = 'jobs';
const JOB_DOC = 'cancel-refunds';
const POLL_MS = 60 * 1000;
const CANCEL_TRANSITIONS = new Set(['transition/cancel', 'transition/auto-cancel']);

let started = false;

const jobRef = () =>
  getFirestore()
    .collection(JOB_COLLECTION)
    .doc(JOB_DOC);

const refundStripePaymentIntent = async paymentIntentId => {
  if (!paymentIntentId) {
    return;
  }
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status === 'succeeded') {
    await stripe.refunds.create({ payment_intent: paymentIntentId });
  }
};

const processCanceledExchange = async transaction => {
  const transactionId = transaction.id.uuid;
  const customerId =
    transaction.customer?.id?.uuid || transaction.relationships?.customer?.data?.id?.uuid;
  const protectedData = transaction.attributes.protectedData || {};
  const metadata = transaction.attributes.metadata || {};
  const shippoTransactionId = metadata.shippingDetails?.transactionId;
  const paymentIntentId = protectedData.stripePaymentIntentId;
  const trackingStatus = (metadata.shippingDetails?.trackingStatus || '').toUpperCase();

  // After the parcel is in transit or delivered, cancel must not return funds.
  if (trackingStatus === 'TRANSIT' || trackingStatus === 'DELIVERED') {
    return;
  }

  if (customerId) {
    await returnCreditForExchange(customerId, transactionId);
  }
  try {
    await refundStripePaymentIntent(paymentIntentId);
  } catch (error) {
    log.error(error, 'cancel-refund-stripe-failed', { transactionId, paymentIntentId });
  }
  await refundUnusedLabel(shippoTransactionId);
};

const pollCanceledExchanges = async () => {
  const integrationSdk = getIntegrationSdk();
  const doc = await jobRef().get();
  const afterSequenceId = doc.exists ? doc.data().lastSequenceId : undefined;

  const response = await integrationSdk.events.query({
    eventTypes: 'transaction/transitioned',
    ...(afterSequenceId ? { afterSequenceId } : {}),
  });

  const events = response.data?.data || [];
  let lastSequenceId = afterSequenceId;

  for (const event of events) {
    const sequenceId = event.attributes?.sequenceId;
    if (sequenceId) {
      lastSequenceId = sequenceId;
    }
    const lastTransition = event.attributes?.resource?.attributes?.lastTransition;
    if (!CANCEL_TRANSITIONS.has(lastTransition)) {
      continue;
    }
    const transactionId =
      event.attributes?.resourceId?.uuid || event.attributes?.resource?.id?.uuid;
    if (!transactionId) {
      continue;
    }
    try {
      const txResponse = await integrationSdk.transactions.show({
        id: transactionId,
        include: ['customer'],
      });
      const [transaction] = denormalisedResponseEntities(txResponse);
      if (transaction) {
        await processCanceledExchange(transaction);
      }
    } catch (error) {
      log.error(error, 'cancel-refund-process-failed', { transactionId });
    }
  }

  if (lastSequenceId && lastSequenceId !== afterSequenceId) {
    await jobRef().set(
      { lastSequenceId, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }
};

const startCancelRefundPoller = () => {
  if (started) {
    return;
  }
  started = true;
  const run = () => {
    pollCanceledExchanges().catch(error => {
      log.error(error, 'cancel-refund-poll-failed');
    });
  };
  run();
  setInterval(run, POLL_MS);
};

module.exports = { startCancelRefundPoller, pollCanceledExchanges };
