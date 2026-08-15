import { getClickerDocument } from '../../runtime';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { zipSync, strToU8 } from 'fflate';
import { importFontFile, loadBundledFonts, FONT_OPTIONS } from '../../image/letter';
import { parseLetter } from '../../image/letter';
import type { Ring } from '../../types';
import {
  clampOrganizerParams,
  DEFAULT_LABEL,
  DEFAULT_ORGANIZER,
  ORGANIZER_COPY,
  PRESETS,
  type OrganizerLabel,
  type OrganizerParams,
} from './model';
import {
  renderOrganizerShell,
  renderSidebar,
  type OrganizerInfo,
  type OrganizerUiState,
} from './view';

interface MeshPayload {
  positions: Float32Array;
  indices: Uint32Array;
}

interface BuildResult {
  id: number;
  mesh: MeshPayload;
  label: { plate: MeshPayload; text: MeshPayload | null } | null;
  info: {
    bbox: [number, number, number];
    compartments: number;
    cellInner: [number, number];
    volumeCm3: number;
    weightPlaG: number;
    triangles: number;
  };
  warnings: string[];
  error?: string;
}

interface OrganizerController {
  destroy(): void;
}

let active: OrganizerController | null = null;

function downloadBytes(bytes: Uint8Array, name: string, type: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const link = getClickerDocument().createElement('a');
  link.href = url;
  link.download = name;
  getClickerDocument().body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function cleanName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'flex-organizer';
}

function meshGeometry(payload: MeshPayload): THREE.BufferGeometry {
  if (payload.positions.length < 9 || payload.indices.length < 3) {
    throw new Error('Worker returned an empty organizer mesh');
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(payload.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(payload.indices, 1));
  try {
    const creased = toCreasedNormals(geometry, (35 * Math.PI) / 180);
    geometry.dispose();
    creased.computeBoundingBox();
    creased.computeBoundingSphere();
    return creased;
  } catch (error) {
    // A valid CSG mesh should still be renderable if the optional crease pass
    // cannot process it. Keep the original indexed geometry as a safe fallback.
    try {
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      return geometry;
    } catch {
      geometry.dispose();
      throw error;
    }
  }
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  for (const item of Array.isArray(material) ? material : [material]) item.dispose();
}

function fmt(value: number): string {
  return String(Math.round(value * 10000) / 10000);
}

function buildBinaryStl(meshes: MeshPayload[]): Uint8Array {
  let triangleCount = 0;
  for (const mesh of meshes) triangleCount += mesh.indices.length / 3;
  const buffer = new ArrayBuffer(84 + triangleCount * 50);
  const view = new DataView(buffer);
  const header = new TextEncoder().encode('Flex Organizer STL export');
  header.forEach((byte, index) => { if (index < 80) view.setUint8(index, byte); });
  view.setUint32(80, triangleCount, true);
  let offset = 84;
  const normal = (a: number[], b: number[], c: number[]) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    return [nx / length, ny / length, nz / length];
  };
  for (const mesh of meshes) {
    const vertices = mesh.positions;
    for (let index = 0; index < mesh.indices.length; index += 3) {
      const points = [0, 1, 2].map((part) => {
        const vertex = mesh.indices[index + part] * 3;
        return [vertices[vertex], vertices[vertex + 1], vertices[vertex + 2]];
      });
      const n = normal(points[0], points[1], points[2]);
      for (const value of n) { view.setFloat32(offset, value, true); offset += 4; }
      for (const point of points) for (const value of point) { view.setFloat32(offset, value, true); offset += 4; }
      view.setUint16(offset, 0, true);
      offset += 2;
    }
  }
  return new Uint8Array(buffer);
}

function meshXml(mesh: MeshPayload): string {
  const vertices: string[] = [];
  for (let index = 0; index < mesh.positions.length; index += 3) {
    vertices.push(`<vertex x="${fmt(mesh.positions[index])}" y="${fmt(mesh.positions[index + 1])}" z="${fmt(mesh.positions[index + 2])}"/>`);
  }
  const triangles: string[] = [];
  for (let index = 0; index < mesh.indices.length; index += 3) {
    triangles.push(`<triangle v1="${mesh.indices[index]}" v2="${mesh.indices[index + 1]}" v3="${mesh.indices[index + 2]}"/>`);
  }
  return `<mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh>`;
}

function buildThreeMf(meshes: Array<{ name: string; mesh: MeshPayload; color: string }>): Uint8Array {
  const materialXml = meshes.map((item) => `<base name="${item.name}" displaycolor="${item.color}FF"/>`).join('');
  const objects = meshes.map((item, index) => `<object id="${index + 2}" type="model" pid="1" pindex="${index}">${meshXml(item.mesh)}</object>`).join('');
  const build = meshes.map((_, index) => `<item objectid="${index + 2}"/>`).join('');
  const model = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">` +
    `<metadata name="Title">Flex Organizer Label</metadata><metadata name="Application">Clicker Generator</metadata>` +
    `<resources><basematerials id="1">${materialXml}</basematerials>${objects}</resources><build>${build}</build></model>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
  const relationships = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
  return zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(relationships),
    '3D/3dmodel.model': strToU8(model),
  }, { level: 6 });
}

function initialInfo(): OrganizerInfo {
  return { bbox: null, compartments: null, cellInner: null, volumeCm3: null, weightPlaG: null, triangles: null };
}

class FlexOrganizer implements OrganizerController {
  private params: OrganizerParams = { ...DEFAULT_ORGANIZER };
  private label: OrganizerLabel = { ...DEFAULT_LABEL };
  private locale: 'vi' | 'en' = localStorage.getItem('flex-organizer-locale') === 'en' ? 'en' : 'vi';
  private theme: 'light' | 'dark' = localStorage.getItem('flex-organizer-theme') === 'dark' ? 'dark' : 'light';
  private printerId = 'bambu256';
  private state: OrganizerUiState = {
    params: this.params,
    label: this.label,
    locale: this.locale,
    theme: this.theme,
    printerId: this.printerId,
    warnings: [],
    status: 'idle',
    hasMesh: false,
    hasLabelMesh: false,
    info: initialInfo(),
  };
  private worker: Worker | null = null;
  private requestId = 0;
  private latestResult: BuildResult | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private root: THREE.Group | null = null;
  private grid: THREE.GridHelper | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeHandler = () => this.resizeViewer();
  private frame = 0;
  private viewport: HTMLElement | null = null;
  private debounceTimer = 0;
  private buildInFlight = false;
  private buildQueued = false;

  start() {
    getClickerDocument().title = this.locale === 'vi' ? 'TrÃ¬nh táº¡o khay & há»™p chia' : 'Bin & Sorting Tray Generator';
    getClickerDocument().documentElement.lang = this.locale;
    getClickerDocument().documentElement.setAttribute('data-theme', this.theme);
    getClickerDocument().body.innerHTML = renderOrganizerShell(this.state, FONT_OPTIONS);
    this.viewport = getClickerDocument().getElementById('organizerViewport');
    if (!this.viewport) return;
    this.worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', (event: MessageEvent<BuildResult>) => this.receiveBuild(event.data));
    this.setupViewer();
    this.bindSidebar();
    this.renderStatus('idle');
    void loadBundledFonts().then(() => this.refreshSidebar());
    this.rebuild();
  }

  private setupViewer() {
    const viewport = this.viewport;
    if (!viewport) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(Math.max(1, viewport.clientWidth), Math.max(1, viewport.clientHeight));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    viewport.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, Math.max(1, viewport.clientWidth) / Math.max(1, viewport.clientHeight), 0.1, 5000);
    camera.up.set(0, 0, 1);
    camera.position.set(160, -150, 125);
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const hemi = new THREE.HemisphereLight(0xf5f8ff, 0x8c97a8, 0.7);
    hemi.position.set(0, 0, 200);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(130, -160, 260);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc4d9ff, 0.5);
    fill.position.set(-160, 80, 110);
    scene.add(fill);
    const grid = new THREE.GridHelper(600, 60, 0x2f72e8, 0xcbd3df);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.2;
    grid.renderOrder = -1;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => { material.depthWrite = false; });
    scene.add(grid);
    const root = new THREE.Group();
    scene.add(root);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 10;
    controls.maxDistance = 1600;
    controls.target.set(0, 0, 15);
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.root = root;
    this.grid = grid;
    this.updateThemeColors();
    this.resizeObserver = new ResizeObserver(this.resizeHandler);
    this.resizeObserver.observe(viewport);
    // ResizeObserver is not delivered consistently during browser zoom,
    // device emulation, and some dock/undock transitions. Three.js writes an
    // inline canvas size, so also listen to the viewport resize event or the
    // canvas can remain stuck at its initial dimensions in the top-left.
    window.addEventListener('resize', this.resizeHandler, { passive: true });
    window.visualViewport?.addEventListener('resize', this.resizeHandler, { passive: true });
    this.resizeHandler();
    const render = () => {
      this.frame = window.requestAnimationFrame(render);
      // Three.js writes an inline canvas size. Some browser zoom/docking
      // transitions update the stage without dispatching a usable resize
      // event, so repair the drawing surface from the render loop as well.
      const pixelRatio = renderer.getPixelRatio();
      const expectedWidth = Math.max(1, Math.round(viewport.clientWidth * pixelRatio));
      const expectedHeight = Math.max(1, Math.round(viewport.clientHeight * pixelRatio));
      if (renderer.domElement.clientWidth !== viewport.clientWidth
        || renderer.domElement.clientHeight !== viewport.clientHeight
        || renderer.domElement.width !== expectedWidth
        || renderer.domElement.height !== expectedHeight) {
        this.resizeViewer();
      }
      controls.update();
      renderer.render(scene, camera);
    };
    render();
  }

  private resizeViewer() {
    if (!this.viewport || !this.renderer || !this.camera) return;
    const width = Math.max(1, this.viewport.clientWidth);
    const height = Math.max(1, this.viewport.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private updateThemeColors() {
    if (!this.renderer || !this.scene || !this.grid) return;
    const dark = this.theme === 'dark';
    this.renderer.setClearColor(dark ? 0x11151d : 0xe6ebf2, 1);
    this.scene.background = new THREE.Color(dark ? 0x11151d : 0xe6ebf2);
    const materials = Array.isArray(this.grid.material) ? this.grid.material : [this.grid.material];
    materials.forEach((material, index) => { material.color.setHex(dark ? (index === 0 ? 0x526fa8 : 0x2a3443) : (index === 0 ? 0x5c93ee : 0xcbd3df)); });
  }

  private bindSidebar() {
    const sidebar = getClickerDocument().getElementById('organizerSidebar');
    if (!sidebar) return;
    sidebar.addEventListener('input', this.onSidebarInput);
    sidebar.addEventListener('change', this.onSidebarChange);
    sidebar.addEventListener('click', this.onSidebarClick);
  }

  private refreshSidebar() {
    const sidebar = getClickerDocument().getElementById('organizerSidebar');
    if (!sidebar) return;
    const scroll = sidebar.scrollTop;
    sidebar.outerHTML = renderSidebar(this.state, FONT_OPTIONS);
    const next = getClickerDocument().getElementById('organizerSidebar');
    if (next) { next.scrollTop = scroll; next.addEventListener('input', this.onSidebarInput); next.addEventListener('change', this.onSidebarChange); next.addEventListener('click', this.onSidebarClick); }
  }

  private onSidebarInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.matches('[data-param]') && target.value.trim() !== '') this.updateNumeric(target.dataset.param ?? '', Number(target.value));
    if (target.id === 'org-color') this.updateParams({ color: target.value });
    if (target.id === 'org-labelText') { this.label = { ...this.label, text: target.value }; this.state.label = this.label; this.rebuild(); }
    if (target.id === 'org-plateColor') { this.label = { ...this.label, plateColor: target.value }; this.state.label = this.label; this.rebuild(); }
    if (target.id === 'org-textColor') { this.label = { ...this.label, textColor: target.value }; this.state.label = this.label; this.rebuild(); }
  };

  private onSidebarChange = async (event: Event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.matches('[data-param]') && target.value.trim() !== '') this.updateNumeric(target.dataset.param ?? '', Number(target.value));
    const toggleParams: Record<string, keyof OrganizerParams> = {
      'org-stackingLip': 'stackingLip',
      'org-labelTab': 'labelTab',
      'org-fingerScoops': 'fingerScoops',
      'org-floorHoles': 'floorHoles',
    };
    const toggleKey = toggleParams[target.id];
    if (toggleKey && target instanceof HTMLInputElement) {
      this.updateParams({ [toggleKey]: target.checked } as Partial<OrganizerParams>);
      return;
    }
    if (target.id === 'org-printer') { this.printerId = target.value; this.state.printerId = target.value; this.refreshSidebar(); }
    if (target.id === 'org-texture') this.updateParams({ wallTexture: target.value as OrganizerParams['wallTexture'] });
    if (target.id === 'org-labelFont') { this.label = { ...this.label, fontId: target.value }; this.state.label = this.label; this.rebuild(); }
    if (target.id === 'org-labelEnabled') { this.label = { ...this.label, enabled: (target as HTMLInputElement).checked }; this.state.label = this.label; this.refreshSidebar(); this.rebuild(); }
    if (target.id === 'org-fontUpload') {
      const file = (target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const font = await importFontFile(file);
        this.label = { ...this.label, fontId: font.id };
        this.state.label = this.label;
        this.refreshSidebar();
        this.rebuild();
      } catch (error) { this.renderStatus('error', error instanceof Error ? error.message : String(error)); }
    }
  };

  private onSidebarClick = (event: Event) => {
    const target = event.target as HTMLElement;
    const language = target.closest<HTMLElement>('[data-lang]');
    if (language) {
      this.locale = language.dataset.lang === 'en' ? 'en' : 'vi';
      this.state.locale = this.locale;
      localStorage.setItem('flex-organizer-locale', this.locale);
      getClickerDocument().documentElement.lang = this.locale;
      getClickerDocument().title = ORGANIZER_COPY[this.locale].title;
      this.refreshSidebar();
      return;
    }
    if (target.closest('#org-theme')) {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
      this.state.theme = this.theme;
      localStorage.setItem('flex-organizer-theme', this.theme);
      getClickerDocument().documentElement.setAttribute('data-theme', this.theme);
      getClickerDocument().getElementById('flex-organizer')?.setAttribute('data-theme', this.theme);
      this.updateThemeColors();
      this.refreshSidebar();
      return;
    }
    const presetButton = target.closest<HTMLElement>('[data-preset]');
    if (presetButton) {
      const preset = PRESETS.find((item) => item.id === presetButton.dataset.preset);
      if (preset) {
        const normalized = clampOrganizerParams({ ...this.params, ...preset.params });
        this.params = normalized.params;
        this.state.params = this.params;
        this.state.warnings = normalized.warnings;
        this.refreshSidebar();
        this.rebuild();
      }
      return;
    }
    if (target.closest('#org-download')) this.downloadBase();
    if (target.closest('#org-downloadLabel')) this.downloadLabel();
    if (target.closest('#org-fontReset')) {
      this.label = { ...this.label, fontId: DEFAULT_LABEL.fontId };
      this.state.label = this.label;
      this.refreshSidebar();
      this.rebuild();
    }
  };

  private updateNumeric(id: string, value: number) {
    if (!Number.isFinite(value)) return;
    if (id.startsWith('label-')) {
      const key = id.slice(6) as keyof Pick<OrganizerLabel, 'fontSize' | 'embossDepth' | 'plateHeight'>;
      const limits: Record<keyof Pick<OrganizerLabel, 'fontSize' | 'embossDepth' | 'plateHeight'>, [number, number]> = {
        fontSize: [3, 40],
        embossDepth: [0.2, 3],
        plateHeight: [6, 40],
      };
      if (key in this.label) {
        const [min, max] = limits[key];
        const next = Math.min(max, Math.max(min, value));
        this.label = { ...this.label, [key]: next };
        this.syncOutput(id, next);
      }
      this.state.label = this.label;
      this.rebuild();
      return;
    }
    const numericKeys = new Set<keyof OrganizerParams>(['width', 'depth', 'height', 'cols', 'rows', 'wall', 'floor', 'divider', 'radius', 'textureDepth', 'textureCount']);
    if (!numericKeys.has(id as keyof OrganizerParams)) return;
    this.updateParams({ [id]: value } as Partial<OrganizerParams>);
    this.syncOutput(id, this.params[id as keyof OrganizerParams] as number);
  }

  private updateParams(partial: Partial<OrganizerParams>) {
    const normalized = clampOrganizerParams({ ...this.params, ...partial });
    const changedByClamp = (Object.keys(normalized.params) as Array<keyof OrganizerParams>).some((key) => normalized.params[key] !== ({ ...this.params, ...partial } as OrganizerParams)[key]);
    this.params = normalized.params;
    this.state.params = this.params;
    this.state.warnings = normalized.warnings;
    if (changedByClamp) this.refreshSidebar();
    this.rebuild();
  }

  private syncOutput(id: string, value: number) {
    const output = getClickerDocument().getElementById(`org-${id}-value`);
    if (output) output.textContent = String(Math.round(value * 10) / 10);
    for (const input of Array.from(getClickerDocument().querySelectorAll<HTMLInputElement>('input[data-param]'))) {
      if (input.dataset.param === id && input !== getClickerDocument().activeElement) input.value = String(value);
    }
  }

  private renderStatus(status: OrganizerUiState['status'], message?: string) {
    this.state.status = status;
    this.state.statusText = message;
    const element = getClickerDocument().getElementById('organizerStatus');
    if (element) element.textContent = message ?? (status === 'working' ? ORGANIZER_COPY[this.locale].building : status === 'error' ? 'Build failed' : ORGANIZER_COPY[this.locale].ready);
  }

  private rebuild() {
    window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => this.dispatchBuild(), 90);
    this.renderStatus('working');
  }

  private dispatchBuild() {
    if (!this.worker) return;
    if (this.buildInFlight) {
      this.buildQueued = true;
      return;
    }
    const id = ++this.requestId;
    this.buildInFlight = true;
    let label: (OrganizerLabel & { rings: Ring[] }) | null = null;
    if (this.label.enabled && this.label.text.trim()) {
      try {
        const parsed = parseLetter(this.label.text, this.label.fontId, 24, false);
        label = { ...this.label, rings: parsed.outline };
      } catch (error) {
        this.renderStatus('error', error instanceof Error ? error.message : String(error));
      }
    }
    this.worker.postMessage({ id, params: this.params, label });
  }

  private receiveBuild(result: BuildResult) {
    if (result.id !== this.requestId) return;
    this.buildInFlight = false;
    if (result.error) {
      this.renderStatus('error', result.error);
      if (this.buildQueued) {
        this.buildQueued = false;
        this.rebuild();
      }
      return;
    }
    try {
      this.renderMeshes(result);
    } catch (error) {
      // Do not replace a working model with a blank scene when a new toggle
      // produces a mesh that the viewer cannot process.
      this.renderStatus('error', error instanceof Error ? error.message : String(error));
      return;
    }
    this.latestResult = result;
    this.state.hasMesh = result.mesh.positions.length > 0;
    this.state.hasLabelMesh = Boolean(result.label?.plate.positions.length);
    this.state.info = result.info;
    this.state.warnings = result.warnings;
    this.updateInfo(result.info);
    this.refreshExportButtons();
    this.renderStatus('idle');
    if (this.buildQueued) {
      this.buildQueued = false;
      this.rebuild();
    }
  }

  private clearRoot() {
    if (!this.root) return;
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      if (child instanceof THREE.Mesh) { child.geometry.dispose(); disposeMaterial(child.material); }
    }
  }

  private renderMeshes(result: BuildResult) {
    if (!this.root) return;
    const nextMeshes: THREE.Mesh[] = [];
    try {
      const baseMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.params.color), roughness: 0.42, metalness: 0.02, side: THREE.DoubleSide });
      nextMeshes.push(new THREE.Mesh(meshGeometry(result.mesh), baseMaterial));
      if (result.label) {
        const plateMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.label.plateColor), roughness: 0.35, side: THREE.DoubleSide });
        nextMeshes.push(new THREE.Mesh(meshGeometry(result.label.plate), plateMaterial));
        if (result.label.text) {
          const textMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.label.textColor), roughness: 0.3, side: THREE.DoubleSide });
          nextMeshes.push(new THREE.Mesh(meshGeometry(result.label.text), textMaterial));
        }
      }
    } catch (error) {
      for (const mesh of nextMeshes) { mesh.geometry.dispose(); disposeMaterial(mesh.material); }
      throw error;
    }
    this.clearRoot();
    nextMeshes.forEach((mesh) => this.root?.add(mesh));
    this.frameModel();
  }

  private frameModel() {
    if (!this.root || !this.camera || !this.controls) return;
    const box = new THREE.Box3().setFromObject(this.root);
    if (!Number.isFinite(box.min.x)) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 20);
    this.controls.target.copy(center);
    this.camera.position.set(center.x + radius * 1.35, center.y - radius * 1.55, center.z + radius * 1.05);
    this.camera.near = Math.max(0.1, radius / 1000);
    this.camera.far = radius * 30;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  private updateInfo(info: BuildResult['info']) {
    const values: Record<string, string> = {
      'org-info-bbox': `${info.bbox.join(' Ã— ')} mm`,
      'org-info-compartments': String(info.compartments),
      'org-info-cell': `${info.cellInner[0].toFixed(1)} Ã— ${info.cellInner[1].toFixed(1)} mm`,
      'org-info-volume': `${info.volumeCm3.toFixed(1)} cmÂ³`,
      'org-info-weight': `${info.weightPlaG.toFixed(1)} g`,
      'org-info-tris': info.triangles.toLocaleString(),
    };
    for (const [id, value] of Object.entries(values)) { const element = getClickerDocument().getElementById(id); if (element) element.textContent = value; }
  }

  private refreshExportButtons() {
    const download = getClickerDocument().getElementById('org-download') as HTMLButtonElement | null;
    if (download) download.disabled = !this.state.hasMesh;
    const label = getClickerDocument().getElementById('org-downloadLabel') as HTMLButtonElement | null;
    if (label) label.disabled = !this.state.hasLabelMesh;
  }

  private downloadBase() {
    if (!this.latestResult) return;
    downloadBytes(buildBinaryStl([this.latestResult.mesh]), `${cleanName(ORGANIZER_COPY[this.locale].title)}.stl`, 'model/stl');
  }

  private downloadLabel() {
    const label = this.latestResult?.label;
    if (!label) return;
    const meshes = [{ name: 'label-plate', mesh: label.plate, color: this.label.plateColor.replace('#', '') }, ...(label.text ? [{ name: 'label-text', mesh: label.text, color: this.label.textColor.replace('#', '') }] : [])];
    downloadBytes(buildThreeMf(meshes), `${cleanName(this.label.text || 'label')}.3mf`, 'model/3mf');
  }

  destroy() {
    window.clearTimeout(this.debounceTimer);
    window.cancelAnimationFrame(this.frame);
    this.requestId++;
    this.worker?.terminate();
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.resizeHandler);
    window.visualViewport?.removeEventListener('resize', this.resizeHandler);
    this.controls?.dispose();
    this.clearRoot();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.worker = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.root = null;
    this.viewport = null;
  }
}

export function bootstrapFlexOrganizer(): OrganizerController {
  active?.destroy();
  const controller = new FlexOrganizer();
  active = controller;
  controller.start();
  return controller;
}



