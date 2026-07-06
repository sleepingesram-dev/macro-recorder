import { kgToLb } from './units';
import { KCAL_PER_KG } from './adaptive';
import { weekdayIndex } from './dates';

export const OBJECTIVES = [
  { key: 'cut', label: 'Fat Loss', hint: 'Endurance Tax — sustainable deficit' },
  { key: 'gain', label: 'Muscle Gain', hint: 'Growth Tithe — controlled surplus' },
  { key: 'recomp', label: 'Recomposition', hint: 'Hold near maintenance, high protein' },
  { key: 'maintain', label: 'Maintenance', hint: 'Guard the line' },
];

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
    fat = (calories * (goal.perLb.fatPct / 100)) / 9;
    carbs = Math.max(0, (calories - protein * 4 - fat * 9) / 4);
  } else {
    protein = (calories * (goal.percent.protein / 100)) / 4;
    carbs = (calories * (goal.percent.carbs / 100)) / 4;
    fat = (calories * (goal.percent.fat / 100)) / 9;
  }
  return { protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) };
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
  const isTraining = cycling.trainingDays.includes(weekdayIndex(dateStr));
  return Math.round(isTraining ? trainCal : restCal);
}

// One call that resolves everything the UI needs for a given day.
export function resolveTargets({ tdee, goal, cycling, weightKg, dateStr }) {
  const base = calorieTarget(tdee, goal.objective === 'maintain' ? 0 : goal.rateKgPerWeek);
  const calories = cycledTarget(base, cycling, dateStr);
  const macros = macroTargets({ calories, goal, weightKg });
  return { baseCalories: base, calories, macros };
}
