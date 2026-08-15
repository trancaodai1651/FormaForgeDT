import type {
  BlockGlyph,
  FlexKeychainBuildParams,
  FlexKeychainSlot,
  ClickerPart,
  RGB,
  SwitchPlacement,
} from '../types';
import { BuildContext } from './buildContext';
import {
  bounds,
  fittedGlyph,
  makeKeycap,
  toPart,
  buildBlocks,
  type KeycapAsset,
  type PreparedBlockAssets,
} from './buildBlocks';
import { roundedRect } from './geometry/shapeFactory';

const DEFAULT_BODY: RGB = [31, 35, 43];
const DEFAULT_CAP: RGB = [232, 235, 241];
const DEFAULT_GLYPH: RGB = [45, 49, 58];

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function positionList(count: number, pitch: number, vertical: boolean): [number, number][] {
  const start = -((Math.max(1, count) - 1) * pitch) / 2;
  return Array.from({ length: count }, (_, index) => {
    const offset = start + index * pitch;
    return vertical ? [0, -offset] : [offset, 0];
  });
}

function makeCompactBase(
  ctx: BuildContext,
  socket: any | null,
  slots: FlexKeychainSlot[],
  params: FlexKeychainBuildParams,
): { base: any; positions: [number, number][]; height: number } {
  const unit = clamp(params.keycapUnit, 1, 6.5, 1);
  const keySize = 18 * unit;
  const gap = clamp(params.gapMm, 0, 12, 2.2);
  const pitch = keySize + gap;
  const positions = positionList(slots.length, pitch, params.vertical);
  const side = clamp(params.moduleSideWallThicknessMm, 0, 33, 0);
  const margin = 3.2 + side;
  const length = Math.max(keySize, keySize * slots.length + gap * Math.max(0, slots.length - 1));
  const width = keySize;
  const outerWidth = (params.vertical ? width : length) + margin * 2;
  const outerDepth = (params.vertical ? length : width) + margin * 2;
  const height = clamp(params.moduleThicknessMm, 4, 40, 14);
  const radius = clamp(params.baseCornerRadiusMm, 0.1, Math.min(outerWidth, outerDepth) / 2 - 0.1, 3);
  let base = ctx.track(ctx.wasm.Manifold.extrude(
    roundedRect(ctx, outerWidth, outerDepth, radius),
    height,
  ));

  const pocketWidth = Math.max(10, keySize - 3.2);
  const pocketDepth = Math.max(10, keySize - 3.2);
  const pocketRadius = Math.min(Math.max(0.8, params.keycapCornerRadiusMm + 0.9), Math.min(pocketWidth, pocketDepth) / 2 - 0.1);
  const pocketDepthZ = Math.min(height - 0.5, Math.max(1.4, height * 0.42));
  for (const [x, y] of positions) {
    const pocket = ctx.track(ctx.wasm.Manifold.extrude(
      roundedRect(ctx, pocketWidth, pocketDepth, pocketRadius),
      pocketDepthZ + 0.8,
    ).translate([x, y, height - pocketDepthZ]));
    base = ctx.track(base.subtract(pocket));
    if (socket) {
      try {
        base = ctx.track(base.subtract(ctx.track(socket.translate([x, y, height]))));
      } catch {
        // The shallow rounded pocket is still a valid printable fallback.
      }
    }
  }
  return { base, positions, height };
}

function makeCompactParts(
  wasm: any,
  socket: any | null,
  keycap: KeycapAsset,
  params: FlexKeychainBuildParams,
): { parts: ClickerPart[]; switchPlacements: SwitchPlacement[]; warnings: string[] } {
  const ctx = new BuildContext(wasm);
  const parts: ClickerPart[] = [];
  const warnings: string[] = [];
  const slots = params.slots.length ? params.slots : [{
    ch: 'N', rings: [], capColorRgb: params.defaultCapColorRgb, glyphColorRgb: params.defaultGlyphColorRgb, blank: true,
  }];
  const { base, positions, height } = makeCompactBase(ctx, socket, slots, params);
  parts.push(toPart(base, [0, 0], 'body', 'base', params.baseColorRgb ?? DEFAULT_BODY, 'flex-compact-base'));
  const switchPlacements = positions.map(([x, y]) => ({ x, y, rotation: 0 }));

  const rawCap = makeKeycap(
    ctx,
    keycap,
    params.stemTolerance,
    params.keycapThicknessMm,
    params.keycapCornerRadiusMm,
    params.keycapShape,
    params.keycapProfile,
    params.keycapUnit,
  );
  const rawCapBox = rawCap.boundingBox();
  const rawCapHeight = Math.max(0.5, rawCapBox.max[2] - rawCapBox.min[2]);
  const desiredCapHeight = clamp(params.keycapHeightMm, 6, 30, 11.8);
  const capScale = desiredCapHeight / rawCapHeight;
  const normalizedCap = ctx.track(rawCap.translate([0, 0, -rawCapBox.min[2]]).scale([1, 1, capScale]));
  const capBox = normalizedCap.boundingBox();
  const recessDepth = params.keycapMount === 'recessed' ? Math.min(height * 0.4, Math.max(1.5, desiredCapHeight * 0.25)) : 0;
  const capZ = height - recessDepth + Math.max(0, params.keycapGapMm);
  const capTopZ = capZ + capBox.max[2];
  const drawable = slots.filter((slot) => !slot.blank && slot.rings.length > 0);
  const maxGlyph = drawable.length
    ? Math.max(...drawable.map((slot) => Math.max(bounds(slot.rings).w, bounds(slot.rings).h)))
    : 1;
  const glyphScale = (Math.max(6, (keycap.meta.topExtent?.[0] ?? 15.2) * params.keycapUnit - 4.2) / Math.max(maxGlyph, 1e-6))
    * clamp(params.fontSize / 15, 0.4, 1.6, 1) * clamp(params.legendScale, 0.5, 1.8, 1);

  for (let index = 0; index < slots.length; index++) {
    const slot = slots[index];
    const [x, y] = positions[index];
    const cap = ctx.track(normalizedCap.translate([x, y, capZ]));
    parts.push(toPart(cap, [0, 0], 'cap', 'top', slot.capColorRgb ?? params.defaultCapColorRgb ?? DEFAULT_CAP, `flex-cap-${index}`));

    if (slot.blank || slot.rings.length === 0) continue;
    const glyph = fittedGlyph(ctx, { rings: slot.rings } as BlockGlyph, glyphScale, params.legendBold);
    if (!glyph || glyph.isEmpty()) continue;
    try {
      const legend = ctx.track(wasm.Manifold.extrude(glyph, 0.55).translate([x, y, capTopZ + 0.08]));
      parts.push(toPart(legend, [0, 0], 'cap', 'top', slot.glyphColorRgb ?? params.defaultGlyphColorRgb ?? DEFAULT_GLYPH, `flex-glyph-${index}`));
    } catch {
      warnings.push(`Letter ${index + 1} could not be raised.`);
    }
  }
  ctx.cleanup();
  return { parts, switchPlacements, warnings };
}

export function buildFlexKeychain(
  wasm: any,
  assets: PreparedBlockAssets,
  keycap: KeycapAsset,
  socket: any | null,
  params: FlexKeychainBuildParams,
): { parts: ClickerPart[]; switchPlacements: SwitchPlacement[]; warnings: string[] } {
  if (params.baseType === 'compact') return makeCompactParts(wasm, socket, keycap, params);

  const result = buildBlocks(wasm, assets, keycap, {
    requestId: 0,
    blockWidthMm: 18 * clamp(params.keycapUnit, 1, 6.5, 1),
    blockHeightMm: 18 * clamp(params.keycapUnit, 1, 6.5, 1),
    blockDepthMm: 6,
    blockGapMm: clamp(params.gapMm, 0, 12, 2.2),
    cornerRadiusMm: params.modularStyle === 'bubbly-v2' ? 5 : 4,
    fontSize: params.fontSize,
    legendBold: params.legendBold,
    vertical: params.vertical,
    glyphs: params.slots.map((slot) => ({
      rings: slot.rings,
      blank: slot.blank,
      filamentRgb: slot.glyphColorRgb,
      partName: `flex-glyph-${params.slots.indexOf(slot)}`,
    })),
    bodyColorRgb: params.baseColorRgb,
    capColorRgb: params.defaultCapColorRgb,
    capColorByIndex: params.slots.map((slot) => slot.capColorRgb),
    stemTolerance: params.stemTolerance,
    travel: params.travel,
    keycapGapMm: params.keycapGapMm,
    flatBottom: true,
    baseHeightMm: params.moduleThicknessMm,
    moduleThicknessMm: params.moduleThicknessMm,
    moduleSideThicknessMm: params.moduleSideWallThicknessMm,
    baseCornerRadiusMm: params.baseCornerRadiusMm,
    keycapHeightMm: params.keycapHeightMm,
    keycapThicknessMm: params.keycapThicknessMm,
    keycapCornerRadiusMm: params.keycapCornerRadiusMm,
    keycapShape: params.keycapShape,
    keycapMount: params.keycapMount,
    keycapProfile: params.keycapProfile,
    keycapUnit: params.keycapUnit,
  }, socket);
  return result;
}
