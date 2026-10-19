import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Module from "../../../apps/web/node_modules/manifold-3d/manifold.js";
import { unzipSync, strFromU8 } from "fflate";
import { SaxesParser } from "saxes";
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
  PRINTERS,
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
import reference from "./fixtures/wavy-reference-measurements.json";
import {
  fitWavyPoint,
  wavyRowWidth,
} from "../../../apps/web/src/pages/parametric-model-maker/wavyLayout";
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
  it("matches the reference printer list and rectangular build plates", () => {
    expect(PRINTERS.map((printer) => printer.name)).toEqual([
      "A1",
      "A1 mini",
      "A2L",
      "P1S",
      "P2S",
      "X1C",
      "X2D",
      "H2D",
      "H2D Pro",
      "H2C",
      "H2S",
      "P1P",
      "X1E",
      "X1",
      "Tùy chỉnh",
    ]);
    expect(PRINTERS.find((printer) => printer.name === "A2L")).toEqual({
      name: "A2L",
      width: 330,
      depth: 320,
    });
    expect(PRINTERS.find((printer) => printer.name === "H2D")).toEqual({
      name: "H2D",
      width: 350,
      depth: 320,
    });
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
describe("reference circular text fitting", () => {
  it("uses the measured cell spans rather than fitting the natural width of a word", () => {
    expect(wavyRowWidth(0, 3, DEFAULT_WAVY)).toBeCloseTo(33.5627, 3);
    expect(wavyRowWidth(1, 3, DEFAULT_WAVY)).toBeCloseTo(34.78, 4);
    expect(wavyRowWidth(2, 3, DEFAULT_WAVY)).toBeCloseTo(33.5627, 3);
    const c = { ...DEFAULT_WAVY, wavy: false };
    expect(fitWavyPoint(-0.8, 0, 0, 3, c)[0]).toBe(
      fitWavyPoint(-0.8, 1, 0, 3, c)[0],
    );
    expect(fitWavyPoint(-0.8, 1, 0, 3, c)[1]).toBeLessThan(
      fitWavyPoint(0, 1, 0, 3, c)[1],
    );
  });
  it("uses the top/bottom percentage for the wave at the outer edges", () => {
    const flat = fitWavyPoint(0.4, 1, 0, 3, {
      ...DEFAULT_WAVY,
      wavy: false,
    })[1];
    const wave0 = fitWavyPoint(0.4, 1, 0, 3, {
      ...DEFAULT_WAVY,
      waveTopBottom: 0,
    })[1];
    const wave40 = fitWavyPoint(0.4, 1, 0, 3, DEFAULT_WAVY)[1];
    const wave100 = fitWavyPoint(0.4, 1, 0, 3, {
      ...DEFAULT_WAVY,
      waveTopBottom: 100,
    })[1];
    expect(wave0).toBeCloseTo(flat, 5);
    expect(wave40 - flat).toBeCloseTo((wave100 - flat) * 0.4, 5);
  });
  it("opens a new model with the observed reference parameters", () => {
    const p = createProject();
    expect(p.config).toMatchObject({
      baseColor: "#FFFFFF",
      textColor: "#FF329A",
      quality: "Balanced",
      font: "lilita-one",
      diameter: 40,
      waveAmount: 2.5,
      waveCycles: 1,
      wavePhase: 0,
      waveTopBottom: 40,
    });
  });
});
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
    parts = await buildWavy(DEFAULT_WAVY, api);
  }, 30000);
  afterAll(() => vi.unstubAllGlobals());
  it("creates closed solids with a continuous substrate, no overlapping colors and supported text", async () => {
    expect(parts.map((p) => p.role)).toEqual(["base", "text"]);
    const textBounds = meshBounds([parts[1]]);
    expect(textBounds.size[0]).toBeGreaterThan(28.5);
    expect(textBounds.size[1]).toBeGreaterThan(30);
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
    // The reference uses the full circular bands, not small glyphs on arcs.
    expect(solids[1].volume()).toBeGreaterThan(2200);
    expect(intersection.volume()).toBeLessThan(1e-5);
    expect(meshBounds([parts[0]]).min[2]).toBe(0);
    expect(meshBounds([parts[1]]).min[2]).toBeCloseTo(0.88, 5);
    expect(meshBounds(parts).size).toEqual(expect.arrayContaining([40]));
    let maxRadius = 0;
    for (let i = 0; i < parts[1].vertices.length; i += 3)
      maxRadius = Math.max(
        maxRadius,
        Math.hypot(parts[1].vertices[i], parts[1].vertices[i + 1]),
      );
    expect(maxRadius).toBeLessThanOrEqual(20.002);
    intersection.delete();
    solids.forEach((s) => s.delete());
    const stl = await unionForStl(parts, api);
    closed(stl);
    expect(new DataView(partStl(stl).buffer).getUint32(80, true)).toBe(
      stl.indices.length / 3,
    );
  });
  it("exports one assembly with unique resources, independent materials and correct slicer arrays", () => {
    const zip = unzipSync(
        modelThreeMf(parts, createProject(), "A1", {
          width: 256,
          depth: 256,
        }),
      ),
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
      unzipSync(
        modelThreeMf([parts[1]], createProject(), "A1", {
          width: 256,
          depth: 256,
        }),
      )["3D/3dmodel.model"],
    );
    const transform = textOnly
      .match(/<item[^>]*transform="([^"]+)"/)![1]
      .split(" ")
      .map(Number);
    expect(transform[11]).toBeCloseTo(-0.88, 5);

    const rectangularBed = strFromU8(
      unzipSync(
        modelThreeMf(parts, createProject(), "A2L", {
          width: 330,
          depth: 320,
        }),
      )["3D/3dmodel.model"],
    );
    expect(rectangularBed).toContain("165 160 0");
  });
  it("exports well-formed XML in the actual 3MF package, including escaped project names", () => {
    const project = { ...createProject(), name: 'Text & base <test> "A"' };
    const files = unzipSync(
      modelThreeMf(parts, project, "A1", { width: 256, depth: 256 }),
    );
    for (const name of [
      "[Content_Types].xml",
      "_rels/.rels",
      "3D/3dmodel.model",
      "Metadata/model_settings.config",
    ])
      expect(
        () =>
          new SaxesParser({ xmlns: true })
            .write(strFromU8(files[name]))
            .close(),
        name,
      ).not.toThrow();
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
  it("matches measured sections and visible height of the supplied MakerWorld mesh", () => {
    const solid = new api.Manifold(
      new api.Mesh({
        numProp: 3,
        vertProperties: parts[1].vertices,
        triVerts: parts[1].indices,
      }),
    );
    const section = solid.slice(2);
    const polygons = section.toPolygons();
    for (const probe of reference.slices) {
      const ys: number[] = [];
      for (const ring of polygons)
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length];
          if (
            (a[0] <= probe.x && b[0] > probe.x) ||
            (b[0] <= probe.x && a[0] > probe.x)
          )
            ys.push(a[1] + ((probe.x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]));
        }
      ys.sort((a, b) => a - b);
      expect(ys.length, `crossings at X=${probe.x}`).toBe(probe.y.length);
      ys.forEach((y, i) =>
        expect(
          Math.abs(y - probe.y[i]),
          `X=${probe.x}, boundary ${i}`,
        ).toBeLessThan(0.25),
      );
    }
    expect(meshBounds(parts).size[2]).toBeCloseTo(reference.bounds[2], 4);
    const base = new api.Manifold(
      new api.Mesh({
        numProp: 3,
        vertProperties: parts[0].vertices,
        triVerts: parts[0].indices,
      }),
    );
    expect(
      Math.abs(base.volume() + solid.volume() - reference.volume),
    ).toBeLessThan(15);
    section.delete();
    solid.delete();
    base.delete();
  });
  it("changes letter spacing at cell edges without cutting each letter into disconnected strips", async () => {
    const spaced = await buildWavy(
      { ...DEFAULT_WAVY, letterSpacing: 0.5, edgeRound: 0, quality: "Fast" },
      api,
    );
    const solid = new api.Manifold(
      new api.Mesh({
        numProp: 3,
        vertProperties: spaced[1].vertices,
        triVerts: spaced[1].indices,
      }),
    );
    const components = solid.decompose();
    expect(components.length).toBeLessThanOrEqual(10);
    expect(components.length).toBeGreaterThan(2);
    components.forEach((part) => part.delete());
    solid.delete();
    spaced.forEach(closed);
  });
  it("does not fold circular bands at the strongest supported wave settings", () => {
    for (const layout of [1, 2, 3])
      for (const wavePhase of [-180, -90, 0, 90, 180])
        for (let nx = -1; nx <= 1; nx += 0.05)
          for (let row = 0; row < layout; row++) {
            const config = {
              ...DEFAULT_WAVY,
              waveAmount: 6,
              waveCycles: 2.5,
              wavePhase,
            };
            const bottom = fitWavyPoint(nx, 0, row, layout, config)[1];
            const top = fitWavyPoint(nx, 1, row, layout, config)[1];
            expect(top).toBeGreaterThan(bottom);
          }
  });
});
