/// <reference lib="webworker" />
import { buildProduct, calibrationProduct } from "./geometry";
import type { ProductDesign, PrinterProfile } from "./model";
self.onmessage = async (
  event: MessageEvent<{
    design: ProductDesign;
    printer: PrinterProfile;
    base: string;
    calibration?: boolean;
  }>,
) => {
  try {
    const { design, printer, base, calibration } = event.data;
    const parts = calibration
      ? await calibrationProduct(printer, base)
      : await buildProduct(design, printer, base);
    self.postMessage(
      { ok: true, parts },
      parts.flatMap((p) => [p.vertices.buffer, p.indices.buffer]),
    );
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
