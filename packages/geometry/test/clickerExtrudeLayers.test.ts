import { describe, expect, it } from 'vitest';
import Module from '../../../apps/web/node_modules/manifold-3d/manifold.js';
import { unzipSync, strFromU8 } from '../../../apps/web/node_modules/fflate/esm/browser.js';
import { buildBlocks } from '../../../apps/web/src/clicker/geometry/buildBlocks';
import { buildClicker } from '../../../apps/web/src/clicker/geometry/buildClicker';
import { buildHybridClicker } from '../../../apps/web/src/clicker/geometry/buildHybridClicker';
import { buildThreeMF } from '../../../apps/web/src/clicker/export/threemfExport';
import { applyExtrudeLayerColors, defaultExtrudeLayerColors, layerRegionKey } from '../../../apps/web/src/clicker/geometry/extrudeLayers';
import type { BuildParams, BuildRegion, ClickerPart, Ring } from '../../../apps/web/src/clicker/types';

const outline: Ring[] = [[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]];
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


function volume(wasm: any, part: ClickerPart) {
  const solid = wasm.Manifold.ofMesh(new wasm.Mesh(part));
  expect(solid.status().value).toBe(0);
  const value = solid.volume(); solid.delete(); return value;
}

function expectClosed3mf(parts: ClickerPart[]) {
  const archive = unzipSync(buildThreeMF(parts));
  const xml = strFromU8(archive['3D/3dmodel.model']);
  for (const match of xml.matchAll(/<mesh>([\s\S]*?)<\/mesh>/g)) {
    const vertices = [...match[1].matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)].map(v => v.slice(1).join(','));
    const triangles = [...match[1].matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g)].map(t => t.slice(1).map(Number));
    const edges = new Map<string, [number, number]>();
    for (const tri of triangles) for (let i = 0; i < 3; i++) {
      const a = vertices[tri[i]], b = vertices[tri[(i + 1) % 3]];
      expect(a).not.toBe(b);
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const entry = edges.get(key) ?? [0, 0]; entry[0]++; entry[1] += a < b ? 1 : -1; edges.set(key, entry);
    }
    for (const value of edges.values()) expect(value).toEqual([2, 0]);
  }
  for (const part of parts.filter(p => p.extrudeLayer)) {
    const hex = '#' + part.colorRgb.map(c => c.toString(16).padStart(2, '0').toUpperCase()).join('');
    expect(xml.toUpperCase()).toContain(hex);
  }
  return archive;
}

const config = { ...defaultExtrudeLayerColors(), enabled: true };
describe('Printable colors by Extrude level', () => {
  it.each(['image', 'svg', 'icon', 'text', 'blocks', 'hybrid', 'imported'] as const)(
    'partitions %s into closed black/white/orange/white bands without changing volume', async mode => {
    const { wasm, socket, stem, assets, keycap, blockParams, params } = await setup();
    const heightParams: BuildParams = { ...params, topThickness: 1, imageDepth: 0.8, rasterImageMode: mode === 'image', stackColorLayers: false,
      componentHeights: { 'top-color-1-0': 4, 'top-color-0-0': 4, 'hybrid-image-1': 4 } };
    const raisedBlocks = { ...blockParams, componentHeights: { 'top-color-0-0': 4 } };
    const normalize = (regions: BuildRegion[]) => regions.map(r => ({ ...r, rings: r.rings.map(ring => ring.map(([x,y]) => [x/40,y/40] as [number,number])) }));
    let original: ClickerPart[];
    if (mode === 'blocks') original = buildBlocks(wasm, assets, keycap, raisedBlocks, socket).parts;
    else if (mode === 'hybrid' || mode === 'imported') {
      const solid = wasm.Manifold.cube([20, 20, 12], true);
      const mesh = solid.getMesh();
      const imported: ClickerPart[] = [{ ...mesh, kind: 'body', group: 'base', name: 'imported-block', colorRgb: [220, 180, 90] }];
      original = buildHybridClicker(wasm, assets, keycap, socket, normalize(imageRegions), outline, heightParams, raisedBlocks,
        mode === 'imported' ? imported : undefined).parts;
      solid.delete();
    } else {
      const regions = mode === 'image' ? imageRegions : mode === 'icon' ? iconRegions : svgRegions;
      original = buildClicker(wasm, socket, stem, normalize(regions), outline, heightParams).parts;
    }
    expect(applyExtrudeLayerColors(wasm, original, { ...config, enabled: false })).toBe(original);
    const result = applyExtrudeLayerColors(wasm, original, config);
    const bands = result.filter(p => p.extrudeLayer);
    expect(new Set(bands.map(p => p.extrudeLayer!.level))).toEqual(new Set([1, 2, 3, 4]));
    for (const region of new Set(bands.map(p => p.extrudePartName).filter(name => name && heightParams.componentHeights?.[name] === 4))) {
      expect(bands.filter(p => p.extrudePartName === region).map(p => p.extrudeLayer!.level)).toEqual([1, 2, 3, 4]);
    }
    for (const band of bands) {
      const level = band.extrudeLayer!.level;
      expect(band.colorRgb).toEqual(config.colors[level]);
      const bounds = zBounds(band);
      expect(bounds.min).toBeCloseTo(band.extrudeOrigin!.bottomZ + (level - 1) * 0.6, 4);
      expect(bounds.max).toBeCloseTo(band.extrudeOrigin!.bottomZ + level * 0.6, 4);
      expect(band.extrudePartName).toBe(band.extrudeLayer!.regionName);
    }
    const before = original.reduce((n, p) => n + volume(wasm, p), 0);
    const after = result.reduce((n, p) => n + volume(wasm, p), 0);
    expect(after).toBeCloseTo(before, 2);
    expectClosed3mf(result);
    // An original imported block is never sliced or repainted by the feature.
    for (const part of original.filter(p => !p.extrudeOrigin)) expect(result).toContain(part);
  });

  it('paints one white island in one layer; uniform mode ignores but remembers overrides', async () => {
    const { wasm } = await setup();
    const section = new wasm.CrossSection([square(2, -5), square(2, 5)], 'NonZero');
    const solid = wasm.Manifold.extrude(section, 2.4);
    const mesh = solid.getMesh();
    const part: ClickerPart = { ...mesh, name: 'hybrid-image-base', kind: 'body', group: 'base', colorRgb: [255, 255, 255],
      extrudeOrigin: { bottomZ: 0, stepMm: 0.6 },
      extrudeRegions: [{ name: 'star', rings: [square(2, -5)], topZ: 2.4 }, { name: 'background', rings: [square(2, 5)], topZ: 2.4 }] };
    const mixed = { ...config, mixed: true, overrides: { [layerRegionKey(2, 'star')]: [0, 200, 80] as [number, number, number] } };
    const result = applyExtrudeLayerColors(wasm, [part], mixed);
    expect(result.find(p => p.extrudeLayer?.level === 2 && p.extrudePartName === 'star')!.colorRgb).toEqual([0, 200, 80]);
    expect(result.find(p => p.extrudeLayer?.level === 2 && p.extrudePartName === 'background')!.colorRgb).toEqual([255, 255, 255]);
    for (const p of result.filter(p => p.extrudeLayer?.level !== 2)) expect(p.colorRgb).toEqual(config.colors[p.extrudeLayer!.level]);
    expectClosed3mf(result);
    const uniform = applyExtrudeLayerColors(wasm, [part], { ...mixed, mixed: false });
    expect(uniform.filter(p => p.extrudeLayer?.level === 2).every(p => p.colorRgb.join() === '255,255,255')).toBe(true);
    expect(applyExtrudeLayerColors(wasm, result, mixed)).toEqual(result);
    solid.delete(); section.delete();
  });
  it('keeps the carrier closed when traced color contours touch at one pixel corner', async () => {
    const { wasm, socket, stem, params } = await setup();
    const a = square(0.1, -0.1, -0.1), b = square(0.1, 0.1, 0.1);
    const regions: BuildRegion[] = [
      { partName: 'background', filamentRgb: params.baseFilamentRgb, coverage: 0.9,
        rings: [square(0.45), [...a].reverse(), [...b].reverse()] },
      { partName: 'accent', filamentRgb: [0, 0, 0], coverage: 0.1, rings: [a, b] },
    ];
    const source = buildClicker(wasm, socket, stem, regions, outline, { ...params,
      rasterImageMode: true, stackColorLayers: false, topThickness: 1, imageDepth: 0.8,
      componentHeights: { accent: 4 } }).parts;
    expectClosed3mf(applyExtrudeLayerColors(wasm, source, config));
  });

  it('rebuilds dense mixed-color layer stacks repeatedly without exhausting the WASM geometry table', async () => {
    const { wasm } = await setup();
    const rings = Array.from({ length: 6 }, (_, index) => square(
      0.45,
      (index % 3) * 2.2 - 2.2,
      Math.floor(index / 3) * 2.2 - 1.1,
    ));
    const section = new wasm.CrossSection(rings, 'NonZero');
    const solid = wasm.Manifold.extrude(section, 6);
    const mesh = solid.getMesh();
    const part: ClickerPart = {
      ...mesh,
      name: 'dense-layer-stack', kind: 'body', group: 'base', colorRgb: [240, 240, 240],
      extrudeOrigin: { bottomZ: 0, stepMm: 0.2 },
      extrudeRegions: rings.map((ring, index) => ({ name: `region-${index}`, rings: [ring], topZ: 6 })),
    };
    const mixed = {
      ...config,
      mixed: true,
      overrides: Object.fromEntries(rings.map((_, index) => [
        layerRegionKey(1, `region-${index}`), [0, 0, 0] as [number, number, number],
      ])),
    };

    for (let rebuild = 0; rebuild < 3; rebuild++) {
      const result = applyExtrudeLayerColors(wasm, [part], mixed);
      expect(result.filter(item => item.extrudeLayer)).toHaveLength(6 * 30);
      expect(result.every(item => item.vertProperties.length > 0 && item.triVerts.length > 0)).toBe(true);
    }

    solid.delete(); section.delete();
  });

});
