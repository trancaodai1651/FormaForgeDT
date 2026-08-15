import { store } from './appState';
import { debounce } from '../utils/helpers';

const HISTORY_FIELDS = [
  'palette', 'paletteOverrides', 'partOverrides', 'bodyColorRgb', 'baseColorOverride',
  'componentHeights', 'edgeSettings', 'extrudeChamfer', 'baseShape', 'capWidthMm', 'topThickness',
  'imageDepth', 'imageMargin', 'borderWidth', 'mergeTopFrame', 'tolerance', 'stemTolerance', 'switches', 'keychain', 'keepMeshesSeparate',
] as const;

let history: string[] = [];
let histIndex = -1;
let restoringHistory = false;
export let pendingHistoryReset = false;

export function setPendingHistoryReset(val: boolean) {
  pendingHistoryReset = val;
}

function snapshotHistory(): string {
  const s = store.get() as any;
  const picked: Record<string, unknown> = {};
  for (const k of HISTORY_FIELDS) picked[k] = s[k];
  return JSON.stringify(picked);
}

function updateHistoryButtons() {
  store.set({ canUndo: histIndex > 0, canRedo: histIndex < history.length - 1, canRefresh: history.length > 1 });
}

export function resetHistory() {
  history = [snapshotHistory()];
  histIndex = 0;
  updateHistoryButtons();
}

export const commitHistory = debounce(() => {
  if (restoringHistory || pendingHistoryReset || histIndex < 0) return;
  const snap = snapshotHistory();
  if (snap === history[histIndex]) return;
  history = history.slice(0, histIndex + 1);
  history.push(snap);
  if (history.length > 60) history = history.slice(history.length - 60);
  histIndex = history.length - 1;
  updateHistoryButtons();
}, 350);

export function setupHistoryShortcuts(rebuildFn: () => void) {
  function applyHistorySnapshot(snap: string) {
    restoringHistory = true;
    store.set(JSON.parse(snap));
    restoringHistory = false;
    updateHistoryButtons();
    rebuildFn(); 
  }

  const undo = () => {
    if (histIndex <= 0) return;
    applyHistorySnapshot(history[--histIndex]);
  };

  const redo = () => {
    if (histIndex >= history.length - 1) return;
    applyHistorySnapshot(history[++histIndex]);
  };

  const refreshDesign = () => {
    if (history.length > 1) {
      applyHistorySnapshot(history[0]);
      commitHistory();
    }
  };

  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (k === 'y') { e.preventDefault(); redo(); }
  });

  return { undo, redo, refreshDesign };
}