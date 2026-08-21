(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Mobile nav toggle ---
  const navToggle = document.getElementById('navToggle');
  const mobileMenu = document.getElementById('mobileMenu');

  if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navToggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
    });

    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Ouvrir le menu');
      });
    });
  }

  // --- Scroll reveal ---
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  // --- Starfield decoration (floating pixel pokeballs without overlap) ---
  const starfield = document.getElementById('starfield');
  if (starfield) {
    const ORB_COUNT = 12;
    const sizes = [24, 36, 48];
    const placed = [];
    const minDistance = 16;

    const cols = 3;
    const rows = 4;
    const cellWidth = 90 / cols;
    const cellHeight = 90 / rows;

    for (let i = 0; i < ORB_COUNT; i += 1) {
      const size = sizes[i % sizes.length];
      const r = Math.floor(i / cols);
      const c = i % cols;

      let bestLeft = 0;
      let bestTop = 0;
      let valid = false;

      for (let attempt = 0; attempt < 50; attempt += 1) {
        const candidateLeft = 4 + c * cellWidth + Math.random() * (cellWidth - 6);
        const candidateTop = 4 + r * cellHeight + Math.random() * (cellHeight - 6);

        let ok = true;
        for (const p of placed) {
          const dx = candidateLeft - p.left;
          const dy = candidateTop - p.top;
          if (Math.sqrt(dx * dx + dy * dy) < minDistance) {
            ok = false;
            break;
          }
        }

        if (ok) {
          bestLeft = candidateLeft;
          bestTop = candidateTop;
          valid = true;
          break;
        }
      }

      if (!valid) {
        bestLeft = 4 + c * cellWidth + cellWidth / 2;
        bestTop = 4 + r * cellHeight + cellHeight / 2;
      }

      placed.push({ left: bestLeft, top: bestTop });

      const orb = document.createElement('div');
      orb.className = 'bg-orb';
      orb.style.width = `${size}px`;
      orb.style.height = `${size}px`;
      orb.style.left = `${bestLeft.toFixed(2)}%`;
      orb.style.top = `${bestTop.toFixed(2)}%`;
      orb.style.animationDelay = `${(Math.random() * 4).toFixed(2)}s`;
      starfield.appendChild(orb);
    }
  }
})();
