import { getClickerDocument } from '../runtime';
import { createViewer } from '../viewer/viewer';
import { setupEngine, reprocess, rebuild } from '../core/engine';
import { setupHistoryShortcuts } from '../store/historyManager';
import { SAMPLES } from '../image/sample';
import { ClickerPart } from '../types';
import { createAppModel } from './model';
import { createAppView } from './view';

export function bootstrapApp() {
  const model = createAppModel();
  const view = createAppView();
  const viewer = createViewer(getClickerDocument().getElementById('app')!);
  const base = `${import.meta.env.BASE_URL}clicker-assets/`;

  async function loadAsset(path: string, label: string) {
    model.store.set({ status: `Loading ${label}...` });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(base + path, { signal: controller.signal });
      if (!response.ok) throw new Error(`Failed to load ${path}`);
      const buffer = await response.arrayBuffer();
      model.store.set({ status: `Loaded ${label}` });
      return buffer;
    } catch (error) {
      model.store.set({ status: `Failed to load ${label}` });
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  const assetsPromise = Promise.all([
    loadAsset('switch/mx/mx-socket.3mf', 'switch socket'),
    loadAsset('switch/mx/mx-stem.3mf', 'switch stem'),
    loadAsset('switch/mx/mx-switch.3mf', 'switch body'),
    loadAsset('blocks/block no sides to connect.3mf', 'block no sides'),
    loadAsset('blocks/block south side to connect.3mf', 'block south'),
    loadAsset('blocks/block north and south side to connect.3mf', 'block north/south'),
    loadAsset('blocks/block north and west side to connect.3mf', 'block north/west'),
    loadAsset('blocks/block north, south and west side to connect.3mf', 'block north/south/west'),
    loadAsset('blocks/block all sides to connect.3mf', 'block all sides'),
    fetch(base + 'keycap.json').then(async (r) => {
      if (!r.ok) throw new Error('Failed to load keycap.json');
      model.store.set({ status: 'Loading keycap mesh...' });
      return await r.json();
    }),
  ]).catch((err) => { console.error('[assets]', err); throw err; });

  async function initAssets() {
      model.store.set({ status: 'Loading switch assets...' });
      try {
      const [socket, stem, sw, blockNoSides, blockSouth, blockNorthSouth, blockNorthWest, blockNorthSouthWest, blockAllSides, keycapJson] = await assetsPromise;
      model.store.set({ status: 'Sending switch assets to geometry worker...' });
      import('../core/engine').then((m) => m.worker.postMessage({
        type: 'init', socket, stem, switch: sw,
        blockNoSides, blockSouth, blockNorthSouth, blockNorthWest,
        blockNorthSouthWest, blockAllSides, keycapJson,
      }, [socket, stem, sw, blockNoSides, blockSouth, blockNorthSouth, blockNorthWest, blockNorthSouthWest, blockAllSides]));
    } catch {
      model.store.set({ status: 'Failed to load assets' });
      model.appData.isInitialLoad = false;
    }
  }

  async function loadDefaultClicker() {
    try {
      model.store.set({ status: 'Loading default...' });
      const response = await fetch(base + 'default-clicker.json');
      const serializedParts = await response.json();
      model.appData.latestParts = serializedParts.map((p: any) => ({
        ...p,
        vertProperties: new Float32Array(p.vertProperties),
        triVerts: new Uint32Array(p.triVerts),
      })) as ClickerPart[];
      viewer.setParts(model.appData.latestParts, false);
      viewer.setView(model.store.get().view);
      model.store.set({ building: false, hasParts: model.appData.latestParts.length > 0, status: '' });
      model.appData.defaultClickerLoaded = true;
      model.appData.isInitialLoad = false;
    } catch {
      if (model.appData.originalImage) reprocess();
    }
  }

  setupEngine(viewer, initAssets, loadDefaultClicker);
  const history = setupHistoryShortcuts(rebuild);

  view.mountClicker(
    getClickerDocument().getElementById('sidebar-left')!,
    getClickerDocument().getElementById('sidebar-right')!,
    getClickerDocument().getElementById('status')!,
    viewer,
    history
  );

  SAMPLES[0].load().then((img) => {
    model.appData.originalImage = img;
    if (model.appData.assetsReady && !model.appData.defaultClickerLoaded) reprocess();
  });
}



