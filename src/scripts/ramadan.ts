  // ========================================
  // Day Selector — Wazaif Toggle
  // ========================================
  const dayBtns = document.querySelectorAll('.day-btn');
  const dayCards = document.querySelectorAll('.wazaif-day-card');

  dayBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedDay = btn.getAttribute('data-day');

      // Update active button
      dayBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Show selected card, hide others
      dayCards.forEach(card => {
        if (card.getAttribute('data-wazaif-day') === selectedDay) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });
    });
  });

  // ========================================
  // Dhikr Group Expand/Collapse
  // ========================================
  const dhikrToggles = document.querySelectorAll('[data-dhikr-toggle]');

  dhikrToggles.forEach(toggle => {
    const targetId = toggle.getAttribute('data-dhikr-toggle');
    const target = document.getElementById(targetId!);

    // Set initial aria state
    toggle.setAttribute('aria-expanded', 'true');

    toggle.addEventListener('click', () => {
      const isOpen = target?.classList.contains('open');
      if (isOpen) {
        target?.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      } else {
        target?.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // ========================================
  // Smooth Scroll for Hero CTAs
  // ========================================
  const heroPills = document.querySelectorAll('.hero-pill');

  heroPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      const href = pill.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
