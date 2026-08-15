import { HashRouter, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { CartProvider, useCart } from './components/CartContext';
import { CatalogProvider } from './components/CatalogContext';
import { Footer, Navbar, PageTransition } from './components/Shell';
import { AboutPage, CartPage, CheckoutPage, CollectionPage, CollectionsPage, ContactPage, CustomizePage, HomePage, OrderPage, ProductPage, ProductsPage, ShowcasePage } from './pages';
import { AdminWorkspacePage } from './AdminWorkspacePage';

function AppFrame() {
  const { items } = useCart(); const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('hometown-theme') as 'dark' | 'light' | null) ?? 'dark');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('hometown-theme', theme); }, [theme]);
  return <div className="app-shell"><Navbar cartCount={items.reduce((sum, item) => sum + item.quantity, 0)} theme={theme} onTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} /><PageTransition><Routes><Route path="/" element={<HomePage />} /><Route path="/products" element={<ProductsPage />} /><Route path="/products/:slug" element={<ProductPage />} /><Route path="/collections" element={<CollectionsPage />} /><Route path="/collections/:slug" element={<CollectionPage />} /><Route path="/customize/:productId" element={<CustomizePage />} /><Route path="/cart" element={<CartPage />} /><Route path="/checkout" element={<CheckoutPage />} /><Route path="/order/:id" element={<OrderPage />} /><Route path="/about" element={<AboutPage />} /><Route path="/contact" element={<ContactPage />} /><Route path="/3d-showcase" element={<ShowcasePage />} /><Route path="/admin" element={<AdminWorkspacePage />} /><Route path="*" element={<HomePage />} /></Routes></PageTransition><Footer /></div>;
}

export default function App() { return <HashRouter><CatalogProvider><CartProvider><AppFrame /></CartProvider></CatalogProvider></HashRouter>; }
