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
    schema: 'formaforge-block-cars-v6', model: model.id, units: 'mm', stlEncoding: 'binary', scale,
    estimatedDimensions: true, originalCadParityVerified: false, physicalPrintedFitVerified: false,
    source: 'https://makerworld.com/en/crowdfunding/140-creative-buildable-block-car',
    referenceBasis: ['supplied assembly PDF', 'public MakerWorld reference renders', 'user-supplied physical print photographs'],
    overallSizeMm: assembly.bounds.getSize(new THREE.Vector3()).toArray(),
    baseDimensionsMm: { chassisPitch: 36, chassisWidth: assembly.width, chassisHeight: 21, chassisEdgeRadius: 2.1, chassisLowerNoseBevel: 3, bodyEdgeRadius: 1.8, cabSilhouetteCornerRadius: 2.2, hoodFrontFacetRun: 5, hoodFrontFacetRise: 4.5, hoodPlanNoseTaper: 3, axleHeight: 8, wheelDiameter: 20, wheelWidth: 6.8, wheelHeadHubGap: 0, wheelHeadSidewallProtrusion: 0.4, studBaseDiameter: 8.4, studNeckDiameter: 6.6, studCapDiameter: 8, socketChamberDiameter: 8 + assembly.clearance * 2, socketThroatDiameter: 6.6 + Math.min(assembly.clearance, 0.35) * 2, clearance: assembly.clearance },
    fittings: {
      chassis: { type: 'bottom-open-twin-shoulder-slide-with-central-relief', sharedMaleFemaleProfile: true, assemblyDirection: [0, -1, 0], railHeightMm: 14 * scale, clearanceMm: assembly.clearance * scale },
      top: {
        type: 'inset-seating-foot-spool-stud-and-blind-three-arc-flexure-socket',
        studBaseDiameterMm: 8.4 * scale, studNeckDiameterMm: 6.6 * scale, studCapDiameterMm: 8 * scale,
        studYRangeMm: [19.45 * scale, 22.9 * scale], studExposedHeightMm: 3.4 * scale,
        socketChamberDiameterMm: (8 + assembly.clearance * 2) * scale, socketThroatDiameterMm: (6.6 + Math.min(assembly.clearance, 0.35) * 2) * scale,
        socketLocalThroatYRangeMm: [-0.4 * scale, 0.35 * scale], blindSocketDepthMm: 2.35 * scale,
        flexureArcOuterDiameterMm: 11.8 * scale, flexureSlitWidthMm: 0.65 * scale, blindFlexureSlotDepthMm: 2.6 * scale, modeledRetentionOnly: true,
      },
      frontTool: { type: 'twin-shoulder-slide', sharesChassisConnector: true },
      wheel: {
        type: 'single-start-right-hand-helical-screw-and-threaded-bore', majorDiameterMm: 5.4 * scale, minorDiameterMm: 4.4 * scale,
        pitchMm: 2.2 * scale, threadedLengthMm: 6.8 * scale, diametralClearanceMm: assembly.clearance * scale,
        drive: { type: 'curved-four-lobe', profile: 'r(theta) = 2.45 + 0.7 * cos(4 * theta) at 1x', maxDiameterMm: 6.3 * scale, minDiameterMm: 3.5 * scale, approximateRecessDepthMm: 1 * scale, screwdriverTipProfileScale: 0.87 },
        tread: { type: 'chevron', repeatCount: 32, phaseCyclesPerMm: 0.12 / scale },
      },
      boom: {
        type: 'twin-cheek-and-integral-pivot-pin-with-female-tip-and-male-bucket-tongue',
        basePivotPinDiameterMm: 4 * scale, basePivotBoreDiameterMm: (4 + assembly.clearance * 2) * scale,
        basePivotWorldHeightMm: 47 * scale, assembledAngleRadians: model.kind === 'crane' || model.kind === 'loader' ? -0.25 : 0,
        dome: { hemisphereRadiusMm: 7.7 * scale, baseCylinderHeightMm: 6 * scale, totalHeightMm: 13.7 * scale, baseWorldHeightMm: 37 * scale },
        bucketTipPinDiameterMm: 3.6 * scale, bucketTipBearingBoreDiameterMm: (3.6 + assembly.clearance * 2) * scale,
        bucketTipForkWidthMm: 8 * scale, bucketTipSlotWidthMm: (4 + assembly.clearance * 2) * scale,
        bucketTongueWidthMm: 4 * scale, bucketIntegralPivotSpanMm: (8 - assembly.clearance * 2) * scale,
      },
    },
    modules: records,
  }, null, 2));
  files['README.txt'] = strToU8([
    `FormaForgeDT Block Cars - ${model.en}`, `Scale: ${scale.toFixed(2)}x | ${assembly.parts.length} vehicle modules + printed screwdriver`,
    '', 'This is a parametric reconstruction from PDF, public MakerWorld renders and user-supplied physical print photographs. All dimensions and hidden fittings are estimates; this is not original CAD and 100% detail parity has not been verified.',
    `Base dimensions: chassis pitch 36 mm, width ${assembly.width} mm, height 21 mm; tyre diameter 20 mm, width 6.8 mm. All dimensions including fittings scale together.`,
    `The photo-based top mount uses an 8.4 mm base, 6.6 mm neck, 8 mm cap and 3.4 mm exposed height at 1x. Its blind socket chamber is ${8 + assembly.clearance * 2} mm across and extends to 2.35 mm above the module seating plane; the retention throat is ${6.6 + Math.min(assembly.clearance, 0.35) * 2} mm across. Three curved flexure slots have 11.8 mm outer diameter, 0.65 mm slit width and 2.6 mm blind depth above the seating plane. Chassis uses matching twin-shoulder slide profiles with a central relief. Joint clearance: ${assembly.clearance} mm at 1x.`,
    `Wheel screws and bores contain continuous right-hand helical threads: major diameter 5.4 mm, root diameter 4.4 mm, pitch 2.2 mm, threaded length 6.8 mm at 1x. Thread clearance is diametral (${assembly.clearance / 2} mm radially). Wheel/screw offsets preserve thread engagement when changing chassis width.`,
    'Vehicle wheel heads seat on the recessed tyre hub with zero modeled axial gap and project 0.4 mm beyond the outer sidewall at 1x. Heads have rounded rims and a curved four-lobe drive recess: maximum 6.3 mm diameter, minimum 3.5 mm, approximately 1 mm depth at 1x. The printed screwdriver tip uses 0.87 times this profile. Tyres have 32 repeated chevrons. Chassis/body edges and cabin silhouettes have rounded geometry, included in the STL.',
    'The hood front has a broad sloping facet: 5 mm run and 4.5 mm rise at 1x. Its nose corners taper 3 mm in plan; the chassis lower nose bevel is 3 mm. The boom tip receives the bucket tongue between its cheeks, following the supplied close-up photos.',
    `At 1x the boom base pivot pin is 4 mm with a ${4 + assembly.clearance * 2} mm bore. The bucket tip pin is 3.6 mm with a ${3.6 + assembly.clearance * 2} mm bearing bore; its fork is 8 mm wide, slot ${4 + assembly.clearance * 2} mm wide, and bucket tongue 4 mm wide. The integral bucket pivot spans ${8 - assembly.clearance * 2} mm. These joint dimensions are estimates.`,
    'The photo-based machinery dome has a 6 mm base cylinder and 7.7 mm radius hemisphere, 13.7 mm total height, seated at Y=37 mm at 1x. The main boom pivot is at Y=47 mm. Crane/loader booms rotate -0.25 radians around their base pivot to raise the distal tip, with the excavator bucket following the tip while remaining vertical; the hook boom stays at 0 radians. These pose and dome dimensions are estimates.',
    'Each file is a solid module in binary STL, with units in millimetres. Grooves, ribs, chevron tread and four-lobe sockets are included in the mesh. Preview separation does not change these files.',
    'Print the wheel, screw, chassis and top socket as a small fit sample first. Modeled retention overlap does not establish insertion force, flexure life, print shrinkage, moving joints, strength or physical printed fit. Supports may be needed for overhangs.',
    'assembly.json includes colors, module dimensions and column-major 4x4 matrices mapping the oriented print STL back into the assembled preview (X length, Y height, Z width).',
    '', 'Files:', ...records.map(r => `${r.file} | ${r.sizeMm.map(n => n.toFixed(2)).join(' x ')} mm`),
  ].join('\n'));
  return files;
}

export const createPrintKit = (assembly: CarAssembly, model: CarModel, scale: number) => {
  const files = createKitFiles(assembly, model, scale);
  return new Promise<Uint8Array>((resolve, reject) => zip(files, { level: 6 }, (error, result) => error ? reject(error) : resolve(result)));
};
