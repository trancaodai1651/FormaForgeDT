import { useState, useRef, useEffect } from "react";
import type { PrinterProfile, ProductDesign, Artwork } from "./model";
import { DEFAULT_PRINTER } from "./model";
import { readPrinters, savePrinters } from "./storage";
import { batchRows, templateCsv, type CsvMode } from "./csv";
import { batchExport, fileName, rowDesign } from "./export";
import { downloadFile } from "../../lib/downloadFile";
import { rasterArtwork, svgArtwork, IMAGE_DEFAULTS } from "./artwork";
import {
  NumberField as N,
  TextField as T,
  SelectField as S,
  Group,
  type L,
} from "./controls";
export function PrinterPanel({
  printer,
  onChange,
  onCalibration,
  l,
}: {
  printer: PrinterProfile;
  onChange: (v: PrinterProfile) => void;
  onCalibration: () => void;
  l: L;
}) {
  const [profiles, setProfiles] = useState(readPrinters),
    [notice, setNotice] = useState("");
  const set = (v: Partial<PrinterProfile>) =>
    onChange({
      ...printer,
      id: printer.id === "default" ? "draft" : printer.id,
      ...v,
    });
  return (
    <>
      <S
        label={l("Printer profile", "Hồ sơ máy in")}
        value={printer.id}
        onChange={(id) =>
          onChange(
            [DEFAULT_PRINTER, ...profiles].find((p) => p.id === id) ??
              DEFAULT_PRINTER,
          )
        }
        options={[
          [DEFAULT_PRINTER.id, DEFAULT_PRINTER.name],
          ...profiles
            .filter((p) => !p.archived)
            .map((p) => [p.id, p.name] as const),
          ...(printer.id !== "default" &&
          !profiles.some((p) => p.id === printer.id)
            ? [[printer.id, printer.name] as const]
            : []),
        ]}
      />
      <T
        label={l("Profile name", "Tên hồ sơ")}
        value={printer.name}
        onChange={(name) => set({ name })}
      />
      <div className="ps-two">
        <N
          label={l("Bed width (mm)", "Rộng bàn (mm)")}
          value={printer.bedWidth}
          min={50}
          max={1000}
          onChange={(bedWidth) => set({ bedWidth })}
        />
        <N
          label={l("Bed depth (mm)", "Sâu bàn (mm)")}
          value={printer.bedDepth}
          min={50}
          max={1000}
          onChange={(bedDepth) => set({ bedDepth })}
        />
        <N
          label={l("Nozzle (mm)", "Đầu phun (mm)")}
          value={printer.nozzle}
          min={0.2}
          max={1.2}
          step={0.05}
          onChange={(nozzle) => set({ nozzle })}
        />
        <N
          label={l("Layer height (mm)", "Dày lớp (mm)")}
          value={printer.layer}
          min={0.05}
          max={0.8}
          step={0.01}
          onChange={(layer) => set({ layer })}
        />
      </div>
      <N
        label={l("Fit clearance (mm)", "Dung sai khớp (mm)")}
        value={printer.clearance}
        min={0}
        max={1}
        step={0.01}
        onChange={(clearance) => set({ clearance })}
      />
      <Group
        title={l("Shrink compensation and calibration", "Bù co và hiệu chuẩn")}
        open
      >
        {printer.shrink.map((n, i) => (
          <N
            key={i}
            label={`${l("Compensation", "Bù co")} ${"XYZ"[i]} (%)`}
            value={n}
            min={-10}
            max={10}
            step={0.05}
            onChange={(v) =>
              set({
                shrink: printer.shrink.map((a, j) =>
                  i === j ? v : a,
                ) as PrinterProfile["shrink"],
              })
            }
          />
        ))}
        <p className="ps-note">
          {l(
            "Applied to exported dimensions, including joints. Calibration bar: 6 mm pin; radial clearances 0.10–0.35 mm.",
            "Áp dụng vào kích thước xuất, kể cả khớp. Thanh thử: chốt 6 mm; dung sai bán kính 0,10–0,35 mm.",
          )}
        </p>
        <button onClick={onCalibration}>
          {l("Generate fit test bar + pin", "Dựng thanh thử và chốt")}
        </button>
        <S
          label={l("Apply measured fit", "Áp dụng kết quả thử")}
          value={String(printer.clearance)}
          onChange={(v) => set({ clearance: Number(v) })}
          options={[0.1, 0.15, 0.2, 0.25, 0.3, 0.35].map((v) => [
            String(v),
            v.toFixed(2) + " mm",
          ])}
        />
      </Group>
      <div className="ps-two">
        <button
          onClick={() => {
            const p = { ...printer, id: crypto.randomUUID() },
              next = [...profiles, p];
            setProfiles(next);
            savePrinters(next);
            onChange(p);
            setNotice(l("Profile saved.", "Đã lưu hồ sơ."));
          }}
        >
          {l("Save as new", "Lưu hồ sơ mới")}
        </button>
        <button
          disabled={!profiles.some((p) => p.id === printer.id)}
          onClick={() => {
            const next = profiles.map((p) =>
              p.id === printer.id ? printer : p,
            );
            setProfiles(next);
            savePrinters(next);
            setNotice(l("Profile updated.", "Đã cập nhật hồ sơ."));
          }}
        >
          {l("Update profile", "Cập nhật hồ sơ")}
        </button>
      </div>
      {profiles.some((p) => p.id === printer.id) && (
        <button
          className="ps-danger"
          onClick={() => {
            const next = profiles.map((p) =>
              p.id === printer.id ? { ...p, archived: true } : p,
            );
            setProfiles(next);
            savePrinters(next);
            onChange(DEFAULT_PRINTER);
            setNotice(
              l(
                "Profile archived. It can be restored below.",
                "Đã lưu trữ hồ sơ. Có thể khôi phục bên dưới.",
              ),
            );
          }}
        >
          {l("Archive profile", "Lưu trữ hồ sơ")}
        </button>
      )}
      {profiles.some((p) => p.archived) && (
        <Group title={l("Archived profiles", "Hồ sơ đã lưu trữ")}>
          {profiles
            .filter((p) => p.archived)
            .map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  const next = profiles.map((v) =>
                    v.id === p.id ? { ...v, archived: false } : v,
                  );
                  setProfiles(next);
                  savePrinters(next);
                }}
              >
                {l("Restore", "Khôi phục")} {p.name}
              </button>
            ))}
        </Group>
      )}
      {notice && <p role="status">{notice}</p>}
    </>
  );
}
export function BatchPanel({
  design,
  printer,
  l,
  onPreview,
}: {
  design: ProductDesign;
  printer: PrinterProfile;
  l: L;
  onPreview: (design: ProductDesign) => void;
}) {
  const [text, setText] = useState(""),
    [csvMode, setCsvMode] = useState<CsvMode>("auto"),
    [format, setFormat] = useState("3mf"),
    [previewRow, setPreviewRow] = useState(1),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [gap, setGap] = useState(5),
    [maxColors, setColors] = useState(0),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [images, setImages] = useState<Record<string, Artwork>>({});
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  let rows: ReturnType<typeof batchRows> = [],
    csvError = "";
  try {
    rows = batchRows(text, csvMode);
  } catch {
    csvError = l("Unclosed quote in CSV.", "CSV có dấu ngoặc kép chưa đóng.");
  }
  const columns = Object.keys(rows[0] ?? {});
  return (
    <>
      <p className="ps-note">
        {l(
          "Paste names or CSV/TSV orders. Blank fields inherit the current design. Quantities are packed across printer plates.",
          "Dán tên hoặc đơn hàng CSV/TSV. Ô trống dùng thiết kế hiện tại. Số lượng được xếp vào nhiều bàn in.",
        )}
      </p>
      <p className="ps-note">
        {l(
          "Up to 500 rows and 1,000 copies per export.",
          "Tối đa 500 dòng và 1.000 bản mỗi lần xuất.",
        )}
      </p>
      <button
        onClick={() =>
          void downloadFile(
            new Blob(
              [
                templateCsv(
                  Number(design.params.width),
                  Number(design.params.height),
                ),
              ],
              { type: "text/csv;charset=utf-8" },
            ),
            "product-template.csv",
          )
        }
      >
        {l("Download CSV template", "Tải CSV mẫu")}
      </button>
      <label className="ps-upload">
        {l("Import CSV / TSV", "Nhập CSV / TSV")}
        <input
          type="file"
          accept=".csv,.tsv,.txt"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              setText(await f.text());
              setMapping({});
            }
            e.target.value = "";
          }}
        />
      </label>
      <label className="ps-field">
        <span>{l("Names / order data", "Tên / dữ liệu đơn")}</span>
        <textarea
          value={text}
          rows={7}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Alice\nBob\nCharlie"}
        />
      </label>
      {csvError && <p role="alert">{csvError}</p>}
      <S
        label={l("Data format", "Định dạng dữ liệu")}
        value={csvMode}
        onChange={(v) => {
          setCsvMode(v as CsvMode);
          setMapping({});
        }}
        options={[
          ["auto", l("Detect automatically", "Tự nhận diện")],
          [
            "header",
            l("First row contains column names", "Dòng đầu là tên cột"),
          ],
          [
            "names",
            l(
              "List of names without a header",
              "Danh sách tên không có tiêu đề",
            ),
          ],
        ]}
      />
      {rows.length > 0 && (
        <>
          <p>
            {rows.length} {l("rows", "dòng")}
          </p>
          <Group title={l("Map order columns", "Ánh xạ cột đơn hàng")}>
            {[
              [
                "name",
                l("Name / personalization", "Tên / nội dung cá nhân hóa"),
              ],
              ["quantity", l("Quantity", "Số lượng")],
              ["order_number", l("Order ID", "Mã đơn")],
              ["image", l("Image filename", "Tên file ảnh")],
              ["content", l("QR content", "Nội dung QR")],
              ["base_color", l("Base colour", "Màu nền")],
              ["text_color", l("Text colour", "Màu chữ")],
            ].map(([key, label]) => (
              <S
                key={key}
                label={label}
                value={mapping[key] ?? (columns.includes(key) ? key : "")}
                options={[
                  ["", l("Inherit current", "Dùng hiện tại")],
                  ...columns.map((c) => [c, c] as const),
                ]}
                onChange={(v) => setMapping((p) => ({ ...p, [key]: v }))}
              />
            ))}
          </Group>
          <div className="ps-table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c}>{r[c]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <N
            label={l("Preview row", "Xem trước dòng")}
            value={Math.min(previewRow, rows.length)}
            min={1}
            max={rows.length}
            step={1}
            onChange={setPreviewRow}
          />
          <button
            onClick={() => {
              try {
                onPreview(
                  rowDesign(
                    design,
                    rows[Math.min(previewRow, rows.length) - 1],
                    mapping,
                    images,
                  ),
                );
              } catch {
                setError(
                  l(
                    "Add the image referenced by this row before previewing.",
                    "Thêm ảnh có tên trong dòng này trước khi xem trước.",
                  ),
                );
              }
            }}
          >
            {l("Preview this order", "Xem trước đơn này")}
          </button>
        </>
      )}
      <Group title={l("Per-row images", "Ảnh theo từng dòng")}>
        <label className="ps-upload">
          {l(
            "Add images referenced by CSV filename",
            "Thêm ảnh theo tên file trong CSV",
          )}
          <input
            type="file"
            multiple
            accept="image/*,.svg"
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              setBusy(true);
              try {
                const entries = await Promise.all(
                  files.map(
                    async (f) =>
                      [
                        f.name,
                        /\.svg$/i.test(f.name)
                          ? svgArtwork(await f.text(), f.name)
                          : await rasterArtwork(f, IMAGE_DEFAULTS),
                      ] as const,
                  ),
                );
                setImages((prev) => ({
                  ...prev,
                  ...Object.fromEntries(entries),
                }));
              } catch {
                setError(
                  l("An image could not be read.", "Không đọc được một ảnh."),
                );
              } finally {
                setBusy(false);
              }
              e.target.value = "";
            }}
          />
        </label>
        {Object.keys(images).map((n) => (
          <small key={n}>
            {n}
            <br />
          </small>
        ))}
      </Group>
      <div className="ps-two">
        <N
          label={l("Packing gap (mm)", "Khoảng cách xếp (mm)")}
          value={gap}
          min={1}
          max={30}
          onChange={setGap}
        />
        <N
          label={l(
            "Maximum colours (0 = keep all)",
            "Số màu tối đa (0 = giữ hết)",
          )}
          value={maxColors}
          min={0}
          max={16}
          step={1}
          onChange={setColors}
        />
      </div>
      {maxColors > 0 && (
        <p className="ps-note">
          {l(
            "Less-used colours map to the nearest retained filament colour.",
            "Màu ít dùng được ghép vào màu vật liệu giữ lại gần nhất.",
          )}
        </p>
      )}
      <S
        label={l("Batch file format", "Định dạng xuất lô")}
        value={format}
        onChange={setFormat}
        options={[
          ["3mf", "3MF"],
          ["stl", "STL"],
          ["both", "3MF + STL"],
        ]}
      />
      <button
        className="ps-primary"
        disabled={busy || !rows.length || !!csvError}
        onClick={async () => {
          abort.current?.abort();
          abort.current = new AbortController();
          setBusy(true);
          setError("");
          try {
            const out = await batchExport(
              design,
              printer,
              text,
              mapping,
              gap,
              maxColors,
              images,
              abort.current.signal,
              (n, total) => setProgress(`${n} / ${total}`),
              csvMode,
              format as "3mf" | "stl" | "both",
            );
            const saved = await downloadFile(
              new Blob([out.data as BlobPart], { type: "application/zip" }),
              fileName(design.name) + "-batch.zip",
            );
            setProgress(
              !saved
                ? l("Export cancelled.", "Đã hủy xuất file.")
                : l(
                    `${out.items} items · ${out.plates} plates exported.`,
                    `${out.items} sản phẩm · ${out.plates} bàn đã xuất.`,
                  ),
            );
          } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError")
              setProgress(l("Batch cancelled.", "Đã hủy xử lý lô."));
            else
              setError(
                l(
                  "Batch failed. Check quantities, image names, dimensions and plate size.",
                  "Không xuất được lô. Kiểm tra số lượng, tên ảnh, kích thước và cỡ bàn.",
                ),
              );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? l("Generating batch…", "Đang dựng lô…")
          : l("Export plates + manifest ZIP", "Xuất ZIP bàn in và bảng kê")}
      </button>
      {busy && (
        <button onClick={() => abort.current?.abort()}>
          {l("Cancel batch", "Hủy xử lý lô")}
        </button>
      )}
      {progress && <p role="status">{progress}</p>}
      {error && (
        <p role="alert" className="ps-error">
          {error}
        </p>
      )}
    </>
  );
}
