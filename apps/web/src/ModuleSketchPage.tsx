import { Grid, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import {
  ArrowLeft, Check, CircleDot, Grid3X3, MousePointer2, Pencil, Redo2,
  RotateCcw, Scan, Spline, Trash2, Undo2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as THREE from 'three';
import { useI18n } from './lib/i18n';
import { buildModuleGeometry, normalizeSketch } from './moduleStudio/geometry';
import {
  SKETCH_PRESETS, createLampModule, loadModuleStudioProject, sanitizeSketch,
  saveModuleStudioProject, type LampModule, type SketchPoint,
} from './moduleStudio/model';
import './moduleStudio/sketch.css';

type SketchTool = 'select' | 'spline' | 'pencil' | 'erase';

const AXIS_X = 188;
const GROUND_Y = 620;
const PROFILE_WIDTH = 360;
const PROFILE_HEIGHT = 520;

function pointToCanvas(point: SketchPoint) {
  return { x: AXIS_X + point.radius * PROFILE_WIDTH, y: GROUND_Y - point.height * PROFILE_HEIGHT };
}

function smoothPath(points: SketchPoint[]) {
  const canvasPoints = normalizeSketch(points).map(pointToCanvas);
  if (!canvasPoints.length) return '';
  if (canvasPoints.length === 1) return `M ${canvasPoints[0].x} ${canvasPoints[0].y}`;
  let path = `M ${canvasPoints[0].x} ${canvasPoints[0].y}`;
  for (let index = 1; index < canvasPoints.length - 1; index += 1) {
    const current = canvasPoints[index];
    const next = canvasPoints[index + 1];
    path += ` Q ${current.x} ${current.y} ${(current.x + next.x) / 2} ${(current.y + next.y) / 2}`;
  }
  const penultimate = canvasPoints.at(-2)!;
  const last = canvasPoints.at(-1)!;
  return `${path} Q ${penultimate.x} ${penultimate.y} ${last.x} ${last.y}`;
}

function closedPreviewPath(points: SketchPoint[]) {
  const profile = normalizeSketch(points);
  const right = profile.map(pointToCanvas);
  const left = [...profile].reverse().map((point) => ({ x: AXIS_X - point.radius * PROFILE_WIDTH, y: pointToCanvas(point).y }));
  return [...right, ...left].map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ') + ' Z';
}

function SketchPreview3D({ module, points }: { module: LampModule; points: SketchPoint[] }) {
  const parts = useMemo(() => buildModuleGeometry(module, points, 'BAMBU_LED_KIT_001'), [module, points]);
  useEffect(() => () => parts.forEach((part) => part.geometry.dispose()), [parts]);
  return <>
    <color attach="background" args={['#111418']} />
    <PerspectiveCamera makeDefault fov={38} position={[250, 150, 250]} />
    <ambientLight intensity={1.15} />
    <directionalLight position={[180, 260, 190]} intensity={2.2} />
    <directionalLight position={[-120, 100, -160]} intensity={.8} />
    <group position={[0, module.height / 2, 0]}>{parts.filter((part) => part.role === 'body').map((part, index) => <mesh key={index} geometry={part.geometry} position={part.position} rotation={part.rotation} castShadow receiveShadow><meshPhysicalMaterial color={module.color} roughness={.42} clearcoat={.25} side={THREE.DoubleSide} /></mesh>)}</group>
    <Grid position={[0, 0, 0]} args={[520, 520]} cellSize={10} sectionSize={50} cellColor="#2b3037" sectionColor="#4d5661" fadeDistance={600} infiniteGrid />
    <OrbitControls makeDefault target={[0, module.height / 2, 0]} enableDamping minDistance={140} maxDistance={680} />
  </>;
}

export function ModuleSketchPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialProject = useMemo(loadModuleStudioProject, []);
  const initialModule = useMemo(() => initialProject.modules.find((module) => module.id === searchParams.get('module') && module.kind === 'sketch') ?? initialProject.modules.find((module) => module.kind === 'sketch') ?? createLampModule('sketch', initialProject.hardware), [initialProject, searchParams]);
  const [module, setModule] = useState(initialModule);
  const [points, setPoints] = useState(() => sanitizeSketch(initialProject.sketch));
  const [history, setHistory] = useState<SketchPoint[][]>(() => [sanitizeSketch(initialProject.sketch)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [tool, setTool] = useState<SketchTool>('select');
  const [snap, setSnap] = useState(true);
  const [draggedPoint, setDraggedPoint] = useState<number | null>(null);
  const pencilDraft = useRef<SketchPoint[] | null>(null);

  const pushHistory = (nextPoints: SketchPoint[]) => {
    const next = sanitizeSketch(nextPoints);
    const nextHistory = [...history.slice(0, historyIndex + 1), next];
    setPoints(next); setHistory(nextHistory); setHistoryIndex(nextHistory.length - 1);
  };
  const undo = () => { if (historyIndex <= 0) return; const next = historyIndex - 1; setHistoryIndex(next); setPoints(history[next]); };
  const redo = () => { if (historyIndex >= history.length - 1) return; const next = historyIndex + 1; setHistoryIndex(next); setPoints(history[next]); };
  const eventPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 900;
    const y = (event.clientY - rect.top) / rect.height * 700;
    let radius = (x - AXIS_X) / PROFILE_WIDTH;
    let height = (GROUND_Y - y) / PROFILE_HEIGHT;
    if (snap) { radius = Math.round(radius * 20) / 20; height = Math.round(height * 20) / 20; }
    return { radius: Math.max(.3, Math.min(1, radius)), height: Math.max(0, Math.min(1, height)) };
  };
  const nearestPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = eventPoint(event);
    let nearest = -1; let distance = Infinity;
    points.forEach((candidate, index) => {
      const nextDistance = Math.hypot((candidate.radius - point.radius) * PROFILE_WIDTH, (candidate.height - point.height) * PROFILE_HEIGHT);
      if (nextDistance < distance) { distance = nextDistance; nearest = index; }
    });
    return distance < 32 ? nearest : -1;
  };
  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === 'select') { const index = nearestPoint(event); if (index >= 0) setDraggedPoint(index); return; }
    if (tool === 'erase') { const index = nearestPoint(event); if (index >= 0 && points.length > 2) pushHistory(points.filter((_, pointIndex) => pointIndex !== index)); return; }
    const point = eventPoint(event);
    if (tool === 'spline') { pushHistory([...points, point]); return; }
    pencilDraft.current = [point]; setPoints([point]);
  };
  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = eventPoint(event);
    if (draggedPoint !== null) { setPoints((current) => current.map((candidate, index) => index === draggedPoint ? point : candidate)); return; }
    if (!pencilDraft.current) return;
    const previous = pencilDraft.current.at(-1);
    if (previous && Math.hypot(previous.radius - point.radius, previous.height - point.height) < .035) return;
    pencilDraft.current = [...pencilDraft.current, point]; setPoints(pencilDraft.current);
  };
  const pointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (draggedPoint !== null) { setDraggedPoint(null); pushHistory(points); }
    if (pencilDraft.current) { const draft = pencilDraft.current; pencilDraft.current = null; pushHistory(draft); }
  };
  const applySketch = () => {
    const profile = sanitizeSketch(points);
    const moduleExists = initialProject.modules.some((item) => item.id === module.id);
    saveModuleStudioProject({
      ...initialProject,
      sketch: profile,
      modules: moduleExists ? initialProject.modules.map((item) => item.id === module.id ? module : item) : [...initialProject.modules, module],
      updatedAt: new Date().toISOString(),
    });
    navigate('/module-studio');
  };

  const profilePath = smoothPath(points);
  return <main className="module-sketch-workspace">
    <header className="sketch-topbar">
      <button type="button" className="sketch-icon-button" onClick={() => navigate('/module-studio')} aria-label={t('moduleSketch.back')}><ArrowLeft size={18} /></button>
      <div className="sketch-title"><span>FORMAFORGE / SKETCH</span><strong>{t('moduleSketch.title')}</strong></div>
      <div className="sketch-history"><button type="button" disabled={historyIndex === 0} onClick={undo}><Undo2 size={17} />{t('moduleSketch.undo')}</button><button type="button" disabled={historyIndex === history.length - 1} onClick={redo}><Redo2 size={17} />{t('moduleSketch.redo')}</button></div>
      <div className="sketch-actions"><button type="button" onClick={() => { const preset = SKETCH_PRESETS.soft.map((point) => ({ ...point })); pushHistory(preset); }}><RotateCcw size={16} />{t('moduleSketch.reset')}</button><button type="button" className="primary" onClick={applySketch}><Check size={17} />{t('moduleSketch.apply')}</button></div>
    </header>

    <div className="sketch-layout">
      <aside className="sketch-toolbar" aria-label={t('moduleSketch.tools')}>
        {([
          ['select', MousePointer2, 'moduleSketch.select'], ['spline', Spline, 'moduleSketch.spline'],
          ['pencil', Pencil, 'moduleSketch.pencil'], ['erase', Trash2, 'moduleSketch.erase'],
        ] as const).map(([id, Icon, label]) => <button type="button" key={id} className={tool === id ? 'active' : ''} onClick={() => setTool(id)}><Icon size={19} /><span>{t(label)}</span></button>)}
        <i />
        <button type="button" className={snap ? 'active' : ''} onClick={() => setSnap((value) => !value)}><Grid3X3 size={19} /><span>{t('moduleSketch.snap')}</span></button>
      </aside>

      <section className="sketch-canvas-panel">
        <div className="sketch-canvas-status"><span><CircleDot size={14} />{points.length} {t('moduleSketch.points')}</span><span>{module.diameter.toFixed(0)} × {module.height.toFixed(0)} mm</span></div>
        <svg className={`sketch-canvas tool-${tool}`} viewBox="0 0 900 700" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
          <defs>
            <pattern id="cad-small-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="currentColor" strokeOpacity=".075" /></pattern>
            <pattern id="cad-grid" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#cad-small-grid)" /><path d="M100 0H0V100" fill="none" stroke="currentColor" strokeOpacity=".16" /></pattern>
            <linearGradient id="profile-fill" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f0b967" stopOpacity=".18" /><stop offset="1" stopColor="#f0b967" stopOpacity=".035" /></linearGradient>
          </defs>
          <rect width="900" height="700" fill="url(#cad-grid)" />
          <line x1={AXIS_X} y1="55" x2={AXIS_X} y2="650" className="sketch-axis" />
          <line x1="60" y1={GROUND_Y} x2="840" y2={GROUND_Y} className="sketch-axis ground" />
          <path d={closedPreviewPath(points)} fill="url(#profile-fill)" stroke="none" />
          <path d={profilePath} className="sketch-profile-line shadow" />
          <path d={profilePath} className="sketch-profile-line" />
          {normalizeSketch(points).map((point, index) => { const canvasPoint = pointToCanvas(point); return <g key={`${point.height}-${index}`}><circle cx={canvasPoint.x} cy={canvasPoint.y} r="11" className="sketch-control-hit" /><circle cx={canvasPoint.x} cy={canvasPoint.y} r="5" className="sketch-control-point" /></g>; })}
          <g className="sketch-dimension"><line x1={AXIS_X - 28} y1="100" x2={AXIS_X - 28} y2={GROUND_Y} /><line x1={AXIS_X - 36} y1="100" x2={AXIS_X - 20} y2="100" /><line x1={AXIS_X - 36} y1={GROUND_Y} x2={AXIS_X - 20} y2={GROUND_Y} /><text x={AXIS_X - 44} y="370" transform={`rotate(-90 ${AXIS_X - 44} 370)`}>{module.height.toFixed(0)} mm</text></g>
          <text x={AXIS_X + 12} y="82" className="sketch-axis-label">Y</text><text x="850" y={GROUND_Y - 12} className="sketch-axis-label">X</text>
        </svg>
        <div className="sketch-help"><Scan size={15} /><span>{t(`moduleSketch.help.${tool}`)}</span></div>
      </section>

      <aside className="sketch-inspector">
        <section className="sketch-preview-card"><div><span>REVOLVE 360°</span><strong>{t('moduleSketch.preview')}</strong></div><div className="sketch-preview-3d"><Canvas dpr={[1, 1.5]}><SketchPreview3D module={module} points={points} /></Canvas></div></section>
        <section><div className="sketch-inspector-title"><span>PROFILE</span><strong>{t('moduleSketch.parameters')}</strong></div><label><span>{t('moduleStudio.diameter')}<b>{module.diameter.toFixed(0)} mm</b></span><input type="range" min="80" max="320" step="1" value={module.diameter} onChange={(event) => setModule((current) => ({ ...current, diameter: Number(event.target.value) }))} /></label><label><span>{t('moduleStudio.height')}<b>{module.height.toFixed(0)} mm</b></span><input type="range" min="80" max="420" step="1" value={module.height} onChange={(event) => setModule((current) => ({ ...current, height: Number(event.target.value) }))} /></label><label><span>{t('moduleStudio.wall')}<b>{module.wallThickness.toFixed(1)} mm</b></span><input type="range" min="1.2" max="4" step=".1" value={module.wallThickness} onChange={(event) => setModule((current) => ({ ...current, wallThickness: Number(event.target.value) }))} /></label></section>
        <section><div className="sketch-inspector-title"><span>QUICK SHAPES</span><strong>{t('moduleSketch.presets')}</strong></div><div className="sketch-preset-grid">{(['soft', 'tower', 'wave', 'bell'] as const).map((preset) => <button type="button" key={preset} onClick={() => pushHistory(SKETCH_PRESETS[preset])}>{t(`moduleStudio.preset.${preset}`)}</button>)}</div></section>
      </aside>
    </div>
  </main>;
}
