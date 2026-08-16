import { ArrowLeft, ArrowRight, LogOut, ShieldCheck } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { ClickerMode } from './clicker/bootstrap';
import { AdminGuard } from './AdminGuard';
import { ClickerWorkspacePage } from './ClickerWorkspacePage';
import { useI18n } from './lib/i18n';
import { signOutAdmin } from './lib/supabase';

type ToolRoute = { mode: ClickerMode; path: string; label: string; short: string };

function AdminToolContent({ mode, email }: { mode: ClickerMode; email: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const tools: ToolRoute[] = [
    { mode: 'clicker', path: '/admin/clicker', label: t('admin.clicker'), short: 'C' },
    { mode: 'flex-keychain', path: '/admin/flex-keychain', label: t('admin.clickerFlexKeychain'), short: 'F' },
    { mode: 'flex-organizer', path: '/admin/flex-organizer', label: t('admin.clickerFlexOrganizer'), short: 'F' },
  ];
  const current = tools.find((tool) => tool.mode === mode) ?? tools[0];
  const currentIndex = tools.findIndex((tool) => tool.mode === current.mode) + 1;
  const title = mode === 'clicker' ? t('admin.clickerPageTitle') : mode === 'flex-keychain' ? t('admin.flexKeychainPageTitle') : t('admin.flexOrganizerPageTitle');
  const description = mode === 'clicker' ? t('admin.clickerPageDescription') : mode === 'flex-keychain' ? t('admin.flexKeychainPageDescription') : t('admin.flexOrganizerPageDescription');

  const signOut = async () => {
    await signOutAdmin();
    navigate('/admin');
  };

  return <div className={`admin-tool-page admin-tool-page-${mode}`}><div className="admin-tool-container">
    <header className="admin-studio-bar">
      <div className="admin-studio-identity">
        <Link className="admin-studio-back" to="/admin"><ArrowLeft size={15} /><span>{t('admin.backToDashboard')}</span></Link>
        <span className="admin-studio-divider" />
        <span className="admin-studio-mark">F</span>
        <div className="admin-studio-title"><span className="admin-studio-kicker">FORMAFORGE / ADMIN</span><strong>{current.label}</strong></div>
      </div>
      <div className="admin-studio-session"><span className="admin-studio-live"><span className="live-dot" /> {t('admin.adminOnly')}</span><span className="admin-studio-email">{email}</span><button className="admin-studio-signout" type="button" onClick={signOut}><LogOut size={14} /> <span>{t('admin.signOut')}</span></button></div>
    </header>
    <div className="admin-tool-nav-row">
      <div className="admin-tool-page-meta"><span className="admin-tool-page-number">0{currentIndex}</span><div><span className="eyebrow"><ShieldCheck size={12} /> {t('admin.toolWorkspace')}</span><strong>{title}</strong><small>{description}</small></div></div>
      <nav className="admin-tool-switcher" aria-label={t('admin.toolNavigation')}>
        {tools.map((tool) => <NavLink key={tool.path} to={tool.path} className={({ isActive }) => isActive ? 'active' : ''}><span>{tool.short}</span><b>{tool.label}</b><ArrowRight size={14} /></NavLink>)}
      </nav>
    </div>
    <section className="admin-tool-stage"><ClickerWorkspacePage initialMode={mode} showModeTabs={false} labels={{ clicker: t('admin.clicker'), flexKeychain: t('admin.clickerFlexKeychain'), flexOrganizer: t('admin.clickerFlexOrganizer') }} /></section>
  </div></div>;
}

export function AdminToolPage({ mode }: { mode: ClickerMode }) {
  return <AdminGuard>{(user) => <AdminToolContent mode={mode} email={user.email ?? ''} />}</AdminGuard>;
}
