import type { WavyConfig } from "./model";

/** Fit each text row into a circular band. Keep X fixed along glyph stems and
 * use the circle chord to determine the available height at each X position. */
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
    // Scale the wave using the point's flat position, so the selected edge
    // percentage remains stable while the displacement is applied.
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
