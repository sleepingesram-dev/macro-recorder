import { useRef, useState } from 'react';
import { useSettings, DEFAULT_MEALS } from '../state/SettingsContext';
import { db, exportVault, importVault, SETTINGS_KEY } from '../db/db';
import { SectionTitle, Field, Segmented, fmt } from '../components/ui';
import { FORMULAS, ACTIVITY_LEVELS } from '../lib/tdee';
import { OBJECTIVES } from '../lib/targets';
import { toCsv, downloadFile, ENTRY_COLUMNS, WEIGHT_COLUMNS } from '../lib/csv';
import { weightValue, weightToKg, cmToIn, inToCm, mlToOz, ozToMl } from '../lib/units';
import { useCodex } from '../state/useChronicle';
import { todayStr } from '../lib/dates';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Settings() {
  const { settings, update } = useSettings();
  const info = useCodex();
  const fileRef = useRef();
  const [msg, setMsg] = useState('');
  const [confirmErase, setConfirmErase] = useState(false);

  const u = settings.units;
  const p = settings.profile;
  const g = settings.goal;

  const setProfile = (patch) => update((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
  const setGoal = (patch) => update((s) => ({ ...s, goal: { ...s.goal, ...patch } }));
  const setCycling = (patch) => update((s) => ({ ...s, cycling: { ...s.cycling, ...patch } }));

  function flash(m) {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  }

  async function doExportJson() {
    const vault = await exportVault();
    downloadFile(
      `chronicle-backup-${todayStr()}.json`,
      JSON.stringify(vault, null, 1),
      'application/json'
    );
    flash('Backup downloaded.');
  }

  async function doExportCsv() {
    const entries = await db.entries.orderBy('date').toArray();
    downloadFile(`chronicle-food-log-${todayStr()}.csv`, toCsv(entries, ENTRY_COLUMNS));
    const weights = await db.weights.orderBy('date').toArray();
    downloadFile(`chronicle-weights-${todayStr()}.csv`, toCsv(weights, WEIGHT_COLUMNS));
    flash('CSVs downloaded.');
  }

  async function doImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      // Restore replaces the vault with the backup's snapshot. Merge (Cancel)
      // keeps local rows where they exist but may duplicate food entries.
      const replace = window.confirm(
        'Restore this backup?\n\nOK — replace everything on this device with the backup.\nCancel — merge into existing data (repeated imports can duplicate food entries).'
      );
      await importVault(data, { replace });
      flash('Backup restored. Reloading…');
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      flash(`Import failed: ${err.message}`);
    }
    e.target.value = '';
  }

  async function eraseAll() {
    await Promise.all(db.tables.map((t) => t.clear()));
    localStorage.removeItem(SETTINGS_KEY);
    window.location.reload();
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="pt-2">
        <h1 className="font-display text-[13px] leading-relaxed pixel-title">SETTINGS</h1>
        <p className="text-[11px] text-ink-3 mt-0.5">Profile, goals & app options</p>
      </header>

      {/* ── Profile ── */}
      <SectionTitle>Profile</SectionTitle>
      <div className="card p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <input className="input" value={p.name} onChange={(e) => setProfile({ name: e.target.value })} />
          </Field>
          <Field label="Birth year">
            <input
              className="input"
              type="number"
              value={p.birthYear}
              onChange={(e) => setProfile({ birthYear: parseInt(e.target.value) || p.birthYear })}
            />
          </Field>
          <Field label="Sex (formulas)">
            <Segmented
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ]}
              value={p.sex}
              onChange={(v) => setProfile({ sex: v })}
            />
          </Field>
          <Field label={`Height (${u.height})`}>
            <input
              className="input"
              type="number"
              value={round1(u.height === 'in' ? cmToIn(p.heightCm) : p.heightCm)}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 0;
                setProfile({ heightCm: u.height === 'in' ? inToCm(v) : v });
              }}
            />
          </Field>
          <Field label={`Goal weight (${u.weight})`}>
            <input
              className="input"
              type="number"
              value={p.goalWeightKg ? round1(weightValue(p.goalWeightKg, u.weight)) : ''}
              placeholder="—"
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setProfile({ goalWeightKg: v ? weightToKg(v, u.weight) : null });
              }}
            />
          </Field>
          <Field label="Body fat % (for Katch-McArdle)">
            <input
              className="input"
              type="number"
              value={p.bodyFatPct ?? ''}
              placeholder="—"
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setProfile({ bodyFatPct: Number.isFinite(v) ? v : null });
              }}
            />
          </Field>
        </div>
      </div>

      {/* ── Goal ── */}
      <SectionTitle>Goal</SectionTitle>
      <div className="card p-4 space-y-4">
        <Field label="Objective">
          <div className="grid grid-cols-2 gap-2">
            {OBJECTIVES.map((o) => (
              <button
                key={o.key}
                onClick={() => setGoal({ objective: o.key })}
                className={`card p-2.5 text-left ${g.objective === o.key ? 'border-gold/50 bg-gold/5' : 'hover:border-rune-2'}`}
              >
                <p className="text-xs text-ink font-medium">{o.label}</p>
              </button>
            ))}
          </div>
        </Field>
        {(g.objective === 'cut' || g.objective === 'gain') && (
          <Field label={`Rate of change (${u.weight}/week)`} hint="Gentler rates preserve muscle and sanity.">
            <input
              className="input"
              type="number"
              step="0.05"
              value={round2(Math.abs(weightValue(g.rateKgPerWeek, u.weight)))}
              onChange={(e) => {
                const v = Math.abs(parseFloat(e.target.value) || 0);
                const kg = weightToKg(v, u.weight);
                setGoal({ rateKgPerWeek: g.objective === 'cut' ? -kg : kg });
              }}
            />
          </Field>
        )}
        <Field label="Macro split method">
          <Segmented
            options={[
              { value: 'perLb', label: 'g per lb' },
              { value: 'percent', label: 'Percent' },
              { value: 'grams', label: 'Grams' },
            ]}
            value={g.macroMode}
            onChange={(v) => setGoal({ macroMode: v })}
          />
        </Field>
        {g.macroMode === 'perLb' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Protein (g per lb bodyweight)">
              <input
                className="input"
                type="number"
                step="0.05"
                value={g.perLb.proteinPerLb}
                onChange={(e) => setGoal({ perLb: { ...g.perLb, proteinPerLb: parseFloat(e.target.value) || 0 } })}
              />
            </Field>
            <Field label="Fat (% of calories)">
              <input
                className="input"
                type="number"
                value={g.perLb.fatPct}
                onChange={(e) => setGoal({ perLb: { ...g.perLb, fatPct: parseFloat(e.target.value) || 0 } })}
              />
            </Field>
          </div>
        )}
        {g.macroMode === 'percent' && (
          <div className="grid grid-cols-3 gap-3">
            {['protein', 'carbs', 'fat'].map((k) => (
              <Field key={k} label={`${k} %`}>
                <input
                  className="input"
                  type="number"
                  value={g.percent[k]}
                  onChange={(e) => setGoal({ percent: { ...g.percent, [k]: parseFloat(e.target.value) || 0 } })}
                />
              </Field>
            ))}
          </div>
        )}
        {g.macroMode === 'grams' && (
          <div className="grid grid-cols-3 gap-3">
            {['protein', 'carbs', 'fat'].map((k) => (
              <Field key={k} label={`${k} g`}>
                <input
                  className="input"
                  type="number"
                  value={g.grams[k]}
                  onChange={(e) => setGoal({ grams: { ...g.grams, [k]: parseFloat(e.target.value) || 0 } })}
                />
              </Field>
            ))}
          </div>
        )}
        {info.targets?.calories && (
          <p className="text-[11px] text-ink-3">
            Current calorie target: <span className="font-mono text-gold-bright">{fmt.kcal(info.targets.calories)} kcal</span> · P{' '}
            {info.targets.macros?.protein}g · C {info.targets.macros?.carbs}g · F {info.targets.macros?.fat}g
          </p>
        )}
      </div>

      {/* ── Metabolism ── */}
      <SectionTitle>Metabolism</SectionTitle>
      <div className="card p-4 space-y-4">
        <Field label="Baseline formula" hint="Seeds the estimate; real logging takes over from there.">
          <Segmented
            options={FORMULAS.map((f) => ({ value: f.key, label: f.label.split(' ')[0] }))}
            value={settings.formula}
            onChange={(v) => update({ formula: v })}
          />
        </Field>
        {settings.formula === 'katch' && p.bodyFatPct == null && (
          <p className="text-[11px] text-ember-bright">Katch-McArdle needs a body fat % (set above).</p>
        )}
        <Field label="Activity multiplier (baseline)">
          <select className="input" value={settings.activity} onChange={(e) => update({ activity: parseFloat(e.target.value) })}>
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label} ({a.value}) — {a.desc}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* ── Calorie cycling ── */}
      <SectionTitle>Weekly Cycling</SectionTitle>
      <div className="card p-4 space-y-4">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-ink">Cycle calories across the week</span>
          <input
            type="checkbox"
            className="accent-gold w-4 h-4"
            checked={settings.cycling.enabled}
            onChange={(e) => setCycling({ enabled: e.target.checked })}
          />
        </label>
        {settings.cycling.enabled && (
          <>
            <Field label="Training days" hint="Higher calories on these days; rest days absorb the difference. Weekly total unchanged.">
              <div className="flex gap-1.5 flex-wrap">
                {WEEKDAYS.map((d, i) => (
                  <button
                    key={d}
                    onClick={() =>
                      setCycling({
                        trainingDays: settings.cycling.trainingDays.includes(i)
                          ? settings.cycling.trainingDays.filter((x) => x !== i)
                          : [...settings.cycling.trainingDays, i],
                      })
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-xs border ${
                      settings.cycling.trainingDays.includes(i)
                        ? 'border-gold/50 bg-gold/10 text-gold-bright'
                        : 'border-rune text-ink-3'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Training day boost (%)">
              <input
                className="input"
                type="number"
                value={settings.cycling.trainingBoostPct}
                onChange={(e) => setCycling({ trainingBoostPct: parseFloat(e.target.value) || 0 })}
              />
            </Field>
          </>
        )}
      </div>

      {/* ── Preferences ── */}
      <SectionTitle>Preferences</SectionTitle>
      <div className="card p-4 space-y-4">
        <Field label="Units">
          <Segmented
            options={[
              { value: 'imperial', label: 'lb / in / oz' },
              { value: 'metric', label: 'kg / cm / ml' },
            ]}
            value={u.weight === 'lb' ? 'imperial' : 'metric'}
            onChange={(v) =>
              update({
                units:
                  v === 'imperial'
                    ? { weight: 'lb', height: 'in', fluid: 'oz' }
                    : { weight: 'kg', height: 'cm', fluid: 'ml' },
              })
            }
          />
        </Field>
        <Field label={`Water target (${u.fluid})`}>
          <input
            className="input"
            type="number"
            value={u.fluid === 'oz' ? Math.round(mlToOz(settings.waterTargetMl)) : settings.waterTargetMl}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || 0;
              update({ waterTargetMl: u.fluid === 'oz' ? ozToMl(v) : v });
            }}
          />
        </Field>
        <Field label="Meal categories" hint="Rename, add or remove. Entries keep their original category.">
          <MealEditor />
        </Field>
        <Field label="USDA FoodData Central API key (optional)" hint="Free at fdc.nal.usda.gov — raises the search rate limit. DEMO_KEY is used otherwise.">
          <input
            className="input"
            value={settings.usdaKey}
            placeholder="DEMO_KEY"
            onChange={(e) => update({ usdaKey: e.target.value.trim() })}
          />
        </Field>
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-sm text-ink">Logging reminder</span>
            <p className="text-[10px] text-ink-3">Evening browser notification if you haven't logged (app must be open).</p>
          </div>
          <input
            type="checkbox"
            className="accent-gold w-4 h-4"
            checked={settings.notifications.logReminder}
            onChange={async (e) => {
              if (e.target.checked && 'Notification' in window) await Notification.requestPermission();
              update((s) => ({ ...s, notifications: { ...s.notifications, logReminder: e.target.checked } }));
            }}
          />
        </label>
      </div>

      {/* ── Data ── */}
      <SectionTitle>Your Data</SectionTitle>
      <div className="card p-4 space-y-3">
        <p className="text-[11px] text-ink-3">
          Everything lives on this device — no account, no cloud, no subscription. Export a backup
          now and then; it\u2019s your only copy.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-gold" onClick={doExportJson}>
            Export backup (JSON)
          </button>
          <button className="btn-ghost" onClick={doExportCsv}>
            Export CSV
          </button>
        </div>
        <button className="btn-ghost w-full" onClick={() => fileRef.current?.click()}>
          Import backup
        </button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={doImport} />
        {!confirmErase ? (
          <button className="btn-danger w-full" onClick={() => setConfirmErase(true)}>
            Erase everything
          </button>
        ) : (
          <div className="flex gap-2">
            <button className="btn-danger flex-1" onClick={eraseAll}>
              Yes, delete everything
            </button>
            <button className="btn-ghost" onClick={() => setConfirmErase(false)}>
              Cancel
            </button>
          </div>
        )}
        {msg && <p className="text-xs text-verdant-bright">{msg}</p>}
      </div>

      <p className="text-center text-[10px] text-ink-3 pb-2">
        The Chronicle · local-first · v2.0 · no data leaves your device
      </p>
    </div>
  );
}

function MealEditor() {
  const { settings, update } = useSettings();
  const [newMeal, setNewMeal] = useState('');
  const meals = settings.meals;

  function rename(i, label) {
    const next = meals.map((m, j) => (j === i ? { ...m, label } : m));
    update({ meals: next });
  }
  function remove(i) {
    if (meals.length <= 1) return;
    update({ meals: meals.filter((_, j) => j !== i) });
  }
  function add() {
    const label = newMeal.trim();
    if (!label) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (meals.some((m) => m.key === key)) return;
    update({ meals: [...meals, { key, label }] });
    setNewMeal('');
  }

  return (
    <div className="space-y-2">
      {meals.map((m, i) => (
        <div key={m.key} className="flex gap-2">
          <input className="input flex-1" value={m.label} onChange={(e) => rename(i, e.target.value)} />
          <button className="btn-ghost !px-3" onClick={() => remove(i)} disabled={meals.length <= 1} aria-label={`Remove ${m.label}`}>
            ✕
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="New category (e.g. Second Breakfast)"
          value={newMeal}
          onChange={(e) => setNewMeal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn-ghost !px-3" onClick={add}>
          +
        </button>
      </div>
      {meals !== DEFAULT_MEALS && (
        <button className="text-[11px] text-ink-3 hover:text-ink-2" onClick={() => update({ meals: DEFAULT_MEALS })}>
          Reset to defaults
        </button>
      )}
    </div>
  );
}

const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;
