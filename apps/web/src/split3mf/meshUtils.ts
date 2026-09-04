import * as THREE from 'three';
import type { CutterMesh } from '../stlCutter/geometry';

function weld(mesh: CutterMesh): CutterMesh {
  const vertices: number[] = [];
  const indices: number[] = [];
  const byPosition = new Map<string, number>();
  for (const sourceIndex of mesh.indices) {
    const offset = sourceIndex * 3;
    const key = `${Math.round(mesh.vertices[offset] * 100000)},${Math.round(mesh.vertices[offset + 1] * 100000)},${Math.round(mesh.vertices[offset + 2] * 100000)}`;
    let targetIndex = byPosition.get(key);
    if (targetIndex === undefined) {
      targetIndex = vertices.length / 3;
      byPosition.set(key, targetIndex);
      vertices.push(mesh.vertices[offset], mesh.vertices[offset + 1], mesh.vertices[offset + 2]);
    }
    indices.push(targetIndex);
  }
  return { vertices, indices };
}

export function smoothMeshBoundary(mesh: CutterMesh, iterations: number, strength: number): CutterMesh {
  const source = weld(mesh);
  const edgeUse = new Map<string, number>();
  const neighbors = Array.from({ length: source.vertices.length / 3 }, () => new Set<number>());
  for (let index = 0; index + 2 < source.indices.length; index += 3) {
    const triangle = [source.indices[index], source.indices[index + 1], source.indices[index + 2]];
    for (let edge = 0; edge < 3; edge += 1) {
      const a = triangle[edge];
      const b = triangle[(edge + 1) % 3];
      neighbors[a].add(b); neighbors[b].add(a);
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
    }
  }
  const boundary = new Set<number>();
  for (const [key, uses] of edgeUse) {
    if (uses !== 1) continue;
    const [a, b] = key.split(':').map(Number);
    boundary.add(a); boundary.add(b);
  }
  const movable = boundary.size ? boundary : new Set(neighbors.map((_, index) => index));
  let vertices = source.vertices.slice();
  const amount = Math.max(0, Math.min(.9, strength));
  for (let pass = 0; pass < Math.max(1, Math.min(12, Math.round(iterations))); pass += 1) {
    const next = vertices.slice();
    for (const vertex of movable) {
      const adjacent = [...neighbors[vertex]].filter((item) => !boundary.size || boundary.has(item));
      if (adjacent.length < 2) continue;
      for (let axis = 0; axis < 3; axis += 1) {
        const average = adjacent.reduce((sum, item) => sum + vertices[item * 3 + axis], 0) / adjacent.length;
        next[vertex * 3 + axis] = vertices[vertex * 3 + axis] * (1 - amount) + average * amount;
      }
    }
    vertices = next;
  }
  return { vertices, indices: source.indices.slice() };
}

export function surfaceArea(mesh: CutterMesh): number {
  let area = 0;
  const a = new THREE.Vector3(); const b = new THREE.Vector3(); const c = new THREE.Vector3();
  const edgeOne = new THREE.Vector3(); const edgeTwo = new THREE.Vector3();
  for (let index = 0; index + 2 < mesh.indices.length; index += 3) {
    a.fromArray(mesh.vertices, mesh.indices[index] * 3);
    b.fromArray(mesh.vertices, mesh.indices[index + 1] * 3);
    c.fromArray(mesh.vertices, mesh.indices[index + 2] * 3);
    area += edgeOne.subVectors(b, a).cross(edgeTwo.subVectors(c, a)).length() / 2;
  }
  return area;
}
