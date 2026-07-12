import { addDays, todayStr } from './dates';

// ── Feats — the achievement ledger ──
// Each feat is checked against a stats snapshot computed from the vault.

export const FEATS = [
  { key: 'first-entry', name: 'First Bite!', desc: 'Log your first food.', icon: '✦', check: (s) => s.totalEntries >= 1 },
  { key: 'streak-3', name: 'Warming Up', desc: 'Log 3 days in a row.', icon: '⚔', check: (s) => s.bestStreak >= 3 },
  { key: 'streak-7', name: 'Locked In', desc: 'Log 7 days in a row.', icon: '⚔', check: (s) => s.bestStreak >= 7 },
  { key: 'streak-14', name: 'Two Weeks Strong', desc: 'Log 14 days in a row.', icon: '🛡', check: (s) => s.bestStreak >= 14 },
  { key: 'streak-30', name: 'Iron Discipline', desc: 'Log 30 days in a row.', icon: '🛡', check: (s) => s.bestStreak >= 30 },
  { key: 'streak-60', name: 'Unbreakable', desc: 'Log 60 days in a row.', icon: '♜', check: (s) => s.bestStreak >= 60 },
  { key: 'streak-100', name: 'Century Streak', desc: 'Log 100 days in a row.', icon: '♛', check: (s) => s.bestStreak >= 100 },
  { key: 'entries-50', name: 'Getting Started', desc: 'Log 50 foods.', icon: '✎', check: (s) => s.totalEntries >= 50 },
  { key: 'entries-250', name: 'Regular', desc: 'Log 250 foods.', icon: '✎', check: (s) => s.totalEntries >= 250 },
  { key: 'entries-1000', name: 'Logging Legend', desc: 'Log 1,000 foods.', icon: '✒', check: (s) => s.totalEntries >= 1000 },
  { key: 'first-scan', name: 'Scanner Pro', desc: 'Scan your first barcode.', icon: '◈', check: (s) => s.scannedCount >= 1 },
  { key: 'first-recipe', name: 'Chef', desc: 'Create your first recipe.', icon: '⚗', check: (s) => s.recipeCount >= 1 },
  { key: 'first-custom', name: 'Food Creator', desc: 'Create a custom food.', icon: '📜', check: (s) => s.customFoodCount >= 1 },
  { key: 'protein-7', name: 'Protein Streak', desc: 'Hit your protein target 7 days straight.', icon: '⚒', check: (s) => s.proteinStreak >= 7 },
  { key: 'balance-7', name: 'Perfect Balance', desc: 'All three macros within ±10% of target, 7 days straight.', icon: '☯', check: (s) => s.balanceStreak >= 7 },
  { key: 'weights-30', name: 'Scale Regular', desc: 'Log 30 weigh-ins.', icon: '⚖', check: (s) => s.weighInCount >= 30 },
  { key: 'water-7', name: 'Hydrated', desc: 'Hit your water target 7 days straight.', icon: '☔', check: (s) => s.waterStreak >= 7 },
  { key: 'codex-awake', name: 'Dialed In', desc: 'Reach a high-confidence TDEE estimate.', icon: '🜁', check: (s) => s.codexHighConfidence },
];

// Current + best consecutive-day streak over a set of logged dates.
export function computeStreaks(loggedDates) {
  const set = new Set(loggedDates);
  let best = 0;
  for (const d of set) {
    if (set.has(addDays(d, -1))) continue; // not a streak start
    let len = 1;
    let cur = d;
    while (set.has(addDays(cur, 1))) {
      cur = addDays(cur, 1);
      len++;
    }
    best = Math.max(best, len);
  }
  // current streak: count back from today (or yesterday, if today not yet logged)
  let anchor = set.has(todayStr()) ? todayStr() : addDays(todayStr(), -1);
  let current = 0;
  while (set.has(anchor)) {
    current++;
    anchor = addDays(anchor, -1);
  }
  return { current, best };
}

// Consecutive-days-meeting-a-predicate streak, counting back from today/yesterday.
export function backwardStreak(datesMeeting) {
  const set = new Set(datesMeeting);
  let anchor = set.has(todayStr()) ? todayStr() : addDays(todayStr(), -1);
  let n = 0;
  while (set.has(anchor)) {
    n++;
    anchor = addDays(anchor, -1);
  }
  return n;
}

export function evaluateFeats(stats) {
  return FEATS.map((f) => ({ ...f, earned: !!f.check(stats) }));
}

// Feats are monotonic: once earned, always earned — persisted so windowed
// stat queries can't "un-earn" an old achievement.
const EARNED_KEY = 'chronicle.featsEarned';

export function loadEarnedFeats() {
  try {
    return new Set(JSON.parse(localStorage.getItem(EARNED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

export function persistEarnedFeats(keys) {
  localStorage.setItem(EARNED_KEY, JSON.stringify([...keys]));
}

// XP & level — a gentle curve: level n needs 25·n² XP.
export function xpAndLevel(stats) {
  const xp =
    stats.daysLogged * 10 +
    stats.totalEntries +
    stats.weighInCount * 5 +
    stats.featsEarned * 50;
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 25)));
  const currentFloor = level === 1 ? 0 : 25 * level * level; // level 1 starts at 0 XP
  const nextAt = 25 * (level + 1) * (level + 1);
  const progress = Math.max(0, Math.min(1, (xp - currentFloor) / (nextAt - currentFloor)));
  return { xp, level, progress, nextAt };
}
