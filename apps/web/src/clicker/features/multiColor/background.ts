import type { RGB } from '../../types';
import type { QuantizeResult } from '../../image/quantize';

/**
 * Removes only the border-connected white matte from a raster image.
 *
 * Quantization treats opaque PNG/JPG pixels as printable foreground. That is
 * useful for artwork, but it also turns a white canvas around the artwork into
 * an unwanted colour layer. We remove the connected matte component rather
 * than every white pixel, so intentional white details inside the artwork stay
 * printable.
 */
export function removeBorderBackground(result: QuantizeResult): QuantizeResult {
  const { indices, palette, width, height } = result;
  const pixelCount = indices.length;
  if (!pixelCount || !palette.length || width < 1 || height < 1) return result;

  const visited = new Uint8Array(pixelCount);
  const shouldRemove = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  const minComponentSize = Math.max(64, Math.floor(pixelCount * 0.008));
  const borderPerimeter = Math.max(1, 2 * width + 2 * height - 4);
  const minBorderShare = 0.12;
  let removedPixels = 0;

  for (let start = 0; start < pixelCount; start++) {
    if (visited[start] || indices[start] < 0) continue;

    const label = indices[start];
    let head = 0;
    let tail = 0;
    let touchesBorder = false;
    let borderTouchPixels = 0;
    const component: number[] = [];
    queue[tail++] = start;
    visited[start] = 1;

    while (head < tail) {
      const pixel = queue[head++];
      component.push(pixel);
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        touchesBorder = true;
        borderTouchPixels++;
      }

      if (x > 0) tail = enqueue(pixel - 1, label, indices, visited, queue, tail);
      if (x + 1 < width) tail = enqueue(pixel + 1, label, indices, visited, queue, tail);
      if (y > 0) tail = enqueue(pixel - width, label, indices, visited, queue, tail);
      if (y + 1 < height) tail = enqueue(pixel + width, label, indices, visited, queue, tail);
    }

    const rgb = palette[label]?.rgb;
    const borderShare = borderTouchPixels / borderPerimeter;
    const isBroadBorderMatte = borderShare >= minBorderShare;
    if (touchesBorder && isBroadBorderMatte && component.length >= minComponentSize && rgb && isNearWhite(rgb)) {
      for (const pixel of component) shouldRemove[pixel] = 1;
      removedPixels += component.length;
    }
  }

  // Never turn a fully white/blank image into an empty model.
  if (!removedPixels || removedPixels >= pixelCount) return result;

  const nextIndices = new Int16Array(indices);
  const remainingCounts = new Float64Array(palette.length);
  let remainingPixels = 0;
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    if (shouldRemove[pixel]) {
      nextIndices[pixel] = -1;
      continue;
    }
    const label = nextIndices[pixel];
    if (label >= 0) {
      remainingCounts[label] += 1;
      remainingPixels += 1;
    }
  }

  const nextPalette = palette.map((entry, label) => ({
    ...entry,
    coverage: remainingPixels ? remainingCounts[label] / remainingPixels : 0,
  }));

  return { ...result, palette: nextPalette, indices: nextIndices };
}

function isNearWhite(rgb: RGB): boolean {
  const minimum = Math.min(...rgb);
  const maximum = Math.max(...rgb);
  return minimum >= 220 && maximum - minimum <= 42;
}

function enqueue(
  pixel: number,
  label: number,
  indices: Int16Array,
  visited: Uint8Array,
  queue: Int32Array,
  tail: number,
): number {
  if (visited[pixel] || indices[pixel] !== label) return tail;
  visited[pixel] = 1;
  queue[tail] = pixel;
  return tail + 1;
}
