import { getClickerDocument } from '../../runtime';
import type { UiState, UiCallbacks } from '../types';
import { $, hexRgb, rgbHex } from '../helpers';
import { appData } from '../../store/appState';
import { extrudeLayerColor } from '../../geometry/extrudeLayers';
import { clickerText as tx } from '../../i18n';

export function renderExtrudeLayersPanel() {
  return `<div class="section" id="extrudeLayersSection">
    <span class="label">${tx('Extrude layer colors', 'Màu từng tầng Extrude')}</span>
    <div class="switch-row"><span class="switch-label">${tx('Color by Extrude level', 'Tô màu theo tầng Extrude')}</span>
      <label class="toggle"><input id="extrudeLayersEnabled" type="checkbox"/><span class="slider"></span></label></div>
    <div id="extrudeLayersControls" hidden>
      <div class="switch-row"><span class="switch-label">${tx('Mixed colors within each layer', 'Xen kẽ màu trong từng tầng')}</span>
        <label class="toggle"><input id="extrudeLayersMixed" type="checkbox"/><span class="slider"></span></label></div>
      <p class="hint">${tx('Each +1 adds one material layer above the original face. Set a shared color below. Expand a layer or click the model in Color mode to paint a region when mixed colors are enabled.', 'Mỗi +1 thêm một tầng vật liệu trên mặt gốc. Chọn màu chung bên dưới. Bật xen kẽ rồi mở từng tầng hoặc bấm vùng trên mô hình ở chế độ Color để đổi màu riêng.')}</p>
      <div id="extrudeLayersList"></div>
      <button type="button" class="btn" id="resetExtrudeLayerOverrides">${tx('Reset regional colors', 'Xóa màu riêng của các vùng')}</button>
    </div>
  </div>`;
}

export function setupExtrudeLayers(cb: UiCallbacks) {
  $('extrudeLayersEnabled')?.addEventListener('change', e => cb.onExtrudeLayerEnabled((e.target as HTMLInputElement).checked));
  $('extrudeLayersMixed')?.addEventListener('change', e => cb.onExtrudeLayerMixed((e.target as HTMLInputElement).checked));
  $('resetExtrudeLayerOverrides')?.addEventListener('click', cb.onResetExtrudeLayerOverrides);
  $('extrudeLayersList')?.addEventListener('change', e => {
    const select = e.target as HTMLSelectElement;
    if (!select.matches('[data-existing-extrude-color]')) return;
    cb.onExtrudeLayerColor(Number(select.dataset.level), select.value, select.dataset.region);
  });
}

// Keep native color pickers and expanded rows stable during worker/status updates.
let previousKey = '';
export function updateExtrudeLayers(state: UiState) {
  const config = state.extrudeLayerColors;
  const enabled = $<HTMLInputElement>('extrudeLayersEnabled');
  if (!enabled) return;
  enabled.checked = config.enabled;
  $<HTMLInputElement>('extrudeLayersMixed').checked = config.mixed;
  $('extrudeLayersControls').hidden = !config.enabled;
  $('resetExtrudeLayerOverrides').hidden = !config.mixed;
  const colorsByHex = new Map<string, [number, number, number]>();
  const addColor = (rgb: [number, number, number]) => colorsByHex.set(rgbHex(rgb).toLowerCase(), rgb);
  appData.latestParts.forEach(part => addColor(part.colorRgb));
  state.palette.forEach(entry => addColor(entry.filamentRgb));
  const usedColors = [...colorsByHex.entries()];
  const bands = appData.latestParts.flatMap(part => {
    const actual = part.extrudeLayer ? [part.extrudeLayer] : [];
    const origin = part.extrudeOrigin;
    if (!origin || !part.extrudeRegions?.length) return actual;
    const step = Math.max(0.1, origin.stepMm);
    const available = part.extrudeRegions.flatMap(region => {
      const maxLevel = Math.ceil((region.topZ - origin.bottomZ) / step - 1e-5);
      return Array.from({ length: Math.max(0, maxLevel) }, (_, index) => ({
        level: index + 1, regionName: region.name,
      }));
    });
    return [...actual, ...available];
  });
  const key = JSON.stringify([config, bands, usedColors]);
  const list = $('extrudeLayersList');
  if (key === previousKey && list.childElementCount) return;
  previousKey = key;
  const open = new Set([...list.querySelectorAll('details[open]')].map(el => (el as HTMLElement).dataset.level));
  list.replaceChildren();
  const colorPicker = (rgb: [number, number, number], level: number, region?: string) => {
    const select = getClickerDocument().createElement('select');
    const selectedHex = rgbHex(rgb).toLowerCase();
    select.dataset.existingExtrudeColor = '';
    select.dataset.level = String(level);
    if (region) select.dataset.region = region;
    select.setAttribute('aria-label', region ? `Choose an existing color for Extrude +${level}, ${region}` : `Choose an existing color for Extrude +${level}`);
    select.title = tx('Choose a color already used in this model', 'Chọn màu đang được dùng trong mô hình');
    select.style.cssText = `width:76px;height:30px;padding:2px 4px;border:1px solid var(--border);border-radius:6px;background:${selectedHex};color:${(rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) < 145 ? '#fff' : '#171717'};cursor:pointer;flex:none`;
    if (!usedColors.some(([hex]) => hex === selectedHex)) {
      const current = getClickerDocument().createElement('option');
      current.value = selectedHex; current.textContent = `${tx('Current', 'Đang chọn')} ${selectedHex}`;
      current.disabled = true; current.hidden = true; current.selected = true;
      select.append(current);
    }
    for (const [hex] of usedColors) {
      const option = getClickerDocument().createElement('option');
      option.value = hex; option.textContent = hex.toUpperCase();
      option.style.backgroundColor = hex;
      const [red, green, blue] = hexRgb(hex);
      option.style.color = (red * 0.299 + green * 0.587 + blue * 0.114) < 145 ? '#fff' : '#171717';
      option.selected = hex === selectedHex;
      select.append(option);
    }
    if (!usedColors.length) {
      const empty = getClickerDocument().createElement('option');
      empty.value = selectedHex; empty.textContent = tx('No model colors yet', 'Chưa có màu mô hình');
      empty.disabled = true; empty.selected = true;
      select.append(empty);
    }
    return select;
  };
  const count = Math.max(6, ...Object.keys(config.colors).map(Number), ...bands.map(band => band.level));
  for (let level = 1; level <= count; level++) {
    const details = getClickerDocument().createElement('details');
    details.dataset.level = String(level); details.open = open.has(String(level));
    details.style.marginBottom = '8px';
    const summary = getClickerDocument().createElement('summary');
    summary.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px;border:1px solid var(--border);border-radius:8px;cursor:pointer';
    const label = getClickerDocument().createElement('span');
    label.textContent = `Extrude +${level}`; label.style.flex = '1';
    summary.append(label, colorPicker(extrudeLayerColor({ ...config, mixed: false }, level, ''), level));
    summary.addEventListener('click', e => {
      if (!config.mixed && !(e.target as HTMLElement).closest('[data-existing-extrude-color]')) e.preventDefault();
    });
    details.append(summary);
    if (config.mixed) {
      const regions = [...new Set(bands.filter(b => b.level === level).map(b => b.regionName))];
      for (const [regionIndex, region] of regions.entries()) {
        const row = getClickerDocument().createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 12px;font-size:12px';
        const regionLabel = getClickerDocument().createElement('span');
        regionLabel.textContent = `${tx('Region', 'Vùng')} ${regionIndex + 1}`;
        row.append(regionLabel, colorPicker(extrudeLayerColor(config, level, region), level, region));
        details.append(row);
      }
      if (!regions.length) {
        const hint = getClickerDocument().createElement('p'); hint.className = 'hint';
        hint.textContent = tx('Extrude a region to this level to edit its color.', 'Đùn một vùng tới tầng này để chỉnh màu riêng.');
        details.append(hint);
      }
    } else summary.addEventListener('click', e => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); });
    list.append(details);
  }
}
