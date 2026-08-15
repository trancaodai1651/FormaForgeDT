import type { BuildContext } from '../buildContext';
import type { EdgeSetting, EdgeStyle } from '../../types';

export function createEdgeBevelBlock(ctx: BuildContext, footprint: any, r: number, style: EdgeStyle, zRef: number, isBottom: boolean): any {
  try {
    if (!footprint || typeof footprint.bounds !== 'function') return null;
    const b = footprint.bounds();
    if (!b || !b.min || !b.max) return null;
    const W = b.max[0] - b.min[0], H = b.max[1] - b.min[1];
    const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2;

    const safeR = Math.max(0.01, Math.min(r, Math.max(0.01, Math.min(W, H) / 2 - 0.001)));
    const totalHeight = safeR + 0.02;

    // Chamfer path (fast bevel) - keep previous approach but guarded
    if (style === 'chamfer' || style === 'none') {
      const outer = ctx.grow(footprint, safeR + 0.6);
      const scaleX = W > 0.01 ? Math.max(0.01, (W - 2 * safeR) / W) : 1;
      const scaleY = H > 0.01 ? Math.max(0.01, (H - 2 * safeR) / H) : 1;
      try {
        const boundingVolume = ctx.track(ctx.wasm.Manifold.extrude(ctx.track(outer.translate([-cx, -cy])), totalHeight));
        const partVolume = ctx.track(ctx.wasm.Manifold.extrude(ctx.track(footprint.translate([-cx, -cy])), totalHeight, 0, 0, [scaleX, scaleY]));
        let cutter = ctx.track(boundingVolume.subtract(partVolume));
        cutter = ctx.track(cutter.translate([cx, cy, 0]));
        if (isBottom) cutter = ctx.track(cutter.translate([0, 0, -totalHeight / 2]).scale([1, 1, -1]).translate([0, 0, totalHeight / 2]));
        const zOff = isBottom ? zRef - 0.02 : zRef - safeR;
        if (!Number.isFinite(zOff)) return null;
        return ctx.track(cutter.translate([0, 0, zOff]));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('createEdgeBevelBlock (chamfer): manifold extrude failed', e);
        return null;
      }
    }

    // Fillet path: approximate smooth fillet by stacking rounded slices
    if (style === 'fillet') {
      const steps = 10;
      const layerH = totalHeight / steps;
      const zBase = zRef - totalHeight;
      let cutter: any = null;
      try {
        for (let i = 0; i < steps; i++) {
          const t = i / (steps - 1);
          const offset = safeR * Math.cos(t * Math.PI / 2);
          const cs = ctx.track(footprint.offset(offset, 'Round', 1.0, 32));
          const layer = ctx.track(ctx.extrudeAt(cs, layerH + 0.001, zBase + i * layerH, (s: any) => { try { return typeof s.isEmpty === 'function' ? s.isEmpty() : false; } catch { return false; } }));
          if (!cutter) cutter = layer; else cutter = ctx.track(cutter.add(layer));
        }
        if (!cutter) return null;
        if (isBottom) cutter = ctx.track(cutter.translate([0, 0, -totalHeight / 2]).scale([1, 1, -1]).translate([0, 0, totalHeight / 2]));
        return cutter;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('createEdgeBevelBlock (fillet) failed', e);
        try { if (cutter) cutter.delete(); } catch {}
        return null;
      }
    }

    return null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('createEdgeBevelBlock: unexpected error', e);
    return null;
  }
}

export function applyEdges(ctx: BuildContext, bodyIn: any, edgeSettings: EdgeSetting[], footprint: any, bottomZ: number, topZ: number): any {
  let result = bodyIn;
  for (const es of edgeSettings) {
    if (es.style === 'none' || es.radius < 0.05) continue;
    const doBodyTop = es.target === 'baseTop' || es.target === 'base-body' || es.target === 'clickerBase';
    const doBodyBottom = es.target === 'baseBottom' || es.target === 'clickerBase';
    if (!doBodyTop && !doBodyBottom) continue;
    const r = Math.min(es.radius, (topZ - bottomZ) * 0.3, 2.5);
    if (r < 0.05) continue;
    if (doBodyTop) { const mb = createEdgeBevelBlock(ctx, footprint, r, es.style, topZ, false); if (mb) result = ctx.track(result.subtract(mb)); }
    if (doBodyBottom) { const mb = createEdgeBevelBlock(ctx, footprint, r, es.style, bottomZ, true); if (mb) result = ctx.track(result.subtract(mb)); }
  }
  return result;
}