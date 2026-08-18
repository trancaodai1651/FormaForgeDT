import {
  ArrowLeft, Box, Check, ChevronDown, ChevronUp, Copy, Download, Eye, EyeOff,
  FileUp, GripVertical, Languages, Layers3, Lightbulb, Move3D, Plus, RotateCcw,
  Save, ShieldCheck, SlidersHorizontal, Sparkles, Spline, Trash2,
} from 'lucide-react';
import { Environment, Grid, Lightformer, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import * as THREE from 'three';
import { useI18n } from './lib/i18n';
import {
  HARDWARE_CATALOG, JOINT_CATALOG, createDefaultModuleProject, createLampModule,
  loadModuleStudioProject, parseModuleProject, saveModuleStudioProject, type HardwareId, type JointType, type LampModule,
  type ModuleKind, type ModuleStudioProject, type SketchPoint,
} from './moduleStudio/model';
import {
  buildModuleGeometry, computeAssemblyPlacements, exportModuleAssemblySTL,
  getAssemblyDimensions, type ModuleGeometryPart,
} from './moduleStudio/geometry';
import './moduleStudio/styles.css';

type CameraPreset = 'iso' | 'front' | 'top';
type MobilePanel = 'modules' | 'view' | 'properties';

const colorPresets = ['#e2d7c4', '#f2efe7', '#202327', '#b88b52', '#a94442', '#4d6d8c', '#6c8060'];

function downloadFile(data: BlobPart, mime: string, filename: string) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function RangeControl({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }) {
  return <label className="module-range"><span><span>{label}</span><strong>{Number.isInteger(value) ? value : value.toFixed(2)}{unit}</strong></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function SketchCard({ points, moduleId, onOpen }: { points: SketchPoint[]; moduleId?: string; onOpen: () => void }) {
  const { t } = useI18n();
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${28 + point.radius * 226} ${224 - point.height * 192}`).join(' ');
  return <div className="module-sketch-card">
    <div className="module-section-title"><div><span>01 / PROFILE</span><strong>{t('moduleStudio.sketch')}</strong></div><span className="module-live"><i />CAD</span></div>
    <svg className="module-sketch-pad summary" viewBox="0 0 272 240" role="img" aria-label={t('moduleStudio.sketchHint')}>
      <defs><pattern id="module-grid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="currentColor" strokeOpacity=".12" /></pattern></defs>
      <rect width="272" height="240" rx="18" fill="url(#module-grid)" />
      <line x1="28" y1="16" x2="28" y2="224" stroke="currentColor" strokeOpacity=".4" strokeDasharray="4 4" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => <circle key={`${point.height}-${index}`} cx={28 + point.radius * 226} cy={224 - point.height * 192} r="3.5" />)}
    </svg>
    <p>{t('moduleStudio.sketchHint')}</p>
    <Link className="module-open-sketch" to={`/module-studio/sketch${moduleId ? `?module=${encodeURIComponent(moduleId)}` : ''}`} onClick={onOpen}><Spline size={15} />{t('moduleStudio.openSketch')}</Link>
  </div>;
}

function CameraRig({ preset, targetY }: { preset: CameraPreset; targetY: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const positions: Record<CameraPreset, [number, number, number]> = { iso: [260, 220, 260], front: [0, targetY + 20, 360], top: [0, 440, .01] };
    camera.position.set(...positions[preset]);
    camera.lookAt(0, targetY, 0);
    camera.updateProjectionMatrix();
  }, [camera, preset, targetY]);
  return null;
}

function ModuleMesh({ module, y, sketch, hardware, selected, lightOn, brightness, lightColor, onSelect, onOffset }: { module: LampModule; y: number; sketch: SketchPoint[]; hardware: HardwareId; selected: boolean; lightOn: boolean; brightness: number; lightColor: string; onSelect: () => void; onOffset: (offset: number) => void }) {
  const parts = useMemo(() => buildModuleGeometry(module, sketch, hardware), [hardware, module, sketch]);
  const drag = useRef<{ clientY: number; offset: number } | null>(null);
  useEffect(() => () => parts.forEach((part) => part.geometry.dispose()), [parts]);
  const beginDrag = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation(); onSelect();
    drag.current = { clientY: event.clientY, offset: module.offsetY };
    const target = event.target as unknown as { setPointerCapture?: (pointerId: number) => void };
    target.setPointerCapture?.(event.pointerId);
  };
  const moveDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    event.stopPropagation();
    onOffset(Math.max(-40, Math.min(80, drag.current.offset - (event.clientY - drag.current.clientY) * .32)));
  };
  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    event.stopPropagation(); drag.current = null;
    const target = event.target as unknown as { releasePointerCapture?: (pointerId: number) => void };
    target.releasePointerCapture?.(event.pointerId);
  };
  if (!module.visible) return null;
  return <group position={[0, y, 0]} rotation={[0, module.rotation * Math.PI / 180, 0]} onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
    {parts.map((part: ModuleGeometryPart, index) => {
      const isLight = part.role === 'light' || part.role === 'preview';
      const color = part.role === 'hardware' ? '#17191d' : part.role === 'joint' ? '#ba8b4b' : module.color;
      return <mesh key={`${part.role}-${index}`} geometry={part.geometry} position={part.position} rotation={part.rotation} castShadow receiveShadow>
        <meshPhysicalMaterial color={isLight && lightOn ? lightColor : color} roughness={isLight ? .22 : .52} metalness={part.role === 'joint' ? .35 : .04} clearcoat={selected ? .55 : .15} transparent={isLight} opacity={isLight ? .72 : 1} emissive={isLight && lightOn ? lightColor : '#000000'} emissiveIntensity={isLight && lightOn ? brightness * 2.4 : selected ? .08 : 0} />
      </mesh>;
    })}
    {selected && <><mesh position={[0, -module.height / 2 - 2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[module.diameter / 2 + 3, .5, 6, 72]} /><meshBasicMaterial color="#f0b967" transparent opacity={.82} /></mesh><mesh position={[0, module.height / 2 + 2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[module.diameter / 2 + 3, .5, 6, 72]} /><meshBasicMaterial color="#f0b967" transparent opacity={.82} /></mesh></>}
  </group>;
}

function ModuleScene({ project, selectedId, cameraPreset, autoRotate, onSelect, onOffset }: { project: ModuleStudioProject; selectedId: string; cameraPreset: CameraPreset; autoRotate: boolean; onSelect: (id: string) => void; onOffset: (id: string, offset: number) => void }) {
  const placements = useMemo(() => computeAssemblyPlacements(project.modules), [project.modules]);
  const dimensions = useMemo(() => getAssemblyDimensions(project.modules), [project.modules]);
  const targetY = dimensions.height / 2;
  const warmth = Math.max(0, Math.min(1, (project.lightTemperature - 2200) / 4300));
  const lightColor = new THREE.Color().lerpColors(new THREE.Color('#ff9f55'), new THREE.Color('#d9efff'), warmth).getStyle();
  return <>
    <color attach="background" args={['#101215']} />
    <PerspectiveCamera makeDefault fov={38} near={.1} far={3000} position={[260, 220, 260]} />
    <CameraRig preset={cameraPreset} targetY={targetY} />
    <ambientLight intensity={project.lightOn ? .3 : .7} />
    <directionalLight position={[180, 300, 220]} intensity={project.lightOn ? 1 : 2.2} castShadow />
    <directionalLight position={[-160, 140, -100]} intensity={.7} />
    {project.lightOn && <pointLight position={[0, Math.min(90, Math.max(42, targetY * .6)), 0]} color={lightColor} intensity={project.brightness * 340} distance={420} decay={2} />}
    <Environment resolution={128} background={false}><Lightformer form="rect" intensity={2.4} position={[0, 160, -300]} scale={[350, 350, 1]} /><Lightformer form="rect" intensity={1.2} position={[-260, 180, 120]} scale={[240, 240, 1]} /></Environment>
    <group position={[0, 0, 0]}>{placements.map(({ module, y }) => <ModuleMesh key={module.id} module={module} y={y} sketch={project.sketch} hardware={project.hardware} selected={module.id === selectedId} lightOn={project.lightOn} brightness={project.brightness} lightColor={lightColor} onSelect={() => onSelect(module.id)} onOffset={(offset) => onOffset(module.id, offset)} />)}</group>
    <Grid position={[0, -.5, 0]} args={[700, 700]} cellSize={10} cellThickness={.5} cellColor="#2c3035" sectionSize={50} sectionThickness={1} sectionColor="#555c66" fadeDistance={750} fadeStrength={1.2} infiniteGrid />
    <OrbitControls key={cameraPreset} makeDefault target={[0, targetY, 0]} enableDamping dampingFactor={.1} autoRotate={autoRotate} autoRotateSpeed={.8} minDistance={110} maxDistance={850} />
  </>;
}

function ModuleList({ modules, selectedId, onSelect, onMove, onToggle, onDelete, onDropModule }: { modules: LampModule[]; selectedId: string; onSelect: (id: string) => void; onMove: (id: string, direction: -1 | 1) => void; onToggle: (id: string) => void; onDelete: (id: string) => void; onDropModule: (sourceId: string, targetId: string) => void }) {
  const { t } = useI18n();
  const dragged = useRef<string | null>(null);
  return <div className="module-stack-list">{modules.map((module, index) => <article key={module.id} className={module.id === selectedId ? 'active' : ''} draggable onDragStart={() => { dragged.current = module.id; }} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged.current) onDropModule(dragged.current, module.id); dragged.current = null; }} onClick={() => onSelect(module.id)}>
    <GripVertical size={16} className="module-drag-handle" />
    <span className={`module-kind-icon kind-${module.kind}`}><Layers3 size={15} /></span>
    <span className="module-list-copy"><strong>{module.name}</strong><small>{module.diameter.toFixed(0)} × {module.height.toFixed(0)} mm · {t(`moduleStudio.joint.${module.bottomJoint}`)}</small></span>
    <span className="module-list-actions"><button type="button" aria-label={t('moduleStudio.moveUp')} disabled={index === 0} onClick={(event) => { event.stopPropagation(); onMove(module.id, -1); }}><ChevronUp size={14} /></button><button type="button" aria-label={t('moduleStudio.moveDown')} disabled={index === modules.length - 1} onClick={(event) => { event.stopPropagation(); onMove(module.id, 1); }}><ChevronDown size={14} /></button><button type="button" aria-label={module.visible ? t('moduleStudio.hide') : t('moduleStudio.show')} onClick={(event) => { event.stopPropagation(); onToggle(module.id); }}>{module.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button><button type="button" className="delete" aria-label={t('moduleStudio.delete')} onClick={(event) => { event.stopPropagation(); onDelete(module.id); }}><Trash2 size={14} /></button></span>
  </article>)}</div>;
}

export function ModuleLampStudioPage() {
  const { t, language, toggleLanguage } = useI18n();
  const [project, setProject] = useState<ModuleStudioProject>(loadModuleStudioProject);
  const [selectedId, setSelectedId] = useState(() => project.modules.at(-1)?.id ?? '');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('iso');
  const [autoRotate, setAutoRotate] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('view');
  const openInput = useRef<HTMLInputElement>(null);
  const dimensions = useMemo(() => getAssemblyDimensions(project.modules), [project.modules]);
  const selected = project.modules.find((module) => module.id === selectedId) ?? project.modules[0];
  const hardware = HARDWARE_CATALOG[project.hardware];

  useEffect(() => {
    const timer = window.setTimeout(() => saveModuleStudioProject(project), 180);
    return () => window.clearTimeout(timer);
  }, [project]);

  const updateProject = (patch: Partial<ModuleStudioProject>) => setProject((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
  const updateModule = (id: string, patch: Partial<LampModule>) => setProject((current) => ({ ...current, modules: current.modules.map((module) => module.id === id ? { ...module, ...patch } : module), updatedAt: new Date().toISOString() }));
  const addModule = (kind: ModuleKind) => {
    const module = createLampModule(kind, project.hardware, project.modules.filter((item) => item.kind === kind).length);
    updateProject({ modules: [...project.modules, module] }); setSelectedId(module.id); setMobilePanel('properties');
  };
  const moveModule = (id: string, direction: -1 | 1) => {
    const index = project.modules.findIndex((module) => module.id === id); const target = index + direction;
    if (index < 0 || target < 0 || target >= project.modules.length) return;
    const modules = [...project.modules]; [modules[index], modules[target]] = [modules[target], modules[index]]; updateProject({ modules });
  };
  const reorderModules = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const modules = [...project.modules]; const source = modules.findIndex((module) => module.id === sourceId); const target = modules.findIndex((module) => module.id === targetId);
    if (source < 0 || target < 0) return;
    const [item] = modules.splice(source, 1); modules.splice(target, 0, item); updateProject({ modules });
  };
  const setHardware = (hardwareId: HardwareId) => {
    const adapterDefaults = createLampModule('adapter', hardwareId);
    updateProject({ hardware: hardwareId, modules: project.modules.map((module) => module.kind === 'adapter' ? { ...module, name: adapterDefaults.name, diameter: adapterDefaults.diameter, height: adapterDefaults.height, clearance: adapterDefaults.clearance } : module) });
  };
  const removeModule = (id: string) => {
    const index = project.modules.findIndex((module) => module.id === id);
    if (index < 0) return;
    const modules = project.modules.filter((module) => module.id !== id);
    updateProject({ modules });
    if (selectedId === id) setSelectedId(modules[Math.min(index, modules.length - 1)]?.id ?? '');
  };
  const removeSelected = () => { if (selected) removeModule(selected.id); };
  const duplicateSelected = () => {
    if (!selected) return;
    const duplicate = { ...selected, id: createLampModule(selected.kind, project.hardware).id, name: `${selected.name} copy`, offsetY: selected.offsetY + 6 };
    updateProject({ modules: [...project.modules, duplicate] }); setSelectedId(duplicate.id);
  };
  const resetProject = () => { const next = createDefaultModuleProject(); setProject(next); setSelectedId(next.modules.at(-1)?.id ?? ''); setCameraPreset('iso'); };
  const saveProject = () => downloadFile(JSON.stringify({ ...project, updatedAt: new Date().toISOString() }, null, 2), 'application/json', `${project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'module-lamp'}.hometownlamp`);
  const exportStl = () => downloadFile(exportModuleAssemblySTL(project.modules, project.sketch, project.hardware), 'model/stl', `${project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'module-lamp'}.stl`);
  const openProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try { const next = parseModuleProject(JSON.parse(await file.text())); setProject(next); setSelectedId(next.modules.at(-1)?.id ?? ''); } catch { window.alert(t('moduleStudio.invalidProject')); }
  };

  const validation = useMemo(() => {
    const wallOk = project.modules.every((module) => module.wallThickness >= 1.2);
    const clearanceOk = project.modules.every((module) => module.clearance >= .2);
    const gapWarning = project.modules.some((module) => Math.abs(module.offsetY) > 18);
    return { overall: !wallOk || !clearanceOk ? 'ERROR' : gapWarning ? 'WARNING' : 'SAFE', wallOk, clearanceOk, gapWarning };
  }, [project.modules]);

  return <main className="module-studio" data-mobile-panel={mobilePanel}>
    <header className="module-studio-header">
      <div className="module-studio-brand"><Link to="/" aria-label={t('moduleStudio.back')}><ArrowLeft size={16} /></Link><span className="module-studio-mark">M</span><div><span>FORMAFORGE / MODULE SYSTEM</span><input aria-label={t('moduleStudio.projectName')} value={project.name} onChange={(event) => updateProject({ name: event.target.value })} /></div></div>
      <div className="module-studio-status"><span><i />{t('moduleStudio.autosaved')}</span><span>{project.modules.length} {t('moduleStudio.modules')}</span><span>{dimensions.diameter.toFixed(0)} × {dimensions.height.toFixed(0)} mm</span></div>
      <div className="module-studio-header-actions"><input ref={openInput} type="file" accept=".hometownlamp,.json,application/json" hidden onChange={openProject} /><button type="button" onClick={() => openInput.current?.click()}><FileUp size={15} /><span>{t('moduleStudio.open')}</span></button><button type="button" onClick={saveProject}><Save size={15} /><span>{t('moduleStudio.save')}</span></button><button type="button" onClick={exportStl} className="primary"><Download size={15} /><span>STL</span></button><button type="button" onClick={toggleLanguage} aria-label={t('nav.language')}><Languages size={15} /><span>{language === 'vi' ? 'EN' : 'VI'}</span></button></div>
    </header>

    <nav className="module-mobile-tabs" aria-label={t('moduleStudio.mobileNavigation')}><button className={mobilePanel === 'modules' ? 'active' : ''} onClick={() => setMobilePanel('modules')}><Layers3 size={17} />{t('moduleStudio.modules')}</button><button className={mobilePanel === 'view' ? 'active' : ''} onClick={() => setMobilePanel('view')}><Box size={17} />3D</button><button className={mobilePanel === 'properties' ? 'active' : ''} onClick={() => setMobilePanel('properties')}><SlidersHorizontal size={17} />{t('moduleStudio.properties')}</button></nav>

    <div className="module-studio-layout">
      <aside className="module-studio-sidebar">
        <SketchCard points={project.sketch} moduleId={selected?.kind === 'sketch' ? selected.id : project.modules.find((module) => module.kind === 'sketch')?.id} onOpen={() => saveModuleStudioProject(project)} />
        <section className="module-library"><div className="module-section-title"><div><span>02 / {t('moduleStudio.library').toUpperCase()}</span><strong>{t('moduleStudio.addModule')}</strong></div></div><div className="module-library-grid">{(['core', 'adapter', 'sketch', 'spacer', 'diffuser', 'cap'] as ModuleKind[]).map((kind) => <button type="button" key={kind} onClick={() => addModule(kind)}><Plus size={15} /><span>{t(`moduleStudio.kind.${kind}`)}</span></button>)}</div></section>
        <section className="module-stack"><div className="module-section-title"><div><span>03 / {t('moduleStudio.assembly').toUpperCase()}</span><strong>{t('moduleStudio.stack')}</strong></div><Move3D size={16} /></div><ModuleList modules={project.modules} selectedId={selectedId} onSelect={setSelectedId} onMove={moveModule} onToggle={(id) => updateModule(id, { visible: !project.modules.find((module) => module.id === id)?.visible })} onDelete={removeModule} onDropModule={reorderModules} /></section>
      </aside>

      <section className="module-studio-viewport" aria-label={t('moduleStudio.viewer')}>
        <Canvas dpr={[1, 2]} shadows gl={{ antialias: true }} onPointerMissed={() => setSelectedId('')}><ModuleScene project={project} selectedId={selectedId} cameraPreset={cameraPreset} autoRotate={autoRotate} onSelect={setSelectedId} onOffset={(id, offsetY) => updateModule(id, { offsetY })} /></Canvas>
        <div className="module-viewport-top"><span><Sparkles size={13} />{t('moduleStudio.realtime')}</span><span>{hardware.shortName}</span></div>
        <div className="module-viewport-toolbar"><div><button type="button" className={cameraPreset === 'iso' ? 'active' : ''} onClick={() => setCameraPreset('iso')}>ISO</button><button type="button" className={cameraPreset === 'front' ? 'active' : ''} onClick={() => setCameraPreset('front')}>{t('moduleStudio.front')}</button><button type="button" className={cameraPreset === 'top' ? 'active' : ''} onClick={() => setCameraPreset('top')}>{t('moduleStudio.top')}</button></div><button type="button" className={autoRotate ? 'active' : ''} onClick={() => setAutoRotate((value) => !value)}><RotateCcw size={15} /></button><button type="button" className={project.lightOn ? 'active light' : ''} onClick={() => updateProject({ lightOn: !project.lightOn })}><Lightbulb size={15} /></button></div>
        <div className="module-drag-hint"><Move3D size={14} />{t('moduleStudio.dragHint')}</div>
      </section>

      <aside className="module-studio-inspector">
        <section><div className="module-section-title"><div><span>{t('moduleStudio.hardware').toUpperCase()}</span><strong>{t('moduleStudio.hardware')}</strong></div><ShieldCheck size={16} /></div><div className="module-hardware-options">{(['BAMBU_LED_KIT_001', 'E27'] as HardwareId[]).map((id) => <button type="button" key={id} className={project.hardware === id ? 'active' : ''} onClick={() => setHardware(id)}><span className="hardware-glyph">{id === 'E27' ? 'E27' : 'B01'}</span><span><strong>{HARDWARE_CATALOG[id].name}</strong><small>Ø {HARDWARE_CATALOG[id].diameter} × {HARDWARE_CATALOG[id].height} mm</small></span>{project.hardware === id && <Check size={15} />}</button>)}</div><p className="module-hardware-note">{t('moduleStudio.hardwareNote')}</p></section>

        {selected && <section className="module-properties"><div className="module-section-title"><div><span>MODULE / {t(`moduleStudio.kind.${selected.kind}`).toUpperCase()}</span><strong>{t('moduleStudio.properties')}</strong></div><span className="module-live"><i />{t('moduleStudio.selected').toUpperCase()}</span></div><label className="module-text-field"><span>{t('moduleStudio.moduleName')}</span><input value={selected.name} onChange={(event) => updateModule(selected.id, { name: event.target.value })} /></label><RangeControl label={t('moduleStudio.diameter')} value={selected.diameter} min={40} max={320} unit=" mm" onChange={(diameter) => updateModule(selected.id, { diameter })} /><RangeControl label={t('moduleStudio.height')} value={selected.height} min={8} max={420} unit=" mm" onChange={(height) => updateModule(selected.id, { height })} /><RangeControl label={t('moduleStudio.wall')} value={selected.wallThickness} min={.8} max={5} step={.1} unit=" mm" onChange={(wallThickness) => updateModule(selected.id, { wallThickness })} /><RangeControl label={t('moduleStudio.offset')} value={selected.offsetY} min={-40} max={80} unit=" mm" onChange={(offsetY) => updateModule(selected.id, { offsetY })} /><RangeControl label={t('moduleStudio.rotation')} value={selected.rotation} min={0} max={360} unit="°" onChange={(rotation) => updateModule(selected.id, { rotation })} /><div className="module-two-fields"><label><span>{t('moduleStudio.bottomJoint')}</span><select value={selected.bottomJoint} onChange={(event) => updateModule(selected.id, { bottomJoint: event.target.value as JointType })}>{JOINT_CATALOG.map((joint) => <option key={joint.id} value={joint.id}>{t(`moduleStudio.joint.${joint.id}`)}</option>)}</select></label><label><span>{t('moduleStudio.topJoint')}</span><select value={selected.topJoint} onChange={(event) => updateModule(selected.id, { topJoint: event.target.value as JointType })}>{JOINT_CATALOG.map((joint) => <option key={joint.id} value={joint.id}>{t(`moduleStudio.joint.${joint.id}`)}</option>)}</select></label></div><RangeControl label={t('moduleStudio.clearance')} value={selected.clearance} min={.1} max={1.5} step={.05} unit=" mm" onChange={(clearance) => updateModule(selected.id, { clearance })} /><div className="module-color-row">{colorPresets.map((color) => <button type="button" key={color} className={selected.color === color ? 'active' : ''} aria-label={color} style={{ background: color }} onClick={() => updateModule(selected.id, { color })} />)}<input type="color" value={selected.color} onChange={(event) => updateModule(selected.id, { color: event.target.value })} /></div><div className="module-property-actions"><button type="button" onClick={duplicateSelected}><Copy size={15} />{t('moduleStudio.duplicate')}</button><button type="button" className="danger" onClick={removeSelected}><Trash2 size={15} />{t('moduleStudio.delete')}</button></div></section>}

        <section><div className="module-section-title"><div><span>LIGHT PREVIEW</span><strong>{t('moduleStudio.lighting')}</strong></div><Lightbulb size={16} /></div><RangeControl label={t('moduleStudio.brightness')} value={project.brightness} min={0} max={1.5} step={.05} onChange={(brightness) => updateProject({ brightness })} /><RangeControl label={t('moduleStudio.temperature')} value={project.lightTemperature} min={2200} max={6500} step={100} unit=" K" onChange={(lightTemperature) => updateProject({ lightTemperature })} /></section>

        <section className={`module-validation ${validation.overall.toLowerCase()}`}><div className="module-section-title"><div><span>FDM / BAMBU A1 0.4</span><strong>{t('moduleStudio.validation')}</strong></div><span>{t(`moduleStudio.status.${validation.overall.toLowerCase()}`).toUpperCase()}</span></div><p><i className={validation.wallOk ? 'ok' : 'bad'} />{t('moduleStudio.wallCheck')}<strong>{t(`moduleStudio.status.${validation.wallOk ? 'safe' : 'error'}`).toUpperCase()}</strong></p><p><i className={validation.clearanceOk ? 'ok' : 'bad'} />{t('moduleStudio.clearanceCheck')}<strong>{t(`moduleStudio.status.${validation.clearanceOk ? 'safe' : 'error'}`).toUpperCase()}</strong></p><p><i className={validation.gapWarning ? 'warn' : 'ok'} />{t('moduleStudio.stackCheck')}<strong>{t(`moduleStudio.status.${validation.gapWarning ? 'warning' : 'safe'}`).toUpperCase()}</strong></p></section>
        <button type="button" className="module-reset" onClick={resetProject}><RotateCcw size={15} />{t('moduleStudio.reset')}</button>
      </aside>
    </div>
  </main>;
}
