// Verifies the shipped converter: geometry, scale in mm, and the DXF we actually write.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { textToContours, toDxf, toSvg, bounds, filename } from '../src/lib/font-geometry.mjs';

const require = createRequire(import.meta.url);
const opentype = require('opentype.js');

const buffer = readFileSync('public/nastroje/liberation-sans.ttf');
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const font = opentype.parse(arrayBuffer);

const failures = [];
const check = (label, condition, detail) => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!condition) failures.push(label);
};

const SIZE = 50;
const contours = textToContours(font, 'VERB', { size: SIZE });
const b = bounds(contours);
const capRatio = (font.tables.os2 && font.tables.os2.sCapHeight ? font.tables.os2.sCapHeight : font.unitsPerEm * 0.7) / font.unitsPerEm;
const expectedHeight = capRatio * SIZE;

check('contours produced', contours.length > 0, `${contours.length} contours`);
check('all contours closed with >= 3 points', contours.every((c) => c.length >= 3));
check(
  'cap height matches the font metric',
  Math.abs(b.height - expectedHeight) / expectedHeight < 0.01,
  `measured ${b.height.toFixed(3)} mm, expected ${expectedHeight.toFixed(3)} mm`
);
check('text sits above the baseline', b.minY > -0.001 && b.minY < 0.5, `minY ${b.minY.toFixed(3)} mm`);

// scale is 1:1 — doubling the em size must double the width exactly
const doubled = bounds(textToContours(font, 'VERB', { size: SIZE * 2 }));
check(
  'width scales linearly with size (1:1 mm)',
  Math.abs(doubled.width - b.width * 2) < 1e-6,
  `${b.width.toFixed(3)} mm -> ${doubled.width.toFixed(3)} mm`
);

// tracking and kerning must move the geometry
const tracked = bounds(textToContours(font, 'VERB', { size: SIZE, tracking: 5 }));
check('tracking widens the line', tracked.width > b.width + 3 * 5 - 0.01, `+${(tracked.width - b.width).toFixed(2)} mm`);
// A trivially-true comparison proves nothing: first find a pair the font actually kerns.
let kernPair = null;
for (const probe of ['AV', 'AT', 'To', 'Wa', 'LV', 'PA', 'Yo', 'Av']) {
  const glyphs = font.stringToGlyphs(probe);
  const value = font.getKerningValue(glyphs[0], glyphs[1]) || 0;
  if (value) { kernPair = { probe, value }; break; }
}
if (kernPair) {
  const on = bounds(textToContours(font, kernPair.probe, { size: SIZE, kerning: true }));
  const off = bounds(textToContours(font, kernPair.probe, { size: SIZE, kerning: false }));
  const expectedShift = Math.abs(kernPair.value) * SIZE / font.unitsPerEm;
  check(
    'kerning actually moves glyphs',
    Math.abs((off.width - on.width) - expectedShift) < Math.max(0.01, expectedShift * 0.02),
    `${kernPair.probe} kern ${kernPair.value} -> expected shift ${expectedShift.toFixed(3)} mm, got ${(off.width - on.width).toFixed(3)} mm`
  );
} else {
  console.log('SKIP  kerning: this font carries no kern pairs, so the option has nothing to apply');
}

// the DXF file itself
const dxf = toDxf(contours);
const polylineCount = (dxf.match(/^POLYLINE$/gm) || []).length;
check('DXF has one POLYLINE per contour', polylineCount === contours.length, `${polylineCount} of ${contours.length}`);
check('DXF declares millimetres', /\$INSUNITS\n70\n4\n/.test(dxf));
check('DXF header is R12', /\$ACADVER\n1\nAC1009\n/.test(dxf));
const extMin = dxf.match(/\$EXTMIN\n10\n(-?[\d.]+)\n20\n(-?[\d.]+)/);
const extMax = dxf.match(/\$EXTMAX\n10\n(-?[\d.]+)\n20\n(-?[\d.]+)/);
check(
  'DXF extents equal the measured bounds',
  !!extMin && !!extMax &&
    Math.abs(parseFloat(extMin[1]) - b.minX) < 0.01 && Math.abs(parseFloat(extMin[2]) - b.minY) < 0.01 &&
    Math.abs(parseFloat(extMax[1]) - b.maxX) < 0.01 && Math.abs(parseFloat(extMax[2]) - b.maxY) < 0.01,
  `ext ${extMin?.[1]},${extMin?.[2]} .. ${extMax?.[1]},${extMax?.[2]} vs ${b.minX.toFixed(2)},${b.minY.toFixed(2)} .. ${b.maxX.toFixed(2)},${b.maxY.toFixed(2)}`
);
check('every POLYLINE is flagged closed', (dxf.match(/^70\n1$/gm) || []).length >= contours.length);
check('DXF terminates cleanly', dxf.trim().endsWith('EOF'));

// the SVG file
const svg = toSvg(contours);
check('SVG carries millimetre width', svg.includes(`width="${(b.width + 2).toFixed(3)}mm"`), `expected ${(b.width + 2).toFixed(3)}mm`);
check('SVG path count matches', (svg.match(/M/g) || []).length >= contours.length);

check('filename is filesystem-safe', /^[a-z0-9-]+\.dxf$/.test(filename('Příliš žluťoučký\nkůň', 'dxf')), filename('Příliš žluťoučký\nkůň', 'dxf'));

console.log(`\n${failures.length ? 'FAILED: ' + failures.join(', ') : 'ALL CHECKS PASSED'}`);
process.exit(failures.length ? 1 : 0);
