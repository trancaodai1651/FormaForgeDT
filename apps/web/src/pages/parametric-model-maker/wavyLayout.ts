import type { WavyConfig } from "./model";

/** Deform the complete ink of a text row into its circular band. */
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
  const chordRowHeight = Math.max(
    0.05,
    (2 * halfHeight - lineSpacing * (rows - 1)) / rows,
  );
  const center = ((rows - 1 - 2 * row) * (chordRowHeight + lineSpacing)) / 2;
  let y = center + ((v - 0.5) * chordRowHeight * c.glyphHeight) / 100;
  if (c.wavy) {
    // Adjacent bands share the same wave displacement at their boundary.
    // This changes their height while preserving the requested line gap.
    const edgeStrength = c.waveTopBottom / 100;
    const upperStrength = row === 0 ? edgeStrength : 1;
    const lowerStrength = row === rows - 1 ? -edgeStrength : 1;
    const influence = lowerStrength + (upperStrength - lowerStrength) * v;
    const maxSlope = rows > 1 ? 1 + edgeStrength : 2 * edgeStrength;
    const amplitude = Math.min(
      c.waveAmount,
      (chordRowHeight * 0.95) / Math.max(0.01, maxSlope),
    );
    y +=
      amplitude *
      Math.cos(
        (x / radius) * Math.PI * c.waveCycles + (c.wavePhase * Math.PI) / 180,
      ) *
      influence;
  }
  return [x, y];
}
