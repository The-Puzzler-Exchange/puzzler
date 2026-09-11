const DEFAULT_MARKUP_PERCENT = 4;

// The payment processing fee has a fixed part (Stripe charges 2.9% + $0.30 per
// transaction), which a percent-only markup can never cover: the smaller the rate, the
// bigger the share the fixed part takes of it.
const DEFAULT_MARKUP_FIXED = 0.4;

const numberFromEnv = (value, fallback) => {
  const parsed = value == null || value === '' ? fallback : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Markup percent from env. The PO can change SHIPPING_RATE_MARKUP_PERCENT later.
 *
 * @returns {number}
 */
const getShippingMarkupPercent = () =>
  numberFromEnv(process.env.SHIPPING_RATE_MARKUP_PERCENT, DEFAULT_MARKUP_PERCENT);

/**
 * Fixed markup in major currency units (dollars) from env.
 * The PO can change SHIPPING_RATE_MARKUP_FIXED later.
 *
 * @returns {number}
 */
const getShippingMarkupFixed = () =>
  numberFromEnv(process.env.SHIPPING_RATE_MARKUP_FIXED, DEFAULT_MARKUP_FIXED);

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
  const listed = raw * (1 + getShippingMarkupPercent() / 100) + getShippingMarkupFixed();
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
  DEFAULT_MARKUP_FIXED,
  getShippingMarkupPercent,
  getShippingMarkupFixed,
  applyShippingMarkup,
  listedAmountToCents,
};
