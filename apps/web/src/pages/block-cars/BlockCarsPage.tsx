import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Bounds, OrbitControls, useBounds } from '@react-three/drei';
import { ArrowLeft, Download, Rotate3D, Ruler, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { useI18n } from '../../lib/i18n';
import './block-cars.css';

import { buildCar, initCarGeometry, isCarGeometryReady, type CarAssembly, type CarOptions } from './carGeometry';
import { models } from './catalog';
import { createPrintKit } from './printKit';

const referenceImages = import.meta.glob('./assets/page-*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const referenceImage = (page: number) => referenceImages[`./assets/page-${String(page).padStart(2, '0')}.jpg`];

export function BlockCarsPage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setReady(false); initCarGeometry().then(() => setReady(true)).catch(e => setError(String(e))); }, [initCarGeometry]);
  return ready && isCarGeometryReady() ? <BlockCarsWorkspace /> : <main className="block-cars-page bc-loading">{error || 'Đang khởi tạo bộ dựng mô hình 3D…'}</main>;
}

type ViewRequest = { version: number; direction?: [number, number, number] };
function FitRequestedView({ request, object }: { request: ViewRequest; object: THREE.Group }) {
  const { camera, controls } = useThree();
  const version = request.version;
  const bounds = useBounds(); const last = useRef(version);
  useEffect(() => { if (last.current !== version) {
    last.current = version;
    if (request.direction) {
      const box = new THREE.Box3().setFromObject(object, true); const center = box.getCenter(new THREE.Vector3());
      camera.position.copy(center).add(new THREE.Vector3(...request.direction).normalize().multiplyScalar(box.getSize(new THREE.Vector3()).length() * 2));
      camera.up.set(0, 1, 0); camera.lookAt(center);
      const orbit = controls as unknown as { target: THREE.Vector3; update(): void } | undefined;
      orbit?.target.copy(center); orbit?.update();
    }
    bounds.refresh(object).fit().clip();
  } }, [version, bounds, object, request, camera, controls]);
  return null;
}

function CarViewport({ assembly, exploded, isolated, view }: { assembly: CarAssembly; exploded: boolean; isolated: string; view: ViewRequest }) {
  const display = useMemo(() => {
    const group = assembly.group.clone();
    group.children.forEach((child, index) => {
      child.visible = !isolated || assembly.parts[index].name === isolated;
      if (exploded) {
        const name = assembly.parts[index].name;
        if (name.startsWith('Tyre') || name.includes('wheel screw')) child.position.z += Math.sign(child.position.z) * (name.includes('screw') ? 40 : 22);
        else if (name.includes('chassis') || name.startsWith('Chassis')) child.position.x += (child.position.x + 18) / 36 * 18;
        else if (name.includes('Front loader') || name.includes('Road roller')) child.position.x -= 28;
        else if (name.startsWith('Dome')) child.position.y += 50;
        else if (name.startsWith('Upper excavator') || name.startsWith('Sliding lift')) { child.position.y += 90; child.position.x -= 24; }
        else child.position.y += name.includes('boom') || name.includes('ladder') ? 70 : 30;
      }
    });
    for (const child of [...group.children]) if (!child.visible) group.remove(child);
    const tool = assembly.tools.find(p => p.name === isolated);
    if (tool) group.add(tool.mesh.clone());
    if (exploded || isolated) { group.updateMatrixWorld(true); const floor = new THREE.Box3().setFromObject(group).min.y; group.position.y = Math.max(0, -floor); }
    return group;
  }, [assembly, exploded, isolated]);
  return <Canvas shadows camera={{ position: [-115, 90, 145], fov: 36, near: 0.1, far: 1800 }} dpr={[1, 1.7]}>
    <color attach="background" args={['#f3f1ec']} /><ambientLight intensity={1.15} />
    <directionalLight castShadow position={[-80, 120, 70]} intensity={2.1} shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
    <hemisphereLight args={['#ffffff', '#b4a995', 0.7]} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]} receiveShadow><planeGeometry args={[1000, 1000]} /><meshStandardMaterial color="#e8e4dc" roughness={0.95} /></mesh>
    <gridHelper args={[300, 30, '#b9b4ab', '#d5d0c7']} position={[0, -0.4, 0]} />
    <Bounds fit clip margin={1.2}><primitive object={display} /><FitRequestedView request={view} object={display} /></Bounds>
    <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={20} maxDistance={1100} target={[0, 24, 0]} />
  </Canvas>;
}

function BlockCarsWorkspace() {
  const { language, setLanguage } = useI18n();
  const vi = language === 'vi';
  const [selected, setSelected] = useState(models[0]);
  const [scale, setScale] = useState(1);
  const [exploded, setExploded] = useState(false);
  const [isolated, setIsolated] = useState('');
  const [compare, setCompare] = useState(true);
  const [view, setView] = useState<ViewRequest>({ version: 0 });
  const requestView = (direction?: ViewRequest['direction']) => setView(v => ({ version: v.version + 1, direction }));
  const [width, setWidth] = useState(42);
  const [clearance, setClearance] = useState(0.25);
  const [cabType, setCabType] = useState<CarOptions['cabType']>();
  const [frontTool, setFrontTool] = useState<CarOptions['frontTool']>();
  const [downloading, setDownloading] = useState(false);
  const assembled = useMemo(() => buildCar(selected, scale, clearance, { width, cabType, frontTool }), [selected, scale, clearance, width, cabType, frontTool]);
  useEffect(() => () => { for (const part of [...assembled.parts, ...assembled.tools]) (part.mesh.material as THREE.Material).dispose(); }, [assembled]);
  const modelIndex = models.findIndex(m => m.id === selected.id);
  const totalLength = Math.round((assembled.bounds.max.x - assembled.bounds.min.x));

  const exportKit = async () => {
    setDownloading(true);
    try {
      const zip = createPrintKit(assembled, selected, scale);
      const blob = new Blob([zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer], { type: 'application/zip' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = href; a.download = `formaforge-${selected.id}-${scale.toFixed(2)}x-print-kit.zip`; a.click();
      setTimeout(() => URL.revokeObjectURL(href), 10000);
    } finally { setDownloading(false); }
  };

  return <main className="block-cars-page">
    <header className="bc-topbar"><Link to="/" className="bc-back"><ArrowLeft size={16} /> {vi ? 'Tất cả công cụ' : 'All tools'}</Link><span className="bc-brand">FORMAFORGE <i>/</i> BLOCK CARS</span><button className="bc-language" onClick={() => setLanguage(vi ? 'en' : 'vi')}>{vi ? 'English' : 'Tiếng Việt'}</button></header>
    <section className="bc-heading"><div><span className="bc-eyebrow">{vi ? 'BỘ LẮP GHÉP XE MÔ-ĐUN' : 'MODULAR VEHICLE KIT'}</span><h1>{vi ? <>Xe khối.<br /><em>Lắp theo cách của bạn.</em></> : <>Block cars.<br /><em>Build your own fleet.</em></>}</h1></div><p>{vi ? 'Chọn một trong 17 mẫu, xoay mô hình 3D và chỉnh kích thước. Mỗi bộ tải xuống gồm cabin, khung xe, bánh và các module chức năng dưới dạng STL riêng.' : 'Choose from 17 reference models, orbit the 3D build and change its size. Each print kit contains separate STL modules for the cabin, chassis, wheels and vehicle equipment.'}</p></section>
    <section className="bc-workspace">
      <aside className="bc-sidebar"><div className="bc-sidebar-title"><span>{vi ? 'THƯ VIỆN MẪU' : 'MODEL LIBRARY'}</span><b>17</b></div><div className="bc-model-list">{models.map((m, i) => <button key={m.id} className={`bc-model-card ${selected.id === m.id ? 'active' : ''}`} onClick={() => { setSelected(m); setIsolated(''); }} aria-pressed={selected.id === m.id}>
        <span className="bc-model-index">{String(i + 1).padStart(2, '0')}</span><img src={referenceImage(m.page)} alt="" loading="lazy" /><span className="bc-model-caption"><strong>{vi ? m.vi : m.en}</strong><small>{vi ? m.category === 'Construction' ? 'Công trình' : m.category === 'Cargo' ? 'Chở hàng' : m.category === 'Service' ? 'Dịch vụ' : 'Đường phố' : m.category}</small></span><span className="bc-model-dot" style={{ background: m.body }} />
      </button>)}</div></aside>
      <div className="bc-main">
        <div className="bc-stage-head"><div><span className="bc-active-index">MODEL {String(modelIndex + 1).padStart(2, '0')} <i>/ 17</i></span><h2>{vi ? selected.vi : selected.en}</h2></div><span className="bc-drag-hint"><Rotate3D size={15} /> {vi ? 'Kéo để xoay · lăn để zoom' : 'Drag to orbit · scroll to zoom'}</span></div>
        <div className="bc-stage"><CarViewport assembly={assembled} exploded={exploded} isolated={isolated} view={view} /><span className="bc-dimensions"><Ruler size={13} /> {totalLength} × {Math.round((assembled.bounds.max.z - assembled.bounds.min.z))} × {Math.round((assembled.bounds.max.y - assembled.bounds.min.y))} mm</span><span className="bc-stage-mark">FORMA / 3D</span></div>
        <div className="bc-inspect-controls">
          <button onClick={() => requestView()}>{vi ? 'Vừa khung nhìn' : 'Fit view'}</button>
          <button onClick={() => requestView([-1.1, 0.8, 1.7])}>{vi ? 'Góc như PDF' : 'PDF angle'}</button>
          <button onClick={() => requestView([-1, 0, 0])}>{vi ? 'Mặt trước' : 'Front'}</button>
          <button onClick={() => requestView([0, 0, 1])}>{vi ? 'Mặt bên' : 'Side'}</button>
          <button onClick={() => requestView([0, 1, 0.001])}>{vi ? 'Mặt trên' : 'Top'}</button>
          <button onClick={() => requestView([0, -1, 0.001])}>{vi ? 'Mặt đáy / khớp' : 'Underside / fittings'}</button>
          <label><input type="checkbox" checked={exploded} onChange={e => setExploded(e.target.checked)} /> {vi ? 'Tách các module' : 'Exploded assembly'}</label>
          <label><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} /> {vi ? 'Đối chiếu hình mẫu' : 'Reference comparison'}</label>
          <select aria-label={vi ? 'Module hiển thị' : 'Visible module'} value={isolated} onChange={e => setIsolated(e.target.value)}><option value="">{vi ? 'Toàn bộ xe' : 'Whole vehicle'}</option>{[...assembled.parts, ...assembled.tools].map(p => <option key={p.name} value={p.name}>{p.name}</option>)}</select>
          <label>{vi ? 'Chiều dài (mm)' : 'Length (mm)'} <input aria-label="Overall length in mm" type="number" min="30" max="600" step="1" value={totalLength} onChange={e => { const value = Number(e.target.value); if (value >= 30 && value <= 600) setScale(value / ((assembled.bounds.max.x - assembled.bounds.min.x) / scale)); }} /></label>
        </div>
        <section className="bc-module-builder" aria-label="Module builder">
          <h3>{vi ? 'Lắp bằng module chung' : 'Assemble shared modules'}</h3>
          <div className="bc-module-settings">
            <label>{vi ? 'Module cabin' : 'Cab module'}<select aria-label="Cab module" value={cabType ?? ''} onChange={e => setCabType(e.target.value as CarOptions['cabType'] || undefined)}><option value="">{vi ? 'Theo mẫu PDF' : 'PDF preset'}</option><option value="flat">{vi ? 'Cabin phẳng' : 'Flat cab'}</option><option value="hood">{vi ? 'Cabin có nắp máy' : 'Hood cab'}</option><option value="car">{vi ? 'Cabin xe con' : 'Car cab'}</option></select></label>
            <label>{vi ? 'Module phía sau' : 'Rear equipment'}<select aria-label="Rear equipment" value={selected.id} onChange={e => { setSelected(models.find(m => m.id === e.target.value)!); setIsolated(''); }}>{models.map(m => <option key={m.id} value={m.id}>{vi ? m.vi : m.en}</option>)}</select></label>
            <label>{vi ? 'Module phía trước' : 'Front equipment'}<select aria-label="Front equipment" value={frontTool ?? ''} onChange={e => { setFrontTool(e.target.value as CarOptions['frontTool'] || undefined); setIsolated(''); }}><option value="">{vi ? 'Theo mẫu PDF' : 'PDF preset'}</option><option value="none">{vi ? 'Không gắn' : 'None'}</option><option value="bucket">{vi ? 'Gầu xúc' : 'Loader bucket'}</option><option value="roller">{vi ? 'Con lăn' : 'Road roller'}</option></select></label>
            <label>{vi ? 'Bề ngang khung (mm ở 1×)' : 'Chassis width (mm at 1×)'}<input aria-label="Chassis width" type="number" min="34" max="60" step="1" value={width} onChange={e => { const w = Number(e.target.value); if (w >= 34 && w <= 60) setWidth(w); }} /></label>
            <label>{vi ? 'Khe hở khớp (mm ở 1×)' : 'Joint clearance (mm at 1×)'}<input aria-label="Joint clearance" type="number" min="0.1" max="0.6" step="0.05" value={clearance} onChange={e => { const c = Number(e.target.value); if (c >= 0.1 && c <= 0.6) setClearance(c); }} /></label>
          </div>
          <div className="bc-joints"><span>{vi ? 'KHỚP CHUNG' : 'SHARED FITTINGS'}</span><p>{vi ? 'Khung: rãnh chữ T trượt xuống · Cabin/thùng: chân đế + chốt tròn Ø6 · Bánh: trục vít + lỗ chờ · Tay cần: ngàm hai má + trục xoay. Các khớp được dựng vào STL.' : 'Chassis: downward T slide · Cab/cargo: seating foot + Ø6 round stud · Wheels: axle screw + pilot hole · Boom: twin cheeks + pivot pin. Fittings are modeled into the STL.'}</p></div>
          <div className="bc-module-pieces">{assembled.parts.filter(p => !p.name.startsWith('Tyre') && !p.name.includes('screw')).map(p => <button key={p.name} aria-pressed={isolated === p.name} onClick={() => { setIsolated(isolated === p.name ? '' : p.name); requestView([-1.1, 0.8, 1.7]); }}>{p.name}</button>)}<button onClick={() => { setIsolated(''); setExploded(true); requestView([-1.1, 0.8, 1.7]); }}>{vi ? 'Xem toàn bộ khớp khi tháo' : 'Inspect disassembled fittings'}</button></div>
        </section>
        {compare && <div className="bc-reference-compare"><img src={referenceImage(selected.page)} alt={vi ? 'Hình tham chiếu từ tài liệu gốc' : 'Original visual reference'} /><p>{vi ? 'Kích thước tự ước lượng. Rãnh, khớp và chi tiết được dựng thành khối 3D; chưa xác nhận trùng CAD gốc hoặc dung sai sau in.' : 'Estimated dimensions. Grooves, joints and details are modeled in 3D; original CAD parity and printed fit are unverified.'} <a href="https://makerworld.com/en/crowdfunding/140-creative-buildable-block-car" target="_blank" rel="noreferrer">MakerWorld ↗</a></p></div>}
        <div className="bc-controls"><label className="bc-scale-control"><span><Ruler size={15} /> {vi ? 'KÍCH THƯỚC' : 'MODEL SIZE'}</span><input aria-label={vi ? 'Tỷ lệ kích thước' : 'Model scale'} type="range" min="0.2" max="10" step="0.01" value={scale} onChange={e => setScale(Number(e.target.value))} /><b>{scale.toFixed(2)}×</b></label><button className="bc-export" onClick={exportKit} disabled={downloading}><Download size={16} /> {downloading ? (vi ? 'Đang đóng gói…' : 'Preparing…') : (vi ? 'TẢI BỘ FILE STL' : 'DOWNLOAD STL KIT')}</button></div>
        <div className="bc-info-grid"><article><span><Wrench size={15} /> {vi ? 'MODULE IN' : 'PRINT MODULES'}</span><strong>{assembled.parts.length} <small>{vi ? 'chi tiết riêng' : 'separate pieces'}</small></strong><p>{vi ? 'STL có rãnh và khớp, kèm tua vít in 3D và dữ liệu lắp ráp.' : 'Solid STL modules with grooves and fittings, plus a printed screwdriver and assembly data.'}</p></article><article><span>{vi ? 'THAM CHIẾU PDF' : 'PDF REFERENCE'}</span><strong>{selected.partCount} <small>{vi ? 'chi tiết' : 'listed parts'}</small></strong><p>{vi ? `Mẫu số ${modelIndex + 1} · trang ${selected.page}` : `Model ${modelIndex + 1} · page ${selected.page}`}</p></article></div>
        <details className="bc-assembly"><summary>{vi ? 'Xem trang mẫu và trình tự lắp' : 'View model page and assembly order'}</summary><div className="bc-assembly-content"><img src={referenceImage(selected.page)} alt={vi ? `Hình mẫu ${selected.vi} và danh sách linh kiện` : `${selected.en} reference and parts list`} /><ol>{(vi ? ['Lắp các module khung xe theo chiều dài mẫu.', 'Đặt bánh vào đúng vị trí rồi vặn vít bánh vào lỗ chờ ở hai bên khung.', 'Ấn cabin và module chức năng lên khung xe.', 'Kiểm tra độ khớp; điều chỉnh dung sai sau khi in thử.'] : ['Connect the chassis modules to match the vehicle length.', 'Place each wheel and fasten its printed screw into the pilot bore on the chassis sides.', 'Seat the cabin and interchangeable equipment on the chassis.', 'Check each fit and tune clearance after a first test print.']).map(x => <li key={x}>{x}</li>)}</ol></div></details>
        <details className="bc-assembly"><summary>{vi ? 'Phương pháp lắp chung trong PDF' : 'Shared assembly methods from the PDF'}</summary><div className="bc-common-pages">{[
          { page: 2, vi: 'Gắn bánh và siết vít in 3D; trang hướng dẫn cũng minh họa tua vít 3D.', en: 'Fit each wheel and tighten its printed screw; the guide also shows a 3D printed screwdriver.' },
          { page: 3, vi: 'Ghép các đoạn khung xe và đặt khoang chở hàng lên chốt.', en: 'Join chassis sections and seat cargo compartments on the locating studs.' },
          { page: 4, vi: 'Gắn dụng cụ phía trước và thêm khoang hàng khi cần.', en: 'Install front tools and add cargo modules as needed.' },
        ].map(step => <figure key={step.page}><img src={referenceImage(step.page)} alt="" loading="lazy" /><figcaption><b>PAGE {step.page}</b><span>{vi ? step.vi : step.en}</span></figcaption></figure>)}</div></details>
      </div>
    </section>
    <footer className="bc-footer"><span>17 REFERENCES / 1 MODULAR SYSTEM</span><span>{vi ? 'Bản dựng tham chiếu có thể chỉnh cỡ · đơn vị mm' : 'Parametric reference rebuild · units in mm'}</span></footer>
  </main>;
}
