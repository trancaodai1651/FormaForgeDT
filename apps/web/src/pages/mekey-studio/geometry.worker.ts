import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import type { ClickerPart, Ring } from '../../clicker/types';
import { hexToRgb, type MekeyBuildDesign, type MekeyBuildRequest } from './model';

type Wasm = Awaited<ReturnType<typeof Module>>;
let modulePromise: Promise<Wasm> | null = null;

async function getModule() {
  if (!modulePromise) modulePromise = Module({ locateFile: () => wasmUrl }).then((wasm) => { wasm.setup(); return wasm; });
  return modulePromise;
}

function ringArea(ring: Ring) {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function toPart(solid: any, name: string, color: string): ClickerPart {
  const mesh = solid.getMesh();
  return {
    kind: 'body',
    group: 'base',
    name,
    colorRgb: hexToRgb(color),
    numProp: mesh.numProp,
    vertProperties: new Float32Array(mesh.vertProperties),
    triVerts: new Uint32Array(mesh.triVerts),
  };
}

function createSection(wasm: Wasm, rings: Ring[], sizeMm: number, spacing: number) {
  const valid = rings.filter((ring) => ring.length >= 3 && Math.abs(ringArea(ring)) > 0.00001);
  if (!valid.length) return null;
  const stretch = Math.max(0.72, Math.min(1.45, 1 + spacing / 45));
  return new wasm.CrossSection(valid, 'NonZero').scale([sizeMm * stretch, sizeMm]);
}

function attachRings(wasm: Wasm, source: any, design: MekeyBuildDesign) {
  let result = source;
  const bounds = source.bounds();
  const centerY = (bounds.min[1] + bounds.max[1]) / 2;
  design.rings.forEach((ring, index) => {
    if (!ring.enabled) return;
    const holeRadius = Math.max(1.2, ring.holeDiameterMm / 2);
    const outerRadius = holeRadius + Math.max(1, ring.thicknessMm);
    const side = index === 0 ? -1 : 1;
    const edgeX = index === 0 ? bounds.min[0] : bounds.max[0];
    const cx = edgeX + side * (outerRadius * 0.58) + ring.offsetX;
    const cy = centerY + ring.offsetY;
    const outer = wasm.CrossSection.circle(outerRadius, 64).translate([cx, cy]);
    const bridge = wasm.CrossSection.square([outerRadius * 1.55, outerRadius * 1.45], true)
      .translate([edgeX + side * outerRadius * 0.2, cy]);
    const hole = wasm.CrossSection.circle(holeRadius, 64).translate([cx, cy]);
    const next = result.add(outer).add(bridge).subtract(hole);
    if (result !== source) result.delete?.();
    outer.delete?.(); bridge.delete?.(); hole.delete?.();
    result = next;
  });
  return result;
}

function buildDesign(wasm: Wasm, design: MekeyBuildDesign, offset: [number, number], designIndex: number) {
  const source = createSection(wasm, design.rings2d, design.textSizeMm, design.textSpacing);
  if (!source) return { parts: [] as ClickerPart[], width: 0, height: 0 };
  const enabled = design.borders.map((layer, index) => ({ ...layer, index })).filter((layer) => layer.enabled);
  const footprints: Array<{ section: any; height: number; color: string; name: string }> = [];
  let cumulative = 0;
  for (const layer of enabled) {
    cumulative += Math.max(0, layer.widthMm);
    footprints.push({ section: source.offset(cumulative, 'Round', 2, 32), height: Math.max(0.4, layer.heightMm), color: layer.color, name: `border-${layer.index + 1}` });
  }
  const outer = footprints.at(-1)?.section ?? source;
  const ringedOuter = attachRings(wasm, outer, design);
  if (footprints.length) footprints[footprints.length - 1].section = ringedOuter;
  else footprints.push({ section: ringedOuter, height: 1.6, color: design.textColor, name: 'carrier' });

  let z = 0;
  const parts: ClickerPart[] = [];
  for (let i = footprints.length - 1; i >= 0; i--) {
    const layer = footprints[i];
    const solid = wasm.Manifold.extrude(layer.section, layer.height).translate([offset[0], offset[1], z]);
    parts.push(toPart(solid, `mekey-${designIndex + 1}-${layer.name}`, layer.color));
    solid.delete?.();
    z += layer.height;
  }
  const textSolid = wasm.Manifold.extrude(source, Math.max(0.4, design.textHeightMm)).translate([offset[0], offset[1], z]);
  parts.push(toPart(textSolid, `mekey-${designIndex + 1}-text`, design.textColor));
  textSolid.delete?.();

  const bounds = ringedOuter.bounds();
  const width = bounds.max[0] - bounds.min[0];
  const height = bounds.max[1] - bounds.min[1];
  const unique = new Set(footprints.map((entry) => entry.section));
  unique.forEach((section) => { if (section !== source) section.delete?.(); });
  source.delete?.();
  return { parts, width, height };
}

self.onmessage = async (event: MessageEvent<MekeyBuildRequest>) => {
  const request = event.data;
  try {
    const wasm = await getModule();
    const parts: ClickerPart[] = [];
    let cursorX = 0;
    let cursorY = 0;
    let rowHeight = 0;
    const bedWidth = Math.max(80, request.bedWidthMm ?? 256);
    const bedDepth = Math.max(80, request.bedDepthMm ?? 256);
    const spacing = Math.max(2, request.spacingMm ?? 12);
    const margin = Math.max(0, request.marginMm ?? 10);
    cursorX = margin;
    cursorY = margin;
    for (let i = 0; i < request.designs.length; i++) {
      const design = request.designs[i];
      const probe = buildDesign(wasm, design, [0, 0], i);
      if (!request.arrange) {
        parts.push(...probe.parts);
        break;
      }
      probe.parts.forEach((part) => { part.vertProperties = new Float32Array(0); part.triVerts = new Uint32Array(0); });
      if (cursorX > margin && cursorX + probe.width > bedWidth - margin) { cursorX = margin; cursorY += rowHeight + spacing; rowHeight = 0; }
      if (cursorY + probe.height > bedDepth - margin) throw new Error(`Designs exceed ${bedWidth}×${bedDepth} mm print bed.`);
      const placed = buildDesign(wasm, design, [cursorX + probe.width / 2, -(cursorY + probe.height / 2)], i);
      parts.push(...placed.parts);
      cursorX += placed.width + spacing;
      rowHeight = Math.max(rowHeight, placed.height);
    }
    const transfer: Transferable[] = [];
    parts.forEach((part) => transfer.push(part.vertProperties.buffer, part.triVerts.buffer));
    (self as unknown as Worker).postMessage({ id: request.id, parts }, transfer);
  } catch (error) {
    (self as unknown as Worker).postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) });
  }
};
