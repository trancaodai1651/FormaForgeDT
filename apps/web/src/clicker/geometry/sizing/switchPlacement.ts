import type { SwitchPlacement } from '../../types';

export function resolveSwitches(requested: SwitchPlacement[], plateBB: any, switchClear: number, socketDim: number): { applied: SwitchPlacement[], pinched: boolean } {
  const halfCol = switchClear / 2;
  const loX = plateBB.min[0] + halfCol, hiX = plateBB.max[0] - halfCol;
  const loY = plateBB.min[1] + halfCol, hiY = plateBB.max[1] - halfCol;
  const clamp = (v: number, lo: number, hi: number) => lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));

  const applied = requested.map(sw => ({
    x: clamp(sw.x ?? 0, loX, hiX), y: clamp(sw.y ?? 0, loY, hiY), rotation: sw.rotation ?? 0
  }));

  const PITCH = socketDim + 2.0;
  let pinched = false;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < applied.length; i++) {
      for (let j = i + 1; j < applied.length; j++) {
        const a = applied[i], b = applied[j], dx = b.x - a.x, dy = b.y - a.y;
        if (Math.hypot(dx, dy) < PITCH) {
          pinched = true;
          if (Math.abs(dx) >= Math.abs(dy)) b.x = clamp(a.x + (dx < 0 ? -1 : 1) * PITCH, loX, hiX);
          else b.y = clamp(a.y + (dy < 0 ? -1 : 1) * PITCH, loY, hiY);
        }
      }
    }
  }
  return { applied, pinched };
}