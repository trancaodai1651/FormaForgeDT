import { strToU8, zipSync } from 'fflate';
import type { BedConfig, CutterMesh } from './geometry';

export type ExportPart = {
  name: string;
  mesh: CutterMesh;
  color: string;
};

function safeName(name: string): string {
  return name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'stl-cutter';
}

function placeForBed(mesh: CutterMesh): CutterMesh {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < mesh.vertices.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], mesh.vertices[index + axis]);
      max[axis] = Math.max(max[axis], mesh.vertices[index + axis]);
    }
  }
  const shift = [-(min[0] + max[0]) / 2, -(min[1] + max[1]) / 2, -min[2]];
  const vertices = mesh.vertices.slice();
  for (let index = 0; index < vertices.length; index += 3) {
    vertices[index] += shift[0]; vertices[index + 1] += shift[1]; vertices[index + 2] += shift[2];
  }
  return { vertices, indices: mesh.indices.slice() };
}

function offsetMesh(mesh: CutterMesh, offset: [number, number, number]): CutterMesh {
  const vertices = mesh.vertices.slice();
  for (let index = 0; index < vertices.length; index += 3) {
    vertices[index] += offset[0]; vertices[index + 1] += offset[1]; vertices[index + 2] += offset[2];
  }
  return { vertices, indices: mesh.indices.slice() };
}

function normalFor(mesh: CutterMesh, a: number, b: number, c: number): [number, number, number] {
  const ax = mesh.vertices[a * 3]; const ay = mesh.vertices[a * 3 + 1]; const az = mesh.vertices[a * 3 + 2];
  const bx = mesh.vertices[b * 3]; const by = mesh.vertices[b * 3 + 1]; const bz = mesh.vertices[b * 3 + 2];
  const cx = mesh.vertices[c * 3]; const cy = mesh.vertices[c * 3 + 1]; const cz = mesh.vertices[c * 3 + 2];
  const ux = bx - ax; const uy = by - ay; const uz = bz - az;
  const vx = cx - ax; const vy = cy - ay; const vz = cz - az;
  const nx = uy * vz - uz * vy; const ny = uz * vx - ux * vz; const nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}

export function exportStl(mesh: CutterMesh, name = 'stl-cutter'): string {
  const title = safeName(name);
  const lines = [`solid ${title}`];
  for (let index = 0; index + 2 < mesh.indices.length; index += 3) {
    const a = mesh.indices[index]; const b = mesh.indices[index + 1]; const c = mesh.indices[index + 2];
    const points = [a, b, c].map((vertex) => mesh.vertices.slice(vertex * 3, vertex * 3 + 3));
    if (points.some((point) => point.length !== 3)) continue;
    const normal = normalFor(mesh, a, b, c);
    lines.push(`facet normal ${normal.join(' ')}`, ' outer loop', ...points.map((point) => `  vertex ${point.join(' ')}`), ' endloop', 'endfacet');
  }
  lines.push(`endsolid ${title}`);
  return lines.join('\n');
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function colorHex(color: string): string {
  const normalized = color.replace('#', '').trim();
  const value = normalized.length === 3 ? normalized.split('').map((item) => item + item).join('') : normalized.padEnd(6, '0').slice(0, 6);
  return `#${value.toUpperCase()}FF`;
}

function meshXml(mesh: CutterMesh): string {
  const vertices = Array.from({ length: Math.floor(mesh.vertices.length / 3) }, (_, index) => `<vertex x="${mesh.vertices[index * 3]}" y="${mesh.vertices[index * 3 + 1]}" z="${mesh.vertices[index * 3 + 2]}"/>`).join('');
  const triangles = Array.from({ length: Math.floor(mesh.indices.length / 3) }, (_, index) => `<triangle v1="${mesh.indices[index * 3]}" v2="${mesh.indices[index * 3 + 1]}" v3="${mesh.indices[index * 3 + 2]}"/>`).join('');
  return `<mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh>`;
}

function buildThreeMfArchive(parts: ExportPart[], title: string, modelSettings?: string): Uint8Array {
  const usable = parts.filter((part) => part.mesh.indices.length >= 3);
  const materials = usable.map((part) => `<base name="${escapeXml(part.name)}" displaycolor="${colorHex(part.color)}"/>`).join('');
  const objects = usable.map((part, index) => `<object id="${index + 1}" type="model" pid="1" pindex="${index}">${meshXml(part.mesh)}</object>`).join('');
  const items = usable.map((_, index) => `<item objectid="${index + 1}"/>`).join('');
  const model = `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"><metadata name="Title">${escapeXml(title)}</metadata><metadata name="Designer">FormaForgeDT</metadata><metadata name="Application">FormaForgeDT STL Cutter</metadata><resources><basematerials id="1">${materials}</basematerials>${objects}</resources><build>${items}</build></model>`;
  const relationships = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="text/xml"/><Default Extension="txt" ContentType="text/plain"/></Types>`;
  const entries: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(relationships),
    '3D/3dmodel.model': strToU8(model),
    'Metadata/generator.txt': strToU8('FormaForgeDT STL Cutter · units: millimeter'),
  };
  if (modelSettings) entries['Metadata/model_settings.config'] = strToU8(modelSettings);
  return zipSync(entries, { level: 6 });
}

export function buildThreeMf(parts: ExportPart[], title = 'STL Cutter project'): Uint8Array {
  return buildThreeMfArchive(parts, title);
}

export function buildMultiBedThreeMf(parts: ExportPart[], bed: BedConfig, title = 'STL Cutter beds'): Uint8Array {
  const usable = parts.filter((part) => part.mesh.indices.length >= 3);
  const columns = Math.max(1, Math.ceil(Math.sqrt(usable.length)));
  const placed = usable.map((part, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const mesh = offsetMesh(placeForBed(part.mesh), [column * (bed.width + 20), row * (bed.depth + 20), 0]);
    return { ...part, mesh };
  });
  const objects = placed.map((part, index) => `<object id="${index + 1}"><metadata key="name" value="${escapeXml(part.name)}"/><metadata key="extruder" value="1"/><part id="${index + 1}" subtype="normal_part"><metadata key="name" value="${escapeXml(part.name)}"/><metadata key="matrix" value="1 0 0 0 1 0 0 0 1 0 0 0"/></part></object>`).join('');
  const plates = placed.map((part, index) => `<plate><metadata key="plater_id" value="${index + 1}"/><metadata key="plater_name" value="Bed ${index + 1}"/><metadata key="locked" value="false"/><model_instance><metadata key="object_id" value="${index + 1}"/><metadata key="instance_id" value="0"/><metadata key="identify_id" value="${index + 1}"/><metadata key="name" value="${escapeXml(part.name)}"/></model_instance></plate>`).join('');
  const modelSettings = `<?xml version="1.0" encoding="UTF-8"?><config>${objects}${plates}</config>`;
  return buildThreeMfArchive(placed, title, modelSettings);
}

export function buildStlZip(parts: ExportPart[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const part of parts) entries[`${safeName(part.name)}.stl`] = strToU8(exportStl(part.mesh, part.name));
  return zipSync(entries, { level: 6 });
}

export function downloadBytes(data: string | Uint8Array, mime: string, name: string) {
  const payload = typeof data === 'string' ? data : data.slice().buffer as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([payload], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
