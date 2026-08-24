import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileJson,
  FileUp,
  Grid3X3,
  History,
  ImagePlus,
  Maximize2,
  Moon,
  PackageOpen,
  PanelRight,
  Play,
  Rotate3D,
  Save,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useI18n } from "./lib/i18n";
import manifestData from "./paramacraft-manifest.json";
import presetsData from "./paramacraft-presets.json";
import { buildLobedPillarModel } from "./paramacraftLobedGeometry";
import "./paramacraft.css";

type ShapeKind =
  | "rounded-box"
  | "circle"
  | "polygon"
  | "cone"
  | "cylinder"
  | "flower";
type PatternKind = "plain" | "stripes" | "grooves" | "ribs" | "wavy" | "kumiko";
type CraftTab = "model" | "sketch" | "history";
type ViewMode = "iso" | "front" | "top";
type PhaseId = "body" | "pattern" | "global";
type SketchTool = "line" | "arc" | "rectangle" | "circle" | "offset";

interface HistoryEntry {
  id: number;
  label: string;
  timestamp: number;
  state: CraftState;
}

interface CraftState {
  name: string;
  shape: ShapeKind;
  pattern: PatternKind;
  profile: "generic" | "lobed-pillar";
  width: number;
  depth: number;
  height: number;
  wall: number;
  radius: number;
  facets: number;
  relief: number;
  spacing: number;
  lobeCount: number;
  lobeAmplitude: number;
  twistRate: number;
  patternLineWidth: number;
  color: string;
  accent: string;
  openTop: boolean;
  imageUrl: string;
  floorThickness: number;
  rimHeight: number;
  chamfer: number;
  lidClearance: number;
  lidTopThickness: number;
  lidOverhang: number;
  lidSkirtDepth: number;
  lidBevel: number;
}
interface Preset {
  id: string;
  label: string;
  tags: string[];
  shape: ShapeKind;
  pattern: PatternKind;
  color: string;
  accent: string;
  description: string;
  thumbnailUrl?: string;
  isPaid?: boolean;
  remote?: boolean;
  remoteParams?: Record<string, unknown>;
}
interface ManifestPreset {
  id: string;
  name: string;
  tags: string[];
  kitId?: string;
  kitVersion?: string;
  priority: number;
  isPaid: boolean;
  hasUsageThumbnail: boolean;
}

const PRESETS: Preset[] = [
  {
    id: "container",
    label: "Container",
    tags: [
      "usage:container",
      "silhouette:rounded-box",
      "color:1-color",
      "motif:plain",
    ],
    shape: "rounded-box",
    pattern: "plain",
    color: "#d9c79e",
    accent: "#f1d38e",
    description: "A clean parametric container with an open top.",
  },
  {
    id: "one-color",
    label: "1-color",
    tags: ["color:1-color", "meta:new"],
    shape: "rounded-box",
    pattern: "plain",
    color: "#d6a05d",
    accent: "#d6a05d",
    description: "A single-material starting point for quick experiments.",
  },
  {
    id: "kumiko",
    label: "Kumiko",
    tags: ["style:kumiko", "structure:pillar", "color:1-color"],
    shape: "circle",
    pattern: "kumiko",
    color: "#dca25a",
    accent: "#f5d58d",
    description: "A lattice surface built for light and shadow.",
  },
  {
    id: "pillar",
    label: "Pillar",
    tags: ["structure:pillar", "usage:container"],
    shape: "cylinder",
    pattern: "ribs",
    color: "#75b4a0",
    accent: "#b6e0c8",
    description: "Vertical ribs around a cylindrical form.",
  },
  {
    id: "flat",
    label: "Flat",
    tags: ["form:flat", "silhouette:rounded-box"],
    shape: "rounded-box",
    pattern: "plain",
    color: "#b6a899",
    accent: "#ece0c6",
    description: "A low-profile printable shape.",
  },
  {
    id: "two-color",
    label: "2-color",
    tags: ["color:2-color", "meta:new"],
    shape: "polygon",
    pattern: "plain",
    color: "#7593c8",
    accent: "#f3c777",
    description: "A two-material recipe with a clear accent layer.",
  },
  {
    id: "rounded-box",
    label: "Rounded box",
    tags: ["silhouette:rounded-box", "form:flat"],
    shape: "rounded-box",
    pattern: "stripes",
    color: "#d7866e",
    accent: "#f4c0a9",
    description: "Soft corners and evenly spaced surface bands.",
  },
  {
    id: "circle",
    label: "Circle",
    tags: ["silhouette:circle", "form:flat"],
    shape: "circle",
    pattern: "plain",
    color: "#789ab4",
    accent: "#c6e4ee",
    description: "A clean circular profile for round objects.",
  },
  {
    id: "polygon",
    label: "Polygon",
    tags: ["silhouette:polygon", "color:2-color"],
    shape: "polygon",
    pattern: "plain",
    color: "#7593c8",
    accent: "#f3c777",
    description: "A faceted architectural profile.",
  },
  {
    id: "flower",
    label: "Flower",
    tags: ["silhouette:flower", "form:lobed"],
    shape: "flower",
    pattern: "wavy",
    color: "#ca7689",
    accent: "#f6d4a5",
    description: "A soft lobed silhouette for expressive objects.",
  },
  {
    id: "cone",
    label: "Cone",
    tags: ["form:cone", "color:1-color"],
    shape: "cone",
    pattern: "grooves",
    color: "#8e9a6e",
    accent: "#dfe2ad",
    description: "A tapered body with a printable groove motif.",
  },
  {
    id: "cylinder",
    label: "Cylinder",
    tags: ["silhouette:circle", "form:sine-revolution"],
    shape: "cylinder",
    pattern: "wavy",
    color: "#6f9bb9",
    accent: "#c0dff0",
    description: "A round form with a subtle wavy rhythm.",
  },
  {
    id: "stripes",
    label: "Stripes",
    tags: ["motif:stripes", "color:1-color"],
    shape: "rounded-box",
    pattern: "stripes",
    color: "#b28c67",
    accent: "#f2d6a4",
    description: "Parallel ribs that follow the body.",
  },
  {
    id: "grooves",
    label: "Grooves",
    tags: ["motif:grooves", "structure:ribs"],
    shape: "circle",
    pattern: "grooves",
    color: "#778f7a",
    accent: "#d0e4bc",
    description: "Concentric grooves for a tactile finish.",
  },
  {
    id: "ribs",
    label: "Ribs",
    tags: ["motif:ribs", "structure:pillar"],
    shape: "cylinder",
    pattern: "ribs",
    color: "#6f8e82",
    accent: "#c7dfcd",
    description: "A strong repeated rib profile.",
  },
  {
    id: "wavy",
    label: "Wavy",
    tags: ["motif:wavy", "form:sine-revolution"],
    shape: "flower",
    pattern: "wavy",
    color: "#7e9e9d",
    accent: "#c3e1d8",
    description: "A flowing surface with an organic rhythm.",
  },
  {
    id: "inset-lid",
    label: "Inset lid",
    tags: ["form:inset-lid", "usage:container"],
    shape: "rounded-box",
    pattern: "grooves",
    color: "#7d8e9d",
    accent: "#d5dee4",
    description: "A recessed top profile for fitted lids.",
  },
  {
    id: "phone-case",
    label: "Phone case",
    tags: ["usage:phone-case", "style:kumiko"],
    shape: "rounded-box",
    pattern: "kumiko",
    color: "#4a5567",
    accent: "#9fb9da",
    description: "A broad flat body ready for a custom silhouette.",
  },
  {
    id: "label",
    label: "Label",
    tags: ["usage:label", "form:flat"],
    shape: "rounded-box",
    pattern: "stripes",
    color: "#bd8d57",
    accent: "#f4dfb4",
    description: "A flat label-ready profile with raised bands.",
  },
  {
    id: "pen-holder",
    label: "Pen holder",
    tags: ["usage:pen-holder", "structure:ribs"],
    shape: "cylinder",
    pattern: "ribs",
    color: "#6f8e82",
    accent: "#c7dfcd",
    description: "A tall ribbed container for a desktop setup.",
  },
];

const PARAMACRAFT_API = "https://paramacraft.com/api";
const REMOTE_MANIFEST = manifestData.presets as ManifestPreset[];
const REMOTE_PRESET_PAYLOADS = (presetsData.presets ?? {}) as Record<
  string,
  { params?: Record<string, unknown> }
>;
const TAG_LABELS: Record<string, string> = {
  "usage:container": "Container",
  "usage:desk-organizer": "Desk organizer",
  "usage:phone-case": "Phone case",
  "usage:pen-holder": "Pen holder",
  "usage:pipe-joint": "Pipe joint",
  "usage:screw-cap-set": "Screw cap set",
  "usage:perforated-board": "Perforated board",
  "usage:s-hook": "S-hook",
  "usage:door-hook": "Door hook",
  "usage:gear": "Gear",
  "usage:soap-dish": "Soap dish",
  "usage:spice-rack": "Spice rack",
  "usage:bracket": "Bracket",
  "usage:phone-stand": "Phone stand",
  "usage:label": "Label",
  "silhouette:rounded-box": "Rounded box",
  "silhouette:circle": "Circle",
  "silhouette:polygon": "Polygon",
  "silhouette:flower": "Flower",
  "silhouette:lobed": "Lobed",
  "form:flat": "Flat",
  "form:cylinder": "Cylinder",
  "form:cone": "Cone",
  "form:step": "Step",
  "form:bulge": "Bulge",
  "form:wavy": "Wavy",
  "form:tilt": "Tilt",
  "form:twist": "Twist",
  "form:sine-revolution": "Sine revolution",
  "motif:plain": "Plain",
  "motif:grooves": "Grooves",
  "motif:stripes": "Stripes",
  "motif:diagonal": "Diagonal",
  "style:kumiko": "Kumiko",
  "style:weave": "Weave",
  "structure:ribs": "Ribs",
  "structure:pillar": "Pillar",
  "structure:bump": "Bump",
  "color:1-color": "1 color",
  "color:2-color": "2 colors",
  "meta:new": "New",
  "meta:beta": "Beta",
  "tier:paid": "Paid",
};
function tagLabel(tag: string) {
  return TAG_LABELS[tag] ?? tag.replace(/^[^:]+:/, "").replace(/-/g, " ");
}
function shapeFromTags(tags: string[]): ShapeKind {
  if (tags.includes("form:cylinder")) return "cylinder";
  if (
    tags.includes("silhouette:circle") ||
    tags.includes("form:sine-revolution")
  )
    return "circle";
  if (tags.includes("silhouette:polygon")) return "polygon";
  if (tags.includes("silhouette:flower") || tags.includes("silhouette:lobed"))
    return "flower";
  if (tags.includes("form:cone")) return "cone";
  return "rounded-box";
}
function patternFromTags(tags: string[]): PatternKind {
  if (tags.includes("style:kumiko") || tags.includes("style:weave"))
    return "kumiko";
  if (tags.includes("motif:stripes") || tags.includes("motif:diagonal"))
    return "stripes";
  if (tags.includes("motif:grooves") || tags.includes("structure:ribs"))
    return "grooves";
  if (tags.includes("form:wavy") || tags.includes("form:sine-revolution"))
    return "wavy";
  if (tags.includes("structure:pillar")) return "ribs";
  return "plain";
}
function remotePreset(item: ManifestPreset): Preset {
  const shape = shapeFromTags(item.tags);
  const pattern = patternFromTags(item.tags);
  const usage = item.tags.find((tag) => tag.startsWith("usage:"));
  const titleTags = item.tags
    .filter((tag) =>
      /^(silhouette|form|motif|style|structure|usage):/.test(tag),
    )
    .slice(0, 4);
  const label =
    item.name !== "Default"
      ? item.name
      : titleTags.length
        ? titleTags.map(tagLabel).join(" · ")
        : "Parametric preset";
  const color = item.tags.includes("color:2-color") ? "#7891c4" : "#d9c79e";
  return {
    id: item.id,
    label,
    tags: item.tags,
    shape,
    pattern,
    color,
    accent: item.tags.includes("color:2-color") ? "#f0be67" : "#f1d38e",
    description: `${usage ? tagLabel(usage) : "Parametric"} · ${titleTags.map(tagLabel).join(" · ") || "printable geometry"}`,
    thumbnailUrl: `${PARAMACRAFT_API}/presets/${item.id}/thumbnail`,
    isPaid: item.isPaid,
    remote: true,
    remoteParams: REMOTE_PRESET_PAYLOADS[item.id]?.params,
  };
}
const REMOTE_PRESETS = REMOTE_MANIFEST.map(remotePreset);

const SHAPE_LABELS: Record<ShapeKind, string> = {
  "rounded-box": "Rounded box",
  circle: "Circle",
  polygon: "Polygon",
  cone: "Cone",
  cylinder: "Cylinder",
  flower: "Flower",
};
const PATTERN_LABELS: Record<PatternKind, string> = {
  plain: "Plain",
  stripes: "Stripes",
  grooves: "Grooves",
  ribs: "Ribs",
  wavy: "Wavy",
  kumiko: "Kumiko",
};
const DEFAULT_CRAFT: CraftState = {
  name: "Untitled",
  shape: "rounded-box",
  pattern: "plain",
  profile: "generic",
  width: 84,
  depth: 64,
  height: 66,
  wall: 5,
  radius: 8,
  facets: 64,
  relief: 2.5,
  spacing: 6,
  lobeCount: 5,
  lobeAmplitude: 8,
  twistRate: 0.6,
  patternLineWidth: 2.5,
  color: "#d9c79e",
  accent: "#f1d38e",
  openTop: true,
  imageUrl: "",
  floorThickness: 5,
  rimHeight: 5,
  chamfer: 1.5,
  lidClearance: 0.2,
  lidTopThickness: 2.5,
  lidOverhang: 3,
  lidSkirtDepth: 8,
  lidBevel: 0.6,
};
function cloneCraftState(state: CraftState): CraftState {
  return { ...state };
}
function estimateVolume(state: CraftState) {
  if (state.profile === "lobed-pillar") {
    const radius = Math.max(1, state.radius);
    const amplitude = Math.max(0, state.lobeAmplitude);
    const innerRadius = Math.max(1, radius - Math.max(0.6, state.wall));
    const outerArea = Math.PI * (radius * radius + (amplitude * amplitude) / 2);
    const innerArea =
      Math.PI * (innerRadius * innerRadius + (amplitude * amplitude) / 2);
    const shell =
      Math.max(0, outerArea - innerArea) * Math.max(1, state.height);
    const floor = outerArea * Math.max(0, state.floorThickness);
    const rim =
      Math.max(0, outerArea - innerArea) * Math.max(0, state.rimHeight);
    return Math.max(1, Math.round((shell + floor + rim) / 1000));
  }
  const outer = Math.max(1, state.width * state.depth * state.height);
  const hollow = state.openTop
    ? Math.max(
        0,
        (state.width - state.wall * 2) *
          (state.depth - state.wall * 2) *
          Math.max(0, state.height - state.floorThickness),
      )
    : 0;
  const lid = Math.max(
    0,
    (state.width + state.lidOverhang * 2) *
      (state.depth + state.lidOverhang * 2) *
      state.lidTopThickness,
  );
  return Math.max(1, Math.round((outer - hollow + lid) / 1000));
}
function numberFrom(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function colorFromParam(value: unknown, fallback: string) {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  const channels = value
    .slice(0, 3)
    .map((channel) => Math.max(0, Math.min(1, numberFrom(channel, 0))));
  return `#${channels
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
function stateFromPreset(preset: Preset): CraftState {
  const params = preset.remoteParams;
  const lobedPillar =
    typeof params?.r_base === "number" && typeof params?.lobe_n === "number";
  const round = preset.shape === "circle" || preset.shape === "cylinder";
  const size = params?.size;
  const radius = params?.radius;
  return {
    ...DEFAULT_CRAFT,
    name: preset.label,
    shape: lobedPillar ? "flower" : preset.shape,
    pattern: lobedPillar ? "kumiko" : preset.pattern,
    profile: lobedPillar ? "lobed-pillar" : "generic",
    color: colorFromParam(params?.main_color, preset.color),
    accent: colorFromParam(params?.pat_color, preset.accent),
    width: lobedPillar
      ? numberFrom(params?.r_base, 60) * 2
      : numberFrom(
          params?.size_x ??
            size ??
            (typeof radius === "number" ? radius * 2 : undefined),
          round ? 70 : 84,
        ),
    depth: lobedPillar
      ? numberFrom(params?.r_base, 60) * 2
      : numberFrom(
          params?.size_y ??
            size ??
            (typeof radius === "number" ? radius * 2 : undefined),
          round ? 70 : 64,
        ),
    height: numberFrom(params?.height ?? params?.height1, DEFAULT_CRAFT.height),
    wall: numberFrom(params?.pat_wall_t, DEFAULT_CRAFT.wall),
    radius: lobedPillar
      ? numberFrom(params?.r_base, 60)
      : numberFrom(params?.r ?? params?.corner_r, DEFAULT_CRAFT.radius),
    lobeCount: numberFrom(params?.lobe_n, DEFAULT_CRAFT.lobeCount),
    lobeAmplitude: numberFrom(params?.lobe_amp, DEFAULT_CRAFT.lobeAmplitude),
    twistRate: numberFrom(params?.twist_rate_deg, DEFAULT_CRAFT.twistRate),
    spacing: lobedPillar
      ? numberFrom(params?.pat_size, DEFAULT_CRAFT.spacing)
      : DEFAULT_CRAFT.spacing,
    patternLineWidth: numberFrom(
      params?.pat_line_w,
      DEFAULT_CRAFT.patternLineWidth,
    ),
    floorThickness: numberFrom(params?.floor_t, DEFAULT_CRAFT.floorThickness),
    rimHeight: numberFrom(params?.rim_h, DEFAULT_CRAFT.rimHeight),
    chamfer: numberFrom(params?.top_round_r, DEFAULT_CRAFT.chamfer),
    lidClearance: numberFrom(params?.lid_clearance, DEFAULT_CRAFT.lidClearance),
    lidTopThickness: numberFrom(
      params?.lid_top_t,
      DEFAULT_CRAFT.lidTopThickness,
    ),
    lidOverhang: numberFrom(params?.flange_overhang, DEFAULT_CRAFT.lidOverhang),
    lidSkirtDepth: numberFrom(params?.skirt_depth, DEFAULT_CRAFT.lidSkirtDepth),
    lidBevel: numberFrom(params?.lid_bevel, DEFAULT_CRAFT.lidBevel),
  };
}

function makeFlowerShape(radius: number, lobes = 6) {
  const shape = new THREE.Shape();
  const points = 128;
  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const lobe = Math.pow((Math.sin((angle * lobes) / 2) + 1) / 2, 1.55);
    const r = radius * (0.83 + lobe * 0.17);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}
function createSolidBody(state: CraftState, material: THREE.Material) {
  const width = Math.max(20, state.width);
  const depth = Math.max(20, state.depth);
  const height = Math.max(8, state.height);
  let body: THREE.Mesh;
  if (state.shape === "rounded-box") {
    const radius = Math.min(
      state.radius,
      width / 2 - 0.5,
      depth / 2 - 0.5,
      height / 2 - 0.5,
    );
    body = new THREE.Mesh(
      new RoundedBoxGeometry(width, height, depth, 8, Math.max(0.5, radius)),
      material,
    );
  } else if (state.shape === "circle" || state.shape === "cylinder")
    body = new THREE.Mesh(
      new THREE.CylinderGeometry(
        Math.min(width, depth) / 2,
        Math.min(width, depth) / 2,
        height,
        state.facets,
      ),
      material,
    );
  else if (state.shape === "polygon") {
    body = new THREE.Mesh(
      new THREE.CylinderGeometry(
        Math.min(width, depth) / 2,
        Math.min(width, depth) / 2,
        height,
        6,
      ),
      material,
    );
    body.rotation.y = Math.PI / 6;
  } else if (state.shape === "cone")
    body = new THREE.Mesh(
      new THREE.CylinderGeometry(
        (Math.min(width, depth) / 2) * 0.84,
        Math.min(width, depth) / 2,
        height,
        state.facets,
      ),
      material,
    );
  else {
    body = new THREE.Mesh(
      new THREE.ExtrudeGeometry(makeFlowerShape(Math.min(width, depth) / 2), {
        depth: height,
        bevelEnabled: true,
        bevelSegments: 5,
        bevelSize: Math.min(2, state.radius / 3),
        bevelThickness: Math.min(2, state.radius / 3),
        curveSegments: 8,
      }),
      material,
    );
    body.rotation.x = -Math.PI / 2;
  }
  body.position.y = height / 2;
  return body;
}
function addOpenContainer(
  parent: THREE.Group,
  state: CraftState,
  material: THREE.Material,
) {
  const width = Math.max(20, state.width);
  const depth = Math.max(20, state.depth);
  const height = Math.max(8, state.height);
  const floor = Math.min(Math.max(1, state.floorThickness), height - 1);
  const wall = Math.min(Math.max(0.6, state.wall), Math.min(width, depth) / 3);
  const radius = Math.min(state.radius, 10);
  const innerWidth = Math.max(5, width - wall * 2);
  const innerDepth = Math.max(5, depth - wall * 2);
  const wallHeight = Math.max(1, height - floor);
  if (state.shape !== "rounded-box") {
    parent.add(createSolidBody(state, material));
    return;
  }
  const bottom = new THREE.Mesh(
    new RoundedBoxGeometry(
      innerWidth,
      floor,
      innerDepth,
      8,
      Math.max(0.35, Math.min(radius - wall, 5)),
    ),
    material,
  );
  bottom.position.y = floor / 2;
  parent.add(bottom);
  const front = new THREE.Mesh(
    new RoundedBoxGeometry(
      width,
      wallHeight,
      wall,
      8,
      Math.max(0.35, Math.min(radius, wall / 2)),
    ),
    material,
  );
  front.position.set(0, floor + wallHeight / 2, depth / 2 - wall / 2);
  const back = front.clone();
  back.position.z = -depth / 2 + wall / 2;
  const left = new THREE.Mesh(
    new RoundedBoxGeometry(
      wall,
      wallHeight,
      innerDepth,
      8,
      Math.max(0.35, Math.min(radius, wall / 2)),
    ),
    material,
  );
  left.position.set(-width / 2 + wall / 2, floor + wallHeight / 2, 0);
  const right = left.clone();
  right.position.x = width / 2 - wall / 2;
  parent.add(front, back, left, right);
  if (!state.openTop) {
    const lid = new THREE.Mesh(
      new RoundedBoxGeometry(
        innerWidth,
        wall,
        innerDepth,
        8,
        Math.max(0.35, Math.min(radius - wall, 5)),
      ),
      material,
    );
    lid.position.y = height - wall / 2;
    parent.add(lid);
  }
}
function addRim(
  parent: THREE.Group,
  state: CraftState,
  material: THREE.Material,
) {
  if (state.shape !== "rounded-box" || state.rimHeight <= 0) return;
  const width = Math.max(20, state.width);
  const depth = Math.max(20, state.depth);
  const wall = Math.min(Math.max(0.6, state.wall), Math.min(width, depth) / 3);
  const rimHeight = Math.min(state.rimHeight, state.height / 2);
  const radius = Math.min(state.radius, 10);
  const rimRadius = Math.max(
    0.35,
    Math.min(radius + state.chamfer * 0.08, wall / 2 + 0.8),
  );
  const front = new THREE.Mesh(
    new RoundedBoxGeometry(width + 0.2, rimHeight, wall + 0.25, 8, rimRadius),
    material,
  );
  front.position.set(0, state.height + rimHeight / 2, depth / 2 - wall / 2);
  const back = front.clone();
  back.position.z = -depth / 2 + wall / 2;
  const side = new THREE.Mesh(
    new RoundedBoxGeometry(
      wall + 0.25,
      rimHeight,
      depth - wall * 2,
      8,
      rimRadius,
    ),
    material,
  );
  side.position.set(-width / 2 + wall / 2, state.height + rimHeight / 2, 0);
  const otherSide = side.clone();
  otherSide.position.x = width / 2 - wall / 2;
  parent.add(front, back, side, otherSide);
}
function addPattern(
  parent: THREE.Group,
  state: CraftState,
  material: THREE.Material,
) {
  if (state.pattern === "plain") return;
  const group = new THREE.Group();
  const width = Math.max(20, state.width);
  const depth = Math.max(20, state.depth);
  const height = Math.max(8, state.height);
  const wall = Math.min(Math.max(0.6, state.wall), Math.min(width, depth) / 3);
  const relief = Math.max(0.2, state.relief * 0.12);
  const levels = Math.max(3, Math.floor(height / Math.max(2, state.spacing)));
  if (state.shape === "rounded-box") {
    // Keep the default open container hollow: a motif is built as four shallow bands,
    // not as a slab across the opening.
    const bandHeight = Math.max(0.35, Math.min(1.2, state.spacing * 0.16));
    const bandDepth = Math.max(0.35, wall * 0.32 + relief);
    for (let i = 0; i < levels; i += 1) {
      const y =
        Math.max(1, state.floorThickness) +
        (i / Math.max(1, levels - 1)) *
          Math.max(1, height - state.floorThickness - bandHeight);
      const front = new THREE.Mesh(
        new RoundedBoxGeometry(
          width - state.radius * 0.22,
          bandHeight,
          bandDepth,
          6,
          Math.min(bandDepth / 2, 0.45),
        ),
        material,
      );
      front.position.set(0, y, depth / 2 - bandDepth / 2);
      const back = front.clone();
      back.position.z = -depth / 2 + bandDepth / 2;
      const side = new THREE.Mesh(
        new RoundedBoxGeometry(
          bandDepth,
          bandHeight,
          Math.max(4, depth - state.radius * 0.22),
          6,
          Math.min(bandDepth / 2, 0.45),
        ),
        material,
      );
      side.position.set(-width / 2 + bandDepth / 2, y, 0);
      const otherSide = side.clone();
      otherSide.position.x = width / 2 - bandDepth / 2;
      group.add(front, back, side, otherSide);
    }
  } else if (
    state.pattern === "grooves" ||
    state.pattern === "ribs" ||
    state.pattern === "wavy"
  ) {
    const radius = Math.min(width, depth) / 2;
    const loops =
      state.pattern === "grooves"
        ? levels + 2
        : Math.max(5, Math.floor(levels * 0.75));
    for (let i = 0; i < loops; i += 1) {
      const y = 3 + (i / Math.max(1, loops - 1)) * Math.max(2, height - 6);
      const t =
        state.shape === "cone" ? 1 - (y / Math.max(1, height)) * 0.25 : 1;
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(
          radius * 0.83 * t,
          Math.max(0.25, state.relief * 0.1),
          10,
          state.facets,
        ),
        material,
      );
      torus.rotation.x = Math.PI / 2;
      torus.position.y = y;
      if (state.pattern === "wavy")
        torus.scale.set(
          1 + Math.sin(i * 0.7) * 0.035,
          1,
          1 + Math.cos(i * 0.7) * 0.035,
        );
      group.add(torus);
    }
  }
  if (state.pattern === "kumiko") {
    const bars = Math.max(3, Math.floor(width / 12));
    for (let i = 0; i < bars; i += 1) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.8, Math.max(4, depth * 0.72)),
        material,
      );
      bar.position.set(
        -width / 2 + 10 + i * ((width - 20) / Math.max(1, bars - 1)),
        height + 1.4,
        0,
      );
      bar.rotation.y = i % 2 ? Math.PI / 4 : -Math.PI / 4;
      group.add(bar);
    }
  }
  parent.add(group);
}
function disposeCraftModel(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else if (material) material.dispose();
  });
}

function buildCraftModel(state: CraftState) {
  if (state.profile === "lobed-pillar") {
    return buildLobedPillarModel({
      radius: Math.max(10, state.radius),
      lobeCount: state.lobeCount,
      lobeAmplitude: state.lobeAmplitude,
      twistRate: state.twistRate,
      height: Math.max(8, state.height),
      wall: state.wall,
      floorThickness: state.floorThickness,
      rimHeight: state.rimHeight,
      patternLineWidth: state.patternLineWidth,
      patternSpacing: state.spacing,
      bodyColor: state.color,
      accentColor: state.accent,
    });
  }
  const root = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: state.color,
    roughness: 0.72,
    metalness: 0.03,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: state.accent,
    roughness: 0.55,
    metalness: 0.02,
  });
  const width = Math.max(20, state.width);
  const depth = Math.max(20, state.depth);
  const lidWidth = width + state.lidOverhang * 2;
  const lidDepth = depth + state.lidOverhang * 2;
  const model = new THREE.Group();
  const body = new THREE.Group();
  addOpenContainer(body, state, bodyMaterial);
  addRim(body, state, accentMaterial);
  addPattern(body, state, accentMaterial);
  const bodyOffset = Math.max(lidWidth, width) / 2 + 8;
  body.position.x = bodyOffset;
  model.add(body);
  const lid = new THREE.Group();
  const lidThickness = Math.max(1, state.lidTopThickness);
  const lidRadius = Math.min(
    state.radius + state.lidBevel,
    Math.min(lidWidth, lidDepth) / 2 - 1,
  );
  let lidTop: THREE.Mesh;
  if (state.shape === "rounded-box")
    lidTop = new THREE.Mesh(
      new RoundedBoxGeometry(
        lidWidth,
        lidThickness,
        lidDepth,
        8,
        Math.max(0.5, lidRadius),
      ),
      accentMaterial,
    );
  else if (state.shape === "flower") {
    lidTop = new THREE.Mesh(
      new THREE.ExtrudeGeometry(
        makeFlowerShape(Math.min(lidWidth, lidDepth) / 2),
        {
          depth: lidThickness,
          bevelEnabled: true,
          bevelSegments: 5,
          bevelSize: Math.min(1.6, state.lidBevel + 0.3),
          bevelThickness: Math.min(1.6, state.lidBevel + 0.3),
          curveSegments: 8,
        },
      ),
      accentMaterial,
    );
    lidTop.rotation.x = -Math.PI / 2;
  } else
    lidTop = new THREE.Mesh(
      new THREE.CylinderGeometry(
        Math.min(lidWidth, lidDepth) / 2,
        Math.min(lidWidth, lidDepth) / 2,
        lidThickness,
        state.facets,
      ),
      accentMaterial,
    );
  lidTop.position.y = lidThickness / 2;
  lid.add(lidTop);
  if (state.lidSkirtDepth > 0) {
    const skirtHeight = Math.min(30, state.lidSkirtDepth);
    const clearance = Math.max(0, state.lidClearance);
    const skirtWidth = Math.max(6, lidWidth - state.wall * 2 - clearance * 2);
    const skirtDepth = Math.max(6, lidDepth - state.wall * 2 - clearance * 2);
    const skirt =
      state.shape === "rounded-box"
        ? new THREE.Mesh(
            new RoundedBoxGeometry(
              skirtWidth,
              skirtHeight,
              skirtDepth,
              8,
              Math.max(0.4, lidRadius - state.wall - clearance),
            ),
            bodyMaterial,
          )
        : new THREE.Mesh(
            new THREE.CylinderGeometry(
              Math.max(4, Math.min(skirtWidth, skirtDepth) / 2),
              Math.max(4, Math.min(skirtWidth, skirtDepth) / 2),
              skirtHeight,
              state.facets,
            ),
            bodyMaterial,
          );
    skirt.position.y = -skirtHeight / 2 + 0.12;
    lid.add(skirt);
  }
  lid.position.x = bodyOffset - width / 2 - lidWidth / 2 - 10;
  lid.position.z = 0;
  model.add(lid);
  root.add(model);
  return root;
}

function CraftViewport({
  state,
  fitToken,
  viewMode,
  onFit,
}: {
  state: CraftState;
  fitToken: number;
  viewMode: ViewMode;
  onFit: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<{
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    model: THREE.Group;
    frame: number;
    fitToken: number;
  } | null>(null);
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0c1016");
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 3000);
    camera.position.set(200, 150, 220);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    scene.add(new THREE.GridHelper(700, 70, 0x2a3442, 0x171e28));
    scene.add(new THREE.HemisphereLight(0xdcecff, 0x141a22, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 3.4);
    key.position.set(120, 220, 160);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x89b9ff, 1.4);
    fill.position.set(-140, 100, -120);
    scene.add(fill);
    const model = new THREE.Group();
    scene.add(model);
    const runtime = {
      camera,
      renderer,
      controls,
      model,
      frame: 0,
      fitToken: -1,
    };
    runtimeRef.current = runtime;
    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    const loop = () => {
      runtime.frame = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();
    return () => {
      runtime.model.children.forEach(disposeCraftModel);
      cancelAnimationFrame(runtime.frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.clear();
      if (mount.contains(renderer.domElement))
        mount.removeChild(renderer.domElement);
      runtimeRef.current = null;
    };
  }, []);
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.model.children.forEach(disposeCraftModel);
    runtime.model.clear();
    const next = buildCraftModel(state);
    runtime.model.add(next);
    if (runtime.fitToken !== fitToken) {
      const bounds = new THREE.Box3().setFromObject(next);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const max = Math.max(size.x, size.y, size.z);
      const distance = Math.max(100, max * 2.6);
      if (viewMode === "front")
        runtime.camera.position.set(
          center.x,
          center.y + max * 0.08,
          center.z + distance,
        );
      else if (viewMode === "top")
        runtime.camera.position.set(
          center.x,
          center.y + distance,
          center.z + 0.01,
        );
      else
        runtime.camera.position.set(
          center.x + distance * 0.78,
          center.y + distance * 0.62,
          center.z + distance * 0.78,
        );
      runtime.controls.target.copy(center);
      runtime.controls.update();
      runtime.fitToken = fitToken;
    }
  }, [state, fitToken, viewMode]);
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !runtime.model.children.length) return;
    const bounds = new THREE.Box3().setFromObject(runtime.model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const distance = Math.max(100, Math.max(size.x, size.y, size.z) * 2.6);
    if (viewMode === "front")
      runtime.camera.position.set(center.x, center.y, center.z + distance);
    else if (viewMode === "top")
      runtime.camera.position.set(
        center.x,
        center.y + distance,
        center.z + 0.01,
      );
    else
      runtime.camera.position.set(
        center.x + distance * 0.78,
        center.y + distance * 0.62,
        center.z + distance * 0.78,
      );
    runtime.controls.target.copy(center);
    runtime.controls.update();
  }, [viewMode]);
  return (
    <div className="paramacraft-viewport" ref={mountRef}>
      <div className="paramacraft-viewport-badge">
        <span className="paramacraft-live-dot" /> {state.name || "Untitled"}{" "}
        <span>
          · {Math.round(state.width)} × {Math.round(state.depth)} ×{" "}
          {Math.round(state.height)} mm
        </span>
      </div>
      <button className="paramacraft-fit" onClick={onFit} title="Fit model">
        <Maximize2 size={15} />
      </button>
      <div className="paramacraft-orbit-hint">
        <Rotate3D size={14} /> Drag to orbit · scroll to zoom · right drag to
        pan
      </div>
    </div>
  );
}

function NumericControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "mm",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const decimals =
    step < 1 ? Math.max(1, String(step).split(".")[1]?.length ?? 1) : 0;
  const format = (number: number) => number.toFixed(decimals);
  const clamp = (number: number) => Math.min(max, Math.max(min, number));
  return (
    <label className="paramacraft-range">
      <span>
        {label}
        <output>
          {format(value)} {unit}
        </output>
      </span>
      <div className="paramacraft-range-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          className="paramacraft-number"
          type="number"
          min={min}
          max={max}
          step={step}
          value={format(value)}
          onChange={(event) =>
            onChange(clamp(Number(event.target.value) || min))
          }
        />
      </div>
    </label>
  );
}
function PhaseButton({
  phase,
  active,
  onClick,
  title,
}: {
  phase: PhaseId;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  const number = phase === "body" ? "1" : phase === "pattern" ? "2" : "3";
  return (
    <button
      className={`paramacraft-phase-button ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span>{number}</span>
      <strong>{title}</strong>
      <ChevronDown size={14} />
    </button>
  );
}

function SketchPanel({
  points,
  onAdd,
  onClear,
}: {
  points: Array<[number, number]>;
  onAdd: (point: [number, number]) => void;
  onClear: () => void;
}) {
  return (
    <div className="paramacraft-sketch-panel">
      <div className="paramacraft-sketch-toolbar">
        <span className="paramacraft-section-kicker">SKETCH PROFILE</span>
        <div>
          <button title="Undo">
            <ChevronLeft size={15} />
          </button>
          <button title="Redo">
            <ChevronRight size={15} />
          </button>
          <button title="Clear" onClick={onClear}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div className="paramacraft-sketch-tools">
        <button className="active">
          <span>╱</span> Line <kbd>L</kbd>
        </button>
        <button>
          <span>⌒</span> Arc <kbd>A</kbd>
        </button>
        <button>
          <span>□</span> Rectangle <kbd>R</kbd>
        </button>
        <button>
          <span>○</span> Circle <kbd>C</kbd>
        </button>
        <button>
          <span>↗</span> Offset <kbd>O</kbd>
        </button>
      </div>
      <div
        className="paramacraft-sketch-canvas"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onAdd([
            Math.round(((event.clientX - rect.left) / rect.width) * 100),
            Math.round(((event.clientY - rect.top) / rect.height) * 70),
          ]);
        }}
      >
        <svg viewBox="0 0 100 70" preserveAspectRatio="none">
          <path d="M0 35H100M50 0V70" className="axis" />
          {points.length > 1 && (
            <polyline
              points={points.map(([x, y]) => `${x},${y}`).join(" ")}
              className="sketch-line"
            />
          )}
          {points.map(([x, y], index) => (
            <circle
              key={`${x}-${y}-${index}`}
              cx={x}
              cy={y}
              r="1.1"
              className="sketch-point"
            />
          ))}
        </svg>
        <span className="paramacraft-sketch-origin">
          Click to place endpoints
        </span>
      </div>
      <div className="paramacraft-sketch-footer">
        <span>{points.length} entities · millimeters</span>
        <button onClick={() => onAdd([50, 35])}>
          <Check size={14} /> Close profile
        </button>
      </div>
    </div>
  );
}

function AdvancedSketchPanel({
  points,
  tool,
  onTool,
  onAdd,
  onClear,
  onUndo,
  onRedo,
  onClose,
}: {
  points: Array<[number, number]>;
  tool: SketchTool;
  onTool: (tool: SketchTool) => void;
  onAdd: (point: [number, number]) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClose: () => void;
}) {
  const tools: Array<[SketchTool, string, string]> = [
    ["line", "╱", "Line"],
    ["arc", "⌒", "Arc"],
    ["rectangle", "□", "Rectangle"],
    ["circle", "○", "Circle"],
    ["offset", "↗", "Offset"],
  ];
  return (
    <div className="paramacraft-sketch-panel">
      <div className="paramacraft-sketch-toolbar">
        <span className="paramacraft-section-kicker">SKETCH PROFILE</span>
        <div>
          <button title="Undo" onClick={onUndo} disabled={!points.length}>
            <ChevronLeft size={15} />
          </button>
          <button title="Redo" onClick={onRedo}>
            <ChevronRight size={15} />
          </button>
          <button title="Clear" onClick={onClear} disabled={!points.length}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div className="paramacraft-sketch-status">
        <span className="paramacraft-live-dot" />{" "}
        {tool === "line"
          ? "Place endpoints to draw a line"
          : `Active tool: ${tools.find(([id]) => id === tool)?.[2]}`}
      </div>
      <div className="paramacraft-sketch-tools">
        {tools.map(([id, icon, label]) => (
          <button
            key={id}
            className={tool === id ? "active" : ""}
            onClick={() => onTool(id)}
          >
            <span>{icon}</span> {label} <kbd>{label[0]}</kbd>
          </button>
        ))}
      </div>
      <div
        className="paramacraft-sketch-canvas"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onAdd([
            Math.round(((event.clientX - rect.left) / rect.width) * 100),
            Math.round(((event.clientY - rect.top) / rect.height) * 70),
          ]);
        }}
      >
        <svg viewBox="0 0 100 70" preserveAspectRatio="none">
          <path d="M0 35H100M50 0V70" className="axis" />
          {points.length > 1 && (
            <polyline
              points={points.map(([x, y]) => `${x},${y}`).join(" ")}
              className="sketch-line"
            />
          )}
          {points.map(([x, y], index) => (
            <circle
              key={`${x}-${y}-${index}`}
              cx={x}
              cy={y}
              r="1.1"
              className="sketch-point"
            />
          ))}
        </svg>
        <span className="paramacraft-sketch-origin">
          Click to place geometry · {points.length} entities
        </span>
      </div>
      <div className="paramacraft-sketch-footer">
        <span>{points.length} entities · millimeters</span>
        <button onClick={onClose}>
          <Check size={14} /> Close profile
        </button>
      </div>
    </div>
  );
}

function LobedPillarBodyControls({
  state,
  update,
  onFit,
}: {
  state: CraftState;
  update: <K extends keyof CraftState>(key: K, value: CraftState[K]) => void;
  onFit: () => void;
}) {
  return (
    <>
      <section>
        <div className="paramacraft-section-head">
          <span className="paramacraft-section-kicker">BODY PROFILE</span>
          <span className="paramacraft-live-label">
            <span className="paramacraft-live-dot" /> LIVE
          </span>
        </div>
        <h2>Lobed pillar body</h2>
        <p className="paramacraft-inspector-copy">
          Parametric shell from the synced ParamaCraft preset. Every control
          stays attached to the centered body.
        </p>
        <div className="paramacraft-shape-grid">
          {(Object.keys(SHAPE_LABELS) as ShapeKind[]).map((shape) => (
            <button
              key={shape}
              className={state.shape === shape ? "active" : ""}
              onClick={() => {
                update("shape", shape);
                onFit();
              }}
            >
              <span
                className={`paramacraft-mini-shape paramacraft-mini-${shape}`}
              />
              {SHAPE_LABELS[shape]}
            </button>
          ))}
        </div>
      </section>
      <section>
        <div className="paramacraft-section-head">
          <span className="paramacraft-section-kicker">PROPORTION</span>
          <button className="paramacraft-text-button" onClick={() => onFit()}>
            Fit
          </button>
        </div>
        <NumericControl
          label="Base radius"
          value={state.radius}
          min={20}
          max={120}
          step={1}
          onChange={(value) => update("radius", value)}
        />
        <NumericControl
          label="Lobe count"
          value={state.lobeCount}
          min={3}
          max={12}
          step={1}
          unit=""
          onChange={(value) => update("lobeCount", value)}
        />
        <NumericControl
          label="Lobe amplitude"
          value={state.lobeAmplitude}
          min={0}
          max={30}
          step={0.5}
          onChange={(value) => update("lobeAmplitude", value)}
        />
        <NumericControl
          label="Twist rate"
          value={state.twistRate}
          min={0}
          max={5}
          step={0.1}
          unit="deg/mm"
          onChange={(value) => update("twistRate", value)}
        />
        <NumericControl
          label="Wall height"
          value={state.height}
          min={8}
          max={180}
          step={1}
          onChange={(value) => update("height", value)}
        />
        <NumericControl
          label="Wall thickness"
          value={state.wall}
          min={0.8}
          max={18}
          step={0.2}
          onChange={(value) => update("wall", value)}
        />
      </section>
      <section>
        <div className="paramacraft-section-head">
          <span className="paramacraft-section-kicker">KUMIKO SURFACE</span>
          <span className="paramacraft-optional">attached</span>
        </div>
        <NumericControl
          label="Pattern size"
          value={state.spacing}
          min={6}
          max={32}
          step={0.5}
          onChange={(value) => update("spacing", value)}
        />
        <NumericControl
          label="Line width"
          value={state.patternLineWidth}
          min={0.6}
          max={6}
          step={0.1}
          onChange={(value) => update("patternLineWidth", value)}
        />
        <label className="paramacraft-checkbox">
          <input
            type="checkbox"
            checked={state.openTop}
            onChange={(event) => update("openTop", event.target.checked)}
          />
          <span>Open top / hollow body</span>
        </label>
      </section>
      <section>
        <div className="paramacraft-section-head">
          <span className="paramacraft-section-kicker">MATERIAL</span>
        </div>
        <div className="paramacraft-color-row">
          <label>
            Main color
            <input
              type="color"
              value={state.color}
              onChange={(event) => update("color", event.target.value)}
            />
          </label>
          <label>
            Accent
            <input
              type="color"
              value={state.accent}
              onChange={(event) => update("accent", event.target.value)}
            />
          </label>
        </div>
      </section>
    </>
  );
}

function PhaseControls({
  phase,
  state,
  setState,
  onFit,
}: {
  phase: PhaseId;
  state: CraftState;
  setState: (next: CraftState) => void;
  onFit: () => void;
}) {
  const update = <K extends keyof CraftState>(key: K, value: CraftState[K]) =>
    setState({ ...state, [key]: value });
  if (phase === "body" && state.profile === "lobed-pillar")
    return (
      <div className="paramacraft-phase-content">
        <LobedPillarBodyControls state={state} update={update} onFit={onFit} />
      </div>
    );
  if (phase === "body")
    return (
      <div className="paramacraft-phase-content">
        <section>
          <div className="paramacraft-section-head">
            <span className="paramacraft-section-kicker">BODY PROFILE</span>
            <span className="paramacraft-live-label">
              <span className="paramacraft-live-dot" /> LIVE
            </span>
          </div>
          <h2>Container body</h2>
          <div className="paramacraft-shape-grid">
            {(Object.keys(SHAPE_LABELS) as ShapeKind[]).map((shape) => (
              <button
                key={shape}
                className={state.shape === shape ? "active" : ""}
                onClick={() => {
                  update("shape", shape);
                  onFit();
                }}
              >
                <span
                  className={`paramacraft-mini-shape paramacraft-mini-${shape}`}
                />
                {SHAPE_LABELS[shape]}
              </button>
            ))}
          </div>
        </section>
        <section>
          <div className="paramacraft-section-head">
            <span className="paramacraft-section-kicker">PROPORTION</span>
            <button
              className="paramacraft-text-button"
              onClick={() => setState(DEFAULT_CRAFT)}
            >
              Reset
            </button>
          </div>
          <NumericControl
            label="Size X"
            value={state.width}
            min={24}
            max={220}
            onChange={(value) => update("width", value)}
          />
          <NumericControl
            label="Size Y"
            value={state.depth}
            min={24}
            max={220}
            onChange={(value) => update("depth", value)}
          />
          <NumericControl
            label="Corner radius"
            value={state.radius}
            min={0}
            max={32}
            step={0.5}
            onChange={(value) => update("radius", value)}
          />
          <NumericControl
            label="Wall height"
            value={state.height}
            min={8}
            max={180}
            onChange={(value) => update("height", value)}
          />
          <NumericControl
            label="Wall thickness"
            value={state.wall}
            min={0.8}
            max={18}
            step={0.2}
            onChange={(value) => update("wall", value)}
          />
        </section>
        <section>
          <div className="paramacraft-section-head">
            <span className="paramacraft-section-kicker">MATERIAL</span>
          </div>
          <div className="paramacraft-color-row">
            <label>
              Main color
              <input
                type="color"
                value={state.color}
                onChange={(event) => update("color", event.target.value)}
              />
            </label>
            <label>
              Accent
              <input
                type="color"
                value={state.accent}
                onChange={(event) => update("accent", event.target.value)}
              />
            </label>
          </div>
        </section>
      </div>
    );
  if (phase === "pattern")
    return (
      <div className="paramacraft-phase-content">
        <section>
          <div className="paramacraft-section-head">
            <span className="paramacraft-section-kicker">SURFACE / MOTIF</span>
            <span className="paramacraft-optional">optional</span>
          </div>
          <h2>Pattern</h2>
          <div className="paramacraft-pattern-grid">
            {(Object.keys(PATTERN_LABELS) as PatternKind[]).map((pattern) => (
              <button
                key={pattern}
                className={state.pattern === pattern ? "active" : ""}
                onClick={() => update("pattern", pattern)}
              >
                <span
                  className={`paramacraft-pattern-swatch pattern-${pattern}`}
                />
                {PATTERN_LABELS[pattern]}
              </button>
            ))}
          </div>
        </section>
        <section>
          <NumericControl
            label="Relief"
            value={state.relief}
            min={0}
            max={8}
            step={0.2}
            onChange={(value) => update("relief", value)}
          />
          <NumericControl
            label="Spacing"
            value={state.spacing}
            min={2}
            max={24}
            step={0.5}
            onChange={(value) => update("spacing", value)}
          />
          <label className="paramacraft-checkbox">
            <input
              type="checkbox"
              checked={state.openTop}
              onChange={(event) => update("openTop", event.target.checked)}
            />
            <span>Open top / hollow body</span>
          </label>
        </section>
      </div>
    );
  return (
    <div className="paramacraft-phase-content">
      <section>
        <div className="paramacraft-section-head">
          <span className="paramacraft-section-kicker">GLOBAL / LID</span>
          <span className="paramacraft-valid">
            <Check size={13} /> Printable
          </span>
        </div>
        <h2>Global parameters</h2>
        <NumericControl
          label="Floor thickness"
          value={state.floorThickness}
          min={1}
          max={20}
          step={0.2}
          onChange={(value) => update("floorThickness", value)}
        />
        <NumericControl
          label="Rim height (0 = none)"
          value={state.rimHeight}
          min={0}
          max={20}
          step={0.2}
          onChange={(value) => update("rimHeight", value)}
        />
        <NumericControl
          label="Top edge chamfer (0 = sharp)"
          value={state.chamfer}
          min={0}
          max={8}
          step={0.1}
          onChange={(value) => update("chamfer", value)}
        />
        <NumericControl
          label="Lid fit clearance"
          value={state.lidClearance}
          min={0}
          max={2}
          step={0.05}
          onChange={(value) => update("lidClearance", value)}
        />
        <NumericControl
          label="Lid top thickness"
          value={state.lidTopThickness}
          min={0.8}
          max={12}
          step={0.1}
          onChange={(value) => update("lidTopThickness", value)}
        />
        <NumericControl
          label="Lid flange overhang"
          value={state.lidOverhang}
          min={0}
          max={16}
          step={0.2}
          onChange={(value) => update("lidOverhang", value)}
        />
        <NumericControl
          label="Lid skirt depth"
          value={state.lidSkirtDepth}
          min={0}
          max={30}
          step={0.2}
          onChange={(value) => update("lidSkirtDepth", value)}
        />
        <NumericControl
          label="Lid edge bevel"
          value={state.lidBevel}
          min={0}
          max={6}
          step={0.1}
          onChange={(value) => update("lidBevel", value)}
        />
      </section>
    </div>
  );
}

function OfficialPhaseControls({
  phase,
  setPhase,
  state,
  setState,
  onFit,
}: {
  phase: PhaseId;
  setPhase: (phase: PhaseId) => void;
  state: CraftState;
  setState: (next: CraftState, label?: string) => void;
  onFit: () => void;
}) {
  const label =
    phase === "body"
      ? "Changed body parameters"
      : phase === "pattern"
        ? "Changed surface pattern"
        : "Changed global parameters";
  const nextPhase =
    phase === "body" ? "pattern" : phase === "pattern" ? "global" : "body";
  return (
    <div className="paramacraft-official-phase-controls">
      <div className="paramacraft-official-phase-list">
        <PhaseButton
          phase="body"
          active={phase === "body"}
          onClick={() => setPhase("body")}
          title="Body"
        />
        <PhaseButton
          phase="pattern"
          active={phase === "pattern"}
          onClick={() => setPhase("pattern")}
          title="Pattern"
        />
        <PhaseButton
          phase="global"
          active={phase === "global"}
          onClick={() => setPhase("global")}
          title="Global"
        />
      </div>
      <PhaseControls
        phase={phase}
        state={state}
        setState={(next) => setState(next, label)}
        onFit={onFit}
      />
      <button
        className="paramacraft-official-next"
        onClick={() => setPhase(nextPhase)}
      >
        {phase === "global"
          ? "Back to 1. Body"
          : `Go to ${phase === "body" ? "2. Pattern" : "3. Global"}`}{" "}
        <ArrowRight size={14} />
      </button>
    </div>
  );
}

function EditorPanel({
  state,
  setState,
  tab,
  setTab,
  phase,
  setPhase,
  points,
  setPoints,
  viewMode,
  setViewMode,
  onToggleTheme,
  onBack,
  onSave,
  onPatch,
  onExport,
  onExportStl,
  onImport,
  onFit,
  fitToken,
  onNew,
}: {
  state: CraftState;
  setState: (next: CraftState) => void;
  tab: CraftTab;
  setTab: (tab: CraftTab) => void;
  phase: PhaseId;
  setPhase: (phase: PhaseId) => void;
  points: Array<[number, number]>;
  setPoints: (points: Array<[number, number]>) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onToggleTheme: () => void;
  onBack: () => void;
  onSave: () => void;
  onPatch: () => void;
  onExport: () => void;
  onExportStl: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onFit: () => void;
  fitToken: number;
  onNew: () => void;
}) {
  const volume = Math.max(
    1,
    Math.round((state.width * state.depth * state.height) / 1000),
  );
  return (
    <div className="paramacraft-editor">
      <header className="paramacraft-editor-header">
        <button
          className="paramacraft-icon-button"
          onClick={onBack}
          title="Back to library"
        >
          <ArrowLeft size={17} />
        </button>
        <div className="paramacraft-editor-brand">
          <span className="paramacraft-brand-mark">P</span>
          <div>
            <span>PARAMACRAFT / FORMAFORGE</span>
            <strong>{state.name || "Untitled"}</strong>
          </div>
        </div>
        <div className="paramacraft-save-status">
          <span className="paramacraft-live-dot" /> Autosaved locally{" "}
          <small>
            · {Math.round(state.width)} × {Math.round(state.depth)} ×{" "}
            {Math.round(state.height)} mm
          </small>
        </div>
        <div className="paramacraft-editor-actions">
          <button className="paramacraft-secondary-button" onClick={onNew}>
            <FileUp size={15} /> New
          </button>
          <label className="paramacraft-secondary-button">
            <Upload size={15} /> Import
            <input
              type="file"
              accept=".json,.svg,.png,.jpg,.jpeg"
              onChange={onImport}
              hidden
            />
          </label>
          <button className="paramacraft-secondary-button" onClick={onSave}>
            <Save size={15} /> Save
          </button>
          <button className="paramacraft-secondary-button" onClick={onPatch}>
            <Sparkles size={15} /> Patch
          </button>
          <button className="paramacraft-primary-button" onClick={onExport}>
            <Download size={15} /> Export
          </button>
        </div>
      </header>
      <div className="paramacraft-editor-body">
        <aside className="paramacraft-left-panel">
          <div className="paramacraft-panel-tabs">
            <button
              className={tab === "model" ? "active" : ""}
              onClick={() => setTab("model")}
            >
              <Box size={15} /> Model
            </button>
            <button
              className={tab === "sketch" ? "active" : ""}
              onClick={() => setTab("sketch")}
            >
              <Grid3X3 size={15} /> Sketch
            </button>
            <button
              className={tab === "history" ? "active" : ""}
              onClick={() => setTab("history")}
            >
              <History size={15} /> History
            </button>
          </div>
          {tab === "model" && (
            <div className="paramacraft-controls">
              <div className="paramacraft-phase-stack">
                <PhaseButton
                  phase="body"
                  active={phase === "body"}
                  onClick={() => setPhase("body")}
                  title="Body"
                />
                <PhaseButton
                  phase="pattern"
                  active={phase === "pattern"}
                  onClick={() => setPhase("pattern")}
                  title="Pattern"
                />
                <PhaseButton
                  phase="global"
                  active={phase === "global"}
                  onClick={() => setPhase("global")}
                  title="Global"
                />
              </div>
              <PhaseControls
                phase={phase}
                state={state}
                setState={setState}
                onFit={onFit}
              />
              <button
                className="paramacraft-next-phase"
                onClick={() =>
                  setPhase(
                    phase === "body"
                      ? "pattern"
                      : phase === "pattern"
                        ? "global"
                        : "body",
                  )
                }
              >
                {phase === "global"
                  ? "Back to 1. Body"
                  : `Go to ${phase === "body" ? "2. Pattern" : "3. Global"}`}{" "}
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          {tab === "sketch" && (
            <SketchPanel
              points={points}
              onAdd={(point) => setPoints([...points, point])}
              onClear={() => setPoints([])}
            />
          )}
          {tab === "history" && (
            <div className="paramacraft-history">
              <div className="paramacraft-section-kicker">RECENT CHANGES</div>
              {[
                "Started from Container",
                "Changed wall thickness",
                "Opened Pattern phase",
                "Saved locally",
              ].map((item, index) => (
                <div className="paramacraft-history-row" key={item}>
                  <span>
                    {index === 0 ? <Sparkles size={14} /> : <Check size={14} />}
                  </span>
                  <div>
                    <strong>{item}</strong>
                    <small>
                      {index === 0 ? "Just now" : `${index * 3 + 2} min ago`}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
        <main className="paramacraft-main">
          <CraftViewport
            state={state}
            fitToken={fitToken}
            viewMode={viewMode}
            onFit={onFit}
          />
          <div className="paramacraft-view-dock">
            <button
              className={viewMode === "iso" ? "active" : ""}
              onClick={() => setViewMode("iso")}
            >
              ISO
            </button>
            <button
              className={viewMode === "front" ? "active" : ""}
              onClick={() => setViewMode("front")}
            >
              Front
            </button>
            <button
              className={viewMode === "top" ? "active" : ""}
              onClick={() => setViewMode("top")}
            >
              Top
            </button>
            <span />
            <button onClick={onFit}>
              <Maximize2 size={14} />
            </button>
            <button onClick={onToggleTheme} title="Toggle theme">
              <Moon size={14} />
            </button>
          </div>
        </main>
        <aside className="paramacraft-right-panel">
          <OfficialPhaseControls
            phase={phase}
            setPhase={setPhase}
            state={state}
            setState={setState}
            onFit={onFit}
          />
          <div className="paramacraft-inspector-header">
            <div>
              <span className="paramacraft-section-kicker">
                PARAMETRIC OBJECT
              </span>
              <h2>{state.name || "Untitled"}</h2>
            </div>
            <button className="paramacraft-icon-button">
              <PanelRight size={16} />
            </button>
          </div>
          <label className="paramacraft-name-field">
            Project name
            <input
              value={state.name}
              onChange={(event) =>
                setState({ ...state, name: event.target.value })
              }
            />
          </label>
          <div className="paramacraft-inspector-card">
            <div className="paramacraft-section-head">
              <span className="paramacraft-section-kicker">OUTPUT</span>
              <span className="paramacraft-valid">
                <Check size={13} /> Printable
              </span>
            </div>
            <div className="paramacraft-stat-grid">
              <div>
                <strong>{Math.round(state.width)}</strong>
                <small>mm width</small>
              </div>
              <div>
                <strong>{Math.round(state.depth)}</strong>
                <small>mm depth</small>
              </div>
              <div>
                <strong>{Math.round(state.height)}</strong>
                <small>mm height</small>
              </div>
              <div>
                <strong>{volume}</strong>
                <small>cm³ est.</small>
              </div>
            </div>
            <div className="paramacraft-output-note">
              Body + detached lid · {phase} phase
            </div>
          </div>
          <div className="paramacraft-inspector-card">
            <div className="paramacraft-section-head">
              <span className="paramacraft-section-kicker">
                IMAGE / REFERENCE
              </span>
              <span className="paramacraft-optional">optional</span>
            </div>
            <label className="paramacraft-dropzone">
              <ImagePlus size={22} />
              <strong>
                {state.imageUrl ? "Reference loaded" : "Drop an image or SVG"}
              </strong>
              <small>PNG, JPG or SVG · used as a design reference</small>
              <input
                type="file"
                accept=".svg,.png,.jpg,.jpeg"
                onChange={onImport}
                hidden
              />
            </label>
            {state.imageUrl && (
              <div className="paramacraft-reference-preview">
                <img src={state.imageUrl} alt="Reference" />
                <button onClick={() => setState({ ...state, imageUrl: "" })}>
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="paramacraft-inspector-card">
            <div className="paramacraft-section-head">
              <span className="paramacraft-section-kicker">EXPORT MESH</span>
            </div>
            <p className="paramacraft-inspector-copy">
              Generate a clean mesh from the current parameters. The camera
              stays stable while you tune the model.
            </p>
            <div className="paramacraft-export-grid">
              <button
                className="paramacraft-export-large"
                onClick={onExportStl}
              >
                <PackageOpen size={16} /> Export STL <ArrowRightIcon />
              </button>
              <button
                className="paramacraft-export-large paramacraft-export-secondary"
                onClick={onExport}
              >
                <FileJson size={16} /> Export JSON <ArrowRightIcon />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
function EnhancedEditorPanel({
  state,
  setState,
  tab,
  setTab,
  phase,
  setPhase,
  points,
  setPoints,
  sketchTool,
  setSketchTool,
  viewMode,
  setViewMode,
  onToggleTheme,
  onBack,
  onSave,
  onPatch,
  onExport,
  onExportStl,
  onImport,
  onFit,
  fitToken,
  onNew,
  history,
  historyIndex,
  onUndo,
  onRedo,
  onSketchUndo,
  onSketchRedo,
  onCloseSketch,
  saveStatus,
}: {
  state: CraftState;
  setState: (next: CraftState, label?: string) => void;
  tab: CraftTab;
  setTab: (tab: CraftTab) => void;
  phase: PhaseId;
  setPhase: (phase: PhaseId) => void;
  points: Array<[number, number]>;
  setPoints: (points: Array<[number, number]>) => void;
  sketchTool: SketchTool;
  setSketchTool: (tool: SketchTool) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onToggleTheme: () => void;
  onBack: () => void;
  onSave: () => void;
  onPatch: () => void;
  onExport: () => void;
  onExportStl: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onFit: () => void;
  fitToken: number;
  onNew: () => void;
  history: HistoryEntry[];
  historyIndex: number;
  onUndo: () => void;
  onRedo: () => void;
  onSketchUndo: () => void;
  onSketchRedo: () => void;
  onCloseSketch: () => void;
  saveStatus: string;
}) {
  const volume = estimateVolume(state);
  const printable =
    state.width >= 24 &&
    state.depth >= 24 &&
    state.height >= 8 &&
    state.wall > 0;
  return (
    <div className="paramacraft-editor">
      <header className="paramacraft-editor-header">
        <button
          className="paramacraft-icon-button"
          onClick={onBack}
          title="Back to library"
        >
          <ArrowLeft size={17} />
        </button>
        <div className="paramacraft-editor-brand">
          <span className="paramacraft-brand-mark">P</span>
          <div>
            <span>PARAMACRAFT / FORMAFORGE</span>
            <strong>{state.name || "Untitled"}</strong>
          </div>
        </div>
        <div className="paramacraft-save-status">
          <span className="paramacraft-live-dot" /> {saveStatus}{" "}
          <small>
            · {Math.round(state.width)} × {Math.round(state.depth)} ×{" "}
            {Math.round(state.height)} mm
          </small>
        </div>
        <div className="paramacraft-editor-actions">
          <button className="paramacraft-secondary-button" onClick={onNew}>
            <FileUp size={15} /> New
          </button>
          <label className="paramacraft-secondary-button">
            <Upload size={15} /> Import
            <input
              type="file"
              accept=".json,.svg,.png,.jpg,.jpeg"
              onChange={onImport}
              hidden
            />
          </label>
          <button className="paramacraft-secondary-button" onClick={onSave}>
            <Save size={15} /> Save
          </button>
          <button className="paramacraft-secondary-button" onClick={onPatch}>
            <Sparkles size={15} /> Patch
          </button>
          <button className="paramacraft-primary-button" onClick={onExport}>
            <Download size={15} /> Export
          </button>
        </div>
      </header>
      <div className="paramacraft-editor-body">
        <aside className="paramacraft-left-panel">
          <div className="paramacraft-panel-tabs">
            <button
              className={tab === "model" ? "active" : ""}
              onClick={() => setTab("model")}
            >
              <Box size={15} /> Model
            </button>
            <button
              className={tab === "sketch" ? "active" : ""}
              onClick={() => setTab("sketch")}
            >
              <Grid3X3 size={15} /> Sketch
            </button>
            <button
              className={tab === "history" ? "active" : ""}
              onClick={() => setTab("history")}
            >
              <History size={15} /> History
            </button>
          </div>
          {tab === "model" && (
            <div className="paramacraft-controls">
              <div className="paramacraft-phase-stack">
                <PhaseButton
                  phase="body"
                  active={phase === "body"}
                  onClick={() => setPhase("body")}
                  title="Body"
                />
                <PhaseButton
                  phase="pattern"
                  active={phase === "pattern"}
                  onClick={() => setPhase("pattern")}
                  title="Pattern"
                />
                <PhaseButton
                  phase="global"
                  active={phase === "global"}
                  onClick={() => setPhase("global")}
                  title="Global"
                />
              </div>
              <PhaseControls
                phase={phase}
                state={state}
                setState={(next) =>
                  setState(
                    next,
                    phase === "body"
                      ? "Changed body parameters"
                      : phase === "pattern"
                        ? "Changed surface pattern"
                        : "Changed global parameters",
                  )
                }
                onFit={onFit}
              />
              <button
                className="paramacraft-next-phase"
                onClick={() =>
                  setPhase(
                    phase === "body"
                      ? "pattern"
                      : phase === "pattern"
                        ? "global"
                        : "body",
                  )
                }
              >
                {phase === "global"
                  ? "Back to 1. Body"
                  : `Go to ${phase === "body" ? "2. Pattern" : "3. Global"}`}{" "}
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          {tab === "sketch" && (
            <AdvancedSketchPanel
              points={points}
              tool={sketchTool}
              onTool={setSketchTool}
              onAdd={(point) => setPoints([...points, point])}
              onClear={() => setPoints([])}
              onUndo={onSketchUndo}
              onRedo={onSketchRedo}
              onClose={onCloseSketch}
            />
          )}
          {tab === "history" && (
            <div className="paramacraft-history">
              <div className="paramacraft-history-actions">
                <div>
                  <div className="paramacraft-section-kicker">EDIT HISTORY</div>
                  <strong>
                    {historyIndex + 1} / {history.length} checkpoints
                  </strong>
                </div>
                <div>
                  <button
                    className="paramacraft-icon-button"
                    onClick={onUndo}
                    disabled={historyIndex <= 0}
                    title="Undo"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    className="paramacraft-icon-button"
                    onClick={onRedo}
                    disabled={historyIndex >= history.length - 1}
                    title="Redo"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
              {history
                .slice()
                .reverse()
                .map((entry, index) => (
                  <button
                    className={`paramacraft-history-row ${history.length - 1 - index === historyIndex ? "active" : ""}`}
                    key={entry.id}
                    onClick={() => {
                      const target = history.length - 1 - index;
                      if (target < historyIndex)
                        for (let i = historyIndex; i > target; i -= 1) onUndo();
                      else
                        for (let i = historyIndex; i < target; i += 1) onRedo();
                    }}
                  >
                    <span>
                      {index === 0 ? (
                        <Sparkles size={14} />
                      ) : (
                        <Check size={14} />
                      )}
                    </span>
                    <div>
                      <strong>{entry.label}</strong>
                      <small>
                        {new Date(entry.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {history.length - 1 - index === historyIndex
                          ? " · current"
                          : ""}
                      </small>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </aside>
        <main className="paramacraft-main">
          <CraftViewport
            state={state}
            fitToken={fitToken}
            viewMode={viewMode}
            onFit={onFit}
          />
          <div className="paramacraft-view-dock">
            <button
              className={viewMode === "iso" ? "active" : ""}
              onClick={() => setViewMode("iso")}
            >
              ISO
            </button>
            <button
              className={viewMode === "front" ? "active" : ""}
              onClick={() => setViewMode("front")}
            >
              Front
            </button>
            <button
              className={viewMode === "top" ? "active" : ""}
              onClick={() => setViewMode("top")}
            >
              Top
            </button>
            <span />
            <button onClick={onFit}>
              <Maximize2 size={14} />
            </button>
            <button onClick={onToggleTheme} title="Toggle theme">
              <Moon size={14} />
            </button>
          </div>
        </main>
        <aside className="paramacraft-right-panel">
          <OfficialPhaseControls
            phase={phase}
            setPhase={setPhase}
            state={state}
            setState={setState}
            onFit={onFit}
          />
          <div className="paramacraft-inspector-header">
            <div>
              <span className="paramacraft-section-kicker">
                PARAMETRIC OBJECT
              </span>
              <h2>{state.name || "Untitled"}</h2>
            </div>
            <button className="paramacraft-icon-button">
              <PanelRight size={16} />
            </button>
          </div>
          <label className="paramacraft-name-field">
            Project name
            <input
              value={state.name}
              onChange={(event) =>
                setState(
                  { ...state, name: event.target.value },
                  "Renamed project",
                )
              }
            />
          </label>
          <div className="paramacraft-inspector-card">
            <div className="paramacraft-section-head">
              <span className="paramacraft-section-kicker">OUTPUT</span>
              <span
                className={
                  printable ? "paramacraft-valid" : "paramacraft-warning"
                }
              >
                {printable ? (
                  <>
                    <Check size={13} /> Printable
                  </>
                ) : (
                  "Check dimensions"
                )}
              </span>
            </div>
            <div className="paramacraft-stat-grid">
              <div>
                <strong>{Math.round(state.width)}</strong>
                <small>mm width</small>
              </div>
              <div>
                <strong>{Math.round(state.depth)}</strong>
                <small>mm depth</small>
              </div>
              <div>
                <strong>{Math.round(state.height)}</strong>
                <small>mm height</small>
              </div>
              <div>
                <strong>{volume}</strong>
                <small>cm³ est.</small>
              </div>
            </div>
            <div className="paramacraft-output-note">
              Body + detached lid · {phase} phase
            </div>
          </div>
          <div className="paramacraft-inspector-card">
            <div className="paramacraft-section-head">
              <span className="paramacraft-section-kicker">
                IMAGE / REFERENCE
              </span>
              <span className="paramacraft-optional">optional</span>
            </div>
            <label className="paramacraft-dropzone">
              <ImagePlus size={22} />
              <strong>
                {state.imageUrl ? "Reference loaded" : "Drop an image or SVG"}
              </strong>
              <small>PNG, JPG or SVG · used as a design reference</small>
              <input
                type="file"
                accept=".svg,.png,.jpg,.jpeg"
                onChange={onImport}
                hidden
              />
            </label>
            {state.imageUrl && (
              <div className="paramacraft-reference-preview">
                <img src={state.imageUrl} alt="Reference" />
                <button
                  onClick={() =>
                    setState({ ...state, imageUrl: "" }, "Removed reference")
                  }
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="paramacraft-inspector-card">
            <div className="paramacraft-section-head">
              <span className="paramacraft-section-kicker">EXPORT MESH</span>
            </div>
            <p className="paramacraft-inspector-copy">
              Generate a clean, centered mesh from the current parameters. The
              camera stays stable while you tune the model.
            </p>
            <div className="paramacraft-export-grid">
              <button
                className="paramacraft-export-large"
                onClick={onExportStl}
              >
                <PackageOpen size={16} /> Export STL <ArrowRightIcon />
              </button>
              <button
                className="paramacraft-export-large paramacraft-export-secondary"
                onClick={onExport}
              >
                <FileJson size={16} /> Export JSON <ArrowRightIcon />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
function ArrowRightIcon() {
  return <ChevronRight size={15} />;
}
function GalleryCard({
  preset,
  onOpen,
}: {
  preset: Preset;
  onOpen: () => void;
}) {
  return (
    <button
      className="paramacraft-gallery-card"
      data-preset-id={preset.id}
      onClick={onOpen}
      title={`Open ${preset.label}`}
    >
      <span
        className={`paramacraft-gallery-art paramacraft-gallery-art-${preset.shape} paramacraft-gallery-art-${preset.pattern}`}
      >
        {preset.thumbnailUrl ? (
          <img
            src={preset.thumbnailUrl}
            alt=""
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span />
        )}
        {preset.isPaid && <span className="paramacraft-paid-badge">Paid</span>}
        {preset.tags.includes("meta:new") && (
          <span className="paramacraft-new-badge">New</span>
        )}
        <span className="paramacraft-bookmark">
          <BookmarkIcon />
        </span>
      </span>
      <span className="paramacraft-gallery-card-body">
        <span className="paramacraft-card-tags">
          {preset.tags.map(tagLabel).join(" · ")}
        </span>
        <strong>{preset.label}</strong>
        <small>{preset.description}</small>
      </span>
      <span className="paramacraft-card-open">
        <Play size={13} /> Open
      </span>
    </button>
  );
}
function BookmarkIcon() {
  return <span aria-hidden="true">♡</span>;
}

function Library({
  state,
  mode,
  onMode,
  onOpen,
  onNew,
  onToggleTheme,
  dark,
  locale,
  onLocale,
}: {
  state: CraftState;
  mode: "home" | "projects";
  onMode: (mode: "home" | "projects") => void;
  onOpen: (preset: Preset) => void;
  onNew: () => void;
  onToggleTheme: () => void;
  dark: boolean;
  locale: "en" | "vi";
  onLocale: () => void;
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [visibleCount, setVisibleCount] = useState(60);
  const [suggestions, setSuggestions] = useState(true);
  const tags = useMemo(
    () => [
      "all",
      ...Array.from(
        new Set(REMOTE_PRESETS.flatMap((preset) => preset.tags)),
      ).sort(),
    ],
    [],
  );
  const filtered = REMOTE_PRESETS.filter(
    (preset) =>
      `${preset.label} ${preset.description} ${preset.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (tag === "all" || preset.tags.includes(tag)),
  );
  const visible = filtered.slice(0, visibleCount);
  const changeTag = (next: string) => {
    setTag(next);
    setVisibleCount(60);
  };
  return (
    <div className={`paramacraft-library ${dark ? "dark" : "light"}`}>
      <header className="paramacraft-library-header">
        <div className="paramacraft-library-brand">
          <span className="paramacraft-brand-mark">P</span>
          <div>
            <strong>ParamaCraft</strong>
            <span>FormaForge parametric maker lab</span>
          </div>
        </div>
        <nav className="paramacraft-library-nav">
          <button
            className={mode === "home" ? "active" : ""}
            onClick={() => onMode("home")}
          >
            Home
          </button>
          <button
            className={mode === "projects" ? "active" : ""}
            onClick={() => onMode("projects")}
          >
            My Projects
          </button>
        </nav>
        <div className="paramacraft-library-actions">
          <button className="paramacraft-support">Help</button>
          <button
            className="paramacraft-icon-button"
            onClick={onToggleTheme}
            title="Toggle theme"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="paramacraft-language-button" onClick={onLocale}>
            {locale === "en" ? "VI" : "EN"}
          </button>
          <span className="paramacraft-avatar">F</span>
        </div>
      </header>
      <main className="paramacraft-library-content">
        {mode === "projects" ? (
          <section className="paramacraft-projects-view">
            <div className="paramacraft-page-heading">
              <div>
                <span className="paramacraft-section-kicker">MY PROJECTS</span>
                <h1>Keep making.</h1>
                <p>
                  Local-first projects are stored in this browser. Open one to
                  continue from the same camera and parameters.
                </p>
              </div>
              <button className="paramacraft-primary-button" onClick={onNew}>
                <Sparkles size={15} /> New project
              </button>
            </div>
            <button
              className="paramacraft-project-card"
              onClick={() => onNew()}
            >
              <span className="paramacraft-recent-art">
                <span />
              </span>
              <div>
                <strong>{state.name || "Untitled"}</strong>
                <small>
                  Autosaved locally · {Math.round(state.width)} ×{" "}
                  {Math.round(state.depth)} × {Math.round(state.height)} mm
                </small>
              </div>
              <ChevronRight size={16} />
            </button>
          </section>
        ) : (
          <>
            <section className="paramacraft-library-hero">
              <div>
                <span className="paramacraft-section-kicker">
                  PARAMETRIC MAKER LAB
                </span>
                <h1>
                  Shape it.
                  <br />
                  <em>Print it.</em>
                </h1>
                <p>
                  Build containers, surfaces and useful objects from parametric
                  profiles. Tune the form in real time, then save a clean recipe
                  for the next print.
                </p>
              </div>
              <div className="paramacraft-hero-preview">
                <div className="paramacraft-hero-ring" />
                <div className="paramacraft-hero-shape" />
                <span>PARAMETRIC / 3D</span>
              </div>
            </section>
            <section className="paramacraft-recent">
              <div className="paramacraft-section-head">
                <div>
                  <span className="paramacraft-section-kicker">RECENT</span>
                  <h2>Pick up where you left off</h2>
                </div>
                <button className="paramacraft-text-button" onClick={onNew}>
                  Open blank canvas <ChevronRight size={14} />
                </button>
              </div>
              <div className="paramacraft-recent-row">
                <button
                  className="paramacraft-recent-card active"
                  onClick={onNew}
                >
                  <span className="paramacraft-recent-art">
                    <span />
                  </span>
                  <span>
                    <strong>{state.name || "Untitled"}</strong>
                    <small>Saved locally · just now</small>
                  </span>
                  <ChevronRight size={15} />
                </button>
                {REMOTE_PRESETS.slice(0, 3).map((preset) => (
                  <button
                    className="paramacraft-recent-card"
                    key={preset.id}
                    onClick={() => onOpen(preset)}
                  >
                    <span
                      className={`paramacraft-recent-art paramacraft-recent-art-${preset.shape}`}
                    >
                      {preset.thumbnailUrl ? (
                        <img src={preset.thumbnailUrl} alt="" />
                      ) : (
                        <span />
                      )}
                    </span>
                    <span>
                      <strong>{preset.label}</strong>
                      <small>
                        {preset.tags.slice(0, 2).map(tagLabel).join(" · ")}
                      </small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
            </section>
            <section className="paramacraft-preset-section">
              <div className="paramacraft-section-head">
                <div>
                  <span className="paramacraft-section-kicker">PRESETS</span>
                  <h2>Start from a shape</h2>
                  <p className="paramacraft-preset-count">
                    {REMOTE_PRESETS.length} synced presets · updated from
                    ParamaCraft manifest
                  </p>
                </div>
                <button
                  className="paramacraft-suggestion-button"
                  onClick={() => setSuggestions(!suggestions)}
                >
                  <WandSparkles size={14} /> Suggestions{" "}
                  <span className={suggestions ? "on" : ""} />
                </button>
              </div>
              <div className="paramacraft-discovery-bar">
                <div className="paramacraft-search">
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setVisibleCount(60);
                    }}
                    placeholder="Search presets"
                  />
                </div>
                <select
                  value={tag}
                  onChange={(event) => changeTag(event.target.value)}
                  aria-label="Filter by tag"
                >
                  {tags.map((item) => (
                    <option value={item} key={item}>
                      {item === "all" ? "Filter by tag" : tagLabel(item)}
                    </option>
                  ))}
                </select>
                <span className="paramacraft-result-count">
                  {filtered.length} presets
                </span>
              </div>
              <div className="paramacraft-tag-row">
                {tags.map((item) => (
                  <button
                    className={tag === item ? "active" : ""}
                    key={item}
                    onClick={() => changeTag(item)}
                  >
                    {item === "all" ? "All" : tagLabel(item)}
                  </button>
                ))}
              </div>
              <div className="paramacraft-gallery-grid">
                {visible.map((preset) => (
                  <GalleryCard
                    key={preset.id}
                    preset={preset}
                    onOpen={() => onOpen(preset)}
                  />
                ))}
              </div>
              {visible.length < filtered.length && (
                <button
                  className="paramacraft-load-more"
                  onClick={() => setVisibleCount((count) => count + 60)}
                >
                  Load more · {filtered.length - visible.length} remaining
                </button>
              )}
            </section>
          </>
        )}
      </main>
      <footer className="paramacraft-library-footer">
        <span>ParamaCraft · FormaForgeDT</span>
        <span>Local-first projects · printable geometry</span>
      </footer>
    </div>
  );
}

function downloadBlob(contents: string, filename: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
function exportAsciiStl(state: CraftState) {
  const root = buildCraftModel(state);
  root.updateMatrixWorld(true);
  const lines = [`solid ${state.name || "paramacraft"}`];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry as THREE.BufferGeometry;
    const positions = geometry.getAttribute("position");
    const index = geometry.getIndex();
    const triangle = (a: number, b: number, c: number) => {
      const va = new THREE.Vector3()
        .fromBufferAttribute(positions, a)
        .applyMatrix4(object.matrixWorld);
      const vb = new THREE.Vector3()
        .fromBufferAttribute(positions, b)
        .applyMatrix4(object.matrixWorld);
      const vc = new THREE.Vector3()
        .fromBufferAttribute(positions, c)
        .applyMatrix4(object.matrixWorld);
      const normal = new THREE.Vector3()
        .subVectors(vb, va)
        .cross(new THREE.Vector3().subVectors(vc, va))
        .normalize();
      lines.push(
        ` facet normal ${normal.x.toFixed(6)} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}`,
        "  outer loop",
        `   vertex ${va.x.toFixed(5)} ${va.y.toFixed(5)} ${va.z.toFixed(5)}`,
        `   vertex ${vb.x.toFixed(5)} ${vb.y.toFixed(5)} ${vb.z.toFixed(5)}`,
        `   vertex ${vc.x.toFixed(5)} ${vc.y.toFixed(5)} ${vc.z.toFixed(5)}`,
        "  endloop",
        " endfacet",
      );
    };
    if (index)
      for (let i = 0; i < index.count; i += 3)
        triangle(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    else for (let i = 0; i < positions.count; i += 3) triangle(i, i + 1, i + 2);
  });
  lines.push(`endsolid ${state.name || "paramacraft"}`);
  return lines.join("\n");
}

function readStoredCraftState(): CraftState {
  try {
    const stored = localStorage.getItem("formaforge-paramacraft-project");
    return stored
      ? { ...DEFAULT_CRAFT, ...(JSON.parse(stored) as Partial<CraftState>) }
      : { ...DEFAULT_CRAFT };
  } catch {
    return { ...DEFAULT_CRAFT };
  }
}

export function ParamacraftPage() {
  const { language } = useI18n();
  const { presetId } = useParams<{ presetId?: string }>();
  const navigate = useNavigate();
  const [locale, setLocale] = useState<"en" | "vi">(language);
  const [dark, setDark] = useState(true);
  const [screen, setScreen] = useState<"library" | "editor">(() =>
    presetId ? "editor" : "library",
  );
  const [libraryMode, setLibraryMode] = useState<"home" | "projects">("home");
  const [editorTab, setEditorTab] = useState<CraftTab>("model");
  const [phase, setPhase] = useState<PhaseId>("body");
  const [viewMode, setViewMode] = useState<ViewMode>("iso");
  const [state, setCraftState] = useState<CraftState>(readStoredCraftState);
  const [fitToken, setFitToken] = useState(0);
  const [points, setPoints] = useState<Array<[number, number]>>([]);
  const [sketchTool, setSketchTool] = useState<SketchTool>("line");
  const [sketchPast, setSketchPast] = useState<Array<Array<[number, number]>>>(
    [],
  );
  const [sketchFuture, setSketchFuture] = useState<
    Array<Array<[number, number]>>
  >([]);
  const initialHistory = useRef<HistoryEntry[]>([
    {
      id: Date.now(),
      label: "Opened local project",
      timestamp: Date.now(),
      state: readStoredCraftState(),
    },
  ]);
  const historyCursor = useRef(0);
  const [history, setHistory] = useState<HistoryEntry[]>(
    initialHistory.current,
  );
  const [saveStatus, setSaveStatus] = useState("Autosaved locally");

  useEffect(() => {
    document.documentElement.dataset.paramacraftTheme = dark ? "dark" : "light";
    return () => {
      delete document.documentElement.dataset.paramacraftTheme;
    };
  }, [dark]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      localStorage.setItem(
        "formaforge-paramacraft-project",
        JSON.stringify(state),
      );
      setSaveStatus("Autosaved locally");
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [state]);

  useEffect(() => {
    const label =
      state.profile === "lobed-pillar"
        ? "Lobed pillar body"
        : "Body + detached lid";
    document
      .querySelectorAll<HTMLElement>(".paramacraft-output-note")
      .forEach((element) => {
        element.textContent = `${label} · ${phase} phase`;
      });
  }, [phase, state.profile]);

  const commitState = (next: CraftState, label = "Edited parameters") => {
    const entry: HistoryEntry = {
      id: Date.now() + Math.random(),
      label,
      timestamp: Date.now(),
      state: cloneCraftState(next),
    };
    const entries = [
      ...history.slice(0, historyCursor.current + 1),
      entry,
    ].slice(-60);
    historyCursor.current = entries.length - 1;
    setHistory(entries);
    setCraftState(cloneCraftState(next));
    setSaveStatus("Unsaved changes");
  };

  const replaceDocument = (next: CraftState, label: string) => {
    const entry: HistoryEntry = {
      id: Date.now() + Math.random(),
      label,
      timestamp: Date.now(),
      state: cloneCraftState(next),
    };
    historyCursor.current = 0;
    setHistory([entry]);
    setCraftState(cloneCraftState(next));
    setSketchPast([]);
    setSketchFuture([]);
    setSaveStatus(label);
  };

  const restoreHistory = (index: number) => {
    const entry = history[index];
    if (!entry) return;
    historyCursor.current = index;
    setCraftState(cloneCraftState(entry.state));
    setHistory([...history]);
    setSaveStatus(`Restored: ${entry.label}`);
  };
  const undo = () => restoreHistory(Math.max(0, historyCursor.current - 1));
  const redo = () =>
    restoreHistory(Math.min(history.length - 1, historyCursor.current + 1));

  const updateSketch = (next: Array<[number, number]>) => {
    setSketchPast((past) => [...past, points].slice(-40));
    setSketchFuture([]);
    setPoints(next);
  };
  const sketchUndo = () => {
    if (!sketchPast.length) return;
    setSketchFuture((future) => [points, ...future].slice(0, 40));
    setPoints(sketchPast[sketchPast.length - 1]);
    setSketchPast((past) => past.slice(0, -1));
  };
  const sketchRedo = () => {
    if (!sketchFuture.length) return;
    setSketchPast((past) => [...past, points].slice(-40));
    setPoints(sketchFuture[0]);
    setSketchFuture((future) => future.slice(1));
  };

  useEffect(() => {
    if (!presetId) return;
    const preset = REMOTE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    replaceDocument(stateFromPreset(preset), `Loaded preset: ${preset.label}`);
    setPoints([]);
    setPhase("body");
    setEditorTab("model");
    setViewMode("iso");
    setFitToken((value) => value + 1);
    setScreen("editor");
    // The route is the document identity; this effect should not rewrite it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId]);

  const openPreset = (preset: Preset) => {
    replaceDocument(stateFromPreset(preset), `Loaded preset: ${preset.label}`);
    setPoints([]);
    setPhase("body");
    setEditorTab("model");
    setViewMode("iso");
    setFitToken((value) => value + 1);
    setScreen("editor");
    navigate(`/paramacraft/viewer/${preset.id}`);
  };
  const openNew = () => {
    replaceDocument({ ...DEFAULT_CRAFT }, "Created new project");
    setPoints([]);
    setPhase("body");
    setEditorTab("model");
    setViewMode("iso");
    setFitToken((value) => value + 1);
    setScreen("editor");
    navigate("/paramacraft");
  };
  const save = () => {
    localStorage.setItem(
      "formaforge-paramacraft-project",
      JSON.stringify(state),
    );
    setSaveStatus("Saved locally");
  };
  const fileStem =
    (state.name || "Project")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "project";
  const exportProject = () => {
    save();
    downloadBlob(
      JSON.stringify(
        {
          version: 2,
          app: "FormaForgeDT Paramacraft",
          project: state,
          sketch: points,
        },
        null,
        2,
      ),
      `FormaForgeDT_Paramacraft_${fileStem}.json`,
      "application/json",
    );
  };
  const exportPatch = () => {
    let base: CraftState = { ...DEFAULT_CRAFT };
    try {
      const saved = localStorage.getItem("formaforge-paramacraft-project");
      if (saved)
        base = {
          ...DEFAULT_CRAFT,
          ...(JSON.parse(saved) as Partial<CraftState>),
        };
    } catch {
      /* use defaults as the patch base */
    }
    const changes = Object.keys(state).reduce<Record<string, unknown>>(
      (result, key) => {
        const typedKey = key as keyof CraftState;
        if (state[typedKey] !== base[typedKey]) result[key] = state[typedKey];
        return result;
      },
      {},
    );
    downloadBlob(
      JSON.stringify(
        { version: 2, type: "paramacraft-patch", base, changes },
        null,
        2,
      ),
      `FormaForgeDT_Paramacraft_${fileStem}.patch.json`,
      "application/json",
    );
  };
  const exportStl = () =>
    downloadBlob(
      exportAsciiStl(state),
      `FormaForgeDT_Paramacraft_${fileStem}.stl`,
      "model/stl",
    );
  const importProject = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      file.type.startsWith("image/") ||
      file.name.toLowerCase().endsWith(".svg")
    ) {
      const reader = new FileReader();
      reader.onload = () =>
        commitState(
          { ...state, imageUrl: String(reader.result) },
          "Imported reference image",
        );
      reader.readAsDataURL(file);
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          project?: Partial<CraftState>;
          sketch?: Array<[number, number]>;
        };
        replaceDocument(
          { ...DEFAULT_CRAFT, ...(parsed.project ?? parsed) },
          "Imported project",
        );
        setPoints(parsed.sketch ?? []);
        setPhase("body");
        setEditorTab("model");
        setViewMode("iso");
        setFitToken((value) => value + 1);
        setScreen("editor");
      } catch {
        setSaveStatus("Could not read project file");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  if (screen === "editor")
    return (
      <EnhancedEditorPanel
        state={state}
        setState={commitState}
        tab={editorTab}
        setTab={setEditorTab}
        phase={phase}
        setPhase={setPhase}
        points={points}
        setPoints={updateSketch}
        sketchTool={sketchTool}
        setSketchTool={setSketchTool}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onToggleTheme={() => setDark((value) => !value)}
        onBack={() => {
          setScreen("library");
          navigate("/paramacraft");
        }}
        onSave={save}
        onPatch={exportPatch}
        onExport={exportProject}
        onExportStl={exportStl}
        onImport={importProject}
        onFit={() => setFitToken((value) => value + 1)}
        fitToken={fitToken}
        onNew={openNew}
        history={history}
        historyIndex={historyCursor.current}
        onUndo={undo}
        onRedo={redo}
        onSketchUndo={sketchUndo}
        onSketchRedo={sketchRedo}
        onCloseSketch={() => setEditorTab("model")}
        saveStatus={saveStatus}
      />
    );
  return (
    <Library
      state={state}
      mode={libraryMode}
      onMode={setLibraryMode}
      onOpen={openPreset}
      onNew={openNew}
      onToggleTheme={() => setDark((value) => !value)}
      dark={dark}
      locale={locale}
      onLocale={() => setLocale((value) => (value === "en" ? "vi" : "en"))}
    />
  );
}
