// Body-fat % estimators. Estimates, clearly labeled as such in the UI.

// US Navy circumference method (cm). Needs waist+neck (+hips for female).
export function navyBodyFat({ sex, heightCm, waistCm, neckCm, hipsCm }) {
  if (!heightCm || !waistCm || !neckCm) return null;
  const log10 = Math.log10;
  if (sex === 'female') {
    if (!hipsCm) return null;
    return 163.205 * log10(waistCm + hipsCm - neckCm) - 97.684 * log10(heightCm) - 78.387;
  }
  return 86.01 * log10(waistCm - neckCm) - 70.041 * log10(heightCm) + 36.76;
}

// Deurenberg BMI-based formula.
export function deurenbergBodyFat({ weightKg, heightCm, age, sex }) {
  if (!weightKg || !heightCm || !age) return null;
  const bmi = weightKg / (heightCm / 100) ** 2;
  return 1.2 * bmi + 0.23 * age - 10.8 * (sex === 'female' ? 0 : 1) - 5.4;
}

export const MEASUREMENT_TYPES = [
  { key: 'waist', label: 'Waist' },
  { key: 'chest', label: 'Chest' },
  { key: 'hips', label: 'Hips' },
  { key: 'neck', label: 'Neck' },
  { key: 'armL', label: 'Arm (L)' },
  { key: 'armR', label: 'Arm (R)' },
  { key: 'thighL', label: 'Thigh (L)' },
  { key: 'thighR', label: 'Thigh (R)' },
  { key: 'calf', label: 'Calf' },
];
