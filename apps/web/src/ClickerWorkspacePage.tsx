import { useEffect, useRef, useState } from 'react';
import type { ClickerMode } from './clicker/bootstrap';
import { bootstrapClickerWorkspace, unmountClickerWorkspace } from './clicker/bootstrap';
import clickerStyle from './clicker/style.css?inline';
import flexKeychainStyle from './clicker/features/flexKeychain/styles.css?inline';
import flexOrganizerStyle from './clicker/features/flexOrganizer/styles.css?inline';
import type { ClickerLanguage } from './clicker/i18n';

type ClickerWorkspaceLabels = {
  clicker: string;
  flexKeychain: string;
  flexOrganizer: string;
};

const runtimeOverrides = `
:host { display: block; position: relative; height: 100%; min-height: 0; overflow: hidden; color-scheme: dark; --bg: #0b0c0e; --panel: #16191b; --panel-2: #1d2124; --line: rgba(255,255,255,.12); --text: #f2f0ea; --muted: #a9aba5; --accent: #f0b967; --accent-text: #17130d; --accent-2: #3fc58a; }
:host([data-theme='light']) { color-scheme: light; --bg: #f3f4f6; --panel: #ffffff; --panel-2: #edf0f5; --line: #d1d5db; --text: #1f2937; --muted: #6b7280; --accent: #b7791f; --accent-text: #ffffff; --accent-2: #10b981; }
:host, .clicker-surface { background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
.clicker-surface { height: 100%; min-height: 0; overflow: hidden; border-radius: inherit; background: var(--bg); }
#layout { grid-template-columns: minmax(250px, 294px) minmax(0, 1fr) minmax(340px, 420px); background: #0b0c0e; }
#viewport { background: radial-gradient(circle at 50% 38%, rgba(240,185,103,.10), transparent 30%), linear-gradient(145deg, #101316 0%, #0d0f11 70%); }
.sidebar { padding: 22px 18px; background: linear-gradient(180deg, rgba(22,25,27,.98), rgba(15,17,19,.98)); backdrop-filter: blur(18px); }
.sidebar.left { border-right-color: rgba(255,255,255,.10); }
.sidebar.right { border-left-color: rgba(255,255,255,.10); }
.app-header { gap: 8px; padding-bottom: 20px; border-bottom: 1px solid var(--line); }
.app-header h1 { font-family: 'Manrope', system-ui, sans-serif; font-size: 22px; letter-spacing: -.045em; }
.app-subtitle { max-width: 230px; color: var(--muted); font-size: 11px; line-height: 1.55; }
.btn-back-home { align-self: flex-start; min-height: 34px; padding: 0 12px; border-radius: 11px; background: rgba(255,255,255,.045); color: var(--muted); font-size: 11px; }
.btn-back-home:hover { background: rgba(240,185,103,.11); color: var(--accent); }
.section { padding: 18px 0; }
.label, details.section-collapsible > summary { color: var(--muted); font: 600 10px/1.35 'DM Mono', monospace; letter-spacing: .10em; text-transform: uppercase; }
.field label, .prow-header > label, .switch-row .switch-label { font-size: 11px; }
.prow-stacked { gap: 8px; margin-bottom: 16px; }
.prow-stacked .val, .field input, .field select, textarea, input { border-color: rgba(255,255,255,.12); border-radius: 10px; background: #1d2124; font-size: 12px; }
button { border-radius: 10px; font-size: 12px; }
button.primary, .tab.active, .shape-group button.active, .btn.primary { border-color: var(--accent); border-radius: 11px; background: var(--accent); color: var(--accent-text); }
button.secondary, .utility-btn { border-color: rgba(255,255,255,.14); border-radius: 11px; background: rgba(255,255,255,.035); color: var(--text); }
button.secondary:hover, .utility-btn:hover { border-color: rgba(240,185,103,.65); background: rgba(240,185,103,.10); color: var(--accent); }
.tabs, .import-grid, .sample-inline-item, .fil-row { border-color: rgba(255,255,255,.10); background: rgba(255,255,255,.035); }
.tab { border-radius: 8px; color: var(--muted); }
.drop { border-color: rgba(240,185,103,.85); outline-color: rgba(240,185,103,.20); border-radius: 14px; background: rgba(240,185,103,.045); }
.sample-inline-item { border-radius: 12px; padding: 7px; }
.sample-inline-item:hover { border-color: var(--accent); background: rgba(240,185,103,.10); }
.sidebar-sticky-footer { margin-right: -18px; margin-left: -18px; padding: 15px 18px 18px; border-top-color: rgba(255,255,255,.10); background: rgba(22,25,27,.97); }
#status { left: 18px; bottom: 18px; border-color: rgba(255,255,255,.14); border-radius: 12px; background: rgba(22,25,27,.86); box-shadow: 0 14px 35px rgba(0,0,0,.22); font: 500 10px/1.4 'DM Mono', monospace; }
#tool-screen { display: block !important; height: 100%; min-height: 0; opacity: 1 !important; }
#layout { width: 100%; height: 100%; min-height: 0; }
.flex-shell, #flex-organizer { position: absolute !important; inset: 0 !important; width: 100%; height: 100%; }
.flex-topbar, .org-topbar { height: 66px; padding-inline: 24px; }
.flex-main { inset: 66px 0 0; grid-template-columns: minmax(0, 1fr) clamp(380px, 31vw, 480px); }
.flex-sidebar { padding: 24px 22px 32px; }
.flex-sidebar-title h1, .org-sidebar-heading h1 { font-size: 22px; }
.flex-card { padding: 16px; border-radius: 15px; }
.org-main { inset: 66px 0 0; grid-template-columns: minmax(0, 1fr) clamp(420px, 35vw, 540px); }
.org-sidebar { padding: 22px 20px 30px; }
.org-sidebar-heading { padding: 4px 7px 18px; }
.org-section summary { padding-inline: 7px; }
.org-section-body { padding-inline: 7px; }
.org-sidebar-footer { margin-inline: -20px; padding-inline: 20px; }
@media (max-width: 820px) {
  .flex-main { grid-template-columns: minmax(0, 1fr) 350px; }
  .org-main { grid-template-columns: minmax(0, 1fr) 390px; }
}
@media (max-width: 680px) {
  .flex-topbar, .org-topbar { height: 58px; padding-inline: 16px; }
  .flex-main { inset: 58px 0 0; }
  .org-main { inset: 58px 0 0; }
  .org-sidebar-footer { margin-inline: -14px; padding-inline: 14px; }
}
@media (max-width: 980px) { #layout { grid-template-columns: 240px minmax(0, 1fr) 320px; } }
@media (max-width: 760px) {
  #layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(360px, 1fr) auto; overflow: auto; }
  #viewport { min-height: 420px; }
}
.only-dark { display: inline-block !important; }
.only-light { display: none !important; }
`;

function ClickerRuntime({ mode, language }: { mode: ClickerMode; language: ClickerLanguage }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    shadow.replaceChildren();
    const style = document.createElement('style');
    style.textContent = `${clickerStyle}\n${flexKeychainStyle}\n${flexOrganizerStyle}\n${runtimeOverrides}`;
    const surface = document.createElement('div');
    surface.className = 'clicker-surface';
    shadow.append(style, surface);
    let controller: { destroy?: () => void } | void;
    try {
      controller = bootstrapClickerWorkspace(surface, mode, language) as { destroy?: () => void } | void;
    } catch (error) {
      surface.textContent = error instanceof Error ? error.message : String(error);
    }
    return () => {
      controller?.destroy?.();
      unmountClickerWorkspace(surface);
      shadow.replaceChildren();
    };
  }, [mode, language]);

  return <div className="clicker-runtime" ref={hostRef} />;
}

export function ClickerWorkspacePage({ labels, initialMode = 'clicker', showModeTabs = true, language = 'en' }: { labels: ClickerWorkspaceLabels; initialMode?: ClickerMode; showModeTabs?: boolean; language?: ClickerLanguage }) {
  const [mode, setMode] = useState<ClickerMode>(initialMode);
  const modes: Array<[ClickerMode, string]> = [['clicker', labels.clicker], ['flex-keychain', labels.flexKeychain], ['flex-organizer', labels.flexOrganizer]];
  return <div className={`clicker-workspace-shell ${showModeTabs ? '' : 'clicker-workspace-shell-standalone'}`}>{showModeTabs && <div className="clicker-mode-tabs" role="tablist">{modes.map(([value, label]) => <button key={value} className={mode === value ? 'active' : ''} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)}>{label}</button>)}</div>}<ClickerRuntime key={`${mode}-${language}`} mode={mode} language={language} /></div>;
}
