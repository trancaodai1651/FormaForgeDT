import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import {
  modelThreeMf,
  partStl,
  unionForStl,
  meshBounds,
} from "../parametric-model-maker/export";
import { createProject } from "../parametric-model-maker/templates";
import type { PartMesh } from "../parametric-model-maker/model";
import type { ProductDesign, PrinterProfile, Artwork } from "./model";
import { isHex } from "./model";
import { designJson } from "./storage";
import { batchRows, csvText, type CsvRow } from "./csv";
import { ProductSession } from "./runtime";
export const fileName = (name: string) =>
  name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .trim()
    .slice(0, 100) || "product";
export function product3mf(
  parts: PartMesh[],
  design: ProductDesign,
  printer: PrinterProfile,
) {
  const project = { ...createProject(), name: design.name };
  const files = unzipSync(
    modelThreeMf(parts, project, printer.name, {
      width: printer.bedWidth,
      depth: printer.bedDepth,
    }),
  );
  const profile = JSON.parse(
    strFromU8(files["Metadata/project_settings.config"]),
  );
  profile.nozzle_diameter = [String(printer.nozzle)];
  profile.layer_height = String(printer.layer);
  profile.initial_layer_print_height = String(printer.layer);
  profile.printable_area = [
    `0x0`,
    `${printer.bedWidth}x0`,
    `${printer.bedWidth}x${printer.bedDepth}`,
    `0x${printer.bedDepth}`,
  ];
  files["Metadata/project_settings.config"] = strToU8(JSON.stringify(profile));
  files["Metadata/product-studio.json"] = strToU8(designJson(design, true));
  return zipSync(files, { level: 6 });
}
export async function productStl(parts: PartMesh[]) {
  return partStl(await unionForStl(parts));
}
export type PackedPlate = {
  parts: PartMesh[];
  items: { name: string; object: string; order: string; copy: number }[];
};
export function packObjects(
  items: { parts: PartMesh[]; name: string; order: string; copy: number }[],
  printer: PrinterProfile,
  gap: number,
): PackedPlate[] {
  const plates: PackedPlate[] = [];
  let plate: PackedPlate = { parts: [], items: [] },
    x = gap,
    y = gap,
    rowHeight = 0;
  const addPlate = () => {
    if (plate.parts.length) plates.push(plate);
    plate = { parts: [], items: [] };
    x = gap;
    y = gap;
    rowHeight = 0;
  };
  for (const item of items) {
    const groups = new Map<string, PartMesh[]>();
    for (const part of item.parts) {
      const id = part.name.split(" / ")[0];
      groups.set(id, [...(groups.get(id) ?? []), part]);
    }
    for (const [object, parts] of groups) {
      const bounds = meshBounds(parts),
        [w, h] = bounds.size;
      if (w + 2 * gap > printer.bedWidth || h + 2 * gap > printer.bedDepth)
        throw new Error("OBJECT_EXCEEDS_BED");
      if (x + w + gap > printer.bedWidth) {
        x = gap;
        y += rowHeight + gap;
        rowHeight = 0;
      }
      if (y + h + gap > printer.bedDepth) addPlate();
      const delta = [
        x - bounds.min[0] - printer.bedWidth / 2,
        y - bounds.min[1] - printer.bedDepth / 2,
        -bounds.min[2],
      ];
      for (const p of parts) {
        const v = new Float32Array(p.vertices);
        for (let i = 0; i < v.length; i++) v[i] += delta[i % 3];
        plate.parts.push({
          ...p,
          name: `${item.name} ${item.copy} ${object} / ${p.name.split(" / ").slice(1).join(" / ")}`,
          vertices: v,
        });
      }
      plate.items.push({
        name: item.name,
        object,
        order: item.order,
        copy: item.copy,
      });
      x += w + gap;
      rowHeight = Math.max(rowHeight, h);
    }
  }
  addPlate();
  return plates;
}
export function consolidateColors(parts: PartMesh[], max: number): PartMesh[] {
  const counts = new Map<string, number>();
  for (const p of parts)
    counts.set(p.color, (counts.get(p.color) ?? 0) + p.indices.length);
  const palette = [...counts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map(([c]) => c),
    rgb = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  return parts.map((p) => {
    const c = rgb(p.color),
      color = palette.reduce((best, v) => {
        const dist = (s: string) =>
          rgb(s).reduce((sum, n, i) => sum + (n - c[i]) ** 2, 0);
        return dist(v) < dist(best) ? v : best;
      }, palette[0]);
    return { ...p, color };
  });
}
export function rowDesign(
  base: ProductDesign,
  row: CsvRow,
  mapping: Record<string, string>,
  images: Record<string, Artwork> = {},
) {
  const design = structuredClone(base),
    value = (key: string) =>
      key in mapping
        ? mapping[key]
          ? (row[mapping[key]] ?? "")
          : ""
        : (row[key] ?? "");
  const name =
    "name" in mapping
      ? value("name")
      : value("name") || value("personalization") || value("text");
  if (name) {
    design.name = name;
    design.lines[0].text = name;
  }
  for (let i = 1; i < 6; i++)
    if (value(`line${i + 1}`)) design.lines[i].text = value(`line${i + 1}`);
  for (const key of ["width", "height"])
    if (value(key)) {
      const n = Number(value(key));
      if (!Number.isFinite(n) || n < 5 || n > 350)
        throw new Error("BATCH_DIMENSIONS");
      design.params[key] = n;
    }
  if (isHex(value("base_color"))) design.params.baseColor = value("base_color");
  if (isHex(value("text_color")))
    for (const line of design.lines) line.color = value("text_color");
  if (value("content")) design.codes[0].content = value("content");
  if (value("image")) {
    if (!images[value("image")]) throw new Error("BATCH_IMAGE_MISSING");
    design.artworks = [structuredClone(images[value("image")])];
  }
  return design;
}
export async function batchExport(
  base: ProductDesign,
  printer: PrinterProfile,
  text: string,
  mapping: Record<string, string>,
  gap: number,
  maxColors: number,
  images: Record<string, Artwork>,
  signal: AbortSignal,
  progress: (n: number, total: number) => void,
  csvMode: import("./csv").CsvMode = "auto",
  format: "3mf" | "stl" | "both" = "3mf",
) {
  const rows = batchRows(text, csvMode);
  if (!rows.length) throw new Error("BATCH_EMPTY");
  if (rows.length > 500) throw new Error("BATCH_TOO_LARGE");
  const items = [];
  let total = 0;
  const session = new ProductSession();
  try {
    for (let i = 0; i < rows.length; i++) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      const row = rows[i],
        design = rowDesign(base, row, mapping, images);
      const quantity = Number(
        "quantity" in mapping
          ? mapping.quantity
            ? row[mapping.quantity] || 1
            : 1
          : row.quantity || row.qty || 1,
      );
      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 500 ||
        (total += quantity) > 1000
      )
        throw new Error("BATCH_QUANTITY");
      const parts = await session.build(design, printer, signal);
      for (let copy = 1; copy <= quantity; copy++)
        items.push({
          parts,
          name: design.name,
          order: row[mapping.order_number || "order_number"] ?? "",
          copy,
        });
      progress(i + 1, rows.length);
    }
  } finally {
    session.close();
  }
  const plates = packObjects(items, printer, gap),
    files: Record<string, Uint8Array> = {},
    manifest: (string | number)[][] = [
      ["plate", "name", "object", "order_number", "copy", "filaments"],
    ];
  for (let i = 0; i < plates.length; i++) {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const parts = maxColors
      ? consolidateColors(plates[i].parts, maxColors)
      : plates[i].parts;
    if (format !== "stl")
      files[`plate-${i + 1}.3mf`] = product3mf(
        parts,
        { ...base, name: `${base.name} — ${i + 1}` },
        printer,
      );
    if (format !== "3mf") files[`plate-${i + 1}.stl`] = await productStl(parts);
    for (const item of plates[i].items)
      manifest.push([
        i + 1,
        item.name,
        item.object,
        item.order,
        item.copy,
        [...new Set(parts.map((p) => p.color))].join(";"),
      ]);
  }
  files["manifest.csv"] = strToU8(csvText(manifest));
  files["settings.json"] = strToU8(designJson(base, true, true));
  files["orders.csv"] = strToU8(text);
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  return {
    data: zipSync(files, { level: 6 }),
    plates: plates.length,
    items: total,
  };
}
