// Proves the build runs on Cloudflare's own runtime before any DNS exists.
//
//   npm run build
//   npm run preview:pages        # wrangler pages dev dist --port 8788, in another terminal
//   npm run verify:pages         # this file; optionally pass a base URL
//
// Everything here is asserted against workerd serving dist/ with the real Pages routing:
// `public/_routes.json` decides that only /api/* reaches the Function, `public/_headers`
// decides the cache and security headers, and `functions/api/font.js` is bundled from
// source. A static server with a hand-written /api/font handler would pass none of this.

const base = process.argv[2] ?? 'http://127.0.0.1:8788';
const ORIGIN = 'https://riplay.cz';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const get = async (path) => {
  try {
    const response = await fetch(new URL(path, base), { redirect: 'manual' });
    return { response, body: await response.arrayBuffer() };
  } catch (error) {
    console.log(`FAIL  ${path} — ${error.message}`);
    console.log(`\nNothing on ${base}. Start \`npm run preview:pages\` first.\n`);
    process.exit(1);
  }
};

const header = (response, name) => response.headers.get(name) ?? '';

const talk = async () => {
  const home = await get('/');
  check('/ serves HTML', home.response.status === 200 && header(home.response, 'content-type').startsWith('text/html'),
    `${home.response.status} ${header(home.response, 'content-type')}`);
  const html = new TextDecoder().decode(home.body);
  check('the home page is the real page, not an error shell',
    html.includes('CNC frézování a 3D tisk na zakázku'), `${html.length} bytes`);

  // netlify.toml states these three; the move must not drop them.
  check('security headers arrive from _headers',
    header(home.response, 'x-content-type-options') === 'nosniff'
      && header(home.response, 'referrer-policy') === 'strict-origin-when-cross-origin'
      && header(home.response, 'x-frame-options') === 'DENY',
    ['x-content-type-options', 'referrer-policy', 'x-frame-options'].map((h) => header(home.response, h)).join(' / '));
  check('HTML is never cached', /max-age=0/.test(header(home.response, 'cache-control')),
    header(home.response, 'cache-control') || '(none)');

  const asset = /\/_astro\/[^"']+\.(?:css|js)/.exec(html)?.[0];
  if (asset) {
    const css = await get(asset);
    check('fingerprinted asset is served immutable', css.response.status === 200
      && /max-age=31536000/.test(header(css.response, 'cache-control'))
      && header(css.response, 'cache-control').includes('immutable'),
      header(css.response, 'cache-control') || '(none)');
  } else {
    check('fingerprinted asset found in the HTML', false, 'no /_astro/ link');
  }

  // Directory URLs are what the canonicals and the sitemap promise.
  const page = await get('/nastroje/vrstvy/');
  check('a nested page is served at its canonical URL', page.response.status === 200
    && header(page.response, 'content-type').startsWith('text/html'), String(page.response.status));
  const bare = await get('/nastroje/vrstvy');
  check('the slashless URL redirects to the canonical one',
    [301, 308].includes(bare.response.status) && (header(bare.response, 'location') ?? '').endsWith('/nastroje/vrstvy/'),
    `${bare.response.status} → ${header(bare.response, 'location')}`);

  for (const [path, type] of [['/robots.txt', 'text/plain'], ['/sitemap-index.xml', 'xml'], ['/sitemap-0.xml', 'xml']]) {
    const file = await get(path);
    check(`${path} is served`, file.response.status === 200 && header(file.response, 'content-type').includes(type),
      `${file.response.status} ${header(file.response, 'content-type')}`);
  }

  // The Function, bundled by Pages from functions/api/font.js — this is the only dynamic route.
  const font = await get('/api/font?family=Lobster&weight=400');
  const magic = new Uint8Array(font.body.slice(0, 4));
  const isTtf = magic[0] === 0 && magic[1] === 1 && magic[2] === 0 && magic[3] === 0;
  check('/api/font returns a real TrueType file', font.response.status === 200
    && header(font.response, 'content-type').startsWith('font/ttf') && isTtf,
    `${font.response.status} ${header(font.response, 'content-type')} ${font.body.byteLength} B${isTtf ? ' TTF' : ' not TTF'}`);
  check('/api/font is cacheable for a year', /max-age=31536000/.test(header(font.response, 'cache-control')),
    header(font.response, 'cache-control') || '(none)');

  const guarded = await get('/api/font?family=../../etc&weight=400');
  check('the family guard survives bundling', guarded.response.status === 400, String(guarded.response.status));
  const unknown = await get('/api/font?family=Nope+Not+A+Font&weight=400');
  check('an unknown family is still a 404', unknown.response.status === 404, String(unknown.response.status));

  // The reason src/pages/404.astro exists: without a top-level 404.html, Pages treats the build
  // as an SPA and answers 200 + the homepage for every unknown URL. This is that switch, tested
  // on Pages' own runtime rather than assumed from the docs.
  const missing = await get('/definitely-not-a-page');
  const missingBody = new TextDecoder().decode(missing.body);
  check('an unknown URL is a 404, not a soft 200 of the homepage',
    missing.response.status === 404, String(missing.response.status));
  check("the 404 is the site’s own page", missingBody.includes('Na tuhle adresu se nedá'), `${missingBody.length} bytes`);

  // The canonical must name the domain the site will live on, not the pages.dev host.
  check('canonical still points at riplay.cz, not pages.dev',
    html.includes(`<link rel="canonical" href="${ORIGIN}/"`), 'home page');
};

await talk();
console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
