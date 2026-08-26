import { ArrowRight, Box, Check, Download, Info, Layers3, Lightbulb, Rotate3D, Settings2, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { Environment, Grid, Lightformer, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { useI18n, type Language } from '../../lib/i18n';
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
type RenderStyle = 'smooth' | 'low-poly';
export type BodyTab = 'body' | 'profile' | 'base' | 'finish' | 'export';

export type LampBodyConfig = {
  profile: BodyProfile;
  profileMode: BodyProfileMode;
  advancedProfilePoints: BodyProfilePoint[];
  advancedMaxRadius: number;
  height: number;
  bodyRadius: number;
  topRadius: number;
  baseRadius: number;
  baseHeight: number;
  neckRadius: number;
  neckHeight: number;
  wallThickness: number;
  socketDiameter: number;
  bottomHoleEnabled: boolean;
  bottomHoleDiameter: number;
  segments: number;
  renderStyle: RenderStyle;
  showSimulation: boolean;
  color: string;
};

export const DEFAULT_LAMP_BODY_CONFIG: LampBodyConfig = {
  profile: 'lampshade',
  profileMode: 'advanced',
  advancedProfilePoints: [
    { x: .78, y: 0, type: 'corner' },
    { x: .9, y: .28, type: 'smooth', handleIn: { x: .9, y: .18 }, handleOut: { x: .88, y: .4 } },
    { x: .72, y: .62, type: 'smooth', handleIn: { x: .76, y: .5 }, handleOut: { x: .68, y: .75 } },
    { x: .38, y: 1, type: 'corner' },
  ],
  advancedMaxRadius: 90,
  height: 190,
  bodyRadius: 48,
  topRadius: 34,
  baseRadius: 78,
  baseHeight: 18,
  neckRadius: 25,
  neckHeight: 16,
  wallThickness: 3.2,
  socketDiameter: 42,
  bottomHoleEnabled: true,
  bottomHoleDiameter: 42,
  segments: 64,
  renderStyle: 'smooth',
  showSimulation: true,
  color: '#d9d6cf',
};

const COLORS = ['#d9d6cf', '#e7e7e7', '#1b1b1b', '#d23b3b', '#2f6fdd', '#2e9e5b', '#f2b705'];

export const BODY_PROFILE_PRESETS: Array<{ name: BodyProfile; points: BodyProfilePoint[] }> = [
  { name: 'cylinder', points: [{ x: .78, y: 0, type: 'corner' }, { x: .78, y: 1, type: 'corner' }] },
  { name: 'taper', points: [{ x: .9, y: 0, type: 'corner' }, { x: .4, y: 1, type: 'corner' }] },
  { name: 'lampshade', points: DEFAULT_LAMP_BODY_CONFIG.advancedProfilePoints },
  { name: 'hourglass', points: [{ x: .82, y: 0, type: 'corner' }, { x: .48, y: .5, type: 'corner' }, { x: .42, y: 1, type: 'corner' }] },
  { name: 'pedestal', points: [{ x: .58, y: 0, type: 'corner' }, { x: .9, y: .2, type: 'smooth', handleIn: { x: .9, y: .1 }, handleOut: { x: .86, y: .34 } }, { x: .72, y: .6, type: 'smooth', handleIn: { x: .76, y: .48 }, handleOut: { x: .66, y: .76 } }, { x: .4, y: 1, type: 'corner' }] },
];

const COPY = {
  en: {
    title: 'Lamp Body Creator', subtitle: 'Parametric Lamp Stand Generator', workspace: 'BODY WORKSPACE', preview: 'Live 3D preview', realtime: 'Realtime geometry',
    tabs: { body: 'Body', profile: 'Profile', base: 'Base & Mount', finish: 'Finish', export: 'Export' },
    bodyShape: 'Body profile', bodyShapeHint: 'Choose a starting silhouette for the printed stand.', profileMode: 'Profile mode', preset: 'Preset', advanced: 'Advanced profile', advancedHint: 'Edit the same vertical Bezier profile used by the lampshade.', vertical: 'Vertical profile', dragHint: 'Drag points and handles • Double-click a point to toggle Curve/Sharp • Double-click the grid to add a point', profilePreset: 'Profile presets', maxRadius: 'Maximum radius', profileLabels: { cylinder: 'Cylinder', taper: 'Taper', hourglass: 'Hourglass', pedestal: 'Pedestal', lampshade: 'Lampshade' }, lampshade: 'Lampshade', lowerRadius: 'Lower radius', shoulderRadius: 'Shoulder radius', waistRadius: 'Waist radius', upperRadius: 'Upper radius', profileCurve: 'Curve tension', profileFlare: 'Shade flare',
    profiles: { cylinder: 'Cylinder', taper: 'Taper', hourglass: 'Hourglass', pedestal: 'Pedestal', lampshade: 'Lampshade' },
    dimensions: 'Body dimensions', height: 'Height', bodyRadius: 'Body radius', topRadius: 'Top radius',
    base: 'Base and mounting', baseRadius: 'Base radius', baseHeight: 'Base height', neckRadius: 'Neck radius', neckHeight: 'Neck height', bottomHole: 'Bottom cable & socket opening', bottomHoleHint: 'A real through-hole is cut into the base for the cable and lamp socket.', bottomHoleDiameter: 'Opening diameter', holeEnabled: 'Bottom opening', holeOn: 'Open', holeOff: 'Closed',
    socket: 'Socket opening', socketDiameter: 'Socket diameter', socketHint: 'The opening is sized for a replaceable E27/E14 insert.',
    construction: 'Print construction', wall: 'Wall thickness', segments: 'Radial resolution', resolutionHint: 'Higher resolution creates a smoother round body.',
    appearance: 'Appearance', style: 'Render style', smooth: 'Smooth', lowPoly: 'Low poly', color: 'Body color', simulation: 'Lamp simulation',
    simulationHint: 'Show a socket, bulb and warm light above the body.', on: 'On', off: 'Off',
    exportTitle: 'Ready to fabricate', exportText: 'The body is generated locally as a watertight rotational shell. Preview-only socket and bulb parts are excluded from the STL.',
    exportBody: 'Export lamp body', download: 'Download STL', exported: 'STL download started', exportFailed: 'Export failed. Please try again.',
    summary: 'Model summary', profile: 'Profile', totalHeight: 'Total height', diameter: 'Base diameter', volume: 'Build envelope',
    mm: 'mm', drag: 'Drag to orbit', scroll: 'Scroll to zoom', mesh: 'Mesh', licenses: 'Local geometry', localOnly: 'No model data is uploaded.',
  },
  vi: {
    title: 'Trình tạo thân đèn', subtitle: 'Tạo thân đèn tham số', workspace: 'KHÔNG GIAN THÂN ĐÈN', preview: 'Preview 3D trực tiếp', realtime: 'Hình học thời gian thực',
    tabs: { body: 'Thân đèn', profile: 'Biên dạng', base: 'Đế & ngàm', finish: 'Hoàn thiện', export: 'Xuất file' },
    bodyShape: 'Biên dạng thân', bodyShapeHint: 'Chọn hình dáng ban đầu cho thân đèn in 3D.', profileMode: 'Chế độ biên dạng', preset: 'Mẫu sẵn', advanced: 'Biên dạng nâng cao', advancedHint: 'Chỉnh cùng biên dạng Bézier dọc như chao đèn: kéo điểm, tay nắm và đổi Cong/Góc.', vertical: 'Biên dạng dọc', dragHint: 'Kéo các điểm và tay nắm · Nhấp đúp điểm để đổi Cong/Góc · Nhấp đúp nền lưới để thêm điểm', profilePreset: 'Mẫu biên dạng', maxRadius: 'Bán kính lớn nhất', profileLabels: { cylinder: 'Trụ', taper: 'Thuôn côn', hourglass: 'Đồng hồ cát', pedestal: 'Bệ chân', lampshade: 'Chao đèn' }, lampshade: 'Chao đèn', lowerRadius: 'Bán kính đáy thân', shoulderRadius: 'Bán kính vai', waistRadius: 'Bán kính eo', upperRadius: 'Bán kính phía trên', profileCurve: 'Độ cong đường biên', profileFlare: 'Độ xòe chao',
    profiles: { cylinder: 'Trụ thẳng', taper: 'Thuôn côn', hourglass: 'Đồng hồ cát', pedestal: 'Bệ chân', lampshade: 'Chao đèn' },
    dimensions: 'Kích thước thân', height: 'Chiều cao', bodyRadius: 'Bán kính thân', topRadius: 'Bán kính đỉnh',
    base: 'Đế và vị trí lắp', baseRadius: 'Bán kính đế', baseHeight: 'Chiều cao đế', neckRadius: 'Bán kính cổ', neckHeight: 'Chiều cao cổ', bottomHole: 'Lỗ luồn dây & gắn đuôi đèn', bottomHoleHint: 'Lỗ xuyên thực được cắt qua đáy để luồn dây và gắn đuôi đèn.', bottomHoleDiameter: 'Đường kính lỗ', holeEnabled: 'Lỗ đáy', holeOn: 'Đang mở', holeOff: 'Đóng',
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
export function getLampBodyCopy(language: Language): LampBodyCopy {
  return COPY[language] as LampBodyCopy;
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

export function createLampBodyGeometry(config: LampBodyConfig) {
  const points: THREE.Vector2[] = [];
  const baseHeight = Math.max(8, config.baseHeight);
  const bodyHeight = Math.max(50, config.height);
  const bodyTop = baseHeight + bodyHeight;
  const totalHeight = bodyTop + Math.max(8, config.neckHeight);
  const wall = Math.max(.8, config.wallThickness);
  const bodyBottomRadius = bodyRadiusAt(config, 0);
  const bodyTopRadius = bodyRadiusAt(config, 1);
  const innerBaseY = baseHeight + wall;
  const maximumHoleRadius = Math.max(2, bodyBottomRadius - wall - 1);
  const bottomHoleRadius = config.bottomHoleEnabled
    ? Math.min(Math.max(2, config.bottomHoleDiameter / 2), maximumHoleRadius)
    : 0;

  points.push(new THREE.Vector2(config.baseRadius, 0));
  points.push(new THREE.Vector2(config.baseRadius, baseHeight * .42));
  points.push(new THREE.Vector2(config.baseRadius * .96, baseHeight));
  points.push(new THREE.Vector2(bodyBottomRadius, baseHeight));
  [0, .18, .4, .65, .84, 1].forEach((progress) => {
    points.push(new THREE.Vector2(bodyRadiusAt(config, progress), baseHeight + bodyHeight * progress));
  });
  points.push(new THREE.Vector2(Math.max(bodyTopRadius, config.neckRadius * 1.12), bodyTop + config.neckHeight * .2));
  points.push(new THREE.Vector2(config.neckRadius, totalHeight));

  const innerTopRadius = Math.max(2, Math.min(config.neckRadius - .8, Math.max(config.socketDiameter / 2, config.neckRadius - wall)));
  points.push(new THREE.Vector2(innerTopRadius, totalHeight));
  points.push(new THREE.Vector2(Math.max(2, bodyTopRadius - wall), bodyTop));
  [.84, .65, .4, .18, 0].forEach((progress) => {
    points.push(new THREE.Vector2(Math.max(2, bodyRadiusAt(config, progress) - wall), baseHeight + bodyHeight * progress));
  });
  points.push(new THREE.Vector2(Math.max(2, bodyBottomRadius - wall), innerBaseY));
  points.push(new THREE.Vector2(bottomHoleRadius, innerBaseY));
  points.push(new THREE.Vector2(bottomHoleRadius, 0));
  // Close the radial section across the underside. With an enabled hole this
  // is an annular face; when disabled it becomes a solid bottom cap.
  points.push(new THREE.Vector2(config.baseRadius, 0));

  const geometry = new THREE.LatheGeometry(points, config.renderStyle === 'low-poly' ? Math.max(16, Math.round(config.segments / 2)) : config.segments);
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

function BodyMesh({ geometry, color, lowPoly }: { geometry: THREE.LatheGeometry; color: string; lowPoly: boolean }) {
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.58} metalness={.04} flatShading={lowPoly} /></mesh>;
}

export function LampBodyModel({ config, yOffset = 0, showSimulation = config.showSimulation }: { config: LampBodyConfig; yOffset?: number; showSimulation?: boolean }) {
  const geometry = useMemo(() => createLampBodyGeometry(config), [config]);
  const totalHeight = config.baseHeight + config.height + config.neckHeight;
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group position={[0, yOffset, 0]}>
    <BodyMesh geometry={geometry} color={config.color} lowPoly={config.renderStyle === 'low-poly'} />
    {showSimulation && <>
      <pointLight position={[0, totalHeight + 48, 0]} color="#ffd38a" intensity={260} distance={500} decay={2} />
      <mesh position={[0, totalHeight + 11, 0]} castShadow><cylinderGeometry args={[config.socketDiameter / 2, config.socketDiameter / 2, 12, 32]} /><meshStandardMaterial color="#252b35" metalness={.75} roughness={.3} /></mesh>
      <mesh position={[0, totalHeight + 48, 0]}><sphereGeometry args={[23, 32, 18]} /><meshStandardMaterial color="#fff3cf" emissive="#ffb84a" emissiveIntensity={1.8} roughness={.25} /></mesh>
    </>}
  </group>;
}

function LampBodyScene({ config }: { config: LampBodyConfig; geometry?: THREE.LatheGeometry }) {
  const totalHeight = config.baseHeight + config.height + config.neckHeight;
  return <>
    <color attach="background" args={['#070b12']} />
    <PerspectiveCamera makeDefault position={[420, 300, 520]} fov={38} />
    <ambientLight intensity={.55} />
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
  const [tab, setTab] = useState<BodyTab>('body');
  const [config, setConfig] = useState<LampBodyConfig>(DEFAULT_LAMP_BODY_CONFIG);
  const [exportState, setExportState] = useState<'idle' | 'done' | 'error'>('idle');
  const geometry = useMemo(() => createLampBodyGeometry(config), [config]);
  const totalHeight = config.baseHeight + config.height + config.neckHeight;
  const update = <K extends keyof LampBodyConfig>(key: K, value: LampBodyConfig[K]) => setConfig((current) => ({ ...current, [key]: value }));

  const exportStl = () => {
    try {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
      mesh.updateMatrixWorld(true);
      const output = new STLExporter().parse(mesh, { binary: false });
      downloadFile(output, `lamp-body-${config.profile}.stl`);
      mesh.material.dispose();
      setExportState('done');
    } catch {
      setExportState('error');
    }
  };

  const tabs = [
    { id: 'body' as const, label: copy.tabs.body, icon: Box },
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
          {tab === 'base' && <div className="lamp-body-panel-content"><section><PanelTitle icon={Layers3} title={copy.base} /><RangeControl label={copy.baseRadius} value={config.baseRadius} min={45} max={120} unit={copy.mm} onChange={(value) => update('baseRadius', value)} /><RangeControl label={copy.baseHeight} value={config.baseHeight} min={8} max={42} unit={copy.mm} onChange={(value) => update('baseHeight', value)} /><RangeControl label={copy.neckRadius} value={config.neckRadius} min={14} max={42} unit={copy.mm} onChange={(value) => update('neckRadius', value)} /><RangeControl label={copy.neckHeight} value={config.neckHeight} min={8} max={38} unit={copy.mm} onChange={(value) => update('neckHeight', value)} /></section><section><PanelTitle icon={Info} title={copy.socket} hint={copy.socketHint} /><RangeControl label={copy.socketDiameter} value={config.socketDiameter} min={24} max={52} unit={copy.mm} onChange={(value) => update('socketDiameter', value)} /></section></div>}
          {tab === 'finish' && <div className="lamp-body-panel-content"><section><PanelTitle icon={Settings2} title={copy.construction} hint={copy.resolutionHint} /><RangeControl label={copy.wall} value={config.wallThickness} min={1.2} max={6} step={.1} unit={copy.mm} onChange={(value) => update('wallThickness', value)} /><RangeControl label={copy.segments} value={config.segments} min={24} max={128} step={8} unit="" onChange={(value) => update('segments', value)} /></section><section><PanelTitle icon={Sparkles} title={copy.appearance} /><SelectControl label={copy.style} value={config.renderStyle} options={[{ value: 'smooth', label: copy.smooth }, { value: 'low-poly', label: copy.lowPoly }]} onChange={(value) => update('renderStyle', value as RenderStyle)} /><div className="lamp-body-color-field"><span>{copy.color}</span><div className="lamp-body-swatches">{COLORS.map((color) => <button type="button" key={color} className={config.color === color ? 'selected' : ''} style={{ background: color }} aria-label={color} onClick={() => update('color', color)} />)}</div></div></section><section><PanelTitle icon={Lightbulb} title={copy.simulation} /><ToggleControl label={copy.simulation} hint={copy.simulationHint} value={config.showSimulation} onChange={() => update('showSimulation', !config.showSimulation)} onLabel={copy.on} offLabel={copy.off} /></section></div>}
          {tab === 'export' && <div className="lamp-body-panel-content"><section className="lamp-body-export-card"><span className="lamp-body-export-icon"><Check size={20} /></span><h2>{copy.exportTitle}</h2><p>{copy.exportText}</p><button type="button" className="lamp-body-export-button" onClick={exportStl}><Download size={16} /> {copy.download} <ArrowRight size={15} /></button>{exportState !== 'idle' && <div className={`lamp-body-export-status ${exportState}`}>{exportState === 'done' ? <Check size={14} /> : <Info size={14} />}{exportState === 'done' ? copy.exported : copy.exportFailed}</div>}</section><section className="lamp-body-summary"><PanelTitle icon={Info} title={copy.summary} /><div><span>{copy.profile}</span><strong>{copy.profiles[config.profile]}</strong></div><div><span>{copy.totalHeight}</span><strong>{Math.round(totalHeight)} {copy.mm}</strong></div><div><span>{copy.diameter}</span><strong>{Math.round(config.baseRadius * 2)} {copy.mm}</strong></div><div><span>{copy.volume}</span><strong>{Math.round(config.baseRadius * 2)} × {Math.round(totalHeight)} {copy.mm}</strong></div></section></div>}
        </div>
        <footer className="lamp-body-sidebar-footer"><span>{copy.licenses}</span><span>{copy.localOnly}</span></footer>
      </aside>
      <section className="lamp-body-viewport" aria-label={copy.preview}><Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}><LampBodyScene config={config} geometry={geometry} /></Canvas><div className="lamp-body-viewport-top"><span><Sparkles size={13} />{copy.preview}</span><span>{copy.profiles[config.profile]}</span></div><div className="lamp-body-viewport-toolbar"><span><Rotate3D size={14} />{copy.drag}</span><span>{copy.scroll}</span><button type="button" className={config.renderStyle === 'low-poly' ? 'active' : ''} onClick={() => update('renderStyle', config.renderStyle === 'low-poly' ? 'smooth' : 'low-poly')}><Box size={14} />{copy.mesh}</button></div><div className="lamp-body-viewport-measure"><span>H</span><strong>{Math.round(totalHeight)} {copy.mm}</strong><span>Ø</span><strong>{Math.round(config.baseRadius * 2)} {copy.mm}</strong></div></section>
    </div>
  </main>;
}
