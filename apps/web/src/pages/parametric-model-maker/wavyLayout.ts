import type { WavyConfig } from "./model";

// Fitted to sections of the user-supplied MakerWorld 3MF, not its preview image.
// These measured coefficients describe the observed three-line preset;
// they are not the protected SCAD source or proof of parity for other presets.
const REFERENCE_COLUMNS = [
  [
    0.008520692, -0.043532085, 0.003189667, -0.024187031, 0.158625723,
    3.890585229, 0.581654235, 2.394286422,
  ],
  [
    0.00553954, 0.011499848, 0.025837673, 0.012194807, -0.40732995, 2.040710583,
    -1.954177789, 1.246894211,
  ],
  [
    0.005031418, 0.02141392, -0.013437517, 0.0198602, -0.946777662,
    -0.408737933, -0.664592835, -0.62717466,
  ],
] as const;

export function wavyRowWidth(row: number, rows: number, c: WavyConfig) {
  const width =
    (2 * Math.max(0.1, c.diameter / 2 - c.margin) * c.widthFill) / 100;
  // Measured outer-cell span / middle-cell span in the reference: 0.965.
  return width * (rows === 3 && row !== 1 ? 0.965 : 1);
}

/** Map native font Y (100-unit typeface coordinates) at a physical column X. */
export function warpWavyColumn(
  x: number,
  nativeY: number,
  row: number,
  rows: number,
  c: WavyConfig,
): [number, number] {
  const radius = Math.max(0.1, c.diameter / 2 - c.margin);
  const v = 0.5 + ((nativeY / 100 - 0.5) * c.glyphHeight) / 100;
  if (rows === 3) {
    const scale = radius / 18.5;
    const rx = x / scale;
    const chord = Math.sqrt(Math.max(0.01, 18.5 ** 2 - rx ** 2));
    const h = 18.5 + ((chord - 18.5) * c.roundWarp) / 100;
    const [ah, ac, as, az, bh, bc, bs, bz] = REFERENCE_COLUMNS[row];
    const gapChange = c.lineSpacing - 0.9;
    const height = Math.max(
      0.05,
      scale * (ah * h + ac) * 100 - (gapChange * 2) / 3,
    );
    const center =
      scale * ((ah * h + ac) * 50 + bh * h + bc) + (1 - row) * gapChange;
    let y = center + (v - 0.5) * height;
    if (c.wavy) {
      const theta =
        ((rx * 2 * Math.PI) / (34.78 * 0.9375)) * c.waveCycles +
        (c.wavePhase * Math.PI) / 180;
      let lower = bs * Math.sin(theta) + bz * Math.cos(theta);
      let upper =
        (bs + as * 100) * Math.sin(theta) + (bz + az * 100) * Math.cos(theta);
      if (row === 0) upper *= c.waveTopBottom / 40;
      if (row === 2) lower *= c.waveTopBottom / 40;
      const waveScale = c.waveAmount / 2.5;
      const compression = (lower - upper) * waveScale;
      const safeScale =
        compression > height * 0.95 ? (height * 0.95) / compression : 1;
      y += (lower + (upper - lower) * v) * waveScale * safeScale;
    }
    return [x, y];
  }
  const chord = Math.sqrt(Math.max(0.01, radius ** 2 - x ** 2));
  const h = radius + ((chord - radius) * c.roundWarp) / 100;
  const height = Math.max(0.05, (2 * h - c.lineSpacing * (rows - 1)) / rows);
  const center = ((rows - 1 - 2 * row) * (height + c.lineSpacing)) / 2;
  let y = center + (v - 0.5) * height;
  if (c.wavy) {
    const upper = row === 0 ? c.waveTopBottom / 100 : 1;
    const lower = row === rows - 1 ? -c.waveTopBottom / 100 : 1;
    const amount = Math.min(
      c.waveAmount,
      (height * 0.95) / Math.max(0.01, Math.abs(upper - lower)),
    );
    y +=
      amount *
      Math.cos(
        (x / radius) * Math.PI * c.waveCycles + (c.wavePhase * Math.PI) / 180,
      ) *
      (lower + (upper - lower) * v);
  }
  return [x, y];
}

export function fitWavyPoint(
  nx: number,
  v: number,
  row: number,
  rows: number,
  c: WavyConfig,
): [number, number] {
  return warpWavyColumn(
    (nx * wavyRowWidth(row, rows, c)) / 2,
    v * 100,
    row,
    rows,
    c,
  );
}
