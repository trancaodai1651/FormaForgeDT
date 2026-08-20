// Shared types. See DEV_PLAN.md §4 for the full target data model; this is the
// walking-skeleton subset.

export type RGB = [number, number, number];

export const FILAMENTS: [string, string][] = [
  ['Black', '#161616'],
  ['White', '#f7f7f5'],
  ['Gray', '#8c8c90'],
  ['Silver', '#cfd0d2'],
  ['Red', '#c8102e'],
  ['Orange', '#ff6a13'],
  ['Yellow', '#f5c518'],
  ['Green', '#00ae42'],
  ['Cyan', '#0086d6'],
  ['Blue', '#0a5cd5'],
  ['Purple', '#8e44ad'],
  ['Pink', '#e6398b'],
  ['Brown', '#7a5230'],
  ['Beige', '#d9c8a9'],
];

/** A closed 2D ring (list of [x,y]); EvenOdd fill handles outer/hole nesting. */
export type Ring = [number, number][];

/** Normalized 2D geometry: silhouette fits within a unit box (longest side = 1),
 *  centered on origin, Y-up. Worker scales by capWidthMm. */
export interface RegionSet {
  /** One entry per palette color actually used. */
  regions: { quantRgb: RGB; components: { rings: Ring[]; coverage: number }[]; coverage: number }[];
  /** Union silhouette of all foreground pixels. */
  outline: Ring[];
  /** Aspect (width/height) of the source silhouette, for reference. */
  aspect: number;
}

/** A color slot for the image/svg/text. */
export interface PaletteEntry {
  quantRgb: RGB; // The original color grouped from the image/svg
  filamentRgb: RGB; // The assigned physical color
  coverage: number; // fraction of foreground pixels
}

export type BaseShapeKind = 'outline' | 'circle' | 'square' | 'hexagon' | 'heart' | 'star' | 'egg';
export type ViewMode = 'assembled' | 'exploded' | 'section';

/** Reference printer plates shown underneath the Clicker preview. */
export type PlateId = 'a1' | 'a1mini' | 'h2d' | 'grid';

export interface PlateOption {
  id: PlateId;
  name: string;
  details: string;
  size?: [number, number];
}

/** Matches the reference Clicker Generator plate selector, including its no-plate grid mode. */
export const PLATES: PlateOption[] = [
  {
    id: 'a1',
    name: 'Plate: A1, P/X series',
    details: '256 × 256 mm · A1, P1 Series, X1 Series, X2D, P2S',
    size: [256, 256],
  },
  {
    id: 'a1mini',
    name: 'Plate: A1 mini',
    details: '184 × 184 mm',
    size: [184, 184],
  },
  {
    id: 'h2d',
    name: 'Plate: H series',
    details: '355 × 362 mm · H2D, H2C',
    size: [355, 362],
  },
  {
    id: 'grid',
    name: 'No plate',
    details: 'Plain reference grid',
  },
];

export interface BlockSlot {
  kind: 'char' | 'symbol';
  ch: string;
}

/** Which interaction mode the viewport is in. */
export type EditMode = 'color' | 'extrude' | 'edges';

/** Which edge group or part to modify. E.g. 'baseTop', 'capTop', or a part name like 'top-color-0-1' */
export type EdgeTarget = string;

/** Edge modification style. */
export type EdgeStyle = 'none' | 'fillet' | 'chamfer';

/** One edge-modification entry. */
export interface EdgeSetting {
  target: EdgeTarget;
  style: EdgeStyle;
  radius: number; // mm
}

export type CropRatio = 'free' | '1:1' | '4:3' | '3:2' | '16:9';

/** One MX switch placement on the design. x/y in mm from centre, rotation in degrees. */
export interface SwitchPlacement {
  x: number;
  y: number;
  rotation: number;
  /** Optional local Z seating plane used by composite builders with a separate carrier. */
  seatZ?: number;
  /** Optional local Z target for the visible top of the switch mesh. */
  topZ?: number;
}

/** Keychain attachment settings. */
export interface KeychainParams {
  enabled: boolean;
  /** 'loop' = outer tab with a ring hole; 'hole' = ring hole cut through the body. */
  style: 'loop' | 'hole';
  /** Position around the body edge, degrees. 90 = +Y (top), counter-clockwise. */
  angleDeg: number;
  /** Ring hole diameter, mm. Default 5.2. */
  holeDiameterMm: number;
  /** Lateral offset along the body edge tangent, mm. Positive = counter-clockwise
   *  shift from the angle-derived anchor, negative = clockwise. Default 0. */
  offsetMm: number;
  /** Image + Blocks loop position relative to the imported image head. */
  hybridPosition?: 'top' | 'bottom';
}

/** Bambu-style image preprocessing. Adjustment values are multipliers, 1 = neutral. */
export interface PreprocessParams {
  cropRatio: CropRatio;
  keepBackground: boolean;
  thicknessMm: number;
  exposure: number;
  contrast: number;
  saturation: number;
  brightness: number;
  whiteBalance: number;
  highlights: number;
  shadows: number;
}

export const DEFAULT_PREPROCESS: PreprocessParams = {
  cropRatio: 'free',
  keepBackground: false,
  thicknessMm: 1,
  exposure: 1,
  contrast: 1,
  saturation: 1,
  brightness: 1,
  whiteBalance: 1,
  highlights: 1,
  shadows: 1,
};

/** Parameters the geometry worker needs to build the clicker (all mm).
 *  Design: the BODY is a solid block with a recessed well + raised border cut
 *  into the top; the cap nests INSIDE that well (button-in-bezel). */
export interface BuildParams {
  baseShape: BaseShapeKind;
  capWidthMm: number;
  topThickness: number;
  imageDepth: number;
  /** Absolute image badge size in Image + Blocks mode (largest dimension, mm). */
  hybridImageSizeMm?: number;
  /** Total thickness of the imported-image head. It may match the carrier base. */
  hybridImageThicknessMm?: number;
  /** Padding from the imported image silhouette to its flat keychain plate. */
  hybridImagePaddingMm?: number;
  /** Printable Z thickness of the optional keychain tab, independent of the image head. */
  hybridKeychainHeightMm?: number;
  /** Raised height of imported image colour layers. */
  hybridImageExtrudeMm?: number;
  /** Cross-axis width of the continuous rounded carrier in Image + Blocks mode. */
  hybridBaseWidthMm?: number;
  /** Material beyond the first and last socket along the carrier. */
  hybridBaseEndPaddingMm?: number;
  /** Total carrier thickness measured down from the keycap seating plane. */
  hybridBaseThicknessMm?: number;
  /** Outside corner radius of the continuous carrier. */
  hybridBaseCornerRadiusMm?: number;
  /** Height of the carrier wall above the switch plane, used to hide the switch body. */
  hybridBaseWallHeightMm?: number;
  /** Straight material before the first keycap; the carrier itself overlaps the image head. */
  hybridNeckLengthMm?: number;
  /** How far the straight carrier head penetrates into the image badge to hide its square corner. */
  hybridBaseImageOverlapMm?: number;
  /** Legacy neck width kept for project compatibility; the carrier now uses its full base width. */
  hybridNeckWidthMm?: number;
  /** Clear wall/gap between adjacent keycap pockets. */
  hybridKeycapSpacingMm?: number;
  /** Horizontal clearance between a keycap footprint and its shallow base pocket. */
  hybridKeycapClearanceMm?: number;
  imageMargin: number;
  borderWidth: number;
  capProud: number;
  tolerance: number;
  stemTolerance: number;
  colorBleed: number;
  stepHeight: number;
  travel: number;
  floorThickness: number;
  switches: SwitchPlacement[];
  keychain: KeychainParams;
  baseFilamentRgb: RGB;
  bodyColorRgb: RGB;
  componentHeights: Record<string, number>;
  edgeSettings: EdgeSetting[];
  extrudeChamfer: boolean;
  mergeTopFrame: boolean;
  keepMeshesSeparate: boolean;
  isFlatKeychain?: boolean;
  /** Total printable plate thickness for Flat keychain mode, independent of image preprocessing. */
  flatKeychainThicknessMm?: number;

  // 🟢 THÊM 4 THUỘC TÍNH NÀY:
  bottomOffsetX?: number;
  bottomOffsetY?: number;
  bottomRotation?: number;
  bottomRegions?: BuildRegion[];
  bottomExpandPercent?: number;
  // 🟢 THÊM 3 DÒNG NÀY: Cấu hình Khối 3D
  topProfile?: 'flat' | 'dome' | 'cone';
  topProfileHeight?: number;
  baseHeight?: number;
}

/** Mesh payload (transferable). First 3 of each `numProp` stride are x,y,z. */
export interface MeshData {
  vertProperties: Float32Array;
  triVerts: Uint32Array;
  numProp: number;
}

export type PartKind = 'cap' | 'body';
/** Which independently-movable object a part belongs to in the export. */
export type PartGroup = 'top' | 'base';

export interface ClickerPart extends MeshData {
  kind: PartKind;
  group: PartGroup;
  colorRgb: RGB;
  name: string;
  /** 1-based filament slot for slicer color assignment (shared per unique color). */
  extruder?: number;
}

/** A region with its resolved filament color, ready for the worker. */
export interface BuildRegion {
  filamentRgb: RGB;
  coverage: number; // fraction of foreground — drives carve priority (small detail wins)
  rings: Ring[];
  partName: string;
}

/** Geometry inputs for the separate-letter Blocks builder. */
export interface BlockGlyph {
  rings: Ring[];
  filamentRgb?: RGB;
  partName?: string;
  blank?: boolean;
}

export interface BlocksBuildParams {
  requestId?: number;
  blockWidthMm: number;
  blockHeightMm: number;
  blockDepthMm: number;
  blockGapMm: number;
  cornerRadiusMm: number;
  fontSize: number;
  legendBold: number;
  /** Positive height raises text; zero keeps the legend flush with the cap. */
  legendExtrudeMm?: number;
  /** Per-part extrusion levels controlled by the viewport Extrude tool. */
  componentHeights?: Record<string, number>;
  /** Millimetres added for each extrusion level. */
  stepHeight?: number;
  vertical: boolean;
  glyphs: BlockGlyph[];
  bodyColorRgb?: RGB;
  capColorRgb?: RGB;
  stemTolerance?: number;
  travel?: number;
  keycapGapMm?: number;
  /** Kept for legacy block geometry compatibility; the public builder no longer adds side rails. */
  wallThicknessMm?: number;
  flatBottom?: boolean;
  baseHeightMm?: number;
  moduleThicknessMm?: number;
  moduleSideThicknessMm?: number;
  baseCornerRadiusMm?: number;
  keycapHeightMm?: number;
  keycapCornerRadiusMm?: number;
  keycapShape?: 'rounded' | 'square';
  keycapMount?: 'above' | 'recessed';
  /** Profile names exposed by the SVG Keycap Generator. */
  keycapProfile?: 'standard' | 'low' | 'thocky' | 'choc-v1';
  /** Key size in keyboard units (1u, 1.25u, ...). */
  keycapUnit?: number;
  squareModuleBase?: boolean;
  keychainEnd?: 'left' | 'right' | 'top' | 'bottom';
  /** Optional per-slot colors used by the Flex Keychain page. */
  capColorByIndex?: RGB[];
  /** Optional traced artwork placed on every keycap. Artwork replaces the text legend. */
  keycapImageRegions?: BuildRegion[];
  /** Longest side of the keycap artwork in millimetres. */
  keycapImageSizeMm?: number;
  /** Raised height of the keycap artwork; a small positive default makes it printable. */
  keycapImageExtrudeMm?: number;
  /** Original glyph/slot indices that receive the imported keycap artwork. */
  keycapImageSlotIndices?: number[];
}

export interface FlexKeychainSlot {
  ch: string;
  rings: Ring[];
  capColorRgb: RGB;
  glyphColorRgb: RGB;
  blank?: boolean;
}

export interface FlexKeychainBuildParams {
  requestId?: number;
  baseType: 'compact' | 'modular';
  modularStyle: 'bubbly' | 'bubbly-v2';
  vertical: boolean;
  slots: FlexKeychainSlot[];
  baseColorRgb: RGB;
  defaultCapColorRgb: RGB;
  defaultGlyphColorRgb: RGB;
  gapMm: number;
  moduleSideWallThicknessMm: number;
  moduleThicknessMm: number;
  baseCornerRadiusMm: number;
  keycapGapMm: number;
  keycapHeightMm: number;
  keycapThicknessMm: number;
  keycapCornerRadiusMm: number;
  keycapShape: 'rounded' | 'square';
  keycapMount: 'above' | 'recessed';
  keycapProfile: 'standard' | 'low' | 'thocky' | 'choc-v1';
  keycapUnit: number;
  legendScale: number;
  legendBold: number;
  fontSize: number;
  stemTolerance: number;
  travel: number;
}

export interface BlockAssetBuffers {
  noSides: ArrayBuffer;
  south: ArrayBuffer;
  northSouth: ArrayBuffer;
  northWest: ArrayBuffer;
  northSouthWest: ArrayBuffer;
  allSides: ArrayBuffer;
  keycapJson: {
    positions: number[];
    indices: number[];
    stem?: { positions: number[]; indices: number[] } | null;
    meta: {
      center: [number, number];
      topZ: number;
      dishBottomZ?: number;
      topExtent?: [number, number];
    };
  };
}

export interface BlockAssetMessageBuffers {
  blockNoSides: ArrayBuffer;
  blockSouth: ArrayBuffer;
  blockNorthSouth: ArrayBuffer;
  blockNorthWest: ArrayBuffer;
  blockNorthSouthWest: ArrayBuffer;
  blockAllSides: ArrayBuffer;
  keycapJson: BlockAssetBuffers['keycapJson'];
}

// ---- Worker messages ----
export type GeometryRequest =
  | { type: 'ping' }
  | ({ type: 'init'; socket: ArrayBuffer; stem: ArrayBuffer; switch: ArrayBuffer } & Partial<BlockAssetMessageBuffers>)
  | {
      type: 'buildClicker';
      requestId?: number;
      regions: BuildRegion[];
      outline: Ring[];
      bottomOutline?: Ring[]; // 👈 THÊM DÒNG NÀY (Viền của tấm ảnh thứ 2)
      params: BuildParams;
    }
  | {
      type: 'buildBlocks';
      params: BlocksBuildParams;
    }
  | {
      type: 'buildHybridClicker';
      regions: BuildRegion[];
      outline: Ring[];
      params: BuildParams;
      blockParams: BlocksBuildParams;
    }
  | { type: 'buildFlexKeychain'; params: FlexKeychainBuildParams };

export type GeometryResponse =
  | { type: 'ready' }
  | { type: 'status'; message: string }
  // `switchMesh` is the real MX switch, placed in the assembly frame for the preview
  // toggle (display only — never exported).
  | { type: 'initDone'; socketInfo: string; stemInfo: string; switchInfo: string; switchMesh: MeshData }
  // `switchPlacements` are the placements actually applied (after clamping to the cap
  // footprint + min-pitch spacing), so the preview switch meshes match the geometry.
  // `warnings` surfaces non-fatal build notes (e.g. switches pulled together, no room
  // for the keychain hole) for the status line.
  | { type: 'parts'; requestId?: number; parts: ClickerPart[]; switchPlacements: SwitchPlacement[]; warnings: string[] }
  | { type: 'blocksParts'; requestId?: number; parts: ClickerPart[]; switchPlacements: SwitchPlacement[]; warnings: string[] }
  | { type: 'error'; message: string };
export type ColorTarget = { kind: 'region'; index: number; compIndex: number } | { kind: 'body' } | { kind: 'base' };
