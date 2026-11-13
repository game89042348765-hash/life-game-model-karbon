// LifeGame Hybrid v1.0 — Главная (Лайт и Про по утверждённому каркасу v0.2), Мой ритм, Конструктор дня и Календарь

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderRoomHeader(title, subtitle) {
  return `
    <div class="room-bar">
      <button type="button" class="back-btn" data-act="go-home">← Главная</button>
      <span style="font-size:11.5px; color:var(--muted); font-weight:600;">${humanDateRu(S_DATA.currentDate)}</span>
    </div>
    <div>
      <h1 class="room-title">${esc(title)}</h1>
      ${subtitle ? `<div class="room-sub">${esc(subtitle)}</div>` : ''}
    </div>
  `;
}

function renderBalanceAndRewardCards(state) {
  const targetBonus = state.bonuses.find(b => b.id === state.targetBonusId) || state.bonuses[0] || null;
  const coins = state.wallet.coins;
  const todayEarned = state.facts
    .filter(f => f.date === state.currentDate)
    .reduce((sum, f) => sum + (Number(f.coins) || 0), 0);

  let rewardSub = 'Выбрать цель в магазине';
  let rewardLabel = 'Выбрать бонус';
  if (targetBonus) {
    rewardLabel = targetBonus.title.length > 18 ? targetBonus.title.slice(0, 17) + '…' : targetBonus.title;
    rewardSub = coins >= targetBonus.cost
      ? `Доступно! (${coins} / ${targetBonus.cost} ●)`
      : `Накоплено ${coins} из ${targetBonus.cost} ●`;
  }

  return `
    <div class="two-grid">
      <button type="button" class="stat-card" data-act="open-room" data-room="bonuses">
        <div class="stat-top">
          <span>МОНЕТЫ</span>
          <span style="color:var(--gold);">${HYB_ICONS.wallet}</span>
        </div>
        <div>
          <div class="stat-val">${coins}</div>
          <div class="stat-sub">${todayEarned > 0 ? `+${todayEarned} ● за сегодня` : 'Честный игровой баланс'}</div>
        </div>
      </button>

      <button type="button" class="stat-card" data-act="open-room" data-room="bonuses">
        <div class="stat-top">
          <span>МОЯ НАГРАДА</span>
          <span style="color:var(--gold);">✦</span>
        </div>
        <div>
          <div style="font-size:14px; font-weight:700; margin-top:8px; display:flex; justify-content:space-between; align-items:center; gap:4px;">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(rewardLabel)}</span>
            <span style="color:var(--gold);">›</span>
          </div>
          <div class="stat-sub">${esc(rewardSub)}</div>
        </div>
      </button>
    </div>
  `;
}

function renderHomeLiteScreen(state) {
  const lv = levelInfoFromXp(state.wallet.xp);
  const liteItems = getLiteRhythmItems(state);
  const doneLiteCount = liteItems.filter(it => get7DayEffort(state, it.id).todayDone).length;
  const todayMins = state.timeLogs
    .filter(t => t.date === state.currentDate)
    .reduce((s, t) => s + (Number(t.minutes) || 0), 0);
  const todayEvs = getCalendarOccurrencesOnDate(state, state.currentDate);

  const rhythmSub = liteItems.length === 0
    ? 'Выбери или добавь 1–3 спокойных шага дня'
    : `Сделано ${doneLiteCount} из ${liteItems.length}${todayMins > 0 ? ' · ' + todayMins + ' мин практики' : ''}`;

  const calSub = todayEvs.length > 0
    ? `Сегодня встреч: ${todayEvs.length} (${todayEvs[0].ev.title})`
    : 'Только важные встречи и точные даты';

  return `
    <div class="content-col">
      <div class="hero-card ${state.compactHero ? 'compact' : ''}" style="background-image: linear-gradient(180deg, rgba(11,11,12,0.08) 0%, rgba(11,11,12,0.58) 52%, rgba(11,11,12,0.92) 100%), url('${HERO_IMAGE_URI}');">
        <div class="hero-eyebrow">ЛАЙТ · ПРОСТОЙ КАЛЬКУЛЯТОР</div>
        <h1 class="hero-title">Больше жизни.<br>В каждом дне.</h1>
        <p class="hero-sub">Спокойный ритм и честные награды за шаги — без перегруза и долгов.</p>
      </div>

      ${state.showMotivation ? `
        <div class="motivation-line" data-act="open-sheet" data-sheet="edit-motivation" title="Нажми, чтобы изменить свою мотивацию">
          ${esc(state.motivationText || 'Ради чего ты действуешь? Напиши свою опору — или скрой строку в настройках.')}
        </div>
      ` : ''}

      <div class="level-block">
        <div class="level-top">
          <span class="level-label">УРОВЕНЬ ${lv.level}</span>
          <span class="level-caption">${lv.into} / ${lv.span} XP</span>
        </div>
        <div class="level-bar"><div class="level-fill" style="width:${lv.pct}%;"></div></div>
      </div>

      ${renderBalanceAndRewardCards(state)}

      <div class="section-head">
        <span class="section-eyebrow">СЕГОДНЯ — МОЙ РИТМ</span>
        <span class="section-date">${humanDateRu(state.currentDate)}</span>
      </div>

      <button type="button" class="entry-card gold" data-act="open-room" data-room="lite-rhythm">
        <div class="entry-icon-box">${HYB_ICONS.board}</div>
        <div class="entry-body">
          <div class="entry-title">Мой ритм сегодня</div>
          <div class="entry-sub">${esc(rhythmSub)}</div>
        </div>
        <span class="entry-arrow">›</span>
      </button>

      <button type="button" class="entry-card" data-act="open-room" data-room="bonuses" style="border-color:var(--border-gold);">
        <div class="entry-icon-box">${HYB_ICONS.spark}</div>
        <div class="entry-body">
          <div class="entry-title">Бонусы и вознаграждения</div>
          <div class="entry-sub">Магазин личных радостей и накопленные призы (${state.ownedBonuses.filter(b => !b.used && !b.refunded).length})</div>
        </div>
        <span class="entry-arrow">›</span>
      </button>

      <button type="button" class="entry-card" data-act="open-room" data-room="calendar">
        <div class="entry-icon-box">${HYB_ICONS.cal}</div>
        <div class="entry-body">
          <div class="entry-title">Календарь</div>
          <div class="entry-sub">${esc(calSub)}</div>
        </div>
        <span class="entry-arrow">›</span>
      </button>

      <div class="two-grid">
        <button type="button" class="tile-card" data-act="open-room" data-room="review">
          <div class="tile-top">
            <div class="tile-icon" style="color:#38bdf8;">${HYB_ICONS.moon}</div>
          </div>
          <div>
            <div class="tile-title">Тихий вечер</div>
            <div class="tile-hint">Короткий итог дня</div>
          </div>
        </button>

        <button type="button" class="tile-card" data-act="open-room" data-room="inbox">
          <div class="tile-top">
            <div class="tile-icon" style="color:var(--gold);">${HYB_ICONS.inbox}</div>
            ${state.inbox.length ? `<span style="font-size:11px; font-weight:700; color:var(--gold);">${state.inbox.length}</span>` : ''}
          </div>
          <div>
            <div class="tile-title">Входящие</div>
            <div class="tile-hint">Быстрые мысли</div>
          </div>
        </button>

        <button type="button" class="tile-card" data-act="open-room" data-room="treats">
          <div class="tile-top">
            <div class="tile-icon" style="color:#f59e0b;">${HYB_ICONS.cup}</div>
          </div>
          <div>
            <div class="tile-title">Ништяки</div>
            <div class="tile-hint">Бесплатные радости</div>
          </div>
        </button>

        <button type="button" class="tile-card" data-act="open-room" data-room="settings">
          <div class="tile-top">
            <div class="tile-icon" style="color:#94a3b8;">${HYB_ICONS.gear}</div>
          </div>
          <div>
            <div class="tile-title">Настройки</div>
            <div class="tile-hint">${APP_UI.space === 'demo' ? 'Пример · Сменить' : 'Моя жизнь · Темы'}</div>
          </div>
        </button>
      </div>
    </div>
  `;
}

function renderHomeProScreen(state) {
  const lv = levelInfoFromXp(state.wallet.xp);
  const proItems = getProConstructorItems(state);
  const doneProCount = proItems.filter(it => get7DayEffort(state, it.id).todayDone).length;
  const wpDir = state.directions.find(d => d.id === state.waypointDirId) || state.directions[0];
  const todayEvs = getCalendarOccurrencesOnDate(state, state.currentDate);
  const tempoNames = { gentle: 'Бережно', normal: 'Обычно', intense: 'Фигачу' };

  return `
    <div class="content-col">
      <div class="hero-card ${state.compactHero ? 'compact' : ''}" style="background-image: linear-gradient(180deg, rgba(11,11,12,0.08) 0%, rgba(11,11,12,0.58) 52%, rgba(11,11,12,0.92) 100%), url('${HERO_IMAGE_URI}');">
        <div class="hero-eyebrow">ТВОЯ ИГРА. ТВОЙ ПУТЬ.</div>
        <h1 class="hero-title">Больше жизни.<br>В каждом дне.</h1>
        <p class="hero-sub">Маленькие шаги к тому, что важно тебе.</p>
      </div>

      ${state.showMotivation ? `
        <div class="motivation-line" data-act="open-sheet" data-sheet="edit-motivation" title="Нажми, чтобы изменить свою мотивацию">
          ${esc(state.motivationText || 'Ради чего ты действуешь? Напиши свою мотивацию — или скрой этот текст в настройках.')}
        </div>
      ` : ''}

      <div class="level-block">
        <div class="level-top">
          <span class="level-label">УРОВЕНЬ ${lv.level}</span>
          <span class="level-caption">${lv.into} / ${lv.span} до следующего уровня</span>
        </div>
        <div class="level-bar"><div class="level-fill" style="width:${lv.pct}%;"></div></div>
      </div>

      ${renderBalanceAndRewardCards(state)}

      <div class="section-head">
        <span class="section-eyebrow">СЕГОДНЯ — ТВОЙ ДЕНЬ</span>
        <span class="section-date">${humanDateRu(state.currentDate)}</span>
      </div>

      <!-- 1. Primary Gold Day Constructor -->
      <button type="button" class="entry-card gold" data-act="open-room" data-room="day-constructor">
        <div class="entry-icon-box">${HYB_ICONS.board}</div>
        <div class="entry-body">
          <div class="entry-title">Конструктор дня</div>
          <div class="entry-sub">Сделано ${doneProCount} из ${proItems.length} · темп «${tempoNames[state.tempo] || 'Обычно'}»</div>
        </div>
        <span class="entry-arrow">›</span>
      </button>

      <!-- 2. Approved v0.2 rule #1: Life Map right underneath Day Constructor! -->
      <button type="button" class="entry-card" data-act="open-room" data-room="map" style="border-color:var(--border-gold); background:linear-gradient(135deg, var(--gold-soft), var(--bg-card) 68%);">
        <div class="entry-icon-box">${HYB_ICONS.mapTab}</div>
        <div class="entry-body">
          <div class="entry-title">Карта жизни</div>
          <div class="entry-sub">${state.directions.length} сфер · ориентир: ${esc(wpDir ? wpDir.short : 'Путь')} ↑</div>
        </div>
        <span class="entry-arrow">›</span>
      </button>

      <!-- 3. Calendar -->
      <button type="button" class="entry-card" data-act="open-room" data-room="calendar">
        <div class="entry-icon-box">${HYB_ICONS.cal}</div>
        <div class="entry-body">
          <div class="entry-title">Календарь</div>
          <div class="entry-sub">${todayEvs.length ? `Сегодня встреч: ${todayEvs.length}` : 'Планы, серии и Цена слова'}</div>
        </div>
        <span class="entry-arrow">›</span>
      </button>

      <!-- 4. Atmospheric LifeGame AI -->
      <button type="button" class="ai-entry-card" data-act="open-room" data-room="ai" style="background-image: linear-gradient(90deg, rgba(16,18,22,0.93) 0%, rgba(16,18,22,0.7) 56%, rgba(16,18,22,0.45) 100%), url('${AI_IMAGE_URI}');">
        <div class="entry-icon-box" style="color:#5eead4; border-color:rgba(94,234,212,0.3); background:rgba(15,23,42,0.65);">${HYB_ICONS.spark}</div>
        <div class="entry-body">
          <div class="entry-title">LifeGame AI</div>
          <div class="entry-sub" style="color:rgba(244,244,246,0.76);">Советник, контекст и двусторонний разбор</div>
        </div>
        <span class="entry-arrow">›</span>
      </button>

      <!-- 5. Calm 2x2 Tiles -->
      <div class="two-grid">
        <button type="button" class="tile-card" data-act="open-room" data-room="treats">
          <div class="tile-top"><div class="tile-icon" style="color:#f59e0b;">${HYB_ICONS.cup}</div></div>
          <div>
            <div class="tile-title">Ништяки</div>
            <div class="tile-hint">Простые радости</div>
          </div>
        </button>

        <button type="button" class="tile-card" data-act="open-room" data-room="widgets">
          <div class="tile-top"><div class="tile-icon" style="color:#a78bfa;">${HYB_ICONS.grid}</div></div>
          <div>
            <div class="tile-title">Мои виджеты</div>
            <div class="tile-hint">${APP_UI.timer ? '⏱ Таймер идёт' : 'Первый шаг · Счастье'}</div>
          </div>
        </button>

        <button type="button" class="tile-card" data-act="open-room" data-room="review">
          <div class="tile-top"><div class="tile-icon" style="color:#38bdf8;">${HYB_ICONS.moon}</div></div>
          <div>
            <div class="tile-title">Итоги дня</div>
            <div class="tile-hint">Вечер и сессии</div>
          </div>
        </button>

        <button type="button" class="tile-card" data-act="open-room" data-room="settings">
          <div class="tile-top"><div class="tile-icon" style="color:#94a3b8;">${HYB_ICONS.gear}</div></div>
          <div>
            <div class="tile-title">Настройки</div>
            <div class="tile-hint">Режимы · Темы · Данные</div>
          </div>
        </button>
      </div>
    </div>
  `;
}

function renderCalmTaskRow(state, it) {
  const dir = state.directions.find(d => d.id === it.directionId);
  const eff = get7DayEffort(state, it.id);
  const norm = getEffectiveNorm(it, state.currentDate);
  const isMultiNorm = it.kind === 'habit' && norm > 1;
  const circleCls = eff.todayDone ? 'done' : (eff.todaySteps > 0 ? 'partial-step' : '');
  const circleLabel = eff.todayDone ? '✓' : (isMultiNorm ? `${eff.todaySteps}/${norm}` : '');

  return `
    <div class="task-row">
      <button type="button" class="check-circle ${circleCls}" data-act="tap-item-check" data-id="${esc(it.id)}" title="${eff.todayDone ? 'Отменить выполнение' : (isMultiNorm ? 'Добавить +1 подход' : 'Отметить выполненным')}">
        ${circleLabel}
      </button>

      <div class="task-main">
        <div class="task-title ${eff.todayDone ? 'done' : ''}">
          ${it.isKey && state.calcMode === 'pro' ? '<span style="color:var(--gold); margin-right:4px;">★</span>' : ''}${esc(it.title)}
        </div>
        <div class="task-meta">
          ${dir ? `<span style="color:${esc(dir.color)}; font-weight:600;">${esc(dir.short)}</span>` : ''}
          <span>+${it.coins || 10} ●</span>
          ${isMultiNorm ? `<span>норма: ${eff.todaySteps}/${norm} сегодня</span>` : ''}
          ${it.dueDate ? `<span style="color:var(--amber);">📅 ${humanDateRu(it.dueDate)}</span>` : ''}
          ${eff.todayMins > 0 ? `<span style="color:var(--amber); font-weight:600;">записано ${eff.todayMins} мин</span>` : ''}
        </div>

        <!-- Quiet 7-day dots (Solves F-001 cleanly: green = done, amber = partial minutes!) -->
        <div class="quiet-week" title="Последние 7 дней: зелёный = выполнено, янтарный = сохранённые минуты практики">
          ${eff.days.map(d => `
            <span class="q-dot ${d.cls} ${d.isToday ? 'today' : ''}">
              ${d.wd}${d.done ? '✓' : (d.mins > 0 ? '·' + d.mins + 'м' : '')}
            </span>
          `).join('')}
        </div>
      </div>

      <div class="task-side">
        <button type="button" class="icon-btn" data-act="open-sheet" data-sheet="log-minutes" data-id="${esc(it.id)}" title="Записать минуты отдельно от галочки">⏱</button>
        <button type="button" class="icon-btn" data-act="open-sheet" data-sheet="item-menu" data-id="${esc(it.id)}" title="Перенести, повтор, норма">⋯</button>
      </div>
    </div>
  `;
}

function renderLiteRhythmRoom(state) {
  const items = getLiteRhythmItems(state);
  const todayEvs = getCalendarOccurrencesOnDate(state, state.currentDate);

  return `
    <div class="content-col">
      ${renderRoomHeader('Мой ритм сегодня', 'Спокойные опорные шаги дня · награды начисляются, остальная стратегия на паузе')}

      ${items.length === 0 ? `
        <div class="card-box" style="text-align:center; padding:26px 18px;">
          <div style="font-size:15.5px; font-weight:700;">Ритм пока свободен</div>
          <p style="font-size:13px; color:var(--muted); margin:6px 0 14px;">
            Добавь одно простое действие на каждый день или выбери готовые дела из своей копилки.
          </p>
        </div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${items.map(it => renderCalmTaskRow(state, it)).join('')}
        </div>
      `}

      ${todayEvs.length > 0 ? `
        <div class="section-head">
          <span class="section-eyebrow">ВСТРЕЧИ СЕГОДНЯ (${todayEvs.length})</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${todayEvs.map(occ => `
            <div class="task-row">
              <button type="button" class="check-circle ${occ.done ? 'done' : ''}" data-act="toggle-cal-done" data-id="${esc(occ.ev.id)}" data-occ="${esc(occ.occurrenceKey)}">${occ.done ? '✓' : ''}</button>
              <div class="task-main">
                <div class="task-title ${occ.done ? 'done' : ''}">${esc(occ.ev.title)}</div>
                <div class="task-meta">
                  <span>📅 ${occ.effectiveTime || 'Весь день'}</span>
                  <span>+${occ.ev.coins || 10} ●</span>
                </div>
              </div>
              <button type="button" class="icon-btn" data-act="open-sheet" data-sheet="move-cal" data-id="${esc(occ.ev.id)}" data-occ="${esc(occ.occurrenceKey)}">Перенести</button>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:4px;">
        <button type="button" class="btn-gold" style="flex:1;" data-act="open-sheet" data-sheet="quick-add">+ Добавить в ритм</button>
        <button type="button" class="btn-soft" data-act="open-sheet" data-sheet="configure-rhythm">Настроить набор</button>
      </div>
    </div>
  `;
}

function renderProDayConstructorRoom(state) {
  const allPlan = getProConstructorItems(state);
  const keyList = allPlan.filter(i => i.isKey && !get7DayEffort(state, i.id).todayDone);
  const regList = allPlan.filter(i => !i.isKey && !get7DayEffort(state, i.id).todayDone);
  const doneList = allPlan.filter(i => get7DayEffort(state, i.id).todayDone);
  const todayEvs = getCalendarOccurrencesOnDate(state, state.currentDate);

  const locs = getAllLocations(state);

  return `
    <div class="content-col">
      ${renderRoomHeader('Конструктор дня', 'Выбери темп по силам — пустые разделы скрываются сами')}

      ${state.liteFreezeActive ? `
        <div class="card-subtle" style="border-color:var(--border-gold); display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px;">
          <span style="font-size:12.5px;">🛡 <strong>Пауза Лайт-ритма сохранена:</strong> просмотр Про не создаёт пропусков.</span>
          <button type="button" class="pill active" data-act="resume-all-strategy">Возобновить всё</button>
        </div>
      ` : ''}

      <!-- Clean Tempo & Location pills -->
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
        <div class="pill-row">
          ${[['gentle','🌱 Бережно'],['normal','⚖ Обычно'],['intense','🔥 Фигачу']].map(([id, lbl]) => `
            <button type="button" class="pill ${state.tempo === id ? 'active' : ''}" data-act="set-tempo" data-val="${id}">${lbl}</button>
          `).join('')}
        </div>
        <select class="input-clean" style="width:auto; padding:6px 10px; font-size:12px;" data-change="set-location">
          ${locs.map(([id, lbl]) => `<option value="${id}" ${state.locationManual === id ? 'selected' : ''}>${lbl}</option>`).join('')}
        </select>
      </div>

      ${keyList.length > 0 ? `
        <div class="section-head"><span class="section-eyebrow">★ КЛЮЧЕВЫЕ ШАГИ (${keyList.length})</span></div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${keyList.map(it => renderCalmTaskRow(state, it)).join('')}
        </div>
      ` : ''}

      ${regList.length > 0 ? `
        <div class="section-head"><span class="section-eyebrow">ПЛАН НА СЕГОДНЯ (${regList.length})</span></div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${regList.map(it => renderCalmTaskRow(state, it)).join('')}
        </div>
      ` : ''}

      ${todayEvs.length > 0 ? `
        <div class="section-head"><span class="section-eyebrow">СОБЫТИЯ ДНЯ (${todayEvs.length})</span></div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${todayEvs.map(occ => `
            <div class="task-row">
              <button type="button" class="check-circle ${occ.done ? 'done' : ''}" data-act="toggle-cal-done" data-id="${esc(occ.ev.id)}" data-occ="${esc(occ.occurrenceKey)}">${occ.done ? '✓' : ''}</button>
              <div class="task-main">
                <div class="task-title ${occ.done ? 'done' : ''}">${esc(occ.ev.title)}</div>
                <div class="task-meta">
                  <span>📅 ${occ.effectiveTime || 'Весь день'}</span>
                  ${occ.isExceptionMove ? '<span style="color:var(--gold);">перенесено сюда</span>' : ''}
                </div>
              </div>
              <button type="button" class="icon-btn" data-act="open-sheet" data-sheet="move-cal" data-id="${esc(occ.ev.id)}" data-occ="${esc(occ.occurrenceKey)}">⋯</button>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${keyList.length === 0 && regList.length === 0 && todayEvs.length === 0 ? `
        <div class="card-box" style="text-align:center; padding:24px 16px;">
          <div style="font-weight:700;">Все запланированные шаги на сегодня закрыты ✨</div>
          <div style="font-size:12.5px; color:var(--muted); margin-top:4px;">Можно добавить новое дело или спокойно отдыхать.</div>
        </div>
      ` : ''}

      ${doneList.length > 0 ? `
        <details class="card-subtle" ${doneList.length <= 3 ? 'open' : ''}>
          <summary style="cursor:pointer; font-size:12px; font-weight:700; color:var(--good);">✓ ВЫПОЛНЕНО СЕГОДНЯ (${doneList.length})</summary>
          <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
            ${doneList.map(it => renderCalmTaskRow(state, it)).join('')}
          </div>
        </details>
      ` : ''}

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:4px;">
        <button type="button" class="btn-gold" style="flex:1;" data-act="open-sheet" data-sheet="quick-add">+ Новое дело</button>
        <button type="button" class="btn-soft" data-act="open-sheet" data-sheet="pick-day-plan">Собрать из базы</button>
      </div>
    </div>
  `;
}

function renderCalendarRoom(state) {
  const isLite = state.calcMode === 'lite';
  const tabs = isLite
    ? [['upcoming', 'Ближайшие даты'], ['month', 'Сетка месяца']]
    : [['upcoming', 'Ближайшие даты'], ['month', 'Сетка месяца'], ['word', 'Цена слова'], ['misses', 'Невыполненные']];

  const sub = APP_UI.calSub || 'upcoming';
  let body = '';

  if (sub === 'upcoming') {
    const daysAhead = [];
    for (let d = 0; d < 10; d++) {
      const iso = addDaysISO(state.currentDate, d);
      const occs = getCalendarOccurrencesOnDate(state, iso);
      const dueTasks = state.items.filter(it => it.status === 'active' && it.dueDate === iso);
      if (occs.length || dueTasks.length || d === 0) {
        daysAhead.push({ iso, occs, dueTasks, isToday: d === 0 });
      }
    }

    body = `
      <div style="display:flex; justify-content:flex-end;">
        <button type="button" class="btn-gold" data-act="open-sheet" data-sheet="add-cal">+ Добавить встречу / дату</button>
      </div>
      ${daysAhead.map(day => `
        <div class="card-box" style="display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; color:${day.isToday ? 'var(--gold)' : 'var(--muted)'};">
            <span>${day.isToday ? 'СЕГОДНЯ · ' : ''}${humanDateFullRu(day.iso)}</span>
          </div>
          ${day.occs.length === 0 && day.dueTasks.length === 0 ? `<div style="font-size:12.5px; color:var(--dim);">Свободный от жёстких встреч день</div>` : ''}
          ${day.occs.map(occ => `
            <div class="card-subtle" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <div>
                <div style="font-weight:650; ${occ.done ? 'text-decoration:line-through; opacity:0.6;' : ''}">
                  ${occ.effectiveTime ? `<span style="color:var(--gold); margin-right:5px;">${esc(occ.effectiveTime)}</span>` : ''}${esc(occ.ev.title)}
                </div>
                <div style="font-size:11px; color:var(--muted);">
                  Повтор: ${{none:'разово',daily:'ежедневно',weekly:'еженедельно',monthly:'ежемесячно',yearly:'ежегодно'}[occ.ev.repeat] || 'разово'}
                </div>
              </div>
              <div style="display:flex; gap:5px;">
                <button type="button" class="icon-btn" data-act="toggle-cal-done" data-id="${esc(occ.ev.id)}" data-occ="${esc(occ.occurrenceKey)}">${occ.done ? '↩' : '✓'}</button>
                <button type="button" class="icon-btn" data-act="open-sheet" data-sheet="move-cal" data-id="${esc(occ.ev.id)}" data-occ="${esc(occ.occurrenceKey)}">Перенести</button>
              </div>
            </div>
          `).join('')}
          ${day.dueTasks.map(tk => `
            <div class="card-subtle" style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:13px;">📝 Срок дела: <strong>${esc(tk.title)}</strong></span>
              <span style="font-size:11px; color:var(--amber);">до конца дня</span>
            </div>
          `).join('')}
        </div>
      `).join('')}
    `;
  } else if (sub === 'month') {
    const [cy, cm] = state.currentDate.split('-').map(Number);
    const totalDays = daysInMonthUTC(cy, cm);
    const firstIso = `${cy}-${String(cm).padStart(2, '0')}-01`;
    const startOffset = (weekdayUTC(firstIso) + 6) % 7; // Mon=0..Sun=6
    const cells = [];
    for (let k = 0; k < startOffset; k++) cells.push('<div class="cal-cell" style="opacity:0.2;"></div>');
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const iso = `${cy}-${String(cm).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const hasEv = getCalendarOccurrencesOnDate(state, iso).length > 0 || state.items.some(i => i.dueDate === iso && i.status === 'active');
      cells.push(`<div class="cal-cell ${iso === state.currentDate ? 'today' : ''} ${hasEv ? 'has-ev' : ''}">${dayNum}</div>`);
    }
    body = `
      <div class="card-box">
        <div style="font-weight:700; margin-bottom:10px; text-align:center;">${humanDateRu(firstIso).split(' ')[1].toUpperCase()} ${cy}</div>
        <div class="cal-grid" style="margin-bottom:6px; font-size:10.5px; color:var(--muted);">
          <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>
        </div>
        <div class="cal-grid">${cells.join('')}</div>
      </div>
    `;
  } else if (sub === 'word') {
    body = `
      <div class="card-box">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:10px;">
          <div>
            <strong>Принятые решения («Цена слова»)</strong>
            <div style="font-size:12px; color:var(--muted);">Добровольное слово без автоматических ночных штрафов.</div>
          </div>
          <button type="button" class="btn-gold" style="padding:8px 12px;" data-act="open-sheet" data-sheet="add-word">+ Слово</button>
        </div>
        ${state.wordCommitments.length === 0 ? `<div style="font-size:12.5px; color:var(--muted);">Пока нет активных ставок слова.</div>` : `
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${state.wordCommitments.map(w => `
              <div class="card-subtle" style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px;">
                <div>
                  <div style="font-weight:650;">${esc(w.title)}</div>
                  <div style="font-size:11.5px; color:var(--muted);">Срок: ${esc(w.dueDate)} · Ставка: ${w.stake} ● · ${esc(w.status)}</div>
                </div>
                ${w.status === 'active' ? `
                  <div style="display:flex; gap:6px;">
                    <button type="button" class="pill active" data-act="resolve-word" data-id="${esc(w.id)}" data-res="kept">Сдержал (+20 XP)</button>
                    <button type="button" class="pill" data-act="resolve-word" data-id="${esc(w.id)}" data-res="missed">Не вышло (−${w.stake} ●)</button>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  } else {
    body = `
      <div class="card-box">
        <strong>Прошлые невыполненные встречи (${state.misses.length})</strong>
        <div style="font-size:12px; color:var(--muted); margin-top:3px;">Каждую запись можно закрыть позже, перенести или спокойно отправить в архив.</div>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
          ${state.misses.length === 0 ? `<div style="font-size:12.5px; color:var(--dim);">Неразобранных пропусков нет.</div>` : state.misses.map(ms => `
            <div class="card-subtle" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <div>
                <div style="font-weight:600;">${esc(ms.title)}</div>
                <div style="font-size:11px; color:var(--muted);">Дата: ${esc(ms.date)}</div>
              </div>
              <div style="display:flex; gap:5px;">
                <button type="button" class="pill active" data-act="settle-miss" data-id="${esc(ms.id)}" data-how="done">Закрыть сейчас</button>
                <button type="button" class="pill" data-act="settle-miss" data-id="${esc(ms.id)}" data-how="archive">В архив</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  return `
    <div class="content-col">
      ${renderRoomHeader('Календарь', isLite ? 'Встречи и точные даты' : 'Повторяющиеся серии, перенос появлений и Цена слова')}
      <div class="pill-row">
        ${tabs.map(([id, lbl]) => `
          <button type="button" class="pill ${sub === id ? 'active' : ''}" data-act="set-cal-sub" data-val="${id}">${lbl}</button>
        `).join('')}
      </div>
      ${body}
    </div>
  `;
}
