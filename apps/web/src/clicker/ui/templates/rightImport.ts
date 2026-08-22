import { tip } from '../helpers';
import { SAMPLES } from '../../image/sample';
import { clickerText as tx } from '../../i18n';

export const renderRightImport = () => `
  <div class="section model-preview-section">
    <div class="model-preview-heading">
      <span class="label">${tx('3D file preview', 'Xem trước tệp 3D')}</span>
      <span class="model-preview-badge">STL / 3MF</span>
    </div>
    <div class="model-preview-tabs" id="modelPreviewTabs">
      <button type="button" class="active" data-preview-source="generated">${tx('Generated', 'Đang thiết kế')}</button>
      <button type="button" data-preview-source="imported" id="importedPreviewTab" disabled>${tx('Imported', 'Đã nhập')}</button>
    </div>
    <label class="model-preview-drop" id="modelPreviewDrop">
      <span class="model-preview-drop-icon">3D</span>
      <span><strong>${tx('Import STL or 3MF', 'Nhập STL hoặc 3MF')}</strong><small>${tx('Preview, inspect and recolor locally', 'Xem trước, kiểm tra và tô màu ngay trên máy')}</small></span>
      <input id="modelPreviewFile" type="file" accept=".stl,.3mf,model/stl,model/3mf" hidden />
    </label>
    <div class="model-preview-info" id="modelPreviewInfo" hidden>
      <div><strong id="modelPreviewName"></strong><small id="modelPreviewStats"></small></div>
      <label class="model-preview-color">${tx('RGB color', 'Màu RGB')}<input id="modelPreviewColor" type="color" value="#f0b967" /></label>
      <button type="button" class="btn model-preview-clear" id="modelPreviewClear">${tx('Remove', 'Xóa')}</button>
    </div>
    <div class="model-transform-controls" id="modelTransformControls" hidden>
      <div class="model-transform-heading"><span class="label">${tx('Model orientation', 'Hướng mô hình')}</span><span class="hint-text">${tx('Rotate the imported file independently', 'Xoay tệp đã nhập độc lập')}</span></div>
      <div class="model-axis-grid">
        ${(['x', 'y', 'z'] as const).map((axis) => `<label>${tx(`Rotate ${axis.toUpperCase()}`, `Xoay ${axis.toUpperCase()}`)}<output id="modelRotate${axis.toUpperCase()}Val">0°</output><input id="modelRotate${axis.toUpperCase()}" type="range" min="0" max="360" step="1" value="0" /></label>`).join('')}
      </div>
      <button type="button" class="btn" id="modelTransformReset">${tx('Reset orientation', 'Đặt lại hướng')}</button>
    </div>
  </div>
  <div class="section legend-section">
    <span class="label">${tx('Import Source', 'Nguồn nhập')}</span>
    <div class="import-grid" id="importTabs" role="tablist">
      <button class="import-card active" data-mode="image" type="button"><span class="card-label">${tx('Image', 'Hình ảnh')}</span></button>
      <button class="import-card" data-mode="svg" type="button"><span class="card-label">SVG</span></button>
      <button class="import-card" data-mode="icon" type="button"><span class="card-label">Icon</span></button>
      <button class="import-card" data-mode="text" type="button"><span class="card-label">${tx('Text', 'Văn bản')}</span></button>
      <button class="import-card" data-mode="blocks" type="button"><span class="card-label">Blocks</span></button>
      <button class="import-card" data-mode="hybrid" type="button"><span class="card-label">Image + Blocks</span></button>
    </div>

    <div id="imagePanel" class="mode-panel">
      <div class="drop" id="drop">
        <div class="drop-title">${tx('Upload image', 'Tải hình ảnh lên')}</div>
        <div class="drop-text">${tx('Drop an image, or', 'Thả hình ảnh vào đây, hoặc')} <u>${tx('click to browse', 'bấm để chọn')}</u></div>
        <span style="font-size:10px; opacity:0.8; display:block; margin-top:4px;">${tx('PNG with transparency works best', 'Ảnh PNG nền trong suốt cho kết quả tốt nhất')}</span>
      </div>
      <input type="file" id="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden />
      <div id="hybridSvgImport" hidden style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
        <span class="label">SVG image for Image + Blocks</span>
        <label class="upload-cta">Import SVG<input id="hybridSvgUpload" type="file" accept=".svg,image/svg+xml" /></label>
        <span id="hybridSvgName" class="hint-text"></span>
      </div>
      <div class="switch-row">
        <span class="switch-label">${tx('Remove background', 'Xóa nền')} ${tip(tx('Automatically removes a solid background.', 'Tự động xóa nền màu đồng nhất.'))}</span>
        <label class="toggle"><input id="removebg" type="checkbox" /><span class="slider"></span></label>
      </div>
      <div class="switch-row">
        <span class="switch-label">${tx('Chibi style', 'Phong cách Chibi')} ${tip(tx('Flatten noisy phone photos into simplified flat color regions for cute 2D output.', 'Đơn giản hóa ảnh điện thoại thành các mảng màu phẳng để tạo hình 2D dễ thương.'))}</span>
        <label class="toggle"><input id="photoFlatten" type="checkbox" /><span class="slider"></span></label>
      </div>
      <span class="sample-heading">${tx('Choose a sample image', 'Chọn hình ảnh mẫu')}</span>
      <div class="sample-inline-grid" id="sampleGrid">
        ${SAMPLES.map((s, idx) => `
          <div class="sample-inline-item" data-idx="${idx}">
            <img src="${s.src}" alt="${s.name}" />
            <span>${s.name}</span>
          </div>
        `).join('')}
      </div>

      <div class="section" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border);">
        <span class="label">${tx('Lower image base (Image + Blocks)', 'Base dạng ảnh phía dưới (Image + Blocks)')}</span>
        <p class="hint-text" style="margin: 4px 0 10px;">${tx('Use the same silhouette workflow in Image and Image + Blocks. The lower base automatically wraps the top image.', 'Dùng chung cho Image và Image + Blocks. Base dưới sẽ tự động bao phủ hình ảnh phía trên.')}</p>
        <div class="tabs" style="margin-bottom: 12px;">
          <button id="tab-base-match" class="tab active" type="button">${tx('Match Top', 'Theo hình phía trên')}</button>
          <button id="tab-base-custom" class="tab" type="button">${tx('Custom Image', 'Hình tùy chỉnh')}</button>
        </div>

        <div id="bottom-upload-zone" style="display: none;">
          <div class="drop" id="drop-bottom" style="min-height: 80px; padding: 16px;">
            <div class="drop-title" style="font-size: 13px;">${tx('Upload Bottom Base', 'Tải hình base phía dưới')}</div>
            <div class="drop-text" style="font-size: 11px;">${tx('Drop a silhouette image here', 'Thả ảnh silhouette vào đây')}</div>
          </div>
          <input type="file" id="file-bottom" accept="image/*" hidden />

          <div class="switch-row" id="bottom-solid-row" style="margin-top: 10px;">
            <span class="switch-label" style="font-size: 12px;">${tx('Solid Base', 'Base đặc')} ${tip(tx('Keep only the base silhouette and remove the colored artwork regions on the base.', 'Chỉ giữ silhouette của base và loại bỏ các mảng màu hình ảnh trên base.'))}</span>
            <label class="toggle"><input id="bottomSolidOnly" type="checkbox" /><span class="slider"></span></label>
          </div>

          <div class="prow-stacked" style="margin-top:12px;">
            <div class="prow-header">
              <label for="baseExpand">${tx('Base expansion', 'Mở rộng base')} ${tip(tx('Add extra margin around the base silhouette so it can wrap neatly under the top cap.', 'Thêm lề quanh silhouette để base ôm gọn phần trên.'))}</label>
              <input type="text" class="val" id="baseExpandVal" value="22%" />
            </div>
            <input type="range" id="baseExpand" min="0" max="100" step="1" value="22" />
          </div>

          <div class="prow-stacked" style="margin-top:12px;">
            <div class="prow-header">
              <label for="basePadding">${tx('Base image padding', 'Độ đệm ảnh base')} ${tip(tx('Add a separate printable margin around the lower image. This is independent from the top image margin.', 'Thêm viền in riêng quanh ảnh base phía dưới, độc lập với độ đệm ảnh phía trên.'))}</label>
              <input type="text" class="val" id="basePaddingVal" value="1.2 mm" />
            </div>
            <input type="range" id="basePadding" min="0" max="12" step="0.1" value="1.2" />
          </div>

          <div style="margin-top:12px;">
            <div class="label" style="text-align:center; margin-bottom:6px; font-size:11px;">${tx('ALIGN BOTTOM BASE', 'CĂN CHỈNH BASE DƯỚI')}</div>
            <div style="display:flex; justify-content:center; gap:6px; margin-bottom:6px;">
              <button type="button" class="btn" id="baseRotLeft" title="Rotate 15 degrees counter-clockwise">↺ 15°</button>
              <button type="button" class="btn" id="baseNudgeUp" title="Move up">↑</button>
              <button type="button" class="btn" id="baseRotRight" title="Rotate 15 degrees clockwise">↻ 15°</button>
            </div>
            <div style="display:flex; justify-content:center; gap:6px;">
              <button type="button" class="btn" id="baseNudgeLeft" title="Move left">←</button>
              <button type="button" class="btn" id="baseResetPos" title="Reset position">⌾</button>
              <button type="button" class="btn" id="baseNudgeRight" title="Move right">→</button>
            </div>
            <div style="display:flex; justify-content:center; gap:6px; margin-top:6px;">
              <button type="button" class="btn" id="baseNudgeDown" title="Move down">↓</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div id="svgPanel" class="mode-panel" hidden>
      <p class="hint-text">${tx('Drop or upload SVG vector files.', 'Thả hoặc tải lên tệp vector SVG.')}</p>
      <div id="uploadGallery"></div>
      <label class="upload-cta">${tx('Upload SVG file(s)', 'Tải tệp SVG lên')}<input id="svgUpload" type="file" accept=".svg,image/svg+xml" multiple /></label>
      <div class="switch-row">
        <span class="switch-label">${tx('Remove background', 'Xóa nền')}</span>
        <label class="toggle"><input id="removebgSvg" type="checkbox" /><span class="slider"></span></label>
      </div>
      <button class="primary" id="generateSvg" style="margin-top: 10px; width: 100%;">${tx('Generate', 'Tạo mô hình')}</button>
    </div>

    <div id="iconPanel" class="mode-panel" hidden>
      <div id="iconSearchWrap">
        <input id="iconSearch" type="search" placeholder="${tx('Search Lucide icons…', 'Tìm biểu tượng Lucide…')}" autocomplete="off" spellcheck="false" />
        <button id="iconSearchClear" type="button" aria-label="${tx('Clear icon search', 'Xóa tìm kiếm biểu tượng')}">×</button>
      </div>
      <div id="iconCount"></div>
      <div id="gallery"></div>
      <button class="primary" id="generateIcon" style="margin-top: 10px; width: 100%;">${tx('Generate', 'Tạo mô hình')}</button>
    </div>

    <div id="letterPanel" class="mode-panel" hidden>
      <div class="field" id="textOnlyField">
        <label for="letterText">${tx('Custom Text', 'Văn bản tùy chỉnh')}</label>
        <textarea id="letterText" rows="2" maxlength="30" style="width: 100%; min-height: 48px;">Custom
Text</textarea>
      </div>
      <div class="field" id="blocksTextField" hidden>
        <label for="blocksText">${tx('Text', 'Văn bản')}</label>
        <textarea id="blocksText" rows="1" maxlength="24" style="width: 100%; resize: none; min-height: 34px;">Name</textarea>
      </div>
      <div class="field" id="blocksChainField" hidden>
        <label>${tx('Add symbol or emoji', 'Thêm ký hiệu hoặc emoji')}</label>
        <p class="hint-text" style="margin: 0 0 6px;">${tx('Each character becomes one printed block. Edit the text above to change the chain.', 'Mỗi ký tự tạo thành một block có thể in. Sửa văn bản phía trên để thay đổi chuỗi.')}</p>
        <div id="blockChips" class="block-chips"></div>
      </div>
      <div class="section keycap-image-section" id="keycapImagePanel" hidden style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
        <span class="label">${tx('Keycap logo library', 'Kho logo keycap')}</span>
        <div class="drop keycap-image-drop" id="keycapImageDrop" style="min-height: 86px; padding: 14px;">
          <div class="drop-title" style="font-size: 13px;">${tx('Import multiple JPG, PNG or SVG logos', 'Nhập nhiều logo JPG, PNG hoặc SVG')}</div>
          <div class="drop-text">${tx('Drop files here, or <u>click to browse</u>', 'Thả nhiều file vào đây, hoặc <u>bấm để chọn</u>')}</div>
          <span style="font-size:10px; opacity:0.8; display:block; margin-top:4px;">${tx('Assign one logo to each keycap. Logo is flush by default; Extrude raises it.', 'Gán từng logo cho từng keycap. Logo mặc định cùng mặt; Extrude sẽ đẩy logo nổi lên.')}</span>
        </div>
        <input type="file" id="keycapImageFile" accept="image/jpeg,image/png,image/svg+xml,.jpg,.jpeg,.png,.svg" multiple hidden />
        <div class="keycap-image-file-row" style="display:flex; align-items:center; gap:8px; margin-top:8px;">
          <span id="keycapImageName" class="hint-text" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">No keycap logos</span>
          <button class="btn" id="clearKeycapImage" type="button">${tx('Clear all', 'Xóa tất cả')}</button>
        </div>
        <div class="prow-stacked" style="margin-top:12px;">
          <div class="prow-header"><label for="keycapLogoSize">${tx('Logo size', 'Kích thước logo')}</label><input type="text" class="val" id="keycapLogoSizeVal" /></div>
          <input type="range" id="keycapLogoSize" min="4" max="13" step="0.5" />
        </div>
        <div class="keycap-logo-library" id="keycapLogoLibrary" style="margin-top:12px;"></div>
        <div class="keycap-logo-slots" id="keycapLogoSlots" style="margin-top:12px;"></div>
      </div>
      <div class="field">
        <label>${tx('Font', 'Phông chữ')}</label>
        <div id="fontGrid" class="font-grid"></div>
        <label class="upload">+ ${tx('Import font', 'Nhập phông chữ')}<input id="fontUpload" type="file" accept=".ttf,.otf,.json" /></label>
      </div>
      <button class="primary" id="generateText" style="margin-top: 10px; width: 100%;">${tx('Generate', 'Tạo mô hình')}</button>
    </div>
  </div>
`;
