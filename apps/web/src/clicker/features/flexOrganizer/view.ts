import type { FontOption } from '../../image/letter';
import {
  ORGANIZER_COPY,
  PRESETS,
  PRINTERS,
  TEXTURES,
  type OrganizerLabel,
  type OrganizerLocale,
  type OrganizerCopy,
  type OrganizerParams,
} from './model';

export interface OrganizerInfo {
  bbox: [number, number, number] | null;
  compartments: number | null;
  cellInner: [number, number] | null;
  volumeCm3: number | null;
  weightPlaG: number | null;
  triangles: number | null;
}

export interface OrganizerUiState {
  params: OrganizerParams;
  label: OrganizerLabel;
  locale: OrganizerLocale;
  theme: 'light' | 'dark';
  printerId: string;
  warnings: string[];
  status: 'idle' | 'working' | 'error';
  statusText?: string;
  hasMesh: boolean;
  hasLabelMesh: boolean;
  info: OrganizerInfo;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

function field(label: string, id: string, value: number, min: number, max: number, step: number, unit = 'mm') {
  return `<div class="org-field"><div class="org-field-head"><label for="org-${id}">${label}</label><span><output id="org-${id}-value">${value}</output>${unit ? `<i>${unit}</i>` : ''}</span></div><div class="org-field-controls"><input id="org-${id}" class="org-range" type="range" data-param="${id}" min="${min}" max="${max}" step="${step}" value="${value}"><input class="org-number" type="number" data-param="${id}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${esc(label)}"></div></div>`;
}

function section(title: string, body: string, open = true) {
  return `<details class="org-section" ${open ? 'open' : ''}><summary><span>${title}</span><span class="org-chevron" aria-hidden="true">⌄</span></summary><div class="org-section-body">${body}</div></details>`;
}

function select(id: string, label: string, value: string, options: Array<{ value: string; label: string }>) {
  return `<label class="org-select-label" for="${id}"><span>${label}</span><select id="${id}">${options.map((option) => `<option value="${esc(option.value)}" ${option.value === value ? 'selected' : ''}>${esc(option.label)}</option>`).join('')}</select></label>`;
}

function toggle(id: string, label: string, checked: boolean) {
  return `<label class="org-toggle"><span>${label}</span><input id="${id}" type="checkbox" ${checked ? 'checked' : ''}><i aria-hidden="true"></i></label>`;
}

function infoValue(value: string | number | null) {
  return value === null ? '—' : String(value);
}

function warningText(code: string, copy: OrganizerCopy): string {
  const map: Record<string, string> = {
    heightRaised: copy.height,
    widthRaised: copy.width,
    depthRaised: copy.depth,
    colsReduced: copy.cols,
    rowsReduced: copy.rows,
    radiusClamped: copy.radius,
    lipWallThin: copy.wall,
    textureClamped: copy.textureDepth,
  };
  return map[code] ?? code;
}

function renderSidebar(state: OrganizerUiState, fonts: FontOption[]): string {
  const copy = ORGANIZER_COPY[state.locale];
  const printer = PRINTERS.find((item) => item.id === state.printerId) ?? PRINTERS[1];
  return `
    <aside class="org-sidebar" id="organizerSidebar">
      <div class="org-sidebar-heading">
        <h1>${copy.title}</h1>
        <p>${copy.subtitle}</p>
      </div>
      ${section(copy.presets, `<div class="org-preset-grid">${PRESETS.map((preset) => `<button type="button" class="org-preset" data-preset="${preset.id}">${state.locale === 'vi' ? preset.labelVI : preset.labelEN}</button>`).join('')}</div>`)}
      ${section(copy.dimensions, `${field(copy.width, 'width', state.params.width, 20, 300, 1)}${field(copy.depth, 'depth', state.params.depth, 20, 300, 1)}${field(copy.height, 'height', state.params.height, 5, 150, 1)}<div class="org-field org-select-field">${select('org-printer', copy.printer, printer.id, PRINTERS.map((item) => ({ value: item.id, label: state.locale === 'vi' ? item.labelVI : item.labelEN })))}${!((state.params.width <= printer.bed[0]) && (state.params.depth <= printer.bed[1])) ? `<p class="org-banner org-banner-warn">${copy.notFits}</p>` : `<p class="org-banner org-banner-ok">${copy.fits} · ${printer.bed[0]} × ${printer.bed[1]} mm</p>`}</div>`)}
      ${section(copy.grid, `${field(copy.cols, 'cols', state.params.cols, 1, 12, 1, '')}${field(copy.rows, 'rows', state.params.rows, 1, 12, 1, '')}`)}
      ${section(copy.walls, `${field(copy.wall, 'wall', state.params.wall, 0.4, 6, 0.1)}${field(copy.floor, 'floor', state.params.floor, 0.4, 8, 0.1)}${field(copy.divider, 'divider', state.params.divider, 0.4, 6, 0.1)}`)}
      ${section(copy.style, `${field(copy.radius, 'radius', state.params.radius, 0, 15, 0.5)}${select('org-texture', copy.texture, state.params.wallTexture, TEXTURES.map((texture) => ({ value: texture.id, label: state.locale === 'vi' ? texture.labelVI : texture.labelEN })))}${state.params.wallTexture !== 'none' ? `${field(copy.textureDepth, 'textureDepth', state.params.textureDepth, 0.2, 3, 0.1)}${field(copy.textureCount, 'textureCount', state.params.textureCount, 4, 120, 1, '')}` : ''}<label class="org-color-label"><span>${copy.color}</span><input id="org-color" type="color" value="${esc(state.params.color)}"></label><div class="org-toggle-list">${toggle('org-stackingLip', copy.lip, state.params.stackingLip)}${toggle('org-labelTab', copy.tab, state.params.labelTab)}${toggle('org-fingerScoops', copy.scoops, state.params.fingerScoops)}${toggle('org-floorHoles', copy.holes, state.params.floorHoles)}</div>`)}
      ${section(copy.label, `${toggle('org-labelEnabled', copy.labelOn, state.label.enabled)}<label class="org-text-label"><span>${copy.labelText}</span><input id="org-labelText" class="org-input" type="text" maxlength="24" value="${esc(state.label.text)}"></label>${select('org-labelFont', copy.font, state.label.fontId, fonts.map((font) => ({ value: font.id, label: font.name })))}${field(copy.fontSize, 'label-fontSize', state.label.fontSize, 3, 40, 0.5, 'pt')}${field(copy.emboss, 'label-embossDepth', state.label.embossDepth, 0.2, 3, 0.1)}${field(copy.plateHeight, 'label-plateHeight', state.label.plateHeight, 6, 40, 1)}<div class="org-upload-row"><label class="org-upload">${copy.upload}<input id="org-fontUpload" type="file" accept=".ttf,.otf,.json"></label><button id="org-fontReset" class="org-small-button" type="button">${copy.reset}</button></div><div class="org-color-grid"><label class="org-color-label"><span>${copy.plateColor}</span><input id="org-plateColor" type="color" value="${esc(state.label.plateColor)}"></label><label class="org-color-label"><span>${copy.textColor}</span><input id="org-textColor" type="color" value="${esc(state.label.textColor)}"></label></div>` , false)}
      ${section(copy.info, `<div class="org-info-grid"><div><span>${copy.bbox}</span><strong id="org-info-bbox">${state.info.bbox ? state.info.bbox.join(' × ') + ' mm' : '—'}</strong></div><div><span>${copy.compartments}</span><strong id="org-info-compartments">${infoValue(state.info.compartments)}</strong></div><div><span>${copy.cellInner}</span><strong id="org-info-cell">${state.info.cellInner ? `${state.info.cellInner[0].toFixed(1)} × ${state.info.cellInner[1].toFixed(1)} mm` : '—'}</strong></div><div><span>${copy.volume}</span><strong id="org-info-volume">${state.info.volumeCm3 === null ? '—' : `${state.info.volumeCm3.toFixed(1)} cm³`}</strong></div><div><span>${copy.weight}</span><strong id="org-info-weight">${state.info.weightPlaG === null ? '—' : `${state.info.weightPlaG.toFixed(1)} g`}</strong></div><div><span>${copy.tris}</span><strong id="org-info-tris">${state.info.triangles?.toLocaleString() ?? '—'}</strong></div></div>`, true)}
      ${state.warnings.length ? `<ul class="org-warnings">${state.warnings.map((warning) => `<li>${copy.warning}: ${warningText(warning, copy)}</li>`).join('')}</ul>` : ''}
      <footer class="org-sidebar-footer"><button id="org-download" class="org-primary" type="button" ${state.hasMesh ? '' : 'disabled'}>${copy.download}</button>${state.label.enabled ? `<button id="org-downloadLabel" class="org-secondary" type="button" ${state.hasLabelMesh ? '' : 'disabled'}>${copy.downloadLabel}</button>` : ''}</footer>
    </aside>`;
}

export function renderOrganizerShell(state: OrganizerUiState, fonts: FontOption[]): string {
  const copy = ORGANIZER_COPY[state.locale];
  return `<div id="flex-organizer" class="org-shell" data-theme="${state.theme}">
    <header class="org-topbar"><a class="org-back" href="/">← ${copy.back}</a><div class="org-brand"><span class="org-brand-mark">F</span><strong>Flex Organizer</strong><span class="org-beta">3D</span></div><div class="org-top-actions"><div class="org-language" role="group" aria-label="${copy.language}"><button type="button" data-lang="vi" class="${state.locale === 'vi' ? 'active' : ''}">VI</button><button type="button" data-lang="en" class="${state.locale === 'en' ? 'active' : ''}">EN</button></div><button id="org-theme" class="org-icon-button" type="button" aria-label="${copy.theme}">${state.theme === 'dark' ? '☀' : '☾'}</button></div></header>
    <main class="org-main"><section class="org-stage"><div id="organizerViewport" class="org-viewport"></div><div id="organizerStatus" class="org-status">${state.status === 'working' ? copy.building : state.statusText ?? copy.ready}</div><div class="org-stage-hint">${copy.drag}</div></section>${renderSidebar(state, fonts)}</main>
  </div>`;
}

export { renderSidebar };
