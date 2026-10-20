import QRCode from "qrcode";
import jsQR from "jsqr";
import type { QRData, Ring } from "./model";
const wifiEscape = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
const vcardEscape = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/([;,])/g, "\\$1");
export function qrContent(q: QRData): string {
  switch (q.kind) {
    case "wifi":
      return `WIFI:T:${q.security};S:${wifiEscape(q.ssid)};P:${wifiEscape(q.password)};H:${q.hidden};;`;
    case "phone":
      return `tel:${q.phone}`;
    case "sms":
      return `SMSTO:${q.phone}:${q.message}`;
    case "email":
      return `mailto:${q.email}?subject=${encodeURIComponent(q.subject)}&body=${encodeURIComponent(q.message)}`;
    case "contact":
      return [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${vcardEscape(q.contactName)}`,
        `ORG:${vcardEscape(q.company)}`,
        `TEL:${vcardEscape(q.phone)}`,
        `EMAIL:${vcardEscape(q.email)}`,
        `URL:${vcardEscape(q.url)}`,
        `ADR:;;${vcardEscape(q.address)};;;;`,
        "END:VCARD",
      ].join("\r\n");
    default:
      return q.content;
  }
}
export function qrMatrix(q: QRData) {
  const content = qrContent(q);
  if (!content.trim()) throw new Error("QR_EMPTY");
  const code = QRCode.create(content, {
    errorCorrectionLevel: q.logo ? "H" : q.ecc,
  });
  return {
    size: code.modules.size,
    data: Array.from(code.modules.data),
    content,
  };
}
export function qrRings(q: QRData): {
  rings: Ring[];
  size: number;
  module: number;
} {
  const code = qrMatrix(q),
    quiet = 4,
    mod = q.sizing === "fixed" ? q.size / (code.size + quiet * 2) : q.module;
  if (mod < 0.35) throw new Error("QR_TOO_SMALL");
  const rings: Ring[] = [];
  const half = code.size / 2,
    logoHalf = q.logo ? Math.floor(code.size * 0.1) : 0;
  for (let row = 0; row < code.size; row++) {
    let col = 0;
    while (col < code.size) {
      const dark = (x: number) =>
        code.data[row * code.size + x] &&
        !(
          q.logo &&
          Math.abs(row - half) < logoHalf &&
          Math.abs(x - half) < logoHalf
        );
      if (!dark(col)) {
        col++;
        continue;
      }
      const start = col;
      while (col < code.size && dark(col)) col++;
      const x0 = (start - half) * mod,
        x1 = (col - half) * mod,
        y0 = (half - row - 1) * mod,
        y1 = (half - row) * mod;
      rings.push([
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ]);
    }
  }
  return { rings, size: (code.size + quiet * 2) * mod, module: mod };
}
export function scanQrImage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const result = jsQR(data, width, height, {
    inversionAttempts: "attemptBoth",
  });
  if (!result) throw new Error("QR_NOT_FOUND");
  return result.data;
}
export function qrSvg(q: QRData) {
  const { size, data } = qrMatrix(q),
    n = size + 8;
  const half = size / 2,
    logoHalf = q.logo ? Math.floor(size * 0.1) : 0;
  const path = data
    .flatMap((v, i) =>
      v &&
      !(
        q.logo &&
        Math.abs(Math.floor(i / size) - half) < logoHalf &&
        Math.abs((i % size) - half) < logoHalf
      )
        ? [`M${(i % size) + 4} ${Math.floor(i / size) + 4}h1v1h-1z`]
        : [],
    )
    .join("");
  const color = /^#[0-9a-f]{6}$/i.test(q.color) ? q.color : "#000000",
    tile = /^#[0-9a-f]{6}$/i.test(q.tileColor) ? q.tileColor : "#FFFFFF";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}"><rect width="${n}" height="${n}" fill="${tile}"/><path d="${path}" fill="${color}"/></svg>`;
}
export function paymentInfo(content: string): {
  name?: string;
  city?: string;
  country?: string;
  payment: boolean;
} {
  const fields: Record<string, string> = {};
  let at = 0;
  while (at + 4 <= content.length) {
    const id = content.slice(at, at + 2),
      n = Number(content.slice(at + 2, at + 4));
    if (
      !/^\d{2}$/.test(id) ||
      !Number.isFinite(n) ||
      at + 4 + n > content.length
    )
      break;
    fields[id] = content.slice(at + 4, at + 4 + n);
    at += 4 + n;
  }
  return {
    payment: fields["00"] === "01" && !!fields["53"],
    name: fields["59"],
    city: fields["60"],
    country: fields["58"],
  };
}
