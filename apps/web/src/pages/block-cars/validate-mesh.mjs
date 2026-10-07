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
const scratch = [];
try {
  for (const name of ['carGeometry', 'catalog', 'printKit']) {
    let source = fs.readFileSync(path.join(folder, `${name}.ts`), 'utf8');
    source = source.replace("import wasmUrl from 'manifold-3d/manifold.wasm?url';", `const wasmUrl = ${JSON.stringify(fileURLToPath(import.meta.resolve('manifold-3d/manifold.wasm')))};`);
    const target = path.join(folder, `.validation-${name}.mjs`);
    fs.writeFileSync(target, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText);
    scratch.push(target);
  }
  const { initCarGeometry, buildCar } = await import(pathToFileURL(scratch[0]));
  const { models } = await import(pathToFileURL(scratch[1]));
  const filter = process.argv.find(a => a.startsWith('--models='))?.slice(9).split(',');
  const validationModels = filter ? models.filter(model => filter.includes(model.id)) : models;
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
  for (const model of validationModels) {
    const assembly = buildCar(model, 1);
    const frames = assembly.parts.filter(p => p.name.includes('chassis') || p.name.startsWith('Chassis'));
    for (let i = 1; i < frames.length; i++) checkFit(frames[i - 1], frames[i], `${model.id} chassis T rail`);
    const cab = assembly.parts.find(p => p.name.startsWith('Cabin'));
    checkFit(cab, frames[0], `${model.id} cab seating foot`);
    for (const cargo of assembly.parts.filter(p => p.name.startsWith('Cargo tray'))) checkFit(cargo, frames.find(p => p.mesh.position.x === cargo.mesh.position.x), `${model.id} cargo seating foot`);
    const front = assembly.parts.find(p => p.name.startsWith('Front loader scoop') || p.name === 'Road roller fork');
    if (front) checkFit(front, frames[0], `${model.id} front tool T rail`);
    const dome = assembly.parts.find(p => p.name.startsWith('Dome'));
    const boom = assembly.parts.find(p => p.name === 'Detailed hinged boom');
    if (dome && boom) checkFit(dome, boom, `${model.id} boom pivot`);
    const bucket = assembly.parts.find(p => p.name.startsWith('Upper excavator'));
    if (bucket && boom) checkFit(bucket, boom, `${model.id} bucket pivot`);
    for (const tyre of assembly.parts.filter(p => p.name.startsWith('Tyre'))) {
      const frame = frames.find(p => p.mesh.position.x === tyre.mesh.position.x);
      checkFit(tyre, frame, `${model.id} wheel arch`);
      const screw = assembly.parts.find(p => p.name === `Cross socket wheel screw ${tyre.name.split(' ')[1]}`);
      checkFit(screw, frame, `${model.id} wheel axle`);
      checkFit(screw, tyre, `${model.id} wheel hub`);
    }
    const equipment = assembly.parts.find(p => p.mesh.position.x === 18 && p.mesh.position.y === 21 && !p.name.startsWith('Chassis'));
    if (equipment) checkFit(equipment, frames[1], `${model.id} equipment foot`);
    if (dome && equipment) checkFit(dome, equipment, `${model.id} turntable`);
    const lid = assembly.parts.find(p => p.name.startsWith('Hinged recycling'));
    if (lid && equipment) checkFit(lid, equipment, `${model.id} rear door hinge`);
    const drum = assembly.parts.find(p => p.name.startsWith('Tapered mixer'));
    if (drum && equipment) checkFit(drum, equipment, `${model.id} drum axle`);
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
      const stl = new TextDecoder().decode(files[record.file]);
      const vertices = [...stl.matchAll(/vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g)].map(v => [+v[1], +v[2], +v[3]]);
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
    checkFit(frames[0], frames[1], 'custom T rail');
    checkFit(custom.parts.find(p => p.name.startsWith('Cabin')), frames[0], 'custom cab');
    const front = custom.parts.find(p => p.name.startsWith('Front loader scoop') || p.name === 'Road roller fork');
    if (front) checkFit(front, frames[0], 'custom front tool');
    const dome = custom.parts.find(p => p.name.startsWith('Dome'));
    const boom = custom.parts.find(p => p.name === 'Detailed hinged boom');
    if (dome && boom) checkFit(dome, boom, 'custom width boom pivot');
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
}
