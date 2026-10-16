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
    const glyphs: CrossSection[] = [];
    for (let row = 0; row < lines.length; row++) {
      const characters = Array.from(lines[row]);
      let cursor = 0;
      const outlines: { shapes: THREE.Shape[]; x: number }[] = [];
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
        outlines.push({ shapes, x: cursor });
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
      const transform = (p: THREE.Vector2, x: number): [number, number] => {
        const nx = ((x + p.x - bounds.min.x) / total) * 2 - 1;
        return fitWavyPoint(
          nx,
          (p.y - bounds.min.y) / glyphH,
          row,
          lines.length,
          c,
        );
      };
      for (const { shapes, x } of outlines)
        for (const shape of shapes) {
          const paths = [shape, ...shape.holes].map((path, index) => {
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
            const pts = dense.map((p) => transform(p, x));
            const area = THREE.ShapeUtils.area(
              pts.map((p) => new THREE.Vector2(...p)),
            );
            if ((index === 0 && area < 0) || (index > 0 && area > 0))
              pts.reverse();
            return pts;
          });
          glyphs.push(section(new api.CrossSection(paths, "NonZero")));
        }
    }
    const circle = section(
      api.CrossSection.circle(c.diameter / 2, detail * 12),
    );
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
