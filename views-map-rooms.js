// LifeGame Hybrid v1.0 — Карта жизни (Большая карта, Мини-радар, Восхождение ↑), Бонусы, Квесты, Вечер/ИИ, Виджеты, Настройки и Шторки

function renderMapRoom(state) {
  const sub = APP_UI.mapSub || 'big';
  const selDir = state.directions.find(d => d.id === APP_UI.selectedDirId) || state.directions[0];
  if (selDir) APP_UI.selectedDirId = selDir.id;

  let content = '';

  if (sub === 'big') {
    let svgLines = '';
    if (state.mapLinksVisible) {
      (state.mapLinks || []).forEach(([aId, bId]) => {
        const a = state.directions.find(x => x.id === aId);
        const b = state.directions.find(x => x.id === bId);
        if (a && b) {
          svgLines += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(255,255,255,0.14)" stroke-width="1.5" stroke-dasharray="4 5"/>`;
        }
      });
    }
    state.directions.forEach(d => {
      const bx = d.beaconX || d.x;
      const by = d.beaconY || Math.max(75, d.y - 220);
      const mx = (d.x + bx) / 2;
      const my = (d.y + by) / 2;
      svgLines += `<line x1="${d.x}" y1="${d.y}" x2="${mx}" y2="${my}" stroke="${esc(d.color)}" stroke-opacity="0.4" stroke-width="2"/>`;
      if (d.routeKnownToLvmg) {
        svgLines += `<line x1="${mx}" y1="${my}" x2="${bx}" y2="${by}" stroke="${esc(d.color)}" stroke-opacity="0.3" stroke-width="1.6" stroke-dasharray="6 4"/>`;
      } else {
        svgLines += `<circle cx="${mx}" cy="${my}" r="3.5" fill="#141416" stroke="${esc(d.color)}" stroke-width="1.4"/>`;
        svgLines += `<line x1="${mx}" y1="${my}" x2="${bx}" y2="${by}" stroke="rgba(244,206,74,0.22)" stroke-width="1.2" stroke-dasharray="2 10"/>`;
      }
    });

    const nodesHtml = state.directions.map(d => {
      const isSel = selDir && d.id === selDir.id;
      const isWp = state.waypointDirId === d.id;
      const bx = d.beaconX || d.x;
      const by = d.beaconY || Math.max(75, d.y - 220);
      const farCls = (d.horizonRing === 'fog' || d.status === 'paused') ? 'far-item' : '';
      return `
        <div class="map-beacon far-item" style="left:${bx}px; top:${by}px;" data-act="pick-map-dir" data-id="${esc(d.id)}">
          ✦ LVMG · ${esc(d.short)}
        </div>
        <div class="map-node ${farCls}" style="left:${d.x}px; top:${d.y}px;" data-act="pick-map-dir" data-id="${esc(d.id)}">
          <div class="map-orb" style="border-color:${esc(d.color)}; box-shadow:0 0 ${isSel ? '24px' : '10px'} ${esc(d.color)}44;">
            <span style="color:${esc(d.color)}; font-weight:800; font-size:15px;">${esc(d.short.slice(0, 2))}</span>
            ${isWp ? '<span style="position:absolute; top:-7px; right:-7px; background:var(--gold); color:#141106; border-radius:99px; font-size:9px; padding:1px 5px; font-weight:800;">🎯</span>' : ''}
          </div>
          <span style="background:rgba(11,11,12,0.88); border:1px solid rgba(255,255,255,0.12); border-radius:99px; padding:2px 8px; font-size:11px; font-weight:650; color:#f4f4f6; white-space:nowrap;">
            ${esc(d.short)} ${d.status === 'oasis' ? '🌿' : ''}
          </span>
        </div>
      `;
    }).join('');

    content = `
      <div style="display:flex; justify-content:space-between; gap:6px; flex-wrap:wrap;">
        <div style="display:flex; gap:5px;">
          <button type="button" class="icon-btn" data-act="map-zoom" data-d="0.14">＋</button>
          <button type="button" class="icon-btn" data-act="map-zoom" data-d="-0.14">－</button>
          <button type="button" class="icon-btn" data-act="map-center">Центр</button>
        </div>
        <div style="display:flex; gap:5px;">
          <button type="button" class="icon-btn" data-act="toggle-map-drag">${APP_UI.dragNodes ? '✋ Готово' : '✋ Двигать'}</button>
          <button type="button" class="icon-btn" data-act="toggle-map-lens">${state.mapLens ? '🔭 Линза вкл' : '🔭 Линза'}</button>
          <button type="button" class="icon-btn" data-act="open-sheet" data-sheet="add-dir">+ Сфера</button>
        </div>
      </div>

      <div id="hybridMapViewport" class="map-viewport ${state.mapLens ? 'lens' : ''}">
        <div id="hybridMapCanvas" class="map-canvas" style="transform:translate(${APP_UI.panX}px, ${APP_UI.panY}px) scale(${APP_UI.zoom});">
          <div style="position:absolute; top:12px; left:0; right:0; text-align:center; font-size:10px; letter-spacing:0.18em; color:rgba(253,230,138,0.42);">
            ↑ ОТКРЫТЫЙ ГОРИЗОНТ ЗА LVMG ↑
          </div>
          <svg width="860" height="820" viewBox="0 0 860 820" style="position:absolute; inset:0; pointer-events:none;">${svgLines}</svg>
          ${nodesHtml}
        </div>
      </div>

      ${selDir ? `
        <div class="card-box" style="border-color:${esc(selDir.color)}55;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <strong style="font-size:16px;">${esc(selDir.name)}</strong>
            <button type="button" class="icon-btn" data-act="set-waypoint" data-id="${esc(selDir.id)}">
              ${state.waypointDirId === selDir.id ? '🎯 Ориентир' : 'Сделать ориентиром'}
            </button>
          </div>
          <div style="font-size:12.5px; color:var(--muted); margin-top:6px;"><strong>Факт:</strong> ${esc(selDir.fact)}</div>
          <div style="font-size:12.5px; margin-top:4px;"><strong>Сейчас:</strong> ${esc(selDir.currentStage.title)}</div>
          <div style="display:flex; gap:8px; margin-top:12px;">
            <button type="button" class="btn-gold" style="flex:1; padding:9px 12px;" data-act="set-map-sub" data-val="path">Открыть путь восхождения ↑</button>
            <button type="button" class="btn-soft" style="padding:9px 12px;" data-act="open-sheet" data-sheet="edit-dir" data-id="${esc(selDir.id)}">✎</button>
          </div>
        </div>
      ` : ''}
    `;
  } else if (sub === 'mini') {
    const sz = 260, cx = 130, cy = 130;
    const rings = [46, 82, 114];
    const rMap = { now: 46, next: 82, oasis: 88, fog: 114 };
    const pts = state.directions.map((d, idx) => {
      const ang = ((idx / Math.max(1, state.directions.length)) * 360 - 90) * (Math.PI / 180);
      const r = rMap[d.horizonRing] || 46;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      return `
        <g data-act="open-dir-path" data-id="${esc(d.id)}" style="cursor:pointer;">
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="${esc(d.color)}" stroke="#0b0b0c" stroke-width="2"/>
          <text x="${x.toFixed(1)}" y="${(y + 18).toFixed(1)}" text-anchor="middle" fill="currentColor" font-size="9.5" font-weight="600">${esc(d.short)}</text>
        </g>
      `;
    }).join('');

    content = `
      <div class="card-box" style="text-align:center;">
        <div style="font-size:11px; letter-spacing:0.12em; color:var(--gold); font-weight:700;">МИНИ-РАДАР · ГДЕ Я СЕЙЧАС ЗА 10 СЕКУНД</div>
        <svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" style="max-width:100%; height:auto; margin-top:6px; overflow:visible;">
          ${rings.map((r, i) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-opacity="${i === 0 ? '0.22' : '0.1'}" stroke-dasharray="${i === 2 ? '4 4' : 'none'}"/>`).join('')}
          <circle cx="${cx}" cy="${cy}" r="3.5" fill="var(--gold)"/>
          ${pts}
        </svg>
        <div style="font-size:12px; color:var(--muted);">Нажми на любую точку, чтобы перейти к траектории сферы.</div>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px;">
        ${state.directions.map(d => `
          <button type="button" class="card-box" style="text-align:left; padding:12px 14px; border-left:3px solid ${esc(d.color)};" data-act="open-dir-path" data-id="${esc(d.id)}">
            <div style="display:flex; justify-content:space-between; font-weight:700;">
              <span>${esc(d.name)}</span>
              <span style="color:var(--gold);">↑</span>
            </div>
            <div style="font-size:12px; color:var(--muted); margin-top:3px;">${esc(d.currentStage.title)}</div>
          </button>
        `).join('')}
      </div>
    `;
  } else if (selDir) {
    // Bottom-to-Top Ascent Path ↑
    const dirTasks = state.items.filter(i => i.directionId === selDir.id && i.status === 'active');
    const natureTag = selDir.nature === 'shield' ? '🛡 Защита и опора' : (selDir.nature === 'reduce' ? '✂ Сокращение лишнего' : (selDir.nature === 'care' ? '🤍 Тёплое участие' : '✨ Развитие'));

    content = `
      <div class="pill-row">
        ${state.directions.map(d => `
          <button type="button" class="pill ${d.id === selDir.id ? 'active' : ''}" data-act="pick-map-dir" data-id="${esc(d.id)}">${esc(d.short)}</button>
        `).join('')}
      </div>

      <div class="card-box" style="display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span style="font-size:11px; color:var(--gold); font-weight:700;">${natureTag}</span>
            <h2 style="margin:2px 0 0; font-size:18px;">${esc(selDir.name)}</h2>
          </div>
          <button type="button" class="btn-soft" style="padding:7px 11px; font-size:12px;" data-act="open-sheet" data-sheet="edit-dir" data-id="${esc(selDir.id)}">✎ Этапы</button>
        </div>

        <!-- 7. TOP: Open Sky beyond LVMG -->
        <div class="card-subtle" style="text-align:center; border-style:dashed;">
          <div style="font-size:10px; letter-spacing:0.14em; color:var(--gold);">7 · ОТКРЫТЫЙ ГОРИЗОНТ ЗА LVMG ↑</div>
          <div style="font-size:12px; color:var(--muted); margin-top:2px;">${esc(selDir.beyond)}</div>
        </div>
        <div class="ascent-line broken"></div>

        <!-- 6. LVMG Beacon -->
        <div class="card-subtle" style="border:1px dashed var(--border-gold);">
          <div style="font-size:10.5px; color:var(--gold); font-weight:700;">6 · МАЯК LVMG (${selDir.routeKnownToLvmg ? 'маршрут понятен' : 'точка видна, дороги пока нет'})</div>
          <div style="font-weight:700; margin-top:4px;">✦ ${esc(selDir.lvmg)}</div>
        </div>
        <div class="ascent-line broken"></div>

        <!-- 5. Unknown Gap -->
        <div class="card-subtle" style="border-style:dashed;">
          <div style="font-size:10.5px; color:var(--muted); font-weight:700;">5 · НЕИЗВЕСТНОЕ / ГИПОТЕЗА МАРШРУТА</div>
          <div style="font-size:12.5px; color:var(--muted); margin-top:3px;">${esc(selDir.unknownGap)}</div>
        </div>
        <div class="ascent-line"></div>

        <!-- 4. Optimal Oasis -->
        <div class="card-subtle" style="border-color:rgba(74,222,128,0.45); background:var(--good-soft);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:10.5px; color:var(--good); font-weight:700;">4 · ОАЗИС ОПТИМУМА (ДОСТАТОЧНО ХОРОШО) 🌿</span>
            <button type="button" class="icon-btn" data-act="toggle-oasis" data-id="${esc(selDir.id)}">${selDir.status === 'oasis' ? '✓ В оазисе' : 'Отметить'}</button>
          </div>
          <div style="font-weight:700; margin-top:4px;">${esc(selDir.optimal)}</div>
        </div>
        <div class="ascent-line"></div>

        <!-- 3. Next Stage -->
        <div class="card-subtle">
          <div style="font-size:10.5px; color:var(--muted); font-weight:700;">3 · СЛЕДУЮЩИЙ ЭТАП</div>
          <div style="font-weight:600; margin-top:3px;">${esc(selDir.nextStage)}</div>
        </div>
        <div class="ascent-line"></div>

        <!-- 2. Current Working Stage -->
        <div class="card-box" style="border:2px solid var(--gold);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <span style="font-size:10.5px; color:var(--gold); font-weight:800;">2 · СЕЙЧАС В РАБОТЕ (ТЕКУЩИЙ ЭТАП)</span>
            <div style="display:flex; gap:5px;">
              <button type="button" class="icon-btn" style="color:var(--gold); border-color:var(--border-gold);" data-act="open-sheet" data-sheet="promote-stage" data-id="${esc(selDir.id)}">🏆 Этап пройден</button>
              <button type="button" class="pill active" data-act="open-add-for-dir" data-id="${esc(selDir.id)}">+ Шаг</button>
            </div>
          </div>
          <div style="font-size:15.5px; font-weight:750; margin-top:5px;">${esc(selDir.currentStage.title)}</div>
          <div style="font-size:12.5px; color:var(--muted); margin-top:3px;">${esc(selDir.currentStage.strategy)}</div>
          ${dirTasks.length ? `
            <div style="margin-top:8px; padding-top:8px; border-top:1px solid var(--border-card); display:flex; flex-direction:column; gap:5px;">
              ${dirTasks.map(t => `<div style="font-size:12.5px;">• ${esc(t.title)}</div>`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="ascent-line"></div>

        <!-- 1. Base Fact & Achievements -->
        <div class="card-subtle" style="border:1.5px solid var(--border-strong);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:10.5px; color:var(--muted); font-weight:800;">1 · ФАКТ И МОИ ДОСТИЖЕНИЯ ВНИЗУ 🪨</div>
            <button type="button" class="icon-btn" data-act="open-sheet" data-sheet="add-ach" data-id="${esc(selDir.id)}">+ Достижение</button>
          </div>
          <div style="font-weight:650; margin-top:4px;">${esc(selDir.fact)}</div>
          ${(selDir.achievements && selDir.achievements.length) ? `
            <div style="margin-top:8px; padding-top:7px; border-top:1px solid var(--border-card); display:flex; flex-direction:column; gap:4px;">
              ${selDir.achievements.map(a => `<div style="font-size:12px; color:var(--good);">🏆 ${esc(a.title)} <span style="color:var(--muted);">(${esc(a.date)})</span></div>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  return `
    <div class="content-col">
      ${renderRoomHeader('Карта жизни', 'Смотреть далеко — действовать спокойно в настоящем')}
      <div class="pill-row">
        <button type="button" class="pill ${sub === 'big' ? 'active' : ''}" data-act="set-map-sub" data-val="big">Большая карта</button>
        <button type="button" class="pill ${sub === 'mini' ? 'active' : ''}" data-act="set-map-sub" data-val="mini">Мини-радар</button>
        <button type="button" class="pill ${sub === 'path' ? 'active' : ''}" data-act="set-map-sub" data-val="path">Путь восхождения ↑</button>
      </div>
      ${content}
    </div>
  `;
}

function renderQuestsAndItemsRoom(state) {
  const sub = APP_UI.questsSub || 'quests';
  const qFilter = (APP_UI.searchQuery || '').trim().toLowerCase();
  const matchQ = (txt) => !qFilter || String(txt || '').toLowerCase().includes(qFilter);
  const archivedItems = state.items.filter(i => i.status === 'archived');
  const tabs = [
    ['quests', `Квесты (${state.quests.length})`],
    ['habits', 'Привычки (1–50)'],
    ['tasks', 'Задания'],
    ['inbox', `Входящие (${state.inbox.length})`],
    ['history', 'История'],
    ...(archivedItems.length ? [['archived', `Архив (${archivedItems.length})`]] : [])
  ];

  let body = '';
  if (sub === 'quests') {
    body = `
      <div style="display:flex; justify-content:flex-end;">
        <button type="button" class="btn-gold" data-act="open-sheet" data-sheet="add-quest">+ Новый квест</button>
      </div>
      ${state.quests.filter(q => matchQ(q.title)).map(q => {
        const linkedBonus = state.bonuses.find(b => b.id === q.linkedBonusId);
        return `
          <div class="card-box" style="display:flex; flex-direction:column; gap:9px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
              <div>
                <span style="font-size:11px; color:var(--gold); font-weight:700;">${q.qtype === 'counter' ? 'КВЕСТ-СЧЁТЧИК' : 'КВЕСТ ЧЕК-ЛИСТ'} · +${q.coins} ●</span>
                <div style="font-size:15.5px; font-weight:750; margin-top:2px;">${esc(q.title)}</div>
                ${linkedBonus ? `<div style="font-size:11.5px; color:var(--good); margin-top:2px;">🎁 Приз финала: ${esc(linkedBonus.title)}</div>` : ''}
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:11.5px; color:${q.status === 'completed' ? 'var(--good)' : 'var(--muted)'}; font-weight:700;">
                  ${q.status === 'completed' ? '✓ Завершён' : 'В пути'}
                </span>
                <button type="button" class="icon-btn" data-act="open-sheet" data-sheet="quest-menu" data-id="${esc(q.id)}" title="Редактировать или удалить квест">⋯</button>
              </div>
            </div>

            ${q.qtype === 'counter' ? `
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;" class="card-subtle">
                <span style="font-weight:700;">Прогресс: ${q.currentCount} / ${q.targetCount}</span>
                <div style="display:flex; gap:6px;">
                  ${q.currentCount > 0 ? `<button type="button" class="icon-btn" data-act="quest-counter-step" data-id="${esc(q.id)}" data-d="-1">−1</button>` : ''}
                  ${q.status !== 'completed' ? `<button type="button" class="pill active" data-act="quest-counter-step" data-id="${esc(q.id)}" data-d="1">+1 шаг</button>` : ''}
                </div>
              </div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:6px;">
                ${q.steps.map(st => `
                  <button type="button" class="card-subtle" style="display:flex; align-items:center; gap:8px; text-align:left;" data-act="toggle-quest-step" data-id="${esc(q.id)}" data-sid="${esc(st.id)}">
                    <span style="color:${st.done ? 'var(--good)' : 'var(--muted)'}; font-weight:800;">${st.done ? '☑' : '☐'}</span>
                    <span style="${st.done ? 'text-decoration:line-through; opacity:0.65;' : ''}">${esc(st.text)}</span>
                  </button>
                `).join('')}
              </div>
            `}
          </div>
        `;
      }).join('')}
    `;
  } else if (sub === 'habits') {
    const habits = state.items.filter(i => i.kind === 'habit' && i.status !== 'archived' && matchQ(i.title));
    body = `
      <div style="display:flex; justify-content:flex-end;">
        <button type="button" class="btn-gold" data-act="open-sheet" data-sheet="quick-add">+ Новая привычка</button>
      </div>
      ${habits.map(h => renderCalmTaskRow(state, h)).join('')}
    `;
  } else if (sub === 'tasks') {
    const tasks = state.items.filter(i => i.kind === 'task' && i.status !== 'archived' && matchQ(i.title));
    body = `
      <div style="display:flex; justify-content:flex-end;">
        <button type="button" class="btn-gold" data-act="open-sheet" data-sheet="quick-add">+ Новое задание</button>
      </div>
      ${tasks.map(t => `
        <div class="card-box" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <div>
            <div style="font-weight:650; ${t.status === 'completed' ? 'opacity:0.7;' : ''}">${esc(t.title)}</div>
            <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">
              ${t.status === 'completed' ? 'Завершённое разовое дело' : (t.dueDate ? 'Срок: ' + t.dueDate : 'Активно')}
            </div>
          </div>
          ${t.status === 'completed'
            ? `<button type="button" class="pill active" data-act="repeat-oneoff" data-id="${esc(t.id)}">↻ Ещё подход</button>`
            : `<button type="button" class="icon-btn" data-act="open-sheet" data-sheet="item-menu" data-id="${esc(t.id)}">⋯</button>`
          }
        </div>
      `).join('')}
    `;
  } else if (sub === 'inbox') {
    body = renderInboxContent(state);
  } else if (sub === 'archived') {
    body = `
      <div class="card-box" style="display:flex; flex-direction:column; gap:8px;">
        <strong>Архивные дела и привычки (${archivedItems.length})</strong>
        ${archivedItems.map(it => `
          <div class="card-subtle" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span>${esc(it.title)}</span>
            <button type="button" class="pill active" data-act="restore-archived-item" data-id="${esc(it.id)}">Вернуть</button>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    const totalMins = state.timeLogs.reduce((s, t) => s + (Number(t.minutes) || 0), 0);
    body = `
      <div class="card-box">
        <strong>Журнал выполнений (${state.facts.length}) и практики (${totalMins} мин)</strong>
        <div style="display:flex; flex-direction:column; gap:7px; margin-top:10px;">
          ${state.timeLogs.slice().reverse().slice(0, 25).map(tl => {
            const it = state.items.find(i => i.id === tl.itemId);
            return `<div class="card-subtle" style="font-size:12.5px;">⏱ <strong>${tl.minutes} мин</strong> · ${esc(it ? it.title : 'Практика')} <span style="color:var(--muted);">(${esc(tl.date)})</span></div>`;
          }).join('')}
          ${state.facts.slice().reverse().slice(0, 25).map(f => {
            const it = state.items.find(i => i.id === f.itemId);
            return `<div class="card-subtle" style="font-size:12.5px;">✓ <strong>${esc(it ? it.title : 'Событие')}</strong> · +${f.coins || 0} ● <span style="color:var(--muted);">(${esc(f.date)})</span></div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  return `
    <div class="content-col">
      ${renderRoomHeader('Квесты и дела', 'Все действия, привычки с нормой 1–50 и история')}
      <input id="questsSearchInput" type="search" class="input-clean" placeholder="🔍 Быстрый поиск по квестам, привычкам и заданиям..." value="${esc(APP_UI.searchQuery || '')}" data-input="search-items"/>
      <div class="pill-row">
        ${tabs.map(([id, lbl]) => `
          <button type="button" class="pill ${sub === id ? 'active' : ''}" data-act="set-quests-sub" data-val="${id}">${lbl}</button>
        `).join('')}
      </div>
      ${body}
    </div>
  `;
}

function renderInboxContent(state) {
  return `
    <div class="card-box" style="display:flex; flex-direction:column; gap:10px;">
      <div style="display:flex; gap:8px;">
        <input id="inboxFastInput" class="input-clean" placeholder="Сбросить мысль или идею из головы..."/>
        <button type="button" class="btn-gold" data-act="add-inbox">Сохранить</button>
      </div>
      ${state.inbox.length === 0 ? `<div style="font-size:12.5px; color:var(--muted);">Во Входящих чисто.</div>` : state.inbox.map(inb => `
        <div class="card-subtle" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div>
            <div style="font-weight:600;">${esc(inb.text)}</div>
            <div style="font-size:11px; color:var(--muted);">${esc(inb.date)}</div>
          </div>
          <div style="display:flex; gap:5px;">
            <button type="button" class="pill active" data-act="inbox-to-task" data-id="${esc(inb.id)}">→ В дело</button>
            <button type="button" class="icon-btn" data-act="del-inbox" data-id="${esc(inb.id)}">✕</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderBonusesRoom(state) {
  const sub = APP_UI.bonusSub || 'shop';
  const availOwned = state.ownedBonuses.filter(b => !b.used && !b.refunded);

  return `
    <div class="content-col">
      ${renderRoomHeader('Бонусы и вознаграждения', `Доступно: ${state.wallet.coins} ● · честная радость за реальные шаги`)}
      <div class="pill-row">
        <button type="button" class="pill ${sub === 'shop' ? 'active' : ''}" data-act="set-bonus-sub" data-val="shop">Магазин бонусов</button>
        <button type="button" class="pill ${sub === 'owned' ? 'active' : ''}" data-act="set-bonus-sub" data-val="owned">Мои призы (${availOwned.length})</button>
      </div>

      ${sub === 'shop' ? `
        <div style="display:flex; justify-content:flex-end;">
          <button type="button" class="btn-gold" data-act="open-sheet" data-sheet="add-bonus">+ Свой бонус</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${state.bonuses.map(b => {
            const isTarget = state.targetBonusId === b.id;
            return `
              <div class="card-box" style="border-color:${isTarget ? 'var(--gold)' : 'var(--border-card)'};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                  <div>
                    <div style="font-size:15.5px; font-weight:750;">🎁 ${esc(b.title)}</div>
                    <div style="font-size:12px; color:var(--muted); margin-top:2px;">Стоимость: <strong style="color:var(--gold);">${b.cost} ●</strong></div>
                  </div>
                  <div style="display:flex; gap:5px; align-items:center;">
                    <button type="button" class="icon-btn" data-act="set-target-bonus" data-id="${esc(b.id)}">
                      ${isTarget ? '✦ Моя цель' : 'Сделать целью'}
                    </button>
                    <button type="button" class="icon-btn" data-act="open-sheet" data-sheet="bonus-menu" data-id="${esc(b.id)}" title="Изменить бонус">⋯</button>
                  </div>
                </div>
                <button type="button" class="btn-gold" style="width:100%; margin-top:12px;" data-act="buy-bonus" data-id="${esc(b.id)}" ${state.wallet.coins < b.cost ? 'disabled' : ''}>
                  Купить за ${b.cost} ●
                </button>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:9px;">
          ${state.ownedBonuses.length === 0 ? `<div class="card-box" style="color:var(--muted); font-size:13px;">Купленные и выигранные бонусы появятся здесь.</div>` : state.ownedBonuses.map(ob => `
            <div class="card-box" style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px;">
              <div>
                <div style="font-weight:700; ${ob.used || ob.refunded ? 'text-decoration:line-through; opacity:0.6;' : ''}">🎁 ${esc(ob.title)}</div>
                <div style="font-size:11.5px; color:var(--muted);">${ob.used ? 'Использован' : (ob.refunded ? 'Монеты возвращены' : 'Готов к использованию')}</div>
              </div>
              ${(!ob.used && !ob.refunded) ? `
                <div style="display:flex; gap:6px;">
                  <button type="button" class="pill active" data-act="use-bonus" data-id="${esc(ob.id)}">Использовать</button>
                  ${ob.paidCost > 0 ? `<button type="button" class="icon-btn" data-act="refund-bonus" data-id="${esc(ob.id)}">Вернуть +${ob.paidCost} ●</button>` : ''}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function renderReviewRoom(state) {
  const isLite = state.calcMode === 'lite';
  const todayFacts = state.facts.filter(f => f.date === state.currentDate && f.kind !== 'habitStep').length;
  const todayMins = state.timeLogs.filter(t => t.date === state.currentDate).reduce((s, t) => s + (Number(t.minutes) || 0), 0);

  const wk = getWeeklyRhythmStats(state);
  return `
    <div class="content-col">
      ${renderRoomHeader(isLite ? 'Тихий вечер' : 'Итоги дня и сессии', `Сегодня: ${todayFacts} завершений и ${todayMins} мин живой практики`)}

      <div class="card-box" style="display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:14px;">След моей недели (без штрафов)</strong>
          <span style="font-size:11.5px; color:var(--gold); font-weight:700;">${wk.totalDone7} шаг. · ${wk.totalMins7} мин</span>
        </div>
        <div class="week-bars">
          ${wk.bars.map(b => `
            <div class="w-col" title="${b.iso}: ${b.done} заверш., ${b.mins} мин">
              <div class="w-bar-track">
                <div class="w-bar-fill" style="height:${b.pct}%; opacity:${b.score > 0 ? '1' : '0.22'};"></div>
              </div>
              <span class="w-bar-lbl ${b.isToday ? 'today' : ''}">${b.wd}</span>
            </div>
          `).join('')}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px; color:var(--muted); border-top:1px solid var(--border-card); padding-top:8px; flex-wrap:wrap; gap:6px;">
          <span>Сфер за 7 дн.: <strong>${wk.spheresCount}</strong> · 30 дн.: <strong>${wk.done30}</strong> шаг. / <strong>${wk.mins30}</strong> мин</span>
          <button type="button" class="icon-btn" data-act="copy-week-summary">📋 Поделиться итогом</button>
        </div>
      </div>

      <div class="card-box" style="display:flex; flex-direction:column; gap:11px;">
        <div style="font-size:13px; font-weight:700;">Как ощущается этот вечер?</div>
        <div class="pill-row">
          ${[['calm','🌿 Спокойно'],['warm','✨ Наполненно'],['tired','🌙 Приятная усталость'],['gentle','🫂 Нужен отдых']].map(([id, lbl]) => `
            <button type="button" class="pill ${APP_UI.eveningMood === id ? 'active' : ''}" data-act="set-mood" data-val="${id}">${lbl}</button>
          `).join('')}
        </div>

        <div style="display:flex; gap:8px; align-items:center;">
          <button type="button" class="btn-soft" style="padding:7px 12px; font-size:12px;" data-act="voice-dictate">
            🎤 ${APP_UI.recording ? 'Остановить запись...' : 'Надиктовать голосом'}
          </button>
          <span style="font-size:11.5px; color:var(--muted);">или напиши пару строк</span>
        </div>

        <textarea id="eveningNoteArea" class="input-clean" rows="3" placeholder="Что сегодня порадовало или запомнилось?...">${esc(APP_UI.eveningDraft || '')}</textarea>

        <button type="button" class="btn-gold" data-act="save-evening">Сохранить вечер и получить тёплый отклик</button>
      </div>

      ${!isLite ? `
        <details class="card-box">
          <summary style="cursor:pointer; font-weight:700; font-size:14px;">🧭 Вопросы недельной стратегической сессии</summary>
          <ul style="margin:10px 0 0; padding-left:18px; font-size:13px; color:var(--muted); display:flex; flex-direction:column; gap:6px;">
            <li>Какие маленькие шаги на этой неделе дали больше всего спокойствия и энергии?</li>
            <li>Где план оказался тесным и что стоит перевести в бережный ритм или отложить?</li>
            <li>Какой один ориентир на Карте жизни откликается сильнее всего на следующую неделю?</li>
          </ul>
        </details>
      ` : ''}

      <div style="display:flex; flex-direction:column; gap:8px;">
        ${state.reflections.map(r => `
          <div class="card-box">
            <div style="font-size:11.5px; color:var(--muted);">${esc(r.date)} · <strong>${esc(r.moodLabel)}</strong></div>
            <div style="margin-top:5px;">${esc(r.text)}</div>
            <div style="margin-top:8px; padding:9px 11px; border-radius:12px; background:var(--gold-soft); font-size:12.5px;">
              💛 <em>${esc(r.reply)}</em>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderAiRoom(state) {
  const o = APP_UI.aiOpts;
  if (!o.fromDate) o.fromDate = addDaysISO(state.currentDate, -6);
  if (!o.toDate) o.toDate = state.currentDate;
  const preview = buildAiExportPrompt(state, o);

  return `
    <div class="content-col">
      ${renderRoomHeader('LifeGame AI', 'Проверенный пакет контекста (LAB-007) и двусторонний приём рекомендаций')}

      <div class="card-box" style="display:flex; flex-direction:column; gap:10px;">
        <strong>1. Подготовить контекст для внешней модели</strong>
        <div class="two-grid">
          <select class="input-clean" data-change="ai-mode">
            <option value="daily" ${o.mode === 'daily' ? 'selected' : ''}>Совет на день</option>
            <option value="audit" ${o.mode === 'audit' ? 'selected' : ''}>Анализ недели</option>
            <option value="strategy" ${o.mode === 'strategy' ? 'selected' : ''}>Разбор Карты</option>
          </select>
          <select class="input-clean" data-change="ai-format">
            <option value="json" ${o.format === 'json' ? 'selected' : ''}>Текст + JSON</option>
            <option value="text" ${o.format === 'text' ? 'selected' : ''}>Только текст</option>
          </select>
        </div>

        <div class="pill-row">
          <button type="button" class="pill ${o.catStrategy ? 'active' : ''}" data-act="toggle-ai-cat" data-k="catStrategy">Карта и этапы</button>
          <button type="button" class="pill ${o.catActions ? 'active' : ''}" data-act="toggle-ai-cat" data-k="catActions">Дела и минуты</button>
          <button type="button" class="pill ${o.catReflections ? 'active' : ''}" data-act="toggle-ai-cat" data-k="catReflections">Вечерние записи</button>
        </div>

        <textarea class="input-clean" rows="5" readonly style="font-size:11.5px; font-family:var(--font-mono);">${esc(preview)}</textarea>

        <label style="display:flex; align-items:center; gap:8px; font-size:12.5px; cursor:pointer;">
          <input type="checkbox" ${o.consent ? 'checked' : ''} data-change="ai-consent"/>
          <span>Я проверил предпросмотр и готов скопировать пакет (${preview.length} зн.)</span>
        </label>

        <button type="button" class="btn-gold" data-act="copy-ai-pack" ${!o.consent ? 'disabled' : ''}>📋 Скопировать запрос для ИИ</button>
      </div>

      <div class="card-box" style="display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>2. Принять ответ ИИ обратно в систему</strong>
          <button type="button" class="icon-btn" data-act="sample-ai-reply">Пример JSON</button>
        </div>
        <textarea id="aiReplyInput" class="input-clean" rows="3" placeholder="Вставь ответ или JSON-блок от модели...">${esc(APP_UI.aiReplyRaw || '')}</textarea>
        <button type="button" class="btn-soft" data-act="parse-ai-reply">Разобрать предложения</button>

        ${APP_UI.aiProposals.length ? `
          <div style="display:flex; flex-direction:column; gap:7px; margin-top:4px;">
            ${APP_UI.aiProposals.map((p, idx) => `
              <div class="card-subtle" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <span style="font-size:12.5px;"><strong>${esc(p.title || p.unknownGap)}</strong></span>
                <button type="button" class="pill ${p.ok ? 'active' : ''}" data-act="toggle-prop" data-idx="${idx}">${p.ok ? '☑ Принять' : 'Пропустить'}</button>
              </div>
            `).join('')}
            <button type="button" class="btn-gold" data-act="apply-ai-props">Применить одобренное (со снимком защиты)</button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function renderTreatsRoom(state) {
  return `
    <div class="content-col">
      ${renderRoomHeader('Ништяки', 'Личный список бесплатных радостей, которые возвращают тепло и ресурс')}
      <div class="card-box" style="display:flex; gap:8px;">
        <input id="treatNewInput" class="input-clean" placeholder="Что простого и приятного радует тебя?..."/>
        <button type="button" class="btn-gold" data-act="add-treat">＋</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:9px;">
        ${state.treats.map(tr => `
          <div class="card-box" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div>
              <div style="font-weight:650;">☕ ${esc(tr.text)}</div>
              ${tr.count > 0 ? `<div style="font-size:11.5px; color:var(--muted);">Порадовал себя: ${tr.count} р.</div>` : ''}
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <button type="button" class="pill active" data-act="enjoy-treat" data-id="${esc(tr.id)}">Порадоваться</button>
              <button type="button" class="icon-btn" data-act="open-sheet" data-sheet="treat-menu" data-id="${esc(tr.id)}" title="Изменить ништяк">⋯</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderWidgetsRoom(state) {
  const timer = APP_UI.timer;
  return `
    <div class="content-col">
      ${renderRoomHeader('Мои виджеты', 'Компактные помощники без перегруза главного экрана')}

      <!-- 1. First Step -->
      <div class="card-box">
        <div style="font-weight:750; font-size:15.5px;">🚀 Первый шаг (правило 2 минут)</div>
        <p style="font-size:12.5px; color:var(--muted); margin:5px 0 10px;">
          Трудно начать? Договорись с собой позаниматься ровно 2 минуты — после этого ты имеешь полное право остановиться.
        </p>
        <button type="button" class="btn-soft" data-act="start-two-min">Запустить лёгкие 2 минуты</button>
      </div>

      <!-- 2. Focus Timer -->
      <div class="card-box">
        <div style="font-weight:750; font-size:15.5px;">⏱ Время для важного (Таймер подхода)</div>
        <p style="font-size:12.5px; color:var(--muted); margin:5px 0 10px;">
          Записывает чистые минуты практики в историю, не проставляя галочку выполнения автоматически.
        </p>
        ${timer ? `
          <div class="card-subtle" style="text-align:center;">
            <div style="font-size:28px; font-weight:800; font-family:var(--font-mono); color:var(--gold);" id="widgetTimerDigits">
              ${Math.floor(timer.sec / 60)}:${String(timer.sec % 60).padStart(2, '0')}
            </div>
            <div style="display:flex; gap:8px; justify-content:center; margin-top:10px;">
              <button type="button" class="btn-gold" data-act="save-timer-mins">Записать минуты</button>
              <button type="button" class="btn-soft" data-act="stop-timer">Сброс</button>
            </div>
          </div>
        ` : `
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <select id="timerItemSelect" class="input-clean" style="flex:1;">
              ${state.items.filter(i => i.status === 'active').map(it => `<option value="${esc(it.id)}">${esc(it.title)}</option>`).join('')}
            </select>
            <button type="button" class="btn-gold" data-act="start-timer" data-mins="15">15 мин</button>
            <button type="button" class="btn-soft" data-act="start-timer" data-mins="25">25 мин</button>
          </div>
        `}
      </div>

      <!-- 3. Happiness Game (200 authentic messages!) -->
      <div class="card-box">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-weight:750; font-size:15.5px;">☀ Игра в счастье (200 тёплых моментов)</div>
          <button type="button" class="pill active" data-act="draw-happiness">Ещё искра ✨</button>
        </div>
        <div class="card-subtle" style="margin-top:10px; font-size:13px; line-height:1.5;">
          ${esc(APP_UI.currentSpark || HAPPINESS_POOL[0])}
        </div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <input id="happyCustomInput" class="input-clean" placeholder="Записать свой хороший момент дня..."/>
          <button type="button" class="btn-soft" data-act="save-happy-moment">＋</button>
        </div>
        ${state.happyMoments.slice(0, 4).map(hm => `
          <div style="font-size:12px; color:var(--muted); margin-top:6px;">💛 ${esc(hm.date)}: ${esc(hm.text)}</div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderSettingsRoom(state) {
  const isLite = state.calcMode === 'lite';
  const themes = [
    ['night', 'Ночной квест (первая версия)'],
    ['dawn', 'Тихий рассвет'],
    ['pop', 'Стикеры'],
    ['graphite', 'Графит']
  ];

  return `
    <div class="content-col">
      ${renderRoomHeader('Настройки', 'Спокойное управление внешним видом, особыми режимами и данными')}

      <!-- 0. Guide & Quick Start -->
      <div class="card-box" style="display:flex; justify-content:space-between; align-items:center; gap:10px; border-color:var(--border-gold);">
        <div>
          <div style="font-weight:750;">📖 Как устроена LifeGame</div>
          <div style="font-size:12px; color:var(--muted);">Короткий путеводитель для жизни без выгорания</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" class="pill active" data-act="open-sheet" data-sheet="guide">Путеводитель</button>
          <button type="button" class="icon-btn" data-act="open-sheet" data-sheet="welcome" title="Открыть мастер старта">Старт</button>
        </div>
      </div>

      <!-- 1. Space Switcher (My Life vs Living Example) -->
      <div class="card-box">
        <div style="font-weight:750; margin-bottom:8px;">Пространство жизни</div>
        <div class="two-grid">
          <button type="button" class="pill ${APP_UI.space === 'my' ? 'active' : ''}" style="padding:10px;" data-act="switch-space" data-val="my">🌱 Моя чистая жизнь</button>
          <button type="button" class="pill ${APP_UI.space === 'demo' ? 'active' : ''}" style="padding:10px;" data-act="switch-space" data-val="demo">✨ Живой пример</button>
        </div>
        ${APP_UI.space === 'demo' ? `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; font-size:12.5px; color:var(--muted);">
            <span>Текущая дата примера: <strong>${state.currentDate}</strong></span>
            <button type="button" class="pill" data-act="step-demo-day">+1 день вперёд ⏭</button>
          </div>
        ` : ''}
      </div>

      <!-- 2. Visual Theme & Comfort -->
      <div class="card-box" style="display:flex; flex-direction:column; gap:10px;">
        <div style="font-weight:750;">Оформление и воздух</div>
        <div class="two-grid">
          ${themes.map(([id, lbl]) => `
            <button type="button" class="pill ${state.theme === id ? 'active' : ''}" style="padding:9px; text-overflow:ellipsis; overflow:hidden;" data-act="set-theme" data-val="${id}">${lbl}</button>
          `).join('')}
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="pill ${state.showMotivation ? 'active' : ''}" data-act="toggle-motivation-vis">Строка мотивации</button>
          <button type="button" class="pill ${state.compactHero ? 'active' : ''}" data-act="toggle-compact-hero">Компактная шапка</button>
          <button type="button" class="pill ${!SoundEngine.muted ? 'active' : ''}" data-act="toggle-sound">${SoundEngine.muted ? '🔇 Без звука' : '🔊 Мягкий звук'}</button>
          <button type="button" class="pill ${APP_UI.wide ? 'active' : ''}" data-act="toggle-wide">📱 / 🖥 Ширина</button>
          <button type="button" class="pill ${state.remindersOn ? 'active' : ''}" data-act="toggle-reminders">🔔 Напоминания встреч</button>
        </div>
      </div>

      <!-- 3. Special Modes (Pro): Red Mobilization Mode & Creative Pause -->
      ${!isLite ? `
        <div class="card-box" style="display:flex; flex-direction:column; gap:10px;">
          <div style="font-weight:750;">Особые режимы периода (не перегружают Главную)</div>
          <div class="pill-row">
            <button type="button" class="pill ${state.specialMode === 'none' ? 'active' : ''}" data-act="set-special-mode" data-val="none">Обычный ход</button>
            <button type="button" class="pill ${state.specialMode === 'red' ? 'active' : ''}" data-act="set-special-mode" data-val="red">🔴 Красный режим (Мобилизация)</button>
            <button type="button" class="pill ${state.specialMode === 'pause' ? 'active' : ''}" data-act="set-special-mode" data-val="pause">🎨 Творческая пауза</button>
          </div>
          ${state.specialMode === 'red' ? `
            <div class="card-subtle" style="border-color:rgba(248,113,113,0.4);">
              <div style="font-size:12px; font-weight:700; color:var(--red);">Фокус на одной сфере + бережная опора восстановления:</div>
              <select class="input-clean" style="margin-top:6px;" data-change="red-dir">
                ${state.directions.map(d => `<option value="${esc(d.id)}" ${state.redConfig.directionId === d.id ? 'selected' : ''}>Приоритет: ${esc(d.name)}</option>`).join('')}
              </select>
              <div class="pill-row" style="margin-top:8px;">
                <button type="button" class="pill ${state.redConfig.care.sleep ? 'active' : ''}" data-act="toggle-red-care" data-k="sleep">😴 Сон</button>
                <button type="button" class="pill ${state.redConfig.care.water ? 'active' : ''}" data-act="toggle-red-care" data-k="water">💧 Вода</button>
                <button type="button" class="pill ${state.redConfig.care.rest ? 'active' : ''}" data-act="toggle-red-care" data-k="rest">🌿 Пауза 10 мин</button>
              </div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${!isLite ? `
        <div class="card-box" style="display:flex; flex-direction:column; gap:8px;">
          <div style="font-weight:750;">Мои локации контекста</div>
          <div style="font-size:12px; color:var(--muted);">В Конструкторе можно включить «🕒 Авто по времени суток» (будни 09–18 Работа, остальное Дом) или добавить своё место.</div>
          <div style="display:flex; gap:8px;">
            <input id="customLocInput" class="input-clean" placeholder="Своя локация (напр. Зал, Дача, Кафе)..."/>
            <button type="button" class="btn-soft" data-act="add-custom-loc">＋</button>
          </div>
          ${(state.customLocations && state.customLocations.length) ? `
            <div class="pill-row">
              ${state.customLocations.map(l => `<span class="pill">📍 ${esc(l.name)} <button type="button" style="color:var(--red); margin-left:4px;" data-act="del-custom-loc" data-id="${esc(l.id)}">✕</button></span>`).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- 4. Strategy Snapshots & Guarded Backup / Personal 1.2.0 Import -->
      <div class="card-box" style="display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div style="font-weight:750;">Версии стратегии и резервные копии</div>
          <span style="font-size:11px; color:${state.lastBackupDate ? 'var(--good)' : 'var(--amber)'};">
            ${state.lastBackupDate ? '✓ Копия от ' + esc(state.lastBackupDate) : 'Сохраняй JSON раз в неделю'}
          </span>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn-soft" data-act="save-snapshot">📸 Снимок стратегии</button>
          <button type="button" class="btn-soft" data-act="clean-slate">🌱 Чистый лист планов (сохранив опыт)</button>
        </div>
        ${state.snapshots.slice(0, 4).map(sn => `
          <div class="card-subtle" style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:12.5px;"><strong>${esc(sn.title)}</strong> (${esc(sn.date)})</span>
            <button type="button" class="icon-btn" data-act="restore-snapshot" data-id="${esc(sn.id)}">Вернуть</button>
          </div>
        `).join('')}

        <div style="display:flex; gap:8px; flex-wrap:wrap; padding-top:6px; border-top:1px solid var(--border-card);">
          <button type="button" class="btn-gold" style="flex:1;" data-act="export-json">⬇ Скачать JSON</button>
          <button type="button" class="btn-soft" style="flex:1;" data-act="open-sheet" data-sheet="import-json">⬆ Импорт (вкл. Personal 1.2)</button>
        </div>
      </div>
    </div>
  `;
}

function renderSheetModal(state) {
  const sh = APP_UI.sheet;
  if (!sh) return '';

  let inner = '';

  if (sh.name === 'quick-add') {
    const f = APP_UI.addForm;
    inner = `
      <h3 style="margin:0 0 12px;">Новое дело</h3>
      <div style="display:grid; gap:10px;">
        <input id="qaTitle" class="input-clean" placeholder="Название шага..." value="${esc(f.title)}"/>
        <div class="pill-row">
          <button type="button" class="pill ${f.kind === 'habit' ? 'active' : ''}" data-act="qa-kind" data-val="habit">Привычка</button>
          <button type="button" class="pill ${f.kind === 'task' ? 'active' : ''}" data-act="qa-kind" data-val="task">Разовое дело</button>
        </div>
        ${f.kind === 'habit' ? `
          <label style="font-size:12px; color:var(--muted);">Норма подходов в день (1–50):
            <input id="qaNorm" type="number" min="1" max="50" value="${f.norm || 1}" class="input-clean" style="margin-top:4px;"/>
          </label>
        ` : `
          <div>
            <div style="font-size:12px; color:var(--muted); margin-bottom:5px;">Срок / дата (решение F-002):</div>
            <div class="pill-row">
              <button type="button" class="pill ${f.dateMode === 'none' ? 'active' : ''}" data-act="qa-date" data-val="none">Без срока</button>
              <button type="button" class="pill ${f.dateMode === 'today' ? 'active' : ''}" data-act="qa-date" data-val="today">Сегодня</button>
              <button type="button" class="pill ${f.dateMode === 'tomorrow' ? 'active' : ''}" data-act="qa-date" data-val="tomorrow">Завтра</button>
              <button type="button" class="pill ${f.dateMode === 'pick' ? 'active' : ''}" data-act="qa-date" data-val="pick">Дата</button>
            </div>
            ${f.dateMode === 'pick' ? `<input id="qaCustomDate" type="date" class="input-clean" style="margin-top:6px;" value="${esc(f.customDate || state.currentDate)}"/>` : ''}
          </div>
        `}
        <select id="qaDir" class="input-clean">
          ${state.directions.map(d => `<option value="${esc(d.id)}" ${f.dirId === d.id ? 'selected' : ''}>Сфера: ${esc(d.name)}</option>`).join('')}
        </select>
        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:4px;">
          <button type="button" class="btn-soft" data-act="close-sheet">Отмена</button>
          <button type="button" class="btn-gold" data-act="submit-qa">Сохранить</button>
        </div>
      </div>
    `;
  } else if (sh.name === 'log-minutes') {
    const it = state.items.find(x => x.id === sh.id);
    const eff = it ? get7DayEffort(state, it.id) : { todayMins: 0 };
    inner = `
      <h3 style="margin:0 0 6px;">⏱ Записать время практики</h3>
      <div style="font-size:12.5px; color:var(--muted); margin-bottom:12px;">
        ${esc(it ? it.title : '')} · сегодня уже записано: <strong>${eff.todayMins} мин</strong> (сохраняется в 7-дневной ленте отдельно от награды)
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        ${[5, 8, 10, 15, 25, 45].map(m => `
          <button type="button" class="pill active" data-act="save-mins" data-id="${esc(sh.id)}" data-mins="${m}">+${m} мин</button>
        `).join('')}
      </div>
      <div style="display:flex; justify-content:space-between; margin-top:14px;">
        ${eff.todayMins > 0 ? `<button type="button" class="btn-soft" data-act="clear-mins" data-id="${esc(sh.id)}">Очистить сегодня</button>` : '<span></span>'}
        <button type="button" class="btn-soft" data-act="close-sheet">Готово</button>
      </div>
    `;
  } else if (sh.name === 'item-menu') {
    const it = state.items.find(x => x.id === sh.id);
    if (!it) return '';
    inner = `
      <h3 style="margin:0 0 8px;">Настройка дела</h3>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <input id="editItemTitle" class="input-clean" value="${esc(it.title)}" placeholder="Название дела"/>
        <div class="two-grid">
          <select id="editItemDir" class="input-clean">
            ${state.directions.map(d => `<option value="${esc(d.id)}" ${it.directionId === d.id ? 'selected' : ''}>Сфера: ${esc(d.short)}</option>`).join('')}
          </select>
          <select id="editItemLoc" class="input-clean">
            ${getAllLocations(state).filter(([id]) => id !== 'auto').map(([id,l]) => `<option value="${esc(id)}" ${it.locationId === id ? 'selected' : ''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <div class="two-grid">
          <select id="editItemTempo" class="input-clean">
            ${[['gentle','🌱 Бережно'],['normal','⚖ Обычно'],['intense','🔥 Фигачу']].map(([id,l]) => `<option value="${id}" ${(it.tempoMin || 'normal') === id ? 'selected' : ''}>Темп: ${l}</option>`).join('')}
          </select>
          <input id="editItemCoins" type="number" min="1" max="300" class="input-clean" value="${it.coins || 10}" placeholder="Награда ●"/>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <input id="editItemDue" type="date" class="input-clean" value="${esc(it.dueDate || '')}"/>
          <button type="button" class="btn-gold" style="white-space:nowrap;" data-act="save-item-edits" data-id="${esc(it.id)}">Сохранить</button>
        </div>
        <button type="button" class="card-subtle" style="text-align:left;" data-act="toggle-star" data-id="${esc(it.id)}">
          ${it.isKey ? '★ Убрать из ключевых' : '☆ Сделать ключевым делом дня'}
        </button>
        <button type="button" class="card-subtle" style="text-align:left;" data-act="toggle-lite-member" data-id="${esc(it.id)}">
          ${it.inLiteRhythm ? '✓ Входит в Лайт-ритм (убрать)' : '+ Включить в Лайт-ритм'}
        </button>
        <button type="button" class="card-subtle" style="text-align:left;" data-act="shift-item-due" data-id="${esc(it.id)}">
          📅 Перенести дату на завтра (+1 день)
        </button>
        <button type="button" class="card-subtle" style="text-align:left;" data-act="flip-item-kind" data-id="${esc(it.id)}">
          🔄 Сменить тип: сейчас «${it.kind === 'habit' ? 'Ежедневная привычка' : 'Разовое задание'}»
        </button>
        ${it.kind === 'habit' ? `
          <div class="card-subtle" style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:12.5px;">Норма с завтрашнего дня:</span>
            <input id="nextNormInput" type="number" min="1" max="50" value="${getEffectiveNorm(it, addDaysISO(state.currentDate, 1))}" class="input-clean" style="width:74px; padding:5px 8px;"/>
            <button type="button" class="pill active" data-act="save-next-norm" data-id="${esc(it.id)}">Ок</button>
          </div>
        ` : ''}
        <div style="display:flex; gap:8px; margin-top:4px;">
          <button type="button" class="btn-soft" style="flex:1;" data-act="archive-item" data-id="${esc(it.id)}">📦 В архив</button>
          <button type="button" class="btn-soft" style="flex:1; color:var(--red);" data-act="delete-item" data-id="${esc(it.id)}">Удалить</button>
        </div>
        <button type="button" class="btn-soft" data-act="close-sheet">Закрыть</button>
      </div>
    `;
  } else if (sh.name === 'configure-rhythm' || sh.name === 'pick-day-plan') {
    const isLiteCfg = sh.name === 'configure-rhythm';
    const active = state.items.filter(i => i.status === 'active');
    inner = `
      <h3 style="margin:0 0 6px;">${isLiteCfg ? 'Набор для «Моего ритма» (Лайт)' : 'Собрать план Конструктора'}</h3>
      <div style="font-size:12px; color:var(--muted); margin-bottom:10px;">
        ${isLiteCfg ? 'Отметь 3–5 опорных дел. Остальные планы будут спокойно заморожены.' : 'Выбери, какие дела показывать в Конструкторе дня.'}
      </div>
      ${isLiteCfg ? `<button type="button" class="pill" style="margin-bottom:10px;" data-act="suggest-lite-set">✨ Предложить небольшой набор (до 3 дел)</button>` : ''}
      <div style="display:flex; flex-direction:column; gap:7px;">
        ${active.map(it => {
          const on = isLiteCfg ? it.inLiteRhythm : it.inDayPlan;
          return `
            <button type="button" class="card-subtle" style="display:flex; justify-content:space-between; align-items:center; text-align:left;"
              data-act="${isLiteCfg ? 'toggle-lite-member' : 'toggle-day-member'}" data-id="${esc(it.id)}">
              <span>${esc(it.title)}</span>
              <span style="color:${on ? 'var(--good)' : 'var(--muted)'}; font-weight:700;">${on ? '✓ Включено' : 'Скрыто'}</span>
            </button>
          `;
        }).join('')}
      </div>
      <button type="button" class="btn-gold" style="width:100%; margin-top:12px;" data-act="close-sheet">Готово</button>
    `;
  } else if (sh.name === 'add-cal') {
    inner = `
      <h3 style="margin:0 0 10px;">Новое событие календаря</h3>
      <div style="display:grid; gap:9px;">
        <input id="calTitle" class="input-clean" placeholder="Название встречи или обязательства"/>
        <div class="two-grid">
          <input id="calDate" type="date" class="input-clean" value="${esc(state.currentDate)}"/>
          <input id="calTime" type="time" class="input-clean" value="15:00"/>
        </div>
        <select id="calRepeat" class="input-clean">
          <option value="none">Повтор: Разово</option>
          <option value="daily">Повтор: Ежедневно</option>
          <option value="weekly">Повтор: Еженедельно</option>
          <option value="monthly">Повтор: Ежемесячно (с учётом конца месяца)</option>
          <option value="yearly">Повтор: Ежегодно</option>
        </select>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="btn-soft" data-act="close-sheet">Отмена</button>
          <button type="button" class="btn-gold" data-act="submit-cal">Сохранить</button>
        </div>
      </div>
    `;
  } else if (sh.name === 'move-cal') {
    const ev = state.calendar.find(c => c.id === sh.id);
    if (!ev) return '';
    const nextDay = addDaysISO(sh.occ || state.currentDate, 1);
    inner = `
      <h3 style="margin:0 0 8px;">Событие календаря</h3>
      <div style="display:grid; gap:9px;">
        <input id="moveCalTitle" class="input-clean" value="${esc(ev.title)}" placeholder="Название встречи"/>
        <div class="two-grid">
          <input id="moveCalDate" type="date" class="input-clean" value="${esc(nextDay)}"/>
          <input id="moveCalTime" type="time" class="input-clean" value="${esc(ev.time || '15:00')}"/>
        </div>
        ${ev.repeat !== 'none' ? `
          <div style="font-size:12px; color:var(--muted);">Повторяющаяся серия — область переноса:</div>
          <button type="button" class="btn-gold" data-act="confirm-move-cal" data-id="${esc(ev.id)}" data-occ="${esc(sh.occ)}" data-scope="single">Перенести только это появление</button>
          <button type="button" class="btn-soft" data-act="confirm-move-cal" data-id="${esc(ev.id)}" data-occ="${esc(sh.occ)}" data-scope="future">Сохранить / перенести серию</button>
          <button type="button" class="btn-soft" data-act="cancel-cal-occ" data-id="${esc(ev.id)}" data-occ="${esc(sh.occ)}">Пропустить только эту дату</button>
        ` : `
          <button type="button" class="btn-gold" data-act="confirm-move-cal" data-id="${esc(ev.id)}" data-occ="${esc(sh.occ)}" data-scope="future">Сохранить изменения / дату</button>
        `}
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn-soft" style="flex:1;" data-act="export-ics" data-id="${esc(ev.id)}" data-occ="${esc(sh.occ)}">⬇ В телефон (.ics)</button>
          <button type="button" class="btn-soft" style="flex:1; color:var(--red);" data-act="delete-cal" data-id="${esc(ev.id)}">Удалить</button>
        </div>
        <button type="button" class="btn-soft" data-act="close-sheet">Закрыть</button>
      </div>
    `;
  } else if (sh.name === 'quest-menu') {
    const q = state.quests.find(x => x.id === sh.id);
    if (!q) return '';
    inner = `
      <h3 style="margin:0 0 8px;">Настройка квеста</h3>
      <div style="display:grid; gap:9px;">
        <input id="eqTitle" class="input-clean" value="${esc(q.title)}" placeholder="Название квеста"/>
        <div class="two-grid">
          <input id="eqCoins" type="number" min="5" max="500" class="input-clean" value="${q.coins || 45}" placeholder="Монеты ●"/>
          <select id="eqBonus" class="input-clean">
            <option value="">Без призового бонуса</option>
            ${state.bonuses.map(b => `<option value="${esc(b.id)}" ${q.linkedBonusId === b.id ? 'selected' : ''}>🎁 ${esc(b.title)}</option>`).join('')}
          </select>
        </div>
        ${q.qtype === 'counter' ? `
          <label style="font-size:12px; color:var(--muted);">Целевое число шагов:
            <input id="eqTarget" type="number" min="1" max="365" class="input-clean" style="margin-top:4px;" value="${q.targetCount || 5}"/>
          </label>
        ` : `
          <label style="font-size:12px; color:var(--muted);">Шаги квеста (по одному в строке):
            <textarea id="eqSteps" class="input-clean" rows="4" style="margin-top:4px;">${esc((q.steps || []).map(s => s.text).join('\n'))}</textarea>
          </label>
        `}
        <button type="button" class="btn-gold" data-act="save-quest-edits" data-id="${esc(q.id)}">Сохранить квест</button>
        <div style="display:flex; gap:8px;">
          ${q.status === 'completed' ? `<button type="button" class="btn-soft" style="flex:1;" data-act="reopen-quest" data-id="${esc(q.id)}">↻ Открыть заново</button>` : ''}
          <button type="button" class="btn-soft" style="flex:1; color:var(--red);" data-act="delete-quest" data-id="${esc(q.id)}">Удалить квест</button>
        </div>
        <button type="button" class="btn-soft" data-act="close-sheet">Закрыть</button>
      </div>
    `;
  } else if (sh.name === 'bonus-menu') {
    const b = state.bonuses.find(x => x.id === sh.id);
    if (!b) return '';
    inner = `
      <h3 style="margin:0 0 8px;">Изменить бонус</h3>
      <div style="display:grid; gap:9px;">
        <input id="ebTitle" class="input-clean" value="${esc(b.title)}"/>
        <input id="ebCost" type="number" min="5" max="5000" class="input-clean" value="${b.cost}"/>
        <button type="button" class="btn-gold" data-act="save-bonus-edits" data-id="${esc(b.id)}">Сохранить</button>
        <button type="button" class="btn-soft" style="color:var(--red);" data-act="delete-bonus" data-id="${esc(b.id)}">Удалить из магазина</button>
        <button type="button" class="btn-soft" data-act="close-sheet">Отмена</button>
      </div>
    `;
  } else if (sh.name === 'treat-menu') {
    const tr = state.treats.find(x => x.id === sh.id);
    if (!tr) return '';
    inner = `
      <h3 style="margin:0 0 8px;">Изменить ништяк</h3>
      <div style="display:grid; gap:9px;">
        <input id="etrText" class="input-clean" value="${esc(tr.text)}"/>
        <button type="button" class="btn-gold" data-act="save-treat-edits" data-id="${esc(tr.id)}">Сохранить</button>
        <button type="button" class="btn-soft" style="color:var(--red);" data-act="delete-treat" data-id="${esc(tr.id)}">Удалить</button>
        <button type="button" class="btn-soft" data-act="close-sheet">Отмена</button>
      </div>
    `;
  } else if (sh.name === 'add-bonus') {
    inner = `
      <h3 style="margin:0 0 10px;">Новый личный бонус</h3>
      <div style="display:grid; gap:9px;">
        <input id="bonTitle" class="input-clean" placeholder="Чем приятным порадовать себя?"/>
        <input id="bonCost" type="number" min="5" max="2000" value="50" class="input-clean" placeholder="Стоимость в монетах"/>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="btn-soft" data-act="close-sheet">Отмена</button>
          <button type="button" class="btn-gold" data-act="submit-bonus">Добавить</button>
        </div>
      </div>
    `;
  } else if (sh.name === 'add-quest') {
    inner = `
      <h3 style="margin:0 0 10px;">Новый квест</h3>
      <div style="display:grid; gap:9px;">
        <input id="qTitle" class="input-clean" placeholder="Название квеста"/>
        <select id="qType" class="input-clean">
          <option value="counter">Тип: Квест-счётчик (напр. 5 раз)</option>
          <option value="checklist">Тип: Чек-лист шагов</option>
        </select>
        <input id="qTargetOrSteps" class="input-clean" placeholder="Число для счётчика (напр. 5) или шаги через запятую"/>
        <select id="qBonus" class="input-clean">
          <option value="">Призовой бонус финала: без привязки</option>
          ${state.bonuses.map(b => `<option value="${esc(b.id)}">🎁 ${esc(b.title)}</option>`).join('')}
        </select>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="btn-soft" data-act="close-sheet">Отмена</button>
          <button type="button" class="btn-gold" data-act="submit-quest">Создать квест</button>
        </div>
      </div>
    `;
  } else if (sh.name === 'add-word') {
    inner = `
      <h3 style="margin:0 0 10px;">Дать слово</h3>
      <div style="display:grid; gap:9px;">
        <input id="wTitle" class="input-clean" placeholder="Какое решение фиксируешь?"/>
        <input id="wDate" type="date" class="input-clean" value="${esc(addDaysISO(state.currentDate, 3))}"/>
        <input id="wStake" type="number" min="5" max="500" value="30" class="input-clean" placeholder="Добровольная ставка ●"/>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="btn-soft" data-act="close-sheet">Отмена</button>
          <button type="button" class="btn-gold" data-act="submit-word">Зафиксировать</button>
        </div>
      </div>
    `;
  } else if (sh.name === 'edit-dir') {
    const d = state.directions.find(x => x.id === sh.id);
    if (!d) return '';
    inner = `
      <h3 style="margin:0 0 10px;">Сфера и этапы: ${esc(d.name)}</h3>
      <div style="display:grid; gap:8px;">
        <div class="two-grid">
          <input id="edName" class="input-clean" value="${esc(d.name)}" placeholder="Полное название"/>
          <input id="edShort" class="input-clean" value="${esc(d.short)}" placeholder="Кратко на карте"/>
        </div>
        <div class="two-grid">
          <select id="edNature" class="input-clean">
            ${[['growth','✨ Развитие'],['care','🤍 Забота'],['shield','🛡 Защита'],['reduce','✂ Сокращение']].map(([k,l]) => `<option value="${k}" ${d.nature === k ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <select id="edColor" class="input-clean">
            ${[['#f4ce4a','Золотой'],['#b48cff','Лаванда'],['#34d399','Изумруд'],['#38bdf8','Небо'],['#f472b6','Розовый'],['#a3e635','Лайм'],['#f87171','Коралл'],['#94a3b8','Сланец']].map(([c,l]) => `<option value="${c}" ${d.color === c ? 'selected' : ''}>Цвет: ${l}</option>`).join('')}
          </select>
        </div>
        <input id="edFact" class="input-clean" value="${esc(d.fact)}" placeholder="1. Факт (что уже есть)"/>
        <input id="edCur" class="input-clean" value="${esc(d.currentStage.title)}" placeholder="2. Текущий рабочий этап"/>
        <input id="edStrat" class="input-clean" value="${esc(d.currentStage.strategy)}" placeholder="Стратегия внутри этапа"/>
        <input id="edNext" class="input-clean" value="${esc(d.nextStage)}" placeholder="3. Следующий этап"/>
        <input id="edOpt" class="input-clean" value="${esc(d.optimal)}" placeholder="4. Оазис оптимума"/>
        <input id="edUnk" class="input-clean" value="${esc(d.unknownGap)}" placeholder="5. Полоса неизвестного / гипотеза"/>
        <input id="edLvmg" class="input-clean" value="${esc(d.lvmg)}" placeholder="6. Маяк LVMG"/>
        <label style="font-size:12px; display:flex; gap:7px; align-items:center;">
          <input type="checkbox" id="edKnown" ${d.routeKnownToLvmg ? 'checked' : ''}/> Маршрут до LVMG примерно понятен
        </label>
        <div style="display:flex; justify-content:space-between; gap:8px; margin-top:4px;">
          ${state.directions.length > 2 ? `<button type="button" class="btn-soft" style="color:var(--red);" data-act="delete-dir" data-id="${esc(d.id)}">Удалить сферу</button>` : '<span></span>'}
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn-soft" data-act="close-sheet">Отмена</button>
            <button type="button" class="btn-gold" data-act="submit-edit-dir" data-id="${esc(d.id)}">Сохранить</button>
          </div>
        </div>
      </div>
    `;
  } else if (sh.name === 'promote-stage') {
    const d = state.directions.find(x => x.id === sh.id);
    if (!d) return '';
    inner = `
      <h3 style="margin:0 0 6px;">🏆 Завершить текущий этап</h3>
      <div style="font-size:12.5px; color:var(--muted); margin-bottom:10px;">
        Этап <strong>«${esc(d.currentStage.title)}»</strong> перейдёт в твои достижения в основании сферы (+35 ● и +50 XP), а рабочим станет следующий этап.
      </div>
      <div style="display:grid; gap:8px;">
        <label style="font-size:12px; color:var(--muted);">Новый текущий этап (вступает в работу):
          <input id="prNewCur" class="input-clean" style="margin-top:4px;" value="${esc(d.nextStage || 'Следующая ступень')}"/>
        </label>
        <label style="font-size:12px; color:var(--muted);">Что поставить следующим этапом (ступень 3):
          <input id="prNewNext" class="input-clean" style="margin-top:4px;" value="${esc((d.foldedStages && d.foldedStages[0]) || 'Укрепление результата на практике')}"/>
        </label>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
          <button type="button" class="btn-soft" data-act="close-sheet">Отмена</button>
          <button type="button" class="btn-gold" data-act="confirm-promote-stage" data-id="${esc(d.id)}">Продвинуть этап ↑</button>
        </div>
      </div>
    `;
  } else if (sh.name === 'add-ach') {
    const d = state.directions.find(x => x.id === sh.id);
    if (!d) return '';
    inner = `
      <h3 style="margin:0 0 8px;">🏆 Моё достижение: ${esc(d.short)}</h3>
      <div style="display:grid; gap:9px;">
        <input id="achTitle" class="input-clean" placeholder="Что важного уже удалось сделать или освоить?"/>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="btn-soft" data-act="close-sheet">Отмена</button>
          <button type="button" class="btn-gold" data-act="submit-ach" data-id="${esc(d.id)}">Сохранить в опору</button>
        </div>
      </div>
    `;
  } else if (sh.name === 'add-dir') {
    inner = `
      <h3 style="margin:0 0 10px;">Новая сфера на Карте жизни</h3>
      <div style="display:grid; gap:8px;">
        <input id="ndName" class="input-clean" placeholder="Название направления"/>
        <input id="ndFact" class="input-clean" placeholder="Фактическое положение сейчас"/>
        <input id="ndCur" class="input-clean" placeholder="Текущий рабочий этап"/>
        <input id="ndOpt" class="input-clean" placeholder="Оптимальный оазис достаточности"/>
        <input id="ndLvmg" class="input-clean" placeholder="Дальний маяк LVMG"/>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="btn-soft" data-act="close-sheet">Отмена</button>
          <button type="button" class="btn-gold" data-act="submit-new-dir">Добавить</button>
        </div>
      </div>
    `;
  } else if (sh.name === 'edit-motivation') {
    inner = `
      <h3 style="margin:0 0 10px;">Личная опора и мотивация</h3>
      <textarea id="motInput" class="input-clean" rows="3">${esc(state.motivationText || '')}</textarea>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
        <button type="button" class="btn-soft" data-act="close-sheet">Отмена</button>
        <button type="button" class="btn-gold" data-act="save-motivation">Сохранить</button>
      </div>
    `;
  } else if (sh.name === 'welcome') {
    const wf = APP_UI.welcomeForm;
    inner = `
      <div style="font-size:10.5px; letter-spacing:0.14em; color:var(--gold); font-weight:800;">ДОБРО ПОЖАЛОВАТЬ В LIFEGAME</div>
      <h3 style="margin:4px 0 6px; font-size:20px;">Твоя спокойная игра в реальной жизни</h3>
      <p style="font-size:12.5px; color:var(--muted); margin:0 0 12px;">
        Здесь нет штрафов за живую жизнь и выгорания от бесконечных списков. Настрой старт за минуту — или сначала посмотри наполненный пример.
      </p>

      <div style="display:grid; gap:10px;">
        <div>
          <div style="font-size:12px; font-weight:700; margin-bottom:6px;">1. В каком режиме начнём?</div>
          <div class="two-grid">
            <button type="button" class="card-subtle" style="text-align:left; border-color:${wf.mode === 'lite' ? 'var(--gold)' : 'var(--border-card)'};" data-act="wf-mode" data-val="lite">
              <div style="font-weight:750; color:${wf.mode === 'lite' ? 'var(--gold)' : 'var(--text)'};">Лайт</div>
              <div style="font-size:11px; color:var(--muted); margin-top:2px;">Обычный калькулятор: 1–3 шага ритма и награды</div>
            </button>
            <button type="button" class="card-subtle" style="text-align:left; border-color:${wf.mode === 'pro' ? 'var(--gold)' : 'var(--border-card)'};" data-act="wf-mode" data-val="pro">
              <div style="font-weight:750; color:${wf.mode === 'pro' ? 'var(--gold)' : 'var(--text)'};">Про</div>
              <div style="font-size:11px; color:var(--muted); margin-top:2px;">Конструктор дня, Карта жизни ↑ и квесты</div>
            </button>
          </div>
        </div>

        <label style="font-size:12px; color:var(--muted);">2. Твой первый спокойный шаг на каждый день:
          <input id="wfHabit" class="input-clean" style="margin-top:4px;" value="${esc(wf.habitTitle)}" placeholder="Напр.: 20 минут фокуса на главном деле"/>
        </label>

        <label style="font-size:12px; color:var(--muted);">3. Чем приятным порадуешь себя за монеты (Моя награда):
          <input id="wfReward" class="input-clean" style="margin-top:4px;" value="${esc(wf.rewardTitle)}" placeholder="Напр.: Любимый кофе и полчаса с книгой"/>
        </label>

        <button type="button" class="btn-gold" style="width:100%; margin-top:2px;" data-act="finish-welcome-my">🌱 Начать мою чистую жизнь</button>

        <div style="display:flex; gap:8px;">
          <button type="button" class="btn-soft" style="flex:1; font-size:12px;" data-act="finish-welcome-demo">✨ Посмотреть живой пример</button>
          <button type="button" class="btn-soft" style="flex:1; font-size:12px;" data-act="open-sheet" data-sheet="import-json">⬆ Импорт JSON</button>
        </div>
      </div>
    `;
  } else if (sh.name === 'guide') {
    inner = `
      <h3 style="margin:0 0 10px;">📖 Карманный путеводитель</h3>
      <div style="display:flex; flex-direction:column; gap:9px; font-size:12.8px; line-height:1.48;">
        <div class="card-subtle">
          <strong style="color:var(--gold);">1. Переключатель «Лайт | Про» в шапке</strong><br/>
          В спокойные и ресурсные дни включай <strong>Про</strong> (Конструктор дня и Карта жизни). В дороге, при усталости или аврале переключайся в <strong>Лайт</strong>: остаются только твои опорные шаги и бонусы, а остальная стратегия ждёт на паузе без пропусков.
        </div>
        <div class="card-subtle">
          <strong style="color:var(--amber);">2. Галочка ✓ и Минуты ⏱ живут отдельно</strong><br/>
          Позанимался гитарой или книгой всего 5–10 минут, но не закрыл полный объём? Нажми <strong>⏱</strong> — минуты сохранятся янтарной точкой в 7-дневной ленте как честный вклад.
        </div>
        <div class="card-subtle">
          <strong style="color:var(--good);">3. Карта жизни: Оазис оптимума и Маяк LVMG ↑</strong><br/>
          Путь сферы идёт снизу вверх: от твёрдого <strong>Факта и достижений</strong> через <strong>Текущий этап</strong> к <strong>Оазису оптимума</strong> («достаточно хорошо», где уже можно спокойно жить) и дальше к <strong>Маяку LVMG</strong> — дальнему ориентиру мечты, даже если дорога к нему пока не известна.
        </div>
        <div class="card-subtle">
          <strong>4. Бонусы ● и бесплатные Ништяки ☕</strong><br/>
          За реальные шаги начисляются монеты на желанные покупки в «Бонусах», а «Ништяки» хранят простые бесплатные радости для поддержки сил в любой момент.
        </div>
        <button type="button" class="btn-gold" style="margin-top:4px;" data-act="close-sheet">Понятно, в игру!</button>
      </div>
    `;
  } else if (sh.name === 'import-json') {
    inner = `
      <h3 style="margin:0 0 8px;">Импорт резервной копии JSON</h3>
      <div style="font-size:12px; color:var(--muted); margin-bottom:8px;">Поддерживаются как файлы LifeGame Hybrid v1.0, так и сохранения Personal 1.2.0 / Personal-Lab.</div>
      <input id="impJsonFile" type="file" accept=".json,application/json" class="input-clean" style="margin-bottom:8px; font-size:12px;" data-change="import-file"/>
      <textarea id="impJsonArea" class="input-clean" rows="5" placeholder="Вставь JSON сюда..."></textarea>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
        <button type="button" class="btn-soft" data-act="close-sheet">Отмена</button>
        <button type="button" class="btn-gold" data-act="confirm-import">Проверить и загрузить</button>
      </div>
    `;
  }

  return `
    <div class="sheet-backdrop" data-act="backdrop-close">
      <div class="sheet-box">${inner}</div>
    </div>
  `;
}
