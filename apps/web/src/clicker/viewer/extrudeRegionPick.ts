import type { ClickerPart } from '../types';

/** NonZero fill includes outer contours and excludes their oppositely wound holes. */
export function extrudeRegionAt(part: Pick<ClickerPart, 'extrudeRegions'>, x: number, y: number): string | undefined {
  for (const region of part.extrudeRegions ?? []) {
    let winding = 0;
    for (const ring of region.rings) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const side = (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]);
      if (a[1] <= y && b[1] > y && side > 0) winding++;
      if (a[1] > y && b[1] <= y && side < 0) winding--;
    }
    if (winding !== 0) return region.name;
  }
  return undefined;
}
