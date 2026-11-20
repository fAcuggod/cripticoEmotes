#!/usr/bin/env node
/**
 * Strictly validates public/puzzles.json:
 *  - Every puzzle has valid markup containing definicion (_..._), indicador (~...~), and material (*...*)
 *  - No answer leak inside the definition
 *  - Every clue's wordplay actually resolves to the answer!
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function stripAccents(str) {
  return str
    .replace(/ñ/g, '__ENYE__')
    .replace(/Ñ/g, '__ENYE__')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/__ENYE__/g, 'Ñ');
}

function parseMarkup(pista) {
  const segments = { definicion: [], indicador: [], material: [] };
  const map = { _: 'definicion', '~': 'indicador', '*': 'material' };
  const re = /([_~*])([^_~*]+)\1/g;
  let m;
  while ((m = re.exec(pista)) !== null) {
    segments[map[m[1]]].push(m[2]);
  }
  const stripped = pista.replace(/[_~*]/g, '');
  if (/[_~*]/.test(stripped)) {
    return { error: 'Unbalanced markup delimiter', segments };
  }
  return { error: null, segments };
}

function sortLetters(s) {
  return [...stripAccents(s).replace(/[^A-ZÑ0-9]/g, '')].sort().join('');
}

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'puzzles.json'), 'utf8'));
const errors = [];

const seenIds = new Set();
const seenAnswers = new Set();

for (let i = 0; i < data.puzzles.length; i++) {
  const p = data.puzzles[i];
  if (seenIds.has(p.id)) errors.push(`#${i} ${p.nombre}: duplicate id`);
  seenIds.add(p.id);
  if (seenAnswers.has(p.respuesta)) errors.push(`#${i} ${p.nombre}: duplicate respuesta`);
  seenAnswers.add(p.respuesta);

  const parsed = parseMarkup(p.pista);
  if (parsed.error) {
    errors.push(`#${i} ${p.nombre}: ${parsed.error} in "${p.pista}"`);
    continue;
  }
  for (const part of ['definicion', 'indicador', 'material']) {
    if (parsed.segments[part].length === 0) {
      errors.push(`#${i} ${p.nombre}: missing ${part} in "${p.pista}"`);
    }
  }

  // Verify no 4+ char leak inside definition
  const defNorm = stripAccents(parsed.segments.definicion.join(' '));
  const ans = p.respuesta;
  if (ans.length >= 4) {
    for (let k = 0; k <= ans.length - 4; k++) {
      const sub = ans.slice(k, k + 4);
      if (defNorm.includes(sub)) {
        errors.push(`#${i} ${p.nombre}: definition leaks "${sub}" in "${parsed.segments.definicion.join(' ')}"`);
        break;
      }
    }
  }

  // Verify wordplay mechanics mathematically!
  const matRaw = parsed.segments.material.join(' ');
  const matQuoted = (matRaw.match(/«([^»]+)»/) || [])[1] || '';

  if (p.tipo === 'anagrama') {
    if (sortLetters(matQuoted) !== sortLetters(ans)) {
      errors.push(`#${i} ${p.nombre}: anagram mismatch "${matQuoted}" vs "${ans}"`);
    }
    if (stripAccents(matQuoted) === ans) {
      errors.push(`#${i} ${p.nombre}: anagram equals answer`);
    }
  } else if (p.tipo === 'inversion' && !p.numerico) {
    if (matQuoted.includes(' ')) {
      // Split reversal
      const rebuilt = matQuoted.split(' ').map((w) => [...stripAccents(w)].reverse().join('')).join('');
      if (rebuilt !== ans) errors.push(`#${i} ${p.nombre}: split reversal mismatch "${matQuoted}" -> "${rebuilt}" != "${ans}"`);
    } else {
      const rev = [...stripAccents(matQuoted)].reverse().join('');
      if (rev !== ans) errors.push(`#${i} ${p.nombre}: reversal mismatch "${matQuoted}" -> "${rev}" != "${ans}"`);
    }
  } else if (p.tipo === 'oculta') {
    const joined = stripAccents(matQuoted).replace(/[^A-ZÑ0-9]/g, '');
    const pos = joined.indexOf(ans);
    if (pos <= 0 || pos + ans.length >= joined.length) {
      errors.push(`#${i} ${p.nombre}: hidden word not strictly inside "${matQuoted}"`);
    }
  } else if (p.tipo === 'iniciales') {
    const words = matQuoted.split(',').map((w) => w.trim()).filter(Boolean);
    const initials = words.map((w) => stripAccents(w)[0]).join('');
    if (initials !== ans) {
      errors.push(`#${i} ${p.nombre}: acrostic mismatch "${initials}" != "${ans}"`);
    }
  }

  // Verify length tag at end
  if (!p.pista.endsWith(`(${p.longitud})`)) {
    errors.push(`#${i} ${p.nombre}: missing length tag (${p.longitud})`);
  }
}

console.log(`Checked ${data.puzzles.length} puzzles. Errors: ${errors.length}`);
for (const e of errors.slice(0, 30)) console.error('  -', e);
if (errors.length > 0) process.exit(1);
