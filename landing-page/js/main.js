(() => {
  'use strict';

  // Cette préférence pilote toutes les animations afin de respecter le choix système de l'utilisateur.
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Menu mobile ---
  const navToggle = document.getElementById('navToggle');
  const mobileMenu = document.getElementById('mobileMenu');

  if (navToggle && mobileMenu) {
    const closeMobileMenu = (restoreFocus = false) => {
      if (!mobileMenu.classList.contains('is-open')) return;

      mobileMenu.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', 'Ouvrir le menu');

      if (restoreFocus) {
        navToggle.focus({ preventScroll: true });
      }
    };

    navToggle.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navToggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
    });

    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => closeMobileMenu());
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMobileMenu(true);
      }
    });

    document.addEventListener('click', (event) => {
      if (!mobileMenu.contains(event.target) && !navToggle.contains(event.target)) {
        closeMobileMenu();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1240) {
        closeMobileMenu();
      }
    });
  }

  // --- Section active dans les navigations bureau et mobile ---
  const sectionNavLinks = Array.from(
    document.querySelectorAll('.nav-links a[href^="#"], .mobile-menu a[href^="#"]')
  );
  const sectionIds = [...new Set(sectionNavLinks.map((link) => link.getAttribute('href').slice(1)))];
  const navSections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
  const siteHeader = document.querySelector('.site-header');

  const setCurrentSection = (activeId) => {
    sectionNavLinks.forEach((link) => {
      const isCurrent = link.getAttribute('href') === `#${activeId}`;

      if (isCurrent) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  };

  let navUpdateScheduled = false;
  const updateCurrentSection = () => {
    navUpdateScheduled = false;
    const headerBottom = siteHeader ? siteHeader.getBoundingClientRect().bottom : 0;
    // Le point de lecture est placé sous l'en-tête fixe pour éviter un changement d'onglet prématuré.
    const probeY = headerBottom + Math.min(120, window.innerHeight * 0.2);
    let activeId = '';

    navSections.forEach((section) => {
      const bounds = section.getBoundingClientRect();
      if (bounds.top <= probeY && bounds.bottom > probeY) {
        activeId = section.id;
      }
    });

    setCurrentSection(activeId);
  };

  const scheduleCurrentSectionUpdate = () => {
    if (navUpdateScheduled) return;
    navUpdateScheduled = true;
    window.requestAnimationFrame(updateCurrentSection);
  };

  sectionNavLinks.forEach((link) => {
    link.addEventListener('click', () => {
      setCurrentSection(link.getAttribute('href').slice(1));
    });
  });
  window.addEventListener('scroll', scheduleCurrentSectionUpdate, { passive: true });
  window.addEventListener('resize', scheduleCurrentSectionUpdate);
  window.addEventListener('load', scheduleCurrentSectionUpdate);
  scheduleCurrentSectionUpdate();

  // --- Apparition progressive au défilement ---
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
    // Le contenu reste visible par défaut : l'animation n'est activée que lorsque JavaScript est prêt.
    document.documentElement.classList.add('reveal-enabled');
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  // --- Décor de Poké Balls : répartition organique sans chevauchement ---
  const starfield = document.getElementById('starfield');
  if (starfield) {
    const sizes = [22, 30, 38, 44];

    const renderPokeballs = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const isNarrowScreen = viewportWidth < 600;
      const minimumCount = isNarrowScreen ? 14 : 24;
      const maximumCount = isNarrowScreen ? 24 : 58;
      const targetCount = Math.min(
        maximumCount,
        Math.max(minimumCount, Math.round((viewportWidth * viewportHeight) / 38000))
      );
      const minimumGap = 48;
      const candidateCount = 56;
      const positions = [];
      const fragment = document.createDocumentFragment();

      starfield.replaceChildren();

      for (let index = 0; index < targetCount; index += 1) {
        const size = sizes[Math.floor(Math.random() * sizes.length)];
        const edgePadding = size / 2 + 18;
        let bestCandidate = null;

        // Parmi plusieurs positions aléatoires, conserve celle qui laisse le plus d'espace libre.
        for (let attempt = 0; attempt < candidateCount; attempt += 1) {
          const x = edgePadding + Math.random() * Math.max(1, viewportWidth - edgePadding * 2);
          const y = edgePadding + Math.random() * Math.max(1, viewportHeight - edgePadding * 2);
          let clearance = Number.POSITIVE_INFINITY;

          positions.forEach((position) => {
            const centerDistance = Math.hypot(x - position.x, y - position.y);
            const edgeDistance = centerDistance - (size + position.size) / 2;
            clearance = Math.min(clearance, edgeDistance);
          });

          if (!bestCandidate || clearance > bestCandidate.clearance) {
            bestCandidate = { x, y, size, clearance };
          }
        }

        if (!bestCandidate || (positions.length > 0 && bestCandidate.clearance < minimumGap)) {
          continue;
        }

        positions.push(bestCandidate);

        const orb = document.createElement('div');
        orb.className = 'bg-orb';
        orb.style.width = `${size}px`;
        orb.style.height = `${size}px`;
        orb.style.left = `${Math.round(bestCandidate.x - size / 2)}px`;
        orb.style.top = `${Math.round(bestCandidate.y - size / 2)}px`;
        orb.style.animationDelay = `${(Math.random() * 4).toFixed(2)}s`;
        fragment.appendChild(orb);
      }

      starfield.appendChild(fragment);
    };

    let resizeTimer;
    renderPokeballs();
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(renderPokeballs, 140);
    });
  }
})();
