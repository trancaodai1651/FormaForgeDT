import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { Mesh, Color } from "three";
import { processImage } from "../../clicker/image/pipeline";
import type { RgbaImage } from "../../clicker/image/decode";
import type { Artwork, Ring } from "./model";
import type { PartMesh } from "../parametric-model-maker/model";
export type ImageOptions = {
  colors: number;
  removeBg: boolean;
  smoothing: number;
  brightness: number;
  contrast: number;
  saturation: number;
  noise: number;
  cropRadius: number;
  threshold: number;
  crop: [number, number, number, number];
  cropShape: "rectangle" | "ellipse" | "circle";
  rotation: number;
  flip: boolean;
  flipY?: boolean;
};
export const IMAGE_DEFAULTS: ImageOptions = {
  colors: 5,
  removeBg: true,
  smoothing: 0.5,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  noise: 10,
  cropRadius: 0,
  threshold: 0,
  crop: [0, 0, 100, 100],
  cropShape: "rectangle",
  rotation: 0,
  flip: false,
  flipY: false,
};
export function safeSvg(source: string) {
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  if (
    doc.querySelector("parsererror") ||
    doc.documentElement.localName !== "svg"
  )
    throw new Error("SVG_INVALID");
  if (doc.querySelectorAll("*").length > 20000)
    throw new Error("SVG_TOO_LARGE");
  for (const el of doc.querySelectorAll("*")) {
    if (
      [
        "script",
        "foreignObject",
        "iframe",
        "image",
        "use",
        "style",
        "animate",
        "set",
        "audio",
        "video",
      ].includes(el.localName)
    ) {
      el.remove();
      continue;
    }
    for (const a of Array.from(el.attributes))
      if (
        /^on/i.test(a.name) ||
        /href/i.test(a.name) ||
        /url\s*\(/i.test(a.value)
      )
        el.removeAttribute(a.name);
  }
  return new XMLSerializer().serializeToString(doc);
}
const emptyArt = (name: string): Artwork => ({
  id: crypto.randomUUID(),
  name,
  regions: [],
  size: 35,
  x: 0,
  y: 0,
  angle: 0,
  style: "raised",
  rise: 1,
  depth: 0.8,
  mirror: false,
  side: "front",
});
export function svgArtwork(source: string, name: string): Artwork {
  const art = emptyArt(name),
    safe = safeSvg(source),
    data = new SVGLoader().parse(safe),
    all: Ring[] = [];
  art.source = safe;
  for (const path of data.paths) {
    const rings: Ring[] = [];
    if (path.userData?.style?.stroke && path.userData.style.stroke !== "none") {
      const strokes: Ring[] = [];
      for (const sub of path.subPaths) {
        const geometry = SVGLoader.pointsToStroke(
          sub.getPoints(64),
          path.userData.style,
          12,
        );
        if (!geometry) continue;
        const p = geometry.getAttribute("position");
        for (let i = 0; i < p.count; i += 3)
          strokes.push([
            [p.getX(i), -p.getY(i)],
            [p.getX(i + 1), -p.getY(i + 1)],
            [p.getX(i + 2), -p.getY(i + 2)],
          ]);
        geometry.dispose();
      }
      if (strokes.length) {
        all.push(...strokes);
        art.regions.push({
          id: crypto.randomUUID(),
          color: "#" + new Color(path.userData.style.stroke).getHexString(),
          rings: strokes,
          height: 1,
          enabled: true,
        });
      }
    }
    if (path.userData?.style?.fill === "none") continue;
    for (const shape of SVGLoader.createShapes(path)) {
      const p = shape.extractPoints(24);
      rings.push(
        p.shape.map((v) => [v.x, -v.y]),
        ...p.holes.map((h) => h.map((v) => [v.x, -v.y] as [number, number])),
      );
    }
    if (rings.length) {
      all.push(...rings);
      art.regions.push({
        id: crypto.randomUUID(),
        color: "#" + path.color.getHexString(),
        rings,
        height: 1,
        enabled: true,
      });
    }
  }
  if (!all.length) throw new Error("SVG_EMPTY");
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const r of all)
    for (const [x, y] of r) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  const size = Math.max(maxX - minX, maxY - minY);
  for (const r of all)
    for (const p of r) {
      p[0] = (p[0] - (minX + maxX) / 2) / size;
      p[1] = (p[1] - (minY + maxY) / 2) / size;
    }
  return art;
}
export async function rasterPixels(
  file: File,
  options = IMAGE_DEFAULTS,
): Promise<RgbaImage> {
  const image = await createImageBitmap(file),
    [x, y, w, h] = options.crop.map(
      (p, i) => (p / 100) * (i % 2 ? image.height : image.width),
    );
  const ratio = Math.min(1, 1000 / Math.max(w, h)),
    source = document.createElement("canvas");
  source.width = Math.max(1, Math.round(w * ratio));
  source.height = Math.max(1, Math.round(h * ratio));
  const context = source.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, x, y, w, h, 0, 0, source.width, source.height);
  image.close();
  const canvas = document.createElement("canvas"),
    angle = (options.rotation * Math.PI) / 180;
  canvas.width = Math.ceil(
    Math.abs(source.width * Math.cos(angle)) +
      Math.abs(source.height * Math.sin(angle)),
  );
  canvas.height = Math.ceil(
    Math.abs(source.width * Math.sin(angle)) +
      Math.abs(source.height * Math.cos(angle)),
  );
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(angle);
  ctx.scale(options.flip ? -1 : 1, options.flipY ? -1 : 1);
  if (options.cropShape !== "rectangle") {
    ctx.beginPath();
    const rx =
        options.cropShape === "circle"
          ? Math.min(source.width, source.height) / 2
          : source.width / 2,
      ry = options.cropShape === "circle" ? rx : source.height / 2;
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();
  } else if (options.cropRadius > 0) {
    ctx.beginPath();
    ctx.roundRect(
      -source.width / 2,
      -source.height / 2,
      source.width,
      source.height,
      (Math.min(source.width, source.height) * options.cropRadius) / 100,
    );
    ctx.clip();
  }
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  const out = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < out.data.length; i += 4) {
    const lum =
      out.data[i] * 0.299 + out.data[i + 1] * 0.587 + out.data[i + 2] * 0.114;
    for (let k = 0; k < 3; k++)
      out.data[i + k] = Math.max(
        0,
        Math.min(
          255,
          ((lum + (out.data[i + k] - lum) * options.saturation) *
            options.brightness -
            128) *
            options.contrast +
            128,
        ),
      );
    if (options.threshold) {
      const gray =
        out.data[i] * 0.299 +
          out.data[i + 1] * 0.587 +
          out.data[i + 2] * 0.114 >
        options.threshold
          ? 255
          : 0;
      out.data[i] = out.data[i + 1] = out.data[i + 2] = gray;
    }
  }
  return { width: canvas.width, height: canvas.height, data: out.data };
}
export async function rasterArtwork(
  file: File,
  options: ImageOptions,
): Promise<Artwork> {
  const image = await rasterPixels(file, options),
    regions = processImage(image, options.colors, {
      removeBg: options.removeBg,
      smoothing: options.smoothing,
      preserveDetail: true,
      preserveDistinctColors: true,
    });
  const art = emptyArt(file.name);
  art.processing = structuredClone(options);
  art.regions = regions.regions
    .flatMap((r) =>
      r.components
        .filter((c) => c.coverage * image.width * image.height >= options.noise)
        .map((c) => ({
          id: crypto.randomUUID(),
          color:
            "#" +
            r.quantRgb.map((n) => n.toString(16).padStart(2, "0")).join(""),
          rings: c.rings,
          height: 1,
          enabled: true,
        })),
    )
    .slice(0, 512);
  if (!art.regions.length) throw new Error("IMAGE_EMPTY");
  return art;
}
export function artSvg(art: Artwork) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-.5 -.5 1 1"><g transform="scale(1,-1)">${art.regions
    .filter((r) => r.enabled)
    .map(
      (r) =>
        `<path fill="${/^#[0-9a-f]{6}$/i.test(r.color) ? r.color : "#000000"}" fill-rule="evenodd" d="${r.rings.map((r) => "M" + r.map((p) => p.join(",")).join("L") + "Z").join("")}"/>`,
    )
    .join("")}</g></svg>`;
}
export async function importModel(file: File): Promise<PartMesh[]> {
  const data = await file.arrayBuffer();
  if (data.byteLength > 60 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
  const result: PartMesh[] = [];
  if (/\.stl$/i.test(file.name)) {
    const geometry = new STLLoader().parse(data),
      position = geometry.getAttribute("position");
    result.push({
      name: file.name,
      color: "#A8B6C8",
      role: "model",
      vertices: new Float32Array(position.array),
      indices: geometry.index
        ? new Uint32Array(geometry.index.array)
        : Uint32Array.from({ length: position.count }, (_, i) => i),
    });
    geometry.dispose();
  } else if (/\.3mf$/i.test(file.name)) {
    const group = new ThreeMFLoader().parse(data);
    group.updateMatrixWorld(true);
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const g = object.geometry.clone().applyMatrix4(object.matrixWorld),
        pos = g.getAttribute("position"),
        material = Array.isArray(object.material)
          ? object.material[0]
          : object.material;
      const color =
        "color" in material
          ? (material.color as Color).getHexString()
          : "A8B6C8";
      result.push({
        name: object.name || file.name,
        color: "#" + color,
        role: "model",
        vertices: new Float32Array(pos.array),
        indices: g.index
          ? new Uint32Array(g.index.array)
          : Uint32Array.from({ length: pos.count }, (_, i) => i),
      });
      g.dispose();
    });
  } else throw new Error("MODEL_FORMAT");
  if (!result.length) throw new Error("EMPTY_GEOMETRY");
  return result;
}
export const STARTER_ART: { name: readonly [string, string]; svg: string }[] = [
  {
    name: ["Heart", "Trái tim"] as const,
    svg: '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#E83D71" d="M0 25 C-35 0 -22 -24 0 -7 C22 -24 35 0 0 25Z"/></svg>',
  },
  {
    name: ["Star", "Ngôi sao"] as const,
    svg: '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#F4C542" d="M0 -24 L6 -7 L24 -7 L10 4 L15 23 L0 12 L-15 23 L-10 4 L-24 -7 L-6 -7 Z"/></svg>',
  },
  {
    name: ["Leaf", "Lá cây"] as const,
    svg: '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#2BA85E" d="M-20 20 Q-30 -24 22 -22 Q26 26 -20 20Z"/></svg>',
  },
];
const graphic = (name: readonly [string, string], body: string) => ({
  name,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -30 60 60">${body}</svg>`,
});
STARTER_ART.push(
  graphic(["Circle", "Hình tròn"], '<circle r="24" fill="#356CD1"/>'),
  graphic(
    ["Paw", "Chân thú cưng"],
    '<ellipse cy="9" rx="15" ry="13" fill="#D39A64"/><g fill="#D39A64"><ellipse cx="-20" cy="-7" rx="6" ry="9"/><ellipse cx="-8" cy="-17" rx="6" ry="9"/><ellipse cx="8" cy="-17" rx="6" ry="9"/><ellipse cx="20" cy="-7" rx="6" ry="9"/></g>',
  ),
  graphic(
    ["Lightning", "Tia chớp"],
    '<path fill="#F4C542" d="M3 -28 L-22 4 H-4 L-9 28 L24 -8 H6 Z"/>',
  ),
  graphic(
    ["Shield", "Khiên"],
    '<path fill="#356CD1" d="M-23 -23H23V-2Q22 14 0 28Q-22 14-23-2Z"/><path fill="#FFFFFF" d="M-14 -14H14V-2Q13 8 0 18Q-13 8-14-2Z"/>',
  ),
  graphic(
    ["Cat", "Mèo"],
    '<path fill="#E8A15D" d="M-22 12Q-27-3-20-14L-21-28L-7-19Q0-22 7-19L21-28L20-14Q27-3 22 12Q15 26 0 26Q-15 26-22 12Z"/><g fill="#182D4B"><circle cx="-9" cy="0" r="3"/><circle cx="9" cy="0" r="3"/><path d="M-4 8H4L0 13Z"/></g>',
  ),
  graphic(
    ["Dog", "Chó"],
    '<path fill="#B78660" d="M-15-20Q0-27 15-20L27-15L23 13L15 7V20Q0 31-15 20V7L-23 13L-27-15Z"/><g fill="#182D4B"><circle cx="-8" cy="-2" r="3"/><circle cx="8" cy="-2" r="3"/><ellipse cy="12" rx="5" ry="4"/></g>',
  ),
  graphic(
    ["Bell", "Chuông"],
    '<path fill="#F4C542" d="M-22 16L-17 10V-6Q-17-22 0-22Q17-22 17-6V10L22 16Z"/><circle cy="22" r="5" fill="#E8A15D"/><circle cy="-25" r="4" fill="#E8A15D"/>',
  ),
  graphic(
    ["Snowflake", "Bông tuyết"],
    '<g stroke="#53B6DC" stroke-width="3" stroke-linecap="round" fill="none">' +
      Array.from(
        { length: 6 },
        (_, i) =>
          `<path transform="rotate(${i * 60})" d="M0 0V-26 M0-15L-7-21 M0-15L7-21"/>`,
      ).join("") +
      "</g>",
  ),
  graphic(
    ["Blossom", "Hoa năm cánh"],
    '<g fill="#E83D71">' +
      Array.from(
        { length: 5 },
        (_, i) =>
          `<ellipse transform="rotate(${i * 72})" cy="-13" rx="9" ry="14"/>`,
      ).join("") +
      '</g><circle r="7" fill="#F4C542"/>',
  ),
  graphic(
    ["Fern", "Lá dương xỉ"],
    '<g fill="#2BA85E" stroke="#2BA85E" stroke-width="2"><path d="M0 27V-28"/>' +
      Array.from(
        { length: 6 },
        (_, i) =>
          `<ellipse cx="${7 - i * 0.5}" cy="${19 - i * 8}" rx="${11 - i * 0.8}" ry="3.5" transform="rotate(-22 ${7 - i * 0.5} ${19 - i * 8})"/><ellipse cx="${-7 + i * 0.5}" cy="${19 - i * 8}" rx="${11 - i * 0.8}" ry="3.5" transform="rotate(22 ${-7 + i * 0.5} ${19 - i * 8})"/>`,
      ).join("") +
      "</g>",
  ),
  graphic(
    ["Basketball", "Bóng rổ"],
    '<circle r="26" fill="#F28B2A"/><g fill="none" stroke="#182D4B" stroke-width="2"><circle r="25"/><path d="M-25 0H25M0-25V25M-19-17Q14 0-19 17M19-17Q-14 0 19 17"/></g>',
  ),
  graphic(
    ["Tree", "Cây thông"],
    '<path fill="#2BA85E" d="M0-28L17-9H10L25 11H14L29 23H-29L-14 11H-25L-10-9H-17Z"/><path fill="#B78660" d="M-5 22H5V30H-5Z"/>',
  ),
);
