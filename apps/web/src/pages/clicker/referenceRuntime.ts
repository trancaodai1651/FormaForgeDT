import { getClickerDocument } from '../../clicker/runtime';
import { appData, store } from '../../clicker/store/appState';
import type { ClickerPart } from '../../clicker/types';
import type { Viewer } from '../../clicker/viewer/viewer';
import { debouncedRebuild } from '../../clicker/core/engine';
import { SVG_SAMPLES } from '../../clicker/image/sample';
import * as THREE from 'three';

const FIT_TEST_PREFIX = 'fit-test-';
const FIT_TEST_CLEARANCES = [-0.4, -0.2, 0, 0.2, 0.4];
const FIT_TEST_POCKET_PERCENTS = [-1, -0.5, 0, 0.5, 1];

function roundedRectPath(path: THREE.Path, width: number, height: number, radius: number) {
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  path.moveTo(x + r, y);
  path.lineTo(x + width - r, y);
  path.quadraticCurveTo(x + width, y, x + width, y + r);
  path.lineTo(x + width, y + height - r);
  path.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  path.lineTo(x + r, y + height);
  path.quadraticCurveTo(x, y + height, x, y + height - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  path.closePath();
}

function fitGaugePart(
  name: string,
  centerX: number,
  centerY: number,
  hole: 'stem' | 'pocket',
  fit: number,
): ClickerPart {
  const shape = new THREE.Shape();
  roundedRectPath(shape, hole === 'stem' ? 11 : 17, hole === 'stem' ? 11 : 17, 1.6);
  const cutout = new THREE.Path();
  if (hole === 'stem') {
    const scale = Math.max(0.78, Math.min(1.12, 1 + fit / 6.7));
    const arm = 0.62 * scale;
    const span = 3.25 * scale;
    const points: [number, number][] = [
      [-arm, -span], [arm, -span], [arm, -arm], [span, -arm], [span, arm], [arm, arm],
      [arm, span], [-arm, span], [-arm, arm], [-span, arm], [-span, -arm], [-arm, -arm],
    ];
    cutout.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) cutout.lineTo(x, y);
    cutout.closePath();
  } else {
    const size = 14 * (1 + fit / 100);
    roundedRectPath(cutout, size, size, 1.25);
  }
  shape.holes.push(cutout);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false, curveSegments: 20, steps: 1 });
  geometry.translate(centerX, centerY, 0);
  const nonIndexed = geometry.toNonIndexed();
  geometry.dispose();
  const position = nonIndexed.getAttribute('position');
  const vertices = new Float32Array(position.array as ArrayLike<number>);
  const triangles = Uint32Array.from({ length: position.count }, (_, index) => index);
  nonIndexed.dispose();
  return {
    kind: 'body', group: 'base', colorRgb: [244, 245, 248], name,
    vertProperties: vertices, triVerts: triangles, numProp: 3,
  };
}

function buildFitTestParts(parts: ClickerPart[]): ClickerPart[] {
  const bounds = new THREE.Box3();
  for (const part of parts) {
    const position = new THREE.BufferAttribute(part.vertProperties, part.numProp);
    for (let index = 0; index < position.count; index++) {
      bounds.expandByPoint(new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index)));
    }
  }
  const centerX = bounds.isEmpty() ? 0 : (bounds.min.x + bounds.max.x) / 2;
  const backY = bounds.isEmpty() ? 16 : bounds.max.y + 12;
  const stemPitch = 12.2;
  const pocketPitch = 18.2;
  return [
    ...FIT_TEST_CLEARANCES.map((clearance, index) => fitGaugePart(
      `${FIT_TEST_PREFIX}stem-${index + 1}`, centerX + (index - 2) * stemPitch, backY + 9, 'stem', clearance,
    )),
    ...FIT_TEST_POCKET_PERCENTS.map((percent, index) => fitGaugePart(
      `${FIT_TEST_PREFIX}pocket-${index + 1}`, centerX + (index - 2) * pocketPitch, backY - 9, 'pocket', percent,
    )),
  ];
}

function element<K extends HTMLElement = HTMLElement>(id: string): K | null {
  return getClickerDocument().getElementById(id) as K | null;
}

function details(id: string, title: string): HTMLDetailsElement {
  const node = getClickerDocument().createElement('details');
  node.id = id;
  node.className = 'section section-collapsible reference-accordion';
  node.innerHTML = `<summary class="label collapsible-head">${title}</summary><div class="collapsible-body"></div>`;
  return node;
}

/** Reuses the live Clicker controls and geometry callbacks in a separate reference style. */
export function configureReferenceClicker(viewer: Viewer) {
  const doc = getClickerDocument();
  const left = element('sidebar-left');
  const right = element('sidebar-right');
  const viewport = element('viewport');
  if (!left || !right || !viewport) return;

  viewer.setView('exploded');
  viewer.setGridVisible(false);
  viewer.setCameraElevation(42);

  element('btnBackHome')?.remove();
  const header = left.querySelector('.app-header');
  const subtitle = header?.querySelector('.app-subtitle');
  if (subtitle) subtitle.textContent = 'Generate printable 3D model of a clicker from an image';
  header?.insertAdjacentHTML('beforeend', `
    <div class="reference-print-notice" id="referencePrintNotice">
      <button type="button" id="referenceNoticeDismiss" aria-label="Dismiss">×</button>
      For the best quality printed clicker, please use the print profile and instructions available on
      <a href="https://makerworld.com/en/models/2980346" target="_blank" rel="noreferrer">MakerWorld</a>.
    </div>`);
  element('referenceNoticeDismiss')?.addEventListener('click', () => element('referencePrintNotice')?.remove());

  const preview = element('previewViewSection');
  preview?.insertAdjacentHTML('beforeend', `<div class="switch-row reference-cut-row">
    <span class="switch-label">Cut it open <span class="help-tip" title="Slices only the preview; exported geometry remains complete.">?</span></span>
    <label class="toggle"><input id="referenceCut" type="checkbox" /><span class="slider"></span></label>
  </div><div class="reference-cut-controls" id="referenceCutControls" hidden>
    <select id="referenceCutAxis" aria-label="Cut axis"><option value="y">Front to back</option><option value="x">Left to right</option><option value="z">Top to bottom</option></select>
    <input id="referenceCutPosition" aria-label="Cut position" type="range" min="-1" max="1" step="0.01" value="0" />
  </div>`);
  const cut = element<HTMLInputElement>('referenceCut');
  const cutAxis = element<HTMLSelectElement>('referenceCutAxis');
  const cutPosition = element<HTMLInputElement>('referenceCutPosition');
  const updateCut = () => {
    if (!cut || !cutAxis || !cutPosition) return;
    element('referenceCutControls')!.hidden = !cut.checked;
    if (cut.checked) {
      viewer.setSection(cutAxis.value as 'x' | 'y' | 'z', Number(cutPosition.value));
      viewer.setView('section');
    } else viewer.setView(store.get().view === 'section' ? 'exploded' : store.get().view);
  };
  cut?.addEventListener('change', updateCut);
  cutAxis?.addEventListener('change', updateCut);
  cutPosition?.addEventListener('input', updateCut);
  element('viewTabs')?.addEventListener('click', () => { if (cut?.checked) { cut.checked = false; element('referenceCutControls')!.hidden = true; } });

  const base = element('baseStyleSection');
  const shapeSettings = element<HTMLDetailsElement>('sectionShape');
  const colorSettings = element<HTMLDetailsElement>('sectionColors');
  const switchSettings = element<HTMLDetailsElement>('sectionSwitch');
  const settingsContainer = element('geometrySettingsContainer');
  if (base && shapeSettings && colorSettings && switchSettings && settingsContainer) {
    const widthRow = element('width')?.closest('.prow-stacked');
    if (widthRow) {
      const designRow = doc.createElement('div');
      designRow.className = 'prow-stacked reference-design-row';
      designRow.innerHTML = `<div class="prow-header"><label for="referenceDesignSize">Design size <span class="help-tip" title="Scale the artwork within the selected base shape.">?</span></label><output id="referenceDesignSizeValue">100 %</output></div><input id="referenceDesignSize" type="range" min="25" max="150" step="1" value="100" />`;
      base.insertBefore(designRow, widthRow.nextSibling);
      const lockRow = doc.createElement('div');
      lockRow.className = 'switch-row reference-lock-row';
      lockRow.innerHTML = `<span class="switch-label">Lock the base size <span class="help-tip" title="Keep the selected base footprint while changing design size.">?</span></span><label class="toggle"><input id="referenceLockBase" type="checkbox" /><span class="slider"></span></label>`;
      base.insertBefore(lockRow, designRow.nextSibling);
      element<HTMLInputElement>('referenceDesignSize')?.addEventListener('input', (event) => {
        const value = Number((event.target as HTMLInputElement).value);
        store.set({ designSizePercent: value });
        debouncedRebuild();
      });
      element<HTMLInputElement>('referenceLockBase')?.addEventListener('change', (event) => {
        store.set({ lockBaseSize: (event.target as HTMLInputElement).checked });
        debouncedRebuild();
      });
    }
    const body = details('referenceBodyFit', 'Body & fit');
    const bodyContent = body.querySelector('.collapsible-body')!;
    for (const id of ['topThicknessRow', 'imgdepth']) {
      const control = element(id);
      const row = control?.classList.contains('prow-stacked') ? control : control?.closest('.prow-stacked');
      if (row) bodyContent.appendChild(row);
    }
    bodyContent.insertAdjacentHTML('beforeend', `<div class="prow-stacked">
      <div class="prow-header"><label for="referenceRimHeight">Body rim height <span class="help-tip" title="Adjust how high the lower body rises around the button.">?</span></label><output id="referenceRimValue">2.4 mm</output></div>
      <input id="referenceRimHeight" type="range" min="0" max="8" step="0.1" value="2.4" />
    </div><div class="switch-row"><span class="switch-label">Hollow the base <span class="help-tip" title="Remove material from the underside while keeping the wall and switch supports.">?</span></span><label class="toggle"><input id="referenceHollowBase" type="checkbox" /><span class="slider"></span></label></div>`);
    element<HTMLInputElement>('referenceRimHeight')?.addEventListener('input', (event) => {
      const rim = Number((event.target as HTMLInputElement).value);
      store.set({ baseHeight: Math.max(2, 16 + rim - 2.4) });
      debouncedRebuild();
    });
    element<HTMLInputElement>('referenceHollowBase')?.addEventListener('change', (event) => {
      store.set({ hollowBase: (event.target as HTMLInputElement).checked });
      debouncedRebuild();
    });
    for (const id of ['socketTolStepper', 'stemTolStepper']) {
      const row = element(id)?.closest('.prow-stacked');
      if (row) bodyContent.appendChild(row);
    }
    const gapLabel = element('socketTolStepper')?.closest('.prow-stacked')?.querySelector('label');
    if (gapLabel) gapLabel.textContent = 'Top / base gap';
    const stemLabel = element('stemTolStepper')?.closest('.prow-stacked')?.querySelector('label');
    if (stemLabel) stemLabel.textContent = 'Switch stem fit (top part)';
    bodyContent.insertAdjacentHTML('beforeend', `<div class="prow-stacked reference-pocket-fit">
      <div class="prow-header"><label>Switch pocket fit (base) <span class="help-tip" title="Positive values loosen the MX switch socket; negative values tighten it.">?</span></label></div>
      <div class="tol-stepper"><button type="button" id="referencePocketMinus" class="btn" aria-label="Decrease switch pocket fit">−</button><span class="tol-val" id="referencePocketValue">0.0%</span><button type="button" id="referencePocketPlus" class="btn" aria-label="Increase switch pocket fit">+</button></div>
    </div><p class="reference-fit-help">Test gauges are arranged left to right. Stem row: −0.4, −0.2, 0, +0.2, +0.4 mm. Pocket row: −1%, −0.5%, 0, +0.5%, +1%.</p>
    <button type="button" id="referenceFitTest" class="btn secondary reference-fit-button">⌖&nbsp; Print a fit test</button>`);
    const changePocket = (delta: number) => {
      store.set({ switchPocketFitPercent: Math.max(-10, Math.min(10, store.get().switchPocketFitPercent + delta)) });
      debouncedRebuild();
    };
    const buildFitTest = () => {
      const sourceParts = appData.latestParts.filter((part) => !part.name.startsWith(FIT_TEST_PREFIX));
      const fitParts = buildFitTestParts(sourceParts);
      appData.latestParts = [...sourceParts, ...fitParts];
      viewer.setParts(appData.latestParts, true, true);
      viewer.setView(store.get().view);
      viewer.setSwitchPlacements([]);
      viewer.showSwitch(false);
      store.set({ hasParts: true, showSwitch: false, status: 'Fit test: print the gauges, try each tile on a real switch, then set the stem and pocket values to the ones that fit.' });
    };
    doc.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>('button');
      if (button?.id === 'referencePocketMinus') changePocket(-0.5);
      else if (button?.id === 'referencePocketPlus') changePocket(0.5);
      else if (button?.id === 'referenceFitTest') buildFitTest();
    });
    const advanced = details('referenceAdvanced', 'Advanced shape controls');
    for (const id of ['baseHeight', 'margin', 'borderwidth', 'mergeTopFrame']) {
      const control = element(id);
      const row = control?.closest('.prow-stacked, .switch-row');
      if (row) advanced.querySelector('.collapsible-body')!.appendChild(row);
    }
    bodyContent.appendChild(advanced);
    const keychain = details('referenceKeychain', 'Keychain');
    const keychainPanel = shapeSettings.querySelector('.keychain-panel');
    if (keychainPanel) keychain.querySelector('.collapsible-body')!.appendChild(keychainPanel);
    left.insertBefore(body, settingsContainer);
    left.insertBefore(switchSettings, settingsContainer);
    left.insertBefore(colorSettings, settingsContainer);
    left.insertBefore(keychain, settingsContainer);
    shapeSettings.style.display = 'none';
    settingsContainer.style.display = 'none';
    colorSettings.querySelector('summary')!.textContent = 'Colors';
    switchSettings.querySelector('summary')!.textContent = 'Switch';
    colorSettings.dataset.modeKey = 'image-single-color';
    colorSettings.open = false;
    body.open = false;
    switchSettings.open = false;
    keychain.open = false;
  }

  const leftFooter = left.querySelector('.sidebar-sticky-footer');
  leftFooter?.insertAdjacentHTML('beforeend', `<div class="reference-credit"><span>Clicker Generator<br><small>Made by <a href="https://makerworld.com/en/@Vostok_Labs" target="_blank" rel="noreferrer">Vostok Labs</a></small></span><button type="button" id="referenceUpdates">◷&nbsp; Updates</button></div>`);
  element('referenceUpdates')?.addEventListener('click', () => element('helpToggle')?.click());

  viewport.insertAdjacentHTML('beforeend', `<div class="reference-viewport-label">LIVE 3D PREVIEW</div>
    <label class="reference-plate-control">▦&nbsp;
      <select id="referencePlate" aria-label="Build plate">
        <option value="256">Plate: A1, P/X series</option>
        <option value="180">Plate: A1 mini</option>
        <option value="none">No plate</option>
      </select>
    </label>
    <div class="reference-viewport-help">Hold left click to rotate, right click to pan, scroll to zoom.</div>`);
  element<HTMLSelectElement>('referencePlate')?.addEventListener('change', (event) => {
    const value = (event.target as HTMLSelectElement).value;
    viewer.setPrintBed(value === '180' ? 180 : 256, value === '180' ? 180 : 256, value !== 'none', 'textured');
  });
  const extrudeButton = viewport.querySelector<HTMLButtonElement>('[data-editmode="extrude"]');
  if (extrudeButton) extrudeButton.lastChild!.textContent = 'Raise';

  const rightFooter = right.querySelector('.sidebar-sticky-footer');
  const svgPanel = element('svgPanel');
  const uploadGallery = element('uploadGallery');
  if (svgPanel && uploadGallery) {
    const sample = SVG_SAMPLES[0];
    const card = doc.createElement('button');
    card.type = 'button';
    card.className = 'reference-svg-sample';
    card.innerHTML = `<img src="${sample.src}" alt="" /><span>Choose a sample SVG<br><strong>${sample.name}</strong></span>`;
    svgPanel.insertBefore(card, uploadGallery);
    card.addEventListener('click', async () => {
      const svgUpload = element<HTMLInputElement>('svgUpload');
      if (!svgUpload) return;
      try {
        const response = await fetch(sample.src);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const file = new File([await response.blob()], 'bambulab.svg', { type: 'image/svg+xml' });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        svgUpload.files = transfer.files;
        svgUpload.dispatchEvent(new Event('change', { bubbles: true }));
      } catch { card.textContent = 'Could not load sample SVG'; }
    });
  }
  const projectSettings = element('projectSettingsContainer');
  const saveLabel = projectSettings?.querySelector('#saveProj span');
  const loadLabel = projectSettings?.querySelector('#loadProj span');
  if (saveLabel) saveLabel.textContent = 'Save';
  if (loadLabel) loadLabel.textContent = 'Load';
  rightFooter?.querySelector('#exportStl')?.setAttribute('hidden', '');
  rightFooter?.querySelector('#exportModeHint')?.setAttribute('hidden', '');
  const themeButton = element<HTMLButtonElement>('themeToggle');
  const saveLoadRow = projectSettings?.querySelector('.btn-row');
  if (saveLoadRow && themeButton) {
    const utilityRow = themeButton.closest('.footer-utility-row');
    saveLoadRow.appendChild(themeButton);
    utilityRow?.remove();
  }
  const updateThemeLabel = () => { const label = element('themeLabel'); if (label) label.textContent = doc.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode'; };
  updateThemeLabel();
  themeButton?.addEventListener('click', () => {
    const theme = doc.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    doc.documentElement.dataset.theme = theme;
    viewer.setTheme(theme);
    updateThemeLabel();
  });

  const unsubscribe = store.subscribe((state) => {
    const gapLabel = element('socketTolStepper')?.closest('.prow-stacked')?.querySelector('label');
    if (gapLabel) gapLabel.textContent = 'Top / base gap';
    const stemLabel = element('stemTolStepper')?.closest('.prow-stacked')?.querySelector('label');
    if (stemLabel) stemLabel.textContent = 'Switch stem fit (top part)';
    if (cut?.checked && state.view !== 'section') updateCut();
    const design = element<HTMLInputElement>('referenceDesignSize');
    const lock = element<HTMLInputElement>('referenceLockBase');
    if (design) { design.disabled = state.baseShape === 'outline'; design.value = String(state.designSizePercent); }
    if (lock) { lock.disabled = state.baseShape === 'outline'; lock.checked = state.lockBaseSize; }
    const value = element('referenceDesignSizeValue');
    if (value) value.textContent = `${state.designSizePercent} %`;
    const hollow = element<HTMLInputElement>('referenceHollowBase');
    if (hollow) hollow.checked = state.hollowBase;
    const rim = element<HTMLInputElement>('referenceRimHeight');
    const rimValue = element('referenceRimValue');
    const rimMm = Math.max(0, Math.min(8, 2.4 + state.baseHeight - 16));
    if (rim && doc.activeElement !== rim) rim.value = String(rimMm);
    if (rimValue) rimValue.textContent = `${rimMm.toFixed(1)} mm`;
    const pocket = element('referencePocketValue');
    if (pocket) pocket.textContent = `${state.switchPocketFitPercent.toFixed(1)}%`;
  });
  const initial = store.get();
  element<HTMLInputElement>('referenceDesignSize')!.disabled = initial.baseShape === 'outline';
  element<HTMLInputElement>('referenceLockBase')!.disabled = initial.baseShape === 'outline';
  return unsubscribe;
}
