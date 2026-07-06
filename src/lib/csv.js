// CSV export — data belongs to the user, always.

function esc(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows, columns) {
  const header = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(c.get(r))).join(',')).join('\n');
  return `${header}\n${body}`;
}

export function downloadFile(filename, content, type = 'text/csv') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const ENTRY_COLUMNS = [
  { label: 'date', get: (e) => e.date },
  { label: 'meal', get: (e) => e.meal },
  { label: 'name', get: (e) => e.name },
  { label: 'brand', get: (e) => e.brand || '' },
  { label: 'amount', get: (e) => e.amountDesc || '' },
  { label: 'grams', get: (e) => round1(e.grams) },
  { label: 'kcal', get: (e) => round1(e.kcal) },
  { label: 'protein_g', get: (e) => round1(e.protein) },
  { label: 'carbs_g', get: (e) => round1(e.carbs) },
  { label: 'fat_g', get: (e) => round1(e.fat) },
  { label: 'fiber_g', get: (e) => round1(e.fiber) },
  { label: 'sugar_g', get: (e) => round1(e.sugar) },
  { label: 'satfat_g', get: (e) => round1(e.satfat) },
  { label: 'sodium_mg', get: (e) => round1(e.sodium) },
  { label: 'potassium_mg', get: (e) => round1(e.potassium) },
  { label: 'cholesterol_mg', get: (e) => round1(e.cholesterol) },
];

export const WEIGHT_COLUMNS = [
  { label: 'date', get: (w) => w.date },
  { label: 'weight_kg', get: (w) => round2(w.kg) },
];

const round1 = (v) => (v == null ? '' : Math.round(v * 10) / 10);
const round2 = (v) => (v == null ? '' : Math.round(v * 100) / 100);
