import { ArrowLeft, ArrowRight, Box, Check, Eye, Lightbulb, LogOut, ShieldCheck, Sun, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Environment, Grid, Lightformer, OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MeshData } from '@hometown/types';
import { export3MF, exportSTL } from '@hometown/geometry';
import { AdminGuard } from './AdminGuard';
import { useI18n } from './lib/i18n';
import { signOutAdmin } from './lib/supabase';
import { buildFlexLampGeometry, loadImagePattern, meshFromBufferGeometry, normalizeMeshData, type FlexLampConfig, type FlexLampPattern, type ImagePattern } from './flexLamp/geometry';
import { buildReferenceShade, type ReferenceShadeResult } from './flexLamp/referenceWorker';
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
  finishLedLamp: `${FLEX_LAMP_ASSET_BASE}finishledlamp.glb`,
  finishShortLedLamp: `${FLEX_LAMP_ASSET_BASE}finishshortledlamp.glb`,
} as const;
const FLEX_LAMP_METRICS = {
  socketHeight: 104.8991,
  lightSource: { x: 0, y: 0, z: 5 },
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
    next.computeVertexNormals();
    return next;
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
    <meshPhysicalMaterial color={color} roughness={view === 'matte' ? Math.max(materialSettings.roughness, .6) : materialSettings.roughness} clearcoat={materialSettings.clearcoat} clearcoatRoughness={.1} envMapIntensity={materialSettings.envMapIntensity} metalness={0} flatShading transparent={isXray} opacity={isXray ? .34 : 1} depthWrite={!isXray} side={isXray ? THREE.DoubleSide : THREE.FrontSide} emissive={isLight ? color : '#000000'} emissiveIntensity={isLight ? .22 : 0} transmission={isLight ? .45 : 0} thickness={isLight ? 3 : 0} ior={1.46} />
  </mesh>;
}

function firstGeometry(root: THREE.Object3D) {
  let geometry: THREE.BufferGeometry | null = null;
  root.traverse((child) => {
    if (!geometry && child instanceof THREE.Mesh) geometry = child.geometry;
  });
  if (!geometry) throw new Error('Flex Lamp asset has no mesh.');
  return geometry as THREE.BufferGeometry;
}

function ReferenceAssembly({ view, mode, showFallback }: { view: ViewMode; mode: LampMode; showFallback: boolean }) {
  const kit = useGLTF(FLEX_LAMP_ASSETS.ledLampKit);
  const light = useGLTF(FLEX_LAMP_ASSETS.ledLight);
  const switchAsset = useGLTF(FLEX_LAMP_ASSETS.ledSwitch);
  const finish = useGLTF(FLEX_LAMP_ASSETS.finishLedLamp);
  const finishShort = useGLTF(FLEX_LAMP_ASSETS.finishShortLedLamp);
  const dimmed = view === 'light';
  const kitGeometry = useMemo(() => firstGeometry(kit.scene), [kit.scene]);
  const lightGeometry = useMemo(() => firstGeometry(light.scene), [light.scene]);
  const switchGeometry = useMemo(() => firstGeometry(switchAsset.scene), [switchAsset.scene]);
  const finishGeometry = useMemo(() => firstGeometry(finish.scene), [finish.scene]);
  const finishShortGeometry = useMemo(() => firstGeometry(finishShort.scene), [finishShort.scene]);
  return <group name="lockedGroup">
    {(showFallback || mode === 'model') && <mesh geometry={mode === 'model' ? finishShortGeometry : finishGeometry} castShadow receiveShadow>
      <meshStandardMaterial color="#d9d6cf" roughness={.6} metalness={.02} flatShading />
    </mesh>}
    <mesh geometry={kitGeometry}>
      <meshStandardMaterial color="#3a3d42" metalness={.55} roughness={.4} flatShading />
    </mesh>
    <mesh geometry={lightGeometry}>
      <meshStandardMaterial color="#f5efd6" emissive={dimmed ? '#ffb46b' : '#000000'} emissiveIntensity={dimmed ? 1.6 : 0} toneMapped={false} />
    </mesh>
    <mesh geometry={switchGeometry}>
      <meshStandardMaterial color="#3a3d42" metalness={.55} roughness={.4} flatShading />
    </mesh>
    <mesh position={[FLEX_LAMP_METRICS.switch.x, FLEX_LAMP_METRICS.switch.y, FLEX_LAMP_METRICS.switch.z + 1.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[5, 5, 3, 24]} />
      <meshStandardMaterial color="#c0392b" metalness={.2} roughness={.5} emissive={dimmed ? '#5b100d' : '#000000'} emissiveIntensity={dimmed ? .35 : 0} />
    </mesh>
  </group>;
}

function PreviewScene({ mesh, color, view, material, mode }: { mesh: MeshData | null; color: string; view: ViewMode; material: Material; mode: LampMode }) {
  const isLight = view === 'light';
  return <>
    <color attach="background" args={['#e4e9ef']} />
    <PerspectiveCamera makeDefault position={[190, -210, 150]} fov={42} near={1} far={5000} up={[0, 0, 1]} />
    <hemisphereLight args={['#dfe4ea', '#191b1e', isLight ? .12 : .55]} />
    <directionalLight position={[120, -80, 260]} intensity={isLight ? .4 : 2.1} castShadow />
    <directionalLight position={[-160, 140, 120]} intensity={isLight ? .2 : .7} />
    {isLight && <>
      <pointLight position={[FLEX_LAMP_METRICS.lightSource.x, FLEX_LAMP_METRICS.lightSource.y, FLEX_LAMP_METRICS.lightSource.z]} intensity={4.8} color="#ffb46b" decay={0} distance={0} />
      <ambientLight color="#ffb46b" intensity={.64} />
    </>}
    <Environment resolution={256} background={false} environmentIntensity={isLight ? .25 : 1}>
      <Lightformer form="rect" intensity={2.5} position={[0, -400, 320]} scale={[600, 600, 1]} target={[0, 0, 50]} />
      <Lightformer form="rect" intensity={1.2} position={[420, 320, 220]} scale={[320, 320, 1]} target={[0, 0, 50]} />
      <Lightformer form="rect" intensity={.7} position={[-420, 220, 140]} scale={[320, 320, 1]} target={[0, 0, 50]} />
    </Environment>
    <ReferenceAssembly view={view} mode={mode} showFallback={mode === 'shade' && !mesh} />
    {mesh && <PreviewObject mesh={mesh} color={color} view={view} material={material} />}
    <Grid rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]} args={[400, 400]} cellSize={10} cellThickness={.6} cellColor="#c7ccd4" sectionSize={50} sectionThickness={1} sectionColor="#a7aebb" fadeDistance={600} fadeStrength={1.2} infiniteGrid />
    <OrbitControls enablePan enableDamping dampingFactor={.12} target={[0, 0, FLEX_LAMP_METRICS.socketHeight * .45]} minDistance={60} maxDistance={900} makeDefault />
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
  const [generating, setGenerating] = useState(false);
  const [referenceShade, setReferenceShade] = useState<ReferenceShadeResult | null>(null);
  const [config, setConfig] = useState<FlexLampConfig>({ pattern: 'circle', around: 18, rows: 9, cellSize: 12, rotation: 0, radius: 34.3, height: 88.9, wallThickness: 1.6, image: null, imageThreshold: .32 });
  const generatedImage = useMemo(() => buildFlexLampGeometry({ ...config, image }), [config, image]);
  const activeMesh = mode === 'model' ? model : image ? generatedImage.mesh : referenceShade?.mesh ?? null;
  const triangleCount = referenceShade && mode === 'shade' && !image ? referenceShade.triangles : activeMesh ? Math.floor(activeMesh.indices.length / 3) : 0;
  const volume = referenceShade && mode === 'shade' && !image ? referenceShade.volume : activeMesh ? Math.max(1, Math.round(activeMesh.metadata.width * activeMesh.metadata.height * activeMesh.metadata.depth * .0000552 * 10) / 10) : 0;
  const generationTime = referenceShade && mode === 'shade' && !image ? referenceShade.generationTime : Math.max(1, Math.round(triangleCount / 66.8));

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  useEffect(() => {
    if (mode !== 'shade' || image) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setGenerating(true);
      setError('');
      void buildReferenceShade(config)
        .then((result) => { if (!cancelled) setReferenceShade(result); })
        .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not generate the Flex Lamp shade.'); })
        .finally(() => { if (!cancelled) setGenerating(false); });
    }, 80);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [config, image, mode]);

  const clearImage = () => { setImage(null); setImageUrl(null); };

  const setValue = (key: keyof FlexLampConfig, value: number | FlexLampPattern) => setConfig((current) => ({ ...current, [key]: value }));
  const reset = () => { setMode(null); setView('solid'); setMaterial('PLA'); setColor('#d9d6cf'); clearImage(); setModel(null); setModelName(''); setModelConfirmed(false); setReferenceShade(null); setError(''); setConfig({ pattern: 'circle', around: 18, rows: 9, cellSize: 12, rotation: 0, radius: 34.3, height: 88.9, wallThickness: 1.6, image: null, imageThreshold: .32 }); };

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
    if (!activeMesh) return;
    const name = mode === 'model' && modelName ? modelName.replace(/\.[^/.]+$/, '') : image ? image.name.replace(/\.[^/.]+$/, '') : 'flex-lamp-shade';
    if (extension === 'stl') downloadFile(exportSTL(activeMesh, name), 'model/stl', `${name}.stl`);
    else downloadFile(export3MF(activeMesh, name), 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml', `${name}.3mf`);
  };

  const signOut = async () => { await signOutAdmin(); navigate('/admin'); };
  if (!mode) return <FlexLampModeChooser email={email} onChoose={setMode} onLanguage={toggleLanguage} language={language} onSignOut={() => { void signOut(); }} />;

  return <main className="flex-lamp-app"><div className="flex-lamp-layout">
        <div className="flex-lamp-viewport">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}><PreviewScene mesh={activeMesh} color={color} view={view} material={material} mode={mode} /></Canvas>
          <div className="flex-lamp-viewport-note"><span className="live-dot" />{mode === 'model' && model ? modelName : image ? image.name : t('admin.flexLampRealtime')}</div>
          <div className="flex-lamp-viewport-help">{t('admin.flexLampOrbitHint')}</div>
          <div className="flex-lamp-canvas-tools" aria-label={t('admin.flexLampView')}>{([['solid', Box], ['matte', Eye], ['xray', X], ['light', Lightbulb]] as const).map(([item, Icon]) => <button type="button" key={item} className={view === item ? 'active' : ''} onClick={() => setView(item)} aria-label={t(`admin.flexLamp${item[0].toUpperCase()}${item.slice(1)}`)}><Icon size={15} /></button>)}</div>
        </div>
        <aside className="flex-lamp-panel">
          <div className="flex-lamp-panel-brand"><div><strong>{t('admin.flexLamp')}</strong><small>{t('admin.flexLampSubtitle')}</small></div><div className="flex-lamp-panel-brand-actions"><button type="button" onClick={toggleLanguage}>{language === 'vi' ? 'English' : 'Tiếng Việt'}</button><Link to="/admin" aria-label={t('admin.backToDashboard')}><ArrowLeft size={14} /></Link></div></div>
          <div className="flex-lamp-panel-mode"><span>{t('admin.flexLampMode')}: <strong>{mode === 'shade' ? t('admin.flexLampShade') : t('admin.flexLampModel')}</strong></span><button type="button" onClick={reset}>{t('admin.flexLampReset')}</button></div>
          {mode === 'shade' ? <>
             <section className="flex-lamp-section flex-lamp-pattern-section"><div className="flex-lamp-section-head"><strong>{t('admin.flexLampPattern')}</strong></div><label className="flex-lamp-select"><span>{t('admin.flexLampPatternType')}</span><select aria-label={t('admin.flexLampPatternType')} value={config.pattern} onChange={(event) => { setValue('pattern', event.target.value as FlexLampPattern); clearImage(); }}>{(['circle', 'hexagon', 'vertical', 'diamond', 'wave'] as FlexLampPattern[]).map((pattern) => <option value={pattern} key={pattern}>{t(`admin.flexLampPattern.${pattern}`)}</option>)}</select></label><RangeField label={t('admin.flexLampAround')} value={config.around} min={3} max={80} unit="" onChange={(value) => setValue('around', value)} /><RangeField label={t('admin.flexLampRows')} value={config.rows} min={1} max={40} unit="" onChange={(value) => setValue('rows', value)} /><RangeField label={t('admin.flexLampCellSize')} value={config.cellSize} min={2} max={34} step={.5} unit="mm" onChange={(value) => setValue('cellSize', value)} /><RangeField label={t('admin.flexLampRotation')} value={config.rotation} min={0} max={360} unit="°" onChange={(value) => setValue('rotation', value)} />{image && <RangeField label={t('admin.flexLampImageThreshold')} value={config.imageThreshold} min={.05} max={.9} step={.05} unit="" onChange={(value) => setValue('imageThreshold', value)} />}</section>
             {image && <div className="flex-lamp-image-card"><img src={imageUrl ?? ''} alt={image.name} /><div><strong>{t('admin.flexLampImageMapped')}</strong><small>{t('admin.flexLampImageMappedHint')}</small></div><button type="button" aria-label={t('admin.flexLampRemoveImage')} onClick={clearImage}><X size={14} /></button></div>}
          </> : (
            <section className="flex-lamp-section flex-lamp-model-section">
              <div className="flex-lamp-section-head"><strong>{t('admin.flexLampModel')}</strong></div>
              <label className="flex-lamp-upload flex-lamp-upload-large"><b>{modelName || t('admin.flexLampImportModel')}</b><input type="file" accept=".glb,.gltf,.obj,.stl,model/gltf-binary,model/gltf+json" onChange={onModel} /></label>
              {model && <div className="flex-lamp-imported-state"><Check size={15} /><span>{t('admin.flexLampModelLoaded')}</span><strong>{model.metadata.width.toFixed(0)} × {model.metadata.height.toFixed(0)} mm</strong></div>}
            </section>
          )}
          <section className={`flex-lamp-section flex-lamp-result-section${mode === 'model' ? ' is-model' : ''}`}><div className="flex-lamp-section-head"><strong>{t('admin.flexLampResult')}</strong></div>{mode === 'model' ? <button type="button" className="flex-lamp-confirm" onClick={confirmModel} disabled={!model}>{modelConfirmed ? t('admin.flexLampModelConfirmed') : t('admin.flexLampConfirm')}</button> : <><p className="flex-lamp-result-hint">{generating ? t('admin.flexLampLive') : t('admin.flexLampAutoUpdate')}</p>{triangleCount > 0 && <p className="flex-lamp-result-metrics">{triangleCount.toLocaleString()} {t('admin.flexLampTriangles')} · {volume.toFixed(1)} cm³ · {generationTime} ms</p>}</>}</section>
          <section className="flex-lamp-section"><div className="flex-lamp-section-head"><strong>{t('admin.flexLampMaterial')}</strong></div><label className="flex-lamp-material-select"><span>{t('admin.flexLampMaterialType')}</span><select aria-label={t('admin.flexLampMaterialType')} value={material} onChange={(event) => setMaterial(event.target.value as Material)}>{(['PLA', 'PETG', 'ABS'] as Material[]).map((item) => <option key={item} value={item}>{item}</option>)}</select></label><div className="flex-lamp-color-field"><span>{t('admin.flexLampColorLabel')}</span><div className="flex-lamp-color-row"><input aria-label={t('admin.flexLampColorLabel')} type="color" value={color} onChange={(event) => setColor(event.target.value)} /><input aria-label={t('admin.flexLampColorLabel')} type="text" value={color} onChange={(event) => setColor(event.target.value)} /><div className="flex-lamp-swatches">{colorPresets.map((preset) => <button type="button" key={preset} aria-label={preset} className={color === preset ? 'active' : ''} style={{ background: preset }} onClick={() => setColor(preset)} />)}</div></div></div></section>
          {error && <div className="flex-lamp-error">{error}</div>}
          <section className="flex-lamp-section flex-lamp-export"><div className="flex-lamp-section-head"><strong>{t('admin.flexLampExportStl')}</strong></div><button type="button" onClick={() => exportActive('stl')} disabled={busy || generating || !activeMesh}>{t('admin.flexLampExportStl')}</button><button type="button" onClick={() => exportActive('3mf')} disabled={busy || generating || !activeMesh}>{t('admin.flexLampExport3mf')}</button></section>
        </aside>
      </div>
</main>;
}

export function AdminFlexLampPage() {
  return <AdminGuard>{(user) => <AdminFlexLampContent email={user.email ?? ''} />}</AdminGuard>;
}
