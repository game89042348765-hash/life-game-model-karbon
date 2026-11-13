// LifeGame 2.0 Unified — Трёхуровневая «Карта жизни» (Большая карта GTA, Мини-радар 10 сек, Путь восхождения снизу вверх ↑)

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function natureBadgeHtml(nature, status) {
  if (nature === 'shield') return '<span class="badge badge-muted">🛡 Защита и опора</span>';
  if (nature === 'reduce') return '<span class="badge badge-red">✂ Сокращение лишнего</span>';
  if (nature === 'care') return '<span class="badge badge-gold">🤍 Тёплое участие</span>';
  if (status === 'oasis') return '<span class="badge badge-oasis">🌿 В оазисе оптимума</span>';
  return '<span class="badge badge-gold">✨ В работе сейчас</span>';
}

function renderMiniRadarWidget(state, compact) {
  const dirs = state.directions;
  const size = compact ? 220 : 296;
  const cx = size / 2;
  const cy = size / 2;
  const rings = compact ? [38, 66, 92] : [52, 90, 126];
  const ringMap = { now: rings[0], next: rings[1], oasis: rings[1] + 12, fog: rings[2] };

  let nodesSvg = '';
  dirs.forEach((d, idx) => {
    const angle = ((idx / Math.max(1, dirs.length)) * 360 - 90) * (Math.PI / 180);
    const r = ringMap[d.horizonRing] || rings[0];
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const isSel = d.id === UI.selectedDirId;
    const isWp = d.id === state.waypointDirectionId;
    nodesSvg += `
      <g class="radar-point" data-action="radar-pick-dir" data-dir-id="${escapeHtml(d.id)}" style="cursor:pointer;">
        ${isWp ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${compact ? 13 : 16}" fill="none" stroke="#ffda29" stroke-width="1.5" stroke-dasharray="3 3"/>` : ''}
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isSel ? (compact ? 9 : 11) : (compact ? 7 : 8.5)}" fill="${escapeHtml(d.color)}" fill-opacity="0.92" stroke="#090909" stroke-width="2"/>
        <text x="${x.toFixed(1)}" y="${(y + (compact ? 17 : 20)).toFixed(1)}" text-anchor="middle" fill="currentColor" font-size="${compact ? '9' : '10'}" font-weight="600" opacity="0.88">${escapeHtml(d.short)}</text>
      </g>
    `;
  });

  return `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="max-width:100%;height:auto;overflow:visible;">
        <defs>
          <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffda29" stop-opacity="0.14"/>
            <stop offset="100%" stop-color="#ffda29" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="${cx}" cy="${cy}" r="${rings[2] + 10}" fill="url(#radarGlow)"/>
        ${rings.map((r, i) => `
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-opacity="${i === 0 ? '0.22' : '0.11'}" stroke-dasharray="${i === 2 ? '4 4' : 'none'}"/>
        `).join('')}
        <line x1="${cx}" y1="10" x2="${cx}" y2="${size - 10}" stroke="currentColor" stroke-opacity="0.07"/>
        <line x1="10" y1="${cy}" x2="${size - 10}" y2="${cy}" stroke="currentColor" stroke-opacity="0.07"/>
        <circle cx="${cx}" cy="${cy}" r="4" fill="#ffda29"/>
        ${nodesSvg}
      </svg>
    </div>
  `;
}

function renderStrategyScreen(state) {
  const selDir = state.directions.find(d => d.id === UI.selectedDirId) || state.directions[0];
  if (selDir && UI.selectedDirId !== selDir.id) UI.selectedDirId = selDir.id;

  const subTabs = [
    { id: 'big', label: '🗺 Большая карта' },
    { id: 'mini', label: '📡 Мини-радар (10 сек)' },
    { id: 'path', label: '🧗 Путь восхождения ↑' }
  ];

  let bodyHtml = '';

  if (UI.mapSubTab === 'big') {
    bodyHtml = renderBigMapSection(state, selDir);
  } else if (UI.mapSubTab === 'mini') {
    bodyHtml = renderMiniMapSection(state, selDir);
  } else {
    bodyHtml = renderAscentPathSection(state, selDir);
  }

  return `
    <div style="padding: 16px; display:flex; flex-direction:column; gap:14px;">
      <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px;">
        <div>
          <div class="font-mono" style="font-size:10.5px; letter-spacing:0.16em; color:var(--accent-gold);">КАРТА ЖИЗНИ · НАВИГАЦИЯ ПО ВОЗМОЖНОМУ БУДУЩЕМУ</div>
          <h1 class="font-display" style="margin:3px 0 0; font-size:20px;">Мир направлений (${state.directions.length})</h1>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn-ghost" data-action="open-add-direction">${LG_ICONS.plus} Новая сфера</button>
          ${selDir ? `<button type="button" class="btn-ghost" data-action="open-edit-direction" data-dir-id="${escapeHtml(selDir.id)}">✎ Настроить «${escapeHtml(selDir.short)}»</button>` : ''}
        </div>
      </div>

      <div class="pill-row">
        ${subTabs.map(t => `
          <button type="button" class="chip ${UI.mapSubTab === t.id ? 'active' : ''}" data-action="set-map-subtab" data-subtab="${t.id}">
            ${t.label}
          </button>
        `).join('')}
      </div>

      ${bodyHtml}
    </div>
  `;
}

function renderBigMapSection(state, selDir) {
  const dirs = state.directions;
  // SVG links + honest road / broken mist vectors from territory to LVMG beacon
  let svgLines = '';

  if (state.showMapLinks) {
    (state.mapLinks || []).forEach(([aId, bId]) => {
      const a = dirs.find(x => x.id === aId);
      const b = dirs.find(x => x.id === bId);
      if (a && b) {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 - 26;
        svgLines += `<path d="M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1.6" stroke-dasharray="4 5"/>`;
      }
    });
  }

  dirs.forEach(d => {
    const bx = d.beaconX || d.x;
    const by = d.beaconY || Math.max(80, d.y - 240);
    // Vector from territory toward distant LVMG beacon:
    // Solid halfway to Optimal, then broken/mist gap if routeKnownToLvmg is false!
    const midX = (d.x + bx) / 2;
    const midY = (d.y + by) / 2;
    svgLines += `<line x1="${d.x}" y1="${d.y}" x2="${midX}" y2="${midY}" stroke="${escapeHtml(d.color)}" stroke-opacity="0.42" stroke-width="2.2"/>`;
    if (d.routeKnownToLvmg) {
      svgLines += `<line x1="${midX}" y1="${midY}" x2="${bx}" y2="${by}" stroke="${escapeHtml(d.color)}" stroke-opacity="0.32" stroke-width="1.8" stroke-dasharray="6 4"/>`;
    } else {
      // Honest unknown gap ("военная база в GTA": point known, road unknown!)
      svgLines += `<circle cx="${midX}" cy="${midY}" r="4" fill="#18181b" stroke="${escapeHtml(d.color)}" stroke-width="1.5"/>`;
      svgLines += `<line x1="${midX}" y1="${midY}" x2="${bx}" y2="${by}" stroke="rgba(255,218,41,0.22)" stroke-width="1.2" stroke-dasharray="2 11"/>`;
    }
  });

  const nodesHtml = dirs.map(d => {
    const isSel = selDir && d.id === selDir.id;
    const isWp = state.waypointDirectionId === d.id;
    const bx = d.beaconX || d.x;
    const by = d.beaconY || Math.max(80, d.y - 240);
    const farClass = (d.horizonRing === 'fog' || d.status === 'paused') ? 'far-node' : '';

    return `
      <div class="lvmg-star far-node ${isSel ? 'selected' : ''}" style="left:${bx}px; top:${by}px;" data-action="select-map-dir" data-dir-id="${escapeHtml(d.id)}" title="Маяк LVMG: ${escapeHtml(d.lvmg)}">
        ✦ LVMG · ${escapeHtml(d.short)} ${d.routeKnownToLvmg ? '' : '· 🌫 путь не открыт'}
      </div>
      <div class="territory-node ${farClass} ${isSel ? 'selected' : ''}" style="left:${d.x}px; top:${d.y}px;" data-action="select-map-dir" data-dir-id="${escapeHtml(d.id)}">
        <div class="territory-orb" style="border-color:${escapeHtml(d.color)}; box-shadow: 0 0 ${isSel ? '28px' : '14px'} ${escapeHtml(d.color)}44;">
          ${d.status === 'active' ? `<div class="pulse-ring" style="border-color:${escapeHtml(d.color)};"></div>` : ''}
          <span style="color:${escapeHtml(d.color)}; display:flex;">${LG_ICONS[d.icon] || LG_ICONS.sparkles}</span>
          ${isWp ? `<span style="position:absolute; top:-8px; right:-8px; background:#ffda29; color:#090909; font-size:10px; font-weight:800; border-radius:99px; padding:1px 6px;">🎯</span>` : ''}
        </div>
        <div style="background:rgba(10,10,14,0.88); border:1px solid rgba(255,255,255,0.12); padding:3px 9px; border-radius:999px; font-size:11.5px; font-weight:700; color:#f5f5f7; white-space:nowrap;">
          ${escapeHtml(d.short)} ${d.status === 'oasis' ? '🌿' : ''}
        </div>
        <div style="font-size:10px; color:#a1a1aa; max-width:145px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${escapeHtml(d.terrain)}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between;">
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button type="button" class="btn-ghost" data-action="map-zoom" data-delta="0.15">＋ Приблизить</button>
        <button type="button" class="btn-ghost" data-action="map-zoom" data-delta="-0.15">－ Отдалить</button>
        <button type="button" class="btn-ghost" data-action="map-reset-view">⌖ Центрировать</button>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button type="button" class="chip ${state.mapVisualStyle === 'lens' ? 'active' : ''}" data-action="toggle-map-lens">
          🔭 Режим «Линза и боке»
        </button>
        <button type="button" class="chip ${state.showMapLinks ? 'active' : ''}" data-action="toggle-map-links">
          🕸 Связи сфер
        </button>
      </div>
    </div>

    <div id="bigMapViewport" class="map-viewport ${state.mapVisualStyle === 'lens' ? 'lens-mode' : ''}">
      <div style="position:absolute; top:10px; left:12px; z-index:12; pointer-events:none; background:rgba(9,9,11,0.78); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:6px 10px; font-size:11px; color:#d4d4d8;">
        Перетаскивай карту мышью/пальцем · Маяки LVMG вверху у открытого края · Разрыв пунктира = честное неизвестное
      </div>
      <div id="bigMapCanvas" class="map-canvas" style="transform: translate(${UI.mapPanX}px, ${UI.mapPanY}px) scale(${UI.mapScale});">
        <div style="position:absolute; top:12px; left:0; right:0; text-align:center; font-size:11px; letter-spacing:0.22em; color:rgba(253,230,138,0.45); font-family:var(--font-mono);">
          ↑ ОТКРЫТЫЙ ГОРИЗОНТ ЗА LVMG · ГРАНИЦА ЖИЗНИ НЕ ЗАМКНУТА ↑
        </div>
        <svg width="920" height="860" viewBox="0 0 920 860" style="position:absolute; inset:0; pointer-events:none;">
          ${svgLines}
        </svg>
        ${nodesHtml}
      </div>
    </div>

    ${selDir ? `
      <div class="card" style="border-color:${escapeHtml(selDir.color)}55;">
        <div style="display:flex; flex-wrap:wrap; align-items:flex-start; justify-content:space-between; gap:10px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span style="color:${escapeHtml(selDir.color)}; display:inline-flex;">${LG_ICONS[selDir.icon] || LG_ICONS.sparkles}</span>
              <strong class="font-display" style="font-size:16px;">${escapeHtml(selDir.name)}</strong>
              ${natureBadgeHtml(selDir.nature, selDir.status)}
              ${state.waypointDirectionId === selDir.id ? '<span class="badge badge-gold">🎯 Точка внимания</span>' : ''}
            </div>
            <div style="margin-top:8px; display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:8px; font-size:12.5px;">
              <div class="card-subtle">
                <div class="font-mono" style="font-size:10px; color:var(--text-muted);">🪨 ФАКТ (ЧТО УЖЕ ЕСТЬ / УМЕЮ)</div>
                <div style="margin-top:3px;">${escapeHtml(selDir.fact)}</div>
              </div>
              <div class="card-subtle" style="border-color:rgba(255,218,41,0.3);">
                <div class="font-mono" style="font-size:10px; color:var(--accent-gold);">🔥 СЕЙЧАС В РАБОТЕ (ЭТАП)</div>
                <div style="margin-top:3px; font-weight:600;">${escapeHtml(selDir.currentStage.title)}</div>
              </div>
              <div class="card-subtle" style="border-color:rgba(132,204,22,0.3);">
                <div class="font-mono" style="font-size:10px; color:var(--accent-oasis);">🌿 ОАЗИС ОПТИМУМА (ДОСТАТОЧНОСТЬ)</div>
                <div style="margin-top:3px;">${escapeHtml(selDir.optimal)}</div>
              </div>
              <div class="card-subtle">
                <div class="font-mono" style="font-size:10px; color:#fde68a;">✦ МАЯК LVMG (${selDir.routeKnownToLvmg ? 'путь понятен' : 'путь пока неизвестен'})</div>
                <div style="margin-top:3px;">${escapeHtml(selDir.lvmg)}</div>
              </div>
            </div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; width:100%; justify-content:flex-end; margin-top:4px;">
            <button type="button" class="btn-ghost" data-action="set-waypoint" data-dir-id="${escapeHtml(selDir.id)}">
              🎯 ${state.waypointDirectionId === selDir.id ? 'Ориентир установлен' : 'Поставить ориентир внимания'}
            </button>
            <button type="button" class="btn-primary" data-action="open-dir-ascent" data-dir-id="${escapeHtml(selDir.id)}">
              Открыть путь восхождения ↑
            </button>
          </div>
        </div>
      </div>
    ` : ''}
  `;
}

function renderMiniMapSection(state, selDir) {
  const filterOptions = [
    { id: 'all', label: 'Все сферы' },
    { id: 'now', label: 'Сейчас в работе' },
    { id: 'oasis', label: 'Оазис достаточности' },
    { id: 'fog', label: 'Пауза / Защита' }
  ];

  const filtered = UI.miniFilter === 'all'
    ? state.directions
    : state.directions.filter(d => (UI.miniFilter === 'oasis' ? d.status === 'oasis' : d.horizonRing === UI.miniFilter));

  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px; align-items:start;">
      <div class="card" style="text-align:center;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span class="font-mono" style="font-size:11px; color:var(--accent-gold);">📡 МИНИ-КАРТА · ГДЕ Я СЕЙЧАС</span>
          <button type="button" class="chip ${state.showMiniRadarOnToday ? 'active' : ''}" data-action="toggle-radar-on-today">
            ${state.showMiniRadarOnToday ? '✓ Показан на Сегодня' : '+ Показать на Сегодня'}
          </button>
        </div>
        ${renderMiniRadarWidget(state, false)}
        <div style="font-size:11.5px; color:var(--text-muted); margin-top:6px;">
          Центр — активная работа сейчас · Среднее кольцо — переход и оазис · Внешний контур — бережная пауза и защита. Никакого искусственного «общего уровня личности».
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px;">
        <div class="pill-row">
          ${filterOptions.map(f => `
            <button type="button" class="chip ${UI.miniFilter === f.id ? 'active' : ''}" data-action="set-mini-filter" data-filter="${f.id}">
              ${f.label}
            </button>
          `).join('')}
        </div>

        ${filtered.map(d => `
          <div class="card" style="padding:11px 13px; border-left:3px solid ${escapeHtml(d.color)}; cursor:pointer;" data-action="open-dir-ascent" data-dir-id="${escapeHtml(d.id)}">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="color:${escapeHtml(d.color)}; display:inline-flex;">${LG_ICONS[d.icon] || LG_ICONS.sparkles}</span>
                <strong>${escapeHtml(d.name)}</strong>
              </div>
              ${natureBadgeHtml(d.nature, d.status)}
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:5px;">
              <strong>Факт:</strong> ${escapeHtml(d.fact)}
            </div>
            <div style="font-size:12px; color:var(--text-main); margin-top:3px;">
              <strong>Сейчас:</strong> ${escapeHtml(d.currentStage.title)} → <span style="color:var(--accent-gold);">Открыть путь ↑</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderAscentPathSection(state, d) {
  if (!d) return '<div class="card">Выбери жизненное направление.</div>';

  const dirItems = state.items.filter(it => it.directionId === d.id && it.status === 'active');
  const showFolded = !!UI.expandedFoldedDirs[d.id];

  // IMPORTANT AUTHORIAL PRINCIPLE: Ascent goes from BOTTOM (1. Fact) UPWARD to TOP (7. Beyond LVMG)!
  // So visually at the top of the trajectory is Open Sky -> LVMG Beacon -> Unknown Gap -> Optimum Oasis -> Folded/Next -> Current Stage -> Solid Fact Foundation at the base!
  return `
    <div class="pill-row">
      ${state.directions.map(item => `
        <button type="button" class="chip ${item.id === d.id ? 'active' : ''}" data-action="select-path-dir" data-dir-id="${escapeHtml(item.id)}">
          ${escapeHtml(item.short)}
        </button>
      `).join('')}
    </div>

    <div class="card" style="background: linear-gradient(180deg, rgba(255,218,41,0.06) 0%, transparent 28%), var(--bg-panel);">
      <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; padding-bottom:12px; border-bottom:1px solid var(--border-subtle);">
        <div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="color:${escapeHtml(d.color)}; display:inline-flex;">${LG_ICONS[d.icon] || LG_ICONS.sparkles}</span>
            <h2 class="font-display" style="margin:0; font-size:18px;">${escapeHtml(d.name)}</h2>
            ${natureBadgeHtml(d.nature, d.status)}
          </div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
            Геометрия восхождения <strong>снизу вверх ↑</strong>: от твёрдого факта внизу — через текущий этап к оазису достаточности и открытому небу за LVMG.
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="chip ${state.strictStageMode ? 'active' : ''}" data-action="toggle-strict-stage" title="Опциональное правило: действовать только внутри текущего освоенного этапа">
            ${state.strictStageMode ? '🔒 Строго внутри этапа' : '🔓 Свободные шаги разрешены'}
          </button>
          <button type="button" class="btn-ghost" data-action="open-edit-direction" data-dir-id="${escapeHtml(d.id)}">✎ Редактировать этапы</button>
        </div>
      </div>

      <div class="ascent-track">
        <!-- 7. TOP: OPEN HORIZON BEYOND LVMG -->
        <div style="text-align:center; padding:10px 14px; border-radius:16px; border:1px dashed rgba(253,230,138,0.28); background:radial-gradient(circle at 50% 0%, rgba(255,218,41,0.12), transparent 75%);">
          <div class="font-mono" style="font-size:10px; letter-spacing:0.18em; color:#fde68a;">7 · ЗА ПРЕДЕЛАМИ LVMG · ОТКРЫТЫЙ КРАЙ КАРТЫ ↑</div>
          <div style="font-size:12.5px; color:var(--text-muted); margin-top:3px;">${escapeHtml(d.beyond)}</div>
        </div>

        <div class="ascent-connector broken"></div>

        <!-- 6. LVMG BEACON -->
        <div class="card-subtle" style="border:1px dashed rgba(255,218,41,0.48); background:rgba(255,218,41,0.04);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="badge badge-gold">6 · Маяк LVMG (вообразимый максимум)</span>
            <span class="font-mono" style="font-size:11px; color:var(--text-muted);">
              ${d.routeKnownToLvmg ? 'Маршрут просматривается' : 'Метафора GTA: точка видна, дороги пока нет'}
            </span>
          </div>
          <div style="font-size:14px; font-weight:700; margin-top:6px;">✦ ${escapeHtml(d.lvmg)}</div>
          <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px;">Не является обязательством или оценкой ценности жизни — это ориентир воображения.</div>
        </div>

        <div class="ascent-connector broken"></div>

        <!-- 5. HONEST UNKNOWN GAP (KIND OF HIDDEN #2) -->
        <div class="card-subtle" style="border-style:dashed; background:rgba(148,163,184,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="badge badge-muted">5 · Полоса Неизвестного (вид скрытого №2 — маршрута ещё нет)</span>
            <button type="button" class="btn-ghost" style="padding:4px 9px; font-size:11px;" data-action="open-edit-direction" data-dir-id="${escapeHtml(d.id)}">+ Записать гипотезу</button>
          </div>
          <div style="font-size:12.5px; color:var(--text-muted); margin-top:6px;">${escapeHtml(d.unknownGap)}</div>
        </div>

        <div class="ascent-connector"></div>

        <!-- 4. OPTIMAL OASIS (SUFFICIENCY, NOT FAILURE!) -->
        <div class="card-subtle" style="border:1.5px solid rgba(132,204,22,0.55); background:rgba(132,204,22,0.07);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="badge badge-oasis">4 · Оптимальный ориентир — Оазис достаточности 🌿</span>
            <button type="button" class="btn-ghost" style="padding:4px 10px; font-size:11px;" data-action="toggle-oasis-status" data-dir-id="${escapeHtml(d.id)}">
              ${d.status === 'oasis' ? '✓ Я уже в оазисе покоя' : 'Отметить оазис достигнутым'}
            </button>
          </div>
          <div style="font-size:14px; font-weight:700; margin-top:6px;">${escapeHtml(d.optimal)}</div>
          <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px;">Устраивающее хорошее состояние, где можно с радостью остановиться и просто поддерживать ритм.</div>
        </div>

        <div class="ascent-connector"></div>

        <!-- 3. NEXT STAGE + FOLDED KNOWN STAGES (KIND OF HIDDEN #1) -->
        <div class="card-subtle">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="badge badge-muted">3 · Следующий различимый этап</span>
            ${(d.foldedStages && d.foldedStages.length > 0) ? `
              <button type="button" class="btn-ghost" style="padding:3px 9px; font-size:11px;" data-action="toggle-folded-stages" data-dir-id="${escapeHtml(d.id)}">
                ${showFolded ? 'Свернуть известные этапы ▲' : `Раскрыть ещё ${d.foldedStages.length} известных этапа ▼ (вид скрытого №1)`}
              </button>
            ` : ''}
          </div>
          <div style="font-size:13.5px; font-weight:600; margin-top:6px;">${escapeHtml(d.nextStage)}</div>
          ${showFolded && d.foldedStages && d.foldedStages.length ? `
            <ul style="margin:8px 0 0; padding-left:18px; font-size:12.5px; color:var(--text-muted);">
              ${d.foldedStages.map(st => `<li>${escapeHtml(st)}</li>`).join('')}
            </ul>
          ` : ''}
        </div>

        <div class="ascent-connector"></div>

        <!-- 2. CURRENT WORKING STAGE (WITH STAGE STRATEGY & LIVE ACTIONS!) -->
        <div class="card" style="border:2px solid var(--accent-gold); box-shadow: 0 0 26px var(--accent-gold-soft);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="badge badge-gold">2 · СЕЙЧАС В РАБОТЕ · ВНУТРИ ЭТАПА</span>
            <button type="button" class="btn-primary" style="padding:5px 11px; font-size:11.5px;" data-action="quick-add-to-stage" data-dir-id="${escapeHtml(d.id)}">
              ${LG_ICONS.plus} Добавить действие в этап
            </button>
          </div>
          <div class="font-display" style="font-size:16px; font-weight:700; margin-top:8px;">${escapeHtml(d.currentStage.title)}</div>
          <div style="font-size:12.5px; color:var(--text-muted); margin-top:4px;">
            <strong>Внутренняя стратегия этапа:</strong> ${escapeHtml(d.currentStage.strategy)}
          </div>

          ${(d.currentStage.goals && d.currentStage.goals.length) ? `
            <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
              ${d.currentStage.goals.map(g => `<span class="badge badge-muted">🎯 Цель: ${escapeHtml(g)}</span>`).join('')}
            </div>
          ` : ''}

          <div style="margin-top:10px; border-top:1px solid var(--border-subtle); padding-top:9px;">
            <div class="font-mono" style="font-size:10.5px; color:var(--text-muted); margin-bottom:6px;">ДЕЙСТВИЯ ЭТОГО НАПРАВЛЕНИЯ (${dirItems.length}):</div>
            ${dirItems.length === 0 ? `<div style="font-size:12px; color:var(--text-dim);">Пока нет активных действий — добавь посильный шаг кнопкой выше.</div>` : `
              <div style="display:flex; flex-direction:column; gap:6px;">
                ${dirItems.map(it => {
                  const eff = getItemEffortSummary(state, it.id);
                  return `
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; background:var(--bg-void); padding:7px 10px; border-radius:10px; border:1px solid var(--border-subtle);">
                      <div>
                        <span style="font-weight:600; font-size:12.5px;">${escapeHtml(it.title)}</span>
                        <span style="font-size:11px; color:var(--text-muted); margin-left:6px;">(${eff.totalWeekMinutes} мин за 7 дн.)</span>
                      </div>
                      <button type="button" class="chip ${eff.todayDone ? 'active' : ''}" data-action="toggle-complete" data-item-id="${escapeHtml(it.id)}">
                        ${eff.todayDone ? '✓ Выполнено' : 'Отметить'}
                      </button>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>

        <div class="ascent-connector"></div>

        <!-- 1. BASE: SOLID FACTUAL POSITION (NEVER CONFUSED WITH WORK!) -->
        <div class="card-subtle" style="border:2px solid rgba(148,163,184,0.42); background:rgba(30,41,59,0.28);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span class="badge badge-muted">1 · ФАКТИЧЕСКОЕ ПОЛОЖЕНИЕ · ТВЁРДАЯ ОПОРА ВНИЗУ 🪨</span>
            <span class="font-mono" style="font-size:10.5px; color:var(--text-muted);">СТАРТ ВОСХОЖДЕНИЯ ↑</span>
          </div>
          <div style="font-size:13.5px; font-weight:600; margin-top:6px;">${escapeHtml(d.fact)}</div>
          <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px;">То, что уже объективно освоено и есть на самом деле (не смешивается с текущей учёбой).</div>
        </div>
      </div>
    </div>
  `;
}
