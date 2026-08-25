import { LogOut } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { signOutAdmin } from './lib/supabase';

type AdminWorkspaceNavProps = { compact?: boolean };

const workspaces = [
  { to: '/admin/clicker', label: 'Clicker', mark: 'C' },
  { to: '/admin/svg-layers', label: 'SVG Layers', mark: 'S' },
  { to: '/admin/image-vectorizer', label: 'Vectorizer', mark: 'V' },
  { to: '/admin/flex-keychain', label: 'Flex Keychain', mark: 'K' },
  { to: '/admin/flex-organizer', label: 'Flex Organizer', mark: 'O' },
  { to: '/admin/flex-lamp', label: 'Flex Lamp', mark: 'L' },
  { to: '/admin/paramacraft', label: 'ParamaCraft', mark: 'P' },
  { to: '/admin/module-studio', label: 'Module Studio', mark: 'M' },
  { to: '/admin/hunyuan-3d', label: 'Hunyuan 3D', mark: '3D' },
  { to: '/admin/price-reader', label: 'Price Reader', mark: '¥' },
];

export function AdminWorkspaceNav({ compact = false }: AdminWorkspaceNavProps) {
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await signOutAdmin();
    navigate('/admin', { replace: true });
  };

  return <nav className={`admin-workspace-nav${compact ? ' compact' : ''}`} aria-label="Admin workspaces">
    <NavLink className="admin-workspace-nav-home" to="/admin" end><span className="admin-workspace-nav-mark">A</span><span>Admin</span></NavLink>
    <div className="admin-workspace-nav-links">{workspaces.map((workspace) => <NavLink key={workspace.to} to={workspace.to} className={({ isActive }) => `admin-workspace-nav-link${isActive ? ' active' : ''}`}><span className="admin-workspace-nav-mark">{workspace.mark}</span><span>{workspace.label}</span></NavLink>)}</div>
    <button type="button" className="admin-workspace-nav-signout" onClick={() => { void handleSignOut(); }} aria-label="Sign out"><LogOut size={14} /><span>Sign out</span></button>
  </nav>;
}
