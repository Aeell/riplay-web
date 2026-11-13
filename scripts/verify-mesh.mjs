// Proves T2's conversions instead of trusting them: a known 10 mm cube goes through every
// reader and writer, and the geometry that comes back must be the geometry that went in.
// Run: node scripts/verify-mesh.mjs

import { meshFrom, writeMesh, stats, scaleMesh, outputName, detectFormat } from '../src/lib/mesh.mjs';

let failures = 0;
const check = (name, condition, detail = '') => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!condition) failures += 1;
};
const close = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

// A 10 × 10 × 10 cube, 12 triangles, wound outwards. Volume 1000, bbox 0..10.
function cube(size = 10) {
  const v = (x, y, z) => [x * size, y * size, z * size];
  const p = [v(0, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 1, 0), v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)];
  const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  const out = [];
  for (const face of faces) for (const corner of face) out.push(...p[corner]);
  return new Float32Array(out);
}

const source = cube();
const expected = stats(source);
check('cube has 12 triangles', expected.triangles === 12, `${expected.triangles}`);
check('cube volume is 1000 mm³', close(expected.volume, 1000, 1e-4), expected.volume.toFixed(3));

// Every writer must round-trip through its own reader unchanged.
for (const format of ['stl', 'obj', 'ply', 'glb']) {
  const { bytes } = writeMesh(source, format);
  const back = meshFrom(`cube.${format}`, bytes);
  const got = stats(back.tris);
  const same = got.triangles === 12
    && close(got.volume, 1000, 1e-3)
    && got.size.every((value) => close(value, 10, 1e-5));
  check(`${format.toUpperCase()} round-trip keeps the cube`, same, `${got.triangles} tris, ${got.volume.toFixed(3)} mm³, ${got.size.map((v) => v.toFixed(3)).join(' × ')}`);
  check(`${format.toUpperCase()} names the format it read`, back.format.startsWith(format), back.format);
}

// ASCII STL must be detected, not fed to the binary reader.
const asciiStl = `solid cube\n facet normal 0 0 0\n  outer loop\n   vertex 0 0 0\n   vertex 0 10 0\n   vertex 10 0 0\n  endloop\n endfacet\nendsolid cube\n`;
const fromAscii = meshFrom('cube.stl', new TextEncoder().encode(asciiStl));
check('ASCII STL is detected as ASCII', fromAscii.format === 'stl-ascii', fromAscii.format);
check('ASCII STL yields one triangle', fromAscii.tris.length === 9);

// OBJ quads are fan-triangulated (a quad is 2 triangles, not 1 and not 4).
const quadObj = 'v 0 0 0\nv 10 0 0\nv 10 0 10\nv 0 0 10\nf 1 2 3 4\n';
const quad = meshFrom('quad.obj', new TextEncoder().encode(quadObj));
check('OBJ quad becomes two triangles', quad.tris.length === 18, `${quad.tris.length / 9} tris`);

// Negative OBJ indices mean "relative to the end" and are common in exports.
const negativeObj = 'v 0 0 0\nv 10 0 0\nv 0 10 0\nf -3 -2 -1\n';
check('OBJ negative indices resolve', meshFrom('neg.obj', new TextEncoder().encode(negativeObj)).tris.length === 9);

// Binary PLY: header is ASCII, body is little-endian floats, so it exercises a second path.
function binaryPly(triangles) {
  const header = [
    'ply', 'format binary_little_endian 1.0',
    `element vertex ${triangles * 3}`,
    'property float x', 'property float y', 'property float z',
    `element face ${triangles}`,
    'property list uchar int vertex_indices', 'end_header', '',
  ].join('\n');
  const head = new TextEncoder().encode(header);
  const body = new Uint8Array(triangles * 36 + triangles * 13);
  const view = new DataView(body.buffer);
  let at = 0;
  for (let i = 0; i < triangles; i += 1) {
    for (let v = 0; v < 3; v += 1) {
      view.setFloat32(at, i + v, true); at += 4;
      view.setFloat32(at, 0, true); at += 4;
      view.setFloat32(at, 0, true); at += 4;
    }
  }
  for (let i = 0; i < triangles; i += 1) {
    view.setUint8(at, 3); at += 1;
    for (let v = 0; v < 3; v += 1) { view.setInt32(at, i * 3 + v, true); at += 4; }
  }
  const out = new Uint8Array(head.length + body.length);
  out.set(head); out.set(body, head.length);
  return out;
}
const binaryPlyMesh = meshFrom('binary.ply', binaryPly(2));
check('binary_little_endian PLY reads', binaryPlyMesh.tris.length === 18, `${binaryPlyMesh.tris.length / 9} tris`);

// A GLB node transform must be applied, or the model silently moves in the output.
function glbWithTransform() {
  const positions = new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]);
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, translation: [100, 0, 0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [10, 10, 0] }],
    bufferViews: [{ buffer: 0, byteLength: positions.byteLength }],
    buffers: [{ byteLength: positions.byteLength }],
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadded = new Uint8Array(jsonBytes.length + ((4 - (jsonBytes.length % 4)) % 4)).fill(0x20);
  jsonPadded.set(jsonBytes);
  const bin = new Uint8Array(positions.buffer);
  const total = 12 + 8 + jsonPadded.length + 8 + bin.length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, total, true);
  view.setUint32(12, jsonPadded.length, true); view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonPadded, 20);
  const binStart = 20 + jsonPadded.length;
  view.setUint32(binStart, bin.length, true); view.setUint32(binStart + 4, 0x004e4942, true);
  out.set(bin, binStart + 8);
  return out;
}
const moved = stats(meshFrom('moved.glb', glbWithTransform()).tris);
check('GLB node translation is applied', close(moved.min[0], 100, 1e-4), `min.x = ${moved.min[0]}`);

// Scale is the one thing a unit-less STL cannot tell us, so it must be exactly what was asked.
const doubled = stats(scaleMesh(source, 2));
check('scale ×2 doubles the size', doubled.size.every((value) => close(value, 20, 1e-4)), doubled.size.join(' × '));
check('scale ×2 multiplies volume by 8', close(doubled.volume, 8000, 1e-3), doubled.volume.toFixed(2));

// Failures must be legible, not silent.
let message = '';
try { detectFormat('part.step'); } catch (error) { message = error.message; }
check('unknown extension is refused with a message', /neumím/.test(message), message);
message = '';
try { meshFrom('empty.stl', new Uint8Array(84)); } catch (error) { message = error.message; }
check('truncated STL is refused, not guessed at', message.length > 0, message);

// PLY must be read by property name and type, not by position: scanners write normals and
// colour before x/y/z, and some emit doubles.
function plyBinaryWithLeadingColour() {
  const header = [
    'ply', 'format binary_little_endian 1.0',
    'element vertex 3',
    'property uchar red', 'property double x', 'property double y', 'property double z',
    'element face 1',
    'property list uchar int vertex_indices',
    'end_header', '',
  ].join('\n');
  const head = new TextEncoder().encode(header);
  const body = new DataView(new ArrayBuffer(3 * 25 + 13));
  let at = 0;
  const vertices = [[0, 0, 0], [10, 0, 0], [0, 10, 0]];
  for (const [x, y, z] of vertices) {
    body.setUint8(at, 200); at += 1;
    body.setFloat64(at, x, true); at += 8;
    body.setFloat64(at, y, true); at += 8;
    body.setFloat64(at, z, true); at += 8;
  }
  body.setUint8(at, 3); at += 1;
  for (const index of [0, 1, 2]) { body.setInt32(at, index, true); at += 4; }
  const out = new Uint8Array(head.length + at);
  out.set(head); out.set(new Uint8Array(body.buffer, 0, at), head.length);
  return out;
}
const named = stats(meshFrom('named.ply', plyBinaryWithLeadingColour()).tris);
check('PLY reads x/y/z by name, not position', close(named.min[0], 0, 1e-9) && close(named.max[0], 10, 1e-9) && close(named.max[1], 10, 1e-9), `${named.size.map((v) => v.toFixed(1)).join(' × ')}`);
check('PLY reads double coordinates', close(named.triangles, 1), `${named.triangles} tri`);

let plyMessage = '';
try {
  meshFrom('bad.ply', new TextEncoder().encode('ply\nformat ascii 1.0\nelement vertex 3\nproperty long x\nproperty long y\nproperty long z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n'));
} catch (error) { plyMessage = error.message; }
check('PLY refuses a type it cannot read', /typ/.test(plyMessage), plyMessage);

plyMessage = '';
try {
  meshFrom('missing.ply', new TextEncoder().encode('ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nelement face 0\nproperty list uchar int vertex_indices\nend_header\n0 0\n'));
} catch (error) { plyMessage = error.message; }
check('PLY refuses a missing coordinate', /z/.test(plyMessage), plyMessage);

// The triangle ceiling must be enforced by every reader, from the header where possible.
let ceiling = '';
try {
  const stl = new Uint8Array(84);
  new DataView(stl.buffer).setUint32(80, 2_000_000, true);
  meshFrom('huge.stl', stl);
} catch (error) { ceiling = error.message; }
check('STL triangle ceiling is refused from the header', /limit/.test(ceiling), ceiling.slice(0, 60));

ceiling = '';
try {
  meshFrom('huge.ply', new TextEncoder().encode('ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 2000000\nproperty list uchar int vertex_indices\nend_header\n'));
} catch (error) { ceiling = error.message; }
check('PLY triangle ceiling is refused from the header', /limit/.test(ceiling), ceiling.slice(0, 60));

ceiling = '';
try {
  const json = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 6_000_003, type: 'VEC3' }],
    bufferViews: [{ buffer: 0, byteLength: 12 }], buffers: [{ byteLength: 12 }],
  };
  const jb = new TextEncoder().encode(JSON.stringify(json));
  const jp = new Uint8Array(jb.length + ((4 - (jb.length % 4)) % 4)).fill(0x20);
  jp.set(jb);
  const total = 12 + 8 + jp.length + 8 + 12;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, total, true);
  view.setUint32(12, jp.length, true); view.setUint32(16, 0x4e4f534a, true);
  out.set(jp, 20);
  const binStart = 20 + jp.length;
  view.setUint32(binStart, 12, true); view.setUint32(binStart + 4, 0x004e4942, true);
  meshFrom('huge.glb', out);
} catch (error) { ceiling = error.message; }
check('GLB triangle ceiling is refused from the accessors', /limit/.test(ceiling), ceiling.slice(0, 60));

let bigMessage = '';
try { meshFrom('huge.stl', new Uint8Array(41 * 1024 * 1024)); } catch (error) { bigMessage = error.message; }
check('oversized model is refused before parsing', /MB/.test(bigMessage), bigMessage.slice(0, 55));

check('output name strips diacritics and spaces', outputName('Příruba 2.stl', 'obj') === 'priruba-2.obj', outputName('Příruba 2.stl', 'obj'));

console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
