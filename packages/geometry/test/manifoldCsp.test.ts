import { it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { cspSafeManifold } from "../../../apps/web/build/manifoldCspPlugin";

it("runs real Manifold geometry and callback bindings with string code generation disabled", () => {
  const dir = mkdtempSync(join(tmpdir(), "formaforge-csp-"));
  try {
    const source = readFileSync(
      resolve("../../apps/web/node_modules/manifold-3d/manifold.js"),
      "utf8",
    );
    const patched = cspSafeManifold(source);
    expect(patched).not.toContain("newFunc(Function,");
    writeFileSync(join(dir, "manifold.mjs"), patched);
    const wasm = resolve(
      "../../apps/web/node_modules/manifold-3d/manifold.wasm",
    );
    writeFileSync(
      join(dir, "check.mjs"),
      `
      import fs from 'node:fs';import Module from './manifold.mjs';
      const api=await Module({wasmBinary:fs.readFileSync(${JSON.stringify(wasm)})});api.setup();
      const outer=api.CrossSection.circle(10,48),inner=api.CrossSection.circle(3,24),ring=outer.subtract(inner),body=ring.extrude(5),refined=body.refineToLength(2),warped=refined.warp(p=>{p[2]+=Math.sin(p[0])*.1;});
      const box=api.Manifold.cube([2,2,2],true),union=warped.add(box),mesh=union.getMesh();
      const bounds=union.boundingBox(),polygons=ring.toPolygons();
      console.log(JSON.stringify({volume:union.volume(),vertices:mesh.numVert,triangles:mesh.triVerts.length/3,bounds,rings:polygons.length}));
      [outer,inner,ring,body,refined,warped,box,union].forEach(o=>o.delete());
    `,
    );
    const result = JSON.parse(
      execFileSync(
        process.execPath,
        ["--disallow-code-generation-from-strings", join(dir, "check.mjs")],
        { encoding: "utf8", timeout: 30000 },
      ),
    );
    expect(result.volume).toBeGreaterThan(1400);
    expect(result.vertices).toBeGreaterThan(100);
    expect(result.rings).toBe(2);
    expect(result.bounds.max[2]).toBeGreaterThan(5);
  } finally {
    const target = resolve(dir);
    if (
      dirname(target) !== resolve(tmpdir()) ||
      !basename(target).startsWith("formaforge-csp-")
    )
      throw new Error("Unexpected CSP test scratch path");
    rmSync(target, { recursive: true, force: true });
  }
});
it("fails closed when an upstream binding marker changes", () => {
  expect(() => cspSafeManifold("export default function changed(){}")).toThrow(
    "upstream glue changed",
  );
});
