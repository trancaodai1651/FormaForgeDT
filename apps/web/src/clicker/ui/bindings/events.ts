import { store } from '../../store/appState';
import { debouncedRebuild } from '../../core/engine';
import { $, bindValInput } from '../helpers';
import type { UiCallbacks } from '../types';
import { SWITCH_STEP } from '../constants';

export function bindGlobalEvents(cb: UiCallbacks) {
  const modelFile = $<HTMLInputElement>('modelPreviewFile');
  const importModelFile = (file?: File) => {
    if (!file || !/\.(stl|3mf)$/i.test(file.name)) return;
    cb.onModelImport(file);
    if (modelFile) modelFile.value = '';
  };
  modelFile?.addEventListener('change', () => importModelFile(modelFile.files?.[0]));
  $('modelPreviewDrop')?.addEventListener('dragover', (event: DragEvent) => {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.add('dragging');
  });
  $('modelPreviewDrop')?.addEventListener('dragleave', (event: DragEvent) => {
    (event.currentTarget as HTMLElement).classList.remove('dragging');
  });
  $('modelPreviewDrop')?.addEventListener('drop', (event: DragEvent) => {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.remove('dragging');
    importModelFile(event.dataTransfer?.files?.[0]);
  });
  // The reference viewer also feels like a drop target. Allow dropping a model
  // directly onto the 3D viewport in addition to the explicit import card.
  const viewport = $('viewport');
  viewport?.addEventListener('dragover', (event: DragEvent) => {
    if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
  });
  viewport?.addEventListener('drop', (event: DragEvent) => {
    if (!event.dataTransfer?.files.length) return;
    event.preventDefault();
    importModelFile(event.dataTransfer.files[0]);
  });
  $('modelPreviewTabs')?.addEventListener('click', (event: MouseEvent) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-preview-source]');
    if (button && !button.hasAttribute('disabled')) cb.onModelPreviewSource(button.dataset.previewSource as 'generated' | 'imported');
  });
  const modelColor = $<HTMLInputElement>('modelPreviewColor');
  modelColor?.addEventListener('input', () => cb.onModelColor(modelColor.value));
  $('modelPreviewClear')?.addEventListener('click', () => cb.onModelClear());
  for (const axis of ['x', 'y', 'z'] as const) {
    $<HTMLInputElement>(`modelRotate${axis.toUpperCase()}`)?.addEventListener('input', (event: Event) => {
      cb.onModelRotation(axis, +(event.target as HTMLInputElement).value);
    });
  }
  $('modelTransformReset')?.addEventListener('click', () => cb.onModelTransformReset());

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
  $('hybridImageSize')?.addEventListener('input', (e: Event) => cb.onHybridImageSize(+(e.target as HTMLInputElement).value));
  $('hybridImageThickness')?.addEventListener('input', (e: Event) => cb.onHybridImageThickness(+(e.target as HTMLInputElement).value));
  $('hybridImagePadding')?.addEventListener('input', (e: Event) => cb.onHybridImagePadding(+(e.target as HTMLInputElement).value));
  $('hybridKeychainHeight')?.addEventListener('input', (e: Event) => cb.onHybridKeychainHeight(+(e.target as HTMLInputElement).value));
  $('hybridKeychainPosition')?.addEventListener('change', (e: Event) => cb.onHybridKeychainPosition((e.target as HTMLSelectElement).value as 'top' | 'bottom'));
  $('hybridImageExtrude')?.addEventListener('input', (e: Event) => cb.onHybridImageExtrude(+(e.target as HTMLInputElement).value));
  $('hybridTextExtrude')?.addEventListener('input', (e: Event) => cb.onHybridTextExtrude(+(e.target as HTMLInputElement).value));
  $('hybridBaseWidth')?.addEventListener('input', (e: Event) => cb.onHybridBaseWidth(+(e.target as HTMLInputElement).value));
  $('hybridBaseEndPadding')?.addEventListener('input', (e: Event) => cb.onHybridBaseEndPadding(+(e.target as HTMLInputElement).value));
  $('hybridKeycapSpacing')?.addEventListener('input', (e: Event) => cb.onHybridKeycapSpacing(+(e.target as HTMLInputElement).value));
  $('hybridKeycapClearance')?.addEventListener('input', (e: Event) => cb.onHybridKeycapClearance(+(e.target as HTMLInputElement).value));
  $('hybridBaseThickness')?.addEventListener('input', (e: Event) => cb.onHybridBaseThickness(+(e.target as HTMLInputElement).value));
  $('hybridBaseCornerRadius')?.addEventListener('input', (e: Event) => cb.onHybridBaseCornerRadius(+(e.target as HTMLInputElement).value));
  $('hybridBaseStyle')?.addEventListener('change', (e: Event) => cb.onHybridBaseStyle((e.target as HTMLSelectElement).value as 'straight' | 'rounded' | 'vase'));
  $('hybridVaseProfile')?.addEventListener('change', (e: Event) => cb.onHybridVaseProfile((e.target as HTMLSelectElement).value as 'straight' | 'wavy'));
  $('hybridVaseWaviness')?.addEventListener('input', (e: Event) => cb.onHybridVaseWaviness(+(e.target as HTMLInputElement).value));
  $('hybridVaseThickness')?.addEventListener('input', (e: Event) => cb.onHybridVaseThickness(+(e.target as HTMLInputElement).value));
  $('hybridVaseGap')?.addEventListener('input', (e: Event) => cb.onHybridVaseGap(+(e.target as HTMLInputElement).value));
  $('imageBaseStyle')?.addEventListener('change', (e: Event) => cb.onHybridBaseStyle((e.target as HTMLSelectElement).value as 'straight' | 'rounded' | 'vase'));
  $('imageBaseCornerRadius')?.addEventListener('input', (e: Event) => cb.onHybridBaseCornerRadius(+(e.target as HTMLInputElement).value));
  $('imageVaseProfile')?.addEventListener('change', (e: Event) => cb.onHybridVaseProfile((e.target as HTMLSelectElement).value as 'straight' | 'wavy'));
  $('imageVaseWaviness')?.addEventListener('input', (e: Event) => cb.onHybridVaseWaviness(+(e.target as HTMLInputElement).value));
  $('imageVaseThickness')?.addEventListener('input', (e: Event) => cb.onHybridVaseThickness(+(e.target as HTMLInputElement).value));
  $('imageVaseGap')?.addEventListener('input', (e: Event) => cb.onHybridVaseGap(+(e.target as HTMLInputElement).value));
  $('hybridBaseWallHeight')?.addEventListener('input', (e: Event) => cb.onHybridBaseWallHeight(+(e.target as HTMLInputElement).value));
  $('hybridNeckLength')?.addEventListener('input', (e: Event) => cb.onHybridNeckLength(+(e.target as HTMLInputElement).value));
  $('hybridBaseImageOverlap')?.addEventListener('input', (e: Event) => cb.onHybridBaseImageOverlap(+(e.target as HTMLInputElement).value));
  $('hybridNeckWidth')?.addEventListener('input', (e: Event) => cb.onHybridNeckWidth(+(e.target as HTMLInputElement).value));
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
  const flatKeychainThickness = $<HTMLInputElement>('flatKeychainThickness'); flatKeychainThickness?.addEventListener('input', () => cb.onFlatKeychainThickness(+flatKeychainThickness.value));
  const margin = $<HTMLInputElement>('margin'); margin?.addEventListener('input', () => cb.onImageMargin(+margin.value));
  const borderWidth = $<HTMLInputElement>('borderwidth'); borderWidth?.addEventListener('input', () => cb.onBorderWidth(+borderWidth.value));

  bindValInput('smoothVal', 'smooth', cb.onSmoothing, (v: number) => v / 100);
  bindValInput('widthVal', 'width', cb.onWidth);
  bindValInput('baseHeightVal', 'baseHeight', cb.onBaseHeight);
  bindValInput('topthickVal', 'topthick', cb.onTopThickness);
  bindValInput('imgdepthVal', 'imgdepth', cb.onImageDepth);
  bindValInput('flatKeychainThicknessVal', 'flatKeychainThickness', cb.onFlatKeychainThickness);
  bindValInput('marginVal', 'margin', cb.onImageMargin);
  bindValInput('borderwidthVal', 'borderwidth', cb.onBorderWidth);
  bindValInput('hybridImagePaddingVal', 'hybridImagePadding', cb.onHybridImagePadding);
  bindValInput('hybridKeychainHeightVal', 'hybridKeychainHeight', cb.onHybridKeychainHeight);

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
  $('keychainHoleDiameter')?.addEventListener('input', (e: Event) => cb.onKeychainHoleDiameter(+(e.target as HTMLInputElement).value));

  // --- Bottom Base Alignment & Expansion Controls ---
  const baseExpand = $<HTMLInputElement>('baseExpand');
  baseExpand?.addEventListener('input', () => {
    const val = +baseExpand.value;
    if ($('baseExpandVal')) $('baseExpandVal').textContent = `${val}%`;
    store.set({ bottomExpandPercent: val } as any);
    debouncedRebuild();
  });

  const basePadding = $<HTMLInputElement>('basePadding');
  basePadding?.addEventListener('input', () => {
    const val = Math.max(0, Math.min(12, +basePadding.value));
    if ($('basePaddingVal')) $('basePaddingVal').textContent = `${val.toFixed(1)} mm`;
    store.set({ bottomPaddingMm: val } as any);
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
