import { clickerText as tx } from '../../i18n';
import type { MultiColorDocument, MultiColorSettings } from './model';

function rangeField(id: string, label: string, min: number, max: number, step: number, value: number, outputId: string, output: string): string {
  return `<label class="multi-color-field"><span>${label}<output id="${outputId}">${output}</output></span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
}

export function renderMultiColor(settings: MultiColorSettings): string {
  return `<div class="multi-color-shell">
    <header class="multi-color-topbar">
      <a class="multi-color-back" href="#/admin/clicker">${tx('Back to dashboard', 'Back to dashboard')}</a>
      <div class="multi-color-brand">
        <span class="multi-color-mark">M</span>
        <div><small>FORMAFORGEDT / CLICKER</small><strong>Multi Color</strong></div>
      </div>
      <span id="multiColorStatus" class="multi-color-badge">${tx('Ready to import', 'Ready to import')}</span>
    </header>
    <main class="multi-color-main">
      <section class="multi-color-stage">
        <div id="multiColorViewport" class="multi-color-viewport"></div>
        <div id="multiColorEmpty" class="multi-color-empty">
          <div class="multi-color-empty-mark">M</div>
          <h1>${tx('Layered image builder', 'Layered image builder')}</h1>
          <p>${tx('Import a multi-colour image to create separate printable layers.', 'Import a multi-colour image to create separate printable layers.')}</p>
        </div>
      </section>
      <aside class="multi-color-sidebar">
        <div class="multi-color-heading">
          <span>MULTI COLOR / CLICKER</span>
          <h2>${tx('Layered image builder', 'Layered image builder')}</h2>
          <p>${tx('Create printable colour layers with an optional base and keychain.', 'Create printable colour layers with an optional base and keychain.')}</p>
        </div>
        <section class="multi-color-card">
          <h3>01 / ${tx('Import image', 'Import image')}</h3>
          <label id="multiColorDrop" class="multi-color-drop">
            <strong>${tx('Drop PNG, JPG, WebP or SVG', 'Drop PNG, JPG, WebP or SVG')}</strong>
            <span>${tx('or click to choose a file', 'or click to choose a file')}</span>
            <input id="multiColorFile" type="file" accept="image/png,image/jpeg,image/webp,image/bmp,image/svg+xml,.svg">
          </label>
          <p id="multiColorFileName" class="multi-color-help">${tx('No image loaded', 'No image loaded')}</p>
          <label class="multi-color-check"><input id="multiColorRemoveBackground" type="checkbox" ${settings.removeBackground ? 'checked' : ''}><span>${tx('Remove border background', 'Remove border background')}</span></label>
        </section>
        <section class="multi-color-card">
          <h3>02 / ${tx('Colour layers', 'Colour layers')}</h3>
           ${rangeField('multiColorCount', tx('Detected / maximum colour layers', 'Số lớp màu nhận diện / tối đa'), 1, 16, 1, settings.colorCount, 'multiColorCountValue', String(settings.colorCount))}
          ${rangeField('multiColorSmoothing', tx('Contour smoothing', 'Contour smoothing'), 0, 1, 0.05, settings.smoothing, 'multiColorSmoothingValue', `${Math.round(settings.smoothing * 100)}%`)}
           <p class="multi-color-help">${tx('Import detects the printable colour count automatically. Move the slider to override it. Order: bottom to top; drag a colour or use the arrows.', 'Khi import, số lớp màu in được sẽ được tự nhận diện. Kéo thanh trượt để ghi đè. Thứ tự từ dưới lên trên; kéo màu hoặc dùng mũi tên để sắp xếp.')}</p>
           <div id="multiColorPalette" class="multi-color-palette"></div>
           <button id="multiColorRecommendedOrder" class="multi-color-reset" type="button">${tx('Restore recommended order', 'Khôi phục thứ tự đề xuất')}</button>
         </section>
        <section class="multi-color-card">
          <h3>03 / ${tx('Assembly', 'Assembly')}</h3>
          <div class="multi-color-segment"><button type="button" data-multi-layout="flat">${tx('Flat / separate', 'Flat / separate')}</button><button type="button" data-multi-layout="stacked">${tx('Stacked / assembled', 'Stacked / assembled')}</button></div>
          ${rangeField('multiColorSize', tx('Target size', 'Target size'), 20, 180, 1, settings.targetSizeMm, 'multiColorSizeValue', `${settings.targetSizeMm.toFixed(0)} mm`)}
          ${rangeField('multiColorLayer', tx('Layer height', 'Layer height'), 0.2, 5, 0.05, settings.layerHeightMm, 'multiColorLayerValue', `${settings.layerHeightMm.toFixed(2)} mm`)}
          ${rangeField('multiColorGap', tx('Gap between layers', 'Gap between layers'), 0, 5, 0.05, settings.layerGapMm, 'multiColorGapValue', `${settings.layerGapMm.toFixed(2)} mm`)}
          ${rangeField('multiColorBase', tx('Base thickness', 'Base thickness'), 0.4, 10, 0.1, settings.baseThicknessMm, 'multiColorBaseValue', `${settings.baseThicknessMm.toFixed(1)} mm`)}
          ${rangeField('multiColorPadding', tx('Base padding', 'Base padding'), 0, 12, 0.1, settings.paddingMm, 'multiColorPaddingValue', `${settings.paddingMm.toFixed(1)} mm`)}
          <label class="multi-color-check"><input id="multiColorIncludeBase" type="checkbox" ${settings.includeBase ? 'checked' : ''}><span>${tx('Include supporting base', 'Include supporting base')}</span></label>
        </section>
        <section class="multi-color-card">
          <h3>04 / ${tx('Keychain', 'Keychain')}</h3>
           <label class="multi-color-check"><input id="multiColorKeychainEnabled" type="checkbox" ${settings.keychainEnabled ? 'checked' : ''}><span>${tx('Add keychain loop', 'Thêm vòng móc khóa')}</span></label>
          ${rangeField('multiColorKeychainWidth', tx('Keychain width', 'Keychain width'), 6, 30, 0.5, settings.keychainWidthMm, 'multiColorKeychainWidthValue', `${settings.keychainWidthMm.toFixed(1)} mm`)}
          ${rangeField('multiColorKeychainThickness', tx('Keychain thickness', 'Keychain thickness'), 0.8, 6, 0.1, settings.keychainThicknessMm, 'multiColorKeychainThicknessValue', `${settings.keychainThicknessMm.toFixed(1)} mm`)}
           ${rangeField('multiColorKeychainX', tx('Keychain X position', 'Vị trí X móc khóa'), -100, 100, 1, settings.keychainOffsetXMm, 'multiColorKeychainXValue', `${settings.keychainOffsetXMm.toFixed(0)} mm`)}
           ${rangeField('multiColorKeychainY', tx('Keychain Y position', 'Vị trí Y móc khóa'), -100, 100, 1, settings.keychainOffsetYMm, 'multiColorKeychainYValue', `${settings.keychainOffsetYMm.toFixed(0)} mm`)}
           <p class="multi-color-help">${tx('The loop automatically follows the assembly colours through its thickness.', 'Màu vòng móc khóa tự động chạy theo các lớp màu theo chiều dày.')}</p>
        </section>
        <section class="multi-color-card">
          <label class="multi-color-check"><input id="multiColorExportStacked" type="checkbox" ${settings.exportStacked ? 'checked' : ''}><span>${tx('Stack layers in STL / 3MF export', 'Stack layers in STL / 3MF export')}</span></label>
           <p class="multi-color-help">${tx('STL ZIP keeps one file per colour layer with shared XY/Z coordinates. 3MF keeps each layer as a separate coloured object.', 'STL ZIP giữ từng lớp màu với cùng tọa độ XY/Z. 3MF giữ từng lớp là một object đúng màu.')}</p>
          <div class="multi-color-export-grid"><button id="multiColorExportStl" type="button" disabled>${tx('Download STL ZIP', 'Download STL ZIP')}</button><button id="multiColorExport3mf" type="button" disabled>${tx('Download 3MF', 'Download 3MF')}</button></div>
          <button id="multiColorReset" class="multi-color-reset" type="button">${tx('Reset', 'Reset')}</button>
        </section>
      </aside>
    </main>
  </div>`;
}

export function renderMultiColorPalette(palette: MultiColorDocument['palette']): string {
  if (!palette.length) return '<div class="multi-color-help">No detected colour layers.</div>';
  return palette.map((entry, index) => `<div class="multi-color-swatch-row" draggable="true" data-multi-layer-index="${index}"><i class="multi-color-swatch" style="background:rgb(${entry.rgb.join(',')})"></i><span><strong>Layer ${index + 1}</strong><small>${Math.round(entry.coverage * 100)}%</small></span><span class="multi-color-order-buttons"><button type="button" data-multi-order="up" data-multi-layer-index="${index}" title="Move toward top" aria-label="Move layer ${index + 1} toward top">▲</button><button type="button" data-multi-order="down" data-multi-layer-index="${index}" title="Move toward bottom" aria-label="Move layer ${index + 1} toward bottom">▼</button></span></div>`).join('');
}
