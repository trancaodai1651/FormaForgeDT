import { store } from '../../store/appState';
import { debouncedRebuild } from '../../core/engine';
import { $, bindValInput } from '../helpers';
import type { UiCallbacks } from '../types';
import { SWITCH_STEP } from '../constants';

export function bindGlobalEvents(cb: UiCallbacks) {
  // --- Home & History ---
  $('btnBackHome')?.addEventListener('click', () => cb.onBackToHome());
  $('undoBtn')?.addEventListener('click', () => cb.onUndo());
  $('redoBtn')?.addEventListener('click', () => cb.onRedo());
  $('refreshBtn')?.addEventListener('click', () => cb.onRefresh());
  $('importTabs')?.addEventListener('click', (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-mode]') as HTMLElement | null;
    if (target?.dataset.mode) cb.onImportMode(target.dataset.mode as any);
  });
  $('blockOrient')?.addEventListener('click', (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-orient]') as HTMLElement | null;
    if (target?.dataset.orient) cb.onBlockOrientation(target.dataset.orient as 'horizontal' | 'vertical');
  });
  $('legendSize')?.addEventListener('input', (e: Event) => cb.onLegendScale(+(e.target as HTMLInputElement).value));
  $('legendBold')?.addEventListener('input', (e: Event) => cb.onLegendBold(+(e.target as HTMLInputElement).value));
  $('blockKeycapGap')?.addEventListener('input', (e: Event) => cb.onBlockKeycapGap(+(e.target as HTMLInputElement).value));
  $('blockFlatBottom')?.addEventListener('change', (e: Event) => cb.onBlockFlatBottom((e.target as HTMLInputElement).checked));
  $('blockBaseHeight')?.addEventListener('input', (e: Event) => cb.onBlockBaseHeight(+(e.target as HTMLInputElement).value));
  $('blockModuleThickness')?.addEventListener('input', (e: Event) => cb.onBlockModuleThickness(+(e.target as HTMLInputElement).value));
  $('blockModuleSideThickness')?.addEventListener('input', (e: Event) => cb.onBlockModuleSideThickness(+(e.target as HTMLInputElement).value));
  $('blockBaseCornerRadius')?.addEventListener('input', (e: Event) => cb.onBlockBaseCornerRadius(+(e.target as HTMLInputElement).value));
  $('blockKeycapHeight')?.addEventListener('input', (e: Event) => cb.onBlockKeycapHeight(+(e.target as HTMLInputElement).value));
  $('blockKeycapThickness')?.addEventListener('input', (e: Event) => cb.onBlockKeycapThickness(+(e.target as HTMLInputElement).value));
  $('blockKeycapCornerRadius')?.addEventListener('input', (e: Event) => cb.onBlockKeycapCornerRadius(+(e.target as HTMLInputElement).value));
  $('blockKeycapShape')?.addEventListener('click', (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-keycap-shape]') as HTMLElement | null;
    if (target?.dataset.keycapShape) cb.onBlockKeycapShape(target.dataset.keycapShape as 'rounded' | 'square');
  });
  $('blockKeycapMount')?.addEventListener('click', (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-keycap-mount]') as HTMLElement | null;
    if (target?.dataset.keycapMount) cb.onBlockKeycapMount(target.dataset.keycapMount as 'above' | 'recessed');
  });
  $('blockKeycapProfile')?.addEventListener('change', (e: Event) => cb.onBlockKeycapProfile((e.target as HTMLSelectElement).value as 'standard' | 'low' | 'thocky' | 'choc-v1'));
  $('blockKeySize')?.addEventListener('change', (e: Event) => cb.onBlockKeySize(+(e.target as HTMLSelectElement).value));
  $('hybridSquareModuleBase')?.addEventListener('change', (e: Event) => cb.onHybridSquareModuleBase((e.target as HTMLInputElement).checked));
  $('hybridImageSize')?.addEventListener('input', (e: Event) => cb.onHybridImageSize(+(e.target as HTMLInputElement).value));

  // --- Color Count & Smoothing ---
  const ccount = $<HTMLSelectElement>('ccount');
  ccount?.addEventListener('change', () => cb.onColorCount(+ccount.value));

  const smooth = $<HTMLInputElement>('smooth'); 
  smooth?.addEventListener('input', () => cb.onSmoothing(+smooth.value));

  // --- View Mode & Show Switch ---
  $('viewTabs')?.addEventListener('click', (e: MouseEvent) => {
    const t = (e.target as HTMLElement).closest('[data-view]') as HTMLElement | null;
    if (t && t.dataset.view) cb.onView(t.dataset.view as any);
  });
  $<HTMLInputElement>('showswitch')?.addEventListener('change', (e: Event) =>
    cb.onShowSwitch((e.target as HTMLInputElement).checked)
  );

  // --- Sliders & Input Range ---
  const width = $<HTMLInputElement>('width'); width?.addEventListener('input', () => cb.onWidth(+width.value));
  const baseHeight = $<HTMLInputElement>('baseHeight'); baseHeight?.addEventListener('input', () => cb.onBaseHeight(+baseHeight.value));
  const topthick = $<HTMLInputElement>('topthick'); topthick?.addEventListener('input', () => cb.onTopThickness(+topthick.value));
  const imgdepth = $<HTMLInputElement>('imgdepth'); imgdepth?.addEventListener('input', () => cb.onImageDepth(+imgdepth.value));
  const margin = $<HTMLInputElement>('margin'); margin?.addEventListener('input', () => cb.onImageMargin(+margin.value));
  const borderWidth = $<HTMLInputElement>('borderwidth'); borderWidth?.addEventListener('input', () => cb.onBorderWidth(+borderWidth.value));

  bindValInput('smoothVal', 'smooth', cb.onSmoothing, (v: number) => v / 100);
  bindValInput('widthVal', 'width', cb.onWidth);
  bindValInput('baseHeightVal', 'baseHeight', cb.onBaseHeight);
  bindValInput('topthickVal', 'topthick', cb.onTopThickness);
  bindValInput('imgdepthVal', 'imgdepth', cb.onImageDepth);
  bindValInput('marginVal', 'margin', cb.onImageMargin);
  bindValInput('borderwidthVal', 'borderwidth', cb.onBorderWidth);

  // --- Checkboxes ---
  $<HTMLInputElement>('removebg')?.addEventListener('change', (e: Event) => cb.onRemoveBg((e.target as HTMLInputElement).checked));
  $<HTMLInputElement>('removebgSvg')?.addEventListener('change', (e: Event) => cb.onRemoveBg((e.target as HTMLInputElement).checked));
  $<HTMLInputElement>('photoFlatten')?.addEventListener('change', (e: Event) => cb.onPhotoFlatten((e.target as HTMLInputElement).checked));
  $<HTMLInputElement>('mergeTopFrame')?.addEventListener('change', (e: Event) => cb.onMergeTopFrame((e.target as HTMLInputElement).checked));
  $<HTMLInputElement>('keepMeshesSeparate')?.addEventListener('change', (e: Event) => cb.onKeepMeshesSeparate((e.target as HTMLInputElement).checked));
  $<HTMLInputElement>('keychain')?.addEventListener('change', (e: Event) => cb.onKeychainToggle((e.target as HTMLInputElement).checked));
  $<HTMLInputElement>('isFlatKeychain')?.addEventListener('change', (e: Event) => cb.onIsFlatKeychain((e.target as HTMLInputElement).checked));

  // --- Keychain Steppers ---
  $('keychainRotMinus')?.addEventListener('click', () => cb.onKeychainRotate(-15));
  $('keychainRotPlus')?.addEventListener('click', () => cb.onKeychainRotate(15));
  $('keychainOffsetMinus')?.addEventListener('click', () => cb.onKeychainOffset(-1.0));
  $('keychainOffsetPlus')?.addEventListener('click', () => cb.onKeychainOffset(1.0));
  $('keychainSizeMinus')?.addEventListener('click', () => cb.onKeychainSize(-0.4));
  $('keychainSizePlus')?.addEventListener('click', () => cb.onKeychainSize(0.4));

  // --- Bottom Base Alignment & Expansion Controls ---
  const baseExpand = $<HTMLInputElement>('baseExpand');
  baseExpand?.addEventListener('input', () => {
    const val = +baseExpand.value;
    if ($('baseExpandVal')) $('baseExpandVal').textContent = `${val}%`;
    store.set({ bottomExpandPercent: val } as any);
    debouncedRebuild();
  });

  $('baseRotLeft')?.addEventListener('click', () => {
    const s = store.get() as any;
    store.set({ bottomRotation: ((s.bottomRotation ?? 0) - 15) } as any);
    debouncedRebuild();
  });
  $('baseRotRight')?.addEventListener('click', () => {
    const s = store.get() as any;
    store.set({ bottomRotation: ((s.bottomRotation ?? 0) + 15) } as any);
    debouncedRebuild();
  });
  $('baseNudgeUp')?.addEventListener('click', () => {
    const s = store.get() as any;
    store.set({ bottomOffsetY: (s.bottomOffsetY ?? 0) + 1.0 } as any);
    debouncedRebuild();
  });
  $('baseNudgeDown')?.addEventListener('click', () => {
    const s = store.get() as any;
    store.set({ bottomOffsetY: (s.bottomOffsetY ?? 0) - 1.0 } as any);
    debouncedRebuild();
  });
  $('baseNudgeLeft')?.addEventListener('click', () => {
    const s = store.get() as any;
    store.set({ bottomOffsetX: (s.bottomOffsetX ?? 0) - 1.0 } as any);
    debouncedRebuild();
  });
  $('baseNudgeRight')?.addEventListener('click', () => {
    const s = store.get() as any;
    store.set({ bottomOffsetX: (s.bottomOffsetX ?? 0) + 1.0 } as any);
    debouncedRebuild();
  });
  $('baseResetPos')?.addEventListener('click', () => {
    store.set({ bottomOffsetX: 0, bottomOffsetY: 0, bottomRotation: 0 } as any);
    debouncedRebuild();
  });
  $<HTMLInputElement>('bottomSolidOnly')?.addEventListener('change', (e: Event) => {
    store.set({ bottomSolidOnly: (e.target as HTMLInputElement).checked } as any);
    debouncedRebuild();
  });

  // --- Tolerance Steppers ---
  $('socketTolMinus')?.addEventListener('click', () => cb.onSocketTolStep(-0.05));
  $('socketTolPlus')?.addEventListener('click', () => cb.onSocketTolStep(0.05));
  $('stemTolMinus')?.addEventListener('click', () => cb.onStemTolStep(-0.2));
  $('stemTolPlus')?.addEventListener('click', () => cb.onStemTolStep(0.2));

  // --- Switch Count & Pad Controls ---
  $('switchCount')?.addEventListener('click', (e: MouseEvent) => {
    const t = (e.target as HTMLElement).closest('[data-count]') as HTMLElement | null;
    if (t) cb.onSwitchCount(+t.dataset.count!);
  });
  $('switchChips')?.addEventListener('click', (e: MouseEvent) => {
    const t = (e.target as HTMLElement).closest('[data-sw]') as HTMLElement | null;
    if (t) cb.onActiveSwitch(+t.dataset.sw!);
  });
  $('switchResetAll')?.addEventListener('click', () => cb.onSwitchResetAll());
  $('switchReset')?.addEventListener('click', () => cb.onSwitchReset());

  $('switchPad')?.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const rotBtn = target.closest('[data-rot]') as HTMLElement | null;
    if (rotBtn) {
      cb.onSwitchRotate(+rotBtn.dataset.rot!);
      return;
    }
    const btn = target.closest('[data-dir]') as HTMLElement | null;
    if (!btn) return;
    switch (btn.dataset.dir) {
      case 'up': cb.onSwitchNudge(0, SWITCH_STEP); break;
      case 'down': cb.onSwitchNudge(0, -SWITCH_STEP); break;
      case 'left': cb.onSwitchNudge(-SWITCH_STEP, 0); break;
      case 'right': cb.onSwitchNudge(SWITCH_STEP, 0); break;
    }
  });

  // --- Shape Type & Select ---
  $('shapeTypeTabs')?.addEventListener('click', (e: MouseEvent) => {
    const t = (e.target as HTMLElement).closest('[data-style]') as HTMLElement | null;
    if (t) cb.onShape(t.dataset.style === 'outline' ? 'outline' : $<HTMLSelectElement>('shapeSelect').value as any);
  });
  $<HTMLSelectElement>('shapeSelect')?.addEventListener('change', (e: Event) => cb.onShape((e.target as HTMLSelectElement).value as any));

  // --- Global Edges ---
  $('globalEdges')?.addEventListener('click', (e: MouseEvent) => {
    const el = e.target as HTMLElement;
    const styleBtn = el.closest('.edge-style-btn') as HTMLElement | null;
    if (styleBtn) {
      const btnsRow = styleBtn.closest('.edge-style-btns') as HTMLElement;
      const target = btnsRow.dataset.edge;
      if (target) cb.onEdgeStyle(target, styleBtn.dataset.style as any);
      return;
    }
    const minus = el.closest('.edge-size-minus');
    const plus = el.closest('.edge-size-plus');
    if (minus || plus) {
      const sizeRow = el.closest('.edge-size-btns') as HTMLElement;
      const target = sizeRow.dataset.edge;
      if (target) cb.onEdgeStep(target, minus ? -0.2 : 0.2);
    }
  });

  // --- Export & Save/Load ---
  $('export')?.addEventListener('click', () => cb.onExport());
  $('exportStl')?.addEventListener('click', () => cb.onExportSTL());
  $('saveProj')?.addEventListener('click', () => cb.onSaveProject());
  
  const projFile = $<HTMLInputElement>('projFile');
  $('loadProj')?.addEventListener('click', () => projFile.click());
  projFile?.addEventListener('change', () => { if (projFile.files?.[0]) cb.onLoadProject(projFile.files[0]); projFile.value = ''; });

  // --- 3D Surface Profile Events ---
  $('topProfileTabs')?.addEventListener('click', (e: MouseEvent) => {
    const t = (e.target as HTMLElement).closest('[data-profile]') as HTMLElement | null;
    if (t) {
      store.set({ topProfile: t.dataset.profile } as any);
      debouncedRebuild();
    }
  });

  const profileHeight = $<HTMLInputElement>('profileHeight');
  profileHeight?.addEventListener('input', () => {
    const val = +profileHeight.value;
    if ($('profileHeightVal')) $('profileHeightVal').textContent = `${val.toFixed(1)} mm`;
    store.set({ topProfileHeight: val } as any);
    debouncedRebuild();
  });
}
