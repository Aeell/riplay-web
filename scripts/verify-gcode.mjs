// Verifies the G-code reader on a hand-written file whose every number is known.
// Run: npm run verify:gcode

import { parseGcode } from '../src/lib/gcode.mjs';

let failures = 0;
const check = (name, condition, detail = '') => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!condition) failures += 1;
};

const file = [
  ';LAYER 0',
  'G0 X0 Y0 Z0.2',
  ';Shell',
  'G1 X10 Y0 U0.1',
  'G1 X10 Y10 U0.2',
  ';Internal Infill',
  'G1 X0 Y5 U0.3',
  'G1 X10 Y5 U0.4',
  ';LAYER 1',
  'G0 X0 Y0 Z0.4',
  ';Shell',
  'G1 X0 Y0 U0.5',
  'G1 X20 Y0 U0.6',
  'G1 X20 Y10 U0.7',
].join('\n');

const { layers, bounds, stats } = parseGcode(file);

check('two layers', stats.layers === 2, `got ${stats.layers}`);
check('layer heights are the written Z', layers[0].z === 0.2 && layers[1].z === 0.4, `${layers[0]?.z} / ${layers[1]?.z}`);
check('perimeter paths classified from ;Shell', stats.perimeterPaths === 2, `got ${stats.perimeterPaths}`);
check('infill path classified from ;Internal Infill', stats.infillPaths === 1, `got ${stats.infillPaths}`);
check('travel counted but never drawn', stats.travelMoves === 2 && layers.every((l) => l.paths.every((p) => p.pts.length > 1)));

check('bounds span the extruded geometry only', bounds?.width === 20 && bounds?.height === 10, `${bounds?.width} × ${bounds?.height}`);
check('bounds start at the lowest extruded point', bounds?.minX === 0 && bounds?.minY === 0, `${bounds?.minX}, ${bounds?.minY}`);
check('U counts as extrusion', stats.extrusion > 0 && stats.perimeterPaths > 0);

const relative = parseGcode(['G91', 'G1 X5 Y5 U1'].join('\n'));
check('G91 is reported, not silently mis-plotted', relative.stats.unsupported.some((u) => u.startsWith('G91')));

const arcs = parseGcode(['G1 X1 Y1 U0.1', 'G2 X5 Y5 I2 J0 U0.2'].join('\n'));
check('G2 is counted and reported', arcs.stats.arcs === 1 && arcs.stats.unsupported.some((u) => u.startsWith('G2')));

const plain = parseGcode(['G0 X0 Y0 Z0.2', 'G1 X5 Y0 E1', 'G1 X5 Y5 E2'].join('\n'));
check('a file without markers still renders', plain.layers.length === 1 && plain.layers[0].paths.length === 1);

// The real trap: z-hop lifts Z inside a layer. Only a rising *envelope* may start a layer.
const hop = parseGcode([
  'G0 X0 Y0 Z0.2', 'G1 X2 Y0 E1', 'G1 X5 Y0 E2',
  'G0 Z0.6', 'G1 X5 Y5 E3', 'G1 X0 Y5 E4',   // hop up, still the same layer
].join('\n'));
// Without markers this is a known approximation, and the parser reports which source it used so
// the page can say it: a hop upward does look like a new layer in a marker-less file.
check('marker-less files say they are approximate', hop.stats.layerSource === 'z');
check('a hop does not lose toolpaths', hop.layers.reduce((n, l) => n + l.paths.length, 0) === 2,
  `${hop.layers.reduce((n, l) => n + l.paths.length, 0)} paths in ${hop.layers.length} layers`);
check('single-point moves are not paths', hop.layers.every((l) => l.paths.every((p) => p.pts.length > 1)));

// A toolpath that is one move long is still a toolpath, and it starts where the nozzle was.
const single = parseGcode([';LAYER 0', 'G0 X0 Y0 Z0.2', 'G1 X5 Y0 E1'].join('\n'));
check('a one-move path is kept', single.layers[0]?.paths.length === 1, `${single.layers[0]?.paths.length}`);
check(
  'a path starts where the move started',
  single.layers[0]?.paths[0]?.pts[0].x === 0 && single.layers[0]?.paths[0]?.pts[1].x === 5,
  JSON.stringify(single.layers[0]?.paths[0]?.pts),
);

const noToolpath = parseGcode([
  'G0 Z30', ';LAYER 0', 'G0 X0 Y0 Z0.3', 'G0 Z0.6',
  'G1 X5 Y0 E1', 'G1 X5 Y5 E2',   // a real path, so the layer is drawable
  ';LAYER 1', ';END',             // this layer has no toolpath and must disappear
].join('\n'));
check('layers without a toolpath are dropped', noToolpath.layers.length === 1, `got ${noToolpath.layers.length}`);
check('a hop before the first toolpath does not raise the layer', noToolpath.layers[0]?.z === 0.3, `${noToolpath.layers[0]?.z}`);

const huge = parseGcode(['G1 X1 Y1 E1', 'G1 X2 Y2 E2', 'G1 X3 Y3 E3'].join('\n'), { maxLines: 2 });
check('the line ceiling stops a runaway file', huge.stats.truncated === true, `lines ${huge.stats.lines}`);

const empty = parseGcode('');
check('an empty file does not throw', empty.layers.length === 0 && empty.bounds === null);

console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
