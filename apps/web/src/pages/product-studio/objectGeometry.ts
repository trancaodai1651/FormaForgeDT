import type { CrossSection, Manifold } from "manifold-3d";
import type { ProductBuilder } from "./geometryContext";
import { smoothTextSolid } from "../parametric-model-maker/smoothText";

function dividers(
  b: ProductBuilder,
  outline: CrossSection,
  w: number,
  h: number,
  z: number,
  floor: number,
) {
  const t = b.n("dividerWall", 1.6),
    walls: CrossSection[] = [];
  const mode = b.s("dividerMode", "grid"),
    custom = (key: string) =>
      b
        .s(key)
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
  if (mode === "spokes")
    for (let i = 0; i < b.n("wedges", 6); i++)
      walls.push(
        b.track(
          b
            .move(b.rect(Math.max(w, h), t), Math.max(w, h) / 2, 0)
            .rotate((i / b.n("wedges", 6)) * 360),
        ),
      );
  else {
    const xs =
      mode === "halves" || mode === "cross"
        ? [0]
        : b.s("dividerX")
          ? custom("dividerX")
          : Array.from(
              { length: Math.max(0, b.n("dividersX") - 1) },
              (_, i) => -w / 2 + ((i + 1) * w) / b.n("dividersX"),
            );
    const ys =
      mode === "cross"
        ? [0]
        : mode === "halves"
          ? []
          : b.s("dividerY")
            ? custom("dividerY")
            : Array.from(
                { length: Math.max(0, b.n("dividersY") - 1) },
                (_, i) => -h / 2 + ((i + 1) * h) / b.n("dividersY"),
              );
    for (const x of xs)
      if (Math.abs(x) < w / 2) walls.push(b.move(b.rect(t, h), x, 0));
    for (const y of ys)
      if (Math.abs(y) < h / 2) walls.push(b.move(b.rect(w, t), 0, y));
  }
  if (walls.length)
    b.add(
      "Dividers",
      b.at(b.and2(b.union2(walls), outline), z - floor, floor),
      b.s("baseColor"),
    );
}
export async function trayProduct(b: ProductBuilder) {
  const w = b.n("width"),
    h = b.n("height"),
    z = b.n("bodyHeight"),
    floor = Math.min(z - 0.5, b.n("floor")),
    wall = b.n("wall");
  const lines = await b.lines(),
    content = b.union2([
      ...lines.map((x) => x.section),
      ...b.design.artworks.flatMap((a) => b.art(a).map((x) => x.section)),
    ]);
  let outline = b.outline(
    w,
    h,
    b.b("useArtworkShape") ? "outline" : b.s("shape"),
    content,
  );
  const cells: { section: CrossSection; x: number; y: number }[] = [];
  if (b.s("layout") !== "single") {
    const count = b.n("compartments"),
      radius = b.n("compartmentRadius") || Math.min(w, h) * 0.3,
      isRow = b.s("layout") === "row",
      cellW = isRow
        ? w / count
        : 2 * Math.sin(Math.PI / count) * radius + wall * 0.6,
      cellH = isRow ? h : cellW;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2,
        x = isRow ? (i - (count - 1) / 2) * cellW : Math.cos(a) * radius,
        y = isRow ? 0 : Math.sin(a) * radius;
      let sec = b.outline(cellW, cellH, b.s("compartmentShape", "circle"));
      if (b.b("pointOutward")) sec = b.track(sec.rotate((a * 180) / Math.PI));
      cells.push({ section: b.move(sec, x, y), x, y });
    }
    if (b.s("layout") === "flower" || b.b("centreCompartment")) {
      const diameter = Math.max(
        wall * 3,
        Math.min(cellW, 2 * radius - cellW + wall),
      );
      cells.push({ section: b.circle(diameter / 2), x: 0, y: 0 });
    }
    outline = b.offset(b.union2(cells.map((c) => c.section)), wall * 0.4);
  }
  const inner = cells.length
    ? b.union2(cells.map((c) => b.offset(c.section, -wall)))
    : b.offset(outline, -wall);
  if (inner.isEmpty()) throw new Error("WALL_TOO_THICK");
  const rim = b.cut2(outline, inner),
    edgeRadius = Math.min(
      b.n("edgeRadius", 0.6),
      wall * 0.4,
      (z - floor) * 0.4,
    ),
    rounded = (section: CrossSection, height: number) =>
      b.s("edgeFinish") === "square"
        ? b.at(section, height)
        : b.track(
            smoothTextSolid(
              b.api,
              section,
              height,
              edgeRadius,
              b.s("edgeFinish") === "chamfer" ? 1 : 12,
            ),
          );
  let body = b.union([
    b.at(outline, floor),
    b.transform(rounded(rim, z - floor), 0, 0, floor),
  ]);
  if (b.b("stackable"))
    body = b.sub(
      body,
      b.at(
        b.cut2(b.offset(outline, -wall * 0.2), b.offset(outline, -wall * 0.75)),
        Math.min(0.6, floor * 0.3),
      ),
    );
  b.add("Base", body, b.s("baseColor"));
  if (b.n("rimWidth") > 0)
    b.add(
      "Rim",
      b.transform(
        rounded(
          b.cut2(b.offset(outline, b.n("rimWidth")), inner),
          b.n("rimHeight"),
        ),
        0,
        0,
        z - b.n("rimHeight"),
      ),
      b.s("decorationColor"),
    );
  dividers(b, inner, w, h, z, floor);
  const floors =
    b.b("repeatFloorArt") && cells.length
      ? cells.map((c) => ({
          section: b.offset(c.section, -wall),
          x: c.x,
          y: c.y,
        }))
      : [{ section: inner, x: 0, y: 0 }];
  for (const cell of floors) {
    const bounds = cell.section.bounds(),
      maxW = bounds.max[0] - bounds.min[0] - 2,
      maxH = bounds.max[1] - bounds.min[1] - 2;
    const place = (sec: CrossSection) => {
      if (!b.b("repeatFloorArt") || !cells.length || sec.isEmpty()) return sec;
      const box = sec.bounds(),
        scale = Math.min(
          1,
          maxW / (box.max[0] - box.min[0]),
          maxH / (box.max[1] - box.min[1]),
        );
      return b.move(b.track(sec.scale([scale, scale])), cell.x, cell.y);
    };
    for (const l of lines)
      b.decorate(
        place(l.section),
        floor,
        l.line.style,
        l.line.rise,
        l.line.depth,
        l.line.color,
        "Floor text",
        "design",
        cell.section,
      );
    for (const a of b.design.artworks)
      for (const r of b.art(a))
        b.decorate(
          place(r.section),
          floor,
          a.style,
          r.region.height,
          a.depth,
          r.region.color,
          "Floor art",
          "design",
          cell.section,
        );
  }
  wallTexture(b, outline, z, floor);
}
function wallTexture(
  b: ProductBuilder,
  outline: CrossSection,
  height: number,
  floor: number,
) {
  if (b.s("texture") === "none") return;
  const box = outline.bounds(),
    pitch = b.n("textureSize"),
    th = b.n("textureDepth");
  const skin = b.cut2(b.offset(outline, th), outline),
    ribs: CrossSection[] = [];
  for (let x = box.min[0]; x <= box.max[0]; x += pitch)
    ribs.push(
      b.move(
        b.rect(Math.max(0.5, pitch * 0.25), box.max[1] - box.min[1] + 2 * th),
        x,
        0,
      ),
    );
  for (let y = box.min[1]; y <= box.max[1]; y += pitch)
    ribs.push(
      b.move(
        b.rect(box.max[0] - box.min[0] + 2 * th, Math.max(0.5, pitch * 0.25)),
        0,
        y,
      ),
    );
  const pattern = b.and2(skin, b.union2(ribs));
  if (b.s("texture") === "ribbed")
    b.add("Wall ribs", b.at(pattern, height - floor, floor), b.s("baseColor"));
  else if (b.s("texture") === "woven") {
    b.add(
      "Upright weave",
      b.at(pattern, height - floor, floor),
      b.s("baseColor"),
    );
    for (let z = floor + pitch / 2; z < height; z += pitch)
      b.add(
        "Horizontal weave",
        b.at(skin, Math.min(1.2, pitch * 0.25), z),
        b.s("baseColor"),
      );
  } else {
    const patterns: CrossSection[] = [],
      span = Math.max(box.max[0] - box.min[0], box.max[1] - box.min[1]);
    for (let z = floor + pitch / 2; z < height; z += pitch * 0.85)
      for (let x = -span / 2; x < span / 2 + pitch; x += pitch) {
        const unit =
          b.s("texture") === "diamond"
            ? b.outline(pitch * 0.9, pitch * 0.9, "rhombus")
            : b.track(b.api.CrossSection.circle(pitch * 0.5, 6));
        patterns.push(
          b.move(
            b.cut2(unit, b.offset(unit, -Math.max(0.5, th))),
            x + ((Math.floor(z / pitch) % 2) * pitch) / 2,
            z,
          ),
        );
      }
    const sec = b.union2(patterns),
      volume = b.at(skin, height - floor, floor),
      projected = b.transform(
        b.track(b.at(sec, span + th * 2).rotate([90, 0, 0])),
        0,
        span / 2 + th,
      );
    b.add(
      "Lattice texture",
      b.track(
        volume.intersect(
          b.union([projected, b.track(projected.rotate([0, 0, 90]))]),
        ),
      ),
      b.s("baseColor"),
    );
  }
}
export async function frameProduct(b: ProductBuilder) {
  if (b.s("frameMode") === "plaque") {
    await trayPlaque(b);
    return;
  }
  const frontMagnets =
      b.b("frameSeparateBorder") && b.s("frameBorderFit") === "magnets",
    backMagnets = b.s("frameHold") === "magnets",
    magnetHeight = b.n("frameMagnetHeight");
  const pw = b.n("photoWidth"),
    ph = b.s("shape") === "circle" ? pw : b.n("photoHeight"),
    wall = Math.max(
      3,
      b.n("wall"),
      b.s("frameHold") === "magnets" ||
        (b.b("frameSeparateBorder") && b.s("frameBorderFit") === "magnets")
        ? b.n("frameMagnetDiameter") + b.printer.clearance * 2 + 2
        : 0,
    ),
    face = Math.max(
      b.n("frameFace", 1.2),
      frontMagnets ? magnetHeight + 0.4 : 0,
    ),
    panel = Math.max(
      b.n("framePanel", 1.5),
      backMagnets ? magnetHeight + 0.4 : 0,
    ),
    plug = b.n("framePlug", 1.2),
    c = b.printer.clearance,
    overlap = b.n("frameOverlap", 1.5),
    z = Math.max(
      face + b.n("photoThickness") + plug + 0.6,
      backMagnets || frontMagnets
        ? (b.b("frameSeparateBorder") ? face : 0) + magnetHeight + 0.8
        : 0,
    );
  const outer = b.outline(pw + wall * 2, ph + wall * 2),
    window = b.outline(pw - overlap * 2, ph - overlap * 2),
    pocket = b.outline(pw + c * 2, ph + c * 2),
    front = b.cut2(outer, window),
    band = b.cut2(outer, pocket);
  const separate = b.b("frameSeparateBorder"),
    faceX = separate ? -(pw + wall * 2 + 12) : 0,
    bodyZ = separate ? z - face : z;
  let frame = separate
    ? b.at(band, bodyZ)
    : b.sub(
        b.at(outer, z),
        b.union([b.at(window, z + 2, -1), b.at(pocket, z, face)]),
      );
  let faceSolid = b.at(front, face),
    back = b.outline(pw - c * 2, ph - c * 2),
    backPanel = b.outline(pw + wall * 2 - c * 2, ph + wall * 2 - c * 2),
    cover = b.union([b.at(backPanel, panel), b.at(back, plug, panel - 0.02)]);
  const rayEdge = (section: CrossSection, dx: number, dy: number) => {
    let edge = 0;
    for (const poly of section.toPolygons())
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i],
          c = poly[(i + 1) % poly.length],
          sx = c[0] - a[0],
          sy = c[1] - a[1],
          den = dx * sy - dy * sx;
        if (Math.abs(den) < 1e-8) continue;
        const t = (a[0] * sy - a[1] * sx) / den,
          u = (a[0] * dy - a[1] * dx) / den;
        if (t >= 0 && u >= 0 && u <= 1) edge = Math.max(edge, t);
      }
    return edge;
  };
  const directions: [number, number][] = [
    [-1, 0],
    [1, 0],
  ];
  if (b.s("frameMagnetCount") === "4") directions.push([0, -1], [0, 1]);
  const points = directions.map(([dx, dy]) => {
    const r = (rayEdge(outer, dx, dy) + rayEdge(pocket, dx, dy)) / 2;
    return [r * dx, r * dy] as [number, number];
  });
  const magnetR = b.n("frameMagnetDiameter") / 2 + c,
    magnetDepth = b.n("frameMagnetHeight");
  if (
    b.s("frameHold") === "magnets" ||
    (separate && b.s("frameBorderFit") === "magnets")
  )
    for (const [x, y] of points)
      if (!b.cut2(b.move(b.circle(magnetR), x, y), band).isEmpty())
        throw new Error("FRAME_MAGNET_FIT");
  if (b.s("frameHold") === "magnets")
    for (const [x, y] of points) {
      frame = b.sub(
        frame,
        b.at(
          b.move(b.circle(magnetR), x, y),
          Math.min(magnetDepth, bodyZ - 0.4),
          Math.max(0.4, bodyZ - magnetDepth),
        ),
      );
      cover = b.sub(
        cover,
        b.at(
          b.move(b.circle(magnetR), x, y),
          Math.min(magnetDepth, panel - 0.4),
          0.4,
        ),
      );
    }
  if (separate && b.s("frameBorderFit") === "magnets")
    for (const [x, y] of points) {
      faceSolid = b.sub(
        faceSolid,
        b.at(
          b.move(b.circle(magnetR), x, y),
          Math.min(magnetDepth, face - 0.4),
        ),
      );
      frame = b.sub(
        frame,
        b.at(
          b.move(b.circle(magnetR), x, y),
          Math.min(magnetDepth, bodyZ - 0.4),
          bodyZ - Math.min(magnetDepth, bodyZ - 0.4),
        ),
      );
    }
  if (b.s("frameHold") === "snap")
    for (const side of [-1, 1])
      for (const y of [-ph * 0.3, ph * 0.3]) {
        const catchTab = b.at(
          b.move(
            b.rect(1.2 + b.n("snap"), 6, 0.5),
            side * (pw / 2 - c - 0.4),
            y,
          ),
          plug * 0.6,
          panel + plug * 0.3,
        );
        cover = b.union([cover, catchTab]);
        const notch = b.at(
          b.move(b.rect(1.8 + b.n("snap") + c, 7, 0.5), side * (pw / 2 + c), y),
          plug * 0.7,
          Math.max(face, bodyZ - plug * 0.8),
        );
        frame = b.sub(frame, notch);
      }
  if (b.s("frameMount") === "wall" || b.b("mountHoles"))
    frame = b.sub(
      frame,
      b.at(
        b.move(b.circle(b.n("holeDiameter") / 2), 0, ph / 2 + wall / 2),
        bodyZ + 2,
        -1,
      ),
    );
  b.add("Base", frame, b.s("baseColor"), "frame");
  if (separate)
    b.add(
      "Front border",
      b.transform(faceSolid, faceX, 0),
      b.s("baseColor"),
      "border",
    );
  const bx = pw + wall * 2 + 12;
  if (b.s("frameMount") === "desk") {
    const slots = b.union(
      [-ph * 0.2, -ph * 0.05].map((y) =>
        b.at(b.move(b.rect(8 + c * 2, 2 + c * 2), 0, y), panel + plug + 2, -1),
      ),
    );
    cover = b.sub(cover, slots);
    const eh = b.n("easelHeight"),
      ed = b.n("easelDepth"),
      foot = b.cs([
        [
          [-4, eh * 0.2],
          [4, eh * 0.2],
          [4, -eh * 0.8],
          [ed / 2, -eh * 0.9],
          [-ed / 2, -eh * 0.9],
          [-4, -eh * 0.8],
        ],
      ]);
    b.add(
      "Easel",
      b.transform(b.at(foot, 2), bx + pw + 15, 0),
      b.s("baseColor"),
      "easel",
    );
  }
  b.add(
    "Back cover",
    b.transform(cover, bx, 0),
    b.s("decorationColor"),
    "back",
  );
  const decorZ = separate ? face : z,
    object = separate ? "border" : "frame",
    mask = b.move(front, faceX, 0);
  for (const text of await b.lines())
    b.decorate(
      b.move(text.section, faceX, 0),
      decorZ,
      text.line.style,
      text.line.rise,
      text.line.depth,
      text.line.color,
      "Frame text",
      object,
      mask,
    );
  for (const art of b.design.artworks) {
    const regions = b.art(art),
      backing = art.backing
        ? b.offset(b.union2(regions.map((r) => r.section)), art.margin ?? 1.5)
        : null;
    if (backing)
      b.add(
        "Graphic backing",
        b.transform(b.at(backing, Math.max(1, face)), faceX, 0),
        b.s("baseColor"),
        object,
      );
    for (const r of regions)
      b.decorate(
        b.move(r.section, faceX, 0),
        decorZ,
        art.style,
        r.region.height,
        art.depth,
        r.region.color,
        "Frame art",
        object,
        backing ? b.union2([mask, b.move(backing, faceX, 0)]) : mask,
      );
  }
}
async function trayPlaque(b: ProductBuilder) {
  const outer = b.rect(b.n("photoWidth"), b.n("photoHeight"), b.n("corner")),
    z = b.n("baseHeight");
  b.add("Base", b.at(outer, z), b.s("baseColor"));
  for (const a of b.design.artworks)
    for (const r of b.art(a))
      b.decorate(
        r.section,
        z,
        a.style,
        r.region.height,
        a.depth,
        r.region.color,
        "Photo art",
        "design",
        outer,
      );
}
export async function beadsProduct(b: ProductBuilder) {
  const mode = b.s("beadMode"),
    chars =
      mode === "letters"
        ? Array.from(b.design.lines[0].text).filter((c) => c.trim())
        : [""];
  let x = 0;
  for (let i = 0; i < chars.length; i++) {
    const art = b.design.artworks.flatMap((a) =>
        b.art(a).map((r) => ({
          ...r,
          color: r.region.color,
          style: a.style,
          depth: a.depth,
          rise: r.region.height,
        })),
      ),
      legend = chars[i]
        ? await b.text({
            ...b.design.lines[0],
            text: chars[i],
            x: 0,
            y: 0,
            angle: 0,
          })
        : b.b("topperName")
          ? b.union2((await b.lines()).map((l) => l.section))
          : b.cs([]);
    const layers =
      mode === "letters"
        ? [
            {
              section: legend,
              color: b.design.lines[0].color,
              style: b.design.lines[0].style,
              depth: b.design.lines[0].depth,
              rise: b.design.lines[0].rise,
            },
          ]
        : [
            ...art,
            ...(!legend.isEmpty()
              ? [
                  {
                    section: legend,
                    color: b.design.lines[0].color,
                    style: b.design.lines[0].style,
                    depth: b.design.lines[0].depth,
                    rise: b.design.lines[0].rise,
                  },
                ]
              : []),
          ];
    let content = b.union2(layers.map((l) => l.section));
    const box = content.bounds(),
      margin = b.n("beadMargin"),
      diam = b.n("holeDiameter") + b.n("cordFit", 0) * 2,
      scale = b.n("beadScale", 1),
      sizing = b.s("beadSizing", "auto");
    let w =
        (content.isEmpty() ? 16 : box.max[0] - box.min[0] + 2 * margin) * scale,
      h =
        (content.isEmpty() ? 16 : box.max[1] - box.min[1] + 2 * margin) * scale,
      height = b.n("baseHeight");
    if (sizing === "fixed") {
      const k = b.n("beadWidth", 16) / w;
      w *= k;
      h *= k;
    } else if (sizing === "dims") {
      w = b.n("width");
      h = b.n("height");
    }
    const direction = mode === "topper" ? "up" : b.s("holeDirection"),
      position = b.n("holePosition"),
      isUp = direction === "up";
    if (b.b("growToFit")) {
      if (!isUp) height = Math.max(height, diam + 2.5 + Math.abs(position) * 2);
      if (direction === "horizontal") h = Math.max(h, diam + 3);
      else w = Math.max(w, diam + 3);
    } else if (!isUp && height < diam + 1) throw new Error("BEAD_HOLE_FIT");
    const fit = content.isEmpty()
      ? 1
      : Math.min(
          (w - margin * 2) / (box.max[0] - box.min[0]),
          (h - margin * 2) / (box.max[1] - box.min[1]),
        );
    for (const layer of layers) {
      if (!content.isEmpty())
        layer.section = b.track(
          b
            .move(
              layer.section,
              -(box.min[0] + box.max[0]) / 2,
              -(box.min[1] + box.max[1]) / 2,
            )
            .scale([fit, fit]),
        );
    }
    content = b.union2(layers.map((l) => l.section));
    const shape = b.outline(w, h, b.s("shape"), content),
      hole =
        b.s("holeShape") === "hex"
          ? b.track(b.api.CrossSection.circle(diam / 2, 6))
          : b.circle(diam / 2),
      span = isUp
        ? mode === "topper"
          ? height - 0.8
          : height + 2
        : Math.max(w, h) + 4;
    const orient = (solid: Manifold) =>
      isUp
        ? solid
        : b.track(
            solid.rotate(direction === "horizontal" ? [0, 90, 0] : [90, 0, 0]),
          );
    const px = isUp ? position : direction === "horizontal" ? -w / 2 - 2 : 0,
      py = isUp ? 0 : direction === "vertical" ? h / 2 + 2 : 0,
      pz = isUp ? -0.01 : height / 2 + position;
    let solid = b.sub(
      b.at(shape, height),
      b.transform(orient(b.at(hole, span)), px, py, pz),
    );
    if (b.b("gripRibs"))
      for (const angle of [0, 120, 240]) {
        const a = (angle * Math.PI) / 180,
          r = diam / 2 - 0.12;
        solid = b.union([
          solid,
          b.track(
            b
              .transform(
                orient(
                  b.at(
                    b.move(b.circle(0.3, 12), Math.cos(a) * r, Math.sin(a) * r),
                    span,
                  ),
                ),
                px,
                py,
                pz,
              )
              .intersect(b.at(shape, height)),
          ),
        ]);
      }
    const object = `bead-${i + 1}`;
    b.add("Bead", b.transform(solid, x, 0), b.s("baseColor"), object);
    for (const layer of layers)
      b.decorate(
        b.move(layer.section, x, 0),
        height,
        layer.style,
        layer.rise,
        layer.depth,
        layer.color,
        "Face",
        object,
        b.move(shape, x, 0),
      );
    if (b.b("border"))
      b.decorate(
        b.move(b.cut2(shape, b.offset(shape, -b.n("borderWidth"))), x, 0),
        height,
        "raised",
        b.n("borderHeight"),
        0,
        b.s("borderColor"),
        "Border",
        object,
      );
    x += w + b.n("spacing");
  }
}
export async function cutterProduct(b: ProductBuilder) {
  const letter = b.design.family === "letter-cutter",
    chars = letter
      ? Array.from(b.design.lines[0].text).filter((c) => c.trim())
      : [""];
  let x = 0;
  for (let i = 0; i < chars.length; i++) {
    const text = letter
      ? await b.text({
          ...b.design.lines[0],
          text: chars[i],
          x: 0,
          y: 0,
          angle: 0,
        })
      : b.union2([
          ...(await b.lines()).map((l) => l.section),
          ...b.design.artworks.flatMap((a) => b.art(a).map((r) => r.section)),
        ]);
    let shape = letter
      ? b.offset(text, 1)
      : b.outline(
          b.n("width"),
          b.n("height"),
          b.b("useArtworkShape") ? "outline" : b.s("shape"),
          text,
        );
    if (shape.isEmpty()) throw new Error("EMPTY_GEOMETRY");
    const bb = shape.bounds(),
      w = bb.max[0] - bb.min[0],
      h = bb.max[1] - bb.min[1],
      z = b.n("bodyHeight"),
      wall = b.n("wall"),
      object = `cutter-${i + 1}`;
    const blade = b.cut2(b.offset(shape, wall), shape),
      rim = b.cut2(b.offset(shape, wall + b.n("rimWidth")), shape);
    b.add(
      "Cutter wall",
      b.transform(b.at(blade, z), x, 0),
      b.s("baseColor"),
      object,
    );
    b.add(
      "Grip rim",
      b.transform(b.at(rim, b.n("rimHeight")), x, 0),
      b.s("baseColor"),
      object,
    );
    if (b.b("imprint") && !text.isEmpty()) {
      const bridge = b.and2(
        b.offset(shape, wall),
        b.union2([
          b.rect(w + wall * 2, Math.max(1, wall)),
          b.rect(Math.max(1, wall), h + wall * 2),
        ]),
      );
      b.add(
        "Imprint bridge",
        b.transform(b.at(bridge, 1.5), x, 0),
        b.s("baseColor"),
        object,
      );
      b.add(
        "Imprint",
        b.transform(b.at(text, Math.min(z - 1, b.n("imprintHeight")), 1), x, 0),
        b.s("decorationColor"),
        object,
      );
    }
    if (b.b("moldSet")) {
      const inset = b.offset(shape, -b.printer.clearance * 2),
        y = h + 12;
      b.add(
        "Pusher",
        b.transform(b.at(inset, 2), x, y),
        b.s("decorationColor"),
        `pusher-${i}`,
      );
      b.add(
        "Pusher grip",
        b.transform(
          b.at(b.circle(Math.max(3, Math.min(w, h) * 0.15)), 8),
          x,
          y,
          1.9,
        ),
        b.s("decorationColor"),
        `pusher-${i}`,
      );
      const slots = b.n("traySlots"),
        cols = Math.min(3, slots),
        rows = Math.ceil(slots / cols),
        tw = cols * (w + 8) + 6,
        th = rows * (h + 8) + 6;
      let tray = b.at(b.rect(tw, th, 3), 4);
      const cut = [];
      for (let j = 0; j < slots; j++)
        cut.push(
          b.at(
            b.move(
              b.offset(shape, wall + b.printer.clearance),
              ((j % cols) - (cols - 1) / 2) * (w + 8),
              (Math.floor(j / cols) - (rows - 1) / 2) * (h + 8),
            ),
            4,
            1.5,
          ),
        );
      tray = b.sub(tray, b.union(cut));
      b.add(
        "Holding tray",
        b.transform(tray, x + tw / 2 + w, 0),
        b.s("baseColor"),
        `holding-${i}`,
      );
    }
    x += w + b.n("spacing");
  }
}
export async function stencilProduct(b: ProductBuilder) {
  let cut = b.union2([
    ...(await b.lines()).map((l) => l.section),
    ...b.design.artworks.flatMap((a) => b.art(a).map((r) => r.section)),
  ]);
  const w = b.n("width"),
    h = b.n("height"),
    th = b.n("bridgeWidth"),
    bridges: CrossSection[] = [];
  const signed = (ring: number[][]) =>
    ring.reduce((a, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return a + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2;
  if (b.b("tidyStencil")) {
    const tiny = cut
      .toPolygons()
      .filter(
        (r) => signed(r) < 0 && Math.abs(signed(r)) < b.n("stencilDetail") ** 2,
      );
    cut = b.union2([cut, ...tiny.map((r) => b.cs([r]))]);
  }
  const polygons = cut.toPolygons();
  if (b.b("stencilBridges"))
    for (const ring of polygons.filter((r) => signed(r) < 0)) {
      const x = ring.reduce((a, p) => a + p[0], 0) / ring.length,
        y = ring.reduce((a, p) => a + p[1], 0) / ring.length;
      const count = b.n("bridgesPerIsland", 1),
        start = (b.n("bridgeAngle") * Math.PI) / 180;
      for (let j = 0; j < count; j++) {
        let angle = start + (j * 2 * Math.PI) / count;
        if (b.s("bridgeDirection") === "vertical") angle += Math.PI / 2;
        const dx = Math.cos(angle),
          dy = Math.sin(angle),
          hits: number[] = [];
        for (const poly of polygons)
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i],
              c = poly[(i + 1) % poly.length],
              sx = c[0] - a[0],
              sy = c[1] - a[1],
              den = dx * sy - dy * sx;
            if (Math.abs(den) < 1e-8) continue;
            const ax = a[0] - x,
              ay = a[1] - y,
              t = (ax * sy - ay * sx) / den,
              u = (ax * dy - ay * dx) / den;
            if (t > 1e-6 && u >= 0 && u <= 1) hits.push(t);
          }
        hits.sort((a, c) => a - c);
        const length = (hits[1] ?? Math.max(w, h)) + th;
        bridges.push(
          b.move(
            b.track(b.rect(length, th).rotate((angle * 180) / Math.PI)),
            x + (dx * length) / 2,
            y + (dy * length) / 2,
          ),
        );
        if (b.s("bridgeDirection") === "both")
          bridges.push(
            b.move(
              b.track(b.rect(th, length).rotate((angle * 180) / Math.PI)),
              x - (dy * length) / 2,
              y + (dx * length) / 2,
            ),
          );
      }
    }
  const connected = b.cut2(cut, b.union2(bridges)),
    shape = b.outline(w, h);
  let stencil = b.at(b.cut2(shape, connected), b.n("baseHeight"));
  if (b.b("stencilHandle")) {
    const length = b.n("stencilHandleLength"),
      box = shape.bounds(),
      x = box.max[0] + length / 2 - 1;
    const grip = b.move(b.rect(length + 2, 14, 5), x, 0),
      hole = b.move(b.circle(2), x + length / 2 - 6, 0);
    stencil = b.union([stencil, b.at(b.cut2(grip, hole), b.n("baseHeight"))]);
  }
  b.add("Base", stencil, b.s("baseColor"));
}
export async function boxProduct(b: ProductBuilder) {
  const w = b.n("width"),
    h = b.n("height"),
    z = b.n("bodyHeight"),
    wall = b.n("wall"),
    floor = Math.max(0.6, b.n("floor")),
    lid = b.n("lidThickness"),
    lip = b.n("lidLip"),
    c = b.printer.clearance;
  if (z <= floor + lid + lip + 2) throw new Error("BOX_TOO_SHALLOW");
  const outer = b.rect(w, h, b.n("corner")),
    inner = b.offset(outer, -wall),
    railOuter = b.rect(w + 2, Math.max(1, h - wall), b.n("corner"));
  let body = b.sub(b.at(outer, z), b.at(inner, z, floor));
  // The channel opens at the +X end; the solid lip captures the two long lid edges.
  const channel = b.at(railOuter, lid + 2 * c, z - lip - lid - 2 * c);
  body = b.sub(body, b.transform(channel, wall + 1, 0));
  const catchX = -w / 2 + wall + 4,
    seatedZ = z - lip - lid - 2 * c;
  if (b.b("lidCatch"))
    body = b.sub(
      body,
      b.at(
        b.move(b.rect(3 + 2 * c, 9 + 2 * c, 1), catchX, 0),
        b.n("catchBump") + 2 * c,
        seatedZ + lid - 0.05,
      ),
    );
  if (b.b("stackable")) {
    const recess = b.cut2(
      b.offset(outer, -wall * 0.25),
      b.offset(outer, -wall * 0.8),
    );
    body = b.sub(body, b.at(recess, 0.6));
  }
  b.add("Base", body, b.s("baseColor"), "design");
  dividers(b, inner, w, h, z - lid - lip - 2 * c - 0.8, floor);
  wallTexture(b, outer, z, floor);
  const cover = b.rect(
      w - wall - 2 * c,
      h - wall - 2 * c,
      Math.max(0.5, b.n("corner") - wall / 2),
    ),
    x = w + 12;
  let coverSolid = b.at(cover, lid);
  const grip = b.move(
    b.rect(8, Math.min(18, h * 0.45), 3),
    w / 2 - wall - 5,
    0,
  );
  if (b.s("lidPull") === "grip")
    coverSolid = b.union([coverSolid, b.at(grip, 1, lid - 0.05)]);
  else if (b.s("lidPull") === "ring") {
    const center = w / 2 - wall - 7;
    coverSolid = b.union([
      coverSolid,
      b.at(
        b.move(b.cut2(b.circle(6), b.circle(3.5)), center, 0),
        2,
        lid - 0.05,
      ),
    ]);
  }
  if (b.b("lidCatch")) {
    b.add(
      "Catch",
      b.transform(
        b.at(b.move(b.rect(2, 8, 1), catchX, 0), b.n("catchBump"), lid - 0.05),
        x,
        0,
      ),
      b.s("baseColor"),
      "lid",
    );
  }
  b.add("Sliding lid", b.transform(coverSolid, x, 0), b.s("baseColor"), "lid");
  const style = b.s("lidDesign"),
    decor: CrossSection[] = [];
  if (style === "gift-wrapped")
    decor.push(
      b.rect(w - wall, 5),
      b.rect(5, h - wall),
      b.move(b.track(b.circle(7).scale([1, 0.5])), 5, 2),
      b.move(b.track(b.circle(7).scale([1, 0.5])), -5, 2),
    );
  if (style === "chocolate")
    for (let ix = -w / 2 + 10; ix < w / 2 - 5; ix += 16)
      for (let iy = -h / 2 + 10; iy < h / 2 - 5; iy += 16)
        decor.push(b.move(b.rect(13, 13, 1.5), ix, iy));
  if (
    [
      "notebook",
      "boarding-pass",
      "love-letter",
      "cassette",
      "classic-fish",
      "pattern",
    ].includes(style)
  ) {
    const border = b.cut2(b.offset(cover, -3), b.offset(cover, -4));
    decor.push(border);
    if (style === "love-letter")
      decor.push(
        b.track(b.rect(w * 0.4, 1).rotate(25)),
        b.track(b.rect(w * 0.4, 1).rotate(-25)),
      );
    else if (style === "cassette")
      decor.push(
        b.move(b.circle(6), -w * 0.23, 0),
        b.move(b.circle(6), w * 0.23, 0),
      );
    else
      for (let iy = -h / 2 + 8; iy < h / 2 - 5; iy += 6)
        decor.push(b.move(b.rect(w * 0.65, 0.6), 0, iy));
  }
  if (style === "christmas") decor.push(b.outline(w * 0.3, h * 0.75, "tree"));
  if (["pencil", "crayon"].includes(style))
    for (let iy = -h / 2 + 6; iy < h / 2 - 4; iy += 6)
      decor.push(b.move(b.rect(w * 0.8, 2, 1), 0, iy));
  if (decor.length)
    b.decorate(
      b.move(b.and2(b.union2(decor), cover), x, 0),
      lid,
      "raised",
      0.7,
      0.5,
      b.s("decorationColor"),
      "Lid pattern",
      "lid",
    );
  for (const l of await b.lines())
    b.decorate(
      b.move(l.section, x, 0),
      lid,
      l.line.style,
      l.line.rise,
      l.line.depth,
      l.line.color,
      "Lid text",
      "lid",
      b.move(cover, x, 0),
    );
  for (const a of b.design.artworks)
    for (const r of b.art(a))
      b.decorate(
        b.move(r.section, x, 0),
        lid,
        a.style,
        r.region.height,
        a.depth,
        r.region.color,
        "Lid art",
        "lid",
        b.move(cover, x, 0),
      );
}
