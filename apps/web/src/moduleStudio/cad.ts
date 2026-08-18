import type { SketchPoint } from './model';

export const CAD_VIEW = { width: 1600, height: 1000, axisX: 800, originY: 780, profileWidth: 430, profileHeight: 590 } as const;

export type CadPoint = { x: number; y: number };
export type CadPrimitive = 'line' | 'arc' | 'spline' | 'rectangle' | 'circle' | 'ellipse' | 'polygon' | 'text';
export type CadTool = 'select' | CadPrimitive | 'offset' | 'move' | 'mirror' | 'pattern' | 'project' | 'trim' | 'delete';
export type CadConstraint = 'parallel' | 'perpendicular' | 'tangent' | 'coincident' | 'midpoint' | 'concentric' | 'horizontalVertical' | 'equal' | 'symmetry' | 'lock' | 'construction';

export type CadEntity = {
  id: string;
  type: CadPrimitive;
  name: string;
  points: CadPoint[];
  visible: boolean;
  construction: boolean;
  locked: boolean;
  constraints: CadConstraint[];
  text?: string;
  sides?: number;
};

export type CadDocument = { entities: CadEntity[]; profileEntityId: string | null };

const CAD_PRIMITIVES: CadPrimitive[] = ['line', 'arc', 'spline', 'rectangle', 'circle', 'ellipse', 'polygon', 'text'];
const CAD_CONSTRAINTS: CadConstraint[] = ['parallel', 'perpendicular', 'tangent', 'coincident', 'midpoint', 'concentric', 'horizontalVertical', 'equal', 'symmetry', 'lock', 'construction'];

export function sanitizeCadDocument(input: unknown): CadDocument | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const candidate = input as Partial<CadDocument>;
  if (!Array.isArray(candidate.entities)) return undefined;
  const entities = candidate.entities.slice(0, 500).flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const entity = value as Partial<CadEntity>; const type = entity.type;
    if (!type || !CAD_PRIMITIVES.includes(type) || !Array.isArray(entity.points)) return [];
    const points = entity.points.slice(0, 1000).flatMap((point) => point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)) ? [{ x: Number(point.x), y: Number(point.y) }] : []);
    if (!points.length) return [];
    const constraints = Array.isArray(entity.constraints) ? entity.constraints.filter((constraint): constraint is CadConstraint => CAD_CONSTRAINTS.includes(constraint as CadConstraint)) : [];
    return [{ id: String(entity.id || cadId()), type, name: String(entity.name || type), points, visible: entity.visible !== false, construction: entity.construction === true, locked: entity.locked === true, constraints, text: typeof entity.text === 'string' ? entity.text.slice(0, 200) : undefined, sides: Math.max(3, Math.min(24, Math.round(Number(entity.sides) || 6))) } satisfies CadEntity];
  });
  if (!entities.length) return undefined;
  const profileEntityId = entities.some((entity) => entity.id === candidate.profileEntityId && ['line', 'spline'].includes(entity.type)) ? candidate.profileEntityId! : entities.find((entity) => ['line', 'spline'].includes(entity.type))?.id ?? null;
  return { entities, profileEntityId };
}

let cadSequence = 0;
export const cadId = () => `cad-${Date.now()}-${++cadSequence}`;

export function profileEntityFromSketch(points: SketchPoint[]): CadEntity {
  return {
    id: cadId(), type: 'spline', name: 'Shade revolve profile', visible: true, construction: false, locked: false, constraints: ['coincident'],
    points: points.map((point) => ({ x: CAD_VIEW.axisX + point.radius * CAD_VIEW.profileWidth, y: CAD_VIEW.originY - point.height * CAD_VIEW.profileHeight })),
  };
}

export function entityToProfile(entity: CadEntity | undefined, fallback: SketchPoint[]): SketchPoint[] {
  if (!entity || (entity.type !== 'spline' && entity.type !== 'line')) return fallback;
  const source = entity.points.filter((point) => point.x >= CAD_VIEW.axisX - 2).sort((a, b) => b.y - a.y);
  if (source.length < 2) return fallback;
  const minY = Math.min(...source.map((point) => point.y));
  const maxY = Math.max(...source.map((point) => point.y));
  const spanY = Math.max(1, maxY - minY);
  return source.map((point) => ({
    radius: Math.max(.3, Math.min(1, (point.x - CAD_VIEW.axisX) / CAD_VIEW.profileWidth)),
    height: Math.max(0, Math.min(1, (maxY - point.y) / spanY)),
  }));
}

export function primitiveClickCount(tool: CadPrimitive) {
  if (tool === 'arc' || tool === 'ellipse') return 3;
  if (tool === 'spline') return Infinity;
  if (tool === 'text') return 1;
  return 2;
}

export function createCadEntity(type: CadPrimitive, points: CadPoint[], options: { sides?: number; text?: string } = {}): CadEntity {
  const labels: Record<CadPrimitive, string> = { line: 'Line', arc: 'Arc', spline: 'Spline', rectangle: 'Rectangle', circle: 'Circle', ellipse: 'Ellipse', polygon: 'Polygon', text: 'Text' };
  return {
    id: cadId(), type, name: `${labels[type]} ${cadSequence}`, points: points.map((point) => ({ ...point })), visible: true,
    construction: false, locked: false, constraints: [], sides: options.sides ?? 6, text: options.text ?? 'TEXT',
  };
}

export function smoothCadPath(points: CadPoint[]) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index]; const next = points[index + 1];
    path += ` Q ${current.x} ${current.y} ${(current.x + next.x) / 2} ${(current.y + next.y) / 2}`;
  }
  const beforeLast = points.at(-2)!; const last = points.at(-1)!;
  return `${path} Q ${beforeLast.x} ${beforeLast.y} ${last.x} ${last.y}`;
}

export function arcPath(points: CadPoint[]) {
  if (points.length < 3) return smoothCadPath(points);
  const [center, start, end] = points;
  const radius = Math.max(1, Math.hypot(start.x - center.x, start.y - center.y));
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
  let delta = endAngle - startAngle; if (delta < 0) delta += Math.PI * 2;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${delta > Math.PI ? 1 : 0} 1 ${end.x} ${end.y}`;
}

export function polygonPoints(entity: CadEntity) {
  const [center, edge = { x: center.x + 30, y: center.y }] = entity.points;
  const radius = Math.max(1, Math.hypot(edge.x - center.x, edge.y - center.y));
  const start = Math.atan2(edge.y - center.y, edge.x - center.x);
  return Array.from({ length: Math.max(3, entity.sides ?? 6) }, (_, index) => {
    const angle = start + index / Math.max(3, entity.sides ?? 6) * Math.PI * 2;
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
  });
}

function lerpPoint(a: CadPoint, b: CadPoint, t: number): CadPoint { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

export function sampleEntity(entity: CadEntity, count = 40): CadPoint[] {
  const [a, b = a, c = b] = entity.points;
  if (!a) return [];
  if (entity.type === 'line' || entity.type === 'spline') {
    const result: CadPoint[] = [];
    for (let segment = 0; segment < entity.points.length - 1; segment += 1) for (let index = 0; index <= count / Math.max(1, entity.points.length - 1); index += 1) result.push(lerpPoint(entity.points[segment], entity.points[segment + 1], index / Math.max(1, count / Math.max(1, entity.points.length - 1))));
    return result;
  }
  if (entity.type === 'rectangle') return [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }, a];
  if (entity.type === 'polygon') { const points = polygonPoints(entity); return [...points, points[0]]; }
  if (entity.type === 'circle' || entity.type === 'ellipse' || entity.type === 'arc') {
    const radiusX = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    const radiusY = entity.type === 'ellipse' ? Math.max(1, Math.hypot(c.x - a.x, c.y - a.y)) : radiusX;
    const start = entity.type === 'arc' ? Math.atan2(b.y - a.y, b.x - a.x) : 0;
    let end = entity.type === 'arc' ? Math.atan2(c.y - a.y, c.x - a.x) : Math.PI * 2;
    if (end < start) end += Math.PI * 2;
    return Array.from({ length: count + 1 }, (_, index) => { const angle = start + (end - start) * index / count; return { x: a.x + Math.cos(angle) * radiusX, y: a.y + Math.sin(angle) * radiusY }; });
  }
  return [a];
}

export function nearestEntity(entities: CadEntity[], point: CadPoint, threshold = 24) {
  let match: CadEntity | undefined; let best = Infinity;
  for (const entity of entities.filter((item) => item.visible)) for (const sample of sampleEntity(entity)) {
    const distance = Math.hypot(sample.x - point.x, sample.y - point.y);
    if (distance < best) { best = distance; match = entity; }
  }
  return best <= threshold ? match : undefined;
}

export function translateEntity(entity: CadEntity, dx: number, dy: number): CadEntity {
  if (entity.locked) return entity;
  return { ...entity, points: entity.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
}

export function offsetEntity(entity: CadEntity, amount = 18): CadEntity {
  const result = cloneEntity(entity, { name: `${entity.name} offset`, locked: false });
  if (result.points.length < 2) return translateEntity(result, amount, -amount);
  const [center, edge] = result.points;
  if (['circle', 'ellipse', 'arc', 'polygon'].includes(result.type)) {
    return { ...result, points: result.points.map((point, index) => {
      if (index === 0) return point;
      const dx = point.x - center.x; const dy = point.y - center.y; const length = Math.max(.001, Math.hypot(dx, dy));
      return { x: center.x + dx / length * (length + amount), y: center.y + dy / length * (length + amount) };
    }) };
  }
  if (result.type === 'rectangle') {
    const signX = Math.sign(edge.x - center.x) || 1; const signY = Math.sign(edge.y - center.y) || 1;
    return { ...result, points: [{ x: center.x - signX * amount, y: center.y - signY * amount }, { x: edge.x + signX * amount, y: edge.y + signY * amount }] };
  }
  const first = result.points[0]; const last = result.points.at(-1)!; const dx = last.x - first.x; const dy = last.y - first.y; const length = Math.max(.001, Math.hypot(dx, dy));
  return translateEntity(result, -dy / length * amount, dx / length * amount);
}

export function trimEntityAtPoint(entity: CadEntity, point: CadPoint): CadEntity | null {
  if (entity.locked || entity.points.length < 2) return entity;
  const next = { ...entity, points: entity.points.map((candidate) => ({ ...candidate })) };
  if (entity.type === 'line') {
    const firstDistance = Math.hypot(point.x - next.points[0].x, point.y - next.points[0].y); const lastIndex = next.points.length - 1;
    const lastDistance = Math.hypot(point.x - next.points[lastIndex].x, point.y - next.points[lastIndex].y);
    next.points[firstDistance <= lastDistance ? 0 : lastIndex] = { ...point }; return next;
  }
  if (entity.type === 'spline') {
    if (next.points.length <= 2) return trimEntityAtPoint({ ...next, type: 'line' }, point);
    const nearestIndex = next.points.reduce((best, candidate, index) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < Math.hypot(next.points[best].x - point.x, next.points[best].y - point.y) ? index : best, 0);
    next.points.splice(nearestIndex, 1); return next;
  }
  if (entity.type === 'circle' || entity.type === 'arc') {
    const center = next.points[0]; const radius = Math.max(1, Math.hypot(next.points[1].x - center.x, next.points[1].y - center.y)); const angle = Math.atan2(point.y - center.y, point.x - center.x); const gap = Math.PI / 9;
    return { ...next, type: 'arc', points: [center, { x: center.x + Math.cos(angle + gap) * radius, y: center.y + Math.sin(angle + gap) * radius }, { x: center.x + Math.cos(angle - gap) * radius, y: center.y + Math.sin(angle - gap) * radius }] };
  }
  return null;
}

export function rotateEntity(entity: CadEntity, degrees: number): CadEntity {
  if (entity.locked || !entity.points.length) return entity;
  const center = entity.points.reduce((result, point) => ({ x: result.x + point.x / entity.points.length, y: result.y + point.y / entity.points.length }), { x: 0, y: 0 });
  const angle = degrees * Math.PI / 180;
  return { ...entity, points: entity.points.map((point) => ({ x: center.x + Math.cos(angle) * (point.x - center.x) - Math.sin(angle) * (point.y - center.y), y: center.y + Math.sin(angle) * (point.x - center.x) + Math.cos(angle) * (point.y - center.y) })) };
}

export function cloneEntity(entity: CadEntity, patch: Partial<CadEntity> = {}): CadEntity {
  return { ...entity, id: cadId(), name: `${entity.name} copy`, points: entity.points.map((point) => ({ ...point })), constraints: [...entity.constraints], ...patch };
}

const addConstraint = (entity: CadEntity, constraint: CadConstraint) => ({ ...entity, constraints: entity.constraints.includes(constraint) ? entity.constraints : [...entity.constraints, constraint] });

function reflectPoint(point: CadPoint, axisStart: CadPoint, axisEnd: CadPoint): CadPoint {
  const dx = axisEnd.x - axisStart.x; const dy = axisEnd.y - axisStart.y;
  const lengthSquared = Math.max(.0001, dx * dx + dy * dy);
  const projection = ((point.x - axisStart.x) * dx + (point.y - axisStart.y) * dy) / lengthSquared;
  const projected = { x: axisStart.x + projection * dx, y: axisStart.y + projection * dy };
  return { x: projected.x * 2 - point.x, y: projected.y * 2 - point.y };
}

function closestEndpointPair(first: CadEntity, second: CadEntity) {
  const firstIndexes = [0, Math.max(0, first.points.length - 1)];
  const secondIndexes = [0, Math.max(0, second.points.length - 1)];
  let result = { firstIndex: 0, secondIndex: 0, distance: Infinity };
  for (const firstIndex of firstIndexes) for (const secondIndex of secondIndexes) {
    const a = first.points[firstIndex]; const b = second.points[secondIndex];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (distance < result.distance) result = { firstIndex, secondIndex, distance };
  }
  return result;
}

export function constrainEntities(entities: CadEntity[], selectedIds: string[], constraint: CadConstraint): CadEntity[] {
  const selected = entities.filter((entity) => selectedIds.includes(entity.id));
  if (!selected.length) return entities;
  if (constraint === 'construction') return entities.map((entity) => selectedIds.includes(entity.id) ? { ...entity, construction: !entity.construction, constraints: entity.constraints.includes('construction') ? entity.constraints.filter((item) => item !== 'construction') : [...entity.constraints, 'construction'] } : entity);
  if (constraint === 'lock') return entities.map((entity) => selectedIds.includes(entity.id) ? { ...entity, locked: !entity.locked, constraints: entity.constraints.includes('lock') ? entity.constraints.filter((item) => item !== 'lock') : [...entity.constraints, 'lock'] } : entity);

  const reference = selected[0];
  const symmetryAxis = constraint === 'symmetry' ? [...selected].reverse().find((entity) => entity.type === 'line' && entity.points.length >= 2) : undefined;
  return entities.map((entity) => {
    if (!selectedIds.includes(entity.id)) return entity;
    let next = addConstraint(entity, constraint);
    if (constraint === 'horizontalVertical' && next.type === 'line' && next.points.length >= 2) {
      const [start, end] = next.points; next = { ...next, points: Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? [start, { ...end, y: start.y }] : [start, { ...end, x: start.x }] };
    }
    if ((constraint === 'parallel' || constraint === 'perpendicular') && reference.type === 'line' && next.type === 'line' && next.id !== reference.id) {
      const [refA, refB] = reference.points; const [start, end] = next.points; const length = Math.hypot(end.x - start.x, end.y - start.y); const refAngle = Math.atan2(refB.y - refA.y, refB.x - refA.x) + (constraint === 'perpendicular' ? Math.PI / 2 : 0);
      next = { ...next, points: [start, { x: start.x + Math.cos(refAngle) * length, y: start.y + Math.sin(refAngle) * length }] };
    }
    if (constraint === 'coincident' && reference.points.length && next.points.length && next.id !== reference.id) {
      const pair = closestEndpointPair(reference, next);
      next = { ...next, points: next.points.map((point, index) => index === pair.secondIndex ? { ...reference.points[pair.firstIndex] } : point) };
    }
    if (constraint === 'midpoint' && reference.points.length >= 2 && next.points.length && next.id !== reference.id) {
      const first = reference.points[0]; const last = reference.points.at(-1)!;
      const midpoint = { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 };
      const endpoint = Math.hypot(next.points[0].x - midpoint.x, next.points[0].y - midpoint.y) <= Math.hypot(next.points.at(-1)!.x - midpoint.x, next.points.at(-1)!.y - midpoint.y) ? 0 : next.points.length - 1;
      next = { ...next, points: next.points.map((point, index) => index === endpoint ? midpoint : point) };
    }
    if (constraint === 'concentric' && ['circle', 'ellipse', 'arc'].includes(reference.type) && ['circle', 'ellipse', 'arc'].includes(next.type) && next.id !== reference.id) next = { ...next, points: [{ ...reference.points[0] }, ...next.points.slice(1)] };
    if (constraint === 'equal' && next.id !== reference.id && reference.points.length >= 2 && next.points.length >= 2) {
      const refLength = Math.hypot(reference.points[1].x - reference.points[0].x, reference.points[1].y - reference.points[0].y); const [start, end] = next.points; const angle = Math.atan2(end.y - start.y, end.x - start.x);
      next = { ...next, points: [start, { x: start.x + Math.cos(angle) * refLength, y: start.y + Math.sin(angle) * refLength }, ...next.points.slice(2)] };
    }
    if (constraint === 'tangent' && next.id !== reference.id) {
      const circle = ['circle', 'arc'].includes(reference.type) ? reference : ['circle', 'arc'].includes(next.type) ? next : undefined;
      const line = reference.type === 'line' ? reference : next.type === 'line' ? next : undefined;
      if (circle && line && circle.points.length >= 2 && line.points.length >= 2 && next.id === line.id) {
        const center = circle.points[0]; const radius = Math.hypot(circle.points[1].x - center.x, circle.points[1].y - center.y);
        const endpointIndex = Math.hypot(line.points[0].x - center.x, line.points[0].y - center.y) <= Math.hypot(line.points[1].x - center.x, line.points[1].y - center.y) ? 0 : 1;
        const source = line.points[endpointIndex]; const radialAngle = Math.atan2(source.y - center.y, source.x - center.x);
        const tangentPoint = { x: center.x + Math.cos(radialAngle) * radius, y: center.y + Math.sin(radialAngle) * radius };
        const otherIndex = endpointIndex === 0 ? 1 : 0; const length = Math.hypot(line.points[otherIndex].x - source.x, line.points[otherIndex].y - source.y);
        const direction = radialAngle + Math.PI / 2;
        const points = line.points.map((point) => ({ ...point })); points[endpointIndex] = tangentPoint; points[otherIndex] = { x: tangentPoint.x + Math.cos(direction) * length, y: tangentPoint.y + Math.sin(direction) * length };
        next = { ...next, points };
      }
    }
    if (constraint === 'symmetry' && symmetryAxis && selected.length >= 3 && next.id === selected[1].id && selected[0].id !== symmetryAxis.id) {
      next = { ...next, points: selected[0].points.map((point) => reflectPoint(point, symmetryAxis.points[0], symmetryAxis.points[1])) };
    }
    return next;
  });
}
