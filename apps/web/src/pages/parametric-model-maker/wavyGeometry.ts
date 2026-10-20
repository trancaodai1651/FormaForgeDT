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
import {
  configFromValues,
  type ParameterValue,
  type PartMesh,
  type WavyConfig,
} from "./model";
import { warpWavyColumn, wavyRowWidth } from "./wavyLayout";
import { wavyKeyring } from "./keyring";
import { smoothTextSolid } from "./smoothText";

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
export async function loadMakerFont(id: string, base: string) {
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
  c = configFromValues(c as unknown as Record<string, ParameterValue>);
  const api =
    runtime ??
    (await (apiPromise ??= Module({ locateFile: () => wasmUrl }).then((m) => {
      m.setup();
      return m;
    })));
  const font = await loadMakerFont(c.font, base);
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
    const detail = c.quality === "Fine" ? 48 : c.quality === "Fast" ? 12 : 24;
    const slices = c.quality === "Fine" ? 96 : c.quality === "Fast" ? 24 : 48;
    const circleSegments = c.smoothEdges
      ? c.quality === "Fine"
        ? 512
        : c.quality === "Fast"
          ? 128
          : 256
      : c.quality === "Fine"
        ? 240
        : c.quality === "Fast"
          ? 64
          : 120;
    const lines = [c.line1, c.line2, c.line3].slice(0, c.layout);
    if (!lines.some((t) => t.trim()))
      throw new Error("Nhập ít nhất một dòng chữ.");
    const rowSections: CrossSection[] = [];
    for (let row = 0; row < lines.length; row++) {
      const characters = Array.from(lines[row]);
      const weight = (ch: string) => (/\s/.test(ch) ? c.wordSpace / 100 : 1);
      const units = characters.reduce((sum, ch) => sum + weight(ch), 0);
      if (!units) continue;
      const width = wavyRowWidth(row, lines.length, c);
      const cellWidth = width / units;
      const rowSlices: CrossSection[] = [];
      let left = -width / 2;
      for (const ch of characters) {
        const advance = cellWidth * weight(ch);
        if (/\s/.test(ch)) {
          left += advance;
          continue;
        }
        const glyph = font.data.glyphs[ch];
        if (!glyph)
          throw new Error(
            `Phông này chưa có ký tự “${ch}”. Hãy chọn phông hỗ trợ ký tự đó trong thư viện.`,
          );
        const center = left + cellWidth / 2;
        // Native font advance centers each glyph in its own cell. Wider glyphs
        // meet the cell wall; fitting the whole word's ink produces a different model.
        const fontScale = (cellWidth * 0.01368 * c.glyphWidth) / 100;
        const paths = font.generateShapes(ch, 100).flatMap((shape) =>
          [shape, ...shape.holes].map((path, index) => {
            const raw = path.getPoints(c.smoothEdges ? detail : detail / 2);
            const dense: THREE.Vector2[] = [];
            for (let i = 0; i < raw.length - 1; i++) {
              const count = c.smoothEdges
                ? Math.max(
                    1,
                    Math.ceil(
                      (Math.abs(raw[i + 1].x - raw[i].x) * fontScale) /
                        (c.quality === "Fine"
                          ? 0.04
                          : c.quality === "Fast"
                            ? 0.15
                            : 0.08),
                    ),
                  )
                : 1;
              for (let j = 0; j < count; j++)
                dense.push(raw[i].clone().lerp(raw[i + 1], j / count));
            }
            dense.push(raw[raw.length - 1]);
            const points = dense.map(
              (p) =>
                [center + (p.x - glyph.ha / 20) * fontScale, p.y] as [
                  number,
                  number,
                ],
            );
            const area = THREE.ShapeUtils.area(
              points.map((p) => new THREE.Vector2(...p)),
            );
            if ((index === 0 && area < 0) || (index > 0 && area > 0))
              points.reverse();
            return points;
          }),
        );
        const source = section(new api.CrossSection(paths, "NonZero"));
        const gap = c.letterSpacing - 0.15;
        if (c.smoothEdges) {
          const clip = section(
            new api.CrossSection([
              [
                [left + gap / 2 - 0.003, -500],
                [left + cellWidth - gap / 2 + 0.003, -500],
                [left + cellWidth - gap / 2 + 0.003, 500],
                [left + gap / 2 - 0.003, 500],
              ],
            ]),
          );
          rowSlices.push(
            section(
              section(source.intersect(clip)).warp((p) => {
                p[1] = warpWavyColumn(p[0], p[1], row, lines.length, c)[1];
              }),
            ),
          );
          left += advance;
          continue;
        }
        for (let i = 0; i < slices; i++) {
          const cellLeft = left + gap / 2;
          const cellRight = left + cellWidth - gap / 2;
          const x0 =
            i === 0
              ? cellLeft
              : Math.max(left + (i * cellWidth) / slices, cellLeft);
          const x1 =
            i === slices - 1
              ? cellRight
              : Math.min(left + ((i + 1) * cellWidth) / slices, cellRight);
          if (x1 <= x0) continue;
          // Neighbouring strips overlap by 0.006 mm, as measured in the reference.
          const clip = section(
            new api.CrossSection([
              [
                [x0 - 0.003, -500],
                [x1 + 0.003, -500],
                [x1 + 0.003, 500],
                [x0 - 0.003, 500],
              ],
            ]),
          );
          const strip = section(source.intersect(clip));
          if (strip.isEmpty()) continue;
          const sampleX = (x0 + x1) / 2;
          rowSlices.push(
            section(
              strip.warp((p) => {
                p[1] = warpWavyColumn(sampleX, p[1], row, lines.length, c)[1];
              }),
            ),
          );
        }
        left += advance;
      }
      if (rowSlices.length)
        rowSections.push(section(api.CrossSection.union(rowSlices)));
    }
    const circle = section(
      api.CrossSection.circle(c.diameter / 2, circleSegments),
    );
    const glyphs = rowSections.filter((row): row is CrossSection => !!row);
    if (!glyphs.length) throw new Error("Không có đường nét chữ để dựng.");
    const rawTextSection = section(
      section(api.CrossSection.union(glyphs)).intersect(circle),
    );
    // Strip intersections can leave numerical specks much smaller than an extrusion line.
    const islands = rawTextSection.decompose().map(section);
    let textSection = section(
      api.CrossSection.union(islands.filter((s) => s.area() > 0.0001)),
    );
    if (c.smoothEdges && c.cornerRadius > 0.001) {
      const inner = section(
        textSection.offset(-c.cornerRadius, "Round", 2, 32),
      );
      if (!inner.isEmpty())
        textSection = section(
          section(inner.offset(c.cornerRadius, "Round", 2, 32)).intersect(
            circle,
          ),
        );
    }
    if (c.smoothEdges)
      textSection = section(
        textSection.simplify(
          c.quality === "Fine" ? 0.001 : c.quality === "Fast" ? 0.008 : 0.003,
        ),
      );
    const embed = Math.min(c.textEmbed, Math.max(0, c.baseDepth - 0.2));
    const round = Math.min(c.edgeRound, c.textHeight * 0.45);
    const textBottom = c.baseDepth - embed;
    let text = c.smoothEdges
      ? keep(
          smoothTextSolid(
            api,
            textSection,
            c.textHeight + embed,
            round,
            c.quality === "Fine" ? 24 : c.quality === "Fast" ? 8 : 16,
          ),
        )
      : keep(textSection.extrude(c.textHeight + embed - round));
    if (!c.smoothEdges && round > 0.001) {
      // The supplied model uses overlapping offset layers, rather than a smooth
      // Three.js bevel. Sample the circular round at each layer's midpoint.
      const levels = c.quality === "Fine" ? 10 : c.quality === "Fast" ? 3 : 5;
      const step = round / levels;
      const layers = [text];
      for (let i = 0; i < levels; i++) {
        const t = (i + 0.5) / levels;
        const inset = round * (1 - Math.sqrt(1 - t * t));
        const contour = section(textSection.offset(-inset, "Miter", 2));
        if (!contour.isEmpty())
          layers.push(
            keep(
              keep(contour.extrude(step + 0.005)).translate([
                0,
                0,
                c.textHeight + embed - round + i * step,
              ]),
            ),
          );
      }
      text = keep(api.Manifold.union(layers));
    }
    text = keep(text.translate([0, 0, textBottom]));
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
      let base = keep(circle.extrude(c.baseDepth));
      const ring = wavyKeyring(api, circle, c);
      if (ring) base = keep(base.add(keep(ring)));
      outputPart("Nền tròn", keep(base.subtract(text)), c.baseColor, "base");
    } else if (c.keychainEnabled)
      throw new Error(
        "Móc khóa cần có nền. Hãy tăng Độ dày nền trước khi gắn móc.",
      );
    outputPart("Chữ nổi", text, c.textColor, "text");
    return output;
  } finally {
    for (const s of solids.reverse()) s.delete();
    for (const s of sections.reverse()) s.delete();
  }
}
