const US_COUNTRY = 'US';

/**
 * Map a member shipping address to Shippo fields.
 * Suite/unit belongs in street2. Email is required by USPS on labels.
 *
 * @param {Object} user Sharetribe user entity
 * @returns {Object|null}
 */
const getShippoAddressFromUser = user => {
  const email = user?.attributes?.email;
  const shippingAddress = user?.attributes?.profile?.protectedData?.shippingAddress;
  if (!shippingAddress) {
    return null;
  }
  const { streetNo = '', country, ...rest } = shippingAddress;
  return {
    ...rest,
    country: country || US_COUNTRY,
    ...(streetNo ? { street2: streetNo } : {}),
    ...(email ? { email } : {}),
    validate: true,
  };
};

const isUsAddress = address => (address?.country || '').toUpperCase() === US_COUNTRY;

const isCompleteShippingAddress = address => {
  if (!address) {
    return false;
  }
  const { name, street1, city, state, zip, phone, country } = address;
  return !!(
    name &&
    street1 &&
    city &&
    state &&
    zip &&
    phone &&
    (country || US_COUNTRY) === US_COUNTRY
  );
};

module.exports = {
  US_COUNTRY,
  getShippoAddressFromUser,
  isUsAddress,
  isCompleteShippingAddress,
};
