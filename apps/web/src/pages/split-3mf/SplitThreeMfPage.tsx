import {
  CircleHelp, Coffee, FileUp, Github, Info, Instagram, Redo2, Settings2,
  ShieldCheck, Trash2, Undo2, Upload, UserRound, X,
} from 'lucide-react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, GizmoHelper, GizmoViewport, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import * as THREE from 'three';
import { useI18n } from '../../lib/i18n';
import {
  applyConnectorPair, boundsOfMesh, geometryFromMesh, splitMeshByCurve, splitMeshByPlaneNormal,
  transformMesh, validateMesh, type ConnectorConfig, type CutterAxis, type CutterBounds, type CutterMesh,
} from '../../stlCutter/geometry';
import { buildThreeMf, downloadBytes, type ExportPart } from '../../stlCutter/export';
import { makeThreeMfDemo, parseThreeMfRegions, smoothMeshBoundary, surfaceArea } from '../../split3mf/model';
import { readThreeMfPackageEntries, type ThreeMfPackageEntries } from '../../split3mf/threeMfCore';
import {
  boundaryFrame, closeOpenMesh, deformMeshWithBrush, mergeColoredMeshParts, meshBoundaryCount,
  type CapAlgorithm, type ColoredMeshPart,
} from '../../split3mf/regionSplit';
import './split-3mf.css';

type SplitPiece = {
  id: string;
  name: string;
  color: string;
  mesh: CutterMesh;
  position: [number, number, number];
  group: number;
  selectable: boolean;
  generated?: 'cap' | 'solid';
};

type Snapshot = {
  pieces: SplitPiece[];
  selectedIds: string[];
  status: string;
  modelNames: Record<number, string>;
};

type CutMethod = 'patch' | 'interlocking';
type ConnectorMethod = 'none' | 'triangular' | 'cylinder' | 'rectangular';
type ManualMode = 'plane' | 'sketch';
type SketchFace = 'right' | 'left' | 'top' | 'bottom' | 'front' | 'back';
type SketchPoint = { screen: [number, number]; uv: [number, number] };
type Projector = (x: number, y: number, width: number, height: number) => [number, number] | null;

const PALETTE = ['#1f1f1e', '#ef4b22', '#078b7f', '#f49b32', '#d8d5ce', '#3f70d9', '#7358c7', '#ef7c9d'];
const EMPTY_CONNECTOR: ConnectorConfig = { enabled: false, kind: 'pyramid', size: 6, clearance: .3, depth: 4 };
const CAP_METHODS: Array<{ id: CapAlgorithm; label: string }> = [
  { id: 'soap-film', label: 'Soap film' },
  { id: 'cdt', label: 'CDT boundary' },
  { id: 'winding', label: 'Winding fill' },
  { id: 'centroid', label: 'Centroid cap' },
];
const CAP_INFO: Record<CapAlgorithm, { concept: string; pros: string; cons: string; fallback: string }> = {
  'soap-film': {
    concept: 'Keeps the boundary fixed and stretches a naturally curved membrane across the opening.',
    pros: 'The only curved method. It follows the original surface and usually gives the most natural result.',
    cons: 'Heaviest to compute and the most sensitive to complicated borders.',
    fallback: 'The affected loop is retried with a flat CDT cap, then a centroid cap.',
  },
  cdt: {
    concept: 'Projects a clean boundary to its dominant plane and triangulates the constrained outline.',
    pros: 'Clean, even flat caps that slice and print predictably.',
    cons: 'Overlapping or self-crossing borders can be difficult to triangulate.',
    fallback: 'Any loop that cannot be triangulated is closed with a centroid cap.',
  },
  winding: {
    concept: 'Closes every oriented boundary loop independently using winding-safe center fans.',
    pros: 'Reliable for several loops, overlaps and irregular boundaries.',
    cons: 'The cap is flat and can use more triangles than a clean CDT result.',
    fallback: 'Each unresolved loop is closed independently with a centroid fan.',
  },
  projected: {
    concept: 'Flattens the 3D boundary along its dominant normal before the connector volume is created.',
    pros: 'Produces a stable assembly face for gluing, sockets and plugs.',
    cons: 'Strongly bent borders can make the projected wall less natural.',
    fallback: 'The loop is closed with a centroid cap if planar projection fails.',
  },
  centroid: {
    concept: 'Places a center vertex in each loop and fans triangles into it.',
    pros: 'Fast and deterministic, even for difficult borders.',
    cons: 'Lowest visual quality on deeply concave borders.',
    fallback: 'None needed; this is the final safety method.',
  },
};
const FACE_INDEX: SketchFace[] = ['right', 'left', 'top', 'bottom', 'front', 'back'];

function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `split-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clonePieces(pieces: SplitPiece[]): SplitPiece[] {
  return pieces.map((piece) => ({
    ...piece,
    position: [...piece.position] as [number, number, number],
    mesh: { vertices: piece.mesh.vertices.slice(), indices: piece.mesh.indices.slice() },
  }));
}

function worldMesh(piece: SplitPiece): CutterMesh {
  return transformMesh(piece.mesh, piece.position, [0, 0, 0]);
}

function fileBase(name: string): string {
  return name.replace(/\.3mf$/i, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'split-model';
}

function combinedBounds(pieces: SplitPiece[]): CutterBounds | null {
  if (!pieces.length) return null;
  const boxes = pieces.map((piece) => boundsOfMesh(worldMesh(piece)));
  const min: [number, number, number] = [
    Math.min(...boxes.map((box) => box.min[0])),
    Math.min(...boxes.map((box) => box.min[1])),
    Math.min(...boxes.map((box) => box.min[2])),
  ];
  const max: [number, number, number] = [
    Math.max(...boxes.map((box) => box.max[0])),
    Math.max(...boxes.map((box) => box.max[1])),
    Math.max(...boxes.map((box) => box.max[2])),
  ];
  return {
    min,
    max,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
  };
}

function mergePieces(pieces: SplitPiece[]): ReturnType<typeof mergeColoredMeshParts> {
  return mergeColoredMeshParts(pieces.map((piece): ColoredMeshPart => ({
    name: piece.name,
    color: piece.color,
    mesh: worldMesh(piece),
  })));
}

function planeNormal(axis: CutterAxis, tiltDegrees: number): [number, number, number] {
  const tilt = THREE.MathUtils.degToRad(tiltDegrees);
  if (axis === 'x') return [Math.cos(tilt), Math.sin(tilt), 0];
  if (axis === 'y') return [Math.sin(tilt), Math.cos(tilt), 0];
  return [Math.sin(tilt), 0, Math.cos(tilt)];
}

function planeDefinition(bounds: CutterBounds, axis: CutterAxis, positionPercent: number, tilt: number) {
  const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const point = new THREE.Vector3(...bounds.center);
  point.setComponent(index, bounds.center[index] + bounds.size[index] * positionPercent / 200);
  const normal = planeNormal(axis, tilt);
  return { normal, offset: point.dot(new THREE.Vector3(...normal)), point: point.toArray() as [number, number, number] };
}

function faceAxis(face: SketchFace): CutterAxis {
  if (face === 'right' || face === 'left') return 'x';
  if (face === 'front' || face === 'back') return 'y';
  return 'z';
}

function facePoint(bounds: CutterBounds, face: SketchFace): [number, number, number] {
  const point = [...bounds.center] as [number, number, number];
  const axis = faceAxis(face);
  const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const positive = face === 'right' || face === 'front' || face === 'top';
  point[index] = positive ? bounds.max[index] : bounds.min[index];
  return point;
}

function splitBySketchAxis(mesh: CutterMesh, points: Array<[number, number]>, axis: CutterAxis): Promise<[CutterMesh, CutterMesh]> {
  if (axis === 'z') return splitMeshByCurve(mesh, points);
  const rotation: [number, number, number] = axis === 'x' ? [0, Math.PI / 2, 0] : [-Math.PI / 2, 0, 0];
  const inverse: [number, number, number] = axis === 'x' ? [0, -Math.PI / 2, 0] : [Math.PI / 2, 0, 0];
  return splitMeshByCurve(transformMesh(mesh, [0, 0, 0], rotation), points)
    .then(([first, second]) => [transformMesh(first, [0, 0, 0], inverse), transformMesh(second, [0, 0, 0], inverse)]);
}

function sketchConnectorFrame(points: Array<[number, number]>, axis: CutterAxis, bounds: CutterBounds): { center: [number, number, number]; normal: [number, number, number] } {
  const first = points[0];
  const last = points[points.length - 1];
  const midpoint: [number, number] = [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2];
  const du = last[0] - first[0];
  const dv = last[1] - first[1];
  const length = Math.hypot(du, dv) || 1;
  if (axis === 'x') return { center: [bounds.center[0], midpoint[1], midpoint[0]], normal: [0, -du / length, dv / length] };
  if (axis === 'y') return { center: [midpoint[0], bounds.center[1], midpoint[1]], normal: [dv / length, 0, -du / length] };
  return { center: [midpoint[0], midpoint[1], bounds.center[2]], normal: [dv / length, -du / length, 0] };
}

function PieceMesh({ piece, selected, visible, faded, boundaryMode, onSelect, onBrush, onBrushEnd }: {
  piece: SplitPiece;
  selected: boolean;
  visible: boolean;
  faded: boolean;
  boundaryMode: boolean;
  onSelect: (multi: boolean) => void;
  onBrush: (point: THREE.Vector3, normal: THREE.Vector3, direction: number, start: boolean) => void;
  onBrushEnd: () => void;
}) {
  const geometry = useMemo(() => geometryFromMesh(piece.mesh), [piece.mesh]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (!visible) return null;
  const opacity = faded ? .1 : boundaryMode ? (selected ? .62 : .24) : 1;
  const brushEvent = (event: ThreeEvent<PointerEvent>, start: boolean) => {
    if (!boundaryMode || !selected || !piece.selectable || !event.face) return;
    event.stopPropagation();
    const native = event.nativeEvent as PointerEvent;
    const isRight = native.button === 2 || native.buttons === 2;
    onBrush(event.point.clone(), event.face.normal.clone(), isRight ? -1 : 1, start);
  };
  return <group position={piece.position}>
    <mesh
      geometry={geometry}
      onPointerDown={(event) => boundaryMode ? brushEvent(event, true) : (piece.selectable && (event.stopPropagation(), onSelect(Boolean((event.nativeEvent as PointerEvent).shiftKey))))}
      onPointerMove={(event) => { if ((event.nativeEvent as PointerEvent).buttons) brushEvent(event, false); }}
      onPointerUp={onBrushEnd}
      onPointerCancel={onBrushEnd}
    >
      <meshPhysicalMaterial color={piece.color} roughness={.42} metalness={.02} clearcoat={.12} emissive={selected ? piece.color : '#000000'} emissiveIntensity={selected && !boundaryMode ? .12 : 0} transparent={opacity < 1} opacity={opacity} depthWrite={opacity > .2} side={THREE.DoubleSide} />
      {selected && !boundaryMode && <Edges color="#ed4d25" lineWidth={2.1} threshold={16} />}
    </mesh>
  </group>;
}

function ProjectionBridge({ axis, point, onReady }: { axis: CutterAxis; point: [number, number, number]; onReady: (projector: Projector) => void }) {
  const { camera } = useThree();
  useEffect(() => {
    const normal = axis === 'x' ? new THREE.Vector3(1, 0, 0) : axis === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    const plane = new THREE.Plane(normal, -normal.dot(new THREE.Vector3(...point)));
    const raycaster = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    onReady((x, y, width, height) => {
      raycaster.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, 1 - (y / height) * 2), camera);
      if (!raycaster.ray.intersectPlane(plane, hit)) return null;
      if (axis === 'x') return [hit.z, hit.y];
      if (axis === 'y') return [hit.x, hit.z];
      return [hit.x, hit.y];
    });
  }, [axis, camera, onReady, point[0], point[1], point[2]]);
  return null;
}

function FaceCamera({ bounds, face }: { bounds: CutterBounds; face: SketchFace | null }) {
  const { camera } = useThree();
  useEffect(() => {
    if (!face) return;
    const center = new THREE.Vector3(...bounds.center);
    const directions: Record<SketchFace, THREE.Vector3> = {
      right: new THREE.Vector3(1, 0, 0), left: new THREE.Vector3(-1, 0, 0),
      front: new THREE.Vector3(0, 1, 0), back: new THREE.Vector3(0, -1, 0),
      top: new THREE.Vector3(0, 0, 1), bottom: new THREE.Vector3(0, 0, -1),
    };
    const distance = Math.max(...bounds.size, 1) * 2.2;
    camera.position.copy(center.clone().addScaledVector(directions[face], distance));
    camera.up.set(0, 0, 1);
    if (face === 'top' || face === 'bottom') camera.up.set(0, 1, 0);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }, [bounds, camera, face]);
  return null;
}

function BoundingBoxPicker({ bounds, onFace }: { bounds: CutterBounds; onFace: (face: SketchFace) => void }) {
  return <mesh position={bounds.center} onPointerDown={(event) => {
    event.stopPropagation();
    const face = FACE_INDEX[event.face?.materialIndex ?? -1];
    if (face) onFace(face);
  }}>
    <boxGeometry args={bounds.size.map((value) => Math.max(value, .01)) as [number, number, number]} />
    {FACE_INDEX.map((face, index) => <meshBasicMaterial key={face} attach={`material-${index}`} color="#cfe8e5" transparent opacity={.12} side={THREE.DoubleSide} depthWrite={false} />)}
    <Edges color="#617a78" lineWidth={1.1} />
  </mesh>;
}

function PlanePreview({ bounds, axis, positionPercent, tilt }: { bounds: CutterBounds; axis: CutterAxis; positionPercent: number; tilt: number }) {
  const { normal, point } = planeDefinition(bounds, axis, positionPercent, tilt);
  const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal).normalize()), [normal[0], normal[1], normal[2]]);
  const size = Math.max(...bounds.size, 1) * 1.65;
  return <mesh position={point} quaternion={quaternion} raycast={() => null}>
    <planeGeometry args={[size, size]} />
    <meshBasicMaterial color="#ed4d25" transparent opacity={.17} side={THREE.DoubleSide} depthWrite={false} />
    <Edges color="#ed4d25" lineWidth={1.2} />
  </mesh>;
}

function ProjectedPreview({ pieces }: { pieces: SplitPiece[] }) {
  return <>{pieces.map((piece) => <ProjectedPreviewMesh key={`projected-${piece.id}`} piece={piece} />)}</>;
}

function ProjectedPreviewMesh({ piece }: { piece: SplitPiece }) {
  const geometry = useMemo(() => geometryFromMesh(piece.mesh), [piece.mesh]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={piece.position} scale={1.003} raycast={() => null}>
    <meshBasicMaterial color="#f16335" transparent opacity={.22} side={THREE.DoubleSide} depthWrite={false} />
    <Edges color="#ed4d25" lineWidth={1.1} threshold={18} />
  </mesh>;
}

function SplitScene({ pieces, selectedIds, visibilityGroup, bounds, manualOpen, manualMode, axis, positionPercent, tilt, sketchFace, boundaryOpen, interlockingPreview, viewRevision, onSelect, onProjector, onFace, onBrush, onBrushEnd }: {
  pieces: SplitPiece[];
  selectedIds: string[];
  visibilityGroup: 'all' | number;
  bounds: CutterBounds | null;
  manualOpen: boolean;
  manualMode: ManualMode;
  axis: CutterAxis;
  positionPercent: number;
  tilt: number;
  sketchFace: SketchFace | null;
  boundaryOpen: boolean;
  interlockingPreview: boolean;
  viewRevision: number;
  onSelect: (id: string, multi: boolean) => void;
  onProjector: (projector: Projector) => void;
  onFace: (face: SketchFace) => void;
  onBrush: (id: string, point: THREE.Vector3, normal: THREE.Vector3, direction: number, start: boolean) => void;
  onBrushEnd: () => void;
}) {
  const extent = bounds ? Math.max(...bounds.size, 1) : 80;
  const center = bounds?.center ?? [0, 0, 25];
  const distance = Math.max(75, extent * 2.05);
  const selectedPieces = pieces.filter((piece) => selectedIds.includes(piece.id));
  const sketchPoint = bounds && sketchFace ? facePoint(bounds, sketchFace) : center;
  return <>
    <color attach="background" args={['#fbfaf8']} />
    <PerspectiveCamera key={`camera-${viewRevision}`} makeDefault position={[distance * .9, -distance * 1.15, distance * .72]} fov={42} near={.01} far={Math.max(10000, distance * 40)} up={[0, 0, 1]} />
    <ambientLight intensity={1.72} color="#fffaf2" />
    <directionalLight position={[160, -220, 280]} intensity={2.35} />
    <directionalLight position={[-180, 120, 100]} intensity={.72} color="#cfefea" />
    <gridHelper args={[1000, 50, '#aaa89f', '#ddd9d0']} rotation={[Math.PI / 2, 0, 0]} />
    {pieces.map((piece) => <PieceMesh key={piece.id} piece={piece} selected={selectedIds.includes(piece.id)} visible={visibilityGroup === 'all' || visibilityGroup === piece.group} faded={Boolean(manualOpen && manualMode === 'sketch' && sketchFace)} boundaryMode={boundaryOpen} onSelect={(multi) => onSelect(piece.id, multi)} onBrush={(point, normal, direction, start) => onBrush(piece.id, point, normal, direction, start)} onBrushEnd={onBrushEnd} />)}
    {bounds && manualOpen && manualMode === 'plane' && <PlanePreview bounds={bounds} axis={axis} positionPercent={positionPercent} tilt={tilt} />}
    {bounds && manualOpen && manualMode === 'sketch' && !sketchFace && <BoundingBoxPicker bounds={bounds} onFace={onFace} />}
    {bounds && manualOpen && manualMode === 'sketch' && <FaceCamera bounds={bounds} face={sketchFace} />}
    {bounds && manualOpen && manualMode === 'sketch' && sketchFace && <ProjectionBridge axis={axis} point={sketchPoint as [number, number, number]} onReady={onProjector} />}
    {interlockingPreview && <ProjectedPreview pieces={selectedPieces} />}
    <OrbitControls key={`orbit-${viewRevision}-${sketchFace ?? 'free'}`} enablePan enableRotate={!sketchFace} enableDamping dampingFactor={.1} target={center} minDistance={Math.max(12, extent * .25)} maxDistance={Math.max(3000, extent * 60)} makeDefault />
    {!sketchFace && <GizmoHelper alignment="top-right" margin={[58, 68]}><GizmoViewport axisColors={['#e4472b', '#159a84', '#3273c8']} labelColor="#191816" /></GizmoHelper>}
  </>;
}

function RangeControl({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (value: number) => void }) {
  return <label className="split3mf-range"><span><b>{label}</b><em>{unit && `[${unit}]`}</em><input type="number" aria-label={label} value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></span><input aria-label={`${label} slider`} type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function MethodDiagram({ kind }: { kind: 'patch' | 'interlocking' | ConnectorMethod | 'part-plug' | 'body-plug' }) {
  return <i className={`split3mf-method-diagram ${kind}`} aria-hidden="true"><b /><em /></i>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="split3mf-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="split3mf-modal" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></header>{children}</section></div>;
}

export function SplitThreeMfPage() {
  const { language, toggleLanguage } = useI18n();
  const vi = language === 'vi';
  const [pieces, setPieces] = useState<SplitPiece[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [sourcePackage, setSourcePackage] = useState<ThreeMfPackageEntries>({});
  const [status, setStatus] = useState(vi ? 'Chờ' : 'Wait');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [baseline, setBaseline] = useState<Snapshot | null>(null);
  const [modelNames, setModelNames] = useState<Record<number, string>>({});
  const [cutMethod, setCutMethod] = useState<CutMethod>('patch');
  const [capMethod, setCapMethod] = useState<CapAlgorithm>('soap-film');
  const [patchSettingsOpen, setPatchSettingsOpen] = useState(false);
  const [capInfoOpen, setCapInfoOpen] = useState<CapAlgorithm | null>(null);
  const [connectorMethod, setConnectorMethod] = useState<ConnectorMethod>('none');
  const [connectorSide, setConnectorSide] = useState<'part' | 'body'>('part');
  const [connectorArea, setConnectorArea] = useState(10);
  const [connectorTolerance, setConnectorTolerance] = useState(.3);
  const [projectedArea, setProjectedArea] = useState(70);
  const [projectedDepth, setProjectedDepth] = useState(0);
  const [splitInPlace, setSplitInPlace] = useState(false);
  const [boundaryOpen, setBoundaryOpen] = useState(false);
  const [boundaryRange, setBoundaryRange] = useState(20);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualMode, setManualMode] = useState<ManualMode>('plane');
  const [axis, setAxis] = useState<CutterAxis>('z');
  const [positionPercent, setPositionPercent] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [sketchFace, setSketchFace] = useState<SketchFace | null>(null);
  const [sketch, setSketch] = useState<SketchPoint[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [visibilityGroup, setVisibilityGroup] = useState<'all' | number>('all');
  const [serviceGuideOpen, setServiceGuideOpen] = useState(false);
  const [toleranceGuideOpen, setToleranceGuideOpen] = useState(false);
  const [shellWarning, setShellWarning] = useState(false);
  const [shellWarningOpen, setShellWarningOpen] = useState(false);
  const [supportVisible, setSupportVisible] = useState(true);
  const [viewRevision, setViewRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const projector = useRef<Projector | null>(null);
  const boundaryStroke = useRef(false);

  useEffect(() => { if (!pieces.length) setStatus(vi ? 'Chờ' : 'Wait'); }, [vi, pieces.length]);

  const groups = [...new Set(pieces.map((piece) => piece.group))].sort((a, b) => a - b);
  const activeGroup = typeof visibilityGroup === 'number' ? visibilityGroup : (groups[0] ?? 1);
  const activePieces = pieces.filter((piece) => piece.group === activeGroup);
  const selectedPieces = pieces.filter((piece) => selectedIds.includes(piece.id) && piece.selectable);
  const visiblePieces = pieces.filter((piece) => visibilityGroup === 'all' || piece.group === visibilityGroup);
  const sceneBounds = combinedBounds(visiblePieces);
  const activeBounds = combinedBounds(activePieces);
  const selectableInActive = activePieces.filter((piece) => piece.selectable);

  const snapshot = useCallback((): Snapshot => ({ pieces: clonePieces(pieces), selectedIds: [...selectedIds], status, modelNames: { ...modelNames } }), [modelNames, pieces, selectedIds, status]);
  const remember = useCallback(() => { setPast((current) => [...current.slice(-24), snapshot()]); setFuture([]); }, [snapshot]);
  const restore = (value: Snapshot) => {
    setPieces(clonePieces(value.pieces)); setSelectedIds([...value.selectedIds]); setStatus(value.status); setModelNames({ ...value.modelNames });
    setError(''); setSketch([]); setSketchFace(null); setBoundaryOpen(false);
  };
  const undo = () => {
    const previous = past.at(-1); if (!previous) return;
    setFuture((current) => [snapshot(), ...current].slice(0, 25)); setPast((current) => current.slice(0, -1)); restore(previous);
    setStatus(vi ? 'Đã hoàn tác thao tác gần nhất.' : 'Undid the last action.');
  };
  const redo = () => {
    const next = future[0]; if (!next) return;
    setPast((current) => [...current, snapshot()].slice(-25)); setFuture((current) => current.slice(1)); restore(next);
    setStatus(vi ? 'Đã làm lại thao tác.' : 'Redid the action.');
  };

  const installRegions = (regions: ReturnType<typeof makeThreeMfDemo>, name: string, size: number, packageEntries: ThreeMfPackageEntries = {}) => {
    const loaded: SplitPiece[] = regions.map((region, index) => ({ ...region, id: uid(), position: [0, 0, 0], group: 1, selectable: true, color: region.color || PALETTE[index % PALETTE.length] }));
    const names = { 1: 'Model 1' };
    const nextStatus = vi ? 'Sẵn sàng — bấm vào một vùng màu trên mô hình' : 'Ready - click a color on the model to select it';
    const next: Snapshot = { pieces: loaded, selectedIds: [], status: nextStatus, modelNames: names };
    setPieces(loaded); setSelectedIds([]); setFileName(name); setFileSize(size); setSourcePackage(packageEntries); setStatus(nextStatus); setModelNames(names);
    setBaseline({ ...next, pieces: clonePieces(loaded), modelNames: { ...names } });
    setShellWarning(loaded.length > 1 && loaded.every((piece) => meshBoundaryCount(piece.mesh) === 0));
    setPast([]); setFuture([]); setError(''); setVisibilityGroup('all'); setBoundaryOpen(false); setManualOpen(false); setSketch([]); setSketchFace(null); setViewRevision((value) => value + 1);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!/\.3mf$/i.test(file.name)) { setError(vi ? 'Hãy chọn file .3MF.' : 'Choose a .3MF file.'); return; }
    setBusy(true); setError('');
    setStatus(file.size > 10 * 1024 * 1024 ? (vi ? 'Đã phát hiện file lớn. Phân tích vẫn diễn ra cục bộ trong trình duyệt…' : 'Large file detected. Analysis stays in your browser…') : (vi ? `Đang đọc ${file.name}…` : `Reading ${file.name}…`));
    try {
      setStatus(vi ? 'Đang mở gói 3MF…' : 'Opening the 3MF package…');
      const data = await file.arrayBuffer();
      const regions = parseThreeMfRegions(data.slice(0), file.name);
      if (!regions.length) throw new Error(vi ? 'Không tìm thấy dữ liệu model 3MF.' : 'No readable 3MF model data was found.');
      setStatus(vi ? 'Đang tìm các vùng màu đã sơn…' : 'Finding painted color regions…');
      installRegions(regions, file.name, file.size, readThreeMfPackageEntries(data));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (vi ? 'Không thể phân tích file 3MF.' : 'Could not analyze the 3MF file.'));
      setStatus(vi ? 'Không thể tải mô hình' : 'Model load failed');
    } finally { setBusy(false); }
  };
  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; void onFile(file); };
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); void onFile(event.dataTransfer.files?.[0]); };
  const loadDemo = () => { setStatus(vi ? 'Đang đọc mô hình mẫu…' : 'Reading sample model…'); window.setTimeout(() => installRegions(makeThreeMfDemo(), 'Pingu.3mf', 526336), 80); };
  const clearModel = () => { setPieces([]); setSelectedIds([]); setFileName(''); setFileSize(0); setSourcePackage({}); setBaseline(null); setModelNames({}); setShellWarning(false); setVisibilityGroup('all'); setStatus(vi ? 'Chờ' : 'Wait'); setManualOpen(false); setBoundaryOpen(false); };
  const resetModel = () => { if (!baseline) return; remember(); restore(baseline); setVisibilityGroup('all'); setViewRevision((value) => value + 1); setStatus(vi ? 'Model đã được đặt lại về file ban đầu.' : 'Model reset to the uploaded file.'); };

  const selectPiece = (pieceId: string, multi: boolean) => {
    const piece = pieces.find((candidate) => candidate.id === pieceId);
    if (!piece?.selectable || manualOpen) return;
    if (visibilityGroup !== 'all' && piece.group !== visibilityGroup) return;
    setSelectedIds((current) => {
      const sameGroup = current.filter((id) => pieces.find((candidate) => candidate.id === id)?.group === piece.group);
      return multi ? (sameGroup.includes(pieceId) ? sameGroup.filter((id) => id !== pieceId) : [...sameGroup, pieceId]) : [pieceId];
    });
    setStatus(vi ? 'Đã chọn vùng màu — nhấn Space để tách.' : 'Color selected - press Space to split it.');
  };

  const connectorConfig = (bounds: CutterBounds | null): ConnectorConfig => {
    if (connectorMethod === 'none') return EMPTY_CONNECTOR;
    const positiveSizes = bounds?.size.filter((size) => size > .001) ?? [20];
    const sizeBasis = Math.max(2, Math.min(...positiveSizes));
    const kind = connectorMethod === 'triangular' ? 'pyramid' : connectorMethod === 'cylinder' ? 'cylinder' : 'box';
    return { enabled: true, kind, size: Math.max(2, Math.min(30, sizeBasis * connectorArea / 100)), clearance: Math.max(0, connectorTolerance), depth: Math.max(2, projectedDepth || sizeBasis * projectedArea / 500) };
  };

  const detachSelectedRegions = async () => {
    if (!selectedPieces.length) return;
    const sourceGroup = selectedPieces[0].group;
    if (selectedPieces.some((piece) => piece.group !== sourceGroup)) { setError(vi ? 'Chỉ tách các vùng trong cùng một model.' : 'Split regions from one model at a time.'); return; }
    const groupPieces = pieces.filter((piece) => piece.group === sourceGroup);
    const remainingPieces = groupPieces.filter((piece) => !selectedIds.includes(piece.id));
    if (!remainingPieces.length || !remainingPieces.some((piece) => piece.mesh.indices.length >= 3)) { setError(vi ? 'Hãy để lại ít nhất một vùng trong model hiện tại.' : 'Leave at least one region in the current model.'); return; }
    setBusy(true); setError(''); setStatus(vi ? 'Đang tính toán phần tách…' : `Calculating split with ${cutMethod === 'patch' ? CAP_METHODS.find((item) => item.id === capMethod)?.label : 'Projected normal'}…`);
    try {
      const selectedSurface = mergePieces(selectedPieces).mesh;
      const remainingSurface = mergePieces(remainingPieces).mesh;
      const boundaryCount = meshBoundaryCount(selectedSurface);
      const algorithm: CapAlgorithm = cutMethod === 'interlocking' ? 'projected' : capMethod;
      let selectedClosed = boundaryCount ? closeOpenMesh(selectedSurface, algorithm) : { mesh: selectedSurface, cap: { vertices: [], indices: [] }, boundaryLoops: 0 };
      let remainingClosed = boundaryCount ? closeOpenMesh(remainingSurface, algorithm) : { mesh: remainingSurface, cap: { vertices: [], indices: [] }, boundaryLoops: 0 };
      try { await validateMesh(selectedClosed.mesh); await validateMesh(remainingClosed.mesh); }
      catch {
        if (algorithm === 'centroid') throw new Error(vi ? 'Biên màu không tạo được khối kín.' : 'The color boundary could not be closed into a printable solid.');
        setStatus(vi ? 'Thuật toán đã chọn thất bại, đang thử Centroid cap…' : `${CAP_METHODS.find((item) => item.id === algorithm)?.label ?? algorithm} failed; retrying with Centroid cap…`);
        selectedClosed = closeOpenMesh(selectedSurface, 'centroid'); remainingClosed = closeOpenMesh(remainingSurface, 'centroid');
        await validateMesh(selectedClosed.mesh); await validateMesh(remainingClosed.mesh);
      }

      remember();
      const nextGroup = Math.max(0, ...groups) + 1;
      const selectionBounds = boundsOfMesh(selectedClosed.mesh);
      const offset = splitInPlace ? 0 : selectionBounds.size[0] + 12;
      let nextPieces: SplitPiece[];
      const connector = connectorConfig(selectionBounds);
      if (connector.enabled && boundaryCount) {
        const frame = boundaryFrame(selectedSurface);
        const connected = await applyConnectorPair(selectedClosed.mesh, remainingClosed.mesh, frame.center, frame.normal, connector, connectorSide === 'part' ? 'first' : 'second');
        nextPieces = [
          ...pieces.filter((piece) => piece.group !== sourceGroup),
          { id: uid(), name: `${modelNames[sourceGroup] ?? `Model ${sourceGroup}`} · body`, color: remainingPieces.find((piece) => piece.selectable)?.color ?? '#1f1f1e', mesh: connected[1], position: [0, 0, 0], group: sourceGroup, selectable: false, generated: 'solid' },
          { id: uid(), name: `Model ${nextGroup} · connector part`, color: selectedPieces[0].color, mesh: connected[0], position: [offset, 0, 0], group: nextGroup, selectable: false, generated: 'solid' },
        ];
      } else {
        const restCap: SplitPiece[] = remainingClosed.cap.indices.length ? [{ id: uid(), name: 'Generated cap', color: remainingPieces.find((piece) => piece.selectable)?.color ?? '#1f1f1e', mesh: remainingClosed.cap, position: [0, 0, 0], group: sourceGroup, selectable: false, generated: 'cap' }] : [];
        const selectedCap: SplitPiece[] = selectedClosed.cap.indices.length ? [{ id: uid(), name: 'Generated cap', color: selectedPieces[0].color, mesh: selectedClosed.cap, position: [offset, 0, 0], group: nextGroup, selectable: false, generated: 'cap' }] : [];
        nextPieces = [...pieces.filter((piece) => piece.group !== sourceGroup), ...remainingPieces, ...restCap, ...selectedPieces.map((piece) => ({ ...piece, group: nextGroup, position: [piece.position[0] + offset, piece.position[1], piece.position[2]] as [number, number, number], selectable: false })), ...selectedCap];
      }
      setPieces(nextPieces); setSelectedIds([]); setVisibilityGroup('all'); setBoundaryOpen(false); setSketch([]);
      setModelNames((current) => ({ ...current, [nextGroup]: `Model ${nextGroup}` }));
      setStatus(vi ? `Model ${nextGroup} đã được tách${splitInPlace ? ' tại vị trí cũ' : ' và đặt trên bàn in'}.` : `Model ${nextGroup} was split${splitInPlace ? ' in place' : ' and kept on the plate'}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : (vi ? 'Không thể tính toán phần tách.' : 'The split could not be calculated.')); }
    finally { setBusy(false); }
  };

  const performManualCut = async () => {
    if (!activePieces.length || !activeBounds) return;
    if (manualMode === 'sketch' && (!sketchFace || sketch.length < 2)) { setError(vi ? 'Hãy chọn một mặt hộp và vẽ đường cắt.' : 'Choose a bounding-box face and draw a cut line.'); return; }
    setBusy(true); setError(''); setStatus(vi ? 'Đang tính toán đường cắt…' : 'Calculating cut…');
    try {
      const combined = mergePieces(activePieces).mesh;
      const closed = meshBoundaryCount(combined) ? closeOpenMesh(combined, 'centroid').mesh : combined;
      let split: [CutterMesh, CutterMesh];
      if (manualMode === 'plane') { const definition = planeDefinition(activeBounds, axis, positionPercent, tilt); split = await splitMeshByPlaneNormal(closed, definition.normal, definition.offset, connectorConfig(activeBounds), connectorSide === 'part' ? 'positive' : 'negative'); }
      else {
        const sketchPoints = sketch.map((point) => point.uv);
        split = await splitBySketchAxis(closed, sketchPoints, axis);
        const connector = connectorConfig(activeBounds);
        if (connector.enabled) {
          const frame = sketchConnectorFrame(sketchPoints, axis, activeBounds);
          split = await applyConnectorPair(split[0], split[1], frame.center, frame.normal, connector, connectorSide === 'part' ? 'first' : 'second');
        }
      }
      if (split.some((part) => part.indices.length < 3)) throw new Error(vi ? 'Đường cắt không chia model thành hai khối.' : 'The cut did not divide the model into two solids.');
      await validateMesh(split[0]); await validateMesh(split[1]); remember();
      const nextGroup = Math.max(0, ...groups) + 1;
      const secondBounds = boundsOfMesh(split[1]);
      setPieces((current) => [...current.filter((piece) => piece.group !== activeGroup),
        { id: uid(), name: `${modelNames[activeGroup] ?? `Model ${activeGroup}`} · ${manualMode}`, color: activePieces[0].color, mesh: split[0], position: [0, 0, 0], group: activeGroup, selectable: false, generated: 'solid' },
        { id: uid(), name: `Model ${nextGroup} · ${manualMode}`, color: PALETTE[nextGroup % PALETTE.length], mesh: split[1], position: splitInPlace ? [0, 0, 0] : [secondBounds.size[0] + 12, 0, 0], group: nextGroup, selectable: false, generated: 'solid' },
      ]);
      setModelNames((current) => ({ ...current, [nextGroup]: `Model ${nextGroup}` })); setSelectedIds([]); setSketch([]); setSketchFace(null); setVisibilityGroup('all');
      setStatus(vi ? `${manualMode === 'plane' ? 'Cắt mặt phẳng' : 'Cắt sketch'} đã tạo Model ${nextGroup}.` : `${manualMode === 'plane' ? 'Plane cut' : 'Sketch cut'} created Model ${nextGroup}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : (vi ? 'Không thể hoàn tất đường cắt.' : 'The cut could not be completed.')); }
    finally { setBusy(false); }
  };

  const applyBoundary = () => {
    if (!selectedIds.length) return; remember();
    const strength = .12 + boundaryRange / 200;
    setPieces((current) => current.map((piece) => selectedIds.includes(piece.id) ? { ...piece, mesh: smoothMeshBoundary(piece.mesh, 2, Math.min(.62, strength)) } : piece));
    setStatus(vi ? 'Biên màu đã được vẽ lại bằng đường cong mượt.' : 'The color boundary was redrawn with a smooth curve.'); setBoundaryOpen(false); boundaryStroke.current = false;
  };

  const onBoundaryBrush = (pieceId: string, point: THREE.Vector3, normal: THREE.Vector3, direction: number, start: boolean) => {
    const piece = pieces.find((candidate) => candidate.id === pieceId); if (!piece) return;
    if (start && !boundaryStroke.current) { remember(); boundaryStroke.current = true; }
    const bounds = boundsOfMesh(piece.mesh); const radius = Math.max(1, Math.max(...bounds.size) * boundaryRange / 100);
    const localPoint = point.sub(new THREE.Vector3(...piece.position));
    setPieces((current) => current.map((candidate) => candidate.id === pieceId ? { ...candidate, mesh: deformMeshWithBrush(candidate.mesh, localPoint.toArray() as [number, number, number], normal.toArray() as [number, number, number], radius, direction * radius * .045) } : candidate));
  };

  const splitAction = () => { if (busy) return; if (boundaryOpen) applyBoundary(); else if (manualOpen) void performManualCut(); else void detachSelectedRegions(); };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !event.repeat && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) { event.preventDefault(); splitAction(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  });

  const exportParts = (): ExportPart[] => {
    const exportGroups = visibilityGroup === 'all' ? groups : groups.filter((group) => group === visibilityGroup);
    return exportGroups.map((group) => { const merged = mergePieces(pieces.filter((piece) => piece.group === group)); return { name: modelNames[group] ?? `Model ${group}`, color: pieces.find((piece) => piece.group === group)?.color ?? '#777777', mesh: merged.mesh, materials: merged.materials }; }).filter((part) => part.mesh.indices.length >= 3);
  };
  const runDownload = async () => {
    const parts = exportParts(); if (!parts.length) return;
    setBusy(true); setError(''); setStatus(vi ? `Đang dựng ${visibilityGroup === 'all' ? 'tất cả model' : modelNames[visibilityGroup]}…` : `Building ${visibilityGroup === 'all' ? 'All' : modelNames[visibilityGroup]}…`);
    try {
      for (const part of parts) await validateMesh(part.mesh);
      const suffix = visibilityGroup === 'all' ? 'all' : `model-${visibilityGroup}`;
      downloadBytes(buildThreeMf(parts, `${fileName} · Split3MF`, sourcePackage), 'model/3mf', `${fileBase(fileName)}-${suffix}.3mf`);
      setStatus(vi ? 'Tải xuống hoàn tất.' : `${visibilityGroup === 'all' ? 'All' : modelNames[visibilityGroup]} download complete.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : (vi ? 'Không thể tạo file xuất.' : 'The export could not be built.')); }
    finally { setBusy(false); }
  };

  const removeActiveModel = () => {
    if (typeof visibilityGroup !== 'number') return; remember();
    const removed = modelNames[visibilityGroup] ?? `Model ${visibilityGroup}`;
    setPieces((current) => current.filter((piece) => piece.group !== visibilityGroup)); setSelectedIds([]); setModelNames((current) => { const next = { ...current }; delete next[visibilityGroup]; return next; }); setVisibilityGroup('all'); setStatus(vi ? `${removed} đã được xóa.` : `${removed} was removed.`);
  };
  const renameModel = (group: number) => {
    const current = modelNames[group] ?? `Model ${group}`; const next = window.prompt(vi ? `Đổi tên ${current}` : `Rename ${current}`, current)?.trim();
    if (!next || next === current) return; remember(); setModelNames((names) => ({ ...names, [group]: next })); setStatus(vi ? `${current} đã đổi tên thành ${next}.` : `${current} was renamed to ${next}.`);
  };

  const onSketchPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect(); const screen: [number, number] = [event.clientX - rect.left, event.clientY - rect.top]; const uv = projector.current?.(screen[0], screen[1], rect.width, rect.height); if (!uv) return;
    event.currentTarget.setPointerCapture?.(event.pointerId); setDrawing(true); setSketch((current) => [...current, { screen, uv }]);
  };
  const onSketchPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing) return; const rect = event.currentTarget.getBoundingClientRect(); const screen: [number, number] = [event.clientX - rect.left, event.clientY - rect.top]; const uv = projector.current?.(screen[0], screen[1], rect.width, rect.height); if (!uv) return;
    setSketch((current) => { const previous = current.at(-1); return previous && Math.hypot(previous.screen[0] - screen[0], previous.screen[1] - screen[1]) < 5 ? current : [...current, { screen, uv }]; });
  };
  const stopSketch = (event: ReactPointerEvent<SVGSVGElement>) => { setDrawing(false); try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* optional capture */ } };

  const splitDisabled = busy || (boundaryOpen ? !selectedPieces.length : manualOpen ? !activePieces.length || (manualMode === 'sketch' && (!sketchFace || sketch.length < 2)) : !selectedPieces.length);
  const formatSize = fileSize ? `${Math.max(1, Math.round(fileSize / 1024)).toLocaleString()}KB` : '';
  const selectedCapInfo = capInfoOpen ? CAP_INFO[capInfoOpen] : null;

  return <main className="split3mf-page">
    <aside className="split3mf-sidebar">
      <div className="split3mf-brand"><span className="split3mf-logo"><i /><b /><em /></span><h1>Split3MF<sup>TM</sup></h1></div>
      <div className="split3mf-sidebar-scroll">
        {fileName ? <div className="split3mf-file-chip"><FileUp size={17} /><strong>{fileName}<small>({formatSize})</small></strong>{shellWarning && <button type="button" className="split3mf-chip-warning" onClick={() => setShellWarningOpen(true)} aria-label="Color parts are already separated"><Info size={13} /></button>}<button type="button" onClick={clearModel} aria-label={vi ? 'Đóng mô hình' : 'Close model'}><X size={14} /></button></div> : <div className="split3mf-upload-card" role="button" tabIndex={0} onClick={() => fileInput.current?.click()} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') fileInput.current?.click(); }} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}><Upload size={28} /><b>{vi ? 'Tải 3MF lên' : 'Upload 3MF'}</b><small>{vi ? 'File trên 10MB có thể chậm hoặc lỗi.' : 'Files over 10MB may be slow or fail.'}</small></div>}
        <input ref={fileInput} hidden type="file" accept=".3mf,model/3mf" onChange={onFileInput} />

        <section className="split3mf-sidebar-section"><div className="split3mf-section-heading"><h2>{vi ? 'Làm mượt biên' : 'Smooth boundary'}</h2><button type="button" onClick={resetModel} disabled={!baseline || boundaryOpen}>{vi ? 'Đặt lại model' : 'Reset model'}</button></div>
          <button type="button" className={`split3mf-wide-button${boundaryOpen ? ' open' : ''}`} disabled={!selectedPieces.length || manualOpen} aria-expanded={boundaryOpen} onClick={() => { const next = !boundaryOpen; setBoundaryOpen(next); boundaryStroke.current = false; setStatus(next ? (vi ? 'Bạn có thể điều chỉnh biên.' : 'You can adjust the boundary.') : (vi ? 'Sẵn sàng.' : 'Ready - click a color on the model to select it')); }}>{boundaryOpen ? (vi ? 'Đóng điều chỉnh biên' : 'Close boundary adjustment') : (vi ? 'Điều chỉnh biên' : 'Adjust boundary')}</button>
          {boundaryOpen && <><div className="split3mf-settings-box"><RangeControl label={vi ? 'Phạm vi vùng' : 'Area range'} value={boundaryRange} min={5} max={60} unit="%" onChange={setBoundaryRange} /></div><button type="button" className="split3mf-wide-button split3mf-smooth-apply" onClick={applyBoundary}>{vi ? 'Áp dụng làm mượt biên' : 'Apply smooth boundary'}</button><p className="split3mf-help-copy">{vi ? 'Bấm trái gần biên để kéo vùng ra; bấm phải để đẩy vào. Kéo dọc theo biên để tạo lại đường cong.' : 'Click near the boundary: left-click pulls the area toward the click, right-click pushes it away. Drag along the boundary to reshape the area.'}</p></>}
        </section>

        <section className="split3mf-sidebar-section"><h2>{vi ? 'Thiết lập tách' : 'Split settings'}</h2><label className="split3mf-field-label">{vi ? 'Phương pháp cắt' : 'Cut method'}</label>
          <div className="split3mf-choice-grid two" role="radiogroup" aria-label={vi ? 'Phương pháp cắt' : 'Cut method'}>
            <label className={cutMethod === 'patch' ? 'active' : ''}><input type="radio" aria-label="Patch" checked={cutMethod === 'patch'} onChange={() => { setCutMethod('patch'); setStatus(vi ? 'Thiết lập đã thay đổi. Nhấn Tách lần nữa.' : 'Settings changed. Press Split again.'); }} /><span>Patch</span><MethodDiagram kind="patch" /><button type="button" aria-label="Choose Patch method" aria-expanded={patchSettingsOpen} onClick={(event) => { event.preventDefault(); setPatchSettingsOpen((value) => !value); }}><Settings2 size={13} /></button></label>
            <label className={cutMethod === 'interlocking' ? 'active' : ''}><input type="radio" aria-label="Interlocking" checked={cutMethod === 'interlocking'} onChange={() => { setCutMethod('interlocking'); setPatchSettingsOpen(false); setStatus(vi ? 'Thể tích màu cam là hình dạng chính xác sẽ được tạo khi tách.' : 'The orange volume is the exact shape that will be created when you split.'); }} /><span>Interlocking</span><MethodDiagram kind="interlocking" /></label>
          </div>
          {patchSettingsOpen && <div className="split3mf-cap-list" role="listbox" aria-label="Cut method">{CAP_METHODS.map((method) => <div key={method.id}><button type="button" role="option" aria-selected={capMethod === method.id} className={capMethod === method.id ? 'active' : ''} onClick={() => { setCapMethod(method.id); setCutMethod('patch'); setPatchSettingsOpen(false); }}>{method.label}</button><button type="button" aria-label={`Show how ${method.label} works`} onClick={() => setCapInfoOpen(method.id)}>i</button></div>)}</div>}
          {cutMethod === 'interlocking' && <div className="split3mf-settings-box"><RangeControl label={vi ? 'Diện tích mặt chiếu' : 'Projected plane area'} value={projectedArea} min={20} max={100} unit="%" onChange={setProjectedArea} /><RangeControl label={vi ? 'Độ sâu mặt chiếu' : 'Projected plane depth'} value={projectedDepth} min={0} max={20} step={.1} unit="mm" onChange={setProjectedDepth} /></div>}

          <label className="split3mf-field-label">{vi ? 'Kiểu khớp nối' : 'Connector method'}</label>
          <div className="split3mf-choice-grid two connector" role="radiogroup" aria-label={vi ? 'Kiểu khớp nối' : 'Connector method'}>{([['none', vi ? 'Không có' : 'None'], ['triangular', vi ? 'Lăng trụ tam giác' : 'Triangular prism'], ['cylinder', vi ? 'Hình trụ' : 'Cylinder'], ['rectangular', vi ? 'Lăng trụ chữ nhật' : 'Rectangular prism']] as Array<[ConnectorMethod, string]>).map(([method, label]) => <label key={method} className={connectorMethod === method ? 'active' : ''}><input type="radio" aria-label={method === 'none' ? 'None' : method === 'triangular' ? 'Triangular prism' : method === 'cylinder' ? 'Cylinder' : 'Rectangular prism'} checked={connectorMethod === method} onChange={() => setConnectorMethod(method)} /><span>{label}</span><MethodDiagram kind={method} /></label>)}</div>
          {connectorMethod !== 'none' && <div className="split3mf-connector-settings"><label className="split3mf-field-label">{vi ? 'Phía khớp nối' : 'Connector side'}</label><div className="split3mf-choice-grid two connector-side"><button type="button" className={connectorSide === 'part' ? 'active' : ''} aria-pressed={connectorSide === 'part'} onClick={() => setConnectorSide('part')}><span>{vi ? 'Phần tách dương' : 'Part plug'}</span><MethodDiagram kind="part-plug" /></button><button type="button" className={connectorSide === 'body' ? 'active' : ''} aria-pressed={connectorSide === 'body'} onClick={() => setConnectorSide('body')}><span>{vi ? 'Thân chính dương' : 'Body plug'}</span><MethodDiagram kind="body-plug" /></button></div><label className="split3mf-number-row"><span>{vi ? 'Diện tích khớp' : 'Connector area'}</span><b>[%]</b><input aria-label="Connector area" type="number" min={3} max={40} value={connectorArea} onChange={(event) => setConnectorArea(Number(event.target.value))} /></label><label className="split3mf-number-row"><span>{vi ? 'Dung sai khớp' : 'Connector tolerance'} <button type="button" onClick={(event) => { event.preventDefault(); setToleranceGuideOpen(true); }} aria-label="Show connector tolerance recommendations"><Info size={12} /></button></span><b>[mm]</b><input aria-label="Connector tolerance" type="number" min={0} max={1.5} step={.05} value={connectorTolerance} onChange={(event) => setConnectorTolerance(Number(event.target.value))} /></label></div>}
          <label className="split3mf-switch-row" title={vi ? 'Phần tách giữ nguyên vị trí trong viewer và file tải.' : 'Split parts stay at their original positions in the viewer and downloads.'}><span>{vi ? 'Tách tại vị trí cũ' : 'Split in place'}</span><input type="checkbox" role="switch" checked={splitInPlace} onChange={(event) => setSplitInPlace(event.target.checked)} /><i /></label>
        </section>

        <section className="split3mf-sidebar-section"><div className="split3mf-section-heading"><h2>{vi ? 'Cắt thủ công' : 'Manual cut'}</h2></div><button type="button" className={`split3mf-wide-button${manualOpen ? ' open' : ''}`} disabled={!pieces.length || boundaryOpen} aria-expanded={manualOpen} onClick={() => { const next = !manualOpen; setManualOpen(next); setSelectedIds([]); setSketch([]); setSketchFace(null); setStatus(next ? (vi ? 'Sẵn sàng — chọn công cụ cắt.' : 'Ready - choose a manual cut mode.') : (vi ? 'Sẵn sàng.' : 'Ready - click a color on the model to select it')); }}>{manualOpen ? (vi ? 'Đóng công cụ cắt' : 'Close cut tools') : (vi ? 'Công cụ cắt' : 'Cut tools')}</button>
          {manualOpen && <div className="split3mf-manual"><div className="split3mf-segmented" role="tablist" aria-label="Cut mode"><button type="button" role="tab" aria-selected={manualMode === 'plane'} className={manualMode === 'plane' ? 'active' : ''} onClick={() => { setManualMode('plane'); setSketch([]); setSketchFace(null); }}>{vi ? 'Mặt phẳng' : 'Plane'}</button><button type="button" role="tab" aria-selected={manualMode === 'sketch'} className={manualMode === 'sketch' ? 'active' : ''} onClick={() => { setManualMode('sketch'); setSketch([]); setSketchFace(null); setStatus(vi ? 'Bấm một trong sáu mặt hộp để vẽ.' : 'Click one of the six bounding-box faces to sketch.'); }}>{vi ? 'Vẽ tay' : 'Sketch'}</button></div>{manualMode === 'plane' ? <><div className="split3mf-segmented axes" aria-label="Plane normal">{(['x', 'y', 'z'] as CutterAxis[]).map((item) => <button type="button" key={item} className={axis === item ? 'active' : ''} onClick={() => setAxis(item)}>{item.toUpperCase()}</button>)}</div><RangeControl label={vi ? 'Vị trí' : 'Position'} value={positionPercent} min={-90} max={90} unit="%" onChange={setPositionPercent} /><RangeControl label={vi ? 'Độ nghiêng' : 'Tilt'} value={tilt} min={-45} max={45} unit="°" onChange={setTilt} /></> : <p className="split3mf-sketch-help">{sketchFace ? `${sketchFace[0].toUpperCase()}${sketchFace.slice(1)} ${vi ? '·' : 'face ·'} ${sketch.length} ${vi ? 'điểm · Bấm hoặc kéo để vẽ.' : 'points · Click or drag to draw a cut line or outline.'}` : (vi ? 'Bấm một mặt hộp. Camera sẽ căn vuông góc với mặt đó.' : 'Click a bounding-box face. The camera will align to that face.')} {sketch.length > 0 && <button type="button" onClick={() => setSketch([])}>{vi ? 'Xóa' : 'Clear'}</button>}</p>}</div>}
        </section>

        <section className="split3mf-sidebar-section selected"><h2>{vi ? 'Vùng đã chọn' : 'Selected regions'}</h2>{selectedPieces.length ? <div className="split3mf-selected-list">{selectedPieces.map((piece) => <button type="button" key={piece.id} onClick={() => setSelectedIds((current) => current.filter((id) => id !== piece.id))}><span style={{ background: piece.color }} /><strong>{piece.name}<small>{surfaceArea(piece.mesh).toFixed(3)} mm² · {Math.floor(piece.mesh.indices.length / 3).toLocaleString()} faces</small></strong><em>{vi ? 'xóa' : 'remove'}</em></button>)}</div> : <p>{selectableInActive.length ? (vi ? 'Bấm vào một vùng màu trên mô hình 3D.' : 'Click a color region on the 3D model.') : (vi ? 'Model này không còn vùng màu riêng.' : 'This model has no separate color regions left.')}</p>}</section>
        <section className="split3mf-trust" aria-label="Privacy and legal links"><p>{vi ? 'Split3MF tôn trọng quyền riêng tư. File model và tài sản trí tuệ vẫn thuộc về bạn.' : 'Split3MF values your privacy. Your model files and intellectual property remain yours.'}</p><nav className="split3mf-social"><a href="https://www.reddit.com/r/Split3MF/" target="_blank" rel="noreferrer" aria-label="Reddit"><CircleHelp size={13} /></a><a href="https://github.com/utj947/split3mf-issues/issues" target="_blank" rel="noreferrer" aria-label="GitHub"><Github size={13} /></a><a href="https://www.instagram.com/split3mf/" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={13} /></a><a href="https://ko-fi.com/taejooum" target="_blank" rel="noreferrer" aria-label="Ko-fi"><Coffee size={13} /></a></nav><nav className="split3mf-legal"><button type="button" onClick={() => setServiceGuideOpen(true)}>{vi ? 'Hướng dẫn dịch vụ' : 'Service guide'}</button><span>Privacy</span><span>Terms</span><span>Legal Notice</span></nav></section>
      </div>
    </aside>

    <header className="split3mf-topbar"><h2>{busy ? (vi ? 'Đang xử lý…' : status) : status}</h2><div className="split3mf-visibility" aria-label={vi ? 'Hiển thị mô hình' : 'Model visibility'}><button type="button" className={visibilityGroup === 'all' ? 'active' : ''} aria-pressed={visibilityGroup === 'all'} onClick={() => { setVisibilityGroup('all'); setSelectedIds([]); setStatus(vi ? 'Đang hiển thị tất cả model' : 'Showing all models'); }}>All</button>{groups.length > 1 && groups.map((group) => <button type="button" key={group} className={visibilityGroup === group ? 'active' : ''} aria-pressed={visibilityGroup === group} onClick={() => { setVisibilityGroup(group); setSelectedIds([]); setStatus(vi ? `Đang hiển thị ${modelNames[group] ?? `Model ${group}`}` : `Showing ${modelNames[group] ?? `Model ${group}`}`); }} onDoubleClick={() => renameModel(group)} title={vi ? 'Nhấp đúp để đổi tên' : 'Double-click to rename'}>{modelNames[group] ?? `Model ${group}`}</button>)}</div><div className="split3mf-top-actions"><button type="button" className="split3mf-download" disabled={!pieces.length || busy} onClick={() => void runDownload()}>{vi ? 'Tải xuống' : 'Download'}</button><Link to="/admin" aria-label="Account"><UserRound size={17} /></Link></div></header>

    <section className="split3mf-workspace" onContextMenu={(event) => { if (boundaryOpen) event.preventDefault(); }}>
      <div className="split3mf-history" role="group" aria-label="History controls"><button type="button" onClick={undo} disabled={!past.length} aria-label={vi ? 'Hoàn tác' : 'Undo'}><Undo2 size={17} /></button><button type="button" onClick={redo} disabled={!future.length} aria-label={vi ? 'Làm lại' : 'Redo'}><Redo2 size={17} /></button></div>
      <Canvas dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }} onPointerMissed={() => { if (!boundaryOpen && !manualOpen) setSelectedIds([]); }}><SplitScene pieces={pieces} selectedIds={selectedIds} visibilityGroup={visibilityGroup} bounds={sceneBounds} manualOpen={manualOpen} manualMode={manualMode} axis={axis} positionPercent={positionPercent} tilt={tilt} sketchFace={sketchFace} boundaryOpen={boundaryOpen} interlockingPreview={cutMethod === 'interlocking' && selectedPieces.length > 0 && !manualOpen} viewRevision={viewRevision} onSelect={selectPiece} onProjector={(value) => { projector.current = value; }} onFace={(face) => { setSketchFace(face); setAxis(faceAxis(face)); setSketch([]); setStatus(vi ? `Đang vẽ trên mặt ${face}. Model hiển thị trong suốt 90%.` : `Sketching on the ${face[0].toUpperCase()}${face.slice(1)} face. The model is shown 90% transparent.`); }} onBrush={onBoundaryBrush} onBrushEnd={() => { boundaryStroke.current = false; }} /></Canvas>
      {manualOpen && manualMode === 'sketch' && sketchFace && <svg className="split3mf-sketch-layer" onPointerDown={onSketchPointerDown} onPointerMove={onSketchPointerMove} onPointerUp={stopSketch} onPointerCancel={stopSketch}><polyline points={sketch.map((point) => point.screen.join(',')).join(' ')} />{sketch.map((point, index) => <rect key={`${point.screen.join('-')}-${index}`} x={point.screen[0] - 3} y={point.screen[1] - 3} width="6" height="6" />)}</svg>}
      {!pieces.length && <div className="split3mf-empty"><Upload size={34} /><p>{vi ? 'Kéo file .3MF vào đây' : 'Drag a .3MF file here'}</p><button type="button" onClick={() => fileInput.current?.click()}>{vi ? 'Tải 3MF lên' : 'Upload 3MF'}</button><button type="button" className="demo" onClick={loadDemo}>{vi ? 'Thử Pingu' : 'Try Pingu'}</button></div>}
      {error && <div className="split3mf-error"><X size={15} /><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss"><X size={13} /></button></div>}
      <button type="button" className="split3mf-split-button" disabled={splitDisabled} onClick={splitAction}><span>{busy ? (vi ? 'Đang tính…' : 'Working…') : boundaryOpen ? (vi ? 'Áp dụng biên' : 'Apply boundary') : (vi ? 'Tách' : 'Split')}</span><kbd>␣space</kbd></button>
      {typeof visibilityGroup === 'number' && <button type="button" className="split3mf-remove-model" onClick={removeActiveModel}><Trash2 size={14} />{vi ? 'Xóa model' : 'Remove model'}</button>}
      {supportVisible && <aside className="split3mf-support" aria-label="Support Split3MF"><strong>{vi ? 'Bạn muốn ủng hộ công cụ này?' : 'Want to support this tool?'}</strong><span>{vi ? 'Gửi tip tại' : 'Send a tip on'} <a href="https://ko-fi.com/taejooum" target="_blank" rel="noreferrer">Ko-fi</a></span><button type="button" onClick={() => setSupportVisible(false)} aria-label="Close support banner"><X size={15} /></button></aside>}
    </section>

    {capInfoOpen && selectedCapInfo && <Modal title={CAP_METHODS.find((method) => method.id === capInfoOpen)?.label ?? capInfoOpen} onClose={() => setCapInfoOpen(null)}><div className="split3mf-info-grid"><div className={`split3mf-cap-preview ${capInfoOpen}`}><i /><b /><em /></div><p>{selectedCapInfo.concept}</p><dl><dt>Pros</dt><dd>{selectedCapInfo.pros}</dd><dt>Cons</dt><dd>{selectedCapInfo.cons}</dd><dt>If it fails</dt><dd>{selectedCapInfo.fallback}</dd></dl></div></Modal>}
    {toleranceGuideOpen && <Modal title={vi ? 'Khuyến nghị dung sai connector' : 'Connector tolerance recommendation'} onClose={() => setToleranceGuideOpen(false)}><table className="split3mf-tolerance-table"><thead><tr><th>Nozzle</th><th>Material</th><th>Tight</th><th>Standard</th><th>Loose</th></tr></thead><tbody><tr><td>0.4 mm</td><td>PLA</td><td>0.15</td><td>0.25</td><td>0.35</td></tr><tr><td>0.4 mm</td><td>PETG</td><td>0.20</td><td>0.30</td><td>0.45</td></tr><tr><td>0.4 mm</td><td>ABS/ASA</td><td>0.20</td><td>0.35</td><td>0.50</td></tr><tr><td>0.6 mm</td><td>PLA</td><td>0.25</td><td>0.40</td><td>0.55</td></tr></tbody></table><p className="split3mf-modal-note">{vi ? 'Giá trị thực tế còn phụ thuộc layer height, nhiệt độ, độ ẩm, tình trạng máy và filament. Hãy in mẫu test-fit trước.' : 'Values vary with layer height, temperature, humidity, printer condition and filament. Print a test fit first.'}</p></Modal>}
    {shellWarningOpen && <Modal title={vi ? 'Các phần màu đã được tách sẵn' : 'Color parts are already separated in this model'} onClose={() => setShellWarningOpen(false)}><p className="split3mf-modal-note">{vi ? 'Các phần màu trong file là những shell kín độc lập, vì vậy không có biên màu chung để dựng cap. Bạn vẫn có thể tách chúng đúng như cấu trúc gốc; connector chỉ áp dụng cho cắt thủ công.' : 'The color parts are independent closed shells, so there is no shared painted boundary to cap. You can still separate the original parts; connectors apply to manual cuts.'}</p></Modal>}
    {serviceGuideOpen && <Modal title={vi ? 'Hướng dẫn dịch vụ' : 'Service guide'} onClose={() => setServiceGuideOpen(false)}><div className="split3mf-guide"><p><ShieldCheck size={16} /> {vi ? 'File được xử lý cục bộ trong trình duyệt và không tải lên máy chủ.' : 'Models are processed locally in your browser and are never uploaded.'}</p><ol><li>{vi ? 'Nạp một file 3MF đã sơn màu.' : 'Upload a painted 3MF model.'}</li><li>{vi ? 'Chọn vùng màu, phương pháp cap và connector.' : 'Select color regions, a cap method and optional connectors.'}</li><li>{vi ? 'Nhấn Split hoặc Space, kiểm tra từng model rồi tải 3MF.' : 'Press Split or Space, inspect each model and download the 3MF.'}</li></ol><h3>v3 parity workspace</h3><ul><li>Boundary brush and cap fallback</li><li>Soap film, CDT, Winding, Projected and Centroid caps</li><li>Triangular, cylinder and rectangular connectors</li><li>Plane and six-face sketch cutting</li><li>Rename, remove, undo/redo and split in place</li><li>Multi-material 3MF export</li></ul><button type="button" className="split3mf-language-switch" onClick={toggleLanguage}>{vi ? 'Switch to English' : 'Chuyển sang tiếng Việt'}</button></div></Modal>}
  </main>;
}
