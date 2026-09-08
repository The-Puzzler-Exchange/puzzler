const log = require('../../log');
const { fetchCredits } = require('./credits');

/**
 * GET /api/credits
 *
 * Responds with the credit balance and the credit history of the authenticated user.
 */
module.exports = async (req, res) => {
  try {
    const credits = await fetchCredits(req.tokenUserId);
    return res.status(200).json(credits);
  } catch (e) {
    log.error(e, 'fetch-credits-failed', { userId: req.tokenUserId });
    return res.status(500).json({ error: 'Failed to fetch credits' });
  }
};
