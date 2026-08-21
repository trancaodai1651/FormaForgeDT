const DEFAULT_TRANSLATION_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const TRANSLATION_CACHE_KEY = 'translationCache';
const TRANSLATION_CACHE_LIMIT = 600;
const DEFAULT_TRANSLATION_CONCURRENCY = 6;
let translationCache = new Map();
let translationCacheReady = false;

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'TRANSLATE_TEXTS') return undefined;

  translateTexts(Array.isArray(message.texts) ? message.texts : [], message.targetLanguage || 'vi')
    .then((translations) => sendResponse({ translations }))
    .catch((error) => sendResponse({ error: error instanceof Error ? error.message : 'Translation failed' }));
  return true;
});

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
