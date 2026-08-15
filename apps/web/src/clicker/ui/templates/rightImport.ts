import { tip } from '../helpers';
import { SAMPLES } from '../../image/sample';

export const renderRightImport = () => `
  <div class="section legend-section">
    <span class="label">Import Source</span>
    <div class="import-grid" id="importTabs" role="tablist">
      <button class="import-card active" data-mode="image" type="button"><span class="card-label">Image</span></button>
      <button class="import-card" data-mode="svg" type="button"><span class="card-label">SVG</span></button>
      <button class="import-card" data-mode="icon" type="button"><span class="card-label">Icon</span></button>
      <button class="import-card" data-mode="text" type="button"><span class="card-label">Text</span></button>
      <button class="import-card" data-mode="blocks" type="button"><span class="card-label">Blocks</span></button>
      <button class="import-card" data-mode="hybrid" type="button"><span class="card-label">Image + Blocks</span></button>
    </div>

    <div id="imagePanel" class="mode-panel">
      <div class="drop" id="drop">
        <div class="drop-title">Upload image</div>
        <div class="drop-text">Drop an image, or <u>click to browse</u></div>
        <span style="font-size:10px; opacity:0.8; display:block; margin-top:4px;">PNG with transparency works best</span>
      </div>
      <input type="file" id="file" accept="image/*" hidden />
      <div class="switch-row">
        <span class="switch-label">Remove background ${tip('Automatically removes a solid background.')}</span>
        <label class="toggle"><input id="removebg" type="checkbox" /><span class="slider"></span></label>
      </div>
      <div class="switch-row">
        <span class="switch-label">Chibi style ${tip('Flatten noisy phone photos into simplified flat color regions for cute 2D output.')}</span>
        <label class="toggle"><input id="photoFlatten" type="checkbox" /><span class="slider"></span></label>
      </div>
      <span class="sample-heading">Choose a sample image</span>
      <div class="sample-inline-grid" id="sampleGrid">
        ${SAMPLES.map((s, idx) => `
          <div class="sample-inline-item" data-idx="${idx}">
            <img src="${s.src}" alt="${s.name}" />
            <span>${s.name}</span>
          </div>
        `).join('')}
      </div>

      <div class="section" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border);">
        <span class="label">Custom Base Shape (optional)</span>
        <div class="tabs" style="margin-bottom: 12px;">
          <button id="tab-base-match" class="tab active" type="button">Match Top</button>
          <button id="tab-base-custom" class="tab" type="button">Custom Image</button>
        </div>

        <div id="bottom-upload-zone" style="display: none;">
          <div class="drop" id="drop-bottom" style="min-height: 80px; padding: 16px;">
            <div class="drop-title" style="font-size: 13px;">Upload Bottom Base</div>
            <div class="drop-text" style="font-size: 11px;">Drop a silhouette image here</div>
          </div>
          <input type="file" id="file-bottom" accept="image/*" hidden />

          <div class="switch-row" style="margin-top: 10px;">
            <span class="switch-label" style="font-size: 12px;">Solid Base ${tip('Keep only the base silhouette and remove the colored artwork regions on the base.')}</span>
            <label class="toggle"><input id="bottomSolidOnly" type="checkbox" /><span class="slider"></span></label>
          </div>

          <div class="prow-stacked" style="margin-top:12px;">
            <div class="prow-header">
              <label for="baseExpand">Base expansion ${tip('Add extra margin around the base silhouette so it can wrap neatly under the top cap.')}</label>
              <input type="text" class="val" id="baseExpandVal" value="22%" />
            </div>
            <input type="range" id="baseExpand" min="0" max="100" step="1" value="22" />
          </div>

          <div style="margin-top:12px;">
            <div class="label" style="text-align:center; margin-bottom:6px; font-size:11px;">ALIGN BOTTOM BASE</div>
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
      <p class="hint-text">Drop or upload SVG vector files.</p>
      <div id="uploadGallery"></div>
      <label class="upload-cta">Upload SVG file(s)<input id="svgUpload" type="file" accept=".svg,image/svg+xml" multiple /></label>
      <div class="switch-row">
        <span class="switch-label">Remove background</span>
        <label class="toggle"><input id="removebgSvg" type="checkbox" /><span class="slider"></span></label>
      </div>
      <button class="primary" id="generateSvg" style="margin-top: 10px; width: 100%;">Generate</button>
    </div>

    <div id="iconPanel" class="mode-panel" hidden>
      <div id="iconSearchWrap">
        <input id="iconSearch" type="search" placeholder="Search Lucide icons…" autocomplete="off" spellcheck="false" />
        <button id="iconSearchClear" type="button" aria-label="Clear icon search">×</button>
      </div>
      <div id="iconCount"></div>
      <div id="gallery"></div>
      <button class="primary" id="generateIcon" style="margin-top: 10px; width: 100%;">Generate</button>
    </div>

    <div id="letterPanel" class="mode-panel" hidden>
      <div class="field" id="textOnlyField">
        <label for="letterText">Custom Text</label>
        <textarea id="letterText" rows="2" maxlength="30" style="width: 100%; min-height: 48px;">Custom
Text</textarea>
      </div>
      <div class="field" id="blocksTextField" hidden>
        <label for="blocksText">Text</label>
        <textarea id="blocksText" rows="1" maxlength="24" style="width: 100%; resize: none; min-height: 34px;">Name</textarea>
      </div>
      <div class="field" id="blocksChainField" hidden>
        <label>Add symbol or emoji</label>
        <p class="hint-text" style="margin: 0 0 6px;">Each character becomes one printed block. Edit the text above to change the chain.</p>
        <div id="blockChips" class="block-chips"></div>
      </div>
      <div class="field">
        <label>Font</label>
        <div id="fontGrid" class="font-grid"></div>
        <label class="upload">+ Import font<input id="fontUpload" type="file" accept=".ttf,.otf,.json" /></label>
      </div>
      <button class="primary" id="generateText" style="margin-top: 10px; width: 100%;">Generate</button>
    </div>
  </div>
`;
