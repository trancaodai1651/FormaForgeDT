import type { RGB } from '../../types';
import type { RgbaImage } from '../../image/decode';

export type VectorizerTab = 'palette' | 'background';
export type VectorizerOutputMode = 'groups' | 'gradients';
export type QualityLevel = 'off' | 'smart' | 'mid';
export type NoiseLevel = 'off' | 'low' | 'high';
export type BackgroundMode = 'remove' | 'keep' | 'solid';

export interface VectorizerSettings {
  colorCount: number;
  paletteName: 'auto' | 'warm' | 'cool' | 'mono' | 'custom';
  customPalette: RGB[];
  backgroundMode: BackgroundMode;
  backgroundColor: RGB;
  enhance: boolean;
  antiAliasing: QualityLevel;
  noiseReduction: NoiseLevel;
  upscaling: 1 | 2;
  roundness: number;
  minimumArea: 'all' | 'small' | 'large';
  overlap: 'full' | 'high' | 'medium';
  circleDetection: boolean;
  outputWidthMm: number;
  outputMode: VectorizerOutputMode;
  addOutline: boolean;
  outlineWidth: number;
  maxFileSize: boolean;
  crop: { x: number; y: number; width: number; height: number };
  edit: { brightness: number; contrast: number; saturation: number };
}

export interface VectorizerInput {
  name: string;
  type: string;
  image: RgbaImage;
  original: RgbaImage;
  dataUrl: string;
}

export interface VectorizerResult {
  svg: string;
  regionCount: number;
  pathCount: number;
  widthMm: number;
  heightMm: number;
  sourceWidth: number;
  sourceHeight: number;
}

export const PALETTE_PRESETS: Record<Exclude<VectorizerSettings['paletteName'], 'auto' | 'custom'>, RGB[]> = {
  warm: [[25, 20, 20], [104, 32, 52], [210, 68, 120], [245, 124, 173], [250, 218, 224], [247, 181, 91]],
  cool: [[17, 28, 44], [36, 79, 135], [44, 143, 183], [87, 197, 182], [208, 236, 239], [242, 246, 244]],
  mono: [[20, 20, 22], [74, 76, 82], [132, 135, 142], [196, 198, 202], [244, 244, 242]],
};

export const DEFAULT_VECTORIZER_SETTINGS: VectorizerSettings = {
  colorCount: 5,
  paletteName: 'auto',
  customPalette: [[22, 22, 22], [247, 247, 245], [240, 185, 103]],
  backgroundMode: 'remove',
  backgroundColor: [255, 255, 255],
  enhance: true,
  antiAliasing: 'smart',
  noiseReduction: 'low',
  upscaling: 1,
  roundness: 0.45,
  minimumArea: 'small',
  overlap: 'high',
  circleDetection: false,
  outputWidthMm: 100,
  outputMode: 'groups',
  addOutline: false,
  outlineWidth: 0.5,
  maxFileSize: false,
  crop: { x: 0, y: 0, width: 100, height: 100 },
  edit: { brightness: 1, contrast: 1, saturation: 1 },
};
