// 🟢 Re-export các type từ root src/types.ts ra ngoài
export type { 
  BaseShapeKind, EditMode, EdgeSetting, EdgeStyle, 
  KeychainParams, PaletteEntry, SwitchPlacement, ViewMode, RGB, BlockSlot
} from '../types';

import type { BaseShapeKind, EditMode, EdgeSetting, EdgeStyle, KeychainParams, PaletteEntry, SwitchPlacement, ViewMode, RGB, BlockSlot } from '../types';
import type { RgbaImage } from '../image/decode';
import type { SectionAxis } from '../viewer/viewer';

export interface UiState {
  status: string; building: boolean; hasParts: boolean; colorCount: number; palette: PaletteEntry[];
  baseShape: BaseShapeKind; bottomBaseMode?: 'match' | 'custom';
  capWidthMm: number; topThickness: number; imageDepth: number; hybridImageSizeMm: number; imageMargin: number; borderWidth: number; baseHeight: number;
  mergeTopFrame: boolean; isFlatKeychain: boolean; keepMeshesSeparate: boolean;
  tolerance: number; stemTolerance: number; switches: SwitchPlacement[]; activeSwitchIndex: number;
  smoothing: number; photoFlatten: boolean; keychain: KeychainParams; removeBg: boolean; view: ViewMode; showSwitch: boolean;
  importMode: 'image' | 'svg' | 'icon' | 'text' | 'blocks' | 'hybrid'; currentIconName: string; colorMode: 'normal' | 'limited';
  limitedColors: RGB[]; bodyColorRgb: RGB; paletteOverrides: RGB[]; baseColorOverride: RGB | null;
  partOverrides: Record<string, RGB>; editMode: EditMode; edgeSettings: EdgeSetting[]; extrudeChamfer: boolean;
  separateLetters: boolean; extrudeHeight: number | null; componentHeights: Record<string, number>;
  blockSlots: BlockSlot[]; blockOrientation: 'horizontal' | 'vertical'; legendScale: number; legendBold: number;
  blockKeycapGapMm: number; blockFlatBottom: boolean;
  blockBaseHeightMm: number; blockBaseCornerRadiusMm: number;
  blockModuleThicknessMm: number;
  blockModuleSideThicknessMm: number;
  blockKeycapHeightMm: number; blockKeycapThicknessMm: number; blockKeycapCornerRadiusMm: number;
  blockKeycapShape: 'rounded' | 'square';
  blockKeycapMount: 'above' | 'recessed';
  blockKeycapProfile: 'standard' | 'low' | 'thocky' | 'choc-v1';
  blockKeycapUnit: number;
  hybridSquareModuleBase: boolean;
  selectedParts: string[]; canUndo: boolean; canRedo: boolean; canRefresh: boolean;
}

export interface UiCallbacks {
  onBottomModeChange(mode: 'match' | 'custom'): void;
  onBottomUpload(file: File): void;
  onUpload(file: File): void; onSample(load: () => Promise<RgbaImage>): void;
  onColorCount(n: number): void; onSmoothing(v: number): void;
  onFilament(index: number, hex: string): void; onShape(kind: BaseShapeKind): void;
  onWidth(mm: number): void; onTopThickness(mm: number): void; onImageDepth(mm: number): void;
  onBaseHeight(mm: number): void; onImageMargin(mm: number): void; onBorderWidth(mm: number): void;
  onMergeTopFrame(merge: boolean): void; onKeepMeshesSeparate(keep: boolean): void;
  onIsFlatKeychain(isFlat: boolean): void; onSocketTolStep(delta: number): void; onStemTolStep(delta: number): void;
  onSwitchNudge(dx: number, dy: number): void; onSwitchRotate(deltaDeg: number): void;
  onSwitchReset(): void; onSwitchCount(n: number): void; onActiveSwitch(i: number): void;
  onSwitchResetAll(): void; onKeychainToggle(on: boolean): void; onKeychainRotate(deltaDeg: number): void;
  onKeychainSize(deltaMm: number): void; onKeychainOffset(deltaMm: number): void;
  onRemoveBg(on: boolean): void; onPhotoFlatten(on: boolean): void; onView(mode: ViewMode): void; onShowSwitch(on: boolean): void;
  onSection(axis: SectionAxis, pos: number): void; onExport(): void; onExportSTL(): void;
  onRenderPng(): void; onAiPrompt(): void; onSaveProject(): void; onLoadProject(file: File): void;
  onBodyColor(hex: string): void; onImportMode(mode: 'image' | 'svg' | 'icon' | 'text' | 'blocks' | 'hybrid'): void;
  onSvgUpload(file: File): void; onSelectSvg(svgText: string, name: string): void;
  onSelectIcon(svgText: string, name: string): void; onTextChange(text: string): void;
  onFontSelect(fontId: string): void; onImportFont(file: File): void; onThemeChange(theme: string): void;
  onEditMode(mode: EditMode): void; onEdgeStyle(target: string, style: EdgeStyle): void;
  onEdgeStep(target: string, delta: number): void; onExtrudeStep(delta: number): void;
  onExtrudeChamfer(on: boolean): void; onSeparateLetters(on: boolean): void;
  onBlockText(text: string): void; onBlockOrientation(orientation: 'horizontal' | 'vertical'): void;
  onLegendScale(scale: number): void; onLegendBold(bold: number): void;
  onBlockKeycapGap(value: number): void; onBlockFlatBottom(value: boolean): void;
  onBlockBaseHeight(value: number): void; onBlockBaseCornerRadius(value: number): void;
  onBlockKeycapHeight(value: number): void; onBlockKeycapThickness(value: number): void; onBlockKeycapCornerRadius(value: number): void;
  onBlockKeycapShape(shape: 'rounded' | 'square'): void;
  onBlockKeycapMount(mount: 'above' | 'recessed'): void;
  onBlockKeycapProfile(profile: 'standard' | 'low' | 'thocky' | 'choc-v1'): void;
  onBlockKeySize(unit: number): void;
  onHybridSquareModuleBase(on: boolean): void;
  onHybridImageSize(sizeMm: number): void;
  onBlockModuleThickness(value: number): void;
  onBlockModuleSideThickness(value: number): void;
  onGenerate(): void; onUndo(): void; onRedo(): void; onRefresh(): void; onBackToHome(): void;
}
