const input = document.getElementById('translationUrl');
const saved = document.getElementById('saved');

chrome.storage.local.get({ translationUrl: '' }).then((settings) => {
  input.value = settings.translationUrl;
});

document.getElementById('settings').addEventListener('submit', async (event) => {
  event.preventDefault();
  await chrome.storage.local.set({ translationUrl: input.value.trim() });
  saved.textContent = 'Đã lưu cài đặt.';
});
