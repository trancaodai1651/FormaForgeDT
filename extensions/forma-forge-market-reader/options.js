const input = document.getElementById('translationUrl');
const supabaseUrl = document.getElementById('supabaseUrl');
const anonKey = document.getElementById('anonKey');
const saved = document.getElementById('saved');

Promise.all([chrome.storage.local.get({ translationUrl: '' }), getSupabaseConfig()]).then(([translation, config]) => { input.value = translation.translationUrl; supabaseUrl.value = config.supabaseUrl; anonKey.value = config.anonKey; });

document.getElementById('settings').addEventListener('submit', async (event) => {
  event.preventDefault();
  const translationUrl = input.value.trim();
  await chrome.storage.local.set({ translationUrl });
  await saveSupabaseConfig({ supabaseUrl: supabaseUrl.value.trim(), anonKey: anonKey.value.trim() });
  saved.textContent = 'Đã lưu cài đặt.';
});
