// Builds public/nastroje/google-fonts.json from Google's public metadata endpoint —
// no API key, no build-time download of 1959 font files. Run with `npm run fonts:catalog`.
//
// Each entry is [family, category, weights]: the page needs nothing more to
// offer the whole catalogue, and the font itself is fetched only when it is chosen.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://fonts.google.com/metadata/fonts';
const OUT = fileURLToPath(new URL('../public/nastroje/google-fonts.json', import.meta.url));

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`metadata: HTTP ${response.status}`);

// The endpoint prefixes the JSON with a `)]}'` anti-hijacking line.
const text = (await response.text()).replace(/^\)\]\}'\s*\n/, '');
const { familyMetadataList } = JSON.parse(text);

const families = familyMetadataList
  .map((f) => {
    const weights = Object.keys(f.fonts ?? {})
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    // Google's metadata has no italic flag, so italic is attempted on demand and
    // reported honestly when a family turns out not to have it.
    return [f.family, f.category, weights];
  })
  .filter(([, , weights]) => weights.length > 0)
  .sort((a, b) => a[0].localeCompare(b[0]));

const payload = { updated: new Date().toISOString().slice(0, 10), families };
writeFileSync(OUT, JSON.stringify(payload));
console.log(`${families.length} families -> ${OUT} (${(JSON.stringify(payload).length / 1024).toFixed(0)} KB)`);
