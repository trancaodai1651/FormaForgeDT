import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { sanitizeMesh, splitMeshShells } from '../../../apps/web/src/clicker/export/meshUtils';
import { buildThreeMF } from '../../../apps/web/src/clicker/export/threemfExport';
import { buildSTL } from '../../../apps/web/src/clicker/export/stlExport';
import type { ClickerPart } from '../../../apps/web/src/clicker/types';

function tetrahedron(scale = 1, offset = 0): ClickerPart {
  return { name: 'hybrid-image-base', kind: 'body', group: 'base', colorRgb: [253, 252, 251], numProp: 3,
    vertProperties: new Float32Array([offset, 0, 0, offset + scale, 0, 0, offset, scale, 0, offset, 0, scale]),
    triVerts: new Uint32Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]) };
}

function expectClosed(coordinates: number[][], triangles: number[][]) {
  // Match the slicer's geometric welding, not only the source index topology.
  const edges = new Map<string, [number, number]>();
  for (const triangle of triangles) for (let i = 0; i < 3; i++) {
    const a = coordinates[triangle[i]].join(','), b = coordinates[triangle[(i + 1) % 3]].join(',');
    expect(a).not.toBe(b);
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const edge = edges.get(key) ?? [0, 0];
    edge[0]++; edge[1] += a < b ? 1 : -1;
    edges.set(key, edge);
  }
  for (const edge of edges.values()) expect(edge).toEqual([2, 0]);
}

function expectArchiveClosed(parts: ClickerPart[]) {
  const file = buildThreeMF(parts);
  const xml = strFromU8(unzipSync(file)['3D/3dmodel.model']);
  let totalTriangles = 0;
  for (const match of xml.matchAll(/<mesh>([\s\S]*?)<\/mesh>/g)) {
    const vertices = [...match[1].matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)]
      .map(v => v.slice(1).map(Number));
    const triangles = [...match[1].matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g)]
      .map(t => t.slice(1).map(Number));
    totalTriangles += triangles.length;
    expectClosed(vertices, triangles);
  }
  expect(totalTriangles).toBe(parts.reduce((n, p) => n + p.triVerts.length / 3, 0));
  return file;
}

describe('Clicker export topology', () => {
  it('keeps tiny closed details and their precision in both STL and 3MF', () => {
    const part = tetrahedron(0.000001);
    expect(sanitizeMesh(part)).toBe(part);
    expectArchiveClosed([part]);
    const stl = buildSTL([part]);
    expect(new DataView(stl.buffer, stl.byteOffset).getUint32(80, true)).toBe(4);
  });

  it('keeps closed touching shells separate without welding or removing triangles', () => {
    const first = tetrahedron();
    const second = tetrahedron();
    // Shared vertical edge, separate topological vertices on either side.
    second.vertProperties[3] = -1;
    second.vertProperties[7] = -1;
    const joined = { ...first,
      vertProperties: new Float32Array([...first.vertProperties, ...second.vertProperties]),
      triVerts: new Uint32Array([...first.triVerts, ...second.triVerts.map(i => i + 4)]) };
    expect(splitMeshShells(joined)).toHaveLength(2);
    expectArchiveClosed([joined]);
  });

  it('rejects invalid payloads instead of silently deleting faces and leaving holes', () => {
    const part = tetrahedron();
    part.triVerts[0] = 99;
    expect(() => buildThreeMF([part])).toThrow('Invalid mesh triangle index');
  });

  it.skipIf(!process.env.CLICKER_RAW_PARTS_FIXTURE)('round-trips every real Ppony + Ribbed shell without open or non-manifold edges', () => {
    const json = JSON.parse(readFileSync(process.env.CLICKER_RAW_PARTS_FIXTURE!, 'utf8'));
    expect(json.length).toBeGreaterThan(0);
    const parts: ClickerPart[] = json.map((p: ClickerPart) => ({ ...p,
      vertProperties: new Float32Array(p.vertProperties), triVerts: new Uint32Array(p.triVerts) }));
    const archive = expectArchiveClosed(parts);
    if (process.env.CLICKER_EXPORT_QA_FILE) writeFileSync(process.env.CLICKER_EXPORT_QA_FILE, archive);
  });
});
