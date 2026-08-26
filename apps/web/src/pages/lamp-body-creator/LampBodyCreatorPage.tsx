import { ArrowRight, Box, Check, Circle, Download, Flower2, Hexagon, Info, Layers3, Lightbulb, Rotate3D, Settings2, SlidersHorizontal, Sparkles, Waves } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { Environment, Grid, Lightformer, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { useI18n, type Language } from '../../lib/i18n';
import { createLogoReliefGroup, LampLogoDecal, LogoControls, type LogoConfig, type LogoCopy } from '../lamp-logo';
import './lamp-body-creator.css';

export type BodyProfile = 'cylinder' | 'taper' | 'hourglass' | 'pedestal' | 'lampshade';
export type BodyProfileMode = 'preset' | 'advanced';
export type BodyProfilePointType = 'corner' | 'smooth';
export type BodyProfilePoint = {
  x: number;
  y: number;
  type?: BodyProfilePointType;
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
};
export type BodyShape = 'circle' | 'polygon' | 'wave' | 'star';
type RenderStyle = 'smooth' | 'low-poly';
export type BodyTab = 'body' | 'profile' | 'shape' | 'base' | 'finish' | 'export';

export type LampBodyConfig = {
  profile: BodyProfile;
  profileMode: BodyProfileMode;
  advancedProfilePoints: BodyProfilePoint[];
  advancedMaxRadius: number;
  shapeType: BodyShape;
  shapeWaves: number;
  shapeAmplitude: number;
  shapeTwist: number;
  height: number;
  bodyRadius: number;
  topRadius: number;
  baseRadius: number;
  baseHeight: number;
  neckRadius: number;
  neckHeight: number;
  shadeSeatRadius: number;
  shadeSeatHeight: number;
  wallThickness: number;
  socketDiameter: number;
  bottomHoleEnabled: boolean;
  bottomHoleDiameter: number;
  segments: number;
  renderStyle: RenderStyle;
  showSimulation: boolean;
  color: string;
  logo: LogoConfig | null;
};

export const DEFAULT_LAMP_BODY_CONFIG: LampBodyConfig = {
  profile: 'taper',
  profileMode: 'advanced',
  advancedProfilePoints: [
    { x: .9, y: 0, type: 'corner' },
    { x: .4, y: 1, type: 'corner' },
  ],
  advancedMaxRadius: 90,
  shapeType: 'circle',
  shapeWaves: 8,
  shapeAmplitude: 2,
  shapeTwist: 0,
  height: 190,
  bodyRadius: 48,
  topRadius: 34,
  baseRadius: 58,
  baseHeight: 22,
  neckRadius: 25,
  neckHeight: 16,
  shadeSeatRadius: 34,
  shadeSeatHeight: 8,
  wallThickness: 3.2,
  socketDiameter: 42,
  bottomHoleEnabled: true,
  bottomHoleDiameter: 42,
  segments: 64,
  renderStyle: 'smooth',
  showSimulation: true,
  color: '#ef3340',
  logo: null,
};

const COLORS = ['#d9d6cf', '#e7e7e7', '#1b1b1b', '#d23b3b', '#2f6fdd', '#2e9e5b', '#f2b705'];

export const BODY_PROFILE_PRESETS: Array<{ name: BodyProfile; points: BodyProfilePoint[] }> = [
  { name: 'cylinder', points: [{ x: .78, y: 0, type: 'corner' }, { x: .78, y: 1, type: 'corner' }] },
  { name: 'taper', points: [{ x: .9, y: 0, type: 'corner' }, { x: .4, y: 1, type: 'corner' }] },
  { name: 'lampshade', points: [{ x: .78, y: 0, type: 'corner' }, { x: .9, y: .28, type: 'smooth', handleIn: { x: .9, y: .18 }, handleOut: { x: .88, y: .4 } }, { x: .72, y: .62, type: 'smooth', handleIn: { x: .76, y: .5 }, handleOut: { x: .68, y: .75 } }, { x: .38, y: 1, type: 'corner' }] },
  { name: 'hourglass', points: [{ x: .82, y: 0, type: 'corner' }, { x: .48, y: .5, type: 'corner' }, { x: .42, y: 1, type: 'corner' }] },
  { name: 'pedestal', points: [{ x: .58, y: 0, type: 'corner' }, { x: .9, y: .2, type: 'smooth', handleIn: { x: .9, y: .1 }, handleOut: { x: .86, y: .34 } }, { x: .72, y: .6, type: 'smooth', handleIn: { x: .76, y: .48 }, handleOut: { x: .66, y: .76 } }, { x: .4, y: 1, type: 'corner' }] },
];

const COPY = {
  en: {
    title: 'Lamp Body Creator', subtitle: 'Parametric Lamp Stand Generator', workspace: 'BODY WORKSPACE', preview: 'Live 3D preview', realtime: 'Realtime geometry',
    tabs: { body: 'Body', profile: 'Draw profile', shape: 'Shape', base: 'Base & Mount', finish: 'Finish', export: 'Export' },
    addPoint: 'Add point',
    bodyShape: 'Body profile', bodyShapeHint: 'Choose a starting silhouette for the printed stand.', profileMode: 'Profile mode', preset: 'Preset', advanced: 'Advanced profile', advancedHint: 'Edit the same vertical Bezier profile used by the lampshade.', vertical: 'Vertical profile', dragHint: 'Drag points and handles • Double-click a point to toggle Curve/Sharp • Double-click anywhere on the grid to add a point', profilePreset: 'Profile presets', maxRadius: 'Maximum radius', profileLabels: { cylinder: 'Cylinder', taper: 'Taper', hourglass: 'Hourglass', pedestal: 'Pedestal', lampshade: 'Lampshade' }, lampshade: 'Lampshade', lowerRadius: 'Lower radius', shoulderRadius: 'Shoulder radius', waistRadius: 'Waist radius', upperRadius: 'Upper radius', profileCurve: 'Curve tension', profileFlare: 'Shade flare',
    shapeSettings: 'Shape settings', shapes: { circle: 'Circle', polygon: 'Polygon', wave: 'Wave', star: 'Star' }, count: 'Count', depth: 'Depth', twist: 'Twist',
    profiles: { cylinder: 'Cylinder', taper: 'Taper', hourglass: 'Hourglass', pedestal: 'Pedestal', lampshade: 'Lampshade' },
    dimensions: 'Body dimensions', height: 'Height', bodyRadius: 'Body radius', topRadius: 'Top radius',
    base: 'Base and mounting', baseRadius: 'Base radius', baseHeight: 'Base height', neckRadius: 'Neck radius', neckHeight: 'Neck height', shadeSeatRadius: 'Flat joining radius', shadeSeatHeight: 'Flat joining height', bottomHole: 'Bottom cable & socket opening', bottomHoleHint: 'A real through-hole is cut into the base for the cable and lamp socket.', bottomHoleDiameter: 'Opening diameter', holeEnabled: 'Bottom opening', holeOn: 'Open', holeOff: 'Closed',
    socket: 'Socket opening', socketDiameter: 'Socket diameter', socketHint: 'The opening is sized for a replaceable E27/E14 insert.',
    construction: 'Print construction', wall: 'Wall thickness', segments: 'Radial resolution', resolutionHint: 'Higher resolution creates a smoother round body.',
    appearance: 'Appearance', style: 'Render style', smooth: 'Smooth', lowPoly: 'Low poly', color: 'Body color', simulation: 'Lamp simulation',
    simulationHint: 'Show a socket, bulb and warm light above the body.', on: 'On', off: 'Off',
    logo: 'Logo on body / base', importLogo: 'Import logo', logoHint: 'Optional logo for the body and base. It appears in preview and is exported as raised relief in the body STL.', chooseFile: 'PNG, JPG, WebP or SVG', replaceLogo: 'Replace logo', removeLogo: 'Remove logo', useLogo: 'Show logo', logoWidth: 'Logo width', logoHeight: 'Logo height', logoDepth: 'Relief depth', logoPosition: 'Vertical position', logoInvalid: 'Could not read this image.',
    exportTitle: 'Ready to fabricate', exportText: 'The body is generated locally as a watertight rotational shell. Preview-only socket and bulb parts are excluded from the STL.',
    exportBody: 'Export lamp body', download: 'Download STL', exported: 'STL download started', exportFailed: 'Export failed. Please try again.',
    summary: 'Model summary', profile: 'Profile', totalHeight: 'Total height', diameter: 'Base diameter', volume: 'Build envelope',
    mm: 'mm', drag: 'Drag to orbit', scroll: 'Scroll to zoom', mesh: 'Mesh', licenses: 'Local geometry', localOnly: 'No model data is uploaded.',
  },
  vi: {
    addPoint: 'Thêm điểm',
    title: 'Trình tạo thân đèn', subtitle: 'Tạo thân đèn tham số', workspace: 'KHÔNG GIAN THÂN ĐÈN', preview: 'Preview 3D trực tiếp', realtime: 'Hình học thời gian thực',
    tabs: { body: 'Thân đèn', profile: 'Vẽ biên dạng', shape: 'Hình dạng', base: 'Đế & ngàm', finish: 'Hoàn thiện', export: 'Xuất file' },
    bodyShape: 'Biên dạng thân', bodyShapeHint: 'Chọn hình dáng ban đầu cho thân đèn in 3D.', profileMode: 'Chế độ biên dạng', preset: 'Mẫu sẵn', advanced: 'Biên dạng nâng cao', advancedHint: 'Chỉnh cùng biên dạng Bézier dọc như chao đèn: kéo điểm, tay nắm và đổi Cong/Góc.', vertical: 'Biên dạng dọc', dragHint: 'Kéo các điểm và tay nắm · Nhấp đúp điểm để đổi Cong/Góc · Nhấp đúp bất kỳ vị trí nào trên lưới để thêm điểm', profilePreset: 'Mẫu biên dạng', maxRadius: 'Bán kính lớn nhất', profileLabels: { cylinder: 'Trụ', taper: 'Thuôn côn', hourglass: 'Đồng hồ cát', pedestal: 'Bệ chân', lampshade: 'Chao đèn' }, lampshade: 'Chao đèn', lowerRadius: 'Bán kính đáy thân', shoulderRadius: 'Bán kính vai', waistRadius: 'Bán kính eo', upperRadius: 'Bán kính phía trên', profileCurve: 'Độ cong đường biên', profileFlare: 'Độ xòe chao',
    shapeSettings: 'Thiết lập hình dạng', shapes: { circle: 'Tròn', polygon: 'Đa giác', wave: 'Sóng', star: 'Ngôi sao' }, count: 'Số lượng', depth: 'Độ sâu', twist: 'Độ xoắn',
    profiles: { cylinder: 'Trụ thẳng', taper: 'Thuôn côn', hourglass: 'Đồng hồ cát', pedestal: 'Bệ chân', lampshade: 'Chao đèn' },
    dimensions: 'Kích thước thân', height: 'Chiều cao', bodyRadius: 'Bán kính thân', topRadius: 'Bán kính đỉnh',
    base: 'Đế và vị trí lắp', baseRadius: 'Bán kính đế', baseHeight: 'Chiều cao đế', neckRadius: 'Bán kính cổ', neckHeight: 'Chiều cao cổ', shadeSeatRadius: 'Bán kính mặt nối phẳng', shadeSeatHeight: 'Chiều cao mặt nối phẳng', bottomHole: 'Lỗ luồn dây & gắn đuôi đèn', bottomHoleHint: 'Lỗ xuyên thực được cắt qua đáy để luồn dây và gắn đuôi đèn.', bottomHoleDiameter: 'Đường kính lỗ', holeEnabled: 'Lỗ đáy', holeOn: 'Đang mở', holeOff: 'Đóng',
    socket: 'Miệng lắp đui', socketDiameter: 'Đường kính miệng', socketHint: 'Miệng được thiết kế cho vòng chuyển E27/E14 có thể thay thế.',
    construction: 'Kết cấu in', wall: 'Độ dày thành', segments: 'Độ phân giải quanh trục', resolutionHint: 'Độ phân giải cao tạo thân tròn mượt hơn.',
    appearance: 'Hiển thị', style: 'Kiểu hiển thị', smooth: 'Mượt', lowPoly: 'Low poly', color: 'Màu thân đèn', simulation: 'Mô phỏng đèn',
    simulationHint: 'Hiện đui, bóng và ánh sáng ấm phía trên thân đèn.', on: 'Bật', off: 'Tắt',
    exportTitle: 'Sẵn sàng chế tạo', exportText: 'Thân đèn được tạo cục bộ thành một vỏ xoay kín nước. Đui và bóng chỉ dùng cho preview, không có trong STL.',
    exportBody: 'Xuất thân đèn', download: 'Tải STL', exported: 'Đã bắt đầu tải STL', exportFailed: 'Không thể xuất file. Vui lòng thử lại.',
    summary: 'Tóm tắt mẫu', profile: 'Biên dạng', totalHeight: 'Tổng chiều cao', diameter: 'Đường kính đế', volume: 'Bao kích thước',
    mm: 'mm', drag: 'Kéo để xoay', scroll: 'Cuộn để zoom', mesh: 'Lưới', licenses: 'Hình học cục bộ', localOnly: 'Không tải dữ liệu mẫu lên máy chủ.',
  },
} as const;

export type LampBodyCopy = typeof COPY.en;
const BODY_LOGO_COPY: Record<'en' | 'vi', LogoCopy> = {
  en: { logo: 'Logo on body / base', importLogo: 'Import logo', logoHint: 'Optional logo for the body and base. It appears in preview and is exported as raised relief in the body STL.', chooseFile: 'PNG, JPG, WebP or SVG', replaceLogo: 'Replace logo', removeLogo: 'Remove logo', useLogo: 'Show logo', logoWidth: 'Logo width', logoHeight: 'Logo height', logoDepth: 'Relief depth', logoPosition: 'Vertical position', logoInvalid: 'Could not read this image.' },
  vi: { logo: 'Logo trên thân / đế', importLogo: 'Import logo', logoHint: 'Tùy chọn logo cho thân và đế. Logo hiện trong preview và được xuất nổi trong STL thân.', chooseFile: 'PNG, JPG, WebP hoặc SVG', replaceLogo: 'Đổi logo', removeLogo: 'Xóa logo', useLogo: 'Hiện logo', logoWidth: 'Chiều rộng logo', logoHeight: 'Chiều cao logo', logoDepth: 'Độ nổi logo', logoPosition: 'Vị trí dọc', logoInvalid: 'Không đọc được ảnh logo này.' },
};
export function getLampBodyCopy(language: Language): LampBodyCopy {
  return { ...COPY[language], ...BODY_LOGO_COPY[language === 'vi' ? 'vi' : 'en'] } as LampBodyCopy;
}

function cubicValue(a: number, b: number, c: number, d: number, t: number) {
  const inverse = 1 - t;
  return inverse ** 3 * a + 3 * inverse ** 2 * t * b + 3 * inverse * t ** 2 * c + t ** 3 * d;
}

function solveCubicParameter(a: number, b: number, c: number, d: number, target: number) {
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 14; iteration += 1) {
    const middle = (low + high) / 2;
    if (cubicValue(a, b, c, d, middle) < target) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

function getAdvancedRadius(points: BodyProfilePoint[], maxRadius: number, normalizedHeight: number) {
  const sorted = [...points].sort((a, b) => a.y - b.y);
  if (sorted.length === 0) return 0;
  const y = THREE.MathUtils.clamp(normalizedHeight, 0, 1);
  if (y <= sorted[0].y) return Math.max(0, sorted[0].x * maxRadius);
  const last = sorted[sorted.length - 1];
  if (y >= last.y) return Math.max(0, last.x * maxRadius);
  let index = 0;
  for (let pointIndex = 0; pointIndex < sorted.length - 1; pointIndex += 1) {
    if (y >= sorted[pointIndex].y && y <= sorted[pointIndex + 1].y) {
      index = pointIndex;
      break;
    }
  }
  const start = sorted[index];
  const end = sorted[index + 1] ?? start;
  if (start.type === 'corner' && end.type === 'corner') {
    const span = end.y - start.y;
    return Math.max(0, (start.x + (end.x - start.x) * (span === 0 ? 0 : (y - start.y) / span)) * maxRadius);
  }
  const startControl = start.handleOut ?? { x: start.x, y: start.y + (end.y - start.y) * .33 };
  const endControl = end.handleIn ?? { x: end.x, y: end.y - (end.y - start.y) * .33 };
  const parameter = solveCubicParameter(start.y, startControl.y, endControl.y, end.y, y);
  return Math.max(0, cubicValue(start.x, startControl.x, endControl.x, end.x, parameter) * maxRadius);
}

function bodyRadiusAt(config: LampBodyConfig, progress: number) {
  const p = Math.min(1, Math.max(0, progress));
  if (config.profileMode === 'advanced') {
    const rawRadius = getAdvancedRadius(config.advancedProfilePoints, config.advancedMaxRadius, p);
    const rawBottomRadius = getAdvancedRadius(config.advancedProfilePoints, config.advancedMaxRadius, 0);
    const rawTopRadius = getAdvancedRadius(config.advancedProfilePoints, config.advancedMaxRadius, 1);
    const dimensionOffset = THREE.MathUtils.lerp(config.bodyRadius - rawBottomRadius, config.topRadius - rawTopRadius, p);
    return Math.max(2, rawRadius + dimensionOffset);
  }
  if (config.profile === 'cylinder') return config.bodyRadius;
  if (config.profile === 'taper') return THREE.MathUtils.lerp(config.bodyRadius, config.topRadius, p);
  if (config.profile === 'hourglass') {
    const waist = Math.max(config.topRadius, config.bodyRadius * .52);
    return p < .5 ? THREE.MathUtils.lerp(config.bodyRadius, waist, p * 2) : THREE.MathUtils.lerp(waist, config.topRadius, (p - .5) * 2);
  }
  if (config.profile === 'lampshade') {
    const lower = Math.max(config.bodyRadius * 1.18, config.baseRadius * 0.78);
    const upper = Math.max(config.topRadius, config.neckRadius * 1.16);
    const shadeT = Math.pow(p, 0.88);
    const shoulder = THREE.MathUtils.lerp(lower, upper, 0.5);
    if (shadeT < 0.48) return THREE.MathUtils.lerp(lower, shoulder, shadeT / 0.48);
    return THREE.MathUtils.lerp(shoulder, upper, (shadeT - 0.48) / 0.52);
  }
  const eased = p * p * (3 - 2 * p);
  return THREE.MathUtils.lerp(config.bodyRadius * .86, config.topRadius, eased);
}

function positiveModulo(value: number, modulo: number) {
  return ((value % modulo) + modulo) % modulo;
}

function bodyShapeRadius(radius: number, angle: number, config: LampBodyConfig) {
  if (radius <= 0) return 0;
  const waves = config.shapeType === 'polygon'
    ? Math.min(12, Math.max(3, Math.round(config.shapeWaves)))
    : Math.min(64, Math.max(3, Math.round(config.shapeWaves)));
  if (config.shapeType === 'circle') return radius;
  if (config.shapeType === 'polygon') {
    const sector = Math.PI * 2 / waves;
    const localAngle = positiveModulo(angle, sector) - sector / 2;
    return radius * Math.cos(Math.PI / waves) / Math.max(.08, Math.cos(localAngle));
  }
  if (config.shapeType === 'star') {
    const sector = Math.PI * 2 / waves;
    const localDistance = Math.abs(positiveModulo(angle, sector) - sector / 2) / (sector / 2);
    return Math.max(.2, radius + config.shapeAmplitude * localDistance);
  }
  return Math.max(.2, radius + config.shapeAmplitude * Math.cos(waves * angle));
}

export function getLampBodySurfaceRadius(config: LampBodyConfig, normalizedHeight: number) {
  const progress = THREE.MathUtils.clamp(normalizedHeight, 0, 1);
  return Math.max(2, bodyShapeRadius(bodyRadiusAt(config, progress), 0, config));
}

export function createLampBodyGeometry(config: LampBodyConfig) {
  const points: THREE.Vector2[] = [];
  const baseHeight = Math.max(8, config.baseHeight);
  const bodyHeight = Math.max(50, config.height);
  const bodyTop = baseHeight + bodyHeight;
  const neckHeight = Math.max(8, config.neckHeight);
  const totalHeight = bodyTop + neckHeight;
  const wall = Math.max(.8, config.wallThickness);
  const seatRadius = Math.max(config.neckRadius + 1, Math.min(config.shadeSeatRadius, Math.max(config.neckRadius + 1, config.baseRadius - wall)));
  const seatHeight = Math.max(2, Math.min(config.shadeSeatHeight, neckHeight * .72));
  const bodyBottomRadius = bodyRadiusAt(config, 0);
  const bodyTopRadius = bodyRadiusAt(config, 1);
  const maximumHoleRadius = Math.max(2, bodyBottomRadius - wall - 1);
  const bottomHoleRadius = config.bottomHoleEnabled
    ? Math.min(Math.max(2, config.bottomHoleDiameter / 2), maximumHoleRadius)
    : 0;

  const transition = (start: number, end: number, progress: number, startTangent = 0, endTangent = 0) => {
    const t = THREE.MathUtils.clamp(progress, 0, 1);
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * start + h10 * startTangent + h01 * end + h11 * endTangent;
  };
  const bodySlopeAtBottom = (bodyRadiusAt(config, .025) - bodyBottomRadius) / .025;
  const bodySlopeAtTop = (bodyTopRadius - bodyRadiusAt(config, .975)) / .025;
  const baseEndTangent = bodySlopeAtBottom * baseHeight / bodyHeight;
  // Keep the neck as a gentle shaping influence. Blending all the way down to
  // the raw neck radius creates a visible collar/ring at the shade joint.
  const neckTarget = THREE.MathUtils.lerp(config.neckRadius, Math.min(bodyTopRadius, seatRadius), .78);
  const neckBlend = THREE.MathUtils.clamp(1 - seatHeight / neckHeight, .18, .82);
  const topOuterRadiusAt = (progress: number) => {
    const t = THREE.MathUtils.clamp(progress, 0, 1);
    return t <= neckBlend
      ? transition(bodyTopRadius, neckTarget, t / neckBlend, bodySlopeAtTop * neckBlend, 0)
      : transition(neckTarget, seatRadius, (t - neckBlend) / (1 - neckBlend), 0, 0);
  };

  // Sample the complete outer profile densely. The old profile used a handful
  // of straight rings, which made the base, body and neck read as stacked
  // blocks even with smooth normals.
  const baseSamples = 10;
  for (let index = 0; index <= baseSamples; index += 1) {
    const progress = index / baseSamples;
    points.push(new THREE.Vector2(transition(config.baseRadius, bodyBottomRadius, progress, 0, baseEndTangent), baseHeight * progress));
  }
  const bodySamples = 32;
  for (let index = 1; index <= bodySamples; index += 1) {
    const progress = index / bodySamples;
    points.push(new THREE.Vector2(bodyRadiusAt(config, progress), baseHeight + bodyHeight * progress));
  }
  const topSamples = 16;
  for (let index = 1; index <= topSamples; index += 1) {
    const progress = index / topSamples;
    points.push(new THREE.Vector2(topOuterRadiusAt(progress), THREE.MathUtils.lerp(bodyTop, totalHeight, progress)));
  }
  // Keep the top rim planar so the shade/socket can sit on a real flat seat.
  points.push(new THREE.Vector2(seatRadius, totalHeight));

  const innerTopRadius = Math.max(2, Math.min(seatRadius - .8, config.socketDiameter / 2));
  points.push(new THREE.Vector2(innerTopRadius, totalHeight));
  for (let index = 1; index <= topSamples; index += 1) {
    const progress = 1 - index / topSamples;
    const y = THREE.MathUtils.lerp(bodyTop, totalHeight, progress);
    points.push(new THREE.Vector2(Math.max(2, topOuterRadiusAt(progress) - wall), y));
  }
  for (let index = bodySamples - 1; index >= 0; index -= 1) {
    const progress = index / bodySamples;
    points.push(new THREE.Vector2(Math.max(2, bodyRadiusAt(config, progress) - wall), baseHeight + bodyHeight * progress));
  }
  const innerBottomRadius = Math.max(2, bodyBottomRadius - wall);
  const baseInnerSamples = 8;
  for (let index = 1; index <= baseInnerSamples; index += 1) {
    const progress = index / baseInnerSamples;
    points.push(new THREE.Vector2(transition(innerBottomRadius, bottomHoleRadius, progress), baseHeight * (1 - progress)));
  }
  // Close the radial section across the underside. With an enabled hole this
  // is an annular face; when disabled it becomes a solid bottom cap.
  points.push(new THREE.Vector2(config.baseRadius, 0));

  const segments = config.renderStyle === 'low-poly' ? Math.max(16, Math.round(config.segments / 2)) : Math.max(16, Math.round(config.segments));
  const outerTopIndex = points.findIndex((point, index) => index > 0 && point.y === totalHeight);
  const innerProfileStart = outerTopIndex + 1;
  const geometry = new THREE.LatheGeometry(points, segments);
  const position = geometry.getAttribute('position');
  for (let row = 0; row < points.length; row += 1) {
    const point = points[row];
    const progress = THREE.MathUtils.clamp(point.y / totalHeight, 0, 1);
    const twist = config.shapeType === 'circle' ? 0 : THREE.MathUtils.degToRad(config.shapeTwist) * progress;
    const shapeOuter = row < innerProfileStart || row === points.length - 1;
    for (let segment = 0; segment <= segments; segment += 1) {
      const index = segment * points.length + row;
      const angle = segment / segments * Math.PI * 2;
      const radius = shapeOuter ? Math.max(point.x - wall, bodyShapeRadius(point.x, angle, config)) : point.x;
      const rotatedAngle = angle + twist;
      position.setXYZ(index, radius * Math.sin(rotatedAngle), point.y, radius * Math.cos(rotatedAngle));
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function downloadFile(data: string, filename: string) {
  const url = URL.createObjectURL(new Blob([data], { type: 'model/stl' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatValue(value: number, step: number, unit: string) {
  const decimals = step < 1 ? 1 : 0;
  return `${value.toFixed(decimals)} ${unit}`;
}

function RangeControl({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (value: number) => void }) {
  return <label className="lamp-body-range"><span><span>{label}</span><strong>{formatValue(value, step, unit)}</strong></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function SelectControl({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <label className="lamp-body-select"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>;
}

function ToggleControl({ label, hint, value, onChange, onLabel, offLabel }: { label: string; hint: string; value: boolean; onChange: () => void; onLabel: string; offLabel: string }) {
  return <div className="lamp-body-toggle-row"><div><strong>{label}</strong><small>{hint}</small></div><button type="button" className={value ? 'lamp-body-toggle on' : 'lamp-body-toggle'} aria-pressed={value} onClick={onChange}><span />{value ? onLabel : offLabel}</button></div>;
}

function BodyMesh({ geometry, color, lowPoly, logo, logoPosition }: { geometry: THREE.BufferGeometry; color: string; lowPoly: boolean; logo: LogoConfig | null; logoPosition: [number, number, number] }) {
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.64} metalness={.04} side={THREE.DoubleSide} flatShading={lowPoly} />{logo?.enabled && <Suspense fallback={null}><LampLogoDecal logo={logo} position={logoPosition} /></Suspense>}</mesh>;
}

export function LampBodyModel({ config, yOffset = 0, showSimulation = config.showSimulation, showMesh = false }: { config: LampBodyConfig; yOffset?: number; showSimulation?: boolean; showMesh?: boolean }) {
  const geometry = useMemo(() => createLampBodyGeometry(config), [config]);
  const totalHeight = config.baseHeight + config.height + config.neckHeight;
  const socketRadius = Math.max(2, config.socketDiameter / 2);
  const logoProgress = THREE.MathUtils.clamp(config.logo?.position ?? .55, .1, .9);
  const logoPosition: [number, number, number] = [0, config.baseHeight + config.height * logoProgress, getLampBodySurfaceRadius(config, logoProgress) + 1];
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group position={[0, yOffset, 0]}>
    <BodyMesh geometry={geometry} color={config.color} lowPoly={config.renderStyle === 'low-poly'} logo={config.logo} logoPosition={logoPosition} />
    {showMesh && <mesh geometry={geometry}><meshBasicMaterial color="#8be7ff" wireframe transparent opacity={.28} /></mesh>}
    <mesh position={[0, totalHeight + .8, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[socketRadius + .8, .8, 12, 32]} /><meshStandardMaterial color="#252b35" metalness={.75} roughness={.3} /></mesh>
    <mesh position={[0, totalHeight + 6, 0]} castShadow><cylinderGeometry args={[socketRadius, socketRadius, 12, 32, 1, true]} /><meshStandardMaterial color="#252b35" metalness={.75} roughness={.3} side={THREE.DoubleSide} /></mesh>
    {config.bottomHoleEnabled && <mesh position={[0, .9, 0]}><cylinderGeometry args={[Math.max(1, config.bottomHoleDiameter / 2 - .6), Math.max(1, config.bottomHoleDiameter / 2 - .6), 1.8, 32, 1, true]} /><meshStandardMaterial color="#171b24" roughness={.9} side={THREE.DoubleSide} /></mesh>}
    {showSimulation && <>
      <pointLight position={[0, totalHeight + 48, 0]} color="#ffd38a" intensity={260} distance={500} decay={2} />
      <mesh position={[0, totalHeight + 48, 0]}><sphereGeometry args={[23, 32, 18]} /><meshStandardMaterial color="#fff3cf" emissive="#ffb84a" emissiveIntensity={1.8} roughness={.25} /></mesh>
    </>}
  </group>;
}

function LampBodyScene({ config }: { config: LampBodyConfig; geometry?: THREE.BufferGeometry }) {
  const totalHeight = config.baseHeight + config.height + config.neckHeight;
  return <>
    <color attach="background" args={['#070b12']} />
    <PerspectiveCamera makeDefault position={[420, 300, 520]} fov={38} />
    <ambientLight intensity={.55} />
    <hemisphereLight args={['#d9eaff', '#101521', .48]} />
    <directionalLight position={[220, 360, 260]} intensity={2.3} castShadow shadow-mapSize={[2048, 2048]} />
    <directionalLight position={[-180, 180, -120]} intensity={.7} />
    {config.showSimulation && <pointLight position={[0, totalHeight + 48, 0]} color="#ffd38a" intensity={260} distance={500} decay={2} />}
    <Environment resolution={128} background={false} environmentIntensity={config.showSimulation ? .4 : 1}>
      <Lightformer form="rect" intensity={2.5} position={[0, 180, -320]} scale={[360, 360, 1]} />
      <Lightformer form="rect" intensity={1.1} position={[-260, 190, 130]} scale={[240, 240, 1]} />
    </Environment>
    <LampBodyModel config={config} />
    <Grid sectionSize={100} cellSize={20} infiniteGrid position={[0, -.2, 0]} fadeDistance={1400} fadeStrength={1} />
    <OrbitControls makeDefault target={[0, totalHeight * .5, 0]} enableDamping dampingFactor={.1} minDistance={180} maxDistance={1100} />
  </>;
}

function PanelTitle({ icon: Icon, title, hint }: { icon: typeof Box; title: string; hint?: string }) {
  return <div className="lamp-body-panel-title"><span className="lamp-body-panel-icon"><Icon size={16} /></span><div><h3>{title}</h3>{hint && <p>{hint}</p>}</div></div>;
}

export type LampBodyUpdate = <K extends keyof LampBodyConfig>(key: K, value: LampBodyConfig[K]) => void;

export function LampBodyControls({ config, tab, update, copy, onExport, exportState = 'idle' }: { config: LampBodyConfig; tab: BodyTab; update: LampBodyUpdate; copy: LampBodyCopy; onExport?: () => void; exportState?: 'idle' | 'done' | 'error' }) {
  return <>
    {tab === 'body' && <div className="lamp-body-panel-content"><section><PanelTitle icon={Box} title={copy.bodyShape} hint={copy.bodyShapeHint} /><SelectControl label={copy.bodyShape} value={config.profile} options={(Object.keys(copy.profiles) as BodyProfile[]).map((value) => ({ value, label: copy.profiles[value] }))} onChange={(value) => update('profile', value as BodyProfile)} /></section><section><PanelTitle icon={SlidersHorizontal} title={copy.dimensions} /><RangeControl label={copy.height} value={config.height} min={80} max={360} unit={copy.mm} onChange={(value) => update('height', value)} /><RangeControl label={copy.bodyRadius} value={config.bodyRadius} min={22} max={90} unit={copy.mm} onChange={(value) => update('bodyRadius', value)} /><RangeControl label={copy.topRadius} value={config.topRadius} min={16} max={72} unit={copy.mm} onChange={(value) => update('topRadius', value)} /></section></div>}
    {tab === 'base' && <div className="lamp-body-panel-content"><section><PanelTitle icon={Layers3} title={copy.base} /><RangeControl label={copy.baseRadius} value={config.baseRadius} min={45} max={120} unit={copy.mm} onChange={(value) => update('baseRadius', value)} /><RangeControl label={copy.baseHeight} value={config.baseHeight} min={8} max={42} unit={copy.mm} onChange={(value) => update('baseHeight', value)} /><RangeControl label={copy.neckRadius} value={config.neckRadius} min={14} max={42} unit={copy.mm} onChange={(value) => update('neckRadius', value)} /><RangeControl label={copy.neckHeight} value={config.neckHeight} min={8} max={38} unit={copy.mm} onChange={(value) => update('neckHeight', value)} /></section><section><PanelTitle icon={Info} title={copy.socket} hint={copy.socketHint} /><RangeControl label={copy.socketDiameter} value={config.socketDiameter} min={24} max={52} unit={copy.mm} onChange={(value) => update('socketDiameter', value)} /></section></div>}
    {tab === 'finish' && <div className="lamp-body-panel-content"><section><PanelTitle icon={Settings2} title={copy.construction} hint={copy.resolutionHint} /><RangeControl label={copy.wall} value={config.wallThickness} min={1.2} max={6} step={.1} unit={copy.mm} onChange={(value) => update('wallThickness', value)} /><RangeControl label={copy.segments} value={config.segments} min={24} max={128} step={8} unit="" onChange={(value) => update('segments', value)} /></section><section><PanelTitle icon={Sparkles} title={copy.appearance} /><SelectControl label={copy.style} value={config.renderStyle} options={[{ value: 'smooth', label: copy.smooth }, { value: 'low-poly', label: copy.lowPoly }]} onChange={(value) => update('renderStyle', value as 'smooth' | 'low-poly')} /><div className="lamp-body-color-field"><span>{copy.color}</span><div className="lamp-body-swatches">{COLORS.map((color) => <button type="button" key={color} className={config.color === color ? 'selected' : ''} style={{ background: color }} aria-label={color} onClick={() => update('color', color)} />)}</div></div></section><section><PanelTitle icon={Lightbulb} title={copy.simulation} /><ToggleControl label={copy.simulation} hint={copy.simulationHint} value={config.showSimulation} onChange={() => update('showSimulation', !config.showSimulation)} onLabel={copy.on} offLabel={copy.off} /></section></div>}
    {tab === 'export' && <div className="lamp-body-panel-content"><section className="lamp-body-export-card"><span className="lamp-body-export-icon"><Check size={20} /></span><h2>{copy.exportTitle}</h2><p>{copy.exportText}</p><button type="button" className="lamp-body-export-button" onClick={onExport}><Download size={16} /> {copy.download} <ArrowRight size={15} /></button>{exportState !== 'idle' && <div className={`lamp-body-export-status ${exportState}`}>{exportState === 'done' ? <Check size={14} /> : <Info size={14} />}{exportState === 'done' ? copy.exported : copy.exportFailed}</div>}</section><section className="lamp-body-summary"><PanelTitle icon={Info} title={copy.summary} /><div><span>{copy.profile}</span><strong>{copy.profiles[config.profile]}</strong></div><div><span>{copy.totalHeight}</span><strong>{Math.round(config.baseHeight + config.height + config.neckHeight)} {copy.mm}</strong></div><div><span>{copy.diameter}</span><strong>{Math.round(config.baseRadius * 2)} {copy.mm}</strong></div><div><span>{copy.volume}</span><strong>{Math.round(config.baseRadius * 2)} × {Math.round(config.baseHeight + config.height + config.neckHeight)} {copy.mm}</strong></div></section></div>}
  </>;
}

export function LampBodyCreatorPage() {
  const { language } = useI18n();
  const copy = getLampBodyCopy(language);
  const [tab, setTab] = useState<BodyTab>('profile');
  const [config, setConfig] = useState<LampBodyConfig>(DEFAULT_LAMP_BODY_CONFIG);
  const [exportState, setExportState] = useState<'idle' | 'done' | 'error'>('idle');
  const geometry = useMemo(() => createLampBodyGeometry(config), [config]);
  const totalHeight = config.baseHeight + config.height + config.neckHeight;
  const update = <K extends keyof LampBodyConfig>(key: K, value: LampBodyConfig[K]) => setConfig((current) => ({ ...current, [key]: value }));

  const exportStl = () => {
    try {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
      const logoProgress = THREE.MathUtils.clamp(config.logo?.position ?? .55, .1, .9);
      const model = new THREE.Group();
      model.add(mesh);
      model.add(createLogoReliefGroup(config.logo, getLampBodySurfaceRadius(config, logoProgress), config.baseHeight + config.height * logoProgress));
      model.updateMatrixWorld(true);
      const output = new STLExporter().parse(model, { binary: false });
      downloadFile(output, `lamp-body-${config.profile}.stl`);
      mesh.material.dispose();
      setExportState('done');
    } catch {
      setExportState('error');
    }
  };

  const tabs = [
    { id: 'body' as const, label: copy.tabs.body, icon: Box },
    { id: 'shape' as const, label: copy.tabs.shape, icon: Waves },
    { id: 'base' as const, label: copy.tabs.base, icon: Layers3 },
    { id: 'finish' as const, label: copy.tabs.finish, icon: Settings2 },
    { id: 'export' as const, label: copy.tabs.export, icon: Download },
  ];

  return <main className="lamp-body-page">
    <header className="lamp-body-header"><div className="lamp-body-brand"><span className="lamp-body-brand-mark"><Lightbulb size={16} /></span><span>FormaForge <small>BODY LAB</small></span></div><div className="lamp-body-header-status"><span className="lamp-body-live-dot" />{copy.realtime}</div><div className="lamp-body-header-meta"><span>ADMIN / LAMP BODY</span><span className="lamp-body-unit-pill">MM</span></div></header>
    <div className="lamp-body-workspace">
      <aside className="lamp-body-sidebar">
        <div className="lamp-body-sidebar-title"><span className="lamp-body-kicker"><Sparkles size={14} /> {copy.workspace}</span><h1>{copy.title}</h1><p>{copy.subtitle}</p></div>
        <nav className="lamp-body-tabs" aria-label="Lamp Body Creator sections">{tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={tab === id ? 'active' : ''} aria-selected={tab === id} onClick={() => { setTab(id); setExportState('idle'); }}><Icon size={17} /><span>{label}</span></button>)}</nav>
        <div className="lamp-body-panel-scroll">
          {tab === 'body' && <div className="lamp-body-panel-content"><section><PanelTitle icon={Box} title={copy.bodyShape} hint={copy.bodyShapeHint} /><SelectControl label={copy.bodyShape} value={config.profile} options={(Object.keys(copy.profiles) as BodyProfile[]).map((value) => ({ value, label: copy.profiles[value] }))} onChange={(value) => update('profile', value as BodyProfile)} /></section><section><PanelTitle icon={SlidersHorizontal} title={copy.dimensions} /><RangeControl label={copy.height} value={config.height} min={80} max={360} unit={copy.mm} onChange={(value) => update('height', value)} /><RangeControl label={copy.bodyRadius} value={config.bodyRadius} min={22} max={90} unit={copy.mm} onChange={(value) => update('bodyRadius', value)} /><RangeControl label={copy.topRadius} value={config.topRadius} min={16} max={72} unit={copy.mm} onChange={(value) => update('topRadius', value)} /></section></div>}
          {tab === 'shape' && <div className="lamp-body-panel-content"><section><PanelTitle icon={Waves} title={copy.shapeSettings} /><div className="lamp-body-shape-grid"><button type="button" className={`lamp-body-shape-button${config.shapeType === 'circle' ? ' active' : ''}`} onClick={() => update('shapeType', 'circle')}><Circle size={21} /><span>{copy.shapes.circle}</span></button><button type="button" className={`lamp-body-shape-button${config.shapeType === 'polygon' ? ' active' : ''}`} onClick={() => update('shapeType', 'polygon')}><Hexagon size={21} /><span>{copy.shapes.polygon}</span></button><button type="button" className={`lamp-body-shape-button${config.shapeType === 'wave' ? ' active' : ''}`} onClick={() => update('shapeType', 'wave')}><Waves size={21} /><span>{copy.shapes.wave}</span></button><button type="button" className={`lamp-body-shape-button${config.shapeType === 'star' ? ' active' : ''}`} onClick={() => update('shapeType', 'star')}><Flower2 size={21} /><span>{copy.shapes.star}</span></button></div>{config.shapeType !== 'circle' && <div className="lamp-body-profile-fields"><RangeControl label={copy.count} value={config.shapeWaves} min={3} max={config.shapeType === 'polygon' ? 12 : 64} unit="" onChange={(value) => update('shapeWaves', value)} />{config.shapeType !== 'polygon' && <RangeControl label={copy.depth} value={config.shapeAmplitude} min={0} max={20} step={.5} unit={` ${copy.mm}`} onChange={(value) => update('shapeAmplitude', value)} />}</div>}<RangeControl label={copy.twist} value={config.shapeTwist} min={0} max={720} step={5} unit="°" onChange={(value) => update('shapeTwist', value)} /></section></div>}
          {tab === 'base' && <div className="lamp-body-panel-content"><section><PanelTitle icon={Layers3} title={copy.base} /><RangeControl label={copy.baseRadius} value={config.baseRadius} min={45} max={120} unit={copy.mm} onChange={(value) => update('baseRadius', value)} /><RangeControl label={copy.baseHeight} value={config.baseHeight} min={8} max={42} unit={copy.mm} onChange={(value) => update('baseHeight', value)} /><RangeControl label={copy.neckRadius} value={config.neckRadius} min={14} max={42} unit={copy.mm} onChange={(value) => update('neckRadius', value)} /><RangeControl label={copy.neckHeight} value={config.neckHeight} min={8} max={38} unit={copy.mm} onChange={(value) => update('neckHeight', value)} /><RangeControl label={copy.shadeSeatRadius} value={config.shadeSeatRadius} min={15} max={90} unit={copy.mm} onChange={(value) => update('shadeSeatRadius', value)} /><RangeControl label={copy.shadeSeatHeight} value={config.shadeSeatHeight} min={2} max={38} unit={copy.mm} onChange={(value) => update('shadeSeatHeight', value)} /></section><section><PanelTitle icon={Info} title={copy.socket} hint={copy.socketHint} /><RangeControl label={copy.socketDiameter} value={config.socketDiameter} min={24} max={52} unit={copy.mm} onChange={(value) => update('socketDiameter', value)} /></section></div>}
          {tab === 'finish' && <div className="lamp-body-panel-content"><section><PanelTitle icon={Settings2} title={copy.construction} hint={copy.resolutionHint} /><RangeControl label={copy.wall} value={config.wallThickness} min={1.2} max={6} step={.1} unit={copy.mm} onChange={(value) => update('wallThickness', value)} /><RangeControl label={copy.segments} value={config.segments} min={24} max={128} step={8} unit="" onChange={(value) => update('segments', value)} /></section><section><PanelTitle icon={Sparkles} title={copy.appearance} /><SelectControl label={copy.style} value={config.renderStyle} options={[{ value: 'smooth', label: copy.smooth }, { value: 'low-poly', label: copy.lowPoly }]} onChange={(value) => update('renderStyle', value as RenderStyle)} /><div className="lamp-body-color-field"><span>{copy.color}</span><div className="lamp-body-swatches">{COLORS.map((color) => <button type="button" key={color} className={config.color === color ? 'selected' : ''} style={{ background: color }} aria-label={color} onClick={() => update('color', color)} />)}</div></div></section><section><PanelTitle icon={Lightbulb} title={copy.simulation} /><ToggleControl label={copy.simulation} hint={copy.simulationHint} value={config.showSimulation} onChange={() => update('showSimulation', !config.showSimulation)} onLabel={copy.on} offLabel={copy.off} /></section></div>}
          {tab === 'export' && <div className="lamp-body-panel-content"><section className="lamp-body-export-card"><span className="lamp-body-export-icon"><Check size={20} /></span><h2>{copy.exportTitle}</h2><p>{copy.exportText}</p><button type="button" className="lamp-body-export-button" onClick={exportStl}><Download size={16} /> {copy.download} <ArrowRight size={15} /></button>{exportState !== 'idle' && <div className={`lamp-body-export-status ${exportState}`}>{exportState === 'done' ? <Check size={14} /> : <Info size={14} />}{exportState === 'done' ? copy.exported : copy.exportFailed}</div>}</section><section className="lamp-body-summary"><PanelTitle icon={Info} title={copy.summary} /><div><span>{copy.profile}</span><strong>{copy.profiles[config.profile]}</strong></div><div><span>{copy.totalHeight}</span><strong>{Math.round(totalHeight)} {copy.mm}</strong></div><div><span>{copy.diameter}</span><strong>{Math.round(config.baseRadius * 2)} {copy.mm}</strong></div><div><span>{copy.volume}</span><strong>{Math.round(config.baseRadius * 2)} × {Math.round(totalHeight)} {copy.mm}</strong></div></section></div>}
        </div>
        {tab === 'finish' && <div className="lamp-body-panel-scroll"><LogoControls logo={config.logo} copy={copy} onChange={(logo) => update('logo', logo)} /></div>}
        <footer className="lamp-body-sidebar-footer"><span>{copy.licenses}</span><span>{copy.localOnly}</span></footer>
      </aside>
      <section className="lamp-body-viewport" aria-label={copy.preview}><Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}><LampBodyScene config={config} geometry={geometry} /></Canvas><div className="lamp-body-viewport-top"><span><Sparkles size={13} />{copy.preview}</span><span>{copy.profiles[config.profile]}</span></div><div className="lamp-body-viewport-toolbar"><span><Rotate3D size={14} />{copy.drag}</span><span>{copy.scroll}</span><button type="button" className={config.renderStyle === 'low-poly' ? 'active' : ''} onClick={() => update('renderStyle', config.renderStyle === 'low-poly' ? 'smooth' : 'low-poly')}><Box size={14} />{copy.mesh}</button></div><div className="lamp-body-viewport-measure"><span>H</span><strong>{Math.round(totalHeight)} {copy.mm}</strong><span>Ø</span><strong>{Math.round(config.baseRadius * 2)} {copy.mm}</strong></div></section>
    </div>
  </main>;
}
