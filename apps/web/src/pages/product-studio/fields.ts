import type { Bilingual, Family, Field, Value } from "./model";
const group = {
  plate: ["Plate", "Nền"],
  layers: ["Layers and border", "Lớp và viền"],
  ring: ["Hanging and mounting", "Móc và lỗ gắn"],
  back: ["Backing and reverse", "Mặt sau"],
  shape: ["Shape and dimensions", "Hình dạng và kích thước"],
  fit: ["Hardware and fit", "Phụ kiện và dung sai"],
  pattern: ["Pattern and relief", "Hoa văn và độ nổi"],
  tray: ["Compartments", "Ngăn chứa"],
  frame: ["Photo and frame", "Ảnh và khung"],
  bead: ["Beads and cord", "Hạt và dây"],
  roller: ["Roller and handles", "Con lăn và tay cầm"],
  box: ["Box and sliding lid", "Hộp và nắp trượt"],
  basket: ["Lattice and weave", "Lưới và vân đan"],
  stamp: ["Stamp and handle", "Con dấu và tay cầm"],
  cutter: ["Cutting and imprint", "Cắt và tạo dấu"],
  clicker: ["Switch clicker", "Clicker công tắc"],
  braille: ["Braille", "Chữ nổi Braille"],
  scan: ["Scan board", "Bảng quét mã"],
} satisfies Record<string, Bilingual>;
type Group = keyof typeof group;
const n = (
  key: string,
  en: string,
  vi: string,
  g: Group,
  value: number,
  min: number,
  max: number,
  step = 0.1,
  families?: Family[],
): Field => ({
  key,
  label: [en, vi],
  group: group[g],
  value,
  type: "number",
  min,
  max,
  step,
  families,
});
const b = (
  key: string,
  en: string,
  vi: string,
  g: Group,
  value = false,
  families?: Family[],
): Field => ({
  key,
  label: [en, vi],
  group: group[g],
  value,
  type: "boolean",
  families,
});
const s = (
  key: string,
  en: string,
  vi: string,
  g: Group,
  value: string,
  options: [string, string, string][],
  families?: Family[],
): Field => ({
  key,
  label: [en, vi],
  group: group[g],
  value,
  type: "select",
  families,
  options: options.map(([value, en, vi]) => ({ value, label: [en, vi] })),
});
const color = (
  key: string,
  en: string,
  vi: string,
  g: Group,
  value: string,
): Field => ({ key, label: [en, vi], group: group[g], value, type: "color" });
const flat: Family[] = [
  "text",
  "qr",
  "two-sided",
  "sports",
  "medal",
  "topper",
  "trace",
  "sign",
  "scan-board",
  "shoe",
  "stamp",
];
export const FIELDS: Field[] = [
  n("detail", "Curve detail", "Độ mịn đường cong", "shape", 64, 24, 128, 8),
  b("includeQr", "Include QR code", "Thêm mã QR", "scan", false, flat),
  b("autoCodes", "Automatic code layout", "Tự bố trí mã", "scan", true, flat),
  b(
    "seeThrough",
    "See-through letter counters",
    "Thông lỗ trong chữ",
    "plate",
    false,
    flat,
  ),
  s(
    "letterHoles",
    "Letter counter style",
    "Kiểu lỗ trong chữ",
    "plate",
    "intact",
    [
      ["intact", "Keep full-size holes", "Giữ nguyên cỡ lỗ"],
      ["offset", "True offset holes", "Lỗ theo đường bù"],
    ],
    flat,
  ),
  n("flutes", "Flutes / petals", "Số rãnh / cánh", "plate", 24, 4, 120, 1),
  n("fluteDepth", "Flute depth (mm)", "Độ sâu rãnh (mm)", "plate", 1.5, 0.2, 8),
  n("teeth", "Gear teeth", "Số răng", "plate", 16, 6, 60, 1),
  n(
    "toothHeight",
    "Tooth height (mm)",
    "Chiều cao răng (mm)",
    "plate",
    2,
    0.4,
    10,
  ),
  b("pointed", "Pointed top orientation", "Xoay đỉnh lên trên", "plate"),
  n(
    "topWidth",
    "Top width (% of base)",
    "Rộng cạnh trên (% đáy)",
    "plate",
    70,
    20,
    150,
    1,
  ),
  n("slant", "Slant (mm)", "Độ xiên (mm)", "plate", 8, 0, 50),
  n(
    "tabWidth",
    "Tab width (mm)",
    "Rộng tai treo (mm)",
    "ring",
    12,
    5,
    50,
    0.1,
    flat,
  ),
  n(
    "tabHeight",
    "Tab height (mm)",
    "Cao tai treo (mm)",
    "ring",
    9,
    4,
    35,
    0.1,
    flat,
  ),
  n(
    "tabCorner",
    "Tab corner radius (mm)",
    "Bo góc tai treo (mm)",
    "ring",
    2,
    0,
    12,
    0.1,
    flat,
  ),
  n(
    "slotWidth",
    "Slot width (mm)",
    "Rộng rãnh (mm)",
    "ring",
    7,
    2,
    35,
    0.1,
    flat,
  ),
  n(
    "slotHeight",
    "Slot height (mm)",
    "Cao rãnh (mm)",
    "ring",
    3,
    1,
    15,
    0.1,
    flat,
  ),
  n(
    "standWidth",
    "Stand width (0 = automatic)",
    "Rộng chân đế (0 = tự động)",
    "ring",
    0,
    0,
    350,
    0.5,
    flat,
  ),
  n(
    "standGrip",
    "Stand grip height (mm)",
    "Cao thành giữ (mm)",
    "ring",
    8,
    3,
    40,
    0.5,
    flat,
  ),
  n(
    "standSeat",
    "Stand seat height (mm)",
    "Cao đáy rãnh (mm)",
    "ring",
    3,
    1,
    15,
    0.1,
    flat,
  ),
  n(
    "standClearance",
    "Stand slot clearance (mm)",
    "Dung sai rãnh chân đế (mm)",
    "ring",
    0.25,
    0,
    1,
    0.05,
    flat,
  ),
  s(
    "domeShape",
    "Dome shape",
    "Hình vòm",
    "pattern",
    "cushion",
    [
      ["cushion", "Soft cushion", "Gối mềm"],
      ["ball", "Ball", "Bán cầu"],
      ["cone", "Cone", "Hình nón"],
    ],
    flat,
  ),
  s(
    "domeText",
    "Text on dome",
    "Chữ trên vòm",
    "pattern",
    "follow",
    [
      ["follow", "Follow surface", "Bám bề mặt"],
      ["flat", "Flat top", "Đỉnh phẳng"],
      ["engraved", "Cut into dome", "Khắc vào vòm"],
    ],
    flat,
  ),
  n(
    "modelScale",
    "Imported model scale (%)",
    "Tỷ lệ mô hình nhập (%)",
    "shape",
    100,
    1,
    500,
    1,
    ["surface-art"],
  ),
  n(
    "modelX",
    "Model rotation X (°)",
    "Xoay mô hình X (°)",
    "shape",
    0,
    -180,
    180,
    1,
    ["surface-art"],
  ),
  n(
    "modelY",
    "Model rotation Y (°)",
    "Xoay mô hình Y (°)",
    "shape",
    0,
    -180,
    180,
    1,
    ["surface-art"],
  ),
  n(
    "modelZ",
    "Model rotation Z (°)",
    "Xoay mô hình Z (°)",
    "shape",
    0,
    -180,
    180,
    1,
    ["surface-art"],
  ),
  s("shape", "Outline shape", "Hình dạng nền", "plate", "rounded", [
    ["outline", "Outline / offset", "Theo đường viền"],
    ["rounded", "Rounded rectangle", "Chữ nhật bo góc"],
    ["circle", "Circle", "Tròn"],
    ["oval", "Oval", "Bầu dục"],
    ["hexagon", "Hexagon", "Lục giác"],
    ["polygon", "Regular polygon", "Đa giác đều"],
    ["scallop", "Scalloped / fluted", "Viền cánh hoa"],
    ["scallop-rect", "Scalloped rectangle", "Chữ nhật viền hoa"],
    ["gear", "Gear", "Bánh răng"],
    ["star", "Star", "Ngôi sao"],
    ["shield", "Shield", "Khiên"],
    ["trapezoid", "Trapezoid", "Hình thang"],
    ["rhombus", "Rhombus", "Hình thoi"],
    ["parallelogram", "Parallelogram", "Bình hành"],
    ["cloud", "Cloud", "Đám mây"],
    ["heart", "Heart", "Trái tim"],
    ["arch", "Arch", "Mái vòm"],
    ["text", "Text silhouette", "Theo chữ"],
    ["tree", "Tree", "Cây thông"],
    ["paw", "Paw", "Chân thú cưng"],
  ]),
  s("sizing", "Sizing", "Cách định kích thước", "plate", "fixed", [
    ["fixed", "Fixed size", "Kích thước cố định"],
    ["fit", "Fit content", "Vừa nội dung"],
  ]),
  n("width", "Width / length (mm)", "Rộng / dài (mm)", "plate", 70, 10, 350),
  n("height", "Height / depth (mm)", "Cao / sâu (mm)", "plate", 35, 10, 350),
  n("paddingX", "Side padding (mm)", "Lề ngang (mm)", "plate", 4, 0, 30),
  n("paddingY", "Vertical padding (mm)", "Lề dọc (mm)", "plate", 4, 0, 30),
  n("corner", "Corner radius (mm)", "Bo góc (mm)", "plate", 4, 0, 40),
  n("sides", "Sides / petals", "Số cạnh / cánh", "plate", 6, 3, 32, 1),
  n(
    "baseHeight",
    "Base thickness (mm)",
    "Độ dày nền (mm)",
    "plate",
    3,
    0.4,
    15,
  ),
  color("baseColor", "Base colour", "Màu nền", "plate", "#356CD1"),
  n("textGap", "Line gap (mm)", "Khoảng cách dòng (mm)", "plate", 2, 0, 25),
  n(
    "textAngle",
    "Text direction (°)",
    "Hướng toàn bộ chữ (°)",
    "plate",
    0,
    -360,
    360,
    1,
  ),
  b("middle", "Middle layer", "Lớp giữa", "layers"),
  n(
    "middleInset",
    "Middle inset (mm)",
    "Lùi lớp giữa (mm)",
    "layers",
    1,
    0,
    20,
  ),
  n(
    "middleHeight",
    "Middle height (mm)",
    "Độ dày lớp giữa (mm)",
    "layers",
    0.8,
    0.2,
    8,
  ),
  color("middleColor", "Middle colour", "Màu lớp giữa", "layers", "#FFFFFF"),
  b("border", "Raised border", "Viền nổi", "layers"),
  n(
    "borderWidth",
    "Border width (mm)",
    "Bề rộng viền (mm)",
    "layers",
    1,
    0.4,
    8,
  ),
  n(
    "borderHeight",
    "Border rise (mm)",
    "Độ nổi viền (mm)",
    "layers",
    0.8,
    0.2,
    8,
  ),
  color("borderColor", "Border colour", "Màu viền", "layers", "#F4C542"),
  b("keyring", "Hanging hole", "Lỗ treo", "ring", true, [...flat, "clicker"]),
  s(
    "ringStyle",
    "Ring style",
    "Kiểu lỗ treo",
    "ring",
    "outside",
    [
      ["inside", "Inside hole", "Lỗ trong nền"],
      ["outside", "Outside loop", "Vòng ngoài"],
      ["slot", "Slotted tab", "Tai có rãnh"],
    ],
    flat,
  ),
  s(
    "ringPosition",
    "Position",
    "Vị trí",
    "ring",
    "left",
    [
      ["left", "Left", "Trái"],
      ["right", "Right", "Phải"],
      ["top", "Top", "Trên"],
      ["bottom", "Bottom", "Dưới"],
    ],
    flat,
  ),
  n(
    "holeDiameter",
    "Hole diameter (mm)",
    "Đường kính lỗ (mm)",
    "ring",
    4,
    1,
    20,
  ),
  n(
    "ringWall",
    "Wall around hole (mm)",
    "Thành quanh lỗ (mm)",
    "ring",
    2.5,
    0.8,
    10,
    0.1,
    flat,
  ),
  b(
    "stand",
    "Separate slide-in stand",
    "Chân đế trượt rời",
    "ring",
    false,
    flat,
  ),
  n(
    "standDepth",
    "Stand depth (mm)",
    "Độ sâu chân đế (mm)",
    "ring",
    30,
    10,
    100,
    0.1,
    flat,
  ),
  b("mountHoles", "Screw-mount holes", "Lỗ vít gắn tường", "ring", false, [
    "sign",
    "scan-board",
    "frame",
  ]),
  n(
    "mountInset",
    "Mounting inset (mm)",
    "Lùi lỗ gắn (mm)",
    "ring",
    6,
    2,
    30,
    0.1,
    ["sign", "scan-board", "frame"],
  ),
  s(
    "backing",
    "Backing",
    "Kiểu mặt sau",
    "back",
    "none",
    [
      ["none", "None", "Không"],
      ["magnet", "Magnet pocket", "Hốc nam châm"],
      ["pin", "Pin-bar slot", "Rãnh kim cài"],
      ["nfc", "NFC pocket", "Hốc NFC"],
    ],
    flat,
  ),
  n(
    "pocketWidth",
    "Pocket diameter / width (mm)",
    "Đường kính / rộng hốc (mm)",
    "back",
    25,
    4,
    80,
    0.1,
    flat,
  ),
  n(
    "pocketDepth",
    "Pocket depth (mm)",
    "Độ sâu hốc (mm)",
    "back",
    1.2,
    0.2,
    8,
    0.1,
    flat,
  ),
  b(
    "twoSided",
    "Design on both sides",
    "Thiết kế hai mặt",
    "back",
    false,
    flat,
  ),
  b(
    "reverseMirror",
    "Mirror reverse text",
    "Lật chữ mặt sau",
    "back",
    false,
    flat,
  ),
  b("dome", "Domed relief", "Phù điêu vòm", "pattern", false, [
    "text",
    "sports",
    "clicker",
    "shoe",
  ]),
  n("domeHeight", "Dome height (mm)", "Độ cao vòm (mm)", "pattern", 4, 0.2, 20),
  n(
    "bodyHeight",
    "Body height (mm)",
    "Chiều cao thân (mm)",
    "shape",
    20,
    2,
    300,
  ),
  n("wall", "Wall thickness (mm)", "Độ dày thành (mm)", "shape", 2, 0.4, 10),
  n("floor", "Floor thickness (mm)", "Độ dày đáy (mm)", "shape", 2, 0, 10),
  s("texture", "Wall texture", "Hoa văn thành", "pattern", "none", [
    ["none", "Smooth", "Trơn"],
    ["ribbed", "Vertical ribs", "Gân dọc"],
    ["woven", "Woven", "Đan"],
    ["honeycomb", "Honeycomb", "Tổ ong"],
    ["diamond", "Diamond lattice", "Lưới hình thoi"],
  ]),
  n(
    "textureDepth",
    "Texture depth (mm)",
    "Độ sâu hoa văn (mm)",
    "pattern",
    0.6,
    0.2,
    5,
  ),
  n(
    "textureSize",
    "Pattern pitch (mm)",
    "Bước hoa văn (mm)",
    "pattern",
    6,
    2,
    40,
  ),
  n("dividersX", "Columns", "Số cột ngăn", "tray", 0, 0, 16, 1, [
    "tray",
    "box",
  ]),
  n("dividersY", "Rows", "Số hàng ngăn", "tray", 0, 0, 16, 1, ["tray", "box"]),
  n(
    "dividerWall",
    "Divider thickness (mm)",
    "Độ dày vách ngăn (mm)",
    "tray",
    1.6,
    0.6,
    8,
    0.1,
    ["tray", "box"],
  ),
  s(
    "layout",
    "Compartment layout",
    "Bố cục ngăn",
    "tray",
    "single",
    [
      ["single", "Single", "Một ngăn"],
      ["row", "Row of shapes", "Hàng hình"],
      ["flower", "Flower", "Hình hoa"],
    ],
    ["tray"],
  ),
  n(
    "compartments",
    "Compartments / petals",
    "Số ngăn / cánh",
    "tray",
    5,
    1,
    12,
    1,
    ["tray"],
  ),
  n("rimWidth", "Rim width (mm)", "Rộng mép (mm)", "tray", 1, 0, 8, 0.1, [
    "tray",
    "basket",
    "cutter",
    "letter-cutter",
  ]),
  n("rimHeight", "Rim thickness (mm)", "Dày mép (mm)", "tray", 2, 0.4, 8, 0.1, [
    "tray",
    "basket",
    "cutter",
    "letter-cutter",
  ]),
  n(
    "photoWidth",
    "Photo width (mm)",
    "Rộng ảnh (mm)",
    "frame",
    80,
    10,
    300,
    0.1,
    ["frame"],
  ),
  n(
    "photoHeight",
    "Photo height (mm)",
    "Cao ảnh (mm)",
    "frame",
    120,
    10,
    300,
    0.1,
    ["frame"],
  ),
  n(
    "photoThickness",
    "Photo thickness (mm)",
    "Dày ảnh (mm)",
    "frame",
    0.3,
    0.1,
    3,
    0.1,
    ["frame"],
  ),
  s(
    "frameMode",
    "Frame mode",
    "Chế độ khung",
    "frame",
    "photo",
    [
      ["photo", "Real photo + snap back", "Ảnh thật và nắp bấm"],
      ["plaque", "Printed image plaque", "In ảnh thành phù điêu"],
    ],
    ["frame"],
  ),
  n("snap", "Snap bump (mm)", "Gờ bấm (mm)", "frame", 0.4, 0.1, 1, 0.05, [
    "frame",
  ]),
  s(
    "beadMode",
    "Bead type",
    "Kiểu hạt",
    "bead",
    "letters",
    [
      ["letters", "One bead per character", "Mỗi ký tự một hạt"],
      ["charm", "Artwork charm", "Hạt hình ảnh"],
      ["topper", "Pen / straw topper", "Đầu bút / ống hút"],
    ],
    ["bead"],
  ),
  n(
    "spacing",
    "Gap between objects (mm)",
    "Khoảng cách chi tiết (mm)",
    "bead",
    7,
    1,
    30,
    0.1,
    ["bead", "letter-cutter", "clicker"],
  ),
  s(
    "holeDirection",
    "Cord direction",
    "Hướng luồn dây",
    "bead",
    "horizontal",
    [
      ["horizontal", "Horizontal", "Ngang"],
      ["vertical", "Vertical in face", "Dọc trong mặt"],
      ["up", "Through face (Z)", "Xuyên mặt (Z)"],
    ],
    ["bead"],
  ),
  s(
    "holeShape",
    "Cord hole shape",
    "Hình lỗ dây",
    "bead",
    "round",
    [
      ["round", "Round", "Tròn"],
      ["hex", "Hexagon", "Lục giác"],
    ],
    ["bead"],
  ),
  n(
    "beadMargin",
    "Outline margin (mm)",
    "Viền quanh chữ (mm)",
    "bead",
    2,
    0.5,
    10,
    0.1,
    ["bead"],
  ),
  b("gripRibs", "Grip ribs in hole", "Gân bám trong lỗ", "bead", true, [
    "bead",
  ]),
  b("growToFit", "Grow to fit cord", "Tăng hạt cho vừa lỗ", "bead", true, [
    "bead",
  ]),
  n(
    "diameter",
    "Roller diameter (mm)",
    "Đường kính con lăn (mm)",
    "roller",
    45,
    12,
    120,
    0.1,
    ["roller"],
  ),
  s(
    "rollerMode",
    "Roller type",
    "Kiểu con lăn",
    "roller",
    "pin",
    [
      ["pin", "Roller + handles", "Con lăn và tay cầm"],
      ["sleeve", "Sleeve", "Ống bọc"],
      ["mat", "Flat texture mat", "Tấm hoa văn"],
      ["brayer", "Hand roller with frame", "Con lăn khung cầm"],
    ],
    ["roller"],
  ),
  n(
    "sleeveInner",
    "Existing pin diameter (mm)",
    "Đường kính cây lăn có sẵn (mm)",
    "roller",
    25,
    6,
    100,
    0.1,
    ["roller"],
  ),
  n(
    "handleLength",
    "Handle length (mm)",
    "Dài tay cầm (mm)",
    "roller",
    65,
    15,
    150,
    0.1,
    ["roller"],
  ),
  n(
    "handleDiameter",
    "Handle diameter (mm)",
    "Đường kính tay cầm (mm)",
    "roller",
    22,
    10,
    45,
    0.1,
    ["roller"],
  ),
  s(
    "threadSize",
    "Thread size",
    "Cỡ ren",
    "fit",
    "M12",
    [
      ["M10", "M10", "M10"],
      ["M12", "M12", "M12"],
      ["M16", "M16", "M16"],
    ],
    ["roller", "stamp"],
  ),
  s(
    "pattern",
    "Pattern",
    "Hoa văn",
    "pattern",
    "honeycomb",
    [
      ["honeycomb", "Honeycomb", "Tổ ong"],
      ["heart", "Hearts", "Trái tim"],
      ["star", "Stars", "Ngôi sao"],
      ["leaf", "Leaves", "Lá"],
      ["text", "Text", "Chữ"],
      ["image", "Image", "Ảnh"],
      ["panel", "Cookie panels", "Ô bánh"],
    ],
    ["roller"],
  ),
  s(
    "reliefStyle",
    "Pattern relief",
    "Kiểu tạo hoa văn",
    "pattern",
    "engraved",
    [
      ["raised", "Raised", "Nổi"],
      ["engraved", "Engraved", "Chìm"],
    ],
    ["roller"],
  ),
  n(
    "reliefDepth",
    "Relief depth (mm)",
    "Độ sâu phù điêu (mm)",
    "pattern",
    1.2,
    0.2,
    5,
  ),
  b(
    "mirrorPattern",
    "Mirror for printing",
    "Lật để in đúng chiều",
    "pattern",
    true,
    ["roller", "stamp"],
  ),
  n(
    "patternAngle",
    "Pattern angle (°)",
    "Góc hoa văn (°)",
    "pattern",
    0,
    -180,
    180,
    1,
    ["roller"],
  ),
  b(
    "guideRings",
    "Dough-thickness rings",
    "Vòng căn độ dày bột",
    "roller",
    false,
    ["roller"],
  ),
  n(
    "doughThickness",
    "Dough thickness (mm)",
    "Độ dày bột (mm)",
    "roller",
    4,
    1,
    12,
    0.1,
    ["roller"],
  ),
  n(
    "guideWidth",
    "Guide ring width (mm)",
    "Rộng vòng căn (mm)",
    "roller",
    5,
    2,
    15,
    0.1,
    ["roller"],
  ),
  b(
    "moldSet",
    "Cutter + pusher + holding tray",
    "Bộ khuôn, đẩy và khay",
    "cutter",
    false,
    ["cutter"],
  ),
  b("imprint", "Imprint design", "Dấu ép bên trong", "cutter", true, [
    "cutter",
    "letter-cutter",
  ]),
  n(
    "imprintHeight",
    "Imprint height (mm)",
    "Chiều cao dấu ép (mm)",
    "cutter",
    2,
    0.4,
    10,
    0.1,
    ["cutter", "letter-cutter"],
  ),
  n("traySlots", "Holding tray slots", "Số ô khay giữ", "cutter", 6, 1, 12, 1, [
    "cutter",
  ]),
  n(
    "bridgeWidth",
    "Stencil bridge width (mm)",
    "Độ rộng cầu stencil (mm)",
    "cutter",
    1,
    0.4,
    5,
    0.1,
    ["stencil"],
  ),
  s(
    "bridgeDirection",
    "Bridge direction",
    "Hướng cầu nối",
    "cutter",
    "both",
    [
      ["horizontal", "Horizontal", "Ngang"],
      ["vertical", "Vertical in face", "Dọc trong mặt"],
      ["up", "Through face (Z)", "Xuyên mặt (Z)"],
      ["both", "Both", "Cả hai"],
    ],
    ["stencil"],
  ),
  n(
    "lidThickness",
    "Lid thickness (mm)",
    "Độ dày nắp (mm)",
    "box",
    2,
    0.8,
    6,
    0.1,
    ["box"],
  ),
  n("lidLip", "Lip over lid (mm)", "Gờ trên nắp (mm)", "box", 1, 0.4, 3, 0.1, [
    "box",
  ]),
  b("lidCatch", "Lid snap catch", "Gờ khóa nắp", "box", true, ["box"]),
  n(
    "catchBump",
    "Catch bump (mm)",
    "Độ cao gờ khóa (mm)",
    "box",
    0.4,
    0.1,
    1,
    0.05,
    ["box"],
  ),
  b("stackable", "Stackable", "Xếp chồng", "box", true, ["box", "tray"]),
  s(
    "lidDesign",
    "Lid decoration",
    "Trang trí nắp",
    "box",
    "plain",
    [
      ["plain", "Plain", "Trơn"],
      ["christmas", "Christmas", "Giáng sinh"],
      ["pencil", "Pencil", "Bút chì"],
      ["crayon", "Crayon", "Bút sáp"],
      ["notebook", "Notebook", "Sổ tay"],
      ["gift-wrapped", "Ribbon and bow", "Nơ và ruy băng"],
      ["chocolate", "Chocolate bar", "Thanh sô-cô-la"],
      ["cassette", "Cassette tape", "Băng cassette"],
      ["love-letter", "Love letter", "Thư tình"],
      ["classic-fish", "Fish tin", "Hộp cá"],
      ["boarding-pass", "Boarding pass", "Vé máy bay"],
      ["pattern", "Pattern", "Hoa văn"],
    ],
    ["box"],
  ),
  color(
    "decorationColor",
    "Decoration colour",
    "Màu trang trí",
    "pattern",
    "#F4C542",
  ),
  n(
    "baseScale",
    "Base size (%)",
    "Kích thước đáy (%)",
    "basket",
    75,
    30,
    140,
    1,
    ["basket"],
  ),
  n(
    "bellyScale",
    "Belly size (%)",
    "Kích thước bụng (%)",
    "basket",
    110,
    50,
    160,
    1,
    ["basket"],
  ),
  n(
    "bellyHeight",
    "Belly height (%)",
    "Cao bụng (%)",
    "basket",
    50,
    10,
    90,
    1,
    ["basket"],
  ),
  n(
    "neckScale",
    "Neck size (%)",
    "Kích thước cổ (%)",
    "basket",
    80,
    30,
    160,
    1,
    ["basket"],
  ),
  n(
    "strand",
    "Strand thickness (mm)",
    "Độ dày sợi đan (mm)",
    "basket",
    2.5,
    1,
    8,
    0.1,
    ["basket"],
  ),
  n(
    "opening",
    "Opening / spacing (mm)",
    "Cỡ lỗ / bước đan (mm)",
    "basket",
    12,
    4,
    35,
    0.1,
    ["basket"],
  ),
  n(
    "weaveDepth",
    "Over/under depth (mm)",
    "Độ lồi lõm đan (mm)",
    "basket",
    1.2,
    0,
    4,
    0.1,
    ["basket"],
  ),
  n(
    "bottomBand",
    "Solid bottom band (mm)",
    "Dải đặc đáy (mm)",
    "basket",
    6,
    2,
    25,
    0.1,
    ["basket"],
  ),
  n(
    "topBand",
    "Solid rim band (mm)",
    "Dải đặc miệng (mm)",
    "basket",
    5,
    2,
    25,
    0.1,
    ["basket"],
  ),
  n(
    "stampHandleHeight",
    "Handle height (mm)",
    "Cao cán dấu (mm)",
    "stamp",
    45,
    15,
    100,
    0.1,
    ["stamp"],
  ),
  n(
    "stampHandleDiameter",
    "Handle diameter (mm)",
    "Đường kính cán dấu (mm)",
    "stamp",
    25,
    12,
    60,
    0.1,
    ["stamp"],
  ),
  n(
    "threadDepth",
    "Thread engagement (mm)",
    "Độ ăn ren (mm)",
    "stamp",
    8,
    4,
    15,
    0.1,
    ["stamp"],
  ),
  s(
    "clickerMode",
    "Keycap style",
    "Kiểu keycap",
    "clicker",
    "keys",
    [
      ["keys", "One key per character", "Một phím mỗi chữ"],
      ["shape", "Graphic silhouette", "Theo hình"],
      ["name", "Name silhouette", "Theo tên"],
    ],
    ["clicker"],
  ),
  n("switchCount", "Switch mounts", "Số đế công tắc", "clicker", 2, 1, 12, 1, [
    "clicker",
  ]),
  n(
    "switchPitch",
    "Switch pitch (mm)",
    "Bước công tắc (mm)",
    "clicker",
    19.05,
    16,
    24,
    0.05,
    ["clicker"],
  ),
  n(
    "switchHole",
    "Switch cutout (mm)",
    "Lỗ gắn công tắc (mm)",
    "clicker",
    14,
    13.5,
    15,
    0.05,
    ["clicker"],
  ),
  n(
    "capWall",
    "Keycap wall (mm)",
    "Dày keycap (mm)",
    "clicker",
    1.8,
    1,
    4,
    0.1,
    ["clicker"],
  ),
  n(
    "stemClearance",
    "MX stem clearance (mm)",
    "Dung sai chân MX (mm)",
    "clicker",
    0.1,
    0,
    0.4,
    0.01,
    ["clicker"],
  ),
  n(
    "dotDiameter",
    "Braille dot diameter (mm)",
    "Đường kính chấm Braille (mm)",
    "braille",
    1.5,
    1.2,
    2,
    0.05,
    ["braille"],
  ),
  n(
    "dotHeight",
    "Braille dot rise (mm)",
    "Độ nổi chấm Braille (mm)",
    "braille",
    0.6,
    0.3,
    1,
    0.05,
    ["braille"],
  ),
  n(
    "dotPitch",
    "Dot pitch (mm)",
    "Bước chấm (mm)",
    "braille",
    2.5,
    2,
    3.2,
    0.05,
    ["braille"],
  ),
  n(
    "cellPitch",
    "Cell pitch (mm)",
    "Bước ô Braille (mm)",
    "braille",
    6,
    5,
    9,
    0.1,
    ["braille"],
  ),
  b(
    "printedLabel",
    "Matching printed label",
    "Kèm nhãn chữ thường",
    "braille",
    true,
    ["braille"],
  ),
  n("scanColumns", "Code columns", "Số cột mã", "scan", 3, 1, 6, 1, [
    "scan-board",
  ]),
  n(
    "codeGap",
    "Gap between codes (mm)",
    "Khoảng cách mã (mm)",
    "scan",
    8,
    2,
    25,
    0.1,
    ["scan-board"],
  ),
  b("nfcPocket", "NFC pocket behind codes", "Hốc NFC sau mã", "scan", true, [
    "scan-board",
  ]),
  n(
    "nfcDiameter",
    "NFC diameter (mm)",
    "Đường kính NFC (mm)",
    "scan",
    25,
    10,
    40,
    0.1,
    ["scan-board"],
  ),
  b(
    "useArtworkShape",
    "Use artwork silhouette",
    "Dùng đường viền ảnh",
    "plate",
    false,
    ["cutter", "trace", "shoe", "text", "topper", "tray"],
  ),
  n("stakeCount", "Stakes", "Số chân cắm", "shape", 2, 1, 4, 1, ["topper"]),
  n(
    "stakeLength",
    "Stake length (mm)",
    "Dài chân cắm (mm)",
    "shape",
    65,
    10,
    180,
    0.5,
    ["topper"],
  ),
  n(
    "stakeWidth",
    "Stake width (mm)",
    "Rộng chân cắm (mm)",
    "shape",
    4,
    2,
    12,
    0.1,
    ["topper"],
  ),
  n(
    "buttonStem",
    "Button neck radius (mm)",
    "Bán kính cổ nút (mm)",
    "fit",
    2.8,
    1,
    5,
    0.1,
    ["shoe"],
  ),
  n(
    "buttonNeck",
    "Button neck length (mm)",
    "Dài cổ nút (mm)",
    "fit",
    2.5,
    1,
    8,
    0.1,
    ["shoe"],
  ),
  n(
    "buttonDiameter",
    "Button diameter (mm)",
    "Đường kính nút (mm)",
    "fit",
    11,
    6,
    20,
    0.1,
    ["shoe"],
  ),
  s(
    "medalStyle",
    "Medal decoration",
    "Trang trí huy chương",
    "pattern",
    "wreath",
    [
      ["wreath", "Laurel wreath", "Vòng nguyệt quế"],
      ["rings", "Concentric rings", "Vòng đồng tâm"],
      ["recessed", "Recessed centre", "Lòng huy chương chìm"],
      ["plain", "Plain", "Trơn"],
    ],
    ["medal"],
  ),
  n(
    "medalInset",
    "Centre inset (mm)",
    "Lùi lòng huy chương (mm)",
    "pattern",
    5,
    1,
    15,
    0.1,
    ["medal"],
  ),
  n(
    "medalRecess",
    "Centre depth (mm)",
    "Độ chìm lòng huy chương (mm)",
    "pattern",
    0.8,
    0.2,
    3,
    0.1,
    ["medal"],
  ),
  n(
    "ringCount",
    "Concentric rings",
    "Số vòng đồng tâm",
    "pattern",
    3,
    1,
    10,
    1,
    ["medal"],
  ),
  n(
    "ringThickness",
    "Ring thickness (mm)",
    "Dày vòng (mm)",
    "pattern",
    0.8,
    0.4,
    3,
    0.1,
    ["medal"],
  ),
  n(
    "ringGap",
    "Gap between rings (mm)",
    "Khoảng cách vòng (mm)",
    "pattern",
    1.5,
    0.4,
    8,
    0.1,
    ["medal"],
  ),
  n(
    "leafCount",
    "Leaves per branch",
    "Số lá mỗi nhánh",
    "pattern",
    12,
    3,
    30,
    1,
    ["medal"],
  ),
  n(
    "wreathRadius",
    "Wreath radius (0 = automatic)",
    "Bán kính vòng lá (0 = tự động)",
    "pattern",
    0,
    0,
    100,
    0.1,
    ["medal"],
  ),
  n(
    "wreathOpening",
    "Top opening (°)",
    "Góc mở phía trên (°)",
    "pattern",
    60,
    15,
    180,
    1,
    ["medal"],
  ),
  n("leafLength", "Leaf length (mm)", "Dài lá (mm)", "pattern", 7, 2, 20, 0.1, [
    "medal",
  ]),
  n(
    "leafWidth",
    "Leaf width (mm)",
    "Rộng lá (mm)",
    "pattern",
    2.8,
    1,
    10,
    0.1,
    ["medal"],
  ),
  n(
    "leafTilt",
    "Leaf tilt (°)",
    "Góc nghiêng lá (°)",
    "pattern",
    35,
    0,
    80,
    1,
    ["medal"],
  ),
  n(
    "leafTaper",
    "Leaf tip taper (%)",
    "Độ nhọn lá (%)",
    "pattern",
    60,
    10,
    100,
    1,
    ["medal"],
  ),
  n(
    "leafSickle",
    "Leaf curvature (%)",
    "Độ cong lá (%)",
    "pattern",
    20,
    -80,
    80,
    1,
    ["medal"],
  ),
  b(
    "wreathBoth",
    "Leaves on both sides of stem",
    "Lá hai bên cành",
    "pattern",
    true,
    ["medal"],
  ),
  b(
    "wreathStagger",
    "Stagger leaf rows",
    "Xen kẽ các hàng lá",
    "pattern",
    true,
    ["medal"],
  ),
  n(
    "wreathStem",
    "Stem width (mm)",
    "Rộng cành (mm)",
    "pattern",
    0.8,
    0.4,
    3,
    0.1,
    ["medal"],
  ),
  n(
    "wreathRise",
    "Wreath rise (mm)",
    "Độ nổi vòng lá (mm)",
    "pattern",
    0.8,
    0.2,
    3,
    0.1,
    ["medal"],
  ),
  b("wreathStar", "Star at base", "Ngôi sao dưới vòng lá", "pattern", false, [
    "medal",
  ]),
  s(
    "sport",
    "Ball pattern",
    "Loại bóng",
    "pattern",
    "basketball",
    [
      ["basketball", "Basketball", "Bóng rổ"],
      ["soccer", "Football", "Bóng đá"],
      ["baseball", "Baseball", "Bóng chày"],
      ["softball", "Softball", "Bóng mềm"],
      ["tennis", "Tennis", "Quần vợt"],
      ["volleyball", "Volleyball", "Bóng chuyền"],
      ["golf", "Golf", "Golf"],
    ],
    ["sports"],
  ),
];
FIELDS.push(
  s(
    "stampPreset",
    "Stamp preset",
    "Mẫu dấu",
    "stamp",
    "custom",
    [
      ["custom", "Custom", "Tùy chỉnh"],
      ["blank", "Blank", "Trống"],
      ["overdue", "OVERDUE", "Quá hạn"],
      ["priority", "PRIORITY", "Ưu tiên"],
      ["approved", "APPROVED", "Đã duyệt"],
      ["paid", "PAID", "Đã trả"],
      ["draft", "DRAFT", "Bản nháp"],
      ["confirmed", "CONFIRMED", "Đã xác nhận"],
      ["address", "Return address", "Địa chỉ"],
      ["seal", "Round seal", "Dấu tròn"],
      ["multiline", "Multiple lines", "Nhiều dòng"],
    ],
    ["stamp"],
  ),
  b(
    "tidyStencil",
    "Fill tiny counter details",
    "Lấp chi tiết lỗ nhỏ",
    "cutter",
    false,
    ["stencil"],
  ),
  n(
    "stencilDetail",
    "Fill holes smaller than (mm)",
    "Lấp lỗ nhỏ hơn (mm)",
    "cutter",
    2,
    0.1,
    10,
    0.1,
    ["stencil"],
  ),
  n(
    "bridgesPerIsland",
    "Bridges per island",
    "Số cầu cho mỗi phần rời",
    "cutter",
    1,
    1,
    4,
    1,
    ["stencil"],
  ),
  n(
    "bridgeAngle",
    "Bridge angle (°)",
    "Góc cầu nối (°)",
    "cutter",
    0,
    -180,
    180,
    1,
    ["stencil"],
  ),
  n(
    "standWrap",
    "Cradle wrap (mm)",
    "Ôm hai đầu chân đế (mm)",
    "ring",
    0,
    0,
    15,
    0.5,
    flat,
  ),
  n(
    "standSlope",
    "Sloped ends (mm)",
    "Vát đầu chân đế (mm)",
    "ring",
    3,
    0,
    15,
    0.5,
    flat,
  ),
  {
    ...b("calibration", "Calibration model", "Mẫu hiệu chuẩn", "fit"),
    when: () => false,
  },
  n(
    "capProud",
    "Keycap skirt / travel height (mm)",
    "Cao váy / hành trình phím (mm)",
    "clicker",
    4,
    2,
    8,
    0.1,
    ["clicker"],
  ),
  {
    key: "manualSwitches",
    label: ["Switch centres: x,y; x,y (mm)", "Tâm công tắc: x,y; x,y (mm)"],
    group: group.clicker,
    type: "text",
    value: "",
    families: ["clicker"],
  },
  n(
    "ringAngle",
    "Hanging angle (°)",
    "Góc tai treo (°)",
    "ring",
    0,
    -180,
    180,
    1,
    flat,
  ),
  n(
    "starSharpness",
    "Star inner radius (%)",
    "Bán kính trong sao (%)",
    "plate",
    45,
    15,
    85,
    1,
  ),
  s(
    "keyShape",
    "Key shape",
    "Hình phím",
    "clicker",
    "square",
    [
      ["square", "Rounded square", "Vuông bo góc"],
      ["circle", "Circle", "Tròn"],
      ["hexagon", "Hexagon", "Lục giác"],
      ["heart", "Heart", "Trái tim"],
      ["star", "Star", "Ngôi sao"],
      ["outline", "Letter outline", "Theo đường viền chữ"],
    ],
    ["clicker"],
  ),
  n(
    "keySize",
    "Key size (mm)",
    "Kích thước phím (mm)",
    "clicker",
    18,
    14,
    40,
    0.1,
    ["clicker"],
  ),
  n(
    "legendSize",
    "Legend size (mm)",
    "Cỡ chữ trên phím (mm)",
    "clicker",
    12,
    4,
    30,
    0.1,
    ["clicker"],
  ),
  color("capColor", "Keycap colour", "Màu keycap", "clicker", "#FFFFFF"),
  s(
    "joinStyle",
    "Holder style",
    "Kiểu thanh giữ",
    "clicker",
    "bar",
    [
      ["bar", "Straight bar", "Thanh thẳng"],
      ["linked", "Linked shapes", "Nối các hình"],
      ["stagger", "Staggered", "So le"],
    ],
    ["clicker"],
  ),
  n(
    "clickerFloor",
    "Pocket floor (mm)",
    "Đáy hốc công tắc (mm)",
    "clicker",
    1.6,
    1,
    5,
    0.1,
    ["clicker"],
  ),
  b(
    "artKey",
    "Additional artwork keycap",
    "Thêm keycap hình ảnh",
    "clicker",
    false,
    ["clicker"],
  ),
  b(
    "headerPiece",
    "Header / footer piece",
    "Miếng đầu / cuối",
    "clicker",
    false,
    ["clicker"],
  ),
  s(
    "headerPosition",
    "Piece position",
    "Vị trí miếng",
    "clicker",
    "before",
    [
      ["before", "Before first key", "Trước phím đầu"],
      ["after", "After last key", "Sau phím cuối"],
    ],
    ["clicker"],
  ),
  s(
    "headerLayout",
    "Piece layout",
    "Bố trí miếng",
    "clicker",
    "inline",
    [
      ["inline", "Inline", "Cùng hàng"],
      ["stacked", "Above row", "Phía trên hàng"],
    ],
    ["clicker"],
  ),
  {
    key: "headerText",
    label: ["Piece text", "Chữ trên miếng"],
    group: group.clicker,
    type: "text",
    value: "HELLO",
    families: ["clicker"],
  },
  n(
    "headerTextSize",
    "Piece font size (mm)",
    "Cỡ chữ miếng (mm)",
    "clicker",
    12,
    3,
    40,
    0.1,
    ["clicker"],
  ),
  n(
    "headerSize",
    "Piece size (mm)",
    "Kích thước miếng (mm)",
    "clicker",
    30,
    15,
    100,
    0.5,
    ["clicker"],
  ),
  n(
    "headerOverlap",
    "Weld into holder (mm)",
    "Độ ghép vào thanh (mm)",
    "clicker",
    3,
    0.5,
    15,
    0.1,
    ["clicker"],
  ),
  n(
    "headerSwitches",
    "Piece switch mounts",
    "Số công tắc trên miếng",
    "clicker",
    0,
    0,
    3,
    1,
    ["clicker"],
  ),
  b(
    "headerArt",
    "Use artwork on piece",
    "Dùng ảnh trên miếng",
    "clicker",
    true,
    ["clicker"],
  ),
  s(
    "basketProfile",
    "Side profile",
    "Biên dạng thân",
    "basket",
    "vase",
    [
      ["straight", "Straight", "Thẳng"],
      ["flared", "Flared", "Loe miệng"],
      ["vase", "Belly and neck", "Bụng và cổ"],
    ],
    ["basket"],
  ),
  n(
    "stakeThickness",
    "Stake thickness (mm)",
    "Dày nan đứng (mm)",
    "basket",
    2.5,
    1,
    8,
    0.1,
    ["basket"],
  ),
  n(
    "weaverThickness",
    "Weaver thickness (mm)",
    "Dày nan ngang (mm)",
    "basket",
    2.5,
    1,
    8,
    0.1,
    ["basket"],
  ),
  n(
    "weaverGap",
    "Gap between weavers (mm)",
    "Khoảng cách nan ngang (mm)",
    "basket",
    7,
    1,
    25,
    0.1,
    ["basket"],
  ),
  n(
    "strandAngle",
    "Lattice angle (°)",
    "Góc sợi lưới (°)",
    "basket",
    45,
    15,
    75,
    1,
    ["basket"],
  ),
  b("spiralWeavers", "Spiral weavers", "Nan ngang xoắn ốc", "basket", false, [
    "basket",
  ]),
  s(
    "basketFloor",
    "Floor style",
    "Kiểu đáy",
    "basket",
    "solid",
    [
      ["solid", "Solid", "Đặc"],
      ["holes", "Open grid", "Lưới thoáng"],
      ["woven", "Woven floor", "Đáy đan"],
    ],
    ["basket"],
  ),
  b(
    "separateBands",
    "Separate band colour",
    "Đổi màu dải đặc",
    "basket",
    false,
    ["basket"],
  ),
  color("bandColor", "Band colour", "Màu dải đặc", "basket", "#A47551"),
  b(
    "separateWeave",
    "Separate lattice colour",
    "Đổi màu lưới",
    "basket",
    false,
    ["basket"],
  ),
  color("weaveColor", "Lattice colour", "Màu lưới", "basket", "#D1AD82"),
  s(
    "cordPreset",
    "Cord / pen preset",
    "Mẫu dây / bút",
    "bead",
    "custom",
    [
      ["cord", "Cord 5 mm", "Dây 5 mm"],
      ["straw", "Straw 6 mm", "Ống hút 6 mm"],
      ["pencil", "Hex pencil 8 mm", "Bút chì lục giác 8 mm"],
      ["apple-pencil", "Apple Pencil 8.9 mm", "Apple Pencil 8,9 mm"],
      ["bic", "BIC Cristal 9.6 mm", "BIC Cristal 9,6 mm"],
      ["pen", "Round pen 10 mm", "Bút tròn 10 mm"],
      ["sharpie", "Sharpie 11.5 mm", "Sharpie 11,5 mm"],
      ["boba", "Bubble tea straw 12 mm", "Ống hút trà sữa 12 mm"],
      ["marker", "Marker 12.7 mm", "Bút lông 12,7 mm"],
      ["custom", "Custom", "Tùy chỉnh"],
    ],
    ["bead"],
  ),
  s(
    "beadSizing",
    "Bead sizing",
    "Kích thước hạt",
    "bead",
    "auto",
    [
      ["auto", "Scale", "Tỷ lệ"],
      ["fixed", "Exact width", "Chiều rộng chính xác"],
      ["dims", "Exact L × W × H", "Chính xác D × R × C"],
    ],
    ["bead"],
  ),
  n("beadScale", "Scale ×", "Tỷ lệ ×", "bead", 1, 0.25, 5, 0.05, ["bead"]),
  n(
    "beadWidth",
    "Exact face width (mm)",
    "Rộng mặt chính xác (mm)",
    "bead",
    16,
    5,
    100,
    0.1,
    ["bead"],
  ),
  n(
    "cordFit",
    "Cord fit clearance (mm)",
    "Dung sai lỗ dây (mm)",
    "bead",
    0.2,
    0,
    1,
    0.05,
    ["bead"],
  ),
  n(
    "holePosition",
    "Cord hole offset (mm)",
    "Độ lệch lỗ dây (mm)",
    "bead",
    0,
    -20,
    20,
    0.1,
    ["bead"],
  ),
  b("topperName", "Weld name and artwork", "Ghép tên và hình", "bead", false, [
    "bead",
  ]),
  s(
    "shoePreset",
    "Fits shoe / bag",
    "Mẫu giày / túi",
    "fit",
    "custom",
    [
      ["clog", "Clog 10 mm", "Giày sục 10 mm"],
      ["clog-small", "Small clog 8 mm", "Giày sục nhỏ 8 mm"],
      ["bag-12", "Bag 12 mm", "Túi 12 mm"],
      ["bag-14", "Bag 14 mm", "Túi 14 mm"],
      ["bag-16", "Bag 16 mm", "Túi 16 mm"],
      ["custom", "Custom", "Tùy chỉnh"],
    ],
    ["shoe"],
  ),
  n(
    "frameFace",
    "Front face thickness (mm)",
    "Dày mặt trước (mm)",
    "frame",
    1.2,
    0.8,
    5,
    0.1,
    ["frame"],
  ),
  n(
    "frameOverlap",
    "Photo overlap (mm)",
    "Mép giữ ảnh (mm)",
    "frame",
    1.5,
    0.5,
    6,
    0.1,
    ["frame"],
  ),
  n(
    "framePlug",
    "Back plug depth (mm)",
    "Độ sâu ngàm nắp (mm)",
    "frame",
    1.2,
    0.5,
    5,
    0.1,
    ["frame"],
  ),
  n(
    "framePanel",
    "Back panel thickness (mm)",
    "Dày tấm lưng (mm)",
    "frame",
    1.5,
    0.8,
    5,
    0.1,
    ["frame"],
  ),
  s(
    "frameHold",
    "Back closure",
    "Giữ nắp lưng",
    "frame",
    "snap",
    [
      ["snap", "Snap detent", "Ngàm bấm"],
      ["friction", "Press fit", "Ép ma sát"],
      ["magnets", "Magnets", "Nam châm"],
    ],
    ["frame"],
  ),
  b(
    "frameSeparateBorder",
    "Separate front border",
    "Viền mặt trước rời",
    "frame",
    false,
    ["frame"],
  ),
  s(
    "frameBorderFit",
    "Front border attachment",
    "Gắn viền mặt trước",
    "frame",
    "glue",
    [
      ["glue", "Flat glue faces", "Dán keo mặt phẳng"],
      ["magnets", "Magnet pockets", "Hốc nam châm"],
    ],
    ["frame"],
  ),
  n(
    "frameMagnetDiameter",
    "Magnet diameter (mm)",
    "Đường kính nam châm (mm)",
    "frame",
    5,
    3,
    12,
    0.1,
    ["frame"],
  ),
  n(
    "frameMagnetHeight",
    "Magnet thickness (mm)",
    "Dày nam châm (mm)",
    "frame",
    1.2,
    0.5,
    4,
    0.1,
    ["frame"],
  ),
  s(
    "frameMagnetCount",
    "Magnets",
    "Số nam châm",
    "frame",
    "2",
    [
      ["2", "Two sides", "Hai cạnh"],
      ["4", "Four sides", "Bốn cạnh"],
    ],
    ["frame"],
  ),
  s(
    "frameMount",
    "Mounting",
    "Cách đặt khung",
    "frame",
    "desk",
    [
      ["desk", "Slide-in desk easel", "Chân bàn trượt"],
      ["wall", "Wall hanging", "Treo tường"],
      ["none", "None", "Không"],
    ],
    ["frame"],
  ),
  n(
    "easelHeight",
    "Easel height (mm)",
    "Cao chân chống (mm)",
    "frame",
    70,
    20,
    250,
    0.5,
    ["frame"],
  ),
  n(
    "easelDepth",
    "Easel foot depth (mm)",
    "Độ rộng chân chống (mm)",
    "frame",
    25,
    10,
    80,
    0.5,
    ["frame"],
  ),
  s(
    "dividerMode",
    "Divider arrangement",
    "Kiểu vách ngăn",
    "tray",
    "grid",
    [
      ["grid", "Grid", "Dạng lưới"],
      ["halves", "Two halves", "Hai nửa"],
      ["cross", "Four quadrants", "Bốn góc"],
      ["spokes", "Spokes / wedges", "Nan / múi"],
    ],
    ["tray", "box"],
  ),
  n("wedges", "Wedges", "Số múi", "tray", 6, 2, 16, 1, ["tray", "box"]),
  {
    key: "dividerX",
    label: [
      "Manual divider X positions (mm, comma separated)",
      "Vị trí vách X (mm, cách bằng dấu phẩy)",
    ],
    group: group.tray,
    type: "text",
    value: "",
    families: ["tray", "box"],
  },
  {
    key: "dividerY",
    label: [
      "Manual divider Y positions (mm, comma separated)",
      "Vị trí vách Y (mm, cách bằng dấu phẩy)",
    ],
    group: group.tray,
    type: "text",
    value: "",
    families: ["tray", "box"],
  },
  s(
    "compartmentShape",
    "Compartment shape",
    "Hình ngăn",
    "tray",
    "circle",
    [
      ["circle", "Circle", "Tròn"],
      ["oval", "Oval", "Bầu dục"],
      ["rounded", "Rounded rectangle", "Chữ nhật bo"],
      ["heart", "Heart", "Trái tim"],
      ["star", "Star", "Ngôi sao"],
      ["hexagon", "Hexagon", "Lục giác"],
      ["cloud", "Cloud", "Mây"],
    ],
    ["tray"],
  ),
  n(
    "compartmentRadius",
    "Ring radius (0 = automatic)",
    "Bán kính bố trí (0 = tự động)",
    "tray",
    0,
    0,
    120,
    0.5,
    ["tray"],
  ),
  b(
    "pointOutward",
    "Point compartments outward",
    "Xoay ngăn ra ngoài",
    "tray",
    false,
    ["tray"],
  ),
  b(
    "centreCompartment",
    "Centre compartment",
    "Ngăn chính giữa",
    "tray",
    false,
    ["tray"],
  ),
  s(
    "edgeFinish",
    "Rim edge finish",
    "Bo mép khay",
    "tray",
    "fillet",
    [
      ["fillet", "Rounded", "Bo tròn"],
      ["chamfer", "45° chamfer", "Vát 45°"],
      ["square", "Square", "Vuông"],
    ],
    ["tray"],
  ),
  n(
    "edgeRadius",
    "Edge radius (mm)",
    "Bán kính mép (mm)",
    "tray",
    0.6,
    0,
    3,
    0.1,
    ["tray"],
  ),
);
FIELDS.push(
  s(
    "stampMount",
    "Handle mount",
    "Khớp cán dấu",
    "stamp",
    "thread",
    [
      ["none", "Solid back", "Mặt sau đặc"],
      ["thread", "Threaded socket", "Lỗ ren"],
    ],
    ["stamp"],
  ),
  b("includeHandle", "Include separate handle", "Thêm cán rời", "stamp", true, [
    "stamp",
  ]),
  s(
    "handleStyle",
    "Handle style",
    "Kiểu cán",
    "stamp",
    "dome",
    [
      ["dome", "Tapered dome", "Vòm thuôn"],
      ["cylinder", "Straight cylinder", "Trụ thẳng"],
    ],
    ["stamp"],
  ),
  s(
    "threadFit",
    "Thread fit",
    "Độ khít ren",
    "fit",
    "profile",
    [
      ["profile", "Printer profile", "Theo máy in"],
      ["tight", "Tight", "Khít"],
      ["normal", "Normal", "Vừa"],
      ["loose", "Loose", "Lỏng"],
      ["custom", "Custom", "Tùy chỉnh"],
    ],
    ["stamp", "roller"],
  ),
  n(
    "threadClearance",
    "Thread clearance (mm)",
    "Khe hở ren (mm)",
    "fit",
    0.2,
    0.05,
    0.8,
    0.05,
    ["stamp", "roller"],
  ),
  s(
    "lidPull",
    "Lid pull",
    "Tay kéo nắp",
    "box",
    "grip",
    [
      ["grip", "Raised grip", "Gờ kéo"],
      ["ring", "Ring pull", "Khoen kéo"],
      ["none", "None", "Không"],
    ],
    ["box"],
  ),
  b(
    "repeatFloorArt",
    "Repeat artwork in every compartment",
    "Lặp ảnh trong từng ngăn",
    "tray",
    false,
    ["tray"],
  ),
  b(
    "stencilBridges",
    "Keep bridges for islands",
    "Giữ cầu nối phần rời",
    "cutter",
    true,
    ["stencil"],
  ),
  b(
    "stencilHandle",
    "Add flat grip handle",
    "Thêm tay cầm phẳng",
    "cutter",
    false,
    ["stencil"],
  ),
  n(
    "stencilHandleLength",
    "Grip length (mm)",
    "Dài tay cầm (mm)",
    "cutter",
    25,
    10,
    80,
    1,
    ["stencil"],
  ),
  s(
    "patternLayout",
    "Picture / text layout",
    "Bố trí ảnh / chữ",
    "roller",
    "tile",
    [
      ["tile", "Repeat over surface", "Lặp trên bề mặt"],
      ["wrap", "One picture over surface", "Một ảnh phủ bề mặt"],
    ],
    ["roller"],
  ),
  s(
    "patternFit",
    "Picture fit",
    "Căn ảnh",
    "roller",
    "contain",
    [
      ["contain", "Whole picture", "Trọn ảnh"],
      ["cover", "Fill and crop", "Phủ kín, cắt dư"],
      ["width", "Fit width", "Vừa chiều rộng"],
    ],
    ["roller"],
  ),
  s(
    "patternArrangement",
    "Repeat arrangement",
    "Bố trí họa tiết lặp",
    "roller",
    "grid",
    [
      ["grid", "Rows", "Theo hàng"],
      ["halfdrop", "Staggered", "So le"],
      ["mirror", "Mirrored pairs", "Cặp đối xứng"],
      ["scatter", "Scattered", "Rải ngẫu nhiên"],
    ],
    ["roller"],
  ),
  n(
    "motifSize",
    "Motif size (mm)",
    "Cỡ họa tiết (mm)",
    "roller",
    16,
    4,
    100,
    1,
    ["roller"],
  ),
  n(
    "motifGap",
    "Motif gap (mm)",
    "Khoảng họa tiết (mm)",
    "roller",
    5,
    1,
    50,
    0.5,
    ["roller"],
  ),
  n(
    "variation",
    "Pattern variation",
    "Biến thể hoa văn",
    "roller",
    1,
    1,
    100,
    1,
    ["roller"],
  ),
  s(
    "reliefShape",
    "Relief edge",
    "Cạnh phù điêu",
    "roller",
    "flat",
    [
      ["flat", "Crisp", "Vuông rõ"],
      ["pillow", "Rounded", "Bo tròn"],
      ["chisel", "Bevelled", "Vát cạnh"],
    ],
    ["roller"],
  ),
  n(
    "reliefRound",
    "Relief rounding (mm)",
    "Bo phù điêu (mm)",
    "roller",
    0.3,
    0,
    2,
    0.1,
    ["roller"],
  ),
  s(
    "rollerJoin",
    "Handle connection",
    "Khớp cán con lăn",
    "roller",
    "fixed",
    [
      ["fixed", "Fixed threaded handles", "Cán ren cố định"],
      ["push", "Fixed push-fit handles", "Cán cắm cố định"],
      ["spin", "Spinning axle", "Trục quay tự do"],
    ],
    ["roller"],
  ),
  n(
    "spinClearance",
    "Axle running clearance (mm)",
    "Khe hở trục quay (mm)",
    "roller",
    0.35,
    0.15,
    0.8,
    0.05,
    ["roller"],
  ),
);
FIELDS.find((f) => f.key === "threadSize")!.options!.unshift({
  value: "M8",
  label: ["M8", "M8"],
});
FIELDS.find((f) => f.key === "sport")!.options!.push(
  { value: "football", label: ["American football", "Bóng bầu dục"] },
  { value: "pickleball", label: ["Pickleball", "Pickleball"] },
);
FIELDS.find((f) => f.key === "dome")!.families = [...flat, "clicker"];
FIELDS.find((f) => f.key === "edgeFinish")!.families = [...flat, "tray"];
FIELDS.find((f) => f.key === "edgeRadius")!.families = [...flat, "tray"];
FIELDS.find((f) => f.key === "layout")!.options!.push({
  value: "ring",
  label: ["Ring of compartments", "Vòng các ngăn"],
});
FIELDS.find((f) => f.key === "pattern")!.options!.push(
  ...(
    [
      ["weave", "Basket weave", "Đan giỏ"],
      ["herringbone", "Herringbone", "Xương cá"],
      ["diagonal", "Diagonal ribs", "Gân chéo"],
      ["rope", "Rope", "Dây thừng"],
      ["fluted", "Fluted", "Rãnh dọc"],
      ["ribbed", "Ribbed", "Gân ngang"],
      ["bubbles", "Random bubbles", "Bong bóng"],
      ["brick", "Brick wall", "Tường gạch"],
      ["stone", "Fieldstone", "Đá thô"],
      ["cobble", "Cobblestones", "Đá cuội"],
      ["voronoi", "Voronoi cells", "Ô Voronoi"],
      ["tiles", "Small tiles", "Gạch nhỏ"],
      ["waves", "Ocean waves", "Sóng biển"],
      ["zigzag", "Zigzag", "Zíc zắc"],
      ["scales", "Fish scales", "Vảy cá"],
      ["dots", "Polka dots", "Chấm bi"],
      ["diamonds", "Diamonds", "Hình thoi"],
      ["quilted", "Quilted diamonds", "Chần quả trám"],
    ] as [string, string, string][]
  ).map(([value, en, vi]) => ({ value, label: [en, vi] as Bilingual })),
);
export const PARAM_DEFAULTS = Object.fromEntries(
  FIELDS.map((f) => [f.key, f.value]),
);
export function updateParameter(
  params: Record<string, Value>,
  key: string,
  value: Value,
) {
  const next = { ...params, [key]: value };
  if (key === "cordPreset") {
    const sizes: Record<string, number> = {
      cord: 5,
      straw: 6,
      pencil: 8,
      "apple-pencil": 8.9,
      bic: 9.6,
      pen: 10,
      sharpie: 11.5,
      boba: 12,
      marker: 12.7,
    };
    if (sizes[String(value)]) {
      next.holeDiameter = sizes[String(value)];
      next.holeShape = value === "pencil" ? "hex" : "round";
    }
  }
  if (key === "shoePreset" && value !== "custom") {
    const d: Record<string, number> = {
      clog: 10,
      "clog-small": 8,
      "bag-12": 12,
      "bag-14": 14,
      "bag-16": 16,
    };
    next.buttonDiameter = d[String(value)] + 1;
    next.buttonStem = d[String(value)] * 0.28;
    next.buttonNeck = value === "clog-small" ? 2 : 2.5;
  }
  return next;
}
export function cleanParams(
  input: Record<string, unknown>,
): Record<string, Value> {
  const out = { ...PARAM_DEFAULTS };
  for (const f of FIELDS) {
    const v = input[f.key];
    if (f.type === "number" && typeof v === "number" && Number.isFinite(v))
      out[f.key] = Math.max(f.min!, Math.min(f.max!, v));
    else if (f.type === "boolean" && typeof v === "boolean") out[f.key] = v;
    else if (
      f.type === "color" &&
      typeof v === "string" &&
      /^#[0-9a-f]{6}$/i.test(v)
    )
      out[f.key] = v;
    else if (f.type === "text" && typeof v === "string" && v.length <= 200)
      out[f.key] = v;
    else if (f.type === "select" && f.options?.some((o) => o.value === v))
      out[f.key] = v as string;
  }
  return out;
}
export function visibleField(
  f: Field,
  family: Family,
  p: Record<string, Value>,
) {
  if (f.key === "reliefDepth" && family !== "roller") return false;
  if (f.key === "manualSwitches" && p.clickerMode === "keys") return false;
  if (f.key === "ringAngle" && !p.keyring) return false;
  if (["standWrap", "standSlope"].includes(f.key) && !p.stand) return false;
  if (["stencilDetail"].includes(f.key) && !p.tidyStencil) return false;
  if (["bridgesPerIsland", "bridgeAngle"].includes(f.key) && !p.stencilBridges)
    return false;
  if (f.key === "starSharpness" && p.shape !== "star") return false;
  if (
    f.key === "decorationColor" &&
    ![
      "medal",
      "sports",
      "tray",
      "frame",
      "box",
      "stamp",
      "roller",
      "braille",
      "qr",
      "scan-board",
    ].includes(family)
  )
    return false;
  if (f.key === "shape" && ["box", "roller"].includes(family)) return false;
  if (
    f.key === "baseHeight" &&
    ["box", "tray", "cutter", "letter-cutter", "clicker"].includes(family)
  )
    return false;
  if (f.key === "height" && family === "clicker") return false;
  if (
    f.key === "sizing" &&
    ["tray", "braille", "cutter", "letter-cutter", "stencil"].includes(family)
  )
    return false;
  if (family === "frame" && f.key === "snap" && p.frameHold !== "snap")
    return false;
  if (f.key === "threadClearance" && p.threadFit !== "custom") return false;
  if (f.key === "stencilHandleLength" && !p.stencilHandle) return false;
  if (f.key === "bridgeWidth" || f.key === "bridgeDirection") {
    if (family === "stencil" && !p.stencilBridges) return false;
  }
  if (
    family === "stamp" &&
    [
      "includeHandle",
      "threadSize",
      "threadDepth",
      "threadFit",
      "threadClearance",
    ].includes(f.key) &&
    p.stampMount === "none"
  )
    return false;
  if (
    family === "stamp" &&
    ["stampHandleHeight", "stampHandleDiameter", "handleStyle"].includes(
      f.key,
    ) &&
    (p.stampMount === "none" || !p.includeHandle)
  )
    return false;
  if (
    [
      "patternLayout",
      "patternFit",
      "patternArrangement",
      "motifSize",
      "motifGap",
    ].includes(f.key) &&
    !["text", "image", "panel"].includes(String(p.pattern))
  )
    return false;
  if (f.key === "patternFit" && p.patternLayout !== "wrap") return false;
  if (f.key === "reliefRound" && p.reliefShape === "flat") return false;
  if (
    family === "roller" &&
    ["rollerJoin", "spinClearance"].includes(f.key) &&
    ["mat", "sleeve"].includes(String(p.rollerMode))
  )
    return false;
  const hanging = ["ringStyle", "ringPosition", "ringWall"];
  if (family === "clicker" && hanging.includes(f.key)) return !!p.keyring;
  if (
    family === "bead" &&
    ["border", "borderWidth", "borderHeight", "borderColor"].includes(f.key)
  )
    return f.key === "border" || !!p.border;
  if (family === "frame" && f.key === "wall") return p.frameMode !== "plaque";
  if (family === "roller" && f.key === "baseHeight")
    return p.rollerMode === "mat";
  if (family === "roller" && f.key === "height") return p.rollerMode === "mat";
  if (family === "roller" && ["texture", "textureDepth"].includes(f.key))
    return false;
  if (family === "roller" && f.key === "sleeveInner")
    return p.rollerMode === "sleeve";
  if (
    family === "roller" &&
    ["handleLength", "handleDiameter", "threadSize"].includes(f.key)
  )
    return p.rollerMode === "pin";
  if (family === "basket" && f.key === "strand")
    return ["diamond", "honeycomb"].includes(String(p.texture));
  if (family === "basket" && f.key === "stakeThickness")
    return !["diamond", "honeycomb"].includes(String(p.texture));
  if (
    ["sizing", "paddingX", "paddingY"].includes(f.key) &&
    ["bead", "frame", "box", "clicker"].includes(family)
  )
    return false;
  if (["width", "height"].includes(f.key) && family === "frame") return false;
  if (f.key === "baseHeight" && family === "frame")
    return p.frameMode === "plaque";
  if (f.key === "compartments" && p.layout === "single") return false;
  if (f.key === "capColor" && family !== "clicker") return false;
  if (f.key.startsWith("header") && f.key !== "headerPiece" && !p.headerPiece)
    return false;
  if (
    ["keyShape", "keySize", "legendSize", "artKey"].includes(f.key) &&
    p.clickerMode !== "keys"
  )
    return false;
  if (f.key === "bandColor" && (family !== "basket" || !p.separateBands))
    return false;
  if (f.key === "weaveColor" && (family !== "basket" || !p.separateWeave))
    return false;
  if (
    ["bellyScale", "bellyHeight", "neckScale"].includes(f.key) &&
    p.basketProfile === "straight"
  )
    return false;
  if (
    ["bellyScale", "bellyHeight"].includes(f.key) &&
    p.basketProfile === "flared"
  )
    return false;
  if (
    ["weaverThickness", "weaverGap", "spiralWeavers"].includes(f.key) &&
    ["diamond", "honeycomb"].includes(String(p.texture))
  )
    return false;
  if (
    f.key === "strandAngle" &&
    !["diamond", "honeycomb"].includes(String(p.texture))
  )
    return false;
  if (f.key === "beadScale" && p.beadSizing !== "auto") return false;
  if (f.key === "beadWidth" && p.beadSizing !== "fixed") return false;
  if (f.key === "topperName" && p.beadMode === "letters") return false;
  if (
    family === "bead" &&
    ["width", "height"].includes(f.key) &&
    p.beadSizing !== "dims"
  )
    return false;
  if (f.key === "frameBorderFit" && !p.frameSeparateBorder) return false;
  if (
    f.key.startsWith("frameMagnet") &&
    p.frameHold !== "magnets" &&
    (!p.frameSeparateBorder || p.frameBorderFit !== "magnets")
  )
    return false;
  if (["easelHeight", "easelDepth"].includes(f.key) && p.frameMount !== "desk")
    return false;
  if (f.key === "wedges" && p.dividerMode !== "spokes") return false;
  if (["dividerX", "dividerY"].includes(f.key) && p.dividerMode !== "grid")
    return false;
  if (
    [
      "compartmentShape",
      "compartmentRadius",
      "pointOutward",
      "centreCompartment",
    ].includes(f.key) &&
    p.layout === "single"
  )
    return false;
  if (f.key === "edgeRadius" && p.edgeFinish === "square") return false;
  if (f.families && !f.families.includes(family)) return false;
  if (f.when && !f.when(p)) return false;
  const objects: Family[] = [
    "tray",
    "basket",
    "box",
    "cutter",
    "letter-cutter",
  ];
  if (
    ["bodyHeight", "wall", "floor"].includes(f.key) &&
    !objects.includes(family)
  )
    return false;
  if (
    ["texture", "textureDepth", "textureSize"].includes(f.key) &&
    !["tray", "box", "basket", "roller"].includes(family)
  )
    return false;
  if (f.key === "domeHeight" && !p.dome) return false;
  if (f.key.startsWith("middle") && f.key !== "middle" && !p.middle)
    return false;
  if (f.key.startsWith("border") && f.key !== "border" && !p.border)
    return false;
  if (["middle", "border"].includes(f.key) && !flat.includes(family))
    return false;
  if (["ringStyle", "ringPosition", "ringWall"].includes(f.key) && !p.keyring)
    return false;
  if (f.key === "standDepth" && !p.stand) return false;
  if (f.key === "mountInset" && !p.mountHoles) return false;
  if (f.key.startsWith("pocket") && p.backing === "none") return false;
  if (f.key === "reverseMirror" && !p.twoSided && family !== "two-sided")
    return false;
  if (f.key.startsWith("guide") && f.key !== "guideRings" && !p.guideRings)
    return false;
  if (f.key === "catchBump" && !p.lidCatch) return false;
  if (
    [
      "paddingX",
      "paddingY",
      "sizing",
      "textAngle",
      "textGap",
      "baseHeight",
    ].includes(f.key) &&
    ["basket", "roller"].includes(family)
  )
    return false;
  if (
    [
      "middleHeight",
      "middleColor",
      "middleInset",
      "borderWidth",
      "borderHeight",
      "borderColor",
    ].includes(f.key) &&
    !flat.includes(family)
  )
    return false;
  if (f.key === "height" && p.shape === "circle") return false;
  if (
    f.key === "sides" &&
    !["polygon", "scallop", "gear", "star"].includes(String(p.shape))
  )
    return false;
  if (
    f.key === "corner" &&
    !["rounded", "scallop-rect"].includes(String(p.shape))
  )
    return false;
  if (
    f.key === "autoCodes" &&
    !p.includeQr &&
    !["qr", "scan-board"].includes(family)
  )
    return false;
  if (
    family === "surface-art" &&
    ![
      "modelScale",
      "modelX",
      "modelY",
      "modelZ",
      "baseColor",
      "detail",
      "textGap",
      "textAngle",
    ].includes(f.key)
  )
    return false;
  if (
    family === "basket" &&
    [
      "baseHeight",
      "paddingX",
      "paddingY",
      "sizing",
      "middle",
      "border",
      "textureDepth",
      "textureSize",
      "domeHeight",
      "reliefDepth",
      "decorationColor",
    ].includes(f.key)
  )
    return false;
  if (f.key === "domeHeight" && !p.dome) return false;
  if (f.key === "switchHole") return false; // MX pockets use the validated shared socket asset.
  if (
    ["tabWidth", "tabHeight", "tabCorner", "slotWidth", "slotHeight"].includes(
      f.key,
    ) &&
    (!p.keyring || p.ringStyle !== "slot")
  )
    return false;
  if (
    ["standWidth", "standGrip", "standSeat", "standClearance"].includes(
      f.key,
    ) &&
    !p.stand
  )
    return false;
  if (["domeShape", "domeText"].includes(f.key) && !p.dome) return false;
  if (f.key === "letterHoles" && !p.seeThrough) return false;
  if (["flutes", "fluteDepth"].includes(f.key) && p.shape !== "scallop")
    return false;
  if (["teeth", "toothHeight"].includes(f.key) && p.shape !== "gear")
    return false;
  if (f.key === "pointed" && !["hexagon", "polygon"].includes(String(p.shape)))
    return false;
  if (f.key === "topWidth" && p.shape !== "trapezoid") return false;
  if (f.key === "slant" && p.shape !== "parallelogram") return false;
  if (
    (f.key.startsWith("leaf") || f.key.startsWith("wreath")) &&
    p.medalStyle !== "wreath"
  )
    return false;
  if (
    ["ringCount", "ringThickness", "ringGap"].includes(f.key) &&
    p.medalStyle !== "rings"
  )
    return false;
  if (
    ["medalInset", "medalRecess"].includes(f.key) &&
    p.medalStyle !== "recessed"
  )
    return false;
  return true;
}
