import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../state/SettingsContext';
import { Field, Segmented, fmt } from '../components/ui';
import { FORMULAS, ACTIVITY_LEVELS, formulaTdee, ageFromBirthYear } from '../lib/tdee';
import { OBJECTIVES, calorieTarget, macroTargets } from '../lib/targets';
import { weightToKg, inToCm, lbToKg } from '../lib/units';
import { db } from '../db/db';
import { todayStr } from '../lib/dates';

// Three pages: who you are → what you seek → your ration. Writes settings once at the end.
export default function Onboarding() {
  const { update } = useSettings();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    sex: 'male',
    birthYear: '1995',
    height: '70', // in or cm depending on units
    weight: '170',
    goalWeight: '',
    units: 'imperial',
    objective: 'cut',
    rate: '0.75', // lb or kg per week (absolute)
    activity: 1.45,
    formula: 'mifflin',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const imperial = form.units === 'imperial';
  const heightCm = imperial ? inToCm(parseFloat(form.height) || 0) : parseFloat(form.height) || 0;
  const weightKg = imperial ? lbToKg(parseFloat(form.weight) || 0) : parseFloat(form.weight) || 0;
  const rateAbs = parseFloat(form.rate) || 0;
  const rateKg = imperial ? lbToKg(rateAbs) : rateAbs;
  const signedRate =
    form.objective === 'cut' ? -rateKg : form.objective === 'gain' ? rateKg : 0;

  const tdee = formulaTdee(
    {
      formula: form.formula,
      sex: form.sex,
      age: ageFromBirthYear(parseInt(form.birthYear) || 1995),
      heightCm,
      weightKg,
      bodyFatPct: null,
    },
    form.activity
  );
  const calories = calorieTarget(tdee, signedRate);
  const previewGoal = {
    macroMode: 'perLb',
    perLb: { proteinPerLb: 0.9, fatPct: 28 },
    percent: { protein: 30, carbs: 40, fat: 30 },
    grams: { protein: 150, carbs: 200, fat: 70 },
  };
  const macros = macroTargets({ calories, goal: previewGoal, weightKg });

  function finish() {
    const goalWeightKg = form.goalWeight
      ? weightToKg(parseFloat(form.goalWeight), imperial ? 'lb' : 'kg')
      : null;
    update((prev) => ({
      ...prev,
      onboarded: true,
      profile: {
        ...prev.profile,
        name: form.name || 'Adventurer',
        sex: form.sex,
        birthYear: parseInt(form.birthYear) || 1995,
        heightCm,
        startWeightKg: weightKg || null,
        goalWeightKg,
        startDate: todayStr(),
      },
      goal: { ...prev.goal, objective: form.objective, rateKgPerWeek: signedRate, macroMode: 'perLb' },
      formula: form.formula,
      activity: form.activity,
      units: imperial
        ? { weight: 'lb', height: 'in', fluid: 'oz' }
        : { weight: 'kg', height: 'cm', fluid: 'ml' },
    }));
    if (weightKg > 0) db.weights.put({ date: todayStr(), kg: weightKg });
  }

  const steps = [
    // ── Step 1: identity ──
    <div className="space-y-4" key="s0">
      <Field label="Name your adventurer">
        <input className="input" placeholder="Adventurer" value={form.name} onChange={set('name')} />
      </Field>
      <Field label="Units">
        <Segmented
          options={[
            { value: 'imperial', label: 'lb / in / oz' },
            { value: 'metric', label: 'kg / cm / ml' },
          ]}
          value={form.units}
          onChange={set('units')}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sex (for formulas)">
          <Segmented
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ]}
            value={form.sex}
            onChange={set('sex')}
          />
        </Field>
        <Field label="Birth year">
          <input className="input" type="number" value={form.birthYear} onChange={set('birthYear')} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Height (${imperial ? 'in' : 'cm'})`}>
          <input className="input" type="number" value={form.height} onChange={set('height')} />
        </Field>
        <Field label={`Weight (${imperial ? 'lb' : 'kg'})`}>
          <input className="input" type="number" value={form.weight} onChange={set('weight')} />
        </Field>
      </div>
    </div>,

    // ── Step 2: the quest ──
    <div className="space-y-4" key="s1">
      <Field label="Your quest">
        <div className="grid grid-cols-2 gap-2">
          {OBJECTIVES.map((o) => (
            <button
              key={o.key}
              onClick={() => set('objective')(o.key)}
              className={`card p-3 text-left transition-colors ${
                form.objective === o.key ? 'border-gold/50 bg-gold/5' : 'hover:border-rune-2'
              }`}
            >
              <p className="text-sm text-ink font-medium">{o.label}</p>
              <p className="text-[10px] text-ink-3 mt-1">{o.hint}</p>
            </button>
          ))}
        </div>
      </Field>
      {(form.objective === 'cut' || form.objective === 'gain') && (
        <>
          <Field label={`Rate (${imperial ? 'lb' : 'kg'} per week)`}>
            <input className="input" type="number" step="0.05" value={form.rate} onChange={set('rate')} />
          </Field>
          <Field label={`Goal weight (${imperial ? 'lb' : 'kg'}) — optional`}>
            <input className="input" type="number" value={form.goalWeight} onChange={set('goalWeight')} />
          </Field>
        </>
      )}
      <Field label="Activity (starting point — the Codex adapts from real data)">
        <div className="space-y-1.5">
          {ACTIVITY_LEVELS.map((a) => (
            <button
              key={a.value}
              onClick={() => set('activity')(a.value)}
              className={`w-full card px-3 py-2 flex justify-between items-center transition-colors ${
                form.activity === a.value ? 'border-gold/50 bg-gold/5' : 'hover:border-rune-2'
              }`}
            >
              <span className="text-sm text-ink">{a.label}</span>
              <span className="text-[10px] text-ink-3">{a.desc}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field label="Baseline formula">
        <Segmented
          options={FORMULAS.filter((f) => !f.needsBodyFat).map((f) => ({ value: f.key, label: f.label.split(' ')[0] }))}
          value={form.formula}
          onChange={set('formula')}
        />
      </Field>
    </div>,

    // ── Step 3: the ration ──
    <div className="space-y-4 text-center" key="s2">
      <p className="text-ink-2 text-sm">The Codex opens with these numbers. They will adapt as you log.</p>
      <div className="card ornate p-6 space-y-3">
        <div>
          <p className="label">Metabolic Codex (initial)</p>
          <p className="font-mono text-2xl text-ink">{fmt.kcal(tdee)} kcal/day</p>
        </div>
        <div className="divider-rune" />
        <div>
          <p className="label">Daily Ration</p>
          <p className="font-mono text-3xl text-gold-bright">{fmt.kcal(calories)} kcal</p>
          {signedRate !== 0 && (
            <p className="text-[11px] text-ink-3 mt-1">
              {signedRate < 0 ? 'Endurance Tax' : 'Growth Tithe'}: {fmt.kcal(Math.abs(calories - tdee))} kcal/day
            </p>
          )}
        </div>
        {macros && (
          <div className="grid grid-cols-3 pt-2">
            <div>
              <p className="font-mono text-lg text-chart-arcane">{macros.protein}g</p>
              <p className="text-[10px] text-ink-3 uppercase">Protein</p>
            </div>
            <div>
              <p className="font-mono text-lg text-chart-verdant">{macros.carbs}g</p>
              <p className="text-[10px] text-ink-3 uppercase">Carbs</p>
            </div>
            <div>
              <p className="font-mono text-lg text-chart-ember">{macros.fat}g</p>
              <p className="text-[10px] text-ink-3 uppercase">Fat</p>
            </div>
          </div>
        )}
      </div>
      <p className="text-[11px] text-ink-3">
        Every number stays on this device. No account. No subscription. Your data, your chronicle.
      </p>
    </div>,
  ];

  return (
    <div className="min-h-dvh max-w-md mx-auto px-5 py-10 flex flex-col">
      <header className="text-center mb-8">
        <p className="text-gold-dim text-2xl mb-2">✦</p>
        <h1 className="font-display text-2xl text-gold tracking-[0.12em] uppercase">The Chronicle</h1>
        <p className="text-xs text-ink-3 mt-2 tracking-wide">A private codex of rations, quests & progress</p>
      </header>
      <div className="flex gap-1.5 justify-center mb-6">
        {steps.map((_, i) => (
          <div key={i} className={`h-1 rounded-full transition-all ${i === step ? 'w-8 bg-gold' : 'w-4 bg-rune'}`} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
          className="flex-1"
        >
          {steps[step]}
        </motion.div>
      </AnimatePresence>
      <div className="flex gap-2 mt-8">
        {step > 0 && (
          <button className="btn-ghost" onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        )}
        {step < steps.length - 1 ? (
          <button className="btn-gold flex-1" onClick={() => setStep((s) => s + 1)}>
            Continue
          </button>
        ) : (
          <button className="btn-gold flex-1" onClick={finish}>
            Begin the Chronicle
          </button>
        )}
      </div>
    </div>
  );
}
