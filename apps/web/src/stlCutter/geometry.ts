import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type CutterAxis = 'x' | 'y' | 'z';

export type CutterMesh = {
  vertices: number[];
  indices: number[];
};

export type CutterBounds = {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
  center: [number, number, number];
};

export type ConnectorKind = 'pyramid' | 'dovetail' | 'sphere';

export type ConnectorConfig = {
  enabled: boolean;
  kind: ConnectorKind;
  size: number;
  clearance: number;
  depth: number;
};

export type BedConfig = {
  width: number;
  depth: number;
  height: number;
  margin: number;
};

export type MaskShape =
  | { kind: 'surface'; center: [number, number, number]; radius: number }
  | { kind: 'sphere'; center: [number, number, number]; radius: number }
  | { kind: 'polygon'; points: Array<[number, number]> };

type WasmModule = Awaited<ReturnType<typeof Module>>;

let wasmPromise: Promise<WasmModule> | null = null;

async function getWasm(): Promise<WasmModule> {
  if (!wasmPromise) {
    wasmPromise = (async () => {
      const wasm = await Module({ locateFile: () => wasmUrl });
      wasm.setup();
      return wasm;
    })();
  }
  return wasmPromise;
}

export function meshFromBufferGeometry(sourceGeometry: THREE.BufferGeometry): CutterMesh {
  const geometry = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry.clone();
  try {
    const position = geometry.getAttribute('position');
    if (!position || position.count < 3) throw new Error('The imported model has no usable triangles.');
    const vertices = Array.from(position.array as ArrayLike<number>);
    const indices = Array.from({ length: position.count }, (_, index) => index);
    return { vertices, indices };
  } finally {
    geometry.dispose();
  }
}

export function objectToMesh(root: THREE.Object3D): CutterMesh {
  root.updateMatrixWorld(true);
  const vertices: number[] = [];
  const indices: number[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const source = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry;
    const geometry = source.clone().applyMatrix4(object.matrixWorld);
    const position = geometry.getAttribute('position');
    if (position) {
      const offset = vertices.length / 3;
      vertices.push(...Array.from(position.array as ArrayLike<number>));
      indices.push(...Array.from({ length: position.count }, (_, index) => offset + index));
    }
    geometry.dispose();
    if (source !== object.geometry) source.dispose();
  });
  if (vertices.length < 9 || indices.length < 3) throw new Error('The imported model has no usable triangles.');
  return { vertices, indices };
}

export function geometryFromMesh(mesh: CutterMesh): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices, 3));
  geometry.setIndex(mesh.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function boundsOfMesh(mesh: CutterMesh): CutterBounds {
  if (mesh.vertices.length < 3) throw new Error('Cannot measure an empty mesh.');
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < mesh.vertices.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], mesh.vertices[index + axis]);
      max[axis] = Math.max(max[axis], mesh.vertices[index + axis]);
    }
  }
  const size: [number, number, number] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return { min, max, size, center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2] };
}

export function translateMesh(mesh: CutterMesh, offset: [number, number, number]): CutterMesh {
  const vertices = mesh.vertices.slice();
  for (let index = 0; index < vertices.length; index += 3) {
    vertices[index] += offset[0];
    vertices[index + 1] += offset[1];
    vertices[index + 2] += offset[2];
  }
  return { vertices, indices: mesh.indices.slice() };
}

export function placeMeshOnBed(mesh: CutterMesh): CutterMesh {
  const bounds = boundsOfMesh(mesh);
  return translateMesh(mesh, [-bounds.center[0], -bounds.center[1], -bounds.min[2]]);
}

export function approximateVolume(mesh: CutterMesh): number {
  let volume = 0;
  for (let index = 0; index + 2 < mesh.indices.length; index += 3) {
    const a = mesh.indices[index] * 3; const b = mesh.indices[index + 1] * 3; const c = mesh.indices[index + 2] * 3;
    volume += (
      mesh.vertices[a] * (mesh.vertices[b + 1] * mesh.vertices[c + 2] - mesh.vertices[b + 2] * mesh.vertices[c + 1])
      - mesh.vertices[a + 1] * (mesh.vertices[b] * mesh.vertices[c + 2] - mesh.vertices[b + 2] * mesh.vertices[c])
      + mesh.vertices[a + 2] * (mesh.vertices[b] * mesh.vertices[c + 1] - mesh.vertices[b + 1] * mesh.vertices[c])
    ) / 6;
  }
  return Math.abs(volume);
}

export function transformMesh(mesh: CutterMesh, position: [number, number, number], rotation: [number, number, number]): CutterMesh {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2])),
    new THREE.Vector3(1, 1, 1),
  );
  const transformed = mesh.vertices.slice();
  const point = new THREE.Vector3();
  for (let index = 0; index < transformed.length; index += 3) {
    point.set(transformed[index], transformed[index + 1], transformed[index + 2]).applyMatrix4(matrix);
    transformed[index] = point.x;
    transformed[index + 1] = point.y;
    transformed[index + 2] = point.z;
  }
  return { vertices: transformed, indices: mesh.indices.slice() };
}

function manifoldFromMesh(wasm: WasmModule, mesh: CutterMesh): any {
  if (mesh.vertices.length < 9 || mesh.indices.length < 3) throw new Error('The selected piece is empty.');
  const input = new wasm.Mesh({
    numProp: 3,
    vertProperties: new Float32Array(mesh.vertices),
    triVerts: new Uint32Array(mesh.indices),
  });
  try {
    input.merge();
    return wasm.Manifold.ofMesh(input);
  } catch (cause) {
    throw new Error('The mesh must be a closed, oriented manifold before cutting or exporting.', { cause });
  }
}

function meshFromManifold(solid: any): CutterMesh {
  const raw = solid.getMesh();
  const numProp = raw.numProp ?? 3;
  const vertices: number[] = [];
  for (let index = 0; index < raw.vertProperties.length; index += numProp) {
    vertices.push(raw.vertProperties[index], raw.vertProperties[index + 1], raw.vertProperties[index + 2]);
  }
  return { vertices, indices: Array.from(raw.triVerts) };
}

function disposeAll(items: any[]) {
  for (const item of items) item?.delete?.();
}

function normalForAxis(axis: CutterAxis): [number, number, number] {
  return axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1];
}

function axisIndex(axis: CutterAxis): number {
  return axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
}

function translateAlongAxis(point: [number, number, number], axis: CutterAxis, distance: number): [number, number, number] {
  const next = point.slice() as [number, number, number];
  next[axisIndex(axis)] += distance;
  return next;
}

function connectorSolid(wasm: WasmModule, kind: ConnectorKind, size: number, depth: number, axis: CutterAxis, center: [number, number, number]): any {
  let solid: any;
  if (kind === 'sphere') {
    solid = wasm.Manifold.sphere(Math.max(0.5, size / 2), 32);
  } else if (kind === 'pyramid') {
    solid = wasm.Manifold.cube([Math.max(1, size), Math.max(1, size), Math.max(1, depth)], true)
      .scale([1, 1, 0.01])
      .add(wasm.Manifold.cube([Math.max(0.4, size * 0.72), Math.max(0.4, size * 0.72), Math.max(0.5, depth)], true));
  } else {
    solid = wasm.Manifold.cube([Math.max(1, size), Math.max(1, size * 0.72), Math.max(1, depth)], true);
  }
  const rotations: Record<CutterAxis, [number, number, number]> = { x: [0, 90, 0], y: [90, 0, 0], z: [0, 0, 0] };
  return solid.rotate(rotations[axis]).translate(center);
}

function addConnectors(wasm: WasmModule, split: [any, any], axis: CutterAxis, offset: number, sourceBounds: CutterBounds, config: ConnectorConfig): [any, any] {
  if (!config.enabled) return split;
  const index = axisIndex(axis);
  const center: [number, number, number] = [...sourceBounds.center];
  center[index] = offset;
  const radius = Math.max(0.8, config.size / 2);
  const depth = Math.max(1, config.depth);
  const clearance = Math.max(0, config.clearance);
  const pegCenter = translateAlongAxis(center, axis, -depth * 0.42);
  const peg = connectorSolid(wasm, config.kind, radius * 2, depth, axis, pegCenter);
  const socket = connectorSolid(wasm, config.kind, radius * 2 + clearance * 2, depth + clearance * 2, axis, pegCenter);
  const positive = split[0].add(peg);
  const negative = split[1].subtract(socket);
  disposeAll([split[0], split[1], peg, socket]);
  return [positive, negative];
}

export async function splitMeshByPlane(mesh: CutterMesh, axis: CutterAxis, offset: number, connector: ConnectorConfig = { enabled: false, kind: 'pyramid', size: 6, clearance: 0.2, depth: 4 }): Promise<[CutterMesh, CutterMesh]> {
  const wasm = await getWasm();
  const source = manifoldFromMesh(wasm, mesh);
  const bounds = boundsOfMesh(mesh);
  const parts = source.splitByPlane(normalForAxis(axis), offset) as any[];
  try {
    const connected = addConnectors(wasm, [parts[0], parts[1]], axis, offset, bounds, connector);
    return [meshFromManifold(connected[0]), meshFromManifold(connected[1])];
  } finally {
    if (!connector.enabled) disposeAll(parts);
    disposeAll([source]);
  }
}

export async function splitMeshByLine(mesh: CutterMesh, start: [number, number], end: [number, number]): Promise<[CutterMesh, CutterMesh]> {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (length < 0.001) throw new Error('Draw a longer line across the selected piece.');
  const normal: [number, number, number] = [dy / length, -dx / length, 0];
  const midpoint: [number, number] = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const offset = normal[0] * midpoint[0] + normal[1] * midpoint[1];
  const wasm = await getWasm();
  const source = manifoldFromMesh(wasm, mesh);
  const parts = source.splitByPlane(normal, offset) as any[];
  try {
    return [meshFromManifold(parts[0]), meshFromManifold(parts[1])];
  } finally {
    disposeAll(parts);
    disposeAll([source]);
  }
}

export async function validateMesh(mesh: CutterMesh): Promise<{ valid: boolean; status: string }> {
  const wasm = await getWasm();
  const source = manifoldFromMesh(wasm, mesh);
  try {
    const rawStatus = typeof source.status === 'function' ? source.status() : 'ok';
    return { valid: true, status: String(rawStatus) };
  } finally {
    disposeAll([source]);
  }
}

function smoothOpenCurve(points: Array<[number, number]>, iterations = 2): Array<[number, number]> {
  let result = points.filter((point, index) => index === 0 || Math.hypot(point[0] - points[index - 1][0], point[1] - points[index - 1][1]) > 0.05);
  for (let iteration = 0; iteration < iterations && result.length > 2; iteration += 1) {
    const next: Array<[number, number]> = [result[0]];
    for (let index = 0; index < result.length - 1; index += 1) {
      const current = result[index];
      const following = result[index + 1];
      next.push(
        [current[0] * 0.75 + following[0] * 0.25, current[1] * 0.75 + following[1] * 0.25],
        [current[0] * 0.25 + following[0] * 0.75, current[1] * 0.25 + following[1] * 0.75],
      );
    }
    next.push(result[result.length - 1]);
    result = next.length > 192 ? next.filter((_, index) => index % 2 === 0 || index === next.length - 1) : next;
  }
  return result;
}

function makeCurvePolygon(points: Array<[number, number]>, bounds: CutterBounds): Array<[number, number]> {
  if (points.length < 2) throw new Error('Draw a curve with at least two points.');
  const path = smoothOpenCurve(points).map(([x, y]) => [x, y] as [number, number]);
  const first = path[0];
  const last = path[path.length - 1];
  const dx = last[0] - first[0];
  const dy = last[1] - first[1];
  const length = Math.hypot(dx, dy);
  if (length < 0.001) throw new Error('The curve endpoints must be on opposite sides of the piece.');
  const pad = Math.max(...bounds.size) * 5 + 50;
  const normal: [number, number] = [-dy / length, dx / length];
  return [
    ...path,
    [last[0] + normal[0] * pad, last[1] + normal[1] * pad],
    [first[0] + normal[0] * pad, first[1] + normal[1] * pad],
  ];
}

function pointInsidePolygon(point: [number, number], polygon: Array<[number, number]>): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const [x1, y1] = polygon[index];
    const [x2, y2] = polygon[previous];
    if ((y1 > point[1]) !== (y2 > point[1]) && point[0] < ((x2 - x1) * (point[1] - y1)) / ((y2 - y1) || Number.EPSILON) + x1) inside = !inside;
  }
  return inside;
}

export function closestSurfacePoint(mesh: CutterMesh, point: [number, number]): [number, number, number] {
  let best: [number, number, number] = [point[0], point[1], boundsOfMesh(mesh).center[2]];
  let bestDistance = Infinity;
  for (let index = 0; index + 2 < mesh.indices.length; index += 3) {
    const vertices = [mesh.indices[index], mesh.indices[index + 1], mesh.indices[index + 2]];
    const center: [number, number, number] = [0, 0, 0];
    for (const vertex of vertices) {
      center[0] += mesh.vertices[vertex * 3] / 3;
      center[1] += mesh.vertices[vertex * 3 + 1] / 3;
      center[2] += mesh.vertices[vertex * 3 + 2] / 3;
    }
    const distance = Math.hypot(center[0] - point[0], center[1] - point[1]);
    if (distance < bestDistance) { bestDistance = distance; best = center; }
  }
  return best;
}

export function trianglesInsideMask(mesh: CutterMesh, shapes: MaskShape[], inverted = false): number[] {
  const selected: number[] = [];
  for (let triangle = 0; triangle * 3 + 2 < mesh.indices.length; triangle += 1) {
    const center: [number, number, number] = [0, 0, 0];
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = mesh.indices[triangle * 3 + corner];
      center[0] += mesh.vertices[vertex * 3] / 3;
      center[1] += mesh.vertices[vertex * 3 + 1] / 3;
      center[2] += mesh.vertices[vertex * 3 + 2] / 3;
    }
    const matches = shapes.some((shape) => {
      if (shape.kind === 'polygon') return shape.points.length > 2 && pointInsidePolygon([center[0], center[1]], shape.points);
      const planarDistance = Math.hypot(center[0] - shape.center[0], center[1] - shape.center[1]);
      return shape.kind === 'surface' ? planarDistance <= shape.radius : Math.hypot(planarDistance, center[2] - shape.center[2]) <= shape.radius;
    });
    if (inverted ? !matches : matches) selected.push(triangle);
  }
  return selected;
}

export function geometryFromTriangleSelection(mesh: CutterMesh, triangles: number[]): THREE.BufferGeometry {
  const selected = new Set(triangles);
  const vertices: number[] = [];
  for (let triangle = 0; triangle * 3 + 2 < mesh.indices.length; triangle += 1) {
    if (!selected.has(triangle)) continue;
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = mesh.indices[triangle * 3 + corner];
      vertices.push(mesh.vertices[vertex * 3], mesh.vertices[vertex * 3 + 1], mesh.vertices[vertex * 3 + 2]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export async function splitMeshByCurve(mesh: CutterMesh, points: Array<[number, number]>): Promise<[CutterMesh, CutterMesh]> {
  const wasm = await getWasm();
  const bounds = boundsOfMesh(mesh);
  const polygon = makeCurvePolygon(points, bounds);
  const source = manifoldFromMesh(wasm, mesh);
  const section = new wasm.CrossSection([polygon]);
  const height = Math.max(1, bounds.size[2] + 20);
  // CrossSection extrusion starts at Z=0. Place it below the model so the
  // cutter spans the complete Z range instead of only the upper half.
  const cutter = wasm.Manifold.extrude(section, height, 0, 0, 1, true).translate([0, 0, bounds.min[2] - 10]);
  try {
    const inside = wasm.Manifold.intersection(source, cutter);
    const outside = wasm.Manifold.difference(source, cutter);
    return [meshFromManifold(inside), meshFromManifold(outside)];
  } finally {
    disposeAll([source, section, cutter]);
  }
}

export async function subtractMask(mesh: CutterMesh, center: [number, number, number], radius: number): Promise<CutterMesh> {
  const wasm = await getWasm();
  const source = manifoldFromMesh(wasm, mesh);
  const tool = wasm.Manifold.sphere(Math.max(0.5, radius), 40).translate(center);
  try {
    const result = source.subtract(tool);
    try {
      return meshFromManifold(result);
    } finally {
      disposeAll([result]);
    }
  } finally {
    disposeAll([source, tool]);
  }
}

function splitManifoldAt(manifold: any, axis: CutterAxis, offset: number): any[] {
  return manifold.splitByPlane(normalForAxis(axis), offset) as any[];
}

export async function divideMeshByBeds(mesh: CutterMesh, config: BedConfig): Promise<CutterMesh[]> {
  const wasm = await getWasm();
  const bounds = boundsOfMesh(mesh);
  const usable: [number, number, number] = [
    Math.max(1, config.width - config.margin * 2),
    Math.max(1, config.depth - config.margin * 2),
    Math.max(1, config.height),
  ];
  const boundaries: Array<[CutterAxis, number][]> = (['x', 'y', 'z'] as CutterAxis[]).map((axis) => {
    const index = axisIndex(axis);
    const values: Array<[CutterAxis, number]> = [];
    for (let position = bounds.min[index] + usable[index]; position < bounds.max[index] - 0.001; position += usable[index]) values.push([axis, position]);
    return values;
  });
  const source = manifoldFromMesh(wasm, mesh);
  let pieces: any[] = [source];
  try {
    for (const axisBoundaries of boundaries) {
      for (const [axis, boundary] of axisBoundaries) {
        const next: any[] = [];
        for (const piece of pieces) {
          const split = splitManifoldAt(piece, axis, boundary);
          disposeAll([piece]);
          for (const part of split) {
            try {
              if (part.getMesh().triVerts.length > 0) next.push(part);
              else part.delete?.();
            } catch {
              part.delete?.();
            }
          }
        }
        pieces = next;
      }
    }
    return pieces.map(meshFromManifold);
  } finally {
    disposeAll(pieces);
  }
}

export function makeDemoMesh(kind: 'cube' | 'bevel' | 'vase' | 'cylinder'): CutterMesh {
  let geometry: THREE.BufferGeometry;
  if (kind === 'cube') geometry = new THREE.BoxGeometry(50, 50, 50, 10, 10, 10);
  else if (kind === 'bevel') geometry = new RoundedBoxGeometry(50, 50, 50, 5, 3);
  else if (kind === 'cylinder') geometry = new THREE.CylinderGeometry(24, 24, 60, 48, 4);
  else {
    const profile = [
      new THREE.Vector2(0, -30), new THREE.Vector2(18, -30), new THREE.Vector2(22, -22),
      new THREE.Vector2(20, -8), new THREE.Vector2(16, 8), new THREE.Vector2(12, 24),
      new THREE.Vector2(0, 30),
    ];
    geometry = new THREE.LatheGeometry(profile, 48);
  }
  geometry.translate(0, 0, kind === 'cylinder' ? 30 : kind === 'vase' ? 30 : 25);
  try {
    return meshFromBufferGeometry(geometry);
  } finally {
    geometry.dispose();
  }
}
