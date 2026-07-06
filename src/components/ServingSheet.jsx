import { useMemo, useState } from 'react';
import { Sheet, Field, Segmented, fmt } from './ui';
import { MACRO_COLORS } from './charts';
import { MASS_UNITS } from '../lib/units';
import { db, logEntry, scaleNutrients, upsertFood } from '../db/db';
import { useSettings } from '../state/SettingsContext';
import { todayStr } from '../lib/dates';

// Portion picker + logger. Handles three cases:
//  • logging a food from search/scan/codex (food != null)
//  • editing an existing entry that carries a per100 snapshot
//  • editing a quick-add entry (direct macro fields)
export default function ServingSheet({ open, onClose, food, entry, date = todayStr(), meal, onDone }) {
  const { settings } = useSettings();
  const isEdit = !!entry;
  const per100 = food?.per100 || entry?.per100 || null;
  const isQuick = isEdit && !per100;

  const unitOptions = useMemo(() => {
    const servings = food?.servings || entry?.servings || [];
    return [
      ...servings.map((s, i) => ({ key: `serv:${i}`, label: s.label, grams: s.grams })),
      ...MASS_UNITS.map((u) => ({ key: u.key, label: u.label, grams: u.grams })),
    ];
  }, [food, entry]);

  const [unitKey, setUnitKey] = useState(() =>
    unitOptions[0]?.key === 'serv:0' ? 'serv:0' : 'g'
  );
  const [qty, setQty] = useState(() => {
    if (entry?.grams && unitOptions[0]?.key !== 'serv:0') return String(Math.round(entry.grams));
    return unitOptions[0]?.key === 'serv:0' ? '1' : '100';
  });
  const [mealKey, setMealKey] = useState(meal || entry?.meal || settings.meals[0].key);
  const [quickVals, setQuickVals] = useState(() => ({
    kcal: entry?.kcal ?? '',
    protein: entry?.protein ?? '',
    carbs: entry?.carbs ?? '',
    fat: entry?.fat ?? '',
  }));

  const unit = unitOptions.find((u) => u.key === unitKey) || unitOptions[0];
  const grams = (parseFloat(qty) || 0) * (unit?.grams || 1);
  const scaled = per100 ? scaleNutrients(per100, grams) : null;

  async function save() {
    if (isQuick) {
      await db.entries.update(entry.id, {
        meal: mealKey,
        kcal: parseFloat(quickVals.kcal) || 0,
        protein: parseFloat(quickVals.protein) || 0,
        carbs: parseFloat(quickVals.carbs) || 0,
        fat: parseFloat(quickVals.fat) || 0,
      });
      onDone?.();
      onClose();
      return;
    }
    const amountDesc = unit.key.startsWith('serv:')
      ? `${qty} × ${unit.label}`
      : `${qty} ${unit.label}`;
    const base = {
      date,
      meal: mealKey,
      name: food?.name ?? entry.name,
      brand: food?.brand ?? entry.brand ?? null,
      amountDesc,
      grams,
      per100,
      servings: food?.servings ?? entry?.servings ?? [],
      foodKey: food?.key ?? entry?.foodKey ?? null,
      source: food?.source ?? entry?.source ?? 'manual',
      viaScan: food?.viaScan || entry?.viaScan || false,
      ...scaled,
    };
    if (isEdit) {
      await db.entries.update(entry.id, base);
    } else {
      if (food?.key) await upsertFood({ ...food, viaScan: undefined });
      await logEntry(base);
    }
    onDone?.();
    onClose();
  }

  async function remove() {
    await db.entries.delete(entry.id);
    onDone?.();
    onClose();
  }

  async function copyToToday() {
    const { id, ...rest } = entry;
    await logEntry({ ...rest, date: todayStr(), ts: Date.now() });
    onClose();
  }

  const name = food?.name ?? entry?.name ?? '';
  const brand = food?.brand ?? entry?.brand ?? null;

  return (
    <Sheet open={open} onClose={onClose} title={isEdit ? 'Amend Entry' : 'Log to Chronicle'}>
      <div className="space-y-4">
        <div>
          <p className="text-ink font-medium leading-tight">{name}</p>
          {brand && <p className="text-xs text-ink-3 mt-0.5">{brand}</p>}
        </div>

        {!isQuick && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount">
                <input
                  type="number"
                  inputMode="decimal"
                  className="input"
                  value={qty}
                  min="0"
                  onChange={(e) => setQty(e.target.value)}
                />
              </Field>
              <Field label="Unit">
                <select className="input" value={unitKey} onChange={(e) => setUnitKey(e.target.value)}>
                  {unitOptions.map((u) => (
                    <option key={u.key} value={u.key}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {scaled && (
              <div className="card bg-surface-2 p-3 grid grid-cols-4 text-center">
                <Mini label="kcal" value={fmt.kcal(scaled.kcal)} color="#C9A84C" />
                <Mini label="protein" value={fmt.g(scaled.protein)} color={MACRO_COLORS.protein} />
                <Mini label="carbs" value={fmt.g(scaled.carbs)} color={MACRO_COLORS.carbs} />
                <Mini label="fat" value={fmt.g(scaled.fat)} color={MACRO_COLORS.fat} />
              </div>
            )}
          </>
        )}

        {isQuick && (
          <div className="grid grid-cols-2 gap-3">
            {['kcal', 'protein', 'carbs', 'fat'].map((k) => (
              <Field key={k} label={k === 'kcal' ? 'Calories' : `${k} (g)`}>
                <input
                  type="number"
                  inputMode="decimal"
                  className="input"
                  value={quickVals[k]}
                  onChange={(e) => setQuickVals((v) => ({ ...v, [k]: e.target.value }))}
                />
              </Field>
            ))}
          </div>
        )}

        <Field label="Meal">
          <Segmented
            options={settings.meals.map((m) => ({ value: m.key, label: m.label }))}
            value={mealKey}
            onChange={setMealKey}
            className="flex flex-wrap"
          />
        </Field>

        <div className="flex gap-2 pt-1">
          <button className="btn-gold flex-1" onClick={save}>
            {isEdit ? 'Save Changes' : 'Inscribe Entry'}
          </button>
          {isEdit && (
            <button className="btn-danger" onClick={remove} title="Delete entry">
              ✕
            </button>
          )}
        </div>
        {isEdit && entry.date !== todayStr() && (
          <button className="btn-ghost w-full" onClick={copyToToday}>
            Copy to Today
          </button>
        )}
      </div>
    </Sheet>
  );
}

function Mini({ label, value, color }) {
  return (
    <div>
      <p className="font-mono text-sm" style={{ color }}>
        {value}
      </p>
      <p className="text-[10px] text-ink-3 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
