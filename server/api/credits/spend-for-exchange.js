const log = require('../../log');
const { spendCreditForExchange } = require('./credits');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/credits/spend-for-exchange
 *
 * Body params:
 *   transactionId {string} - id of the transaction the credit pays for
 *
 * Deducts the credit that pays for an exchange from the authenticated user. The entry is
 * keyed by the transaction, so calling this more than once for the same transaction does
 * not deduct the credit again.
 *
 * Responds with 402 if the member doesn't have enough credits.
 */
module.exports = async (req, res) => {
  const { transactionId } = req.body || {};

  if (!transactionId || !UUID_REGEX.test(transactionId)) {
    return res.status(400).json({ error: 'A valid transactionId is required' });
  }

  try {
    const result = await spendCreditForExchange(req.tokenUserId, transactionId);

    if (result.insufficientCredits) {
      return res.status(402).json({ error: 'Not enough credits', ...result });
    }

    return res.status(200).json(result);
  } catch (e) {
    log.error(e, 'spend-credit-for-exchange-failed', {
      userId: req.tokenUserId,
      transactionId,
    });
    return res.status(500).json({ error: 'Failed to spend the credit' });
  }
};
