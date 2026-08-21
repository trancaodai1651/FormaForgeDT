const PRICE_READER_URL = 'https://trancaodai1651.github.io/FormaForgeDT/#/price-reader';
let lastProduct = null;
let savedProducts = [];
let session = null;
let exchangeRateState = { rate: DEFAULT_EXCHANGE_RATE_VND, updatedAt: 0, date: null, source: 'Dự phòng', stale: true };
let conversationResult = '';

const $ = (id) => document.getElementById(id);
const vndFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

function status(text, error = false) {
  $('status').textContent = text;
  $('status').style.color = error ? '#ff9489' : '';
}

function priceLabel(price, rate = DEFAULT_EXCHANGE_RATE_VND) {
  const amount = Number(price);
  if (!Number.isFinite(amount)) return '';
  return `¥${amount.toLocaleString('vi-VN')} · ${vndFormatter.format(Math.round(amount * rate))}`;
}

function productPriceLabel(product) {
  const prices = Array.isArray(product.pricesCny) ? product.pricesCny : [];
  const rate = Number(exchangeRateState.rate || product.exchangeRateVnd) || DEFAULT_EXCHANGE_RATE_VND;
  return prices.length ? prices.map((price) => priceLabel(price, rate)).join(' · ') : 'Chưa thấy giá CNY';
}

function exchangeRateLabel(product) {
  const rate = Number(exchangeRateState.rate || product.exchangeRateVnd) || DEFAULT_EXCHANGE_RATE_VND;
  const date = exchangeRateState.date ? ` · cập nhật ${exchangeRateState.date}` : '';
  const statusLabel = exchangeRateState.stale ? ' · dự phòng' : '';
  return `Tỷ giá tham chiếu mới nhất: 1 CNY = ${vndFormatter.format(rate)}${date}${statusLabel}`;
}

function variantRows(product) {
  const rawRows = Array.isArray(product?.variants) ? product.variants : [];
  if (rawRows.length) return rawRows.map((item, index) => {
    const value = item && typeof item === 'object' ? item : { label: item };
    return {
      id: String(value.id || `variant-${index}`),
      label: String(value.label || value.name || `Phân loại ${index + 1}`),
      labelOriginal: String(value.labelOriginal || value.label || value.name || `Phân loại ${index + 1}`),
      priceCny: Number(value.priceCny),
      originalPriceCny: Number.isFinite(Number(value.originalPriceCny)) ? Number(value.originalPriceCny) : undefined,
      stock: Number.isFinite(Number(value.stock)) ? Number(value.stock) : undefined,
      skuAttributes: value.skuAttributes && typeof value.skuAttributes === 'object' ? value.skuAttributes : {},
      skuAttributesOriginal: value.skuAttributesOriginal && typeof value.skuAttributesOriginal === 'object' ? value.skuAttributesOriginal : (value.skuAttributes || {}),
      imageUrl: String(value.imageUrl || value.image_url || '').trim()
    };
  });
  return (Array.isArray(product?.pricesCny) ? product.pricesCny : []).map((price, index) => ({
    id: `price-${index}`,
    label: `Phân loại ${index + 1}`,
    labelOriginal: `Phân loại ${index + 1}`,
    priceCny: Number(price),
    skuAttributes: {},
    skuAttributesOriginal: {},
    imageUrl: ''
  }));
}

function productImageRefs(product) {
  const refs = [];
  const add = (value, fileName = '') => {
    const url = String(value || '').trim();
    if (!/^https?:\/\//i.test(url) || refs.some((item) => item.url === url)) return;
    refs.push({ url, fileName: fileName || `product-image-${String(refs.length + 1).padStart(2, '0')}.jpg` });
  };
  (Array.isArray(product?.images) ? product.images : []).forEach((item) => {
    const value = item && typeof item === 'object' ? item : { url: item };
    add(value.url, value.fileName);
  });
  variantRows(product).forEach((variant, index) => add(variant.imageUrl, `variant-${String(index + 1).padStart(2, '0')}.jpg`));
  return refs.slice(0, 80);
}

function promotionRows(product) {
  return (Array.isArray(product?.promotions) ? product.promotions : []).map((item, index) => {
    const value = item && typeof item === 'object' ? item : { title: item };
    return {
      id: String(value.id || `promotion-${index}`),
      title: String(value.title || value.name || `Khuyến mãi ${index + 1}`),
      titleOriginal: String(value.titleOriginal || value.title || value.name || `Khuyến mãi ${index + 1}`),
      description: String(value.description || 'Thông tin ưu đãi được đọc trực tiếp từ trang sản phẩm.'),
      discountCny: Number.isFinite(Number(value.discountCny)) ? Number(value.discountCny) : undefined,
      finalPriceCny: Number.isFinite(Number(value.finalPriceCny)) ? Number(value.finalPriceCny) : undefined
    };
  });
}

function applyExchangeRate(product) {
  if (product && Number.isFinite(Number(exchangeRateState.rate)) && exchangeRateState.rate > 0) {
    product.exchangeRateVnd = exchangeRateState.rate;
  }
}

async function translateProductDetails(product) {
  const rows = variantRows(product);
  const promotions = promotionRows(product);
  const texts = [product.title, ...rows.map((row) => row.label), ...rows.flatMap((row) => Object.values(row.skuAttributes || {})), ...promotions.map((promotion) => promotion.title)]
    .map((value) => String(value || '').trim())
    .filter((value) => /[\u3400-\u9fff]/.test(value));
  const uniqueTexts = [...new Set(texts)];
  if (!uniqueTexts.length) return product;
  const response = await chrome.runtime.sendMessage({ type: 'TRANSLATE_TEXTS', texts: uniqueTexts, targetLanguage: 'vi' });
  if (response?.error || !Array.isArray(response?.translations)) return product;
  const translationMap = new Map(uniqueTexts.map((text, index) => [text, response.translations[index] || text]));
  const translatedVariants = rows.map((row) => ({
    ...row,
    label: translationMap.get(row.label) || row.label,
    labelOriginal: row.labelOriginal || row.label,
    skuAttributes: Object.fromEntries(Object.entries(row.skuAttributes || {}).map(([key, value]) => [key, translationMap.get(String(value)) || value])),
    skuAttributesOriginal: row.skuAttributesOriginal || row.skuAttributes || {}
  }));
  return {
    ...product,
    title: translationMap.get(product.title) || product.title,
    titleOriginal: product.titleOriginal || product.title,
    variants: translatedVariants,
    promotions: promotions.map((promotion) => ({ ...promotion, title: translationMap.get(promotion.title) || promotion.title, titleOriginal: promotion.titleOriginal || promotion.title }))
  };
}

async function refreshExchangeRate(force = false) {
  try {
    const result = await chrome.runtime.sendMessage({ type: 'GET_EXCHANGE_RATE', force });
    if (!result?.rate) return exchangeRateState;
    exchangeRateState = { ...exchangeRateState, ...result, rate: Number(result.rate) };
    savedProducts.forEach(applyExchangeRate);
    applyExchangeRate(lastProduct);
    renderSavedProducts();
    return exchangeRateState;
  } catch {
    return exchangeRateState;
  }
}

function supportedMarketplace(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return ['taobao.com', 'tmall.com', '1688.com', 'jd.com', 'yangkeduo.com', 'pinduoduo.com', 'xiaohongshu.com']
      .some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

async function loadCurrentProduct({ forceRate = false, automatic = false } = {}) {
  const tab = await activeTab();
  if (!supportedMarketplace(tab.url || '')) return null;
  const product = await sendToPage({ type: 'READ_PRODUCT' });
  await refreshExchangeRate(forceRate);
  applyExchangeRate(product);
  render(product);
  await chrome.storage.local.set({ lastProduct: product });
  if (automatic) status('Đã tự động cập nhật giá và phân loại của sản phẩm.');
  void translateProductDetails(product).then(async (translatedProduct) => {
    if (translatedProduct === product || lastProduct?.url !== product.url) return;
    applyExchangeRate(translatedProduct);
    lastProduct = translatedProduct;
    render(translatedProduct);
    await chrome.storage.local.set({ lastProduct: translatedProduct });
  }).catch(() => {});
  return product;
}

let autoReadTimer = 0;
function scheduleAutoRead() {
  window.clearTimeout(autoReadTimer);
  autoReadTimer = window.setTimeout(() => {
    void loadCurrentProduct({ automatic: true }).catch(() => {});
  }, 700);
}

chrome.tabs.onActivated.addListener(() => scheduleAutoRead());
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.status === 'complete' || changeInfo.url) scheduleAutoRead();
});

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('Không tìm thấy tab đang mở.');
  return tab;
}

async function sendToPage(message) {
  const tab = await activeTab();
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    return await chrome.tabs.sendMessage(tab.id, message);
  }
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fetchImageAssets(refs) {
  const response = await chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_ASSETS', images: refs });
  if (response?.error) throw new Error(response.error);
  return (Array.isArray(response?.assets) ? response.assets : []).filter((asset) => asset?.dataUrl && !asset.error);
}

function dataUrlBytes(dataUrl) {
  const [, encoded = ''] = String(dataUrl).split(',', 2);
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => { result.set(chunk, offset); offset += chunk.length; });
  return result;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function littleEndian(value, size) {
  const bytes = new Uint8Array(size);
  let current = Number(value) >>> 0;
  for (let index = 0; index < size; index += 1) { bytes[index] = current & 0xff; current >>>= 8; }
  return bytes;
}

function createStoredZip(files) {
  const encoder = new TextEncoder();
  const localChunks = [];
  const centralChunks = [];
  let localOffset = 0;
  files.forEach((file) => {
    const name = encoder.encode(file.name);
    const data = file.bytes;
    const checksum = crc32(data);
    const localHeader = concatBytes([
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]), littleEndian(20, 2), littleEndian(0x800, 2), littleEndian(0, 2),
      littleEndian(0, 2), littleEndian(0, 2), littleEndian(checksum, 4), littleEndian(data.length, 4), littleEndian(data.length, 4),
      littleEndian(name.length, 2), littleEndian(0, 2), name
    ]);
    localChunks.push(localHeader, data);
    centralChunks.push(concatBytes([
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]), littleEndian(20, 2), littleEndian(20, 2), littleEndian(0x800, 2), littleEndian(0, 2),
      littleEndian(0, 2), littleEndian(0, 2), littleEndian(checksum, 4), littleEndian(data.length, 4), littleEndian(data.length, 4),
      littleEndian(name.length, 2), littleEndian(0, 2), littleEndian(0, 2), littleEndian(0, 2), littleEndian(0, 2), littleEndian(localOffset, 4), name
    ]));
    localOffset += localHeader.length + data.length;
  });
  const centralDirectory = concatBytes(centralChunks);
  const localDirectory = concatBytes(localChunks);
  const end = concatBytes([
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]), littleEndian(0, 2), littleEndian(0, 2), littleEndian(files.length, 2), littleEndian(files.length, 2),
    littleEndian(centralDirectory.length, 4), littleEndian(localDirectory.length, 4), littleEndian(0, 2)
  ]);
  return concatBytes([localDirectory, centralDirectory, end]);
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Không thể mở ảnh sản phẩm.'));
    image.src = dataUrl;
  });
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines = 5) {
  const value = String(text || '');
  const compact = !/\s/.test(value);
  const words = compact ? [...value] : value.split(/\s+/).filter(Boolean);
  let line = '';
  let lines = 0;
  for (const word of words) {
    const next = line ? `${line}${compact ? '' : ' '}${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, y);
      y += lineHeight;
      lines += 1;
      line = word;
      if (lines >= maxLines) break;
    } else line = next;
  }
  if (lines < maxLines && line) { context.fillText(line, x, y); y += lineHeight; }
  return y;
}

async function renderQuotePage(product, variant, asset, index, total) {
  const canvas = document.createElement('canvas');
  canvas.width = 794;
  canvas.height = 1123;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#16181d';
  context.fillRect(0, 0, canvas.width, 132);
  context.fillStyle = '#f0b967';
  context.font = '700 25px Arial, sans-serif';
  context.fillText('FormaForge · Báo giá sản phẩm', 48, 54);
  context.fillStyle = '#c5ccd6';
  context.font = '14px Arial, sans-serif';
  context.fillText(`${product.source || 'Marketplace'} · Phân loại ${index + 1}/${total}`, 48, 88);
  context.fillStyle = '#20242b';
  context.font = '700 22px Arial, sans-serif';
  let y = drawWrappedText(context, product.title, 48, 184, 698, 30, 4);
  context.fillStyle = '#707987';
  context.font = '14px Arial, sans-serif';
  if (product.titleOriginal && product.titleOriginal !== product.title) y = drawWrappedText(context, product.titleOriginal, 48, y + 4, 698, 22, 4);
  context.fillStyle = '#242832';
  context.font = '700 19px Arial, sans-serif';
  y = drawWrappedText(context, variant.label, 48, y + 28, 698, 27, 5);
  context.fillStyle = '#747e8b';
  context.font = '13px Arial, sans-serif';
  if (variant.labelOriginal && variant.labelOriginal !== variant.label) y = drawWrappedText(context, variant.labelOriginal, 48, y + 2, 698, 21, 4);
  const attributes = Object.entries(variant.skuAttributesOriginal || variant.skuAttributes || {}).map(([key, value]) => `${key}: ${value}`).join(' · ');
  if (attributes) y = drawWrappedText(context, attributes, 48, y + 6, 698, 21, 4);
  context.fillStyle = '#b35c00';
  context.font = '700 22px Arial, sans-serif';
  context.fillText(priceLabel(variant.priceCny, exchangeRateState.rate), 48, y + 28);
  context.fillStyle = '#616b78';
  context.font = '14px Arial, sans-serif';
  context.fillText(`Tồn kho: ${Number.isFinite(variant.stock) ? variant.stock : 'Không rõ'} · Tỷ giá: 1 CNY = ${vndFormatter.format(exchangeRateState.rate)}`, 48, y + 58);
  context.strokeStyle = '#e7e9ed';
  context.lineWidth = 2;
  context.strokeRect(48, y + 94, 698, 610);
  if (asset?.dataUrl) {
    try {
      const image = await loadImage(asset.dataUrl);
      const scale = Math.min(650 / image.width, 560 / image.height, 1);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, 397 - width / 2, y + 112 + (560 - height) / 2, width, height);
    } catch {
      context.fillStyle = '#9aa3af';
      context.font = '16px Arial, sans-serif';
      context.fillText('Không tải được ảnh phân loại', 270, y + 400);
    }
  }
  context.fillStyle = '#7a8491';
  context.font = '12px Arial, sans-serif';
  context.fillText(`Nguồn: ${product.url || ''}`, 48, 760);
  context.fillText(`Tạo lúc: ${new Date().toLocaleString('vi-VN')}`, 48, 784);
  context.fillText('Báo giá tham khảo, vui lòng xác nhận lại với người bán trước khi đặt hàng.', 48, 1030);
  return dataUrlBytes(canvas.toDataURL('image/jpeg', 0.92));
}

function asciiBytes(value) { return new TextEncoder().encode(value); }

function buildImagePdf(jpegPages) {
  const objects = [];
  const pageObjectIds = [];
  const imageObjectIds = [];
  const contentObjectIds = [];
  let nextId = 3;
  jpegPages.forEach(() => {
    pageObjectIds.push(nextId++);
    imageObjectIds.push(nextId++);
    contentObjectIds.push(nextId++);
  });
  objects[1] = asciiBytes('<< /Type /Catalog /Pages 2 0 R >>');
  objects[2] = asciiBytes(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`);
  jpegPages.forEach((jpeg, index) => {
    const pageId = pageObjectIds[index];
    const imageId = imageObjectIds[index];
    const contentId = contentObjectIds[index];
    objects[pageId] = asciiBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /ProcSet [/PDF /ImageC] /XObject << /Im1 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    const content = asciiBytes(`q\n595 0 0 842 0 0 cm\n/Im1 Do\nQ\n`);
    objects[contentId] = concatBytes([asciiBytes(`<< /Length ${content.length} >>\nstream\n`), content, asciiBytes('endstream')]);
    objects[imageId] = concatBytes([asciiBytes(`<< /Type /XObject /Subtype /Image /Width 794 /Height 1123 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, asciiBytes('\nendstream')]);
  });
  const chunks = [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xff, 0xff, 0xff, 0xff, 0x0a])];
  const offsets = new Array(objects.length).fill(0);
  let length = chunks[0].length;
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = length;
    const header = asciiBytes(`${id} 0 obj\n`);
    const footer = asciiBytes('\nendobj\n');
    chunks.push(header, objects[id], footer);
    length += header.length + objects[id].length + footer.length;
  }
  const xrefOffset = length;
  const xref = [`xref\n0 ${objects.length}\n`, '0000000000 65535 f \n', ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`), `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`];
  chunks.push(asciiBytes(xref.join('')));
  return concatBytes(chunks);
}

function cleanFileName(value, fallback) {
  return String(value || fallback).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90) || fallback;
}

async function downloadAllProductImages() {
  if (!lastProduct) return;
  const refs = productImageRefs(lastProduct);
  if (!refs.length) throw new Error('Không tìm thấy ảnh sản phẩm để tải.');
  status(`Đang tải ${refs.length} ảnh sản phẩm để tạo ZIP…`);
  const assets = await fetchImageAssets(refs);
  if (!assets.length) throw new Error('CDN sản phẩm không cho phép tải ảnh.');
  const files = assets.map((asset, index) => ({ name: cleanFileName(asset.fileName, `product-image-${index + 1}.jpg`), bytes: dataUrlBytes(asset.dataUrl) }));
  const zip = createStoredZip(files);
  downloadBlob(new Blob([zip], { type: 'application/zip' }), `FormaForge_Product_${cleanFileName(lastProduct.sourceProductId, 'images')}.zip`);
  status(`Đã tải ZIP gồm ${files.length} ảnh sản phẩm.`);
}

async function downloadVariantQuote() {
  if (!lastProduct) return;
  const rows = variantRows(lastProduct);
  if (!rows.length) throw new Error('Chưa có phân loại để tạo báo giá.');
  const refs = productImageRefs(lastProduct);
  status(`Đang chuẩn bị ${rows.length} trang PDF báo giá…`);
  const assets = await fetchImageAssets(refs);
  const assetsByUrl = new Map(assets.map((asset) => [asset.url, asset]));
  const fallbackAsset = assets[0];
  const pages = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    pages.push(await renderQuotePage(lastProduct, row, assetsByUrl.get(row.imageUrl) || fallbackAsset, index, rows.length));
  }
  const pdf = buildImagePdf(pages);
  downloadBlob(new Blob([pdf], { type: 'application/pdf' }), `FormaForge_Quote_${cleanFileName(lastProduct.sourceProductId, 'product')}.pdf`);
  status(`Đã tải PDF báo giá gồm ${pages.length} phân loại.`);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

function jsonText() {
  return JSON.stringify(lastProduct, null, 2);
}

function render(product) {
  lastProduct = product;
  applyExchangeRate(product);
  $('copy').disabled = false;
  $('download').disabled = false;
  $('save').disabled = !session;
  $('save').textContent = savedProducts.some((item) => item.url === product.url) ? 'Đã lưu sản phẩm' : 'Lưu sản phẩm';
  $('result').classList.remove('hidden');
  const rows = variantRows(product);
  const promotions = promotionRows(product);
  const rates = rows.map((row) => row.priceCny).filter((price) => Number.isFinite(price) && price > 0);
  const rate = Number(product.exchangeRateVnd) || DEFAULT_EXCHANGE_RATE_VND;
  const originalTitle = product.titleOriginal && product.titleOriginal !== product.title
    ? `<small class="original-title">${escapeHtml(product.titleOriginal)}</small>`
    : '';
  const variantMarkup = rows.length
    ? rows.map((variant) => {
      const attributes = Object.entries(variant.skuAttributes || {}).map(([key, value]) => `${key}: ${value}`).join(' · ');
      const originalAttributes = Object.entries(variant.skuAttributesOriginal || {}).map(([key, value]) => `${key}: ${value}`).join(' · ');
      const originalLabel = variant.labelOriginal && variant.labelOriginal !== variant.label
        ? `<small class="original-variant">${escapeHtml(variant.labelOriginal)}</small>`
        : '';
      const originalAttributeMarkup = originalAttributes && originalAttributes !== attributes
        ? `<small class="original-variant">${escapeHtml(originalAttributes)}</small>`
        : '';
      const original = variant.originalPriceCny && variant.originalPriceCny > variant.priceCny
        ? `<span class="original-price">${escapeHtml(priceLabel(variant.originalPriceCny, rate))}</span>`
        : '';
      const stock = Number.isFinite(variant.stock) ? `<small>Tồn kho: ${escapeHtml(variant.stock)}</small>` : '';
      const thumbnail = variant.imageUrl ? `<img class="variant-thumb" src="${escapeHtml(variant.imageUrl)}" alt="" loading="lazy">` : '<span class="variant-thumb"></span>';
      return `<article class="variant-row">${thumbnail}<div><strong>${escapeHtml(variant.label)}</strong>${originalLabel}${attributes ? `<small>${escapeHtml(attributes)}</small>` : ''}${originalAttributeMarkup}${stock}</div><span>${Number.isFinite(variant.priceCny) ? escapeHtml(priceLabel(variant.priceCny, rate)) : 'Chưa có giá'}${original}</span></article>`;
    }).join('')
    : '<p>Chưa đọc được danh sách phân loại.</p>';
  const promotionMarkup = promotions.length
    ? promotions.map((promotion) => `<article class="promotion-item"><strong>${escapeHtml(promotion.title)}</strong><small>${escapeHtml(promotion.description)}</small>${promotion.discountCny ? `<span>Giảm ${escapeHtml(priceLabel(promotion.discountCny, rate))}</span>` : ''}${promotion.finalPriceCny ? `<span>Giá sau ưu đãi: ${escapeHtml(priceLabel(promotion.finalPriceCny, rate))}</span>` : ''}</article>`).join('')
    : '<p>Chưa phát hiện thông tin khuyến mãi chi tiết.</p>';
  const exportMarkup = `<div class="product-export-actions"><button type="button" data-export-pdf>Báo giá PDF theo phân loại</button><button type="button" data-export-images class="secondary">Tải ảnh ZIP</button></div>`;
  $('result').innerHTML = `<h2>${escapeHtml(product.title)}${originalTitle}</h2><p>${escapeHtml(product.source)} · ID: ${escapeHtml(product.sourceProductId || '—')}</p><p>Giá thấp nhất trong ${rows.length || rates.length || 0} phân loại:</p><strong class="price-lines">${rates.length ? escapeHtml(priceLabel(Math.min(...rates), rate)) : 'Chưa thấy giá CNY'}</strong><p class="exchange-rate">${escapeHtml(exchangeRateLabel(product))}</p><section class="result-section"><div class="result-section-title">Tất cả phân loại <span>${rows.length}</span></div><div class="variant-list">${variantMarkup}</div></section><section class="result-section"><div class="result-section-title">Chi tiết khuyến mãi <span>${promotions.length}</span></div><div class="promotion-list">${promotionMarkup}</div></section>${exportMarkup}`;
}

function renderSavedProducts() {
  $('saved-count').textContent = String(savedProducts.length);
  $('saved-empty').classList.toggle('hidden', savedProducts.length > 0);
  $('saved-list').innerHTML = savedProducts.map((product) => `<article class="saved-item"><button class="saved-open" data-open="${escapeHtml(product.url)}"><strong>${escapeHtml(product.title)}</strong><small>${escapeHtml(product.source)} · ${product.pricesCny?.[0] ? escapeHtml(priceLabel(product.pricesCny[0], product.exchangeRateVnd)) : 'Chưa có giá'}</small></button><button class="saved-delete" data-delete="${escapeHtml(product.url)}" aria-label="Xóa sản phẩm">×</button></article>`).join('');
  if (lastProduct) render(lastProduct);
}

async function translateConversation() {
  const input = $('conversation-input').value.trim();
  const [sourceLanguage, targetLanguage] = $('conversation-direction').value.split(':');
  if (!input) {
    $('conversation-status').textContent = 'Hãy nhập hoặc dán tin nhắn trước.';
    return;
  }
  $('conversation-translate').disabled = true;
  $('conversation-status').textContent = 'Đang dịch…';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'TRANSLATE_TEXTS', texts: [input], sourceLanguage, targetLanguage });
    if (response?.error) throw new Error(response.error);
    conversationResult = String(response?.translations?.[0] || input);
    $('conversation-output').value = conversationResult;
    $('conversation-copy').disabled = !conversationResult;
    $('conversation-status').textContent = 'Đã dịch xong. Bạn có thể sao chép và gửi cho shop.';
  } catch (error) {
    $('conversation-status').textContent = error.message || 'Dịch tin nhắn thất bại.';
  } finally {
    $('conversation-translate').disabled = false;
  }
}

async function saveCurrentProduct() {
  if (!lastProduct) return;
  if (!session) {
    status('Hãy đăng nhập Supabase để lưu sản phẩm.', true);
    return;
  }
  $('save').disabled = true;
  try {
    await saveSupabaseProduct(lastProduct);
    savedProducts = await listSupabaseProducts();
    renderSavedProducts();
    status('Đã lưu sản phẩm vào Supabase.');
  } catch (error) {
    status(error.message || 'Không thể lưu sản phẩm vào Supabase.', true);
  } finally {
    $('save').disabled = false;
    if (lastProduct) render(lastProduct);
  }
}

function setAuthView() {
  $('auth-logged-out').classList.toggle('hidden', Boolean(session));
  $('auth-logged-in').classList.toggle('hidden', !session);
  $('auth-state').textContent = session ? 'Đã kết nối' : 'Chưa đăng nhập';
  $('auth-user').textContent = session?.user?.email || '';
  if (lastProduct) $('save').disabled = !session;
}

async function authAction(action) {
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;
  const name = $('auth-name').value.trim() || 'FormaForge user';
  if (!email || !password) {
    $('auth-status').textContent = 'Nhập email và mật khẩu.';
    return;
  }
  $('auth-status').textContent = 'Đang kết nối Supabase…';
  try {
    const result = action === 'register' ? await signUpSupabase(email, password, name) : await signInSupabase(email, password);
    if (!result) {
      $('auth-status').textContent = 'Đăng ký thành công. Hãy xác nhận email rồi đăng nhập.';
      return;
    }
    session = result;
    savedProducts = await listSupabaseProducts();
    setAuthView();
    renderSavedProducts();
    $('auth-status').textContent = 'Đã đăng nhập Supabase.';
  } catch (error) {
    $('auth-status').textContent = error.message || 'Supabase Auth thất bại.';
  }
}

$('read').addEventListener('click', async () => {
  $('read').disabled = true;
  status('Đang đọc dữ liệu trên trang…');
  try {
    await loadCurrentProduct({ forceRate: true });
    status('Đã đọc dữ liệu đang hiển thị trên trang.');
  } catch (error) {
    status(error.message || 'Không đọc được trang này. Hãy tải lại trang sản phẩm.', true);
  } finally {
    $('read').disabled = false;
  }
});

$('translate').addEventListener('click', async () => {
  $('translate').disabled = true;
  status('Đang dịch trang…');
  try {
    const result = await sendToPage({ type: 'TRANSLATE_PAGE' });
    status(result?.count ? `Đã dịch ${result.count} cụm chữ.` : (result?.message || 'Không tìm thấy chữ Trung Quốc.'));
  } catch (error) {
    status(error.message || 'Dịch trang thất bại.', true);
  } finally {
    $('translate').disabled = false;
  }
});

$('restore').addEventListener('click', async () => {
  try {
    await sendToPage({ type: 'RESTORE_TRANSLATION' });
    status('Đã khôi phục chữ gốc.');
  } catch (error) {
    status(error.message || 'Không thể khôi phục.', true);
  }
});

$('conversation-translate').addEventListener('click', () => { void translateConversation(); });
$('conversation-copy').addEventListener('click', async () => {
  if (!conversationResult) return;
  await navigator.clipboard.writeText(conversationResult);
  $('conversation-status').textContent = 'Đã sao chép bản dịch.';
});

$('result').addEventListener('click', async (event) => {
  const target = event.target.closest('[data-export-pdf], [data-export-images]');
  if (!target) return;
  target.disabled = true;
  try {
    if (target.hasAttribute('data-export-pdf')) await downloadVariantQuote();
    else await downloadAllProductImages();
  } catch (error) {
    status(error.message || 'Không thể tạo tệp tải xuống.', true);
  } finally {
    target.disabled = false;
  }
});

$('copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(jsonText());
  status('Đã copy JSON vào clipboard.');
});

$('download').addEventListener('click', () => {
  const blob = new Blob([jsonText()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'formaforge-market-reading.json';
  anchor.click();
  URL.revokeObjectURL(url);
});

$('save').addEventListener('click', () => { void saveCurrentProduct(); });
$('login').addEventListener('click', () => { void authAction('login'); });
$('register').addEventListener('click', () => { void authAction('register'); });
$('logout').addEventListener('click', async () => {
  await signOutSupabase();
  session = null;
  savedProducts = [];
  setAuthView();
  renderSavedProducts();
  $('auth-status').textContent = 'Đã đăng xuất.';
});

$('saved-list').addEventListener('click', async (event) => {
  const target = event.target.closest('[data-open], [data-delete]');
  if (!target) return;
  const url = target.dataset.open || target.dataset.delete;
  if (target.dataset.open) {
    await chrome.tabs.create({ url });
    return;
  }
  savedProducts = savedProducts.filter((item) => item.url !== url);
  await chrome.storage.local.set({ savedProducts });
  renderSavedProducts();
  status('Đã xóa sản phẩm khỏi kho lưu.');
});

$('price-reader').addEventListener('click', () => chrome.tabs.create({ url: PRICE_READER_URL }));
$('options').addEventListener('click', (event) => { event.preventDefault(); chrome.runtime.openOptionsPage(); });

chrome.storage.local.get({ lastProduct: null }).then(async ({ lastProduct: product }) => {
  lastProduct = product;
  session = await getSupabaseSession();
  if (session) {
    try {
      savedProducts = await listSupabaseProducts();
    } catch (error) {
      $('auth-status').textContent = error.message || 'Không thể tải sản phẩm đã lưu.';
    }
  }
  setAuthView();
  renderSavedProducts();
  if (product) render(product);
  void refreshExchangeRate(false);
  scheduleAutoRead();
});
