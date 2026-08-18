import { createLampModule, MODULE_SHAPES, type HardwareId, type LampModule, type ModuleKind, type ModuleShape } from './model';

export type ModulePresetCategory = 'shade' | 'decor' | 'base';

export type ModulePreset = {
  id: string;
  category: ModulePresetCategory;
  nameKey?: string;
  descriptionKey?: string;
  name?: string;
  custom?: boolean;
  module: Omit<LampModule, 'id'>;
};

const modulePreset = (
  id: string,
  category: ModulePresetCategory,
  shape: ModuleShape,
  dimensions: { diameter: number; height: number; wallThickness?: number },
  color: string,
): ModulePreset => {
  const kind = category === 'decor' ? 'decor' : category;
  const { id: _id, ...defaults } = createLampModule(kind, 'BAMBU_LED_KIT_001');
  return {
    id,
    category,
    nameKey: `moduleLibrary.preset.${id}.name`,
    descriptionKey: `moduleLibrary.preset.${id}.description`,
    module: {
      ...defaults,
      name: id,
      kind,
      shape,
      diameter: dimensions.diameter,
      height: dimensions.height,
      wallThickness: dimensions.wallThickness ?? defaults.wallThickness,
      color,
      presetId: id,
    },
  };
};

export const BUILT_IN_MODULE_PRESETS: ModulePreset[] = [
  modulePreset('ringed-drum', 'shade', 'shade-ringed-drum', { diameter: 178, height: 190, wallThickness: 1.6 }, '#eee9df'),
  modulePreset('pleated-cone', 'shade', 'shade-pleated-cone', { diameter: 196, height: 172, wallThickness: 1.5 }, '#f1eee7'),
  modulePreset('smooth-drum', 'shade', 'shade-smooth-drum', { diameter: 166, height: 174, wallThickness: 1.6 }, '#e8e5df'),
  modulePreset('soft-globe', 'shade', 'shade-globe', { diameter: 178, height: 154, wallThickness: 1.5 }, '#eeeae3'),
  modulePreset('ribbed-drum', 'shade', 'shade-ribbed-drum', { diameter: 172, height: 160, wallThickness: 1.5 }, '#ece8df'),
  modulePreset('square-shade', 'shade', 'shade-square', { diameter: 178, height: 164, wallThickness: 1.8 }, '#e9e5dc'),
  modulePreset('round-body', 'decor', 'decor-sphere', { diameter: 94, height: 78, wallThickness: 2.2 }, '#2f7f48'),
  modulePreset('faceted-body', 'decor', 'decor-faceted', { diameter: 104, height: 70, wallThickness: 2.2 }, '#334b9a'),
  modulePreset('donut-body', 'decor', 'decor-torus', { diameter: 108, height: 42, wallThickness: 2.4 }, '#ef7e2d'),
  modulePreset('diamond-body', 'decor', 'decor-diamond', { diameter: 112, height: 72, wallThickness: 2.2 }, '#c83b36'),
  modulePreset('cube-body', 'decor', 'decor-cube', { diameter: 88, height: 82, wallThickness: 2.4 }, '#efc24d'),
  modulePreset('round-base', 'base', 'base-disc', { diameter: 156, height: 28, wallThickness: 2.8 }, '#3d743f'),
  modulePreset('square-base', 'base', 'base-square', { diameter: 150, height: 26, wallThickness: 2.8 }, '#e7ba48'),
  modulePreset('flower-base', 'base', 'base-flower', { diameter: 154, height: 25, wallThickness: 2.8 }, '#9d62d7'),
  modulePreset('pyramid-base', 'base', 'base-pyramid', { diameter: 152, height: 32, wallThickness: 2.8 }, '#a82f2e'),
];

const CUSTOM_LIBRARY_STORAGE_KEY = 'hometown-module-library';

const categoryFromKind = (kind: ModuleKind): ModulePresetCategory => kind === 'shade' || kind === 'sketch' ? 'shade' : kind === 'base' || kind === 'core' ? 'base' : 'decor';

export function createModuleFromPreset(preset: ModulePreset, hardware: HardwareId, localizedName?: string): LampModule {
  const defaults = createLampModule(preset.module.kind, hardware);
  return { ...defaults, ...preset.module, id: defaults.id, name: localizedName || preset.name || preset.module.name, presetId: preset.id, visible: true, offsetY: 0 };
}

export function createCustomPreset(module: LampModule): ModulePreset {
  const { id: _id, ...snapshot } = module;
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: categoryFromKind(module.kind),
    name: module.name,
    custom: true,
    module: { ...snapshot, presetId: undefined },
  };
}

export function loadCustomModulePresets(): ModulePreset[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_LIBRARY_STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 100).flatMap((value) => {
      if (!value || typeof value !== 'object') return [];
      const preset = value as Partial<ModulePreset>; const module = preset.module as Partial<LampModule> | undefined;
      if (!preset.id || !preset.name || !module || !module.kind || !MODULE_SHAPES.includes(module.shape ?? 'standard')) return [];
      return [{ ...preset, custom: true, category: categoryFromKind(module.kind), module } as ModulePreset];
    });
  } catch {
    return [];
  }
}

export function saveCustomModulePresets(presets: ModulePreset[]) {
  localStorage.setItem(CUSTOM_LIBRARY_STORAGE_KEY, JSON.stringify(presets.filter((preset) => preset.custom).slice(0, 100)));
}
