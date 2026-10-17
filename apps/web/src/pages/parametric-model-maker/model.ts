export type PartMesh = {
  name: string;
  color: string;
  role: "base" | "text" | "model";
  vertices: Float32Array;
  indices: Uint32Array;
};
export type AssetFile = { name: string; data: Uint8Array };
export type ParameterValue = string | number | boolean | number[];
export type Parameter = {
  key: string;
  label: string;
  group: string;
  type:
    | "text"
    | "number"
    | "boolean"
    | "select"
    | "vector"
    | "color"
    | "font"
    | "file";
  initial: ParameterValue;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string | number }[];
  description?: string;
};
export type WavyConfig = {
  line1: string;
  line2: string;
  line3: string;
  layout: number;
  font: string;
  diameter: number;
  margin: number;
  lineSpacing: number;
  letterSpacing: number;
  wordSpace: number;
  widthFill: number;
  roundWarp: number;
  glyphWidth: number;
  glyphHeight: number;
  wavy: boolean;
  waveAmount: number;
  waveCycles: number;
  wavePhase: number;
  waveTopBottom: number;
  baseDepth: number;
  textHeight: number;
  textEmbed: number;
  edgeRound: number;
  quality: string;
  showPart: string;
  baseColor: string;
  textColor: string;
};
export const DEFAULT_WAVY: WavyConfig = {
  line1: "TRAN",
  line2: "CAO",
  line3: "DAI",
  layout: 3,
  font: "lilita-one",
  diameter: 40,
  margin: 1.5,
  lineSpacing: 0.9,
  letterSpacing: 0.15,
  wordSpace: 35,
  widthFill: 94,
  roundWarp: 100,
  glyphWidth: 100,
  glyphHeight: 100,
  wavy: true,
  waveAmount: 2.5,
  waveCycles: 1,
  wavePhase: 0,
  waveTopBottom: 40,
  baseDepth: 1,
  textHeight: 4,
  textEmbed: 0.12,
  edgeRound: 0.15,
  quality: "Balanced",
  showPart: "Both",
  baseColor: "#FFFFFF",
  textColor: "#FF329A",
};
export const MAKER_FONTS = [
  ["lilita-one", "Lilita One"],
  ["cherry-bomb-one", "Cherry Bomb One"],
  ["luckiest-guy", "Luckiest Guy"],
  ["titan-one", "Titan One"],
  ["bagel-fat-one", "Bagel Fat One"],
  ["bevan", "Bevan"],
  ["ultra", "Ultra"],
];
export const PLA_COLORS = [
  ["White", "#FFFFFF"],
  ["Black", "#181818"],
  ["Red", "#DC2833"],
  ["Orange", "#FF8428"],
  ["Yellow", "#F4D235"],
  ["Green", "#32A45B"],
  ["Blue", "#356CD1"],
  ["Purple", "#8544BF"],
  ["Pink", "#F591BB"],
  ["Hot Pink", "#FF329A"],
  ["Light Pink", "#F9C6DA"],
  ["Gold", "#C7A354"],
  ["Silver", "#B8BEC4"],
  ["Gray", "#85878B"],
  ["Brown", "#845539"],
  ["Beige", "#DEC9A6"],
  ["Cyan", "#27C7D5"],
  ["Lime Green", "#9BD82F"],
  ["Light Blue", "#8DCDF4"],
  ["Dark Blue", "#153D80"],
  ["Dark Green", "#1D5A3A"],
];
const choices = (values: (string | number)[]) =>
  values.map((value) => ({ label: String(value), value }));
const numeric = (
  key: keyof WavyConfig,
  label: string,
  group: string,
  min: number,
  max: number,
  step: number,
): Parameter => ({
  key,
  label,
  group,
  type: "number",
  min,
  max,
  step,
  initial: DEFAULT_WAVY[key],
});
export const WAVY_PARAMETERS: Parameter[] = [
  ...(["line1", "line2", "line3"] as const).map(
    (key, i): Parameter => ({
      key,
      label: `Dòng ${i + 1}`,
      group: "Nội dung",
      type: "text",
      initial: DEFAULT_WAVY[key],
    }),
  ),
  {
    key: "layout",
    label: "Bố cục",
    group: "Nội dung",
    type: "select",
    initial: 3,
    options: [1, 2, 3].map((value) => ({ label: `${value} dòng`, value })),
  },
  {
    key: "font",
    label: "Phông chữ",
    group: "Phông chữ",
    type: "font",
    initial: "lilita-one",
    options: MAKER_FONTS.map(([value, label]) => ({ value, label })),
  },
  numeric("diameter", "Đường kính nền (mm)", "Căn theo vòng tròn", 30, 80, 1),
  numeric("margin", "Lề bên", "Căn theo vòng tròn", 0.5, 4, 0.25),
  numeric("lineSpacing", "Khoảng cách dòng", "Căn theo vòng tròn", 0, 3, 0.1),
  numeric(
    "letterSpacing",
    "Khoảng cách ký tự",
    "Căn theo vòng tròn",
    0,
    1.5,
    0.05,
  ),
  {
    key: "wordSpace",
    label: "Khoảng cách từ",
    group: "Căn theo vòng tròn",
    type: "number",
    initial: 35,
    min: 0,
    max: 200,
    step: 1,
  },
  numeric("widthFill", "Độ phủ ngang (%)", "Căn theo vòng tròn", 70, 100, 1),
  numeric("roundWarp", "Ép tròn (%)", "Căn theo vòng tròn", 0, 100, 5),
  numeric("glyphWidth", "Rộng ký tự (%)", "Căn theo vòng tròn", 65, 145, 5),
  numeric("glyphHeight", "Cao ký tự (%)", "Căn theo vòng tròn", 70, 125, 5),
  {
    key: "wavy",
    label: "Bật lượn sóng",
    group: "Chữ lượn sóng",
    type: "boolean",
    initial: true,
  },
  numeric("waveAmount", "Biên độ sóng", "Chữ lượn sóng", 0, 6, 0.25),
  numeric("waveCycles", "Chu kỳ sóng", "Chữ lượn sóng", 0.5, 2.5, 0.25),
  numeric("wavePhase", "Pha sóng (°)", "Chữ lượn sóng", -180, 180, 10),
  numeric(
    "waveTopBottom",
    "Ảnh hưởng trên / dưới (%)",
    "Chữ lượn sóng",
    0,
    100,
    5,
  ),
  numeric("baseDepth", "Độ dày nền (mm)", "Nền và chữ", 0, 3, 0.1),
  numeric("textHeight", "Chiều cao chữ (mm)", "Nền và chữ", 1, 10, 0.25),
  numeric("textEmbed", "Độ lồng chữ (mm)", "Nền và chữ", 0, 0.3, 0.01),
  numeric("edgeRound", "Bo cạnh trên (mm)", "Nền và chữ", 0, 1.5, 0.05),
  {
    key: "quality",
    label: "Chất lượng",
    group: "Chất lượng và phần",
    type: "select",
    initial: "Balanced",
    options: choices(["Fast", "Balanced", "Fine"]),
  },
  {
    key: "showPart",
    label: "Phần mô hình",
    group: "Chất lượng và phần",
    type: "select",
    initial: "Both",
    options: [
      { label: "Nền + chữ", value: "Both" },
      { label: "Chỉ nền", value: "Base Only" },
      { label: "Chỉ chữ", value: "Text Only" },
    ],
  },
  {
    key: "baseColor",
    label: "Màu nền",
    group: "Màu từng vùng",
    type: "color",
    initial: DEFAULT_WAVY.baseColor,
  },
  {
    key: "textColor",
    label: "Màu chữ",
    group: "Màu từng vùng",
    type: "color",
    initial: DEFAULT_WAVY.textColor,
  },
];
export type MakerProject = {
  version: 1;
  id: string;
  name: string;
  kind: "wavy" | "scad";
  config: WavyConfig;
  source: string;
  values: Record<string, ParameterValue>;
  updated: number;
  favorite: boolean;
  assets?: { name: string; data: string }[];
};
export const SAMPLE_SCAD = `/* [Kích thước] */
// Cạnh của khối, tính bằng mm
size = 20; // [5:1:80]
height = 12; // [1:0.5:40]
/* [Kiểu dáng] */
shape = "Cylinder"; // [Cylinder:Trụ tròn,Box:Hộp vuông]
hole = true;
title = "FormaForge";
offset = [0, 0, 0]; // [-20:1:20]
model_color = "#ef4444"; // color
text_font = "Lilita One"; // font
/* [Hidden] */
$fn = 64;
translate(offset) color(model_color) difference() {
  if (shape == "Cylinder") cylinder(d=size,h=height); else translate([-size/2,-size/2,0]) cube([size,size,height]);
  if (hole) translate([0,0,-1]) cylinder(d=size/3,h=height+2);
}
`;
export const PRINTERS = [
  { name: "A1", width: 256, depth: 256 },
  { name: "A1 mini", width: 180, depth: 180 },
  { name: "A2L", width: 330, depth: 320 },
  { name: "P1S", width: 256, depth: 256 },
  { name: "P2S", width: 256, depth: 256 },
  { name: "X1C", width: 256, depth: 256 },
  { name: "X2D", width: 256, depth: 256 },
  { name: "H2D", width: 350, depth: 320 },
  { name: "H2D Pro", width: 350, depth: 320 },
  { name: "H2C", width: 330, depth: 320 },
  { name: "H2S", width: 340, depth: 320 },
  { name: "P1P", width: 256, depth: 256 },
  { name: "X1E", width: 256, depth: 256 },
  { name: "X1", width: 256, depth: 256 },
  { name: "Tùy chỉnh", width: 256, depth: 256 },
];
export function selectedParts(parts: PartMesh[], mode: string) {
  return parts.filter(
    (p) =>
      mode === "Both" ||
      (mode === "Base Only" ? p.role === "base" : p.role === "text"),
  );
}
export function configFromValues(
  values: Record<string, ParameterValue>,
): WavyConfig {
  const result = { ...DEFAULT_WAVY };
  for (const p of WAVY_PARAMETERS) {
    let value = values[p.key] ?? p.initial;
    if (p.type === "number") {
      value = Number(value);
      if (!Number.isFinite(value)) value = p.initial;
      value = Math.max(p.min!, Math.min(p.max!, Number(value)));
    }
    if (p.type === "boolean")
      value = typeof value === "boolean" ? value : p.initial;
    if (p.type === "text") value = String(value).slice(0, 80);
    if (p.type === "color" && !/^#[0-9a-f]{6}$/i.test(String(value)))
      value = p.initial;
    if (
      p.options &&
      !p.options.some((o) => o.value === value) &&
      !(p.key === "font" && String(value).startsWith("custom:"))
    )
      value = p.initial;
    (result as unknown as Record<string, ParameterValue>)[p.key] = value;
  }
  return result;
}
