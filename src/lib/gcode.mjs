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

// A file is untrusted input, so an arc can ask for an unbounded number of points (a 10 km radius
// at 0.02 mm wants ~5 000). Past this the arc is simplified and the deviation it actually got is
// written into the notes: a ceiling that stayed quiet would be a tolerance claim that is not true.
export const ARC_MAX_SEGMENTS = 4096;

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
  if (!Number.isFinite(radius) || radius < 1e-9) {
    // A centre on the start point defines no arc, only the point the file names.
    return { pts: [{ u: u1, v: v1 }], segments: 0, chordError: 0, honoured: true };
  }
  const a0 = Math.atan2(v0 - cv, u0 - cu);
  const a1 = Math.atan2(v1 - cv, u1 - cu);
  const sweep = sweepOf(a0, a1, clockwise);
  // Sagitta = r(1 − cos(step/2)); solve for the step that lands exactly on the tolerance. A radius
  // no larger than the tolerance already fits inside it, so a quarter turn is one segment.
  const maxStep = radius > tolerance ? 2 * Math.acos(1 - tolerance / radius) : Math.PI / 2;
  const needed = Math.max(1, Math.ceil(Math.abs(sweep) / maxStep));
  const segments = Math.min(needed, ARC_MAX_SEGMENTS);
  const chordError = radius * (1 - Math.cos(Math.abs(sweep) / segments / 2));
  const pts = [];
  for (let k = 1; k <= segments; k += 1) {
    const angle = a0 + (sweep * k) / segments;
    pts.push({ u: cu + radius * Math.cos(angle), v: cv + radius * Math.sin(angle) });
  }
  // Land exactly on the written endpoint: trigonometric drift must not move the part.
  pts[pts.length - 1] = { u: u1, v: v1 };
  return { pts, segments, chordError, honoured: segments === needed };
}

export function parseGcode(text, { maxLines = DEFAULT_MAX_LINES, tolerance = ARC_TOLERANCE_MM } = {}) {
  const tol = Number.isFinite(tolerance) && tolerance > 0 ? tolerance : ARC_TOLERANCE_MM;
  const layers = [];
  const stats = {
    lines: 0,
    layers: 0,
    layerSource: 'z', // 'markers' | 'z'
    extrusion: 0,
    arcs: 0,
    arcSegments: 0,
    arcTolerance: tol,
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

    if (number === 90 || number === 91) {
      absolute = number === 90;
      continue;
    }
    if (number === 92) {
      // G92 redefines the current position without moving. Without this, the next absolute move
      // after a reset/counter change is measured from a stale position; without the `continue`,
      // G91 turns the same line into a move as well.
      if (words.X !== undefined) x = words.X * unit;
      if (words.Y !== undefined) y = words.Y * unit;
      if (words.Z !== undefined) z = words.Z * unit;
      const reset = usesE ? words.E : words.U;
      if (reset !== undefined) {
        lastE = reset * unit;
        afterToolChange = false;
      }
      continue;
    }
    if (number !== 0 && number !== 1 && number !== 2 && number !== 3) continue;

    const isArc = number === 2 || number === 3;

    // The start of this move, before any word changes the position.
    const fromX = x;
    const fromY = y;
    const fromZ = z;

    if (words.Z !== undefined) {
      z = absolute ? words.Z * unit : z + words.Z * unit;
      trackZ(round(z));
    }

    // The one place a move's endpoint is worked out: the arc and the path that follows it must
    // end at the same point, so neither may compute it separately.
    const nx = words.X !== undefined ? (absolute ? words.X * unit : fromX + words.X * unit) : fromX;
    const ny = words.Y !== undefined ? (absolute ? words.Y * unit : fromY + words.Y * unit) : fromY;
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
      // PLANES is the only place a plane's axes are written down: conversion in and back out both
      // read it, so the start point, the end point and the projection cannot disagree. The axis not
      // named by the plane is its normal and keeps its value throughout the arc.
      const inPlane = (wx, wy, wz) => {
        const world = { X: wx, Y: wy, Z: wz };
        return { u: world[axes.u], v: world[axes.v] };
      };
      const toWorld = (u, v) => {
        const world = { X: fromX, Y: fromY, Z: fromZ };
        world[axes.u] = u;
        world[axes.v] = v;
        return { x: world.X, y: world.Y };
      };

      const start = inPlane(fromX, fromY, fromZ);
      const end = inPlane(nx, ny, z);

      const iWord = words[axes.i];
      const jWord = words[axes.j];
      const radiusWord = words.R;

      let centre = null;
      if (radiusWord !== undefined) {
        if (iWord !== undefined || jWord !== undefined) {
          note('G2/G3 s I/J i R — počítá se z R');
        }
        centre = centreFromRadius(start.u, start.v, end.u, end.v, radiusWord * unit, number === 2);
      } else if (iWord !== undefined || jWord !== undefined) {
        centre = {
          u: start.u + (iWord ?? 0) * unit,
          v: start.v + (jWord ?? 0) * unit,
        };
      }

      if (!centre) {
        // No usable centre: this is a straight move, and saying so is better than pretending. An R
        // that cannot define an arc (no chord, or shorter than half of it) is named as such.
        note(radiusWord !== undefined
          ? 'G2/G3 s R, které oblouk neurčuje — kreslí se jako přímka'
          : 'G2/G3 bez středu nebo poloměru — kreslí se jako přímka');
      } else {
        if (plane !== 'XY') note('G18/G19 (oblouk mimo rovinu XY) — kreslí se průmět do XY');
        const arc = arcPolyline({
          u0: start.u, v0: start.v, u1: end.u, v1: end.v,
          cu: centre.u, cv: centre.v,
          clockwise: number === 2,
          tolerance: tol,
        });
        stats.arcSegments += arc.segments;
        if (!arc.honoured) {
          note(`oblouk je zjednodušený — tětivy se od oblouku odchylují až ${arc.chordError.toFixed(2).replace('.', ',')} mm`);
        }
        arcXY = arc.pts.map(({ u, v }) => toWorld(u, v));
      }
    }

    if (!hasXY && !arcXY) continue;

    const px = fromX;
    const py = fromY;
    x = nx;
    y = ny;

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
