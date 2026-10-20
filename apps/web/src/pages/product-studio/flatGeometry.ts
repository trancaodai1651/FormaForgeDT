import type { CrossSection, Manifold } from "manifold-3d";
import type { ProductBuilder } from "./geometryContext";
import type { Ring } from "./model";
import { qrRings } from "./qr";
import { threadedSolid, threadPitch, fitClearance } from "./mechanics";
import { smoothTextSolid } from "../parametric-model-maker/smoothText";

export async function flatProduct(b: ProductBuilder) {
  const d = b.design,
    api = b.api,
    front = await b.lines();
  const art = d.artworks
    .filter((a) => a.side === "front")
    .flatMap((a) => b.art(a).map((r) => ({ ...r, art: a })));
  let content = b.union2([
    ...front.map((x) => x.section),
    ...art.map((x) => x.section),
  ]);
  let w = b.n("width", 70),
    h = b.n("height", 35),
    z = b.n("baseHeight", 3),
    shape: CrossSection;
  const qrs =
    ["qr", "scan-board"].includes(d.family) || b.b("includeQr")
      ? d.codes.map((q) => ({ q, ...qrRings(q) }))
      : [];
  if (qrs.length && b.b("autoCodes")) {
    const cell = Math.max(...qrs.map((q) => q.size)) + b.n("codeGap", 8);
    for (const face of ["front", "back"]) {
      const list = qrs.filter((r) =>
        face === "front" ? r.q.side !== "back" : r.q.side === "back",
      );
      const cols =
          d.family === "scan-board"
            ? Math.min(list.length, b.n("scanColumns", 3))
            : 1,
        rows = Math.ceil(list.length / Math.max(1, cols));
      list.forEach((r, i) => {
        r.q = {
          ...r.q,
          x: ((i % cols) - (cols - 1) / 2) * cell,
          y: ((rows - 1) / 2 - Math.floor(i / cols)) * cell,
        };
      });
    }
  }
  const box = content.bounds();
  if (!content.isEmpty() && b.s("sizing") === "fit") {
    w = Math.max(
      qrs.length ? w : 0,
      box.max[0] - box.min[0] + 2 * b.n("paddingX"),
    );
    h = Math.max(
      qrs.length ? h : 0,
      box.max[1] - box.min[1] + 2 * b.n("paddingY"),
    );
  }
  for (const r of qrs) {
    w = Math.max(w, 2 * Math.abs(r.q.x) + r.size + 2 * b.n("paddingX"));
    h = Math.max(
      h,
      2 * Math.abs(r.q.y) +
        r.size +
        2 * b.n("paddingY") +
        (r.q.caption ? 14 : 0),
    );
  }
  const scale = !content.isEmpty()
    ? Math.min(
        1,
        Math.max(1, w - 2 * b.n("paddingX")) / (box.max[0] - box.min[0]),
        Math.max(1, h - 2 * b.n("paddingY")) / (box.max[1] - box.min[1]),
      )
    : 1;
  if (scale < 1) {
    for (const f of front) f.section = b.track(f.section.scale([scale, scale]));
    for (const a of art) a.section = b.track(a.section.scale([scale, scale]));
    content = b.track(content.scale([scale, scale]));
  }
  if (d.family === "stamp" && b.s("stampMount") !== "none")
    z = Math.max(z, b.n("threadDepth", 8) + 2);
  if (b.s("shape") === "circle") h = w;
  shape = b.outline(
    w,
    h,
    b.b("useArtworkShape") ? "outline" : b.s("shape"),
    content,
  );
  if (qrs.length) {
    const required = b.union2(
      qrs.map((r) => b.move(b.rect(r.size + 1, r.size + 1), r.q.x, r.q.y)),
    );
    if (["outline", "text"].includes(b.s("shape")) || b.b("useArtworkShape"))
      shape = b.outline(w, h, "outline", b.union2([content, required]));
    else {
      for (let i = 0; i < 16 && !b.cut2(required, shape).isEmpty(); i++) {
        w *= 1.12;
        h *= 1.12;
        shape = b.outline(w, h);
      }
      if (!b.cut2(required, shape).isEmpty())
        throw new Error("QR_DOES_NOT_FIT");
    }
  }
  let base = b.at(shape, z);
  const holes: Manifold[] = [],
    through: CrossSection[] = [];
  if (b.b("keyring")) {
    const r = b.n("holeDiameter", 4) / 2,
      outer = r + b.n("ringWall", 2.5),
      side = b.s("ringPosition", "left");
    const vertical = ["top", "bottom"].includes(side),
      direction = ["left", "bottom"].includes(side) ? -1 : 1;
    const angle = (b.n("ringAngle") * Math.PI) / 180,
      dx =
        (vertical ? 0 : direction) * Math.cos(angle) -
        (vertical ? direction : 0) * Math.sin(angle),
      dy =
        (vertical ? 0 : direction) * Math.sin(angle) +
        (vertical ? direction : 0) * Math.cos(angle);
    let edge = 0;
    for (const ring of shape.toPolygons())
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          c = ring[(i + 1) % ring.length],
          sx = c[0] - a[0],
          sy = c[1] - a[1],
          den = dx * sy - dy * sx;
        if (Math.abs(den) < 1e-8) continue;
        const t = (a[0] * sy - a[1] * sx) / den,
          u = (a[0] * dy - a[1] * dx) / den;
        if (t >= 0 && u >= 0 && u <= 1) edge = Math.max(edge, t);
      }
    const distance =
        edge +
        (b.s("ringStyle") === "inside"
          ? -outer
          : b.s("ringStyle") === "slot"
            ? b.n("tabHeight") / 2 - 0.8
            : outer - 0.8),
      x = dx * distance,
      y = dy * distance;
    let ring = b.move(b.circle(outer), x, y);
    let bore = b.move(b.circle(r), x, y);
    if (b.s("ringStyle") === "slot") {
      const tw = b.n("tabWidth"),
        th = b.n("tabHeight"),
        sw = Math.min(tw - 1.6, b.n("slotWidth")),
        sh = Math.min(th - 1.6, b.n("slotHeight"));
      ring = b.move(
        b.track(
          b
            .rect(vertical ? tw : th, vertical ? th : tw, b.n("tabCorner"))
            .rotate(b.n("ringAngle")),
        ),
        x,
        y,
      );
      bore = b.move(
        b.track(
          b
            .rect(vertical ? sw : sh, vertical ? sh : sw, Math.min(sw, sh) / 2)
            .rotate(b.n("ringAngle")),
        ),
        x,
        y,
      );
    }
    if (b.s("ringStyle") !== "inside") {
      base = b.union([base, b.at(ring, z)]);
      shape = b.union2([shape, ring]);
    }
    holes.push(b.at(bore, z + 2, -1));
    through.push(bore);
  }
  if (b.b("mountHoles"))
    for (const x of [
      -w / 2 + b.n("mountInset", 6),
      w / 2 - b.n("mountInset", 6),
    ]) {
      const bore = b.move(
        b.circle(b.n("holeDiameter", 4) / 2 + b.printer.clearance),
        x,
        0,
      );
      holes.push(b.at(bore, z + 2, -1));
      through.push(bore);
    }
  const backing = b.s("backing");
  if (b.s("edgeFinish") !== "square" && b.n("edgeRadius") > 0)
    base = b.track(
      smoothTextSolid(
        api,
        shape,
        z,
        Math.min(z * 0.4, b.n("edgeRadius")),
        b.s("edgeFinish") === "chamfer" ? 1 : 10,
      ),
    );
  if (backing !== "none" || (d.family === "scan-board" && b.b("nfcPocket"))) {
    const depth = Math.min(z - 0.6, b.n("pocketDepth", 1.2)),
      r = b.n("pocketWidth", 25) / 2 + b.printer.clearance;
    if (backing === "pin")
      holes.push(b.at(b.rect(r * 2, 5 + b.printer.clearance, 1), depth));
    else if (d.family === "scan-board")
      for (const qr of qrs)
        holes.push(
          b.at(
            b.move(
              b.circle(b.n("nfcDiameter", 25) / 2 + b.printer.clearance),
              qr.q.x,
              qr.q.y,
            ),
            depth,
          ),
        );
    else holes.push(b.at(b.circle(r), depth));
  }
  if (d.family === "stamp" && b.s("stampMount") !== "none")
    holes.push(
      b.transform(
        threadedSolid(
          b,
          Number(b.s("threadSize", "M12").slice(1)) / 2,
          threadPitch(b.s("threadSize")),
          b.n("threadDepth", 8),
          fitClearance(b),
        ),
        0,
        0,
        0,
      ),
    );
  if (holes.length) base = b.sub(base, b.union(holes));
  if (through.length) shape = b.cut2(shape, b.union2(through));
  let faceZ =
    d.family === "medal" && b.s("medalStyle") === "recessed"
      ? Math.max(0.6, z - b.n("medalRecess"))
      : z;
  if (faceZ < z)
    base = b.sub(
      base,
      b.at(b.offset(shape, -b.n("medalInset")), z - faceZ + 1, faceZ),
    );
  b.add("Base", base, b.s("baseColor", "#356CD1"));
  if (b.b("dome")) {
    const height = b.n("domeHeight");
    b.surface = (x, y) => {
      const r2 = (x / (w / 2)) ** 2 + (y / (h / 2)) ** 2;
      return (
        height *
        (b.s("domeShape") === "ball"
          ? Math.sqrt(Math.max(0, 1 - r2))
          : b.s("domeShape") === "cone"
            ? Math.max(0, 1 - Math.sqrt(r2))
            : Math.max(0, 1 - r2) ** 2)
      );
    };
    const surface = b.surface;
    b.pieces[0].solid = b.track(
      b.track(base.refineToLength(2)).warp((p) => {
        p[2] += Math.max(0, p[2] / z) ** 2 * surface(p[0], p[1]);
      }),
    );
  }
  if (b.b("middle")) {
    const inset = b.offset(shape, -b.n("middleInset", 1));
    if (!inset.isEmpty()) {
      b.decorate(
        inset,
        z,
        "raised",
        b.n("middleHeight", 0.8),
        0,
        b.s("middleColor", "#FFFFFF"),
        "Middle",
      );
      z += b.n("middleHeight", 0.8);
      faceZ = z;
    }
  }
  if (b.b("border")) {
    const rim = b.cut2(shape, b.offset(shape, -b.n("borderWidth", 1)));
    b.decorate(
      rim,
      z,
      "raised",
      b.n("borderHeight", 0.8),
      0,
      b.s("borderColor", "#F4C542"),
      "Border",
    );
  }
  for (const f of front) {
    let section = f.section;
    if (d.family === "stamp" && b.b("mirrorPattern"))
      section = b.track(section.mirror([1, 0]));
    b.decorate(
      section,
      faceZ,
      b.b("dome") && b.s("domeText") === "engraved" ? "engraved" : f.line.style,
      f.line.rise,
      f.line.depth,
      f.line.color,
      "Text",
      "design",
      faceZ < z ? b.offset(shape, -b.n("medalInset")) : shape,
    );
  }
  for (const a of art)
    if (a.art.backing)
      b.decorate(
        b.offset(a.section, a.art.margin ?? 1.5),
        faceZ,
        "raised",
        0.8,
        0,
        b.s("baseColor"),
        "Artwork backing",
        "design",
        shape,
      );
  for (const a of art)
    b.decorate(
      a.section,
      faceZ + (a.art.backing ? 0.8 : 0),
      a.art.style,
      a.region.height ?? a.art.rise,
      a.art.depth,
      a.region.color,
      `Artwork ${a.art.id}`,
      "design",
      faceZ < z ? b.offset(shape, -b.n("medalInset")) : shape,
    );
  for (const r of qrs) {
    const backCode = r.q.side === "back" || r.q.side === "both";
    if (backCode) {
      const mirror = (section: CrossSection) => b.track(section.mirror([1, 0]));
      const apply = (section: CrossSection, color: string, style = "flush") => {
        const raised = style === "raised";
        const mask = b.and2(mirror(section), shape),
          layer = b.at(
            mask,
            raised ? r.q.height : Math.min(0.8, z - 0.3),
            raised ? -r.q.height : 0,
          );
        if (raised) b.add("Reverse QR", layer, color);
        else {
          for (const piece of b.pieces)
            if (piece.object === "design")
              piece.solid = b.sub(piece.solid, layer);
          if (style !== "engraved") b.add("Reverse QR inlay", layer, color);
        }
      };
      apply(b.move(b.rect(r.size, r.size, 1), r.q.x, r.q.y), r.q.tileColor);
      apply(b.move(b.cs(r.rings), r.q.x, r.q.y), r.q.color, r.q.style);
      if (r.q.logo && d.artworks[0])
        for (const a of b.art({
          ...d.artworks[0],
          size: (r.size - 8 * r.module) * 0.15,
          x: r.q.x,
          y: r.q.y,
          angle: 0,
        }))
          apply(a.section, a.region.color);
    }
    if (r.q.side === "back") continue;
    const tile = b.move(b.rect(r.size, r.size, 1), r.q.x, r.q.y);
    const mask = b.move(b.cs(r.rings), r.q.x, r.q.y);
    b.decorate(
      tile,
      z,
      "flush",
      0,
      Math.min(1, z - 0.3),
      r.q.tileColor,
      "QR tile",
    );
    b.decorate(
      mask,
      z,
      r.q.style,
      r.q.height,
      Math.min(0.8, z - 0.3),
      r.q.color,
      "QR modules",
    );
    if (r.q.logo && d.artworks[0]) {
      const logo = {
        ...d.artworks[0],
        size: (r.size - 8 * r.module) * 0.15,
        x: r.q.x,
        y: r.q.y,
        angle: 0,
      };
      for (const a of b.art(logo))
        b.decorate(a.section, z, "flush", 0, 0.5, a.region.color, "QR logo");
    }
    if (r.q.caption) {
      const text = await b.text({
        ...d.lines[0],
        text: r.q.caption,
        size: Math.min(6, r.size / 6),
        x: r.q.x,
        y: r.q.y - r.size / 2 - 5,
        color: "#111111",
      });
      b.decorate(
        text,
        z,
        "raised",
        0.5,
        0.5,
        b.s("decorationColor"),
        "Caption",
        "design",
        shape,
      );
    }
  }
  if (d.family === "medal") {
    const r = b.n("wreathRadius") || Math.min(w, h) * 0.39,
      style = b.s("medalStyle", "wreath"),
      rise = b.n("wreathRise");
    if (style === "rings")
      for (let i = 0; i < b.n("ringCount"); i++) {
        const outer = b.circle(
          Math.max(2, r - i * (b.n("ringThickness") + b.n("ringGap"))),
        );
        b.decorate(
          b.cut2(outer, b.offset(outer, -b.n("ringThickness"))),
          z,
          "raised",
          rise,
          0,
          b.s("decorationColor"),
          "Medal rings",
          "design",
          shape,
        );
      }
    else if (style === "wreath") {
      const count = b.n("leafCount"),
        limit = ((180 - b.n("wreathOpening") / 2) * Math.PI) / 180;
      for (const side of [-1, 1]) {
        const arc: Ring = [];
        for (const edge of [-1, 1])
          for (let j = 0; j <= 32; j++) {
            const angle = (edge < 0 ? j / 32 : 1 - j / 32) * limit,
              rr = r + (edge * b.n("wreathStem")) / 2;
            arc.push([Math.sin(angle) * rr * side, -Math.cos(angle) * rr]);
          }
        b.decorate(
          b.cs([arc]),
          z,
          "raised",
          rise,
          0,
          b.s("decorationColor"),
          "Laurel stem",
          "design",
          shape,
        );
        for (let i = 0; i < count; i++)
          for (const row of b.b("wreathBoth") ? [-1, 1] : [1]) {
            const angle =
                ((i + 0.5 + (row < 0 && b.b("wreathStagger") ? 0.35 : 0)) /
                  count) *
                limit,
              length = b.n("leafLength"),
              width = b.n("leafWidth"),
              leaf: Ring = [];
            for (const edge of [-1, 1])
              for (let j = 0; j <= 12; j++) {
                const t = edge < 0 ? j / 12 : 1 - j / 12,
                  bend =
                    ((Math.sin(t * Math.PI) * b.n("leafSickle")) / 100) * width;
                leaf.push([
                  t * length,
                  bend +
                    ((edge * width) / 2) *
                      Math.sin(t * Math.PI) ** (b.n("leafTaper") / 50),
                ]);
              }
            let section = b.track(
              b
                .cs([leaf])
                .rotate(
                  side * ((angle * 180) / Math.PI) +
                    row * side * b.n("leafTilt"),
                ),
            );
            section = b.move(
              section,
              Math.sin(angle) * r * side,
              -Math.cos(angle) * r,
            );
            b.decorate(
              section,
              z,
              "raised",
              rise,
              0,
              b.s("decorationColor"),
              "Laurel leaves",
              "design",
              shape,
            );
          }
      }
      if (b.b("wreathStar"))
        b.decorate(
          b.move(b.outline(8, 8, "star"), 0, -r),
          z,
          "raised",
          rise,
          0,
          b.s("decorationColor"),
          "Laurel star",
          "design",
          shape,
        );
    }
  }
  if (d.family === "sports") {
    const sport = b.s("sport"),
      r = Math.min(w, h) * 0.44,
      lines: CrossSection[] = [];
    if (
      ["basketball", "tennis", "baseball", "softball", "volleyball"].includes(
        sport,
      )
    ) {
      const copies = sport === "volleyball" ? 3 : 1;
      for (let i = 0; i < copies; i++)
        for (const side of [-1, 1]) {
          const curve = b.move(b.circle(r), side * r * 1.35, 0),
            arc = b.cut2(curve, b.offset(curve, -0.75));
          lines.push(b.track(arc.rotate(i * 120)));
          if (sport === "baseball" || sport === "softball")
            for (let j = -5; j <= 5; j++) {
              const a = (j / 5) * Math.PI * 0.27,
                x = side * r * 1.35 - side * Math.cos(a) * r,
                y = Math.sin(a) * r;
              lines.push(
                b.move(
                  b.track(b.rect(3, 0.65).rotate((-side * a * 180) / Math.PI)),
                  x,
                  y,
                ),
              );
            }
        }
      if (sport === "basketball")
        lines.push(b.rect(2 * r, 0.75), b.rect(0.75, 2 * r));
    } else if (sport === "soccer") {
      const pent = (size: number) =>
        b.cs([
          Array.from({ length: 5 }, (_, i) => {
            const a = (i * 2 * Math.PI) / 5 + Math.PI / 2;
            return [Math.cos(a) * size, Math.sin(a) * size] as [number, number];
          }),
        ]);
      lines.push(pent(r * 0.23));
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5 + Math.PI / 2;
        lines.push(
          b.move(
            pent(r * 0.17),
            Math.cos(a) * r * 0.85,
            Math.sin(a) * r * 0.85,
          ),
        );
        lines.push(
          b.move(
            b.track(b.rect(r * 0.6, 0.7).rotate((a * 180) / Math.PI)),
            Math.cos(a) * r * 0.52,
            Math.sin(a) * r * 0.52,
          ),
        );
      }
    } else if (sport === "football") {
      lines.push(b.rect(r * 0.9, 0.8));
      for (let i = -3; i <= 3; i++)
        lines.push(b.move(b.rect(0.8, r * 0.35), i * r * 0.1, 0));
      for (const side of [-1, 1])
        lines.push(b.move(b.rect(0.9, h), side * w * 0.32, 0));
    } else if (sport === "golf" || sport === "pickleball") {
      const pitch = r * (sport === "golf" ? 0.22 : 0.5);
      for (let y = -r; y <= r; y += pitch)
        for (let x = -r; x <= r; x += pitch)
          if (x * x + y * y < r * r * 0.9) {
            const disc = b.move(b.circle(pitch * 0.25, 20), x, y);
            lines.push(
              sport === "golf" ? b.cut2(disc, b.offset(disc, -0.35)) : disc,
            );
          }
    }
    b.decorate(
      b.union2(lines),
      z,
      sport === "pickleball" ? "engraved" : "flush",
      0.5,
      0.6,
      b.s("decorationColor"),
      "Ball pattern",
      "design",
      shape,
    );
  }
  if (b.b("twoSided") || d.family === "two-sided") {
    const reverse = await b.lines(d.backLines);
    for (const f of reverse) {
      let sec = f.section;
      if (!b.b("reverseMirror")) sec = b.track(sec.mirror([1, 0]));
      sec = b.and2(sec, shape);
      if (f.line.style === "raised")
        b.add(
          "Reverse text",
          b.at(sec, f.line.rise, -f.line.rise),
          f.line.color,
        );
      else {
        const cut = b.at(sec, Math.min(f.line.depth, z - 0.3));
        for (const piece of b.pieces)
          if (piece.object === "design") piece.solid = b.sub(piece.solid, cut);
        if (f.line.style === "flush") b.add("Reverse inlay", cut, f.line.color);
      }
    }
    for (const a of d.artworks.filter((a) => a.side === "back"))
      for (const r of b.art(a)) {
        let sec = b.and2(b.track(r.section.mirror([1, 0])), shape);
        if (a.style === "raised")
          b.add(
            "Reverse artwork",
            b.at(sec, r.region.height, -r.region.height),
            r.region.color,
          );
        else {
          const cut = b.at(sec, Math.min(a.depth, z - 0.3));
          for (const piece of b.pieces)
            if (piece.object === "design")
              piece.solid = b.sub(piece.solid, cut);
          if (a.style === "flush")
            b.add("Reverse artwork inlay", cut, r.region.color);
        }
      }
  }
  if (d.family === "topper") {
    const count = Math.max(1, Math.round(b.n("stakeCount", 2))),
      length = b.n("stakeLength", 65),
      stakeW = b.n("stakeWidth", 4);
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 0 : (i / (count - 1) - 0.5) * w * 0.6;
      const stake = b.cs([
        [
          [x - stakeW / 2, -h / 2 + 2],
          [x + stakeW / 2, -h / 2 + 2],
          [x + stakeW / 2, -h / 2 - length + 5],
          [x, -h / 2 - length],
          [x - stakeW / 2, -h / 2 - length + 5],
        ],
      ]);
      b.add("Stake", b.at(stake, z), b.s("baseColor"));
    }
  }
  if (d.family === "shoe") {
    const stem = b.at(
      b.circle(b.n("buttonStem", 2.8)),
      b.n("buttonNeck", 2.5),
      -b.n("buttonNeck", 2.5),
    );
    const head = b.at(
      b.circle(b.n("buttonDiameter", 11) / 2),
      2,
      -b.n("buttonNeck", 2.5) - 2,
    );
    b.add("Shoe button", b.union([stem, head]), b.s("baseColor"));
  }
  if (
    d.family === "stamp" &&
    b.s("stampMount") !== "none" &&
    b.b("includeHandle")
  ) {
    const x = w + 12,
      r = b.n("stampHandleDiameter", 25) / 2,
      hh = b.n("stampHandleHeight", 45),
      threadR = Number(b.s("threadSize", "M12").slice(1)) / 2;
    const grip =
        b.s("handleStyle") === "cylinder"
          ? b.at(b.circle(r), hh)
          : b.union([
              b.at(b.circle(r), Math.max(2, hh * 0.15)),
              b.transform(
                b.track(api.Manifold.cylinder(hh * 0.65, r, r * 0.7, b.detail)),
                0,
                0,
                hh * 0.15 - 0.02,
              ),
              b.transform(
                b.track(
                  api.Manifold.sphere(r * 0.7, b.detail).scale([
                    1,
                    1,
                    (hh * 0.2) / (r * 0.7),
                  ]),
                ),
                0,
                0,
                hh * 0.8,
              ),
            ]),
      thread = b.transform(
        threadedSolid(
          b,
          threadR,
          threadPitch(b.s("threadSize")),
          b.n("threadDepth", 8),
          0,
        ),
        0,
        0,
        hh - 0.05,
      );
    b.add(
      "Handle",
      b.transform(b.union([grip, thread]), x, 0, 0),
      b.s("decorationColor"),
      "handle",
    );
  }
  if (b.b("stand")) {
    const depth = b.n("standDepth", 30),
      sw =
        b.n("standWidth") ||
        Math.max(25, b.n("standWrap") > 0 ? w + b.n("standWrap") * 2 : w * 0.8),
      grip = b.n("standGrip"),
      seat = Math.min(grip - 1, b.n("standSeat")),
      stand = b.at(b.rect(sw, depth, 3), grip);
    const wrap = Math.min(sw * 0.2, b.n("standWrap")),
      sloped = Math.min(sw * 0.25, b.n("standSlope"));
    const slot = b.at(
      b.rect(sw + 2 - wrap * 2, z + b.n("standClearance") * 2),
      grip,
      seat,
    );
    let support = b.sub(stand, slot);
    if (sloped > 0)
      for (const sign of [-1, 1]) {
        const profile = b.cs([
          [
            [sign * (sw / 2 - sloped), grip],
            [sign * (sw / 2 + 1), grip],
            [sign * (sw / 2 + 1), Math.max(1, grip - sloped)],
          ],
        ]);
        const wedge = b.transform(
          b.track(b.at(profile, depth + 2).rotate([90, 0, 0])),
          0,
          depth / 2 + 1,
        );
        support = b.sub(support, wedge);
      }
    b.add(
      "Stand",
      b.transform(support, w + 10, 0, 0),
      b.s("baseColor"),
      "stand",
    );
  }
}
