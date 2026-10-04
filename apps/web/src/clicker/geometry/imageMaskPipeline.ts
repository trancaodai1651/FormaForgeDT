import type { BuildRegion, Ring } from '../types';
import type { BuildContext } from './buildContext';
import { getRingArea, sectionIsEmpty } from './geometry/sectionUtils';

export interface ImageMaskInput {
  region: BuildRegion;
  layerIndex: number;
}

export interface ImageMask {
  region: BuildRegion;
  layerIndex: number;
  footprint: any;
  level: number;
}

export interface ImageMaskPipelineOptions {
  inputs: ImageMaskInput[];
  imageScale: number;
  minimumArea: number;
  colorBleed: number;
  imageArea: any;
  plate: any;
  stack: boolean;
  stackFullFootprint?: any;
  solidSilhouette: boolean;
  componentLevel: (region: BuildRegion) => number;
  mapPoint?: (x: number, y: number) => [number, number];
}

export function mapCleanRings(
  rings: Ring[],
  mapPoint: (x: number, y: number) => [number, number],
  minimumArea: number,
): Ring[] {
  const valid: Ring[] = [];
  for (const source of rings) {
    const ring: Ring = [];
    for (const [x, y] of source) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const point = mapPoint(x, y);
      if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
      const previous = ring[ring.length - 1];
      if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 1e-6) ring.push(point);
    }
    if (ring.length > 1 && Math.hypot(ring[0][0] - ring[ring.length - 1][0], ring[0][1] - ring[ring.length - 1][1]) <= 1e-6) {
      ring.pop();
    }
    // Ring winding encodes holes for the NonZero fill rule, so retain both
    // positive outer contours and negative inner contours.
    if (ring.length >= 3 && Math.abs(getRingArea(ring)) > minimumArea) valid.push(ring);
  }
  return valid;
}

/**
 * Turn traced color contours into non-overlapping printable top masks.
 *
 * Bleed, silhouette clipping, and overlap priority are resolved in 2D before
 * extrusion. Each returned section is the single source for both the colored
 * solid and the matching pocket in the cap, preventing perimeter seams.
 */
export function buildImageMaskPipeline(
  ctx: BuildContext,
  options: ImageMaskPipelineOptions,
): ImageMask[] {
  const { inputs, imageScale, minimumArea, colorBleed, imageArea, plate } = options;
  const masks: ImageMask[] = [];
  let placedFootprint: any = null;
  let lowerStackFootprint: any = null;

  // Tracing already simplifies the artwork. Further approximation of a
  // boolean result changes its shared boundary with neighbouring colours.
  const clipToPlate = (section: any): any => ctx.track(section.intersect(plate));

  for (const { region, layerIndex } of inputs) {
    let sourceMask: any;
    if (options.solidSilhouette) {
      sourceMask = clipToPlate(imageArea);
    } else {
      const rings = mapCleanRings(
        region.rings,
        options.mapPoint ?? ((x, y) => [x * imageScale, y * imageScale]),
        minimumArea,
      );
      if (rings.length === 0) continue;

      const contour = ctx.track(new ctx.wasm.CrossSection(rings, 'NonZero'));
      const withBleed = colorBleed > 0.001 ? ctx.grow(contour, colorBleed) : contour;
      sourceMask = clipToPlate(ctx.track(withBleed.intersect(imageArea)));
      // Pixel contours can kiss at a single corner. Extruding that contact
      // gives the carrier four faces on one geometric edge in a slicer.
      // Regularize before resolving overlap; the inlay and its pocket still
      // use one identical contour. Changes stay below 0.0001 mm.
      const inset = ctx.track(sourceMask.offset(-0.0001, 'Round', 2, 16));
      if (!sectionIsEmpty(inset)) sourceMask = ctx.track(inset.offset(0.0001, 'Round', 2, 16));
    }
    if (sectionIsEmpty(sourceMask)) continue;

    let footprint = sourceMask;
    if (options.stack) {
      const fullFootprint = options.stackFullFootprint;
      if (!fullFootprint) continue;
      footprint = lowerStackFootprint
        ? clipToPlate(ctx.track(fullFootprint.subtract(lowerStackFootprint)))
        : fullFootprint;
      lowerStackFootprint = lowerStackFootprint
        ? ctx.track(lowerStackFootprint.add(sourceMask))
        : sourceMask;
      if (layerIndex === 0) continue;
    } else if (placedFootprint) {
      footprint = clipToPlate(ctx.track(footprint.subtract(placedFootprint)));
    }
    if (sectionIsEmpty(footprint)) continue;

    // `footprint` is shared by the inlay and pocket downstream. Preserve this
    // exact resolved contour; do not offset or simplify either side again.
    masks.push({
      region,
      layerIndex,
      footprint,
      level: options.componentLevel(region),
    });
    placedFootprint = placedFootprint
      ? ctx.track(placedFootprint.add(footprint))
      : footprint;
  }

  return masks;
}
