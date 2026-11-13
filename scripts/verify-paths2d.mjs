// Proves the 2D slice: SVG and DXF in, millimetres out, closed and open paths intact.
// Run: node scripts/verify-paths2d.mjs

import {
  pathsFrom, writePaths, flattenPathData, pathBounds, pathStats, contoursToDxf, contoursToSvg,
  scalePaths,
} from '../src/lib/paths2d.mjs';

let failures = 0;
const check = (name, condition, detail = '') => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!condition) failures += 1;
};
const close = (a, b, tolerance = 1e-3) => Math.abs(a - b) <= tolerance;
const bytes = (text) => new TextEncoder().encode(text);

const svg = (body, root = 'width="100mm" height="100mm" viewBox="0 0 100 100"') => bytes(
  `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" ${root}>${body}</svg>`,
);

// A 10 × 10 square, clockwise on screen, which must come back 10 × 10 with y up.
const square = pathsFrom('square.svg', svg('<path d="M0 0 L10 0 L10 10 L0 10 Z"/>'));
const squareBounds = pathBounds(square.contours);
check('SVG path becomes one closed contour', square.contours.length === 1 && square.contours[0].closed, `${square.contours.length} contour`);
check('SVG square is 10 × 10 mm', close(squareBounds.width, 10) && close(squareBounds.height, 10), `${squareBounds.width} × ${squareBounds.height}`);

// viewBox scaling: 100 user units rendered into 210 mm means 1 unit is 2.1 mm.
const scaled = pathsFrom('scaled.svg', svg('<rect x="0" y="0" width="10" height="10"/>', 'width="210mm" height="210mm" viewBox="0 0 100 100"'));
const scaledBounds = pathBounds(scaled.contours);
check('viewBox is converted to millimetres', close(scaledBounds.width, 21) && close(scaledBounds.height, 21), `${scaledBounds.width.toFixed(2)} × ${scaledBounds.height.toFixed(2)}`);

// Group transforms compound, and the y flip must still hold.
const transformed = pathsFrom('t.svg', svg('<g transform="translate(5,5)"><path d="M0 0 L10 0 L10 10 Z"/></g>'));
const transformedBounds = pathBounds(transformed.contours);
check('SVG group transform is applied', close(transformedBounds.min.x, 5) && close(transformedBounds.max.x, 15), `x ${transformedBounds.min.x}..${transformedBounds.max.x}`);

// Curves are flattened within tolerance: every sampled point must sit on the real curve.
const cubic = flattenPathData('M0 0 C0 10 10 10 10 0', 0.02)[0].points;
const onCurve = cubic.every((p) => {
  let best = Infinity;
  for (let i = 0; i <= 2000; i += 1) {
    const t = i / 2000;
    const u = 1 - t;
    const x = 3 * u * u * t * 0 + 3 * u * t * t * 10 + t * t * t * 10;
    const y = 3 * u * u * t * 10 + 3 * u * t * t * 10;
    best = Math.min(best, Math.hypot(p.x - x, p.y - y));
  }
  return best <= 0.03;
});
check('cubic curve flattens within 0.02 mm', onCurve && cubic.length > 4, `${cubic.length} points`);
check('cubic curve keeps its endpoint', close(cubic.at(-1).x, 10) && close(cubic.at(-1).y, 0), `(${cubic.at(-1).x}, ${cubic.at(-1).y})`);

// Relative commands and a close must land in the same place as the absolute form.
const relative = pathBounds(flattenPathData('m0 0 l10 0 l0 10 z').map((c) => ({ ...c, closed: true })));
check('relative path commands resolve', close(relative.width, 10) && close(relative.height, 10), `${relative.width} × ${relative.height}`);

// Arcs: a semicircle of radius 10 must span 20 wide and 10 high.
const arc = flattenPathData('M-10 0 A10 10 0 0 1 10 0', 0.02)[0].points;
const arcBox = { minY: Math.min(...arc.map((p) => p.y)), maxY: Math.max(...arc.map((p) => p.y)) };
check('SVG arc is sampled, not dropped', arc.length > 8, `${arc.length} points`);
check('SVG arc keeps its radius', close(arcBox.maxY - arcBox.minY, 10, 0.05), `height ${(arcBox.maxY - arcBox.minY).toFixed(3)}`);

// DXF: LWPOLYLINE with the closed flag, a bare LINE, and an ARC.
const dxfLw = `0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\n0\n70\n1\n90\n4\n10\n0\n20\n0\n10\n10\n20\n0\n10\n10\n20\n10\n10\n0\n20\n10\n0\nENDSEC\n0\nEOF\n`;
const lw = pathsFrom('square.dxf', bytes(dxfLw));
const lwBounds = pathBounds(lw.contours);
check('DXF LWPOLYLINE reads as closed', lw.contours[0].closed);
check('DXF LWPOLYLINE keeps its size', close(lwBounds.width, 10) && close(lwBounds.height, 10), `${lwBounds.width} × ${lwBounds.height}`);

const dxfLine = `0\nSECTION\n2\nENTITIES\n0\nLINE\n8\n0\n10\n0\n20\n0\n11\n50\n21\n25\n0\nENDSEC\n0\nEOF\n`;
const line = pathsFrom('line.dxf', bytes(dxfLine));
check('DXF LINE stays open', line.contours.length === 1 && !line.contours[0].closed);
check('DXF LINE keeps both ends', close(pathBounds(line.contours).width, 50) && close(pathBounds(line.contours).height, 25));

const dxfArc = `0\nSECTION\n2\nENTITIES\n0\nARC\n8\n0\n10\n0\n20\n0\n40\n10\n50\n0\n51\n180\n0\nENDSEC\n0\nEOF\n`;
const dxfArcBounds = pathBounds(pathsFrom('arc.dxf', bytes(dxfArc)).contours);
check('DXF ARC spans its radius', close(dxfArcBounds.width, 20, 0.2) && close(dxfArcBounds.height, 10, 0.2), `${dxfArcBounds.width.toFixed(2)} × ${dxfArcBounds.height.toFixed(2)}`);

// A bulge of 1 on a 10 mm chord is a half circle: 5 mm deep.
const dxfBulge = `0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\n0\n90\n2\n10\n0\n20\n0\n42\n1\n10\n10\n20\n0\n0\nENDSEC\n0\nEOF\n`;
const bulgeBounds = pathBounds(pathsFrom('bulge.dxf', bytes(dxfBulge)).contours);
check('DXF bulge becomes an arc', close(bulgeBounds.height, 5, 0.1), `height ${bulgeBounds.height.toFixed(3)}`);

// Round trips: what we write must be what we read.
const writtenDxf = pathsFrom('rt.dxf', bytes(contoursToDxf(square.contours))).contours;
const rtd = pathBounds(writtenDxf);
check('DXF round-trip keeps geometry and closure', close(rtd.width, 10) && close(rtd.height, 10) && writtenDxf[0].closed, `${rtd.width} × ${rtd.height}`);

const writtenSvg = pathsFrom('rt.svg', bytes(contoursToSvg(square.contours)), 0.02).contours;
const rts = pathBounds(writtenSvg);
check('SVG round-trip keeps geometry', close(rts.width, 10) && close(rts.height, 10), `${rts.width} × ${rts.height}`);

// Open contours must not be closed on export.
const openRoundTrip = pathsFrom('open.dxf', bytes(contoursToDxf([{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false }]))).contours;
check('open contour stays open through DXF', !openRoundTrip[0].closed);

// Scale has to reach 2D, or a drawing imported into CAM is silently the wrong size.
const scaledPaths = scalePaths(square.contours, 2);
const scaledPathBounds = pathBounds(scaledPaths);
check('2D scale ×2 doubles the drawing', close(scaledPathBounds.width, 20) && close(scaledPathBounds.height, 20), `${scaledPathBounds.width} × ${scaledPathBounds.height}`);

// The exported SVG canvas must equal the geometry: no invisible 1 mm border.
const canvas = /width="([\d.]+)mm"/.exec(contoursToSvg(square.contours));
check('SVG canvas equals the geometry, no padding', canvas && close(Number(canvas[1]), 10), `${canvas?.[1]} mm`);

// The millimetre claim, end to end: 210 mm wide file holding a 100-unit drawing, exported
// to DXF, must land on 21 mm — the number a CAM toolpath will actually cut.
const truth = pathsFrom('truth.svg', svg('<rect x="0" y="0" width="10" height="10"/>', 'width="210mm" height="210mm" viewBox="0 0 100 100"'));
const truthDxf = contoursToDxf(truth.contours);
// Y is flipped on purpose (SVG is y-down, CAD is y-up), so a shape at the top of the page
// lands at high y in the DXF. What has to be 21 mm is the span, not the absolute max.
const grab = (name) => new RegExp(`\\$${name}\\n10\\n([-\\d.]+)\\n20\\n([-\\d.]+)`).exec(truthDxf);
const truthMax = grab('EXTMAX');
const truthMin = grab('EXTMIN');
const spanX = Number(truthMax?.[1]) - Number(truthMin?.[1]);
const spanY = Number(truthMax?.[2]) - Number(truthMin?.[2]);
check('210 mm / 100 units spans exactly 21 mm in DXF', close(spanX, 21) && close(spanY, 21), `span ${spanX} × ${spanY} (max ${truthMax?.[1]}, ${truthMax?.[2]})`);

const truthReread = pathBounds(pathsFrom('truth.dxf', bytes(truthDxf)).contours);
check('and survives the round trip at 21 mm', close(truthReread.width, 21) && close(truthReread.height, 21), `${truthReread.width.toFixed(3)} × ${truthReread.height.toFixed(3)}`);

check('stats count closed contours', pathStats(square.contours).closed === 1 && pathStats(square.contours).contours === 1);

// Refusals must be plain and specific.
let message = '';
try { pathsFrom('only-text.svg', svg('<text x="0" y="0">ahoj</text>')); } catch (error) { message = error.message; }
check('SVG without paths is refused', /žádné cesty/.test(message), message);

message = '';
try { pathsFrom('drawing.step', bytes('x')); } catch (error) { message = error.message; }
check('2D refuses a 3D extension', /neumím/.test(message), message);

message = '';
try { pathsFrom('huge.svg', new Uint8Array(41 * 1024 * 1024)); } catch (error) { message = error.message; }
check('oversized 2D file is refused before parsing', /MB/.test(message), message.slice(0, 60));

console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
