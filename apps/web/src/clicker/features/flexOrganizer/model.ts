export type OrganizerLocale = 'vi' | 'en';
export type OrganizerTexture = 'none' | 'fluted' | 'reeded' | 'ribbed' | 'wavy' | 'faceted';

export interface OrganizerParams {
  width: number;
  depth: number;
  height: number;
  cols: number;
  rows: number;
  wall: number;
  floor: number;
  divider: number;
  radius: number;
  stackingLip: boolean;
  labelTab: boolean;
  fingerScoops: boolean;
  floorHoles: boolean;
  wallTexture: OrganizerTexture;
  textureDepth: number;
  textureCount: number;
  color: string;
}

export interface OrganizerLabel {
  enabled: boolean;
  text: string;
  fontSize: number;
  embossDepth: number;
  plateHeight: number;
  plateColor: string;
  textColor: string;
  fontId: string;
}

export interface OrganizerPreset {
  id: string;
  labelVI: string;
  labelEN: string;
  params: Partial<OrganizerParams>;
}

export interface PrinterOption {
  id: string;
  labelVI: string;
  labelEN: string;
  bed: [number, number];
}

export const DEFAULT_ORGANIZER: OrganizerParams = {
  width: 120,
  depth: 80,
  height: 40,
  cols: 3,
  rows: 2,
  wall: 2,
  floor: 2,
  divider: 1.6,
  radius: 3,
  stackingLip: false,
  labelTab: false,
  fingerScoops: false,
  floorHoles: false,
  wallTexture: 'none',
  textureDepth: 1,
  textureCount: 40,
  color: '#3b82f6',
};

export const DEFAULT_LABEL: OrganizerLabel = {
  enabled: false,
  text: 'LABEL',
  fontSize: 8,
  embossDepth: 0.6,
  plateHeight: 14,
  plateColor: '#e2b23a',
  textColor: '#5c3a10',
  fontId: 'helvetiker-regular',
};

export const PRINTERS: PrinterOption[] = [
  { id: 'a1mini', labelVI: 'Bambu A1 mini', labelEN: 'Bambu A1 mini', bed: [180, 180] },
  { id: 'bambu256', labelVI: 'Bambu A1 / P1 / X1', labelEN: 'Bambu A1 / P1 / X1', bed: [256, 256] },
  { id: 'prusa', labelVI: 'Prusa MK4 / MK3', labelEN: 'Prusa MK4 / MK3', bed: [250, 210] },
  { id: 'ender3', labelVI: 'Ender 3', labelEN: 'Ender 3', bed: [220, 220] },
  { id: 'large', labelVI: 'Large 300 × 300', labelEN: 'Large 300 × 300', bed: [300, 300] },
];

export const PRESETS: OrganizerPreset[] = [
  { id: 'smallTray', labelVI: 'Khay nhỏ', labelEN: 'Small Tray', params: { width: 90, depth: 60, height: 25, cols: 2, rows: 1, wall: 1.6, floor: 1.6, divider: 1.2, radius: 2 } },
  { id: 'deskOrganizer', labelVI: 'Kệ để bàn', labelEN: 'Desk Organizer', params: { width: 180, depth: 100, height: 60, cols: 4, rows: 2, wall: 2, floor: 2, divider: 1.6, radius: 4 } },
  { id: 'partsBin', labelVI: 'Hộp linh kiện', labelEN: 'Parts Bin', params: { width: 120, depth: 80, height: 50, cols: 3, rows: 3, wall: 2, floor: 2, divider: 1.6, radius: 3 } },
  { id: 'drawerInsert', labelVI: 'Ngăn kéo', labelEN: 'Drawer Insert', params: { width: 220, depth: 160, height: 40, cols: 5, rows: 4, wall: 1.6, floor: 1.6, divider: 1.2, radius: 2 } },
  { id: 'toolHolder', labelVI: 'Giá đựng dụng cụ', labelEN: 'Tool Holder', params: { width: 150, depth: 60, height: 80, cols: 6, rows: 1, wall: 2.4, floor: 3, divider: 2, radius: 3 } },
  { id: 'screwSorter', labelVI: 'Phân loại ốc vít', labelEN: 'Screw Sorter', params: { width: 100, depth: 100, height: 30, cols: 4, rows: 4, wall: 1.2, floor: 1.2, divider: 1, radius: 2 } },
];

export const TEXTURES: Array<{ id: OrganizerTexture; labelVI: string; labelEN: string }> = [
  { id: 'none', labelVI: 'Không', labelEN: 'None' },
  { id: 'fluted', labelVI: 'Rãnh lõm', labelEN: 'Fluted' },
  { id: 'reeded', labelVI: 'Gân lồi', labelEN: 'Reeded' },
  { id: 'ribbed', labelVI: 'Sọc vuông', labelEN: 'Ribbed' },
  { id: 'wavy', labelVI: 'Lượn sóng', labelEN: 'Wavy' },
  { id: 'faceted', labelVI: 'Cạnh chéo', labelEN: 'Faceted' },
];

export const ORGANIZER_COPY = {
  vi: {
    title: 'Trình tạo khay & hộp chia', subtitle: 'Tạo khay phân loại 3D vừa với nhu cầu và máy in của bạn.',
    presets: 'Mẫu nhanh', dimensions: 'Kích thước (mm)', grid: 'Lưới ngăn', walls: 'Thành & đáy', style: 'Kiểu dáng', label: 'Nhãn gắn (snap)', info: 'Thông tin mô hình',
    width: 'Rộng', depth: 'Sâu', height: 'Cao', cols: 'Cột', rows: 'Hàng', wall: 'Độ dày thành', floor: 'Độ dày đáy', divider: 'Độ dày vách', radius: 'Bo góc', color: 'Màu khay', texture: 'Vân tường', textureDepth: 'Độ sâu vân', textureCount: 'Mật độ vân',
    lip: 'Vành xếp chồng', tab: 'Tai nhãn', scoops: 'Rãnh lấy đồ', holes: 'Lỗ thoát đáy', printer: 'Máy in', fits: 'Vừa khổ in', notFits: 'Vượt khổ máy in đã chọn',
    labelOn: 'Bật nhãn', labelText: 'Nội dung', fontSize: 'Cỡ chữ', emboss: 'Độ nổi chữ', plateHeight: 'Chiều cao thẻ', font: 'Phông chữ', upload: 'Tải phông lên…', reset: 'Dùng mặc định', plateColor: 'Màu thẻ', textColor: 'Màu chữ',
    bbox: 'Kích thước bao', compartments: 'Số ngăn', cellInner: 'Kích thước ngăn', volume: 'Thể tích vật liệu', weight: 'Khối lượng ước tính (PLA)', tris: 'Số tam giác', download: 'Tải STL', downloadLabel: 'Tải nhãn (2 màu, 3MF)', back: 'Về Dashboard', ready: 'Sẵn sàng', building: 'Đang dựng mô hình…', drag: 'Kéo để xoay • cuộn để zoom',
    language: 'Ngôn ngữ', theme: 'Đổi giao diện', dark: 'Nền tối', light: 'Nền sáng', close: 'Đóng', warning: 'Lưu ý',
  },
  en: {
    title: 'Bin & Sorting Tray Generator', subtitle: 'Build a printable organizer sized for your needs and printer.',
    presets: 'Quick Presets', dimensions: 'Dimensions (mm)', grid: 'Grid Layout', walls: 'Walls & Floor', style: 'Style', label: 'Snap-on Label', info: 'Model Info',
    width: 'Width', depth: 'Depth', height: 'Height', cols: 'Columns', rows: 'Rows', wall: 'Wall Thickness', floor: 'Floor Thickness', divider: 'Divider Thickness', radius: 'Corner Radius', color: 'Bin Color', texture: 'Wall Texture', textureDepth: 'Texture Depth', textureCount: 'Texture Density',
    lip: 'Stacking Lip', tab: 'Label Tab', scoops: 'Finger Scoops', holes: 'Floor Holes', printer: 'Printer', fits: 'Fits print bed', notFits: 'Exceeds the selected print bed',
    labelOn: 'Enable label', labelText: 'Text', fontSize: 'Font size', emboss: 'Emboss depth', plateHeight: 'Tag height', font: 'Typeface', upload: 'Upload font…', reset: 'Use default', plateColor: 'Plate color', textColor: 'Text color',
    bbox: 'Bounding Box', compartments: 'Compartments', cellInner: 'Comp. Inner Size', volume: 'Material Volume', weight: 'Est. Weight (PLA)', tris: 'Triangles', download: 'Download STL', downloadLabel: 'Download Label (2-color, 3MF)', back: 'Back to Dashboard', ready: 'Ready', building: 'Building model…', drag: 'Drag to rotate • scroll to zoom',
    language: 'Language', theme: 'Switch theme', dark: 'Dark mode', light: 'Light mode', close: 'Close', warning: 'Notice',
  },
} as const;

export type OrganizerCopy = (typeof ORGANIZER_COPY)[OrganizerLocale];

export function clampOrganizerParams(input: OrganizerParams): { params: OrganizerParams; warnings: string[] } {
  const warnings: string[] = [];
  const p: OrganizerParams = {
    ...DEFAULT_ORGANIZER,
    ...input,
    width: Math.min(300, Math.max(20, Number.isFinite(input.width) ? input.width : DEFAULT_ORGANIZER.width)),
    depth: Math.min(300, Math.max(20, Number.isFinite(input.depth) ? input.depth : DEFAULT_ORGANIZER.depth)),
    height: Math.min(150, Math.max(5, Number.isFinite(input.height) ? input.height : DEFAULT_ORGANIZER.height)),
    cols: Math.min(12, Math.max(1, Math.round(input.cols))), rows: Math.min(12, Math.max(1, Math.round(input.rows))),
    wall: Math.min(6, Math.max(0.4, Number.isFinite(input.wall) ? input.wall : DEFAULT_ORGANIZER.wall)),
    floor: Math.min(8, Math.max(0.4, Number.isFinite(input.floor) ? input.floor : DEFAULT_ORGANIZER.floor)),
    divider: Math.min(6, Math.max(0.4, Number.isFinite(input.divider) ? input.divider : DEFAULT_ORGANIZER.divider)),
    radius: Math.min(15, Math.max(0, Number.isFinite(input.radius) ? input.radius : DEFAULT_ORGANIZER.radius)),
    textureDepth: Math.min(3, Math.max(0.2, Number.isFinite(input.textureDepth) ? input.textureDepth : DEFAULT_ORGANIZER.textureDepth)),
    textureCount: Math.min(120, Math.max(4, Math.round(input.textureCount))),
    color: /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : DEFAULT_ORGANIZER.color,
  };
  if (p.height <= p.floor + 1) { p.height = p.floor + 1; warnings.push('heightRaised'); }
  const maxCols = Math.max(1, Math.floor((p.width - 2 * p.wall + p.divider) / (1 + p.divider)));
  const maxRows = Math.max(1, Math.floor((p.depth - 2 * p.wall + p.divider) / (1 + p.divider)));
  if (p.cols > maxCols) { p.cols = maxCols; warnings.push('colsReduced'); }
  if (p.rows > maxRows) { p.rows = maxRows; warnings.push('rowsReduced'); }
  const maxRadius = Math.max(0, Math.min(p.width, p.depth) / 2 - p.wall);
  if (p.radius > maxRadius) { p.radius = maxRadius; warnings.push('radiusClamped'); }
  if (p.stackingLip && p.wall < 0.8) warnings.push('lipWallThin');
  const texture = p.wallTexture;
  if (texture !== 'none') {
    const inward = texture === 'fluted' || texture === 'wavy' || texture === 'faceted';
    const maxDepth = inward ? Math.max(0, p.wall - 0.4) : 3;
    if (p.textureDepth > maxDepth) { p.textureDepth = maxDepth; warnings.push('textureClamped'); }
    const perimeter = 2 * (p.width + p.depth);
    const maxCount = Math.max(1, Math.floor(perimeter / (2 * Math.max(p.textureDepth, 0.2))));
    if (p.textureCount > maxCount) { p.textureCount = maxCount; warnings.push('textureClamped'); }
  }
  return { params: p, warnings: [...new Set(warnings)] };
}

export function cellMetrics(params: OrganizerParams) {
  const usableW = params.width - 2 * params.wall - (params.cols - 1) * params.divider;
  const usableD = params.depth - 2 * params.wall - (params.rows - 1) * params.divider;
  return {
    usableW, usableD, cellW: usableW / params.cols, cellD: usableD / params.rows,
    innerR: Math.min(params.radius, usableW / params.cols / 2 - 0.01, usableD / params.rows / 2 - 0.01),
  };
}

export function printerFits(params: OrganizerParams, printer: PrinterOption): boolean {
  const growsOut = params.wallTexture === 'reeded' || params.wallTexture === 'ribbed';
  const extra = growsOut ? 2 * params.textureDepth : 0;
  return params.width + extra <= printer.bed[0] && params.depth + extra <= printer.bed[1];
}
