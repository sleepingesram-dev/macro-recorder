import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, sumNutrients } from '../db/db';
import { useSettings } from './SettingsContext';
import { weightTrendSeries, trendRateKgPerWeek } from '../lib/trend';
import { adaptiveTdee, coachingCheck } from '../lib/adaptive';
import { formulaTdee, ageFromBirthYear } from '../lib/tdee';
import { resolveTargets } from '../lib/targets';
import {
  computeStreaks,
  backwardStreak,
  evaluateFeats,
  xpAndLevel,
  loadEarnedFeats,
  persistEarnedFeats,
} from '../lib/feats';
import { effectiveRateKgPerWeek } from '../lib/targets';
import { estimatedGL } from '../lib/glycemic';
import { todayStr, addDays, diffDays } from '../lib/dates';

// ── One day's log: entries grouped by meal, totals, water ──
export function useDayLog(date) {
  const { settings } = useSettings();
  const entries = useLiveQuery(() => db.entries.where('date').equals(date).sortBy('ts'), [date]);
  const water = useLiveQuery(() => db.water.get(date), [date]);

  return useMemo(() => {
    const byMeal = {};
    for (const m of settings.meals) byMeal[m.key] = [];
    for (const e of entries || []) {
      if (!byMeal[e.meal]) byMeal[e.meal] = [];
      byMeal[e.meal].push(e);
    }
    const totals = sumNutrients(entries || []);
    totals.gl = (entries || []).reduce((acc, e) => acc + estimatedGL(e), 0);
    return {
      loading: entries === undefined,
      entries: entries || [],
      byMeal,
      totals,
      waterMl: water?.ml || 0,
    };
  }, [entries, water, settings.meals]);
}

// ── The Metabolic Codex: trend, adaptive TDEE, targets, coaching ──
export function useCodex(dateStr = todayStr()) {
  const { settings } = useSettings();
  const weights = useLiveQuery(() => db.weights.toArray(), []);
  // Intake per logged day over the adaptive window (plus margin).
  const since = addDays(todayStr(), -45);
  const recentEntries = useLiveQuery(
    () => db.entries.where('date').aboveOrEqual(since).toArray(),
    []
  );

  return useMemo(() => {
    const loading = weights === undefined || recentEntries === undefined;
    const series = weightTrendSeries(weights || []);
    const latestTrend = series.length ? series[series.length - 1] : null;
    const currentWeightKg = latestTrend?.trendKg ?? settings.profile.startWeightKg ?? null;

    const intakeByDate = new Map();
    for (const e of recentEntries || []) {
      intakeByDate.set(e.date, (intakeByDate.get(e.date) || 0) + (e.kcal || 0));
    }

    const p = settings.profile;
    const baseline = formulaTdee(
      {
        formula: settings.formula,
        sex: p.sex,
        age: ageFromBirthYear(p.birthYear),
        heightCm: p.heightCm,
        weightKg: currentWeightKg,
        bodyFatPct: p.bodyFatPct,
      },
      settings.activity
    );

    const codex = adaptiveTdee({ intakeByDate, weights: weights || [], baseline });
    const actualRate = trendRateKgPerWeek(series, 14);
    const targets = resolveTargets({
      tdee: codex.tdee,
      goal: settings.goal,
      cycling: settings.cycling,
      weightKg: currentWeightKg,
      dateStr,
    });
    const goalRate = effectiveRateKgPerWeek(settings.goal);
    const coaching = coachingCheck({
      actualRateKgPerWeek: actualRate,
      goalRateKgPerWeek: goalRate,
      currentTarget: targets.calories,
    });

    return {
      loading,
      series,
      currentWeightKg,
      latestWeighIn: [...(weights || [])].sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null,
      baseline,
      codex,
      actualRateKgPerWeek: actualRate,
      goalRateKgPerWeek: goalRate,
      targets,
      coaching,
    };
  }, [weights, recentEntries, settings, dateStr]);
}

// ── Feats, XP, streaks — the character sheet ──
// Takes the caller's codexInfo so screens don't mount a second full codex
// subscription. Uses indexed/count queries plus a bounded recent window —
// never a full entries table load. Streak-feats only look back from today,
// and earned feats are persisted (monotonic), so the window is safe.
const STREAK_WINDOW_DAYS = 90;

export function useCharacter(codexInfo) {
  const { settings } = useSettings();
  const windowStart = addDays(todayStr(), -(STREAK_WINDOW_DAYS - 1));
  const loggedDates = useLiveQuery(() => db.entries.orderBy('date').uniqueKeys(), []);
  const totalEntries = useLiveQuery(() => db.entries.count(), []);
  const recentEntries = useLiveQuery(
    () => db.entries.where('date').aboveOrEqual(windowStart).toArray(),
    []
  );
  const weights = useLiveQuery(() => db.weights.count(), []);
  const recipes = useLiveQuery(() => db.recipes.count(), []);
  const customFoods = useLiveQuery(() => db.foods.where('source').equals('custom').count(), []);
  const waterRows = useLiveQuery(
    () => db.water.where('date').aboveOrEqual(windowStart).toArray(),
    []
  );

  return useMemo(() => {
    const loading = loggedDates === undefined || recentEntries === undefined;
    const dates = loggedDates || [];
    const streaks = computeStreaks(dates);

    // per-day macro sums (recent window) for protein/balance streaks
    const byDate = new Map();
    for (const e of recentEntries || []) {
      const t = byDate.get(e.date) || { protein: 0, carbs: 0, fat: 0 };
      t.protein += e.protein || 0;
      t.carbs += e.carbs || 0;
      t.fat += e.fat || 0;
      byDate.set(e.date, t);
    }
    const m = codexInfo?.targets?.macros;
    const proteinDays = m
      ? [...byDate.entries()].filter(([, t]) => t.protein >= m.protein * 0.98).map(([d]) => d)
      : [];
    const within = (v, t) => t > 0 && Math.abs(v - t) / t <= 0.1;
    const balanceDays = m
      ? [...byDate.entries()]
          .filter(([, t]) => within(t.protein, m.protein) && within(t.carbs, m.carbs) && within(t.fat, m.fat))
          .map(([d]) => d)
      : [];
    const waterDays = (waterRows || [])
      .filter((w) => w.ml >= settings.waterTargetMl)
      .map((w) => w.date);

    const stats = {
      totalEntries: totalEntries || 0,
      daysLogged: dates.length,
      bestStreak: streaks.best,
      currentStreak: streaks.current,
      scannedCount: (recentEntries || []).filter((e) => e.viaScan).length,
      recipeCount: recipes || 0,
      customFoodCount: customFoods || 0,
      weighInCount: weights || 0,
      proteinStreak: backwardStreak(proteinDays),
      balanceStreak: backwardStreak(balanceDays),
      waterStreak: backwardStreak(waterDays),
      codexHighConfidence: codexInfo?.codex?.confidence === 'high',
    };
    // merge with the persisted ledger: a feat once earned stays earned
    const earnedBefore = loadEarnedFeats();
    const feats = evaluateFeats(stats).map((f) => ({
      ...f,
      earned: f.earned || earnedBefore.has(f.key),
    }));
    const earnedNow = feats.filter((f) => f.earned).map((f) => f.key);
    if (!loading && earnedNow.length > earnedBefore.size) persistEarnedFeats(earnedNow);
    stats.featsEarned = earnedNow.length;
    const { xp, level, progress, nextAt } = xpAndLevel(stats);
    const dayNumber = Math.max(1, diffDays(settings.profile.startDate, todayStr()) + 1);

    return { loading, stats, feats, xp, level, levelProgress: progress, nextLevelAt: nextAt, dayNumber };
  }, [loggedDates, totalEntries, recentEntries, weights, recipes, customFoods, waterRows, codexInfo, settings]);
}
