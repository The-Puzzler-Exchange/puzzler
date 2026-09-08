import { displayPrice } from '../../util/configHelpers';
import { richText } from '../../util/richText';

import css from './ListingCard.module.css';

const MIN_LENGTH_FOR_LONG_WORDS = 10;

// Exchanges are paid with credits instead of money, so the card shows the cost of an
// exchange in credits.
const CREDIT_COST_PER_EXCHANGE = 1;

/**
 * Returns all translated and formatted strings for ListingCard so the
 * presentational component can stay simple and aria-labels use the same copy.
 *
 * @param {Object} listing - API entity: listing or ownListing
 * @param {Object} config - app configuration (e.g. from useConfiguration())
 * @param {Object} intl - React Intl instance (e.g. from useIntl())
 * @returns {Object} translations and derived values:
 *   - titlePlain: raw title string (for aria/alt)
 *   - titleFormatted: React nodes from richText(title) for display
 *   - showPrice: whether to show the price block
 *   - priceTooltip: string for the price element's title attribute (tooltip on hover)
 *   - priceMessage: React nodes for the price block content (styled credit cost)
 *   - cardAriaLabel: ready-to-use aria-label for the card link (listing title + plain price line when shown)
 *   - authorName: "ListingCard.author" string containing author's display name
 */
export const getListingCardTranslations = (listing, config, intl) => {
  const { title = '', price, publicData } = listing?.attributes || {};

  const authorDisplayName = listing?.author?.attributes?.profile?.displayName;
  const authorName = intl.formatMessage(
    { id: 'ListingCard.author' },
    { authorName: authorDisplayName }
  );

  const validListingTypes = config.listing.listingTypes || [];
  const { listingType } = publicData || {};
  const listingTypeConfig = validListingTypes.find(conf => conf.listingType === listingType);

  const showPrice = displayPrice(listingTypeConfig) && price != null;

  const creditPrice = intl.formatMessage(
    { id: 'ListingCard.priceInCredits' },
    { count: CREDIT_COST_PER_EXCHANGE }
  );

  // Visible price block uses a JSX span for styling; aria-label needs a plain string.
  const priceMessage = showPrice ? <span className={css.priceValue}>{creditPrice}</span> : '';
  const priceMessagePlain = showPrice ? creditPrice : '';
  const priceTooltip = showPrice ? creditPrice : undefined;

  const cardAriaLabel =
    priceMessagePlain.length > 0
      ? intl.formatMessage(
          { id: 'ListingCard.screenreader.label' },
          { listingTitle: title, formattedPrice: priceMessagePlain }
        )
      : title;

  return {
    titlePlain: title,
    titleFormatted: richText(title, {
      longWordMinLength: MIN_LENGTH_FOR_LONG_WORDS,
      longWordClass: css.longWord,
    }),
    authorName,
    showPrice,
    priceTooltip,
    priceMessage,
    cardAriaLabel,
  };
};
