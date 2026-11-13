// A G-code reader for the layer viewer. It answers one question: what will the machine actually
// run, layer by layer. It is not a simulator — no acceleration, pressure advance or machine state.
//
// The engine this workshop uses marks each layer with ";Layer <n>" and each region with
// ;Shell / ;Solid Infill / ;Internal Infill. Those markers decide the path colour; a file without
// them still renders, in one colour, because guessing is worse than plain.
//
// Arcs are real curves here, not the straight line between their endpoints: G2/G3 are tessellated
// in their own plane (G17/G18/G19) until the chord deviates from the true arc by at most
// ARC_TOLERANCE_MM. A chord where the file has an arc is a drawing that claims the tool went
// somewhere it did not.

// A letter followed by a number: "X10", "E-0.8", "U1.25".
const WORD = /([A-Za-z])(-?\d*\.?\d+)/g;

// 40 MB of short G-code lines is roughly a million of them, so the line ceiling matches the file
// ceiling: a file the tool accepts is a file it reads whole.
const DEFAULT_MAX_LINES = 1_000_000;

const TAU = Math.PI * 2;

// How far a chord may sit from the arc it replaces, in millimetres. 0.02 mm is below what a
// 0.4 mm nozzle or a 3 mm cutter can resolve; a Ø50 circle needs 70 segments at this tolerance.
export const ARC_TOLERANCE_MM = 0.02;

// Plane → the two axes an arc lives in, in the order where a positive angle is a G3 move, and the
// I/J letters that address them. G18 is the XZ plane addressed as (Z, X) and G19 is (Y, Z); that is
// why the centre letters rotate with the plane instead of always being I and J.
const PLANES = {
  XY: { u: 'X', v: 'Y', i: 'I', j: 'J' },
  XZ: { u: 'Z', v: 'X', i: 'K', j: 'I' },
  YZ: { u: 'Y', v: 'Z', i: 'J', j: 'K' },
};

/** Signed sweep from a0 to a1, always in the direction the command asked for. */
function sweepOf(a0, a1, clockwise) {
  let sweep = a1 - a0;
  if (clockwise) {
    while (sweep >= 0) sweep -= TAU;
    while (sweep < -TAU) sweep += TAU;
  } else {
    while (sweep <= 0) sweep += TAU;
    while (sweep > TAU) sweep -= TAU;
  }
  return sweep;
}

/**
 * Centre of an R-form arc. A positive R is the minor arc (≤180°), a negative R the major one;
 * both candidates are checked and the one whose sweep matches the sign is kept.
 */
function centreFromRadius(u0, v0, u1, v1, radius, clockwise) {
  const dx = u1 - u0;
  const dy = v1 - v0;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-9 || Math.abs(radius) < chord / 2 - 1e-9) return null;
  const h = Math.sqrt(Math.max(0, radius * radius - (chord * chord) / 4));
  const mx = (u0 + u1) / 2;
  const my = (v0 + v1) / 2;
  const nx = -dy / chord;
  const ny = dx / chord;
  const candidates = [
    { u: mx + nx * h, v: my + ny * h },
    { u: mx - nx * h, v: my - ny * h },
  ];
  const wantMinor = radius > 0;
  let best = null;
  for (const centre of candidates) {
    const sweep = Math.abs(sweepOf(
      Math.atan2(v0 - centre.v, u0 - centre.u),
      Math.atan2(v1 - centre.v, u1 - centre.u),
      clockwise,
    ));
    if (!best || (wantMinor ? sweep < best.sweep : sweep > best.sweep)) best = { centre, sweep };
  }
  return best.centre;
}

/**
 * Points along the arc, excluding the start and including the end. The step angle is the one whose
 * sagitta equals the tolerance, so the drawn curve is never further from the real arc than that.
 */
function arcPolyline({ u0, v0, u1, v1, cu, cv, clockwise, tolerance }) {
  const radius = Math.hypot(u0 - cu, v0 - cv);
  const a0 = Math.atan2(v0 - cv, u0 - cu);
  const a1 = Math.atan2(v1 - cv, u1 - cu);
  const sweep = sweepOf(a0, a1, clockwise);
  const maxStep = radius > tolerance ? 2 * Math.acos(1 - tolerance / radius) : Math.PI / 4;
  const segments = Math.min(4096, Math.max(1, Math.ceil(Math.abs(sweep) / maxStep)));
  const pts = [];
  for (let k = 1; k <= segments; k += 1) {
    const angle = a0 + (sweep * k) / segments;
    pts.push({ u: cu + radius * Math.cos(angle), v: cv + radius * Math.sin(angle) });
  }
  // Land exactly on the written endpoint: trigonometric drift must not move the part.
  pts[pts.length - 1] = { u: u1, v: v1 };
  return { pts, sweep, radius, segments };
}

export function parseGcode(text, { maxLines = DEFAULT_MAX_LINES, tolerance = ARC_TOLERANCE_MM } = {}) {
  const layers = [];
  const stats = {
    lines: 0,
    layers: 0,
    layerSource: 'z', // 'markers' | 'z'
    extrusion: 0,
    arcs: 0,
    arcSegments: 0,
    arcTolerance: tolerance,
    unsupported: [],
    truncated: false,
  };

  let current = null;
  let kind = null; // 'perimeter' | 'infill' | null
  let path = null;

  let x = 0;
  let y = 0;
  let z = 0;
  let absolute = true; // G90 / G91
  let relativeE = false; // M82 / M83
  let lastE = 0; // the extruder's own running total
  let tool = null;
  let afterToolChange = false; // the next E word establishes a counter instead of adding to it
  let plane = 'XY'; // G17 / G18 / G19
  let unit = 1; // G21 millimetres, G20 inches → 25.4

  // Layer boundaries come from the file's markers when it has them (our engine writes ";Layer 12",
  // PrusaSlicer ";LAYER_CHANGE", Cura ";LAYER:"). Nothing else is reliable: with z-hop on, Z
  // oscillates 0.3 → 0.6 → 0.3 inside a single layer.
  const hasMarkers = /^\s*;\s*LAYER/im.test(text);
  // LinuxCNC has no E, so our post writes filament on U. A file that also writes E is using U as a
  // real fourth axis, and counting it as filament would be wrong.
  const usesE = /(?:^|\s)E-?\d/m.test(text);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const note = (what) => {
    if (!stats.unsupported.includes(what)) stats.unsupported.push(what);
  };

  const flush = () => {
    if (path && path.pts.length > 1 && current) current.paths.push(path);
    path = null;
  };

  const enterLayer = (z0) => {
    flush();
    current = { z: z0, paths: [] };
    layers.push(current);
  };

  const trackZ = (nextZ) => {
    if (!current) {
      enterLayer(nextZ);
      return;
    }
    if (!hasMarkers) {
      // No markers: a rising Z is the only signal, and z-hop can fool it. The page says so.
      if (nextZ > current.z + 1e-6) enterLayer(nextZ);
      return;
    }
    // With markers, the marker starts the layer and the LOWEST Z before its first toolpath is its
    // height: the hop to 0.6 comes before the first extrude, and the layer is still the 0.3 one.
    if (current.paths.length === 0) current.z = Math.min(current.z ?? nextZ, nextZ);
  };

  const round = (value) => Math.round(value * 1000) / 1000;

  const grow = (px, py) => {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  };

  for (const raw of text.split(/\r?\n/)) {
    stats.lines += 1;
    if (stats.lines > maxLines) {
      stats.truncated = true;
      break;
    }

    const line = raw.trim();
    if (!line) continue;

    if (line[0] === ';') {
      if (/^;\s*Shell/i.test(line)) kind = 'perimeter';
      else if (/^;\s*(Internal|Solid)\s+Infill/i.test(line)) kind = 'infill';
      else if (/^;\s*LAYER/i.test(line)) {
        enterLayer(null);
        kind = null;
      }
      continue;
    }

    let words = null;
    WORD.lastIndex = 0;
    for (let m = WORD.exec(line); m; m = WORD.exec(line)) {
      (words ??= {})[m[1].toUpperCase()] = Number(m[2]);
    }
    if (!words) continue;

    // A tool change starts a new extruder with its own filament counter, so its first E word only
    // establishes that counter. The first T in a file is not a change — a leading "T0" is how
    // single-extruder files start, and dropping the first move there would be its own lie.
    if (words.T !== undefined) {
      if (tool !== null && tool !== words.T) afterToolChange = true;
      tool = words.T;
      flush();
      continue;
    }

    const head = /^([GM])\s*\d/i.exec(line);
    const command = head ? head[1].toUpperCase() : '';
    const number = head ? Number(/\d+/.exec(line)[0]) : -1;

    if (command === 'M') {
      if (number === 82) {
        // Coming from relative extrusion there is no absolute total to compare against, so the
        // first absolute value after the switch establishes one.
        if (relativeE) afterToolChange = true;
        relativeE = false;
      } else if (number === 83) relativeE = true;
      continue;
    }
    if (command !== 'G') continue;

    // Units and plane are modal and affect every coordinate after them, so they are read before
    // anything that turns a word into millimetres.
    if (number === 20) {
      unit = 25.4;
      note('G20 (palce) — souřadnice přepočítané na mm');
      continue;
    }
    if (number === 21) {
      unit = 1;
      continue;
    }
    if (number === 17) {
      plane = 'XY';
      continue;
    }
    if (number === 18) {
      plane = 'XZ';
      continue;
    }
    if (number === 19) {
      plane = 'YZ';
      continue;
    }

    if (number === 90) absolute = true;
    else if (number === 91) absolute = false;
    else if (number === 92) {
      // G92 redefines the current position without moving. Without this, the next absolute move
      // after a reset/counter change is measured from a stale position.
      if (words.X !== undefined) x = words.X * unit;
      if (words.Y !== undefined) y = words.Y * unit;
      if (words.Z !== undefined) z = words.Z * unit;
      const reset = usesE ? words.E : words.U;
      if (reset !== undefined) {
        lastE = reset * unit;
        afterToolChange = false;
      }
    } else if (number !== 0 && number !== 1 && number !== 2 && number !== 3) {
      continue;
    }

    const isArc = number === 2 || number === 3;

    // The start of this move, before any word changes the position.
    const fromX = x;
    const fromY = y;
    const fromZ = z;

    if (words.Z !== undefined) {
      z = absolute ? words.Z * unit : z + words.Z * unit;
      trackZ(round(z));
    }

    const hasXY = words.X !== undefined || words.Y !== undefined;
    const written = usesE ? words.E : words.U;
    let deposit = 0;
    if (written !== undefined) {
      const amount = written * unit;
      if (relativeE) deposit = amount;
      else if (afterToolChange) {
        lastE = amount;
        afterToolChange = false;
      } else {
        deposit = amount - lastE;
        lastE = amount;
      }
    }

    // ── the arc, if this move is one ────────────────────────────────────────────────────────
    let arcXY = null;
    if (isArc) {
      stats.arcs += 1;
      const axes = PLANES[plane];
      const toWorld = (u, v) => (plane === 'XY'
        ? { x: u, y: v }
        : plane === 'XZ'
          ? { x: v, y: fromY } // XZ: Y is the plane's normal and does not move
          : { x: fromX, y: u }); // YZ: X is the normal

      const startU = plane === 'XY' ? fromX : plane === 'XZ' ? fromZ : fromY;
      const startV = plane === 'XY' ? fromY : plane === 'XZ' ? fromX : fromZ;
      const endU = plane === 'XY' ? (words.X !== undefined ? (absolute ? words.X * unit : fromX + words.X * unit) : fromX)
        : plane === 'XZ' ? z
          : (words.Y !== undefined ? (absolute ? words.Y * unit : fromY + words.Y * unit) : fromY);
      const endV = plane === 'XY' ? (words.Y !== undefined ? (absolute ? words.Y * unit : fromY + words.Y * unit) : fromY)
        : plane === 'XZ' ? (words.X !== undefined ? (absolute ? words.X * unit : fromX + words.X * unit) : fromX)
          : z;

      const iWord = words[axes.i];
      const jWord = words[axes.j];
      const radiusWord = words.R;

      let centre = null;
      if (radiusWord !== undefined) {
        if (iWord !== undefined || jWord !== undefined) {
          note('G2/G3 s I/J i R — počítá se z R');
        }
        centre = centreFromRadius(startU, startV, endU, endV, radiusWord * unit, number === 2);
      } else if (iWord !== undefined || jWord !== undefined) {
        centre = {
          u: startU + (iWord ?? 0) * unit,
          v: startV + (jWord ?? 0) * unit,
        };
      }

      if (!centre) {
        // No usable centre: this is a straight move, and saying so is better than pretending.
        note('G2/G3 bez středu nebo poloměru — kreslí se jako přímka');
      } else if (plane !== 'XY') {
        note(`G18/G19 (oblouk mimo rovinu XY) — kreslí se průmět do XY`);
      }

      if (centre) {
        const arc = arcPolyline({
          u0: startU, v0: startV, u1: endU, v1: endV,
          cu: centre.u, cv: centre.v,
          clockwise: number === 2,
          tolerance,
        });
        stats.arcSegments += arc.segments;
        arcXY = arc.pts.map(({ u, v }) => toWorld(u, v));
      }
    }

    if (!hasXY && !arcXY) continue;

    const px = fromX;
    const py = fromY;
    x = words.X !== undefined ? (absolute ? words.X * unit : x + words.X * unit) : x;
    y = words.Y !== undefined ? (absolute ? words.Y * unit : y + words.Y * unit) : y;

    // A move without positive deposit is travel: a retraction, an unretract, or a hop. Drawing it
    // would put a line where the machine put nothing, and counting it as filament would inflate
    // every retraction on the way out and back in.
    if (!(deposit > 0)) {
      flush();
      continue;
    }
    stats.extrusion += deposit;

    trackZ(round(z));
    const points = arcXY ?? [{ x, y }];
    if (!path || path.kind !== (kind ?? 'infill')) {
      flush();
      path = { kind: kind ?? 'infill', pts: [{ x: px, y: py }, ...points] };
    } else {
      path.pts.push(...points);
    }
    grow(px, py);
    for (const point of points) grow(point.x, point.y);
  }

  flush();

  // A layer with no toolpath is not a layer: an initial Z30 move before the first marker, or a
  // trailing marker, would otherwise become an empty layer to scrub through.
  const drawn = layers
    .filter((layer) => layer.paths.length > 0)
    .map((layer) => ({ ...layer, z: layer.z ?? 0 }));

  stats.layers = drawn.length;
  stats.layerSource = hasMarkers ? 'markers' : 'z';

  const bounds = minX !== Infinity
    ? { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
    : null;

  return { layers: drawn, bounds, stats };
}
