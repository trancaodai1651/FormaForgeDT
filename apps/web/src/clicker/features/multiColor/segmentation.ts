import type { RGB } from '../../types';
import { srgbToOklab } from '../../image/colorspace';
import type { QuantizeResult } from '../../image/quantize';

type PaletteGroup = {
  rgb: RGB;
  lab: [number, number, number];
  weight: number;
  members: number[];
};

function hue(rgb: RGB): number {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (chroma < 1) return 0;
  if (max === r) return (60 * ((g - b) / chroma) + 360) % 360;
  if (max === g) return 60 * ((b - r) / chroma) + 120;
  return 60 * ((r - g) / chroma) + 240;
}

function hueDistance(a: number, b: number): number {
  const distance = Math.abs(a - b);
  return Math.min(distance, 360 - distance);
}

function chroma(lab: [number, number, number]): number {
  return Math.hypot(lab[1], lab[2]);
}

function labDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function weightedRgb(group: PaletteGroup, rgb: RGB, weight: number): RGB {
  const total = group.weight + weight;
  return [
    Math.round((group.rgb[0] * group.weight + rgb[0] * weight) / total),
    Math.round((group.rgb[1] * group.weight + rgb[1] * weight) / total),
    Math.round((group.rgb[2] * group.weight + rgb[2] * weight) / total),
  ];
}

function canMerge(group: PaletteGroup, rgb: RGB, lab: [number, number, number]): boolean {
  const groupChroma = chroma(group.lab);
  const nextChroma = chroma(lab);
  const neutral = groupChroma < 0.075 && nextChroma < 0.075;
  const groupHue = hue(group.rgb);
  const nextHue = hue(rgb);
  const blueFamily =
    groupChroma >= 0.025 &&
    nextChroma >= 0.025 &&
    groupHue >= 175 && groupHue <= 285 &&
    nextHue >= 175 && nextHue <= 285 &&
    hueDistance(groupHue, nextHue) <= 55;
  const sameHue = groupChroma >= 0.025 && nextChroma >= 0.025 && hueDistance(groupHue, nextHue) <= 28;
  if (!neutral && !sameHue) return false;

  // Anti-aliased edges and mild lighting gradients usually stay within this
  // distance. A generous neutral threshold merges white/cream matte shades,
  // while a hue guard prevents red, yellow and blue from collapsing together.
  return labDistance(group.lab, lab) <= (neutral ? 0.125 : blueFamily ? 0.16 : 0.11);
}

function canMergeTinyShade(group: PaletteGroup, candidate: PaletteGroup): boolean {
  const groupChroma = chroma(group.lab);
  const candidateChroma = chroma(candidate.lab);
  const bothNeutral = groupChroma < 0.09 && candidateChroma < 0.09;
  if (bothNeutral) return labDistance(group.lab, candidate.lab) <= 0.16;

  if (groupChroma < 0.025 || candidateChroma < 0.025) return false;
  const groupHue = hue(group.rgb);
  const candidateHue = hue(candidate.rgb);
  const blueFamily =
    groupHue >= 175 && groupHue <= 285 &&
    candidateHue >= 175 && candidateHue <= 285;
  const allowedHueDistance = blueFamily ? 65 : 35;
  return hueDistance(groupHue, candidateHue) <= allowedHueDistance && labDistance(group.lab, candidate.lab) <= 0.2;
}

function isProtectedAccent(group: PaletteGroup): boolean {
  const [r, g, b] = group.rgb;
  const rgbSpread = Math.max(r, g, b) - Math.min(r, g, b);
  if (rgbSpread < 70 || chroma(group.lab) < 0.08) return false;

  // Small warm accents such as a star or a rooster are real artwork, not
  // anti-aliased blue/white shades. Keep them even when their area is <= 1%.
  const groupHue = hue(group.rgb);
  return groupHue < 175 || groupHue > 285;
}

/**
 * Consolidate quantizer shades that are not useful printable materials.
 *
 * Asking for ten colours should allow ten genuinely different colours, but it
 * should not turn one blue background into six blue layers because of raster
 * anti-aliasing. Groups are weighted by coverage, so tiny edge shades join the
 * nearest dominant material and the resulting index map remains gap-free.
 */
export function consolidateMultiColorPalette(result: QuantizeResult): QuantizeResult {
  if (result.palette.length < 2) return result;

  const sorted = result.palette
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.coverage - a.entry.coverage);
  const groups: PaletteGroup[] = [];
  const oldToGroup = new Int16Array(result.palette.length).fill(-1);

  for (const { entry, index } of sorted) {
    const lab = srgbToOklab(entry.rgb);
    const groupIndex = groups.findIndex((group) => canMerge(group, entry.rgb, lab));
    if (groupIndex < 0) {
      oldToGroup[index] = groups.length;
      groups.push({ rgb: [...entry.rgb] as RGB, lab, weight: entry.coverage, members: [index] });
      continue;
    }

    const group = groups[groupIndex];
    group.rgb = weightedRgb(group, entry.rgb, entry.coverage);
    group.weight += entry.coverage;
    group.lab = srgbToOklab(group.rgb);
    group.members.push(index);
    oldToGroup[index] = groupIndex;
  }

  // A full-palette analysis deliberately starts with more candidates than the
  // image may visibly contain. Merge only tiny shades into an established
  // colour family; this keeps real small details such as a yellow star or red
  // rooster while removing 0-1% blue/white antialiasing layers.
  const tinyCoverage = 0.02;
  const stableGroups = groups.filter((group) => group.weight >= tinyCoverage);
  for (const [tinyIndex, tiny] of groups.entries()) {
    if (tiny.weight >= tinyCoverage || stableGroups.length === 0) continue;
    let target: PaletteGroup | undefined;
    let targetIndex = -1;
    for (const stable of stableGroups) {
      if (!canMergeTinyShade(stable, tiny)) continue;
      if (!target || stable.weight > target.weight) {
        target = stable;
        targetIndex = groups.indexOf(stable);
      }
    }
    if (!target || targetIndex < 0 || targetIndex === tinyIndex) continue;
    target.rgb = weightedRgb(target, tiny.rgb, tiny.weight);
    target.weight += tiny.weight;
    target.lab = srgbToOklab(target.rgb);
    target.members.push(...tiny.members);
    for (const member of tiny.members) oldToGroup[member] = targetIndex;
  }

  // The UI rounds coverage to whole percentages, so a displayed "0%" may be
  // a small but non-empty palette entry. It is not a printable colour layer.
  // Absorb every remaining entry at or below 1% into the closest retained
  // material. This keeps the label map gap-free and leaves only layers with
  // actual coverage greater than 1%.
  const minimumRetainedCoverage = 0.01;
  const retainedGroups = groups.filter(
    (group) => group.weight > minimumRetainedCoverage || isProtectedAccent(group),
  );
  for (const [tinyIndex, tiny] of groups.entries()) {
    if (tiny.weight > minimumRetainedCoverage || isProtectedAccent(tiny) || retainedGroups.length === 0) continue;
    if (!tiny.members.some((member) => oldToGroup[member] === tinyIndex)) continue;

    let target: PaletteGroup | undefined;
    let targetIndex = -1;
    for (const retained of retainedGroups) {
      if (!canMergeTinyShade(retained, tiny)) continue;
      if (!target || retained.weight > target.weight) {
        target = retained;
        targetIndex = groups.indexOf(retained);
      }
    }
    if (!target) {
      for (const retained of retainedGroups) {
        if (!target || labDistance(retained.lab, tiny.lab) < labDistance(target.lab, tiny.lab)) {
          target = retained;
          targetIndex = groups.indexOf(retained);
        }
      }
    }
    if (!target || targetIndex < 0 || targetIndex === tinyIndex) continue;

    target.rgb = weightedRgb(target, tiny.rgb, tiny.weight);
    target.weight += tiny.weight;
    target.lab = srgbToOklab(target.rgb);
    target.members.push(...tiny.members);
    for (const member of tiny.members) oldToGroup[member] = targetIndex;
  }

  const activeGroups = groups.filter((group, groupIndex) => group.members.some((member) => oldToGroup[member] === groupIndex));
  const activeIndex = new Map<PaletteGroup, number>(activeGroups.map((group, index) => [group, index]));

  const palette = activeGroups.map((group) => ({ rgb: group.rgb, coverage: group.weight }));
  const indices = new Int16Array(result.indices.length);
  for (let i = 0; i < result.indices.length; i++) {
    const oldIndex = result.indices[i];
    if (oldIndex < 0) {
      indices[i] = -1;
      continue;
    }
    const group = groups[oldToGroup[oldIndex]];
    indices[i] = group ? activeIndex.get(group) ?? -1 : -1;
  }
  return { ...result, palette, indices };
}
