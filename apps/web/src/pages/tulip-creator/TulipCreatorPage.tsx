import {
  Circle, Check, Download, Flower2, GraduationCap, Hexagon, Info, Instagram,
  Box, Layers3, Lightbulb, Plus, Settings2, Sparkles, Waves, X,
} from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { Environment, Grid, Lightformer, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Link, useLocation } from 'react-router-dom';
import { Suspense, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { useI18n, type Language } from '../../lib/i18n';
import { DEFAULT_LAMP_BODY_CONFIG, LampBodyControls, LampBodyModel, getLampBodyCopy, getLampBodySurfaceRadius, createLampBodyGeometry, type BodyTab, type LampBodyConfig, type LampBodyCopy, type LampBodyUpdate } from '../lamp-body-creator';
import { createLogoReliefGroup, LampLogoDecal, LogoControls, type LogoConfig, type LogoCopy } from '../lamp-logo';
import './tulip-creator.css';
import '../lamp-body-creator/lamp-body-creator.css';

type TulipTab = 'general' | 'shape' | 'settings' | 'export';
type TulipShape = 'circle' | 'polygon' | 'wave' | 'star';
type TulipStyle = 'smooth' | 'low-poly';
type ProfilePointType = 'corner' | 'smooth';

type ProfilePoint = {
  x: number;
  y: number;
  type?: ProfilePointType;
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
};

type TulipConfig = {
  height: number;
  profilePoints: ProfilePoint[];
  maxRadius: number;
  useAdvancedMode: boolean;
  radiusTop: number;
  radiusBottom: number;
  radiusMid: number;
  midHeight: number;
  segments: number;
  twist: number;
  shapeType: TulipShape;
  waves: number;
  amplitude: number;
  holeDiameter: number;
  renderStyle: TulipStyle;
  showSimulation: boolean;
  color: string;
  logo: LogoConfig | null;
};

const DEFAULT_PROFILE: ProfilePoint[] = [
  { x: .5, y: 0, type: 'corner' },
  { x: .9, y: .3, type: 'smooth', handleIn: { x: .9, y: .2 }, handleOut: { x: .9, y: .4 } },
  { x: 1, y: .6, type: 'smooth', handleIn: { x: 1, y: .5 }, handleOut: { x: 1, y: .7 } },
  { x: .8, y: 1, type: 'corner' },
];

const DEFAULT_CONFIG: TulipConfig = {
  height: 140,
  profilePoints: DEFAULT_PROFILE,
  maxRadius: 80,
  useAdvancedMode: true,
  radiusTop: 50,
  radiusBottom: 80,
  radiusMid: 90,
  midHeight: .4,
  segments: 60,
  twist: 0,
  shapeType: 'circle',
  waves: 8,
  amplitude: 2,
  holeDiameter: 42,
  renderStyle: 'smooth',
  showSimulation: false,
  color: '#fbbf24',
  logo: null,
};

const COLOR_PRESETS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#64748b', '#ffffff'];
const PROFILE_PRESETS: Array<{ name: string; points: ProfilePoint[] }> = [
  { name: 'Cylinder', points: [{ x: .8, y: 0, type: 'corner' }, { x: .8, y: 1, type: 'corner' }] },
  { name: 'Cone', points: [{ x: .9, y: 0, type: 'corner' }, { x: .4, y: 1, type: 'corner' }] },
  { name: 'Tulip', points: DEFAULT_PROFILE },
  { name: 'Vintage', points: [{ x: .9, y: 0, type: 'corner' }, { x: .7, y: .4, type: 'smooth', handleIn: { x: .8, y: .2 }, handleOut: { x: .6, y: .6 } }, { x: .4, y: 1, type: 'corner' }] },
  { name: 'Bowl', points: [{ x: .3, y: 0, type: 'corner' }, { x: .9, y: .3, type: 'smooth', handleIn: { x: .9, y: .1 }, handleOut: { x: .9, y: .5 } }, { x: 1, y: 1, type: 'corner' }] },
];

const COPY = {
  en: {
    title: 'Tulip Creator', subtitle: 'Lampshade Generator',
    tabs: { general: 'Draw profile', shape: 'Shape', settings: 'Settings', export: 'Export' },
    mounting: 'Mounting', hole: 'Hole Diameter (mm)', dimensions: 'Dimensions', advanced: 'Advanced Profile',
    height: 'Height', maxRadius: 'Max Radius', topOpening: 'Top Opening', middle: 'Middle', maxBottom: 'Max Bottom', middlePos: 'Middle Pos %',
    vertical: 'Vertical Profile', addPoint: 'Add point', dragHint: 'Drag points & handles • Double-click node to toggle Curve/Sharp • Double-click anywhere on the grid to add a point',
    shapeSettings: 'Shape Settings', twist: 'Twist', resolution: 'Resolution', count: 'Count', depth: 'Depth',
    shapes: { circle: 'Circle', polygon: 'Poly', wave: 'Wave', star: 'Star' },
    profileLabels: { Cylinder: 'Cylinder', Cone: 'Cone', Tulip: 'Tulip', Vintage: 'Vintage', Bowl: 'Bowl' },
    style: 'Style', smooth: 'Smooth', lowPoly: 'Low Poly / Geo', simulation: 'Simulation', lamp: 'Lamp Simulation', simulationHint: 'Preview with light and base',
    logo: 'Logo on shade', importLogo: 'Import logo', logoHint: 'Optional logo for this shade. It appears in preview and is exported as raised relief in the shade STL.', chooseFile: 'PNG, JPG, WebP or SVG', replaceLogo: 'Replace logo', removeLogo: 'Remove logo', useLogo: 'Show logo', logoWidth: 'Logo width', logoHeight: 'Logo height', logoDepth: 'Relief depth', logoPosition: 'Vertical position', logoInvalid: 'Could not read this image.',
    color: 'Color', download: 'Download STL', footer: 'Tulip Creator', licenses: 'Licenses', close: 'Close', soon: 'Soon', login: 'Log in', register: 'Register', language: 'Language', academy: 'Academy',
    licenseTitle: 'Licenses and Third-Party CAD Stack', licenseLead: 'FormaForge uses a client-side CAD path for parametric geometry and STL export.',
    licenseThree: 'Three.js + React Three Fiber', licenseThreeText: 'MIT licensed rendering and interaction libraries used for the live preview.',
    licenseStl: 'Three.js STLExporter', licenseStlText: 'MIT licensed exporter used to generate an ASCII STL directly in the browser.',
    licenseNote: 'This page generates geometry locally. No model or design data is uploaded.', showMesh: 'Show mesh', viewMesh: 'Hide mesh', exportFailed: 'Export failed',
  },
  es: {
    title: 'Creador de Tulipas', subtitle: 'Generador de Pantallas',
    tabs: { general: 'Perfil', shape: 'Forma', settings: 'Ajustes', export: 'Exportar' },
    mounting: 'Montaje', hole: 'Diámetro Agujero (mm)', dimensions: 'Dimensiones', advanced: 'Advanced Profile',
    height: 'Altura', maxRadius: 'Max Radius', topOpening: 'Apertura Sup.', middle: 'Medio', maxBottom: 'Max Base', middlePos: 'Posición Media %',
    vertical: 'Vertical Profile', addPoint: 'Add point', dragHint: 'Drag points & handles • Double-click node to toggle Curve/Sharp • Double-click anywhere on the grid to add a point',
    shapeSettings: 'Configuración de Forma', twist: 'Torsión', resolution: 'Resolución', count: 'Cantidad', depth: 'Profundidad',
    style: 'Estilo', smooth: 'Suave', lowPoly: 'Low Poly / Geo', simulation: 'Simulación', lamp: 'Simular Lámpara', simulationHint: 'Previsualizar con luz y base',
    color: 'Color', download: 'Download STL', footer: 'ShaperLab', licenses: 'Licencias', close: 'Cerrar', soon: 'Próximamente', login: 'Entrar', register: 'Registro',
    licenseTitle: 'Licencias y stack CAD de terceros', licenseLead: 'FormaForge utiliza una ruta CAD en el cliente para generar geometría paramétrica y STL.',
    licenseThree: 'Three.js + React Three Fiber', licenseThreeText: 'Bibliotecas de renderizado e interacción con licencia MIT para la vista previa en vivo.',
    licenseStl: 'Three.js STLExporter', licenseStlText: 'Exportador con licencia MIT que genera un STL ASCII directamente en el navegador.',
    licenseNote: 'Esta página genera la geometría localmente. No se suben modelos ni datos de diseño.', showMesh: 'Ver malla', viewMesh: 'Ocultar malla',
  },
  vi: {
    title: 'Trình tạo chao đèn', subtitle: 'Tạo chụp đèn tham số',
    tabs: { general: 'Vẽ biên dạng', shape: 'Hình dạng', settings: 'Thiết lập', export: 'Xuất file' },
    mounting: 'Đui đèn', hole: 'Đường kính lỗ (mm)', dimensions: 'Kích thước', advanced: 'Biên dạng nâng cao',
    height: 'Chiều cao', maxRadius: 'Bán kính lớn nhất', topOpening: 'Miệng trên', middle: 'Ở giữa', maxBottom: 'Đáy lớn nhất', middlePos: 'Vị trí giữa %',
    vertical: 'Biên dạng dọc', addPoint: 'Thêm điểm', dragHint: 'Kéo các điểm và tay nắm · Nhấp đúp điểm để đổi Cong/Góc · Nhấp đúp bất kỳ vị trí nào trên lưới để thêm điểm',
    shapeSettings: 'Thiết lập hình dạng', twist: 'Độ xoắn', resolution: 'Độ phân giải', count: 'Số lượng', depth: 'Độ sâu',
    shapes: { circle: 'Tròn', polygon: 'Đa giác', wave: 'Sóng', star: 'Ngôi sao' },
    profileLabels: { Cylinder: 'Trụ', Cone: 'Nón', Tulip: 'Tulip', Vintage: 'Cổ điển', Bowl: 'Bát' },
    style: 'Kiểu hiển thị', smooth: 'Mượt', lowPoly: 'Low Poly / Hình học', simulation: 'Mô phỏng', lamp: 'Mô phỏng đèn', simulationHint: 'Xem trước cùng đèn và đế',
    color: 'Màu sắc', download: 'Tải STL', footer: 'Tulip Creator', licenses: 'Giấy phép', close: 'Đóng', soon: 'Sắp ra mắt', login: 'Đăng nhập', register: 'Đăng ký', language: 'Ngôn ngữ', academy: 'Học viện',
    licenseTitle: 'Giấy phép và thư viện CAD bên thứ ba', licenseLead: 'FormaForge dùng quy trình CAD phía trình duyệt để tạo hình học tham số và STL.',
    licenseThree: 'Three.js + React Three Fiber', licenseThreeText: 'Thư viện render và tương tác giấy phép MIT dùng cho preview trực tiếp.',
    licenseStl: 'Three.js STLExporter', licenseStlText: 'Bộ xuất giấy phép MIT tạo STL ASCII trực tiếp trong trình duyệt.',
    licenseNote: 'Trang này tạo hình học cục bộ. Không có model hay dữ liệu thiết kế nào được tải lên.', showMesh: 'Hiện lưới', viewMesh: 'Ẩn lưới', exportFailed: 'Không thể xuất file',
  },
};

const LOGO_COPY: Record<'en' | 'es' | 'vi', LogoCopy> = {
  en: { logo: 'Logo on shade', importLogo: 'Import logo', logoHint: 'Optional logo for this shade. It appears in preview and is exported as raised relief in the shade STL.', chooseFile: 'PNG, JPG, WebP or SVG', replaceLogo: 'Replace logo', removeLogo: 'Remove logo', useLogo: 'Show logo', logoWidth: 'Logo width', logoHeight: 'Logo height', logoDepth: 'Relief depth', logoPosition: 'Vertical position', logoInvalid: 'Could not read this image.' },
  es: { logo: 'Logo en la tulipa', importLogo: 'Importar logo', logoHint: 'Logo opcional para esta tulipa. Se muestra en la vista previa y se exporta como relieve en el STL.', chooseFile: 'PNG, JPG, WebP o SVG', replaceLogo: 'Reemplazar logo', removeLogo: 'Eliminar logo', useLogo: 'Mostrar logo', logoWidth: 'Ancho del logo', logoHeight: 'Alto del logo', logoDepth: 'Profundidad del relieve', logoPosition: 'Posición vertical', logoInvalid: 'No se pudo leer esta imagen.' },
  vi: { logo: 'Logo trên chao đèn', importLogo: 'Import logo', logoHint: 'Tùy chọn logo cho chao đèn. Logo hiện trong preview và được xuất nổi trong STL chao.', chooseFile: 'PNG, JPG, WebP hoặc SVG', replaceLogo: 'Đổi logo', removeLogo: 'Xóa logo', useLogo: 'Hiện logo', logoWidth: 'Chiều rộng logo', logoHeight: 'Chiều cao logo', logoDepth: 'Độ nổi logo', logoPosition: 'Vị trí dọc', logoInvalid: 'Không đọc được ảnh logo này.' },
};

function getTulipCopy(language: Language) {
  return { ...COPY[language], ...LOGO_COPY[language] } as typeof COPY.en;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function positiveModulo(value: number, modulo: number) {
  return ((value % modulo) + modulo) % modulo;
}

function shapeRadius(radius: number, angle: number, shape: TulipShape, waves: number, amplitude: number) {
  if (shape === 'circle') return radius;
  if (shape === 'polygon') {
    const sideCount = Math.max(3, waves);
    const sector = Math.PI * 2 / sideCount;
    const localAngle = positiveModulo(angle, sector) - sector / 2;
    return radius * Math.cos(Math.PI / sideCount) / Math.cos(localAngle);
  }
  if (shape === 'star') {
    const sector = Math.PI * 2 / Math.max(3, waves);
    const localDistance = Math.abs(positiveModulo(angle, sector) - sector / 2) / (sector / 2);
    return radius + amplitude * localDistance;
  }
  return radius + amplitude * Math.cos(waves * angle);
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

function getAdvancedRadius(points: ProfilePoint[], maxRadius: number, normalizedHeight: number) {
  const sorted = [...points].sort((a, b) => a.y - b.y);
  if (sorted.length === 0) return 0;
  const y = clamp(normalizedHeight, 0, 1);
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

function getDefaultRadius(config: TulipConfig, normalizedHeight: number) {
  const t = clamp(normalizedHeight, 0, 1);
  const middle = clamp(config.midHeight, .01, .99);
  const bottomWeight = ((t - middle) * (t - 1)) / ((0 - middle) * -1);
  const middleWeight = (t * (t - 1)) / (middle * (middle - 1));
  const topWeight = (t * (t - middle)) / (1 * (1 - middle));
  return Math.max(0, config.radiusBottom * bottomWeight + config.radiusMid * middleWeight + config.radiusTop * topWeight);
}

export function getTulipSurfaceRadius(config: TulipConfig, normalizedHeight: number) {
  const progress = clamp(normalizedHeight, 0, 1);
  const baseRadius = config.useAdvancedMode ? getAdvancedRadius(config.profilePoints, config.maxRadius, progress) : getDefaultRadius(config, progress);
  return Math.max(2, shapeRadius(baseRadius, 0, config.shapeType, config.waves, config.amplitude));
}

function createTulipGeometry(config: TulipConfig) {
  const verticalLayers = 200;
  const segments = clamp(Math.round(config.segments), 3, 300);
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const radiusAt = (t: number) => config.useAdvancedMode ? getAdvancedRadius(config.profilePoints, config.maxRadius, t) : getDefaultRadius(config, t);
  const twistAt = (t: number) => THREE.MathUtils.degToRad(config.twist) * t;

  for (let layer = 0; layer <= verticalLayers; layer += 1) {
    const t = layer / verticalLayers;
    const y = t * config.height;
    const baseRadius = radiusAt(t);
    const twist = twistAt(t);
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = segment / segments * Math.PI * 2;
      const radius = shapeRadius(baseRadius, angle, config.shapeType, config.waves, config.amplitude);
      const rotatedAngle = angle + twist;
      vertices.push(radius * Math.cos(rotatedAngle), y, radius * Math.sin(rotatedAngle));
      uvs.push(segment / segments, t);
    }
  }

  for (let layer = 0; layer < verticalLayers; layer += 1) {
    const rowSize = segments + 1;
    const row = layer * rowSize;
    const nextRow = (layer + 1) * rowSize;
    for (let segment = 0; segment < segments; segment += 1) {
      const current = row + segment;
      const next = current + 1;
      const above = nextRow + segment;
      const aboveNext = above + 1;
      indices.push(current, next, aboveNext, aboveNext, above, current);
    }
  }

  const holeRadius = Math.max(0, config.holeDiameter / 2);
  if (holeRadius > 0) {
    const holeOffset = vertices.length / 3;
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = segment / segments * Math.PI * 2;
      vertices.push(holeRadius * Math.cos(angle), 0, holeRadius * Math.sin(angle));
      uvs.push(segment / segments, 0);
    }
    for (let segment = 0; segment < segments; segment += 1) {
      const body = segment;
      const bodyNext = segment + 1;
      const hole = holeOffset + segment;
      const holeNext = hole + 1;
      indices.push(hole, bodyNext, body, hole, holeNext, bodyNext);
    }
  } else {
    const centerOffset = vertices.length / 3;
    vertices.push(0, 0, 0);
    uvs.push(.5, 0);
    for (let segment = 0; segment < segments; segment += 1) {
      indices.push(centerOffset, segment + 1, segment);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  if (config.renderStyle === 'low-poly') {
    const faceted = geometry.toNonIndexed();
    faceted.computeVertexNormals();
    geometry.dispose();
    return faceted;
  }
  return geometry;
}

function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'model/stl' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function RangeControl({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }) {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return <label className="tulip-range"><span><span>{label}</span><strong>{formatted}{unit}</strong></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function profilePath(points: ProfilePoint[]) {
  const sorted = [...points].sort((a, b) => a.y - b.y);
  if (sorted.length === 0) return '';
  let path = `M ${sorted[0].x * 100} ${(1 - sorted[0].y) * 100}`;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    const endPoint = { x: end.x * 100, y: (1 - end.y) * 100 };
    if (start.type === 'corner' && end.type === 'corner') {
      path += ` L ${endPoint.x} ${endPoint.y}`;
      continue;
    }
    const out = start.handleOut ?? { x: start.x, y: start.y + (end.y - start.y) * .33 };
    const inside = end.handleIn ?? { x: end.x, y: end.y - (end.y - start.y) * .33 };
    path += ` C ${out.x * 100} ${(1 - out.y) * 100}, ${inside.x * 100} ${(1 - inside.y) * 100}, ${endPoint.x} ${endPoint.y}`;
  }
  return path;
}

function profileAreaPath(points: ProfilePoint[]) {
  const sorted = [...points].sort((a, b) => a.y - b.y);
  if (sorted.length === 0) return '';
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return `${profilePath(points)} L 0 ${(1 - last.y) * 100} L 0 ${(1 - first.y) * 100} Z`;
}

function profileXAt(points: ProfilePoint[], y: number) {
  const sorted = [...points].sort((a, b) => a.y - b.y);
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0].x;
  if (y <= sorted[0].y) return sorted[0].x;
  if (y >= sorted[sorted.length - 1].y) return sorted[sorted.length - 1].x;
  let segmentIndex = sorted.length - 2;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    if (y <= sorted[index + 1].y) {
      segmentIndex = index;
      break;
    }
  }
  const start = sorted[segmentIndex];
  const end = sorted[segmentIndex + 1];
  const span = Math.max(.0001, end.y - start.y);
  const linearT = clamp((y - start.y) / span, 0, 1);
  if (start.type === 'corner' && end.type === 'corner') return start.x + (end.x - start.x) * linearT;
  const out = start.handleOut ?? { x: start.x, y: start.y + span * .33 };
  const inside = end.handleIn ?? { x: end.x, y: end.y - span * .33 };
  const parameter = solveCubicParameter(start.y, out.y, inside.y, end.y, y);
  return cubicValue(start.x, out.x, inside.x, end.x, parameter);
}

function createSmoothPoint(points: ProfilePoint[], x: number, y: number, ignoredIndex = -1): ProfilePoint {
  const neighbors = points.filter((_, index) => index !== ignoredIndex).sort((a, b) => a.y - b.y);
  const previous = [...neighbors].reverse().find((point) => point.y < y) ?? neighbors[0] ?? { x, y };
  const next = neighbors.find((point) => point.y > y) ?? neighbors[neighbors.length - 1] ?? { x, y };
  const span = Math.max(.08, next.y - previous.y);
  const slope = next.y - previous.y > .0001 ? (next.x - previous.x) / (next.y - previous.y) : 0;
  const handleLength = Math.min(.16, Math.max(.06, span * .28));
  return {
    x,
    y,
    type: 'smooth',
    handleIn: { x: clamp(x - slope * handleLength, 0, 1.08), y: clamp(y - handleLength, 0, 1) },
    handleOut: { x: clamp(x + slope * handleLength, 0, 1.08), y: clamp(y + handleLength, 0, 1) },
  };
}

function profileSamples(points: ProfilePoint[], sampleCount = 20) {
  if (points.length < 2) return points.map((point) => ({ x: point.x, y: point.y }));
  return Array.from({ length: sampleCount }, (_, sampleIndex) => {
    const y = sampleIndex / (sampleCount - 1);
    return { x: clamp(profileXAt(points, y), 0, 1.08), y };
  });
}

function ProfileEditor({ points, maxRadius, onChange, copy }: { points: ProfilePoint[]; maxRadius: number; onChange: (points: ProfilePoint[]) => void; copy: typeof COPY.en }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ index: number; handle: 'point' | 'in' | 'out' } | null>(null);

  useEffect(() => {
    if (dragging === null) return undefined;
    const handleMove = (event: PointerEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = clamp((event.clientX - rect.left) / rect.width, 0, 1.08);
      const y = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
      onChange(points.map((point, index) => {
        if (index !== dragging.index) return point;
        if (dragging.handle === 'point') {
          const deltaX = x - point.x;
          const deltaY = y - point.y;
          return {
            ...point,
            x,
            y,
            handleIn: point.handleIn ? { x: clamp(point.handleIn.x + deltaX, 0, 1.08), y: clamp(point.handleIn.y + deltaY, 0, 1) } : undefined,
            handleOut: point.handleOut ? { x: clamp(point.handleOut.x + deltaX, 0, 1.08), y: clamp(point.handleOut.y + deltaY, 0, 1) } : undefined,
          };
        }
        return { ...point, [dragging.handle === 'in' ? 'handleIn' : 'handleOut']: { x, y } };
      }));
    };
    const stopDragging = () => setDragging(null);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stopDragging);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stopDragging);
    };
  }, [dragging, onChange, points]);

  const togglePointType = (index: number) => {
    onChange(points.map((point, pointIndex) => {
      if (pointIndex !== index) return point;
      if (point.type === 'smooth') return { x: point.x, y: point.y, type: 'corner' };
      return createSmoothPoint(points, point.x, point.y, index);
    }));
  };

  const addPointAt = (x: number, y: number) => {
    if (points.length >= 24) return;
    onChange([...points, createSmoothPoint(points, clamp(x, 0, 1.08), clamp(y, 0, 1))]);
  };

  const addPointBetween = () => {
    if (points.length >= 24) return;
    const sortedPoints = [...points].sort((a, b) => a.y - b.y);
    if (sortedPoints.length < 2) {
      addPointAt(.72, .5);
      return;
    }
    let largestGap = -1;
    let gapIndex = 0;
    for (let index = 0; index < sortedPoints.length - 1; index += 1) {
      const gap = sortedPoints[index + 1].y - sortedPoints[index].y;
      if (gap > largestGap) {
        largestGap = gap;
        gapIndex = index;
      }
    }
    const y = (sortedPoints[gapIndex].y + sortedPoints[gapIndex + 1].y) / 2;
    addPointAt(profileXAt(points, y), y);
  };

  const addPoint = (event: MouseEvent<SVGSVGElement>) => {
    const target = event.target as Element;
    if (target.closest('circle')) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    addPointAt((event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height);
  };

  const sorted = points.map((point, index) => ({ point, index })).sort((a, b) => a.point.y - b.point.y);
  return <div className="tulip-profile-editor">
    <div className="tulip-profile-editor-toolbar"><strong>{copy.vertical}</strong><button type="button" className="tulip-add-point" onClick={addPointBetween} disabled={points.length >= 24}><Plus size={13} />{copy.addPoint}</button></div>
    <div className="tulip-profile-axis"><span>Height ↑</span><span>Radius →</span></div>
    <svg ref={svgRef} viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${copy.vertical}, ${maxRadius}mm`} onDoubleClick={addPoint}>
      <defs><pattern id="tulip-profile-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="currentColor" strokeOpacity=".12" /></pattern></defs>
      <rect width="100" height="100" fill="url(#tulip-profile-grid)" />
      <line x1="0" y1="0" x2="0" y2="100" stroke="#ffcf25" strokeOpacity=".52" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <line x1="0" y1="100" x2="100" y2="100" stroke="currentColor" strokeOpacity=".35" />
      <path d={profileAreaPath(points)} fill="#ffcf25" fillOpacity=".16" stroke="none" />
      <path d={profilePath(points)} fill="none" stroke="#ffcf25" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
      {profileSamples(points).map((sample, sampleIndex) => {
        const x = sample.x * 100;
        const y = (1 - sample.y) * 100;
        return <rect key={`sample-${sampleIndex}`} className="tulip-profile-sample" x={x - 1.6} y={y - 1.6} width="3.2" height="3.2" rx=".35" transform={`rotate(45 ${x} ${y})`} fill="#fbbf24" pointerEvents="none" />;
      })}
      {sorted.map(({ point, index: pointIndex }) => {
        const x = point.x * 100;
        const y = (1 - point.y) * 100;
        const inHandle = point.handleIn;
        const outHandle = point.handleOut;
        return <g key={`${point.x}-${point.y}-${pointIndex}`}>
          {point.type === 'smooth' && inHandle && <line x1={x} y1={y} x2={inHandle.x * 100} y2={(1 - inHandle.y) * 100} stroke="#64748b" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
          {point.type === 'smooth' && outHandle && <line x1={x} y1={y} x2={outHandle.x * 100} y2={(1 - outHandle.y) * 100} stroke="#64748b" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
          {point.type === 'smooth' && inHandle && <circle cx={inHandle.x * 100} cy={(1 - inHandle.y) * 100} r="1.4" fill="#94a3b8" onPointerDown={(event) => { event.stopPropagation(); setDragging({ index: pointIndex, handle: 'in' }); }} />}
          {point.type === 'smooth' && outHandle && <circle cx={outHandle.x * 100} cy={(1 - outHandle.y) * 100} r="1.4" fill="#94a3b8" onPointerDown={(event) => { event.stopPropagation(); setDragging({ index: pointIndex, handle: 'out' }); }} />}
          <circle cx={x} cy={y} r={point.type === 'smooth' ? 3 : 3.5} fill={point.type === 'smooth' ? '#ec4899' : '#fbbf24'} stroke="#0d1528" strokeWidth="1.3" vectorEffect="non-scaling-stroke" aria-label={`Profile point ${pointIndex + 1}`} onPointerDown={(event) => { event.stopPropagation(); setDragging({ index: pointIndex, handle: 'point' }); }} onDoubleClick={(event) => { event.stopPropagation(); togglePointType(pointIndex); }} />
        </g>;
      })}
    </svg>
    <div className="tulip-profile-scale"><span>0mm</span><span>{copy.maxRadius} {maxRadius}mm</span></div>
  </div>;
}

function ShapeButton({ shape, active, label, onClick }: { shape: TulipShape; active: boolean; label: string; onClick: () => void }) {
  const Icon = shape === 'circle' ? Circle : shape === 'polygon' ? Hexagon : shape === 'wave' ? Waves : Flower2;
  return <button type="button" className={`tulip-shape-button ${active ? 'active' : ''}`} onClick={onClick}><Icon size={21} /><span>{label}</span></button>;
}

function TulipMesh({ config, showMesh }: { config: TulipConfig; showMesh: boolean }) {
  const geometry = useMemo(() => createTulipGeometry(config), [config]);
  const logoProgress = clamp(config.logo?.position ?? .55, .1, .9);
  const logoPosition: [number, number, number] = [0, config.height * logoProgress, getTulipSurfaceRadius(config, logoProgress) + 1];
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group>
    <mesh geometry={geometry} castShadow receiveShadow>
      {config.showSimulation ? <meshPhysicalMaterial color={config.color} roughness={.55} metalness={0} transmission={.35} thickness={2.5} ior={1.5} attenuationColor="#ffccaa" attenuationDistance={80} emissive="#ff9f38" emissiveIntensity={.65} side={THREE.DoubleSide} flatShading={config.renderStyle === 'low-poly'} customProgramCacheKey={() => `${config.showSimulation}-${config.color}`} onBeforeCompile={(shader) => {
        shader.uniforms.uTulipBulb = { value: new THREE.Vector3(0, 30, 0) };
        shader.uniforms.uTulipCore = { value: new THREE.Color('#fff8db') };
        shader.uniforms.uTulipMid = { value: new THREE.Color('#ffaa44') };
        shader.uniforms.uTulipEdge = { value: new THREE.Color('#cc4400') };
        shader.uniforms.uTulipBase = { value: new THREE.Color(config.color) };
        shader.vertexShader = `varying vec3 vTulipLocal;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTulipLocal = transformed;');
        shader.fragmentShader = `uniform vec3 uTulipBulb; uniform vec3 uTulipCore; uniform vec3 uTulipMid; uniform vec3 uTulipEdge; uniform vec3 uTulipBase; varying vec3 vTulipLocal;\n${shader.fragmentShader}`.replace('#include <emissive_fragment>', `#include <emissive_fragment>
          float tulipDistance = distance(vTulipLocal, uTulipBulb);
          float tulipCore = smoothstep(45.0, 0.0, tulipDistance);
          float tulipFill = 1.0 - pow(clamp(tulipDistance / 180.0, 0.0, 1.0), 0.8);
          vec3 tulipGlow = mix(uTulipBase, uTulipEdge, 0.4);
          tulipGlow = mix(tulipGlow, uTulipMid, tulipFill);
          tulipGlow = mix(tulipGlow, uTulipCore, tulipCore);
          totalEmissiveRadiance += tulipGlow * (2.3 + tulipFill * 4.0 + tulipCore * 12.0);`);
      }} /> : <meshStandardMaterial color={config.color} roughness={.58} metalness={.1} side={THREE.DoubleSide} flatShading={config.renderStyle === 'low-poly'} />}
      {config.logo?.enabled && <Suspense fallback={null}><LampLogoDecal logo={config.logo} position={logoPosition} /></Suspense>}
    </mesh>
    {config.showSimulation && <mesh position={[0, 30, 0]} renderOrder={2}><sphereGeometry args={[20, 32, 20]} /><meshBasicMaterial color="#fff0b5" transparent opacity={.16} depthTest={false} depthWrite={false} /></mesh>}
    {showMesh && <mesh geometry={geometry}><meshBasicMaterial color="#ffffff" wireframe transparent opacity={.12} /></mesh>}
  </group>;
}

function LampSimulation({ holeDiameter }: { holeDiameter: number }) {
  return <group position={[0, -60, 0]}>
    <mesh position={[0, 2, 0]} castShadow receiveShadow><cylinderGeometry args={[45, 45, 4, 64]} /><meshStandardMaterial color="#111111" roughness={.9} /></mesh>
    {[0, 120, 240].map((angle) => <mesh key={angle} position={[35 * Math.cos(angle * Math.PI / 180), 0, 35 * Math.sin(angle * Math.PI / 180)]}><sphereGeometry args={[2.5, 16, 16]} /><meshStandardMaterial color="#111111" /></mesh>)}
    <mesh position={[0, 60, 0]} castShadow receiveShadow><cylinderGeometry args={[2.5, 2.5, 120, 16]} /><meshStandardMaterial color="#111111" roughness={.9} /></mesh>
    <group position={[0, 120, 0]}>
      <mesh position={[0, 5, 0]}><cylinderGeometry args={[Math.max(1, holeDiameter / 2 - 1), Math.max(1, holeDiameter / 2 - 1), 10, 32]} /><meshStandardMaterial color="#222222" roughness={.9} /></mesh>
      <mesh position={[0, 30, 0]}><sphereGeometry args={[10, 32, 32]} /><meshStandardMaterial color="#fff4cf" emissive="#fff4cf" emissiveIntensity={8} toneMapped={false} /></mesh>
      <mesh position={[0, 15, 0]}><cylinderGeometry args={[5, 8, 15, 32]} /><meshStandardMaterial color="#444444" metalness={.8} roughness={.2} /></mesh>
      <pointLight position={[0, 30, 0]} intensity={8000} distance={800} decay={1.5} color="#ffaa00" castShadow />
      <pointLight position={[0, 30, 0]} intensity={3000} distance={200} decay={1} color="#ff8800" />
    </group>
  </group>;
}

function TulipScene({ config, bodyConfig = DEFAULT_LAMP_BODY_CONFIG, showMesh }: { config: TulipConfig; bodyConfig?: LampBodyConfig; showMesh: boolean }) {
  const bodyHeight = bodyConfig.baseHeight + bodyConfig.height + bodyConfig.neckHeight;
  // The shade sits on the top of the preview socket instead of floating above
  // it. This makes the adjustable flat seat read as a real connection.
  const shadeOffset = bodyHeight + 12;
  const assemblyHeight = shadeOffset + config.height;
  return <>
    <color attach="background" args={['#050918']} />
    <PerspectiveCamera makeDefault position={[430, 350, 560]} fov={45} near={.1} far={5000} />
    <OrbitControls makeDefault target={[0, assemblyHeight * .48, 0]} minPolarAngle={0} maxPolarAngle={Math.PI / 1.5} enablePan enableDamping dampingFactor={.1} minDistance={170} maxDistance={1200} />
    <ambientLight intensity={config.showSimulation ? .2 : .5} />
    <hemisphereLight args={['#d9eaff', '#101521', .48]} />
    {!config.showSimulation && <pointLight position={[0, bodyHeight + 48, 0]} color="#ffffff" intensity={2} />}
    <directionalLight position={[180, 360, 220]} intensity={config.showSimulation ? .55 : 1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0001} shadow-normalBias={.04} />
    {config.showSimulation && !bodyConfig.showSimulation && <pointLight position={[0, bodyHeight + 48, 0]} color="#ffaa00" intensity={900} distance={800} decay={1.5} />}
    <Environment resolution={64} background={false} environmentIntensity={config.showSimulation ? .25 : 1}>
      <Lightformer form="rect" intensity={2.5} position={[0, 420, 320]} scale={[600, 600, 1]} target={[0, assemblyHeight * .45, 0]} />
      <Lightformer form="rect" intensity={1.2} position={[420, 320, 220]} scale={[320, 320, 1]} target={[0, assemblyHeight * .45, 0]} />
      <Lightformer form="rect" intensity={.7} position={[-420, 220, 140]} scale={[320, 320, 1]} target={[0, assemblyHeight * .45, 0]} />
    </Environment>
    <LampBodyModel config={bodyConfig} showSimulation={bodyConfig.showSimulation} showMesh={showMesh} />
    <group position={[0, shadeOffset, 0]}><TulipMesh config={config} showMesh={showMesh} /></group>
    <Grid sectionSize={100} cellSize={20} infiniteGrid position={[0, -.1, 0]} fadeDistance={Math.max(3000, assemblyHeight * 10)} fadeStrength={1} />
  </>;
}

function ProfilePanel({ config, update, copy }: { config: TulipConfig; update: (patch: Partial<TulipConfig>) => void; copy: typeof COPY.en }) {
  return <div className="tulip-panel-content">
    <h3>{copy.mounting}</h3>
    <div className="tulip-control-card">
      <RangeControl label={copy.hole} value={config.holeDiameter} min={0} max={60} unit=" mm" onChange={(holeDiameter) => update({ holeDiameter })} />
      <div className="tulip-preset-row"><button type="button" className={config.holeDiameter === 28 ? 'active' : ''} onClick={() => update({ holeDiameter: 28 })}>E14 (28mm)</button><button type="button" className={config.holeDiameter === 42 ? 'active' : ''} onClick={() => update({ holeDiameter: 42 })}>E27 (42mm)</button></div>
    </div>
    <h3 className="tulip-section-spaced">{copy.dimensions}</h3>
    <label className="tulip-toggle-row"><span>{copy.advanced}</span><input type="checkbox" checked={config.useAdvancedMode} onChange={(event) => update({ useAdvancedMode: event.target.checked })} /><i /></label>
    <div className="tulip-profile-fields">
      <RangeControl label={copy.height} value={config.height} min={20} max={300} unit=" mm" onChange={(height) => update({ height })} />
      {config.useAdvancedMode ? <>
        <RangeControl label={copy.maxRadius} value={config.maxRadius} min={20} max={150} unit=" mm" onChange={(maxRadius) => update({ maxRadius })} />
        <div className="tulip-vertical-profile"><strong>{copy.vertical}</strong><div className="tulip-profile-presets">{PROFILE_PRESETS.map((preset) => <button type="button" key={preset.name} onClick={() => update({ profilePoints: preset.points.map((point) => ({ ...point })) })}>{copy.profileLabels[preset.name as keyof typeof copy.profileLabels]}</button>)}</div><ProfileEditor points={config.profilePoints} maxRadius={config.maxRadius} onChange={(profilePoints) => update({ profilePoints })} copy={copy} /><p className="tulip-help">{copy.dragHint}</p></div>
      </> : <>
        <RangeControl label={copy.topOpening} value={config.radiusTop} min={0} max={150} unit=" mm" onChange={(radiusTop) => update({ radiusTop })} />
        <RangeControl label={copy.middle} value={config.radiusMid} min={10} max={150} unit=" mm" onChange={(radiusMid) => update({ radiusMid })} />
        <RangeControl label={copy.maxBottom} value={config.radiusBottom} min={config.holeDiameter + 5} max={150} unit=" mm" onChange={(radiusBottom) => update({ radiusBottom })} />
        <RangeControl label={copy.middlePos} value={config.midHeight * 100} min={10} max={90} unit="%" onChange={(middlePos) => update({ midHeight: middlePos / 100 })} />
      </>}
    </div>
  </div>;
}

function ShapePanel({ config, update, copy }: { config: TulipConfig; update: (patch: Partial<TulipConfig>) => void; copy: typeof COPY.en }) {
  return <div className="tulip-panel-content"><h3>{copy.shapeSettings}</h3><div className="tulip-shape-grid">
    <ShapeButton shape="circle" label={copy.shapes.circle} active={config.shapeType === 'circle'} onClick={() => update({ shapeType: 'circle' })} />
    <ShapeButton shape="polygon" label={copy.shapes.polygon} active={config.shapeType === 'polygon'} onClick={() => update({ shapeType: 'polygon' })} />
    <ShapeButton shape="wave" label={copy.shapes.wave} active={config.shapeType === 'wave'} onClick={() => update({ shapeType: 'wave' })} />
    <ShapeButton shape="star" label={copy.shapes.star} active={config.shapeType === 'star'} onClick={() => update({ shapeType: 'star' })} />
  </div>{config.shapeType !== 'circle' && <div className="tulip-profile-fields"><RangeControl label={copy.count} value={config.waves} min={3} max={config.shapeType === 'polygon' ? 12 : 64} onChange={(waves) => update({ waves })} />{config.shapeType !== 'polygon' && <RangeControl label={copy.depth} value={config.amplitude} min={0} max={20} step={.5} unit=" mm" onChange={(amplitude) => update({ amplitude })} />}</div>}<div className="tulip-divider" /><RangeControl label={copy.twist} value={config.twist} min={0} max={720} step={5} unit="°" onChange={(twist) => update({ twist })} /><RangeControl label={copy.resolution} value={config.segments} min={3} max={300} onChange={(segments) => update({ segments })} /></div>;
}

function SettingsPanel({ config, update, copy }: { config: TulipConfig; update: (patch: Partial<TulipConfig>) => void; copy: typeof COPY.en }) {
  return <div className="tulip-panel-content"><h3>{copy.style}</h3><div className="tulip-style-row"><button type="button" className={config.renderStyle === 'smooth' ? 'active' : ''} onClick={() => update({ renderStyle: 'smooth' })}>{copy.smooth}</button><button type="button" className={config.renderStyle === 'low-poly' ? 'active' : ''} onClick={() => update({ renderStyle: 'low-poly' })}>{copy.lowPoly}</button></div><div className="tulip-divider" /><h3>{copy.simulation}</h3><label className="tulip-toggle-row"><span><strong>{copy.lamp}</strong><small>{copy.simulationHint}</small></span><input type="checkbox" checked={config.showSimulation} onChange={(event) => update({ showSimulation: event.target.checked })} /><i /></label><div className="tulip-divider" /><label className="tulip-color-label">{copy.color}</label><div className="tulip-colors">{COLOR_PRESETS.map((color) => <button type="button" key={color} className={config.color.toLowerCase() === color ? 'active' : ''} style={{ background: color }} aria-label={`Select color ${color}`} onClick={() => update({ color })}>{config.color.toLowerCase() === color && <Check size={13} />}</button>)}</div><label className="tulip-color-input"><input type="color" value={config.color} onChange={(event) => update({ color: event.target.value })} /><code>{config.color}</code></label><LogoControls logo={config.logo} copy={copy} onChange={(logo) => update({ logo })} /></div>;
}

function ExportPanel({ onExport, copy, exportError }: { onExport: () => void; copy: typeof COPY.en; exportError: string }) {
  return <div className="tulip-panel-content"><h3>{copy.tabs.export}</h3><button type="button" className="tulip-export-button" onClick={onExport}><Download size={40} /><span>{copy.download}</span></button>{exportError && <p className="tulip-export-error" role="alert">{exportError}</p>}</div>;
}

function LicenseDialog({ language, onClose }: { language: Language; onClose: () => void }) {
  const copy = getTulipCopy(language);
  return <div className="tulip-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="tulip-license-modal" role="dialog" aria-modal="true" aria-labelledby="tulip-license-title"><header><h2 id="tulip-license-title">{copy.licenseTitle}</h2><button type="button" aria-label={copy.close} onClick={onClose}><X size={18} /></button></header><p>{copy.licenseLead}</p><h3>{copy.licenseThree}</h3><p>{copy.licenseThreeText}</p><h3>{copy.licenseStl}</h3><p>{copy.licenseStlText}</p><div className="tulip-license-note"><Info size={15} />{copy.licenseNote}</div><button type="button" className="tulip-modal-close" onClick={onClose}>{copy.close}</button></section></div>;
}

function TulipHeader({ language, onLicenses }: { language: Language; onLicenses: () => void; onLanguage?: (language: Language) => void }) {
  const copy = getTulipCopy(language);
  return <header className="tulip-header"><Link to="/" className="tulip-brand"><span className="tulip-brand-mark">✦</span><strong>FormaForge</strong></Link><div className="tulip-header-center"><a className="tulip-academy" href="#/academy"><GraduationCap size={14} /><span>{copy.academy}</span><small>{copy.soon}</small></a><span className="tulip-header-muted">{copy.title}</span></div><div className="tulip-header-actions"><Link to="/account">{copy.login}</Link><Link to="/account?mode=register" className="tulip-register">{copy.register}</Link><a href="https://www.instagram.com/shaperlab.es" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={17} /></a><button type="button" onClick={onLicenses}>{copy.licenses}</button><span className="tulip-language" aria-label={copy.language}><span className={language === 'en' ? 'active' : ''}>EN</span><i>/</i><span className={language === 'vi' ? 'active' : ''}>VI</span></span></div></header>;
}

type TulipPart = 'shade' | 'body';

function TulipCombinedWorkspace({ language, copy, bodyCopy, config, bodyConfig, part, tab, bodyTab, showMesh, exportError, bodyExportState, onPart, onTab, onBodyTab, onShadeUpdate, onBodyUpdate, onShadeExport, onBodyExport, onLicenses, onMesh }: { language: Language; copy: typeof COPY.en; bodyCopy: LampBodyCopy; config: TulipConfig; bodyConfig: LampBodyConfig; part: TulipPart; tab: TulipTab; bodyTab: BodyTab; showMesh: boolean; exportError: string; bodyExportState: 'idle' | 'done' | 'error'; onPart: (part: TulipPart) => void; onTab: (tab: TulipTab) => void; onBodyTab: (tab: BodyTab) => void; onShadeUpdate: (patch: Partial<TulipConfig>) => void; onBodyUpdate: LampBodyUpdate; onShadeExport: () => void; onBodyExport: () => void; onLicenses: () => void; onMesh: () => void }) {
  const [combinedLicensesOpen, setCombinedLicensesOpen] = useState(false);
  const openLicenses = () => { onLicenses(); setCombinedLicensesOpen(true); };
  const tabs: Array<{ id: TulipTab; label: string; icon: typeof Sparkles }> = [
    { id: 'general', label: copy.tabs.general, icon: Sparkles },
    { id: 'shape', label: copy.tabs.shape, icon: Waves },
    { id: 'settings', label: copy.tabs.settings, icon: Info },
    { id: 'export', label: copy.tabs.export, icon: Download },
  ];
  const bodyTabs: Array<{ id: BodyTab; label: string; icon: typeof Sparkles }> = [
    { id: 'body', label: bodyCopy.tabs.body, icon: Box },
    { id: 'profile', label: bodyCopy.tabs.profile, icon: Waves },
    { id: 'shape', label: bodyCopy.tabs.shape, icon: Flower2 },
    { id: 'base', label: bodyCopy.tabs.base, icon: Layers3 },
    { id: 'finish', label: bodyCopy.tabs.finish, icon: Settings2 },
    { id: 'export', label: bodyCopy.tabs.export, icon: Download },
  ];
  const bodyHeight = bodyConfig.baseHeight + bodyConfig.height + bodyConfig.neckHeight;
  const assemblyHeight = bodyHeight + 12 + config.height;
  return <main className="tulip-page"><TulipHeader language={language} onLicenses={onLicenses} /><div className="tulip-workspace"><aside className="tulip-sidebar"><div className="tulip-sidebar-title"><span className="tulip-kicker"><Lightbulb size={15} /> 3D WORKSPACE</span><h1>{part === 'shade' ? copy.title : bodyCopy.title}</h1><p>{part === 'shade' ? copy.subtitle : bodyCopy.subtitle}</p><div className="tulip-part-switch" role="tablist" aria-label="Lamp components"><button type="button" className={part === 'shade' ? 'active' : ''} role="tab" aria-selected={part === 'shade'} onClick={() => onPart('shade')}><Sparkles size={14} />{copy.title}</button><button type="button" className={part === 'body' ? 'active' : ''} role="tab" aria-selected={part === 'body'} onClick={() => onPart('body')}><Box size={14} />{bodyCopy.title}</button></div></div><nav className={`tulip-tabs${part === 'body' ? ' body-tabs' : ''}`} aria-label={part === 'shade' ? 'Tulip Creator sections' : 'Lamp Body Creator sections'}>{(part === 'shade' ? tabs : bodyTabs).map(({ id, label, icon: Icon }) => <button type="button" key={id} className={(part === 'shade' ? tab === id : bodyTab === id) ? 'active' : ''} aria-selected={part === 'shade' ? tab === id : bodyTab === id} onClick={() => part === 'shade' ? onTab(id as TulipTab) : onBodyTab(id as BodyTab)}><Icon size={18} /><span>{label}</span></button>)}</nav><div className="tulip-panel-scroll">{part === 'shade' ? <>{tab === 'general' && <ProfilePanel config={config} update={onShadeUpdate} copy={copy} />}{tab === 'shape' && <ShapePanel config={config} update={onShadeUpdate} copy={copy} />}{tab === 'settings' && <SettingsPanel config={config} update={onShadeUpdate} copy={copy} />}{tab === 'export' && <ExportPanel onExport={onShadeExport} copy={copy} exportError={exportError} />}</> : <LampBodyControls config={bodyConfig} tab={bodyTab} update={onBodyUpdate} copy={bodyCopy} onExport={onBodyExport} exportState={bodyExportState} />}</div><footer className="tulip-sidebar-footer"><span>v1.0.0 · {part === 'shade' ? copy.footer : bodyCopy.title}</span><span>{Math.round(assemblyHeight)}mm assembly</span></footer></aside><section className="tulip-viewport" aria-label="Tulip shade and lamp body 3D preview"><Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}><TulipScene config={config} bodyConfig={bodyConfig} showMesh={showMesh} /></Canvas><div className="tulip-viewport-badges"><button type="button" className={showMesh ? 'active' : ''} title={showMesh ? copy.viewMesh : copy.showMesh} aria-pressed={showMesh} onClick={onMesh}>#</button><span>H: {Math.round(assemblyHeight)}mm</span><span className="tulip-assembly-badge">{copy.title} + {bodyCopy.title}</span></div><div className="tulip-orbit-hint"><span>◈</span> Drag to orbit · Scroll to zoom</div></section></div></main>;
}

export function TulipCreatorPage() {
  const { language, setLanguage } = useI18n();
  const location = useLocation();
  const [config, setConfig] = useState<TulipConfig>(DEFAULT_CONFIG);
  const [bodyConfig, setBodyConfig] = useState<LampBodyConfig>(DEFAULT_LAMP_BODY_CONFIG);
  const [part, setPart] = useState<TulipPart>(() => location.pathname === '/admin/lamp-body-creator' ? 'body' : 'shade');
  const [bodyTab, setBodyTab] = useState<BodyTab>('profile');
  const [tab, setTab] = useState<TulipTab>('general');
  const [showMesh, setShowMesh] = useState(false);
  const [licensesOpen, setLicensesOpen] = useState(false);
  const [exportError, setExportError] = useState('');
  const [bodyExportState, setBodyExportState] = useState<'idle' | 'done' | 'error'>('idle');
  const copy = getTulipCopy(language);
  const bodyCopy = getLampBodyCopy(language);
  useEffect(() => { setPart(location.pathname === '/admin/lamp-body-creator' ? 'body' : 'shade'); }, [location.pathname]);
  const update = (patch: Partial<TulipConfig>) => setConfig((current) => ({ ...current, ...patch }));
  const updateBody: LampBodyUpdate = (key, value) => setBodyConfig((current) => ({ ...current, [key]: value }));
  const exportStl = () => {
    try {
      const geometry = createTulipGeometry(config);
      const mesh = new THREE.Mesh(geometry);
      const logoProgress = clamp(config.logo?.position ?? .55, .1, .9);
      const model = new THREE.Group();
      model.add(mesh);
      model.add(createLogoReliefGroup(config.logo, getTulipSurfaceRadius(config, logoProgress), config.height * logoProgress));
      model.rotation.x = Math.PI / 2;
      model.updateMatrixWorld(true);
      const output = new STLExporter().parse(model, { binary: false });
      geometry.dispose();
      downloadText(output, `formaforge-tulip-${Math.round(config.height)}mm.stl`);
      setExportError('');
    } catch (error) {
      console.error('Tulip STL export failed', error);
      setExportError(copy.exportFailed);
    }
  };

  const exportBodyStl = () => {
    const geometry = createLampBodyGeometry(bodyConfig);
    try {
      const mesh = new THREE.Mesh(geometry);
      const logoProgress = THREE.MathUtils.clamp(bodyConfig.logo?.position ?? .55, .1, .9);
      const model = new THREE.Group();
      model.add(mesh);
      model.add(createLogoReliefGroup(bodyConfig.logo, getLampBodySurfaceRadius(bodyConfig, logoProgress), bodyConfig.baseHeight + bodyConfig.height * logoProgress));
      model.updateMatrixWorld(true);
      const output = new STLExporter().parse(model, { binary: false });
      downloadText(output, `formaforge-lamp-body-${Math.round(bodyConfig.height)}mm.stl`);
      setBodyExportState('done');
    } catch (error) {
      console.error('Lamp body STL export failed', error);
      setBodyExportState('error');
    } finally {
      geometry.dispose();
    }
  };

  useEffect(() => { if (!licensesOpen) return undefined; const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setLicensesOpen(false); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [licensesOpen]);

  const tabs: Array<{ id: TulipTab; label: string; icon: typeof Sparkles }> = [
    { id: 'general', label: copy.tabs.general, icon: Sparkles },
    { id: 'shape', label: copy.tabs.shape, icon: Waves },
    { id: 'settings', label: copy.tabs.settings, icon: Info },
    { id: 'export', label: copy.tabs.export, icon: Download },
  ];
  return <TulipCombinedWorkspace language={language} copy={copy} bodyCopy={bodyCopy} config={config} bodyConfig={bodyConfig} part={part} tab={tab} bodyTab={bodyTab} showMesh={showMesh} exportError={exportError} bodyExportState={bodyExportState} onPart={setPart} onTab={setTab} onBodyTab={(nextTab) => { setBodyTab(nextTab); setBodyExportState('idle'); }} onShadeUpdate={update} onBodyUpdate={updateBody} onShadeExport={exportStl} onBodyExport={exportBodyStl} onLicenses={() => setLicensesOpen(true)} onMesh={() => setShowMesh((value) => !value)} />;
  return <main className="tulip-page"><TulipHeader language={language} onLanguage={setLanguage} onLicenses={() => setLicensesOpen(true)} /><div className="tulip-workspace"><aside className="tulip-sidebar"><div className="tulip-sidebar-title"><span className="tulip-kicker"><Lightbulb size={15} /> 3D WORKSPACE</span><h1>{copy.title}</h1><p>{copy.subtitle}</p></div><nav className="tulip-tabs" aria-label="Tulip Creator sections">{tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={tab === id ? 'active' : ''} aria-selected={tab === id} onClick={() => setTab(id)}><Icon size={18} /><span>{label}</span></button>)}</nav><div className="tulip-panel-scroll">{tab === 'general' && <ProfilePanel config={config} update={update} copy={copy} />}{tab === 'shape' && <ShapePanel config={config} update={update} copy={copy} />}{tab === 'settings' && <SettingsPanel config={config} update={update} copy={copy} />}{tab === 'export' && <ExportPanel onExport={exportStl} copy={copy} exportError={exportError} />}</div><footer className="tulip-sidebar-footer"><span>v1.0.0 • {copy.footer}</span></footer></aside><section className="tulip-viewport" aria-label="Tulip shade 3D preview"><Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}><TulipScene config={config} showMesh={showMesh} /></Canvas><div className="tulip-viewport-badges"><button type="button" className={showMesh ? 'active' : ''} title={showMesh ? copy.viewMesh : copy.showMesh} aria-pressed={showMesh} onClick={() => setShowMesh((value) => !value)}>#</button><span>H: {Math.round(config.height)}mm</span></div><div className="tulip-orbit-hint"><span>◈</span> Drag to orbit · Scroll to zoom</div></section></div>{licensesOpen && <LicenseDialog language={language} onClose={() => setLicensesOpen(false)} />}</main>;
}
