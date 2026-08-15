import type { FlexKeychainSlot, RGB } from '../../types';

export interface FlexKeychainConfig {
  name: string;
  baseType: 'compact' | 'modular';
  modularStyle: 'bubbly' | 'bubbly-v2';
  vertical: boolean;
  showSwitch: boolean;
  switchStyle: 'physical' | 'printed';
  baseColor: string;
  capColor: string;
  glyphColor: string;
  gapMm: number;
  moduleSideWallThicknessMm: number;
  moduleThicknessMm: number;
  baseCornerRadiusMm: number;
  keycapGapMm: number;
  keycapHeightMm: number;
  keycapThicknessMm: number;
  keycapCornerRadiusMm: number;
  keycapShape: 'rounded' | 'square';
  keycapMount: 'above' | 'recessed';
  keycapProfile: 'standard' | 'low' | 'thocky' | 'choc-v1';
  keycapUnit: number;
  legendScale: number;
  legendBold: number;
  fontSize: number;
  fontId: string;
  slots: FlexKeychainSlot[];
}

export const DEFAULT_FLEX: FlexKeychainConfig = {
  name: 'FLEX',
  baseType: 'compact',
  modularStyle: 'bubbly',
  vertical: false,
  // Match the reference site: switch geometry is opt-in and can be enabled
  // from the Preview card after choosing Physical or 3D-printed.
  showSwitch: false,
  switchStyle: 'physical',
  baseColor: '#5b8def',
  capColor: '#eef0f4',
  glyphColor: '#2e3440',
  gapMm: 1.8,
  moduleSideWallThicknessMm: 0,
  moduleThicknessMm: 14,
  baseCornerRadiusMm: 3,
  keycapGapMm: 0.4,
  keycapHeightMm: 11.8,
  keycapThicknessMm: 2,
  keycapCornerRadiusMm: 2.8,
  keycapShape: 'rounded',
  keycapMount: 'above',
  keycapProfile: 'standard',
  keycapUnit: 1,
  legendScale: 1,
  legendBold: 0,
  fontSize: 15,
  fontId: 'helvetiker-bold',
  slots: [],
};

export function splitName(name: string): string[] {
  return Array.from((name || '').replace(/\s+/g, '')).slice(0, 10);
}

export function hexToRgb(hex: string): RGB {
  const value = hex.replace('#', '');
  const parsed = Number.parseInt(value.length === 3 ? value.split('').map((c) => c + c).join('') : value, 16);
  if (!Number.isFinite(parsed)) return [128, 128, 128];
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

export function rgbToHex(rgb: RGB): string {
  return `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
}

export function clampFlex(config: FlexKeychainConfig): FlexKeychainConfig {
  return {
    ...config,
    name: (config.name || 'Name').replace(/\s+/g, '').slice(0, 10) || 'Name',
    gapMm: Math.max(0, Math.min(12, config.gapMm)),
    moduleSideWallThicknessMm: Math.max(0, Math.min(33, config.moduleSideWallThicknessMm)),
    moduleThicknessMm: Math.max(4, Math.min(40, config.moduleThicknessMm)),
    baseCornerRadiusMm: Math.max(0.1, Math.min(16, config.baseCornerRadiusMm)),
    keycapGapMm: Math.max(0, Math.min(6, config.keycapGapMm)),
    keycapHeightMm: Math.max(6, Math.min(30, config.keycapHeightMm)),
    keycapThicknessMm: Math.max(0.8, Math.min(6, config.keycapThicknessMm)),
    keycapCornerRadiusMm: Math.max(0.1, Math.min(8, config.keycapCornerRadiusMm)),
    keycapUnit: Math.max(1, Math.min(6.5, config.keycapUnit)),
    legendScale: Math.max(0.5, Math.min(1.8, config.legendScale)),
    legendBold: Math.max(-0.3, Math.min(0.8, config.legendBold)),
    fontSize: Math.max(8, Math.min(40, config.fontSize)),
  };
}
