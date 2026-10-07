import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { buildCar, type CarModel, type CarOptions } from './carGeometry';
import { models } from './catalog';

export type LibraryModule = {
  id: string; name: string; vi: string; en: string; category: 'cab' | 'frame' | 'body' | 'tool';
  model: CarModel; options: CarOptions; image: string;
};
const labels: Record<string, string> = {
  'Front chassis with grille': 'Khung trước · mặt ca-lăng',
  'Front chassis with tool slide socket': 'Khung trước · rãnh gắn dụng cụ',
  'Chassis': 'Khung nối phía sau', 'Cargo tray': 'Thùng hàng mở',
  'Tyre': 'Bánh xe', 'Cross socket wheel screw': 'Ốc bánh xe',
  'Printed cross screwdriver': 'Tua vít',
  'Cabin with recessed windows and wipers': 'Cabin · cửa kính và gạt mưa',
  'Tank with straps and filler hatch': 'Bồn nước', 'Open cargo cage': 'Lồng chở hàng',
  'Recycling hopper with embossed arrows': 'Thùng tái chế', 'Hinged recycling rear door': 'Cửa thùng tái chế',
  'Wood crate with plank grooves': 'Kiện gỗ', 'City car rear cabin': 'Thân sau xe con',
  'Extended pickup cab and open bed': 'Thân sau bán tải', 'SUV rear body with roof rack': 'Thân SUV · giá nóc',
  'Van body with recessed panels': 'Thùng xe van', 'Open ribbed dump hopper and front canopy': 'Thùng ben · mái che',
  'Stepped rotating machinery base': 'Đế xoay máy', 'Dome pivot with boom axle bore': 'Chụp khớp xoay',
  'Detailed hinged boom': 'Tay cần', 'Sliding lift fork with open hook': 'Thanh móc trượt',
  'Upper excavator scoop with teeth': 'Gầu cần phía trên', 'Front loader scoop with eight teeth': 'Gầu xúc phía trước',
  'Road roller fork': 'Càng con lăn', 'Road roller drum': 'Trống con lăn',
  'Fire equipment body with side ladders': 'Thùng xe cứu hỏa', 'Ladder rotation cradle': 'Giá xoay thang',
  'Extending fire ladder': 'Thang cứu hỏa', 'Silver telescopic ladder insert': 'Thang trượt nối dài',
  'Mixer cradle': 'Giá đỡ bồn trộn', 'Tapered mixer drum with open mouth': 'Bồn trộn bê tông',
};
export const partLabel = (name: string, vi: boolean) => vi ? labels[name.replace(/ \d+$/, '')] ?? name : name;
const cabKind = (m: CarModel): CarOptions['cabType'] => ['sedan', 'sport', 'pickup'].includes(m.kind) ? 'car' : ['tanker', 'cage', 'recycle', 'crane', 'loader', 'hook', 'mixer'].includes(m.kind) ? 'hood' : 'flat';

let libraryPromise: Promise<LibraryModule[]> | undefined;
const listeners = new Set<(modules: LibraryModule[]) => void>();
let published: LibraryModule[] = [];

// One renderer produces thumbnails from the same solids as the viewport/STL.
// Build between animation frames; do not keep dozens of WebGL canvases alive.
function loadLibrary() {
  return libraryPromise ??= (async () => {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(216, 168); renderer.setPixelRatio(1);
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight('#ffffff', 1.5));
    const key = new THREE.DirectionalLight('#ffffff', 3); key.position.set(-50, 80, 70); scene.add(key);
    const fill = new THREE.DirectionalLight('#d8e6ff', 1); fill.position.set(40, 25, -40); scene.add(fill);
    const camera = new THREE.OrthographicCamera(-25, 25, 20, -20, 0.01, 600);
    const seen = new Set<string>();
    try {
      for (const model of models) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const assembly = buildCar(model, 1);
        try {
          for (const part of [...assembly.parts, ...assembly.tools]) {
            if (/^(Rear spare tyre|Spare wheel screw|Roller screw|Mixer retaining screw)/.test(part.name)) continue;
            const name = part.name.replace(/ \d+$/, '');
            const isCab = name.startsWith('Cabin');
            const category = isCab ? 'cab' : /chassis/i.test(name) ? 'frame' : /^(Tyre|Cross socket|Printed|Front loader|Road roller)/.test(name) ? 'tool' : 'body';
            const options: CarOptions = isCab ? { cabType: cabKind(model) } : {};
            // Semantic variants remain stable even when a Boolean operation
            // changes triangle order. Repeated wheels/screws appear once.
            const frameIndex = name.startsWith('Front') ? 0 : Number(part.name.match(/\d+$/)?.[0] ?? 2) - 1;
            const frameCount = (model.beds ?? 1) + 1;
            const hasAxle = !(frameCount > 2 && frameIndex === frameCount - 2 && frameIndex > 0);
            const variant = isCab ? cabKind(model) : category === 'frame' ? `${frameIndex === 0}:${hasAxle}:${frameIndex < frameCount - 1}:${name.includes('tool') || frameIndex > 0}` : /^(Dome pivot|Detailed hinged boom)/.test(name) && model.kind === 'hook' ? 'hook' : 'standard';
            const id = `${name}:${variant}`;
            if (seen.has(id)) continue;
            seen.add(id);
            const mesh = part.mesh.clone(); mesh.position.set(0, 0, 0);
            // Show round components face-on, with their shaft/width visible.
            if (/^(Tyre|Cross socket)/.test(name)) mesh.rotation.set(0, 0, 0);
            mesh.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(mesh, true);
            const center = box.getCenter(new THREE.Vector3()); mesh.position.sub(center); mesh.updateMatrixWorld(true);
            camera.position.set(-1.1, 0.8, 1.7).normalize().multiplyScalar(160); camera.lookAt(0, 0, 0);
            const corners = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(center));
            camera.updateMatrixWorld(); const view = camera.matrixWorldInverse;
            const projected = new THREE.Box3().setFromPoints(corners.map(p => p.applyMatrix4(view)));
            const halfH = Math.max(projected.getSize(new THREE.Vector3()).y, projected.getSize(new THREE.Vector3()).x / (216 / 168)) * 0.59;
            camera.left = -halfH * 216 / 168; camera.right = -camera.left; camera.top = halfH; camera.bottom = -halfH; camera.updateProjectionMatrix();
            scene.add(mesh); renderer.render(scene, camera);
            const image = renderer.domElement.toDataURL('image/png'); scene.remove(mesh);
            const vi = isCab ? options.cabType === 'flat' ? 'Cabin phẳng' : options.cabType === 'hood' ? 'Cabin nắp máy' : 'Cabin xe con' : category === 'frame' && frameIndex > 0 ? !hasAxle ? 'Khung giữa · không bánh' : frameIndex < frameCount - 1 ? 'Khung giữa · có bánh' : 'Khung cuối · có bánh' : variant === 'hook' ? name.startsWith('Dome') ? 'Chụp khớp cần móc' : 'Tay cần móc' : partLabel(name, true);
            const en = isCab ? `${options.cabType} cab` : category === 'frame' && frameIndex > 0 ? !hasAxle ? 'Intermediate frame · no wheels' : frameIndex < frameCount - 1 ? 'Intermediate frame · wheels' : 'Rear frame · wheels' : variant === 'hook' ? `${name} · hook lift` : name;
            published = [...published, { id, name: part.name, vi, en, category, model, options, image }];
          }
        } finally {
          for (const p of [...assembly.parts, ...assembly.tools]) (p.mesh.material as THREE.Material).dispose();
        }
        for (const listener of listeners) listener(published);
      }
      return published;
    } finally { renderer.dispose(); }
  })();
}

export function ModuleLibrary({ vi, active, onPick }: { vi: boolean; active: string; onPick: (module: LibraryModule) => void }) {
  const [entries, setEntries] = useState(published);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  useEffect(() => {
    listeners.add(setEntries); let current = true;
    loadLibrary().then(entries => { if (current) setEntries(entries); }).catch(e => { if (current) setError(String(e)); });
    return () => { current = false; listeners.delete(setEntries); };
  }, []);
  return <aside className="bc-sidebar" aria-label={vi ? 'Thư viện module' : 'Parts library'}>
    <div className="bc-sidebar-title"><span>{vi ? 'LINH KIỆN MODULE' : 'PARTS'}</span><b>{entries.length || '…'}</b></div>
    <p className="bc-library-hint">{vi ? 'Chọn từng linh kiện để xem riêng hoặc lắp vào xe.' : 'Pick a part to inspect or assemble into your vehicle.'}</p>
    <div className="bc-part-filters">{[['all', 'Tất cả', 'All'], ['cab', 'Cabin', 'Cabs'], ['frame', 'Khung', 'Frames'], ['body', 'Thân / thùng', 'Bodies'], ['tool', 'Dụng cụ', 'Tools']].map(([id, vn, en]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{vi ? vn : en}</button>)}</div>
    <div className="bc-parts-grid">{entries.filter(e => filter === 'all' || e.category === filter).map(entry => <button key={entry.id} className={`bc-part-card ${active === entry.id ? 'active' : ''}`} aria-label={vi ? entry.vi : entry.en} aria-pressed={active === entry.id} onClick={() => onPick(entry)}><img src={entry.image} alt="" /><span>{vi ? entry.vi : entry.en}</span></button>)}</div>
    {!entries.length && <p className="bc-library-hint">{error || (vi ? 'Đang dựng các linh kiện…' : 'Building parts…')}</p>}
    {entries.length > 0 && error && <p role="alert">{error}</p>}
  </aside>;
}
