// The only check here that needs the network: proves /api/font returns a real TrueType file.
// Run: node scripts/verify-proxy.mjs [base-url]
//   no argument  → calls the shared handler directly (no host needed)
//   with a URL   → calls a deployed endpoint, e.g. https://riplay.cz/api/font

import { fontResponse } from '../src/lib/font-proxy.mjs';

const base = process.argv[2];
let failures = 0;
const check = (name, condition, detail = '') => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!condition) failures += 1;
};

const call = async (query) => {
  const url = new URL(base ? `${base}?${query}` : `https://riplay.cz/api/font?${query}`);
  return base ? fetch(url) : fontResponse(url);
};

const talk = async () => {
  const paths = [
    ['family=Lobster&weight=400', 200, 'font/ttf', 'Lobster 400'],
    ['family=JetBrains+Mono&weight=700&italic=1', 200, 'font/ttf', 'JetBrains Mono 700 italic'],
    ['family=Nope+Not+A+Font&weight=400', 404, 'text/plain', 'unknown family → 404'],
    ['family=Roboto&weight=999', 400, 'text/plain', 'bad weight → 400'],
    ['family=../../etc&weight=400', 400, 'text/plain', 'path-ish family → 400'],
  ];

  for (const [query, status, type, label] of paths) {
    const response = await call(query);
    const body = await response.arrayBuffer();
    const magic = new Uint8Array(body.slice(0, 4));
    const isTtf = magic[0] === 0 && magic[1] === 1 && magic[2] === 0 && magic[3] === 0;
    const ok = response.status === status
      && (response.headers.get('content-type') ?? '').startsWith(type)
      && (status !== 200 || isTtf);
    check(label, ok, `${response.status} ${response.headers.get('content-type')} ${body.byteLength} B${status === 200 ? (isTtf ? ' TTF' : ' not TTF') : ''}`);
  }

  const cached = await call('family=Lobster&weight=400');
  check('font response is cacheable for a year', /max-age=31536000/.test(cached.headers.get('cache-control') ?? ''), cached.headers.get('cache-control') ?? '');
};

talk().then(() => {
  console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
  process.exit(failures ? 1 : 0);
}).catch((error) => {
  console.log(`FAIL  request threw: ${error.message}`);
  process.exit(1);
});
