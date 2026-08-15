import { getClickerDocument } from '../../runtime';
import { $ } from '../helpers';
import type { UiCallbacks } from '../types';
import type { FontOption } from '../../image/letter';
import { FONT_OPTIONS, loadBundledFonts } from '../../image/letter';

let selectedFontBtn: HTMLElement | null = null;

export function bindTextEvents(cb: UiCallbacks) {
  const letterText = $<HTMLTextAreaElement>('letterText');
  const blocksText = $<HTMLTextAreaElement>('blocksText');
  const fontUpload = $<HTMLInputElement>('fontUpload');

  letterText?.addEventListener('input', () => cb.onTextChange(letterText.value));
  blocksText?.addEventListener('input', () => cb.onBlockText(blocksText.value));
  
  fontUpload?.addEventListener('change', () => {
    const f = fontUpload.files?.[0];
    if (f) cb.onImportFont(f);
    fontUpload.value = '';
  });

  FONT_OPTIONS.forEach(f => addFontToGrid(f, cb));
  loadBundledFonts(f => addFontToGrid(f, cb));

  $('generateText')?.addEventListener('click', () => cb.onGenerate());
}

export function addFontToGrid(font: FontOption, cb: UiCallbacks, autoSelect = false) {
  const fontGrid = $('fontGrid');
  if (!fontGrid) return;

  const btn = getClickerDocument().createElement('button');
  btn.type = 'button';
  btn.className = 'font-grid-btn';
  btn.textContent = font.name;
  btn.style.fontFamily = `"${font.id.replace('bundled-', '')}", "${font.name}", sans-serif`;
  
  btn.addEventListener('click', () => {
    if (selectedFontBtn) selectedFontBtn.classList.remove('active');
    btn.classList.add('active');
    selectedFontBtn = btn;
    cb.onFontSelect(font.id);
  });
  
  fontGrid.appendChild(btn);
  if (autoSelect) btn.click();
}



