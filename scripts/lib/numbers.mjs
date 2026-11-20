// Spanish number words (0 – 999 999), used by the numeric-emote clues.

const UNITS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const TEENS = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const TWENTIES = ['veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function below100(n) {
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 30) return TWENTIES[n - 20];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u ? `${TENS[t]} y ${UNITS[u]}` : TENS[t];
}

function below1000(n) {
  if (n === 100) return 'cien';
  if (n < 100) return below100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  return r ? `${HUNDREDS[h]} ${below100(r)}` : HUNDREDS[h];
}

export function numberToWords(n) {
  if (n < 1000) return below1000(n);
  const th = Math.floor(n / 1000);
  const r = n % 1000;
  const head = th === 1 ? 'mil' : `${below1000(th).replace(/uno$/, 'un')} mil`;
  return r ? `${head} ${below1000(r)}` : head;
}
