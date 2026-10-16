/// <reference lib="webworker" />
import { unzipSync } from "fflate";
import { partitionCsg, parseOff } from "./csgMaterials";
type ScadModule = {
  FS: {
    mkdirTree(path: string): void;
    writeFile(path: string, data: string | Uint8Array): void;
    readFile(path: string): Uint8Array;
    chdir(path: string): void;
  };
  ENV: Record<string, string>;
  callMain(args: string[]): number;
};
type Factory = (options: Record<string, unknown>) => Promise<ScadModule>;
const libraryCache = new Map<string, Promise<Uint8Array>>();
async function bytes(url: string) {
  const r = await fetch(url);
  if (!r.ok)
    throw new Error(
      `Không tải được tài nguyên (${r.status}): ${url.split("/").pop()}`,
    );
  return new Uint8Array(await r.arrayBuffer());
}
function cached(url: string) {
  if (!libraryCache.has(url)) libraryCache.set(url, bytes(url));
  return libraryCache.get(url)!;
}
function safePath(name: string) {
  const n = name.replace(/\\/g, "/");
  if (
    n.startsWith("/") ||
    n.split("/").some((p) => p === "..") ||
    /[\x00-\x1f]/.test(n)
  )
    throw new Error("Tên file không hợp lệ.");
  return n;
}
self.onmessage = async (
  event: MessageEvent<{
    base: string;
    source: string;
    assets: { name: string; data: Uint8Array }[];
    libraries: string[];
    fonts: string[];
  }>,
) => {
  const logs: string[] = [];
  try {
    const { base, source, assets, libraries, fonts } = event.data;
    const { default: OpenSCAD } = (await import(
      /* @vite-ignore */ `${base}openscad.js`
    )) as { default: Factory };
    const mounted: { name: string; data: Uint8Array | string }[] = [];
    for (const name of libraries) {
      const archive = unzipSync(await cached(`${base}libraries/${name}.zip`));
      for (const [name, data] of Object.entries(archive))
        mounted.push({ name: `/libraries/${safePath(name)}`, data });
    }
    for (const font of fonts)
      mounted.push({
        name: `/fonts/${font}.ttf`,
        data: await cached(`${base}fonts/${font}.ttf`),
      });
    for (const asset of assets) {
      mounted.push({ name: `/work/${safePath(asset.name)}`, data: asset.data });
      if (/\.(ttf|otf)$/i.test(asset.name))
        mounted.push({
          name: `/fonts/${asset.name.split("/").pop()}`,
          data: asset.data,
        });
    }
    async function compile(code: string, format: "csg" | "off") {
      // This upstream build cannot call its C++ main twice. A fresh instance per
      // phase also isolates compiler globals and font caches between renders.
      const instance = await OpenSCAD({
        noInitialRun: true,
        preRun: [
          (module: ScadModule) => {
            module.ENV.OPENSCADPATH = "/libraries:/work";
            module.ENV.FONTCONFIG_FILE = "/fonts.conf";
            module.ENV.FONTCONFIG_PATH = "/";
          },
        ],
        locateFile: (p: string) => `${base}${p}`,
        print: (s: string) => logs.push(s),
        printErr: (s: string) => logs.push(s),
      });
      const fs = instance.FS;
      fs.mkdirTree("/work");
      fs.mkdirTree("/libraries");
      fs.mkdirTree("/fonts");
      fs.mkdirTree("/font-cache");
      for (const f of mounted) {
        fs.mkdirTree(f.name.slice(0, f.name.lastIndexOf("/")));
        fs.writeFile(f.name, f.data);
        if (f.name.startsWith("/libraries/")) {
          const local = f.name.replace("/libraries/", "/work/");
          fs.mkdirTree(local.slice(0, local.lastIndexOf("/")));
          fs.writeFile(local, f.data);
        }
      }
      fs.writeFile(
        "/fonts.conf",
        '<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>/fonts</dir><cachedir>/font-cache</cachedir></fontconfig>',
      );
      instance.ENV.OPENSCADPATH = "/libraries:/work";
      instance.ENV.FONTCONFIG_FILE = "/fonts.conf";
      instance.ENV.FONTCONFIG_PATH = "/";
      fs.chdir("/work");
      fs.writeFile("/work/model.scad", code);
      const offset = logs.length;
      const result = instance.callMain([
        "/work/model.scad",
        "-o",
        `/work/output.${format}`,
      ]);
      if (
        format === "off" &&
        logs.slice(offset).some((s) => /top level object is empty/i.test(s))
      )
        return "OFF 0 0 0";
      if (result !== 0 || logs.slice(offset).some((s) => /^ERROR:/m.test(s)))
        throw new Error(
          logs.slice(offset).join("\n") || "Không dựng được mô hình.",
        );
      if (
        logs
          .slice(offset)
          .some((s) =>
            /Can't open (include|library)|Can't read|not supported/i.test(s),
          )
      )
        throw new Error(logs.slice(offset).join("\n"));
      return new TextDecoder().decode(fs.readFile(`/work/output.${format}`));
    }
    const compiled = await compile(source, "csg");
    const regions = partitionCsg(compiled);
    const parts = [];
    for (let i = 0; i < regions.length; i++) {
      const mesh = parseOff(await compile(regions[i].source, "off"));
      if (mesh.indices.length)
        parts.push({
          ...mesh,
          role: "model",
          name: `SCAD · ${regions[i].color}`,
          color: regions[i].color,
        });
    }
    self.postMessage(
      { ok: true, parts, logs },
      parts.flatMap((p) => [p.vertices.buffer, p.indices.buffer]),
    );
  } catch (error) {
    self.postMessage({
      ok: false,
      error: [
        error instanceof Error ? error.message : String(error),
        ...logs
          .filter((s) => /ERROR:|WARNING:|abort|exception/i.test(s))
          .slice(-8),
      ].join("\n"),
      logs,
    });
  }
};
