import { getClickerDocument } from '../../runtime';
import { zipSync } from 'fflate';
import { createViewer, type Viewer } from '../../viewer/viewer';
import { downloadThreeMF } from '../../export';
import { buildSTL } from '../../export/stlExport';
import { importFontFile, loadBundledFonts, FONT_OPTIONS } from '../../image/letter';
import type { ClickerPart, FlexKeychainSlot } from '../../types';
import { clampFlex, DEFAULT_FLEX, hexToRgb, splitName, type FlexKeychainConfig } from './model';
import { TargetGeometryLoader } from './targetGeometry';
import { renderFlexKeychain, renderFlexSlots } from './view';

let instance: FlexKeychainController | null = null;

function setClass(id: string, active: boolean) {
  getClickerDocument().getElementById(id)?.classList.toggle('active', active);
}

function downloadBytes(bytes: Uint8Array, name: string, type: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const link = getClickerDocument().createElement('a');
  link.href = url;
  link.download = name;
  getClickerDocument().body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cleanPartName(name: string): string {
  return name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'part';
}

function makeSlots(config: FlexKeychainConfig): FlexKeychainSlot[] {
  return splitName(config.name).map((ch, index) => {
    const old = config.slots[index];
    return {
      ch,
      rings: old?.rings ?? [],
      blank: old?.blank ?? false,
      capColorRgb: old?.capColorRgb ?? hexToRgb(config.capColor),
      glyphColorRgb: old?.glyphColorRgb ?? hexToRgb(config.glyphColor),
    };
  });
}

export interface FlexKeychainController { destroy(): void; }

export function bootstrapFlexKeychain(): FlexKeychainController {
  instance?.destroy();
  const controller = new FlexController();
  instance = controller;
  controller.start();
  return controller;
}

class FlexController implements FlexKeychainController {
  private config: FlexKeychainConfig = { ...DEFAULT_FLEX, slots: [] };
  private viewer: Viewer | null = null;
  private readonly geometry = new TargetGeometryLoader();
  private requestId = 0;
  private builtParts: ClickerPart[] = [];
  private modularSplit = false;

  start() {
    getClickerDocument().title = 'Flex Keychain Text';
    getClickerDocument().documentElement.setAttribute('data-theme', 'dark');
    this.config.slots = makeSlots(this.config);
    getClickerDocument().body.innerHTML = renderFlexKeychain(this.config, false, 'Loading exact Flex Keychain STL assetsâ€¦');
    const viewport = getClickerDocument().getElementById('flexViewport');
    if (!viewport) return;
    this.viewer = createViewer(viewport);
    this.viewer.onPartPick((index) => {
      if (index === null || this.config.baseType !== 'modular') return;
      if (this.builtParts[index]?.group !== 'base') return;
      this.modularSplit = !this.modularSplit;
      this.viewer?.setModularSplit(this.modularSplit, this.config.vertical);
    });
    this.bindUi();
    this.populateFonts();
    this.refreshSlots();
    this.rebuild();
  }

  private populateFonts() {
    const select = getClickerDocument().getElementById('flexFont') as HTMLSelectElement | null;
    if (!select) return;
    select.innerHTML = FONT_OPTIONS.map((font) => `<option value="${font.id}">${font.name}</option>`).join('');
    select.value = this.config.fontId;
    void loadBundledFonts((font) => {
      const option = getClickerDocument().createElement('option');
      option.value = font.id;
      option.textContent = font.name;
      select.appendChild(option);
    });
  }

  private bindUi() {
    const name = getClickerDocument().getElementById('flexName') as HTMLInputElement | null;
    name?.addEventListener('input', () => {
      this.config = clampFlex({ ...this.config, name: name.value, slots: makeSlots({ ...this.config, name: name.value }) });
      this.updateNameStatus();
      this.refreshSlots();
      this.rebuild();
    });
    getClickerDocument().getElementById('flexAssembled')?.addEventListener('click', () => { setClass('flexAssembled', true); setClass('flexExploded', false); this.viewer?.setView('assembled'); });
    getClickerDocument().getElementById('flexExploded')?.addEventListener('click', () => { setClass('flexAssembled', false); setClass('flexExploded', true); this.viewer?.setView('exploded'); });
    getClickerDocument().getElementById('flexShowSwitch')?.addEventListener('change', (event) => { this.config.showSwitch = (event.target as HTMLInputElement).checked; this.viewer?.showSwitch(this.config.showSwitch); });
    getClickerDocument().getElementById('flexPhysical')?.addEventListener('click', () => { this.config.switchStyle = 'physical'; setClass('flexPhysical', true); setClass('flexPrinted', false); this.rebuild(); });
    getClickerDocument().getElementById('flexPrinted')?.addEventListener('click', () => { this.config.switchStyle = 'printed'; setClass('flexPhysical', false); setClass('flexPrinted', true); this.rebuild(); });
    getClickerDocument().getElementById('flexCompact')?.addEventListener('click', () => { this.config.baseType = 'compact'; this.modularSplit = false; this.updateBaseMode(); this.rebuild(); });
    getClickerDocument().getElementById('flexModular')?.addEventListener('click', () => { this.config.baseType = 'modular'; this.modularSplit = false; this.updateBaseMode(); this.rebuild(); });
    getClickerDocument().getElementById('flexBubbly')?.addEventListener('click', () => { this.config.modularStyle = 'bubbly'; setClass('flexBubbly', true); setClass('flexBubblyV2', false); this.rebuild(); });
    getClickerDocument().getElementById('flexBubblyV2')?.addEventListener('click', () => { this.config.modularStyle = 'bubbly-v2'; setClass('flexBubbly', false); setClass('flexBubblyV2', true); this.rebuild(); });
    getClickerDocument().getElementById('flexLayout')?.addEventListener('change', (event) => { this.config.vertical = (event.target as HTMLSelectElement).value === 'vertical'; this.rebuild(); });

    const colors: Array<[string, keyof FlexKeychainConfig]> = [['flexBaseColor', 'baseColor'], ['flexCapColor', 'capColor'], ['flexGlyphColor', 'glyphColor']];
    for (const [id, key] of colors) getClickerDocument().getElementById(id)?.addEventListener('input', (event) => {
      const value = (event.target as HTMLInputElement).value;
      this.config = { ...this.config, [key]: value } as FlexKeychainConfig;
      if (key === 'capColor') this.config.slots = this.config.slots.map((slot) => ({ ...slot, capColorRgb: hexToRgb(value) }));
      if (key === 'glyphColor') this.config.slots = this.config.slots.map((slot) => ({ ...slot, glyphColorRgb: hexToRgb(value) }));
      this.refreshSlots();
      this.rebuild();
    });

    const numeric: Record<string, keyof FlexKeychainConfig> = {
      flexGap: 'gapMm', flexSideWall: 'moduleSideWallThicknessMm', flexBaseThickness: 'moduleThicknessMm', flexBaseRadius: 'baseCornerRadiusMm',
      flexFontSize: 'fontSize', flexLegendScale: 'legendScale', flexLegendBold: 'legendBold', flexKeycapUnit: 'keycapUnit', flexKeycapHeight: 'keycapHeightMm',
      flexKeycapGap: 'keycapGapMm', flexKeycapThickness: 'keycapThicknessMm', flexKeycapRadius: 'keycapCornerRadiusMm',
    };
    for (const input of Array.from(getClickerDocument().querySelectorAll<HTMLInputElement>('input[data-flex-field]'))) input.addEventListener('input', () => {
      const key = numeric[input.id];
      if (!key) return;
      this.config = clampFlex({ ...this.config, [key]: Number(input.value) });
      const output = getClickerDocument().getElementById(`${input.id}Value`);
      if (output) output.textContent = `${Number(input.value).toFixed(input.step && Number(input.step) < 1 ? 1 : 0)} ${input.id === 'flexFontSize' ? 'pt' : input.id === 'flexLegendScale' ? 'Ã—' : input.id === 'flexLegendBold' ? 'mm' : input.id === 'flexKeycapUnit' ? 'u' : 'mm'}`;
      this.rebuild();
    });
    for (const [id, key] of [['flexKeycapShape', 'keycapShape'], ['flexKeycapMount', 'keycapMount'], ['flexKeycapProfile', 'keycapProfile'], ['flexFont', 'fontId'] as const]) getClickerDocument().getElementById(id)?.addEventListener('change', (event) => {
      this.config = { ...this.config, [key]: (event.target as HTMLSelectElement).value } as FlexKeychainConfig;
      this.rebuild();
    });
    getClickerDocument().getElementById('flexFontUpload')?.addEventListener('change', async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try { const font = await importFontFile(file); this.config.fontId = font.id; this.setStatus(`Imported ${font.name}; built-in STL legends remain exact.`); } catch (error) { this.setStatus(`Font error: ${error instanceof Error ? error.message : String(error)}`); }
    });
    getClickerDocument().getElementById('flexSlots')?.addEventListener('change', (event) => this.updateSlot(event));
    getClickerDocument().getElementById('flexSlots')?.addEventListener('input', (event) => this.updateSlot(event));
    getClickerDocument().getElementById('flexExport3mf')?.addEventListener('click', () => { if (this.builtParts.length) downloadThreeMF(this.builtParts, `${this.config.name.toLowerCase() || 'keychain'}.3mf`); });
    getClickerDocument().getElementById('flexExportStl')?.addEventListener('click', () => this.exportStlZip());
    getClickerDocument().getElementById('flexTheme')?.addEventListener('click', () => { const next = getClickerDocument().documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; getClickerDocument().documentElement.setAttribute('data-theme', next); this.viewer?.setTheme(next); });
  }

  private updateSlot(event: Event) {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const row = target.closest<HTMLElement>('[data-slot]');
    const field = target.dataset.slotField;
    if (!row || !field) return;
    const slot = this.config.slots[Number(row.dataset.slot)];
    if (!slot) return;
    if (field === 'blank') slot.blank = target.value === 'true';
    if (field === 'capColor') slot.capColorRgb = hexToRgb(target.value);
    if (field === 'glyphColor') slot.glyphColorRgb = hexToRgb(target.value);
    this.refreshSlots();
    this.rebuild();
  }

  private updateBaseMode() {
    setClass('flexCompact', this.config.baseType === 'compact');
    setClass('flexModular', this.config.baseType === 'modular');
    getClickerDocument().getElementById('flexModularStyles')?.classList.toggle('hidden', this.config.baseType !== 'modular');
  }

  private refreshSlots() {
    const container = getClickerDocument().getElementById('flexSlots');
    if (container) container.innerHTML = renderFlexSlots(this.config);
    const count = getClickerDocument().getElementById('flexSlotCount');
    if (count) count.textContent = String(splitName(this.config.name).length);
  }

  private updateNameStatus() {
    const status = getClickerDocument().getElementById('flexNameStatus');
    if (status) status.textContent = `${splitName(this.config.name).length} printable slots Â· max 10 characters`;
  }

  private rebuild() {
    const requestId = ++this.requestId;
    this.builtParts = [];
    this.syncExportButtons();
    this.setStatus('Building exact source STL geometryâ€¦');
    const switchSeatZ = (this.config.baseType === 'modular' ? (this.config.modularStyle === 'bubbly' ? 5.364 : 5.013) : 8.499) + 5;
    void Promise.all([this.geometry.build(this.config), this.geometry.loadSwitch(this.config.switchStyle, switchSeatZ)]).then(([result, switchMesh]) => {
      if (requestId !== this.requestId) return;
      this.builtParts = result.parts;
      this.viewer?.setParts(result.parts);
      this.viewer?.setView(new URLSearchParams(window.location.search).get('view') === 'exploded' ? 'exploded' : 'assembled');
      this.viewer?.setSwitch(switchMesh);
      this.viewer?.setSwitchPlacements(result.switches);
      this.viewer?.setModularSplit(this.config.baseType === 'modular' && this.modularSplit, this.config.vertical);
      this.viewer?.showSwitch(this.config.showSwitch);
      this.setStatus('Ready Â· source base and keycap cutouts loaded');
      this.syncExportButtons();
    }).catch((error: unknown) => {
      if (requestId !== this.requestId) return;
      this.setStatus(`Build error: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  private syncExportButtons() {
    for (const id of ['flexExport3mf', 'flexExportStl']) (getClickerDocument().getElementById(id) as HTMLButtonElement | null)?.toggleAttribute('disabled', this.builtParts.length === 0);
  }

  private setStatus(message: string) {
    const element = getClickerDocument().getElementById('flexStatus');
    if (element) element.textContent = message;
  }

  private exportStlZip() {
    if (!this.builtParts.length) return;
    const files: Record<string, Uint8Array> = {};
    for (const part of this.builtParts) files[`${part.group}/${cleanPartName(part.name)}.stl`] = buildSTL([part]);
    downloadBytes(zipSync(files, { level: 6 }), `${this.config.name.toLowerCase() || 'keychain'}-stls.zip`, 'application/zip');
  }

  destroy() {
    this.requestId++;
    this.viewer?.dispose();
    this.viewer = null;
  }
}



