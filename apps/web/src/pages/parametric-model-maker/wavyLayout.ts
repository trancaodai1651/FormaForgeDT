import type { WavyConfig } from "./model";

/** Fit a rectangular row into a circular band. X stays constant along a glyph
 * stem; the vertical envelope follows the circle, instead of squeezing X as
 * Y changes (which turned outer glyphs into narrow wedges). */
export function fitWavyPoint(
  nx: number,
  v: number,
  row: number,
  rows: number,
  c: WavyConfig,
): [number, number] {
  const radius = c.diameter / 2;
  const insetRadius = Math.max(0.1, radius - c.margin);
  const x = (((nx * insetRadius * c.widthFill) / 100) * c.glyphWidth) / 100;
  const chord = Math.sqrt(Math.max(0.01, insetRadius * insetRadius - x * x));
  const halfHeight = insetRadius + ((chord - insetRadius) * c.roundWarp) / 100;
  const rowHeight = Math.max(
    0.05,
    (2 * halfHeight - c.lineSpacing * (rows - 1)) / rows,
  );
  const center = ((rows - 1 - 2 * row) * (rowHeight + c.lineSpacing)) / 2;
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
