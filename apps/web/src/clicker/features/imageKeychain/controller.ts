import { getClickerDocument } from '../../runtime';
import { createViewer, type Viewer } from '../../viewer/viewer';
import { downloadSTL, downloadThreeMF } from '../../export';
import { loadFileToImage, type RgbaImage } from '../../image/decode';
import { processImage } from '../../image/pipeline';
import type { BuildParams, BuildRegion, ClickerPart, GeometryResponse, RegionSet, RGB } from '../../types';
import { DEFAULT_FLEX, splitName, type FlexKeychainConfig } from '../flexKeychain/model';
import { TargetGeometryLoader } from '../flexKeychain/targetGeometry';
import { clampImageKeychain, DEFAULT_IMAGE_KEYCHAIN, hexToRgb, keychainLetters, type ImageKeychainConfig, type ImageKeychainLanguage } from './model';
import { renderImageKeychain } from './view';

let instance: ImageKeychainController | null = null;

type Bounds3 = { min: [number, number, number]; max: [number, number, number] };

function clonePart(part: ClickerPart): ClickerPart {
  return { ...part, vertProperties: new Float32Array(part.vertProperties), triVerts: new Uint32Array(part.triVerts) };
}

function boundsOf(parts: ClickerPart[]): Bounds3 {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const part of parts) {
    for (let index = 0; index < part.vertProperties.length; index += part.numProp) {
      for (let axis = 0; axis < 3; axis++) {
        const value = part.vertProperties[index + axis];
        if (value < min[axis]) min[axis] = value;
        if (value > max[axis]) max[axis] = value;
      }
    }
  }
  if (!Number.isFinite(min[0])) return { min: [0, 0, 0], max: [0, 0, 0] };
  return { min, max };
}

function translateParts(parts: ClickerPart[], x: number, y: number, z: number): ClickerPart[] {
  return parts.map((source) => {
    const part = clonePart(source);
    for (let index = 0; index < part.vertProperties.length; index += part.numProp) {
      part.vertProperties[index] += x;
      part.vertProperties[index + 1] += y;
      part.vertProperties[index + 2] += z;
    }
    return part;
  });
}

function circleRing(points = 96, radius = .5): [number, number][] {
  return Array.from({ length: points }, (_, index) => {
    const angle = (index / points) * Math.PI * 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
}

function placeholderRegions(): RegionSet {
  const ring = circleRing();
  return { outline: [ring], aspect: 1, regions: [{ quantRgb: [242, 242, 238], coverage: 1, components: [{ rings: [ring], coverage: 1 }] }] };
}

function localLanguage(): ImageKeychainLanguage {
  return localStorage.getItem('hometown-language') === 'vi' ? 'vi' : 'en';
}

function flexConfig(config: ImageKeychainConfig): FlexKeychainConfig {
  const letters = keychainLetters(config.name);
  return {
    ...DEFAULT_FLEX,
    name: config.name,
    baseType: 'compact',
    vertical: true,
    showSwitch: false,
    baseColor: config.baseColor,
    capColor: config.capColor,
    glyphColor: config.glyphColor,
    slots: letters.map((letter) => ({ ch: letter, rings: [], blank: false, capColorRgb: hexToRgb(config.capColor), glyphColorRgb: hexToRgb(config.glyphColor) })),
  };
}

export interface ImageKeychainController { destroy(): void; }

export function bootstrapImageKeychain(): ImageKeychainController {
  instance?.destroy();
  const controller = new ImageNameKeychainController();
  instance = controller;
  controller.start();
  return controller;
}

class ImageNameKeychainController implements ImageKeychainController {
  private config: ImageKeychainConfig = { ...DEFAULT_IMAGE_KEYCHAIN };
  private language: ImageKeychainLanguage = localLanguage();
  private viewer: Viewer | null = null;
  private readonly geometry = new TargetGeometryLoader();
  private readonly worker = new Worker(new URL('../../workers/geometry.worker.ts', import.meta.url), { type: 'module' });
  private baseParts: ClickerPart[] = [];
  private badgeParts: ClickerPart[] = [];
  private builtParts: ClickerPart[] = [];
  private regionSet: RegionSet = placeholderRegions();
  private originalImage: RgbaImage | null = null;
  private imageUrl: string | null = null;
  private workerReady = false;
  private badgeRequestId = 0;
  private baseRequestId = 0;
  private baseTimer = 0;
  private badgeTimer = 0;
  private destroyed = false;
  private view: 'assembled' | 'exploded' = 'assembled';

  start() {
    this.worker.onmessage = (event: MessageEvent<GeometryResponse>) => this.onWorkerMessage(event.data);
    this.worker.onerror = (event) => this.setStatus(`Geometry worker: ${event.message}`);
    this.mount();
    this.worker.postMessage({ type: 'ping' });
  }

  private mount() {
    this.viewer?.dispose();
    getClickerDocument().title = 'Image Name Keychain';
    getClickerDocument().documentElement.setAttribute('data-theme', 'dark');
    getClickerDocument().body.innerHTML = renderImageKeychain(this.config, this.language, this.imageUrl, this.builtParts.length > 0);
    const viewport = getClickerDocument().getElementById('imageKeychainViewport');
    if (!viewport) return;
    this.viewer = createViewer(viewport);
    this.bindUi();
    if (this.builtParts.length) {
      this.viewer.setParts(this.builtParts);
      this.viewer.setView(this.view);
    }
    this.rebuildBase();
    if (this.workerReady) this.rebuildBadge();
  }

  private bindUi() {
    getClickerDocument().getElementById('imageKeychainLanguage')?.addEventListener('click', () => {
      this.language = this.language === 'vi' ? 'en' : 'vi';
      localStorage.setItem('hometown-language', this.language);
      this.mount();
    });
    getClickerDocument().getElementById('imageKeychainReset')?.addEventListener('click', () => this.reset());
    getClickerDocument().getElementById('imageKeychainFile')?.addEventListener('change', (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) void this.loadImage(file);
    });
    getClickerDocument().getElementById('imageKeychainName')?.addEventListener('input', (event) => {
      this.config = clampImageKeychain({ ...this.config, name: (event.target as HTMLInputElement).value });
      this.updateLetterReadout();
      window.clearTimeout(this.baseTimer);
      this.baseTimer = window.setTimeout(() => this.rebuildBase(), 180);
    });
    this.bindRange('imageKeychainWidth', 'imageWidthMm', true, 'mm');
    this.bindRange('imageKeychainThickness', 'badgeThicknessMm', true, 'mm');
    this.bindRange('imageKeychainRelief', 'imageDepthMm', true, 'mm');
    getClickerDocument().getElementById('imageKeychainColors')?.addEventListener('change', (event) => {
      this.config = clampImageKeychain({ ...this.config, colorCount: Number((event.target as HTMLSelectElement).value) });
      this.reprocessImage();
    });
    getClickerDocument().getElementById('imageKeychainRemoveBg')?.addEventListener('change', (event) => {
      this.config = { ...this.config, removeBackground: (event.target as HTMLInputElement).checked };
      this.reprocessImage();
    });
    for (const [id, key] of [['imageKeychainBaseColor', 'baseColor'], ['imageKeychainCapColor', 'capColor'], ['imageKeychainGlyphColor', 'glyphColor']] as const) {
      getClickerDocument().getElementById(id)?.addEventListener('input', (event) => {
        this.config = { ...this.config, [key]: (event.target as HTMLInputElement).value };
        this.scheduleBase();
        if (key === 'baseColor') this.scheduleBadge();
      });
    }
    getClickerDocument().getElementById('imageKeychainAssembled')?.addEventListener('click', () => this.setView('assembled'));
    getClickerDocument().getElementById('imageKeychainExploded')?.addEventListener('click', () => this.setView('exploded'));
    getClickerDocument().getElementById('imageKeychainExport3mf')?.addEventListener('click', () => {
      if (this.originalImage && this.builtParts.length) downloadThreeMF(this.builtParts, `${this.fileStem()}.3mf`);
    });
    getClickerDocument().getElementById('imageKeychainExportStl')?.addEventListener('click', () => {
      if (this.originalImage && this.builtParts.length) downloadSTL(this.builtParts, `${this.fileStem()}.stl`);
    });
  }

  private bindRange(id: string, key: 'imageWidthMm' | 'badgeThicknessMm' | 'imageDepthMm', rebuildBadge: boolean, unit: string) {
    const input = getClickerDocument().getElementById(id) as HTMLInputElement | null;
    input?.addEventListener('input', () => {
      this.config = clampImageKeychain({ ...this.config, [key]: Number(input.value) });
      const output = getClickerDocument().getElementById(`${id}Value`);
      if (output) output.textContent = `${this.config[key].toFixed(Number(input.step) < 1 ? 1 : 0)} ${unit}`;
      if (rebuildBadge) this.scheduleBadge();
    });
  }

  private scheduleBase() {
    window.clearTimeout(this.baseTimer);
    this.baseTimer = window.setTimeout(() => this.rebuildBase(), 120);
  }

  private scheduleBadge() {
    window.clearTimeout(this.badgeTimer);
    this.badgeTimer = window.setTimeout(() => this.rebuildBadge(), 120);
  }

  private async loadImage(file: File) {
    try {
      this.setStatus(this.language === 'vi' ? 'Đang đọc và vector hóa ảnh…' : 'Reading and vectorizing image…');
      this.originalImage = await loadFileToImage(file);
      if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
      this.imageUrl = URL.createObjectURL(file);
      this.reprocessImage();
      this.mount();
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  private reprocessImage() {
    if (!this.originalImage) return;
    const clone: RgbaImage = { data: new Uint8ClampedArray(this.originalImage.data), width: this.originalImage.width, height: this.originalImage.height };
    this.regionSet = processImage(clone, this.config.colorCount, { removeBg: this.config.removeBackground, smoothing: this.config.smoothing, photoFlatten: true });
    if (!this.regionSet.regions.length) {
      this.setStatus(this.language === 'vi' ? 'Không tìm thấy vùng ảnh để tạo hình học.' : 'No printable image region found.');
      return;
    }
    this.scheduleBadge();
  }

  private async loadWorkerAssets() {
    const base = `${import.meta.env.BASE_URL}clicker-assets/switch/mx/`;
    const load = async (file: string) => {
      const response = await fetch(base + file);
      if (!response.ok) throw new Error(`Failed to load ${file}`);
      return response.arrayBuffer();
    };
    try {
      const [socket, stem, switchBody] = await Promise.all([load('mx-socket.3mf'), load('mx-stem.3mf'), load('mx-switch.3mf')]);
      this.worker.postMessage({ type: 'init', socket, stem, switch: switchBody }, [socket, stem, switchBody]);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  private onWorkerMessage(message: GeometryResponse) {
    if (this.destroyed) return;
    if (message.type === 'ready') {
      void this.loadWorkerAssets();
      return;
    }
    if (message.type === 'initDone') {
      this.workerReady = true;
      this.rebuildBadge();
      return;
    }
    if (message.type === 'parts') {
      if (message.requestId !== undefined && message.requestId !== this.badgeRequestId) return;
      this.badgeParts = message.parts.map((part) => ({
        ...part,
        kind: part.name === 'top-base' ? 'body' : 'cap',
        group: part.name === 'top-base' ? 'base' : 'top',
        name: part.name === 'top-base' ? 'image-badge-base' : `image-${part.name}`,
      }));
      this.composeAndShow();
      return;
    }
    if (message.type === 'error') this.setStatus(message.message);
  }

  private rebuildBadge() {
    if (!this.workerReady || !this.regionSet.regions.length) return;
    const requestId = ++this.badgeRequestId;
    const regions: BuildRegion[] = [];
    this.regionSet.regions.forEach((region, colorIndex) => region.components.forEach((component, componentIndex) => regions.push({
      rings: component.rings,
      coverage: component.coverage,
      filamentRgb: region.quantRgb,
      partName: `badge-color-${colorIndex}-${componentIndex}`,
    })));
    const params: BuildParams = {
      baseShape: 'outline', capWidthMm: this.config.imageWidthMm, topThickness: 1, imageDepth: this.config.imageDepthMm,
      flatKeychainThicknessMm: this.config.badgeThicknessMm, imageMargin: 1.8, borderWidth: 2.4, capProud: 0,
      tolerance: .4, stemTolerance: 0, colorBleed: .1, stepHeight: .4, travel: 4, floorThickness: 1.6,
      switches: [{ x: 0, y: 0, rotation: 0 }], keychain: { enabled: false, style: 'loop', angleDeg: 90, holeDiameterMm: 5.2, offsetMm: 0 },
      baseFilamentRgb: hexToRgb(this.config.baseColor), bodyColorRgb: hexToRgb(this.config.baseColor), componentHeights: {}, edgeSettings: [],
      extrudeChamfer: false, mergeTopFrame: false, keepMeshesSeparate: true, isFlatKeychain: true, topProfile: 'flat', baseHeight: 0,
    };
    this.setStatus(this.language === 'vi' ? 'Đang tạo badge ảnh…' : 'Building image badge…');
    this.worker.postMessage({ type: 'buildClicker', requestId, regions, outline: this.regionSet.outline, params });
  }

  private rebuildBase() {
    const requestId = ++this.baseRequestId;
    this.setStatus(this.language === 'vi' ? 'Đang tạo socket và keycap…' : 'Building sockets and keycaps…');
    void this.geometry.build(flexConfig(this.config)).then((result) => {
      if (this.destroyed || requestId !== this.baseRequestId) return;
      this.baseParts = result.parts;
      this.composeAndShow();
    }).catch((error) => this.setStatus(error instanceof Error ? error.message : String(error)));
  }

  private composeAndShow() {
    if (!this.baseParts.length || !this.badgeParts.length) return;
    const bodyParts = this.baseParts.filter((part) => part.kind === 'body');
    const baseBox = boundsOf(bodyParts.length ? bodyParts : this.baseParts);
    const badgeBox = boundsOf(this.badgeParts);
    const baseSizeX = baseBox.max[0] - baseBox.min[0];
    const baseSizeY = baseBox.max[1] - baseBox.min[1];
    const badgeSizeX = badgeBox.max[0] - badgeBox.min[0];
    const badgeSizeY = badgeBox.max[1] - badgeBox.min[1];
    const baseCenterX = (baseBox.min[0] + baseBox.max[0]) / 2;
    const baseCenterY = (baseBox.min[1] + baseBox.max[1]) / 2;
    const badgeCenterX = (badgeBox.min[0] + badgeBox.max[0]) / 2;
    const badgeCenterY = (badgeBox.min[1] + badgeBox.max[1]) / 2;
    const overlap = 5;
    const badgeOffset = baseSizeY >= baseSizeX
      ? [baseCenterX - badgeCenterX, baseBox.max[1] + badgeSizeY / 2 - overlap - badgeCenterY, baseBox.min[2] - badgeBox.min[2]]
      : [baseBox.max[0] + badgeSizeX / 2 - overlap - badgeCenterX, baseCenterY - badgeCenterY, baseBox.min[2] - badgeBox.min[2]];
    const badge = translateParts(this.badgeParts, badgeOffset[0], badgeOffset[1], badgeOffset[2]);
    this.builtParts = [...this.baseParts.map(clonePart), ...badge];
    this.viewer?.setParts(this.builtParts, true);
    this.viewer?.setView(this.view);
    this.setStatus(this.originalImage
      ? (this.language === 'vi' ? `Sẵn sàng · ${splitName(this.config.name).length} socket + ${splitName(this.config.name).length} keycap` : `Ready · ${splitName(this.config.name).length} sockets + ${splitName(this.config.name).length} keycaps`)
      : (this.language === 'vi' ? 'Sẵn sàng · nhập ảnh để thay badge mẫu' : 'Ready · import an image to replace the sample badge'));
    this.syncExportButtons();
  }

  private setView(view: 'assembled' | 'exploded') {
    this.view = view;
    this.viewer?.setView(view);
    getClickerDocument().getElementById('imageKeychainAssembled')?.classList.toggle('active', view === 'assembled');
    getClickerDocument().getElementById('imageKeychainExploded')?.classList.toggle('active', view === 'exploded');
  }

  private updateLetterReadout() {
    const letters = keychainLetters(this.config.name);
    const container = getClickerDocument().querySelector('.image-keychain-letters');
    if (container) container.innerHTML = letters.map((letter, index) => `<span title="Socket ${index + 1}">${letter}</span>`).join('');
    const count = getClickerDocument().querySelector('.image-keychain-count strong');
    if (count) count.textContent = String(letters.length);
  }

  private syncExportButtons() {
    const disabled = !this.originalImage || !this.builtParts.length;
    for (const id of ['imageKeychainExport3mf', 'imageKeychainExportStl']) (getClickerDocument().getElementById(id) as HTMLButtonElement | null)?.toggleAttribute('disabled', disabled);
  }

  private setStatus(message: string) {
    const element = getClickerDocument().getElementById('imageKeychainStatus');
    if (element) element.textContent = message;
  }

  private fileStem() {
    return `image-name-${splitName(this.config.name).join('').toLowerCase() || 'name'}`;
  }

  private reset() {
    if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
    this.config = { ...DEFAULT_IMAGE_KEYCHAIN };
    this.originalImage = null;
    this.imageUrl = null;
    this.regionSet = placeholderRegions();
    this.baseParts = [];
    this.badgeParts = [];
    this.builtParts = [];
    this.view = 'assembled';
    this.mount();
  }

  destroy() {
    this.destroyed = true;
    window.clearTimeout(this.baseTimer);
    window.clearTimeout(this.badgeTimer);
    if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
    this.worker.terminate();
    this.viewer?.dispose();
    this.viewer = null;
  }
}
