import { HARDWARE_SPECS } from '@hometown/types';

export type HardwareId = 'E27' | 'BAMBU_LED_KIT_001';
export type ModuleKind = 'core' | 'adapter' | 'sketch' | 'spacer' | 'diffuser' | 'cap';
export type JointType = 'bayonet' | 'thread' | 'snap' | 'dovetail' | 'none';

export type SketchPoint = { radius: number; height: number };

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
    { radius: .62, height: 0 }, { radius: .68, height: .18 }, { radius: .72, height: .42 },
    { radius: .67, height: .68 }, { radius: .57, height: .88 }, { radius: .52, height: 1 },
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
    sketch: { name: `Sketch Shade ${index + 1}`, diameter: 148, height: 178, wallThickness: 1.6, offsetY: 0, rotation: 0, color: '#e2d7c4', topJoint: 'none', bottomJoint: 'bayonet', clearance: .35, lockAngle: 35, visible: true },
    spacer: { name: `Spacer Ring ${index + 1}`, diameter: 92, height: 18, wallThickness: 2, offsetY: 0, rotation: 0, color: '#b88b52', topJoint: 'bayonet', bottomJoint: 'bayonet', clearance: .35, lockAngle: 35, visible: true },
    diffuser: { name: `Light Diffuser ${index + 1}`, diameter: 112, height: 54, wallThickness: 1.2, offsetY: 0, rotation: 0, color: '#fff4d8', topJoint: 'snap', bottomJoint: 'snap', clearance: .3, lockAngle: 0, visible: true },
    cap: { name: `Top Cap ${index + 1}`, diameter: 118, height: 12, wallThickness: 2, offsetY: 0, rotation: 0, color: '#d7c4a5', topJoint: 'none', bottomJoint: 'snap', clearance: .3, lockAngle: 0, visible: true },
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
    modules: project.modules.map((module, index) => ({ ...createLampModule(module.kind ?? 'sketch', project.hardware === 'E27' ? 'E27' : 'BAMBU_LED_KIT_001', index), ...module })),
    sketch: project.sketch.map((point) => ({ radius: Number(point.radius), height: Number(point.height) })).filter((point) => Number.isFinite(point.radius) && Number.isFinite(point.height)),
    updatedAt: new Date().toISOString(),
  };
}
