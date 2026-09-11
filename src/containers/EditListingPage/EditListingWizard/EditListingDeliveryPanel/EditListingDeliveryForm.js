import React from 'react';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../../../util/reactIntl';
import { required, composeValidators, numberAtLeast } from '../../../../util/validators';
import getUsaStates from '../../../../translations/usaStates';

import {
  Form,
  Button,
  FieldTextInput,
  FieldSelect,
  FieldPhoneNumberInput,
} from '../../../../components';

import css from './EditListingDeliveryForm.module.css';

const US_COUNTRY = 'US';

/**
 * Listing delivery form: US ship-from address and parcel size/weight.
 *
 * @param {Object} props
 * @returns {JSX.Element}
 */
const EditListingDeliveryForm = props => {
  const intl = useIntl();
  const {
    formId = 'EditListingDeliveryForm',
    className,
    disabled,
    ready,
    saveActionMsg,
    updated,
    updateInProgress,
    fetchErrors,
    onSubmit,
    initialValues,
  } = props;

  const classes = classNames(css.root, className);
  const submitReady = (updated && ready) || (!updateInProgress && ready);
  const submitInProgress = updateInProgress;
  const submitDisabled = updateInProgress;
  const requireText = intl.formatMessage({ id: 'ShippingAddressForm.requireText' });
  const requiredField = required(requireText);
  const positiveNumber = composeValidators(
    requiredField,
    numberAtLeast(intl.formatMessage({ id: 'EditListingDeliveryForm.positiveNumber' }), 0.01)
  );
  const states = getUsaStates();
  const { updateListingError, showListingsError } = fetchErrors || {};

  return (
    <FinalForm
      initialValues={{ country: US_COUNTRY, ...initialValues }}
      onSubmit={onSubmit}
      render={formRenderProps => {
        const { handleSubmit, invalid } = formRenderProps;
        return (
          <Form className={classes} onSubmit={handleSubmit}>
            {updateListingError ? (
              <p className={css.error}>
                <FormattedMessage id="EditListingDeliveryForm.updateFailed" />
              </p>
            ) : null}
            {showListingsError ? (
              <p className={css.error}>
                <FormattedMessage id="EditListingDeliveryForm.showListingFailed" />
              </p>
            ) : null}

            <h2 className={css.sectionHeading}>
              <FormattedMessage id="EditListingDeliveryForm.shipFromHeading" />
            </h2>
            <p className={css.helper}>
              <FormattedMessage id="EditListingDeliveryForm.shipFromHelper" />
            </p>

            <div className={css.formRow}>
              <FieldTextInput
                id={`${formId}.name`}
                className={css.field}
                type="text"
                name="name"
                label={intl.formatMessage({ id: 'ShippingAddressForm.nameLabel' })}
                placeholder={intl.formatMessage({ id: 'ShippingAddressForm.namePlaceholder' })}
                validate={requiredField}
              />
              <FieldPhoneNumberInput
                id={`${formId}.phone`}
                className={css.field}
                name="phone"
                label={intl.formatMessage({ id: 'ShippingAddressForm.phoneLabel' })}
                placeholder={intl.formatMessage({ id: 'ShippingAddressForm.phonePlaceholder' })}
                validate={requiredField}
              />
            </div>
            <FieldTextInput
              id={`${formId}.street1`}
              className={css.field}
              type="text"
              name="street1"
              label={intl.formatMessage({ id: 'ShippingAddressForm.streetLabel' })}
              placeholder={intl.formatMessage({ id: 'ShippingAddressForm.streetPlaceholder' })}
              validate={requiredField}
            />
            <FieldTextInput
              id={`${formId}.streetNo`}
              className={css.field}
              type="text"
              name="streetNo"
              label={intl.formatMessage({ id: 'ShippingAddressForm.aptLabel' })}
              placeholder={intl.formatMessage({ id: 'ShippingAddressForm.aptPlaceholder' })}
            />
            <div className={css.formRow}>
              <FieldTextInput
                id={`${formId}.city`}
                className={css.field}
                type="text"
                name="city"
                label={intl.formatMessage({ id: 'ShippingAddressForm.cityLabel' })}
                placeholder={intl.formatMessage({ id: 'ShippingAddressForm.cityPlaceholder' })}
                validate={requiredField}
              />
              <FieldSelect
                id={`${formId}.state`}
                className={css.field}
                name="state"
                label={intl.formatMessage({ id: 'ShippingAddressForm.stateLabel' })}
                validate={requiredField}
              >
                <option disabled value="">
                  {intl.formatMessage({ id: 'ShippingAddressForm.statePlaceholder' })}
                </option>
                {states.map(state => (
                  <option key={state.code} value={state.code}>
                    {state.name}
                  </option>
                ))}
              </FieldSelect>
            </div>
            <div className={css.formRow}>
              <FieldTextInput
                id={`${formId}.zip`}
                className={css.field}
                type="text"
                name="zip"
                label={intl.formatMessage({ id: 'ShippingAddressForm.zipLabel' })}
                placeholder={intl.formatMessage({ id: 'ShippingAddressForm.zipPlaceholder' })}
                validate={requiredField}
              />
              <FieldTextInput
                id={`${formId}.country`}
                className={css.field}
                type="text"
                name="country"
                label={intl.formatMessage({ id: 'ShippingAddressForm.countryLabel' })}
                readOnly
              />
            </div>

            <h2 className={css.sectionHeading}>
              <FormattedMessage id="EditListingDeliveryForm.parcelHeading" />
            </h2>
            <p className={css.helper}>
              <FormattedMessage id="EditListingDeliveryForm.parcelHelper" />
            </p>
            <div className={css.formRow}>
              <FieldTextInput
                id={`${formId}.length`}
                className={css.field}
                type="number"
                name="length"
                min="0"
                step="0.1"
                label={intl.formatMessage({ id: 'EditListingDeliveryForm.lengthLabel' })}
                validate={positiveNumber}
              />
              <FieldTextInput
                id={`${formId}.width`}
                className={css.field}
                type="number"
                name="width"
                min="0"
                step="0.1"
                label={intl.formatMessage({ id: 'EditListingDeliveryForm.widthLabel' })}
                validate={positiveNumber}
              />
            </div>
            <div className={css.formRow}>
              <FieldTextInput
                id={`${formId}.height`}
                className={css.field}
                type="number"
                name="height"
                min="0"
                step="0.1"
                label={intl.formatMessage({ id: 'EditListingDeliveryForm.heightLabel' })}
                validate={positiveNumber}
              />
              <FieldTextInput
                id={`${formId}.weight`}
                className={css.field}
                type="number"
                name="weight"
                min="0"
                step="0.1"
                label={intl.formatMessage({ id: 'EditListingDeliveryForm.weightLabel' })}
                validate={positiveNumber}
              />
            </div>

            <Button
              className={css.submitButton}
              type="submit"
              inProgress={submitInProgress}
              disabled={invalid || disabled || submitDisabled}
              ready={submitReady}
            >
              {saveActionMsg}
            </Button>
          </Form>
        );
      }}
    />
  );
};

export default EditListingDeliveryForm;
