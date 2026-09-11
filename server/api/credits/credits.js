/**
 * Credits are stored in Firestore:
 *
 *   credits/{userId}                  { balance, updatedAt }
 *   credits/{userId}/entries/{entryId} { amount, type, description, createdAt, transactionId?, customerId? }
 *
 * Every change to the balance is written as an entry in the same transaction, so
 * the balance and its history cannot drift apart. Entries use a deterministic id,
 * which makes writing them idempotent: the same entry is never applied twice.
 * Promotions are keyed by the promotion, customer spends and provider earns
 * by the transaction they belong to.
 */
const { getFirestore, FieldValue } = require('../../api-util/firebase');

const CREDITS_COLLECTION = 'credits';
const ENTRIES_COLLECTION = 'entries';

// The number of history entries returned to the account page.
const ENTRIES_LIMIT = 100;

const SIGNUP_PROMO_AMOUNT = 1;
const EXCHANGE_CREDIT_COST = 1;

const userCreditsRef = userId =>
  getFirestore()
    .collection(CREDITS_COLLECTION)
    .doc(userId);

const serializeEntry = doc => {
  const { amount, type, description, createdAt, transactionId, customerId } = doc.data();
  return {
    id: doc.id,
    amount,
    type,
    description,
    transactionId: transactionId || null,
    customerId: customerId || null,
    // Firestore timestamps are serialized to milliseconds for the web app.
    createdAt: createdAt ? createdAt.toMillis() : null,
  };
};

/**
 * Get the credit balance and the credit history of the given user.
 *
 * @param {string} userId Marketplace user id
 * @returns {Promise<Object>} { balance, entries }
 */
const fetchCredits = async userId => {
  const creditsRef = userCreditsRef(userId);
  const [creditsDoc, entriesSnapshot] = await Promise.all([
    creditsRef.get(),
    creditsRef
      .collection(ENTRIES_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(ENTRIES_LIMIT)
      .get(),
  ]);

  return {
    balance: creditsDoc.exists ? creditsDoc.data().balance || 0 : 0,
    entries: entriesSnapshot.docs.map(serializeEntry),
  };
};

/**
 * Apply a credit entry to the given user's balance. Writing the entry and updating the
 * balance happen in the same Firestore transaction, and the deterministic entry id makes
 * the call idempotent: an entry that already exists is never applied again.
 *
 * @param {string} userId Marketplace user id
 * @param {Object} entry { entryId, amount, type, description, ...extraFields }
 * @param {boolean} [requireSufficientBalance] Refuse to apply the entry if it would take
 *   the balance below zero
 * @returns {Promise<Object>} { applied, balance, alreadyApplied?, insufficientCredits? }
 */
const applyCreditEntry = async (userId, entry, requireSufficientBalance = false) => {
  const { entryId, amount, ...entryData } = entry;
  const firestore = getFirestore();
  const creditsRef = userCreditsRef(userId);
  const entryRef = creditsRef.collection(ENTRIES_COLLECTION).doc(entryId);

  return firestore.runTransaction(async transaction => {
    // Firestore transactions require all the reads to happen before any write.
    const [entryDoc, creditsDoc] = await Promise.all([
      transaction.get(entryRef),
      transaction.get(creditsRef),
    ]);
    const balance = creditsDoc.exists ? creditsDoc.data().balance || 0 : 0;

    if (entryDoc.exists) {
      return { applied: false, alreadyApplied: true, balance };
    }

    const newBalance = balance + amount;
    if (requireSufficientBalance && newBalance < 0) {
      return { applied: false, insufficientCredits: true, balance };
    }

    transaction.set(
      creditsRef,
      { balance: newBalance, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    transaction.set(entryRef, {
      ...entryData,
      amount,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { applied: true, balance: newBalance };
  });
};

/**
 * Award the signup promo credit. Awarding it more than once is a no-op.
 *
 * @param {string} userId Marketplace user id
 * @returns {Promise<Object>} { awarded, balance }
 */
const awardSignupPromo = async userId => {
  const result = await applyCreditEntry(userId, {
    entryId: 'signup-promo',
    amount: SIGNUP_PROMO_AMOUNT,
    type: 'signupPromo',
    description: 'Signup promo',
  });

  return { awarded: result.applied, balance: result.balance };
};

/**
 * Spend the credit that pays for an exchange. The entry is keyed by the transaction, so
 * retries and double submits of the same order never deduct the credit twice.
 *
 * @param {string} userId Marketplace user id
 * @param {string} transactionId Marketplace transaction id
 * @returns {Promise<Object>} { spent, balance, alreadySpent, insufficientCredits }
 */
const spendCreditForExchange = async (userId, transactionId) => {
  const result = await applyCreditEntry(
    userId,
    {
      entryId: `exchange-${transactionId}`,
      amount: -EXCHANGE_CREDIT_COST,
      type: 'exchange',
      description: 'Puzzle exchange',
      transactionId,
    },
    true
  );

  return {
    spent: result.applied,
    balance: result.balance,
    alreadySpent: !!result.alreadyApplied,
    insufficientCredits: !!result.insufficientCredits,
  };
};

/**
 * Return the credit spent on an exchange. Keyed so cancel retries never credit twice.
 *
 * @param {string} userId Marketplace user id
 * @param {string} transactionId Marketplace transaction id
 * @returns {Promise<Object>} { returned, balance, alreadyReturned }
 */
const returnCreditForExchange = async (userId, transactionId) => {
  const result = await applyCreditEntry(userId, {
    entryId: `exchange-refund-${transactionId}`,
    amount: EXCHANGE_CREDIT_COST,
    type: 'exchangeRefund',
    description: 'Puzzle exchange refund',
    transactionId,
  });

  return {
    returned: result.applied,
    balance: result.balance,
    alreadyReturned: !!result.alreadyApplied,
  };
};

/**
 * Award the credit the provider earns when an exchange auto-completes. Keyed by the
 * transaction so poller retries never credit twice. Stores the customer id on the
 * entry so the earn can be traced later.
 *
 * @param {string} providerId Marketplace user id of the provider
 * @param {string} transactionId Marketplace transaction id
 * @param {string} [customerId] Marketplace user id of the customer
 * @returns {Promise<Object>} { awarded, balance, alreadyAwarded }
 */
const awardCreditForCompletedExchange = async (providerId, transactionId, customerId) => {
  const result = await applyCreditEntry(providerId, {
    entryId: `exchange-earned-${transactionId}`,
    amount: EXCHANGE_CREDIT_COST,
    type: 'exchangeEarned',
    description: 'Puzzle exchange completed',
    transactionId,
    ...(customerId ? { customerId } : {}),
  });

  return {
    awarded: result.applied,
    balance: result.balance,
    alreadyAwarded: !!result.alreadyApplied,
  };
};

/**
 * Award credits that the member has paid for. The entry is keyed by the Stripe checkout
 * session, so a redelivered webhook never awards the same purchase twice.
 *
 * @param {string} userId Marketplace user id
 * @param {string} checkoutSessionId Stripe checkout session id
 * @param {number} [quantity] Number of credits bought
 * @returns {Promise<Object>} { awarded, balance, alreadyAwarded }
 */
const awardPurchasedCredits = async (userId, checkoutSessionId, quantity = 1) => {
  const result = await applyCreditEntry(userId, {
    entryId: `purchase-${checkoutSessionId}`,
    amount: quantity,
    type: 'purchase',
    description: 'Credit purchase',
    checkoutSessionId,
  });

  return {
    awarded: result.applied,
    balance: result.balance,
    alreadyAwarded: !!result.alreadyApplied,
  };
};

module.exports = {
  fetchCredits,
  awardSignupPromo,
  spendCreditForExchange,
  returnCreditForExchange,
  awardCreditForCompletedExchange,
  awardPurchasedCredits,
};
