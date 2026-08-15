import { getClickerDocument } from '../../runtime';
import { $ } from '../helpers';
import type { UiCallbacks } from '../types';
import { LUCIDE_ICONS, buildSvg, svgDataUrl } from '../../image/lucideIcons';
import { POPULAR_LUCIDE, GALLERY_PAGE } from '../constants';

export function bindIconEvents(cb: UiCallbacks) {
  const galleryEl = $('gallery');
  const searchEl = $<HTMLInputElement>('iconSearch');
  const searchClearEl = $<HTMLButtonElement>('iconSearchClear');
  const countEl = $('iconCount');
  if (!galleryEl || !searchEl) return;

  let lucideShown = 0;
  let lucideMatches: any[] = [];
  let moreBtn: HTMLButtonElement | null = null;

  function rankLucide(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) {
      const popularSet = new Set(POPULAR_LUCIDE);
      const popular = POPULAR_LUCIDE.map((name: string) => LUCIDE_ICONS.find((ic) => ic.name === name)).filter(Boolean);
      const rest = LUCIDE_ICONS.filter((ic) => !popularSet.has(ic.name));
      return popular.concat(rest);
    }
    const out: { ic: any; rank: number }[] = [];
    for (const ic of LUCIDE_ICONS) {
      const i = ic.name.indexOf(q);
      if (i === -1) continue;
      out.push({ ic, rank: ic.name === q ? 0 : i === 0 ? 1 : 2 });
    }
    out.sort((a, b) => a.rank - b.rank || a.ic.name.localeCompare(b.ic.name));
    return out.map((o) => o.ic);
  }

  function renderLucidePage() {
    if (moreBtn) { moreBtn.remove(); moreBtn = null; }
    const end = Math.min(lucideShown + GALLERY_PAGE, lucideMatches.length);
    const frag = getClickerDocument().createDocumentFragment();
    
    for (let i = lucideShown; i < end; i++) {
      const ic = lucideMatches[i];
      const svgText = buildSvg(ic.node);
      const el = getClickerDocument().createElement('div');
      el.className = 'icon'; el.title = ic.name;
      const img = getClickerDocument().createElement('img');
      img.src = svgDataUrl(svgText); img.alt = ic.name;
      el.appendChild(img);
      
      el.addEventListener('click', () => {
        galleryEl.querySelectorAll('.icon').forEach((n: Element) => n.classList.remove('active'));
        el.classList.add('active');
        cb.onSelectIcon(svgText, ic.name);
      });
      frag.appendChild(el);
    }
    galleryEl.appendChild(frag);
    lucideShown = end;

    if (lucideShown < lucideMatches.length) {
      moreBtn = getClickerDocument().createElement('button');
      moreBtn.id = 'galleryMore'; moreBtn.type = 'button';
      moreBtn.textContent = `Show ${Math.min(GALLERY_PAGE, lucideMatches.length - lucideShown)} more (${lucideMatches.length - lucideShown} hidden)`;
      moreBtn.addEventListener('click', renderLucidePage);
      galleryEl.appendChild(moreBtn);
    }
    updateCount();
  }

  function updateCount() {
    const total = lucideMatches.length;
    const visible = Math.min(lucideShown, total);
    if (total === 0) countEl.textContent = 'No icons match.';
    else countEl.textContent = searchEl.value.trim() 
      ? `${total} match${total === 1 ? '' : 'es'}` + (visible < total ? ` Â· showing ${visible}` : '') 
      : `${total} icons` + (visible < total ? ` Â· showing ${visible}` : '');
  }

  function rebuildGallery() {
    galleryEl.innerHTML = '';
    lucideShown = 0;
    lucideMatches = rankLucide(searchEl.value);
    if (searchClearEl) searchClearEl.style.display = searchEl.value ? 'block' : 'none';
    renderLucidePage();
  }

  let searchTimer: number | null = null;
  searchEl.addEventListener('input', () => {
    if (searchTimer !== null) clearTimeout(searchTimer);
    searchTimer = window.setTimeout(rebuildGallery, 80);
  });
  searchClearEl?.addEventListener('click', () => { searchEl.value = ''; rebuildGallery(); searchEl.focus(); });

  $('generateIcon')?.addEventListener('click', () => cb.onGenerate());
  rebuildGallery();
}


