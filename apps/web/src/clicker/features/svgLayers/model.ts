import type { RGB } from '../../types';

export type SvgLayerAssignment = 'none' | 'top' | 'base';

export interface SvgLayer {
  id: string;
  label: string;
  pathIndexes: number[];
  color: RGB;
  area: number;
  isBackground: boolean;
  assignment: SvgLayerAssignment;
}

export interface SvgLayerPath {
  path: any;
  color: RGB;
}

export interface SvgLayerDocument {
  name: string;
  source: string;
  preview: string;
  layers: SvgLayer[];
  paths: SvgLayerPath[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface SvgLayersSettings {
  targetSizeMm: number;
  baseDepthMm: number;
  topDepthMm: number;
  topOffsetMm: number;
  baseColor: RGB;
  topColorMode: 'source' | 'single';
  topColor: RGB;
}

export const DEFAULT_SVG_LAYERS_SETTINGS: SvgLayersSettings = {
  targetSizeMm: 50,
  baseDepthMm: 4,
  topDepthMm: 2,
  topOffsetMm: 0.15,
  baseColor: [236, 185, 103],
  topColorMode: 'source',
  topColor: [240, 240, 240],
};
