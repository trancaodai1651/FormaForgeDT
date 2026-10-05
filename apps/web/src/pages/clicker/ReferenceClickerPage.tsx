import { ClickerWorkspacePage } from '../../ClickerWorkspacePage';
import { DesktopDownloadButton } from '../downloads/DesktopDownloadButton';
import './reference-page.css';

const labels = {
  clicker: 'Clicker Generator',
  flexKeychain: 'Flex Keychain',
  flexOrganizer: 'Flex Organizer',
  svgLayers: 'SVG Layers',
  imageVectorizer: 'Image Vectorizer',
  multiColor: 'Multi-color',
};

/** A separate, independently implemented presentation of the Clicker engine. */
export function ReferenceClickerPage() {
  return <main className="admin-native-workspace public-tool-workspace reference-clicker-page">
    <header className="reference-utility-bar">
      <div className="reference-utility-group">
        <a href="https://github.com/vostoklabs" target="_blank" rel="noreferrer">◉&nbsp; View on GitHub</a>
        <DesktopDownloadButton />
        <a className="reference-license" href="https://makerworld.com/en/@Vostok_Labs#commercial-membership-open" target="_blank" rel="noreferrer">▣&nbsp; Get commercial license</a>
      </div>
      <div className="reference-utility-group">
        <span>Donate:</span>
        <a className="reference-boost" href="https://makerworld.com/en/@Vostok_Labs" target="_blank" rel="noreferrer">ϟ&nbsp; Boost on MakerWorld</a>
        <a className="reference-kofi" href="https://ko-fi.com/vostoklabs" target="_blank" rel="noreferrer">☕&nbsp; Ko-fi</a>
      </div>
    </header>
    <ClickerWorkspacePage labels={labels} initialMode="clicker" showModeTabs={false} language="en" presentation="reference" />
  </main>;
}
