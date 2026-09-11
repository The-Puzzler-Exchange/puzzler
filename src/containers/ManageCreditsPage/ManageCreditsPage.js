import React, { useEffect, useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { useConfiguration } from '../../context/configurationContext';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { propTypes } from '../../util/types';
import { showCreateListingLinkForUser } from '../../util/userHelpers';
import { formatMoney } from '../../util/currency';
import { types as sdkTypes } from '../../util/sdkLoader';
import { createCreditCheckoutSession, fetchCredits } from '../../util/api';

import { isScrollingDisabled } from '../../ducks/ui.duck';

import {
  H3,
  H4,
  IconSpinner,
  Page,
  PrimaryButton,
  UserNav,
  LayoutSideNavigation,
} from '../../components';

import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './ManageCreditsPage.module.css';

const { Money } = sdkTypes;

/**
 * The manage credits page.
 * Shows the current credit balance and the credit history of the current user.
 * The credits are stored in Firestore, see server/api/credits/.
 *
 * @param {Object} props
 * @param {propTypes.currentUser} [props.currentUser] - The current user
 * @param {boolean} props.scrollingDisabled - Whether the scrolling is disabled
 * @returns {JSX.Element}
 */
export const ManageCreditsPageComponent = props => {
  const config = useConfiguration();
  const intl = useIntl();
  const [credits, setCredits] = useState(null);
  const [fetchInProgress, setFetchInProgress] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);
  const { currentUser, scrollingDisabled } = props;

  useEffect(() => {
    let isActive = true;

    fetchCredits()
      .then(response => {
        if (isActive) {
          setCredits(response);
          setFetchInProgress(false);
        }
      })
      .catch(e => {
        if (isActive) {
          setFetchError(e);
          setFetchInProgress(false);
        }
      });

    // Don't update the state of an unmounted page.
    return () => {
      isActive = false;
    };
  }, []);

  // The member is redirected to Stripe, and back to this page once they are done.
  // The bought credit is awarded by the Stripe webhook, so the balance may land here a
  // moment after the member does.
  const handlePurchaseCredit = () => {
    setPurchaseInProgress(true);
    setPurchaseError(null);

    return createCreditCheckoutSession()
      .then(response => {
        if (response?.url && typeof window !== 'undefined') {
          window.location.href = response.url;
        } else {
          setPurchaseInProgress(false);
        }
      })
      .catch(e => {
        setPurchaseInProgress(false);
        setPurchaseError(e);
      });
  };

  const title = intl.formatMessage({ id: 'ManageCreditsPage.title' });
  const creditPrice = formatMoney(
    intl,
    new Money(config.stripe.creditPriceInSubunits, config.stripe.creditCurrency)
  );

  const showManageListingsLink = showCreateListingLinkForUser(config, currentUser);
  const accountSettingsNavProps = {
    currentPage: 'ManageCreditsPage',
  };

  const entries = credits?.entries || [];

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
              currentPage="ManageCreditsPage"
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
            <FormattedMessage id="ManageCreditsPage.heading" />
          </H3>

          {fetchInProgress ? (
            <div className={css.spinner}>
              <IconSpinner />
            </div>
          ) : fetchError ? (
            <p className={css.error}>
              <FormattedMessage id="ManageCreditsPage.fetchFailed" />
            </p>
          ) : (
            <>
              <div className={css.balanceCard}>
                <span className={css.balanceLabel}>
                  <FormattedMessage id="ManageCreditsPage.balanceLabel" />
                </span>
                <span className={css.balanceValue}>{credits.balance}</span>
                <span className={css.balanceUnit}>
                  <FormattedMessage
                    id="ManageCreditsPage.balanceUnit"
                    values={{ count: credits.balance }}
                  />
                </span>
              </div>

              {purchaseError ? (
                <p className={css.error}>
                  <FormattedMessage id="ManageCreditsPage.purchaseFailed" />
                </p>
              ) : null}

              <PrimaryButton
                className={css.purchaseButton}
                type="button"
                inProgress={purchaseInProgress}
                disabled={purchaseInProgress}
                onClick={handlePurchaseCredit}
              >
                <FormattedMessage
                  id="ManageCreditsPage.purchaseButton"
                  values={{ price: creditPrice }}
                />
              </PrimaryButton>

              <H4 as="h2" className={css.historySubtitle}>
                <FormattedMessage id="ManageCreditsPage.historySubtitle" />
              </H4>

              {entries.length === 0 ? (
                <p className={css.noEntries}>
                  <FormattedMessage id="ManageCreditsPage.noEntries" />
                </p>
              ) : (
                <ul className={css.entries}>
                  {entries.map(entry => (
                    <li key={entry.id} className={css.entry}>
                      <div className={css.entryInfo}>
                        <span className={css.entryDescription}>
                          <FormattedMessage
                            id="ManageCreditsPage.entryDescription"
                            values={{
                              type: entry.type,
                              description: entry.description || entry.type,
                            }}
                          />
                        </span>
                        {entry.createdAt ? (
                          <span className={css.entryDate}>
                            {intl.formatDate(new Date(entry.createdAt), {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                        ) : null}
                      </div>
                      <span className={entry.amount < 0 ? css.entryAmountSpent : css.entryAmount}>
                        {intl.formatNumber(entry.amount, { signDisplay: 'always' })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
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

const ManageCreditsPage = compose(connect(mapStateToProps))(ManageCreditsPageComponent);

export default ManageCreditsPage;
