/** Slicer project data: one row-major filament × filament block per nozzle.
 * Match Orca/Flashforge's load/unload defaults (140 + 140 mm³). These are
 * editable compatibility defaults; the slicer can recalculate for the filament.
 */
export function buildFlushSettings(filamentCount: number, nozzleCount: number) {
  if (!Number.isInteger(filamentCount) || filamentCount < 1
    || !Number.isInteger(nozzleCount) || nozzleCount < 1) {
    throw new Error('3MF requires at least one filament and nozzle.');
  }
  return {
    flush_volumes_vector: Array.from({ length: filamentCount * 2 }, () => '140'),
    flush_volumes_matrix: Array.from({ length: nozzleCount * filamentCount * filamentCount }, (_, i) => {
      const cell = i % (filamentCount * filamentCount);
      return Math.floor(cell / filamentCount) === cell % filamentCount ? '0' : '280';
    }),
    flush_multiplier: Array.from({ length: nozzleCount }, () => '1'),
  };
}
