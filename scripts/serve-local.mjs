// `astro preview` serves static files only, so the font picker's /api/font would 404.
// This serves dist/ and runs the Netlify Function in the same process — a local stand-in
// for `netlify dev`, with no CLI and no extra dependency.
//
//   npm run preview:full   →   http://127.0.0.1:4331

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../dist', import.meta.url));
const PORT = Number(process.env.PORT_LOCAL ?? 4331);
const HOST = process.env.HOST_LOCAL ?? '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
};

const { default: font } = await import('../netlify/functions/font.mjs');

async function file(path) {
  try {
    const info = await stat(path);
    return info.isFile() ? path : null;
  } catch {
    return null;
  }
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === '/api/font') {
    const result = await font(new Request(url.href));
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
    return;
  }

  const path = join(ROOT, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''));
  const candidates = [path, join(path, 'index.html'), `${path}.html`, `${path.replace(/\/$/, '')}.html`];

  for (const candidate of candidates) {
    const found = await file(candidate);
    if (found) {
      response.writeHead(200, {
        'content-type': TYPES[extname(found)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(await readFile(found));
      return;
    }
  }

  response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
  response.end('<!doctype html><title>404</title><p>V dist/ není. Spusť <code>npm run build</code>.');
}).listen(PORT, HOST, () => {
  console.log(`riplay local preview on http://${HOST}:${PORT} (static + /api/font)`);
});
