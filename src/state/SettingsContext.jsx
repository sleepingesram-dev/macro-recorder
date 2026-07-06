import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { todayStr } from '../lib/dates';

const KEY = 'chronicle.settings';

export const DEFAULT_MEALS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
];

export const DEFAULT_SETTINGS = {
  onboarded: false,
  profile: {
    name: 'Adventurer',
    sex: 'male', // used only for TDEE formulas
    birthYear: 2000,
    heightCm: 175,
    startWeightKg: null,
    goalWeightKg: null,
    bodyFatPct: null, // enables Katch-McArdle
    startDate: todayStr(), // Day 1 of the Chronicle
  },
  goal: {
    objective: 'cut', // cut | gain | recomp | maintain
    rateKgPerWeek: -0.35, // negative = loss
    macroMode: 'perLb', // percent | grams | perLb
    percent: { protein: 30, carbs: 40, fat: 30 },
    grams: { protein: 150, carbs: 200, fat: 70 },
    perLb: { proteinPerLb: 0.9, fatPct: 28 }, // carbs get the remainder
  },
  formula: 'mifflin', // mifflin | harris | katch
  activity: 1.45, // baseline multiplier until adaptive takes over
  units: { weight: 'lb', height: 'in', fluid: 'oz' },
  cycling: { enabled: false, trainingDays: [1, 3, 5], trainingBoostPct: 10 },
  waterTargetMl: 2500,
  usdaKey: '', // optional personal FoodData Central key; DEMO_KEY used otherwise
  notifications: { logReminder: false },
  meals: DEFAULT_MEALS,
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    // deep-merge one level so new default fields appear after app updates
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    for (const k of ['profile', 'goal', 'units', 'cycling', 'notifications']) {
      merged[k] = { ...DEFAULT_SETTINGS[k], ...(parsed[k] || {}) };
    }
    merged.goal.percent = { ...DEFAULT_SETTINGS.goal.percent, ...(parsed.goal?.percent || {}) };
    merged.goal.grams = { ...DEFAULT_SETTINGS.goal.grams, ...(parsed.goal?.grams || {}) };
    merged.goal.perLb = { ...DEFAULT_SETTINGS.goal.perLb, ...(parsed.goal?.perLb || {}) };
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(load);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings outside provider');
  return ctx;
}
