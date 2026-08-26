import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { CartProvider, useCart } from './components/CartContext';
import { CatalogProvider } from './components/CatalogContext';
import { Footer, Navbar, PageTransition } from './components/Shell';
import { AboutPage, CartPage, CheckoutPage, CollectionPage, CollectionsPage, ContactPage, CustomizePage, HomePage, OrderPage, ProductPage, ProductsPage, ShowcasePage } from './pages/storefront';
import { AdminWorkspacePage, AdminToolPage } from './pages/admin';
import { AdminFlexLampPage } from './pages/flex-lamp';
import { AccountPage } from './AccountPage';
import { LanguageProvider } from './lib/i18n';
import { ModuleLampStudioPage, ModuleSketchPage } from './pages/module-studio';
import { PriceReaderPage } from './pages/price-reader';
import { Hunyuan3DPage } from './pages/hunyuan-3d';
import { ParamacraftPage } from './pages/paramacraft';
import { DownloadsPage } from './pages/downloads';
import { AdminGuard } from './AdminGuard';
import { AdminWorkspaceNav } from './AdminWorkspaceNav';
import { TulipCreatorPage } from './pages/tulip-creator';
import { HomeItemPage } from './pages/home-item';

function AdminRoute({ children }: { children: ReactNode }) {
  return <AdminGuard>{() => <><AdminWorkspaceNav />{children}</>}</AdminGuard>;
}

function AppFrame() {
  const { items } = useCart(); const location = useLocation(); const navigate = useNavigate(); const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('hometown-theme') as 'dark' | 'light' | null) ?? 'dark');
  const isAdminTool = location.pathname.startsWith('/admin/');
  const isModuleStudio = location.pathname.startsWith('/module-studio');
  const isPriceReader = location.pathname === '/price-reader' || location.pathname === '/admin/price-reader';
  const isParamacraft = location.pathname.startsWith('/paramacraft') || location.pathname === '/admin/paramacraft';
  const isWorkspace = isAdminTool || isModuleStudio || isPriceReader || isParamacraft;
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('hometown-theme', theme); }, [theme]);
  useEffect(() => {
    if ('__TAURI_INTERNALS__' in window && location.pathname === '/') navigate('/admin', { replace: true });
  }, [location.pathname, navigate]);
  if (location.pathname === '/admin/image-vectorizer') return <AdminToolPage mode="image-vectorizer" />;
  return <div className={`app-shell tahoe-ui ${isWorkspace ? 'app-shell-admin-tool tahoe-workspace' : 'tahoe-storefront'}`}>{!isWorkspace && <Navbar cartCount={items.reduce((sum, item) => sum + item.quantity, 0)} theme={theme} onTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} />}<PageTransition><Routes><Route path="/" element={<HomePage />} /><Route path="/products" element={<ProductsPage />} /><Route path="/products/:slug" element={<ProductPage />} /><Route path="/collections" element={<CollectionsPage />} /><Route path="/collections/:slug" element={<CollectionPage />} /><Route path="/customize/:productId" element={<CustomizePage />} /><Route path="/module-studio" element={<ModuleLampStudioPage />} /><Route path="/module-studio/sketch" element={<ModuleSketchPage />} /><Route path="/admin/tulip-creator" element={<AdminRoute><TulipCreatorPage /></AdminRoute>} /><Route path="/admin/lamp-body-creator" element={<AdminRoute><TulipCreatorPage /></AdminRoute>} /><Route path="/admin/home-item" element={<AdminRoute><HomeItemPage /></AdminRoute>} /><Route path="/cart" element={<CartPage />} /><Route path="/checkout" element={<CheckoutPage />} /><Route path="/order/:id" element={<OrderPage />} /><Route path="/account" element={<AccountPage />} /><Route path="/about" element={<AboutPage />} /><Route path="/contact" element={<ContactPage />} /><Route path="/3d-showcase" element={<ShowcasePage />} /><Route path="/downloads" element={<DownloadsPage />} /><Route path="/paramacraft/viewer/:presetId" element={<ParamacraftPage />} /><Route path="/paramacraft" element={<ParamacraftPage />} /><Route path="/admin" element={<AdminWorkspacePage />} /><Route path="/admin/clicker" element={<AdminToolPage mode="clicker" />} /><Route path="/admin/flex-keychain" element={<AdminToolPage mode="flex-keychain" />} /><Route path="/admin/flex-organizer" element={<AdminToolPage mode="flex-organizer" />} /><Route path="/admin/svg-layers" element={<AdminToolPage mode="svg-layers" />} /><Route path="/admin/multi-color" element={<AdminToolPage mode="multi-color" />} /><Route path="/admin/flex-lamp" element={<AdminRoute><AdminFlexLampPage /></AdminRoute>} /><Route path="/admin/hunyuan-3d" element={<AdminRoute><Hunyuan3DPage /></AdminRoute>} /><Route path="/admin/paramacraft" element={<AdminRoute><ParamacraftPage /></AdminRoute>} /><Route path="/admin/module-studio" element={<AdminRoute><ModuleLampStudioPage /></AdminRoute>} /><Route path="/admin/module-studio/sketch" element={<AdminRoute><ModuleSketchPage /></AdminRoute>} /><Route path="/price-reader" element={<PriceReaderPage />} /><Route path="/admin/price-reader" element={<AdminRoute><PriceReaderPage /></AdminRoute>} /><Route path="*" element={<HomePage />} /></Routes></PageTransition>{!isWorkspace && <Footer />}</div>;
}

export default function App() { return <HashRouter><LanguageProvider><CatalogProvider><CartProvider><AppFrame /></CartProvider></CatalogProvider></LanguageProvider></HashRouter>; }
