import { useEffect, useRef, useState } from 'react';
import type { ClickerMode } from './clicker/bootstrap';
import { bootstrapClickerWorkspace, unmountClickerWorkspace } from './clicker/bootstrap';
import clickerStyle from './clicker/style.css?inline';
import flexKeychainStyle from './clicker/features/flexKeychain/styles.css?inline';
import flexOrganizerStyle from './clicker/features/flexOrganizer/styles.css?inline';
import imageKeychainStyle from './clicker/features/imageKeychain/styles.css?inline';

type ClickerWorkspaceLabels = {
  clicker: string;
  flexKeychain: string;
  flexOrganizer: string;
};

const runtimeOverrides = `
:host { display: block; position: relative; height: 100%; min-height: 0; overflow: hidden; color-scheme: dark; --bg: #15171c; --panel: #1d2027; --panel-2: #252932; --line: #2f3440; --text: #e6e9ef; --muted: #9aa3b2; --accent: #f0b967; --accent-text: #17120b; --accent-2: #36c08a; }
:host([data-theme='light']) { color-scheme: light; --bg: #f3f4f6; --panel: #ffffff; --panel-2: #edf0f5; --line: #d1d5db; --text: #1f2937; --muted: #6b7280; --accent: #b7791f; --accent-text: #ffffff; --accent-2: #10b981; }
:host, .clicker-surface { background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
.clicker-surface { height: 100%; min-height: 0; overflow: hidden; }
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
.only-dark { display: inline-block !important; }
.only-light { display: none !important; }
`;

function ClickerRuntime({ mode }: { mode: ClickerMode }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    shadow.replaceChildren();
    const style = document.createElement('style');
    style.textContent = `${clickerStyle}\n${flexKeychainStyle}\n${flexOrganizerStyle}\n${imageKeychainStyle}\n${runtimeOverrides}`;
    const surface = document.createElement('div');
    surface.className = 'clicker-surface';
    shadow.append(style, surface);
    let controller: { destroy?: () => void } | void;
    try {
      controller = bootstrapClickerWorkspace(surface, mode) as { destroy?: () => void } | void;
    } catch (error) {
      surface.textContent = error instanceof Error ? error.message : String(error);
    }
    return () => {
      controller?.destroy?.();
      unmountClickerWorkspace(surface);
      shadow.replaceChildren();
    };
  }, [mode]);

  return <div className="clicker-runtime" ref={hostRef} />;
}

export function ClickerWorkspacePage({ labels, initialMode = 'clicker', showModeTabs = true }: { labels: ClickerWorkspaceLabels; initialMode?: ClickerMode; showModeTabs?: boolean }) {
  const [mode, setMode] = useState<ClickerMode>(initialMode);
  const modes: Array<[ClickerMode, string]> = [['clicker', labels.clicker], ['flex-keychain', labels.flexKeychain], ['flex-organizer', labels.flexOrganizer]];
  return <div className={`clicker-workspace-shell ${showModeTabs ? '' : 'clicker-workspace-shell-standalone'}`}>{showModeTabs && <div className="clicker-mode-tabs" role="tablist">{modes.map(([value, label]) => <button key={value} className={mode === value ? 'active' : ''} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)}>{label}</button>)}</div>}<ClickerRuntime key={mode} mode={mode} /></div>;
}
