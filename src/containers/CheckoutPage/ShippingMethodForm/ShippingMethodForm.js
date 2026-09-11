import React from 'react';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { types as sdkTypes } from '../../../util/sdkLoader';
import { formatMoney } from '../../../util/currency';
import { Button, IconSpinner } from '../../../components';

import css from './ShippingMethodForm.module.css';

const { Money } = sdkTypes;

const getShippingRateErrorMessages = shipment => {
  if (!shipment?.addressFrom || !shipment?.addressTo) {
    return { addressFromMessages: [], addressToMessages: [] };
  }
  const fromResults = shipment.addressFrom.validationResults;
  const toResults = shipment.addressTo.validationResults;
  const pickMessages = results =>
    !results || results.isValid
      ? []
      : (results.messages || [])
          .filter(message => message.type?.includes('_error') || message.type?.includes('_warning'))
          .map(message => message.text);

  return {
    addressFromMessages: pickMessages(fromResults),
    addressToMessages: pickMessages(toResults),
  };
};

/**
 * Listed Shippo rates, cheapest first.
 *
 * @param {Object} props
 * @returns {JSX.Element}
 */
const ShippingMethodForm = props => {
  const intl = useIntl();
  const {
    shipment,
    getShippingRatesInProgress,
    getShippingRatesError,
    onSelectShippingRate,
    selectedShippingRate,
    onNextStep,
    disabledNextStep,
  } = props;

  if (getShippingRatesInProgress) {
    return <IconSpinner />;
  }

  const shippingRates = shipment?.rates
    ? [...shipment.rates].sort((a, b) => Number(a.listedAmount) - Number(b.listedAmount))
    : [];
  const { addressFromMessages, addressToMessages } = getShippingRateErrorMessages(shipment);
  const noRatesMessages =
    shippingRates.length === 0 ? (shipment?.messages || []).map(m => m.text) : [];
  const hasAddressErrors = addressFromMessages.length > 0 || addressToMessages.length > 0;

  return (
    <div className={css.ratesContainer}>
      {getShippingRatesError ? (
        <p className={css.errorMessage}>
          <FormattedMessage id="ShippingMethodForm.fetchFailed" />
        </p>
      ) : null}
      {noRatesMessages.length > 0 ? (
        <div className={css.noRatesContainer}>
          <p className={css.errorMessageTitle}>
            <FormattedMessage id="ShippingMethodForm.noRatesWithErrors" />
          </p>
          {noRatesMessages.map(message => (
            <div className={css.errorMessage} key={message}>
              {message}
            </div>
          ))}
        </div>
      ) : shippingRates.length === 0 && shipment && !getShippingRatesError && !hasAddressErrors ? (
        <p className={css.errorMessage}>
          <FormattedMessage id="ShippingMethodForm.noRates" />
        </p>
      ) : null}
      {hasAddressErrors ? (
        <div className={css.errorMessageContainer}>
          {addressFromMessages.length > 0 ? (
            <p className={css.errorMessageTitle}>
              <FormattedMessage id="ShippingMethodForm.addressFromError" />
            </p>
          ) : null}
          {addressFromMessages.map(message => (
            <div className={css.errorMessage} key={message}>
              {message}
            </div>
          ))}
          {addressToMessages.length > 0 ? (
            <p className={css.errorMessageTitle}>
              <FormattedMessage id="ShippingMethodForm.addressToError" />
            </p>
          ) : null}
          {addressToMessages.map(message => (
            <div className={css.errorMessage} key={message}>
              {message}
            </div>
          ))}
        </div>
      ) : (
        shippingRates.map(rate => (
          <div
            role="button"
            tabIndex={0}
            key={rate.objectId}
            className={classNames(css.rate, {
              [css.selected]: selectedShippingRate?.objectId === rate.objectId,
            })}
            onClick={() => onSelectShippingRate(rate)}
            onKeyPress={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                onSelectShippingRate(rate);
              }
            }}
          >
            <div className={css.rateHeader}>
              {rate.providerImage200 ? (
                <img
                  src={rate.providerImage200}
                  alt={rate.provider}
                  className={css.providerImage}
                />
              ) : null}
              <div className={css.rateDetails}>
                <div className={css.rateName}>
                  <span>{rate.provider}</span>
                  {rate.servicelevel ? (
                    <span className={css.rateServiceLevel}>({rate.servicelevel.name})</span>
                  ) : null}
                </div>
                <div className={css.rateDuration}>{rate.durationTerms}</div>
              </div>
            </div>
            <div className={css.ratePrice}>
              {formatMoney(
                intl,
                new Money(Math.round(Number(rate.listedAmount) * 100), rate.currency || 'USD')
              )}
            </div>
          </div>
        ))
      )}
      <Button
        type="button"
        disabled={disabledNextStep || hasAddressErrors || shippingRates.length === 0}
        className={css.submitButton}
        onClick={onNextStep}
      >
        <FormattedMessage id="ShippingMethodForm.submit" />
      </Button>
    </div>
  );
};

export default ShippingMethodForm;
