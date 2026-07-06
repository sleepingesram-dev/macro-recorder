import { dateRange, diffDays } from './dates';

// Exponentially-smoothed weight trend (the Hacker's Diet / MacroFactor approach).
// Raw scale weight is noisy — water, sodium, glycogen. The trend is the signal.
export const EMA_ALPHA = 0.25; // per-day smoothing factor

// weights: [{date:'YYYY-MM-DD', kg}] in any order.
// Returns [{date, kg|null, trendKg}] for every day from first to last weigh-in;
// days without a weigh-in carry the trend forward (kg = null).
export function weightTrendSeries(weights) {
  if (!weights?.length) return [];
  const sorted = [...weights].sort((a, b) => (a.date < b.date ? -1 : 1));
  const byDate = new Map(sorted.map((w) => [w.date, w.kg]));
  const days = dateRange(sorted[0].date, sorted[sorted.length - 1].date);
  let trend = sorted[0].kg;
  return days.map((date) => {
    const kg = byDate.has(date) ? byDate.get(date) : null;
    if (kg != null) trend = trend + EMA_ALPHA * (kg - trend);
    return { date, kg, trendKg: trend };
  });
}

// Trend-based rate of change in kg/week over the last `windowDays` of the series.
export function trendRateKgPerWeek(series, windowDays = 14) {
  if (!series || series.length < 2) return null;
  const end = series[series.length - 1];
  let startIdx = series.findIndex((p) => diffDays(p.date, end.date) <= windowDays);
  if (startIdx < 0) startIdx = 0;
  const start = series[startIdx];
  const days = diffDays(start.date, end.date);
  if (days < 5) return null; // too little span to call it a rate
  return ((end.trendKg - start.trendKg) / days) * 7;
}
