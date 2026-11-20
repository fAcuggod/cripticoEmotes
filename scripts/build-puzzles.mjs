#!/usr/bin/env node
/**
 * Builds public/puzzles.json using ONLY high-usage and actively recognized
 * 7TV emotes from baulo's Kick/Twitch channel:
 *  - Tier 1 (Top most-used, >5% relative to #1 in StreamElements chatstats):
 *    harder hand-crafted context-driven clues from data/curated-clues.json
 *  - All 15 numeric emotes (11..99):
 *    high-school level logic & math riddles from data/curated-clues.json
 *  - All short emotes (<= 5 chars) in the active roster:
 *    harder hand-crafted context-driven clues from data/curated-clues.json
 *  - Remaining active high-usage (>=15k SE uses) & Kick-era baulo staples:
 *    accessible context-aware cryptic clues
 *  - Low-usage / obscure emotes from the 975-emote set are strictly excluded.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rngFor, pick, shuffle } from './lib/rng.mjs';
import { WORDS_BY_LETTER, FILLER } from './lib/words.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const VALID_NAME_RE = /^[A-Za-zÑñ]+$|^[0-9]+$/;
const MAX_PLAYABLE_LEN = 16;
const MIN_SE_USES = 15000; // Excludes low-usage tail (<15k uses out of 32.1M msgs)

// Explicitly exclude niche/tiny emotes even if historical SE count was high
const EXCLUDED_OBSCURE = new Set(['pL', 'ppOverheat', 'pepeAgony']);

// Actively used Kick-era & baulo-signature emotes (not tracked by Twitch-era SE stats)
const KICK_ACTIVE_STAPLES = new Set([
  'BauloVibe', 'BauloSit', 'baulodance', 'bauloCrashOut', 'bauloTilt', 'bauloWar',
  'GIGABAULO', 'GOBAULOGO', 'bautiquit', 'bautrollface', 'bauloywalter', 'bDANCE',
  'bKEK', 'bSAD', 'coco', 'kenny', 'walti', 'barto', 'voidbarto', 'bartoB',
  'CINE', 'COOKING', 'PEAK', 'TWEAK', 'BANGER', 'VOID', 'Voidge', 'Cooked',
  'ragebait', 'SLAY', 'JARVIS', 'BELLINGHAM', 'FULBO', 'ANDAPAYABOBO', 'TENGOUNPLAN',
  'davoDance', 'cobrixDance', 'cobraCrashOut', 'davojam', 'momoClap', 'dans', 'dansi',
  'xdding', 'Potge', 'emociona', 'SIU', 'CALMA', 'FINALLY', 'KEK', 'BRAINROT',
  'AINTNOWAY', 'CAUGHT', 'YAPPING', 'Postura', 'ionovoyadecirlo', 'iotelodije',
  'iatelodije', 'nomelocreo', 'muelto', 'sentao', 'amimir', 'Saltito', 'AMARILLA',
  'ROJA', 'LIBERTAD', 'Washed', 'Chilling', 'Panic', 'DeadChat', 'TICTAC', 'FOCUS',
  'Firmo', 'NOESTOYACABADO', 'MEQUEDODORMIDO', 'WhoAsked', 'LOL', 'PAIN', 'PLEASE',
  'monkaOMEGA', 'Aware', 'Clueless', 'COPIUM', 'GoodMorning', 'GoodNight', 'Offline',
  'Life', 'Death', 'Weirdge', 'catKISS', 'FeelsCringeMan', 'FeelsBadMan', 'PagMan',
  'popCat', 'Smoge',
]);

// Context-rich chat-usage definitions for longer active emotes (replaces purely literal descriptions)
const USAGE_CONTEXT_DEFS = {
  modCheck: 'cuando nadie responde o falta alguien en el chat',
  StockExplosion: 'remate explosivo tras un golpe o fallo épico',
  nyanPls: 'festejo anime cuando suena música alegre',
  Stronge: 'aguante estoico del chat pese al sufrimiento',
  Pepega: 'reacción clásica ante un despiste o error tonto',
  xqcCheer: 'aliento frenético del chat en momentos de hype',
  ZIDANE: 'incredulidad absoluta ante una jugada o fallo épico',
  LETSGO: 'euforia máxima para celebrar una gran victoria',
  SadChamp: 'decepción silenciosa cuando algo sale mal',
  SoConcerned: 'preocupación seria cuando algo da muy mala espina',
  Drained: 'agotamiento total sin energía en el chat',
  peepoArgentina: 'orgullo albiceleste de la comunidad en el chat',
  HulkPls: 'baile desenfrenado cuando sube el ritmo musical',
  BASEDCIGAR: 'aprobación elegante a una opinión sin rodeos',
  Chadge: 'confianza aplastante tras una respuesta magistral',
  turrosPls: 'baile de barrio cuando suena cumbia en directo',
  ESKIZO: 'reacción cuando alguien dice algo totalmente desquiciado',
  peepoFlower: 'detalle cariñoso del chat para el streamer',
  BRUHMM: 'incredulidad muda ante un comentario absurdo',
  imNOTcrying: 'disimular la emoción en un momento conmovedor',
  VEGETA: 'derrota dramática y melancólica bajo la lluvia',
  PagChomp: 'asombro clásico del chat ante algo increíble',
  PauseChamp: 'suspenso del chat esperando un gran anuncio',
  Okayge: 'conformidad serena y buena onda en el chat',
  AlienPls: 'baile espacial clásico cuando suena un temazo',
  GIGACHAD: 'respeto absoluto ante una actitud imponente',
  lebronJAM: 'disfrutar un temazo moviendo la cabeza al ritmo',
  WAITING: 'espera eterna cuando el directo o algo tarda',
  NoThanks: 'rechazo cortés pero tajante en el chat',
  widepeepoHappy: 'alegría desbordante y tierna de todo el chat',
  Jamgie: 'cabeceo relajado para acompañar cualquier canción',
  BLEHHHH: 'gesto travieso y burlón del chat',
  dinkDonk: 'llamado insistente para captar atención en el chat',
  GIGAWOMAN: 'admiración absoluta hacia una actitud imponente femenina',
  MateTime: 'pausa rioplatense para cebar durante el directo',
  monkaW: 'tensión al máximo cuando algo se vuelve peligroso',
  widepeepoSad: 'tristeza exagerada y desconsolada del chat',
  PetTheCoco: 'cariño masivo para la mascota dorada del canal',
  peepoNashe: 'aprobación clásica de la comunidad hispana',
  ElNoSabe: 'risa cómplice cuando alguien ignora una sorpresa',
  FeelsBadMan: 'lamento clásico del chat ante la mala suerte',
  PagMan: 'celebración eufórica ante un logro enorme',
  popCat: 'ritmo veloz o sorpresa divertida en el chat',
  monkaOMEGA: 'pánico absoluto cuando la situación se desborda',
  Clueless: 'ingenuidad total antes de que ocurra el desastre',
  COPIUM: 'autoengaño cómico del chat para no perder la fe',
  GoodMorning: 'saludo matutino al empezar temprano el directo',
  GoodNight: 'despedida cariñosa al cierre nocturno del stream',
  Offline: 'cuando la transmisión termina y apagan cámara',
  Weirdge: 'incomodidad cuando alguien suelta algo raro',
  catKISS: 'gesto cariñoso del chat mandando afecto',
  FeelsCringeMan: 'vergüenza ajena colectiva ante una escena incómoda',
  BauloVibe: 'baile propio del streamer cuando suena buena música',
  BauloSit: 'espera relajada en versión tierna del canal',
  baulodance: 'festejo bailable al aire libre propio del canal',
  bauloCrashOut: 'cuando el streamer pierde la paciencia por completo',
  bauloTilt: 'frustración notoria del streamer en plena partida',
  bauloWar: 'mirada perdida del streamer tras un momento duro',
  GIGABAULO: 'versión triunfal e imponente del dueño del canal',
  GOBAULOGO: 'grito de aliento colectivo para impulsar al streamer',
  bautiquit: 'broma de cerrar el stream cuando dice algo polémico',
  bautrollface: 'carcajada traviesa propia del dueño del canal',
  bauloywalter: 'dupla querida del streamer junto a su gato',
  bDANCE: 'festejo bailable en habitación con luces del canal',
  voidbarto: 'versión sombría del meme amarillo ante algo turbio',
  bartoB: 'fusión humorística del meme amarillo con el streamer',
  COOKING: 'cuando alguien prepara una jugada o idea magistral',
  BANGER: 'reacción unánime cuando suena una canción épica',
  Voidge: 'ambiente sombrío ante una anécdota perturbadora',
  Cooked: 'resignación total cuando alguien ya está acabado',
  ragebait: 'señalar una provocación hecha solo para hacer enojar',
  JARVIS: 'pedir ayuda exagerada en broma como un superhéroe',
  BELLINGHAM: 'festejo triunfal abriendo brazos en la cancha',
  ANDAPAYABOBO: 'frase mundialista para mandar lejos a alguien molesto',
  TENGOUNPLAN: 'cuando el chat o streamer trama una estrategia',
  davoDance: 'baile festivo de un creador futbolero amigo',
  cobrixDance: 'festejo bailable sentado de un streamer argentino',
  cobraCrashOut: 'estallido de bronca desde el sofá ante una derrota',
  davojam: 'ritmo musical alegre de un creador futbolero',
  momoClap: 'aplauso solemne e irónico con traje de gala',
  xdding: 'risa maliciosa y pícara de roedor en el chat',
  emociona: 'conmoción total hasta las lágrimas por algo épico',
  FINALLY: 'alivio eufórico cuando por fin ocurre lo esperado',
  BRAINROT: 'humor absurdo y saturado de memes virales',
  AINTNOWAY: 'incredulidad absoluta ante algo imposible de creer',
  CAUGHT: 'cuando atrapan a alguien en plena mentira o falta',
  YAPPING: 'burla cuando alguien habla sin parar demasiado rato',
  Postura: 'recordatorio del chat para enderezar la espalda',
  ionovoyadecirlo: 'sonrisa pícara callando un comentario comprometedor',
  iotelodije: 'triunfo del chat cuando acierta una predicción',
  iatelodije: 'orgullo del streamer tras demostrar que tenía razón',
  nomelocreo: 'asombro increíble de tribuna ante lo impensado',
  muelto: 'agotamiento completo tras perder o quedarse sin fuerzas',
  sentao: 'espera paciente y tranquila viendo el directo',
  amimir: 'despedida tierna cuando toca irse a descansar',
  Saltito: 'entusiasmo inocente brincando de alegría en el chat',
  AMARILLA: 'primera advertencia arbitral en broma en el chat',
  LIBERTAD: 'alivio glorioso cuando termina una espera o castigo',
  Washed: 'broma cuando alguien perdió su antiguo gran nivel',
  Chilling: 'relajación absoluta disfrutando tranquilo el directo',
  DeadChat: 'burla cuando nadie escribe nada durante un silencio',
  TICTAC: 'aviso tenso de que corre el tiempo hacia algo grande',
  NOESTOYACABADO: 'demostrar vigencia tras una gran jugada de regreso',
  MEQUEDODORMIDO: 'broma exagerada cuando un juego o charla aburre',
  WhoAsked: 'respuesta irónica cuando nadie pidió esa opinión',
  PLEASE: 'súplica desesperada del chat para que algo ocurra',
};

function stripAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normAnswer(str) {
  return str
    .replace(/ñ/g, '__ENYE__')
    .replace(/Ñ/g, '__ENYE__')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/__ENYE__/g, 'Ñ');
}

function capFirst(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
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

function loadCuratedClues() {
  const file = path.join(ROOT, 'data', 'curated-clues.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
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

function hasDefLeak(name, defText) {
  const nn = normAnswer(name);
  const nd = normAnswer(defText);
  if (nn.length >= 4) {
    for (let i = 0; i <= nn.length - 4; i++) {
      if (nd.includes(nn.slice(i, i + 4))) return true;
    }
  }
  return false;
}

// --- Auto clue generators for medium-frequency longer emotes (>= 6 chars) ---

function makeCharade(emote, defText, partes, rand) {
  if (!Array.isArray(partes) || partes.length < 2 || partes.length > 3) return null;
  if (partes.map(([c]) => c).join('') !== emote.name) return null;

  const defWords = new Set(
    stripAccents(defText).toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 6 && w !== 'ranita' && w !== 'streamer')
  );
  for (const [, clue] of partes) {
    const clueWords = stripAccents(clue).toLowerCase().split(/[^a-z]+/);
    if (clueWords.some((w) => defWords.has(w))) return null;
  }

  const clues = partes.map(([, clue]) => `*${clue}*`);
  const listStr = clues.length === 2
    ? `${clues[0]} y ${clues[1]}`
    : `${clues[0]}, ${clues[1]} y ${clues[2]}`;

  const templates = [
    () => `_${capFirst(defText)}_, ~al juntar~ ${listStr}`,
    () => `~Uniendo~ ${listStr} ~se forma~ _${defText}_`,
    () => `_${capFirst(defText)}_ ~sumando~ ${listStr}`,
  ];
  const pista = pick(rand, templates)();
  const breakdown = partes.map(([c, cl]) => `«${c}» (${cl})`).join(' + ');
  const explicacion = `Contexto de uso: «${defText}». Charada: al unir ${breakdown} se obtiene ${emote.name}.`;
  return { tipo: 'charada', pista, explicacion, dificultad: partes.length === 2 ? 'Fácil' : 'Medio' };
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
    for (let i = 0; i < chars.length; i++) if (sh[i] !== chars[i]) diff++;
    if (diff > bestDiff) { bestDiff = diff; best = sh; }
    if (diff >= Math.ceil(chars.length * 0.7)) break;
  }
  return best;
}

function makeAnagram(emote, defText, rand) {
  const ans = normAnswer(emote.name);
  if (ans.length < 6 || ans.length > 11) return null;
  const scrambled = scrambleAnswer(ans, rand);
  if (!scrambled) return null;
  const fodder = `«${scrambled.toLowerCase()}»`;
  const templates = [
    () => `_${capFirst(defText)}_, ~revolviendo~ *${fodder}*`,
    () => `~Desordenando~ *${fodder}* ~surge~ _${defText}_`,
    () => `_${capFirst(defText)}_, ~anagrama de~ *${fodder}*`,
  ];
  return {
    tipo: 'anagrama',
    pista: pick(rand, templates)(),
    explicacion: `Contexto de uso: «${defText}». Anagrama: reordenando las letras de «${scrambled.toLowerCase()}» sale ${emote.name}.`,
    dificultad: ans.length <= 8 ? 'Fácil' : 'Medio',
  };
}

function makeReversal(emote, defText, rand) {
  const ans = normAnswer(emote.name);
  if (ans.length < 6 || ans.length > 10) return null;
  const rev = [...ans].reverse().join('');
  if (rev === ans) return null;
  const fodder = `«${rev.toLowerCase()}»`;
  const templates = [
    () => `_${capFirst(defText)}_, ~leído al revés en~ *${fodder}*`,
    () => `~Invirtiendo~ *${fodder}* ~aparece~ _${defText}_`,
  ];
  return {
    tipo: 'inversion',
    pista: pick(rand, templates)(),
    explicacion: `Contexto de uso: «${defText}». Inversión: leyendo «${rev.toLowerCase()}» de derecha a izquierda se obtiene ${emote.name}.`,
    dificultad: ans.length <= 7 ? 'Fácil' : 'Medio',
  };
}

function makeHidden(emote, defText, rand) {
  const ans = normAnswer(emote.name).toLowerCase();
  if (ans.length < 6 || ans.length > 10) return null;
  const pre = pick(rand, FILLER).slice(0, 2 + Math.floor(rand() * 2));
  const suf = pick(rand, FILLER).slice(0, 2 + Math.floor(rand() * 2));
  const cut1 = 2 + Math.floor(rand() * Math.max(1, Math.floor(ans.length / 2) - 1));
  const cut2 = cut1 + 2 + Math.floor(rand() * Math.max(1, ans.length - cut1 - 3));
  const seq = cut2 < ans.length - 1
    ? `${pre}${ans.slice(0, cut1)} ${ans.slice(cut1, cut2)} ${ans.slice(cut2)}${suf}`
    : `${pre}${ans.slice(0, cut1)} ${ans.slice(cut1)}${suf}`;
  if (seq.split(' ').some((w) => w === ans)) return null;
  const fodder = `«${seq}»`;
  return {
    tipo: 'oculta',
    pista: `_${capFirst(defText)}_, ~oculto dentro de~ *${fodder}*`,
    explicacion: `Contexto de uso: «${defText}». Palabra oculta: leyendo seguido dentro de «${seq}» aparece ${emote.name}.`,
    dificultad: 'Medio',
  };
}

function makeAcrostic(emote, defText, rand) {
  const ans = normAnswer(emote.name).toLowerCase();
  if (ans.length < 6 || ans.length > 9) return null;
  const used = new Set();
  const words = [];
  for (const ch of ans) {
    const pool = WORDS_BY_LETTER[ch];
    if (!pool || !pool.length) return null;
    const cands = pool.filter((w) => !used.has(w) && stripAccents(w).toLowerCase() !== ans);
    const chosen = pick(rand, cands.length ? cands : pool);
    used.add(chosen);
    words.push(chosen);
  }
  const fodder = `«${words.join(', ')}»`;
  return {
    tipo: 'iniciales',
    pista: `_${capFirst(defText)}_ ~en las iniciales de~ *${fodder}*`,
    explicacion: `Contexto de uso: «${defText}». Iniciales de «${words.join(', ')}» forman ${emote.name}.`,
    dificultad: 'Medio',
  };
}

function makeLongFallback(emote, defText, rand) {
  const ans = normAnswer(emote.name).toLowerCase();
  const mid = Math.floor(ans.length / 2);
  const left = ans.slice(0, mid);
  const right = ans.slice(mid);
  const revLeft = [...left].reverse().join('');
  const revRight = [...right].reverse().join('');
  if (revLeft !== left && revRight !== right) {
    return {
      tipo: 'inversion',
      pista: `_${capFirst(defText)}_, ~invirtiendo cada bloque de~ *«${revLeft} ${revRight}»*`,
      explicacion: `Contexto de uso: «${defText}». Invirtiendo «${revLeft}» → «${left}» y «${revRight}» → «${right}» se forma ${emote.name}.`,
      dificultad: 'Medio',
    };
  }
  const scrambled = scrambleAnswer(normAnswer(emote.name), rand);
  return {
    tipo: 'anagrama',
    pista: `_${capFirst(defText)}_, ~reordenando~ *«${scrambled.toLowerCase()}»*`,
    explicacion: `Contexto de uso: «${defText}». Anagrama de «${scrambled.toLowerCase()}» → ${emote.name}.`,
    dificultad: 'Medio',
  };
}

function generateAccessibleClue(emote, def) {
  const rand = rngFor(`clue-v2:${emote.name}`);
  // Prefer chat-usage context definition if available and leak-free
  const customCtx = USAGE_CONTEXT_DEFS[emote.name];
  const defText = customCtx && !hasDefLeak(emote.name, customCtx) ? customCtx : def.def;

  const candidates = [];
  const charade = makeCharade(emote, defText, def.partes, rngFor(`char2:${emote.name}`));
  if (charade) candidates.push([charade, 48]);
  const anagram = makeAnagram(emote, defText, rngFor(`anag2:${emote.name}`));
  if (anagram) candidates.push([anagram, 20]);
  const hidden = makeHidden(emote, defText, rngFor(`hid2:${emote.name}`));
  if (hidden) candidates.push([hidden, 16]);
  const reversal = makeReversal(emote, defText, rngFor(`rev2:${emote.name}`));
  if (reversal) candidates.push([reversal, 16]);
  const acrostic = makeAcrostic(emote, defText, rngFor(`acr2:${emote.name}`));
  if (acrostic) candidates.push([acrostic, 10]);

  if (!candidates.length) return makeLongFallback(emote, defText, rand);
  const totalW = candidates.reduce((s, [, w]) => s + w, 0);
  let r = rand() * totalW;
  for (const [clue, w] of candidates) {
    if ((r -= w) <= 0) return clue;
  }
  return candidates[0][0];
}

function interleaveSchedule(items) {
  // Interleave Top most-used (>5% max), numeric logic challenges, active SE, and Kick staples
  // so every single week has a balanced mix of hard staples, logic math riddles, and accessible favorites!
  const top = shuffle(rngFor('sched-top-v2'), items.filter((x) => x.muyUsado));
  const nums = shuffle(rngFor('sched-num-v2'), items.filter((x) => x.numerico));
  const rest = shuffle(rngFor('sched-rest-v2'), items.filter((x) => !x.muyUsado && !x.numerico));

  // Blend numeric emotes roughly every ~14 days across the entire ~220-day cycle
  const result = [];
  let it = 0, inum = 0, ir = 0;
  // Pattern over 14 days: 3 top-used (hard), 1 numeric logic riddle, 10 active SE/Kick staples
  const pattern = ['R', 'T', 'R', 'R', 'T', 'R', 'N', 'R', 'R', 'T', 'R', 'R', 'R', 'R'];
  let step = 0;

  while (it < top.length || inum < nums.length || ir < rest.length) {
    const slot = pattern[step % pattern.length];
    step++;
    if (slot === 'T' && it < top.length) result.push(top[it++]);
    else if (slot === 'N' && inum < nums.length) result.push(nums[inum++]);
    else if (slot === 'R' && ir < rest.length) result.push(rest[ir++]);
    else if (it < top.length) result.push(top[it++]);
    else if (inum < nums.length) result.push(nums[inum++]);
    else if (ir < rest.length) result.push(rest[ir++]);
  }
  return result;
}

function main() {
  const emoteSet = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'emote-set.json'), 'utf8'));
  const defs = loadDefinitions();
  const curated = loadCuratedClues();
  const chatStats = loadChatStats();

  // Compute max uses among valid non-flagged emotes to calculate exact relative usage %
  let maxUses = 1;
  for (const raw of emoteSet.emotes) {
    const def = defs[raw.name];
    if (!def || def.flag !== 'ok') continue;
    const u = chatStats.get(raw.name.toLowerCase()) || 0;
    if (u > maxUses) maxUses = u;
  }

  const seenLower = new Set();
  const playable = [];
  const skipped = { invalid: 0, flagged: 0, length: 0, lowUsage: 0, duplicate: 0 };

  for (const raw of emoteSet.emotes) {
    const name = raw.name;
    if (!VALID_NAME_RE.test(name)) { skipped.invalid++; continue; }
    const low = name.toLowerCase();
    if (seenLower.has(low)) { skipped.duplicate++; continue; }
    seenLower.add(low);

    const def = defs[name];
    if (!def || def.flag !== 'ok') { skipped.flagged++; continue; }
    if (name.length < 2 || name.length > MAX_PLAYABLE_LEN) { skipped.length++; continue; }
    if (EXCLUDED_OBSCURE.has(name)) { skipped.lowUsage++; continue; }

    const uses = chatStats.get(low) || 0;
    const relPct = Math.round((uses / maxUses) * 1000) / 10; // e.g., 51.0% relative to #1
    const numeric = /^[0-9]+$/.test(name);
    const isTopUsed = relPct > 5.0; // Strictly > 5% relative usage!
    const isActiveSE = uses >= MIN_SE_USES;
    const isKickStaple = KICK_ACTIVE_STAPLES.has(name);

    // Strictly exclude low-usage / barely-used emotes!
    if (!isTopUsed && !isActiveSE && !numeric && !isKickStaple) {
      skipped.lowUsage++;
      continue;
    }

    const answer = normAnswer(name);
    const isShort = !numeric && answer.length <= 5;
    const emoteMeta = {
      id: raw.id,
      name,
      answer,
      numeric,
      animated: Boolean(raw.data?.animated),
      uses,
      relPct,
    };

    let clue;
    let curada = false;
    if (curated[name]) {
      clue = curated[name];
      curada = true;
    } else {
      clue = generateAccessibleClue(emoteMeta, def);
    }

    let tier = 2;
    let categoria = 'Activo en Kick';
    if (isTopUsed) {
      tier = 1;
      categoria = 'Muy usado · Reto difícil';
    } else if (numeric) {
      tier = 2;
      categoria = 'Reto lógico · Emote numérico';
    } else if (isShort) {
      tier = 2;
      categoria = isActiveSE ? 'Nombre corto · Reto difícil' : 'Kick corto · Reto difícil';
    } else if (isActiveSE) {
      tier = 2;
      categoria = 'Habitual en el chat';
    }

    playable.push({
      id: raw.id,
      nombre: name,
      respuesta: answer,
      longitud: answer.length,
      numerico: numeric,
      animado: emoteMeta.animated,
      muyUsado: isTopUsed,
      corto: isShort,
      curada,
      pista: `${clue.pista} (${answer.length})`,
      tipo: clue.tipo,
      dificultad: clue.dificultad,
      explicacion: clue.explicacion,
      descripcion: def.desc,
      tier,
      categoria,
      usos: uses,
      usoRelPct: relPct,
    });
  }

  const ordered = interleaveSchedule(playable);

  const output = {
    version: 2,
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

  const byType = {}, byDiff = {};
  let curatedCount = 0, topCount = 0, numCount = 0;
  for (const p of ordered) {
    byType[p.tipo] = (byType[p.tipo] || 0) + 1;
    byDiff[p.dificultad] = (byDiff[p.dificultad] || 0) + 1;
    if (p.curada) curatedCount++;
    if (p.muyUsado) topCount++;
    if (p.numerico) numCount++;
  }
  console.log(`Built ${ordered.length} active puzzles (${curatedCount} hand-crafted, ${topCount} top-used >5%, ${numCount} numeric) -> public/puzzles.json (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
  console.log('Skipped:', skipped);
  console.log('By type:', byType);
  console.log('By difficulty:', byDiff);
}

main();
