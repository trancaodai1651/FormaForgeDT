import type { Manifold, CrossSection, ManifoldToplevel } from "manifold-3d";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { BuildContext } from "../../clicker/geometry/buildContext";
import {
  roundedRect,
  makeHeart,
  makeStar,
} from "../../clicker/geometry/geometry/shapeFactory";
import {
  loadMakerFont,
  registerMakerFont,
} from "../parametric-model-maker/wavyGeometry";
import type { PartMesh } from "../parametric-model-maker/model";
import type {
  ProductDesign,
  PrinterProfile,
  TextLine,
  Ring,
  Artwork,
} from "./model";

export class ProductBuilder extends BuildContext {
  api: ManifoldToplevel;
  pieces: { name: string; color: string; solid: Manifold; object: string }[] =
    [];
  surface: ((x: number, y: number) => number) | undefined;
  constructor(
    api: ManifoldToplevel,
    public design: ProductDesign,
    public printer: PrinterProfile,
    public base: string,
  ) {
    super(api);
    this.api = api;
    for (const a of design.assets)
      if (/\.(ttf|otf)$/i.test(a.name))
        registerMakerFont(`custom:${a.name}`, a.data);
  }
  n(key: string, fallback = 0) {
    const x = Number(this.design.params[key]);
    return Number.isFinite(x) ? x : fallback;
  }
  s(key: string, fallback = "") {
    return String(this.design.params[key] ?? fallback);
  }
  b(key: string) {
    return this.design.params[key] === true;
  }
  get detail() {
    return Math.max(24, Math.min(256, this.n("detail", 64)));
  }
  cs(rings: Ring[]) {
    return rings.length
      ? this.track(new this.api.CrossSection(rings, "EvenOdd"))
      : this.union2([]);
  }
  rect(w: number, h: number, r = 0) {
    return r > 0.01
      ? (roundedRect(
          this,
          Math.max(0.1, w),
          Math.max(0.1, h),
          r,
        ) as CrossSection)
      : this.track(
          this.api.CrossSection.square(
            [Math.max(0.1, w), Math.max(0.1, h)],
            true,
          ),
        );
  }
  circle(r: number, segments = this.detail) {
    return this.track(
      this.api.CrossSection.circle(Math.max(0.01, r), segments),
    );
  }
  union2(list: CrossSection[]) {
    return this.track(this.api.CrossSection.union(list));
  }
  union(list: Manifold[]) {
    return this.track(this.api.Manifold.union(list));
  }
  at(s: CrossSection, h: number, z = 0) {
    return this.track(
      this.track(s.extrude(Math.max(0.001, h))).translate([0, 0, z]),
    );
  }
  offset(s: CrossSection, d: number) {
    return this.track(s.offset(d, "Round", 2, this.detail));
  }
  move(s: CrossSection, x: number, y: number) {
    return this.track(s.translate([x, y]));
  }
  add(name: string, solid: Manifold, color: string, object = "design") {
    if (solid.isEmpty()) return;
    color = color.toUpperCase();
    const last = this.pieces[this.pieces.length - 1];
    if (
      last &&
      last.name === name &&
      last.color === color &&
      last.object === object
    )
      last.solid = this.union([last.solid, solid]);
    else this.pieces.push({ name, solid, color, object });
  }
  sub(a: Manifold, b: Manifold) {
    return this.track(a.subtract(b));
  }
  cut2(a: CrossSection, b: CrossSection) {
    return this.track(a.subtract(b));
  }
  and2(a: CrossSection, b: CrossSection) {
    return this.track(a.intersect(b));
  }
  transform(s: Manifold, x = 0, y = 0, z = 0) {
    return this.track(s.translate([x, y, z]));
  }
  outline(
    w: number,
    h: number,
    type = this.s("shape"),
    content?: CrossSection,
  ): CrossSection {
    if (type === "circle") h = w;
    const r = Math.min(w, h) / 2,
      side = Math.max(3, Math.round(this.n("sides", 6)));
    let shape: CrossSection;
    if (
      (type === "outline" || type === "text") &&
      content &&
      !content.isEmpty()
    ) {
      const filled = this.b("seeThrough")
        ? content
        : this.union2(content.toPolygons().map((r) => this.cs([r])));
      shape = this.offset(filled, this.n("paddingX", 4));
      if (this.b("seeThrough") && this.s("letterHoles") === "intact") {
        const holes = content.toPolygons().filter(
          (r) =>
            r.reduce((a, p, i) => {
              const q = r[(i + 1) % r.length];
              return a + p[0] * q[1] - q[0] * p[1];
            }, 0) < 0,
        );
        if (holes.length) shape = this.cut2(shape, this.cs(holes));
      }
    } else if (type === "heart")
      shape = this.track(makeHeart(this, r).scale([w / (r * 2), h / (r * 2)]));
    else if (type === "star") {
      const count = side === 6 ? 5 : side,
        pts: Ring = [];
      for (let i = 0; i < count * 2; i++) {
        const a = (i / count) * Math.PI + Math.PI / 2,
          k = i % 2 ? this.n("starSharpness", 45) / 100 : 1;
        pts.push([((Math.cos(a) * w) / 2) * k, ((Math.sin(a) * h) / 2) * k]);
      }
      shape = this.cs([pts]);
    } else if (
      [
        "circle",
        "oval",
        "hexagon",
        "polygon",
        "gear",
        "scallop",
        "cloud",
      ].includes(type)
    ) {
      const pts: Ring = [];
      const flutes = this.n("flutes", 24),
        teeth = this.n("teeth", 16),
        count = ["hexagon", "polygon"].includes(type)
          ? type === "hexagon"
            ? 6
            : side
          : Math.max(
              this.detail,
              Math.ceil((type === "gear" ? teeth : flutes) * 5),
            );
      for (let i = 0; i < count; i++) {
        const a =
          (i / count) * Math.PI * 2 +
          (this.b("pointed") ? Math.PI / (type === "hexagon" ? 6 : side) : 0);
        let scale = 1;
        if (type === "gear")
          scale =
            Math.floor((i / count) * teeth * 4) % 4 === 0 ||
            Math.floor((i / count) * teeth * 4) % 4 === 3
              ? 1 - this.n("toothHeight", 2) / r
              : 1;
        if (type === "scallop")
          scale =
            1 -
            ((this.n("fluteDepth", 1.5) / r) * (1 - Math.cos(a * flutes))) / 2;
        if (type === "cloud") scale = 0.92 + 0.08 * Math.cos(a * 7);
        pts.push([
          ((Math.cos(a) * w) / 2) * scale,
          ((Math.sin(a) * h) / 2) * scale,
        ]);
      }
      shape = this.cs([pts]);
    } else if (type === "shield")
      shape = this.cs([
        [
          [-w / 2, h / 2],
          [w / 2, h / 2],
          [w * 0.45, -h * 0.12],
          [0, -h / 2],
          [-w * 0.45, -h * 0.12],
        ],
      ]);
    else if (type === "trapezoid") {
      const ratio = this.n("topWidth", 70) / 100;
      shape = this.cs([
        [
          [-w / 2, -h / 2],
          [w / 2, -h / 2],
          [(w * ratio) / 2, h / 2],
          [(-w * ratio) / 2, h / 2],
        ],
      ]);
    } else if (type === "rhombus")
      shape = this.cs([
        [
          [0, -h / 2],
          [w / 2, 0],
          [0, h / 2],
          [-w / 2, 0],
        ],
      ]);
    else if (type === "parallelogram") {
      const slant = Math.min(w * 0.4, this.n("slant", 8));
      shape = this.cs([
        [
          [-w / 2, -h / 2],
          [w / 2 - slant, -h / 2],
          [w / 2, h / 2],
          [-w / 2 + slant, h / 2],
        ],
      ]);
    } else if (type === "arch")
      shape = this.union2([
        this.move(this.rect(w, h - w / 2), 0, -w / 4),
        this.move(this.circle(w / 2), 0, (h - w) / 2),
      ]);
    else if (type === "tree")
      shape = this.union2([
        this.cs([
          [
            [0, h / 2],
            [w / 2, -h * 0.35],
            [-w / 2, -h * 0.35],
          ],
        ]),
        this.move(this.rect(w * 0.2, h * 0.2), 0, -h * 0.4),
      ]);
    else if (type === "paw")
      shape = this.union2([
        this.move(
          this.track(this.circle(r * 0.56).scale([1, 0.8])),
          0,
          -h * 0.2,
        ),
        ...[-1.1, -0.38, 0.38, 1.1].map((a) =>
          this.move(
            this.circle(r * 0.24),
            Math.sin(a) * w * 0.34,
            Math.cos(a) * h * 0.3,
          ),
        ),
      ]);
    else if (type === "scallop-rect") {
      const core = this.rect(w - 4, h - 4, this.n("corner"));
      const pts = core.toPolygons()[0] ?? [];
      shape = this.union2([
        core,
        ...pts
          .filter((_, i) => i % 3 === 0)
          .map(([x, y]) => this.move(this.circle(2), x, y)),
      ]);
    } else shape = this.rect(w, h, this.n("corner", 4));
    return shape;
  }
  async font(id: string): Promise<Font> {
    return loadMakerFont(id, this.base);
  }
  async text(line: TextLine): Promise<CrossSection> {
    let text = line.text;
    if (line.letterCase === "upper") text = text.toUpperCase();
    if (line.letterCase === "lower") text = text.toLowerCase();
    if (!text) return this.cs([]);
    const nativeLato = line.font.startsWith("lato-"),
      font = await this.font(
        nativeLato
          ? `lato-${line.weight}${line.italic ? "-italic" : ""}`
          : line.font,
      );
    const data = font.data as unknown as {
      resolution: number;
      glyphs: Record<string, { ha: number }>;
    };
    const letters: CrossSection[] = [];
    let x = 0;
    for (const ch of text) {
      const shapes = font.generateShapes(ch, line.size);
      const rings: Ring[] = [];
      for (const shape of shapes) {
        const p = shape.extractPoints(Math.max(12, this.detail / 2));
        rings.push(p.shape.map((p) => [p.x + x, p.y]));
        rings.push(
          ...p.holes.map((h) =>
            h.map((p) => [p.x + x, p.y] as [number, number]),
          ),
        );
      }
      if (rings.length) letters.push(this.cs(rings));
      x +=
        ((data.glyphs[ch]?.ha ??
          data.glyphs["?"]?.ha ??
          data.resolution * 0.6) /
          data.resolution) *
          line.size +
        line.spacing;
    }
    let out = this.union2(letters);
    if (out.isEmpty()) return out;
    const weight =
      ({ light: -0.12, regular: 0, bold: 0.18, heavy: 0.35 }[line.weight] *
        line.size) /
      16;
    if (weight && !nativeLato) out = this.offset(out, weight);
    let box = out.bounds();
    out = this.move(
      out,
      -(box.min[0] + box.max[0]) / 2,
      -(box.min[1] + box.max[1]) / 2,
    );
    if (line.italic && !nativeLato)
      out = this.track(
        out.warp((p) => {
          p[0] += p[1] * Math.tan(Math.PI / 15);
        }),
      );
    if (line.curve !== "straight")
      out = this.track(
        out.warp((p) => {
          const angle = p[0] / Math.max(5, line.radius),
            r = line.radius + (line.curve === "top" ? p[1] : -p[1]);
          p[0] = Math.sin(angle) * r;
          p[1] =
            (Math.cos(angle) * r - line.radius) *
            (line.curve === "top" ? 1 : -1);
        }),
      );
    out = this.track(out.rotate(line.angle));
    box = out.bounds();
    if (line.align === "left") out = this.move(out, -box.min[0], 0);
    else if (line.align === "right") out = this.move(out, -box.max[0], 0);
    return this.move(out, line.x, line.y);
  }
  async lines(
    lines = this.design.lines,
  ): Promise<{ section: CrossSection; line: TextLine }[]> {
    const active = lines
      .filter((l) => l.text.trim())
      .map((l) => ({
        ...l,
        font: l.font === "inherit" ? lines[0].font : l.font,
      }));
    const gap = this.n("textGap", 2),
      total = active
        .filter((l) => l.align !== "manual")
        .reduce((n, l, i) => n + l.size + (i ? (l.lineGap ?? gap) : 0), 0);
    let y = total / 2,
      autoIndex = 0;
    const out = [];
    for (let i = 0; i < active.length; i++) {
      const line = active[i];
      const manual = line.align === "manual";
      if (autoIndex && !manual) y -= line.lineGap ?? gap;
      if (!manual) {
        y -= line.size / 2;
        autoIndex++;
      }
      let section = await this.text(line);
      section = this.move(section, 0, manual ? 0 : y);
      section = this.track(section.rotate(this.n("textAngle")));
      out.push({ section, line });
      if (!manual) y -= line.size / 2;
    }
    return out;
  }
  art(a: Artwork) {
    const rings = a.regions
      .filter((r) => r.enabled && r.height > 0)
      .map((r) => ({ region: r, section: this.cs(r.rings) }));
    return rings.map(({ region, section }) => ({
      region,
      section: this.move(
        this.track(
          this.track(
            section.scale([a.size * (a.mirror ? -1 : 1), a.size]),
          ).rotate(a.angle),
        ),
        a.x,
        a.y,
      ),
    }));
  }
  decorate(
    section: CrossSection,
    z: number,
    style: string,
    rise: number,
    depth: number,
    color: string,
    name: string,
    object = "design",
    mask?: CrossSection,
  ) {
    if (mask) section = this.and2(section, mask);
    if (section.isEmpty()) return;
    const bottom = style === "raised" ? z - 0.05 : z - Math.min(depth, z - 0.2),
      height = style === "raised" ? rise + 0.05 : Math.min(depth, z - 0.2);
    if (height <= 0) return;
    let solid = this.at(section, height, bottom);
    if (this.surface && object === "design") {
      const surface = this.surface;
      solid = this.track(
        this.track(solid.refineToLength(2)).warp((p) => {
          const amount = surface(p[0], p[1]);
          p[2] +=
            name === "Text" && this.s("domeText") === "flat"
              ? amount +
                ((this.n("domeHeight") - amount) * (p[2] - bottom)) / height
              : amount;
        }),
      );
    }
    if (style === "engraved") {
      for (const piece of this.pieces)
        if (piece.object === object) piece.solid = this.sub(piece.solid, solid);
    } else this.add(name, solid, color, object);
  }
  finish(): PartMesh[] {
    const result: PartMesh[] = [];
    let covered = this.union([]);
    for (const p of [...this.pieces].reverse()) {
      const solid = this.sub(p.solid, covered);
      covered = this.union([covered, p.solid]);
      if (solid.isEmpty() || Math.abs(solid.volume()) < 1e-8) continue;
      const mesh = solid.getMesh();
      const vertices = new Float32Array(mesh.numVert * 3);
      for (let i = 0; i < mesh.numVert; i++)
        for (let axis = 0; axis < 3; axis++)
          vertices[i * 3 + axis] =
            mesh.vertProperties[i * mesh.numProp + axis] *
            (1 + this.printer.shrink[axis] / 100);
      result.push({
        name: `${p.object} / ${p.name} ${p.color}`,
        color: p.color,
        role: p.name === "Base" ? "base" : "model",
        vertices,
        indices: new Uint32Array(mesh.triVerts),
      });
    }
    if (!result.length) throw new Error("EMPTY_GEOMETRY");
    const lo = [Infinity, Infinity, Infinity],
      hi = [-Infinity, -Infinity, -Infinity];
    for (const p of result)
      for (let i = 0; i < p.vertices.length; i++) {
        const a = i % 3;
        lo[a] = Math.min(lo[a], p.vertices[i]);
        hi[a] = Math.max(hi[a], p.vertices[i]);
      }
    const shift = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]];
    for (const p of result)
      for (let i = 0; i < p.vertices.length; i++) p.vertices[i] -= shift[i % 3];
    return result.reverse();
  }
}
