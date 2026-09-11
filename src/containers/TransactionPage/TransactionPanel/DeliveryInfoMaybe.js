import React, { useState } from 'react';
import classNames from 'classnames';

import getCountryCodes from '../../../translations/countryCodes';
import { FormattedMessage } from '../../../util/reactIntl';
import { ExternalLink, Heading, PrimaryButton } from '../../../components';

import AddressLinkMaybe from './AddressLinkMaybe';

import css from './TransactionPanel.module.css';

/**
 * Format a timestamp in milliseconds to a readable date string
 * @param {number} timestampMs
 * @param {string} locale
 * @returns {string}
 */
const formatDate = (timestampMs, locale) => {
  if (!timestampMs) {
    return '';
  }
  const date = new Date(timestampMs);
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

/**
 * Format location object to a readable string
 * @param {Object} location
 * @returns {string}
 */
const formatLocation = location => {
  if (!location) {
    return '';
  }
  const parts = [];
  if (location.city) {
    parts.push(location.city);
  }
  if (location.state) {
    parts.push(location.state);
  }
  if (location.zip) {
    parts.push(location.zip);
  }
  return parts.join(', ');
};

/**
 * Shipping address, tracking, and provider label / retry.
 *
 * @param {Object} props
 * @returns {JSX.Element|null}
 */
const DeliveryInfoMaybe = props => {
  const {
    className,
    rootClassName,
    protectedData,
    listing,
    locale,
    shippingLabelDetails,
    isProvider,
    isInquiry,
    transactionId,
    onBuyShippingLabel,
  } = props;
  const [buyLabelInProgress, setBuyLabelInProgress] = useState(false);
  const [buyLabelError, setBuyLabelError] = useState(null);
  const classes = classNames(rootClassName || css.deliveryInfoContainer, className);
  const deliveryMethod = protectedData?.deliveryMethod;
  const isShipping = deliveryMethod === 'shipping';
  const isPickup = deliveryMethod === 'pickup';

  const handleBuyLabel = () => {
    if (!transactionId || !onBuyShippingLabel) {
      return;
    }
    setBuyLabelInProgress(true);
    setBuyLabelError(null);
    const id = typeof transactionId === 'string' ? transactionId : transactionId.uuid;
    onBuyShippingLabel(id)
      .then(() => {
        setBuyLabelInProgress(false);
      })
      .catch(() => {
        setBuyLabelInProgress(false);
        setBuyLabelError(true);
      });
  };

  if (isPickup) {
    const pickupLocation = listing?.attributes?.publicData?.location || {};
    return (
      <div className={classes}>
        <Heading as="h3" rootClassName={css.sectionHeading}>
          <FormattedMessage id="TransactionPanel.pickupInfoHeading" />
        </Heading>
        <div className={css.pickupInfoContent}>
          <AddressLinkMaybe
            linkRootClassName={css.pickupAddress}
            location={pickupLocation}
            geolocation={listing?.attributes?.geolocation}
            showAddress={true}
          />
        </div>
      </div>
    );
  } else if (isShipping && !isInquiry) {
    const { name, phoneNumber, address } = protectedData?.shippingDetails || {};
    const { line1, line2, city, postalCode, state, country: countryCode } = address || {};
    const phoneMaybe = !!phoneNumber ? (
      <>
        {phoneNumber}
        <br />
      </>
    ) : null;

    const countryCodes = getCountryCodes(locale);
    const countryInfo = countryCodes.find(c => c.code === countryCode);
    const country = countryInfo?.name;

    const trackingNumber = shippingLabelDetails?.trackingNumber;
    const trackingUrl = shippingLabelDetails?.trackingUrl;
    const labelUrl = shippingLabelDetails?.labelUrl;
    const trackingHistory = shippingLabelDetails?.trackingHistory || [];
    const trackingStatus = shippingLabelDetails?.trackingStatus;
    const hasTrackingValue = !!trackingNumber || !!trackingUrl || !!labelUrl;

    return (
      <div className={classes}>
        {name || line1 ? (
          <>
            <Heading as="h3" rootClassName={css.sectionHeading}>
              <FormattedMessage id="TransactionPanel.shippingInfoHeading" />
            </Heading>
            <div className={css.shippingInfoContent}>
              {name}
              <br />
              {phoneMaybe}
              {line1}
              {line2 ? `, ${line2}` : ''}
              <br />
              {postalCode}, {city}
              <br />
              {state ? `${state}, ` : ''}
              {country}
              <br />
            </div>
          </>
        ) : null}

        <div className={css.shippingDetailsContainer}>
          {hasTrackingValue ? (
            <>
              <Heading as="h3" rootClassName={css.sectionHeading}>
                <FormattedMessage id="TransactionPanel.shippingDetailsHeading" />
              </Heading>
              <div className={css.shippingDetailsContent}>
                {trackingNumber ? (
                  <p>
                    <FormattedMessage id="TransactionPanel.trackingNumber" />: {trackingNumber}
                  </p>
                ) : null}
                {trackingStatus ? (
                  <p>
                    <FormattedMessage id="TransactionPanel.trackingStatus" />: {trackingStatus}
                  </p>
                ) : null}
                {trackingUrl ? (
                  <p>
                    <ExternalLink href={trackingUrl}>
                      <FormattedMessage id="TransactionPanel.trackingUrl" />
                    </ExternalLink>
                  </p>
                ) : null}
                {labelUrl && isProvider ? (
                  <p>
                    <ExternalLink href={labelUrl}>
                      <FormattedMessage id="TransactionPanel.labelUrl" />
                    </ExternalLink>
                  </p>
                ) : null}
                {isProvider && !labelUrl ? (
                  <>
                    <PrimaryButton
                      className={css.getLabelButton}
                      type="button"
                      inProgress={buyLabelInProgress}
                      disabled={buyLabelInProgress}
                      onClick={handleBuyLabel}
                    >
                      <FormattedMessage id="TransactionPanel.getLabel" />
                    </PrimaryButton>
                    {buyLabelError ? (
                      <p className={css.getLabelError}>
                        <FormattedMessage id="TransactionPanel.getLabelFailed" />
                      </p>
                    ) : null}
                  </>
                ) : null}

                {trackingHistory.length > 0 ? (
                  <div className={css.trackingHistory}>
                    <h4 className={css.trackingHistoryHeading}>
                      <FormattedMessage id="TransactionPanel.trackingHistoryHeading" />
                    </h4>
                    <div className={css.trackingHistoryList}>
                      {trackingHistory.map((entry, index) => (
                        <div
                          key={`${entry.status}-${entry.timestampMs || index}`}
                          className={css.trackingHistoryEntry}
                        >
                          <div className={css.trackingHistoryStatus}>
                            <strong>{entry.status}</strong>
                            {entry.substatus ? ` (${entry.substatus})` : ''}
                          </div>
                          {entry.statusDetails ? (
                            <div className={css.trackingHistoryDetails}>{entry.statusDetails}</div>
                          ) : null}
                          {entry.location ? (
                            <div className={css.trackingHistoryLocation}>
                              {formatLocation(entry.location)}
                            </div>
                          ) : null}
                          <div className={css.trackingHistoryDate}>
                            {formatDate(entry.timestampMs, locale)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <Heading as="h3" rootClassName={css.sectionHeading}>
                <FormattedMessage id="TransactionPanel.weArePreparingYourOrder" />
              </Heading>
              {isProvider ? (
                <PrimaryButton
                  className={css.getLabelButton}
                  type="button"
                  inProgress={buyLabelInProgress}
                  disabled={buyLabelInProgress}
                  onClick={handleBuyLabel}
                >
                  <FormattedMessage id="TransactionPanel.getLabel" />
                </PrimaryButton>
              ) : null}
              {buyLabelError ? (
                <p className={css.getLabelError}>
                  <FormattedMessage id="TransactionPanel.getLabelFailed" />
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default DeliveryInfoMaybe;
