import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionDir = path.join(root, 'extensions', 'forma-forge-market-reader');
const archivePath = path.join(root, 'apps', 'web', 'public', 'downloads', 'forma-forge-market-reader.zip');

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  return Object.fromEntries(readFileSync(filePath, 'utf8').split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : [];
  }));
}

const env = { ...parseEnvFile(path.join(root, '.env')), ...process.env };
const supabaseUrl = String(env.VITE_SUPABASE_URL || 'https://caghwzzhuqfnybcfqxph.supabase.co').replace(/\/$/, '');
const anonKey = String(env.VITE_SUPABASE_ANON_KEY || '').trim();
if (!anonKey) throw new Error('VITE_SUPABASE_ANON_KEY is required to package the extension.');

writeFileSync(path.join(extensionDir, 'config.js'), `globalThis.FORMAFORGE_MARKET_CONFIG = Object.freeze(${JSON.stringify({ supabaseUrl, anonKey })});\n`, 'utf8');
mkdirSync(path.dirname(archivePath), { recursive: true });

const psRoot = extensionDir.replace(/'/g, "''");
const psArchive = archivePath.replace(/'/g, "''");
const command = `Compress-Archive -LiteralPath (Get-ChildItem -LiteralPath '${psRoot}' -File | Select-Object -ExpandProperty FullName) -DestinationPath '${psArchive}' -Force`;
execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { stdio: 'inherit' });
console.log(`Packaged FormaForge Market Reader -> ${path.relative(root, archivePath)}`);
