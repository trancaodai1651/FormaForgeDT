import { LogOut } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { signOutAdmin } from './lib/supabase';
import { useI18n } from './lib/i18n';

type AdminWorkspaceNavProps = { compact?: boolean };
type WorkspaceLink = { to: string; label: string; mark: string; labelKey?: string };

const workspaces: WorkspaceLink[] = [
  { to: '/admin/clicker', label: 'Clicker', mark: 'C' },
  { to: '/admin/svg-layers', label: 'SVG Layers', mark: 'S' },
  { to: '/admin/image-vectorizer', label: 'Vectorizer', mark: 'V' },
  { to: '/admin/flex-keychain', label: 'Flex Keychain', mark: 'K' },
  { to: '/admin/flex-organizer', label: 'Flex Organizer', mark: 'O' },
  { to: '/admin/flex-lamp', label: 'Flex Lamp', mark: 'L' },
  { to: '/admin/paramacraft', label: 'ParamaCraft', mark: 'P' },
  { to: '/admin/module-studio', label: 'Module Studio', mark: 'M' },
  { to: '/admin/cad-studio', label: 'CAD Studio', labelKey: 'admin.cadStudio', mark: 'CAD' },
  { to: '/admin/hunyuan-3d', label: 'Hunyuan 3D', mark: '3D' },
  { to: '/admin/price-reader', label: 'Price Reader', mark: '¥' },
  { to: '/admin/tulip-creator', label: 'Tulip Creator', labelKey: 'admin.tulipCreator', mark: 'TC' },
  { to: '/admin/home-item', label: 'Home Item', labelKey: 'admin.homeItem', mark: 'HI' },
  { to: '/admin/stl-cutter', label: 'STL Cutter', labelKey: 'admin.stlCutter', mark: 'STL' },
];

export function AdminWorkspaceNav({ compact = false }: AdminWorkspaceNavProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const handleSignOut = async () => {
    await signOutAdmin();
    navigate('/admin', { replace: true });
  };

  return <nav className={`admin-workspace-nav${compact ? ' compact' : ''}`} aria-label="Admin workspaces">
    <NavLink className="admin-workspace-nav-home" to="/admin" end><span className="admin-workspace-nav-mark">A</span><span>Admin</span></NavLink>
    <div className="admin-workspace-nav-links">{workspaces.map((workspace) => <NavLink key={workspace.to} to={workspace.to} className={({ isActive }) => `admin-workspace-nav-link${isActive ? ' active' : ''}`}><span className="admin-workspace-nav-mark">{workspace.mark}</span><span>{workspace.labelKey ? t(workspace.labelKey) : workspace.label}</span></NavLink>)}</div>
    <button type="button" className="admin-workspace-nav-signout" onClick={() => { void handleSignOut(); }} aria-label={t('admin.signOut')}><LogOut size={14} /><span>{t('admin.signOut')}</span></button>
  </nav>;
}
