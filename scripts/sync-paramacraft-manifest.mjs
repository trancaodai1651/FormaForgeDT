import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const endpoint = 'https://paramacraft.com/api/presets/manifest';
const output = resolve(process.cwd(), 'apps/web/src/paramacraft-manifest.json');

const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
if (!response.ok) throw new Error(`Paramacraft manifest request failed: ${response.status}`);

const payload = await response.json();
const presets = Array.isArray(payload) ? payload : payload.presets;
if (!Array.isArray(presets) || presets.length === 0) throw new Error('Paramacraft manifest did not contain presets');

const compact = presets.map((preset) => ({
  id: String(preset.id),
  name: String(preset.name || 'Default'),
  tags: Array.isArray(preset.tags) ? preset.tags.map(String) : [],
  kitId: preset.kitId ? String(preset.kitId) : undefined,
  kitVersion: preset.kitVersion ? String(preset.kitVersion) : undefined,
  priority: Number(preset.priority || 0),
  isPaid: Boolean(preset.isPaid),
  hasUsageThumbnail: Boolean(preset.hasUsageThumbnail),
}));

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ source: endpoint, syncedAt: new Date().toISOString(), presets: compact }, null, 2)}\n`, 'utf8');
console.log(`Synced ${compact.length} ParamaCraft presets to ${output}`);
