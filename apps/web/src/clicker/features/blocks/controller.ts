import { getClickerDocument } from '../../runtime';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { $ } from '../../ui/helpers';
import { worker } from '../../core/engine';
import { appData } from '../../store/appState';
import { parseLetter } from '../../image/letter';
import { loadFileToImage } from '../../image/decode';
import { processImage } from '../../image/pipeline';
import { parseSvg } from '../../image/logo';
import { parse3MF, type RawMesh } from '../../geometry/threemfImport';
import { downloadSTL, downloadThreeMF } from '../../export';
import { clampBlocksConfig, DEFAULT_BLOCKS, splitBlocksText, type BlocksConfig } from './model';
import { renderBlocksScreen } from './view';
import type { ClickerPart, GeometryResponse, SwitchPlacement } from '../../types';

export interface BlocksController {
  mount(root: HTMLElement, onBack: () => void): void;
}

function roundedBox(width: number, depth: number, height: number, radius: number, color: number, bevel = false) {
  const shape = new THREE.Shape();
  const r = Math.max(0.1, Math.min(radius, Math.min(width, depth) / 2 - 0.1));
  shape.moveTo(-width / 2 + r, -depth / 2);
  shape.lineTo(width / 2 - r, -depth / 2);
  shape.quadraticCurveTo(width / 2, -depth / 2, width / 2, -depth / 2 + r);
  shape.lineTo(width / 2, depth / 2 - r);
  shape.quadraticCurveTo(width / 2, depth / 2, width / 2 - r, depth / 2);
  shape.lineTo(-width / 2 + r, depth / 2);
  shape.quadraticCurveTo(-width / 2, depth / 2, -width / 2, depth / 2 - r);
  shape.lineTo(-width / 2, -depth / 2 + r);
  shape.quadraticCurveTo(-width / 2, -depth / 2, -width / 2 + r, -depth / 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: bevel,
    bevelSegments: bevel ? 3 : 0,
    bevelSize: bevel ? 1.1 : 0,
    bevelThickness: bevel ? 1.0 : 0,
  });
  geo.translate(0, 0, -height / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.55 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeFallbackSwitchPreview() {
  const group = new THREE.Group();
  const dark = 0x20242c;
  const housing = roundedBox(12.5, 12.5, 2.4, 1.8, dark);
  housing.position.z = 1.4;
  group.add(housing);

  const upper = roundedBox(8.5, 8.5, 3.8, 1.2, 0x303641);
  upper.position.z = 4.5;
  group.add(upper);

  const stemVertical = roundedBox(2.1, 6.2, 2.2, 0.45, 0x16191e);
  stemVertical.position.z = 6.6;
  group.add(stemVertical);
  const stemHorizontal = roundedBox(6.2, 2.1, 2.2, 0.45, 0x16191e);
  stemHorizontal.position.z = 6.6;
  group.add(stemHorizontal);
  return group;
}

function makeRealSwitchPreview(raw: RawMesh) {
  const vertices = new Float32Array(raw.vertProperties);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    minX = Math.min(minX, vertices[i]);
    maxX = Math.max(maxX, vertices[i]);
    minY = Math.min(minY, vertices[i + 1]);
    maxY = Math.max(maxY, vertices[i + 1]);
    minZ = Math.min(minZ, vertices[i + 2]);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i] -= cx;
    vertices[i + 1] -= cy;
    vertices[i + 2] -= minZ;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(raw.triVerts), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x252830,
      roughness: 0.62,
      metalness: 0.08,
    }),
  );
  // The source MX model is a full-height switch. The preview seats it below
  // the cap while preserving the real 15.6 mm footprint.
  mesh.scale.z = 0.48;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makePartMesh(part: ClickerPart): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(part.vertProperties, part.numProp));
  geometry.setIndex(new THREE.BufferAttribute(part.triVerts, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const color = (part.colorRgb[0] << 16) | (part.colorRgb[1] << 8) | part.colorRgb[2];
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.56 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function maxBodyZ(parts: ClickerPart[]): number {
  let maxZ = -Infinity;
  for (const part of parts) {
    if (part.kind !== 'body') continue;
    for (let i = 2; i < part.vertProperties.length; i += part.numProp) {
      maxZ = Math.max(maxZ, part.vertProperties[i]);
    }
  }
  return Number.isFinite(maxZ) ? maxZ : 0;
}

export function createBlocksController(): BlocksController {
  const cfg: BlocksConfig = { ...DEFAULT_BLOCKS };
  let renderer: THREE.WebGLRenderer | null = null;
  let raf = 0;
  let cleanup: (() => void) | null = null;
  let exploded = false;
  let showSwitch = true;
  let realSwitch: RawMesh | null = null;
  let builtParts: ClickerPart[] = [];
  let builtPlacements: SwitchPlacement[] = [];
  let previewRebuild: (() => void) | null = null;
  let buildId = 0;
  let keycapImageRegionSet: import('../../types').RegionSet | null = null;
  let keycapImageName = '';

  const syncExportButtons = () => {
    const disabled = builtParts.length === 0;
    const exportButton = getClickerDocument().getElementById('blocksExport') as HTMLButtonElement | null;
    const stlButton = getClickerDocument().getElementById('blocksExportStl') as HTMLButtonElement | null;
    if (exportButton) exportButton.disabled = disabled;
    if (stlButton) stlButton.disabled = disabled;
  };

  const onWorkerMessage = (event: MessageEvent<GeometryResponse>) => {
    const msg = event.data;
    if (msg.type === 'initDone') {
      queueMicrotask(() => requestBuild(true));
      return;
    }
    if (msg.type !== 'blocksParts') return;
    if (msg.requestId !== undefined && msg.requestId !== buildId) return;
    builtParts = msg.parts;
    builtPlacements = msg.switchPlacements;
    syncExportButtons();
    previewRebuild?.();
  };
  worker.addEventListener('message', onWorkerMessage);

  const destroy = () => {
    cancelAnimationFrame(raf);
    cleanup?.();
    cleanup = null;
    renderer?.dispose();
    renderer?.domElement.remove();
    renderer = null;
    previewRebuild = null;
  };

  const requestBuild = (force = false) => {
    const safe = clampBlocksConfig(cfg);
    builtParts = [];
    builtPlacements = [];
    syncExportButtons();
    previewRebuild?.();
    if (!appData.assetsReady && !force) return;
    let parsed;
    try {
      parsed = parseLetter(safe.name, 'helvetiker-bold', 15, true);
    } catch (error) {
      console.warn('[blocks] Could not create glyph outlines', error);
      return;
    }
    const id = ++buildId;
    const keycapImageRegions = keycapImageRegionSet?.regions.flatMap((region, regionIndex) =>
      region.components.map((component, componentIndex) => ({
        filamentRgb: region.quantRgb,
        coverage: region.coverage,
        rings: component.rings,
        partName: `keycap-image-source-${regionIndex}-${componentIndex}`,
      })),
    ) ?? [];
    worker.postMessage({
      type: 'buildBlocks',
      params: {
        requestId: id,
        blockWidthMm: safe.blockWidthMm,
        blockHeightMm: safe.blockHeightMm,
        blockDepthMm: safe.blockDepthMm,
        blockGapMm: safe.blockGapMm,
        cornerRadiusMm: safe.cornerRadiusMm,
        fontSize: safe.fontSize,
        legendBold: 0,
        vertical: safe.vertical,
        glyphs: parsed.regions.map((region) => ({ rings: region.components[0]?.rings ?? [] })),
        keycapImageRegions,
        keycapImageSizeMm: 10,
        keycapImageExtrudeMm: 0.35,
      },
    });
  };

  function mountPreview(container: HTMLElement) {
    destroy();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f5f7);

    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(24, container.clientWidth / container.clientHeight, 0.1, 5000);
    camera.position.set(150, -180, 110);
    camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 30;
    controls.maxDistance = 900;

    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(60, -80, 160);
    scene.add(key);

    const grid = new THREE.GridHelper(500, 40, 0x5b9dff, 0xd1d5db);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);

    const root = new THREE.Group();
    scene.add(root);

    const rebuild = () => {
      for (const child of [...root.children]) {
        root.remove(child);
        child.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.geometry.dispose();
            (node.material as THREE.Material).dispose();
          }
        });
      }
      const safe = clampBlocksConfig(cfg);
      const chars = splitBlocksText(safe.name);
      const gap = Math.max(0.8, safe.blockGapMm * 1.15);
      const pitch = safe.vertical ? safe.blockHeightMm + gap : safe.blockWidthMm + gap;
      const total = Math.max(1, builtPlacements.length || chars.length);
      const start = -((total - 1) * pitch) / 2;

      const slotW = safe.blockWidthMm + 4.8;
      const slotD = safe.blockHeightMm + 4.8;
      const bodyW = safe.vertical ? slotW + 8 : total * pitch + 8;
      const bodyH = safe.vertical ? total * pitch + 8 : slotD + 8;
      const span = Math.max(bodyW, bodyH);
      camera.position.set(span * 1.55, -span * 1.75, span * 1.05 + (exploded ? 22 : 0));
      camera.lookAt(0, 0, exploded ? 13 : 6);

      if (builtParts.length > 0) {
        const topLift = exploded ? 24 : 0;
        for (const part of builtParts) {
          const mesh = makePartMesh(part);
          if (part.group === 'top') mesh.position.z = topLift;
          root.add(mesh);
        }
      } else {
        // Keep a lightweight placeholder while the worker is building or while
        // the switch assets are still loading.
        const baseBottom = roundedBox(bodyW, bodyH, 8, 6.5, 0xf1f1f3);
        baseBottom.position.z = 2;
        root.add(baseBottom);
      }

      const placements = builtPlacements.length
        ? builtPlacements
        : chars.map((_, index) => {
            const offset = start + index * pitch;
            return { x: safe.vertical ? 0 : offset, y: safe.vertical ? offset : 0, rotation: 0 };
          });
      if (showSwitch) {
        placements.forEach((placement) => {
          const switchPreview = realSwitch ? makeRealSwitchPreview(realSwitch) : makeFallbackSwitchPreview();
          // Both the real and fallback previews have their seating face at
          // local z=0. Sink their top just below the base's top plane so the
          // switch is actually inside the socket instead of floating above it.
          const switchBounds = new THREE.Box3().setFromObject(switchPreview);
          const seatZ = maxBodyZ(builtParts) - switchBounds.max.z - 0.8;
          switchPreview.position.set(placement.x, placement.y, seatZ);
          switchPreview.rotation.z = (placement.rotation * Math.PI) / 180;
          root.add(switchPreview);
        });
      }
    };

    previewRebuild = rebuild;
    rebuild();
    const loadSwitchAsset = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}clicker-assets/switch/mx/mx-switch.3mf`);
        if (!response.ok) throw new Error(`mx-switch.3mf: ${response.status}`);
        realSwitch = parse3MF(await response.arrayBuffer());
        rebuild();
      } catch (error) {
        console.warn('[blocks] Failed to load MX switch preview asset', error);
      }
    };
    void loadSwitchAsset();
    controls.target.set(0, 0, 8);
    controls.update();

    const resize = () => {
      if (!renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    window.addEventListener('resize', resize);

    cleanup = () => {
      ro.disconnect();
      window.removeEventListener('resize', resize);
      controls.dispose();
    };

    (function animate() {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer?.render(scene, camera);
    })();
  }

  const mount = (root: HTMLElement, onBack: () => void) => {
    root.innerHTML = renderBlocksScreen({ config: { ...cfg, keycapImageRegionSet, keycapImageName }, exploded, showSwitch, hasParts: builtParts.length > 0 });
    const viewport = $('blocksViewport');
    if (viewport && viewport.childElementCount === 0) mountPreview(viewport);

    const rerender = () => mount(root, onBack);
    $('blocksBack')?.addEventListener('click', onBack);
    const assembledButton = $('blocksAssembled');
    const explodedButton = $('blocksExploded');
    const showSwitchInput = $<HTMLInputElement>('blocksShowSwitch');
    assembledButton?.addEventListener('click', () => {
      exploded = false;
      assembledButton.classList.add('active');
      explodedButton?.classList.remove('active');
      mount(root, onBack);
    });
    explodedButton?.addEventListener('click', () => {
      exploded = true;
      explodedButton.classList.add('active');
      assembledButton?.classList.remove('active');
      mount(root, onBack);
    });
    showSwitchInput?.addEventListener('change', () => {
      showSwitch = showSwitchInput.checked;
      mount(root, onBack);
    });
    const name = $<HTMLInputElement>('blocksName');
    const vertical = $<HTMLSelectElement>('blocksVertical');
    const separate = $<HTMLSelectElement>('blocksSeparate');
    const fontSize = $<HTMLInputElement>('blocksFontSize');
    const gap = $<HTMLInputElement>('blocksGap');
    const radius = $<HTMLInputElement>('blocksRadius');
    const width = $<HTMLInputElement>('blocksWidth');
    const height = $<HTMLInputElement>('blocksHeight');
    const depth = $<HTMLInputElement>('blocksDepth');
    const keycapDrop = $('blocksKeycapImageDrop');
    const keycapFile = $<HTMLInputElement>('blocksKeycapImageFile');
    const readKeycapImage = async (file: File) => {
      try {
        const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
        keycapImageRegionSet = isSvg
          ? parseSvg(await file.text(), { removeBg: true })
          : processImage(await loadFileToImage(file), 4, { removeBg: true, smoothing: 0.25, photoFlatten: false });
        keycapImageName = file.name;
        rerender();
      } catch (error) {
        console.warn('[blocks] Could not import keycap image', error);
      }
    };
    if (keycapDrop && keycapFile) {
      keycapDrop.addEventListener('click', () => keycapFile.click());
      keycapFile.addEventListener('change', () => { if (keycapFile.files?.[0]) void readKeycapImage(keycapFile.files[0]); keycapFile.value = ''; });
      keycapDrop.addEventListener('dragover', (event) => { event.preventDefault(); keycapDrop.classList.add('over'); });
      keycapDrop.addEventListener('dragleave', () => keycapDrop.classList.remove('over'));
      keycapDrop.addEventListener('drop', (event) => { event.preventDefault(); keycapDrop.classList.remove('over'); if (event.dataTransfer?.files?.[0]) void readKeycapImage(event.dataTransfer.files[0]); });
    }
    $('blocksClearKeycapImage')?.addEventListener('click', () => { keycapImageRegionSet = null; keycapImageName = ''; rerender(); });

    $('blocksExport')?.addEventListener('click', () => {
      if (builtParts.length === 0) return;
      downloadThreeMF(builtParts, `blocks-${splitBlocksText(cfg.name).join('').toLowerCase() || 'model'}.3mf`);
    });
    $('blocksExportStl')?.addEventListener('click', () => {
      if (builtParts.length === 0) return;
      downloadSTL(builtParts, `blocks-${splitBlocksText(cfg.name).join('').toLowerCase() || 'model'}.stl`);
    });

    name?.addEventListener('input', () => { Object.assign(cfg, clampBlocksConfig({ ...cfg, name: name.value })); rerender(); });
    vertical?.addEventListener('change', () => { Object.assign(cfg, clampBlocksConfig({ ...cfg, vertical: vertical.value === 'vertical' })); rerender(); });
    separate?.addEventListener('change', () => { Object.assign(cfg, clampBlocksConfig({ ...cfg, separateLetters: separate.value === 'true' })); rerender(); });
    fontSize?.addEventListener('input', () => { Object.assign(cfg, clampBlocksConfig({ ...cfg, fontSize: +fontSize.value })); rerender(); });
    gap?.addEventListener('input', () => { Object.assign(cfg, clampBlocksConfig({ ...cfg, blockGapMm: +gap.value })); rerender(); });
    radius?.addEventListener('input', () => { Object.assign(cfg, clampBlocksConfig({ ...cfg, cornerRadiusMm: +radius.value })); rerender(); });
    width?.addEventListener('input', () => { Object.assign(cfg, clampBlocksConfig({ ...cfg, blockWidthMm: +width.value })); rerender(); });
    height?.addEventListener('input', () => { Object.assign(cfg, clampBlocksConfig({ ...cfg, blockHeightMm: +height.value })); rerender(); });
    depth?.addEventListener('input', () => { Object.assign(cfg, clampBlocksConfig({ ...cfg, blockDepthMm: +depth.value })); rerender(); });
    requestBuild();
  };

  return { mount };
}



