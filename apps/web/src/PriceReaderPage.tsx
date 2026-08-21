import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleAlert, ExternalLink, Link2, RefreshCw, Save, Search, Store, Tag, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PriceReaderProduct } from '@hometown/types';
import { GlassButton } from './components/Shell';
import { AdminGuard } from './AdminGuard';
import { apiConfigured, deletePriceReaderProduct, inspectPriceReaderUrl, listPriceReaderProducts, refreshPriceReaderProduct, savePriceReaderProduct } from './lib/api';
import { getAccessToken, signOutAdmin } from './lib/supabase';
import { useI18n } from './lib/i18n';

const sourceKey: Record<string, string> = { taobao: 'admin.priceReaderSourceTaobao', tmall: 'admin.priceReaderSourceTmall', '1688': 'admin.priceReaderSource1688', pinduoduo: 'admin.priceReaderSourcePinduoduo', jd: 'admin.priceReaderSourceJd', xiaohongshu: 'admin.priceReaderSourceXiaohongshu' };
const cny = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 });
const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const dateFormat = (language: string) => new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

function priceVnd(amount: number, rate: number) { return vnd.format(Math.round(amount * rate)); }
function sourceName(product: PriceReaderProduct, t: (key: string) => string) { return t(sourceKey[product.source] ?? 'admin.priceReaderSource'); }

export function PriceReaderPage() {
  return <AdminGuard>{(user) => <PriceReaderWorkspace email={user.email ?? ''} />}</AdminGuard>;
}

function PriceReaderWorkspace({ email }: { email: string }) {
  const { t, language } = useI18n();
  const [url, setUrl] = useState('');
  const [current, setCurrent] = useState<PriceReaderProduct | null>(null);
  const [tracked, setTracked] = useState<PriceReaderProduct[]>([]);
  const [busy, setBusy] = useState<'read' | 'save' | 'refresh' | 'load' | ''>('');
  const [error, setError] = useState('');

  const loadTracked = async () => {
    if (!apiConfigured) return;
    const token = await getAccessToken();
    if (!token) return;
    setBusy('load');
    try { setTracked(await listPriceReaderProducts(token)); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : t('admin.priceReaderError')); } finally { setBusy(''); }
  };
  useEffect(() => { void loadTracked(); }, []);

  const readLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!url.trim()) { setError(t('admin.priceReaderError')); return; }
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('common.sessionExpired'));
      setBusy('read');
      setCurrent(await inspectPriceReaderUrl(url, token));
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : t('admin.priceReaderError')); } finally { setBusy(''); }
  };

  const saveCurrent = async () => {
    if (!current) return;
    setError('');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('common.sessionExpired'));
      setBusy('save');
      const saved = await savePriceReaderProduct(current.url, token);
      setCurrent(saved);
      setTracked((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : t('admin.priceReaderError')); } finally { setBusy(''); }
  };

  const refreshCurrent = async (product: PriceReaderProduct = current!) => {
    setError('');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('common.sessionExpired'));
      setBusy('refresh');
      const refreshed = await refreshPriceReaderProduct(product.id, token);
      setCurrent(refreshed);
      setTracked((items) => items.map((item) => item.id === refreshed.id ? refreshed : item));
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : t('admin.priceReaderError')); } finally { setBusy(''); }
  };

  const removeTracked = async (product: PriceReaderProduct) => {
    setError('');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('common.sessionExpired'));
      await deletePriceReaderProduct(product.id, token);
      setTracked((items) => items.filter((item) => item.id !== product.id));
      if (current?.id === product.id) setCurrent(null);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : t('admin.priceReaderError')); }
  };

  const selectedId = current?.id;
  const rateLabel = current ? `1 CNY = ${vnd.format(current.exchangeRateVnd)}` : '1 CNY = 3,500 ₫';
  const providerMissing = error.toLowerCase().includes('provider') || error.includes('PRICE_READER_PROVIDER_URL');

  return <main className="price-reader-page">
    <div className="price-reader-shell">
      <header className="price-reader-topbar">
        <div className="price-reader-identity"><Link className="price-reader-back" to="/admin"><ArrowLeft size={15} /> {t('admin.backToDashboard')}</Link><span className="price-reader-divider" /><span className="price-reader-mark">¥</span><div><span className="price-reader-kicker">{t('admin.priceReaderEyebrow')}</span><strong>{t('admin.priceReader')}</strong></div></div>
        <div className="price-reader-session"><span><span className="live-dot" /> {t('admin.adminOnly')}</span><small>{email}</small><button onClick={() => { void signOutAdmin().then(() => window.location.hash = '#/admin'); }}>{t('admin.signOut')}</button></div>
      </header>
      <div className="price-reader-nav"><div><span className="eyebrow">{t('admin.priceReaderEyebrow')}</span><h1>{t('admin.priceReaderPageTitle')}</h1><p>{t('admin.priceReaderPageDescription')}</p></div><span className="price-reader-rate"><span>{t('admin.priceReaderExchangeRate')}</span><strong>{rateLabel}</strong></span></div>
      <div className="price-reader-layout">
        <aside className="price-reader-sidebar">
          <section className="price-reader-card price-reader-import-card"><div className="price-reader-section-heading"><div><span className="eyebrow">01 / IMPORT</span><h2>{t('admin.priceReaderInputLabel')}</h2></div><Link2 size={17} /></div><form onSubmit={readLink}><input type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder={t('admin.priceReaderPlaceholder')} /><GlassButton className="full-width" disabled={busy === 'read' || !apiConfigured}>{busy === 'read' ? t('admin.priceReaderReading') : t('admin.priceReaderRead')} <Search size={15} /></GlassButton></form><p className="price-reader-supported">{t('admin.priceReaderSupported')}</p>{!apiConfigured && <div className="price-reader-warning"><CircleAlert size={16} /><span>{t('admin.apiMissing')}</span></div>}</section>
          <section className="price-reader-card"><div className="price-reader-section-heading"><div><span className="eyebrow">02 / TRACKING</span><h2>{t('admin.priceReaderTracked')}</h2></div><button className="icon-button" onClick={() => void loadTracked()} disabled={busy === 'load'} aria-label={t('admin.priceReaderRefresh')}><RefreshCw size={15} /></button></div>{tracked.length ? <div className="price-reader-tracked-list">{tracked.map((product) => <button className={`price-reader-tracked-item ${selectedId === product.id ? 'active' : ''}`} key={product.id} onClick={() => { setCurrent(product); setUrl(product.url); }}><span className="price-reader-source-dot">{product.source === '1688' ? '8' : product.source.slice(0, 1).toUpperCase()}</span><span><strong>{product.title}</strong><small>{sourceName(product, t)} · {dateFormat(language).format(new Date(product.updatedAt))}</small></span><ArrowRight size={14} /></button>)}</div> : <div className="price-reader-empty"><Tag size={18} /><strong>{t('admin.priceReaderNoTracked')}</strong><p>{t('admin.priceReaderNoTrackedText')}</p></div>}</section>
        </aside>
        <section className="price-reader-main">
          {!current ? <div className="price-reader-empty-state"><span className="price-reader-empty-mark"><Search size={25} /></span><span className="eyebrow">{t('admin.priceReaderSnapshot')}</span><h2>{t('admin.priceReaderPageTitle')}</h2><p>{t('admin.priceReaderIntro')}</p><div className="price-reader-empty-line" /></div> : <ProductQuote product={current} language={language} t={t} onSave={saveCurrent} onRefresh={() => void refreshCurrent()} onRemove={() => { const saved = tracked.some((item) => item.id === current.id); if (saved) void removeTracked(current); }} saving={busy === 'save'} refreshing={busy === 'refresh'} tracked={tracked.some((item) => item.id === current.id)} />}
          {error && <div className={`price-reader-error ${providerMissing ? 'provider' : ''}`}><CircleAlert size={17} /><div><strong>{providerMissing ? t('admin.priceReaderNeedsProvider') : t('admin.priceReaderError')}</strong><p>{error}</p>{providerMissing && <small>{t('admin.priceReaderProviderHint')}</small>}</div></div>}
        </section>
      </div>
    </div>
  </main>;
}

function ProductQuote({ product, language, t, onSave, onRefresh, onRemove, saving, refreshing, tracked }: { product: PriceReaderProduct; language: string; t: (key: string) => string; onSave: () => void; onRefresh: () => void; onRemove: () => void; saving: boolean; refreshing: boolean; tracked: boolean }) {
  const totalFrom = useMemo(() => product.variants.reduce((min, variant) => Math.min(min, variant.priceCny), Number.POSITIVE_INFINITY), [product.variants]);
  return <div className="price-reader-quote"><header className="price-reader-product-head"><div className="price-reader-product-copy"><div className="price-reader-product-meta"><span className="price-reader-source-badge">{sourceName(product, t)}</span><span className="price-reader-live"><span className="live-dot" /> {t('admin.priceReaderLive')}</span></div><h2>{product.title}</h2><div className="price-reader-product-facts"><span><Store size={14} /> {product.shopName ?? '—'}</span><span>{t('admin.priceReaderProductId')}: {product.sourceProductId}</span><span>{t('admin.priceReaderLastChecked')}: {dateFormat(language).format(new Date(product.updatedAt))}</span></div></div><div className="price-reader-product-actions"><a href={product.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> {t('admin.priceReaderOpenSource')}</a><div><GlassButton onClick={onSave} disabled={saving || tracked}>{tracked ? <><Check size={14} /> {t('admin.priceReaderSaved')}</> : <><Save size={14} /> {saving ? t('admin.priceReaderReading') : t('admin.priceReaderSave')}</>}</GlassButton><button className="icon-button" onClick={onRefresh} disabled={refreshing || !tracked} aria-label={t('admin.priceReaderRefresh')}><RefreshCw size={15} /></button>{tracked && <button className="icon-button danger" onClick={onRemove} aria-label={t('admin.priceReaderRemove')}><Trash2 size={15} /></button>}</div></div></header><div className="price-reader-summary"><div><span>{t('admin.priceReaderPrice')}</span><strong>{cny.format(totalFrom)}</strong><small>{priceVnd(totalFrom, product.exchangeRateVnd)}</small></div><div><span>{t('admin.priceReaderVariants')}</span><strong>{product.variants.length}</strong><small>{t('admin.priceReaderCny')} + {t('admin.priceReaderVnd')}</small></div><div><span>{t('admin.priceReaderPromotions')}</span><strong>{product.promotions.length}</strong><small>{product.promotions.length ? t('admin.priceReaderDiscount') : t('admin.priceReaderNoPromotion')}</small></div></div><section className="price-reader-data-card"><div className="price-reader-section-heading"><div><span className="eyebrow">03 / {t('admin.priceReaderVariants')}</span><h3>{t('admin.priceReaderVariants')}</h3></div><span className="price-reader-rate-inline">{t('admin.priceReaderExchangeRate')}: {priceVnd(1, product.exchangeRateVnd)}</span></div><div className="price-reader-table"><div className="price-reader-table-head"><span>{t('admin.priceReaderVariant')}</span><span>{t('admin.priceReaderPrice')}</span><span>{t('admin.priceReaderOriginalPrice')}</span><span>{t('admin.priceReaderStock')}</span></div>{product.variants.map((variant) => <div className="price-reader-table-row" key={variant.id}><div><strong>{variant.label}</strong>{Object.keys(variant.skuAttributes).length > 0 && <small>{Object.entries(variant.skuAttributes).map(([key, value]) => `${key}: ${value}`).join(' · ')}</small>}</div><div><strong>{cny.format(variant.priceCny)}</strong><small>{priceVnd(variant.priceCny, product.exchangeRateVnd)}</small></div><div>{variant.originalPriceCny ? <><strong className="price-reader-old-price">{cny.format(variant.originalPriceCny)}</strong><small>{priceVnd(variant.originalPriceCny, product.exchangeRateVnd)}</small></> : <span>—</span>}</div><span>{variant.stock === undefined ? '—' : variant.stock}</span></div>)}</div></section><section className="price-reader-data-card"><div className="price-reader-section-heading"><div><span className="eyebrow">04 / {t('admin.priceReaderPromotions')}</span><h3>{t('admin.priceReaderPromotions')}</h3></div></div>{product.promotions.length ? <div className="price-reader-promotions">{product.promotions.map((promotion) => <article key={promotion.id}><span className="price-reader-promo-icon"><Tag size={16} /></span><div><strong>{promotion.title}</strong><p>{promotion.description ?? ''}</p>{promotion.endsAt && <small>{t('admin.priceReaderEnds')}: {dateFormat(language).format(new Date(promotion.endsAt))}</small>}</div><div className="price-reader-promo-price">{promotion.discountCny !== undefined && <span>-{cny.format(promotion.discountCny)}</span>}{promotion.finalPriceCny !== undefined && <strong>{cny.format(promotion.finalPriceCny)}<small>{priceVnd(promotion.finalPriceCny, product.exchangeRateVnd)}</small></strong>}</div></article>)}</div> : <p className="price-reader-muted">{t('admin.priceReaderNoPromotion')}</p>}</section></div>;
}
