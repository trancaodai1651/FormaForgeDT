import { Box, Check, Circle, CircleDot, Download, Flower2, Hexagon, Info, Layers3, Lightbulb, Plus, Settings2, SlidersHorizontal, Sparkles, Waves } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { BODY_PROFILE_PRESETS } from './LampBodyCreatorPage';
import type { BodyProfile, BodyProfilePoint, BodyShape, BodyTab, LampBodyConfig, LampBodyCopy, LampBodyUpdate } from './LampBodyCreatorPage';

function rangeValue(value: number, step: number, unit: string) {
  const decimals = step < 1 ? 1 : 0;
  return `${value.toFixed(decimals)} ${unit}`;
}

function RangeControl({ label, value, min, max, step = 1, unit, disabled = false, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; disabled?: boolean; onChange: (value: number) => void }) {
  return <label className={`lamp-body-range${disabled ? ' disabled' : ''}`}><span><span>{label}</span><strong>{rangeValue(value, step, unit)}</strong></span><input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function SelectControl({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <label className="lamp-body-select"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>;
}

function ToggleControl({ label, hint, value, onChange, onLabel, offLabel }: { label: string; hint: string; value: boolean; onChange: () => void; onLabel: string; offLabel: string }) {
  return <div className="lamp-body-toggle-row"><div><strong>{label}</strong><small>{hint}</small></div><button type="button" className={value ? 'lamp-body-toggle on' : 'lamp-body-toggle'} aria-pressed={value} onClick={onChange}><span />{value ? onLabel : offLabel}</button></div>;
}

function PanelTitle({ icon: Icon, title, hint }: { icon: typeof Box; title: string; hint?: string }) {
  return <div className="lamp-body-panel-title"><span className="lamp-body-panel-icon"><Icon size={16} /></span><div><h3>{title}</h3>{hint && <p>{hint}</p>}</div></div>;
}

function BodyShapeButton({ shape, active, label, onClick }: { shape: BodyShape; active: boolean; label: string; onClick: () => void }) {
  const Icon = shape === 'circle' ? Circle : shape === 'polygon' ? Hexagon : shape === 'wave' ? Waves : Flower2;
  return <button type="button" className={`lamp-body-shape-button${active ? ' active' : ''}`} onClick={onClick}><Icon size={21} /><span>{label}</span></button>;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cloneProfilePoints(points: BodyProfilePoint[]) {
  return points.map((point) => ({
    ...point,
    handleIn: point.handleIn ? { ...point.handleIn } : undefined,
    handleOut: point.handleOut ? { ...point.handleOut } : undefined,
  }));
}

function profilePath(points: BodyProfilePoint[]) {
  const sorted = [...points].sort((a, b) => a.y - b.y);
  if (sorted.length === 0) return '';
  let path = `M ${sorted[0].x * 100} ${(1 - sorted[0].y) * 100}`;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    const endPoint = { x: end.x * 100, y: (1 - end.y) * 100 };
    if (start.type === 'corner' && end.type === 'corner') {
      path += ` L ${endPoint.x} ${endPoint.y}`;
      continue;
    }
    const out = start.handleOut ?? { x: start.x, y: start.y + (end.y - start.y) * .33 };
    const inside = end.handleIn ?? { x: end.x, y: end.y - (end.y - start.y) * .33 };
    path += ` C ${out.x * 100} ${(1 - out.y) * 100}, ${inside.x * 100} ${(1 - inside.y) * 100}, ${endPoint.x} ${endPoint.y}`;
  }
  return path;
}

function cubicValue(a: number, b: number, c: number, d: number, t: number) {
  const inverse = 1 - t;
  return inverse ** 3 * a + 3 * inverse ** 2 * t * b + 3 * inverse * t ** 2 * c + t ** 3 * d;
}

function solveCubicParameter(a: number, b: number, c: number, d: number, target: number) {
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 14; iteration += 1) {
    const middle = (low + high) / 2;
    if (cubicValue(a, b, c, d, middle) < target) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

function profileXAt(points: BodyProfilePoint[], y: number) {
  const sorted = [...points].sort((a, b) => a.y - b.y);
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0].x;
  if (y <= sorted[0].y) return sorted[0].x;
  if (y >= sorted[sorted.length - 1].y) return sorted[sorted.length - 1].x;
  let segmentIndex = sorted.length - 2;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    if (y <= sorted[index + 1].y) {
      segmentIndex = index;
      break;
    }
  }
  const start = sorted[segmentIndex];
  const end = sorted[segmentIndex + 1];
  const span = Math.max(.0001, end.y - start.y);
  const linearT = clamp((y - start.y) / span, 0, 1);
  if (start.type === 'corner' && end.type === 'corner') return start.x + (end.x - start.x) * linearT;
  const out = start.handleOut ?? { x: start.x, y: start.y + span * .33 };
  const inside = end.handleIn ?? { x: end.x, y: end.y - span * .33 };
  const t = solveCubicParameter(start.y, out.y, inside.y, end.y, y);
  return cubicValue(start.x, out.x, inside.x, end.x, t);
}

function createSmoothPoint(points: BodyProfilePoint[], x: number, y: number, ignoredIndex = -1): BodyProfilePoint {
  const neighbors = points.filter((_, index) => index !== ignoredIndex).sort((a, b) => a.y - b.y);
  const previous = [...neighbors].reverse().find((point) => point.y < y) ?? neighbors[0] ?? { x, y };
  const next = neighbors.find((point) => point.y > y) ?? neighbors[neighbors.length - 1] ?? { x, y };
  const span = Math.max(.08, next.y - previous.y);
  const slope = next.y - previous.y > .0001 ? (next.x - previous.x) / (next.y - previous.y) : 0;
  const handleLength = Math.min(.16, Math.max(.06, span * .28));
  return {
    x,
    y,
    type: 'smooth',
    handleIn: { x: clamp(x - slope * handleLength, 0, 1.08), y: clamp(y - handleLength, 0, 1) },
    handleOut: { x: clamp(x + slope * handleLength, 0, 1.08), y: clamp(y + handleLength, 0, 1) },
  };
}

function profileSamples(points: BodyProfilePoint[], sampleCount = 20) {
  if (points.length < 2) return points.map((point) => ({ x: point.x, y: point.y }));
  return Array.from({ length: sampleCount }, (_, sampleIndex) => {
    const y = sampleIndex / (sampleCount - 1);
    return { x: clamp(profileXAt(points, y), 0, 1.08), y };
  });
}

function BodyProfileEditor({ points, maxRadius, onChange, copy }: { points: BodyProfilePoint[]; maxRadius: number; onChange: (points: BodyProfilePoint[]) => void; copy: LampBodyCopy }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ index: number; handle: 'point' | 'in' | 'out' } | null>(null);

  useEffect(() => {
    if (dragging === null) return undefined;
    const handleMove = (event: PointerEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = clamp((event.clientX - rect.left) / rect.width, 0, 1.08);
      const y = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
      onChange(points.map((point, index) => {
        if (index !== dragging.index) return point;
        if (dragging.handle === 'point') {
          const deltaX = x - point.x;
          const deltaY = y - point.y;
          return {
            ...point,
            x,
            y,
            handleIn: point.handleIn ? { x: clamp(point.handleIn.x + deltaX, 0, 1.08), y: clamp(point.handleIn.y + deltaY, 0, 1) } : undefined,
            handleOut: point.handleOut ? { x: clamp(point.handleOut.x + deltaX, 0, 1.08), y: clamp(point.handleOut.y + deltaY, 0, 1) } : undefined,
          };
        }
        return { ...point, [dragging.handle === 'in' ? 'handleIn' : 'handleOut']: { x, y } };
      }));
    };
    const stopDragging = () => setDragging(null);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stopDragging);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stopDragging);
    };
  }, [dragging, onChange, points]);

  const togglePointType = (index: number) => {
    onChange(points.map((point, pointIndex) => {
      if (pointIndex !== index) return point;
      if (point.type === 'smooth') return { x: point.x, y: point.y, type: 'corner' };
      return createSmoothPoint(points, point.x, point.y, index);
    }));
  };

  const addPointAt = (x: number, y: number) => {
    if (points.length >= 24) return;
    const safeX = clamp(x, 0, 1.08);
    const safeY = clamp(y, 0, 1);
    onChange([...points, createSmoothPoint(points, safeX, safeY)]);
  };

  const addPointBetween = () => {
    if (points.length >= 24) return;
    const sortedPoints = [...points].sort((a, b) => a.y - b.y);
    if (sortedPoints.length < 2) {
      addPointAt(.72, .5);
      return;
    }
    let largestGap = -1;
    let gapIndex = 0;
    for (let index = 0; index < sortedPoints.length - 1; index += 1) {
      const gap = sortedPoints[index + 1].y - sortedPoints[index].y;
      if (gap > largestGap) {
        largestGap = gap;
        gapIndex = index;
      }
    }
    const start = sortedPoints[gapIndex];
    const end = sortedPoints[gapIndex + 1];
    const y = (start.y + end.y) / 2;
    addPointAt(profileXAt(points, y), y);
  };

  const addPoint = (event: MouseEvent<SVGSVGElement>) => {
    const target = event.target as Element;
    if (target.closest('circle')) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1.08);
    const y = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
    addPointAt(x, y);
  };

  const sorted = points.map((point, index) => ({ point, index })).sort((a, b) => a.point.y - b.point.y);
  return <div className="lamp-body-vertical-profile">
    <div className="lamp-body-profile-editor-toolbar"><strong>{copy.vertical}</strong><button type="button" className="lamp-body-add-point" onClick={addPointBetween} disabled={points.length >= 24}><Plus size={13} />{copy.addPoint}</button></div>
    <div className="lamp-body-profile-axis-labels"><span>{copy.vertical} ↑</span><span>{copy.maxRadius} →</span></div>
    <svg ref={svgRef} viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${copy.vertical}, ${maxRadius}${copy.mm}`} onDoubleClick={addPoint}>
      <defs><pattern id="lamp-body-profile-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="currentColor" strokeOpacity=".12" /></pattern></defs>
      <rect width="100" height="100" fill="url(#lamp-body-profile-grid)" />
      <line x1="0" y1="100" x2="100" y2="100" stroke="currentColor" strokeOpacity=".35" />
      <path d={profilePath(points)} fill="none" stroke="#66dcff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {profileSamples(points).map((sample, sampleIndex) => {
        const x = sample.x * 100;
        const y = (1 - sample.y) * 100;
        return <rect key={`sample-${sampleIndex}`} className="lamp-body-profile-sample" x={x - 1.6} y={y - 1.6} width="3.2" height="3.2" rx=".35" transform={`rotate(45 ${x} ${y})`} fill="#fbbf24" pointerEvents="none" />;
      })}
      {sorted.map(({ point, index: pointIndex }) => {
        const x = point.x * 100;
        const y = (1 - point.y) * 100;
        const inHandle = point.handleIn;
        const outHandle = point.handleOut;
        return <g key={`${point.x}-${point.y}-${pointIndex}`}>
          {point.type === 'smooth' && inHandle && <line x1={x} y1={y} x2={inHandle.x * 100} y2={(1 - inHandle.y) * 100} stroke="#64748b" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
          {point.type === 'smooth' && outHandle && <line x1={x} y1={y} x2={outHandle.x * 100} y2={(1 - outHandle.y) * 100} stroke="#64748b" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
          {point.type === 'smooth' && inHandle && <circle cx={inHandle.x * 100} cy={(1 - inHandle.y) * 100} r="1.4" fill="#94a3b8" onPointerDown={(event) => { event.stopPropagation(); setDragging({ index: pointIndex, handle: 'in' }); }} />}
          {point.type === 'smooth' && outHandle && <circle cx={outHandle.x * 100} cy={(1 - outHandle.y) * 100} r="1.4" fill="#94a3b8" onPointerDown={(event) => { event.stopPropagation(); setDragging({ index: pointIndex, handle: 'out' }); }} />}
          <circle cx={x} cy={y} r={point.type === 'smooth' ? 3 : 3.5} fill={point.type === 'smooth' ? '#66dcff' : '#fbbf24'} stroke="#0d1528" strokeWidth="1.3" vectorEffect="non-scaling-stroke" aria-label={`${copy.vertical} ${pointIndex + 1}`} onPointerDown={(event) => { event.stopPropagation(); setDragging({ index: pointIndex, handle: 'point' }); }} onDoubleClick={(event) => { event.stopPropagation(); togglePointType(pointIndex); }} />
        </g>;
      })}
    </svg>
    <div className="lamp-body-profile-scale"><span>0{copy.mm}</span><span>{copy.maxRadius} {maxRadius}{copy.mm}</span></div>
  </div>;
}

function AdvancedProfilePanel({ config, update, copy }: { config: LampBodyConfig; update: LampBodyUpdate; copy: LampBodyCopy }) {
  const selectProfile = (profile: BodyProfile) => {
    update('profile', profile);
    const preset = BODY_PROFILE_PRESETS.find((candidate) => candidate.name === profile);
    if (preset) update('advancedProfilePoints', cloneProfilePoints(preset.points));
  };

  return <section className="lamp-body-advanced-profile-section">
    <PanelTitle icon={Sparkles} title={copy.advanced} hint={copy.advancedHint} />
    <SelectControl label={copy.bodyShape} value={config.profile} options={(Object.keys(copy.profiles) as BodyProfile[]).map((value) => ({ value, label: copy.profiles[value] }))} onChange={(value) => selectProfile(value as BodyProfile)} />
    <label className="lamp-body-advanced-toggle"><span><strong>{copy.advanced}</strong><small>{copy.advancedHint}</small></span><input type="checkbox" aria-label={copy.advanced} checked={config.profileMode === 'advanced'} onChange={(event) => update('profileMode', event.target.checked ? 'advanced' : 'preset')} /><i /></label>
    {config.profileMode === 'advanced' && <div className="lamp-body-vertical-profile">
      <strong>{copy.vertical}</strong>
      <div className="lamp-body-profile-presets">{BODY_PROFILE_PRESETS.map((preset) => <button type="button" key={preset.name} className={config.profile === preset.name ? 'active' : ''} onClick={() => selectProfile(preset.name)}>{copy.profileLabels[preset.name]}</button>)}</div>
      <RangeControl label={copy.maxRadius} value={config.advancedMaxRadius} min={30} max={150} unit={copy.mm} onChange={(value) => update('advancedMaxRadius', value)} />
      <BodyProfileEditor points={config.advancedProfilePoints} maxRadius={config.advancedMaxRadius} onChange={(points) => update('advancedProfilePoints', points)} copy={copy} />
      <p className="lamp-body-profile-help">{copy.dragHint}</p>
    </div>}
  </section>;
}

function ShapePanel({ config, update, copy }: { config: LampBodyConfig; update: LampBodyUpdate; copy: LampBodyCopy }) {
  const selectShape = (shape: BodyShape) => {
    update('shapeType', shape);
    if (shape === 'polygon' && config.shapeWaves > 12) update('shapeWaves', 12);
  };

  return <div className="lamp-body-panel-content"><section><PanelTitle icon={Waves} title={copy.shapeSettings} /><div className="lamp-body-shape-grid">
    <BodyShapeButton shape="circle" label={copy.shapes.circle} active={config.shapeType === 'circle'} onClick={() => selectShape('circle')} />
    <BodyShapeButton shape="polygon" label={copy.shapes.polygon} active={config.shapeType === 'polygon'} onClick={() => selectShape('polygon')} />
    <BodyShapeButton shape="wave" label={copy.shapes.wave} active={config.shapeType === 'wave'} onClick={() => selectShape('wave')} />
    <BodyShapeButton shape="star" label={copy.shapes.star} active={config.shapeType === 'star'} onClick={() => selectShape('star')} />
  </div>{config.shapeType !== 'circle' && <div className="lamp-body-profile-fields"><RangeControl label={copy.count} value={config.shapeWaves} min={3} max={config.shapeType === 'polygon' ? 12 : 64} unit="" onChange={(value) => update('shapeWaves', value)} />{config.shapeType !== 'polygon' && <RangeControl label={copy.depth} value={config.shapeAmplitude} min={0} max={20} step={.5} unit={` ${copy.mm}`} onChange={(value) => update('shapeAmplitude', value)} />}</div>}<RangeControl label={copy.twist} value={config.shapeTwist} min={0} max={720} step={5} unit="°" onChange={(value) => update('shapeTwist', value)} /></section></div>;
}

export function LampBodyControls({ config, tab, update, copy, onExport, exportState = 'idle' }: { config: LampBodyConfig; tab: BodyTab; update: LampBodyUpdate; copy: LampBodyCopy; onExport?: () => void; exportState?: 'idle' | 'done' | 'error' }) {
  const selectProfile = (profile: BodyProfile) => {
    update('profile', profile);
    const preset = BODY_PROFILE_PRESETS.find((candidate) => candidate.name === profile);
    if (preset) update('advancedProfilePoints', cloneProfilePoints(preset.points));
  };

  return <>
    {tab === 'body' && <div className="lamp-body-panel-content"><section><PanelTitle icon={Box} title={copy.bodyShape} hint={copy.bodyShapeHint} /><SelectControl label={copy.bodyShape} value={config.profile} options={(Object.keys(copy.profiles) as BodyProfile[]).map((value) => ({ value, label: copy.profiles[value] }))} onChange={(value) => selectProfile(value as BodyProfile)} /></section><section><PanelTitle icon={SlidersHorizontal} title={copy.dimensions} /><RangeControl label={copy.height} value={config.height} min={80} max={360} unit={copy.mm} onChange={(value) => update('height', value)} /><RangeControl label={copy.bodyRadius} value={config.bodyRadius} min={22} max={90} unit={copy.mm} onChange={(value) => update('bodyRadius', value)} /><RangeControl label={copy.topRadius} value={config.topRadius} min={16} max={72} unit={copy.mm} onChange={(value) => update('topRadius', value)} /></section></div>}
    {tab === 'profile' && <div className="lamp-body-panel-content"><AdvancedProfilePanel config={config} update={update} copy={copy} /></div>}
    {tab === 'shape' && <ShapePanel config={config} update={update} copy={copy} />}
    {tab === 'base' && <div className="lamp-body-panel-content"><section><PanelTitle icon={Layers3} title={copy.base} /><RangeControl label={copy.baseRadius} value={config.baseRadius} min={45} max={120} unit={copy.mm} onChange={(value) => update('baseRadius', value)} /><RangeControl label={copy.baseHeight} value={config.baseHeight} min={8} max={42} unit={copy.mm} onChange={(value) => update('baseHeight', value)} /><RangeControl label={copy.neckRadius} value={config.neckRadius} min={14} max={42} unit={copy.mm} onChange={(value) => update('neckRadius', value)} /><RangeControl label={copy.neckHeight} value={config.neckHeight} min={8} max={38} unit={copy.mm} onChange={(value) => update('neckHeight', value)} /><RangeControl label={copy.shadeSeatRadius} value={config.shadeSeatRadius} min={15} max={90} unit={copy.mm} onChange={(value) => update('shadeSeatRadius', value)} /><RangeControl label={copy.shadeSeatHeight} value={config.shadeSeatHeight} min={2} max={38} unit={copy.mm} onChange={(value) => update('shadeSeatHeight', value)} /></section><section><PanelTitle icon={Info} title={copy.socket} hint={copy.socketHint} /><RangeControl label={copy.socketDiameter} value={config.socketDiameter} min={24} max={52} unit={copy.mm} onChange={(value) => update('socketDiameter', value)} /></section><section><PanelTitle icon={CircleDot} title={copy.bottomHole} hint={copy.bottomHoleHint} /><ToggleControl label={copy.holeEnabled} hint={copy.bottomHoleHint} value={config.bottomHoleEnabled} onChange={() => update('bottomHoleEnabled', !config.bottomHoleEnabled)} onLabel={copy.holeOn} offLabel={copy.holeOff} /><RangeControl label={copy.bottomHoleDiameter} value={config.bottomHoleDiameter} min={8} max={52} unit={copy.mm} disabled={!config.bottomHoleEnabled} onChange={(value) => update('bottomHoleDiameter', value)} /></section></div>}
    {tab === 'finish' && <div className="lamp-body-panel-content"><section><PanelTitle icon={Settings2} title={copy.construction} hint={copy.resolutionHint} /><RangeControl label={copy.wall} value={config.wallThickness} min={1.2} max={6} step={.1} unit={copy.mm} onChange={(value) => update('wallThickness', value)} /><RangeControl label={copy.segments} value={config.segments} min={24} max={128} step={8} unit="" onChange={(value) => update('segments', value)} /></section><section><PanelTitle icon={Sparkles} title={copy.appearance} /><SelectControl label={copy.style} value={config.renderStyle} options={[{ value: 'smooth', label: copy.smooth }, { value: 'low-poly', label: copy.lowPoly }]} onChange={(value) => update('renderStyle', value as LampBodyConfig['renderStyle'])} /><div className="lamp-body-color-field"><span>{copy.color}</span><div className="lamp-body-swatches">{['#d9d6cf', '#e7e7e7', '#1b1b1b', '#d23b3b', '#2f6fdd', '#2e9e5b', '#f2b705'].map((color) => <button type="button" key={color} className={config.color === color ? 'selected' : ''} style={{ background: color }} aria-label={color} onClick={() => update('color', color)} />)}</div></div></section><section><PanelTitle icon={Lightbulb} title={copy.simulation} /><ToggleControl label={copy.simulation} hint={copy.simulationHint} value={config.showSimulation} onChange={() => update('showSimulation', !config.showSimulation)} onLabel={copy.on} offLabel={copy.off} /></section></div>}
    {tab === 'export' && <div className="lamp-body-panel-content"><section className="lamp-body-export-card"><span className="lamp-body-export-icon"><Check size={20} /></span><h2>{copy.exportTitle}</h2><p>{copy.exportText}</p><button type="button" className="lamp-body-export-button" onClick={() => onExport?.()}><Download size={16} /> {copy.download}</button>{exportState !== 'idle' && <div className={`lamp-body-export-status ${exportState}`}>{exportState === 'done' ? <Check size={14} /> : <Info size={14} />}{exportState === 'done' ? copy.exported : copy.exportFailed}</div>}</section><section className="lamp-body-summary"><PanelTitle icon={Info} title={copy.summary} /><div><span>{copy.profile}</span><strong>{copy.profiles[config.profile]}</strong></div><div><span>{copy.totalHeight}</span><strong>{Math.round(config.baseHeight + config.height + config.neckHeight)} {copy.mm}</strong></div><div><span>{copy.diameter}</span><strong>{Math.round(config.baseRadius * 2)} {copy.mm}</strong></div><div><span>{copy.bottomHoleDiameter}</span><strong>{config.bottomHoleEnabled ? `${Math.round(config.bottomHoleDiameter)} ${copy.mm}` : copy.holeOff}</strong></div><div><span>{copy.volume}</span><strong>{Math.round(config.baseRadius * 2)} × {Math.round(config.baseHeight + config.height + config.neckHeight)} {copy.mm}</strong></div></section></div>}
  </>;
}
