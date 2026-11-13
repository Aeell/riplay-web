// A G-code reader for the layer viewer. It answers one question: what will the machine
// actually run, layer by layer. It is deliberately not a G-code simulator — it does not model
// acceleration, pressure advance or machine state.
//
// The engine this workshop uses marks each layer with ";Layer <n>" and each region with
// ;Shell / ;Solid Infill / ;Internal Infill. Those markers decide the path colour; a file
// without them still renders, just in one colour, because guessing is worse than plain.

const WORD = /([A-Za-z])(-?\d*\.?\d+)/g;

// 40 MB of short G-code lines is roughly a million of them, so the line ceiling matches the
// file ceiling: a file the tool accepts is a file it reads whole.
export function parseGcode(text, { maxLines = 1_000_000 } = {}) {
  const layers = [];
  let current = null;
  let kind = null; // 'perimeter' | 'infill' | null
  let path = null; // the polyline being built

  let x = 0;
  let y = 0;
  let z = 0;
  let absolute = true;
  // Absolute extrusion words carry a running total (E1, E2, E3 = 2 mm of filament), so the
  // distance travelled is the delta, not the value. Our own post uses U for the same thing.
  let lastE = 0;
  let lastU = 0;

  // Layer boundaries come from the file's own markers when it has them (our engine writes
  // ";Layer 12", PrusaSlicer ";LAYER_CHANGE", Cura ";LAYER:"). That is the only reliable source:
  // with z-hop on, Z oscillates 0.3 → 0.6 → 0.3 inside a single layer.
  const hasMarkers = /^\s*;\s*LAYER/im.test(text); // ;Layer 0, ;LAYER:, ;LAYER_CHANGE

  const stats = {
    lines: 0,
    layers: 0,
    moves: 0,
    perimeterPaths: 0,
    infillPaths: 0,
    travelMoves: 0,
    extrusion: 0,
    arcs: 0,
    unsupported: [],
    truncated: false,
  };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const flush = () => {
    if (path && path.pts.length > 1 && current) {
      current.paths.push(path);
      if (path.kind === 'perimeter') stats.perimeterPaths += 1;
      else stats.infillPaths += 1;
    }
    path = null;
  };

  // A new layer starts when Z rises. It must not start when Z falls: z-hop lifts and drops the
  // nozzle inside the same layer, and treating each hop as a layer turned a 445-layer print into
  // 51 365 empty "layers" the first time this reader met a real file.
  const startLayer = (z0) => {
    flush();
    current = { z: z0, paths: [] };
    layers.push(current);
  };

  const ensureLayer = (nextZ) => {
    if (!current) {
      startLayer(nextZ);
      return;
    }
    if (!hasMarkers) {
      // No markers: a rising Z is the only signal, and z-hop can fool it. The page says so
      // rather than pretending the layer list is exact.
      if (nextZ > current.z + 1e-6) startLayer(nextZ);
      return;
    }
    // With markers, the marker decides where a layer starts. The layer's height is the LOWEST Z
    // before its first toolpath: z-hop lifts to 0.6 before the first extrude, and the layer is
    // still the 0.3 one.
    if (current.z === null || current.paths.length === 0) {
      current.z = current.z === null ? nextZ : Math.min(current.z, nextZ);
    }
  };

  const note = (what) => {
    if (!stats.unsupported.includes(what)) stats.unsupported.push(what);
  };

  for (const raw of text.split(/\r?\n/)) {
    stats.lines += 1;
    if (stats.lines > maxLines) {
      stats.truncated = true;
      break;
    }

    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith(';')) {
      if (/^;\s*Shell/i.test(line)) kind = 'perimeter';
      else if (/^;\s*(Internal|Solid)\s+Infill/i.test(line)) kind = 'infill';
      else if (/^;\s*LAYER/i.test(line)) {
        startLayer(null); // height comes from the Z moves inside the layer
        kind = null;
      }
      continue;
    }

    const words = {};
    WORD.lastIndex = 0;
    let match;
    while ((match = WORD.exec(line)) !== null) words[match[1].toUpperCase()] = Number(match[2]);
    if (Object.keys(words).length === 0) continue;

    const code = /^([GM])\s*(\d+(?:\.\d+)?)/i.exec(line);
    const letter = code ? code[1].toUpperCase() : '';
    const number = code ? Number(code[2]) : null;

    if (letter === 'M') continue;

    if (number === 91) {
      note('G91 (relativní souřadnice) — náhled počítá s absolutními');
      absolute = false;
      continue;
    }
    if (number === 90) {
      absolute = true;
      continue;
    }
    if (number === 2 || number === 3) {
      stats.arcs += 1;
      note('G2/G3 (oblouky) — kreslí se jen koncový bod');
    }
    if (number !== 0 && number !== 1 && number !== 2 && number !== 3) continue;

    if (words.Z !== undefined) {
      z = words.Z;
      ensureLayer(round(z));
    }

    const hasXY = words.X !== undefined || words.Y !== undefined;
    if (!hasXY) continue;

    const nx = words.X !== undefined ? (absolute ? words.X : x + words.X) : x;
    const ny = words.Y !== undefined ? (absolute ? words.Y : y + words.Y) : y;
    // Where the move starts. A path has to remember it, or every path loses its first segment
    // and a path made of one move disappears entirely.
    const px = x;
    const py = y;
    x = nx;
    y = ny;
    stats.moves += 1;

    const extruding = words.U !== undefined || words.E !== undefined;
    if (!extruding) {
      stats.travelMoves += 1;
      flush();
      continue;
    }
    if (words.E !== undefined) {
      stats.extrusion += absolute ? Math.abs(words.E - lastE) : Math.abs(words.E);
      lastE = words.E;
    }
    if (words.U !== undefined) {
      stats.extrusion += absolute ? Math.abs(words.U - lastU) : Math.abs(words.U);
      lastU = words.U;
    }

    ensureLayer(round(z));
    if (!path || path.kind !== (kind ?? 'infill')) {
      flush();
      path = { kind: kind ?? 'infill', pts: [{ x: px, y: py }, { x, y }] };
    } else {
      path.pts.push({ x, y });
    }
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  flush();

  // Layers that never produced a toolpath are not layers: an initial Z30 move before the first
  // marker, or a trailing marker, would otherwise show as an empty layer the user can scrub to.
  const drawn = layers
    .filter((layer) => layer.paths.length > 0)
    .map((layer) => ({ ...layer, z: layer.z ?? 0 }));
  stats.layers = drawn.length;
  stats.layerSource = hasMarkers ? 'markers' : 'z';

  const bounds = layers.length && minX !== Infinity
    ? { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
    : null;

  return { layers: drawn, bounds, stats };
}

const round = (value) => Math.round(value * 1000) / 1000;
