import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import type { RGB, Ring } from '../../types';
import type { SvgLayer, SvgLayerDocument, SvgLayerPath } from './model';

function parseColor(value: string | undefined, fallback: RGB = [22, 22, 22]): RGB {
  if (!value || value === 'none' || value === 'currentColor') return fallback;
  try {
    const color = new THREE.Color(value);
    return [Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255)];
  } catch {
    return fallback;
  }
}

function ringArea(ring: Ring): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return area / 2;
}

function pathArea(path: any): number {
  try {
    const shapes = SVGLoader.createShapes(path) as THREE.Shape[];
    return shapes.reduce((sum, shape) => {
      const outer = shape.getPoints(16).map((point) => [point.x, point.y] as [number, number]);
      const holes = shape.holes.map((hole) => hole.getPoints(16).map((point) => [point.x, point.y] as [number, number]));
      return sum + Math.abs(ringArea(outer)) - holes.reduce((holeSum, ring) => holeSum + Math.abs(ringArea(ring)), 0);
    }, 0);
  } catch {
    return 0;
  }
}

function pathBounds(path: any, bounds: { minX: number; minY: number; maxX: number; maxY: number }) {
  try {
    const shapes = SVGLoader.createShapes(path) as THREE.Shape[];
    for (const shape of shapes) {
      for (const point of shape.getPoints(16)) {
        bounds.minX = Math.min(bounds.minX, point.x);
        bounds.minY = Math.min(bounds.minY, point.y);
        bounds.maxX = Math.max(bounds.maxX, point.x);
        bounds.maxY = Math.max(bounds.maxY, point.y);
      }
      for (const hole of shape.holes) {
        for (const point of hole.getPoints(16)) {
          bounds.minX = Math.min(bounds.minX, point.x);
          bounds.minY = Math.min(bounds.minY, point.y);
          bounds.maxX = Math.max(bounds.maxX, point.x);
          bounds.maxY = Math.max(bounds.maxY, point.y);
        }
      }
    }
  } catch {
    // An unsupported SVG primitive is simply left out of the printable layer list.
  }
}

function nodeLabel(node: Element | null, fallback: string): string {
  if (!node) return fallback;
  const label = node.getAttribute('inkscape:label') || node.getAttribute('data-name') || node.getAttribute('aria-label') || node.getAttribute('id');
  if (label?.trim()) return label.trim().replace(/[-_]+/g, ' ');
  return fallback;
}

function layerNodeFor(node: Element | null): Element | null {
  let current = node;
  while (current && current.tagName.toLowerCase() !== 'svg') {
    // Use a group as one selectable region only when the SVG author gave it a
    // meaningful name. Anonymous groups are flattened to their individual
    // paths so a flower exported without layer names still lets the user pick
    // the head and petals separately.
    if (current.tagName.toLowerCase() === 'g' && (
      current.hasAttribute('id') || current.hasAttribute('inkscape:label') || current.hasAttribute('data-name') || current.hasAttribute('aria-label')
    )) return current;
    current = current.parentElement;
  }
  return node;
}

function isCanvasBackground(node: Element | null, bounds: { minX: number; minY: number; maxX: number; maxY: number }, area: number): boolean {
  if (!node || node.tagName.toLowerCase() !== 'rect') return false;
  const x = Number(node.getAttribute('x') || 0);
  const y = Number(node.getAttribute('y') || 0);
  const width = Number(node.getAttribute('width') || 0);
  const height = Number(node.getAttribute('height') || 0);
  const canvasArea = Math.max(1, (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY));
  const spansCanvas = width >= (bounds.maxX - bounds.minX) * 0.9 && height >= (bounds.maxY - bounds.minY) * 0.9;
  const startsAtCanvas = Math.abs(x - bounds.minX) < Math.max(1, width * 0.08) && Math.abs(y - bounds.minY) < Math.max(1, height * 0.08);
  return spansCanvas && startsAtCanvas && area >= canvasArea * 0.65;
}

function sanitizePreview(svgText: string): string {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  for (const element of Array.from(doc.querySelectorAll('script, foreignObject'))) element.remove();
  for (const element of Array.from(doc.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name) || /^(href|xlink:href)$/i.test(attribute.name) && /^https?:/i.test(attribute.value)) element.removeAttribute(attribute.name);
    }
  }
  return doc.documentElement.outerHTML;
}

export function parseSvgLayers(source: string, name: string): SvgLayerDocument {
  const data = new SVGLoader().parse(source) as { paths: any[]; xml: XMLDocument };
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const paths: SvgLayerPath[] = [];
  const layerByNode = new Map<Element, SvgLayer>();
  const pathNodes: Element[] = [];

  for (const [index, path] of data.paths.entries()) {
    const style = path.userData?.style || {};
    const hasFill = style.fill && style.fill !== 'none';
    const hasStroke = style.stroke && style.stroke !== 'none';
    if (!hasFill && !hasStroke) continue;
    const color = parseColor(hasFill ? style.fill : style.stroke, [22, 22, 22]);
    const node = (path.userData?.node || null) as Element | null;
    const layerNode = layerNodeFor(node);
    const area = pathArea(path);
    pathBounds(path, bounds);
    const current = layerNode ? layerByNode.get(layerNode) : undefined;
    const layer = current || {
      id: `svg-layer-${layerByNode.size + 1}`,
      label: nodeLabel(layerNode, `Region ${layerByNode.size + 1}`),
      pathIndexes: [],
      color,
      area: 0,
      isBackground: false,
      assignment: 'none' as const,
    };
    if (!current && layerNode) layerByNode.set(layerNode, layer);
    layer.pathIndexes.push(paths.length);
    layer.area += area;
    paths.push({ path, color });
    pathNodes.push(node || data.xml.documentElement);
  }

  if (!Number.isFinite(bounds.minX)) throw new Error('SVG không có vùng vector có thể dựng hình.');
  for (const layer of layerByNode.values()) {
    const firstPath = paths[layer.pathIndexes[0]]?.path;
    const node = (firstPath?.userData?.node || null) as Element | null;
    layer.isBackground = isCanvasBackground(node, bounds, layer.area);
  }

  const layers = Array.from(layerByNode.values());
  for (const [index, layer] of layers.entries()) {
    const layerNode = Array.from(layerByNode.entries()).find(([, value]) => value === layer)?.[0];
    layerNode?.setAttribute('data-ff-svg-layer', layer.id);
    for (const pathIndex of layer.pathIndexes) pathNodes[pathIndex]?.setAttribute('data-ff-svg-layer', layer.id);
    if (!layer.label || layer.label.startsWith('Region')) layer.label = layer.isBackground ? 'Background' : `Region ${index + 1}`;
  }

  return {
    name,
    source,
    preview: sanitizePreview(data.xml.documentElement.outerHTML),
    layers,
    paths,
    bounds,
  };
}
