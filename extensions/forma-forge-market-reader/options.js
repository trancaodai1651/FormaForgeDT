const input = document.getElementById('translationUrl');
const saved = document.getElementById('saved');

chrome.storage.local.get({ translationUrl: '' }).then(({ translationUrl }) => { input.value = translationUrl; });

document.getElementById('settings').addEventListener('submit', async (event) => {
  event.preventDefault();
  const translationUrl = input.value.trim();
  await chrome.storage.local.set({ translationUrl });
  saved.textContent = 'Đã lưu cài đặt.';
});
