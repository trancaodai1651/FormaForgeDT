import type { CrossSection } from "manifold-3d";
import type { ProductBuilder } from "./geometryContext";
import type { Ring } from "./model";

/** Original procedural motifs. Random layouts are seeded so exports and previews agree. */
export async function rollerPattern(b: ProductBuilder, w: number, h: number) {
  const kind = b.s("pattern"),
    pitch = b.n("textureSize", 10),
    size = b.n("motifSize", 16),
    gap = b.n("motifGap", 5),
    shapes: CrossSection[] = [];
  let seed = b.n("variation", 1) * 1234567;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  const stroke = (points: Ring, width = 0.7) => {
    const parts: CrossSection[] = [];
    for (let i = 1; i < points.length; i++) {
      const [x, y] = points[i - 1],
        [xx, yy] = points[i],
        len = Math.hypot(xx - x, yy - y);
      if (len > 0.001)
        parts.push(
          b.move(
            b.track(
              b
                .rect(len, width)
                .rotate((Math.atan2(yy - y, xx - x) * 180) / Math.PI),
            ),
            (x + xx) / 2,
            (y + yy) / 2,
          ),
        );
    }
    return b.union2(parts);
  };
  if (["text", "image", "panel"].includes(kind)) {
    const layers =
      kind === "text"
        ? (await b.lines()).map((l) => l.section)
        : b.design.artworks.flatMap((a) => b.art(a).map((r) => r.section));
    let motif = b.union2(layers);
    if (motif.isEmpty()) motif = b.outline(size * 0.6, size * 0.6, "star");
    const bb = motif.bounds(),
      mw = bb.max[0] - bb.min[0],
      mh = bb.max[1] - bb.min[1];
    motif = b.move(
      motif,
      -(bb.min[0] + bb.max[0]) / 2,
      -(bb.min[1] + bb.max[1]) / 2,
    );
    if (b.s("patternLayout") === "wrap") {
      const k =
        b.s("patternFit") === "cover"
          ? Math.max(w / mw, h / mh)
          : b.s("patternFit") === "width"
            ? w / mw
            : Math.min(w / mw, h / mh);
      return b.and2(b.track(motif.scale([k, k])), b.rect(w, h));
    }
    const k = size / Math.max(mw, mh);
    motif = b.track(motif.scale([k, k]));
    const cw = kind === "panel" ? size + gap : mw * k + gap,
      ch = kind === "panel" ? size + gap : mh * k + gap,
      rows = Math.max(1, Math.floor(h / ch)),
      cols = Math.max(1, Math.floor(w / cw));
    for (let iy = 0; iy < rows; iy++)
      for (let ix = 0; ix < cols; ix++) {
        const mode = b.s("patternArrangement"),
          x =
            (ix - (cols - 1) / 2) * cw +
            (mode === "halfdrop" && iy % 2 ? cw / 2 : 0),
          y = (iy - (rows - 1) / 2) * ch;
        let m = motif;
        if (mode === "mirror" && ix % 2) m = b.track(m.mirror([1, 0]));
        if (mode === "scatter")
          m = b.track(
            m.rotate((random() - 0.5) * 80).scale(0.65 + random() * 0.35),
          );
        m = b.move(
          m,
          x + (mode === "scatter" ? (random() - 0.5) * gap : 0),
          y + (mode === "scatter" ? (random() - 0.5) * gap : 0),
        );
        shapes.push(m);
        if (kind === "panel")
          shapes.push(
            b.move(
              b.cut2(
                b.rect(size, size, 2),
                b.rect(size - 1.4, size - 1.4, 1.3),
              ),
              x,
              y,
            ),
          );
      }
  } else if (["fluted", "ribbed", "diagonal", "quilted"].includes(kind)) {
    const span = Math.hypot(w, h) * 1.5;
    for (let t = -span; t <= span; t += pitch) {
      const line = b.move(b.rect(span * 2, 0.8), 0, t);
      if (kind === "fluted") shapes.push(b.track(line.rotate(90)));
      else if (kind === "ribbed") shapes.push(line);
      else {
        shapes.push(b.track(line.rotate(45)));
        if (kind === "quilted") shapes.push(b.track(line.rotate(-45)));
      }
    }
  } else if (["waves", "rope", "zigzag", "scales"].includes(kind)) {
    for (let y = -h / 2 - pitch; y <= h / 2 + pitch; y += pitch) {
      const pts: Ring = [];
      for (let x = -w / 2 - pitch; x <= w / 2 + pitch; x += pitch / 16) {
        const phase = (x / pitch) * 2 * Math.PI,
          yy =
            kind === "zigzag"
              ? (2 / Math.PI) * Math.asin(Math.sin(phase))
              : kind === "scales"
                ? Math.abs(Math.sin(phase / 2))
                : Math.sin(phase);
        pts.push([x, y + yy * pitch * (kind === "rope" ? 0.25 : 0.35)]);
      }
      shapes.push(stroke(pts, kind === "rope" ? 1.3 : 0.7));
    }
  } else if (["voronoi", "stone"].includes(kind)) {
    const pts: Ring = [];
    for (let y = -h / 2 - pitch; y <= h / 2 + pitch; y += pitch)
      for (let x = -w / 2 - pitch; x <= w / 2 + pitch; x += pitch)
        pts.push([
          x + (random() - 0.5) * pitch * 0.8,
          y + (random() - 0.5) * pitch * 0.8,
        ]);
    for (const [x, y] of pts) {
      let poly: Ring = [
        [-w / 2 - pitch, -h / 2 - pitch],
        [w / 2 + pitch, -h / 2 - pitch],
        [w / 2 + pitch, h / 2 + pitch],
        [-w / 2 - pitch, h / 2 + pitch],
      ];
      for (const [xx, yy] of pts) {
        if ((x === xx && y === yy) || Math.hypot(xx - x, yy - y) > pitch * 3)
          continue;
        const nx = xx - x,
          ny = yy - y,
          c = (xx * xx + yy * yy - x * x - y * y) / 2,
          out: Ring = [];
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i],
            d = poly[(i + 1) % poly.length],
            da = a[0] * nx + a[1] * ny - c,
            dd = d[0] * nx + d[1] * ny - c;
          if (da <= 0) out.push(a);
          if ((da < 0 && dd > 0) || (da > 0 && dd < 0)) {
            const t = da / (da - dd);
            out.push([a[0] + t * (d[0] - a[0]), a[1] + t * (d[1] - a[1])]);
          }
        }
        poly = out;
        if (!poly.length) break;
      }
      if (poly.length >= 3) {
        const cell = b.cs([poly]);
        shapes.push(
          kind === "stone"
            ? b.offset(cell, -0.7)
            : b.cut2(cell, b.offset(cell, -0.7)),
        );
      }
    }
  } else {
    let row = 0;
    for (
      let y = -h / 2 - pitch;
      y <= h / 2 + pitch;
      y += kind === "honeycomb" ? pitch * 0.86 : pitch
    ) {
      row++;
      for (let x = -w / 2 - pitch; x <= w / 2 + pitch; x += pitch) {
        let sec: CrossSection;
        const xx =
          x +
          (["brick", "honeycomb", "cobble"].includes(kind) && row % 2
            ? pitch / 2
            : 0);
        if (kind === "heart" || kind === "star")
          sec = b.outline(pitch * 0.7, pitch * 0.7, kind);
        else if (kind === "leaf")
          sec = b.track(
            b
              .circle(pitch * 0.35, 24)
              .scale([1, 0.45])
              .rotate(30),
          );
        else if (kind === "dots" || kind === "bubbles")
          sec = b.circle(
            pitch * (kind === "dots" ? 0.18 : 0.1 + random() * 0.28),
            24,
          );
        else if (kind === "brick")
          sec = b.cut2(
            b.rect(pitch * 0.95, pitch * 0.9, 0.5),
            b.rect(pitch * 0.95 - 1.2, pitch * 0.9 - 1.2, 0.3),
          );
        else if (kind === "cobble")
          sec = b.rect(
            pitch * (0.55 + random() * 0.35),
            pitch * (0.55 + random() * 0.35),
            pitch * 0.22,
          );
        else if (kind === "tiles")
          sec = b.cut2(
            b.rect(pitch * 0.85, pitch * 0.85, 0.2),
            b.rect(pitch * 0.85 - 1.2, pitch * 0.85 - 1.2, 0.2),
          );
        else if (kind === "diamonds")
          sec = b.track(b.rect(pitch * 0.6, pitch * 0.6, 0.5).rotate(45));
        else if (kind === "weave" || kind === "herringbone")
          sec = b.track(
            b
              .rect(pitch * 0.85, pitch * 0.25, 0.2)
              .rotate(
                kind === "weave"
                  ? (row + Math.round(x / pitch)) % 2
                    ? 90
                    : 0
                  : (row + Math.round(x / pitch)) % 2
                    ? 45
                    : -45,
              ),
          );
        else {
          const hex = b.track(b.api.CrossSection.circle(pitch * 0.56, 6));
          sec = b.cut2(hex, b.offset(hex, -0.7));
        }
        shapes.push(b.move(sec, xx, y));
      }
    }
  }
  let result = b.union2(shapes);
  if (b.n("patternAngle")) result = b.track(result.rotate(b.n("patternAngle")));
  return b.and2(result, b.rect(w, h));
}
