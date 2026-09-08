import React from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../../../../util/reactIntl';

import { NamedLink } from '../../../../../components';

import css from './MembershipPricingCard.module.css';

const MEMBERSHIP_FEATURE_IDS = [
  'MembershipPricingCard.featureListings',
  'MembershipPricingCard.featureBrowsing',
  'MembershipPricingCard.featureLabels',
  'MembershipPricingCard.featureCredit',
  'MembershipPricingCard.featureRatings',
  'MembershipPricingCard.featureMessaging',
  'MembershipPricingCard.featureHistory',
];

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * Membership pricing card. It is used on the landing page membership section and
 * on the ManageSubscriptionPage.
 *
 * The call to action defaults to a link to the ManageSubscriptionPage. Pass either
 * ctaHref (e.g. a Stripe payment link) or onCtaClick to change that behaviour.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to component's own css.pricingWrap
 * @param {ReactNode} [props.ctaLabel] - The label of the call to action
 * @param {string} [props.ctaHref] - The URL the call to action points to (opened in the same tab)
 * @param {Function} [props.onCtaClick] - The call to action click handler (renders a button)
 * @param {boolean} [props.ctaDisabled] - Whether the call to action is disabled
 * @returns {JSX.Element}
 */
const MembershipPricingCard = props => {
  const { className, ctaLabel, ctaHref, onCtaClick, ctaDisabled = false } = props;

  const label = ctaLabel || <FormattedMessage id="MembershipPricingCard.joinButton" />;

  const ctaMaybe = onCtaClick ? (
    <button type="button" className={css.joinBtn} onClick={onCtaClick} disabled={ctaDisabled}>
      {label}
    </button>
  ) : ctaHref ? (
    // Note: the payment link is opened in the same tab, so that the member
    // returns to the marketplace through Stripe's own return URL.
    <a href={ctaHref} className={css.joinBtn}>
      {label}
    </a>
  ) : (
    <NamedLink name="ManageSubscriptionPage" className={css.joinBtn}>
      {label}
    </NamedLink>
  );

  return (
    <div className={classNames(css.pricingWrap, className)}>
      <div className={css.pricingCard}>
        <div className={css.popularBadge}>
          <FormattedMessage id="MembershipPricingCard.badge" />
        </div>
        <div className={css.planLabel}>
          <FormattedMessage id="MembershipPricingCard.planLabel" />
        </div>
        <div className={css.priceRow}>
          <span className={css.priceDollar}>
            <FormattedMessage id="MembershipPricingCard.priceCurrency" />
          </span>
          <span className={css.priceNum}>
            <FormattedMessage id="MembershipPricingCard.priceAmount" />
          </span>
          <span className={css.pricePer}>
            <FormattedMessage id="MembershipPricingCard.pricePeriod" />
          </span>
        </div>
        <div className={css.priceSub}>
          <FormattedMessage id="MembershipPricingCard.priceSubtitle" />
        </div>
        <hr className={css.priceDivider} />
        <ul className={css.features}>
          {MEMBERSHIP_FEATURE_IDS.map(id => (
            <li key={id} className={css.featureRow}>
              <CheckIcon />
              <FormattedMessage id={id} />
            </li>
          ))}
        </ul>
        {ctaMaybe}
        <div className={css.valueNote}>
          <FormattedMessage
            id="MembershipPricingCard.valueNote"
            values={{ b: msgFragment => <strong>{msgFragment}</strong> }}
          />
        </div>
      </div>
    </div>
  );
};

export default MembershipPricingCard;
