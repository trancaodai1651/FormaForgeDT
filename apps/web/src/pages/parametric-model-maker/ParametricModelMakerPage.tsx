import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Box,
  Check,
  Code2,
  Download,
  FileUp,
  FolderOpen,
  History,
  Loader2,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Star,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { downloadFile } from "../../lib/downloadFile";
import { CodeEditor } from "./CodeEditor";
import { ModelViewer } from "./ModelViewer";
import { FontLibrary } from "./FontLibrary";
import {
  DEFAULT_WAVY,
  MAKER_FONTS,
  PLA_COLORS,
  PRINTERS,
  WAVY_PARAMETERS,
  configFromValues,
  selectedParts,
  type AssetFile,
  type MakerProject,
  type Parameter,
  type ParameterValue,
  type PartMesh,
} from "./model";
import { registerMakerFont, makerFontName } from "./wavyGeometry";
import { renderWavy } from "./wavyRuntime";
import { parseCustomizer, applyParameters } from "./scadCustomizer";
import { renderScad, SCAD_LIBRARIES } from "./scadRuntime";
import {
  meshBounds,
  modelThreeMf,
  partsZip,
  partStl,
  unionForStl,
} from "./export";
import {
  decodeAssets,
  encodeAssets,
  listProjects,
  saveProject,
  type StoredProject,
} from "./storage";
import { createProject, TEMPLATES } from "./templates";
import "./maker.css";

const assetHashes = new WeakMap<Uint8Array, string>();
function assetHash(bytes: Uint8Array) {
  let hash = assetHashes.get(bytes);
  if (hash) return hash;
  let value = 2166136261;
  for (const b of bytes) value = Math.imul(value ^ b, 16777619);
  hash = (value >>> 0).toString(16);
  assetHashes.set(bytes, hash);
  return hash;
}
const fingerprint = (p: MakerProject, files: AssetFile[]) =>
  JSON.stringify([
    p.kind,
    p.config,
    p.source,
    p.values,
    files.map((f) => [f.name, f.data.length, assetHash(f.data)]),
  ]);
const filename = (s: string) =>
  s
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .trim()
    .slice(0, 100) || "model";
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog className="pmm-modal" ref={dialog} onCancel={onClose}>
      <header>
        <h2>{title}</h2>
        <button aria-label="Đóng hộp thoại" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function ColorField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (s: string) => void;
  label: string;
}) {
  return (
    <div className="pmm-colors">
      <div className="pmm-palette">
        {PLA_COLORS.map(([name, color]) => (
          <button
            key={color}
            title={name}
            aria-label={`${label}: ${name}`}
            aria-pressed={value.toUpperCase() === color}
            style={{ background: color }}
            onClick={() => onChange(color)}
          >
            {value.toUpperCase() === color && (
              <Check size={14} color={color === "#FFFFFF" ? "#111" : "white"} />
            )}
          </button>
        ))}
      </div>
      <label className="pmm-custom-color">
        <input
          type="color"
          aria-label={`${label} tùy chỉnh`}
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
        />
        <span>{value.toUpperCase()}</span>
        <small>Màu tùy chỉnh</small>
      </label>
    </div>
  );
}
function Field({
  p,
  value,
  onChange,
  files,
  fonts,
  onFile,
  onFont,
}: {
  p: Parameter;
  value: ParameterValue;
  onChange: (v: ParameterValue) => void;
  files: AssetFile[];
  fonts: { value: string; label: string }[];
  onFile: () => void;
  onFont: () => void;
}) {
  const id = `pmm-${p.key}`;
  return (
    <div className={`pmm-field pmm-field-${p.type}`}>
      <label htmlFor={id}>
        {p.label}
        {p.type === "boolean" && (
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
        )}
      </label>
      {p.type === "color" ? (
        <ColorField label={p.label} value={String(value)} onChange={onChange} />
      ) : p.type === "select" || p.type === "font" ? (
        <select
          id={id}
          value={String(value)}
          onChange={(e) =>
            onChange(
              p.options?.find((o) => String(o.value) === e.target.value)
                ?.value ?? e.target.value,
            )
          }
        >
          {p.type === "font" &&
            ![
              ...(p.options ??
                MAKER_FONTS.map(([, label]) => ({ value: label }))),
              ...fonts,
            ].some((o) => String(o.value) === String(value)) && (
              <option value={String(value)}>{String(value)}</option>
            )}
          {[
            ...(p.options ??
              (p.type === "font"
                ? MAKER_FONTS.map(([, label]) => ({ value: label, label }))
                : [])),
            ...(p.type === "font" ? fonts : []),
          ].map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      ) : p.type === "file" ? (
        <select
          id={id}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value={String(p.initial)}>
            {String(p.initial) || "Chọn file"}
          </option>
          {files
            .filter(
              (f) => /\.(svg|png|stl)$/i.test(f.name) && f.name !== p.initial,
            )
            .map((f) => (
              <option key={f.name}>{f.name}</option>
            ))}
        </select>
      ) : p.type === "vector" ? (
        <div className="pmm-vector">
          {(Array.isArray(value) ? value : [0, 0, 0]).map((v, i) => (
            <label key={i}>
              {["X", "Y", "Z"][i] ?? i + 1}
              <input
                aria-label={`${p.label} ${i + 1}`}
                type="number"
                step={p.step ?? "any"}
                min={p.min}
                max={p.max}
                value={v}
                onChange={(e) => {
                  const copy = [...(value as number[])];
                  copy[i] = Number(e.target.value);
                  onChange(copy);
                }}
              />
            </label>
          ))}
        </div>
      ) : p.type === "number" ? (
        <div className="pmm-number">
          <input
            id={id}
            type="number"
            min={p.min}
            max={p.max}
            step={p.step ?? "any"}
            value={Number(value)}
            onChange={(e) => {
              if (e.target.value !== "") onChange(Number(e.target.value));
            }}
          />
          {p.min !== undefined && p.max !== undefined && (
            <input
              aria-label={`${p.label} thanh trượt`}
              type="range"
              min={p.min}
              max={p.max}
              step={p.step ?? "any"}
              value={Number(value)}
              onChange={(e) => onChange(Number(e.target.value))}
            />
          )}
        </div>
      ) : p.type === "boolean" ? null : (
        <input
          id={id}
          type="text"
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {p.type === "file" && (
        <button className="pmm-field-link" onClick={onFile}>
          <FileUp size={15} />
          Nhập file cho vùng này
        </button>
      )}
      {p.type === "font" && (
        <button className="pmm-field-link" onClick={onFont}>
          <Type size={15} />
          Chọn trong thư viện phông
        </button>
      )}
      {p.description && <small>{p.description}</small>}
    </div>
  );
}
export function ParametricModelMakerPage() {
  const [project, setProject] = useState<MakerProject | null>(null),
    [files, setFiles] = useState<AssetFile[]>([]),
    [records, setRecords] = useState<StoredProject[]>([]),
    [history, setHistory] = useState<MakerProject[]>([]);
  const [parts, setParts] = useState<PartMesh[]>([]),
    [generated, setGenerated] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [logs, setLogs] = useState<string[]>([]),
    [saveState, setSaveState] = useState("");
  const [panel, setPanel] = useState<"params" | "code" | "history" | "files">(
      "params",
    ),
    [modal, setModal] = useState<
      "export" | "libraries" | "fonts" | "about" | null
    >(null),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("Tất cả"),
    [sort, setSort] = useState("recent"),
    [savedOnly, setSavedOnly] = useState(false);
  const [grid, setGrid] = useState(true),
    [wire, setWire] = useState(false),
    [printer, setPrinter] = useState("A1"),
    [bed, setBed] = useState(256),
    [exporting, setExporting] = useState(false),
    [libraryQuery, setLibraryQuery] = useState("");
  const [fontTarget, setFontTarget] = useState(""),
    [uploadTarget, setUploadTarget] = useState("");
  const homeScad = useRef<HTMLInputElement>(null);
  const [undoCount, setUndoCount] = useState(0),
    [redoCount, setRedoCount] = useState(0);
  const past = useRef<MakerProject[]>([]),
    future = useRef<MakerProject[]>([]),
    controller = useRef<AbortController | null>(null),
    autoBuildWavyProject = useRef<string>(""),
    upload = useRef<HTMLInputElement>(null),
    folder = useRef<HTMLInputElement>(null),
    projectUpload = useRef<HTMLInputElement>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    listProjects()
      .then(setRecords)
      .catch((e) => setError(`Không đọc được dự án lưu: ${errorText(e)}`));
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    if (!project) return;
    setSaveState("Đang lưu…");
    const timer = setTimeout(() => {
      saveProject({ project, files, history })
        .then(() => {
          if (alive.current) setSaveState("Đã lưu trên thiết bị");
        })
        .catch((e) => setSaveState(`Lưu thất bại: ${errorText(e)}`));
    }, 600);
    return () => clearTimeout(timer);
  }, [project, files, history]);
  const edit = useCallback((change: Partial<MakerProject>) => {
    setProject((previous) => {
      if (!previous) return previous;
      if (
        Object.entries(change).every(([key, value]) =>
          Object.is(previous[key as keyof MakerProject], value),
        )
      )
        return previous;
      past.current = [...past.current.slice(-99), previous];
      future.current = [];
      setUndoCount(past.current.length);
      setRedoCount(0);
      return { ...previous, ...change, updated: Date.now() };
    });
    setMessage("");
  }, []);
  const restore = (direction: "undo" | "redo") => {
    if (!project) return;
    const from = direction === "undo" ? past : future,
      to = direction === "undo" ? future : past;
    const next = from.current.pop();
    if (!next) return;
    to.current.push(project);
    setProject({ ...next, updated: Date.now() });
    setUndoCount(past.current.length);
    setRedoCount(future.current.length);
  };
  const openProject = async (
    next: MakerProject,
    assets: AssetFile[] = [],
    snapshots: MakerProject[] = [],
  ) => {
    controller.current?.abort();
    for (const f of assets)
      if (/\.(ttf|otf)$/i.test(f.name))
        registerMakerFont(`custom:${f.name}`, f.data);
    past.current = [];
    future.current = [];
    setUndoCount(0);
    setRedoCount(0);
    setProject(next);
    setGrid(next.kind !== "wavy");
    setFiles(assets);
    setHistory(snapshots);
    setParts([]);
    setGenerated("");
    setError("");
    setMessage("");
    setLogs([]);
    setPanel("params");
  };
  const goHome = async () => {
    controller.current?.abort();
    if (project)
      await saveProject({ project, files, history }).catch((e) =>
        setError(errorText(e)),
      );
    setProject(null);
    setRecords(await listProjects().catch(() => records));
    setParts([]);
  };
  const parameters = useMemo(
    () =>
      project?.kind === "wavy"
        ? WAVY_PARAMETERS
        : parseCustomizer(project?.source ?? ""),
    [project?.kind, project?.source],
  );
  const values =
    project?.kind === "wavy"
      ? (project.config as unknown as Record<string, ParameterValue>)
      : (project?.values ?? {});
  const customFonts = files
    .filter((f) => /\.(ttf|otf)$/i.test(f.name))
    .map((f) => ({
      label: makerFontName(`custom:${f.name}`) ?? f.name,
      value:
        project?.kind === "wavy"
          ? `custom:${f.name}`
          : (makerFontName(`custom:${f.name}`) ??
            f.name.replace(/\.[^.]+$/, "")),
    }));
  const dirty = !!project && fingerprint(project, files) !== generated;
  const referenceDifferences =
    project?.kind === "wavy"
      ? WAVY_PARAMETERS.filter(
          (p) =>
            project.config[p.key as keyof typeof DEFAULT_WAVY] !==
            DEFAULT_WAVY[p.key as keyof typeof DEFAULT_WAVY],
        )
      : [];
  const updateValue = (p: Parameter, v: ParameterValue) => {
    if (!project) return;
    if (project.kind === "wavy")
      edit({ config: configFromValues({ ...project.config, [p.key]: v }) });
    else edit({ values: { ...project.values, [p.key]: v } });
  };
  const generate = useCallback(async () => {
    if (!project || busy) return;
    const snapshot = structuredClone(project),
      signature = fingerprint(project, files),
      abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setMessage("");
    setLogs([]);
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      let next: PartMesh[];
      if (snapshot.kind === "wavy") {
        const full = await renderWavy(snapshot.config, files, abort.signal);
        next = selectedParts(full, snapshot.config.showPart);
      } else {
        const result = await renderScad(
          applyParameters(snapshot.source, snapshot.values),
          files,
          abort.signal,
        );
        next = result.parts;
        setLogs(result.logs);
      }
      if (abort.signal.aborted) return;
      if (!next.length)
        throw new Error(
          "Phần đã chọn không có hình học. Chọn Nền + chữ hoặc tăng độ dày nền.",
        );
      setParts(next);
      setGenerated(signature);
      setHistory((h) =>
        [
          { ...snapshot, id: crypto.randomUUID(), updated: Date.now() },
          ...h,
        ].slice(0, 30),
      );
      setMessage("Đã dựng mô hình. Có thể xoay, kiểm tra và xuất file.");
    } catch (e) {
      if (!abort.signal.aborted) setError(errorText(e));
    } finally {
      if (controller.current === abort) {
        setBusy(false);
        controller.current = null;
      }
    }
  }, [project, busy, files]);
  useEffect(() => {
    if (project?.kind !== "wavy" || parts.length || busy || generated) return;
    if (autoBuildWavyProject.current === project.id) return;
    autoBuildWavyProject.current = project.id;
    void generate();
  }, [project, parts.length, busy, generated, generate]);
  const importFiles = async (input: FileList | null) => {
    if (!input || !project) return;
    try {
      const incoming = await Promise.all(
        Array.from(input).map(async (f) => {
          if (f.size > 30 * 1024 * 1024)
            throw new Error(`${f.name} vượt 30 MB.`);
          return {
            name: f.webkitRelativePath || f.name,
            data: new Uint8Array(await f.arrayBuffer()),
          };
        }),
      );
      const scad = incoming.find((f) => /\.scad$/i.test(f.name));
      if (scad && incoming.length === 1) {
        edit({
          kind: "scad",
          source: new TextDecoder().decode(scad.data),
          values: {},
          name: scad.name.replace(/\.scad$/i, ""),
        });
        setPanel("code");
      }
      for (const f of incoming)
        if (/\.(ttf|otf)$/i.test(f.name))
          registerMakerFont(`custom:${f.name}`, f.data);
      setFiles((previous) => [
        ...previous.filter((f) => !incoming.some((n) => n.name === f.name)),
        ...incoming,
      ]);
      setGenerated("");
      setMessage(`Đã thêm ${incoming.length} file.`);
      if (uploadTarget && incoming.length === 1) {
        const p = parameters.find((p) => p.key === uploadTarget);
        if (p) updateValue(p, incoming[0].name);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setUploadTarget("");
      if (upload.current) upload.current.value = "";
      if (folder.current) folder.current.value = "";
    }
  };
  const importProject = async (input: FileList | null) => {
    try {
      const f = input?.[0];
      if (!f) return;
      if (f.size > 80 * 1024 * 1024) throw new Error("Dự án vượt 80 MB.");
      const p = JSON.parse(await f.text()) as MakerProject;
      if (
        p.version !== 1 ||
        !["wavy", "scad"].includes(p.kind) ||
        typeof p.source !== "string" ||
        typeof p.name !== "string" ||
        typeof p.values !== "object" ||
        !p.values
      )
        throw new Error("File không phải dự án Model Maker phiên bản 1.");
      const assets = decodeAssets(p.assets);
      await openProject(
        {
          ...p,
          id: crypto.randomUUID(),
          config: configFromValues(
            p.config as unknown as Record<string, ParameterValue>,
          ),
          updated: Date.now(),
        },
        assets,
      );
      setMessage("Đã mở dự án. Nhấn Dựng mô hình để tạo lại hình học.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      if (projectUpload.current) projectUpload.current.value = "";
    }
  };
  const saveDownload = async (
    data: Uint8Array | string,
    name: string,
    type = "application/octet-stream",
  ) => {
    const bytes = typeof data === "string" ? data : new Uint8Array(data).buffer;
    const saved = await downloadFile(new Blob([bytes], { type }), name);
    if (saved) setMessage(`Đã xuất ${name}`);
  };
  const exportModel = async (format: "3mf" | "stl" | "zip") => {
    if (!project || dirty || !parts.length) return;
    setExporting(true);
    setError("");
    try {
      const name = filename(project.name);
      if (format === "3mf")
        await saveDownload(
          modelThreeMf(parts, project, printer, bed),
          `${name}.3mf`,
        );
      if (format === "zip")
        await saveDownload(partsZip(parts), `${name}-parts.zip`);
      if (format === "stl")
        await saveDownload(partStl(await unionForStl(parts)), `${name}.stl`);
      setModal(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setExporting(false);
    }
  };
  const saveJson = async () => {
    if (project)
      try {
        await saveDownload(
          JSON.stringify({ ...project, assets: encodeAssets(files) }, null, 2),
          `${filename(project.name)}.maker.json`,
          "application/json",
        );
      } catch (e) {
        setError(errorText(e));
      }
  };
  const bounds = parts.length ? meshBounds(parts) : null;
  const textIncludes = (s: string) =>
    s.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  const filteredTemplates = TEMPLATES.filter(
    (t) =>
      !savedOnly &&
      (category === "Tất cả" || category === t.category) &&
      textIncludes(`${t.name} ${t.description}`),
  );
  const filteredRecords = records
    .filter(
      (r) => (!savedOnly || r.project.favorite) && textIncludes(r.project.name),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.project.name.localeCompare(b.project.name)
        : b.project.updated - a.project.updated,
    );
  const printerControl = (
    <label className="pmm-printer">
      Máy in
      <select
        aria-label="Máy in"
        value={printer}
        onChange={(e) => {
          setPrinter(e.target.value);
          setBed(PRINTERS.find((p) => p.name === e.target.value)?.size ?? 256);
        }}
      >
        {PRINTERS.map((p) => (
          <option key={p.name}>{p.name}</option>
        ))}
      </select>
      {printer === "Tùy chỉnh" && (
        <input
          aria-label="Cạnh bàn in (mm)"
          type="number"
          min="50"
          max="1000"
          value={bed}
          onChange={(e) =>
            setBed(Math.max(50, Math.min(1000, Number(e.target.value))))
          }
        />
      )}
      <small>
        Bàn xem {bed} × {bed} mm
      </small>
    </label>
  );
  return (
    <main className="pmm-page">
      <header className={`pmm-header${project ? " pmm-editor-header" : ""}`}>
        {project ? (
          <>
            <div className="pmm-editor-identity">
              <button title="Về thư viện" onClick={goHome}>
                <ArrowLeft size={19} />
              </button>
              <Link to="/" aria-label="Về các công cụ">
                <Box size={22} />
              </Link>
              <label>
                <input
                  aria-label="Tên dự án"
                  value={project.name}
                  onChange={(e) => edit({ name: e.target.value })}
                />
                <small>{saveState}</small>
              </label>
              <button
                aria-label="Yêu thích dự án"
                aria-pressed={project.favorite}
                onClick={() => edit({ favorite: !project.favorite })}
              >
                <Star
                  size={18}
                  fill={project.favorite ? "currentColor" : "none"}
                />
              </button>
            </div>
            <nav className="pmm-editor-actions" aria-label="Công cụ dự án">
              <button title="Lưu dự án" onClick={saveJson}>
                <Save size={17} />
                <span>Lưu dự án</span>
              </button>
              <button
                aria-label="Hướng dẫn"
                title="Hướng dẫn"
                onClick={() => setModal("about")}
              >
                <BookOpen size={17} />
              </button>
              <span className="pmm-toolbar-divider" aria-hidden="true" />
              <button
                aria-label="Hoàn tác"
                title="Hoàn tác tham số"
                disabled={!undoCount}
                onClick={() => restore("undo")}
              >
                <Undo2 size={19} />
              </button>
              <button
                aria-label="Làm lại"
                title="Làm lại"
                disabled={!redoCount}
                onClick={() => restore("redo")}
              >
                <Redo2 size={19} />
              </button>
              <button
                title="Đặt lại tham số"
                onClick={() =>
                  edit(
                    project.kind === "wavy"
                      ? { config: { ...DEFAULT_WAVY } }
                      : { values: {} },
                  )
                }
              >
                <RotateCcw size={17} />
                <span>Đặt lại</span>
              </button>
              <button
                className="pmm-export-button"
                title="Xuất file"
                disabled={dirty || !parts.length || busy}
                onClick={() => setModal("export")}
              >
                <Download size={18} />
                <span>Xuất file</span>
              </button>
            </nav>
          </>
        ) : (
          <>
            <div className="pmm-brand">
              <Link to="/" aria-label="Về các công cụ">
                <Box size={27} />
              </Link>
              <div>
                <strong>Model Maker</strong>
                <small>Thiết kế tham số · FormaForgeDT</small>
              </div>
            </div>
            <nav>
              <button onClick={() => projectUpload.current?.click()}>
                <FolderOpen size={18} />
                Mở dự án
              </button>
              <button
                aria-label="Hướng dẫn"
                title="Hướng dẫn"
                onClick={() => setModal("about")}
              >
                <BookOpen size={17} />
                <span>Hướng dẫn</span>
              </button>
            </nav>
          </>
        )}
      </header>
      <input
        hidden
        ref={homeScad}
        type="file"
        accept=".scad"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            if (f.size > 30 * 1024 * 1024)
              throw new Error("File SCAD vượt 30 MB.");
            const data = new Uint8Array(await f.arrayBuffer());
            await openProject(
              {
                ...createProject(TEMPLATES[4]),
                name: f.name.replace(/\.scad$/i, ""),
                source: new TextDecoder().decode(data),
              },
              [{ name: f.name, data }],
            );
            setPanel("code");
          } catch (error) {
            setError(errorText(error));
          } finally {
            if (homeScad.current) homeScad.current.value = "";
          }
        }}
      />
      <input
        hidden
        ref={projectUpload}
        type="file"
        accept=".json"
        onChange={(e) => void importProject(e.target.files)}
      />
      {error && (
        <div className="pmm-alert pmm-error" role="alert">
          <span>{error}</span>
          <button aria-label="Đóng thông báo lỗi" onClick={() => setError("")}>
            <X size={18} />
          </button>
        </div>
      )}
      {message && (
        <div className="pmm-alert pmm-success" role="status">
          <Check size={18} />
          {message}
        </div>
      )}
      {!project ? (
        <section className="pmm-home">
          <div className="pmm-home-title">
            <div>
              <span className="pmm-eyebrow">TỪ Ý TƯỞNG ĐẾN MÔ HÌNH 3D</span>
              <h1>Thiết kế theo cách của bạn.</h1>
              <p>Chỉnh tham số, viết OpenSCAD, xuất mô hình để in.</p>
            </div>
            <div className="pmm-home-create">
              <button onClick={() => homeScad.current?.click()}>
                <FileUp size={19} />
                Mở SCAD
              </button>
              <button
                className="pmm-primary"
                onClick={() => void openProject(createProject(TEMPLATES[4]))}
              >
                <Plus size={20} />
                SCAD mới
              </button>
            </div>
          </div>
          <div className="pmm-home-filters">
            <label className="pmm-search">
              <Search size={20} />
              <input
                aria-label="Tìm mẫu và dự án"
                placeholder="Tìm mẫu hoặc dự án…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="Sắp xếp"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recent">Gần đây nhất</option>
              <option value="name">Tên A–Z</option>
            </select>
          </div>
          <div className="pmm-tabs">
            {["Tất cả", "Chữ và trang trí", "Cơ bản", "Đồ dùng"].map((c) => (
              <button
                key={c}
                aria-pressed={!savedOnly && category === c}
                onClick={() => {
                  setCategory(c);
                  setSavedOnly(false);
                }}
              >
                {c}
              </button>
            ))}
            <button
              aria-pressed={savedOnly}
              onClick={() => setSavedOnly(!savedOnly)}
            >
              <Star size={16} />
              Yêu thích
            </button>
          </div>
          {!!filteredTemplates.length && (
            <>
              <h2>Mẫu khởi đầu</h2>
              <div className="pmm-cards">
                {[...filteredTemplates]
                  .sort((a, b) =>
                    sort === "name" ? a.name.localeCompare(b.name) : 0,
                  )
                  .map((t) => (
                    <button
                      className={`pmm-card pmm-template-${t.id}`}
                      key={t.id}
                      onClick={() => void openProject(createProject(t))}
                    >
                      <div className="pmm-card-art">
                        {t.icon}
                        <span>
                          {t.kind === "wavy" ? "27 tham số" : "OpenSCAD"}
                        </span>
                      </div>
                      <div className="pmm-card-copy">
                        <small>{t.category}</small>
                        <h3>{t.name}</h3>
                        <p>{t.description}</p>
                        <span>
                          Mở trình thiết kế <ArrowRight size={16} />
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            </>
          )}
          <h2>{savedOnly ? "Dự án yêu thích" : "Dự án trên thiết bị"}</h2>
          <div className="pmm-saved-list">
            {filteredRecords.map((r) => (
              <div key={r.project.id}>
                <button
                  className="pmm-saved-open"
                  onClick={() =>
                    void openProject(r.project, r.files, r.history)
                  }
                >
                  <span className="pmm-project-symbol">
                    {r.project.kind === "wavy" ? <Type /> : <Code2 />}
                  </span>
                  <span>
                    <strong>{r.project.name}</strong>
                    <small>
                      {new Date(r.project.updated).toLocaleString("vi-VN")} ·{" "}
                      {r.project.kind === "wavy" ? "Chữ lượn sóng" : "OpenSCAD"}
                    </small>
                  </span>
                </button>
                <button
                  aria-label={`Yêu thích ${r.project.name}`}
                  aria-pressed={r.project.favorite}
                  onClick={async () => {
                    const next = {
                      ...r,
                      project: { ...r.project, favorite: !r.project.favorite },
                    };
                    await saveProject(next);
                    setRecords(await listProjects());
                  }}
                >
                  <Star
                    size={19}
                    fill={r.project.favorite ? "currentColor" : "none"}
                  />
                </button>
              </div>
            ))}
          </div>
          {!filteredRecords.length && (
            <p className="pmm-empty">
              {query
                ? "Không tìm thấy dự án phù hợp."
                : "Dự án được tự động lưu tại đây sau khi bạn bắt đầu thiết kế."}
            </p>
          )}
        </section>
      ) : (
        <>
          <div className="pmm-workspace">
            <section className="pmm-preview">
              <div className="pmm-preview-toolbar">
                <div>
                  <label>
                    <input
                      type="checkbox"
                      checked={grid}
                      onChange={(e) => setGrid(e.target.checked)}
                    />
                    Bàn in
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={wire}
                      onChange={(e) => setWire(e.target.checked)}
                    />
                    Lưới
                  </label>
                </div>
              </div>
              <ModelViewer
                key={project.id}
                parts={parts}
                orthographic={project.kind === "wavy"}
                grid={grid}
                bed={bed}
                wire={wire}
                onSelect={(role) => {
                  if (project.kind === "wavy" && role !== "model") {
                    setPanel("params");
                    requestAnimationFrame(() =>
                      document
                        .getElementById(`pmm-${role}Color-group`)
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "nearest",
                        }),
                    );
                  }
                }}
              />
              {busy && (
                <div className="pmm-viewer-status">
                  <Loader2 className="pmm-spin" size={26} />
                  <strong>Đang dựng mô hình…</strong>
                  <span>
                    Bộ dựng chạy trong worker, có thể hủy bất kỳ lúc nào.
                  </span>
                </div>
              )}
              {!parts.length && !busy && (
                <div className="pmm-viewer-status">
                  <Box size={48} />
                  <strong>Sẵn sàng tạo mô hình</strong>
                  <span>
                    Điều chỉnh thông số bên cạnh rồi nhấn Dựng mô hình.
                  </span>
                  <button
                    className="pmm-primary"
                    onClick={() => void generate()}
                  >
                    <Play size={17} />
                    Dựng mô hình
                  </button>
                </div>
              )}
              {!!parts.length && dirty && (
                <div className="pmm-dirty" role="status">
                  Thông số đã thay đổi. Nhấn Dựng mô hình để cập nhật bản xem và
                  file xuất.
                </div>
              )}
              <footer className="pmm-preview-footer">
                {bounds ? (
                  <span>
                    {bounds.size.map((n) => n.toFixed(2)).join(" × ")} mm ·{" "}
                    {parts
                      .reduce((n, p) => n + p.indices.length / 3, 0)
                      .toLocaleString()}{" "}
                    tam giác · {parts.length} phần
                  </span>
                ) : (
                  <span>Đơn vị: mm · Z hướng lên</span>
                )}
                {printerControl}
              </footer>
            </section>
            <aside className="pmm-inspector">
              <div className="pmm-inspector-tabs">
                {(
                  [
                    ["params", "Tham số", Settings2],
                    ["code", "Code", Code2],
                    ["history", "Lịch sử", History],
                    ["files", "File", FolderOpen],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    aria-pressed={panel === id}
                    onClick={() => setPanel(id)}
                  >
                    <Icon size={17} />
                    {label}
                  </button>
                ))}
              </div>
              <div className="pmm-panel-content">
                {panel === "params" && (
                  <>
                    {project.kind === "wavy" && (
                      <section
                        className="pmm-reference-settings"
                        aria-label="Thông số mẫu gốc"
                      >
                        <strong>
                          {referenceDifferences.length
                            ? `${referenceDifferences.length} thông số khác mẫu gốc`
                            : "Đang dùng thông số mẫu gốc"}
                        </strong>
                        <p>White / Hot Pink · Balanced · 40 mm · Lilita One</p>
                        {referenceDifferences.length > 0 && (
                          <>
                            <small>
                              {referenceDifferences
                                .map((p) => p.label)
                                .join(" · ")}
                            </small>
                            <button
                              onClick={() => {
                                edit({ config: { ...DEFAULT_WAVY } });
                                setMessage(
                                  "Đã áp dụng thông số mẫu gốc. Nhấn Dựng mô hình để cập nhật.",
                                );
                              }}
                            >
                              Dùng thông số mẫu gốc
                            </button>
                          </>
                        )}
                      </section>
                    )}
                    {parameters.length ? (
                      <>
                        {[...new Set(parameters.map((p) => p.group))].map(
                          (group, index) => (
                            <details
                              className="pmm-parameter-group"
                              open={project.kind !== "wavy" || index < 4}
                              key={group}
                            >
                              <summary>
                                {group}
                                <span>
                                  {
                                    parameters.filter((p) => p.group === group)
                                      .length
                                  }
                                </span>
                              </summary>
                              {parameters
                                .filter((p) => p.group === group)
                                .map((p) => (
                                  <div id={`pmm-${p.key}-group`} key={p.key}>
                                    <Field
                                      p={p}
                                      value={values[p.key] ?? p.initial}
                                      onChange={(v) => updateValue(p, v)}
                                      files={files}
                                      fonts={customFonts}
                                      onFile={() => {
                                        setUploadTarget(p.key);
                                        upload.current?.click();
                                      }}
                                      onFont={() => {
                                        setFontTarget(p.key);
                                        setModal("fonts");
                                      }}
                                    />
                                  </div>
                                ))}
                            </details>
                          ),
                        )}
                      </>
                    ) : (
                      <div className="pmm-empty">
                        <Settings2 size={30} />
                        <p>
                          Chưa có tham số. Khai báo biến toàn cục trong SCAD để
                          tạo điều khiển.
                        </p>
                        <button onClick={() => setPanel("code")}>
                          Mở trình sửa code
                        </button>
                      </div>
                    )}
                    <button
                      className="pmm-full-button"
                      onClick={() => setModal("fonts")}
                    >
                      <Type size={18} />
                      Thư viện phông chữ
                    </button>
                  </>
                )}
                {panel === "code" &&
                  (project.kind === "wavy" ? (
                    <div className="pmm-empty">
                      <Type size={32} />
                      <h3>Mẫu chữ dùng bộ dựng tham số</h3>
                      <p>
                        Các điều khiển nằm trong tab Tham số. Bạn có thể mở SCAD
                        riêng để thiết kế bằng code.
                      </p>
                      <button
                        onClick={() =>
                          void openProject(createProject(TEMPLATES[4]))
                        }
                      >
                        Tạo dự án SCAD mới
                      </button>
                      <p className="pmm-note">
                        Được dựng lại từ các tính năng quan sát công khai. Không
                        chứa mã SCAD được bảo vệ của MakerWorld.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="pmm-code-toolbar">
                        <button onClick={() => setModal("libraries")}>
                          <BookOpen size={16} />
                          Thư viện
                        </button>
                        <button onClick={() => setModal("fonts")}>
                          <Type size={16} />
                          Phông
                        </button>
                        <button
                          onClick={() =>
                            void saveDownload(
                              applyParameters(project.source, project.values),
                              `${filename(project.name)}.scad`,
                              "text/plain",
                            ).catch((e) => setError(errorText(e)))
                          }
                        >
                          <Save size={16} />
                          Lưu SCAD
                        </button>
                      </div>
                      <CodeEditor
                        value={project.source}
                        onChange={(source) => edit({ source })}
                        onGenerate={() => void generate()}
                      />
                      <small className="pmm-code-help">
                        Ctrl+Enter: dựng · Ctrl+F: tìm · Tab: thụt lề · Ctrl+Z:
                        hoàn tác code
                      </small>
                      <details className="pmm-doc">
                        <summary>Cú pháp tham số</summary>
                        <pre>
                          {
                            '/* [Nhóm] */\nsize = 20; // [5:0.5:80]\nmode = "A"; // [A:Kiểu A,B:Kiểu B]\nvisible = true;\ntitle = "HELLO";\nposition = [0, 0, 0]; // [-10:1:10]\ncolor_hex = "#ff0000"; // color\ntext_font = "Lilita One"; // font\nfile = "shape.svg";\n/* [Hidden] */\n// Các biến phía dưới sẽ không hiện.'
                          }
                        </pre>
                      </details>
                    </>
                  ))}
                {panel === "history" && (
                  <>
                    <h2>Lần dựng đã lưu</h2>
                    <p className="pmm-note">
                      Khôi phục thông số rồi dựng lại. Giữ tối đa 30 lần gần
                      nhất trên thiết bị này.
                    </p>
                    {history.map((h, i) => (
                      <article className="pmm-history-item" key={h.id}>
                        <div>
                          <input
                            aria-label={`Tên lịch sử ${i + 1}`}
                            value={h.name}
                            onChange={(e) =>
                              setHistory((old) =>
                                old.map((x) =>
                                  x.id === h.id
                                    ? { ...x, name: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                          <small>
                            {new Date(h.updated).toLocaleString("vi-VN")}
                          </small>
                        </div>
                        <button
                          aria-label={`Yêu thích lịch sử ${i + 1}`}
                          aria-pressed={h.favorite}
                          onClick={() =>
                            setHistory((old) =>
                              old.map((x) =>
                                x.id === h.id
                                  ? { ...x, favorite: !x.favorite }
                                  : x,
                              ),
                            )
                          }
                        >
                          <Star
                            size={17}
                            fill={h.favorite ? "currentColor" : "none"}
                          />
                        </button>
                        <button
                          onClick={() => {
                            edit({
                              kind: h.kind,
                              config: h.config,
                              source: h.source,
                              values: h.values,
                            });
                            setMessage(
                              "Đã khôi phục thông số. Nhấn Dựng mô hình để xem.",
                            );
                          }}
                        >
                          Khôi phục
                        </button>
                      </article>
                    ))}
                    {!history.length && (
                      <p className="pmm-empty">
                        Lịch sử xuất hiện sau lần dựng thành công đầu tiên.
                      </p>
                    )}
                  </>
                )}
                {panel === "files" && (
                  <>
                    <h2>File của dự án</h2>
                    <p className="pmm-note">
                      Thêm SCAD, SVG, PNG, STL và phông TTF/OTF. Giữ nguyên
                      đường dẫn khi nhập cả thư mục. Giới hạn 30 MB mỗi file.
                    </p>
                    <div className="pmm-file-actions">
                      <button onClick={() => upload.current?.click()}>
                        <FileUp size={18} />
                        Thêm file
                      </button>
                      <button onClick={() => folder.current?.click()}>
                        <FolderOpen size={18} />
                        Nhập thư mục
                      </button>
                    </div>
                    {files.map((f) => (
                      <div className="pmm-file-row" key={f.name}>
                        <span>
                          {f.name}
                          <small>{(f.data.length / 1024).toFixed(1)} KB</small>
                        </span>
                        <button
                          title={`Xóa ${f.name}`}
                          onClick={() => {
                            setFiles((old) =>
                              old.filter((x) => x.name !== f.name),
                            );
                            setGenerated("");
                          }}
                        >
                          <X size={17} />
                        </button>
                      </div>
                    ))}
                    <button
                      className="pmm-full-button"
                      onClick={() => upload.current?.click()}
                    >
                      Mở SCAD từ máy tính
                    </button>
                  </>
                )}
              </div>
              <div className="pmm-inspector-actions">
                <button
                  className="pmm-primary"
                  onClick={() =>
                    busy ? controller.current?.abort() : void generate()
                  }
                >
                  {busy ? (
                    <Loader2 className="pmm-spin" size={17} />
                  ) : (
                    <Play size={17} />
                  )}
                  {busy
                    ? "Hủy dựng"
                    : dirty && parts.length
                      ? "Cập nhật mô hình"
                      : parts.length
                        ? "Dựng lại mô hình"
                        : "Dựng mô hình"}
                </button>
              </div>
            </aside>
          </div>
          <input
            hidden
            multiple
            type="file"
            ref={upload}
            accept=".scad,.svg,.png,.stl,.ttf,.otf,.json,.dat,.csv"
            onChange={(e) => void importFiles(e.target.files)}
          />
          <input
            hidden
            multiple
            type="file"
            ref={folder}
            {...{ webkitdirectory: "" }}
            onChange={(e) => void importFiles(e.target.files)}
          />
          {!!logs.length && (
            <details className="pmm-console">
              <summary>OpenSCAD · {logs.length} dòng thông báo</summary>
              <pre>{logs.join("\n")}</pre>
            </details>
          )}
        </>
      )}
      {modal === "export" && project && (
        <Modal title="Xuất mô hình 3D" onClose={() => setModal(null)}>
          {printerControl}
          <p>
            3MF giữ màu và vị trí lắp ráp. STL không chứa màu. ZIP chứa từng
            phần STL ở chung hệ tọa độ.
          </p>
          {bounds && bounds.size.some((n, i) => i < 2 && n > bed) && (
            <p className="pmm-warning">
              Mô hình lớn hơn bàn xem đã chọn. Điều chỉnh kích thước hoặc máy in
              trước khi in.
            </p>
          )}
          <div className="pmm-export-options">
            {(
              [
                [
                  "3mf",
                  "3MF nhiều màu",
                  "Giữ phần nền, phần chữ và màu riêng.",
                ],
                ["stl", "STL hợp nhất", "Hợp nhất hình học cho in một màu."],
                [
                  "zip",
                  "ZIP từng phần STL",
                  "Các phần cùng tọa độ để lắp ráp trong slicer.",
                ],
              ] as const
            ).map(([id, title, description]) => (
              <button
                disabled={exporting || dirty}
                key={id}
                onClick={() => void exportModel(id)}
              >
                <Download size={22} />
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                {exporting ? (
                  <Loader2 className="pmm-spin" size={18} />
                ) : (
                  <ArrowRight size={18} />
                )}
              </button>
            ))}
          </div>
          <p className="pmm-note">
            Đây là file mô hình, chưa phải G-code. Chọn cấu hình in phù hợp
            trong slicer.
          </p>
        </Modal>
      )}
      {modal === "libraries" && (
        <Modal title="Thư viện OpenSCAD" onClose={() => setModal(null)}>
          <input
            aria-label="Tìm thư viện"
            placeholder="Tìm thư viện…"
            value={libraryQuery}
            onChange={(e) => setLibraryQuery(e.target.value)}
          />
          {SCAD_LIBRARIES.filter((l) =>
            l.name.toLowerCase().includes(libraryQuery.toLowerCase()),
          ).map((l) => (
            <article className="pmm-library" key={l.name}>
              <div>
                <strong>{l.name}</strong>
                <code>include &lt;{l.include}&gt;;</code>
                <a href={l.source} target="_blank" rel="noreferrer">
                  Mã nguồn và giấy phép
                </a>
              </div>
              <button
                onClick={() => {
                  if (project?.kind === "scad") {
                    edit({
                      source: `include <${l.include}>;\n${project.source}`,
                    });
                    setPanel("code");
                    setModal(null);
                  }
                }}
              >
                Chèn
              </button>
            </article>
          ))}
        </Modal>
      )}
      {modal === "fonts" && (
        <Modal title="Phông chữ" onClose={() => setModal(null)}>
          <FontLibrary
            customFonts={files
              .filter((f) => /\.(ttf|otf)$/i.test(f.name))
              .map((f) => ({
                value: `custom:${f.name}`,
                label: makerFontName(`custom:${f.name}`) ?? f.name,
              }))}
            onImport={() => {
              setModal(null);
              setPanel("files");
              upload.current?.click();
            }}
            onSelect={(value, label, assets) => {
              if (project) {
                if (assets) {
                  setFiles((old) => [
                    ...old.filter(
                      (f) => !assets.some((a) => a.name === f.name),
                    ),
                    ...assets,
                  ]);
                  setGenerated("");
                }
                const p =
                  parameters.find(
                    (p) => p.key === fontTarget && p.type === "font",
                  ) ?? parameters.find((p) => p.type === "font");
                if (p) updateValue(p, project.kind === "wavy" ? value : label);
                else
                  setMessage(
                    `Đã thêm ${label}. Khai báo biến có chú thích // font để chọn phông.`,
                  );
                setPanel("params");
                setModal(null);
              }
            }}
          />
        </Modal>
      )}
      {modal === "about" && (
        <Modal title="Sử dụng Model Maker" onClose={() => setModal(null)}>
          <ol className="pmm-guide">
            <li>Chọn mẫu hoặc mở file SCAD / dự án JSON đã lưu.</li>
            <li>
              Chỉnh tham số, màu từng vùng hoặc sửa code. Nhấn{" "}
              <b>Dựng mô hình</b> (Ctrl+Enter trong trình code).
            </li>
            <li>
              Kéo mô hình để xoay, dùng hai ngón để phóng và di chuyển trên màn
              hình cảm ứng.
            </li>
            <li>
              Xuất 3MF để giữ nhiều màu; STL hợp nhất hoặc ZIP để lấy từng phần.
            </li>
          </ol>
          <p>
            Dự án và lịch sử được lưu trong trình duyệt trên thiết bị này. Dùng
            Lưu dự án để sao lưu hoặc chuyển thiết bị.
          </p>
          <p className="pmm-note">
            Mẫu chữ tròn được xây dựng lại dựa trên giao diện tham khảo. Công
            thức hình học của mã SCAD được bảo vệ không được cung cấp. Workspace
            không có tài khoản, bình luận hay đồng bộ đám mây của MakerWorld.
          </p>
          <a
            href="https://github.com/openscad/openscad-wasm"
            target="_blank"
            rel="noreferrer"
          >
            OpenSCAD WebAssembly · mã nguồn và giấy phép
          </a>
        </Modal>
      )}
    </main>
  );
}
