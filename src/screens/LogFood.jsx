import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { db, logEntry } from '../db/db';
import { searchFoods } from '../api/foods';
import { useSettings } from '../state/SettingsContext';
import { SectionTitle, Sheet, Field, Segmented, fmt, Spinner, EmptyState } from '../components/ui';
import { MACRO_COLORS } from '../components/charts';
import ServingSheet from '../components/ServingSheet';
import Scanner from '../components/Scanner';
import CustomFoodSheet from '../components/CustomFoodSheet';
import RecipeBuilder from '../components/RecipeBuilder';
import { todayStr } from '../lib/dates';

export default function LogFood() {
  const { settings } = useSettings();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const date = params.get('date') || todayStr();
  const meal = params.get('meal') || settings.meals[0].key;

  const [query, setQuery] = useState('');
  const [apiResults, setApiResults] = useState(null); // null = not searched
  const [apiErrors, setApiErrors] = useState([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(null); // normalized food → ServingSheet
  const [sheet, setSheet] = useState(null); // 'scan' | 'quick' | 'custom' | 'recipe'
  const [notFoundBarcode, setNotFoundBarcode] = useState(null);
  const [toast, setToast] = useState('');
  const debounceRef = useRef();
  const abortRef = useRef();

  // local codex matches, instant
  const localResults = useLiveQuery(async () => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return db.foods.filter((f) => f.name.toLowerCase().includes(q)).limit(10).toArray();
  }, [query]);

  const recents = useLiveQuery(
    () => db.foods.orderBy('lastUsed').reverse().filter((f) => (f.useCount || 0) > 0).limit(8).toArray(),
    []
  );
  const frequents = useLiveQuery(
    () => db.foods.orderBy('useCount').reverse().filter((f) => (f.useCount || 0) > 1).limit(8).toArray(),
    []
  );
  const myFoods = useLiveQuery(
    () => db.foods.filter((f) => f.source === 'custom').limit(20).toArray(),
    []
  );
  const recipes = useLiveQuery(
    () => db.foods.filter((f) => f.source === 'recipe').limit(20).toArray(),
    []
  );

  // debounced API search — fires 300 ms after typing stops
  useEffect(() => {
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    if (query.length < 2) {
      setApiResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const { results, errors } = await searchFoods(query, {
          usdaKey: settings.usdaKey,
          signal: ctrl.signal,
        });
        setApiResults(results);
        setApiErrors(errors);
      } catch (e) {
        if (e.name !== 'AbortError') {
          setApiResults([]);
          setApiErrors(['Search failed — are you offline? Your local codex still works.']);
        }
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, settings.usdaKey]);

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 1400);
  }

  const showBrowse = query.length < 2;
  const localKeys = new Set((localResults || []).map((f) => f.key));
  const merged = [
    ...(localResults || []),
    ...((apiResults || []).filter((f) => !localKeys.has(f.key)) || []),
  ];

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="font-display text-lg text-gold tracking-wide">Log Provisions</h1>
          <p className="text-[11px] text-ink-3 mt-0.5">
            {date === todayStr() ? 'Today' : date} · {settings.meals.find((m) => m.key === meal)?.label}
          </p>
        </div>
        <button className="btn-ghost !py-1.5" onClick={() => nav(`/?date=${date}`)}>
          Done
        </button>
      </header>

      {/* search + scan */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            className="input !py-2.5 pr-8"
            placeholder="Search all known provisions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink" onClick={() => setQuery('')}>
              ×
            </button>
          )}
        </div>
        <button className="btn-gold !px-3.5" onClick={() => setSheet('scan')} title="Scan barcode" aria-label="Scan barcode">
          <BarcodeGlyph />
        </button>
      </div>

      {/* quick actions */}
      <div className="grid grid-cols-3 gap-2">
        <ActionTile icon="✧" label="Quick Add" onClick={() => setSheet('quick')} />
        <ActionTile icon="📜" label="Custom Food" onClick={() => setSheet('custom')} />
        <ActionTile icon="⚗" label="Forge Recipe" onClick={() => setSheet('recipe')} />
      </div>

      {/* search results */}
      {!showBrowse && (
        <div>
          <SectionTitle>Findings</SectionTitle>
          {merged.length > 0 && (
            <div className="card divide-y divide-rune/40">
              {merged.map((f) => (
                <FoodRow key={f.key} food={f} onPick={() => setPicked(f)} />
              ))}
            </div>
          )}
          {searching && <Spinner label="Searching the realms…" />}
          {!searching && merged.length === 0 && (
            <EmptyState icon="∅" title="Nothing found">
              Try another name, scan the barcode, or inscribe it as a custom food.
            </EmptyState>
          )}
          {apiErrors.length > 0 && !searching && (
            <p className="text-[11px] text-ember-bright mt-2">{apiErrors.join(' · ')}</p>
          )}
        </div>
      )}

      {/* browse sections */}
      {showBrowse && (
        <>
          <FoodSection title="Recently Logged" foods={recents} onPick={setPicked} />
          <FoodSection title="Frequent Provisions" foods={frequents} onPick={setPicked} />
          <FoodSection title="My Codex" foods={myFoods} onPick={setPicked} empty="Custom foods you inscribe will gather here." />
          <FoodSection title="Recipes" foods={recipes} onPick={setPicked} empty="Forged recipes will gather here." />
        </>
      )}

      {/* sheets */}
      {picked && (
        <ServingSheet
          open={!!picked}
          onClose={() => setPicked(null)}
          food={picked}
          date={date}
          meal={meal}
          onDone={() => flash('Inscribed ✓')}
        />
      )}
      <Scanner
        open={sheet === 'scan'}
        onClose={() => setSheet(null)}
        onFound={(food) => setPicked(food)}
        onNotFound={(code) => {
          setNotFoundBarcode(code);
          setSheet('custom');
          flash('Not in the codex — inscribe it below');
        }}
      />
      {sheet === 'custom' && (
        <CustomFoodSheet
          open
          onClose={() => {
            setSheet(null);
            setNotFoundBarcode(null);
          }}
          initial={notFoundBarcode ? { barcode: notFoundBarcode, name: '' } : null}
          onSaved={(food) => setPicked(food)}
        />
      )}
      {sheet === 'recipe' && (
        <RecipeBuilder open onClose={() => setSheet(null)} onSaved={(food) => setPicked(food)} />
      )}
      <QuickAddSheet
        open={sheet === 'quick'}
        onClose={() => setSheet(null)}
        date={date}
        meal={meal}
        onDone={() => flash('Inscribed ✓')}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-24 inset-x-0 flex justify-center z-50 pointer-events-none"
          >
            <span className="bg-surface-2 border border-gold/40 text-gold-bright text-xs px-4 py-2 rounded-full shadow-glow">
              {toast}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionTile({ icon, label, onClick }) {
  return (
    <button className="card p-3 text-center hover:border-rune-2 transition-colors" onClick={onClick}>
      <p className="text-lg leading-none mb-1.5">{icon}</p>
      <p className="text-[11px] text-ink-2">{label}</p>
    </button>
  );
}

function FoodSection({ title, foods, onPick, empty }) {
  if (!foods) return null;
  if (foods.length === 0 && !empty) return null;
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      {foods.length === 0 ? (
        <p className="text-xs text-ink-3 italic px-1">{empty}</p>
      ) : (
        <div className="card divide-y divide-rune/40">
          {foods.map((f) => (
            <FoodRow key={f.key} food={f} onPick={() => onPick(f)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FoodRow({ food, onPick }) {
  const p = food.per100 || {};
  const pk = (p.protein || 0) * 4;
  const ck = (p.carbs || 0) * 4;
  const fk = (p.fat || 0) * 9;
  const tot = pk + ck + fk || 1;
  return (
    <button className="w-full px-3.5 py-2.5 text-left hover:bg-surface-2/60 transition-colors" onClick={onPick}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink truncate">
            {food.name}
            {food.source === 'custom' && <span className="text-gold-dim text-[10px] ml-1.5">📜</span>}
            {food.source === 'recipe' && <span className="text-gold-dim text-[10px] ml-1.5">⚗</span>}
          </p>
          <p className="text-[11px] text-ink-3 truncate mt-0.5">
            {food.brand ? `${food.brand} · ` : ''}
            {fmt.kcal(p.kcal)} kcal
            {food.servings?.[0] ? ` · ${food.servings[0].label}` : ' /100g'}
          </p>
        </div>
        {/* macro composition preview bar */}
        <div className="w-14 h-1.5 rounded-full overflow-hidden flex shrink-0 bg-rune/60">
          <div style={{ width: `${(pk / tot) * 100}%`, background: MACRO_COLORS.protein }} />
          <div style={{ width: `${(ck / tot) * 100}%`, background: MACRO_COLORS.carbs }} />
          <div style={{ width: `${(fk / tot) * 100}%`, background: MACRO_COLORS.fat }} />
        </div>
      </div>
    </button>
  );
}

function QuickAddSheet({ open, onClose, date, meal, onDone }) {
  const { settings } = useSettings();
  const [vals, setVals] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
  const [mealKey, setMealKey] = useState(meal);
  const set = (k) => (e) => setVals((v) => ({ ...v, [k]: e.target.value }));

  async function save() {
    const kcal = parseFloat(vals.kcal);
    if (!kcal && !parseFloat(vals.protein) && !parseFloat(vals.carbs) && !parseFloat(vals.fat)) return;
    await logEntry({
      date,
      meal: mealKey,
      name: vals.name.trim() || 'Quick entry',
      brand: null,
      amountDesc: 'quick add',
      grams: null,
      per100: null,
      kcal: kcal || 0,
      protein: parseFloat(vals.protein) || 0,
      carbs: parseFloat(vals.carbs) || 0,
      fat: parseFloat(vals.fat) || 0,
      source: 'quick',
    });
    setVals({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
    onDone?.();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Quick Add">
      <div className="space-y-4">
        <Field label="Name (optional)">
          <input className="input" value={vals.name} onChange={set('name')} placeholder="Tavern meal" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories">
            <input className="input" type="number" inputMode="decimal" value={vals.kcal} onChange={set('kcal')} autoFocus />
          </Field>
          <Field label="Protein (g)">
            <input className="input" type="number" inputMode="decimal" value={vals.protein} onChange={set('protein')} />
          </Field>
          <Field label="Carbs (g)">
            <input className="input" type="number" inputMode="decimal" value={vals.carbs} onChange={set('carbs')} />
          </Field>
          <Field label="Fat (g)">
            <input className="input" type="number" inputMode="decimal" value={vals.fat} onChange={set('fat')} />
          </Field>
        </div>
        <Field label="Meal">
          <Segmented
            options={settings.meals.map((m) => ({ value: m.key, label: m.label }))}
            value={mealKey}
            onChange={setMealKey}
            className="flex flex-wrap"
          />
        </Field>
        <button className="btn-gold w-full" onClick={save}>
          Inscribe Entry
        </button>
      </div>
    </Sheet>
  );
}

function BarcodeGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M3 5h1.5v14H3V5Zm3 0h1v14H6V5Zm2.5 0H10v14H8.5V5Zm3 0h2v14h-2V5Zm3.5 0h1v14h-1V5Zm2.5 0h1.5v14H17.5V5Zm3 0H21v14h-.5V5Z" />
    </svg>
  );
}
