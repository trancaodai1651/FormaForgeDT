import type { ClickerPart, ColorTarget, PaletteEntry, RGB } from '../types';

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

/** Resolve a picked mesh name. The image carrier itself is a frame; image
 * regions under it are resolved separately from its virtual pick masks. */
export function colorTargetForPart(
  name: string,
  palette: readonly PaletteEntry[],
): ColorTarget | null {
  const dominantIndex = palette.reduce(
    (best, entry, index) => entry.coverage > (palette[best]?.coverage ?? -1) ? index : best,
    0,
  );
  if (
    name === 'base-body'
    || name === 'blocks-base'
    || name === 'blocks-flat-floor'
    || /^blocks-side-wall-\d+$/.test(name)
    || /^block-side-wall-\d+$/.test(name)
  ) return { kind: 'body' };
  if (/^block-\d+(?:-wall)?$/.test(name)) return { kind: 'body' };
  if (name === 'hybrid-continuous-base' || name === 'hybrid-image-deck') return { kind: 'body' };
  if (name === 'hybrid-image-base') return { kind: 'region', index: dominantIndex, compIndex: 0 };
  if (/^hybrid-image-(\d+)$/.test(name)) return { kind: 'region', index: Number(name.slice('hybrid-image-'.length)), compIndex: 0 };
  if (/^block-color-\d+$/.test(name)) return { kind: 'region', index: 0, compIndex: 0 };
  if (/^cap-\d+$/.test(name)) return { kind: 'region', index: 0, compIndex: 0 };
  if (name === 'top-base') return { kind: 'base' };
  const top = /^top-color-(\d+)(?:-(\d+))?$/.exec(name);
  if (top) return { kind: 'region', index: +top[1], compIndex: top[2] ? +top[2] : 0 };
  const bottom = /^bottom-color-(\d+)(?:-(\d+))?$/.exec(name);
  if (bottom) return { kind: 'region', index: +bottom[1], compIndex: bottom[2] ? +bottom[2] : 0 };
  return null;
}

/** Resolve a face hidden inside a continuous carrier to its source artwork part. */
export function colorTargetForPickedMask(
  part: Pick<ClickerPart, 'extrudeRegions'>,
  regionName: string | undefined,
  palette: readonly PaletteEntry[],
): ColorTarget | null {
  if (!regionName) return null;
  const mask = part.extrudeRegions?.find((region) => region.name === regionName);
  const partName = mask?.sourcePartName ?? mask?.name;
  if (!partName) return null;
  const target = colorTargetForPart(partName, palette);
  return target?.kind === 'region' ? { ...target, partName } : null;
}
