// Verifies the G-code reader on hand-written files whose every number is known.
// Run: npm run verify:gcode

import { readFileSync } from 'node:fs';
import { ARC_MAX_SEGMENTS, ARC_TOLERANCE_MM, parseGcode } from '../src/lib/gcode.mjs';

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

// ---------------------------------------------------------------- arcs, planes, units
const sagitta = (pts, cu, cv) => {
  let worst = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    const r = Math.hypot(pts[i].x - cu, pts[i].y - cv);
    worst = Math.max(worst, r - Math.hypot(mx - cu, my - cv));
  }
  return worst;
};

// Quarter circle, radius 10, centre at the origin, CCW from (10,0) to (0,10).
const quarter = parseGcode(['G0 X10 Y0 Z0.2', 'G3 X0 Y10 I-10 J0 E1'].join('\n'));
const qPts = quarter.layers[0]?.paths[0]?.pts ?? [];
check('G3 is drawn as a curve, not as its chord', qPts.length > 5, `${qPts.length} points`);
check('every arc point sits on the circle it names',
  qPts.length > 2 && qPts.every((p) => Math.abs(Math.hypot(p.x, p.y) - 10) < 1e-6),
  qPts.slice(0, 3).map((p) => Math.hypot(p.x, p.y).toFixed(4)).join(' '));
check('no chord is further from the arc than the stated tolerance',
  sagitta(qPts, 0, 0) <= ARC_TOLERANCE_MM + 1e-9, `${sagitta(qPts, 0, 0).toFixed(5)} mm`);
check('the arc goes through the quarter point, not around it',
  Math.min(...qPts.map((p) => Math.hypot(p.x - 10 / Math.sqrt(2), p.y - 10 / Math.sqrt(2)))) < 0.8,
  `${Math.min(...qPts.map((p) => Math.hypot(p.x - 10 / Math.sqrt(2), p.y - 10 / Math.sqrt(2)))).toFixed(3)} mm from 45°`);
check('the arc ends exactly where the file says', qPts.at(-1)?.x === 0 && qPts.at(-1)?.y === 10,
  JSON.stringify(qPts.at(-1)));
check('bounds follow the drawn arc', quarter.bounds?.width === 10 && quarter.bounds?.height === 10,
  `${quarter.bounds?.width} × ${quarter.bounds?.height}`);
check('G2/G3 is no longer reported as lossy', !quarter.stats.unsupported.some((u) => u.startsWith('G2/G3 je')));
check('the tolerance is on the stats', quarter.stats.arcTolerance === ARC_TOLERANCE_MM, `${quarter.stats.arcTolerance}`);

// Full circle: start == end, centre from I/J.
const circle = parseGcode(['G2 I5 J0 E1'].join('\n'));
check('a full circle closes on itself',
  Math.abs(circle.bounds.width - 10) < 1e-6 && Math.abs(circle.bounds.height - 10) < 1e-6
  && circle.bounds.minY < -4.99, `${circle.bounds.width} × ${circle.bounds.height}, minY ${circle.bounds.minY}`);

// R form: positive is the minor arc, negative the major one. Chord 10, R 6 → the minor arc rises
// R−√(R²−(chord/2)²) = 2.683 above the chord, the major one 9.317.
const SAGITTA_MINOR = 6 - Math.sqrt(36 - 25);
const SAGITTA_MAJOR = 6 + Math.sqrt(36 - 25);
const minor = parseGcode(['G3 X10 Y0 R6 E1'].join('\n'));
check('R>0 is the minor arc', Math.abs(minor.bounds.height - SAGITTA_MINOR) < 0.05,
  `height ${minor.bounds.height.toFixed(3)} mm, expected ${SAGITTA_MINOR.toFixed(3)}`);
const major = parseGcode(['G3 X10 Y0 R-6 E1'].join('\n'));
check('R<0 is the major arc', Math.abs(major.bounds.height - SAGITTA_MAJOR) < 0.05,
  `height ${major.bounds.height.toFixed(3)} mm, expected ${SAGITTA_MAJOR.toFixed(3)}`);
const impossible = parseGcode(['G3 X10 Y0 R2 E1'].join('\n'));
check('an R shorter than the chord is a line, and says so',
  impossible.layers[0]?.paths[0]?.pts.length === 2
  && impossible.stats.unsupported.some((u) => u.includes('R, které oblouk neurčuje')),
  `${impossible.layers[0]?.paths[0]?.pts.length} pts`);

// Tightening the tolerance must add segments, and the chord error must follow it.
const coarse = parseGcode(['G2 I50 J0 E1'].join('\n'));
const fine = parseGcode(['G2 I50 J0 E1'].join('\n'), { tolerance: 0.002 });
check('a tighter tolerance buys more segments',
  fine.stats.arcSegments > coarse.stats.arcSegments,
  `${coarse.stats.arcSegments} → ${fine.stats.arcSegments}`);
check('the drawn curve honours the tighter tolerance too',
  sagitta(fine.layers[0].paths[0].pts, 50, 0) <= 0.002 + 1e-9,
  `${sagitta(fine.layers[0].paths[0].pts, 50, 0).toFixed(6)} mm`);

// Inches: every coordinate, including the arc centre, is scaled once.
const inches = parseGcode([
  'G20', 'G0 X0 Y0 Z0.008', 'G1 X1 Y0 E0.1', 'G1 X1 Y1 E0.2',
].join('\n'));
check('G20 scales coordinates to millimetres',
  Math.abs(inches.bounds.width - 25.4) < 1e-6 && Math.abs(inches.bounds.height - 25.4) < 1e-6,
  `${inches.bounds.width} × ${inches.bounds.height}`);
check('G20 is disclosed, not silent', inches.stats.unsupported.some((u) => u.startsWith('G20')));
const inchArc = parseGcode(['G20', 'G3 X0 Y0.4 I0 J0.2 E1'].join('\n'));
check('an arc in inches keeps its millimetre size',
  Math.abs(inchArc.bounds.width - 5.08) < 1e-6 && Math.abs(inchArc.bounds.height - 10.16) < 1e-6,
  `${inchArc.bounds.width} × ${inchArc.bounds.height} mm (r = 0.2 in = 5.08 mm)`);

// Out-of-plane arcs: interpreted in their own plane, drawn as the XY projection, and said so.
const xz = parseGcode(['G18', 'G0 X0 Z0 Y5', 'G2 X10 Z0 I5 K0 E1'].join('\n'));
check('G18 arcs are read in (Z, X)',
  Math.abs(xz.bounds.width - 10) < 1e-6 && Math.abs(xz.bounds.height) < 1e-6,
  `${xz.bounds.width} × ${xz.bounds.height}`);
check('G18 is disclosed', xz.stats.unsupported.some((u) => u.startsWith('G18/G19')));
const yz = parseGcode(['G19', 'G0 X3 Y0 Z0', 'G3 Y10 Z0 J5 K0 E1'].join('\n'));
check('G19 arcs are read in (Y, Z)',
  Math.abs(yz.bounds.width) < 1e-6 && Math.abs(yz.bounds.height - 10) < 1e-6,
  `${yz.bounds.width} × ${yz.bounds.height}`);

// The endpoint is computed once: an arc under G91 must land where the same words move the path.
const relArc = parseGcode(['G0 X10 Y0 Z0.2', 'G91', 'G3 X-10 Y10 I-10 J0 E1'].join('\n'));
check('a relative arc lands where the relative move lands',
  relArc.layers[0]?.paths[0]?.pts.at(-1).x === 0 && relArc.layers[0]?.paths[0]?.pts.at(-1).y === 10,
  JSON.stringify(relArc.layers[0]?.paths[0]?.pts.at(-1)));

// An arc with no centre and an R that cannot define one are each named for what they are.
const noCentre = parseGcode(['G2 X10 Y0 E1'].join('\n'));
check('an arc with no centre says so',
  noCentre.stats.unsupported.some((u) => u.includes('bez středu')),
  noCentre.stats.unsupported.join(' · '));
const rCircle = parseGcode(['G2 X0 Y0 R5 E1'].join('\n'));
check('an R with no chord says R cannot define it',
  rCircle.stats.unsupported.some((u) => u.includes('R, které oblouk neurčuje')));

// The segment ceiling is disclosed with the deviation it causes, never silent.
const capped = parseGcode(['G2 I100000 J0 E1'].join('\n'));
check('the segment ceiling is disclosed, with the deviation it caused',
  capped.stats.arcSegments === ARC_MAX_SEGMENTS
  && capped.stats.unsupported.some((u) => u.includes('zjednodušený')),
  `${capped.stats.arcSegments} segments · ${capped.stats.unsupported.join(' · ')}`);
check('a tolerance that is not a positive number falls back to the stated one',
  parseGcode(['G2 I5 J0 E1'].join('\n'), { tolerance: 0 }).stats.arcTolerance === ARC_TOLERANCE_MM);

// G92 sets a position; it is not a move, in either distance mode.
const g92Relative = parseGcode(['G91', 'G92 X10 Y0', 'G1 X5 Y0 E1'].join('\n'));
check('G92 under G91 does not also move',
  g92Relative.layers[0]?.paths[0]?.pts.at(-1).x === 15,
  `${g92Relative.layers[0]?.paths[0]?.pts.at(-1).x}`);

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

// ---------------------------------------------------------------- the sample the page ships
// The page states this file's geometry, so the file and the page are checked together: an edit to
// one that leaves the other describing something else fails here.
const sample = parseGcode(readFileSync(new URL('../public/vrstvy/oblouky.gcode', import.meta.url), 'utf8'));
check('the shipped arc sample has two 0.3 mm layers',
  sample.stats.layers === 2 && sample.layers[0].z === 0.3 && sample.layers[1].z === 0.6,
  sample.layers.map((l) => l.z).join(' / '));
check('the shipped arc sample draws six paths, none of them as a chord',
  pathCount(sample) === 6
  && sample.layers.every((layer) => layer.paths.every((path) => path.pts.length > 2)),
  `${pathCount(sample)} paths, ${sample.stats.arcs} arcs`);
check('the shipped arc sample reads without caveats', sample.stats.unsupported.length === 0,
  sample.stats.unsupported.join(' · '));
check('the shipped arc sample has the 70 × 15 mm footprint the page states',
  sample.bounds.width === 70 && sample.bounds.height === 15,
  `${sample.bounds.width} × ${sample.bounds.height}`);

const CIRCLES = [
  [10, 0, 10], [40, 0, 5], [60, 10, 10],
  [10, 0, 9.5], [40, 0, 4.5], [60, 10, 9.5],
];
check('every point in the shipped sample lies on the circle the page names',
  sample.layers.flatMap((layer) => layer.paths).every((path, i) => {
    const [cu, cv, r] = CIRCLES[i];
    return path.pts.every((pt) => Math.abs(Math.hypot(pt.x - cu, pt.y - cv) - r) < 1e-6);
  }),
  sample.layers.flatMap((layer) => layer.paths).map((path) => path.pts.length).join(', '));
const ends = sample.layers.map((layer) => layer.paths.map((path) => path.pts.at(-1)));
check('the shipped sample ends its arcs where the file says',
  ends[0][0].x === 0 && ends[0][0].y === 0
  && ends[0][2].x === 70 && ends[0][2].y === 10
  && ends[1][0].x === 0.5 && ends[1][2].x === 69.5 && ends[1][2].y === 10,
  JSON.stringify(ends));

console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
