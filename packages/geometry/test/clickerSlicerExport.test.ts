import { describe, expect, it } from 'vitest';
import Module from '../../../apps/web/node_modules/manifold-3d/manifold.js';
import { unzipSync, strFromU8 } from 'fflate';
import { buildThreeMF } from '../../../apps/web/src/clicker/export/threemfExport';
import { defaultSlicerExport, prepareSlicerLayout, type SlicerTarget } from '../../../apps/web/src/clicker/export/slicerLayout';
import type { ClickerPart, RGB } from '../../../apps/web/src/clicker/types';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

async function fixture(relief = true) {
  const wasm = await Module(); wasm.setup();
  const part = (name: string, size: [number, number, number], at: [number, number, number], group: 'top' | 'base', colorRgb: RGB): ClickerPart => {
    const cube = wasm.Manifold.cube(size).translate(at);
    const mesh = cube.getMesh(); cube.delete();
    return { name, kind: group === 'top' ? 'cap' : 'body', group, colorRgb,
      numProp: mesh.numProp, vertProperties: mesh.vertProperties, triVerts: mesh.triVerts };
  };
  const parts = [
    part('base', [30, 30, 10], [-15, -15, -10], 'base', [240, 240, 240]),
    part('top-carrier', [20, 20, 2], [-10, -10, 12], 'top', [255, 255, 255]),
    part('top-stem', [4, 4, 5], [-2, -2, 7], 'top', [255, 255, 255]),
  ];
  if (relief) {
    const lower = part('black::layer-1', [5, 5, 0.6], [0, 0, 14], 'top', [0, 0, 0]);
    lower.extrudeOrigin = { bottomZ: 14, stepMm: 0.6 };
    lower.extrudeLayer = { level: 1, regionName: 'relief' };
    const upper = part('orange::layer-2', [5, 5, 0.6], [0, 0, 14.6], 'top', [255, 135, 0]);
    upper.extrudeLayer = { level: 2, regionName: 'relief' };
    parts.push(lower, upper);
  }
  return parts;
}

const vertices = (xml: string, objectId: number) => {
  const object = xml.match(new RegExp(`<object id="${objectId}"[^>]*>([\\s\\S]*?)</object>`))![1];
  return [...object.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)].map(m => m.slice(1).map(Number));
};

describe('Slicer-specific 3MF print placement', () => {
  for (const target of ['bambu', 'flashforge'] as SlicerTarget[]) {
    for (const colorCount of [1, 2, 3, 4, 5, 6, 8]) {
      it(`${target}: exports a complete flush matrix for ${colorCount} final RGB slots`, async () => {
        const seed = (await fixture(false))[1];
        const shifted = (i: number) => {
          const vertices = seed.vertProperties.slice();
          for (let vertex = 0; vertex < vertices.length; vertex += seed.numProp) vertices[vertex] += i * 20;
          return vertices;
        };
        const parts = Array.from({ length: colorCount }, (_, i) => ({ ...seed,
          name: `region-${i}`, vertProperties: shifted(i), colorRgb: [i * 30, 255 - i * 20, i * 10] as RGB }));
        // Repeat an RGB with an unrelated imported slot: only final colors count.
        parts.push({ ...parts[0], name: 'same-color', vertProperties: shifted(colorCount), extruder: 99 });
        const bytes = buildThreeMF(parts, { ...defaultSlicerExport(), target });
        const archive = unzipSync(bytes);
        const config = JSON.parse(strFromU8(archive['Metadata/project_settings.config']));
        const nozzleCount = target === 'flashforge' ? 4 : 1;
        expect(config.filament_colour).toHaveLength(colorCount);
        expect(config.nozzle_diameter).toHaveLength(nozzleCount);
        expect(config.printer_extruder_id).toEqual(Array.from({ length: nozzleCount }, (_, i) => String(i + 1)));
        expect(config.flush_multiplier).toEqual(Array(nozzleCount).fill('1'));
        expect(config.flush_volumes_vector).toEqual(Array(colorCount * 2).fill('140'));
        // This is the exact invariant checked by GCode::append_full_config.
        expect(config.flush_volumes_matrix).toHaveLength(colorCount ** 2 * config.flush_multiplier.length);
        for (let nozzle = 0; nozzle < nozzleCount; nozzle++) {
          for (let from = 0; from < colorCount; from++) {
            for (let to = 0; to < colorCount; to++) {
              expect(config.flush_volumes_matrix[nozzle * colorCount ** 2 + from * colorCount + to])
                .toBe(from === to ? '0' : '280');
            }
          }
        }
        expect(config.filament_settings_id).toEqual(Array(colorCount).fill(
          target === 'flashforge' ? 'Flashforge PLA Basic @FF C5P' : 'Bambu PLA Basic @BBL A1'));
        if (process.env.CLICKER_SLICER_FIXTURE_DIR && colorCount === 3) {
          mkdirSync(process.env.CLICKER_SLICER_FIXTURE_DIR, { recursive: true });
          writeFileSync(join(process.env.CLICKER_SLICER_FIXTURE_DIR, `${target}-flush.3mf`), bytes);
        }
      });
    }
  }

  for (const target of ['bambu', 'flashforge'] as SlicerTarget[]) {
    it(`${target}: grounds each assembly and preserves supported face-up band order and exact RGB slots`, async () => {
      const parts = await fixture();
      const options = { ...defaultSlicerExport(), target };
      const layout = prepareSlicerLayout(parts, options);
      expect(layout.flipTop).toBe(false);
      expect(layout.supportEnabled).toBe(true);
      const archive = unzipSync(buildThreeMF(parts, options));
      const xml = strFromU8(archive['3D/3dmodel.model']);
      const config = JSON.parse(strFromU8(archive['Metadata/project_settings.config']));
      expect(config.printer_model).toBe(target === 'bambu' ? 'Bambu Lab A1' : 'Flashforge Creator 5 Pro');
      expect(xml).toContain(target === 'bambu' ? 'BambuStudio-02.00.00.00' : 'OrcaSlicer-02.01.01.00');
      expect(config.filament_colour).toEqual(['#f0f0f0', '#ffffff', '#000000', '#ff8700']);
      expect(config.single_extruder_multi_material).toBe(target === 'bambu' ? '1' : '0');
      expect(config.enable_support).toBe('1');
      expect(config.support_on_build_plate_only).toBe('0');
      expect(Math.min(...vertices(xml, 2).map(v => v[2]))).toBe(0);
      expect(Math.min(...vertices(xml, 4).map(v => v[2]))).toBe(0);
      const lowerTop = Math.max(...vertices(xml, 5).map(v => v[2]));
      const upperBottom = Math.min(...vertices(xml, 6).map(v => v[2]));
      expect(lowerTop).toBeCloseTo(upperBottom, 5);
      expect(lowerTop).toBeGreaterThan(Math.max(...vertices(xml, 3).map(v => v[2])));
      const modelSettings = strFromU8(archive['Metadata/model_settings.config']);
      expect([...xml.matchAll(/<item\b/g)]).toHaveLength(2);
      expect([...modelSettings.matchAll(/<part\b/g)]).toHaveLength(5);
      expect(modelSettings).toContain('key="enable_support" value="1"');
      // Every color belongs to its parent assembly, never a standalone build item.
      expect(xml).not.toMatch(/<item objectid="[2-6]"/);
      for (const item of xml.matchAll(/<item[^>]*transform="([^"]+)"/g)) {
        const m = item[1].split(' ').map(Number);
        expect(m.slice(0, 9)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
        expect(m[11]).toBe(0);
        expect(m[9]).toBeGreaterThan(0); expect(m[10]).toBeGreaterThan(0);
      }
      // Export never modifies the preview's assembled coordinates.
      expect(parts[2].vertProperties[2]).toBe(7);
    });
  }

  it('retains face-down printing for flat artwork and honors explicit orientation/support choices', async () => {
    const flat = await fixture(false);
    const auto = prepareSlicerLayout(flat, defaultSlicerExport());
    expect(auto.flipTop).toBe(true); expect(auto.supportEnabled).toBe(false);
    const relief = await fixture();
    const forcedDown = prepareSlicerLayout(relief, { ...defaultSlicerExport(), topOrientation: 'face-down' });
    expect(forcedDown.flipTop).toBe(true); expect(forcedDown.supportEnabled).toBe(true);
    expect(prepareSlicerLayout(flat, { ...defaultSlicerExport(), topOrientation: 'face-up' }).supportEnabled).toBe(true);
    expect(prepareSlicerLayout(relief, { ...defaultSlicerExport(), supports: 'off' }).supportEnabled).toBe(false);
  });
});
