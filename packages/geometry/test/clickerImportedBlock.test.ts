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

function triangleFaceSignatures(vertices: ArrayLike<number>, triangles: ArrayLike<number>, stride: number, zOffset = 0): string[] {
  const round = (value: number) => String(Math.round(value * 1e5) / 1e5);
  const faces: string[] = [];
  for (let index = 0; index + 2 < triangles.length; index += 3) {
    const corners = [triangles[index], triangles[index + 1], triangles[index + 2]].map((vertex) => {
      const offset = vertex * stride;
      return [round(vertices[offset]), round(vertices[offset + 1]), round(vertices[offset + 2] - zOffset)].join(',');
    });
    faces.push(corners.sort().join('|'));
  }
  return faces.sort();
}

describe('Clicker imported block image attachment', () => {
  it('keeps near-but-distinct image palette colours in the hybrid preview and 3MF', async () => {
    const wasm = await Module();
    wasm.setup();
    const cube = wasm.Manifold.cube([20, 20, 12], true).translate([0, 0, 6]);
    const mesh = cube.getMesh();
    const imported: ClickerPart[] = [{
      kind: 'body', group: 'base', name: 'colour-preservation-block', colorRgb: [240, 185, 103],
      numProp: mesh.numProp, vertProperties: new Float32Array(mesh.vertProperties), triVerts: new Uint32Array(mesh.triVerts),
    }];
    const outline: Ring[] = [[[-20, -20], [20, -20], [20, 20], [-20, 20]]];
    const accent: Ring = Array.from({ length: 32 }, (_, index) => {
      const angle = index * Math.PI * 2 / 32;
      return [7 + Math.cos(angle) * 4, 5 + Math.sin(angle) * 4];
    });
    const regions: BuildRegion[] = [
      { partName: 'top-color-0-0', filamentRgb: [250, 248, 245], coverage: 0.96, rings: outline },
      // This is only two red levels away from the carrier, but it remains a
      // separate user-selected source colour and must not be silently merged.
      { partName: 'top-color-1-0', filamentRgb: [248, 248, 245], coverage: 0.04, rings: [accent] },
    ];
    const params = {
      hybridImageSizeMm: 40, hybridImageThicknessMm: 17, hybridBaseThicknessMm: 9,
      hybridImagePaddingMm: 0, hybridNeckLengthMm: 0, hybridBaseImageOverlapMm: 7,
      colorBleed: 0, componentHeights: {}, keychain: { enabled: false }, bodyColorRgb: [240, 240, 240],
    } as BuildParams;
    const result = buildHybridClicker(wasm, {} as never,
      { meta: { topExtent: [18] }, shell: { positions: new Float32Array([-9, -9, 0, 9, -9, 0, 9, 9, 0, -9, 9, 0]) } } as never,
      null, regions, outline, params, { vertical: true, bodyColorRgb: [240, 240, 240] } as never, imported);
    const accentPart = result.parts.find((part) => part.name === 'hybrid-image-1');
    expect(accentPart).toBeDefined();
    expect(accentPart?.colorRgb).toEqual([248, 248, 245]);
    expect(accentPart?.triVerts.length).toBeGreaterThan(0);

    const archive = unzipSync(buildThreeMF(result.parts));
    const model = strFromU8(archive['3D/3dmodel.model']);
    expect(model).toContain('displaycolor="#f8f8f5FF"');
    cube.delete();
  });

  it('keeps every imported image colour on one flat top plane and bonds the skin to its backing', async () => {
    const wasm = await Module();
    wasm.setup();
    const cube = wasm.Manifold.cube([20, 20, 12], true).translate([0, 0, 6]);
    const mesh = cube.getMesh();
    const imported: ClickerPart[] = [{
      kind: 'body', group: 'base', name: 'flat-skin-block', colorRgb: [240, 185, 103],
      numProp: mesh.numProp, vertProperties: new Float32Array(mesh.vertProperties), triVerts: new Uint32Array(mesh.triVerts),
    }];
    const outline: Ring[] = [[[-20, -20], [-20, 20], [20, 20], [20, -20]]];
    const accent: Ring = [[-15, -15], [-15, 15], [-5, 15], [-5, -15]];
    const regions: BuildRegion[] = [
      { partName: 'top-color-0-0', filamentRgb: [250, 248, 245], coverage: 0.9, rings: outline },
      { partName: 'top-color-1-0', filamentRgb: [25, 30, 35], coverage: 0.1, rings: [accent] },
    ];
    const result = buildHybridClicker(wasm, {} as never,
      { meta: { topExtent: [18] }, shell: { positions: new Float32Array([-9, -9, 0, 9, -9, 0, 9, 9, 0, -9, 9, 0]) } } as never,
      null, regions, outline,
      { hybridImageSizeMm: 40, hybridImageThicknessMm: 17, hybridBaseThicknessMm: 9,
        hybridImagePaddingMm: 0, hybridNeckLengthMm: 0, hybridBaseImageOverlapMm: 7,
        colorBleed: 0, componentHeights: {}, keychain: { enabled: false }, bodyColorRgb: [240, 240, 240] } as BuildParams,
      { vertical: true, bodyColorRgb: [240, 240, 240] } as never, imported);
    const topPlaneZ = 17 - 9 + 0.04;
    const carrier = result.parts.find((part) => part.name === 'hybrid-image-base')!;
    const ink = result.parts.find((part) => part.name === 'hybrid-image-1')!;
    const bounds = (part: ClickerPart) => {
      const zs: number[] = [];
      for (let index = 0; index < part.vertProperties.length; index += part.numProp) zs.push(part.vertProperties[index + 2]);
      return { min: Math.min(...zs), max: Math.max(...zs) };
    };
    expect(bounds(carrier).max).toBeCloseTo(topPlaneZ, 5);
    expect(bounds(ink).max).toBeCloseTo(topPlaneZ, 5);

    // At a plane inside the overlap, backing material remains under the image
    // colour. Without this support the colour regions merely touch the backing
    // at a face, which makes the exported image look uneven in some slicers.
    const backing = result.parts.find((part) => part.name === 'hybrid-image-backing')!;
    const backingSolid = wasm.Manifold.ofMesh(new wasm.Mesh({ numProp: backing.numProp, vertProperties: backing.vertProperties, triVerts: backing.triVerts }));
    const supportSlice = backingSolid.slice(topPlaneZ - 0.25);
    expect(supportSlice.area()).toBeGreaterThan(1500);

    const archive = unzipSync(buildThreeMF(result.parts));
    const model = strFromU8(archive['3D/3dmodel.model']);
    const settings = strFromU8(archive['Metadata/model_settings.config']);
    const modelMinZ = Math.min(...result.parts.flatMap((part) =>
      Array.from({ length: part.vertProperties.length / part.numProp }, (_, index) => part.vertProperties[index * part.numProp + 2]),
    ));
    expect(model).toContain('displaycolor="#191e23FF"');
    expect(model).toContain('displaycolor="#faf8f5FF"');
    for (const name of ['hybrid-image-base', 'hybrid-image-1']) {
      const objectId = settings.match(new RegExp(`<part id="(\\d+)" subtype="normal_part"><metadata key="name" value="${name}"`));
      expect(objectId).not.toBeNull();
      const object = model.match(new RegExp(`<object id="${objectId![1]}"[^>]*>([\\s\\S]*?)</object>`));
      expect(object).not.toBeNull();
      const exportedZ = [...object![1].matchAll(/<vertex x="[^"]+" y="[^"]+" z="([^"]+)"\/>/g)].map((match) => Number(match[1]));
      expect(Math.max(...exportedZ)).toBeCloseTo(topPlaneZ - modelMinZ, 5);
    }
    supportSlice.delete(); backingSolid.delete(); cube.delete();
  });

  it('matches the imported image body height to the source block height by default when enabled', async () => {
    const wasm = await Module();
    wasm.setup();
    const cube = wasm.Manifold.cube([20, 20, 12], true).translate([0, 0, 6]);
    const mesh = cube.getMesh();
    const imported: ClickerPart[] = [{
      kind: 'body', group: 'base', name: 'height-match-block', colorRgb: [240, 185, 103],
      numProp: mesh.numProp, vertProperties: new Float32Array(mesh.vertProperties), triVerts: new Uint32Array(mesh.triVerts),
    }];
    const outline: Ring[] = [[[-20, -20], [20, -20], [20, 20], [-20, 20]]];
    const regions: BuildRegion[] = [{ partName: 'top-color-0-0', filamentRgb: [250, 248, 245], coverage: 1, rings: outline }];
    const result = buildHybridClicker(wasm, {} as never,
      { meta: { topExtent: [18] }, shell: { positions: new Float32Array([-9, -9, 0, 9, -9, 0, 9, 9, 0, -9, 9, 0]) } } as never,
      null, regions, outline,
      { hybridImageSizeMm: 40, hybridImageThicknessMm: 17, hybridImageMatchBlockHeight: true, hybridBaseThicknessMm: 9, hybridImagePaddingMm: 1.2, hybridImportedBlockSpacingMm: 3, componentHeights: {}, keychain: { enabled: false }, bodyColorRgb: [240, 240, 240] } as BuildParams,
      { vertical: true, bodyColorRgb: [240, 240, 240] } as never, imported);
    const imageBody = result.parts.find((part) => part.name === 'hybrid-image-backing')!;
    const placedBlock = result.parts.find((part) => part.name === 'height-match-block')!;
    const zBounds = (part: ClickerPart) => {
      const z: number[] = [];
      for (let index = 0; index < part.vertProperties.length; index += part.numProp) z.push(part.vertProperties[index + 2]);
      return [Math.min(...z), Math.max(...z)];
    };
    const [imageBottom, imageTop] = zBounds(imageBody);
    const [blockBottom, blockTop] = zBounds(placedBlock);
    expect(imageTop - imageBottom).toBeCloseTo(blockTop - blockBottom, 4);
    expect(imageBottom).toBeCloseTo(blockBottom, 4);
    expect(imageTop).toBeCloseTo(blockTop, 4);
    cube.delete();
  });

  it('places the custom bottom image below the main image on the same face', async () => {
    const wasm = await Module();
    wasm.setup();
    const cube = wasm.Manifold.cube([20, 20, 12], true).translate([0, 0, 6]);
    const mesh = cube.getMesh();
    const imported: ClickerPart[] = [{
      kind: 'body', group: 'base', name: 'bottom-image-block', colorRgb: [240, 185, 103],
      numProp: mesh.numProp, vertProperties: new Float32Array(mesh.vertProperties), triVerts: new Uint32Array(mesh.triVerts),
    }];
    const outline: Ring[] = [[[-20, -20], [-20, 20], [20, 20], [20, -20]]];
    const bottomOutline: Ring[] = [[[-20, -20], [-20, 20], [20, 20], [20, -20]]];
    const regions: BuildRegion[] = [
      { partName: 'top-color-0-0', filamentRgb: [240, 240, 240], coverage: 0.9, rings: outline },
      { partName: 'top-color-1-0', filamentRgb: [30, 180, 220], coverage: 0.1, rings: [[[-15, -15], [-15, 15], [-5, 15], [-5, -15]]] },
    ];
    const bottomRegions: BuildRegion[] = [{
      partName: 'bottom-color-0-0', filamentRgb: [240, 80, 120], coverage: 1, rings: bottomOutline,
    }];
    const result = buildHybridClicker(wasm, {} as never,
      { meta: { topExtent: [18] }, shell: { positions: new Float32Array([-9, -9, 0, 9, -9, 0, 9, 9, 0, -9, 9, 0]) } } as never,
      null, regions, outline,
      { hybridImageSizeMm: 40, hybridImageMatchBlockHeight: true, hybridBaseThicknessMm: 9, hybridImagePaddingMm: 1, hybridImportedBlockSpacingMm: 3, bottomOutline, bottomRegions, bottomExpandPercent: 0, bottomPaddingMm: 0, componentHeights: {}, keychain: { enabled: false }, bodyColorRgb: [240, 240, 240] } as BuildParams,
      { vertical: true, bodyColorRgb: [240, 240, 240] } as never, imported);
    const topArtwork = result.parts.find((part) => part.name === 'hybrid-image-1')!;
    const bottomArtwork = result.parts.find((part) => part.name === 'hybrid-image-0-bottom')!;
    const placedBlock = result.parts.find((part) => part.name === 'bottom-image-block')!;
    const bounds = (part: ClickerPart) => {
      const x: number[] = []; const y: number[] = []; const z: number[] = [];
      for (let index = 0; index < part.vertProperties.length; index += part.numProp) {
        x.push(part.vertProperties[index]); y.push(part.vertProperties[index + 1]); z.push(part.vertProperties[index + 2]);
      }
      return { minX: Math.min(...x), maxX: Math.max(...x), minY: Math.min(...y), maxY: Math.max(...y), minZ: Math.min(...z), maxZ: Math.max(...z) };
    };
    const topBounds = bounds(topArtwork);
    const bottomBounds = bounds(bottomArtwork);
    const blockBounds = bounds(placedBlock);
    expect((bottomBounds.minY + bottomBounds.maxY) / 2).toBeLessThan((topBounds.minY + topBounds.maxY) / 2);
    expect(bottomBounds.maxZ).toBeCloseTo(topBounds.maxZ, 4);
    expect(blockBounds.maxY).toBeLessThan(bottomBounds.minY);
    cube.delete();
  });

  it('clips imported image masks to the head and keeps contour holes', async () => {
    const wasm = await Module();
    wasm.setup();
    const cube = wasm.Manifold.cube([20, 20, 12], true).translate([0, 0, 6]);
    const mesh = cube.getMesh();
    const imported: ClickerPart[] = [{
      kind: 'body', group: 'base', name: 'imported-block-mask-test', colorRgb: [240, 185, 103],
      numProp: mesh.numProp, vertProperties: new Float32Array(mesh.vertProperties), triVerts: new Uint32Array(mesh.triVerts),
    }];
    const outer: Ring = [[-25, -25], [25, -25], [25, 25], [-25, 25]];
    const hole: Ring = [[-5, -5], [-5, 5], [5, 5], [5, -5]];
    const sourceOutline: Ring[] = [[[-20, -20], [20, -20], [20, 20], [-20, 20]]];
    const regions: BuildRegion[] = [
      { partName: 'top-color-0-0', filamentRgb: [250, 248, 245], coverage: 0.9, rings: sourceOutline },
      { partName: 'top-color-1-0', filamentRgb: [25, 30, 35], coverage: 0.1, rings: [outer, hole] },
    ];
    const params = {
      hybridImageSizeMm: 40, hybridImageThicknessMm: 17, hybridBaseThicknessMm: 9,
      hybridImagePaddingMm: 0, hybridNeckLengthMm: 0, hybridBaseImageOverlapMm: 7,
      colorBleed: 0, componentHeights: {}, keychain: { enabled: false },
      bodyColorRgb: [240, 240, 240],
    } as BuildParams;
    const result = buildHybridClicker(wasm, {} as never,
      { meta: { topExtent: [18] }, shell: { positions: new Float32Array([-9, -9, 0, 9, -9, 0, 9, 9, 0, -9, 9, 0]) } } as never,
      null, regions, sourceOutline, params, { vertical: true, bodyColorRgb: [240, 240, 240] } as never, imported);
    const ink = result.parts.find((part) => part.name === 'hybrid-image-1')!;
    const inkSolid = wasm.Manifold.ofMesh(new wasm.Mesh({ numProp: ink.numProp, vertProperties: ink.vertProperties, triVerts: ink.triVerts }));
    const inkSlice = inkSolid.slice(8.03);
    expect(inkSlice.area()).toBeCloseTo(1500, 2);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let index = 0; index < ink.vertProperties.length; index += ink.numProp) {
      xs.push(ink.vertProperties[index]);
      ys.push(ink.vertProperties[index + 1]);
    }
    expect(Math.min(...xs)).toBeCloseTo(-20, 3);
    expect(Math.max(...xs)).toBeCloseTo(20, 3);
    expect(Math.min(...ys)).toBeCloseTo(-20, 3);
    expect(Math.max(...ys)).toBeCloseTo(20, 3);
    inkSlice.delete(); inkSolid.delete(); cube.delete();
  });

  it('anchors an imported multi-mesh assembly by its complete bounds without changing component offsets', async () => {
    const wasm = await Module();
    wasm.setup();
    const main = wasm.Manifold.cube([20, 20, 12], true).translate([0, 0, 6]);
    const detail = wasm.Manifold.cube([4, 4, 4], true).translate([0, 18, 10]);
    const mainMesh = main.getMesh();
    const detailMesh = detail.getMesh();
    const imported: ClickerPart[] = [
      { kind: 'body', group: 'base', name: 'assembly-main', colorRgb: [240, 185, 103], numProp: mainMesh.numProp, vertProperties: new Float32Array(mainMesh.vertProperties), triVerts: new Uint32Array(mainMesh.triVerts) },
      { kind: 'body', group: 'base', name: 'assembly-detail', colorRgb: [240, 185, 103], numProp: detailMesh.numProp, vertProperties: new Float32Array(detailMesh.vertProperties), triVerts: new Uint32Array(detailMesh.triVerts) },
    ];
    const sourceOutline: Ring[] = [[[-20, -20], [20, -20], [20, 20], [-20, 20]]];
    const regions: BuildRegion[] = [{ partName: 'top-color-0-0', filamentRgb: [250, 248, 245], coverage: 1, rings: sourceOutline }];
    const params = {
      hybridImageSizeMm: 40, hybridImageThicknessMm: 17, hybridBaseThicknessMm: 9,
      hybridImagePaddingMm: 1.2, hybridNeckLengthMm: 3, hybridBaseImageOverlapMm: 7,
      componentHeights: {}, keychain: { enabled: false }, bodyColorRgb: [240, 240, 240],
    } as BuildParams;
    const result = buildHybridClicker(wasm, {} as never,
      { meta: { topExtent: [18] }, shell: { positions: new Float32Array([-9, -9, 0, 9, -9, 0, 9, 9, 0, -9, 9, 0]) } } as never,
      null, regions, sourceOutline, params, { vertical: true, bodyColorRgb: [240, 240, 240] } as never, imported);
    const outputMain = result.parts.find((part) => part.name === 'assembly-main')!;
    const outputDetail = result.parts.find((part) => part.name === 'assembly-detail')!;
    const combinedMaxY = Math.max(
      ...[outputMain, outputDetail].flatMap((part) => Array.from({ length: part.vertProperties.length / part.numProp }, (_, index) => part.vertProperties[index * part.numProp + 1])),
    );
    expect(combinedMaxY).toBeCloseTo(-24.2, 1);
    const meanY = (part: ClickerPart) => {
      let total = 0;
      for (let index = 0; index < part.vertProperties.length; index += part.numProp) total += part.vertProperties[index + 1];
      return total / (part.vertProperties.length / part.numProp);
    };
    expect(meanY(outputDetail) - meanY(outputMain)).toBeCloseTo(18, 4);
    for (const [source, output] of [[imported[0], outputMain], [imported[1], outputDetail]]) {
      expect(output.triVerts).toEqual(source.triVerts);
      const translation = [0, 1, 2].map((axis) => output.vertProperties[axis] - source.vertProperties[axis]);
      for (let index = 0; index < source.vertProperties.length; index += source.numProp) {
        for (let axis = 0; axis < 3; axis++) expect(output.vertProperties[index + axis] - source.vertProperties[index + axis]).toBeCloseTo(translation[axis], 4);
      }
    }
    main.delete(); detail.delete();
  });

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
    const imageSkin = result.parts.find((part) => part.name === 'hybrid-image-base')!;
    const whiteBacking = result.parts.find((part) => part.name === 'hybrid-image-backing')!;
    expect(whiteBacking.colorRgb).toEqual([240, 240, 240]);
    const skinZ = Array.from({ length: imageSkin.vertProperties.length / imageSkin.numProp }, (_, i) => imageSkin.vertProperties[i * imageSkin.numProp + 2]);
    expect(Math.max(...skinZ) - Math.min(...skinZ)).toBeLessThan(0.4);
    const neck = result.parts.find((part) => part.name === 'hybrid-continuous-base')!;
    expect(neck.triVerts.length).toBeGreaterThan(0);
    expect(result.parts.some((part) => part.name === 'hybrid-image-1')).toBe(true);
    expect(result.parts.every((part) => part.vertProperties.every(Number.isFinite))).toBe(true);
    expect(result.parts.reduce((sum, part) => sum + part.triVerts.length / 3, 0)).toBeLessThan(200_000);
    const neckSolid = wasm.Manifold.ofMesh(new wasm.Mesh({ numProp: neck.numProp, vertProperties: neck.vertProperties, triVerts: neck.triVerts }));
    expect(neckSolid.isEmpty()).toBe(false);
    const neckBounds = neckSolid.boundingBox();
    expect(neckBounds.max[1] - neckBounds.min[1]).toBeGreaterThan(3);
    expect(neckBounds.max[1] - neckBounds.min[1]).toBeLessThan(20);
    const neckComponents = neckSolid.decompose();
    expect(neckComponents).toHaveLength(1);
    neckComponents.forEach((component: { delete(): void }) => component.delete());

    // The imported meshes keep their source triangles and receive only one
    // rigid translation for placement. This catches the slicer mismatch that
    // came from rebuilding the imported body through a Boolean union.
    expect(result.parts.filter((part) => imported.some((source) => source.name === part.name))).toHaveLength(imported.length);
    for (const source of imported) {
      const output = result.parts.find((part) => part.name === source.name)!;
      expect(output).toBeDefined();
      expect(output.numProp).toBe(source.numProp);
      expect(output.triVerts).toEqual(source.triVerts);
      expect(output.vertProperties.length).toBe(source.vertProperties.length);
      const firstCoordinateDelta = [0, 1, 2].map((axis) => output.vertProperties[axis] - source.vertProperties[axis]);
      for (let index = 0; index < source.vertProperties.length; index += source.numProp) {
        for (let axis = 0; axis < 3; axis++) {
          expect(output.vertProperties[index + axis] - source.vertProperties[index + axis]).toBeCloseTo(firstCoordinateDelta[axis], 4);
        }
      }
    }

    const unsmoothed = buildHybridClicker(wasm, {} as never, { meta: { topExtent: [18] }, shell: { positions: new Float32Array([-9, -9, 0, 9, -9, 0, 9, 9, 0, -9, 9, 0]) } } as never, null, imageRegions, outline,
      { ...params, hybridNeckSmooth: false } as BuildParams,
      { vertical: true, bodyColorRgb: [240, 240, 240] } as never, imported);
    const unsmoothedNeck = unsmoothed.parts.find((part) => part.name === 'hybrid-continuous-base')!;
    expect(unsmoothedNeck.triVerts.length).toBeGreaterThan(0);
    const smoothingChangesMesh = unsmoothedNeck.vertProperties.length !== neck.vertProperties.length
      || unsmoothedNeck.triVerts.length !== neck.triVerts.length
      || unsmoothedNeck.vertProperties.some((value, index) => Math.abs(value - neck.vertProperties[index]) > 1e-5);
    expect(smoothingChangesMesh).toBe(true);

    const noNeck = buildHybridClicker(wasm, {} as never, { meta: { topExtent: [18] }, shell: { positions: new Float32Array([-9, -9, 0, 9, -9, 0, 9, 9, 0, -9, 9, 0]) } } as never, null, imageRegions, outline,
      { ...params, hybridNeckEnabled: false } as BuildParams,
      { vertical: true, bodyColorRgb: [240, 240, 240] } as never, imported);
    expect(noNeck.parts.some((part) => part.name === 'hybrid-continuous-base')).toBe(false);
    expect(noNeck.parts.filter((part) => imported.some((source) => source.name === part.name))).toHaveLength(imported.length);
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
    const settings = strFromU8(archive['Metadata/model_settings.config']);
    expect(model).toContain('displaycolor="#f0b967FF"');
    expect(model).toContain('displaycolor="#f58ea6FF"');
    const exportedMinZ = Math.min(...result.parts.flatMap((part) =>
      Array.from({ length: part.vertProperties.length / part.numProp }, (_, index) => part.vertProperties[index * part.numProp + 2]),
    ));
    for (const source of imported) {
      const partConfig = settings.match(new RegExp(`<part id="(\\d+)" subtype="normal_part"><metadata key="name" value="${source.name}"/>`));
      expect(partConfig).not.toBeNull();
      const object = model.match(new RegExp(`<object id="${partConfig![1]}"[^>]*>([\\s\\S]*?)</object>`));
      expect(object).not.toBeNull();
      const exportedVertices = [...object![1].matchAll(/<vertex x="([^\"]+)" y="([^\"]+)" z="([^\"]+)"\/>/g)]
        .flatMap((match) => [Number(match[1]), Number(match[2]), Number(match[3])]);
      const exportedTriangles = [...object![1].matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g)]
        .flatMap((match) => [Number(match[1]), Number(match[2]), Number(match[3])]);
      const output = result.parts.find((part) => part.name === source.name)!;
      expect(triangleFaceSignatures(exportedVertices, exportedTriangles, 3)).toEqual(
        triangleFaceSignatures(output.vertProperties, output.triVerts, output.numProp, exportedMinZ),
      );
    }
    neckSolid.delete();
    cube.delete();
  });

  it('places Top keyrings at the image face and Bottom keyrings at the backing base, with open holes', async () => {
    const wasm = await Module();
    wasm.setup();
    const cube = wasm.Manifold.cube([27, 27, 16], true).translate([0, 0, 8]);
    const mesh = cube.getMesh();
    const imported: ClickerPart[] = [{
      kind: 'body', group: 'base', name: 'keyring-hole-block', colorRgb: [240, 185, 103],
      numProp: mesh.numProp, vertProperties: new Float32Array(mesh.vertProperties), triVerts: new Uint32Array(mesh.triVerts),
    }];
    const outline: Ring[] = [[[-20, -20], [20, -20], [20, 20], [-20, 20]]];
    const head = { meta: { topExtent: [18] }, shell: { positions: new Float32Array([-9, -9, 0, 9, -9, 0, 9, 9, 0, -9, 9, 0]) } };

    for (const position of ['top', 'bottom'] as const) {
      const result = buildHybridClicker(wasm, {} as never, head as never, null, [], outline, {
        hybridImageSizeMm: 40, hybridImageThicknessMm: 17, hybridBaseThicknessMm: 9,
        hybridImagePaddingMm: 1.2, hybridNeckLengthMm: 3, hybridBaseImageOverlapMm: 7,
        hybridKeychainHeightMm: 4, keychain: { enabled: true, holeDiameterMm: 5.2, offsetMm: 0, hybridPosition: position },
        bodyColorRgb: [240, 240, 240], componentHeights: {},
      } as BuildParams, { vertical: true, bodyColorRgb: [240, 240, 240] } as never, imported);
      const neck = result.parts.find((part) => part.name === 'hybrid-continuous-base')!;
      const neckSolid = wasm.Manifold.ofMesh(new wasm.Mesh({ numProp: neck.numProp, vertProperties: neck.vertProperties, triVerts: neck.triVerts }));
      const neckBounds = neckSolid.boundingBox();
      expect(neckBounds.max[2] - neckBounds.min[2]).toBeGreaterThan(4);

      // The hole is centered one loop radius beyond the padded image edge.
      // Check a smaller disk at the middle of its Z range against every output
      // mesh; this catches the imported block or neck filling the hole.
      // Both choices are at the head of the artwork, opposite the block.
      const holeCenterY = 20 + 1.2 + 4.4;
      expect(holeCenterY).toBeGreaterThan(neckBounds.max[1] + 2.6);
      const holeInterior = wasm.CrossSection.circle(2.1, 48).translate([0, holeCenterY]);
      const imageTop = 17 - 9 + 0.04;
      const holePlaneZ = position === 'top' ? imageTop - 0.05 : -9 + 4 - 0.05;
      let coveredArea = 0;
      for (const part of result.parts) {
        if (!part.triVerts.length) continue;
        const solid = wasm.Manifold.ofMesh(new wasm.Mesh({ numProp: part.numProp, vertProperties: part.vertProperties, triVerts: part.triVerts }));
        const slice = solid.slice(holePlaneZ);
        const overlap = holeInterior.intersect(slice);
        coveredArea += overlap.area();
        overlap.delete(); slice.delete(); solid.delete();
      }
      expect(coveredArea).toBeLessThan(0.02);
      // Witness real loop material at the selected height, rather than just
      // an empty hole. Bottom must not also leave a tab at the image face.
      const ringWitness = wasm.CrossSection.circle(0.2, 24).translate([3.4, holeCenterY]);
      let ringArea = 0;
      for (const part of result.parts) {
        if (!part.triVerts.length) continue;
        const solid = wasm.Manifold.ofMesh(new wasm.Mesh({ numProp: part.numProp, vertProperties: part.vertProperties, triVerts: part.triVerts }));
        const slice = solid.slice(holePlaneZ);
        const overlap = ringWitness.intersect(slice);
        ringArea += overlap.area();
        overlap.delete(); slice.delete(); solid.delete();
      }
      expect(ringArea).toBeGreaterThan(0.08);
      if (position === 'bottom') {
        let frontArea = 0;
        for (const part of result.parts) {
          const solid = wasm.Manifold.ofMesh(new wasm.Mesh({ numProp: part.numProp, vertProperties: part.vertProperties, triVerts: part.triVerts }));
          const slice = solid.slice(imageTop - 0.05);
          const overlap = ringWitness.intersect(slice);
          frontArea += overlap.area();
          overlap.delete(); slice.delete(); solid.delete();
        }
        expect(frontArea).toBeLessThan(0.001);
      }
      // Read the exported mesh, after its print-bed Z translation, and verify
      // the ring and through-hole survive at the selected height.
      const archive = unzipSync(buildThreeMF(result.parts));
      const model = strFromU8(archive['3D/3dmodel.model']);
      let exportedRingArea = 0;
      let exportedHoleArea = 0;
      for (const object of model.matchAll(/<object[^>]*>([\s\S]*?)<\/object>/g)) {
        const vertices = [...object[1].matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)]
          .flatMap((match) => [Number(match[1]), Number(match[2]), Number(match[3])]);
        const triangles = [...object[1].matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g)]
          .flatMap((match) => [Number(match[1]), Number(match[2]), Number(match[3])]);
        if (!triangles.length) continue;
        const solid = wasm.Manifold.ofMesh(new wasm.Mesh({ numProp: 3, vertProperties: new Float32Array(vertices), triVerts: new Uint32Array(triangles) }));
        const slice = solid.slice(holePlaneZ + 9);
        const wall = ringWitness.intersect(slice);
        const bore = holeInterior.intersect(slice);
        exportedRingArea += wall.area(); exportedHoleArea += bore.area();
        wall.delete(); bore.delete(); slice.delete(); solid.delete();
      }
      expect(exportedRingArea).toBeGreaterThan(0.08);
      expect(exportedHoleArea).toBeLessThan(0.02);
      ringWitness.delete(); holeInterior.delete(); neckSolid.delete();
    }
    cube.delete();
  });

  it('moves the imported block with the spacing control and reshapes the neck to span the gap', async () => {
    const wasm = await Module();
    wasm.setup();
    const cube = wasm.Manifold.cube([27, 27, 16], true).translate([0, 0, 8]);
    const mesh = cube.getMesh();
    const imported: ClickerPart[] = [{
      kind: 'body', group: 'base', name: 'spacing-block', colorRgb: [240, 185, 103],
      numProp: mesh.numProp, vertProperties: new Float32Array(mesh.vertProperties), triVerts: new Uint32Array(mesh.triVerts),
    }];
    const outline: Ring[] = [[[-20, -20], [20, -20], [20, 20], [-20, 20]]];
    const head = { meta: { topExtent: [18] }, shell: { positions: new Float32Array([-9, -9, 0, 9, -9, 0, 9, 9, 0, -9, 9, 0]) } };
    const build = (distance: number, neckEnabled = true, vertical = true, blockLateral = 0) => buildHybridClicker(wasm, {} as never, head as never, null, [], outline, {
      hybridImageSizeMm: 40, hybridImageThicknessMm: 17, hybridBaseThicknessMm: 9,
      hybridImagePaddingMm: 1.2, hybridNeckLengthMm: 3, hybridImportedBlockSpacingMm: distance,
      hybridBlockLateralOffsetMm: blockLateral, hybridNeckEnabled: neckEnabled,
      hybridBaseImageOverlapMm: 7, keychain: { enabled: false }, bodyColorRgb: [240, 240, 240], componentHeights: {},
    } as BuildParams, { vertical, bodyColorRgb: [240, 240, 240] } as never, imported);
    const axisBounds = (part: ClickerPart, axis: 0 | 1) => {
      const values: number[] = [];
      for (let i = 0; i < part.vertProperties.length; i += part.numProp) values.push(part.vertProperties[i + axis]);
      return [Math.min(...values), Math.max(...values)];
    };
    const near = build(3);
    const far = build(12);
    const nearBlock = near.parts.find((part) => part.name === 'spacing-block')!;
    const farBlock = far.parts.find((part) => part.name === 'spacing-block')!;
    expect(axisBounds(farBlock, 1)[1] - axisBounds(nearBlock, 1)[1]).toBeCloseTo(-9, 4);
    const nearNeck = near.parts.find((part) => part.name === 'hybrid-continuous-base')!;
    const farNeck = far.parts.find((part) => part.name === 'hybrid-continuous-base')!;
    // Smooth edge offsets add a small radius-dependent difference to the raw
    // translated bounds, so compare at sub-millimetre precision.
    expect(axisBounds(farNeck, 1)[0] - axisBounds(nearNeck, 1)[0]).toBeCloseTo(-9, 0);
    const overlapping = build(-6);
    const overlappingBlock = overlapping.parts.find((part) => part.name === 'spacing-block')!;
    expect(axisBounds(overlappingBlock, 1)[1] - axisBounds(nearBlock, 1)[1]).toBeCloseTo(9, 4);
    expect(overlapping.parts.some((part) => part.name === 'hybrid-continuous-base')).toBe(true);

    const shiftedVertical = build(3, true, true, 7);
    const shiftedVerticalBlock = shiftedVertical.parts.find((part) => part.name === 'spacing-block')!;
    const xCenter = (part: ClickerPart, axis: 0 | 1) => (axisBounds(part, axis)[0] + axisBounds(part, axis)[1]) / 2;
    expect(xCenter(shiftedVerticalBlock, 0) - xCenter(nearBlock, 0)).toBeCloseTo(7, 4);
    const shiftedArchive = unzipSync(buildThreeMF(shiftedVertical.parts));
    const shiftedModel = strFromU8(shiftedArchive['3D/3dmodel.model']);
    const shiftedSettings = strFromU8(shiftedArchive['Metadata/model_settings.config']);
    const shiftedConfig = shiftedSettings.match(/<part id="(\d+)" subtype="normal_part"><metadata key="name" value="spacing-block"/);
    expect(shiftedConfig).not.toBeNull();
    const shiftedObject = shiftedModel.match(new RegExp(`<object id="${shiftedConfig![1]}"[^>]*>([\\s\\S]*?)</object>`));
    expect(shiftedObject).not.toBeNull();
    const exportedVertices = [...shiftedObject![1].matchAll(/<vertex x="([^\"]+)" y="([^\"]+)" z="([^\"]+)"\/>/g)]
      .flatMap((match) => [Number(match[1]), Number(match[2]), Number(match[3])]);
    const exportedTriangles = [...shiftedObject![1].matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g)]
      .flatMap((match) => [Number(match[1]), Number(match[2]), Number(match[3])]);
    const shiftedExportMinZ = Math.min(...shiftedVertical.parts.flatMap((part) =>
      Array.from({ length: part.vertProperties.length / part.numProp }, (_, index) => part.vertProperties[index * part.numProp + 2]),
    ));
    expect(triangleFaceSignatures(exportedVertices, exportedTriangles, 3)).toEqual(
      triangleFaceSignatures(shiftedVerticalBlock.vertProperties, shiftedVerticalBlock.triVerts, shiftedVerticalBlock.numProp, shiftedExportMinZ),
    );

    const horizontal = build(3, true, false);
    const shiftedHorizontal = build(3, true, false, -5);
    const horizontalBlock = horizontal.parts.find((part) => part.name === 'spacing-block')!;
    const shiftedHorizontalBlock = shiftedHorizontal.parts.find((part) => part.name === 'spacing-block')!;
    expect(xCenter(shiftedHorizontalBlock, 1) - xCenter(horizontalBlock, 1)).toBeCloseTo(-5, 4);

    const hiddenNeck = build(12, false);
    expect(hiddenNeck.parts.some((part) => part.name === 'hybrid-continuous-base')).toBe(false);
    expect(axisBounds(hiddenNeck.parts.find((part) => part.name === 'spacing-block')!, 1)[1] - axisBounds(nearBlock, 1)[1]).toBeCloseTo(-9, 4);
    cube.delete();
  });
});
