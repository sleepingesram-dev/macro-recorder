// Canonical storage units: kg (weight), cm (length), ml (fluids), g (food mass).
// Everything else is a display conversion.

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const ML_PER_FLOZ = 29.5735;

export const kgToLb = (kg) => kg / KG_PER_LB;
export const lbToKg = (lb) => lb * KG_PER_LB;
export const cmToIn = (cm) => cm / CM_PER_IN;
export const inToCm = (inch) => inch * CM_PER_IN;
export const mlToOz = (ml) => ml / ML_PER_FLOZ;
export const ozToMl = (oz) => oz * ML_PER_FLOZ;

export function fmtWeight(kg, unit, decimals = 1) {
  if (kg == null || isNaN(kg)) return '—';
  return unit === 'lb' ? `${kgToLb(kg).toFixed(decimals)} lb` : `${kg.toFixed(decimals)} kg`;
}

export function weightValue(kg, unit) {
  return unit === 'lb' ? kgToLb(kg) : kg;
}

export function weightToKg(value, unit) {
  return unit === 'lb' ? lbToKg(value) : value;
}

export function fmtLength(cm, unit, decimals = 1) {
  if (cm == null || isNaN(cm)) return '—';
  return unit === 'in' ? `${cmToIn(cm).toFixed(decimals)} in` : `${cm.toFixed(decimals)} cm`;
}

export function fmtFluid(ml, unit) {
  if (ml == null || isNaN(ml)) return '—';
  return unit === 'oz' ? `${Math.round(mlToOz(ml))} oz` : `${Math.round(ml)} ml`;
}

// Food serving mass units → grams. 'cup' and 'tbsp' assume water-like density as a
// fallback when a food has no measured serving; foods with real serving data use it.
export const MASS_UNITS = [
  { key: 'g', label: 'g', grams: 1 },
  { key: 'oz', label: 'oz', grams: 28.3495 },
  { key: 'cup', label: 'cup', grams: 240 },
  { key: 'tbsp', label: 'tbsp', grams: 15 },
  { key: 'tsp', label: 'tsp', grams: 5 },
];
