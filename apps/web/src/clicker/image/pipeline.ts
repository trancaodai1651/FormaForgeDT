// Image -> normalized RegionSet. Orchestrates matte + composite + clean + quantize + trace.
import type { RgbaImage } from './decode';
import { removeBackground, compositeOverMatte, cleanMask } from './matte';
import { quantize } from './quantize';
import { traceRegions } from './trace';
import type { RegionSet, RGB } from '../types';

export interface ProcessOptions {
  /** Strip a flat background by edge flood-fill (skipped if image has alpha). */
  removeBg?: boolean;
  /** Edge smoothing strength, 0..1 (higher = smoother contours). */
  smoothing?: number;
  customColors?: RGB[];
  /** Protect small features via adaptive smoothing + speck absorption (default on). */
  preserveDetail?: boolean;
  /** Automatically flatten noisy phone photos into a simplified 2D palette. */
  photoFlatten?: boolean;
}

const PHOTO_SAMPLE_TARGET = 10000;
const PHOTO_COLOR_THRESHOLD = 64;
const PHOTO_MIN_PIXELS = 300 * 300;

function isPhotoLikeImage(img: RgbaImage): boolean {
  const { data, width, height } = img;
  const total = width * height;
  if (total < PHOTO_MIN_PIXELS) return false;

  let alphaCount = 0;
  const colors = new Set<number>();
  const sampleStep = Math.max(1, Math.floor(Math.sqrt(total / PHOTO_SAMPLE_TARGET)));
  let samples = 0;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const p = y * width + x;
      const alpha = data[p * 4 + 3];
      if (alpha < 255) alphaCount++;
      const r = data[p * 4] & 0xf8;
      const g = data[p * 4 + 1] & 0xf8;
      const b = data[p * 4 + 2] & 0xf8;
      colors.add((r << 16) | (g << 8) | b);
      samples++;
      if (colors.size > PHOTO_COLOR_THRESHOLD && alphaCount < samples * 0.02) {
        return true;
      }
    }
  }

  return (alphaCount < samples * 0.02) && colors.size > PHOTO_COLOR_THRESHOLD;
}

function flattenPhotoImage(img: RgbaImage, targetColorCount: number): RgbaImage {
  const { palette, indices } = quantize(img, targetColorCount);
  const out = new Uint8ClampedArray(img.data.length);
  const n = img.width * img.height;

  for (let p = 0; p < n; p++) {
    const idx = indices[p];
    const oi = p * 4;
    if (idx < 0) {
      out[oi + 3] = 0;
    } else {
      const [r, g, b] = palette[idx].rgb;
      out[oi] = r;
      out[oi + 1] = g;
      out[oi + 2] = b;
      out[oi + 3] = 255;
    }
  }

  return { data: out, width: img.width, height: img.height };
}

export function processImage(
  img: RgbaImage,
  colorCount: number,
  opts: ProcessOptions = {},
): RegionSet {
  const options = { ...opts };
  const shouldFlattenPhoto = options.photoFlatten !== false && isPhotoLikeImage(img);
  if (shouldFlattenPhoto) {
    img = flattenPhotoImage(img, Math.max(2, Math.min(colorCount, 4)));
    options.smoothing = Math.max(options.smoothing ?? 0.9, 0.9);
    options.preserveDetail = false;
  }

  // Background removal first so the flood fill sees the original alpha; compositing
  // afterwards uses the detected/auto matte for the remaining soft (anti-aliased)
  // pixels, killing colored halos. cleanMask then despeckles + fills pinholes.
  if (options.removeBg !== false) removeBackground(img);
  compositeOverMatte(img);
  cleanMask(img);
  const q = quantize(img, colorCount, options.customColors);
  return traceRegions(q, options.smoothing ?? 0.5, options.preserveDetail ?? true);
}
