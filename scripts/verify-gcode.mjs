// Verifies the G-code reader on hand-written files whose every number is known.
// Run: npm run verify:gcode

import { parseGcode } from '../src/lib/gcode.mjs';

let failures = 0;
const check = (name, condition, detail = '') => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!condition) failures += 1;
};
const kinds = (layer) => layer.paths.map((p) => p.kind);
const pathCount = (result) => result.layers.reduce((n, l) => n + l.paths.length, 0);

// ---------------------------------------------------------------- the plain file
const base = parseGcode([
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
].join('\n'));

check('two layers', base.stats.layers === 2, `got ${base.stats.layers}`);
check('layer heights are the written Z', base.layers[0].z === 0.2 && base.layers[1].z === 0.4,
  `${base.layers[0]?.z} / ${base.layers[1]?.z}`);
check(';Shell becomes perimeters', kinds(base.layers[0])[0] === 'perimeter', kinds(base.layers[0]).join(','));
check(';Internal Infill becomes infill', kinds(base.layers[0]).includes('infill'), kinds(base.layers[0]).join(','));
check('travel is never drawn', pathCount(base) === 3, `${pathCount(base)} paths`);
check('bounds span the extruded geometry only', base.bounds?.width === 20 && base.bounds?.height === 10,
  `${base.bounds?.width} × ${base.bounds?.height}`);
check('bounds start at the lowest extruded point', base.bounds?.minX === 0 && base.bounds?.minY === 0,
  `${base.bounds?.minX}, ${base.bounds?.minY}`);
check('U is read as filament when it is the only extruder axis', Math.abs(base.stats.extrusion - 0.7) < 1e-9,
  `${base.stats.extrusion}`);

// ---------------------------------------------------------------- coordinate modes
const relative = parseGcode([';LAYER 0', 'G0 X0 Y0 Z0.2', 'G91', 'M83', 'G1 X5 Y0 E0.5', 'G1 X0 Y5 E0.5'].join('\n'));
check('G91 relative moves are drawn where they land',
  relative.layers[0]?.paths[0]?.pts.at(-1).x === 5 && relative.layers[0]?.paths[0]?.pts.at(-1).y === 5,
  JSON.stringify(relative.layers[0]?.paths[0]?.pts.at(-1)));
check('G91 is not reported as unsupported', !relative.stats.unsupported.some((u) => u.startsWith('G91')));

const relativeZ = parseGcode(['G91', 'M83', 'G1 X5 Y0 Z0.2 E1', 'G1 X5 Y0 Z0.2 E1'].join('\n'));
check('relative Z stacks layers', relativeZ.stats.layers === 2, `${relativeZ.stats.layers}`);

const m83 = parseGcode([';LAYER 0', 'G0 X0 Y0 Z0.2', 'M83', 'G1 X5 Y0 E0.5', 'G1 X5 Y5 E0.5'].join('\n'));
check('M83 relative extrusion is summed', Math.abs(m83.stats.extrusion - 1) < 1e-9, `${m83.stats.extrusion}`);
check('M83 paths stay one path', pathCount(m83) === 1, `${pathCount(m83)}`);

const m82 = parseGcode(['M83', 'G1 X5 Y0 E0.5', 'M82', 'G1 X5 Y5 E3', 'G1 X10 Y5 E4'].join('\n'));
check('M82 switches back to absolute without a spike', Math.abs(m82.stats.extrusion - 1.5) < 1e-9,
  `${m82.stats.extrusion}`);

const reset = parseGcode(['G92 E0', 'G1 X5 Y0 E0', 'G1 X10 Y0 E1', 'G92 E0', 'G1 X10 Y5 E1'].join('\n'));
check('G92 E0 resets the counter instead of adding a spike', Math.abs(reset.stats.extrusion - 2) < 1e-9,
  `${reset.stats.extrusion}`);

// ---------------------------------------------------------------- retraction, tools, axes
const retract = parseGcode([
  ';LAYER 0', 'G0 X0 Y0 Z0.2',
  'G1 X5 Y0 E1',
  'G1 E-0.8',       // retract, no move
  'G0 X10 Y0',      // travel while retracted
  'G1 E0.8',        // unretract, no move
  'G1 X10 Y5 E1.8',
].join('\n'));
check('retract and unretract add no filament', Math.abs(retract.stats.extrusion - 2) < 1e-9, `${retract.stats.extrusion}`);
check('retract and unretract draw nothing', pathCount(retract) === 2, `${pathCount(retract)}`);

const movingRetract = parseGcode(['G1 X5 Y0 E1', 'G1 X10 Y5 E-2'].join('\n'));
check('a retracting move is travel, not a toolpath', pathCount(movingRetract) === 1, `${pathCount(movingRetract)}`);

const tool = parseGcode(['T0', 'G1 X5 Y0 E1000', 'T1', 'G1 X5 Y5 E1'].join('\n'));
check('a tool change does not add a spool of filament', Math.abs(tool.stats.extrusion - 1000) < 1e-9,
  `${tool.stats.extrusion}`);

const fourthAxis = parseGcode(['G1 X5 Y0 E1 U50', 'G1 X5 Y5 E2 U60'].join('\n'));
check('U is a fourth axis when the file also uses E', Math.abs(fourthAxis.stats.extrusion - 2) < 1e-9,
  `${fourthAxis.stats.extrusion}`);

// ---------------------------------------------------------------- arcs and markers
const arcs = parseGcode(['G1 X1 Y1 E0.1', 'G2 X5 Y5 I2 J0 E0.2'].join('\n'));
check('G2 is counted and reported', arcs.stats.arcs === 1 && arcs.stats.unsupported.some((u) => u.startsWith('G2')));

const plain = parseGcode(['G0 X0 Y0 Z0.2', 'G1 X5 Y0 E1', 'G1 X5 Y5 E2'].join('\n'));
check('a file without markers still renders', plain.layers.length === 1 && plain.layers[0].paths.length === 1);

// The real trap: z-hop lifts Z inside a layer, so only a rising envelope may start one.
const hop = parseGcode([
  'G0 X0 Y0 Z0.2', 'G1 X2 Y0 E1', 'G1 X5 Y0 E2',
  'G0 Z0.6', 'G1 X5 Y5 E3', 'G1 X0 Y5 E4',
].join('\n'));
check('marker-less files say they are approximate', hop.stats.layerSource === 'z');
check('a hop does not lose toolpaths', pathCount(hop) === 2, `${pathCount(hop)} paths`);

const single = parseGcode([';LAYER 0', 'G0 X0 Y0 Z0.2', 'G1 X5 Y0 E1'].join('\n'));
check('a one-move path is kept', single.layers[0]?.paths.length === 1, `${single.layers[0]?.paths.length}`);
check('a path starts where the move started',
  single.layers[0]?.paths[0]?.pts[0].x === 0 && single.layers[0]?.paths[0]?.pts[1].x === 5,
  JSON.stringify(single.layers[0]?.paths[0]?.pts));

const noToolpath = parseGcode([
  'G0 Z30', ';LAYER 0', 'G0 X0 Y0 Z0.3', 'G0 Z0.6',
  'G1 X5 Y0 E1', 'G1 X5 Y5 E2',
  ';LAYER 1', ';END',
].join('\n'));
check('layers without a toolpath are dropped', noToolpath.layers.length === 1, `got ${noToolpath.layers.length}`);
check('a hop before the first toolpath does not raise the layer', noToolpath.layers[0]?.z === 0.3,
  `${noToolpath.layers[0]?.z}`);

// ---------------------------------------------------------------- limits
const huge = parseGcode(['G1 X1 Y1 E1', 'G1 X2 Y2 E2', 'G1 X3 Y3 E3'].join('\n'), { maxLines: 2 });
check('the line ceiling stops a runaway file', huge.stats.truncated === true, `lines ${huge.stats.lines}`);

const empty = parseGcode('');
check('an empty file does not throw', empty.layers.length === 0 && empty.bounds === null);

console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
