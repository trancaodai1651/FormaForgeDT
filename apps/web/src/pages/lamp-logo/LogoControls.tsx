import { ImagePlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { LogoConfig, LogoCopy } from './LogoTypes';
import './logo.css';

const MASK_SIZE = 32;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readLogo(file: File, onChange: (logo: LogoConfig) => void, onError: (message: string) => void, invalidMessage: string) {
  if (!file.type.startsWith('image/')) {
    onError(invalidMessage);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const source = typeof reader.result === 'string' ? reader.result : '';
    if (!source) {
      onError(invalidMessage);
      return;
    }
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = MASK_SIZE;
      canvas.height = MASK_SIZE;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        onError(invalidMessage);
        return;
      }
      context.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
      const scale = Math.min(MASK_SIZE / image.width, MASK_SIZE / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, (MASK_SIZE - width) / 2, (MASK_SIZE - height) / 2, width, height);
      const imageData = context.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
      const pixels = imageData.data;
      const hasTransparency = Array.from({ length: MASK_SIZE * MASK_SIZE }, (_, index) => pixels[index * 4 + 3]).some((alpha) => alpha < 245);
      const alpha = Array.from({ length: MASK_SIZE * MASK_SIZE }, (_, index) => {
        const pixel = index * 4;
        const opacity = pixels[pixel + 3] / 255;
        if (hasTransparency) return opacity;
        const luminance = (pixels[pixel] * .299 + pixels[pixel + 1] * .587 + pixels[pixel + 2] * .114) / 255;
        return opacity * (1 - luminance);
      });
      for (let index = 0; index < alpha.length; index += 1) pixels[index * 4 + 3] = Math.round(alpha[index] * 255);
      context.putImageData(imageData, 0, 0);
      onChange({ name: file.name, source: canvas.toDataURL('image/png'), enabled: true, width: 42, height: 42, depth: 1, position: .55, mask: { width: MASK_SIZE, height: MASK_SIZE, alpha } });
    };
    image.onerror = () => onError(invalidMessage);
    image.src = source;
  };
  reader.onerror = () => onError(invalidMessage);
  reader.readAsDataURL(file);
}

export function LogoControls({ logo, copy, onChange }: { logo: LogoConfig | null; copy: LogoCopy; onChange: (logo: LogoConfig | null) => void }) {
  const [error, setError] = useState('');
  const update = <K extends keyof LogoConfig>(key: K, value: LogoConfig[K]) => {
    if (logo) onChange({ ...logo, [key]: value });
  };
  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError('');
    readLogo(file, (nextLogo) => onChange(nextLogo), (message) => setError(message), copy.logoInvalid);
  };

  return <section className="lamp-logo-controls">
    <div className="lamp-logo-heading"><span className="lamp-logo-icon"><ImagePlus size={16} /></span><div><h3>{copy.logo}</h3><p>{copy.logoHint}</p></div></div>
    {!logo ? <label className="lamp-logo-upload"><ImagePlus size={16} /><span>{copy.importLogo}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => { handleFile(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label> : <>
      <div className="lamp-logo-file"><div><strong>{logo.name}</strong><small>{copy.chooseFile}</small></div><button type="button" aria-label={copy.removeLogo} onClick={() => onChange(null)}><Trash2 size={15} /></button></div>
      <label className="lamp-logo-toggle"><span>{copy.useLogo}</span><input type="checkbox" checked={logo.enabled} onChange={(event) => update('enabled', event.target.checked)} /><i /></label>
      <div className="lamp-logo-upload-replace"><label><ImagePlus size={14} />{copy.replaceLogo}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => { handleFile(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label></div>
      <label className="lamp-logo-range"><span><span>{copy.logoWidth}</span><strong>{Math.round(logo.width)} mm</strong></span><input type="range" min="10" max="100" value={logo.width} onChange={(event) => update('width', Number(event.target.value))} /></label>
      <label className="lamp-logo-range"><span><span>{copy.logoHeight}</span><strong>{Math.round(logo.height)} mm</strong></span><input type="range" min="10" max="100" value={logo.height} onChange={(event) => update('height', Number(event.target.value))} /></label>
      <label className="lamp-logo-range"><span><span>{copy.logoDepth}</span><strong>{logo.depth.toFixed(1)} mm</strong></span><input type="range" min="0.2" max="3" step="0.1" value={logo.depth} onChange={(event) => update('depth', Number(event.target.value))} /></label>
      <label className="lamp-logo-range"><span><span>{copy.logoPosition}</span><strong>{Math.round(logo.position * 100)}%</strong></span><input type="range" min="0.1" max="0.9" step="0.01" value={clamp(logo.position, .1, .9)} onChange={(event) => update('position', Number(event.target.value))} /></label>
    </>}
    {error && <small className="lamp-logo-error" role="alert">{error}</small>}
  </section>;
}
