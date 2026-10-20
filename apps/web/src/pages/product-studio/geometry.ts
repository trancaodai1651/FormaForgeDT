import Module, { type ManifoldToplevel } from "manifold-3d";
import wasmUrl from "manifold-3d/manifold.wasm?url";
import type { ProductDesign, PrinterProfile } from "./model";
import { ProductBuilder } from "./geometryContext";
import { flatProduct } from "./flatGeometry";
import {
  trayProduct,
  frameProduct,
  beadsProduct,
  cutterProduct,
  stencilProduct,
  boxProduct,
} from "./objectGeometry";
import {
  basketProduct,
  rollerProduct,
  surfaceProduct,
} from "./spatialGeometry";
import { brailleProduct } from "./braille";
import { clickerProduct } from "./clickerGeometry";
let promise: Promise<ManifoldToplevel> | undefined;
export async function buildProduct(
  design: ProductDesign,
  printer: PrinterProfile,
  base: string,
  provided?: ManifoldToplevel,
) {
  if (design.params.calibration === true)
    return calibrationProduct(printer, base, provided);
  const api =
    provided ??
    (await (promise ??= Module({ locateFile: () => wasmUrl }).then((m) => {
      m.setup();
      return m;
    })));
  const b = new ProductBuilder(api, design, printer, base);
  try {
    switch (design.family) {
      case "frame":
        await frameProduct(b);
        break;
      case "bead":
        await beadsProduct(b);
        break;
      case "tray":
        await trayProduct(b);
        break;
      case "cutter":
      case "letter-cutter":
        await cutterProduct(b);
        break;
      case "stencil":
        await stencilProduct(b);
        break;
      case "box":
        await boxProduct(b);
        break;
      case "basket":
        await basketProduct(b);
        break;
      case "roller":
        await rollerProduct(b);
        break;
      case "surface-art":
        await surfaceProduct(b);
        break;
      case "braille":
        await brailleProduct(b);
        break;
      case "clicker":
        await clickerProduct(b);
        break;
      default:
        await flatProduct(b);
    }
    return b.finish();
  } finally {
    b.cleanup();
  }
}
export async function calibrationProduct(
  printer: PrinterProfile,
  base: string,
  provided?: ManifoldToplevel,
) {
  const api =
    provided ??
    (await (promise ??= Module({ locateFile: () => wasmUrl }).then((m) => {
      m.setup();
      return m;
    })));
  const { newDesign } = await import("./model");
  const { PRODUCTS } = await import("./catalog");
  const { PARAM_DEFAULTS } = await import("./fields");
  const b = new ProductBuilder(
    api,
    newDesign(PRODUCTS[0], PARAM_DEFAULTS),
    printer,
    base,
  );
  try {
    const holes = [];
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * 12;
      holes.push(b.at(b.move(b.circle(3 + 0.1 + i * 0.05), x, 0), 7, -1));
      const label = await b.text({
        ...b.design.lines[0],
        text: (0.1 + i * 0.05).toFixed(2),
        size: 3,
        x,
        y: 8,
      });
      b.add("Fit label", b.at(label, 0.5, 5), "#FFFFFF");
    }
    b.add(
      "Calibration bar",
      b.sub(b.at(b.rect(78, 28, 3), 5), b.union(holes)),
      "#356CD1",
      "bar",
    );
    b.add(
      "Test pin",
      b.transform(b.at(b.circle(3), 12), 48, 0),
      "#FFFFFF",
      "pin",
    );
    return b.finish();
  } finally {
    b.cleanup();
  }
}
