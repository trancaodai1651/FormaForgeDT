import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import type { Ring } from '../../types';
import { clampOrganizerParams, type OrganizerLabel, type OrganizerParams } from './model';

interface MeshPayload {
  positions: Float32Array;
  indices: Uint32Array;
}

interface OrganizerLabelInput extends OrganizerLabel {
  rings: Ring[];
}

interface BuildRequest {
  id: number;
  params: OrganizerParams;
  label: OrganizerLabelInput | null;
}

let modulePromise: Promise<any> | null = null;

async function getWasm() {
  if (!modulePromise) {
    modulePromise = (async () => {
      const wasm = await Module({ locateFile: () => wasmUrl });
      wasm.setup();
      return wasm;
    })();
  }
  return modulePromise;
}

function roundedRect(wasm: any, width: number, depth: number, radius: number) {
  const r = Math.max(0, Math.min(radius, Math.min(width, depth) / 2 - 0.01));
  if (r < 0.01) return wasm.CrossSection.square([width, depth], true);
  const core = wasm.CrossSection.square([Math.max(0.2, width - 2 * r), Math.max(0.2, depth - 2 * r)], true);
  return core.offset(r, 'Round', undefined, 64);
}

function makeTextureProfile(wasm: any, params: OrganizerParams) {
  if (params.wallTexture === 'none' || params.textureDepth < 0.001) return null;
  const count = Math.max(1, Math.min(2400, Math.round(params.textureCount * (
    params.wallTexture === 'ribbed' ? 12 : params.wallTexture === 'faceted' ? 10 : 14
  ))));
  const points: Array<{ x: number; y: number; nx: number; ny: number; s: number }> = [];
  const halfW = params.width / 2;
  const halfD = params.depth / 2;
  const r = Math.max(0.001, Math.min(params.radius, Math.min(halfW, halfD) - 0.01));
  const straightX = params.width - 2 * r;
  const straightY = params.depth - 2 * r;
  const arc = Math.PI * r / 2;
  const perimeter = 2 * straightX + 2 * straightY + 2 * Math.PI * r;
  const segments: Array<{ length: number; at: (distance: number) => { x: number; y: number; nx: number; ny: number } }> = [
    { length: straightY, at: (d) => ({ x: halfW, y: -(halfD - r) + d, nx: 1, ny: 0 }) },
    { length: arc, at: (d) => { const a = d / r; return { x: halfW - r + r * Math.cos(a), y: halfD - r + r * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) }; } },
    { length: straightX, at: (d) => ({ x: halfW - r - d, y: halfD, nx: 0, ny: 1 }) },
    { length: arc, at: (d) => { const a = Math.PI / 2 + d / r; return { x: -(halfW - r) + r * Math.cos(a), y: halfD - r + r * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) }; } },
    { length: straightY, at: (d) => ({ x: -halfW, y: halfD - r - d, nx: -1, ny: 0 }) },
    { length: arc, at: (d) => { const a = Math.PI + d / r; return { x: -(halfW - r) + r * Math.cos(a), y: -(halfD - r) + r * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) }; } },
    { length: straightX, at: (d) => ({ x: -(halfW - r) + d, y: -halfD, nx: 0, ny: -1 }) },
    { length: arc, at: (d) => { const a = Math.PI * 1.5 + d / r; return { x: halfW - r + r * Math.cos(a), y: -(halfD - r) + r * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) }; } },
  ];
  let segmentIndex = 0;
  let segmentStart = 0;
  for (let index = 0; index < count; index++) {
    const distance = (index / count) * perimeter;
    while (segmentIndex < segments.length - 1 && distance >= segmentStart + segments[segmentIndex].length) {
      segmentStart += segments[segmentIndex].length;
      segmentIndex++;
    }
    const segment = segments[segmentIndex];
    const point = segment.at(Math.min(distance - segmentStart, segment.length));
    const phase = (distance / perimeter) % 1;
    const wave = params.wallTexture === 'fluted'
      ? -params.textureDepth * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase))
      : params.wallTexture === 'reeded'
        ? params.textureDepth * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase))
        : params.wallTexture === 'ribbed'
          ? params.textureDepth * (phase < 0.12 ? phase / 0.12 : phase > 0.38 ? (0.5 - phase) / 0.12 : 1)
          : params.wallTexture === 'faceted'
            ? params.textureDepth * (phase < 0.25 ? phase / 0.25 : phase < 0.75 ? 1 - (phase - 0.25) / 0.25 : -1 + (phase - 0.75) / 0.25)
            : params.textureDepth * Math.sin(2 * Math.PI * phase);
    points.push({ ...point, x: point.x + point.nx * wave, y: point.y + point.ny * wave, s: distance });
  }
  return new wasm.CrossSection([points.map((point) => [point.x, point.y])]);
}

function meshPayload(solid: any): MeshPayload {
  const raw = solid.getMesh();
  const numProp = raw.numProp ?? 3;
  let positions: Float32Array;
  if (numProp === 3) {
    positions = new Float32Array(raw.vertProperties);
  } else {
    positions = new Float32Array((raw.vertProperties.length / numProp) * 3);
    for (let index = 0; index < raw.vertProperties.length / numProp; index++) {
      positions[index * 3] = raw.vertProperties[index * numProp];
      positions[index * 3 + 1] = raw.vertProperties[index * numProp + 1];
      positions[index * 3 + 2] = raw.vertProperties[index * numProp + 2];
    }
  }
  return {
    positions,
    indices: new Uint32Array(raw.triVerts),
  };
}

function bounds(rings: Ring[]) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function makeLabel(wasm: any, params: OrganizerParams, label: OrganizerLabelInput) {
  const bossDepth = 3;
  const bossWidth = 2.5;
  const pocketDepth = 2.2;
  const lipLayer = 0.5;
  const lipOver = 0.7;
  const clearance = 0.25;
  const textMargin = 2.5;
  const textBounds = bounds(label.rings);
  const maxWidth = Math.max(16, params.width - 2 * Math.max(params.radius, 2));
  const maxHeight = Math.max(12, params.height - 4);
  const plateHeight = Math.min(label.plateHeight, Math.max(4, maxHeight - 2 * bossWidth));
  const usableTextHeight = Math.max(1, plateHeight - 2 * textMargin);
  const usableTextWidth = Math.max(1, maxWidth - 2 * bossWidth - 2 * textMargin);
  let scale = 1;
  let textWidth = 0;
  if (textBounds.width > 0 && textBounds.height > 0) {
    scale = Math.min(label.fontSize, usableTextWidth / textBounds.width, usableTextHeight / textBounds.height);
    scale = Math.max(0.05, scale);
    textWidth = textBounds.width * scale;
  }
  const plateWidth = Math.min(maxWidth - 2 * params.radius, Math.max(10, textWidth + 2 * textMargin));
  const fullWidth = plateWidth + 2 * bossWidth;
  const fullHeight = plateHeight + 2 * bossWidth;
  const z = Math.min(Math.max(fullHeight / 2 + 1, params.height * 0.5), params.height - fullHeight / 2 - 1);
  const front = -params.depth / 2;
  const boss = wasm.Manifold.cube([fullWidth, bossDepth, fullHeight], true)
    .translate([0, front - bossDepth / 2, z]);
  const pocket = wasm.Manifold.cube([plateWidth, pocketDepth - lipLayer, plateHeight], true)
    .translate([0, front - bossDepth + lipLayer + (pocketDepth - lipLayer) / 2, z]);
  const lip = wasm.Manifold.cube([plateWidth, lipLayer + 0.1, plateHeight - 2 * lipOver], true)
    .translate([0, front - bossDepth + lipLayer / 2, z]);
  const cut = pocket.add(lip);
  const plate = wasm.Manifold.cube([plateWidth - 2 * clearance, pocketDepth - lipLayer - clearance, plateHeight - 2 * clearance], true)
    .translate([0, front - bossDepth + lipLayer + (pocketDepth - lipLayer) / 2, z]);
  let text: any = null;
  if (scale > 0 && textBounds.width > 0 && textBounds.height > 0) {
    const scaled = label.rings.map((ring) => ring.map(([x, yy]) => [(x - textBounds.cx) * scale, (yy - textBounds.cy) * scale] as [number, number]));
    const section = new wasm.CrossSection(scaled, 'EvenOdd');
    text = wasm.Manifold.extrude(section, label.embossDepth)
      .rotate([90, 0, 0])
      .translate([0, front - bossDepth + lipLayer, z]);
  }
  return { boss, cut, plate, text, z };
}

function makeLabelTab(wasm: any, params: OrganizerParams) {
  if (!params.labelTab) return null;
  const tabDepth = 12;
  const tabHeight = 8;
  const minTip = 1.6;
  const bevelRadius = 0.4;
  const inset = Math.max(2, tabDepth - tabHeight);
  const length = Math.max(4, params.width - 2 * Math.max(params.radius, 2));
  const profile = new wasm.CrossSection([[[-inset, 0], [0, 0], [tabHeight, tabDepth], [tabHeight - minTip, tabDepth]]], 'NonZero')
    .offset(bevelRadius, 'Round', undefined, 64)
    .offset(-bevelRadius, 'Round', undefined, 64);
  return wasm.Manifold.extrude(profile, length)
    .rotate([0, -90, 0])
    .translate([length / 2, -params.depth / 2, params.height]);
}

async function build(request: BuildRequest) {
  const wasm = await getWasm();
  const normalized = clampOrganizerParams(request.params);
  const params = normalized.params;
  const owned: any[] = [];
  const keep = <T>(value: T): T => { owned.push(value); return value; };
  const makeSolid = (section: any, height: number, z = 0) => keep(keep(wasm.Manifold.extrude(section, Math.max(0.01, height))).translate([0, 0, z]));
  const cellW = (params.width - 2 * params.wall - (params.cols - 1) * params.divider) / params.cols;
  const cellD = (params.depth - 2 * params.wall - (params.rows - 1) * params.divider) / params.rows;
  const innerR = Math.max(0, Math.min(params.radius, cellW / 2 - 0.01, cellD / 2 - 0.01, 2));
  const floorCavityHeight = Math.max(0.1, params.height - params.floor);
  const outerProfile = makeTextureProfile(wasm, params) ?? roundedRect(wasm, params.width, params.depth, params.radius);
  owned.push(outerProfile);
  let solid = makeSolid(outerProfile, params.height);
  const x0 = -params.width / 2 + params.wall + cellW / 2;
  const y0 = -params.depth / 2 + params.wall + cellD / 2;
  const cutters: any[] = [];
  const scoopAdditions: any[] = [];

  for (let col = 0; col < params.cols; col++) for (let row = 0; row < params.rows; row++) {
    const x = x0 + col * (cellW + params.divider);
    const y = y0 + row * (cellD + params.divider);
    const cavityProfile = roundedRect(wasm, cellW, cellD, innerR);
    owned.push(cavityProfile);
    cutters.push(keep(makeSolid(cavityProfile, floorCavityHeight, params.floor).translate([x, y, 0])));
    if (params.floorHoles) {
      const holeRadius = Math.min(cellW, cellD) * 0.22;
      cutters.push(keep(wasm.Manifold.cylinder(params.floor + 2, holeRadius, holeRadius, 48, true).translate([x, y, params.floor / 2])));
    }
    if (params.fingerScoops) {
      const scoopRadius = Math.min(cellD, floorCavityHeight) * 0.45;
      const scoopCylinder = keep(wasm.Manifold.cylinder(cellW, scoopRadius, scoopRadius, 48, true)
        .rotate([0, 90, 0]).translate([x, y - cellD / 2 + scoopRadius, params.floor + scoopRadius]));
      const scoopBox = keep(wasm.Manifold.cube([cellW, scoopRadius, scoopRadius], true)
        .translate([x, y - cellD / 2 + scoopRadius / 2, params.floor + scoopRadius / 2]));
      scoopAdditions.push(keep(scoopBox.subtract(scoopCylinder)));
    }
  }

  if (cutters.length) solid = keep(solid.subtract(keep(wasm.Manifold.union(cutters))));
  if (scoopAdditions.length) solid = keep(solid.add(keep(wasm.Manifold.union(scoopAdditions))));

  const labelTab = makeLabelTab(wasm, params);
  if (labelTab) {
    owned.push(labelTab);
    solid = keep(solid.add(labelTab));
  }

  let labelPayload: { plate: MeshPayload; text: MeshPayload | null; position: { z: number } } | null = null;
  if (request.label?.enabled) {
    const label = makeLabel(wasm, params, request.label);
    owned.push(label.boss, label.cut, label.plate);
    if (label.text) owned.push(label.text);
    solid = keep(solid.add(label.boss).subtract(label.cut));
    labelPayload = {
      plate: meshPayload(label.plate),
      text: label.text ? meshPayload(label.text) : null,
      position: { z: label.z },
    };
  }

  if (params.stackingLip) {
    const lipHeight = Math.min(4, Math.max(1, params.height - 1));
    const lipWall = Math.min(1.2, params.wall - 0.6);
    if (lipWall >= 0.4) {
      const lipProfile = roundedRect(wasm, params.width, params.depth, params.radius);
      // Match the reference generator's two-part lip construction. The raised
      // ring is added above the rim, while the matching outer band is removed
      // from the lower part of the shell. Keeping both profiles tied to the
      // same rounded outline prevents a square/rounded mismatch at corners.
      const innerProfile = lipProfile.offset(-0.25, 'Round', undefined, 64);
      const lipInner = innerProfile.offset(-lipWall, 'Round', undefined, 64);
      const outerCut = lipProfile.subtract(
        lipProfile.offset(-(lipWall + 0.5), 'Round', undefined, 64),
      );
      owned.push(lipProfile, innerProfile, lipInner, outerCut);
      const lipRing = keep(innerProfile.subtract(lipInner));
      solid = keep(solid.add(makeSolid(lipRing, lipHeight, params.height)));
      solid = keep(solid.subtract(makeSolid(outerCut, lipHeight)));
    }
  }

  const result = {
    id: request.id,
    mesh: meshPayload(solid),
    label: labelPayload,
    info: {
      bbox: [params.width, params.depth, params.height] as [number, number, number],
      compartments: params.cols * params.rows,
      cellInner: [cellW, cellD] as [number, number],
      volumeCm3: solid.volume() / 1000,
      weightPlaG: solid.volume() / 1000 * 1.24,
      triangles: solid.numTri(),
    },
    params,
    warnings: normalized.warnings,
  };
  for (const item of [...owned].reverse()) {
    try { item.delete?.(); } catch { /* ignore cleanup errors */ }
  }
  return result;
}

self.onmessage = (event: MessageEvent<BuildRequest>) => {
  void build(event.data).then((result) => {
    const transfers: Transferable[] = [result.mesh.positions.buffer, result.mesh.indices.buffer];
    if (result.label) {
      transfers.push(result.label.plate.positions.buffer, result.label.plate.indices.buffer);
      if (result.label.text) transfers.push(result.label.text.positions.buffer, result.label.text.indices.buffer);
    }
    (self as unknown as Worker).postMessage(result, transfers);
  }).catch((error: unknown) => {
    (self as unknown as Worker).postMessage({ id: event.data.id, error: error instanceof Error ? error.message : String(error) });
  });
};
