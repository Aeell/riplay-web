// Mesh formats, written here rather than pulled in: STL, OBJ, PLY and GLB in, and the
// same four out. Everything is a triangle soup in the file's own units — no scene graph,
// no materials, no colour — because that is what a mill or a slicer actually consumes.
//
// Units are not stored in any of these formats except by convention, so nothing here
// guesses them; the page says so and offers an explicit scale factor.

const cube = (bytes) => new Uint8Array(bytes);

// --- reading -----------------------------------------------------------------

function readStlBinary(bytes) {
  if (bytes.byteLength < 84) throw new Error('STL je kratší než hlavička — soubor je poškozený');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  if (!count) throw new Error('STL neobsahuje žádné trojúhelníky');
  const expected = 84 + count * 50;
  if (expected !== bytes.byteLength) throw new Error(`STL hlásí ${count} trojúhelníků, ale velikost nesedí`);

  const out = new Float32Array(count * 9);
  for (let i = 0; i < count; i += 1) {
    const base = 84 + i * 50 + 12; // skip the normal, it is recomputable
    for (let v = 0; v < 9; v += 1) out[i * 9 + v] = view.getFloat32(base + v * 4, true);
  }
  return out;
}

function readStlAscii(text) {
  const numbers = [];
  const vertex = /vertex\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/g;
  for (const match of text.matchAll(vertex)) numbers.push(+match[1], +match[2], +match[3]);
  if (!numbers.length) throw new Error('v ASCII STL nejsou žádné vrcholy');
  if (numbers.length % 9 !== 0) throw new Error('ASCII STL nemá celé trojúhelníky');
  return new Float32Array(numbers);
}

function readObj(text) {
  const positions = [];
  const out = [];
  const index = (token) => {
    const raw = Number.parseInt(token.split('/')[0], 10);
    if (!Number.isFinite(raw) || raw === 0) throw new Error('OBJ má nečitelný index plochy');
    return raw > 0 ? raw - 1 : positions.length / 3 + raw; // negative indices are relative
  };

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.trim().split(/\s+/);
      positions.push(+x, +y, +z);
    } else if (line.startsWith('f ')) {
      const corners = line.trim().split(/\s+/).slice(1).map(index);
      // Fan-triangulate: quads and n-gons are common in exports from CAD.
      for (let i = 1; i + 1 < corners.length; i += 1) {
        for (const corner of [corners[0], corners[i], corners[i + 1]]) {
          out.push(positions[corner * 3], positions[corner * 3 + 1], positions[corner * 3 + 2]);
        }
      }
    }
  }
  if (!out.length) throw new Error('v OBJ nejsou žádné plochy');
  return new Float32Array(out);
}

function readPly(bytes) {
  // The header is ASCII even in binary PLY, so read lines until `end_header`.
  const probe = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
  const end = probe.indexOf('end_header');
  if (end < 0) throw new Error('PLY nemá hlavičku end_header');

  const headerText = probe.slice(0, end);
  const lines = headerText.split(/\r?\n/).map((line) => line.trim());
  const format = lines.find((line) => line.startsWith('format '))?.split(/\s+/)[1];
  if (format !== 'ascii' && format !== 'binary_little_endian') {
    throw new Error(`PLY ${format ?? 'bez formátu'} neumím — jen ascii a binary_little_endian`);
  }

  const elements = [];
  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts[0] === 'element') elements.push({ name: parts[1], count: +parts[2], props: [] });
    else if (parts[0] === 'property' && elements.length) {
      const current = elements.at(-1);
      current.props.push(parts[1] === 'list'
        ? { list: true, countType: parts[2], type: parts[3], name: parts[4] }
        : { list: false, type: parts[1], name: parts[2] });
    }
  }

  const vertexElement = elements.find((element) => element.name === 'vertex');
  const faceElement = elements.find((element) => element.name === 'face');
  if (!vertexElement || !faceElement) throw new Error('PLY nemá elementy vertex a face');

  const positions = new Float64Array(vertexElement.count * 3);
  const faces = [];

  if (format === 'ascii') {
    const body = new TextDecoder().decode(bytes.subarray(end + 'end_header'.length)).trim().split(/\r?\n/);
    let row = 0;
    for (let i = 0; i < vertexElement.count; i += 1) {
      const values = body[row++].trim().split(/\s+/).map(Number);
      const at = vertexElement.props.findIndex((p) => p.name === 'x');
      positions[i * 3] = values[at];
      positions[i * 3 + 1] = values[at + 1];
      positions[i * 3 + 2] = values[at + 2];
    }
    for (let i = 0; i < faceElement.count; i += 1) {
      const values = body[row++].trim().split(/\s+/).map(Number);
      faces.push(values.slice(1, 1 + values[0]));
    }
  } else {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const sizes = { char: 1, int8: 1, uchar: 1, uint8: 1, short: 2, int16: 2, ushort: 2, uint16: 2, int: 4, int32: 4, uint: 4, uint32: 4, float: 4, float32: 4, double: 8, float64: 8 };
    const read = (type, at) => (type === 'float' || type === 'float32' ? view.getFloat32(at, true)
      : type === 'double' || type === 'float64' ? view.getFloat64(at, true)
        : sizes[type] === 1 ? (type.startsWith('u') ? view.getUint8(at) : view.getInt8(at))
          : sizes[type] === 2 ? (type.startsWith('u') ? view.getUint16(at, true) : view.getInt16(at, true))
            : (type.startsWith('u') ? view.getUint32(at, true) : view.getInt32(at, true)));

    let offset = end + 'end_header'.length;
    while (bytes[offset] === 13 || bytes[offset] === 10 || bytes[offset] === 32) offset += 1;

    const vertexStride = vertexElement.props.reduce((total, p) => total + sizes[p.type], 0);
    const xAt = vertexElement.props.slice(0, vertexElement.props.findIndex((p) => p.name === 'x')).reduce((t, p) => t + sizes[p.type], 0);
    for (let i = 0; i < vertexElement.count; i += 1) {
      const at = offset + i * vertexStride + xAt;
      positions[i * 3] = read('float32', at);
      positions[i * 3 + 1] = read('float32', at + 4);
      positions[i * 3 + 2] = read('float32', at + 8);
    }
    offset += vertexElement.count * vertexStride;

    const faceProps = faceElement.props;
    for (let i = 0; i < faceElement.count; i += 1) {
      let at = offset;
      let corners = null;
      for (const property of faceProps) {
        if (property.list) {
          const count = read(property.countType, at);
          at += sizes[property.countType];
          corners = [];
          for (let c = 0; c < count; c += 1) {
            corners.push(read(property.type, at));
            at += sizes[property.type];
          }
        } else {
          at += sizes[property.type];
        }
      }
      if (corners) faces.push(corners);
      offset = at;
    }
  }

  const out = [];
  for (const corners of faces) {
    for (let i = 1; i + 1 < corners.length; i += 1) {
      for (const corner of [corners[0], corners[i], corners[i + 1]]) {
        out.push(positions[corner * 3], positions[corner * 3 + 1], positions[corner * 3 + 2]);
      }
    }
  }
  if (!out.length) throw new Error('PLY neobsahuje žádné plochy');
  return new Float32Array(out);
}

// glTF is column-major and so is the multiplication below.
function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function nodeMatrix(node) {
  if (node.matrix) return node.matrix.slice();
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const rotation = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1,
  ];
  const scale = [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
  const translate = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1];
  return multiply(translate, multiply(rotation, scale));
}

const COMPONENT = { 5120: ['getInt8', 1], 5121: ['getUint8', 1], 5122: ['getInt16', 2], 5123: ['getUint16', 2], 5125: ['getUint32', 4], 5126: ['getFloat32', 4] };
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readGlb(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('tohle není GLB');
  if (view.getUint32(4, true) !== 2) throw new Error('GLB není verze 2');

  let offset = 12;
  let gltf = null;
  let binary = null;
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) gltf = JSON.parse(new TextDecoder().decode(chunk));
    else if (type === 0x004e4942) binary = chunk;
    offset += 8 + length;
  }
  if (!gltf) throw new Error('GLB neobsahuje JSON chunk');

  // A .glb may still point its buffer at a data URI; a .gltf with an external .bin cannot
  // be read from one file, and that is reported rather than silently half-parsed.
  if (!binary) {
    const uri = gltf.buffers?.[0]?.uri;
    if (!uri?.startsWith('data:')) throw new Error('GLB nemá binární data (externí .bin neumím)');
    binary = cube(Uint8Array.from(atob(uri.split(',')[1]), (c) => c.charCodeAt(0)));
  }

  const accessor = (index) => {
    const entry = gltf.accessors[index];
    const viewDef = gltf.bufferViews[entry.bufferView];
    const [getter, size] = COMPONENT[entry.componentType];
    const components = COMPONENTS[entry.type];
    const stride = viewDef.byteStride ?? size * components;
    const base = (viewDef.byteOffset ?? 0) + (entry.byteOffset ?? 0);
    const data = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
    const out = new Float64Array(entry.count * components);
    for (let i = 0; i < entry.count; i += 1) {
      for (let c = 0; c < components; c += 1) {
        out[i * components + c] = data[getter](base + i * stride + c * size, true);
      }
    }
    return out;
  };

  const out = [];
  const walk = (nodeIndex, parent) => {
    const node = gltf.nodes?.[nodeIndex] ?? {};
    const matrix = multiply(parent, nodeMatrix(node));
    if (node.mesh !== undefined) {
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        if ((primitive.mode ?? 4) !== 4) throw new Error('GLB obsahuje jiné primitive než trojúhelníky');
        const position = accessor(primitive.attributes.POSITION);
        const indices = primitive.indices !== undefined ? accessor(primitive.indices) : null;
        const count = indices ? indices.length : position.length / 3;
        const pick = (i) => (indices ? indices[i] : i);
        for (let i = 0; i + 2 < count; i += 3) {
          for (const corner of [pick(i), pick(i + 1), pick(i + 2)]) {
            const x = position[corner * 3];
            const y = position[corner * 3 + 1];
            const z = position[corner * 3 + 2];
            out.push(
              matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
              matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
              matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
            );
          }
        }
      }
    }
    for (const child of node.children ?? []) walk(child, matrix);
  };

  const scene = gltf.scenes?.[gltf.scene ?? 0];
  for (const nodeIndex of scene?.nodes ?? gltf.nodes?.map((_, i) => i) ?? []) walk(nodeIndex, IDENTITY);
  if (!out.length) throw new Error('GLB neobsahuje žádné trojúhelníky');
  return new Float32Array(out);
}

// --- writing -----------------------------------------------------------------

export function writeStlBinary(tris) {
  const count = tris.length / 9;
  const bytes = new Uint8Array(84 + count * 50);
  const view = new DataView(bytes.buffer);
  new TextEncoder().encodeInto('riplay.cz — triangle soup, no units stored', bytes);
  view.setUint32(80, count, true);
  for (let i = 0; i < count; i += 1) {
    const at = 84 + i * 50;
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = tris.subarray(i * 9, i * 9 + 9);
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    view.setFloat32(at, nx / length, true);
    view.setFloat32(at + 4, ny / length, true);
    view.setFloat32(at + 8, nz / length, true);
    for (let v = 0; v < 9; v += 1) view.setFloat32(at + 12 + v * 4, tris[i * 9 + v], true);
  }
  return bytes;
}

export function writeObj(tris) {
  const lines = ['# riplay.cz — triangle soup, no units stored'];
  for (let i = 0; i < tris.length; i += 3) lines.push(`v ${tris[i]} ${tris[i + 1]} ${tris[i + 2]}`);
  for (let i = 0; i < tris.length / 9; i += 1) {
    const a = i * 3 + 1;
    lines.push(`f ${a} ${a + 1} ${a + 2}`);
  }
  return new TextEncoder().encode(`${lines.join('\n')}\n`);
}

export function writePlyAscii(tris) {
  const vertices = tris.length / 3;
  const faces = tris.length / 9;
  const lines = [
    'ply',
    'format ascii 1.0',
    'comment riplay.cz — triangle soup, no units stored',
    `element vertex ${vertices}`,
    'property float x',
    'property float y',
    'property float z',
    `element face ${faces}`,
    'property list uchar int vertex_indices',
    'end_header',
  ];
  for (let i = 0; i < tris.length; i += 3) lines.push(`${tris[i]} ${tris[i + 1]} ${tris[i + 2]}`);
  for (let i = 0; i < faces; i += 1) lines.push(`3 ${i * 3} ${i * 3 + 1} ${i * 3 + 2}`);
  return new TextEncoder().encode(`${lines.join('\n')}\n`);
}

export function writeGlb(tris) {
  const vertices = tris.length / 3;
  const bytes = new Uint8Array(vertices * 12);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < vertices * 3; i += 1) view.setFloat32(i * 4, tris[i], true);

  const json = {
    asset: { version: '2.0', generator: 'riplay.cz' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: vertices, type: 'VEC3', min: [0, 0, 0], max: [0, 0, 0] },
    ],
    bufferViews: [{ buffer: 0, byteLength: bytes.byteLength, target: 34962 }],
    buffers: [{ byteLength: bytes.byteLength }],
  };

  // min/max are required on POSITION accessors; compute them rather than shipping zeros.
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertices; i += 1) {
    for (let c = 0; c < 3; c += 1) {
      const value = tris[i * 3 + c];
      min[c] = Math.min(min[c], value);
      max[c] = Math.max(max[c], value);
    }
  }
  json.accessors[0].min = min;
  json.accessors[0].max = max;

  const pad4 = (length) => (4 - (length % 4)) % 4;
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadded = new Uint8Array(jsonBytes.length + pad4(jsonBytes.length)).fill(0x20);
  jsonPadded.set(jsonBytes);

  const total = 12 + 8 + jsonPadded.length + 8 + bytes.length;
  const out = new Uint8Array(total);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, 0x46546c67, true);
  outView.setUint32(4, 2, true);
  outView.setUint32(8, total, true);
  outView.setUint32(12, jsonPadded.length, true);
  outView.setUint32(16, 0x4e4f534a, true);
  out.set(jsonPadded, 20);
  const binStart = 20 + jsonPadded.length;
  outView.setUint32(binStart, bytes.length, true);
  outView.setUint32(binStart + 4, 0x004e4942, true);
  out.set(bytes, binStart + 8);
  return out;
}

// --- the surface used by the page and the verifier ----------------------------

const EXTENSIONS = {
  '.stl': 'stl',
  '.obj': 'obj',
  '.ply': 'ply',
  '.glb': 'glb',
};

export function detectFormat(name) {
  const dot = name.lastIndexOf('.');
  if (dot < 0) throw new Error('Soubor nemá příponu — nevím, co v něm je.');
  const format = EXTENSIONS[name.slice(dot).toLowerCase()];
  if (!format) throw new Error(`Příponu ${name.slice(dot).toLowerCase()} neumím. Zvládnu ${Object.keys(EXTENSIONS).join(', ')}.`);
  return format;
}

export function meshFrom(name, bytes) {
  const format = detectFormat(name);
  const looksText = () => new TextDecoder('utf-8').decode(bytes.subarray(0, Math.min(bytes.length, 2048)));

  if (format === 'stl') {
    // A binary STL can also begin with "solid", so the facet keyword is the real tell.
    const head = looksText().trimStart();
    const ascii = head.startsWith('solid') && head.includes('facet');
    return {
      format: ascii ? 'stl-ascii' : 'stl-binary',
      tris: ascii ? readStlAscii(new TextDecoder().decode(bytes)) : readStlBinary(bytes),
    };
  }
  if (format === 'obj') return { format: 'obj', tris: readObj(new TextDecoder().decode(bytes)) };
  if (format === 'ply') return { format: 'ply', tris: readPly(bytes) };
  return { format: 'glb', tris: readGlb(bytes) };
}

export function scaleMesh(tris, factor) {
  if (!Number.isFinite(factor) || factor === 1) return tris;
  const out = new Float32Array(tris.length);
  for (let i = 0; i < tris.length; i += 1) out[i] = tris[i] * factor;
  return out;
}

export function stats(tris) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let volume = 0;
  for (let i = 0; i < tris.length; i += 3) {
    for (let c = 0; c < 3; c += 1) {
      min[c] = Math.min(min[c], tris[i + c]);
      max[c] = Math.max(max[c], tris[i + c]);
    }
  }
  for (let i = 0; i < tris.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = tris.subarray(i, i + 9);
    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return {
    triangles: tris.length / 9,
    vertices: tris.length / 3,
    min,
    max,
    size,
    volume: Math.abs(volume),
  };
}

export function writeMesh(tris, format) {
  if (format === 'stl') return { bytes: writeStlBinary(tris), mime: 'model/stl' };
  if (format === 'obj') return { bytes: writeObj(tris), mime: 'model/obj' };
  if (format === 'ply') return { bytes: writePlyAscii(tris), mime: 'application/octet-stream' };
  if (format === 'glb') return { bytes: writeGlb(tris), mime: 'model/gltf-binary' };
  throw new Error(`Nevím, jak zapsat ${format}.`);
}

export function outputName(name, format) {
  const stem = name.slice(0, name.lastIndexOf('.'));
  const safe = stem
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'soubor';
  return `${safe}.${format}`;
}
