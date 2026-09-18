import type { RegionSet } from '../../types';

type MultiColorRegion = RegionSet['regions'][number];

/**
 * Return the default physical order for the MultiColor page.
 *
 * The array is always bottom -> top. The smallest colour footprint is the
 * full-silhouette backing layer; every following layer is built as the full
 * silhouette minus the union of the layers below it.
 */
export function orderMultiColorRegions(regions: MultiColorRegion[]): MultiColorRegion[] {
  return regions
    .map((region, sourceIndex) => ({ region, sourceIndex }))
    .sort((a, b) => a.region.coverage - b.region.coverage || a.sourceIndex - b.sourceIndex)
    .map(({ region }) => region);
}
