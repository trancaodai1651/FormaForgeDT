import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Module from '../../../apps/web/node_modules/manifold-3d/manifold.js';
import { unzipSync, strFromU8 } from '../../../apps/web/node_modules/fflate/esm/browser.js';
import { buildHybridClicker } from '../../../apps/web/src/clicker/geometry/buildHybridClicker';
import { buildThreeMF } from '../../../apps/web/src/clicker/export/threemfExport';
import type { BuildParams, BuildRegion, ClickerPart, Ring } from '../../../apps/web/src/clicker/types';

function ribbedFixture(): ClickerPart[] | null {
  const file = process.env.CLICKER_RIBBED_FIXTURE;
  if (!file) return null;
  const zip = unzipSync(readFileSync(file));
  const entry = Object.entries(zip).find(([path]) => /3D\/Objects\/[^/]+\.model$/i.test(path));
  if (!entry) throw new Error('3MF has no object model');
  const xml = strFromU8(entry[1]);
  const root = strFromU8(zip['3D/3dmodel.model']);
  const transforms = new Map([...root.matchAll(/<component\s+[^>]*objectid="(\d+)"[^>]*transform="([^"]+)"/g)]
    .map((match) => [match[1], match[2].trim().split(/\s+/).map(Number)]));
  const parts = [...xml.matchAll(/<object\s+id="(\d+)"[^>]*>([\s\S]*?)<\/object>/g)].map((object) => {
    const source = object[2];
    const shift = transforms.get(object[1]) ?? Array(12).fill(0);
    const vertices = [...source.matchAll(/<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/g)]
      .flatMap((match) => [Number(match[1]) + shift[9], Number(match[2]) + shift[10], Number(match[3]) + shift[11]]);
    const triangles = [...source.matchAll(/<triangle\s+v1="(\d+)"\s+v2="(\d+)"\s+v3="(\d+)"/g)]
      .flatMap((match) => [Number(match[1]), Number(match[2]), Number(match[3])]);
    return { kind: 'body', group: 'base', name: `ribbed-part-${object[1]}`, colorRgb: [240, 185, 103], numProp: 3, vertProperties: new Float32Array(vertices), triVerts: new Uint32Array(triangles) } as ClickerPart;
  });
  if (!parts.length) throw new Error('3MF has no printable block meshes');
  return parts;
}

describe('Clicker imported block image attachment', () => {
  it('joins the image head and imported block with a printable neck and exports both', async () => {
    const wasm = await Module();
    wasm.setup();
    const fixture = ribbedFixture();
    const cube = wasm.Manifold.cube([27, 27, 16], true);
    const mesh = cube.getMesh();
    const imported = fixture ?? [{ kind: 'body', group: 'base', name: 'imported-block-0', colorRgb: [240, 185, 103], numProp: mesh.numProp, vertProperties: new Float32Array(mesh.vertProperties), triVerts: new Uint32Array(mesh.triVerts) } as ClickerPart];
    const outline: Array<Array<[number, number]>> = [[[-20, -20], [20, -20], [20, 20], [-20, 20]]];
    const disk = (x: number, y: number, radius: number): Ring => Array.from({ length: 24 }, (_, i) => {
      const angle = i * Math.PI * 2 / 24;
      return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
    });
    const imageRegions: BuildRegion[] = [
      { partName: 'top-color-0-0', filamentRgb: [250, 248, 245], coverage: 0.76, rings: outline },
      { partName: 'top-color-1-0', filamentRgb: [30, 30, 30], coverage: 0.12, rings: [disk(-8, 5, 5)] },
      { partName: 'top-color-2-0', filamentRgb: [245, 142, 166], coverage: 0.08, rings: [disk(8, 5, 5)] },
      { partName: 'top-color-3-0', filamentRgb: [245, 200, 100], coverage: 0.04, rings: [disk(0, -8, 4)] },
    ];
    const params = { hybridImageSizeMm: 40, hybridImageThicknessMm: 17, hybridBaseThicknessMm: 9, hybridImagePaddingMm: 1.2, hybridNeckLengthMm: 3, hybridBaseImageOverlapMm: 7, baseFilamentRgb: [245, 142, 166], bodyColorRgb: [240, 240, 240], componentHeights: {}, keychain: { enabled: false } } as BuildParams;
    const result = buildHybridClicker(wasm, {} as never, { meta: { topExtent: [18] }, shell: { positions: new Float32Array([-9, -9, 0, 9, -9, 0, 9, 9, 0, -9, 9, 0]) } } as never, null, imageRegions, outline, params, { vertical: true, bodyColorRgb: [240, 240, 240] } as never, imported);
    expect(result.parts.some((part) => part.name === 'hybrid-continuous-base')).toBe(true);
    expect(result.parts.some((part) => part.name === 'hybrid-image-base')).toBe(true);
    if (fixture) {
      expect(result.parts.some((part) => part.name === 'ribbed-part-2')).toBe(false);
      expect(result.parts.some((part) => part.name === 'ribbed-part-3')).toBe(true);
    }
    const merged = result.parts.find((part) => part.name === 'hybrid-continuous-base')!;
    expect(merged.triVerts.length).toBeGreaterThan(0);
    expect(result.parts.some((part) => part.name === 'hybrid-image-1')).toBe(true);
    expect(result.parts.every((part) => part.vertProperties.every(Number.isFinite))).toBe(true);
    expect(result.parts.reduce((sum, part) => sum + part.triVerts.length / 3, 0)).toBeLessThan(200_000);
    const solid = wasm.Manifold.ofMesh(new wasm.Mesh({ numProp: merged.numProp, vertProperties: merged.vertProperties, triVerts: merged.triVerts }));
    expect(solid.isEmpty()).toBe(false);
    const bounds = solid.boundingBox();
    expect(bounds.max[1] - bounds.min[1]).toBeGreaterThan(35);
    const larger = buildHybridClicker(wasm, {} as never, { meta: { topExtent: [18] }, shell: { positions: new Float32Array([-9, -9, 0, 9, -9, 0, 9, 9, 0, -9, 9, 0]) } } as never, null, [], outline,
      { ...params, hybridImageSizeMm: 75, hybridImageLateralOffsetMm: 15, hybridImageThicknessMm: 21, keychain: { ...params.keychain, enabled: true } } as BuildParams,
      { vertical: true, bodyColorRgb: [240, 240, 240] } as never, imported);
    const shiftedHead = larger.parts.find((part) => part.name === 'hybrid-image-base')!;
    const originalHead = result.parts.find((part) => part.name === 'hybrid-image-base')!;
    const xRange = (part: ClickerPart) => {
      const xs: number[] = [];
      for (let i = 0; i < part.vertProperties.length; i += part.numProp) xs.push(part.vertProperties[i]);
      return [Math.min(...xs), Math.max(...xs)];
    };
    const [oldMin, oldMax] = xRange(originalHead);
    const [newMin, newMax] = xRange(shiftedHead);
    expect((newMin + newMax) / 2 - (oldMin + oldMax) / 2).toBeCloseTo(15, 0);
    expect(newMax - newMin).toBeGreaterThan(oldMax - oldMin);
    expect(larger.switchPlacements).toHaveLength(0);
    const enlargedBody = larger.parts.find((part) => part.name === 'hybrid-continuous-base')!;
    const enlargedSolid = wasm.Manifold.ofMesh(new wasm.Mesh({ numProp: enlargedBody.numProp, vertProperties: enlargedBody.vertProperties, triVerts: enlargedBody.triVerts }));
    expect(enlargedSolid.isEmpty()).toBe(false);
    const connectedBodies = enlargedSolid.decompose();
    expect(connectedBodies).toHaveLength(1);
    connectedBodies.forEach((body: { delete(): void }) => body.delete());
    enlargedSolid.delete();
    const widerBlock = imported.map((part) => {
      const vertices = new Float32Array(part.vertProperties);
      for (let i = 0; i < vertices.length; i += part.numProp) {
        vertices[i] *= 1.4;
        vertices[i + 1] *= 1.15;
      }
      return { ...part, vertProperties: vertices };
    });
    const resizedBlockResult = buildHybridClicker(wasm, {} as never, { meta: { topExtent: [18] }, shell: { positions: new Float32Array([-9, -9, 0, 9, -9, 0, 9, 9, 0, -9, 9, 0]) } } as never, null, [], outline,
      { ...params, hybridImageSizeMm: 60, hybridImageLateralOffsetMm: -12 } as BuildParams,
      { vertical: true, bodyColorRgb: [240, 240, 240] } as never, widerBlock);
    const resizedBody = resizedBlockResult.parts.find((part) => part.name === 'hybrid-continuous-base')!;
    const resizedSolid = wasm.Manifold.ofMesh(new wasm.Mesh({ numProp: resizedBody.numProp, vertProperties: resizedBody.vertProperties, triVerts: resizedBody.triVerts }));
    const resizedComponents = resizedSolid.decompose();
    expect(resizedComponents).toHaveLength(1);
    resizedComponents.forEach((component: { delete(): void }) => component.delete());
    resizedSolid.delete();
    const horizontalResult = buildHybridClicker(wasm, {} as never, { meta: { topExtent: [18] }, shell: { positions: new Float32Array([-9, -9, 0, 9, -9, 0, 9, 9, 0, -9, 9, 0]) } } as never, null, [], outline,
      { ...params, hybridImageLateralOffsetMm: 10, keychain: { ...params.keychain, enabled: true, offsetMm: 4 } } as BuildParams,
      { vertical: false, bodyColorRgb: [240, 240, 240] } as never, imported);
    const horizontalBody = horizontalResult.parts.find((part) => part.name === 'hybrid-continuous-base')!;
    const horizontalSolid = wasm.Manifold.ofMesh(new wasm.Mesh({ numProp: horizontalBody.numProp, vertProperties: horizontalBody.vertProperties, triVerts: horizontalBody.triVerts }));
    const horizontalComponents = horizontalSolid.decompose();
    expect(horizontalComponents).toHaveLength(1);
    horizontalComponents.forEach((component: { delete(): void }) => component.delete());
    horizontalSolid.delete();
    const archive = unzipSync(buildThreeMF(result.parts));
    const model = strFromU8(archive['3D/3dmodel.model']);
    expect(model).toContain('displaycolor="#f0b967FF"');
    expect(model).toContain('displaycolor="#f58ea6FF"');
    solid.delete();
    cube.delete();
  });
});
