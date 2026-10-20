import type { Manifold, CrossSection } from "manifold-3d";
import type { ProductBuilder } from "./geometryContext";
import { threadedSolid, threadPitch, fitClearance } from "./mechanics";
import { rollerPattern } from "./rollerPatterns";
import { smoothTextSolid } from "../parametric-model-maker/smoothText";
type P = [number, number, number];
const norm = (p: P): P => {
  const l = Math.hypot(...p);
  return p.map((x) => x / l) as P;
};
const cross = (a: P, c: P): P => [
  a[1] * c[2] - a[2] * c[1],
  a[2] * c[0] - a[0] * c[2],
  a[0] * c[1] - a[1] * c[0],
];
/** Closed sweep with shared indexed rings. Supports real open lattice, not a texture. */
function tube(b: ProductBuilder, path: P[], radius: number, closed = false) {
  const vertices: number[] = [],
    tris: number[] = [],
    n = 10,
    count = path.length;
  for (let j = 0; j < count; j++) {
    const prev = path[closed ? (j + count - 1) % count : Math.max(0, j - 1)],
      next = path[closed ? (j + 1) % count : Math.min(count - 1, j + 1)];
    const tangent = norm(next.map((x, i) => x - prev[i]) as P),
      u = norm(
        cross(tangent, Math.abs(tangent[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]),
      ),
      v = cross(tangent, u);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI;
      vertices.push(
        ...path[j].map(
          (x, k) => x + radius * (u[k] * Math.cos(a) + v[k] * Math.sin(a)),
        ),
      );
    }
  }
  for (let j = 0; j < (closed ? count : count - 1); j++)
    for (let i = 0; i < n; i++) {
      const a = j * n + i,
        c = j * n + ((i + 1) % n),
        d = ((j + 1) % count) * n + ((i + 1) % n),
        e = ((j + 1) % count) * n + i;
      tris.push(a, c, d, a, d, e);
    }
  if (!closed) {
    const start = vertices.length / 3;
    vertices.push(...path[0], ...path[count - 1]);
    for (let i = 0; i < n; i++)
      tris.push(
        start,
        (i + 1) % n,
        i,
        start + 1,
        (count - 1) * n + i,
        (count - 1) * n + ((i + 1) % n),
      );
  }
  return b.track(
    new b.api.Manifold(
      new b.api.Mesh({
        numProp: 3,
        vertProperties: new Float32Array(vertices),
        triVerts: new Uint32Array(tris),
      }),
    ),
  );
}
export async function basketProduct(b: ProductBuilder) {
  const w = b.n("width"),
    h = b.s("shape") === "circle" ? w : b.n("height"),
    height = b.n("bodyHeight"),
    floor = b.n("floor"),
    pitch = b.n("opening"),
    steps = Math.max(64, b.detail),
    r =
      (["diamond", "honeycomb"].includes(b.s("texture"))
        ? b.n("strand")
        : b.n("stakeThickness", 2.5)) / 2,
    wr = b.n("weaverThickness", 2.5) / 2,
    depth = Math.min(b.n("weaveDepth"), Math.min(r, wr) * 0.9);
  const unit = b.outline(w, h),
    rings = unit.toPolygons(),
    area = (ring: number[][]) =>
      ring.reduce((sum, p, i) => {
        const q = ring[(i + 1) % ring.length];
        return sum + p[0] * q[1] - p[1] * q[0];
      }, 0),
    boundary = rings.sort((a, c) => Math.abs(area(c)) - Math.abs(area(a)))[0];
  const lengths = boundary.map((p, i) =>
      Math.hypot(
        p[0] - boundary[(i + 1) % boundary.length][0],
        p[1] - boundary[(i + 1) % boundary.length][1],
      ),
    ),
    perimeter = lengths.reduce((a, c) => a + c, 0);
  const size = (t: number) => {
    const base = b.n("baseScale") / 100,
      neck = b.n("neckScale") / 100,
      belly = b.n("bellyScale") / 100,
      middle = b.n("bellyHeight") / 100;
    if (b.s("basketProfile") === "straight") return base;
    if (b.s("basketProfile") === "flared") return base + (neck - base) * t;
    return t < middle
      ? base + (belly - base) * Math.sin(((t / middle) * Math.PI) / 2)
      : belly +
          (neck - belly) *
            (1 - Math.cos((((t - middle) / (1 - middle)) * Math.PI) / 2));
  };
  const point = (phase: number, t: number, offset = 0): P => {
    let distance = (((phase % 1) + 1) % 1) * perimeter,
      index = 0;
    while (index < lengths.length - 1 && distance > lengths[index])
      distance -= lengths[index++];
    const a = boundary[index],
      c = boundary[(index + 1) % boundary.length],
      u = distance / lengths[index],
      x = (a[0] + (c[0] - a[0]) * u) * size(t),
      y = (a[1] + (c[1] - a[1]) * u) * size(t),
      length = Math.hypot(x, y);
    return [x + (x / length) * offset, y + (y / length) * offset, t * height];
  };
  const section = (t: number) => b.track(unit.scale([size(t), size(t)])),
    bottom = section(0),
    top = section(1),
    bandColor = b.b("separateBands") ? b.s("bandColor") : b.s("baseColor"),
    weaveColor = b.b("separateWeave") ? b.s("weaveColor") : b.s("baseColor");
  let bottomSolid = b.at(bottom, Math.max(0.1, floor));
  if (floor > 0 && b.s("basketFloor") !== "solid") {
    const bars: CrossSection[] = [];
    for (let x = -w / 2; x <= w / 2; x += pitch)
      bars.push(b.move(b.rect(b.n("stakeThickness"), h * 2), x, 0));
    for (let y = -h / 2; y <= h / 2; y += pitch)
      bars.push(b.move(b.rect(w * 2, b.n("weaverThickness")), 0, y));
    bottomSolid = b.at(b.and2(bottom, b.union2(bars)), floor);
  }
  if (floor > 0 && b.s("basketFloor") === "woven") {
    const woven: Manifold[] = [],
      bb = bottom.bounds(),
      span = Math.max(w, h),
      envelope = b.at(bottom, floor + 2, -1);
    for (const axis of [0, 1])
      for (
        let row = 0;
        row * pitch <= (axis ? bb.max[0] - bb.min[0] : bb.max[1] - bb.min[1]);
        row++
      ) {
        const path: P[] = [];
        for (let j = 0; j <= 32; j++) {
          const t = j / 32,
            a = -span / 2 + t * span,
            fixed = (axis ? bb.min[0] : bb.min[1]) + row * pitch;
          path.push(
            axis
              ? [
                  fixed,
                  a,
                  floor / 2 +
                    floor *
                      0.2 *
                      Math.cos((a / pitch) * Math.PI + row * Math.PI),
                ]
              : [
                  a,
                  fixed,
                  floor / 2 -
                    floor *
                      0.2 *
                      Math.cos((a / pitch) * Math.PI + row * Math.PI),
                ],
          );
        }
        woven.push(tube(b, path, floor / 2));
      }
    bottomSolid = b.track(b.union(woven).intersect(envelope));
  }
  if (floor > 0) b.add("Floor", bottomSolid, b.s("baseColor"));
  b.add(
    "Base",
    b.union([
      b.at(b.cut2(bottom, b.offset(bottom, -b.n("wall"))), b.n("bottomBand")),
      b.at(
        b.cut2(top, b.offset(top, -b.n("wall"))),
        b.n("topBand"),
        height - b.n("topBand"),
      ),
    ]),
    bandColor,
  );
  const count = Math.max(8, Math.min(120, Math.round(perimeter / pitch))),
    levels = Math.max(
      3,
      Math.min(80, Math.round(height / (b.n("weaverGap", 7) + wr * 2))),
    ),
    diamond = ["diamond", "honeycomb"].includes(b.s("texture")),
    parts: Manifold[] = [];
  for (let i = 0; i < count; i++)
    for (const direction of diamond ? [-1, 1] : [0]) {
      const path: P[] = [];
      for (let j = 0; j <= steps; j++) {
        const t = j / steps,
          phase =
            i / count +
            ((direction * t * height) / perimeter) *
              Math.tan((b.n("strandAngle", 45) * Math.PI) / 180),
          offset = diamond
            ? 0
            : depth * Math.cos(t * levels * Math.PI + i * Math.PI);
        path.push(point(phase, t, offset));
      }
      parts.push(tube(b, path, r));
    }
  if (!diamond)
    for (let row = 1; row < levels; row++) {
      const path: P[] = [],
        spiral = b.b("spiralWeavers");
      for (let i = 0; i < (spiral ? steps + 1 : steps); i++) {
        const phase = i / steps,
          t = spiral ? Math.min(1, (row + phase) / levels) : row / levels,
          offset = -depth * Math.cos(phase * count * Math.PI + row * Math.PI);
        path.push(point(phase, t, offset));
      }
      parts.push(tube(b, path, wr, !spiral));
    }
  b.add("Weave", b.union(parts), weaveColor);
}
export async function rollerProduct(b: ProductBuilder) {
  const mode = b.s("rollerMode"),
    length = b.n("width"),
    r = b.n("diameter") / 2,
    relief = b.n("reliefDepth"),
    raised = b.s("reliefStyle") === "raised",
    color = b.s("baseColor"),
    c = b.printer.clearance;
  let motif = await rollerPattern(
    b,
    mode === "mat" ? length : 2 * Math.PI * r,
    mode === "mat" ? b.n("height") : length,
  );
  if (b.b("mirrorPattern")) motif = b.track(motif.mirror([1, 0]));
  if (mode === "mat") {
    const shape = b.rect(length, b.n("height"), 3);
    b.add("Base", b.at(shape, b.n("baseHeight")), color);
    b.decorate(
      motif,
      b.n("baseHeight"),
      b.s("reliefStyle"),
      relief,
      relief,
      b.s("decorationColor"),
      "Texture",
      "design",
      shape,
    );
    return;
  }
  let core = b.at(b.circle(r), length);
  if (mode === "sleeve") {
    const inner = b.n("sleeveInner") / 2 + c;
    if (inner >= r - relief - 0.8) throw new Error("SLEEVE_WALL");
    core = b.sub(core, b.at(b.circle(inner), length + 2, -1));
  } else if (mode === "brayer" || b.s("rollerJoin") === "spin") {
    core = b.sub(
      core,
      b.at(
        b.circle((mode === "brayer" ? 3 : 4) + b.n("spinClearance", 0.35)),
        length + 2,
        -1,
      ),
    );
  } else {
    const threadR = Number(b.s("threadSize").slice(1)) / 2;
    const socket = threadedSolid(
      b,
      threadR,
      threadPitch(b.s("threadSize")),
      10,
      fitClearance(b),
    );
    const hole =
      b.s("rollerJoin") === "push"
        ? b.at(b.circle(threadR + fitClearance(b)), 10)
        : socket;
    core = b.sub(
      core,
      b.union([
        hole,
        b.transform(b.track(hole.rotate([180, 0, 0])), 0, 0, length),
      ]),
    );
  }
  if (!motif.isEmpty()) {
    const thickness = relief + 0.08,
      bottom = raised ? r - 0.04 : r - relief;
    let reliefSolid =
      b.s("reliefShape") === "flat"
        ? b.at(motif, thickness, bottom)
        : b.transform(
            b.track(
              smoothTextSolid(
                b.api,
                motif,
                thickness,
                Math.min(relief * 0.45, b.n("reliefRound")),
                b.s("reliefShape") === "chisel" ? 1 : 8,
              ),
            ),
            0,
            0,
            bottom,
          );
    reliefSolid = b.track(reliefSolid.refineToLength(Math.max(0.7, r / 12)));
    reliefSolid = b.track(
      reliefSolid.warp((p) => {
        const a = p[0] / r,
          z = p[1] + length / 2,
          rr = p[2];
        p[0] = Math.cos(a) * rr;
        p[1] = Math.sin(a) * rr;
        p[2] = z;
      }),
    );
    // Trim at the physical ends before uniting the cylindrical seam.
    reliefSolid = b.track(
      reliefSolid.intersect(b.at(b.circle(r + relief + 1), length)),
    );
    if (raised)
      b.add("Wrapped relief", reliefSolid, b.s("decorationColor"), "roller");
    else core = b.sub(core, reliefSolid);
  }
  b.add("Roller", core, color, "roller");
  if (mode === "pin" && b.s("rollerJoin") !== "spin")
    for (const side of [-1, 1]) {
      const handle = b.union([
        b.at(b.circle(b.n("handleDiameter") / 2), b.n("handleLength")),
        b.transform(
          b.s("rollerJoin") === "push"
            ? b.at(b.circle(Number(b.s("threadSize").slice(1)) / 2), 10)
            : threadedSolid(
                b,
                Number(b.s("threadSize").slice(1)) / 2,
                threadPitch(b.s("threadSize")),
                10,
              ),
          0,
          0,
          b.n("handleLength") - 0.05,
        ),
      ]);
      b.add(
        "Threaded handle",
        b.transform(handle, side * (r + b.n("handleDiameter") / 2 + 12), 0),
        b.s("decorationColor"),
        `handle-${side}`,
      );
    }
  if (b.b("guideRings"))
    for (const side of [-1, 1]) {
      const ring = b.cut2(b.circle(r + b.n("doughThickness")), b.circle(r + c));
      b.add(
        "Dough ring",
        b.transform(b.at(ring, b.n("guideWidth")), side * (r * 3 + 25), 0),
        color,
        `guide-${side}`,
      );
    }
  if (mode === "brayer" || (mode === "pin" && b.s("rollerJoin") === "spin")) {
    const ar = mode === "brayer" ? 3 : 4,
      axleLength = length + 18,
      offset = r + 20;
    const shaft = b.union([
      b.at(b.circle(ar), axleLength),
      b.at(
        b.circle(mode === "brayer" ? 6 : b.n("handleDiameter") / 2),
        mode === "brayer" ? 2 : b.n("handleLength"),
      ),
    ]);
    b.add("Axle with stop", b.transform(shaft, -offset, 0), color, "axle");
    const end = b.sub(
      b.at(
        b.circle(mode === "brayer" ? 6 : b.n("handleDiameter") / 2),
        mode === "brayer" ? 3 : b.n("handleLength"),
      ),
      b.at(
        b.circle(ar + fitClearance(b)),
        Math.min(12, b.n("handleLength") - 0.8),
      ),
    );
    b.add(
      "Push-on axle stop",
      b.transform(end, offset, 0),
      b.s("decorationColor"),
      "axle-stop",
    );
  }
  if (mode === "brayer") {
    const x = length / 2 + 4,
      height = r + 8;
    let frame = b.union([
      b.transform(b.at(b.rect(length + 14, 8, 2), 7), 0, r + 20),
      ...[-1, 1].map((side) =>
        b.transform(b.at(b.rect(6, r + 30, 2), height), side * x, (r + 20) / 2),
      ),
      b.transform(b.at(b.rect(14, 55, 4), 7), 0, r + 48),
    ]);
    const bore = b.transform(
      b.track(
        b.at(b.circle(3 + b.printer.clearance), length + 20).rotate([0, 90, 0]),
      ),
      -length / 2 - 10,
      0,
      r + 3,
    );
    frame = b.sub(frame, bore);
    b.add(
      "Brayer frame",
      b.transform(frame, r + length + 70, 0),
      color,
      "frame",
    );
  }
}
export async function surfaceProduct(b: ProductBuilder) {
  const parts = b.design.model;
  if (!parts?.length) throw new Error("IMPORT_MODEL_FIRST");
  const solids = parts.map((p) => {
    const mesh = new b.api.Mesh({
      numProp: 3,
      vertProperties: p.vertices,
      triVerts: p.indices,
    });
    mesh.merge();
    return b.track(new b.api.Manifold(mesh));
  });
  let model = b.union(solids);
  model = b.track(model.rotate([b.n("modelX"), b.n("modelY"), b.n("modelZ")]));
  model = b.track(model.scale(b.n("modelScale", 100) / 100));
  const bb = model.boundingBox();
  model = b.transform(
    model,
    -(bb.min[0] + bb.max[0]) / 2,
    -(bb.min[1] + bb.max[1]) / 2,
    -bb.min[2],
  );
  const top = model.boundingBox().max[2];
  b.add("Base", model, b.s("baseColor"));
  const layers = [
    ...(await b.lines()).map((l) => ({
      section: l.section,
      style: l.line.style,
      rise: l.line.rise,
      depth: l.line.depth,
      color: l.line.color,
    })),
    ...b.design.artworks.flatMap((a) =>
      b.art(a).map((r) => ({
        section: r.section,
        style: a.style,
        rise: r.region.height,
        depth: a.depth,
        color: r.region.color,
      })),
    ),
  ];
  for (const l of layers) {
    const column = b.at(l.section, top + Math.max(l.rise, l.depth) + 1, -0.1);
    if (l.style === "raised") {
      const skin = b.sub(b.transform(model, 0, 0, l.rise), model),
        art = b.track(skin.intersect(column));
      b.add("Surface relief", art, l.color);
    } else {
      const skin = b.sub(model, b.transform(model, 0, 0, -l.depth)),
        cut = b.track(skin.intersect(column));
      b.pieces[0].solid = b.sub(b.pieces[0].solid, cut);
      if (l.style === "flush") b.add("Surface inlay", cut, l.color);
    }
  }
}
