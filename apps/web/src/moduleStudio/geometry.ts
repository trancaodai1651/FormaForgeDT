import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import type { HardwareId, JointType, LampModule, SketchPoint } from './model';

export type ModuleGeometryPart = {
  geometry: THREE.BufferGeometry;
  position?: [number, number, number];
  rotation?: [number, number, number];
  role: 'body' | 'joint' | 'hardware' | 'light';
};

export type AssemblyPlacement = { module: LampModule; y: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function normalizeSketch(points: SketchPoint[]): SketchPoint[] {
  const safe = points
    .map((point) => ({ radius: clamp(point.radius, .12, 1), height: clamp(point.height, 0, 1) }))
    .sort((a, b) => a.height - b.height);
  const merged: SketchPoint[] = [];
  for (const point of safe) {
    const previous = merged.at(-1);
    if (previous && Math.abs(previous.height - point.height) < .025) previous.radius = (previous.radius + point.radius) / 2;
    else merged.push({ ...point });
  }
  if (merged.length < 2) return [{ radius: .6, height: 0 }, { radius: .6, height: 1 }];
  if (merged[0].height > 0) merged.unshift({ radius: merged[0].radius, height: 0 });
  if (merged.at(-1)!.height < 1) merged.push({ radius: merged.at(-1)!.radius, height: 1 });
  return merged;
}

function createSketchShell(module: LampModule, sketch: SketchPoint[]) {
  const profile = normalizeSketch(sketch);
  const outer = profile.map((point) => new THREE.Vector2(Math.max(8, point.radius * module.diameter / 2), point.height * module.height - module.height / 2));
  const inner = [...outer].reverse().map((point) => new THREE.Vector2(Math.max(5, point.x - module.wallThickness), point.y));
  const geometry = new THREE.LatheGeometry([...outer, ...inner], 96, 0, Math.PI * 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createJointPart(module: LampModule, joint: JointType, top: boolean): ModuleGeometryPart[] {
  if (joint === 'none') return [];
  const radius = Math.max(16, module.diameter / 2 - module.wallThickness * 1.5);
  const y = (top ? 1 : -1) * module.height / 2;
  if (joint === 'bayonet') return [
    { geometry: new THREE.TorusGeometry(radius, 1.7, 10, 64), position: [0, y, 0], rotation: [Math.PI / 2, 0, 0], role: 'joint' },
    { geometry: new THREE.TorusGeometry(radius - 3.5, 1.2, 8, 64), position: [0, y + (top ? -2.8 : 2.8), 0], rotation: [Math.PI / 2, 0, module.lockAngle * Math.PI / 180], role: 'joint' },
  ];
  if (joint === 'thread') return [0, 1, 2].map((index) => ({ geometry: new THREE.TorusGeometry(radius - index * .7, 1.15, 8, 64), position: [0, y + (top ? -index * 2 : index * 2), 0] as [number, number, number], rotation: [Math.PI / 2, index * .09, 0] as [number, number, number], role: 'joint' as const }));
  if (joint === 'snap') return [{ geometry: new THREE.TorusGeometry(radius, 1.3, 8, 48), position: [0, y, 0], rotation: [Math.PI / 2, 0, 0], role: 'joint' }];
  return [{ geometry: new THREE.TorusGeometry(radius, 2.1, 4, 4), position: [0, y, 0], rotation: [Math.PI / 2, Math.PI / 4, 0], role: 'joint' }];
}

export function buildModuleGeometry(module: LampModule, sketch: SketchPoint[], hardware: HardwareId): ModuleGeometryPart[] {
  const radius = module.diameter / 2;
  let body: ModuleGeometryPart[];
  if (module.kind === 'sketch') body = [{ geometry: createSketchShell(module, sketch), role: 'body' }];
  else if (module.kind === 'spacer') body = [
    { geometry: new THREE.CylinderGeometry(radius, radius, module.height, 72, 1, false), role: 'body' },
    { geometry: new THREE.TorusGeometry(radius + 1.5, 2, 10, 72), rotation: [Math.PI / 2, 0, 0], role: 'joint' },
  ];
  else if (module.kind === 'diffuser') body = [{ geometry: new THREE.CylinderGeometry(radius, radius * .96, module.height, 72, 1, false), role: 'light' }];
  else if (module.kind === 'cap') body = [{ geometry: new THREE.CylinderGeometry(radius * .9, radius, module.height, 72, 1, false), role: 'body' }];
  else if (module.kind === 'adapter') {
    const hardwareRadius = hardware === 'E27' ? 21 : 22.5;
    body = [
      { geometry: new THREE.CylinderGeometry(radius, radius, module.height, 72, 1, false), role: 'body' },
      { geometry: new THREE.CylinderGeometry(hardwareRadius, hardwareRadius, module.height + 2, 64, 1, false), role: 'hardware' },
    ];
  } else body = [
    { geometry: new THREE.CylinderGeometry(radius * .88, radius, module.height, 72, 1, false), role: 'body' },
    { geometry: new THREE.TorusGeometry(radius * .82, 2.2, 10, 72), position: [0, module.height / 2 - 2, 0], rotation: [Math.PI / 2, 0, 0], role: 'joint' },
  ];
  return [...body, ...createJointPart(module, module.bottomJoint, false), ...createJointPart(module, module.topJoint, true)];
}

export function computeAssemblyPlacements(modules: LampModule[]): AssemblyPlacement[] {
  let cursor = 0;
  return modules.map((module) => {
    const y = cursor + module.height / 2 + module.offsetY;
    cursor += module.height + 3;
    return { module, y };
  });
}

export function getAssemblyDimensions(modules: LampModule[]) {
  const visible = modules.filter((module) => module.visible);
  return {
    diameter: visible.length ? Math.max(...visible.map((module) => module.diameter)) : 0,
    height: visible.reduce((sum, module) => sum + module.height + 3, 0),
  };
}

export function createAssemblyObject(modules: LampModule[], sketch: SketchPoint[], hardware: HardwareId) {
  const group = new THREE.Group();
  for (const { module, y } of computeAssemblyPlacements(modules)) {
    if (!module.visible) continue;
    const moduleGroup = new THREE.Group();
    moduleGroup.position.y = y;
    moduleGroup.rotation.y = module.rotation * Math.PI / 180;
    for (const part of buildModuleGeometry(module, sketch, hardware)) {
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
  const assembly = createAssemblyObject(modules, sketch, hardware);
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
