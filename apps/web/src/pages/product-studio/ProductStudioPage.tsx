import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Box,
  Download,
  Undo2,
  Redo2,
  Save,
  Play,
  Search,
  SlidersHorizontal,
  Type,
  Image,
  QrCode,
  Printer,
  Layers,
  FolderOpen,
  X,
  Package,
  Grid3X3,
  SunMoon,
  RotateCcw,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { downloadFile } from "../../lib/downloadFile";
import { ModelViewer } from "../parametric-model-maker/ModelViewer";
import { meshBounds, partsZip } from "../parametric-model-maker/export";
import type { PartMesh } from "../parametric-model-maker/model";
import { PRODUCTS } from "./catalog";
import {
  FIELDS,
  PARAM_DEFAULTS,
  visibleField,
  updateParameter,
} from "./fields";
import {
  DEFAULT_PRINTER,
  newDesign,
  tr,
  type ProductDesign,
  type PrinterProfile,
  type Value,
} from "./model";
import { generateProduct } from "./runtime";
import { product3mf, productStl, packObjects, fileName } from "./export";
import {
  readProjectFile,
  designJson,
  saveDesign,
  listDesigns,
} from "./storage";
import { importModel } from "./artwork";
import { TextEditor } from "./TextEditor";
import { ArtworkEditor } from "./ArtworkEditor";
import { QrEditor } from "./QrEditor";
import { PrinterPanel, BatchPanel } from "./ProductionPanel";
import {
  NumberField,
  TextField,
  ColorField,
  Toggle,
  SelectField,
  Group,
  Modal,
} from "./controls";
import "./studio.css";

type Tab = "parameters" | "text" | "artwork" | "qr" | "printer" | "batch";
const errors: Record<string, readonly [string, string]> = {
  SWITCH_LAYOUT: [
    "Switch mounts overlap or exceed the keycap. Increase keycap size, spacing, or edit switch centres.",
    "Các đế công tắc chồng nhau hoặc vượt keycap. Tăng kích thước, khoảng cách hoặc sửa tọa độ tâm.",
  ],
  QR_DOES_NOT_FIT: [
    "The QR tile cannot fit this outline. Choose a broader shape.",
    "Mã QR không vừa đường viền này. Hãy chọn hình nền rộng hơn.",
  ],
  FRAME_MAGNET_FIT: [
    "The frame rim is too narrow for the chosen magnets. Increase wall thickness or choose smaller magnets.",
    "Viền khung quá hẹp cho nam châm. Tăng độ dày thành hoặc chọn nam châm nhỏ hơn.",
  ],
  IMPORT_MODEL_FIRST: [
    "Import a closed STL or 3MF model to place artwork on its surface.",
    "Nhập mô hình STL hoặc 3MF kín để gắn ảnh lên bề mặt.",
  ],
  EMPTY_GEOMETRY: [
    "The design is empty. Add text, artwork or a larger outline.",
    "Thiết kế rỗng. Hãy thêm chữ, ảnh hoặc tăng kích thước nền.",
  ],
  BRAILLE_UNSUPPORTED: [
    "Braille currently accepts the English alphabet, digits and basic punctuation. Edit unsupported characters.",
    "Braille hiện nhận bảng chữ cái Anh, số và dấu câu cơ bản. Hãy sửa ký tự chưa hỗ trợ.",
  ],
  SLEEVE_WALL: [
    "The sleeve inner diameter leaves insufficient material. Increase the outside diameter.",
    "Đường kính trong quá lớn, thành ống quá mỏng. Hãy tăng đường kính ngoài.",
  ],
  BOX_TOO_SHALLOW: [
    "Increase box height to fit the floor, sliding lid and lip.",
    "Tăng chiều cao hộp để đủ đáy, nắp trượt và gờ giữ.",
  ],
  WALL_TOO_THICK: [
    "The wall consumes the entire cavity. Reduce wall thickness.",
    "Thành chiếm hết lòng khay. Hãy giảm độ dày thành.",
  ],
  BUILD_TIMEOUT: [
    "Generation took too long. Reduce detail, pattern density or text.",
    "Dựng hình quá lâu. Hãy giảm độ mịn, mật độ hoa văn hoặc chữ.",
  ],
  QR_TOO_SMALL: [
    "QR modules are too small. Increase the printed size.",
    "Ô mã QR quá nhỏ. Hãy tăng kích thước in.",
  ],
  QR_EMPTY: [
    "Enter QR content before generating.",
    "Nhập nội dung mã QR trước khi dựng hình.",
  ],
  BEAD_HOLE_FIT: [
    "The bead is too thin for this hole. Enable Grow to fit cord or increase thickness.",
    "Hạt quá mỏng so với lỗ. Bật Tăng hạt cho vừa lỗ hoặc tăng độ dày.",
  ],
  PROJECT_INVALID: [
    "The project file is invalid or uses an unsupported format.",
    "File dự án không hợp lệ hoặc có định dạng chưa được hỗ trợ.",
  ],
  OBJECT_EXCEEDS_BED: [
    "An object is larger than the selected printer bed.",
    "Có chi tiết lớn hơn bàn máy in đang chọn.",
  ],
};
export function ProductStudioPage() {
  const { language, setLanguage } = useI18n(),
    l = useCallback(
      (en: string, vi: string) => (language === "vi" ? vi : en),
      [language],
    );
  const [design, setDesign] = useState(() =>
      newDesign(PRODUCTS[0], PARAM_DEFAULTS),
    ),
    current = useRef(design),
    [printer, setPrinter] = useState<PrinterProfile>(() => {
      try {
        const p = JSON.parse(
          localStorage.getItem("product-studio-active-printer") ?? "null",
        );
        return p &&
          [p.bedWidth, p.bedDepth, p.nozzle, p.layer].every(
            (v) => Number.isFinite(v) && v > 0,
          )
          ? p
          : DEFAULT_PRINTER;
      } catch {
        return DEFAULT_PRINTER;
      }
    }),
    [parts, setParts] = useState<PartMesh[]>([]),
    [builtDesign, setBuiltDesign] = useState<ProductDesign | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [tab, setTab] = useState<Tab>("parameters"),
    [picker, setPicker] = useState(false),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [filter, setFilter] = useState(""),
    [mobileView, setMobileView] = useState<"model" | "edit">("model"),
    [grid, setGrid] = useState(true),
    [axes, setAxes] = useState(false),
    [rulers, setRulers] = useState(true),
    [wire, setWire] = useState(false),
    [ortho, setOrtho] = useState(false),
    [theme, setTheme] = useState(
      () => localStorage.getItem("product-studio-theme") ?? "auto",
    ),
    [exportOpen, setExport] = useState(false),
    [exporting, setExporting] = useState(false),
    [projects, setProjects] = useState<ProductDesign[] | null>(null),
    [showArchived, setShowArchived] = useState(false),
    [jsonAssets, setJsonAssets] = useState(true),
    [historyIndex, setHistoryIndex] = useState(0),
    [back, setBack] = useState(false),
    [ready, setReady] = useState(false);
  const [placement, setPlacement] = useState("");
  const history = useRef([design]),
    index = useRef(0),
    request = useRef<AbortController | null>(null),
    isMounted = useRef(true);
  useEffect(() => {
    localStorage.setItem(
      "product-studio-active-printer",
      JSON.stringify(printer),
    );
  }, [printer]);
  useEffect(() => {
    localStorage.setItem("product-studio-theme", theme);
  }, [theme]);
  const commit = useCallback(
    (patch: Partial<ProductDesign> | ProductDesign, replace = false) => {
      const next = replace
        ? (patch as ProductDesign)
        : { ...current.current, ...patch, updated: Date.now() };
      current.current = next;
      setDesign(next);
      history.current = [
        ...history.current.slice(0, index.current + 1),
        next,
      ].slice(-35);
      index.current = history.current.length - 1;
      setHistoryIndex(index.current);
      setStatus("");
    },
    [],
  );
  const undo = useCallback((direction: number) => {
    const n = index.current + direction;
    if (n < 0 || n >= history.current.length) return;
    index.current = n;
    current.current = history.current[n];
    setDesign(current.current);
    setHistoryIndex(n);
  }, []);
  const message = (error: unknown) => {
    const code = error instanceof Error ? error.message : String(error);
    return errors[code]
      ? tr(errors[code], language)
      : l(
          "Could not complete this operation. Check the design settings and try again.",
          "Không hoàn tất được thao tác. Hãy kiểm tra thông số và thử lại.",
        );
  };
  const build = useCallback(
    async (d: ProductDesign, p: PrinterProfile, calibration = false) => {
      request.current?.abort();
      const abort = new AbortController();
      request.current = abort;
      setBusy(true);
      setError("");
      try {
        const next = await generateProduct(d, p, abort.signal, calibration);
        if (abort.signal.aborted) return;
        setParts(next);
        setBuiltDesign(
          calibration
            ? {
                ...d,
                params: { ...d.params, calibration: true },
                name: l("Fit calibration", "Hiệu chuẩn khớp"),
              }
            : d,
        );
      } catch (e) {
        if (!abort.signal.aborted) {
          console.error("Product Studio generation:", e);
          setError(message(e));
        }
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    },
    [language],
  );
  useEffect(() => {
    isMounted.current = true;
    void listDesigns()
      .then((list) => {
        if (!isMounted.current) return;
        const id = localStorage.getItem("product-studio-last"),
          last = list.find((p) => p.id === id && !p.archived);
        if (last) {
          current.current = last;
          setDesign(last);
          history.current = [last];
          index.current = 0;
          setHistoryIndex(0);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
    return () => {
      isMounted.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => void build(design, printer), 650);
    return () => {
      clearTimeout(timer);
      request.current?.abort();
    };
  }, [design, printer, ready]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      void saveDesign(design)
        .then(() => {
          localStorage.setItem("product-studio-last", design.id);
          setStatus(l("Saved on this device", "Đã lưu trên thiết bị"));
        })
        .catch(() =>
          setStatus(
            l(
              "Storage full. Download a backup.",
              "Bộ nhớ đầy. Hãy tải bản sao lưu.",
            ),
          ),
        );
    }, 1000);
    return () => clearTimeout(timer);
  }, [design, ready, language]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "s") {
        e.preventDefault();
        void saveDesign(current.current);
      }
      if (
        e.key === "z" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        undo(e.shiftKey ? 1 : -1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [undo]);
  const bounds = useMemo(
      () => (parts.length ? meshBounds(parts) : null),
      [parts],
    ),
    filaments = [...new Set(parts.map((p) => p.color))],
    preset = PRODUCTS.find((p) => p.id === design.preset) ?? PRODUCTS[0];
  const visible = FIELDS.filter(
      (f) =>
        visibleField(f, design.family, design.params) &&
        (!filter ||
          `${tr(f.label, language)} ${f.key}`
            .toLowerCase()
            .includes(filter.toLowerCase())),
    ),
    groups = [...new Set(visible.map((f) => f.group[0]))].sort((a, b) => {
      const priority = [
        "Plate",
        "Photo and frame",
        "Beads and cord",
        "Roller and handles",
        "Box and sliding lid",
        "Lattice and weave",
        "Switch clicker",
        "Shape and dimensions",
        "Layers and border",
        "Compartments",
        "Hanging and mounting",
        "Backing and reverse",
        "Pattern and relief",
        "Hardware and fit",
        "Scan board",
      ];
      return (
        (priority.indexOf(a) < 0 ? 99 : priority.indexOf(a)) -
        (priority.indexOf(b) < 0 ? 99 : priority.indexOf(b))
      );
    });
  const categories = [
      ...new Map(PRODUCTS.map((p) => [p.category[0], p.category])).values(),
    ],
    filtered = PRODUCTS.filter(
      (p) =>
        (category === "all" || p.category[0] === category) &&
        p.name.some((s) => s.toLowerCase().includes(query.toLowerCase())),
    );
  const setParam = (key: string, value: Value) => {
    const base = current.current,
      params = updateParameter(base.params, key, value);
    if (key === "stampPreset" && value !== "custom") {
      const text =
        value === "blank"
          ? []
          : value === "address"
            ? ["YOUR NAME", "123 SAMPLE STREET", "CITY, POSTCODE"]
            : value === "seal"
              ? ["APPROVED", "2026"]
              : value === "multiline"
                ? ["HANDMADE", "WITH LOVE"]
                : [String(value).toUpperCase()];
      params.shape = value === "seal" ? "circle" : "rounded";
      params.sizing = "fit";
      params.border = value === "seal";
      params.keyring = false;
      commit({
        params,
        lines: base.lines.map((line, i) => ({
          ...line,
          text: text[i] ?? "",
          style: "raised",
          size: value === "address" ? 8 : 16,
          weight: "bold",
        })),
      });
    } else commit({ params });
  };
  const exportFile = async (
    kind: "3mf" | "stl" | "parts" | "json" | "settings",
  ) => {
    if (!builtDesign && kind !== "json" && kind !== "settings") return;
    setExporting(true);
    setError("");
    try {
      let data: Uint8Array | string, ext: string, type: string;
      const source = builtDesign ?? design;
      if (kind === "3mf") {
        data = product3mf(parts, source, printer);
        ext = "3mf";
        type = "application/vnd.ms-package.3dmanufacturing-3dmodel+xml";
      } else if (kind === "stl") {
        data = await productStl(parts);
        ext = "stl";
        type = "model/stl";
      } else if (kind === "parts") {
        data = partsZip(parts);
        ext = "zip";
        type = "application/zip";
      } else {
        data = designJson(
          source.params.calibration === true ? source : design,
          jsonAssets,
          kind === "settings",
        );
        ext = kind === "settings" ? "settings.json" : "json";
        type = "application/json";
      }
      const saved = await downloadFile(
        new Blob([data as BlobPart], { type }),
        `${fileName(kind === "json" || kind === "settings" ? design.name : source.name)}.${ext}`,
      );
      setStatus(
        saved
          ? l("File exported", "Đã xuất file")
          : l("Export cancelled", "Đã hủy xuất file"),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setExporting(false);
    }
  };
  const switchPreset = (id: string) => {
    const selected = PRODUCTS.find((p) => p.id === id);
    if (!selected) return;
    void saveDesign(current.current).catch(() => {});
    commit(newDesign(selected, PARAM_DEFAULTS), true);
    setPicker(false);
    setBack(false);
    setTab("parameters");
    setError("");
  };
  return (
    <main className="product-studio" data-theme={theme}>
      <header className="ps-header">
        <div className="ps-brand">
          <Link to="/" aria-label={l("Back to workspace", "Về workspace")}>
            <ArrowLeft size={20} />
          </Link>
          <span className="ps-brand-icon">
            <Box size={22} />
          </span>
          <div>
            <strong>Product Studio</strong>
            <small>
              {status ||
                l(
                  "Design and print locally",
                  "Thiết kế và xuất in tại thiết bị",
                )}
            </small>
          </div>
        </div>
        <nav aria-label={l("Workspace actions", "Thao tác workspace")}>
          <button
            title={l("Reset this preset", "Đặt lại mẫu này")}
            aria-label={l("Reset this preset", "Đặt lại mẫu này")}
            onClick={() => {
              const next = newDesign(preset, PARAM_DEFAULTS);
              commit({ ...next, id: design.id, name: design.name }, true);
              setBack(false);
            }}
          >
            <RotateCcw size={18} />
          </button>
          <div className="ps-language">
            <button
              aria-pressed={language === "vi"}
              onClick={() => setLanguage("vi")}
            >
              VI
            </button>
            <button
              aria-pressed={language === "en"}
              onClick={() => setLanguage("en")}
            >
              EN
            </button>
          </div>
          <button
            title={l("Undo", "Hoàn tác")}
            aria-label={l("Undo", "Hoàn tác")}
            disabled={historyIndex === 0}
            onClick={() => undo(-1)}
          >
            <Undo2 size={18} />
          </button>
          <button
            title={l("Redo", "Làm lại")}
            aria-label={l("Redo", "Làm lại")}
            disabled={historyIndex >= history.current.length - 1}
            onClick={() => undo(1)}
          >
            <Redo2 size={18} />
          </button>
          <button
            aria-label={l("Projects", "Dự án")}
            onClick={() => void listDesigns().then(setProjects)}
          >
            <FolderOpen size={18} />
            <span>{l("Projects", "Dự án")}</span>
          </button>
          <button
            className="ps-primary"
            aria-label={l("Export", "Xuất file")}
            disabled={busy || !parts.length || !!error}
            onClick={() => setExport(true)}
          >
            <Download size={18} />
            <span>{l("Export", "Xuất file")}</span>
          </button>
        </nav>
      </header>
      <div className="ps-mobile-view">
        <button
          aria-pressed={mobileView === "model"}
          onClick={() => setMobileView("model")}
        >
          <Box size={17} />
          {l("3D preview", "Xem 3D")}
        </button>
        <button
          aria-pressed={mobileView === "edit"}
          onClick={() => setMobileView("edit")}
        >
          <SlidersHorizontal size={17} />
          {l("Edit design", "Sửa thiết kế")}
        </button>
      </div>
      <div className="ps-layout" data-mobile-view={mobileView}>
        <aside className="ps-inspector">
          <button className="ps-product-picker" onClick={() => setPicker(true)}>
            <span className="ps-product-icon">
              <Package size={27} />
            </span>
            <span>
              <small>{tr(preset.category, language)}</small>
              <strong>{tr(preset.name, language)}</strong>
              <em>
                {l("Change product", "Đổi sản phẩm")} · 95 {l("presets", "mẫu")}
              </em>
            </span>
            <span>⌄</span>
          </button>
          <div
            className="ps-tabs"
            role="tablist"
            aria-label={l("Design sections", "Các phần thiết kế")}
          >
            {(
              [
                ["parameters", SlidersHorizontal, l("Shape", "Hình")],
                ["text", Type, l("Text", "Chữ")],
                ["artwork", Image, l("Art", "Ảnh")],
                ["qr", QrCode, "QR"],
                ["printer", Printer, l("Printer", "Máy in")],
                ["batch", Layers, l("Batch", "Hàng loạt")],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                role="tab"
                aria-selected={tab === id}
                key={id}
                onClick={() => setTab(id)}
              >
                <Icon size={19} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <section
            className="ps-controls"
            role="tabpanel"
            aria-label={l("Design controls", "Thông số thiết kế")}
          >
            {tab === "parameters" && (
              <>
                <TextField
                  label={l("Project name", "Tên dự án")}
                  value={design.name}
                  onChange={(name) => commit({ name })}
                />
                <label className="ps-search">
                  <Search size={17} />
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={l("Search parameters…", "Tìm thông số…")}
                    aria-label={l("Search parameters", "Tìm thông số")}
                  />
                </label>
                {design.family === "surface-art" && (
                  <>
                    <p className="ps-note">
                      {l(
                        "Import a watertight model. Artwork follows its upper curved surface.",
                        "Nhập mô hình kín. Ảnh bám theo bề mặt cong phía trên.",
                      )}
                    </p>
                    <label className="ps-upload">
                      {l("Import STL / 3MF model", "Nhập mô hình STL / 3MF")}
                      <input
                        type="file"
                        accept=".stl,.3mf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file)
                            try {
                              const id = current.current.id,
                                model = await importModel(file);
                              if (
                                isMounted.current &&
                                current.current.id === id
                              )
                                commit({ model });
                            } catch (error) {
                              setError(message(error));
                            }
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <p>
                      {design.model?.length ?? 0}{" "}
                      {l("imported parts", "phần đã nhập")}
                    </p>
                    <SelectField
                      label={l(
                        "Click model to position",
                        "Bấm mô hình để đặt vị trí",
                      )}
                      value={placement}
                      onChange={(v) => {
                        setPlacement(v);
                        if (v) setMobileView("model");
                      }}
                      options={[
                        ["", l("Selection off", "Tắt chọn vị trí")],
                        ...design.lines.map(
                          (_, i) =>
                            [
                              `text-${i}`,
                              l(`Text line ${i + 1}`, `Dòng chữ ${i + 1}`),
                            ] as const,
                        ),
                        ...design.artworks.map(
                          (a, i) => [`art-${i}`, a.name] as const,
                        ),
                      ]}
                    />
                    <p className="ps-note">
                      {l(
                        "Rotate the model using X/Y/Z to expose a different surface, then click to position the selected text or artwork.",
                        "Xoay mô hình theo X/Y/Z để đưa mặt khác lên trên, sau đó bấm để đặt chữ hoặc ảnh đã chọn.",
                      )}
                    </p>
                  </>
                )}
                {groups.map((group, i) => (
                  <Group
                    key={group}
                    title={tr(
                      visible.find((f) => f.group[0] === group)!.group,
                      language,
                    )}
                    open={i === 0 || !!filter}
                  >
                    {visible
                      .filter((f) => f.group[0] === group)
                      .map((f) => {
                        const value = design.params[f.key] ?? f.value,
                          label = tr(f.label, language),
                          key = f.key;
                        return f.type === "number" ? (
                          <NumberField
                            key={key}
                            label={label}
                            value={Number(value)}
                            min={f.min}
                            max={f.max}
                            step={f.step}
                            onChange={(v) => setParam(key, v)}
                          />
                        ) : f.type === "boolean" ? (
                          <Toggle
                            key={key}
                            label={label}
                            value={!!value}
                            onChange={(v) => setParam(key, v)}
                          />
                        ) : f.type === "color" ? (
                          <ColorField
                            key={key}
                            label={label}
                            value={String(value)}
                            onChange={(v) => setParam(key, v)}
                          />
                        ) : f.type === "select" ? (
                          <SelectField
                            key={key}
                            label={label}
                            value={String(value)}
                            onChange={(v) => setParam(key, v)}
                            options={f
                              .options!.filter(
                                (o) =>
                                  !(
                                    design.family === "clicker" &&
                                    f.key === "ringStyle" &&
                                    o.value === "slot"
                                  ),
                              )
                              .map((o) => [o.value, tr(o.label, language)])}
                          />
                        ) : (
                          <TextField
                            key={key}
                            label={label}
                            value={String(value)}
                            onChange={(v) => setParam(key, v)}
                          />
                        );
                      })}
                  </Group>
                ))}
                {!visible.length && (
                  <p>
                    {l("No matching parameters.", "Không có thông số phù hợp.")}
                  </p>
                )}
              </>
            )}
            {tab === "text" && (
              <>
                <Toggle
                  label={l("Edit reverse text", "Sửa chữ mặt sau")}
                  value={back}
                  onChange={(value) => {
                    setBack(value);
                    if (value) setParam("twoSided", true);
                  }}
                />
                {back && (
                  <p className="ps-note">
                    {l(
                      "Raised reverse text needs an edge-up print orientation or support. Use flat colour for a flat bed-facing back.",
                      "Chữ nổi mặt sau cần đặt đứng hoặc dùng support. Dùng màu đồng mặt nếu mặt sau nằm trên bàn.",
                    )}
                  </p>
                )}
                <TextEditor
                  key={`${design.id}-${back}`}
                  lines={back ? design.backLines : design.lines}
                  onChange={(lines) =>
                    commit(back ? { backLines: lines } : { lines })
                  }
                  l={l}
                  assets={design.assets}
                  onAssets={(assets) =>
                    commit({
                      assets: [
                        ...new Map(
                          [...current.current.assets, ...assets].map((a) => [
                            a.name,
                            a,
                          ]),
                        ).values(),
                      ],
                    })
                  }
                />
              </>
            )}
            {tab === "artwork" && (
              <ArtworkEditor
                key={design.id}
                artworks={design.artworks}
                onChange={(artworks) => commit({ artworks })}
                assets={design.assets}
                onAssets={(assets) =>
                  commit({
                    assets: [
                      ...new Map(
                        [...current.current.assets, ...assets].map((a) => [
                          a.name,
                          a,
                        ]),
                      ).values(),
                    ],
                  })
                }
                l={l}
              />
            )}
            {tab === "qr" && (
              <>
                {!["qr", "scan-board"].includes(design.family) && (
                  <Toggle
                    label={l(
                      "Include QR on this product",
                      "Thêm QR vào sản phẩm này",
                    )}
                    value={!!design.params.includeQr}
                    onChange={(v) => setParam("includeQr", v)}
                  />
                )}
                <QrEditor
                  codes={design.codes}
                  onChange={(codes) => commit({ codes })}
                  l={l}
                />
              </>
            )}
            {tab === "printer" && (
              <PrinterPanel
                printer={printer}
                onChange={setPrinter}
                onCalibration={() => void build(design, printer, true)}
                l={l}
              />
            )}
            {tab === "batch" && (
              <BatchPanel
                design={design}
                printer={printer}
                l={l}
                onPreview={(d) => {
                  setMobileView("model");
                  void build(d, printer);
                }}
              />
            )}
          </section>
          <footer className="ps-inspector-footer">
            <button
              className="ps-primary"
              onClick={() => {
                if (busy) {
                  request.current?.abort();
                  setBusy(false);
                } else void build(design, printer);
              }}
            >
              <Play size={18} />
              {busy
                ? l("Cancel generation", "Hủy dựng hình")
                : l("Generate model", "Dựng mô hình")}
            </button>
          </footer>
        </aside>
        <section
          className="ps-stage"
          aria-label={l("Model workspace", "Không gian mô hình")}
        >
          <header className="ps-stage-top">
            <div>
              <span className={busy ? "ps-dot ps-dot-busy" : "ps-dot"} />
              <strong>
                {busy
                  ? l("Generating…", "Đang dựng…")
                  : tr(preset.name, language)}
              </strong>
            </div>
            <div className="ps-stage-toggles">
              <Toggle
                label={l("Grid", "Lưới")}
                value={grid}
                onChange={setGrid}
              />
              <Toggle
                label={l("Axes", "Trục")}
                value={axes}
                onChange={setAxes}
              />
              <Toggle
                label={l("Rulers", "Thước")}
                value={rulers}
                onChange={setRulers}
              />
            </div>
          </header>
          <div className="ps-preview">
            <ModelViewer
              key={`${builtDesign?.id ?? design.id}-${builtDesign?.params.calibration === true}`}
              responsiveFit
              parts={parts}
              grid={grid}
              axes={axes}
              bed={{ width: printer.bedWidth, depth: printer.bedDepth }}
              wire={wire}
              orthographic={ortho}
              language={language}
              onSelect={() => {
                setTab("parameters");
              }}
              onPick={
                design.family === "surface-art" && placement
                  ? (point) => {
                      const [kind, slot] = placement.split("-"),
                        i = Number(slot),
                        x = point[0] / (1 + printer.shrink[0] / 100),
                        y = point[1] / (1 + printer.shrink[1] / 100);
                      if (kind === "art")
                        commit({
                          artworks: current.current.artworks.map((a, j) =>
                            j === i ? { ...a, x, y } : a,
                          ),
                        });
                      else
                        commit({
                          lines: current.current.lines.map((a, j) =>
                            j === i ? { ...a, x, y, align: "manual" } : a,
                          ),
                        });
                    }
                  : undefined
              }
            />
            {!parts.length && !busy && (
              <div className="ps-empty">
                <Box size={44} />
                <h2>{l("Make it yours", "Tạo thiết kế của bạn")}</h2>
                <p>
                  {l(
                    "Choose a product and customise its dimensions, text and artwork.",
                    "Chọn sản phẩm và chỉnh kích thước, chữ, ảnh.",
                  )}
                </p>
              </div>
            )}
            {rulers && bounds && (
              <div className="ps-dimensions">
                <span>↔ {bounds.size[0].toFixed(2)} mm</span>
                <span>↕ {bounds.size[1].toFixed(2)} mm</span>
                <span>Z {bounds.size[2].toFixed(2)} mm</span>
              </div>
            )}
          </div>
          {error && (
            <div className="ps-error ps-stage-message" role="alert">
              <span>{error}</span>
              <button
                onClick={() => setError("")}
                aria-label={l("Dismiss error", "Đóng lỗi")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <footer className="ps-stage-bottom">
            <div>
              <span>
                {parts
                  .reduce((s, p) => s + p.indices.length / 3, 0)
                  .toLocaleString(language)}{" "}
                {l("triangles", "tam giác")}
              </span>
              <span>
                {parts.length} {l("parts", "phần")} · {filaments.length}{" "}
                {l("colours", "màu")}
              </span>
              <div className="ps-filaments">
                {filaments.map((color) => (
                  <span
                    key={color}
                    title={color}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>
            <div>
              <button
                title={l(
                  "Arrange separate parts on the bed",
                  "Xếp các chi tiết rời vào bàn",
                )}
                disabled={!parts.length || busy}
                onClick={() => {
                  try {
                    const plates = packObjects(
                      [{ parts, name: design.name, order: "", copy: 1 }],
                      printer,
                      5,
                    );
                    if (plates.length !== 1) {
                      setError(
                        l(
                          "Parts need multiple plates. Use batch export.",
                          "Chi tiết cần nhiều bàn. Hãy dùng xuất hàng loạt.",
                        ),
                      );
                      return;
                    }
                    setParts(plates[0].parts);
                  } catch (e) {
                    setError(message(e));
                  }
                }}
              >
                <Grid3X3 size={17} />
                {l("Arrange", "Xếp bàn")}
              </button>
              <button aria-pressed={wire} onClick={() => setWire(!wire)}>
                {l("Wireframe", "Khung lưới")}
              </button>
              <button aria-pressed={ortho} onClick={() => setOrtho(!ortho)}>
                {l("Orthographic", "Trực giao")}
              </button>
              <label className="ps-theme">
                <SunMoon size={17} />
                <select
                  aria-label={l("Colour theme", "Giao diện màu")}
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  <option value="auto">{l("Auto", "Tự động")}</option>
                  <option value="light">{l("Light", "Sáng")}</option>
                  <option value="dark">{l("Dark", "Tối")}</option>
                </select>
              </label>
            </div>
          </footer>
        </section>
      </div>
      {picker && (
        <Modal
          title={["Choose a product", "Chọn sản phẩm"]}
          onClose={() => setPicker(false)}
          language={language}
        >
          <div className="ps-catalog-head">
            <label className="ps-search">
              <Search size={18} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={l("Search all 95 presets…", "Tìm trong 95 mẫu…")}
              />
            </label>
            <SelectField
              label={l("Category", "Nhóm")}
              value={category}
              onChange={setCategory}
              options={[
                ["all", l("All products", "Tất cả sản phẩm")],
                ...categories.map((c) => [c[0], tr(c, language)] as const),
              ]}
            />
          </div>
          <div className="ps-catalog">
            {filtered.map((p) => (
              <button
                key={p.id}
                aria-pressed={p.id === design.preset}
                onClick={() => switchPreset(p.id)}
              >
                <span className={`ps-catalog-art ps-family-${p.family}`}>
                  <Package size={32} />
                  <em>#{PRODUCTS.indexOf(p) + 1}</em>
                </span>
                <strong>{tr(p.name, language)}</strong>
                <small>{tr(p.category, language)}</small>
              </button>
            ))}
          </div>
          <p className="ps-note">
            {filtered.length} / 95 ·{" "}
            {l("23 generator families", "23 nhóm tạo hình")}
          </p>
        </Modal>
      )}
      {exportOpen && (
        <Modal
          title={["Export your design", "Xuất thiết kế"]}
          onClose={() => setExport(false)}
          language={language}
        >
          <p>
            {l(
              "3MF preserves individual colour regions. STL merges the printable solids into one colour.",
              "3MF giữ từng vùng màu riêng. STL gộp các khối in thành một màu.",
            )}
          </p>
          <div className="ps-export-grid">
            <button
              className="ps-primary"
              disabled={exporting || busy}
              onClick={() => void exportFile("3mf")}
            >
              <Download />
              {l("Multicolour 3MF", "3MF nhiều màu")}
            </button>
            <button
              disabled={exporting || busy}
              onClick={() => void exportFile("stl")}
            >
              STL
            </button>
            <button
              disabled={exporting || busy}
              onClick={() => void exportFile("parts")}
            >
              {l("Separate STL parts (ZIP)", "STL từng phần (ZIP)")}
            </button>
          </div>
          <Group
            title={l(
              "Project backup and settings",
              "Sao lưu dự án và thông số",
            )}
            open
          >
            <Toggle
              label={l(
                "Include artwork, imported model and fonts",
                "Kèm ảnh, mô hình đã nhập và phông",
              )}
              value={jsonAssets}
              onChange={setJsonAssets}
            />
            <button
              disabled={exporting}
              onClick={() => void exportFile("json")}
            >
              {l("Full project JSON", "JSON dự án đầy đủ")}
            </button>
            <button
              disabled={exporting}
              onClick={() => void exportFile("settings")}
            >
              {l(
                "Settings template without text/art",
                "Mẫu thông số không kèm chữ / ảnh",
              )}
            </button>
          </Group>
          {exporting && (
            <p role="status">{l("Preparing file…", "Đang chuẩn bị file…")}</p>
          )}
        </Modal>
      )}
      {projects && (
        <Modal
          title={["Local projects", "Dự án trên thiết bị"]}
          onClose={() => setProjects(null)}
          language={language}
        >
          <label className="ps-upload">
            {l(
              "Import project JSON / 3MF or settings",
              "Nhập JSON / 3MF dự án hoặc thông số",
            )}
            <input
              type="file"
              accept=".json,.3mf"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f)
                  try {
                    const { design: loaded, settings } =
                      await readProjectFile(f);
                    if (settings) {
                      const base = current.current;
                      commit(
                        {
                          ...loaded,
                          id: base.id,
                          name: base.name,
                          lines: loaded.lines.map((l, i) => ({
                            ...l,
                            text: base.lines[i]?.text ?? "",
                          })),
                          backLines: loaded.backLines.map((l, i) => ({
                            ...l,
                            text: base.backLines[i]?.text ?? "",
                          })),
                          artworks: base.artworks,
                          assets: [
                            ...base.assets,
                            ...loaded.assets.filter(
                              (a) =>
                                !base.assets.some((b) => b.name === a.name),
                            ),
                          ],
                          model: base.model,
                          codes: base.codes,
                        },
                        true,
                      );
                    } else commit(loaded, true);
                    setProjects(null);
                  } catch (error) {
                    setError(message(error));
                  }
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={() =>
              void saveDesign({
                ...design,
                id: crypto.randomUUID(),
                name: design.name + " " + l("copy", "bản sao"),
              })
                .then(() => listDesigns())
                .then(setProjects)
            }
          >
            <Save size={17} />
            {l("Save a separate copy", "Lưu bản sao riêng")}
          </button>
          <div className="ps-projects">
            <Toggle
              label={l("Show archived projects", "Hiện dự án đã lưu trữ")}
              value={showArchived}
              onChange={setShowArchived}
            />
            {projects
              .filter((p) => !!p.archived === showArchived)
              .map((p) => (
                <div className="ps-project-row" key={p.id}>
                  <button
                    onClick={() => {
                      void saveDesign(current.current).catch(() => {});
                      commit(p, true);
                      setProjects(null);
                    }}
                  >
                    <strong>{p.name}</strong>
                    <small>
                      {new Date(p.updated).toLocaleString(language)}
                    </small>
                  </button>
                  <button
                    onClick={async () => {
                      await saveDesign({ ...p, archived: !p.archived });
                      setProjects(await listDesigns());
                      if (p.id === design.id) commit({ archived: !p.archived });
                    }}
                  >
                    {p.archived
                      ? l("Restore", "Khôi phục")
                      : l("Archive", "Lưu trữ")}
                  </button>
                </div>
              ))}
          </div>
        </Modal>
      )}
    </main>
  );
}
