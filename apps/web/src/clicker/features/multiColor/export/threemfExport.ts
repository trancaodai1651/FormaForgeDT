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
  // Opaque filament colors do not need an alpha channel. The six-digit form
  // is accepted by the 3MF Materials Extension and is handled consistently
  // by slicers that use the color group as a filament hint.
  return `#${channel(rgb[0])}${channel(rgb[1])}${channel(rgb[2])}`;
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

function combinedMeshXml(parts: ClickerPart[], minZ: number, colorIndex: number): string {
  const vertices: string[] = [];
  const triangles: string[] = [];
  let vertexOffset = 0;
  for (const part of parts) {
    for (let i = 0; i < part.vertProperties.length; i += part.numProp) {
      vertices.push(
        `<vertex x="${formatNumber(part.vertProperties[i])}" y="${formatNumber(part.vertProperties[i + 1])}" z="${formatNumber(part.vertProperties[i + 2] - minZ)}"/>`,
      );
    }
    for (let i = 0; i + 2 < part.triVerts.length; i += 3) {
      // Repeat the object material on every triangle as well. This is
      // redundant for a one-color object, but protects the mapping in
      // consumers that inspect triangle properties instead of object defaults.
      triangles.push(
        `<triangle v1="${part.triVerts[i] + vertexOffset}" v2="${part.triVerts[i + 1] + vertexOffset}" v3="${part.triVerts[i + 2] + vertexOffset}" pid="1" p1="${colorIndex}" p2="${colorIndex}" p3="${colorIndex}"/>`,
      );
    }
    vertexOffset += Math.floor(part.vertProperties.length / part.numProp);
  }
  return `<mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh>`;
}

/**
 * MultiColor-only 3MF export. Each physical color is a separate model object
 * with an object-level material mapping and matching triangle properties. A
 * slicer can therefore assign the exact source RGB to one object/filament
 * without having to infer colors from a mixed triangle-painted object.
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
  const colors = colorMap.colors
    .map((rgb) => `<m:color color="${colorHex(rgb)}"/>`)
    .join('');
  const partsByColor = new Map<number, ClickerPart[]>();
  for (const [partIndex, part] of parts.entries()) {
    const colorIndex = colorMap.indices[partIndex] ?? 0;
    const colorParts = partsByColor.get(colorIndex) ?? [];
    colorParts.push(part);
    partsByColor.set(colorIndex, colorParts);
  }
  const colorGroups = [...partsByColor.entries()].sort(([a], [b]) => a - b);
  const objects = colorGroups
    .map(([colorIndex, colorParts], groupIndex) => {
      const objectId = 2 + groupIndex;
      const color = colorHex(colorMap.colors[colorIndex] ?? [0, 0, 0]);
      const sourceNames = colorParts.map((part) => part.name).join(' + ');
      const objectName = `color-${String(colorIndex).padStart(2, '0')}-${color}${sourceNames ? ` (${sourceNames})` : ''}`;
      return `<object id="${objectId}" name="${escapeXml(objectName)}" type="model" pid="1" pindex="${colorIndex}">${combinedMeshXml(colorParts, minZ, colorIndex)}</object>`;
    })
    .join('');
  const buildItems = colorGroups
    .map((_, groupIndex) => `<item objectid="${2 + groupIndex}"/>`)
    .join('');
  const materialManifest = JSON.stringify(
    colorGroups.map(([colorIndex, colorParts]) => ({
      index: colorIndex,
      rgb: colorMap.colors[colorIndex],
      hex: colorHex(colorMap.colors[colorIndex] ?? [0, 0, 0]),
      parts: colorParts.map((part) => part.name),
    })),
    null,
    2,
  );

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
      `<Default Extension="json" ContentType="application/json"/>` +
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
      'Metadata/materials.json': strToU8(materialManifest),
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
