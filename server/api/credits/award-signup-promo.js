const log = require('../../log');
const { awardSignupPromo } = require('./credits');

/**
 * POST /api/credits/signup-promo
 *
 * Awards the signup promo credit to the authenticated user. The endpoint is
 * idempotent: if the user has already received the promo, the balance is left
 * untouched and 'awarded' is false in the response.
 */
module.exports = async (req, res) => {
  try {
    const result = await awardSignupPromo(req.tokenUserId);
    return res.status(200).json(result);
  } catch (e) {
    log.error(e, 'award-signup-promo-failed', { userId: req.tokenUserId });
    return res.status(500).json({ error: 'Failed to award the signup promo credit' });
  }
};
