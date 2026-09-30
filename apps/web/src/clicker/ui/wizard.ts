import { getClickerDocument } from '../runtime';
import type { RgbaImage } from '../image/decode';
import { preprocessImage } from '../image/adjust';
import { prepareImagePalette } from '../image/pipeline';
import { traceRegions } from '../image/trace';
import type { QuantizeResult } from '../image/quantize';
import { srgbToOklab } from '../image/colorspace';
import { DEFAULT_PREPROCESS, type CropRatio, type PreprocessParams, type RGB, type RegionSet } from '../types';

export interface WizardResult {
  adjusted: RgbaImage;
  preprocess: PreprocessParams;
  colorCount: number;
  colorMode: 'normal' | 'limited';
  limitedColors?: RGB[];
  paletteOverrides?: RGB[];
  imagePaletteColors: RGB[];
  smoothing: number;
}

interface WizardOpts {
  baseImage: RgbaImage;
  photoFlatten: boolean;
  onComplete(result: WizardResult): void;
  onCancel?(): void;
}

const SLIDERS: [keyof PreprocessParams, string][] = [
  ['exposure', 'Exposure'],
  ['contrast', 'Contrast'],
  ['saturation', 'Saturation'],
  ['brightness', 'Brightness'],
  ['whiteBalance', 'White Balance'],
  ['highlights', 'Highlights'],
  ['shadows', 'Shadows'],
];

const RATIOS: [CropRatio, string][] = [
  ['free', 'Free'],
  ['1:1', '1:1'],
  ['4:3', '4:3'],
  ['3:2', '3:2'],
  ['16:9', '16:9'],
];

const PREVIEW_MAX_SIDE = 700;
// Reference artwork is a small-print image with a handful of filament colours.
// A 12-cluster palette can promote anti-aliased cyan shades into separate
// regions, splitting solid letters into tiny extruded pieces in the 3D preview.
const MAX_TRACE_COLORS = 6;

function imageToCanvas(img: RgbaImage): HTMLCanvasElement {
  const canvas = getClickerDocument().createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return canvas;
}

function analysisCopy(img: RgbaImage): RgbaImage {
  const scale = Math.min(1, PREVIEW_MAX_SIDE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = getClickerDocument().createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(imageToCanvas(img), 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return { data: imageData.data, width, height };
}

export function analyzeRasterPalette(
  img: RgbaImage,
  options: { removeBg: boolean; smoothing: number; photoFlatten: boolean },
): { imagePaletteColors: RGB[]; smoothing: number } {
  const prepared = prepareImagePalette(analysisCopy(img), MAX_TRACE_COLORS, {
    removeBg: options.removeBg,
    smoothing: options.smoothing,
    photoFlatten: options.photoFlatten,
    preserveDistinctColors: true,
  });
  return {
    imagePaletteColors: prepared.quantized.palette.map(({ rgb }) => [...rgb] as RGB),
    smoothing: prepared.smoothing,
  };
}

/** Merge every unchecked trace colour into its nearest retained colour in Oklab. */
function mergeUncheckedColors(source: QuantizeResult, kept: boolean[]): QuantizeResult {
  const active = source.palette.map((entry, index) => index).filter((index) => kept[index]);
  if (active.length === 0) return { ...source, palette: [], indices: new Int16Array(source.indices.length).fill(-1) };

  const labs = source.palette.map((entry) => srgbToOklab(entry.rgb));
  const mapped = new Int16Array(source.palette.length);
  const palette = active.map((oldIndex) => ({ rgb: [...source.palette[oldIndex].rgb] as RGB, coverage: 0 }));
  const oldToNew = new Map(active.map((oldIndex, newIndex) => [oldIndex, newIndex]));

  for (let oldIndex = 0; oldIndex < source.palette.length; oldIndex++) {
    let newIndex = oldToNew.get(oldIndex);
    if (newIndex === undefined) {
      let bestDistance = Infinity;
      for (let candidate = 0; candidate < active.length; candidate++) {
        const target = labs[active[candidate]];
        const current = labs[oldIndex];
        const dl = current[0] - target[0];
        const da = current[1] - target[1];
        const db = current[2] - target[2];
        const distance = dl * dl + da * da + db * db;
        if (distance < bestDistance) {
          bestDistance = distance;
          newIndex = candidate;
        }
      }
    }
    mapped[oldIndex] = newIndex!;
    palette[newIndex!].coverage += source.palette[oldIndex].coverage;
  }

  const indices = new Int16Array(source.indices.length);
  for (let pixel = 0; pixel < indices.length; pixel++) {
    const index = source.indices[pixel];
    indices[pixel] = index < 0 ? -1 : mapped[index];
  }
  return { ...source, palette, indices };
}

function rasterPreview(result: QuantizeResult): RgbaImage {
  const data = new Uint8ClampedArray(result.width * result.height * 4);
  for (let pixel = 0; pixel < result.indices.length; pixel++) {
    const index = result.indices[pixel];
    if (index < 0) continue;
    const [r, g, b] = result.palette[index].rgb;
    const offset = pixel * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = 255;
  }
  return { data, width: result.width, height: result.height };
}

function shapeCount(regions: RegionSet): number {
  return regions.regions.reduce((count, region) => count + region.components.length, 0);
}

function colorLabel(rgb: RGB): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function colorHex(rgb: RGB): string {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

export function runWizard(opts: WizardOpts) {
  const params: PreprocessParams = { ...DEFAULT_PREPROCESS };
  let smoothing = opts.photoFlatten ? 0.9 : 0.1;
  let quantized: QuantizeResult = { palette: [], indices: new Int16Array(), width: 0, height: 0 };
  let kept: boolean[] = [];
  let zoom = 1;
  let raf = 0;
  let preserveDetail = true;

  const overlay = getClickerDocument().createElement('div');
  overlay.className = 'wz-overlay';
  getClickerDocument().body.appendChild(overlay);
  const windowRef = overlay.ownerDocument.defaultView;
  const close = () => {
    cancelAnimationFrame(raf);
    windowRef?.removeEventListener('resize', fitCanvas);
    overlay.ownerDocument.removeEventListener('keydown', onKeyDown);
    overlay.remove();
  };
  const cancel = () => { close(); opts.onCancel?.(); };
  const adjusted = () => preprocessImage(opts.baseImage, params);

  overlay.innerHTML = `
    <div class="wz-modal lg prepare">
      <div class="wz-head">Prepare Image</div>
      <div class="wz-body wz-prepare-body">
        <section class="wz-prepare-preview">
          <div class="wz-prepare-toolbar">
            <div class="wz-view-tabs" role="tablist" aria-label="Image preview">
              <button type="button" data-view="original" role="tab" aria-selected="false">Original</button>
              <button type="button" data-view="result" role="tab" aria-selected="true" class="active">Result</button>
            </div>
            <button type="button" class="wz-zoom" data-zoom="out" aria-label="Zoom out" title="Zoom out">−</button>
            <button type="button" class="wz-zoom" data-zoom="fit" aria-label="Fit image" title="Fit image">⛶</button>
            <button type="button" class="wz-zoom" data-zoom="in" aria-label="Zoom in" title="Zoom in">+</button>
            <span class="wz-count" id="wzCount">Tracing image…</span>
          </div>
          <div class="wz-image-stage checker" id="wzStage" aria-label="Processed image preview"></div>
          <div class="wz-palette-dots" id="wzDots" aria-hidden="true"></div>
          <p class="wz-prepare-tip">Works best on flat, high-contrast art — photos with shadows, gradients or texture trace poorly.</p>
        </section>

        <aside class="wz-tracing-panel">
          <div class="wz-kicker">TRACING</div>
          <div class="wz-row spread wz-colour-heading">
            <span class="wz-label">Colours in this picture</span>
            <span class="wz-muted" id="wzKeptCount"></span>
          </div>
          <div class="wz-colour-list" id="wzColours"></div>
          <p class="wz-merge-hint">Each kept colour becomes a filament. Anything unticked merges into the nearest kept colour.</p>
          <div class="wz-row spread wz-toggle-row">
            <label for="wzRemoveBg">Remove background <span title="Remove a flat background connected to the image edge">ⓘ</span></label>
            <button type="button" id="wzRemoveBg" class="wz-switch" role="switch" aria-checked="true" aria-label="Remove background"><span></span></button>
          </div>
          <div class="wz-smoothing">
            <div class="wz-row spread"><label for="wzSmooth">Smoothing <span title="Smooth traced outlines and reduce tiny print-hostile details">ⓘ</span></label><output id="wzSmoothValue">${Math.round(smoothing * 100)}%</output></div>
            <input type="range" id="wzSmooth" min="${opts.photoFlatten ? 0.9 : 0}" max="1" step="0.01" value="${smoothing}" ${opts.photoFlatten ? 'disabled' : ''} />
          </div>
          <details class="wz-fix-picture">
            <summary>Fix the picture</summary>
            <div class="wz-fix-content">
              <div class="wz-label">Crop ratio</div>
              <div class="seg" id="wzRatio">${RATIOS.map(([key, label]) => `<button type="button" data-r="${key}">${label}</button>`).join('')}</div>
              <div class="wz-row spread"><label for="wzThick">Image thickness</label><span class="wz-num"><input type="number" id="wzThick" min="0.2" max="10" step="0.2" /> mm</span></div>
              <div class="wz-label">Image adjustment</div>
              ${SLIDERS.map(([key, label]) => `
                <div class="wz-adj"><label for="wzRange-${key}">${label}</label><input type="range" id="wzRange-${key}" data-k="${key}" min="0" max="2" step="0.05" /><span class="wz-num"><input type="number" data-n="${key}" min="0" max="2" step="0.05" aria-label="${label} value" /></span></div>
              `).join('')}
            </div>
          </details>
        </aside>
      </div>
      <div class="wz-foot wz-prepare-foot">
        <span class="wz-error" id="wzErr" hidden>No usable image outline found. Adjust the image and try again.</span>
        <button type="button" id="wzCancel">Cancel</button>
        <button type="button" class="primary" id="wzDone">Create 3D</button>
      </div>
    </div>`;

  const stage = overlay.querySelector<HTMLElement>('#wzStage')!;
  const done = overlay.querySelector<HTMLButtonElement>('#wzDone')!;
  const err = overlay.querySelector<HTMLElement>('#wzErr')!;
  const colorsHost = overlay.querySelector<HTMLElement>('#wzColours')!;
  const viewButtons = [...overlay.querySelectorAll<HTMLButtonElement>('[data-view]')];
  let view: 'original' | 'result' = 'result';

  function currentPreview(): RgbaImage {
    if (view === 'original') return opts.baseImage;
    return rasterPreview(mergeUncheckedColors(quantized, kept));
  }

  function fitCanvas() {
    const canvas = stage.querySelector<HTMLCanvasElement>('canvas');
    if (!canvas) return;
    const scale = Math.min(1, (stage.clientWidth - 28) / canvas.width, (stage.clientHeight - 28) / canvas.height);
    const displayScale = Math.max(0.01, scale * zoom);
    canvas.style.width = `${Math.round(canvas.width * displayScale)}px`;
    canvas.style.height = `${Math.round(canvas.height * displayScale)}px`;
  }

  function drawPreview() {
    stage.replaceChildren(imageToCanvas(currentPreview()));
    fitCanvas();
  }

  function updateColourList() {
    colorsHost.innerHTML = quantized.palette.map(({ rgb, coverage }, index) => `
      <div class="wz-colour-row${kept[index] ? '' : ' is-off'}">
        <span class="wz-swatch" style="background:${colorHex(rgb)}" role="img" aria-label="${colorLabel(rgb)}"></span>
        <span class="wz-colour-percent">${Math.round(coverage * 100)}%</span>
        <button type="button" class="wz-switch" data-colour="${index}" role="switch" aria-checked="${!!kept[index]}" aria-label="Keep ${colorLabel(rgb)}" ${kept.filter(Boolean).length === 1 && kept[index] ? 'disabled' : ''}><span></span></button>
      </div>`).join('');
    const activeCount = kept.filter(Boolean).length;
    overlay.querySelector<HTMLElement>('#wzKeptCount')!.textContent = `${activeCount} of ${quantized.palette.length} kept`;
    overlay.querySelector<HTMLElement>('#wzDots')!.innerHTML = quantized.palette.map(({ rgb }) => `<span style="background:${colorHex(rgb)}"></span>`).join('');
    colorsHost.querySelectorAll<HTMLButtonElement>('[data-colour]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.colour);
        if (!Number.isInteger(index) || (kept[index] && kept.filter(Boolean).length <= 1)) return;
        kept[index] = !kept[index];
        updateColourList();
        updateResult();
      });
    });
  }

  function updateResult() {
    const merged = mergeUncheckedColors(quantized, kept);
    const traced = traceRegions(merged, smoothing, preserveDetail);
    const count = overlay.querySelector<HTMLElement>('#wzCount')!;
    const colourCount = merged.palette.length;
    count.textContent = `${colourCount} ${colourCount === 1 ? 'colour' : 'colours'} · ${shapeCount(traced)} shapes`;
    const usable = colourCount > 0 && traced.outline.length > 0;
    done.disabled = !usable;
    err.hidden = usable;
    if (view === 'result') drawPreview();
  }

  function analyzeImage(preserveSelection = true) {
    const previousPalette = preserveSelection
      ? quantized.palette.map((entry, index) => ({ lab: srgbToOklab(entry.rgb), kept: !!kept[index] }))
      : [];
    const image = analysisCopy(adjusted());
    const prepared = prepareImagePalette(image, MAX_TRACE_COLORS, {
      removeBg: !params.keepBackground,
      smoothing,
      photoFlatten: opts.photoFlatten,
      preserveDistinctColors: true,
    });
    quantized = prepared.quantized;
    preserveDetail = prepared.preserveDetail;
    kept = quantized.palette.map(({ rgb }) => {
      if (!previousPalette.length) return true;
      const lab = srgbToOklab(rgb);
      let closest: { distance: number; kept: boolean } = { distance: Infinity, kept: true };
      for (const old of previousPalette) {
        const dl = lab[0] - old.lab[0];
        const da = lab[1] - old.lab[1];
        const db = lab[2] - old.lab[2];
        const distance = dl * dl + da * da + db * db;
        if (distance < closest.distance) closest = { distance, kept: old.kept };
      }
      // New colours are kept by default; a shade close to a previously hidden
      // colour stays hidden when an adjustment only shifts its exact RGB value.
      return closest.distance > 0.0025 || closest.kept;
    });
    if (kept.length > 0 && !kept.some(Boolean)) kept[0] = true;
    updateColourList();
    updateResult();
  }

  const scheduleAnalysis = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => analyzeImage(true));
  };

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') cancel();
  }
  windowRef?.addEventListener('resize', fitCanvas);
  overlay.ownerDocument.addEventListener('keydown', onKeyDown);

  for (const button of viewButtons) {
    button.addEventListener('click', () => {
      view = button.dataset.view as 'original' | 'result';
      for (const tab of viewButtons) {
        const active = tab === button;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      }
      drawPreview();
    });
  }

  for (const button of overlay.querySelectorAll<HTMLButtonElement>('[data-zoom]')) {
    button.addEventListener('click', () => {
      if (button.dataset.zoom === 'fit') zoom = 1;
      else if (button.dataset.zoom === 'in') zoom = Math.min(4, +(zoom + 0.25).toFixed(2));
      else zoom = Math.max(0.5, +(zoom - 0.25).toFixed(2));
      fitCanvas();
    });
  }

  for (const button of overlay.querySelectorAll<HTMLButtonElement>('#wzRatio button')) {
    button.classList.toggle('active', button.dataset.r === params.cropRatio);
    button.addEventListener('click', () => {
      params.cropRatio = button.dataset.r as CropRatio;
      overlay.querySelectorAll('#wzRatio button').forEach((entry) => entry.classList.toggle('active', entry === button));
      scheduleAnalysis();
    });
  }

  const removeBg = overlay.querySelector<HTMLButtonElement>('#wzRemoveBg')!;
  removeBg.addEventListener('click', () => {
    params.keepBackground = !params.keepBackground;
    removeBg.setAttribute('aria-checked', String(!params.keepBackground));
    removeBg.classList.toggle('is-on', !params.keepBackground);
    scheduleAnalysis();
  });
  removeBg.classList.add('is-on');

  const smooth = overlay.querySelector<HTMLInputElement>('#wzSmooth')!;
  smooth.addEventListener('input', () => {
    smoothing = +smooth.value;
    overlay.querySelector<HTMLOutputElement>('#wzSmoothValue')!.value = `${Math.round(smoothing * 100)}%`;
    updateResult();
  });

  const thick = overlay.querySelector<HTMLInputElement>('#wzThick')!;
  thick.value = String(params.thicknessMm);
  thick.addEventListener('input', () => {
    params.thicknessMm = Math.max(0.2, Math.min(10, +thick.value || 1));
  });

  for (const [key] of SLIDERS) {
    const range = overlay.querySelector<HTMLInputElement>(`input[data-k="${key}"]`)!;
    const number = overlay.querySelector<HTMLInputElement>(`input[data-n="${key}"]`)!;
    range.value = number.value = String(params[key]);
    const apply = (value: number) => {
      const next = Math.max(0, Math.min(2, Number.isFinite(value) ? value : 1));
      (params[key] as number) = next;
      range.value = number.value = String(next);
      scheduleAnalysis();
    };
    range.addEventListener('input', () => apply(+range.value));
    number.addEventListener('input', () => apply(+number.value));
  }

  overlay.querySelector('#wzCancel')!.addEventListener('click', cancel);
  done.addEventListener('click', () => {
    if (done.disabled) return;
    const imagePaletteColors = mergeUncheckedColors(quantized, kept).palette.map(({ rgb }) => [...rgb] as RGB);
    close();
    opts.onComplete({
      adjusted: adjusted(),
      preprocess: { ...params },
      colorCount: imagePaletteColors.length,
      colorMode: 'normal',
      imagePaletteColors,
      smoothing,
    });
  });

  analyzeImage(false);
}
