import { describe, expect, it } from 'vitest';
import Module from '../../../apps/web/node_modules/manifold-3d/manifold.js';
import { unzipSync, strFromU8 } from '../../../apps/web/node_modules/fflate/esm/browser.js';
import { buildBlocks } from '../../../apps/web/src/clicker/geometry/buildBlocks';
import { buildClicker } from '../../../apps/web/src/clicker/geometry/buildClicker';
import { buildHybridClicker } from '../../../apps/web/src/clicker/geometry/buildHybridClicker';
import { buildThreeMF } from '../../../apps/web/src/clicker/export/threemfExport';
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
  it.each([
    { mode: 'Image', regions: imageRegions, rasterImageMode: true, selectedRegion: 1, outputName: 'top-color-1-0' },
    { mode: 'SVG', regions: svgRegions, rasterImageMode: false, selectedRegion: 0, outputName: 'top-color-mono' },
    { mode: 'Icon', regions: iconRegions, rasterImageMode: false, selectedRegion: 0, outputName: 'top-color-mono' },
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
