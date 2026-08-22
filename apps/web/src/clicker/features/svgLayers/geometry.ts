import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import type { ClickerPart, RGB } from '../../types';
import type { SvgLayerDocument, SvgLayersSettings } from './model';

function geometryToPart(geometry: THREE.BufferGeometry, group: 'top' | 'base', name: string, colorRgb: RGB): ClickerPart {
  const indexed = geometry.index ? geometry : geometry.toNonIndexed();
  const position = indexed.getAttribute('position');
  const vertices = new Float32Array(position.array as ArrayLike<number>);
  const index = indexed.index;
  const triangles = index ? new Uint32Array(index.array as ArrayLike<number>) : new Uint32Array(Array.from({ length: position.count }, (_, i) => i));
  if (indexed !== geometry) indexed.dispose();
  return {
    kind: group === 'top' ? 'cap' : 'body',
    group,
    colorRgb,
    name,
    vertProperties: vertices,
    triVerts: triangles,
    numProp: 3,
  };
}

function sourceColor(path: any, fallback: RGB): RGB {
  const style = path.userData?.style || {};
  const value = style.fill && style.fill !== 'none' ? style.fill : style.stroke;
  if (!value || value === 'currentColor') return fallback;
  try {
    const color = new THREE.Color(value);
    return [Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255)];
  } catch {
    return fallback;
  }
}

function normalizeGeometry(geometry: THREE.BufferGeometry, doc: SvgLayerDocument, targetSizeMm: number) {
  const position = geometry.getAttribute('position');
  const width = Math.max(0.001, doc.bounds.maxX - doc.bounds.minX);
  const height = Math.max(0.001, doc.bounds.maxY - doc.bounds.minY);
  const scale = targetSizeMm / Math.max(width, height);
  const cx = (doc.bounds.minX + doc.bounds.maxX) / 2;
  const cy = (doc.bounds.minY + doc.bounds.maxY) / 2;
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    position.setXYZ(index, (x - cx) * scale, -(y - cy) * scale, position.getZ(index));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

function makePathGeometries(path: any, depth: number): THREE.BufferGeometry[] {
  const shapes = SVGLoader.createShapes(path) as THREE.Shape[];
  return shapes.map((shape) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.05, depth),
      bevelEnabled: false,
      curveSegments: 20,
      steps: 1,
    });
    return geometry;
  });
}

export function buildSvgLayerParts(doc: SvgLayerDocument, settings: SvgLayersSettings): ClickerPart[] {
  const parts: ClickerPart[] = [];
  const baseLayers = doc.layers.filter((layer) => layer.assignment === 'base');
  const topLayers = doc.layers.filter((layer) => layer.assignment === 'top');
  const appendLayers = (layers: typeof doc.layers, group: 'top' | 'base') => {
    for (const layer of layers) {
      for (const pathIndex of layer.pathIndexes) {
        const source = doc.paths[pathIndex];
        if (!source) continue;
        let geometries: THREE.BufferGeometry[] = [];
        try { geometries = makePathGeometries(source.path, group === 'base' ? settings.baseDepthMm : settings.topDepthMm); } catch { continue; }
        for (const [shapeIndex, geometry] of geometries.entries()) {
          normalizeGeometry(geometry, doc, settings.targetSizeMm);
          if (group === 'top') geometry.translate(0, 0, settings.baseDepthMm + settings.topOffsetMm);
          const color = settings.topColorMode === 'single' && group === 'top' ? settings.topColor : sourceColor(source.path, group === 'base' ? settings.baseColor : settings.topColor);
          parts.push(geometryToPart(geometry, group, `svg-${group}-${layer.id}-${shapeIndex}`, color));
          geometry.dispose();
        }
      }
    }
  };
  appendLayers(baseLayers, 'base');
  appendLayers(topLayers, 'top');
  return parts;
}
