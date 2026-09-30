// Perceptual color quantization over the foreground pixels: weighted seeds refined
// by k-means in Oklab, so perceptually distinct colors stay separate (dark blue vs
// black) and identical ones don't split. See src/image/colorspace.ts.
import type { RgbaImage } from './decode';
import type { RGB } from '../types';
import { srgbToOklab, oklabToSrgb } from './colorspace';

export interface QuantizeResult {
  palette: { rgb: RGB; coverage: number }[];
  /** Per-pixel palette index, or -1 for background. Length = width*height. */
  indices: Int16Array;
  width: number;
  height: number;
}

export interface QuantizeOptions {
  /** Reserved for callers that need to preserve rare accent colors. */
  preserveRareColors?: boolean;
}

// Soft anti-aliased edge pixels (alpha below this) are dropped from the model. Lowered
// from 170 to 128 now that compositeOverMatte cleans fringe colors before this runs —
// 170 eroded ~1px off anti-aliased glyphs (thin text vanished); 128 keeps the strokes
// and the composited matte removes the halo the higher cutoff used to paper over.
const ALPHA_THRESHOLD = 128;
const KMEANS_ITERS = 6;

export function quantize(
  img: RgbaImage,
  colorCount: number,
  customColors?: RGB[],
  _options: QuantizeOptions = {},
): QuantizeResult {
  const { data, width, height } = img;
  const n = width * height;

  // Collect foreground pixels.
  const fgR: number[] = [];
  const fgG: number[] = [];
  const fgB: number[] = [];
  const fgPixel: number[] = []; // pixel index in full image
  for (let p = 0; p < n; p++) {
    const a = data[p * 4 + 3];
    if (a < ALPHA_THRESHOLD) continue;
    fgR.push(data[p * 4]);
    fgG.push(data[p * 4 + 1]);
    fgB.push(data[p * 4 + 2]);
    fgPixel.push(p);
  }

  const indices = new Int16Array(n).fill(-1);
  const M = fgR.length;
  if (M === 0) {
    return { palette: [], indices, width, height };
  }

  // Oklab coordinates for every foreground pixel (clustering + mapping happen here).
  const okL = new Float32Array(M);
  const okA = new Float32Array(M);
  const okB = new Float32Array(M);
  for (let i = 0; i < M; i++) {
    const lab = srgbToOklab([fgR[i], fgG[i], fgB[i]]);
    okL[i] = lab[0];
    okA[i] = lab[1];
    okB[i] = lab[2];
  }

  if (customColors && customColors.length > 0) {
    // Map each pixel to the nearest custom filament by Oklab distance (fixes the
    // "wrong filament chosen" complaints where a mid-blue mapped to gray in RGB).
    const cl = customColors.map((c) => srgbToOklab(c));
    const counts = new Array(customColors.length).fill(0);
    for (let i = 0; i < M; i++) {
      let bestK = 0;
      let bestD = Infinity;
      for (let k = 0; k < cl.length; k++) {
        const dl = okL[i] - cl[k][0];
        const da = okA[i] - cl[k][1];
        const db = okB[i] - cl[k][2];
        const d = dl * dl + da * da + db * db;
        if (d < bestD) {
          bestD = d;
          bestK = k;
        }
      }
      indices[fgPixel[i]] = bestK;
      counts[bestK]++;
    }

    const palette: { rgb: RGB; coverage: number }[] = [];
    const oldToNewIdx = new Map<number, number>();
    for (let k = 0; k < customColors.length; k++) {
      if (counts[k] > 0) {
        oldToNewIdx.set(k, palette.length);
        palette.push({ rgb: customColors[k], coverage: counts[k] / M });
      }
    }
    for (let i = 0; i < n; i++) {
      const idx = indices[i];
      if (idx !== -1) indices[i] = oldToNewIdx.has(idx) ? oldToNewIdx.get(idx)! : -1;
    }
    return { palette, indices, width, height };
  }

  // Seed in perceptual space from occupied colour bins. Splitting RGB boxes
  // at their median can put black and dark grey in the same seed while
  // spending several seeds on cyan fringes. Weighted farthest-point seeds
  // reserve a centre for each substantial, perceptually distinct colour.
  const bins = new Map<number, { count: number; l: number; a: number; b: number }>();
  for (let i = 0; i < M; i++) {
    const key = ((fgR[i] >> 3) << 10) | ((fgG[i] >> 3) << 5) | (fgB[i] >> 3);
    const bin = bins.get(key) ?? { count: 0, l: 0, a: 0, b: 0 };
    bin.count++; bin.l += okL[i]; bin.a += okA[i]; bin.b += okB[i];
    bins.set(key, bin);
  }
  const candidates = [...bins.values()].map(bin => ({
    count: bin.count, lab: [bin.l / bin.count, bin.a / bin.count, bin.b / bin.count],
  })).sort((a, b) => b.count - a.count);
  const seeds = [candidates[0].lab];
  const target = Math.max(1, Math.min(colorCount, 16));
  while (seeds.length < target) {
    let bestScore = 0;
    let best: number[] | undefined;
    for (const candidate of candidates) {
      const distance = Math.min(...seeds.map(seed =>
        candidate.lab.reduce((sum, value, axis) => sum + (value - seed[axis]) ** 2, 0)));
      const score = candidate.count * distance;
      if (score > bestScore) { bestScore = score; best = candidate.lab; }
    }
    if (!best || bestScore < 1e-8) break;
    seeds.push(best);
  }
  const K = seeds.length;
  const cL = Float32Array.from(seeds, seed => seed[0]);
  const cA = Float32Array.from(seeds, seed => seed[1]);
  const cB = Float32Array.from(seeds, seed => seed[2]);

  // --- k-means refinement in Oklab (assign → recompute means). Oklab is already
  //     perceptually uniform, so all three channels are weighted equally. ---
  const assign = new Int16Array(M);
  const assignNearest = () => {
    for (let i = 0; i < M; i++) {
      let bestK = 0;
      let bestD = Infinity;
      for (let k = 0; k < K; k++) {
        const dl = okL[i] - cL[k];
        const da = okA[i] - cA[k];
        const db = okB[i] - cB[k];
        const d = dl * dl + da * da + db * db;
        if (d < bestD) {
          bestD = d;
          bestK = k;
        }
      }
      assign[i] = bestK;
    }
  };
  for (let iter = 0; iter < KMEANS_ITERS; iter++) {
    assignNearest();
    const sL = new Float64Array(K);
    const sA = new Float64Array(K);
    const sB = new Float64Array(K);
    const cnt = new Float64Array(K);
    for (let i = 0; i < M; i++) {
      const k = assign[i];
      sL[k] += okL[i];
      sA[k] += okA[i];
      sB[k] += okB[i];
      cnt[k]++;
    }
    for (let k = 0; k < K; k++) {
      if (cnt[k] > 0) {
        cL[k] = sL[k] / cnt[k];
        cA[k] = sA[k] / cnt[k];
        cB[k] = sB[k] / cnt[k];
      }
    }
  }

  // Final per-pixel assignment (nearest center in Oklab) + coverage counts.
  const counts = new Float64Array(K);
  assignNearest();
  for (let i = 0; i < M; i++) {
    const k = assign[i];
    counts[k]++;
    indices[fgPixel[i]] = k;
  }

  // Drop empty clusters, remap indices, and convert each center back to sRGB.
  const remap = new Int16Array(K).fill(-1);
  const palette: { rgb: RGB; coverage: number }[] = [];
  for (let k = 0; k < K; k++) {
    if (counts[k] > 0) {
      remap[k] = palette.length;
      palette.push({ rgb: oklabToSrgb([cL[k], cA[k], cB[k]]), coverage: counts[k] / M });
    }
  }
  for (let i = 0; i < n; i++) {
    const idx = indices[i];
    if (idx !== -1) indices[i] = remap[idx];
  }

  return { palette, indices, width, height };
}

/** Keep distinct visible colors for the image-preparation UI, absorbing only
 *  sub-percent quantization noise into its nearest retained color. */
export function retainVisiblePaletteColors(result: QuantizeResult, minimumCoverage = 0.01): QuantizeResult {
  if (result.palette.length < 2) return result;
  // Collapse near-identical raster shades before tracing separate solids.
  // Keep the dominant source shade; black versus dark grey remains distinct.
  const orderByArea = result.palette.map((_, i) => i).sort((a, b) => result.palette[b].coverage - result.palette[a].coverage);
  const representatives: number[] = [];
  const remap = new Int16Array(result.palette.length);
  for (const index of orderByArea) {
    const rgb = result.palette[index].rgb;
    let target = representatives.findIndex(other =>
      Math.hypot(...rgb.map((value, axis) => value - result.palette[other].rgb[axis])) <= 32);
    if (target < 0) { target = representatives.length; representatives.push(index); }
    remap[index] = target;
  }
  const mergedPalette = representatives.map(index => ({ ...result.palette[index], coverage: 0 }));
  result.palette.forEach((entry, index) => { mergedPalette[remap[index]].coverage += entry.coverage; });
  result = { ...result, palette: mergedPalette, indices: result.indices.map(index => index < 0 ? -1 : remap[index]) };
  let retained = result.palette.map((entry, index) => index).filter((index) => result.palette[index].coverage >= minimumCoverage);
  if (retained.length === 0) {
    const largest = result.palette.reduce((best, entry, index) => entry.coverage > result.palette[best].coverage ? index : best, 0);
    retained = [largest];
  }

  const retainedLabs = retained.map((index) => srgbToOklab(result.palette[index].rgb));
  const oldToRetained = new Int16Array(result.palette.length);
  const coverage = new Float64Array(retained.length);
  for (let oldIndex = 0; oldIndex < result.palette.length; oldIndex++) {
    const old = result.palette[oldIndex];
    let bestIndex = retained.indexOf(oldIndex);
    if (bestIndex < 0) {
      const lab = srgbToOklab(old.rgb);
      let bestDistance = Infinity;
      for (let candidate = 0; candidate < retained.length; candidate++) {
        const target = retainedLabs[candidate];
        const dl = lab[0] - target[0];
        const da = lab[1] - target[1];
        const db = lab[2] - target[2];
        const distance = dl * dl + da * da + db * db;
        if (distance < bestDistance) { bestDistance = distance; bestIndex = candidate; }
      }
    }
    oldToRetained[oldIndex] = bestIndex;
    coverage[bestIndex] += old.coverage;
  }

  const order = retained.map((_, index) => index).sort((a, b) => coverage[b] - coverage[a]);
  const retainedToSorted = new Int16Array(retained.length);
  order.forEach((oldIndex, sortedIndex) => { retainedToSorted[oldIndex] = sortedIndex; });
  const palette = order.map((retainedIndex) => ({
    rgb: [...result.palette[retained[retainedIndex]].rgb] as RGB,
    coverage: coverage[retainedIndex],
  }));
  const indices = new Int16Array(result.indices.length);
  for (let pixel = 0; pixel < indices.length; pixel++) {
    const index = result.indices[pixel];
    indices[pixel] = index < 0 ? -1 : retainedToSorted[oldToRetained[index]];
  }
  return { ...result, palette, indices };
}
