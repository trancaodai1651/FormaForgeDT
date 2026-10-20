import { useState, useEffect, useRef } from "react";
import { MAKER_FONTS, type AssetFile } from "../parametric-model-maker/model";
import {
  assetBase,
  registerMakerFont,
} from "../parametric-model-maker/wavyGeometry";
import type { TextLine } from "./model";
import {
  NumberField as N,
  TextField as T,
  SelectField as S,
  ColorField as C,
  Toggle,
  Group,
  type L,
} from "./controls";
export function TextEditor({
  lines,
  onChange,
  l,
  assets,
  onAssets,
}: {
  lines: TextLine[];
  onChange: (v: TextLine[]) => void;
  l: L;
  assets: AssetFile[];
  onAssets: (files: AssetFile[]) => void;
}) {
  const [active, setActive] = useState(0),
    [fontQuery, setFontQuery] = useState(""),
    [catalog, setCatalog] = useState<{
      commit: string;
      fonts: { path: string; label: string }[];
    } | null>(null),
    [busy, setBusy] = useState(""),
    [fontError, setFontError] = useState("");
  const line = lines[active],
    alive = useRef(true),
    drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
      null,
    ),
    set = (patch: Partial<TextLine>) =>
      onChange(lines.map((v, i) => (i === active ? { ...v, ...patch } : v)));
  useEffect(() => {
    alive.current = true;
    const a = new AbortController();
    fetch(`${assetBase()}font-catalog.json`, { signal: a.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then(setCatalog)
      .catch(() => {});
    return () => {
      alive.current = false;
      a.abort();
    };
  }, []);
  const getFont = async (path: string) => {
    if (!catalog) return;
    setBusy(path);
    setFontError("");
    try {
      const r = await fetch(
        `https://raw.githubusercontent.com/google/fonts/${catalog.commit}/${path}`,
      );
      if (!r.ok) throw new Error();
      const name = path.split("/").pop()!,
        data = new Uint8Array(await r.arrayBuffer());
      registerMakerFont(`custom:${name}`, data);
      const licensePath =
          path.slice(0, path.lastIndexOf("/")) +
          (path.startsWith("ofl/") ? "/OFL.txt" : "/LICENSE.txt"),
        license = await fetch(
          `https://raw.githubusercontent.com/google/fonts/${catalog.commit}/${licensePath}`,
        );
      if (!license.ok) throw new Error();
      if (!alive.current) return;
      onAssets([
        ...assets.filter((a) => a.name !== name),
        { name, data },
        {
          name: name + ".license.txt",
          data: new Uint8Array(await license.arrayBuffer()),
        },
      ]);
      set({ font: `custom:${name}` });
    } catch {
      if (!alive.current) return;
      setFontError(
        l(
          "Font download failed. Import a TTF file instead.",
          "Không tải được phông. Hãy nhập file TTF.",
        ),
      );
    }
    setBusy("");
  };
  return (
    <>
      <div
        className="ps-line-tabs"
        role="tablist"
        aria-label={l("Text lines", "Các dòng chữ")}
      >
        {lines.map((line, i) => (
          <button
            role="tab"
            aria-selected={active === i}
            key={i}
            onClick={() => setActive(i)}
          >
            {i + 1}
            {line.text ? " •" : ""}
          </button>
        ))}
      </div>
      <T
        label={l("Text", "Nội dung")}
        value={line.text}
        onChange={(text) => set({ text })}
      />
      <S
        label={l("Font", "Phông chữ")}
        value={line.font}
        onChange={(font) => set({ font })}
        options={[
          ["lato-regular", "Lato"] as const,
          ...(active
            ? [["inherit", l("Same as line 1", "Giống dòng 1")] as const]
            : []),
          ...MAKER_FONTS.map(([v, n]) => [v, n] as const),
          ...assets
            .filter((a) => /\.(ttf|otf)$/i.test(a.name))
            .map((a) => [`custom:${a.name}`, a.name] as const),
        ]}
      />
      <div className="ps-two">
        <N
          label={l("Font size (mm)", "Cỡ chữ (mm)")}
          value={line.size}
          min={1}
          max={150}
          onChange={(size) => set({ size })}
        />
        <N
          label={l("Letter spacing (mm)", "Giãn ký tự (mm)")}
          value={line.spacing}
          min={-5}
          max={20}
          onChange={(spacing) => set({ spacing })}
        />
      </div>
      <S
        label={l("Weight", "Độ đậm")}
        value={line.weight}
        onChange={(weight) => set({ weight: weight as TextLine["weight"] })}
        options={["light", "regular", "bold", "heavy"].map((v, i) => [
          v,
          [
            l("Light", "Mảnh"),
            l("Regular", "Thường"),
            l("Bold", "Đậm"),
            l("Heavy", "Rất đậm"),
          ][i],
        ])}
      />
      <Toggle
        label={l("Italic 12°", "Nghiêng 12°")}
        value={line.italic}
        onChange={(italic) => set({ italic })}
      />
      <S
        label={l("Case", "Hoa / thường")}
        value={line.letterCase}
        onChange={(letterCase) =>
          set({ letterCase: letterCase as TextLine["letterCase"] })
        }
        options={[
          ["as", l("As typed", "Giữ nguyên")],
          ["upper", l("UPPERCASE", "CHỮ HOA")],
          ["lower", l("lowercase", "chữ thường")],
        ]}
      />
      <Group title={l("Colour and relief", "Màu và độ nổi")} open>
        <C
          label={l("Text colour", "Màu chữ")}
          value={line.color}
          onChange={(color) => set({ color })}
        />
        <S
          label={l("Text style", "Kiểu chữ")}
          value={line.style}
          onChange={(style) => set({ style: style as TextLine["style"] })}
          options={[
            ["raised", l("Raised", "Nổi")],
            ["engraved", l("Engraved", "Khắc chìm")],
            ["flush", l("Flat colour inlay", "Màu phẳng đồng mặt")],
          ]}
        />
        {line.style === "raised" ? (
          <N
            label={l("Rise (mm)", "Độ nổi (mm)")}
            value={line.rise}
            min={0.2}
            max={15}
            onChange={(rise) => set({ rise })}
          />
        ) : (
          <N
            label={l("Depth (mm)", "Độ sâu (mm)")}
            value={line.depth}
            min={0.2}
            max={10}
            onChange={(depth) => set({ depth })}
          />
        )}
      </Group>
      <N
        label={l(
          "Gap before this line (mm)",
          "Khoảng cách trước dòng này (mm)",
        )}
        value={line.lineGap ?? 2}
        min={-20}
        max={50}
        onChange={(lineGap) => set({ lineGap })}
      />
      <Group title={l("Layout and curve", "Bố trí và uốn cong")}>
        <div className="ps-two">
          <N label="X (mm)" value={line.x} onChange={(x) => set({ x })} />
          <N label="Y (mm)" value={line.y} onChange={(y) => set({ y })} />
        </div>
        <N
          label={l("Angle (°)", "Góc xoay (°)")}
          value={line.angle}
          step={1}
          min={-360}
          max={360}
          onChange={(angle) => set({ angle })}
        />
        <S
          label={l("Alignment", "Căn lề")}
          value={line.align}
          onChange={(align) => set({ align: align as TextLine["align"] })}
          options={[
            ["left", l("Left", "Trái")],
            ["center", l("Centre", "Giữa")],
            ["right", l("Right", "Phải")],
            ["manual", l("Manual (drag)", "Thủ công (kéo)")],
          ]}
        />
        <div
          className="ps-art-drag"
          role="slider"
          tabIndex={0}
          aria-label={l("Text XY position", "Vị trí XY của chữ")}
          aria-valuetext={`${line.x}, ${line.y}`}
          onKeyDown={(e) => {
            if (
              ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                e.key,
              )
            ) {
              e.preventDefault();
              set({
                align: "manual",
                x:
                  line.x +
                  (e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0),
                y:
                  line.y +
                  (e.key === "ArrowDown" ? -1 : e.key === "ArrowUp" ? 1 : 0),
              });
            }
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              ox: line.x,
              oy: line.y,
            };
          }}
          onPointerMove={(e) => {
            if (drag.current)
              set({
                align: "manual",
                x:
                  Math.round(
                    (drag.current.ox + (e.clientX - drag.current.x) / 2) * 10,
                  ) / 10,
                y:
                  Math.round(
                    (drag.current.oy - (e.clientY - drag.current.y) / 2) * 10,
                  ) / 10,
              });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          <span
            style={{ transform: `translate(${line.x * 2}px,${-line.y * 2}px)` }}
          >
            ✥
          </span>
        </div>
        <S
          label={l("Curve", "Uốn cong")}
          value={line.curve}
          onChange={(curve) => set({ curve: curve as TextLine["curve"] })}
          options={[
            ["straight", l("Straight", "Thẳng")],
            ["top", l("Top arc", "Cung trên")],
            ["bottom", l("Bottom arc", "Cung dưới")],
          ]}
        />
        {line.curve !== "straight" && (
          <N
            label={l("Radius (mm)", "Bán kính (mm)")}
            value={line.radius}
            min={5}
            max={300}
            onChange={(radius) => set({ radius })}
          />
        )}
      </Group>
      <Group title={l("Font library and uploads", "Thư viện và nhập phông")}>
        <T
          label={l("Search Google Fonts", "Tìm Google Fonts")}
          value={fontQuery}
          onChange={setFontQuery}
        />
        <p className="ps-note">
          {catalog?.fonts.length ?? 0}{" "}
          {l(
            "fonts • downloaded fonts and licences are included in backups.",
            "phông • bản sao lưu chứa cả phông đã tải và giấy phép.",
          )}
        </p>
        <div className="ps-font-list">
          {catalog?.fonts
            .filter(
              (f) =>
                fontQuery &&
                f.label.toLowerCase().includes(fontQuery.toLowerCase()),
            )
            .slice(0, 60)
            .map((f) => (
              <button
                key={f.path}
                disabled={!!busy}
                onClick={() => void getFont(f.path)}
              >
                {f.label}
              </button>
            ))}
        </div>
        {busy && (
          <p role="status">
            {busy.includes("/")
              ? l("Downloading font…", "Đang tải phông…")
              : busy}
          </p>
        )}
        {fontError && <p role="alert">{fontError}</p>}
        <label className="ps-upload">
          {l("Import TTF / OTF", "Nhập TTF / OTF")}
          <input
            type="file"
            accept=".ttf,.otf"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 20 * 1024 * 1024) throw new Error();
                const data = new Uint8Array(await file.arrayBuffer());
                if (!alive.current) return;
                registerMakerFont(`custom:${file.name}`, data);
                onAssets([
                  ...assets.filter((a) => a.name !== file.name),
                  { name: file.name, data },
                ]);
                set({ font: `custom:${file.name}` });
              } catch {
                setBusy(
                  l(
                    "This font could not be read.",
                    "Không đọc được phông này.",
                  ),
                );
              }
              e.target.value = "";
            }}
          />
        </label>
      </Group>
    </>
  );
}
