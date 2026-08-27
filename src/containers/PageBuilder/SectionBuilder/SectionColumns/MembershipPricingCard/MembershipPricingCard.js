import React from 'react';

import { NamedLink } from '../../../../../components';

import css from './MembershipPricingCard.module.css';

const MEMBERSHIP_FEATURES = [
  'Up to 3 active puzzle listings',
  'Unlimited browsing and exchange requests',
  'USPS label generation — built right in',
  '1 free credit on signup',
  'Member ratings and reviews',
  'Direct messaging with members',
  'Full exchange history and tracking',
];

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * Membership pricing card for the landing page membership section.
 *
 * @component
 * @returns {JSX.Element}
 */
const MembershipPricingCard = () => {
  return (
    <div className={css.pricingWrap}>
      <div className={css.pricingCard}>
        <div className={css.popularBadge}>🧩 Full membership</div>
        <div className={css.planLabel}>Annual plan</div>
        <div className={css.priceRow}>
          <span className={css.priceDollar}>$</span>
          <span className={css.priceNum}>30</span>
          <span className={css.pricePer}>/ year</span>
        </div>
        <div className={css.priceSub}>That&apos;s just $2.50 a month</div>
        <hr className={css.priceDivider} />
        <ul className={css.features}>
          {MEMBERSHIP_FEATURES.map(feature => (
            <li key={feature} className={css.featureRow}>
              <CheckIcon />
              {feature}
            </li>
          ))}
        </ul>
        <NamedLink name="SignupPage" className={css.joinBtn}>
          Join PuzzlerExchange →
        </NamedLink>
        <div className={css.valueNote}>
          A new 1,000-piece puzzle averages <strong>$20–$25</strong>. Just two exchanges and your
          membership pays for itself.
        </div>
      </div>
    </div>
  );
};

export default MembershipPricingCard;
