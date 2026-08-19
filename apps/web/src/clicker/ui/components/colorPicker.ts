import { getClickerDocument } from '../../runtime';
import { $, rgbHex, hexRgb } from '../helpers';
import type { PaletteEntry, RGB, UiCallbacks } from '../types';
import { FILAMENTS } from '../../types';

const rgbText = (rgb: RGB) => `RGB(${rgb.join(', ')})`;

export function getFilamentNameAndHex(rgb: RGB): [string, string] {
  let bestHex = rgbHex(rgb), bestName = 'Custom Color', bestD = Infinity;
  for (const [name, hex] of FILAMENTS) {
    const [fr, fg, fb] = hexRgb(hex);
    const d = (rgb[0] - fr) ** 2 + (rgb[1] - fg) ** 2 + (rgb[2] - fb) ** 2;
    if (d < bestD) { bestD = d; bestHex = hex; bestName = name; }
  }
  return [bestName, bestHex];
}

export function showColorPopoverAt(
  clientX: number, clientY: number, currentHex: string, options: RGB[],
  handlers: { onSelect: (hex: string) => void; onClose?: () => void }
) {
  getClickerDocument().getElementById('sbColorPopover')?.remove();
  const popover = getClickerDocument().createElement('div');
  popover.id = 'sbColorPopover'; popover.className = 'color-popover';
  getClickerDocument().body.appendChild(popover);

  let done = false;
  const close = () => { if (done) return; done = true; popover.remove(); getClickerDocument().removeEventListener('mousedown', dismiss); handlers.onClose?.(); };

  options.forEach((rgb) => {
    const hex = rgbHex(rgb), [name] = getFilamentNameAndHex(rgb);
    const btn = getClickerDocument().createElement('button');
    btn.type = 'button'; btn.style.background = hex; btn.title = name;
    if (hex.toLowerCase() === currentHex.toLowerCase()) btn.classList.add('active');
    btn.addEventListener('click', () => { handlers.onSelect(hex); close(); });
    popover.appendChild(btn);
  });

  const custom = getClickerDocument().createElement('label');
  custom.className = 'cp-custom'; custom.title = 'Custom color (RGB)';
  const inp = getClickerDocument().createElement('input');
  inp.type = 'color'; inp.value = /^#[0-9a-f]{6}$/i.test(currentHex) ? currentHex : '#888888';
  const title = getClickerDocument().createElement('span');
  title.className = 'cp-custom-title';
  title.textContent = 'Custom RGB color';
  custom.appendChild(title);
  const editor = getClickerDocument().createElement('div');
  editor.className = 'cp-rgb-editor';
  const readout = getClickerDocument().createElement('output');
  readout.className = 'cp-rgb-readout';
  const fields: HTMLInputElement[] = [];
  const setFields = (rgb: RGB) => {
    fields.forEach((field, index) => { field.value = String(rgb[index]); });
    readout.textContent = rgbText(rgb);
  };
  const currentRgb = hexRgb(inp.value);
  (['R', 'G', 'B'] as const).forEach((channel, index) => {
    const field = getClickerDocument().createElement('input');
    field.type = 'number'; field.min = '0'; field.max = '255'; field.step = '1';
    field.className = 'cp-rgb-field'; field.dataset.channel = channel;
    field.setAttribute('aria-label', `${channel} channel`);
    field.addEventListener('input', () => {
      const next: RGB = fields.map((item) => Math.max(0, Math.min(255, Math.round(Number(item.value) || 0)))) as RGB;
      const nextHex = rgbHex(next);
      inp.value = nextHex;
      setFields(next);
      handlers.onSelect(nextHex);
    });
    fields.push(field);
    editor.appendChild(field);
  });
  setFields(currentRgb);
  inp.addEventListener('input', () => {
    const next = hexRgb(inp.value);
    setFields(next);
    handlers.onSelect(inp.value);
  });
  custom.appendChild(inp); popover.appendChild(custom);
  custom.appendChild(editor);
  custom.appendChild(readout);

  const w = popover.offsetWidth || 170, h = popover.offsetHeight || 180;
  popover.style.left = `${Math.max(8, Math.min(clientX, window.innerWidth - w - 8))}px`;
  popover.style.top = `${Math.max(8, Math.min(clientY, window.innerHeight - h - 8))}px`;

  const dismiss = (e: MouseEvent) => { if (!popover.contains(e.target as Node)) close(); };
  setTimeout(() => getClickerDocument().addEventListener('mousedown', dismiss), 50);
}

export function renderPalette(palette: PaletteEntry[], bodyColorRgb: RGB, cb: UiCallbacks, colorMode?: 'normal' | 'limited', limitedColors?: RGB[]) {
  const pal = $('palette');
  if (!pal) return;
  pal.innerHTML = '';

  const chipsToRender: [string, string][] = (colorMode === 'limited' && limitedColors?.length) 
    ? limitedColors.map(getFilamentNameAndHex) 
    : FILAMENTS.map(([name, hex]) => [name, hex]);

  const bodyRow = getClickerDocument().createElement('div');
  bodyRow.className = 'fil-row body-row';
  bodyRow.innerHTML = `<span class="slot-no slot-body">Body</span><span class="swatch" style="background:#787c82; opacity: 0.5;" title="default body color"></span><span class="arrow">â†’</span><button type="button" class="fil-chip" title="${rgbText(bodyColorRgb)}" style="background:${rgbHex(bodyColorRgb)}"></button><span class="rgb-code">${rgbText(bodyColorRgb)}</span>`;
  
  const bodyChip = bodyRow.querySelector('.fil-chip')!;
  bodyChip.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = bodyChip.getBoundingClientRect();
    showColorPopoverAt(rect.left, rect.bottom + 6, rgbHex(bodyColorRgb), chipsToRender.map(([, h]) => hexRgb(h)), { onSelect: cb.onBodyColor });
  });
  pal.appendChild(bodyRow);

  if (palette.length === 0) {
    pal.insertAdjacentHTML('beforeend', '<div class="hint">Load an image/vector to pick colors.</div>');
  } else {
    palette.forEach((entry, i) => {
      const row = getClickerDocument().createElement('div');
      row.className = 'fil-row';
      row.innerHTML = `<span class="slot-no">${i + 1}</span><span class="swatch" style="background:${rgbHex(entry.quantRgb)}" title="${rgbText(entry.quantRgb)}"></span><span class="arrow">â†’</span><button type="button" class="fil-chip" title="${rgbText(entry.filamentRgb)}" style="background:${rgbHex(entry.filamentRgb)}"></button><span class="rgb-code">${rgbText(entry.filamentRgb)}</span>`;
      
      const chip = row.querySelector('.fil-chip')!;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = chip.getBoundingClientRect();
        showColorPopoverAt(rect.left, rect.bottom + 6, rgbHex(entry.filamentRgb), chipsToRender.map(([, h]) => hexRgb(h)), { onSelect: (hex) => cb.onFilament(i, hex) });
      });
      pal.appendChild(row);
    });
    pal.insertAdjacentHTML('beforeend', '<div class="hint model-recolor-tip">Tip: click any color on the 3D model to recolor it.</div>');
  }
}


