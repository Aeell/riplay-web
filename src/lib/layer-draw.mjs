/**
 * Drawing G-code paths on a canvas.
 *
 * Shared by the toolbox viewer (`/nastroje/vrstvy`) and the homepage Replay, so the paths on the
 * homepage are drawn by the same code that reads them — not by a second, prettier drawing of
 * what a toolpath looks like.
 *
 * G-code Y grows upwards, canvas Y grows downwards, so `y()` flips it. Millimetres go in,
 * millimetres come out: the only scaling here is the fit to the canvas, and it is uniform.
 */

/** Bounding box of a list of paths, in the source units (mm). */
export function pathBounds(paths) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const path of paths) {
    for (const pt of path.pts) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Sizes a canvas for the display density and returns a context already scaled to CSS pixels,
 * so callers draw in CSS units. Returns null when the element has no layout yet.
 */
export function sizeCanvas(canvas, maxDpr = 2) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.round(width * dpr);
  const h = Math.round(height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

/** Uniform fit of a millimetre box into a pixel box, with the same padding on every side. */
export function fitTransform(bounds, width, height, pad = 20) {
  if (!bounds || !(bounds.width > 0) || !(bounds.height > 0)) return null;
  const scale = Math.min((width - pad * 2) / bounds.width, (height - pad * 2) / bounds.height);
  if (!(scale > 0)) return null;
  const ox = (width - bounds.width * scale) / 2;
  const oy = (height - bounds.height * scale) / 2;
  return {
    scale,
    x: (v) => ox + (v - bounds.minX) * scale,
    y: (v) => height - oy - (v - bounds.minY) * scale,
  };
}

const DEFAULT_INK = { perimeter: '#e9e7e2', infill: '#4b5157', lineWidth: 1 };

/** Strokes one layer. Infill first, so perimeters stay readable on top of it. */
export function paintLayer(ctx, layer, t, ink = {}) {
  const { perimeter, infill, lineWidth } = { ...DEFAULT_INK, ...ink };
  for (const [kind, colour, width] of [
    ['infill', infill, lineWidth * 0.75],
    ['perimeter', perimeter, lineWidth],
  ]) {
    ctx.beginPath();
    for (const path of layer.paths) {
      if (path.kind !== kind) continue;
      path.pts.forEach((pt, i) => {
        const x = t.x(pt.x);
        const y = t.y(pt.y);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

/** Strokes layers 0…upTo, which is what "the print so far" looks like. */
export function paintStack(ctx, layers, upTo, t, ink = {}) {
  for (let i = 0; i <= Math.min(upTo, layers.length - 1); i += 1) paintLayer(ctx, layers[i], t, ink);
}
