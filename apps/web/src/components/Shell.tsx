import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, ShoppingBag, Sun, Moon, Menu, X } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';

export function GlassButton({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'quiet' }) {
  return <button className={`glass-button ${variant} ${className}`} {...props}>{children}</button>;
}

export function ProductCard({ product }: { product: import('@hometown/types').Product }) {
  return <motion.article className="product-card" whileHover={{ y: -7 }} transition={{ type: 'spring', stiffness: 300 }}>
    <Link to={`/products/${product.slug}`} className="product-card-link">
      <div className="product-card-art"><div className={`mini-lamp ${product.shape}`}><span /></div><span className="card-index">{product.sku}</span></div>
      <div className="product-card-meta"><div><span className="eyebrow">{product.collection}</span><h3>{product.name}</h3></div><ArrowUpRight size={18} /></div>
      <p>{product.description}</p>
    </Link>
  </motion.article>;
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return <div className="section-title"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{children}</div>;
}

export function Navbar({ cartCount, theme, onTheme }: { cartCount: number; theme: 'dark' | 'light'; onTheme: () => void }) {
  const [open, setOpen] = useState(false); const location = useLocation();
  return <header className="site-header"><Link className="wordmark" to="/" onClick={() => setOpen(false)}><span className="wordmark-mark">H</span><span>HOMETOWN<br /><em>MODULAR LAMP</em></span></Link><button className="mobile-menu" onClick={() => setOpen((value) => !value)} aria-label="Mở menu">{open ? <X /> : <Menu />}</button>
    <nav className={open ? 'nav-links open' : 'nav-links'}>{[['/products', 'Collection'], ['/customize/py01', 'Custom studio'], ['/about', 'Our story'], ['/contact', 'Contact']].map(([to, label]) => <NavLink key={to} to={to} className={location.pathname.startsWith(to) ? 'active' : ''} onClick={() => setOpen(false)}>{label}</NavLink>)}</nav>
    <div className="header-actions"><button className="icon-button" onClick={onTheme} aria-label="Đổi giao diện">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><Link className="cart-link" to="/cart" aria-label="Giỏ hàng"><ShoppingBag size={17} /><span>{cartCount}</span></Link></div>
  </header>;
}

export function PageTransition({ children }: { children: React.ReactNode }) { return <AnimatePresence mode="wait"><motion.main key={useLocation().pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .28 }}>{children}</motion.main></AnimatePresence>; }

export function Footer() { return <footer className="site-footer"><div><span className="eyebrow">HOMETOWN MODULAR LAMP</span><p>Mỗi vùng đất — một ánh sáng.</p></div><div className="footer-links"><Link to="/about">Our story</Link><Link to="/contact">Contact</Link><Link to="/admin">Studio</Link></div><span className="muted">© 2026 Hometown Lamp</span></footer>; }
