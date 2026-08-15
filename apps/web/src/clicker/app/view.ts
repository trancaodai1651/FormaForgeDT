import { setupScreens } from '../ui/screenManager';
import { setupUI } from '../ui/uiSetup';

export interface AppView {
  screens: ReturnType<typeof setupScreens>;
  mountClicker(
    sidebarLeft: HTMLElement,
    sidebarRight: HTMLElement,
    statusEl: HTMLElement,
    viewer: any,
    history: any
  ): void;
}

export function createAppView(): AppView {
  const screens = setupScreens();

  return {
    screens,
    mountClicker(sidebarLeft, sidebarRight, statusEl, viewer, history) {
      setupUI(sidebarLeft, sidebarRight, statusEl, viewer, screens, history);
    },
  };
}
