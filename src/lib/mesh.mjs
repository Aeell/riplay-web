// Mesh formats, written here rather than pulled in: STL, OBJ, PLY and GLB in, and the
// same four out. Everything is a triangle soup in the file's own units — no scene graph,
// no materials, no colour — because that is what a mill or a slicer actually consumes.
//
// Units are not stored in any of these formats except by convention, so nothing here
// guesses them; the page says so and offers an explicit scale factor.

const cube = (bytes) => new Uint8Array(bytes);

// A model large enough to freeze the tab is refused, with a message, before it is parsed.
export const MAX_FILE_BYTES = 40 * 1024 * 1024;
export const MAX_TRIANGLES = 1_500_000;

export const triangleLimit = (count) =>
  `Model má ${Number(count).toLocaleString('cs-CZ')} trojúhelníků, limit je ${MAX_TRIANGLES.toLocaleString('cs-CZ')}. `
  + 'Tohle je nástroj na jednu součástku, ne na celou sestavu.';

export function tooLarge(bytes) {
  return `Soubor má ${(bytes / 1048576).toFixed(1)} MB. Tenhle nástroj zvládne ${MAX_FILE_BYTES / 1048576} MB — `
    + 'větší model otevři v sliceru na počítači, tady by zamrazil prohlížeč.';
}

function guardSize(bytes) {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error(tooLarge(bytes.byteLength));
}

// --- reading -----------------------------------------------------------------

function readStlBinary(bytes) {
  if (bytes.byteLength < 84) throw new Error('STL je kratší než hlavička — soubor je poškozený');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  if (!count) throw new Error('STL neobsahuje žádné trojúhelníky');
  // Refuse before allocating 9 floats per triangle, not after.
  if (count > MAX_TRIANGLES) throw new Error(triangleLimit(count));
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

// PLY's spec fixes these names; anything else is refused rather than guessed at, because
// a wrong guess reads plausible-looking garbage and produces a silently broken model.
const PLY_TYPES = {
  char: ['getInt8', 1], int8: ['getInt8', 1],
  uchar: ['getUint8', 1], uint8: ['getUint8', 1],
  short: ['getInt16', 2], int16: ['getInt16', 2],
  ushort: ['getUint16', 2], uint16: ['getUint16', 2],
  int: ['getInt32', 4], int32: ['getInt32', 4],
  uint: ['getUint32', 4], uint32: ['getUint32', 4],
  float: ['getFloat32', 4], float32: ['getFloat32', 4],
  double: ['getFloat64', 8], float64: ['getFloat64', 8],
};

function plyType(type, where) {
  const entry = PLY_TYPES[type];
  if (!entry) throw new Error(`PLY používá typ „${type}“ (${where}), který neumím přečíst`);
  return entry;
}

const INDEX_NAMES = new Set(['vertex_indices', 'vertex_index']);

function readPly(bytes) {
  // The header is ASCII even in a binary PLY, so read forward until `end_header`.
  const probe = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 8192)));
  const headerEnd = probe.indexOf('end_header');
  if (headerEnd < 0) throw new Error('PLY nemá hlavičku end_header');
  const bodyStart = headerEnd + 'end_header'.length;

  const lines = probe.slice(0, headerEnd).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const format = lines.find((line) => line.startsWith('format '))?.split(/\s+/)[1];
  if (format !== 'ascii' && format !== 'binary_little_endian') {
    throw new Error(`PLY ${format ?? 'bez formátu'} neumím — jen ascii a binary_little_endian`);
  }

  const elements = [];
  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts[0] === 'element') elements.push({ name: parts[1], count: Number(parts[2]), props: [] });
    else if (parts[0] === 'property' && elements.length) {
      const current = elements.at(-1);
      if (parts[1] === 'list') current.props.push({ list: true, countType: parts[2], type: parts[3], name: parts[4] });
      else current.props.push({ list: false, type: parts[1], name: parts[2] });
    }
  }

  const vertex = elements.find((element) => element.name === 'vertex');
  const face = elements.find((element) => element.name === 'face');
  if (!vertex) throw new Error('PLY nemá element vertex');
  if (!face) throw new Error('PLY nemá element face');
  if (face.count > MAX_TRIANGLES) throw new Error(triangleLimit(face.count));
  if (vertex.props.some((property) => property.list)) {
    throw new Error('PLY má u vrcholů seznam (list) — to neumím');
  }

  // Read by name, never by position: scanners habitually put normals or colour before
  // x/y/z, and some write the coordinates as double.
  const axisColumns = ['x', 'y', 'z'].map((axis) => {
    const property = vertex.props.find((entry) => entry.name === axis);
    if (!property) throw new Error(`PLY nemá u vrcholů property ${axis}`);
    const [getter, size] = plyType(property.type, `vertex ${axis}`);
    return { axis, getter, size };
  });
  const listProperty = face.props.find((property) => property.list && INDEX_NAMES.has(property.name))
    ?? face.props.find((property) => property.list);
  if (!listProperty) throw new Error('PLY nemá u ploch seznam s indexy vrcholů');

  const positions = new Float64Array(vertex.count * 3);
  const faces = [];

  if (format === 'ascii') {
    // Validate every declared type even in ASCII, so an unsupported file fails the same way.
    for (const property of vertex.props) plyType(property.type, `vertex ${property.name}`);
    for (const property of face.props) {
      if (property.list) plyType(property.type, `face ${property.name}`);
      else plyType(property.type, `face ${property.name}`);
    }

    const rows = new TextDecoder().decode(bytes.subarray(bodyStart)).trim().split(/\r?\n/);
    const order = vertex.props.map((property) => property.name);
    const indexOf = (axis) => order.indexOf(axis);
    let row = 0;

    for (let i = 0; i < vertex.count; i += 1) {
      const values = rows[row++].trim().split(/\s+/);
      for (const axis of ['x', 'y', 'z']) {
        const value = Number(values[indexOf(axis)]);
        if (!Number.isFinite(value)) throw new Error(`PLY má nečíselnou souřadnici ${axis} na řádku ${row}`);
        positions[i * 3 + 'xyz'.indexOf(axis)] = value;
      }
    }

    for (let i = 0; i < face.count; i += 1) {
      const values = rows[row++].trim().split(/\s+/);
      let cursor = 0;
      let corners = null;
      for (const property of face.props) {
        if (property.list) {
          const count = Number(values[cursor++]);
          const indices = [];
          for (let c = 0; c < count; c += 1) indices.push(Number(values[cursor++]));
          if (property === listProperty) corners = indices;
        } else {
          cursor += 1;
        }
      }
      if (!corners) throw new Error('PLY má plochu bez indexů');
      faces.push(corners);
    }
  } else {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let at = bodyStart;
    while (bytes[at] === 10 || bytes[at] === 13 || bytes[at] === 32) at += 1;

    const columns = [];
    let stride = 0;
    for (const property of vertex.props) {
      const [getter, size] = plyType(property.type, `vertex ${property.name}`);
      columns.push({ name: property.name, getter, offset: stride });
      stride += size;
    }
    for (const column of axisColumns) {
      const match = columns.find((entry) => entry.name === column.axis);
      column.getter = match.getter;
      column.offset = match.offset;
    }

    for (let i = 0; i < vertex.count; i += 1) {
      const base = at + i * stride;
      for (let axis = 0; axis < 3; axis += 1) {
        positions[i * 3 + axis] = view[axisColumns[axis].getter](base + axisColumns[axis].offset, true);
      }
    }
    at += vertex.count * stride;

    const [countGetter, countSize] = plyType(listProperty.countType, 'face count');
    const [valueGetter, valueSize] = plyType(listProperty.type, 'face index');

    for (let i = 0; i < face.count; i += 1) {
      let cursorAt = at;
      let corners = null;
      for (const property of face.props) {
        if (property.list) {
          const count = view[property === listProperty ? countGetter : plyType(property.countType, 'list count')[0]](cursorAt, true);
          cursorAt += property === listProperty ? countSize : plyType(property.countType, 'list count')[1];
          const indices = [];
          for (let c = 0; c < count; c += 1) {
            const getter = property === listProperty ? valueGetter : plyType(property.type, 'list value')[0];
            indices.push(view[getter](cursorAt, true));
            cursorAt += property === listProperty ? valueSize : plyType(property.type, 'list value')[1];
          }
          if (property === listProperty) corners = indices;
        } else {
          cursorAt += plyType(property.type, `face ${property.name}`)[1];
        }
      }
      if (!corners) throw new Error('PLY má plochu bez indexů');
      faces.push(corners);
      at = cursorAt;
    }
  }

  const out = [];
  for (const corners of faces) {
    for (const corner of corners) {
      if (!(corner >= 0 && corner < vertex.count)) {
        throw new Error(`PLY odkazuje na vrchol ${corner}, ale soubor jich má ${vertex.count}`);
      }
    }
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

  // Count triangles from the accessors before touching the buffer.
  let declared = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const accessor = primitive.indices !== undefined
        ? gltf.accessors?.[primitive.indices]
        : gltf.accessors?.[primitive.attributes?.POSITION];
      declared += Math.floor((accessor?.count ?? 0) / 3);
    }
  }
  if (declared > MAX_TRIANGLES) throw new Error(triangleLimit(declared));

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
  guardSize(bytes);
  const looksText = () => new TextDecoder('utf-8').decode(bytes.subarray(0, Math.min(bytes.length, 2048)));

  if (format === 'stl') {
    // A binary STL can also begin with "solid", so the facet keyword is the real tell.
    const head = looksText().trimStart();
    const ascii = head.startsWith('solid') && head.includes('facet');
    return {
      format: ascii ? 'stl-ascii' : 'stl-binary',
      tris: checkCount(ascii ? readStlAscii(new TextDecoder().decode(bytes)) : readStlBinary(bytes)),
    };
  }
  if (format === 'obj') return { format: 'obj', tris: checkCount(readObj(new TextDecoder().decode(bytes))) };
  if (format === 'ply') return { format: 'ply', tris: checkCount(readPly(bytes)) };
  return { format: 'glb', tris: checkCount(readGlb(bytes)) };
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

// Parse-time triangle guard: well under the freeze point, well above a real workshop part.
function checkCount(tris) {
  if (tris.length / 9 > MAX_TRIANGLES) throw new Error(triangleLimit(tris.length / 9));
  return tris;
}
