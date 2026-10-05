import type { ClickerPart, ExtrudeLayerColors, RGB } from '../types';

export const defaultExtrudeLayerColors = (): ExtrudeLayerColors => ({
  enabled: false, mixed: false,
  colors: { 1: [0, 0, 0], 2: [255, 255, 255], 3: [255, 135, 0], 4: [255, 255, 255] },
  overrides: {},
});

export const layerRegionKey = (level: number, region: string) => `${level}:${region}`;
const fallbackLayerColor = (level: number): RGB => level % 2 === 0 ? [255, 255, 255] : [0, 0, 0];
const colorKey = (rgb: RGB) => `#${rgb.map(channel => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0')).join('')}`;

/** Colors that can be selected for raised layers, in stable palette order. */
export function uniqueExtrudePalette(colors: readonly RGB[]): RGB[] {
  const byHex = new Map<string, RGB>();
  for (const rgb of colors) if (rgb?.length >= 3) byHex.set(colorKey(rgb), [...rgb] as RGB);
  return [...byHex.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, rgb]) => rgb);
}

function nearestPaletteColor(rgb: RGB, palette: readonly RGB[]): RGB {
  let best = palette[0];
  let bestDistance = Infinity;
  for (const candidate of palette) {
    const distance = (rgb[0] - candidate[0]) ** 2 + (rgb[1] - candidate[1]) ** 2 + (rgb[2] - candidate[2]) ** 2;
    if (distance < bestDistance) { best = candidate; bestDistance = distance; }
  }
  return [...best] as RGB;
}

/** Keep a saved/default layer color inside the colors actually used by this model. */
export function extrudeLayerColor(config: ExtrudeLayerColors, level: number, region: string, availableColors: readonly RGB[] = []): RGB {
  const requested = (config.mixed ? config.overrides[layerRegionKey(level, region)] : undefined)
    ?? config.colors[level] ?? fallbackLayerColor(level);
  if (!availableColors.length || availableColors.some(color => colorKey(color) === colorKey(requested))) return requested;
  return nearestPaletteColor(requested, availableColors);
}

/** Remap stale saved defaults/overrides to an existing model color before building. */
export function reconcileExtrudeLayerColors(
  config: ExtrudeLayerColors,
  availableColors: readonly RGB[],
  minimumLevels = 6,
): ExtrudeLayerColors {
  const palette = uniqueExtrudePalette(availableColors);
  if (!palette.length) return config;

  const levelCount = Math.max(minimumLevels, ...Object.keys(config.colors).map(Number));
  const colors: Record<number, RGB> = { ...config.colors };
  for (let level = 1; level <= levelCount; level++) {
    colors[level] = extrudeLayerColor({ ...config, mixed: false }, level, '', palette);
  }
  const overrides = Object.fromEntries(Object.entries(config.overrides).map(([key, rgb]) => {
    const [, levelText] = key.match(/^(\d+):/) ?? [];
    const level = Number(levelText) || 1;
    const requested = palette.some(color => colorKey(color) === colorKey(rgb)) ? rgb : nearestPaletteColor(rgb, palette);
    return [key, requested ?? colors[level] ?? palette[0]];
  })) as Record<string, RGB>;

  const sameColors = Object.keys(colors).length === Object.keys(config.colors).length
    && Object.entries(colors).every(([level, rgb]) => colorKey(rgb) === colorKey(config.colors[Number(level)]));
  const sameOverrides = Object.keys(overrides).length === Object.keys(config.overrides).length
    && Object.entries(overrides).every(([key, rgb]) => colorKey(rgb) === colorKey(config.overrides[key]));
  return sameColors && sameOverrides ? config : { ...config, colors, overrides };
}

/** Partition raised material into closed horizontal solids, never overlapping skins.
 * The builder supplies the original face plane: imported blocks and backing are
 * intentionally excluded. All cuts use the same Float32 plane in preview/export.
 */
export function applyExtrudeLayerColors(wasm: any, parts: ClickerPart[], config?: ExtrudeLayerColors, availableColors: readonly RGB[] = []): ClickerPart[] {
  if (!config?.enabled) return parts;
  const palette = uniqueExtrudePalette(availableColors);
  return parts.flatMap(part => {
    const origin = part.extrudeOrigin;
    if (!origin || part.extrudeLayer) return [part];
    const owned: any[] = [];
    const track = (value: any) => { owned.push(value); return value; };
    const release = (value: any) => {
      const index = owned.lastIndexOf(value);
      if (index < 0) return;
      owned.splice(index, 1);
      try { value.delete(); } catch { /* already released by the WASM binding */ }
    };
    try {
      const solid = track(wasm.Manifold.ofMesh(new wasm.Mesh(part)));
      const z0 = Math.fround(origin.bottomZ);
      const step = Math.max(0.1, origin.stepMm);
      const maxZ = solid.boundingBox().max[2];
      if (maxZ <= z0 + 0.00001) return [part];
      const output: ClickerPart[] = [];
      const emit = (volume: any, regionName: string, level: number) => {
        if (volume.isEmpty() || volume.volume() <= 1e-9) return;
        let original: any;
        let printable: any;
        try {
          original = track(volume.asOriginal());
          const sourceMesh = original.getMesh();
          printable = track(wasm.Manifold.ofMesh(new wasm.Mesh(sourceMesh)));
          if (printable.status().value !== 0) throw new Error(`Invalid Extrude layer: ${part.name} (status ${printable.status().value})`);
          if (printable.isEmpty()) return;
          const mesh = printable.getMesh();
          output.push({ ...part, numProp: mesh.numProp,
            vertProperties: new Float32Array(mesh.vertProperties), triVerts: new Uint32Array(mesh.triVerts),
            name: level ? `${part.name}::layer-${level}::${regionName}` : part.name,
            colorRgb: level ? extrudeLayerColor(config, level, regionName, palette) : part.colorRgb,
            extrudePartName: level ? regionName : part.extrudePartName,
            extrudeLayer: level ? { level, regionName } : undefined,
            extrudeRegions: level ? undefined : part.extrudeRegions,
          });
        } finally {
          // Release each temporary solid as soon as its mesh data is copied;
          // otherwise every extruded band stays in WASM memory until the full
          // model finishes partitioning.
          release(printable);
          release(original);
        }
      };
      const [raised, lower] = solid.splitByPlane([0, 0, 1], z0).map(track);
      try { emit(lower, part.name, 0); } finally { release(lower); }
      let remainder = raised;
      // Keep same-color regions merged unless a regional override actually needs
      // separate geometry. Repeatedly cutting every traced image region is both
      // expensive and a source of tiny sliver faces in the exported bands.
      const pieces: { solid: any; name: string }[] = [];
      const activeRegions = config.mixed ? (part.extrudeRegions ?? []).filter(region => {
        const regionMaxLevel = Math.ceil((region.topZ - z0) / step - 1e-5);
        for (let level = 1; level <= regionMaxLevel; level++) {
          if (config.overrides[`${level}:${region.name}`] !== undefined) return true;
        }
        return false;
      }) : [];
      for (const region of activeRegions) {
        const section = track(new wasm.CrossSection(region.rings.map(ring => ring.map(([x, y]) => [Math.fround(x), Math.fround(y)])), 'NonZero'));
        const extrusion = track(wasm.Manifold.extrude(section, maxZ - z0 + 1));
        const column = track(extrusion.translate([0, 0, z0]));
        const previousRemainder = remainder;
        pieces.push({ solid: track(previousRemainder.intersect(column)), name: region.name });
        remainder = track(previousRemainder.subtract(column));
        release(column);
        release(extrusion);
        release(section);
        release(previousRemainder);
      }
      const unassignedRegions = (part.extrudeRegions ?? []).filter(region => !activeRegions.some(active => active.name === region.name));
      const remainderName = unassignedRegions.length === 1
        ? unassignedRegions[0].name
        : part.extrudePartName ?? part.name;
      pieces.push({ solid: remainder, name: remainderName });
      for (const piece of pieces) {
        let remaining = piece.solid;
        const pieceMaxZ = piece.solid.boundingBox().max[2];
        for (let level = 1; level <= Math.ceil((pieceMaxZ - z0) / step - 1e-5); level++) {
          const plane = Math.fround(z0 + level * step);
          const [above, band] = remaining.splitByPlane([0, 0, 1], plane).map(track);
          try { emit(band, piece.name, level); } finally { release(band); release(remaining); }
          remaining = above;
        }
        release(remaining);
        release(piece.solid);
      }
      return output;
    } finally { for (let i = owned.length - 1; i >= 0; i--) owned[i].delete(); }
  });
}
