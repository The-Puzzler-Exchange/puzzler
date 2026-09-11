const { getTrustedSdk, getIntegrationSdk, handleError, serialize } = require('../../api-util/sdk');
const { denormalisedResponseEntities } = require('../../api-util/data');
const { ShippoServices } = require('../../services');
const { parseWeightToGrams, parseDimensionToCm } = require('../../api-util/listingUnitHelpers');
const { applyShippingMarkup } = require('../../api-util/shippingMarkup');
const {
  getShippoAddressFromUser,
  isUsAddress,
} = require('../../api-util/shippingAddress');
const log = require('../../log');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const mapListedRates = rates =>
  (rates || [])
    .map(rate => {
      const rawAmount = Number(rate.amountLocal || rate.amount);
      return {
        objectId: rate.objectId,
        provider: rate.provider,
        providerImage200: rate.providerImage200,
        servicelevel: rate.servicelevel,
        durationTerms: rate.durationTerms,
        name: rate.name,
        currency: rate.currencyLocal || rate.currency,
        rawAmount,
        listedAmount: applyShippingMarkup(rawAmount),
      };
    })
    .sort((a, b) => a.listedAmount - b.listedAmount);

/**
 * POST /api/address/shipping-rates
 *
 * Body: { listingId }
 * Returns a Shippo shipment plus listed (marked-up) rates. US addresses only.
 */
module.exports = async (req, res) => {
  try {
    const { listingId } = req.body || {};
    if (!listingId || !UUID_REGEX.test(listingId)) {
      const error = new Error('A valid listingId is required');
      error.status = 400;
      throw error;
    }

    const trustedSdk = await getTrustedSdk(req, res);
    const listingResponse = await trustedSdk.listings.show({
      id: listingId,
      include: ['author'],
    });
    const [listing] = denormalisedResponseEntities(listingResponse);
    if (!listing) {
      const error = new Error('Listing not found');
      error.status = 404;
      throw error;
    }

    const integrationSdk = getIntegrationSdk();
    const providerId = listing.author?.id?.uuid || listing.relationships?.author?.data?.id?.uuid;
    const [providerResponse, customerResponse] = await Promise.all([
      integrationSdk.users.show({ id: providerId }),
      integrationSdk.users.show({ id: req.tokenUserId }),
    ]);
    const [provider] = denormalisedResponseEntities(providerResponse);
    const [customer] = denormalisedResponseEntities(customerResponse);

    const addressFrom = getShippoAddressFromUser(provider);
    const addressTo = getShippoAddressFromUser(customer);

    if (!addressFrom || !addressTo) {
      const error = new Error('Shipping addresses are required');
      error.status = 400;
      throw error;
    }
    if (!isUsAddress(addressFrom) || !isUsAddress(addressTo)) {
      const error = new Error('US addresses only');
      error.status = 400;
      throw error;
    }

    const {
      weight,
      weight_unit,
      length,
      width,
      height,
      dimension_unit,
    } = listing.attributes.publicData || {};

    if (![weight, length, width, height].every(value => value != null && Number(value) > 0)) {
      const error = new Error('Listing parcel is incomplete');
      error.status = 400;
      throw error;
    }

    const parcel = {
      massUnit: 'g',
      weight: String(parseWeightToGrams(weight, weight_unit || 'lb').toFixed(2)),
      distanceUnit: 'cm',
      length: String(parseDimensionToCm(length, dimension_unit || 'in').toFixed(2)),
      width: String(parseDimensionToCm(width, dimension_unit || 'in').toFixed(2)),
      height: String(parseDimensionToCm(height, dimension_unit || 'in').toFixed(2)),
    };

    const shipment = await ShippoServices.shipments.create({
      addressFrom,
      addressTo,
      parcels: [parcel],
    });

    const currency = listing.attributes.price?.currency || 'USD';
    const ratePage = await ShippoServices.rates.listShipmentRatesByCurrencyCode({
      shipmentId: shipment.objectId,
      currencyCode: currency,
    });

    const status = 200;
    const statusText = 'OK';
    res
      .status(status)
      .set('Content-Type', 'application/transit+json')
      .send(
        serialize({
          status,
          statusText,
          data: {
            objectId: shipment.objectId,
            messages: shipment.messages || [],
            addressFrom: shipment.addressFrom,
            addressTo: shipment.addressTo,
            rates: mapListedRates(ratePage.results),
          },
        })
      )
      .end();
  } catch (error) {
    log.error(error, 'shipping-rates-failed', { userId: req.tokenUserId });
    handleError(res, error);
  }
};
