import { ArrowUpRight, Chrome, Download, ExternalLink, MonitorDown, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import './downloads.css';

const RELEASE_ROOT = 'https://github.com/trancaodai1651/FormaForgeDT/releases/latest';
const ASSETS = {
  windows: `${RELEASE_ROOT}/download/FormaForgeDT-Windows-x64.exe`,
  macos: `${RELEASE_ROOT}/download/FormaForgeDT-macOS.dmg`,
  extension: `${RELEASE_ROOT}/download/FormaForgeDT-Market-Reader.zip`,
};

export function DownloadsPage() {
  const { language } = useI18n();
  const vi = language === 'vi';
  const copy = vi ? {
    eyebrow: 'FORMAFORGE / TẢI XUỐNG',
    title: 'Công cụ để tạo hình, đọc giá và làm việc offline.',
    intro: 'Tải bản web mới nhất, ứng dụng desktop hoặc extension Market Reader. Installer được phát hành qua GitHub Releases.',
    windows: 'Windows desktop',
    windowsText: 'Bản cài Tauri cho Windows x64, có Module Studio và Hunyuan 3D offline.',
    macos: 'macOS desktop',
    macosText: 'Gói DMG cho macOS. Mở file và kéo ứng dụng vào Applications.',
    extension: 'Chrome Market Reader',
    extensionText: 'Extension đọc giá, phân loại, dịch và lưu sản phẩm từ các sàn Trung Quốc.',
    download: 'Tải xuống',
    release: 'Xem GitHub Releases',
    note: 'Nếu asset chưa xuất hiện, release đang được GitHub Actions build. Hãy tải lại sau ít phút.',
    back: 'Về trang chủ',
  } : {
    eyebrow: 'FORMAFORGE / DOWNLOADS',
    title: 'Tools for making, pricing and working offline.',
    intro: 'Download the latest web companion, desktop app or Market Reader extension. Installers are published through GitHub Releases.',
    windows: 'Windows desktop',
    windowsText: 'Tauri installer for Windows x64 with Module Studio and offline Hunyuan 3D support.',
    macos: 'macOS desktop',
    macosText: 'macOS DMG package. Open it and drag the app into Applications.',
    extension: 'Chrome Market Reader',
    extensionText: 'Read prices, variants, translations and save products from Chinese marketplaces.',
    download: 'Download',
    release: 'Open GitHub Releases',
    note: 'If an asset is not available yet, GitHub Actions is still building the release. Try again shortly.',
    back: 'Back home',
  };

  return <section className="downloads-page">
    <div className="downloads-hero">
      <span className="eyebrow">{copy.eyebrow}</span>
      <h1>{copy.title}</h1>
      <p>{copy.intro}</p>
      <Link className="downloads-release" to="/"><ArrowUpRight size={16} /> {copy.back}</Link>
    </div>
    <div className="downloads-grid">
      <DownloadCard icon={<MonitorDown size={22} />} title={copy.windows} text={copy.windowsText} href={ASSETS.windows} label={copy.download} />
      <DownloadCard icon={<Package size={22} />} title={copy.macos} text={copy.macosText} href={ASSETS.macos} label={copy.download} />
      <DownloadCard icon={<Chrome size={22} />} title={copy.extension} text={copy.extensionText} href={ASSETS.extension} label={copy.download} />
    </div>
    <p className="downloads-note"><Download size={14} /> {copy.note}</p>
    <a className="downloads-release" href={RELEASE_ROOT} target="_blank" rel="noreferrer"><ExternalLink size={16} /> {copy.release}</a>
  </section>;
}

function DownloadCard({ icon, title, text, href, label }: { icon: React.ReactNode; title: string; text: string; href: string; label: string }) {
  return <article className="download-card"><span className="download-icon">{icon}</span><h2>{title}</h2><p>{text}</p><a className="glass-button primary" href={href} target="_blank" rel="noreferrer">{label} <ArrowUpRight size={16} /></a></article>;
}
