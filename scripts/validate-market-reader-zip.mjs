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
const imageStart = popup.indexOf('function imageExtension');
const imageEnd = popup.indexOf('\nfunction promotionRows', imageStart);
if (imageStart < 0 || imageEnd < 0) throw new Error('Image naming helper was not found in popup.js.');
const imageContext = { globalThis: {} };
vm.runInNewContext(`${popup.slice(imageStart, imageEnd)}\nglobalThis.productImageRefs = productImageRefs;`, imageContext);
const product = {
  title: 'Bộ ly thủy tinh',
  titleOriginal: '玻璃杯套装',
  images: [{ url: 'https://cdn.example/product.jpg' }, { url: 'https://cdn.example/red.jpg' }],
  variants: [
    { id: 'v1', label: 'Màu: Đỏ', imageUrl: 'https://cdn.example/red.jpg' },
    { id: 'v2', label: 'Màu: Xanh dương', imageUrl: 'https://cdn.example/red.jpg' },
    { id: 'v3', label: 'Màu: Đỏ', imageUrl: 'https://cdn.example/red-2.jpg' }
  ]
};
const refs = imageContext.globalThis.productImageRefs(product);
const variantRefs = refs.filter((ref) => ref.kind === 'variant');
if (variantRefs.length !== 3) throw new Error(`Expected one image entry per variant, got ${variantRefs.length}.`);
const variantNames = variantRefs.map((ref) => ref.fileName);
if (new Set(variantNames).size !== variantNames.length) throw new Error(`Variant image names are not unique: ${variantNames.join(', ')}`);
if (!variantNames.every((name) => /^[a-z0-9-]+\.(?:jpg|png|webp|gif|avif)$/.test(name))) throw new Error(`Variant image name is not lowercase ASCII: ${variantNames.join(', ')}`);
const productNames = refs.filter((ref) => ref.kind === 'product').map((ref) => ref.fileName);
if (productNames.length !== 1 || productNames[0] !== 'bo-ly-thuy-tinh.jpg') throw new Error(`Variant image leaked into product gallery names: ${productNames.join(', ')}`);
if (variantNames[0] !== 'mau-do.jpg' || variantNames[1] !== 'mau-xanh-duong.jpg' || variantNames[2] !== 'mau-do-2.jpg') throw new Error(`Unexpected translated image names: ${variantNames.join(', ')}`);
const bytes = new TextEncoder().encode('FormaForge ZIP validation');
const archive = context.globalThis.createStoredZip(refs.map((ref) => ({ name: ref.fileName, bytes })));

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
if (names.length !== refs.length || names.join('|') !== refs.map((ref) => ref.fileName).join('|')) throw new Error(`Unexpected ZIP entries: ${names.join(', ')}`);
console.log(`Validated ${names.length} browser image ZIP entries with translated ASCII filenames: ${names.join(', ')}`);
