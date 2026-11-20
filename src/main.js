import './styles/main.css';
import {
  getTodayKey,
  addDays,
  daysBetween,
  formatLongDate,
  formatShortTab,
  formatMonthYear,
  parseDateKey,
  msUntilNextLocalDay,
  formatCountdown,
} from './lib/dates.js';
import {
  HINT_TYPES,
  escapeHtml,
  renderClueHtml,
  stripClueMarkup,
  normalizeGuessChar,
  getEmoteImageUrl,
} from './lib/clue.js';
import {
  loadStore,
  saveStore,
  getDayRecord,
  computeScore,
  computeStats,
} from './lib/storage.js';
import { ICONS } from './lib/icons.js';

const MAX_ATTEMPTS = 5;
const QWERTY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];
const NUM_ROWS = [
  ['1', '2', '3', '4', '5'],
  ['ENTER', '6', '7', '8', '9', '0', 'BACK'],
];

const state = {
  data: null,
  store: loadStore(),
  todayKey: getTodayKey(),
  activeDateKey: getTodayKey(),
  inputChars: [],
  cursor: 0,
  feedback: null, // { text, isErr }
  shaking: false,
  flashingWrong: false,
  activeModal: null,
  archiveView: 'cal',
  archiveYear: new Date().getFullYear(),
  archiveMonth: new Date().getMonth(),
  archiveFilter: 'todos',
  archiveQuery: '',
  countdownTimer: null,
  toastTimer: null,
};

// -------------------- Puzzle resolution --------------------

function getPuzzleForDate(dateKey) {
  const { puzzles, epoch } = state.data;
  const total = puzzles.length;
  const diff = daysBetween(epoch, dateKey);
  const idx = ((diff % total) + total) % total;
  const number = diff >= 0 ? diff + 1 : total + (diff % total) + 1;
  return {
    puzzle: puzzles[idx],
    number,
    dateKey,
  };
}

function maxLetterReveals(puzzle) {
  return Math.min(3, Math.max(1, puzzle.longitud - 1));
}

function getCurrentRecord() {
  return getDayRecord(state.store, state.activeDateKey);
}

function persistRecord(record) {
  state.store.days[state.activeDateKey] = record;
  saveStore(state.store);
}

// -------------------- Input cursor helpers --------------------

function initInputForActiveDay() {
  const { puzzle } = getPuzzleForDate(state.activeDateKey);
  const rec = getCurrentRecord();
  const len = puzzle.longitud;

  if (rec.status === 'won' || rec.status === 'lost') {
    state.inputChars = [...puzzle.respuesta];
    state.cursor = -1;
  } else {
    state.inputChars = Array(len).fill('');
    for (const idx of rec.revealedIndices) {
      if (idx >= 0 && idx < len) state.inputChars[idx] = puzzle.respuesta[idx];
    }
    state.cursor = findFirstEditableIndex(state.inputChars, rec.revealedIndices, true);
  }
  state.feedback = null;
  state.shaking = false;
  state.flashingWrong = false;
}

function findFirstEditableIndex(chars, locked, preferEmpty = true) {
  const lockedSet = new Set(locked);
  if (preferEmpty) {
    for (let i = 0; i < chars.length; i++) {
      if (!lockedSet.has(i) && !chars[i]) return i;
    }
  }
  for (let i = 0; i < chars.length; i++) {
    if (!lockedSet.has(i)) return i;
  }
  return -1;
}

function nextEditableIndex(from, chars, locked) {
  const lockedSet = new Set(locked);
  // First try empty unlocked box after `from`
  for (let i = from + 1; i < chars.length; i++) {
    if (!lockedSet.has(i) && !chars[i]) return i;
  }
  // Then any empty unlocked box from the start
  for (let i = 0; i < from; i++) {
    if (!lockedSet.has(i) && !chars[i]) return i;
  }
  // Otherwise stay at next unlocked box or `from`
  for (let i = from + 1; i < chars.length; i++) {
    if (!lockedSet.has(i)) return i;
  }
  return from;
}

function prevEditableIndex(from, len, locked) {
  const lockedSet = new Set(locked);
  for (let i = from - 1; i >= 0; i--) {
    if (!lockedSet.has(i)) return i;
  }
  return from;
}

// -------------------- Toast & Modals --------------------

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function openModal(name) {
  closeAllModals(false);
  state.activeModal = name;
  const overlay = document.getElementById(`${name}-overlay`);
  if (!overlay) return;
  if (name === 'archivo') renderArchiveModal();
  if (name === 'stats') renderStatsModal();
  overlay.classList.add('open');
  updateSidebarNavActive();
}

function closeAllModals(updateNav = true) {
  for (const name of ['howto', 'archivo', 'stats']) {
    const el = document.getElementById(`${name}-overlay`);
    if (el) el.classList.remove('open');
  }
  state.activeModal = null;
  if (updateNav) updateSidebarNavActive();
}

function updateSidebarNavActive() {
  const map = { archivo: 'archive', stats: 'stats', howto: 'howto' };
  const target = state.activeModal ? map[state.activeModal] : 'play';
  document.querySelectorAll('.sb-nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.nav === target);
  });
}

// -------------------- Core Actions --------------------

function handleCharInput(rawChar) {
  const rec = getCurrentRecord();
  if (rec.status !== 'playing' || state.flashingWrong) return;

  const { puzzle } = getPuzzleForDate(state.activeDateKey);
  const ch = normalizeGuessChar(rawChar);
  if (!ch) return;

  if (puzzle.numerico && !/^[0-9]$/.test(ch)) {
    state.feedback = { text: 'Este emote es numérico: introduce cifras del 0 al 9.', isErr: false };
    renderGame();
    return;
  }
  if (!puzzle.numerico && /^[0-9]$/.test(ch)) {
    return;
  }

  const locked = rec.revealedIndices;
  const lockedSet = new Set(locked);
  let pos = state.cursor;
  if (pos < 0 || pos >= puzzle.longitud || lockedSet.has(pos)) {
    pos = findFirstEditableIndex(state.inputChars, locked, true);
  }
  if (pos < 0) return;

  state.inputChars[pos] = ch;
  state.cursor = nextEditableIndex(pos, state.inputChars, locked);
  state.feedback = null;
  renderGame();
}

function handleBackspace() {
  const rec = getCurrentRecord();
  if (rec.status !== 'playing' || state.flashingWrong) return;

  const { puzzle } = getPuzzleForDate(state.activeDateKey);
  const locked = rec.revealedIndices;
  const lockedSet = new Set(locked);

  if (state.cursor >= 0 && !lockedSet.has(state.cursor) && state.inputChars[state.cursor]) {
    state.inputChars[state.cursor] = '';
  } else {
    const prev = prevEditableIndex(state.cursor, puzzle.longitud, locked);
    if (!lockedSet.has(prev)) {
      state.inputChars[prev] = '';
      state.cursor = prev;
    }
  }
  state.feedback = null;
  renderGame();
}

function handleArrow(dir) {
  const rec = getCurrentRecord();
  if (rec.status !== 'playing') return;
  const { puzzle } = getPuzzleForDate(state.activeDateKey);
  const lockedSet = new Set(rec.revealedIndices);
  let idx = state.cursor + dir;
  while (idx >= 0 && idx < puzzle.longitud) {
    if (!lockedSet.has(idx)) {
      state.cursor = idx;
      renderGame();
      return;
    }
    idx += dir;
  }
}

function handleSubmit() {
  const rec = getCurrentRecord();
  if (rec.status !== 'playing' || state.flashingWrong) return;

  const { puzzle } = getPuzzleForDate(state.activeDateKey);
  const guess = state.inputChars.join('');

  if (state.inputChars.some((c) => !c)) {
    state.shaking = true;
    state.feedback = {
      text: puzzle.numerico
        ? 'Completa todas las cifras antes de comprobar.'
        : 'Completa todas las letras antes de comprobar.',
      isErr: true,
    };
    renderGame();
    setTimeout(() => {
      state.shaking = false;
      renderGame();
    }, 420);
    return;
  }

  if (rec.guesses.includes(guess)) {
    state.shaking = true;
    state.feedback = { text: `Ya probaste «${guess}». Intenta con otro emote.`, isErr: true };
    renderGame();
    setTimeout(() => {
      state.shaking = false;
      renderGame();
    }, 420);
    return;
  }

  rec.guesses.push(guess);
  rec.emoteId = puzzle.id;
  rec.nombre = puzzle.nombre;

  if (guess === puzzle.respuesta) {
    rec.status = 'won';
    rec.score = computeScore(rec);
    // Automatically show all clue markup highlights on completion so player can inspect the breakdown
    rec.visibleHints = ['definicion', 'indicador', 'material'];
    persistRecord(rec);
    state.cursor = -1;
    state.feedback = null;
    renderAll();
    return;
  }

  // Wrong attempt
  if (rec.guesses.length >= MAX_ATTEMPTS) {
    rec.status = 'lost';
    rec.score = 0;
    rec.visibleHints = ['definicion', 'indicador', 'material'];
    persistRecord(rec);
    state.inputChars = [...puzzle.respuesta];
    state.cursor = -1;
    state.feedback = null;
    renderAll();
    return;
  }

  persistRecord(rec);
  const left = MAX_ATTEMPTS - rec.guesses.length;
  state.shaking = true;
  state.flashingWrong = true;
  state.feedback = {
    text: left === 1 ? 'No es ese emote. ¡Último intento!' : `No es ese emote. Te quedan ${left} intentos.`,
    isErr: true,
  };
  renderAll();

  setTimeout(() => {
    state.shaking = false;
    state.flashingWrong = false;
    const lockedSet = new Set(rec.revealedIndices);
    state.inputChars = state.inputChars.map((c, i) => (lockedSet.has(i) ? puzzle.respuesta[i] : ''));
    state.cursor = findFirstEditableIndex(state.inputChars, rec.revealedIndices, true);
    renderGame();
  }, 460);
}

function handleToggleHint(tipo) {
  const rec = getCurrentRecord();
  if (!rec.revealedHints.includes(tipo)) {
    rec.revealedHints.push(tipo);
    if (!rec.visibleHints.includes(tipo)) rec.visibleHints.push(tipo);
  } else {
    const idx = rec.visibleHints.indexOf(tipo);
    if (idx >= 0) rec.visibleHints.splice(idx, 1);
    else rec.visibleHints.push(tipo);
  }
  persistRecord(rec);
  renderGame();
}

function handleRevealLetter() {
  const rec = getCurrentRecord();
  if (rec.status !== 'playing') return;

  const { puzzle } = getPuzzleForDate(state.activeDateKey);
  const limit = maxLetterReveals(puzzle);
  if (rec.revealedIndices.length >= limit) return;

  const lockedSet = new Set(rec.revealedIndices);
  let target = -1;

  // Prefer active cursor if unlocked and not already the right char
  if (
    state.cursor >= 0 &&
    !lockedSet.has(state.cursor) &&
    state.inputChars[state.cursor] !== puzzle.respuesta[state.cursor]
  ) {
    target = state.cursor;
  }
  // Else first unlocked position whose char is empty or wrong
  if (target < 0) {
    for (let i = 0; i < puzzle.longitud; i++) {
      if (!lockedSet.has(i) && state.inputChars[i] !== puzzle.respuesta[i]) {
        target = i;
        break;
      }
    }
  }
  // Else first unlocked position
  if (target < 0) {
    for (let i = 0; i < puzzle.longitud; i++) {
      if (!lockedSet.has(i)) {
        target = i;
        break;
      }
    }
  }
  if (target < 0) return;

  rec.revealedIndices.push(target);
  persistRecord(rec);
  state.inputChars[target] = puzzle.respuesta[target];
  state.cursor = nextEditableIndex(target, state.inputChars, rec.revealedIndices);
  state.feedback = {
    text: puzzle.numerico
      ? `Cifra revelada en la posición ${target + 1}.`
      : `Letra revelada en la posición ${target + 1}.`,
    isErr: false,
  };
  renderGame();
}

function selectDate(dateKey) {
  if (dateKey > state.todayKey) return;
  if (dateKey < state.data.epoch) return;
  state.activeDateKey = dateKey;
  initInputForActiveDay();
  closeAllModals(true);
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function copyShareResult() {
  const { puzzle, number, dateKey } = getPuzzleForDate(state.activeDateKey);
  const rec = getCurrentRecord();
  const { d, m } = parseDateKey(dateKey);
  const ddmm = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  const hintsUsed = rec.revealedHints.length + rec.revealedIndices.length;

  let dots = '';
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (rec.status === 'won') {
      if (i < rec.guesses.length - 1) dots += '🟥';
      else if (i === rec.guesses.length - 1) dots += '🟩';
      else dots += '⬜';
    } else {
      dots += '🟥';
    }
  }

  const statusLine =
    rec.status === 'won'
      ? `🟩 ${rec.guesses.length}/${MAX_ATTEMPTS} · ${rec.score} pts`
      : `🟥 X/${MAX_ATTEMPTS}`;

  const text = [
    `Críptico Emotes #${number} (${ddmm}) · 7TV baulo`,
    `${statusLine}${hintsUsed > 0 ? ` · ${hintsUsed} ${hintsUsed === 1 ? 'pista' : 'pistas'}` : ' · sin pistas'}`,
    dots,
    window.location.href.split('#')[0],
  ].join('\n');

  try {
    await navigator.clipboard.writeText(text);
    showToast('Resultado copiado al portapapeles');
  } catch {
    showToast('No se pudo copiar automáticamente');
  }
}

// -------------------- Rendering --------------------

function renderStaticIcons() {
  const setHtml = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };
  const brandMark = document.querySelector('.sb-brand-mark');
  if (brandMark) brandMark.innerHTML = ICONS.brand;

  setHtml('ico-sb-howto', ICONS.bookOpen);
  setHtml('ico-sb-stats', ICONS.stats);
  setHtml('sb-streak-flame', ICONS.flame);
  setHtml('ico-nav-play', ICONS.criptico);
  setHtml('ico-nav-archive', ICONS.calendar);
  setHtml('ico-nav-stats', ICONS.stats);
  setHtml('ico-nav-howto', ICONS.bookOpen);
  setHtml('ico-sf-book', ICONS.bookOpen);
  setHtml('ico-sf-7tv', ICONS.external);
  setHtml('ico-footer-gh', ICONS.github);
  setHtml('ico-footer-x', ICONS.x);

  document.querySelectorAll('.modal-close').forEach((btn) => {
    btn.innerHTML = ICONS.close;
  });
}

function renderHeaderAndStreak() {
  const dateEl = document.getElementById('sb-date');
  if (dateEl) dateEl.textContent = formatLongDate(state.todayKey);

  const stats = computeStats(state.store, state.todayKey);
  const numEl = document.getElementById('sb-streak-num');
  if (numEl) numEl.textContent = String(stats.currentStreak);

  const flame = document.getElementById('sb-streak-flame');
  if (flame) flame.classList.toggle('hot', stats.currentStreak > 0);
}

function renderDayTabs() {
  const wrap = document.getElementById('daytabs');
  if (!wrap) return;

  // Show HOY, AYER, and 5 previous days (total 7 day tabs) + ARCHIVO, matching criptico.es
  const tabs = [];
  for (let offset = 0; offset >= -6; offset--) {
    const dk = addDays(state.todayKey, offset);
    if (dk < state.data.epoch) break;
    const rec = getDayRecord(state.store, dk);
    const active = dk === state.activeDateKey;
    const hideMob = offset <= -2;
    const dot =
      rec.status === 'won'
        ? '<span class="daytab-dot won" aria-label="Resuelto"></span>'
        : rec.status === 'lost'
        ? '<span class="daytab-dot lost" aria-label="Fallado"></span>'
        : '';
    tabs.push(`
      <button
        type="button"
        class="daytab${active ? ' active' : ''}${hideMob ? ' hide-mob' : ''}"
        role="tab"
        aria-selected="${active}"
        data-day="${dk}"
      >
        ${dot}
        <span>${formatShortTab(dk, state.todayKey)}</span>
      </button>
    `);
  }

  // If user picked an older date from the archive (outside last 7 days), reflect it on ARCHIVO tab
  const inRecent = daysBetween(state.activeDateKey, state.todayKey) <= 6;
  tabs.push(`
    <button
      type="button"
      class="daytab${!inRecent ? ' active' : ''}"
      data-action="open-archive"
    >
      <span>${!inRecent ? formatShortTab(state.activeDateKey, state.todayKey) : 'ARCHIVO'}</span>
    </button>
  `);

  wrap.innerHTML = tabs.join('');
}

function renderGame() {
  const mount = document.getElementById('game-mount');
  if (!mount || !state.data) return;

  const { puzzle, number, dateKey } = getPuzzleForDate(state.activeDateKey);
  const rec = getCurrentRecord();
  const isFinished = rec.status === 'won' || rec.status === 'lost';
  const lockedSet = new Set(rec.revealedIndices);
  const revealsLimit = maxLetterReveals(puzzle);
  const revealsUsed = rec.revealedIndices.length;

  // Category tag
  let catBadge = '';
  if (puzzle.numerico) {
    catBadge = `<span class="cr-tag-cat num">Reto lógico · ${puzzle.longitud} cifras</span>`;
  } else if (puzzle.tier === 1) {
    catBadge = `<span class="cr-tag-cat tier1">★ ${escapeHtml(puzzle.categoria)}</span>`;
  } else {
    catBadge = `<span class="cr-tag-cat">${escapeHtml(puzzle.categoria)}</span>`;
  }

  // Clue HTML with active highlights
  const activeHighlights = isFinished ? ['definicion', 'indicador', 'material'] : rec.visibleHints;
  const clueHtml = renderClueHtml(puzzle.pista, activeHighlights);

  // Letter / digit boxes
  const boxesHtml = state.inputChars
    .map((ch, idx) => {
      const classes = ['cr-box'];
      if (rec.status === 'won') classes.push('correcta');
      else if (rec.status === 'lost') classes.push('incorrecta');
      else {
        if (state.flashingWrong && !lockedSet.has(idx)) classes.push('incorrecta');
        if (lockedSet.has(idx)) classes.push('revelada');
        if (idx === state.cursor) classes.push('cursor');
      }
      return `<div
        class="${classes.join(' ')}"
        data-box="${idx}"
        role="button"
        tabindex="${isFinished || lockedSet.has(idx) ? '-1' : '0'}"
        aria-label="Casilla ${idx + 1}: ${ch || 'vacía'}"
      >${escapeHtml(ch)}</div>`;
    })
    .join('');

  // Previous wrong guesses (while playing)
  const wrongGuesses = rec.status === 'won' ? rec.guesses.slice(0, -1) : rec.guesses;
  const prevHtml =
    wrongGuesses.length > 0 && !isFinished
      ? `<div class="cr-prev-guesses" aria-label="Intentos anteriores">${wrongGuesses
          .map((g) => `<span class="cr-prev-chip">${escapeHtml(g)}</span>`)
          .join('')}</div>`
      : '';

  // Hint buttons (4 tools matching criptico.es)
  const hintBtns = [
    { id: 'definicion', label: 'Definición', icon: ICONS.bookOpen, color: HINT_TYPES.definicion.color },
    { id: 'indicador', label: 'Indicador', icon: ICONS.signpost, color: HINT_TYPES.indicador.color },
    { id: 'material', label: 'Material', icon: ICONS.cube, color: HINT_TYPES.material.color },
  ]
    .map((h) => {
      const isVisible = activeHighlights.includes(h.id);
      const isUnlocked = rec.revealedHints.includes(h.id);
      return `<button
        type="button"
        class="cr-tool${isVisible ? ' on' : ''}"
        style="--tc:${h.color}"
        data-hint="${h.id}"
        aria-pressed="${isVisible}"
        ${isFinished ? 'disabled' : ''}
      >
        <span class="cr-tool-ico">${h.icon}</span>
        <span>${h.label}${isUnlocked && !isFinished ? ' ✓' : ''}</span>
      </button>`;
    })
    .join('');

  const revealLabel = puzzle.numerico ? 'Revelar cifra' : 'Revelar letra';
  const revealIcon = puzzle.numerico ? ICONS.number : ICONS.letter;
  const revealBtn = `<button
    type="button"
    class="cr-tool"
    data-action="reveal-char"
    ${isFinished || revealsUsed >= revealsLimit ? 'disabled' : ''}
  >
    <span class="cr-tool-ico">${revealIcon}</span>
    <span>${revealLabel} (${revealsUsed}/${revealsLimit})</span>
  </button>`;

  const hintsUsedTotal = rec.revealedHints.length + revealsUsed;
  const pistasNota = isFinished
    ? 'Partes de la pista resaltadas: definición (verde), indicador (ámbar) y material (rojo).'
    : `Pistas gratis sin cuenta. Cada pista usada descuenta 10 puntos${hintsUsedTotal > 0 ? ` (usadas: ${hintsUsedTotal})` : ''}.`;

  // Keyboard (only while playing)
  let kbHtml = '';
  if (!isFinished) {
    const rows = puzzle.numerico ? NUM_ROWS : QWERTY_ROWS;
    kbHtml = `<div class="cr-kb" aria-label="Teclado en pantalla">
      ${rows
        .map(
          (row) => `<div class="cr-kb-row">
          ${row
            .map((key) => {
              if (key === 'ENTER') {
                return `<button type="button" class="cr-key wide" data-key="ENTER">Enter</button>`;
              }
              if (key === 'BACK') {
                return `<button type="button" class="cr-key wide" data-key="BACK" aria-label="Borrar">${ICONS.backspace}</button>`;
              }
              const extraClass = puzzle.numerico ? ' num-key' : '';
              return `<button type="button" class="cr-key${extraClass}" data-key="${key}">${key}</button>`;
            })
            .join('')}
        </div>`
        )
        .join('')}
    </div>`;
  }

  // Attempt dots
  const dotsHtml = Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
    let cls = 'cr-dot';
    if (rec.status === 'won') {
      if (i < rec.guesses.length - 1) cls += ' used';
      else if (i === rec.guesses.length - 1) cls += ' won';
    } else if (i < rec.guesses.length) {
      cls += ' used';
    }
    return `<span class="${cls}"></span>`;
  }).join('');

  const left = MAX_ATTEMPTS - rec.guesses.length;
  let attemptsText = '';
  if (rec.status === 'won') {
    attemptsText =
      rec.guesses.length === 1
        ? '¡Resuelto al primer intento!'
        : `Resuelto en ${rec.guesses.length} de ${MAX_ATTEMPTS} intentos`;
  } else if (rec.status === 'lost') {
    attemptsText = 'Agotaste los 5 intentos';
  } else if (rec.guesses.length === 0) {
    attemptsText = `Tienes ${MAX_ATTEMPTS} intentos`;
  } else if (left === 1) {
    attemptsText = 'Último intento';
  } else {
    attemptsText = `Te quedan ${left} intentos`;
  }

  // Action bar (while playing) OR Emote Reveal Card (when finished)
  let lowerHtml = '';
  if (!isFinished) {
    const allFilled = state.inputChars.every(Boolean);
    lowerHtml = `
      <div class="cr-actions">
        <button type="button" class="btn btn-solid" id="btn-submit" ${allFilled ? '' : 'disabled'}>
          Comprobar
        </button>
        <button type="button" class="howto-circle" data-action="open-howto" aria-label="Cómo se juega" title="Cómo se juega">
          ${ICONS.help}
        </button>
      </div>
      <div class="cr-message${state.feedback?.isErr ? ' err' : ''}" role="status" aria-live="polite">
        ${state.feedback ? escapeHtml(state.feedback.text) : ''}
      </div>
    `;
  } else {
    const stats = computeStats(state.store, state.todayKey);
    const usesLine =
      puzzle.usos > 0
        ? `<strong>${puzzle.usos.toLocaleString('es-ES')}</strong> usos en el chat de baulo · `
        : '';
    const isToday = dateKey === state.todayKey;
    lowerHtml = `
      <div class="cr-solution${rec.status === 'lost' ? ' lost' : ''}">
        <div class="cr-sol-top">
          <a
            class="cr-emote-frame"
            href="https://7tv.app/emotes/${escapeHtml(puzzle.id)}"
            target="_blank"
            rel="noopener noreferrer"
            title="Ver ${escapeHtml(puzzle.nombre)} en 7TV"
          >
            <img
              src="${getEmoteImageUrl(puzzle.id, '3x')}"
              alt="Emote 7TV ${escapeHtml(puzzle.nombre)}"
              onerror="if(!this.dataset.f){this.dataset.f='1';this.src='${getEmoteImageUrl(puzzle.id, '2x')}'}"
            />
            <span class="cr-emote-badge">${puzzle.animado ? '7TV GIF' : '7TV'}</span>
          </a>
          <div class="cr-sol-info">
            <div class="cr-sol-status-row">
              <span class="cr-sol-pill ${rec.status}">${rec.status === 'won' ? '¡Acertado!' : 'Sin intentos'}</span>
              ${rec.status === 'won' ? `<span class="cr-sol-score">${rec.score} / 100 pts</span>` : ''}
            </div>
            <div class="cr-sol-name">${escapeHtml(puzzle.nombre)}</div>
            <div class="cr-sol-pop">
              <span>${usesLine}${escapeHtml(puzzle.categoria)}</span>
            </div>
            <p class="cr-sol-desc">${escapeHtml(puzzle.descripcion)}</p>
          </div>
        </div>

        <div class="cr-sol-explain">
          <div class="cr-solution-label">Explicación de la pista</div>
          <div class="cr-solution-text">${escapeHtml(puzzle.explicacion)}</div>
        </div>

        <div class="cr-sol-actions">
          <button type="button" class="btn btn-kick" data-action="share">
            ${ICONS.copy}
            <span>Compartir resultado</span>
          </button>
          <button type="button" class="btn btn-outline" data-action="open-archive">
            Jugar otro día
          </button>
          <a
            class="btn btn-outline"
            href="https://7tv.app/emotes/${escapeHtml(puzzle.id)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver en 7TV ↗
          </a>
        </div>

        ${
          isToday
            ? `<div class="cr-countdown">
                ${ICONS.clock}
                <span>Siguiente críptico en <strong id="cr-next-time">${formatCountdown(msUntilNextLocalDay())}</strong></span>
              </div>`
            : ''
        }
      </div>

      <div class="cr-stats" aria-label="Resumen de estadísticas">
        <div class="cr-stat">
          <div class="cr-stat-num">${stats.played}</div>
          <div class="cr-stat-label">Jugados</div>
        </div>
        <div class="cr-stat">
          <div class="cr-stat-num">${stats.winPct}%</div>
          <div class="cr-stat-label">Aciertos</div>
        </div>
        <div class="cr-stat">
          <div class="cr-stat-num">${stats.currentStreak}</div>
          <div class="cr-stat-label">Racha</div>
        </div>
        <div class="cr-stat">
          <div class="cr-stat-num">${stats.bestStreak}</div>
          <div class="cr-stat-label">Mejor</div>
        </div>
      </div>
    `;
  }

  mount.innerHTML = `
    <div class="cr-panel">
      <div class="cr-eyebrow">
        <span>${escapeHtml(formatLongDate(dateKey))}</span>
        <span>·</span>
        <span>Nº ${number}</span>
        <span>·</span>
        <span class="cr-dif">${escapeHtml(puzzle.dificultad)}</span>
        ${catBadge}
      </div>

      <h2 class="cr-pista">${clueHtml}</h2>

      <div class="cr-boxes${state.shaking ? ' cr-shake' : ''}" style="--cr-n:${puzzle.longitud}">
        ${boxesHtml}
      </div>

      ${prevHtml}

      <div class="cr-club-tools">
        ${hintBtns}
        ${revealBtn}
      </div>
      <p class="cr-pistas-nota">${pistasNota}</p>

      ${kbHtml}

      <div class="cr-intentos-row">
        <div class="cr-squares" aria-hidden="true">${dotsHtml}</div>
        <span class="cr-intentos-label">${attemptsText}</span>
      </div>

      ${lowerHtml}
    </div>
  `;

  ensureCountdownTimer();
}

function ensureCountdownTimer() {
  clearInterval(state.countdownTimer);
  const el = document.getElementById('cr-next-time');
  if (!el) return;
  state.countdownTimer = setInterval(() => {
    const target = document.getElementById('cr-next-time');
    if (!target) {
      clearInterval(state.countdownTimer);
      return;
    }
    const ms = msUntilNextLocalDay();
    target.textContent = formatCountdown(ms);
    // If midnight just rolled over, refresh todayKey!
    const nowKey = getTodayKey();
    if (nowKey !== state.todayKey) {
      state.todayKey = nowKey;
      renderAll();
    }
  }, 1000);
}

// -------------------- Archive Modal --------------------

function renderArchiveModal() {
  const calWrap = document.getElementById('archivo-cal-wrap');
  const listWrap = document.getElementById('archivo-lista-wrap');
  calWrap.hidden = state.archiveView !== 'cal';
  listWrap.hidden = state.archiveView !== 'lista';

  document.querySelectorAll('#archivo-vistas .ar-tab').forEach((tab) => {
    const on = tab.dataset.view === state.archiveView;
    tab.classList.toggle('active', on);
    tab.setAttribute('aria-selected', String(on));
  });

  if (state.archiveView === 'cal') renderArchiveCalendar();
  else renderArchiveList();
}

function renderArchiveCalendar() {
  const mesEl = document.getElementById('archivo-mes');
  const grid = document.getElementById('archivo-dias');
  const prevBtn = document.getElementById('archivo-prev');
  const nextBtn = document.getElementById('archivo-next');

  const y = state.archiveYear;
  const m = state.archiveMonth;
  mesEl.textContent = formatMonthYear(y, m);

  const epochParsed = parseDateKey(state.data.epoch);
  const todayParsed = parseDateKey(state.todayKey);

  prevBtn.disabled = y < epochParsed.y || (y === epochParsed.y && m <= epochParsed.m - 1);
  nextBtn.disabled = y > todayParsed.y || (y === todayParsed.y && m >= todayParsed.m - 1);

  const firstDow = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

  const cells = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push('<span class="ar-dia-vacio" aria-hidden="true"></span>');
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dk = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const disabled = dk < state.data.epoch || dk > state.todayKey;
    const rec = getDayRecord(state.store, dk);
    const cls = ['ar-dia'];
    if (rec.status === 'won') cls.push('won');
    else if (rec.status === 'lost') cls.push('lost');
    if (dk === state.activeDateKey) cls.push('sel');

    cells.push(`
      <button
        type="button"
        class="${cls.join(' ')}"
        data-pick-day="${dk}"
        ${disabled ? 'disabled' : ''}
      >${d}</button>
    `);
  }
  grid.innerHTML = cells.join('');
}

function renderArchiveList() {
  const listEl = document.getElementById('archivo-lista');
  const countEl = document.getElementById('archivo-cuenta');
  const q = state.archiveQuery.trim().toLowerCase();
  const filt = state.archiveFilter;

  document.querySelectorAll('#archivo-filtros .ar-chip').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.filter === filt));
  });

  const maxDays = Math.min(365, Math.max(0, daysBetween(state.data.epoch, state.todayKey)) + 1);
  const rows = [];

  for (let offset = 0; offset < maxDays; offset++) {
    const dk = addDays(state.todayKey, -offset);
    if (dk < state.data.epoch) break;
    const { puzzle, number } = getPuzzleForDate(dk);
    const rec = getDayRecord(state.store, dk);

    if (filt === 'Fácil' || filt === 'Medio' || filt === 'Difícil') {
      if (puzzle.dificultad !== filt) continue;
    } else if (filt === 'numerico') {
      if (!puzzle.numerico) continue;
    } else if (filt === 'pendiente') {
      if (rec.status === 'won' || rec.status === 'lost') continue;
    }

    const plainClue = stripClueMarkup(puzzle.pista);
    if (q) {
      const hay = `${number} ${formatLongDate(dk)} ${plainClue} ${puzzle.dificultad} ${puzzle.categoria}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }

    const statusBadge =
      rec.status === 'won'
        ? `<span class="ar-fila-status won">✓ ${escapeHtml(puzzle.nombre)}</span>`
        : rec.status === 'lost'
        ? `<span class="ar-fila-status lost">✕ ${escapeHtml(puzzle.nombre)}</span>`
        : `<span>${escapeHtml(puzzle.dificultad)}</span>`;

    rows.push(`
      <button type="button" class="ar-fila" data-pick-day="${dk}">
        <div class="ar-fila-top">
          <span><b>${escapeHtml(formatLongDate(dk))}</b> · Nº ${number}</span>
          ${statusBadge}
        </div>
        <div class="ar-fila-pista">${escapeHtml(plainClue)}</div>
      </button>
    `);
  }

  countEl.textContent = `${rows.length} ${rows.length === 1 ? 'acertijo' : 'acertijos'}`;
  listEl.innerHTML = rows.length
    ? rows.join('')
    : '<div class="ar-vacio">No hay acertijos que coincidan con ese filtro.</div>';
}

// -------------------- Stats Modal --------------------

function renderStatsModal() {
  const container = document.getElementById('stats-content');
  if (!container) return;

  const stats = computeStats(state.store, state.todayKey);
  const maxBucket = Math.max(1, ...Object.values(stats.distribution));

  const distHtml = [1, 2, 3, 4, 5]
    .map((k) => {
      const val = stats.distribution[k] || 0;
      const pct = val > 0 ? Math.max(10, Math.round((val / maxBucket) * 100)) : 8;
      return `
        <div class="st-dist-row">
          <span class="st-dist-k">${k}</span>
          <div class="st-dist-track">
            <div class="st-dist-bar${val === 0 ? ' zero' : ''}" style="width:${pct}%">${val}</div>
          </div>
        </div>
      `;
    })
    .join('');

  const galleryHtml = stats.solvedEmotes.length
    ? `<div class="st-gallery">
        ${stats.solvedEmotes
          .map(
            (item) => `
          <button
            type="button"
            class="st-emote-card"
            data-pick-day="${item.dateKey}"
            title="${escapeHtml(item.nombre)} (${item.dateKey})"
          >
            <img
              src="${getEmoteImageUrl(item.id, '2x')}"
              alt="${escapeHtml(item.nombre)}"
              loading="lazy"
            />
            <span>${escapeHtml(item.nombre)}</span>
          </button>`
          )
          .join('')}
      </div>`
    : `<p class="st-empty">Aún no has descubierto ningún emote. ¡Resuelve el críptico de hoy para empezar tu colección!</p>`;

  container.innerHTML = `
    <div class="st-kpis">
      <div class="st-kpi">
        <div class="st-kpi-num">${stats.played}</div>
        <div class="st-kpi-lbl">Jugados</div>
      </div>
      <div class="st-kpi">
        <div class="st-kpi-num">${stats.winPct}%</div>
        <div class="st-kpi-lbl">Aciertos</div>
      </div>
      <div class="st-kpi">
        <div class="st-kpi-num">${stats.currentStreak}</div>
        <div class="st-kpi-lbl">Racha actual</div>
      </div>
      <div class="st-kpi">
        <div class="st-kpi-num">${stats.bestStreak}</div>
        <div class="st-kpi-lbl">Mejor racha</div>
      </div>
    </div>

    <h3 class="st-sec-title">Distribución de intentos</h3>
    <div class="st-dist">${distHtml}</div>

    <h3 class="st-sec-title">Emotes descubiertos (${stats.solvedEmotes.length})</h3>
    ${galleryHtml}
  `;
}

function renderAll() {
  renderHeaderAndStreak();
  renderDayTabs();
  renderGame();
  updateSidebarNavActive();
}

// -------------------- Event Wiring --------------------

function bindEvents() {
  // Sidebar navigation & modal triggers
  document.getElementById('btn-open-howto')?.addEventListener('click', () => openModal('howto'));
  document.getElementById('btn-open-stats')?.addEventListener('click', () => openModal('stats'));
  document.getElementById('sb-streak')?.addEventListener('click', () => openModal('stats'));
  document.getElementById('link-aprende')?.addEventListener('click', () => openModal('howto'));
  document.getElementById('footer-howto')?.addEventListener('click', () => openModal('howto'));

  document.getElementById('sb-nav-items')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.sb-nav-item');
    if (!btn) return;
    const nav = btn.dataset.nav;
    if (nav === 'play') closeAllModals(true);
    else if (nav === 'archive') openModal('archivo');
    else if (nav === 'stats') openModal('stats');
    else if (nav === 'howto') openModal('howto');
  });

  // Day tabs
  document.getElementById('daytabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.daytab');
    if (!tab) return;
    if (tab.dataset.action === 'open-archive') {
      openModal('archivo');
      return;
    }
    if (tab.dataset.day) selectDate(tab.dataset.day);
  });

  // Game board clicks (delegated)
  document.getElementById('game-mount')?.addEventListener('click', (e) => {
    const box = e.target.closest('[data-box]');
    if (box) {
      const idx = Number(box.dataset.box);
      const rec = getCurrentRecord();
      if (rec.status === 'playing' && !rec.revealedIndices.includes(idx)) {
        state.cursor = idx;
        renderGame();
      }
      return;
    }

    const hintBtn = e.target.closest('[data-hint]');
    if (hintBtn && !hintBtn.disabled) {
      handleToggleHint(hintBtn.dataset.hint);
      return;
    }

    const keyBtn = e.target.closest('[data-key]');
    if (keyBtn) {
      const key = keyBtn.dataset.key;
      if (key === 'ENTER') handleSubmit();
      else if (key === 'BACK') handleBackspace();
      else handleCharInput(key);
      return;
    }

    if (e.target.closest('#btn-submit')) {
      handleSubmit();
      return;
    }

    const actBtn = e.target.closest('[data-action]');
    if (actBtn) {
      const act = actBtn.dataset.action;
      if (act === 'reveal-char') handleRevealLetter();
      else if (act === 'open-howto') openModal('howto');
      else if (act === 'open-archive') openModal('archivo');
      else if (act === 'share') copyShareResult();
    }
  });

  // Modal close buttons & backdrop clicks
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('.modal-close')) {
        closeAllModals(true);
      }
    });
  });

  // Archive modal controls
  document.getElementById('archivo-vistas')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.ar-tab');
    if (!tab) return;
    state.archiveView = tab.dataset.view;
    renderArchiveModal();
  });

  document.getElementById('archivo-prev')?.addEventListener('click', () => {
    state.archiveMonth--;
    if (state.archiveMonth < 0) {
      state.archiveMonth = 11;
      state.archiveYear--;
    }
    renderArchiveCalendar();
  });

  document.getElementById('archivo-next')?.addEventListener('click', () => {
    state.archiveMonth++;
    if (state.archiveMonth > 11) {
      state.archiveMonth = 0;
      state.archiveYear++;
    }
    renderArchiveCalendar();
  });

  document.getElementById('archivo-buscar')?.addEventListener('input', (e) => {
    state.archiveQuery = e.target.value;
    renderArchiveList();
  });

  document.getElementById('archivo-filtros')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.ar-chip');
    if (!chip) return;
    state.archiveFilter = chip.dataset.filter;
    renderArchiveList();
  });

  // Pick a day from Archive or Stats emote gallery
  document.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick-day]');
    if (!pick || pick.disabled) return;
    selectDate(pick.dataset.pickDay);
  });

  // Physical keyboard support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.activeModal) {
      closeAllModals(true);
      return;
    }
    if (state.activeModal) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      handleBackspace();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handleArrow(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleArrow(1);
    } else if (e.key.length === 1) {
      const ch = normalizeGuessChar(e.key);
      if (ch) {
        e.preventDefault();
        handleCharInput(ch);
      }
    }
  });
}

// -------------------- Bootstrap --------------------

async function boot() {
  renderStaticIcons();
  bindEvents();

  try {
    const res = await fetch('./puzzles.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.data = await res.json();

    const todayParsed = parseDateKey(state.todayKey);
    state.archiveYear = todayParsed.y;
    state.archiveMonth = todayParsed.m - 1;

    const footerMeta = document.getElementById('footer-meta');
    if (footerMeta) {
      footerMeta.textContent = `${state.data.total} emotes de baulo disponibles · Progreso y rachas guardados localmente en tu navegador.`;
    }

    initInputForActiveDay();
    renderAll();
  } catch (err) {
    console.error(err);
    const mount = document.getElementById('game-mount');
    if (mount) {
      mount.innerHTML = `<div class="cr-loading">No se pudo cargar el acertijo del día. Recarga la página para intentarlo de nuevo.</div>`;
    }
  }
}

boot();
