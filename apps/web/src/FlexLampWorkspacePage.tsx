import { ArrowLeft, ArrowRight, Box, Check, Download, Eye, FileUp, ImagePlus, Lightbulb, LogOut, RotateCcw, ShieldCheck, Sun, Upload, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MeshData } from '@hometown/types';
import { export3MF, exportSTL } from '@hometown/geometry';
import { AdminGuard } from './AdminGuard';
import { useI18n } from './lib/i18n';
import { signOutAdmin } from './lib/supabase';
import { buildFlexLampGeometry, loadImagePattern, meshFromBufferGeometry, normalizeMeshData, type FlexLampConfig, type FlexLampPattern, type ImagePattern } from './flexLamp/geometry';
import { attachSocketRing } from './flexLamp/socket';

type LampMode = 'shade' | 'model';
type ViewMode = 'solid' | 'matte' | 'xray' | 'light';
type Material = 'PLA' | 'PETG' | 'ABS';

const colorPresets = ['#d9d6cf', '#e7e7e7', '#1b1b1b', '#d23b3b', '#2f6fdd', '#2e9e5b', '#f2b705'];
const FLEX_LAMP_ASSET_BASE = `${import.meta.env.BASE_URL}flex-lamp-assets/`;
const FLEX_LAMP_ASSETS = {
  ledLampKit: `${FLEX_LAMP_ASSET_BASE}ledlampkit2.glb`,
  ledLight: `${FLEX_LAMP_ASSET_BASE}ledlight.glb`,
  ledSwitch: `${FLEX_LAMP_ASSET_BASE}ledswitch.glb`,
} as const;
const FLEX_LAMP_METRICS = {
  switch: { x: -63.2815, y: 5.25, z: 14.5 },
} as const;
function downloadFile(data: string | Uint8Array, mime: string, name: string) {
  const payload = typeof data === 'string' ? data : data.slice().buffer as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([payload], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getFileExtension(name: string) { return name.toLowerCase().split('.').pop() ?? ''; }

function objectToMeshData(root: THREE.Object3D): MeshData {
  root.updateMatrixWorld(true);
  const vertices: number[] = [];
  const indices: number[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const source = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry;
    const geometry = source.clone().applyMatrix4(object.matrixWorld);
    const position = geometry.getAttribute('position');
    if (position) {
      const offset = vertices.length / 3;
      vertices.push(...Array.from(position.array as ArrayLike<number>));
      indices.push(...Array.from({ length: position.count }, (_, index) => offset + index));
    }
    geometry.dispose();
    if (source !== object.geometry) source.dispose();
  });
  if (vertices.length === 0) throw new Error('The imported model has no usable triangles.');
  return normalizeMeshData({ vertices, indices, metadata: { width: 1, height: 1, depth: 1, wallThickness: 1.6, shape: 'geometric' } });
}

async function loadImportedModel(file: File): Promise<MeshData> {
  const extension = getFileExtension(file.name);
  if (extension === 'stl') {
    const geometry = new STLLoader().parse(await file.arrayBuffer());
    try { return meshFromBufferGeometry(geometry); } finally { geometry.dispose(); }
  }
  if (extension === 'obj') return objectToMeshData(new OBJLoader().parse(await file.text()));
  if (extension === 'glb' || extension === 'gltf') {
    const loader = new GLTFLoader();
    const source = extension === 'glb' ? await file.arrayBuffer() : await file.text();
    const parsed = await new Promise<GLTF>((resolve, reject) => loader.parse(source, '', resolve, reject));
    return objectToMeshData(parsed.scene);
  }
  throw new Error('Supported model formats: GLB, GLTF, OBJ and STL.');
}

function PreviewObject({ mesh, color, view, material }: { mesh: MeshData; color: string; view: ViewMode; material: Material }) {
  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices, 3));
    next.setIndex(mesh.indices);
    const smoothed = mergeVertices(next, 1e-4);
    next.dispose();
    smoothed.computeVertexNormals();
    return smoothed;
  }, [mesh]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const isLight = view === 'light';
  const isXray = view === 'xray';
  const materialSettings = {
    PLA: { roughness: .55, clearcoat: 0, envMapIntensity: .5 },
    PETG: { roughness: .08, clearcoat: 1, envMapIntensity: 1.3 },
    ABS: { roughness: .92, clearcoat: 0, envMapIntensity: .25 },
  }[material];
  return <mesh geometry={geometry} castShadow receiveShadow>
    <meshPhysicalMaterial color={color} roughness={view === 'matte' ? Math.max(materialSettings.roughness, .78) : materialSettings.roughness} clearcoat={materialSettings.clearcoat} clearcoatRoughness={.1} envMapIntensity={materialSettings.envMapIntensity} metalness={0} flatShading transparent={isXray} opacity={isXray ? .32 : 1} depthWrite={!isXray} side={THREE.DoubleSide} wireframe={isXray} emissive={isLight ? color : '#000000'} emissiveIntensity={isLight ? .22 : 0} />
  </mesh>;
}

function ReferenceAssembly({ view }: { view: ViewMode }) {
  const kit = useGLTF(FLEX_LAMP_ASSETS.ledLampKit);
  const light = useGLTF(FLEX_LAMP_ASSETS.ledLight);
  const switchAsset = useGLTF(FLEX_LAMP_ASSETS.ledSwitch);
  const dimmed = view === 'light';
  const kitObject = useMemo(() => {
    const object = kit.scene.clone(true);
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.material = new THREE.MeshStandardMaterial({ color: '#3a3d42', metalness: .55, roughness: .4 });
    });
    return object;
  }, [kit.scene]);
  const switchObject = useMemo(() => {
    const object = switchAsset.scene.clone(true);
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.material = new THREE.MeshStandardMaterial({ color: '#3a3d42', metalness: .55, roughness: .4 });
    });
    return object;
  }, [switchAsset.scene]);
  const lightObject = useMemo(() => {
    const object = light.scene.clone(true);
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.material = new THREE.MeshStandardMaterial({ color: '#f5efd6', emissive: dimmed ? '#ffb46b' : '#000000', emissiveIntensity: dimmed ? 1.6 : 0, toneMapped: false });
    });
    return object;
  }, [light.scene, dimmed]);
  return <group rotation={[-Math.PI / 2, 0, 0]}>
    <primitive object={kitObject} />
    <primitive object={lightObject} />
    <primitive object={switchObject} />
    <mesh position={[FLEX_LAMP_METRICS.switch.x, FLEX_LAMP_METRICS.switch.y, FLEX_LAMP_METRICS.switch.z + 1.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[5, 5, 3, 24]} />
      <meshStandardMaterial color="#c0392b" metalness={.2} roughness={.5} emissive={dimmed ? '#5b100d' : '#000000'} emissiveIntensity={dimmed ? .35 : 0} />
    </mesh>
  </group>;
}

function PreviewScene({ mesh, color, view, material }: { mesh: MeshData; color: string; view: ViewMode; material: Material }) {
  return <>
    <color attach="background" args={['#e4e9ef']} />
    <PerspectiveCamera makeDefault position={[1.9, 1.5, 2.1]} fov={42} near={.01} far={50} up={[0, 1, 0]} />
    <hemisphereLight args={['#dfe4ea', '#191b1e', view === 'light' ? .12 : .55]} />
    <directionalLight position={[1.2, 2.6, .8]} intensity={view === 'light' ? .4 : 2.1} castShadow />
    <directionalLight position={[-1.6, 1.2, -1.4]} intensity={view === 'light' ? .2 : .7} />
    {view === 'light' && <>
      <pointLight position={[0, .05, 0]} intensity={4.8} color="#ffb46b" decay={0} distance={0} />
      <ambientLight color="#ffb46b" intensity={.64} />
    </>}
    <group scale={.01}>
      <PreviewObject mesh={mesh} color={color} view={view} material={material} />
      <ReferenceAssembly view={view} />
    </group>
    <gridHelper args={[4, 40, '#c7ccd4', '#a7aebb']} position={[0, 0, 0]} />
    <OrbitControls enablePan enableDamping dampingFactor={.12} target={[0, .472, 0]} minDistance={.6} maxDistance={9} makeDefault />
  </>;
}

function RangeField({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (value: number) => void }) {
  return <label className="flex-lamp-range"><span><span>{label}</span><strong>{Number.isInteger(value) ? value : value.toFixed(1)}{unit && ` ${unit}`}</strong></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function FlexLampModeChooser({ email, onChoose, onLanguage, language, onSignOut }: { email: string; onChoose: (mode: LampMode) => void; onLanguage: () => void; language: 'en' | 'vi'; onSignOut: () => void }) {
  const { t } = useI18n();
  return <main className="flex-lamp-chooser"><header className="flex-lamp-chooser-bar"><Link to="/admin"><ArrowLeft size={15} />{t('admin.backToDashboard')}</Link><div className="flex-lamp-chooser-brand"><span className="flex-lamp-chooser-mark">L</span><div><span>FORMAFORGE / ADMIN</span><strong>{t('admin.flexLamp')}</strong></div></div><div className="flex-lamp-chooser-session"><span><span className="live-dot" />{t('admin.adminOnly')}</span><small>{email}</small><button type="button" onClick={onLanguage}>{language === 'vi' ? 'EN' : 'VI'}</button><button type="button" onClick={onSignOut}><LogOut size={13} />{t('admin.signOut')}</button></div></header><div className="flex-lamp-chooser-content"><span className="eyebrow"><ShieldCheck size={13} /> {t('admin.flexLampEyebrow')}</span><h1>{t('admin.flexLampChooseMode')}</h1><p>{t('admin.flexLampChooseModeHint')}</p><div className="flex-lamp-chooser-cards"><button type="button" onClick={() => onChoose('shade')}><img src={`${FLEX_LAMP_ASSET_BASE}card-shade.png`} alt="" /><span className="flex-lamp-chooser-card-icon"><Sun size={22} /></span><strong>{t('admin.flexLampShade')}</strong><small>{t('admin.flexLampShadeModeHint')}</small><ArrowRight size={17} /></button><button type="button" onClick={() => onChoose('model')}><img src={`${FLEX_LAMP_ASSET_BASE}card-figure.png`} alt="" /><span className="flex-lamp-chooser-card-icon"><Box size={22} /></span><strong>{t('admin.flexLampModel')}</strong><small>{t('admin.flexLampModelModeHint')}</small><ArrowRight size={17} /></button></div></div></main>;
}

function AdminFlexLampContent({ email }: { email: string }) {
  const { t, language, toggleLanguage } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<LampMode | null>(null);
  const [view, setView] = useState<ViewMode>('solid');
  const [material, setMaterial] = useState<Material>('PLA');
  const [color, setColor] = useState('#d9d6cf');
  const [image, setImage] = useState<ImagePattern | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [model, setModel] = useState<MeshData | null>(null);
  const [modelName, setModelName] = useState('');
  const [modelConfirmed, setModelConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<FlexLampConfig>({ pattern: 'circle', around: 18, rows: 9, cellSize: 12, rotation: 0, radius: 34.3, height: 88.9, wallThickness: 1.6, image: null, imageThreshold: .32 });
  const generated = useMemo(() => buildFlexLampGeometry({ ...config, image }), [config, image]);
  const activeMesh = mode === 'model' && model ? model : generated.mesh;
  const triangleCount = Math.floor(activeMesh.indices.length / 3);
  const volume = Math.max(1, Math.round(activeMesh.metadata.width * activeMesh.metadata.height * activeMesh.metadata.depth * .0000552 * 10) / 10);
  const generationTime = Math.max(1, Math.round(triangleCount / 66.8));

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  const clearImage = () => { setImage(null); setImageUrl(null); };

  const setValue = (key: keyof FlexLampConfig, value: number | FlexLampPattern) => setConfig((current) => ({ ...current, [key]: value }));
  const reset = () => { setMode(null); setView('solid'); setMaterial('PLA'); setColor('#d9d6cf'); clearImage(); setModel(null); setModelName(''); setModelConfirmed(false); setError(''); setConfig({ pattern: 'circle', around: 18, rows: 9, cellSize: 12, rotation: 0, radius: 34.3, height: 88.9, wallThickness: 1.6, image: null, imageThreshold: .32 }); };

  const onImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setError('');
    try {
      const next = await loadImagePattern(file);
      const url = URL.createObjectURL(file);
      setImage(next); setImageUrl(url); setModel(null); setMode('shade');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not import the image.'); }
    finally { setBusy(false); }
  };

  const onModel = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setError('');
    try { setModel(await loadImportedModel(file)); setModelName(file.name); setModelConfirmed(false); setMode('model'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not import the model.'); }
    finally { setBusy(false); }
  };

  const confirmModel = () => { if (model && !modelConfirmed) { setModel(attachSocketRing(model)); setModelConfirmed(true); } };

  const exportActive = (extension: 'stl' | '3mf') => {
    const name = mode === 'model' && modelName ? modelName.replace(/\.[^/.]+$/, '') : image ? image.name.replace(/\.[^/.]+$/, '') : 'flex-lamp-shade';
    if (extension === 'stl') downloadFile(exportSTL(activeMesh, name), 'model/stl', `${name}.stl`);
    else downloadFile(export3MF(activeMesh, name), 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml', `${name}.3mf`);
  };

  const signOut = async () => { await signOutAdmin(); navigate('/admin'); };
  if (!mode) return <FlexLampModeChooser email={email} onChoose={setMode} onLanguage={toggleLanguage} language={language} onSignOut={() => { void signOut(); }} />;

  return <main className="flex-lamp-app"><div className="flex-lamp-layout">
        <div className="flex-lamp-viewport">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}><PreviewScene mesh={activeMesh} color={color} view={view} material={material} /></Canvas>
          <div className="flex-lamp-viewport-note"><span className="live-dot" />{mode === 'model' && model ? modelName : image ? image.name : t('admin.flexLampRealtime')}</div>
          <div className="flex-lamp-viewport-help">{t('admin.flexLampOrbitHint')}</div>
          <div className="flex-lamp-canvas-tools" aria-label={t('admin.flexLampView')}>{([['solid', Box], ['matte', Eye], ['xray', X], ['light', Lightbulb]] as const).map(([item, Icon]) => <button type="button" key={item} className={view === item ? 'active' : ''} onClick={() => setView(item)} aria-label={t(`admin.flexLamp${item[0].toUpperCase()}${item.slice(1)}`)}><Icon size={15} /></button>)}</div>
        </div>
        <aside className="flex-lamp-panel">
          <div className="flex-lamp-panel-brand"><div><strong>{t('admin.flexLamp')}</strong><small>{t('admin.flexLampSubtitle')}</small></div><div className="flex-lamp-panel-brand-actions"><button type="button" onClick={toggleLanguage}>{language === 'vi' ? 'English' : 'Tiếng Việt'}</button><Link to="/admin" aria-label={t('admin.backToDashboard')}><ArrowLeft size={14} /></Link></div></div>
          <div className="flex-lamp-panel-mode"><span>{t('admin.flexLampMode')}: <strong>{mode === 'shade' ? t('admin.flexLampShade') : t('admin.flexLampModel')}</strong></span><button type="button" onClick={reset}><RotateCcw size={13} />{t('admin.flexLampReset')}</button></div>
          {mode === 'shade' ? <>
             <section className="flex-lamp-section"><div className="flex-lamp-section-head"><strong>{t('admin.flexLampPattern')}</strong><span>{t('admin.flexLampLive')}</span></div><label className="flex-lamp-select"><span>{t('admin.flexLampPatternType')}</span><select aria-label={t('admin.flexLampPatternType')} value={config.pattern} onChange={(event) => { setValue('pattern', event.target.value as FlexLampPattern); clearImage(); }}>{(['circle', 'hexagon', 'vertical', 'diamond', 'wave'] as FlexLampPattern[]).map((pattern) => <option value={pattern} key={pattern}>{t(`admin.flexLampPattern.${pattern}`)}</option>)}</select></label><RangeField label={t('admin.flexLampAround')} value={config.around} min={3} max={80} unit="" onChange={(value) => setValue('around', value)} /><RangeField label={t('admin.flexLampRows')} value={config.rows} min={1} max={40} unit="" onChange={(value) => setValue('rows', value)} /><RangeField label={t('admin.flexLampCellSize')} value={config.cellSize} min={2} max={34} step={.5} unit="mm" onChange={(value) => setValue('cellSize', value)} /><RangeField label={t('admin.flexLampRotation')} value={config.rotation} min={0} max={360} unit="°" onChange={(value) => setValue('rotation', value)} />{image && <RangeField label={t('admin.flexLampImageThreshold')} value={config.imageThreshold} min={.05} max={.9} step={.05} unit="" onChange={(value) => setValue('imageThreshold', value)} />}</section>
             <section className="flex-lamp-section flex-lamp-image-section"><div className="flex-lamp-section-head"><strong>{t('admin.flexLampImageTitle')}</strong><span>{t('admin.flexLampOptional')}</span></div><label className="flex-lamp-upload flex-lamp-image-upload"><ImagePlus size={18} /><span><b>{image?.name ?? t('admin.flexLampImportImage')}</b><small>{t('admin.flexLampImageHint')}</small></span><Upload size={15} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={onImage} /></label>{image && <RangeField label={t('admin.flexLampImageThreshold')} value={config.imageThreshold} min={.05} max={.9} step={.05} unit="" onChange={(value) => setValue('imageThreshold', value)} />}</section>
             {image && <div className="flex-lamp-image-card"><img src={imageUrl ?? ''} alt={image.name} /><div><strong>{t('admin.flexLampImageMapped')}</strong><small>{t('admin.flexLampImageMappedHint')}</small></div><button type="button" aria-label={t('admin.flexLampRemoveImage')} onClick={clearImage}><X size={14} /></button></div>}
          </> : (
            <section className="flex-lamp-section">
              <div className="flex-lamp-section-head"><strong>{t('admin.flexLampModel')}</strong><span>GLB / GLTF / OBJ / STL</span></div>
              <label className="flex-lamp-upload flex-lamp-upload-large"><FileUp size={18} /><span><b>{modelName || t('admin.flexLampImportModel')}</b><small>{t('admin.flexLampModelHint')}</small></span><Upload size={15} /><input type="file" accept=".glb,.gltf,.obj,.stl,model/gltf-binary,model/gltf+json" onChange={onModel} /></label>
              {model && <div className="flex-lamp-imported-state"><Check size={15} /><span>{t('admin.flexLampModelLoaded')}</span><strong>{model.metadata.width.toFixed(0)} × {model.metadata.height.toFixed(0)} mm</strong></div>}
            </section>
          )}
          <section className="flex-lamp-section"><div className="flex-lamp-section-head"><strong>{t('admin.flexLampResult')}</strong><span>{t('admin.flexLampAutoUpdate')}</span></div>{mode === 'model' ? <button type="button" className="flex-lamp-confirm" onClick={confirmModel}>{modelConfirmed ? <><Check size={14} />{t('admin.flexLampModelConfirmed')}</> : <><Check size={14} />{t('admin.flexLampConfirm')}</>}</button> : <><p className="flex-lamp-result-hint">{t('admin.flexLampAutoUpdate')}</p><p className="flex-lamp-result-metrics">{triangleCount.toLocaleString()} {t('admin.flexLampTriangles')} · {volume.toFixed(1)} cm³ · {generationTime} ms</p></>}</section>
          <section className="flex-lamp-section"><div className="flex-lamp-section-head"><strong>{t('admin.flexLampMaterial')}</strong></div><label className="flex-lamp-material-select"><span>{t('admin.flexLampMaterialType')}</span><select aria-label={t('admin.flexLampMaterialType')} value={material} onChange={(event) => setMaterial(event.target.value as Material)}>{(['PLA', 'PETG', 'ABS'] as Material[]).map((item) => <option key={item} value={item}>{item}</option>)}</select></label><div className="flex-lamp-color-field"><span>{t('admin.flexLampColorLabel')}</span><div className="flex-lamp-color-row"><input aria-label={t('admin.flexLampColorLabel')} type="color" value={color} onChange={(event) => setColor(event.target.value)} /><input aria-label={t('admin.flexLampColorLabel')} type="text" value={color} onChange={(event) => setColor(event.target.value)} /><div className="flex-lamp-swatches">{colorPresets.map((preset) => <button type="button" key={preset} aria-label={preset} className={color === preset ? 'active' : ''} style={{ background: preset }} onClick={() => setColor(preset)} />)}</div></div></div></section>
          {error && <div className="flex-lamp-error">{error}</div>}
          <div className="flex-lamp-export"><button type="button" onClick={() => exportActive('stl')} disabled={busy}><Download size={15} />{t('admin.flexLampExportStl')}</button><button type="button" onClick={() => exportActive('3mf')} disabled={busy}><Download size={15} />{t('admin.flexLampExport3mf')}</button></div>
        </aside>
      </div>
</main>;
}

export function AdminFlexLampPage() {
  return <AdminGuard>{(user) => <AdminFlexLampContent email={user.email ?? ''} />}</AdminGuard>;
}
