  // ===== DHIKR THEMES DATA =====
  const THEMES: Record<string, { arabic: string; translit: string; target: number | null }> = {
    durood: { arabic: 'اَللّٰهُمَّ صَلِّ عَلٰى مُحَمَّدٍ', translit: 'Allahumma Salli Ala Muhammad', target: null },
    subhanallah: { arabic: 'سُبْحَانَ اللّٰه', translit: 'SubhanAllah', target: 33 },
    alhamdulillah: { arabic: 'اَلْحَمْدُ لِلّٰه', translit: 'Alhamdulillah', target: 33 },
    allahuakbar: { arabic: 'اَللّٰهُ اَكْبَر', translit: 'Allahu Akbar', target: 34 },
    astagfirullah: { arabic: 'اَسْتَغْفِرُ اللّٰه', translit: 'Astagfirullah', target: 100 },
    lailaha: { arabic: 'لَا اِلٰهَ اِلَّا اللّٰه', translit: 'La Ilaha Illallah', target: 100 },
    lahawla: { arabic: 'لَا حَوْلَ وَلَا قُوَّةَ اِلَّا بِاللّٰه', translit: 'La Hawla Wala Quwwata Illa Billah', target: null },
    yahayyu: { arabic: 'يَا حَيُّ يَا قَيُّوم', translit: 'Ya Hayyu Ya Qayyum', target: null },
  };

  const STORAGE_KEY = 'al-masail-counter';

  // ===== DOM REFS =====
  const dhikrArabic = document.getElementById('dhikrArabic')!;
  const dhikrTranslit = document.getElementById('dhikrTranslit')!;
  const dhikrTargetEl = document.getElementById('dhikrTarget')! as HTMLElement;
  const targetNum = document.getElementById('targetNum')!;
  const counterNumber = document.getElementById('counterNumber')!;
  const progressRing = document.getElementById('progressRing')! as unknown as SVGElement;
  const progressFill = document.getElementById('progressFill')! as unknown as SVGCircleElement;
  const counterRingWrap = document.getElementById('counterRingWrap')!;
  const tapBtn = document.getElementById('tapBtn')!;
  const resetBtn = document.getElementById('resetBtn')!;
  const themePills = document.querySelectorAll('.theme-pill');

  const statToday = document.getElementById('statToday')!;
  const statWeek = document.getElementById('statWeek')!;
  const statMonth = document.getElementById('statMonth')!;
  const statAllTime = document.getElementById('statAllTime')!;

  // ===== STATE =====
  interface ThemeData {
    days: Record<string, number>;
    allTime: number;
  }

  interface CounterState {
    activeTheme: string;
    data: Record<string, ThemeData>;
  }

  function getTodayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function loadState(): CounterState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { activeTheme: 'durood', data: {} };
  }

  function saveState(state: CounterState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getThemeData(state: CounterState, themeId: string): ThemeData {
    if (!state.data[themeId]) {
      state.data[themeId] = { days: {}, allTime: 0 };
    }
    return state.data[themeId];
  }

  // ===== PROGRESS RING =====
  const CIRCUMFERENCE = 2 * Math.PI * 88; // r=88

  function updateProgressRing(count: number, target: number | null): void {
    if (target === null) {
      (progressRing as unknown as HTMLElement).style.display = 'none';
      counterRingWrap.classList.remove('target-reached');
      return;
    }
    (progressRing as unknown as HTMLElement).style.display = 'block';
    const progress = Math.min(count / target, 1);
    const offset = CIRCUMFERENCE * (1 - progress);
    progressFill.style.strokeDashoffset = String(offset);

    if (count >= target) {
      counterRingWrap.classList.add('target-reached');
    } else {
      counterRingWrap.classList.remove('target-reached');
    }
  }

  // ===== STATS =====
  function updateStats(themeData: ThemeData): void {
    const todayKey = getTodayKey();
    const today = new Date();

    // Today
    statToday.textContent = String(themeData.days[todayKey] || 0);

    // This week (last 7 days)
    let weekTotal = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      weekTotal += themeData.days[key] || 0;
    }
    statWeek.textContent = String(weekTotal);

    // This month
    let monthTotal = 0;
    const yearMonth = todayKey.slice(0, 7); // "YYYY-MM"
    for (const [key, val] of Object.entries(themeData.days)) {
      if (key.startsWith(yearMonth)) {
        monthTotal += val;
      }
    }
    statMonth.textContent = String(monthTotal);

    // All time
    statAllTime.textContent = String(themeData.allTime);
  }

  // ===== RENDER THEME =====
  function renderTheme(state: CounterState): void {
    const themeId = state.activeTheme;
    const theme = THEMES[themeId];
    if (!theme) return;

    dhikrArabic.textContent = theme.arabic;
    dhikrTranslit.textContent = theme.translit;

    if (theme.target !== null) {
      dhikrTargetEl.style.display = '';
      targetNum.textContent = String(theme.target);
    } else {
      dhikrTargetEl.style.display = 'none';
    }

    const themeData = getThemeData(state, themeId);
    const todayCount = themeData.days[getTodayKey()] || 0;
    counterNumber.textContent = String(todayCount);
    updateProgressRing(todayCount, theme.target);
    updateStats(themeData);

    // Update active pill
    themePills.forEach(pill => {
      pill.classList.toggle('active', (pill as HTMLElement).dataset.theme === themeId);
    });
  }

  // ===== INIT =====
  let state = loadState();
  renderTheme(state);

  // ===== THEME SWITCHING =====
  themePills.forEach(pill => {
    pill.addEventListener('click', () => {
      const themeId = (pill as HTMLElement).dataset.theme!;
      state.activeTheme = themeId;
      saveState(state);
      renderTheme(state);
    });
  });

  // ===== TAP COUNTER =====
  let celebratedTarget = false;

  tapBtn.addEventListener('click', () => {
    const themeId = state.activeTheme;
    const theme = THEMES[themeId];
    const themeData = getThemeData(state, themeId);
    const todayKey = getTodayKey();

    // Increment
    themeData.days[todayKey] = (themeData.days[todayKey] || 0) + 1;
    themeData.allTime += 1;
    saveState(state);

    const todayCount = themeData.days[todayKey];
    counterNumber.textContent = String(todayCount);

    // Pulse animation
    counterNumber.classList.add('pulse');
    setTimeout(() => counterNumber.classList.remove('pulse'), 150);

    // Progress ring
    updateProgressRing(todayCount, theme.target);

    // Target celebration
    if (theme.target !== null && todayCount === theme.target && !celebratedTarget) {
      celebratedTarget = true;
      counterRingWrap.classList.add('glow-celebrate');
      setTimeout(() => {
        counterRingWrap.classList.remove('glow-celebrate');
      }, 2500);
    }

    // Vibration
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    // Update stats
    updateStats(themeData);
  });

  // Reset celebration flag when theme changes
  themePills.forEach(pill => {
    pill.addEventListener('click', () => {
      celebratedTarget = false;
    });
  });

  // ===== RESET =====
  resetBtn.addEventListener('click', () => {
    if (!confirm('Reset today\'s count for this dhikr?')) return;

    const themeId = state.activeTheme;
    const themeData = getThemeData(state, themeId);
    const todayKey = getTodayKey();
    const todayCount = themeData.days[todayKey] || 0;

    themeData.allTime = Math.max(0, themeData.allTime - todayCount);
    themeData.days[todayKey] = 0;
    saveState(state);

    counterNumber.textContent = '0';
    updateProgressRing(0, THEMES[themeId].target);
    updateStats(themeData);
    celebratedTarget = false;
    counterRingWrap.classList.remove('target-reached', 'glow-celebrate');
  });
