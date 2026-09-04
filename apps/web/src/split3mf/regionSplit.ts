import * as THREE from 'three';
import type { CutterMesh } from '../stlCutter/geometry';

export type CapAlgorithm = 'soap-film' | 'cdt' | 'winding' | 'projected' | 'centroid';

export type ColoredMeshPart = {
  name: string;
  color: string;
  mesh: CutterMesh;
};

export type MaterialSlice = {
  name: string;
  color: string;
  startTriangle: number;
  triangleCount: number;
};

type DirectedEdge = { a: number; b: number };

const EDGE_EPSILON = 1e-5;

function vertexKey(vertices: number[], index: number): string {
  return [0, 1, 2]
    .map((axis) => Math.round(vertices[index * 3 + axis] / EDGE_EPSILON))
    .join(':');
}

export function weldMesh(mesh: CutterMesh): CutterMesh {
  const vertices: number[] = [];
  const indices: number[] = [];
  const lookup = new Map<string, number>();
  const remap = new Map<number, number>();
  for (let source = 0; source * 3 + 2 < mesh.vertices.length; source += 1) {
    const key = vertexKey(mesh.vertices, source);
    let target = lookup.get(key);
    if (target === undefined) {
      target = vertices.length / 3;
      lookup.set(key, target);
      vertices.push(mesh.vertices[source * 3], mesh.vertices[source * 3 + 1], mesh.vertices[source * 3 + 2]);
    }
    remap.set(source, target);
  }
  for (let triangle = 0; triangle * 3 + 2 < mesh.indices.length; triangle += 1) {
    const a = remap.get(mesh.indices[triangle * 3]);
    const b = remap.get(mesh.indices[triangle * 3 + 1]);
    const c = remap.get(mesh.indices[triangle * 3 + 2]);
    if (a === undefined || b === undefined || c === undefined || a === b || b === c || c === a) continue;
    indices.push(a, b, c);
  }
  return { vertices, indices };
}

export function mergeColoredMeshParts(parts: ColoredMeshPart[]): { mesh: CutterMesh; materials: MaterialSlice[] } {
  const vertices: number[] = [];
  const indices: number[] = [];
  const materials: MaterialSlice[] = [];
  for (const part of parts) {
    const vertexOffset = vertices.length / 3;
    const startTriangle = indices.length / 3;
    vertices.push(...part.mesh.vertices);
    indices.push(...part.mesh.indices.map((index) => index + vertexOffset));
    const triangleCount = indices.length / 3 - startTriangle;
    if (triangleCount > 0) materials.push({ name: part.name, color: part.color, startTriangle, triangleCount });
  }
  return { mesh: { vertices, indices }, materials };
}

function boundaryEdges(mesh: CutterMesh): DirectedEdge[] {
  const welded = weldMesh(mesh);
  const counts = new Map<string, { count: number; directed: DirectedEdge }>();
  const add = (a: number, b: number) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { count: 1, directed: { a, b } });
  };
  for (let index = 0; index + 2 < welded.indices.length; index += 3) {
    const a = welded.indices[index]; const b = welded.indices[index + 1]; const c = welded.indices[index + 2];
    add(a, b); add(b, c); add(c, a);
  }
  return [...counts.values()].filter((edge) => edge.count === 1).map((edge) => edge.directed);
}

function orderedBoundaryLoops(edges: DirectedEdge[]): number[][] {
  const unused = new Set(edges.map((_, index) => index));
  const outgoing = new Map<number, number[]>();
  edges.forEach((edge, index) => outgoing.set(edge.a, [...(outgoing.get(edge.a) ?? []), index]));
  const loops: number[][] = [];
  while (unused.size) {
    const startIndex = unused.values().next().value as number;
    const start = edges[startIndex];
    const loop = [start.a, start.b];
    unused.delete(startIndex);
    let cursor = start.b;
    for (let guard = 0; guard < edges.length + 2 && cursor !== start.a; guard += 1) {
      let nextIndex = (outgoing.get(cursor) ?? []).find((index) => unused.has(index));
      let reverse = false;
      if (nextIndex === undefined) {
        nextIndex = [...unused].find((index) => edges[index].b === cursor);
        reverse = nextIndex !== undefined;
      }
      if (nextIndex === undefined) break;
      const next = edges[nextIndex];
      cursor = reverse ? next.a : next.b;
      loop.push(cursor);
      unused.delete(nextIndex);
    }
    if (loop.at(-1) === loop[0]) loop.pop();
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function pointOf(vertices: number[], index: number): THREE.Vector3 {
  return new THREE.Vector3(vertices[index * 3], vertices[index * 3 + 1], vertices[index * 3 + 2]);
}

function loopNormal(vertices: number[], loop: number[]): THREE.Vector3 {
  const normal = new THREE.Vector3();
  for (let index = 0; index < loop.length; index += 1) {
    const current = pointOf(vertices, loop[index]);
    const next = pointOf(vertices, loop[(index + 1) % loop.length]);
    normal.x += (current.y - next.y) * (current.z + next.z);
    normal.y += (current.z - next.z) * (current.x + next.x);
    normal.z += (current.x - next.x) * (current.y + next.y);
  }
  return normal.lengthSq() > 1e-12 ? normal.normalize() : new THREE.Vector3(0, 0, 1);
}

function projectedTriangles(vertices: number[], loop: number[]): number[][] {
  const normal = loopNormal(vertices, loop);
  const dropAxis = Math.abs(normal.x) > Math.abs(normal.y)
    ? (Math.abs(normal.x) > Math.abs(normal.z) ? 0 : 2)
    : (Math.abs(normal.y) > Math.abs(normal.z) ? 1 : 2);
  const points = loop.map((vertex) => {
    const point = pointOf(vertices, vertex);
    if (dropAxis === 0) return new THREE.Vector2(point.y, point.z);
    if (dropAxis === 1) return new THREE.Vector2(point.x, point.z);
    return new THREE.Vector2(point.x, point.y);
  });
  const triangles = THREE.ShapeUtils.triangulateShape(points, []);
  if (!triangles.length) return [];
  const directed = new Set(loop.map((vertex, index) => `${vertex}:${loop[(index + 1) % loop.length]}`));
  let flip = false;
  for (const triangle of triangles) {
    const ids = triangle.map((index) => loop[index]);
    if (directed.has(`${ids[0]}:${ids[1]}`) || directed.has(`${ids[1]}:${ids[2]}`) || directed.has(`${ids[2]}:${ids[0]}`)) { flip = true; break; }
    if (directed.has(`${ids[1]}:${ids[0]}`) || directed.has(`${ids[2]}:${ids[1]}`) || directed.has(`${ids[0]}:${ids[2]}`)) break;
  }
  return triangles.map(([a, b, c]) => flip ? [loop[a], loop[c], loop[b]] : [loop[a], loop[b], loop[c]]);
}

function centroidTriangles(vertices: number[], loop: number[], soapFilm: boolean): { center: number; triangles: number[][] } {
  const center = new THREE.Vector3();
  loop.forEach((vertex) => center.add(pointOf(vertices, vertex)));
  center.multiplyScalar(1 / loop.length);
  if (soapFilm) {
    const normal = loopNormal(vertices, loop);
    const averageRadius = loop.reduce((sum, vertex) => sum + pointOf(vertices, vertex).distanceTo(center), 0) / loop.length;
    center.addScaledVector(normal, -averageRadius * .06);
  }
  const centerIndex = vertices.length / 3;
  vertices.push(center.x, center.y, center.z);
  return {
    center: centerIndex,
    triangles: loop.map((a, index) => [loop[(index + 1) % loop.length], a, centerIndex]),
  };
}

export function closeOpenMesh(mesh: CutterMesh, algorithm: CapAlgorithm): { mesh: CutterMesh; cap: CutterMesh; boundaryLoops: number } {
  const welded = weldMesh(mesh);
  const edges = boundaryEdges(welded);
  const loops = orderedBoundaryLoops(edges);
  const vertices = welded.vertices.slice();
  const capIndices: number[] = [];
  for (const loop of loops) {
    let triangles: number[][] = [];
    if (algorithm === 'cdt' || algorithm === 'projected') triangles = projectedTriangles(vertices, loop);
    if (!triangles.length || algorithm === 'centroid' || algorithm === 'winding' || algorithm === 'soap-film') {
      triangles = centroidTriangles(vertices, loop, algorithm === 'soap-film').triangles;
    }
    triangles.forEach((triangle) => capIndices.push(...triangle));
  }
  return {
    mesh: { vertices, indices: [...welded.indices, ...capIndices] },
    cap: { vertices: vertices.slice(), indices: capIndices },
    boundaryLoops: loops.length,
  };
}

export function meshBoundaryCount(mesh: CutterMesh): number {
  return orderedBoundaryLoops(boundaryEdges(mesh)).length;
}

export function boundaryFrame(mesh: CutterMesh): { center: [number, number, number]; normal: [number, number, number] } {
  const welded = weldMesh(mesh);
  const edges = boundaryEdges(welded);
  const vertexIds = [...new Set(edges.flatMap((edge) => [edge.a, edge.b]))];
  const center = new THREE.Vector3();
  vertexIds.forEach((vertex) => center.add(pointOf(welded.vertices, vertex)));
  if (vertexIds.length) center.multiplyScalar(1 / vertexIds.length);
  const normal = new THREE.Vector3();
  for (let index = 0; index + 2 < welded.indices.length; index += 3) {
    const a = pointOf(welded.vertices, welded.indices[index]);
    const b = pointOf(welded.vertices, welded.indices[index + 1]);
    const c = pointOf(welded.vertices, welded.indices[index + 2]);
    normal.add(b.sub(a).cross(c.sub(a)));
  }
  if (normal.lengthSq() < 1e-12) normal.set(0, 0, 1);
  normal.normalize();
  return { center: center.toArray() as [number, number, number], normal: normal.toArray() as [number, number, number] };
}

export function deformMeshWithBrush(mesh: CutterMesh, center: [number, number, number], normal: [number, number, number], radius: number, amount: number): CutterMesh {
  const vertices = mesh.vertices.slice();
  const brushCenter = new THREE.Vector3(...center);
  const direction = new THREE.Vector3(...normal).normalize();
  const point = new THREE.Vector3();
  const safeRadius = Math.max(radius, EDGE_EPSILON);
  for (let vertex = 0; vertex * 3 + 2 < vertices.length; vertex += 1) {
    point.set(vertices[vertex * 3], vertices[vertex * 3 + 1], vertices[vertex * 3 + 2]);
    const distance = point.distanceTo(brushCenter);
    if (distance > safeRadius) continue;
    const falloff = .5 + .5 * Math.cos(Math.PI * distance / safeRadius);
    point.addScaledVector(direction, amount * falloff);
    vertices[vertex * 3] = point.x; vertices[vertex * 3 + 1] = point.y; vertices[vertex * 3 + 2] = point.z;
  }
  return { vertices, indices: mesh.indices.slice() };
}
