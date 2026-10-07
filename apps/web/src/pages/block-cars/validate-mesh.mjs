// Run from the repository root: node apps/web/src/pages/block-cars/validate-mesh.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import Module from 'manifold-3d';
import * as THREE from 'three';
import { zipSync } from 'fflate';

const folder = path.dirname(fileURLToPath(import.meta.url));
// Keep generated modules outside Vite's source watcher so validation does not
// reload the page while its dimensions or camera are being inspected.
const cacheFolder = path.resolve(folder, '../../../node_modules/.cache');
fs.mkdirSync(cacheFolder, { recursive: true });
const scratchFolder = fs.mkdtempSync(path.join(cacheFolder, 'block-cars-validation-'));
const scratch = [];
try {
  for (const name of ['carGeometry', 'catalog', 'printKit']) {
    let source = fs.readFileSync(path.join(folder, `${name}.ts`), 'utf8');
    source = source.replace("import wasmUrl from 'manifold-3d/manifold.wasm?url';", `const wasmUrl = ${JSON.stringify(fileURLToPath(import.meta.resolve('manifold-3d/manifold.wasm')))};`);
    const target = path.join(scratchFolder, `${name}.mjs`);
    fs.writeFileSync(target, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText);
    scratch.push(target);
  }
  const { initCarGeometry, buildCar } = await import(pathToFileURL(scratch[0]));
  const { models } = await import(pathToFileURL(scratch[1]));
  const filter = process.argv.find(a => a.startsWith('--models='))?.slice(9).split(',');
  const validationModels = process.argv.includes('--custom-only') ? [] : filter ? models.filter(model => filter.includes(model.id)) : models;
  const { createKitFiles } = await import(pathToFileURL(scratch[2]));
  const m = await Module(); m.setup(); await initCarGeometry();
  const allFiles = {}; let count = 0;
  const worldSolid = part => {
    part.mesh.updateMatrix();
    const g = part.mesh.geometry.clone().applyMatrix4(part.mesh.matrix);
    const mesh = new m.Mesh({ numProp: 3, vertProperties: new Float32Array(g.attributes.position.array), triVerts: new Uint32Array(g.index.array) }); mesh.merge(); g.dispose();
    return new m.Manifold(mesh);
  };
  const checkFit = (a, b, label) => {
    const sa = worldSolid(a), sb = worldSolid(b), overlap = sa.intersect(sb);
    const volume = overlap.volume(); const om = overlap.getMesh(); const bnd = new THREE.Box3(); for (let k = 0; k < om.vertProperties.length; k += om.numProp) bnd.expandByPoint(new THREE.Vector3(...om.vertProperties.slice(k, k + 3))); sa.delete(); sb.delete(); overlap.delete();
    if (volume > 0.05) throw Error(`Joint collision ${label}: ${volume.toFixed(3)} mm3 ${JSON.stringify({ min: bnd.min.toArray(), max: bnd.max.toArray() })}`);
  };
  const offsetPart = (part, vector, angle = 0) => {
    const mesh = part.mesh.clone();
    mesh.position.add(new THREE.Vector3(...vector)); mesh.rotateZ(angle);
    return { name: part.name, mesh };
  };
  const checkTopRetention = (body, frame, label) => {
    // The seated fit is checked separately. Lifting the rigid body must bring
    // its throat into the spool cap, proving a modeled retaining undercut.
    // This collision cannot predict insertion force or printed flexure fit.
    const upper = worldSolid(offsetPart(body, [0, 0.75, 0])), lower = worldSolid(frame), retained = upper.intersect(lower);
    const volume = retained.volume(); upper.delete(); lower.delete(); retained.delete();
    if (volume <= 0.05) throw Error(`No modeled top-stud retention: ${label}, ${volume.toFixed(3)} mm3 after 0.75 mm lift`);
  };
  const checkSlide = (maleFrame, femaleFrame, label) => {
    for (const height of [0, 0.5, 3, 8, 14, 18]) checkFit(maleFrame, offsetPart(femaleFrame, [0, height, 0]), `${label} slide travel ${height}`);
    // Shoulders must resist horizontal pullout while seated.
    const a = worldSolid(maleFrame), b = worldSolid(offsetPart(femaleFrame, [1, 0, 0])), locked = a.intersect(b);
    if (locked.volume() < 0.5) throw Error(`Unretained slide: ${label}`);
    a.delete(); b.delete(); locked.delete();
  };
  const checkThread = (screw, housing, label) => {
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(screw.mesh.quaternion);
    for (const turns of [0, 0.125, 0.25, 0.5, 1]) {
      const advance = axis.clone().multiplyScalar(turns * 2.2);
      checkFit(offsetPart(screw, advance.toArray(), turns * Math.PI * 2), housing, `${label} unscrew ${turns} turns`);
    }
    // Axial movement without rotation must hit a thread flank: an oversized
    // cylindrical pilot or disconnected circular rings cannot satisfy both tests.
    const a = worldSolid(offsetPart(screw, axis.multiplyScalar(0.65).toArray())), b = worldSolid(housing), flank = a.intersect(b);
    if (flank.volume() < 0.03) throw Error(`No thread engagement: ${label}`);
    a.delete(); b.delete(); flank.delete();
  };
  const checkWheelSeat = (screw, tyre, label) => {
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(screw.mesh.quaternion);
    const gap = screw.mesh.position.dot(axis) - 1.4 - (tyre.mesh.position.dot(axis) + 2.4);
    const protrusion = screw.mesh.position.dot(axis) - (tyre.mesh.position.dot(axis) + 3.4);
    if (Math.abs(gap) > 0.001 || protrusion < 0 || protrusion > 0.41) throw Error(`Wheel head is not seated: ${label}, gap ${gap}, protrusion ${protrusion}`);
  };
  for (const model of validationModels) {
    const assembly = buildCar(model, 1);
    const frames = assembly.parts.filter(p => p.name.includes('chassis') || p.name.startsWith('Chassis'));
    for (let i = 1; i < frames.length; i++) {
      if (model === validationModels[0]) checkSlide(frames[i - 1], frames[i], `${model.id} chassis T rail`);
      else checkFit(frames[i - 1], frames[i], `${model.id} chassis T rail`);
    }
    const cab = assembly.parts.find(p => p.name.startsWith('Cabin'));
    checkFit(cab, frames[0], `${model.id} cab seating foot`);
    checkTopRetention(cab, frames[0], `${model.id} cab spool mount`);
    for (const cargo of assembly.parts.filter(p => p.name.startsWith('Cargo tray'))) {
      const frame = frames.find(p => p.mesh.position.x === cargo.mesh.position.x);
      checkFit(cargo, frame, `${model.id} cargo seating foot`);
      checkTopRetention(cargo, frame, `${model.id} cargo spool mount`);
    }
    const front = assembly.parts.find(p => p.name.startsWith('Front loader scoop') || p.name === 'Road roller fork');
    if (front) checkFit(front, frames[0], `${model.id} front tool T rail`);
    const dome = assembly.parts.find(p => p.name.startsWith('Dome'));
    const boom = assembly.parts.find(p => p.name === 'Detailed hinged boom');
    if (boom) checkFit(cab, boom, `${model.id} cabin/boom separation`);
    if (dome && boom) checkFit(dome, boom, `${model.id} boom pivot`);
    const bucket = assembly.parts.find(p => p.name.startsWith('Upper excavator'));
    if (bucket) checkFit(cab, bucket, `${model.id} cabin/bucket separation`);
    if (bucket && boom) checkFit(bucket, boom, `${model.id} bucket pivot`);
    for (const tyre of assembly.parts.filter(p => p.name.startsWith('Tyre'))) {
      const frame = frames.find(p => p.mesh.position.x === tyre.mesh.position.x);
      checkFit(tyre, frame, `${model.id} wheel arch`);
      const screw = assembly.parts.find(p => p.name === `Cross socket wheel screw ${tyre.name.split(' ')[1]}`);
      checkFit(screw, frame, `${model.id} wheel axle`);
      checkFit(screw, tyre, `${model.id} wheel hub`);
      checkWheelSeat(screw, tyre, `${model.id} ${tyre.name}`);
      if (model === validationModels[0] && frame === frames[0]) checkThread(screw, frame, `${model.id} wheel thread ${tyre.name}`);
    }
    const equipment = assembly.parts.find(p => p.mesh.position.x === 18 && p.mesh.position.y === 21 && !p.name.startsWith('Chassis'));
    if (equipment) checkFit(equipment, frames[1], `${model.id} equipment foot`);
    if (equipment && !equipment.name.startsWith('Cargo tray')) checkTopRetention(equipment, frames[1], `${model.id} equipment spool mount`);
    if (equipment) checkFit(cab, equipment, `${model.id} cabin/rear module seam`);
    const trays = assembly.parts.filter(p => p.name.startsWith('Cargo tray'));
    for (let i = 1; i < trays.length; i++) checkFit(trays[i - 1], trays[i], `${model.id} adjacent upper trays`);
    const roller = assembly.parts.find(p => p.name === 'Road roller drum');
    if (roller) for (const screw of assembly.parts.filter(p => p.name.startsWith('Roller screw'))) checkThread(screw, roller, `${model.id} roller thread`);
    const spare = assembly.parts.find(p => p.name === 'Spare wheel screw');
    if (spare) {
      const tyre = assembly.parts.find(p => p.name === 'Rear spare tyre');
      checkThread(spare, equipment, `${model.id} spare thread`); checkFit(spare, tyre, `${model.id} spare hub`); checkFit(tyre, equipment, `${model.id} spare mounting boss`); checkWheelSeat(spare, tyre, `${model.id} spare head`);
    }
    if (dome && equipment) checkFit(dome, equipment, `${model.id} turntable`);
    const lid = assembly.parts.find(p => p.name.startsWith('Hinged recycling'));
    if (lid && equipment) checkFit(lid, equipment, `${model.id} rear door hinge`);
    const drum = assembly.parts.find(p => p.name.startsWith('Tapered mixer'));
    if (drum && equipment) checkFit(drum, equipment, `${model.id} drum axle`);
    if (drum) {
      const screw = assembly.parts.find(p => p.name === 'Mixer retaining screw');
      checkThread(screw, drum, `${model.id} mixer retaining thread`);
      checkFit(screw, equipment, `${model.id} mixer support bearing`);
    }
    const ladder = assembly.parts.find(p => p.name === 'Extending fire ladder');
    const cradle = assembly.parts.find(p => p.name === 'Ladder rotation cradle');
    if (ladder && cradle) checkFit(ladder, cradle, `${model.id} ladder pivot`);
    if (assembly.parts.length !== model.partCount) throw Error(`${model.id}: parts count mismatch`);
    for (const part of [...assembly.parts, ...assembly.tools]) {
      const g = part.mesh.geometry;
      if (!g.attributes.position.array.every(Number.isFinite)) throw Error(`Nonfinite mesh: ${part.name}`);
      const mesh = new m.Mesh({ numProp: 3, vertProperties: new Float32Array(g.attributes.position.array), triVerts: new Uint32Array(g.index.array) }); mesh.merge();
      const solid = new m.Manifold(mesh); const pieces = solid.decompose();
      if (pieces.length !== 1 || solid.volume() <= 0) throw Error(`${model.id}: disconnected or empty ${part.name} ${JSON.stringify(pieces.map(p => { const mesh = p.getMesh(); const b = new THREE.Box3(); for (let k = 0; k < mesh.vertProperties.length; k += mesh.numProp) b.expandByPoint(new THREE.Vector3(...mesh.vertProperties.slice(k, k + 3))); return { volume: p.volume(), min: b.min.toArray(), max: b.max.toArray() }; }))}`);
      pieces.forEach(p => p.delete()); solid.delete(); count++;
    }
    const scaled = buildCar(model, 1.4);
    const baseLength = assembly.bounds.getSize(new THREE.Vector3()).x;
    if (Math.abs(scaled.bounds.getSize(new THREE.Vector3()).x / baseLength - 1.4) > 1e-6) throw Error(`Scale mismatch: ${model.id}`);
    const files = createKitFiles(assembly, model, 1);
    const manifest = JSON.parse(new TextDecoder().decode(files['assembly.json']));
    for (const record of manifest.modules) {
      const bytes = files[record.file], stl = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const triangles = stl.getUint32(80, true);
      if (bytes.length !== 84 + triangles * 50) throw Error(`Invalid binary STL length: ${record.file}`);
      const vertices = [];
      for (let face = 0; face < triangles; face++) for (let vertex = 0; vertex < 3; vertex++) {
        const offset = 84 + face * 50 + 12 + vertex * 12;
        vertices.push([stl.getFloat32(offset, true), stl.getFloat32(offset + 4, true), stl.getFloat32(offset + 8, true)]);
      }
      if (!vertices.length || vertices.some(v => !v.every(Number.isFinite) || v[2] < -1e-5)) throw Error(`Invalid exported STL: ${record.file}`);
      const edges = new Map();
      for (let i = 0; i < vertices.length; i += 3) for (let j = 0; j < 3; j++) {
        const a = vertices[i + j].join(','); const b = vertices[i + (j + 1) % 3].join(','); const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        edges.set(key, (edges.get(key) || 0) + 1);
      }
      const badEdges = [...edges.entries()].filter(([, n]) => n !== 2);
      if (badEdges.length) {
        const points = badEdges[0][0].split('|'); const faces = [];
        for (let i = 0; i < vertices.length; i += 3) { const face = vertices.slice(i, i + 3); if (points.every(p => face.some(v => v.join(',') === p))) faces.push(face); }
        throw Error(`Open or degenerate exported STL: ${record.file} / ${JSON.stringify(badEdges.slice(0, 1))} / faces ${JSON.stringify(faces)}`);
      }
      if (!record.tool) {
        const matrix = new THREE.Matrix4().fromArray(record.printToAssembly);
        const restored = new THREE.Box3(); for (const v of vertices) restored.expandByPoint(new THREE.Vector3(...v).applyMatrix4(matrix));
        const part = assembly.parts.find(p => p.name === record.module);
        const expected = new THREE.Box3().setFromObject(part.mesh, true);
        if (restored.min.distanceTo(expected.min) > 0.001 || restored.max.distanceTo(expected.max) > 0.001) throw Error(`Assembly matrix mismatch: ${record.module}`);
      }
    }
    for (const [file, data] of Object.entries(files)) allFiles[`${model.id}/${file}`] = data;
    console.log(`${model.id}: ${assembly.parts.length} vehicle modules, closed exported STL, scale and assembly transforms passed`);
  }
  if (!filter) for (const options of [
    { model: models[0], width: 34, cabType: 'car', frontTool: 'bucket', clearance: 0.1 },
    { model: models[0], width: 60, cabType: 'hood', frontTool: 'roller', clearance: 0.6 },
    { model: models[8], width: 34, cabType: 'hood', frontTool: 'none', clearance: 0.1 },
    { model: models[8], width: 60, cabType: 'hood', frontTool: 'bucket', clearance: 0.6 },
  ]) {
    const custom = buildCar(options.model, 1, options.clearance, options);
    const frames = custom.parts.filter(p => p.name.includes('chassis') || p.name.startsWith('Chassis'));
    checkSlide(frames[0], frames[1], 'custom T rail');
    const cab = custom.parts.find(p => p.name.startsWith('Cabin'));
    checkFit(cab, frames[0], 'custom cab');
    checkTopRetention(cab, frames[0], `custom ${options.width}/${options.clearance} cab spool mount`);
    for (const body of custom.parts.filter(p => p.mesh.position.y === 21 && p !== cab)) {
      const frame = frames.find(p => p.mesh.position.x === body.mesh.position.x);
      if (frame) {
        checkFit(body, frame, `custom ${body.name} seating foot`);
        checkTopRetention(body, frame, `custom ${options.width}/${options.clearance} ${body.name} spool mount`);
      }
    }
    const front = custom.parts.find(p => p.name.startsWith('Front loader scoop') || p.name === 'Road roller fork');
    if (front) checkFit(front, frames[0], 'custom front tool');
    for (const screw of custom.parts.filter(p => p.name.includes('wheel screw') && p.mesh.position.x === frames[0].mesh.position.x)) checkThread(screw, frames[0], `custom ${options.width}/${options.clearance} ${screw.name}`);
    for (const tyre of custom.parts.filter(p => p.name.startsWith('Tyre'))) checkWheelSeat(custom.parts.find(p => p.name === `Cross socket wheel screw ${tyre.name.split(' ')[1]}`), tyre, `custom ${options.width} ${tyre.name}`);
    const dome = custom.parts.find(p => p.name.startsWith('Dome'));
    const boom = custom.parts.find(p => p.name === 'Detailed hinged boom');
    if (boom) checkFit(cab, boom, 'custom cabin/boom separation');
    if (dome && boom) checkFit(dome, boom, 'custom width boom pivot');
    const bucket = custom.parts.find(p => p.name.startsWith('Upper excavator'));
    if (bucket) {
      checkFit(cab, bucket, 'custom cabin/bucket separation');
      if (boom) checkFit(bucket, boom, 'custom bucket/boom pivot');
    }
    for (const part of custom.parts) {
      const solid = worldSolid(part), pieces = solid.decompose();
      if (pieces.length !== 1 || solid.volume() <= 0) throw Error(`Custom disconnected ${part.name}`);
      pieces.forEach(p => p.delete()); solid.delete();
    }
    const files = createKitFiles(custom, options.model, 1);
    const manifest = JSON.parse(new TextDecoder().decode(files['assembly.json']));
    if (manifest.baseDimensionsMm.chassisWidth !== options.width || manifest.baseDimensionsMm.clearance !== options.clearance) throw Error('Custom fitting metadata mismatch');
    console.log(`Custom modules: width ${options.width}, ${options.cabType} cab, ${options.frontTool}, clearance ${options.clearance}: fittings and export metadata passed`);
  }
  const out = process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(os.tmpdir(), 'formaforge-block-cars-all-kits.zip');
  fs.writeFileSync(out, zipSync(allFiles, { level: 6 }));
  console.log(`PASS: ${validationModels.length} vehicles / ${count} solid modules including tools. Kit: ${out}`);
} finally {
  for (const file of scratch) fs.rmSync(file, { force: true });
  fs.rmdirSync(scratchFolder);
}
