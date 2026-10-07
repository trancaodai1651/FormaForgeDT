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
  const { createKitFiles } = await import(pathToFileURL(scratch[2]));
  const m = await Module(); m.setup(); await initCarGeometry();
  const allFiles = {}; let count = 0;
  for (const model of models) {
    const assembly = buildCar(model, 1);
    if (assembly.parts.length !== model.partCount) throw Error(`${model.id}: parts count mismatch`);
    for (const part of [...assembly.parts, ...assembly.tools]) {
      const g = part.mesh.geometry;
      if (!g.attributes.position.array.every(Number.isFinite)) throw Error(`Nonfinite mesh: ${part.name}`);
      const mesh = new m.Mesh({ numProp: 3, vertProperties: new Float32Array(g.attributes.position.array), triVerts: new Uint32Array(g.index.array) }); mesh.merge();
      const solid = new m.Manifold(mesh); const pieces = solid.decompose();
      if (pieces.length !== 1 || solid.volume() <= 0) throw Error(`${model.id}: disconnected or empty ${part.name}`);
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
  const out = process.argv[2] || path.join(os.tmpdir(), 'formaforge-block-cars-all-kits.zip');
  fs.writeFileSync(out, zipSync(allFiles, { level: 6 }));
  console.log(`PASS: 17 vehicles / ${count} solid modules including tools. Kit: ${out}`);
} finally {
  for (const file of scratch) fs.rmSync(file, { force: true });
}
