/*
 * FITLAB Design Directions — shared sample data, formatting and icons.
 *
 * One dataset for all ten directions, so they can be compared on content, not
 * on numbers. Every total is computed from its parts; the assertions at the
 * bottom fail loudly in the console if a figure stops adding up.
 *
 * Moment shown: Friday 31 October, 18:20, mid-session (Upper B, week 3 of 8).
 * SAMPLE DATA — replace with real user data before any of this ships.
 */
(function () {
  const user = { name: 'Fabio', weightKg: 78.4, startWeightKg: 81.5, targetWeightKg: 76.0, proteinPerKg: 2.0, refWeightKg: 80 };

  // Plan: recomposition, adaptive. Block 2 (v3) began 13 Oct; v4 on 20 Oct after the 6–13 Oct stall.
  const plan = {
    name: 'Upper / Lower',
    goal: 'Ricomposizione',
    week: 3,
    weeks: 8,
    sessionsPerWeek: 4,
    dailyDeficit: -400,
    version: 4,
    versions: [
      { v: 1, date: '18 ago', change: 'Stima iniziale dal questionario', target: -500 },
      { v: 2, date: '8 set', change: 'Peso in calo più rapido del previsto: deficit ridotto', target: -450 },
      { v: 3, date: '13 ott', change: 'Nuovo blocco di 8 settimane, split Upper / Lower', target: -450 },
      { v: 4, date: '20 ott', change: 'Peso fermo per 2 settimane: TDEE ricalcolato −120 kcal', target: -400 },
    ],
    // Mesocycle load per week (relative volume, 1 = baseline); week 4 and 8 are deloads.
    load: [0.9, 1.0, 1.08, 0.7, 1.0, 1.1, 1.18, 0.7],
  };

  // Today's energy, projected to the end of the day.
  const burned = { bmr: 1720, steps: 520, training: 240 };
  burned.total = burned.bmr + burned.steps + burned.training; // 2480

  // Meals: macros are the source, kcal is derived (4/4/9).
  const kcalOf = (m) => m.p * 4 + m.c * 4 + m.f * 9;
  const meals = [
    { slot: 'Colazione', time: '07:40', name: 'Porridge ai frutti di bosco', p: 34, c: 68, f: 12, logged: true, img: 'porridge-frutti-bosco' },
    { slot: 'Pranzo', time: '13:10', name: 'Pollo, patate e insalata', p: 52, c: 92, f: 18, logged: true, img: 'pollo-patate-insalata' },
    { slot: 'Spuntino', time: '17:00', name: 'Yogurt greco, frutta e granola', p: 28, c: 30, f: 14, logged: true, img: 'yogurt-frutta-granola' },
    { slot: 'Cena', time: '20:30', name: 'Salmone, cereali e zucchine', p: 34, c: 62, f: 18, logged: false, img: 'salmone-cereali-zucchine' },
  ].map((m) => ({ ...m, kcal: kcalOf(m), src: `../../public/images/meals/${m.img}.webp` }));

  const sum = (arr, k) => arr.reduce((a, x) => a + x[k], 0);
  const eatenMeals = meals.filter((m) => m.logged);
  const eaten = { kcal: sum(eatenMeals, 'kcal'), p: sum(eatenMeals, 'p'), c: sum(eatenMeals, 'c'), f: sum(eatenMeals, 'f') };
  const planned = { kcal: sum(meals, 'kcal'), p: sum(meals, 'p'), c: sum(meals, 'c'), f: sum(meals, 'f') };

  // Intake target adapts to what was burned: burned + deficit.
  const intakeTarget = burned.total + plan.dailyDeficit; // 2080
  const proteinTarget = Math.round(user.proteinPerKg * user.refWeightKg); // 160
  const fatTarget = 65;
  const carbTarget = Math.round((intakeTarget - proteinTarget * 4 - fatTarget * 9) / 4); // 214
  const macros = [
    { key: 'p', label: 'Proteine', eaten: eaten.p, planned: planned.p, target: proteinTarget },
    { key: 'c', label: 'Carboidrati', eaten: eaten.c, planned: planned.c, target: carbTarget },
    { key: 'f', label: 'Grassi', eaten: eaten.f, planned: planned.f, target: fatTarget },
  ];

  const balanceProjected = planned.kcal - burned.total; // with dinner as planned
  const balanceNow = eaten.kcal - burned.total;

  // Week: Monday → Sunday. balance = eaten − burned; Friday is projected.
  const week = [
    { d: 'L', day: 'Lun', date: 27, session: 'Upper A', done: true, balance: -380 },
    { d: 'M', day: 'Mar', date: 28, session: 'Lower A', done: true, balance: -450 },
    { d: 'M', day: 'Mer', date: 29, session: null, done: false, balance: -210 },
    { d: 'G', day: 'Gio', date: 30, session: 'Lower B', done: true, balance: -480 },
    { d: 'V', day: 'Ven', date: 31, session: 'Upper B', done: false, live: true, balance: balanceProjected, projected: true, today: true },
    { d: 'S', day: 'Sab', date: 1, session: null, done: false, balance: null },
    { d: 'D', day: 'Dom', date: 2, session: null, done: false, balance: null },
  ];
  const weekTarget = plan.dailyDeficit * 7; // -2800
  const weekSoFar = week.reduce((a, d) => a + (d.balance ?? 0), 0);
  const sessionsDone = week.filter((d) => d.done).length;

  // Today's session, live: exercise 3, set 2.
  const session = {
    name: 'Upper B',
    focus: 'Petto, schiena, spalle',
    startedAt: '17:45',
    elapsedMin: 35,
    estMin: 55,
    rest: { left: 105, total: 120 },
    exercises: [
      { name: 'Panca piana', sets: 4, reps: '6–8', kg: 80, rir: 2, done: [8, 7, 7, 6], note: 'RIR 3 in tutte le serie la scorsa volta: +2,5 kg' },
      { name: 'Rematore con bilanciere', sets: 4, reps: '8', kg: 70, rir: 2, done: [8, 8, 8, 7] },
      { name: 'Military press', sets: 3, reps: '8', kg: 45, rir: 2, done: [8], current: true },
      { name: 'Lat machine', sets: 3, reps: '10', kg: 60, rir: 2, done: [] },
      { name: 'Alzate laterali', sets: 3, reps: '15', kg: 10, rir: 1, done: [] },
      { name: 'Face pull', sets: 3, reps: '15', kg: 25, rir: 1, done: [] },
    ],
  };
  session.setsTotal = session.exercises.reduce((a, e) => a + e.sets, 0);
  session.setsDone = session.exercises.reduce((a, e) => a + e.done.length, 0);
  session.volumeKg = session.exercises.reduce((a, e) => a + e.done.reduce((s, r) => s + r * e.kg, 0), 0);

  // Weight: weekly averages, 12 weeks from 18 Aug. Weeks 8–9 flat → plan v4.
  const weights = [81.5, 81.2, 80.8, 80.5, 80.2, 79.9, 79.7, 79.6, 79.6, 79.1, 78.8, 78.4];
  const weightLabels = ['18 ago', '25 ago', '1 set', '8 set', '15 set', '22 set', '29 set', '6 ott', '13 ott', '20 ott', '27 ott', '31 ott'];
  const weightRate = (weights[weights.length - 1] - weights[weights.length - 5]) / 4; // last 4 weeks, kg/week
  const progress = {
    weights, weightLabels,
    rate: weightRate,
    lost: +(weights[0] - weights[weights.length - 1]).toFixed(1),
    toGo: +(weights[weights.length - 1] - user.targetWeightKg).toFixed(1),
    waist: { now: 84, start: 87 },
    bodyFat: { now: 16.8, start: 18.9 },
    photos: [{ date: '18 ago' }, { date: '29 set' }, { date: '27 ott' }],
    log: [
      { date: 'Ven 31 ott', kg: 78.4 },
      { date: 'Lun 27 ott', kg: 78.8 },
      { date: 'Lun 20 ott', kg: 79.1 },
      { date: 'Lun 13 ott', kg: 79.6 },
    ],
  };

  // ── Formatting (it-IT) ───────────────────────────────────────────────
  const nf = new Intl.NumberFormat('it-IT', { useGrouping: 'always' });
  const n = (v) => nf.format(Math.round(v));
  const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + nf.format(Math.abs(Math.round(v)));
  const kg = (v, d = 1) => v.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
  const skg = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + kg(Math.abs(v), d);
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Icons: one outline set (lucide geometry), stroke = currentColor ──
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    dumbbell: '<path d="M14.4 14.4 9.6 9.6"/><path d="M18.66 21.07a2 2 0 0 1-2.83 0l-1.77-1.77a2 2 0 0 1 0-2.83l1.06-1.06-5.66-5.66-1.06 1.06a2 2 0 0 1-2.83 0l-1.77-1.77a2 2 0 0 1 0-2.83l1.77-1.77a2 2 0 0 1 2.83 0l1.77 1.77 1.06-1.06a2 2 0 0 1 2.83 0l5.66 5.66a2 2 0 0 1 0 2.83l-1.06 1.06 1.77 1.77a2 2 0 0 1 0 2.83z"/>',
    utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2V2M6 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.2.3 1.5 1.3 2.7 2.5 2.7z"/>',
    scale: '<path d="M16 16.5 19 9l3 7.5a3.5 3.5 0 0 1-6 0Z"/><path d="M2 16.5 5 9l3 7.5a3.5 3.5 0 0 1-6 0Z"/><path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    chev: '<path d="m9 18 6-6-6-6"/>',
    chevDown: '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    down: '<path d="m7 7 10 10M17 7v10H7"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    play: '<path d="M6 4l14 8-14 8z"/>',
    pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/>',
    steps: '<path d="M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6C14.6 6 14 7.8 14 9.5c0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0Z"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  };
  const icon = (name, size = 20, sw = 1.75) =>
    `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;

  // FITLAB mark (from public/logo.svg), fill = currentColor.
  const markPath = 'M0.4 466.6C0.1 465.8 2.2 457.8 5.0 448.8C34.7 355.6 69.7 292.5 112.6 254.9C138.8 231.9 168.5 215.7 199.5 207.2C233.6 198.0 219.6 198.6 386.8 198.3C510.9 198.0 534.1 198.2 534.6 199.3C535.3 201.1 514.8 237.8 502.3 257.0C473.1 301.9 432.5 330.9 384.0 341.2C375.4 343.0 369.1 343.3 316.5 344.0C258.1 344.8 248.4 345.4 224.5 349.1C152.2 360.6 82.3 397.0 12.8 459.2C2.9 468.2 1.4 469.1 0.4 466.6ZM80.5 224.2C82.2 215.0 94.1 180.5 100.8 165.4C141.5 73.5 203.8 19.3 286.5 4.1C307.8 0.1 314.2 0.0 474.5 0.0C624.6 0.0 630.9 0.1 631.4 1.8C632.3 4.6 582.6 99.5 572.9 113.5C555.1 139.2 531.6 154.8 498.5 162.7C492.2 164.2 477.6 164.4 353.0 165.0C199.5 165.7 210.1 165.2 183.5 172.5C150.1 181.7 121.0 196.9 91.4 220.7C80.8 229.2 79.5 229.6 80.5 224.2Z';

  // ── Phone mounting ───────────────────────────────────────────────────
  const TABS = [
    { key: 'home', label: 'Home', icon: 'home' },
    { key: 'training', label: 'Training', icon: 'dumbbell' },
    { key: 'nutrition', label: 'Nutrizione', icon: 'utensils' },
    { key: 'progress', label: 'Progressi', icon: 'chart' },
  ];
  const SCREEN_TITLES = { home: 'Home', training: 'Training', nutrition: 'Nutrizione', progress: 'Progressi' };

  /** Renders the four tab screens of one direction into #phones. */
  function mount(direction) {
    const host = document.getElementById('phones');
    host.innerHTML = TABS.map((t) => `
      <figure class="lab-phone">
        <div class="lab-device">
          <div class="screen ${direction.screenClass || ''}" data-screen="${t.key}">
            <div class="status"><span>18:20</span><span class="status-r">${statusIcons()}</span></div>
            <div class="scroll">${direction[t.key]()}</div>
            ${direction.tabbar(t.key)}
            <div class="home-ind"></div>
          </div>
        </div>
        <figcaption>${SCREEN_TITLES[t.key]}</figcaption>
      </figure>`).join('');
  }
  const statusIcons = () =>
    `<svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden="true"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.5" y="5" width="3" height="6" rx="1"/><rect x="9" y="2.5" width="3" height="8.5" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>` +
    `<svg width="25" height="12" viewBox="0 0 25 12" fill="none" aria-hidden="true"><rect x=".5" y=".5" width="21" height="11" rx="3.5" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="15" height="8" rx="2" fill="currentColor"/><path d="M23 4v4" stroke="currentColor" stroke-width="1.5" opacity=".4"/></svg>`;

  // ── Small SVG chart helpers (no chrome; callers pass colours) ────────
  function linePath(values, w, h, pad = 4, min, max) {
    const lo = min ?? Math.min(...values), hi = max ?? Math.max(...values);
    const x = (i) => pad + (i * (w - pad * 2)) / (values.length - 1);
    const y = (v) => pad + (1 - (v - lo) / (hi - lo || 1)) * (h - pad * 2);
    return { d: values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' '), x, y };
  }

  window.FITLAB = {
    user, plan, burned, meals, eaten, planned, intakeTarget, macros, balanceProjected, balanceNow,
    week, weekTarget, weekSoFar, sessionsDone, session, progress,
    n, signed, kg, skg, mmss, icon, markPath, TABS, mount, linePath,
  };

  // ── Assertions: the screens print these numbers, so they must agree ──
  console.assert(burned.total === 2480, 'burned total');
  console.assert(intakeTarget === 2080, 'intake target');
  console.assert(planned.kcal === eaten.kcal + meals.find((m) => !m.logged).kcal, 'meals add up');
  console.assert(macros.every((m) => m.planned >= m.eaten), 'planned ≥ eaten');
  console.assert(weekSoFar === week.slice(0, 5).reduce((a, d) => a + d.balance, 0), 'week sum');
  console.assert(session.setsDone === 4 + 4 + 1, 'sets done');
})();
