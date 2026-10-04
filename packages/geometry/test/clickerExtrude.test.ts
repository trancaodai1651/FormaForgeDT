import { describe, expect, it } from 'vitest';
import Module from '../../../apps/web/node_modules/manifold-3d/manifold.js';
import { unzipSync, strFromU8 } from '../../../apps/web/node_modules/fflate/esm/browser.js';
import { buildBlocks } from '../../../apps/web/src/clicker/geometry/buildBlocks';
import { buildClicker } from '../../../apps/web/src/clicker/geometry/buildClicker';
import { buildHybridClicker } from '../../../apps/web/src/clicker/geometry/buildHybridClicker';
import { buildThreeMF } from '../../../apps/web/src/clicker/export/threemfExport';
import { extrudeRegionAt } from '../../../apps/web/src/clicker/viewer/extrudeRegionPick';
import type { BuildParams, BuildRegion, ClickerPart, Ring } from '../../../apps/web/src/clicker/types';

const outline: Ring[] = [[[-20, -20], [20, -20], [20, 20], [-20, 20]]];
const square = (halfSize: number, x = 0, y = 0): Ring => [
  [x - halfSize, y - halfSize], [x + halfSize, y - halfSize],
  [x + halfSize, y + halfSize], [x - halfSize, y + halfSize],
];
const imageRegions: BuildRegion[] = [
  { partName: 'top-color-0-0', filamentRgb: [250, 248, 245], coverage: 0.9, rings: [square(18)] },
  { partName: 'top-color-1-0', filamentRgb: [25, 30, 35], coverage: 0.1, rings: [square(4)] },
];
const svgRegions: BuildRegion[] = [{ ...imageRegions[1], rings: [square(5, 5, 0)] }];
const iconRegions: BuildRegion[] = [{ ...imageRegions[1], rings: [square(4, -5, 0), square(3, 5, 0)] }];

function zBounds(part: ClickerPart) {
  const values: number[] = [];
  for (let index = 0; index < part.vertProperties.length; index += part.numProp) {
    values.push(part.vertProperties[index + 2]);
  }
  return { min: Math.min(...values), max: Math.max(...values) };
}

function largestTopZ(parts: ClickerPart[], name: string): number {
  const part = parts.find((candidate) => candidate.name === name);
  if (!part) throw new Error(`Missing extruded part ${name}`);
  return zBounds(part).max;
}

function partSectionArea(wasm: any, part: ClickerPart, z: number): number {
  const solid = wasm.Manifold.ofMesh(new wasm.Mesh({
    numProp: part.numProp,
    vertProperties: new Float32Array(part.vertProperties),
    triVerts: new Uint32Array(part.triVerts),
  }));
  const section = solid.slice(z);
  const area = section.area();
  section.delete();
  solid.delete();
  return area;
}

function expectThreeMfKeepsPartHeight(part: ClickerPart) {
  const sourceHeight = zBounds(part).max - zBounds(part).min;
  const archive = unzipSync(buildThreeMF([part]));
  const model = archive['3D/3dmodel.model'];
  if (!model) throw new Error('3MF export did not include the model object');
  const objectXml = strFromU8(model);
  const zValues = [...objectXml.matchAll(/<vertex\s+[^>]*z="([^"]+)"/g)].map((match) => Number(match[1]));
  expect(zValues.length).toBeGreaterThan(0);
  expect(Math.max(...zValues) - Math.min(...zValues)).toBeCloseTo(sourceHeight, 3);
}

async function setup() {
  const wasm = await Module();
  wasm.setup();
  const socket = wasm.Manifold.cube([10, 10, 4], true).translate([0, 0, -2]);
  const stem = wasm.Manifold.cube([7, 7, 3], true).translate([0, 0, 1.5]);
  const cap = wasm.Manifold.cube([18, 18, 8], true);
  const capMesh = cap.getMesh();
  const keycap = {
    shell: { positions: [...capMesh.vertProperties], indices: [...capMesh.triVerts] },
    meta: { center: [0, 0] as [number, number], topZ: 4, topExtent: [18, 18] as [number, number] },
  };
  const module = wasm.Manifold.cube([20, 20, 18], true);
  const assets = { byMask: new Map([[0, { solid: module, rot: 0 }]]), pitch: 22, pitchMax: 22, owned: [] };
  const blockParams = {
    blockWidthMm: 18, blockHeightMm: 18, blockDepthMm: 6, blockGapMm: 2,
    cornerRadiusMm: 3, fontSize: 15, legendBold: 0, legendExtrudeMm: 0,
    componentHeights: {}, stepHeight: 0.6, vertical: false,
    glyphs: [{ rings: [square(3)], filamentRgb: [30, 30, 30] as [number, number, number], partName: 'top-color-0-0' }],
    bodyColorRgb: [240, 240, 240] as [number, number, number],
    capColorRgb: [250, 248, 245] as [number, number, number],
    flatBottom: true, moduleThicknessMm: 18, keycapHeightMm: 8,
    keycapCornerRadiusMm: 2, keycapShape: 'rounded' as const,
    keycapMount: 'above' as const, keycapProfile: 'standard' as const,
    keycapUnit: 1, travel: 4,
  };
  const params = {
    baseShape: 'outline', capWidthMm: 40, topThickness: 2, imageDepth: 1,
    flatKeychainThicknessMm: 3, imageMargin: 1.2, borderWidth: 2,
    baseHeight: 16, floorThickness: 1.6, travel: 4,
    tolerance: 0.2, stemTolerance: 0, colorBleed: 0.12,
    extrudeChamfer: false, mergeTopFrame: false,
    capProud: 4, keepMeshesSeparate: true, isFlatKeychain: false,
    switches: [{ x: 0, y: 0, rotation: 0 }],
    keychain: { enabled: false, style: 'loop', angleDeg: 90, holeDiameterMm: 5.2, offsetMm: 0 },
    baseFilamentRgb: [250, 248, 245], bodyColorRgb: [240, 240, 240],
    edgeSettings: [], componentHeights: {}, stepHeight: 0.6,
    hybridImageSizeMm: 40, hybridImageThicknessMm: 17,
    hybridBaseThicknessMm: 9, hybridImagePaddingMm: 1.2,
    hybridNeckLengthMm: 3, hybridBaseImageOverlapMm: 7,
    hybridImageExtrudeMm: 0, hybridNeckEnabled: true,
    hybridNeckSmooth: true, hybridBaseStyle: 'rounded',
  } as BuildParams;
  return { wasm, socket, stem, cap, keycap, module, assets, blockParams, params };
}

describe('Clicker viewport Extrude', () => {
  it.each(['image', 'blocks', 'imported'] as const)('raises only the picked white island in %s mode', async mode => {
    const { wasm, assets, keycap, socket, stem, blockParams, params } = await setup();
    // The star is a white island inside orange, disconnected from the white background.
    const regions: BuildRegion[] = [
      { partName: 'top-color-0-0', filamentRgb: [250, 248, 245], coverage: 0.8,
        rings: [square(18), square(8).reverse()] },
      { partName: 'top-color-0-1', filamentRgb: [250, 248, 245], coverage: 0.8, rings: [square(2)] },
      { partName: 'top-color-1-0', filamentRgb: [255, 135, 0], coverage: 0.2,
        rings: [square(8), square(2).reverse()] },
    ];
    const source = wasm.Manifold.cube([20, 20, 12], true);
    const mesh = source.getMesh();
    const imported: ClickerPart[] = [{ kind: 'body', group: 'base', name: 'imported-block', colorRgb: [240, 185, 103],
      numProp: mesh.numProp, vertProperties: mesh.vertProperties, triVerts: mesh.triVerts }];
    const build = (componentHeights: Record<string, number>) => mode === 'image'
      ? buildClicker(wasm, socket, stem,
        regions.map(r => ({ ...r, rings: r.rings.map(ring => ring.map(([x, y]) => [x / 40, y / 40] as [number, number])) })),
        outline.map(ring => ring.map(([x, y]) => [x / 40, y / 40] as [number, number])),
        { ...params, imageMargin: 0, rasterImageMode: true, componentHeights })
      : buildHybridClicker(wasm, assets, keycap, socket, regions, outline, { ...params, componentHeights }, blockParams,
        mode === 'imported' ? imported : undefined);
    const plain = build({});
    const carrierName = mode === 'image' ? 'top-base' : 'hybrid-image-base';
    const carrier = plain.parts.find(p => p.name === carrierName)!;
    const starName = mode === 'image' ? 'top-color-0-1' : 'hybrid-image-1';
    const backgroundName = mode === 'image' ? 'top-color-0-0' : 'hybrid-image-0';
    const starPick = carrier.extrudeRegions!.find(p => p.name === starName)!;
    const ring = starPick.rings[0];
    const center = ring.reduce((sum, p) => [sum[0] + p[0] / ring.length, sum[1] + p[1] / ring.length], [0, 0]);
    expect(extrudeRegionAt(carrier, center[0], center[1])).toBe(starName);
    expect(extrudeRegionAt(carrier, center[0] + 12, center[1])).toBe(backgroundName);
    expect(extrudeRegionAt(carrier, center[0] + 5, center[1])).toBeUndefined();
    const baseline = zBounds(carrier).max;
    for (const level of [1, 3]) {
      const raised = build({ [starName]: level }).parts.find(p => p.name === carrierName)!;
      expect(zBounds(raised).max - baseline).toBeCloseTo(level * 0.6, 4);
      // Only the small star exists above the baseline, never the large white background.
      expect(partSectionArea(wasm, raised, baseline + 0.3)).toBeCloseTo(16, 2);
      expectThreeMfKeepsPartHeight(raised);
    }
    socket.delete(); stem.delete(); source.delete();
  });

  it.each([1, 3])('raises the white Image carrier by level %i and preserves the accent height', async level => {
    const { wasm, socket, stem, params } = await setup();
    const normalized = (rings: Ring[]) => rings.map(r => r.map(([x, y]) => [x / 40, y / 40] as [number, number]));
    const regions = imageRegions.map(r => ({ ...r, rings: normalized(r.rings) }));
    for (const stackColorLayers of [false, true]) {
      const build = (componentHeights: Record<string, number>) => buildClicker(wasm, socket, stem, regions, normalized(outline), {
        ...params, rasterImageMode: true, stackColorLayers,
        componentHeights: { ...(stackColorLayers ? { 'top-color-0-0': 0, 'top-color-1-0': 1 } : {}), ...componentHeights },
      });
      const plain = build({});
      const raised = build({ 'top-base': level });
      const carrier = raised.parts.find(p => p.name === 'top-base')!;
      expect(zBounds(carrier).max - largestTopZ(plain.parts, 'top-base')).toBeCloseTo(level * 0.6, 4);
      expect(largestTopZ(raised.parts, 'top-color-1-0')).toBeCloseTo(largestTopZ(plain.parts, 'top-color-1-0'), 4);
      expect(partSectionArea(wasm, carrier, largestTopZ(plain.parts, 'top-base') + 0.3)).toBeGreaterThan(100);
      expectThreeMfKeepsPartHeight(carrier);
      const reset = build({ 'top-base': 0 });
      expect(largestTopZ(reset.parts, 'top-base')).toBeCloseTo(largestTopZ(plain.parts, 'top-base'), 4);
    }
    socket.delete(); stem.delete();
  });

  it.each([1, 3])('raises the white hybrid carrier by level %i in generated and imported block modes', async level => {
    const { wasm, assets, keycap, socket, blockParams, params } = await setup();
    const source = wasm.Manifold.cube([20, 20, 12], true).translate([0, 0, 6]);
    const mesh = source.getMesh();
    const imported: ClickerPart[] = [{ kind: 'body', group: 'base', name: 'imported-block', colorRgb: [240, 185, 103],
      numProp: mesh.numProp, vertProperties: mesh.vertProperties, triVerts: mesh.triVerts }];
    for (const block of [undefined, imported]) for (const stackColorLayers of [false, true]) {
      const build = (componentHeights: Record<string, number>) => buildHybridClicker(wasm, assets, keycap, socket, imageRegions, outline, {
        ...params, stackColorLayers,
        componentHeights: { ...(stackColorLayers ? { 'top-color-0-0': 0, 'top-color-1-0': 1 } : {}), ...componentHeights },
      }, blockParams, block);
      const plain = build({});
      const raised = build({ 'hybrid-image-base': level });
      const carrier = raised.parts.find(p => p.name === 'hybrid-image-base')!;
      expect(zBounds(carrier).max - largestTopZ(plain.parts, carrier.name)).toBeCloseTo(level * 0.6, 4);
      expect(largestTopZ(raised.parts, 'hybrid-image-1')).toBeCloseTo(largestTopZ(plain.parts, 'hybrid-image-1'), 4);
      expect(partSectionArea(wasm, carrier, largestTopZ(plain.parts, carrier.name) + 0.3)).toBeGreaterThan(100);
      expectThreeMfKeepsPartHeight(carrier);
      if (block) expect(raised.parts.find(p => p.name === 'imported-block')?.triVerts).toEqual(mesh.triVerts);
      const reset = build({ 'hybrid-image-base': 0 });
      expect(largestTopZ(reset.parts, carrier.name)).toBeCloseTo(largestTopZ(plain.parts, carrier.name), 4);
    }
    socket.delete(); source.delete();
  });

  it('does not merge a distinct near-white Image palette entry into the carrier', async () => {
    const { wasm, socket, stem, params } = await setup();
    const normalizedOutline: Ring[] = [[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]];
    const nearWhiteAccent: Ring = [[-0.1, -0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, 0.1]];
    const regions: BuildRegion[] = [
      { partName: 'top-color-0-0', filamentRgb: [250, 248, 245], coverage: 0.96,
        rings: [[[-0.45, -0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, 0.45]]] },
      { partName: 'top-color-1-0', filamentRgb: [248, 248, 245], coverage: 0.04, rings: [nearWhiteAccent] },
    ];
    const result = buildClicker(wasm, socket, stem, regions, normalizedOutline, {
      ...params, rasterImageMode: true,
    });
    const accent = result.parts.find((part) => part.name === 'top-color-1-0');
    expect(accent).toBeDefined();
    expect(accent?.colorRgb).toEqual([248, 248, 245]);
    expect(accent?.triVerts.length).toBeGreaterThan(0);
    socket.delete(); stem.delete();
  });

  it('keeps the Image color inlay and backing pocket on the same contour', async () => {
    const { wasm, socket, stem, params } = await setup();
    const normalizedOutline: Ring[] = [[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]];
    const normalizedRegions: BuildRegion[] = [
      { partName: 'top-color-0-0', filamentRgb: [250, 248, 245], coverage: 0.9,
        rings: [[[-0.45, -0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, 0.45]]] },
      { partName: 'top-color-1-0', filamentRgb: [25, 30, 35], coverage: 0.1,
        rings: [[[-0.1, -0.1], [0.1, -0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, 0.1], [Number.NaN, Number.NaN]]] },
    ];
    const plain = buildClicker(wasm, socket, stem, [], normalizedOutline, {
      ...params, rasterImageMode: true,
    });
    const colored = buildClicker(wasm, socket, stem, normalizedRegions, normalizedOutline, {
      ...params, rasterImageMode: true,
    });
    const topZ = 3 + params.topThickness + params.imageDepth - 0.01;
    const expectedArea = partSectionArea(wasm, plain.parts.find((part) => part.name === 'top-base')!, topZ);
    const topBase = colored.parts.find((part) => part.name === 'top-base')!;
    const colorInlay = colored.parts.find((part) => part.name === 'top-color-1-0')!;
    const actualArea = partSectionArea(wasm, topBase, topZ)
      + partSectionArea(wasm, colorInlay, topZ);

    // A contour mismatch leaves a visible strip of the carrier between the
    // color region and its pocket. Compare the complete top surface to the
    // same cap without color cuts so even sub-pixel gaps fail this check.
    expect(Math.abs(actualArea - expectedArea)).toBeLessThan(0.02);

    const archive = unzipSync(buildThreeMF([topBase, colorInlay]));
    const model = archive['3D/3dmodel.model'];
    expect(model).toBeDefined();
    const modelXml = strFromU8(model!);
    expect(modelXml).toContain('top-base');
    expect(modelXml).toContain('top-color-1-0');
    socket.delete(); stem.delete();
  });

  it.each([
    { mode: 'Image', regions: imageRegions, rasterImageMode: true, selectedRegion: 1, outputName: 'top-color-1-0' },
    // Vector regions retain their source component identity. The raster-only
    // monochrome carrier optimization must not replace these printable paths.
    { mode: 'SVG', regions: svgRegions, rasterImageMode: false, selectedRegion: 0, outputName: 'top-color-1-0' },
    { mode: 'Icon', regions: iconRegions, rasterImageMode: false, selectedRegion: 0, outputName: 'top-color-1-0' },
    { mode: 'Text', regions: imageRegions, rasterImageMode: false, selectedRegion: 0, outputName: 'top-color-0-0' },
  ])('%s region extrusion changes the generated top mesh', async ({ mode, regions, rasterImageMode, selectedRegion, outputName }) => {
    const { wasm, socket, stem, params } = await setup();
    const componentName = regions[selectedRegion]?.partName;
    expect(componentName).toBeTruthy();
    const modeParams = mode === 'Icon' ? { ...params, baseShape: 'circle' as const } : params;
    const plain = buildClicker(wasm, socket, stem, regions, outline, {
      ...modeParams, rasterImageMode, componentHeights: {},
    });
    const raised = buildClicker(wasm, socket, stem, regions, outline, {
      ...modeParams, rasterImageMode, componentHeights: { [componentName!]: 1 },
    });
    const raisedPart = raised.parts.find((part) => part.name === outputName)!;
    expect(largestTopZ(raised.parts, outputName) - largestTopZ(plain.parts, outputName)).toBeGreaterThan(0.5);
    expectThreeMfKeepsPartHeight(raisedPart);
    socket.delete(); stem.delete();
  });

  it('Blocks legend extrusion changes the selected glyph mesh', async () => {
    const { wasm, assets, keycap, module, blockParams } = await setup();
    const plain = buildBlocks(wasm, assets, keycap, blockParams);
    const raised = buildBlocks(wasm, assets, keycap, {
      ...blockParams, componentHeights: { 'top-color-0-0': 1 },
    });
    const raisedPart = raised.parts.find((part) => part.name === 'top-color-0-0')!;
    expect(largestTopZ(raised.parts, 'top-color-0-0') - largestTopZ(plain.parts, 'top-color-0-0')).toBeGreaterThan(0.5);
    expectThreeMfKeepsPartHeight(raisedPart);
    module.delete();
  });

  it('Image + Blocks extrusion changes only the selected image mesh', async () => {
    const { wasm, assets, keycap, socket, blockParams, params } = await setup();
    const plain = buildHybridClicker(wasm, assets, keycap, socket, imageRegions, outline, {
      ...params, componentHeights: {},
    }, blockParams);
    const raised = buildHybridClicker(wasm, assets, keycap, socket, imageRegions, outline, {
      ...params, componentHeights: { 'top-color-1-0': 1 },
    }, blockParams);
    const raisedPart = raised.parts.find((part) => part.name === 'hybrid-image-1')!;
    expect(largestTopZ(raised.parts, 'hybrid-image-1') - largestTopZ(plain.parts, 'hybrid-image-1')).toBeGreaterThan(0.5);
    expectThreeMfKeepsPartHeight(raisedPart);
    socket.delete();
  });

  it('Image + Imported Block extrusion changes the image and leaves the imported block intact', async () => {
    const { wasm, assets, keycap, socket, blockParams, params } = await setup();
    const source = wasm.Manifold.cube([20, 20, 12], true).translate([0, 0, 6]);
    const mesh = source.getMesh();
    const imported: ClickerPart[] = [{
      kind: 'body', group: 'base', name: 'imported-block', colorRgb: [240, 185, 103],
      numProp: mesh.numProp, vertProperties: new Float32Array(mesh.vertProperties), triVerts: new Uint32Array(mesh.triVerts),
    }];
    const plain = buildHybridClicker(wasm, assets, keycap, socket, imageRegions, outline, {
      ...params, componentHeights: {},
    }, blockParams, imported);
    const raised = buildHybridClicker(wasm, assets, keycap, socket, imageRegions, outline, {
      ...params, componentHeights: { 'top-color-1-0': 1 },
    }, blockParams, imported);
    const raisedImage = raised.parts.find((part) => part.name === 'hybrid-image-1')!;
    expect(largestTopZ(raised.parts, 'hybrid-image-1') - largestTopZ(plain.parts, 'hybrid-image-1')).toBeGreaterThan(0.5);
    expectThreeMfKeepsPartHeight(raisedImage);
    expect(raised.parts.find((part) => part.name === 'imported-block')?.triVerts).toEqual(imported[0].triVerts);
    socket.delete(); source.delete();
  });
});
