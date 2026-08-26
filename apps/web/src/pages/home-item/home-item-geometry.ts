import * as THREE from 'three';

export type HomeItemShape = 'cylinder' | 'square' | 'oval';
export type HomeItemProfile = 'linear' | 'bulged';
export type PatternDirection = 'horizontal' | 'vertical' | 'both';
export type DistributionPattern = 'grid' | 'staggered';
export type MaskMode = 'hard' | 'soft' | 'blend';
export type HomeItemQuality = 'low' | 'medium' | 'high' | 'ultra';

export type HomeItemConfig = {
  shape: HomeItemShape;
  width: number;
  length: number;
  height: number;
  wallThickness: number;
  baseThickness: number;
  cornerRadius: number;
  profile: HomeItemProfile;
  topTaper: number;
  color: string;
  quality: HomeItemQuality;
  maskEnabled: boolean;
  maskInverted: boolean;
  maskDepth: number;
  maskMode: MaskMode;
  lines: {
    enabled: boolean;
    direction: PatternDirection;
    period: number;
    width: number;
    depth: number;
    angle: number;
    edgeHardness: number;
    bevel: number;
  };
  spheres: {
    enabled: boolean;
    distribution: DistributionPattern;
    diameter: number;
    depth: number;
    horizontalSpacing: number;
    verticalSpacing: number;
  };
  waves: {
    enabled: boolean;
    ringSpacing: number;
    relief: number;
    roundness: number;
    variation: number;
  };
  diamonds: {
    enabled: boolean;
    horizontalSpacing: number;
    verticalSpacing: number;
    lineThickness: number;
    depth: number;
    edgeHardness: number;
  };
  dots: {
    enabled: boolean;
    width: number;
    height: number;
    threadThickness: number;
    depth: number;
    rotation: number;
  };
};

export const HOME_ITEM_QUALITY: Record<HomeItemQuality, { segments: number; verticalLayers: number }> = {
  low: { segments: 48, verticalLayers: 48 },
  medium: { segments: 72, verticalLayers: 72 },
  high: { segments: 104, verticalLayers: 104 },
  ultra: { segments: 160, verticalLayers: 160 },
};

export const DEFAULT_HOME_ITEM_CONFIG: HomeItemConfig = {
  shape: 'square',
  width: 100,
  length: 100,
  height: 127,
  wallThickness: 2,
  baseThickness: 2,
  cornerRadius: 25,
  profile: 'linear',
  topTaper: 0,
  color: '#c9c2e8',
  quality: 'high',
  maskEnabled: false,
  maskInverted: false,
  maskDepth: 10,
  maskMode: 'blend',
  lines: { enabled: false, direction: 'both', period: 7.5, width: 5, depth: 2, angle: 0, edgeHardness: 0.5, bevel: 1 },
  spheres: { enabled: true, distribution: 'grid', diameter: 13.5, depth: 1.5, horizontalSpacing: 12, verticalSpacing: 12 },
  waves: { enabled: false, ringSpacing: 9, relief: 2.4, roundness: 0.35, variation: 140 },
  diamonds: { enabled: false, horizontalSpacing: 10, verticalSpacing: 14, lineThickness: 2, depth: 1.2, edgeHardness: 0.5 },
  dots: { enabled: false, width: 20, height: 5, threadThickness: 1, depth: 0.5, rotation: 0 },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

function periodicDistance(value: number, period: number) {
  const wrapped = ((value + period / 2) % period + period) % period - period / 2;
  return Math.abs(wrapped);
}

function roundedShapeRadius(config: HomeItemConfig, angle: number) {
  const halfWidth = Math.max(1, config.width / 2);
  const halfLength = Math.max(1, config.length / 2);
  if (config.shape !== 'square') {
    return 1 / Math.sqrt((Math.cos(angle) / halfWidth) ** 2 + (Math.sin(angle) / halfLength) ** 2);
  }
  const normalizedCorner = clamp(config.cornerRadius / Math.min(halfWidth, halfLength), 0, 1);
  const exponent = 4 + normalizedCorner * 5;
  return 1 / ((Math.abs(Math.cos(angle)) / halfWidth) ** exponent + (Math.abs(Math.sin(angle)) / halfLength) ** exponent) ** (1 / exponent);
}

function profileScale(config: HomeItemConfig, normalizedHeight: number) {
  const t = clamp(normalizedHeight, 0, 1);
  const taper = clamp(config.topTaper / 100, -0.35, 0.35);
  const tapered = 1 - taper * t;
  if (config.profile === 'bulged') {
    return tapered * (1 + 0.16 * Math.sin(Math.PI * t));
  }
  return tapered;
}

function maskFactor(config: HomeItemConfig, angle: number) {
  if (!config.maskEnabled) return 1;
  const facingViewer = Math.cos(angle) > 0;
  const selected = config.maskInverted ? !facingViewer : facingViewer;
  if (!selected) return 1;
  if (config.maskMode === 'hard') return 0;
  if (config.maskMode === 'soft') return 0.38;
  return 1 - smoothstep(0, 40, config.maskDepth) * 0.8;
}

function patternRelief(config: HomeItemConfig, angle: number, y: number, radius: number) {
  let relief = 0;
  const circumference = Math.max(1, Math.PI * 2 * radius);
  const t = y / Math.max(1, config.height);

  if (config.lines.enabled) {
    const direction = config.lines.direction;
    const rotated = angle + THREE.MathUtils.degToRad(config.lines.angle);
    const lineDistance = periodicDistance(Math.sin(rotated) * circumference, Math.max(1, config.lines.period));
    const lineBand = 1 - smoothstep(config.lines.width * 0.35, config.lines.width, lineDistance);
    const horizontalBand = 1 - smoothstep(config.lines.width * 0.35, config.lines.width, periodicDistance(y, Math.max(2, config.lines.period)));
    const contribution = direction === 'horizontal' ? horizontalBand : direction === 'vertical' ? lineBand : Math.max(lineBand, horizontalBand);
    relief += contribution * config.lines.depth;
  }

  if (config.spheres.enabled) {
    const rowSpacing = Math.max(2, config.spheres.verticalSpacing);
    const columnSpacing = Math.max(2, config.spheres.horizontalSpacing);
    const rowIndex = Math.round(y / rowSpacing);
    const rowY = rowIndex * rowSpacing;
    const rowOffset = config.spheres.distribution === 'staggered' && rowIndex % 2 ? columnSpacing / 2 : 0;
    const horizontalDistance = periodicDistance(((angle * circumference) - rowOffset), columnSpacing);
    const verticalDistance = Math.abs(y - rowY);
    const halfDiameter = Math.max(0.8, config.spheres.diameter / 2);
    const distance = Math.sqrt(horizontalDistance ** 2 + verticalDistance ** 2);
    relief += Math.max(0, 1 - distance / halfDiameter) ** 2 * config.spheres.depth;
  }

  if (config.waves.enabled) {
    const wavePeriod = Math.max(2, config.waves.ringSpacing);
    const ring = Math.sin((y / wavePeriod) * Math.PI * 2);
    const organic = 1 + Math.sin(angle * 5.3 + t * 19) * clamp(config.waves.variation / 600, 0, 1) * 0.25;
    relief += Math.max(0, ring) * config.waves.relief * organic;
  }

  if (config.diamonds.enabled) {
    const xPeriod = Math.max(2, config.diamonds.horizontalSpacing);
    const yPeriod = Math.max(2, config.diamonds.verticalSpacing);
    const diagonalA = periodicDistance(angle * circumference + y, xPeriod);
    const diagonalB = periodicDistance(angle * circumference - y, xPeriod);
    const diamondDistance = Math.min(diagonalA, diagonalB);
    const rowDistance = periodicDistance(y, yPeriod);
    const line = Math.max(
      1 - smoothstep(config.diamonds.lineThickness * 0.3, config.diamonds.lineThickness, diamondDistance),
      1 - smoothstep(config.diamonds.lineThickness * 0.3, config.diamonds.lineThickness, rowDistance),
    );
    relief += line * config.diamonds.depth;
  }

  if (config.dots.enabled) {
    const spacing = Math.max(3, config.dots.width + config.dots.threadThickness * 2);
    const dotDistance = Math.sqrt(periodicDistance(angle * circumference, spacing) ** 2 + periodicDistance(y, Math.max(3, config.dots.height + 3)) ** 2);
    relief += Math.max(0, 1 - dotDistance / Math.max(1, config.dots.width / 2)) ** 2 * config.dots.depth;
  }

  return relief * maskFactor(config, angle);
}

function pushVertex(vertices: number[], x: number, y: number, z: number) {
  vertices.push(x, y, z);
  return vertices.length / 3 - 1;
}

export function createHomeItemGeometry(config: HomeItemConfig, quality: HomeItemQuality = config.quality) {
  const { segments, verticalLayers } = HOME_ITEM_QUALITY[quality];
  const vertices: number[] = [];
  const indices: number[] = [];
  const outerRings: number[][] = [];
  const innerRings: number[][] = [];
  const innerWidth = Math.max(2, config.width - config.wallThickness * 2);
  const innerLength = Math.max(2, config.length - config.wallThickness * 2);
  const innerConfig = { ...config, width: innerWidth, length: innerLength, shape: config.shape === 'square' ? 'square' as const : config.shape };

  for (let layer = 0; layer <= verticalLayers; layer += 1) {
    const t = layer / verticalLayers;
    const y = t * config.height;
    const outerRing: number[] = [];
    const innerRing: number[] = [];
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = segment / segments * Math.PI * 2;
      const nominalRadius = roundedShapeRadius(config, angle) * profileScale(config, t);
      const outerRadius = nominalRadius + patternRelief(config, angle, y, nominalRadius);
      outerRing.push(pushVertex(vertices, outerRadius * Math.cos(angle), y, outerRadius * Math.sin(angle)));
      const innerRadius = Math.max(0.5, roundedShapeRadius(innerConfig, angle) * profileScale(config, t));
      const innerY = config.baseThickness + t * Math.max(0, config.height - config.baseThickness);
      innerRing.push(pushVertex(vertices, innerRadius * Math.cos(angle), innerY, innerRadius * Math.sin(angle)));
    }
    outerRings.push(outerRing);
    innerRings.push(innerRing);
  }

  const connectRings = (from: number[], to: number[], reverse = false) => {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = from[segment];
      const b = from[segment + 1];
      const c = to[segment + 1];
      const d = to[segment];
      if (reverse) indices.push(a, c, b, a, d, c);
      else indices.push(a, b, c, a, c, d);
    }
  };

  for (let layer = 0; layer < verticalLayers; layer += 1) {
    connectRings(outerRings[layer], outerRings[layer + 1]);
    connectRings(innerRings[layer], innerRings[layer + 1], true);
  }
  connectRings(outerRings[verticalLayers], innerRings[verticalLayers]);
  connectRings(innerRings[0], outerRings[0], true);

  const outerBottomCenter = pushVertex(vertices, 0, 0, 0);
  const innerBottomCenter = pushVertex(vertices, 0, config.baseThickness, 0);
  for (let segment = 0; segment < segments; segment += 1) {
    indices.push(outerBottomCenter, outerRings[0][segment + 1], outerRings[0][segment]);
    indices.push(innerBottomCenter, innerRings[0][segment], innerRings[0][segment + 1]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function getHomeItemStats(geometry: THREE.BufferGeometry) {
  return {
    vertices: geometry.getAttribute('position')?.count ?? 0,
    polygons: geometry.index ? Math.floor(geometry.index.count / 3) : Math.floor((geometry.getAttribute('position')?.count ?? 0) / 3),
  };
}

export function getHomeItemDimensions(config: HomeItemConfig) {
  const relief = Math.max(config.lines.depth, config.spheres.depth, config.waves.relief, config.diamonds.depth, config.dots.depth);
  return { width: config.width + relief * 2, length: config.length + relief * 2, height: config.height };
}
