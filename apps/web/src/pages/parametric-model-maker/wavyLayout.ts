import type { WavyConfig } from "./model";

/** Fit chunky glyphs along curved text rows without collapsing the outer rows. */
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
  const lineSpacing = c.lineSpacing;
  const maximumRowHeight = Math.max(
    0.05,
    (2 * insetRadius - lineSpacing * (rows - 1)) / rows,
  );
  const chordRowHeight = Math.max(
    0.05,
    (2 * halfHeight - lineSpacing * (rows - 1)) / rows,
  );
  // Let the row center follow the circular chord, while retaining enough
  // glyph height for the outer words to remain legible.
  const glyphRowHeight = Math.max(
    chordRowHeight * 0.55,
    maximumRowHeight * 0.2,
  );
  const center =
    ((rows - 1 - 2 * row) * (chordRowHeight + lineSpacing)) / 2;
  let y = center + ((v - 0.5) * glyphRowHeight * c.glyphHeight) / 100;
  if (c.wavy) {
    // Interpolate from full wave at the glyph center to the selected strength
    // at its top and bottom edges.
    const edgeDistance = Math.min(1, Math.abs(v - 0.5) * 2);
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
