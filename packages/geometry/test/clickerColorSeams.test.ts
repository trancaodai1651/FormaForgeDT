import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import Module from '../../../apps/web/node_modules/manifold-3d/manifold.js';
import { unzipSync, strFromU8 } from 'fflate';
import { traceRegions } from '../../../apps/web/src/clicker/image/trace';
import { BuildContext } from '../../../apps/web/src/clicker/geometry/buildContext';
import { buildImageMaskPipeline } from '../../../apps/web/src/clicker/geometry/imageMaskPipeline';
import { buildThreeMF } from '../../../apps/web/src/clicker/export/threemfExport';
import { defaultSlicerExport, slicerProfiles } from '../../../apps/web/src/clicker/export/slicerLayout';
import { buildThreeMFObjects } from '../../../apps/web/src/clicker/features/multiColor/export/threemfExport';
import { buildHybridClicker } from '../../../apps/web/src/clicker/geometry/buildHybridClicker';
import { partMatchesPalette, rememberPartColor } from '../../../apps/web/src/clicker/core/partColors';
import type { BuildParams, BuildRegion, ClickerPart, RGB } from '../../../apps/web/src/clicker/types';

function artwork() {
  const width = 160, height = 120;
  const indices = new Int16Array(width * height).fill(0);
  for (let y = 10; y < 110; y++) for (let x = 10; x < 150; x++) {
    indices[y * width + x] = 1;
    const center = 57 + 9 * Math.sin(x / 13);
    if (x > 30 && x < 130 && Math.abs(y - center) < 7) indices[y * width + x] = 2;
  }
  const colors: RGB[] = [[255, 135, 0], [255, 255, 255], [0, 0, 0]];
  return traceRegions({ width, height, indices, palette: colors.map(rgb => ({ rgb, coverage: 1 / 3 })) }, 0.25);
}

describe('Clicker image color boundaries', () => {
  it('uses exactly the same smoothed black island and surrounding white hole', async () => {
    const wasm = await Module(); wasm.setup();
    const traced = artwork();
    const blackRing = traced.regions.find(r => r.quantRgb[0] === 0)!.components[0].rings[0];
    const whiteHole = traced.regions.find(r => r.quantRgb[0] === 255 && r.quantRgb[1] === 255)!.components[0].rings[1];
    const black = new wasm.CrossSection([blackRing], 'EvenOdd');
    const hole = new wasm.CrossSection([whiteHole], 'EvenOdd');
    const difference = black.subtract(hole).add(hole.subtract(black));
    expect(difference.area()).toBeLessThan(1e-9);
    difference.delete(); black.delete(); hole.delete();
  });

  it('keeps resolved mask partitions gap-free without changing their shared edges', async () => {
    const wasm = await Module(); wasm.setup();
    const ctx = new BuildContext(wasm);
    const traced = artwork();
    const imageArea = ctx.track(new wasm.CrossSection(traced.outline, 'NonZero'));
    const inputs = traced.regions.flatMap((r, index) => r.components.map((c, ci) => ({
      layerIndex: index,
      region: { rings: c.rings, coverage: r.coverage, filamentRgb: r.quantRgb, partName: `color-${index}-${ci}` } as BuildRegion,
    })));
    const masks = buildImageMaskPipeline(ctx, { inputs, imageScale: 40, minimumArea: 0.001,
      colorBleed: 0, imageArea: ctx.track(imageArea.scale([40, 40])),
      plate: ctx.track(imageArea.scale([40, 40])), stack: false, solidSilhouette: false, componentLevel: () => 0 });
    let union = masks[0].footprint;
    for (const mask of masks.slice(1)) {
      const overlap = ctx.track(union.intersect(mask.footprint));
      expect(overlap.area()).toBeLessThan(1e-5);
      union = ctx.track(union.add(mask.footprint));
    }
    const missing = ctx.track(ctx.track(imageArea.scale([40, 40])).subtract(union));
    expect(missing.area()).toBeLessThan(1e-4);
    ctx.cleanup();
  });

  it('keeps black/white/orange imported-block artwork flat with no leaked carrier at color seams', async () => {
    const wasm = await Module(); wasm.setup();
    const cube = wasm.Manifold.cube([20, 20, 12], true).translate([0, 0, 6]);
    const mesh = cube.getMesh();
    const imported: ClickerPart = { kind: 'body', group: 'base', name: 'imported-block', colorRgb: [255, 135, 0],
      numProp: mesh.numProp, vertProperties: mesh.vertProperties, triVerts: mesh.triVerts };
    const traced = artwork();
    const regions = traced.regions.flatMap((r, index) => r.components.map((c, ci): BuildRegion => ({
      filamentRgb: r.quantRgb, coverage: index === 0 ? 0.6 : index === 1 ? 0.3 : 0.1,
      rings: c.rings, partName: `top-color-${index}-${ci}`,
    })));
    const result = buildHybridClicker(wasm, {} as never,
      { meta: { topExtent: [18] }, shell: { positions: new Float32Array([-9, -9, 0, 9, -9, 0, 9, 9, 0, -9, 9, 0]) } } as never,
      null, regions, traced.outline,
      { hybridImageSizeMm: 40, hybridImageThicknessMm: 17, hybridBaseThicknessMm: 9,
        hybridImagePaddingMm: 0, hybridNeckLengthMm: 0, hybridBaseImageOverlapMm: 7,
        colorBleed: 0.12, componentHeights: {}, keychain: { enabled: false }, bodyColorRgb: [255, 255, 255] } as BuildParams,
      { vertical: true, bodyColorRgb: [255, 255, 255] } as never, [imported]);
    const inkParts = result.parts.filter(p => /^hybrid-image-(base|\d+)$/.test(p.name));
    const blackPart = inkParts.find(p => p.colorRgb[0] === 0)!;
    expect(blackPart.sourcePartName).toBe(regions.find(r => r.filamentRgb[0] === 0)!.partName);
    const overrides: Record<string, RGB> = {};
    rememberPartColor(overrides, blackPart, [16, 32, 48]);
    expect(overrides[blackPart.sourcePartName!]).toEqual([16, 32, 48]);
    const rebuilt = buildHybridClicker(wasm, {} as never,
      { meta: { topExtent: [18] }, shell: { positions: new Float32Array([-9, -9, 0, 9, -9, 0, 9, 9, 0, -9, 9, 0]) } } as never,
      null, regions.map(r => ({ ...r, filamentRgb: overrides[r.partName] ?? r.filamentRgb })), traced.outline,
      { hybridImageSizeMm: 45, hybridImageThicknessMm: 17, hybridBaseThicknessMm: 9,
        hybridImagePaddingMm: 0, hybridNeckLengthMm: 0, hybridBaseImageOverlapMm: 7,
        colorBleed: 0.12, componentHeights: {}, keychain: { enabled: false }, bodyColorRgb: [255, 255, 255] } as BuildParams,
      { vertical: true, bodyColorRgb: [255, 255, 255] } as never, [imported]);
    expect(rebuilt.parts.find(p => p.sourcePartName === blackPart.sourcePartName)?.colorRgb).toEqual([16, 32, 48]);
    const recoloredArchive = unzipSync(buildThreeMFObjects(rebuilt.parts));
    expect(JSON.parse(strFromU8(recoloredArchive['Metadata/project_settings.config'])).filament_colour).toContain('#102030');
    const solids = inkParts.map(p => wasm.Manifold.ofMesh(new wasm.Mesh(p)));
    const slices = solids.map(s => s.slice(8.03));
    const black = slices[inkParts.findIndex(p => p.colorRgb[0] === 0)];
    const points = traced.outline.flat();
    const scale = 40 / Math.max(Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0])),
      Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1])));
    const expectedBlack = new wasm.CrossSection(regions.find(r => r.filamentRgb[0] === 0)!.rings, 'NonZero').scale([scale, scale]);
    expect(black.area()).toBeCloseTo(expectedBlack.area(), 3);
    let union = slices[0];
    const owned: any[] = [];
    for (const slice of slices.slice(1)) {
      const overlap = union.intersect(slice); owned.push(overlap);
      expect(overlap.area()).toBeLessThan(1e-4);
      union = union.add(slice); owned.push(union);
    }
    // The outer head has its own outline simplification before partitioning;
    // compare coverage to that same plate, not to the pre-build silhouette.
    const expectedSurface = new wasm.CrossSection(traced.outline, 'NonZero').scale([scale, scale]).simplify(0.04);
    expect(union.area()).toBeCloseTo(expectedSurface.area(), 3);
    if (process.env.CLICKER_COLOR_QA_FILE) {
      // Optional artifact for an actual slicer round-trip outside the repo.
      writeFileSync(process.env.CLICKER_COLOR_QA_FILE, buildThreeMFObjects(result.parts));
    }
    expectedBlack.delete(); expectedSurface.delete();
    for (const item of [...owned, ...slices, ...solids]) item.delete();
    cube.delete();
  });
});

describe('Clicker 3MF selected filament colors', () => {
  it('matches hybrid components to their source palette instead of their flattened component index', () => {
    const component = { name: 'hybrid-image-10', sourcePartName: 'top-color-1-7' } as ClickerPart;
    expect(partMatchesPalette(component, 1)).toBe(true);
    expect(partMatchesPalette(component, 10)).toBe(false);
    expect(partMatchesPalette({ name: 'hybrid-image-10' } as ClickerPart, 1)).toBe(false);
    expect(partMatchesPalette({ name: 'hybrid-image-1-bottom' } as ClickerPart, 1)).toBe(true);
  });
  it.each([buildThreeMF, buildThreeMFObjects])('keeps current RGB, multipart placement and slicer slots through both export paths', async exportFile => {
    const wasm = await Module(); wasm.setup();
    const cube = wasm.Manifold.cube([10, 10, 2]);
    const mesh = cube.getMesh();
    const colors: RGB[] = [[0, 0, 0], [255, 135, 0], [255, 255, 255], [0, 0, 0]];
    const parts = colors.map((colorRgb, index): ClickerPart => ({
      kind: 'body', group: 'base', name: `selected-${index}&ink`, colorRgb,
      extruder: 1, // Stale slots from an imported file must not override recolored RGB.
      numProp: mesh.numProp, vertProperties: mesh.vertProperties, triVerts: mesh.triVerts,
    }));
    const archive = unzipSync(exportFile(parts));
    expect(archive['Metadata/project_settings.config']).toBeDefined();
    const project = JSON.parse(strFromU8(archive['Metadata/project_settings.config']));
    expect(project.filament_colour).toEqual(['#000000', '#ff8700', '#ffffff']);
    expect(project.name).toBe('project_settings');
    expect(project.nozzle_diameter).toEqual(['0.4']);
    expect(project.printer_technology).toBe('FFF');
    expect(project.filament_settings_id).toHaveLength(3);
    const settings = strFromU8(archive['Metadata/model_settings.config']);
    const slots = [...settings.matchAll(/<part\b[^>]*>([\s\S]*?)<\/part>/g)].map(m => Number(m[1].match(/key="extruder" value="(\d+)"/)![1]));
    expect(slots).toEqual([1, 2, 3, 1]);
    const xml = strFromU8(archive['3D/3dmodel.model']);
    const profile = slicerProfiles[defaultSlicerExport().target];
    expect(xml).toContain(`<metadata name="Application">${profile.application}</metadata>`);
    expect(xml).toContain('<metadata name="Generator">FormaForgeDT Clicker Generator</metadata>');
    expect([...xml.matchAll(/<item\b/g)]).toHaveLength(1);
    expect([...xml.matchAll(/<component\b/g)]).toHaveLength(4);
    expect(settings).toContain('selected-0&amp;ink');
    cube.delete();
  });
});
