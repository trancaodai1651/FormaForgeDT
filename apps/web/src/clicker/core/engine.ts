import { getClickerDocument } from '../runtime';
import { store, appData } from '../store/appState';
import { processImage } from '../image/pipeline';
import { parseSvg } from '../image/logo';
import { parseLetter } from '../image/letter';
import { buildSvg, LUCIDE_ICONS } from '../image/lucideIcons';
import { setPendingHistoryReset } from '../store/historyManager';
import { rgbToHex, firstLine, debounce } from '../utils/helpers';
import type { BuildParams, BuildRegion, GeometryResponse, PaletteEntry, RGB, ColorTarget, ClickerPart } from '../types';

export const worker = new Worker(new URL('../workers/geometry.worker.ts', import.meta.url), { type: 'module' });

const LIGHT_FRAME: RGB = [240, 240, 240];
const DARK_FRAME: RGB = [38, 38, 42];

// ---- Khá»Ÿi táº¡o Engine & Worker ----
export function setupEngine(viewer: any, initAssetsFn: () => void, loadDefaultClickerFn: () => void) {
  worker.onmessage = (e: MessageEvent<GeometryResponse>) => {
    const msg = e.data;
    switch (msg.type) {
      case 'status':
        store.set({ status: msg.message });
        break;
      case 'ready':
        initAssetsFn();
        break;
      case 'initDone':
        appData.assetsReady = true;
        viewer.setSwitch(msg.switchMesh);
        viewer.showSwitch(store.get().showSwitch);
        store.set({ status: 'Ready. Import an image, SVG, icon, or text.' });

        if (store.get().importMode === 'icon' && !appData.currentIconText) {
          const first = LUCIDE_ICONS.find((ic) => ic.name === 'circle') || LUCIDE_ICONS[0];
          if (first) {
            appData.currentIconText = buildSvg(first.node);
            appData.currentIconName = first.name;
            store.set({ currentIconName: first.name });
          }
        }
        if (appData.isInitialLoad) {
          loadDefaultClickerFn();
        } else {
          reprocess();
        }
        break;
      case 'parts':
      case 'blocksParts':
        appData.latestParts = msg.parts;
        viewer.setParts(msg.parts, !appData.isInitialLoad);
        viewer.setView(store.get().view);
        viewer.setSwitchPlacements(msg.switchPlacements ?? []);
        store.set({
          building: false,
          hasParts: msg.parts.length > 0,
          status: msg.warnings && msg.warnings.length ? msg.warnings[0] : '',
        });
        if (msg.warnings && msg.warnings.length > 1) {
          // Log remaining warnings to console for debugging
          for (let i = 1; i < msg.warnings.length; i++) console.warn('Worker warning:', msg.warnings[i]);
        }
        appData.isInitialLoad = false;
        
        import('../store/historyManager').then(m => {
          if (m.pendingHistoryReset) {
            m.setPendingHistoryReset(false);
            m.resetHistory();
          }
        });
        break;
      case 'error':
        store.set({ building: false, status: 'Error: ' + firstLine(msg.message) });
        if ((msg as any).context) console.warn('Worker error context:', (msg as any).context);
        appData.isInitialLoad = false;
        break;
    }
  };

  worker.onerror = (e: ErrorEvent) => {
    store.set({ building: false, status: 'Worker failed: ' + e.message });
  };

  // Explicitly request the handshake after the handler is attached. The
  // worker can finish evaluating before this module completes its bootstrap.
  worker.postMessage({ type: 'ping' });

  viewer.onPartPick((index: number | null, clientX: number, clientY: number, shiftKey: boolean) => {
    const s = store.get();
    if (index === null) {
      store.set({ selectedParts: [] });
      return;
    }
    const partName = appData.latestParts[index]?.name;
    if (!partName) return;

    if (s.editMode === 'color') {
      store.set({ selectedParts: [partName] });
      const part = appData.latestParts[index];
      if (!part) return;
      const target = partColorTarget(part.name);
      if (!target) return;
      
      const options = getAvailableColorOptions(s);
      getClickerDocument().dispatchEvent(new CustomEvent('show-color-popover', { 
        detail: { clientX, clientY, hex: rgbToHex(part.colorRgb), options, target, index }
      }));
      return;
    }

    let nextSelected = s.selectedParts.slice();
    if (shiftKey) {
      // Sá»­a lá»—i any cho biáº¿n p táº¡i Ä‘Ã¢y
      nextSelected = nextSelected.includes(partName) ? nextSelected.filter((p: string) => p !== partName) : [...nextSelected, partName];
    } else {
      nextSelected = [partName];
    }
    store.set({ selectedParts: nextSelected });
  });
}

// ---- Core Logic ----
export function reprocess() {
  setPendingHistoryReset(true);
  store.set({ baseColorOverride: null });
  const s = store.get();

  if (s.importMode === 'image' || s.importMode === 'hybrid') {
    if (!appData.originalImage) return;
    store.set({ building: true, status: 'Removing background & tracingâ€¦' });
    const imgClone = { data: new Uint8ClampedArray(appData.originalImage.data), width: appData.originalImage.width, height: appData.originalImage.height };
    appData.regionSet = processImage(imgClone, s.colorCount, {
      removeBg: s.removeBg,
      smoothing: s.smoothing,
      customColors: s.colorMode === 'limited' ? s.limitedColors : undefined,
      photoFlatten: s.photoFlatten,
    });
  } else if (s.importMode === 'svg') {
    if (!appData.currentSvgText) { store.set({ status: 'Upload an SVG file first.' }); return; }
    try {
      store.set({ building: true, status: 'Parsing SVGâ€¦' });
      appData.regionSet = parseSvg(appData.currentSvgText, { removeBg: s.removeBg });
    } catch (e: any) { store.set({ building: false, status: 'Error: ' + e.message }); return; }
  } else if (s.importMode === 'icon') {
    if (!appData.currentIconText) { store.set({ status: 'Select an icon first.' }); return; }
    try {
      store.set({ building: true, status: 'Parsing Iconâ€¦' });
      appData.regionSet = parseSvg(appData.currentIconText);
    } catch (e: any) { store.set({ building: false, status: 'Error: ' + e.message }); return; }
  } else if (s.importMode === 'blocks') {
    try {
      store.set({ building: true, status: 'Generating blocksâ€¦' });
      const text = s.blockSlots.map(slot => slot.ch).join('');
      appData.regionSet = parseLetter(text || 'Name', appData.currentFontId, 24, true);
    } catch (e: any) { store.set({ building: false, status: 'Error: ' + e.message }); return; }
  } else if (s.importMode === 'text') {
    try {
      store.set({ building: true, status: 'Generating Textâ€¦' });
      appData.regionSet = parseLetter(appData.currentText, appData.currentFontId, 15, s.separateLetters);
    } catch (e: any) { store.set({ building: false, status: 'Error: ' + e.message }); return; }
  }

  if (!appData.regionSet) return;
  const palette: PaletteEntry[] = s.importMode === 'blocks'
    ? [{ quantRgb: [247, 247, 245], filamentRgb: s.paletteOverrides[0] ?? [247, 247, 245], coverage: 1 }]
    : appData.regionSet.regions.map((r, i) => ({
        quantRgb: r.quantRgb, filamentRgb: s.paletteOverrides[i] ?? r.quantRgb, coverage: r.coverage,
      }));
  store.set({ palette });

  if (palette.length === 0) {
    store.set({ building: false, status: 'No outline found.' });
    return;
  }
  rebuild();
}

export function rebuild(quiet = false) {
  if (!appData.regionSet || appData.regionSet.regions.length === 0) return;
  if (!appData.assetsReady) { store.set({ status: 'Waiting for switch assetsâ€¦' }); return; }
  
  const s = store.get();
  const regions: BuildRegion[] = [];
  appData.regionSet.regions.forEach((r, i) => {
    const baseColor = s.palette[i]?.filamentRgb ?? r.quantRgb;
    r.components.forEach((comp, j) => {
      const partName = `top-color-${i}-${j}`;
      regions.push({ filamentRgb: s.partOverrides?.[partName] ?? baseColor, coverage: r.coverage, rings: comp.rings, partName });
    });
  });

  // ðŸŸ¢ 1. BÃ“C TÃCH CÃC VÃ™NG MÃ€U CHO Cáº¢ PHáº¦N Äáº¾
  const bottomRegions: BuildRegion[] = [];
  if (s.bottomBaseMode === 'custom' && appData.bottomRegionSet && !(s as any).bottomSolidOnly) {
    appData.bottomRegionSet.regions.forEach((r, i) => {
      r.components.forEach((comp, j) => {
        const partName = `bottom-color-${i}-${j}`;
        bottomRegions.push({ filamentRgb: s.partOverrides?.[partName] ?? r.quantRgb, coverage: r.coverage, rings: comp.rings, partName });
      });
    });
  }

  const isIcon = s.importMode === 'icon';
  const effectiveBaseShape = isIcon && s.baseShape === 'outline' ? 'circle' : s.baseShape;
  const capBaseColor: RGB = s.baseColorOverride ?? deriveFrameColor(s);

  const params: BuildParams = {
    baseShape: effectiveBaseShape, capWidthMm: s.capWidthMm, topThickness: Math.max(0, s.topThickness),
    imageDepth: s.imageDepth, flatKeychainThicknessMm: s.flatKeychainThicknessMm, hybridImageSizeMm: s.hybridImageSizeMm,
    hybridImageThicknessMm: s.hybridImageThicknessMm, hybridImageExtrudeMm: s.hybridImageExtrudeMm,
    hybridBaseWidthMm: s.hybridBaseWidthMm,
    hybridBaseEndPaddingMm: s.hybridBaseEndPaddingMm, hybridBaseThicknessMm: s.hybridBaseThicknessMm,
    hybridBaseCornerRadiusMm: s.hybridBaseCornerRadiusMm, hybridBaseWallHeightMm: s.hybridBaseWallHeightMm,
    hybridNeckLengthMm: s.hybridNeckLengthMm, hybridNeckWidthMm: s.hybridNeckWidthMm,
    hybridBaseImageOverlapMm: s.hybridBaseImageOverlapMm,
    hybridKeycapSpacingMm: s.hybridKeycapSpacingMm,
    hybridKeycapClearanceMm: s.hybridKeycapClearanceMm,
    imageMargin: s.imageMargin, borderWidth: s.borderWidth, mergeTopFrame: s.mergeTopFrame,
    baseHeight: Math.max(0, s.baseHeight),
    keepMeshesSeparate: s.keepMeshesSeparate, isFlatKeychain: s.isFlatKeychain, capProud: 4.0, tolerance: s.tolerance,
    stemTolerance: s.stemTolerance, colorBleed: 0.12, stepHeight: 0.6, travel: 4.0, floorThickness: 1.6,
    switches: s.switches, keychain: s.keychain, baseFilamentRgb: capBaseColor, bodyColorRgb: s.bodyColorRgb ?? [120, 124, 130],
    edgeSettings: s.edgeSettings, extrudeChamfer: s.extrudeChamfer, componentHeights: s.componentHeights,
    
    // ðŸŸ¢ 2. TRUYá»€N THÃ”NG Sá» CÄ‚N CHá»ˆNH & DANH SÃCH MÃ€U Äáº¾ SANG WORKER
    bottomOffsetX: (s as any).bottomOffsetX ?? 0,
    bottomOffsetY: (s as any).bottomOffsetY ?? 0,
    bottomRotation: (s as any).bottomRotation ?? 0,
    bottomExpandPercent: (s as any).bottomExpandPercent ?? 22, // ðŸŸ¢ Máº·c Ä‘á»‹nh 22%
    bottomRegions,
    topProfile: (s as any).topProfile || 'flat',
    topProfileHeight: (s as any).topProfileHeight || 5.0,
    
  };

  const bottomOutline = appData.bottomRegionSet ? appData.bottomRegionSet.outline : undefined;

  if (!quiet) store.set({ building: !appData.isInitialLoad, status: 'Building clickerâ€¦' });
  const isBlocks = s.importMode === 'blocks';
  const isHybrid = s.importMode === 'hybrid';
  try {
    if (isBlocks) {
      worker.postMessage({
        type: 'buildBlocks',
        params: {
          requestId: Date.now(),
          blockWidthMm: 18,
          blockHeightMm: 18,
          blockDepthMm: 6,
          blockGapMm: 2.2,
          cornerRadiusMm: 4,
          fontSize: 15 * s.legendScale,
          legendBold: s.legendBold,
          legendExtrudeMm: s.hybridTextExtrudeMm,
          vertical: s.blockOrientation === 'vertical',
          glyphs: appData.regionSet.regions.map((r, i) => ({
            rings: r.components.flatMap((component) => component.rings),
            // Blocks use a consistent dark legend so it stays readable on the
            // white keycaps, independent of the text palette from other modes.
            filamentRgb: [145, 145, 148] as RGB,
            partName: `top-color-${i}-0`,
          })),
          bodyColorRgb: s.bodyColorRgb ?? [238, 238, 240],
          capColorRgb: [247, 247, 245],
          stemTolerance: s.stemTolerance,
          travel: 4,
          keycapGapMm: s.blockKeycapGapMm,
          flatBottom: s.blockFlatBottom,
          baseHeightMm: s.blockModuleThicknessMm,
          moduleThicknessMm: s.blockModuleThicknessMm,
          moduleSideThicknessMm: s.blockModuleSideThicknessMm,
          baseCornerRadiusMm: s.blockBaseCornerRadiusMm,
          keycapHeightMm: s.blockKeycapHeightMm,
          keycapThicknessMm: s.blockKeycapThicknessMm,
          keycapCornerRadiusMm: s.blockKeycapCornerRadiusMm,
          keycapShape: s.blockKeycapShape,
          keycapMount: s.blockKeycapMount,
          keycapProfile: s.blockKeycapProfile,
          keycapUnit: s.blockKeycapUnit,
          squareModuleBase: true,
          keychainEnd: 'left',
        },
      });
    } else if (isHybrid) {
      const blockText = s.blockSlots.map(slot => slot.ch).join('') || 'Name';
      const blockRegionSet = parseLetter(blockText, appData.currentFontId, 24, true);
      worker.postMessage({
        type: 'buildHybridClicker',
        regions,
        outline: appData.regionSet.outline,
        params,
        blockParams: {
          blockWidthMm: 18,
          blockHeightMm: 18,
          blockDepthMm: 6,
          blockGapMm: 2.2,
          cornerRadiusMm: 4,
          fontSize: 15 * s.legendScale,
          legendBold: s.legendBold,
          legendExtrudeMm: s.hybridTextExtrudeMm,
          vertical: s.blockOrientation === 'vertical',
          glyphs: blockRegionSet.regions.map((r, i) => ({
            rings: r.components.flatMap((component) => component.rings),
            filamentRgb: [145, 145, 148] as RGB,
            partName: `block-color-${i}`,
          })),
          bodyColorRgb: s.bodyColorRgb ?? [238, 238, 240],
          capColorRgb: [247, 247, 245],
          stemTolerance: s.stemTolerance,
          travel: 4,
          keycapGapMm: s.blockKeycapGapMm,
          flatBottom: s.blockFlatBottom,
          baseHeightMm: s.blockModuleThicknessMm,
          moduleThicknessMm: s.blockModuleThicknessMm,
          moduleSideThicknessMm: s.blockModuleSideThicknessMm,
          baseCornerRadiusMm: s.blockBaseCornerRadiusMm,
          keycapHeightMm: s.blockKeycapHeightMm,
          keycapThicknessMm: s.blockKeycapThicknessMm,
          keycapCornerRadiusMm: s.blockKeycapCornerRadiusMm,
          keycapShape: s.blockKeycapShape,
          keycapMount: s.blockKeycapMount,
          keycapProfile: s.blockKeycapProfile,
          keycapUnit: s.blockKeycapUnit,
          squareModuleBase: true,
          keychainEnd: 'left',
        },
      });
    } else {
      worker.postMessage({ type: 'buildClicker', regions, outline: appData.regionSet.outline, params, bottomOutline });
    }
  } catch (e) {
    console.error('Engine: worker.postMessage failed', e);
    store.set({ building: false, status: 'Error: worker postMessage failed' });
  }
}

export function applyModelRecolor(target: ColorTarget, rgb: RGB, partIndex: number, viewer: any) {
  const s = store.get();
  if (target.kind === 'region') {
    const i = target.index;
    const overrides = s.partOverrides ? { ...s.partOverrides } : {};

    if (partIndex >= 0 && appData.latestParts[partIndex]) {
      const part = appData.latestParts[partIndex];
      viewer.setPartColor(partIndex, rgb);
      appData.latestParts[partIndex] = { ...appData.latestParts[partIndex], colorRgb: rgb };
      overrides[part.name] = rgb;
    } else {
      const prefixes = [`top-color-${i}-`, `hybrid-image-${i}`];
      appData.latestParts.forEach((p: ClickerPart, idx: number) => {
        if (prefixes.some((prefix) => p.name.startsWith(prefix))) {
          viewer.setPartColor(idx, rgb);
          appData.latestParts[idx] = { ...appData.latestParts[idx], colorRgb: rgb };
          overrides[p.name] = rgb;
        }
      });
      const palette = s.palette.slice();
      if (palette[i]) palette[i] = { ...palette[i], filamentRgb: rgb };
      const paletteOverrides = s.paletteOverrides.slice();
      paletteOverrides[i] = rgb;
      store.set({ palette, paletteOverrides });
    }
    store.set({ partOverrides: overrides });
    syncBaseColor(viewer);
  } else if (target.kind === 'body') {
    viewer.setPartColor(partIndex, rgb);
    if (appData.latestParts[partIndex]) appData.latestParts[partIndex] = { ...appData.latestParts[partIndex], colorRgb: rgb };
    store.set({ bodyColorRgb: rgb });
  } else {
    viewer.setPartColor(partIndex, rgb);
    if (appData.latestParts[partIndex]) appData.latestParts[partIndex] = { ...appData.latestParts[partIndex], colorRgb: rgb };
    store.set({ baseColorOverride: rgb });
  }
}

export const debouncedRebuild = debounce(rebuild, 130);
export const debouncedQuietRebuild = debounce(() => rebuild(true), 160);
export const debouncedReprocess = debounce(reprocess, 220);

// ---- Helpers Nhá» Ná»™i Bá»™ Engine ----
function relLuminance(rgb: RGB): number { return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]; }
function contrastingFrame(ink: RGB): RGB { return relLuminance(ink) > 150 ? DARK_FRAME : LIGHT_FRAME; }
function dominantInk(s: ReturnType<typeof store.get>): RGB {
  if (s.palette.length === 0) return [180, 180, 185];
  let domIdx = 0;
  for (let i = 1; i < s.palette.length; i++) if (s.palette[i].coverage > s.palette[domIdx].coverage) domIdx = i;
  return s.palette[domIdx]?.filamentRgb ?? [180, 180, 185];
}
function deriveFrameColor(s: ReturnType<typeof store.get>): RGB { const ink = dominantInk(s); return s.importMode === 'image' || s.importMode === 'hybrid' ? ink : contrastingFrame(ink); }

function syncBaseColor(viewer: any) {
  const s = store.get();
  if (s.baseColorOverride || s.palette.length === 0) return;
  const baseRgb = deriveFrameColor(s);
  const bi = appData.latestParts.findIndex((p: ClickerPart) => p.name === 'top-base');
  if (bi >= 0) {
    appData.latestParts[bi] = { ...appData.latestParts[bi], colorRgb: baseRgb };
    viewer.setPartColor(bi, baseRgb);
  }
}
function partColorTarget(name: string): ColorTarget | null {
  if (
    name === 'base-body'
    || name === 'blocks-base'
    || name === 'blocks-flat-floor'
    || /^blocks-side-wall-\d+$/.test(name)
    || /^block-side-wall-\d+$/.test(name)
  ) return { kind: 'body' };
  if (/^block-\d+(?:-wall)?$/.test(name)) return { kind: 'body' };
  if (name === 'hybrid-continuous-base' || name === 'hybrid-image-deck') return { kind: 'body' };
  if (/^hybrid-image-(\d+)$/.test(name)) return { kind: 'region', index: Number(name.slice('hybrid-image-'.length)), compIndex: 0 };
  if (/^block-color-\d+$/.test(name)) return { kind: 'region', index: 0, compIndex: 0 };
  if (/^cap-\d+$/.test(name)) return { kind: 'region', index: 0, compIndex: 0 };
  if (name === 'top-base') return { kind: 'base' };
  const m = /^top-color-(\d+)(?:-(\d+))?$/.exec(name);
  if (m) return { kind: 'region', index: +m[1], compIndex: m[2] ? +m[2] : 0 };
  
  // ðŸŸ¢ NHáº¬N Dáº NG Máº¢NH MÃ€U PHáº¦N Äáº¾
  const mBot = /^bottom-color-(\d+)(?:-(\d+))?$/.exec(name);
  if (mBot) return { kind: 'region', index: +mBot[1], compIndex: mBot[2] ? +mBot[2] : 0 };
  
  return null;
}
function getAvailableColorOptions(s: ReturnType<typeof store.get>): RGB[] {
  const barColors: RGB[] = [];
  if (s.bodyColorRgb) barColors.push(s.bodyColorRgb);
  if (s.palette) s.palette.forEach((p: PaletteEntry) => { if (p.filamentRgb) barColors.push(p.filamentRgb); });
  const uniqueColors: RGB[] = []; const seen = new Set<string>();
  for (const rgb of barColors) { const key = rgb.join(','); if (!seen.has(key)) { seen.add(key); uniqueColors.push(rgb); } }
  return uniqueColors;
}

// HÃ m há»— trá»£ thu nhá» áº£nh vá» kÃ­ch thÆ°á»›c tá»‘i Æ°u Ä‘á»ƒ dÃ² viá»n tá»©c thÃ¬
function downscaleImage(img: { data: Uint8ClampedArray; width: number; height: number }, maxDim = 512) {
  if (img.width <= maxDim && img.height <= maxDim) return img;

  const scale = maxDim / Math.max(img.width, img.height);
  const newW = Math.round(img.width * scale);
  const newH = Math.round(img.height * scale);

  const canvas = getClickerDocument().createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img;

  const imgData = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
  ctx.putImageData(imgData, 0, 0);

  const outCanvas = getClickerDocument().createElement('canvas');
  outCanvas.width = newW;
  outCanvas.height = newH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return img;

  outCtx.drawImage(canvas, 0, 0, newW, newH);
  const scaledData = outCtx.getImageData(0, 0, newW, newH);

  return {
    data: scaledData.data,
    width: newW,
    height: newH
  };
}

export function processBottomImage() {
  if (!appData.bottomImage) return;
  store.set({ building: true, status: 'Tracing bottom baseâ€¦' });
  
  // Tá»± Ä‘á»™ng nÃ©n áº£nh vá» tá»‘i Ä‘a 512px giÃºp dÃ² viá»n siÃªu tá»‘c
  const scaledImg = downscaleImage(appData.bottomImage, 512);

  const imgClone = { 
    data: new Uint8ClampedArray(scaledImg.data), 
    width: scaledImg.width, 
    height: scaledImg.height 
  };
  
  appData.bottomRegionSet = processImage(imgClone, 2, { 
    removeBg: true, 
    smoothing: store.get().smoothing 
  });
  
  rebuild();
}



