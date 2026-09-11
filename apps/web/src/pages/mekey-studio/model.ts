import type { Ring } from '../../clicker/types';

export type MekeyLanguage = 'vi' | 'en';
export type MekeyTab = 'text' | 'borders' | 'rings';

export interface MekeyBorderLayer {
  enabled: boolean;
  widthMm: number;
  heightMm: number;
  color: string;
}

export interface MekeyRing {
  enabled: boolean;
  holeDiameterMm: number;
  thicknessMm: number;
  offsetX: number;
  offsetY: number;
}

export interface MekeyDesign {
  id: string;
  text: string;
  fontId: string;
  textSizeMm: number;
  textSpacing: number;
  textHeightMm: number;
  textColor: string;
  borders: MekeyBorderLayer[];
  rings: [MekeyRing, MekeyRing];
}

export interface MekeyBuildDesign extends MekeyDesign {
  rings2d: Ring[];
}

export interface MekeyBuildRequest {
  id: number;
  designs: MekeyBuildDesign[];
  arrange: boolean;
  bedWidthMm?: number;
  bedDepthMm?: number;
  spacingMm?: number;
  marginMm?: number;
}

export const DEFAULT_BORDERS: MekeyBorderLayer[] = [
  { enabled: true, widthMm: 3.2, heightMm: 4, color: '#ec4899' },
  { enabled: false, widthMm: 2, heightMm: 4, color: '#6366f1' },
  { enabled: false, widthMm: 6, heightMm: 4, color: '#f59e0b' },
];

const defaultRing = (enabled: boolean): MekeyRing => ({
  enabled,
  holeDiameterMm: 3.2,
  thicknessMm: 2.5,
  offsetX: 0,
  offsetY: 0,
});

export function createMekeyDesign(text = 'Mekey3D'): MekeyDesign {
  return {
    id: crypto.randomUUID(),
    text,
    fontId: 'bundled-pacifico',
    textSizeMm: 44,
    textSpacing: -1,
    textHeightMm: 2,
    textColor: '#ffffff',
    borders: DEFAULT_BORDERS.map((layer) => ({ ...layer })),
    rings: [defaultRing(true), defaultRing(false)],
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized.length === 3 ? normalized.split('').map((ch) => ch + ch).join('') : normalized, 16);
  return Number.isFinite(value) ? [(value >> 16) & 255, (value >> 8) & 255, value & 255] : [128, 128, 128];
}
