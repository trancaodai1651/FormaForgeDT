import type { ClickerPart, PartGroup } from '../types';
import { groupBBox } from './meshUtils';

export type SlicerTarget = 'bambu' | 'flashforge';
export interface SlicerExportOptions {
  target: SlicerTarget;
  topOrientation: 'auto' | 'face-up' | 'face-down';
  supports: 'auto' | 'on' | 'off';
}
export const defaultSlicerExport = (): SlicerExportOptions => ({ target: 'flashforge', topOrientation: 'auto', supports: 'auto' });

export const slicerProfiles = {
  bambu: { label: 'Bambu Studio', application: 'BambuStudio-02.00.00.00', version: '02.00.00.00',
    model: 'Bambu Lab A1', printer: 'Bambu Lab A1 0.4 nozzle', process: '0.20mm Standard @BBL A1',
    filament: 'Bambu PLA Basic @BBL A1', bed: 256, flavor: 'marlin' },
  flashforge: { label: 'Flashforge Studio', application: 'OrcaSlicer-02.01.01.00', version: '2.1.1.0',
    model: 'Flashforge Creator 5 Pro', printer: 'Flashforge Creator 5 Pro 0.4 nozzle', process: '0.20mm Standard @FF C5',
    filament: 'Flashforge PLA Basic @FF C5', bed: 256, flavor: 'klipper' },
} as const;

/** Keep every material in one logical object. Ground the whole object once,
 * never drop each color band to the bed independently. Bake rotations into
 * vertices so both slicers see the same relief orientation.
 */
export function prepareSlicerLayout(parts: ClickerPart[], options: SlicerExportOptions) {
  const profile = slicerProfiles[options.target];
  const raised = (part: ClickerPart) => {
    if (part.extrudeLayer) return true;
    const origin = part.extrudeOrigin;
    if (!origin) return false;
    for (let i = 2; i < part.vertProperties.length; i += part.numProp) {
      if (part.vertProperties[i] > origin.bottomZ + 0.01) return true;
    }
    return false;
  };
  const topRaised = parts.some(part => part.group === 'top' && raised(part));
  const flipTop = options.topOrientation === 'face-down' || (options.topOrientation === 'auto' && !topRaised);
  const groups = (['base', 'top'] as PartGroup[]).filter(group => parts.some(part => part.group === group));
  const bounds = new Map(groups.map(group => [group, groupBBox(parts, group, 0)]));
  const width = groups.reduce((total, group) => {
    const bb = bounds.get(group)!;
    return total + bb.maxX - bb.minX;
  }, 0) + Math.max(0, groups.length - 1) * 8;
  let left = (profile.bed - width) / 2;
  const placements = new Map<PartGroup, { x: number; y: number }>();
  for (const group of groups) {
    const bb = bounds.get(group)!;
    placements.set(group, { x: left - bb.minX, y: profile.bed / 2 - (bb.minY + bb.maxY) / 2 });
    left += bb.maxX - bb.minX + 8;
  }
  const vertex = (part: ClickerPart, i: number): [number, number, number] => {
    const bb = bounds.get(part.group)!;
    const vertices = part.vertProperties;
    const flip = part.group === 'top' && flipTop;
    // Serialize these double-precision coordinates directly: another Float32
    // round-trip here could collapse tiny triangles after a translation.
    return [vertices[i],
      flip ? -vertices[i + 1] + bb.minY + bb.maxY : vertices[i + 1],
      flip ? bb.maxZ - vertices[i + 2] : vertices[i + 2] - bb.minZ];
  };
  // A relief facing down has gaps under its background; facing up can leave
  // the cap underside overhanging its MX stem. Both need slicer supports.
  const supportNeeded = parts.some(raised) || (groups.includes('top') && !flipTop);
  const supportEnabled = options.supports === 'on' || (options.supports === 'auto' && supportNeeded);
  return { vertex, placements, flipTop, supportEnabled, supportNeeded, profile };
}
