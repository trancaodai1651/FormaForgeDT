import { useEffect, useState } from 'react';
import { Check, LogOut, Save, UserRound } from 'lucide-react';
import { GlassButton } from './components/Shell';
import { authConfigured, getCurrentUser, getDefaultCustomerAddress, saveDefaultCustomerAddress, signInCustomer, signOutAdmin, signUpCustomer, type CustomerAddressInput } from './lib/supabase';
import { useI18n } from './lib/i18n';

type Mode = 'login' | 'register';
const emptyAddress: CustomerAddressInput = { recipient_name: '', email: '', phone: '', address: '' };

export function AccountPage() {
  const { t } = useI18n();
  const [user, setUser] = useState<import('@supabase/supabase-js').User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [address, setAddress] = useState<CustomerAddressInput>(emptyAddress); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');

  useEffect(() => { getCurrentUser().then(async (currentUser) => { setUser(currentUser); if (currentUser) { const saved = await getDefaultCustomerAddress(currentUser.id); if (saved) setAddress({ recipient_name: saved.recipient_name, email: saved.email, phone: saved.phone, address: saved.address }); else setAddress((current) => ({ ...current, email: currentUser.email ?? '' })); } }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : t('common.error'))).finally(() => setLoading(false)); }, [t]);

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage('');
    try {
      if (mode === 'login') setUser(await signInCustomer(email, password));
      else { const result = await signUpCustomer(email, password, name); setUser(result.user); if (!result.session) setMessage(t('auth.confirmEmail')); }
    } catch (authError) { setError(authError instanceof Error ? authError.message : t('auth.invalid')); }
  };
  const submitAddress = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); setError(''); setMessage(''); try { await saveDefaultCustomerAddress(address, user?.id); setMessage(t('account.saved')); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : t('common.error')); } finally { setSaving(false); } };
  const updateAddress = (key: keyof CustomerAddressInput, value: string) => setAddress((current) => ({ ...current, [key]: value }));

  if (loading) return <div className="container page-section empty-state"><UserRound /><p>{t('auth.loading')}</p></div>;
  if (!authConfigured) return <div className="container page-section empty-state"><UserRound /><h3>{t('admin.notConfigured')}</h3></div>;
  if (!user) return <div className="container page-section account-page"><div className="page-intro compact-intro"><span className="eyebrow">{t('account.eyebrow')}</span><h1 dangerouslySetInnerHTML={{ __html: t('account.title') }} /><p>{t(mode === 'login' ? 'auth.loginHint' : 'auth.registerHint')}</p></div><form className="account-auth-form" onSubmit={submitAuth}>{mode === 'register' && <label>{t('auth.name')}<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder={t('auth.namePlaceholder')} /></label>}<label>{t('auth.email')}<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>{t('auth.password')}<input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <div className="error-box">{error}</div>}{message && <div className="success-box">{message}</div>}<GlassButton className="full-width">{mode === 'login' ? t('auth.login') : t('auth.register')} <Check size={16} /></GlassButton></form><p className="account-switch">{mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')} <button className="text-link" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? t('auth.switchRegister') : t('auth.switchLogin')}</button></p></div>;

  return <div className="container page-section account-page"><div className="account-header"><div><span className="eyebrow">{t('account.eyebrow')}</span><h1>{user.user_metadata?.display_name ?? user.email}</h1><p>{user.email}</p></div><button className="text-link account-logout" onClick={() => { void signOutAdmin().then(() => setUser(null)); }}><LogOut size={15} /> {t('auth.logout')}</button></div><section className="account-card"><div className="account-card-heading"><div><span className="eyebrow">{t('account.addressTitle')}</span><h2>{t('account.addressTitle')}</h2></div><UserRound size={22} /></div><p className="muted">{t('account.addressHint')}</p><form className="account-address-form" onSubmit={submitAddress}><label>{t('account.recipient')}<input required minLength={2} value={address.recipient_name} onChange={(event) => updateAddress('recipient_name', event.target.value)} /></label><label>{t('account.email')}<input required type="email" value={address.email} onChange={(event) => updateAddress('email', event.target.value)} /></label><label>{t('account.phone')}<input required value={address.phone} onChange={(event) => updateAddress('phone', event.target.value)} /></label><label className="wide">{t('account.address')}<textarea required minLength={5} value={address.address} onChange={(event) => updateAddress('address', event.target.value)} /></label>{error && <div className="error-box wide">{error}</div>}{message && <div className="success-box wide">{message}</div>}<GlassButton disabled={saving}>{saving ? t('account.saving') : t('account.save')} <Save size={15} /></GlassButton></form></section></div>;
}
