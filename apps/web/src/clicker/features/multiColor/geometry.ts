import * as THREE from 'three';
import type { ClickerPart, RGB, Ring } from '../../types';
import type { MultiColorDocument, MultiColorSettings } from './model';

type Group = 'top' | 'base';

interface GeometryPartOptions {
  /** Remove downward-facing horizontal caps at joined Z interfaces. */
  dropBottomCaps?: boolean | ((geometryIndex: number) => boolean);
}

function geometryToPart(
  geometries: THREE.BufferGeometry[],
  group: Group,
  name: string,
  colorRgb: RGB,
  options: GeometryPartOptions = {},
): ClickerPart {
  const positions: number[] = [];
  const triangles: number[] = [];
  let vertexOffset = 0;
  for (const [geometryIndex, geometry] of geometries.entries()) {
    const clean = geometry.index ? geometry.toNonIndexed() : geometry;
    const position = clean.getAttribute('position');
    for (let i = 0; i < position.count; i++) positions.push(position.getX(i), position.getY(i), position.getZ(i));
    const configured = options.dropBottomCaps;
    const dropBottomCaps = typeof configured === 'function' ? configured(geometryIndex) : configured === true;
    for (let i = 0; i + 2 < position.count; i += 3) {
      // Contour smoothing can leave a microscopic sliver at a sharp colour
      // junction. It is visually invisible but becomes a one-line island in a
      // slicer, which is the source of the small "acne" specks in the preview.
      if (isTinyTriangle(position, i)) continue;
      if (dropBottomCaps && isDownwardCap(position, i)) continue;
      triangles.push(vertexOffset + i, vertexOffset + i + 1, vertexOffset + i + 2);
    }
    vertexOffset += position.count;
    if (clean !== geometry) clean.dispose();
  }
  return {
    kind: group === 'top' ? 'cap' : 'body',
    group,
    colorRgb,
    name,
    vertProperties: new Float32Array(positions),
    triVerts: new Uint32Array(triangles),
    numProp: 3,
  };
}

function isTinyTriangle(position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, offset: number): boolean {
  const ax = position.getX(offset + 1) - position.getX(offset);
  const ay = position.getY(offset + 1) - position.getY(offset);
  const az = position.getZ(offset + 1) - position.getZ(offset);
  const bx = position.getX(offset + 2) - position.getX(offset);
  const by = position.getY(offset + 2) - position.getY(offset);
  const bz = position.getZ(offset + 2) - position.getZ(offset);
  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;
  return nx * nx + ny * ny + nz * nz < 1e-8;
}

function isDownwardCap(position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, offset: number): boolean {
  const ax = position.getX(offset + 1) - position.getX(offset);
  const ay = position.getY(offset + 1) - position.getY(offset);
  const az = position.getZ(offset + 1) - position.getZ(offset);
  const bx = position.getX(offset + 2) - position.getX(offset);
  const by = position.getY(offset + 2) - position.getY(offset);
  const bz = position.getZ(offset + 2) - position.getZ(offset);
  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;
  const length = Math.hypot(nx, ny, nz);
  return length > 1e-10 && nz < -length * 0.999999;
}

function makeShape(rings: Ring[]): THREE.Shape | null {
  const outer = rings[0];
  if (!outer || outer.length < 3) return null;
  const shape = new THREE.Shape();
  shape.moveTo(outer[0][0], outer[0][1]);
  for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i][0], outer[i][1]);
  shape.closePath();
  for (const holeRing of rings.slice(1)) {
    if (holeRing.length < 3) continue;
    const hole = new THREE.Path();
    hole.moveTo(holeRing[0][0], holeRing[0][1]);
    for (let i = 1; i < holeRing.length; i++) hole.lineTo(holeRing[i][0], holeRing[i][1]);
    hole.closePath();
    shape.holes.push(hole);
  }
  return shape;
}

/**
 * The first physical colour is a carrier/underlay. It must cover the complete
 * foreground silhouette, including detached artwork such as a corner badge or
 * a separated accent. The old largest-ring shortcut silently discarded those
 * islands and made the under-colour disappear in the exported stack.
 */
function makeFilledSilhouettes(components: Ring[][]): THREE.Shape[] {
  return components
    .map((rings) => makeShape(rings))
    .filter((shape): shape is THREE.Shape => shape !== null);
}

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function bounds(rings: Ring[]): Bounds | null {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY)
    ? { minX, minY, maxX, maxY }
    : null;
}

function roundedRectangle(width: number, height: number, radius: number): THREE.Shape {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  shape.closePath();
  return shape;
}

function ringShape(outerRadius: number, innerRadius: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

function frameShape(
  width: number,
  height: number,
  outerRadius: number,
  innerWidth: number,
  innerHeight: number,
  innerRadius: number,
): THREE.Shape | null {
  if (innerWidth <= 0 || innerHeight <= 0 || innerWidth >= width - 0.1 || innerHeight >= height - 0.1) return null;
  const frame = roundedRectangle(width, height, outerRadius);
  frame.holes.push(roundedRectangle(innerWidth, innerHeight, innerRadius));
  return frame;
}

function extrude(shape: THREE.Shape, depth: number, z: number): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.05, depth),
    bevelEnabled: false,
    curveSegments: 24,
    steps: 1,
  });
  geometry.translate(0, 0, z);
  return geometry;
}

function hex(rgb: RGB): string { return rgb.map((value) => value.toString(16).padStart(2, '0')).join(''); }

/**
 * Build one solid for every traced component in a set of colour regions.
 * Keeping the component boundaries here is important: a RegionSet can contain
 * several disconnected islands and each component can contain holes.
 */
function extrudeRegionComponents(
  regions: MultiColorDocument['regionSet']['regions'],
  mapRing: (ring: Ring) => Ring,
  depth: number,
  z: number,
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  for (const region of regions) {
    for (const component of region.components) {
      const shape = makeShape(component.rings.map(mapRing));
      if (shape) geometries.push(extrude(shape, depth, z));
    }
  }
  return geometries;
}

export function buildMultiColorParts(doc: MultiColorDocument, settings: MultiColorSettings): ClickerPart[] {
  const fallbackOutline = doc.regionSet.regions.flatMap((region) =>
    region.components.flatMap((component) => component.rings),
  );
  const sourceRings = doc.regionSet.outline.length ? doc.regionSet.outline : fallbackOutline;
  const sourceComponents = doc.regionSet.outlineComponents?.length
    ? doc.regionSet.outlineComponents
    : [sourceRings];
  const outlineBounds = bounds(sourceRings);
  if (!outlineBounds) return [];

  // Trace coordinates are normalized to the source image. Fit the longest
  // dimension to targetSizeMm instead of multiplying by it. This keeps every
  // imported image at a predictable physical size and prevents stretched
  // layers when width and height differ.
  const sourceWidth = Math.max(0.000001, outlineBounds.maxX - outlineBounds.minX);
  const sourceHeight = Math.max(0.000001, outlineBounds.maxY - outlineBounds.minY);
  const scale = Math.max(0.01, settings.targetSizeMm / Math.max(sourceWidth, sourceHeight));
  const centerX = (outlineBounds.minX + outlineBounds.maxX) / 2;
  const centerY = (outlineBounds.minY + outlineBounds.maxY) / 2;
  const mapRing = (ring: Ring): Ring => ring.map(([x, y]) => [(x - centerX) * scale, (y - centerY) * scale]);
  const contentWidth = Math.max(1, sourceWidth * scale);
  const contentHeight = Math.max(1, sourceHeight * scale);
  const padding = Math.max(0, settings.paddingMm);
  const baseThickness = Math.max(0.05, settings.baseThicknessMm);
  const layerHeight = Math.max(0.05, settings.layerHeightMm);
  const layerGap = Math.max(0, settings.layerGapMm);
  const effectiveBaseThickness = settings.includeBase ? baseThickness : 0;
  const width = Math.max(1, contentWidth + padding * 2);
  const height = Math.max(1, contentHeight + padding * 2);
  const outerRadius = Math.min(Math.max(0, settings.cornerRadiusMm), width / 2, height / 2);
  const parts: ClickerPart[] = [];

  // The floor and a raised perimeter are one exported Base part. The opening
  // is deliberately larger than the traced artwork so all colour layers sit
  // inside the frame instead of leaking over its edge.
  if (settings.includeBase) {
    const baseGeometries: THREE.BufferGeometry[] = [
      extrude(roundedRectangle(width, height, outerRadius), baseThickness, 0),
    ];
    const rimGap = Math.min(0.8, Math.max(0.2, padding * 0.35));
    const rim = frameShape(
      width,
      height,
      outerRadius,
      Math.max(1, contentWidth + rimGap * 2),
      Math.max(1, contentHeight + rimGap * 2),
      Math.max(0, Math.min(outerRadius - rimGap, (contentWidth + rimGap * 2) / 2, (contentHeight + rimGap * 2) / 2)),
    );
    if (rim) {
      // The rim is a low registration wall, not a lid. Keep it below the first
      // visible layer so the physical colour stack remains readable while the
      // frame still contains the artwork laterally.
      const rimHeight = Math.min(0.18, layerHeight * 0.2);
      baseGeometries.push(extrude(rim, Math.max(0.05, rimHeight), baseThickness));
    }
    parts.push(geometryToPart(
      baseGeometries,
      'base',
      'multi-color-base-frame',
      [235, 235, 231],
      // The rim now starts on top of the floor. Its lower cap is an internal
      // duplicate face, while the floor's bottom cap must remain printable.
      { dropBottomCaps: (geometryIndex) => geometryIndex > 0 },
    ));
    baseGeometries.forEach((geometry) => geometry.dispose());
  }

  /*
   * Stacked multi-colour printing is a mask stack, not a collection of
   * disconnected coloured islands:
   *
   *   layer 1 = the complete silhouette in the under-colour
   *   layer 2 = silhouette minus layer 1's colour
   *   layer 3 = silhouette minus layers 1–2's colours
   *
   * This is what makes a flag work: the yellow under-layer is full-size and
   * the red layer above has the star-shaped hole, so the yellow is visible
   * through the cut-out. The previous implementation extruded each palette
   * mask independently, which left the star floating above a red solid.
   *
   * Use the artwork's physical colour order: yellow underlay, red artwork,
   * white details, then blue background. Each layer contains the current colour
   * plus every colour above it, so all lower colours remain visible through the
   * cut-outs. Unknown colours fall back to coverage order.
   */
  // The controller owns the user-visible order. Do not sort here: rebuilding
  // geometry must preserve a manual drag/drop order from the palette.
  const orderedRegions = doc.regionSet.regions;
  // Adjacent exported objects must touch exactly, not overlap. A small
  // overlap is tempting for preview z-fighting, but Bambu/Orca may resolve
  // intersecting colored solids as one material and hide a vertical band.
  const contact = 0;

  const baseZ = settings.includeBase ? Math.max(0, effectiveBaseThickness) : 0;

  orderedRegions.forEach((region, regionIndex) => {
    const z = baseZ + (settings.layout === 'stacked'
      ? regionIndex * (layerHeight + layerGap)
      : 0);
    const geometries = settings.layout === 'stacked'
      ? regionIndex === 0
        ? makeFilledSilhouettes(sourceComponents.map((component) => component.map(mapRing)))
          .map((shape) => extrude(shape, layerHeight + contact, z))
        : extrudeRegionComponents(orderedRegions.slice(regionIndex), mapRing, layerHeight + contact, z)
      : extrudeRegionComponents([region], mapRing, layerHeight + contact, z);
    if (!geometries.length) return;
    const joinedStack = settings.layout === 'stacked' && settings.layerGapMm <= 0.00001;
    const dropBottomCaps = joinedStack && (regionIndex > 0 || settings.includeBase);
    parts.push(geometryToPart(
      geometries,
      'top',
      `multi-color-layer-${regionIndex + 1}-${hex(region.quantRgb)}`,
      region.quantRgb,
      { dropBottomCaps },
    ));
    geometries.forEach((geometry) => geometry.dispose());
  });

  if (settings.keychainEnabled) {
    const ringOuter = Math.max(3, settings.keychainWidthMm / 2);
    const ringInner = Math.max(1.5, ringOuter - Math.min(3, Math.max(1.2, settings.keychainWidthMm * 0.18)));
    const neckLength = Math.max(5, settings.keychainWidthMm * 0.8);
    const neckWidth = Math.max(3, Math.min(settings.keychainWidthMm * 0.58, height * 0.35));
    const offsetX = Number.isFinite(settings.keychainOffsetXMm) ? settings.keychainOffsetXMm : 0;
    const offsetY = Number.isFinite(settings.keychainOffsetYMm) ? settings.keychainOffsetYMm : 0;
    // The neck overlaps the artwork edge and the ring sits beyond the neck.
    // The previous anchor put the ring almost on top of the plate, making the
    // neck disappear from the preview and making X/Y changes look ineffective.
    const edgeOverlap = Math.max(1.2, padding + 0.4);
    const neckCenterX = width / 2 + neckLength / 2 - edgeOverlap + offsetX;
    const ringX = width / 2 + neckLength + ringOuter * 0.35 - edgeOverlap + offsetX;
    const neck = roundedRectangle(neckLength, neckWidth, Math.min(neckWidth / 2, Math.max(1, neckWidth * 0.3)));
    const ring = ringShape(ringOuter, ringInner);
    const keychainDepth = Math.max(0.4, settings.keychainThicknessMm);
    const makeKeychainPart = (z: number, depth: number, colorRgb: RGB, group: Group, segmentIndex: number) => {
      const neckGeometry = extrude(neck, depth, z);
      neckGeometry.translate(neckCenterX, offsetY, 0);
      const ringGeometry = extrude(ring, depth, z);
      ringGeometry.translate(ringX, offsetY, 0);
      parts.push(geometryToPart(
        [neckGeometry, ringGeometry],
        group,
        `multi-color-keychain-${group === 'base' ? 'base' : `layer-${segmentIndex + 1}`}-${hex(colorRgb)}`,
        colorRgb,
        { dropBottomCaps: settings.layout === 'stacked' && segmentIndex > 0 },
      ));
      neckGeometry.dispose();
      ringGeometry.dispose();
    };

    if (settings.layout !== 'stacked') {
      makeKeychainPart(0, keychainDepth, orderedRegions[0]?.quantRgb || [235, 235, 231], 'top', 0);
    } else {
      // A keychain is part of the same Z stack as the artwork. Its colour is
      // resolved from the layer crossed by its thickness, never from a fixed
      // palette selection. Thus a 2 mm keychain over 0.8 mm layers becomes
      // bottom-colour / next-colour / next-colour automatically.
      let remaining = keychainDepth;
      let segmentIndex = 0;
      let keychainZ = 0;

      if (settings.includeBase) {
        const baseDepth = Math.min(remaining, Math.max(0.05, baseThickness));
        makeKeychainPart(keychainZ, baseDepth, [235, 235, 231], 'base', segmentIndex++);
        remaining -= baseDepth;
        keychainZ += baseDepth;
      }

      let layerIndex = 0;
      while (remaining > 0.001) {
        // Keep the keychain contiguous even when a visual layer gap is enabled;
        // the gap is a plate setting, not a hole through the keychain bridge.
        const depth = Math.min(remaining, layerHeight);
        const colorRgb = orderedRegions[Math.min(layerIndex, Math.max(0, orderedRegions.length - 1))]?.quantRgb || [235, 235, 231];
        makeKeychainPart(keychainZ, depth, colorRgb, 'top', segmentIndex++);
        remaining -= depth;
        keychainZ += depth;
        layerIndex++;
        if (segmentIndex > 32) break;
      }
    }
  }
  return parts;
}
