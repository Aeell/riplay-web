// Clicks both sample buttons on the G-code viewer in a real headless Chromium and asserts what
// the readout shows, so a broken loader fails the build instead of shipping an empty tool.
//
//   npm run build
//   npm run verify:loader
//
// Serves dist/ itself through scripts/serve-local.mjs on a private port, so nothing else needs
// to be running. Needs Chromium: `npx playwright-core install chromium` (CI does this too).

import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = Number(process.env.VERIFY_LOADER_PORT ?? 4399);
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = `${BASE}/nastroje/vrstvy/`;

// Measured on this build, not guessed: the demo and the arc sample.
const SAMPLES = [
  { button: 'g-demo', name: 'ukázka', layers: '13', bounds: '34.80 × 24.80 mm', extrusion: '618 mm' },
  { button: 'g-demo-arcs', name: 'oblouky', layers: '2', bounds: '70.00 × 15.00 mm', extrusion: '8 mm' },
];

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

async function waitForServer(child, log) {
  for (let i = 0; i < 30; i += 1) {
    try {
      const response = await fetch(PAGE, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* not up yet */ }
    if (child.exitCode !== null) break;
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error(`no server on ${BASE}\n${log()}`);
}

const server = spawn(process.execPath, ['scripts/serve-local.mjs'], {
  env: { ...process.env, PORT_LOCAL: String(PORT), HOST_LOCAL: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk; });
server.stderr.on('data', (chunk) => { serverLog += chunk; });

let browser;
try {
  await waitForServer(server, () => serverLog);
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(PAGE);
  const readout = () => page.evaluate(() => ({
    layers: document.getElementById('r-layers')?.textContent ?? '',
    bounds: document.getElementById('r-bounds')?.textContent ?? '',
    extrusion: document.getElementById('r-extrusion')?.textContent ?? '',
    error: document.getElementById('g-error')?.textContent ?? '',
  }));

  for (const sample of SAMPLES) {
    await page.click(`#${sample.button}`);
    // Wait for this sample's own extrusion value; the previous sample leaves its values behind.
    await page.waitForFunction(
      (expected) => document.getElementById('r-extrusion')?.textContent === expected,
      sample.extrusion,
      { timeout: 15000 },
    ).catch(() => {});
    const got = await readout();
    check(`${sample.name}: vrstev = ${sample.layers}`, got.layers === sample.layers, `got "${got.layers}"`);
    check(`${sample.name}: půdorys = ${sample.bounds}`, got.bounds === sample.bounds, `got "${got.bounds}"`);
    check(`${sample.name}: extruze = ${sample.extrusion}`, got.extrusion === sample.extrusion, `got "${got.extrusion}"`);
    check(`${sample.name}: bez chyby`, got.error === '', got.error);
  }

  check('no uncaught page errors', errors.length === 0, errors.join(' | '));
} catch (error) {
  console.log(`FAIL  ${error.message.split('\n')[0]}`);
  if (/Executable doesn't exist/.test(error.message)) {
    console.log('      Chromium is not installed for this playwright-core version.');
    console.log('      Install it with: npx playwright-core install chromium  (add --with-deps on CI)');
  }
  failures += 1;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}

if (failures) {
  console.log(`\n${failures} loader check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nloader checks passed');
}
