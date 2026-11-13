// LifeGame Hybrid v1.0 — Главная оболочка, переключение [Лайт | Про], обработчики всех комнат и шторок

const IS_FIRST_BOOT = (() => {
  try { return !window.localStorage.getItem(HYBRID_KEYS.meta); } catch (e) { return false; }
})();

const META_STATE = loadJsonSafe(HYBRID_KEYS.meta, () => ({
  space: 'my',
  wide: false,
  welcomed: false
}));

const APP_UI = {
  space: META_STATE.space || 'demo',
  wide: !!META_STATE.wide,
  room: 'home',
  calSub: 'upcoming',
  mapSub: 'big',
  selectedDirId: 'craft',
  panX: -145,
  panY: -135,
  zoom: 0.72,
  questsSub: 'quests',
  bonusSub: 'shop',
  eveningMood: 'calm',
  eveningDraft: '',
  recording: false,
  aiOpts: {
    mode: 'daily',
    format: 'json',
    catStrategy: true,
    catActions: true,
    catReflections: true,
    selectedDirs: [],
    fromDate: '',
    toDate: '',
    maxChars: 35000,
    consent: false
  },
  aiReplyRaw: '',
  aiProposals: [],
  currentSpark: HAPPINESS_POOL[0],
  timer: null,
  timerInterval: null,
  sheet: null,
  undoStack: [],
  dragNodes: false,
  searchQuery: '',
  welcomed: !!META_STATE.welcomed,
  notifiedKeys: {},
  welcomeForm: {
    mode: 'lite',
    habitTitle: '20 минут спокойного фокуса на главном деле',
    rewardTitle: 'Любимый кофе и полчаса с книгой без спешки'
  },
  addForm: {
    title: '',
    kind: 'habit',
    norm: 1,
    dateMode: 'none',
    customDate: '',
    dirId: 'craft'
  }
};

function currentStorageKey() {
  return APP_UI.space === 'my' ? HYBRID_KEYS.my : HYBRID_KEYS.demo;
}

let S_DATA = loadJsonSafe(
  currentStorageKey(),
  APP_UI.space === 'my' ? buildCleanHybridState : buildDemoHybridState
);

function persistAll() {
  runWithLock(() => {
    saveJsonSafe(currentStorageKey(), S_DATA);
    saveJsonSafe(HYBRID_KEYS.meta, { space: APP_UI.space, wide: APP_UI.wide, welcomed: APP_UI.welcomed });
  });
}

let toastTimeout = null;
function pushUndoSnapshot(label) {
  APP_UI.undoStack.push({ label, state: safeClone(S_DATA) });
  if (APP_UI.undoStack.length > 6) APP_UI.undoStack.shift();
}

function showToast(msg, withUndo) {
  const host = document.getElementById('toastHost');
  if (!host) return;
  const undoBtn = (withUndo && APP_UI.undoStack.length)
    ? `<button type="button" class="toast-undo-btn" data-act="undo-last">↩ Отменить</button>`
    : '';
  host.innerHTML = `<div class="toast-pill"><span>${esc(msg)}</span>${undoBtn}</div>`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    host.innerHTML = '';
  }, withUndo ? 4500 : 2600);
}

function applyRootAttributes() {
  document.documentElement.setAttribute('data-theme', S_DATA.theme || 'night');
  document.body.classList.toggle('wide-layout', !!APP_UI.wide);
}

function syncDraftInputsBeforeRender() {
  const evArea = document.getElementById('eveningNoteArea');
  if (evArea) APP_UI.eveningDraft = evArea.value;
  const aiArea = document.getElementById('aiReplyInput');
  if (aiArea) APP_UI.aiReplyRaw = aiArea.value;
  if (APP_UI.sheet && APP_UI.sheet.name === 'welcome') {
    const wh = document.getElementById('wfHabit');
    const wr = document.getElementById('wfReward');
    if (wh) APP_UI.welcomeForm.habitTitle = wh.value;
    if (wr) APP_UI.welcomeForm.rewardTitle = wr.value;
  }
  if (APP_UI.sheet && APP_UI.sheet.name === 'quick-add') {
    const tEl = document.getElementById('qaTitle');
    const nEl = document.getElementById('qaNorm');
    const dEl = document.getElementById('qaDir');
    const cEl = document.getElementById('qaCustomDate');
    if (tEl) APP_UI.addForm.title = tEl.value;
    if (nEl) APP_UI.addForm.norm = Math.max(1, Math.min(50, Number(nEl.value) || 1));
    if (dEl) APP_UI.addForm.dirId = dEl.value;
    if (cEl) APP_UI.addForm.customDate = cEl.value;
  }
}

function renderSpecialModeBanner(state) {
  if (state.calcMode === 'lite' || state.specialMode === 'none') return '';
  if (state.specialMode === 'red') {
    const redDir = state.directions.find(d => d.id === state.redConfig.directionId);
    const careDone = Object.values(state.redConfig.care || {}).filter(Boolean).length;
    return `
      <div class="mode-strip">
        <span>🔴 <strong>Красный режим:</strong> ${esc(redDir ? redDir.short : 'Фокус')} · забота ${careDone}/3</span>
        <button type="button" class="icon-btn" data-act="open-room" data-room="settings">Настроить</button>
      </div>
    `;
  }
  if (state.specialMode === 'pause') {
    return `
      <div class="mode-strip pause">
        <span>🎨 <strong>Творческая пауза:</strong> все планы заморожены без пропусков</span>
        <button type="button" class="icon-btn" data-act="exit-special-mode">Вернуться</button>
      </div>
    `;
  }
  return '';
}

function renderActiveView(state) {
  const r = APP_UI.room;
  if (r === 'home') {
    return state.calcMode === 'lite' ? renderHomeLiteScreen(state) : renderHomeProScreen(state);
  }
  if (r === 'lite-rhythm') return renderLiteRhythmRoom(state);
  if (r === 'day-constructor') return renderProDayConstructorRoom(state);
  if (r === 'calendar') return renderCalendarRoom(state);
  if (r === 'map') return renderMapRoom(state);
  if (r === 'quests') return renderQuestsAndItemsRoom(state);
  if (r === 'bonuses') return renderBonusesRoom(state);
  if (r === 'inbox') {
    return `
      <div class="content-col">
        ${renderRoomHeader('Входящие мысли', 'Быстрая разгрузка головы без обязательств')}
        ${renderInboxContent(state)}
      </div>
    `;
  }
  if (r === 'review') return renderReviewRoom(state);
  if (r === 'ai') return renderAiRoom(state);
  if (r === 'treats') return renderTreatsRoom(state);
  if (r === 'widgets') return renderWidgetsRoom(state);
  if (r === 'settings') return renderSettingsRoom(state);
  return state.calcMode === 'lite' ? renderHomeLiteScreen(state) : renderHomeProScreen(state);
}

function renderBottomTabsPro(state) {
  if (state.calcMode === 'lite') return '';
  const activeTab = (
    APP_UI.room === 'map' ? 'map' :
    (APP_UI.room === 'quests' ? 'quests' :
    (APP_UI.room === 'bonuses' ? 'bonuses' : 'home'))
  );
  const tabs = [
    ['home', 'Главная', HYB_ICONS.homeTab],
    ['map', 'Карта', HYB_ICONS.mapTab],
    ['quests', 'Квесты', HYB_ICONS.questTab],
    ['bonuses', 'Бонусы', HYB_ICONS.spark]
  ];
  return `
    <nav class="bottom-bar" aria-label="Навигация Про">
      ${tabs.map(([id, lbl, ic]) => `
        <button type="button" class="tab-item ${activeTab === id ? 'active' : ''}" data-act="nav-tab" data-tab="${id}">
          ${ic}
          <span>${lbl}</span>
        </button>
      `).join('')}
    </nav>
  `;
}

function renderHybridApp() {
  applyRootAttributes();
  const root = document.getElementById('appRoot');
  if (!root) return;
  const isLite = S_DATA.calcMode === 'lite';

  root.innerHTML = `
    <div class="phone-shell ${isLite ? 'no-bottom-nav' : ''}">
      <header class="app-header">
        <button type="button" class="brand-mark" data-act="go-home" title="На Главную">
          <span class="brand-dot"></span>
          <span>LIFE / GAME</span>
        </button>

        <div style="display:flex; align-items:center; gap:8px;">
          <div class="calc-switch" role="group" aria-label="Режим калькулятора">
            <button type="button" class="calc-btn ${isLite ? 'active' : ''}" data-act="set-calc-mode" data-mode="lite">Лайт</button>
            <button type="button" class="calc-btn ${!isLite ? 'active' : ''}" data-act="set-calc-mode" data-mode="pro">Про</button>
          </div>
          <button type="button" class="coin-pill" data-act="open-room" data-room="bonuses" title="Открыть бонусы и вознаграждения">
            <span>${S_DATA.wallet.coins}</span>
            <span>●</span>
          </button>
        </div>
      </header>

      ${renderSpecialModeBanner(S_DATA)}

      <main id="mainStage">
        ${renderActiveView(S_DATA)}
      </main>
    </div>

    ${renderBottomTabsPro(S_DATA)}
    ${renderSheetModal(S_DATA)}
  `;

  bindMapViewportPan();
}

function bindMapViewportPan() {
  const vp = document.getElementById('hybridMapViewport');
  const cv = document.getElementById('hybridMapCanvas');
  if (!vp || !cv) return;

  let dragging = false;
  let startX = 0, startY = 0, origX = 0, origY = 0;

  vp.onpointerdown = (ev) => {
    const nodeEl = ev.target.closest('.map-node[data-id]');
    if (APP_UI.dragNodes && nodeEl) {
      const dirObj = S_DATA.directions.find(d => d.id === nodeEl.dataset.id);
      if (dirObj) {
        let sx = ev.clientX, sy = ev.clientY, ox = dirObj.x, oy = dirObj.y;
        try { vp.setPointerCapture(ev.pointerId); } catch (e) {}
        vp.onpointermove = (mev) => {
          dirObj.x = Math.max(80, Math.min(780, Math.round(ox + (mev.clientX - sx) / APP_UI.zoom)));
          dirObj.y = Math.max(180, Math.min(760, Math.round(oy + (mev.clientY - sy) / APP_UI.zoom)));
          dirObj.beaconX = dirObj.x;
          nodeEl.style.left = dirObj.x + 'px';
          nodeEl.style.top = dirObj.y + 'px';
        };
        vp.onpointerup = () => {
          vp.onpointermove = null;
          persistAll();
          renderHybridApp();
        };
        return;
      }
    }
    if (ev.target.closest('[data-act]')) return;
    dragging = true;
    startX = ev.clientX;
    startY = ev.clientY;
    origX = APP_UI.panX;
    origY = APP_UI.panY;
    try { vp.setPointerCapture(ev.pointerId); } catch (e) {}
  };
  vp.onpointermove = (ev) => {
    if (!dragging) return;
    APP_UI.panX = Math.max(-560, Math.min(180, origX + (ev.clientX - startX)));
    APP_UI.panY = Math.max(-520, Math.min(180, origY + (ev.clientY - startY)));
    cv.style.transform = `translate(${APP_UI.panX}px, ${APP_UI.panY}px) scale(${APP_UI.zoom})`;
  };
  vp.onpointerup = () => { dragging = false; };
  vp.onpointercancel = () => { dragging = false; };
}

function advanceSystemDate(daysDelta) {
  const steps = Math.max(1, Number(daysDelta) || 1);
  for (let s = 0; s < steps; s++) {
    const prevDate = S_DATA.currentDate;
    if (S_DATA.specialMode !== 'pause' && S_DATA.calcMode !== 'lite' && !S_DATA.liteFreezeActive) {
      const occs = getCalendarOccurrencesOnDate(S_DATA, prevDate);
      occs.forEach(occ => {
        if (!occ.done) {
          const missKey = occ.ev.id + ':' + occ.occurrenceKey;
          if (!S_DATA.misses.some(m => m.missKey === missKey)) {
            S_DATA.misses.push({
              id: genId('ms'),
              missKey,
              evId: occ.ev.id,
              title: occ.ev.title,
              date: prevDate
            });
          }
        }
      });
    }
    const nextDate = addDaysISO(prevDate, 1);
    S_DATA.items.forEach(it => {
      if (it.pendingNorm && it.pendingNorm.from <= nextDate) {
        it.dailyNorm = it.pendingNorm.target;
        delete it.pendingNorm;
      }
    });
    S_DATA.redConfig.care = { sleep: false, water: false, rest: false };
    S_DATA.currentDate = nextDate;
  }
  APP_UI.aiOpts.toDate = S_DATA.currentDate;
  APP_UI.aiOpts.fromDate = addDaysISO(S_DATA.currentDate, -6);
  persistAll();
  renderHybridApp();
}

window.advanceHybridDay = advanceSystemDate;

function switchCalculatorMode(nextMode) {
  if (nextMode !== 'lite' && nextMode !== 'pro') return;
  if (S_DATA.calcMode === nextMode) return;
  S_DATA.flexChanges.push({ date: S_DATA.currentDate, from: S_DATA.calcMode, to: nextMode });
  if (nextMode === 'lite') {
    S_DATA.calcMode = 'lite';
    S_DATA.liteFreezeActive = true;
    if (APP_UI.room === 'day-constructor') APP_UI.room = 'lite-rhythm';
    else if (['map', 'quests', 'ai', 'widgets'].includes(APP_UI.room)) APP_UI.room = 'home';
    showToast('Включён Лайт: ритм и бонусы активны, остальное бережно на паузе');
  } else {
    S_DATA.calcMode = 'pro';
    if (APP_UI.room === 'lite-rhythm') APP_UI.room = 'day-constructor';
    showToast('Включён Про: полный Конструктор, Карта жизни и инструменты');
  }
  persistAll();
  renderHybridApp();
}

function grantLinkedBonusIfAny(bonusId, sourceTitle) {
  if (!bonusId) return '';
  const b = S_DATA.bonuses.find(x => x.id === bonusId);
  if (!b) return '';
  S_DATA.ownedBonuses.unshift({
    id: genId('ob'),
    bonusId: b.id,
    title: `${b.title} (приз: ${sourceTitle})`,
    paidCost: 0,
    date: S_DATA.currentDate,
    used: false,
    refunded: false
  });
  return ` + приз «${b.title}»!`;
}

// Delegated Click Handler
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;

  if (act === 'backdrop-close') {
    if (ev.target !== el) return;
    APP_UI.sheet = null;
    renderHybridApp();
    return;
  }

  syncDraftInputsBeforeRender();

  switch (act) {

    case 'undo-last': {
      const last = APP_UI.undoStack.pop();
      if (last && last.state) {
        S_DATA = last.state;
        persistAll();
        renderHybridApp();
        showToast('Действие отменено ↩');
      }
      break;
    }

    case 'save-item-edits': {
      const it = S_DATA.items.find(x => x.id === el.dataset.id);
      if (!it) break;
      pushUndoSnapshot('edit-item');
      const nt = (document.getElementById('editItemTitle')?.value || '').trim();
      if (nt) it.title = nt;
      it.directionId = document.getElementById('editItemDir')?.value || it.directionId;
      it.locationId = document.getElementById('editItemLoc')?.value || 'any';
      it.tempoMin = document.getElementById('editItemTempo')?.value || 'normal';
      it.coins = Math.max(1, Math.min(300, Number(document.getElementById('editItemCoins')?.value) || 10));
      it.xp = it.coins;
      const ndue = document.getElementById('editItemDue')?.value || '';
      it.dueDate = ndue ? ndue : null;
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Изменения дела сохранены', true);
      break;
    }

    case 'archive-item': {
      const it = S_DATA.items.find(x => x.id === el.dataset.id);
      if (!it) break;
      pushUndoSnapshot('archive-item');
      it.status = 'archived';
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Дело перенесено в архив (история сохранена)', true);
      break;
    }

    case 'delete-item': {
      pushUndoSnapshot('delete-item');
      S_DATA.items = S_DATA.items.filter(x => x.id !== el.dataset.id);
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Дело удалено', true);
      break;
    }

    case 'cancel-cal-occ': {
      const evObj = S_DATA.calendar.find(c => c.id === el.dataset.id);
      if (!evObj) break;
      pushUndoSnapshot('cancel-occ');
      const occ = el.dataset.occ || S_DATA.currentDate;
      evObj.exceptions = evObj.exceptions || {};
      evObj.exceptions[occ] = { movedTo: occ, cancelled: true };
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Появление в эту дату пропущено', true);
      break;
    }

    case 'delete-cal': {
      pushUndoSnapshot('delete-cal');
      S_DATA.calendar = S_DATA.calendar.filter(c => c.id !== el.dataset.id);
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Событие удалено из календаря', true);
      break;
    }

    case 'export-ics': {
      const evObj = S_DATA.calendar.find(c => c.id === el.dataset.id);
      if (!evObj) break;
      const ics = buildIcsContent(evObj, el.dataset.occ || evObj.baseDate);
      const a = document.createElement('a');
      a.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
      a.download = `lifegame-event-${evObj.id}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Файл .ics для календаря телефона скачан');
      break;
    }

    case 'save-quest-edits': {
      const q = S_DATA.quests.find(x => x.id === el.dataset.id);
      if (!q) break;
      pushUndoSnapshot('edit-quest');
      const qt = (document.getElementById('eqTitle')?.value || '').trim();
      if (qt) q.title = qt;
      q.coins = Math.max(5, Number(document.getElementById('eqCoins')?.value) || 45);
      q.xp = q.coins + 15;
      q.linkedBonusId = document.getElementById('eqBonus')?.value || null;
      if (q.qtype === 'counter') {
        q.targetCount = Math.max(1, Number(document.getElementById('eqTarget')?.value) || q.targetCount);
      } else {
        const lines = (document.getElementById('eqSteps')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
        if (lines.length) {
          q.steps = lines.map(tx => {
            const old = (q.steps || []).find(s => s.text === tx);
            return old ? old : { id: genId('qs'), text: tx, done: false };
          });
          q.targetCount = q.steps.length;
        }
      }
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Квест обновлён', true);
      break;
    }

    case 'reopen-quest': {
      const q = S_DATA.quests.find(x => x.id === el.dataset.id);
      if (!q) break;
      pushUndoSnapshot('reopen-quest');
      q.status = 'active';
      if (q.qtype === 'counter') q.currentCount = 0;
      else (q.steps || []).forEach(s => { s.done = false; });
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Квест открыт для нового прохождения', true);
      break;
    }

    case 'delete-quest': {
      pushUndoSnapshot('delete-quest');
      S_DATA.quests = S_DATA.quests.filter(x => x.id !== el.dataset.id);
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Квест удалён', true);
      break;
    }

    case 'save-bonus-edits': {
      const b = S_DATA.bonuses.find(x => x.id === el.dataset.id);
      if (!b) break;
      pushUndoSnapshot('edit-bonus');
      const bt = (document.getElementById('ebTitle')?.value || '').trim();
      if (bt) b.title = bt;
      b.cost = Math.max(5, Number(document.getElementById('ebCost')?.value) || b.cost);
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Бонус обновлён', true);
      break;
    }

    case 'delete-bonus': {
      pushUndoSnapshot('delete-bonus');
      S_DATA.bonuses = S_DATA.bonuses.filter(x => x.id !== el.dataset.id);
      if (S_DATA.targetBonusId === el.dataset.id) {
        S_DATA.targetBonusId = S_DATA.bonuses[0] ? S_DATA.bonuses[0].id : null;
      }
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Бонус удалён из магазина', true);
      break;
    }

    case 'save-treat-edits': {
      const tr = S_DATA.treats.find(x => x.id === el.dataset.id);
      if (!tr) break;
      const tx = (document.getElementById('etrText')?.value || '').trim();
      if (tx) tr.text = tx;
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Ништяк обновлён');
      break;
    }

    case 'delete-treat': {
      pushUndoSnapshot('delete-treat');
      S_DATA.treats = S_DATA.treats.filter(x => x.id !== el.dataset.id);
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Ништяк удалён', true);
      break;
    }


    case 'toggle-map-drag':
      APP_UI.dragNodes = !APP_UI.dragNodes;
      renderHybridApp();
      showToast(APP_UI.dragNodes ? 'Перетащи любую сферу пальцем или мышью' : 'Расположение сфер зафиксировано');
      break;

    case 'delete-dir': {
      if (S_DATA.directions.length <= 2) break;
      pushUndoSnapshot('delete-dir');
      const delId = el.dataset.id;
      S_DATA.directions = S_DATA.directions.filter(d => d.id !== delId);
      const fallbackId = S_DATA.directions[0].id;
      S_DATA.items.forEach(i => { if (i.directionId === delId) i.directionId = fallbackId; });
      APP_UI.selectedDirId = fallbackId;
      if (S_DATA.waypointDirId === delId) S_DATA.waypointDirId = fallbackId;
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Сфера удалена, дела перенесены', true);
      break;
    }

    case 'confirm-promote-stage': {
      const d = S_DATA.directions.find(x => x.id === el.dataset.id);
      if (!d) break;
      pushUndoSnapshot('promote-stage');
      d.achievements = d.achievements || [];
      d.achievements.unshift({
        id: genId('ach'),
        title: d.currentStage.title,
        date: S_DATA.currentDate
      });
      const newCur = (document.getElementById('prNewCur')?.value || '').trim() || d.nextStage;
      const newNext = (document.getElementById('prNewNext')?.value || '').trim() || 'Следующий рубеж';
      d.currentStage.title = newCur;
      d.nextStage = newNext;
      S_DATA.wallet.coins += 35;
      S_DATA.wallet.xp += 50;
      S_DATA.facts.push({
        id: genId('fst'),
        kind: 'stage',
        itemId: d.id,
        occurrenceKey: S_DATA.currentDate,
        date: S_DATA.currentDate,
        coins: 35,
        xp: 50
      });
      APP_UI.sheet = null;
      SoundEngine.play('reward');
      persistAll();
      renderHybridApp();
      showToast('Этап завершён и записан в достижения! +35 ● и +50 XP', true);
      break;
    }

    case 'submit-ach': {
      const d = S_DATA.directions.find(x => x.id === el.dataset.id);
      const tx = (document.getElementById('achTitle')?.value || '').trim();
      if (!d || !tx) { showToast('Напиши формулировку достижения'); break; }
      d.achievements = d.achievements || [];
      d.achievements.unshift({ id: genId('ach'), title: tx, date: S_DATA.currentDate });
      S_DATA.wallet.xp += 15;
      APP_UI.sheet = null;
      SoundEngine.play('reward');
      persistAll();
      renderHybridApp();
      showToast('Достижение добавлено в основание сферы (+15 XP)');
      break;
    }

    case 'restore-archived-item': {
      const it = S_DATA.items.find(x => x.id === el.dataset.id);
      if (it) it.status = 'active';
      persistAll();
      renderHybridApp();
      showToast('Дело возвращено из архива');
      break;
    }


    case 'wf-mode':
      APP_UI.welcomeForm.mode = el.dataset.val === 'pro' ? 'pro' : 'lite';
      renderHybridApp();
      break;

    case 'finish-welcome-my': {
      APP_UI.welcomed = true;
      APP_UI.space = 'my';
      S_DATA = buildCleanHybridState();
      S_DATA.calcMode = APP_UI.welcomeForm.mode || 'lite';
      const customHabit = (APP_UI.welcomeForm.habitTitle || '').trim();
      const customReward = (APP_UI.welcomeForm.rewardTitle || '').trim();
      if (customHabit && S_DATA.items[1]) S_DATA.items[1].title = customHabit;
      if (customReward && S_DATA.bonuses[0]) S_DATA.bonuses[0].title = customReward;
      APP_UI.sheet = null;
      APP_UI.room = 'home';
      persistAll();
      renderHybridApp();
      showToast('Добро пожаловать! Твоё личное пространство готово ✨');
      break;
    }

    case 'finish-welcome-demo':
      APP_UI.welcomed = true;
      APP_UI.space = 'demo';
      S_DATA = loadJsonSafe(HYBRID_KEYS.demo, buildDemoHybridState);
      APP_UI.sheet = null;
      APP_UI.room = 'home';
      persistAll();
      renderHybridApp();
      showToast('Открыт «Живой пример» — в Настройках всегда можно перейти в «Мою жизнь»');
      break;

    case 'toggle-reminders': {
      if (!S_DATA.remindersOn && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try { Notification.requestPermission().catch(() => {}); } catch (e) {}
      }
      S_DATA.remindersOn = !S_DATA.remindersOn;
      persistAll();
      renderHybridApp();
      showToast(S_DATA.remindersOn ? 'Напоминания о встречах со временем включены 🔔' : 'Напоминания выключены');
      break;
    }


    case 'copy-week-summary': {
      const summary = buildWeeklyShareSummary(S_DATA);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(summary).catch(() => {});
      }
      showToast('Тёплый итог недели скопирован в буфер 📋');
      break;
    }

    case 'add-custom-loc': {
      const inp = document.getElementById('customLocInput');
      const nm = (inp?.value || '').trim();
      if (!nm) break;
      S_DATA.customLocations = S_DATA.customLocations || [];
      S_DATA.customLocations.push({ id: genId('loc'), name: nm, icon: '📍' });
      persistAll();
      renderHybridApp();
      showToast(`Локация «${nm}» добавлена`);
      break;
    }

    case 'del-custom-loc': {
      const lid = el.dataset.id;
      S_DATA.customLocations = (S_DATA.customLocations || []).filter(l => l.id !== lid);
      if (S_DATA.locationManual === lid) S_DATA.locationManual = 'any';
      S_DATA.items.forEach(i => { if (i.locationId === lid) i.locationId = 'any'; });
      persistAll();
      renderHybridApp();
      break;
    }

    case 'go-home':
      APP_UI.room = 'home';
      window.scrollTo({ top: 0, behavior: 'instant' });
      renderHybridApp();
      break;

    case 'set-calc-mode':
      switchCalculatorMode(el.dataset.mode);
      break;

    case 'open-room':
      APP_UI.room = el.dataset.room || 'home';
      window.scrollTo({ top: 0, behavior: 'instant' });
      renderHybridApp();
      break;

    case 'nav-tab':
      APP_UI.room = el.dataset.tab || 'home';
      window.scrollTo({ top: 0, behavior: 'instant' });
      renderHybridApp();
      break;

    case 'open-sheet': {
      const name = el.dataset.sheet;
      APP_UI.sheet = { name, id: el.dataset.id || null, occ: el.dataset.occ || null };
      if (name === 'quick-add') {
        APP_UI.addForm = {
          title: '',
          kind: APP_UI.room === 'quests' && APP_UI.questsSub === 'tasks' ? 'task' : 'habit',
          norm: 1,
          dateMode: 'none',
          customDate: S_DATA.currentDate,
          dirId: S_DATA.waypointDirId || (S_DATA.directions[0] && S_DATA.directions[0].id) || 'soul'
        };
      }
      renderHybridApp();
      break;
    }

    case 'open-add-for-dir':
      APP_UI.sheet = { name: 'quick-add', id: null, occ: null };
      APP_UI.addForm = {
        title: '',
        kind: 'habit',
        norm: 1,
        dateMode: 'none',
        customDate: S_DATA.currentDate,
        dirId: el.dataset.id
      };
      renderHybridApp();
      break;

    case 'close-sheet':
      APP_UI.sheet = null;
      renderHybridApp();
      break;

    case 'resume-all-strategy':
      S_DATA.liteFreezeActive = false;
      S_DATA.specialMode = 'none';
      persistAll();
      renderHybridApp();
      showToast('Все стратегические планы снова в обычном ходе');
      break;

    case 'exit-special-mode':
      S_DATA.specialMode = 'none';
      persistAll();
      renderHybridApp();
      showToast('Возвращён обычный ход игры');
      break;

    case 'set-tempo':
      S_DATA.tempo = el.dataset.val || 'normal';
      persistAll();
      renderHybridApp();
      break;

    case 'tap-item-check': {
      const it = S_DATA.items.find(x => x.id === el.dataset.id);
      if (!it) break;
      const eff = get7DayEffort(S_DATA, it.id);
      const norm = getEffectiveNorm(it, S_DATA.currentDate);

      if (eff.todayDone) {
        const removed = S_DATA.facts.filter(f => f.itemId === it.id && f.date === S_DATA.currentDate);
        S_DATA.facts = S_DATA.facts.filter(f => !(f.itemId === it.id && f.date === S_DATA.currentDate));
        const cBack = removed.reduce((s, x) => s + (Number(x.coins) || 0), 0);
        const xBack = removed.reduce((s, x) => s + (Number(x.xp) || 0), 0);
        S_DATA.wallet.coins = Math.max(0, S_DATA.wallet.coins - cBack);
        S_DATA.wallet.xp = Math.max(0, S_DATA.wallet.xp - xBack);
        if (it.kind === 'task') it.status = 'active';
        persistAll();
        renderHybridApp();
        showToast('Отметка за сегодня снята');
      } else if (it.kind === 'habit' && norm > 1 && eff.todaySteps + 1 < norm) {
        S_DATA.facts.push({
          id: genId('f'),
          kind: 'habitStep',
          itemId: it.id,
          occurrenceKey: S_DATA.currentDate,
          date: S_DATA.currentDate,
          coins: 0,
          xp: 3
        });
        S_DATA.wallet.xp += 3;
        SoundEngine.play('step');
        persistAll();
        renderHybridApp();
        showToast(`Записан подход ${eff.todaySteps + 1} из ${norm}`);
      } else {
        if (it.kind === 'habit' && norm > 1) {
          S_DATA.facts.push({
            id: genId('f'),
            kind: 'habitStep',
            itemId: it.id,
            occurrenceKey: S_DATA.currentDate,
            date: S_DATA.currentDate,
            coins: 0,
            xp: 2
          });
        }
        const cGain = Number(it.coins) || 10;
        const xGain = Number(it.xp) || 12;
        S_DATA.facts.push({
          id: genId('f'),
          kind: it.kind,
          itemId: it.id,
          occurrenceKey: S_DATA.currentDate,
          date: S_DATA.currentDate,
          coins: cGain,
          xp: xGain
        });
        S_DATA.wallet.coins += cGain;
        S_DATA.wallet.xp += xGain;
        if (it.kind === 'task' && (!it.schedule || it.schedule === 'once')) {
          it.status = 'completed';
        }
        SoundEngine.play('reward');
        persistAll();
        renderHybridApp();
        showToast(`Выполнено! +${cGain} ● и +${xGain} XP`);
      }
      break;
    }

    case 'qa-kind':
      APP_UI.addForm.kind = el.dataset.val;
      renderHybridApp();
      break;

    case 'qa-date':
      APP_UI.addForm.dateMode = el.dataset.val;
      renderHybridApp();
      break;

    case 'submit-qa': {
      const title = (APP_UI.addForm.title || '').trim();
      if (!title) {
        showToast('Напиши короткое название дела');
        break;
      }
      let due = null;
      if (APP_UI.addForm.kind === 'task') {
        if (APP_UI.addForm.dateMode === 'today') due = S_DATA.currentDate;
        else if (APP_UI.addForm.dateMode === 'tomorrow') due = addDaysISO(S_DATA.currentDate, 1);
        else if (APP_UI.addForm.dateMode === 'pick') due = APP_UI.addForm.customDate || S_DATA.currentDate;
      }
      const newItem = {
        id: genId('it'),
        title,
        kind: APP_UI.addForm.kind,
        directionId: APP_UI.addForm.dirId || 'soul',
        locationId: 'any',
        inLiteRhythm: S_DATA.calcMode === 'lite' || getLiteRhythmItems(S_DATA).length < 4,
        inDayPlan: true,
        isKey: false,
        tempoMin: 'gentle',
        schedule: APP_UI.addForm.kind === 'habit' ? 'daily' : 'once',
        dailyNorm: APP_UI.addForm.kind === 'habit' ? Math.max(1, Math.min(50, Number(APP_UI.addForm.norm) || 1)) : 1,
        dueDate: due,
        coins: 12,
        xp: 15,
        status: 'active',
        cycle: 1
      };
      S_DATA.items.unshift(newItem);
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Дело добавлено');
      break;
    }

    case 'save-mins': {
      const mins = Math.max(1, Number(el.dataset.mins) || 5);
      S_DATA.timeLogs.push({
        id: genId('tl'),
        itemId: el.dataset.id,
        date: S_DATA.currentDate,
        minutes: mins
      });
      S_DATA.wallet.xp += 3;
      APP_UI.sheet = null;
      SoundEngine.play('step');
      persistAll();
      renderHybridApp();
      showToast(`Записано +${mins} мин в 7-дневную ленту (отдельно от галочки)`);
      break;
    }

    case 'clear-mins':
      S_DATA.timeLogs = S_DATA.timeLogs.filter(t => !(t.itemId === el.dataset.id && t.date === S_DATA.currentDate));
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Записи минут за сегодня очищены');
      break;

    case 'toggle-star': {
      const it = S_DATA.items.find(x => x.id === el.dataset.id);
      if (it) it.isKey = !it.isKey;
      persistAll();
      renderHybridApp();
      break;
    }

    case 'toggle-lite-member': {
      const it = S_DATA.items.find(x => x.id === el.dataset.id);
      if (it) it.inLiteRhythm = !it.inLiteRhythm;
      persistAll();
      renderHybridApp();
      break;
    }

    case 'toggle-day-member': {
      const it = S_DATA.items.find(x => x.id === el.dataset.id);
      if (it) it.inDayPlan = !it.inDayPlan;
      persistAll();
      renderHybridApp();
      break;
    }

    case 'suggest-lite-set': {
      const active = S_DATA.items.filter(i => i.status === 'active');
      active.forEach((it, idx) => { it.inLiteRhythm = idx < 3; });
      persistAll();
      renderHybridApp();
      showToast('Выбраны 3 спокойных опорных шага для Лайт-ритма');
      break;
    }

    case 'shift-item-due': {
      const it = S_DATA.items.find(x => x.id === el.dataset.id);
      if (it) {
        const base = it.dueDate && it.dueDate >= S_DATA.currentDate ? it.dueDate : S_DATA.currentDate;
        it.dueDate = addDaysISO(base, 1);
      }
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Перенесено на завтра (+1 день)');
      break;
    }

    case 'flip-item-kind': {
      const it = S_DATA.items.find(x => x.id === el.dataset.id);
      if (it) {
        it.kind = it.kind === 'habit' ? 'task' : 'habit';
        it.schedule = it.kind === 'habit' ? 'daily' : 'once';
        it.status = 'active';
      }
      persistAll();
      renderHybridApp();
      showToast('Формат повтора обновлён, прошлые факты сохранены');
      break;
    }

    case 'save-next-norm': {
      const it = S_DATA.items.find(x => x.id === el.dataset.id);
      const inp = document.getElementById('nextNormInput');
      if (it && inp) {
        const target = Math.max(1, Math.min(50, Number(inp.value) || 1));
        it.pendingNorm = { from: addDaysISO(S_DATA.currentDate, 1), target };
      }
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Новая дневная норма вступит в силу с завтрашнего дня');
      break;
    }

    case 'set-cal-sub':
      APP_UI.calSub = el.dataset.val;
      renderHybridApp();
      break;

    case 'toggle-cal-done': {
      const evObj = S_DATA.calendar.find(c => c.id === el.dataset.id);
      if (!evObj) break;
      const occKey = el.dataset.occ || S_DATA.currentDate;
      const existingIdx = S_DATA.facts.findIndex(f => f.kind === 'cal' && f.itemId === evObj.id && f.occurrenceKey === occKey);
      if (existingIdx >= 0) {
        const rem = S_DATA.facts.splice(existingIdx, 1)[0];
        S_DATA.wallet.coins = Math.max(0, S_DATA.wallet.coins - (rem.coins || 0));
        S_DATA.wallet.xp = Math.max(0, S_DATA.wallet.xp - (rem.xp || 0));
        showToast('Отметка встречи снята');
      } else {
        const c = Number(evObj.coins) || 12;
        const x = Number(evObj.xp) || 15;
        S_DATA.facts.push({
          id: genId('fc'),
          kind: 'cal',
          itemId: evObj.id,
          occurrenceKey: occKey,
          date: S_DATA.currentDate,
          coins: c,
          xp: x
        });
        S_DATA.wallet.coins += c;
        S_DATA.wallet.xp += x;
        SoundEngine.play('reward');
        showToast(`Встреча отмечена! +${c} ●`);
      }
      persistAll();
      renderHybridApp();
      break;
    }

    case 'submit-cal': {
      const t = (document.getElementById('calTitle')?.value || '').trim();
      const dt = document.getElementById('calDate')?.value || S_DATA.currentDate;
      const tm = document.getElementById('calTime')?.value || '';
      const rp = document.getElementById('calRepeat')?.value || 'none';
      if (!t) { showToast('Укажи название события'); break; }
      S_DATA.calendar.push({
        id: genId('cal'),
        title: t,
        directionId: S_DATA.waypointDirId || 'soul',
        baseDate: dt,
        time: tm,
        repeat: rp,
        daysOfWeek: rp === 'weekly' ? [weekdayUTC(dt)] : [],
        until: null,
        exceptions: {},
        coins: 15,
        xp: 15,
        status: 'active'
      });
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Событие добавлено в календарь');
      break;
    }

    case 'confirm-move-cal': {
      const evObj = S_DATA.calendar.find(c => c.id === el.dataset.id);
      if (!evObj) break;
      const editedTitle = (document.getElementById('moveCalTitle')?.value || '').trim();
      if (editedTitle) evObj.title = editedTitle;
      const newDate = document.getElementById('moveCalDate')?.value || addDaysISO(S_DATA.currentDate, 1);
      const newTime = document.getElementById('moveCalTime')?.value || evObj.time || '';
      const occ = el.dataset.occ || S_DATA.currentDate;
      const scope = el.dataset.scope || 'single';
      evObj.exceptions = evObj.exceptions || {};

      if (scope === 'single' && evObj.repeat !== 'none') {
        evObj.exceptions[occ] = { movedTo: newDate, movedTime: newTime };
        showToast(`Только появление ${occ} перенесено на ${newDate}`);
      } else {
        if (evObj.repeat !== 'none' && occ > evObj.baseDate) {
          evObj.until = addDaysISO(occ, -1);
          S_DATA.calendar.push({
            ...safeClone(evObj),
            id: genId('cal'),
            baseDate: newDate,
            time: newTime,
            daysOfWeek: evObj.repeat === 'weekly' ? [weekdayUTC(newDate)] : evObj.daysOfWeek,
            until: null,
            exceptions: {}
          });
        } else {
          evObj.baseDate = newDate;
          evObj.time = newTime;
          if (evObj.repeat === 'weekly') evObj.daysOfWeek = [weekdayUTC(newDate)];
        }
        showToast(`Серия перенесена на ${newDate}`);
      }
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      break;
    }

    case 'submit-word': {
      const wt = (document.getElementById('wTitle')?.value || '').trim();
      const wd = document.getElementById('wDate')?.value || addDaysISO(S_DATA.currentDate, 3);
      const ws = Math.max(5, Number(document.getElementById('wStake')?.value) || 25);
      if (!wt) { showToast('Напиши формулировку решения'); break; }
      S_DATA.wordCommitments.unshift({ id: genId('wc'), title: wt, dueDate: wd, stake: ws, status: 'active' });
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Слово зафиксировано');
      break;
    }

    case 'resolve-word': {
      const w = S_DATA.wordCommitments.find(x => x.id === el.dataset.id);
      if (!w || w.status !== 'active') break;
      if (el.dataset.res === 'kept') {
        w.status = 'сдержано';
        S_DATA.wallet.xp += 20;
        SoundEngine.play('reward');
        showToast('Слово сдержано! +20 XP');
      } else {
        w.status = 'закрыто со ставкой';
        S_DATA.wallet.coins = Math.max(0, S_DATA.wallet.coins - w.stake);
        showToast(`Ставка слова списана (−${w.stake} ●)`);
      }
      persistAll();
      renderHybridApp();
      break;
    }

    case 'settle-miss': {
      const idx = S_DATA.misses.findIndex(m => m.id === el.dataset.id);
      if (idx >= 0) {
        const ms = S_DATA.misses.splice(idx, 1)[0];
        if (el.dataset.how === 'done') {
          S_DATA.wallet.coins += 8;
          S_DATA.wallet.xp += 10;
          S_DATA.facts.push({ id: genId('fm'), kind: 'cal', itemId: ms.evId || ms.id, occurrenceKey: ms.date, date: S_DATA.currentDate, coins: 8, xp: 10 });
          showToast('Пропуск спокойно закрыт (+8 ●)');
        } else {
          showToast('Запись отправлена в архив без штрафа');
        }
        persistAll();
        renderHybridApp();
      }
      break;
    }

    case 'set-map-sub':
      APP_UI.mapSub = el.dataset.val;
      renderHybridApp();
      break;

    case 'pick-map-dir':
      APP_UI.selectedDirId = el.dataset.id;
      renderHybridApp();
      break;

    case 'open-dir-path':
      APP_UI.selectedDirId = el.dataset.id;
      APP_UI.mapSub = 'path';
      renderHybridApp();
      break;

    case 'map-zoom':
      APP_UI.zoom = Math.max(0.55, Math.min(1.65, Number((APP_UI.zoom + Number(el.dataset.d)).toFixed(2))));
      renderHybridApp();
      break;

    case 'map-center':
      APP_UI.panX = -145;
      APP_UI.panY = -135;
      APP_UI.zoom = 0.72;
      renderHybridApp();
      break;

    case 'toggle-map-lens':
      S_DATA.mapLens = !S_DATA.mapLens;
      persistAll();
      renderHybridApp();
      break;

    case 'set-waypoint':
      S_DATA.waypointDirId = el.dataset.id;
      persistAll();
      renderHybridApp();
      showToast('Ориентир Карты обновлён 🎯');
      break;

    case 'toggle-oasis': {
      const d = S_DATA.directions.find(x => x.id === el.dataset.id);
      if (d) {
        d.status = d.status === 'oasis' ? 'active' : 'oasis';
        d.horizonRing = d.status === 'oasis' ? 'oasis' : 'now';
      }
      persistAll();
      renderHybridApp();
      showToast(d && d.status === 'oasis' ? 'Сфера отмечена как Оазис достаточности 🌿' : 'Сфера снова в активном росте');
      break;
    }

    case 'submit-edit-dir': {
      const d = S_DATA.directions.find(x => x.id === el.dataset.id);
      if (d) {
        pushUndoSnapshot('edit-dir');
        d.name = (document.getElementById('edName')?.value || '').trim() || d.name;
        d.short = (document.getElementById('edShort')?.value || '').trim() || d.short;
        d.nature = document.getElementById('edNature')?.value || d.nature;
        d.color = document.getElementById('edColor')?.value || d.color;
        d.fact = document.getElementById('edFact')?.value || d.fact;
        d.currentStage.title = document.getElementById('edCur')?.value || d.currentStage.title;
        d.currentStage.strategy = document.getElementById('edStrat')?.value || d.currentStage.strategy;
        d.nextStage = document.getElementById('edNext')?.value || d.nextStage;
        d.optimal = document.getElementById('edOpt')?.value || d.optimal;
        d.unknownGap = document.getElementById('edUnk')?.value || d.unknownGap;
        d.lvmg = document.getElementById('edLvmg')?.value || d.lvmg;
        d.routeKnownToLvmg = !!document.getElementById('edKnown')?.checked;
      }
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Траектория сферы обновлена');
      break;
    }

    case 'submit-new-dir': {
      const nm = (document.getElementById('ndName')?.value || '').trim();
      if (!nm) { showToast('Укажи название направления'); break; }
      const id = genId('dir');
      S_DATA.directions.push({
        id,
        name: nm,
        short: nm.slice(0, 10),
        color: '#38bdf8',
        nature: 'growth',
        terrain: 'Новая сфера',
        x: 430, y: 350, beaconX: 430, beaconY: 120,
        status: 'active',
        horizonRing: 'now',
        fact: document.getElementById('ndFact')?.value || 'Точка старта зафиксирована',
        currentStage: {
          title: document.getElementById('ndCur')?.value || 'Первый спокойный этап',
          strategy: 'Маленькие регулярные шаги.',
          goals: []
        },
        nextStage: 'Следующая ступень',
        foldedStages: [],
        optimal: document.getElementById('ndOpt')?.value || 'Устойчивый комфортный уровень',
        unknownGap: 'Откроется в процессе движения',
        routeKnownToLvmg: false,
        lvmg: document.getElementById('ndLvmg')?.value || 'Дальний маяк направления',
        beyond: 'Открытый горизонт'
      });
      APP_UI.selectedDirId = id;
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Сфера добавлена на Карту жизни');
      break;
    }

    case 'set-quests-sub':
      APP_UI.questsSub = el.dataset.val;
      renderHybridApp();
      break;

    case 'quest-counter-step': {
      const q = S_DATA.quests.find(x => x.id === el.dataset.id);
      if (!q) break;
      const d = Number(el.dataset.d) || 1;
      q.currentCount = Math.max(0, Math.min(q.targetCount, q.currentCount + d));
      if (q.currentCount >= q.targetCount && q.status !== 'completed') {
        q.status = 'completed';
        S_DATA.wallet.coins += q.coins;
        S_DATA.wallet.xp += q.xp;
        S_DATA.facts.push({ id: genId('fq'), kind: 'quest', itemId: q.id, occurrenceKey: S_DATA.currentDate, date: S_DATA.currentDate, coins: q.coins, xp: q.xp });
        const prizeMsg = grantLinkedBonusIfAny(q.linkedBonusId, q.title);
        SoundEngine.play('reward');
        showToast(`Квест завершён! +${q.coins} ●${prizeMsg}`);
      } else {
        SoundEngine.play('step');
      }
      persistAll();
      renderHybridApp();
      break;
    }

    case 'toggle-quest-step': {
      const q = S_DATA.quests.find(x => x.id === el.dataset.id);
      if (!q) break;
      const st = q.steps.find(s => s.id === el.dataset.sid);
      if (!st) break;
      st.done = !st.done;
      if (st.done) S_DATA.wallet.xp += 5;
      if (q.steps.length > 0 && q.steps.every(s => s.done) && q.status !== 'completed') {
        q.status = 'completed';
        S_DATA.wallet.coins += q.coins;
        S_DATA.wallet.xp += q.xp;
        S_DATA.facts.push({ id: genId('fq'), kind: 'quest', itemId: q.id, occurrenceKey: S_DATA.currentDate, date: S_DATA.currentDate, coins: q.coins, xp: q.xp });
        const prizeMsg = grantLinkedBonusIfAny(q.linkedBonusId, q.title);
        SoundEngine.play('reward');
        showToast(`Квест завершён! +${q.coins} ●${prizeMsg}`);
      }
      persistAll();
      renderHybridApp();
      break;
    }

    case 'submit-quest': {
      const qt = (document.getElementById('qTitle')?.value || '').trim();
      const qtype = document.getElementById('qType')?.value || 'counter';
      const raw = (document.getElementById('qTargetOrSteps')?.value || '').trim();
      const bon = document.getElementById('qBonus')?.value || null;
      if (!qt) { showToast('Укажи название квеста'); break; }
      const steps = qtype === 'checklist'
        ? (raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : ['Шаг 1', 'Шаг 2']).map(tx => ({ id: genId('qs'), text: tx, done: false }))
        : [];
      S_DATA.quests.unshift({
        id: genId('q'),
        title: qt,
        directionId: S_DATA.waypointDirId || 'craft',
        qtype,
        targetCount: qtype === 'counter' ? Math.max(2, Number(raw) || 5) : steps.length,
        currentCount: 0,
        steps,
        coins: 45,
        xp: 60,
        linkedBonusId: bon || null,
        status: 'active'
      });
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Квест создан');
      break;
    }

    case 'repeat-oneoff': {
      const t = S_DATA.items.find(x => x.id === el.dataset.id);
      if (t) {
        t.cycle = (t.cycle || 1) + 1;
        t.status = 'active';
        t.inDayPlan = true;
        t.inLiteRhythm = true;
        t.dueDate = S_DATA.currentDate;
      }
      persistAll();
      renderHybridApp();
      showToast('Запущен новый подход разового дела (прошлая история сохранена)');
      break;
    }

    case 'add-inbox': {
      const inp = document.getElementById('inboxFastInput');
      const txt = (inp?.value || '').trim();
      if (!txt) break;
      S_DATA.inbox.unshift({ id: genId('inb'), text: txt, date: S_DATA.currentDate });
      persistAll();
      renderHybridApp();
      showToast('Мысль сохранена во Входящие');
      break;
    }

    case 'inbox-to-task': {
      const idx = S_DATA.inbox.findIndex(i => i.id === el.dataset.id);
      if (idx >= 0) {
        const item = S_DATA.inbox.splice(idx, 1)[0];
        S_DATA.items.unshift({
          id: genId('it'),
          title: item.text,
          kind: 'task',
          directionId: S_DATA.waypointDirId || 'craft',
          locationId: 'any',
          inLiteRhythm: S_DATA.calcMode === 'lite',
          inDayPlan: true,
          isKey: false,
          tempoMin: 'normal',
          schedule: 'once',
          dailyNorm: 1,
          dueDate: S_DATA.currentDate,
          coins: 12,
          xp: 15,
          status: 'active',
          cycle: 1
        });
        persistAll();
        renderHybridApp();
        showToast('Мысль переведена в дело дня');
      }
      break;
    }

    case 'del-inbox':
      S_DATA.inbox = S_DATA.inbox.filter(i => i.id !== el.dataset.id);
      persistAll();
      renderHybridApp();
      break;

    case 'set-bonus-sub':
      APP_UI.bonusSub = el.dataset.val;
      renderHybridApp();
      break;

    case 'set-target-bonus':
      S_DATA.targetBonusId = el.dataset.id;
      persistAll();
      renderHybridApp();
      showToast('Обновлена целевая награда на Главной ✦');
      break;

    case 'buy-bonus': {
      const b = S_DATA.bonuses.find(x => x.id === el.dataset.id);
      if (!b || S_DATA.wallet.coins < b.cost) break;
      S_DATA.wallet.coins -= b.cost;
      S_DATA.ownedBonuses.unshift({
        id: genId('ob'),
        bonusId: b.id,
        title: b.title,
        paidCost: b.cost,
        date: S_DATA.currentDate,
        used: false,
        refunded: false
      });
      APP_UI.bonusSub = 'owned';
      SoundEngine.play('reward');
      persistAll();
      renderHybridApp();
      showToast(`Куплен бонус «${b.title}»!`);
      break;
    }

    case 'use-bonus': {
      const ob = S_DATA.ownedBonuses.find(x => x.id === el.dataset.id);
      if (ob) ob.used = true;
      SoundEngine.play('reward');
      persistAll();
      renderHybridApp();
      showToast('Наслаждайся заслуженной наградой ✨');
      break;
    }

    case 'refund-bonus': {
      const ob = S_DATA.ownedBonuses.find(x => x.id === el.dataset.id);
      if (ob && !ob.used && !ob.refunded) {
        ob.refunded = true;
        S_DATA.wallet.coins += ob.paidCost;
        persistAll();
        renderHybridApp();
        showToast(`Возвращено +${ob.paidCost} ● на баланс`);
      }
      break;
    }

    case 'submit-bonus': {
      const bt = (document.getElementById('bonTitle')?.value || '').trim();
      const bc = Math.max(5, Number(document.getElementById('bonCost')?.value) || 45);
      if (!bt) { showToast('Укажи название бонуса'); break; }
      const nb = { id: genId('bon'), title: bt, cost: bc, repeatable: true };
      S_DATA.bonuses.unshift(nb);
      S_DATA.targetBonusId = nb.id;
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Личный бонус добавлен и выбран целью');
      break;
    }

    case 'set-mood':
      APP_UI.eveningMood = el.dataset.val;
      renderHybridApp();
      break;

    case 'voice-dictate': {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        showToast('Голосовой ввод зависит от браузера — можно написать пару строк вручную');
        break;
      }
      if (APP_UI.recording && APP_UI._sr) {
        APP_UI._sr.stop();
        APP_UI.recording = false;
        renderHybridApp();
        break;
      }
      try {
        const sr = new SR();
        sr.lang = 'ru-RU';
        sr.interimResults = false;
        APP_UI.recording = true;
        APP_UI._sr = sr;
        renderHybridApp();
        sr.onresult = (resEv) => {
          const chunk = Array.from(resEv.results).map(r => r[0].transcript).join(' ');
          APP_UI.eveningDraft = (APP_UI.eveningDraft ? APP_UI.eveningDraft + ' ' : '') + chunk;
          APP_UI.recording = false;
          renderHybridApp();
        };
        sr.onerror = () => { APP_UI.recording = false; renderHybridApp(); };
        sr.onend = () => { APP_UI.recording = false; renderHybridApp(); };
        sr.start();
      } catch (e) {
        APP_UI.recording = false;
        renderHybridApp();
      }
      break;
    }

    case 'save-evening': {
      const moodMap = {
        calm: '🌿 Спокойно',
        warm: '✨ Наполненно',
        tired: '🌙 Приятная усталость',
        gentle: '🫂 Нужен отдых'
      };
      const note = (APP_UI.eveningDraft || '').trim() || 'Спокойное завершение дня.';
      const reply = pickEveningMessage(S_DATA, APP_UI.eveningMood);
      const alreadyToday = S_DATA.reflections.some(r => r.date === S_DATA.currentDate);
      S_DATA.reflections.unshift({
        id: genId('ref'),
        date: S_DATA.currentDate,
        mood: APP_UI.eveningMood,
        moodLabel: moodMap[APP_UI.eveningMood] || '🌿 Спокойно',
        text: note,
        reply
      });
      if (!alreadyToday) {
        S_DATA.wallet.coins += 5;
        S_DATA.wallet.xp += 10;
      }
      APP_UI.eveningDraft = '';
      SoundEngine.play('reward');
      persistAll();
      renderHybridApp();
      showToast(alreadyToday ? 'Вечерняя заметка сохранена' : 'Итог вечера сохранён (+5 ● и +10 XP)');
      break;
    }

    case 'toggle-ai-cat': {
      const k = el.dataset.k;
      APP_UI.aiOpts[k] = !APP_UI.aiOpts[k];
      renderHybridApp();
      break;
    }

    case 'copy-ai-pack': {
      const text = buildAiExportPrompt(S_DATA, APP_UI.aiOpts);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
      showToast(`Пакет контекста (${text.length} зн.) скопирован в буфер`);
      break;
    }

    case 'sample-ai-reply':
      APP_UI.aiReplyRaw = JSON.stringify({
        proposals: [
          { type: 'add_item', title: 'Вечерняя прогулка 12 минут без наушников', directionId: 'soul', kind: 'habit', inLiteRhythm: true },
          { type: 'hypothesis', directionId: 'craft', unknownGap: 'Короткие релизы раз в неделю удерживают фокус лучше больших циклов' }
        ]
      }, null, 2);
      renderHybridApp();
      break;

    case 'parse-ai-reply': {
      const raw = (APP_UI.aiReplyRaw || '').trim();
      if (!raw) { showToast('Сначала вставь ответ от ИИ'); break; }
      try {
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        const parsed = JSON.parse(start >= 0 ? cleaned.slice(start, end + 1) : cleaned);
        const list = Array.isArray(parsed.proposals) ? parsed.proposals : [];
        APP_UI.aiProposals = list.map(p => ({ ...p, ok: true }));
        renderHybridApp();
        showToast(`Найдено предложений для проверки: ${APP_UI.aiProposals.length}`);
      } catch (e) {
        showToast('Не удалось распознать JSON предложений');
      }
      break;
    }

    case 'toggle-prop': {
      const idx = Number(el.dataset.idx);
      if (APP_UI.aiProposals[idx]) APP_UI.aiProposals[idx].ok = !APP_UI.aiProposals[idx].ok;
      renderHybridApp();
      break;
    }

    case 'apply-ai-props': {
      const approved = APP_UI.aiProposals.filter(p => p.ok);
      if (!approved.length) { showToast('Нет отмеченных предложений'); break; }
      makeStrategySnapshot(S_DATA, 'Автоснимок перед ИИ ' + S_DATA.currentDate, 'Защита стратегии перед импортом предложений');
      approved.forEach(p => {
        if (p.type === 'add_item' && p.title) {
          S_DATA.items.unshift({
            id: genId('ai'),
            title: p.title,
            kind: p.kind === 'task' ? 'task' : 'habit',
            directionId: p.directionId || 'soul',
            locationId: 'any',
            inLiteRhythm: p.inLiteRhythm !== false,
            inDayPlan: true,
            isKey: false,
            tempoMin: 'gentle',
            schedule: p.kind === 'task' ? 'once' : 'daily',
            dailyNorm: 1,
            dueDate: null,
            coins: 10,
            xp: 12,
            status: 'active',
            cycle: 1
          });
        } else if (p.type === 'hypothesis' && p.directionId && p.unknownGap) {
          const d = S_DATA.directions.find(x => x.id === p.directionId);
          if (d) d.unknownGap = p.unknownGap;
        }
      });
      APP_UI.aiProposals = [];
      APP_UI.aiReplyRaw = '';
      persistAll();
      renderHybridApp();
      showToast(`Принято предложений: ${approved.length} (снимок защиты сохранён)`);
      break;
    }

    case 'add-treat': {
      const inp = document.getElementById('treatNewInput');
      const tx = (inp?.value || '').trim();
      if (!tx) break;
      S_DATA.treats.unshift({ id: genId('tr'), text: tx, count: 0 });
      persistAll();
      renderHybridApp();
      showToast('Ништяк добавлен');
      break;
    }

    case 'enjoy-treat': {
      const tr = S_DATA.treats.find(x => x.id === el.dataset.id);
      if (tr) tr.count = (tr.count || 0) + 1;
      SoundEngine.play('step');
      persistAll();
      renderHybridApp();
      showToast('Тепло и ресурс — без траты монет ☕');
      break;
    }

    case 'start-two-min': {
      const firstItem = S_DATA.items.find(i => i.status === 'active');
      clearInterval(APP_UI.timerInterval);
      APP_UI.timer = {
        itemId: firstItem ? firstItem.id : 'any',
        totalSec: 120,
        sec: 120,
        elapsedMin: 2
      };
      APP_UI.timerInterval = setInterval(() => {
        if (!APP_UI.timer) return;
        APP_UI.timer.sec = Math.max(0, APP_UI.timer.sec - 1);
        const dg = document.getElementById('widgetTimerDigits');
        if (dg) dg.textContent = `${Math.floor(APP_UI.timer.sec / 60)}:${String(APP_UI.timer.sec % 60).padStart(2, '0')}`;
      }, 1000);
      renderHybridApp();
      showToast('2 лёгкие минуты запущены — после них можно спокойно остановиться');
      break;
    }

    case 'start-timer': {
      const mins = Number(el.dataset.mins) || 15;
      const selId = document.getElementById('timerItemSelect')?.value || (S_DATA.items[0] && S_DATA.items[0].id);
      clearInterval(APP_UI.timerInterval);
      APP_UI.timer = {
        itemId: selId,
        totalSec: mins * 60,
        sec: mins * 60,
        elapsedMin: mins
      };
      APP_UI.timerInterval = setInterval(() => {
        if (!APP_UI.timer) return;
        APP_UI.timer.sec = Math.max(0, APP_UI.timer.sec - 1);
        const dg = document.getElementById('widgetTimerDigits');
        if (dg) dg.textContent = `${Math.floor(APP_UI.timer.sec / 60)}:${String(APP_UI.timer.sec % 60).padStart(2, '0')}`;
      }, 1000);
      renderHybridApp();
      break;
    }

    case 'save-timer-mins': {
      if (APP_UI.timer) {
        const spent = Math.max(1, Math.round((APP_UI.timer.totalSec - APP_UI.timer.sec) / 60) || APP_UI.timer.elapsedMin);
        S_DATA.timeLogs.push({
          id: genId('tl'),
          itemId: APP_UI.timer.itemId,
          date: S_DATA.currentDate,
          minutes: spent
        });
        S_DATA.wallet.xp += 4;
        clearInterval(APP_UI.timerInterval);
        APP_UI.timer = null;
        persistAll();
        renderHybridApp();
        showToast(`В историю записано ${spent} мин практики`);
      }
      break;
    }

    case 'stop-timer':
      clearInterval(APP_UI.timerInterval);
      APP_UI.timer = null;
      renderHybridApp();
      break;

    case 'draw-happiness': {
      const idx = Math.floor(Math.random() * HAPPINESS_POOL.length);
      APP_UI.currentSpark = HAPPINESS_POOL[idx];
      renderHybridApp();
      break;
    }

    case 'save-happy-moment': {
      const inp = document.getElementById('happyCustomInput');
      const tx = (inp?.value || '').trim();
      if (!tx) break;
      S_DATA.happyMoments.unshift({ id: genId('hm'), date: S_DATA.currentDate, text: tx });
      persistAll();
      renderHybridApp();
      showToast('Тёплый момент сохранён');
      break;
    }

    case 'switch-space': {
      const nextSpace = el.dataset.val === 'my' ? 'my' : 'demo';
      if (APP_UI.space !== nextSpace) {
        persistAll();
        APP_UI.space = nextSpace;
        S_DATA = loadJsonSafe(
          currentStorageKey(),
          nextSpace === 'my' ? buildCleanHybridState : buildDemoHybridState
        );
        syncRealClockIfMySpace();
        persistAll();
        renderHybridApp();
        showToast(nextSpace === 'my' ? 'Открыто твоё чистое пространство «Моя жизнь»' : 'Открыт наполненный «Живой пример»');
      }
      break;
    }

    case 'step-demo-day':
      advanceSystemDate(1);
      showToast(`Новый день: ${humanDateFullRu(S_DATA.currentDate)}`);
      break;

    case 'set-theme':
      S_DATA.theme = el.dataset.val || 'night';
      persistAll();
      renderHybridApp();
      break;

    case 'toggle-motivation-vis':
      S_DATA.showMotivation = !S_DATA.showMotivation;
      persistAll();
      renderHybridApp();
      break;

    case 'toggle-compact-hero':
      S_DATA.compactHero = !S_DATA.compactHero;
      persistAll();
      renderHybridApp();
      break;

    case 'toggle-sound':
      SoundEngine.muted = !SoundEngine.muted;
      renderHybridApp();
      break;

    case 'toggle-wide':
      APP_UI.wide = !APP_UI.wide;
      persistAll();
      renderHybridApp();
      break;

    case 'set-special-mode':
      S_DATA.specialMode = el.dataset.val || 'none';
      persistAll();
      renderHybridApp();
      showToast(S_DATA.specialMode === 'red' ? 'Красный режим сфокусировал день на одной сфере' : (S_DATA.specialMode === 'pause' ? 'Творческая пауза включена' : 'Обычный режим'));
      break;

    case 'toggle-red-care': {
      const k = el.dataset.k;
      S_DATA.redConfig.care[k] = !S_DATA.redConfig.care[k];
      persistAll();
      renderHybridApp();
      break;
    }

    case 'save-snapshot':
      makeStrategySnapshot(S_DATA, `Снимок от ${S_DATA.currentDate}`);
      persistAll();
      renderHybridApp();
      showToast('Снимок стратегии сохранён');
      break;

    case 'restore-snapshot': {
      const sn = S_DATA.snapshots.find(x => x.id === el.dataset.id);
      if (sn && sn.payload) {
        S_DATA.directions = safeClone(sn.payload.directions);
        S_DATA.items = safeClone(sn.payload.items);
        S_DATA.quests = safeClone(sn.payload.quests);
        S_DATA.calendar = safeClone(sn.payload.calendar);
        persistAll();
        renderHybridApp();
        showToast('Стратегия возвращена из снимка (монеты и опыт сохранены)');
      }
      break;
    }

    case 'clean-slate':
      makeStrategySnapshot(S_DATA, `До чистого листа (${S_DATA.currentDate})`);
      S_DATA.items = [];
      S_DATA.quests = [];
      S_DATA.misses = [];
      persistAll();
      renderHybridApp();
      showToast('Планы очищены с нуля — весь опыт, монеты и снимок сохранены');
      break;

    case 'save-motivation': {
      const v = document.getElementById('motInput')?.value || '';
      S_DATA.motivationText = v.trim();
      APP_UI.sheet = null;
      persistAll();
      renderHybridApp();
      showToast('Строка опоры обновлена');
      break;
    }

    case 'export-json': {
      S_DATA.lastBackupDate = S_DATA.currentDate;
      persistAll();
      const a = document.createElement('a');
      a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(S_DATA, null, 2));
      a.download = `lifegame-hybrid-${APP_UI.space}-${S_DATA.currentDate}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Резервная копия JSON скачана');
      break;
    }

    case 'confirm-import': {
      const raw = (document.getElementById('impJsonArea')?.value || '').trim();
      if (!raw) { showToast('Вставь JSON для импорта'); break; }
      try {
        const parsed = JSON.parse(raw);
        makeStrategySnapshot(S_DATA, `Перед импортом (${S_DATA.currentDate})`);
        const unwrapped = unwrapImportPayload(parsed);
        if (unwrapped && unwrapped.kind === 'personal_v2') {
          const prevSnaps = safeClone(S_DATA.snapshots);
          S_DATA = convertPersonalV2Backup(unwrapped.data, S_DATA.currentDate);
          S_DATA.snapshots = prevSnaps;
          showToast('Данные из Personal 1.2.0 перенесены без потерь!');
        } else if (unwrapped && unwrapped.kind === 'hybrid') {
          S_DATA = unwrapped.data;
          showToast('Резервная копия LifeGame Hybrid загружена!');
        } else {
          showToast('Неизвестный формат JSON');
          break;
        }
        APP_UI.sheet = null;
        persistAll();
        renderHybridApp();
      } catch (e) {
        showToast('Ошибка чтения JSON — текущие данные не затронуты');
      }
      break;
    }
  }
});

// Delegated Change Handler
document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-change]');
  if (!el) return;
  syncDraftInputsBeforeRender();
  const kind = el.dataset.change;

  if (kind === 'set-location') {
    S_DATA.locationManual = el.value;
  } else if (kind === 'ai-mode') {
    APP_UI.aiOpts.mode = el.value;
  } else if (kind === 'ai-format') {
    APP_UI.aiOpts.format = el.value;
  } else if (kind === 'ai-consent') {
    APP_UI.aiOpts.consent = !!el.checked;
  } else if (kind === 'red-dir') {
    S_DATA.redConfig.directionId = el.value;
  } else if (kind === 'import-file') {
    const file = el.files && el.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const area = document.getElementById('impJsonArea');
        if (area) area.value = String(reader.result || '');
        showToast('Файл прочитан — нажми «Проверить и загрузить»');
      };
      reader.readAsText(file);
    }
    return;
  }
  persistAll();
  renderHybridApp();
});


function syncRealClockIfMySpace() {
  if (APP_UI.space !== 'my') return;
  const realToday = getRealTodayISO();
  if (!S_DATA.currentDate || S_DATA.currentDate >= realToday) return;
  let guard = 0;
  while (S_DATA.currentDate < realToday && guard < 90) {
    advanceSystemDate(1);
    guard++;
  }
  if (S_DATA.currentDate < realToday) {
    S_DATA.currentDate = realToday;
    persistAll();
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    syncRealClockIfMySpace();
    renderHybridApp();
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && APP_UI.sheet) {
    APP_UI.sheet = null;
    renderHybridApp();
  }
});


function checkCalendarReminders() {
  if (!S_DATA.remindersOn) return;
  const now = new Date();
  const todayIso = getRealTodayISO();
  if (S_DATA.currentDate !== todayIso) return;
  const curMinutes = now.getHours() * 60 + now.getMinutes();
  const occs = getCalendarOccurrencesOnDate(S_DATA, todayIso);
  occs.forEach(occ => {
    if (occ.done || !occ.effectiveTime) return;
    const [hh, mm] = occ.effectiveTime.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return;
    const diff = (hh * 60 + mm) - curMinutes;
    const key = occ.ev.id + '@' + todayIso;
    if (diff >= 0 && diff <= 15 && !APP_UI.notifiedKeys[key]) {
      APP_UI.notifiedKeys[key] = true;
      SoundEngine.play('reward');
      showToast(`🔔 Скоро встреча (${occ.effectiveTime}): ${occ.ev.title}`);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try { new Notification('LifeGame · Встреча', { body: `${occ.effectiveTime} — ${occ.ev.title}` }); } catch (e) {}
      }
    }
  });
}

setInterval(checkCalendarReminders, 45000);

// Boot
syncRealClockIfMySpace();
if (IS_FIRST_BOOT && !APP_UI.welcomed) {
  APP_UI.sheet = { name: 'welcome', id: null, occ: null };
}
renderHybridApp();


document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-input="search-items"]');
  if (!el) return;
  const pos = el.selectionStart || 0;
  APP_UI.searchQuery = el.value;
  renderHybridApp();
  const nextEl = document.getElementById('questsSearchInput');
  if (nextEl) {
    nextEl.focus();
    try { nextEl.setSelectionRange(pos, pos); } catch (e) {}
  }
});

window.addEventListener('storage', (ev) => {
  if (ev.key === currentStorageKey() && ev.newValue) {
    try {
      const fresh = JSON.parse(ev.newValue);
      if (fresh && typeof fresh === 'object') {
        S_DATA = fresh;
        renderHybridApp();
      }
    } catch (e) {}
  }
});
