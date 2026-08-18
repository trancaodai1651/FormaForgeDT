import { Grid, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import {
  ArrowLeft, Box, Camera, Check, Circle, CircleDot, Construction, Copy, CornerUpRight,
  Eye, EyeOff, FlipHorizontal, Focus, Grid3X3, Hexagon, History, Languages, Layers3, Link2Off,
  List, Lock, Minus, MousePointer2, Move, PanelRight, PenTool, Redo2, RotateCw,
  Ruler, Scissors, Search, Spline, Square, Trash2, Type, Undo2, Unlock, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as THREE from 'three';
import { useI18n } from './lib/i18n';
import {
  CAD_VIEW, arcPath, cloneEntity, constrainEntities, createCadEntity, entityToProfile,
  nearestEntity, offsetEntity, polygonPoints, primitiveClickCount, profileEntityFromSketch, rotateEntity,
  smoothCadPath, translateEntity, type CadConstraint, type CadDocument, type CadEntity,
  trimEntityAtPoint, type CadPoint, type CadPrimitive, type CadTool,
} from './moduleStudio/cad';
import { buildModuleGeometry } from './moduleStudio/geometry';
import {
  createLampModule, loadModuleStudioProject, sanitizeSketch, saveModuleStudioProject,
  type LampModule, type SketchPoint,
} from './moduleStudio/model';
import './moduleStudio/sketch.css';

type HistoryEntry = { document: CadDocument; label: string };
type DisplayMode = 'shaded' | 'wireframe';
type SidePanel = 'items' | 'history' | null;

const geometryTools: Array<{ id: CadTool; icon: typeof Minus; shortcut: string }> = [
  { id: 'line', icon: Minus, shortcut: 'L' }, { id: 'arc', icon: CornerUpRight, shortcut: 'A' },
  { id: 'spline', icon: Spline, shortcut: 'I' }, { id: 'rectangle', icon: Square, shortcut: 'R' },
  { id: 'circle', icon: Circle, shortcut: 'C' }, { id: 'ellipse', icon: CircleDot, shortcut: 'E' },
  { id: 'polygon', icon: Hexagon, shortcut: 'G' }, { id: 'offset', icon: Copy, shortcut: 'O' },
  { id: 'move', icon: Move, shortcut: 'M' }, { id: 'mirror', icon: FlipHorizontal, shortcut: 'F' },
  { id: 'pattern', icon: Grid3X3, shortcut: 'N' }, { id: 'project', icon: Layers3, shortcut: 'P' },
  { id: 'text', icon: Type, shortcut: 'X' }, { id: 'trim', icon: Scissors, shortcut: 'T' },
  { id: 'delete', icon: Trash2, shortcut: 'Del' },
];

const constraintTools: Array<{ id: CadConstraint; shortcut: string }> = [
  { id: 'parallel', shortcut: '⇧A' }, { id: 'perpendicular', shortcut: '⇧P' },
  { id: 'tangent', shortcut: '⇧T' }, { id: 'coincident', shortcut: '⇧N' },
  { id: 'midpoint', shortcut: '⇧M' }, { id: 'concentric', shortcut: '⇧C' },
  { id: 'horizontalVertical', shortcut: '⇧V' }, { id: 'equal', shortcut: '⇧E' },
  { id: 'symmetry', shortcut: '⇧S' }, { id: 'lock', shortcut: '⇧L' },
];

const toolLabelKey = (tool: CadTool) => `moduleSketch.tool.${tool}`;
const constraintLabelKey = (constraint: CadConstraint) => `moduleSketch.constraint.${constraint}`;

function copyDocument(document: CadDocument): CadDocument {
  return { profileEntityId: document.profileEntityId, entities: document.entities.map((entity) => ({ ...entity, points: entity.points.map((point) => ({ ...point })), constraints: [...entity.constraints] })) };
}

function ClippingController({ active }: { active: boolean }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => { gl.localClippingEnabled = active; return () => { gl.localClippingEnabled = false; }; }, [active, gl]);
  return null;
}

function SketchPreview3D({ module, points, mode, sectionView }: { module: LampModule; points: SketchPoint[]; mode: DisplayMode; sectionView: boolean }) {
  const parts = useMemo(() => buildModuleGeometry(module, points, 'BAMBU_LED_KIT_001'), [module, points]);
  const clippingPlanes = useMemo(() => sectionView ? [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)] : [], [sectionView]);
  useEffect(() => () => parts.forEach((part) => part.geometry.dispose()), [parts]);
  return <>
    <ClippingController active={sectionView} />
    <color attach="background" args={['#eef1f5']} />
    <PerspectiveCamera makeDefault fov={38} position={[250, 150, 250]} />
    <ambientLight intensity={1.4} /><directionalLight position={[180, 260, 190]} intensity={2.2} /><directionalLight position={[-120, 100, -160]} intensity={.8} />
    <group position={[0, module.height / 2, 0]}>{parts.filter((part) => part.role === 'body').map((part, index) => <mesh key={index} geometry={part.geometry} position={part.position} rotation={part.rotation} castShadow receiveShadow>{mode === 'wireframe' ? <meshBasicMaterial color="#3478e5" wireframe clippingPlanes={clippingPlanes} /> : <meshPhysicalMaterial color={module.color} roughness={.42} clearcoat={.25} side={THREE.DoubleSide} clippingPlanes={clippingPlanes} />}</mesh>)}</group>
    <Grid position={[0, 0, 0]} args={[520, 520]} cellSize={10} sectionSize={50} cellColor="#c8ced6" sectionColor="#8f9baa" fadeDistance={600} infiniteGrid />
    <OrbitControls makeDefault target={[0, module.height / 2, 0]} enableDamping minDistance={140} maxDistance={680} />
  </>;
}

function CadEntityShape({ entity, selected, profile }: { entity: CadEntity; selected: boolean; profile: boolean }) {
  if (!entity.visible || !entity.points.length) return null;
  const className = `cad-entity ${selected ? 'selected' : ''} ${profile ? 'profile' : ''} ${entity.construction ? 'construction' : ''} ${entity.locked ? 'locked' : ''}`;
  const [a, b = a, c = b] = entity.points;
  let shape: React.ReactNode;
  if (entity.type === 'line') shape = <path d={smoothCadPath(entity.points)} />;
  else if (entity.type === 'spline') shape = <path d={smoothCadPath(entity.points)} />;
  else if (entity.type === 'arc') shape = <path d={arcPath(entity.points)} />;
  else if (entity.type === 'rectangle') shape = <rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} />;
  else if (entity.type === 'circle') shape = <circle cx={a.x} cy={a.y} r={Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))} />;
  else if (entity.type === 'ellipse') shape = <ellipse cx={a.x} cy={a.y} rx={Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))} ry={Math.max(1, Math.hypot(c.x - a.x, c.y - a.y))} />;
  else if (entity.type === 'polygon') shape = <polygon points={polygonPoints(entity).map((point) => `${point.x},${point.y}`).join(' ')} />;
  else shape = <text x={a.x} y={a.y}>{entity.text}</text>;
  return <g className={className}>{shape}{selected && entity.points.map((point, index) => <g key={index}><circle className="cad-control-halo" cx={point.x} cy={point.y} r="12" /><circle className="cad-control-point" cx={point.x} cy={point.y} r="4.5" /></g>)}{entity.constraints.length > 0 && <text className="cad-constraint-count" x={a.x + 10} y={a.y - 10}>{entity.constraints.length}</text>}</g>;
}

export function ModuleSketchPage() {
  const { t, language, toggleLanguage } = useI18n(); const navigate = useNavigate(); const [searchParams] = useSearchParams();
  const initialProject = useMemo(loadModuleStudioProject, []);
  const initialModule = useMemo(() => initialProject.modules.find((item) => item.id === searchParams.get('module') && item.kind === 'sketch') ?? initialProject.modules.find((item) => item.kind === 'sketch') ?? createLampModule('sketch', initialProject.hardware), [initialProject, searchParams]);
  const initialProfile = useMemo(() => ({ ...profileEntityFromSketch(initialProject.sketch), name: t('moduleSketch.revolveProfile') }), [initialProject.sketch, t]);
  const initialDocument = useMemo<CadDocument>(() => initialProject.cadSketch?.entities?.length ? copyDocument(initialProject.cadSketch) : ({ entities: [initialProfile], profileEntityId: initialProfile.id }), [initialProfile, initialProject.cadSketch]);
  const [document, setDocumentState] = useState(initialDocument); const documentRef = useRef(document);
  const [history, setHistory] = useState<HistoryEntry[]>([{ document: copyDocument(initialDocument), label: t('moduleSketch.history.start') }]); const [historyIndex, setHistoryIndex] = useState(0);
  const [module, setModule] = useState(initialModule); const [tool, setTool] = useState<CadTool>('select'); const [selectedIds, setSelectedIds] = useState<string[]>([initialProfile.id]);
  const [draft, setDraft] = useState<CadPoint[]>([]); const [hoverPoint, setHoverPoint] = useState<CadPoint | null>(null); const [snap, setSnap] = useState(true); const [constructionMode, setConstructionMode] = useState(false);
  const [zoom, setZoom] = useState(1); const [pan, setPan] = useState({ x: 0, y: 0 }); const [displayMode, setDisplayMode] = useState<DisplayMode>('shaded'); const [sidePanel, setSidePanel] = useState<SidePanel>(null); const [constraintPanelOpen, setConstraintPanelOpen] = useState(true);
  const [showPreview, setShowPreview] = useState(true); const [sectionView, setSectionView] = useState(false); const [measureMode, setMeasureMode] = useState(false); const [commandSearch, setCommandSearch] = useState(false); const [searchText, setSearchText] = useState('');
  const dragRef = useRef<{ start: CadPoint; document: CadDocument; entityId: string; pointIndex: number | null } | null>(null);
  const panDragRef = useRef<{ clientX: number; clientY: number; pan: CadPoint } | null>(null);
  const touchPointersRef = useRef(new Map<number, CadPoint>()); const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);

  const setDocument = (next: CadDocument) => { documentRef.current = next; setDocumentState(next); };
  const commitDocument = (next: CadDocument, label: string) => {
    const copy = copyDocument(next); const entries = [...history.slice(0, historyIndex + 1), { document: copy, label }];
    setDocument(copy); setHistory(entries); setHistoryIndex(entries.length - 1);
  };
  const undo = () => { if (historyIndex <= 0) return; const index = historyIndex - 1; setHistoryIndex(index); setDocument(copyDocument(history[index].document)); setSelectedIds([]); };
  const redo = () => { if (historyIndex >= history.length - 1) return; const index = historyIndex + 1; setHistoryIndex(index); setDocument(copyDocument(history[index].document)); setSelectedIds([]); };
  const profilePoints = useMemo(() => sanitizeSketch(entityToProfile(document.entities.find((entity) => entity.id === document.profileEntityId), initialProject.sketch)), [document, initialProject.sketch]);

  const eventPoint = (event: ReactPointerEvent<SVGSVGElement>): CadPoint => {
    const rect = event.currentTarget.getBoundingClientRect(); let x = (event.clientX - rect.left) / rect.width * CAD_VIEW.width; let y = (event.clientY - rect.top) / rect.height * CAD_VIEW.height;
    x = (x - pan.x) / zoom; y = (y - pan.y) / zoom; if (snap) { x = Math.round(x / 10) * 10; y = Math.round(y / 10) * 10; } return { x, y };
  };
  const finishDraft = () => {
    if (!['line', 'arc', 'spline', 'rectangle', 'circle', 'ellipse', 'polygon', 'text'].includes(tool) || draft.length < (tool === 'text' ? 1 : 2)) return;
    const entity = createCadEntity(tool as CadPrimitive, draft, { sides: 6, text: 'TEXT' }); entity.construction = constructionMode; entity.name = `${t(toolLabelKey(tool))} ${documentRef.current.entities.length + 1}`;
    const next = { ...documentRef.current, entities: [...documentRef.current.entities, entity] }; commitDocument(next, `${t('moduleSketch.created')} ${t(toolLabelKey(tool))}`); setDraft([]); setSelectedIds([entity.id]);
  };
  const deleteSelected = () => {
    if (!selectedIds.length) return; const nextEntities = document.entities.filter((entity) => !selectedIds.includes(entity.id)); const profileRemoved = selectedIds.includes(document.profileEntityId ?? '');
    commitDocument({ entities: nextEntities, profileEntityId: profileRemoved ? nextEntities.find((entity) => ['line', 'spline'].includes(entity.type))?.id ?? null : document.profileEntityId }, t('moduleSketch.deleted')); setSelectedIds([]);
  };
  const applyOperation = (operation: CadTool) => {
    const selected = document.entities.filter((entity) => selectedIds.includes(entity.id));
    if (operation === 'delete') { deleteSelected(); return; }
    if (!selected.length) { setTool(operation); return; }
    let additions: CadEntity[] = [];
    if (operation === 'offset') additions = selected.map((entity) => offsetEntity(entity));
    if (operation === 'mirror') additions = selected.map((entity) => ({ ...cloneEntity(entity), points: entity.points.map((point) => ({ x: CAD_VIEW.axisX * 2 - point.x, y: point.y })).reverse() }));
    if (operation === 'pattern') additions = selected.flatMap((entity) => [1, 2, 3].map((index) => translateEntity(cloneEntity(entity), index * 42, 0)));
    if (operation === 'project') additions = selected.map((entity) => ({ ...cloneEntity(entity), name: `${entity.name} projected`, construction: true, locked: true }));
    if (additions.length) { commitDocument({ ...document, entities: [...document.entities, ...additions] }, t(toolLabelKey(operation))); setSelectedIds(additions.map((entity) => entity.id)); return; }
    setTool(operation);
  };
  const applyConstraint = (constraint: CadConstraint) => { const entities = constrainEntities(document.entities, selectedIds, constraint); commitDocument({ ...document, entities }, t(constraintLabelKey(constraint))); };
  const disconnect = () => { if (!selectedIds.length) return; commitDocument({ ...document, entities: document.entities.map((entity) => selectedIds.includes(entity.id) ? { ...entity, constraints: [] } : entity) }, t('moduleSketch.disconnect')); };
  const rotateSelected = () => { if (!selectedIds.length) return; commitDocument({ ...document, entities: document.entities.map((entity) => selectedIds.includes(entity.id) ? rotateEntity(entity, 15) : entity) }, t('moduleSketch.rotate15')); };

  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'touch' && tool === 'select') {
      touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touchPointersRef.current.size >= 2) {
        const [first, second] = [...touchPointersRef.current.values()]; pinchRef.current = { distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)), zoom }; dragRef.current = null; panDragRef.current = null;
        event.currentTarget.setPointerCapture(event.pointerId); return;
      }
    }
    if (event.button === 1 || (event.button === 0 && event.altKey)) {
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      panDragRef.current = { clientX: event.clientX, clientY: event.clientY, pan: { ...pan } }; return;
    }
    event.currentTarget.setPointerCapture(event.pointerId); const point = eventPoint(event); const nearest = nearestEntity(document.entities, point, 28 / zoom);
    if (tool === 'select' || tool === 'move') {
      if (!nearest) { if (!event.shiftKey) setSelectedIds([]); if (tool === 'select') panDragRef.current = { clientX: event.clientX, clientY: event.clientY, pan: { ...pan } }; return; }
      if (event.shiftKey) setSelectedIds((current) => current.includes(nearest.id) ? current.filter((id) => id !== nearest.id) : [...current, nearest.id]); else if (!selectedIds.includes(nearest.id)) setSelectedIds([nearest.id]);
      let pointIndex: number | null = null; let best = 18 / zoom; nearest.points.forEach((candidate, index) => { const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y); if (distance < best) { best = distance; pointIndex = index; } });
      if (!nearest.locked && (tool === 'move' || pointIndex !== null)) dragRef.current = { start: point, document: copyDocument(document), entityId: nearest.id, pointIndex };
      return;
    }
    if (tool === 'trim') { if (nearest) { const trimmed = trimEntityAtPoint(nearest, point); commitDocument({ ...document, entities: trimmed ? document.entities.map((entity) => entity.id === nearest.id ? trimmed : entity) : document.entities.filter((entity) => entity.id !== nearest.id), profileEntityId: !trimmed && document.profileEntityId === nearest.id ? null : document.profileEntityId }, t('moduleSketch.trimmed')); } return; }
    if (tool === 'delete') { if (nearest) { setSelectedIds([nearest.id]); commitDocument({ ...document, entities: document.entities.filter((entity) => entity.id !== nearest.id), profileEntityId: document.profileEntityId === nearest.id ? null : document.profileEntityId }, t('moduleSketch.deleted')); } return; }
    if (!['line', 'arc', 'spline', 'rectangle', 'circle', 'ellipse', 'polygon', 'text'].includes(tool)) return;
    const nextDraft = [...draft, point]; setDraft(nextDraft);
    if (nextDraft.length >= primitiveClickCount(tool as CadPrimitive)) { const entity = createCadEntity(tool as CadPrimitive, nextDraft); entity.construction = constructionMode; entity.name = `${t(toolLabelKey(tool))} ${document.entities.length + 1}`; const next = { ...document, entities: [...document.entities, entity] }; commitDocument(next, `${t('moduleSketch.created')} ${t(toolLabelKey(tool))}`); setDraft([]); setSelectedIds([entity.id]); }
  };
  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'touch' && touchPointersRef.current.has(event.pointerId)) {
      touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touchPointersRef.current.size >= 2 && pinchRef.current) { const [first, second] = [...touchPointersRef.current.values()]; const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)); setZoom(Math.max(.55, Math.min(2.6, pinchRef.current.zoom * distance / pinchRef.current.distance))); return; }
    }
    if (panDragRef.current) {
      const rect = event.currentTarget.getBoundingClientRect(); const start = panDragRef.current;
      setPan({ x: start.pan.x + (event.clientX - start.clientX) / rect.width * CAD_VIEW.width, y: start.pan.y + (event.clientY - start.clientY) / rect.height * CAD_VIEW.height }); return;
    }
    const point = eventPoint(event); setHoverPoint(point); if (!dragRef.current) return;
    const { start, document: startDocument, entityId, pointIndex } = dragRef.current; const dx = point.x - start.x; const dy = point.y - start.y;
    setDocument({ ...startDocument, entities: startDocument.entities.map((entity) => {
      if (entity.id !== entityId) return selectedIds.includes(entity.id) && pointIndex === null ? translateEntity(entity, dx, dy) : entity;
      if (pointIndex !== null) return { ...entity, points: entity.points.map((candidate, index) => index === pointIndex ? point : candidate) };
      return translateEntity(entity, dx, dy);
    }) });
  };
  const pointerUp = (event: ReactPointerEvent<SVGSVGElement>) => { touchPointersRef.current.delete(event.pointerId); if (touchPointersRef.current.size < 2) pinchRef.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); if (panDragRef.current) panDragRef.current = null; if (dragRef.current) { dragRef.current = null; commitDocument(documentRef.current, t('moduleSketch.moved')); } };
  const wheel = (event: WheelEvent<SVGSVGElement>) => { event.preventDefault(); setZoom((current) => Math.max(.55, Math.min(2.6, current * (event.deltaY > 0 ? .9 : 1.1)))); };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); setCommandSearch(true); return; }
      if (event.key === 'Enter') { finishDraft(); return; } if (event.key === 'Escape') { setDraft([]); setTool('select'); return; } if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelected(); return; }
      if (event.shiftKey) { const constraint = constraintTools.find((item) => item.shortcut.toLowerCase().endsWith(event.key.toLowerCase())); if (constraint) { event.preventDefault(); applyConstraint(constraint.id); return; } }
      const shortcut = geometryTools.find((item) => item.shortcut.toLowerCase() === event.key.toLowerCase()); if (shortcut) applyOperation(shortcut.id);
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  });

  const applySketch = () => {
    const moduleExists = initialProject.modules.some((item) => item.id === module.id);
    saveModuleStudioProject({ ...initialProject, sketch: profilePoints, cadSketch: copyDocument(document), modules: moduleExists ? initialProject.modules.map((item) => item.id === module.id ? module : item) : [...initialProject.modules, module], updatedAt: new Date().toISOString() }); navigate('/module-studio');
  };
  const exportSvg = () => { const svg = window.document.querySelector('.cad-sketch-svg'); if (!svg) return; const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }); const url = URL.createObjectURL(blob); const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = 'lamp-sketch.svg'; anchor.click(); URL.revokeObjectURL(url); };
  const selectedEntities = document.entities.filter((entity) => selectedIds.includes(entity.id));
  const selectedEntity = selectedEntities.length === 1 ? selectedEntities[0] : null;
  const patchSelectedEntity = (patch: Partial<CadEntity>) => { if (!selectedEntity) return; setDocument({ ...documentRef.current, entities: documentRef.current.entities.map((entity) => entity.id === selectedEntity.id ? { ...entity, ...patch } : entity) }); };
  const commitSelectedProperties = () => commitDocument(documentRef.current, t('moduleSketch.history.properties'));
  const draftEntity: CadEntity | null = draft.length ? { id: 'cad-draft', type: ((['line', 'arc', 'spline', 'rectangle', 'circle', 'ellipse', 'polygon', 'text'].includes(tool) ? tool : 'line') as CadPrimitive), name: 'Draft', points: hoverPoint ? [...draft, hoverPoint] : draft, visible: true, construction: constructionMode, locked: false, constraints: [], sides: 6, text: 'TEXT' } : null;

  return <main className="cad-workspace">
    <header className="cad-topbar">
      <button className="cad-icon" onClick={() => navigate('/module-studio')} aria-label={t('moduleSketch.back')}><ArrowLeft size={18} /></button>
      <div className="cad-brand"><span>FORMAFORGE / PARAMETRIC SKETCH</span><strong>{t('moduleSketch.fullTitle')}</strong></div>
      <div className="cad-command-hint"><b>{t(toolLabelKey(tool))} {geometryTools.find((item) => item.id === tool)?.shortcut ? `(${geometryTools.find((item) => item.id === tool)?.shortcut})` : ''}</b><span>{t(`moduleSketch.hint.${tool}`)}</span></div>
      <div className="cad-top-actions"><button onClick={toggleLanguage} title={language === 'vi' ? 'English' : 'Tiếng Việt'}><Languages size={16} /><span>{language === 'vi' ? 'EN' : 'VI'}</span></button><button disabled={historyIndex === 0} onClick={undo}><Undo2 size={16} /></button><button disabled={historyIndex === history.length - 1} onClick={redo}><Redo2 size={16} /></button><button onClick={exportSvg}><Camera size={16} /><span>SVG</span></button><button className="primary" onClick={applySketch}><Check size={17} /><span>{t('moduleSketch.apply')}</span></button></div>
    </header>

    <div className="cad-stage">
      <div className="cad-mode-dock"><button className="active"><Box size={18} />{t('moduleSketch.modeling')}</button><button className={showPreview ? 'active' : ''} onClick={() => setShowPreview((value) => !value)}><CircleDot size={18} />{t('moduleSketch.visualization')}</button><button onClick={exportSvg}><PenTool size={18} />{t('moduleSketch.drawings')}</button><button className={sidePanel === 'items' ? 'active' : ''} onClick={() => setSidePanel(sidePanel === 'items' ? null : 'items')}><List size={18} />{t('moduleSketch.items')}</button></div>
      <aside className="cad-left-toolbar">
        <button onClick={() => setCommandSearch(true)}><Search size={19} /><span>{t('moduleSketch.search')}</span><kbd>Ctrl F</kbd></button>
        <button className={tool === 'select' ? 'active' : ''} onClick={() => { setTool('select'); setDraft([]); }}><MousePointer2 size={19} /><span>{t('moduleSketch.tool.select')}</span><kbd>V</kbd></button>
        <i />
        {geometryTools.map(({ id, icon: Icon, shortcut }) => <button key={id} className={tool === id ? 'active' : ''} onClick={() => applyOperation(id)}><Icon size={19} /><span>{t(toolLabelKey(id))}</span><kbd>{shortcut}</kbd></button>)}
      </aside>

      <section className="cad-canvas-wrap">
        <svg className="cad-sketch-svg" viewBox={`0 0 ${CAD_VIEW.width} ${CAD_VIEW.height}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onWheel={wheel} onContextMenu={(event) => event.preventDefault()}>
          <defs><pattern id="cad-grid-small" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="currentColor" strokeOpacity=".12" /></pattern><pattern id="cad-grid-large" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#cad-grid-small)" /><path d="M100 0H0V100" fill="none" stroke="currentColor" strokeOpacity=".2" /></pattern></defs>
          <rect width={CAD_VIEW.width} height={CAD_VIEW.height} fill="url(#cad-grid-large)" />
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            <line className="cad-axis y" x1={CAD_VIEW.axisX} y1="-800" x2={CAD_VIEW.axisX} y2="1800" /><line className="cad-axis x" x1="-800" y1={CAD_VIEW.originY} x2="2400" y2={CAD_VIEW.originY} /><circle className="cad-origin" cx={CAD_VIEW.axisX} cy={CAD_VIEW.originY} r="6" />
            {document.entities.map((entity) => <CadEntityShape key={entity.id} entity={entity} selected={selectedIds.includes(entity.id)} profile={document.profileEntityId === entity.id} />)}
            {draftEntity && <CadEntityShape entity={draftEntity} selected profile={false} />}
          </g>
        </svg>
        <div className="cad-coordinate"><span>X {hoverPoint ? Math.round(hoverPoint.x - CAD_VIEW.axisX) : 0} mm</span><span>Y {hoverPoint ? Math.round(CAD_VIEW.originY - hoverPoint.y) : 0} mm</span><span>{Math.round(zoom * 100)}%</span></div>
        <div className="cad-view-controls"><button onClick={() => setZoom((value) => Math.min(2.6, value * 1.2))}><ZoomIn size={17} /></button><button onClick={() => setZoom((value) => Math.max(.55, value / 1.2))}><ZoomOut size={17} /></button><button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><Focus size={17} /></button></div>
        <div className="cad-view-cube"><span>{t('moduleStudio.front')}</span><div><i /><i /><i /></div></div>
        {tool === 'move' && <div className="cad-transform-popover"><span>{t('moduleSketch.moveRotate')}</span><button onClick={rotateSelected}><RotateCw size={15} />15°</button></div>}
      </section>

      <aside className="cad-right-toolbar">
        <button className={constraintPanelOpen ? 'active' : ''} title={t('moduleSketch.constraintSettings')} onClick={() => setConstraintPanelOpen((value) => !value)}><PanelRight size={19} /></button>
        {constraintPanelOpen && <><i />
          {constraintTools.map(({ id, shortcut }) => <button key={id} disabled={!selectedIds.length} onClick={() => applyConstraint(id)}><span>{t(constraintLabelKey(id))}</span><kbd>{shortcut}</kbd></button>)}
          <i /><button disabled={!selectedIds.length} onClick={disconnect}><span>{t('moduleSketch.disconnect')}</span><Link2Off size={17} /></button>
          <button disabled={!selectedIds.length} className={selectedEntities.some((entity) => entity.construction) ? 'active' : ''} onClick={() => applyConstraint('construction')}><span>{t('moduleSketch.makeConstruction')}</span><Construction size={17} /></button>
        </>}
      </aside>

      <div className="cad-display-dock"><button className={showPreview ? 'active' : ''} onClick={() => setShowPreview((value) => !value)}><Box size={18} /><span>{t('moduleSketch.preview')}</span></button><button onClick={() => setDisplayMode((value) => value === 'shaded' ? 'wireframe' : 'shaded')}><CircleDot size={18} /><span>{t(`moduleSketch.${displayMode}`)}</span></button><button onClick={() => setSidePanel(sidePanel === 'history' ? null : 'history')}><History size={18} /><span>{t('moduleSketch.history')}</span></button></div>
      <div className="cad-bottom-dock"><button className={snap ? 'active' : ''} onClick={() => setSnap((value) => !value)}><Grid3X3 size={18} /><span>{t('moduleSketch.snap')}</span><b>{snap ? t('moduleSketch.on') : t('moduleSketch.off')}</b></button><button className={constructionMode ? 'active' : ''} onClick={() => setConstructionMode((value) => !value)}><Construction size={18} /><span>{t('moduleSketch.construction')}</span><b>{constructionMode ? t('moduleSketch.on') : t('moduleSketch.off')}</b></button><button className={sectionView ? 'active' : ''} onClick={() => { setSectionView((value) => !value); setShowPreview(true); }}><Layers3 size={18} /><span>{t('moduleSketch.sectionView')}</span></button><button className={measureMode ? 'active' : ''} onClick={() => setMeasureMode((value) => !value)}><Ruler size={18} /><span>{t('moduleSketch.measure')}</span></button></div>

      {showPreview && <aside className="cad-preview-panel">
        <header><div><span>{t('moduleSketch.revolveProfile')}</span><strong>{t('moduleSketch.preview')}</strong></div><button onClick={() => setShowPreview(false)}><X size={16} /></button></header>
        <div className="cad-preview-canvas"><Canvas dpr={[1, 1.5]}><SketchPreview3D module={module} points={profilePoints} mode={displayMode} sectionView={sectionView} /></Canvas>{sectionView && <span className="cad-section-badge">{t('moduleSketch.sectionAA')}</span>}</div>
        <div className="cad-parameters">
          <label><span>{t('moduleStudio.diameter')}<b>{module.diameter.toFixed(0)} mm</b></span><input type="range" min="80" max="320" value={module.diameter} onChange={(event) => setModule((current) => ({ ...current, diameter: Number(event.target.value) }))} /></label>
          <label><span>{t('moduleStudio.height')}<b>{module.height.toFixed(0)} mm</b></span><input type="range" min="80" max="420" value={module.height} onChange={(event) => setModule((current) => ({ ...current, height: Number(event.target.value) }))} /></label>
          <label><span>{t('moduleStudio.wall')}<b>{module.wallThickness.toFixed(1)} mm</b></span><input type="range" min="1.2" max="4" step=".1" value={module.wallThickness} onChange={(event) => setModule((current) => ({ ...current, wallThickness: Number(event.target.value) }))} /></label>
        </div>
        {selectedEntity && <div className="cad-selection-properties">
          <strong>{t('moduleSketch.selectionProperties')}</strong>
          <label><span>{t('moduleSketch.entityName')}</span><input value={selectedEntity.name} onChange={(event) => patchSelectedEntity({ name: event.target.value })} onBlur={commitSelectedProperties} /></label>
          {selectedEntity.type === 'text' && <label><span>{t('moduleSketch.textValue')}</span><input value={selectedEntity.text ?? ''} onChange={(event) => patchSelectedEntity({ text: event.target.value })} onBlur={commitSelectedProperties} /></label>}
          {selectedEntity.type === 'polygon' && <label><span>{t('moduleSketch.polygonSides')}</span><input type="number" min="3" max="24" value={selectedEntity.sides ?? 6} onChange={(event) => patchSelectedEntity({ sides: Math.max(3, Math.min(24, Number(event.target.value))) })} onBlur={commitSelectedProperties} /></label>}
          {['line', 'spline'].includes(selectedEntity.type) && <button className={document.profileEntityId === selectedEntity.id ? 'active' : ''} onClick={() => commitDocument({ ...documentRef.current, profileEntityId: selectedEntity.id }, t('moduleSketch.setProfile'))}><RotateCw size={14} />{t('moduleSketch.setProfile')}</button>}
        </div>}
      </aside>}

      {sidePanel === 'items' && <aside className="cad-side-panel items"><header><strong>{t('moduleSketch.items')}</strong><button onClick={() => setSidePanel(null)}><X size={16} /></button></header><div>{document.entities.map((entity) => <article key={entity.id} className={selectedIds.includes(entity.id) ? 'active' : ''} onClick={() => setSelectedIds([entity.id])}><button onClick={(event) => { event.stopPropagation(); setDocument({ ...document, entities: document.entities.map((item) => item.id === entity.id ? { ...item, visible: !item.visible } : item) }); }}>{entity.visible ? <Eye size={15} /> : <EyeOff size={15} />}</button><span><b>{entity.name}</b><small>{t(toolLabelKey(entity.type))} · {entity.constraints.length} {t('moduleSketch.constraints')}</small></span>{entity.locked ? <Lock size={14} /> : <Unlock size={14} />}{['line', 'spline'].includes(entity.type) && <button className="profile" title={t('moduleSketch.setProfile')} onClick={(event) => { event.stopPropagation(); commitDocument({ ...document, profileEntityId: entity.id }, t('moduleSketch.setProfile')); }}><RotateCw size={14} /></button>}</article>)}</div></aside>}
      {sidePanel === 'history' && <aside className="cad-side-panel history"><header><strong>{t('moduleSketch.history')}</strong><button onClick={() => setSidePanel(null)}><X size={16} /></button></header><div>{history.map((entry, index) => <button key={index} className={index === historyIndex ? 'active' : ''} onClick={() => { setHistoryIndex(index); setDocument(copyDocument(entry.document)); }}><span>{String(index + 1).padStart(2, '0')}</span>{entry.label}</button>)}</div></aside>}
      {commandSearch && <div className="cad-command-palette"><div><Search size={18} /><input autoFocus placeholder={t('moduleSketch.searchPlaceholder')} value={searchText} onChange={(event) => setSearchText(event.target.value)} /><button onClick={() => setCommandSearch(false)}><X size={16} /></button></div><section>{geometryTools.filter((item) => t(toolLabelKey(item.id)).toLowerCase().includes(searchText.toLowerCase())).map(({ id, icon: Icon, shortcut }) => <button key={id} onClick={() => { applyOperation(id); setCommandSearch(false); }}><Icon size={18} /><span>{t(toolLabelKey(id))}</span><kbd>{shortcut}</kbd></button>)}{constraintTools.filter((item) => t(constraintLabelKey(item.id)).toLowerCase().includes(searchText.toLowerCase())).map(({ id, shortcut }) => <button key={`constraint-${id}`} disabled={!selectedIds.length} onClick={() => { applyConstraint(id); setCommandSearch(false); }}><PanelRight size={18} /><span>{t(constraintLabelKey(id))}</span><kbd>{shortcut}</kbd></button>)}</section></div>}
      {measureMode && selectedEntities[0] && <div className="cad-measure-card"><Ruler size={17} /><span>{selectedEntities[0].name}</span><b>{selectedEntities[0].points.length > 1 ? `${Math.hypot(selectedEntities[0].points[1].x - selectedEntities[0].points[0].x, selectedEntities[0].points[1].y - selectedEntities[0].points[0].y).toFixed(1)} mm` : '—'}</b></div>}
    </div>
  </main>;
}
