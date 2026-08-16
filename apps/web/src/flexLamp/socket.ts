import type { MeshData } from '@hometown/types';

/** Adds the removable MH001-style socket collar to an imported model. */
export function attachSocketRing(mesh: MeshData, outerRadius = 26, innerRadius = 21, ringHeight = 8, segments = 48): MeshData {
  const vertices = mesh.vertices.slice(); const indices = mesh.indices.slice();
  const bottom = -mesh.metadata.height / 2 - ringHeight; const top = -mesh.metadata.height / 2;
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments; const a = (index / segments) * Math.PI * 2; const b = (next / segments) * Math.PI * 2;
    const start = vertices.length / 3;
    [[Math.cos(a) * outerRadius, bottom, Math.sin(a) * outerRadius], [Math.cos(a) * outerRadius, top, Math.sin(a) * outerRadius], [Math.cos(a) * innerRadius, top, Math.sin(a) * innerRadius], [Math.cos(a) * innerRadius, bottom, Math.sin(a) * innerRadius], [Math.cos(b) * outerRadius, bottom, Math.sin(b) * outerRadius], [Math.cos(b) * outerRadius, top, Math.sin(b) * outerRadius], [Math.cos(b) * innerRadius, top, Math.sin(b) * innerRadius], [Math.cos(b) * innerRadius, bottom, Math.sin(b) * innerRadius]].forEach(([x, y, z]) => vertices.push(x, y, z));
    indices.push(start, start + 1, start + 5, start, start + 5, start + 4, start + 1, start + 2, start + 6, start + 1, start + 6, start + 5, start + 2, start + 3, start + 7, start + 2, start + 7, start + 6, start + 3, start, start + 4, start + 3, start + 4, start + 7);
  }
  return { ...mesh, vertices, indices, metadata: { ...mesh.metadata, width: Math.max(mesh.metadata.width, outerRadius * 2), depth: Math.max(mesh.metadata.depth, outerRadius * 2), height: mesh.metadata.height + ringHeight } };
}
