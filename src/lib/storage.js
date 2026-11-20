// LocalStorage persistence for daily game progress, streaks, and stats (no accounts needed).

import { addDays, daysBetween, getTodayKey } from './dates.js';

const STORAGE_KEY = 'criptico_emotes_baulo_v1';

function emptyStore() {
  return {
    days: {}, // { [dateKey]: { guesses: string[], revealedHints: string[], revealedIndices: number[], status: 'playing'|'won'|'lost', score: number, emoteId: string, nombre: string } }
  };
}

export function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.days) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

export function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota / private-mode errors gracefully
  }
}

export function getDayRecord(store, dateKey) {
  const rec = store.days[dateKey];
  if (rec) {
    return {
      guesses: Array.isArray(rec.guesses) ? rec.guesses : [],
      revealedHints: Array.isArray(rec.revealedHints) ? rec.revealedHints : [],
      visibleHints: Array.isArray(rec.visibleHints) ? rec.visibleHints : (Array.isArray(rec.revealedHints) ? rec.revealedHints.slice() : []),
      revealedIndices: Array.isArray(rec.revealedIndices) ? rec.revealedIndices : [],
      status: rec.status || 'playing',
      score: typeof rec.score === 'number' ? rec.score : 0,
      emoteId: rec.emoteId || null,
      nombre: rec.nombre || null,
    };
  }
  return {
    guesses: [],
    revealedHints: [],
    visibleHints: [],
    revealedIndices: [],
    status: 'playing',
    score: 0,
    emoteId: null,
    nombre: null,
  };
}

export function computeScore(record) {
  if (record.status !== 'won') return 0;
  const wrongAttempts = Math.max(0, record.guesses.length - 1);
  const hintsUsed = record.revealedHints.length + record.revealedIndices.length;
  return Math.max(10, 100 - wrongAttempts * 10 - hintsUsed * 10);
}

export function computeStats(store, todayKey = getTodayKey()) {
  const entries = Object.entries(store.days).filter(
    ([, rec]) => rec && (rec.status === 'won' || rec.status === 'lost')
  );

  const played = entries.length;
  const wonEntries = entries.filter(([, rec]) => rec.status === 'won');
  const won = wonEntries.length;
  const winPct = played > 0 ? Math.round((won / played) * 100) : 0;

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalScore = 0;
  for (const [, rec] of wonEntries) {
    const n = Math.min(5, Math.max(1, (rec.guesses || []).length));
    distribution[n]++;
    totalScore += typeof rec.score === 'number' ? rec.score : computeScore(rec);
  }
  const avgScore = won > 0 ? Math.round(totalScore / won) : 0;

  // Compute streaks over sorted won calendar dates (excluding future dates just in case)
  const wonDates = wonEntries
    .map(([k]) => k)
    .filter((k) => k <= todayKey)
    .sort();

  let bestStreak = 0;
  let run = 0;
  let prev = null;
  for (const d of wonDates) {
    if (prev && daysBetween(prev, d) === 1) {
      run++;
    } else {
      run = 1;
    }
    if (run > bestStreak) bestStreak = run;
    prev = d;
  }

  // Current streak: counts backward from today (or yesterday if today not finished yet)
  const wonSet = new Set(wonDates);
  let currentStreak = 0;
  let cursor = wonSet.has(todayKey) ? todayKey : addDays(todayKey, -1);
  while (wonSet.has(cursor)) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

  // Unlocked emotes gallery (most recently solved first)
  const solvedEmotes = wonEntries
    .filter(([, rec]) => rec.emoteId && rec.nombre)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([dateKey, rec]) => ({
      dateKey,
      id: rec.emoteId,
      nombre: rec.nombre,
      attempts: (rec.guesses || []).length,
      score: rec.score || 0,
    }));

  return {
    played,
    won,
    winPct,
    currentStreak,
    bestStreak,
    avgScore,
    distribution,
    solvedEmotes,
  };
}
