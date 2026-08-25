import { strToU8, zipSync } from 'fflate';
import { getClickerDocument } from '../../../runtime';
import type { ClickerPart, RGB } from '../../../types';
import { sanitizeMesh } from '../../../export/meshUtils';

const formatNumber = (value: number): string => String(Math.round(value * 1e5) / 1e5);

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function colorHex(rgb: RGB): string {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  // Bambu's color-group importer accepts the 3MF sRGB value with explicit
  // opaque alpha. Keeping one canonical value also makes duplicate colors map
  // to the same filament slot across layers and keychain segments.
  return `#${channel(rgb[0])}${channel(rgb[1])}${channel(rgb[2])}FF`;
}

function colorTable(parts: ClickerPart[]): { colors: RGB[]; indices: number[] } {
  const indexByColor = new Map<string, number>();
  const colors: RGB[] = [];
  const indices = parts.map((part) => {
    const key = colorHex(part.colorRgb);
    let index = indexByColor.get(key);
    if (index === undefined) {
      index = colors.length;
      indexByColor.set(key, index);
      colors.push(part.colorRgb);
    }
    return index;
  });
  return { colors, indices };
}

function combinedMeshXml(parts: ClickerPart[], minZ: number, colorIndices: number[]): string {
  const vertices: string[] = [];
  const triangles: string[] = [];
  let vertexOffset = 0;
  for (const [partIndex, part] of parts.entries()) {
    for (let i = 0; i < part.vertProperties.length; i += part.numProp) {
      vertices.push(
        `<vertex x="${formatNumber(part.vertProperties[i])}" y="${formatNumber(part.vertProperties[i + 1])}" z="${formatNumber(part.vertProperties[i + 2] - minZ)}"/>`,
      );
    }
    for (let i = 0; i + 2 < part.triVerts.length; i += 3) {
      // Repeat the color on every triangle. Bambu Studio uses these explicit
      // color-group properties while importing third-party 3MF files, even
      // when the object also has pid/pindex defaults.
      triangles.push(
        `<triangle v1="${part.triVerts[i] + vertexOffset}" v2="${part.triVerts[i + 1] + vertexOffset}" v3="${part.triVerts[i + 2] + vertexOffset}" pid="1" p1="${colorIndices[partIndex] ?? 0}" p2="${colorIndices[partIndex] ?? 0}" p3="${colorIndices[partIndex] ?? 0}"/>`,
      );
    }
    vertexOffset += Math.floor(part.vertProperties.length / part.numProp);
  }
  return `<mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh>`;
}

/**
 * MultiColor-only 3MF export. All physical layer/segment meshes are packed
 * into one model object, while each triangle keeps its material index. This
 * is important for Bambu Studio: separate objects at different Z heights are
 * treated as a multi-part assembly and trigger an import prompt. The packed
 * object keeps the assembled geometry and still exposes every colour through
 * the 3MF Materials Extension.
 */
export function buildThreeMFObjects(rawParts: ClickerPart[]): Uint8Array {
  // Empty sanitized parts have no printable triangles and should not create a
  // phantom material slot or an empty object in the exported model.
  const parts = rawParts.map(sanitizeMesh).filter((part) => part.triVerts.length >= 3);
  let minZ = Infinity;
  for (const part of parts) {
    for (let i = 2; i < part.vertProperties.length; i += part.numProp) {
      minZ = Math.min(minZ, part.vertProperties[i]);
    }
  }
  if (!isFinite(minZ)) minZ = 0;

  const colorMap = colorTable(parts);
  // Bambu Studio reads the Materials Extension color group for third-party
  // 3MF files. The old m:basematerials element was not a valid Bambu color
  // resource and therefore all objects fell back to one filament color.
  const colors = colorMap.colors
    .map((rgb) => `<m:color color="${colorHex(rgb)}"/>`)
    .join('');
  const objectId = 2;
  const objectName = parts.length ? parts.map((part) => part.name).join(' + ') : 'FormaForge Multi Color';
  const objects = parts.length
    ? `<object id="${objectId}" name="${escapeXml(objectName)}" type="model" pid="1" pindex="0">${combinedMeshXml(parts, minZ, colorMap.indices)}</object>`
    : '';
  const buildItems = parts.length ? `<item objectid="${objectId}"/>` : '';

  const viteEnv: Record<string, string> = ((import.meta as unknown as { env?: Record<string, string> }).env) ?? {};
  const buildId = viteEnv.VITE_BUILD_ID ?? 'dev';
  const creationDate = new Date().toISOString().slice(0, 10);
  const metadata =
    `<metadata name="Title">FormaForgeDT Multi Color</metadata>` +
    `<metadata name="Designer">FormaForgeDT</metadata>` +
    `<metadata name="Application">FormaForgeDT Clicker Generator</metadata>` +
    `<metadata name="CreationDate">${creationDate}</metadata>` +
    `<metadata name="Build">${escapeXml(buildId)}</metadata>`;
  const model =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="en-US"` +
    ` xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"` +
    ` xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">` +
    metadata +
    `<resources><m:colorgroup id="1">${colors}</m:colorgroup>${objects}</resources>` +
    `<build>${buildItems}</build></model>`;
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>` +
      `<Default Extension="txt" ContentType="text/plain"/></Types>`;
  const relationships =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>` +
    `</Relationships>`;

  return zipSync(
    {
      '[Content_Types].xml': strToU8(contentTypes),
      '_rels/.rels': strToU8(relationships),
      '3D/3dmodel.model': strToU8(model),
      'Metadata/generator.txt': strToU8(`FormaForgeDT Multi Color\nBuild: ${buildId}\nCreated: ${creationDate}`),
    },
    { level: 6 },
  );
}

export function downloadThreeMFObjects(parts: ClickerPart[], fileName = 'multi-color.3mf') {
  const bytes = buildThreeMFObjects(parts);
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'model/3mf' });
  const url = URL.createObjectURL(blob);
  const anchor = getClickerDocument().createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  getClickerDocument().body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
