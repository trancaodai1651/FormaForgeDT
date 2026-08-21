const PRICE_READER_URL = 'https://trancaodai1651.github.io/FormaForgeDT/#/price-reader';
let lastProduct = null;
let savedProducts = [];
let session = null;
let exchangeRateState = { rate: DEFAULT_EXCHANGE_RATE_VND, updatedAt: 0, date: null, source: 'Dự phòng', stale: true };

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
      priceCny: Number(value.priceCny),
      originalPriceCny: Number.isFinite(Number(value.originalPriceCny)) ? Number(value.originalPriceCny) : undefined,
      stock: Number.isFinite(Number(value.stock)) ? Number(value.stock) : undefined,
      skuAttributes: value.skuAttributes && typeof value.skuAttributes === 'object' ? value.skuAttributes : {}
    };
  });
  return (Array.isArray(product?.pricesCny) ? product.pricesCny : []).map((price, index) => ({
    id: `price-${index}`,
    label: `Phân loại ${index + 1}`,
    priceCny: Number(price),
    skuAttributes: {}
  }));
}

function promotionRows(product) {
  return (Array.isArray(product?.promotions) ? product.promotions : []).map((item, index) => {
    const value = item && typeof item === 'object' ? item : { title: item };
    return {
      id: String(value.id || `promotion-${index}`),
      title: String(value.title || value.name || `Khuyến mãi ${index + 1}`),
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
    skuAttributes: Object.fromEntries(Object.entries(row.skuAttributes || {}).map(([key, value]) => [key, translationMap.get(String(value)) || value]))
  }));
  return {
    ...product,
    title: translationMap.get(product.title) || product.title,
    variants: translatedVariants,
    promotions: promotions.map((promotion) => ({ ...promotion, title: translationMap.get(promotion.title) || promotion.title }))
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
  const variantMarkup = rows.length
    ? rows.map((variant) => {
      const attributes = Object.entries(variant.skuAttributes || {}).map(([key, value]) => `${key}: ${value}`).join(' · ');
      const original = variant.originalPriceCny && variant.originalPriceCny > variant.priceCny
        ? `<span class="original-price">${escapeHtml(priceLabel(variant.originalPriceCny, rate))}</span>`
        : '';
      const stock = Number.isFinite(variant.stock) ? `<small>Tồn kho: ${escapeHtml(variant.stock)}</small>` : '';
      return `<article class="variant-row"><div><strong>${escapeHtml(variant.label)}</strong>${attributes ? `<small>${escapeHtml(attributes)}</small>` : ''}${stock}</div><span>${Number.isFinite(variant.priceCny) ? escapeHtml(priceLabel(variant.priceCny, rate)) : 'Chưa có giá'}${original}</span></article>`;
    }).join('')
    : '<p>Chưa đọc được danh sách phân loại.</p>';
  const promotionMarkup = promotions.length
    ? promotions.map((promotion) => `<article class="promotion-item"><strong>${escapeHtml(promotion.title)}</strong><small>${escapeHtml(promotion.description)}</small>${promotion.discountCny ? `<span>Giảm ${escapeHtml(priceLabel(promotion.discountCny, rate))}</span>` : ''}${promotion.finalPriceCny ? `<span>Giá sau ưu đãi: ${escapeHtml(priceLabel(promotion.finalPriceCny, rate))}</span>` : ''}</article>`).join('')
    : '<p>Chưa phát hiện thông tin khuyến mãi chi tiết.</p>';
  $('result').innerHTML = `<h2>${escapeHtml(product.title)}</h2><p>${escapeHtml(product.source)} · ID: ${escapeHtml(product.sourceProductId || '—')}</p><p>Giá thấp nhất trong ${rows.length || rates.length || 0} phân loại:</p><strong class="price-lines">${rates.length ? escapeHtml(priceLabel(Math.min(...rates), rate)) : 'Chưa thấy giá CNY'}</strong><p class="exchange-rate">${escapeHtml(exchangeRateLabel(product))}</p><section class="result-section"><div class="result-section-title">Tất cả phân loại <span>${rows.length}</span></div><div class="variant-list">${variantMarkup}</div></section><section class="result-section"><div class="result-section-title">Chi tiết khuyến mãi <span>${promotions.length}</span></div><div class="promotion-list">${promotionMarkup}</div></section>`;
}

function renderSavedProducts() {
  $('saved-count').textContent = String(savedProducts.length);
  $('saved-empty').classList.toggle('hidden', savedProducts.length > 0);
  $('saved-list').innerHTML = savedProducts.map((product) => `<article class="saved-item"><button class="saved-open" data-open="${escapeHtml(product.url)}"><strong>${escapeHtml(product.title)}</strong><small>${escapeHtml(product.source)} · ${product.pricesCny?.[0] ? escapeHtml(priceLabel(product.pricesCny[0], product.exchangeRateVnd)) : 'Chưa có giá'}</small></button><button class="saved-delete" data-delete="${escapeHtml(product.url)}" aria-label="Xóa sản phẩm">×</button></article>`).join('');
  if (lastProduct) render(lastProduct);
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
    const product = await sendToPage({ type: 'READ_PRODUCT' });
    await refreshExchangeRate(true);
    applyExchangeRate(product);
    render(product);
    status('Đã đọc dữ liệu đang hiển thị trên trang.');
    await chrome.storage.local.set({ lastProduct: product });
    void translateProductDetails(product).then(async (translatedProduct) => {
      if (translatedProduct === product || lastProduct?.url !== product.url) return;
      applyExchangeRate(translatedProduct);
      lastProduct = translatedProduct;
      render(translatedProduct);
      await chrome.storage.local.set({ lastProduct: translatedProduct });
    }).catch(() => {});
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
});
