import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { CartProvider, useCart } from './components/CartContext';
import { CatalogProvider } from './components/CatalogContext';
import { Footer, Navbar, PageTransition } from './components/Shell';
import { AboutPage, CartPage, CheckoutPage, CollectionPage, CollectionsPage, ContactPage, CustomizePage, HomePage, OrderPage, ProductPage, ProductsPage, ShowcasePage } from './pages';
import { AdminWorkspacePage } from './AdminWorkspacePage';
import { AdminToolPage } from './AdminToolPage';
import { AdminFlexLampPage } from './FlexLampWorkspacePage';
import { AccountPage } from './AccountPage';
import { LanguageProvider } from './lib/i18n';
import { ModuleLampStudioPage } from './ModuleLampStudioPage';
import { ModuleSketchPage } from './ModuleSketchPage';
import { PriceReaderPage } from './PriceReaderPage';

function AppFrame() {
  const { items } = useCart(); const location = useLocation(); const navigate = useNavigate(); const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('hometown-theme') as 'dark' | 'light' | null) ?? 'dark');
  const isAdminTool = location.pathname.startsWith('/admin/');
  const isModuleStudio = location.pathname.startsWith('/module-studio');
  const isWorkspace = isAdminTool || isModuleStudio;
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('hometown-theme', theme); }, [theme]);
  useEffect(() => {
    if ('__TAURI_INTERNALS__' in window && location.pathname === '/') navigate('/module-studio', { replace: true });
  }, [location.pathname, navigate]);
  return <div className={`app-shell ${isWorkspace ? 'app-shell-admin-tool' : ''}`}>{!isWorkspace && <Navbar cartCount={items.reduce((sum, item) => sum + item.quantity, 0)} theme={theme} onTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} />}<PageTransition><Routes><Route path="/" element={<HomePage />} /><Route path="/products" element={<ProductsPage />} /><Route path="/products/:slug" element={<ProductPage />} /><Route path="/collections" element={<CollectionsPage />} /><Route path="/collections/:slug" element={<CollectionPage />} /><Route path="/customize/:productId" element={<CustomizePage />} /><Route path="/module-studio" element={<ModuleLampStudioPage />} /><Route path="/module-studio/sketch" element={<ModuleSketchPage />} /><Route path="/cart" element={<CartPage />} /><Route path="/checkout" element={<CheckoutPage />} /><Route path="/order/:id" element={<OrderPage />} /><Route path="/account" element={<AccountPage />} /><Route path="/about" element={<AboutPage />} /><Route path="/contact" element={<ContactPage />} /><Route path="/3d-showcase" element={<ShowcasePage />} /><Route path="/admin" element={<AdminWorkspacePage />} /><Route path="/admin/clicker" element={<AdminToolPage mode="clicker" />} /><Route path="/admin/flex-keychain" element={<AdminToolPage mode="flex-keychain" />} /><Route path="/admin/flex-organizer" element={<AdminToolPage mode="flex-organizer" />} /><Route path="/admin/flex-lamp" element={<AdminFlexLampPage />} /><Route path="/admin/price-reader" element={<PriceReaderPage />} /><Route path="*" element={<HomePage />} /></Routes></PageTransition>{!isWorkspace && <Footer />}</div>;
}

export default function App() { return <HashRouter><LanguageProvider><CatalogProvider><CartProvider><AppFrame /></CartProvider></CatalogProvider></LanguageProvider></HashRouter>; }
