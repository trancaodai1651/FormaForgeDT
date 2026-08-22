import { clickerText as rawTx } from '../../i18n';
import { getClickerDocument } from '../../runtime';
import { loadFileToImage, type RgbaImage } from '../../image/decode';
import { downloadBlob } from '../../utils/helpers';
import type { RGB } from '../../types';
import { DEFAULT_VECTORIZER_SETTINGS, PALETTE_PRESETS, type VectorizerInput, type VectorizerResult, type VectorizerSettings } from './model';
import { imageToDataUrl, vectorizeImage } from './vectorize';
import { renderImageVectorizer } from './view';

let activeController: ImageVectorizerController | null = null;

function tx(english: string, vietnamese: string): string {
  const value = rawTx(english, vietnamese);
  if (!/[ÃÂÄÅÆáàâäåæçèéêëìíîïðñòóôõöùúûüýÿƒ]/.test(value)) return value;
  const bytes = Uint8Array.from(value, (character) => character === 'ƒ' ? 0x83 : character.charCodeAt(0) & 0xff);
  return new TextDecoder().decode(bytes);
}

function hexToRgb(hex: string): RGB {
  const value = hex.replace('#', '');
  return [0, 1, 2].map((index) => Number.parseInt(value.slice(index * 2, index * 2 + 2), 16) || 0) as RGB;
}

function rgbHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
}

function safeName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'formaforge-vector';
}

function copyImage(image: RgbaImage): RgbaImage {
  return { data: new Uint8ClampedArray(image.data), width: image.width, height: image.height };
}

export interface ImageVectorizerController { destroy(): void; }

export function bootstrapImageVectorizer(): ImageVectorizerController {
  activeController?.destroy();
  const controller = new ImageVectorizerControllerImpl();
  activeController = controller;
  controller.start();
  return controller;
}

class ImageVectorizerControllerImpl implements ImageVectorizerController {
  private input: VectorizerInput | null = null;
  private result: VectorizerResult | null = null;
  private settings: VectorizerSettings = structuredClone(DEFAULT_VECTORIZER_SETTINGS);
  private inputZoom = 1;
  private outputZoom = 1;
  private buildTimer = 0;
  private buildId = 0;

  start() {
    const doc = getClickerDocument();
    doc.title = tx('Image Vectorizer · FormaForgeDT', 'Chuyển ảnh thành SVG · FormaForgeDT');
    doc.documentElement.setAttribute('data-theme', 'dark');
    doc.body.innerHTML = renderImageVectorizer(this.settings);
    this.bindUi();
    this.renderPalette();
  }

  private bindUi() {
    const doc = getClickerDocument();
    const fileInput = doc.getElementById('ivFile') as HTMLInputElement | null;
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (file) void this.loadFile(file);
    });
    const drop = doc.getElementById('ivDrop')?.parentElement;
    drop?.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('dragging'); });
    drop?.addEventListener('dragleave', () => drop.classList.remove('dragging'));
    drop?.addEventListener('drop', (event) => {
      event.preventDefault(); drop.classList.remove('dragging');
      const file = (event as DragEvent).dataTransfer?.files?.[0];
      if (file) void this.loadFile(file);
    });

    doc.querySelectorAll<HTMLButtonElement>('[data-input-tab]').forEach((button) => button.addEventListener('click', () => {
      const tab = button.dataset.inputTab;
      doc.querySelectorAll('[data-input-tab]').forEach((node) => node.classList.toggle('active', node === button));
      const palette = doc.getElementById('ivPalettePanel'); const background = doc.getElementById('ivBackgroundPanel');
      if (palette) palette.hidden = tab !== 'palette'; if (background) background.hidden = tab !== 'background';
    }));
    const palettePanel = doc.getElementById('ivPaletteSwatches')?.parentElement;
    if (palettePanel && !doc.querySelector('[data-palette]')) {
      const presets = doc.createElement('div');
      presets.className = 'iv-palette-presets';
      presets.innerHTML = [
        ['auto', tx('Auto', 'Tự động')],
        ['warm', tx('Warm', 'Ấm')],
        ['cool', tx('Cool', 'Lạnh')],
        ['mono', tx('Mono', 'Đơn sắc')],
      ].map(([value, label]) => `<button type="button" data-palette="${value}">${label}</button>`).join('');
      palettePanel.insertBefore(presets, doc.getElementById('ivColorCount')?.parentElement ?? null);
    }
    doc.querySelectorAll<HTMLButtonElement>('[data-palette]').forEach((button) => button.addEventListener('click', () => {
      const value = button.dataset.palette || 'auto';
      this.settings.paletteName = value as VectorizerSettings['paletteName'];
      doc.querySelectorAll('[data-palette]').forEach((node) => node.classList.toggle('active', node === button));
      this.renderPalette();
      this.scheduleBuild();
    }));
    doc.querySelectorAll<HTMLButtonElement>('[data-input-advanced]').forEach((button) => button.addEventListener('click', () => {
      const tab = button.dataset.inputAdvanced;
      doc.querySelectorAll('[data-input-advanced]').forEach((node) => node.classList.toggle('active', node === button));
      for (const [key, panel] of [['quality', 'ivQualityPanel'], ['filters', 'ivFiltersPanel'], ['text', 'ivTextPanel']]) {
        const element = doc.getElementById(panel); if (element) element.hidden = key !== tab;
      }
    }));
    doc.querySelectorAll<HTMLButtonElement>('[data-output-advanced]').forEach((button) => button.addEventListener('click', () => {
      const tab = button.dataset.outputAdvanced;
      doc.querySelectorAll('[data-output-advanced]').forEach((node) => node.classList.toggle('active', node === button));
      for (const [key, panel] of [['vector', 'ivVectorPanel'], ['size', 'ivSizePanel'], ['specials', 'ivSpecialsPanel'], ['limit', 'ivLimitPanel']]) {
        const element = doc.getElementById(panel); if (element) element.hidden = key !== tab;
      }
    }));
    doc.querySelectorAll<HTMLButtonElement>('[data-output-mode]').forEach((button) => button.addEventListener('click', () => {
      this.settings.outputMode = button.dataset.outputMode === 'gradients' ? 'gradients' : 'groups';
      doc.querySelectorAll('[data-output-mode]').forEach((node) => node.classList.toggle('active', node === button));
      this.scheduleBuild();
    }));
    doc.querySelectorAll<HTMLButtonElement>('[data-background]').forEach((button) => button.addEventListener('click', () => {
      this.settings.backgroundMode = (button.dataset.background || 'remove') as VectorizerSettings['backgroundMode'];
      doc.querySelectorAll('[data-background]').forEach((node) => node.classList.toggle('active', node === button));
      this.scheduleBuild();
    }));
    doc.getElementById('ivEnhance')?.addEventListener('change', (event) => { this.settings.enhance = (event.target as HTMLInputElement).checked; this.scheduleBuild(); });
    doc.getElementById('ivCustomPaletteToggle')?.addEventListener('click', () => { const el = doc.getElementById('ivCustomPalette'); if (el) el.hidden = !el.hidden; });
    doc.getElementById('ivAddCustomColor')?.addEventListener('click', () => {
      const input = doc.getElementById('ivCustomColor') as HTMLInputElement | null;
      if (!input) return;
      this.settings.customPalette = [...this.settings.customPalette, hexToRgb(input.value)];
      this.settings.paletteName = 'custom';
      this.renderPalette(); this.scheduleBuild();
    });
    doc.getElementById('ivBackgroundColor')?.addEventListener('input', (event) => { this.settings.backgroundColor = hexToRgb((event.target as HTMLInputElement).value); this.scheduleBuild(); });
    doc.querySelectorAll<HTMLButtonElement>('[data-zoom-input]').forEach((button) => button.addEventListener('click', () => this.changeZoom('input', button.dataset.zoomInput || 'fit')));
    doc.querySelectorAll<HTMLButtonElement>('[data-zoom-output]').forEach((button) => button.addEventListener('click', () => this.changeZoom('output', button.dataset.zoomOutput || 'fit')));
    doc.getElementById('ivCropButton')?.addEventListener('click', () => { const crop = doc.getElementById('ivCropControls'); if (crop) crop.hidden = !crop.hidden; });
    doc.getElementById('ivEditButton')?.addEventListener('click', () => { const edit = doc.getElementById('ivEditControls'); if (edit) edit.hidden = !edit.hidden; });
    this.bindRanges();
    doc.getElementById('ivCopyButton')?.addEventListener('click', () => void this.copySvg());
    doc.getElementById('ivDownloadButton')?.addEventListener('click', () => void this.downloadSelected());
    doc.getElementById('ivDownloadSvg')?.addEventListener('click', () => void this.download('svg'));
    doc.getElementById('ivReset')?.addEventListener('click', () => this.reset());
  }

  private bindRanges() {
    const doc = getClickerDocument();
    const bind = (id: string, onValue: (value: number) => void, outputId?: string, format: (value: number) => string = (value) => `${value}`) => {
      doc.getElementById(id)?.addEventListener('input', (event) => {
        const value = Number((event.target as HTMLInputElement).value);
        onValue(value);
        const output = outputId ? doc.getElementById(outputId) : null;
        if (output) output.textContent = format(value);
        this.scheduleBuild();
      });
    };
    bind('ivColorCount', (value) => { this.settings.colorCount = value; this.settings.paletteName = 'auto'; }, 'ivColorCountValue');
    bind('ivRoundness', (value) => { this.settings.roundness = value / 100; }, 'ivRoundnessValue', (value) => `${value}%`);
    bind('ivOutputSize', (value) => { this.settings.outputWidthMm = value; }, 'ivOutputSizeValue', (value) => `${value} mm`);
    bind('ivOutlineWidth', (value) => { this.settings.outlineWidth = value; }, 'ivOutlineWidthValue', (value) => `${value.toFixed(1)} mm`);
    bind('ivCropX', (value) => { this.settings.crop.x = value; }, 'ivCropXValue', (value) => `${value}%`);
    bind('ivCropY', (value) => { this.settings.crop.y = value; }, 'ivCropYValue', (value) => `${value}%`);
    bind('ivCropWidth', (value) => { this.settings.crop.width = value; }, 'ivCropWidthValue', (value) => `${value}%`);
    bind('ivCropHeight', (value) => { this.settings.crop.height = value; }, 'ivCropHeightValue', (value) => `${value}%`);
    const edit = (id: string, key: keyof VectorizerSettings['edit'], outputId: string) => bind(id, (value) => { this.settings.edit[key] = value / 100; }, outputId, (value) => `${value}%`);
    edit('ivFilterBrightness', 'brightness', 'ivFilterBrightnessValue'); edit('ivFilterContrast', 'contrast', 'ivFilterContrastValue'); edit('ivFilterSaturation', 'saturation', 'ivFilterSaturationValue');
    edit('ivBrightness', 'brightness', 'ivBrightnessValue'); edit('ivContrast', 'contrast', 'ivContrastValue'); edit('ivSaturation', 'saturation', 'ivSaturationValue');
    const selects: Array<[string, keyof VectorizerSettings]> = [['ivAntiAliasing', 'antiAliasing'], ['ivNoiseReduction', 'noiseReduction'], ['ivUpscaling', 'upscaling'], ['ivMinimumArea', 'minimumArea'], ['ivOverlap', 'overlap']];
    for (const [id, key] of selects) doc.getElementById(id)?.addEventListener('change', (event) => { const value = (event.target as HTMLSelectElement).value; (this.settings as unknown as Record<string, unknown>)[key] = key === 'upscaling' ? Number(value) : value; this.scheduleBuild(); });
    for (const [id, key] of [['ivCircleDetection', 'circleDetection'], ['ivAddOutline', 'addOutline'], ['ivMaxFileSize', 'maxFileSize']] as const) doc.getElementById(id)?.addEventListener('change', (event) => { (this.settings as unknown as Record<string, unknown>)[key] = (event.target as HTMLInputElement).checked; this.scheduleBuild(); });
  }

  private async loadFile(file: File) {
    if (!file.type.startsWith('image/') && !/\.(png|jpe?g|bmp|webp)$/i.test(file.name)) {
      this.setStatus(tx('Only raster image files are supported in this workspace.', 'Workspace này chỉ hỗ trợ file ảnh raster.'));
      return;
    }
    try {
      this.setStatus(tx('Reading image…', 'Đang đọc ảnh…'));
      const image = await loadFileToImage(file, 1600);
      this.input = { name: file.name, type: file.type, image, original: copyImage(image), dataUrl: imageToDataUrl(image) };
      this.settings.crop = { x: 0, y: 0, width: 100, height: 100 };
      const doc = getClickerDocument();
      const dimensions = doc.getElementById('ivInputDimensions'); if (dimensions) dimensions.textContent = `${image.width} × ${image.height}px · ${file.name}`;
      const empty = doc.getElementById('ivInputEmpty'); if (empty) empty.style.display = 'none';
      this.drawInput(); this.scheduleBuild(true);
    } catch (error) {
      this.setStatus(`${tx('Could not read image', 'Không thể đọc ảnh')}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private drawInput() {
    if (!this.input) return;
    const canvas = getClickerDocument().getElementById('ivInputCanvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    canvas.width = this.input.image.width; canvas.height = this.input.image.height;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.putImageData(new ImageData(this.input.image.data as unknown as ImageDataArray, this.input.image.width, this.input.image.height), 0, 0);
    canvas.style.transform = `scale(${this.inputZoom})`;
  }

  private scheduleBuild(immediate = false) {
    window.clearTimeout(this.buildTimer);
    this.buildTimer = window.setTimeout(() => void this.build(), immediate ? 0 : 100);
  }

  private async build() {
    if (!this.input) return;
    const id = ++this.buildId;
    this.setStatus(tx('Vectorizing…', 'Đang chuyển vector…'));
    try {
      const result = await vectorizeImage(this.input, this.settings);
      if (id !== this.buildId) return;
      this.result = result;
      const doc = getClickerDocument();
      const preview = doc.getElementById('ivOutputPreview'); if (preview) preview.innerHTML = result.svg;
      const empty = doc.getElementById('ivOutputEmpty'); if (empty) empty.style.display = 'none';
      const stats = doc.getElementById('ivOutputStats'); if (stats) stats.textContent = `${result.widthMm.toFixed(1)} × ${result.heightMm.toFixed(1)} mm · ${result.regionCount} colors`;
      const count = doc.getElementById('ivOutputColorCount'); if (count) count.textContent = `${result.regionCount}`;
      const paths = doc.getElementById('ivOutputPathCount'); if (paths) paths.textContent = `${result.pathCount} paths · ${(new Blob([result.svg]).size / 1024).toFixed(1)} KB`;
      this.renderOutputColors(result.svg);
      this.applyZoom('output');
      this.setStatus(`${tx('Ready', 'Sẵn sàng')} · ${result.regionCount} ${tx('colors', 'màu')} · ${result.pathCount} paths`);
    } catch (error) {
      this.setStatus(`${tx('Vectorization failed', 'Chuyển vector thất bại')}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private renderPalette() {
    const doc = getClickerDocument();
    const presets = this.settings.paletteName === 'auto' ? this.settings.customPalette : this.settings.paletteName === 'custom' ? this.settings.customPalette : PALETTE_PRESETS[this.settings.paletteName];
    const target = doc.getElementById('ivPaletteSwatches'); if (target) target.innerHTML = presets.map((color) => `<span class="iv-color-chip" style="background:${rgbHex(color)}"></span>`).join('');
    const list = doc.getElementById('ivCustomPaletteList'); if (list) list.innerHTML = this.settings.customPalette.map((color) => `<span style="background:${rgbHex(color)}"></span>`).join('');
    doc.querySelectorAll<HTMLElement>('[data-palette]').forEach((node) => node.classList.toggle('active', node.dataset.palette === this.settings.paletteName));
  }

  private renderOutputColors(svg: string) {
    const colors = [...new Set([...svg.matchAll(/(?:fill|stop-color)="(#[0-9a-f]{6})"/gi)].map((match) => match[1]))];
    const target = getClickerDocument().getElementById('ivOutputColors');
    if (target) target.innerHTML = colors.map((color) => `<span class="iv-color-chip" style="background:${color}"></span>`).join('');
  }

  private changeZoom(side: 'input' | 'output', action: string) {
    const value = side === 'input' ? this.inputZoom : this.outputZoom;
    const next = action === 'in' ? Math.min(2.4, value * 1.2) : action === 'out' ? Math.max(0.45, value / 1.2) : 1;
    if (side === 'input') this.inputZoom = next; else this.outputZoom = next;
    this.applyZoom(side);
  }

  private applyZoom(side: 'input' | 'output') {
    const element = getClickerDocument().getElementById(side === 'input' ? 'ivInputCanvas' : 'ivOutputPreview') as HTMLElement | null;
    if (element) element.style.transform = `scale(${side === 'input' ? this.inputZoom : this.outputZoom})`;
  }

  private async copySvg() {
    if (!this.result) return;
    try { await navigator.clipboard.writeText(this.result.svg); this.setStatus(tx('SVG copied to clipboard.', 'Đã sao chép SVG vào clipboard.')); }
    catch { this.setStatus(tx('Clipboard access is unavailable.', 'Không thể truy cập clipboard.')); }
  }

  private async downloadSelected() {
    const format = (getClickerDocument().getElementById('ivDownloadFormat') as HTMLSelectElement | null)?.value || 'svg';
    await this.download(format);
  }

  private async download(format: string) {
    if (!this.result || !this.input) return;
    const base = safeName(this.input.name);
    if (format === 'svg') downloadBlob(new Blob([this.result.svg], { type: 'image/svg+xml' }), `${base}.svg`);
    else if (format === 'json') downloadBlob(new Blob([JSON.stringify({ name: this.input.name, settings: this.settings, svg: this.result.svg }, null, 2)], { type: 'application/json' }), `${base}.vector.json`);
    else if (format === 'png') await this.downloadPng(`${base}.png`);
    this.setStatus(`${tx('Downloaded', 'Đã tải xuống')} · ${format.toUpperCase()}`);
  }

  private async downloadPng(fileName: string) {
    if (!this.result) return;
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(this.result.svg)}`;
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('PNG render failed')); });
    const canvas = getClickerDocument().createElement('canvas');
    const width = Math.max(1, Math.round(this.result.widthMm * 10)); const height = Math.max(1, Math.round(this.result.heightMm * 10));
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) downloadBlob(blob, fileName);
  }

  private setStatus(message: string) { const status = getClickerDocument().getElementById('ivStatus'); if (status) status.textContent = message; }

  private reset() {
    this.buildId++;
    this.input = null; this.result = null; this.settings = structuredClone(DEFAULT_VECTORIZER_SETTINGS); this.inputZoom = 1; this.outputZoom = 1;
    this.start();
  }

  destroy() {
    window.clearTimeout(this.buildTimer); this.buildId++;
    if (activeController === this) activeController = null;
  }
}
