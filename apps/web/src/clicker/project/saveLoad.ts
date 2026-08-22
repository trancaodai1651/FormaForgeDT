import { getClickerDocument } from '../runtime';
import { store, appData } from '../store/appState';
import { downloadBlob } from '../utils/helpers';
import type { RgbaImage } from '../image/decode';

export function imageToDataUrl(img: RgbaImage): string {
  const c = getClickerDocument().createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c.toDataURL('image/png');
}

export function dataUrlToImage(url: string): Promise<RgbaImage> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      const c = getClickerDocument().createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(im, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      resolve({ data: d.data, width: c.width, height: c.height });
    };
    im.onerror = () => reject(new Error('bad image data'));
    im.src = url;
  });
}

export function saveProject() {
  const s = store.get();
  const proj = {
    version: 7,
    settings: {
      colorCount: s.colorCount, baseShape: s.baseShape, capWidthMm: s.capWidthMm,
      bottomBaseMode: s.bottomBaseMode, bottomExpandPercent: s.bottomExpandPercent, bottomPaddingMm: s.bottomPaddingMm,
      bottomSolidOnly: s.bottomSolidOnly, bottomOffsetX: s.bottomOffsetX,
      bottomOffsetY: s.bottomOffsetY, bottomRotation: s.bottomRotation,
      topThickness: s.topThickness, imageDepth: s.imageDepth, flatKeychainThicknessMm: s.flatKeychainThicknessMm, hybridImageSizeMm: s.hybridImageSizeMm,
      hybridImageThicknessMm: s.hybridImageThicknessMm, hybridImagePaddingMm: s.hybridImagePaddingMm,
      hybridKeychainHeightMm: s.hybridKeychainHeightMm, hybridImageExtrudeMm: s.hybridImageExtrudeMm, hybridTextExtrudeMm: s.hybridTextExtrudeMm, hybridBaseWidthMm: s.hybridBaseWidthMm,
      hybridBaseEndPaddingMm: s.hybridBaseEndPaddingMm, hybridBaseThicknessMm: s.hybridBaseThicknessMm,
      hybridBaseCornerRadiusMm: s.hybridBaseCornerRadiusMm, hybridBaseWallHeightMm: s.hybridBaseWallHeightMm,
      hybridBaseStyle: s.hybridBaseStyle, hybridVaseProfile: s.hybridVaseProfile,
      hybridVaseWavinessMm: s.hybridVaseWavinessMm, hybridVaseThicknessMm: s.hybridVaseThicknessMm,
      hybridVaseGapMm: s.hybridVaseGapMm,
      hybridNeckLengthMm: s.hybridNeckLengthMm, hybridBaseImageOverlapMm: s.hybridBaseImageOverlapMm, hybridNeckWidthMm: s.hybridNeckWidthMm,
      hybridKeycapSpacingMm: s.hybridKeycapSpacingMm, hybridKeycapClearanceMm: s.hybridKeycapClearanceMm, imageMargin: s.imageMargin,
      borderWidth: s.borderWidth, baseHeight: s.baseHeight, mergeTopFrame: s.mergeTopFrame, keepMeshesSeparate: s.keepMeshesSeparate, 
      tolerance: s.tolerance, stemTolerance: s.stemTolerance, switches: s.switches, keychain: s.keychain, 
      smoothing: s.smoothing, photoFlatten: s.photoFlatten, removeBg: s.removeBg, importMode: s.importMode, 
      currentText: appData.currentText, currentFontId: appData.currentFontId, 
      currentSvgText: appData.currentSvgText, currentSvgName: appData.currentSvgName, 
      imageSource: appData.imageSource,
      keycapImageName: appData.keycapImageName,
      keycapImageSvgText: appData.keycapImageSvgText,
      currentIconText: appData.currentIconText, currentIconName: appData.currentIconName, 
      colorMode: s.colorMode, limitedColors: s.limitedColors, bodyColorRgb: s.bodyColorRgb, 
      paletteOverrides: s.paletteOverrides, baseColorOverride: s.baseColorOverride, 
      partOverrides: s.partOverrides, edgeSettings: s.edgeSettings, extrudeChamfer: s.extrudeChamfer, 
      separateLetters: s.separateLetters, componentHeights: s.componentHeights,
      blockSlots: s.blockSlots, blockOrientation: s.blockOrientation, legendScale: s.legendScale, legendBold: s.legendBold,
      blockKeycapGapMm: s.blockKeycapGapMm, blockFlatBottom: s.blockFlatBottom,
      blockBaseHeightMm: s.blockBaseHeightMm, blockBaseCornerRadiusMm: s.blockBaseCornerRadiusMm,
      blockModuleThicknessMm: s.blockModuleThicknessMm,
      blockModuleSideThicknessMm: s.blockModuleSideThicknessMm,
      blockKeycapHeightMm: s.blockKeycapHeightMm,
      blockKeycapCornerRadiusMm: s.blockKeycapCornerRadiusMm,
      blockKeycapShape: s.blockKeycapShape,
      blockKeycapMount: s.blockKeycapMount,
      blockKeycapProfile: s.blockKeycapProfile,
      blockKeycapUnit: s.blockKeycapUnit,
      keycapImageSlotIndices: s.keycapImageSlotIndices,
      keycapLogoAssignments: s.keycapLogoAssignments,
      keycapLogoSizeMm: s.keycapLogoSizeMm,
      importedModelRotateX: s.importedModelRotateX,
      importedModelRotateY: s.importedModelRotateY,
      importedModelRotateZ: s.importedModelRotateZ,
    },
    palette: s.palette,
    image: appData.originalImage ? imageToDataUrl(appData.originalImage) : null,
    bottomImage: appData.bottomImage ? imageToDataUrl(appData.bottomImage) : null,
    bottomRegionSet: appData.bottomRegionSet,
    keycapImageRegionSet: appData.keycapImageRegionSet,
    keycapLogoAssets: appData.keycapLogoAssets,
  };
  downloadBlob(new Blob([JSON.stringify(proj)], { type: 'application/json' }), 'FormaForgeDT_Project.json');
  store.set({ status: 'Project saved âœ“' });
}

export async function loadProject(file: File, reprocessFn: () => void, rebuildFn: () => void, uiHandler: any) {
  try {
    store.set({ building: true, status: 'Loading projectâ€¦' });
    const proj = JSON.parse(await file.text());
    const set = proj.settings ?? {};

    appData.currentText = set.currentText ?? 'Custom\nText';
    appData.currentFontId = set.currentFontId ?? 'helvetiker-regular';
    appData.currentSvgText = set.currentSvgText ?? '';
    appData.currentSvgName = set.currentSvgName ?? '';
    appData.imageSource = set.imageSource === 'svg' ? 'svg' : 'raster';
    appData.keycapImageName = set.keycapImageName ?? '';
    appData.keycapImageSvgText = set.keycapImageSvgText ?? '';
    appData.keycapImageRegionSet = proj.keycapImageRegionSet ?? null;
    appData.keycapLogoAssets = Array.isArray(proj.keycapLogoAssets)
      ? proj.keycapLogoAssets.filter((asset: any) => asset && typeof asset.name === 'string' && asset.regionSet)
      : [];
    if (!appData.keycapLogoAssets.length && appData.keycapImageRegionSet) {
      appData.keycapLogoAssets = [{ id: 'legacy-keycap-logo', name: appData.keycapImageName || 'Imported logo', regionSet: appData.keycapImageRegionSet }];
    }
    appData.currentIconText = set.currentIconText ?? '';
    appData.currentIconName = set.currentIconName ?? '';

    if (appData.currentSvgText && appData.currentSvgName) {
      uiHandler.addUploadedSvg(appData.currentSvgText, appData.currentSvgName);
    }

    store.set({
      importMode: set.importMode ?? 'image', colorCount: set.colorCount ?? store.get().colorCount,
      baseShape: set.baseShape ?? store.get().baseShape, capWidthMm: set.capWidthMm ?? store.get().capWidthMm,
      bottomBaseMode: set.bottomBaseMode === 'custom' ? 'custom' : 'match',
      bottomExpandPercent: Math.max(0, Math.min(100, set.bottomExpandPercent ?? store.get().bottomExpandPercent)),
      bottomPaddingMm: Math.max(0, Math.min(12, set.bottomPaddingMm ?? store.get().bottomPaddingMm)),
      bottomSolidOnly: !!set.bottomSolidOnly,
      bottomOffsetX: set.bottomOffsetX ?? store.get().bottomOffsetX,
      bottomOffsetY: set.bottomOffsetY ?? store.get().bottomOffsetY,
      bottomRotation: set.bottomRotation ?? store.get().bottomRotation,
      topThickness: set.topThickness ?? store.get().topThickness, imageDepth: set.imageDepth ?? store.get().imageDepth,
      baseHeight: Math.max(0, Math.min(40, set.baseHeight ?? store.get().baseHeight)),
      flatKeychainThicknessMm: set.flatKeychainThicknessMm ?? store.get().flatKeychainThicknessMm,
      hybridImageSizeMm: set.hybridImageSizeMm ?? store.get().hybridImageSizeMm,
      hybridImageThicknessMm: set.hybridImageThicknessMm ?? store.get().hybridImageThicknessMm,
      hybridImagePaddingMm: set.hybridImagePaddingMm ?? store.get().hybridImagePaddingMm,
      hybridKeychainHeightMm: set.hybridKeychainHeightMm ?? store.get().hybridKeychainHeightMm,
      hybridImageExtrudeMm: set.hybridImageExtrudeMm ?? store.get().hybridImageExtrudeMm,
      hybridTextExtrudeMm: set.hybridTextExtrudeMm ?? store.get().hybridTextExtrudeMm,
      hybridBaseWidthMm: set.hybridBaseWidthMm ?? store.get().hybridBaseWidthMm,
      hybridBaseEndPaddingMm: set.hybridBaseEndPaddingMm ?? store.get().hybridBaseEndPaddingMm,
      hybridBaseThicknessMm: set.hybridBaseThicknessMm ?? store.get().hybridBaseThicknessMm,
      hybridBaseCornerRadiusMm: set.hybridBaseCornerRadiusMm ?? store.get().hybridBaseCornerRadiusMm,
      hybridBaseStyle: set.hybridBaseStyle === 'straight' || set.hybridBaseStyle === 'vase' ? set.hybridBaseStyle : 'rounded',
      hybridVaseProfile: set.hybridVaseProfile === 'wavy' ? 'wavy' : 'straight',
      hybridVaseWavinessMm: Math.max(0, Math.min(12, set.hybridVaseWavinessMm ?? store.get().hybridVaseWavinessMm)),
      hybridVaseThicknessMm: Math.max(1, Math.min(12, set.hybridVaseThicknessMm ?? store.get().hybridVaseThicknessMm)),
      hybridVaseGapMm: Math.max(0, Math.min(16, set.hybridVaseGapMm ?? store.get().hybridVaseGapMm)),
      hybridBaseWallHeightMm: set.hybridBaseWallHeightMm ?? store.get().hybridBaseWallHeightMm,
      hybridNeckLengthMm: set.hybridNeckLengthMm ?? store.get().hybridNeckLengthMm,
      hybridBaseImageOverlapMm: set.hybridBaseImageOverlapMm ?? store.get().hybridBaseImageOverlapMm,
      hybridNeckWidthMm: set.hybridNeckWidthMm ?? store.get().hybridNeckWidthMm,
      hybridKeycapSpacingMm: set.hybridKeycapSpacingMm ?? store.get().hybridKeycapSpacingMm,
      hybridKeycapClearanceMm: set.hybridKeycapClearanceMm ?? store.get().hybridKeycapClearanceMm,
      imageMargin: set.imageMargin ?? store.get().imageMargin, borderWidth: set.borderWidth ?? store.get().borderWidth,
      mergeTopFrame: set.mergeTopFrame ?? false, keepMeshesSeparate: set.keepMeshesSeparate ?? true,
      tolerance: set.tolerance ?? store.get().tolerance, stemTolerance: set.stemTolerance ?? 0,
      switches: Array.isArray(set.switches) && set.switches.length ? set.switches : [{ x: set.switchOffsetX ?? 0, y: set.switchOffsetY ?? 0, rotation: set.switchRotation ?? 0 }],
      activeSwitchIndex: 0, keychain: set.keychain && typeof set.keychain === 'object'
        ? { offsetMm: 0, hybridPosition: 'top', ...set.keychain }
        : { enabled: set.keychain === true, style: 'loop', angleDeg: 90, holeDiameterMm: 5.2, offsetMm: 0, hybridPosition: 'top' },
      smoothing: set.smoothing ?? store.get().smoothing, photoFlatten: set.photoFlatten ?? store.get().photoFlatten, removeBg: set.removeBg ?? store.get().removeBg,
      currentIconName: appData.currentIconName || 'circle', colorMode: set.colorMode ?? 'normal',
      limitedColors: set.limitedColors ?? [], bodyColorRgb: set.bodyColorRgb ?? [120, 124, 130],
      paletteOverrides: set.paletteOverrides ?? [], partOverrides: set.partOverrides ?? {},
      edgeSettings: set.edgeSettings ?? store.get().edgeSettings, extrudeChamfer: set.extrudeChamfer ?? false,
      separateLetters: set.separateLetters ?? false, componentHeights: set.componentHeights ?? {},
      blockSlots: Array.isArray(set.blockSlots) && set.blockSlots.length ? set.blockSlots : store.get().blockSlots,
      blockOrientation: set.blockOrientation ?? store.get().blockOrientation,
      legendScale: set.legendScale ?? store.get().legendScale,
      legendBold: set.legendBold ?? store.get().legendBold,
      blockKeycapGapMm: set.blockKeycapGapMm ?? store.get().blockKeycapGapMm,
      blockFlatBottom: set.blockFlatBottom ?? store.get().blockFlatBottom,
      blockBaseHeightMm: set.blockBaseHeightMm ?? store.get().blockBaseHeightMm,
      blockBaseCornerRadiusMm: set.blockBaseCornerRadiusMm ?? store.get().blockBaseCornerRadiusMm,
      blockModuleThicknessMm: set.blockModuleThicknessMm ?? store.get().blockModuleThicknessMm,
      blockModuleSideThicknessMm: set.blockModuleSideThicknessMm ?? store.get().blockModuleSideThicknessMm,
      blockKeycapHeightMm: set.blockKeycapHeightMm ?? store.get().blockKeycapHeightMm,
      blockKeycapCornerRadiusMm: set.blockKeycapCornerRadiusMm ?? store.get().blockKeycapCornerRadiusMm,
      blockKeycapShape: set.blockKeycapShape === 'square' ? 'square' : (set.blockKeycapShape ?? store.get().blockKeycapShape),
      blockKeycapMount: set.blockKeycapMount === 'above' ? 'above' : (set.blockKeycapMount ?? store.get().blockKeycapMount),
      blockKeycapProfile: ['standard', 'low', 'thocky', 'choc-v1'].includes(set.blockKeycapProfile) ? set.blockKeycapProfile : store.get().blockKeycapProfile,
      blockKeycapUnit: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.75, 6, 6.25, 6.5].includes(set.blockKeycapUnit) ? set.blockKeycapUnit : store.get().blockKeycapUnit,
      keycapImageSlotIndices: Array.isArray(set.keycapImageSlotIndices)
        ? set.keycapImageSlotIndices.filter((index: unknown) => Number.isInteger(index) && (index as number) >= 0)
        : store.get().keycapImageSlotIndices,
      keycapLogoNames: appData.keycapLogoAssets.map((asset) => asset.name),
      keycapLogoAssignments: Array.isArray(set.keycapLogoAssignments)
        ? set.keycapLogoAssignments.map((index: unknown) => Number.isInteger(index) && (index as number) >= 0 ? index as number : null)
        : (Array.isArray(set.keycapImageSlotIndices)
            ? store.get().blockSlots.map((_, slotIndex) => set.keycapImageSlotIndices.includes(slotIndex) ? 0 : null)
            : store.get().keycapLogoAssignments),
      keycapLogoSizeMm: Math.max(4, Math.min(13, set.keycapLogoSizeMm ?? store.get().keycapLogoSizeMm)),
      importedModelRotateX: Math.max(0, Math.min(360, set.importedModelRotateX ?? store.get().importedModelRotateX)),
      importedModelRotateY: Math.max(0, Math.min(360, set.importedModelRotateY ?? store.get().importedModelRotateY)),
      importedModelRotateZ: Math.max(0, Math.min(360, set.importedModelRotateZ ?? store.get().importedModelRotateZ)),
      keycapImageName: appData.keycapImageName,
    });

    if ((set.importMode === 'image' || set.importMode === 'hybrid') && proj.image) appData.originalImage = await dataUrlToImage(proj.image);
    appData.bottomImage = null;
    appData.bottomRegionSet = proj.bottomRegionSet ?? null;
    if ((set.importMode === 'image' || set.importMode === 'hybrid') && proj.bottomImage) {
      appData.bottomImage = await dataUrlToImage(proj.bottomImage);
    }

    reprocessFn();

    if (Array.isArray(proj.palette)) {
      // Sá»­a thÃ nh:
    const pal = store.get().palette.map((p: any, i: number) => ({ ...p, filamentRgb: proj.palette[i]?.filamentRgb ?? p.filamentRgb }));
      store.set({ palette: pal, baseColorOverride: set.baseColorOverride ?? null });
      rebuildFn();
    }
  } catch (err) {
    store.set({ building: false, status: 'Could not load project: ' + String(err) });
  }
}



