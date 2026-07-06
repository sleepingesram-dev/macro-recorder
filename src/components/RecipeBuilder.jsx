import { useMemo, useState } from 'react';
import { Sheet, Field, fmt, Spinner } from './ui';
import { db, upsertFood, scaleNutrients, sumNutrients, NUTRIENTS } from '../db/db';
import { searchFoods } from '../api/foods';
import { useSettings } from '../state/SettingsContext';

// Forge a recipe: combine ingredients, divide by servings, log as one food.
export default function RecipeBuilder({ open, onClose, onSaved, initial }) {
  const { settings } = useSettings();
  const [name, setName] = useState(initial?.name || '');
  const [servings, setServings] = useState(String(initial?.servings || 4));
  const [items, setItems] = useState(initial?.items || []); // {name, grams, per100}
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const totals = useMemo(() => {
    const rows = items.map((it) => scaleNutrients(it.per100, it.grams));
    return sumNutrients(rows);
  }, [items]);
  const totalGrams = items.reduce((a, it) => a + it.grams, 0);
  const nServ = Math.max(1, parseFloat(servings) || 1);

  async function runSearch(q) {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const local = await db.foods
      .filter((f) => f.name.toLowerCase().includes(q.toLowerCase()))
      .limit(6)
      .toArray();
    setResults(local);
    try {
      const { results: api } = await searchFoods(q, { usdaKey: settings.usdaKey });
      setResults([...local, ...api.slice(0, 8)]);
    } catch {
      /* offline — locals only */
    }
    setSearching(false);
  }

  function addIngredient(food) {
    setItems((arr) => [...arr, { name: food.name, grams: 100, per100: food.per100 }]);
    setQuery('');
    setResults([]);
  }

  async function save() {
    if (!name.trim() || items.length === 0) return;
    const gramsPerServing = totalGrams / nServ;
    const per100 = {};
    for (const nut of NUTRIENTS) per100[nut.key] = totalGrams > 0 ? (totals[nut.key] / totalGrams) * 100 : 0;
    const recipeId = initial?.id || Date.now();
    await db.recipes.put({
      id: recipeId,
      name: name.trim(),
      servings: nServ,
      items,
      totalGrams,
    });
    const food = {
      key: `recipe:${recipeId}`,
      name: name.trim(),
      brand: 'Recipe',
      source: 'recipe',
      per100,
      servings: [{ label: `1 serving (${Math.round(gramsPerServing)} g)`, grams: gramsPerServing }],
    };
    await upsertFood(food);
    onSaved?.(food);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Forge a Recipe" wide>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Recipe name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Traveler's chili" />
            </Field>
          </div>
          <Field label="Servings">
            <input className="input" type="number" min="1" value={servings} onChange={(e) => setServings(e.target.value)} />
          </Field>
        </div>

        <Field label="Add ingredient">
          <input
            className="input"
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="Search foods & codex…"
          />
        </Field>
        {searching && <Spinner label="Searching…" />}
        {results.length > 0 && (
          <div className="card divide-y divide-rune/40 max-h-48 overflow-y-auto">
            {results.map((f) => (
              <button
                key={f.key}
                className="w-full px-3 py-2 text-left hover:bg-surface-2/60 flex justify-between items-center gap-2"
                onClick={() => addIngredient(f)}
              >
                <span className="text-sm text-ink truncate">
                  {f.name}
                  {f.brand ? <span className="text-ink-3 text-xs"> · {f.brand}</span> : null}
                </span>
                <span className="font-mono text-[11px] text-ink-3 shrink-0">
                  {fmt.kcal(f.per100?.kcal)} /100g
                </span>
              </button>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-2">
            <p className="label">Ingredients</p>
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm text-ink flex-1 truncate">{it.name}</span>
                <input
                  className="input !w-20 text-right"
                  type="number"
                  value={it.grams}
                  onChange={(e) =>
                    setItems((arr) => arr.map((x, j) => (j === i ? { ...x, grams: parseFloat(e.target.value) || 0 } : x)))
                  }
                />
                <span className="text-xs text-ink-3">g</span>
                <button
                  className="text-ink-3 hover:text-red-300 px-1"
                  onClick={() => setItems((arr) => arr.filter((_, j) => j !== i))}
                  aria-label="Remove ingredient"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="card bg-surface-2 p-3">
            <p className="text-[10px] text-ink-3 uppercase tracking-wider mb-1.5">
              Per serving ({nServ} servings · {fmt.int(totalGrams / nServ)} g each)
            </p>
            <p className="font-mono text-sm text-ink">
              {fmt.kcal(totals.kcal / nServ)} kcal · P {fmt.g(totals.protein / nServ)} · C{' '}
              {fmt.g(totals.carbs / nServ)} · F {fmt.g(totals.fat / nServ)}
            </p>
          </div>
        )}

        <button className="btn-gold w-full" onClick={save} disabled={!name.trim() || items.length === 0}>
          Seal the Recipe
        </button>
      </div>
    </Sheet>
  );
}
