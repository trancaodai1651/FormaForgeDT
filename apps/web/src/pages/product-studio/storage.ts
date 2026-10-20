import { encodeAssets, decodeAssets } from "../parametric-model-maker/storage";
import { cleanParams, PARAM_DEFAULTS } from "./fields";
import { PRODUCTS } from "./catalog";
import { unzipSync, strFromU8 } from "fflate";
export async function readProjectFile(file: File) {
  if (/\.3mf$/i.test(file.name)) {
    if (file.size > 100 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
    const files = unzipSync(new Uint8Array(await file.arrayBuffer())),
      data = files["Metadata/product-studio.json"];
    if (!data) throw new Error("PROJECT_INVALID");
    return { design: readDesign(strFromU8(data)), settings: false };
  }
  const json = await file.text();
  return {
    design: readDesign(json),
    settings: JSON.parse(json).settings === true,
  };
}
import {
  newDesign,
  defaultQR,
  isHex,
  type ProductDesign,
  type PrinterProfile,
} from "./model";
let pending: Promise<IDBDatabase> | undefined;
function db() {
  return (pending ??= new Promise((resolve, reject) => {
    const r = indexedDB.open("formaforge-product-studio", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("projects", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
export async function saveDesign(design: ProductDesign) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const t = database.transaction("projects", "readwrite");
    t.objectStore("projects").put({ ...design, updated: Date.now() });
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
export async function listDesigns() {
  const database = await db();
  return new Promise<ProductDesign[]>((resolve, reject) => {
    const r = database.transaction("projects").objectStore("projects").getAll();
    r.onsuccess = () =>
      resolve(
        (r.result as ProductDesign[])
          .map((d) => ({ ...d, params: { ...PARAM_DEFAULTS, ...d.params } }))
          .sort((a, b) => b.updated - a.updated),
      );
    r.onerror = () => reject(r.error);
  });
}
export function designJson(
  design: ProductDesign,
  withAssets = true,
  settings = false,
) {
  return JSON.stringify(
    {
      ...design,
      id: settings ? undefined : design.id,
      name: settings ? "Settings" : design.name,
      settings,
      lines: settings
        ? design.lines.map((l) => ({ ...l, text: "" }))
        : design.lines,
      backLines: settings
        ? design.backLines.map((l) => ({ ...l, text: "" }))
        : design.backLines,
      artworks: settings ? [] : design.artworks,
      assets: withAssets ? encodeAssets(design.assets) : [],
      model: withAssets
        ? design.model?.map((p) => ({
            ...p,
            vertices: Array.from(p.vertices),
            indices: Array.from(p.indices),
          }))
        : undefined,
    },
    null,
    2,
  );
}
export function readDesign(json: string): ProductDesign {
  if (json.length > 100 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
  const raw = JSON.parse(json);
  if (raw.version !== 1 || !PRODUCTS.some((p) => p.id === raw.preset))
    throw new Error("PROJECT_INVALID");
  const design = newDesign(
    PRODUCTS.find((p) => p.id === raw.preset)!,
    cleanParams(raw.params ?? {}),
  );
  design.params = cleanParams(raw.params ?? {});
  design.name = String(raw.name ?? design.name).slice(0, 160);
  for (const key of ["lines", "backLines"] as const) {
    if (!Array.isArray(raw[key])) throw new Error("PROJECT_INVALID");
    design[key] = design[key].map((fallback, i) => {
      const line = { ...fallback, ...raw[key][i] };
      for (const k of [
        "size",
        "spacing",
        "rise",
        "depth",
        "angle",
        "x",
        "y",
        "radius",
      ] as const)
        if (
          typeof line[k] !== "number" ||
          !Number.isFinite(line[k]) ||
          Math.abs(line[k]) > 1000
        )
          throw new Error("PROJECT_INVALID");
      if (
        typeof line.text !== "string" ||
        line.text.length > 1000 ||
        !isHex(line.color)
      )
        throw new Error("PROJECT_INVALID");
      if (
        !["raised", "engraved", "flush"].includes(line.style) ||
        !["left", "center", "right", "manual"].includes(line.align) ||
        !["straight", "top", "bottom"].includes(line.curve) ||
        !["as", "upper", "lower"].includes(line.letterCase) ||
        !["light", "regular", "bold", "heavy"].includes(line.weight) ||
        typeof line.font !== "string" ||
        line.font.length > 200 ||
        line.size <= 0 ||
        line.rise < 0 ||
        line.depth < 0 ||
        line.radius <= 0
      )
        throw new Error("PROJECT_INVALID");
      return line;
    });
  }
  if (!Array.isArray(raw.artworks) || raw.artworks.length > 6)
    throw new Error("PROJECT_INVALID");
  design.artworks = raw.artworks;
  for (const a of design.artworks) {
    if (
      !Array.isArray(a.regions) ||
      a.regions.length > 512 ||
      !Number.isFinite(a.size) ||
      a.size <= 0 ||
      a.size > 1000
    )
      throw new Error("PROJECT_INVALID");
    if (
      !["front", "back"].includes(a.side) ||
      !["raised", "engraved", "flush"].includes(a.style) ||
      ![a.x, a.y, a.angle, a.depth, a.rise].every(
        (v) => Number.isFinite(v) && Math.abs(v) <= 1000,
      )
    )
      throw new Error("PROJECT_INVALID");
    for (const r of a.regions) {
      if (
        !isHex(r.color) ||
        !Array.isArray(r.rings) ||
        !Number.isFinite(r.height) ||
        r.height < 0 ||
        r.height > 50
      )
        throw new Error("PROJECT_INVALID");
      for (const ring of r.rings) {
        if (
          ring.length > 200000 ||
          ring.some(
            (p) =>
              !Array.isArray(p) ||
              p.length !== 2 ||
              p.some((n) => !Number.isFinite(n) || Math.abs(n) > 1000),
          )
        )
          throw new Error("PROJECT_INVALID");
      }
    }
  }
  if (!Array.isArray(raw.codes) || raw.codes.length > 12)
    throw new Error("PROJECT_INVALID");
  design.codes = raw.codes.map((raw: unknown) => {
    const q = { ...defaultQR(), ...(raw as object) };
    if (
      !["text", "wifi", "phone", "sms", "email", "contact"].includes(q.kind) ||
      !["raised", "engraved", "flush"].includes(q.style) ||
      !["module", "fixed"].includes(q.sizing) ||
      !["front", "back", "both"].includes(q.side ?? "front") ||
      !["L", "M", "Q", "H"].includes(q.ecc) ||
      !isHex(q.color) ||
      !isHex(q.tileColor)
    )
      throw new Error("PROJECT_INVALID");
    for (const key of [
      "content",
      "ssid",
      "password",
      "phone",
      "message",
      "email",
      "subject",
      "contactName",
      "company",
      "url",
      "address",
      "caption",
    ] as const)
      if (typeof q[key] !== "string" || q[key].length > 4000)
        throw new Error("PROJECT_INVALID");
    if (
      ![q.x, q.y, q.size, q.module, q.height].every(Number.isFinite) ||
      Math.abs(q.x) > 1000 ||
      Math.abs(q.y) > 1000 ||
      q.size < 5 ||
      q.size > 1000 ||
      q.module < 0.1 ||
      q.module > 10 ||
      q.height < 0.1 ||
      q.height > 10
    )
      throw new Error("PROJECT_INVALID");
    return q;
  });
  design.assets = decodeAssets(raw.assets);
  if (raw.model) {
    if (!Array.isArray(raw.model) || raw.model.length > 200)
      throw new Error("PROJECT_INVALID");
    design.model = raw.model.map(
      (p: {
        name: string;
        color: string;
        vertices: number[];
        indices: number[];
      }) => {
        if (
          !Array.isArray(p.vertices) ||
          !Array.isArray(p.indices) ||
          p.vertices.length > 9e6 ||
          p.indices.length > 9e6 ||
          p.vertices.some((n) => !Number.isFinite(n)) ||
          p.indices.some(
            (n) => !Number.isInteger(n) || n < 0 || n >= p.vertices.length / 3,
          )
        )
          throw new Error("PROJECT_INVALID");
        return {
          ...p,
          role: "model",
          vertices: new Float32Array(p.vertices),
          indices: new Uint32Array(p.indices),
        };
      },
    );
  }
  return design;
}
export function readPrinters(): PrinterProfile[] {
  try {
    return JSON.parse(localStorage.getItem("product-studio-printers") ?? "[]");
  } catch {
    return [];
  }
}
export function savePrinters(printers: PrinterProfile[]) {
  localStorage.setItem("product-studio-printers", JSON.stringify(printers));
}
