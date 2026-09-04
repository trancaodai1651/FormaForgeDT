import { strFromU8, strToU8, unzipSync, zipSync } from '../apps/web/node_modules/fflate/esm/browser.js';
import { writeFileSync } from 'node:fs';
import { buildThreeMf } from '../apps/web/src/stlCutter/export.ts';
import { parseThreeMfCore, readThreeMfPackageEntries } from '../apps/web/src/split3mf/threeMfCore.ts';
import { smoothMeshBoundary, surfaceArea } from '../apps/web/src/split3mf/meshUtils.ts';
import { closeOpenMesh, mergeColoredMeshParts, meshBoundaryCount } from '../apps/web/src/split3mf/regionSplit.ts';

const cube = {
  vertices: [
    0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0,
    0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10,
  ],
  indices: [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
  ],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const projectBytes = buildThreeMf([
  { name: 'Red region', mesh: cube, color: '#ff4422' },
  { name: 'Teal region', mesh: cube, color: '#00877c' },
], 'Split 3MF validation');
if (process.env.SPLIT_3MF_FIXTURE_OUT) writeFileSync(process.env.SPLIT_3MF_FIXTURE_OUT, projectBytes);
const archive = unzipSync(projectBytes);
const model = strFromU8(archive['3D/3dmodel.model']);
assert((model.match(/<object /g) ?? []).length === 2, 'Export must keep two independent color objects.');
assert(model.includes('#FF4422FF') && model.includes('#00877CFF'), 'Export must preserve region colors.');
assert(model.includes('unit="millimeter"'), 'Export unit must be millimeter.');
const importedRegions = parseThreeMfCore(projectBytes.buffer.slice(projectBytes.byteOffset, projectBytes.byteOffset + projectBytes.byteLength));
assert(importedRegions.length === 2, 'Import must restore two color regions from the exported project.');
assert(importedRegions[0].indices.length === cube.indices.length && importedRegions[1].indices.length === cube.indices.length, 'Imported regions must retain their triangle counts.');
assert(importedRegions.some((region) => region.color === '#ff4422') && importedRegions.some((region) => region.color === '#00877c'), 'Import must restore material colors.');
const smoothed = smoothMeshBoundary(cube, 2, .2);
assert(smoothed.indices.length === cube.indices.length && smoothed.vertices.every(Number.isFinite), 'Boundary smoothing must preserve finite triangle topology.');
assert(surfaceArea(smoothed) > 0, 'Smoothed mesh must retain positive surface area.');

const paintedTop = { vertices: cube.vertices.slice(), indices: cube.indices.slice(6, 12) };
const paintedBody = { vertices: cube.vertices.slice(), indices: [...cube.indices.slice(0, 6), ...cube.indices.slice(12)] };
for (const algorithm of ['soap-film', 'cdt', 'winding', 'projected', 'centroid']) {
  const topClosed = closeOpenMesh(paintedTop, algorithm);
  const bodyClosed = closeOpenMesh(paintedBody, algorithm);
  assert(topClosed.boundaryLoops === 1 && bodyClosed.boundaryLoops === 1, `${algorithm} must find the painted boundary.`);
  assert(meshBoundaryCount(topClosed.mesh) === 0, `${algorithm} must close the selected color region.`);
  assert(meshBoundaryCount(bodyClosed.mesh) === 0, `${algorithm} must close the remaining body.`);
}

const paintedObject = mergeColoredMeshParts([
  { name: 'Red painted top', color: '#ff4422', mesh: paintedTop },
  { name: 'Teal painted body', color: '#00877c', mesh: paintedBody },
]);
const paintedBytes = buildThreeMf([{ name: 'Painted cube', color: '#ff4422', mesh: paintedObject.mesh, materials: paintedObject.materials }], 'Painted Split 3MF validation');
if (process.env.SPLIT_3MF_PAINTED_FIXTURE_OUT) writeFileSync(process.env.SPLIT_3MF_PAINTED_FIXTURE_OUT, paintedBytes);
const paintedArchive = unzipSync(paintedBytes);
const paintedXml = strFromU8(paintedArchive['3D/3dmodel.model']);
assert((paintedXml.match(/<object /g) ?? []).length === 1, 'Multi-material export must keep one printable model object.');
assert(paintedXml.includes('p1="0"') && paintedXml.includes('p1="1"'), 'Multi-material export must assign both triangle materials.');
const paintedImport = parseThreeMfCore(paintedBytes.buffer.slice(paintedBytes.byteOffset, paintedBytes.byteOffset + paintedBytes.byteLength));
assert(paintedImport.length === 2, 'Multi-material object must round-trip as two painted regions.');

const slicerMetadata = strToU8('<?xml version="1.0"?><config><plate name="Preserved plate"/></config>');
const sourceWithMetadata = zipSync({ ...paintedArchive, 'Metadata/model_settings.config': slicerMetadata }, { level: 6 });
const preservedPackage = readThreeMfPackageEntries(sourceWithMetadata.buffer.slice(sourceWithMetadata.byteOffset, sourceWithMetadata.byteOffset + sourceWithMetadata.byteLength));
const rebuiltWithMetadata = buildThreeMf([{ name: 'Painted cube', color: '#ff4422', mesh: paintedObject.mesh, materials: paintedObject.materials }], 'Metadata preservation', preservedPackage);
const rebuiltArchive = unzipSync(rebuiltWithMetadata);
assert(strFromU8(rebuiltArchive['Metadata/model_settings.config']) === strFromU8(slicerMetadata), 'Export must preserve slicer metadata entries from the source package.');

console.log(JSON.stringify({
  exportObjects: (model.match(/<object /g) ?? []).length,
  exportTriangles: (model.match(/<triangle /g) ?? []).length,
  importedRegions: importedRegions.length,
  smoothingTriangles: smoothed.indices.length / 3,
  capAlgorithms: 5,
  paintedObjectRegions: paintedImport.length,
  slicerMetadataPreserved: true,
  colorsPreserved: true,
  unit: 'millimeter',
}));
