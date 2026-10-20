import { useRef } from "react";
import type { ImageOptions } from "./artwork";
import type { L } from "./controls";
export function ImageCropView({
  src,
  options,
  onChange,
  l,
}: {
  src: string;
  options: ImageOptions;
  onChange: (v: ImageOptions) => void;
  l: L;
}) {
  const host = useRef<HTMLDivElement>(null),
    drag = useRef<{
      x: number;
      y: number;
      crop: ImageOptions["crop"];
      resize: boolean;
    } | null>(null);
  const [x, y, w, h] = options.crop;
  return (
    <div className="ps-crop-view" ref={host}>
      <img
        src={src}
        alt={l(
          "Drag crop area or resize its corner",
          "Kéo vùng cắt hoặc kéo góc để đổi cỡ",
        )}
        draggable={false}
      />
      <div
        className="ps-crop-box"
        role="group"
        aria-label={l("Crop selection", "Vùng ảnh được cắt")}
        style={{
          left: `${x}%`,
          top: `${y}%`,
          width: `${w}%`,
          height: `${h}%`,
          borderRadius:
            options.cropShape === "rectangle"
              ? `${options.cropRadius}%`
              : "50%",
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            crop: [...options.crop],
            resize: (e.target as HTMLElement).dataset.resize === "true",
          };
        }}
        onPointerMove={(e) => {
          if (!drag.current || !host.current) return;
          const d = drag.current,
            b = host.current.getBoundingClientRect(),
            dx = ((e.clientX - d.x) / b.width) * 100,
            dy = ((e.clientY - d.y) / b.height) * 100,
            [cx, cy, cw, ch] = d.crop;
          const crop: ImageOptions["crop"] = d.resize
            ? [
                cx,
                cy,
                Math.max(1, Math.min(100 - cx, cw + dx)),
                Math.max(1, Math.min(100 - cy, ch + dy)),
              ]
            : [
                Math.max(0, Math.min(100 - cw, cx + dx)),
                Math.max(0, Math.min(100 - ch, cy + dy)),
                cw,
                ch,
              ];
          onChange({ ...options, crop });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <span className="ps-crop-corner" data-resize="true">
          ↘
        </span>
      </div>
    </div>
  );
}
