const DEFAULT_TRANSLATION_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'TRANSLATE_TEXTS') return undefined;

  translateTexts(Array.isArray(message.texts) ? message.texts : [], message.targetLanguage || 'vi')
    .then((translations) => sendResponse({ translations }))
    .catch((error) => sendResponse({ error: error instanceof Error ? error.message : 'Translation failed' }));
  return true;
});

async function translateTexts(texts, targetLanguage) {
  const normalized = texts.map((text) => String(text || '').trim());
  if (!normalized.length) return [];
  const settings = await chrome.storage.local.get({ translationUrl: DEFAULT_TRANSLATION_ENDPOINT });
  if (settings.translationUrl && settings.translationUrl !== DEFAULT_TRANSLATION_ENDPOINT) {
    const response = await fetch(settings.translationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: normalized, targetLanguage })
    });
    if (!response.ok) throw new Error(`Translation service returned ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body.translations)) throw new Error('Translation service must return { translations: string[] }');
    return body.translations.map((text) => String(text ?? ''));
  }

  const translations = [];
  for (const text of normalized) {
    const query = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: targetLanguage, dt: 't', q: text });
    const response = await fetch(`${DEFAULT_TRANSLATION_ENDPOINT}?${query.toString()}`);
    if (!response.ok) throw new Error(`Translation service returned ${response.status}`);
    const body = await response.json();
    translations.push(Array.isArray(body?.[0]) ? body[0].map((part) => part?.[0] || '').join('') : text);
  }
  return translations;
}
