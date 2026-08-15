import { blockColors, estimateBlocksSize, splitBlocksText, type BlocksConfig } from './model';

export interface BlocksViewModel {
  config: BlocksConfig;
  exploded?: boolean;
  showSwitch?: boolean;
  hasParts?: boolean;
}

export function renderBlocksScreen(vm: BlocksViewModel) {
  const { config } = vm;
  const { width, height } = estimateBlocksSize(config);
  const chars = splitBlocksText(config.name);
  const colors = blockColors(chars.length);

  return `
    <div class="blocks-shell">
      <div id="blocks-layout">
        <aside class="sidebar blocks-sidebar blocks-sidebar-left">
          <header class="blocks-header">
            <button class="secondary" id="blocksBack">← Back</button>
            <div>
              <h1>Blocks Builder</h1>
              <p>Text blocks with separate letters, inspired by the Blocks import flow.</p>
            </div>
          </header>

          <section class="blocks-panel">
            <div class="blocks-preview-toggle" role="group" aria-label="Preview mode">
              <button class="blocks-preview-button ${vm.exploded ? '' : 'active'}" id="blocksAssembled" type="button">Assembled</button>
              <button class="blocks-preview-button ${vm.exploded ? 'active' : ''}" id="blocksExploded" type="button">Exploded</button>
            </div>
            <label class="blocks-switch-toggle" for="blocksShowSwitch">
              <span>Show MX switch</span>
              <input id="blocksShowSwitch" type="checkbox" ${vm.showSwitch === false ? '' : 'checked'} />
            </label>
            <div class="blocks-mode-tabs" role="tablist" aria-label="Blocks mode">
              <button class="blocks-mode-tab active" type="button" data-blockmode="text">Text</button>
              <button class="blocks-mode-tab" type="button" data-blockmode="blocks">Blocks</button>
            </div>

            <div class="blocks-import-grid">
              <button class="blocks-import-card active" type="button" data-importsource="text">
                <span class="blocks-import-icon">T</span>
                <span class="blocks-import-label">Text</span>
              </button>
              <button class="blocks-import-card" type="button" data-importsource="blocks">
                <span class="blocks-import-icon">▭</span>
                <span class="blocks-import-label">Blocks</span>
              </button>
            </div>

            <div class="field">
              <label for="blocksName">Name</label>
              <input id="blocksName" type="text" value="${config.name}" placeholder="NAME" />
            </div>
            <div class="field">
              <label for="blocksVertical">Layout</label>
              <select id="blocksVertical">
                <option value="vertical" ${config.vertical ? 'selected' : ''}>Vertical</option>
                <option value="horizontal" ${!config.vertical ? 'selected' : ''}>Horizontal</option>
              </select>
            </div>
            <div class="field">
              <label for="blocksSeparate">Separate letters</label>
              <select id="blocksSeparate">
                <option value="true" ${config.separateLetters ? 'selected' : ''}>On</option>
                <option value="false" ${!config.separateLetters ? 'selected' : ''}>Off</option>
              </select>
            </div>
            <div class="field">
              <label for="blocksFontSize">Font size</label>
              <input id="blocksFontSize" type="range" min="8" max="40" step="1" value="${config.fontSize}" />
            </div>
            <div class="field">
              <label for="blocksGap">Block gap</label>
              <input id="blocksGap" type="range" min="0" max="12" step="0.1" value="${config.blockGapMm}" />
            </div>
            <div class="field">
              <label for="blocksRadius">Corner radius</label>
              <input id="blocksRadius" type="range" min="0" max="12" step="0.1" value="${config.cornerRadiusMm}" />
            </div>
            <div class="field">
              <label for="blocksWidth">Block width</label>
              <input id="blocksWidth" type="range" min="8" max="60" step="1" value="${config.blockWidthMm}" />
            </div>
            <div class="field">
              <label for="blocksHeight">Block height</label>
              <input id="blocksHeight" type="range" min="8" max="60" step="1" value="${config.blockHeightMm}" />
            </div>
            <div class="field">
              <label for="blocksDepth">Block depth</label>
              <input id="blocksDepth" type="range" min="2" max="20" step="0.5" value="${config.blockDepthMm}" />
            </div>
            <div class="blocks-stats">
              <span>${chars.length} blocks</span>
              <span>${width.toFixed(1)} x ${height.toFixed(1)} mm</span>
            </div>
            <div class="blocks-mini-help">
              <span>Each character becomes its own block.</span>
            </div>
            <div class="blocks-export-row">
              <button class="primary" id="blocksExport" type="button" ${vm.hasParts ? '' : 'disabled'}>Download 3MF</button>
              <button class="primary" id="blocksExportStl" type="button" ${vm.hasParts ? '' : 'disabled'}>Download STL</button>
            </div>
          </section>
        </aside>

        <section class="blocks-stage">
          <div class="blocks-viewport-shell">
            <div class="blocks-viewport" id="blocksViewport"></div>
          </div>
        </section>

        <aside class="sidebar blocks-sidebar">
          <section class="blocks-panel">
            <div class="field">
              <label>Blocks</label>
            </div>
            <div class="blocks-slot-list">
              ${chars.map((ch, index) => `
                <div class="blocks-slot-row">
                  <span class="slot-pill">${ch}</span>
                  <span class="slot-name">${ch} block</span>
                  <span class="slot-swatch" style="background: rgb(${colors[index].join(',')})"></span>
                  <span class="slot-swatch white"></span>
                </div>
              `).join('')}
            </div>
          </section>
        </aside>
      </div>
    </div>
  `;
}
