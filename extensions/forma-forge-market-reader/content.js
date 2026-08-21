const DICTIONARY = {
  '价格': 'Giá', '促销': 'Khuyến mãi', '优惠券': 'Phiếu giảm giá', '优惠': 'Ưu đãi', '库存': 'Tồn kho',
  '颜色': 'Màu sắc', '尺码': 'Kích thước', '规格': 'Quy cách', '选择规格': 'Chọn quy cách', '立即购买': 'Mua ngay',
  '加入购物车': 'Thêm vào giỏ', '购物车': 'Giỏ hàng', '店铺': 'Cửa hàng', '已售': 'Đã bán', '销量': 'Lượt bán',
  '运费': 'Phí vận chuyển', '包邮': 'Miễn phí vận chuyển', '现货': 'Có sẵn', '预售': 'Đặt trước', '收藏': 'Yêu thích',
  '评价': 'Đánh giá', '详情': 'Chi tiết', '满减': 'Giảm theo đơn', '折': 'Giảm giá', '客服': 'Chăm sóc khách hàng',
  '登录': 'Đăng nhập', '注册': 'Đăng ký', '搜索': 'Tìm kiếm', '数量': 'Số lượng', '确认': 'Xác nhận', '取消': 'Hủy'
};

const SOURCE_LABELS = {
  'taobao.com': 'Taobao', 'tmall.com': 'Tmall', '1688.com': '1688', 'jd.com': 'JD.com',
  'yangkeduo.com': 'Pinduoduo', 'pinduoduo.com': 'Pinduoduo', 'xiaohongshu.com': 'Xiaohongshu'
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'READ_PRODUCT') {
    sendResponse(readProduct());
    return false;
  }
  if (message?.type === 'TRANSLATE_PAGE') {
    translatePage().then(sendResponse).catch((error) => sendResponse({ error: error instanceof Error ? error.message : 'Translation failed' }));
    return true;
  }
  if (message?.type === 'RESTORE_TRANSLATION') {
    restoreTranslation();
    sendResponse({ ok: true });
    return false;
  }
  return undefined;
});

function sourceLabel() {
  const hostname = location.hostname.replace(/^www\./, '');
  const match = Object.keys(SOURCE_LABELS).find((domain) => hostname.endsWith(domain));
  return match ? SOURCE_LABELS[match] : hostname;
}

function productId() {
  const params = new URLSearchParams(location.search);
  return params.get('id') || params.get('itemId') || params.get('goods_id') || params.get('skuId') ||
    params.get('productId') || location.pathname.match(/(?:item|goods|product|detail)[^\d]*(\d{5,})/i)?.[1] || '';
}

function textOf(element) { return (element?.textContent || '').replace(/\s+/g, ' ').trim(); }

function unique(values, limit = 20) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit);
}

function normalizeImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('data:')) return '';
  try {
    return new URL(raw.startsWith('//') ? `https:${raw}` : raw, location.href).href;
  } catch {
    return '';
  }
}

function imageFileName(url, index = 0) {
  const extension = String(url).split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  return `product-image-${String(index + 1).padStart(2, '0')}.${extension === 'png' ? 'png' : extension === 'webp' ? 'webp' : 'jpg'}`;
}

function findProductImages(variantDetails = []) {
  const source = [...document.scripts].map((script) => script.textContent || '').join('\n');
  const item = embeddedObject(source, 'item');
  const embeddedImages = Array.isArray(item?.images) ? item.images : [];
  const variantImages = variantDetails.map((variant) => variant.imageUrl).filter(Boolean);
  const domImages = [...document.querySelectorAll('img, [data-src], [data-ks-lazyload], [data-original], [data-zoom-image]')]
    .map((element) => element.getAttribute('src') || element.getAttribute('data-src') || element.getAttribute('data-ks-lazyload') || element.getAttribute('data-original') || element.getAttribute('data-zoom-image'))
    .filter((value) => value && !/avatar|sns_logo|logo|sprite|icon|rate\.jpg|userheader/i.test(value) && !/-tps-\d+-\d+/i.test(value) && /\.(?:jpe?g|png|webp)(?:[?#_.]|$)/i.test(value));
  return [...new Set([...embeddedImages, ...variantImages, ...domImages].map(normalizeImageUrl).filter(Boolean))]
    .slice(0, 80)
    .map((url, index) => ({ url, fileName: imageFileName(url, index) }));
}

function findPrices() {
  const text = document.body?.innerText || '';
  const results = [];
  const currencyPattern = /(?:\u00a5|RMB|CNY|\u5143)\s*([0-9]+(?:[.,][0-9]{1,2})?)/gi;
  for (const match of text.matchAll(currencyPattern)) {
    const amount = Number(match[1].replace(',', '.'));
    if (Number.isFinite(amount) && amount >= 0) results.push(amount);
  }
  return [...new Set(results)].slice(0, 20);
}

function parseNumber(value) {
  const cleaned = String(value ?? '').replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}(?:\D|$))/g, '');
  const normalized = cleaned.includes('.') && cleaned.includes(',')
    ? cleaned.replace(/,/g, '')
    : cleaned.replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : undefined;
}

function embeddedObject(source, key) {
  const markerIndex = source.indexOf(`"${key}":`);
  if (markerIndex < 0) return null;
  const start = source.indexOf('{', markerIndex);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') { inString = true; continue; }
    if (character === '{') depth += 1;
    if (character === '}' && --depth === 0) {
      try { return JSON.parse(source.slice(start, index + 1)); } catch { return null; }
    }
  }
  return null;
}

function marketplaceState() {
  const source = [...document.scripts].map((script) => script.textContent || '').join('\n');
  return {
    decision: embeddedObject(source, 'skuDecisionPropVO'),
    core: embeddedObject(source, 'skuCore'),
    base: embeddedObject(source, 'skuBase')
  };
}

function nestedPrice(info, key) {
  const money = info?.[key]?.priceMoney;
  if (money !== undefined && money !== null && money !== '') {
    const parsedMoney = parseNumber(money);
    if (parsedMoney !== undefined) return parsedMoney / 100;
  }
  const text = info?.[key]?.priceText;
  return text === undefined ? undefined : parseNumber(text);
}

function variantPrice(info) {
  const sale = nestedPrice(info, 'subPrice');
  const regular = nestedPrice(info, 'price');
  return {
    priceCny: sale !== undefined && sale > 0 ? sale : regular,
    originalPriceCny: sale !== undefined && regular !== undefined && regular > sale ? regular : undefined
  };
}

function findVariantDetails() {
  const { decision, core, base } = marketplaceState();
  const skus = Array.isArray(decision?.skus) ? decision.skus : (Array.isArray(base?.skus) ? base.skus : []);
  const filters = new Map();
  const filterParams = decision?.filterParams || (base?.props || []).map((property) => ({
    code: property.pid,
    name: property.name,
    options: property.values || []
  }));
  filterParams.forEach((filter) => {
    filters.set(String(filter.code), {
      name: String(filter.name || filter.code),
      options: new Map((filter.options || []).map((option) => [String(option.code ?? option.vid), {
        name: String(option.name || option.code || option.vid),
        imageUrl: normalizeImageUrl(option.image || option.imageUrl)
      }]))
    });
  });
  const sku2info = core?.sku2info || {};
  return skus.map((sku, index) => {
    const skuId = String(sku.skuId || index);
    const attributes = {};
    const labels = [];
    let imageUrl = '';
    String(sku.propPath || '').split(/[|;]/).forEach((segment) => {
      const [propertyCode, valueCode] = segment.split(':');
      if (!propertyCode || !valueCode) return;
      const property = filters.get(String(propertyCode));
      const option = property?.options.get(String(valueCode));
      if (!option) return;
      attributes[property.name] = option.name;
      labels.push(`${property.name}: ${option.name}`);
      imageUrl ||= option.imageUrl;
    });
    const info = sku2info[skuId] || {};
    const prices = variantPrice(info);
    return {
      id: `sku-${skuId}`,
      skuId,
      label: labels.join(' · ') || `SKU ${skuId}`,
      labelOriginal: labels.join(' · ') || `SKU ${skuId}`,
      priceCny: prices.priceCny,
      originalPriceCny: prices.originalPriceCny,
      stock: Number.isFinite(Number(info.quantity)) ? Number(info.quantity) : undefined,
      skuAttributes: attributes,
      skuAttributesOriginal: { ...attributes },
      imageUrl
    };
  }).filter((variant) => variant.priceCny !== undefined || Object.keys(variant.skuAttributes).length > 0);
}

function findVariants() {
  const selector = [
    '[class*="sku"] button', '[class*="sku"] li', '[class*="Sku"] button', '[class*="Sku"] li',
    '[class*="prop"] button', '[class*="prop"] li', '[class*="spec"] button', '[class*="spec"] li',
    'button[aria-label]'
  ].join(',');
  return unique([...document.querySelectorAll(selector)].map(textOf).filter((text) => text.length > 0 && text.length < 80), 30);
}

function findPromotions() {
  const promotionWords = /[\u4f18\u60e0\u4fc3\u9500\u6ee1\u51cf\u6298\u6263\u5238\u7acb\u51cf\u5305\u90ae\u9650\u65f6\u6d3b\u52a8\u79d2\u6740\u8d60\u8fd4\u73b0\u7ea2\u5305]/;
  const candidates = [
    ...document.querySelectorAll('[class*="coupon"], [class*="promotion"], [class*="promo"], [class*="discount"], [class*="activity"], [class*="benefit"]'),
    ...document.querySelectorAll('body *')
  ];
  const texts = unique(candidates
    .filter((element) => element.children.length === 0 || /coupon|promotion|promo|discount|activity|benefit/i.test(String(element.className)))
    .map(textOf)
    .filter((text) => text.length >= 2 && text.length < 240 && promotionWords.test(text)), 30);
  return texts.map((text, index) => ({
    id: `promotion-${index}`,
    title: text,
    titleOriginal: text,
    description: 'Thông tin ưu đãi được đọc trực tiếp từ trang sản phẩm.',
    source: 'extension-dom'
  }));
}

function readProduct() {
  const title = textOf(document.querySelector('h1')) ||
    document.querySelector('meta[property="og:title"]')?.content || document.title || 'Untitled product';
  const variantDetails = findVariantDetails();
  const fallbackPrices = findPrices();
  const variants = variantDetails.length ? variantDetails : findVariants().map((label, index) => ({
    id: `variant-${index}`,
    label,
    labelOriginal: label,
    priceCny: fallbackPrices[index] ?? fallbackPrices[0],
    skuAttributes: {},
    skuAttributesOriginal: {}
  }));
  const pricesCny = variants.map((variant) => Number(variant.priceCny)).filter((price) => Number.isFinite(price));
  const images = findProductImages(variants);
  return {
    source: sourceLabel(),
    sourceProductId: productId(),
    url: location.href,
    title,
    titleOriginal: title,
    pricesCny: [...new Set(pricesCny)],
    variants,
    images,
    promotions: findPromotions(),
    capturedAt: new Date().toISOString()
  };
}

async function translatePage() {
  const nodes = [...document.querySelectorAll('body *')]
    .filter((element) => element.children.length === 0 && !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(element.tagName))
    .map((element) => ({ element, text: textOf(element) }))
    .filter(({ text }) => /[\u3400-\u9fff]/.test(text) && text.length > 0 && text.length <= 180);
  if (!nodes.length) return { ok: true, count: 0, message: 'No Chinese text found.' };

  const dictionaryNodes = nodes.filter(({ text }) => DICTIONARY[text]);
  dictionaryNodes.forEach(({ element, text }) => applyTranslation(element, DICTIONARY[text]));
  const remaining = nodes.filter(({ element }) => !element.dataset.ffTranslated);
  const uniqueTexts = [...new Set(remaining.map(({ text }) => text))];
  const translations = new Map();
  for (let index = 0; index < uniqueTexts.length; index += 80) {
    const batch = uniqueTexts.slice(index, index + 80);
    const response = await chrome.runtime.sendMessage({ type: 'TRANSLATE_TEXTS', texts: batch, targetLanguage: 'vi' });
    if (response?.error) throw new Error(response.error);
    response?.translations?.forEach((value, offset) => {
      translations.set(batch[offset], value);
    });
  }
  let translatedCount = 0;
  remaining.forEach(({ element, text }) => {
    const value = translations.get(text);
    if (value && value !== text) {
      applyTranslation(element, value);
      translatedCount += 1;
    }
  });
  return { ok: true, count: dictionaryNodes.length + translatedCount };
}

function applyTranslation(element, value) {
  if (!element.dataset.ffOriginal) element.dataset.ffOriginal = element.textContent;
  element.textContent = value;
  element.dataset.ffTranslated = 'true';
}

function restoreTranslation() {
  document.querySelectorAll('[data-ff-original]').forEach((element) => {
    element.textContent = element.dataset.ffOriginal;
    delete element.dataset.ffOriginal;
    delete element.dataset.ffTranslated;
  });
}

let pagePriceTimer = 0;
let pagePriceEnhancing = false;

function formatVndOnPage(value) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(value));
}

function pagePriceAmount(text) {
  const match = String(text || '').match(/(?:¥|￥|RMB|CNY|元)\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
  return match ? parseNumber(match[1]) : undefined;
}

function ensurePagePriceStyles() {
  if (document.getElementById('ff-vnd-price-style')) return;
  const style = document.createElement('style');
  style.id = 'ff-vnd-price-style';
  style.textContent = `
    #ff-vnd-overlay { position: fixed; top: 86px; right: 16px; z-index: 2147483647; width: min(330px, calc(100vw - 32px)); padding: 12px 14px; border: 1px solid rgba(240,185,103,.65); border-radius: 14px; background: rgba(15,18,23,.96); color: #f4f5f7; box-shadow: 0 14px 42px rgba(0,0,0,.28); font: 12px/1.45 Inter, system-ui, sans-serif; }
    #ff-vnd-overlay strong { display: block; margin-bottom: 4px; color: #f0b967; font-size: 12px; }
    #ff-vnd-overlay span { display: block; color: #b9c2ce; font-size: 11px; }
    .ff-vnd-inline { display: inline-block !important; margin-left: 7px !important; color: #b35c00 !important; font: 600 11px/1.3 Inter, system-ui, sans-serif !important; white-space: nowrap !important; }
  `;
  document.documentElement.appendChild(style);
}

function renderPagePriceOverlay(product, rate) {
  ensurePagePriceStyles();
  let overlay = document.getElementById('ff-vnd-overlay');
  if (!overlay) {
    overlay = document.createElement('aside');
    overlay.id = 'ff-vnd-overlay';
    document.body.appendChild(overlay);
  }
  const prices = (product?.variants || []).map((variant) => Number(variant.priceCny)).filter((price) => Number.isFinite(price) && price > 0);
  const fallback = findPrices();
  const visiblePrices = prices.length ? prices : fallback;
  const lowest = visiblePrices.length ? Math.min(...visiblePrices) : undefined;
  overlay.innerHTML = `<strong>FormaForge · Giá Việt Nam</strong><span>1 CNY ≈ ${formatVndOnPage(rate)} ₫</span><span>${lowest !== undefined ? `Giá thấp nhất: ¥${lowest.toLocaleString('vi-VN')} ≈ ${formatVndOnPage(lowest * rate)} ₫` : 'Chưa đọc được giá CNY trên trang'}</span><span>Giá được cập nhật tự động theo tỷ giá tham chiếu.</span>`;
}

function renderInlinePagePrices(rate) {
  document.querySelectorAll('.ff-vnd-inline').forEach((element) => element.remove());
  const candidates = [...document.querySelectorAll('body *')]
    .filter((element) => element.children.length === 0 && !element.closest('#ff-vnd-overlay') && !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(element.tagName))
    .map((element) => ({ element, amount: pagePriceAmount(element.textContent) }))
    .filter(({ amount }) => Number.isFinite(amount) && amount >= 0)
    .slice(0, 12);
  candidates.forEach(({ element, amount }) => {
    const inline = document.createElement('span');
    inline.className = 'ff-vnd-inline';
    inline.textContent = `≈ ${formatVndOnPage(amount * rate)} ₫`;
    element.appendChild(inline);
  });
}

async function enhancePageWithVnd() {
  if (pagePriceEnhancing || !document.body) return;
  pagePriceEnhancing = true;
  try {
    const exchange = await chrome.runtime.sendMessage({ type: 'GET_EXCHANGE_RATE' });
    const rate = Number(exchange?.rate) || 3500;
    const product = readProduct();
    renderPagePriceOverlay(product, rate);
    renderInlinePagePrices(rate);
  } catch {
    // The page remains usable when the optional enhancement cannot load.
  } finally {
    pagePriceEnhancing = false;
  }
}

function schedulePagePriceEnhancement() {
  window.clearTimeout(pagePriceTimer);
  pagePriceTimer = window.setTimeout(() => { void enhancePageWithVnd(); }, 900);
}

if (document.body) {
  const pageObserver = new MutationObserver((records) => {
    const ownMutation = records.length && records.every((record) => {
      const nodes = [...record.addedNodes, ...record.removedNodes];
      return (record.target.closest?.('#ff-vnd-overlay') || record.target.closest?.('.ff-vnd-inline')) ||
        nodes.length > 0 && nodes.every((node) => node.nodeType !== Node.ELEMENT_NODE || node.id === 'ff-vnd-overlay' || node.classList.contains('ff-vnd-inline'));
    });
    if (ownMutation) return;
    schedulePagePriceEnhancement();
  });
  pageObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  schedulePagePriceEnhancement();
}
