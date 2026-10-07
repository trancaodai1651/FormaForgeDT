import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { strToU8, zip } from 'fflate';
import type { CarAssembly, CarModel } from './carGeometry';

export function createKitFiles(assembly: CarAssembly, model: CarModel, scale: number) {
  const exporter = new STLExporter();
  const files: Record<string, Uint8Array> = {};
  const records: { file: string; module: string; color: string; sizeMm: number[]; printToAssembly: number[]; tool: boolean }[] = [];
  for (const [i, part] of [...assembly.parts, ...assembly.tools].entries()) {
    const geometry = part.mesh.geometry.clone();
    geometry.scale(scale, scale, scale);
    const rotation = new THREE.Matrix4().makeRotationX(
      part.name.startsWith('Tyre') || part.name === 'Rear spare tyre' ? 0 :
        part.name.includes('screw') || part.name.includes('screwdriver') ? Math.PI : Math.PI / 2);
    geometry.applyMatrix4(rotation);
    geometry.computeBoundingBox();
    const printBounds = geometry.boundingBox!;
    const offset = new THREE.Vector3(-(printBounds.min.x + printBounds.max.x) / 2, -(printBounds.min.y + printBounds.max.y) / 2, -printBounds.min.z);
    geometry.translate(...offset.toArray());
    const positions = geometry.getAttribute('position'); const index = geometry.getIndex()!;
    const triangles: number[] = []; const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let j = 0; j < index.count; j += 3) {
      const ia = index.getX(j), ib = index.getX(j + 1), ic = index.getX(j + 2);
      a.fromBufferAttribute(positions, ia); b.fromBufferAttribute(positions, ib); c.fromBufferAttribute(positions, ic);
      if (!a.equals(b) && !b.equals(c) && !c.equals(a)) triangles.push(ia, ib, ic);
    }
    geometry.setIndex(triangles);
    geometry.computeBoundingBox();
    const material = new THREE.MeshStandardMaterial();
    const printMesh = new THREE.Mesh(geometry, material);
    const file = `${String(i + 1).padStart(2, '0')}-${part.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.stl`;
    const stl = exporter.parse(printMesh, { binary: true });
    files[file] = new Uint8Array(stl.buffer, stl.byteOffset, stl.byteLength);
    part.mesh.updateMatrix();
    const transform = new THREE.Matrix4().makeScale(scale, scale, scale)
      .multiply(part.mesh.matrix).multiply(new THREE.Matrix4().makeScale(1 / scale, 1 / scale, 1 / scale))
      .multiply(rotation.clone().invert()).multiply(new THREE.Matrix4().makeTranslation(-offset.x, -offset.y, -offset.z));
    records.push({ file, module: part.name, color: `#${(part.mesh.material as THREE.MeshStandardMaterial).color.getHexString()}`, sizeMm: geometry.boundingBox!.getSize(new THREE.Vector3()).toArray(), printToAssembly: transform.toArray(), tool: assembly.tools.includes(part) });
    geometry.dispose(); material.dispose();
  }
  files['assembly.json'] = strToU8(JSON.stringify({
    schema: 'formaforge-block-cars-v5', model: model.id, units: 'mm', stlEncoding: 'binary', scale,
    estimatedDimensions: true, originalCadParityVerified: false,
    source: 'https://makerworld.com/en/crowdfunding/140-creative-buildable-block-car',
    overallSizeMm: assembly.bounds.getSize(new THREE.Vector3()).toArray(),
    baseDimensionsMm: { chassisPitch: 36, chassisWidth: assembly.width, chassisHeight: 21, chassisEdgeRadius: 2.1, bodyEdgeRadius: 1.8, cabSilhouetteCornerRadius: 2.2, axleHeight: 8, wheelDiameter: 20, wheelWidth: 6.8, wheelHeadHubGap: 0, wheelHeadSidewallProtrusion: 0.4, studDiameter: 6, socketDiameter: 6 + assembly.clearance * 2, clearance: assembly.clearance },
    fittings: { chassis: { type: 'bottom-open-twin-shoulder-slide-with-central-relief', sharedMaleFemaleProfile: true, assemblyDirection: [0, -1, 0], railHeightMm: 14 * scale, clearanceMm: assembly.clearance * scale }, top: { type: 'rectangular-seating-foot-and-blind-round-socket', insertionDepthMm: 1.35 * scale, studDiameterMm: 6 * scale }, frontTool: { type: 'twin-shoulder-slide', sharesChassisConnector: true }, wheel: { type: 'single-start-right-hand-helical-screw-and-threaded-bore', majorDiameterMm: 5.4 * scale, minorDiameterMm: 4.4 * scale, pitchMm: 2.2 * scale, threadedLengthMm: 6.8 * scale, diametralClearanceMm: assembly.clearance * scale }, boom: { type: 'twin-cheek-and-integral-pivot-pin', pinDiameterMm: 4 * scale, boreDiameterMm: (4 + assembly.clearance * 2) * scale } },
    modules: records,
  }, null, 2));
  files['README.txt'] = strToU8([
    `FormaForgeDT Block Cars - ${model.en}`, `Scale: ${scale.toFixed(2)}x | ${assembly.parts.length} vehicle modules + printed screwdriver`,
    '', 'This is a parametric reconstruction from PDF and public MakerWorld renders. All dimensions and hidden fittings are estimates; this is not original CAD and 100% detail parity has not been verified.',
    `Base dimensions: chassis pitch 36 mm, width ${assembly.width} mm, height 21 mm; tyre diameter 20 mm, width 6.8 mm. All dimensions including fittings scale together.`,
    `Nominal stud diameter 6 mm; socket diameter ${6 + assembly.clearance * 2} mm at 1x. Chassis uses matching twin-shoulder slide profiles with a central relief; cab/cargo has an inset foot with a blind stud hole. Joint clearance: ${assembly.clearance} mm at 1x.`,
    `Wheel screws and bores contain continuous right-hand helical threads: major diameter 5.4 mm, root diameter 4.4 mm, pitch 2.2 mm, threaded length 6.8 mm at 1x. Thread clearance is diametral (${assembly.clearance / 2} mm radially). Wheel/screw offsets preserve thread engagement when changing chassis width.`,
    'Vehicle wheel heads seat on the recessed tyre hub with zero modeled axial gap and project 0.4 mm beyond the outer sidewall at 1x. Heads have rounded rims and a recessed rounded cross socket. Chassis/body edges and cabin silhouettes have rounded geometry, included in the STL.',
    'Each file is a solid module in binary STL, with units in millimetres. Grooves, ribs, tread and cross sockets are included in the mesh. Preview separation does not change these files.',
    'Print the wheel, screw and chassis as a small fit sample first. Printed fit, moving joints and strength have not been tested physically. Supports may be needed for overhangs.',
    'assembly.json includes colors, module dimensions and column-major 4x4 matrices mapping the oriented print STL back into the assembled preview (X length, Y height, Z width).',
    '', 'Files:', ...records.map(r => `${r.file} | ${r.sizeMm.map(n => n.toFixed(2)).join(' x ')} mm`),
  ].join('\n'));
  return files;
}

export const createPrintKit = (assembly: CarAssembly, model: CarModel, scale: number) => {
  const files = createKitFiles(assembly, model, scale);
  return new Promise<Uint8Array>((resolve, reject) => zip(files, { level: 6 }, (error, result) => error ? reject(error) : resolve(result)));
};
