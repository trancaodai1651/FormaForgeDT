/// <reference types="vite/client" />
import * as THREE from "three";
import {
  FontLoader,
  type Font,
} from "three/examples/jsm/loaders/FontLoader.js";
import { TTFLoader } from "three/examples/jsm/loaders/TTFLoader.js";
import Module, {
  type Manifold,
  type CrossSection,
  type ManifoldToplevel,
} from "manifold-3d";
import wasmUrl from "manifold-3d/manifold.wasm?url";
import type { PartMesh, WavyConfig } from "./model";
import { fitWavyPoint } from "./wavyLayout";

export function packWavyRows(
  sourceRows: (CrossSection | undefined)[],
  config: WavyConfig,
  track: (section: CrossSection) => CrossSection,
): CrossSection[] {
  const active = sourceRows.flatMap((row, index) =>
    row ? [{ index, row }] : [],
  );
  if (active.length === 0) return [];

  // `margin` already insets each curved row's path in fitWavyPoint. Keep only
  // a small manufacturing clearance here instead of subtracting it twice.
  const safeRadius = Math.max(0.1, config.diameter / 2 - 0.25);
  const rowsAtScale = (sizeScale: number) =>
    active.map(({ row }) => {
      if (sizeScale === 1) return row;
      const bounds = row.bounds();
      const centerX = (bounds.min[0] + bounds.max[0]) / 2;
      const centerY = (bounds.min[1] + bounds.max[1]) / 2;
      const centered = row.translate(-centerX, -centerY);
      const resized = centered.scale(sizeScale);
      const restored = resized.translate(centerX, centerY);
      centered.delete();
      resized.delete();
      return track(restored);
    });
  const pack = (placed: CrossSection[]) => {
    const shifts = placed.map(() => 0);
    const intersectionArea = (i: number, j: number, delta = 0) => {
      const upper = placed[i].translate(0, delta / 2 + shifts[i]);
      const lower = placed[j].translate(0, -delta / 2 + shifts[j]);
      const overlap = upper.intersect(lower);
      const area = overlap.area();
      overlap.delete();
      upper.delete();
      lower.delete();
      return area;
    };

    for (let pass = 0; pass < 32; pass++) {
      let foundOverlap = false;
      for (let i = 0; i < placed.length - 1; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          if (intersectionArea(i, j) <= 1e-5) continue;
          foundOverlap = true;

          const upperBounds = placed[i].bounds();
          const lowerBounds = placed[j].bounds();
          const maxShift = Math.max(
            0.25,
            lowerBounds.max[1] +
              shifts[j] -
              upperBounds.min[1] -
              shifts[i] +
              0.05,
          );
          let low = 0;
          let high = maxShift;
          for (let iteration = 0; iteration < 14; iteration++) {
            const middle = (low + high) / 2;
            if (intersectionArea(i, j, middle) > 1e-5) low = middle;
            else high = middle;
          }
          const clearance = high + 0.03;
          shifts[i] += clearance / 2;
          shifts[j] -= clearance / 2;
        }
      }
      if (!foundOverlap) break;
    }

    for (let i = 0; i < placed.length - 1; i++)
      for (let j = i + 1; j < placed.length; j++)
        if (intersectionArea(i, j) > 1e-5)
          throw new Error("Không thể tách các hàng chữ mà không giao nhau.");

    const separated = placed.map((row, index) =>
      shifts[index] ? track(row.translate(0, shifts[index])) : row,
    );
    let maxRadius = 0;
    for (const row of separated)
      for (const polygon of row.toPolygons())
        for (const [x, y] of polygon)
          maxRadius = Math.max(maxRadius, Math.hypot(x, y));
    return { separated, maxRadius };
  };

  const initial = pack(rowsAtScale(1));
  if (initial.maxRadius <= safeRadius + 1e-4) return initial.separated;

  let low = 0.001;
  let high = 1;
  let best = pack(rowsAtScale(low));
  if (best.maxRadius > safeRadius + 1e-4)
    throw new Error("Không thể căn chữ vào đường kính nền đã chọn.");
  for (let iteration = 0; iteration < 16; iteration++) {
    const middle = (low + high) / 2;
    const candidate = pack(rowsAtScale(middle));
    if (candidate.maxRadius <= safeRadius + 1e-4) {
      low = middle;
      best = candidate;
    } else high = middle;
  }
  return best.separated;
}

let apiPromise: Promise<ManifoldToplevel> | undefined;
const fonts = new Map<string, Promise<Font>>();
const fontNames = new Map<string, string>();
export const assetBase = () =>
  `${import.meta.env.BASE_URL}parametric-maker-assets/`;
export function registerMakerFont(id: string, data: Uint8Array) {
  const font = new FontLoader().parse(
    new TTFLoader().parse(new Uint8Array(data).buffer),
  );
  fonts.set(id, Promise.resolve(font));
  const names = font.data.original_font_information as unknown as Record<
    string,
    Record<string, string>
  >;
  const family = names.fontFamily?.en ?? font.data.familyName;
  const style = names.fontSubfamily?.en;
  const pattern = style ? `${family}:style=${style}` : family;
  fontNames.set(id, pattern);
  return pattern;
}
export function makerFontName(id: string) {
  return fontNames.get(id);
}
async function loadFont(id: string, base: string) {
  if (!fonts.has(id))
    fonts.set(
      id,
      (async () => {
        const r = await fetch(`${base}fonts/${id}.ttf`);
        if (!r.ok)
          throw new Error(
            "Không tải được phông chữ. Hãy kiểm tra kết nối hoặc nhập TTF.",
          );
        return new FontLoader().parse(
          new TTFLoader().parse(await r.arrayBuffer()),
        );
      })(),
    );
  return fonts.get(id)!;
}
export async function buildWavy(
  c: WavyConfig,
  runtime?: ManifoldToplevel,
  base = assetBase(),
): Promise<PartMesh[]> {
  const api =
    runtime ??
    (await (apiPromise ??= Module({ locateFile: () => wasmUrl }).then((m) => {
      m.setup();
      return m;
    })));
  const font = await loadFont(c.font, base);
  const solids: Manifold[] = [];
  const sections: CrossSection[] = [];
  const keep = (s: Manifold) => {
    solids.push(s);
    return s;
  };
  const section = (s: CrossSection) => {
    sections.push(s);
    return s;
  };
  try {
    const detail = c.quality === "Fine" ? 24 : c.quality === "Fast" ? 6 : 12;
    const lines = [c.line1, c.line2, c.line3].slice(0, c.layout);
    if (!lines.some((t) => t.trim()))
      throw new Error("Nhập ít nhất một dòng chữ.");
    const rowSections: (CrossSection | undefined)[] = [];
    for (let row = 0; row < lines.length; row++) {
      const characters = Array.from(lines[row]);
      const rowGlyphs: CrossSection[] = [];
      let cursor = 0;
      const outlines: {
        shapes: THREE.Shape[];
        x: number;
        centerX: number;
      }[] = [];
      const bounds = new THREE.Box2();
      for (const ch of characters) {
        if (/\s/.test(ch)) {
          cursor += (100 * c.wordSpace) / 100;
          continue;
        }
        if (!font.data.glyphs[ch])
          throw new Error(
            `Phông này chưa có ký tự “${ch}”. Hãy chọn phông hỗ trợ ký tự đó trong thư viện.`,
          );
        const shapes = font.generateShapes(ch, 100);
        const glyphBounds = new THREE.Box2();
        for (const s of shapes)
          for (const p of s.getPoints(detail))
            glyphBounds.expandByPoint(p);
        outlines.push({
          shapes,
          x: cursor,
          centerX: cursor + (glyphBounds.min.x + glyphBounds.max.x) / 2,
        });
        for (const s of shapes)
          for (const p of s.getPoints(detail))
            bounds.expandByPoint(new THREE.Vector2(cursor + p.x, p.y));
        const glyph = font.data.glyphs[ch] ?? font.data.glyphs["?"];
        cursor +=
          ((glyph?.ha ?? 600) / font.data.resolution) * 100 +
          c.letterSpacing * 6;
      }
      if (!outlines.length) continue;
      const total = Math.max(1, bounds.max.x - bounds.min.x);
      const glyphH = Math.max(1, bounds.max.y - bounds.min.y);
      const flatConfig = { ...c, roundWarp: 0, wavy: false };
      for (const { shapes, x, centerX } of outlines) {
        const centerNx = ((centerX - bounds.min.x) / total) * 2 - 1;
        const flatAnchor = fitWavyPoint(
          centerNx,
          0.5,
          row,
          lines.length,
          flatConfig,
        );
        // Keep the original spacing between glyph centers. Compressing only
        // the anchors makes neighboring chunky letters collide after rotation.
        const anchorNx = centerNx;
        const anchor = fitWavyPoint(anchorNx, 0.5, row, lines.length, c);
        const tangentStep = 0.002;
        const before = fitWavyPoint(
          anchorNx - tangentStep,
          0.5,
          row,
          lines.length,
          c,
        );
        const after = fitWavyPoint(
          anchorNx + tangentStep,
          0.5,
          row,
          lines.length,
          c,
        );
        const angle = Math.atan2(after[1] - before[1], after[0] - before[0]);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const transformGlyphPoint = (p: THREE.Vector2) => {
          const nx = ((x + p.x - bounds.min.x) / total) * 2 - 1;
          const v = (p.y - bounds.min.y) / glyphH;
          const flatPoint = fitWavyPoint(
            nx,
            v,
            row,
            lines.length,
            flatConfig,
          );
          const dx = flatPoint[0] - flatAnchor[0];
          const dy = flatPoint[1] - flatAnchor[1];
          return [
            anchor[0] + dx * cos - dy * sin,
            anchor[1] + dx * sin + dy * cos,
          ] as [number, number];
        };
        const glyphPaths = shapes.map((shape) =>
          [shape, ...shape.holes].map((path, index) => {
            // Split straight segments too: circular warping is nonlinear even on a straight glyph edge.
            const raw = path.getPoints(detail);
            const dense: THREE.Vector2[] = [];
            for (let i = 0; i < raw.length - 1; i++) {
              const count = Math.max(
                1,
                Math.ceil(
                  raw[i].distanceTo(raw[i + 1]) /
                    (c.quality === "Fine" ? 2 : c.quality === "Fast" ? 8 : 4),
                ),
              );
              for (let j = 0; j < count; j++)
                dense.push(raw[i].clone().lerp(raw[i + 1], j / count));
            }
            dense.push(raw[raw.length - 1]);
            const pts = dense.map(transformGlyphPoint);
            const area = THREE.ShapeUtils.area(
              pts.map((p) => new THREE.Vector2(...p)),
            );
            if ((index === 0 && area < 0) || (index > 0 && area > 0))
              pts.reverse();
            return pts;
          }),
        );
        for (const paths of glyphPaths) {
          rowGlyphs.push(section(new api.CrossSection(paths, "NonZero")));
        }
      }
      if (rowGlyphs.length) {
        const rowSection = section(api.CrossSection.union(rowGlyphs));
        const rowBounds = rowSection.bounds();
        // Tangential rotation changes each glyph's silhouette. Recenter the
        // finished row after rotation so asymmetric glyphs cannot shift a line.
        const centeredRow = section(
          rowSection.translate(-((rowBounds.min[0] + rowBounds.max[0]) / 2), 0),
        );
        rowSections[row] = centeredRow;
      }
    }
    const circle = section(
      api.CrossSection.circle(c.diameter / 2, detail * 12),
    );
    const glyphs = packWavyRows(rowSections, c, section);
    if (!glyphs.length) throw new Error("Không có đường nét chữ để dựng.");
    const textSection = section(
      section(api.CrossSection.union(glyphs)).intersect(circle),
    );
    let text = keep(textSection.extrude(c.textHeight));
    const round = Math.min(c.edgeRound, c.textHeight * 0.45);
    if (round > 0.001) {
      const inset = section(textSection.offset(-round, "Round", 2, detail * 4));
      if (!inset.isEmpty()) {
        const path = new THREE.ShapePath();
        for (const ring of inset.toPolygons()) {
          const points = [...ring].reverse();
          path.moveTo(...points[0]);
          for (const p of points.slice(1)) path.lineTo(...p);
          path.currentPath!.closePath();
        }
        const geometry = new THREE.ExtrudeGeometry(path.toShapes(false), {
          depth: c.textHeight - 2 * round,
          steps: 1,
          bevelEnabled: true,
          bevelSize: round,
          bevelThickness: round,
          bevelSegments: detail,
          curveSegments: detail,
        });
        geometry.translate(0, 0, round);
        const mesh = new api.Mesh({
          numProp: 3,
          vertProperties: new Float32Array(
            geometry.getAttribute("position").array,
          ),
          triVerts: Uint32Array.from(
            { length: geometry.getAttribute("position").count },
            (_, i) => i,
          ),
        });
        mesh.merge();
        const rounded = keep(new api.Manifold(mesh));
        geometry.dispose();
        text = keep(
          keep(textSection.extrude(c.textHeight - round)).add(rounded),
        );
      }
    }
    // Bevel offsets can overshoot the circular outline at sampled corners.
    text = keep(text.intersect(keep(circle.extrude(c.textHeight))));
    const embed = Math.min(c.textEmbed, Math.max(0, c.baseDepth - 0.2));
    text = keep(text.translate([0, 0, c.baseDepth - embed]));
    const output: PartMesh[] = [];
    const outputPart = (
      name: string,
      solid: Manifold,
      color: string,
      role: PartMesh["role"],
    ) => {
      if (solid.isEmpty()) return;
      const mesh = solid.getMesh();
      const vertices = new Float32Array(mesh.numVert * 3);
      for (let i = 0; i < mesh.numVert; i++)
        for (let j = 0; j < 3; j++)
          vertices[i * 3 + j] = mesh.vertProperties[i * mesh.numProp + j];
      output.push({
        name,
        color,
        role,
        vertices,
        indices: new Uint32Array(mesh.triVerts),
      });
    };
    if (c.baseDepth > 0) {
      const base = keep(circle.extrude(c.baseDepth));
      outputPart("Nền tròn", keep(base.subtract(text)), c.baseColor, "base");
    }
    outputPart("Chữ nổi", text, c.textColor, "text");
    return output;
  } finally {
    for (const s of solids.reverse()) s.delete();
    for (const s of sections.reverse()) s.delete();
  }
}
