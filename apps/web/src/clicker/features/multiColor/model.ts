import type { RGB, RegionSet } from '../../types';

export type MultiColorLayout = 'flat' | 'stacked';

export interface MultiColorSettings {
  colorCount: number;
  targetSizeMm: number;
  layerHeightMm: number;
  layerGapMm: number;
  baseThicknessMm: number;
  paddingMm: number;
  cornerRadiusMm: number;
  smoothing: number;
  layout: MultiColorLayout;
  removeBackground: boolean;
  includeBase: boolean;
  /** Force STL/3MF exports to use the assembled Z stack, independent of preview layout. */
  exportStacked: boolean;
  keychainEnabled: boolean;
  keychainWidthMm: number;
  keychainThicknessMm: number;
  /** Offset from the default right-edge keychain anchor, in mm. */
  keychainOffsetXMm: number;
  keychainOffsetYMm: number;
}

export interface MultiColorDocument {
  name: string;
  width: number;
  height: number;
  regionSet: RegionSet;
  palette: { rgb: RGB; coverage: number }[];
}

export const DEFAULT_MULTI_COLOR_SETTINGS: MultiColorSettings = {
  // Imports start with the full analysis budget. After tracing, the controller
  // writes the detected printable layer count back to this setting.
  colorCount: 16,
  targetSizeMm: 60,
  layerHeightMm: 0.8,
  // Stacked colour layers should touch by default so the lower colour is
  // visible through the cut-outs without creating a floating layer.
  layerGapMm: 0,
  baseThicknessMm: 2.4,
  paddingMm: 2,
  cornerRadiusMm: 4,
  smoothing: 0.35,
  // The physical stack is the useful default: every detected colour gets a
  // printable Z layer while the base keeps the layers registered together.
  layout: 'stacked',
  removeBackground: true,
  includeBase: false,
  exportStacked: true,
  keychainEnabled: false,
  keychainWidthMm: 14,
  keychainThicknessMm: 2,
  keychainOffsetXMm: 0,
  keychainOffsetYMm: 0,
};
