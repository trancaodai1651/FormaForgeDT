import { getClickerDocument } from '../runtime';
import { store, appData } from '../store/appState';
import { rebuild, reprocess, debouncedRebuild, debouncedQuietRebuild, debouncedReprocess, applyModelRecolor, processBottomImage } from '../core/engine';
import { createUi } from './index';
import { runWizard } from './wizard';
import { loadFileToImage } from '../image/decode';
import { importFontFile } from '../image/letter';
import { downloadThreeMF, downloadSTL } from '../export';
import { hexToRgb, downloadBlob } from '../utils/helpers';
import { saveProject, loadProject } from '../project/saveLoad';
import type { ClickerPart } from '../types';

function defaultSwitchLayout(n: number, capWidthMm: number) {
  if (n <= 1) return [{ x: 0, y: 0, rotation: 0 }];
  if (n === 2) { const x = Math.max(9, capWidthMm / 4); return [{ x: -x, y: 0, rotation: 0 }, { x, y: 0, rotation: 0 }]; }
  const p = Math.max(17, capWidthMm / 3); return [{ x: -p, y: 0, rotation: 0 }, { x: 0, y: 0, rotation: 0 }, { x: p, y: 0, rotation: 0 }];
}

export function setupUI(sidebarLeft: HTMLElement, sidebarRight: HTMLElement, statusEl: HTMLElement, viewer: any, screens: any, historyShortcuts: any) {
  
  // ðŸŸ¢ Cáº¥u hÃ¬nh UI cho Tool Clicker Generator
  const ui = createUi(sidebarLeft, sidebarRight, statusEl, {
    onBottomModeChange: (mode) => {
      store.set({ bottomBaseMode: mode });
      if (mode === 'match') {
        appData.bottomRegionSet = null;
        debouncedRebuild();
      } else if (mode === 'custom' && appData.bottomImage) {
        processBottomImage();
      }
    },
    
    onBottomUpload: (file) => {
      store.set({ building: true, status: 'Reading bottom imageâ€¦' });
      loadFileToImage(file).then(img => {
        appData.bottomImage = img;
        store.set({ bottomBaseMode: 'custom' });
        processBottomImage();
      }).catch(err => store.set({ building: false, status: 'Could not read image: ' + err }));
    },
    onBackToHome() { if (screens.toolScreen) screens.backToDashboard(screens.toolScreen); },
    onIsFlatKeychain(isFlat) { store.set({ isFlatKeychain: isFlat }); rebuild(); },
    
    onUpload: (file) => {
      store.set({ building: true, status: 'Reading imageâ€¦' });
      loadFileToImage(file).then(img => {
        store.set({ building: false, status: 'Preprocess your imageâ€¦' });
        runWizard({
          baseImage: img, initialColorCount: store.get().colorCount,
          onCancel: () => store.set({ status: 'Ready.' }),
          onComplete: (res) => {
            appData.originalImage = res.adjusted;
            store.set({ removeBg: !res.preprocess.keepBackground, colorCount: res.colorCount, topThickness: Math.max(1, res.preprocess.thicknessMm), colorMode: res.colorMode, limitedColors: res.limitedColors || [], paletteOverrides: res.paletteOverrides || [] });
            reprocess();
          }
        });
      }).catch(err => store.set({ building: false, status: 'Could not read image: ' + err }));
    },
    
    onSample: (load) => load().then(img => { appData.originalImage = img; reprocess(); }),
    onColorCount: (n) => { store.set({ colorCount: n }); debouncedReprocess(); },
    onFilament: (i, hex) => { if (store.get().palette[i]) applyModelRecolor({ kind: 'region', index: i, compIndex: 0 }, hexToRgb(hex), -1, viewer); },
    onShape: (kind) => { store.set({ baseShape: kind }); debouncedRebuild(); },
    onBorderWidth: (mm) => { store.set({ borderWidth: mm }); debouncedRebuild(); },
    onMergeTopFrame: (merge) => { store.set({ mergeTopFrame: merge }); debouncedRebuild(); },
    onKeepMeshesSeparate: (keep) => { store.set({ keepMeshesSeparate: keep }); debouncedRebuild(); },
    onWidth: (mm) => { store.set({ capWidthMm: mm }); debouncedRebuild(); },
    onBaseHeight: (mm) => { store.set({ baseHeight: mm }); debouncedRebuild(); },
    onTopThickness: (mm) => { store.set({ topThickness: mm }); debouncedRebuild(); },
    onImageDepth: (mm) => { store.set({ imageDepth: mm }); debouncedRebuild(); },
    onFlatKeychainThickness: (mm) => { if (!Number.isFinite(mm)) return; store.set({ flatKeychainThicknessMm: Math.max(1, Math.min(12, mm)) }); debouncedRebuild(); },
    onImageMargin: (mm) => { store.set({ imageMargin: mm }); debouncedRebuild(); },
    onSocketTolStep: (delta) => { store.set({ tolerance: Math.round(Math.max(0.1, Math.min(1.0, store.get().tolerance + delta)) * 100) / 100 }); debouncedRebuild(); },
    onStemTolStep: (delta) => { store.set({ stemTolerance: Math.round(Math.max(-1.0, Math.min(1.0, store.get().stemTolerance + delta)) * 10) / 10 }); debouncedRebuild(); },
    
    onSwitchNudge: (dx, dy) => {
      const s = store.get(); const i = Math.min(s.activeSwitchIndex, s.switches.length - 1);
      store.set({ switches: s.switches.map((sw: any, idx: number) => idx === i ? { ...sw, x: Math.max(-15, Math.min(15, sw.x + dx)), y: Math.max(-15, Math.min(15, sw.y + dy)) } : sw) });
      debouncedRebuild();
    },
    onSwitchRotate: (deltaDeg) => {
      const s = store.get(); const i = Math.min(s.activeSwitchIndex, s.switches.length - 1);
      store.set({ switches: s.switches.map((sw: any, idx: number) => idx === i ? { ...sw, rotation: Math.round(Math.max(-30, Math.min(30, sw.rotation + deltaDeg))) } : sw) });
      debouncedRebuild();
    },
    onSwitchReset: () => { const s = store.get(); store.set({ switches: s.switches.map((sw: any, idx: number) => (idx === Math.min(s.activeSwitchIndex, s.switches.length - 1) ? defaultSwitchLayout(s.switches.length, s.capWidthMm)[idx] : sw)) }); debouncedRebuild(); },
    onSwitchCount: (n) => { const s = store.get(); if (n !== s.switches.length) { store.set({ switches: defaultSwitchLayout(n, s.capWidthMm), activeSwitchIndex: 0 }); debouncedRebuild(); } },
    onActiveSwitch: (i) => store.set({ activeSwitchIndex: i }),
    onSwitchResetAll: () => { const s = store.get(); store.set({ switches: defaultSwitchLayout(s.switches.length, s.capWidthMm), activeSwitchIndex: 0 }); debouncedRebuild(); },
    
    onKeychainToggle: (on) => { store.set({ keychain: { ...store.get().keychain, enabled: on } }); debouncedRebuild(); },
    onKeychainRotate: (deltaDeg) => { const kc = store.get().keychain; store.set({ keychain: { ...kc, angleDeg: (((kc.angleDeg + deltaDeg) % 360) + 360) % 360 } }); debouncedRebuild(); },
    onKeychainSize: (deltaMm) => { const kc = store.get().keychain; store.set({ keychain: { ...kc, holeDiameterMm: Math.round(Math.max(3.0, Math.min(16.0, kc.holeDiameterMm + deltaMm)) * 10) / 10 } }); debouncedRebuild(); },
    onKeychainHoleDiameter: (mm) => { if (!Number.isFinite(mm)) return; const kc = store.get().keychain; store.set({ keychain: { ...kc, holeDiameterMm: Math.round(Math.max(3.0, Math.min(16.0, mm)) * 10) / 10 } }); debouncedRebuild(); },
    onKeychainOffset: (deltaMm) => { const kc = store.get().keychain; store.set({ keychain: { ...kc, offsetMm: Math.round(Math.max(-15.0, Math.min(15.0, (kc.offsetMm ?? 0) + deltaMm)) * 10) / 10 } }); debouncedRebuild(); },
    
    onSmoothing: (v) => { store.set({ smoothing: v }); if ((store.get().importMode === 'image' || store.get().importMode === 'hybrid') && appData.originalImage) debouncedReprocess(); },
    onRemoveBg: (on) => { store.set({ removeBg: on }); const mode = store.get().importMode; if (((mode === 'image' || mode === 'hybrid') && appData.originalImage) || (mode === 'svg' && appData.currentSvgText)) reprocess(); },
    onPhotoFlatten: (on) => { store.set({ photoFlatten: on }); if ((store.get().importMode === 'image' || store.get().importMode === 'hybrid') && appData.originalImage) debouncedReprocess(); },
    onView: (mode) => { store.set({ view: mode }); viewer.setView(mode); },
    onShowSwitch: (on) => { store.set({ showSwitch: on }); viewer.showSwitch(on); },
    onSection: (axis, pos) => viewer.setSection(axis, pos),
    
    onExport: () => { if (!appData.latestParts.length) return; downloadThreeMF(appData.latestParts, 'clicker.3mf'); },
    onExportSTL: () => { if (!appData.latestParts.length) return; downloadSTL(appData.latestParts, 'clicker.stl'); },
    onRenderPng: async () => { const blob = await viewer.renderToPng(); if (blob) downloadBlob(blob, 'clicker-render.png'); },
    onAiPrompt: async () => { await navigator.clipboard.writeText("Create a simple, flat vector-style illustration suitable for a small multi-color 3D print..."); store.set({ status: 'AI prompt copied âœ“' }); },
    
    onSaveProject: () => saveProject(),
    onLoadProject: (file) => loadProject(file, reprocess, rebuild, ui),
    onBodyColor: (hex) => { const idx = appData.latestParts.findIndex((p) => p.name === 'base-body'); if (idx >= 0) applyModelRecolor({ kind: 'body' }, hexToRgb(hex), idx, viewer); else store.set({ bodyColorRgb: hexToRgb(hex) }); },
    
    onImportMode: (mode) => { const s = store.get(); store.set({ importMode: mode, view: mode === 'blocks' || mode === 'hybrid' ? 'assembled' : s.view, baseShape: mode === 'text' || mode === 'blocks' || mode === 'hybrid' ? 'outline' : s.baseShape, colorMode: mode !== 'image' && mode !== 'hybrid' ? 'normal' : s.colorMode, imageMargin: mode === 'text' || mode === 'blocks' ? 2.5 : 1.2, borderWidth: mode === 'text' || mode === 'blocks' ? 3.5 : 2.6, blockKeycapShape: mode === 'hybrid' ? 'rounded' : s.blockKeycapShape }); reprocess(); },
    onSvgUpload: async (file) => { try { store.set({ building: true, status: 'Reading SVGâ€¦' }); const svgText = await file.text(); ui.addUploadedSvg(svgText, file.name.replace(/\.svg$/i, '')); store.set({ building: false }); } catch (err) { store.set({ building: false, status: 'Error: ' + err }); } },
    onSelectSvg: (svgText, name) => { appData.currentSvgText = svgText; appData.currentSvgName = name; store.set({ status: `Selected SVG: ${name}` }); },
    onSelectIcon: (svgText, name) => { appData.currentIconText = svgText; appData.currentIconName = name; store.set({ currentIconName: name, status: `Selected icon: ${name}` }); },
    onTextChange: (text) => { appData.currentText = text; store.set({ status: 'Text updated.' }); },
    onBlockText: (text) => {
      const chars = Array.from(text.replace(/\s+/g, '')).slice(0, 12);
      store.set({ blockSlots: (chars.length ? chars : ['N', 'a', 'm', 'e']).map(ch => ({ kind: 'char' as const, ch })) });
      // Font parsing and worker builds are expensive. Do not block the input
      // event for every character; build once after typing pauses.
      debouncedReprocess();
    },
    onBlockOrientation: (orientation) => { store.set({ blockOrientation: orientation }); debouncedRebuild(); },
    onLegendScale: (scale) => { store.set({ legendScale: Math.max(0.5, Math.min(1.4, scale)) }); debouncedRebuild(); },
    onLegendBold: (bold) => { store.set({ legendBold: Math.max(-0.3, Math.min(0.8, bold)) }); debouncedRebuild(); },
    onBlockKeycapGap: (value) => { store.set({ blockKeycapGapMm: Math.max(0, Math.min(3, value)) }); debouncedRebuild(); },
    onBlockFlatBottom: (value) => { store.set({ blockFlatBottom: value }); debouncedRebuild(); },
    onBlockBaseHeight: (value) => { store.set({ blockBaseHeightMm: Math.max(8, Math.min(30, value)) }); debouncedRebuild(); },
    onBlockModuleThickness: (value) => { store.set({ blockModuleThicknessMm: Math.max(8, Math.min(40, value)) }); debouncedRebuild(); },
    onBlockModuleSideThickness: (value) => { store.set({ blockModuleSideThicknessMm: Math.max(0, Math.min(33, value)) }); debouncedRebuild(); },
    onPlateChange: (id) => { store.set({ plateId: id }); },
    onBlockBaseCornerRadius: (value) => { store.set({ blockBaseCornerRadiusMm: Math.max(0.5, Math.min(8, value)) }); debouncedRebuild(); },
    onBlockKeycapHeight: (value) => { store.set({ blockKeycapHeightMm: Math.max(6, Math.min(18, value)) }); debouncedRebuild(); },
    onBlockKeycapCornerRadius: (value) => { store.set({ blockKeycapCornerRadiusMm: Math.max(0.8, Math.min(7, value)) }); debouncedRebuild(); },
    onBlockKeycapShape: (shape) => { store.set({ blockKeycapShape: shape }); debouncedRebuild(); },
    onBlockKeycapMount: (mount) => { store.set({ blockKeycapMount: mount }); debouncedRebuild(); },
    onBlockKeycapProfile: (profile) => { store.set({ blockKeycapProfile: profile }); debouncedRebuild(); },
    onBlockKeySize: (unit) => { store.set({ blockKeycapUnit: Math.max(1, Math.min(6.5, unit)) }); debouncedRebuild(); },
    onHybridImageSize: (sizeMm) => { store.set({ hybridImageSizeMm: Math.max(30, Math.min(140, sizeMm)) }); debouncedRebuild(); },
    onHybridImageThickness: (value) => { const base = store.get().hybridBaseThicknessMm; store.set({ hybridImageThicknessMm: Math.max(base, Math.min(24, value)) }); debouncedRebuild(); },
    onHybridImagePadding: (value) => { store.set({ hybridImagePaddingMm: Math.max(0, Math.min(20, value)) }); debouncedRebuild(); },
    onHybridKeychainHeight: (value) => { store.set({ hybridKeychainHeightMm: Math.max(1, Math.min(15, value)) }); debouncedRebuild(); },
    onHybridImageExtrude: (value) => { store.set({ hybridImageExtrudeMm: Math.max(0, Math.min(6, value)) }); debouncedRebuild(); },
    onHybridTextExtrude: (value) => { store.set({ hybridTextExtrudeMm: Math.max(0, Math.min(5, value)) }); debouncedRebuild(); },
    onHybridBaseWidth: (value) => { store.set({ hybridBaseWidthMm: Math.max(20, Math.min(60, value)) }); debouncedRebuild(); },
    onHybridBaseEndPadding: (value) => { store.set({ hybridBaseEndPaddingMm: Math.max(10, Math.min(35, value)) }); debouncedRebuild(); },
    onHybridKeycapSpacing: (value) => { store.set({ hybridKeycapSpacingMm: Math.max(0, Math.min(15, value)) }); debouncedRebuild(); },
    onHybridKeycapClearance: (value) => { store.set({ hybridKeycapClearanceMm: Math.max(0.2, Math.min(4, value)) }); debouncedRebuild(); },
    onHybridBaseThickness: (value) => { const thickness = Math.max(5, Math.min(20, value)); store.set({ hybridBaseThicknessMm: thickness, hybridImageThicknessMm: Math.max(thickness, store.get().hybridImageThicknessMm) }); debouncedRebuild(); },
    onHybridBaseCornerRadius: (value) => { store.set({ hybridBaseCornerRadiusMm: Math.max(1, Math.min(14, value)) }); debouncedRebuild(); },
    onHybridBaseWallHeight: (value) => { store.set({ hybridBaseWallHeightMm: Math.max(0, Math.min(8, value)) }); debouncedRebuild(); },
    onHybridNeckLength: (value) => { store.set({ hybridNeckLengthMm: Math.max(0, Math.min(30, value)) }); debouncedRebuild(); },
    onHybridBaseImageOverlap: (value) => { store.set({ hybridBaseImageOverlapMm: Math.max(0, Math.min(20, value)) }); debouncedRebuild(); },
    onHybridNeckWidth: (value) => { store.set({ hybridNeckWidthMm: Math.max(8, Math.min(40, value)) }); debouncedRebuild(); },
    onFontSelect: (fontId) => { appData.currentFontId = fontId; if (store.get().importMode === 'blocks' || store.get().importMode === 'hybrid') reprocess(); else store.set({ status: 'Font changed.' }); },
    onImportFont: async (file) => {
      try {
        store.set({ building: true });
        const font = await importFontFile(file);
        ui.addFontOption(font, store.get().importMode === 'blocks' || store.get().importMode === 'hybrid');
        appData.currentFontId = font.id;
        store.set({ building: false, status: `Font ${font.name} imported!` });
        if (store.get().importMode === 'blocks' || store.get().importMode === 'hybrid') reprocess();
      } catch (err) {
        store.set({ building: false, status: 'Error: ' + err });
      }
    },
    
    onThemeChange: (theme) => { getClickerDocument().documentElement.setAttribute('data-theme', theme); localStorage.setItem('clicker-theme', theme); viewer.setTheme(theme); },
    onGenerate: () => reprocess(),
    onEditMode: (mode) => store.set({ editMode: mode, selectedParts: mode === 'color' ? [] : store.get().selectedParts }),
    
    onEdgeStyle: (target: string, style: any) => { const s = store.get(); const edgeSettings = [...s.edgeSettings]; const idx = edgeSettings.findIndex(x => x.target === target); if (idx >= 0) { edgeSettings[idx] = { ...edgeSettings[idx], style, radius: style !== 'none' && (!edgeSettings[idx].radius || edgeSettings[idx].radius < 0.2) ? 1.0 : edgeSettings[idx].radius }; } else { edgeSettings.push({ target, style, radius: style === 'none' ? 0 : 1.0 }); } store.set({ edgeSettings }); debouncedQuietRebuild(); },
    onEdgeStep: (target: string, delta: number) => { const s = store.get(); const edgeSettings = [...s.edgeSettings]; const idx = edgeSettings.findIndex(x => x.target === target); const next = Math.max(0.2, Math.min(5.0, (idx >= 0 ? edgeSettings[idx].radius : 1.0) + delta)); if (idx >= 0) { edgeSettings[idx] = { ...edgeSettings[idx], radius: next }; } else { edgeSettings.push({ target, style: 'chamfer', radius: next }); } store.set({ edgeSettings }); debouncedQuietRebuild(); },
    
    onExtrudeStep: (delta: number) => { const s = store.get(); if (s.selectedParts.length === 0) return; const componentHeights = { ...s.componentHeights }; let changed = false; for (const partName of s.selectedParts) { const current = componentHeights[partName] ?? 0; const next = Math.max(-5, Math.min(6, current + delta)); if (current !== next) { componentHeights[partName] = next; changed = true; } } if (changed) { store.set({ componentHeights }); debouncedQuietRebuild(); } },
    onExtrudeChamfer: (on) => { store.set({ extrudeChamfer: on }); debouncedQuietRebuild(); },
    onSeparateLetters: (on) => { store.set({ separateLetters: on, selectedParts: [] }); reprocess(); },
    
    onUndo: () => historyShortcuts.undo(),
    onRedo: () => historyShortcuts.redo(),
    onRefresh: () => historyShortcuts.refreshDesign(),
  });

  let renderedPlateId = store.get().plateId;
  viewer.setPlate(renderedPlateId);

  // Sá»± kiá»‡n nháº­n yÃªu cáº§u hiá»‡n báº£ng chá»n mÃ u tá»« Engine
  getClickerDocument().addEventListener('show-color-popover', ((e: CustomEvent) => {
    ui.showColorPopoverAt(e.detail.clientX, e.detail.clientY, e.detail.hex, e.detail.options, {
      onSelect: (hex: string) => applyModelRecolor(e.detail.target, hexToRgb(hex), e.detail.index, viewer),
      onClose: () => store.set({ selectedParts: [] }),
    });
  }) as EventListener);

  store.subscribe((s) => {
    ui.update(s);
    if (s.plateId !== renderedPlateId) {
      renderedPlateId = s.plateId;
      viewer.setPlate(renderedPlateId);
    }
    const indices: number[] = [];
    s.selectedParts.forEach((name: string) => { const idx = appData.latestParts.findIndex((p: ClickerPart) => p.name === name); if (idx >= 0) indices.push(idx); });
    viewer.highlightParts(indices);
    
    import('../store/historyManager').then(m => {
      if (!m.pendingHistoryReset) m.commitHistory();
    });
  });

  ui.update(store.get());
}



