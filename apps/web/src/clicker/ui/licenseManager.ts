import { getClickerDocument } from '../runtime';
const COMMERCIAL_URL = 'https://makerworld.com/en/@Vostok_Labs#commercial-membership-open';
const LICENSE_URL = 'https://creativecommons.org/licenses/by-nc-nd/4.0/';

let downloadCount = 0;
let licenseToastTimer: number | undefined;

export function handleExportLicense() {
  downloadCount += 1;
  if (downloadCount === 1) {
    showLicenseModal();
  } else {
    showLicenseToast();
  }
}

function showLicenseModal() {
  if (getClickerDocument().querySelector('.license-overlay')) return;
  const wm = getClickerDocument().createElement('div');
  wm.className = 'license-overlay';
  wm.innerHTML = `
    <div class="license-card">
      <div class="license-badge">âœ“ Download started</div>
      <h2>Free for personal use ðŸŽ‰</h2>
      <p>
        This generator and the designs it creates are released under a
        <a href="${LICENSE_URL}" target="_blank" rel="noopener noreferrer">CC BY-NC-ND 4.0 license</a>.
      </p>
      <div class="license-commercial">
        <div class="license-commercial-title">ðŸ’° Want to <span>sell</span> your prints?</div>
        <p>
          If you plan to sell these as 3D-printed products, you need a
          <strong>commercial license membership</strong>, it's just
          <strong class="license-price">$15&nbsp;/&nbsp;month</strong> and unlocks full commercial rights.
        </p>
        <a class="license-cta" href="${COMMERCIAL_URL}" target="_blank" rel="noopener noreferrer">
          Get the commercial license â†’
        </a>
      </div>
      <div class="license-foot">
        <button class="primary" id="licenseClose" style="min-width:150px">Got it</button>
      </div>
    </div>
  `;
  getClickerDocument().body.appendChild(wm);
  const close = () => wm.remove();
  wm.querySelector('#licenseClose')!.addEventListener('click', close);
  wm.addEventListener('click', (e) => {
    if (e.target === wm) close();
  });
}

function showLicenseToast() {
  getClickerDocument().querySelector('.license-toast')?.remove();
  if (licenseToastTimer) window.clearTimeout(licenseToastTimer);
  const t = getClickerDocument().createElement('div');
  t.className = 'license-toast';
  t.innerHTML = `
    <button class="license-toast-x" aria-label="Dismiss">Ã—</button>
    <div class="license-toast-title">âœ“ Free for personal use</div>
    <p>Selling printed designs? You need a commercial license.</p>
    <a class="license-toast-cta" href="${COMMERCIAL_URL}" target="_blank" rel="noopener noreferrer">
      Get commercial license â†’
    </a>
  `;
  getClickerDocument().body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  const dismiss = () => {
    t.classList.remove('show');
    window.setTimeout(() => t.remove(), 300);
  };
  t.querySelector('.license-toast-x')!.addEventListener('click', dismiss);
  licenseToastTimer = window.setTimeout(dismiss, 9000);
}


