import type { ProductBuilder } from "./geometryContext";
export const threadPitch = (size: string) =>
  ({ M8: 1.25, M10: 1.5, M12: 1.75, M16: 2 })[size] ?? 1.75;
export function fitClearance(b: ProductBuilder) {
  const fit = b.s("threadFit");
  return fit === "tight"
    ? 0.1
    : fit === "normal"
      ? 0.2
      : fit === "loose"
        ? 0.3
        : fit === "custom"
          ? b.n("threadClearance", 0.2)
          : b.printer.clearance;
}
/** Matching helical male/socket profiles; clearance is radial and in millimetres. */
export function threadedSolid(
  b: ProductBuilder,
  radius: number,
  pitch: number,
  height: number,
  clearance = 0,
) {
  const n = Math.max(48, b.detail),
    levels = Math.max(12, Math.ceil((height / pitch) * 24)),
    vertices: number[] = [],
    triangles: number[] = [];
  for (let j = 0; j <= levels; j++)
    for (let i = 0; i < n; i++) {
      const z = (j / levels) * height,
        angle = (i / n) * Math.PI * 2,
        phase = (((z / pitch - i / n) % 1) + 1) % 1;
      const lead = Math.min(1, z / 0.6, (height - z) / 0.6),
        r =
          radius +
          clearance +
          0.5 * Math.max(0, 1 - Math.abs(phase - 0.5) * 3) * lead;
      vertices.push(Math.cos(angle) * r, Math.sin(angle) * r, z);
    }
  for (let j = 0; j < levels; j++)
    for (let i = 0; i < n; i++) {
      const a = j * n + i,
        c = (j + 1) * n + i,
        bb = j * n + ((i + 1) % n),
        d = (j + 1) * n + ((i + 1) % n);
      triangles.push(a, bb, d, a, d, c);
    }
  const bottom = vertices.length / 3;
  vertices.push(0, 0, 0);
  const top = vertices.length / 3;
  vertices.push(0, 0, height);
  for (let i = 0; i < n; i++) {
    triangles.push(
      bottom,
      (i + 1) % n,
      i,
      top,
      levels * n + i,
      levels * n + ((i + 1) % n),
    );
  }
  return b.track(
    new b.api.Manifold(
      new b.api.Mesh({
        numProp: 3,
        vertProperties: new Float32Array(vertices),
        triVerts: new Uint32Array(triangles),
      }),
    ),
  );
}
