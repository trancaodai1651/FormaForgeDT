import { ArrowRight, Box, CircuitBoard, Cuboid, FileBox, Flame, KeyRound, LampCeiling, Layers3, Palette, ScanLine, Shapes, Sparkles, SquareStack, Type, WandSparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import './public-tools.css';

type ToolCard = {
  to: string;
  label: string;
  description: string;
  mark: string;
  icon: typeof Box;
};

const tools: ToolCard[] = [
  { to: '/clicker', label: 'Clicker Lab', description: 'Turn images, SVG, icons and text into printable models.', mark: 'C', icon: WandSparkles },
  { to: '/mekey-studio', label: 'MeKey Studio', description: 'Build custom keychain text and export ready geometry.', mark: 'MK', icon: KeyRound },
  { to: '/multi-color', label: 'Multi Color', description: 'Split a flat-colour image into printable layers.', mark: 'MC', icon: Palette },
  { to: '/svg-layers', label: 'SVG Layers', description: 'Separate SVG regions into clean model layers.', mark: 'S', icon: Layers3 },
  { to: '/flex-keychain', label: 'Flex Keychain Text', description: 'Build modular or compact keychains with text.', mark: 'F', icon: Type },
  { to: '/flex-organizer', label: 'Flex Organizer', description: 'Design a modular organizer with exact dimensions.', mark: 'F', icon: SquareStack },
  { to: '/flex-lamp', label: 'Flex Lamp', description: 'Create printable lamp shades from patterns or images.', mark: 'L', icon: LampCeiling },
  { to: '/tulip-creator', label: 'Tulip Creator', description: 'Create a parametric lamp shade and body.', mark: 'TC', icon: Flame },
  { to: '/home-item', label: 'Home Item', description: 'Create parametric home decor and functional vessels.', mark: 'HI', icon: Shapes },
  { to: '/paramacraft', label: 'ParamaCraft', description: 'Design printable parametric shapes and surfaces.', mark: 'P', icon: Cuboid },
  { to: '/module-studio', label: 'Module Studio', description: 'Design and assemble modular lamp parts.', mark: 'M', icon: CircuitBoard },
  { to: '/hunyuan-3d', label: 'Hunyuan3D', description: 'Generate high-fidelity 3D assets in the desktop app.', mark: '3D', icon: Box },
  { to: '/split-3mf', label: 'Split 3MF', description: 'Separate multi-colour 3MF projects into parts.', mark: '3MF', icon: FileBox },
  { to: '/price-reader', label: 'Price Reader', description: 'Read marketplace prices and compare variants.', mark: '¥', icon: ScanLine },
];

export function PublicToolsPage() {
  const { language, setLanguage } = useI18n();
  const isVietnamese = language === 'vi';
  return <main className="public-tools-page">
    <header className="public-tools-header">
      <Link className="public-tools-brand" to="/" aria-label="FormaForgeDT tools home"><span className="public-tools-brand-mark">F</span><span><strong>FormaForgeDT</strong><small>PUBLIC TOOLBOX</small></span></Link>
      <div className="public-tools-header-actions"><Link className="public-tools-download-link" to="/downloads"><ArrowRight size={13} /> {isVietnamese ? 'Tải ứng dụng' : 'Download apps'}</Link><span className="public-tools-status"><Sparkles size={13} /> {isVietnamese ? 'Mở cho mọi người' : 'Open to everyone'}</span><div className="public-tools-language"><button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button><span>/</span><button className={language === 'vi' ? 'active' : ''} onClick={() => setLanguage('vi')}>VI</button></div></div>
    </header>
    <section className="public-tools-intro"><div><span className="public-tools-eyebrow">{isVietnamese ? 'CÔNG CỤ SÁNG TẠO 3D' : '3D CREATION TOOLS'}</span><h1>{isVietnamese ? <>Tạo tự do.<br /><em>Không cần tài khoản.</em></> : <>Make freely.<br /><em>No account required.</em></>}</h1></div><p>{isVietnamese ? 'Chọn một workspace để bắt đầu thiết kế, xem trước và xuất file trực tiếp trên trình duyệt.' : 'Choose a workspace to design, preview and export directly in your browser.'}</p></section>
    <section className="public-tools-grid" aria-label={isVietnamese ? 'Danh sách công cụ' : 'Available tools'}>{tools.map(({ to, label, description, mark, icon: Icon }) => <Link className="public-tool-card" to={to} key={to}><span className="public-tool-card-mark"><span>{mark}</span><Icon size={15} /></span><span className="public-tool-card-copy"><strong>{label}</strong><small>{description}</small></span><ArrowRight className="public-tool-card-arrow" size={17} /></Link>)}</section>
    <footer className="public-tools-footer"><span>FORMAFORGE / LOCAL-FIRST WORKSPACES</span><span>{tools.length} tools · {isVietnamese ? 'chạy cục bộ trên trình duyệt' : 'runs locally in your browser'}</span></footer>
  </main>;
}
