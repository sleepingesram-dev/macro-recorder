import { kgToLb } from './units';
import { KCAL_PER_KG } from './adaptive';
import { weekdayIndex } from './dates';

// Atwater factors — the one place kcal-per-gram lives.
export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

export const OBJECTIVES = [
  { key: 'cut', label: 'Fat Loss', hint: 'Endurance Tax — sustainable deficit' },
  { key: 'gain', label: 'Muscle Gain', hint: 'Growth Tithe — controlled surplus' },
  { key: 'recomp', label: 'Recomposition', hint: 'Hold near maintenance, high protein' },
  { key: 'maintain', label: 'Maintenance', hint: 'Guard the line' },
];

// The signed weekly rate the objective actually implies. rateKgPerWeek may
// carry a stale sign after the user switches objectives, so the objective is
// authoritative: cut always means a deficit, gain a surplus, recomp/maintain zero.
export function effectiveRateKgPerWeek(goal) {
  const abs = Math.abs(goal.rateKgPerWeek || 0);
  if (goal.objective === 'cut') return -abs;
  if (goal.objective === 'gain') return abs;
  return 0;
}

// Daily Ration from TDEE + goal rate. Negative rate = deficit.
export function calorieTarget(tdee, rateKgPerWeek) {
  if (tdee == null) return null;
  return Math.max(1000, Math.round(tdee + (rateKgPerWeek * KCAL_PER_KG) / 7));
}

// Macro targets in grams for a given calorie budget.
export function macroTargets({ calories, goal, weightKg }) {
  if (!calories) return null;
  const mode = goal.macroMode;
  let protein, carbs, fat;
  if (mode === 'grams') {
    ({ protein, carbs, fat } = goal.grams);
  } else if (mode === 'perLb') {
    const lb = weightKg ? kgToLb(weightKg) : 160;
    protein = goal.perLb.proteinPerLb * lb;
    fat = (calories * (goal.perLb.fatPct / 100)) / KCAL_PER_G.fat;
    carbs = Math.max(0, (calories - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat) / KCAL_PER_G.carbs);
  } else {
    protein = (calories * (goal.percent.protein / 100)) / KCAL_PER_G.protein;
    carbs = (calories * (goal.percent.carbs / 100)) / KCAL_PER_G.carbs;
    fat = (calories * (goal.percent.fat / 100)) / KCAL_PER_G.fat;
  }
  return { protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) };
}

// True only when cycling is actually applied to this date — the single
// predicate for both the target math and any "Training Day" UI badge.
export function isCycledTrainingDay(cycling, dateStr) {
  if (!cycling?.enabled) return false;
  const nTrain = cycling.trainingDays.length;
  if (nTrain === 0 || nTrain === 7) return false; // no differential — no boost
  return cycling.trainingDays.includes(weekdayIndex(dateStr));
}

// Weekly calorie cycling: boost training days, shave rest days, keep the weekly
// total equal to base × 7.
export function cycledTarget(baseCalories, cycling, dateStr) {
  if (!cycling?.enabled || !baseCalories) return baseCalories;
  const nTrain = cycling.trainingDays.length;
  if (nTrain === 0 || nTrain === 7) return baseCalories;
  const boost = cycling.trainingBoostPct / 100;
  const trainCal = baseCalories * (1 + boost);
  const restCal = (baseCalories * 7 - trainCal * nTrain) / (7 - nTrain);
  return Math.round(isCycledTrainingDay(cycling, dateStr) ? trainCal : restCal);
}

// One call that resolves everything the UI needs for a given day.
export function resolveTargets({ tdee, goal, cycling, weightKg, dateStr }) {
  const base = calorieTarget(tdee, effectiveRateKgPerWeek(goal));
  const calories = cycledTarget(base, cycling, dateStr);
  const macros = macroTargets({ calories, goal, weightKg });
  return { baseCalories: base, calories, macros };
}
