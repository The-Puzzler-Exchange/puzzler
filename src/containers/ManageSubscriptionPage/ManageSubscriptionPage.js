import React, { useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { useConfiguration } from '../../context/configurationContext';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { propTypes } from '../../util/types';
import { ensureCurrentUser } from '../../util/data';
import { showCreateListingLinkForUser } from '../../util/userHelpers';
import { createBillingPortalSession } from '../../util/api';

import { isScrollingDisabled } from '../../ducks/ui.duck';

import { H3, Page, UserNav, LayoutSideNavigation } from '../../components';

import MembershipPricingCard from '../PageBuilder/SectionBuilder/SectionColumns/MembershipPricingCard';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './ManageSubscriptionPage.module.css';

/**
 * Adds the current user's details to the Stripe payment link, so that Stripe can
 * prefill the email and connect the created subscription to the correct user.
 * The client_reference_id is used in the Stripe webhook handler (server/api/stripe/).
 *
 * @param {string} paymentLink - The Stripe payment link
 * @param {propTypes.currentUser} user - The current user
 * @returns {string|null} The payment link with the current user's details
 */
const paymentLinkWithUserParams = (paymentLink, user) => {
  if (!paymentLink) {
    return null;
  }

  const params = new URLSearchParams();
  const email = user?.attributes?.email;
  const userId = user?.id?.uuid;

  if (email) {
    params.set('prefilled_email', email);
  }
  if (userId) {
    params.set('client_reference_id', userId);
  }

  const search = params.toString();
  const separator = paymentLink.includes('?') ? '&' : '?';
  return search ? `${paymentLink}${separator}${search}` : paymentLink;
};

/**
 * The manage subscription page.
 * Members without an active subscription get the membership pricing card with a link
 * to the Stripe payment link. Members with an active subscription see their plan and
 * a call to action to the Stripe Billing Portal, where the subscription can be
 * updated or cancelled.
 *
 * @param {Object} props
 * @param {propTypes.currentUser} [props.currentUser] - The current user
 * @param {boolean} props.scrollingDisabled - Whether the scrolling is disabled
 * @returns {JSX.Element}
 */
export const ManageSubscriptionPageComponent = props => {
  const config = useConfiguration();
  const intl = useIntl();
  const [billingPortalInProgress, setBillingPortalInProgress] = useState(false);
  const [billingPortalError, setBillingPortalError] = useState(null);
  const { currentUser, scrollingDisabled } = props;

  const user = ensureCurrentUser(currentUser);
  const {
    isSubscriptionActive,
    subscriptionStatus,
    subscriptionCurrentPeriodEnd,
    subscriptionCancelAtPeriodEnd,
  } = user?.attributes?.profile?.metadata || {};
  const hasActiveSubscription = !!isSubscriptionActive;
  // Stripe stores the end of the billing period as seconds since the Unix epoch.
  const periodEndDate = subscriptionCurrentPeriodEnd
    ? new Date(subscriptionCurrentPeriodEnd * 1000)
    : null;
  const paymentLink = paymentLinkWithUserParams(config.stripe.subscriptionPaymentLink, user);

  // The billing portal session is created in the server (server/api/stripe/),
  // which looks up the Stripe customer id of the authenticated user.
  const handleManageSubscription = () => {
    setBillingPortalInProgress(true);
    setBillingPortalError(null);

    return createBillingPortalSession()
      .then(response => {
        // Enforce full page load against the Stripe Billing Portal
        if (response?.url && typeof window !== 'undefined') {
          window.location.href = response.url;
        } else {
          setBillingPortalInProgress(false);
        }
      })
      .catch(e => {
        setBillingPortalInProgress(false);
        setBillingPortalError(e);
      });
  };

  const title = intl.formatMessage({ id: 'ManageSubscriptionPage.title' });

  const showManageListingsLink = showCreateListingLinkForUser(config, currentUser);
  const accountSettingsNavProps = {
    currentPage: 'ManageSubscriptionPage',
  };

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSideNavigation
        topbar={
          <>
            <TopbarContainer
              desktopClassName={css.desktopTopbar}
              mobileClassName={css.mobileTopbar}
            />
            <UserNav
              currentPage="ManageSubscriptionPage"
              showManageListingsLink={showManageListingsLink}
            />
          </>
        }
        sideNav={null}
        useAccountSettingsNav
        accountSettingsNavProps={accountSettingsNavProps}
        footer={<FooterContainer />}
        intl={intl}
      >
        <div className={css.content}>
          <H3 as="h1">
            <FormattedMessage id="ManageSubscriptionPage.heading" />
          </H3>

          {hasActiveSubscription ? (
            <div className={css.subscriptionDetails}>
              <div className={css.detailsRow}>
                <span className={css.detailsLabel}>
                  <FormattedMessage id="ManageSubscriptionPage.statusLabel" />
                </span>
                <span className={css.detailsValue}>
                  <FormattedMessage
                    id="ManageSubscriptionPage.statusValue"
                    values={{ status: subscriptionStatus || 'active' }}
                  />
                </span>
              </div>
              {periodEndDate ? (
                <div className={css.detailsRow}>
                  <span className={css.detailsLabel}>
                    <FormattedMessage
                      id={
                        subscriptionCancelAtPeriodEnd
                          ? 'ManageSubscriptionPage.accessEndsLabel'
                          : 'ManageSubscriptionPage.renewsLabel'
                      }
                    />
                  </span>
                  <span className={css.detailsValue}>
                    {intl.formatDate(periodEndDate, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {billingPortalError ? (
            <p className={css.error}>
              <FormattedMessage id="ManageSubscriptionPage.billingPortalError" />
            </p>
          ) : null}

          <div className={css.membershipCard}>
            {hasActiveSubscription ? (
              <MembershipPricingCard
                ctaLabel={<FormattedMessage id="ManageSubscriptionPage.manageSubscriptionButton" />}
                onCtaClick={handleManageSubscription}
                ctaDisabled={billingPortalInProgress}
              />
            ) : (
              <MembershipPricingCard ctaHref={paymentLink} />
            )}
          </div>
        </div>
      </LayoutSideNavigation>
    </Page>
  );
};

const mapStateToProps = state => {
  // Topbar needs user info.
  const { currentUser } = state.user;
  return {
    currentUser,
    scrollingDisabled: isScrollingDisabled(state),
  };
};

const ManageSubscriptionPage = compose(connect(mapStateToProps))(ManageSubscriptionPageComponent);

export default ManageSubscriptionPage;
