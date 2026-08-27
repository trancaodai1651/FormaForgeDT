import {
  Box, Check, ChevronDown, CircleDot, Download, Eye, EyeOff, FileBox, FileUp,
  Grid3X3, Info, Layers3, Move3d, MousePointer2, PackageOpen, PencilRuler,
  Rotate3d, Scissors, Settings2, ShieldCheck, Sparkles, Undo2, Redo2, X,
} from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { useI18n } from '../../lib/i18n';
import {
  approximateVolume, boundsOfMesh, divideMeshByBeds, geometryFromMesh, makeDemoMesh,
  meshFromBufferGeometry, objectToMesh, splitMeshByCurve, splitMeshByPlane, subtractMask,
  transformMesh, translateMesh, validateMesh, type BedConfig, type ConnectorConfig,
  type CutterAxis, type CutterBounds, type CutterMesh, type ConnectorKind,
} from '../../stlCutter/geometry';
import { buildStlZip, buildThreeMf, downloadBytes, exportStl, type ExportPart } from '../../stlCutter/export';
import './stl-cutter.css';

type PanelTab = 'file' | 'pieces' | 'export' | 'change';
type ActiveTool = 'select' | 'rotate' | 'move' | 'line' | 'curve' | 'mask';

type Piece = {
  id: string;
  name: string;
  mesh: CutterMesh;
  color: string;
  visible: boolean;
  position: [number, number, number];
  rotation: [number, number, number];
};

type CurvePoint = { screen: [number, number]; model: [number, number] };

const PIECE_COLORS = ['#38bdf8', '#fb7185', '#34d399', '#f59e0b', '#a78bfa', '#f472b6', '#94a3b8', '#f8fafc'];
const DEFAULT_CONNECTOR: ConnectorConfig = { enabled: false, kind: 'pyramid', size: 6, clearance: 0.2, depth: 4 };
const DEFAULT_BED: BedConfig = { width: 220, depth: 220, height: 250, margin: 5 };

function id() { return globalThis.crypto?.randomUUID?.() ?? `piece-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function extension(name: string) { return name.toLowerCase().split('.').pop() ?? ''; }
function displayNumber(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(1); }
function clonePieces(pieces: Piece[]): Piece[] { return pieces.map((piece) => ({ ...piece, position: [...piece.position] as [number, number, number], rotation: [...piece.rotation] as [number, number, number], mesh: { vertices: piece.mesh.vertices.slice(), indices: piece.mesh.indices.slice() } })); }
function normalizeImportedMesh(mesh: CutterMesh): CutterMesh {
  const bounds = boundsOfMesh(mesh);
  return translateMesh(mesh, [-bounds.center[0], -bounds.center[1], -bounds.min[2]]);
}
function createPiece(mesh: CutterMesh, name: string, color = PIECE_COLORS[0]): Piece {
  return { id: id(), name, mesh, color, visible: true, position: [0, 0, 0], rotation: [0, 0, 0] };
}
function worldMesh(piece: Piece): CutterMesh { return transformMesh(piece.mesh, piece.position, piece.rotation); }
function fileBase(name: string) { return name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() || 'stl-cutter'; }

async function parseModelFile(file: File): Promise<CutterMesh> {
  const kind = extension(file.name);
  if (kind === 'stl') {
    const geometry = new STLLoader().parse(await file.arrayBuffer());
    try { return meshFromBufferGeometry(geometry); } finally { geometry.dispose(); }
  }
  if (kind === 'obj') return objectToMesh(new OBJLoader().parse(await file.text()));
  if (kind === 'fbx') return objectToMesh(new FBXLoader().parse(await file.arrayBuffer(), ''));
  throw new Error('Supported formats: STL, OBJ and FBX.');
}

function PiecePreview({ piece, selected, tool, explosion, onSelect }: { piece: Piece; selected: boolean; tool: ActiveTool; explosion: number; onSelect: () => void }) {
  const geometry = useMemo(() => geometryFromMesh(piece.mesh), [piece.mesh]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group position={[piece.position[0] + explosion, piece.position[1], piece.position[2]]} rotation={piece.rotation}>
    <mesh geometry={geometry} visible={piece.visible} castShadow receiveShadow onPointerDown={(event) => { if (tool === 'select') { event.stopPropagation(); onSelect(); } }}>
      <meshPhysicalMaterial color={piece.color} roughness={selected ? .28 : .5} metalness={.04} clearcoat={selected ? .65 : .18} emissive={selected ? piece.color : '#000000'} emissiveIntensity={selected ? .08 : 0} side={THREE.DoubleSide} />
    </mesh>
  </group>;
}

function CutterScene({ pieces, selectedId, tool, planeAxis, planeOffset, bounds, explosionGap, onSelect }: { pieces: Piece[]; selectedId: string; tool: ActiveTool; planeAxis: CutterAxis; planeOffset: number; bounds: CutterBounds | null; explosionGap: number; onSelect: (id: string) => void }) {
  const planeSize = bounds ? Math.max(bounds.size[0], bounds.size[1], bounds.size[2]) * 1.35 : 120;
  const extent = bounds ? Math.max(...bounds.size, 1) : 80;
  const cameraDistance = Math.max(30, extent * 2.8);
  const target: [number, number, number] = bounds?.center ?? [0, 0, 25];
  const planeRotation: [number, number, number] = planeAxis === 'x' ? [0, Math.PI / 2, 0] : planeAxis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  const planePosition: [number, number, number] = planeAxis === 'x' ? [planeOffset, 0, 0] : planeAxis === 'y' ? [0, planeOffset, 0] : [0, 0, planeOffset];
  return <>
    <color attach="background" args={['#050918']} />
    <PerspectiveCamera makeDefault position={[cameraDistance * .95, -cameraDistance * 1.15, cameraDistance * .78]} fov={42} near={.1} far={100000} up={[0, 0, 1]} />
    <ambientLight intensity={.55} color="#9fb9dc" />
    <directionalLight position={[180, -180, 320]} intensity={2.2} castShadow />
    <directionalLight position={[-220, 160, 120]} intensity={.8} color="#6fa9ff" />
    <Grid rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]} args={[1000, 1000]} cellSize={10} cellThickness={.45} cellColor="#214c86" sectionSize={50} sectionThickness={.9} sectionColor="#3478ca" fadeDistance={900} fadeStrength={1.5} infiniteGrid />
    {pieces.map((piece, index) => <PiecePreview key={piece.id} piece={piece} selected={piece.id === selectedId} tool={tool} explosion={explosionGap * (index - (pieces.length - 1) / 2)} onSelect={() => onSelect(piece.id)} />)}
    {bounds && <mesh position={planePosition} rotation={planeRotation} visible={tool === 'line' || tool === 'curve'}>
      <planeGeometry args={[planeSize, planeSize]} />
      <meshBasicMaterial color="#32a6ff" transparent opacity={.08} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>}
    <OrbitControls enablePan enableDamping dampingFactor={.12} target={target} minDistance={Math.max(8, extent * .35)} maxDistance={Math.max(5000, extent * 100)} makeDefault />
  </>;
}

function NumberField({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; unit?: string; onChange: (value: number) => void }) {
  return <label className="stl-number-field"><span>{label}{unit && <small>{unit}</small>}</span><input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function RangeField({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }) {
  return <label className="stl-range-field"><span><b>{label}</b><strong>{displayNumber(value)}{unit ? ` ${unit}` : ''}</strong></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function ToolButton({ label, icon: Icon, active, onClick }: { label: string; icon: typeof Box; active: boolean; onClick: () => void }) {
  return <button type="button" className={`stl-tool-button${active ? ' active' : ''}`} title={label} aria-label={label} aria-pressed={active} onClick={onClick}><Icon size={15} /><span>{label}</span></button>;
}

export function StlCutterPage() {
  const { t, language, toggleLanguage } = useI18n();
  const initialPiece = useMemo(() => createPiece(normalizeImportedMesh(makeDemoMesh('cube')), 'cubo-prueba.stl', PIECE_COLORS[0]), []);
  const [pieces, setPieces] = useState<Piece[]>([initialPiece]);
  const [selectedId, setSelectedId] = useState(initialPiece.id);
  const [tab, setTab] = useState<PanelTab>('file');
  const [advancedTab, setAdvancedTab] = useState<'unions' | 'plane' | 'beds' | 'voronoi' | 'colors'>('unions');
  const [tool, setTool] = useState<ActiveTool>('select');
  const [axis, setAxis] = useState<CutterAxis>('z');
  const [offset, setOffset] = useState(25);
  const [connector, setConnector] = useState<ConnectorConfig>(DEFAULT_CONNECTOR);
  const [bed, setBed] = useState<BedConfig>(DEFAULT_BED);
  const [explosionGap, setExplosionGap] = useState(0);
  const [curve, setCurve] = useState<CurvePoint[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [maskCenter, setMaskCenter] = useState<[number, number, number]>([0, 0, 25]);
  const [maskRadius, setMaskRadius] = useState(8);
  const [history, setHistory] = useState<Piece[][]>([]);
  const [redoStack, setRedoStack] = useState<Piece[][]>([]);
  const [bedPieceIds, setBedPieceIds] = useState<string[]>([]);
  const [modelName, setModelName] = useState(initialPiece.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState<{ valid: boolean; status: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const selectedPiece = pieces.find((piece) => piece.id === selectedId) ?? pieces[0] ?? null;
  const selectedWorldMesh = selectedPiece ? worldMesh(selectedPiece) : null;
  const selectedBounds = selectedWorldMesh ? boundsOfMesh(selectedWorldMesh) : null;
  const triangleCount = selectedWorldMesh ? Math.floor(selectedWorldMesh.indices.length / 3) : 0;
  const volume = selectedWorldMesh ? approximateVolume(selectedWorldMesh) : 0;
  const usableBed: [number, number, number] = [Math.max(1, bed.width - bed.margin * 2), Math.max(1, bed.depth - bed.margin * 2), Math.max(1, bed.height - bed.margin * 2)];
  const bedEstimate = selectedBounds ? selectedBounds.size.map((size, index) => Math.max(1, Math.ceil(size / usableBed[index]))) as [number, number, number] : [1, 1, 1];
  const bedCount = bedEstimate[0] * bedEstimate[1] * bedEstimate[2];

  useEffect(() => {
    if (!selectedBounds) return;
    const value = selectedBounds.center[axis === 'x' ? 0 : axis === 'y' ? 1 : 2];
    setOffset(Number(value.toFixed(2)));
    setMaskCenter(selectedBounds.center);
  }, [selectedId, axis]);

  useEffect(() => {
    if (!selectedWorldMesh) { setValidation(null); return; }
    let cancelled = false;
    void validateMesh(selectedWorldMesh).then((result) => { if (!cancelled) setValidation(result); }).catch((cause) => { if (!cancelled) setValidation({ valid: false, status: cause instanceof Error ? cause.message : String(cause) }); });
    return () => { cancelled = true; };
  }, [selectedId, pieces]);

  const saveHistory = () => { setHistory((current) => [...current.slice(-19), clonePieces(pieces)]); setRedoStack([]); };
  const replaceWithLoadedModel = async (mesh: CutterMesh, name: string) => {
    const normalized = normalizeImportedMesh(mesh);
    saveHistory();
    const piece = createPiece(normalized, name, PIECE_COLORS[0]);
    setPieces([piece]); setSelectedId(piece.id); setModelName(name); setTab('file'); setTool('select'); setBedPieceIds([]); setCurve([]); setError('');
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError('');
    try { await replaceWithLoadedModel(await parseModelFile(file), file.name); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not import the model.'); }
    finally { setBusy(false); }
  };
  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; void onFile(file); };
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); void onFile(event.dataTransfer.files?.[0]); };

  const loadDemo = (kind: 'cube' | 'bevel' | 'vase' | 'cylinder') => {
    const names = { cube: 'cubo-prueba.stl', bevel: 'cubo-bisel.stl', vase: 'jarron.stl', cylinder: 'cilindro.stl' };
    void replaceWithLoadedModel(makeDemoMesh(kind), names[kind]);
  };

  const updatePiece = (patch: Partial<Piece>) => { if (!selectedId) return; setPieces((current) => current.map((piece) => piece.id === selectedId ? { ...piece, ...patch } : piece)); };
  const updateTransform = (kind: 'position' | 'rotation', index: number, value: number) => { if (!selectedPiece) return; const next = [...selectedPiece[kind]] as [number, number, number]; next[index] = value; updatePiece({ [kind]: next } as Partial<Piece>); };
  const undo = () => { const previous = history.at(-1); if (!previous) return; setRedoStack((current) => [...current, clonePieces(pieces)]); setHistory((current) => current.slice(0, -1)); setPieces(clonePieces(previous)); setSelectedId(previous[0]?.id ?? ''); };
  const redo = () => { const next = redoStack.at(-1); if (!next) return; setHistory((current) => [...current, clonePieces(pieces)]); setRedoStack((current) => current.slice(0, -1)); setPieces(clonePieces(next)); setSelectedId(next[0]?.id ?? ''); };

  const commitPlaneCut = async (cutAxis = axis, cutOffset = offset) => {
    if (!selectedPiece || !selectedWorldMesh) return;
    setBusy(true); setError('');
    try {
      const [positive, negative] = await splitMeshByPlane(selectedWorldMesh, cutAxis, cutOffset, connector);
      if (positive.indices.length < 3 || negative.indices.length < 3) throw new Error('The plane must cross the selected piece to create two non-empty solids.');
      saveHistory();
      const first = createPiece(positive, `${selectedPiece.name.replace(/\.[^/.]+$/, '')}-A`, PIECE_COLORS[0]);
      const second = createPiece(negative, `${selectedPiece.name.replace(/\.[^/.]+$/, '')}-B`, PIECE_COLORS[1]);
      setPieces((current) => [...current.filter((piece) => piece.id !== selectedPiece.id), first, second]); setSelectedId(first.id); setTab('pieces'); setBedPieceIds([]); setExplosionGap(12); setCurve([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The cut could not be completed.'); }
    finally { setBusy(false); }
  };

  const commitCurveCut = async () => {
    if (!selectedPiece || !selectedWorldMesh || curve.length < 2) return;
    setBusy(true); setError('');
    try {
      const [firstMesh, secondMesh] = await splitMeshByCurve(selectedWorldMesh, curve.map((point) => point.model));
      if (firstMesh.indices.length < 3 || secondMesh.indices.length < 3) throw new Error('The curve must cross the model from edge to edge.');
      saveHistory();
      const first = createPiece(firstMesh, `${selectedPiece.name.replace(/\.[^/.]+$/, '')}-curve-A`, PIECE_COLORS[0]);
      const second = createPiece(secondMesh, `${selectedPiece.name.replace(/\.[^/.]+$/, '')}-curve-B`, PIECE_COLORS[1]);
      setPieces((current) => [...current.filter((piece) => piece.id !== selectedPiece.id), first, second]); setSelectedId(first.id); setTab('pieces'); setBedPieceIds([]); setExplosionGap(12); setCurve([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The curve cut could not be completed.'); }
    finally { setBusy(false); }
  };

  const commitMask = async () => {
    if (!selectedPiece || !selectedWorldMesh) return;
    setBusy(true); setError('');
    try {
      const nextMesh = await subtractMask(selectedWorldMesh, maskCenter, maskRadius);
      if (nextMesh.indices.length < 3) throw new Error('The mask removed the complete piece. Reduce its radius.');
      saveHistory();
      const next = { ...selectedPiece, mesh: nextMesh, position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] };
      setPieces((current) => current.map((piece) => piece.id === selectedPiece.id ? next : piece)); setTab('pieces');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The mask could not be applied.'); }
    finally { setBusy(false); }
  };

  const commitBeds = async () => {
    const candidates = pieces.filter((piece) => piece.visible);
    if (!candidates.length) return;
    setBusy(true); setError('');
    try {
      const result: Piece[] = [];
      for (const piece of candidates) {
        const bedMeshes = await divideMeshByBeds(worldMesh(piece), bed);
        bedMeshes.forEach((mesh, index) => { if (mesh.indices.length >= 3) result.push(createPiece(mesh, `${piece.name.replace(/\.[^/.]+$/, '')}-bed-${index + 1}`, PIECE_COLORS[result.length % PIECE_COLORS.length])); });
      }
      if (result.length < 2) throw new Error('This model already fits inside the usable bed volume.');
      saveHistory();
      setPieces((current) => [...current.filter((piece) => !candidates.some((item) => item.id === piece.id)), ...result]); setSelectedId(result[0].id); setBedPieceIds(result.map((piece) => piece.id)); setTab('pieces'); setExplosionGap(16);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The model could not be divided by beds.'); }
    finally { setBusy(false); }
  };

  const exportParts = (source = pieces.filter((piece) => piece.visible)): ExportPart[] => source.map((piece) => ({ name: piece.name, mesh: worldMesh(piece), color: piece.color }));
  const downloadProject = () => { const parts = exportParts(); if (parts.length) downloadBytes(buildThreeMf(parts, modelName), 'model/3mf', `${fileBase(modelName)}.3mf`); };
  const downloadBeds = () => { const source = bedPieceIds.length ? pieces.filter((piece) => bedPieceIds.includes(piece.id) && piece.visible) : pieces.filter((piece) => piece.visible); if (source.length) downloadBytes(buildThreeMf(exportParts(source), `${modelName} beds`), 'model/3mf', `${fileBase(modelName)}-beds.3mf`); };
  const downloadSelected = () => { if (selectedPiece) downloadBytes(exportStl(worldMesh(selectedPiece), selectedPiece.name), 'model/stl', `${fileBase(selectedPiece.name)}.stl`); };
  const downloadAll = () => { const parts = exportParts(); if (parts.length) downloadBytes(buildStlZip(parts), 'application/zip', `${fileBase(modelName)}-pieces.zip`); };

  const centerAll = () => {
    const visible = pieces.filter((piece) => piece.visible);
    if (!visible.length) return;
    const all = visible.map(worldMesh);
    const boxes = all.map(boundsOfMesh);
    const min: [number, number, number] = [Math.min(...boxes.map((box) => box.min[0])), Math.min(...boxes.map((box) => box.min[1])), Math.min(...boxes.map((box) => box.min[2]))];
    const max: [number, number, number] = [Math.max(...boxes.map((box) => box.max[0])), Math.max(...boxes.map((box) => box.max[1])), Math.max(...boxes.map((box) => box.max[2]))];
    const shift: [number, number, number] = [-(min[0] + max[0]) / 2, -(min[1] + max[1]) / 2, -min[2]];
    setPieces((current) => current.map((piece) => ({ ...piece, position: [piece.position[0] + shift[0], piece.position[1] + shift[1], piece.position[2] + shift[2]] as [number, number, number] })));
  };

  const reset = () => { const piece = createPiece(normalizeImportedMesh(makeDemoMesh('cube')), 'cubo-prueba.stl', PIECE_COLORS[0]); setPieces([piece]); setSelectedId(piece.id); setHistory([]); setRedoStack([]); setBedPieceIds([]); setModelName(piece.name); setTab('file'); setTool('select'); setError(''); setValidation(null); setExplosionGap(0); };

  const onViewportPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!selectedBounds) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = event.clientX - rect.left; const sy = event.clientY - rect.top;
    const span = Math.max(selectedBounds.size[0], selectedBounds.size[1], 1) * 1.35;
    const model: [number, number] = [selectedBounds.center[0] + (sx / rect.width - .5) * span, selectedBounds.center[1] + (.5 - sy / rect.height) * span];
    if (tool === 'curve') { try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic pointer events and some touch browsers do not expose capture */ } setDrawing(true); setCurve([{ screen: [sx, sy], model }]); }
    if (tool === 'mask') setMaskCenter([model[0], model[1], selectedBounds.center[2]]);
  };
  const onViewportPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing || tool !== 'curve' || !selectedBounds) return;
    const rect = event.currentTarget.getBoundingClientRect(); const sx = event.clientX - rect.left; const sy = event.clientY - rect.top; const span = Math.max(selectedBounds.size[0], selectedBounds.size[1], 1) * 1.35;
    setCurve((current) => [...current, { screen: [sx, sy], model: [selectedBounds.center[0] + (sx / rect.width - .5) * span, selectedBounds.center[1] + (.5 - sy / rect.height) * span] }]);
  };
  const stopDrawing = (event: ReactPointerEvent<SVGSVGElement>) => { if (drawing) { setDrawing(false); event.currentTarget.releasePointerCapture?.(event.pointerId); } };

  const tabs: Array<[PanelTab, string, typeof FileBox]> = [[ 'file', t('stlCutter.file'), FileBox ], [ 'pieces', t('stlCutter.pieces'), Layers3 ], [ 'export', t('stlCutter.export'), Download ], [ 'change', t('stlCutter.changeLog'), PencilRuler ]];
  const advanced: Array<[string, string, typeof Settings2]> = [[ 'unions', t('stlCutter.unions'), Settings2 ], [ 'plane', t('stlCutter.plane'), Box ], [ 'beds', t('stlCutter.beds'), Grid3X3 ], [ 'voronoi', t('stlCutter.voronoi'), Sparkles ], [ 'colors', t('stlCutter.colors'), CircleDot ]];
  const renderAdvanced = () => <>
    <nav className="stl-advanced-tabs" aria-label={t('stlCutter.advancedTools')}>{advanced.map(([key, label, Icon]) => <button type="button" key={key} className={advancedTab === key ? 'active' : ''} onClick={() => { setAdvancedTab(key as typeof advancedTab); setTool(key === 'plane' ? 'line' : 'select'); }}><Icon size={14} /><span>{label}</span>{(key === 'voronoi' || key === 'colors') && <i>soon</i>}</button>)}</nav>
    {tool === 'line' && <section className="stl-tool-panel"><div className="stl-panel-heading"><div><span className="stl-eyebrow">{t('stlCutter.plane')}</span><h3>{t('stlCutter.lineCut')}</h3></div><Scissors size={18} /></div><p>{t('stlCutter.lineHint')}</p><div className="stl-segmented">{(['x', 'y', 'z'] as CutterAxis[]).map((item) => <button type="button" key={item} className={axis === item ? 'active' : ''} onClick={() => setAxis(item)}>{item.toUpperCase()}</button>)}</div><NumberField label={t('stlCutter.offset')} value={offset} unit="mm" onChange={setOffset} /><RangeField label={t('stlCutter.offset')} value={offset} min={selectedBounds?.min[axis === 'x' ? 0 : axis === 'y' ? 1 : 2] ?? -100} max={selectedBounds?.max[axis === 'x' ? 0 : axis === 'y' ? 1 : 2] ?? 100} step={.1} unit="mm" onChange={setOffset} /><div className="stl-action-row"><button type="button" onClick={() => selectedBounds && setOffset(selectedBounds.center[axis === 'x' ? 0 : axis === 'y' ? 1 : 2])}>{t('stlCutter.centerPlane')}</button><button type="button" className="primary" onClick={() => void commitPlaneCut()} disabled={busy || !selectedPiece}>{busy ? t('stlCutter.processing') : t('stlCutter.applyCut')}</button></div></section>}
    {tool === 'curve' && <section className="stl-tool-panel"><div className="stl-panel-heading"><div><span className="stl-eyebrow">{t('stlCutter.curves')}</span><h3>{t('stlCutter.curveCut')}</h3></div><Sparkles size={18} /></div><p>{t('stlCutter.curveHint')}</p><div className="stl-tool-callout">{curve.length ? `${curve.length} ${t('stlCutter.pointsDrawn')}` : t('stlCutter.noCurve')}</div><div className="stl-action-row"><button type="button" onClick={() => setCurve([])} disabled={!curve.length}>{t('stlCutter.clearCurve')}</button><button type="button" className="primary" onClick={() => void commitCurveCut()} disabled={busy || curve.length < 2}>{busy ? t('stlCutter.processing') : t('stlCutter.applyCurve')}</button></div></section>}
    {tool === 'mask' && <section className="stl-tool-panel"><div className="stl-panel-heading"><div><span className="stl-eyebrow">{t('stlCutter.mask')}</span><h3>{t('stlCutter.localMask')}</h3></div><CircleDot size={18} /></div><p>{t('stlCutter.maskHint')}</p><RangeField label={t('stlCutter.brushSize')} value={maskRadius} min={.5} max={Math.max(1, Math.max(...(selectedBounds?.size ?? [40, 40, 40])) / 2)} step={.5} unit="mm" onChange={setMaskRadius} /><NumberField label="X" value={maskCenter[0]} unit="mm" onChange={(value) => setMaskCenter([value, maskCenter[1], maskCenter[2]])} /><NumberField label="Y" value={maskCenter[1]} unit="mm" onChange={(value) => setMaskCenter([maskCenter[0], value, maskCenter[2]])} /><div className="stl-action-row"><button type="button" onClick={() => selectedBounds && setMaskCenter(selectedBounds.center)}>{t('stlCutter.centerMask')}</button><button type="button" className="primary" onClick={() => void commitMask()} disabled={busy || !selectedPiece}>{busy ? t('stlCutter.processing') : t('stlCutter.removeMasked')}</button></div></section>}
    {tool === 'select' && advancedTab === 'unions' && <section className="stl-tool-panel stl-advanced-summary"><div className="stl-panel-heading"><div><span className="stl-eyebrow">{t('stlCutter.unions')}</span><h3>{t('stlCutter.connectors')}</h3></div><Settings2 size={18} /></div><label className="stl-check-row"><input type="checkbox" checked={connector.enabled} onChange={(event) => setConnector((current) => ({ ...current, enabled: event.target.checked }))} /><span>{t('stlCutter.enableConnector')}</span></label><div className="stl-segmented">{(['pyramid', 'dovetail', 'sphere'] as ConnectorKind[]).map((kind) => <button type="button" key={kind} className={connector.kind === kind ? 'active' : ''} onClick={() => setConnector((current) => ({ ...current, kind }))}>{t(`stlCutter.connector.${kind}`)}</button>)}</div><RangeField label={t('stlCutter.connectorSize')} value={connector.size} min={2} max={20} step={.5} unit="mm" onChange={(value) => setConnector((current) => ({ ...current, size: value }))} /><RangeField label={t('stlCutter.clearance')} value={connector.clearance} min={0} max={1} step={.05} unit="mm" onChange={(value) => setConnector((current) => ({ ...current, clearance: value }))} /><p className="stl-muted">{t('stlCutter.connectorHint')}</p></section>}
    {tool === 'select' && advancedTab === 'beds' && <section className="stl-tool-panel stl-beds-mini"><div className="stl-panel-heading"><div><span className="stl-eyebrow">{t('stlCutter.beds')}</span><h3>{t('stlCutter.printVolume')}</h3></div><Grid3X3 size={18} /></div><p>{t('stlCutter.bedsHint')}</p><div className="stl-bed-grid"><NumberField label={t('stlCutter.width')} value={bed.width} min={10} unit="mm" onChange={(value) => setBed((current) => ({ ...current, width: value }))} /><NumberField label={t('stlCutter.depth')} value={bed.depth} min={10} unit="mm" onChange={(value) => setBed((current) => ({ ...current, depth: value }))} /><NumberField label={t('stlCutter.height')} value={bed.height} min={10} unit="mm" onChange={(value) => setBed((current) => ({ ...current, height: value }))} /><NumberField label={t('stlCutter.margin')} value={bed.margin} min={0} unit="mm" onChange={(value) => setBed((current) => ({ ...current, margin: value }))} /></div><div className="stl-bed-estimate">{t('stlCutter.estimate')}: <strong>{bedEstimate.join(' × ')} = {bedCount} {t('stlCutter.parts')}</strong></div><button type="button" className="primary wide" onClick={() => void commitBeds()} disabled={busy || bedCount <= 1}>{busy ? t('stlCutter.processing') : t('stlCutter.divideBeds')}</button></section>}
    {(tool === 'select' && (advancedTab === 'voronoi' || advancedTab === 'colors')) && <section className="stl-tool-panel stl-roadmap"><div className="stl-roadmap-item">{advancedTab === 'voronoi' ? <Sparkles size={15} /> : <CircleDot size={15} />}<span><b>{t(`stlCutter.${advancedTab}`)}</b><small>{t('stlCutter.roadmap')}</small></span></div></section>}
  </>;

  return <main className="stl-cutter-page">
    <header className="stl-cutter-header"><div className="stl-cutter-brand"><span className="stl-cutter-mark"><Scissors size={18} /></span><div><span className="stl-eyebrow">FORMAFORGE / ADMIN TOOL</span><h1>{t('admin.stlCutter')}</h1></div></div><div className="stl-cutter-header-actions"><span><ShieldCheck size={14} />{t('admin.adminOnly')}</span><button type="button" onClick={toggleLanguage}>{language === 'vi' ? 'English' : 'Tiếng Việt'}</button><Link to="/admin" aria-label={t('admin.backToDashboard')}><ChevronDown size={15} /></Link></div></header>
    <div className="stl-cutter-layout">
      <aside className="stl-cutter-sidebar">
        <div className="stl-sidebar-intro"><span className="stl-eyebrow">{t('admin.stlCutter')}</span><h2>{t('stlCutter.title')}</h2><p>{t('admin.stlCutterDescription')}</p></div>
        <nav className="stl-panel-tabs" aria-label={t('stlCutter.tabs')}>{tabs.map(([key, label, Icon]) => <button type="button" key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><Icon size={15} /><span>{label}</span></button>)}</nav>
        <div className="stl-sidebar-scroll">
          {tab === 'file' && <>
            <section className="stl-panel-section"><div className="stl-section-title"><span>{t('stlCutter.uploadTitle')}</span><FileUp size={15} /></div><div className="stl-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={onDrop} onClick={() => fileInput.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') fileInput.current?.click(); }}><FileUp size={28} /><b>{t('stlCutter.dropFile')}</b><small>{t('stlCutter.formats')}</small><span>{t('stlCutter.browse')}</span></div><input ref={fileInput} type="file" accept=".stl,.obj,.fbx" hidden onChange={onFileInput} />{busy && <div className="stl-loading"><span className="stl-spinner" />{t('stlCutter.processing')}</div>}{error && <div className="stl-error"><X size={14} />{error}</div>}</section>
            <section className="stl-panel-section"><div className="stl-section-title"><span>{t('stlCutter.testModels')}</span><Box size={15} /></div><div className="stl-demo-grid">{([['cube', t('stlCutter.cube')], ['bevel', t('stlCutter.bevelCube')], ['vase', t('stlCutter.vase')], ['cylinder', t('stlCutter.cylinder')]] as const).map(([kind, label]) => <button type="button" key={kind} onClick={() => loadDemo(kind)}><Box size={14} />{label}</button>)}</div><button type="button" className="stl-center-button" onClick={centerAll}><Move3d size={14} />{t('stlCutter.centerAll')}</button></section>
            <section className="stl-panel-section stl-active-model"><div className="stl-section-title"><span>{t('stlCutter.activeModel')}</span><CircleDot size={15} /></div>{selectedPiece ? <dl><div><dt>{t('stlCutter.fileName')}</dt><dd>{selectedPiece.name}</dd></div><div><dt>{t('stlCutter.parts')}</dt><dd>{pieces.length}</dd></div><div><dt>{t('stlCutter.dimensions')}</dt><dd>{selectedBounds ? selectedBounds.size.map(displayNumber).join(' × ') : '—'} mm</dd></div><div><dt>{t('stlCutter.triangles')}</dt><dd>{triangleCount.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}</dd></div><div><dt>{t('stlCutter.volume')}</dt><dd>{volume ? `${volume.toFixed(1)} mm³` : '—'}</dd></div><div><dt>{t('stlCutter.meshStatus')}</dt><dd className={validation?.valid ? 'valid' : validation ? 'invalid' : ''}>{validation?.valid ? t('stlCutter.validated') : validation ? t('stlCutter.review') : t('stlCutter.checking')}</dd></div></dl> : <p>{t('stlCutter.noModel')}</p>}</section>
          </>}
          {tab === 'pieces' && <>
            <section className="stl-panel-section"><div className="stl-section-title"><span>{t('stlCutter.pieces')}</span><strong>{pieces.length}</strong></div><p className="stl-muted">{t('stlCutter.piecesHint')}</p><div className="stl-piece-list">{pieces.map((piece) => <article key={piece.id} className={`stl-piece-card${piece.id === selectedId ? ' selected' : ''}`} onClick={() => setSelectedId(piece.id)}><div className="stl-piece-top"><button type="button" className="stl-piece-visibility" aria-label={piece.visible ? t('stlCutter.hide') : t('stlCutter.show')} onClick={(event) => { event.stopPropagation(); setSelectedId(piece.id); setPieces((current) => current.map((item) => item.id === piece.id ? { ...item, visible: !item.visible } : item)); }}>{piece.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button><input value={piece.name} aria-label={t('stlCutter.pieceName')} onChange={(event) => { setSelectedId(piece.id); setPieces((current) => current.map((item) => item.id === piece.id ? { ...item, name: event.target.value } : item)); }} /><span>{Math.floor(piece.mesh.indices.length / 3).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} tris</span></div><div className="stl-color-row">{PIECE_COLORS.map((color) => <button type="button" key={color} className={piece.color === color ? 'active' : ''} style={{ background: color }} aria-label={`${t('stlCutter.color')} ${color}`} onClick={(event) => { event.stopPropagation(); setSelectedId(piece.id); setPieces((current) => current.map((item) => item.id === piece.id ? { ...item, color } : item)); }} />)}<button type="button" className="stl-delete-piece" aria-label={t('stlCutter.delete')} onClick={(event) => { event.stopPropagation(); setSelectedId((current) => current === piece.id ? (pieces.find((item) => item.id !== piece.id)?.id ?? '') : current); saveHistory(); setPieces((current) => current.filter((item) => item.id !== piece.id)); }}>{t('stlCutter.delete')}</button></div></article>)}</div></section>
            {selectedPiece && <section className="stl-panel-section"><div className="stl-section-title"><span>{t('stlCutter.transform')}</span><Rotate3d size={15} /></div><div className="stl-transform-grid">{(['X', 'Y', 'Z'] as const).map((label, index) => <NumberField key={`p-${label}`} label={`${t('stlCutter.position')} ${label}`} value={selectedPiece.position[index]} unit="mm" onChange={(value) => updateTransform('position', index, value)} />)}{(['X', 'Y', 'Z'] as const).map((label, index) => <NumberField key={`r-${label}`} label={`${t('stlCutter.rotation')} ${label}`} value={selectedPiece.rotation[index]} unit="°" onChange={(value) => updateTransform('rotation', index, value)} />)}</div><RangeField label={t('stlCutter.explodedView')} value={explosionGap} min={0} max={80} step={1} unit="mm" onChange={setExplosionGap} /></section>}
          </>}
          {tab === 'export' && <section className="stl-panel-section stl-export-section"><div className="stl-section-title"><span>{t('stlCutter.exportPieces')}</span><Download size={15} /></div><p>{t('stlCutter.exportHint')}</p><button type="button" className="stl-export-button primary" onClick={downloadProject} disabled={!pieces.some((piece) => piece.visible)}><PackageOpen size={15} />{t('stlCutter.downloadProject')}</button><button type="button" className="stl-export-button" onClick={downloadBeds} disabled={!pieces.some((piece) => piece.visible)}><Grid3X3 size={15} />{t('stlCutter.exportBeds')}</button><div className="stl-export-split"><button type="button" onClick={downloadSelected} disabled={!selectedPiece}><Download size={14} />{t('stlCutter.selectedStl')}</button><button type="button" onClick={downloadAll} disabled={!pieces.some((piece) => piece.visible)}><Download size={14} />{t('stlCutter.allStl')}</button></div><button type="button" className="stl-reset-button" onClick={reset}>{t('stlCutter.reset')}</button></section>}
          {tab === 'change' && <section className="stl-panel-section stl-change-log"><div className="stl-section-title"><span>{t('stlCutter.changeLog')}</span><PencilRuler size={15} /></div><p>{t('stlCutter.changeHint')}</p>{[t('stlCutter.changeOne'), t('stlCutter.changeTwo'), t('stlCutter.changeThree'), t('stlCutter.changeFour'), t('stlCutter.changeFive'), t('stlCutter.changeSix')].map((item) => <div className="stl-change-item" key={item}><Check size={14} /><span>{item}</span></div>)}</section>}
          {renderAdvanced()}
        </div>
        <footer className="stl-sidebar-footer"><span><ShieldCheck size={12} />{t('admin.adminOnly')}</span><span>{t('stlCutter.offline')}</span></footer>
      </aside>
      <section className="stl-cutter-viewport" aria-label={t('stlCutter.preview')}><Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}><CutterScene pieces={pieces} selectedId={selectedId} tool={tool} planeAxis={axis} planeOffset={offset} bounds={selectedBounds} explosionGap={explosionGap} onSelect={setSelectedId} /></Canvas><div className="stl-viewport-top"><span className="stl-viewport-badge"><span className="stl-live-dot" />stl-cutter 2.0</span><span className="stl-viewport-badge">{pieces.length} {t('stlCutter.parts')}</span><button type="button" className="stl-icon-button" onClick={undo} disabled={!history.length} aria-label={t('stlCutter.undo')}><Undo2 size={15} /></button><button type="button" className="stl-icon-button" onClick={redo} disabled={!redoStack.length} aria-label={t('stlCutter.redo')}><Redo2 size={15} /></button></div><div className="stl-viewport-toolbar"><ToolButton label={t('stlCutter.rotate')} icon={Rotate3d} active={tool === 'rotate'} onClick={() => setTool('rotate')} /><ToolButton label={t('stlCutter.move')} icon={Move3d} active={tool === 'move'} onClick={() => setTool('move')} /><ToolButton label={t('stlCutter.select')} icon={MousePointer2} active={tool === 'select'} onClick={() => setTool('select')} /><ToolButton label={t('stlCutter.lineCut')} icon={Scissors} active={tool === 'line'} onClick={() => setTool('line')} /><ToolButton label={t('stlCutter.curveCut')} icon={Sparkles} active={tool === 'curve'} onClick={() => setTool('curve')} /><ToolButton label={t('stlCutter.mask')} icon={CircleDot} active={tool === 'mask'} onClick={() => setTool('mask')} /></div><div className="stl-viewport-help">{tool === 'curve' ? t('stlCutter.curveDrawHelp') : tool === 'mask' ? t('stlCutter.maskDrawHelp') : t('stlCutter.orbitHint')}</div>{(tool === 'curve' || tool === 'mask') && <svg className="stl-curve-overlay" onPointerDown={onViewportPointerDown} onPointerMove={onViewportPointerMove} onPointerUp={stopDrawing} onPointerCancel={stopDrawing}>{curve.length > 1 && <polyline points={curve.map((point) => point.screen.join(',')).join(' ')} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}{curve.map((point, index) => <circle key={`${point.screen[0]}-${point.screen[1]}-${index}`} cx={point.screen[0]} cy={point.screen[1]} r="3" fill="#fff" stroke="#f59e0b" strokeWidth="2" />)}</svg>}{tool === 'mask' && <div className="stl-mask-cursor" style={{ width: Math.max(18, maskRadius * 2), height: Math.max(18, maskRadius * 2) }} />}</section>
    </div>
  </main>;
}
