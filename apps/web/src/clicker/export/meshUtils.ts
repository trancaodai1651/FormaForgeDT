import type { ClickerPart, PartGroup } from '../types';

/** Validate an export payload without changing its topological vertex IDs.
 * Rounding/welding coordinates or deleting narrow faces can open a closed
 * Manifold mesh. Repairs belong in the solid builder, not in serialization.
 */
export function sanitizeMesh(part: ClickerPart): ClickerPart {
  const stride = part.numProp;
  const vertices = part.vertProperties;
  const triangles = part.triVerts;
  if (!Number.isInteger(stride) || stride < 3 || vertices.length % stride || triangles.length % 3) {
    throw new Error(`Invalid mesh layout: ${part.name}`);
  }
  for (let i = 0; i < vertices.length; i += stride) {
    if (![vertices[i], vertices[i + 1], vertices[i + 2]].every(Number.isFinite)) {
      throw new Error(`Non-finite mesh vertex: ${part.name}`);
    }
  }
  const count = vertices.length / stride;
  if (!triangles.every(index => Number.isInteger(index) && index >= 0 && index < count)) {
    throw new Error(`Invalid mesh triangle index: ${part.name}`);
  }
  return part;
}

/** Keep disconnected shells in separate 3MF volumes. Slicers weld vertices
 * inside a volume by position, which turns two closed shells touching along
 * an edge into a non-manifold mesh even when their vertex IDs are distinct.
 */
export function splitMeshShells(part: ClickerPart): ClickerPart[] {
  sanitizeMesh(part);
  const { numProp: stride, vertProperties: vertices, triVerts: triangles } = part;
  const parent = Uint32Array.from({ length: vertices.length / stride }, (_, i) => i);
  const root = (vertex: number): number => {
    while (parent[vertex] !== vertex) {
      parent[vertex] = parent[parent[vertex]];
      vertex = parent[vertex];
    }
    return vertex;
  };
  for (let i = 0; i < triangles.length; i += 3) {
    parent[root(triangles[i + 1])] = root(triangles[i]);
    parent[root(triangles[i + 2])] = root(triangles[i]);
  }
  const shells = new Map<number, number[]>();
  for (let i = 0; i < triangles.length; i += 3) {
    const id = root(triangles[i]);
    if (!shells.has(id)) shells.set(id, []);
    shells.get(id)!.push(triangles[i], triangles[i + 1], triangles[i + 2]);
  }
  if (shells.size <= 1) return [part];
  // Disjoint shells with no shared positions are already safe in one volume.
  // Preserve original imported assemblies and their leaf identities.
  const shellAtPosition = new Map<string, number>();
  let touchingShells = false;
  for (const index of new Set(triangles)) {
    const key = `${vertices[index * stride]},${vertices[index * stride + 1]},${vertices[index * stride + 2]}`;
    const shell = root(index);
    const previous = shellAtPosition.get(key);
    if (previous !== undefined && previous !== shell) { touchingShells = true; break; }
    shellAtPosition.set(key, shell);
  }
  if (!touchingShells) return [part];
  return [...shells.values()].map((indices, shellIndex) => {
    const remap = new Map<number, number>();
    const properties: number[] = [];
    const remapped = indices.map(index => {
      let mapped = remap.get(index);
      if (mapped === undefined) {
        mapped = remap.size;
        remap.set(index, mapped);
        for (let p = 0; p < stride; p++) properties.push(vertices[index * stride + p]);
      }
      return mapped;
    });
    return {
      ...part,
      name: shellIndex === 0 ? part.name : `${part.name}-shell-${shellIndex + 1}`,
      vertProperties: new Float32Array(properties),
      triVerts: new Uint32Array(remapped),
    };
  });
}

/** Tính toán Bounding Box để lật nắp và đế nằm ngang nhau */
export function groupBBox(
  parts: ClickerPart[],
  groupId: PartGroup,
  minZ: number,
): { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number } {
  let bMinX = Infinity, bMaxX = -Infinity;
  let bMinY = Infinity, bMaxY = -Infinity;
  let bMinZ = Infinity, bMaxZ = -Infinity;
  for (const p of parts) {
    if (p.group !== groupId) continue;
    const np = p.numProp;
    const vp = p.vertProperties;
    for (let i = 0; i < vp.length; i += np) {
      const x = vp[i], y = vp[i + 1], z = vp[i + 2] - minZ;
      if (x < bMinX) bMinX = x;
      if (x > bMaxX) bMaxX = x;
      if (y < bMinY) bMinY = y;
      if (y > bMaxY) bMaxY = y;
      if (z < bMinZ) bMinZ = z;
      if (z > bMaxZ) bMaxZ = z;
    }
  }
  return { minX: bMinX, maxX: bMaxX, minY: bMinY, maxY: bMaxY, minZ: bMinZ, maxZ: bMaxZ };
}
