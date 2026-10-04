import type { ClickerPart, ExtrudeLayerColors, RGB } from '../types';

export const defaultExtrudeLayerColors = (): ExtrudeLayerColors => ({
  enabled: false, mixed: false,
  colors: { 1: [0, 0, 0], 2: [255, 255, 255], 3: [255, 135, 0], 4: [255, 255, 255] },
  overrides: {},
});

export const layerRegionKey = (level: number, region: string) => `${level}:${region}`;
export function extrudeLayerColor(config: ExtrudeLayerColors, level: number, region: string): RGB {
  return (config.mixed ? config.overrides[layerRegionKey(level, region)] : undefined)
    ?? config.colors[level] ?? (level % 2 === 0 ? [255, 255, 255] : [0, 0, 0]);
}

/** Partition raised material into closed horizontal solids, never overlapping skins.
 * The builder supplies the original face plane: imported blocks and backing are
 * intentionally excluded. All cuts use the same Float32 plane in preview/export.
 */
export function applyExtrudeLayerColors(wasm: any, parts: ClickerPart[], config?: ExtrudeLayerColors): ClickerPart[] {
  if (!config?.enabled) return parts;
  return parts.flatMap(part => {
    const origin = part.extrudeOrigin;
    if (!origin || part.extrudeLayer) return [part];
    const owned: any[] = [];
    const track = (value: any) => { owned.push(value); return value; };
    try {
      const solid = track(wasm.Manifold.ofMesh(new wasm.Mesh(part)));
      const z0 = Math.fround(origin.bottomZ);
      const step = Math.max(0.1, origin.stepMm);
      const maxZ = solid.boundingBox().max[2];
      if (maxZ <= z0 + 0.00001) return [part];
      const output: ClickerPart[] = [];
      const emit = (volume: any, regionName: string, level: number) => {
        if (volume.isEmpty() || volume.volume() <= 1e-9) return;
        const original = track(volume.asOriginal());
        const printable = track(wasm.Manifold.ofMesh(new wasm.Mesh(original.getMesh())));
        if (printable.status().value !== 0) throw new Error(`Invalid Extrude layer: ${part.name} (status ${printable.status().value})`);
        if (printable.isEmpty()) return;
        const mesh = printable.getMesh();
        output.push({ ...part, numProp: mesh.numProp,
          vertProperties: new Float32Array(mesh.vertProperties), triVerts: new Uint32Array(mesh.triVerts),
          name: level ? `${part.name}::layer-${level}::${regionName}` : part.name,
          colorRgb: level ? extrudeLayerColor(config, level, regionName) : part.colorRgb,
          extrudePartName: level ? regionName : part.extrudePartName,
          extrudeLayer: level ? { level, regionName } : undefined,
          extrudeRegions: level ? undefined : part.extrudeRegions,
        });
      };
      const [raised, lower] = solid.splitByPlane([0, 0, 1], z0).map(track);
      emit(lower, part.name, 0);
      let remainder = raised;
      // A continuous white carrier can contain independent islands (e.g. a star).
      // Retain those original region identities in every band for local painting.
      const pieces: { solid: any; name: string }[] = [];
      for (const region of part.extrudeRegions ?? []) {
        const section = track(new wasm.CrossSection(region.rings.map(ring => ring.map(([x, y]) => [Math.fround(x), Math.fround(y)])), 'NonZero'));
        const column = track(track(wasm.Manifold.extrude(section, maxZ - z0 + 1)).translate([0, 0, z0]));
        pieces.push({ solid: track(remainder.intersect(column)), name: region.name });
        remainder = track(remainder.subtract(column));
      }
      pieces.push({ solid: remainder, name: part.extrudePartName ?? part.name });
      for (const piece of pieces) {
        let remaining = piece.solid;
        for (let level = 1; level <= Math.ceil((maxZ - z0) / step - 1e-5); level++) {
          const plane = Math.fround(z0 + level * step);
          const [above, band] = remaining.splitByPlane([0, 0, 1], plane).map(track);
          emit(band, piece.name, level);
          remaining = above;
        }
      }
      return output;
    } finally { for (let i = owned.length - 1; i >= 0; i--) owned[i].delete(); }
  });
}
