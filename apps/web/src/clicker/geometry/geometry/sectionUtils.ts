import type { BuildContext } from '../buildContext';

export function sectionIsEmpty(cs: any): boolean {
  try {
    if (typeof cs.isEmpty === 'function') return cs.isEmpty();
    const b = cs.bounds(); return !(b.max[0] > b.min[0] && b.max[1] > b.min[1]);
  } catch { return false; }
}

export function getRingArea(ring: [number, number][]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return Math.abs(area / 2);
}

export function removeHoles(ctx: BuildContext, cs: any): any {
  if (sectionIsEmpty(cs)) return cs;
  const rect = ctx.track(ctx.wasm.CrossSection.square([1000, 1000], true));
  const inverted = ctx.track(rect.subtract(cs));
  const islands = [...inverted.decompose()];
  if (islands.length <= 1) return cs;
  let maxArea = -1, outerSpace = islands[0];
  for (const isl of islands) {
    const area = isl.area();
    if (area > maxArea) { maxArea = area; outerSpace = isl; }
  }
  return ctx.track(rect.subtract(outerSpace));
}

function raySegT(ox: number, oy: number, dx: number, dy: number, a: [number, number], b: [number, number]): number | null {
  const ex = b[0] - a[0], ey = b[1] - a[1], det = -dx * ey + ex * dy;
  if (Math.abs(det) < 1e-12) return null;
  const r0x = a[0] - ox, r0y = a[1] - oy;
  const t = (-r0x * ey + ex * r0y) / det, u = (dx * r0y - dy * r0x) / det;
  return (t >= 0 && u >= -1e-9 && u <= 1 + 1e-9) ? t : null;
}

export function edgePointAt(footprint: any, angleDeg: number): { p: [number, number]; dir: [number, number] } {
  const rad = (angleDeg * Math.PI) / 180, dir: [number, number] = [Math.cos(rad), Math.sin(rad)];
  let rings: [number, number][][] = [];
  try { rings = footprint.toPolygons(); } catch { rings = []; }
  let area = 0, cx = 0, cy = 0;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      area += cross; cx += (ring[j][0] + ring[i][0]) * cross; cy += (ring[j][1] + ring[i][1]) * cross;
    }
  }
  let ox = 0, oy = 0;
  if (Math.abs(area) > 1e-6) { area *= 0.5; ox = cx / (6 * area); oy = cy / (6 * area); } 
  else { const b = footprint.bounds(); ox = (b.min[0] + b.max[0]) / 2; oy = (b.min[1] + b.max[1]) / 2; }
  
  let bestT = -Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const t = raySegT(ox, oy, dir[0], dir[1], ring[j], ring[i]);
      if (t !== null && t > bestT) bestT = t;
    }
  }
  if (!isFinite(bestT) || bestT <= 0) { const b = footprint.bounds(); bestT = Math.max((b.max[0] - b.min[0]) / 2, (b.max[1] - b.min[1]) / 2); }
  return { p: [ox + dir[0] * bestT, oy + dir[1] * bestT], dir };
}