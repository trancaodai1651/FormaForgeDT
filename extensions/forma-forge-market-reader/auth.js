const EMBEDDED_SUPABASE_CONFIG = globalThis.FORMAFORGE_MARKET_CONFIG || {};
const DEFAULT_SUPABASE_URL = 'https://caghwzzhuqfnybcfqxph.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = String(EMBEDDED_SUPABASE_CONFIG.anonKey || '');
const DEFAULT_EXCHANGE_RATE_VND = 3500;
const SESSION_KEY = 'supabaseSession';
const CONFIG_KEY = 'supabaseConfig';

async function getSupabaseConfig() {
  const { supabaseConfig } = await chrome.storage.local.get({ supabaseConfig: {} });
  return {
    supabaseUrl: String(EMBEDDED_SUPABASE_CONFIG.supabaseUrl || supabaseConfig.supabaseUrl || DEFAULT_SUPABASE_URL).replace(/\/$/, ''),
    anonKey: String(DEFAULT_SUPABASE_ANON_KEY || supabaseConfig.anonKey || '')
  };
}

async function saveSupabaseConfig(config) {
  const supabaseUrl = String(config.supabaseUrl || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const anonKey = String(config.anonKey || '').trim();
  await chrome.storage.local.set({ [CONFIG_KEY]: { supabaseUrl, anonKey } });
  return { supabaseUrl, anonKey };
}

async function requireConfig() {
  const config = await getSupabaseConfig();
  if (!config.anonKey) throw new Error('Hãy nhập Supabase anon key trong Cài đặt dịch trước khi đăng nhập.');
  return config;
}

async function supabaseAuthRequest(path, body) {
  const config = await requireConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || payload.msg || payload.message || 'Supabase Auth request failed.');
  return payload;
}

async function setSupabaseSession(payload) {
  if (!payload?.access_token) return null;
  const session = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || '',
    expires_at: Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
    user: payload.user || null
  };
  await chrome.storage.local.set({ [SESSION_KEY]: session });
  return session;
}

async function getSupabaseSession() {
  const { supabaseSession } = await chrome.storage.local.get({ supabaseSession: null });
  if (!supabaseSession?.access_token) return null;
  if (supabaseSession.expires_at && supabaseSession.expires_at < Math.floor(Date.now() / 1000) + 60 && supabaseSession.refresh_token) {
    try { return await refreshSupabaseSession(supabaseSession.refresh_token); } catch { await signOutSupabase(); return null; }
  }
  return supabaseSession;
}

async function signInSupabase(email, password) {
  return setSupabaseSession(await supabaseAuthRequest('token?grant_type=password', { email, password }));
}

async function signUpSupabase(email, password, displayName) {
  return setSupabaseSession(await supabaseAuthRequest('signup', { email, password, data: { display_name: displayName } }));
}

async function refreshSupabaseSession(refreshToken) {
  return setSupabaseSession(await supabaseAuthRequest('token?grant_type=refresh_token', { refresh_token: refreshToken }));
}

async function signOutSupabase() {
  await chrome.storage.local.remove(SESSION_KEY);
}

async function supabaseRestRequest(path, options = {}) {
  const config = await requireConfig();
  const session = await getSupabaseSession();
  if (!session) throw new Error('Hãy đăng nhập Supabase trước.');
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || payload?.hint || payload?.details || 'Supabase database request failed.');
  return payload;
}

function sourceCode(value) {
  const source = String(value || '').toLowerCase();
  if (source.includes('taobao')) return 'taobao';
  if (source.includes('tmall')) return 'tmall';
  if (source.includes('1688')) return '1688';
  if (source.includes('pinduoduo')) return 'pinduoduo';
  if (source.includes('jd')) return 'jd';
  if (source.includes('xiaohongshu')) return 'xiaohongshu';
  return 'unknown';
}

function normalizedProduct(product) {
  const source = sourceCode(product.source);
  const prices = Array.isArray(product.pricesCny) ? product.pricesCny.filter((price) => Number.isFinite(Number(price))).map(Number) : [];
  const rawVariants = Array.isArray(product.variants) ? product.variants : [];
  const variantSource = rawVariants.length ? rawVariants : prices.map((price, index) => ({ label: `Phân loại ${index + 1}`, priceCny: price }));
  const variants = variantSource.map((item, index) => {
    const value = item && typeof item === 'object' ? item : { label: item };
    return {
      id: String(value.id || crypto.randomUUID()),
      skuId: value.skuId ? String(value.skuId) : undefined,
      label: String(value.label || value.name || `Phân loại ${index + 1}`),
      labelOriginal: String(value.labelOriginal || value.label || value.name || `Phân loại ${index + 1}`),
      priceCny: Number(value.priceCny ?? prices[index] ?? prices[0] ?? 0),
      originalPriceCny: Number.isFinite(Number(value.originalPriceCny)) ? Number(value.originalPriceCny) : undefined,
      stock: Number.isFinite(Number(value.stock)) ? Number(value.stock) : undefined,
      skuAttributes: value.skuAttributes && typeof value.skuAttributes === 'object' ? value.skuAttributes : {},
      skuAttributesOriginal: value.skuAttributesOriginal && typeof value.skuAttributesOriginal === 'object' ? value.skuAttributesOriginal : (value.skuAttributes || {})
    };
  });
  const promotions = (Array.isArray(product.promotions) ? product.promotions : []).map((item, index) => {
    const value = item && typeof item === 'object' ? item : { title: item };
    return {
      id: String(value.id || crypto.randomUUID()),
      title: String(value.title || value.name || `Khuyến mãi ${index + 1}`),
      titleOriginal: String(value.titleOriginal || value.title || value.name || `Khuyến mãi ${index + 1}`),
      description: String(value.description || 'Thông tin ưu đãi được đọc trực tiếp từ trang sản phẩm.'),
      discountCny: Number.isFinite(Number(value.discountCny)) ? Number(value.discountCny) : undefined,
      finalPriceCny: Number.isFinite(Number(value.finalPriceCny)) ? Number(value.finalPriceCny) : undefined,
      source: String(value.source || 'extension-dom')
    };
  });
  return {
    id: crypto.randomUUID(),
    source,
    source_label: product.source || source,
    source_product_id: product.sourceProductId || '',
    url: product.url,
    normalized_url: product.url,
    title: product.title || 'Untitled product',
    image_url: null,
    shop_name: null,
    provider: 'extension-dom',
    exchange_rate_vnd: Number(product.exchangeRateVnd) || DEFAULT_EXCHANGE_RATE_VND,
    variants,
    promotions,
    last_checked_at: product.capturedAt || new Date().toISOString(),
    updated_at: product.capturedAt || new Date().toISOString()
  };
}

function productForPopup(row) {
  const variants = Array.isArray(row.variants) ? row.variants : [];
  const variantRows = variants.map((variant, index) => {
    const value = variant && typeof variant === 'object' ? variant : { label: variant };
    return {
      id: String(value.id || `variant-${index}`),
      skuId: value.skuId ? String(value.skuId) : undefined,
      label: String(value.label || value.name || `Phân loại ${index + 1}`),
      labelOriginal: String(value.labelOriginal || value.label || value.name || `Phân loại ${index + 1}`),
      priceCny: Number(value.priceCny),
      originalPriceCny: Number.isFinite(Number(value.originalPriceCny)) ? Number(value.originalPriceCny) : undefined,
      stock: Number.isFinite(Number(value.stock)) ? Number(value.stock) : undefined,
      skuAttributes: value.skuAttributes && typeof value.skuAttributes === 'object' ? value.skuAttributes : {},
      skuAttributesOriginal: value.skuAttributesOriginal && typeof value.skuAttributesOriginal === 'object' ? value.skuAttributesOriginal : (value.skuAttributes || {})
    };
  });
  const promotionRows = Array.isArray(row.promotions) ? row.promotions.map((promotion, index) => {
    const value = promotion && typeof promotion === 'object' ? promotion : { title: promotion };
    return {
      id: String(value.id || `promotion-${index}`),
      title: String(value.title || value.name || `Khuyến mãi ${index + 1}`),
      titleOriginal: String(value.titleOriginal || value.title || value.name || `Khuyến mãi ${index + 1}`),
      description: String(value.description || 'Thông tin ưu đãi được đọc trực tiếp từ trang sản phẩm.'),
      discountCny: Number.isFinite(Number(value.discountCny)) ? Number(value.discountCny) : undefined,
      finalPriceCny: Number.isFinite(Number(value.finalPriceCny)) ? Number(value.finalPriceCny) : undefined,
      source: String(value.source || 'extension-dom')
    };
  }) : [];
  return {
    id: row.id,
    source: row.source_label || row.source,
    sourceProductId: row.source_product_id || '',
    url: row.url,
    title: row.title,
    titleOriginal: row.title_original || row.title,
    pricesCny: variantRows.map((variant) => variant.priceCny).filter((price) => Number.isFinite(price) && price > 0),
    variants: variantRows,
    promotions: promotionRows,
    exchangeRateVnd: Number(row.exchange_rate_vnd) || DEFAULT_EXCHANGE_RATE_VND,
    capturedAt: row.updated_at
  };
}

async function listSupabaseProducts() {
  const rows = await supabaseRestRequest('/rest/v1/price_reader_products?select=*&order=updated_at.desc');
  return Array.isArray(rows) ? rows.map(productForPopup) : [];
}

async function saveSupabaseProduct(product) {
  const row = normalizedProduct(product);
  const existing = await supabaseRestRequest(`/rest/v1/price_reader_products?select=id&normalized_url=eq.${encodeURIComponent(row.normalized_url)}`);
  const existingId = Array.isArray(existing) ? existing[0]?.id : null;
  let saved;
  if (existingId) {
    const { id, ...updates } = row;
    saved = await supabaseRestRequest(`/rest/v1/price_reader_products?id=eq.${encodeURIComponent(existingId)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(updates) });
  } else {
    saved = await supabaseRestRequest('/rest/v1/price_reader_products', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
  }
  const savedRow = Array.isArray(saved) ? saved[0] : saved;
  if (savedRow?.id) await supabaseRestRequest('/rest/v1/price_reader_snapshots', { method: 'POST', body: JSON.stringify({ product_id: savedRow.id, payload: product, captured_at: product.capturedAt || new Date().toISOString() }) });
  return productForPopup(savedRow || row);
}

async function deleteSupabaseProduct(id) {
  await supabaseRestRequest(`/rest/v1/price_reader_products?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
}
