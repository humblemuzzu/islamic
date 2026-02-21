  const categorySelection = document.getElementById('categorySelection');
  const qaContainer = document.getElementById('qaContainer');
  const panel = document.getElementById('qaPanel');
  const progressBar = document.getElementById('qaProgressBar');

  const depthMap: Record<string, number> = {
    'categorySelection': 10,
    // Haiz
    'haiz-start': 20, 'haiz-current-duration': 30, 'haiz-ended-question': 30,
    'haiz-less-3': 100, 'haiz-3-10': 60, 'haiz-more-10': 60,
    'haiz-has-habit': 100, 'haiz-no-habit': 100,
    'haiz-still-flowing': 100, 'haiz-just-ended': 80,
    'haiz-gap-check': 90, 'haiz-gap-less15': 100, 'haiz-gap-15plus': 100, 'haiz-clean-done': 100,
    'haiz-ended-less3': 100, 'haiz-ended-3to10': 100, 'haiz-ended-more10': 100,
    'haiz-advice': 40, 'haiz-age-info': 100, 'haiz-colors-info': 100, 'haiz-tuhr-info': 100,
    // Haiz: Spotting
    'haiz-spotting': 40, 'haiz-spotting-within10': 100, 'haiz-spotting-afterstop': 60,
    'haiz-spotting-over10': 100, 'haiz-spotting-colors': 100,
    // Haiz: Special scenarios
    'haiz-prayed-unknowingly': 100, 'haiz-misconception-7days': 100,
    'haiz-pregnant': 100, 'haiz-fasted-gap': 60,
    'haiz-fasted-gap-within10': 100, 'haiz-fasted-gap-over10': 100,
    // Istihaza
    'istihaza-start': 20, 'istihaza-ruling': 100, 'istihaza-wudu': 100,
    'istihaza-mazoor': 100, 'istihaza-fasting': 100,
    // Nifas
    'nifas-start': 20, 'nifas-duration': 100, 'nifas-rulings': 100,
    'nifas-early-stop': 100, 'nifas-over40': 100, 'nifas-miscarriage': 100,
    // Salah
    'salah-start': 20, 'salah-during-cycle': 100, 'salah-after-cycle': 100, 'salah-istihaza': 100,
    'salah-haiz-started-during': 100, 'salah-prayed-unknowingly': 100,
    // Sawm
    'sawm-start': 20, 'sawm-during-haiz': 100, 'sawm-started': 100, 'sawm-qaza': 100,
    'sawm-istihaza': 100, 'sawm-7din-myth': 100, 'sawm-gap-then-spotting': 100,
    // Ghusl
    'ghusl-start': 20, 'ghusl-when': 100, 'ghusl-how': 100, 'ghusl-10days': 100,
    // Quran
    'quran-start': 20, 'quran-recite': 100, 'quran-touch': 100, 'quran-listen': 100,
    // Masjid
    'masjid-start': 50,
    // Zawaj
    'zawaj-start': 20, 'zawaj-during-haiz': 100, 'zawaj-intimate-parts': 100,
  };

  function goToScreen(screenId: string) {
    if (screenId === 'categorySelection') {
      if (categorySelection) categorySelection.style.display = 'block';
      if (qaContainer) qaContainer.style.display = 'none';
      if (progressBar) progressBar.style.width = '0%';
      return;
    }

    if (categorySelection) categorySelection.style.display = 'none';
    if (qaContainer) qaContainer.style.display = 'block';

    const screens = panel?.querySelectorAll('.qa-screen');
    screens?.forEach(s => s.classList.remove('active'));

    const target = panel?.querySelector(`[data-screen="${screenId}"]`);
    if (target) {
      target.classList.add('active');
      const depth = depthMap[screenId] ?? 50;
      if (progressBar) progressBar.style.width = `${depth}%`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-goto]');
    if (target) {
      const screenId = target.getAttribute('data-goto');
      if (screenId) goToScreen(screenId);
    }
  });
