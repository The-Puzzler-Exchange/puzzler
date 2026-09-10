const DEFAULT_MARKUP_PERCENT = 3.5;

/**
 * Markup percent from env. The PO can change SHIPPING_RATE_MARKUP_PERCENT later.
 *
 * @returns {number}
 */
const getShippingMarkupPercent = () => {
  const raw = process.env.SHIPPING_RATE_MARKUP_PERCENT;
  const parsed = raw == null || raw === '' ? DEFAULT_MARKUP_PERCENT : Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_MARKUP_PERCENT;
};

/**
 * Listed rate in major currency units (dollars), rounded to cents.
 * Do not write this amount back onto the Shippo rate object as amount.
 *
 * @param {number|string} shippoAmount Raw Shippo amount in major units
 * @returns {number}
 */
const applyShippingMarkup = shippoAmount => {
  const raw = Number(shippoAmount);
  if (!Number.isFinite(raw) || raw < 0) {
    throw new Error('Invalid Shippo amount');
  }
  const listed = raw * (1 + getShippingMarkupPercent() / 100);
  return Math.round(listed * 100) / 100;
};

/**
 * Convert a listed major-unit amount to Stripe cents.
 *
 * @param {number} listedAmount
 * @returns {number}
 */
const listedAmountToCents = listedAmount => Math.round(Number(listedAmount) * 100);

module.exports = {
  DEFAULT_MARKUP_PERCENT,
  getShippingMarkupPercent,
  applyShippingMarkup,
  listedAmountToCents,
};
