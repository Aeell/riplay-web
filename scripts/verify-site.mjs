// Three promises about the built site, checked instead of remembered.
//
//   npm run verify:site        (run `npm run build` first, or use verify:all)
//
// 1. Every internal link and asset reference resolves inside dist/ — including fragments, because
//    a nav item pointing at a section that was renamed is exactly the bug nobody sees.
// 2. Every page stays inside its gzip budget. The numbers were measured on 2026-11-13 and carry
//    headroom for real content; a page that doubles is a decision, not an accident.
// 3. Nothing the browser loads comes from another origin. This is the no-CDN, no-analytics rule
//    as a check. It is a guardrail, not a proof: a URL assembled at runtime cannot be caught by
//    reading text, so the JS rules look for the constructs that make requests.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = new URL('../dist/', import.meta.url).pathname;
const ORIGIN = 'riplay.cz';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const files = walk(DIST);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const cssFiles = files.filter((file) => file.endsWith('.css'));
const jsFiles = files.filter((file) => file.endsWith('.js'));
const read = (file) => readFileSync(file, 'utf-8');
const routeOf = (file) => `/${relative(DIST, file).replace(/index\.html$/, '')}`;

// ── budgets ────────────────────────────────────────────────────────────────────────────────
// Measured 2026-11-13 after the intake work, rounded up with room to write: the home page was
// 7.86 kB gzipped, the part page 5.46, everything else between 1.5 and 4.1.
const BUDGETS = {
  '/': 10,
  '/zakazka/': 6,
  '/dil/vzorova-vlozka/': 7,
  '/archiv/': 6,
  '/nastroje/': 6,
  '/nastroje/prevod/': 6,
  '/nastroje/vrstvy/': 6,
  '/stroj/': 5,
  '/denik/': 4,
  '/denik/ep-00/': 5,
  '/dil/': 4,
  '/404.html': 4,
};
const DEFAULT_BUDGET = 6;

// ── 1. references resolve ──────────────────────────────────────────────────────────────────

const idsOf = new Map(htmlFiles.map((file) => [file, new Set(
  [...read(file).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
)]));

const refs = (html) => {
  const found = [];
  for (const m of html.matchAll(/\s(href|src|poster|action)="([^"]*)"/g)) found.push([m[1], m[2]]);
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) {
    for (const candidate of m[1].split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url) found.push(['srcset', url]);
    }
  }
  for (const m of html.matchAll(/\sstyle="([^"]*)"/g)) {
    for (const url of m[1].matchAll(/url\(\s*['"]?([^'")]+)/g)) found.push(['style', url[1]]);
  }
  return found;
};

const isLocal = (value) => !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(value) || /^https?:\/\/(www\.)?riplay\.cz(\/|$)/i.test(value);

const resolve = (path) => {
  const clean = decodeURIComponent(path.split('#')[0].split('?')[0] || '/');
  const target = join(DIST, clean.replace(/^\/+/, ''));
  const candidates = [target, join(target, 'index.html'), `${target}.html`];
  return candidates.find((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) ?? null;
};

let linkCount = 0;
const broken = [];
const lostFragments = [];

for (const file of htmlFiles) {
  const route = routeOf(file);
  for (const [attribute, raw] of refs(read(file))) {
    const value = raw.trim();
    if (!value || value.startsWith('data:') || /^(mailto|tel|javascript):/i.test(value)) continue;
    if (!isLocal(value)) continue; // outbound navigation is allowed; only loading is not

    // An absolute reference to our own origin is local; resolve its path, not the whole URL.
    const path = value.replace(/^https?:\/\/(www\.)?riplay\.cz/i, '') || '/';
    const hash = path.includes('#') ? path.slice(path.indexOf('#') + 1) : '';
    const pathPart = path.split('#')[0].split('?')[0];
    linkCount += 1;

    if (!pathPart) {
      if (hash && !idsOf.get(file)?.has(hash)) lostFragments.push(`${route} → #${hash}`);
      continue;
    }

    const target = resolve(pathPart);
    if (!target) {
      broken.push(`${route} → ${value}`);
      continue;
    }
    if (hash && target.endsWith('.html')) {
      const ids = idsOf.get(target) ?? new Set(
        [...read(target).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
      );
      if (!ids.has(hash)) lostFragments.push(`${route} → ${value}`);
    }
  }
}

check(`internal references resolve (${linkCount} checked)`, broken.length === 0, broken.slice(0, 6).join(', '));
check('anchors point at ids that exist', lostFragments.length === 0, lostFragments.slice(0, 6).join(', '));

// ── 2. gzip budgets ────────────────────────────────────────────────────────────────────────

for (const file of htmlFiles) {
  const route = file === join(DIST, '404.html') ? '/404.html' : routeOf(file);
  const budget = BUDGETS[route] ?? DEFAULT_BUDGET;
  const kb = gzipSync(readFileSync(file), { level: 9 }).length / 1024;
  check(`${route} within ${budget} kB gzipped`, kb <= budget, `${kb.toFixed(2)} kB${route in BUDGETS ? '' : ' (default budget)'}`);
}

// ── 3. nothing loads from another origin ───────────────────────────────────────────────────

const REQUESTS = [
  [/\s(?:src|poster)="([^"]+)"/g, 'src'],
  [/\saction="([^"]+)"/g, 'form action'],
  [/<link\b[^>]*>/g, 'link'],
];
const thirdParty = [];

const flag = (where, value, why) => {
  if (!value || !isLocal(value) && !value.startsWith('data:')) thirdParty.push(`${where}: ${why} ${value}`);
};

for (const file of htmlFiles) {
  const route = routeOf(file);
  const html = read(file);
  for (const [pattern, kind] of REQUESTS) {
    for (const match of html.matchAll(pattern)) {
      if (kind === 'link') {
        const tag = match[0];
        if (!/\srel="(?:stylesheet|preload|prefetch|preconnect|dns-prefetch|icon|manifest|modulepreload)"/.test(tag)) continue;
        flag(route, /\shref="([^"]+)"/.exec(tag)?.[1], `link rel=${/\srel="([^"]+)"/.exec(tag)?.[1]}`);
      } else {
        flag(route, match[1], kind);
      }
    }
  }
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) {
    for (const candidate of m[1].split(',')) flag(route, candidate.trim().split(/\s+/)[0], 'srcset');
  }
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
    for (const url of m[1].matchAll(/url\(\s*['"]?([^'")]+)/g)) flag(route, url[1], 'inline style url()');
    if (/@import\s+(?:url\()?['"]?https?:/i.test(m[1])) thirdParty.push(`${route}: @import in <style>`);
  }
  for (const m of html.matchAll(/\sstyle="([^"]*)"/g)) {
    for (const url of m[1].matchAll(/url\(\s*['"]?([^'")]+)/g)) flag(route, url[1], 'style attribute');
  }
}

for (const file of cssFiles) {
  const css = read(file);
  for (const url of css.matchAll(/url\(\s*['"]?([^'")]+)/g)) flag(relative(DIST, file), url[1], 'css url()');
  if (/@import\s+(?:url\()?['"]?https?:/i.test(css)) thirdParty.push(`${relative(DIST, file)}: @import`);
}

// JS is text, not markup: string literals in library error messages and SVG namespaces are not
// requests, so this looks for the constructs that actually make one.
const JS_REQUESTS = [
  /fetch\(\s*["'`]https?:/,
  /sendBeacon\(\s*["'`]https?:/,
  /importScripts\(\s*["'`]https?:/,
  /new\s+Worker\(\s*["'`]https?:/,
  /from\s*["'`]https?:\/\//,
  /import\(\s*["'`]https?:/,
];
for (const file of jsFiles) {
  const js = read(file);
  for (const pattern of JS_REQUESTS) {
    if (pattern.test(js)) thirdParty.push(`${relative(DIST, file)}: ${pattern.source}`);
  }
}

check('nothing the browser loads comes from another origin', thirdParty.length === 0, thirdParty.slice(0, 6).join(', '));

console.log(`\n${failures ? `${failures} CHECK(S) FAILED` : 'ALL CHECKS PASSED'}`);
process.exit(failures ? 1 : 0);
