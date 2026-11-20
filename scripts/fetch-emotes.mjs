#!/usr/bin/env node
/**
 * Refreshes data/emote-set.json from the live 7TV v3 API for baulo's channel
 * and data/chatstats.json from StreamElements.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const EMOTE_SET_ID = '01FT80E0280001E12995B11F56';
const CHANNEL = 'baulo';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  console.log(`Fetching 7TV emote set ${EMOTE_SET_ID}...`);
  const set = await fetchJson(`https://7tv.io/v3/emote-sets/${EMOTE_SET_ID}`);
  fs.writeFileSync(path.join(ROOT, 'data', 'emote-set.json'), JSON.stringify(set));
  console.log(`Saved ${set.emotes?.length || 0} emotes to data/emote-set.json`);

  try {
    console.log(`Fetching StreamElements chat stats for ${CHANNEL}...`);
    const stats = await fetchJson(`https://api.streamelements.com/kappa/v2/chatstats/${CHANNEL}/stats?limit=100`);
    fs.writeFileSync(path.join(ROOT, 'data', 'chatstats.json'), JSON.stringify(stats));
    console.log(`Saved chat stats (${stats.totalMessages || 0} total messages) to data/chatstats.json`);
  } catch (err) {
    console.warn(`Could not refresh chat stats (keeping existing copy): ${err.message}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
