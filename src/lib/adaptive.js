import { weightTrendSeries } from './trend';
import { diffDays, lastNDays } from './dates';

export const KCAL_PER_KG = 7700; // energy density of tissue change (mixed)
export const MIN_DAYS_FOR_ADAPTIVE = 14;
export const ADAPTIVE_WINDOW = 28; // analyse at most the last 4 weeks

// Least-squares slope (kg/day) over raw weigh-ins — unbiased under noise,
// immune to the EMA's warm-up lag when history is short.
function olsSlopePerDay(points) {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

// ── The Metabolic Codex — adaptive expenditure ──
//
// Energy balance identity over a window of D days:
//   avgIntake − TDEE = (weight slope in kg/day × 7700)
// so:
//   TDEE = avgIntake − slope × 7700
//
// The slope comes from a least-squares fit over the window's raw weigh-ins
// (the display trend uses an EMA, but the EMA lags while warming up, which
// would bias the estimate early on). The estimate is blended with the formula
// baseline in proportion to data quality, and every number used is returned
// so the UI can show the math.
//
// intakeByDate: Map 'YYYY-MM-DD' → kcal (only days that were actually logged)
// weights:      [{date, kg}]
// baseline:     formula TDEE (number | null)
export function adaptiveTdee({ intakeByDate, weights, baseline, endDate }) {
  const series = weightTrendSeries(weights);
  const result = {
    tdee: baseline,
    baseline,
    adaptive: null,
    blendWeight: 0,
    confidence: 'none',
    confidenceScore: 0,
    daysLogged: 0,
    windowDays: 0,
    avgIntake: null,
    deltaTrendKg: null,
    math: null,
  };
  if (!series.length) return result;

  // Window: last ADAPTIVE_WINDOW days that the trend series covers, ending at
  // the most recent weigh-in (not endDate — no data beyond the last weigh-in).
  const seriesEnd = series[series.length - 1];
  const windowed = series.filter((p) => diffDays(p.date, seriesEnd.date) < ADAPTIVE_WINDOW);
  if (windowed.length < 2) return result;

  const start = windowed[0];
  const end = seriesEnd;
  const windowDays = diffDays(start.date, end.date);
  if (windowDays < 7) return result;

  const daysInWindow = lastNDays(windowDays + 1, end.date);
  const loggedKcals = daysInWindow
    .map((d) => intakeByDate.get(d))
    .filter((v) => v != null && v > 0);
  const weighIns = windowed.filter((p) => p.kg != null).length;

  result.windowDays = windowDays;
  result.daysLogged = loggedKcals.length;
  if (loggedKcals.length < 5) return result;

  const avgIntake = loggedKcals.reduce((a, b) => a + b, 0) / loggedKcals.length;
  const rawPoints = windowed
    .filter((p) => p.kg != null)
    .map((p) => ({ x: diffDays(start.date, p.date), y: p.kg }));
  const slope = olsSlopePerDay(rawPoints);
  if (slope == null) return result;
  const deltaTrendKg = slope * windowDays; // fitted change across the window
  const dailyImbalance = slope * KCAL_PER_KG;
  const adaptive = avgIntake - dailyImbalance;

  // Confidence: how completely the window was logged and weighed, and whether
  // we have the minimum span for the energy-balance identity to mean anything.
  const logCoverage = loggedKcals.length / (windowDays + 1);
  const weighCoverage = weighIns / (windowDays + 1);
  const spanFactor = Math.min(1, windowDays / MIN_DAYS_FOR_ADAPTIVE);
  const score = Math.round(100 * (0.5 * logCoverage + 0.3 * weighCoverage + 0.2 * spanFactor));
  const confidence = score >= 75 ? 'high' : score >= 50 ? 'moderate' : score >= 30 ? 'low' : 'none';

  // Below the minimum span, the formula baseline stands alone.
  const blendWeight =
    windowDays < MIN_DAYS_FOR_ADAPTIVE ? 0 : Math.min(0.9, score / 100);

  const tdee =
    baseline == null
      ? adaptive
      : blendWeight * adaptive + (1 - blendWeight) * baseline;

  return {
    ...result,
    tdee,
    adaptive,
    blendWeight,
    confidence,
    confidenceScore: score,
    avgIntake,
    deltaTrendKg,
    math: {
      windowStart: start.date,
      windowEnd: end.date,
      windowDays,
      daysLogged: loggedKcals.length,
      weighIns,
      avgIntake: Math.round(avgIntake),
      deltaTrendKg: +deltaTrendKg.toFixed(2),
      kcalPerKg: KCAL_PER_KG,
      dailyImbalance: Math.round(dailyImbalance),
      adaptiveTdee: Math.round(adaptive),
      baselineTdee: baseline == null ? null : Math.round(baseline),
      blendWeight: +blendWeight.toFixed(2),
      finalTdee: Math.round(tdee),
    },
  };
}

// ── Coaching check — is the current intake producing the goal rate? ──
// Returns a recommendation with its full derivation.
export function coachingCheck({ actualRateKgPerWeek, goalRateKgPerWeek, currentTarget }) {
  if (actualRateKgPerWeek == null || currentTarget == null) return null;
  const rateGapKgPerWeek = actualRateKgPerWeek - goalRateKgPerWeek;
  const dailyAdjustment = Math.round((rateGapKgPerWeek * KCAL_PER_KG) / 7);
  const tolerance = 60; // kcal/day — inside this, hold steady
  let verdict = 'hold';
  if (dailyAdjustment > tolerance) verdict = 'reduce';
  else if (dailyAdjustment < -tolerance) verdict = 'increase';
  return {
    verdict, // reduce | increase | hold
    dailyAdjustment, // + means eat less by this much, − means eat more
    suggestedTarget: Math.round(currentTarget - dailyAdjustment),
    math: {
      actualRateKgPerWeek: +actualRateKgPerWeek.toFixed(3),
      goalRateKgPerWeek: +goalRateKgPerWeek.toFixed(3),
      rateGapKgPerWeek: +rateGapKgPerWeek.toFixed(3),
      kcalPerKg: KCAL_PER_KG,
      formula: '(actual − goal rate, kg/wk) × 7700 ÷ 7',
    },
  };
}
