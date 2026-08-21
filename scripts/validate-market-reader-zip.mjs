import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const popup = readFileSync(path.join(root, 'extensions', 'forma-forge-market-reader', 'popup.js'), 'utf8');
const start = popup.indexOf('function concatBytes');
const end = popup.indexOf('\nfunction loadImage', start);
if (start < 0 || end < 0) throw new Error('ZIP helper was not found in popup.js.');

const context = { TextEncoder, Uint8Array, globalThis: {} };
vm.runInNewContext(`${popup.slice(start, end)}\nglobalThis.createStoredZip = createStoredZip;`, context);
const bytes = new TextEncoder().encode('FormaForge ZIP validation');
const archive = context.globalThis.createStoredZip([{ name: 'uct-image-01.jpg', bytes }]);

function read16(offset) { return archive[offset] | (archive[offset + 1] << 8); }
function read32(offset) { return (archive[offset] | (archive[offset + 1] << 8) | (archive[offset + 2] << 16) | (archive[offset + 3] << 24)) >>> 0; }
function decode(offset, length) { return new TextDecoder().decode(archive.slice(offset, offset + length)); }

let eocd = -1;
for (let index = archive.length - 22; index >= 0; index -= 1) {
  if (read32(index) === 0x06054b50) { eocd = index; break; }
}
if (eocd < 0) throw new Error('ZIP end-of-central-directory record is missing.');
const count = read16(eocd + 10);
const centralOffset = read32(eocd + 16);
let cursor = centralOffset;
const names = [];
for (let index = 0; index < count; index += 1) {
  if (read32(cursor) !== 0x02014b50) throw new Error(`Invalid central directory entry at ${cursor}.`);
  const nameLength = read16(cursor + 28);
  const extraLength = read16(cursor + 30);
  const commentLength = read16(cursor + 32);
  const localOffset = read32(cursor + 42);
  const name = decode(cursor + 46, nameLength);
  if (name.endsWith('PKD') || name.includes('\u0000')) throw new Error(`Corrupt filename detected: ${JSON.stringify(name)}`);
  if (read32(localOffset) !== 0x04034b50) throw new Error(`Local header missing for ${name}.`);
  names.push(name);
  cursor += 46 + nameLength + extraLength + commentLength;
}
if (names.length !== 1 || names[0] !== 'uct-image-01.jpg') throw new Error(`Unexpected ZIP entries: ${names.join(', ')}`);
console.log(`Validated browser image ZIP entry: ${names[0]}`);
