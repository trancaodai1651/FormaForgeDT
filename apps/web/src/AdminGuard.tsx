import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { GlassButton } from './components/Shell';
import { useI18n } from './lib/i18n';
import { authConfigured, getCurrentAdminUser, signInAdmin, signOutAdmin } from './lib/supabase';

type AdminGuardProps = { children: (user: User) => ReactNode };

export function AdminGuard({ children }: AdminGuardProps) {
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    getCurrentAdminUser().then(setUser).finally(() => setLoading(false));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSigningIn(true);
    try {
      await signInAdmin(email, password);
      const admin = await getCurrentAdminUser();
      if (!admin) {
        await signOutAdmin();
        throw new Error(t('admin.forbidden'));
      }
      setUser(admin);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : t('auth.invalid'));
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) return <div className="container page-section empty-state admin-guard-loading"><Sparkles /><p>{t('auth.loading')}</p></div>;
  if (!user) return <div className="container page-section admin-guard-login"><div className="admin-guard-card"><span className="eyebrow"><ShieldCheck size={14} /> {t('admin.eyebrow')}</span><h1>{t('admin.toolAccessTitle')}</h1><p>{authConfigured ? t('admin.toolAccessHint') : t('admin.notConfigured')}</p>{authConfigured && <form className="admin-login-form" onSubmit={submit}><label>{t('auth.email')}<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>{t('auth.password')}<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <div className="error-box">{error}</div>}<GlassButton className="full-width" disabled={signingIn}>{signingIn ? t('admin.signingIn') : t('admin.signIn')} <ArrowRight size={16} /></GlassButton></form>}</div></div>;

  return <>{children(user)}</>;
}
