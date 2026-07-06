import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  BarChart,
  PieChart,
  Pie,
  Cell,
  Line,
  Bar,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import { fmtShort } from '../lib/dates';
import { KCAL_PER_G } from '../lib/targets';

// Validated dark-surface chart palette (see docs/DESIGN.md — CVD-safe, ≥3:1)
export const CHART = {
  gold: '#AC9225', // calories / primary series
  arcane: '#926BBC', // protein / secondary
  verdant: '#4E9E67', // carbs / tertiary
  ember: '#C36A1E', // fat / quaternary
  grid: '#2A2535',
  axis: '#8A8278',
  raw: '#6B6478', // raw weigh-in dots — recessive next to the trend line
};

export const MACRO_COLORS = { protein: CHART.arcane, carbs: CHART.verdant, fat: CHART.ember };

const tooltipStyle = {
  contentStyle: {
    background: '#211D2A',
    border: '1px solid #3A3348',
    borderRadius: 8,
    fontSize: 12,
    fontFamily: '"DM Mono", monospace',
    color: '#E8E4DE',
  },
  labelStyle: { color: '#8A8278', marginBottom: 4 },
  itemStyle: { color: '#E8E4DE', padding: 0 },
  cursor: { stroke: '#3A3348', strokeWidth: 1 },
};

const axisProps = {
  stroke: 'transparent',
  tick: { fill: CHART.axis, fontSize: 11, fontFamily: '"DM Mono", monospace' },
  tickLine: false,
  axisLine: false,
};

// ── Weight: raw dots + smoothed trend line ──
export function WeightChart({ series, unit = 'kg', toDisplay = (v) => v, height = 220, goalKg }) {
  const data = series.map((p) => ({
    date: p.date,
    raw: p.kg != null ? +toDisplay(p.kg).toFixed(1) : null,
    trend: +toDisplay(p.trendKg).toFixed(1),
  }));
  const vals = data.flatMap((d) => [d.raw, d.trend]).filter((v) => v != null);
  if (goalKg != null) vals.push(+toDisplay(goalKg).toFixed(1));
  const min = Math.floor(Math.min(...vals) - 1);
  const max = Math.ceil(Math.max(...vals) + 1);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 14, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="date" {...axisProps} tickFormatter={fmtShort} minTickGap={40} />
        <YAxis {...axisProps} domain={[min, max]} width={52} />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={fmtShort}
          formatter={(v, name) => [`${v} ${unit}`, name === 'trend' ? 'Trend' : 'Weigh-in']}
        />
        {goalKg != null && (
          <ReferenceLine
            y={+toDisplay(goalKg).toFixed(1)}
            stroke={CHART.verdant}
            strokeDasharray="4 4"
            label={{ value: 'goal', fill: CHART.verdant, fontSize: 10, position: 'insideTopRight' }}
          />
        )}
        <Scatter dataKey="raw" fill={CHART.raw} shape={<Dot r={3.5} />} isAnimationActive={false} />
        <Line
          dataKey="trend"
          stroke={CHART.gold}
          strokeWidth={2}
          dot={false}
          type="monotone"
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function Dot({ cx, cy, r = 3.5, fill }) {
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={r} fill={fill || CHART.raw} stroke="#1A1720" strokeWidth={1.5} />;
}

// ── Generic single-series history line ──
export function HistoryLine({ data, dataKey, color = CHART.gold, height = 200, unit = '', targetValue }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 14, bottom: 0, left: -14 }}>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="date" {...axisProps} tickFormatter={fmtShort} minTickGap={40} />
        <YAxis {...axisProps} width={48} domain={['auto', 'auto']} />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={fmtShort}
          formatter={(v) => [`${Math.round(v).toLocaleString()} ${unit}`, dataKey]}
        />
        {targetValue != null && (
          <ReferenceLine y={targetValue} stroke={CHART.arcane} strokeDasharray="4 4" />
        )}
        <Line
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          type="monotone"
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Macro pie (protein / carbs / fat by calories) ──
export function MacroPie({ protein = 0, carbs = 0, fat = 0, size = 170 }) {
  const data = [
    { name: 'Protein', value: Math.max(0, protein * KCAL_PER_G.protein), color: MACRO_COLORS.protein },
    { name: 'Carbs', value: Math.max(0, carbs * KCAL_PER_G.carbs), color: MACRO_COLORS.carbs },
    { name: 'Fat', value: Math.max(0, fat * KCAL_PER_G.fat), color: MACRO_COLORS.fat },
  ];
  const total = data.reduce((a, b) => a + b.value, 0);
  if (total <= 0)
    return <p className="text-xs text-ink-3 text-center py-8">Nothing logged yet — the pie awaits.</p>;
  return (
    <ResponsiveContainer width="100%" height={size}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="88%"
          paddingAngle={2}
          stroke="#1A1720"
          strokeWidth={2}
          isAnimationActive={false}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          {...tooltipStyle}
          formatter={(v, name) => [`${Math.round(v)} kcal · ${Math.round((v / total) * 100)}%`, name]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span style={{ color: '#8A8278', fontSize: 12 }}>{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Averages vs targets bars ──
export function AvgVsTargetBars({ rows }) {
  // rows: [{name, avg, target, color}]
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const pct = r.target > 0 ? r.avg / r.target : 0;
        const variance = r.target > 0 ? ((r.avg - r.target) / r.target) * 100 : null;
        return (
          <div key={r.name}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-ink-2">{r.name}</span>
              <span className="font-mono text-ink">
                {Math.round(r.avg).toLocaleString()} / {Math.round(r.target).toLocaleString()} {r.unit}
                {variance != null && (
                  <span className={variance > 5 ? 'text-ember-bright' : variance < -5 ? 'text-arcane-bright' : 'text-verdant-bright'}>
                    {' '}
                    ({variance > 0 ? '+' : ''}
                    {Math.round(variance)}%)
                  </span>
                )}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-rune/60 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, pct * 100)}%`, background: r.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Calories by meal distribution ──
export function MealDistribution({ data, height = 180 }) {
  // data: [{name, kcal}]
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis {...axisProps} width={48} />
        <Tooltip {...tooltipStyle} formatter={(v) => [`${Math.round(v).toLocaleString()} kcal`, 'Average']} />
        <Bar dataKey="kcal" fill={CHART.gold} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
