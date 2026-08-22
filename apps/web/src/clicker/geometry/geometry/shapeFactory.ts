import type { BuildContext } from '../buildContext';

export type VasePathProfile = 'straight' | 'wavy';

export function roundedRect(ctx: BuildContext, w: number, h: number, r: number) {
  const rr = Math.max(0.1, Math.min(r, Math.min(w, h) / 2 - 0.01));
  const core = ctx.track(ctx.wasm.CrossSection.square([Math.max(0.2, w - 2 * rr), Math.max(0.2, h - 2 * rr)], true));
  return ctx.track(core.offset(rr, 'Round', 2.0, 32));
}

export function makeHexagon(ctx: BuildContext, r: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return ctx.track(new ctx.wasm.CrossSection([pts], 'NonZero'));
}

export function makeStar(ctx: BuildContext, r: number, points = 5) {
  const innerR = r * 0.56, pts: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI / points) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : innerR;
    pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
  }
  const sharp = ctx.track(new ctx.wasm.CrossSection([pts], 'NonZero')), rr = r * 0.13;
  return ctx.track(ctx.track(ctx.track(sharp.offset(-rr, 'Round', 2.0, 64)).offset(2 * rr, 'Round', 2.0, 64)).offset(-rr, 'Round', 2.0, 64));
}

export function makeHeart(ctx: BuildContext, r: number) {
  const h = 1 / Math.SQRT2, lobeR = 0.5, lobeX = h / 2, lobeY = 1.5 * h;
  const cy = (lobeY + lobeR) / 2, scale = r / Math.max(lobeX + lobeR, cy);
  const circleRing = (ox: number): [number, number][] => {
    const ring: [number, number][] = [];
    for (let i = 0; i < 128; i++) ring.push([(ox + lobeR * Math.cos((Math.PI * 2 * i) / 128)) * scale, (lobeY - cy + lobeR * Math.sin((Math.PI * 2 * i) / 128)) * scale]);
    return ring;
  };
  const diamond = ctx.track(new ctx.wasm.CrossSection([[[0, -cy * scale], [h * scale, (h - cy) * scale], [0, (2 * h - cy) * scale], [-h * scale, (h - cy) * scale]]], 'NonZero'));
  return ctx.track(ctx.track(diamond.add(ctx.track(new ctx.wasm.CrossSection([circleRing(-lobeX)], 'NonZero')))).add(ctx.track(new ctx.wasm.CrossSection([circleRing(lobeX)], 'NonZero'))));
}

export function makeEgg(ctx: BuildContext, r: number) {
  const raw: [number, number][] = [];
  for (let i = 0; i < 96; i++) raw.push([r * 0.74 * Math.cos((Math.PI * 2 * i) / 96) * (1 - 0.26 * Math.sin((Math.PI * 2 * i) / 96)), r * Math.sin((Math.PI * 2 * i) / 96)]);
  let area = 0, cx = 0, cy = 0;
  for (let i = 0, j = raw.length - 1; i < raw.length; j = i++) {
    const cross = raw[j][0] * raw[i][1] - raw[i][0] * raw[j][1];
    area += cross; cx += (raw[j][0] + raw[i][0]) * cross; cy += (raw[j][1] + raw[i][1]) * cross;
  }
  area *= 0.5; cx /= 6 * area; cy /= 6 * area;
  return ctx.track(new ctx.wasm.CrossSection([raw.map(([x, y]) => [x - cx, y - cy])], 'NonZero'));
}

/**
 * Add connected, rounded ribs around an arbitrary 2D footprint.
 *
 * The old implementation built a row of transverse rectangles. That made a
 * vase profile look like a fence and, when it was applied to the image plate,
 * it replaced the artwork silhouette with a bounding rectangle. Ribs are now
 * sampled from the actual outside contour, so the image/top footprint stays
 * independent and only the lower carrier gets the scalloped edge.
 */
export function ribbedProfile(
  ctx: BuildContext,
  source: any,
  bandThickness: number,
  bandGap: number,
  waviness = 0,
) {
  const polygons = typeof source.toPolygons === 'function' ? source.toPolygons() : [];
  const outer = polygons
    .filter((ring: [number, number][]) => ring.length >= 3)
    .sort((a: [number, number][], b: [number, number][]) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)))[0];
  if (!outer) return source;

  const thickness = Math.max(0.8, Math.min(12, bandThickness));
  const gap = Math.max(0, Math.min(16, bandGap));
  const pitch = Math.max(0.8, thickness + gap);
  const radius = thickness / 2;
  const bounds = source.bounds();
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const centerY = (bounds.min[1] + bounds.max[1]) / 2;
  const amplitude = Math.max(0, Math.min(Math.abs(waviness) * 0.24, radius * 0.8));

  let result = source;
  let distance = 0;
  let ribCount = 0;
  for (let index = 0; index < outer.length && ribCount < 320; index++) {
    const a = outer[index];
    const b = outer[(index + 1) % outer.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length < 0.001) continue;
    const count = Math.max(1, Math.ceil(length / pitch));
    const nx0 = a[0] - centerX;
    const ny0 = a[1] - centerY;
    const normalLength = Math.hypot(nx0, ny0) || 1;
    const nx = nx0 / normalLength;
    const ny = ny0 / normalLength;
    for (let step = 0; step < count && ribCount < 320; step++) {
      const t = (step + 0.5) / count;
      const phase = (distance + length * t) / pitch;
      const wobble = amplitude * Math.sin(phase * Math.PI * 2);
      const cx = a[0] + dx * t + nx * wobble;
      const cy = a[1] + dy * t + ny * wobble;
      const rib = ctx.track(ctx.wasm.CrossSection.circle(radius, 24).translate([cx, cy]));
      result = ctx.track(result.add(rib));
      ribCount++;
    }
    distance += length;
  }
  return ctx.simp(ctx.track(result));
}

function polygonArea(ring: [number, number][]) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return area / 2;
}

/** Build a rounded carrier with optional contour ribs. */
export function vaseCarrier(
  ctx: BuildContext,
  width: number,
  depth: number,
  cornerRadius: number,
  profile: VasePathProfile,
  waviness: number,
  bandThickness: number,
  bandGap: number,
  center: [number, number] = [0, 0],
  vertical = false,
) {
  void vertical;
  const core = roundedRect(ctx, Math.max(4, width), Math.max(4, depth), cornerRadius).translate(center);
  return profile === 'wavy'
    ? ribbedProfile(ctx, core, bandThickness, bandGap, waviness)
    : profile === 'straight'
      ? ribbedProfile(ctx, core, bandThickness, bandGap, 0)
      : core;
}
