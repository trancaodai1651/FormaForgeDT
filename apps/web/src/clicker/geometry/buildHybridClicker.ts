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

function partSlotIndex(name: string): number | null {
  const match = /^(?:cap-|block-color-)(\d+)$/.exec(name);
  return match ? Number(match[1]) : null;
}

function keycapFootprint(keycap: KeycapAsset): number {
  const visibleTop = Math.max(...(keycap.meta.topExtent ?? []));
  if (Number.isFinite(visibleTop) && visibleTop > 1) return visibleTop;
  const positions = keycap.shell.positions;
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (let index = 0; index + 2 < positions.length; index += 3) {
    minX = Math.min(minX, positions[index]);
    minY = Math.min(minY, positions[index + 1]);
    maxX = Math.max(maxX, positions[index]);
    maxY = Math.max(maxY, positions[index + 1]);
  }
  const size = Math.max(maxX - minX, maxY - minY);
  return Number.isFinite(size) && size > 1 ? size : 18;
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
  const sourcePitch = Math.max(16, assets.pitch || assets.pitchMax || 19.05);
  const imageSize = clamp(params.hybridImageSizeMm, 30, 140, 45);
  const baseWidth = clamp(params.hybridBaseWidthMm, 20, 60, 30);
  const pocketClearance = clamp(params.hybridKeycapClearanceMm, 0.2, 4, 2);
  const pocketSize = Math.max(16, Math.min(baseWidth - 2, keycapFootprint(keycap) + pocketClearance * 2));
  const keycapSpacing = clamp(params.hybridKeycapSpacingMm, 0, 15, 0);
  const pitch = Math.max(sourcePitch, pocketSize) + keycapSpacing;
  const endPadding = clamp(params.hybridBaseEndPaddingMm, 10, 35, 15);
  const baseThickness = clamp(params.hybridBaseThicknessMm, 5, 20, 9);
  const baseWallHeight = clamp(params.hybridBaseWallHeightMm, 0, 8, 5);
  const headLength = clamp(params.hybridNeckLengthMm, 0, 30, 6);
  const overlap = Math.max(0.5, clamp(params.hybridBaseImageOverlapMm, 0, 20, 7));
  const imageThickness = Math.max(baseThickness, clamp(params.hybridImageThicknessMm, 4, 24, 15));
  const imagePadding = clamp(params.hybridImagePaddingMm, 0, 20, 1.2);
  const imageTopZ = imageThickness - baseThickness;
  const headPadding = pocketSize / 2 + headLength;
  const tailPadding = Math.max(endPadding, pocketSize / 2 + 1.5);
  const carrierLength = Math.max(baseWidth, overlap + headPadding + (count - 1) * pitch + tailPadding);
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
  // Match Image mode's Flat keychain construction: the imported silhouette is
  // inset from a separately adjustable outer plate instead of using the
  // generic border-width setting from the regular clicker.
  const badgeSection = imagePadding > 0.001
    ? ctx.track(imageSection.offset(imagePadding, 'Round', 2, 48))
    : imageSection;
  const badgeBounds = badgeSection.bounds();
  const badgeWidth = badgeBounds.max[0] - badgeBounds.min[0];
  const badgeDepth = badgeBounds.max[1] - badgeBounds.min[1];
  const carrierHeadEdge = vertical ? -badgeDepth / 2 + overlap : badgeWidth / 2 - overlap;
  const shiftX = vertical ? 0 : carrierHeadEdge + carrierWidth / 2;
  const shiftY = vertical ? carrierHeadEdge - carrierDepth / 2 : 0;

  const carrierProfile = ctx.track(roundedRect(ctx, carrierWidth, carrierDepth, cornerRadius)
    .translate([shiftX, shiftY]));
  let carrier = ctx.track(wasm.Manifold.extrude(carrierProfile, baseThickness + baseWallHeight)
    .translate([0, 0, -baseThickness]));

  // Square off the image-facing end of the same carrier. The carrier starts
  // inside the image badge, so there is no separate neck that can protrude or
  // create a pointed intersection at the first keycap.
  const squareHeadDepth = Math.min(carrierLength, cornerRadius + overlap + 1);
  const squareHeadProfile = ctx.track(wasm.CrossSection.square(
    vertical ? [carrierWidth, squareHeadDepth] : [squareHeadDepth, carrierDepth],
    true,
  ).translate(vertical
    ? [0, carrierHeadEdge - squareHeadDepth / 2]
    : [carrierHeadEdge + squareHeadDepth / 2, 0]));
  const squareHead = ctx.track(wasm.Manifold.extrude(squareHeadProfile, baseThickness + baseWallHeight)
    .translate([0, 0, -baseThickness]));
  carrier = ctx.track(carrier.add(squareHead));
  const localPlacements = placements.map((placement, index) => ({
    ...placement,
    x: vertical ? 0 : badgeWidth / 2 + headPadding + index * pitch,
    y: vertical ? -badgeDepth / 2 - headPadding - index * pitch : 0,
  }));
  const shiftedPlacements = localPlacements;
  const pocketDepth = Math.min(1.8, Math.max(0.8, baseThickness - 1));
  for (const placement of shiftedPlacements) {
    const pocketProfile = ctx.track(roundedRect(ctx, pocketSize, pocketSize, Math.min(3, pocketSize / 4))
      .translate([placement.x, placement.y]));
    const pocket = ctx.track(wasm.Manifold.extrude(pocketProfile, pocketDepth + baseWallHeight + 0.4)
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

  let badgeBody = ctx.track(wasm.Manifold.extrude(badgeSection, imageThickness)
    .translate([0, 0, -baseThickness]));
  if (params.keychain?.enabled) {
    // Image + Blocks has a fixed product orientation: the ring is attached to
    // the outside/top of the image head, never to the last text block.
    const holeDiameter = clamp(params.keychain.holeDiameterMm, 3, 16, 5.2);
    const tabWidth = Math.max(10, holeDiameter + 5);
    const tabLength = Math.max(9, holeDiameter + 4);
    const tabOverlap = Math.min(3, Math.max(1.2, overlap * 0.35));
    const tabCenter: [number, number] = vertical
      ? [0, badgeDepth / 2 + tabLength / 2 - tabOverlap]
      : [-badgeWidth / 2 - tabLength / 2 + tabOverlap, 0];
    const keychainHeight = Math.min(imageThickness, clamp(params.hybridKeychainHeightMm, 1, 15, 3.2));
    const keychainBottomZ = imageTopZ - keychainHeight;
    const tabProfile = ctx.track(roundedRect(ctx, tabWidth, tabLength, Math.min(tabWidth, tabLength) / 2)
      .translate(tabCenter));
    const tabSolid = ctx.track(wasm.Manifold.extrude(tabProfile, keychainHeight)
      .translate([0, 0, keychainBottomZ]));
    const holeCenter: [number, number] = vertical
      ? [tabCenter[0], tabCenter[1] + tabLength / 2 - holeDiameter / 2 - 1.4]
      : [tabCenter[0] - tabLength / 2 + holeDiameter / 2 + 1.4, tabCenter[1]];
    const holeProfile = ctx.track(wasm.CrossSection.circle(holeDiameter / 2, 48)
      .translate(holeCenter));
    const hole = ctx.track(wasm.Manifold.extrude(holeProfile, keychainHeight + 2)
      .translate([0, 0, keychainBottomZ - 1]));
    badgeBody = ctx.track(badgeBody.add(tabSolid).subtract(hole));
  }
  const mergedBody = ctx.track(badgeBody.add(carrier));
  const imageHeadTop = imageTopZ;
  // The imported image is the flat-keychain plate in Image + Blocks mode.
  // Keep the plate itself flat and switch-free; only its colour layers receive
  // the separate image relief setting below. The top-profile controls belong
  // to the regular clicker image mode and must not dome this plate.
  const imageTopScale = 1;
  const imageTop = imageHeadTop;

  const movableParts = blockResult.parts.filter((part) => !(part.kind === 'body' && part.group === 'base'));
  for (const part of movableParts) {
    const slotIndex = partSlotIndex(part.name);
    const original = slotIndex === null ? null : placements[slotIndex];
    const target = slotIndex === null ? null : shiftedPlacements[slotIndex];
    shiftPart(part, target && original ? target.x - original.x : shiftX, target && original ? target.y - original.y : shiftY);
  }
  const parts: ClickerPart[] = [
    ...movableParts,
    toPart(mergedBody, 'body', 'base', bodyColor, 'hybrid-continuous-base'),
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
      const topLayer = imageTopScale === 1
        ? section
        : ctx.track(section.scale([imageTopScale, imageTopScale]));
      const imageExtrude = clamp(params.hybridImageExtrudeMm, 0.2, 6, 0.9);
      const layer = ctx.track(wasm.Manifold.extrude(topLayer, imageExtrude).translate([0, 0, imageTop - 0.05]));
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
