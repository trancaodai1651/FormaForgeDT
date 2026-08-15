import type { RGB } from '../../types';

export interface BlocksConfig {
  name: string;
  vertical: boolean;
  separateLetters: boolean;
  fontSize: number;
  blockGapMm: number;
  blockWidthMm: number;
  blockHeightMm: number;
  blockDepthMm: number;
  cornerRadiusMm: number;
}

export const DEFAULT_BLOCKS: BlocksConfig = {
  name: 'Name',
  vertical: true,
  separateLetters: true,
  fontSize: 15,
  blockGapMm: 2.2,
  blockWidthMm: 18,
  blockHeightMm: 18,
  blockDepthMm: 6,
  cornerRadiusMm: 4,
};

export function clampBlocksConfig(cfg: BlocksConfig): BlocksConfig {
  const safeName = (cfg.name || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  return {
    name: safeName || 'Name',
    vertical: cfg.vertical !== false,
    separateLetters: cfg.separateLetters !== false,
    fontSize: Math.max(8, Math.min(40, cfg.fontSize)),
    blockGapMm: Math.max(0, Math.min(12, cfg.blockGapMm)),
    blockWidthMm: Math.max(8, Math.min(60, cfg.blockWidthMm)),
    blockHeightMm: Math.max(8, Math.min(60, cfg.blockHeightMm)),
    blockDepthMm: Math.max(2, Math.min(20, cfg.blockDepthMm)),
    cornerRadiusMm: Math.max(0, Math.min(12, cfg.cornerRadiusMm)),
  };
}

export function splitBlocksText(name: string): string[] {
  return [...(name || 'Name').replace(/\s+/g, '')].slice(0, 12);
}

export function estimateBlocksSize(cfg: BlocksConfig): { width: number; height: number } {
  const safe = clampBlocksConfig(cfg);
  const count = splitBlocksText(safe.name).length || 1;
  return safe.vertical
    ? { width: Math.max(120, safe.blockWidthMm * 6), height: Math.max(240, count * (safe.blockHeightMm + safe.blockGapMm) * 2.2) }
    : { width: Math.max(240, count * (safe.blockWidthMm + safe.blockGapMm) * 2.2), height: Math.max(140, safe.blockHeightMm * 6) };
}

export function blockColors(count: number): RGB[] {
  const palette: RGB[] = [
    [239, 106, 91],
    [227, 164, 62],
    [226, 212, 61],
    [122, 201, 122],
    [115, 192, 255],
    [181, 143, 255],
  ];
  return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
}
