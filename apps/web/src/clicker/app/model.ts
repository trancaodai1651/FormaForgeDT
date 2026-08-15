import { appData, store } from '../store/appState';

export interface AppModel {
  store: typeof store;
  appData: typeof appData;
}

export function createAppModel(): AppModel {
  return { store, appData };
}
