import * as THREE from 'three';
import { CAD_VIEW, offsetEntity, polygonPoints, sampleEntity, type CadDocument, type CadEntity, type CadFeature, type CadModelOperation } from './cad';

const SKETCH_SCALE = .45;

export type CadPreviewPart = { geometry: THREE.BufferGeometry; featureId: string; position?: [number, number, number]; };

export const MODELING_OPERATIONS: Array<{ id: CadModelOperation; labelKey: string; shortcut: string }> = [
  { id: 'extrude', labelKey: 'moduleSketch.model.extrude', shortcut: 'E' },
  { id: 'revolve', labelKey: 'moduleSketch.model.revolve', shortcut: 'V' },
  { id: 'sweep', labelKey: 'moduleSketch.model.sweep', shortcut: 'W' },
  { id: 'loft', labelKey: 'moduleSketch.model.loft', shortcut: '' },
  { id: 'shell', labelKey: 'moduleSketch.model.shell', shortcut: 'H' },
  { id: 'fillet', labelKey: 'moduleSketch.model.fillet', shortcut: 'F' },
  { id: 'chamfer', labelKey: 'moduleSketch.model.chamfer', shortcut: '' },
  { id: 'union', labelKey: 'moduleSketch.model.union', shortcut: 'Ctrl U' },
  { id: 'subtract', labelKey: 'moduleSketch.model.subtract', shortcut: 'Ctrl B' },
  { id: 'intersect', labelKey: 'moduleSketch.model.intersect', shortcut: 'Ctrl I' },
  { id: 'split', labelKey: 'moduleSketch.model.split', shortcut: '' },
  { id: 'offsetFace', labelKey: 'moduleSketch.model.offsetFace', shortcut: '' },
  { id: 'offsetEdge', labelKey: 'moduleSketch.model.offsetEdge', shortcut: '' },
];

function worldPoint(point: { x: number; y: number }) {
  return { x: (point.x - CAD_VIEW.axisX) * SKETCH_SCALE, y: (CAD_VIEW.originY - point.y) * SKETCH_SCALE };
}

function pathShape(points: Array<{ x: number; y: number }>) {
  if (points.length < 3) return null;
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => shape.lineTo(point.x, point.y));
  shape.closePath();
  return shape;
}

function pointsShape(points: Array<{ x: number; y: number }>, inset = 0) {
  if (points.length < 3) return null;
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
  const radius = Math.max(.001, Math.max(...points.map((point) => Math.hypot(point.x - center.x, point.y - center.y))));
  const scale = Math.max(.06, (radius - inset) / radius);
  return pathShape(points.map((point) => ({ x: center.x + (point.x - center.x) * scale, y: center.y + (point.y - center.y) * scale })));
}

function shapeFromEntity(entity: CadEntity, inset = 0): THREE.Shape | null {
  if (!entity.points.length) return null;
  if (entity.type === 'circle') {
    const center = worldPoint(entity.points[0]); const radius = Math.max(.5, Math.hypot(entity.points[1].x - entity.points[0].x, entity.points[1].y - entity.points[0].y) * SKETCH_SCALE - inset);
    const shape = new THREE.Shape(); shape.absellipse(center.x, center.y, radius, radius, 0, Math.PI * 2, false, 0); return shape;
  }
  if (entity.type === 'ellipse') {
    const center = worldPoint(entity.points[0]); const radiusX = Math.max(.5, Math.hypot(entity.points[1].x - entity.points[0].x, entity.points[1].y - entity.points[0].y) * SKETCH_SCALE - inset); const radiusY = Math.max(.5, Math.hypot(entity.points[2].x - entity.points[0].x, entity.points[2].y - entity.points[0].y) * SKETCH_SCALE - inset);
    const shape = new THREE.Shape(); shape.absellipse(center.x, center.y, radiusX, radiusY, 0, Math.PI * 2, false, 0); return shape;
  }
  if (entity.type === 'rectangle') {
    const first = worldPoint(entity.points[0]); const second = worldPoint(entity.points[1]); const minX = Math.min(first.x, second.x) + inset; const maxX = Math.max(first.x, second.x) - inset; const minY = Math.min(first.y, second.y) + inset; const maxY = Math.max(first.y, second.y) - inset;
    return pathShape([{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }]);
  }
  if (entity.type === 'polygon') return pointsShape(polygonPoints(entity).map(worldPoint), inset);
  if (entity.type === 'line' || entity.type === 'spline') {
    const points = sampleEntity(entity, 64).map(worldPoint); const first = points[0]; const last = points.at(-1)!;
    if (points.length >= 3 && Math.hypot(first.x - last.x, first.y - last.y) < 8) return pathShape(points.slice(0, -1));
  }
  return null;
}

function extrudeFromEntity(entity: CadEntity, feature: CadFeature, operation: CadModelOperation): THREE.BufferGeometry | null {
  const shape = shapeFromEntity(entity, operation === 'offsetFace' ? -feature.parameters.radius : 0);
  if (!shape) return null;
  if (operation === 'shell') {
    const hole = shapeFromEntity(entity, feature.parameters.thickness);
    if (hole) shape.holes.push(hole);
  }
  const depth = Math.max(1, feature.parameters.distance);
  const bevel = operation === 'fillet' || operation === 'chamfer';
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, curveSegments: 12, bevelEnabled: bevel,
    bevelSegments: operation === 'fillet' ? 6 : 1,
    bevelSize: bevel ? Math.min(feature.parameters.radius, depth * .28) : 0,
    bevelThickness: bevel ? Math.min(feature.parameters.radius, depth * .22) : 0,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function revolveFromEntity(entity: CadEntity, feature: CadFeature): THREE.BufferGeometry | null {
  if (!['line', 'spline', 'arc'].includes(entity.type)) return null;
  const points = sampleEntity(entity, 72).map((point) => {
    const world = worldPoint(point); return new THREE.Vector2(Math.max(.5, Math.abs(world.x)), world.y);
  });
  if (points.length < 2) return null;
  const geometry = new THREE.LatheGeometry(points, Math.max(12, Math.round(feature.parameters.segments)), 0, THREE.MathUtils.degToRad(feature.parameters.angle));
  geometry.computeVertexNormals();
  return geometry;
}

function sweepFromEntity(entity: CadEntity, feature: CadFeature): THREE.BufferGeometry | null {
  if (!['line', 'spline', 'arc'].includes(entity.type)) return null;
  const points = sampleEntity(entity, 72).map((point) => { const world = worldPoint(point); return new THREE.Vector3(world.x, world.y, 0); });
  if (points.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const geometry = new THREE.TubeGeometry(curve, Math.max(16, Math.round(feature.parameters.segments)), Math.max(.5, feature.parameters.radius), 12, false);
  geometry.computeVertexNormals();
  return geometry;
}

function buildFeatureParts(document: CadDocument, feature: CadFeature): CadPreviewPart[] {
  const entities = feature.sourceIds.map((id) => document.entities.find((entity) => entity.id === id)).filter((entity): entity is CadEntity => Boolean(entity && entity.visible));
  if (!entities.length) return [];
  if (feature.operation === 'revolve') return entities.flatMap((entity): CadPreviewPart[] => { const geometry = revolveFromEntity(entity, feature); return geometry ? [{ geometry, featureId: feature.id }] : []; });
  if (feature.operation === 'sweep') return entities.flatMap((entity): CadPreviewPart[] => { const geometry = sweepFromEntity(entity, feature); return geometry ? [{ geometry, featureId: feature.id }] : []; });
  if (feature.operation === 'subtract' && entities.length > 1) {
    const primary = shapeFromEntity(entities[0]);
    if (primary) entities.slice(1).forEach((entity) => { const hole = shapeFromEntity(entity, .3); if (hole) primary.holes.push(hole); });
    const depth = Math.max(1, feature.parameters.distance); const geometry = primary ? new THREE.ExtrudeGeometry(primary, { depth, curveSegments: 12 }) : null;
    if (geometry) { geometry.translate(0, 0, -depth / 2); geometry.computeVertexNormals(); return [{ geometry, featureId: feature.id }]; }
  }
  if (feature.operation === 'loft') {
    return entities.flatMap((entity, index): CadPreviewPart[] => { const geometry = extrudeFromEntity(entity, { ...feature, parameters: { ...feature.parameters, distance: Math.max(2, feature.parameters.distance / Math.max(1, entities.length)) } }, 'fillet'); return geometry ? [{ geometry, featureId: feature.id, position: [0, 0, (index - (entities.length - 1) / 2) * 8] }] : []; });
  }
  return entities.flatMap((entity): CadPreviewPart[] => { const geometry = extrudeFromEntity(entity, feature, feature.operation); return geometry ? [{ geometry, featureId: feature.id }] : []; });
}

export function buildCadPreviewParts(document: CadDocument) {
  return (document.features ?? []).filter((feature) => feature.visible).flatMap((feature) => buildFeatureParts(document, feature));
}

export function featureSupportsSelection(operation: CadModelOperation, entities: CadEntity[]) {
  if (operation === 'revolve' || operation === 'sweep') return entities.some((entity) => ['line', 'spline', 'arc'].includes(entity.type));
  return entities.some((entity) => Boolean(shapeFromEntity(entity)));
}

export function createOffsetFeatureSource(entity: CadEntity) {
  return offsetEntity(entity, 18);
}
