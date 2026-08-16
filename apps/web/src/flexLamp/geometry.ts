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

function holePoint(pattern: FlexLampPattern, angle: number, halfWidth: number, halfHeight: number, waveOffset: number): [number, number] {
  const cosine = Math.cos(angle); const sine = Math.sin(angle);
  if (pattern === 'diamond') {
    const scale = 1 / (Math.abs(cosine) + Math.abs(sine) || 1);
    return [cosine * halfWidth * scale, sine * halfHeight * scale];
  }
  if (pattern === 'hexagon') {
    const sector = ((angle + Math.PI / 6) % (Math.PI / 3)) - Math.PI / 6;
    const scale = Math.cos(Math.PI / 6) / Math.cos(sector);
    return [cosine * halfWidth * scale, sine * halfHeight * scale];
  }
  if (pattern === 'vertical') return [cosine * halfWidth * .58, sine * halfHeight];
  if (pattern === 'wave') return [cosine * halfWidth + Math.sin(waveOffset + sine * 2) * halfWidth * .22, sine * halfHeight];
  return [cosine * halfWidth, sine * halfHeight];
}

function addPatternCell(vertices: number[], indices: number[], pattern: FlexLampPattern, theta0: number, theta1: number, y0: number, y1: number, radius: number, wall: number, cellSize: number, shadeHeight: number) {
  const centerTheta = (theta0 + theta1) / 2; const halfTheta = (theta1 - theta0) / 2; const centerY = (y0 + y1) / 2; const halfY = (y1 - y0) / 2;
  const halfWidth = clamp(cellSize / (2 * radius * halfTheta), .2, .82); const halfHeight = clamp(cellSize / (2 * halfY), .2, .82);
  const segments = pattern === 'hexagon' ? 6 : pattern === 'diamond' ? 4 : 40;
  const waveOffset = ((centerY + shadeHeight / 2) / shadeHeight) * Math.PI * 4;
  const point = (localX: number, localY: number, depth: number): [number, number, number] => {
    const y = centerY + localY * halfY;
    const profile = 1 + Math.sin(((y + shadeHeight / 2) / shadeHeight) * Math.PI) * .06;
    const r = Math.max(1, radius * profile - depth);
    const theta = centerTheta + localX * halfTheta;
    return [Math.cos(theta) * r, y, Math.sin(theta) * r];
  };
  for (let segment = 0; segment < segments; segment += 1) {
    const a0 = (segment / segments) * Math.PI * 2; const a1 = ((segment + 1) / segments) * Math.PI * 2;
    const outerScale0 = 1 / Math.max(Math.abs(Math.cos(a0)), Math.abs(Math.sin(a0)), .001); const outerScale1 = 1 / Math.max(Math.abs(Math.cos(a1)), Math.abs(Math.sin(a1)), .001);
    const hole0 = holePoint(pattern, a0, halfWidth, halfHeight, waveOffset); const hole1 = holePoint(pattern, a1, halfWidth, halfHeight, waveOffset);
    const outer0 = [Math.cos(a0) * outerScale0, Math.sin(a0) * outerScale0] as [number, number]; const outer1 = [Math.cos(a1) * outerScale1, Math.sin(a1) * outerScale1] as [number, number];
    addQuad(vertices, indices, [point(outer0[0], outer0[1], 0), point(outer1[0], outer1[1], 0), point(hole1[0], hole1[1], 0), point(hole0[0], hole0[1], 0)]);
    addQuad(vertices, indices, [point(outer0[0], outer0[1], wall), point(hole0[0], hole0[1], wall), point(hole1[0], hole1[1], wall), point(outer1[0], outer1[1], wall)]);
    addQuad(vertices, indices, [point(hole0[0], hole0[1], 0), point(hole1[0], hole1[1], 0), point(hole1[0], hole1[1], wall), point(hole0[0], hole0[1], wall)]);
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
      const imageSignal = config.image ? sampleImage(config.image, (column + 0.5) / around, 1 - (row + 0.5) / rows) : 0;
      const solid = config.image ? imageSignal >= config.imageThreshold : true;
      if (!solid) continue;
      solidCells += 1;
      addPatternCell(vertices, indices, config.image ? 'circle' : config.pattern, theta0, theta1, y0, y1, radius, wall, config.cellSize, height);
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
