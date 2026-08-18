import type {
  BlocksBuildParams,
  BuildParams,
  BuildRegion,
  ClickerPart,
  PartGroup,
  RGB,
  Ring,
  SwitchPlacement,
} from '../types';
import { BuildContext } from './buildContext';
import { buildBlocks, type KeycapAsset, type PreparedBlockAssets } from './buildBlocks';
import { getRingArea, sectionIsEmpty } from './geometry/sectionUtils';
import { roundedRect } from './geometry/shapeFactory';

const DEFAULT_BODY: RGB = [238, 238, 240];

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value as number : fallback));
}

function ringBounds(rings: Ring[]) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function toPart(solid: any, kind: 'cap' | 'body', group: PartGroup, colorRgb: RGB, name: string): ClickerPart {
  const mesh = solid.getMesh();
  return {
    kind,
    group,
    colorRgb,
    name,
    numProp: mesh.numProp,
    vertProperties: new Float32Array(mesh.vertProperties),
    triVerts: new Uint32Array(mesh.triVerts),
  };
}

function shiftPart(part: ClickerPart, dx: number, dy: number) {
  for (let index = 0; index < part.vertProperties.length; index += part.numProp) {
    part.vertProperties[index] += dx;
    part.vertProperties[index + 1] += dy;
  }
}

function buildImageProfile(
  ctx: BuildContext,
  section: any,
  flatHeight: number,
  profileHeight: number,
  z: number,
  profile: 'flat' | 'dome' | 'cone',
): { solid: any; topScale: number } {
  if (profile === 'flat' || profileHeight <= 0.01) {
    return {
      solid: ctx.track(ctx.wasm.Manifold.extrude(section, Math.max(0.2, flatHeight)).translate([0, 0, z])),
      topScale: 1,
    };
  }
  const bounds = section.bounds();
  const cx = (bounds.min[0] + bounds.max[0]) / 2;
  const cy = (bounds.min[1] + bounds.max[1]) / 2;
  const centered = ctx.track(section.translate([-cx, -cy]));
  const layers = Math.max(12, Math.min(28, Math.ceil(profileHeight * 4)));
  const topScale = profile === 'cone' ? 0.84 : 0.9;
  const totalHeight = Math.max(0.2, flatHeight + profileHeight);
  const scaleAt = (height: number) => {
    const t = Math.max(0, Math.min(1, (height - flatHeight) / Math.max(0.001, profileHeight)));
    if (height <= flatHeight) return 1;
    if (profile === 'cone') return 1 - (1 - topScale) * Math.pow(t, 1.08);
    return topScale + (1 - topScale) * Math.sqrt(Math.max(0, 1 - t * t));
  };
  let solid: any = null;
  for (let index = 0; index < layers; index++) {
    const h0 = totalHeight * index / layers;
    const h1 = totalHeight * (index + 1) / layers;
    const s0 = scaleAt(h0);
    const s1 = scaleAt(h1);
    const base = Math.abs(s0 - 1) < 0.0001 ? centered : ctx.track(centered.scale([s0, s0]));
    const layer = ctx.track(base.extrude(Math.max(0.001, h1 - h0), 0, 0, [s1 / Math.max(0.001, s0), s1 / Math.max(0.001, s0)])
      .translate([cx, cy, z + h0]));
    solid = solid ? ctx.track(solid.add(layer)) : layer;
  }
  return { solid: solid ?? ctx.track(ctx.wasm.Manifold.extrude(section, flatHeight).translate([0, 0, z])), topScale };
}

/**
 * Builds Image + Blocks as one rounded carrier with real MX socket cutouts.
 * Keycaps and legends still come from the existing Blocks pipeline.
 */
export function buildHybridClicker(
  wasm: any,
  assets: PreparedBlockAssets,
  keycap: KeycapAsset,
  socket: any,
  imageRegions: BuildRegion[],
  imageOutline: Ring[],
  params: BuildParams,
  blockParams: BlocksBuildParams,
): { parts: ClickerPart[]; switchPlacements: SwitchPlacement[]; warnings: string[] } {
  const blockResult = buildBlocks(wasm, assets, keycap, blockParams, socket);
  const warnings = [...blockResult.warnings];
  if (!imageOutline.length) {
    warnings.push('Upload an image to create the image head.');
    return blockResult;
  }
  const ctx = new BuildContext(wasm);
  const outlineBounds = ringBounds(imageOutline);
  if (!(outlineBounds.width > 0.01 && outlineBounds.height > 0.01)) {
    ctx.cleanup();
    warnings.push('The image has no printable outline.');
    return blockResult;
  }
  const placements = blockResult.switchPlacements;
  if (!placements.length) {
    ctx.cleanup();
    warnings.push('Enter at least one character to create the socket base.');
    return blockResult;
  }

  const bodyColor = blockParams.bodyColorRgb ?? params.bodyColorRgb ?? DEFAULT_BODY;
  const vertical = blockParams.vertical;
  const count = placements.length;
  const pitch = Math.max(16, assets.pitch || assets.pitchMax || 19.05);
  const imageSize = clamp(params.hybridImageSizeMm, 30, 140, 60);
  const baseWidth = clamp(params.hybridBaseWidthMm, 22, 60, 27);
  const endPadding = clamp(params.hybridBaseEndPaddingMm, 10, 35, 13);
  const baseThickness = clamp(params.hybridBaseThicknessMm, 5, 20, 8);
  const imageThickness = Math.max(baseThickness + 0.8, clamp(params.hybridImageThicknessMm, 4, 24, 11));
  const carrierLength = Math.max(baseWidth, (count - 1) * pitch + endPadding * 2);
  const carrierWidth = vertical ? baseWidth : carrierLength;
  const carrierDepth = vertical ? carrierLength : baseWidth;
  const cornerRadius = Math.min(
    clamp(params.hybridBaseCornerRadiusMm, 1, 14, 5),
    Math.min(carrierWidth, carrierDepth) / 2 - 0.15,
  );

  const imageScale = imageSize / Math.max(outlineBounds.width, outlineBounds.height);
  const imageCenterX = (outlineBounds.minX + outlineBounds.maxX) / 2;
  const imageCenterY = (outlineBounds.minY + outlineBounds.maxY) / 2;
  const scaledOutline = imageOutline
    .filter((ring) => ring.length >= 3 && Math.abs(getRingArea(ring)) > 0.0001)
    .map((ring) => ring.map(([x, y]) => [
      (x - imageCenterX) * imageScale,
      (y - imageCenterY) * imageScale,
    ] as [number, number]));
  if (!scaledOutline.length) {
    ctx.cleanup();
    warnings.push('The image outline could not be converted into a head.');
    return blockResult;
  }

  const imageSection = ctx.track(new wasm.CrossSection(scaledOutline, 'NonZero'));
  const imageMargin = Math.max(1.4, Math.min(4.5, params.borderWidth || 2.6));
  const badgeSection = ctx.track(imageSection.offset(imageMargin, 'Round', 2, 48));
  const badgeBounds = badgeSection.bounds();
  const badgeWidth = badgeBounds.max[0] - badgeBounds.min[0];
  const badgeDepth = badgeBounds.max[1] - badgeBounds.min[1];
  const overlap = Math.max(3, Math.min(7, baseWidth * 0.2));
  let shiftX = 0;
  let shiftY = 0;
  if (vertical) shiftY = -badgeDepth / 2 - carrierDepth / 2 + overlap;
  else shiftX = badgeWidth / 2 + carrierWidth / 2 - overlap;

  const carrierProfile = ctx.track(roundedRect(ctx, carrierWidth, carrierDepth, cornerRadius)
    .translate([shiftX, shiftY]));
  let carrier = ctx.track(wasm.Manifold.extrude(carrierProfile, baseThickness)
    .translate([0, 0, -baseThickness]));
  const shiftedPlacements = placements.map((placement) => ({
    ...placement,
    x: placement.x + shiftX,
    y: placement.y + shiftY,
  }));
  const pocketSize = Math.max(14, Math.min(18, baseWidth - 4));
  const pocketDepth = Math.min(1.8, Math.max(0.8, baseThickness - 1));
  for (const placement of shiftedPlacements) {
    const pocketProfile = ctx.track(roundedRect(ctx, pocketSize, pocketSize, Math.min(3, pocketSize / 4))
      .translate([placement.x, placement.y]));
    const pocket = ctx.track(wasm.Manifold.extrude(pocketProfile, pocketDepth + 0.2)
      .translate([0, 0, -pocketDepth]));
    carrier = ctx.track(carrier.subtract(pocket));
    try {
      const rotatedSocket = placement.rotation
        ? ctx.track(socket.rotate([0, 0, placement.rotation]))
        : socket;
      carrier = ctx.track(carrier.subtract(ctx.track(rotatedSocket.translate([placement.x, placement.y, 0]))));
    } catch {
      warnings.push('A socket used the simplified pocket because its source cutout could not be applied.');
    }
  }

  const badgeBody = ctx.track(wasm.Manifold.extrude(badgeSection, imageThickness)
    .translate([0, 0, -baseThickness]));
  const mergedBody = ctx.track(badgeBody.add(carrier));
  const imageHeadTop = imageThickness - baseThickness;
  const deckHeight = Math.max(0.8, Math.min(1.8, params.imageDepth + 0.35));
  const profile = params.topProfile ?? 'flat';
  const profileHeight = profile === 'flat' ? 0 : Math.max(0, Math.min(40, params.topProfileHeight ?? 5));
  const imageProfile = buildImageProfile(ctx, badgeSection, deckHeight, profileHeight, imageHeadTop, profile);
  const imageTop = imageHeadTop + deckHeight + profileHeight;

  const movableParts = blockResult.parts.filter((part) => !(part.kind === 'body' && part.group === 'base'));
  for (const part of movableParts) shiftPart(part, shiftX, shiftY);
  const parts: ClickerPart[] = [
    ...movableParts,
    toPart(mergedBody, 'body', 'base', bodyColor, 'hybrid-continuous-base'),
    toPart(imageProfile.solid, 'body', 'base', bodyColor, 'hybrid-image-deck'),
  ];

  for (let index = 0; index < imageRegions.length; index++) {
    const region = imageRegions[index];
    const rings = region.rings
      .filter((ring) => ring.length >= 3 && Math.abs(getRingArea(ring)) > 0.0001)
      .map((ring) => ring.map(([x, y]) => [
        (x - imageCenterX) * imageScale,
        (y - imageCenterY) * imageScale,
      ] as [number, number]));
    if (!rings.length) continue;
    try {
      const section = ctx.track(new wasm.CrossSection(rings, 'NonZero'));
      const topLayer = imageProfile.topScale === 1
        ? section
        : ctx.track(section.scale([imageProfile.topScale, imageProfile.topScale]));
      const layer = ctx.track(wasm.Manifold.extrude(topLayer, 0.9).translate([0, 0, imageTop - 0.05]));
      if (!sectionIsEmpty(section) && !layer.isEmpty()) {
        parts.push(toPart(layer, 'body', 'base', region.filamentRgb, `hybrid-image-${index}`));
      }
    } catch {
      warnings.push(`Image region ${index + 1} could not be printed.`);
    }
  }

  ctx.cleanup();
  return { parts, switchPlacements: shiftedPlacements, warnings };
}
