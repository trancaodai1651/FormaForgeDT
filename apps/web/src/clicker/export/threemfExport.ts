import { getClickerDocument } from '../runtime';
// src/export/threemfExport.ts
import { zipSync, strToU8 } from 'fflate';
import type { ClickerPart, PartGroup, RGB } from '../types';
import { splitMeshShells } from './meshUtils';
import { defaultSlicerExport, prepareSlicerLayout, type SlicerExportOptions } from './slicerLayout';

// Preserve round-trip coordinates: quantization can collapse narrow triangles.
const f = (n: number): string => String(n);

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


function hex(rgb: RGB): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(rgb[0])}${h(rgb[1])}${h(rgb[2])}FF`;
}

function assignExtruders(parts: ClickerPart[]): { extruders: number[]; colors: string[] } {
  const slotByColor = new Map<string, number>();
  const extruders = parts.map((p) => {
    const key = hex(p.colorRgb);
    let slot = slotByColor.get(key);
    if (slot === undefined) {
      slot = slotByColor.size + 1;
      slotByColor.set(key, slot);
    }
    // Imported slot numbers refer to the source project's palette. Rebuild
    // them from the final RGB so recoloring cannot reuse an unrelated slot.
    return slot;
  });
  return { extruders, colors: [...slotByColor.keys()] };
}

function meshXml(p: ClickerPart, vertex: (part: ClickerPart, index: number) => [number, number, number]): string {
  const np = p.numProp;
  const vp = p.vertProperties;
  const tv = p.triVerts;
  const verts: string[] = [];
  for (let i = 0; i < vp.length; i += np) {
    const [x, y, z] = vertex(p, i);
    verts.push(`<vertex x="${f(x)}" y="${f(y)}" z="${f(z)}"/>`);
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

export function buildThreeMF(rawParts: ClickerPart[], options: SlicerExportOptions = defaultSlicerExport()): Uint8Array {
  // Validate and partition volumes without changing the generated surfaces.
  const shells = rawParts.map(splitMeshShells);
  // Keep each original part's first leaf ID stable; append additional shells.
  const parts = [...shells.map(parts => parts[0]), ...shells.flatMap(parts => parts.slice(1))]
    .filter(part => part.triVerts.length >= 3);

  const layout = prepareSlicerLayout(parts, options);
  const profile = layout.profile;
  const { extruders, colors } = assignExtruders(parts);

  const groups: { id: PartGroup; label: string }[] = [
    { id: 'top', label: 'clicker_top' },
    { id: 'base', label: 'clicker_base' },
  ].filter((g) => parts.some((p) => p.group === g.id)) as { id: PartGroup; label: string }[];

  const baseMaterials = parts
    .map((p) => `<base name="${esc(p.name)}" displaycolor="${hex(p.colorRgb)}"/>`)
    .join('');
  const leafObjects = parts
    .map((p, i) => `<object id="${i + 2}" type="model" pid="1" pindex="${i}">${meshXml(p, layout.vertex)}</object>`)
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

  const buildItems = groups
    .map((g, gi) => {
      const placement = layout.placements.get(g.id)!;
      const xform = transformAttr(1, 0, 0, 0, 1, 0, 0, 0, 1, placement.x, placement.y, 0);
      return `<item objectid="${firstWrapperId + gi}"${xform}/>`;
    })
    .join('');

  const viteEnv: Record<string, string> = ((import.meta as unknown as { env?: Record<string, string> }).env) ?? {};
  const buildId = viteEnv.VITE_BUILD_ID ?? 'dev';
  const creationDate = new Date().toISOString().slice(0, 10);
  const metadata =
    `<metadata name="BambuStudio:3mfVersion">1</metadata>` +
    `<metadata name="Title">Clicker</metadata>` +
    `<metadata name="Designer">FormaForgeDT</metadata>` +
    // Both slicers recognize their project palette via this compatibility
    // identifier. Keep actual authorship in Generator.
    `<metadata name="Application">${profile.application}</metadata>` +
    `<metadata name="CreationDate">${creationDate}</metadata>` +
    `<metadata name="Generator">FormaForgeDT Clicker Generator</metadata>` +
    `<metadata name="Build">${esc(buildId)}</metadata>`;

  const model =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="en-US"` +
    ` xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"` +
    ` xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"` +
    ` xmlns:BambuStudio="http://schemas.bambulab.com/package/2021">` +
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
              `<metadata key="name" value="${esc(p.name)}"/>` +
              `<metadata key="extruder" value="${extruders[i]}"/>` +
              `</part>`
            : '',
        )
        .join('');
      return (
        `<object id="${firstWrapperId + gi}">` +
        `<metadata key="name" value="${g.label}"/>` +
        `<metadata key="extruder" value="1"/>` +
        `<metadata key="enable_support" value="${layout.supportEnabled ? '1' : '0'}"/>` +
        partsCfg +
        `</object>`
      );
    })
    .join('');
  const modelSettings =
    `<?xml version="1.0" encoding="UTF-8"?>\n` + `<config>` + objectCfg + `</config>`;

  // Object display colors alone are insufficient for a project import:
  // slicers render assigned filament slots from this separate palette.
  // Target-specific compatibility preset; select the actual printer in slicer.
  const projectSettings = JSON.stringify({
    name: 'project_settings',
    version: profile.version,
    // A complete single-nozzle compatibility preset is required for Bambu
    // project import. An incomplete config is ignored, including its palette.
    printer_technology: 'FFF',
    printer_model: profile.model,
    printer_settings_id: profile.printer,
    print_settings_id: profile.process,
    gcode_flavor: profile.flavor,
    nozzle_diameter: ['0.4'],
    printable_area: ['0x0', `${profile.bed}x0`, `${profile.bed}x${profile.bed}`, `0x${profile.bed}`],
    printable_height: String(profile.bed),
    single_extruder_multi_material: '1',
    enable_support: layout.supportEnabled ? '1' : '0',
    support_type: 'normal(auto)',
    support_on_build_plate_only: '0',
    layer_height: '0.2',
    initial_layer_print_height: '0.2',
    filament_settings_id: colors.map(() => profile.filament),
    filament_colour: colors.map(color => color.slice(0, 7)),
    filament_type: colors.map(() => 'PLA'),
    filament_diameter: colors.map(() => '1.75'),
  });

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>` +
    `<Default Extension="config" ContentType="text/xml"/>` +
    `<Default Extension="txt" ContentType="text/plain"/>` +
    `<Override PartName="/Metadata/project_settings.config" ContentType="application/json"/>` +
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
    `Slicer: ${profile.label} (${profile.model}, 0.4 mm compatibility preset)`,
    `Top orientation: ${layout.flipTop ? 'face-down' : 'face-up'}`,
    `Supports: ${layout.supportEnabled ? 'enabled' : 'disabled'}`,
    'Open as a project to retain filament slots, multipart placement and supports.',
    'Select your actual printer/nozzle and filament before slicing.',
  ].join('\n');

  return zipSync(
    {
      '[Content_Types].xml': strToU8(contentTypes),
      '_rels/.rels': strToU8(rels),
      '3D/3dmodel.model': strToU8(model),
      'Metadata/model_settings.config': strToU8(modelSettings),
      'Metadata/project_settings.config': strToU8(projectSettings),
      'Metadata/generator.txt': strToU8(provenance),
    },
    { level: 6 },
  );
}

export function downloadThreeMF(parts: ClickerPart[], fileName = 'clicker.3mf', options: SlicerExportOptions = defaultSlicerExport()) {
  const bytes = buildThreeMF(parts, options);
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
