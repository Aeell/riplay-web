// Every check in this repository, in the order that makes failures easy to read.
//
//   npm run verify:all
//
// Build first (the SEO and Pages verifiers read dist/), then the offline verifiers, then the
// Pages runtime check — for which this file starts and stops `wrangler pages dev` itself, so the
// command works on a machine where nothing is running — and the one network-dependent check last,
// so a flaky third party cannot hide a real failure behind it.
//
// Exits non-zero on the first failure. GitHub Actions runs exactly this; so should you.

import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PAGES_PORT = Number(process.env.VERIFY_PAGES_PORT ?? 8788);
const PAGES_BASE = `http://127.0.0.1:${PAGES_PORT}`;

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const step = (name) => console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 60 - name.length))}`);

const run = (name, args) => {
  step(name);
  const started = Date.now();
  const result = spawnSync(npm, args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${name} failed (exit ${result.status ?? result.signal})`);
  return Date.now() - started;
};

async function reachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

/** Starts the Pages dev server unless something already answers on its port. */
async function startPages() {
  if (await reachable(`${PAGES_BASE}/`)) {
    console.log(`using the Pages dev server already answering on ${PAGES_BASE}`);
    return null;
  }

  // The local binary, not `npx`: no resolution and no registry lookup in CI.
  const wrangler = process.platform === 'win32'
    ? 'node_modules\\.bin\\wrangler.cmd'
    : 'node_modules/.bin/wrangler';
  const child = spawn(
    wrangler,
    ['pages', 'dev', 'dist', '--port', String(PAGES_PORT), '--ip', '127.0.0.1'],
    { stdio: ['ignore', 'pipe', 'pipe'], detached: true },
  );
  let log = '';
  const collect = (chunk) => { log += chunk.toString(); };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);

  for (let i = 0; i < 60; i += 1) {
    if (await reachable(`${PAGES_BASE}/`)) return child;
    if (child.exitCode !== null) break;
    await sleep(1000);
  }
  log && console.log(log.split('\n').slice(-15).join('\n'));
  await stopPages(child);
  throw new Error(`wrangler pages dev did not answer on ${PAGES_BASE}`);
}

async function stopPages(child) {
  if (!child?.pid) return;
  // wrangler starts workerd as a child, so the group is what has to go — and it has to be waited
  // for: a server left listening makes the next run reuse a stale build instead of starting one.
  const signal = (name) => {
    try { process.kill(-child.pid, name); } catch { try { child.kill(name); } catch { /* gone */ } }
  };
  signal('SIGTERM');
  for (let i = 0; i < 30; i += 1) {
    if (!(await reachable(`${PAGES_BASE}/`))) return;
    await sleep(100);
  }
  signal('SIGKILL');
}

const timings = [];
try {
  timings.push(['build', run('build (dist/)', ['run', 'build'])]);
  for (const name of ['mesh', 'font', 'paths', 'gcode', 'seo', 'site']) {
    timings.push([`verify:${name}`, run(`verify:${name}`, ['run', '-s', `verify:${name}`])]);
  }

  step('verify:pages (workerd)');
  const pagesStarted = Date.now();
  const server = await startPages();
  try {
    const result = spawnSync(process.execPath, ['scripts/verify-pages.mjs', PAGES_BASE], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error('verify:pages failed');
    timings.push(['verify:pages', Date.now() - pagesStarted]);
  } finally {
    await stopPages(server);
  }

  // The only check that needs the internet: Google's font CSS and the .ttf behind it.
  timings.push(['verify:proxy', run('verify:proxy (network)', ['run', '-s', 'verify:proxy'])]);

  step('summary');
  for (const [name, ms] of timings) console.log(`  ok  ${name.padEnd(18)} ${(ms / 1000).toFixed(1)}s`);
  console.log('\nALL CHECKS PASSED');
} catch (error) {
  // process.exit here would skip the finally that stops workerd, so set the status and return.
  console.log(`\nFAILED: ${error.message}`);
  process.exitCode = 1;
}
