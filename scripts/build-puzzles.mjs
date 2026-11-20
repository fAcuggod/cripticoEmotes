#!/usr/bin/env node
/**
 * Builds public/puzzles.json from:
 *  - data/emote-set.json (7TV emote set of baulo)
 *  - data/chatstats.json (StreamElements chat usage stats for baulo)
 *  - data/defs/sheet_*.json (visual definitions, descriptions, charade parts, flags)
 *
 * Output is 100% deterministic for the same inputs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rngFor, pick, shuffle } from './lib/rng.mjs';
import { numberToWords } from './lib/numbers.mjs';
import { WORDS_BY_LETTER, FILLER } from './lib/words.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const VALID_NAME_RE = /^[A-Za-zÑñ]+$|^[0-9]+$/;
const MAX_PLAYABLE_LEN = 16;
const MIN_PLAYABLE_LEN = 2;

// Known baulo / Kick-era signature patterns & iconic channel emotes (for Tier 2 boost)
const CHANNEL_KEYWORDS = [
  'baulo', 'bauti', 'barto', 'coco', 'kenny', 'walti', 'argentina', 'mate',
  'fulbo', 'davo', 'cobra', 'cobrix', 'momo', 'coscu', 'yuta', 'messi',
  'maradona', 'zidane', 'cristiano', 'bellingham', 'barovero', 'fabbiani',
  'latorre', 'peron', 'fort', 'demente', 'tade', 'potge', 'xdd', 'dans',
  'peepo', 'monka', 'sadge', 'okayge', 'susge', 'prayge', 'madge', 'wide',
  'cine', 'cooking', 'peak', 'tweak', 'banger', 'void', 'ragebait', 'cooked',
  'slay', 'jarvis', 'andapaya', 'tengounplan', 'ionovoy', 'iotelo', 'iatelo',
  'maravillosa', 'emociona', 'amarilla', 'roja', 'postura', 'saltito', 'muelto',
  'sentao', 'amimir', 'chilling', 'calma', 'siu', 'kek', 'lol', 'pog', 'pag',
];

function stripAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normAnswer(str) {
  // Keep Ñ as Ñ, uppercase everything else, strip accents if any
  return str
    .replace(/ñ/g, '__ENYE__')
    .replace(/Ñ/g, '__ENYE__')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/__ENYE__/g, 'Ñ');
}

function capFirst(s) {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

function loadDefinitions() {
  const dir = path.join(ROOT, 'data', 'defs');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const defs = {};
  for (const f of files) {
    Object.assign(defs, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  }
  return defs;
}

function loadChatStats() {
  const file = path.join(ROOT, 'data', 'chatstats.json');
  const counts = new Map();
  if (!fs.existsSync(file)) return counts;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const key of ['sevenTVEmotes', 'bttvEmotes', 'ffzEmotes']) {
    for (const item of raw[key] || []) {
      const k = String(item.emote || '').toLowerCase();
      if (!k) continue;
      counts.set(k, (counts.get(k) || 0) + Number(item.amount || 0));
    }
  }
  return counts;
}

// --- Clue generators ---
// Every generator returns { tipo, pista, explicacion, dificultad } or null.
// Markup conventions (matching criptico.es):
//   _definicion_  (green)
//   ~indicador~   (amber)
//   *material*    (brick red)

function makeCharade(emote, def, rand) {
  const partes = def.partes;
  if (!Array.isArray(partes) || partes.length < 2 || partes.length > 3) return null;
  if (partes.map(([c]) => c).join('') !== emote.name) return null;

  // Avoid charades where a part clue repeats a major (6+ letter) word already in def
  const defWords = new Set(
    stripAccents(def.def).toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 6 && w !== 'ranita' && w !== 'streamer')
  );
  for (const [, clue] of partes) {
    const clueWords = stripAccents(clue).toLowerCase().split(/[^a-z]+/);
    if (clueWords.some((w) => defWords.has(w))) return null;
  }

  const d = def.def;
  const clues = partes.map(([, clue]) => `*${clue}*`);
  const listStr = clues.length === 2
    ? `${clues[0]} y ${clues[1]}`
    : `${clues[0]}, ${clues[1]} y ${clues[2]}`;

  const templates = [
    () => `_${capFirst(d)}_, ~al juntar~ ${listStr}`,
    () => `~Uniendo~ ${listStr} ~se forma~ _${d}_`,
    () => `_${capFirst(d)}_ ~sumando~ ${listStr}`,
    () => `~Combinando~ ${listStr} ~aparece~ _${d}_`,
  ];

  const pista = pick(rand, templates)();
  const breakdown = partes.map(([c, cl]) => `«${c}» (${cl})`).join(' + ');
  const explicacion = `Definición: «${d}». Charada: al unir ${breakdown} se obtiene ${emote.name}.`;
  const dificultad = partes.length === 2 && emote.uses > 0 ? 'Fácil' : 'Medio';
  return { tipo: 'charada', pista, explicacion, dificultad };
}

function scrambleAnswer(ans, rand) {
  const chars = [...ans];
  if (new Set(chars).size < 2) return null;
  const rev = [...chars].reverse().join('');
  let best = null;
  let bestDiff = -1;

  for (let attempt = 0; attempt < 40; attempt++) {
    const sh = shuffle(rand, chars).join('');
    if (sh === ans || sh === rev) continue;
    let diff = 0;
    for (let i = 0; i < chars.length; i++) {
      if (sh[i] !== chars[i]) diff++;
    }
    if (diff > bestDiff) {
      bestDiff = diff;
      best = sh;
    }
    if (diff >= Math.ceil(chars.length * 0.7)) break;
  }
  return best;
}

function makeAnagram(emote, def, rand) {
  const ans = normAnswer(emote.name);
  if (ans.length < 4 || ans.length > 11) return null;
  const scrambled = scrambleAnswer(ans, rand);
  if (!scrambled) return null;

  const d = def.def;
  const fodder = `«${scrambled.toLowerCase()}»`;
  const templates = [
    () => `_${capFirst(d)}_, ~revolviendo~ *${fodder}*`,
    () => `~Desordenando~ *${fodder}* ~surge~ _${d}_`,
    () => `_${capFirst(d)}_ ~con las letras revueltas de~ *${fodder}*`,
    () => `~Mezclando~ *${fodder}* ~resulta~ _${d}_`,
    () => `_${capFirst(d)}_, ~anagrama de~ *${fodder}*`,
  ];

  const pista = pick(rand, templates)();
  const explicacion = `Definición: «${d}». Anagrama: reordenando las letras de «${scrambled.toLowerCase()}» se obtiene ${emote.name}.`;
  const dificultad = ans.length <= 6 ? 'Fácil' : ans.length <= 9 ? 'Medio' : 'Difícil';
  return { tipo: 'anagrama', pista, explicacion, dificultad };
}

function makeReversal(emote, def, rand) {
  const ans = normAnswer(emote.name);
  if (ans.length < 3 || ans.length > 10) return null;
  const rev = [...ans].reverse().join('');
  if (rev === ans) return null; // palindrome

  const d = def.def;
  const fodder = `«${rev.toLowerCase()}»`;
  const templates = [
    () => `_${capFirst(d)}_, ~leído al revés en~ *${fodder}*`,
    () => `~Invirtiendo~ *${fodder}* ~aparece~ _${d}_`,
    () => `_${capFirst(d)}_ ~dando la vuelta a~ *${fodder}*`,
    () => `~Al derecho desde atrás~, *${fodder}* ~es~ _${d}_`,
  ];

  const pista = pick(rand, templates)();
  const explicacion = `Definición: «${d}». Inversión: leyendo «${rev.toLowerCase()}» de derecha a izquierda sale ${emote.name}.`;
  const dificultad = ans.length <= 7 ? 'Fácil' : 'Medio';
  return { tipo: 'inversion', pista, explicacion, dificultad };
}

function makeHidden(emote, def, rand) {
  const ans = normAnswer(emote.name).toLowerCase();
  if (ans.length < 3 || ans.length > 10) return null;

  // Build 2 or 3 word-like chunks with filler prefix & suffix and an internal split
  const pre = pick(rand, FILLER).slice(0, 2 + Math.floor(rand() * 2));
  const suf = pick(rand, FILLER).slice(0, 2 + Math.floor(rand() * 2));

  let seq;
  if (ans.length >= 6) {
    const cut1 = 2 + Math.floor(rand() * Math.max(1, Math.floor(ans.length / 2) - 1));
    const cut2 = cut1 + 2 + Math.floor(rand() * Math.max(1, ans.length - cut1 - 3));
    if (cut2 < ans.length - 1) {
      seq = `${pre}${ans.slice(0, cut1)} ${ans.slice(cut1, cut2)} ${ans.slice(cut2)}${suf}`;
    } else {
      seq = `${pre}${ans.slice(0, cut1)} ${ans.slice(cut1)}${suf}`;
    }
  } else if (ans.length >= 4) {
    const cut = 1 + Math.floor(rand() * (ans.length - 2));
    seq = `${pre}${ans.slice(0, cut)} ${ans.slice(cut)}${suf}`;
  } else {
    seq = `${pre}${ans}${suf}`;
  }

  // Ensure the exact answer never appears as a standalone token
  if (seq.split(' ').some((w) => w === ans)) return null;

  const d = def.def;
  const fodder = `«${seq}»`;
  const templates = [
    () => `_${capFirst(d)}_, ~oculto dentro de~ *${fodder}*`,
    () => `~Escondido en~ *${fodder}* ~asoma~ _${d}_`,
    () => `_${capFirst(d)}_ ~encubierto en~ *${fodder}*`,
    () => `~Dentro de~ *${fodder}* ~se esconde~ _${d}_`,
  ];

  const pista = pick(rand, templates)();
  const explicacion = `Definición: «${d}». Palabra oculta: leyendo las letras seguidas dentro de «${seq}» aparece ${emote.name}.`;
  const dificultad = ans.length <= 6 ? 'Fácil' : 'Medio';
  return { tipo: 'oculta', pista, explicacion, dificultad };
}

function makeAcrostic(emote, def, rand) {
  const ans = normAnswer(emote.name).toLowerCase();
  if (ans.length < 2 || ans.length > 9) return null;

  const used = new Set();
  const words = [];
  for (const ch of ans) {
    const pool = WORDS_BY_LETTER[ch];
    if (!pool || pool.length === 0) return null;
    const candidates = pool.filter((w) => !used.has(w) && stripAccents(w).toLowerCase() !== ans);
    const chosen = pick(rand, candidates.length ? candidates : pool);
    used.add(chosen);
    words.push(chosen);
  }

  const d = def.def;
  const fodder = `«${words.join(', ')}»`;
  const templates = [
    () => `_${capFirst(d)}_ ~en las iniciales de~ *${fodder}*`,
    () => `~Tomando la primera letra de~ *${fodder}* ~sale~ _${d}_`,
    () => `_${capFirst(d)}_, ~principios de~ *${fodder}*`,
    () => `~Al iniciar cada palabra de~ *${fodder}* ~se lee~ _${d}_`,
  ];

  const pista = pick(rand, templates)();
  const initials = words.map((w) => `${w[0].toUpperCase()}${w.slice(1)}`).join(', ');
  const explicacion = `Definición: «${d}». Iniciales: tomando la primera letra de «${initials}» se forma ${emote.name}.`;
  const dificultad = ans.length <= 5 ? 'Fácil' : 'Medio';
  return { tipo: 'iniciales', pista, explicacion, dificultad };
}

function makeNumericClue(emote, def, rand) {
  const n = Number(emote.name);
  const s = emote.name;
  const d = def.def;
  const options = [];

  // 1. Reversed digits (when digits differ and reversed has no leading zero)
  const revStr = [...s].reverse().join('');
  if (revStr !== s && !revStr.startsWith('0')) {
    const revWord = numberToWords(Number(revStr));
    options.push({
      tipo: 'inversion',
      pista: `_${capFirst(d)}_, ~al invertir~ *${revWord}*`,
      explicacion: `Definición: «${d}». Inversión numérica: al dar la vuelta a ${revStr} (${revWord}) se obtiene ${s}.`,
      dificultad: 'Fácil',
    });
  }

  // 2. Repeated identical digit (e.g. 11, 44, 55, 77, 99)
  if (s.length === 2 && s[0] === s[1]) {
    const digitWord = numberToWords(Number(s[0]));
    options.push({
      tipo: 'repeticion',
      pista: `_${capFirst(d)}_: ~dos veces la cifra~ *${digitWord}*`,
      explicacion: `Definición: «${d}». Repetición: escribiendo dos veces la cifra ${s[0]} (${digitWord}) se forma ${s}.`,
      dificultad: 'Fácil',
    });
  }

  // 3. Clean multiplication (both factors >= 3 and <= 20)
  const factorPairs = [];
  for (let a = 3; a <= Math.floor(Math.sqrt(n)); a++) {
    if (n % a === 0 && n / a <= 25) factorPairs.push([a, n / a]);
  }
  if (factorPairs.length) {
    const [a, b] = pick(rand, factorPairs);
    const aw = numberToWords(a);
    const bw = numberToWords(b);
    options.push({
      tipo: 'operacion',
      pista: `_${capFirst(d)}_, ~multiplicando~ *${aw}* ~por~ *${bw}*`,
      explicacion: `Definición: «${d}». Operación: ${a} × ${b} = ${s}.`,
      dificultad: 'Medio',
    });
  }

  // 4. Clean addition
  const a = 7 + Math.floor(rand() * Math.max(1, n - 14));
  const b = n - a;
  if (a > 0 && b > 0 && a !== n && b !== n) {
    options.push({
      tipo: 'operacion',
      pista: `_${capFirst(d)}_, ~sumando~ *${numberToWords(a)} y ${numberToWords(b)}*`,
      explicacion: `Definición: «${d}». Operación: ${a} + ${b} = ${s}.`,
      dificultad: 'Medio',
    });
  }

  // 5. Clean subtraction from round number
  const ceilTen = Math.ceil((n + 5) / 10) * 10;
  const diff = ceilTen - n;
  if (diff >= 1 && diff <= 25) {
    options.push({
      tipo: 'operacion',
      pista: `_${capFirst(d)}_, ~si restas~ *${numberToWords(diff)} a ${numberToWords(ceilTen)}*`,
      explicacion: `Definición: «${d}». Operación: ${ceilTen} − ${diff} = ${s}.`,
      dificultad: 'Medio',
    });
  }

  return pick(rand, options);
}

function makeLongFallback(emote, def, rand) {
  // For alphabetic emotes of length 11..16 without charade parts:
  // combine two clean chunks (split reversal + literal or chunked hidden/acrostic).
  const ans = normAnswer(emote.name).toLowerCase();
  const d = def.def;
  const mid = Math.floor(ans.length / 2);
  const left = ans.slice(0, mid);
  const right = ans.slice(mid);
  const revLeft = [...left].reverse().join('');
  const revRight = [...right].reverse().join('');
  if (revLeft !== left && revRight !== right) {
    return {
      tipo: 'inversion',
      pista: `_${capFirst(d)}_, ~invirtiendo cada parte de~ *«${revLeft} ${revRight}»*`,
      explicacion: `Definición: «${d}». Inversión por partes: «${revLeft}» → «${left}» y «${revRight}» → «${right}», formando ${emote.name}.`,
      dificultad: 'Difícil',
    };
  }
  const scrambled = scrambleAnswer(normAnswer(emote.name), rand);
  if (scrambled) {
    return {
      tipo: 'anagrama',
      pista: `_${capFirst(d)}_, ~reordenando~ *«${scrambled.toLowerCase()}»*`,
      explicacion: `Definición: «${d}». Anagrama: reordenando «${scrambled.toLowerCase()}» se obtiene ${emote.name}.`,
      dificultad: 'Difícil',
    };
  }
  // Pure repeated letters (e.g. AAAA, EAAAAAAAAA)
  const firstCh = ans[0].toUpperCase();
  return {
    tipo: 'repeticion',
    pista: `_${capFirst(d)}_: ~${numberToWords(ans.length)} letras~ *empezando por ${firstCh}*`,
    explicacion: `Definición: «${d}». Se forma con ${emote.name}.`,
    dificultad: 'Medio',
  };
}

function generateClue(emote, def) {
  const rand = rngFor(`clue-v1:${emote.name}`);

  if (emote.numeric) {
    return makeNumericClue(emote, def, rand);
  }

  const ans = normAnswer(emote.name);

  // Special case: repeated identical character (e.g., AAAA)
  if (new Set([...ans]).size === 1) {
    const ch = ans[0];
    return {
      tipo: 'repeticion',
      pista: `_${capFirst(def.def)}_: ~repetición de la letra~ *«${ch}»*`,
      explicacion: `Definición: «${def.def}». Repetición: la letra ${ch} escrita ${ans.length} veces da ${emote.name}.`,
      dificultad: 'Fácil',
    };
  }

  // Gather all valid candidates and pick with balanced weights so the daily feed feels rich & varied!
  const candidates = [];

  const charade = makeCharade(emote, def, rngFor(`char:${emote.name}`));
  if (charade) candidates.push([charade, 42]);

  const anagram = makeAnagram(emote, def, rngFor(`anag:${emote.name}`));
  if (anagram) candidates.push([anagram, 24]);

  const hidden = makeHidden(emote, def, rngFor(`hid:${emote.name}`));
  if (hidden) candidates.push([hidden, 16]);

  const reversal = makeReversal(emote, def, rngFor(`rev:${emote.name}`));
  if (reversal) candidates.push([reversal, 14]);

  const acrostic = makeAcrostic(emote, def, rngFor(`acr:${emote.name}`));
  if (acrostic) candidates.push([acrostic, ans.length <= 4 ? 32 : 12]);

  if (candidates.length === 0) {
    return makeLongFallback(emote, def, rand);
  }

  const totalW = candidates.reduce((s, [, w]) => s + w, 0);
  let r = rand() * totalW;
  for (const [clue, w] of candidates) {
    if ((r -= w) <= 0) return clue;
  }
  return candidates[0][0];
}

function classifyEmote(raw, uses) {
  const nameLow = raw.name.toLowerCase();
  const numeric = /^[0-9]+$/.test(raw.name);

  if (uses >= 5000) {
    return { tier: 1, categoria: 'Más usado en el chat' };
  }
  if (uses > 0) {
    return { tier: 1, categoria: 'Popular en el chat' };
  }
  if (numeric) {
    return { tier: 2, categoria: 'Emote numérico de baulo' };
  }
  if (CHANNEL_KEYWORDS.some((kw) => nameLow.includes(kw))) {
    return { tier: 2, categoria: 'Clásico del canal' };
  }
  // Very recently added Kick-era emotes (top ~120 most recent timestamps)
  if (raw.timestamp && raw.timestamp >= 1755000000000) {
    return { tier: 2, categoria: 'Reciente en Kick' };
  }
  return { tier: 3, categoria: 'Catálogo 7TV de baulo' };
}

function interleaveByTier(items) {
  // Sort Tier 1 mostly by real popularity with deterministic local shuffle in bands
  // so top emotes appear throughout the year instead of only in week 1.
  const t1 = items.filter((x) => x.tier === 1).sort((a, b) => b.uses - a.uses);
  const t2 = shuffle(rngFor('tier2-order-v1'), items.filter((x) => x.tier === 2));
  const t3 = shuffle(rngFor('tier3-order-v1'), items.filter((x) => x.tier === 3));

  // Lightly shuffle Tier 1 within bands of 12 so the hottest emotes stay prominent
  // without making consecutive days all identical styles, while keeping variety!
  const t1Mixed = [];
  for (let i = 0; i < t1.length; i += 12) {
    t1Mixed.push(...shuffle(rngFor(`t1-band-${i}`), t1.slice(i, i + 12)));
  }

  // Spread all 15 numeric emotes evenly across the first ~180 Tier 2 slots so every month has one
  const t2Nums = t2.filter((x) => x.numeric);
  const t2Words = t2.filter((x) => !x.numeric);
  const t2Blended = [];
  const numGap = Math.max(4, Math.floor(Math.min(t2Words.length, 165) / Math.max(1, t2Nums.length)));
  let ni = 0;
  for (let i = 0; i < t2Words.length; i++) {
    t2Blended.push(t2Words[i]);
    if ((i + 1) % numGap === 0 && ni < t2Nums.length) {
      t2Blended.push(t2Nums[ni++]);
    }
  }
  while (ni < t2Nums.length) t2Blended.push(t2Nums[ni++]);

  // Weekly cadence: 2 Tier 1 + 3 Tier 2 + 2 Tier 3 per 7 days
  // -> 130 Tier 1 emotes span ~455 days (well over a full year!)
  const result = [];
  let i1 = 0, i2 = 0, i3 = 0;
  const pattern = [1, 2, 2, 3, 1, 2, 3];
  let step = 0;

  while (i1 < t1Mixed.length || i2 < t2Blended.length || i3 < t3.length) {
    const want = pattern[step % pattern.length];
    step++;
    if (want === 1 && i1 < t1Mixed.length) result.push(t1Mixed[i1++]);
    else if (want === 2 && i2 < t2Blended.length) result.push(t2Blended[i2++]);
    else if (want === 3 && i3 < t3.length) result.push(t3[i3++]);
    else if (i1 < t1Mixed.length) result.push(t1Mixed[i1++]);
    else if (i2 < t2Blended.length) result.push(t2Blended[i2++]);
    else if (i3 < t3.length) result.push(t3[i3++]);
  }

  return result;
}

function main() {
  const emoteSet = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'emote-set.json'), 'utf8'));
  const defs = loadDefinitions();
  const chatStats = loadChatStats();

  const seenLower = new Set();
  const playable = [];
  const skipped = { invalid: 0, flagged: 0, length: 0, missingDef: 0, duplicate: 0 };

  for (const raw of emoteSet.emotes) {
    const name = raw.name;
    if (!VALID_NAME_RE.test(name)) {
      skipped.invalid++;
      continue;
    }
    const low = name.toLowerCase();
    if (seenLower.has(low)) {
      skipped.duplicate++;
      continue;
    }
    seenLower.add(low);

    const def = defs[name];
    if (!def) {
      skipped.missingDef++;
      continue;
    }
    if (def.flag !== 'ok') {
      skipped.flagged++;
      continue;
    }
    if (name.length < MIN_PLAYABLE_LEN || name.length > MAX_PLAYABLE_LEN) {
      skipped.length++;
      continue;
    }

    const uses = chatStats.get(low) || 0;
    const numeric = /^[0-9]+$/.test(name);
    const { tier, categoria } = classifyEmote(raw, uses);

    const emoteMeta = {
      id: raw.id,
      name,
      answer: normAnswer(name),
      numeric,
      animated: Boolean(raw.data?.animated),
      uses,
      tier,
      categoria,
    };

    const clue = generateClue(emoteMeta, def);
    playable.push({
      id: raw.id,
      nombre: name,
      respuesta: emoteMeta.answer,
      longitud: emoteMeta.answer.length,
      numerico: numeric,
      animado: emoteMeta.animated,
      pista: `${clue.pista} (${emoteMeta.answer.length})`,
      tipo: clue.tipo,
      dificultad: clue.dificultad,
      explicacion: clue.explicacion,
      descripcion: def.desc,
      tier,
      categoria,
      usos: uses,
    });
  }

  const ordered = interleaveByTier(playable);

  const output = {
    version: 1,
    epoch: '2026-01-01',
    canal: {
      nombre: 'baulo',
      plataforma: 'Kick',
      kickUrl: 'https://kick.com/baulo',
      sevenTvUserId: '01FT80E0280001E12995B11F56',
      sevenTvUrl: 'https://7tv.app/users/01FT80E0280001E12995B11F56',
      emoteSetName: emoteSet.name || "baulo's Emotes",
    },
    generadoEn: new Date().toISOString().slice(0, 10),
    total: ordered.length,
    puzzles: ordered,
  };

  fs.mkdirSync(path.join(ROOT, 'public'), { recursive: true });
  const outPath = path.join(ROOT, 'public', 'puzzles.json');
  fs.writeFileSync(outPath, JSON.stringify(output));

  // Print summary stats
  const byType = {};
  const byTier = {};
  const byDiff = {};
  for (const p of ordered) {
    byType[p.tipo] = (byType[p.tipo] || 0) + 1;
    byTier[p.tier] = (byTier[p.tier] || 0) + 1;
    byDiff[p.dificultad] = (byDiff[p.dificultad] || 0) + 1;
  }
  console.log(`Built ${ordered.length} puzzles -> public/puzzles.json (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
  console.log('Skipped:', skipped);
  console.log('By type:', byType);
  console.log('By tier:', byTier);
  console.log('By difficulty:', byDiff);
}

main();
