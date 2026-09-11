import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CircleDot, Coffee, Copy, Download, Languages, Layers3, LockKeyhole, Moon, Plus, Redo2, Rotate3d, Ruler, Search, Star, Sun, Trash2, Type, ZoomIn, ZoomOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { FontOption } from '../../clicker/image/letter';
import { FONT_OPTIONS, loadBundledFonts } from '../../clicker/image/letter';
import { downloadThreeMF } from '../../clicker/export';
import type { ClickerPart, Ring } from '../../clicker/types';
import { createViewer, type Viewer } from '../../clicker/viewer/viewer';
import { createMekeyDesign, type MekeyBuildDesign, type MekeyBuildRequest, type MekeyDesign, type MekeyLanguage, type MekeyTab } from './model';
import './mekey-studio.css';
import './mekey-parity.css';

type WorkerReply = { id: number; parts?: ClickerPart[]; error?: string };
type FontCategory = 'all' | 'round' | 'bold' | 'other' | 'starred';
type PrinterKey = 'bambu' | 'ender' | 'mini' | 'large' | 'custom';
const labels = {
  vi: { add: 'Thêm tên', create: 'Tạo file in', edit: 'Chỉnh riêng', exit: 'Thoát', text: 'Chữ', borders: 'Viền', rings: 'Vòng', download: 'Tải file .3MF', bedDownload: 'Tải bàn in .3MF', search: 'Tìm kiếm...', ruler: 'Hiện thước đo (mm)', back: 'Quay lại' },
  en: { add: 'Add Name', create: 'Create Print File', edit: 'Edit Individual', exit: 'Exit', text: 'Text', borders: 'Borders', rings: 'Ring', download: 'Download File .3MF', bedDownload: 'Download Bed .3MF', search: 'Search...', ruler: 'Hiện Thước Đo (mm)', back: 'Back' },
};
const printers: Record<PrinterKey, { label: string; width: number; depth: number }> = {
  bambu: { label: 'Bambu Lab X1 / P1 / A1 (256×256 mm)', width: 256, depth: 256 },
  ender: { label: 'Creality Ender-3 / Neptune (220×220 mm)', width: 220, depth: 220 },
  mini: { label: 'Bambu A1 Mini / Prusa Mini (180×180 mm)', width: 180, depth: 180 },
  large: { label: 'Large Format 300×300 mm', width: 300, depth: 300 },
  custom: { label: 'Custom size', width: 256, depth: 256 },
};
const roundFonts = new Set(['Comfortaa', 'Pacifico', 'Lobster', 'Righteous', 'Dancing Script', 'Kalam', 'Amatic SC']);
const boldFonts = new Set(['Anton', 'Bebas Neue', 'Bangers', 'Bungee', 'Sigmar One', 'Luckiest Guy', 'Russo One']);

function textRings(design: MekeyDesign, fonts: FontOption[]): Ring[] {
  const font = fonts.find((item) => item.id === design.fontId) ?? fonts[0];
  if (!font || !design.text.trim()) return [];
  const rings: Ring[] = [];
  for (const shape of font.font.generateShapes(design.text.slice(0, 32), 100)) {
    const points = shape.extractPoints(18);
    if (points.shape.length >= 3) rings.push(points.shape.map((point) => [point.x, point.y]));
    points.holes.forEach((hole) => { if (hole.length >= 3) rings.push(hole.map((point) => [point.x, point.y])); });
  }
  if (!rings.length) return [];
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  rings.flat().forEach(([x, y]) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); });
  // The reference treats Text Size as font height, not overall word width.
  // Preserve each font's natural advance/aspect ratio across long names.
  // The bundled font paths contain only the visible glyph bounds. Convert that
  // cap-height back to the reference's CSS-like em size (about 55% cap height).
  const size = Math.max((maxY - minY) / 0.55, 1);
  const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
  // The reference font metrics include a small amount of line-box leading;
  // retaining that vertical breathing room keeps the cap-height and descender
  // proportions identical to the source studio.
  return rings.map((ring) => ring.map(([x, y]) => [(x - cx) / size, ((y - cy) / size) * 1.03]));
}

function Range({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (value: number) => void }) {
  return <label className="mekey-range"><span>{label}<b>{value.toFixed(step < 1 ? 1 : 0)}{unit}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function FontPicker({ fonts, value, favorites, onFavorite, onChange }: { fonts: FontOption[]; value: string; favorites: Set<string>; onFavorite: (id: string) => void; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FontCategory>('all');
  const selected = fonts.find((font) => font.id === value) ?? fonts[0];
  const filtered = fonts.filter((font) => category === 'all' || (category === 'round' && roundFonts.has(font.name)) || (category === 'bold' && boldFonts.has(font.name)) || (category === 'other' && !roundFonts.has(font.name) && !boldFonts.has(font.name)) || (category === 'starred' && favorites.has(font.id)));
  return <div className="mekey-font-picker"><span className="mekey-field-label">Font Family</span><button type="button" className="mekey-font-selected" onClick={() => setOpen((current) => !current)}><span><small>SELECTED FONT</small><strong style={{ fontFamily: selected?.id.replace('bundled-', '') }}>{selected?.name ?? 'Standard'} (Abc ABC)</strong></span><Star size={16} className={selected && favorites.has(selected.id) ? 'filled' : ''} /><b>⌄</b></button>{open && <div className="mekey-font-popover"><div className="mekey-font-categories">{([['all', 'All'], ['round', 'Round Bold'], ['bold', 'Bold'], ['other', 'Others'], ['starred', 'Starred ⭐']] as const).map(([id, name]) => <button type="button" className={category === id ? 'active' : ''} key={id} onClick={() => setCategory(id)}>{name}</button>)}</div><div className="mekey-font-grid">{filtered.map((font) => <button type="button" className={font.id === value ? 'active' : ''} key={font.id} onClick={() => { onChange(font.id); setOpen(false); }}><span style={{ fontFamily: font.id.replace('bundled-', '') }}><b>{font.name}</b><small>Abc ABC</small></span><i role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onFavorite(font.id); }}><Star size={14} className={favorites.has(font.id) ? 'filled' : ''} /></i></button>)}</div></div>}<div className="mekey-font-style"><select disabled><option>Regular</option></select><button type="button" style={{ fontFamily: selected?.id.replace('bundled-', '') }}>Abc</button></div></div>;
}

export function MekeyStudioPage() {
  const [language, setLanguage] = useState<MekeyLanguage>('en');
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState<MekeyTab>('text');
  const [designs, setDesigns] = useState<MekeyDesign[]>(() => [createMekeyDesign()]);
  const [selectedId, setSelectedId] = useState(() => designs[0].id);
  const [individual, setIndividual] = useState(false);
  const [search, setSearch] = useState('');
  const [showRuler, setShowRuler] = useState(false);
  const [fonts, setFonts] = useState<FontOption[]>(() => [...FONT_OPTIONS]);
  const [status, setStatus] = useState('Preparing geometry…');
  const [about, setAbout] = useState(false);
  const [addNames, setAddNames] = useState(false);
  const [namesDraft, setNamesDraft] = useState('');
  const [printMode, setPrintMode] = useState(false);
  const [orbit, setOrbit] = useState(false);
  const [printer, setPrinter] = useState<PrinterKey>('bambu');
  const [customBed, setCustomBed] = useState({ width: 256, depth: 256 });
  const [partSpacing, setPartSpacing] = useState(12);
  const [bedMargin, setBedMargin] = useState(10);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(['bundled-pacifico']));
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const hasPreviewRef = useRef(false);
  const renderedPrintModeRef = useRef(false);
  const printModeRef = useRef(printMode);
  const orbitRef = useRef(orbit);
  const printBedRef = useRef({ width: 256, depth: 256 });
  const pendingRef = useRef(new Map<number, (parts: ClickerPart[]) => void>());
  const selected = designs.find((design) => design.id === selectedId) ?? designs[0];
  const t = labels[language];
  const bed = printer === 'custom' ? customBed : printers[printer];

  useEffect(() => { void loadBundledFonts((font) => setFonts((current) => current.some((item) => item.id === font.id) ? current : [...current, font])); setFonts([...FONT_OPTIONS]); }, []);
  useEffect(() => {
    if (!viewportRef.current) return;
    const viewer = createViewer(viewportRef.current);
    viewer.setGridPalette(0xc85a2b, 0xd3cec7);
    viewer.setReferenceRendering(true);
    viewerRef.current = viewer;
    const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      if (reply.error) { setStatus(reply.error); return; }
      if (!reply.parts) return;
      const pending = pendingRef.current.get(reply.id);
      if (pending) { pendingRef.current.delete(reply.id); pending(reply.parts); return; }
      if (reply.id !== requestRef.current) return;
      const modeChanged = renderedPrintModeRef.current !== printModeRef.current;
      viewer.setParts(reply.parts, hasPreviewRef.current && !modeChanged);
      if (!hasPreviewRef.current || modeChanged) {
        viewer.setOrbitMode(orbitRef.current);
        if (printModeRef.current) { viewer.frameSize(printBedRef.current.width, printBedRef.current.depth); viewer.zoom(1.37); }
        else viewer.resetCamera();
      }
      hasPreviewRef.current = true;
      renderedPrintModeRef.current = printModeRef.current;
      setStatus(`${reply.parts.reduce((sum, part) => sum + part.triVerts.length / 3, 0).toLocaleString()} triangles · ready`);
    };
    worker.onerror = () => setStatus('Geometry worker could not build this design.');
    return () => { worker.terminate(); viewer.dispose(); viewerRef.current = null; };
  }, []);

  const buildPayload = useCallback((items: MekeyDesign[]): MekeyBuildDesign[] => items.map((design) => ({ ...design, rings2d: textRings(design, fonts) })), [fonts]);
  const buildRequest = useCallback((id: number, items: MekeyDesign[], arrange: boolean): MekeyBuildRequest => ({ id, designs: buildPayload(items), arrange, bedWidthMm: bed.width, bedDepthMm: bed.depth, spacingMm: partSpacing, marginMm: bedMargin }), [bed.depth, bed.width, bedMargin, buildPayload, partSpacing]);
  useEffect(() => {
    if (!selected || !workerRef.current || fonts.length === 0) return;
    const id = ++requestRef.current;
    setStatus(printMode ? 'Arranging print bed…' : 'Building printable layers…');
    workerRef.current.postMessage(buildRequest(id, printMode ? designs : [selected], printMode));
  }, [selected, designs, fonts, printMode, buildRequest]);
  useEffect(() => { viewerRef.current?.setTheme(dark ? 'dark' : 'light'); viewerRef.current?.setGridPalette(0xc85a2b, dark ? 0x444146 : 0xd3cec7); }, [dark]);
  useEffect(() => {
    orbitRef.current = orbit;
    viewerRef.current?.setOrbitMode(orbit);
    if (printMode) { viewerRef.current?.frameSize(bed.width, bed.depth); viewerRef.current?.zoom(1.37); }
    else viewerRef.current?.resetCamera();
  }, [bed.depth, bed.width, orbit, printMode]);
  useEffect(() => {
    printModeRef.current = printMode;
    printBedRef.current = { width: bed.width, depth: bed.depth };
    viewerRef.current?.setGridVisible(!printMode);
    viewerRef.current?.setPrintBed(bed.width, bed.depth, printMode);
  }, [bed.depth, bed.width, printMode]);

  const update = <K extends keyof MekeyDesign>(key: K, value: MekeyDesign[K]) => setDesigns((current) => current.map((design) => key === 'text' ? (design.id === selectedId ? { ...design, [key]: value } : design) : individual ? (design.id === selectedId ? { ...design, [key]: value } : design) : { ...design, [key]: value }));
  const updateBorder = (index: number, patch: Partial<MekeyDesign['borders'][number]>) => setDesigns((current) => current.map((design) => {
    if (individual && design.id !== selectedId) return design;
    let borders = design.borders.map((layer, layerIndex) => layerIndex === index ? { ...layer, ...patch } : layer);
    if ('enabled' in patch) { const active = borders.map((layer, layerIndex) => layer.enabled ? layerIndex : -1).filter((layerIndex) => layerIndex >= 0); borders = borders.map((layer, layerIndex) => layer.enabled ? { ...layer, heightMm: layerIndex === active.at(-1) ? 4 : 1.5 } : layer); }
    return { ...design, borders };
  }));
  const updateRing = (index: 0 | 1, patch: Partial<MekeyDesign['rings'][number]>) => setDesigns((current) => current.map((design) => individual && design.id !== selectedId ? design : ({ ...design, rings: design.rings.map((ring, ringIndex) => ringIndex === index ? { ...ring, ...patch } : ring) as MekeyDesign['rings'] })));
  const toggleFavorite = (id: string) => setFavorites((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const download = (all: boolean) => { const worker = workerRef.current; if (!worker) return; const id = ++requestRef.current; setStatus(all ? 'Packing print bed…' : 'Packing 3MF…'); pendingRef.current.set(id, (parts) => { downloadThreeMF(parts, all ? 'mekey3d-print-bed.3mf' : `${selected.text || 'mekey3d'}.3mf`); setStatus(`${parts.length} printable parts exported`); }); worker.postMessage(buildRequest(id, all ? designs : [selected], all)); };
  const createNames = () => { const names = namesDraft.split(/\r?\n/).map((name) => name.trim()).filter(Boolean); if (!names.length) return; const additions = names.map((name) => ({ ...selected, id: crypto.randomUUID(), text: name, borders: selected.borders.map((layer) => ({ ...layer })), rings: selected.rings.map((ring) => ({ ...ring })) as MekeyDesign['rings'] })); setDesigns((current) => [...current, ...additions]); setSelectedId(additions[0].id); setNamesDraft(''); setAddNames(false); };
  const reset = () => { const fresh = createMekeyDesign(); setDesigns([fresh]); setSelectedId(fresh.id); setIndividual(false); setPrintMode(false); setOrbit(false); setTab('text'); };
  const filtered = useMemo(() => designs.filter((design) => design.text.toLowerCase().includes(search.toLowerCase())), [designs, search]);

  if (!selected) return null;
  return <div className={`mekey-shell ${dark ? 'dark' : ''}`}>
    <header className="mekey-header"><div className="mekey-brand"><Link to="/admin">Mekey3D</Link><span>Studio</span></div><div className="mekey-header-actions"><button onClick={() => setAbout(true)}><Coffee size={15} /> Author</button><button onClick={() => setLanguage((value) => value === 'en' ? 'vi' : 'en')}><Languages size={15} /> {language === 'en' ? 'EN' : 'VN'}</button><button aria-label={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'} onClick={() => setDark((value) => !value)}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button><button aria-label="Reset to initial settings" onClick={reset}><Redo2 size={16} /></button></div></header>
    <main className={`mekey-main ${printMode ? 'print-mode' : ''}`}>
      {!printMode && <aside className="mekey-library"><div className="mekey-library-tools"><label><Search size={15} /><input value={search} placeholder={t.search} onChange={(event) => setSearch(event.target.value)} /></label><button className="primary" onClick={() => setAddNames(true)}><Plus size={16} /> {t.add}</button></div><div className="mekey-design-list">{filtered.map((design) => <button key={design.id} aria-label={`Design: ${design.text}`} className={`mekey-design-card ${design.id === selectedId ? 'active' : ''}`} onClick={() => setSelectedId(design.id)}><span style={{ fontFamily: design.fontId.replace('bundled-', ''), WebkitTextStrokeColor: design.borders.filter((layer) => layer.enabled).at(-1)?.color }}>{design.text}</span><small>{design.textSizeMm}px · {design.borders.filter((item) => item.enabled).length} border layer</small><div className="mekey-card-actions"><i title="Duplicate" onClick={(event) => { event.stopPropagation(); const copy = { ...design, id: crypto.randomUUID(), text: `${design.text} copy`, borders: design.borders.map((item) => ({ ...item })), rings: design.rings.map((item) => ({ ...item })) as MekeyDesign['rings'] }; setDesigns((current) => [...current, copy]); }}><Copy size={13} /></i>{designs.length > 1 && <i title="Delete" onClick={(event) => { event.stopPropagation(); setDesigns((current) => current.filter((item) => item.id !== design.id)); if (selectedId === design.id) setSelectedId(designs.find((item) => item.id !== design.id)!.id); }}><Trash2 size={13} /></i>}</div></button>)}</div><footer><span>Total: {designs.length} design models</span><button className="print" onClick={() => { setPrintMode(true); setOrbit(false); }}>{t.create}</button></footer></aside>}
      <section className="mekey-stage"><div ref={viewportRef} className="mekey-viewport" />{printMode && <div className="mekey-bed-outline" style={{ aspectRatio: `${bed.width}/${bed.depth}` }} />}{showRuler && !printMode && <div className="mekey-measure"><span>{selected.textSizeMm.toFixed(0)} mm</span><i /><span>{(selected.textSizeMm * .46).toFixed(1)} mm</span></div>}<div className="mekey-stage-top">{printMode ? <button onClick={() => { setPrintMode(false); setOrbit(false); }}><ArrowLeft size={15} /> {t.back}</button> : <><button onClick={() => setIndividual((value) => !value)}><LockKeyhole size={14} /> {individual ? t.exit : t.edit}</button><button className={showRuler ? 'active' : ''} onClick={() => setShowRuler((value) => !value)}><Ruler size={15} /> {t.ruler}</button></>}</div><div className="mekey-camera"><button onClick={() => setOrbit((value) => !value)}><Rotate3d size={15} /> {orbit ? 'Top View' : '3D Orbit'}</button><button aria-label="Zoom In" onClick={() => viewerRef.current?.zoom(.8)}><ZoomIn size={16} /></button><button aria-label="Zoom Out" onClick={() => viewerRef.current?.zoom(1.25)}><ZoomOut size={16} /></button><button aria-label="Reset View" onClick={() => viewerRef.current?.resetCamera()}><Redo2 size={16} /></button></div><div className="mekey-status">{status}</div><button className="mekey-download" onClick={() => download(printMode)}><Download size={16} /> {printMode ? t.bedDownload : t.download}</button></section>
      {printMode ? <PrintControls printer={printer} setPrinter={setPrinter} customBed={customBed} setCustomBed={setCustomBed} bed={bed} partSpacing={partSpacing} setPartSpacing={setPartSpacing} bedMargin={bedMargin} setBedMargin={setBedMargin} /> : <EditorControls tab={tab} setTab={setTab} t={t} selected={selected} fonts={fonts} favorites={favorites} toggleFavorite={toggleFavorite} update={update} updateBorder={updateBorder} updateRing={updateRing} />}
    </main>
    {addNames && <div className="mekey-modal" role="dialog" aria-modal="true"><div className="mekey-add-modal"><button className="close" onClick={() => setAddNames(false)}>×</button><h3>Add New Names (1 or more)</h3><p>Enter a list of names to create. Enter one name or multiple names, one per line:</p><textarea autoFocus placeholder={'Nguyễn Văn A\nTrần Thị B\nLê Văn C'} value={namesDraft} onChange={(event) => setNamesDraft(event.target.value)} /><footer><button onClick={() => setAddNames(false)}>Cancel</button><button className="primary" disabled={!namesDraft.trim()} onClick={createNames}>Create / Add Names</button></footer></div></div>}
    {about && <div className="mekey-modal" role="dialog" aria-modal="true"><div className="mekey-author-modal"><button className="close" onClick={() => setAbout(false)}>×</button><h2>Author Info & Project Collaboration</h2><div className="mekey-avatar">M3D</div><h3>Mekey3D inspiration 🇻🇳</h3><p>This admin workspace recreates the rapid batch nametag and keychain workflow of Mekey3D inside FormaForgeDT.</p><p>The geometry worker and multi-material export are implemented locally for FormaForgeDT. Visit the original project for its author information and support links.</p><a href="https://mekey3d.vercel.app/" target="_blank" rel="noreferrer">Open original Mekey3D</a></div></div>}
  </div>;
}

function PrintControls({ printer, setPrinter, customBed, setCustomBed, bed, partSpacing, setPartSpacing, bedMargin, setBedMargin }: { printer: PrinterKey; setPrinter: (value: PrinterKey) => void; customBed: { width: number; depth: number }; setCustomBed: React.Dispatch<React.SetStateAction<{ width: number; depth: number }>>; bed: { width: number; depth: number }; partSpacing: number; setPartSpacing: (value: number) => void; bedMargin: number; setBedMargin: (value: number) => void }) {
  return <aside className="mekey-controls mekey-print-controls"><label>PRINTER MODEL<select value={printer} onChange={(event) => setPrinter(event.target.value as PrinterKey)}>{Object.entries(printers).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>{printer === 'custom' && <div className="mekey-custom-bed"><label>Width<input type="number" min={80} max={500} value={customBed.width} onChange={(event) => setCustomBed((current) => ({ ...current, width: Number(event.target.value) }))} /></label><label>Depth<input type="number" min={80} max={500} value={customBed.depth} onChange={(event) => setCustomBed((current) => ({ ...current, depth: Number(event.target.value) }))} /></label></div>}<p>Print bed size: <b>{bed.width} × {bed.depth} mm</b></p><hr /><Range label="Part Spacing" value={partSpacing} min={10} max={20} unit=" mm" onChange={setPartSpacing} /><div className="mekey-scale-labels"><span>10 mm (Tight)</span><span>14 mm (Standard)</span><span>20 mm (Loose)</span></div><Range label="Bed Margin" value={bedMargin} min={10} max={30} unit=" mm" onChange={setBedMargin} /><div className="mekey-scale-labels"><span>10 mm</span><span>20 mm</span><span>30 mm</span></div></aside>;
}

function EditorControls({ tab, setTab, t, selected, fonts, favorites, toggleFavorite, update, updateBorder, updateRing }: { tab: MekeyTab; setTab: (tab: MekeyTab) => void; t: typeof labels.en; selected: MekeyDesign; fonts: FontOption[]; favorites: Set<string>; toggleFavorite: (id: string) => void; update: <K extends keyof MekeyDesign>(key: K, value: MekeyDesign[K]) => void; updateBorder: (index: number, patch: Partial<MekeyDesign['borders'][number]>) => void; updateRing: (index: 0 | 1, patch: Partial<MekeyDesign['rings'][number]>) => void }) {
  return <aside className="mekey-controls"><div className="mekey-tabs"><button className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}><Type size={14} /> {t.text}</button><button className={tab === 'borders' ? 'active' : ''} onClick={() => setTab('borders')}><Layers3 size={14} /> {t.borders}</button><button className={tab === 'rings' ? 'active' : ''} onClick={() => setTab('rings')}><CircleDot size={14} /> {t.rings}</button></div>
    {tab === 'text' && <div className="mekey-panel"><label>Text on Keychain<input placeholder="Enter text..." value={selected.text} maxLength={32} onChange={(event) => update('text', event.target.value)} /></label><FontPicker fonts={fonts} value={selected.fontId} favorites={favorites} onFavorite={toggleFavorite} onChange={(fontId) => update('fontId', fontId)} /><div className="mekey-grid-two"><Range label="Text Size" value={selected.textSizeMm} min={24} max={80} unit="px" onChange={(value) => update('textSizeMm', value)} /><Range label="Text Spacing" value={selected.textSpacing} min={-5} max={5} unit="px" onChange={(value) => update('textSpacing', value)} /></div><Range label="3D Height (Extrusion)" value={selected.textHeightMm} min={1} max={10} step={.5} unit=" mm" onChange={(value) => update('textHeightMm', value)} /><label className="mekey-color">Text Color<input type="color" value={selected.textColor} onChange={(event) => update('textColor', event.target.value)} /><code>{selected.textColor.toUpperCase()}</code></label></div>}
    {tab === 'borders' && <div className="mekey-panel"><p className="mekey-tip">💡 Enable 1 to 3 border layers around the text. The outermost layer serves as the solid base for the keychain.</p>{selected.borders.map((layer, index) => <section className={`mekey-layer ${layer.enabled ? 'enabled' : 'disabled'}`} key={index}><label className="mekey-check"><input aria-label={`Border layer ${index + 1}`} type="checkbox" checked={layer.enabled} onChange={(event) => updateBorder(index, { enabled: event.target.checked })} /><span>Border layer {index + 1}</span></label>{layer.enabled && <div className="mekey-layer-details"><div className="mekey-grid-two"><Range label="Border Width" value={layer.widthMm} min={.8} max={12.8} step={.4} unit=" mm" onChange={(value) => updateBorder(index, { widthMm: value })} /><Range label="3D Height" value={layer.heightMm} min={1} max={10} step={.5} unit=" mm" onChange={(value) => updateBorder(index, { heightMm: value })} /></div><label className="mekey-color">Color of Border layer {index + 1}<input type="color" value={layer.color} onChange={(event) => updateBorder(index, { color: event.target.value })} /><code>{layer.color.toUpperCase()}</code></label></div>}</section>)}</div>}
    {tab === 'rings' && <div className="mekey-panel">{selected.rings.map((ring, index) => <section className="mekey-layer mekey-ring-card" key={index}><label className="mekey-check"><CircleDot size={15} /><span>Ring {index + 1} ({index ? 'Word End' : 'Word Start'})</span><input aria-label={`Ring ${index + 1} (${index ? 'Word End' : 'Word Start'})`} type="checkbox" checked={ring.enabled} onChange={(event) => updateRing(index as 0 | 1, { enabled: event.target.checked })} /></label>{ring.enabled && <div className="mekey-ring-details"><div className="mekey-grid-two"><Range label="Diameter" value={ring.holeDiameterMm} min={2} max={10} step={.4} unit=" mm" onChange={(value) => updateRing(index as 0 | 1, { holeDiameterMm: value })} /><Range label="Thickness" value={ring.thicknessMm} min={1} max={6} step={.5} unit=" mm" onChange={(value) => updateRing(index as 0 | 1, { thicknessMm: value })} /></div><div className="mekey-ring-offset"><div className="mekey-grid-two"><Range label="Offset X" value={ring.offsetX} min={-40} max={40} unit="px" onChange={(value) => updateRing(index as 0 | 1, { offsetX: value })} /><Range label="Offset Y" value={ring.offsetY} min={-40} max={40} unit="px" onChange={(value) => updateRing(index as 0 | 1, { offsetY: value })} /></div></div></div>}</section>)}</div>}
  </aside>;
}
