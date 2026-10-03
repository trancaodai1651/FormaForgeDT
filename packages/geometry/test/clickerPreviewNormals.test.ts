import { describe, expect, it } from 'vitest';
import Module from '../../../apps/web/node_modules/manifold-3d/manifold.js';
import { partToGeometry } from '../../../apps/web/src/clicker/viewer/partGeometry';
import type { ClickerPart } from '../../../apps/web/src/clicker/types';

function topNormalError(geometry: ReturnType<typeof partToGeometry>, z: number): number {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const index = geometry.getIndex();
  let error = 0, capCount = 0;
  const vertex = (i: number) => index ? index.getX(i) : i;
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    const ids = [vertex(i), vertex(i + 1), vertex(i + 2)];
    if (!ids.every(v => Math.abs(positions.getZ(v) - z) < 1e-5)) continue;
    capCount++;
    for (const v of ids) error = Math.max(error,
      Math.hypot(normals.getX(v), normals.getY(v), normals.getZ(v) - 1));
  }
  expect(capCount).toBeGreaterThan(0);
  return error;
}

describe('Clicker flat colour preview', () => {
  it('keeps dense carrier caps as flat as small colour caps without changing printable triangles', async () => {
    const wasm = await Module(); wasm.setup();
    for (const segments of [64, 4096]) {
      const cylinder = wasm.Manifold.cylinder(4, 10, 10, segments);
      const mesh = cylinder.getMesh();
      const part: ClickerPart = { kind: 'body', group: 'base', name: segments === 64 ? 'hybrid-image-1' : 'hybrid-image-base',
        colorRgb: [255, 255, 255], numProp: mesh.numProp, vertProperties: mesh.vertProperties, triVerts: mesh.triVerts };
      if (segments > 64) {
        expect(part.triVerts.length).toBeGreaterThan(36_000);
        // Reproduce the old dense-mesh path: cap normals inherit wall normals.
        const old = partToGeometry({ ...part, name: 'imported-block' }, true);
        expect(topNormalError(old, 4)).toBeGreaterThan(0.1);
        old.dispose();
      }
      const sourceVertices = new Float32Array(part.vertProperties);
      const sourceIndices = new Uint32Array(part.triVerts);
      const preview = partToGeometry(part);
      expect(topNormalError(preview, 4)).toBeLessThan(1e-6);
      expect(part.vertProperties).toEqual(sourceVertices);
      expect(part.triVerts).toEqual(sourceIndices);
      const positions = preview.getAttribute('position');
      const indices = preview.getIndex();
      expect(indices?.count ?? positions.count).toBe(part.triVerts.length);
      // Preview may split a shared corner for lighting, but every triangle
      // retains its exact source coordinates. Export consumes the source mesh.
      for (let i = 0; i < part.triVerts.length; i++) {
        const v = indices ? indices.getX(i) : i;
        const source = part.triVerts[i] * part.numProp;
        expect(positions.getX(v)).toBe(part.vertProperties[source]);
        expect(positions.getY(v)).toBe(part.vertProperties[source + 1]);
        expect(positions.getZ(v)).toBe(part.vertProperties[source + 2]);
      }
      if (indices) expect(positions.count).toBeLessThan(part.triVerts.length);
      preview.dispose(); cylinder.delete();
    }
  });
});
