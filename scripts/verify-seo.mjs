// Checks the built site, not the source: what a crawler would actually receive.
// Run after `npm run build`:  npm run verify:seo

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const ORIGIN = 'https://riplay.cz';

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
const pages = files.filter((f) => f.endsWith('/index.html') && !relative(DIST, f).startsWith('404'));

const read = (f) => readFileSync(f, 'utf-8');
const one = (html, re) => re.exec(html)?.[1] ?? null;
const section = (html, re) => [...html.matchAll(re)].map((m) => m[1]);

const titles = new Map();
const routes = [];

for (const file of pages) {
  const html = read(file);
  const route = '/' + relative(DIST, file).replace(/index\.html$/, '');
  routes.push(route);

  const title = one(html, /<title>([^<]+)<\/title>/);
  const desc = one(html, /<meta name="description" content="([^"]*)"/);
  const canonical = one(html, /<link rel="canonical" href="([^"]+)"/);

  check(`${route} has a title of usable length`, !!title && title.length >= 15 && title.length <= 65,
    `${title?.length ?? 0} chars: ${title ?? 'none'}`);
  check(`${route} has a description of usable length`, !!desc && desc.length >= 70 && desc.length <= 170,
    `${desc?.length ?? 0} chars`);
  check(`${route} canonical is absolute, on the domain, and slash-terminated`,
    canonical === `${ORIGIN}${route}`, `${canonical ?? 'none'}`);

  if (title) {
    if (titles.has(title)) check(`${route} title is unique`, false, `same as ${titles.get(title)}`);
    else titles.set(title, route);
  }

  // Structured data: must parse, and must not invent a fact the site does not have.
  for (const raw of section(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let node;
    try {
      node = JSON.parse(raw);
    } catch (error) {
      check(`${route} JSON-LD parses`, false, String(error));
      continue;
    }
    check(`${route} JSON-LD parses`, true);
    check(`${route} JSON-LD has @context`, node['@context'] === 'https://schema.org', String(node['@context']));

    const type = node['@type'];
    if (type === 'LocalBusiness') {
      check('LocalBusiness names the business', node.name === 'Riplay', String(node.name));
      check('LocalBusiness carries the address',
        node.address?.['@type'] === 'PostalAddress' && !!node.address?.streetAddress && !!node.address?.postalCode,
        JSON.stringify(node.address));
      check('LocalBusiness lists the three services', node.hasOfferCatalog?.itemListElement?.length === 3,
        String(node.hasOfferCatalog?.itemListElement?.length));
      // These would be rich-result-friendly and completely made up.
      check('LocalBusiness invents no phone, hours, price band or rating',
        !('telephone' in node) && !('openingHours' in node) && !('priceRange' in node) && !('aggregateRating' in node));
    }
    if (type === 'WebApplication') {
      check('WebApplication is free and marked so',
        node.offers?.price === '0' && node.isAccessibleForFree === true);
      check('WebApplication points at its own page', typeof node.url === 'string' && node.url.startsWith(ORIGIN),
        String(node.url));
    }
    if (type === 'BlogPosting') {
      check('BlogPosting is dated', /^\d{4}-\d{2}-\d{2}$/.test(String(node.datePublished)), String(node.datePublished));
      check('BlogPosting names an author', !!node.author?.name, JSON.stringify(node.author));
    }
  }
}

// Sitemap: every built page, and nothing that is not built.
const sitemapIndex = read(join(DIST, 'sitemap-index.xml'));
check('sitemap-index points at a sitemap', /<loc>[^<]*sitemap-0\.xml<\/loc>/.test(sitemapIndex));
const sitemap = read(join(DIST, 'sitemap-0.xml'));
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const missing = routes.filter((route) => !locs.includes(`${ORIGIN}${route}`));
const extra = locs.filter((loc) => !routes.some((route) => `${ORIGIN}${route}` === loc));
check('sitemap lists every built page', missing.length === 0, missing.join(', '));
check('sitemap lists nothing that is not built', extra.length === 0, extra.join(', '));
check('sitemap URLs are slash-terminated like the canonicals',
  locs.every((loc) => loc.endsWith('/')), locs.find((loc) => !loc.endsWith('/')) ?? '');

// robots.txt says where the sitemap is.
const robots = read(join(DIST, 'robots.txt'));
check('robots.txt points at the sitemap', robots.includes(`Sitemap: ${ORIGIN}/sitemap-index.xml`));
check('robots.txt does not block anything', /User-agent: \*\s*\nAllow: \//.test(robots));

console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
