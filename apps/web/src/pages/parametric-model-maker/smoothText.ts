import * as THREE from "three";
import type { CrossSection, ManifoldToplevel } from "manifold-3d";

/** Continuous top fillet. The lower body fills the lower bevel of the extruder. */
export function smoothTextSolid(
  api: ManifoldToplevel,
  section: CrossSection,
  height: number,
  radius: number,
  detail: number,
) {
  const round = Math.min(radius, height * 0.45);
  if (round <= 0.001) return section.extrude(height);
  const inset = section.offset(-round, "Miter", 2);
  try {
    if (inset.isEmpty())
      throw new Error("Bo cạnh quá lớn so với nét chữ. Hãy giảm Bo cạnh trên.");
    const path = new THREE.ShapePath();
    for (const ring of inset.toPolygons()) {
      const points = [...ring].reverse();
      path.moveTo(...points[0]);
      for (const p of points.slice(1)) path.lineTo(...p);
      path.currentPath!.closePath();
    }
    const geometry = new THREE.ExtrudeGeometry(path.toShapes(false), {
      depth: height - 2 * round,
      steps: 1,
      bevelEnabled: true,
      bevelSize: round,
      bevelThickness: round,
      bevelSegments: detail,
      curveSegments: detail,
    });
    try {
      geometry.translate(0, 0, round);
      const mesh = new api.Mesh({
        numProp: 3,
        vertProperties: new Float32Array(
          geometry.getAttribute("position").array,
        ),
        triVerts: Uint32Array.from(
          { length: geometry.getAttribute("position").count },
          (_, i) => i,
        ),
      });
      mesh.merge();
      const bevel = new api.Manifold(mesh);
      const lower = section.extrude(height - round);
      const envelope = section.extrude(height);
      try {
        const merged = lower.add(bevel);
        try {
          return merged.intersect(envelope);
        } finally {
          merged.delete();
        }
      } finally {
        bevel.delete();
        lower.delete();
        envelope.delete();
      }
    } finally {
      geometry.dispose();
    }
  } finally {
    inset.delete();
  }
}
