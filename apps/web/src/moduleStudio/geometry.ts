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

const verticalRibs = (module: LampModule, count: number, radiusScale = .94, taper = 0): ModuleGeometryPart[] => Array.from({ length: count }, (_, index) => {
  const angle = index / count * Math.PI * 2; const yScale = module.height * .92; const radius = module.diameter / 2 * radiusScale;
  const geometry = new THREE.BoxGeometry(Math.max(.9, module.wallThickness * .72), yScale, Math.max(1.3, module.wallThickness * 1.05));
  if (taper) geometry.rotateZ(taper * Math.sin(angle));
  return { geometry, position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number], rotation: [0, -angle, 0] as [number, number, number], role: 'body' as const };
});

const coneRibs = (module: LampModule, count: number, bottomScale = 1, topScale = .72): ModuleGeometryPart[] => Array.from({ length: count }, (_, index) => {
  const angle = index / count * Math.PI * 2; const bottomRadius = module.diameter / 2 * bottomScale; const topRadius = module.diameter / 2 * topScale;
  const radialDelta = topRadius - bottomRadius; const length = Math.hypot(module.height * .94, radialDelta); const midRadius = (bottomRadius + topRadius) / 2;
  return { geometry: new THREE.CylinderGeometry(Math.max(.65, module.wallThickness * .48), Math.max(.75, module.wallThickness * .55), length, 6), position: [Math.cos(angle) * midRadius, 0, Math.sin(angle) * midRadius] as [number, number, number], rotation: [0, -angle, -Math.atan2(radialDelta, module.height)] as [number, number, number], role: 'body' as const };
});

const horizontalRings = (module: LampModule, count: number, radiusScale = .95): ModuleGeometryPart[] => Array.from({ length: count }, (_, index) => ({
  geometry: new THREE.TorusGeometry(module.diameter / 2 * radiusScale, Math.max(.65, module.wallThickness * .48), 6, 96),
  position: [0, -module.height / 2 + (index + .7) / count * module.height, 0] as [number, number, number], rotation: [Math.PI / 2, 0, 0] as [number, number, number], role: 'body' as const,
}));

function createSquareShade(module: LampModule): ModuleGeometryPart[] {
  const width = module.diameter; const depth = module.diameter * .82; const wall = module.wallThickness; const height = module.height;
  const parts: ModuleGeometryPart[] = [
    { geometry: new THREE.BoxGeometry(width, height, wall), position: [0, 0, depth / 2 - wall / 2], role: 'body' },
    { geometry: new THREE.BoxGeometry(width, height, wall), position: [0, 0, -depth / 2 + wall / 2], role: 'body' },
    { geometry: new THREE.BoxGeometry(wall, height, depth - wall * 2), position: [width / 2 - wall / 2, 0, 0], role: 'body' },
    { geometry: new THREE.BoxGeometry(wall, height, depth - wall * 2), position: [-width / 2 + wall / 2, 0, 0], role: 'body' },
  ];
  for (let index = 1; index < 12; index += 1) {
    const y = -height / 2 + index / 12 * height; const rib = Math.max(.7, wall * .45);
    parts.push(
      { geometry: new THREE.BoxGeometry(width + rib, rib, rib), position: [0, y, depth / 2], role: 'body' },
      { geometry: new THREE.BoxGeometry(width + rib, rib, rib), position: [0, y, -depth / 2], role: 'body' },
      { geometry: new THREE.BoxGeometry(rib, rib, depth), position: [width / 2, y, 0], role: 'body' },
      { geometry: new THREE.BoxGeometry(rib, rib, depth), position: [-width / 2, y, 0], role: 'body' },
    );
  }
  return parts;
}

function createFlowerGeometry(radius: number, height: number) {
  const shape = new THREE.Shape(); const petals = 12;
  for (let index = 0; index <= petals * 2; index += 1) {
    const angle = index / (petals * 2) * Math.PI * 2; const currentRadius = radius * (index % 2 ? .84 : 1);
    const x = Math.cos(angle) * currentRadius; const y = Math.sin(angle) * currentRadius;
    if (index === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelSegments: 2, bevelSize: Math.min(2, height * .12), bevelThickness: Math.min(2, height * .12), curveSegments: 2 });
  geometry.center(); geometry.rotateX(-Math.PI / 2); geometry.computeVertexNormals(); return geometry;
}

function connectorCollar(module: LampModule, top = true): ModuleGeometryPart {
  const outerRadius = Math.min(25, Math.max(17, module.diameter * .2)); const innerRadius = Math.max(8, outerRadius - module.wallThickness * 2.2);
  return { geometry: createRingGeometry(outerRadius, innerRadius, 5), position: [0, (top ? 1 : -1) * (module.height / 2 + 1.5), 0], role: 'body' };
}

function buildLibraryShape(module: LampModule): ModuleGeometryPart[] | null {
  const shape = module.shape ?? 'standard'; const radius = module.diameter / 2;
  if (shape === 'standard') return null;
  if (shape === 'shade-ringed-drum') return [{ geometry: createSketchShell(module, [{ radius: .95, height: 0 }, { radius: .95, height: 1 }]), role: 'body' }, ...horizontalRings(module, 18)];
  if (shape === 'shade-pleated-cone') return [{ geometry: createSketchShell(module, [{ radius: 1, height: 0 }, { radius: .72, height: 1 }]), role: 'body' }, ...coneRibs(module, 32)];
  if (shape === 'shade-smooth-drum') return [{ geometry: createSketchShell(module, [{ radius: .94, height: 0 }, { radius: .94, height: 1 }]), role: 'body' }];
  if (shape === 'shade-globe') return [{ geometry: createSketchShell(module, [{ radius: .72, height: 0 }, { radius: .9, height: .18 }, { radius: 1, height: .5 }, { radius: .9, height: .82 }, { radius: .74, height: 1 }]), role: 'body' }];
  if (shape === 'shade-ribbed-drum') return [{ geometry: createSketchShell(module, [{ radius: .93, height: 0 }, { radius: .93, height: 1 }]), role: 'body' }, ...verticalRibs(module, 36, .94)];
  if (shape === 'shade-square') return createSquareShade(module);
  if (shape === 'decor-sphere') { const geometry = new THREE.SphereGeometry(radius, 64, 40); geometry.scale(1, module.height / module.diameter, 1); return [{ geometry, role: 'body' }, connectorCollar(module), connectorCollar(module, false)]; }
  if (shape === 'decor-faceted') { const geometry = new THREE.DodecahedronGeometry(radius, 0); geometry.scale(1, module.height / module.diameter, 1); return [{ geometry, role: 'body' }, connectorCollar(module), connectorCollar(module, false)]; }
  if (shape === 'decor-torus') { const geometry = new THREE.TorusGeometry(radius * .62, radius * .3, 18, 72); geometry.rotateX(Math.PI / 2); geometry.scale(1, module.height / Math.max(1, radius * .6), 1); return [{ geometry, role: 'body' }, connectorCollar(module), connectorCollar(module, false)]; }
  if (shape === 'decor-diamond') return [
    { geometry: new THREE.CylinderGeometry(0, radius, module.height / 2, 8), position: [0, module.height / 4, 0], role: 'body' },
    { geometry: new THREE.CylinderGeometry(radius, 0, module.height / 2, 8), position: [0, -module.height / 4, 0], role: 'body' }, connectorCollar(module), connectorCollar(module, false),
  ];
  if (shape === 'decor-cube') return [{ geometry: new THREE.BoxGeometry(module.diameter * .78, module.height, module.diameter * .78), role: 'body' }, connectorCollar(module), connectorCollar(module, false)];
  if (shape === 'base-disc') return [{ geometry: new THREE.CylinderGeometry(radius, radius, module.height, 96), role: 'body' }, connectorCollar(module)];
  if (shape === 'base-square') return [{ geometry: new THREE.BoxGeometry(module.diameter, module.height, module.diameter * .82), role: 'body' }, connectorCollar(module)];
  if (shape === 'base-flower') return [{ geometry: createFlowerGeometry(radius, module.height), role: 'body' }, connectorCollar(module)];
  if (shape === 'base-pyramid') return [{ geometry: new THREE.CylinderGeometry(radius * .24, radius, module.height, 4), role: 'body' }, connectorCollar(module)];
  return null;
}

function createJointPart(module: LampModule, joint: JointType, top: boolean): ModuleGeometryPart[] {
  if (joint === 'none') return [];
  const radius = ['sketch', 'shade', 'base'].includes(module.kind) ? Math.min(40, module.diameter / 2 - module.wallThickness * 1.5) : Math.max(16, module.diameter / 2 - module.wallThickness * 1.5);
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
  const libraryShape = buildLibraryShape(module);
  if (libraryShape) body = libraryShape;
  else if (module.kind === 'sketch') {
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
