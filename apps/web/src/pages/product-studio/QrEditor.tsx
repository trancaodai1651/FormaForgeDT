import { useEffect, useRef, useState } from "react";
import type { QRData } from "./model";
import { defaultQR } from "./model";
import { qrMatrix, qrSvg, qrContent, scanQrImage, paymentInfo } from "./qr";
import { rasterPixels } from "./artwork";
import { downloadFile } from "../../lib/downloadFile";
import {
  TextField as T,
  NumberField as N,
  SelectField as S,
  ColorField as C,
  Toggle,
  Group,
  type L,
} from "./controls";
export function QrEditor({
  codes,
  onChange,
  l,
}: {
  codes: QRData[];
  onChange: (v: QRData[]) => void;
  l: L;
}) {
  const [active, setActive] = useState(0),
    [notice, setNotice] = useState(""),
    [camera, setCamera] = useState(false),
    [starting, setStarting] = useState(false),
    alive = useRef(true),
    video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null);
  const selected = Math.max(0, Math.min(active, codes.length - 1)),
    q = codes[selected] ?? defaultQR(),
    set = (patch: Partial<QRData>) =>
      onChange(
        codes.length
          ? codes.map((v, i) => (i === selected ? { ...v, ...patch } : v))
          : [{ ...q, ...patch }],
      );
  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera(false);
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (camera && video.current && stream.current) {
      video.current.srcObject = stream.current;
      void video.current.play();
    }
  }, [camera]);
  const decode = async (file: File) => {
    try {
      const image = await rasterPixels(file),
        content = scanQrImage(image.data, image.width, image.height);
      set({ content, kind: "text" });
      setNotice(
        l(
          "QR imported. Review its content below.",
          "Đã nhập QR. Kiểm tra nội dung bên dưới.",
        ),
      );
    } catch {
      setNotice(
        l("No readable QR code found.", "Không tìm thấy mã QR đọc được."),
      );
    }
  };
  let svg = "",
    modules = 0;
  try {
    svg = qrSvg(q);
    modules = qrMatrix(q).size;
  } catch {
    /* show editable invalid inputs without crashing */
  }
  const payment = paymentInfo(q.content);
  return (
    <>
      <S
        label={l("Printed face", "Mặt in mã")}
        value={q.side ?? "front"}
        onChange={(side) => set({ side: side as QRData["side"] })}
        options={[
          ["front", l("Front", "Mặt trước")],
          ["back", l("Back", "Mặt sau")],
          ["both", l("Same code on both faces", "Cùng mã trên hai mặt")],
        ]}
      />
      <p className="ps-note">
        {l(
          "Add a second code and choose Back for different content on the reverse. Raised reverse codes require supports; flush codes keep a flat printing base.",
          "Thêm mã thứ hai và chọn Mặt sau để dùng nội dung khác ở mặt sau. Mã nổi mặt sau cần hỗ trợ khi in; mã đồng mức giữ đáy in phẳng.",
        )}
      </p>
      <div className="ps-line-tabs">
        {codes.map((_, i) => (
          <button
            key={i}
            aria-pressed={i === active}
            onClick={() => setActive(i)}
          >
            QR {i + 1}
          </button>
        ))}
        {codes.length < 12 && (
          <button
            onClick={() => {
              onChange([...codes, defaultQR()]);
              setActive(codes.length);
            }}
          >
            +
          </button>
        )}
      </div>
      {codes.length > 1 && (
        <button
          className="ps-danger"
          onClick={() => {
            onChange(codes.filter((_, i) => i !== active));
            setActive(0);
          }}
        >
          {l("Remove this code", "Xóa mã này")}
        </button>
      )}
      {svg && (
        <img
          className="ps-qr-preview"
          src={"data:image/svg+xml," + encodeURIComponent(svg)}
          alt={l("QR preview", "Xem trước mã QR")}
        />
      )}
      <S
        label={l("Code content", "Nội dung mã")}
        value={q.kind}
        onChange={(kind) => set({ kind: kind as QRData["kind"] })}
        options={[
          [
            "text",
            l("Text / link / payment QR", "Văn bản / liên kết / QR thanh toán"),
          ],
          ["wifi", "Wi-Fi"],
          ["phone", l("Phone number", "Số điện thoại")],
          ["sms", "SMS"],
          ["email", "Email"],
          ["contact", "vCard"],
        ]}
      />
      {q.kind === "text" && (
        <T
          label={l("Text or URL", "Văn bản hoặc URL")}
          value={q.content}
          onChange={(content) => set({ content })}
        />
      )}
      {q.kind === "wifi" && (
        <>
          <T label="SSID" value={q.ssid} onChange={(ssid) => set({ ssid })} />
          <T
            label={l("Password", "Mật khẩu")}
            value={q.password}
            onChange={(password) => set({ password })}
            type="password"
          />
          <S
            label={l("Security", "Bảo mật")}
            value={q.security}
            onChange={(security) => set({ security })}
            options={[
              ["WPA", "WPA / WPA2"],
              ["WEP", "WEP"],
              ["nopass", l("Open network", "Mạng mở")],
            ]}
          />
          <Toggle
            label={l("Hidden network", "Mạng ẩn")}
            value={q.hidden}
            onChange={(hidden) => set({ hidden })}
          />
        </>
      )}
      {["phone", "sms", "contact"].includes(q.kind) && (
        <T
          label={l("Phone", "Điện thoại")}
          value={q.phone}
          onChange={(phone) => set({ phone })}
        />
      )}
      {["sms", "email"].includes(q.kind) && (
        <T
          label={l("Message", "Tin nhắn")}
          value={q.message}
          onChange={(message) => set({ message })}
        />
      )}
      {["email", "contact"].includes(q.kind) && (
        <T label="Email" value={q.email} onChange={(email) => set({ email })} />
      )}
      {q.kind === "email" && (
        <T
          label={l("Subject", "Tiêu đề")}
          value={q.subject}
          onChange={(subject) => set({ subject })}
        />
      )}
      {q.kind === "contact" && (
        <>
          <T
            label={l("Contact name", "Tên liên hệ")}
            value={q.contactName}
            onChange={(contactName) => set({ contactName })}
          />
          <T
            label={l("Company", "Công ty")}
            value={q.company}
            onChange={(company) => set({ company })}
          />
          <T label="Website" value={q.url} onChange={(url) => set({ url })} />
          <T
            label={l("Address", "Địa chỉ")}
            value={q.address}
            onChange={(address) => set({ address })}
          />
        </>
      )}
      <div className="ps-two">
        <N label="X (mm)" value={q.x} onChange={(x) => set({ x })} />
        <N label="Y (mm)" value={q.y} onChange={(y) => set({ y })} />
      </div>
      <p className="ps-note">
        {l(
          "XY positions apply when automatic code layout is off.",
          "Vị trí XY được dùng khi tắt tự bố trí mã.",
        )}
      </p>
      <T
        label={l("Caption", "Chú thích")}
        value={q.caption}
        onChange={(caption) => set({ caption })}
      />
      <Group title={l("Size, colour and print", "Kích thước, màu và in")} open>
        <S
          label={l("Size mode", "Cách tính kích thước")}
          value={q.sizing}
          onChange={(sizing) => set({ sizing: sizing as QRData["sizing"] })}
          options={[
            ["module", l("Fixed module size", "Cố định cỡ ô mã")],
            ["fixed", l("Fixed printed size", "Cố định cỡ in")],
          ]}
        />
        {q.sizing === "module" ? (
          <N
            label={l("Module size (mm)", "Cỡ ô mã (mm)")}
            value={q.module}
            min={0.35}
            max={5}
            step={0.05}
            onChange={(module) => set({ module })}
          />
        ) : (
          <N
            label={l(
              "Printed size incl. quiet zone (mm)",
              "Cỡ in gồm vùng trống (mm)",
            )}
            value={q.size}
            min={15}
            max={200}
            onChange={(size) => set({ size })}
          />
        )}
        <p className="ps-note">
          {modules} × {modules}{" "}
          {l("modules • 4-module quiet zone", "ô mã • vùng trống 4 ô")}
        </p>
        <S
          label={l("Error correction", "Khả năng sửa lỗi")}
          value={q.ecc}
          onChange={(ecc) => set({ ecc: ecc as QRData["ecc"] })}
          options={["L", "M", "Q", "H"].map((v) => [v, v])}
        />
        <Toggle
          label={l(
            "Centre logo (first artwork, H correction)",
            "Logo giữa mã (ảnh đầu tiên, sửa lỗi H)",
          )}
          value={q.logo}
          onChange={(logo) => set({ logo })}
        />
        <S
          label={l("Print style", "Kiểu in")}
          value={q.style}
          onChange={(style) => set({ style: style as QRData["style"] })}
          options={[
            ["raised", l("Raised", "Nổi")],
            ["flush", l("Flat colour", "Màu đồng mặt")],
            ["engraved", l("Engraved", "Khắc chìm")],
          ]}
        />
        <N
          label={l("Module rise (mm)", "Độ nổi ô mã (mm)")}
          value={q.height}
          min={0.2}
          max={3}
          onChange={(height) => set({ height })}
        />
        <C
          label={l("Dark modules", "Màu ô mã")}
          value={q.color}
          onChange={(color) => set({ color })}
        />
        <C
          label={l("Light background", "Nền sáng")}
          value={q.tileColor}
          onChange={(tileColor) => set({ tileColor })}
        />
      </Group>
      <Group title={l("Import and inspect", "Nhập và kiểm tra")}>
        <label className="ps-upload">
          {l("Read QR from image", "Đọc QR từ ảnh")}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files?.[0]) void decode(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </label>
        <button
          disabled={camera || starting}
          onClick={async () => {
            setStarting(true);
            try {
              const media = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
              });
              if (!alive.current) {
                media.getTracks().forEach((t) => t.stop());
                return;
              }
              stream.current = media;
              setCamera(true);
            } catch {
              setNotice(
                l(
                  "Camera unavailable. Import an image instead.",
                  "Không mở được camera. Hãy nhập ảnh.",
                ),
              );
            } finally {
              if (alive.current) setStarting(false);
            }
          }}
        >
          {l("Open camera scanner", "Mở camera quét mã")}
        </button>
        {camera && (
          <>
            <video ref={video} playsInline muted className="ps-camera" />
            <button
              onClick={() => {
                const v = video.current;
                if (!v) return;
                if (!v.videoWidth || !v.videoHeight) {
                  setNotice(l("Camera is starting…", "Camera đang khởi động…"));
                  return;
                }
                const c = document.createElement("canvas");
                c.width = v.videoWidth;
                c.height = v.videoHeight;
                const ctx = c.getContext("2d")!;
                ctx.drawImage(v, 0, 0);
                try {
                  set({
                    content: scanQrImage(
                      ctx.getImageData(0, 0, c.width, c.height).data,
                      c.width,
                      c.height,
                    ),
                    kind: "text",
                  });
                  stop();
                  setNotice(l("QR decoded.", "Đã đọc mã QR."));
                } catch {
                  setNotice(
                    l(
                      "Move closer and try again.",
                      "Đưa gần mã hơn và thử lại.",
                    ),
                  );
                }
              }}
            >
              {l("Read current frame", "Đọc khung hình hiện tại")}
            </button>
            <button onClick={stop}>{l("Stop camera", "Tắt camera")}</button>
          </>
        )}
        <button
          disabled={!svg}
          onClick={() =>
            void downloadFile(
              new Blob([svg], { type: "image/svg+xml" }),
              "qr-code.svg",
            )
          }
        >
          {l("Download QR SVG", "Tải SVG mã QR")}
        </button>
        <pre className="ps-payload">
          {(() => {
            try {
              return qrContent(q);
            } catch {
              return "";
            }
          })()}
        </pre>
        {payment.payment && (
          <dl>
            {[
              [l("Recipient / merchant", "Người nhận / đơn vị"), payment.name],
              [l("City", "Thành phố"), payment.city],
              [l("Country", "Quốc gia"), payment.country],
            ].map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>
                  {value ||
                    l("Not included in the code", "Mã không có thông tin này")}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {notice && <p role="status">{notice}</p>}
      </Group>
    </>
  );
}
