import { getClickerDocument } from '../runtime';
import type { UiState, UiCallbacks, EditMode, EdgeStyle } from './types';
import { $, friendlyTargetLabel, hexRgb } from './helpers';
import { BASE_SOCKET_TOL } from './constants';

import { renderLeftSidebar } from './templates/leftSidebar';
import { renderLeftSettings } from './templates/leftSettings';
import { renderRightImport } from './templates/rightImport';
import { renderRightExport } from './templates/rightExport';

import { bindGlobalEvents } from './bindings/events';
import { bindImageEvents } from './bindings/image';
import { bindSvgEvents, addUploadedSvgElement } from './bindings/svg';
import { bindIconEvents } from './bindings/icon';
import { bindTextEvents, addFontToGrid } from './bindings/text';
import { bindHistoryEvents } from './bindings/history';

import { setupWelcomeModal, showTutorialPrompt } from './components/modals';
import { showColorPopoverAt, renderPalette } from './components/colorPicker';

export function createUi(
  sidebarLeft: HTMLElement,
  sidebarRight: HTMLElement,
  statusEl: HTMLElement,
  cb: UiCallbacks
) {
  // 1. RENDER GIAO DIá»†N (HTML)
  sidebarLeft.innerHTML = renderLeftSidebar() + renderLeftSettings();
  sidebarRight.innerHTML = renderRightImport() + renderRightExport();

  // 2. RENDER CÃC COMPONENT Äá»˜NG VÃ€O VIEWPORT
  const viewport = $('viewport');
  if (viewport) {
    viewport.insertAdjacentHTML('beforeend', `
      <div id="loadingOverlay" class="loading-overlay" hidden><div class="loading-spinner"></div><div class="loading-text">Generating 3D modelâ€¦</div></div>
      <div id="editModeBar" class="edit-mode-bar">
        <button class="edit-mode-btn active" data-editmode="color" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>Color</button>
        <button class="edit-mode-btn" data-editmode="extrude" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>Extrude</button>
        <button class="edit-mode-btn" data-editmode="edges" type="button" style="display:none;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4" ry="4"/></svg>Edges</button>
      </div>
      <div id="lettersToggle" class="letters-toggle" hidden><span>Separate letters</span><label class="toggle"><input type="checkbox" id="separateLetters" /><span class="slider"></span></label></div>
      <div id="extrudePanel" class="edges-panel" hidden><div class="edges-title">Extrude Part</div><div id="extrudeLevelLabel" style="text-align:center; margin-top:8px; font-size:13px; color:var(--muted);">Level: 0</div><div style="display:flex; gap:8px; margin-top:8px;"><button type="button" class="btn" id="extrudeMinus" style="flex:1; font-size:18px;">-</button><button type="button" class="btn" id="extrudePlus" style="flex:1; font-size:18px;">+</button></div><div class="extrude-chamfer-row"><span>Chamfer edges</span><label class="toggle"><input type="checkbox" id="extrudeChamfer" /><span class="slider"></span></label></div><div class="panel-hint">Raises or lowers the selected color. Shift-click parts to select several.</div></div>
      <div id="edgesPanel" class="edges-panel" hidden><div class="edges-title" id="edgesTitle">Edge Modifications</div><div id="edgesContent"></div><div class="panel-hint">Select a part to round (fillet) or bevel (chamfer) its top edge. Shift-click for several.</div></div>
    `);

    $('editModeBar')?.addEventListener('click', (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('[data-editmode]') as HTMLElement | null;
      if (btn) cb.onEditMode(btn.dataset.editmode as EditMode);
    });

    $('separateLetters')?.addEventListener('change', (e: Event) => cb.onSeparateLetters((e.target as HTMLInputElement).checked));
    $('extrudeMinus')?.addEventListener('click', () => cb.onExtrudeStep(-1));
    $('extrudePlus')?.addEventListener('click', () => cb.onExtrudeStep(1));
    $('extrudeChamfer')?.addEventListener('change', (e: Event) => { const v = (e.target as HTMLInputElement).checked; console.log('UI: extrudeChamfer ->', v); cb.onExtrudeChamfer(v); });

    $('edgesPanel')?.addEventListener('click', (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement;
      const styleBtn = targetEl.closest('.edge-style-btn') as HTMLElement | null;
      if (styleBtn) {
        const btnsRow = styleBtn.closest('.edge-style-btns') as HTMLElement;
        const target = btnsRow.dataset.edge;
        if (target) cb.onEdgeStyle(target, styleBtn.dataset.style as EdgeStyle);
      }
      if (targetEl.classList.contains('edge-size-minus') || targetEl.classList.contains('edge-size-plus')) {
        const sizeRow = targetEl.closest('.edge-size-btns') as HTMLElement;
        const target = sizeRow.dataset.edge;
        if (target) cb.onEdgeStep(target, targetEl.classList.contains('edge-size-minus') ? -0.2 : 0.2);
      }
    });
  }

  // 3. Gáº®N Sá»° KIá»†N Tá»ª BINDINGS MODULES
  bindGlobalEvents(cb);
  bindHistoryEvents(cb);
  bindImageEvents(cb);
  bindSvgEvents(cb);
  bindIconEvents(cb);
  bindTextEvents(cb);

  // 4. KHá»žI Táº O MODAL
  if (getClickerDocument().documentElement.dataset.embed !== 'formaforge') setupWelcomeModal();
  $('helpToggle')?.addEventListener('click', showTutorialPrompt);

  // 5. HÃ€M UPDATE STATE THáº¦N THÃNH
  function update(state: UiState) {
    statusEl.innerHTML = (state.building ? '<span class="spinner"></span> ' : '') + state.status;
    
    const setVal = (id: string, text: string) => { const el = getClickerDocument().getElementById(id) as HTMLInputElement | null; if (el && getClickerDocument().activeElement !== el) el.value = text; };
    
    // Cáº­p nháº­t giÃ¡ trá»‹ Input & Range
    if ($('smooth')) $<HTMLInputElement>('smooth').value = String(state.smoothing); setVal('smoothVal', Math.round(state.smoothing * 100) + '%');
    if ($('width')) $<HTMLInputElement>('width').value = String(state.capWidthMm); setVal('widthVal', state.capWidthMm + ' mm');
    if ($('baseHeight')) $<HTMLInputElement>('baseHeight').value = String((state as any).baseHeight ?? 12); setVal('baseHeightVal', ((state as any).baseHeight ?? 12).toFixed(1) + ' mm');
    if ($('topthick')) $<HTMLInputElement>('topthick').value = String(state.topThickness); setVal('topthickVal', state.topThickness.toFixed(1) + ' mm');
    if ($('imgdepth')) $<HTMLInputElement>('imgdepth').value = String(state.imageDepth); setVal('imgdepthVal', state.imageDepth.toFixed(1) + ' mm');
    if ($('flatKeychainThickness')) $<HTMLInputElement>('flatKeychainThickness').value = String(state.flatKeychainThicknessMm);
    setVal('flatKeychainThicknessVal', state.flatKeychainThicknessMm.toFixed(1) + ' mm');
    if ($('margin')) $<HTMLInputElement>('margin').value = String(state.imageMargin); setVal('marginVal', state.imageMargin.toFixed(1) + ' mm');
    if ($('borderwidth')) $<HTMLInputElement>('borderwidth').value = String(state.borderWidth); setVal('borderwidthVal', state.borderWidth.toFixed(1) + ' mm');
    if ($('legendSize')) $<HTMLInputElement>('legendSize').value = String(state.legendScale);
    setVal('legendSizeVal', `${Math.round(state.legendScale * 100)}%`);
    if ($('legendBold')) $<HTMLInputElement>('legendBold').value = String(state.legendBold);
    setVal('legendBoldVal', `${state.legendBold > 0 ? '+' : ''}${state.legendBold.toFixed(2)} mm`);
    if ($('blockKeycapGap')) $<HTMLInputElement>('blockKeycapGap').value = String(state.blockKeycapGapMm);
    setVal('blockKeycapGapVal', `${state.blockKeycapGapMm.toFixed(1)} mm`);
    if ($('blockFlatBottom')) $<HTMLInputElement>('blockFlatBottom').checked = state.blockFlatBottom;
    if ($('blockBaseHeight')) $<HTMLInputElement>('blockBaseHeight').value = String(state.blockBaseHeightMm);
    setVal('blockBaseHeightVal', `${state.blockBaseHeightMm.toFixed(1)} mm`);
    if ($('blockModuleThickness')) $<HTMLInputElement>('blockModuleThickness').value = String(state.blockModuleThicknessMm);
    setVal('blockModuleThicknessVal', `${state.blockModuleThicknessMm.toFixed(1)} mm`);
    if ($('blockModuleSideThickness')) $<HTMLInputElement>('blockModuleSideThickness').value = String(state.blockModuleSideThicknessMm);
    setVal('blockModuleSideThicknessVal', `${state.blockModuleSideThicknessMm.toFixed(2)} mm`);
    if ($('blockBaseCornerRadius')) $<HTMLInputElement>('blockBaseCornerRadius').value = String(state.blockBaseCornerRadiusMm);
    setVal('blockBaseCornerRadiusVal', `${state.blockBaseCornerRadiusMm.toFixed(2)} mm`);
    if ($('blockKeycapHeight')) $<HTMLInputElement>('blockKeycapHeight').value = String(state.blockKeycapHeightMm);
    setVal('blockKeycapHeightVal', `${state.blockKeycapHeightMm.toFixed(1)} mm`);
    if ($('blockKeycapThickness')) $<HTMLInputElement>('blockKeycapThickness').value = String(state.blockKeycapThicknessMm);
    setVal('blockKeycapThicknessVal', `${state.blockKeycapThicknessMm.toFixed(1)} mm`);
    if ($('blockKeycapCornerRadius')) $<HTMLInputElement>('blockKeycapCornerRadius').value = String(state.blockKeycapCornerRadiusMm);
    setVal('blockKeycapCornerRadiusVal', `${state.blockKeycapCornerRadiusMm.toFixed(1)} mm`);
    if ($('hybridImageSize')) $<HTMLInputElement>('hybridImageSize').value = String(state.hybridImageSizeMm);
    setVal('hybridImageSizeVal', `${state.hybridImageSizeMm.toFixed(0)} mm`);
    if ($('hybridImageThickness')) $<HTMLInputElement>('hybridImageThickness').value = String(state.hybridImageThicknessMm);
    setVal('hybridImageThicknessVal', `${state.hybridImageThicknessMm.toFixed(1)} mm`);
    if ($('hybridBaseWidth')) $<HTMLInputElement>('hybridBaseWidth').value = String(state.hybridBaseWidthMm);
    setVal('hybridBaseWidthVal', `${state.hybridBaseWidthMm.toFixed(1)} mm`);
    if ($('hybridBaseEndPadding')) $<HTMLInputElement>('hybridBaseEndPadding').value = String(state.hybridBaseEndPaddingMm);
    setVal('hybridBaseEndPaddingVal', `${state.hybridBaseEndPaddingMm.toFixed(1)} mm`);
    if ($('hybridKeycapSpacing')) $<HTMLInputElement>('hybridKeycapSpacing').value = String(state.hybridKeycapSpacingMm);
    setVal('hybridKeycapSpacingVal', `${state.hybridKeycapSpacingMm.toFixed(1)} mm`);
    if ($('hybridKeycapClearance')) $<HTMLInputElement>('hybridKeycapClearance').value = String(state.hybridKeycapClearanceMm);
    setVal('hybridKeycapClearanceVal', `${state.hybridKeycapClearanceMm.toFixed(1)} mm`);
    if ($('hybridBaseThickness')) $<HTMLInputElement>('hybridBaseThickness').value = String(state.hybridBaseThicknessMm);
    setVal('hybridBaseThicknessVal', `${state.hybridBaseThicknessMm.toFixed(1)} mm`);
    if ($('hybridBaseCornerRadius')) $<HTMLInputElement>('hybridBaseCornerRadius').value = String(state.hybridBaseCornerRadiusMm);
    setVal('hybridBaseCornerRadiusVal', `${state.hybridBaseCornerRadiusMm.toFixed(1)} mm`);
    if ($('hybridBaseWallHeight')) $<HTMLInputElement>('hybridBaseWallHeight').value = String(state.hybridBaseWallHeightMm);
    setVal('hybridBaseWallHeightVal', `${state.hybridBaseWallHeightMm.toFixed(2)} mm`);
    if ($('hybridNeckLength')) $<HTMLInputElement>('hybridNeckLength').value = String(state.hybridNeckLengthMm);
    setVal('hybridNeckLengthVal', `${state.hybridNeckLengthMm.toFixed(1)} mm`);
    if ($('hybridBaseImageOverlap')) $<HTMLInputElement>('hybridBaseImageOverlap').value = String(state.hybridBaseImageOverlapMm);
    setVal('hybridBaseImageOverlapVal', `${state.hybridBaseImageOverlapMm.toFixed(1)} mm`);
    if ($('hybridNeckWidth')) $<HTMLInputElement>('hybridNeckWidth').value = String(state.hybridNeckWidthMm);
    setVal('hybridNeckWidthVal', `${state.hybridNeckWidthMm.toFixed(1)} mm`);
    if ($('blockKeycapProfile')) $<HTMLSelectElement>('blockKeycapProfile').value = state.blockKeycapProfile;
    if ($('blockKeySize')) $<HTMLSelectElement>('blockKeySize').value = String(state.blockKeycapUnit);

    // Äá»“ng bá»™ giÃ¡ trá»‹ slider má»Ÿ rá»™ng Ä‘áº¿
    const expandPercent = (state as any).bottomExpandPercent ?? 22;
    if ($('baseExpand')) $<HTMLInputElement>('baseExpand').value = String(expandPercent);
    setVal('baseExpandVal', `${expandPercent}%`);

    const fmtSigned = (v: number, dec: number) => (v > 0.0001 ? '+' : v < -0.0001 ? 'âˆ’' : '') + Math.abs(v).toFixed(dec) + ' mm';
    if ($('socketTolVal')) $('socketTolVal').textContent = fmtSigned(state.tolerance - BASE_SOCKET_TOL, 2);
    if ($('stemTolVal')) $('stemTolVal').textContent = fmtSigned(state.stemTolerance, 1);

    // Cáº­p nháº­t Switch Section
    const switchCountN = state.switches.length;
    const activeIdx = Math.min(state.activeSwitchIndex, switchCountN - 1);
    const active = state.switches[activeIdx] ?? { x: 0, y: 0, rotation: 0 };
    const swReadout = $('switchReadout');
    if (swReadout) {
      const bits: string[] = [];
      if (Math.abs(active.x) >= 0.05 || Math.abs(active.y) >= 0.05) {
        bits.push(`X ${active.x > 0 ? '+' : ''}${active.x.toFixed(1)} Â· Y ${active.y > 0 ? '+' : ''}${active.y.toFixed(1)} mm`);
      }
      if (Math.abs(active.rotation) >= 0.5) bits.push(`${active.rotation > 0 ? 'â†º' : 'â†»'} ${Math.abs(active.rotation)}Â°`);
      const body = bits.length ? bits.join('  Â·  ') : 'Centered';
      swReadout.textContent = switchCountN > 1 ? `S${activeIdx + 1} Â· ${body}` : body;
    }

    const switchCountEl = $('switchCount');
    if (switchCountEl) {
      for (const b of switchCountEl.querySelectorAll<HTMLElement>('[data-count]')) {
        b.classList.toggle('active', +b.dataset.count! === switchCountN);
      }
    }

    const chipsEl = $('switchChips');
    if (chipsEl) {
      if (switchCountN > 1) {
        chipsEl.style.display = 'flex';
        if (chipsEl.querySelectorAll('[data-sw]').length !== switchCountN) {
          chipsEl.innerHTML = state.switches
            .map((_, i) => `<button class="tab" data-sw="${i}" type="button">S${i + 1}</button>`)
            .join('');
        }
        for (const b of chipsEl.querySelectorAll<HTMLElement>('[data-sw]')) {
          b.classList.toggle('active', +b.dataset.sw! === activeIdx);
        }
      } else {
        chipsEl.style.display = 'none';
      }
    }

    if ($('switchResetAll')) $('switchResetAll').style.display = switchCountN > 1 ? 'block' : 'none';

    // Cáº­p nháº­t Keychain & CÃ¡c Checkbox
    const kc = state.keychain;
    if ($('keychain')) $<HTMLInputElement>('keychain').checked = kc.enabled;
    if ($('keychainOpts')) $('keychainOpts').style.display = kc.enabled ? '' : 'none';
    if ($('keychainAngleVal')) $('keychainAngleVal').textContent = `${Math.round((((kc.angleDeg % 360) + 360) % 360))}Â°`;
    if ($('keychainOffsetVal')) $('keychainOffsetVal').textContent = `${(kc.offsetMm ?? 0.0).toFixed(1)} mm`;
    if ($('keychainSizeVal')) $('keychainSizeVal').textContent = `${kc.holeDiameterMm.toFixed(1)} mm`;
    if ($('keychainHoleDiameter')) $<HTMLInputElement>('keychainHoleDiameter').value = String(kc.holeDiameterMm);

    if ($('removebg')) $<HTMLInputElement>('removebg').checked = state.removeBg;
    if ($('removebgSvg')) $<HTMLInputElement>('removebgSvg').checked = state.removeBg;
    if ($('photoFlatten')) $<HTMLInputElement>('photoFlatten').checked = state.photoFlatten;
    if ($('showswitch')) $<HTMLInputElement>('showswitch').checked = state.showSwitch;
    if ($('mergeTopFrame')) $<HTMLInputElement>('mergeTopFrame').checked = state.mergeTopFrame;
    if ($('keepMeshesSeparate')) $<HTMLInputElement>('keepMeshesSeparate').checked = state.keepMeshesSeparate;
    if ($('isFlatKeychain')) $<HTMLInputElement>('isFlatKeychain').checked = !!state.isFlatKeychain;
    if ($('flatKeychainThicknessRow')) $('flatKeychainThicknessRow').style.display = state.isFlatKeychain ? '' : 'none';
    if ($('topThicknessRow')) $('topThicknessRow').style.display = state.isFlatKeychain ? 'none' : '';
    
    if ($('keepMeshesRow')) $('keepMeshesRow').style.display = state.mergeTopFrame ? 'flex' : 'none';
    if ($('sectionSwitch')) $('sectionSwitch').style.display = state.isFlatKeychain ? 'none' : 'block';

    // Cáº­p nháº­t Shape Type Tabs & Select
    const shapeTypeTabs = $('shapeTypeTabs');
    const shapeSelect = $<HTMLSelectElement>('shapeSelect');
    if (shapeTypeTabs && shapeSelect) {
      const outlineTab = shapeTypeTabs.querySelector<HTMLElement>('[data-style="outline"]');
      if (outlineTab) outlineTab.style.display = state.importMode === 'icon' ? 'none' : '';
      const treatAsOutline = state.baseShape === 'outline' && state.importMode !== 'icon';
      for (const btn of shapeTypeTabs.querySelectorAll<HTMLElement>('button')) {
        btn.classList.toggle('active', btn.dataset.style === (treatAsOutline ? 'outline' : 'shape'));
      }
      if (treatAsOutline) {
        shapeSelect.disabled = true;
      } else {
        shapeSelect.disabled = false;
        shapeSelect.value = state.baseShape === 'outline' ? 'circle' : state.baseShape;
      }
    }

    // Cáº­p nháº­t Tab Import Mode
    getClickerDocument().querySelectorAll('#importTabs [data-mode]').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.mode === state.importMode));
    if ($('imagePanel')) $('imagePanel')!.hidden = state.importMode !== 'image' && state.importMode !== 'hybrid';
    if ($('svgPanel')) $('svgPanel')!.hidden = state.importMode !== 'svg';
    if ($('iconPanel')) $('iconPanel')!.hidden = state.importMode !== 'icon';
    if ($('letterPanel')) $('letterPanel')!.hidden = state.importMode !== 'text' && state.importMode !== 'blocks' && state.importMode !== 'hybrid';
    if ($('textOnlyField')) $('textOnlyField')!.hidden = state.importMode === 'blocks' || state.importMode === 'hybrid';
    if ($('blocksTextField')) $('blocksTextField')!.hidden = state.importMode !== 'blocks' && state.importMode !== 'hybrid';
    if ($('blocksChainField')) $('blocksChainField')!.hidden = state.importMode !== 'blocks' && state.importMode !== 'hybrid';
    if ($('blocksText')) {
      const blockText = state.blockSlots.map(slot => slot.ch).join('');
      if (getClickerDocument().activeElement !== $('blocksText')) $<HTMLTextAreaElement>('blocksText').value = blockText;
    }
    if ($('blockChips')) {
      $('blockChips')!.innerHTML = state.blockSlots.map((slot, index) => `<span class="block-chip" data-block-index="${index}">${slot.ch.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`).join('');
    }
    if ($('blocksSection')) $('blocksSection')!.hidden = state.importMode !== 'blocks' && state.importMode !== 'hybrid';
    const isBlocksMode = state.importMode === 'blocks';
    if ($('baseStyleSection')) $('baseStyleSection')!.hidden = isBlocksMode;
    if ($('sectionSwitch')) $('sectionSwitch')!.hidden = isBlocksMode;
    for (const id of ['topProfileTabs', 'topthick', 'imgdepth', 'socketTolStepper', 'stemTolStepper']) {
      const el = getClickerDocument().getElementById(id);
      const field = el?.closest('.prow-stacked') ?? el?.parentElement;
      if (field) (field as HTMLElement).style.display = isBlocksMode ? 'none' : '';
    }
    getClickerDocument().querySelectorAll('#blockOrient [data-orient]').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.orient === state.blockOrientation));
    getClickerDocument().querySelectorAll('#blockKeycapShape [data-keycap-shape]').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.keycapShape === state.blockKeycapShape));
    getClickerDocument().querySelectorAll('#blockKeycapMount [data-keycap-mount]').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.keycapMount === state.blockKeycapMount));
    if ($('hybridBodyControls')) ($('hybridBodyControls') as HTMLElement).hidden = state.importMode !== 'hybrid';
    if ($('blocksLegacyBaseControls')) ($('blocksLegacyBaseControls') as HTMLElement).hidden = state.importMode === 'hybrid';

    // Cáº­p nháº­t View Tabs
    getClickerDocument().querySelectorAll('#viewTabs button').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.view === state.view));

    // Cáº­p nháº­t Custom Äáº¿ Mode
    const isCustom = state.bottomBaseMode === 'custom';
    $('tab-base-match')?.classList.toggle('active', !isCustom);
    $('tab-base-custom')?.classList.toggle('active', isCustom);
    if ($('bottom-upload-zone')) $('bottom-upload-zone').style.display = isCustom ? 'block' : 'none';

    // ðŸŸ¢ Äá»“ng bá»™ Solid Base (Náº±m ÄÃšNG BÃŠN TRONG hÃ m update)
    if ($('bottomSolidOnly')) $<HTMLInputElement>('bottomSolidOnly').checked = !!(state as any).bottomSolidOnly;

    // ðŸŸ¢ Äá»“ng bá»™ UI Khá»‘i 3D Bá» máº·t (Náº±m ÄÃšNG BÃŠN TRONG hÃ m update)
    const topProfile = (state as any).topProfile || 'flat';
    if ($('topProfileTabs')) {
      $('topProfileTabs').querySelectorAll('button').forEach(b => 
        b.classList.toggle('active', (b as HTMLElement).dataset.profile === topProfile)
      );
    }
    if ($('profileHeightRow')) {
      $('profileHeightRow').style.display = topProfile === 'flat' ? 'none' : 'block';
    }
    const pHeight = (state as any).topProfileHeight || 5.0;
    if ($('profileHeight')) $<HTMLInputElement>('profileHeight').value = String(pHeight);
    if ($('profileHeightVal')) $('profileHeightVal').textContent = `${pHeight.toFixed(1)} mm`;

    // Cáº­p nháº­t Tráº¡ng thÃ¡i NÃºt
    if ($('export')) $<HTMLButtonElement>('export').disabled = !state.hasParts || state.building;
    if ($('exportStl')) $<HTMLButtonElement>('exportStl').disabled = !state.hasParts || state.building;
    if ($('undoBtn')) $<HTMLButtonElement>('undoBtn').disabled = !state.canUndo;
    if ($('redoBtn')) $<HTMLButtonElement>('redoBtn').disabled = !state.canRedo;
    if ($('refreshBtn')) $<HTMLButtonElement>('refreshBtn').disabled = !state.canRefresh;

    // Loading Overlay
    if ($('loadingOverlay')) {
      if (state.building) { $('loadingOverlay').removeAttribute('hidden'); $('loadingOverlay').querySelector('.loading-text')!.textContent = state.status; }
      else { $('loadingOverlay').setAttribute('hidden', ''); }
    }

    // Render Báº£ng mÃ u
    renderPalette(state.palette, state.bodyColorRgb, cb, state.colorMode, state.limitedColors);

    // Edit Mode UI
    getClickerDocument().querySelectorAll('.edit-mode-btn').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.editmode === state.editMode));
    
    const showLetters = state.importMode === 'text' && (state.editMode === 'color' || state.editMode === 'extrude');
    $('lettersToggle')?.toggleAttribute('hidden', !showLetters);
    if ($('separateLetters')) $<HTMLInputElement>('separateLetters').checked = state.separateLetters;

    if ($('extrudePanel')) {
      if (state.editMode === 'extrude') {
        $('extrudePanel').removeAttribute('hidden');
        if ($('extrudeChamfer')) $<HTMLInputElement>('extrudeChamfer').checked = state.extrudeChamfer;
        if (state.selectedParts.length > 0) {
          $<HTMLButtonElement>('extrudePlus').disabled = false; $<HTMLButtonElement>('extrudeMinus').disabled = false;
          const level = state.componentHeights[state.selectedParts[0]] ?? 0;
          $('extrudeLevelLabel').textContent = state.selectedParts.length > 1 ? `${state.selectedParts.length} parts selected Â· Level: ${level.toFixed(1)}` : `Level: ${level.toFixed(1)}`;
        } else {
          $<HTMLButtonElement>('extrudePlus').disabled = true; $<HTMLButtonElement>('extrudeMinus').disabled = true;
          $('extrudeLevelLabel').textContent = 'Select a part';
        }
      } else {
        $('extrudePanel').setAttribute('hidden', '');
      }
    }

    if ($('edgesPanel') && $('edgesContent') && $('edgesTitle')) {
      if (state.editMode === 'edges') {
        $('edgesPanel').removeAttribute('hidden');
        if (state.selectedParts.length === 0) {
          $('edgesTitle').textContent = 'Edge Modifications';
          $('edgesContent').innerHTML = `<div class="edges-empty">Click a part on the model to round or bevel its top edge.</div>`;
        } else {
          $('edgesTitle').textContent = 'Part Edges';
          const targets = state.selectedParts;
          const currentTargets = Array.from($('edgesContent').querySelectorAll('.edge-style-btns')).map(r => (r as HTMLElement).dataset.edge);
          if (targets.join(',') !== currentTargets.join(',')) {
            $('edgesContent').innerHTML = targets.map((t: string) => `
              <div class="edge-label" title="${t}" style="margin-bottom: 4px;">${friendlyTargetLabel(t)} <span class="edge-radius-label" style="color:var(--muted);"></span></div>
              <div class="edge-style-btns" data-edge="${t}" style="margin-bottom: 8px;">
                <button class="edge-style-btn active" data-style="none" type="button">None</button><button class="edge-style-btn" data-style="fillet" type="button">Fillet</button><button class="edge-style-btn" data-style="chamfer" type="button">Chamfer</button>
              </div>
              <div class="edge-size-btns" data-edge="${t}" style="gap:8px; margin-bottom: 12px; display: none;">
                <button class="btn edge-size-minus" type="button" style="flex:1;">-</button><button class="btn edge-size-plus" type="button" style="flex:1;">+</button>
              </div>
            `).join('');
          }
          for (const target of targets) {
            const es = state.edgeSettings.find((s: any) => s.target === target) || { target, style: 'none' as EdgeStyle, radius: 1.0 };
            const btnsRow = $('edgesContent').querySelector(`.edge-style-btns[data-edge="${target}"]`) as HTMLElement;
            const sizeRow = $('edgesContent').querySelector(`.edge-size-btns[data-edge="${target}"]`) as HTMLElement;
            if (btnsRow) btnsRow.querySelectorAll('.edge-style-btn').forEach((b: Element) => b.classList.toggle('active', (b as HTMLElement).dataset.style === es.style));
            if (sizeRow) {
              sizeRow.style.display = es.style === 'none' ? 'none' : 'flex';
              const safeRadius = es.radius !== undefined ? es.radius : 1.0;
              ($('edgesContent').querySelector(`.edge-label[title="${target}"] .edge-radius-label`) as HTMLElement).textContent = es.style === 'none' ? '' : `(${safeRadius.toFixed(1)} mm)`;
            }
          }
        }
      } else {
        $('edgesPanel').setAttribute('hidden', '');
      }
    }
  }

  // --- TRáº¢ Vá»€ CÃC HÃ€M Xá»¬ LÃ (Náº°M NGOÃ€I HÃ€M UPDATE) ---
  return {
    update,
    hexRgb,
    showColorPopoverAt,
    addUploadedSvg: (svgText: string, name: string) => addUploadedSvgElement(svgText, name, cb),
    addFontOption: (font: any, autoSelect = false) => addFontToGrid(font, cb, autoSelect)
  };
}



