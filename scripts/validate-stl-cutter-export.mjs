import { strFromU8, unzipSync } from '../apps/web/node_modules/fflate/esm/browser.js';
import { readFileSync } from 'node:fs';
import { STLLoader } from '../apps/web/node_modules/three/examples/jsm/loaders/STLLoader.js';
import { buildMultiBedThreeMf, buildStlZip, buildThreeMf, exportStl } from '../apps/web/src/stlCutter/export.ts';

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

const parts = [
  { name: 'Bed A', mesh: cube, color: '#ff0000' },
  { name: 'Bed B', mesh: cube, color: '#00ff00' },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const fixtureBytes = readFileSync(new URL('./fixtures/stl-cutter-tetrahedron.stl', import.meta.url));
const fixtureBuffer = fixtureBytes.buffer.slice(fixtureBytes.byteOffset, fixtureBytes.byteOffset + fixtureBytes.byteLength);
const importedGeometry = new STLLoader().parse(fixtureBuffer);
const importedTriangles = importedGeometry.getAttribute('position').count / 3;
assert(importedTriangles === 4, 'STL import fixture must contain four triangles.');
importedGeometry.dispose();

const stl = exportStl(cube, 'cube');
assert(stl.startsWith('solid cube'), 'STL header is missing.');
assert((stl.match(/facet normal/g) ?? []).length === 12, 'STL triangle count is incorrect.');

const stlZip = unzipSync(buildStlZip(parts));
assert(Object.keys(stlZip).length === 2, 'STL ZIP must contain one file per part.');

const projectZip = unzipSync(buildThreeMf(parts, 'project'));
assert(Boolean(projectZip['3D/3dmodel.model']), 'Project 3MF model entry is missing.');
const projectModel = strFromU8(projectZip['3D/3dmodel.model']);
assert(projectModel.includes('unit="millimeter"'), 'Project 3MF unit must be millimeter.');
assert((projectModel.match(/<object /g) ?? []).length === 2, 'Project 3MF object count is incorrect.');

const bedsZip = unzipSync(buildMultiBedThreeMf(parts, { width: 220, depth: 220, height: 250, margin: 5 }, 'beds'));
assert(Boolean(bedsZip['Metadata/model_settings.config']), 'Multi-bed 3MF plate metadata is missing.');
const bedsModel = strFromU8(bedsZip['3D/3dmodel.model']);
const bedSettings = strFromU8(bedsZip['Metadata/model_settings.config']);
assert((bedSettings.match(/<plate>/g) ?? []).length === 2, 'Multi-bed 3MF must contain one plate per part.');
assert((bedSettings.match(/plater_id/g) ?? []).length === 2, 'Multi-bed 3MF plate IDs are missing.');
const zValues = [...bedsModel.matchAll(/<vertex[^>]+z="([^"]+)"/g)].map((match) => Number(match[1]));
assert(zValues.length > 0 && Math.min(...zValues) === 0, 'Multi-bed parts must be placed on Z=0.');

console.log(JSON.stringify({
  stlTriangles: 12,
  importedTriangles,
  stlFiles: Object.keys(stlZip).length,
  projectObjects: (projectModel.match(/<object /g) ?? []).length,
  multiBedPlates: (bedSettings.match(/<plate>/g) ?? []).length,
  unit: 'millimeter',
  minimumZ: Math.min(...zValues),
}));
