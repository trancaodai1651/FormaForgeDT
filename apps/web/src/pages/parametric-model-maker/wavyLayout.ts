import type { WavyConfig } from "./model";

/** Place each text row along a shallow circular arc and keep glyphs tangent to
 * that arc. This mirrors the reference's radial lettering while retaining the
 * source font's proportions. */
export function fitWavyPoint(
  nx: number,
  v: number,
  row: number,
  rows: number,
  c: WavyConfig,
): [number, number] {
  const radius = c.diameter / 2;
  const insetRadius = Math.max(0.1, radius - c.margin);
  const maxX =
    (insetRadius * c.widthFill * c.glyphWidth) / 10000;
  const x = nx * maxX;
  const halfHeight = insetRadius;
  const rowHeight = Math.max(
    0.05,
    (2 * halfHeight - c.lineSpacing * (rows - 1)) / rows,
  );
  const flatCenter = ((rows - 1 - 2 * row) * (rowHeight + c.lineSpacing)) / 2;
  const edgeCurve =
    0.45 *
    (c.roundWarp / 100) *
    Math.min(1, (x * x) / Math.max(0.01, maxX * maxX));
  const center = flatCenter * (1 - edgeCurve);
  let y = center + ((v - 0.5) * rowHeight * c.glyphHeight) / 100;
  if (c.wavy) {
    // Outer edges receive the selected percentage; internal row boundaries
    // receive the full wave so the lines flow together without pinching X.
    const edgeDistance = Math.min(1, Math.abs(y) / Math.max(0.01, halfHeight));
    const influence = 1 - (1 - c.waveTopBottom / 100) * edgeDistance;
    y +=
      c.waveAmount *
      Math.sin(
        (x / radius) * Math.PI * c.waveCycles + (c.wavePhase * Math.PI) / 180,
      ) *
      influence;
  }
  return [x, y];
}
