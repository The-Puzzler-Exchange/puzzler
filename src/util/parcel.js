/**
 * Default parcel size and weight from piece count.
 * 1000-piece weight uses the high end of 1.5–2 lb so the listed rate is not too low.
 */
export const PARCEL_DEFAULTS_BY_PIECE_COUNT = {
  '500': { length: 9, width: 12, height: 2.5, weight: 1 },
  '1000': { length: 11, width: 15, height: 3, weight: 2 },
  '2000': { length: 18, width: 13, height: 3, weight: 3 },
};

export const DEFAULT_WEIGHT_UNIT = 'lb';
export const DEFAULT_DIMENSION_UNIT = 'in';

/**
 * Prefill parcel fields from listing public data and piece count.
 *
 * @param {Object} [publicData]
 * @returns {{ length: number, width: number, height: number, weight: number, weight_unit: string, dimension_unit: string }}
 */
export const getParcelInitialValues = (publicData = {}) => {
  const pieceCount = publicData.no_of_pieces;
  const defaults = PARCEL_DEFAULTS_BY_PIECE_COUNT[pieceCount] || PARCEL_DEFAULTS_BY_PIECE_COUNT['1000'];

  return {
    length: publicData.length != null ? Number(publicData.length) : defaults.length,
    width: publicData.width != null ? Number(publicData.width) : defaults.width,
    height: publicData.height != null ? Number(publicData.height) : defaults.height,
    weight: publicData.weight != null ? Number(publicData.weight) : defaults.weight,
    weight_unit: publicData.weight_unit || DEFAULT_WEIGHT_UNIT,
    dimension_unit: publicData.dimension_unit || DEFAULT_DIMENSION_UNIT,
  };
};

/**
 * True when the listing has a complete parcel for Shippo.
 *
 * @param {Object} [publicData]
 * @returns {boolean}
 */
export const hasCompleteParcel = (publicData = {}) => {
  const { length, width, height, weight } = publicData;
  return [length, width, height, weight].every(value => value != null && Number(value) > 0);
};
