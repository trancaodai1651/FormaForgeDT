import { useState, useRef, useEffect } from "react";
import type { Artwork, ArtRegion } from "./model";
import type { AssetFile } from "../parametric-model-maker/model";
import {
  svgArtwork,
  rasterArtwork,
  artSvg,
  IMAGE_DEFAULTS,
  STARTER_ART,
  type ImageOptions,
} from "./artwork";
import { downloadFile } from "../../lib/downloadFile";
import { ImageCropView } from "./ImageCropView";
import {
  NumberField as N,
  SelectField as S,
  ColorField as C,
  Toggle,
  Group,
  type L,
} from "./controls";
export function ArtworkEditor({
  artworks,
  onChange,
  assets,
  onAssets,
  l,
}: {
  artworks: Artwork[];
  onChange: (v: Artwork[]) => void;
  assets: AssetFile[];
  onAssets: (v: AssetFile[]) => void;
  l: L;
}) {
  const [active, setActive] = useState(0),
    [regionId, setRegion] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [replaceId, setReplaceId] = useState(""),
    [options, setOptions] = useState(IMAGE_DEFAULTS),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState("");
  const [zoom, setZoom] = useState(1);
  const art = artworks[active],
    alive = useRef(true),
    selected = art?.regions.find((r) => r.id === regionId),
    drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
      null,
    );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const set = (patch: Partial<Artwork>) =>
    onChange(artworks.map((v, i) => (i === active ? { ...v, ...patch } : v)));
  const setR = (patch: Partial<ArtRegion>) => {
    if (art)
      set({
        regions: art.regions.map((r) =>
          r.id === regionId ? { ...r, ...patch } : r,
        ),
      });
  };
  const add = (a: Artwork) => {
    if (artworks.length >= 6) return;
    onChange([...artworks, a]);
    setActive(artworks.length);
    setRegion(a.regions[0]?.id ?? "");
  };
  const importFile = async (f: File) => {
    setError("");
    setReplaceId("");
    if (f.size > 20 * 1024 * 1024) {
      setError(l("Maximum image size is 20 MB.", "Ảnh tối đa 20 MB."));
      return;
    }
    if (/\.svg$/i.test(f.name)) {
      try {
        const data = new Uint8Array(await f.arrayBuffer());
        if (!alive.current) return;
        add(svgArtwork(new TextDecoder().decode(data), f.name));
        onAssets([
          ...assets.filter((a) => a.name !== f.name),
          { name: f.name, data },
        ]);
      } catch {
        setError(
          l(
            "This SVG has no supported filled shapes.",
            "SVG này không có hình tô kín được hỗ trợ.",
          ),
        );
      }
    } else {
      setFile(f);
      setOptions(IMAGE_DEFAULTS);
    }
  };
  return (
    <>
      <p className="ps-note">
        {l(
          "Up to 6 images or SVGs. Select a region to edit its colour and height.",
          "Tối đa 6 ảnh hoặc SVG. Chọn từng vùng để đổi màu và độ cao.",
        )}
      </p>
      <label className="ps-upload">
        {l("Add image / SVG", "Thêm ảnh / SVG")}
        <input
          disabled={artworks.length >= 6}
          type="file"
          accept="image/*,.svg"
          onChange={(e) => {
            if (e.target.files?.[0]) void importFile(e.target.files[0]);
            e.target.value = "";
          }}
        />
      </label>
      <div className="ps-two">
        {STARTER_ART.map((s, i) => (
          <button
            disabled={artworks.length >= 6}
            key={i}
            onClick={() => add(svgArtwork(s.svg, l(s.name[0], s.name[1])))}
          >
            {l(s.name[0], s.name[1])}
          </button>
        ))}
      </div>
      {file && (
        <Group
          title={l("Crop and trace image", "Cắt và chuyển ảnh thành vùng")}
          open
        >
          <ImageCropView
            src={preview}
            options={options}
            onChange={setOptions}
            l={l}
          />
          <div className="ps-two">
            <button onClick={() => setOptions({ ...IMAGE_DEFAULTS })}>
              {l(
                "Reset crop and adjustments",
                "Đặt lại vùng cắt và hiệu chỉnh",
              )}
            </button>
            <button
              onClick={() =>
                setOptions((o) => ({
                  ...o,
                  rotation: o.rotation === 180 ? -90 : o.rotation + 90,
                }))
              }
            >
              {l("Rotate 90°", "Xoay 90°")}
            </button>
          </div>
          <div className="ps-two">
            {(
              [
                "X (%)",
                "Y (%)",
                l("Crop width (%)", "Rộng vùng cắt (%)"),
                l("Crop height (%)", "Cao vùng cắt (%)"),
              ] as string[]
            ).map((label, i) => (
              <N
                key={i}
                label={label}
                value={options.crop[i]}
                min={i > 1 ? 1 : 0}
                max={i > 1 ? 100 - options.crop[i - 2] : 99}
                step={1}
                onChange={(v) =>
                  setOptions((o) => ({
                    ...o,
                    crop: (() => {
                      const crop = [...o.crop] as ImageOptions["crop"];
                      crop[i] = v;
                      crop[2] = Math.min(crop[2], 100 - crop[0]);
                      crop[3] = Math.min(crop[3], 100 - crop[1]);
                      return crop;
                    })(),
                  }))
                }
              />
            ))}
          </div>
          <S
            label={l("Crop shape", "Hình vùng cắt")}
            value={options.cropShape}
            options={[
              ["rectangle", l("Rectangle", "Chữ nhật")],
              ["ellipse", l("Ellipse", "Elip")],
              ["circle", l("Circle", "Tròn")],
            ]}
            onChange={(cropShape) =>
              setOptions((o) => ({
                ...o,
                cropShape: cropShape as ImageOptions["cropShape"],
              }))
            }
          />
          <div className="ps-two">
            <N
              label={l("Rotation (°)", "Xoay (°)")}
              value={options.rotation}
              min={-180}
              max={180}
              step={1}
              onChange={(rotation) => setOptions((o) => ({ ...o, rotation }))}
            />
            <N
              label={l("Colours", "Số màu")}
              value={options.colors}
              min={1}
              max={16}
              step={1}
              onChange={(colors) => setOptions((o) => ({ ...o, colors }))}
            />
          </div>
          <N
            label={l("Brightness", "Độ sáng")}
            value={options.brightness}
            min={0.1}
            max={3}
            onChange={(brightness) => setOptions((o) => ({ ...o, brightness }))}
          />
          <N
            label={l("Saturation", "Độ bão hòa")}
            value={options.saturation}
            min={0}
            max={3}
            onChange={(saturation) => setOptions((o) => ({ ...o, saturation }))}
          />
          <N
            label={l(
              "Ignore specks below (pixels)",
              "Bỏ chi tiết nhỏ hơn (pixel)",
            )}
            value={options.noise}
            min={0}
            max={500}
            step={1}
            onChange={(noise) => setOptions((o) => ({ ...o, noise }))}
          />
          <N
            label={l("Crop corner radius (%)", "Bo góc vùng cắt (%)")}
            value={options.cropRadius}
            min={0}
            max={50}
            step={1}
            onChange={(cropRadius) => setOptions((o) => ({ ...o, cropRadius }))}
          />
          <N
            label={l("Contrast", "Tương phản")}
            value={options.contrast}
            min={0.1}
            max={3}
            onChange={(contrast) => setOptions((o) => ({ ...o, contrast }))}
          />
          <N
            label={l(
              "Black/white threshold (0 = colour)",
              "Ngưỡng đen trắng (0 = giữ màu)",
            )}
            value={options.threshold}
            min={0}
            max={255}
            step={1}
            onChange={(threshold) => setOptions((o) => ({ ...o, threshold }))}
          />
          <N
            label={l("Contour smoothing", "Làm mịn đường viền")}
            value={options.smoothing}
            min={0}
            max={1}
            step={0.05}
            onChange={(smoothing) => setOptions((o) => ({ ...o, smoothing }))}
          />
          <Toggle
            label={l("Remove background", "Xóa nền")}
            value={options.removeBg}
            onChange={(removeBg) => setOptions((o) => ({ ...o, removeBg }))}
          />
          <Toggle
            label={l("Flip horizontally", "Lật ngang")}
            value={options.flip}
            onChange={(flip) => setOptions((o) => ({ ...o, flip }))}
          />
          <Toggle
            label={l("Flip vertically", "Lật dọc")}
            value={!!options.flipY}
            onChange={(flipY) => setOptions((o) => ({ ...o, flipY }))}
          />
          <button
            disabled={busy}
            className="ps-primary"
            onClick={async () => {
              setBusy(true);
              try {
                const [processed, data] = await Promise.all([
                    rasterArtwork(file, options),
                    file.arrayBuffer().then((v) => new Uint8Array(v)),
                  ]),
                  old = artworks.find((a) => a.id === replaceId);
                if (!alive.current) return;
                if (old)
                  onChange(
                    artworks.map((a) =>
                      a.id === replaceId
                        ? {
                            ...old,
                            regions: processed.regions,
                            processing: processed.processing,
                          }
                        : a,
                    ),
                  );
                else add(processed);
                onAssets([
                  ...assets.filter((a) => a.name !== file.name),
                  {
                    name: file.name,
                    data,
                  },
                ]);
                setFile(null);
                setReplaceId("");
              } catch {
                setError(
                  l(
                    "Could not trace this image. Adjust the crop or background.",
                    "Không chuyển được ảnh. Hãy chỉnh vùng cắt hoặc nền.",
                  ),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy
              ? l("Tracing…", "Đang chuyển ảnh…")
              : l("Apply and trace", "Áp dụng và chuyển ảnh")}
          </button>
          <button onClick={() => setFile(null)}>{l("Cancel", "Hủy")}</button>
        </Group>
      )}
      <div className="ps-art-tabs">
        {artworks.map((a, i) => (
          <button
            key={a.id}
            aria-pressed={i === active}
            onClick={() => {
              setActive(i);
              setRegion(a.regions[0]?.id ?? "");
            }}
          >
            {a.name}
          </button>
        ))}
      </div>
      {art && (
        <>
          {assets.some((a) => a.name === art.name) && !art.source && (
            <button
              onClick={() => {
                const original = assets.find((a) => a.name === art.name)!;
                setReplaceId(art.id);
                setFile(new File([original.data as BlobPart], art.name));
                setOptions(art.processing ?? IMAGE_DEFAULTS);
              }}
            >
              {l(
                "Edit crop / re-trace original",
                "Sửa vùng cắt / chuyển lại ảnh gốc",
              )}
            </button>
          )}
          <svg
            className="ps-art-preview"
            viewBox={`${-0.6 / zoom} ${-0.6 / zoom} ${1.2 / zoom} ${1.2 / zoom}`}
            aria-label={l("Select artwork region", "Chọn vùng ảnh")}
          >
            <g transform="scale(1,-1)">
              {art.regions
                .filter((r) => r.enabled)
                .map((r) => (
                  <path
                    key={r.id}
                    fill={r.color}
                    fillRule="evenodd"
                    stroke={r.id === regionId ? "var(--accent)" : "transparent"}
                    strokeWidth={0.008}
                    d={r.rings
                      .map(
                        (r) => "M" + r.map((p) => p.join(",")).join("L") + "Z",
                      )
                      .join("")}
                    onClick={() => setRegion(r.id)}
                  />
                ))}
            </g>
          </svg>
          <div className="ps-two">
            <button
              aria-label={l("Zoom artwork out", "Thu nhỏ ảnh")}
              onClick={() => setZoom((v) => Math.max(0.5, v / 1.5))}
            >
              −
            </button>
            <button
              aria-label={l("Zoom artwork in", "Phóng to ảnh")}
              onClick={() => setZoom((v) => Math.min(12, v * 1.5))}
            >
              +
            </button>
            <button onClick={() => setZoom(1)}>
              {l("Fit artwork", "Vừa ảnh")}
            </button>
          </div>
          <p className="ps-note">
            {l(
              "Drag the handle to place the artwork in the plate XY plane.",
              "Kéo vùng bên dưới để đặt ảnh trên mặt phẳng XY của nền.",
            )}
          </p>
          <div
            className="ps-art-drag"
            role="slider"
            tabIndex={0}
            aria-label={l("Artwork XY position", "Vị trí XY của ảnh")}
            aria-valuetext={`${art.x}, ${art.y}`}
            onKeyDown={(e) => {
              if (
                ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  e.key,
                )
              ) {
                e.preventDefault();
                set({
                  x:
                    art.x +
                    (e.key === "ArrowLeft"
                      ? -1
                      : e.key === "ArrowRight"
                        ? 1
                        : 0),
                  y:
                    art.y +
                    (e.key === "ArrowDown" ? -1 : e.key === "ArrowUp" ? 1 : 0),
                });
              }
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                ox: art.x,
                oy: art.y,
              };
            }}
            onPointerMove={(e) => {
              if (drag.current)
                set({
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
              style={{ transform: `translate(${art.x * 2}px,${-art.y * 2}px)` }}
            >
              ✥
            </span>
          </div>
          <div className="ps-two">
            <N
              label={l("Size (mm)", "Kích thước (mm)")}
              value={art.size}
              min={1}
              max={300}
              onChange={(size) => set({ size })}
            />
            <N
              label={l("Angle (°)", "Góc (°)")}
              value={art.angle}
              min={-360}
              max={360}
              step={1}
              onChange={(angle) => set({ angle })}
            />
            <N label="X (mm)" value={art.x} onChange={(x) => set({ x })} />
            <N label="Y (mm)" value={art.y} onChange={(y) => set({ y })} />
          </div>
          <S
            label={l("Side", "Mặt")}
            value={art.side}
            onChange={(side) => set({ side: side as Artwork["side"] })}
            options={[
              ["front", l("Front", "Trước")],
              ["back", l("Reverse", "Sau")],
            ]}
          />
          <Toggle
            label={l("Solid backing under artwork", "Nền đặc dưới ảnh")}
            value={!!art.backing}
            onChange={(backing) => set({ backing })}
          />
          {art.backing && (
            <N
              label={l("Backing margin (mm)", "Lề nền ảnh (mm)")}
              value={art.margin ?? 1.5}
              min={0.5}
              max={10}
              onChange={(margin) => set({ margin })}
            />
          )}
          <Toggle
            label={l("Mirror artwork", "Lật ảnh")}
            value={art.mirror}
            onChange={(mirror) => set({ mirror })}
          />
          <S
            label={l("Relief", "Độ nổi")}
            value={art.style}
            onChange={(style) => set({ style: style as Artwork["style"] })}
            options={[
              ["raised", l("Raised", "Nổi")],
              ["engraved", l("Engraved", "Khắc chìm")],
              ["flush", l("Flat colour", "Màu đồng mặt")],
            ]}
          />
          <N
            label={l("Engraving / inlay depth (mm)", "Sâu khắc / cấy màu (mm)")}
            value={art.depth}
            min={0.2}
            max={10}
            onChange={(depth) => set({ depth })}
          />
          <div className="ps-regions">
            {art.regions.map((r, i) => (
              <button
                key={r.id}
                aria-pressed={r.id === regionId}
                style={{
                  borderLeft: `8px solid ${r.color}`,
                  opacity: r.enabled ? 1 : 0.5,
                }}
                onClick={() => setRegion(r.id)}
              >
                {l("Region", "Vùng")} {i + 1} · {r.height} mm
              </button>
            ))}
          </div>
          {selected && (
            <Group title={l("Selected region", "Vùng đang chọn")} open>
              <C
                label={l("Region colour", "Màu vùng")}
                value={selected.color}
                onChange={(color) => setR({ color })}
              />
              <N
                label={l("Region rise (0 = omit)", "Độ nổi vùng (0 = bỏ)")}
                value={selected.height}
                min={0}
                max={20}
                onChange={(height) => setR({ height })}
              />
              <Toggle
                label={l("Include region", "Dùng vùng này")}
                value={selected.enabled}
                onChange={(enabled) => setR({ enabled })}
              />
            </Group>
          )}
          <button
            onClick={() =>
              void downloadFile(
                new Blob([artSvg(art)], { type: "image/svg+xml" }),
                art.name.replace(/\.[^.]+$/, "") + ".svg",
              )
            }
          >
            {l("Download edited SVG", "Tải SVG đã sửa")}
          </button>
          <button
            className="ps-danger"
            onClick={() => {
              onChange(artworks.filter((_, i) => i !== active));
              setActive(0);
            }}
          >
            {l("Remove artwork", "Xóa ảnh")}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="ps-error">
          {error}
        </p>
      )}
    </>
  );
}
