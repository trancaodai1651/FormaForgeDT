import { Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import './desktop-download-button.css';

export const DESKTOP_RELEASE_ROOT = 'https://github.com/trancaodai1651/FormaForgeDT/releases/latest';

export const DESKTOP_INSTALLERS = {
  windows: `${DESKTOP_RELEASE_ROOT}/download/FormaForgeDT-Windows-x64.exe`,
  macos: `${DESKTOP_RELEASE_ROOT}/download/FormaForgeDT-macOS-universal.dmg`,
} as const;

type Language = 'en' | 'vi';

function getPlatform(userAgent: string): 'windows' | 'macos' | null {
  if (/Windows/i.test(userAgent)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(userAgent) && !/iPhone|iPad|iPod/i.test(userAgent)) return 'macos';
  return null;
}

export function DesktopDownloadButton({ language = 'en' }: { language?: Language }) {
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const platform = getPlatform(userAgent);
  const copy = language === 'vi'
    ? { windows: 'Tải cho Windows', macos: 'Tải cho macOS', other: 'Tải ứng dụng desktop', windowsTag: 'Windows x64', macosTag: 'macOS Universal' }
    : { windows: 'Download for Windows', macos: 'Download for macOS', other: 'Download desktop app', windowsTag: 'Windows x64', macosTag: 'macOS Universal' };

  if (!platform) {
    return <Link className="desktop-download-button" to="/downloads"><Download size={15} />{copy.other}</Link>;
  }

  const label = platform === 'windows' ? copy.windows : copy.macos;
  const tag = platform === 'windows' ? copy.windowsTag : copy.macosTag;
  return <a className="desktop-download-button" href={DESKTOP_INSTALLERS[platform]} aria-label={`${label} (${tag})`}>
    <Download size={15} />
    <span>{label}</span>
    <small>{tag}</small>
  </a>;
}
