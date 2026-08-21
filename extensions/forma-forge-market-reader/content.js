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
  const currencyPattern = /(?:¥|￥|RMB|CNY|元)\s*([0-9]+(?:[.,][0-9]{1,2})?)/gi;
  for (const match of text.matchAll(currencyPattern)) {
    const amount = Number(match[1].replace(',', '.'));
    if (Number.isFinite(amount) && amount >= 0) results.push(amount);
  }
  return [...new Set(results)].slice(0, 20);
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
  const promotionWords = /(优惠|促销|满减|折扣|券|立减|包邮|限时|活动|秒杀|赠)/;
  return unique([...document.querySelectorAll('body *')]
    .filter((element) => element.children.length === 0)
    .map(textOf)
    .filter((text) => text.length >= 2 && text.length < 160 && promotionWords.test(text)), 20);
}

function readProduct() {
  const title = textOf(document.querySelector('h1')) ||
    document.querySelector('meta[property="og:title"]')?.content || document.title || 'Untitled product';
  return {
    source: sourceLabel(),
    sourceProductId: productId(),
    url: location.href,
    title,
    pricesCny: findPrices(),
    variants: findVariants(),
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
  const translated = [];
  for (let index = 0; index < remaining.length; index += 40) {
    const batch = remaining.slice(index, index + 40);
    const response = await chrome.runtime.sendMessage({ type: 'TRANSLATE_TEXTS', texts: batch.map(({ text }) => text), targetLanguage: 'vi' });
    if (response?.error) throw new Error(response.error);
    response?.translations?.forEach((value, offset) => {
      if (value && value !== batch[offset].text) {
        applyTranslation(batch[offset].element, value);
        translated.push(value);
      }
    });
  }
  return { ok: true, count: dictionaryNodes.length + translated.length };
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
