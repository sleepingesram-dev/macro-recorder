import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useSettings } from '../state/SettingsContext';
import { useCodex } from '../state/useChronicle';
import { SectionTitle, Sheet, Field, Segmented, fmt, EmptyState } from '../components/ui';
import { WeightChart, HistoryLine, CHART } from '../components/charts';
import { weightValue, inToCm, cmToIn, fmtWeight } from '../lib/units';
import { navyBodyFat, deurenbergBodyFat, MEASUREMENT_TYPES } from '../lib/bodyfat';
import { ageFromBirthYear } from '../lib/tdee';
import { todayStr, fmtShort } from '../lib/dates';

export default function Progress() {
  const { settings } = useSettings();
  const info = useCodex();
  const [showCodexMath, setShowCodexMath] = useState(false);
  const [measureOpen, setMeasureOpen] = useState(false);
  const unit = settings.units.weight;
  const toDisplay = (v) => weightValue(v, unit);

  const rate = info.actualRateKgPerWeek;
  const rateDisp = rate == null ? null : weightValue(rate, unit);

  return (
    <div className="space-y-4 pb-4">
      <header className="pt-2">
        <h1 className="font-display text-lg text-gold tracking-wide">The Long Road</h1>
        <p className="text-[11px] text-ink-3 mt-0.5">Weight, trend & the Metabolic Codex</p>
      </header>

      {/* ── Weight trend ── */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="label !mb-0">Weight & Trend</p>
          {info.latestWeighIn && (
            <p className="font-mono text-xs text-ink-2">
              last: {fmtWeight(info.latestWeighIn.kg, unit)} · {fmtShort(info.latestWeighIn.date)}
            </p>
          )}
        </div>
        {info.series.length >= 2 ? (
          <>
            <WeightChart
              series={info.series}
              unit={unit}
              toDisplay={toDisplay}
              goalKg={settings.profile.goalWeightKg}
            />
            <div className="flex items-center gap-4 mt-1 text-[10px] text-ink-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded" style={{ background: CHART.gold }} /> trend
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: CHART.raw }} /> weigh-ins
              </span>
            </div>
          </>
        ) : (
          <EmptyState icon="⚖" title="The road needs footprints">
            Record weigh-ins from the Chronicle screen — two or more reveal the trend.
          </EmptyState>
        )}
        {rateDisp != null && (
          <p className="text-sm text-ink-2 mt-3 leading-relaxed">
            Your trend suggests you are{' '}
            <span className={rate < -0.02 ? 'text-verdant-bright' : rate > 0.02 ? 'text-ember-bright' : 'text-ink'}>
              {Math.abs(rateDisp) < 0.05 ? 'holding steady' : rate < 0 ? `losing ~${Math.abs(rateDisp).toFixed(2)} ${unit}/week` : `gaining ~${rateDisp.toFixed(2)} ${unit}/week`}
            </span>
            .
          </p>
        )}
      </div>

      {/* ── Metabolic Codex ── */}
      <div className="card ornate p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="label">Metabolic Codex</p>
            <p className="font-mono text-2xl text-ink">{fmt.kcal(info.codex.tdee)} <span className="text-xs text-ink-2">kcal/day</span></p>
          </div>
          <ConfidenceRune confidence={info.codex.confidence} score={info.codex.confidenceScore} />
        </div>
        <p className="text-[11px] text-ink-3 mt-2">
          {info.codex.confidence === 'none'
            ? `Formula baseline (${settings.formula}). Log meals and weigh-ins for ~2 weeks and the Codex learns your true expenditure.`
            : `Learned from ${info.codex.daysLogged} logged days across ${info.codex.windowDays} days of weight trend.`}
        </p>
        {info.codex.math && (
          <>
            <button className="text-[11px] text-gold-dim hover:text-gold mt-2" onClick={() => setShowCodexMath((s) => !s)}>
              {showCodexMath ? '− Hide the math' : '+ Show the math'}
            </button>
            {showCodexMath && <CodexMath math={info.codex.math} />}
          </>
        )}
      </div>

      {/* ── Daily Ration & coaching ── */}
      <RationCard info={info} unit={unit} />

      {/* ── Body measurements ── */}
      <SectionTitle
        right={
          <button className="text-[11px] text-gold-dim hover:text-gold" onClick={() => setMeasureOpen(true)}>
            + Record
          </button>
        }
      >
        Measurements
      </SectionTitle>
      <MeasurementSection />

      {/* ── Estimated body fat ── */}
      <BodyFatCard info={info} />

      {/* ── Progress photos ── */}
      <SectionTitle>Likenesses</SectionTitle>
      <PhotoGrid />

      <MeasureSheet open={measureOpen} onClose={() => setMeasureOpen(false)} />
    </div>
  );
}

function ConfidenceRune({ confidence, score }) {
  const map = {
    none: { color: '#575047', label: 'no data' },
    low: { color: '#C4622D', label: 'low' },
    moderate: { color: '#C9A84C', label: 'moderate' },
    high: { color: '#4A7C59', label: 'high' },
  };
  const m = map[confidence] || map.none;
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wider text-ink-3">confidence</p>
      <p className="text-sm font-medium" style={{ color: m.color }}>
        {m.label}
        {score > 0 && <span className="font-mono text-[10px] text-ink-3"> · {score}/100</span>}
      </p>
    </div>
  );
}

function CodexMath({ math }) {
  const Row = ({ k, v }) => (
    <div className="flex justify-between py-1 border-b border-rune/40 last:border-0">
      <span className="text-ink-3">{k}</span>
      <span className="font-mono text-ink">{v}</span>
    </div>
  );
  return (
    <div className="mt-2 text-[11px] bg-surface-2 rounded-lg p-3">
      <Row k="Window" v={`${fmtShort(math.windowStart)} → ${fmtShort(math.windowEnd)} (${math.windowDays}d)`} />
      <Row k="Days logged / weigh-ins" v={`${math.daysLogged} / ${math.weighIns}`} />
      <Row k="Avg intake" v={`${math.avgIntake.toLocaleString()} kcal`} />
      <Row k="Δ weight (least-squares fit)" v={`${math.deltaTrendKg} kg`} />
      <Row k="Daily imbalance (Δkg × 7700 ÷ days)" v={`${math.dailyImbalance} kcal`} />
      <Row k="Adaptive TDEE (intake − imbalance)" v={`${math.adaptiveTdee.toLocaleString()} kcal`} />
      {math.baselineTdee != null && <Row k="Formula baseline" v={`${math.baselineTdee.toLocaleString()} kcal`} />}
      <Row k="Blend (adaptive weight)" v={`${Math.round(math.blendWeight * 100)}%`} />
      <Row k="Final estimate" v={`${math.finalTdee.toLocaleString()} kcal`} />
    </div>
  );
}

function RationCard({ info, unit }) {
  const [showMath, setShowMath] = useState(false);
  const c = info.coaching;
  const t = info.targets;
  if (!t?.calories) return null;
  const goalRateDisp = weightValue(info.goalRateKgPerWeek, unit);
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="label">Daily Ration</p>
          <p className="font-mono text-2xl text-gold-bright">
            {fmt.kcal(t.calories)} <span className="text-xs text-ink-2">kcal</span>
          </p>
          <p className="text-[11px] text-ink-3 mt-1">
            goal: {goalRateDisp === 0 ? 'maintain' : `${goalRateDisp > 0 ? '+' : ''}${goalRateDisp.toFixed(2)} ${unit}/week`}
          </p>
        </div>
        {c && (
          <span
            className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${
              c.verdict === 'hold'
                ? 'text-verdant-bright border-verdant/40 bg-verdant/10'
                : c.verdict === 'reduce'
                  ? 'text-ember-bright border-ember/40 bg-ember/10'
                  : 'text-arcane-bright border-arcane/40 bg-arcane/10'
            }`}
          >
            {c.verdict === 'hold' ? '✓ on course' : c.verdict === 'reduce' ? 'ease the ration' : 'raise the ration'}
          </span>
        )}
      </div>
      {c && c.verdict !== 'hold' && (
        <p className="text-sm text-ink-2 mt-3">
          The trend is {c.verdict === 'reduce' ? 'behind' : 'ahead of'} your goal rate. Consider{' '}
          <span className="font-mono text-ink">{fmt.kcal(c.suggestedTarget)} kcal</span> (
          {c.dailyAdjustment > 0 ? '−' : '+'}
          {fmt.kcal(Math.abs(c.dailyAdjustment))}/day).
        </p>
      )}
      {c && (
        <>
          <button className="text-[11px] text-gold-dim hover:text-gold mt-2" onClick={() => setShowMath((s) => !s)}>
            {showMath ? '− Hide the math' : '+ Show the math'}
          </button>
          {showMath && (
            <div className="mt-2 text-[11px] bg-surface-2 rounded-lg p-3 font-mono text-ink-2 space-y-1">
              <p>actual rate: {c.math.actualRateKgPerWeek} kg/wk</p>
              <p>goal rate: {c.math.goalRateKgPerWeek} kg/wk</p>
              <p>gap: {c.math.rateGapKgPerWeek} kg/wk</p>
              <p>adjustment = gap × 7700 ÷ 7 = {c.dailyAdjustment} kcal/day</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MeasurementSection() {
  const { settings } = useSettings();
  const rows = useLiveQuery(() => db.measurements.orderBy('date').toArray(), []);
  const unit = settings.units.height === 'in' ? 'in' : 'cm';
  const byType = useMemo(() => {
    const m = new Map();
    for (const r of rows || []) {
      if (!m.has(r.type)) m.set(r.type, []);
      m.get(r.type).push(r);
    }
    return m;
  }, [rows]);

  if (!rows || rows.length === 0)
    return (
      <EmptyState icon="📏" title="No measurements yet">
        Waist, chest, arms — the tape tells truths the scale hides.
      </EmptyState>
    );

  return (
    <div className="space-y-3">
      {MEASUREMENT_TYPES.filter((t) => byType.has(t.key)).map((t) => {
        const series = byType.get(t.key).map((r) => ({
          date: r.date,
          value: +(unit === 'in' ? cmToIn(r.cm) : r.cm).toFixed(1),
        }));
        const latest = series[series.length - 1];
        return (
          <div key={t.key} className="card p-4">
            <div className="flex justify-between items-baseline mb-1">
              <p className="label !mb-0">{t.label}</p>
              <p className="font-mono text-sm text-ink">
                {latest.value} {unit}
              </p>
            </div>
            {series.length >= 2 ? (
              <HistoryLine data={series} dataKey="value" color={CHART.arcane} height={120} unit={unit} />
            ) : (
              <p className="text-[11px] text-ink-3">One point so far — record again to draw the line.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MeasureSheet({ open, onClose }) {
  const { settings } = useSettings();
  const [type, setType] = useState('waist');
  const [val, setVal] = useState('');
  const unit = settings.units.height === 'in' ? 'in' : 'cm';
  async function save() {
    const v = parseFloat(val);
    if (!v || v <= 0) return;
    await db.measurements.add({ date: todayStr(), type, cm: unit === 'in' ? inToCm(v) : v });
    setVal('');
    onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Record Measurement">
      <div className="space-y-4">
        <Field label="Site">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {MEASUREMENT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Measurement (${unit})`}>
          <input className="input" type="number" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
        </Field>
        <button className="btn-gold w-full" onClick={save}>
          Record
        </button>
      </div>
    </Sheet>
  );
}

function BodyFatCard({ info }) {
  const { settings } = useSettings();
  const rows = useLiveQuery(() => db.measurements.orderBy('date').toArray(), []);
  const [method, setMethod] = useState('navy');
  const p = settings.profile;

  const latest = (type) => {
    const r = (rows || []).filter((x) => x.type === type);
    return r.length ? r[r.length - 1].cm : null;
  };
  const navy = navyBodyFat({
    sex: p.sex,
    heightCm: p.heightCm,
    waistCm: latest('waist'),
    neckCm: latest('neck'),
    hipsCm: latest('hips'),
  });
  const deuren = deurenbergBodyFat({
    weightKg: info.currentWeightKg,
    heightCm: p.heightCm,
    age: ageFromBirthYear(p.birthYear),
    sex: p.sex,
  });
  const value = method === 'navy' ? navy : deuren;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="label !mb-0">Estimated Body Fat</p>
        <Segmented
          options={[
            { value: 'navy', label: 'Navy tape' },
            { value: 'deurenberg', label: 'BMI-based' },
          ]}
          value={method}
          onChange={setMethod}
        />
      </div>
      {value != null && isFinite(value) ? (
        <p className="font-mono text-2xl text-ink">
          {value.toFixed(1)}
          <span className="text-sm text-ink-2">%</span>
          <span className="text-[10px] text-ink-3 ml-2">estimate</span>
        </p>
      ) : (
        <p className="text-xs text-ink-3">
          {method === 'navy'
            ? `Needs waist + neck${p.sex === 'female' ? ' + hips' : ''} measurements.`
            : 'Needs a current weight.'}
        </p>
      )}
    </div>
  );
}

function PhotoGrid() {
  const photos = useLiveQuery(() => db.photos.orderBy('date').reverse().toArray(), []);
  const [viewing, setViewing] = useState(null);
  // object URLs pin their blobs until revoked — build in an effect and revoke
  // the previous set whenever photos change or the grid unmounts
  const [urls, setUrls] = useState(() => new Map());
  useEffect(() => {
    const m = new Map();
    for (const p of photos || []) m.set(p.id, URL.createObjectURL(p.blob));
    setUrls(m);
    return () => {
      for (const u of m.values()) URL.revokeObjectURL(u);
    };
  }, [photos]);

  async function addPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    await db.photos.add({ date: todayStr(), blob: file, note: '' });
    e.target.value = '';
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <label className="card aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-rune-2 transition-colors">
          <span className="text-xl text-gold-dim">＋</span>
          <span className="text-[10px] text-ink-3 mt-1">Add likeness</span>
          <input type="file" accept="image/*" className="hidden" onChange={addPhoto} />
        </label>
        {(photos || []).map((p) => (
          <button key={p.id} className="relative aspect-square rounded-xl overflow-hidden border border-rune" onClick={() => setViewing(p)}>
            <img src={urls.get(p.id)} alt={p.date} className="w-full h-full object-cover" />
            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] text-ink py-0.5 text-center font-mono">
              {fmtShort(p.date)}
            </span>
          </button>
        ))}
      </div>
      <Sheet open={!!viewing} onClose={() => setViewing(null)} title={viewing ? fmtShort(viewing.date) : ''}>
        {viewing && (
          <div className="space-y-3">
            <img src={urls.get(viewing.id)} alt={viewing.date} className="w-full rounded-lg" />
            <button
              className="btn-danger w-full"
              onClick={async () => {
                await db.photos.delete(viewing.id);
                setViewing(null);
              }}
            >
              Burn this likeness
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
