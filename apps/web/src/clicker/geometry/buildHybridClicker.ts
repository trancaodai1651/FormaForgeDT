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

function ringBounds(rings: Ring[]) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function toPart(
  solid: any,
  kind: 'cap' | 'body',
  group: PartGroup,
  colorRgb: RGB,
  name: string,
): ClickerPart {
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

function solidFromPart(wasm: any, part: ClickerPart): any {
  const mesh = new wasm.Mesh({
    numProp: part.numProp,
    vertProperties: new Float32Array(part.vertProperties),
    triVerts: new Uint32Array(part.triVerts),
  });
  mesh.merge();
  return wasm.Manifold.ofMesh(mesh);
}

/**
 * Build the image badge as a real top profile instead of a second flat slab.
 * The silhouette remains driven by the imported image; only the outside wall
 * tapers toward the printable top face.
 */
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
    const dome = Math.sqrt(Math.max(0, 1 - t * t));
    return topScale + (1 - topScale) * dome;
  };

  let solid: any = null;
  for (let i = 0; i < layers; i++) {
    const h0 = totalHeight * i / layers;
    const h1 = totalHeight * (i + 1) / layers;
    const s0 = scaleAt(h0);
    const s1 = scaleAt(h1);
    const base = Math.abs(s0 - 1) < 0.0001 ? centered : ctx.track(centered.scale([s0, s0]));
    const ratio = s1 / Math.max(0.001, s0);
    const layer = ctx.track(base.extrude(Math.max(0.001, h1 - h0), 0, 0, [ratio, ratio])
      .translate([cx, cy, z + h0]));
    solid = solid ? ctx.track(solid.add(layer)) : layer;
  }
  return { solid: solid ?? ctx.track(ctx.wasm.Manifold.extrude(section, flatHeight).translate([0, 0, z])), topScale };
}

function shiftPart(part: ClickerPart, dx: number, dy: number) {
  for (let i = 0; i < part.vertProperties.length; i += part.numProp) {
    part.vertProperties[i] += dx;
    part.vertProperties[i + 1] += dy;
  }
}

function taperedImageTransition(
  ctx: BuildContext,
  moduleWidth: number,
  moduleDepth: number,
  badgeWidth: number,
  badgeDepth: number,
  vertical: boolean,
  moduleHeight: number,
  moduleBottom: number,
  baseJoin: number,
): any {
  // Match the neck to the module's actual outside edge. The previous inset
  // made a visible step between the neck and the first module.
  const bodyHalf = Math.max(2.5, (vertical ? moduleWidth : moduleDepth) / 2 - 0.1);
  // Scale the image-side inset with the edge that the neck actually touches.
  // The old code used the badge width for a horizontal row even when the
  // imported image was shallow, producing a neck that met the image only at a
  // tiny point. The collar now follows the image's local depth/width and
  // always overlaps the image by a real printable area.
  const imageSpan = vertical ? badgeWidth : badgeDepth;
  const imageInset = Math.max(1.2, Math.min(5.5, imageSpan * 0.12));
  const imageHalf = Math.min(
    bodyHalf * 0.96,
    Math.max(3.2, imageSpan * 0.5 + 1.2),
  );
  let points: [number, number][];
  const smoothStep = (t: number) => t * t * (3 - 2 * t);

  if (vertical) {
    const imageY = -badgeDepth / 2 + imageInset;
    // The base begins below the image's tangent. Let the transition overlap
    // the base by 1.5 mm so the union is unambiguous and the outline is not a
    // rectangle abruptly touching the badge.
    const baseY = baseJoin - 0.75;
    const samples = 18;
    points = [];
    // Curved side walls (rather than straight diagonal edges) create the
    // soft, moulded shoulder visible on the reference keychain.
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const y = imageY + (baseY - imageY) * t;
      const half = imageHalf + (bodyHalf - imageHalf) * smoothStep(t);
      points.push([-half, y]);
    }
    for (let i = samples; i >= 0; i--) {
      const t = i / samples;
      const y = imageY + (baseY - imageY) * t;
      const half = imageHalf + (bodyHalf - imageHalf) * smoothStep(t);
      points.push([half, y]);
    }
  } else {
    const imageX = badgeWidth / 2 - imageInset;
    const baseX = baseJoin + 0.75;
    const samples = 18;
    points = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const x = imageX + (baseX - imageX) * t;
      const half = imageHalf + (bodyHalf - imageHalf) * smoothStep(t);
      points.push([x, -half]);
    }
    for (let i = samples; i >= 0; i--) {
      const t = i / samples;
      const x = imageX + (baseX - imageX) * t;
      const half = imageHalf + (bodyHalf - imageHalf) * smoothStep(t);
      points.push([x, half]);
    }
  }

  let profile = ctx.track(new ctx.wasm.CrossSection([points], 'NonZero'));
  // Round the profile once so the collar blends into the badge and the module
  // instead of ending in triangular points. A paired expand/shrink offset
  // created tiny re-entrant corners on narrow image silhouettes.
  try {
    const soften = Math.max(0.6, Math.min(1.5, bodyHalf * 0.14));
    profile = ctx.track(profile.offset(soften, 'Round', 2, 48));
  } catch {
    // Keep the valid raw profile if a very small custom module cannot be
    // offset safely.
  }
  const solid = ctx.track(ctx.wasm.Manifold.extrude(profile, Math.max(0.2, moduleHeight))
    .translate([0, 0, moduleBottom]));
  return { profile, solid };
}

/**
 * Builds the image + blocks variant inside the normal Clicker worker path.
 * The block row stays made from the official connector modules; the uploaded
 * image becomes a larger badge attached to the first module.
 */
export function buildHybridClicker(
  wasm: any,
  assets: PreparedBlockAssets,
  keycap: KeycapAsset,
  imageRegions: BuildRegion[],
  imageOutline: Ring[],
  params: BuildParams,
  blockParams: BlocksBuildParams,
): { parts: ClickerPart[]; switchPlacements: SwitchPlacement[]; warnings: string[] } {
  const blockResult = buildBlocks(wasm, assets, keycap, blockParams);
  const warnings = [...blockResult.warnings];
  if (!imageOutline.length) {
    warnings.push('Upload an image to create the image badge.');
    return blockResult;
  }

  const ctx = new BuildContext(wasm);
  const outlineBounds = ringBounds(imageOutline);
  if (!(outlineBounds.width > 0.01 && outlineBounds.height > 0.01)) {
    ctx.cleanup();
    warnings.push('The image has no printable outline.');
    return blockResult;
  }

  const moduleSource = assets.byMask.get(0)?.solid;
  const moduleBox = moduleSource?.boundingBox?.();
  if (!moduleBox) {
    ctx.cleanup();
    warnings.push('Block assets are not ready for the image + blocks model.');
    return blockResult;
  }

  const moduleWidth = moduleBox.max[0] - moduleBox.min[0];
  const moduleDepth = moduleBox.max[1] - moduleBox.min[1];
  const sideWall = Math.max(0, Math.min(33, blockParams.moduleSideThicknessMm ?? 0));
  // Side-wall thickness grows outward on the two long sides. Use that outer
  // size for positioning as well as for the neck, otherwise the first block
  // can overlap the image even when its center-to-center gap is correct.
  const outerModuleWidth = moduleWidth + (blockParams.vertical ? sideWall * 2 : 0);
  const outerModuleDepth = moduleDepth + (blockParams.vertical ? 0 : sideWall * 2);
  const requestedBaseHeight = Number.isFinite(blockParams.baseHeightMm)
    ? Math.max(8, Math.min(40, blockParams.baseHeightMm as number))
    : 18;
  const moduleHeight = (moduleBox.max[2] - moduleBox.min[2]) * (requestedBaseHeight / 14);
  const moduleBottom = moduleBox.min[2];
  const moduleTop = moduleBottom + moduleHeight;
  const pitch = Math.max(1, assets.pitch || moduleWidth);
  const count = Math.max(1, blockParams.glyphs.length);

  // Keep the image as a compact head/badge. The block row is shifted away
  // from it so the two solids overlap slightly and print as one object.
  const badgeMax = Math.max(20, Math.min(100, params.hybridImageSizeMm ?? 35));
  const imageScale = badgeMax / Math.max(outlineBounds.width, outlineBounds.height);
  const centerX = (outlineBounds.minX + outlineBounds.maxX) / 2;
  const centerY = (outlineBounds.minY + outlineBounds.maxY) / 2;
  const scaledOutline = imageOutline
    .filter((ring) => ring.length >= 3 && Math.abs(getRingArea(ring)) > 0.0001)
    .map((ring) => ring.map(([x, y]) => [
      (x - centerX) * imageScale,
      (y - centerY) * imageScale,
    ] as [number, number]));
  if (!scaledOutline.length) {
    ctx.cleanup();
    warnings.push('The image outline could not be converted into a badge.');
    return blockResult;
  }

  let imageSection = ctx.track(new wasm.CrossSection(scaledOutline, 'NonZero'));
  const badgeMargin = Math.max(1.4, Math.min(3.2, params.borderWidth || 2));
  const badgeSection = ctx.track(imageSection.offset(badgeMargin, 'Round', 2.0, 32));
  const badgeWidth = badgeSection.bounds().max[0] - badgeSection.bounds().min[0];
  const badgeDepth = badgeSection.bounds().max[1] - badgeSection.bounds().min[1];
  const badgeBody = ctx.track(wasm.Manifold.extrude(badgeSection, Math.max(0.2, moduleHeight))
    .translate([0, 0, moduleBottom]));
  const deckHeight = Math.max(0.8, Math.min(1.6, params.imageDepth + 0.35));
  const profile = params.topProfile ?? 'flat';
  const profileHeight = profile === 'flat' ? 0 : Math.max(0, Math.min(40, params.topProfileHeight ?? 5));
  const imageProfile = buildImageProfile(ctx, badgeSection, deckHeight, profileHeight, moduleTop, profile);
  const badgeDeck = imageProfile.solid;

  const bodyColor = blockParams.bodyColorRgb ?? params.bodyColorRgb ?? DEFAULT_BODY;
  // Hybrid must keep the official connector modules. The previous custom
  // square carrier replaced their stepped MX sockets with shallow rectangular
  // pockets and also caused the image badge to be cut by the base cutter.
  // Square/rounded appearance is supplied by the connector assets themselves.
  const baseParts = blockResult.parts.filter((part) => part.kind === 'body' && part.group === 'base');
  const blockParts = blockResult.parts.filter((part) => !baseParts.includes(part));
  const parts: ClickerPart[] = [
    ...blockParts,
    toPart(badgeBody, 'body', 'base', bodyColor, 'hybrid-image-base'),
    toPart(badgeDeck, 'body', 'base', bodyColor, 'hybrid-image-deck'),
  ];

  const imageTop = moduleTop + deckHeight + profileHeight;
  for (let index = 0; index < imageRegions.length; index++) {
    const region = imageRegions[index];
    const rings = region.rings
      .filter((ring) => ring.length >= 3 && Math.abs(getRingArea(ring)) > 0.0001)
      .map((ring) => ring.map(([x, y]) => [
        (x - centerX) * imageScale,
        (y - centerY) * imageScale,
      ] as [number, number]));
    if (!rings.length) continue;
    try {
      const section = ctx.track(new wasm.CrossSection(rings, 'NonZero'));
      const topLayer = imageProfile.topScale === 1
        ? section
        : ctx.track(section.scale([imageProfile.topScale, imageProfile.topScale]));
      const layer = ctx.track(wasm.Manifold.extrude(topLayer, 0.9).translate([0, 0, imageTop - 0.05]));
      if (!sectionIsEmpty(section) && !layer.isEmpty()) {
        // The image is part of the badge/base assembly. Keep it in the base
        // group so Exploded view lifts only the keycaps, not the artwork.
        parts.push(toPart(layer, 'body', 'base', region.filamentRgb, `hybrid-image-${index}`));
      }
    } catch {
      warnings.push(`Image region ${index + 1} could not be printed.`);
    }
  }

  // Shift the official block assembly so its first module meets the badge.
  // Use the actual badge footprint here. Keeping the row at a fixed 35 mm
  // reference position made the neck stop changing when the image was scaled,
  // which is exactly what caused the image to look detached at larger sizes.
  const firstOffset = ((count - 1) / 2) * pitch;
  // Deliberate overlap: the connector neck below hides the seam and makes the
  // image badge and the first block print as one continuous body.
  // Leave a small physical gap between the badge and first module. The neck
  // overlaps each side internally, so the final union is solid without the
  // image face visibly cutting into the first keycap.
  const desiredGap = 0.25;
  let shiftX = 0;
  let shiftY = 0;
  if (blockParams.vertical) {
    const firstY = firstOffset;
    const desiredFirstY = -(badgeDepth / 2 + outerModuleDepth / 2) - desiredGap;
    shiftY = desiredFirstY - firstY;
  } else {
    const firstX = -firstOffset;
    const desiredFirstX = badgeWidth / 2 + outerModuleWidth / 2 + desiredGap;
    shiftX = desiredFirstX - firstX;
  }

  const shiftedPlacements = blockResult.switchPlacements.map((placement) => ({
    ...placement,
    x: placement.x + shiftX,
    y: placement.y + shiftY,
  }));
  // Rebuild the complete lower assembly as one base part. Previously only the
  // first block was merged with the image badge, leaving the remaining modules
  // as visually separate solids and producing the detached look in preview.
  const shiftedBaseSolids = baseParts.map((part) => (
    ctx.track(solidFromPart(wasm, part).translate([shiftX, shiftY, 0]))
  ));
  // Keep the image badge, connector neck and every block module in one solid.
  // The deliberate overlaps remove weak seams at both the image/block junction
  // and between adjacent source modules while preserving their socket voids.
  const mergeImageAssembly = (...solids: any[]) => {
    let merged = badgeBody;
    for (const solid of solids) merged = ctx.track(merged.add(solid));
    const baseIndex = parts.findIndex((part) => part.name === 'hybrid-image-base');
    if (baseIndex >= 0) parts[baseIndex] = toPart(merged, 'body', 'base', bodyColor, 'hybrid-image-base');
  };
  if (blockParams.squareModuleBase !== false) {
    // Replace the square neck with a tapered transition that matches the
    // circular image badge into the straight-sided base.
    const transition = taperedImageTransition(
      ctx,
      outerModuleWidth,
      outerModuleDepth,
      badgeWidth,
      badgeDepth,
      blockParams.vertical,
      moduleHeight,
      moduleBottom,
      blockParams.vertical
        ? Math.max(...shiftedPlacements.map((placement) => placement.y)) + outerModuleDepth / 2 + 0.8
        : Math.min(...shiftedPlacements.map((placement) => placement.x)) - outerModuleWidth / 2 - 0.8,
    );
    // The official block module remains a separate connector-aware solid.
    // Only the neck is unioned into the image badge, so no module socket or
    // underside geometry can be accidentally removed.
    mergeImageAssembly(transition.solid, ...shiftedBaseSolids);
  } else {
    const firstCenterX = -firstOffset + shiftX;
    const firstCenterY = firstOffset + shiftY;
    const neckWidth = Math.max(5, Math.min(outerModuleWidth * 0.92, badgeWidth * 0.82));
    const neckDepth = Math.max(5, Math.min(outerModuleDepth * 0.92, badgeDepth * 0.82));
    let bridge: any;
    if (blockParams.vertical) {
      const yMin = firstCenterY + outerModuleDepth / 2 - 0.8;
      const yMax = -badgeDepth / 2 + 1.2;
      const span = Math.max(3, yMax - yMin);
      const bridgeProfile = ctx.track(roundedRect(ctx, neckWidth, span, Math.min(2.4, neckWidth / 4)));
      bridge = ctx.track(wasm.Manifold.extrude(bridgeProfile, moduleHeight)
        .translate([0, (yMin + yMax) / 2, moduleBottom]));
    } else {
      const xMin = badgeWidth / 2 - 1.2;
      const xMax = firstCenterX - outerModuleWidth / 2 + 0.8;
      const span = Math.max(3, xMax - xMin);
      const bridgeProfile = ctx.track(roundedRect(ctx, span, neckDepth, Math.min(2.4, neckDepth / 4)));
      bridge = ctx.track(wasm.Manifold.extrude(bridgeProfile, moduleHeight)
        .translate([(xMin + xMax) / 2, 0, moduleBottom]));
    }
    mergeImageAssembly(bridge, ...shiftedBaseSolids);
  }

  for (const part of blockParts) shiftPart(part, shiftX, shiftY);
  blockResult.switchPlacements.splice(0, blockResult.switchPlacements.length, ...shiftedPlacements);

  ctx.cleanup();
  return { parts, switchPlacements: blockResult.switchPlacements, warnings };
}
