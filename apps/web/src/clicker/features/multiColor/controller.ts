import { clickerText as rawTx } from '../../i18n';
import { getClickerDocument } from '../../runtime';
import { loadFileToImage, type RgbaImage } from '../../image/decode';
import { quantize } from '../../image/quantize';
import { traceRegions } from '../../image/trace';
import { consolidateMultiColorPalette } from './segmentation';
import { downloadSTLObjectsZip } from './export/stlExport';
import { downloadThreeMFObjects } from './export/threemfExport';
import { createViewer, type Viewer } from '../../viewer/viewer';
import type { ClickerPart } from '../../types';
import { DEFAULT_MULTI_COLOR_SETTINGS, type MultiColorDocument, type MultiColorLayout, type MultiColorSettings } from './model';
import { buildMultiColorParts } from './geometry';
import { orderMultiColorRegions } from './layerOrder';
import { removeBorderBackground } from './background';
import { renderMultiColor, renderMultiColorPalette } from './view';

let activeController: MultiColorController | null = null;

function tx(english: string, vietnamese: string): string {
  const value = rawTx(english, vietnamese);
  if (!/[ÃƒÃ‚Ã„Ã…Ã†Ã¡Ã Ã¢Ã¤Ã¥Ã¦Ã§Ã¨Ã©ÃªÃ«Ã¬Ã­Ã®Ã¯Ã°Ã±Ã²Ã³Ã´ÃµÃ¶Ã¹ÃºÃ»Ã¼Ã½Ã¿Æ’]/.test(value)) return value;
  const bytes = Uint8Array.from(value, (character) => character === 'Æ’' ? 0x83 : character.charCodeAt(0) & 0xff);
  return new TextDecoder().decode(bytes);
}

function safeName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'formaforge-multi-color';
}

function copySettings(): MultiColorSettings {
  return { ...DEFAULT_MULTI_COLOR_SETTINGS };
}

export interface MultiColorController { destroy(): void; }

export function bootstrapMultiColor(): MultiColorController {
  activeController?.destroy();
  const controller = new MultiColorControllerImpl();
  activeController = controller;
  controller.start();
  return controller;
}

class MultiColorControllerImpl implements MultiColorController {
  private source: RgbaImage | null = null;
  private sourceName = 'multi-color-image';
  private document: MultiColorDocument | null = null;
  private settings = copySettings();
  private parts: ClickerPart[] = [];
  private viewer: Viewer | null = null;
  private viewport: HTMLElement | null = null;
  private buildTimer = 0;
  private buildId = 0;
  private autoColorCount = true;

  start() {
    const doc = getClickerDocument();
    doc.title = tx('Multi Color · FormaForgeDT', 'Ảnh đa màu · FormaForgeDT');
    doc.documentElement.setAttribute('data-theme', 'dark');
    doc.body.innerHTML = renderMultiColor(this.settings);
    this.viewport = doc.getElementById('multiColorViewport');
    this.mountViewer();
    this.bindUi();
    this.syncUi();
  }

  private mountViewer() {
    if (!this.viewport) return;
    this.viewer?.dispose();
    this.viewer = createViewer(this.viewport);
    this.viewer.setView('assembled');
    if (this.parts.length) this.viewer.setParts(this.parts, true);
  }

  private bindUi() {
    const doc = getClickerDocument();
    const fileInput = doc.getElementById('multiColorFile') as HTMLInputElement | null;
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (file) void this.loadFile(file);
    });
    const drop = doc.getElementById('multiColorDrop');
    drop?.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('dragging'); });
    drop?.addEventListener('dragleave', () => drop.classList.remove('dragging'));
    drop?.addEventListener('drop', (event) => {
      event.preventDefault();
      drop.classList.remove('dragging');
      const file = (event as DragEvent).dataTransfer?.files?.[0];
      if (file) void this.loadFile(file);
    });

    this.bindRange('multiColorCount', (value) => {
      this.settings.colorCount = Math.round(value);
      this.autoColorCount = false;
    }, 'multiColorCountValue', (value) => `${Math.round(value)}`, true);
    this.bindRange('multiColorSmoothing', (value) => { this.settings.smoothing = value; }, 'multiColorSmoothingValue', (value) => `${Math.round(value * 100)}%`, true);
    this.bindRange('multiColorSize', (value) => { this.settings.targetSizeMm = value; }, 'multiColorSizeValue', (value) => `${value.toFixed(0)} mm`);
    this.bindRange('multiColorLayer', (value) => { this.settings.layerHeightMm = value; }, 'multiColorLayerValue', (value) => `${value.toFixed(2)} mm`);
    this.bindRange('multiColorGap', (value) => { this.settings.layerGapMm = value; }, 'multiColorGapValue', (value) => `${value.toFixed(2)} mm`);
    this.bindRange('multiColorBase', (value) => { this.settings.baseThicknessMm = value; }, 'multiColorBaseValue', (value) => `${value.toFixed(1)} mm`);
    this.bindRange('multiColorPadding', (value) => { this.settings.paddingMm = value; }, 'multiColorPaddingValue', (value) => `${value.toFixed(1)} mm`);
    this.bindToggle('multiColorRemoveBackground', (value) => { this.settings.removeBackground = value; }, true);
    this.bindToggle('multiColorIncludeBase', (value) => { this.settings.includeBase = value; });
    this.bindToggle('multiColorKeychainEnabled', (value) => { this.settings.keychainEnabled = value; });
    this.bindRange('multiColorKeychainWidth', (value) => { this.settings.keychainWidthMm = value; }, 'multiColorKeychainWidthValue', (value) => `${value.toFixed(1)} mm`);
    this.bindRange('multiColorKeychainThickness', (value) => { this.settings.keychainThicknessMm = value; }, 'multiColorKeychainThicknessValue', (value) => `${value.toFixed(1)} mm`);
    this.bindRange('multiColorKeychainX', (value) => { this.settings.keychainOffsetXMm = value; }, 'multiColorKeychainXValue', (value) => `${value.toFixed(0)} mm`);
    this.bindRange('multiColorKeychainY', (value) => { this.settings.keychainOffsetYMm = value; }, 'multiColorKeychainYValue', (value) => `${value.toFixed(0)} mm`);
    this.bindToggle('multiColorExportStacked', (value) => { this.settings.exportStacked = value; });
    const palette = doc.getElementById('multiColorPalette');
    palette?.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-multi-order]');
      if (!button) return;
      event.preventDefault();
      this.moveLayer(Number(button.dataset.multiLayerIndex), button.dataset.multiOrder === 'up' ? 1 : -1);
    });
    palette?.addEventListener('dragstart', (event) => {
      const row = (event.target as HTMLElement).closest<HTMLElement>('[data-multi-layer-index]');
      const index = row?.dataset.multiLayerIndex;
      if (index !== undefined) event.dataTransfer?.setData('text/plain', index);
    });
    palette?.addEventListener('dragover', (event) => event.preventDefault());
    palette?.addEventListener('drop', (event) => {
      event.preventDefault();
      const row = (event.target as HTMLElement).closest<HTMLElement>('[data-multi-layer-index]');
      const from = Number(event.dataTransfer?.getData('text/plain'));
      const to = Number(row?.dataset.multiLayerIndex);
      if (Number.isInteger(from) && Number.isInteger(to)) this.moveLayerTo(from, from < to ? to - 1 : to);
    });
    doc.getElementById('multiColorRecommendedOrder')?.addEventListener('click', () => this.restoreRecommendedOrder());

    doc.querySelectorAll<HTMLButtonElement>('[data-multi-layout]').forEach((button) => button.addEventListener('click', () => {
      this.settings.layout = (button.dataset.multiLayout === 'stacked' ? 'stacked' : 'flat') as MultiColorLayout;
      this.syncLayoutButtons();
      this.rebuild();
    }));
    doc.getElementById('multiColorExportStl')?.addEventListener('click', () => {
      const exportParts = this.getExportParts();
      if (exportParts.length) downloadSTLObjectsZip(exportParts, `${safeName(this.document?.name || '')}.stl`);
    });
    doc.getElementById('multiColorExport3mf')?.addEventListener('click', () => {
      const exportParts = this.getExportParts();
      if (exportParts.length) downloadThreeMFObjects(exportParts, `${safeName(this.document?.name || '')}.3mf`);
    });
    doc.getElementById('multiColorReset')?.addEventListener('click', () => this.reset());
  }

  private bindRange(id: string, onValue: (value: number) => void, outputId: string, format: (value: number) => string, reprocess = false) {
    getClickerDocument().getElementById(id)?.addEventListener('input', (event) => {
      const value = Number((event.target as HTMLInputElement).value);
      onValue(value);
      const output = getClickerDocument().getElementById(outputId);
      if (output) output.textContent = format(value);
      if (reprocess) this.scheduleProcess(); else this.rebuild();
    });
  }

  private bindToggle(id: string, onValue: (value: boolean) => void, reprocess = false) {
    getClickerDocument().getElementById(id)?.addEventListener('change', (event) => {
      onValue((event.target as HTMLInputElement).checked);
      if (reprocess) this.scheduleProcess(); else this.rebuild();
    });
  }

  private async loadFile(file: File) {
    if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|bmp|svg)$/i.test(file.name)) {
      this.setStatus(tx('Only raster images are supported in this workspace.', 'Workspace này chỉ hỗ trợ ảnh raster.'));
      return;
    }
    try {
      this.setStatus(tx('Reading image…', 'Đang đọc ảnh…'));
       this.source = await loadFileToImage(file, 1800);
       this.sourceName = file.name;
       this.autoColorCount = true;
      this.document = null;
      const fileName = getClickerDocument().getElementById('multiColorFileName');
      if (fileName) fileName.textContent = `${file.name} · ${this.source.width} × ${this.source.height}px`;
      this.scheduleProcess(true);
    } catch (error) {
      this.source = null;
      this.setStatus(`${tx('Could not read image', 'Không thể đọc ảnh')}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getExportParts(): ClickerPart[] {
    if (!this.parts.length || !this.document) return [];
    return buildMultiColorParts(this.document, {
      ...this.settings,
      layout: this.settings.exportStacked ? 'stacked' : 'flat',
    });
  }

  private scheduleProcess(immediate = false) {
    window.clearTimeout(this.buildTimer);
    this.buildTimer = window.setTimeout(() => void this.process(), immediate ? 0 : 90);
  }

  private async process() {
    if (!this.source) return;
    const requestId = ++this.buildId;
    this.setStatus(tx('Detecting colour regions…', 'Đang nhận diện các vùng màu…'));
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      // Opaque raster canvases often quantize their white matte as a real
      // printable layer. Keep white details inside the artwork, but remove a
      // large white component connected to the image border.
       // A new import is analysed with the full available palette first. The
       // detected printable layer count is written back to the UI below; it is
       // not constrained by the previous/default value of the range control.
       const analysisColorCount = this.autoColorCount ? 16 : this.settings.colorCount;
       const quantized = consolidateMultiColorPalette(
         quantize(this.source, analysisColorCount, undefined, { preserveRareColors: true }),
       );
       const processed = this.settings.removeBackground ? removeBorderBackground(quantized) : quantized;
       const minimumComponentPixels = Math.max(32, Math.round(processed.width * processed.height * 0.00003));
       const traced = traceRegions(processed, this.settings.smoothing, true, {
         // Consolidated palette labels are stable enough to clean tiny
         // antialiasing specks while retaining real small accents.
         preserveSmallComponents: false,
         minimumComponentPixels,
         minimumRingAreaFactor: 0.00005,
       });
      // Keep the physical layer order visible in the palette and keychain selector.
      // Keep the visible palette order aligned with the physical stack:
      // yellow underlay, red artwork, white details, then blue background.
      const regionSet = {
        ...traced,
        regions: orderMultiColorRegions(traced.regions),
      };
      if (requestId !== this.buildId) return;
       const palette = regionSet.regions.map((region) => ({ rgb: region.quantRgb, coverage: region.coverage }));
       this.document = { name: this.sourceName, width: processed.width, height: processed.height, regionSet, palette };
       if (this.autoColorCount) {
         this.settings.colorCount = Math.max(1, Math.min(16, regionSet.regions.length));
       }
       this.renderPalette();
      this.syncOptions();
      this.rebuild();
    } catch (error) {
      this.document = null;
      this.parts = [];
      this.syncExportButtons(false);
      this.setStatus(`${tx('Colour separation failed', 'Tách màu thất bại')}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private rebuild() {
    if (!this.document) {
      this.parts = [];
      this.syncExportButtons(false);
      this.syncEmptyState();
      return;
    }
    const requestId = ++this.buildId;
    this.setStatus(tx('Building colour layers…', 'Đang dựng các lớp màu…'));
    window.setTimeout(() => {
      if (requestId !== this.buildId || !this.document) return;
      try {
        const parts = buildMultiColorParts(this.document, this.settings);
        if (!parts.length) throw new Error('No closed regions were found');
        this.parts = parts;
        this.viewer?.setParts(this.parts, true);
        this.viewer?.setView('assembled');
        this.syncExportButtons(true);
        this.syncEmptyState();
        const layerCount = this.parts.filter((part) => part.group === 'top' && part.name.startsWith('multi-color-layer-')).length;
         const baseLabel = this.settings.includeBase ? tx('+ Base', '+ Đế') : tx('Base off', 'Tắt đế');
         this.setStatus(`${tx('Ready', 'Sẵn sàng')} · ${layerCount} ${tx('colour layers', 'lớp màu')} · ${baseLabel} · ${this.settings.layout}`);
      } catch (error) {
        this.parts = [];
        this.syncExportButtons(false);
        this.setStatus(`${tx('Could not build printable layers', 'Không thể dựng các lớp in')}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, 0);
  }

  private renderPalette() {
    const palette = getClickerDocument().getElementById('multiColorPalette');
    if (palette) palette.innerHTML = renderMultiColorPalette(this.document?.palette || []);
  }

  private moveLayer(from: number, delta: number) {
    if (!this.document || !Number.isInteger(from) || delta === 0) return;
    const regions = this.document.regionSet.regions;
    const to = Math.max(0, Math.min(regions.length - 1, from + delta));
    this.moveLayerTo(from, to);
  }

  private moveLayerTo(from: number, requestedTo: number) {
    if (!this.document || !Number.isInteger(from) || !Number.isInteger(requestedTo)) return;
    const regions = this.document.regionSet.regions;
    const to = Math.max(0, Math.min(regions.length - 1, requestedTo));
    if (to === from || !regions[from] || !regions[to]) return;
    const [region] = regions.splice(from, 1);
    const [paletteEntry] = this.document.palette.splice(from, 1);
    regions.splice(to, 0, region);
    this.document.palette.splice(to, 0, paletteEntry);
    this.renderPalette();
    this.rebuild();
  }

  private restoreRecommendedOrder() {
    if (!this.document) return;
    const regions = this.document.regionSet.regions;
    const orderedRegions = orderMultiColorRegions(regions);
    this.document.regionSet.regions = orderedRegions;
    this.document.palette = orderedRegions.map((region) => ({ rgb: region.quantRgb, coverage: region.coverage }));
    this.renderPalette();
    this.rebuild();
  }

  private syncUi() {
    this.renderPalette();
    this.syncOptions();
    this.syncLayoutButtons();
    this.syncEmptyState();
    this.syncExportButtons(false);
  }

  private syncOptions() {
    const doc = getClickerDocument();
    const setChecked = (id: string, value: boolean) => {
      const input = doc.getElementById(id) as HTMLInputElement | null;
      if (input) input.checked = value;
    };

    setChecked('multiColorRemoveBackground', this.settings.removeBackground);
    setChecked('multiColorIncludeBase', this.settings.includeBase);
    setChecked('multiColorKeychainEnabled', this.settings.keychainEnabled);
    setChecked('multiColorExportStacked', this.settings.exportStacked);

    const countInput = doc.getElementById('multiColorCount') as HTMLInputElement | null;
    if (countInput) countInput.value = String(this.settings.colorCount);
    const countOutput = doc.getElementById('multiColorCountValue');
    if (countOutput) countOutput.textContent = String(this.settings.colorCount);

  }

  private syncLayoutButtons() {
    getClickerDocument().querySelectorAll<HTMLElement>('[data-multi-layout]').forEach((button) => button.classList.toggle('active', button.dataset.multiLayout === this.settings.layout));
  }

  private syncEmptyState() {
    const empty = getClickerDocument().getElementById('multiColorEmpty');
    if (empty) empty.style.display = this.parts.length ? 'none' : 'grid';
  }

  private syncExportButtons(enabled: boolean) {
    for (const id of ['multiColorExportStl', 'multiColorExport3mf']) (getClickerDocument().getElementById(id) as HTMLButtonElement | null)?.toggleAttribute('disabled', !enabled);
  }

  private setStatus(message: string) {
    const status = getClickerDocument().getElementById('multiColorStatus');
    if (status) status.textContent = message;
  }

  private reset() {
    this.buildId++;
    this.source = null;
    this.sourceName = 'multi-color-image';
    this.autoColorCount = true;
    this.document = null;
    this.parts = [];
    this.settings = copySettings();
    this.start();
  }

  destroy() {
    window.clearTimeout(this.buildTimer);
    this.buildId++;
    this.viewer?.dispose();
    this.viewer = null;
    if (activeController === this) activeController = null;
  }
}
