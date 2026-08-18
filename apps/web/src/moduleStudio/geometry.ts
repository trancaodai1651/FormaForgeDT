import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { sanitizeSketch, type HardwareId, type JointType, type LampModule, type SketchPoint } from './model';

export type ModuleGeometryPart = {
  geometry: THREE.BufferGeometry;
  position?: [number, number, number];
  rotation?: [number, number, number];
  role: 'body' | 'joint' | 'hardware' | 'light' | 'preview';
};

export type AssemblyPlacement = { module: LampModule; y: number };

export function normalizeSketch(points: SketchPoint[]): SketchPoint[] {
  return sanitizeSketch(points);
}

function createSketchShell(module: LampModule, sketch: SketchPoint[]) {
  const profile = normalizeSketch(sketch);
  const sampled: SketchPoint[] = [];
  for (let index = 0; index <= 48; index += 1) {
    const height = index / 48;
    const upperIndex = Math.max(1, profile.findIndex((point) => point.height >= height));
    const lower = profile[upperIndex - 1] ?? profile[0];
    const upper = profile[upperIndex] ?? profile.at(-1)!;
    const span = Math.max(.0001, upper.height - lower.height);
    const rawT = Math.max(0, Math.min(1, (height - lower.height) / span));
    const t = rawT * rawT * (3 - 2 * rawT);
    sampled.push({ height, radius: THREE.MathUtils.lerp(lower.radius, upper.radius, t) });
  }
  const outer = sampled.map((point) => new THREE.Vector2(Math.max(18, point.radius * module.diameter / 2), point.height * module.height - module.height / 2));
  const inner = [...outer].reverse().map((point) => new THREE.Vector2(Math.max(5, point.x - module.wallThickness), point.y));
  const geometry = new THREE.LatheGeometry([...outer, ...inner], 128, 0, Math.PI * 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createRingGeometry(outerRadius: number, innerRadius: number, height: number) {
  const halfHeight = height / 2;
  const geometry = new THREE.LatheGeometry([
    new THREE.Vector2(outerRadius, -halfHeight), new THREE.Vector2(outerRadius, halfHeight),
    new THREE.Vector2(innerRadius, halfHeight), new THREE.Vector2(innerRadius, -halfHeight),
  ], 96);
  geometry.computeVertexNormals();
  return geometry;
}

function createJointPart(module: LampModule, joint: JointType, top: boolean): ModuleGeometryPart[] {
  if (joint === 'none') return [];
  const radius = module.kind === 'sketch' ? Math.min(40, module.diameter / 2 - module.wallThickness * 1.5) : Math.max(16, module.diameter / 2 - module.wallThickness * 1.5);
  const y = (top ? 1 : -1) * (module.height / 2 - 1.2);
  if (joint === 'bayonet') return [
    { geometry: new THREE.TorusGeometry(radius, .85, 8, 72), position: [0, y, 0], rotation: [Math.PI / 2, 0, 0], role: 'joint' },
    { geometry: new THREE.TorusGeometry(radius - 2.2, .55, 8, 72), position: [0, y + (top ? -1.8 : 1.8), 0], rotation: [Math.PI / 2, 0, module.lockAngle * Math.PI / 180], role: 'joint' },
  ];
  if (joint === 'thread') return [0, 1, 2].map((index) => ({ geometry: new THREE.TorusGeometry(radius - index * .35, .58, 7, 72), position: [0, y + (top ? -index * 1.25 : index * 1.25), 0] as [number, number, number], rotation: [Math.PI / 2, index * .06, 0] as [number, number, number], role: 'joint' as const }));
  if (joint === 'snap') return [{ geometry: new THREE.TorusGeometry(radius, .72, 7, 64), position: [0, y, 0], rotation: [Math.PI / 2, 0, 0], role: 'joint' }];
  return [{ geometry: new THREE.TorusGeometry(radius, .9, 4, 64), position: [0, y, 0], rotation: [Math.PI / 2, 0, 0], role: 'joint' }];
}

export function buildModuleGeometry(module: LampModule, sketch: SketchPoint[], hardware: HardwareId): ModuleGeometryPart[] {
  const radius = module.diameter / 2;
  let body: ModuleGeometryPart[];
  if (module.kind === 'sketch') {
    const profile = normalizeSketch(sketch);
    const bottomRadius = profile[0].radius * radius;
    const topRadius = profile.at(-1)!.radius * radius;
    body = [
      { geometry: createSketchShell(module, sketch), role: 'body' },
      { geometry: createRingGeometry(bottomRadius, Math.min(bottomRadius - 5, 37), 2.4), position: [0, -module.height / 2 + 1.2, 0], role: 'body' },
      { geometry: new THREE.TorusGeometry(bottomRadius - module.wallThickness / 2, Math.max(.7, module.wallThickness * .65), 8, 96), position: [0, -module.height / 2 + .6, 0], rotation: [Math.PI / 2, 0, 0], role: 'body' },
      { geometry: new THREE.TorusGeometry(topRadius - module.wallThickness / 2, Math.max(.65, module.wallThickness * .55), 8, 96), position: [0, module.height / 2 - .6, 0], rotation: [Math.PI / 2, 0, 0], role: 'body' },
    ];
  }
  else if (module.kind === 'spacer') body = [
    { geometry: createRingGeometry(radius, Math.max(8, radius - module.wallThickness * 2.2), module.height), role: 'body' },
    { geometry: new THREE.TorusGeometry(radius + 1.5, 2, 10, 72), rotation: [Math.PI / 2, 0, 0], role: 'joint' },
  ];
  else if (module.kind === 'diffuser') body = [{ geometry: new THREE.CylinderGeometry(radius, radius * .96, module.height, 72, 1, false), role: 'light' }];
  else if (module.kind === 'cap') body = [{ geometry: new THREE.CylinderGeometry(radius * .9, radius, module.height, 72, 1, false), role: 'body' }];
  else if (module.kind === 'adapter') {
    const hardwareRadius = hardware === 'E27' ? 21 : 22.5;
    const emitterGeometry = hardware === 'E27' ? new THREE.SphereGeometry(27, 48, 32) : new THREE.CylinderGeometry(21.5, 21.5, 3.5, 64);
    if (hardware === 'E27') emitterGeometry.scale(.78, 1.18, .78);
    body = [
      { geometry: createRingGeometry(radius, hardwareRadius + module.clearance + 1.8, module.height), role: 'body' },
      { geometry: new THREE.CylinderGeometry(hardwareRadius, hardwareRadius * 1.02, Math.max(10, module.height - 4), 64, 1, false), position: [0, 2, 0], role: 'hardware' },
      { geometry: emitterGeometry, position: [0, hardware === 'E27' ? module.height / 2 + 24 : module.height / 2 + 2, 0], role: 'preview' },
    ];
  } else body = [
    { geometry: new THREE.CylinderGeometry(radius * .9, radius, module.height, 72, 2, false), role: 'body' },
    { geometry: new THREE.TorusGeometry(radius * .82, 1.2, 8, 72), position: [0, module.height / 2 - 1.4, 0], rotation: [Math.PI / 2, 0, 0], role: 'joint' },
  ];
  return [...body, ...createJointPart(module, module.bottomJoint, false), ...createJointPart(module, module.topJoint, true)];
}

export function computeAssemblyPlacements(modules: LampModule[]): AssemblyPlacement[] {
  const core = modules.find((module) => module.kind === 'core');
  const baseHeight = core?.height ?? 0;
  let cursor = baseHeight;
  return modules.map((module) => {
    if (module.kind === 'core') return { module, y: module.height / 2 + module.offsetY };
    if (module.kind === 'adapter') return { module, y: baseHeight + module.height / 2 - 1 + module.offsetY };
    const y = cursor + module.height / 2 + module.offsetY;
    cursor += module.height + 2;
    return { module, y };
  });
}

export function getAssemblyDimensions(modules: LampModule[]) {
  const placements = computeAssemblyPlacements(modules).filter(({ module }) => module.visible);
  const minY = placements.length ? Math.min(...placements.map(({ module, y }) => y - module.height / 2)) : 0;
  const maxY = placements.length ? Math.max(...placements.map(({ module, y }) => y + module.height / 2)) : 0;
  return {
    diameter: placements.length ? Math.max(...placements.map(({ module }) => module.diameter)) : 0,
    height: maxY - minY,
  };
}

export function createAssemblyObject(modules: LampModule[], sketch: SketchPoint[], hardware: HardwareId, printableOnly = false) {
  const group = new THREE.Group();
  for (const { module, y } of computeAssemblyPlacements(modules)) {
    if (!module.visible) continue;
    const moduleGroup = new THREE.Group();
    moduleGroup.position.y = y;
    moduleGroup.rotation.y = module.rotation * Math.PI / 180;
    for (const part of buildModuleGeometry(module, sketch, hardware)) {
      if (printableOnly && (part.role === 'hardware' || part.role === 'preview')) { part.geometry.dispose(); continue; }
      const mesh = new THREE.Mesh(part.geometry, new THREE.MeshStandardMaterial({ color: part.role === 'hardware' ? '#17191d' : part.role === 'joint' ? '#ba8b4b' : module.color }));
      if (part.position) mesh.position.set(...part.position);
      if (part.rotation) mesh.rotation.set(...part.rotation);
      moduleGroup.add(mesh);
    }
    group.add(moduleGroup);
  }
  return group;
}

export function exportModuleAssemblySTL(modules: LampModule[], sketch: SketchPoint[], hardware: HardwareId) {
  const assembly = createAssemblyObject(modules, sketch, hardware, true);
  assembly.updateMatrixWorld(true);
  const output = new STLExporter().parse(assembly, { binary: false });
  assembly.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material.dispose();
    }
  });
  return output;
}
