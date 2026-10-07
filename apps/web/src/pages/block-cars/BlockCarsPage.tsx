import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, OrbitControls, useBounds } from '@react-three/drei';
import { ArrowLeft, Download, Rotate3D, Ruler, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { useI18n } from '../../lib/i18n';
import './block-cars.css';

import { buildCar, initCarGeometry, isCarGeometryReady, type CarAssembly } from './carGeometry';
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

function FitRequestedView({ version, object }: { version: number; object: THREE.Group }) {
  const bounds = useBounds(); const last = useRef(version);
  useEffect(() => { if (last.current !== version) { last.current = version; bounds.refresh(object).fit().clip(); } }, [version, bounds, object]);
  return null;
}

function CarViewport({ assembly, exploded, isolated, fitVersion }: { assembly: CarAssembly; exploded: boolean; isolated: string; fitVersion: number }) {
  const display = useMemo(() => {
    const group = assembly.group.clone();
    const center = assembly.bounds.getCenter(new THREE.Vector3()).divideScalar(assembly.group.scale.x);
    group.children.forEach((child, index) => {
      child.visible = !isolated || assembly.parts[index].name === isolated;
      if (exploded) {
        const dir = child.position.clone().sub(center);
        if (dir.length() < 2) dir.set(0, 20, 0);
        child.position.add(dir.multiplyScalar(0.65));
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
    <Bounds fit clip margin={1.4}><primitive object={display} /><FitRequestedView version={fitVersion} object={display} /></Bounds>
    <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={20} maxDistance={1100} target={[0, 24, 0]} />
  </Canvas>;
}

function BlockCarsWorkspace() {
  const { language } = useI18n();
  const vi = language === 'vi';
  const [selected, setSelected] = useState(models[0]);
  const [scale, setScale] = useState(1);
  const [exploded, setExploded] = useState(false);
  const [isolated, setIsolated] = useState('');
  const [compare, setCompare] = useState(true);
  const [fitVersion, setFitVersion] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const assembled = useMemo(() => buildCar(selected, scale), [selected, scale]);
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
    <header className="bc-topbar"><Link to="/" className="bc-back"><ArrowLeft size={16} /> {vi ? 'Tất cả công cụ' : 'All tools'}</Link><span className="bc-brand">FORMAFORGE <i>/</i> BLOCK CARS</span><span className="bc-version">3D WORKSPACE</span></header>
    <section className="bc-heading"><div><span className="bc-eyebrow">{vi ? 'BỘ LẮP GHÉP XE MÔ-ĐUN' : 'MODULAR VEHICLE KIT'}</span><h1>{vi ? <>Xe khối.<br /><em>Lắp theo cách của bạn.</em></> : <>Block cars.<br /><em>Build your own fleet.</em></>}</h1></div><p>{vi ? 'Chọn một trong 17 mẫu, xoay mô hình 3D và chỉnh kích thước. Mỗi bộ tải xuống gồm cabin, khung xe, bánh và các module chức năng dưới dạng STL riêng.' : 'Choose from 17 reference models, orbit the 3D build and change its size. Each print kit contains separate STL modules for the cabin, chassis, wheels and vehicle equipment.'}</p></section>
    <section className="bc-workspace">
      <aside className="bc-sidebar"><div className="bc-sidebar-title"><span>{vi ? 'THƯ VIỆN MẪU' : 'MODEL LIBRARY'}</span><b>17</b></div><div className="bc-model-list">{models.map((m, i) => <button key={m.id} className={`bc-model-card ${selected.id === m.id ? 'active' : ''}`} onClick={() => { setSelected(m); setIsolated(''); }} aria-pressed={selected.id === m.id}>
        <span className="bc-model-index">{String(i + 1).padStart(2, '0')}</span><img src={referenceImage(m.page)} alt="" loading="lazy" /><span className="bc-model-caption"><strong>{vi ? m.vi : m.en}</strong><small>{vi ? m.category === 'Construction' ? 'Công trình' : m.category === 'Cargo' ? 'Chở hàng' : m.category === 'Service' ? 'Dịch vụ' : 'Đường phố' : m.category}</small></span><span className="bc-model-dot" style={{ background: m.body }} />
      </button>)}</div></aside>
      <div className="bc-main">
        <div className="bc-stage-head"><div><span className="bc-active-index">MODEL {String(modelIndex + 1).padStart(2, '0')} <i>/ 17</i></span><h2>{vi ? selected.vi : selected.en}</h2></div><span className="bc-drag-hint"><Rotate3D size={15} /> {vi ? 'Kéo để xoay · lăn để zoom' : 'Drag to orbit · scroll to zoom'}</span></div>
        <div className="bc-stage"><CarViewport assembly={assembled} exploded={exploded} isolated={isolated} fitVersion={fitVersion} /><span className="bc-dimensions"><Ruler size={13} /> {totalLength} × {Math.round((assembled.bounds.max.z - assembled.bounds.min.z))} × {Math.round((assembled.bounds.max.y - assembled.bounds.min.y))} mm</span><span className="bc-stage-mark">FORMA / 3D</span></div>
        <div className="bc-inspect-controls">
          <button onClick={() => setFitVersion(v => v + 1)}>{vi ? 'Vừa khung nhìn' : 'Fit view'}</button>
          <label><input type="checkbox" checked={exploded} onChange={e => setExploded(e.target.checked)} /> {vi ? 'Tách các module' : 'Exploded assembly'}</label>
          <label><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} /> {vi ? 'Đối chiếu hình mẫu' : 'Reference comparison'}</label>
          <select aria-label={vi ? 'Module hiển thị' : 'Visible module'} value={isolated} onChange={e => setIsolated(e.target.value)}><option value="">{vi ? 'Toàn bộ xe' : 'Whole vehicle'}</option>{[...assembled.parts, ...assembled.tools].map(p => <option key={p.name} value={p.name}>{p.name}</option>)}</select>
          <label>{vi ? 'Chiều dài (mm)' : 'Length (mm)'} <input aria-label="Overall length in mm" type="number" min="30" max="600" step="1" value={totalLength} onChange={e => { const value = Number(e.target.value); if (value >= 30 && value <= 600) setScale(value / ((assembled.bounds.max.x - assembled.bounds.min.x) / scale)); }} /></label>
        </div>
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
