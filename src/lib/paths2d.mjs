/**
 * 2D paths in and out: SVG and DXF, in millimetres, y up.
 *
 * A contour is `{ points: [{x, y}], closed: boolean }` — a laser cares whether a path is
 * closed as much as where it goes, so that flag is carried through instead of being
 * silently closed on export.
 *
 * Pure geometry: no DOM, no network. The page imports it and scripts/verify-paths2d.mjs
 * imports the same functions from Node.
 */

import { MAX_FILE_BYTES, tooLarge, outputName } from './mesh.mjs';

export { outputName };

const TOL = 0.02;
const DEG = Math.PI / 180;

// --- shared helpers ----------------------------------------------------------

const fmt = (value) => {
  const rounded = Math.round(value * 1e4) / 1e4;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

const apply = (m, p) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });

const stepsFor = (length, tol) => Math.max(4, Math.min(400, Math.ceil(Math.abs(length) / Math.max(tol, 0.005) / 3)));

// --- SVG ---------------------------------------------------------------------

const UNITS = { '': 1, mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96 };

function lengthToMm(value) {
  if (value == null) return null;
  const match = String(value).trim().match(/^(-?[\d.]+)\s*([a-z%]*)$/i);
  if (!match) return null;
  const unit = match[2].toLowerCase();
  if (unit === '%') return null;
  const scale = UNITS[unit];
  return scale === undefined ? null : Number(match[1]) * scale;
}

function attr(source, name) {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(source ?? '');
  return match ? (match[2] ?? match[3]) : null;
}

function parseTransform(value) {
  let matrix = [1, 0, 0, 1, 0, 0];
  if (!value) return matrix;
  for (const match of value.matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
    const name = match[1].toLowerCase();
    const args = (match[2].match(/-?[\d.]+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    if (name === 'matrix' && args.length === 6) matrix = mul(matrix, args);
    else if (name === 'translate' && args.length) matrix = mul(matrix, [1, 0, 0, 1, args[0], args[1] ?? 0]);
    else if (name === 'scale' && args.length) matrix = mul(matrix, [args[0], 0, 0, args[1] ?? args[0], 0, 0]);
    else if (name === 'rotate' && args.length) {
      const a = args[0] * DEG;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      if (args.length >= 3) {
        matrix = mul(matrix, [1, 0, 0, 1, args[1], args[2]]);
        matrix = mul(matrix, [cos, sin, -sin, cos, 0, 0]);
        matrix = mul(matrix, [1, 0, 0, 1, -args[1], -args[2]]);
      } else {
        matrix = mul(matrix, [cos, sin, -sin, cos, 0, 0]);
      }
    }
  }
  return matrix;
}

function arcPoints(from, to, rx, ry, rotation, largeArc, sweep, tol) {
  if (!rx || !ry) return [to];
  const phi = rotation * DEG;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  let ax = Math.abs(rx);
  let ay = Math.abs(ry);

  const lambda = (x1 * x1) / (ax * ax) + (y1 * y1) / (ay * ay);
  if (lambda > 1) {
    const grow = Math.sqrt(lambda);
    ax *= grow;
    ay *= grow;
  }

  const numerator = ax * ax * ay * ay - ax * ax * y1 * y1 - ay * ay * x1 * x1;
  const denominator = ax * ax * y1 * y1 + ay * ay * x1 * x1;
  const factor = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = factor * ((ax * y1) / ay);
  const cyp = factor * (-(ay * x1) / ax);
  const cx = cos * cxp - sin * cyp + (from.x + to.x) / 2;
  const cy = sin * cxp + cos * cyp + (from.y + to.y) / 2;

  const angle = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    const value = Math.acos(Math.max(-1, Math.min(1, dot / (len || 1))));
    return ux * vy - uy * vx < 0 ? -value : value;
  };

  const theta = angle(1, 0, (x1 - cxp) / ax, (y1 - cyp) / ay);
  let delta = angle((x1 - cxp) / ax, (y1 - cyp) / ay, (-x1 - cxp) / ax, (-y1 - cyp) / ay);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;

  const count = stepsFor(delta * Math.max(ax, ay), tol);
  const points = [];
  for (let i = 1; i <= count; i += 1) {
    const t = theta + (delta * i) / count;
    points.push({
      x: cx + cos * ax * Math.cos(t) - sin * ay * Math.sin(t),
      y: cy + sin * ax * Math.cos(t) + cos * ay * Math.sin(t),
    });
  }
  points[points.length - 1] = to;
  return points;
}

/** Flatten an SVG `d` attribute into contours of points, in user units. */
export function flattenPathData(d, tol = TOL) {
  const tokens = String(d).match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const result = [];
  let index = 0;
  let command = null;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let previousCubic = null;
  let previousQuad = null;
  let current = null;

  const number = () => Number(tokens[index++]);
  const push = (point) => {
    if (!current) current = [];
    const last = current.at(-1);
    if (!last || Math.abs(last.x - point.x) > 1e-9 || Math.abs(last.y - point.y) > 1e-9) current.push(point);
  };
  const finish = (closed) => {
    if (current && current.length > 1) result.push({ points: current, closed });
    current = null;
  };
  const curve = (points) => {
    let length = 0;
    for (let i = 1; i < points.length; i += 1) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    return stepsFor(length, tol);
  };

  while (index < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[index])) {
      command = tokens[index];
      index += 1;
      if (command === 'Z' || command === 'z') {
        finish(true);
        x = startX;
        y = startY;
        previousCubic = null;
        previousQuad = null;
        continue;
      }
    }
    if (!command) { index += 1; continue; }

    const relative = command === command.toLowerCase();
    const type = command.toUpperCase();
    const ox = relative ? x : 0;
    const oy = relative ? y : 0;

    if (type === 'M') {
      finish(false);
      x = ox + number();
      y = oy + number();
      startX = x;
      startY = y;
      push({ x, y });
      command = relative ? 'l' : 'L';
      previousCubic = null;
      previousQuad = null;
    } else if (type === 'L') {
      x = ox + number();
      y = oy + number();
      push({ x, y });
      previousCubic = null;
      previousQuad = null;
    } else if (type === 'H') {
      x = ox + number();
      push({ x, y });
      previousCubic = null;
      previousQuad = null;
    } else if (type === 'V') {
      y = oy + number();
      push({ x, y });
      previousCubic = null;
      previousQuad = null;
    } else if (type === 'C' || type === 'S') {
      const from = { x, y };
      let c1;
      if (type === 'C') c1 = { x: ox + number(), y: oy + number() };
      else c1 = previousCubic ? { x: 2 * x - previousCubic.x, y: 2 * y - previousCubic.y } : { x, y };
      const c2 = { x: ox + number(), y: oy + number() };
      const end = { x: ox + number(), y: oy + number() };
      const count = curve([from, c1, c2, end]);
      for (let i = 1; i <= count; i += 1) {
        const t = i / count;
        const u = 1 - t;
        push({
          x: u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * end.x,
          y: u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * end.y,
        });
      }
      previousCubic = c2;
      previousQuad = null;
      x = end.x;
      y = end.y;
    } else if (type === 'Q' || type === 'T') {
      const from = { x, y };
      const c1 = type === 'Q'
        ? { x: ox + number(), y: oy + number() }
        : previousQuad ? { x: 2 * x - previousQuad.x, y: 2 * y - previousQuad.y } : { x, y };
      const end = { x: ox + number(), y: oy + number() };
      const count = curve([from, c1, end]);
      for (let i = 1; i <= count; i += 1) {
        const t = i / count;
        const u = 1 - t;
        push({ x: u * u * from.x + 2 * u * t * c1.x + t * t * end.x, y: u * u * from.y + 2 * u * t * c1.y + t * t * end.y });
      }
      previousQuad = c1;
      previousCubic = null;
      x = end.x;
      y = end.y;
    } else if (type === 'A') {
      const from = { x, y };
      const rx = number();
      const ry = number();
      const rotation = number();
      const largeArc = number() !== 0;
      const sweep = number() !== 0;
      const end = { x: ox + number(), y: oy + number() };
      for (const point of arcPoints(from, end, rx, ry, rotation, largeArc, sweep, tol)) push(point);
      previousCubic = null;
      previousQuad = null;
      x = end.x;
      y = end.y;
    } else {
      index += 1;
      command = null;
    }
  }
  finish(false);
  return result;
}

function circlePoints(cx, cy, rx, ry, tol) {
  const count = Math.max(24, Math.min(720, Math.ceil((2 * Math.PI * Math.max(rx, ry)) / Math.max(tol, 0.005) / 3)));
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    points.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return points;
}

function readSvg(text, tol) {
  const notes = [];
  const contours = [];
  const stack = [];
  let matrix = [1, 0, 0, 1, 0, 0];
  let skipped = 0;

  const tagPattern = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let match;

  while ((match = tagPattern.exec(text))) {
    const closing = match[1] === '/';
    const name = match[2].toLowerCase();
    const attributes = match[3];

    if (closing) {
      if (name === 'g' && stack.length) matrix = stack.pop();
      continue;
    }

    if (name === 'svg') {
      // width/height + viewBox is the only honest way to know what a user unit means.
      const viewBox = (attr(attributes, 'viewBox') ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
      const width = lengthToMm(attr(attributes, 'width'));
      const height = lengthToMm(attr(attributes, 'height'));
      if (viewBox.length === 4) {
        const sx = width ? width / viewBox[2] : 1;
        const sy = height ? height / viewBox[3] : 1;
        if (!width || !height) notes.push('SVG nemá rozměr v mm — počítám 1 jednotku jako 1 mm');
        matrix = [sx, 0, 0, -sy, -viewBox[0] * sx, (viewBox[1] + viewBox[3]) * sy];
      } else if (!width && !height) {
        notes.push('SVG nemá rozměr ani viewBox — počítám 1 jednotku jako 1 mm');
      }
      continue;
    }

    if (name === 'g') {
      stack.push(matrix);
      matrix = mul(matrix, parseTransform(attr(attributes, 'transform')));
      continue;
    }

    const local = mul(matrix, parseTransform(attr(attributes, 'transform')));
    const add = (points, closed) => {
      if (points.length > 1) contours.push({ points: points.map((p) => apply(local, p)), closed });
    };

    if (name === 'path') {
      const d = attr(attributes, 'd');
      if (d) for (const contour of flattenPathData(d, tol)) add(contour.points, contour.closed);
    } else if (name === 'rect') {
      const x = Number(attr(attributes, 'x') ?? 0);
      const y = Number(attr(attributes, 'y') ?? 0);
      const w = Number(attr(attributes, 'width') ?? 0);
      const h = Number(attr(attributes, 'height') ?? 0);
      if (w > 0 && h > 0) add([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], true);
    } else if (name === 'circle' || name === 'ellipse') {
      const cx = Number(attr(attributes, 'cx') ?? 0);
      const cy = Number(attr(attributes, 'cy') ?? 0);
      const rx = Number(attr(attributes, name === 'circle' ? 'r' : 'rx') ?? 0);
      const ry = Number(attr(attributes, name === 'circle' ? 'r' : 'ry') ?? 0);
      if (rx > 0 && ry > 0) add(circlePoints(cx, cy, rx, ry, tol), true);
    } else if (name === 'line') {
      add([
        { x: Number(attr(attributes, 'x1') ?? 0), y: Number(attr(attributes, 'y1') ?? 0) },
        { x: Number(attr(attributes, 'x2') ?? 0), y: Number(attr(attributes, 'y2') ?? 0) },
      ], false);
    } else if (name === 'polyline' || name === 'polygon') {
      const values = (attr(attributes, 'points') ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
      const points = [];
      for (let i = 0; i + 1 < values.length; i += 2) points.push({ x: values[i], y: values[i + 1] });
      add(points, name === 'polygon');
    } else if (['text', 'image', 'use', 'filter', 'mask', 'clipPath', 'defs', 'style', 'title', 'desc'].includes(name)) {
      if (name === 'text' || name === 'image') skipped += 1;
    } else if (name !== 'metadata') {
      skipped += 1;
    }
  }

  if (skipped) notes.push(`${skipped} prvků SVG jsem přeskočil (text, obrázky, neznámé tvary)`);
  if (!contours.length) throw new Error('V SVG nejsou žádné cesty — text nebo obrázky převést neumím');
  return { contours, notes };
}

// --- DXF ---------------------------------------------------------------------

function dxfPairs(text) {
  const lines = text.split(/\r?\n/);
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([lines[i].trim(), lines[i + 1]]);
  return pairs;
}

function dxfEntities(pairs) {
  const entities = [];
  let current = null;
  for (const [code, value] of pairs) {
    if (code === '0') {
      if (current) entities.push(current);
      current = { type: value.trim(), values: [] };
    } else if (current) {
      current.values.push([code, value]);
    }
  }
  if (current) entities.push(current);
  return entities;
}

// Group codes arrive as strings from the file, so compare as strings — `c === 10` is
// silently always false and every coordinate falls back to zero.
const numbers = (entity, code) => entity.values.filter(([c]) => c === String(code)).map(([, v]) => Number(v));
const first = (entity, code, fallback = 0) => {
  const match = entity.values.find(([c]) => c === String(code));
  return match ? Number(match[1]) : fallback;
};

function bulgePoints(from, to, bulge, tol) {
  if (!bulge) return [to];
  const chord = Math.hypot(to.x - from.x, to.y - from.y);
  if (!chord) return [to];
  const theta = 4 * Math.atan(bulge);
  const radius = chord / (2 * Math.sin(Math.abs(theta) / 2));
  const sagitta = bulge * chord / 2;
  const nx = -(to.y - from.y) / chord;
  const ny = (to.x - from.x) / chord;
  const offset = (radius - Math.abs(sagitta)) * Math.sign(bulge);
  const cx = (from.x + to.x) / 2 + nx * offset;
  const cy = (from.y + to.y) / 2 + ny * offset;
  const start = Math.atan2(from.y - cy, from.x - cx);
  const count = stepsFor(theta * radius, tol);
  const points = [];
  for (let i = 1; i <= count; i += 1) {
    const angle = start + (theta * i) / count;
    points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  points[points.length - 1] = to;
  return points;
}

const DXF_UNIT_MM = { 0: 1, 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000 };

function readDxf(text, tol) {
  const pairs = dxfPairs(text);
  const notes = [];

  let unit = 4;
  for (let i = 0; i < pairs.length - 2; i += 1) {
    if (pairs[i][0] === '9' && pairs[i][1].trim() === '$INSUNITS') {
      // The value follows on the very next pair, with its own group code (70).
      unit = Number(pairs[i + 1][1]);
      break;
    }
  }
  const scale = DXF_UNIT_MM[unit] ?? 1;
  if (!(unit in DXF_UNIT_MM)) notes.push(`DXF uvádí jednotky ${unit} — počítám 1 jednotku jako 1 mm`);

  const entities = dxfEntities(pairs);
  const contours = [];
  let skipped = 0;

  // POLYLINE is followed by VERTEX entities until SEQEND, so walk with an index.
  for (let i = 0; i < entities.length; i += 1) {
    const entity = entities[i];
    const scalePoint = (x, y) => ({ x: x * scale, y: y * scale });

    if (entity.type === 'LINE') {
      contours.push({
        points: [scalePoint(first(entity, 10), first(entity, 20)), scalePoint(first(entity, 11), first(entity, 21))],
        closed: false,
      });
    } else if (entity.type === 'LWPOLYLINE') {
      const xs = numbers(entity, 10);
      const ys = numbers(entity, 20);
      const bulges = numbers(entity, 42);
      const closed = (first(entity, 70, 0) & 1) === 1;
      const points = [];
      for (let k = 0; k < xs.length; k += 1) {
        const point = { x: xs[k], y: ys[k] };
        if (!points.length) points.push(point);
        else points.push(...bulgePoints(points.at(-1), point, bulges[k - 1] ?? 0, tol));
      }
      contours.push({ points: points.map((p) => scalePoint(p.x, p.y)), closed });
    } else if (entity.type === 'POLYLINE') {
      const closed = (first(entity, 70, 0) & 1) === 1;
      const vertices = [];
      let bulges = [];
      let k = i + 1;
      while (k < entities.length && entities[k].type === 'VERTEX') {
        vertices.push({ x: first(entities[k], 10), y: first(entities[k], 20) });
        bulges.push(first(entities[k], 42, 0));
        k += 1;
      }
      i = k;
      const points = [];
      for (let v = 0; v < vertices.length; v += 1) {
        if (!points.length) points.push(vertices[v]);
        else points.push(...bulgePoints(points.at(-1), vertices[v], bulges[v - 1] ?? 0, tol));
      }
      if (points.length > 1) contours.push({ points: points.map((p) => scalePoint(p.x, p.y)), closed });
    } else if (entity.type === 'CIRCLE') {
      const r = first(entity, 40);
      contours.push({ points: circlePoints(first(entity, 10), first(entity, 20), r, r, tol).map((p) => scalePoint(p.x, p.y)), closed: true });
    } else if (entity.type === 'ARC') {
      const cx = first(entity, 10);
      const cy = first(entity, 20);
      const r = first(entity, 40);
      const from = first(entity, 50) * DEG;
      const to = first(entity, 51) * DEG;
      let sweep = to - from;
      while (sweep <= 0) sweep += Math.PI * 2;
      const count = stepsFor(sweep * r, tol);
      const points = [];
      for (let s = 0; s <= count; s += 1) {
        const angle = from + (sweep * s) / count;
        points.push(scalePoint(cx + r * Math.cos(angle), cy + r * Math.sin(angle)));
      }
      contours.push({ points, closed: false });
    } else if (['VERTEX', 'SEQEND', 'ENDSEC', 'SECTION', 'EOF', 'TABLE', 'ENDTAB'].includes(entity.type)) {
      continue;
    } else {
      skipped += 1;
    }
  }

  if (skipped) notes.push(`${skipped} entit DXF jsem přeskočil (např. SPLINE, ELLIPSE, INSERT)`);
  if (!contours.length) throw new Error('V DXF nejsou žádné čitelné entity — zkus jinou verzi exportu');
  return { contours, notes };
}

// --- writing -----------------------------------------------------------------

export function contoursToDxf(contours, options = {}) {
  const layer = options.layer ?? 'PREVOD';
  const b = pathBounds(contours);
  const out = [];
  const line = (...parts) => out.push(parts.join('\n'));

  line('0', 'SECTION', '2', 'HEADER');
  line('9', '$ACADVER', '1', 'AC1009');
  line('9', '$INSUNITS', '70', '4');
  line('9', '$EXTMIN', '10', fmt(b.min.x), '20', fmt(b.min.y), '30', '0');
  line('9', '$EXTMAX', '10', fmt(b.max.x), '20', fmt(b.max.y), '30', '0');
  line('0', 'ENDSEC');
  line('0', 'SECTION', '2', 'ENTITIES');

  for (const contour of contours) {
    if (contour.points.length < 2) continue;
    line('0', 'POLYLINE', '8', layer, '66', '1', '70', contour.closed ? '1' : '0');
    for (const point of contour.points) line('0', 'VERTEX', '8', layer, '10', fmt(point.x), '20', fmt(point.y), '30', '0');
    line('0', 'SEQEND', '8', layer);
  }

  line('0', 'ENDSEC');
  line('0', 'EOF');
  return out.join('\n') + '\n';
}

export function contoursToSvg(contours, options = {}) {
  const b = pathBounds(contours);
  // No padding by default: the canvas is the geometry, so the millimetres in the file are
  // the millimetres of the part and a CAM import cannot quietly inherit a 2 mm border.
  const pad = options.padding ?? 0;
  const width = b.width + pad * 2;
  const height = b.height + pad * 2;
  const d = contours
    .filter((contour) => contour.points.length > 1)
    .map((contour) => {
      const [firstPoint, ...rest] = contour.points;
      const body = rest.map((p) => `L${fmt(p.x)} ${fmt(p.y)}`).join('');
      return `M${fmt(firstPoint.x)} ${fmt(firstPoint.y)}${body}${contour.closed ? 'Z' : ''}`;
    })
    .join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}mm" height="${fmt(height)}mm"`,
    ` viewBox="${fmt(b.min.x - pad)} ${fmt(-b.max.y - pad)} ${fmt(width)} ${fmt(height)}">`,
    '<g transform="scale(1,-1)">',
    `<path d="${d}" fill="none" stroke="currentColor" stroke-width="0.1"/>`,
    '</g></svg>',
  ].join('');
}

// --- the surface used by the page and the verifier ----------------------------

export function pathBounds(contours) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let points = 0;
  for (const contour of contours) {
    for (const point of contour.points) {
      points += 1;
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }
  if (!Number.isFinite(minX)) return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 }, width: 0, height: 0, points: 0 };
  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY },
    width: maxX - minX,
    height: maxY - minY,
    points,
  };
}

export function scalePaths(contours, factor) {
  if (!Number.isFinite(factor) || factor === 1) return contours;
  return contours.map((contour) => ({
    closed: contour.closed,
    points: contour.points.map((point) => ({ x: point.x * factor, y: point.y * factor })),
  }));
}

export function pathStats(contours) {
  const b = pathBounds(contours);
  return {
    contours: contours.length,
    closed: contours.filter((contour) => contour.closed).length,
    points: b.points,
    size: [b.width, b.height],
  };
}

export function detectPathFormat(name) {
  const dot = name.lastIndexOf('.');
  const extension = dot < 0 ? '' : name.slice(dot).toLowerCase();
  if (extension === '.svg') return 'svg';
  if (extension === '.dxf') return 'dxf';
  throw new Error(`Příponu ${extension || '(žádná)'} mezi 2D neumím. Zvládnu .svg a .dxf.`);
}

export function pathsFrom(name, bytes) {
  const format = detectPathFormat(name);
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error(tooLarge(bytes.byteLength));
  const text = new TextDecoder().decode(bytes);
  const { contours, notes } = format === 'svg' ? readSvg(text, TOL) : readDxf(text, TOL);
  return { format, contours, notes };
}

export function writePaths(contours, format) {
  if (format === 'dxf') return { bytes: new TextEncoder().encode(contoursToDxf(contours)), mime: 'application/dxf' };
  if (format === 'svg') return { bytes: new TextEncoder().encode(contoursToSvg(contours)), mime: 'image/svg+xml' };
  throw new Error(`Nevím, jak zapsat ${format}.`);
}
