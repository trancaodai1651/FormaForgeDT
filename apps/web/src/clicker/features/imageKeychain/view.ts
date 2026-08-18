import type { ImageKeychainConfig, ImageKeychainLanguage } from './model';
import { keychainLetters } from './model';

const copy = {
  vi: {
    title: 'Image Name Keychain', subtitle: 'Ảnh ở đầu sản phẩm · socket và keycap theo tên', back: '← Workspace', badge: 'Ảnh đầu sản phẩm', upload: 'Nhập ảnh PNG / JPG / WebP', replace: 'Thay ảnh', required: 'Cần nhập ảnh trước khi xuất file.', imageWidth: 'Chiều rộng badge', thickness: 'Độ dày badge', relief: 'Độ nổi ảnh', colors: 'Số màu', removeBg: 'Xóa nền ảnh', identity: 'Tên và socket', name: 'Ký tự', slots: 'socket được tạo', slotHint: 'Mỗi ký tự tạo một lỗ trên base và một keycap tương ứng.', materials: 'Màu vật liệu', base: 'Base + khung ảnh', cap: 'Keycap', glyph: 'Ký tự', preview: 'Xem trước', assembled: 'Lắp ráp', exploded: 'Tách lớp', export: 'Xuất file', export3mf: 'Xuất 3MF nhiều màu', exportStl: 'Xuất STL', status: 'Đang chuẩn bị hình học…', orbit: 'Kéo để xoay · cuộn để thu phóng', placeholder: 'Nhập ảnh để thay badge mẫu', admin: 'ADMIN / PRODUCT GENERATOR', language: 'EN', imageReady: 'Ảnh đã được vector hóa', printHint: 'Base dùng socket và keycap STL nguồn từ Flex Keychain.', reset: 'Đặt lại',
  },
  en: {
    title: 'Image Name Keychain', subtitle: 'Image badge above · name-driven sockets and keycaps', back: '← Workspace', badge: 'Product image badge', upload: 'Import PNG / JPG / WebP', replace: 'Replace image', required: 'Import an image before exporting.', imageWidth: 'Badge width', thickness: 'Badge thickness', relief: 'Image relief', colors: 'Color count', removeBg: 'Remove image background', identity: 'Name and sockets', name: 'Characters', slots: 'generated sockets', slotHint: 'Every character creates one base cutout and one matching keycap.', materials: 'Material colors', base: 'Base + image frame', cap: 'Keycap', glyph: 'Legend', preview: 'Preview', assembled: 'Assembled', exploded: 'Exploded', export: 'Export', export3mf: 'Export color 3MF', exportStl: 'Export STL', status: 'Preparing geometry…', orbit: 'Drag to orbit · scroll to zoom', placeholder: 'Import an image to replace the sample badge', admin: 'ADMIN / PRODUCT GENERATOR', language: 'VI', imageReady: 'Image vectorized', printHint: 'The base uses the source Flex Keychain socket and keycap STL assets.', reset: 'Reset',
  },
} as const;

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

export function renderImageKeychain(config: ImageKeychainConfig, language: ImageKeychainLanguage, imageUrl: string | null, ready: boolean): string {
  const t = copy[language];
  const letters = keychainLetters(config.name);
  return `<div class="image-keychain-shell">
    <header class="image-keychain-topbar"><a class="image-keychain-back" href="#/admin">${t.back}</a><div class="image-keychain-brand"><span class="image-keychain-mark">IK</span><div><small>${t.admin}</small><strong>${t.title}</strong></div></div><div class="image-keychain-top-actions"><button id="imageKeychainReset" type="button">${t.reset}</button><button id="imageKeychainLanguage" type="button">${t.language}</button></div></header>
    <main class="image-keychain-main">
      <section class="image-keychain-stage"><div id="imageKeychainViewport" class="image-keychain-viewport"></div><div id="imageKeychainStatus" class="image-keychain-status">${t.status}</div><div class="image-keychain-hint">${t.orbit}</div></section>
      <aside class="image-keychain-sidebar">
        <div class="image-keychain-heading"><h1>${t.title}</h1><p>${t.subtitle}</p></div>
        <section class="image-keychain-card"><div class="image-keychain-card-title"><span>01</span>${t.badge}</div>
          <label class="image-keychain-upload ${imageUrl ? 'has-image' : ''}">${imageUrl ? `<img src="${imageUrl}" alt=""/>` : '<span class="image-keychain-upload-icon">＋</span>'}<strong>${imageUrl ? t.replace : t.upload}</strong><input id="imageKeychainFile" type="file" accept="image/png,image/jpeg,image/webp"/></label>
          <div class="image-keychain-help ${imageUrl ? 'success' : ''}">${imageUrl ? t.imageReady : t.placeholder}</div>
          ${range('imageKeychainWidth', t.imageWidth, config.imageWidthMm, 45, 110, 1, 'mm')}
          ${range('imageKeychainThickness', t.thickness, config.badgeThicknessMm, 2, 8, .1, 'mm')}
          ${range('imageKeychainRelief', t.relief, config.imageDepthMm, .2, 2, .1, 'mm')}
          <div class="image-keychain-two"><label>${t.colors}<select id="imageKeychainColors">${[2, 3, 4, 6, 8].map((count) => `<option value="${count}" ${config.colorCount === count ? 'selected' : ''}>${count}</option>`).join('')}</select></label><label class="image-keychain-toggle">${t.removeBg}<input id="imageKeychainRemoveBg" type="checkbox" ${config.removeBackground ? 'checked' : ''}/><i></i></label></div>
        </section>
        <section class="image-keychain-card"><div class="image-keychain-card-title"><span>02</span>${t.identity}</div><label class="image-keychain-label">${t.name}<input id="imageKeychainName" maxlength="10" value="${esc(config.name)}"/></label><div class="image-keychain-count"><strong>${letters.length}</strong><span>${t.slots}</span></div><div class="image-keychain-letters">${letters.map((letter, index) => `<span title="Socket ${index + 1}">${esc(letter)}</span>`).join('')}</div><div class="image-keychain-help">${t.slotHint}</div></section>
        <section class="image-keychain-card"><div class="image-keychain-card-title"><span>03</span>${t.materials}</div><div class="image-keychain-colors"><label>${t.base}<input id="imageKeychainBaseColor" type="color" value="${config.baseColor}"/></label><label>${t.cap}<input id="imageKeychainCapColor" type="color" value="${config.capColor}"/></label><label>${t.glyph}<input id="imageKeychainGlyphColor" type="color" value="${config.glyphColor}"/></label></div><div class="image-keychain-help">${t.printHint}</div></section>
        <section class="image-keychain-card"><div class="image-keychain-card-title"><span>04</span>${t.preview}</div><div class="image-keychain-segment"><button id="imageKeychainAssembled" class="active" type="button">${t.assembled}</button><button id="imageKeychainExploded" type="button">${t.exploded}</button></div></section>
        <section class="image-keychain-card image-keychain-export"><div class="image-keychain-card-title"><span>05</span>${t.export}</div><button id="imageKeychainExport3mf" class="primary" type="button" ${ready && imageUrl ? '' : 'disabled'}>${t.export3mf}</button><button id="imageKeychainExportStl" type="button" ${ready && imageUrl ? '' : 'disabled'}>${t.exportStl}</button>${!imageUrl ? `<div class="image-keychain-help warning">${t.required}</div>` : ''}</section>
      </aside>
    </main>
  </div>`;
}

function range(id: string, label: string, value: number, min: number, max: number, step: number, unit: string): string {
  return `<label class="image-keychain-range"><span>${label}<output id="${id}Value">${value.toFixed(step < 1 ? 1 : 0)} ${unit}</output></span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"/></label>`;
}
