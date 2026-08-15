import type {
  BlockAssetBuffers,
  BlockGlyph,
  BlocksBuildParams,
  ClickerPart,
  PartGroup,
  RGB,
  Ring,
  SwitchPlacement,
} from '../types';
import { BuildContext } from './buildContext';
import { parse3MF } from './threemfImport';
import { roundedRect } from './geometry/shapeFactory';

const DIR = { N: 1, S: 2, E: 4, W: 8 } as const;
const DEFAULT_BODY: RGB = [238, 238, 240];
const DEFAULT_LETTER: RGB = [145, 145, 148];

export interface PreparedBlockAssets {
  byMask: Map<number, { solid: any; rot: number }>;
  pitch: number;
  pitchMax: number;
  owned: any[];
}

export interface KeycapAsset {
  shell: { positions: number[]; indices: number[] };
  stem?: { positions: number[]; indices: number[] } | null;
  meta: {
    center: [number, number];
    topZ: number;
    dishBottomZ?: number;
    topExtent?: [number, number];
  };
}

function meshSolid(wasm: any, positions: number[] | Float32Array, indices: number[] | Uint32Array): any {
  const mesh = new wasm.Mesh({
    numProp: 3,
    vertProperties: positions instanceof Float32Array ? positions : new Float32Array(positions),
    triVerts: indices instanceof Uint32Array ? indices : new Uint32Array(indices),
  });
  mesh.merge();
  return wasm.Manifold.ofMesh(mesh);
}

function area(ring: Ring): number {
  let value = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    value += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(value / 2);
}

export function bounds(rings: Ring[]) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function rotateMask(mask: number, quarterTurns: number): number {
  let result = mask;
  for (let i = 0; i < ((quarterTurns % 4) + 4) % 4; i++) {
    result = (result & DIR.E ? DIR.N : 0)
      | (result & DIR.N ? DIR.W : 0)
      | (result & DIR.W ? DIR.S : 0)
      | (result & DIR.S ? DIR.E : 0);
  }
  return result;
}

function prepareAsset(wasm: any, source: any, blockHeight: number): { solid: any; size: [number, number] } {
  const bb = source.boundingBox();
  const width = bb.max[0] - bb.min[0];
  const depth = bb.max[1] - bb.min[1];
  const height = bb.max[2] - bb.min[2];
  let solid = source.translate([
    -(bb.min[0] + bb.max[0]) / 2,
    -(bb.min[1] + bb.max[1]) / 2,
    -bb.min[2],
  ]);
  let shiftX = 0;
  let shiftY = 0;
  try {
    const polygons = solid.slice(height * 0.25).toPolygons();
    let smallest: Ring | null = null;
    let smallestArea = Infinity;
    for (const polygon of polygons) {
      const polygonArea = area(polygon as Ring);
      if (polygonArea < smallestArea) {
        smallestArea = polygonArea;
        smallest = polygon as Ring;
      }
    }
    if (smallest && polygons.length > 1) {
      const b = bounds([smallest]);
      shiftX = (b.minX + b.maxX) / 2;
      shiftY = (b.minY + b.maxY) / 2;
    }
  } catch {
    // Some manifold versions do not expose slice polygons consistently.
  }
  let seat = 0;
  try {
    const cutter = wasm.Manifold.extrude(
      wasm.CrossSection.square([13, 13], true).translate([shiftX, shiftY]),
      height + 2,
    ).translate([0, 0, -1]);
    const intersection = solid.intersect(cutter);
    seat = intersection.boundingBox().max[2];
    cutter.delete();
    intersection.delete();
  } catch {
    // Keep the source's bottom as the fallback seat.
  }
  const normalized = solid.translate([-shiftX, -shiftY, -(seat + blockHeight)]);
  solid.delete();
  return { solid: normalized, size: [width, depth] };
}

export function prepareBlockAssets(wasm: any, socket: any, input: BlockAssetBuffers): PreparedBlockAssets {
  const decoded: Record<string, any> = {};
  const owned: any[] = [];
  for (const [key, value] of Object.entries({
    noSides: input.noSides,
    south: input.south,
    northSouth: input.northSouth,
    northWest: input.northWest,
    northSouthWest: input.northSouthWest,
    allSides: input.allSides,
  })) {
    const raw = parse3MF(value);
    const solid = meshSolid(wasm, raw.vertProperties, raw.triVerts);
    decoded[key] = solid;
    owned.push(solid);
  }

  const socketBox = socket.boundingBox();
  const blockHeight = socketBox.max[2] - socketBox.min[2];
  const sourceMap: Array<[any, number]> = [
    [decoded.noSides, 0],
    [decoded.south, DIR.S],
    [decoded.northSouth, DIR.N | DIR.S],
    [decoded.northWest, DIR.N | DIR.W],
    [decoded.northSouthWest, DIR.N | DIR.S | DIR.W],
    [decoded.allSides, DIR.N | DIR.S | DIR.E | DIR.W],
  ];
  const byMask = new Map<number, { solid: any; rot: number }>();
  let noSideSize: [number, number] | undefined;
  let southSize: [number, number] | undefined;
  let northSouthSize: [number, number] | undefined;
  for (const [source, mask] of sourceMap) {
    if (!source) continue;
    const prepared = prepareAsset(wasm, source, blockHeight);
    owned.push(prepared.solid);
    if (mask === 0) noSideSize = prepared.size;
    if (mask === DIR.S) southSize = prepared.size;
    if (mask === (DIR.N | DIR.S)) northSouthSize = prepared.size;
    for (let quarterTurns = 0; quarterTurns < 4; quarterTurns++) {
      const rotatedMask = rotateMask(mask, quarterTurns);
      if (!byMask.has(rotatedMask)) {
        // Keep the prepared module in its original orientation. The selected
        // rotation is metadata and is applied exactly once by buildBlocks.
        // Rotating here and again during selection mirrored the connector
        // geometry and caused modules to land in the wrong slots.
        byMask.set(rotatedMask, { solid: prepared.solid, rot: quarterTurns * 90 });
      }
    }
  }
  const pitch = northSouthSize?.[1] ?? 0;
  let pitchMax = pitch;
  if (noSideSize && southSize) {
    const side = noSideSize[1] - southSize[1];
    const inferred = noSideSize[1] - 2 * side;
    if (!(pitch > 1) || Math.abs(pitch - inferred) > 0.05) pitchMax = inferred;
    pitchMax = Math.max(pitchMax, noSideSize[0] - 2 * side);
  }
  return { byMask, pitch, pitchMax, owned };
}

export function fittedGlyph(
  ctx: BuildContext,
  glyph: BlockGlyph,
  scale: number,
  legendBold: number,
): any | null {
  const rings = glyph.rings.filter((ring) => ring.length >= 3 && area(ring) > 0.0005);
  if (!rings.length) return null;
  const b = bounds(rings);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const fitted = rings.map((ring) => ring.map(([x, y]) => [(x - cx) * scale, (y - cy) * scale] as [number, number]));
  let section = ctx.track(new ctx.wasm.CrossSection(fitted, 'NonZero'));
  if (Math.abs(legendBold) > 0.005) {
    const bold = ctx.track(section.offset(legendBold, 'Round', 2, 24));
    if (!bold.isEmpty()) section = bold;
  }
  return section;
}

export function makeKeycap(
  ctx: BuildContext,
  asset: KeycapAsset,
  stemTolerance: number,
  lipThicknessMm = 2,
  cornerRadiusMm = 2.8,
  keycapShape: 'rounded' | 'square' = 'rounded',
  keycapProfile: 'standard' | 'low' | 'thocky' | 'choc-v1' = 'standard',
  keycapUnit = 1,
): any {
  const [cx, cy] = asset.meta.center;
  const shellSource = ctx.track(meshSolid(ctx.wasm, asset.shell.positions, asset.shell.indices));
  const unit = Math.max(1, Math.min(6.5, Number.isFinite(keycapUnit) ? keycapUnit : 1));
  const profileScale = keycapProfile === 'low' ? 0.74
    : keycapProfile === 'thocky' ? 1.12
      : keycapProfile === 'choc-v1' ? 0.62
        : 1;
  const scaleFromBottom = (solid: any, sx: number, sy: number, sz: number): any => {
    const box = solid.boundingBox();
    const normalized = ctx.track(solid.translate([0, 0, -box.min[2]]));
    return ctx.track(normalized.scale([sx, sy, sz]).translate([0, 0, box.min[2]]));
  };
  // Rounded mode must use the exact web shell. It contains the underside
  // cavity/skirt geometry that gets lost when replacing it with an extruded
  // rectangle. Keep the procedural square variant only as an explicit option.
  let shell: any;
  if (keycapShape === 'square') {
    const sourceBox = shellSource.boundingBox();
    const width = (sourceBox.max[0] - sourceBox.min[0]) * unit;
    const depth = (sourceBox.max[1] - sourceBox.min[1]) * unit;
    const height = Math.max(0.5, sourceBox.max[2] - sourceBox.min[2]);
    const radius = Math.min(width / 2, depth / 2, Math.max(0.15, cornerRadiusMm));
    const profile = ctx.track(roundedRect(ctx, width, depth, radius));
    shell = ctx.track(ctx.wasm.Manifold.extrude(profile, height)
      .translate([0, 0, sourceBox.min[2]]));
  } else {
    shell = ctx.track(shellSource.translate([-cx, -cy, 0]));
    shell = scaleFromBottom(shell, unit, unit, profileScale);
  }
  if (keycapShape === 'square') {
    // Keep the user-facing lip control meaningful for the generated square
    // profile while leaving the official rounded shell untouched.
    const lip = Math.max(0.8, Math.min(4, lipThicknessMm));
    const lipScale = 1 + Math.max(0, lip - 2) * 0.012;
    shell = scaleFromBottom(shell, lipScale, lipScale, profileScale);
  }
  if (!asset.stem) return shell;
  const stemSource = ctx.track(meshSolid(ctx.wasm, asset.stem.positions, asset.stem.indices));
  let stem = ctx.track(stemSource.translate([-cx, -cy, 0]));
  if (Math.abs(stemTolerance) > 0.001) {
    const bb = stem.boundingBox();
    const size = Math.max(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1]);
    if (size > 0.1) {
      const factor = Math.max(0.5, (size + stemTolerance) / size);
      stem = ctx.track(stem.scale([factor, factor, 1]));
    }
  }
  // The web does not add a second lip ring here: the shell itself already
  // contains the correct lower lip and underside cavity.
  return ctx.track(shell.add(stem));
}

function makeStraightModuleBase(
  ctx: BuildContext,
  positions: [number, number][],
  cellWidth: number,
  cellDepth: number,
  vertical: boolean,
  heightMm: number,
  sideWallMm: number,
  cornerRadiusMm: number,
  pocketRadiusMm: number,
  pocketWidthMm: number,
  pocketDepthMm: number,
  socket: any | null,
  rotations: number[],
): any {
  const minX = Math.min(...positions.map(([x]) => x));
  const maxX = Math.max(...positions.map(([x]) => x));
  const minY = Math.min(...positions.map(([, y]) => y));
  const maxY = Math.max(...positions.map(([, y]) => y));
  const margin = Math.max(1.5, Math.min(6, sideWallMm));
  const outerWidth = (vertical ? cellWidth : maxX - minX + cellWidth) + margin * 2;
  const outerDepth = (vertical ? maxY - minY + cellDepth : cellDepth) + margin * 2;
  const height = Math.max(4, Math.min(30, heightMm));
  const outerProfile = ctx.track(roundedRect(ctx, outerWidth, outerDepth, cornerRadiusMm));
  let base = ctx.track(ctx.wasm.Manifold.extrude(outerProfile, height)
    .translate([0, 0, -height]));

  // The switch well is deliberately smaller than the module cell. Increasing
  // side-wall thickness therefore grows the outside of the base instead of
  // consuming the keycap/socket clearance.
  const pocketWidth = Math.max(10, Math.min(pocketWidthMm, cellWidth - 0.8));
  const pocketDepth = Math.max(10, Math.min(pocketDepthMm, cellDepth - 0.8));
  const pocketDepthZ = Math.min(height - 0.8, 1.6);
  for (let index = 0; index < positions.length; index++) {
    const [x, y] = positions[index];
    const pocketProfile = ctx.track(roundedRect(ctx, pocketWidth, pocketDepth, pocketRadiusMm));
    const pocket = ctx.track(ctx.wasm.Manifold.extrude(pocketProfile, pocketDepthZ + 0.4)
      .translate([x, y, -pocketDepthZ]));
    base = ctx.track(base.subtract(pocket));

    // Restore the real MX socket cutout. It contains the keyed/stepped
    // outline that a plain rounded-rectangle pocket cannot reproduce.
    if (socket) {
      try {
        const rotation = rotations[index] ?? 0;
        const socketCut = rotation
          ? ctx.track(socket.rotate([0, 0, rotation]))
          : socket;
        base = ctx.track(base.subtract(ctx.track(socketCut.translate([x, y, 0]))));
      } catch {
        // Keep the shallow cap pocket if a legacy asset has no valid socket.
      }
    }
  }
  return base;
}

function addTopConnector(ctx: BuildContext, solid: any, mask: number): any {
  if (!mask) return solid;
  try {
    const top = solid.boundingBox().max[2];
    const thin = ctx.track(solid.slice(top - 0.4));
    let pushed = ctx.track(solid.slice(top - 0.02));
    for (const [side, direction] of [[DIR.N, [0, 1]], [DIR.S, [0, -1]], [DIR.E, [1, 0]], [DIR.W, [-1, 0]]] as const) {
      if (mask & side) pushed = ctx.track(pushed.add(pushed.translate([direction[0] * 0.12, direction[1] * 0.12])));
    }
    const joint = ctx.track(pushed.intersect(thin));
    if (joint.isEmpty()) return solid;
    return ctx.track(solid.add(ctx.track(ctx.wasm.Manifold.extrude(joint, 0.4).translate([0, 0, top - 0.4]))));
  } catch {
    return solid;
  }
}

function flattenBottom(ctx: BuildContext, solid: any, floorZ: number): any {
  const bb = solid.boundingBox();
  if (bb.min[2] >= floorZ - 0.001 || bb.max[2] <= floorZ + 0.01) return solid;
  const height = bb.max[2] - floorZ + 1;
  const footprint = ctx.track(ctx.wasm.CrossSection.square([200, 200], true));
  const cutter = ctx.track(ctx.wasm.Manifold.extrude(footprint, height).translate([0, 0, floorZ]));
  return ctx.track(solid.intersect(cutter));
}

/**
 * Add material outside the existing module footprint.
 *
 * This deliberately uses two independent side strips instead of offsetting
 * the projected solid. Projecting the whole module also projects the opening
 * and underside, which can create accidental caps on the top and bottom when
 * the requested thickness is large.
 */
function addOutwardModuleWall(ctx: BuildContext, solid: any, thicknessMm: number, vertical: boolean): any {
  const thickness = Math.max(0, Math.min(33, thicknessMm));
  if (thickness <= 0.001) return solid;
  try {
    const box = solid.boundingBox();
    const join = 0.25;
    // Read only the outside contour at the middle of the module. Using the
    // projection of the whole solid also includes the MX opening and
    // underside, which is what produced the large top/bottom artefacts.
    const slice = solid.slice((box.min[2] + box.max[2]) / 2);
    const contours = (slice.toPolygons() as Ring[])
      .filter((ring) => ring.length >= 3)
      .sort((a, b) => area(b) - area(a));
    if (!contours.length || area(contours[0]) <= 0.001) return solid;
    const contour = contours[0];
    const contourBox = bounds([contour]);
    const footprint = ctx.track(new ctx.wasm.CrossSection([contour], 'NonZero'));
    const expanded = ctx.track(footprint.offset(thickness, 'Round', 2, 48));
    // Keep the visible outer edge at the requested offset, but inset the
    // inner edge slightly so the added wall overlaps the real module. Using
    // `expanded` directly here fills a large rectangular slice of the
    // module; using `expanded - footprint` touches only at a coplanar edge
    // and can remain a separate shell.
    const innerOverlap = ctx.track(footprint.offset(-join, 'Round', 2, 32));
    const outsideRing = ctx.track(expanded.subtract(innerOverlap));
    if (outsideRing.isEmpty()) return solid;
    // Keep the selector inside the original module length. Extending it by
    // the wall thickness makes the offset contour leak around both ends and
    // creates the two wing-like tabs visible in the preview.
    const span = vertical
      ? Math.max(1, contourBox.h)
      : Math.max(1, contourBox.w);
    // The small overlap guarantees a watertight union with the original
    // module. The rest of each strip grows outward, never inward.
    const stripWidth = thickness + join;
    const sideBand = ctx.track(ctx.wasm.CrossSection.square(
      vertical ? [stripWidth, span] : [span, stripWidth],
      true,
    ));
    const centerX = (contourBox.minX + contourBox.maxX) / 2;
    const centerY = (contourBox.minY + contourBox.maxY) / 2;
    const leftBand = ctx.track(sideBand.translate(vertical
      ? [contourBox.minX - thickness / 2 + join / 2, centerY]
      : [centerX, contourBox.minY - thickness / 2 + join / 2]));
    const rightBand = ctx.track(sideBand.translate(vertical
      ? [contourBox.maxX + thickness / 2 - join / 2, centerY]
      : [centerX, contourBox.maxY + thickness / 2 - join / 2]));
    const sideBands = ctx.track(leftBand.add(rightBand));
    // Keep only the two long sides while retaining the rounded contour at
    // their ends. The overlap in `innerOverlap` makes the union watertight.
    const sideRing = ctx.track(outsideRing.intersect(sideBands));
    if (sideRing.isEmpty()) return solid;
    const wall = ctx.track(ctx.wasm.Manifold.extrude(
      sideRing,
      Math.max(0.2, box.max[2] - box.min[2]),
    ).translate([0, 0, box.min[2]]));
    return ctx.track(solid.add(wall));
  } catch {
    return solid;
  }
}

function makeSideWalls(
  ctx: BuildContext,
  solids: any[],
  positions: [number, number][],
  vertical: boolean,
  thickness: number,
  floorZ: number,
  cornerRadius: number,
): any[] {
  if (!solids.length || thickness <= 0) return [];
  const boxes = solids.map((solid) => solid.boundingBox());
  const cellWidth = Math.max(...boxes.map((box) => box.max[0] - box.min[0]));
  const cellDepth = Math.max(...boxes.map((box) => box.max[1] - box.min[1]));
  const topZ = Math.max(...boxes.map((box) => box.max[2]));
  const height = Math.max(0.2, topZ - floorZ);
  const wall = Math.min(thickness, vertical ? cellWidth : cellDepth);
  const minX = Math.min(...positions.map(([x]) => x));
  const maxX = Math.max(...positions.map(([x]) => x));
  const minY = Math.min(...positions.map(([, y]) => y));
  const maxY = Math.max(...positions.map(([, y]) => y));
  const rails: any[] = [];

  if (vertical) {
    const span = Math.max(cellDepth, maxY - minY + cellDepth);
    const centerY = (minY + maxY) / 2;
    // Keep the inner edge at the original module boundary. Increasing the
    // thickness must grow outwards, away from the keycaps and sockets.
    const railX = cellWidth / 2 + wall / 2;
    for (const x of [-railX, railX]) {
      const profile = ctx.track(roundedRect(ctx, wall, span, Math.min(cornerRadius, wall / 2 - 0.05)));
      rails.push(ctx.track(ctx.wasm.Manifold.extrude(profile, height).translate([x, centerY, floorZ])));
    }
  } else {
    const span = Math.max(cellWidth, maxX - minX + cellWidth);
    const centerX = (minX + maxX) / 2;
    // Keep the inner edge at the original module boundary. Increasing the
    // thickness must grow outwards, away from the keycaps and sockets.
    const railY = cellDepth / 2 + wall / 2;
    for (const y of [-railY, railY]) {
      const profile = ctx.track(roundedRect(ctx, span, wall, Math.min(cornerRadius, wall / 2 - 0.05)));
      rails.push(ctx.track(ctx.wasm.Manifold.extrude(profile, height).translate([centerX, y, floorZ])));
    }
  }
  return rails;
}

function makeFlatFloor(
  ctx: BuildContext,
  solids: any[],
  positions: [number, number][],
  vertical: boolean,
  sideWall: number,
  floorZ: number,
  cornerRadius: number,
): any | null {
  if (!solids.length) return null;
  const boxes = solids.map((solid) => solid.boundingBox());
  const cellWidth = Math.max(...boxes.map((box) => box.max[0] - box.min[0]));
  const cellDepth = Math.max(...boxes.map((box) => box.max[1] - box.min[1]));
  const minX = Math.min(...positions.map(([x]) => x));
  const maxX = Math.max(...positions.map(([x]) => x));
  const minY = Math.min(...positions.map(([, y]) => y));
  const maxY = Math.max(...positions.map(([, y]) => y));
  const width = vertical ? cellWidth + sideWall * 2 : maxX - minX + cellWidth;
  const depth = vertical ? maxY - minY + cellDepth : cellDepth + sideWall * 2;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const profile = ctx.track(roundedRect(ctx, width, depth, Math.min(cornerRadius, Math.min(width, depth) / 2 - 0.1)));
  return ctx.track(ctx.wasm.Manifold.extrude(profile, 1.6).translate([centerX, centerY, floorZ]));
}

export function toPart(solid: any, offset: [number, number], kind: 'cap' | 'body', group: PartGroup, colorRgb: RGB, name: string): ClickerPart {
  const mesh = solid.getMesh();
  const vertices = new Float32Array(mesh.vertProperties);
  for (let i = 0; i < vertices.length; i += mesh.numProp) {
    vertices[i] += offset[0];
    vertices[i + 1] += offset[1];
  }
  return {
    kind, group, colorRgb, name, numProp: mesh.numProp,
    vertProperties: vertices, triVerts: new Uint32Array(mesh.triVerts),
  };
}

function findCapSeat(ctx: BuildContext, cap: any, block: any): number {
  try {
    const projection = ctx.track(cap.project());
    const box = block.boundingBox();
    const cutter = ctx.track(ctx.wasm.Manifold.extrude(
      projection,
      box.max[2] - box.min[2] + 2,
    ).translate([0, 0, box.min[2] - 1]));
    const intersection = ctx.track(block.intersect(cutter));
    if (intersection.isEmpty()) return 0;
    const top = intersection.boundingBox().max[2];
    return top > 0 && top < 3 ? top : 0;
  } catch {
    return 0;
  }
}

function buildBlocksLegacy(
  wasm: any,
  assets: PreparedBlockAssets,
  keycap: KeycapAsset,
  params: BlocksBuildParams,
): { parts: ClickerPart[]; switchPlacements: SwitchPlacement[]; warnings: string[] } {
  const ctx = new BuildContext(wasm);
  const parts: ClickerPart[] = [];
  const placements: SwitchPlacement[] = [];
  const warnings: string[] = [];
  const orientation = params.vertical ? 'vertical' : 'horizontal';
  const columns = orientation === 'vertical' ? 1 : Math.max(1, params.glyphs.length);
  const filled = params.glyphs
    .map((glyph, index) => ({ glyph, index, row: Math.floor(index / columns), col: index % columns }))
    .filter(({ glyph }) => glyph.blank || glyph.rings.some((ring) => ring.length >= 3));
  if (!filled.length) return { parts, switchPlacements: placements, warnings: ['Add a letter or a symbol to build blocks.'] };

  const occupied = new Set(filled.map(({ row, col }) => `${row},${col}`));
  const connectedMask = filled.map(({ row, col }) => (
    (occupied.has(`${row - 1},${col}`) ? DIR.N : 0)
    | (occupied.has(`${row + 1},${col}`) ? DIR.S : 0)
    | (occupied.has(`${row},${col + 1}`) ? DIR.E : 0)
    | (occupied.has(`${row},${col - 1}`) ? DIR.W : 0)
  ));
  const rotations = connectedMask.map((mask) => assets.byMask.get(mask)?.rot ?? 0);
  const rotatedPitch = rotations.every((rotation) => Math.round(rotation / 90) % 2 === 0) ? assets.pitch : assets.pitchMax;
  const minRow = Math.min(...filled.map((entry) => entry.row));
  const maxRow = Math.max(...filled.map((entry) => entry.row));
  const minCol = Math.min(...filled.map((entry) => entry.col));
  const maxCol = Math.max(...filled.map((entry) => entry.col));
  const originX = -((minCol + maxCol) / 2) * rotatedPitch;
  const originY = ((minRow + maxRow) / 2) * rotatedPitch;
  const positionOf = (entry: { row: number; col: number }): [number, number] => [
    originX + entry.col * rotatedPitch,
    originY - entry.row * rotatedPitch,
  ];

  const byMask = new Map<number, { solid: any; rot: number }>();
  const selectAsset = (mask: number) => {
    const cached = byMask.get(mask);
    if (cached) return cached;
    const selected = assets.byMask.get(mask) ?? assets.byMask.get(0);
    if (!selected) throw new Error(`No block asset for connect pattern ${mask}`);
    const solid = selected.rot ? ctx.track(selected.solid.rotate([0, 0, selected.rot])) : selected.solid;
    const prepared = { solid: addTopConnector(ctx, solid, mask), rot: selected.rot };
    byMask.set(mask, prepared);
    return prepared;
  };

  // The supplied connector assets contain small underside connector lips. They
  // are useful for joining modules, but must not produce different bottom Z
  // levels in the generated chain. Clip every used variant to one common plane.
  for (const mask of connectedMask) selectAsset(mask);
  const usedSolids = [...byMask.values()].map(({ solid }) => solid);
  const commonFloor = params.flatBottom === false
    ? Math.min(...usedSolids.map((solid) => solid.boundingBox().min[2]))
    : Math.max(...usedSolids.map((solid) => solid.boundingBox().min[2]));
  const flatByMask = new Map<number, { solid: any; rot: number }>();
  for (const [mask, selected] of byMask) {
    flatByMask.set(mask, {
      solid: params.flatBottom === false ? selected.solid : flattenBottom(ctx, selected.solid, commonFloor),
      rot: selected.rot,
    });
  }

  const selectedSolids: any[] = [];
  const selectedPositions: [number, number][] = [];

  for (let index = 0; index < filled.length; index++) {
    const entry = filled[index];
    const mask = connectedMask[index];
    const selected = flatByMask.get(mask) ?? selectAsset(mask);
    const position = positionOf(entry);
    selectedSolids.push(selected.solid);
    selectedPositions.push(position);
    placements.push({ x: position[0], y: position[1], rotation: selected.rot });
  }

  // Keep every block as an individual solid. The continuous floor and side
  // rails below are the connectors between modules; keeping the modules
  // separate is important for exploded preview and for downstream exports.
  const moduleSolids: any[] = [];
  for (let index = 0; index < selectedSolids.length; index++) {
    moduleSolids.push(ctx.track(selectedSolids[index].translate(selectedPositions[index])));
  }

  const rails = makeSideWalls(
    ctx,
    selectedSolids,
    selectedPositions,
    orientation === 'vertical',
    Math.max(1.5, Math.min(6, params.wallThicknessMm ?? 3)),
    commonFloor,
    Math.max(0.5, Math.min(8, params.baseCornerRadiusMm ?? 3)),
  );
  let floor: any | null = null;
  if (params.flatBottom !== false) {
    floor = makeFlatFloor(
      ctx,
      selectedSolids,
      selectedPositions,
      orientation === 'vertical',
      Math.max(1.5, Math.min(6, params.wallThicknessMm ?? 3)),
      commonFloor,
      Math.max(0.5, Math.min(8, params.baseCornerRadiusMm ?? 3)),
    );
  }

  const baseComponents = [...moduleSolids, ...rails, ...(floor ? [floor] : [])];
  if (!baseComponents.length) throw new Error('Unable to create a Blocks base.');
  const componentBoxes = baseComponents.map((solid) => solid.boundingBox());
  const baseFloor = Math.min(...componentBoxes.map((box) => box.min[2]));
  const baseTopBeforeScale = Math.max(...componentBoxes.map((box) => box.max[2]));
  const currentHeight = baseTopBeforeScale - baseFloor;
  let baseScale = 1;
  const desiredBaseHeight = params.baseHeightMm;
  if (Number.isFinite(desiredBaseHeight) && (desiredBaseHeight as number) > 0 && currentHeight > 0.01) {
    baseScale = Math.max(0.25, Math.min(4, (desiredBaseHeight as number) / currentHeight));
  }
  const scaleBaseComponent = (solid: any): any => {
    if (baseScale === 1) return solid;
    const normalized = ctx.track(solid.translate([0, 0, -baseFloor]));
    return ctx.track(normalized.scale([1, 1, baseScale]).translate([0, 0, baseFloor]));
  };
  const bodyColor = params.bodyColorRgb ?? DEFAULT_BODY;
  const scaledModules = moduleSolids.map(scaleBaseComponent);
  const scaledRails = rails.map(scaleBaseComponent);
  const scaledFloor = floor ? scaleBaseComponent(floor) : null;

  for (let index = 0; index < scaledModules.length; index++) {
    parts.push(toPart(scaledModules[index], [0, 0], 'body', 'base', bodyColor, `block-${filled[index].index}`));
  }
  for (let index = 0; index < scaledRails.length; index++) {
    parts.push(toPart(scaledRails[index], [0, 0], 'body', 'base', bodyColor, `blocks-side-wall-${index + 1}`));
  }
  if (scaledFloor) {
    parts.push(toPart(scaledFloor, [0, 0], 'body', 'base', bodyColor, 'blocks-flat-floor'));
  }

  const capHeight = Math.max(6, Math.min(18, params.keycapHeightMm ?? 11.8));
  const cap = makeKeycap(
    ctx,
    keycap,
    params.stemTolerance ?? 0,
  );
  const capBox = cap.boundingBox();
  const scaledComponents = [...scaledModules, ...scaledRails, ...(scaledFloor ? [scaledFloor] : [])];
  const baseTop = Math.max(...scaledComponents.map((solid) => solid.boundingBox().max[2]));
  const capOffset = baseTop - capBox.min[2] + Math.max(0, params.keycapGapMm ?? 0);
  const stemTop = capHeight + capOffset;
  const topExtent = (keycap.meta.topExtent?.[0] ?? 15.2) * Math.max(1, Math.min(6.5, params.keycapUnit ?? 1));
  const drawable = filled.filter(({ glyph }) => !glyph.blank && glyph.rings.length > 0);
  const maxGlyphHeight = Math.max(...drawable.map(({ glyph }) => bounds(glyph.rings).h), 1e-6);
  const maxGlyphWidth = Math.max(...drawable.map(({ glyph }) => bounds(glyph.rings).w), 1e-6);
  const glyphScale = (Math.max(6, topExtent - 4.2) / Math.max(maxGlyphHeight, maxGlyphWidth))
    * Math.min(1.6, Math.max(0.4, params.fontSize / 15));
  const capCache = new Map<number, any>();
  const capForRotation = (rotation: number) => {
    if (capCache.has(rotation)) return capCache.get(rotation);
    const rotated = rotation ? ctx.track(cap.rotate([0, 0, rotation])) : cap;
    const lifted = ctx.track(rotated.translate([0, 0, capOffset]));
    capCache.set(rotation, lifted);
    return lifted;
  };

  for (let index = 0; index < filled.length; index++) {
    const entry = filled[index];
    const rotation = rotations[index];
    const position = positionOf(entry);
    let top = capForRotation(rotation);
    const glyph = fittedGlyph(ctx, entry.glyph, glyphScale, params.legendBold);
    let letter: any = null;
    if (glyph) {
      try {
        // Keep the legend as a separate, shallow raised mesh. This is more
        // robust across imported fonts than intersecting it with the curved
        // keycap shell, and it remains visible in both assembled/exploded views.
        letter = ctx.track(wasm.Manifold.extrude(glyph, 0.45)
          .translate([0, 0, stemTop + 0.08]));
        if (letter.isEmpty()) letter = null;
      } catch {
        warnings.push(`Letter ${entry.index + 1} could not be engraved.`);
      }
    }
    parts.push(toPart(
      top,
      position,
      'cap',
      'top',
      params.capColorByIndex?.[entry.index] ?? params.capColorRgb ?? params.bodyColorRgb ?? DEFAULT_BODY,
      `cap-${entry.index}`,
    ));
    if (letter) {
      parts.push(toPart(letter, position, 'cap', 'top', entry.glyph.filamentRgb ?? DEFAULT_LETTER, entry.glyph.partName ?? `top-color-${entry.index}-0`));
    }
  }

  ctx.cleanup();
  return { parts, switchPlacements: placements, warnings };
}

// Kept temporarily as a reference implementation while the web-compatible
// path remains the public builder.
void buildBlocksLegacy;
void makeStraightModuleBase;

/**
 * Blocks implementation matching the Vostok Labs generator:
 * - one connector-aware asset per printed block;
 * - no artificial floor or side rails;
 * - the supplied keycap shell/stem remains the source shape;
 * - optional parametric lips/walls extend outward without changing sockets;
 * - the legend is a separate raised, printable colour part.
 */
export function buildBlocks(
  wasm: any,
  assets: PreparedBlockAssets,
  keycap: KeycapAsset,
  params: BlocksBuildParams,
  _socket: any | null = null,
): { parts: ClickerPart[]; switchPlacements: SwitchPlacement[]; warnings: string[] } {
  const ctx = new BuildContext(wasm);
  const parts: ClickerPart[] = [];
  const switchPlacements: SwitchPlacement[] = [];
  const warnings: string[] = [];
  const columns = params.vertical ? 1 : Math.max(1, params.glyphs.length);
  const filled = params.glyphs
    .map((glyph, index) => ({ glyph, index, row: Math.floor(index / columns), col: index % columns }))
    .filter(({ glyph }) => glyph.blank || glyph.rings.some((ring) => ring.length >= 3));

  if (!filled.length) {
    return { parts, switchPlacements, warnings: ['Add a letter or a symbol to build blocks.'] };
  }

  const occupied = new Set(filled.map(({ row, col }) => `${row},${col}`));
  const connectedMask = filled.map(({ row, col }) => (
    (occupied.has(`${row - 1},${col}`) ? DIR.N : 0)
    | (occupied.has(`${row + 1},${col}`) ? DIR.S : 0)
    | (occupied.has(`${row},${col + 1}`) ? DIR.E : 0)
    | (occupied.has(`${row},${col - 1}`) ? DIR.W : 0)
  ));
  const rotations = connectedMask.map((mask) => assets.byMask.get(mask)?.rot ?? 0);
  const rotated = rotations.map((rotation) => Math.round(rotation / 90) % 2 === 1);
  const pitch = rotated.every((value) => value === rotated[0]) ? assets.pitch : assets.pitchMax;
  const minRow = Math.min(...filled.map(({ row }) => row));
  const maxRow = Math.max(...filled.map(({ row }) => row));
  const minCol = Math.min(...filled.map(({ col }) => col));
  const maxCol = Math.max(...filled.map(({ col }) => col));
  const originX = -((minCol + maxCol) / 2) * pitch;
  const originY = ((minRow + maxRow) / 2) * pitch;
  const positionOf = (entry: { row: number; col: number }): [number, number] => [
    originX + entry.col * pitch,
    originY - entry.row * pitch,
  ];

  const assetCache = new Map<number, { solid: any; rot: number }>();
  const selectAsset = (mask: number) => {
    const cached = assetCache.get(mask);
    if (cached) return cached;
    const source = assets.byMask.get(mask) ?? assets.byMask.get(0);
    if (!source) throw new Error(`No block asset for connect pattern ${mask}`);
    const rotatedSolid = source.rot ? ctx.track(source.solid.rotate([0, 0, source.rot])) : source.solid;
    const prepared = { solid: addTopConnector(ctx, rotatedSolid, mask), rot: source.rot };
    assetCache.set(mask, prepared);
    return prepared;
  };

  const bodyColor = params.bodyColorRgb ?? DEFAULT_BODY;
  const baseScale = Number.isFinite(params.baseHeightMm) && (params.baseHeightMm as number) > 0
    ? Math.max(0.25, Math.min(4, (params.baseHeightMm as number) / 14))
    : 1;
  const scaleFromBottom = (solid: any, factor: number): any => {
    if (Math.abs(factor - 1) < 0.0001) return solid;
    const box = solid.boundingBox();
    const normalized = ctx.track(solid.translate([0, 0, -box.min[2]]));
    return ctx.track(normalized.scale([1, 1, factor]).translate([0, 0, box.min[2]]));
  };

  const selectedForBuild = filled.map(({ row, col }, index) => ({
    selected: selectAsset(connectedMask[index]),
    position: positionOf({ row, col }),
  }));
  const commonFloor = params.flatBottom === false
    ? Math.min(...selectedForBuild.map(({ selected }) => selected.solid.boundingBox().min[2]))
    : Math.max(...selectedForBuild.map(({ selected }) => selected.solid.boundingBox().min[2]));
  const blockSolids: any[] = [];
  for (const { selected, position } of selectedForBuild) {
    // Use the web's prepared connector module directly. Its underside and MX
    // socket are the actual printable cutout; a replacement rectangular base
    // loses that structure.
    const source = params.flatBottom === false
      ? selected.solid
      : flattenBottom(ctx, selected.solid, commonFloor);
    const block = addOutwardModuleWall(
      ctx,
      scaleFromBottom(source, baseScale),
      params.moduleSideThicknessMm ?? 0,
      params.vertical,
    );
    blockSolids.push(block);
    parts.push(toPart(block, position, 'body', 'base', bodyColor, `block-${blockSolids.length - 1}`));
    switchPlacements.push({ x: position[0], y: position[1], rotation: selected.rot });
  }

  const cap = makeKeycap(
    ctx,
    keycap,
    params.stemTolerance ?? 0,
    params.keycapThicknessMm ?? 2,
    params.keycapCornerRadiusMm ?? 2.8,
    params.keycapShape ?? 'rounded',
    params.keycapProfile ?? 'standard',
    params.keycapUnit ?? 1,
  );
  const rawCapBox = cap.boundingBox();
  const rawCapHeight = Math.max(0.5, rawCapBox.max[2] - rawCapBox.min[2]);
  const desiredCapHeight = Number.isFinite(params.keycapHeightMm) && (params.keycapHeightMm as number) > 0
    ? Math.max(6, Math.min(18, params.keycapHeightMm as number))
    : rawCapHeight;
  const capScale = Math.max(0.25, Math.min(4, desiredCapHeight / rawCapHeight));
  const scaledCap = scaleFromBottom(
    cap,
    capScale,
  );
  const capSeat = blockSolids.length ? findCapSeat(ctx, scaledCap, blockSolids[0]) : 0;
  const recessDepth = Math.max(1.5, Math.min(4.2, desiredCapHeight * 0.28));
  const capOffset = params.keycapMount === 'recessed'
    ? capSeat - recessDepth + Math.max(0, params.keycapGapMm ?? 0)
    : capSeat + Math.max(0, params.travel ?? 4) + Math.max(0, params.keycapGapMm ?? 0);
  const capTopZ = scaledCap.boundingBox().max[2] + capOffset;
  const capCache = new Map<number, any>();
  const capForRotation = (rotation: number) => {
    const cached = capCache.get(rotation);
    if (cached) return cached;
    const rotatedCap = rotation ? ctx.track(scaledCap.rotate([0, 0, rotation])) : scaledCap;
    const lifted = ctx.track(rotatedCap.translate([0, 0, capOffset]));
    capCache.set(rotation, lifted);
    return lifted;
  };

  const topExtent = keycap.meta.topExtent?.[0] ?? 15.2;
  const drawable = filled.filter(({ glyph }) => !glyph.blank && glyph.rings.length > 0);
  const maxGlyphHeight = Math.max(...drawable.map(({ glyph }) => bounds(glyph.rings).h), 1e-6);
  const maxGlyphWidth = Math.max(...drawable.map(({ glyph }) => bounds(glyph.rings).w), 1e-6);
  const glyphScale = (Math.max(6, topExtent - 4.2) / Math.max(maxGlyphHeight, maxGlyphWidth))
    * Math.min(1.6, Math.max(0.4, params.fontSize / 15));
  const bold = Math.max(-0.35, Math.min(0.9, params.legendBold ?? 0));

  for (let index = 0; index < filled.length; index++) {
    const entry = filled[index];
    const position = positionOf(entry);
    const capRotation = rotations[index];
    let capPart = capForRotation(capRotation);
    let legend: any = null;
    const glyphBounds = bounds(entry.glyph.rings);
    const centerX = (glyphBounds.minX + glyphBounds.maxX) / 2;
    const centerY = (glyphBounds.minY + glyphBounds.maxY) / 2;
    const rings = entry.glyph.rings
      .filter((ring) => ring.length >= 3)
      .map((ring) => ring.map(([x, y]) => [(x - centerX) * glyphScale, (y - centerY) * glyphScale] as [number, number]))
      .filter((ring) => area(ring) > 0.0005);

    if (!rings.length) {
      warnings.push(`Letter ${index + 1} has no printable outline. Its cap is blank.`);
    } else {
      try {
        let glyph = ctx.track(new wasm.CrossSection(rings, 'NonZero'));
        if (Math.abs(bold) > 0.005) {
          const expanded = ctx.track(glyph.offset(bold, 'Round', 2, 24));
          if (!expanded.isEmpty()) glyph = expanded;
        }
        // Legends are separate printable solids. Keep the cap intact and put
        // the letter above its top face; intersecting it with the cap created
        // an engraving, so the old "extrude" option could never look raised.
        const raisedHeight = 0.45;
        legend = ctx.track(wasm.Manifold.extrude(glyph, raisedHeight)
          .translate([0, 0, capTopZ + 0.04]));
        if (legend.isEmpty()) {
          warnings.push(`Letter ${index + 1} did not produce a raised mesh.`);
          legend = null;
        }
      } catch {
        warnings.push(`Letter ${index + 1} could not be extruded (bad outline).`);
      }
    }

    parts.push(toPart(
      capPart,
      position,
      'cap',
      'top',
      params.capColorByIndex?.[index] ?? params.capColorRgb ?? bodyColor,
      `cap-${index}`,
    ));
    if (legend) {
      const orientedLegend = capRotation
        ? ctx.track(legend.rotate([0, 0, capRotation]))
        : legend;
      parts.push(toPart(orientedLegend, position, 'cap', 'top', entry.glyph.filamentRgb ?? DEFAULT_LETTER, entry.glyph.partName ?? `top-color-${index}-0`));
    }
  }

  ctx.cleanup();
  return { parts, switchPlacements, warnings };
}
