import { getClickerDocument } from '../runtime';
export const $ = <T extends HTMLElement>(id: string) => getClickerDocument().getElementById(id) as T;

export const tip = (text: string) =>
  `<span class="help-tip" tabindex="0" role="img" aria-label="Help: ${text.replace(/"/g, '&quot;')}" data-tip="${text.replace(/"/g, '&quot;')}">?</span>`;

export const rgbHex = (rgb: [number, number, number]) =>
  '#' + rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');

export const hexRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

export const friendlyTargetLabel = (t: string): string => {
  if (t === 'capTop') return 'Cap Top';
  if (t === 'baseTop') return 'Base Top';
  if (t === 'baseBottom') return 'Base Bottom';
  if (t === 'base-body') return 'Body';
  if (t === 'top-base') return 'Cap Frame';
  const m = /^top-color-(\d+)-\d+$/.exec(t);
  if (m) return `Color ${+m[1] + 1}`;
  return t;
};

// HÃ m há»— trá»£ gÃ¡n sá»± kiá»‡n cho input range/text
export function bindValInput(valId: string, sliderId: string, callback: (v: number) => void, parse?: (raw: number) => number) {
  const el = $<HTMLInputElement>(valId);
  const slider = $<HTMLInputElement>(sliderId);
  if (!el || !slider) return;
  const commit = () => {
    const raw = parseFloat(el.value.replace(/[^0-9.\-]/g, ''));
    if (isNaN(raw)) return;
    const v = parse ? parse(raw) : raw;
    const clamped = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), v));
    slider.value = String(clamped);
    callback(clamped);
  };
  el.addEventListener('focus', () => el.select());
  el.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); commit(); el.blur(); } });
  el.addEventListener('blur', commit);
}


