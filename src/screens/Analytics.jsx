import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, NUTRIENTS } from '../db/db';
import { useSettings } from '../state/SettingsContext';
import { useCodex, useCharacter } from '../state/useChronicle';
import { SectionTitle, Segmented, fmt, EmptyState } from '../components/ui';
import { HistoryLine, MacroPie, AvgVsTargetBars, MealDistribution, CHART, MACRO_COLORS } from '../components/charts';
import { estimatedGL } from '../lib/glycemic';
import { todayStr, addDays, dateRange, fmtShort } from '../lib/dates';
import { kgToLb, fmtWeight, weightValue } from '../lib/units';

const RANGES = [
  { value: 7, label: 'Week' },
  { value: 30, label: 'Month' },
  { value: 90, label: '3 Months' },
  { value: 0, label: 'All' },
];

export default function Analytics() {
  const { settings } = useSettings();
  const [range, setRange] = useState(7);
  const info = useCodex();
  const character = useCharacter(info);

  const start = range === 0 ? '0000-01-01' : addDays(todayStr(), -(range - 1));
  const entries = useLiveQuery(
    () => db.entries.where('date').between(start, todayStr(), true, true).toArray(),
    [start]
  );

  const stats = useMemo(() => computeRangeStats(entries || [], settings), [entries, settings]);
  const t = info.targets;

  return (
    <div className="space-y-4 pb-4">
      <header className="pt-2 flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg text-gold tracking-wide">The Codex</h1>
          <p className="text-[11px] text-ink-3 mt-0.5">Deep records of the chronicle</p>
        </div>
        <Segmented options={RANGES} value={range} onChange={setRange} />
      </header>

      {(!entries || entries.length === 0) && (
        <EmptyState icon="🕮" title="These pages are blank">
          Log provisions and the Codex will fill itself with insight.
        </EmptyState>
      )}

      {entries && entries.length > 0 && (
        <>
          {/* ── Weekly Ledger ── */}
          <WeeklyLedger info={info} settings={settings} />

          {/* ── Averages vs targets ── */}
          <div className="card p-4">
            <p className="label">Daily Averages vs Targets · {stats.daysLogged} days logged</p>
            <AvgVsTargetBars
              rows={[
                { name: 'Calories', avg: stats.avg.kcal, target: t?.calories || 0, unit: 'kcal', color: CHART.gold },
                { name: 'Protein', avg: stats.avg.protein, target: t?.macros?.protein || 0, unit: 'g', color: MACRO_COLORS.protein },
                { name: 'Carbs', avg: stats.avg.carbs, target: t?.macros?.carbs || 0, unit: 'g', color: MACRO_COLORS.carbs },
                { name: 'Fat', avg: stats.avg.fat, target: t?.macros?.fat || 0, unit: 'g', color: MACRO_COLORS.fat },
              ]}
            />
            {info.currentWeightKg && (
              <p className="text-[11px] text-ink-3 mt-3">
                Protein per lb of bodyweight:{' '}
                <span className="font-mono text-ink">
                  {(stats.avg.protein / kgToLb(info.currentWeightKg)).toFixed(2)} g/lb
                </span>
              </p>
            )}
          </div>

          {/* ── Calorie history ── */}
          <div className="card p-4">
            <p className="label">Calorie History</p>
            <HistoryLine data={stats.dailySeries} dataKey="kcal" color={CHART.gold} unit="kcal" targetValue={t?.calories} />
          </div>

          {/* ── Macro composition ── */}
          <div className="card p-4">
            <p className="label">Macro Composition (period)</p>
            <MacroPie protein={stats.total.protein} carbs={stats.total.carbs} fat={stats.total.fat} />
          </div>

          {/* ── Calories by meal ── */}
          <div className="card p-4">
            <p className="label">Ration by Meal · avg kcal</p>
            <MealDistribution data={stats.mealDist} />
            <div className="grid grid-cols-2 gap-1 mt-2">
              {stats.mealDist.map((m) => (
                <p key={m.name} className="text-[11px] text-ink-3">
                  {m.name}: <span className="font-mono text-ink-2">{Math.round(m.pct)}%</span>
                </p>
              ))}
            </div>
          </div>

          {/* ── Micronutrients ── */}
          <div className="card p-4">
            <p className="label">Deeper Nutrients · daily average</p>
            <div className="grid grid-cols-2 gap-x-6">
              {NUTRIENTS.filter((n) => !['kcal', 'protein', 'carbs', 'fat'].includes(n.key)).map((n) => (
                <div key={n.key} className="flex justify-between py-1.5 border-b border-rune/40 text-xs">
                  <span className="text-ink-3">{n.label}</span>
                  <span className="font-mono text-ink">
                    {stats.avg[n.key] >= 10 ? Math.round(stats.avg[n.key]) : stats.avg[n.key].toFixed(1)} {n.unit}
                  </span>
                </div>
              ))}
              <div className="flex justify-between py-1.5 text-xs">
                <span className="text-ink-3">Glycemic load (est.)</span>
                <span className="font-mono text-ink">{Math.round(stats.avgGL)}</span>
              </div>
            </div>
          </div>

          {/* ── Most logged foods ── */}
          <div className="card p-4">
            <p className="label">Most Inscribed Provisions</p>
            {stats.topFoods.length === 0 ? (
              <p className="text-xs text-ink-3">Nothing yet.</p>
            ) : (
              <div className="space-y-1.5">
                {stats.topFoods.map(([name, info2], i) => (
                  <div key={name} className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-[10px] text-gold-dim w-5">{romanize(i + 1)}</span>
                    <span className="text-ink flex-1 truncate">{name}</span>
                    <span className="font-mono text-[11px] text-ink-3">×{info2.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Feats ── */}
      <SectionTitle>Feats of the Chronicler</SectionTitle>
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-ink-2">
            Level <span className="font-mono text-gold-bright">{character.level}</span> · {character.xp.toLocaleString()} XP
          </p>
          <p className="text-[11px] text-ink-3">
            streak: <span className="font-mono text-ink-2">{character.stats?.currentStreak ?? 0}d</span> · best:{' '}
            <span className="font-mono text-ink-2">{character.stats?.bestStreak ?? 0}d</span>
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(character.feats || []).map((f) => (
            <div
              key={f.key}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                f.earned ? 'border-gold/40 bg-gold/5' : 'border-rune bg-surface-2/40 opacity-60'
              }`}
            >
              <span className={`text-lg ${f.earned ? '' : 'grayscale'}`}>{f.icon}</span>
              <div className="min-w-0">
                <p className={`text-xs font-medium ${f.earned ? 'text-gold-bright' : 'text-ink-2'}`}>{f.name}</p>
                <p className="text-[10px] text-ink-3 truncate">{f.desc}</p>
              </div>
              {f.earned && <span className="ml-auto text-verdant-bright text-xs">✓</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function computeRangeStats(entries, settings) {
  const byDate = new Map();
  const byMeal = new Map();
  const foodCounts = new Map();
  const totals = {};
  for (const n of NUTRIENTS) totals[n.key] = 0;
  let totalGL = 0;

  for (const e of entries) {
    if (!byDate.has(e.date)) byDate.set(e.date, { kcal: 0 });
    byDate.get(e.date).kcal += e.kcal || 0;
    for (const n of NUTRIENTS) totals[n.key] += e[n.key] || 0;
    totalGL += estimatedGL(e);
    byMeal.set(e.meal, (byMeal.get(e.meal) || 0) + (e.kcal || 0));
    const fc = foodCounts.get(e.name) || { count: 0 };
    fc.count++;
    foodCounts.set(e.name, fc);
  }

  const daysLogged = Math.max(1, byDate.size);
  const avg = {};
  for (const n of NUTRIENTS) avg[n.key] = totals[n.key] / daysLogged;

  // chart spans the full date range from first logged day to today, so sparse
  // logging and 'All' history are never silently truncated
  const dates = [...byDate.keys()].sort();
  const dailySeries =
    dates.length > 0
      ? dateRange(dates[0], todayStr()).map((d) => ({ date: d, kcal: byDate.get(d)?.kcal ?? null }))
      : [];

  // include meal keys no longer in settings ("retired" categories) so the
  // distribution always sums to 100% of logged calories
  const totalMealKcal = [...byMeal.values()].reduce((a, b) => a + b, 0) || 1;
  const knownKeys = settings.meals.map((m) => m.key);
  const orderedKeys = [...knownKeys, ...[...byMeal.keys()].filter((k) => !knownKeys.includes(k))];
  const mealDist = orderedKeys
    .map((key) => ({
      name: settings.meals.find((m) => m.key === key)?.label || `${key} (retired)`,
      kcal: (byMeal.get(key) || 0) / daysLogged,
      pct: ((byMeal.get(key) || 0) / totalMealKcal) * 100,
    }))
    .filter((m) => m.kcal > 0);

  const topFoods = [...foodCounts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 7);

  return { daysLogged, avg, total: totals, avgGL: totalGL / daysLogged, dailySeries, mealDist, topFoods };
}

function WeeklyLedger({ info, settings }) {
  const weekStart = addDays(todayStr(), -6);
  const entries = useLiveQuery(
    () => db.entries.where('date').between(weekStart, todayStr(), true, true).toArray(),
    []
  );
  const weights = useLiveQuery(
    () => db.weights.where('date').between(weekStart, todayStr(), true, true).toArray(),
    []
  );
  const byDate = new Map();
  for (const e of entries || []) byDate.set(e.date, (byDate.get(e.date) || 0) + (e.kcal || 0));
  const avgKcal = byDate.size ? [...byDate.values()].reduce((a, b) => a + b, 0) / byDate.size : null;
  const avgWeight = weights?.length ? weights.reduce((a, w) => a + w.kg, 0) / weights.length : null;
  const unit = settings.units.weight;
  const rate = info.actualRateKgPerWeek;
  const goal = settings.profile.goalWeightKg;
  const cur = info.currentWeightKg;
  const startW = settings.profile.startWeightKg;
  const progress =
    goal != null && startW != null && Math.abs(startW - goal) > 0.1
      ? Math.max(0, Math.min(1, (startW - cur) / (startW - goal)))
      : null;

  return (
    <div className="card ornate p-4">
      <p className="label">Weekly Ledger · {fmtShort(weekStart)} → {fmtShort(todayStr())}</p>
      <div className="grid grid-cols-2 gap-y-3 mt-2">
        <Ledger k="Avg calories" v={avgKcal != null ? `${fmt.kcal(avgKcal)} kcal` : '—'} />
        <Ledger k="Days logged" v={`${byDate.size}/7`} />
        <Ledger k="Avg weight" v={fmtWeight(avgWeight, unit)} />
        <Ledger
          k="Trend"
          v={
            rate == null
              ? '—'
              : `${rate < 0 ? '↓' : rate > 0 ? '↑' : '→'} ${Math.abs(weightValue(rate, unit)).toFixed(2)} ${unit}/wk`
          }
        />
      </div>
      {progress != null && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-ink-3 mb-1">
            <span>Quest progress</span>
            <span className="font-mono">{Math.round(progress * 100)}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-rune/60 overflow-hidden">
            <div className="h-full bg-verdant-bright rounded-full" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function Ledger({ k, v }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ink-3">{k}</p>
      <p className="font-mono text-sm text-ink mt-0.5">{v}</p>
    </div>
  );
}

function romanize(n) {
  const map = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  return map[n - 1] || n;
}
