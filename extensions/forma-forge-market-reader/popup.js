const PRICE_READER_URL = 'https://trancaodai1651.github.io/FormaForgeDT/#/price-reader';
let lastProduct = null;
let savedProducts = [];
let session = null;

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
  $('save').disabled = false;
  $('save').disabled = !session;
  $('save').textContent = savedProducts.some((item) => item.url === product.url) ? 'Đã lưu sản phẩm' : 'Lưu sản phẩm';
  $('result').classList.remove('hidden');
  $('result').innerHTML = `<h2>${escapeHtml(product.title)}</h2><p>${escapeHtml(product.source)} · ID: ${escapeHtml(product.sourceProductId || '—')}</p><p>Giá đọc được: <strong>${product.pricesCny?.length ? product.pricesCny.map((price) => `¥${price}`).join(' · ') : 'Chưa thấy giá CNY'}</strong></p><p>Khuyến mãi: ${product.promotions?.length || 0}</p><div class="chips">${(product.variants || []).slice(0, 12).map((variant) => `<span class="chip">${escapeHtml(variant)}</span>`).join('')}</div>`;
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character])); }
function jsonText() { return JSON.stringify(lastProduct, null, 2); }

function renderSavedProducts() {
  $('saved-count').textContent = String(savedProducts.length);
  $('saved-empty').classList.toggle('hidden', savedProducts.length > 0);
  $('saved-list').innerHTML = savedProducts.map((product) => `<article class="saved-item"><button class="saved-open" data-open="${escapeHtml(product.url)}"><strong>${escapeHtml(product.title)}</strong><small>${escapeHtml(product.source)} · ${product.pricesCny?.[0] ? `¥${product.pricesCny[0]}` : 'Chưa có giá'}</small></button><button class="saved-delete" data-delete="${escapeHtml(product.url)}" aria-label="Xóa sản phẩm">×</button></article>`).join('');
  if (lastProduct) render(lastProduct);
}

async function saveCurrentProduct() {
  if (!lastProduct) return;
  if (!session) { status('Hãy đăng nhập Supabase để lưu sản phẩm.', true); return; }
  try {
    await saveSupabaseProduct(lastProduct);
    savedProducts = await listSupabaseProducts();
    renderSavedProducts();
    status('Đã lưu sản phẩm vào Supabase.');
  } catch (error) { status(error.message || 'Không thể lưu sản phẩm vào Supabase.', true); }
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
  if (!email || !password) { $('auth-status').textContent = 'Nhập email và mật khẩu.'; return; }
  $('auth-status').textContent = 'Đang kết nối Supabase…';
  try {
    const result = action === 'register' ? await signUpSupabase(email, password, name) : await signInSupabase(email, password);
    if (!result) { $('auth-status').textContent = 'Đăng ký thành công. Hãy xác nhận email rồi đăng nhập.'; return; }
    session = result;
    savedProducts = await listSupabaseProducts();
    setAuthView();
    renderSavedProducts();
    $('auth-status').textContent = 'Đã đăng nhập Supabase.';
  } catch (error) { $('auth-status').textContent = error.message || 'Supabase Auth thất bại.'; }
}

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
$('save').addEventListener('click', () => { void saveCurrentProduct(); });
$('login').addEventListener('click', () => { void authAction('login'); });
$('register').addEventListener('click', () => { void authAction('register'); });
$('logout').addEventListener('click', async () => { await signOutSupabase(); session = null; savedProducts = []; setAuthView(); renderSavedProducts(); $('auth-status').textContent = 'Đã đăng xuất.'; });
$('saved-list').addEventListener('click', async (event) => {
  const target = event.target.closest('[data-open], [data-delete]');
  if (!target) return;
  const url = target.dataset.open || target.dataset.delete;
  if (target.dataset.open) { await chrome.tabs.create({ url }); return; }
  savedProducts = savedProducts.filter((item) => item.url !== url);
  await chrome.storage.local.set({ savedProducts });
  renderSavedProducts();
  status('Đã xóa sản phẩm khỏi kho lưu.');
});
$('price-reader').addEventListener('click', () => chrome.tabs.create({ url: PRICE_READER_URL }));
$('options').addEventListener('click', (event) => { event.preventDefault(); chrome.runtime.openOptionsPage(); });

chrome.storage.local.get({ lastProduct: null }).then(async ({ lastProduct: product }) => { lastProduct = product; session = await getSupabaseSession(); if (session) { try { savedProducts = await listSupabaseProducts(); } catch (error) { $('auth-status').textContent = error.message || 'Không thể tải sản phẩm đã lưu.'; } } setAuthView(); renderSavedProducts(); if (product) render(product); });
