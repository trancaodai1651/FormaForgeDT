import { getClickerDocument } from '../runtime';
import { gsap } from 'gsap';

export function setupScreens() {
  const dashboardScreen = getClickerDocument().getElementById('dashboard-screen');
  const toolScreen = getClickerDocument().getElementById('tool-screen');
  const btnOpenClicker = getClickerDocument().getElementById('btn-open-clicker');

  // Animation vÃ o Dashboard khi má»›i load trang
  if (dashboardScreen) {
    if (getClickerDocument().querySelector('.dashboard-header')) {
      gsap.from('.dashboard-header', { y: -20, opacity: 0, duration: 0.6, ease: 'power2.out' });
    }
    if (getClickerDocument().querySelector('.tool-card')) {
      gsap.from('.tool-card', { y: 30, opacity: 0, duration: 0.6, stagger: 0.15, ease: 'power2.out', delay: 0.2 });
    }
  }

  // HÃ m chuyá»ƒn cáº£nh
  function openScreen(targetScreen: HTMLElement | null) {
    if (!dashboardScreen) {
      console.error("ðŸš¨ Lá»–I: KhÃ´ng tÃ¬m tháº¥y <section id='dashboard-screen'> trong index.html");
      return;
    }
    if (!targetScreen) {
      console.error("ðŸš¨ Lá»–I: KhÃ´ng tÃ¬m tháº¥y mÃ n hÃ¬nh Ä‘Ã­ch trong index.html.");
      return;
    }

    const tl = gsap.timeline();
    
    tl.to(dashboardScreen, {
      opacity: 0, y: -20, duration: 0.35, ease: 'power2.in',
      onComplete: () => {
        dashboardScreen.style.display = 'none';
        targetScreen.style.display = 'block';
      }
    }).to(targetScreen, {
      opacity: 1, y: 0, duration: 0.45, ease: 'power2.out',
      onComplete: () => window.dispatchEvent(new Event('resize'))
    });
  }

  // Láº¯ng nghe sá»± kiá»‡n click
  if (btnOpenClicker) {
    btnOpenClicker.addEventListener('click', () => openScreen(toolScreen));
  } else {
    console.error("ðŸš¨ Lá»–I: KhÃ´ng tÃ¬m tháº¥y nÃºt cÃ³ id='btn-open-clicker'");
  }

  if (getClickerDocument().documentElement.dataset.embed === 'formaforge') {
    requestAnimationFrame(() => openScreen(toolScreen));
  }

  // Tráº£ vá» cÃ¡c Ä‘á»‘i tÆ°á»£ng Ä‘á»ƒ cÃ¡c Tool sá»­ dá»¥ng
  return {
    toolScreen,
    backToDashboard: (currentScreen: HTMLElement) => {
      if (!dashboardScreen || !currentScreen) return;
      const tl = gsap.timeline();
      tl.to(currentScreen, {
        opacity: 0, duration: 0.3, ease: 'power2.in',
        onComplete: () => {
          currentScreen.style.display = 'none';
          dashboardScreen.style.display = 'flex';
        }
      }).to(dashboardScreen, {
        opacity: 1, y: 0, duration: 0.4, ease: 'power2.out'
      });
    }
  };
}



