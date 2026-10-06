import { getClickerDocument } from '../runtime';
import type { RGB } from '../types';
import { downloadFile } from '../../lib/downloadFile';

export function debounce(fn: () => void, ms: number) {
  let t = 0;
  return () => {
    clearTimeout(t);
    t = window.setTimeout(fn, ms);
  };
}

export function hexToRgb(hex: string): RGB {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function rgbToHex(rgb: RGB): string {
  return (
    '#' +
    rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
  );
}

export function firstLine(s: string): string {
  return s.split('\n')[0];
}

export function downloadBlob(blob: Blob, fileName: string) {
  return downloadFile(blob, fileName, getClickerDocument());
}


