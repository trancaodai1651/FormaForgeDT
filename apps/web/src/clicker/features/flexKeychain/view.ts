import type { FlexKeychainConfig } from './model';
import { splitName } from './model';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch);
}

export function renderFlexKeychain(config: FlexKeychainConfig, built: boolean, status: string): string {
  const chars = splitName(config.name);
  return `
    <div class="flex-shell">
      <header class="flex-topbar"><a class="flex-back" href="./">← Workspace</a><div class="flex-brand"><span class="flex-brand-mark">⌘</span><strong>Flex Keychain Text</strong><span class="flex-beta">source STL</span></div><button id="flexTheme" class="flex-icon-button" type="button" title="Toggle dark mode">◐</button></header>
      <main class="flex-main">
        <section class="flex-stage"><div id="flexViewport" class="flex-viewport"></div><div class="flex-stage-hint">Drag to orbit · Scroll to zoom · Click a part to inspect</div><div id="flexStatus" class="flex-status">${escapeHtml(status || 'Ready')}</div></section>
        <aside class="flex-sidebar">
          <div class="flex-sidebar-title"><h1>Flex Keychain Text</h1><p>Build the same pre-cut base and keycap structures as the reference site.</p></div>
          <section class="flex-card"><div class="flex-card-title">Preview</div><div class="flex-segment"><button id="flexAssembled" class="active" type="button">Assembled</button><button id="flexExploded" type="button">Exploded</button></div><label class="flex-toggle-row"><span>Show switch preview</span><input id="flexShowSwitch" type="checkbox" ${config.showSwitch ? 'checked' : ''}/><i></i></label><div class="flex-segment compact"><button id="flexPhysical" class="${config.switchStyle === 'physical' ? 'active' : ''}" type="button">Physical</button><button id="flexPrinted" class="${config.switchStyle === 'printed' ? 'active' : ''}" type="button">3D-printed</button></div></section>
          <section class="flex-card"><div class="flex-card-title">Text</div><input id="flexName" class="flex-input flex-name-input" type="text" maxlength="10" value="${escapeHtml(config.name)}" placeholder="TYPE A NAME"/><div id="flexNameStatus" class="flex-help">${chars.length} printable slots · max 10 characters</div></section>
          <section class="flex-card"><div class="flex-card-title">Base</div><div class="flex-segment"><button id="flexCompact" class="${config.baseType === 'compact' ? 'active' : ''}" type="button">Compact</button><button id="flexModular" class="${config.baseType === 'modular' ? 'active' : ''}" type="button">Modular</button></div><div id="flexModularStyles" class="flex-segment compact ${config.baseType === 'modular' ? '' : 'hidden'}"><button id="flexBubbly" class="${config.modularStyle === 'bubbly' ? 'active' : ''}" type="button">Bubbly</button><button id="flexBubblyV2" class="${config.modularStyle === 'bubbly-v2' ? 'active' : ''}" type="button">Bubbly V2</button></div><div class="flex-two"><label class="flex-select-label">Layout<select id="flexLayout"><option value="horizontal" ${!config.vertical ? 'selected' : ''}>Horizontal</option><option value="vertical" ${config.vertical ? 'selected' : ''}>Vertical</option></select></label><label class="flex-color-label">Color<input id="flexBaseColor" type="color" value="${config.baseColor}"/></label></div><div class="flex-help">Socket openings, module walls, lip, underside and corner profile come directly from the source base STL.</div>${config.baseType === 'modular' ? '<div class="flex-help">Click a module in the preview to separate or reconnect the modular chain.</div>' : ''}</section>
          <section class="flex-card"><div class="flex-card-title">Typeface</div><select id="flexFont" class="flex-input"></select><div class="flex-upload-row"><label class="flex-upload">Import font<input id="flexFontUpload" type="file" accept=".ttf,.otf,.woff,.json"/></label></div><div class="flex-help">Built-in letters use the exact raised-glyph STL from the reference site.</div></section>
          <section class="flex-card"><div class="flex-card-title">Keycap source</div><div class="flex-help">The shell, MX opening, lower structure and raised legend are loaded as the reference web's separate body/glyph meshes.</div><div class="flex-two"><label class="flex-color-label">Keycap color<input id="flexCapColor" type="color" value="${config.capColor}"/></label><label class="flex-color-label">Legend color<input id="flexGlyphColor" type="color" value="${config.glyphColor}"/></label></div></section>
          <section class="flex-card"><div class="flex-card-title">Slots <span id="flexSlotCount">${chars.length}</span></div><div id="flexSlots" class="flex-slots"></div></section>
          <section class="flex-card flex-export-card"><button id="flexExport3mf" class="flex-primary" type="button" ${built ? '' : 'disabled'}>Export Bambu 3MF (colors)</button><button id="flexExportStl" class="flex-secondary" type="button" ${built ? '' : 'disabled'}>Export STL zip</button><div class="flex-help">Export keeps base, keycap body and raised glyphs as separate printable parts.</div></section>
        </aside>
      </main>
    </div>`;
}

export function renderFlexSlots(config: FlexKeychainConfig): string {
  const chars = splitName(config.name);
  return chars.map((ch, index) => {
    const slot = config.slots[index];
    return `<div class="flex-slot-row" data-slot="${index}"><span class="flex-slot-char">${escapeHtml(ch)}</span><select data-slot-field="blank" aria-label="Cap body for ${escapeHtml(ch)}"><option value="false" ${!slot?.blank ? 'selected' : ''}>Source cap</option><option value="true" ${slot?.blank ? 'selected' : ''}>Blank cap</option></select><input data-slot-field="capColor" type="color" value="${slot?.capColorRgb ? `#${slot.capColorRgb.map((v) => v.toString(16).padStart(2, '0')).join('')}` : config.capColor}" title="Cap color"/><input data-slot-field="glyphColor" type="color" value="${slot?.glyphColorRgb ? `#${slot.glyphColorRgb.map((v) => v.toString(16).padStart(2, '0')).join('')}` : config.glyphColor}" title="Legend color" ${slot?.blank ? 'disabled' : ''}/></div>`;
  }).join('') || '<div class="flex-help">Type a name to add slots.</div>';
}
