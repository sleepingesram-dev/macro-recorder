import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSettings } from '../state/SettingsContext';
import { useDayLog, useCodex, useCharacter } from '../state/useChronicle';
import { Ring, StatBar, SectionTitle, fmt, Sheet, Field } from '../components/ui';
import { MACRO_COLORS } from '../components/charts';
import MealCard from '../components/MealCard';
import ServingSheet from '../components/ServingSheet';
import { db, addWater, entriesForDate, copyEntriesToDate } from '../db/db';
import { isCycledTrainingDay } from '../lib/targets';
import { todayStr, addDays, fmtLong, isToday } from '../lib/dates';
import { fmtFluid, weightToKg, weightValue } from '../lib/units';

export default function Dashboard() {
  const { settings } = useSettings();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || todayStr();
  const setDate = (d) => setParams(d === todayStr() ? {} : { date: d }, { replace: true });

  const log = useDayLog(date);
  const codexInfo = useCodex(date);
  const character = useCharacter(codexInfo);
  const [editing, setEditing] = useState(null);
  const [weighOpen, setWeighOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const t = codexInfo.targets;
  const kcalTarget = t?.calories || 2000;
  const macros = t?.macros || { protein: 150, carbs: 200, fat: 70 };
  const remaining = kcalTarget - log.totals.kcal;
  const todayWeight = useTodayWeight(date);
  const isTrainingDay = isCycledTrainingDay(settings.cycling, date);

  // meals that were removed from settings but still hold entries on this day —
  // they stay visible and editable ("entries keep their original category")
  const orphanMeals = Object.keys(log.byMeal)
    .filter((k) => (log.byMeal[k] || []).length > 0 && !settings.meals.some((m) => m.key === k))
    .map((k) => ({ key: k, label: `${k} (retired)` }));

  async function copyPreviousDay() {
    const prev = await entriesForDate(addDays(date, -1));
    if (!prev.length) return;
    await copyEntriesToDate(prev, date);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4">
      {/* ── Journal header ── */}
      <header className="pt-2">
        <div className="flex items-center justify-between">
          <p className="font-display text-[13px] leading-relaxed pixel-title">DAY {character.dayNumber}</p>
          <LevelBadge level={character.level} progress={character.levelProgress} />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button className="btn-ghost !px-2.5 !py-1" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
            ‹
          </button>
          <div className="relative flex-1 text-center">
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="absolute inset-0 opacity-0 w-full cursor-pointer"
              aria-label="Pick date"
            />
            <span className="text-base text-ink-2 font-mono pointer-events-none leading-none">{fmtLong(date)}</span>
          </div>
          <button
            className="btn-ghost !px-2.5 !py-1"
            onClick={() => setDate(addDays(date, 1))}
            disabled={isToday(date)}
            aria-label="Next day"
          >
            ›
          </button>
          {!isToday(date) && (
            <button className="btn-ghost !px-2.5 !py-1 text-gold-dim" onClick={() => setDate(todayStr())}>
              Today
            </button>
          )}
        </div>
        {character.stats?.currentStreak >= 2 && (
          <p className="text-xs text-ink-3 mt-1.5">
            <span className="text-blood">♥</span>{' '}
            <span className="text-ink-2">{character.stats.currentStreak} day streak</span>
          </p>
        )}
      </header>

      {/* ── Calories hero ── */}
      <div className="card ornate p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="label !mb-0">Calories</p>
          {isTrainingDay && (
            <span className="text-[10px] text-gold-dim border border-gold/30 rounded px-1.5 py-0.5 uppercase tracking-wider">
              Training Day
            </span>
          )}
        </div>
        <div className="flex items-center justify-center py-2">
          <Ring size={168} stroke={11} value={log.totals.kcal} target={kcalTarget} color="#FFD76E">
            <p className="font-mono text-4xl leading-none text-ink">{fmt.kcal(log.totals.kcal)}</p>
            <p className="text-[11px] text-ink-2 mt-0.5">of {fmt.kcal(kcalTarget)} kcal</p>
            <p className={`font-mono text-base leading-none mt-1 ${remaining >= 0 ? 'text-verdant-bright' : 'text-ember-bright'}`}>
              {remaining >= 0 ? `${fmt.kcal(remaining)} remain` : `${fmt.kcal(-remaining)} over`}
            </p>
          </Ring>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <MacroRing label="Protein" value={log.totals.protein} target={macros.protein} color={MACRO_COLORS.protein} />
          <MacroRing label="Carbs" value={log.totals.carbs} target={macros.carbs} color={MACRO_COLORS.carbs} />
          <MacroRing label="Fat" value={log.totals.fat} target={macros.fat} color={MACRO_COLORS.fat} />
        </div>
        {codexInfo.codex?.confidence !== 'none' && (
          <p className="text-[10px] text-ink-3 mt-3 text-center">
            Est. TDEE: {fmt.kcal(codexInfo.codex.tdee)} kcal/day · {codexInfo.codex.confidence} confidence
          </p>
        )}
      </div>

      {/* ── Water ── */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="label !mb-0">Water</p>
          <p className="font-mono text-base leading-none text-ink-2">
            {fmtFluid(log.waterMl, settings.units.fluid)} / {fmtFluid(settings.waterTargetMl, settings.units.fluid)}
          </p>
        </div>
        <StatBar value={log.waterMl} target={settings.waterTargetMl} color="#5B8DD9" height={12} />
        <div className="flex gap-2 mt-3">
          {[250, 500].map((ml) => (
            <button key={ml} className="btn-ghost !py-1.5 !px-3 text-xs flex-1" onClick={() => addWater(date, ml)}>
              +{fmtFluid(ml, settings.units.fluid)}
            </button>
          ))}
          <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={() => addWater(date, -250)} aria-label="Undo water">
            −
          </button>
        </div>
      </div>

      {/* ── Morning weigh-in nudge ── */}
      <button className="card w-full p-3.5 flex items-center justify-between hover:border-rune-2 transition-colors" onClick={() => setWeighOpen(true)}>
        {todayWeight == null ? (
          <>
            <span className="text-sm text-ink-2">⚖ Log {isToday(date) ? "today's" : "this day's"} weight</span>
            <span className="text-gold-dim text-xs">→</span>
          </>
        ) : (
          <>
            <span className="text-sm text-ink-2">⚖ Weigh-in</span>
            <span className="font-mono text-lg leading-none text-ink">
              {weightValue(todayWeight, settings.units.weight).toFixed(1)} {settings.units.weight}
            </span>
          </>
        )}
      </button>

      {/* ── Food log ── */}
      <SectionTitle
        right={
          <button className="text-[11px] text-gold-dim hover:text-gold transition-colors" onClick={copyPreviousDay}>
            {copied ? '✓ copied' : '⧉ Copy yesterday'}
          </button>
        }
      >
        Food Log
      </SectionTitle>
      <div className="space-y-3">
        {[...settings.meals, ...orphanMeals].map((m) => (
          <MealCard key={m.key} meal={m} entries={log.byMeal[m.key] || []} date={date} onEdit={setEditing} />
        ))}
      </div>

      {editing && (
        <ServingSheet open={!!editing} onClose={() => setEditing(null)} entry={editing} date={date} />
      )}
      <WeighSheet open={weighOpen} onClose={() => setWeighOpen(false)} date={date} current={todayWeight} />
    </div>
  );
}

function MacroRing({ label, value, target, color }) {
  return (
    <div className="flex flex-col items-center">
      <Ring size={84} stroke={7} value={value} target={target} color={color}>
        <p className="font-mono text-xl leading-none text-ink">{fmt.g(value)}</p>
        <p className="text-[9px] text-ink-3">/{fmt.g(target)}</p>
      </Ring>
      <p className="text-[10px] text-ink-2 mt-1.5 uppercase tracking-wider font-semibold">{label}</p>
    </div>
  );
}

function LevelBadge({ level, progress }) {
  return (
    <div className="text-right">
      <div className="inline-flex items-center gap-1.5 border border-gold/30 rounded-full px-2.5 py-1">
        <span className="text-gold text-[8px] font-display">LVL</span>
        <span className="font-mono text-lg leading-none text-gold-bright">{level}</span>
      </div>
      <div className="w-16 h-1.5 bg-abyss/70 border border-rune mt-1 ml-auto overflow-hidden">
        <motion.div
          className="h-full bg-gold/60"
          initial={{ width: 0 }}
          animate={{ width: `${(progress || 0) * 100}%` }}
        />
      </div>
    </div>
  );
}

function useTodayWeight(date) {
  const w = useLiveQuery(() => db.weights.get(date), [date]);
  return w?.kg ?? null;
}

function WeighSheet({ open, onClose, date, current }) {
  const { settings } = useSettings();
  const [val, setVal] = useState('');
  const unit = settings.units.weight;
  async function save() {
    const v = parseFloat(val);
    if (!v || v <= 0) return;
    await db.weights.put({ date, kg: weightToKg(v, unit) });
    onClose();
  }
  async function remove() {
    await db.weights.delete(date);
    onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Log Weight">
      <div className="space-y-4">
        <Field label={`Weight (${unit})`}>
          <input
            type="number"
            inputMode="decimal"
            className="input text-lg"
            placeholder={current ? (weightValue(current, unit)).toFixed(1) : unit === 'lb' ? '165.0' : '75.0'}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            autoFocus
          />
        </Field>
        <div className="flex gap-2">
          <button className="btn-gold flex-1" onClick={save}>
            Save
          </button>
          {current != null && (
            <button className="btn-danger" onClick={remove}>
              ✕
            </button>
          )}
        </div>
        <p className="text-[11px] text-ink-3">
          Daily weight bounces around from water and salt. The app tracks your smoothed trend, so don't sweat single days.
        </p>
      </div>
    </Sheet>
  );
}
