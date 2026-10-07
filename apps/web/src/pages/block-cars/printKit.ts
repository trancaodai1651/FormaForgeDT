import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { strToU8, zipSync } from 'fflate';
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
    files[file] = strToU8(exporter.parse(printMesh, { binary: false }) as string);
    part.mesh.updateMatrix();
    const transform = new THREE.Matrix4().makeScale(scale, scale, scale)
      .multiply(part.mesh.matrix).multiply(new THREE.Matrix4().makeScale(1 / scale, 1 / scale, 1 / scale))
      .multiply(rotation.clone().invert()).multiply(new THREE.Matrix4().makeTranslation(-offset.x, -offset.y, -offset.z));
    records.push({ file, module: part.name, color: `#${(part.mesh.material as THREE.MeshStandardMaterial).color.getHexString()}`, sizeMm: geometry.boundingBox!.getSize(new THREE.Vector3()).toArray(), printToAssembly: transform.toArray(), tool: assembly.tools.includes(part) });
    geometry.dispose(); material.dispose();
  }
  files['assembly.json'] = strToU8(JSON.stringify({
    schema: 'formaforge-block-cars-v2', model: model.id, units: 'mm', scale,
    estimatedDimensions: true, originalCadParityVerified: false,
    source: 'https://makerworld.com/en/crowdfunding/140-creative-buildable-block-car',
    overallSizeMm: assembly.bounds.getSize(new THREE.Vector3()).toArray(),
    baseDimensionsMm: { chassisPitch: 36, chassisWidth: 34, chassisHeight: 21, wheelDiameter: 20, wheelWidth: 6.8, studDiameter: 5.6, socketDiameter: 6.1 },
    modules: records,
  }, null, 2));
  files['README.txt'] = strToU8([
    `FormaForgeDT Block Cars - ${model.en}`, `Scale: ${scale.toFixed(2)}x | ${assembly.parts.length} vehicle modules + printed screwdriver`,
    '', 'This is a parametric reconstruction from PDF and public MakerWorld renders. All dimensions and hidden fittings are estimates; this is not original CAD and 100% detail parity has not been verified.',
    'Base dimensions: chassis pitch 36 mm, width 34 mm, height 21 mm; tyre diameter 20 mm, width 6.8 mm. All dimensions including fittings scale together.',
    'Nominal stud diameter 5.6 mm and socket diameter 6.1 mm at 1x. Chassis tongue and pocket are estimated slide joints; wheel screws have press-fit retention ridges.',
    'Each file is a solid module. STL units are millimetres. Grooves, ribs, tread and cross sockets are included in the mesh. Preview separation does not change these files.',
    'Print the wheel, screw and chassis as a small fit sample first. Printed fit, moving joints and strength have not been tested physically. Supports may be needed for overhangs.',
    'assembly.json includes colors, module dimensions and column-major 4x4 matrices mapping the oriented print STL back into the assembled preview (X length, Y height, Z width).',
    '', 'Files:', ...records.map(r => `${r.file} | ${r.sizeMm.map(n => n.toFixed(2)).join(' x ')} mm`),
  ].join('\n'));
  return files;
}

export const createPrintKit = (assembly: CarAssembly, model: CarModel, scale: number) => zipSync(createKitFiles(assembly, model, scale), { level: 6 });
