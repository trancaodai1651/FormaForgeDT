import { parse3MF } from "../../clicker/geometry/threemfImport";
import { buildClicker } from "../../clicker/geometry/buildClicker";
import type { BuildParams, RGB, BaseShapeKind } from "../../clicker/types";
import type { CrossSection } from "manifold-3d";
import type { ProductBuilder } from "./geometryContext";
const rgb = (hex: string): RGB =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
export async function clickerProduct(b: ProductBuilder) {
  const assets = await Promise.all(
    ["mx-socket.3mf", "mx-stem.3mf"].map(async (name) => {
      const response = await fetch(
        new URL(
          `../clicker-assets/switch/mx/${name}`,
          new URL(b.base, "http://localhost/"),
        ).href,
      );
      if (!response.ok) throw new Error("SWITCH_ASSET");
      return parse3MF(await response.arrayBuffer());
    }),
  );
  const [socket, stem] = assets.map((raw, i) => {
    const mesh = new b.api.Mesh({
      numProp: 3,
      vertProperties: raw.vertProperties,
      triVerts: raw.triVerts,
    });
    mesh.merge();
    let m = b.track(new b.api.Manifold(mesh));
    const bb = m.boundingBox();
    return b.transform(
      m,
      -(bb.min[0] + bb.max[0]) / 2,
      -(bb.min[1] + bb.max[1]) / 2,
      -(i ? bb.min[2] : bb.max[2]),
    );
  });
  const mode = b.s("clickerMode"),
    line = b.design.lines[0],
    art = b.design.artworks.flatMap((a) =>
      b.art(a).map((r) => ({ section: r.section, color: r.region.color })),
    ),
    entries: {
      text: string;
      image: boolean;
      switches: number;
      extra: boolean;
    }[] =
      mode === "keys"
        ? Array.from(line.text)
            .filter((c) => c.trim())
            .slice(0, 12)
            .map((text) => ({ text, image: false, switches: 1, extra: false }))
        : [
            {
              text: line.text,
              image: true,
              switches: b.n("switchCount"),
              extra: false,
            },
          ];
  if (mode === "keys" && b.b("artKey"))
    entries.push({ text: "", image: true, switches: 1, extra: false });
  if (b.b("headerPiece"))
    entries.push({
      text: b.s("headerText"),
      image: b.b("headerArt"),
      switches: b.n("headerSwitches"),
      extra: true,
    });
  if (!entries.length) throw new Error("EMPTY_GEOMETRY");
  let x = 0,
    minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    baseZ = 0,
    baseTop = 0;
  const caps: {
    name: string;
    color: string;
    solid: ReturnType<ProductBuilder["at"]>;
    object: string;
  }[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i],
      text = entry.text
        ? await b.text({
            ...line,
            text: entry.text,
            size: entry.extra
              ? b.n("headerTextSize")
              : mode === "keys"
                ? b.n("legendSize", 12)
                : line.size,
            x: 0,
            y: 0,
            angle: 0,
          })
        : b.cs([]),
      layers: { section: CrossSection; color: string }[] = [
        ...(!text.isEmpty() ? [{ section: text, color: line.color }] : []),
        ...(entry.image ? art : []),
      ],
      section = b.union2(layers.map((l) => l.section)),
      bb = section.bounds(),
      size = section.isEmpty()
        ? 18
        : Math.max(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1]),
      cx = section.isEmpty() ? 0 : (bb.min[0] + bb.max[0]) / 2,
      cy = section.isEmpty() ? 0 : (bb.min[1] + bb.max[1]) / 2;
    const normalized = (s: CrossSection) =>
        s
          .toPolygons()
          .map((r) =>
            r.map(
              ([a, c]) =>
                [(a - cx) / size, (c - cy) / size] as [number, number],
            ),
          ),
      outline = section.isEmpty()
        ? b.rect(1, 1, 0.1).toPolygons()
        : normalized(section),
      manual =
        !entry.extra && mode !== "keys"
          ? b
              .s("manualSwitches")
              .split(";")
              .filter((s) => s.trim())
              .map((s) => s.split(",").map(Number))
              .filter(
                (p) =>
                  p.length === 2 &&
                  p.every((n) => Number.isFinite(n) && Math.abs(n) < 150),
              )
              .slice(0, 12)
          : [],
      count = manual.length || Math.max(0, Math.min(12, entry.switches)),
      shape: BaseShapeKind = entry.extra
        ? "outline"
        : mode === "keys"
          ? (b.s("keyShape", "square") as BaseShapeKind)
          : mode === "name"
            ? "outline"
            : ((["heart", "star", "hexagon"].includes(b.s("shape"))
                ? b.s("shape")
                : "circle") as BaseShapeKind);
    const params: BuildParams = {
      maxSwitches: 12,
      baseShape: shape,
      capWidthMm: entry.extra
        ? b.n("headerSize")
        : mode === "keys"
          ? b.n("keySize", 18)
          : Math.max(25, b.n("width"), count * b.n("switchPitch") + 8),
      topThickness: b.n("capWall"),
      imageDepth: line.style === "raised" ? line.rise : line.depth,
      imageMargin: mode === "keys" ? 2 : b.n("beadMargin", 2),
      borderWidth: 1,
      capProud: b.n("capProud", 4),
      tolerance: b.printer.clearance,
      stemTolerance: b.n("stemClearance"),
      colorBleed: 0.08,
      stepHeight: 0.6,
      travel: b.n("capProud", 4),
      floorThickness: b.n("clickerFloor", 1.6),
      switches: Array.from({ length: count }, (_, j) => ({
        x: manual[j]?.[0] ?? (j - (count - 1) / 2) * b.n("switchPitch"),
        y: manual[j]?.[1] ?? 0,
        rotation: 0,
      })),
      keychain: {
        enabled: false,
        style: "loop",
        angleDeg: 90,
        holeDiameterMm: b.n("holeDiameter"),
        offsetMm: 0,
      },
      baseFilamentRgb: rgb(b.s("capColor", "#FFFFFF")),
      bodyColorRgb: rgb(b.s("baseColor")),
      componentHeights: {},
      edgeSettings: [],
      extrudeChamfer: false,
      mergeTopFrame: false,
      keepMeshesSeparate: true,
      rasterImageMode: line.style === "flush",
      monochromeImageRelief: false,
      stackColorLayers: false,
      topProfile: b.b("dome")
        ? b.s("domeShape") === "cone"
          ? "cone"
          : "dome"
        : "flat",
      topProfileHeight: b.n("domeHeight"),
      isFlatKeychain: count === 0,
      flatKeychainThicknessMm: b.n("clickerFloor", 1.6),
    };
    const built = buildClicker(
        b.api,
        socket,
        stem,
        layers.map((l, j) => ({
          rings: normalized(l.section),
          filamentRgb: rgb(l.color),
          coverage: 1 / (j + 1),
          partName: `Legend ${j + 1}`,
        })),
        outline,
        params,
      ),
      solids = built.parts.map((part) => {
        const mesh = new b.api.Mesh({
          numProp: part.numProp,
          vertProperties: part.vertProperties,
          triVerts: part.triVerts,
        });
        mesh.merge();
        const solid = b.track(new b.api.Manifold(mesh));
        return { part, solid, box: solid.boundingBox() };
      });
    const socketBounds = socket.boundingBox(),
      minimum =
        Math.max(
          socketBounds.max[0] - socketBounds.min[0],
          socketBounds.max[1] - socketBounds.min[1],
        ) + 2;
    for (let a = 0; a < built.switchPlacements.length; a++)
      for (let c = a + 1; c < built.switchPlacements.length; c++)
        if (
          Math.hypot(
            built.switchPlacements[a].x - built.switchPlacements[c].x,
            built.switchPlacements[a].y - built.switchPlacements[c].y,
          ) <
          minimum - 0.01
        )
          throw new Error("SWITCH_LAYOUT");
    if (
      manual.length &&
      built.switchPlacements.some(
        (p, i) => Math.hypot(p.x - manual[i][0], p.y - manual[i][1]) > 0.1,
      )
    )
      throw new Error("SWITCH_LAYOUT");
    const base = solids.filter((s) => s.part.group === "base" || count === 0),
      tops = solids.filter((s) => s.part.group === "top" && count > 0),
      width =
        Math.max(...solids.map((s) => s.box.max[0])) -
        Math.min(...solids.map((s) => s.box.min[0])),
      height =
        Math.max(...solids.map((s) => s.box.max[1])) -
        Math.min(...solids.map((s) => s.box.min[1]));
    let px = x,
      py =
        b.s("joinStyle") === "stagger"
          ? (i % 2 ? 1 : -1) * b.n("switchPitch") * 0.22
          : 0;
    if (entry.extra) {
      if (b.s("headerLayout") === "stacked") {
        px = (minX + maxX) / 2;
        py = maxY + height / 2 - b.n("headerOverlap");
      } else
        px =
          b.s("headerPosition") === "before"
            ? minX - width / 2 + b.n("headerOverlap")
            : maxX + width / 2 - b.n("headerOverlap");
    }
    if (base.length) {
      const localMin = Math.min(...base.map((s) => s.box.min[2]));
      if (i === 0) baseZ = localMin;
      const shift = count === 0 ? baseZ - localMin : 0;
      for (const { part, solid, box } of base) {
        const color =
          "#" +
          part.colorRgb
            .map((n) => Math.round(n).toString(16).padStart(2, "0"))
            .join("");
        b.add(part.name, b.transform(solid, px, py, shift), color, "holder");
        minX = Math.min(minX, box.min[0] + px);
        maxX = Math.max(maxX, box.max[0] + px);
        minY = Math.min(minY, box.min[1] + py);
        maxY = Math.max(maxY, box.max[1] + py);
        baseTop = Math.max(baseTop, box.max[2] + shift);
      }
    }
    for (const { part, solid } of tops) {
      if (line.style === "engraved" && part.name !== "top-base") continue;
      const color =
        "#" +
        part.colorRgb
          .map((n) => Math.round(n).toString(16).padStart(2, "0"))
          .join("");
      caps.push({
        name: part.name,
        color,
        solid: b.transform(solid, px, py),
        object: `cap-${i + 1}`,
      });
    }
    x += width + b.n("spacing");
  }
  const holderW = maxX - minX,
    holderH = maxY - minY,
    holderX = (minX + maxX) / 2,
    holderY = (minY + maxY) / 2,
    floor = b.n("clickerFloor", 1.6);
  if (b.s("joinStyle") === "bar")
    b.add(
      "Holder floor",
      b.transform(
        b.at(b.rect(holderW, holderH, Math.min(3, b.n("corner"))), floor),
        holderX,
        holderY,
        baseZ,
      ),
      b.s("baseColor"),
      "holder",
    );
  else {
    const bridge = b.move(
      b.rect(holderW, Math.max(3, b.n("bridgeWidth"))),
      holderX,
      holderY,
    );
    b.add(
      "Holder bridges",
      b.at(bridge, floor, baseZ),
      b.s("baseColor"),
      "holder",
    );
  }
  if (b.b("keyring")) {
    const r = b.n("holeDiameter") / 2,
      outer = r + b.n("ringWall", 2.5),
      position = b.s("ringPosition", "left"),
      vertical = ["top", "bottom"].includes(position),
      side = ["left", "bottom"].includes(position) ? -1 : 1,
      px = vertical ? holderX : (side < 0 ? minX : maxX) + side * (outer - 0.8),
      py = vertical ? (side < 0 ? minY : maxY) + side * (outer - 0.8) : holderY,
      ring = b.move(b.cut2(b.circle(outer), b.circle(r)), px, py);
    if (b.s("ringStyle") === "inside") {
      const hx = vertical ? holderX : (side < 0 ? minX : maxX) - side * outer,
        hy = vertical ? (side < 0 ? minY : maxY) - side * outer : holderY,
        bore = b.at(
          b.move(b.circle(r), hx, hy),
          baseTop - baseZ + 2,
          baseZ - 1,
        );
      for (const piece of b.pieces)
        if (piece.object === "holder") piece.solid = b.sub(piece.solid, bore);
    } else
      b.add(
        "Keyring",
        b.at(ring, Math.min(3, floor + 1), baseZ),
        b.s("baseColor"),
        "holder",
      );
  }
  const capBounds = new Map<
    string,
    { min: number; maxY: number; maxZ: number }
  >();
  for (const cap of caps) {
    const bb = cap.solid.boundingBox(),
      old = capBounds.get(cap.object);
    capBounds.set(cap.object, {
      min: Math.min(old?.min ?? Infinity, bb.min[2]),
      maxY: Math.max(old?.maxY ?? -Infinity, bb.max[1]),
      maxZ: Math.max(old?.maxZ ?? -Infinity, bb.max[2]),
    });
  }
  for (const cap of caps) {
    const bounds = capBounds.get(cap.object)!,
      offset = maxY - minY + 12,
      solid = b.transform(cap.solid, 0, offset, baseZ - bounds.min);
    b.add(cap.name, solid, cap.color, cap.object);
  }
}
