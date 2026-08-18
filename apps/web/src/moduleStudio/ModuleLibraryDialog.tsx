import { Environment, Lightformer, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { BookmarkPlus, Check, Library, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { buildModuleGeometry } from './geometry';
import { BUILT_IN_MODULE_PRESETS, createModuleFromPreset, type ModulePreset, type ModulePresetCategory } from './library';
import type { HardwareId, LampModule, ModuleShape } from './model';
import './library.css';

type LibraryFilter = 'all' | ModulePresetCategory | 'custom';

const categoryFilters: LibraryFilter[] = ['all', 'shade', 'decor', 'base', 'custom'];

function ModuleSilhouette({ shape, id }: { shape: ModuleShape; id: string }) {
  const patternId = `module-lines-${id.replace(/[^a-z0-9]/gi, '')}`;
  const shadePath = shape === 'shade-pleated-cone' ? 'M36 102 L50 18 H110 L124 102 Z' : shape === 'shade-globe' ? 'M48 31 Q80 5 112 31 Q132 62 111 98 Q80 116 49 98 Q28 62 48 31Z' : shape === 'shade-square' ? 'M34 23 H126 V102 H34Z' : 'M42 18 H118 V103 H42Z';
  return <svg viewBox="0 0 160 120" aria-hidden="true">
    <defs><linearGradient id={`${patternId}-fill`} x1="0" x2="1"><stop stopColor="#fff" stopOpacity=".96" /><stop offset="1" stopColor="#bfc8d2" stopOpacity=".76" /></linearGradient><pattern id={patternId} width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 1H7" stroke="#82909f" strokeOpacity=".38" /></pattern></defs>
    {shape.startsWith('shade-') && <><path d={shadePath} fill={`url(#${patternId}-fill)`} />{['shade-ringed-drum', 'shade-square'].includes(shape) && <path d={shadePath} fill={`url(#${patternId})`} />}{['shade-ribbed-drum', 'shade-pleated-cone'].includes(shape) && Array.from({ length: 13 }, (_, index) => <path key={index} d={`M${43 + index * 6} 21 L${42 + index * 6} 101`} stroke="#8593a1" strokeOpacity=".32" />)}</>}
    {shape === 'standard' && <path d="M42 24 Q80 13 118 24 V95 Q80 108 42 95Z" fill={`url(#${patternId}-fill)`} />}
    {shape === 'decor-sphere' && <ellipse cx="80" cy="62" rx="39" ry="36" fill={`url(#${patternId}-fill)`} />}
    {shape === 'decor-faceted' && <path d="M80 19 122 40 115 88 80 106 45 88 38 40Z" fill={`url(#${patternId}-fill)`} />}
    {shape === 'decor-torus' && <path fillRule="evenodd" d="M80 30C122 30 137 48 137 64S122 98 80 98 23 80 23 64 38 30 80 30Zm0 22C61 52 51 57 51 64s10 12 29 12 29-5 29-12-10-12-29-12Z" fill={`url(#${patternId}-fill)`} />}
    {shape === 'decor-diamond' && <path d="M80 18 128 61 80 106 32 61Z" fill={`url(#${patternId}-fill)`} />}
    {shape === 'decor-cube' && <path d="M42 24H118V102H42Z" fill={`url(#${patternId}-fill)`} />}
    {shape === 'base-disc' && <ellipse cx="80" cy="76" rx="62" ry="24" fill={`url(#${patternId}-fill)`} />}
    {shape === 'base-square' && <path d="M24 54H136V96H24Z" fill={`url(#${patternId}-fill)`} />}
    {shape === 'base-flower' && <path d="M80 35 94 47 113 42 119 59 137 68 124 83 123 101 102 103 80 111 61 103 37 101 38 82 23 68 42 56 48 41 67 47Z" fill={`url(#${patternId}-fill)`} />}
    {shape === 'base-pyramid' && <path d="M80 36 139 96H21Z" fill={`url(#${patternId}-fill)`} />}
    <ellipse cx="80" cy="23" rx="13" ry="5" fill="#5c6976" fillOpacity=".52" /><ellipse cx="80" cy="22" rx="7" ry="2.5" fill="#202832" />
  </svg>;
}

function ModuleLibraryPreview({ preset, hardware, name }: { preset: ModulePreset; hardware: HardwareId; name: string }) {
  const module = useMemo(() => createModuleFromPreset(preset, hardware, name), [hardware, name, preset]);
  const parts = useMemo(() => buildModuleGeometry(module, [], hardware), [hardware, module]);
  useEffect(() => () => parts.forEach((part) => part.geometry.dispose()), [parts]);
  const cameraDistance = Math.max(170, module.diameter * 1.65, module.height * 1.45);
  return <Canvas dpr={[1, 1.5]} shadows frameloop="demand">
    <color attach="background" args={['#111419']} /><PerspectiveCamera makeDefault fov={36} position={[cameraDistance, cameraDistance * .72, cameraDistance]} />
    <ambientLight intensity={1.6} /><directionalLight position={[150, 220, 180]} intensity={2.6} castShadow /><directionalLight position={[-120, 80, -100]} intensity={.75} />
    <group>{parts.map((part, index) => <mesh key={`${part.role}-${index}`} geometry={part.geometry} position={part.position} rotation={part.rotation} castShadow receiveShadow><meshPhysicalMaterial color={part.role === 'joint' ? '#c28b42' : module.color} roughness={.42} metalness={part.role === 'joint' ? .25 : .02} clearcoat={.22} /></mesh>)}</group>
    <mesh position={[0, -module.height / 2 - 8, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[module.diameter * .72, 72]} /><shadowMaterial transparent opacity={.22} /></mesh>
    <Environment resolution={64}><Lightformer form="rect" intensity={2.4} position={[0, 140, -220]} scale={[220, 220, 1]} /><Lightformer form="rect" intensity={1.1} position={[-180, 40, 80]} scale={[140, 180, 1]} /></Environment><OrbitControls makeDefault enablePan={false} minDistance={cameraDistance * .65} maxDistance={cameraDistance * 1.8} target={[0, 0, 0]} />
  </Canvas>;
}

export function ModuleLibraryDialog({ hardware, customPresets, currentModule, onAdd, onSaveCurrent, onDeleteCustom, onClose }: {
  hardware: HardwareId;
  customPresets: ModulePreset[];
  currentModule?: LampModule;
  onAdd: (preset: ModulePreset, localizedName: string) => void;
  onSaveCurrent: () => void;
  onDeleteCustom: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n(); const presets = useMemo(() => [...BUILT_IN_MODULE_PRESETS, ...customPresets], [customPresets]);
  const [filter, setFilter] = useState<LibraryFilter>('all'); const [search, setSearch] = useState(''); const [selectedId, setSelectedId] = useState(presets[0]?.id ?? '');
  const nameOf = (preset: ModulePreset) => preset.name ?? t(preset.nameKey ?? 'moduleLibrary.unnamed');
  const descriptionOf = (preset: ModulePreset) => preset.descriptionKey ? t(preset.descriptionKey) : t('moduleLibrary.customDescription');
  const filtered = presets.filter((preset) => (filter === 'all' || (filter === 'custom' ? preset.custom : preset.category === filter)) && `${nameOf(preset)} ${descriptionOf(preset)}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = presets.find((preset) => preset.id === selectedId) ?? filtered[0] ?? presets[0];
  useEffect(() => { const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown); }, [onClose]);
  useEffect(() => { if (filtered.length && !filtered.some((preset) => preset.id === selectedId)) setSelectedId(filtered[0].id); }, [filtered, selectedId]);

  return <div className="module-library-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="module-library-dialog" role="dialog" aria-modal="true" aria-labelledby="module-library-title">
      <header><div className="module-library-heading"><span className="module-library-glyph"><Library size={20} /></span><div><span>FORMAFORGE / MODULE CATALOG</span><h2 id="module-library-title">{t('moduleLibrary.title')}</h2></div></div><div className="module-library-header-actions">{currentModule && <button onClick={onSaveCurrent}><BookmarkPlus size={16} />{t('moduleLibrary.saveCurrent')}</button>}<button className="icon" onClick={onClose} aria-label={t('moduleLibrary.close')}><X size={18} /></button></div></header>
      <div className="module-library-body">
        <aside className="module-library-navigation"><label><Search size={16} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('moduleLibrary.search')} /></label><nav>{categoryFilters.map((category) => <button key={category} className={filter === category ? 'active' : ''} onClick={() => setFilter(category)}><span>{t(`moduleLibrary.category.${category}`)}</span><b>{category === 'all' ? presets.length : category === 'custom' ? customPresets.length : presets.filter((preset) => preset.category === category && !preset.custom).length}</b></button>)}</nav><div className="module-library-note"><Check size={15} /><p><strong>{t('moduleLibrary.compatible')}</strong><span>{t('moduleLibrary.compatibleHint')}</span></p></div></aside>
        <main className="module-library-results"><div className="module-library-results-head"><span>{filtered.length} {t('moduleLibrary.results')}</span><small>{t('moduleLibrary.clickPreview')}</small></div><div className="module-library-cards">{filtered.map((preset) => <button key={preset.id} className={selected?.id === preset.id ? 'active' : ''} onClick={() => setSelectedId(preset.id)} onDoubleClick={() => onAdd(preset, nameOf(preset))}><span className="module-library-thumb"><ModuleSilhouette shape={preset.module.shape ?? 'standard'} id={preset.id} />{preset.custom && <i>{t('moduleLibrary.custom')}</i>}</span><span className="module-library-card-copy"><strong>{nameOf(preset)}</strong><small>{preset.module.diameter.toFixed(0)} × {preset.module.height.toFixed(0)} mm</small></span>{selected?.id === preset.id && <Check size={15} />}</button>)}</div>{!filtered.length && <div className="module-library-empty"><Library size={30} /><strong>{t('moduleLibrary.empty')}</strong><span>{t('moduleLibrary.emptyHint')}</span></div>}</main>
        {selected && <aside className="module-library-preview"><div className="module-library-preview-canvas"><ModuleLibraryPreview preset={selected} hardware={hardware} name={nameOf(selected)} /><span>{t(`moduleLibrary.category.${selected.category}`)}</span></div><div className="module-library-preview-copy"><small>{selected.custom ? t('moduleLibrary.custom') : 'FORMAFORGE READY MODULE'}</small><h3>{nameOf(selected)}</h3><p>{descriptionOf(selected)}</p></div><dl><div><dt>{t('moduleStudio.diameter')}</dt><dd>{selected.module.diameter.toFixed(0)} mm</dd></div><div><dt>{t('moduleStudio.height')}</dt><dd>{selected.module.height.toFixed(0)} mm</dd></div><div><dt>{t('moduleStudio.bottomJoint')}</dt><dd>{t(`moduleStudio.joint.${selected.module.bottomJoint}`)}</dd></div><div><dt>{t('moduleStudio.topJoint')}</dt><dd>{t(`moduleStudio.joint.${selected.module.topJoint}`)}</dd></div></dl><div className="module-library-preview-actions">{selected.custom && <button className="danger" onClick={() => onDeleteCustom(selected.id)}><Trash2 size={16} />{t('moduleLibrary.deletePreset')}</button>}<button className="primary" onClick={() => onAdd(selected, nameOf(selected))}><Plus size={17} />{t('moduleLibrary.addToLamp')}</button></div></aside>}
      </div>
    </section>
  </div>;
}
