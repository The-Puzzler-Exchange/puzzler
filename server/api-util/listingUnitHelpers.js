const weightUnitToGrams = {
  g: 1,
  kg: 1000,
  lb: 453.59237,
  oz: 28.349523125,
};

const parseWeightToGrams = (weight, weightUnit) => {
  if (!weightUnit) return Number(weight);

  const unit = weightUnit.toLowerCase();
  if (!(unit in weightUnitToGrams)) {
    throw new Error(`Unsupported weight unit: ${weightUnit}`);
  }

  return Number(weight) * weightUnitToGrams[unit];
};

const dimensionUnitToCm = {
  cm: 1,
  in: 2.54,
  ft: 30.48,
  mm: 0.1,
  m: 100,
  yd: 91.44,
};

const parseDimensionToCm = (dimension, dimensionUnit) => {
  if (!dimensionUnit) return Number(dimension);

  const unit = dimensionUnit.toLowerCase();
  if (!(unit in dimensionUnitToCm)) {
    throw new Error(`Unsupported dimension unit: ${dimensionUnit}`);
  }

  return Number(dimension) * dimensionUnitToCm[unit];
};

module.exports = {
  parseWeightToGrams,
  parseDimensionToCm,
};
