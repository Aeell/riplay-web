// A G-code reader for the layer viewer. It answers one question: what will the machine actually
// run, layer by layer. It is not a simulator — no acceleration, pressure advance or machine state.
//
// The engine this workshop uses marks each layer with ";Layer <n>" and each region with
// ;Shell / ;Solid Infill / ;Internal Infill. Those markers decide the path colour; a file without
// them still renders, in one colour, because guessing is worse than plain.

// A letter followed by a number: "X10", "E-0.8", "U1.25".
const WORD = /([A-Za-z])(-?\d*\.?\d+)/g;

// 40 MB of short G-code lines is roughly a million of them, so the line ceiling matches the file
// ceiling: a file the tool accepts is a file it reads whole.
const DEFAULT_MAX_LINES = 1_000_000;

export function parseGcode(text, { maxLines = DEFAULT_MAX_LINES } = {}) {
  const layers = [];
  const stats = {
    lines: 0,
    layers: 0,
    layerSource: 'z', // 'markers' | 'z'
    extrusion: 0,
    arcs: 0,
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

    if (number === 90) absolute = true;
    else if (number === 91) absolute = false;
    else if (number === 92) {
      // G92 redefines the current position without moving. Without this, the next absolute move
      // after a reset/counter change is measured from a stale position.
      if (words.X !== undefined) x = words.X;
      if (words.Y !== undefined) y = words.Y;
      if (words.Z !== undefined) z = words.Z;
      const reset = usesE ? words.E : words.U;
      if (reset !== undefined) {
        lastE = reset;
        afterToolChange = false;
      }
    } else if (number === 2 || number === 3) {
      stats.arcs += 1;
      note('G2/G3 (oblouky) — kreslí se jen koncový bod');
    } else if (number !== 0 && number !== 1) {
      continue;
    }

    if (words.Z !== undefined) {
      z = absolute ? words.Z : z + words.Z;
      trackZ(round(z));
    }

    const hasXY = words.X !== undefined || words.Y !== undefined;
    const written = usesE ? words.E : words.U;
    let deposit = 0;
    if (written !== undefined) {
      if (relativeE) deposit = written;
      else if (afterToolChange) {
        lastE = written;
        afterToolChange = false;
      } else {
        deposit = written - lastE;
        lastE = written;
      }
    }

    if (!hasXY) continue;

    const px = x;
    const py = y;
    x = words.X !== undefined ? (absolute ? words.X : x + words.X) : x;
    y = words.Y !== undefined ? (absolute ? words.Y : y + words.Y) : y;

    // A move without positive deposit is travel: a retraction, an unretract, or a hop. Drawing it
    // would put a line where the machine put nothing, and counting it as filament would inflate
    // every retraction on the way out and back in.
    if (!(deposit > 0)) {
      flush();
      continue;
    }
    stats.extrusion += deposit;

    trackZ(round(z));
    if (!path || path.kind !== (kind ?? 'infill')) {
      flush();
      path = { kind: kind ?? 'infill', pts: [{ x: px, y: py }, { x, y }] };
    } else {
      path.pts.push({ x, y });
    }
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
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
