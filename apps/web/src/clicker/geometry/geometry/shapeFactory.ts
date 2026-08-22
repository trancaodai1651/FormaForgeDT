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
 * Build a printable carrier with a continuous centre spine and repeated
 * vase/rib bands. The spine keeps the result one connected solid even when a
 * gap is requested; the bands control the visible side-to-side profile.
 */
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
  const safeWidth = Math.max(4, width);
  const safeDepth = Math.max(4, depth);
  const crossLength = vertical ? safeWidth : safeDepth;
  const axisLength = vertical ? safeDepth : safeWidth;
  const amplitude = profile === 'wavy'
    ? Math.min(Math.max(0, waviness), Math.max(0, crossLength * 0.32))
    : 0;
  const bandCross = Math.max(4, crossLength - amplitude * 2);
  const spineCross = Math.max(3, bandCross - Math.max(0.6, amplitude * 0.55));
  const spine = roundedRect(
    ctx,
    vertical ? spineCross : axisLength,
    vertical ? axisLength : spineCross,
    Math.min(cornerRadius, spineCross / 2 - 0.05),
  ).translate(center);

  const thickness = Math.max(0.5, Math.min(axisLength, bandThickness));
  const gap = Math.max(0, Math.min(axisLength, bandGap));
  const pitch = Math.max(0.5, thickness + gap);
  const count = Math.max(1, Math.ceil((axisLength + gap) / pitch));
  let result = spine;
  for (let index = 0; index < count; index++) {
    const axis = -axisLength / 2 + thickness / 2 + index * pitch;
    if (axis > axisLength / 2 + thickness / 2) break;
    const normalized = count <= 1 ? 0.5 : index / Math.max(1, count - 1);
    const crossOffset = amplitude * Math.sin(normalized * Math.PI * 2);
    const band = roundedRect(
      ctx,
      vertical ? bandCross : thickness,
      vertical ? thickness : bandCross,
      Math.min(cornerRadius, thickness / 2 - 0.05, bandCross / 2 - 0.05),
    ).translate([
      center[0] + (vertical ? crossOffset : axis),
      center[1] + (vertical ? axis : crossOffset),
    ]);
    result = ctx.track(result.add(band));
  }
  return ctx.track(result);
}
