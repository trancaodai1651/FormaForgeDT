import type { AssetFile, PartMesh, WavyConfig } from "./model";
export function renderWavy(
  config: WavyConfig,
  files: AssetFile[],
  signal: AbortSignal,
): Promise<PartMesh[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./wavy.worker.ts", import.meta.url), {
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
        new Error("Dựng chữ quá 120 giây. Giảm độ chi tiết hoặc số ký tự."),
      );
    }, 120000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    worker.onerror = (e) => {
      cleanup();
      reject(new Error(e.message || "Không khởi động được bộ dựng chữ."));
    };
    worker.onmessage = (
      e: MessageEvent<{ ok: boolean; parts: PartMesh[]; error?: string }>,
    ) => {
      cleanup();
      if (e.data.ok) resolve(e.data.parts);
      else reject(new Error(e.data.error));
    };
    worker.postMessage({
      config,
      base: new URL(
        `${import.meta.env.BASE_URL}parametric-maker-assets/`,
        location.href,
      ).href,
      fonts: files.filter((f) => /\.(ttf|otf)$/i.test(f.name)),
    });
  });
}
