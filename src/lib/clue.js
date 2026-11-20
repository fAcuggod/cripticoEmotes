// Cryptic clue markup parser and renderer (exact criptico.es color system).

export const HINT_TYPES = {
  definicion: { id: 'definicion', nombre: 'Definición', marker: '_', color: '#1E6B3C' },
  indicador: { id: 'indicador', nombre: 'Indicador', marker: '~', color: '#B85C00' },
  material: { id: 'material', nombre: 'Material', marker: '*', color: '#9B2D21' },
};

const MARKER_TO_TYPE = {
  _: 'definicion',
  '~': 'indicador',
  '*': 'material',
};

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function parseClueTokens(raw) {
  const tokens = [];
  const text = String(raw || '');
  const re = /([_~*])([^_~*]+)\1/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push({ tipo: null, texto: text.slice(last, m.index) });
    }
    tokens.push({ tipo: MARKER_TO_TYPE[m[1]], texto: m[2] });
    last = re.lastIndex;
  }
  if (last < text.length) {
    tokens.push({ tipo: null, texto: text.slice(last) });
  }
  return tokens;
}

export function renderClueHtml(raw, activeParts = []) {
  const activeSet = new Set(activeParts);
  return parseClueTokens(raw)
    .map((tok) => {
      const safe = escapeHtml(tok.texto);
      if (tok.tipo && activeSet.has(tok.tipo)) {
        const color = HINT_TYPES[tok.tipo].color;
        return `<span class="cr-parte" style="--c:${color}">${safe}</span>`;
      }
      return safe;
    })
    .join('');
}

export function stripClueMarkup(raw) {
  return String(raw || '').replace(/[_~*]/g, '');
}

export function normalizeGuessChar(ch) {
  if (!ch) return '';
  const up = ch.toUpperCase();
  if (up === 'Ñ') return 'Ñ';
  const clean = up.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /^[A-Z0-9]$/.test(clean) ? clean : '';
}

export function getEmoteImageUrl(id, size = '4x') {
  return `https://cdn.7tv.app/emote/${id}/${size}.webp`;
}
