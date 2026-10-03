import type { ClickerPart, RGB } from '../types';

/** Store both the displayed part and its stable traced identity for rebuilds. */
export function rememberPartColor(overrides: Record<string, RGB>, part: ClickerPart, rgb: RGB): void {
  overrides[part.name] = rgb;
  if (part.sourcePartName) overrides[part.sourcePartName] = rgb;
}

export function partMatchesPalette(part: ClickerPart, index: number): boolean {
  const sourceName = part.sourcePartName ?? part.name;
  if (sourceName.startsWith(`top-color-${index}-`)) return true;
  // Compatibility with saved previews that predate sourcePartName. Require
  // a delimiter so palette 1 never also recolors palette 10 or 11.
  return !part.sourcePartName && (part.name === `hybrid-image-${index}` || part.name.startsWith(`hybrid-image-${index}-`));
}
