import { getClickerDocument } from '../../runtime';
import { $ } from '../helpers';
import type { UiCallbacks } from '../types';

let uploadEmptyEl: HTMLElement | null = null;

function refreshUploadEmptyState() {
  const uploadGalleryEl = $('uploadGallery');
  if (!uploadGalleryEl) return;
  const empty = uploadGalleryEl.querySelectorAll('.icon').length === 0;
  if (empty && !uploadEmptyEl) {
    uploadEmptyEl = getClickerDocument().createElement('div');
    uploadEmptyEl.id = 'uploadGalleryEmpty';
    uploadEmptyEl.textContent = 'No SVGs yet. Drop files or use the upload button.';
    uploadGalleryEl.appendChild(uploadEmptyEl);
  } else if (!empty && uploadEmptyEl) {
    uploadEmptyEl.remove();
    uploadEmptyEl = null;
  }
}

export function bindSvgEvents(cb: UiCallbacks) {
  const svgUpload = $<HTMLInputElement>('svgUpload');
  if (svgUpload) {
    svgUpload.addEventListener('change', () => {
      const f = svgUpload.files?.[0];
      if (f) cb.onSvgUpload(f);
      svgUpload.value = '';
    });
  }
  $('generateSvg')?.addEventListener('click', () => cb.onGenerate());
  refreshUploadEmptyState();
}

export function addUploadedSvgElement(svgText: string, name: string, cb: UiCallbacks, select = true) {
  const uploadGalleryEl = $('uploadGallery');
  if (!uploadGalleryEl) return;

  const blob = new Blob([svgText], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  
  const el = getClickerDocument().createElement('div');
  el.className = 'icon';
  el.title = name;
  const img = getClickerDocument().createElement('img');
  img.src = url;
  img.alt = name;
  el.appendChild(img);

  el.addEventListener('click', () => {
    uploadGalleryEl.querySelectorAll('.icon').forEach((n: Element) => n.classList.remove('active'));
    el.classList.add('active');
    cb.onSelectSvg(svgText, name);
  });

  uploadGalleryEl.appendChild(el);
  refreshUploadEmptyState();
  if (select) el.click();
}


