import type { AssetFile, PartMesh } from "./model";
import { MAKER_FONTS } from "./model";
export const SCAD_LIBRARIES = [
  {
    name: "BOSL2",
    include: "BOSL2/std.scad",
    source: "https://github.com/BelfrySCAD/BOSL2",
  },
  {
    name: "UB",
    include: "ub.scad",
    source: "https://github.com/UBaer21/UB.scad",
  },
  {
    name: "KeyV2",
    include: "KeyV2/includes.scad",
    source: "https://github.com/rsheldiii/keyv2",
  },
  {
    name: "gridfinity-rebuilt-openscad",
    include:
      "gridfinity-rebuilt-openscad/src/core/gridfinity-rebuilt-utility.scad",
    source: "https://github.com/kennetek/gridfinity-rebuilt-openscad",
  },
  {
    name: "threads-scad",
    include: "threads-scad/threads.scad",
    source: "https://github.com/rcolyer/threads-scad",
  },
  {
    name: "Getriebe",
    include: "Getriebe.scad",
    source: "https://github.com/janssen86/OpenSCAD-Getriebebibliothek",
  },
  {
    name: "knurledFinishLib_v2",
    include: "knurledFinishLib_v2.scad",
    source: "https://www.thingiverse.com/thing:32122",
  },
];
export function renderScad(
  source: string,
  assets: AssetFile[],
  signal: AbortSignal,
): Promise<{ parts: PartMesh[]; logs: string[] }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./scad.worker.ts", import.meta.url), {
      type: "module",
    });
    const cleanup = () => {
      worker.terminate();
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new Error("Đã hủy dựng mô hình."));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Dựng quá 120 giây. Giảm độ chi tiết hoặc đơn giản hóa code.",
        ),
      );
    }, 120000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    worker.onerror = (e) => {
      cleanup();
      reject(new Error(e.message || "OpenSCAD worker không khởi động được."));
    };
    worker.onmessage = (
      event: MessageEvent<{
        ok: boolean;
        parts: PartMesh[];
        logs: string[];
        error?: string;
      }>,
    ) => {
      cleanup();
      if (!event.data.ok) {
        reject(new Error(event.data.error));
        return;
      }
      try {
        const parts = event.data.parts;
        if (!parts.length)
          throw new Error(
            "Code không tạo ra khối 3D. Kiểm tra lệnh gọi module và phép extrude.",
          );
        // One assembly translation keeps all parts aligned while grounding the project.
        const min = [Infinity, Infinity, Infinity],
          max = [-Infinity, -Infinity, -Infinity];
        for (const p of parts)
          for (let i = 0; i < p.vertices.length; i += 3)
            for (let j = 0; j < 3; j++) {
              min[j] = Math.min(min[j], p.vertices[i + j]);
              max[j] = Math.max(max[j], p.vertices[i + j]);
            }
        for (const p of parts)
          for (let i = 0; i < p.vertices.length; i += 3) {
            p.vertices[i] -= (min[0] + max[0]) / 2;
            p.vertices[i + 1] -= (min[1] + max[1]) / 2;
            p.vertices[i + 2] -= min[2];
          }
        resolve({ parts, logs: event.data.logs });
      } catch (error) {
        reject(error);
      }
    };
    const base = new URL(
      `${import.meta.env.BASE_URL}parametric-maker-assets/`,
      location.href,
    ).href;
    const libraries = SCAD_LIBRARIES.map((l) => l.name);
    worker.postMessage({
      base,
      source,
      assets,
      libraries,
      fonts: MAKER_FONTS.map(([slug]) => slug),
    });
  });
}
