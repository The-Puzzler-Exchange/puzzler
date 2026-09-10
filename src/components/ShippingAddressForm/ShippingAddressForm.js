import React from 'react';
import classNames from 'classnames';
import { Form as FinalForm } from 'react-final-form';
import { FormattedMessage, useIntl } from '../../util/reactIntl';

import {
  Form,
  FieldTextInput,
  FieldSelect,
  FieldPhoneNumberInput,
  H3,
  PrimaryButton,
} from '../../components';
import * as validators from '../../util/validators';
import getUsaStates from '../../translations/usaStates';

import css from './ShippingAddressForm.module.css';

const US_COUNTRY = 'US';

/**
 * US-only shipping address form. Phone is required. Country is always US.
 *
 * @param {Object} props
 * @param {Function} props.onSubmit
 * @param {Object} [props.initialValues]
 * @param {string} [props.className]
 * @param {string} [props.rootClassName]
 * @param {string} [props.formId]
 * @param {boolean} [props.showHeading]
 * @param {string} [props.submitTitle]
 * @param {boolean} [props.inProgress]
 * @returns {JSX.Element}
 */
const ShippingAddressForm = props => {
  const intl = useIntl();
  const {
    className,
    rootClassName,
    formId = 'ShippingAddressForm',
    showHeading = true,
    submitTitle,
    inProgress,
    onSubmit,
    initialValues,
  } = props;

  const requireText = intl.formatMessage({ id: 'ShippingAddressForm.requireText' });
  const required = validators.required(requireText);
  const states = getUsaStates();

  return (
    <FinalForm
      onSubmit={onSubmit}
      initialValues={{ country: US_COUNTRY, ...initialValues }}
      render={fieldRenderProps => {
        const { handleSubmit, invalid } = fieldRenderProps;
        const classes = classNames(rootClassName || css.root, className);
        return (
          <Form className={classes} onSubmit={handleSubmit}>
            {showHeading ? (
              <H3>
                <FormattedMessage id="ShippingAddressForm.title" />
              </H3>
            ) : null}

            <div className={css.formRow}>
              <FieldTextInput
                id={`${formId}.name`}
                className={css.field}
                type="text"
                name="name"
                autoComplete="name"
                label={intl.formatMessage({ id: 'ShippingAddressForm.nameLabel' })}
                placeholder={intl.formatMessage({ id: 'ShippingAddressForm.namePlaceholder' })}
                validate={required}
              />
              <FieldPhoneNumberInput
                id={`${formId}.phone`}
                className={css.field}
                name="phone"
                label={intl.formatMessage({ id: 'ShippingAddressForm.phoneLabel' })}
                placeholder={intl.formatMessage({ id: 'ShippingAddressForm.phonePlaceholder' })}
                validate={required}
              />
            </div>

            <FieldTextInput
              id={`${formId}.street1`}
              className={classNames(css.field, css.fullField)}
              type="text"
              name="street1"
              autoComplete="address-line1"
              label={intl.formatMessage({ id: 'ShippingAddressForm.streetLabel' })}
              placeholder={intl.formatMessage({ id: 'ShippingAddressForm.streetPlaceholder' })}
              validate={required}
            />
            <FieldTextInput
              id={`${formId}.streetNo`}
              className={classNames(css.field, css.fullField)}
              type="text"
              name="streetNo"
              autoComplete="address-line2"
              label={intl.formatMessage({ id: 'ShippingAddressForm.aptLabel' })}
              placeholder={intl.formatMessage({ id: 'ShippingAddressForm.aptPlaceholder' })}
            />

            <div className={css.formRow}>
              <FieldTextInput
                id={`${formId}.city`}
                className={css.field}
                type="text"
                name="city"
                autoComplete="address-level2"
                label={intl.formatMessage({ id: 'ShippingAddressForm.cityLabel' })}
                placeholder={intl.formatMessage({ id: 'ShippingAddressForm.cityPlaceholder' })}
                validate={required}
              />
              <FieldSelect
                id={`${formId}.state`}
                className={css.field}
                name="state"
                label={intl.formatMessage({ id: 'ShippingAddressForm.stateLabel' })}
                validate={required}
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
                autoComplete="postal-code"
                label={intl.formatMessage({ id: 'ShippingAddressForm.zipLabel' })}
                placeholder={intl.formatMessage({ id: 'ShippingAddressForm.zipPlaceholder' })}
                validate={required}
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

            <PrimaryButton
              className={css.submitButton}
              type="submit"
              inProgress={inProgress}
              disabled={invalid}
            >
              {submitTitle || intl.formatMessage({ id: 'ShippingAddressForm.submit' })}
            </PrimaryButton>
          </Form>
        );
      }}
    />
  );
};

export default ShippingAddressForm;
