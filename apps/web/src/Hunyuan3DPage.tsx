import { ArrowLeft, CheckCircle2, Cpu, Download, ExternalLink, Info, Play, RefreshCw, ShieldCheck, Terminal, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { AdminGuard } from './AdminGuard';
import { useI18n } from './lib/i18n';

const HUNYUAN_REPO_URL = 'https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1';
const DESKTOP_DOWNLOAD_URL = (import.meta.env.VITE_DESKTOP_DOWNLOAD_URL as string | undefined) || 'https://github.com/trancaodai1651/FormaForgeDT/releases/latest';

type HunyuanStatus = {
  configured: boolean;
  pythonFound: boolean;
  repositoryFound: boolean;
  home: string | null;
  pythonVersion: string | null;
  message: string;
};

type TauriInternals = { invoke?: (command: string, args?: Record<string, unknown>) => Promise<unknown> };

function getDesktopInvoke() {
  const internals = (window as unknown as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
  return internals?.invoke;
}

function isDesktopShell() {
  const appWindow = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown };
  return Boolean(appWindow.__TAURI_INTERNALS__ || appWindow.__TAURI__);
}

export function Hunyuan3DPage() {
  return <AdminGuard>{() => <Hunyuan3DWorkspace />}</AdminGuard>;
}

function Hunyuan3DWorkspace() {
  const { t, language, toggleLanguage } = useI18n();
  const desktop = useMemo(isDesktopShell, []);
  const [status, setStatus] = useState<HunyuanStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');

  const checkEngine = async () => {
    const invoke = getDesktopInvoke();
    if (!invoke) {
      setError(t('admin.hunyuan3dDesktopOnly'));
      return;
    }
    setChecking(true);
    setError('');
    try {
      setStatus(await invoke('hunyuan3d_status') as HunyuanStatus);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('admin.hunyuan3dCheckError'));
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (desktop) void checkEngine();
  }, [desktop]);

  const launchEngine = async () => {
    const invoke = getDesktopInvoke();
    if (!invoke) return;
    setLaunching(true);
    setError('');
    try {
      await invoke('hunyuan3d_launch');
      await checkEngine();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('admin.hunyuan3dLaunchError'));
    } finally {
      setLaunching(false);
    }
  };

  return <main className="hunyuan3d-page">
    <header className="hunyuan3d-topbar">
      <Link className="hunyuan3d-back" to="/admin"><ArrowLeft size={15} />{t('admin.backToDashboard')}</Link>
      <div className="hunyuan3d-topbar-actions"><button type="button" onClick={toggleLanguage}>{language === 'vi' ? 'EN' : 'VI'}</button><a href={HUNYUAN_REPO_URL} target="_blank" rel="noreferrer"><ExternalLink size={14} />{t('admin.hunyuan3dSource')}</a></div>
    </header>
    <section className="hunyuan3d-hero">
      <div><span className="eyebrow"><ShieldCheck size={13} /> {t('admin.hunyuan3dEyebrow')}</span><h1>{t('admin.hunyuan3dTitle')}</h1><p>{t('admin.hunyuan3dIntro')}</p></div>
      <span className={`hunyuan3d-runtime-pill ${desktop ? 'desktop' : 'web'}`}><span className="live-dot" />{desktop ? t('admin.hunyuan3dDesktopRuntime') : t('admin.hunyuan3dWebRuntime')}</span>
    </section>
    {!desktop ? <section className="hunyuan3d-gate"><div className="hunyuan3d-gate-icon"><Cpu size={28} /></div><div><span className="eyebrow">{t('admin.hunyuan3dDesktopRequired')}</span><h2>{t('admin.hunyuan3dInstallTitle')}</h2><p>{t('admin.hunyuan3dInstallText')}</p><a className="hunyuan3d-primary-action" href={DESKTOP_DOWNLOAD_URL} target="_blank" rel="noreferrer"><Download size={16} />{t('admin.hunyuan3dDownloadDesktop')}</a><small>{t('admin.hunyuan3dInstallHint')}</small></div></section> : <>
      <section className="hunyuan3d-status-grid">
        <article className="hunyuan3d-status-card"><span><Cpu size={15} />{t('admin.hunyuan3dEngineStatus')}</span><strong className={status?.configured ? 'ready' : 'warning'}>{status?.configured ? t('admin.hunyuan3dReady') : t('admin.hunyuan3dNeedsSetup')}</strong><small>{status?.message || t('admin.hunyuan3dChecking')}</small></article>
        <article className="hunyuan3d-status-card"><span><Terminal size={15} />{t('admin.hunyuan3dPython')}</span><strong className={status?.pythonFound ? 'ready' : 'warning'}>{status?.pythonFound ? (status.pythonVersion || t('admin.hunyuan3dDetected')) : t('admin.hunyuan3dNotDetected')}</strong><small>{t('admin.hunyuan3dPythonHint')}</small></article>
        <article className="hunyuan3d-status-card"><span><CheckCircle2 size={15} />{t('admin.hunyuan3dRepository')}</span><strong className={status?.repositoryFound ? 'ready' : 'warning'}>{status?.repositoryFound ? t('admin.hunyuan3dDetected') : t('admin.hunyuan3dNotDetected')}</strong><small>{status?.home || t('admin.hunyuan3dHomeHint')}</small></article>
      </section>
      <section className="hunyuan3d-workspace-card"><div className="hunyuan3d-section-heading"><div><span className="eyebrow">{t('admin.hunyuan3dLocalBridge')}</span><h2>{t('admin.hunyuan3dLaunchTitle')}</h2></div><button className="hunyuan3d-secondary-action" type="button" onClick={() => void checkEngine()} disabled={checking}><RefreshCw size={15} />{checking ? t('admin.hunyuan3dChecking') : t('admin.hunyuan3dCheck')}</button></div><p>{t('admin.hunyuan3dLaunchText')}</p><button className="hunyuan3d-primary-action" type="button" onClick={() => void launchEngine()} disabled={launching || !status?.configured}><Play size={16} />{launching ? t('admin.hunyuan3dLaunching') : t('admin.hunyuan3dLaunch')}</button>{!status?.configured && <small className="hunyuan3d-inline-hint"><Info size={14} />{t('admin.hunyuan3dConfigHint')}</small>}</section>
    </>}
    {error && <div className="error-box hunyuan3d-error"><XCircle size={15} />{error}</div>}
    <section className="hunyuan3d-info-grid"><article><span className="eyebrow">{t('admin.hunyuan3dSetupEyebrow')}</span><h2>{t('admin.hunyuan3dSetupTitle')}</h2><ol><li>{t('admin.hunyuan3dStepOne')}</li><li>{t('admin.hunyuan3dStepTwo')}</li><li>{t('admin.hunyuan3dStepThree')}</li></ol></article><article><span className="eyebrow">{t('admin.hunyuan3dHardwareEyebrow')}</span><h2>{t('admin.hunyuan3dHardwareTitle')}</h2><p>{t('admin.hunyuan3dHardwareText')}</p><a className="hunyuan3d-text-link" href={HUNYUAN_REPO_URL} target="_blank" rel="noreferrer">{t('admin.hunyuan3dReadDocs')} <ExternalLink size={14} /></a></article></section>
  </main>;
}
