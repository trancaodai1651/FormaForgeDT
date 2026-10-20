import type { ProductDesign, PrinterProfile } from "./model";
import type { PartMesh } from "../parametric-model-maker/model";
/** One sequential worker per batch retains the WASM kernel and font cache. */
export class ProductSession {
  private worker = new Worker(new URL("./product.worker.ts", import.meta.url), {
    type: "module",
  });
  private closed = false;
  private pending = false;
  close() {
    this.closed = true;
    this.worker.terminate();
  }
  build(
    design: ProductDesign,
    printer: PrinterProfile,
    signal: AbortSignal,
    calibration = false,
  ): Promise<PartMesh[]> {
    if (this.closed)
      return Promise.reject(new DOMException("Cancelled", "AbortError"));
    if (this.pending) return Promise.reject(new Error("SESSION_BUSY"));
    this.pending = true;
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        this.pending = false;
      };
      const abort = () => {
        cleanup();
        this.close();
        reject(new DOMException("Cancelled", "AbortError"));
      };
      const timer = setTimeout(() => {
        cleanup();
        this.close();
        reject(new Error("BUILD_TIMEOUT"));
      }, 180000);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) {
        abort();
        return;
      }
      this.worker.onerror = () => {
        cleanup();
        this.close();
        reject(new Error("WORKER_FAILED"));
      };
      this.worker.onmessage = (e) => {
        cleanup();
        e.data.ok ? resolve(e.data.parts) : reject(new Error(e.data.error));
      };
      this.worker.postMessage({
        design,
        printer,
        base: new URL(
          `${import.meta.env.BASE_URL}parametric-maker-assets/`,
          window.location.href,
        ).href,
        calibration,
      });
    });
  }
}
export async function generateProduct(
  design: ProductDesign,
  printer: PrinterProfile,
  signal: AbortSignal,
  calibration = false,
) {
  const session = new ProductSession();
  try {
    return await session.build(design, printer, signal, calibration);
  } finally {
    session.close();
  }
}
