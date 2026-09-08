/**
 * Credits are stored in Firestore:
 *
 *   credits/{userId}                  { balance, updatedAt }
 *   credits/{userId}/entries/{entryId} { amount, type, description, createdAt }
 *
 * Every change to the balance is written as an entry in the same transaction, so
 * the balance and its history cannot drift apart. Promotions use a deterministic
 * entry id, which makes awarding them idempotent: awarding the same entry twice
 * is a no-op.
 */
const { getFirestore, FieldValue } = require('../../api-util/firebase');

const CREDITS_COLLECTION = 'credits';
const ENTRIES_COLLECTION = 'entries';

// The number of history entries returned to the account page.
const ENTRIES_LIMIT = 100;

const SIGNUP_PROMO = {
  entryId: 'signup-promo',
  amount: 1,
  type: 'signupPromo',
  description: 'Signup promo',
};

const userCreditsRef = userId =>
  getFirestore()
    .collection(CREDITS_COLLECTION)
    .doc(userId);

const serializeEntry = doc => {
  const { amount, type, description, createdAt } = doc.data();
  return {
    id: doc.id,
    amount,
    type,
    description,
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
 * Award credits to the given user. The entry id makes this idempotent: if the
 * entry already exists, the balance is left untouched.
 *
 * @param {string} userId Marketplace user id
 * @param {Object} entry { entryId, amount, type, description }
 * @returns {Promise<Object>} { awarded, balance }
 */
const awardCredits = async (userId, { entryId, amount, type, description }) => {
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
      return { awarded: false, balance };
    }

    const newBalance = balance + amount;
    transaction.set(
      creditsRef,
      { balance: newBalance, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    transaction.set(entryRef, {
      amount,
      type,
      description,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { awarded: true, balance: newBalance };
  });
};

/**
 * Award the signup promo credit. Awarding it more than once is a no-op.
 *
 * @param {string} userId Marketplace user id
 * @returns {Promise<Object>} { awarded, balance }
 */
const awardSignupPromo = userId => awardCredits(userId, SIGNUP_PROMO);

module.exports = {
  fetchCredits,
  awardCredits,
  awardSignupPromo,
};
