#!/usr/bin/env node
/**
 * Builds the reduced toolpath sample the homepage Replay draws.
 *
 * It is real geometry from a real slice, not a drawing of one: script parses a .gcode with the
 * same reader the toolbox uses (src/lib/gcode.mjs) and keeps a spread of its layers, with each
 * path decimated to a step and rounded to 0.1 mm. Both reductions are recorded in the file and
 * stated on the page, because a picture that claims to be "the toolpath" and is really a sketch
 * would break the one rule this site has.
 *
 *   node scripts/build-replay-sample.mjs [input.gcode] [layerCount] [step_mm]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { parseGcode } from '../src/lib/gcode.mjs';

const [, , input = '/tmp/pipe.gcode', countArg = '16', stepArg = '0.35'] = process.argv;
const layerCount = Number(countArg);
const step = Number(stepArg);

const parsed = parseGcode(readFileSync(input, 'utf8'));
if (!parsed.layers.length) {
  console.error(`${input}: no toolpaths`);
  process.exit(1);
}

const round = (n) => Math.round(n * 10) / 10; // 0.1 mm — finer than any nozzle
const decimate = (pts) => {
  const out = [pts[0]];
  let last = pts[0];
  for (const p of pts.slice(1, -1)) {
    if (Math.hypot(p.x - last.x, p.y - last.y) >= step) {
      out.push(p);
      last = p;
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

const total = parsed.layers.length;
const picks = Array.from({ length: Math.min(layerCount, total) }, (_, i) =>
  Math.round((i * (total - 1)) / Math.max(1, Math.min(layerCount, total) - 1)),
);
const unique = [...new Set(picks)].sort((a, b) => a - b);

const layers = unique.map((index) => {
  const layer = parsed.layers[index];
  return {
    z: round(layer.z),
    paths: layer.paths.map((path) => ({
      k: path.kind === 'perimeter' ? 'p' : 'i',
      pts: decimate(path.pts).flatMap((p) => [round(p.x), round(p.y)]),
    })),
  };
});

const out = {
  note: 'Skutečné dráhy z řezu tímto strojem, zjednodušené na každých 0,1 mm a rozložené přes vrstvy.',
  source: input.split('/').pop(),
  slojuCelkem: total,
  krok: step,
  layers,
};

// public/, not src/: this must load only when someone reaches the print stage, never as
// part of the homepage bundle.
const path = new URL('../public/vrstvy/vzor.json', import.meta.url);
const json = JSON.stringify(out);
writeFileSync(path, json + '\n');

const points = layers.reduce((n, l) => n + l.paths.reduce((m, p) => m + p.pts.length / 2, 0), 0);
console.log(
  `  ${out.source}: ${total} layers → ${layers.length} kept, ${points} points, ` +
    `${(json.length / 1024).toFixed(1)} KB raw / ${(gzipSync(json).length / 1024).toFixed(1)} KB gz`,
);
