// Food data sources: Open Food Facts (primary, no key) and USDA FoodData
// Central (fallback; DEMO_KEY works out of the box, a personal key raises the
// rate limit). Both are normalized to one shape:
//
//   { key, name, brand, barcode, source, per100: {kcal, protein, ...}, servings: [{label, grams}] }

const OFF_BASE = 'https://world.openfoodfacts.org';
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

const OFF_FIELDS =
  'code,product_name,generic_name,brands,nutriments,serving_size,serving_quantity,quantity';

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

// ── Open Food Facts ──

function normalizeOffProduct(p) {
  if (!p || (!p.product_name && !p.generic_name)) return null;
  const nut = p.nutriments || {};
  const kcal = n(nut['energy-kcal_100g']) || n(nut['energy_100g']) / 4.184;
  const per100 = {
    kcal,
    protein: n(nut['proteins_100g']),
    carbs: n(nut['carbohydrates_100g']),
    fat: n(nut['fat_100g']),
    fiber: n(nut['fiber_100g']),
    sugar: n(nut['sugars_100g']),
    satfat: n(nut['saturated-fat_100g']),
    // OFF stores these in grams per 100 g → convert to mg
    sodium: n(nut['sodium_100g']) * 1000 || n(nut['salt_100g']) * 400,
    potassium: n(nut['potassium_100g']) * 1000,
    cholesterol: n(nut['cholesterol_100g']) * 1000,
    vitaminC: n(nut['vitamin-c_100g']) * 1000,
    calcium: n(nut['calcium_100g']) * 1000,
    iron: n(nut['iron_100g']) * 1000,
  };
  if (per100.kcal <= 0 && per100.protein <= 0 && per100.carbs <= 0 && per100.fat <= 0) return null;
  const servings = [];
  const sq = n(p.serving_quantity);
  if (sq > 0) servings.push({ label: `1 serving (${p.serving_size || `${sq} g`})`, grams: sq });
  return {
    key: `off:${p.code}`,
    name: p.product_name || p.generic_name,
    brand: (p.brands || '').split(',')[0].trim() || null,
    barcode: p.code,
    source: 'off',
    per100,
    servings,
  };
}

export async function searchOff(query, { signal } = {}) {
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(
    query
  )}&search_simple=1&action=process&json=1&page_size=20&fields=${OFF_FIELDS}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Open Food Facts search failed (${res.status})`);
  const data = await res.json();
  return (data.products || []).map(normalizeOffProduct).filter(Boolean);
}

export async function lookupBarcode(barcode, { signal } = {}) {
  const url = `${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Barcode lookup failed (${res.status})`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  return normalizeOffProduct(data.product);
}

// ── USDA FoodData Central ──

const USDA_NUTRIENT_MAP = {
  208: ['kcal', 1],
  203: ['protein', 1],
  205: ['carbs', 1],
  204: ['fat', 1],
  291: ['fiber', 1],
  269: ['sugar', 1],
  606: ['satfat', 1],
  307: ['sodium', 1], // already mg
  306: ['potassium', 1],
  601: ['cholesterol', 1],
  401: ['vitaminC', 1],
  301: ['calcium', 1],
  303: ['iron', 1],
};

function normalizeUsdaFood(f) {
  const per100 = {};
  for (const fn of f.foodNutrients || []) {
    const num = Number(fn.nutrientNumber ?? fn.nutrient?.number);
    const mapping = USDA_NUTRIENT_MAP[num];
    if (mapping) per100[mapping[0]] = n(fn.value ?? fn.amount) * mapping[1];
  }
  if (!per100.kcal && !per100.protein && !per100.carbs && !per100.fat) return null;
  const servings = [];
  if (n(f.servingSize) > 0 && (f.servingSizeUnit || '').toLowerCase().startsWith('g')) {
    servings.push({ label: `1 serving (${f.servingSize} g)`, grams: n(f.servingSize) });
  }
  return {
    key: `usda:${f.fdcId}`,
    name: title(f.description || 'Unknown food'),
    brand: f.brandOwner || f.brandName || null,
    barcode: f.gtinUpc || null,
    source: 'usda',
    per100,
    servings,
  };
}

function title(s) {
  return s.length > 3 && s === s.toUpperCase()
    ? s.toLowerCase().replace(/(^|[\s,(])[a-z]/g, (m) => m.toUpperCase())
    : s;
}

export async function searchUsda(query, apiKey, { signal } = {}) {
  const key = apiKey || 'DEMO_KEY';
  const url = `${USDA_BASE}/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(
    query
  )}&pageSize=20&dataType=${encodeURIComponent('Foundation,SR Legacy,Branded')}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`USDA search failed (${res.status})`);
  const data = await res.json();
  return (data.foods || []).map(normalizeUsdaFood).filter(Boolean);
}

// ── Combined search: OFF first, USDA to fill the gaps ──

export async function searchFoods(query, { usdaKey, signal } = {}) {
  const results = [];
  const errors = [];
  const [off, usda] = await Promise.allSettled([
    searchOff(query, { signal }),
    searchUsda(query, usdaKey, { signal }),
  ]);
  if (off.status === 'fulfilled') results.push(...off.value);
  else errors.push('Open Food Facts unreachable');
  if (usda.status === 'fulfilled') {
    const seen = new Set(results.map((r) => r.barcode).filter(Boolean));
    results.push(...usda.value.filter((r) => !r.barcode || !seen.has(r.barcode)));
  } else {
    errors.push('USDA unreachable');
  }
  return { results, errors };
}
