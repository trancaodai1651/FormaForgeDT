import type { CrossSection, ManifoldToplevel } from "manifold-3d";
import { BuildContext } from "../../clicker/geometry/buildContext";
import { imageKeyringProfile } from "../../clicker/geometry/geometry/imageKeyring";
import type { WavyConfig } from "./model";

/** Reuse the actual Clicker Image profile; return a solid owned by the caller. */
export function wavyKeyring(
  api: ManifoldToplevel,
  plate: CrossSection,
  c: WavyConfig,
) {
  if (!c.keychainEnabled) return undefined;
  if (c.baseDepth <= 0)
    throw new Error(
      "Móc khóa cần có nền. Hãy tăng Độ dày nền trước khi gắn móc.",
    );
  const ctx = new BuildContext(api);
  try {
    const { footprint, bore } = imageKeyringProfile(
      ctx,
      plate,
      c.keychainHole,
      c.keychainAngle,
      c.keychainOffset,
    );
    // Retain a short neck inside the rim, without the long bridge covering letters.
    const interior = ctx.track(plate.offset(-0.8, "Round", 2, 64));
    const tab = ctx.track(footprint.subtract(interior));
    const connection = ctx.track(tab.intersect(plate));
    if (connection.area() < 0.2)
      throw new Error(
        "Móc đang quá xa nền. Hãy giảm Dịch móc dọc mép để cầu nối bám vào nền.",
      );
    return ctx
      .track(tab.subtract(bore))
      .extrude(c.keychainMatchBase ? c.baseDepth : c.keychainThickness);
  } finally {
    ctx.cleanup();
  }
}
