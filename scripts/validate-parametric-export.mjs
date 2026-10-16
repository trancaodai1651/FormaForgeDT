// Validate exact browser-downloaded 3MF geometry, not a regenerated substitute.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import Module from "../apps/web/node_modules/manifold-3d/manifold.js";
const { unzipSync, strFromU8 } = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
)("fflate");
const path = process.argv[2];
if (!path)
  throw new Error(
    "Usage: node scripts/validate-parametric-export.mjs <downloaded.3mf>",
  );
const archive = unzipSync(readFileSync(path)),
  xml = strFromU8(archive["3D/3dmodel.model"]);
const api = await Module();
api.setup();
const solids = [];
const report = {
  file: path,
  items: (xml.match(/<item /g) || []).length,
  parts: [],
  overlap: 0,
};
try {
  for (const object of xml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
    if (!object[2].includes("<mesh>")) continue;
    const v = [
      ...object[2].matchAll(
        /<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/g,
      ),
    ].flatMap((m) => m.slice(1).map(Number));
    const t = [
      ...object[2].matchAll(
        /<triangle\s+v1="([^"]+)"\s+v2="([^"]+)"\s+v3="([^"]+)"/g,
      ),
    ].flatMap((m) => m.slice(1).map(Number));
    const edges = new Map();
    for (let i = 0; i < t.length; i += 3)
      for (let j = 0; j < 3; j++) {
        const a = t[i + j],
          b = t[i + ((j + 1) % 3)],
          k = a < b ? `${a},${b}` : `${b},${a}`;
        edges.set(k, (edges.get(k) || 0) + 1);
      }
    const badEdges = [...edges.values()].filter((n) => n !== 2).length;
    if (badEdges) throw new Error(`${badEdges} open/non-manifold edges`);
    const solid = new api.Manifold(
      new api.Mesh({
        numProp: 3,
        vertProperties: new Float32Array(v),
        triVerts: new Uint32Array(t),
      }),
    );
    solids.push(solid);
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < v.length; i++) {
      const axis = i % 3;
      min[axis] = Math.min(min[axis], v[i]);
      max[axis] = Math.max(max[axis], v[i]);
    }
    report.parts.push({
      id: object[1].match(/id="([^"]+)"/)?.[1],
      triangles: t.length / 3,
      min,
      max,
      volume: solid.volume(),
      badEdges,
    });
  }
  for (let i = 0; i < solids.length; i++)
    for (let j = 0; j < i; j++) {
      const overlap = solids[i].intersect(solids[j]);
      report.overlap += overlap.volume();
      overlap.delete();
    }
  if (report.overlap > 1e-4)
    throw new Error(`Overlapping materials: ${report.overlap} mm3`);
  if (!report.parts.length || report.items !== 1)
    throw new Error("Expected one assembly with mesh parts.");
  console.log(JSON.stringify(report, null, 2));
} finally {
  solids.forEach((s) => s.delete());
}
