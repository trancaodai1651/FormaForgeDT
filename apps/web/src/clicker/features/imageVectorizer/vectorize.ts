import { processImage } from '../../image/pipeline';
import { drawToImageData, type RgbaImage } from '../../image/decode';
import { getClickerDocument } from '../../runtime';
import type { RGB, RegionSet, Ring } from '../../types';
import { PALETTE_PRESETS, type VectorizerInput, type VectorizerResult, type VectorizerSettings } from './model';

function cloneImage(image: RgbaImage): RgbaImage {
  return { data: new Uint8ClampedArray(image.data), width: image.width, height: image.height };
}

function cropImage(source: RgbaImage, crop: VectorizerSettings['crop']): RgbaImage {
  const sx = Math.max(0, Math.min(source.width - 1, Math.round(source.width * crop.x / 100)));
  const sy = Math.max(0, Math.min(source.height - 1, Math.round(source.height * crop.y / 100)));
  const sw = Math.max(1, Math.min(source.width - sx, Math.round(source.width * crop.width / 100)));
  const sh = Math.max(1, Math.min(source.height - sy, Math.round(source.height * crop.height / 100)));
  const data = new Uint8ClampedArray(sw * sh * 4);
  for (let y = 0; y < sh; y++) {
    const from = ((sy + y) * source.width + sx) * 4;
    data.set(source.data.subarray(from, from + sw * 4), y * sw * 4);
  }
  return { data, width: sw, height: sh };
}

function rgbToHsl([r0, g0, b0]: RGB): [number, number, number] {
  const r = r0 / 255; const g = g0 / 255; const b = b0 / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const d = max - min;
  const l = (max + min) / 2;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  const rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgb.map((v) => Math.round((v + m) * 255)) as RGB;
}

function enhanceImage(image: RgbaImage, settings: VectorizerSettings): RgbaImage {
  const result = cloneImage(image);
  const { brightness, contrast, saturation } = settings.edit;
  const contrastFactor = contrast * (settings.enhance ? 1.08 : 1);
  const saturationFactor = saturation * (settings.enhance ? 1.06 : 1);
  for (let i = 0; i < result.data.length; i += 4) {
    const alpha = result.data[i + 3];
    if (alpha === 0) continue;
    let rgb = rgbToHsl([result.data[i], result.data[i + 1], result.data[i + 2]]);
    rgb[2] = Math.max(0, Math.min(1, (rgb[2] - 0.5) * contrastFactor + 0.5));
    rgb[2] = Math.max(0, Math.min(1, rgb[2] * brightness));
    rgb[1] = Math.max(0, Math.min(1, rgb[1] * saturationFactor));
    const next = hslToRgb(rgb[0], rgb[1], rgb[2]);
    result.data[i] = next[0]; result.data[i + 1] = next[1]; result.data[i + 2] = next[2];
  }
  return result;
}

async function upscale(image: RgbaImage, factor: 1 | 2): Promise<RgbaImage> {
  if (factor === 1) return image;
  const maxSide = Math.max(image.width, image.height);
  if (maxSide >= 1800) return image;
  const canvas = getClickerDocument().createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return image;
  const source = new ImageData(image.data as unknown as ImageDataArray, image.width, image.height);
  ctx.putImageData(source, 0, 0);
  return drawToImageData(canvas, image.width, image.height, Math.min(1800, maxSide * factor));
}

function hex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
}

function ringArea(ring: Ring): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return Math.abs(area / 2);
}

function pathForRings(rings: Ring[], width: number, height: number, longest: number, precision: number): string {
  const point = ([x, y]: [number, number]) => `${(width / 2 + x * longest).toFixed(precision)},${(height / 2 - y * longest).toFixed(precision)}`;
  return rings.map((ring) => ring.length >= 3 ? `M ${point(ring[0])} ${ring.slice(1).map((p) => `L ${point(p)}`).join(' ')} Z` : '').join(' ');
}

function filteredRegionSet(regionSet: RegionSet, minimumArea: VectorizerSettings['minimumArea']): RegionSet {
  const threshold = minimumArea === 'all' ? 0 : minimumArea === 'small' ? 0.00008 : 0.00035;
  return {
    ...regionSet,
    regions: regionSet.regions.map((region) => ({
      ...region,
      components: region.components.filter((component) => component.rings.reduce((sum, ring) => sum + ringArea(ring), 0) >= threshold),
    })).filter((region) => region.components.length > 0),
  };
}

function selectedPalette(settings: VectorizerSettings): RGB[] | undefined {
  if (settings.paletteName === 'custom') return settings.customPalette.length ? settings.customPalette : undefined;
  if (settings.paletteName === 'auto') return undefined;
  return PALETTE_PRESETS[settings.paletteName];
}

function renderSvg(regionSet: RegionSet, settings: VectorizerSettings): VectorizerResult {
  const longest = Math.max(1, settings.outputWidthMm);
  const aspect = Math.max(0.02, regionSet.aspect || 1);
  const width = aspect >= 1 ? longest : longest * aspect;
  const height = aspect >= 1 ? longest / aspect : longest;
  const precision = settings.maxFileSize ? 1 : 2;
  const defs: string[] = [];
  const body: string[] = [];
  if (settings.backgroundMode === 'solid') body.push(`<rect width="100%" height="100%" fill="${hex(settings.backgroundColor)}"/>`);
  let pathCount = 0;
  regionSet.regions.forEach((region, regionIndex) => {
    const color = hex(region.quantRgb);
    const fill = settings.outputMode === 'gradients' ? `url(#ff-gradient-${regionIndex})` : color;
    if (settings.outputMode === 'gradients') defs.push(`<linearGradient id="ff-gradient-${regionIndex}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${hex(region.quantRgb.map((v) => Math.min(255, v + 32)) as RGB)}"/></linearGradient>`);
    for (const component of region.components) {
      const d = pathForRings(component.rings, width, height, longest, precision);
      if (!d) continue;
      pathCount++;
      const stroke = settings.addOutline ? ` stroke="#18181b" stroke-width="${settings.outlineWidth}" paint-order="stroke"` : '';
      const overlap = settings.overlap === 'full' ? ' fill-opacity="1"' : settings.overlap === 'high' ? ' fill-opacity=".98"' : ' fill-opacity=".94"';
      body.push(`<path d="${d}" fill="${fill}"${stroke}${overlap} fill-rule="evenodd"/>`);
    }
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(2)}mm" height="${height.toFixed(2)}mm" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}"><title>FormaForgeDT Image Vectorizer</title>${defs.length ? `<defs>${defs.join('')}</defs>` : ''}<g>${body.join('')}</g></svg>`;
  return { svg, regionCount: regionSet.regions.length, pathCount, widthMm: width, heightMm: height, sourceWidth: 0, sourceHeight: 0 };
}

export async function vectorizeImage(input: VectorizerInput, settings: VectorizerSettings): Promise<VectorizerResult> {
  let image = cropImage(input.original, settings.crop);
  image = enhanceImage(image, settings);
  image = await upscale(image, settings.upscaling);
  const smoothing = settings.antiAliasing === 'off' ? 0.03 : settings.antiAliasing === 'smart' ? 0.28 : 0.58;
  const result = processImage(image, settings.colorCount, {
    removeBg: settings.backgroundMode !== 'keep',
    smoothing: Math.max(smoothing, settings.roundness * 0.72 + (settings.circleDetection ? 0.08 : 0)),
    customColors: selectedPalette(settings),
    preserveDetail: settings.noiseReduction !== 'high',
    photoFlatten: false,
  });
  const rendered = renderSvg(filteredRegionSet(result, settings.minimumArea), settings);
  return { ...rendered, sourceWidth: image.width, sourceHeight: image.height };
}

export function imageToDataUrl(image: RgbaImage): string {
  const canvas = getClickerDocument().createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.putImageData(new ImageData(image.data as unknown as ImageDataArray, image.width, image.height), 0, 0);
  return canvas.toDataURL('image/png');
}
