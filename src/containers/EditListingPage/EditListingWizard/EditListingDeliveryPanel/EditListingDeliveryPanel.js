import React from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../../../util/reactIntl';
import { LISTING_STATE_DRAFT, propTypes } from '../../../../util/types';
import { getParcelInitialValues } from '../../../../util/parcel';
import { getProfileShippingAddress } from '../../../../util/shippingAddress';

import { H3, ListingLink } from '../../../../components';

import EditListingDeliveryForm from './EditListingDeliveryForm';
import css from './EditListingDeliveryPanel.module.css';

const getInitialValues = props => {
  const { listing, currentUser } = props;
  const publicData = listing?.attributes?.publicData || {};
  const parcel = getParcelInitialValues(publicData);
  const address = getProfileShippingAddress(currentUser);
  return {
    ...parcel,
    name: address.name || '',
    phone: address.phone || '',
    street1: address.street1 || '',
    streetNo: address.streetNo || '',
    city: address.city || '',
    state: address.state || '',
    zip: address.zip || '',
    country: address.country || 'US',
  };
};

/**
 * Delivery wizard panel: parcel defaults from piece count, US ship-from on the member profile.
 *
 * @param {Object} props
 * @returns {JSX.Element}
 */
const EditListingDeliveryPanel = props => {
  const {
    className,
    rootClassName,
    listing,
    currentUser,
    disabled,
    ready,
    onSubmit,
    onUpdateProfile,
    submitButtonText,
    panelUpdated,
    updateInProgress,
    errors,
    updatePageTitle: UpdatePageTitle,
    intl,
  } = props;

  const classes = classNames(rootClassName || css.root, className);
  const isPublished = listing?.id && listing?.attributes.state !== LISTING_STATE_DRAFT;
  const panelHeadingProps = isPublished
    ? {
        id: 'EditListingDeliveryPanel.title',
        values: { listingTitle: <ListingLink listing={listing} />, lineBreak: <br /> },
        messageProps: { listingTitle: listing.attributes.title },
      }
    : {
        id: 'EditListingDeliveryPanel.createListingTitle',
        values: { lineBreak: <br /> },
        messageProps: {},
      };

  return (
    <main className={classes}>
      <UpdatePageTitle
        panelHeading={intl.formatMessage(
          { id: panelHeadingProps.id },
          { ...panelHeadingProps.messageProps }
        )}
      />
      <H3 as="h1">
        <FormattedMessage id={panelHeadingProps.id} values={{ ...panelHeadingProps.values }} />
      </H3>
      {currentUser?.id ? (
        <EditListingDeliveryForm
          className={css.form}
          initialValues={getInitialValues(props)}
          onSubmit={values => {
            const {
              name,
              phone,
              street1,
              streetNo,
              city,
              state,
              zip,
              country,
              length,
              width,
              height,
              weight,
              weight_unit,
              dimension_unit,
            } = values;

            const shippingAddress = {
              name,
              phone,
              street1,
              streetNo,
              city,
              state,
              zip,
              country: country || 'US',
            };

            const updateValues = {
              publicData: {
                shippingEnabled: true,
                pickupEnabled: false,
                length: Number(length),
                width: Number(width),
                height: Number(height),
                weight: Number(weight),
                weight_unit: weight_unit || 'lb',
                dimension_unit: dimension_unit || 'in',
              },
            };

            const profilePromise = onUpdateProfile
              ? onUpdateProfile({ protectedData: { shippingAddress } })
              : Promise.resolve();

            return profilePromise.then(() => onSubmit(updateValues));
          }}
          saveActionMsg={submitButtonText}
          disabled={disabled}
          ready={ready}
          updated={panelUpdated}
          updateInProgress={updateInProgress}
          fetchErrors={errors}
        />
      ) : null}
    </main>
  );
};

EditListingDeliveryPanel.propTypes = {
  listing: propTypes.ownListing,
};

export default EditListingDeliveryPanel;
