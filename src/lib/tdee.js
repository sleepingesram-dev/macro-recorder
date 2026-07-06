// Baseline TDEE formulas. These seed the Metabolic Codex until the adaptive
// engine has enough real data to take over.

export const FORMULAS = [
  { key: 'mifflin', label: 'Mifflin-St Jeor', needsBodyFat: false },
  { key: 'harris', label: 'Harris-Benedict (revised)', needsBodyFat: false },
  { key: 'katch', label: 'Katch-McArdle', needsBodyFat: true },
];

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'Sedentary', desc: 'Desk-bound, little movement' },
  { value: 1.35, label: 'Lightly active', desc: 'Walks, light training 1–3×/wk' },
  { value: 1.45, label: 'Moderately active', desc: 'Training 3–5×/wk' },
  { value: 1.6, label: 'Very active', desc: 'Hard training 6–7×/wk' },
  { value: 1.75, label: 'Extremely active', desc: 'Physical job + training' },
];

export function bmr({ formula, sex, age, heightCm, weightKg, bodyFatPct }) {
  if (!weightKg || !heightCm || !age) return null;
  switch (formula) {
    case 'harris':
      return sex === 'female'
        ? 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age
        : 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age;
    case 'katch': {
      if (bodyFatPct == null) return null;
      const lbm = weightKg * (1 - bodyFatPct / 100);
      return 370 + 21.6 * lbm;
    }
    case 'mifflin':
    default:
      return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'female' ? -161 : 5);
  }
}

export function formulaTdee(profileArgs, activity) {
  const b = bmr(profileArgs);
  return b == null ? null : b * activity;
}

export function ageFromBirthYear(birthYear) {
  return new Date().getFullYear() - birthYear;
}
