/// <reference types="vite/client" />
import { zipSync, strToU8 } from "fflate";
import Module, { type ManifoldToplevel } from "manifold-3d";
import wasmUrl from "manifold-3d/manifold.wasm?url";
import { buildFlushSettings } from "../../clicker/export/flushSettings";
import type { MakerProject, PartMesh } from "./model";
const xml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
export function partStl(part: PartMesh): Uint8Array {
  const buffer = new ArrayBuffer(84 + (part.indices.length / 3) * 50);
  const d = new DataView(buffer);
  d.setUint32(80, part.indices.length / 3, true);
  let at = 84;
  for (let i = 0; i < part.indices.length; i += 3) {
    const v = [0, 1, 2].map((j) =>
      part.vertices.subarray(
        part.indices[i + j] * 3,
        part.indices[i + j] * 3 + 3,
      ),
    );
    const a = v[1].map((n, j) => n - v[0][j]),
      b = v[2].map((n, j) => n - v[0][j]);
    const n = [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const l = Math.hypot(...n) || 1;
    for (const x of [
      ...n.map((x) => x / l),
      ...v.flatMap((x) => Array.from(x)),
    ]) {
      d.setFloat32(at, x, true);
      at += 4;
    }
    at += 2;
  }
  return new Uint8Array(buffer);
}
export async function unionForStl(
  parts: PartMesh[],
  runtime?: ManifoldToplevel,
): Promise<PartMesh> {
  if (parts.length === 1) return parts[0];
  const api = runtime ?? (await Module({ locateFile: () => wasmUrl }));
  api.setup();
  const solids = parts.map(
    (p) =>
      new api.Manifold(
        new api.Mesh({
          numProp: 3,
          vertProperties: p.vertices,
          triVerts: p.indices,
        }),
      ),
  );
  try {
    const solid = api.Manifold.union(solids);
    try {
      const mesh = solid.getMesh();
      const vertices = new Float32Array(mesh.numVert * 3);
      for (let i = 0; i < mesh.numVert; i++)
        vertices.set(
          mesh.vertProperties.subarray(i * mesh.numProp, i * mesh.numProp + 3),
          i * 3,
        );
      return {
        name: "Assembly",
        color: parts[0].color,
        role: "model",
        vertices,
        indices: new Uint32Array(mesh.triVerts),
      };
    } finally {
      solid.delete();
    }
  } finally {
    for (const s of solids) s.delete();
  }
}
export function partsZip(parts: PartMesh[]): Uint8Array {
  return zipSync(
    Object.fromEntries(
      parts.map((p, i) => [
        `${String(i + 1).padStart(2, "0")}-${p.role}.stl`,
        partStl(p),
      ]),
    ),
    { level: 6 },
  );
}
export function modelThreeMf(
  parts: PartMesh[],
  project: MakerProject,
  printer: string,
  bed: { width: number; depth: number },
): Uint8Array {
  if (!parts.length) throw new Error("Chưa có phần mô hình để xuất.");
  const colors = [...new Set(parts.map((p) => p.color.toUpperCase()))];
  const materials = colors
    .map((c, i) => `<base name="Filament ${i + 1}" displaycolor="${c}FF"/>`)
    .join("");
  const objects = parts
    .map((p, i) => {
      let vertices = "",
        triangles = "";
      for (let j = 0; j < p.vertices.length; j += 3)
        vertices += `<vertex x="${p.vertices[j]}" y="${p.vertices[j + 1]}" z="${p.vertices[j + 2]}"/>`;
      for (let j = 0; j < p.indices.length; j += 3)
        triangles += `<triangle v1="${p.indices[j]}" v2="${p.indices[j + 1]}" v3="${p.indices[j + 2]}"/>`;
      return `<object id="${i + 2}" name="${xml(p.name)}" type="model" pid="1" pindex="${colors.indexOf(p.color.toUpperCase())}"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object>`;
    })
    .join("");
  const root = parts.length + 2;
  const components = parts
    .map((_, i) => `<component objectid="${i + 2}"/>`)
    .join("");
  const z = -meshBounds(parts).min[2];
  const model = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">${xml(project.name)}</metadata><metadata name="Application">FormaForgeDT Parametric Model Maker</metadata><resources><basematerials id="1">${materials}</basematerials>${objects}<object id="${root}" name="${xml(project.name)}" type="model"><components>${components}</component></object></resources><build><item objectid="${root}" transform="1 0 0 0 1 0 0 0 1 ${bed.width / 2} ${bed.depth / 2} ${z}"/></build></model>`;
  const metadata = `<?xml version="1.0" encoding="UTF-8"?><config><object id="${root}"><metadata key="name" value="${xml(project.name)}"/><metadata key="extruder" value="1"/>${parts.map((p, i) => `<part id="${i + 2}" subtype="normal_part"><metadata key="name" value="${xml(p.name)}"/><metadata key="extruder" value="${colors.indexOf(p.color.toUpperCase()) + 1}"/></part>`).join("")}</object><plate><metadata key="plater_id" value="1"/><metadata key="plater_name" value="${xml(project.name)}"/><model_instance><metadata key="object_id" value="${root}"/><metadata key="instance_id" value="0"/><metadata key="identify_id" value="${root}"/></model_instance></plate></config>`;
  return zipSync(
    {
      "[Content_Types].xml": strToU8(
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="text/plain"/><Default Extension="json" ContentType="application/json"/></Types>',
      ),
      "_rels/.rels": strToU8(
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/3dmodel.model"/></Relationships>',
      ),
      "3D/3dmodel.model": strToU8(model),
      "Metadata/model_settings.config": strToU8(metadata),
      "Metadata/project_settings.config": strToU8(
        JSON.stringify({
          printer_model: printer,
          nozzle_diameter: ["0.4"],
          printer_extruder_id: ["1"],
          filament_colour: colors,
          filament_type: colors.map(() => "PLA"),
          filament_diameter: colors.map(() => "1.75"),
          ...buildFlushSettings(colors.length, 1),
        }),
      ),
      "Metadata/formaforge-project.json": strToU8(
        JSON.stringify({ ...project, assets: undefined }),
      ),
    },
    { level: 6 },
  );
}
export function meshBounds(parts: PartMesh[]) {
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts)
    for (let i = 0; i < p.vertices.length; i += 3)
      for (let j = 0; j < 3; j++) {
        min[j] = Math.min(min[j], p.vertices[i + j]);
        max[j] = Math.max(max[j], p.vertices[i + j]);
      }
  return { min, max, size: max.map((v, i) => v - min[i]) };
}
