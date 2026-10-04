import { getClickerDocument } from '../../runtime';
import type { UiState, UiCallbacks } from '../types';
import { $, rgbHex } from '../helpers';
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
    const input = e.target as HTMLInputElement;
    if (input.type === 'color') cb.onExtrudeLayerColor(Number(input.dataset.level), input.value, input.dataset.region);
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
  const key = JSON.stringify([config, bands]);
  const list = $('extrudeLayersList');
  if (key === previousKey && list.childElementCount) return;
  previousKey = key;
  const open = new Set([...list.querySelectorAll('details[open]')].map(el => (el as HTMLElement).dataset.level));
  list.replaceChildren();
  const count = Math.max(6, ...Object.keys(config.colors).map(Number), ...bands.map(band => band.level));
  for (let level = 1; level <= count; level++) {
    const details = getClickerDocument().createElement('details');
    details.dataset.level = String(level); details.open = open.has(String(level));
    details.style.marginBottom = '8px';
    const summary = getClickerDocument().createElement('summary');
    summary.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px;border:1px solid var(--border);border-radius:8px;cursor:pointer';
    const label = getClickerDocument().createElement('span');
    label.textContent = `Extrude +${level}`; label.style.flex = '1';
    const colorInput = (rgb: [number, number, number], region?: string) => {
      const input = getClickerDocument().createElement('input');
      input.type = 'color'; input.value = rgbHex(rgb); input.dataset.level = String(level);
      if (region) input.dataset.region = region;
      input.setAttribute('aria-label', region ? `Extrude +${level}: ${region}` : `Extrude +${level} color`);
      input.style.cssText = 'width:40px;height:28px;padding:0;border:0;background:transparent;cursor:pointer';
      input.addEventListener('click', e => e.stopPropagation());
      return input;
    };
    summary.append(label, colorInput(extrudeLayerColor({ ...config, mixed: false }, level, '')));
    details.append(summary);
    if (config.mixed) {
      const regions = [...new Set(bands.filter(b => b.level === level).map(b => b.regionName))];
      for (const [regionIndex, region] of regions.entries()) {
        const row = getClickerDocument().createElement('label');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 12px;font-size:12px';
        const regionLabel = getClickerDocument().createElement('span');
        regionLabel.textContent = `${tx('Region', 'Vùng')} ${regionIndex + 1}`;
        row.append(regionLabel, colorInput(extrudeLayerColor(config, level, region), region));
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
