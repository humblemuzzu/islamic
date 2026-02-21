  const panel = document.getElementById('qaPanel');
  const progressBar = document.getElementById('qaProgressBar');

  // Track depth for progress bar
  const depthMap: Record<string, number> = {
    'start': 0,
    'haiz-start': 25, 'salah-start': 25, 'ghusl-start': 25,
    'haiz-less-3': 75, 'haiz-3-10': 75, 'haiz-more-10': 75, 'haiz-spotting-home': 100,
    'salah-in-haiz': 75, 'salah-istihaza': 75, 'salah-ended': 75,
    'ghusl-when': 75, 'ghusl-how': 75,
    'haiz-gap-check': 60,
    'haiz-gap-less15': 100, 'haiz-gap-15plus': 100, 'haiz-clean': 100,
  };

  function goToScreen(screenId: string) {
    const screens = panel?.querySelectorAll('.qa-screen');
    screens?.forEach(s => s.classList.remove('active'));

    const target = panel?.querySelector(`[data-screen="${screenId}"]`);
    if (target) {
      target.classList.add('active');

      // Update progress
      const depth = depthMap[screenId] ?? 50;
      if (progressBar) {
        (progressBar as HTMLElement).style.width = `${depth}%`;
      }
    }
  }

  // Attach click handlers to all options, back buttons, restart buttons
  panel?.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-goto]');
    if (target) {
      const screenId = target.getAttribute('data-goto');
      if (screenId) goToScreen(screenId);
    }
  });
