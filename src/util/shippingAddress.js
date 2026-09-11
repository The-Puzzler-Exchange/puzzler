/**
 * Member shipping address lives on the profile in protectedData (privateData is a fallback).
 * The last saved address is the one used to initialise checkout and listing forms.
 */

const EMPTY_SHIPPING_ADDRESS = {};

/**
 * Last saved US shipping address on the member profile.
 *
 * @param {Object} [user] Sharetribe user entity
 * @returns {Object} shippingAddress or a stable empty object
 */
export const getProfileShippingAddress = user =>
  user?.attributes?.profile?.protectedData?.shippingAddress ||
  user?.attributes?.profile?.privateData?.shippingAddress ||
  EMPTY_SHIPPING_ADDRESS;

/**
 * True when the US ship-to / ship-from address has the required fields.
 *
 * @param {Object} [address]
 * @returns {boolean}
 */
export const isCompleteShippingAddress = address =>
  !!(
    address?.name &&
    address?.street1 &&
    address?.city &&
    address?.state &&
    address?.zip &&
    address?.phone
  );
