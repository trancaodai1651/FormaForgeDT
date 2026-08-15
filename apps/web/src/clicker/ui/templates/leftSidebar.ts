import { ASSET_BASE } from '../constants';
import { tip } from '../helpers';

export const renderLeftSidebar = () => `
  <div class="app-header">
    <button id="btnBackHome" class="btn-back-home">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      Dashboard
    </button>
    <h1>Clicker Generator</h1>
    <p class="app-subtitle">Generate printable 3D model of a clicker from an image</p>
    <p class="app-credit">Made by
      <a class="app-credit-link" href="https://makerworld.com/en/@Vostok_Labs" target="_blank" rel="noopener noreferrer">
        <img class="credit-logo only-dark" src="${ASSET_BASE}assets/favicon/vostokfaviconwhite.png" alt="" aria-hidden="true" />
        <img class="credit-logo only-light" src="${ASSET_BASE}assets/favicon/Vostokfaviconblack.png" alt="" aria-hidden="true" />
        Vostok Labs
      </a>
    </p>
  </div>

  <div class="section" id="previewViewSection">
    <span class="label">Preview &amp; View</span>
    <div class="tabs" id="viewTabs" role="tablist" style="margin-bottom: 12px;">
      <button class="tab active" data-view="assembled" type="button">Assembled</button>
      <button class="tab" data-view="exploded" type="button">Exploded</button>
    </div>
    <div class="switch-row">
      <span class="switch-label">Show MX switch ${tip('Shows a reference MX switch in the preview so you can check the fit. It is not part of the exported model.')}</span>
      <label class="toggle"><input id="showswitch" type="checkbox" /><span class="slider"></span></label>
    </div>
  </div>

  <div class="section" id="blocksSection" hidden>
    <span class="label">Blocks</span>
    <div class="field">
      <label>Layout</label>
      <div class="tabs" id="blockOrient" role="tablist">
        <button class="tab active" data-orient="horizontal" type="button">Horizontal</button>
        <button class="tab" data-orient="vertical" type="button">Vertical</button>
      </div>
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="legendSize">Letter size</label>
        <input type="text" class="val" id="legendSizeVal" />
      </div>
      <input type="range" id="legendSize" min="0.5" max="1.4" step="0.05" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="legendBold">Boldness</label>
        <input type="text" class="val" id="legendBoldVal" />
      </div>
      <input type="range" id="legendBold" min="-0.3" max="0.8" step="0.05" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="blockKeycapGap">Base ↔ keycap gap</label>
        <input type="text" class="val" id="blockKeycapGapVal" />
      </div>
      <input type="range" id="blockKeycapGap" min="0" max="3" step="0.1" />
    </div>
    <div class="switch-row">
      <span class="switch-label">Flat underside</span>
      <label class="toggle"><input id="blockFlatBottom" type="checkbox" /><span class="slider"></span></label>
    </div>
    <div class="label" style="margin-top: 16px;">Base geometry</div>
    <div class="prow-stacked">
      <div class="prow-header"><label for="blockBaseHeight">Base height</label><input type="text" class="val" id="blockBaseHeightVal" /></div>
      <input type="range" id="blockBaseHeight" min="8" max="30" step="0.5" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header"><label for="blockModuleThickness">Module/base thickness</label><input type="text" class="val" id="blockModuleThicknessVal" /></div>
      <input type="range" id="blockModuleThickness" min="8" max="40" step="0.5" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header"><label for="blockModuleSideThickness">Module side-wall thickness</label><input type="text" class="val" id="blockModuleSideThicknessVal" /></div>
      <input type="range" id="blockModuleSideThickness" min="0" max="33" step="0.25" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header"><label for="blockBaseCornerRadius">Base corner radius</label><input type="text" class="val" id="blockBaseCornerRadiusVal" /></div>
      <input type="range" id="blockBaseCornerRadius" min="0.5" max="8" step="0.25" />
    </div>
    <div class="label" style="margin-top: 16px;">Keycap geometry</div>
    <div class="field">
      <label>Keycap shape</label>
      <div class="tabs" id="blockKeycapShape" role="tablist">
        <button class="tab active" data-keycap-shape="rounded" type="button">Rounded</button>
        <button class="tab" data-keycap-shape="square" type="button">Square</button>
      </div>
    </div>
    <div class="field">
      <label>Keycap seating</label>
      <div class="tabs" id="blockKeycapMount" role="tablist">
        <button class="tab" data-keycap-mount="recessed" type="button">Recessed in base</button>
        <button class="tab active" data-keycap-mount="above" type="button">Above base</button>
      </div>
    </div>
    <div class="field">
      <label for="blockKeycapProfile">Keycap profile</label>
      <select id="blockKeycapProfile">
        <option value="standard">Standard profile</option>
        <option value="low">Low profile</option>
        <option value="thocky">Thocky profile</option>
        <option value="choc-v1">Choc v1</option>
      </select>
    </div>
    <div class="field">
      <label for="blockKeySize">Key size</label>
      <select id="blockKeySize">
        <option value="1">1u</option>
        <option value="1.25">1.25u</option>
        <option value="1.5">1.5u</option>
        <option value="1.75">1.75u</option>
        <option value="2">2u (1 stem)</option>
        <option value="2.25">2.25u</option>
        <option value="2.75">2.75u</option>
        <option value="6">6u Spacebar</option>
        <option value="6.25">6.25u Spacebar</option>
        <option value="6.5">6.5u Spacebar</option>
      </select>
    </div>
    <div class="switch-row" id="hybridSquareModuleRow">
      <span class="switch-label">Square block sides</span>
      <label class="toggle"><input id="hybridSquareModuleBase" type="checkbox" checked /><span class="slider"></span></label>
    </div>
    <div class="prow-stacked" id="hybridImageSizeRow">
      <div class="prow-header"><label for="hybridImageSize">Size</label><input type="text" class="val" id="hybridImageSizeVal" /></div>
      <input type="range" id="hybridImageSize" min="20" max="100" step="1" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header"><label for="blockKeycapHeight">Keycap height</label><input type="text" class="val" id="blockKeycapHeightVal" /></div>
      <input type="range" id="blockKeycapHeight" min="6" max="18" step="0.2" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header"><label for="blockKeycapThickness">Keycap lip thickness</label><input type="text" class="val" id="blockKeycapThicknessVal" /></div>
      <input type="range" id="blockKeycapThickness" min="0.8" max="4" step="0.1" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header"><label for="blockKeycapCornerRadius">Keycap corner radius</label><input type="text" class="val" id="blockKeycapCornerRadiusVal" /></div>
      <input type="range" id="blockKeycapCornerRadius" min="0.8" max="7" step="0.2" />
    </div>
  </div>

  <div class="section" id="baseStyleSection">
    <span class="label">Base style ${tip('Outline follows your image silhouette. Shape places the image on a preset base such as a circle or square.')}</span>
    <div class="field">
      <div class="tabs" id="shapeTypeTabs" role="tablist" style="margin-bottom: 12px;">
        <button class="tab" data-style="outline" type="button">Outline</button>
        <button class="tab" data-style="shape" type="button">Shape</button>
      </div>
    </div>
    <div class="field" id="shapeSelectField" style="margin-bottom: 12px;">
      <label for="shapeSelect">Shape geometry ${tip('The preset base shape used when the Shape base style is selected.')}</label>
      <select id="shapeSelect">
        <option value="circle">Circle</option>
        <option value="square">Square</option>
        <option value="hexagon">Hexagon</option>
        <option value="heart">Heart</option>
        <option value="star">Star</option>
        <option value="egg">Egg</option>
      </select>
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="width">Size ${tip('Overall size of the clicker (its longest side, in mm). This scales the whole model proportionally, not just the width.')}</label>
        <input type="text" class="val" id="widthVal" />
      </div>
      <input type="range" id="width" min="20" max="250" step="1" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="baseHeight">Base height ${tip('Height of the lower base, separate from the top profile height.')}</label>
        <input type="text" class="val" id="baseHeightVal" />
      </div>
      <input type="range" id="baseHeight" min="2" max="250" step="0.5" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="margin">Padding ${tip('The inner margin from the image edge to the outer frame base.')}</label>
        <input type="text" class="val" id="marginVal" />
      </div>
      <input type="range" id="margin" min="0" max="250" step="0.1" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="borderwidth">Border thickness ${tip('Thickness of the outer border around the image, in mm.')}</label>
        <input type="text" class="val" id="borderwidthVal" />
      </div>
      <input type="range" id="borderwidth" min="0" max="250" step="0.1" />
    </div>
    <div class="switch-row" style="margin-top: 12px; margin-bottom: 12px;">
      <span class="switch-label">Merge base &amp; image ${tip('Merge the top base frame and the image into one solid, or keep them separate.')}</span>
      <label class="toggle"><input id="mergeTopFrame" type="checkbox" /><span class="slider"></span></label>
    </div>
    <div class="switch-row" id="keepMeshesRow" style="margin-bottom: 12px; padding-left: 24px; border-left: 2px solid var(--border); display: none;">
      <span class="switch-label" style="font-size: 0.85em; color: var(--muted);">Keep meshes separate <br/><i>Preserve the original separate 3D mesh structure of the image instead of flattening it into the base.</i></span>
      <label class="toggle" style="transform: scale(0.8);"><input id="keepMeshesSeparate" type="checkbox" /><span class="slider"></span></label>
    </div>
  </div>
`;
