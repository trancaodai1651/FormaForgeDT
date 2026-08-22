import { getClickerDocument } from '../../runtime';
import { clickerText as tx } from '../../i18n';
import { createViewer, type Viewer } from '../../viewer/viewer';
import { downloadSTLSplit, downloadThreeMF } from '../../export';
import type { ClickerPart, RGB } from '../../types';
import { DEFAULT_SVG_LAYERS_SETTINGS, type SvgLayerAssignment, type SvgLayerDocument, type SvgLayersSettings } from './model';
import { buildSvgLayerParts } from './geometry';
import { parseSvgLayers } from './parser';
import { renderSvgLayerList, renderSvgLayers } from './view';

let activeController: SvgLayersController | null = null;

function hexToRgb(hex: string): RGB {
  const value = hex.replace('#', '');
  return [0, 1, 2].map((index) => Number.parseInt(value.slice(index * 2, index * 2 + 2), 16) || 0) as RGB;
}

function safeName(name: string): string {
  return name.replace(/\.svg$/i, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'svg-layers';
}

export interface SvgLayersController { destroy(): void; }

export function bootstrapSvgLayers(): SvgLayersController {
  activeController?.destroy();
  const controller = new SvgLayersControllerImpl();
  activeController = controller;
  controller.start();
  return controller;
}

class SvgLayersControllerImpl implements SvgLayersController {
  private document: SvgLayerDocument | null = null;
  private settings: SvgLayersSettings = { ...DEFAULT_SVG_LAYERS_SETTINGS };
  private selectedLayerId: string | null = null;
  private parts: ClickerPart[] = [];
  private viewer: Viewer | null = null;
  private viewport: HTMLElement | null = null;
  private rebuildId = 0;

  start() {
    const doc = getClickerDocument();
    doc.title = tx('SVG Layers · FormaForgeDT', 'Tách lớp SVG · FormaForgeDT');
    doc.documentElement.setAttribute('data-theme', 'dark');
    doc.body.innerHTML = renderSvgLayers(this.settings);
    this.viewport = doc.getElementById('svgLayersViewport');
    this.mountViewer();
    this.bindUi();
  }

  private mountViewer() {
    if (!this.viewport) return;
    this.viewer?.dispose();
    this.viewer = createViewer(this.viewport);
    this.viewer.setView('assembled');
  }

  private bindUi() {
    const doc = getClickerDocument();
    const fileInput = doc.getElementById('svgLayersFile') as HTMLInputElement | null;
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (file) void this.loadFile(file);
    });
    const drop = doc.getElementById('svgLayersDrop');
    drop?.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('dragging'); });
    drop?.addEventListener('dragleave', () => drop.classList.remove('dragging'));
    drop?.addEventListener('drop', (event) => {
      event.preventDefault();
      drop.classList.remove('dragging');
      const file = (event as DragEvent).dataTransfer?.files?.[0];
      if (file) void this.loadFile(file);
    });

    doc.getElementById('svgLayersList')?.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-select-layer]');
      const id = target?.dataset.selectLayer;
      if (id) this.selectLayer(id);
    });
    doc.getElementById('svgLayersPreview')?.addEventListener('click', (event) => {
      const element = (event.target as Element).closest<SVGElement>('[data-ff-svg-layer]');
      const id = element?.getAttribute('data-ff-svg-layer');
      if (id) this.selectLayer(id);
    });
    doc.querySelectorAll<HTMLButtonElement>('[data-assign]').forEach((button) => button.addEventListener('click', () => {
      this.assignSelected(button.dataset.assign as SvgLayerAssignment);
    }));

    const rangeFields: Array<[string, keyof Pick<SvgLayersSettings, 'targetSizeMm' | 'baseDepthMm' | 'topDepthMm' | 'topOffsetMm'>, number]> = [
      ['svgLayersSize', 'targetSizeMm', 0],
      ['svgLayersBaseDepth', 'baseDepthMm', 1],
      ['svgLayersTopDepth', 'topDepthMm', 1],
      ['svgLayersTopOffset', 'topOffsetMm', 2],
    ];
    for (const [id, key, decimals] of rangeFields) {
      doc.getElementById(id)?.addEventListener('input', (event) => {
        const value = Number((event.target as HTMLInputElement).value);
        this.settings = { ...this.settings, [key]: value };
        const output = doc.getElementById(`${id}Value`);
        if (output) output.textContent = `${value.toFixed(decimals)} mm`;
        this.rebuild();
      });
    }
    doc.getElementById('svgLayersBaseColor')?.addEventListener('input', (event) => { this.settings.baseColor = hexToRgb((event.target as HTMLInputElement).value); this.rebuild(); });
    doc.getElementById('svgLayersTopColor')?.addEventListener('input', (event) => { this.settings.topColor = hexToRgb((event.target as HTMLInputElement).value); this.rebuild(); });
    doc.getElementById('svgLayersSourceColors')?.addEventListener('change', (event) => { this.settings.topColorMode = (event.target as HTMLInputElement).checked ? 'source' : 'single'; this.rebuild(); });
    doc.getElementById('svgLayersExport3mf')?.addEventListener('click', () => { if (this.parts.length) downloadThreeMF(this.parts, `${safeName(this.document?.name || '')}.3mf`); });
    doc.getElementById('svgLayersExportStl')?.addEventListener('click', () => { if (this.parts.length) downloadSTLSplit(this.parts, `${safeName(this.document?.name || '')}.stl`); });
    doc.getElementById('svgLayersReset')?.addEventListener('click', () => this.reset());
  }

  private async loadFile(file: File) {
    if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
      this.setStatus(tx('This workspace only supports SVG files.', 'Workspace này chỉ hỗ trợ tệp SVG.'));
      return;
    }
    try {
      this.setStatus(tx('Reading SVG…', 'Đang đọc SVG…'));
      const source = await file.text();
      this.document = parseSvgLayers(source, file.name);
      this.selectedLayerId = this.document.layers.find((layer) => !layer.isBackground)?.id || this.document.layers[0]?.id || null;
      const fileName = getClickerDocument().getElementById('svgLayersFileName');
      if (fileName) fileName.textContent = `${file.name} · ${this.document.layers.length} vùng có thể chọn`;
      this.renderLayerUi();
      this.rebuild();
      this.setStatus(tx('SVG imported · assign at least one region to Base and one to Top.', 'Đã nhập SVG · hãy gán ít nhất một vùng làm Base và một vùng làm Top.'));
    } catch (error) {
      this.document = null;
      this.renderLayerUi();
      this.setStatus(`${tx('Could not read SVG', 'Không thể đọc SVG')}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private selectLayer(id: string) {
    if (!this.document?.layers.some((layer) => layer.id === id)) return;
    this.selectedLayerId = id;
    this.renderLayerUi();
    this.setStatus(`${tx('Selected', 'Đã chọn')}: ${this.document.layers.find((layer) => layer.id === id)?.label || id}`);
  }

  private assignSelected(assignment: SvgLayerAssignment) {
    if (!this.document || !this.selectedLayerId) return;
    const layer = this.document.layers.find((item) => item.id === this.selectedLayerId);
    if (!layer) return;
    layer.assignment = assignment;
    this.renderLayerUi();
    this.rebuild();
  }

  private renderLayerUi() {
    const doc = getClickerDocument();
    const preview = doc.getElementById('svgLayersPreview');
    if (preview) preview.innerHTML = this.document?.preview || '<span>Import an SVG to preview it.</span>';
    const list = doc.getElementById('svgLayersList');
    if (list) list.innerHTML = renderSvgLayerList(this.document, this.selectedLayerId);
    const empty = doc.getElementById('svgLayersEmpty');
    if (empty) empty.style.display = this.document ? 'none' : 'grid';
    const layerButtons = doc.querySelectorAll<HTMLButtonElement>('[data-assign]');
    layerButtons.forEach((button) => { button.disabled = !this.selectedLayerId; });
    if (this.selectedLayerId) {
      doc.querySelectorAll<SVGElement>('[data-ff-svg-layer]').forEach((element) => element.classList.toggle('active', element.getAttribute('data-ff-svg-layer') === this.selectedLayerId));
    }
  }

  private rebuild() {
    const requestId = ++this.rebuildId;
    if (!this.document) return;
    const baseCount = this.document.layers.filter((layer) => layer.assignment === 'base').length;
    const topCount = this.document.layers.filter((layer) => layer.assignment === 'top').length;
    if (!baseCount || !topCount) {
      this.clearGeneratedPreview();
      this.syncExportButtons(false);
      this.setStatus(tx('Assign a region to Base and a region to Top to build the model.', 'Hãy gán vùng làm Base và vùng làm Top để dựng hình.'));
      return;
    }
    this.setStatus(tx('Building Top and Base…', 'Đang dựng Top và Base…'));
    window.setTimeout(() => {
      if (requestId !== this.rebuildId || !this.document) return;
      this.parts = buildSvgLayerParts(this.document, this.settings);
      if (!this.parts.length) {
        this.syncExportButtons(false);
        this.setStatus(tx('The selected regions did not produce closed printable solids.', 'Các vùng đã chọn chưa tạo được hình khối kín.'));
        return;
      }
      this.viewer?.setParts(this.parts, true);
      this.viewer?.setView('assembled');
      this.syncExportButtons(true);
      this.setStatus(`${tx('Built', 'Đã dựng')} ${this.parts.length} ${tx('parts', 'phần')} · ${baseCount} Base · ${topCount} Top`);
    }, 0);
  }

  private clearGeneratedPreview() {
    this.parts = [];
    this.mountViewer();
  }

  private syncExportButtons(enabled: boolean) {
    for (const id of ['svgLayersExport3mf', 'svgLayersExportStl']) (getClickerDocument().getElementById(id) as HTMLButtonElement | null)?.toggleAttribute('disabled', !enabled);
  }

  private setStatus(message: string) {
    const status = getClickerDocument().getElementById('svgLayersStatus');
    if (status) status.textContent = message;
  }

  private reset() {
    this.rebuildId++;
    this.document = null;
    this.selectedLayerId = null;
    this.parts = [];
    this.settings = { ...DEFAULT_SVG_LAYERS_SETTINGS };
    this.mountViewer();
    this.renderLayerUi();
    this.syncExportButtons(false);
    this.setStatus(tx('Waiting for an SVG', 'Đang chờ tệp SVG'));
  }

  destroy() {
    this.rebuildId++;
    this.viewer?.dispose();
    this.viewer = null;
    if (activeController === this) activeController = null;
  }
}
