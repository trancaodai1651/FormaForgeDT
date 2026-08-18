import type { RGB } from '../../types';

export type ImageKeychainLanguage = 'en' | 'vi';

export interface ImageKeychainConfig {
  name: string;
  imageWidthMm: number;
  badgeThicknessMm: number;
  imageDepthMm: number;
  colorCount: number;
  removeBackground: boolean;
  smoothing: number;
  baseColor: string;
  capColor: string;
  glyphColor: string;
}

export const DEFAULT_IMAGE_KEYCHAIN: ImageKeychainConfig = {
  name: 'Name',
  imageWidthMm: 66,
  badgeThicknessMm: 4,
  imageDepthMm: 0.8,
  colorCount: 4,
  removeBackground: true,
  smoothing: 0.16,
  baseColor: '#e7b84f',
  capColor: '#f1f2f4',
  glyphColor: '#262a31',
};

export function clampImageKeychain(config: ImageKeychainConfig): ImageKeychainConfig {
  return {
    ...config,
    name: Array.from((config.name || 'Name').replace(/\s+/g, '')).slice(0, 10).join('') || 'Name',
    imageWidthMm: Math.max(45, Math.min(110, config.imageWidthMm)),
    badgeThicknessMm: Math.max(2, Math.min(8, config.badgeThicknessMm)),
    imageDepthMm: Math.max(0.2, Math.min(2, config.imageDepthMm)),
    colorCount: Math.max(2, Math.min(8, Math.round(config.colorCount))),
    smoothing: Math.max(0, Math.min(0.7, config.smoothing)),
  };
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean.length === 3 ? clean.split('').map((item) => item + item).join('') : clean, 16);
  return Number.isFinite(value) ? [(value >> 16) & 255, (value >> 8) & 255, value & 255] : [128, 128, 128];
}

export function keychainLetters(name: string): string[] {
  return Array.from((name || 'Name').replace(/\s+/g, '')).slice(0, 10).map((letter) => letter.toUpperCase());
}
