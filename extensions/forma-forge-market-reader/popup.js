const PRICE_READER_URL = 'https://trancaodai1651.github.io/FormaForgeDT/#/price-reader';
let lastProduct = null;

const $ = (id) => document.getElementById(id);
const status = (text, error = false) => { $('status').textContent = text; $('status').style.color = error ? '#ff9489' : ''; };

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('Không tìm thấy tab đang mở.');
  return tab;
}

async function sendToPage(message) {
  const tab = await activeTab();
  try { return await chrome.tabs.sendMessage(tab.id, message); }
  catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    return await chrome.tabs.sendMessage(tab.id, message);
  }
}

function render(product) {
  lastProduct = product;
  $('copy').disabled = false;
  $('download').disabled = false;
  $('result').classList.remove('hidden');
  $('result').innerHTML = `<h2>${escapeHtml(product.title)}</h2><p>${escapeHtml(product.source)} · ID: ${escapeHtml(product.sourceProductId || '—')}</p><p>Giá đọc được: <strong>${product.pricesCny?.length ? product.pricesCny.map((price) => `¥${price}`).join(' · ') : 'Chưa thấy giá CNY'}</strong></p><p>Khuyến mãi: ${product.promotions?.length || 0}</p><div class="chips">${(product.variants || []).slice(0, 12).map((variant) => `<span class="chip">${escapeHtml(variant)}</span>`).join('')}</div>`;
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character])); }
function jsonText() { return JSON.stringify(lastProduct, null, 2); }

$('read').addEventListener('click', async () => {
  try { const product = await sendToPage({ type: 'READ_PRODUCT' }); render(product); status('Đã đọc dữ liệu đang hiển thị trên trang.'); await chrome.storage.local.set({ lastProduct: product }); }
  catch (error) { status(error.message || 'Không đọc được trang này. Hãy tải lại trang sản phẩm.', true); }
});
$('translate').addEventListener('click', async () => {
  try { const result = await sendToPage({ type: 'TRANSLATE_PAGE' }); status(result?.count ? `Đã dịch ${result.count} cụm chữ.` : (result?.message || 'Không tìm thấy chữ Trung Quốc.')); }
  catch (error) { status(error.message || 'Dịch trang thất bại.', true); }
});
$('restore').addEventListener('click', async () => { try { await sendToPage({ type: 'RESTORE_TRANSLATION' }); status('Đã khôi phục chữ gốc.'); } catch (error) { status(error.message || 'Không thể khôi phục.', true); } });
$('copy').addEventListener('click', async () => { await navigator.clipboard.writeText(jsonText()); status('Đã copy JSON vào clipboard.'); });
$('download').addEventListener('click', () => { const blob = new Blob([jsonText()], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'formaforge-market-reading.json'; anchor.click(); URL.revokeObjectURL(url); });
$('price-reader').addEventListener('click', () => chrome.tabs.create({ url: PRICE_READER_URL }));
$('options').addEventListener('click', (event) => { event.preventDefault(); chrome.runtime.openOptionsPage(); });

chrome.storage.local.get('lastProduct').then(({ lastProduct: product }) => { if (product) render(product); });
