import { readFile, writeFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from '../apps/web/node_modules/fflate/lib/index.cjs';

const manifestPath = new URL('../apps/web/src/paramacraft-manifest.json', import.meta.url);
const outputPath = new URL('../apps/web/src/paramacraft-presets.json', import.meta.url);
const api = 'https://paramacraft.com/api';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const presets = manifest.presets.filter((item) => item.kitId && item.kitVersion);
const kits = [...new Map(presets.map((item) => [`${item.kitId}/${item.kitVersion}`, item])).values()];
const results = {};
const failures = [];
let cursor = 0;

async function worker() {
  while (cursor < kits.length) {
    const item = kits[cursor++];
    const key = `${item.kitId}/${item.kitVersion}`;
    try {
      const response = await fetch(`${api}/kit-bundle/${item.kitId}/${item.kitVersion}`);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
      for (const [name, bytes] of Object.entries(archive)) {
        if (!name.startsWith('presets/') || !name.endsWith('.json')) continue;
        const preset = JSON.parse(strFromU8(bytes));
        if (!preset?.id || !preset.params) continue;
        results[preset.id] = {
          name: preset.name,
          params: preset.params,
          kitId: item.kitId,
          kitVersion: item.kitVersion,
        };
      }
      process.stdout.write(`\rSynced ${Object.keys(results).length} presets from ${key}   `);
    } catch (error) {
      failures.push({ key, message: error instanceof Error ? error.message : String(error) });
    }
  }
}

await Promise.all(Array.from({ length: 8 }, () => worker()));
const output = {
  source: `${api}/kit-bundle`,
  syncedAt: new Date().toISOString(),
  manifestCount: presets.length,
  kitCount: kits.length,
  failures,
  presets: results,
};
await writeFile(outputPath, `${JSON.stringify(output)}\n`, 'utf8');
process.stdout.write(`\nWrote ${Object.keys(results).length} preset payloads from ${kits.length} kits to ${outputPath.pathname}\n`);
if (failures.length) process.stdout.write(`Skipped ${failures.length} kits.\n`);
