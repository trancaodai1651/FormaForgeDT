const DEFAULT_TRANSLATION_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const TRANSLATION_CACHE_KEY = 'translationCache';
const TRANSLATION_CACHE_LIMIT = 600;
const DEFAULT_TRANSLATION_CONCURRENCY = 6;
const EXCHANGE_RATE_ENDPOINT = 'https://api.frankfurter.dev/v2/rate/CNY/VND';
const EXCHANGE_RATE_STORAGE_KEY = 'exchangeRateVnd';
const DEFAULT_EXCHANGE_RATE_VND = 3500;
const EXCHANGE_RATE_TTL_MS = 60 * 60 * 1000;
let translationCache = new Map();
let translationCacheReady = false;

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_EXCHANGE_RATE') {
    getLatestExchangeRate(Boolean(message.force))
      .then((rate) => sendResponse(rate))
      .catch((error) => sendResponse({ rate: DEFAULT_EXCHANGE_RATE_VND, stale: true, error: error instanceof Error ? error.message : 'Exchange rate unavailable' }));
    return true;
  }
  if (message?.type === 'FETCH_IMAGE_ASSETS') {
    fetchImageAssets(Array.isArray(message.images) ? message.images : [])
      .then((assets) => sendResponse({ assets }))
      .catch((error) => sendResponse({ error: error instanceof Error ? error.message : 'Image download failed' }));
    return true;
  }
  if (message?.type !== 'TRANSLATE_TEXTS') return undefined;

  translateTexts(Array.isArray(message.texts) ? message.texts : [], message.targetLanguage || 'vi')
    .then((translations) => sendResponse({ translations }))
    .catch((error) => sendResponse({ error: error instanceof Error ? error.message : 'Translation failed' }));
  return true;
});

async function fetchImageAssets(images) {
  const uniqueImages = [...new Map(images
    .map((item, index) => {
      const value = item && typeof item === 'object' ? item : { url: item };
      const url = String(value.url || '').trim();
      return [url, { ...value, url, index }];
    })
    .filter(([url]) => /^https?:\/\//i.test(url))
    .slice(0, 80)
    .map(([url, value]) => [url, value])).values()];

  return mapWithConcurrency(uniqueImages, 4, async (item) => {
    try {
      const response = await fetch(item.url, { cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new Error(`Image service returned ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const mime = response.headers.get('content-type') || mimeFromUrl(item.url);
      return { ...item, mime, dataUrl: `data:${mime};base64,${bytesToBase64(bytes)}` };
    } catch (error) {
      return { ...item, error: error instanceof Error ? error.message : 'Image unavailable' };
    }
  });
}

function mimeFromUrl(url) {
  const extension = String(url).split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  return extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function getLatestExchangeRate(force = false) {
  const storedResult = await chrome.storage.local.get({ [EXCHANGE_RATE_STORAGE_KEY]: null });
  const stored = storedResult[EXCHANGE_RATE_STORAGE_KEY];
  const now = Date.now();
  if (!force && stored?.rate && now - Number(stored.updatedAt || 0) < EXCHANGE_RATE_TTL_MS) return stored;

  try {
    const response = await fetch(EXCHANGE_RATE_ENDPOINT, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    const rate = Number(body?.rate);
    if (!response.ok || !Number.isFinite(rate) || rate <= 0) throw new Error(`Exchange rate service returned ${response.status}`);
    const current = {
      rate,
      updatedAt: now,
      date: body.date || new Date(now).toISOString().slice(0, 10),
      source: 'Frankfurter'
    };
    await chrome.storage.local.set({ [EXCHANGE_RATE_STORAGE_KEY]: current });
    return current;
  } catch (error) {
    if (stored?.rate) return { ...stored, stale: true, error: error instanceof Error ? error.message : 'Exchange rate unavailable' };
    return { rate: DEFAULT_EXCHANGE_RATE_VND, updatedAt: 0, date: null, source: 'Dự phòng', stale: true, error: error instanceof Error ? error.message : 'Exchange rate unavailable' };
  }
}

async function translateTexts(texts, targetLanguage) {
  const normalized = [...new Set(texts.map((text) => String(text || '').trim()).filter(Boolean))];
  if (!normalized.length) return [];
  const settings = await chrome.storage.local.get({ translationUrl: DEFAULT_TRANSLATION_ENDPOINT });
  await ensureTranslationCache();

  const keys = normalized.map((text) => cacheKey(text, targetLanguage));
  const translations = new Map();
  const missing = [];
  normalized.forEach((text, index) => {
    const cached = translationCache.get(keys[index]);
    if (cached) translations.set(text, cached);
    else missing.push(text);
  });

  if (missing.length) {
    const fresh = settings.translationUrl && settings.translationUrl !== DEFAULT_TRANSLATION_ENDPOINT
      ? await translateWithCustomEndpoint(missing, targetLanguage, settings.translationUrl)
      : await mapWithConcurrency(missing, DEFAULT_TRANSLATION_CONCURRENCY, (text) => translateWithGoogle(text, targetLanguage));
    missing.forEach((text, index) => {
      const translated = String(fresh[index] || text);
      translations.set(text, translated);
      translationCache.set(cacheKey(text, targetLanguage), translated);
    });
    await persistTranslationCache();
  }

  return normalized.map((text) => translations.get(text) || text);
}

async function ensureTranslationCache() {
  if (translationCacheReady) return;
  const stored = await chrome.storage.local.get({ [TRANSLATION_CACHE_KEY]: {} });
  translationCache = new Map(Object.entries(stored[TRANSLATION_CACHE_KEY] || {}));
  translationCacheReady = true;
}

function cacheKey(text, targetLanguage) {
  return `${targetLanguage}:${text}`;
}

async function persistTranslationCache() {
  const entries = [...translationCache.entries()].slice(-TRANSLATION_CACHE_LIMIT);
  translationCache = new Map(entries);
  await chrome.storage.local.set({ [TRANSLATION_CACHE_KEY]: Object.fromEntries(entries) });
}

async function translateWithCustomEndpoint(texts, targetLanguage, endpoint) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, targetLanguage })
  });
  if (!response.ok) throw new Error(`Translation service returned ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body.translations)) throw new Error('Translation service must return { translations: string[] }');
  return body.translations.map((text) => String(text ?? ''));
}

async function translateWithGoogle(text, targetLanguage) {
  const query = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: targetLanguage, dt: 't', q: text });
  const response = await fetch(`${DEFAULT_TRANSLATION_ENDPOINT}?${query.toString()}`);
  if (!response.ok) throw new Error(`Translation service returned ${response.status}`);
  const body = await response.json();
  return Array.isArray(body?.[0]) ? body[0].map((part) => part?.[0] || '').join('') : text;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
