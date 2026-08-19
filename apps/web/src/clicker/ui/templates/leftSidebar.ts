import { ASSET_BASE } from '../constants';
import { tip } from '../helpers';
import { clickerText as tx } from '../../i18n';

export const renderLeftSidebar = () => `
  <div class="app-header">
    <button id="btnBackHome" class="btn-back-home">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      ${tx('Dashboard', 'Bảng điều khiển')}
    </button>
    <h1>Clicker Generator</h1>
    <p class="app-subtitle">${tx('Generate a printable 3D clicker from an image', 'Tạo mô hình clicker 3D có thể in từ hình ảnh')}</p>
  </div>

  <div class="section" id="previewViewSection">
    <span class="label">${tx('Preview & View', 'Xem trước & góc nhìn')}</span>
    <div class="tabs" id="viewTabs" role="tablist" style="margin-bottom: 12px;">
      <button class="tab active" data-view="assembled" type="button">${tx('Assembled', 'Lắp ráp')}</button>
      <button class="tab" data-view="exploded" type="button">${tx('Exploded', 'Tách rời')}</button>
    </div>
    <div class="switch-row">
      <span class="switch-label">${tx('Show MX switch', 'Hiện switch MX')} ${tip(tx('Shows a reference MX switch in the preview. It is not exported.', 'Hiện switch MX tham chiếu trong preview. Switch không nằm trong file xuất.'))}</span>
      <label class="toggle"><input id="showswitch" type="checkbox" /><span class="slider"></span></label>
    </div>
  </div>

  <div class="section" id="blocksSection" hidden>
    <span class="label">Blocks</span>
    <div class="field">
      <label>${tx('Layout', 'Bố cục')}</label>
      <div class="tabs" id="blockOrient" role="tablist">
        <button class="tab active" data-orient="horizontal" type="button">${tx('Horizontal', 'Ngang')}</button>
        <button class="tab" data-orient="vertical" type="button">${tx('Vertical', 'Dọc')}</button>
      </div>
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="legendSize">${tx('Letter size', 'Kích thước ký tự')}</label>
        <input type="text" class="val" id="legendSizeVal" />
      </div>
      <input type="range" id="legendSize" min="0.5" max="1.4" step="0.05" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="legendBold">${tx('Boldness', 'Độ đậm')}</label>
        <input type="text" class="val" id="legendBoldVal" />
      </div>
      <input type="range" id="legendBold" min="-0.3" max="0.8" step="0.05" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="blockKeycapGap">${tx('Base to keycap gap', 'Khoảng hở base và keycap')}</label>
        <input type="text" class="val" id="blockKeycapGapVal" />
      </div>
      <input type="range" id="blockKeycapGap" min="0" max="3" step="0.1" />
    </div>
    <div id="blocksLegacyBaseControls">
    <div class="switch-row">
      <span class="switch-label">${tx('Flat underside', 'Mặt đáy phẳng')}</span>
      <label class="toggle"><input id="blockFlatBottom" type="checkbox" /><span class="slider"></span></label>
    </div>
    <div class="label" style="margin-top: 16px;">${tx('Base geometry', 'Hình học base')}</div>
    <div class="prow-stacked">
      <div class="prow-header"><label for="blockBaseHeight">${tx('Base height', 'Chiều cao base')}</label><input type="text" class="val" id="blockBaseHeightVal" /></div>
      <input type="range" id="blockBaseHeight" min="8" max="30" step="0.5" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header"><label for="blockModuleThickness">${tx('Module/base thickness', 'Độ dày module/base')}</label><input type="text" class="val" id="blockModuleThicknessVal" /></div>
      <input type="range" id="blockModuleThickness" min="8" max="40" step="0.5" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header"><label for="blockModuleSideThickness">${tx('Module side-wall thickness', 'Độ dày thành module')}</label><input type="text" class="val" id="blockModuleSideThicknessVal" /></div>
      <input type="range" id="blockModuleSideThickness" min="0" max="33" step="0.25" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header"><label for="blockBaseCornerRadius">${tx('Base corner radius', 'Bán kính bo góc base')}</label><input type="text" class="val" id="blockBaseCornerRadiusVal" /></div>
      <input type="range" id="blockBaseCornerRadius" min="0.5" max="8" step="0.25" />
    </div>
    </div>
    <div class="label" style="margin-top: 16px;">${tx('Keycap geometry', 'Hình học keycap')}</div>
    <div class="field">
      <label>${tx('Keycap shape', 'Hình dạng keycap')}</label>
      <div class="tabs" id="blockKeycapShape" role="tablist">
        <button class="tab active" data-keycap-shape="rounded" type="button">${tx('Rounded', 'Bo tròn')}</button>
        <button class="tab" data-keycap-shape="square" type="button">${tx('Square', 'Vuông')}</button>
      </div>
    </div>
    <div class="field">
      <label>${tx('Keycap seating', 'Vị trí keycap')}</label>
      <div class="tabs" id="blockKeycapMount" role="tablist">
        <button class="tab" data-keycap-mount="recessed" type="button">${tx('Recessed in base', 'Âm trong base')}</button>
        <button class="tab active" data-keycap-mount="above" type="button">${tx('Above base', 'Nằm trên base')}</button>
      </div>
    </div>
    <div class="field">
      <label for="blockKeycapProfile">${tx('Keycap profile', 'Biên dạng keycap')}</label>
      <select id="blockKeycapProfile">
        <option value="standard">${tx('Standard profile', 'Biên dạng tiêu chuẩn')}</option>
        <option value="low">${tx('Low profile', 'Biên dạng thấp')}</option>
        <option value="thocky">${tx('Thocky profile', 'Biên dạng dày')}</option>
        <option value="choc-v1">Choc v1</option>
      </select>
    </div>
    <div class="field">
      <label for="blockKeySize">${tx('Key size', 'Kích thước phím')}</label>
      <select id="blockKeySize">
        <option value="1">1u</option>
        <option value="1.25">1.25u</option>
        <option value="1.5">1.5u</option>
        <option value="1.75">1.75u</option>
        <option value="2">2u (1 stem)</option>
        <option value="2.25">2.25u</option>
        <option value="2.75">2.75u</option>
        <option value="6">6u ${tx('Spacebar', 'Phím cách')}</option>
        <option value="6.25">6.25u ${tx('Spacebar', 'Phím cách')}</option>
        <option value="6.5">6.5u ${tx('Spacebar', 'Phím cách')}</option>
      </select>
    </div>
    <div id="hybridBodyControls" hidden>
      <div class="label" style="margin-top: 16px;">${tx('Flat image keychain plate', 'Plate flat keychain của hình ảnh')}</div>
      <div class="prow-stacked">
        <div class="prow-header"><label for="hybridImageSize">${tx('Image size', 'Kích thước hình ảnh')}</label><input type="text" class="val" id="hybridImageSizeVal" /></div>
        <input type="range" id="hybridImageSize" min="30" max="140" step="1" />
      </div>
      <div class="prow-stacked">
        <div class="prow-header"><label for="hybridImageThickness">${tx('Image thickness', 'Độ dày hình ảnh')}</label><input type="text" class="val" id="hybridImageThicknessVal" /></div>
        <input type="range" id="hybridImageThickness" min="4" max="24" step="0.5" />
      </div>
      <div class="prow-stacked">
        <div class="prow-header"><label for="hybridImagePadding">${tx('Image padding', 'Khoảng đệm hình ảnh')}</label><input type="text" class="val" id="hybridImagePaddingVal" /></div>
        <input type="range" id="hybridImagePadding" min="0" max="20" step="0.1" />
      </div>
      <div class="prow-stacked">
        <div class="prow-header"><label for="hybridKeychainPosition">${tx('Keychain position', 'Vị trí móc khóa')}</label></div>
        <select id="hybridKeychainPosition">
          <option value="top">${tx('Top of image', 'Phía trên hình ảnh')}</option>
          <option value="bottom">${tx('Bottom of image', 'Phía dưới hình ảnh')}</option>
        </select>
      </div>
      <div class="prow-stacked">
        <div class="prow-header"><label for="hybridKeychainHeight">${tx('Keychain thickness', 'Độ dày móc khóa')}</label><input type="text" class="val" id="hybridKeychainHeightVal" /></div>
        <input type="range" id="hybridKeychainHeight" min="1" max="15" step="0.1" />
      </div>
      <div class="prow-stacked">
        <div class="prow-header"><label for="hybridImageExtrude">${tx('Image relief / extrude', 'Đùn nổi hình ảnh')}</label><input type="text" class="val" id="hybridImageExtrudeVal" /></div>
        <input type="range" id="hybridImageExtrude" min="0" max="6" step="0.1" />
      </div>
      <div class="prow-stacked">
        <div class="prow-header"><label for="hybridTextExtrude">${tx('Text relief / extrude', 'Đùn nổi chữ')}</label><input type="text" class="val" id="hybridTextExtrudeVal" /></div>
        <input type="range" id="hybridTextExtrude" min="0" max="5" step="0.05" />
      </div>
      <div class="label" style="margin-top: 16px;">${tx('Continuous rounded base', 'Base liền khối bo góc')}</div>
      <div class="prow-stacked">
        <div class="prow-header"><label for="hybridBaseWidth">${tx('Base width', 'Chiều rộng base')}</label><input type="text" class="val" id="hybridBaseWidthVal" /></div>
        <input type="range" id="hybridBaseWidth" min="20" max="60" step="0.5" />
      </div>
      <div class="prow-stacked">
        <div class="prow-header"><label for="hybridBaseEndPadding">${tx('End padding', 'Khoảng đệm cuối')}</label><input type="text" class="val" id="hybridBaseEndPaddingVal" /></div>
        <input type="range" id="hybridBaseEndPadding" min="10" max="35" step="0.5" />
      </div>
      <div class="prow-stacked">
        <div class="prow-header"><label for="hybridKeycapSpacing">${tx('Keycap spacing', 'Khoảng cách keycap')}</label><input type="text" class="val" id="hybridKeycapSpacingVal" /></div>
        <input type="range" id="hybridKeycapSpacing" min="0" max="15" step="0.5" />
      </div>
      <div class="prow-stacked">
        <div class="prow-header"><label for="hybridKeycapClearance">${tx('Keycap pocket clearance', 'Khe hở quanh keycap')}</label><input type="text" class="val" id="hybridKeycapClearanceVal" /></div>
        <input type="range" id="hybridKeycapClearance" min="0.2" max="4" step="0.1" />
      </div>
      <div class="prow-stacked">
        <div class="prow-header"><label for="hybridBaseThickness">${tx('Base thickness', 'Độ dày base')}</label><input type="text" class="val" id="hybridBaseThicknessVal" /></div>
        <input type="range" id="hybridBaseThickness" min="5" max="20" step="0.5" />
      </div>
      <div class="prow-stacked">
        <div class="prow-header"><label for="hybridBaseWallHeight">${tx('Switch-cover height', 'Chiều cao che switch')}</label><input type="text" class="val" id="hybridBaseWallHeightVal" /></div>
        <input type="range" id="hybridBaseWallHeight" min="0" max="20" step="0.25" />
      </div>
      <div class="prow-stacked">
        <div class="prow-header"><label for="hybridBaseCornerRadius">${tx('Tail corner radius', 'Bán kính bo góc đuôi')}</label><input type="text" class="val" id="hybridBaseCornerRadiusVal" /></div>
        <input type="range" id="hybridBaseCornerRadius" min="1" max="14" step="0.5" />
      </div>
      <div class="label" style="margin-top: 16px;">${tx('Straight base head', 'Đầu base thẳng')}</div>
      <div class="prow-stacked">
        <div class="prow-header"><label for="hybridNeckLength">${tx('Material before first keycap', 'Đoạn base trước keycap đầu')}</label><input type="text" class="val" id="hybridNeckLengthVal" /></div>
        <input type="range" id="hybridNeckLength" min="0" max="30" step="0.5" />
      </div>
      <div class="prow-stacked">
        <div class="prow-header"><label for="hybridBaseImageOverlap">${tx('Base insertion depth', 'Độ sâu base đâm vào hình')}</label><input type="text" class="val" id="hybridBaseImageOverlapVal" /></div>
        <input type="range" id="hybridBaseImageOverlap" min="0" max="20" step="0.5" />
      </div>
      <p class="field-help">${tx('The image is a flat keychain plate without a switch. Enable Keychain in More Settings to add its loop.', 'Hình ảnh là plate flat keychain không có switch. Bật Keychain trong Cài đặt thêm để tạo vòng móc.')}</p>
    </div>
    <div class="prow-stacked">
      <div class="prow-header"><label for="blockKeycapHeight">${tx('Keycap height', 'Chiều cao keycap')}</label><input type="text" class="val" id="blockKeycapHeightVal" /></div>
      <input type="range" id="blockKeycapHeight" min="6" max="18" step="0.2" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header"><label for="blockKeycapCornerRadius">${tx('Keycap corner radius', 'Bán kính bo góc keycap')}</label><input type="text" class="val" id="blockKeycapCornerRadiusVal" /></div>
      <input type="range" id="blockKeycapCornerRadius" min="0.8" max="7" step="0.2" />
    </div>
  </div>

  <div class="section" id="baseStyleSection">
    <span class="label">${tx('Base style', 'Kiểu base')} ${tip(tx('Outline follows your image silhouette. Shape places the image on a preset base such as a circle or square.', 'Viền bám theo silhouette hình ảnh. Hình dạng đặt ảnh lên base có sẵn như hình tròn hoặc vuông.'))}</span>
    <div class="field">
      <div class="tabs" id="shapeTypeTabs" role="tablist" style="margin-bottom: 12px;">
        <button class="tab" data-style="outline" type="button">${tx('Outline', 'Theo đường viền')}</button>
        <button class="tab" data-style="shape" type="button">${tx('Shape', 'Hình dạng')}</button>
      </div>
    </div>
    <div class="field" id="shapeSelectField" style="margin-bottom: 12px;">
      <label for="shapeSelect">${tx('Shape geometry', 'Hình học base')} ${tip(tx('The preset base shape used when the Shape base style is selected.', 'Hình dạng base có sẵn được dùng khi chọn kiểu Hình dạng.'))}</label>
      <select id="shapeSelect">
        <option value="circle">${tx('Circle', 'Hình tròn')}</option>
        <option value="square">${tx('Square', 'Hình vuông')}</option>
        <option value="hexagon">${tx('Hexagon', 'Lục giác')}</option>
        <option value="heart">${tx('Heart', 'Trái tim')}</option>
        <option value="star">${tx('Star', 'Ngôi sao')}</option>
        <option value="egg">${tx('Egg', 'Quả trứng')}</option>
      </select>
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="width">${tx('Size', 'Kích thước')} ${tip(tx('Overall size of the clicker (its longest side, in mm). This scales the whole model proportionally, not just the width.', 'Kích thước tổng thể theo cạnh dài nhất, tính bằng mm. Toàn bộ mô hình được co giãn theo tỷ lệ.'))}</label>
        <input type="text" class="val" id="widthVal" />
      </div>
      <input type="range" id="width" min="20" max="250" step="1" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="baseHeight">${tx('Base height', 'Chiều cao base')} ${tip(tx('Height of the lower base, separate from the top profile height.', 'Chiều cao phần base dưới, tách biệt với chiều cao bề mặt trên.'))}</label>
        <input type="text" class="val" id="baseHeightVal" />
      </div>
      <input type="range" id="baseHeight" min="2" max="250" step="0.5" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="margin">${tx('Padding', 'Khoảng đệm')} ${tip(tx('The inner margin from the image edge to the outer frame base.', 'Khoảng cách từ mép hình ảnh đến khung base bên ngoài.'))}</label>
        <input type="text" class="val" id="marginVal" />
      </div>
      <input type="range" id="margin" min="0" max="250" step="0.1" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="borderwidth">${tx('Border thickness', 'Độ dày viền')} ${tip(tx('Thickness of the outer border around the image, in mm.', 'Độ dày viền ngoài quanh hình ảnh, tính bằng mm.'))}</label>
        <input type="text" class="val" id="borderwidthVal" />
      </div>
      <input type="range" id="borderwidth" min="0" max="250" step="0.1" />
    </div>
    <div class="switch-row" style="margin-top: 12px; margin-bottom: 12px;">
      <span class="switch-label">${tx('Merge base & image', 'Gộp base và hình ảnh')} ${tip(tx('Merge the top base frame and the image into one solid, or keep them separate.', 'Gộp khung base trên và hình ảnh thành một khối hoặc giữ tách rời.'))}</span>
      <label class="toggle"><input id="mergeTopFrame" type="checkbox" /><span class="slider"></span></label>
    </div>
    <div class="switch-row" id="keepMeshesRow" style="margin-bottom: 12px; padding-left: 24px; border-left: 2px solid var(--border); display: none;">
      <span class="switch-label" style="font-size: 0.85em; color: var(--muted);">${tx('Keep meshes separate', 'Giữ các mesh tách rời')} <br/><i>${tx('Preserve the original separate 3D mesh structure of the image instead of flattening it into the base.', 'Giữ cấu trúc mesh 3D riêng của hình ảnh thay vì làm phẳng vào base.')}</i></span>
      <label class="toggle" style="transform: scale(0.8);"><input id="keepMeshesSeparate" type="checkbox" /><span class="slider"></span></label>
    </div>
  </div>
`;
