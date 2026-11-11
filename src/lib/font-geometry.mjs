/**
 * Font outlines → contours → SVG / DXF, all in millimetres.
 *
 * Pure geometry: no DOM, no network, no globals. The tool page imports it, and
 * scripts/verify-font2dxf.mjs imports the same functions from Node, so the DXF we
 * ship is the DXF that was measured.
 *
 * Coordinates are mathematical (y up, baseline of the first line at y = 0), because
 * that is what a CAD file means. opentype.js hands back screen coordinates (y down),
 * so the flattening step flips them exactly once.
 */

const EPS = 1e-9;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function pushPoint(points, x, y) {
  const last = points[points.length - 1];
  if (last && Math.abs(last.x - x) < EPS && Math.abs(last.y - y) < EPS) return;
  points.push({ x, y });
}

/** How many straight segments a curve needs to stay within `tol` millimetres. */
function segments(controlPoints, tol) {
  let len = 0;
  for (let i = 1; i < controlPoints.length; i += 1) len += dist(controlPoints[i - 1], controlPoints[i]);
  return Math.max(4, Math.min(48, Math.ceil(len / Math.max(tol, 0.005) / 4)));
}

function flattenCubic(p0, p1, p2, p3, tol, points, toMathY) {
  const n = segments([p0, p1, p2, p3], tol);
  for (let i = 1; i <= n; i += 1) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x;
    const y = u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y;
    pushPoint(points, x, toMathY(y));
  }
}

function flattenQuadratic(p0, p1, p2, tol, points, toMathY) {
  const n = segments([p0, p1, p2], tol);
  for (let i = 1; i <= n; i += 1) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x;
    const y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y;
    pushPoint(points, x, toMathY(y));
  }
}

/**
 * Lay out text and return closed contours.
 *
 * @param {object} font            opentype.js font
 * @param {string} text            may contain \n
 * @param {object} options
 * @param {number} options.size        em size in mm (the font's design size)
 * @param {number} options.tracking    extra advance between glyphs, mm
 * @param {number} options.lineHeight  multiplier of `size`
 * @param {boolean} options.kerning     use the font's kerning table
 * @param {number} options.tolerance    flattening tolerance in mm
 * @returns {{x:number,y:number}[][]}
 */
export function textToContours(font, text, options = {}) {
  const size = options.size ?? 50;
  const tracking = options.tracking ?? 0;
  const lineHeight = options.lineHeight ?? 1.2;
  const kerning = options.kerning !== false;
  const tolerance = options.tolerance ?? 0.02;

  if (!font || !font.unitsPerEm) throw new Error('font has no unitsPerEm');
  const scale = size / font.unitsPerEm;
  const contours = [];
  const lines = String(text ?? '').split('\n');

  lines.forEach((line, index) => {
    if (!line.length) return;
    const baseline = -index * lineHeight * size;
    const toMathY = (y) => -y + baseline;
    const glyphs = font.stringToGlyphs(line);
    let x = 0;
    let previous = null;

    glyphs.forEach((glyph) => {
      if (previous && kerning && typeof font.getKerningValue === 'function') {
        x += (font.getKerningValue(previous, glyph) || 0) * scale;
      }

      const commands = glyph.getPath(x, 0, size).commands;
      let points = [];
      let last = null;

      for (const command of commands) {
        if (command.type === 'M') {
          if (points.length > 1) contours.push(points);
          points = [];
          pushPoint(points, command.x, toMathY(command.y));
          last = { x: command.x, y: command.y };
        } else if (command.type === 'L') {
          pushPoint(points, command.x, toMathY(command.y));
          last = { x: command.x, y: command.y };
        } else if (command.type === 'C' && last) {
          flattenCubic(last, { x: command.x1, y: command.y1 }, { x: command.x2, y: command.y2 }, { x: command.x, y: command.y }, tolerance, points, toMathY);
          last = { x: command.x, y: command.y };
        } else if (command.type === 'Q' && last) {
          flattenQuadratic(last, { x: command.x1, y: command.y1 }, { x: command.x, y: command.y }, tolerance, points, toMathY);
          last = { x: command.x, y: command.y };
        } else if (command.type === 'Z') {
          if (points.length > 1) contours.push(points);
          points = [];
          last = null;
        }
      }
      if (points.length > 1) contours.push(points);

      x += glyph.advanceWidth * scale + tracking;
      previous = glyph;
    });
  });

  return contours;
}

export function bounds(contours) {
  if (!contours.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const contour of contours) {
    for (const point of contour) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function pointCount(contours) {
  return contours.reduce((sum, contour) => sum + contour.length, 0);
}

const fmt = (value) => {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

export function toSvgPath(contours) {
  return contours
    .map((contour) => {
      const first = contour[0];
      const rest = contour.slice(1).map((p) => `L${fmt(p.x)} ${fmt(p.y)}`).join('');
      return `M${fmt(first.x)} ${fmt(first.y)}${rest}Z`;
    })
    .join('');
}

/**
 * SVG with real millimetre dimensions, so a laser app imports it at 1:1.
 * The group flips y back for display; the file's coordinate space stays mathematical.
 */
export function toSvg(contours, options = {}) {
  const b = bounds(contours);
  const pad = options.padding ?? 1;
  const minX = b.minX - pad;
  const minY = b.minY - pad;
  const width = b.width + pad * 2;
  const height = b.height + pad * 2;
  const stroke = options.stroke ?? 0.1;
  const d = toSvgPath(contours);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}mm" height="${fmt(height)}mm" viewBox="${fmt(minX)} ${fmt(-minY - height)} ${fmt(width)} ${fmt(height)}">`,
    `<g transform="scale(1,-1)">`,
    `<path d="${d}" fill="none" stroke="black" stroke-width="${fmt(stroke)}" vector-effect="non-scaling-stroke"/>`,
    `</g></svg>`,
  ].join('');
}

/**
 * DXF R12 with closed POLYLINEs in millimetres ($INSUNITS = 4).
 * R12 POLYLINE/VERTEX is verbose but read by every CAM package ever shipped,
 * which matters more here than file size.
 */
export function toDxf(contours, options = {}) {
  const layer = options.layer ?? 'PISMO';
  const b = bounds(contours);
  const out = [];
  const line = (...parts) => out.push(parts.join('\n'));

  line('0', 'SECTION', '2', 'HEADER');
  line('9', '$ACADVER', '1', 'AC1009');
  line('9', '$INSUNITS', '70', '4');
  line('9', '$MEASUREMENT', '70', '1');
  line('9', '$EXTMIN', '10', fmt(b.minX), '20', fmt(b.minY), '30', '0');
  line('9', '$EXTMAX', '10', fmt(b.maxX), '20', fmt(b.maxY), '30', '0');
  line('0', 'ENDSEC');

  line('0', 'SECTION', '2', 'ENTITIES');
  for (const contour of contours) {
    if (contour.length < 2) continue;
    line('0', 'POLYLINE', '8', layer, '66', '1', '70', '1');
    for (const point of contour) {
      line('0', 'VERTEX', '8', layer, '10', fmt(point.x), '20', fmt(point.y), '30', '0');
    }
    line('0', 'SEQEND', '8', layer);
  }
  line('0', 'ENDSEC');
  line('0', 'EOF');
  return out.join('\n') + '\n';
}

export function filename(text, extension) {
  const base = String(text ?? '')
    .split('\n')[0]
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${base || 'riplay'}.${extension}`;
}
