import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './admin.css';
import './tahoe.css';
import './readability.css';

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}stl-cutter-sw.js`, { scope: import.meta.env.BASE_URL });
  });
}
