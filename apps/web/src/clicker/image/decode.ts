import { getClickerDocument } from '../runtime';
// Decode an uploaded file into high-quality resampled ImageData (main-thread canvas).
// Uses pica (Lanczos / mks2013) so thin strokes and text survive the resize, and
// requests EXIF orientation baking so phone photos import upright.
import { Pica } from 'pica';

export interface RgbaImage {
  data: Uint8ClampedArray; // RGBA
  width: number;
  height: number;
}

// Downscale ceiling and the minimum working resolution: small logos are upscaled to
// MIN_WORKING so the tracer has enough resolution to make smooth curves.
// Use a higher quality default for photo imports so the saved file quality is maximized.
const TARGET = 2000;
const MIN_WORKING = 1400;

let picaInstance: Pica | null = null;
function getPica(): Pica {
  if (!picaInstance) picaInstance = new Pica();
  return picaInstance;
}

// Bake EXIF orientation and avoid premultiply surprises. Very old engines throw on
// the options bag â€” fall back to a plain decode there.
async function decodeBitmap(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, {
      imageOrientation: 'from-image',
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'default',
    });
  } catch {
    return await createImageBitmap(blob);
  }
}

export async function loadFileToImage(file: File, maxSize = TARGET): Promise<RgbaImage> {
  const bitmap = await decodeBitmap(file);
  try {
    return await drawToImageData(bitmap, bitmap.width, bitmap.height, maxSize);
  } finally {
    bitmap.close();
  }
}

// Decode an image URL (e.g. a bundled sample asset) into resampled ImageData.
export async function loadUrlToImage(url: string, maxSize = TARGET): Promise<RgbaImage> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load image: ${url} (${res.status})`);
  const blob = await res.blob();
  const bitmap = await decodeBitmap(blob);
  try {
    return await drawToImageData(bitmap, bitmap.width, bitmap.height, maxSize);
  } finally {
    bitmap.close();
  }
}

export async function drawToImageData(
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  maxSize: number,
): Promise<RgbaImage> {
  const maxSide = Math.max(srcW, srcH);
  // Resample policy: downscale big images (mks2013 = resize + light sharpen, better
  // than plain Lanczos for downscale), upscale small ones (lanczos3), else keep 1:1.
  let w = srcW;
  let h = srcH;
  let filter: 'mks2013' | 'lanczos3' | null = null;
  if (maxSide > maxSize) {
    const s = maxSize / maxSide;
    w = Math.max(1, Math.round(srcW * s));
    h = Math.max(1, Math.round(srcH * s));
    filter = 'mks2013';
  } else if (maxSide < MIN_WORKING) {
    const s = MIN_WORKING / maxSide;
    w = Math.max(1, Math.round(srcW * s));
    h = Math.max(1, Math.round(srcH * s));
    filter = 'lanczos3';
  }

  const dstCanvas = getClickerDocument().createElement('canvas');
  dstCanvas.width = w;
  dstCanvas.height = h;

  if (!filter || (w === srcW && h === srcH)) {
    const dctx = dstCanvas.getContext('2d', { willReadFrequently: true })!;
    dctx.clearRect(0, 0, w, h);
    dctx.drawImage(src, 0, 0, w, h);
    const img = dctx.getImageData(0, 0, w, h);
    return { data: img.data, width: w, height: h };
  }

  try {
    // Prefer browser-native ImageBitmap resize when available; it can be faster
    // than manual pica resizing for very large phone photos.
    if (typeof createImageBitmap === 'function') {
      try {
        const resized = await createImageBitmap(src, {
          resizeWidth: w,
          resizeHeight: h,
          resizeQuality: 'high',
        } as ImageBitmapOptions);
        const dctx = dstCanvas.getContext('2d', { willReadFrequently: true })!;
        dctx.clearRect(0, 0, w, h);
        dctx.drawImage(resized, 0, 0);
        resized.close();
        const img = dctx.getImageData(0, 0, w, h);
        return { data: img.data, width: w, height: h };
      } catch {
        // Fall back to pica below.
      }
    }

    await getPica().resize(src as unknown as any, dstCanvas, { filter });
    const dctx = dstCanvas.getContext('2d', { willReadFrequently: true })!;
    const img = dctx.getImageData(0, 0, w, h);
    return { data: img.data, width: w, height: h };
  } catch {
    const dctx = dstCanvas.getContext('2d', { willReadFrequently: true })!;
    dctx.imageSmoothingEnabled = true;
    dctx.imageSmoothingQuality = 'high';
    dctx.clearRect(0, 0, w, h);
    dctx.drawImage(src, 0, 0, w, h);
    const img = dctx.getImageData(0, 0, w, h);
    return { data: img.data, width: w, height: h };
  }
}



