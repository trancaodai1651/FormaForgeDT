import { strFromU8, unzipSync } from 'fflate';

export type ThreeMfCoreRegion = {
  name: string;
  color: string;
  vertices: number[];
  indices: number[];
};

export type ThreeMfPackageEntries = Record<string, Uint8Array>;

const UNIT_TO_MM: Record<string, number> = { micron: .001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };

export function readThreeMfPackageEntries(data: ArrayBuffer): ThreeMfPackageEntries {
  const files = unzipSync(new Uint8Array(data));
  return Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, bytes.slice()]));
}

function attributes(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of source.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) result[match[1].toLowerCase()] = match[2];
  return result;
}

function cleanColor(value: string | undefined, fallback: string): string {
  const normalized = value?.trim().replace(/^#/, '') ?? '';
  return /^[0-9a-f]{6,8}$/i.test(normalized) ? `#${normalized.slice(0, 6).toLowerCase()}` : fallback;
}

export function parseThreeMfCore(data: ArrayBuffer): ThreeMfCoreRegion[] {
  const files = unzipSync(new Uint8Array(data));
  const modelKey = Object.keys(files).find((key) => key.toLowerCase().endsWith('3dmodel.model'));
  if (!modelKey) throw new Error('3MF: missing 3D/3dmodel.model');
  const xml = strFromU8(files[modelKey]);
  // Component graphs and transformed build items are delegated to ThreeMFLoader,
  // which resolves their complete scene hierarchy in the browser.
  if (/<(?:\w+:)?components\b/i.test(xml) || /<(?:\w+:)?item\b[^>]*\btransform\s*=/i.test(xml)) return [];
  const modelAttributes = attributes(xml.match(/<model\b([^>]*)>/i)?.[1] ?? '');
  const scale = UNIT_TO_MM[(modelAttributes.unit ?? 'millimeter').toLowerCase()] ?? 1;
  const materials = new Map<string, Array<{ name: string; color: string }>>();
  for (const materialGroup of xml.matchAll(/<(?:\w+:)?basematerials\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?basematerials>/gi)) {
    const groupId = attributes(materialGroup[1]).id;
    if (!groupId) continue;
    const bases: Array<{ name: string; color: string }> = [];
    for (const base of materialGroup[2].matchAll(/<(?:\w+:)?base\b([^>]*)\/?\s*>/gi)) {
      const values = attributes(base[1]);
      bases.push({ name: values.name || `Material ${bases.length + 1}`, color: cleanColor(values.displaycolor, '#777777') });
    }
    materials.set(groupId, bases);
  }

  const regions: ThreeMfCoreRegion[] = [];
  let objectNumber = 0;
  for (const objectMatch of xml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/gi)) {
    objectNumber += 1;
    const objectAttributes = attributes(objectMatch[1]);
    const meshMatch = objectMatch[2].match(/<mesh\b[^>]*>([\s\S]*?)<\/mesh>/i);
    if (!meshMatch) continue;
    const vertices: number[] = [];
    for (const vertex of meshMatch[1].matchAll(/<vertex\b([^>]*)\/?\s*>/gi)) {
      const values = attributes(vertex[1]);
      const point = [Number(values.x), Number(values.y), Number(values.z)];
      if (point.every(Number.isFinite)) vertices.push(point[0] * scale, point[1] * scale, point[2] * scale);
    }
    const triangleGroups = new Map<string, number[]>();
    for (const triangle of meshMatch[1].matchAll(/<triangle\b([^>]*)\/?\s*>/gi)) {
      const values = attributes(triangle[1]);
      const indices = [Number(values.v1), Number(values.v2), Number(values.v3)];
      if (!indices.every(Number.isInteger)) continue;
      const pid = values.pid ?? objectAttributes.pid ?? '';
      const pindex = values.p1 ?? values.pindex ?? objectAttributes.pindex ?? '0';
      const key = `${pid}:${pindex}`;
      triangleGroups.set(key, [...(triangleGroups.get(key) ?? []), ...indices]);
    }
    for (const [materialKey, indices] of triangleGroups) {
      if (vertices.length < 9 || indices.length < 3) continue;
      const [pid, pindexText] = materialKey.split(':');
      const material = materials.get(pid)?.[Number(pindexText)];
      const objectName = objectAttributes.name || `Object ${objectNumber}`;
      regions.push({ name: material?.name ? `${objectName} · ${material.name}` : objectName, color: material?.color ?? '#777777', vertices: vertices.slice(), indices });
    }
  }
  return regions;
}
