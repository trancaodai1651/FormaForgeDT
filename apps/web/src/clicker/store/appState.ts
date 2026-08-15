import { createStore } from './store';
import type { ClickerPart, RegionSet, RGB } from '../types';
import type { UiState } from '../ui/types';
import type { RgbaImage } from '../image/decode';

// Khởi tạo trạng thái giao diện UI
export const store = createStore<UiState>({
  isFlatKeychain: false,
  status: 'Loading switch assets…',
  building: false,
  hasParts: false,
  colorCount: 4,
  palette: [],
  baseShape: 'outline',
  capWidthMm: 35,
  topThickness: 1.5,
  imageDepth: 0.8,
  hybridImageSizeMm: 35,
  imageMargin: 1.2,
  borderWidth: 2.6,
  baseHeight: 12,
  mergeTopFrame: false,
  keepMeshesSeparate: true,
  tolerance: 0.4,
  stemTolerance: 0,
  switches: [{ x: 0, y: 0, rotation: 0 }],
  activeSwitchIndex: 0,
  smoothing: 0.1,
  photoFlatten: false,
  keychain: { enabled: false, style: 'loop', angleDeg: 90, holeDiameterMm: 5.2, offsetMm: 0 },
  removeBg: true,
  view: 'exploded',
  showSwitch: true,
  importMode: 'image',
  currentIconName: 'circle',
  colorMode: 'normal',
  limitedColors: [],
  bodyColorRgb: [240, 240, 240] as RGB,
  paletteOverrides: [],
  baseColorOverride: null,
  partOverrides: {},
  editMode: 'color',
  edgeSettings: [
    { target: 'capTop', style: 'chamfer', radius: 0.5 },
    { target: 'clickerBase', style: 'chamfer', radius: 0.5 },
  ],
  extrudeChamfer: false,
  separateLetters: false,
  blockSlots: [{ kind: 'char', ch: 'N' }, { kind: 'char', ch: 'a' }, { kind: 'char', ch: 'm' }, { kind: 'char', ch: 'e' }],
  blockOrientation: 'horizontal',
  legendScale: 1,
  legendBold: 0,
  // The reference generator seats the cap without an extra custom gap.
  blockKeycapGapMm: 0,
  blockFlatBottom: true,
  blockBaseHeightMm: 14,
  // A deeper module base gives the hybrid keychain the same substantial body
  // as the reference model. The slider remains available for thinner prints.
  blockModuleThicknessMm: 18,
  blockModuleSideThicknessMm: 0,
  blockBaseCornerRadiusMm: 3,
  blockKeycapHeightMm: 11.8,
  blockKeycapThicknessMm: 2,
  blockKeycapCornerRadiusMm: 2.8,
  blockKeycapShape: 'rounded',
  blockKeycapMount: 'above',
  blockKeycapProfile: 'standard',
  blockKeycapUnit: 1,
  hybridSquareModuleBase: true,
  extrudeHeight: null,
  componentHeights: {},
  selectedParts: [],
  canUndo: false,
  canRedo: false,
  canRefresh: false,
});

// Các biến dữ liệu nặng (Data states)
export const appData = {
  originalImage: null as RgbaImage | null,
  bottomImage: null as RgbaImage | null, // 👈 Thêm biến lưu ảnh đế
  bottomRegionSet: null as RegionSet | null, // 👈 Thêm biến lưu viền của ảnh đế
  regionSet: null as RegionSet | null,
  latestParts: [] as ClickerPart[],
  assetsReady: false,
  defaultClickerLoaded: false,
  
  // Trạng thái cho text và icon
  currentSvgText: '',
  currentSvgName: '',
  currentIconText: '',
  currentIconName: '',
  currentText: 'Custom\nText',
  currentFontId: 'helvetiker-regular',
  isInitialLoad: true,
};
