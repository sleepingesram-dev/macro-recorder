import Dexie from 'dexie';

// localStorage key for settings — shared with SettingsContext (kept here so the
// data layer has no dependency on React state modules).
export const SETTINGS_KEY = 'chronicle.settings';

// ── The Chronicle's local vault. Everything lives here, on-device. ──
//
// entries      — every logged food row (denormalized macros, so history survives food edits)
// foods        — the personal food codex: custom foods + cached API/scan results
// recipes      — saved multi-ingredient recipes with per-serving macros
// weights      — one weigh-in per date (kg canonical)
// measurements — body measurements over time (cm canonical)
// photos       — progress photos as blobs, tied to dates
// water        — one row per date (ml canonical)

export const db = new Dexie('chronicle');

db.version(1).stores({
  entries: '++id, date, meal, foodKey, ts',
  foods: '++id, &key, name, source, barcode, lastUsed, useCount',
  recipes: '++id, name',
  weights: '&date',
  measurements: '++id, date, type',
  photos: '++id, date',
  water: '&date',
});

// Nutrient fields carried on foods (per 100 g) and entries (per logged amount).
export const NUTRIENTS = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'satfat', label: 'Sat. Fat', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
  { key: 'potassium', label: 'Potassium', unit: 'mg' },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg' },
  { key: 'vitaminC', label: 'Vitamin C', unit: 'mg' },
  { key: 'calcium', label: 'Calcium', unit: 'mg' },
  { key: 'iron', label: 'Iron', unit: 'mg' },
];

export function emptyNutrients() {
  return Object.fromEntries(NUTRIENTS.map((n) => [n.key, 0]));
}

// Scale a per-100g nutrient map to a gram amount.
export function scaleNutrients(per100, grams) {
  const out = {};
  for (const n of NUTRIENTS) out[n.key] = ((per100?.[n.key] || 0) * grams) / 100;
  return out;
}

export function sumNutrients(rows) {
  const out = emptyNutrients();
  for (const r of rows) for (const n of NUTRIENTS) out[n.key] += r[n.key] || 0;
  return out;
}

// ── Entry helpers ──

export async function logEntry(entry) {
  const id = await db.entries.add({ ts: Date.now(), ...entry });
  if (entry.foodKey) {
    const food = await db.foods.where('key').equals(entry.foodKey).first();
    if (food) {
      await db.foods.update(food.id, {
        useCount: (food.useCount || 0) + 1,
        lastUsed: Date.now(),
      });
    }
  }
  return id;
}

export async function entriesForDate(date) {
  return db.entries.where('date').equals(date).sortBy('ts');
}

// Upsert a food into the personal codex, keyed by source identity.
export async function upsertFood(food) {
  const existing = await db.foods.where('key').equals(food.key).first();
  if (existing) {
    await db.foods.update(existing.id, { ...food, useCount: existing.useCount || 0 });
    return existing.id;
  }
  return db.foods.add({ useCount: 0, lastUsed: Date.now(), ...food });
}

export async function copyEntriesToDate(entries, targetDate, meal = null) {
  const now = Date.now();
  const rows = entries.map((e, i) => {
    const { id, ...rest } = e;
    return { ...rest, date: targetDate, meal: meal || e.meal, ts: now + i };
  });
  return db.entries.bulkAdd(rows);
}

// ── Water ──

export async function addWater(date, ml) {
  const row = await db.water.get(date);
  const next = Math.max(0, (row?.ml || 0) + ml);
  await db.water.put({ date, ml: next });
  return next;
}

// ── Full vault export / import ──

export async function exportVault() {
  const [entries, foods, recipes, weights, measurements, water, photos] = await Promise.all([
    db.entries.toArray(),
    db.foods.toArray(),
    db.recipes.toArray(),
    db.weights.toArray(),
    db.measurements.toArray(),
    db.water.toArray(),
    db.photos.toArray(),
  ]);
  const photosSerialized = await Promise.all(
    photos.map(async (p) => ({ ...p, blob: await blobToDataUrl(p.blob) }))
  );
  return {
    app: 'the-chronicle',
    schema: 1,
    exportedAt: new Date().toISOString(),
    settings: JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'),
    entries,
    foods,
    recipes,
    weights,
    measurements,
    water,
    photos: photosSerialized,
  };
}

export async function importVault(data, { replace = true } = {}) {
  if (!data || data.app !== 'the-chronicle') throw new Error('Not a Chronicle backup file.');
  // Blob conversion uses fetch, which must happen BEFORE the transaction —
  // awaiting a non-Dexie promise inside it would auto-commit the transaction.
  const photoRows = [];
  for (const p of data.photos || []) {
    const { id, blob, ...rest } = p;
    photoRows.push({ ...rest, blob: await dataUrlToBlob(blob) });
  }
  await db.transaction('rw', db.tables, async () => {
    if (replace) await Promise.all(db.tables.map((t) => t.clear()));
    const strip = (rows) => (rows || []).map(({ id, ...r }) => r);
    await db.entries.bulkAdd(strip(data.entries));
    for (const f of data.foods || []) {
      const { id, ...rest } = f;
      const existing = await db.foods.where('key').equals(rest.key).first();
      if (!existing) await db.foods.add(rest);
    }
    await db.recipes.bulkAdd(strip(data.recipes));
    for (const w of data.weights || []) {
      // merge mode: local weigh-ins win over the backup's for the same date
      if (replace || !(await db.weights.get(w.date))) await db.weights.put({ date: w.date, kg: w.kg });
    }
    await db.measurements.bulkAdd(strip(data.measurements));
    for (const w of data.water || []) {
      if (replace || !(await db.water.get(w.date))) await db.water.put({ date: w.date, ml: w.ml });
    }
    await db.photos.bulkAdd(photoRows);
  });
  if (data.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
}

// Console access for power users (and tests): window.chronicle.db is the live vault.
if (typeof window !== 'undefined') {
  window.chronicle = { db, exportVault, importVault };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}
