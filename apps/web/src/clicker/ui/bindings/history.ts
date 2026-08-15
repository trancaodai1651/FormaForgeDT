import { $ } from '../helpers';
import type { UiCallbacks } from '../types';

export function bindHistoryEvents(cb: UiCallbacks) {
  $('undoBtn')?.addEventListener('click', () => cb.onUndo());
  $('redoBtn')?.addEventListener('click', () => cb.onRedo());
  $('refreshBtn')?.addEventListener('click', () => cb.onRefresh());
}