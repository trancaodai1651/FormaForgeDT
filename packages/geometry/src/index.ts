import type { GeometryConfig, MeshData, PrintabilityReport, ShapeDefinition, ValidationIssue } from '@hometown/types';

export type Point = { x: number; y: number };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function normalizeProfile(points: Point[]): Point[] {
  if (points.length < 3) throw new Error('A profile needs at least three points.');
  const unique = points.filter((point, index) => points.findIndex((item) => item.x === point.x && item.y === point.y) === index);
  if (unique.length < 3) throw new Error('A profile must contain three unique points.');
  const minX = Math.min(...unique.map((point) => point.x)); const maxX = Math.max(...unique.map((point) => point.x));
  const minY = Math.min(...unique.map((point) => point.y)); const maxY = Math.max(...unique.map((point) => point.y));
  const width = maxX - minX; const height = maxY - minY;
  if (width <= 0 || height <= 0) throw new Error('A profile must have measurable width and height.');
  return unique.map((point) => ({ x: (point.x - minX) / width, y: (point.y - minY) / height }));
}

export function generateProfile(shape: ShapeDefinition, segments = 48): Point[] {
  const width = shape.width; const height = shape.height;
  if (width <= 0 || height <= 0) throw new Error('Shape width and height must be positive.');
  switch (shape.type) {
    case 'cylinder': case 'modular':
      return Array.from({ length: segments }, (_, index) => { const angle = (index / segments) * Math.PI * 2; return { x: Math.cos(angle) * width / 2, y: Math.sin(angle) * height / 2 }; });
    case 'half-cylinder':
      return Array.from({ length: Math.floor(segments / 2) + 1 }, (_, index) => { const angle = (index / (segments / 2)) * Math.PI; return { x: Math.cos(angle) * width / 2, y: Math.sin(angle) * height / 2 }; });
    case 'tower': return [{ x: -width / 2, y: -height / 2 }, { x: width / 2, y: -height / 2 }, { x: width * .42, y: height / 2 }, { x: -width * .42, y: height / 2 }];
    case 'geometric': return Array.from({ length: 6 }, (_, index) => { const angle = (index / 6) * Math.PI * 2; return { x: Math.cos(angle) * width / 2, y: Math.sin(angle) * height / 2 }; });
    case 'landmark': case 'organic': case 'pattern': case 'multi-panel': case 'stackable':
      return [{ x: -width / 2, y: -height / 2 }, { x: width / 2, y: -height / 2 }, { x: width * .46, y: height * .1 }, { x: width * .2, y: height / 2 }, { x: -width * .22, y: height * .4 }, { x: -width / 2, y: height * .05 }];
  }
}

export function generateLampMesh(config: GeometryConfig): MeshData {
  const { shape, shell } = config; const profile = generateProfile(shape); const sides = profile.length;
  const vertices: number[] = []; const indices: number[] = []; const radiusX = shape.width / 2; const radiusZ = (shape.depth ?? shape.width) / 2;
  const minX = Math.min(...profile.map((point) => point.x)); const maxX = Math.max(...profile.map((point) => point.x));
  const minY = Math.min(...profile.map((point) => point.y)); const maxY = Math.max(...profile.map((point) => point.y));
  for (const y of [-shape.height / 2, shape.height / 2]) {
    for (let index = 0; index < sides; index += 1) {
      const point = profile[index]; const nx = (point.x - minX) / (maxX - minX || 1) * 2 - 1; const nz = (point.y - minY) / (maxY - minY || 1) * 2 - 1;
      const angle = (index / sides) * Math.PI * 2; const wave = config.pattern.type === 'wave' ? Math.sin(angle * 6 + y / 30) * config.pattern.strength * 5 : 0;
      vertices.push(nx * radiusX + wave, y, nz * radiusZ);
    }
  }
  for (let index = 0; index < sides; index += 1) { const next = (index + 1) % sides; indices.push(index, next, sides + index, next, sides + next, sides + index); }
  return { vertices, indices, metadata: { width: shape.width, height: shape.height, depth: shape.depth ?? shape.width, wallThickness: shell.wallThickness, shape: shape.type } };
}

export function validateGeometry(config: GeometryConfig, mesh = generateLampMesh(config)): PrintabilityReport {
  const issues: ValidationIssue[] = []; const profile = config.printProfile; const wall = config.shell.wallThickness; const opening = config.pattern.openingSize; const overhang = config.shape.type === 'tower' ? 58 : 42 + config.pattern.density * 20;
  issues.push({ level: wall >= profile.minimumWall ? 'safe' : 'error', label: 'Wall thickness', value: `${wall.toFixed(1)} mm`, detail: wall >= profile.minimumWall ? 'Within the selected FDM profile.' : 'Increase wall thickness before export.' });
  issues.push({ level: opening >= profile.minimumFeature ? 'safe' : 'warning', label: 'Minimum feature', value: `${opening.toFixed(2)} mm`, detail: opening >= profile.minimumFeature ? 'Openings are printable with the selected nozzle.' : 'Small openings may close during slicing.' });
  issues.push({ level: overhang <= profile.recommendedOverhang ? 'safe' : 'warning', label: 'Overhang', value: `${overhang.toFixed(0)}°`, detail: overhang <= profile.recommendedOverhang ? 'Support should not be necessary for the main shell.' : 'Support recommended for the steepest surfaces.' });
  const connectorOk = config.connector.diameter >= 40 && config.connector.clearance >= 0.2;
  issues.push({ level: connectorOk ? 'safe' : 'error', label: 'Core connector', value: connectorOk ? 'Bayonet compatible' : 'Review connector', detail: connectorOk ? 'Clearance is suitable for a removable modular interface.' : 'Connector diameter or clearance is too small.' });
  const overall = issues.some((issue) => issue.level === 'error') ? 'ERROR' : issues.some((issue) => issue.level === 'warning') ? 'WARNING' : 'SAFE';
  const volume = (mesh.metadata.width * mesh.metadata.depth * mesh.metadata.height) / 1000;
  return { overall, issues, estimatedPrintTime: `${Math.max(1, Math.round(volume / 80))}h ${Math.round(volume % 60)}m`, estimatedMaterialGrams: Math.round(volume * 0.18) };
}

export function exportSTL(mesh: MeshData, name = 'hometown-lamp'): string {
  const lines = [`solid ${name}`];
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const points = mesh.indices.slice(index, index + 3).map((vertexIndex) => mesh.vertices.slice(vertexIndex * 3, vertexIndex * 3 + 3));
    if (points.length < 3) continue; const normal = [0, 1, 0];
    lines.push(`facet normal ${normal.join(' ')}`, ' outer loop', ...points.map((point) => `  vertex ${point.join(' ')}`), ' endloop', 'endfacet');
  }
  lines.push(`endsolid ${name}`); return lines.join('\n');
}

export function exportGLB(mesh: MeshData): Uint8Array {
  const json = JSON.stringify({ asset: { version: '2.0', generator: 'Hometown Geometry Engine' }, meshes: [{ name: 'LampShade', extras: mesh.metadata }] });
  return new TextEncoder().encode(json);
}

export const supportedStages = ['normalize', 'clean', 'scale', 'offset', 'extrude', 'hollow', 'wall', 'pattern', 'ventilation', 'connector', 'validation', 'preview', 'export'] as const;
export function clampGeometryConfig(config: GeometryConfig): GeometryConfig {
  return { ...config, shell: { ...config.shell, wallThickness: clamp(config.shell.wallThickness, 0.8, 8) }, pattern: { ...config.pattern, density: clamp(config.pattern.density, 0, 1), openingSize: clamp(config.pattern.openingSize, 0.2, 30) } };
}
