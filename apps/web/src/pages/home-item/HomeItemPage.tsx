import {
  Box, Check, ChevronDown, Circle, Download, Eye, EyeOff, Info, Lightbulb,
  LogIn, Palette, RotateCcw, Rotate3d, Save, Settings2, Share2, Sparkles, SlidersHorizontal,
  UserRound, UsersRound, Waves, Diamond, CircleDot,
} from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { useI18n } from '../../lib/i18n';
import {
  DEFAULT_HOME_ITEM_CONFIG,
  createHomeItemGeometry,
  getHomeItemDimensions,
  getHomeItemStats,
  type DistributionPattern,
  type HomeItemConfig,
  type HomeItemProfile,
  type HomeItemQuality,
  type HomeItemShape,
  type MaskMode,
  type PatternDirection,
} from './home-item-geometry';
import './home-item.css';

type HomeItemTab = 'shape' | 'profile' | 'design' | 'community' | 'materials' | 'export';
type PatternKey = 'lines' | 'spheres' | 'waves' | 'diamonds' | 'dots';

const COPY = {
  en: {
    title: 'Home Item', subtitle: 'Parametric home decor generator', workspace: '3D WORKSPACE', design: 'DESIGN',
    shape: 'Shape', profile: 'Profile', designTab: 'Design', community: 'Community', materials: 'Materials', export: 'Export',
    baseShape: 'Base shape', cylinder: 'Cylinder', square: 'Square', oval: 'Oval', dimensions: 'Dimensions', width: 'Width', length: 'Length', height: 'Height', wall: 'Wall thickness', base: 'Base thickness', corner: 'Corner radius', mm: 'mm',
    wallProfile: 'Wall profile', linear: 'Linear', bulged: 'Bulged', topTaper: 'Top taper', topTaperHint: 'Adjust the diameter at the upper opening.',
    proceduralLines: '1. Procedural: Lines', proceduralSpheres: '2. Procedural: Spheres', proceduralWaves: '3. Procedural: Waves', proceduralDiamonds: '4. Procedural: Diamonds', proceduralDots: '5. Procedural: Dots',
    direction: 'Direction', horizontal: 'Horizontal', vertical: 'Vertical', both: 'Both', period: 'Distance (period)', lineWidth: 'Line width', depth: 'Depth', angle: 'Angle', edgeHardness: 'Edge hardness', bevel: 'Bevel (curvature)',
    distribution: 'Distribution pattern', grid: 'Grid', staggered: 'Staggered', diameter: 'Size (diameter)', horizontalSpacing: 'Horizontal spacing', verticalSpacing: 'Vertical spacing', ringSpacing: 'Ring spacing', relief: 'Relief', roundness: 'Profile roundness', variation: 'Organic variation', lineThickness: 'Line thickness', pointWidth: 'Point width', pointHeight: 'Point height', threadThickness: 'Thread thickness', rotation: 'Rotation',
    shareDesign: 'Share my design', shareHint: 'Sign in to save and share your designs with the community.', signIn: 'Sign in', recent: 'Recent designs', load: 'Load design',
    materialTitle: 'Recommended filaments', materialHint: 'A selection of filaments for decorative home items and functional vessels.', pastel: 'PLA Pastel (soft matte tones)', pastelText: 'A silky matte PLA in soft pastel colors. Ideal for Scandinavian, minimal and warm finishes.', qualityPrice: 'PLA JAYO Matte (great value)', qualityPriceText: 'High-quality matte PLA that hides layer lines remarkably well for clean, professional surfaces.', pastelTag: 'PASTEL FINISH', valueTag: 'GREAT VALUE', amazon: 'View on Amazon', affiliate: 'Affiliate note: ShaperLab may receive a small commission from these links, helping fund platform development.',
    viewportSettings: 'Viewport settings', materialColor: 'Material color', color: 'Color', exportMesh: 'Export STL mesh', exportHint: 'Choose the STL detail level: Fast for a light test, High for quality or Ultra for maximum density.', fast: 'Fast', high: 'High', ultra: 'Ultra', downloadDesign: 'Download design JSON', saveLocally: 'Save locally', saved: 'Saved locally', reset: 'Reset design',
    polygons: 'polygons', vertices: 'vertices', low: 'Low', medium: 'Med', highShort: 'High', enableMask: 'Enable mask', invert: 'Invert', resetMask: 'Reset mask', hard: 'Hard cut', soft: 'Soft', blend: 'Blend', drag: 'Drag to orbit', scroll: 'Scroll to zoom', mesh: 'Show mesh', hideMesh: 'Hide mesh', dimensionsBadge: 'H', maskHint: 'Front-side relief mask', exportReady: 'Ready to export', exportDone: 'STL downloaded', jsonDone: 'Design JSON downloaded', resetDone: 'Design reset', noSession: 'Preview runs locally in your browser.',
    presets: { pebble: 'Pebble bowl', ribbed: 'Ribbed planter', basket: 'Woven basket', terrazzo: 'Terrazzo cup', spiral: 'Spiral vase', wave: 'Wave bowl' },
  },
  vi: {
    title: 'Home Item', subtitle: 'Trình tạo đồ gia dụng tham số', workspace: 'KHÔNG GIAN 3D', design: 'THIẾT KẾ',
    shape: 'Hình dạng', profile: 'Biên dạng', designTab: 'Họa tiết', community: 'Cộng đồng', materials: 'Vật liệu', export: 'Xuất file',
    baseShape: 'Hình cơ bản', cylinder: 'Trụ', square: 'Vuông', oval: 'Oval', dimensions: 'Kích thước', width: 'Rộng', length: 'Dài', height: 'Cao', wall: 'Độ dày thành', base: 'Độ dày đáy', corner: 'Bán kính góc', mm: 'mm',
    wallProfile: 'Biên dạng thành', linear: 'Thẳng', bulged: 'Phồng', topTaper: 'Thu miệng trên', topTaperHint: 'Điều chỉnh đường kính ở miệng trên của sản phẩm.',
    proceduralLines: '1. Tham số: Đường', proceduralSpheres: '2. Tham số: Cầu', proceduralWaves: '3. Tham số: Sóng', proceduralDiamonds: '4. Tham số: Kim cương', proceduralDots: '5. Tham số: Chấm',
    direction: 'Hướng', horizontal: 'Ngang', vertical: 'Dọc', both: 'Cả hai', period: 'Khoảng cách (chu kỳ)', lineWidth: 'Độ rộng đường', depth: 'Độ sâu', angle: 'Góc', edgeHardness: 'Độ cứng cạnh', bevel: 'Bo cong',
    distribution: 'Kiểu phân bố', grid: 'Lưới', staggered: 'Xen kẽ', diameter: 'Kích thước (đường kính)', horizontalSpacing: 'Khoảng cách ngang', verticalSpacing: 'Khoảng cách dọc', ringSpacing: 'Khoảng cách vòng', relief: 'Độ nổi', roundness: 'Độ tròn biên dạng', variation: 'Biến thiên hữu cơ', lineThickness: 'Độ dày đường', pointWidth: 'Rộng điểm', pointHeight: 'Cao điểm', threadThickness: 'Độ dày sợi', rotation: 'Góc xoay',
    shareDesign: 'Chia sẻ thiết kế', shareHint: 'Đăng nhập để lưu và chia sẻ thiết kế với cộng đồng.', signIn: 'Đăng nhập', recent: 'Thiết kế gần đây', load: 'Tải thiết kế',
    materialTitle: 'Filament đề xuất', materialHint: 'Một số filament phù hợp cho đồ gia dụng trang trí và vật dụng chức năng.', pastel: 'PLA Pastel (màu dịu, mờ)', pastelText: 'PLA bề mặt mờ mịn với các màu pastel. Phù hợp phong cách tối giản, ấm áp và Bắc Âu.', qualityPrice: 'PLA JAYO Matte (giá trị tốt)', qualityPriceText: 'PLA mờ chất lượng cao giúp che đường layer tốt, cho bề mặt sạch và chuyên nghiệp.', pastelTag: 'BỀ MẶT PASTEL', valueTag: 'GIÁ TRỊ TỐT', amazon: 'Xem trên Amazon', affiliate: 'Lưu ý liên kết: ShaperLab có thể nhận một khoản hoa hồng nhỏ để duy trì nền tảng.',
    viewportSettings: 'Thiết lập khung nhìn', materialColor: 'Màu vật liệu', color: 'Màu', exportMesh: 'Xuất mesh STL', exportHint: 'Chọn mức chi tiết STL: Nhanh để thử, Cao cho chất lượng hoặc Ultra cho mật độ tối đa.', fast: 'Nhanh', high: 'Cao', ultra: 'Ultra', downloadDesign: 'Tải JSON thiết kế', saveLocally: 'Lưu cục bộ', saved: 'Đã lưu cục bộ', reset: 'Đặt lại thiết kế',
    polygons: 'đa giác', vertices: 'đỉnh', low: 'Thấp', medium: 'Vừa', highShort: 'Cao', enableMask: 'Bật mask', invert: 'Đảo mask', resetMask: 'Đặt lại mask', hard: 'Cắt cứng', soft: 'Mềm', blend: 'Pha trộn', drag: 'Kéo để xoay', scroll: 'Cuộn để zoom', mesh: 'Hiện lưới', hideMesh: 'Ẩn lưới', dimensionsBadge: 'C', maskHint: 'Mask họa tiết mặt trước', exportReady: 'Sẵn sàng xuất', exportDone: 'Đã tải STL', jsonDone: 'Đã tải JSON thiết kế', resetDone: 'Đã đặt lại', noSession: 'Preview chạy cục bộ trong trình duyệt.',
    presets: { pebble: 'Bát sỏi', ribbed: 'Chậu gân', basket: 'Giỏ dệt', terrazzo: 'Cốc terrazzo', spiral: 'Bình xoắn', wave: 'Bát sóng' },
  },
};

type Copy = typeof COPY.en;

const COLOR_PRESETS = ['#c9c2e8', '#e9d5b5', '#f3c3c1', '#f3d39b', '#cbdba7', '#afd1c7', '#b6ddec', '#f5f1df', '#aab5ad', '#d9a5c5'];
const COMMUNITY_PRESETS: Array<{ key: keyof Copy['presets']; author: string; color: string; shape: HomeItemShape; pattern: PatternKey }> = [
  { key: 'pebble', author: '@chagohunt', color: '#d8cfb7', shape: 'oval', pattern: 'spheres' },
  { key: 'ribbed', author: '@palmita35', color: '#c9c2e8', shape: 'square', pattern: 'spheres' },
  { key: 'basket', author: '@alvaro9fdez_', color: '#dedbe8', shape: 'square', pattern: 'diamonds' },
  { key: 'terrazzo', author: '@tinybutton', color: '#d9c1ab', shape: 'cylinder', pattern: 'dots' },
  { key: 'spiral', author: '@formaforge', color: '#c9d8be', shape: 'cylinder', pattern: 'waves' },
  { key: 'wave', author: '@studiohome', color: '#d9b2c6', shape: 'oval', pattern: 'waves' },
];

function formatValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function downloadBlob(payload: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([payload], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function RangeControl({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (value: number) => void }) {
  const commit = (next: number) => onChange(Math.min(max, Math.max(min, Number.isFinite(next) ? next : value)));
  return <label className="home-item-range"><span className="home-item-range-label"><span>{label}</span><strong><input aria-label={`${label} value`} type="number" min={min} max={max} step={step} value={formatValue(value)} onChange={(event) => commit(Number(event.target.value))} /> <small>{unit}</small></strong></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => commit(Number(event.target.value))} /></label>;
}

function Toggle({ enabled, label, onChange }: { enabled: boolean; label: string; onChange: () => void }) {
  return <button type="button" className={`home-item-toggle${enabled ? ' on' : ''}`} aria-label={label} aria-pressed={enabled} onClick={(event) => { event.stopPropagation(); onChange(); }}><span /></button>;
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return <div className="home-item-segmented">{options.map((option) => <button type="button" key={option.value} className={value === option.value ? 'active' : ''} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}

function PatternCard({ title, icon, enabled, onChange, children }: { title: string; icon: React.ReactNode; enabled: boolean; onChange: () => void; children: React.ReactNode }) {
  return <section className={`home-item-pattern-card${enabled ? ' expanded' : ''}`}><div className="home-item-pattern-heading" role="button" tabIndex={0} aria-expanded={enabled} onClick={onChange} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onChange(); } }}><span>{icon}<strong>{title}</strong></span><Toggle enabled={enabled} label={title} onChange={onChange} /></div>{enabled && <div className="home-item-pattern-body">{children}</div>}</section>;
}

function HomeItemScene({ geometry, config, showMesh }: { geometry: THREE.BufferGeometry; config: HomeItemConfig; showMesh: boolean }) {
  const dimensions = getHomeItemDimensions(config);
  const floorGeometry = useMemo(() => {
    const points: number[] = [];
    for (let coordinate = -300; coordinate <= 300; coordinate += 25) {
      points.push(-300, -.3, coordinate, 300, -.3, coordinate, coordinate, -.3, -300, coordinate, -.3, 300);
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return next;
  }, []);
  useEffect(() => () => floorGeometry.dispose(), [floorGeometry]);
  return <>
    <color attach="background" args={['#080f1d']} />
    <ambientLight intensity={.62} />
    <directionalLight position={[160, 230, 180]} intensity={2.65} color="#dfe8ff" />
    <directionalLight position={[-150, 90, -80]} intensity={.65} color="#7bb8ff" />
    <pointLight position={[0, config.height * .72, 80]} intensity={8} distance={420} color="#e7d9ff" />
    <lineSegments geometry={floorGeometry}><lineBasicMaterial color="#2b527f" transparent opacity={.4} /></lineSegments>
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={config.color} roughness={.64} metalness={.04} side={THREE.DoubleSide} />
      </mesh>
      {showMesh && <mesh geometry={geometry} scale={[1.001, 1.001, 1.001]}><meshBasicMaterial color="#58b9ff" wireframe transparent opacity={.26} /></mesh>}
    </group>
    <PerspectiveCamera makeDefault position={[dimensions.width * 1.35, config.height * 1.1, dimensions.length * 1.7]} fov={38} near={.1} far={1500} />
    <OrbitControls enableDamping dampingFactor={.08} minDistance={90} maxDistance={700} target={[0, config.height * .48, 0]} />
  </>;
}

function ShapePanel({ config, copy, update, updateGroup }: { config: HomeItemConfig; copy: Copy; update: <K extends keyof HomeItemConfig>(key: K, value: HomeItemConfig[K]) => void; updateGroup: <K extends PatternKey>(section: K, patch: Partial<HomeItemConfig[K]>) => void }) {
  return <div className="home-item-panel-content">
    <SectionLabel>{copy.baseShape}</SectionLabel>
    <Segmented<HomeItemShape> value={config.shape} options={[{ value: 'cylinder', label: copy.cylinder }, { value: 'square', label: copy.square }, { value: 'oval', label: copy.oval }]} onChange={(value) => update('shape', value)} />
    <SectionLabel>{copy.dimensions}</SectionLabel>
    <RangeControl label={copy.width} value={config.width} min={40} max={250} unit={copy.mm} onChange={(value) => update('width', value)} />
    <RangeControl label={copy.length} value={config.length} min={40} max={250} unit={copy.mm} onChange={(value) => update('length', value)} />
    <RangeControl label={copy.height} value={config.height} min={30} max={300} unit={copy.mm} onChange={(value) => update('height', value)} />
    <RangeControl label={copy.wall} value={config.wallThickness} min={1.2} max={15} step={.2} unit={copy.mm} onChange={(value) => update('wallThickness', value)} />
    <RangeControl label={copy.base} value={config.baseThickness} min={2} max={25} step={1} unit={copy.mm} onChange={(value) => update('baseThickness', value)} />
    <RangeControl label={copy.corner} value={config.cornerRadius} min={0} max={50} step={1} unit={copy.mm} onChange={(value) => update('cornerRadius', value)} />
    <div className="home-item-panel-note"><Info size={14} /> {copy.noSession}</div>
  </div>;
}

function ProfilePanel({ config, copy, update }: { config: HomeItemConfig; copy: Copy; update: <K extends keyof HomeItemConfig>(key: K, value: HomeItemConfig[K]) => void }) {
  return <div className="home-item-panel-content">
    <SectionLabel>{copy.wallProfile}</SectionLabel>
    <Segmented<HomeItemProfile> value={config.profile} options={[{ value: 'linear', label: copy.linear }, { value: 'bulged', label: copy.bulged }]} onChange={(value) => update('profile', value)} />
    <RangeControl label={copy.topTaper} value={config.topTaper} min={-30} max={30} step={1} unit="%" onChange={(value) => update('topTaper', value)} />
    <p className="home-item-help">{copy.topTaperHint}</p>
    <div className="home-item-profile-diagram"><div className={`home-item-profile-shape ${config.profile}`}><span /></div><span>0</span><span>H</span><span>Ø</span></div>
  </div>;
}

function DesignPanel({ config, copy, updateGroup }: { config: HomeItemConfig; copy: Copy; updateGroup: <K extends PatternKey>(section: K, patch: Partial<HomeItemConfig[K]>) => void }) {
  return <div className="home-item-panel-content home-item-design-content">
    <PatternCard title={copy.proceduralLines} icon={<SlidersHorizontal size={15} />} enabled={config.lines.enabled} onChange={() => updateGroup('lines', { enabled: !config.lines.enabled })}>
      <FieldLabel>{copy.direction}</FieldLabel><Segmented<PatternDirection> value={config.lines.direction} options={[{ value: 'horizontal', label: copy.horizontal }, { value: 'vertical', label: copy.vertical }, { value: 'both', label: copy.both }]} onChange={(value) => updateGroup('lines', { direction: value })} />
      <RangeControl label={copy.period} value={config.lines.period} min={2} max={40} step={.5} unit={copy.mm} onChange={(value) => updateGroup('lines', { period: value })} />
      <RangeControl label={copy.lineWidth} value={config.lines.width} min={1} max={20} step={.5} unit={copy.mm} onChange={(value) => updateGroup('lines', { width: value })} />
      <RangeControl label={copy.depth} value={config.lines.depth} min={-6} max={6} step={.2} unit={copy.mm} onChange={(value) => updateGroup('lines', { depth: value })} />
      <RangeControl label={copy.angle} value={config.lines.angle} min={-45} max={45} unit="°" onChange={(value) => updateGroup('lines', { angle: value })} />
      <RangeControl label={copy.edgeHardness} value={config.lines.edgeHardness} min={0} max={1} step={.05} unit="%" onChange={(value) => updateGroup('lines', { edgeHardness: value })} />
      <RangeControl label={copy.bevel} value={config.lines.bevel} min={.2} max={4} step={.1} unit={copy.mm} onChange={(value) => updateGroup('lines', { bevel: value })} />
    </PatternCard>
    <PatternCard title={copy.proceduralSpheres} icon={<Circle size={15} />} enabled={config.spheres.enabled} onChange={() => updateGroup('spheres', { enabled: !config.spheres.enabled })}>
      <FieldLabel>{copy.distribution}</FieldLabel><Segmented<DistributionPattern> value={config.spheres.distribution} options={[{ value: 'grid', label: copy.grid }, { value: 'staggered', label: copy.staggered }]} onChange={(value) => updateGroup('spheres', { distribution: value })} />
      <RangeControl label={copy.diameter} value={config.spheres.diameter} min={2} max={24} step={.5} unit={copy.mm} onChange={(value) => updateGroup('spheres', { diameter: value })} />
      <RangeControl label={copy.depth} value={config.spheres.depth} min={-6} max={6} step={.2} unit={copy.mm} onChange={(value) => updateGroup('spheres', { depth: value })} />
      <RangeControl label={copy.horizontalSpacing} value={config.spheres.horizontalSpacing} min={4} max={40} step={.5} unit={copy.mm} onChange={(value) => updateGroup('spheres', { horizontalSpacing: value })} />
      <RangeControl label={copy.verticalSpacing} value={config.spheres.verticalSpacing} min={4} max={40} step={.5} unit={copy.mm} onChange={(value) => updateGroup('spheres', { verticalSpacing: value })} />
    </PatternCard>
    <PatternCard title={copy.proceduralWaves} icon={<Waves size={15} />} enabled={config.waves.enabled} onChange={() => updateGroup('waves', { enabled: !config.waves.enabled })}>
      <RangeControl label={copy.ringSpacing} value={config.waves.ringSpacing} min={4} max={30} step={.5} unit={copy.mm} onChange={(value) => updateGroup('waves', { ringSpacing: value })} />
      <RangeControl label={copy.relief} value={config.waves.relief} min={-8} max={8} step={.2} unit={copy.mm} onChange={(value) => updateGroup('waves', { relief: value })} />
      <RangeControl label={copy.roundness} value={config.waves.roundness} min={0} max={1} step={.05} unit="%" onChange={(value) => updateGroup('waves', { roundness: value })} />
      <RangeControl label={copy.variation} value={config.waves.variation} min={40} max={600} step={5} unit="" onChange={(value) => updateGroup('waves', { variation: value })} />
    </PatternCard>
    <PatternCard title={copy.proceduralDiamonds} icon={<Diamond size={15} />} enabled={config.diamonds.enabled} onChange={() => updateGroup('diamonds', { enabled: !config.diamonds.enabled })}>
      <RangeControl label={copy.horizontalSpacing} value={config.diamonds.horizontalSpacing} min={4} max={40} step={.5} unit={copy.mm} onChange={(value) => updateGroup('diamonds', { horizontalSpacing: value })} />
      <RangeControl label={copy.verticalSpacing} value={config.diamonds.verticalSpacing} min={4} max={40} step={.5} unit={copy.mm} onChange={(value) => updateGroup('diamonds', { verticalSpacing: value })} />
      <RangeControl label={copy.lineThickness} value={config.diamonds.lineThickness} min={.5} max={12} step={.5} unit={copy.mm} onChange={(value) => updateGroup('diamonds', { lineThickness: value })} />
      <RangeControl label={copy.depth} value={config.diamonds.depth} min={-6} max={6} step={.2} unit={copy.mm} onChange={(value) => updateGroup('diamonds', { depth: value })} />
      <RangeControl label={copy.edgeHardness} value={config.diamonds.edgeHardness} min={0} max={1} step={.05} unit="%" onChange={(value) => updateGroup('diamonds', { edgeHardness: value })} />
    </PatternCard>
    <PatternCard title={copy.proceduralDots} icon={<CircleDot size={15} />} enabled={config.dots.enabled} onChange={() => updateGroup('dots', { enabled: !config.dots.enabled })}>
      <RangeControl label={copy.pointWidth} value={config.dots.width} min={3} max={30} step={.5} unit={copy.mm} onChange={(value) => updateGroup('dots', { width: value })} />
      <RangeControl label={copy.pointHeight} value={config.dots.height} min={3} max={30} step={.5} unit={copy.mm} onChange={(value) => updateGroup('dots', { height: value })} />
      <RangeControl label={copy.threadThickness} value={config.dots.threadThickness} min={.4} max={6} step={.1} unit={copy.mm} onChange={(value) => updateGroup('dots', { threadThickness: value })} />
      <RangeControl label={copy.depth} value={config.dots.depth} min={-6} max={6} step={.2} unit={copy.mm} onChange={(value) => updateGroup('dots', { depth: value })} />
      <RangeControl label={copy.rotation} value={config.dots.rotation} min={-45} max={45} unit="°" onChange={(value) => updateGroup('dots', { rotation: value })} />
    </PatternCard>
  </div>;
}

function CommunityPanel({ copy, onLoad }: { copy: Copy; onLoad: (preset: typeof COMMUNITY_PRESETS[number]) => void }) {
  return <div className="home-item-panel-content">
    <section className="home-item-share-card"><h3><Share2 size={16} /> {copy.shareDesign}</h3><p>{copy.shareHint}</p><button type="button" className="home-item-outline-button"><LogIn size={15} /> {copy.signIn}</button></section>
    <SectionLabel>{copy.recent}</SectionLabel>
    <div className="home-item-community-grid">{COMMUNITY_PRESETS.map((preset) => <button type="button" className="home-item-community-card" key={preset.key} onClick={() => onLoad(preset)}><span className={`home-item-mini-art ${preset.pattern} ${preset.shape}`} style={{ '--card-color': preset.color } as React.CSSProperties} /><strong>{copy.presets[preset.key]}</strong><small>{preset.author}</small><em>{copy.load}</em></button>)}</div>
  </div>;
}

function MaterialsPanel({ copy }: { copy: Copy }) {
  return <div className="home-item-panel-content">
    <div className="home-item-material-intro"><h3><Palette size={17} /> {copy.materialTitle}</h3><p>{copy.materialHint}</p></div>
    <MaterialCard icon="🏺" title={copy.pastel} tag={copy.pastelTag} text={copy.pastelText} color="#f2d5b7" copy={copy} />
    <MaterialCard icon="🧵" title={copy.qualityPrice} tag={copy.valueTag} text={copy.qualityPriceText} color="#b9cde1" copy={copy} />
    <p className="home-item-affiliate">{copy.affiliate}</p>
  </div>;
}

function MaterialCard({ icon, title, tag, text, color, copy }: { icon: string; title: string; tag: string; text: string; color: string; copy: Copy }) {
  return <article className="home-item-material-card"><span className="home-item-material-icon" style={{ background: color }}>{icon}</span><div><strong>{title}</strong><small>{tag}</small><p>{text}</p><a href="https://www.amazon.com/" target="_blank" rel="noreferrer">{copy.amazon} <ChevronDown size={14} /></a></div></article>;
}

function ExportPanel({ config, copy, onExport, exporting, onColor, onSave, onReset, exportStatus }: { config: HomeItemConfig; copy: Copy; onExport: (quality: HomeItemQuality) => void; exporting: boolean; onColor: (color: string) => void; onSave: () => void; onReset: () => void; exportStatus: string }) {
  return <div className="home-item-panel-content">
    <section className="home-item-export-section"><SectionLabel>{copy.viewportSettings}</SectionLabel><span className="home-item-sub-label">{copy.materialColor}</span><div className="home-item-color-row">{COLOR_PRESETS.map((color) => <button type="button" key={color} className={`home-item-color-swatch${config.color === color ? ' selected' : ''}`} style={{ background: color }} aria-label={color} onClick={() => onColor(color)} />)}<label className="home-item-color-picker"><input type="color" value={config.color} aria-label={copy.color} onChange={(event) => onColor(event.target.value)} /><span>+</span></label></div></section>
    <section className="home-item-export-card"><div className="home-item-export-icon"><Download size={23} /></div><h3>{copy.exportMesh}</h3><p>{copy.exportHint}</p><div className="home-item-export-grid"><button type="button" onClick={() => onExport('low')} disabled={exporting}><Download size={14} /> {copy.fast}</button><button type="button" onClick={() => onExport('high')} disabled={exporting}><Download size={14} /> {copy.high}</button><button type="button" onClick={() => onExport('ultra')} disabled={exporting}><Download size={14} /> {copy.ultra}</button></div>{exportStatus && <div className="home-item-export-status"><Check size={14} /> {exportStatus}</div>}</section>
    <div className="home-item-export-actions"><button type="button" className="home-item-outline-button" onClick={onSave}><Save size={15} /> {copy.saveLocally}</button><button type="button" className="home-item-outline-button" onClick={onReset}><RotateCcw size={15} /> {copy.reset}</button></div>
  </div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) { return <h2 className="home-item-section-label">{children}</h2>; }
function FieldLabel({ children }: { children: React.ReactNode }) { return <span className="home-item-field-label">{children}</span>; }

function HomeItemHeader({ copy, designId, language, onLanguage, onSave, saved, onReset }: { copy: Copy; designId: string; language: 'en' | 'vi'; onLanguage: (language: 'en' | 'vi') => void; onSave: () => void; saved: boolean; onReset: () => void }) {
  return <header className="home-item-header"><div className="home-item-brand"><span className="home-item-brand-mark"><Lightbulb size={17} /></span><div><strong>{copy.title}</strong><small>{copy.subtitle}</small></div></div><div className="home-item-header-meta"><span className="home-item-design-id">DESIGN / {designId}</span><span className="home-item-local-status"><span />{saved ? copy.saved : copy.exportReady}</span><button type="button" className="home-item-header-button" onClick={onSave}><Save size={14} /> {copy.saveLocally}</button><button type="button" className="home-item-header-button quiet" onClick={onReset}><RotateCcw size={14} /> {copy.reset}</button><div className="home-item-language" aria-label="Language"><button type="button" className={language === 'en' ? 'active' : ''} onClick={() => onLanguage('en')}>EN</button><button type="button" className={language === 'vi' ? 'active' : ''} onClick={() => onLanguage('vi')}>VI</button></div></div></header>;
}

export function HomeItemPage() {
  const { language, setLanguage } = useI18n();
  const copy = COPY[language];
  const location = useLocation();
  const designId = new URLSearchParams(location.search).get('design') ?? 'Q43ofKOfXZwKZ3liR7WR';
  const [config, setConfig] = useState<HomeItemConfig>(() => ({ ...DEFAULT_HOME_ITEM_CONFIG, lines: { ...DEFAULT_HOME_ITEM_CONFIG.lines }, spheres: { ...DEFAULT_HOME_ITEM_CONFIG.spheres }, waves: { ...DEFAULT_HOME_ITEM_CONFIG.waves }, diamonds: { ...DEFAULT_HOME_ITEM_CONFIG.diamonds }, dots: { ...DEFAULT_HOME_ITEM_CONFIG.dots } }));
  const [tab, setTab] = useState<HomeItemTab>('shape');
  const [showMesh, setShowMesh] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [saved, setSaved] = useState(false);
  const geometry = useMemo(() => createHomeItemGeometry(config), [config]);
  const stats = useMemo(() => getHomeItemStats(geometry), [geometry]);
  const dimensions = getHomeItemDimensions(config);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => { document.body.classList.remove('home-item-active'); }, []);
  useEffect(() => { document.body.classList.add('home-item-active'); }, []);

  const update = <K extends keyof HomeItemConfig>(key: K, value: HomeItemConfig[K]) => setConfig((current) => ({ ...current, [key]: value }));
  const updateGroup = <K extends PatternKey>(section: K, patch: Partial<HomeItemConfig[K]>) => setConfig((current) => ({ ...current, [section]: { ...current[section], ...patch } }));
  const setStatus = (status: string) => { setExportStatus(status); window.setTimeout(() => setExportStatus(''), 2800); };

  const saveLocally = () => {
    localStorage.setItem(`formaforge-home-item-${designId}`, JSON.stringify(config));
    setSaved(true);
    setStatus(copy.saved);
  };
  const resetDesign = () => {
    setConfig({ ...DEFAULT_HOME_ITEM_CONFIG, lines: { ...DEFAULT_HOME_ITEM_CONFIG.lines }, spheres: { ...DEFAULT_HOME_ITEM_CONFIG.spheres }, waves: { ...DEFAULT_HOME_ITEM_CONFIG.waves }, diamonds: { ...DEFAULT_HOME_ITEM_CONFIG.diamonds }, dots: { ...DEFAULT_HOME_ITEM_CONFIG.dots } });
    setSaved(false);
    setStatus(copy.resetDone);
  };
  const exportStl = (quality: HomeItemQuality) => {
    setExporting(true);
    try {
      const exportGeometry = createHomeItemGeometry(config, quality);
      const mesh = new THREE.Mesh(exportGeometry);
      const output = new STLExporter().parse(mesh, { binary: false });
      downloadBlob(output, `formaforge-home-item-${designId}-${quality}.stl`, 'model/stl');
      exportGeometry.dispose();
      setStatus(copy.exportDone);
    } catch (error) {
      console.error(error);
      setStatus('Export failed');
    } finally {
      setExporting(false);
    }
  };
  const downloadDesign = () => {
    downloadBlob(JSON.stringify({ version: 1, designId, config }, null, 2), `formaforge-home-item-${designId}.json`, 'application/json');
    setStatus(copy.jsonDone);
  };
  const loadPreset = (preset: typeof COMMUNITY_PRESETS[number]) => {
    setConfig((current) => ({ ...current, shape: preset.shape, color: preset.color, lines: { ...current.lines, enabled: preset.pattern === 'lines' }, spheres: { ...current.spheres, enabled: preset.pattern === 'spheres' }, waves: { ...current.waves, enabled: preset.pattern === 'waves' }, diamonds: { ...current.diamonds, enabled: preset.pattern === 'diamonds' }, dots: { ...current.dots, enabled: preset.pattern === 'dots' } }));
    setTab('design');
  };

  const tabs: Array<{ id: HomeItemTab; label: string; icon: typeof SlidersHorizontal }> = [
    { id: 'shape', label: copy.shape, icon: SlidersHorizontal }, { id: 'profile', label: copy.profile, icon: UserRound }, { id: 'design', label: copy.designTab, icon: Settings2 }, { id: 'community', label: copy.community, icon: UsersRound }, { id: 'materials', label: copy.materials, icon: Box }, { id: 'export', label: copy.export, icon: Download },
  ];

  return <main className="home-item-page"><HomeItemHeader copy={copy} designId={designId} language={language} onLanguage={setLanguage} onSave={saveLocally} saved={saved} onReset={resetDesign} /><div className="home-item-workspace">
    <aside className="home-item-sidebar"><div className="home-item-sidebar-title"><span className="home-item-kicker"><Sparkles size={14} /> {copy.workspace}</span><h1>{copy.title}</h1><p>{copy.subtitle}</p></div><nav className="home-item-tabs" aria-label="Home Item sections">{tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={tab === id ? 'active' : ''} aria-selected={tab === id} onClick={() => setTab(id)}><Icon size={17} /><span>{label}</span></button>)}</nav><div className="home-item-panel-scroll">{tab === 'shape' && <ShapePanel config={config} copy={copy} update={update} updateGroup={updateGroup} />}{tab === 'profile' && <ProfilePanel config={config} copy={copy} update={update} />}{tab === 'design' && <DesignPanel config={config} copy={copy} updateGroup={updateGroup} />}{tab === 'community' && <CommunityPanel copy={copy} onLoad={loadPreset} />}{tab === 'materials' && <MaterialsPanel copy={copy} />}{tab === 'export' && <ExportPanel config={config} copy={copy} onExport={exportStl} exporting={exporting} onColor={(color) => update('color', color)} onSave={saveLocally} onReset={resetDesign} exportStatus={exportStatus} />}</div><footer className="home-item-sidebar-footer"><span>v1.0.0 · {copy.title}</span><span>{Math.round(dimensions.height)}{copy.mm}</span></footer></aside>
    <section className="home-item-viewport" aria-label="Home Item 3D preview"><Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}><HomeItemScene geometry={geometry} config={config} showMesh={showMesh} /></Canvas><div className="home-item-stats"><div><strong>{stats.polygons.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}</strong><span>{copy.polygons}</span><small>{stats.vertices.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} {copy.vertices}</small></div><div className="home-item-quality"><button type="button" className={config.quality === 'low' ? 'active' : ''} onClick={() => update('quality', 'low')}>{copy.low}</button><button type="button" className={config.quality === 'medium' ? 'active' : ''} onClick={() => update('quality', 'medium')}>{copy.medium}</button><button type="button" className={config.quality === 'high' ? 'active' : ''} onClick={() => update('quality', 'high')}>{copy.highShort}</button></div></div><div className="home-item-mask"><div className="home-item-mask-heading"><button type="button" className={config.maskEnabled ? 'active' : ''} onClick={() => update('maskEnabled', !config.maskEnabled)}>{copy.enableMask}</button><strong>{config.maskDepth.toFixed(1)} {copy.mm}</strong></div><div className="home-item-mask-row"><button type="button" disabled={!config.maskEnabled} onClick={() => update('maskInverted', !config.maskInverted)}>{copy.invert}</button><select aria-label="Mask mode" value={config.maskMode} disabled={!config.maskEnabled} onChange={(event) => update('maskMode', event.target.value as MaskMode)}><option value="hard">{copy.hard}</option><option value="soft">{copy.soft}</option><option value="blend">{copy.blend}</option></select></div><RangeControl label={copy.depth} value={config.maskDepth} min={0} max={40} step={.5} unit={copy.mm} onChange={(value) => update('maskDepth', value)} /><button type="button" className="home-item-mask-reset" onClick={() => { update('maskEnabled', false); update('maskInverted', false); update('maskMode', 'blend'); update('maskDepth', 10); }}>{copy.resetMask}</button><span className="home-item-mask-hint">{copy.maskHint}</span></div><div className="home-item-viewport-bottom"><span><Rotate3d size={14} /> {copy.drag} · {copy.scroll}</span><span className="home-item-viewport-actions"><button type="button" className={showMesh ? 'active' : ''} title={showMesh ? copy.hideMesh : copy.mesh} aria-pressed={showMesh} onClick={() => setShowMesh((value) => !value)}>{showMesh ? <EyeOff size={14} /> : <Eye size={14} />} {showMesh ? copy.hideMesh : copy.mesh}</button><button type="button" onClick={downloadDesign}><Download size={14} /> JSON</button></span></div><div className="home-item-measure"><span>{copy.dimensionsBadge}</span><strong>{Math.round(dimensions.height)} {copy.mm}</strong><span>Ø</span><strong>{Math.round(Math.max(dimensions.width, dimensions.length))} {copy.mm}</strong></div><div className="home-item-help-badge"><Info size={13} /> {copy.noSession}</div></section>
  </div></main>;
}
