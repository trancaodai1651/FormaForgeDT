import type { AssetFile, PartMesh } from "../parametric-model-maker/model";
import type { ImageOptions } from "./artwork";
export type Language = "en" | "vi";
export type Bilingual = readonly [en: string, vi: string];
export const tr = (text: Bilingual, language: Language) =>
  text[language === "vi" ? 1 : 0];
export type Family =
  | "text"
  | "qr"
  | "two-sided"
  | "sports"
  | "frame"
  | "bead"
  | "shoe"
  | "medal"
  | "topper"
  | "surface-art"
  | "trace"
  | "cutter"
  | "letter-cutter"
  | "roller"
  | "stencil"
  | "sign"
  | "scan-board"
  | "braille"
  | "tray"
  | "basket"
  | "box"
  | "stamp"
  | "clicker";
export type Value = string | number | boolean;
export type Ring = [number, number][];
export type Style = "raised" | "engraved" | "flush";
export type TextLine = {
  text: string;
  font: string;
  size: number;
  spacing: number;
  weight: "light" | "regular" | "bold" | "heavy";
  italic: boolean;
  letterCase: "as" | "upper" | "lower";
  style: Style;
  rise: number;
  depth: number;
  color: string;
  angle: number;
  x: number;
  y: number;
  align: "left" | "center" | "right" | "manual";
  curve: "straight" | "top" | "bottom";
  radius: number;
  lineGap?: number;
};
export type ArtRegion = {
  id: string;
  color: string;
  rings: Ring[];
  height: number;
  enabled: boolean;
};
export type Artwork = {
  id: string;
  name: string;
  processing?: ImageOptions;
  backing?: boolean;
  margin?: number;
  source?: string;
  regions: ArtRegion[];
  size: number;
  x: number;
  y: number;
  angle: number;
  style: Style;
  rise: number;
  depth: number;
  mirror: boolean;
  side: "front" | "back";
};
export type QRData = {
  side?: "front" | "back" | "both";
  kind: "text" | "wifi" | "phone" | "sms" | "email" | "contact";
  content: string;
  ssid: string;
  password: string;
  security: string;
  hidden: boolean;
  phone: string;
  message: string;
  email: string;
  subject: string;
  contactName: string;
  company: string;
  url: string;
  address: string;
  ecc: "L" | "M" | "Q" | "H";
  caption: string;
  x: number;
  y: number;
  size: number;
  module: number;
  sizing: "module" | "fixed";
  style: Style;
  height: number;
  color: string;
  tileColor: string;
  logo: boolean;
};
export type PrinterProfile = {
  id: string;
  name: string;
  bedWidth: number;
  bedDepth: number;
  nozzle: number;
  layer: number;
  clearance: number;
  shrink: [number, number, number];
  archived?: boolean;
};
export type ProductDesign = {
  version: 1;
  id: string;
  name: string;
  preset: string;
  family: Family;
  params: Record<string, Value>;
  lines: TextLine[];
  backLines: TextLine[];
  artworks: Artwork[];
  codes: QRData[];
  assets: AssetFile[];
  model?: PartMesh[];
  updated: number;
  archived?: boolean;
};
export type Preset = {
  id: string;
  name: Bilingual;
  category: Bilingual;
  family: Family;
  params?: Record<string, Value>;
};
export type Field = {
  key: string;
  label: Bilingual;
  group: Bilingual;
  type: "number" | "boolean" | "select" | "color" | "text";
  value: Value;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: Bilingual }[];
  families?: Family[];
  when?: (p: Record<string, Value>) => boolean;
  help?: Bilingual;
};
export const DEFAULT_PRINTER: PrinterProfile = {
  id: "default",
  name: "A1 / P1 / X1",
  bedWidth: 256,
  bedDepth: 256,
  nozzle: 0.4,
  layer: 0.2,
  clearance: 0.2,
  shrink: [0, 0, 0],
};
export const defaultLine = (text = "", index = 0): TextLine => ({
  text,
  font: "lato-regular",
  size: index ? 10 : 16,
  spacing: 0,
  weight: "regular",
  italic: false,
  letterCase: "as",
  style: "raised",
  rise: 1.4,
  depth: 0.8,
  color: "#FFFFFF",
  angle: 0,
  x: 0,
  y: 0,
  align: "center",
  curve: "straight",
  radius: 25,
});
export const defaultQR = (): QRData => ({
  side: "front",
  kind: "text",
  content: "https://example.com",
  ssid: "Guest",
  password: "",
  security: "WPA",
  hidden: false,
  phone: "",
  message: "",
  email: "",
  subject: "",
  contactName: "",
  company: "",
  url: "",
  address: "",
  ecc: "M",
  caption: "",
  x: 0,
  y: 0,
  size: 40,
  module: 1.6,
  sizing: "module",
  style: "raised",
  height: 0.8,
  color: "#111111",
  tileColor: "#FFFFFF",
  logo: false,
});
export function newDesign(
  preset: Preset,
  defaults: Record<string, Value>,
): ProductDesign {
  const design: ProductDesign = {
    version: 1,
    id: crypto.randomUUID(),
    name: preset.name[0],
    preset: preset.id,
    family: preset.family,
    params: { ...defaults, ...preset.params },
    lines: Array.from({ length: 6 }, (_, i) =>
      defaultLine(i ? "" : "GENESIS", i),
    ),
    backLines: Array.from({ length: 6 }, (_, i) => ({
      ...defaultLine(i ? "" : "0123 456 789", i),
      style: "flush",
    })),
    artworks: [],
    codes: [defaultQR()],
    assets: [],
    updated: Date.now(),
  };
  if (["qr", "scan-board"].includes(design.family)) design.lines[0].text = "";
  if (design.family === "scan-board")
    design.codes = ["Website", "Menu", "Review"].map((caption, i) => ({
      ...defaultQR(),
      sizing: "fixed",
      size: 40,
      caption,
      x: (i - 1) * 48,
    }));
  if (
    [
      "tray",
      "basket",
      "cutter",
      "roller",
      "frame",
      "shoe",
      "trace",
      "stencil",
    ].includes(design.family)
  )
    design.lines[0].text = "";
  if (design.family === "letter-cutter") design.lines[0].text = "ABC";
  if (design.family === "braille") design.lines[0].text = "ROOM 101";
  if (design.family === "stamp") {
    design.lines[0].text = "HANDMADE";
    design.lines[0].style = "raised";
  }
  if (typeof preset.params?.defaultText === "string")
    design.lines[0].text = preset.params.defaultText;
  if (typeof preset.params?.qrKind === "string")
    design.codes[0].kind = preset.params.qrKind as QRData["kind"];
  if (design.family === "stamp") design.params.baseHeight = 10;
  if (
    [
      "topper",
      "stamp",
      "sign",
      "sports",
      "shoe",
      "scan-board",
      "frame",
    ].includes(design.family)
  )
    design.params.keyring = false;
  if (design.family === "topper") {
    design.params.shape = "outline";
    design.params.sizing = "fit";
    design.params.paddingX = 2;
  }
  if (design.family === "bead") {
    design.params.baseHeight = 8;
    design.params.holeDiameter = 4.5;
  }
  if (design.family === "medal") {
    design.params.ringPosition = "top";
    design.params.ringStyle = "slot";
    design.params.tabWidth = 20;
    design.params.slotWidth = 14;
    design.lines[0].size = 12;
  }
  if (design.family === "cutter") {
    design.params.bodyHeight = 15;
    design.params.wall = 0.8;
    design.params.rimWidth = 3;
  }
  if (design.family === "letter-cutter") {
    design.params.bodyHeight = 15;
    design.params.wall = 0.8;
    design.params.rimWidth = 3;
    design.lines[0].size = 30;
  }
  if (design.family === "clicker") {
    design.lines[0].text = "HELLO";
    design.lines[0].color = "#1D2C45";
    design.lines[0].style = "flush";
    design.params.spacing = 2;
  }
  if (preset.id === "image-keycap-clicker") {
    design.params.artKey = true;
    design.lines[0].text = "";
  }
  if (preset.id === "domed-emblem-clicker") {
    design.params.clickerMode = "shape";
    design.params.shape = "circle";
    design.lines[0].text = "";
  }
  if (preset.id === "charm-beads") design.params.beadMode = "charm";
  if (preset.id === "image-to-cookie-cutter") {
    design.family = "cutter";
    design.params.wall = 0.8;
    design.params.bodyHeight = 15;
    design.params.keyring = false;
  }
  if (preset.id === "name-tray") design.lines[0].text = "HOME";
  if (preset.id === "table-number") design.lines[0].text = "12";
  if (
    preset.id === "desk-nameplate" ||
    preset.id === "place-card" ||
    preset.id === "table-number" ||
    preset.id === "menu-card" ||
    design.family === "scan-board"
  )
    design.params.stand = true;
  if (preset.id === "name-badge") design.params.backing = "pin";
  if (preset.id === "bag-and-luggage-tag") design.params.ringStyle = "slot";
  if (preset.id === "layered-logo-plaque") {
    design.params.middle = true;
    design.params.middleHeight = 0.8;
  }
  if (preset.id === "mini-fondant-roller") design.params.width = 60;
  if (preset.id === "clay-texture-roller") design.params.width = 70;
  if (
    design.params.useArtworkShape ||
    ["trace", "stencil"].includes(design.family) ||
    preset.id === "printed-photo-plaque" ||
    preset.id === "image-keycap-clicker" ||
    preset.id === "domed-emblem-clicker"
  ) {
    const ring: Ring = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2,
        r = i % 2 ? 0.22 : 0.48;
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
    design.artworks = [
      {
        id: crypto.randomUUID(),
        name: "Star",
        regions: [
          {
            id: crypto.randomUUID(),
            color: "#F4C542",
            rings: [ring],
            height: 1,
            enabled: true,
          },
        ],
        size: 30,
        x: 0,
        y: 0,
        angle: 0,
        style: "raised",
        rise: 1,
        depth: 0.8,
        mirror: false,
        side: "front",
      },
    ];
  }
  return design;
}
export const isHex = (v: unknown): v is string =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
