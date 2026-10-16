/// <reference lib="webworker" />
import { buildWavy, registerMakerFont } from "./wavyGeometry";
import type { AssetFile, WavyConfig } from "./model";
self.onmessage = async (
  event: MessageEvent<{ config: WavyConfig; fonts: AssetFile[]; base: string }>,
) => {
  try {
    for (const f of event.data.fonts)
      registerMakerFont(`custom:${f.name}`, f.data);
    const parts = await buildWavy(
      event.data.config,
      undefined,
      event.data.base,
    );
    self.postMessage(
      { ok: true, parts },
      parts.flatMap((p) => [p.vertices.buffer, p.indices.buffer]),
    );
  } catch (e) {
    self.postMessage({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
