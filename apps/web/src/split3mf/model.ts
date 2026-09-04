import * as THREE from 'three';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { parse3MF } from '../clicker/geometry/threemfImport';
import { boundsOfMesh, meshFromBufferGeometry, translateMesh, type CutterMesh } from '../stlCutter/geometry';
import { parseThreeMfCore } from './threeMfCore';

export type ImportedThreeMfRegion = {
  name: string;
  color: string;
  mesh: CutterMesh;
};

const FALLBACK_COLORS = ['#20201f', '#e94b22', '#0a867b', '#f4a33a', '#dedbd3', '#6d5bd0', '#2d74da', '#ef7aa8'];

function readableName(value: string, fallback: string): string {
  const normalized = value.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  return normalized || fallback;
}

function colorOf(material: THREE.Material | undefined, index: number): string {
  const colored = material as (THREE.Material & { color?: THREE.Color }) | undefined;
  return colored?.color ? `#${colored.color.getHexString()}` : FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function geometryRangeToMesh(source: THREE.BufferGeometry, matrix: THREE.Matrix4, start: number, count: number): CutterMesh | null {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  try {
    const position = geometry.getAttribute('position');
    if (!position) return null;
    const from = Math.max(0, Math.min(position.count, start));
    const to = Math.max(from, Math.min(position.count, start + count));
    if (to - from < 3) return null;
    const point = new THREE.Vector3();
    const vertices: number[] = [];
    for (let vertex = from; vertex < to; vertex += 1) {
      point.fromBufferAttribute(position as THREE.BufferAttribute, vertex).applyMatrix4(matrix);
      vertices.push(point.x, point.y, point.z);
    }
    return { vertices, indices: Array.from({ length: to - from }, (_, index) => index) };
  } finally {
    geometry.dispose();
  }
}

function normalizeTogether(regions: ImportedThreeMfRegion[]): ImportedThreeMfRegion[] {
  const boxes = regions.map((region) => boundsOfMesh(region.mesh));
  const min: [number, number, number] = [
    Math.min(...boxes.map((box) => box.min[0])),
    Math.min(...boxes.map((box) => box.min[1])),
    Math.min(...boxes.map((box) => box.min[2])),
  ];
  const max: [number, number, number] = [
    Math.max(...boxes.map((box) => box.max[0])),
    Math.max(...boxes.map((box) => box.max[1])),
    Math.max(...boxes.map((box) => box.max[2])),
  ];
  const shift: [number, number, number] = [-(min[0] + max[0]) / 2, -(min[1] + max[1]) / 2, -min[2]];
  return regions.map((region) => ({ ...region, mesh: translateMesh(region.mesh, shift) }));
}

export function parseThreeMfRegions(data: ArrayBuffer, fileName = 'model.3mf'): ImportedThreeMfRegion[] {
  const baseName = readableName(fileName.replace(/\.3mf$/i, ''), '3MF model');
  const coreRegions = parseThreeMfCore(data.slice(0));
  if (coreRegions.length) return normalizeTogether(coreRegions.map((region, index) => ({
    name: `${baseName} · ${readableName(region.name, `Color region ${index + 1}`)}`,
    color: region.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length],
    mesh: { vertices: region.vertices, indices: region.indices },
  })));
  const root = new ThreeMFLoader().parse(data);
  root.updateMatrixWorld(true);
  const regions: ImportedThreeMfRegion[] = [];
  let regionIndex = 0;

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const groups = object.geometry.groups.length
      ? object.geometry.groups
      : [{ start: 0, count: object.geometry.index?.count ?? object.geometry.getAttribute('position')?.count ?? 0, materialIndex: 0 }];
    for (const group of groups) {
      const mesh = geometryRangeToMesh(object.geometry, object.matrixWorld, group.start, group.count);
      if (!mesh) continue;
      const material = materials[group.materialIndex ?? 0] ?? materials[0];
      const materialName = readableName(material?.name ?? '', `Color region ${regionIndex + 1}`);
      regions.push({ name: `${baseName} · ${materialName}`, color: colorOf(material, regionIndex), mesh });
      regionIndex += 1;
    }
  });

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });

  if (regions.length) return normalizeTogether(regions);

  const fallback = parse3MF(data.slice(0));
  return normalizeTogether([{ name: `${baseName} · Model`, color: FALLBACK_COLORS[0], mesh: { vertices: Array.from(fallback.vertProperties), indices: Array.from(fallback.triVerts) } }]);
}

function primitive(geometry: THREE.BufferGeometry, name: string, color: string): ImportedThreeMfRegion {
  try {
    return { name, color, mesh: meshFromBufferGeometry(geometry) };
  } finally {
    geometry.dispose();
  }
}

export function makeThreeMfDemo(): ImportedThreeMfRegion[] {
  const body = new THREE.SphereGeometry(22, 48, 32).scale(1, .82, 1.25).translate(0, 0, 31);
  const belly = new THREE.SphereGeometry(16.5, 42, 28).scale(.9, .55, 1.15).translate(0, -15.5, 29);
  const head = new THREE.SphereGeometry(17.5, 44, 28).scale(1, .92, .92).translate(0, -1, 61);
  const beak = new THREE.ConeGeometry(7, 17, 32).rotateX(Math.PI / 2).translate(0, -25, 59);
  const leftFoot = new THREE.SphereGeometry(9, 32, 20).scale(1.45, .82, .42).translate(-11, -4, 5);
  const rightFoot = new THREE.SphereGeometry(9, 32, 20).scale(1.45, .82, .42).translate(11, -4, 5);
  return normalizeTogether([
    primitive(body, 'Demo · Body', '#20201f'),
    primitive(belly, 'Demo · Belly', '#dedbd3'),
    primitive(head, 'Demo · Head', '#20201f'),
    primitive(beak, 'Demo · Beak', '#ef4b23'),
    primitive(leftFoot, 'Demo · Left foot', '#f49b32'),
    primitive(rightFoot, 'Demo · Right foot', '#f49b32'),
  ]);
}

export { smoothMeshBoundary, surfaceArea } from './meshUtils';
