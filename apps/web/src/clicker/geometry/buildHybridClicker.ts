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
import { buildImageMaskPipeline, mapCleanRings } from './imageMaskPipeline';
import { edgePointAt, sectionIsEmpty } from './geometry/sectionUtils';
import { ribbedProfile, roundedRect, vaseCarrier } from './geometry/shapeFactory';

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

function partBounds(part: ClickerPart) {
  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (let i = 0; i + 2 < part.vertProperties.length; i += part.numProp) {
    minX = Math.min(minX, part.vertProperties[i]); maxX = Math.max(maxX, part.vertProperties[i]);
    minY = Math.min(minY, part.vertProperties[i + 1]); maxY = Math.max(maxY, part.vertProperties[i + 1]);
    minZ = Math.min(minZ, part.vertProperties[i + 2]); maxZ = Math.max(maxZ, part.vertProperties[i + 2]);
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

function combinedPartBounds(parts: ClickerPart[]) {
  const bounds = parts.map(partBounds);
  return {
    minX: Math.min(...bounds.map((bound) => bound.minX)),
    minY: Math.min(...bounds.map((bound) => bound.minY)),
    minZ: Math.min(...bounds.map((bound) => bound.minZ)),
    maxX: Math.max(...bounds.map((bound) => bound.maxX)),
    maxY: Math.max(...bounds.map((bound) => bound.maxY)),
    maxZ: Math.max(...bounds.map((bound) => bound.maxZ)),
  };
}

// Width of a contour where the neck enters the image. Intersect edges with
// the join plane rather than using the full image bounding box: ears, tails
// and other protrusions must not make the neck wider than the local silhouette.
function ringSpanAt(rings: Ring[], axis: 0 | 1, at: number): [number, number] | null {
  const across = axis === 0 ? 1 : 0;
  const values: number[] = [];
  for (const ring of rings) for (let index = 0; index < ring.length; index++) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-7) continue;
    const t = (at - a[axis]) / delta;
    if (t >= 0 && t <= 1) values.push(a[across] + t * (b[across] - a[across]));
  }
  return values.length ? [Math.min(...values), Math.max(...values)] : null;
}

// Imported blocks can have fluted, curved or asymmetric leading ends. Use
// triangles crossing the join plane, not the overall (often wider) bounds.
function partSpanAt(parts: ClickerPart[], axis: 0 | 1, at: number): [number, number] | null {
  const across = axis === 0 ? 1 : 0;
  const values: number[] = [];
  for (const part of parts) {
    const bounds = partBounds(part);
    const lower = axis === 0 ? bounds.minX : bounds.minY;
    const upper = axis === 0 ? bounds.maxX : bounds.maxY;
    if (at < lower - 1e-6 || at > upper + 1e-6) continue;
    const vertices = part.vertProperties;
    const triangles = part.triVerts;
    const stride = part.numProp;
    for (let index = 0; index + 2 < triangles.length; index += 3) {
      for (const [aIndex, bIndex] of [[triangles[index], triangles[index + 1]], [triangles[index + 1], triangles[index + 2]], [triangles[index + 2], triangles[index]]]) {
        const a = aIndex * stride; const b = bIndex * stride;
        const delta = vertices[b + axis] - vertices[a + axis];
        if (Math.abs(delta) < 1e-7) continue;
        const t = (at - vertices[a + axis]) / delta;
        if (t >= 0 && t <= 1) values.push(vertices[a + across] + t * (vertices[b + across] - vertices[a + across]));
      }
    }
  }
  return values.length ? [Math.min(...values), Math.max(...values)] : null;
}

// Ease each side of the bridge between the image and imported block. Matching
// the tangent to the join plane keeps the neck from ending in a sharp corner.
function smoothNeckOutline(
  axis: 0 | 1,
  startAt: number,
  endAt: number,
  startSpan: [number, number],
  endSpan: [number, number],
): Ring {
  const steps = 20;
  const run = endAt - startAt;
  const edge = (start: number, end: number): [number, number][] => Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const inverse = 1 - t;
    const along = inverse ** 3 * startAt
      + 3 * inverse ** 2 * t * (startAt + run * 0.42)
      + 3 * inverse * t ** 2 * (endAt - run * 0.42)
      + t ** 3 * endAt;
    const across = inverse ** 3 * start
      + 3 * inverse ** 2 * t * start
      + 3 * inverse * t ** 2 * end
      + t ** 3 * end;
    return axis === 0 ? [along, across] : [across, along];
  });
  const low = edge(startSpan[0], endSpan[0]);
  const high = edge(startSpan[1], endSpan[1]);
  return [low[0], high[0], ...high.slice(1), ...low.slice().reverse().slice(0, -1)];
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
  importedBlockParts?: ClickerPart[],
): { parts: ClickerPart[]; switchPlacements: SwitchPlacement[]; warnings: string[] } {
  const importedBodyIndex = importedBlockParts?.length
    ? importedBlockParts.reduce((best, part, index, all) => part.triVerts.length > all[best].triVerts.length ? index : best, 0)
    : -1;
  const useImportedBlock = importedBodyIndex >= 0;
  const blockResult = useImportedBlock
    ? { parts: [] as ClickerPart[], switchPlacements: [] as SwitchPlacement[], warnings: [] as string[] }
    : buildBlocks(wasm, assets, keycap, blockParams, socket);
  const warnings = [...blockResult.warnings];
  if (!imageOutline.length) {
    warnings.push('Upload an image to create the image head.');
    return blockResult;
  }
  const ctx = new BuildContext(wasm);
  const cleanOutline = mapCleanRings(imageOutline, (x, y) => [x, y], 0.0001);
  const outlineBounds = ringBounds(cleanOutline);
  if (!(outlineBounds.width > 0.01 && outlineBounds.height > 0.01)) {
    ctx.cleanup();
    warnings.push('The image has no printable outline.');
    return blockResult;
  }
  const placements = blockResult.switchPlacements;
  if (!placements.length && !useImportedBlock) {
    ctx.cleanup();
    warnings.push('Enter at least one character to create the socket base.');
    return blockResult;
  }

  const bodyColor = blockParams.bodyColorRgb ?? params.bodyColorRgb ?? DEFAULT_BODY;
  const vertical = blockParams.vertical;
  const count = Math.max(1, placements.length);
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
  const importedSourceBounds = useImportedBlock && importedBlockParts?.length
    ? combinedPartBounds(importedBlockParts)
    : null;
  const importedBlockHeight = importedSourceBounds
    ? importedSourceBounds.maxZ - importedSourceBounds.minZ
    : 0;
  // This is a real carrier-wall height, not a cosmetic offset for the
  // preview. Keep the range comparable to base thickness so increasing it
  // produces a taller solid that actually covers the switch.
  const baseWallHeight = clamp(params.hybridBaseWallHeightMm, 0, 20, 8);
  const headLength = clamp(params.hybridNeckLengthMm, 0, 30, 3);
  const importedNeckEnabled = params.hybridNeckEnabled !== false;
  const importedNeckSmooth = params.hybridNeckSmooth !== false;
  const overlap = Math.max(0.5, clamp(params.hybridBaseImageOverlapMm, 0, 20, 7));
  const matchBlockHeight = useImportedBlock && params.hybridImageMatchBlockHeight === true && importedBlockHeight > 0.01;
  const imageThickness = matchBlockHeight
    ? importedBlockHeight
    : Math.max(baseThickness, clamp(params.hybridImageThicknessMm, 4, 24, 17));
  const imagePadding = clamp(params.hybridImagePaddingMm, 0, 20, 1.2);
  const imageTopZ = imageThickness - baseThickness;
  const imageSurfaceLift = 0.04;
  const inlayDepth = 0.28;
  // The image skin must overlap the backing slightly. A skin that only touches
  // the backing at one Z plane becomes a set of detached shells after 3MF
  // export, which can render as a rippled/uneven image face in slicers.
  const imageSkinBackingOverlap = 0.06;
  const imageTop = imageTopZ + imageSurfaceLift;
  const imageCarrierBottom = useImportedBlock ? imageTop - inlayDepth : -baseThickness;
  const headPadding = pocketSize / 2 + headLength;
  const tailPadding = Math.max(endPadding, pocketSize / 2 + 1.5);
  const carrierLength = Math.max(baseWidth, overlap + headPadding + (count - 1) * pitch + tailPadding);
  const carrierWidth = vertical ? baseWidth : carrierLength;
  const carrierDepth = vertical ? carrierLength : baseWidth;
  const cornerRadius = Math.min(
    clamp(params.hybridBaseCornerRadiusMm, 1, 14, 5),
    Math.min(carrierWidth, carrierDepth) / 2 - 0.15,
  );
  const baseStyle = params.hybridBaseStyle ?? 'vase';

  const imageScale = imageSize / Math.max(outlineBounds.width, outlineBounds.height);
  const imageCenterX = (outlineBounds.minX + outlineBounds.maxX) / 2;
  const imageCenterY = (outlineBounds.minY + outlineBounds.maxY) / 2;
  const lateralShift = useImportedBlock ? clamp(params.hybridImageLateralOffsetMm, -25, 25, 0) : 0;
  const blockLateralShift = useImportedBlock ? clamp(params.hybridBlockLateralOffsetMm, -30, 30, 0) : 0;
  const headShiftX = vertical ? lateralShift : 0;
  const headShiftY = vertical ? 0 : lateralShift;
  const scaledOutline = cleanOutline
    .map((ring) => ring.map(([x, y]) => [
      (x - imageCenterX) * imageScale + headShiftX,
      (y - imageCenterY) * imageScale + headShiftY,
    ] as [number, number]));
  if (!scaledOutline.length) {
    ctx.cleanup();
    warnings.push('The image outline could not be converted into a head.');
    return blockResult;
  }

  // Imported SVG/raster traces can contain nearly duplicate points and tiny
  // contour fragments. Simplify before any offset/extrude so the image head
  // is one stable printable section instead of a self-intersecting collection
  // of microscopic faces.
  const imageSection = ctx.simp(ctx.track(new wasm.CrossSection(scaledOutline, 'NonZero')));
  // Match Image mode's Flat keychain construction: the imported silhouette is
  // inset from a separately adjustable outer plate instead of using the
  // generic border-width setting from the regular clicker.
  let badgeSection = imageSection;
  if (imagePadding > 0.001) {
    try {
      badgeSection = ctx.simp(ctx.track(imageSection.offset(imagePadding, 'Round', 2, 32)));
    } catch (error) {
      // A malformed/self-touching imported contour must not turn the top into
      // a cone/sliver. Keep the original simplified silhouette as fallback.
      warnings.push(`image-padding-fallback err=${String(error)}`);
    }
  }
  let bottomImageArea: any | null = null;
  let bottomImageMapPoint: ((x: number, y: number) => [number, number]) | null = null;
  if (params.bottomOutline?.length) {
    const sourceBounds = ringBounds(params.bottomOutline);
    if (sourceBounds.width > 0.01 && sourceBounds.height > 0.01) {
      const bottomScale = imageSize / Math.max(sourceBounds.width, sourceBounds.height);
      const bottomExpansion = 1 + clamp(params.bottomExpandPercent, 0, 100, 22) / 100;
      const rotation = (params.bottomRotation ?? 0) * Math.PI / 180;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const rotate = (x: number, y: number): [number, number] => [x * cos - y * sin, x * sin + y * cos];
      const centeredBottom = mapCleanRings(params.bottomOutline, (x, y) => rotate(
        (x - (sourceBounds.minX + sourceBounds.maxX) / 2) * bottomScale * bottomExpansion,
        (y - (sourceBounds.minY + sourceBounds.maxY) / 2) * bottomScale * bottomExpansion,
      ), 0.0001);
      if (centeredBottom.length) {
        let bottomSection = ctx.track(new wasm.CrossSection(centeredBottom, 'NonZero'));
        const localBounds = bottomSection.bounds();
        const topBounds = badgeSection.bounds();
        const bottomOffsetX = params.bottomOffsetX ?? 0;
        const bottomOffsetY = params.bottomOffsetY ?? 0;
        // Keep both images on the same visible face. Place the custom image
        // immediately below the main image along the block's attachment axis,
        // with a small overlap so the badge remains one printable plate.
        const joinOverlap = 1;
        const placeX = vertical
          ? (topBounds.min[0] + topBounds.max[0] - localBounds.min[0] - localBounds.max[0]) / 2 + bottomOffsetX
          : topBounds.max[0] - joinOverlap - localBounds.min[0] + bottomOffsetX;
        const placeY = vertical
          ? topBounds.min[1] + joinOverlap - localBounds.max[1] + bottomOffsetY
          : (topBounds.min[1] + topBounds.max[1] - localBounds.min[1] - localBounds.max[1]) / 2 + bottomOffsetY;
        bottomSection = ctx.track(bottomSection.translate([placeX, placeY]));
        bottomImageArea = bottomSection;
        bottomImageMapPoint = (x, y) => {
          const point = rotate(
            (x - (sourceBounds.minX + sourceBounds.maxX) / 2) * bottomScale * bottomExpansion,
            (y - (sourceBounds.minY + sourceBounds.maxY) / 2) * bottomScale * bottomExpansion,
          );
          return [point[0] + placeX, point[1] + placeY];
        };
        const bottomPadding = clamp(params.bottomPaddingMm, 0, 12, 1.2);
        const bottomBadge = bottomPadding > 0.001
          ? ctx.track(bottomSection.offset(bottomPadding, 'Round', 2, 32))
          : bottomSection;
        badgeSection = ctx.simp(ctx.track(badgeSection.add(bottomBadge)));
      }
    }
  }
  const badgeBounds = badgeSection.bounds();
  const badgeWidth = badgeBounds.max[0] - badgeBounds.min[0];
  const badgeDepth = badgeBounds.max[1] - badgeBounds.min[1];
  const keychainEnabled = params.keychain?.enabled === true;
  const keychainPosition = params.keychain?.hybridPosition === 'bottom' ? 'bottom' : 'top';
  const keychainAngle = keychainPosition === 'bottom' ? 270 : 90;
  const keychainHoleDiameter = clamp(params.keychain?.holeDiameterMm, 3, 16, 5.2);
  const keychainLoopRadius = Math.max(3.2, keychainHoleDiameter / 2 + 1.8);
  const keychainDirection = [Math.cos(keychainAngle * Math.PI / 180), Math.sin(keychainAngle * Math.PI / 180)] as [number, number];
  const keychainEdge = edgePointAt(badgeSection, keychainAngle);
  const keychainOffset = useImportedBlock ? clamp(params.keychain?.offsetMm, -15, 15, 0) : 0;
  const keychainAnchor: [number, number] = [
    keychainEdge.p[0] - keychainEdge.dir[1] * keychainOffset,
    keychainEdge.p[1] + keychainEdge.dir[0] * keychainOffset,
  ];
  const keychainHoleCenter: [number, number] = [
    keychainAnchor[0] + keychainDirection[0] * keychainLoopRadius,
    keychainAnchor[1] + keychainDirection[1] * keychainLoopRadius,
  ];
  const carrierHeadEdge = vertical ? -badgeDepth / 2 + overlap : badgeWidth / 2 - overlap;
  const shiftX = vertical ? 0 : carrierHeadEdge + carrierWidth / 2;
  const shiftY = vertical ? carrierHeadEdge - carrierDepth / 2 : 0;

  const importedPartsMoved: ClickerPart[] = [];
  let importedNeck: any = null;
  let importedNeckBottomZ: number | null = null;
  let importedNeckHeight = 0;
  let carrier: any;
  if (useImportedBlock && importedBlockParts) {
    // A 3MF scene may contain the block shell, ribs and inserts as several
    // meshes. Anchor the attachment to the whole scene bounds; using only the
    // mesh with the most triangles can leave other source components floating
    // into the image or make the generated neck meet the wrong component.
    const bounds = combinedPartBounds(importedBlockParts);
    // Leave room for a bottom keyring between the image and vertical block.
    // Its hole must stay outside the source mesh, which remains unchanged.
    const ringClearance = keychainEnabled && vertical && keychainPosition === 'bottom'
      ? keychainLoopRadius + keychainHoleDiameter / 2 + 1.25
      : 0;
    // This value is the actual gap between the image and imported block. Keep
    // it active when the neck is hidden so the distance control stays useful;
    // the neck itself is then regenerated to span the new gap when enabled.
    const spacing = clamp(params.hybridImportedBlockSpacingMm, -20, 30, headLength);
    const attachedHeadLength = ringClearance > 0 ? Math.max(spacing, ringClearance) : spacing;
    const dx = vertical
      ? -(bounds.minX + bounds.maxX) / 2 + blockLateralShift
      : badgeBounds.max[0] + attachedHeadLength - bounds.minX;
    const dy = vertical
      ? badgeBounds.min[1] - attachedHeadLength - bounds.maxY
      : -(bounds.minY + bounds.maxY) / 2 + blockLateralShift;
    const dz = -baseThickness - bounds.minZ;
    const moved = importedBlockParts.map((part) => {
      const vertices = new Float32Array(part.vertProperties);
      for (let i = 0; i + 2 < vertices.length; i += part.numProp) {
        vertices[i] += dx; vertices[i + 1] += dy; vertices[i + 2] += dz;
      }
      return { ...part, vertProperties: vertices, triVerts: new Uint32Array(part.triVerts) };
    });
    const mb = combinedPartBounds(moved);
    const axis: 0 | 1 = vertical ? 1 : 0;
    const imageExtent = vertical ? badgeDepth : badgeWidth;
    const blockExtent = vertical ? mb.maxY - mb.minY : mb.maxX - mb.minX;
    // Both endpoints sit *inside* their solids. The neck follows the local
    // widths there, so resizing either the image or the imported block changes
    // its taper and the Boolean union remains a single printable body.
    const imageInset = Math.min(imageExtent * 0.35, Math.max(3, imagePadding + 2, imageExtent * 0.12));
    // Enter the imported shell only far enough for a real overlap. A deep
    // bridge can fill its switch well and swallow details near the front.
    const blockInset = Math.min(1.5, Math.max(0.6, blockExtent * 0.05));
    const imageJoin = vertical ? badgeBounds.min[1] + imageInset : badgeBounds.max[0] - imageInset;
    const blockJoin = vertical ? mb.maxY - blockInset : mb.minX + blockInset;
    const imageSpan = ringSpanAt(scaledOutline, axis, imageJoin)
      ?? (vertical ? [badgeBounds.min[0], badgeBounds.max[0]] : [badgeBounds.min[1], badgeBounds.max[1]]);
    const blockSpan = partSpanAt(moved, axis, blockJoin)
      ?? (vertical ? [mb.minX, mb.maxX] : [mb.minY, mb.maxY]);
    const imageLow = imageSpan[0] - imagePadding * 0.65;
    const imageHigh = imageSpan[1] + imagePadding * 0.65;
    const blockLow = blockSpan[0];
    const blockHigh = blockSpan[1];
    const neckOutline = smoothNeckOutline(
      axis,
      imageJoin,
      blockJoin,
      [imageLow, imageHigh],
      [blockLow, blockHigh],
    );
    if (importedNeckEnabled) {
      let neckFootprint = ctx.track(new wasm.CrossSection([neckOutline], 'NonZero'));
      if (importedNeckSmooth) {
        // Add a small rounded shoulder while keeping the original 3MF meshes
        // untouched. The Bezier sides soften the taper; this offset rounds the
        // remaining plan-view edge.
        const neckRun = Math.abs(blockJoin - imageJoin);
        const neckWidth = Math.min(imageHigh - imageLow, blockHigh - blockLow);
        const radius = Math.min(1.6, neckRun * 0.12, neckWidth * 0.12);
        if (radius >= 0.25) {
          neckFootprint = ctx.simp(ctx.track(neckFootprint.offset(radius, 'Round', 2, 24)));
        }
      }
      // Fill the image backing depth and overlap the block in XY so the
      // transition reads as one body. The image skin remains separate above.
      const neckBottom = mb.minZ;
      const neckTop = Math.min(mb.maxZ, imageCarrierBottom);
      const neckHeight = Math.max(0.8, neckTop - neckBottom);
      importedNeckBottomZ = neckBottom;
      importedNeckHeight = neckHeight;
      importedNeck = ctx.track(wasm.Manifold.extrude(neckFootprint, neckHeight).translate([0, 0, neckBottom]));
      carrier = importedNeck;
    } else {
      carrier = null;
    }
    importedPartsMoved.push(...moved);
  } else {
    const carrierProfile = baseStyle === 'vase'
      ? vaseCarrier(
        ctx,
        carrierWidth,
        carrierDepth,
        cornerRadius,
        params.hybridVaseProfile === 'wavy' ? 'wavy' : 'straight',
        clamp(params.hybridVaseWavinessMm, 0, 12, 2.5),
        clamp(params.hybridVaseThicknessMm, 1, 12, 3),
        clamp(params.hybridVaseGapMm, 0, 16, 2),
        [shiftX, shiftY],
        vertical,
      )
      : ctx.track(roundedRect(
        ctx,
        carrierWidth,
        carrierDepth,
        baseStyle === 'straight' ? 0.15 : cornerRadius,
      ).translate([shiftX, shiftY]));
    carrier = ctx.track(wasm.Manifold.extrude(carrierProfile, baseThickness + baseWallHeight)
      .translate([0, 0, -baseThickness]));

    // The generated carrier overlaps the image badge without a seam.
    const squareHeadDepth = Math.min(carrierLength, cornerRadius + overlap + 1);
    const squareHeadCore = ctx.track(wasm.CrossSection.square(
      vertical ? [carrierWidth, squareHeadDepth] : [squareHeadDepth, carrierDepth],
      true,
    ).translate(vertical
      ? [0, carrierHeadEdge - squareHeadDepth / 2]
      : [carrierHeadEdge + squareHeadDepth / 2, 0]));
    const squareHeadProfile = baseStyle === 'vase'
      ? ribbedProfile(
        ctx,
        squareHeadCore,
        clamp(params.hybridVaseThicknessMm, 1, 12, 3),
        clamp(params.hybridVaseGapMm, 0, 16, 2),
        params.hybridVaseProfile === 'wavy' ? clamp(params.hybridVaseWavinessMm, 0, 12, 2.5) : 0,
      )
      : squareHeadCore;
    const squareHead = ctx.track(wasm.Manifold.extrude(squareHeadProfile, baseThickness + baseWallHeight)
      .translate([0, 0, -baseThickness]));
    carrier = ctx.track(carrier.add(squareHead));
  }
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

  // The traced colour regions are a partition of the raster mask, not a
  // guaranteed watertight fill after independent contouring.  Keeping a
  // white solid underneath them makes every tiny contour mismatch visible as
  // white pepper-like holes in the imported artwork.  Use the image outline
  // as a continuous carrier in the dominant image material, then cut only
  // the accent regions from that carrier.  The outer padding remains white.
  const stackImageMode = params.stackColorLayers === true;
  const monochromeImageRelief = params.monochromeImageRelief === true;
  const orderedImageRegions = imageRegions
    .map((region, regionIndex) => ({ region, regionIndex }))
    .sort((a, b) => stackImageMode
      ? a.regionIndex - b.regionIndex
      : b.region.coverage - a.region.coverage || a.regionIndex - b.regionIndex);
  const carrierRegion = orderedImageRegions[0]?.region;
  const dominantImageColor = carrierRegion?.filamentRgb ?? params.baseFilamentRgb ?? bodyColor;
  // Only merge an image region into the carrier when both resolve to the
  // exact same filament colour. A small RGB-distance threshold can erase a
  // real palette entry (for example an off-white highlight beside a white
  // background), making Image + Imported Block lose colours that Image keeps.
  const sameAsCarrier = (region: BuildRegion) => region.filamentRgb.every(
    (channel, index) => channel === dominantImageColor[index],
  );
  const maskInputs = orderedImageRegions
    .filter(({ region }) => stackImageMode || monochromeImageRelief || !sameAsCarrier(region))
    .sort((a, b) => stackImageMode
      ? a.regionIndex - b.regionIndex
      : a.region.coverage - b.region.coverage || a.regionIndex - b.regionIndex);
  const imageMasks = buildImageMaskPipeline(ctx, {
    inputs: maskInputs.map(({ region, regionIndex }) => ({ region, layerIndex: regionIndex })),
    imageScale,
    minimumArea: 0.05,
    colorBleed: clamp(params.colorBleed, 0, 2, 0.12),
    imageArea: imageSection,
    plate: badgeSection,
    stack: stackImageMode,
    stackFullFootprint: imageSection,
    solidSilhouette: false,
    componentLevel: (region) => params.componentHeights?.[region.partName ?? ''] ?? 0,
    mapPoint: (x, y) => [
      (x - imageCenterX) * imageScale + headShiftX,
      (y - imageCenterY) * imageScale + headShiftY,
    ],
  });
  const bottomImageRegions = (params.bottomRegions ?? [])
    .map((region, regionIndex) => ({ region, regionIndex }))
    .sort((a, b) => a.region.coverage - b.region.coverage || a.regionIndex - b.regionIndex);
  const bottomCarrierColor = bottomImageRegions.reduce(
    (best, current) => current.region.coverage > best.coverage ? { coverage: current.region.coverage, color: current.region.filamentRgb } : best,
    { coverage: -Infinity, color: dominantImageColor },
  ).color;
  const bottomImageMasks = bottomImageArea && bottomImageMapPoint
    ? buildImageMaskPipeline(ctx, {
      inputs: bottomImageRegions.map(({ region, regionIndex }) => ({ region, layerIndex: regionIndex })),
      imageScale: 1,
      minimumArea: 0.05,
      colorBleed: clamp(params.colorBleed, 0, 2, 0.12),
      imageArea: bottomImageArea,
      plate: badgeSection,
      stack: false,
      solidSilhouette: false,
      componentLevel: (region) => params.componentHeights?.[region.partName ?? ''] ?? 0,
      mapPoint: bottomImageMapPoint,
    })
    : [];
  const imagePlateSection = bottomImageArea
    ? ctx.simp(ctx.track(imageSection.add(bottomImageArea)))
    : imageSection;
  // Imported blocks keep the image ink on a thin top skin, as in Image mode.
  // Filling the entire head with the dominant colour makes its side walls
  // look like part of the block and amplifies tiny contour imperfections.
  let imageCarrier = ctx.track(wasm.Manifold.extrude(
    imageSection,
    Math.max(0.25, imageTop - imageCarrierBottom),
  ).translate([0, 0, imageCarrierBottom]));
  let bottomImageCarrier = bottomImageArea
    ? ctx.track(wasm.Manifold.extrude(bottomImageArea, Math.max(0.25, imageTop - imageCarrierBottom))
      .translate([0, 0, imageCarrierBottom]))
    : null;

  let badgeBody = ctx.track(wasm.Manifold.extrude(badgeSection, imageThickness)
    .translate([0, 0, -baseThickness]));
  // Carve a recess for the ink. Imported blocks retain white backing below
  // the thin image skin; generated blocks keep their original full-depth head.
  const imageCore = ctx.track(wasm.Manifold.extrude(
    imagePlateSection,
    useImportedBlock ? inlayDepth + 0.12 : imageThickness + 0.12,
  ).translate([0, 0, useImportedBlock ? imageCarrierBottom + imageSkinBackingOverlap : -baseThickness - 0.04]));
  badgeBody = ctx.track(badgeBody.subtract(imageCore));
  if (importedNeck) badgeBody = ctx.track(badgeBody.subtract(importedNeck));
  if (keychainEnabled) {
    // Use the same round loop and long bridge as Image mode. Clip the bridge
    // to the image silhouette so it joins the backing cleanly without a filled
    // or partially covered hole.
    const loopR = keychainLoopRadius;
    const keychainThickness = clamp(params.hybridKeychainHeightMm, 1, 15, 4);
    // Keep the keyring tab on the same front plane as the image layers.
    // Previously it was extruded from the underside of the badge, making the
    // loop look detached and burying its connection when viewed from above.
    const keychainTopZ = imageTop;
    const keychainBottomZ = keychainTopZ - keychainThickness;
    const localLoop = ctx.track(wasm.CrossSection.circle(loopR, 64).translate([0, loopR]));
    const localBridge = ctx.track(wasm.CrossSection.square([loopR * 2, loopR + loopR * 3.5], true)
      .translate([0, loopR - (loopR + loopR * 3.5) / 2]));
    let tabProfile = ctx.track(localLoop.add(localBridge));
    if (Math.abs(keychainAngle - 90) > 0.001) tabProfile = ctx.track(tabProfile.rotate(keychainAngle - 90));
    tabProfile = ctx.track(tabProfile.translate(keychainAnchor));
    tabProfile = ctx.simp(ctx.track(tabProfile.subtract(imageSection)));
    const tabSolid = ctx.track(wasm.Manifold.extrude(tabProfile, keychainThickness)
      .translate([0, 0, keychainBottomZ]));
    const holeProfile = ctx.track(wasm.CrossSection.circle(keychainHoleDiameter / 2, 48)
      .translate(keychainHoleCenter));
    const hole = ctx.track(wasm.Manifold.extrude(holeProfile, keychainThickness + 2)
      .translate([0, 0, keychainBottomZ - 1]));
    badgeBody = ctx.track(badgeBody.add(tabSolid).subtract(hole));
    // The bottom loop sits between the head and vertical block. Bore the
    // transition too, while the added clearance keeps the original 3MF block
    // outside the hole and preserves its source triangles exactly.
    if (keychainPosition === 'bottom' && importedNeck && importedNeckBottomZ !== null && importedNeckHeight > 0) {
      const neckHole = ctx.track(wasm.Manifold.extrude(holeProfile, importedNeckHeight + 2)
        .translate([0, 0, importedNeckBottomZ - 1]));
      importedNeck = ctx.track(importedNeck.subtract(neckHole));
      carrier = importedNeck;
    }
  }

  // A custom lower image is laid out below the main artwork on the same
  // visible face. It is part of the head plate rather than a second backside
  // layer, so both silhouettes have the same height and presentation plane.
  const lowerBody = carrier;
  // The imported image is the flat-keychain plate in Image + Blocks mode.
  // Keep the plate itself flat and switch-free. Image colour layers start at
  // the badge top plane; the image Extrude control grows them upward from
  // that plane, so the setting produces a visible printable relief.
  const imageTopScale = 1;

  // Imported parts are appended with their final placements below. Keeping
  // them out of this generated-block list avoids duplicate coplanar meshes,
  // which cause z-fighting in preview and duplicate geometry in exported 3MF.
  const movableParts = useImportedBlock
    ? []
    : blockResult.parts.filter((part) => !(part.kind === 'body' && part.group === 'base'));
  for (const part of useImportedBlock ? [] : movableParts) {
    const slotIndex = partSlotIndex(part.name);
    const original = slotIndex === null ? null : placements[slotIndex];
    const target = slotIndex === null ? null : shiftedPlacements[slotIndex];
    shiftPart(part, target && original ? target.x - original.x : shiftX, target && original ? target.y - original.y : shiftY);
  }
  const parts: ClickerPart[] = [...movableParts];

  // Image mode and Image + Imported Block now share cleaned, clipped,
  // non-overlapping 2D masks. Each mask is also the exact contour subtracted
  // from the carrier, preventing triangle seams and colour overlap.
  for (const { region, layerIndex, footprint } of imageMasks) {
      // Stack mode reserves the first colour as the full-silhouette carrier.
      if (stackImageMode && layerIndex === orderedImageRegions[0]?.regionIndex) continue;
      const topLayer = imageTopScale === 1
        ? footprint
        : ctx.track(footprint.scale([imageTopScale, imageTopScale]));
      const imagePartName = `hybrid-image-${layerIndex}`;
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
      // Make the default image flush with the badge while giving it a shallow
      // real inlay. When Extrude is increased, only the coloured layer rises;
      // the badge is carved first so the meshes never overlap coplanarly.
      const imageLayerHeight = inlayDepth + imageExtrude;
      const imageLayerBottom = imageTop - inlayDepth;
      const layer = ctx.track(wasm.Manifold.extrude(topLayer, imageLayerHeight)
        .translate([0, 0, imageLayerBottom]));
      if (!layer.isEmpty()) {
        if (monochromeImageRelief) {
          imageCarrier = ctx.simp(ctx.track(imageCarrier.add(layer)));
        } else {
          const cavity = ctx.track(wasm.Manifold.extrude(topLayer, inlayDepth + 0.02)
            .translate([0, 0, imageLayerBottom]));
          imageCarrier = ctx.track(imageCarrier.subtract(cavity));
          if (!useImportedBlock && !stackImageMode) badgeBody = ctx.track(badgeBody.subtract(cavity));
          parts.push(toPart(layer, 'body', 'base', region.filamentRgb, imagePartName));
        }
      }
  }

  for (const { region, layerIndex, footprint } of bottomImageMasks) {
    const imagePartName = `hybrid-image-${layerIndex}-bottom`;
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
    const imageLayerBottom = imageTop - inlayDepth;
    const layer = ctx.track(wasm.Manifold.extrude(footprint, inlayDepth + imageExtrude)
      .translate([0, 0, imageLayerBottom]));
    if (layer.isEmpty()) continue;
    if (monochromeImageRelief) {
      bottomImageCarrier = ctx.simp(ctx.track(bottomImageCarrier!.add(layer)));
    } else {
      const cavity = ctx.track(wasm.Manifold.extrude(footprint, inlayDepth + 0.02)
        .translate([0, 0, imageLayerBottom]));
      bottomImageCarrier = ctx.track(bottomImageCarrier!.subtract(cavity));
      if (!useImportedBlock && !stackImageMode) badgeBody = ctx.track(badgeBody.subtract(cavity));
      parts.push(toPart(layer, 'body', 'base', region.filamentRgb, imagePartName));
    }
  }

  parts.push(toPart(imageCarrier, 'body', 'base', dominantImageColor, 'hybrid-image-base'));
  if (bottomImageCarrier && !bottomImageCarrier.isEmpty()) {
    parts.push(toPart(bottomImageCarrier, 'body', 'base', bottomCarrierColor, 'hybrid-bottom-image-base'));
  }
  if (useImportedBlock && importedBlockParts) {
    parts.push(toPart(badgeBody, 'body', 'base', bodyColor, 'hybrid-image-backing'));
    if (lowerBody && !lowerBody.isEmpty()) {
      parts.push(toPart(lowerBody, 'body', 'base', importedBlockParts[importedBodyIndex].colorRgb, 'hybrid-continuous-base'));
    }
    parts.push(...importedPartsMoved);
  } else {
    const mergedBody = ctx.track(badgeBody.add(lowerBody));
    parts.push(toPart(mergedBody, 'body', 'base', bodyColor, 'hybrid-continuous-base'));
  }

  ctx.cleanup();
  return { parts, switchPlacements: shiftedPlacements, warnings };
}
