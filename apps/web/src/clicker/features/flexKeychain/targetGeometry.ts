import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import type { ClickerPart, MeshData, RGB, SwitchPlacement } from '../../types';
import type { FlexKeychainConfig } from './model';
import { hexToRgb, splitName } from './model';

type SlotMeta = { x: number; y: number; restZ: number; rotationRad: number };
type CapMeta = { body: string; glyph: string | null; x: number; y: number };

const BASE_SLOTS: Record<number, SlotMeta[]> = {
  1: [{ x: 92.043, y: 40, restZ: 8.499, rotationRad: 0 }],
  2: [{ x: 81.682, y: 65, restZ: 8.499, rotationRad: 0 }, { x: 102.094, y: 65, restZ: 8.499, rotationRad: 0 }],
  3: [{ x: 71.384, y: 90, restZ: 8.499, rotationRad: 0 }, { x: 92.024, y: 90, restZ: 8.499, rotationRad: 0 }, { x: 112.377, y: 90, restZ: 8.499, rotationRad: 0 }],
  4: [{ x: 61.112, y: 115, restZ: 8.499, rotationRad: 0 }, { x: 81.714, y: 115, restZ: 8.499, rotationRad: 0 }, { x: 102.316, y: 115, restZ: 8.499, rotationRad: 0 }, { x: 122.642, y: 115, restZ: 8.499, rotationRad: 0 }],
  5: [{ x: 50.849, y: 140, restZ: 8.499, rotationRad: 0 }, { x: 71.435, y: 140, restZ: 8.499, rotationRad: 0 }, { x: 92.02, y: 140, restZ: 8.499, rotationRad: 0 }, { x: 112.324, y: 140, restZ: 8.499, rotationRad: 0 }, { x: 132.901, y: 140, restZ: 8.499, rotationRad: 0 }],
  6: [256.591, 277.165, 297.726, 318.299, 338.592, 359.157].map(x => ({ x, y: 67, restZ: 8.499, rotationRad: 0 })),
  7: [246.335, 266.89, 287.453, 308.018, 328.57, 348.859, 369.412].map(x => ({ x, y: 90, restZ: 8.499, rotationRad: 0 })),
  8: [236.08, 256.627, 277.185, 297.741, 318.29, 338.568, 359.119, 379.665].map(x => ({ x, y: 113, restZ: 8.499, rotationRad: 0 })),
  9: [37.29, 50.466, 63.643, 76.792, 90.007, 103.205, 116.353, 129.534, 142.719].map((x, i) => ({ x, y: -188.803 + i * 15.714, restZ: 8.499, rotationRad: 0.872665 })),
  10: [246.719, 259.871, 273.064, 286.243, 299.394, 312.606, 325.766, 338.925, 352.134, 365.29].map((x, i) => ({ x, y: -196.665 + i * 15.711, restZ: 8.499, rotationRad: 0.872665 })),
};

const MODULAR: Record<FlexKeychainConfig['modularStyle'], { file: string; slot: SlotMeta; center: [number, number]; pitch: number }> = {
  bubbly: { file: 'base/modular-bubbly.stl', slot: { x: 128, y: 123.816, restZ: 5.364, rotationRad: 0 }, center: [128, 128], pitch: 26.149 },
  'bubbly-v2': { file: 'base/modular-bubbly-v2.stl', slot: { x: 128, y: -183.478, restZ: 5.013, rotationRad: 0 }, center: [128, -179.2], pitch: 26.149 },
};

const CAP_OFFSETS: Record<string, [number, number]> = {
  A: [90, 175.5], B: [109, 175.5], C: [128, 175.5], D: [147, 175.5], E: [166, 175.5],
  F: [90, 156.5], G: [109, 156.5], H: [128, 156.5], I: [147, 156.5], J: [166, 156.5],
  K: [90, 137.5], L: [109, 137.5], M: [128, 137.5], N: [147, 137.5], O: [166, 137.5],
  P: [90, 118.5], Q: [109, 118.5], R: [128, 118.5], S: [147, 118.5], T: [166, 118.5],
  U: [90, 99.5], V: [109, 99.5], W: [128, 99.5], X: [147, 99.5], Y: [166, 99.5], Z: [128, 80.5],
  '0': [473.2, 118.5], '1': [397.2, 137.5], '2': [416.2, 137.5], '3': [435.2, 137.5], '4': [454.2, 137.5], '5': [473.2, 137.5],
  '6': [397.2, 118.5], '7': [416.2, 118.5], '8': [435.2, 118.5], '9': [454.2, 118.5],
  '?': [90.2, -486.4], '!': [109.2, -486.4], '&': [128.2, -486.4], '@': [147.2, -486.4], '$': [166.2, -486.4],
};

const baseUrl = `${import.meta.env.BASE_URL || './'}clicker-assets/flex-keychain/`;
const SOURCE_PLANE_ROTATION = -Math.PI / 2;
const TARGET_CAP_SEAT_OFFSET = 5;

function capMeta(ch: string, blank = false): CapMeta {
  if (blank) return { body: 'caps/blank-body.stl', glyph: null, x: 128, y: -179.2 };
  const key = ch.toUpperCase();
  const offset = CAP_OFFSETS[key];
  if (!offset) return { body: 'caps/blank-body.stl', glyph: null, x: 128, y: -179.2 };
  const prefix = /[A-Z]/.test(key) ? `caps/letter-${key}` : /[0-9]/.test(key) ? `caps/digit-${key}` : null;
  return prefix
    ? { body: `${prefix}-body.stl`, glyph: `${prefix}-glyph.stl`, x: offset[0], y: offset[1] }
    : { body: 'caps/blank-body.stl', glyph: null, x: 128, y: -179.2 };
}

function toPart(geometry: THREE.BufferGeometry, kind: ClickerPart['kind'], group: ClickerPart['group'], colorRgb: RGB, name: string): ClickerPart {
  const position = geometry.getAttribute('position');
  const vertices = new Float32Array(position.array as ArrayLike<number>);
  const triangles = new Uint32Array(position.count);
  for (let i = 0; i < triangles.length; i++) triangles[i] = i;
  geometry.dispose();
  return { vertProperties: vertices, triVerts: triangles, numProp: 3, kind, group, colorRgb, name };
}

function geometryBounds(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  if (!geometry.boundingBox) throw new Error('STL has no bounding box');
  return geometry.boundingBox;
}

function rotateAroundZ(geometry: THREE.BufferGeometry, angle: number) {
  if (Math.abs(angle) > 1e-7) geometry.rotateZ(angle);
}

export interface TargetGeometryResult {
  parts: ClickerPart[];
  switches: SwitchPlacement[];
}

/**
 * Loads the same pre-cut STL components used by Flex Keychain Text.  This is
 * deliberately asset based: the socket openings, underside, lip and keycap
 * profile must come from the source meshes instead of being approximated with
 * a rounded box and a boolean made in the worker.
 */
export class TargetGeometryLoader {
  private readonly loader = new STLLoader();
  private readonly cache = new Map<string, THREE.BufferGeometry>();

  private async load(path: string): Promise<THREE.BufferGeometry> {
    const cached = this.cache.get(path);
    if (cached) return cached.clone();
    const response = await fetch(`${baseUrl}${path}`);
    if (!response.ok) throw new Error(`Flex STL ${path} failed (${response.status})`);
    const geometry = this.loader.parse(await response.arrayBuffer());
    geometry.computeVertexNormals();
    this.cache.set(path, geometry);
    return geometry.clone();
  }

  async loadSwitch(source: FlexKeychainConfig['switchStyle'], seatZ = 8.499): Promise<MeshData> {
    const geometry = await this.load(source === 'printed' ? 'print-switch.stl' : 'switch.stl');
    // The printed-switch STL uses the source web's XY print plane. The web
    // rotates it around X before centering; without this step it appears as a
    // long, incorrectly oriented block in the socket.
    if (source === 'printed') geometry.rotateX(-Math.PI / 2);
    const bounds = geometryBounds(geometry);
    // The switch top is seated at the keycap underside. The viewer applies
    // the separate exploded lift; applying it here would make the switch
    // visibly pierce the keycap in assembled mode.
    geometry.translate(-(bounds.min.x + bounds.max.x) / 2, -(bounds.min.y + bounds.max.y) / 2, seatZ - bounds.max.z);
    rotateAroundZ(geometry, SOURCE_PLANE_ROTATION);
    const mesh = {
      vertProperties: new Float32Array(geometry.getAttribute('position').array as ArrayLike<number>),
      triVerts: Uint32Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i),
      numProp: 3,
    };
    geometry.dispose();
    return mesh;
  }

  async build(config: FlexKeychainConfig): Promise<TargetGeometryResult> {
    const chars = splitName(config.name);
    if (config.baseType === 'modular') return this.buildModular(config, chars);
    return this.buildCompact(config, chars);
  }

  private async buildCompact(config: FlexKeychainConfig, chars: string[]): Promise<TargetGeometryResult> {
    const count = Math.max(1, Math.min(10, chars.length));
    const base = await this.load(`base/base-${count}.stl`);
    const bounds = geometryBounds(base);
    const centerX = (bounds.min.x + bounds.max.x) / 2;
    const centerY = (bounds.min.y + bounds.max.y) / 2;
    const minZ = bounds.min.z;
    const layoutRotation = config.vertical ? Math.PI / 2 : 0;
    base.translate(-centerX, -centerY, -minZ);
    rotateAroundZ(base, layoutRotation);
    rotateAroundZ(base, SOURCE_PLANE_ROTATION);
    const parts: ClickerPart[] = [toPart(base, 'body', 'base', hexToRgb(config.baseColor), `flex-base-${count}`)];
    const slots = BASE_SLOTS[count];
    const switches: SwitchPlacement[] = [];
    for (let i = 0; i < chars.length; i++) {
      const slot = slots[i];
      const slotConfig = config.slots[i];
      const cap = capMeta(chars[i], slotConfig?.blank);
      const local = await this.makeCap(slot, cap, centerX, centerY, minZ, layoutRotation);
      const slotPosition = rotateXY(slot.x - centerX, slot.y - centerY, layoutRotation + SOURCE_PLANE_ROTATION);
      switches.push({ x: slotPosition[0], y: slotPosition[1], rotation: (slot.rotationRad + layoutRotation) * 180 / Math.PI });
      const capColor = slotConfig?.capColorRgb ?? hexToRgb(config.capColor);
      const glyphColor = slotConfig?.glyphColorRgb ?? hexToRgb(config.glyphColor);
      parts.push(toPart(local.body, 'cap', 'top', capColor, `keycap-${i + 1}-${chars[i]}-body`));
      if (local.glyph) parts.push(toPart(local.glyph, 'cap', 'top', glyphColor, `keycap-${i + 1}-${chars[i]}-glyph`));
    }
    return { parts, switches };
  }

  private async buildModular(config: FlexKeychainConfig, chars: string[]): Promise<TargetGeometryResult> {
    const meta = MODULAR[config.modularStyle];
    const template = await this.load(meta.file);
    const bounds = geometryBounds(template);
    const centerX = meta.center[0];
    const centerY = meta.center[1];
    const minZ = bounds.min.z;
    const layoutRotation = config.vertical ? Math.PI / 2 : 0;
    const parts: ClickerPart[] = [];
    const switches: SwitchPlacement[] = [];
    const count = Math.max(1, chars.length);
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * meta.pitch;
      const base = template.clone();
      base.translate(-centerX, -centerY + offset, -minZ);
      rotateAroundZ(base, layoutRotation);
      rotateAroundZ(base, SOURCE_PLANE_ROTATION);
      parts.push(toPart(base, 'body', 'base', hexToRgb(config.baseColor), `flex-module-${i + 1}`));
      const slot = { ...meta.slot, y: meta.slot.y + offset };
      const local = await this.makeCap({ ...slot, rotationRad: slot.rotationRad + Math.PI / 2 }, capMeta(chars[i], config.slots[i]?.blank), centerX, centerY, minZ, layoutRotation);
      const slotPosition = rotateXY(slot.x - centerX, slot.y - centerY, layoutRotation + SOURCE_PLANE_ROTATION);
      switches.push({ x: slotPosition[0], y: slotPosition[1], rotation: (slot.rotationRad + Math.PI / 2 + layoutRotation) * 180 / Math.PI });
      const slotConfig = config.slots[i];
      parts.push(toPart(local.body, 'cap', 'top', slotConfig?.capColorRgb ?? hexToRgb(config.capColor), `keycap-${i + 1}-${chars[i]}-body`));
      if (local.glyph) parts.push(toPart(local.glyph, 'cap', 'top', slotConfig?.glyphColorRgb ?? hexToRgb(config.glyphColor), `keycap-${i + 1}-${chars[i]}-glyph`));
    }
    template.dispose();
    return { parts, switches };
  }

  private async makeCap(slot: SlotMeta, meta: CapMeta, centerX: number, centerY: number, baseMinZ: number, layoutRotation: number) {
    const body = await this.load(meta.body);
    body.translate(-meta.x, -meta.y, 0);
    rotateAroundZ(body, slot.rotationRad);
    body.translate(slot.x - centerX, slot.y - centerY, slot.restZ - baseMinZ + TARGET_CAP_SEAT_OFFSET);
    rotateAroundZ(body, layoutRotation);
    rotateAroundZ(body, SOURCE_PLANE_ROTATION);
    let glyph: THREE.BufferGeometry | null = null;
    if (meta.glyph) {
      glyph = await this.load(meta.glyph);
      glyph.translate(-meta.x, -meta.y, 0);
      rotateAroundZ(glyph, slot.rotationRad);
      glyph.translate(slot.x - centerX, slot.y - centerY, slot.restZ - baseMinZ + TARGET_CAP_SEAT_OFFSET);
      rotateAroundZ(glyph, layoutRotation);
      rotateAroundZ(glyph, SOURCE_PLANE_ROTATION);
    }
    return { body, glyph };
  }
}

function rotateXY(x: number, y: number, angle: number): [number, number] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [x * c - y * s, x * s + y * c];
}
