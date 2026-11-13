// LifeGame 2.0 Unified — Все экраны приложения, быстрые UX-действия (LAB-015 F-001..F-005), Голосовая рефлексия, Двусторонний ИИ и Снимки стратегий

const UI = {
  profile: 'demo', // 'demo' | 'personal'
  tab: 'today', // 'today' | 'strategy' | 'actions' | 'ai' | 'system'
  mapSubTab: 'big', // 'big' | 'mini' | 'path'
  miniFilter: 'all',
  selectedDirId: 'guitar',
  expandedFoldedDirs: {},
  actionsSubTab: 'all', // 'all' | 'calendar' | 'quests' | 'inbox' | 'history'
  actionsDirFilter: 'all',
  aiSubTab: 'evening', // 'evening' | 'partner'
  aiOpts: {
    mode: 'daily',
    format: 'json',
    includeDirections: true,
    includeActions: true,
    includeReflections: false,
    includeEconomy: false
  },
  aiImportRaw: '',
  aiProposals: [],
  eveningMood: 'calm',
  eveningText: '',
  eveningPrivate: true,
  isRecordingVoice: false,
  quickAddOpen: false,
  quickAddForm: {
    title: '',
    kind: 'task',
    directionId: 'guitar',
    locationId: 'any',
    datePreset: 'none', // 'none' | 'today' | 'tomorrow' | 'custom'
    dueDate: '',
    dueTime: '',
    inBasicRhythm: true,
    estMinutes: 15
  },
  inlinePopoverItemId: null,
  inlinePopoverMode: null, // 'minutes' | 'schedule'
  activeTimer: null, // { itemId, secondsLeft, totalMinutes, running }
  timerInterval: null,
  modal: null, // { type, data }
  toastMsg: '',
  toastTimer: null,
  mapPanX: -180,
  mapPanY: -120,
  mapScale: 0.88
};

let APP_STATE = null;

function initApp() {
  const meta = safeLoad(STORAGE_KEYS.meta, () => ({ profile: 'demo', muted: false }));
  UI.profile = meta.profile === 'personal' ? 'personal' : 'demo';
  SoundFX.muted = !!meta.muted;
  loadActiveProfileState();
  bindGlobalEvents();
  renderApp();
}

function loadActiveProfileState() {
  if (UI.profile === 'personal') {
    APP_STATE = safeLoad(STORAGE_KEYS.personal, buildCleanPersonalState);
  } else {
    APP_STATE = safeLoad(STORAGE_KEYS.demo, buildDemoWorldState);
  }
  APP_STATE.wallet.level = computeLevelFromXp(APP_STATE.wallet.xp);
  if (!APP_STATE.directions.some(d => d.id === UI.selectedDirId)) {
    UI.selectedDirId = APP_STATE.directions[0] ? APP_STATE.directions[0].id : 'soul';
  }
  UI.quickAddForm.directionId = UI.selectedDirId;
}

function persistState() {
  APP_STATE.wallet.level = computeLevelFromXp(APP_STATE.wallet.xp);
  const key = UI.profile === 'personal' ? STORAGE_KEYS.personal : STORAGE_KEYS.demo;
  safeSave(key, APP_STATE);
  safeSave(STORAGE_KEYS.meta, { profile: UI.profile, muted: SoundFX.muted });
}

function showToast(msg) {
  UI.toastMsg = msg;
  const el = document.getElementById('toastContainer');
  if (el) {
    el.innerHTML = `<div class="toast-box">${escapeHtml(msg)}</div>`;
  }
  if (UI.toastTimer) clearTimeout(UI.toastTimer);
  UI.toastTimer = setTimeout(() => {
    UI.toastMsg = '';
    const box = document.getElementById('toastContainer');
    if (box) box.innerHTML = '';
  }, 2900);
}

function renderApp() {
  document.documentElement.setAttribute('data-theme', APP_STATE.theme || 'night');
  document.documentElement.setAttribute('data-global-mode', APP_STATE.globalMode || 'full');

  const root = document.getElementById('appRoot');
  if (!root) return;

  const navItems = [
    { id: 'today', label: 'Сегодня', icon: LG_ICONS.sun },
    { id: 'strategy', label: 'Карта жизни', icon: LG_ICONS.map },
    { id: 'actions', label: 'Действия', icon: LG_ICONS.zap },
    { id: 'ai', label: 'ИИ и Вечер', icon: LG_ICONS.sparkles },
    { id: 'system', label: 'Бонусы и Сборка', icon: LG_ICONS.gift }
  ];

  let screenHtml = '';
  if (UI.tab === 'today') screenHtml = renderTodayScreen(APP_STATE);
  else if (UI.tab === 'strategy') screenHtml = renderStrategyScreen(APP_STATE);
  else if (UI.tab === 'actions') screenHtml = renderActionsHubScreen(APP_STATE);
  else if (UI.tab === 'ai') screenHtml = renderAiAndEveningScreen(APP_STATE);
  else screenHtml = renderSystemAndRewardsScreen(APP_STATE);

  const showWallet = APP_STATE.globalMode !== 'basic';

  root.innerHTML = `
    <div class="app-shell">
      <!-- Desktop Left Rail -->
      <aside class="desktop-rail">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:14px;">
          <div>
            <div class="font-mono" style="font-size:10px; letter-spacing:0.2em; color:var(--accent-gold);">LIFEGAME 2.0</div>
            <div class="font-display" style="font-size:17px; font-weight:800;">Unified</div>
          </div>
          ${showWallet ? `
            <div class="badge badge-gold" title="Монеты и уровень опыта">
              🪙 ${APP_STATE.wallet.coins} · Ур.${APP_STATE.wallet.level}
            </div>
          ` : `<span class="badge badge-oasis">🌿 Спокойный ритм</span>`}
        </div>

        <div style="display:flex; flex-direction:column; gap:5px; flex:1;">
          ${navItems.map(n => `
            <button type="button" data-action="switch-tab" data-tab="${n.id}"
              style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:13px; font-weight:600; font-size:13.5px; text-align:left; background:${UI.tab === n.id ? 'var(--accent-gold-soft)' : 'transparent'}; color:${UI.tab === n.id ? 'var(--accent-gold)' : 'var(--text-muted)'}; border:1px solid ${UI.tab === n.id ? 'rgba(255,218,41,0.3)' : 'transparent'};">
              <span>${n.icon}</span>
              <span>${n.label}</span>
            </button>
          `).join('')}
        </div>

        <div class="card-subtle" style="margin-top:auto; font-size:11.5px;">
          <div class="font-mono" style="font-size:10px; color:var(--text-muted);">АКТИВНЫЙ МИР ДАННЫХ</div>
          <div style="font-weight:700; margin-top:3px;">${UI.profile === 'demo' ? '✨ Демо-мир (10 земель)' : '🌱 Моя чистая жизнь'}</div>
          <button type="button" class="btn-ghost" style="width:100%; justify-content:center; margin-top:8px;" data-action="toggle-profile">
            Переключить на ${UI.profile === 'demo' ? '«Мою жизнь»' : '«Демо-мир»'}
          </button>
        </div>
      </aside>

      <!-- Main Stage -->
      <main class="main-stage">
        <header class="top-bar">
          <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <button type="button" class="chip" data-action="toggle-profile" title="Два полностью изолированных хранилища: Демо-мир для экспериментов и Чистая личная жизнь">
                ${UI.profile === 'demo' ? '✨ Демо (10 земель)' : '🌱 Моя жизнь'} ⇄
              </button>
              <span class="font-mono" style="font-size:11.5px; color:var(--text-muted);">${formatHumanDate(APP_STATE.currentDate)}</span>
              ${UI.profile === 'demo' ? `
                <button type="button" class="chip" data-action="step-demo-date" data-delta="1" title="Тестовый сдвиг даты только в Демо-мире">+1 день ⏭</button>
              ` : ''}
            </div>

            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              ${showWallet ? `
                <button type="button" class="chip" data-action="switch-tab" data-tab="system" title="Честная игровая экономика без штрафов и рулеток">
                  🪙 <strong>${APP_STATE.wallet.coins}</strong> · ⭐ ${APP_STATE.wallet.xp} XP
                </button>
              ` : ''}
              <button type="button" class="chip" data-action="open-fast-complete" title="Быстрое выполнение и повтор разовых дел (LG-002)">⚡ Выполнение</button>
              <button type="button" class="chip" data-action="cycle-theme" title="Сменить визуальную тему">🎨 Тема</button>
              <button type="button" class="chip" data-action="toggle-mute" title="Звуковой отклик Web Audio">${SoundFX.muted ? '🔇' : '🔊'}</button>
            </div>
          </div>

          <!-- 4 Global Modes Switcher -->
          <div class="pill-row" style="margin-top:8px;">
            <button type="button" class="chip ${APP_STATE.globalMode === 'basic' ? 'active' : ''}" data-action="set-global-mode" data-mode="basic">
              🌿 Базовый ритм
            </button>
            <button type="button" class="chip ${APP_STATE.globalMode === 'full' ? 'active' : ''}" data-action="set-global-mode" data-mode="full">
              ⚡ Полный конструктор
            </button>
            <button type="button" class="chip ${APP_STATE.globalMode === 'red' ? 'red-active' : ''}" data-action="set-global-mode" data-mode="red">
              🔴 Красный режим (Мобилизация)
            </button>
            <button type="button" class="chip ${APP_STATE.globalMode === 'pause' ? 'active' : ''}" data-action="set-global-mode" data-mode="pause">
              🎨 Творческая пауза
            </button>
          </div>
        </header>

        <div style="flex:1;">
          ${screenHtml}
        </div>
      </main>

      <!-- Mobile Bottom Navigation -->
      <nav class="mobile-bottom-nav">
        ${navItems.map(n => `
          <button type="button" class="nav-tab-btn ${UI.tab === n.id ? 'active' : ''}" data-action="switch-tab" data-tab="${n.id}">
            <span>${n.icon}</span>
            <span>${n.label.split(' ')[0]}</span>
          </button>
        `).join('')}
      </nav>
    </div>

    ${renderActiveModal(APP_STATE)}
    <div id="toastContainer">${UI.toastMsg ? `<div class="toast-box">${escapeHtml(UI.toastMsg)}</div>` : ''}</div>
  `;

  if (UI.tab === 'strategy' && UI.mapSubTab === 'big') {
    bindBigMapPanHandlers();
  }
}

function renderTodayScreen(state) {
  const visibleItems = getVisibleTodayItems(state);
  const todayFacts = state.facts.filter(f => f.date === state.currentDate);
  const todayMinutes = state.timeLogs
    .filter(t => t.date === state.currentDate)
    .reduce((s, t) => s + (Number(t.minutes) || 0), 0);

  let modeBannerHtml = '';

  if (state.globalMode === 'basic') {
    modeBannerHtml = `
      <div class="card" style="border-color:rgba(132,204,22,0.38); background:linear-gradient(135deg, rgba(132,204,22,0.09), transparent);">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px;">
          <div>
            <span class="badge badge-oasis">🌿 Мой базовый ритм · Без давления</span>
            <div style="font-size:12.5px; color:var(--text-muted); margin-top:5px;">
              Показаны только опорные дела ритма и сегодняшние встречи. Большая стратегия бережно сохранена и <strong>заморожена без накопления пропусков</strong>.
            </div>
          </div>
          <button type="button" class="btn-ghost" data-action="open-rhythm-picker">⚙ Настроить набор ритма</button>
        </div>
      </div>
    `;
  } else if (state.globalMode === 'full' && state.basicFreezeActive) {
    // Authorial rule #8 from Flexible Complexity v2.1: entering Full does NOT auto-resume frozen expectations!
    modeBannerHtml = `
      <div class="card-subtle" style="border-color:rgba(255,218,41,0.4);">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px;">
          <div style="font-size:12.5px;">
            🛡 <strong>Защита Базового ритма активна:</strong> ты открыл Полный режим для обзора или редактирования — скрытые дела не создают пропусков, пока ты явно не возобновишь всю стратегию.
          </div>
          <button type="button" class="btn-primary" style="padding:6px 12px; font-size:12px;" data-action="resume-full-strategy">
            Возобновить всю стратегию (без долгов)
          </button>
        </div>
      </div>
    `;
  } else if (state.globalMode === 'red') {
    const redDir = state.directions.find(d => d.id === state.redConfig.directionId) || state.directions[0];
    const care = state.redConfig.careChecks || {};
    modeBannerHtml = `
      <div class="card" style="border-color:rgba(239,68,68,0.5); background:var(--accent-mode-banner);">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-start; gap:10px;">
          <div style="flex:1; min-width:230px;">
            <span class="badge badge-red">🔴 Красный режим · Мобилизация вокруг одного приоритета</span>
            <div class="font-display" style="font-size:16px; font-weight:700; margin-top:6px;">
              Фокус: ${escapeHtml(redDir ? redDir.name : 'Приоритет')}
            </div>
            <div style="font-size:12.5px; color:var(--text-muted); margin-top:3px;">
              ${escapeHtml(state.redConfig.goalTitle || 'Главная цель периода концентрации')} · Второстепенные регулярные ожидания поставлены на честную паузу.
            </div>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="btn-ghost" data-action="open-red-config">⚙ Приоритет</button>
            <button type="button" class="btn-ghost" data-action="exit-red-mode">Завершить рывок спокойно</button>
          </div>
        </div>
        <!-- Preemptive Resting & Care Bar (Section 25.3 + ATLAS E-W1-016) -->
        <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.1); display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px;">
          <span style="font-size:12px; color:#fca5a5;">❤️‍🩹 <strong>Опора и цена рывка</strong> (не даёт выгореть, без штрафов):</span>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="chip ${care.sleep ? 'active' : ''}" data-action="toggle-red-care" data-care="sleep">😴 Достаточный сон</button>
            <button type="button" class="chip ${care.water ? 'active' : ''}" data-action="toggle-red-care" data-care="water">💧 Вода и еда вовремя</button>
            <button type="button" class="chip ${care.microBreak ? 'active' : ''}" data-action="toggle-red-care" data-care="microBreak">🌿 Микропауза 10 мин</button>
          </div>
        </div>
      </div>
    `;
  } else if (state.globalMode === 'pause') {
    modeBannerHtml = `
      <div class="card" style="border-color:rgba(167,139,250,0.45);">
        <span class="badge badge-gold">🎨 Творческая пауза активна</span>
        <div style="font-size:12.5px; color:var(--text-muted); margin-top:5px;">
          Регулярные ожидания сняты. Видны только назначенные на сегодня календарные встречи. Записывай мысли и счастливые моменты в свободном темпе.
        </div>
      </div>
    `;
  }

  return `
    <div style="padding:16px; display:flex; flex-direction:column; gap:14px;">
      ${modeBannerHtml}

      <!-- Full mode context controls (Tempo & Location) -->
      ${state.globalMode === 'full' ? `
        <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:space-between; align-items:center;">
          <div class="pill-row">
            <span class="font-mono" style="font-size:11px; color:var(--text-muted); margin-right:4px;">ТЕМП:</span>
            ${[['gentle','🌱 Бережно'],['normal','⚖ Обычно'],['intense','🔥 Фигачу']].map(([id, lbl]) => `
              <button type="button" class="chip ${state.tempo === id ? 'active' : ''}" data-action="set-tempo" data-tempo="${id}">${lbl}</button>
            `).join('')}
          </div>
          <div class="pill-row">
            <span class="font-mono" style="font-size:11px; color:var(--text-muted); margin-right:4px;">МЕСТО:</span>
            ${state.locations.map(loc => `
              <button type="button" class="chip ${state.locationId === loc.id ? 'active' : ''}" data-action="set-location" data-loc="${escapeHtml(loc.id)}">${loc.icon} ${escapeHtml(loc.name)}</button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Active Focus Timer Banner if running -->
      ${UI.activeTimer ? renderLiveTimerBanner(state) : ''}

      <!-- Summary + Optional Mini-Radar on Today -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px;">
        <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <div>
              <div class="font-mono" style="font-size:10.5px; color:var(--accent-gold);">СЕГОДНЯШНИЙ ПУЛЬС</div>
              <h2 class="font-display" style="margin:3px 0 0; font-size:19px;">
                ${todayFacts.length} отметок · ${todayMinutes} мин практики
              </h2>
              <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">
                Частичные минуты и полные завершения учитываются раздельно и честно.
              </div>
            </div>
            <button type="button" class="btn-primary" data-action="toggle-quick-add">
              ${LG_ICONS.plus} Добавить
            </button>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn-ghost" data-action="spark-first-step">🚀 Первый шаг (2 мин)</button>
            <button type="button" class="btn-ghost" data-action="spark-happiness">☀ Игра в счастье</button>
            <button type="button" class="btn-ghost" data-action="open-evening-ritual">🌙 Вечерняя рефлексия</button>
          </div>
        </div>

        ${state.showMiniRadarOnToday ? `
          <div class="card" style="padding:10px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <div style="flex:1;">
              <div class="font-mono" style="font-size:10px; color:var(--accent-gold);">МИНИ-КАРТА ОРИЕНТАЦИИ</div>
              <div style="font-size:13px; font-weight:700; margin-top:3px;">
                Ориентир: ${escapeHtml((state.directions.find(d => d.id === state.waypointDirectionId) || {}).name || 'Не выбран')}
              </div>
              <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px;">Нажми на точку радара, чтобы заглянуть в путь сферы.</div>
              <button type="button" class="btn-ghost" style="margin-top:8px; padding:5px 10px; font-size:11px;" data-action="switch-tab" data-tab="strategy">Открыть Большую карту →</button>
            </div>
            ${renderMiniRadarWidget(state, true)}
          </div>
        ` : ''}
      </div>

      <!-- Quick Add Drawer (Solves LAB-015 F-002: Structural Date/Deadline right inside Quick Add!) -->
      ${UI.quickAddOpen ? renderQuickAddCard(state) : ''}

      <!-- Today Items List -->
      <div style="display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="font-mono" style="font-size:11px; color:var(--text-muted);">
            ДЕЛА НА СЕГОДНЯ (${visibleItems.length})
          </span>
          ${state.globalMode === 'full' ? `
            <button type="button" class="btn-ghost" style="padding:4px 10px; font-size:11.5px;" data-action="switch-tab" data-tab="actions">
              Конструктор всех дел (${state.items.filter(i => i.status === 'active').length}) →
            </button>
          ` : ''}
        </div>

        ${visibleItems.length === 0 ? `
          <div class="card" style="text-align:center; padding:28px 18px;">
            <div style="font-size:15px; font-weight:700;">Спокойный свободный день</div>
            <div style="font-size:12.5px; color:var(--text-muted); margin-top:5px; max-width:440px; margin-inline:auto;">
              На сегодня нет обязательных пунктов в этом режиме. Можно добавить новое дело с датой, заглянуть в историю прошлых шагов или просто отдохнуть.
            </div>
            <div style="display:flex; gap:8px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
              <button type="button" class="btn-primary" data-action="toggle-quick-add">${LG_ICONS.plus} Создать дело</button>
              <button type="button" class="btn-ghost" data-action="go-history">📜 Открыть историю и минуты</button>
            </div>
          </div>
        ` : visibleItems.map(it => renderActionCard(state, it)).join('')}
      </div>
    </div>
  `;
}

function renderQuickAddCard(state) {
  const f = UI.quickAddForm;
  return `
    <div class="card" style="border:1.5px solid var(--accent-gold);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <strong style="font-size:14px;">⚡ Быстрое добавление (со структурным сроком — решение F-002)</strong>
        <button type="button" class="btn-ghost" style="padding:4px 9px;" data-action="toggle-quick-add">✕</button>
      </div>
      <div style="display:grid; gap:10px;">
        <input id="quickAddTitleInput" class="input-field" type="text" placeholder="Что важно сделать или какую мысль сохранить?" value="${escapeHtml(f.title)}" data-input="quick-title"/>

        <div class="pill-row">
          ${[['task','📝 Задание'],['habit','🔄 Привычка'],['calendar','📅 Событие календаря'],['inbox','💭 Мысль во Входящие']].map(([k, lbl]) => `
            <button type="button" class="chip ${f.kind === k ? 'active' : ''}" data-action="set-quick-kind" data-kind="${k}">${lbl}</button>
          `).join('')}
        </div>

        ${f.kind !== 'inbox' ? `
          <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
            <span class="font-mono" style="font-size:11px; color:var(--text-muted);">СРОК / ДАТА:</span>
            ${[['none','Без даты'],['today','Сегодня'],['tomorrow','Завтра'],['custom','Выбрать дату']].map(([p, lbl]) => `
              <button type="button" class="chip ${f.datePreset === p ? 'active' : ''}" data-action="set-quick-date-preset" data-preset="${p}">${lbl}</button>
            `).join('')}
            ${f.datePreset === 'custom' ? `
              <input type="date" class="input-field" style="width:auto; padding:5px 9px;" value="${escapeHtml(f.dueDate || state.currentDate)}" data-input="quick-custom-date"/>
              <input type="time" class="input-field" style="width:auto; padding:5px 9px;" value="${escapeHtml(f.dueTime)}" data-input="quick-custom-time"/>
            ` : ''}
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:8px;">
            <select class="input-field" data-input="quick-dir">
              ${state.directions.map(d => `<option value="${escapeHtml(d.id)}" ${f.directionId === d.id ? 'selected' : ''}>Сфера: ${escapeHtml(d.name)}</option>`).join('')}
            </select>
            <select class="input-field" data-input="quick-loc">
              ${state.locations.map(l => `<option value="${escapeHtml(l.id)}" ${f.locationId === l.id ? 'selected' : ''}>Место: ${l.icon} ${escapeHtml(l.name)}</option>`).join('')}
            </select>
          </div>
        ` : ''}

        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="btn-primary" data-action="submit-quick-add">Сохранить в систему</button>
        </div>
      </div>
    </div>
  `;
}

function renderActionCard(state, it) {
  const dir = state.directions.find(d => d.id === it.directionId);
  const loc = state.locations.find(l => l.id === it.locationId);
  const eff = getItemEffortSummary(state, it.id);
  const showPopover = UI.inlinePopoverItemId === it.id;
  const kindLabels = { task: 'Задание', habit: 'Привычка', calendar: 'Встреча', quest: 'Квест' };

  return `
    <div class="card" style="border-left: 3.5px solid ${escapeHtml(dir ? dir.color : '#ffda29')};">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="badge badge-muted">${kindLabels[it.kind] || 'Дело'}</span>
            ${dir ? `<span class="badge" style="background:${escapeHtml(dir.color)}20; color:${escapeHtml(dir.color)};">${escapeHtml(dir.short)}</span>` : ''}
            ${loc && loc.id !== 'any' ? `<span class="badge badge-muted">${loc.icon} ${escapeHtml(loc.name)}</span>` : ''}
            ${it.dueDate ? `<span class="badge badge-amber">📅 ${escapeHtml(it.dueDate)}${it.dueTime ? ' · ' + escapeHtml(it.dueTime) : ''}</span>` : ''}
            ${it.isKey ? `<span class="badge badge-gold">★ Ключевое</span>` : ''}
          </div>
          <div style="font-size:15px; font-weight:700; margin-top:6px; ${eff.todayDone ? 'text-decoration:line-through; opacity:0.75;' : ''}">
            ${escapeHtml(it.title)}
          </div>

          ${it.kind === 'quest' && Array.isArray(it.questSteps) ? `
            <div style="margin-top:8px; display:flex; flex-direction:column; gap:5px;">
              ${it.questSteps.map(qs => `
                <button type="button" data-action="toggle-quest-step" data-item-id="${escapeHtml(it.id)}" data-step-id="${escapeHtml(qs.id)}"
                  style="display:flex; align-items:center; gap:7px; text-align:left; font-size:12.5px; padding:4px 8px; border-radius:8px; background:var(--bg-void); color:${qs.done ? 'var(--accent-oasis)' : 'var(--text-main)'};">
                  <span>${qs.done ? '☑' : '☐'}</span>
                  <span style="${qs.done ? 'text-decoration:line-through; opacity:0.8;' : ''}">${escapeHtml(qs.text)}</span>
                </button>
              `).join('')}
            </div>
          ` : ''}

          <!-- 7-DAY EFFORT STRIP (Solves LAB-015 F-001: partial minutes clearly visible alongside completions!) -->
          <div class="week-strip" title="Лента за 7 дней: зелёный = полное выполнение, янтарный = сохранённые частичные минуты практики">
            ${eff.strip.map(d => `
              <div class="day-pip ${d.stateClass} ${d.isToday ? 'today' : ''}">
                <span>${d.weekday}</span>
                <span>${d.done ? '✓' : (d.minutes > 0 ? d.minutes + 'м' : '·')}</span>
              </div>
            `).join('')}
            <span style="font-size:11.5px; color:var(--text-muted); margin-left:4px;">
              За 7 дн.: <strong>${eff.totalWeekMinutes} мин</strong> · ${eff.completedDays} отм.${eff.partialDays > 0 ? ` · <span style="color:var(--accent-amber);">${eff.partialDays} дн. частичной практики</span>` : ''}
            </span>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex-shrink:0;">
          <button type="button" class="${eff.todayDone ? 'btn-ghost' : 'btn-primary'}" data-action="toggle-complete" data-item-id="${escapeHtml(it.id)}">
            ${eff.todayDone ? '↩ Отменить' : `${LG_ICONS.check} Выполнить`}
          </button>
          ${state.globalMode !== 'basic' ? `
            <span class="font-mono" style="font-size:10.5px; color:var(--text-muted);">+${it.coins || 10} 🪙 · +${it.xp || 15} XP</span>
          ` : ''}
        </div>
      </div>

      <!-- Inline Short Actions Row (Solves LAB-015 F-003, F-004, F-005 without opening a 12-field form!) -->
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:10px; padding-top:9px; border-top:1px solid var(--border-subtle);">
        <button type="button" class="btn-ghost" style="padding:5px 10px; font-size:11.5px;" data-action="open-inline-popover" data-item-id="${escapeHtml(it.id)}" data-mode="minutes">
          ⏱ Минуты${eff.todayMinutes > 0 ? ` (${eff.todayMinutes}м сегодня)` : ''}
        </button>
        <button type="button" class="btn-ghost" style="padding:5px 10px; font-size:11.5px;" data-action="start-focus-timer" data-item-id="${escapeHtml(it.id)}">
          ▶ Таймер (${it.estMinutes || 15}м)
        </button>
        <button type="button" class="btn-ghost" style="padding:5px 10px; font-size:11.5px;" data-action="open-inline-popover" data-item-id="${escapeHtml(it.id)}" data-mode="schedule">
          📅 Срок / Повтор
        </button>
        <button type="button" class="btn-ghost" style="padding:5px 10px; font-size:11.5px;" data-action="toggle-key-star" data-item-id="${escapeHtml(it.id)}">
          ${it.isKey ? '★ Убрать звезду' : '☆ Ключевое'}
        </button>
      </div>

      ${showPopover ? renderInlineItemPopover(state, it) : ''}
    </div>
  `;
}

function renderInlineItemPopover(state, it) {
  if (UI.inlinePopoverMode === 'minutes') {
    const todayMins = state.timeLogs
      .filter(t => t.itemId === it.id && t.date === state.currentDate)
      .reduce((s, t) => s + (Number(t.minutes) || 0), 0);
    return `
      <div class="card-subtle" style="margin-top:8px; border-color:var(--accent-amber);">
        <div style="font-size:12px; font-weight:600; margin-bottom:6px;">
          ⏱ Записать частичные или полные минуты за сегодня (отдельно от награды; сейчас: ${todayMins} мин)
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          ${[5, 8, 10, 15, 25, 40].map(m => `
            <button type="button" class="chip" data-action="add-quick-minutes" data-item-id="${escapeHtml(it.id)}" data-mins="${m}">+${m} мин</button>
          `).join('')}
          ${todayMins > 0 ? `<button type="button" class="chip" data-action="reset-today-minutes" data-item-id="${escapeHtml(it.id)}">Сбросить минуты сегодня</button>` : ''}
          <button type="button" class="btn-ghost" style="margin-left:auto; padding:4px 9px;" data-action="close-inline-popover">Готово</button>
        </div>
      </div>
    `;
  }

  // Schedule / Reschedule short popover (F-003 & F-005 fix!)
  return `
    <div class="card-subtle" style="margin-top:8px; border-color:var(--accent-gold);">
      <div style="font-size:12px; font-weight:600; margin-bottom:6px;">
        📅 Быстрая настройка расписания и переноса (прошлые факты и циклы сохраняются!)
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
        <button type="button" class="chip ${it.schedule === 'once' ? 'active' : ''}" data-action="quick-set-schedule" data-item-id="${escapeHtml(it.id)}" data-sched="once">Разовое</button>
        <button type="button" class="chip ${it.schedule === 'daily' ? 'active' : ''}" data-action="quick-set-schedule" data-item-id="${escapeHtml(it.id)}" data-sched="daily">Ежедневно</button>
        <button type="button" class="chip ${it.schedule === 'saturday' ? 'active' : ''}" data-action="quick-set-schedule" data-item-id="${escapeHtml(it.id)}" data-sched="saturday">По субботам</button>
        <button type="button" class="chip" data-action="quick-shift-date" data-item-id="${escapeHtml(it.id)}" data-days="1">Перенести на завтра (+1 дн.)</button>
        <button type="button" class="chip ${it.inBasicRhythm ? 'active' : ''}" data-action="toggle-basic-membership" data-item-id="${escapeHtml(it.id)}">
          ${it.inBasicRhythm ? '✓ В Базовом ритме' : '+ Включить в Базовый ритм'}
        </button>
        <button type="button" class="btn-ghost" style="margin-left:auto; padding:4px 9px;" data-action="close-inline-popover">Закрыть</button>
      </div>
    </div>
  `;
}

function renderLiveTimerBanner(state) {
  const t = UI.activeTimer;
  const item = state.items.find(i => i.id === t.itemId);
  const mins = Math.floor(t.secondsLeft / 60);
  const secs = String(t.secondsLeft % 60).padStart(2, '0');
  const elapsedMins = Math.max(1, Math.round((t.totalMinutes * 60 - t.secondsLeft) / 60));

  return `
    <div class="card" style="border-color:var(--accent-gold); display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px;">
      <div>
        <span class="badge badge-gold">⏱ Таймер подхода (не ставит галочку автоматически)</span>
        <div style="font-size:15px; font-weight:700; margin-top:4px;">${escapeHtml(item ? item.title : 'Фокус-сессия')} — <span class="font-mono" id="liveTimerDigits">${mins}:${secs}</span></div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button type="button" class="btn-primary" data-action="commit-timer-minutes" data-mins="${elapsedMins}">Записать ${elapsedMins} мин в историю</button>
        <button type="button" class="btn-ghost" data-action="cancel-timer">Закрыть без записи</button>
      </div>
    </div>
  `;
}

function renderActionsHubScreen(state) {
  const tabs = [
    { id: 'all', label: `Все дела (${state.items.length})` },
    { id: 'calendar', label: '📅 Календарь и сроки' },
    { id: 'inbox', label: `💭 Входящие (${state.inbox.length})` },
    { id: 'history', label: `📜 История и Минуты (${state.facts.length + state.timeLogs.length})` }
  ];

  let inner = '';

  if (UI.actionsSubTab === 'inbox') {
    inner = `
      <div class="card">
        <div style="display:flex; gap:8px; margin-bottom:12px;">
          <input id="inboxNewInput" class="input-field" placeholder="Быстро записать мысль, идею этапа или наблюдение..."/>
          <button type="button" class="btn-primary" data-action="add-inbox-thought">Записать</button>
        </div>
        ${state.inbox.length === 0 ? `<div style="color:var(--text-muted); font-size:12.5px;">Во Входящих чисто.</div>` : `
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${state.inbox.map(inb => `
              <div class="card-subtle" style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px;">
                <div>
                  <div style="font-weight:600;">${escapeHtml(inb.text)}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(inb.createdAt)} · ${escapeHtml(inb.tag || 'Мысль')}</div>
                </div>
                <div style="display:flex; gap:6px;">
                  <button type="button" class="btn-ghost" data-action="promote-inbox-to-task" data-inb-id="${escapeHtml(inb.id)}">→ В задание</button>
                  <button type="button" class="btn-ghost" data-action="delete-inbox" data-inb-id="${escapeHtml(inb.id)}">✕</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  } else if (UI.actionsSubTab === 'history') {
    const totalAllMins = state.timeLogs.reduce((s, t) => s + (Number(t.minutes) || 0), 0);
    inner = `
      <div class="card">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px; margin-bottom:12px;">
          <div>
            <strong>Единый журнал фактов и частичных минут</strong>
            <div style="font-size:12px; color:var(--text-muted);">Всего выполнений: ${state.facts.length} · Всего учтено времени: ${totalAllMins} мин.</div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:7px;">
          ${state.timeLogs.slice().reverse().map(tl => {
            const it = state.items.find(x => x.id === tl.itemId);
            const hasFullFact = state.facts.some(f => f.itemId === tl.itemId && f.date === tl.date);
            return `
              <div class="card-subtle" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <div>
                  <span class="badge ${hasFullFact ? 'badge-oasis' : 'badge-amber'}">${hasFullFact ? '✓ Полная отметка + время' : '⏱ Частичная практика'}</span>
                  <strong style="margin-left:6px;">${escapeHtml(it ? it.title : 'Дело')}</strong>
                  <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px;">${escapeHtml(tl.date)} · <strong>${tl.minutes} мин.</strong> ${tl.note ? '— ' + escapeHtml(tl.note) : ''}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else {
    let list = state.items;
    if (UI.actionsSubTab === 'calendar') {
      list = list.filter(i => i.dueDate || i.kind === 'calendar');
    }
    if (UI.actionsDirFilter !== 'all') {
      list = list.filter(i => i.directionId === UI.actionsDirFilter);
    }

    inner = `
      <div class="pill-row">
        <button type="button" class="chip ${UI.actionsDirFilter === 'all' ? 'active' : ''}" data-action="set-actions-dir-filter" data-dir="all">Все сферы</button>
        ${state.directions.map(d => `
          <button type="button" class="chip ${UI.actionsDirFilter === d.id ? 'active' : ''}" data-action="set-actions-dir-filter" data-dir="${escapeHtml(d.id)}">${escapeHtml(d.short)}</button>
        `).join('')}
      </div>
      <div style="display:flex; flex-direction:column; gap:9px;">
        ${list.map(it => {
          const dir = state.directions.find(d => d.id === it.directionId);
          return `
            <div class="card" style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px;">
              <div>
                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                  <span class="badge badge-muted">${it.status === 'completed' ? '✓ Завершённое разовое' : 'Активно'}</span>
                  ${dir ? `<span class="badge" style="background:${escapeHtml(dir.color)}22; color:${escapeHtml(dir.color)};">${escapeHtml(dir.short)}</span>` : ''}
                  ${it.dueDate ? `<span class="badge badge-amber">📅 ${escapeHtml(it.dueDate)} ${escapeHtml(it.dueTime || '')}</span>` : ''}
                </div>
                <div style="font-weight:700; margin-top:5px;">${escapeHtml(it.title)}</div>
              </div>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                ${it.status === 'completed' ? `
                  <button type="button" class="btn-primary" data-action="repeat-completed-item" data-item-id="${escapeHtml(it.id)}" title="Решение F-004: продолжить прежнее разовое дело новым циклом без дубликатов!">
                    ↻ Ещё подход сегодня
                  </button>
                ` : `
                  <button type="button" class="chip ${it.inTodayConstructor ? 'active' : ''}" data-action="toggle-today-constructor" data-item-id="${escapeHtml(it.id)}">
                    ${it.inTodayConstructor ? '✓ В плане дня' : '+ В план дня'}
                  </button>
                  <button type="button" class="chip ${it.inBasicRhythm ? 'active' : ''}" data-action="toggle-basic-membership" data-item-id="${escapeHtml(it.id)}">
                    ${it.inBasicRhythm ? '🌿 В ритме' : '+ В ритм'}
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  return `
    <div style="padding:16px; display:flex; flex-direction:column; gap:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <div class="font-mono" style="font-size:10.5px; color:var(--accent-gold);">КОНСТРУКТОР ДЕЙСТВИЙ И ИСТОРИИ</div>
          <h1 class="font-display" style="margin:3px 0 0; font-size:20px;">Все записи системы</h1>
        </div>
        <button type="button" class="btn-primary" data-action="open-quick-add-from-hub">${LG_ICONS.plus} Новое дело</button>
      </div>
      <div class="pill-row">
        ${tabs.map(t => `
          <button type="button" class="chip ${UI.actionsSubTab === t.id ? 'active' : ''}" data-action="set-actions-subtab" data-subtab="${t.id}">${t.label}</button>
        `).join('')}
      </div>
      ${inner}
    </div>
  `;
}

function renderAiAndEveningScreen(state) {
  const promptPreview = buildAiPromptPackage(state, UI.aiOpts);
  const localInsights = generateLocalAiInsight(state);

  return `
    <div style="padding:16px; display:flex; flex-direction:column; gap:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <div class="font-mono" style="font-size:10.5px; color:var(--accent-gold);">LIFEGAME AI v2 · ВЕЧЕРНЯЯ РЕФЛЕКСИЯ И ДВУСТОРОННИЙ ПАРТНЁР</div>
          <h1 class="font-display" style="margin:3px 0 0; font-size:20px;">Осмысление и поддержка</h1>
        </div>
      </div>

      <div class="pill-row">
        <button type="button" class="chip ${UI.aiSubTab === 'evening' ? 'active' : ''}" data-action="set-ai-subtab" data-subtab="evening">🌙 Вечерняя / Голосовая рефлексия</button>
        <button type="button" class="chip ${UI.aiSubTab === 'partner' ? 'active' : ''}" data-action="set-ai-subtab" data-subtab="partner">🤖 Двусторонний ИИ-партнёр</button>
      </div>

      ${UI.aiSubTab === 'evening' ? `
        <div class="card">
          <span class="badge badge-gold">🌙 Мягкий вечерний ритуал (минимум действий, без оценок и наград за просмотр)</span>
          <h3 style="margin:8px 0 6px;">1. Как ощущается сегодняшний вечер?</h3>
          <div class="pill-row">
            ${[['energized','✨ Наполненно'],['calm','🌿 Спокойно и тепло'],['tired','🌙 Приятная усталость'],['overloaded','🫂 Нужна бережность']].map(([m, lbl]) => `
              <button type="button" class="chip ${UI.eveningMood === m ? 'active' : ''}" data-action="set-evening-mood" data-mood="${m}">${lbl}</button>
            `).join('')}
          </div>

          <h3 style="margin:14px 0 6px;">2. Расскажи о дне голосом или парой строк</h3>
          <div style="display:flex; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
            <button type="button" class="${UI.isRecordingVoice ? 'chip red-active' : 'btn-ghost'}" data-action="toggle-voice-dictation">
              ${LG_ICONS.mic} ${UI.isRecordingVoice ? 'Идёт запись речи... (нажми для стопа)' : 'Надиктовать голосом (Web Speech)'}
            </button>
            <button type="button" class="chip ${UI.eveningPrivate ? 'active' : ''}" data-action="toggle-evening-private">
              ${UI.eveningPrivate ? '🔒 Приватно (не включать в ИИ-экспорт по умолчанию)' : '🔓 Разрешено для ИИ-анализа'}
            </button>
          </div>

          <textarea id="eveningStoryTextarea" class="input-field" rows="4" placeholder="Что сегодня было живым, где почувствовал сопротивление или радость?..." data-input="evening-text">${escapeHtml(UI.eveningText)}</textarea>

          <div style="display:flex; justify-content:flex-end; margin-top:10px;">
            <button type="button" class="btn-primary" data-action="save-evening-reflection">Сохранить вечерний рассказ и получить тёплый отклик</button>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:9px;">
          <div class="font-mono" style="font-size:11px; color:var(--text-muted);">СОХРАНЁННЫЕ ВЕЧЕРА (${state.reflections.length})</div>
          ${state.reflections.map(r => `
            <div class="card-subtle">
              <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-muted);">
                <span>${escapeHtml(r.date)} · <strong>${escapeHtml(r.moodLabel)}</strong></span>
                <span>${r.privateOnly ? '🔒 Личный архив' : '🔓 Доступно ИИ'}</span>
              </div>
              <div style="margin-top:6px;">${escapeHtml(r.text)}</div>
              <div style="margin-top:8px; padding:8px 10px; border-radius:10px; background:var(--accent-gold-soft); color:var(--text-main); font-size:12px;">
                💛 <em>${escapeHtml(r.reply)}</em>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <!-- Local Built-in Heuristic Insights -->
        <div class="card" style="border-color:rgba(255,218,41,0.35);">
          <span class="badge badge-gold">🧠 Мгновенный локальный аудит LifeGame (офлайн, без передачи данных)</span>
          <ul style="margin:10px 0 0; padding-left:18px; display:flex; flex-direction:column; gap:6px; font-size:13px;">
            ${localInsights.map(line => `<li>${line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`).join('')}
          </ul>
        </div>

        <!-- Step 1: Outbound Context Builder -->
        <div class="card">
          <h3 style="margin:0 0 8px;">Шаг 1. Сформировать проверенный пакет контекста для внешней модели</h3>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:8px; margin-bottom:10px;">
            <select class="input-field" data-input="ai-mode">
              <option value="daily" ${UI.aiOpts.mode === 'daily' ? 'selected' : ''}>Режим: Оперативный совет на сегодня</option>
              <option value="audit" ${UI.aiOpts.mode === 'audit' ? 'selected' : ''}>Режим: Анализ устойчивости и препятствий</option>
              <option value="strategy" ${UI.aiOpts.mode === 'strategy' ? 'selected' : ''}>Режим: Стратегический разбор Карты и LVMG</option>
            </select>
            <select class="input-field" data-input="ai-format">
              <option value="json" ${UI.aiOpts.format === 'json' ? 'selected' : ''}>Формат: Разбор + JSON для автоприменения</option>
              <option value="plan" ${UI.aiOpts.format === 'plan' ? 'selected' : ''}>Формат: Короткий список шагов</option>
              <option value="text" ${UI.aiOpts.format === 'text' ? 'selected' : ''}>Формат: Спокойное текстовое письмо</option>
            </select>
          </div>
          <div class="pill-row" style="margin-bottom:10px;">
            <button type="button" class="chip ${UI.aiOpts.includeDirections ? 'active' : ''}" data-action="toggle-ai-opt" data-opt="includeDirections">Карта направлений</button>
            <button type="button" class="chip ${UI.aiOpts.includeActions ? 'active' : ''}" data-action="toggle-ai-opt" data-opt="includeActions">Дела и частичные минуты</button>
            <button type="button" class="chip ${UI.aiOpts.includeReflections ? 'active' : ''}" data-action="toggle-ai-opt" data-opt="includeReflections">Вечерние рассказы</button>
            <button type="button" class="chip ${UI.aiOpts.includeEconomy ? 'active' : ''}" data-action="toggle-ai-opt" data-opt="includeEconomy">Игровой баланс</button>
          </div>
          <textarea class="input-field font-mono" rows="6" readonly style="font-size:11.5px;">${escapeHtml(promptPreview)}</textarea>
          <div style="display:flex; justify-content:flex-end; margin-top:8px;">
            <button type="button" class="btn-primary" data-action="copy-ai-prompt">📋 Скопировать пакет запроса</button>
          </div>
        </div>

        <!-- Step 2: Inbound AI Recommendations Preview & Safe Apply -->
        <div class="card">
          <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
            <h3 style="margin:0;">Шаг 2. Принять ответ ИИ и выборочно применить предложения</h3>
            <button type="button" class="btn-ghost" data-action="fill-sample-ai-response">✨ Вставить пример ответа ИИ</button>
          </div>
          <textarea class="input-field" rows="4" placeholder="Вставь сюда ответ или JSON-блок от внешней модели (ChatGPT, Claude, Gemini)..." data-input="ai-import-raw">${escapeHtml(UI.aiImportRaw)}</textarea>
          <div style="display:flex; justify-content:flex-end; margin-top:8px;">
            <button type="button" class="btn-ghost" data-action="parse-ai-response">Разобрать предложения для проверки</button>
          </div>

          ${UI.aiProposals.length > 0 ? `
            <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:8px;">
              <div style="font-size:12px; color:var(--accent-gold);">Предпросмотр изменений (перед применением автоматически сохранится страховочный снимок стратегии!):</div>
              ${UI.aiProposals.map((p, idx) => `
                <div class="card-subtle" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                  <div>
                    <span class="badge badge-gold">${p.type === 'update_hypothesis' ? 'Гипотеза маршрута' : 'Новое действие'}</span>
                    <strong style="margin-left:6px;">${escapeHtml(p.title || p.unknownGap)}</strong>
                    <span style="font-size:11.5px; color:var(--text-muted); margin-left:6px;">(сфера: ${escapeHtml(p.directionId)})</span>
                  </div>
                  <button type="button" class="chip ${p.accepted ? 'active' : ''}" data-action="toggle-ai-proposal" data-idx="${idx}">
                    ${p.accepted ? '☑ Одобрено' : '☐ Пропустить'}
                  </button>
                </div>
              `).join('')}
              <button type="button" class="btn-primary" data-action="apply-ai-proposals">Применить выбранные рекомендации (со снимком защиты)</button>
            </div>
          ` : ''}
        </div>
      `}
    </div>
  `;
}

function renderSystemAndRewardsScreen(state) {
  return `
    <div style="padding:16px; display:flex; flex-direction:column; gap:14px;">
      <!-- Economy & Bonus Shop -->
      <div class="card">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px;">
          <div>
            <div class="font-mono" style="font-size:10.5px; color:var(--accent-gold);">ЧЕСТНАЯ ИГРОВАЯ ЭКОНОМИКА PERSONAL 1.2.0</div>
            <h2 class="font-display" style="margin:3px 0 0; font-size:19px;">
              🪙 ${state.wallet.coins} монет · ⭐ ${state.wallet.xp} XP · Уровень ${state.wallet.level}
            </h2>
          </div>
          <button type="button" class="btn-ghost" data-action="open-add-bonus">${LG_ICONS.plus} Свой бонус в магазин</button>
        </div>

        <div style="margin-top:12px; display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:10px;">
          ${state.bonuses.map(b => `
            <div class="card-subtle" style="display:flex; flex-direction:column; justify-content:space-between; gap:8px;">
              <div>
                <div style="display:flex; justify-content:space-between; gap:6px;">
                  <strong>🎁 ${escapeHtml(b.title)}</strong>
                  <span class="badge badge-gold">${b.cost} 🪙</span>
                </div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${b.repeatable ? 'Многоразовый бонус' : 'Одноразовая награда'}</div>
              </div>
              <button type="button" class="btn-primary" style="width:100%;" data-action="buy-bonus" data-bonus-id="${escapeHtml(b.id)}" ${state.wallet.coins < b.cost ? 'disabled' : ''}>
                Купить за ${b.cost} 🪙
              </button>
            </div>
          `).join('')}
        </div>

        ${state.ownedBonuses.length > 0 ? `
          <div style="margin-top:12px; padding-top:10px; border-top:1px solid var(--border-subtle);">
            <div class="font-mono" style="font-size:10.5px; color:var(--text-muted); margin-bottom:6px;">МОИ КУПЛЕННЫЕ БОНУСЫ (возврат возможен 1 раз до использования по точной цене покупки):</div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${state.ownedBonuses.map(ob => `
                <div class="card-subtle" style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px;">
                  <div>
                    <strong style="${ob.used ? 'text-decoration:line-through; opacity:0.65;' : ''}">${escapeHtml(ob.title)}</strong>
                    <span class="badge badge-muted" style="margin-left:6px;">${ob.used ? 'Использован' : (ob.refunded ? 'Возвращён' : 'Доступен')}</span>
                  </div>
                  ${(!ob.used && !ob.refunded) ? `
                    <div style="display:flex; gap:6px;">
                      <button type="button" class="chip active" data-action="use-owned-bonus" data-own-id="${escapeHtml(ob.id)}">Использовать с радостью</button>
                      <button type="button" class="btn-ghost" data-action="refund-owned-bonus" data-own-id="${escapeHtml(ob.id)}">Вернуть (+${ob.paidCost} 🪙)</button>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Price of Word (Добровольная Цена слова) -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <strong>🤝 Принятые решения и добровольная «Цена слова»</strong>
            <div style="font-size:12px; color:var(--text-muted);">Никаких автоматических штрафов в полночь: решение закрывается только твоим честным словом.</div>
          </div>
          <button type="button" class="btn-ghost" data-action="open-add-word-commitment">${LG_ICONS.plus} Дать слово</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
          ${state.wordCommitments.length === 0 ? `<div style="font-size:12px; color:var(--text-muted);">Нет активных ставок «Цены слова».</div>` : state.wordCommitments.map(wc => `
            <div class="card-subtle" style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px;">
              <div>
                <strong>${escapeHtml(wc.title)}</strong>
                <div style="font-size:11.5px; color:var(--text-muted);">Срок: ${escapeHtml(wc.dueDate || 'без даты')} · Ставка: ${wc.stakeCoins} 🪙 · Статус: ${wc.status}</div>
              </div>
              ${wc.status === 'active' ? `
                <div style="display:flex; gap:6px;">
                  <button type="button" class="chip active" data-action="resolve-word" data-wc-id="${escapeHtml(wc.id)}" data-outcome="kept">✓ Сдержал слово (+15 XP)</button>
                  <button type="button" class="btn-ghost" data-action="resolve-word" data-wc-id="${escapeHtml(wc.id)}" data-outcome="missed">Признать невыполнение (−${wc.stakeCoins} 🪙)</button>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Strategy Versions, Selective Cleanup & Clean Slate without losing life XP (Flexible Complexity v2.1 Sections 9-14) -->
      <div class="card">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px;">
          <div>
            <strong>🗂 Версии стратегии и защита прожитого опыта (Концепция v2.1)</strong>
            <div style="font-size:12px; color:var(--text-muted);">Создавай снимки, пересматривай или начинай стратегию с чистого листа — твои монеты, XP, уровень и история жизни никогда не обнуляются.</div>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="btn-primary" data-action="create-snapshot-now">📸 Сохранить снимок стратегии</button>
            <button type="button" class="btn-ghost" data-action="clean-slate-strategy">🌱 Чистый лист планов (сохранив опыт)</button>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:7px; margin-top:10px;">
          ${state.snapshots.map(sn => `
            <div class="card-subtle" style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px;">
              <div>
                <strong>${escapeHtml(sn.name)}</strong>
                <div style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(sn.createdAt)} · ${sn.directionsCount} сфер · ${sn.itemsCount} активных дел · ${escapeHtml(sn.note || '')}</div>
              </div>
              ${sn.payload ? `<button type="button" class="btn-ghost" data-action="restore-snapshot" data-snap-id="${escapeHtml(sn.id)}">↩ Восстановить стратегию</button>` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Guarded JSON Export / Import -->
      <div class="card-subtle" style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px;">
        <div style="font-size:12.5px;">
          <strong>💾 Полная автономность данных:</strong> скачай резервную копию текущего мира в JSON или восстанови её с проверкой целостности.
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn-ghost" data-action="export-json">⬇ Скачать JSON</button>
          <button type="button" class="btn-ghost" data-action="open-import-json">⬆ Импорт JSON</button>
        </div>
      </div>
    </div>
  `;
}

function renderActiveModal(state) {
  if (!UI.modal) return '';
  const m = UI.modal;

  if (m.type === 'edit-direction') {
    const d = state.directions.find(x => x.id === m.dirId);
    if (!d) return '';
    return `
      <div class="modal-backdrop" data-action="close-modal-backdrop">
        <div class="modal-sheet">
          <h3 class="font-display" style="margin:0 0 12px;">Настройка направления «${escapeHtml(d.name)}»</h3>
          <div style="display:grid; gap:9px;">
            <label style="font-size:12px; color:var(--text-muted);">1. Фактическое положение (что уже есть / умею):
              <input id="modDirFact" class="input-field" value="${escapeHtml(d.fact)}"/>
            </label>
            <label style="font-size:12px; color:var(--text-muted);">2. Текущий рабочий этап:
              <input id="modDirCurrent" class="input-field" value="${escapeHtml(d.currentStage.title)}"/>
            </label>
            <label style="font-size:12px; color:var(--text-muted);">Внутренняя стратегия текущего этапа:
              <input id="modDirStrategy" class="input-field" value="${escapeHtml(d.currentStage.strategy)}"/>
            </label>
            <label style="font-size:12px; color:var(--text-muted);">3. Следующий этап:
              <input id="modDirNext" class="input-field" value="${escapeHtml(d.nextStage)}"/>
            </label>
            <label style="font-size:12px; color:var(--text-muted);">4. Оптимальный уровень (Оазис достаточности):
              <input id="modDirOptimal" class="input-field" value="${escapeHtml(d.optimal)}"/>
            </label>
            <label style="font-size:12px; color:var(--text-muted);">5. Неизвестное / гипотеза о разрыве маршрута:
              <input id="modDirUnknown" class="input-field" value="${escapeHtml(d.unknownGap)}"/>
            </label>
            <label style="font-size:12px; color:var(--text-muted);">6. Маяк LVMG (вообразимый дальний горизонт):
              <input id="modDirLvmg" class="input-field" value="${escapeHtml(d.lvmg)}"/>
            </label>
            <label style="display:flex; align-items:center; gap:8px; font-size:12.5px;">
              <input type="checkbox" id="modDirRouteKnown" ${d.routeKnownToLvmg ? 'checked' : ''}/>
              Маршрут до LVMG уже примерно понятен (иначе на карте честный разрыв дороги)
            </label>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
            <button type="button" class="btn-ghost" data-action="close-modal">Отмена</button>
            <button type="button" class="btn-primary" data-action="save-edit-direction" data-dir-id="${escapeHtml(d.id)}">Сохранить этапы</button>
          </div>
        </div>
      </div>
    `;
  }

  if (m.type === 'add-direction') {
    return `
      <div class="modal-backdrop" data-action="close-modal-backdrop">
        <div class="modal-sheet">
          <h3 class="font-display" style="margin:0 0 12px;">Новое жизненное направление на Карте</h3>
          <div style="display:grid; gap:9px;">
            <input id="newDirName" class="input-field" placeholder="Название сферы (например, Японский язык или Мастерская)"/>
            <input id="newDirFact" class="input-field" placeholder="Фактическое положение сейчас (что уже есть)"/>
            <input id="newDirCurr" class="input-field" placeholder="Текущий рабочий этап (над чем работаю)"/>
            <input id="newDirOpt" class="input-field" placeholder="Оптимальный оазис (где будет достаточно хорошо)"/>
            <input id="newDirLvmg" class="input-field" placeholder="Дальний маяк LVMG (смелый образ будущего)"/>
            <select id="newDirNature" class="input-field">
              <option value="growth">Природа сферы: Развитие и созидание</option>
              <option value="care">Природа сферы: Тёплое участие и забота (не прокачка)</option>
              <option value="shield">Природа сферы: Принятие и защита границ</option>
              <option value="reduce">Природа сферы: Сокращение лишнего</option>
            </select>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
            <button type="button" class="btn-ghost" data-action="close-modal">Отмена</button>
            <button type="button" class="btn-primary" data-action="save-new-direction">Добавить землю на карту</button>
          </div>
        </div>
      </div>
    `;
  }

  if (m.type === 'red-config') {
    return `
      <div class="modal-backdrop" data-action="close-modal-backdrop">
        <div class="modal-sheet">
          <h3 class="font-display" style="margin:0 0 8px;">🔴 Настройка Красного режима (Мобилизация)</h3>
          <p style="font-size:12.5px; color:var(--text-muted); margin:0 0 12px;">
            Выбери одну ключевую сферу и цель рывка. Остальные регулярные дела встанут на честную паузу без долгов, а календарные встречи сохранятся.
          </p>
          <div style="display:grid; gap:9px;">
            <select id="redDirSelect" class="input-field">
              ${state.directions.map(d => `<option value="${escapeHtml(d.id)}" ${state.redConfig.directionId === d.id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}
            </select>
            <input id="redGoalInput" class="input-field" placeholder="Главная цель периода мобилизации" value="${escapeHtml(state.redConfig.goalTitle)}"/>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
            <button type="button" class="btn-ghost" data-action="close-modal">Отмена</button>
            <button type="button" class="btn-primary" data-action="save-red-config">Сохранить приоритет</button>
          </div>
        </div>
      </div>
    `;
  }

  if (m.type === 'rhythm-picker') {
    const active = state.items.filter(i => i.status === 'active');
    return `
      <div class="modal-backdrop" data-action="close-modal-backdrop">
        <div class="modal-sheet">
          <h3 class="font-display" style="margin:0 0 8px;">🌿 Настройка «Моего базового ритма»</h3>
          <p style="font-size:12.5px; color:var(--text-muted); margin:0 0 12px;">
            Отметь несколько спокойных опорных дел. Всё остальное будет честно заморожено без чувства вины.
          </p>
          <div style="display:flex; flex-direction:column; gap:7px;">
            ${active.map(it => `
              <button type="button" class="card-subtle" style="display:flex; justify-content:space-between; align-items:center; text-align:left;" data-action="toggle-basic-membership" data-item-id="${escapeHtml(it.id)}">
                <span>${escapeHtml(it.title)}</span>
                <span class="badge ${it.inBasicRhythm ? 'badge-oasis' : 'badge-muted'}">${it.inBasicRhythm ? '✓ В ритме' : 'Скрыто'}</span>
              </button>
            `).join('')}
          </div>
          <div style="display:flex; justify-content:flex-end; margin-top:14px;">
            <button type="button" class="btn-primary" data-action="close-modal">Готово</button>
          </div>
        </div>
      </div>
    `;
  }

  if (m.type === 'fast-complete') {
    return `
      <div class="modal-backdrop" data-action="close-modal-backdrop">
        <div class="modal-sheet">
          <h3 class="font-display" style="margin:0 0 8px;">⚡ Быстрое выполнение и повтор разовых дел</h3>
          <div style="display:flex; flex-direction:column; gap:7px; margin-top:10px;">
            ${state.items.map(it => {
              const eff = getItemEffortSummary(state, it.id);
              return `
                <div class="card-subtle" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                  <div>
                    <div style="font-weight:600;">${escapeHtml(it.title)}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${it.status === 'completed' ? 'Ранее завершённое разовое дело' : 'Активное дело'}</div>
                  </div>
                  ${it.status === 'completed' ? `
                    <button type="button" class="btn-ghost" data-action="repeat-completed-item" data-item-id="${escapeHtml(it.id)}">↻ Повторить сегодня</button>
                  ` : `
                    <button type="button" class="chip ${eff.todayDone ? 'active' : ''}" data-action="toggle-complete" data-item-id="${escapeHtml(it.id)}">${eff.todayDone ? '✓ Отмечено' : 'Отметить'}</button>
                  `}
                </div>
              `;
            }).join('')}
          </div>
          <div style="display:flex; justify-content:flex-end; margin-top:14px;">
            <button type="button" class="btn-ghost" data-action="close-modal">Закрыть</button>
          </div>
        </div>
      </div>
    `;
  }

  if (m.type === 'add-bonus') {
    return `
      <div class="modal-backdrop" data-action="close-modal-backdrop">
        <div class="modal-sheet">
          <h3 class="font-display" style="margin:0 0 10px;">🎁 Новый личный бонус в магазин</h3>
          <div style="display:grid; gap:9px;">
            <input id="newBonusTitle" class="input-field" placeholder="Название приятной награды"/>
            <input id="newBonusCost" type="number" min="5" max="1000" value="50" class="input-field" placeholder="Стоимость в монетах"/>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
            <button type="button" class="btn-ghost" data-action="close-modal">Отмена</button>
            <button type="button" class="btn-primary" data-action="save-new-bonus">Добавить</button>
          </div>
        </div>
      </div>
    `;
  }

  if (m.type === 'add-word') {
    return `
      <div class="modal-backdrop" data-action="close-modal-backdrop">
        <div class="modal-sheet">
          <h3 class="font-display" style="margin:0 0 10px;">🤝 Новое решение с «Ценой слова»</h3>
          <div style="display:grid; gap:9px;">
            <input id="newWordTitle" class="input-field" placeholder="Формулировка личного обещания"/>
            <input id="newWordDate" type="date" value="${escapeHtml(state.currentDate)}" class="input-field"/>
            <input id="newWordStake" type="number" min="5" max="500" value="25" class="input-field" placeholder="Добровольная ставка в монетах"/>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
            <button type="button" class="btn-ghost" data-action="close-modal">Отмена</button>
            <button type="button" class="btn-primary" data-action="save-new-word">Зафиксировать слово</button>
          </div>
        </div>
      </div>
    `;
  }

  if (m.type === 'import-json') {
    return `
      <div class="modal-backdrop" data-action="close-modal-backdrop">
        <div class="modal-sheet">
          <h3 class="font-display" style="margin:0 0 8px;">⬆ Восстановление из резервного JSON</h3>
          <textarea id="importJsonArea" class="input-field font-mono" rows="6" placeholder="Вставь содержимое ранее скачанного JSON-файла LifeGame 2.0..."></textarea>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
            <button type="button" class="btn-ghost" data-action="close-modal">Отмена</button>
            <button type="button" class="btn-primary" data-action="confirm-import-json">Проверить и восстановить</button>
          </div>
        </div>
      </div>
    `;
  }

  return '';
}

function bindBigMapPanHandlers() {
  const vp = document.getElementById('bigMapViewport');
  const cv = document.getElementById('bigMapCanvas');
  if (!vp || !cv) return;
  let dragging = false;
  let startX = 0, startY = 0, origX = 0, origY = 0;

  vp.onpointerdown = (e) => {
    if (e.target.closest('[data-action]')) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    origX = UI.mapPanX;
    origY = UI.mapPanY;
    try { vp.setPointerCapture(e.pointerId); } catch (err) {}
  };
  vp.onpointermove = (e) => {
    if (!dragging) return;
    UI.mapPanX = Math.max(-520, Math.min(180, origX + (e.clientX - startX)));
    UI.mapPanY = Math.max(-440, Math.min(140, origY + (e.clientY - startY)));
    cv.style.transform = `translate(${UI.mapPanX}px, ${UI.mapPanY}px) scale(${UI.mapScale})`;
  };
  vp.onpointerup = () => { dragging = false; };
  vp.onpointercancel = () => { dragging = false; };
}

function bindGlobalEvents() {
  document.addEventListener('input', (e) => {
    const t = e.target;
    const key = t.getAttribute('data-input');
    if (!key) return;
    if (key === 'quick-title') UI.quickAddForm.title = t.value;
    else if (key === 'quick-custom-date') UI.quickAddForm.dueDate = t.value;
    else if (key === 'quick-custom-time') UI.quickAddForm.dueTime = t.value;
    else if (key === 'quick-dir') UI.quickAddForm.directionId = t.value;
    else if (key === 'quick-loc') UI.quickAddForm.locationId = t.value;
    else if (key === 'evening-text') UI.eveningText = t.value;
    else if (key === 'ai-mode') { UI.aiOpts.mode = t.value; renderApp(); }
    else if (key === 'ai-format') { UI.aiOpts.format = t.value; renderApp(); }
    else if (key === 'ai-import-raw') UI.aiImportRaw = t.value;
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');

    if (action === 'close-modal-backdrop' && e.target !== btn) return;

    handleAction(action, btn);
  });
}

function handleAction(action, el) {
  switch (action) {
    case 'switch-tab':
      UI.tab = el.getAttribute('data-tab') || 'today';
      renderApp();
      break;

    case 'toggle-profile':
      UI.profile = UI.profile === 'demo' ? 'personal' : 'demo';
      UI.inlinePopoverItemId = null;
      loadActiveProfileState();
      persistState();
      showToast(UI.profile === 'demo' ? 'Открыт Демо-мир (10 направлений + Гитара)' : 'Открыта твоя чистая личная жизнь');
      renderApp();
      break;

    case 'step-demo-date': {
      const delta = Number(el.getAttribute('data-delta')) || 1;
      APP_STATE.currentDate = shiftDateISO(APP_STATE.currentDate, delta);
      persistState();
      showToast('Демо-дата сдвинута на ' + APP_STATE.currentDate + ' (без ложных штрафов)');
      renderApp();
      break;
    }

    case 'cycle-theme': {
      const order = ['night', 'dawn', 'pop', 'graphite'];
      const names = { night: 'Ночной квест', dawn: 'Тихий рассвет', pop: 'Стикеры', graphite: 'Графит' };
      const idx = (order.indexOf(APP_STATE.theme || 'night') + 1) % order.length;
      APP_STATE.theme = order[idx];
      persistState();
      showToast('Тема: ' + names[APP_STATE.theme]);
      renderApp();
      break;
    }

    case 'toggle-mute':
      SoundFX.muted = !SoundFX.muted;
      persistState();
      showToast(SoundFX.muted ? 'Звук выключен' : 'Мягкий звук включён');
      renderApp();
      break;

    case 'set-global-mode': {
      const nextMode = el.getAttribute('data-mode');
      if (nextMode === 'basic') {
        APP_STATE.basicFreezeActive = true;
      }
      APP_STATE.globalMode = nextMode;
      persistState();
      if (nextMode === 'red' && !APP_STATE.redConfig.goalTitle) {
        UI.modal = { type: 'red-config' };
      }
      renderApp();
      break;
    }

    case 'resume-full-strategy':
      APP_STATE.basicFreezeActive = false;
      persistState();
      showToast('Вся стратегия возобновлена честно и без долгов за период паузы');
      renderApp();
      break;

    case 'open-rhythm-picker':
      UI.modal = { type: 'rhythm-picker' };
      renderApp();
      break;

    case 'open-red-config':
      UI.modal = { type: 'red-config' };
      renderApp();
      break;

    case 'save-red-config': {
      const dirEl = document.getElementById('redDirSelect');
      const goalEl = document.getElementById('redGoalInput');
      if (dirEl) APP_STATE.redConfig.directionId = dirEl.value;
      if (goalEl) APP_STATE.redConfig.goalTitle = goalEl.value.trim() || 'Сфокусированный период';
      UI.modal = null;
      persistState();
      showToast('Приоритет Красного режима обновлён');
      renderApp();
      break;
    }

    case 'exit-red-mode':
      APP_STATE.globalMode = 'full';
      persistState();
      showToast('Мобилизация спокойно завершена — без просрочек и оценок');
      renderApp();
      break;

    case 'toggle-red-care': {
      const k = el.getAttribute('data-care');
      APP_STATE.redConfig.careChecks = APP_STATE.redConfig.careChecks || {};
      APP_STATE.redConfig.careChecks[k] = !APP_STATE.redConfig.careChecks[k];
      SoundFX.play('minutes');
      persistState();
      renderApp();
      break;
    }

    case 'set-tempo':
      APP_STATE.tempo = el.getAttribute('data-tempo') || 'normal';
      persistState();
      renderApp();
      break;

    case 'set-location':
      APP_STATE.locationId = el.getAttribute('data-loc') || 'any';
      persistState();
      renderApp();
      break;

    case 'toggle-quick-add':
      UI.quickAddOpen = !UI.quickAddOpen;
      renderApp();
      break;

    case 'open-quick-add-from-hub':
      UI.tab = 'today';
      UI.quickAddOpen = true;
      renderApp();
      break;

    case 'set-quick-kind':
      UI.quickAddForm.kind = el.getAttribute('data-kind') || 'task';
      renderApp();
      break;

    case 'set-quick-date-preset': {
      const p = el.getAttribute('data-preset');
      UI.quickAddForm.datePreset = p;
      if (p === 'none') { UI.quickAddForm.dueDate = ''; UI.quickAddForm.dueTime = ''; }
      else if (p === 'today') { UI.quickAddForm.dueDate = APP_STATE.currentDate; }
      else if (p === 'tomorrow') { UI.quickAddForm.dueDate = shiftDateISO(APP_STATE.currentDate, 1); }
      else if (p === 'custom' && !UI.quickAddForm.dueDate) { UI.quickAddForm.dueDate = APP_STATE.currentDate; }
      renderApp();
      break;
    }

    case 'submit-quick-add': {
      const title = (UI.quickAddForm.title || '').trim();
      if (!title) { showToast('Введи название дела или мысли'); return; }
      if (UI.quickAddForm.kind === 'inbox') {
        APP_STATE.inbox.unshift({ id: uid('inb'), text: title, createdAt: APP_STATE.currentDate, tag: 'Быстрый ввод' });
        showToast('Мысль сохранена во Входящие');
      } else {
        let resolvedDate = null;
        if (UI.quickAddForm.datePreset === 'today') resolvedDate = APP_STATE.currentDate;
        else if (UI.quickAddForm.datePreset === 'tomorrow') resolvedDate = shiftDateISO(APP_STATE.currentDate, 1);
        else if (UI.quickAddForm.datePreset === 'custom') resolvedDate = UI.quickAddForm.dueDate || APP_STATE.currentDate;

        APP_STATE.items.unshift({
          id: uid('act'),
          title,
          kind: UI.quickAddForm.kind,
          directionId: UI.quickAddForm.directionId || 'soul',
          locationId: UI.quickAddForm.locationId || 'any',
          inBasicRhythm: APP_STATE.globalMode === 'basic' || UI.quickAddForm.inBasicRhythm,
          inTodayConstructor: true,
          isKey: false,
          tempoMin: 'gentle',
          schedule: UI.quickAddForm.kind === 'habit' ? 'daily' : (resolvedDate ? 'dated' : 'once'),
          dailyNorm: 1,
          dueDate: resolvedDate,
          dueTime: UI.quickAddForm.dueTime || null,
          coins: 15,
          xp: 20,
          estMinutes: 15,
          status: 'active',
          cycle: 1
        });
        SoundFX.play('minutes');
        showToast(resolvedDate ? `Сохранено со сроком ${resolvedDate}` : 'Добавлено в план');
      }
      UI.quickAddForm.title = '';
      UI.quickAddOpen = false;
      persistState();
      renderApp();
      break;
    }

    case 'toggle-complete': {
      const itemId = el.getAttribute('data-item-id');
      const item = APP_STATE.items.find(i => i.id === itemId);
      if (!item) return;
      const existingIdx = APP_STATE.facts.findIndex(f => f.itemId === itemId && f.date === APP_STATE.currentDate);

      if (existingIdx >= 0) {
        // Undo check (Personal 1.2.0 rule: block undo if coins were already spent below zero)
        const fact = APP_STATE.facts[existingIdx];
        if (APP_STATE.wallet.coins < (fact.coins || 0)) {
          showToast('Нельзя отменить: монеты за это выполнение уже потрачены в магазине бонусов');
          return;
        }
        APP_STATE.wallet.coins -= (fact.coins || 0);
        APP_STATE.wallet.xp = Math.max(0, APP_STATE.wallet.xp - (fact.xp || 0));
        APP_STATE.facts.splice(existingIdx, 1);
        if (item.schedule === 'once' && item.kind === 'task') item.status = 'active';
        showToast('Отметка аккуратно отменена');
      } else {
        const c = Number(item.coins) || 10;
        const x = Number(item.xp) || 15;
        const locObj = APP_STATE.locations.find(l => l.id === APP_STATE.locationId);
        APP_STATE.facts.push({
          id: uid('fact'),
          itemId: item.id,
          date: APP_STATE.currentDate,
          coins: c,
          xp: x,
          locationName: locObj ? locObj.name : 'Везде',
          cycle: item.cycle || 1
        });
        APP_STATE.wallet.coins += c;
        APP_STATE.wallet.xp += x;
        if (item.schedule === 'once' && item.kind === 'task') {
          // Remains visible in history & fast-complete; marked completed after day or if repeated
        }
        SoundFX.play('complete');
        showToast(APP_STATE.globalMode === 'basic' ? 'Отмечено в ритме дня ✓' : `Выполнено! +${c} 🪙 и +${x} XP`);
      }
      persistState();
      renderApp();
      break;
    }

    case 'toggle-quest-step': {
      const itemId = el.getAttribute('data-item-id');
      const stepId = el.getAttribute('data-step-id');
      const item = APP_STATE.items.find(i => i.id === itemId);
      if (!item || !Array.isArray(item.questSteps)) return;
      const st = item.questSteps.find(s => s.id === stepId);
      if (!st) return;
      st.done = !st.done;
      SoundFX.play('minutes');
      persistState();
      renderApp();
      break;
    }

    case 'open-inline-popover': {
      const itemId = el.getAttribute('data-item-id');
      const mode = el.getAttribute('data-mode');
      if (UI.inlinePopoverItemId === itemId && UI.inlinePopoverMode === mode) {
        UI.inlinePopoverItemId = null;
      } else {
        UI.inlinePopoverItemId = itemId;
        UI.inlinePopoverMode = mode;
      }
      renderApp();
      break;
    }

    case 'close-inline-popover':
      UI.inlinePopoverItemId = null;
      renderApp();
      break;

    case 'add-quick-minutes': {
      const itemId = el.getAttribute('data-item-id');
      const mins = Number(el.getAttribute('data-mins')) || 5;
      APP_STATE.timeLogs.push({
        id: uid('tl'),
        itemId,
        date: APP_STATE.currentDate,
        minutes: mins,
        note: 'Ручная запись практики'
      });
      SoundFX.play('minutes');
      persistState();
      showToast(`Сохранено +${mins} мин практики (видно в 7-дневной ленте!)`);
      renderApp();
      break;
    }

    case 'reset-today-minutes': {
      const itemId = el.getAttribute('data-item-id');
      APP_STATE.timeLogs = APP_STATE.timeLogs.filter(t => !(t.itemId === itemId && t.date === APP_STATE.currentDate));
      persistState();
      showToast('Минуты за сегодня очищены');
      renderApp();
      break;
    }

    case 'quick-set-schedule': {
      const itemId = el.getAttribute('data-item-id');
      const sched = el.getAttribute('data-sched');
      const it = APP_STATE.items.find(x => x.id === itemId);
      if (!it) return;
      it.schedule = sched;
      it.kind = sched === 'once' ? 'task' : 'habit';
      it.cycle = (it.cycle || 1) + 1; // Preserves historical cycles per Personal 1.2.0 Rule #13!
      persistState();
      showToast('Повторяемость обновлена (прежние циклы и факты сохранены)');
      renderApp();
      break;
    }

    case 'quick-shift-date': {
      const itemId = el.getAttribute('data-item-id');
      const days = Number(el.getAttribute('data-days')) || 1;
      const it = APP_STATE.items.find(x => x.id === itemId);
      if (!it) return;
      const base = it.dueDate || APP_STATE.currentDate;
      it.dueDate = shiftDateISO(base, days);
      UI.inlinePopoverItemId = null;
      persistState();
      showToast('Перенесено на ' + it.dueDate);
      renderApp();
      break;
    }

    case 'toggle-basic-membership': {
      const itemId = el.getAttribute('data-item-id');
      const it = APP_STATE.items.find(x => x.id === itemId);
      if (!it) return;
      it.inBasicRhythm = !it.inBasicRhythm;
      persistState();
      renderApp();
      break;
    }

    case 'toggle-today-constructor': {
      const itemId = el.getAttribute('data-item-id');
      const it = APP_STATE.items.find(x => x.id === itemId);
      if (!it) return;
      it.inTodayConstructor = !it.inTodayConstructor;
      persistState();
      renderApp();
      break;
    }

    case 'toggle-key-star': {
      const itemId = el.getAttribute('data-item-id');
      const it = APP_STATE.items.find(x => x.id === itemId);
      if (!it) return;
      it.isKey = !it.isKey;
      if (it.isKey) it.inTodayConstructor = true;
      persistState();
      renderApp();
      break;
    }

    case 'repeat-completed-item': {
      const itemId = el.getAttribute('data-item-id');
      const it = APP_STATE.items.find(x => x.id === itemId);
      if (!it) return;
      it.status = 'active';
      it.inTodayConstructor = true;
      it.inBasicRhythm = true;
      it.cycle = (it.cycle || 1) + 1;
      UI.modal = null;
      UI.tab = 'today';
      persistState();
      showToast(`«${it.title}» возвращено на сегодня (цикл ${it.cycle})`);
      renderApp();
      break;
    }

    case 'start-focus-timer': {
      const itemId = el.getAttribute('data-item-id');
      const it = APP_STATE.items.find(x => x.id === itemId);
      const totalMinutes = (it && it.estMinutes) ? Number(it.estMinutes) : 15;
      if (UI.timerInterval) clearInterval(UI.timerInterval);
      UI.activeTimer = { itemId, secondsLeft: totalMinutes * 60, totalMinutes };
      UI.timerInterval = setInterval(() => {
        if (!UI.activeTimer) return;
        UI.activeTimer.secondsLeft = Math.max(0, UI.activeTimer.secondsLeft - 1);
        const dig = document.getElementById('liveTimerDigits');
        if (dig) {
          const m = Math.floor(UI.activeTimer.secondsLeft / 60);
          const s = String(UI.activeTimer.secondsLeft % 60).padStart(2, '0');
          dig.textContent = `${m}:${s}`;
        }
        if (UI.activeTimer.secondsLeft === 0) {
          clearInterval(UI.timerInterval);
          SoundFX.play('complete');
        }
      }, 1000);
      renderApp();
      break;
    }

    case 'commit-timer-minutes': {
      if (!UI.activeTimer) return;
      const mins = Number(el.getAttribute('data-mins')) || 5;
      APP_STATE.timeLogs.push({
        id: uid('tl'),
        itemId: UI.activeTimer.itemId,
        date: APP_STATE.currentDate,
        minutes: mins,
        note: 'Фокус-таймер'
      });
      if (UI.timerInterval) clearInterval(UI.timerInterval);
      UI.activeTimer = null;
      SoundFX.play('minutes');
      persistState();
      showToast(`Подтверждено и записано ${mins} мин.`);
      renderApp();
      break;
    }

    case 'cancel-timer':
      if (UI.timerInterval) clearInterval(UI.timerInterval);
      UI.activeTimer = null;
      renderApp();
      break;

    case 'spark-first-step':
      showToast('🚀 Первый шаг: сделай самую простую 2-минутную часть дела без обещания продолжать!');
      break;

    case 'spark-happiness': {
      const spark = HAPPINESS_SPARKS[Math.floor(Math.random() * HAPPINESS_SPARKS.length)];
      APP_STATE.happyMoments.unshift({ id: uid('hm'), date: APP_STATE.currentDate, text: spark });
      persistState();
      showToast('☀ Игра в счастье: ' + spark);
      break;
    }

    case 'open-evening-ritual':
      UI.tab = 'ai';
      UI.aiSubTab = 'evening';
      renderApp();
      break;

    case 'go-history':
      UI.tab = 'actions';
      UI.actionsSubTab = 'history';
      renderApp();
      break;

    case 'open-fast-complete':
      UI.modal = { type: 'fast-complete' };
      renderApp();
      break;

    // Strategy & Map actions
    case 'set-map-subtab':
      UI.mapSubTab = el.getAttribute('data-subtab') || 'big';
      renderApp();
      break;

    case 'select-map-dir':
    case 'select-path-dir':
      UI.selectedDirId = el.getAttribute('data-dir-id');
      renderApp();
      break;

    case 'radar-pick-dir':
      UI.selectedDirId = el.getAttribute('data-dir-id');
      UI.tab = 'strategy';
      UI.mapSubTab = 'path';
      renderApp();
      break;

    case 'open-dir-ascent':
      UI.selectedDirId = el.getAttribute('data-dir-id');
      UI.mapSubTab = 'path';
      renderApp();
      break;

    case 'map-zoom': {
      const d = Number(el.getAttribute('data-delta')) || 0;
      UI.mapScale = Math.max(0.55, Math.min(1.45, Number((UI.mapScale + d).toFixed(2))));
      renderApp();
      break;
    }

    case 'map-reset-view':
      UI.mapPanX = -180;
      UI.mapPanY = -120;
      UI.mapScale = 0.88;
      renderApp();
      break;

    case 'toggle-map-lens':
      APP_STATE.mapVisualStyle = APP_STATE.mapVisualStyle === 'lens' ? 'topo' : 'lens';
      persistState();
      renderApp();
      break;

    case 'toggle-map-links':
      APP_STATE.showMapLinks = !APP_STATE.showMapLinks;
      persistState();
      renderApp();
      break;

    case 'set-waypoint': {
      const dirId = el.getAttribute('data-dir-id');
      APP_STATE.waypointDirectionId = dirId;
      SoundFX.play('waypoint');
      persistState();
      showToast('🎯 Ориентир внимания отмечен на карте (без навязывания задач)');
      renderApp();
      break;
    }

    case 'toggle-radar-on-today':
      APP_STATE.showMiniRadarOnToday = !APP_STATE.showMiniRadarOnToday;
      persistState();
      renderApp();
      break;

    case 'set-mini-filter':
      UI.miniFilter = el.getAttribute('data-filter') || 'all';
      renderApp();
      break;

    case 'toggle-strict-stage':
      APP_STATE.strictStageMode = !APP_STATE.strictStageMode;
      persistState();
      showToast(APP_STATE.strictStageMode ? 'Включён фокус строго внутри текущего этапа' : 'Разрешены свободные действия вне этапов');
      renderApp();
      break;

    case 'toggle-oasis-status': {
      const dirId = el.getAttribute('data-dir-id');
      const d = APP_STATE.directions.find(x => x.id === dirId);
      if (!d) return;
      d.status = d.status === 'oasis' ? 'active' : 'oasis';
      d.horizonRing = d.status === 'oasis' ? 'oasis' : 'now';
      SoundFX.play('complete');
      persistState();
      renderApp();
      break;
    }

    case 'toggle-folded-stages': {
      const dirId = el.getAttribute('data-dir-id');
      UI.expandedFoldedDirs[dirId] = !UI.expandedFoldedDirs[dirId];
      renderApp();
      break;
    }

    case 'quick-add-to-stage': {
      const dirId = el.getAttribute('data-dir-id');
      UI.quickAddForm.directionId = dirId;
      UI.tab = 'today';
      UI.quickAddOpen = true;
      renderApp();
      break;
    }

    case 'open-edit-direction':
      UI.modal = { type: 'edit-direction', dirId: el.getAttribute('data-dir-id') };
      renderApp();
      break;

    case 'save-edit-direction': {
      const dirId = el.getAttribute('data-dir-id');
      const d = APP_STATE.directions.find(x => x.id === dirId);
      if (d) {
        d.fact = document.getElementById('modDirFact').value.trim() || d.fact;
        d.currentStage.title = document.getElementById('modDirCurrent').value.trim() || d.currentStage.title;
        d.currentStage.strategy = document.getElementById('modDirStrategy').value.trim() || d.currentStage.strategy;
        d.nextStage = document.getElementById('modDirNext').value.trim() || d.nextStage;
        d.optimal = document.getElementById('modDirOptimal').value.trim() || d.optimal;
        d.unknownGap = document.getElementById('modDirUnknown').value.trim() || d.unknownGap;
        d.lvmg = document.getElementById('modDirLvmg').value.trim() || d.lvmg;
        d.routeKnownToLvmg = !!document.getElementById('modDirRouteKnown').checked;
      }
      UI.modal = null;
      persistState();
      showToast('Горизонты направления обновлены');
      renderApp();
      break;
    }

    case 'open-add-direction':
      UI.modal = { type: 'add-direction' };
      renderApp();
      break;

    case 'save-new-direction': {
      const name = (document.getElementById('newDirName').value || '').trim();
      if (!name) { showToast('Укажи название направления'); return; }
      const colors = ['#38bdf8', '#f472b6', '#a3e635', '#fb923c', '#ffda29', '#c084fc'];
      const col = colors[APP_STATE.directions.length % colors.length];
      const newId = uid('dir');
      const angle = (APP_STATE.directions.length * 47) % 360 * (Math.PI / 180);
      const x = Math.round(460 + Math.cos(angle) * 230);
      const y = Math.round(480 + Math.sin(angle) * 190);
      APP_STATE.directions.push({
        id: newId,
        name,
        short: name.slice(0, 10),
        icon: 'sparkles',
        color: col,
        nature: document.getElementById('newDirNature').value || 'growth',
        terrain: 'Новая земля',
        x, y,
        beaconX: x, beaconY: Math.max(85, y - 250),
        status: 'active',
        horizonRing: 'now',
        fact: document.getElementById('newDirFact').value.trim() || 'Начальная точка опоры',
        currentStage: {
          title: document.getElementById('newDirCurr').value.trim() || 'Освоение первых шагов',
          strategy: 'Спокойный старт в удобном темпе.',
          goals: []
        },
        nextStage: 'Следующий устойчивый этап',
        foldedStages: [],
        optimal: document.getElementById('newDirOpt').value.trim() || 'Комфортный уровень достаточности',
        unknownGap: 'Дальнейший путь откроется по мере практики.',
        routeKnownToLvmg: false,
        lvmg: document.getElementById('newDirLvmg').value.trim() || 'Дальний маяк воображения',
        beyond: 'Открытый горизонт'
      });
      UI.selectedDirId = newId;
      UI.modal = null;
      persistState();
      showToast(`Сфера «${name}» добавлена на Карту жизни`);
      renderApp();
      break;
    }

    // Actions hub
    case 'set-actions-subtab':
      UI.actionsSubTab = el.getAttribute('data-subtab') || 'all';
      renderApp();
      break;

    case 'set-actions-dir-filter':
      UI.actionsDirFilter = el.getAttribute('data-dir') || 'all';
      renderApp();
      break;

    case 'add-inbox-thought': {
      const inp = document.getElementById('inboxNewInput');
      const txt = inp ? inp.value.trim() : '';
      if (!txt) return;
      APP_STATE.inbox.unshift({ id: uid('inb'), text: txt, createdAt: APP_STATE.currentDate, tag: 'Заметка' });
      persistState();
      showToast('Мысль добавлена во Входящие');
      renderApp();
      break;
    }

    case 'promote-inbox-to-task': {
      const id = el.getAttribute('data-inb-id');
      const idx = APP_STATE.inbox.findIndex(x => x.id === id);
      if (idx < 0) return;
      const inb = APP_STATE.inbox.splice(idx, 1)[0];
      APP_STATE.items.unshift({
        id: uid('act'),
        title: inb.text,
        kind: 'task',
        directionId: UI.selectedDirId || 'soul',
        locationId: 'any',
        inBasicRhythm: true,
        inTodayConstructor: true,
        isKey: false,
        tempoMin: 'normal',
        schedule: 'once',
        dailyNorm: 1,
        dueDate: null,
        dueTime: null,
        coins: 15,
        xp: 20,
        estMinutes: 15,
        status: 'active',
        cycle: 1
      });
      persistState();
      showToast('Мысль превращена в действие');
      renderApp();
      break;
    }

    case 'delete-inbox': {
      const id = el.getAttribute('data-inb-id');
      APP_STATE.inbox = APP_STATE.inbox.filter(x => x.id !== id);
      persistState();
      renderApp();
      break;
    }

    // Evening & AI Partner
    case 'set-ai-subtab':
      UI.aiSubTab = el.getAttribute('data-subtab') || 'evening';
      renderApp();
      break;

    case 'set-evening-mood':
      UI.eveningMood = el.getAttribute('data-mood') || 'calm';
      renderApp();
      break;

    case 'toggle-evening-private':
      UI.eveningPrivate = !UI.eveningPrivate;
      renderApp();
      break;

    case 'toggle-voice-dictation': {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        showToast('Голосовой ввод браузера недоступен в этом окружении — используй текстовое поле ниже');
        return;
      }
      if (UI.isRecordingVoice && UI._recog) {
        UI._recog.stop();
        UI.isRecordingVoice = false;
        renderApp();
        return;
      }
      try {
        const recog = new SR();
        recog.lang = 'ru-RU';
        recog.interimResults = false;
        UI._recog = recog;
        UI.isRecordingVoice = true;
        renderApp();
        recog.onresult = (ev) => {
          const transcript = Array.from(ev.results).map(r => r[0].transcript).join(' ');
          UI.eveningText = (UI.eveningText ? UI.eveningText + ' ' : '') + transcript;
          UI.isRecordingVoice = false;
          renderApp();
        };
        recog.onerror = () => {
          UI.isRecordingVoice = false;
          showToast('Не удалось распознать речь — напиши пару слов вручную');
          renderApp();
        };
        recog.onend = () => {
          UI.isRecordingVoice = false;
          renderApp();
        };
        recog.start();
      } catch (err) {
        UI.isRecordingVoice = false;
        showToast('Доступ к микрофону заблокирован браузером');
        renderApp();
      }
      break;
    }

    case 'save-evening-reflection': {
      const txt = (UI.eveningText || '').trim();
      if (!txt) { showToast('Напиши или надиктуй хотя бы одну фразу о сегодняшнем дне'); return; }
      const moodLabels = { energized: 'Наполненно', calm: 'Спокойно и тепло', tired: 'Приятная усталость', overloaded: 'Нужна бережность' };
      const reply = EVENING_MESSAGES[APP_STATE.reflections.length % EVENING_MESSAGES.length];
      APP_STATE.reflections.unshift({
        id: uid('ref'),
        date: APP_STATE.currentDate,
        mood: UI.eveningMood,
        moodLabel: moodLabels[UI.eveningMood] || 'Спокойно',
        text: txt,
        privateOnly: UI.eveningPrivate,
        reply
      });
      UI.eveningText = '';
      SoundFX.play('waypoint');
      persistState();
      showToast('Вечерняя рефлексия бережно сохранена');
      renderApp();
      break;
    }

    case 'toggle-ai-opt': {
      const opt = el.getAttribute('data-opt');
      UI.aiOpts[opt] = !UI.aiOpts[opt];
      renderApp();
      break;
    }

    case 'copy-ai-prompt': {
      const text = buildAiPromptPackage(APP_STATE, UI.aiOpts);
      copyTextSafe(text);
      showToast('Пакет запроса для внешней ИИ-модели скопирован!');
      break;
    }

    case 'fill-sample-ai-response':
      UI.aiImportRaw = JSON.stringify({
        proposals: [
          {
            type: 'add_item',
            title: 'Гитара: 5 минут игры закрытыми глазами для чувства ритма',
            directionId: APP_STATE.directions.some(d => d.id === 'guitar') ? 'guitar' : APP_STATE.directions[0].id,
            kind: 'habit',
            estMinutes: 5
          },
          {
            type: 'update_hypothesis',
            directionId: APP_STATE.directions.some(d => d.id === 'guitar') ? 'guitar' : APP_STATE.directions[0].id,
            unknownGap: 'Гипотеза: сначала сыграть 2 песни на камерном квартирнике для 15 человек, чтобы почувствовать живую сцену без стресса.'
          }
        ]
      }, null, 2);
      UI.aiProposals = parseAiProposalsInput(UI.aiImportRaw, APP_STATE);
      renderApp();
      break;

    case 'parse-ai-response':
      UI.aiProposals = parseAiProposalsInput(UI.aiImportRaw, APP_STATE);
      if (UI.aiProposals.length === 0) showToast('Вставь ответ или JSON с предложениями ИИ');
      renderApp();
      break;

    case 'toggle-ai-proposal': {
      const idx = Number(el.getAttribute('data-idx'));
      if (UI.aiProposals[idx]) UI.aiProposals[idx].accepted = !UI.aiProposals[idx].accepted;
      renderApp();
      break;
    }

    case 'apply-ai-proposals': {
      const chosen = UI.aiProposals.filter(p => p.accepted);
      if (chosen.length === 0) { showToast('Нет отмеченных предложений'); return; }
      createStrategySnapshot(APP_STATE, 'Автоснимок до применения ИИ', 'Защитная копия перед импортом рекомендаций ИИ');
      chosen.forEach(p => {
        if (p.type === 'update_hypothesis') {
          const dir = APP_STATE.directions.find(d => d.id === p.directionId);
          if (dir && p.unknownGap) dir.unknownGap = p.unknownGap;
        } else {
          APP_STATE.items.unshift({
            id: uid('act'),
            title: p.title,
            kind: p.kind || 'task',
            directionId: p.directionId || 'soul',
            locationId: 'any',
            inBasicRhythm: true,
            inTodayConstructor: true,
            isKey: false,
            tempoMin: 'gentle',
            schedule: p.kind === 'habit' ? 'daily' : 'once',
            dailyNorm: 1,
            dueDate: null,
            dueTime: null,
            coins: 12,
            xp: 15,
            estMinutes: p.estMinutes || 15,
            status: 'active',
            cycle: 1
          });
        }
      });
      UI.aiProposals = [];
      UI.aiImportRaw = '';
      SoundFX.play('complete');
      persistState();
      showToast(`Применено рекомендаций: ${chosen.length} (снимок стратегии сохранён!)`);
      renderApp();
      break;
    }

    // Rewards, Word Price, Snapshots & JSON
    case 'open-add-bonus':
      UI.modal = { type: 'add-bonus' };
      renderApp();
      break;

    case 'save-new-bonus': {
      const title = (document.getElementById('newBonusTitle').value || '').trim();
      const cost = Math.max(5, Number(document.getElementById('newBonusCost').value) || 40);
      if (!title) return;
      APP_STATE.bonuses.push({ id: uid('bon'), title, cost, repeatable: true, targetGoal: false });
      UI.modal = null;
      persistState();
      showToast('Бонус добавлен в магазин');
      renderApp();
      break;
    }

    case 'buy-bonus': {
      const bid = el.getAttribute('data-bonus-id');
      const b = APP_STATE.bonuses.find(x => x.id === bid);
      if (!b || APP_STATE.wallet.coins < b.cost) return;
      APP_STATE.wallet.coins -= b.cost;
      APP_STATE.ownedBonuses.unshift({
        id: uid('own'),
        bonusId: b.id,
        title: b.title,
        paidCost: b.cost,
        boughtDate: APP_STATE.currentDate,
        used: false,
        refunded: false
      });
      SoundFX.play('complete');
      persistState();
      showToast(`Куплен бонус «${b.title}»!`);
      renderApp();
      break;
    }

    case 'use-owned-bonus': {
      const oid = el.getAttribute('data-own-id');
      const ob = APP_STATE.ownedBonuses.find(x => x.id === oid);
      if (ob) ob.used = true;
      SoundFX.play('complete');
      persistState();
      showToast('Наслаждайся заслуженной наградой!');
      renderApp();
      break;
    }

    case 'refund-owned-bonus': {
      const oid = el.getAttribute('data-own-id');
      const ob = APP_STATE.ownedBonuses.find(x => x.id === oid);
      if (ob && !ob.used && !ob.refunded) {
        ob.refunded = true;
        APP_STATE.wallet.coins += ob.paidCost;
        persistState();
        showToast(`Возвращено +${ob.paidCost} 🪙`);
        renderApp();
      }
      break;
    }

    case 'open-add-word-commitment':
      UI.modal = { type: 'add-word' };
      renderApp();
      break;

    case 'save-new-word': {
      const title = (document.getElementById('newWordTitle').value || '').trim();
      const dueDate = document.getElementById('newWordDate').value || APP_STATE.currentDate;
      const stakeCoins = Math.max(5, Number(document.getElementById('newWordStake').value) || 25);
      if (!title) return;
      APP_STATE.wordCommitments.unshift({ id: uid('wc'), title, dueDate, stakeCoins, status: 'active' });
      UI.modal = null;
      persistState();
      showToast('Обязательство «Цена слова» зафиксировано');
      renderApp();
      break;
    }

    case 'resolve-word': {
      const wcId = el.getAttribute('data-wc-id');
      const outcome = el.getAttribute('data-outcome');
      const wc = APP_STATE.wordCommitments.find(x => x.id === wcId);
      if (!wc || wc.status !== 'active') return;
      if (outcome === 'kept') {
        wc.status = 'сдержано';
        APP_STATE.wallet.xp += 15;
        SoundFX.play('complete');
        showToast('Слово сдержано! +15 XP');
      } else {
        wc.status = 'честно закрыто';
        APP_STATE.wallet.coins = Math.max(0, APP_STATE.wallet.coins - wc.stakeCoins);
        showToast(`Списана добровольная ставка ${wc.stakeCoins} 🪙`);
      }
      persistState();
      renderApp();
      break;
    }

    case 'create-snapshot-now':
      createStrategySnapshot(APP_STATE, 'Ручной снимок от ' + APP_STATE.currentDate, 'Сохранён пользователем');
      persistState();
      showToast('Снимок стратегии сохранён');
      renderApp();
      break;

    case 'clean-slate-strategy':
      createStrategySnapshot(APP_STATE, 'Снимок перед чистым листом (' + APP_STATE.currentDate + ')', 'Автозащита перед очисткой активных планов');
      APP_STATE.items.forEach(it => { if (it.status === 'active') it.status = 'completed'; });
      APP_STATE.globalMode = 'basic';
      persistState();
      showToast('Чистый лист открыт! Все монеты, XP, уровень и история полностью сохранены.');
      renderApp();
      break;

    case 'restore-snapshot': {
      const sid = el.getAttribute('data-snap-id');
      const sn = APP_STATE.snapshots.find(x => x.id === sid);
      if (!sn || !sn.payload) return;
      APP_STATE.directions = JSON.parse(JSON.stringify(sn.payload.directions));
      APP_STATE.items = JSON.parse(JSON.stringify(sn.payload.items));
      APP_STATE.mapLinks = JSON.parse(JSON.stringify(sn.payload.mapLinks || []));
      persistState();
      showToast(`Стратегия «${sn.name}» восстановлена без потери опыта!`);
      renderApp();
      break;
    }

    case 'export-json': {
      const dataStr = JSON.stringify(APP_STATE, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lifegame-2.0-${UI.profile}-${APP_STATE.currentDate}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Резервный JSON скачан');
      break;
    }

    case 'open-import-json':
      UI.modal = { type: 'import-json' };
      renderApp();
      break;

    case 'confirm-import-json': {
      const raw = (document.getElementById('importJsonArea').value || '').trim();
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.directions) || !Array.isArray(parsed.items) || !parsed.wallet) {
          showToast('Отклонено: неверная структура JSON LifeGame');
          return;
        }
        createStrategySnapshot(APP_STATE, 'До импорта JSON', 'Страховочный снимок');
        APP_STATE = parsed;
        UI.modal = null;
        persistState();
        showToast('Данные проверены и успешно импортированы!');
        renderApp();
      } catch (err) {
        showToast('Ошибка чтения JSON — текущая жизнь не затронута');
      }
      break;
    }

    case 'close-modal':
    case 'close-modal-backdrop':
      UI.modal = null;
      renderApp();
      break;
  }
}

function copyTextSafe(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  ta.remove();
}

window.addEventListener('DOMContentLoaded', initApp);
