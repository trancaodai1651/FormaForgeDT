import { HARDWARE_SPECS } from '@hometown/types';
import { sanitizeCadDocument, type CadDocument } from './cad';

export type HardwareId = 'E27' | 'BAMBU_LED_KIT_001';
export type ModuleKind = 'core' | 'adapter' | 'sketch' | 'spacer' | 'diffuser' | 'cap' | 'shade' | 'decor' | 'base';
export type JointType = 'bayonet' | 'thread' | 'snap' | 'dovetail' | 'none';
export type ModuleShape =
  | 'standard' | 'shade-ringed-drum' | 'shade-pleated-cone' | 'shade-smooth-drum'
  | 'shade-globe' | 'shade-ribbed-drum' | 'shade-square'
  | 'decor-sphere' | 'decor-faceted' | 'decor-torus' | 'decor-diamond' | 'decor-cube'
  | 'base-disc' | 'base-square' | 'base-flower' | 'base-pyramid';

export const MODULE_SHAPES: ModuleShape[] = [
  'standard', 'shade-ringed-drum', 'shade-pleated-cone', 'shade-smooth-drum', 'shade-globe', 'shade-ribbed-drum', 'shade-square',
  'decor-sphere', 'decor-faceted', 'decor-torus', 'decor-diamond', 'decor-cube', 'base-disc', 'base-square', 'base-flower', 'base-pyramid',
];

export type SketchPoint = { radius: number; height: number };

export const MODULE_STUDIO_STORAGE_KEY = 'hometown-module-studio';

const DEFAULT_SKETCH_PROFILE: SketchPoint[] = [
  { radius: .76, height: 0 }, { radius: .84, height: .12 }, { radius: .94, height: .38 },
  { radius: 1, height: .66 }, { radius: .92, height: .88 }, { radius: .86, height: 1 },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function sanitizeSketch(points: SketchPoint[]): SketchPoint[] {
  const safe = points
    .map((point) => ({ radius: clamp(Number(point.radius), .3, 1), height: clamp(Number(point.height), 0, 1) }))
    .filter((point) => Number.isFinite(point.radius) && Number.isFinite(point.height))
    .sort((a, b) => a.height - b.height);
  if (safe.length < 2) return [{ radius: .78, height: 0 }, { radius: .86, height: 1 }];

  const buckets = new Map<number, number[]>();
  for (const point of safe) {
    const bucket = Math.round(point.height * 20);
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), point.radius]);
  }
  let profile = [...buckets.entries()].map(([bucket, radii]) => ({
    height: bucket / 20,
    radius: radii.reduce((sum, radius) => sum + radius, 0) / radii.length,
  })).sort((a, b) => a.height - b.height);
  if (profile[0].height > 0) profile.unshift({ height: 0, radius: profile[0].radius });
  if (profile.at(-1)!.height < 1) profile.push({ height: 1, radius: profile.at(-1)!.radius });
  const roughness = profile.slice(1).reduce((sum, point, index) => sum + Math.abs(point.radius - profile[index].radius), 0);
  if (roughness > 1.45) return DEFAULT_SKETCH_PROFILE.map((point) => ({ ...point }));

  for (let pass = 0; pass < 2; pass += 1) {
    profile = profile.map((point, index, source) => index === 0 || index === source.length - 1 ? point : ({
      height: point.height,
      radius: source[index - 1].radius * .2 + point.radius * .6 + source[index + 1].radius * .2,
    }));
  }
  for (let index = 1; index < profile.length; index += 1) {
    profile[index].radius = clamp(profile[index].radius, profile[index - 1].radius - .16, profile[index - 1].radius + .16);
  }
  return profile.map((point) => ({ height: point.height, radius: clamp(point.radius, .3, 1) }));
}

export type LampModule = {
  id: string;
  name: string;
  kind: ModuleKind;
  diameter: number;
  height: number;
  wallThickness: number;
  offsetY: number;
  rotation: number;
  color: string;
  topJoint: JointType;
  bottomJoint: JointType;
  clearance: number;
  lockAngle: number;
  visible: boolean;
  shape?: ModuleShape;
  presetId?: string;
};

export type ModuleStudioProject = {
  version: 1;
  name: string;
  hardware: HardwareId;
  sketch: SketchPoint[];
  modules: LampModule[];
  lightOn: boolean;
  lightTemperature: number;
  brightness: number;
  cadSketch?: CadDocument;
  updatedAt: string;
};

export const JOINT_CATALOG: Array<{ id: JointType; label: string; description: string }> = [
  { id: 'bayonet', label: 'Core Bayonet', description: 'Twist-lock 35° · removable · FDM friendly' },
  { id: 'thread', label: 'Quarter Thread', description: 'Short helical lock · high axial retention' },
  { id: 'snap', label: 'Flex Snap', description: 'Tool-free clip · fast module changes' },
  { id: 'dovetail', label: 'Slide Rail', description: 'Guided dovetail · controlled alignment' },
  { id: 'none', label: 'Open', description: 'No connector on this face' },
];

export const HARDWARE_CATALOG = {
  E27: {
    id: 'E27' as const,
    name: 'E27 Socket',
    shortName: 'E27',
    diameter: HARDWARE_SPECS.E27.socketDiameter,
    height: HARDWARE_SPECS.E27.socketHeight,
    clearance: HARDWARE_SPECS.E27.clearance,
    reference: HARDWARE_SPECS.E27.reference,
  },
  BAMBU_LED_KIT_001: {
    id: 'BAMBU_LED_KIT_001' as const,
    name: 'Bambu Lab LED Kit 001',
    shortName: 'Bambu 001',
    diameter: HARDWARE_SPECS.BAMBU_LED_KIT_001.moduleDiameter,
    height: HARDWARE_SPECS.BAMBU_LED_KIT_001.moduleHeight,
    clearance: HARDWARE_SPECS.BAMBU_LED_KIT_001.clearance,
    reference: HARDWARE_SPECS.BAMBU_LED_KIT_001.reference,
  },
};

export const SKETCH_PRESETS: Record<'soft' | 'tower' | 'wave' | 'bell', SketchPoint[]> = {
  soft: [
    ...DEFAULT_SKETCH_PROFILE.map((point) => ({ ...point })),
  ],
  tower: [
    { radius: .72, height: 0 }, { radius: .7, height: .25 }, { radius: .64, height: .58 },
    { radius: .57, height: .82 }, { radius: .5, height: 1 },
  ],
  wave: [
    { radius: .58, height: 0 }, { radius: .75, height: .18 }, { radius: .56, height: .38 },
    { radius: .74, height: .58 }, { radius: .55, height: .78 }, { radius: .68, height: 1 },
  ],
  bell: [
    { radius: .82, height: 0 }, { radius: .74, height: .15 }, { radius: .61, height: .42 },
    { radius: .52, height: .72 }, { radius: .48, height: 1 },
  ],
};

let moduleSequence = 0;
export function createLampModule(kind: ModuleKind, hardware: HardwareId, index = 0): LampModule {
  moduleSequence += 1;
  const hardwareSpec = HARDWARE_CATALOG[hardware];
  const defaults: Record<ModuleKind, Omit<LampModule, 'id' | 'kind'>> = {
    core: { name: 'Core Base', diameter: 84, height: 24, wallThickness: 2.4, offsetY: 0, rotation: 0, color: '#25282d', topJoint: 'bayonet', bottomJoint: 'none', clearance: .35, lockAngle: 35, visible: true },
    adapter: { name: `${hardwareSpec.shortName} Adapter`, diameter: Math.max(60, hardwareSpec.diameter + 12), height: hardware === 'E27' ? 38 : 20, wallThickness: 2.2, offsetY: 0, rotation: 0, color: '#3a3e45', topJoint: 'bayonet', bottomJoint: 'bayonet', clearance: hardwareSpec.clearance, lockAngle: 35, visible: true },
    sketch: { name: `Sketch Shade ${index + 1}`, diameter: 184, height: 218, wallThickness: 1.6, offsetY: 0, rotation: 0, color: '#e2d7c4', topJoint: 'none', bottomJoint: 'bayonet', clearance: .35, lockAngle: 35, visible: true },
    spacer: { name: `Spacer Ring ${index + 1}`, diameter: 92, height: 18, wallThickness: 2, offsetY: 0, rotation: 0, color: '#b88b52', topJoint: 'bayonet', bottomJoint: 'bayonet', clearance: .35, lockAngle: 35, visible: true },
    diffuser: { name: `Light Diffuser ${index + 1}`, diameter: 112, height: 54, wallThickness: 1.2, offsetY: 0, rotation: 0, color: '#fff4d8', topJoint: 'snap', bottomJoint: 'snap', clearance: .3, lockAngle: 0, visible: true },
    cap: { name: `Top Cap ${index + 1}`, diameter: 118, height: 12, wallThickness: 2, offsetY: 0, rotation: 0, color: '#d7c4a5', topJoint: 'none', bottomJoint: 'snap', clearance: .3, lockAngle: 0, visible: true },
    shade: { name: `Ready Shade ${index + 1}`, diameter: 184, height: 190, wallThickness: 1.6, offsetY: 0, rotation: 0, color: '#eee9df', topJoint: 'none', bottomJoint: 'bayonet', clearance: .35, lockAngle: 35, visible: true, shape: 'shade-smooth-drum' },
    decor: { name: `Decor Body ${index + 1}`, diameter: 92, height: 62, wallThickness: 2.2, offsetY: 0, rotation: 0, color: '#b88b52', topJoint: 'bayonet', bottomJoint: 'bayonet', clearance: .35, lockAngle: 35, visible: true, shape: 'decor-sphere' },
    base: { name: `Decor Base ${index + 1}`, diameter: 142, height: 24, wallThickness: 2.6, offsetY: 0, rotation: 0, color: '#3a3e45', topJoint: 'bayonet', bottomJoint: 'none', clearance: .35, lockAngle: 35, visible: true, shape: 'base-disc' },
  };
  return { id: `module-${Date.now()}-${moduleSequence}`, kind, ...defaults[kind] };
}

export function createDefaultModuleProject(): ModuleStudioProject {
  const hardware: HardwareId = 'BAMBU_LED_KIT_001';
  return {
    version: 1,
    name: 'New modular lamp',
    hardware,
    sketch: SKETCH_PRESETS.soft.map((point) => ({ ...point })),
    modules: [createLampModule('core', hardware), createLampModule('adapter', hardware), createLampModule('sketch', hardware)],
    lightOn: true,
    lightTemperature: 3000,
    brightness: .78,
    updatedAt: new Date().toISOString(),
  };
}

export function parseModuleProject(input: unknown): ModuleStudioProject {
  if (!input || typeof input !== 'object') throw new Error('Invalid module project.');
  const project = input as Partial<ModuleStudioProject>;
  if (project.version !== 1 || !Array.isArray(project.modules) || !Array.isArray(project.sketch)) throw new Error('Unsupported module project format.');
  return {
    ...createDefaultModuleProject(),
    ...project,
    version: 1,
    hardware: project.hardware === 'E27' ? 'E27' : 'BAMBU_LED_KIT_001',
    modules: project.modules.map((module, index) => {
      const migrated = { ...createLampModule(module.kind ?? 'sketch', project.hardware === 'E27' ? 'E27' : 'BAMBU_LED_KIT_001', index), ...module };
      migrated.shape = MODULE_SHAPES.includes(migrated.shape ?? 'standard') ? migrated.shape : 'standard';
      if (migrated.kind === 'sketch' && migrated.diameter === 148 && migrated.height === 178) return { ...migrated, diameter: 184, height: 218 };
      return migrated;
    }),
    sketch: sanitizeSketch(project.sketch),
    cadSketch: sanitizeCadDocument(project.cadSketch),
    updatedAt: new Date().toISOString(),
  };
}

export function loadModuleStudioProject() {
  try {
    const stored = localStorage.getItem(MODULE_STUDIO_STORAGE_KEY);
    return stored ? parseModuleProject(JSON.parse(stored)) : createDefaultModuleProject();
  } catch {
    return createDefaultModuleProject();
  }
}

export function saveModuleStudioProject(project: ModuleStudioProject) {
  localStorage.setItem(MODULE_STUDIO_STORAGE_KEY, JSON.stringify({ ...project, sketch: sanitizeSketch(project.sketch), cadSketch: sanitizeCadDocument(project.cadSketch), updatedAt: new Date().toISOString() }));
}
