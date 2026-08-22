import { getClickerDocument } from '../runtime';
// src/export/threemfExport.ts
import { zipSync, strToU8 } from 'fflate';
import type { ClickerPart, PartGroup, RGB } from '../types';
import { sanitizeMesh, groupBBox } from './meshUtils';

// 3MF stores coordinates as text. Keep the same high precision as the mesh
// sanitizer instead of reducing every vertex to 0.0001 mm on export.
const f = (n: number): string => String(Math.round(n * 1e5) / 1e5);

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


function hex(rgb: RGB): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(rgb[0])}${h(rgb[1])}${h(rgb[2])}FF`;
}

function assignExtruders(parts: ClickerPart[]): number[] {
  const slotByColor = new Map<string, number>();
  return parts.map((p) => {
    const key = p.colorRgb.join(',');
    let slot = slotByColor.get(key);
    if (slot === undefined) {
      slot = slotByColor.size + 1;
      slotByColor.set(key, slot);
    }
    return p.extruder ?? slot;
  });
}

function meshXml(p: ClickerPart, minZ: number): string {
  const np = p.numProp;
  const vp = p.vertProperties;
  const tv = p.triVerts;
  const verts: string[] = [];
  for (let i = 0; i < vp.length; i += np) {
    verts.push(`<vertex x="${f(vp[i])}" y="${f(vp[i + 1])}" z="${f(vp[i + 2] - minZ)}"/>`);
  }
  const tris: string[] = [];
  for (let i = 0; i < tv.length; i += 3) {
    tris.push(`<triangle v1="${tv[i]}" v2="${tv[i + 1]}" v3="${tv[i + 2]}"/>`);
  }
  return `<mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh>`;
}

function transformAttr(
  m00: number, m01: number, m02: number,
  m10: number, m11: number, m12: number,
  m20: number, m21: number, m22: number,
  tx: number, ty: number, tz: number,
): string {
  return ` transform="${[m00, m01, m02, m10, m11, m12, m20, m21, m22, tx, ty, tz].map(f).join(' ')}"`;
}

export function buildThreeMF(rawParts: ClickerPart[]): Uint8Array {
  // Äi qua bá»™ lá»c lÃ m sáº¡ch lÆ°á»›i 3D
  const parts = rawParts.map(sanitizeMesh);

  let minZ = Infinity;
  for (const p of parts) {
    for (let i = 2; i < p.vertProperties.length; i += p.numProp) {
      if (p.vertProperties[i] < minZ) minZ = p.vertProperties[i];
    }
  }
  if (!isFinite(minZ)) minZ = 0;

  const extruders = assignExtruders(parts);

  const groups: { id: PartGroup; label: string }[] = [
    { id: 'top', label: 'clicker_top' },
    { id: 'base', label: 'clicker_base' },
  ].filter((g) => parts.some((p) => p.group === g.id)) as { id: PartGroup; label: string }[];

  const baseMaterials = parts
    .map((p) => `<base name="${p.name}" displaycolor="${hex(p.colorRgb)}"/>`)
    .join('');
  const leafObjects = parts
    .map((p, i) => `<object id="${i + 2}" type="model" pid="1" pindex="${i}">${meshXml(p, minZ)}</object>`)
    .join('');

  const firstWrapperId = parts.length + 2;
  const wrapperObjects = groups
    .map((g, gi) => {
      const comps = parts
        .map((p, i) => (p.group === g.id ? `<component objectid="${i + 2}"/>` : ''))
        .join('');
      return `<object id="${firstWrapperId + gi}" type="model"><components>${comps}</components></object>`;
    })
    .join('');

  const GAP_MM = 5;
  const baseBB = groupBBox(parts, 'base', minZ);
  const topBB = groupBBox(parts, 'top', minZ);

  const buildItems = groups
    .map((g, gi) => {
      if (g.id === 'base') {
        return `<item objectid="${firstWrapperId + gi}"/>`;
      }
      const tz = topBB.maxZ;
      const baseWidth = isFinite(baseBB.maxX) ? baseBB.maxX - baseBB.minX : 0;
      const topWidth = isFinite(topBB.maxX) ? topBB.maxX - topBB.minX : 0;
      const baseCenterX = isFinite(baseBB.minX) ? (baseBB.minX + baseBB.maxX) / 2 : 0;
      const topCenterX = isFinite(topBB.minX) ? (topBB.minX + topBB.maxX) / 2 : 0;
      const tx = baseCenterX + baseWidth / 2 + GAP_MM + topWidth / 2 - topCenterX;
      const topCenterY = isFinite(topBB.minY) ? (topBB.minY + topBB.maxY) / 2 : 0;
      const ty = 2 * topCenterY;
      const xform = transformAttr(1, 0, 0, 0, -1, 0, 0, 0, -1, tx, ty, tz);
      return `<item objectid="${firstWrapperId + gi}"${xform}/>`;
    })
    .join('');

  const viteEnv: Record<string, string> = ((import.meta as unknown as { env?: Record<string, string> }).env) ?? {};
  const buildId = viteEnv.VITE_BUILD_ID ?? 'dev';
  const creationDate = new Date().toISOString().slice(0, 10);
  const metadata =
    `<metadata name="Title">Clicker</metadata>` +
    `<metadata name="Designer">FormaForgeDT</metadata>` +
    `<metadata name="Application">FormaForgeDT Clicker Generator</metadata>` +
    `<metadata name="CreationDate">${creationDate}</metadata>` +
    `<metadata name="Generator">FormaForgeDT Clicker Generator</metadata>` +
    `<metadata name="Build">${esc(buildId)}</metadata>`;

  const model =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="en-US"` +
    ` xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"` +
    ` xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">` +
    metadata +
    `<resources>` +
    `<basematerials id="1">${baseMaterials}</basematerials>` +
    leafObjects +
    wrapperObjects +
    `</resources>` +
    `<build>${buildItems}</build>` +
    `</model>`;

  const objectCfg = groups
    .map((g, gi) => {
      const partsCfg = parts
        .map((p, i) =>
          p.group === g.id
            ? `<part id="${i + 2}" subtype="normal_part">` +
              `<metadata key="name" value="${p.name}"/>` +
              `<metadata key="extruder" value="${extruders[i]}"/>` +
              `</part>`
            : '',
        )
        .join('');
      return (
        `<object id="${firstWrapperId + gi}">` +
        `<metadata key="name" value="${g.label}"/>` +
        `<metadata key="extruder" value="1"/>` +
        partsCfg +
        `</object>`
      );
    })
    .join('');
  const modelSettings =
    `<?xml version="1.0" encoding="UTF-8"?>\n` + `<config>` + objectCfg + `</config>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>` +
    `<Default Extension="config" ContentType="text/xml"/>` +
    `</Types>`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Target="/3D/3dmodel.model" Id="rel0"` +
    ` Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>` +
    `</Relationships>`;

  const provenance = [
    'FormaForgeDT Clicker Generator',
    '',
    'This 3MF was generated by FormaForgeDT.',
    `Build: ${buildId}`,
    `Created: ${creationDate}`,
  ].join('\n');

  return zipSync(
    {
      '[Content_Types].xml': strToU8(contentTypes),
      '_rels/.rels': strToU8(rels),
      '3D/3dmodel.model': strToU8(model),
      'Metadata/model_settings.config': strToU8(modelSettings),
      'Metadata/generator.txt': strToU8(provenance),
    },
    { level: 6 },
  );
}

export function downloadThreeMF(parts: ClickerPart[], fileName = 'clicker.3mf') {
  const bytes = buildThreeMF(parts);
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'model/3mf' });
  const url = URL.createObjectURL(blob);
  const a = getClickerDocument().createElement('a');
  a.href = url;
  a.download = fileName;
  getClickerDocument().body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


