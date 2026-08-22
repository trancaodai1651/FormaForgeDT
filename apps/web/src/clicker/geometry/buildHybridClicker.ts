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
  const match = /^(?:cap-|block-color-|keycap-image-)(\d+)/.exec(name);
  return match ? Number(match[1]) : null;
}

function keycapFootprint(keycap: KeycapAsset): number {
  const visibleTop = Math.max(...(keycap.meta.topExtent ?? []));
  const positions = keycap.shell.positions;
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (let index = 0; index + 2 < positions.length; index += 3) {
    minX = Math.min(minX, positions[index]);
    minY = Math.min(minY, positions[index + 1]);
    maxX = Math.max(maxX, positions[index]);
    maxY = Math.max(maxY, positions[index + 1]);
  }
  const size = Math.max(maxX - minX, maxY - minY);
  // topExtent describes only the printable top surface. Spacing must use the
  // complete shell footprint, otherwise a 0 mm setting still leaves the
  // lower shell edges visibly separated from their neighbours.
  const shellSize = Number.isFinite(size) && size > 1 ? size : 18;
  return Math.max(Number.isFinite(visibleTop) && visibleTop > 1 ? visibleTop : 0, shellSize);
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
  const imageSize = clamp(params.hybridImageSizeMm, 30, 140, 50);
  const baseWidth = clamp(params.hybridBaseWidthMm, 20, 60, 29);
  const pocketClearance = clamp(params.hybridKeycapClearanceMm, 0.2, 4, 1);
  const keycapSize = keycapFootprint(keycap);
  const pocketSize = Math.max(16, Math.min(baseWidth - 2, keycapSize + pocketClearance * 2));
  const keycapSpacing = clamp(params.hybridKeycapSpacingMm, 0, 15, 3.5);
  // Keycap spacing is the visible gap between caps. Do not derive it from the
  // larger switch pocket: pocket clearance is intentionally independent and
  // must not make a 0 mm spacing setting look like a multi-millimetre gap.
  const pitch = Math.max(16, keycapSize) + keycapSpacing;
  const endPadding = clamp(params.hybridBaseEndPaddingMm, 10, 35, 14);
  const baseThickness = clamp(params.hybridBaseThicknessMm, 5, 20, 9);
  // This is a real carrier-wall height, not a cosmetic offset for the
  // preview. Keep the range comparable to base thickness so increasing it
  // produces a taller solid that actually covers the switch.
  const baseWallHeight = clamp(params.hybridBaseWallHeightMm, 0, 20, 8);
  const headLength = clamp(params.hybridNeckLengthMm, 0, 30, 3);
  const overlap = Math.max(0.5, clamp(params.hybridBaseImageOverlapMm, 0, 20, 7));
  const imageThickness = Math.max(baseThickness, clamp(params.hybridImageThicknessMm, 4, 24, 17));
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
  // Match Clicker's two-level well: the large rounded keycap pocket runs from
  // the carrier surface down to a fixed floor, while the smaller MX socket
  // continues below that floor. The cover-height control is the large-pocket
  // depth itself; it must not be reduced to the old 2.16 mm heuristic.
  const keycapPocketDepth = Math.max(1.4, baseWallHeight);
  const keycapPocketFloorZ = baseWallHeight - keycapPocketDepth;
  const switchTopClearance = 0.8;
  const shiftedPlacements = localPlacements.map((placement) => ({
    ...placement,
    // The switch asset is normalized by its seating plane, not by its top.
    // Pass the desired visible top separately so the viewer can subtract the
    // real switch height. The top follows the carrier surface, while the
    // lower housing remains seated in the smaller MX socket below the broad
    // keycap pocket. This prevents a taller cover from burying the switch.
    topZ: baseWallHeight - switchTopClearance,
  }));
  for (const placement of shiftedPlacements) {
    // Match the selected keycap footprint: rounded caps get rounded sockets,
    // while square caps receive a real square cutout instead of a rounded one.
    const pocketProfile = ctx.track(blockParams.keycapShape === 'square'
      ? wasm.CrossSection.square([pocketSize, pocketSize], true)
      : roundedRect(ctx, pocketSize, pocketSize, Math.min(3, pocketSize / 4)))
      .translate([placement.x, placement.y]);
    const pocket = ctx.track(wasm.Manifold.extrude(pocketProfile, keycapPocketDepth + 0.4)
      .translate([0, 0, keycapPocketFloorZ]));
    carrier = ctx.track(carrier.subtract(pocket));
    try {
      const rotatedSocket = placement.rotation
        ? ctx.track(socket.rotate([0, 0, placement.rotation]))
        : socket;
      // The normalized socket has its top at Z=0. Align that top with the
      // floor of the broad keycap pocket so the smaller cutout opens cleanly
      // into the shallow recess and remains deep enough for the switch.
      carrier = ctx.track(carrier.subtract(ctx.track(rotatedSocket.translate([
        placement.x,
        placement.y,
        keycapPocketFloorZ,
      ]))));
    } catch {
      warnings.push('A socket used the simplified pocket because its source cutout could not be applied.');
    }
  }

  let badgeBody = ctx.track(wasm.Manifold.extrude(badgeSection, imageThickness)
    .translate([0, 0, -baseThickness]));
  if (params.keychain?.enabled) {
    // Image + Blocks keeps the ring attached to the imported image head, never
    // to the last text block. The user can choose either end of the head.
    const holeDiameter = clamp(params.keychain.holeDiameterMm, 3, 16, 5.2);
    const tabWidth = Math.max(10, holeDiameter + 5);
    const tabLength = Math.max(9, holeDiameter + 4);
    const tabOverlap = Math.min(3, Math.max(1.2, overlap * 0.35));
    const hybridPosition = params.keychain.hybridPosition === 'bottom' ? 'bottom' : 'top';
    const tabCenter: [number, number] = hybridPosition === 'bottom'
      ? [0, -badgeDepth / 2 - tabLength / 2 + tabOverlap]
      : [0, badgeDepth / 2 + tabLength / 2 - tabOverlap];
    const keychainThickness = clamp(params.hybridKeychainHeightMm, 1, 15, 4);
    // The loop is a separate part with its own Z thickness. Seat it on the
    // image bottom plane so changing its thickness does not move the image.
    const keychainBottomZ = -baseThickness;
    const tabProfile = ctx.track(roundedRect(ctx, tabWidth, tabLength, Math.min(tabWidth, tabLength) / 2)
      .translate(tabCenter));
    const tabSolid = ctx.track(wasm.Manifold.extrude(tabProfile, keychainThickness)
      .translate([0, 0, keychainBottomZ]));
    const holeCenter: [number, number] = hybridPosition === 'bottom'
      ? [tabCenter[0], tabCenter[1] - tabLength / 2 + holeDiameter / 2 + 1.4]
      : [tabCenter[0], tabCenter[1] + tabLength / 2 - holeDiameter / 2 - 1.4];
    const holeProfile = ctx.track(wasm.CrossSection.circle(holeDiameter / 2, 48)
      .translate(holeCenter));
    const hole = ctx.track(wasm.Manifold.extrude(holeProfile, keychainThickness + 2)
      .translate([0, 0, keychainBottomZ - 1]));
    badgeBody = ctx.track(badgeBody.add(tabSolid).subtract(hole));
  }

  // Optional lower image base. Image + Blocks uses the same bottom-image
  // workflow as Image mode, but the lower silhouette is built as a separate
  // layer below the imported head so it cannot change the head thickness or
  // bury the carrier. The union with badgeSection guarantees full coverage
  // even when the uploaded bottom image is slightly smaller than the top.
  let mergedBody = ctx.track(badgeBody.add(carrier));
  if (params.bottomOutline?.length) {
    const bottomBounds = ringBounds(params.bottomOutline);
    if (bottomBounds.width > 0.01 && bottomBounds.height > 0.01) {
      const bottomScale = imageSize / Math.max(bottomBounds.width, bottomBounds.height);
      const bottomCenterX = (bottomBounds.minX + bottomBounds.maxX) / 2;
      const bottomCenterY = (bottomBounds.minY + bottomBounds.maxY) / 2;
      const bottomRings = params.bottomOutline
        .filter((ring) => ring.length >= 3 && Math.abs(getRingArea(ring)) > 0.0001)
        .map((ring) => ring.map(([x, y]) => [
          (x - bottomCenterX) * bottomScale,
          (y - bottomCenterY) * bottomScale,
        ] as [number, number]));
      if (bottomRings.length) {
        let bottomSection = ctx.track(new wasm.CrossSection(bottomRings, 'NonZero'));
        const expandPercent = clamp(params.bottomExpandPercent, 0, 100, 22);
        if (expandPercent > 0.001) {
          const factor = 1 + expandPercent / 100;
          bottomSection = ctx.track(bottomSection.scale([factor, factor]));
        }
        if (Math.abs(params.bottomRotation ?? 0) > 0.001) {
          bottomSection = ctx.track(bottomSection.rotate(params.bottomRotation));
        }
        if (Math.abs(params.bottomOffsetX ?? 0) > 0.001 || Math.abs(params.bottomOffsetY ?? 0) > 0.001) {
          bottomSection = ctx.track(bottomSection.translate([
            params.bottomOffsetX ?? 0,
            params.bottomOffsetY ?? 0,
          ]));
        }
        const bottomPadding = clamp(params.bottomPaddingMm, 0, 12, 1.2);
        if (bottomPadding > 0.001) {
          // Keep this as a real silhouette offset, independent from the
          // percentage expansion control, so Image + Blocks has its own base
          // margin just like the top image plate.
          bottomSection = ctx.track(bottomSection.offset(bottomPadding, 'Round', 2, 32));
        }
        bottomSection = ctx.simp(ctx.track(bottomSection.add(badgeSection)));
        const bottomThickness = Math.max(0.8, Math.min(6, baseThickness * 0.45));
        const lowerBase = ctx.track(wasm.Manifold.extrude(bottomSection, bottomThickness)
          .translate([0, 0, -baseThickness - bottomThickness]));
        mergedBody = ctx.track(mergedBody.add(lowerBase));
      }
    }
  }
  const imageHeadTop = imageTopZ;
  // The imported image is the flat-keychain plate in Image + Blocks mode.
  // Keep the plate itself flat and switch-free. Image colour layers start at
  // the badge top plane; the image Extrude control grows them upward from
  // that plane, so the setting produces a visible printable relief.
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

  // Palette regions can share a traced boundary (and anti-aliased source
  // pixels can make them overlap by a fraction). Remove already placed image
  // areas before creating the next solid so no two coplanar colour meshes
  // compete in the depth buffer and produce flicker/white rays.
  let placedImage2D: any = null;
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
      let section = ctx.track(new wasm.CrossSection(rings, 'NonZero'));
      if (placedImage2D) section = ctx.track(section.subtract(placedImage2D));
      if (sectionIsEmpty(section)) continue;
      const topLayer = imageTopScale === 1
        ? section
        : ctx.track(section.scale([imageTopScale, imageTopScale]));
      const imagePartName = `hybrid-image-${index}`;
      const extrusionLevel = params.componentHeights?.[imagePartName]
        ?? (region.partName ? params.componentHeights?.[region.partName] : undefined)
        ?? 0;
      const imageExtrude = clamp(
        clamp(params.hybridImageExtrudeMm, 0, 6, 0)
          + extrusionLevel * (params.stepHeight ?? 0.6),
        0,
        6,
        0,
      );
      // A zero-height face is not a printable solid. Keep a microscopic skin
      // centred on the badge top for the flush default; positive values rise
      // above that plane as a real image relief.
      const imageLayerHeight = Math.max(0.04, imageExtrude);
      const layer = ctx.track(wasm.Manifold.extrude(topLayer, imageLayerHeight)
        .translate([0, 0, imageTop - 0.02]));
      if (!layer.isEmpty()) {
        parts.push(toPart(layer, 'body', 'base', region.filamentRgb, imagePartName));
        placedImage2D = placedImage2D
          ? ctx.track(placedImage2D.add(section))
          : section;
      }
    } catch {
      warnings.push(`Image region ${index + 1} could not be printed.`);
    }
  }

  ctx.cleanup();
  return { parts, switchPlacements: shiftedPlacements, warnings };
}
