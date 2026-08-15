import { $ } from '../helpers';
import type { UiCallbacks } from '../types';
import { SAMPLES } from '../../image/sample';

export function bindImageEvents(cb: UiCallbacks) {
  const drop = $('drop');
  const file = $<HTMLInputElement>('file');
  drop?.addEventListener('click', () => file.click());
  file?.addEventListener('change', () => { if (file.files?.[0]) cb.onUpload(file.files[0]); });

  drop?.addEventListener('dragenter', (e: DragEvent) => { e.preventDefault(); drop.classList.add('over'); });
  drop?.addEventListener('dragover', (e: DragEvent) => { e.preventDefault(); drop.classList.add('over'); });
  drop?.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop?.addEventListener('drop', () => drop.classList.remove('over'));

  // Custom Bottom Base 
  $('tab-base-match')?.addEventListener('click', () => cb.onBottomModeChange('match'));
  $('tab-base-custom')?.addEventListener('click', () => cb.onBottomModeChange('custom'));

  const dropBottom = $('drop-bottom');
  const fileBottom = $<HTMLInputElement>('file-bottom');
  if (dropBottom && fileBottom) {
    dropBottom.addEventListener('click', () => fileBottom.click());
    fileBottom.addEventListener('change', () => { if (fileBottom.files?.[0]) cb.onBottomUpload(fileBottom.files[0]); });
    dropBottom.addEventListener('dragover', (e: DragEvent) => { e.preventDefault(); dropBottom.classList.add('over'); });
    dropBottom.addEventListener('dragleave', () => dropBottom.classList.remove('over'));
    dropBottom.addEventListener('drop', (e: DragEvent) => { e.preventDefault(); dropBottom.classList.remove('over'); if (e.dataTransfer?.files?.[0]) cb.onBottomUpload(e.dataTransfer.files[0]); });
  }

  $('sampleGrid')?.addEventListener('click', (e: MouseEvent) => {
    const item = (e.target as HTMLElement).closest('.sample-inline-item') as HTMLElement | null;
    if (item) cb.onSample(SAMPLES[parseInt(item.dataset.idx!)].load);
  });
}