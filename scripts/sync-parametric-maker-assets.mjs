// Fetch redistributable assets from their upstream projects. No MakerWorld source is used.
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { unzipSync, zipSync, strToU8 } = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
)("fflate");
const target = fileURLToPath(
  new URL("../apps/web/public/parametric-maker-assets/", import.meta.url),
);
const cleanText = (bytes) =>
  strToU8(new TextDecoder().decode(bytes).replace(/[ \t]+(\r?)$/gm, "$1"));
await mkdir(target, { recursive: true });
async function fetchBytes(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "FormaForgeDT-asset-sync" },
  });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}
const runtimeUrl =
  "https://files.openscad.org/playground/OpenSCAD-2025.03.25.wasm24456-WebAssembly-web.zip";
const runtime = unzipSync(await fetchBytes(runtimeUrl));
for (const [name, bytes] of Object.entries(runtime))
  if (/openscad\.(js|wasm)$/.test(name))
    await writeFile(
      `${target}/${name.split("/").pop()}`,
      name.endsWith(".js") ? cleanText(bytes) : bytes,
    );
await writeFile(
  `${target}/COPYING-OpenSCAD`,
  await fetchBytes(
    "https://raw.githubusercontent.com/openscad/openscad/master/COPYING",
  ),
);
const families = [
  ["lilita-one", "lilitaone"],
  ["cherry-bomb-one", "cherrybombone"],
  ["luckiest-guy", "luckiestguy"],
  ["titan-one", "titanone"],
  ["bagel-fat-one", "bagelfatone"],
  ["bevan", "bevan"],
  ["ultra", "ultra"],
];
const manifest = { runtime: runtimeUrl, fonts: [], libraries: [] };
for (const [slug, folder] of families) {
  let listing;
  try {
    listing = JSON.parse(
      new TextDecoder().decode(
        await fetchBytes(
          `https://api.github.com/repos/google/fonts/contents/ofl/${folder}`,
        ),
      ),
    );
  } catch (error) {
    if (!String(error).includes("404:")) throw error;
    listing = JSON.parse(
      new TextDecoder().decode(
        await fetchBytes(
          `https://api.github.com/repos/google/fonts/contents/apache/${folder}`,
        ),
      ),
    );
  }
  const font = listing.find(
    (f) => f.name.endsWith(".ttf") && !/Italic/i.test(f.name),
  );
  if (!font) throw new Error(`Missing font ${folder}`);
  await mkdir(`${target}/fonts`, { recursive: true });
  await writeFile(
    `${target}/fonts/${slug}.ttf`,
    await fetchBytes(font.download_url),
  );
  const license = listing.find((f) => /^(OFL\.txt|LICENSE\.txt)$/.test(f.name));
  if (license)
    await writeFile(
      `${target}/fonts/${slug}-OFL.txt`,
      cleanText(await fetchBytes(license.download_url)),
    );
  manifest.fonts.push({ slug, source: font.download_url });
  console.log(`Font: ${slug}`);
}
const libraries = [
  ["BOSL2", "BelfrySCAD/BOSL2", "master"],
  ["UB", "UBaer21/UB.scad", "main"],
  ["KeyV2", "rsheldiii/keyv2", "master"],
  [
    "gridfinity-rebuilt-openscad",
    "kennetek/gridfinity-rebuilt-openscad",
    "main",
  ],
  ["threads-scad", "rcolyer/threads-scad", "master"],
  ["Getriebe", "janssen86/OpenSCAD-Getriebebibliothek", "master"],
];
await mkdir(`${target}/libraries`, { recursive: true });
for (const [name, repo, branch] of libraries) {
  const commit = JSON.parse(
    new TextDecoder().decode(
      await fetchBytes(
        `https://api.github.com/repos/${repo}/commits/${branch}`,
      ),
    ),
  ).sha;
  const files = unzipSync(
    await fetchBytes(`https://codeload.github.com/${repo}/zip/${commit}`),
  );
  const entries = {};
  for (const [path, bytes] of Object.entries(files)) {
    const relative = path.slice(path.indexOf("/") + 1);
    if (!relative || /(^|\/)(tests?|examples?|docs?|images)\//i.test(relative))
      continue;
    if (
      /\.(scad|stl|svg|dat|json|csv)$/i.test(relative) ||
      /(^|\/)(license[^/]*|copying[^/]*)$/i.test(relative)
    ) {
      const mount =
        name === "UB"
          ? relative.replace(/^libraries\//, "")
          : `${name}/${relative}`;
      entries[mount] = bytes;
      if (name === "Getriebe" && /(^|\/)getriebe\.scad$/i.test(relative))
        entries["Getriebe.scad"] = bytes;
    }
  }
  if (!Object.keys(entries).length) throw new Error(`Empty library ${name}`);
  await writeFile(
    `${target}/libraries/${name}.zip`,
    zipSync(entries, { level: 9 }),
  );
  manifest.libraries.push({
    name,
    repo: `https://github.com/${repo}`,
    commit,
    files: Object.keys(entries).length,
  });
  console.log(`Library: ${name} (${Object.keys(entries).length} files)`);
}
const knurlSource =
  "https://git.sixteenmillimeter.com/16mm/mcopy/raw/commit/7e516a59b65257ec75e6486e6fd01234781a5fe4/scad/knurledFinishLib_v2.scad";
const knurl = await fetchBytes(knurlSource);
await writeFile(
  `${target}/libraries/knurledFinishLib_v2.zip`,
  zipSync({
    "knurledFinishLib_v2.scad": knurl,
    "knurledFinishLib_v2-LICENSE.txt": strToU8(
      "Public domain by aubenc. License and attribution are retained in the source file.\n" +
        knurlSource,
    ),
  }),
);
manifest.libraries.push({
  name: "knurledFinishLib_v2",
  repo: knurlSource,
  files: 1,
});
await writeFile(`${target}/manifest.json`, JSON.stringify(manifest, null, 2));
const fontCommit = JSON.parse(
  new TextDecoder().decode(
    await fetchBytes("https://api.github.com/repos/google/fonts/commits/main"),
  ),
).sha;
const fontTree = JSON.parse(
  new TextDecoder().decode(
    await fetchBytes(
      `https://api.github.com/repos/google/fonts/git/trees/${fontCommit}?recursive=1`,
    ),
  ),
);
if (fontTree.truncated) throw new Error("Google Fonts catalog is incomplete.");
const catalog = fontTree.tree
  .filter((f) => /^(ofl|apache)\/.+\.ttf$/.test(f.path))
  .map((f) => ({
    path: f.path,
    label: f.path
      .split("/")
      .pop()
      .replace(/\.ttf$/, "")
      .replace(/([a-z])([A-Z])/g, "$1 $2"),
    sha: f.sha,
  }));
await writeFile(
  `${target}/font-catalog.json`,
  JSON.stringify({
    source: "https://github.com/google/fonts",
    commit: fontCommit,
    fonts: catalog,
  }),
);
console.log("Parametric Model Maker assets ready.");
