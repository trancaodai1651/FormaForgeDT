import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Module from "../../../apps/web/node_modules/manifold-3d/manifold.js";
import { unzipSync, strFromU8 } from "fflate";
import {
  parseCustomizer,
  applyParameters,
  parseScadLiteral,
} from "../../../apps/web/src/pages/parametric-model-maker/scadCustomizer";
import {
  partitionCsg,
  parseOff,
} from "../../../apps/web/src/pages/parametric-model-maker/csgMaterials";
import {
  DEFAULT_WAVY,
  configFromValues,
  selectedParts,
  type PartMesh,
} from "../../../apps/web/src/pages/parametric-model-maker/model";
import { buildWavy } from "../../../apps/web/src/pages/parametric-model-maker/wavyGeometry";
import {
  modelThreeMf,
  partStl,
  partsZip,
  meshBounds,
  unionForStl,
} from "../../../apps/web/src/pages/parametric-model-maker/export";
import { createProject } from "../../../apps/web/src/pages/parametric-model-maker/templates";
import {
  encodeAssets,
  decodeAssets,
} from "../../../apps/web/src/pages/parametric-model-maker/storage";

it("backs up imported font bytes exactly and rejects paths outside the project", () => {
  const assets = [
    { name: "fonts/example.ttf", data: new Uint8Array([0, 255, 128, 27, 10]) },
  ];
  expect(decodeAssets(encodeAssets(assets))).toEqual(assets);
  expect(() =>
    decodeAssets([{ name: "../outside.scad", data: "AA==" }]),
  ).toThrow();
});

describe("SCAD customizer parsing", () => {
  it("preserves vector ranges, typed options, hidden groups and quoted comment markers", () => {
    const p = parseCustomizer(
      '/* [Dimensions] */\n// Move it\npos = [0,1,2]; // [-10:0.5:10]\nmode = 2; // [1:One,2:Two]\nurl = "http://hello/{name}";\nmodule inner(){\nlocal = 2;\n}\n/* [Hidden] */\nsecret = 4;',
    );
    expect(p.map((x) => x.key)).toEqual(["pos", "mode", "url"]);
    expect(p[0]).toMatchObject({
      type: "vector",
      min: -10,
      max: 10,
      step: 0.5,
      description: "Move it",
    });
    expect(p[1].options).toEqual([
      { value: 1, label: "One" },
      { value: 2, label: "Two" },
    ]);
  });
  it("does not evaluate expressions or allow values to inject code", () => {
    expect(parseScadLiteral("1+evil()")).toBeUndefined();
    expect(parseCustomizer("size = 10+2;")).toHaveLength(0);
    expect(
      applyParameters('name = "OK";', { name: '";cube(999);', ignored: 10 }),
    ).toContain('name = "\\\";cube(999);";');
    expect(() => applyParameters("size = 10;", { size: Infinity })).toThrow();
  });
  it("bounds native model inputs and keeps the two region colors independent", () => {
    const config = configFromValues({
      ...DEFAULT_WAVY,
      diameter: 999,
      baseColor: "#356CD1",
    });
    expect(config.diameter).toBe(80);
    expect(config.textColor).toBe(DEFAULT_WAVY.textColor);
    expect(configFromValues({ baseColor: "red" }).baseColor).toBe("#FFFFFF");
  });
});
describe("compiled CSG material regions", () => {
  it("keeps transforms, subtraction cutters and independent colors", () => {
    const parts = partitionCsg(
      "multmatrix([[1,0,0,5],[0,1,0,0],[0,0,1,0],[0,0,0,1]]) { difference(){color([1,0,0,1]){cube(size=[20,20,20],center=false);} cylinder(h=25,r1=3,r2=3,center=false);} color([0,0,1,1]){sphere(r=5);} }",
    );
    expect(parts.map((p) => p.color)).toEqual(["#ff0000", "#0000ff"]);
    expect(parts[0].source).toContain("difference()");
    expect(parts[0].source).toContain("cylinder(");
    expect(parts[1].source).toContain("multmatrix(");
    expect(parts[1].source).toContain("difference()");
  });
  it("validates OFF output before previewing it", () => {
    expect(parseOff("OFF 3 1 0 0 0 0 1 0 0 0 1 0 3 0 1 2").indices).toEqual(
      new Uint32Array([0, 1, 2]),
    );
    expect(() => parseOff("OFF 3 1 0 0 0 0 1 0 0 0 1 0 3 0 1 99")).toThrow(
      "Chỉ số",
    );
    expect(() => parseOff("")).toThrow();
  });
});
function closed(part: PartMesh) {
  const edges = new Map<string, { count: number; direction: number }>();
  for (let i = 0; i < part.indices.length; i += 3)
    for (let j = 0; j < 3; j++) {
      const a = part.indices[i + j],
        b = part.indices[i + ((j + 1) % 3)],
        key = a < b ? `${a},${b}` : `${b},${a}`;
      const current = edges.get(key) ?? { count: 0, direction: 0 };
      current.count++;
      current.direction += a < b ? 1 : -1;
      edges.set(key, current);
    }
  expect(
    [...edges.values()].filter((e) => e.count !== 2 || e.direction !== 0),
  ).toEqual([]);
}
describe("wavy preview and export geometry", () => {
  let parts: PartMesh[];
  let api: Awaited<ReturnType<typeof Module>>;
  beforeAll(async () => {
    api = await Module();
    api.setup();
    vi.stubGlobal(
      "fetch",
      async (url: string) =>
        new Response(
          readFileSync(
            resolve(
              process.cwd(),
              `../../apps/web/public/parametric-maker-assets/fonts/${url.split("/").pop()}`,
            ),
          ),
        ),
    );
    parts = await buildWavy({ ...DEFAULT_WAVY, quality: "Fast" }, api);
  }, 30000);
  afterAll(() => vi.unstubAllGlobals());
  it("creates closed solids with a continuous substrate, no overlapping colors and supported text", async () => {
    expect(parts.map((p) => p.role)).toEqual(["base", "text"]);
    parts.forEach(closed);
    const solids = parts.map(
      (p) =>
        new api.Manifold(
          new api.Mesh({
            numProp: 3,
            vertProperties: p.vertices,
            triVerts: p.indices,
          }),
        ),
    );
    const intersection = solids[0].intersect(solids[1]);
    expect(intersection.volume()).toBeLessThan(1e-5);
    expect(meshBounds([parts[0]]).min[2]).toBe(0);
    expect(meshBounds([parts[1]]).min[2]).toBeCloseTo(0.88, 5);
    expect(meshBounds(parts).size).toEqual(expect.arrayContaining([40]));
    intersection.delete();
    solids.forEach((s) => s.delete());
    const stl = await unionForStl(parts, api);
    closed(stl);
    expect(new DataView(partStl(stl).buffer).getUint32(80, true)).toBe(
      stl.indices.length / 3,
    );
  });
  it("exports one assembly with unique resources, independent materials and correct slicer arrays", () => {
    const zip = unzipSync(modelThreeMf(parts, createProject(), "A1", 256)),
      xml = strFromU8(zip["3D/3dmodel.model"]),
      metadata = JSON.parse(strFromU8(zip["Metadata/project_settings.config"]));
    expect(xml.match(/<item /g)).toHaveLength(1);
    expect(xml.match(/<component /g)).toHaveLength(2);
    expect(xml).toContain('id="1"');
    expect(xml).toContain('objectid="4"');
    expect(xml).toContain("128 128 0");
    expect(xml).toContain("#FFFFFFFF");
    expect(xml).toContain("#FF329AFF");
    expect(metadata.flush_volumes_matrix).toHaveLength(4);
    expect(metadata.flush_volumes_vector).toHaveLength(4);
    expect(metadata.flush_multiplier).toHaveLength(1);
    expect(Object.keys(unzipSync(partsZip(parts)))).toHaveLength(2);
    const textOnly = strFromU8(
      unzipSync(modelThreeMf([parts[1]], createProject(), "A1", 256))[
        "3D/3dmodel.model"
      ],
    );
    const transform = textOnly
      .match(/<item[^>]*transform="([^"]+)"/)![1]
      .split(" ")
      .map(Number);
    expect(transform[11]).toBeCloseTo(-0.88, 5);
  });
  it("applies dimensions, wave and font controls to actual geometry; selection preserves assembly coordinates", async () => {
    const changed = await buildWavy(
      {
        ...DEFAULT_WAVY,
        diameter: 60,
        wavy: false,
        edgeRound: 0,
        quality: "Fast",
        font: "bevan",
      },
      api,
    );
    expect(meshBounds(changed).size[0]).toBeCloseTo(60, 4);
    expect(changed[1].vertices).not.toEqual(parts[1].vertices);
    expect(selectedParts(parts, "Text Only")[0]).toBe(parts[1]);
    expect(selectedParts(parts, "Base Only")[0]).toBe(parts[0]);
  });
});
