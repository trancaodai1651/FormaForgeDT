import { getClickerDocument } from '../../runtime';
export function setupWelcomeModal() {
  if (getClickerDocument().querySelector('.welcome-overlay')) return;
  const wm = getClickerDocument().createElement('div');
  wm.className = 'welcome-overlay';
  wm.innerHTML = `
    <div class="welcome-card">
      <h2>Welcome to Clicker Generator</h2>
      <p>Turn any image, SVG, icon, or text into a multi-color 3D printable clicker.</p>
      <div class="welcome-steps">
        <div class="welcome-step"><div class="welcome-step-num">1</div><div class="welcome-step-text"><strong>Import your design</strong><span>Drop an image or choose a sample, upload an SVG, pick a Lucide icon, or type custom text.</span></div></div>
        <div class="welcome-step"><div class="welcome-step-num">2</div><div class="welcome-step-text"><strong>Configure the clicker</strong><span>Pick colors &amp; filaments, choose a shape, adjust the size and depth.</span></div></div>
        <div class="welcome-step"><div class="welcome-step-num">3</div><div class="welcome-step-text"><strong>Export &amp; print</strong><span>Download the 3MF file and load it directly into your slicer.</span></div></div>
      </div>
      <div class="welcome-foot"><button class="primary" id="welcomeClose" style="min-width:150px">Get started</button></div>
    </div>
  `;
  getClickerDocument().body.appendChild(wm);
  const close = () => { wm.remove(); showUpdate(); };
  wm.querySelector('#welcomeClose')!.addEventListener('click', close);
  wm.addEventListener('click', (e) => { if (e.target === wm) close(); });
}

function showUpdate() {
  const UPDATE_KEY = 'clicker_update_dismissed_2026_08';
  if (localStorage.getItem(UPDATE_KEY) === 'true') {
    if (localStorage.getItem('clicker_tutorial_dismissed') !== 'true') setupTutorial();
    return;
  }
  if (getClickerDocument().querySelector('.welcome-overlay')) return;
  const wm = getClickerDocument().createElement('div');
  wm.className = 'welcome-overlay';
  const check = `<svg class="whats-new-check" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  wm.innerHTML = `
    <div class="welcome-card whats-new-card">
      <div class="whats-new-badge">What's new</div>
      <h2>Latest updates</h2>
      <ul class="whats-new-list">
        <li>${check}<span><strong>Multiple switches</strong>: use 1â€“3 MX switches for bigger designs.</span></li>
        <li>${check}<span><strong>Keychain loop</strong>: add a keyring loop, slide it around the body edge.</span></li>
        <li>${check}<span><strong>Custom Base Shape</strong>: build a custom base for more flexible models.</span></li>
      </ul>
      <div class="whats-new-foot">
        <label class="whats-new-dismiss"><input type="checkbox" id="updateDontShow" /> Don't show again</label>
        <button class="primary" id="updateClose" style="min-width:130px">Got it</button>
      </div>
    </div>
  `;
  getClickerDocument().body.appendChild(wm);
  const close = () => {
    if ((wm.querySelector('#updateDontShow') as HTMLInputElement).checked) localStorage.setItem(UPDATE_KEY, 'true');
    wm.remove();
    if (localStorage.getItem('clicker_tutorial_dismissed') !== 'true') setupTutorial();
  };
  wm.querySelector('#updateClose')!.addEventListener('click', close);
  wm.addEventListener('click', (e) => { if (e.target === wm) close(); });
}

export function setupTutorial() {
  if (getClickerDocument().querySelector('.tutorial-card-container')) return;
  const backdrop = getClickerDocument().createElement('div'); backdrop.className = 'tutorial-backdrop';
  const cardContainer = getClickerDocument().createElement('div'); cardContainer.className = 'tutorial-card-container';
  const card = getClickerDocument().createElement('div'); card.className = 'tutorial-card';
  
  cardContainer.style.justifyContent = 'center';
  cardContainer.style.alignItems = 'center';
  
  card.innerHTML = `
    <button class="tutorial-card-close" aria-label="Close"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
    <h3>How to use</h3>
    <p>1. <strong>Import:</strong> Drop an image or SVG, choose an icon, or enter text in the right panel.<br/>
    2. <strong>Configure:</strong> Adjust colors, borders, size, and geometry in the left panel.<br/>
    3. <strong>Export:</strong> Download a 3MF or STL file for 3D printing.</p>
    <div class="tutorial-controls">
      <label class="tutorial-checkbox"><input type="checkbox" id="tutDontShow" /> Don't show again</label>
      <div class="tutorial-nav"><button class="primary" id="tutNext">Finish</button></div>
    </div>
  `;

  const closeTutorial = () => { backdrop.remove(); cardContainer.remove(); };
  card.querySelector('.tutorial-card-close')!.addEventListener('click', closeTutorial);
  card.querySelector('#tutNext')!.addEventListener('click', closeTutorial);
  card.querySelector('#tutDontShow')!.addEventListener('change', (e) => {
    if ((e.target as HTMLInputElement).checked) localStorage.setItem('clicker_tutorial_dismissed', 'true');
    else localStorage.removeItem('clicker_tutorial_dismissed');
  });

  cardContainer.appendChild(card);
  getClickerDocument().body.appendChild(backdrop);
  getClickerDocument().body.appendChild(cardContainer);
}

export function showTutorialPrompt() {
  if (getClickerDocument().querySelector('.welcome-overlay') || getClickerDocument().querySelector('.tutorial-backdrop')) return;
  const wm = getClickerDocument().createElement('div'); wm.className = 'welcome-overlay';
  wm.innerHTML = `
    <div class="welcome-card" style="align-items: center; text-align: center; width: 380px; padding: 32px;">
      <h2 style="margin-bottom: 8px;">Getting Started</h2>
      <p style="margin-bottom: 24px;">Do you want to see the interactive tutorial?</p>
      <div style="display: flex; gap: 12px; justify-content: center; width: 100%;">
        <button class="secondary" id="tutPromptNo" style="flex: 1;">No</button>
        <button class="primary" id="tutPromptYes" style="flex: 1;">Yes</button>
      </div>
    </div>
  `;
  getClickerDocument().body.appendChild(wm);
  const close = () => wm.remove();
  wm.querySelector('#tutPromptNo')!.addEventListener('click', close);
  wm.querySelector('#tutPromptYes')!.addEventListener('click', () => { close(); setupTutorial(); });
}



