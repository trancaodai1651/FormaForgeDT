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
    core: embeddedObject(source, 'skuCore')
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
  const { decision, core } = marketplaceState();
  const skus = Array.isArray(decision?.skus) ? decision.skus : [];
  const filters = new Map();
  (decision?.filterParams || []).forEach((filter) => {
    filters.set(String(filter.code), {
      name: String(filter.name || filter.code),
      options: new Map((filter.options || []).map((option) => [String(option.code), String(option.name || option.code)]))
    });
  });
  const sku2info = core?.sku2info || {};
  return skus.map((sku, index) => {
    const skuId = String(sku.skuId || index);
    const attributes = {};
    const labels = [];
    String(sku.propPath || '').split('|').forEach((segment) => {
      const [propertyCode, valueCode] = segment.split(':');
      if (!propertyCode || !valueCode) return;
      const property = filters.get(String(propertyCode));
      const value = property?.options.get(String(valueCode));
      if (!value) return;
      attributes[property.name] = value;
      labels.push(`${property.name}: ${value}`);
    });
    const info = sku2info[skuId] || {};
    const prices = variantPrice(info);
    return {
      id: `sku-${skuId}`,
      skuId,
      label: labels.join(' · ') || `SKU ${skuId}`,
      priceCny: prices.priceCny,
      originalPriceCny: prices.originalPriceCny,
      stock: Number.isFinite(Number(info.quantity)) ? Number(info.quantity) : undefined,
      skuAttributes: attributes
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
    priceCny: fallbackPrices[index] ?? fallbackPrices[0],
    skuAttributes: {}
  }));
  const pricesCny = variants.map((variant) => Number(variant.priceCny)).filter((price) => Number.isFinite(price));
  return {
    source: sourceLabel(),
    sourceProductId: productId(),
    url: location.href,
    title,
    pricesCny: [...new Set(pricesCny)],
    variants,
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
