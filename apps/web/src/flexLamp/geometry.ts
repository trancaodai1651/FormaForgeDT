import type { MeshData } from '@hometown/types';

export type FlexLampPattern = 'circle' | 'hexagon' | 'vertical' | 'diamond' | 'wave';

export type FlexLampConfig = {
  pattern: FlexLampPattern;
  around: number;
  rows: number;
  cellSize: number;
  rotation: number;
  radius: number;
  height: number;
  wallThickness: number;
  image: ImagePattern | null;
  imageThreshold: number;
};

export type ImagePattern = {
  width: number;
  height: number;
  samples: Float32Array;
  name: string;
};

export type FlexLampGeometryResult = {
  mesh: MeshData;
  solidCells: number;
  totalCells: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function addQuad(vertices: number[], indices: number[], points: Array<[number, number, number]>) {
  const start = vertices.length / 3;
  points.forEach(([x, y, z]) => vertices.push(x, y, z));
  indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
}

function addRing(vertices: number[], indices: number[], y: number, innerRadius: number, outerRadius: number, segments: number) {
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    const a = (index / segments) * Math.PI * 2;
    const b = (next / segments) * Math.PI * 2;
    const points: Array<[number, number, number]> = [
      [Math.cos(a) * innerRadius, y, Math.sin(a) * innerRadius],
      [Math.cos(a) * outerRadius, y, Math.sin(a) * outerRadius],
      [Math.cos(b) * outerRadius, y, Math.sin(b) * outerRadius],
      [Math.cos(b) * innerRadius, y, Math.sin(b) * innerRadius],
    ];
    addQuad(vertices, indices, points);
  }
}

function patternIsSolid(pattern: FlexLampPattern, x: number, y: number, cellSize: number): boolean {
  const scaled = clamp(cellSize / 12, 0.45, 1.6);
  const wave = Math.sin(y * Math.PI * 2.2) * 0.2;
  switch (pattern) {
    case 'circle': return Math.hypot(x, y) > 0.29 * scaled;
    case 'hexagon': {
      const hexDistance = Math.max(Math.abs(x), Math.abs(x) * 0.5 + Math.abs(y) * 0.866);
      return hexDistance > 0.34 * scaled;
    }
    case 'vertical': return Math.abs(x) > 0.24 * scaled;
    case 'diamond': return Math.abs(x) + Math.abs(y) > 0.38 * scaled;
    case 'wave': return Math.abs(x - wave) > 0.22 * scaled;
  }
}

function sampleImage(image: ImagePattern, u: number, v: number): number {
  const x = clamp(Math.floor(u * image.width), 0, image.width - 1);
  const y = clamp(Math.floor(v * image.height), 0, image.height - 1);
  return image.samples[y * image.width + x] ?? 0;
}

/** Creates a printable cylindrical shade made from printable panels and open cells. */
export function buildFlexLampGeometry(config: FlexLampConfig): FlexLampGeometryResult {
  const around = Math.round(clamp(config.around, 12, 64));
  const rows = Math.round(clamp(config.rows, 4, 36));
  const radius = clamp(config.radius, 35, 180);
  const height = clamp(config.height, 50, 320);
  const wall = clamp(config.wallThickness, 0.8, 6);
  const vertices: number[] = [];
  const indices: number[] = [];
  let solidCells = 0;
  const rotation = (config.rotation * Math.PI) / 180;

  for (let row = 0; row < rows; row += 1) {
    const v0 = row / rows;
    const v1 = (row + 1) / rows;
    const y0 = -height / 2 + v0 * height;
    const y1 = -height / 2 + v1 * height;
    for (let column = 0; column < around; column += 1) {
      const u0 = column / around;
      const u1 = (column + 1) / around;
      const theta0 = u0 * Math.PI * 2 + rotation;
      const theta1 = u1 * Math.PI * 2 + rotation;
      const centerX = (((column % 4) + 0.5) / 4) * 2 - 1;
      const centerY = (((row % 4) + 0.5) / 4) * 2 - 1;
      const imageSignal = config.image ? sampleImage(config.image, (column + 0.5) / around, 1 - (row + 0.5) / rows) : 0;
      const solid = config.image ? imageSignal >= config.imageThreshold : patternIsSolid(config.pattern, centerX, centerY, config.cellSize);
      if (!solid) continue;
      solidCells += 1;
      const profile0 = 1 + Math.sin(v0 * Math.PI) * 0.06;
      const profile1 = 1 + Math.sin(v1 * Math.PI) * 0.06;
      const r0 = radius * profile0;
      const r1 = radius * profile1;
      const ri0 = Math.max(1, r0 - wall);
      const ri1 = Math.max(1, r1 - wall);
      const outer: Array<[number, number, number]> = [
        [Math.cos(theta0) * r0, y0, Math.sin(theta0) * r0],
        [Math.cos(theta1) * r0, y0, Math.sin(theta1) * r0],
        [Math.cos(theta1) * r1, y1, Math.sin(theta1) * r1],
        [Math.cos(theta0) * r1, y1, Math.sin(theta0) * r1],
      ];
      const inner: Array<[number, number, number]> = [
        [Math.cos(theta0) * ri0, y0, Math.sin(theta0) * ri0],
        [Math.cos(theta0) * ri1, y1, Math.sin(theta0) * ri1],
        [Math.cos(theta1) * ri1, y1, Math.sin(theta1) * ri1],
        [Math.cos(theta1) * ri0, y0, Math.sin(theta1) * ri0],
      ];
      addQuad(vertices, indices, outer);
      addQuad(vertices, indices, inner);
      addQuad(vertices, indices, [outer[0], inner[0], inner[1], outer[3]]);
      addQuad(vertices, indices, [outer[1], outer[2], inner[2], inner[3]]);
    }
  }

  const ringSegments = Math.max(around, 32);
  addRing(vertices, indices, -height / 2, Math.max(8, radius - wall * 2.2), radius + 4, ringSegments);
  addRing(vertices, indices, height / 2, Math.max(8, radius - wall * 2.2), radius + 4, ringSegments);
  addRing(vertices, indices, -height / 2 + 4, Math.max(8, radius - wall * 1.4), Math.max(8, radius - wall * 0.3), ringSegments);

  return {
    mesh: {
      vertices,
      indices,
      metadata: { width: radius * 2, height, depth: radius * 2, wallThickness: wall, shape: 'pattern' },
    },
    solidCells,
    totalCells: around * rows,
  };
}

export async function loadImagePattern(file: File, resolution = 160): Promise<ImagePattern> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a PNG, JPG or WebP image.');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = resolution;
    canvas.height = resolution;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('The browser could not create an image processing canvas.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, resolution, resolution);
    const scale = Math.min(resolution / bitmap.width, resolution / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    context.drawImage(bitmap, (resolution - width) / 2, (resolution - height) / 2, width, height);
    const pixels = context.getImageData(0, 0, resolution, resolution).data;
    const samples = new Float32Array(resolution * resolution);
    for (let index = 0; index < samples.length; index += 1) {
      const offset = index * 4;
      const luminance = (pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114) / 255;
      samples[index] = 1 - luminance;
    }
    return { width: resolution, height: resolution, samples, name: file.name };
  } finally {
    bitmap.close();
  }
}

export function meshFromBufferGeometry(geometry: import('three').BufferGeometry): MeshData {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.getAttribute('position');
  if (!position || position.count < 3) throw new Error('The imported model has no usable triangles.');
  const vertices = Array.from(position.array as ArrayLike<number>);
  const indices = Array.from({ length: position.count }, (_, index) => index);
  return normalizeMeshData({ vertices, indices, metadata: { width: 1, height: 1, depth: 1, wallThickness: 1.6, shape: 'geometric' } });
}

export function normalizeMeshData(mesh: MeshData): MeshData {
  if (mesh.vertices.length < 3) throw new Error('The imported model has no usable vertices.');
  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (let index = 0; index < mesh.vertices.length; index += 3) {
    minX = Math.min(minX, mesh.vertices[index]); maxX = Math.max(maxX, mesh.vertices[index]);
    minY = Math.min(minY, mesh.vertices[index + 1]); maxY = Math.max(maxY, mesh.vertices[index + 1]);
    minZ = Math.min(minZ, mesh.vertices[index + 2]); maxZ = Math.max(maxZ, mesh.vertices[index + 2]);
  }
  const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2; const centerZ = (minZ + maxZ) / 2;
  const vertices = mesh.vertices.slice();
  for (let index = 0; index < vertices.length; index += 3) { vertices[index] -= centerX; vertices[index + 1] -= centerY; vertices[index + 2] -= centerZ; }
  return { ...mesh, vertices, metadata: { ...mesh.metadata, width: maxX - minX, height: maxY - minY, depth: maxZ - minZ } };
}
