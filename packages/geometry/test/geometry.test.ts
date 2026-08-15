import { describe, expect, it } from 'vitest';
import { DEFAULT_GEOMETRY_CONFIG } from '@hometown/types';
import { exportSTL, generateLampMesh, generateProfile, normalizeProfile, validateGeometry } from '../src/index';

describe('Hometown geometry engine', () => {
  it('normalizes a valid profile', () => {
    expect(normalizeProfile([{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 20, y: 40 }])[0]).toEqual({ x: 0, y: 0 });
  });
  it('rejects an empty or degenerate profile', () => {
    expect(() => normalizeProfile([])).toThrow();
    expect(() => normalizeProfile([{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }])).toThrow();
  });
  it('supports a landmark profile', () => {
    expect(generateProfile({ type: 'landmark', width: 180, height: 220 })).toHaveLength(6);
  });
  it('generates a mesh, report, and printable STL', () => {
    const mesh = generateLampMesh(DEFAULT_GEOMETRY_CONFIG); const report = validateGeometry(DEFAULT_GEOMETRY_CONFIG, mesh);
    expect(mesh.vertices.length).toBeGreaterThan(0); expect(report.overall).toBe('SAFE'); expect(exportSTL(mesh)).toContain('solid hometown-lamp');
  });
});
