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
  const bounds = source.bounds();
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const centerY = (bounds.min[1] + bounds.max[1]) / 2;
  const segments = outer.map((start: [number, number], index: number) => {
    const end = outer[(index + 1) % outer.length];
    return { start, end, length: Math.hypot(end[0] - start[0], end[1] - start[1]) };
  });
  const perimeter = segments.reduce((sum: number, segment: { length: number }) => sum + segment.length, 0);
  if (perimeter < 0.01) return source;

  // Build one continuous, uniformly sampled outer contour. The previous
  // implementation placed independent circles per source segment, so rounded
  // corners received different spacing and the source's straight edge showed
  // between ribs. A continuous contour removes both artefacts.
  const sampleStep = Math.max(0.3, Math.min(0.9, pitch / 8));
  const sampleCount = Math.max(96, Math.min(2048, Math.ceil(perimeter / sampleStep)));
  const samples: Array<{ x: number; y: number; distance: number }> = [];
  let segmentIndex = 0;
  let segmentStartDistance = 0;
  for (let index = 0; index < sampleCount; index++) {
    const distance = (index / sampleCount) * perimeter;
    while (
      segmentIndex < segments.length - 1
      && distance >= segmentStartDistance + segments[segmentIndex].length
    ) {
      segmentStartDistance += segments[segmentIndex].length;
      segmentIndex++;
    }
    const segment = segments[segmentIndex];
    const t = segment.length > 0
      ? (distance - segmentStartDistance) / segment.length
      : 0;
    samples.push({
      x: segment.start[0] + (segment.end[0] - segment.start[0]) * t,
      y: segment.start[1] + (segment.end[1] - segment.start[1]) * t,
      distance,
    });
  }

  const ribHeight = Math.max(0.35, Math.min(5, thickness * 0.62));
  const baseClearance = Math.max(0.12, Math.min(0.45, ribHeight * 0.2));
  const waveAmplitude = Math.min(Math.max(0, Math.abs(waviness) * 0.45), ribHeight * 1.15);
  // Keep the winding decision global. Flipping the normal independently at a
  // concave point makes the ribs turn inward and creates the uneven spikes
  // seen in the old vase preview.
  let normalSign = polygonArea(outer) >= 0 ? 1 : -1;
  let normalRadialScore = 0;
  for (let index = 0; index < samples.length; index++) {
    const previous = samples[(index + samples.length - 1) % samples.length];
    const current = samples[index];
    const next = samples[(index + 1) % samples.length];
    const tangentX = next.x - previous.x;
    const tangentY = next.y - previous.y;
    const tangentLength = Math.hypot(tangentX, tangentY) || 1;
    const normalX = normalSign * tangentY / tangentLength;
    const normalY = -normalSign * tangentX / tangentLength;
    normalRadialScore += normalX * (current.x - centerX) + normalY * (current.y - centerY);
  }
  if (normalRadialScore < 0) normalSign *= -1;

  const ring: [number, number][] = [];
  for (let index = 0; index < samples.length; index++) {
    const previous = samples[(index + samples.length - 1) % samples.length];
    const current = samples[index];
    const next = samples[(index + 1) % samples.length];
    const tangentX = next.x - previous.x;
    const tangentY = next.y - previous.y;
    const tangentLength = Math.hypot(tangentX, tangentY) || 1;
    const normalX = normalSign * tangentY / tangentLength;
    const normalY = -normalSign * tangentX / tangentLength;

    const phase = (current.distance / pitch) * Math.PI * 2;
    // Never return to the source contour: Vase always has a continuous
    // rounded/ribbed edge, even when the requested gap is large.
    const rib = baseClearance + ribHeight * (0.5 + 0.5 * Math.cos(phase));
    // Wavy vase changes the actual contour height over two broad cycles. This
    // is intentionally stronger than the old sub-millimetre wobble so it is
    // visible in both the preview and the exported STL.
    const wave = waveAmplitude > 0
      ? waveAmplitude * Math.sin((current.distance / perimeter) * Math.PI * 4)
      : 0;
    const offset = Math.max(0.08, rib + wave);
    ring.push([current.x + normalX * offset, current.y + normalY * offset]);
  }

  const ribbedContour = ctx.track(new ctx.wasm.CrossSection([ring], 'NonZero'));
  // Keep the source as the solid interior, but make the outer boundary come
  // from the continuous contour so there are no flat sections between ribs.
  return ctx.simp(ctx.track(source.add(ribbedContour)));
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
