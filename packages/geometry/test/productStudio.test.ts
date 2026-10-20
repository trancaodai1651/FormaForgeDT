import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Module from "../../../apps/web/node_modules/manifold-3d/manifold.js";
import { unzipSync, strFromU8 } from "fflate";
import { PRODUCTS } from "../../../apps/web/src/pages/product-studio/catalog";
import {
  newDesign,
  DEFAULT_PRINTER,
  defaultQR,
} from "../../../apps/web/src/pages/product-studio/model";
import { PARAM_DEFAULTS } from "../../../apps/web/src/pages/product-studio/fields";
import { buildProduct } from "../../../apps/web/src/pages/product-studio/geometry";
import { ProductBuilder } from "../../../apps/web/src/pages/product-studio/geometryContext";
import { threadedSolid } from "../../../apps/web/src/pages/product-studio/mechanics";
import {
  qrRings,
  qrContent,
  scanQrImage,
} from "../../../apps/web/src/pages/product-studio/qr";
import {
  parseCsv,
  batchRows,
} from "../../../apps/web/src/pages/product-studio/csv";
import {
  product3mf,
  packObjects,
  rowDesign,
} from "../../../apps/web/src/pages/product-studio/export";
import {
  designJson,
  readDesign,
} from "../../../apps/web/src/pages/product-studio/storage";
import {
  meshBounds,
  partStl,
  unionForStl,
} from "../../../apps/web/src/pages/parametric-model-maker/export";
import { brailleCells } from "../../../apps/web/src/pages/product-studio/braille";
import { rollerPattern } from "../../../apps/web/src/pages/product-studio/rollerPatterns";
import { frameProduct } from "../../../apps/web/src/pages/product-studio/objectGeometry";
import {
  FIELDS,
  cleanParams,
  updateParameter,
} from "../../../apps/web/src/pages/product-studio/fields";
let api: Awaited<ReturnType<typeof Module>>;
beforeAll(async () => {
  api = await Module();
  api.setup();
  vi.stubGlobal("fetch", async (url: string) => {
    const name = String(url).split("/").pop()!;
    const path = name.endsWith(".3mf")
      ? `clicker-assets/switch/mx/${name}`
      : `parametric-maker-assets/fonts/${name}`;
    return new Response(
      readFileSync(resolve(process.cwd(), "../../apps/web/public", path)),
    );
  });
}, 30000);
afterAll(() => vi.unstubAllGlobals());
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const design = (id = "name-keychain") =>
  newDesign(PRODUCTS.find((p) => p.id === id)!, PARAM_DEFAULTS);
function volume(parts: Awaited<ReturnType<typeof buildProduct>>) {
  let total = 0;
  for (const p of parts) {
    const mesh = new api.Mesh({
      numProp: 3,
      vertProperties: p.vertices,
      triVerts: p.indices,
    });
    mesh.merge();
    const m = new api.Manifold(mesh);
    expect(m.isEmpty()).toBe(false);
    expect(m.volume()).toBeGreaterThan(1e-8);
    total += m.volume();
    m.delete();
  }
  return total;
}
describe("Product Studio generator inventory", () => {
  it("has 95 distinct bilingual presets in 23 families", () => {
    expect(PRODUCTS).toHaveLength(95);
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(95);
    expect(new Set(PRODUCTS.map((p) => p.family)).size).toBe(23);
    expect(PRODUCTS.every((p) => p.name[0] && p.name[1])).toBe(true);
  });
  for (const preset of PRODUCTS)
    it(`exports positive, closed, grounded meshes: ${preset.id}`, async () => {
      const d = newDesign(preset, PARAM_DEFAULTS);
      d.params.detail = 32;
      if (d.family === "surface-art") {
        const cube = api.Manifold.cube([40, 30, 8], true),
          mesh = cube.getMesh();
        d.model = [
          {
            name: "Test",
            color: "#FFFFFF",
            role: "model",
            vertices: new Float32Array(mesh.vertProperties),
            indices: new Uint32Array(mesh.triVerts),
          },
        ];
        cube.delete();
      }
      const parts = await buildProduct(d, DEFAULT_PRINTER, "/fonts/", api);
      expect(parts.length).toBeGreaterThan(0);
      expect(volume(parts)).toBeGreaterThan(0.1);
      const bounds = meshBounds(parts);
      expect(bounds.min[2]).toBeCloseTo(0, 4);
      expect(bounds.size.every((n) => Number.isFinite(n) && n > 0)).toBe(true);
    }, 180000);
});
it("preserves quoted multiline CSV, orders, quantity and blank inheritance", () => {
  expect(parseCsv('name,note\r\n"Alice, B","line1\nline2"')).toEqual([
    ["name", "note"],
    ["Alice, B", "line1\nline2"],
  ]);
  expect(batchRows("Alice\nBob")).toHaveLength(2);
  const d = rowDesign(
    design(),
    { personalization: "TRAN", qty: "3", base_color: "#E12837" },
    { name: "personalization" },
  );
  expect(d.lines[0].text).toBe("TRAN");
  expect(d.params.baseColor).toBe("#E12837");
  expect(d.params.width).toBe(70);
});
it("round-trips full project assets and independent per-region colours", () => {
  const d = design();
  d.assets = [{ name: "example.bin", data: new Uint8Array([0, 1, 255, 18]) }];
  d.lines[0].color = "#FF00AA";
  const restored = readDesign(designJson(d));
  expect(restored.lines[0].color).toBe("#FF00AA");
  expect(restored.assets).toEqual(d.assets);
  expect(restored.params).toEqual(d.params);
});
it("builds actual threaded male and clearance socket with no collision", () => {
  const b = new ProductBuilder(api, design(), DEFAULT_PRINTER, "/fonts/");
  try {
    const male = threadedSolid(b, 6, 1.75, 8),
      female = threadedSolid(b, 6, 1.75, 8, 0.2);
    expect(male.volume()).toBeGreaterThan(850);
    const remaining = b.sub(male, female);
    expect(Math.abs(remaining.volume())).toBeLessThan(1e-6);
  } finally {
    b.cleanup();
  }
});
it("keeps mounting holes through the base and exports material assignments + valid binary STL", async () => {
  const d = design();
  d.lines[0].style = "flush";
  const parts = await buildProduct(d, DEFAULT_PRINTER, "/fonts/", api);
  const archive = unzipSync(product3mf(parts, d, DEFAULT_PRINTER));
  const xml = strFromU8(archive["3D/3dmodel.model"]);
  expect(xml).toContain("basematerials");
  expect(xml).toContain('pindex="1"');
  expect(
    readDesign(strFromU8(archive["Metadata/product-studio.json"])).name,
  ).toBe(d.name);
  const merged = await unionForStl(parts, api),
    stl = partStl(merged);
  expect(stl.byteLength).toBe(84 + (merged.indices.length / 3) * 50);
  expect(volume([merged])).toBeGreaterThan(1);
});
it("packs all copies inside printer bounds and rejects oversized objects", async () => {
  const parts = await buildProduct(design(), DEFAULT_PRINTER, "/fonts/", api);
  const plates = packObjects(
    Array.from({ length: 12 }, (_, i) => ({
      parts,
      name: "Test",
      order: "1001",
      copy: i + 1,
    })),
    { ...DEFAULT_PRINTER, bedWidth: 180, bedDepth: 180 },
    5,
  );
  expect(plates.flatMap((p) => p.items)).toHaveLength(12);
  for (const p of plates) {
    const bb = meshBounds(p.parts);
    expect(bb.min[0]).toBeGreaterThanOrEqual(-85);
    expect(bb.max[0]).toBeLessThanOrEqual(85);
    expect(bb.min[1]).toBeGreaterThanOrEqual(-85);
    expect(bb.max[1]).toBeLessThanOrEqual(85);
  }
  expect(() =>
    packObjects(
      [{ parts, name: "x", order: "", copy: 1 }],
      { ...DEFAULT_PRINTER, bedWidth: 10, bedDepth: 10 },
      5,
    ),
  ).toThrow("OBJECT_EXCEEDS_BED");
});
it("maps English alphabet, number and capital indicators to correct Braille cells", () => {
  expect(brailleCells("A1")).toEqual(["6", "1", "3456", "1"]);
  expect(brailleCells("10")).toEqual(["3456", "1", "245"]);
  expect(() => brailleCells("Đ")).toThrow("BRAILLE_UNSUPPORTED");
});
describe("Advanced physical variants", () => {
  it("exports twelve separate MX caps with one printable holder", async () => {
    const d = design("keychain-keycap-clicker");
    d.lines[0].text = "ABCDEFGHIJKL";
    d.params.detail = 32;
    const parts = await buildProduct(d, DEFAULT_PRINTER, "/fonts/", api);
    expect(
      new Set(
        parts
          .filter((p) => p.name.startsWith("cap-"))
          .map((p) => p.name.split(" / ")[0]),
      ).size,
    ).toBe(12);
    expect(parts.some((p) => p.name.startsWith("holder /"))).toBe(true);
    expect(volume(parts)).toBeGreaterThan(100);
  }, 180000);
  it("supports the full quiet-zone tile over a circular base", async () => {
    const d = design("qr-code-keychain");
    Object.assign(d.params, {
      shape: "circle",
      width: 40,
      height: 40,
      detail: 32,
    });
    d.codes[0] = { ...defaultQR(), sizing: "fixed", size: 40, style: "flush" };
    const parts = await buildProduct(d, DEFAULT_PRINTER, "/fonts/", api),
      solids = parts.map((p) => {
        const mesh = new api.Mesh({
          numProp: 3,
          vertProperties: p.vertices,
          triVerts: p.indices,
        });
        mesh.merge();
        return new api.Manifold(mesh);
      }),
      model = api.Manifold.union(solids);
    try {
      const tile = parts.find((p) => p.name.includes("QR tile"))!,
        bounds = meshBounds([tile]),
        probe = api.Manifold.cube([
          bounds.size[0],
          bounds.size[1],
          0.1,
        ]).translate([bounds.min[0], bounds.min[1], 0.2]),
        outside = probe.subtract(model);
      expect(outside.volume()).toBeLessThan(1e-5);
      outside.delete();
      probe.delete();
    } finally {
      model.delete();
      solids.forEach((s) => s.delete());
    }
  });
  it("keeps requested magnet diameter and depth in frame and back plate", async () => {
    const d = design("picture-frame");
    Object.assign(d.params, {
      frameHold: "magnets",
      frameMagnetDiameter: 6,
      frameMagnetHeight: 3,
      framePanel: 1,
      wall: 2,
      detail: 32,
      frameMount: "none",
    });
    const b = new ProductBuilder(api, d, DEFAULT_PRINTER, "/fonts/");
    try {
      await frameProduct(b);
      const frame = b.pieces.find(
          (p) => p.object === "frame" && p.name === "Base",
        )!.solid,
        back = b.pieces.find((p) => p.object === "back")!.solid,
        bb = frame.boundingBox(),
        wall = (bb.max[0] - bb.min[0] - Number(d.params.photoWidth)) / 2,
        x = Number(d.params.photoWidth) / 2 + wall / 2;
      const probe = b.at(b.move(b.circle(3), x, 0), 2.9, bb.max[2] - 2.9);
      expect(b.track(frame.intersect(probe)).volume()).toBeLessThan(1e-5);
      const backBox = back.boundingBox(),
        backX = (backBox.max[0] + backBox.min[0]) / 2,
        backProbe = b.at(b.move(b.circle(3), backX + x, 0), 2.9, 0.5);
      expect(b.track(back.intersect(backProbe)).volume()).toBeLessThan(1e-5);
    } finally {
      b.cleanup();
    }
  });
  const variants: [
    string,
    string,
    Record<string, string | number | boolean>,
  ][] = [
    [
      "frame magnets and separate face",
      "picture-frame",
      {
        frameHold: "magnets",
        frameSeparateBorder: true,
        frameBorderFit: "magnets",
        frameMagnetCount: "4",
      },
    ],
    [
      "circular friction frame",
      "picture-frame",
      { shape: "circle", frameHold: "friction", frameMount: "wall" },
    ],
    [
      "bead Z bore with grip ribs",
      "name-beads",
      { holeDirection: "up", gripRibs: true, border: true },
    ],
    [
      "bead vertical bore",
      "name-beads",
      {
        holeDirection: "vertical",
        holeShape: "hex",
        beadSizing: "fixed",
        beadWidth: 18,
      },
    ],
    [
      "tray ring cells",
      "trinket-tray",
      {
        layout: "ring",
        compartments: 6,
        repeatFloorArt: true,
        edgeFinish: "fillet",
      },
    ],
    [
      "tray custom dividers",
      "trinket-tray",
      { dividerX: "-15,15", dividerY: "0", edgeFinish: "chamfer" },
    ],
    [
      "woven flared basket and woven floor",
      "woven-basket",
      {
        basketProfile: "flared",
        texture: "woven",
        basketFloor: "woven",
        neckScale: 125,
        separateWeave: true,
      },
    ],
    [
      "vase basket with lattice",
      "woven-basket",
      {
        basketProfile: "vase",
        texture: "diamond",
        basketFloor: "holes",
        bellyScale: 120,
      },
    ],
    [
      "sliding box ring pull",
      "sardine-tin-gift-box",
      { lidPull: "ring", lidCatch: true, stackable: true },
    ],
    [
      "brayer axle and bored fork",
      "embossing-rolling-pin",
      { rollerMode: "brayer", width: 50, diameter: 25, textureSize: 10 },
    ],
    [
      "spinning roller axle",
      "embossing-rolling-pin",
      { rollerJoin: "spin", width: 50, diameter: 25 },
    ],
    [
      "stamp solid back without handle",
      "stamp-maker",
      { stampMount: "none", baseHeight: 4 },
    ],
    [
      "stencil handle and counter bridges",
      "stencil",
      { stencilHandle: true, stencilBridges: true },
    ],
    [
      "angled slotted keyring",
      "name-keychain",
      { ringStyle: "slot", ringAngle: 45, edgeFinish: "fillet" },
    ],
  ];
  for (const [label, id, params] of variants)
    it(
      label,
      async () => {
        // Match catalogue IDs explicitly; a missing preset must fail this regression.
        const preset = PRODUCTS.find((p) => p.id === id);
        expect(preset, `missing ${id}`).toBeDefined();
        const d = newDesign(preset!, PARAM_DEFAULTS);
        Object.assign(d.params, params, { detail: 32 });
        if (d.family === "bead") d.lines[0].text = "AB";
        const parts = await buildProduct(d, DEFAULT_PRINTER, "/fonts/", api);
        expect(volume(parts)).toBeGreaterThan(1);
        expect(meshBounds(parts).min[2]).toBeCloseTo(0, 4);
        if (params.stampMount === "none")
          expect(parts.some((p) => p.name.startsWith("handle /"))).toBe(false);
        if (params.rollerMode === "brayer")
          expect(parts.some((p) => p.name.startsWith("axle /"))).toBe(true);
        if (params.frameSeparateBorder)
          expect(parts.some((p) => p.name.startsWith("border /"))).toBe(true);
      },
      180000,
    );
  it("makes each procedural roller pattern a non-empty printable section", async () => {
    for (const option of FIELDS.find((f) => f.key === "pattern")!.options!) {
      const d = design();
      d.params.pattern = option.value;
      d.params.detail = 32;
      const b = new ProductBuilder(api, d, DEFAULT_PRINTER, "/fonts/");
      try {
        const section = await rollerPattern(b, 50, 30);
        expect(section.isEmpty(), option.value).toBe(false);
        expect(b.at(section, 1).volume(), option.value).toBeGreaterThan(1);
      } finally {
        b.cleanup();
      }
    }
  }, 180000);
  it("supports QR on both faces without floating bottoms and preserves its side in backups", async () => {
    const d = design();
    d.lines[0].text = "";
    d.params.includeQr = true;
    d.params.sizing = "fit";
    d.codes[0] = {
      ...defaultQR(),
      side: "both",
      style: "flush",
      sizing: "fixed",
      size: 40,
      content: "https://example.com",
    };
    const parts = await buildProduct(d, DEFAULT_PRINTER, "/fonts/", api);
    expect(volume(parts)).toBeGreaterThan(1);
    expect(meshBounds(parts).min[2]).toBe(0);
    expect(parts.some((p) => p.name.includes("Reverse QR"))).toBe(true);
    expect(readDesign(designJson(d)).codes[0].side).toBe("both");
    expect(meshBounds(parts).size[0]).toBeGreaterThan(48);
  });
  it("calibration backups regenerate the bar and test pin", async () => {
    const d = design();
    d.params.calibration = true;
    const restored = readDesign(designJson(d)),
      parts = await buildProduct(restored, DEFAULT_PRINTER, "/fonts/", api);
    expect(parts.some((p) => p.name.startsWith("pin /"))).toBe(true);
    expect(parts.some((p) => p.name.startsWith("bar /"))).toBe(true);
    expect(volume(parts)).toBeGreaterThan(100);
  });
  it("honours explicit header mapping and excludes invalid colour input", () => {
    expect(batchRows("Customer,Count\nAlice,2", "header")).toEqual([
      { customer: "Alice", count: "2" },
    ]);
    expect(cleanParams({ baseColor: "javascript:bad" }).baseColor).toBe(
      PARAM_DEFAULTS.baseColor,
    );
    expect(
      updateParameter(PARAM_DEFAULTS, "cordPreset", "apple-pencil")
        .holeDiameter,
    ).toBe(8.9);
  });
});
it("decodes actual printable QR masks with quiet zone for all six payload types, also with a centre-logo gap", () => {
  for (const kind of [
    "text",
    "wifi",
    "phone",
    "sms",
    "email",
    "contact",
  ] as const)
    for (const logo of [false, true]) {
      const q = {
        ...defaultQR(),
        kind,
        content: "https://example.com/vi",
        ssid: "My WiFi",
        password: "test;123",
        phone: "+84123456789",
        message: "Xin chào",
        email: "hello@example.com",
        subject: "Hello",
        contactName: "Alice Example",
        company: "FormaForge",
        logo,
      };
      const geometry = qrRings(q),
        px = 8,
        side = Math.round(geometry.size / geometry.module) * px,
        pixels = new Uint8ClampedArray(side * side * 4).fill(255);
      for (const ring of geometry.rings) {
        const xs = ring.map((p) => p[0]),
          ys = ring.map((p) => p[1]);
        const x0 = Math.round(
            ((Math.min(...xs) + geometry.size / 2) / geometry.module) * px,
          ),
          x1 = Math.round(
            ((Math.max(...xs) + geometry.size / 2) / geometry.module) * px,
          ),
          y0 = Math.round(
            ((geometry.size / 2 - Math.max(...ys)) / geometry.module) * px,
          ),
          y1 = Math.round(
            ((geometry.size / 2 - Math.min(...ys)) / geometry.module) * px,
          );
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            const i = (y * side + x) * 4;
            pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
          }
      }
      expect(scanQrImage(pixels, side, side)).toBe(qrContent(q));
    }
});
