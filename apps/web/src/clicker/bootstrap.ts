import { bootstrapApp } from './app/controller';
import { bootstrapFlexKeychain } from './features/flexKeychain/controller';
import { bootstrapFlexOrganizer } from './features/flexOrganizer/controller';
import { bootstrapImageKeychain } from './features/imageKeychain/controller';
import { getClickerDocument, resetClickerRoot, setClickerRoot } from './runtime';

export type ClickerMode = 'clicker' | 'flex-keychain' | 'flex-organizer' | 'image-keychain';

function renderClickerShell() {
  return `<section id="dashboard-screen" style="display:none;"><button id="btn-open-clicker" type="button">Clicker</button></section><section id="tool-screen" style="display:block; opacity:1; height:100%;">
    <div id="layout">
      <aside id="sidebar-left" class="sidebar left"></aside>
      <div id="viewport"><div id="app"></div><div id="status">Bootingâ€¦</div></div>
      <aside id="sidebar-right" class="sidebar right"></aside>
    </div>
  </section>`;
}

export function bootstrapClickerWorkspace(root: HTMLElement, mode: ClickerMode = 'clicker') {
  setClickerRoot(root);
  root.innerHTML = '';
  getClickerDocument().documentElement.dataset.embed = 'formaforge';
  if (mode === 'flex-keychain') return bootstrapFlexKeychain();
  if (mode === 'flex-organizer') return bootstrapFlexOrganizer();
  if (mode === 'image-keychain') return bootstrapImageKeychain();
  root.innerHTML = renderClickerShell();
  return bootstrapApp();
}

export function unmountClickerWorkspace(root: HTMLElement) {
  root.innerHTML = '';
  resetClickerRoot(root);
}


