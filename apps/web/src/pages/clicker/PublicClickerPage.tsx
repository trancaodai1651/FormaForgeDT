import { AdminToolPage } from '../../AdminToolPage';
import { useI18n } from '../../lib/i18n';
import { DesktopDownloadButton } from '../downloads/DesktopDownloadButton';
import './public-clicker-page.css';

export function PublicClickerPage() {
  const { language } = useI18n();
  return <div className="public-clicker-page-shell">
    <header className="public-clicker-download-bar">
      <span>FORMAFORGE / CLICKER</span>
      <DesktopDownloadButton language={language} />
    </header>
    <AdminToolPage mode="clicker" publicAccess />
  </div>;
}
