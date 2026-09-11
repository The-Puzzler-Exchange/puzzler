import React, { useEffect, useRef, useState } from 'react';

// Import contexts and util modules
import { FormattedMessage, intlShape } from '../../util/reactIntl';
import { pathByRouteName } from '../../util/routes';
import {
  isValidCurrencyForTransactionProcess,
  pickTransactionFieldsData,
} from '../../util/fieldHelpers.js';
import { propTypes } from '../../util/types';
import { ensureTransaction } from '../../util/data';
import { createSlug } from '../../util/urlHelpers';
import { formatMoney } from '../../util/currency';
import { types as sdkTypes } from '../../util/sdkLoader';
import { createShippingPaymentIntent, refundShippingPaymentIntent } from '../../util/api';
import { getProfileShippingAddress, isCompleteShippingAddress } from '../../util/shippingAddress';
import {
  isTransactionInitiateListingNotFoundError,
  isTransactionsTransitionInvalidTransition,
} from '../../util/errors';
import {
  getProcess,
  resolveLatestProcessName,
  BOOKING_PROCESS_NAME,
  NEGOTIATION_PROCESS_NAME,
} from '../../transactions/transaction';

import { updateCurrentUserProfile } from '../../ducks/user.duck';

// Import shared components
import {
  H3,
  H4,
  NamedLink,
  OrderBreakdown,
  Page,
  ShippingAddressForm,
  TopbarSimplified,
} from '../../components';

// Session helpers file needs to be imported before other CheckoutPage modules that use it
import { clearData } from './CheckoutPageSessionHelpers';

import {
  bookingDatesMaybe,
  getBillingDetails,
  getFormattedTotalPrice,
  getShippingDetailsFromProfileAddress,
  getTransactionTypeData,
  hasDefaultPaymentMethod,
  hasPaymentExpired,
  hasTransactionPassedPendingPayment,
  processCheckoutWithPayment,
  setOrderPageInitialValues,
} from './CheckoutPageTransactionHelpers.js';
import { getErrorMessages } from './ErrorMessages';
import { getShippingRates } from './CheckoutPage.duck';

import StripePaymentForm from './StripePaymentForm/StripePaymentForm';
import ShippingMethodForm from './ShippingMethodForm/ShippingMethodForm';
import DetailsSideCard from './DetailsSideCard';
import MobileListingImage from './MobileListingImage';
import MobileOrderBreakdown from './MobileOrderBreakdown';

import css from './CheckoutPage.module.css';

const { Money } = sdkTypes;

const STEP_ADDRESS = 'address';
const STEP_RATES = 'rates';
const STEP_PAY = 'pay';

// Stripe PaymentIntent statuses, where user actions are already completed
// https://stripe.com/docs/payments/payment-intents/status
const STRIPE_PI_USER_ACTIONS_DONE_STATUSES = ['processing', 'requires_capture', 'succeeded'];

const capitalizeString = s => `${s.charAt(0).toUpperCase()}${s.substr(1)}`;

/**
 * Prefix the properties of the chosen price variant as first level properties for the protected data of the transaction
 *
 * @example
 * const priceVariant = {
 *   name: 'something',
 * }
 *
 * will be returned as:
 * const priceVariant = {
 *   priceVariantName: 'something',
 * }
 *
 * @param {Object} priceVariant - The price variant object
 * @returns {Object} The price variant object with the properties prefixed with priceVariant*
 */
const prefixPriceVariantProperties = priceVariant => {
  if (!priceVariant) {
    return {};
  }

  const entries = Object.entries(priceVariant).map(([key, value]) => {
    return [`priceVariant${capitalizeString(key)}`, value];
  });
  return Object.fromEntries(entries);
};

/**
 * Construct orderParams object using pageData from session storage, shipping details, and optional payment params.
 * Note: This is used for both speculate transition and real transition
 *       - Speculate transition is called, when the the component is mounted. It's used to test if the data can go through the API validation
 *       - Real transition is made, when the user submits the StripePaymentForm.
 *
 * @param {Object} pageData data that's saved to session storage.
 * @param {Object} shippingDetails shipping address if applicable.
 * @param {Object} optionalPaymentParams (E.g. paymentMethod or setupPaymentMethodForSaving)
 * @param {Object} config app-wide configs. This contains hosted configs too.
 * @returns orderParams.
 */
const getOrderParams = (
  pageData,
  shippingDetails,
  optionalPaymentParams,
  config,
  transactionFieldProtectedData,
  customerDefaultMessage
) => {
  const quantity = pageData.orderData?.quantity;
  const quantityMaybe = quantity ? { quantity } : {};
  const seats = pageData.orderData?.seats;
  const seatsMaybe = seats ? { seats } : {};
  const deliveryMethod = pageData.orderData?.deliveryMethod || 'shipping';
  const deliveryMethodMaybe = deliveryMethod ? { deliveryMethod } : {};
  const { listingType, unitType, priceVariants } = pageData?.listing?.attributes?.publicData || {};

  // price variant data for fixed duration bookings
  const priceVariantName = pageData.orderData?.priceVariantName;
  const priceVariantNameMaybe = priceVariantName ? { priceVariantName } : {};
  const priceVariant = priceVariants?.find(pv => pv.name === priceVariantName);
  const priceVariantMaybe = priceVariant ? prefixPriceVariantProperties(priceVariant) : {};

  const customerDefaultMessageMaybe = customerDefaultMessage ? { customerDefaultMessage } : {};

  const protectedDataMaybe = {
    protectedData: {
      ...getTransactionTypeData(listingType, unitType, config),
      ...deliveryMethodMaybe,
      ...shippingDetails,
      ...priceVariantMaybe,
      ...transactionFieldProtectedData,
      ...customerDefaultMessageMaybe,
    },
  };

  // Note: Avoid misinterpreting the following logic as allowing arbitrary mixing of `quantity` and `seats`.
  // You can only pass either quantity OR seats and units to the orderParams object
  // Quantity represents the total booked units for the line item (e.g. days, hours).
  // When quantity is not passed, we pass seats and units.
  // If `bookingDatesMaybe` is provided, it determines `units`, and `seats` defaults to 1
  // (implying quantity = units)

  // These are the order parameters for the first payment-related transition
  // which is either initiate-transition or initiate-transition-after-enquiry
  const orderParams = {
    listingId: pageData?.listing?.id,
    ...deliveryMethodMaybe,
    ...quantityMaybe,
    ...seatsMaybe,
    ...bookingDatesMaybe(pageData.orderData?.bookingDates),
    ...priceVariantNameMaybe,
    ...protectedDataMaybe,
    ...optionalPaymentParams,
  };
  return orderParams;
};

const fetchSpeculatedTransactionIfNeeded = (orderParams, pageData, fetchSpeculatedTransaction) => {
  const tx = pageData ? pageData.transaction : null;
  const pageDataListing = pageData.listing;
  const processName =
    tx?.attributes?.processName ||
    pageDataListing?.attributes?.publicData?.transactionProcessAlias?.split('/')[0];
  const process = processName ? getProcess(processName) : null;

  // If transaction has passed payment-pending state, speculated tx is not needed.
  const shouldFetchSpeculatedTransaction =
    !!pageData?.listing?.id &&
    !!pageData.orderData &&
    !!process &&
    !hasTransactionPassedPendingPayment(tx, process);

  if (shouldFetchSpeculatedTransaction) {
    const processAlias = pageData.listing.attributes.publicData?.transactionProcessAlias;
    const transactionId = tx ? tx.id : null;
    const isInquiryInPaymentProcess =
      tx?.attributes?.lastTransition === process.transitions.INQUIRE;
    const resolvedProcessName = resolveLatestProcessName(processName);
    const isOfferPendingInNegotiationProcess =
      resolvedProcessName === NEGOTIATION_PROCESS_NAME &&
      tx.attributes.state === `state/${process.states.OFFER_PENDING}`;

    const requestTransition = isInquiryInPaymentProcess
      ? process.transitions.REQUEST_PAYMENT_AFTER_INQUIRY
      : isOfferPendingInNegotiationProcess
      ? process.transitions.REQUEST_PAYMENT_TO_ACCEPT_OFFER
      : process.transitions.REQUEST_PAYMENT;
    const isPrivileged = process.isPrivileged(requestTransition);

    fetchSpeculatedTransaction(
      orderParams,
      processAlias,
      transactionId,
      requestTransition,
      isPrivileged
    );
  }
};

/**
 * Load initial data for the page
 *
 * Since the data for the checkout is not passed in the URL (there
 * might be lots of options in the future), we must pass in the data
 * some other way. Currently the ListingPage sets the initial data
 * for the CheckoutPage's Redux store.
 *
 * For some cases (e.g. a refresh in the CheckoutPage), the Redux
 * store is empty. To handle that case, we store the received data
 * to window.sessionStorage and read it from there if no props from
 * the store exist.
 *
 * This function also sets of fetching the speculative transaction
 * based on this initial data.
 */
export const loadInitialDataForStripePayments = ({
  pageData,
  fetchSpeculatedTransaction,
  fetchStripeCustomer,
  config,
}) => {
  // Fetch currentUser with stripeCustomer entity
  // Note: since there's need for data loading in "componentWillMount" function,
  //       this is added here instead of loadData static function.
  fetchStripeCustomer();

  // Fetch speculated transaction for showing price in order breakdown
  // NOTE: if unit type is line-item/item, quantity needs to be added.
  // The way to pass it to checkout page is through pageData.orderData
  const shippingDetails = {};
  const optionalPaymentParams = {};
  const orderParams = getOrderParams(pageData, shippingDetails, optionalPaymentParams, config);

  fetchSpeculatedTransactionIfNeeded(orderParams, pageData, fetchSpeculatedTransaction);
};

const handleSubmit = (
  values,
  process,
  props,
  stripe,
  submitting,
  setSubmitting,
  shippingCheckout
) => {
  if (submitting) {
    return;
  }
  setSubmitting(true);

  const {
    history,
    config,
    routeConfiguration,
    speculatedTransaction,
    currentUser,
    stripeCustomerFetched,
    paymentIntent,
    dispatch,
    onInitiateOrder,
    onConfirmCardPayment,
    onConfirmPayment,
    onSavePaymentMethod,
    onFetchTransaction,
    onSubmitCallback,
    pageData,
    setPageData,
    sessionStorageKey,
    transaction: reduxTransaction,
    transactionFieldConfigs = [],
  } = props;
  const { selectedShippingRate, shipment, setShippingPaymentError } = shippingCheckout || {};
  const { card, message, formValues } = values;

  const transactionFieldsProtectedData = {
    ...pickTransactionFieldsData(formValues, 'protected', true, transactionFieldConfigs),
  };

  const hasDefaultPaymentMethodSaved = hasDefaultPaymentMethod(stripeCustomerFetched, currentUser);
  const stripePaymentMethodId = hasDefaultPaymentMethodSaved
    ? currentUser?.stripeCustomer?.defaultPaymentMethod?.attributes?.stripePaymentMethodId
    : null;

  const hasPaymentIntentUserActionsDone =
    paymentIntent && STRIPE_PI_USER_ACTIONS_DONE_STATUSES.includes(paymentIntent.status);

  const requestPaymentParams = {
    pageData,
    speculatedTransaction,
    stripe,
    card,
    billingDetails: getBillingDetails(formValues, currentUser),
    paymentIntent,
    hasPaymentIntentUserActionsDone,
    stripePaymentMethodId,
    process,
    onInitiateOrder,
    onConfirmCardPayment,
    onConfirmPayment,
    onSavePaymentMethod,
    sessionStorageKey,
    stripeCustomer: currentUser?.stripeCustomer,
    isPaymentFlowUseSavedCard: false,
    isPaymentFlowPayAndSaveCard: false,
    setPageData,
  };

  const listingId = pageData?.listing?.id?.uuid;
  const shippingRateId = selectedShippingRate?.objectId;
  const shipmentId = shipment?.objectId;
  const shippingAddress = getProfileShippingAddress(currentUser);

  if (!listingId || !shippingRateId || !shipmentId || !stripe || !card) {
    setSubmitting(false);
    if (setShippingPaymentError) {
      setShippingPaymentError({
        message: 'Select a shipping rate and enter card details to pay.',
      });
    }
    return;
  }

  if (setShippingPaymentError) {
    setShippingPaymentError(null);
  }

  let paymentIntentId = null;

  const optionalPaymentParams = {};
  const shippingDetails = {
    deliveryMethod: 'shipping',
    shippingRateId,
    shipmentId,
    listedShippingAmount: selectedShippingRate.listedAmount,
    ...getShippingDetailsFromProfileAddress(shippingAddress),
  };

  const orderParams = getOrderParams(
    pageData,
    shippingDetails,
    optionalPaymentParams,
    config,
    transactionFieldsProtectedData,
    message
  );

  const refundIfNeeded = () => {
    if (!paymentIntentId) {
      return Promise.resolve();
    }
    return refundShippingPaymentIntent(paymentIntentId).catch(() => {});
  };

  const finishSuccess = response => {
    const { orderId, paymentMethodSaved } = response;
    setSubmitting(false);

    const orderDetailsPath = pathByRouteName('OrderDetailsPage', routeConfiguration, {
      id: orderId.uuid,
    });
    const initialValues = {
      savePaymentMethodFailed: !paymentMethodSaved,
    };

    setOrderPageInitialValues(initialValues, routeConfiguration, dispatch);
    onSubmitCallback();
    history.push(orderDetailsPath);
  };

  createShippingPaymentIntent({ listingId, shippingRateId, shipmentId })
    .then(piResponse => {
      paymentIntentId = piResponse.paymentIntentId;
      orderParams.protectedData = {
        ...orderParams.protectedData,
        stripePaymentIntentId: paymentIntentId,
        listedShippingAmount: piResponse.listedAmount,
      };
      return stripe.confirmCardPayment(piResponse.clientSecret, {
        payment_method: {
          card,
          billing_details: getBillingDetails(formValues, currentUser),
        },
      });
    })
    .then(confirmResult => {
      if (confirmResult.error) {
        const error = confirmResult.error;
        error.message = error.message || 'Card payment failed';
        throw error;
      }
      return processCheckoutWithPayment(orderParams, requestPaymentParams);
    })
    .then(finishSuccess)
    .catch(err => {
      console.error(err);
      setSubmitting(false);
      if (setShippingPaymentError) {
        setShippingPaymentError(err);
      }

      if (!isTransactionsTransitionInvalidTransition(err)) {
        return refundIfNeeded();
      }

      const txId = pageData?.transaction?.id || reduxTransaction?.id;
      if (!txId || !onFetchTransaction) {
        return refundIfNeeded();
      }

      return onFetchTransaction(txId)
        .then(tx => {
          if (process.getState(tx) === process.states.PAYMENT_EXPIRED) {
            setPageData({ ...pageData, transaction: tx });
            clearData(sessionStorageKey);
            return refundIfNeeded();
          } else if (process.hasPassedState(process.states.PENDING_PAYMENT, tx)) {
            const orderDetailsPath = pathByRouteName('OrderDetailsPage', routeConfiguration, {
              id: tx.id.uuid,
            });
            setOrderPageInitialValues({}, routeConfiguration, dispatch);
            onSubmitCallback();
            history.push(orderDetailsPath);
            return null;
          }
          return refundIfNeeded();
        })
        .catch(() => refundIfNeeded());
    });
};

const onStripeInitialized = (stripe, process, props) => {
  const { paymentIntent, onRetrievePaymentIntent, pageData } = props;
  const tx = pageData?.transaction || null;

  // We need to get up to date PI, if payment is pending but it's not expired.
  const shouldFetchPaymentIntent =
    stripe &&
    !paymentIntent &&
    tx?.id &&
    process?.getState(tx) === process?.states.PENDING_PAYMENT &&
    !hasPaymentExpired(tx, process);

  if (shouldFetchPaymentIntent) {
    const { stripePaymentIntentClientSecret } =
      tx.attributes.protectedData?.stripePaymentIntents?.default || {};

    // Fetch up to date PaymentIntent from Stripe
    onRetrievePaymentIntent({ stripe, stripePaymentIntentClientSecret });
  }
};

/**
 * A component that renders the checkout page with payment.
 *
 * @component
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled - Whether the page should scroll
 * @param {string} props.speculateTransactionError - The error message for the speculate transaction
 * @param {propTypes.transaction} props.speculatedTransaction - The speculated transaction
 * @param {string} props.initiateOrderError - The error message for the initiate order
 * @param {string} props.confirmPaymentError - The error message for the confirm payment
 * @param {intlShape} props.intl - The intl object
 * @param {propTypes.currentUser} props.currentUser - The current user
 * @param {string} props.confirmCardPaymentError - The error message for the confirm card payment
 * @param {propTypes.paymentIntent} props.paymentIntent - The Stripe's payment intent
 * @param {boolean} props.stripeCustomerFetched - Whether the stripe customer has been fetched
 * @param {Object} props.pageData - The page data
 * @param {propTypes.listing} props.pageData.listing - The listing entity
 * @param {boolean} props.showListingImage - A boolean indicating whether images are enabled with this listing type
 * @param {propTypes.transaction} props.pageData.transaction - The transaction entity
 * @param {Object} props.pageData.orderData - The order data
 * @param {string} props.processName - The process name
 * @param {string} props.listingTitle - The listing title
 * @param {string} props.title - The title
 * @param {Function} props.onInitiateOrder - The function to initiate the order
 * @param {Function} props.onConfirmCardPayment - The function to confirm the card payment
 * @param {Function} props.onConfirmPayment - The function to confirm the payment after Stripe call is made
 * @param {Function} props.onFetchTransaction - The function to fetch an up-to-date transaction entity
 * @param {Function} props.onSavePaymentMethod - The function to save the payment method for later use
 * @param {Function} props.onSubmitCallback - The function to submit the callback
 * @param {propTypes.error} props.initiateOrderError - The error message for the initiate order
 * @param {propTypes.error} props.confirmPaymentError - The error message for the confirm payment
 * @param {propTypes.error} props.confirmCardPaymentError - The error message for the confirm card payment
 * @param {propTypes.paymentIntent} props.paymentIntent - The Stripe's payment intent
 * @param {boolean} props.stripeCustomerFetched - Whether the stripe customer has been fetched
 * @param {Object} props.config - The config
 * @param {Object} props.routeConfiguration - The route configuration
 * @param {Object} props.history - The history object
 * @param {Object} props.history.push - The push state function of the history object
 * @returns {JSX.Element}
 */
export const CheckoutPageWithPayment = props => {
  const [submitting, setSubmitting] = useState(false);
  // Initialized stripe library is saved to state - if it's needed at some point here too.
  const [stripe, setStripe] = useState(null);
  const [checkoutStep, setCheckoutStep] = useState(STEP_ADDRESS);
  const [selectedShippingRate, setSelectedShippingRate] = useState(null);
  const [addressSaveInProgress, setAddressSaveInProgress] = useState(false);
  const [shippingPaymentError, setShippingPaymentError] = useState(null);
  const didAutoAdvanceAddress = useRef(false);

  const {
    scrollingDisabled,
    speculateTransactionError,
    speculatedTransaction: speculatedTransactionMaybe,
    initiateOrderError,
    confirmPaymentError,
    intl,
    currentUser,
    confirmCardPaymentError,
    showListingImage,
    paymentIntent,
    retrievePaymentIntentError,
    stripeCustomerFetched,
    pageData,
    processName,
    listingTitle,
    title,
    transactionFieldConfigs = [],
    showTransactionFields,
    config,
    dispatch,
    shipment,
    getShippingRatesInProgress,
    getShippingRatesError,
  } = props;

  // Since the listing data is already given from the ListingPage
  // and stored to handle refreshes, it might not have the possible
  // deleted or closed information in it. If the transaction
  // initiate or the speculative initiate fail due to the listing
  // being deleted or closed, we should dig the information from the
  // errors and not the listing data.
  const listingNotFound =
    isTransactionInitiateListingNotFoundError(speculateTransactionError) ||
    isTransactionInitiateListingNotFoundError(initiateOrderError);

  const { listing, transaction, orderData } = pageData;
  const existingTransaction = ensureTransaction(transaction);
  const speculatedTransaction = ensureTransaction(speculatedTransactionMaybe, {}, null);

  // If existing transaction has line-items, it has gone through one of the request-payment transitions.
  // Otherwise, we try to rely on speculatedTransaction for order breakdown data.
  const tx =
    existingTransaction?.attributes?.lineItems?.length > 0
      ? existingTransaction
      : speculatedTransaction;
  const timeZone = listing?.attributes?.availabilityPlan?.timezone;
  const transactionProcessAlias = listing?.attributes?.publicData?.transactionProcessAlias;
  const priceVariantName = tx.attributes.protectedData?.priceVariantName;

  const txBookingMaybe = tx?.booking?.id ? { booking: tx.booking, timeZone } : {};

  // Show breakdown only when (speculated?) transaction is loaded
  // (i.e. it has an id and lineItems)
  const breakdown =
    tx.id && tx.attributes.lineItems?.length > 0 ? (
      <OrderBreakdown
        className={css.orderBreakdown}
        userRole="customer"
        transaction={tx}
        {...txBookingMaybe}
        currency={config.currency}
        marketplaceName={config.marketplaceName}
      />
    ) : null;

  const totalPrice =
    tx?.attributes?.lineItems?.length > 0 ? getFormattedTotalPrice(tx, intl) : null;

  const process = processName ? getProcess(processName) : null;
  const transitions = process.transitions;
  const isPaymentExpired = hasPaymentExpired(existingTransaction, process);

  // Allow showing page when currentUser is still being downloaded,
  // but show payment form only when user info is loaded.
  const showPaymentForm = !!(
    currentUser &&
    !listingNotFound &&
    !initiateOrderError &&
    !speculateTransactionError &&
    !retrievePaymentIntentError &&
    !isPaymentExpired
  );

  const firstImage = listing?.images?.length > 0 ? listing.images[0] : null;

  const listingLink = (
    <NamedLink
      name="ListingPage"
      params={{ id: listing?.id?.uuid, slug: createSlug(listingTitle) }}
    >
      <FormattedMessage id="CheckoutPage.errorlistingLinkText" />
    </NamedLink>
  );

  const errorMessages = getErrorMessages(
    listingNotFound,
    initiateOrderError,
    isPaymentExpired,
    retrievePaymentIntentError,
    speculateTransactionError,
    listingLink
  );

  const isBooking = processName === BOOKING_PROCESS_NAME;
  const isNegotiation = processName === NEGOTIATION_PROCESS_NAME;

  const txTransitions = existingTransaction?.attributes?.transitions || [];
  const hasInquireTransition = txTransitions.find(tr => tr.transition === transitions.INQUIRE);
  const showInitialMessageInput = !hasInquireTransition && !isNegotiation;

  // Get first and last name of the current user and use it in the StripePaymentForm to autofill the name field
  const userName = currentUser?.attributes?.profile
    ? `${currentUser.attributes.profile.firstName} ${currentUser.attributes.profile.lastName}`
    : null;

  const shippingAddress = getProfileShippingAddress(currentUser);
  const hasAddress = isCompleteShippingAddress(shippingAddress);
  const listingId = listing?.id?.uuid;

  useEffect(() => {
    if (hasAddress && !didAutoAdvanceAddress.current) {
      didAutoAdvanceAddress.current = true;
      setCheckoutStep(STEP_RATES);
    }
  }, [hasAddress]);

  useEffect(() => {
    if (!listingId || !hasAddress || !dispatch) {
      return;
    }
    dispatch(getShippingRates(listingId));
  }, [
    listingId,
    hasAddress,
    shippingAddress.street1,
    shippingAddress.zip,
    shippingAddress.city,
    dispatch,
  ]);

  const handleSaveShippingAddress = values => {
    const nextAddress = { ...values, country: 'US' };
    setAddressSaveInProgress(true);
    dispatch(updateCurrentUserProfile({ protectedData: { shippingAddress: nextAddress } }))
      .then(() => {
        setAddressSaveInProgress(false);
        setSelectedShippingRate(null);
        setCheckoutStep(STEP_RATES);
        return dispatch(getShippingRates(listingId));
      })
      .catch(() => {
        setAddressSaveInProgress(false);
      });
  };

  const initialValuesForStripePayment = {
    name: shippingAddress.name || userName,
    recipientName: shippingAddress.name || userName,
    addressLine1: shippingAddress.street1,
    addressLine2: shippingAddress.streetNo,
    city: shippingAddress.city,
    state: shippingAddress.state,
    postal: shippingAddress.zip,
    country: shippingAddress.country || 'US',
  };
  const askShippingDetails = false;

  const listingLocation = listing?.attributes?.publicData?.location;
  const showPickUpLocation = false;
  const showLocation = (isBooking || isNegotiation) && listingLocation?.address;

  const providerDisplayName = isNegotiation
    ? existingTransaction?.provider?.attributes?.profile?.displayName
    : listing?.author?.attributes?.profile?.displayName;

  const currency =
    existingTransaction?.attributes?.payinTotal?.currency || listing.attributes.price?.currency;
  const isStripeCompatibleCurrency = isValidCurrencyForTransactionProcess(
    transactionProcessAlias,
    currency,
    'stripe'
  );

  const shippingTotalPrice = selectedShippingRate
    ? formatMoney(
        intl,
        new Money(
          Math.round(Number(selectedShippingRate.listedAmount) * 100),
          selectedShippingRate.currency || currency || config.currency
        )
      )
    : totalPrice;

  // Render an error message if the listing is using a non Stripe supported currency
  // and is using a transaction process with Stripe actions (default-booking or default-purchase)
  if (!isStripeCompatibleCurrency) {
    return (
      <Page title={title} scrollingDisabled={scrollingDisabled}>
        <TopbarSimplified />
        <div className={css.contentContainer}>
          <section className={css.incompatibleCurrency}>
            <H4 as="h1" className={css.heading}>
              <FormattedMessage id="CheckoutPage.incompatibleCurrency" />
            </H4>
          </section>
        </div>
      </Page>
    );
  }

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <TopbarSimplified />
      <div className={css.contentContainer}>
        <MobileListingImage
          listingTitle={listingTitle}
          author={listing?.author}
          firstImage={firstImage}
          layoutListingImageConfig={config.layout.listingImage}
          showListingImage={showListingImage}
        />
        <main className={css.orderFormContainer}>
          <div className={css.headingContainer}>
            <H3 as="h1" className={css.heading}>
              {title}
            </H3>
            <H4 as="h2" className={css.detailsHeadingMobile}>
              <FormattedMessage id="CheckoutPage.listingTitle" values={{ listingTitle }} />
            </H4>
          </div>
          <MobileOrderBreakdown
            speculateTransactionErrorMessage={errorMessages.speculateTransactionErrorMessage}
            breakdown={breakdown}
            priceVariantName={priceVariantName}
          />
          <section className={css.paymentContainer}>
            {errorMessages.initiateOrderErrorMessage}
            {errorMessages.listingNotFoundErrorMessage}
            {errorMessages.speculateErrorMessage}
            {errorMessages.retrievePaymentIntentErrorMessage}
            {errorMessages.paymentExpiredMessage}

            {showPaymentForm ? (
              <div className={css.shippingCheckout}>
                <div className={css.checkoutStepNav}>
                  <H4 as="h2" className={css.checkoutStepHeading}>
                    {checkoutStep === STEP_ADDRESS ? (
                      <FormattedMessage id="CheckoutPage.shippingAddressHeading" />
                    ) : checkoutStep === STEP_RATES ? (
                      <FormattedMessage id="CheckoutPage.shippingMethodHeading" />
                    ) : (
                      <FormattedMessage id="CheckoutPage.shippingPaymentHeading" />
                    )}
                  </H4>
                  {checkoutStep !== STEP_ADDRESS && hasAddress ? (
                    <button
                      type="button"
                      className={css.changeAddressButton}
                      onClick={() => setCheckoutStep(STEP_ADDRESS)}
                    >
                      <FormattedMessage id="CheckoutPage.changeAddress" />
                    </button>
                  ) : null}
                </div>

                {checkoutStep === STEP_ADDRESS ? (
                  <ShippingAddressForm
                    className={css.paymentForm}
                    initialValues={shippingAddress}
                    inProgress={addressSaveInProgress}
                    onSubmit={handleSaveShippingAddress}
                    submitTitle={intl.formatMessage({ id: 'ShippingAddressForm.submit' })}
                  />
                ) : null}

                {checkoutStep === STEP_RATES ? (
                  <ShippingMethodForm
                    shipment={shipment}
                    getShippingRatesInProgress={getShippingRatesInProgress}
                    getShippingRatesError={getShippingRatesError}
                    onSelectShippingRate={setSelectedShippingRate}
                    selectedShippingRate={selectedShippingRate}
                    disabledNextStep={!selectedShippingRate}
                    onNextStep={() => setCheckoutStep(STEP_PAY)}
                  />
                ) : null}

                {checkoutStep === STEP_PAY ? (
                  <StripePaymentForm
                    className={css.paymentForm}
                    onSubmit={values =>
                      handleSubmit(values, process, props, stripe, submitting, setSubmitting, {
                        selectedShippingRate,
                        shipment,
                        setShippingPaymentError,
                      })
                    }
                    inProgress={submitting}
                    formId="CheckoutPagePaymentForm"
                    providerDisplayName={providerDisplayName}
                    showInitialMessageInput={showInitialMessageInput}
                    initialValues={initialValuesForStripePayment}
                    initiateOrderError={initiateOrderError}
                    confirmCardPaymentError={confirmCardPaymentError || shippingPaymentError}
                    confirmPaymentError={confirmPaymentError}
                    hasHandledCardPayment={false}
                    loadingData={false}
                    defaultPaymentMethod={null}
                    showSavedCards={false}
                    showSaveCard={false}
                    paymentIntent={paymentIntent}
                    onStripeInitialized={stripeInstance => {
                      setStripe(stripeInstance);
                      return onStripeInitialized(stripeInstance, process, props);
                    }}
                    askShippingDetails={askShippingDetails}
                    showPickUpLocation={showPickUpLocation}
                    showLocation={showLocation}
                    listingLocation={listingLocation}
                    totalPrice={shippingTotalPrice}
                    locale={config.localization.locale}
                    stripePublishableKey={config.stripe.publishableKey}
                    marketplaceName={config.marketplaceName}
                    processName={processName}
                    isFuzzyLocation={config.maps.fuzzy.enabled}
                    transactionFieldConfigs={transactionFieldConfigs}
                    showTransactionFields={showTransactionFields}
                  />
                ) : null}
              </div>
            ) : null}
          </section>
        </main>

        <DetailsSideCard
          listing={listing}
          listingTitle={listingTitle}
          priceVariantName={priceVariantName}
          author={listing?.author}
          firstImage={firstImage}
          layoutListingImageConfig={config.layout.listingImage}
          speculateTransactionErrorMessage={errorMessages.speculateTransactionErrorMessage}
          isInquiryProcess={false}
          processName={processName}
          breakdown={breakdown}
          showListingImage={showListingImage}
          intl={intl}
        />
      </div>
    </Page>
  );
};

export default CheckoutPageWithPayment;
