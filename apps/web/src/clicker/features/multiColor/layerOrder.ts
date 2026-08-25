import type { RGB, RegionSet } from '../../types';

type MultiColorRegion = RegionSet['regions'][number];

function colorRole(rgb: RGB): number {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const saturation = max > 0 ? chroma / max : 0;
  const hue = chroma === 0
    ? 0
    : max === r
      ? (60 * ((g - b) / chroma) + 360) % 360
      : max === g
        ? 60 * ((b - r) / chroma) + 120
        : 60 * ((r - g) / chroma) + 240;

  // This is the physical order used by the supplied Phu Yen artwork. Use hue
  // instead of raw channel thresholds so anti-aliased/quantized colours still
  // resolve to the same layer role.
  if (
    (saturation > 0.2 && hue >= 28 && hue <= 82 && max > 120)
    || (r > 145 && g > 105 && g > b * 1.12 && r > b * 1.35)
  ) return 0; // yellow
  if (
    (saturation > 0.18 && (hue < 25 || hue >= 335) && max > 85)
    || (r > 120 && r > g * 1.35 && r > b * 1.25)
  ) return 1; // red
  if (min > 150 && chroma < 75) return 2; // white
  if (saturation > 0.18 && hue >= 185 && hue <= 275 && max > 80) return 3; // blue
  return 4;
}

/**
 * Return the default physical order for the MultiColor page.
 *
 * The array is always bottom -> top. Known artwork roles use the stable
 * yellow/red/white/blue order. Unknown colours are deliberately kept above
 * known underlays and sorted by coverage so a tiny accent cannot become the
 * full-silhouette backing layer.
 */
export function orderMultiColorRegions(regions: MultiColorRegion[]): MultiColorRegion[] {
  return regions
    .map((region, sourceIndex) => ({ region, sourceIndex, role: colorRole(region.quantRgb) }))
    .sort((a, b) => a.role - b.role || a.region.coverage - b.region.coverage || a.sourceIndex - b.sourceIndex)
    .map(({ region }) => region);
}
