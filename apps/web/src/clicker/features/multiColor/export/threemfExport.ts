import { downloadBlob } from '../../../utils/helpers';
import type { ClickerPart } from '../../../types';
import { buildThreeMF } from '../../../export/threemfExport';

/**
 * Use the shared multipart exporter for every image mode. It preserves the
 * relative placement of inlays and carrier, and assigns one slicer filament
 * slot per final RGB instead of importing each colour as an independent model.
 */
export function buildThreeMFObjects(parts: ClickerPart[]): Uint8Array {
  return buildThreeMF(parts);
}

export function downloadThreeMFObjects(parts: ClickerPart[], fileName = 'multi-color.3mf') {
  const bytes = buildThreeMFObjects(parts);
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'model/3mf' });
  return downloadBlob(blob, fileName);
}
