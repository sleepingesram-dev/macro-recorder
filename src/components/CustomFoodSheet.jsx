import { useState } from 'react';
import { Sheet, Field, Segmented } from './ui';
import { upsertFood, NUTRIENTS } from '../db/db';

const CORE = ['kcal', 'protein', 'carbs', 'fat'];
const EXTRA = NUTRIENTS.map((n) => n.key).filter((k) => !CORE.includes(k));

// Inscribe a custom food into the personal codex. Values can be entered per
// serving or per 100 g; stored canonically per 100 g.
export default function CustomFoodSheet({ open, onClose, onSaved, initial }) {
  const [name, setName] = useState(initial?.name || '');
  const [brand, setBrand] = useState(initial?.brand || '');
  const [basis, setBasis] = useState('serving'); // serving | per100
  const [servingG, setServingG] = useState(String(initial?.servings?.[0]?.grams || 100));
  const [vals, setVals] = useState(() => {
    const v = {};
    for (const nut of NUTRIENTS) v[nut.key] = initial?.per100?.[nut.key] ? String(initial.per100[nut.key]) : '';
    return v;
  });
  const [showExtra, setShowExtra] = useState(false);
  const setV = (k) => (e) => setVals((v) => ({ ...v, [k]: e.target.value }));

  async function save() {
    if (!name.trim()) return;
    const g = parseFloat(servingG) || 100;
    const factor = basis === 'serving' ? 100 / g : 1;
    const per100 = {};
    for (const nut of NUTRIENTS) per100[nut.key] = (parseFloat(vals[nut.key]) || 0) * factor;
    const food = {
      key: initial?.key || `custom:${Date.now()}`,
      name: name.trim(),
      brand: brand.trim() || null,
      barcode: initial?.barcode || null,
      source: 'custom',
      per100,
      servings: [{ label: `1 serving (${g} g)`, grams: g }],
    };
    await upsertFood(food);
    onSaved?.(food);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Inscribe Custom Food" wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hearty stew" />
          </Field>
          <Field label="Brand (optional)">
            <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </Field>
        </div>
        <div className="flex items-end gap-3">
          <Field label="Values entered">
            <Segmented
              options={[
                { value: 'serving', label: 'Per serving' },
                { value: 'per100', label: 'Per 100 g' },
              ]}
              value={basis}
              onChange={setBasis}
            />
          </Field>
          <Field label="Serving size (g)">
            <input className="input w-24" type="number" value={servingG} onChange={(e) => setServingG(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CORE.map((k) => (
            <Field key={k} label={labelFor(k)}>
              <input className="input" type="number" inputMode="decimal" value={vals[k]} onChange={setV(k)} placeholder="0" />
            </Field>
          ))}
        </div>
        <button className="text-xs text-gold-dim hover:text-gold" onClick={() => setShowExtra((s) => !s)}>
          {showExtra ? '− Hide' : '+ Show'} micronutrients
        </button>
        {showExtra && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {EXTRA.map((k) => (
              <Field key={k} label={labelFor(k)}>
                <input className="input" type="number" inputMode="decimal" value={vals[k]} onChange={setV(k)} placeholder="0" />
              </Field>
            ))}
          </div>
        )}
        <button className="btn-gold w-full" onClick={save} disabled={!name.trim()}>
          Inscribe to Codex
        </button>
      </div>
    </Sheet>
  );
}

function labelFor(key) {
  const n = NUTRIENTS.find((x) => x.key === key);
  return `${n.label} (${n.unit})`;
}
