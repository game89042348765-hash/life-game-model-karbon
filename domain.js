// LifeGame Hybrid v1.0 — Доменное ядро: безопасное хранение, Web Locks, календарные серии с исключениями, нормы привычек 1-50, награды, импорт Personal 1.2.0 и ИИ

const HYBRID_KEYS = {
  my: 'lifegame_hybrid_v1_my',
  demo: 'lifegame_hybrid_v1_demo',
  meta: 'lifegame_hybrid_v1_meta'
};

const MEM_FALLBACK = {};

function safeClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function loadJsonSafe(key, factoryFn) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object') return p;
    }
  } catch (e) {
    try {
      const backupRaw = window.localStorage.getItem(key + '_last_good');
      if (backupRaw) return JSON.parse(backupRaw);
    } catch (e2) {}
    if (MEM_FALLBACK[key]) return safeClone(MEM_FALLBACK[key]);
  }
  const fresh = factoryFn();
  saveJsonSafe(key, fresh);
  return fresh;
}

function saveJsonSafe(key, obj) {
  const raw = JSON.stringify(obj);
  MEM_FALLBACK[key] = JSON.parse(raw);
  try {
    window.localStorage.setItem(key, raw);
    window.localStorage.setItem(key + '_last_good', raw);
  } catch (e) {}
}

function runWithLock(fn) {
  if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
    return navigator.locks.request('lifegame_hybrid_v1_write', () => Promise.resolve(fn()));
  }
  return Promise.resolve(fn());
}

const SoundEngine = {
  ctx: null,
  muted: false,
  play(kind) {
    if (this.muted) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!this.ctx) this.ctx = new AC();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.connect(g);
      g.connect(this.ctx.destination);
      if (kind === 'reward') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.18);
        g.gain.setValueAtTime(0.07, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.32);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(554.37, now + 0.11);
        g.gain.setValueAtTime(0.05, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (e) {}
  }
};

function genId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 8) + '_' + Date.now().toString(36).slice(-4);
}

function addDaysISO(iso, delta) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

function daysInMonthUTC(year, month1to12) {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function weekdayUTC(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
}

function humanDateRu(iso) {
  if (!iso) return '';
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${months[m - 1]}`;
}

function humanDateFullRu(iso) {
  if (!iso) return '';
  const wds = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
  return `${humanDateRu(iso)}, ${wds[weekdayUTC(iso)]}`;
}

function levelInfoFromXp(xp) {
  const safeXp = Math.max(0, Number(xp) || 0);
  const level = Math.floor(safeXp / 250) + 1;
  const into = safeXp % 250;
  return { level, into, span: 250, pct: Math.min(100, Math.round((into / 250) * 100)) };
}

// Effective daily norm for habit (norm edits scheduled for tomorrow take effect from effectiveFrom!)
function getEffectiveNorm(item, dateIso) {
  if (item.pendingNorm && item.pendingNorm.from <= dateIso) {
    return Math.max(1, Math.min(50, Number(item.pendingNorm.target) || 1));
  }
  return Math.max(1, Math.min(50, Number(item.dailyNorm) || 1));
}

// Calendar recurrence engine supporting exceptions (move single occurrence vs move series from date!)
function getCalendarOccurrencesOnDate(state, dateIso) {
  const results = [];
  const [y, m, d] = dateIso.split('-').map(Number);
  const wd = weekdayUTC(dateIso);

  for (const ev of state.calendar) {
    if (ev.status === 'archived') continue;
    const exMap = ev.exceptions || {};

    // Check if another date's occurrence was explicitly moved TO dateIso
    for (const [origKey, exVal] of Object.entries(exMap)) {
      if (exVal && exVal.movedTo === dateIso && !exVal.cancelled) {
        const done = state.facts.some(f => f.kind === 'cal' && f.itemId === ev.id && f.occurrenceKey === origKey);
        results.push({
          ev,
          occurrenceKey: origKey,
          effectiveDate: dateIso,
          effectiveTime: exVal.movedTime || ev.time || '',
          isExceptionMove: true,
          done
        });
      }
    }

    if (dateIso < ev.baseDate) continue;
    if (ev.until && dateIso > ev.until) continue;

    // If this base occurrence was moved elsewhere or cancelled, skip its nominal slot
    if (exMap[dateIso] && (exMap[dateIso].movedTo !== dateIso || exMap[dateIso].cancelled)) {
      continue;
    }

    const rep = ev.repeat || 'none';
    let matches = false;
    if (rep === 'none') {
      matches = (ev.baseDate === dateIso);
    } else if (rep === 'daily') {
      matches = true;
    } else if (rep === 'weekly') {
      const days = Array.isArray(ev.daysOfWeek) && ev.daysOfWeek.length ? ev.daysOfWeek : [weekdayUTC(ev.baseDate)];
      matches = days.includes(wd);
    } else if (rep === 'monthly') {
      const baseDay = Number(ev.baseDate.split('-')[2]);
      const clampedDay = Math.min(baseDay, daysInMonthUTC(y, m)); // Handles 31st & Feb 29 cleanly!
      matches = (d === clampedDay);
    } else if (rep === 'yearly') {
      const [, bm, bd] = ev.baseDate.split('-').map(Number);
      const clampedDay = Math.min(bd, daysInMonthUTC(y, m));
      matches = (m === bm && d === clampedDay);
    }

    if (matches) {
      const done = state.facts.some(f => f.kind === 'cal' && f.itemId === ev.id && f.occurrenceKey === dateIso);
      results.push({
        ev,
        occurrenceKey: dateIso,
        effectiveDate: dateIso,
        effectiveTime: (exMap[dateIso] && exMap[dateIso].movedTime) || ev.time || '',
        isExceptionMove: false,
        done
      });
    }
  }

  results.sort((a, b) => String(a.effectiveTime || '99:99').localeCompare(String(b.effectiveTime || '99:99')));
  return results;
}

// 7-day effort summary (F-001 fix: shows BOTH completed days AND partial minute logs!)
function get7DayEffort(state, itemId) {
  const wds = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const days = [];
  let weekMinutes = 0;
  let completedCount = 0;
  let partialCount = 0;

  for (let i = 6; i >= 0; i--) {
    const iso = addDaysISO(state.currentDate, -i);
    const done = state.facts.some(f => f.itemId === itemId && f.date === iso && f.kind !== 'habitStep');
    const steps = state.facts.filter(f => f.itemId === itemId && f.date === iso && f.kind === 'habitStep').length;
    const mins = state.timeLogs
      .filter(t => t.itemId === itemId && t.date === iso)
      .reduce((s, t) => s + (Number(t.minutes) || 0), 0);
    weekMinutes += mins;
    if (done) completedCount++;
    else if (mins > 0 || steps > 0) partialCount++;
    days.push({
      iso,
      wd: wds[weekdayUTC(iso)],
      isToday: i === 0,
      done,
      steps,
      mins,
      cls: done ? 'done' : ((mins > 0 || steps > 0) ? 'partial' : 'idle')
    });
  }

  const todayDone = days[6].done;
  const todaySteps = days[6].steps;
  const todayMins = days[6].mins;
  return { days, weekMinutes, completedCount, partialCount, todayDone, todaySteps, todayMins };
}

function getAllLocations(state) {
  const base = [
    ['any', '🌍 Везде'],
    ['auto', '🕒 Авто по времени суток'],
    ['home', '🏠 Дом'],
    ['work', '💼 Работа'],
    ['road', '🚇 В дороге']
  ];
  const extras = (state.customLocations || []).map(l => [l.id, `${l.icon || '📍'} ${l.name}`]);
  return base.concat(extras);
}

function getActiveLocationId(state) {
  const sel = state.locationManual || 'any';
  if (sel !== 'auto') return sel;
  const hr = new Date().getHours();
  const wd = new Date().getDay();
  if (wd >= 1 && wd <= 5 && hr >= 9 && hr < 18) return 'work';
  return 'home';
}

function isItemActiveOrDoneToday(state, it) {
  if (it.status === 'active') return true;
  if (it.status === 'completed') {
    return state.facts.some(f => f.itemId === it.id && f.date === state.currentDate && f.kind !== 'habitStep');
  }
  return false;
}

function getLiteRhythmItems(state) {
  return state.items.filter(it =>
    isItemActiveOrDoneToday(state, it) &&
    it.inLiteRhythm &&
    (!it.dueDate || it.dueDate <= state.currentDate)
  );
}

function getProConstructorItems(state) {
  const active = state.items.filter(it => isItemActiveOrDoneToday(state, it));
  if (state.specialMode === 'pause') return [];
  if (state.specialMode === 'red') {
    const redDir = state.redConfig.directionId;
    return active.filter(it => it.directionId === redDir);
  }
  const loc = getActiveLocationId(state);
  const tempoRank = { gentle: 1, normal: 2, intense: 3 };
  const curRank = tempoRank[state.tempo || 'normal'] || 2;

  return active.filter(it => {
    if (loc !== 'any' && it.locationId && it.locationId !== 'any' && it.locationId !== loc) return false;
    if (it.isKey) return true;
    if (it.dueDate === state.currentDate) return true;
    if (!it.inDayPlan) return false;
    return (tempoRank[it.tempoMin || 'normal'] || 2) <= curRank;
  });
}

function makeStrategySnapshot(state, title, note) {
  const snap = {
    id: genId('snap'),
    title: title || ('Снимок от ' + state.currentDate),
    date: state.currentDate,
    note: note || 'Опыт, монеты и факты защищены',
    payload: {
      directions: safeClone(state.directions),
      items: safeClone(state.items),
      quests: safeClone(state.quests),
      calendar: safeClone(state.calendar)
    }
  };
  state.snapshots.unshift(snap);
  return snap;
}

// Unwrap direct v:2 backup, {data:{v:2}} daily backup, or multi-key localStorage dump
function unwrapImportPayload(rawObj) {
  if (!rawObj || typeof rawObj !== "object") return null;
  if (rawObj.version && Array.isArray(rawObj.directions)) return { kind: "hybrid", data: rawObj };
  if (rawObj.v === 2 || Array.isArray(rawObj.blocks)) return { kind: "personal_v2", data: rawObj };
  if (rawObj.data && (rawObj.data.v === 2 || Array.isArray(rawObj.data.blocks))) return { kind: "personal_v2", data: rawObj.data };
  for (const [k, val] of Object.entries(rawObj)) {
    if (val && typeof val === "object" && !k.endsWith("-last-good") && (val.v === 2 || Array.isArray(val.blocks))) {
      return { kind: "personal_v2", data: val };
    }
  }
  return null;
}

// Lossless converter from Personal 1.2.0 / Personal-Lab JSON (v:2) into LifeGame Hybrid v1.0!
function convertPersonalV2Backup(src, fallbackDate) {
  const curDate = src.lastProcessed || fallbackDate || '2026-11-13';
  const palette = ['#b48cff','#34d399','#38bdf8','#fbbf24','#f472b6','#a3e635','#94a3b8','#f87171','#f4ce4a','#fb923c'];

  const directions = (src.blocks || []).filter(b => b.status !== 'archived').map((b, idx) => {
    const stgs = (src.stages || []).filter(st => st.blockId === b.id && st.status !== 'closed');
    const curStage = stgs.find(st => st.id === b.currentStageId) || stgs[0];
    const nextStage = stgs.find(st => !curStage || st.id !== curStage.id);
    const goals = curStage
      ? (src.goals || []).filter(g => g.stageId === curStage.id).map(g => g.title)
      : [];
    const ang = (idx / Math.max(1, src.blocks.length)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.round(430 + Math.cos(ang) * 230);
    const y = Math.round(460 + Math.sin(ang) * 200);
    return {
      id: b.id,
      name: b.name || 'Направление',
      short: (b.name || 'Сфера').slice(0, 11),
      color: palette[idx % palette.length],
      nature: b.name === 'Обстоятельства' ? 'shield' : (b.name === 'Исключить' ? 'reduce' : (b.name === 'Дети' ? 'care' : 'growth')),
      terrain: 'Сфера жизни',
      x, y,
      beaconX: x,
      beaconY: Math.max(80, y - 240),
      status: 'active',
      horizonRing: 'now',
      fact: b.fact || 'Перенесено из Personal 1.2.0',
      currentStage: {
        title: curStage ? curStage.name : 'Текущий рабочий этап',
        strategy: (curStage && (curStage.meaning || curStage.content)) || 'Спокойное движение шаг за шагом.',
        goals
      },
      nextStage: nextStage ? nextStage.name : 'Следующий этап',
      foldedStages: stgs.slice(2).map(s => s.name),
      optimal: b.optimal || 'Комфортный уровень достаточности',
      unknownGap: b.unknown || 'Участок пути откроется по мере практики',
      routeKnownToLvmg: false,
      lvmg: b.lvmg || 'Дальний ориентир воображения',
      beyond: 'Открытый горизонт',
      achievements: (src.achievements || []).filter(a => a.blockId === b.id).map(a => ({ id: a.id || genId('ach'), title: a.title || a.text || 'Достижение', date: a.date || curDate }))
    };
  });

  const items = [];
  for (const t of (src.tasks || [])) {
    items.push({
      id: t.id,
      title: t.title,
      kind: 'task',
      directionId: t.blockId || (directions[0] && directions[0].id) || 'soul',
      locationId: (t.locs && t.locs[0]) || 'any',
      inLiteRhythm: (src.flex && Array.isArray(src.flex.members) && src.flex.members.includes("task:" + t.id)) || !!t.inDay || !!t.key,
      inDayPlan: t.inDay !== false,
      isKey: !!t.key,
      tempoMin: 'normal',
      schedule: (t.sched && t.sched.type) || 'once',
      dailyNorm: 1,
      dueDate: (t.sched && t.sched.date) || null,
      coins: Number(t.reward) || 10,
      xp: Number(t.reward) || 10,
      status: t.status === 'archived' ? 'completed' : 'active',
      cycle: 1
    });
  }
  for (const h of (src.habits || [])) {
    items.push({
      id: h.id,
      title: h.title,
      kind: 'habit',
      directionId: h.blockId || (directions[0] && directions[0].id) || 'soul',
      locationId: (h.locs && h.locs[0]) || 'any',
      inLiteRhythm: (src.flex && Array.isArray(src.flex.members) && src.flex.members.includes("habit:" + h.id)) || !!h.inDay || !!h.key,
      inDayPlan: h.inDay !== false,
      isKey: !!h.key,
      tempoMin: 'gentle',
      schedule: 'daily',
      dailyNorm: Number(h.dailyTarget) || 1,
      dueDate: null,
      coins: Number(h.reward) || 10,
      xp: Number(h.reward) || 10,
      status: h.status === 'archived' ? 'completed' : 'active',
      cycle: 1
    });
  }

  const quests = (src.quests || []).map(q => ({
    id: q.id,
    title: q.title,
    directionId: q.blockId || (directions[0] && directions[0].id) || 'soul',
    qtype: q.type === 'counter' ? 'counter' : 'checklist',
    targetCount: Number(q.target) || 5,
    currentCount: Number(q.progress) || 0,
    steps: Array.isArray(q.steps) ? q.steps.map(st => ({ id: st.id || genId('qs'), text: st.title || st.text || 'Шаг', done: !!st.done })) : [],
    coins: Number(q.reward) || 40,
    xp: Number(q.reward) || 40,
    linkedBonusId: (q.bonus && q.bonus[0]) || null,
    status: q.status === 'completed' ? 'completed' : 'active'
  }));

  const calendar = (src.cal || []).map(c => ({
    id: c.id,
    title: c.title,
    directionId: c.blockId || (directions[0] && directions[0].id) || 'soul',
    baseDate: c.date || curDate,
    time: c.time || '',
    repeat: (c.repeat && c.repeat.type) || 'none',
    daysOfWeek: (c.repeat && c.repeat.days) || [],
    until: c.until || null,
    exceptions: Object.fromEntries(Object.entries(c.exceptions || {}).map(([ek, ev]) => [ek, { movedTo: ev.movedTo || ev.date || ek, movedTime: ev.movedTime || ev.time || "", cancelled: !!ev.cancelled }])),
    coins: Number(c.reward) || 10,
    xp: Number(c.reward) || 10,
    status: c.status === 'archived' ? 'archived' : 'active'
  }));

  const coinsSum = (src.ledger || []).reduce((acc, l) => acc + (Number(l.coins || l.delta || l.amount) || 0), 0);
  const xpSum = (src.ledger || []).reduce((acc, l) => acc + Math.max(0, Number(l.xp || l.amount) || 0), 0);

  const bonuses = (src.offers || []).map(o => ({
    id: o.id,
    title: o.title,
    cost: Number(o.cost || o.price) || 40,
    repeatable: o.once === false
  }));

  return {
    version: 'hybrid-1.0',
    currentDate: curDate,
    calcMode: 'pro',
    liteFreezeActive: false,
    flexChanges: [],
    specialMode: 'none',
    theme: src.settings && src.settings.style === 'dawn' ? 'dawn' : (src.settings && src.settings.style === 'pop' ? 'pop' : 'night'),
    tempo: 'normal',
    locationManual: 'any',
    motivationText: (src.settings && src.settings.motivation) || 'Маленькие шаги к тому, что действительно важно.',
    showMotivation: true,
    compactHero: false,
    waypointDirId: directions[0] ? directions[0].id : 'soul',
    mapLens: false,
    mapLinksVisible: false,
    targetBonusId: bonuses[0] ? bonuses[0].id : null,
    redConfig: {
      directionId: directions[0] ? directions[0].id : 'soul',
      goalTitle: '',
      care: { sleep: false, water: false, rest: false }
    },
    wallet: { coins: Math.max(0, coinsSum), xp: Math.max(0, xpSum) },
    directions: directions.length ? directions : buildCleanHybridState().directions,
    mapLinks: [],
    items,
    quests,
    calendar,
    bonuses: bonuses.length ? bonuses : [{ id: 'bon_default', title: 'Приятный вечер отдыха', cost: 40, repeatable: true }],
    ownedBonuses: [],
    treats: (src.treats || []).map(tr => ({ id: tr.id || genId('tr'), text: tr.title || tr.text || 'Радость', count: 0 })),
    wordCommitments: (src.decisions || []).map(dc => ({ id: dc.id, title: dc.title, dueDate: dc.deadline || curDate, stake: Number(dc.stake) || 25, status: dc.status || 'active' })),
    inbox: (src.inbox || []).map(inb => ({ id: inb.id, text: inb.title || inb.text || '', date: curDate })),
    facts: (src.facts || []).map(f => ({
      id: f.id || genId('f'),
      kind: f.kind || 'task',
      itemId: f.ref || f.itemId,
      occurrenceKey: f.occurrence || f.date || curDate,
      date: f.date || curDate,
      coins: Number(f.reward) || 0,
      xp: Number(f.reward) || 0
    })),
    timeLogs: (src.timeLog || []).map(tl => ({
      id: tl.id || genId('tl'),
      itemId: String(tl.ref || '').split(':')[1] || tl.ref,
      date: tl.date || curDate,
      minutes: Number(tl.minutes) || 5
    })),
    ledger: [],
    happyMoments: (src.happy || []).map(hp => ({ id: hp.id || genId('hm'), date: hp.date || curDate, text: hp.text || '' })),
    reflections: [],
    misses: [],
    snapshots: []
  };
}

function buildAiExportPrompt(state, opts) {
  const lines = [];
  lines.push(`# Пакет осмысления LifeGame Hybrid (${opts.fromDate} .. ${opts.toDate})`);
  lines.push(`Режим запроса: ${opts.mode === 'strategy' ? 'Стратегический разбор Карты' : (opts.mode === 'audit' ? 'Анализ прогресса и ритма' : 'Спокойный совет на день')}`);
  lines.push(`Текущий калькулятор: ${state.calcMode === 'lite' ? 'Лайт (простой ритм)' : 'Про (полный конструктор)'}`);
  lines.push('');

  if (opts.catStrategy) {
    lines.push('## Направления и этапы (Факт -> Текущий этап -> Оазис оптимума -> Маяк LVMG)');
    state.directions.filter(d => !opts.selectedDirs.length || opts.selectedDirs.includes(d.id)).forEach(d => {
      lines.push(`- **${d.name}** [${d.id}]: Факт="${d.fact}" | Сейчас="${d.currentStage.title}" | Оптимум="${d.optimal}" | Неизвестное="${d.unknownGap}" | LVMG="${d.lvmg}"`);
    });
    lines.push('');
  }

  if (opts.catActions) {
    lines.push('## Дела, нормы привычек и частичные минуты за 7 дней');
    state.items.filter(i => i.status === 'active').forEach(it => {
      const eff = get7DayEffort(state, it.id);
      const norm = getEffectiveNorm(it, state.currentDate);
      lines.push(`- [${it.kind}] "${it.title}" (сфера: ${it.directionId}, норма/день: ${norm}, в Лайт: ${it.inLiteRhythm ? 'да' : 'нет'}${it.dueDate ? ', дата: ' + it.dueDate : ''}) -> 7 дн.: ${eff.completedCount} отм., ${eff.partialCount} частичных дн., ${eff.weekMinutes} мин.`);
    });
    lines.push('');
  }

  if (opts.catReflections && state.reflections.length) {
    lines.push('## Вечерние заметки пользователя');
    state.reflections.filter(r => r.date >= opts.fromDate && r.date <= opts.toDate).slice(0, 7).forEach(r => {
      lines.push(`- ${r.date} [${r.moodLabel}]: "${r.text}"`);
    });
    lines.push('');
  }

  lines.push('## Инструкция для модели');
  lines.push('Опирайся только на переданные записи. Не обесценивай Оптимум ради LVMG, учитывай частичные минуты как реальный вклад и береги простоту дня.');
  if (opts.format === 'json') {
    lines.push('В конце ответа добавь JSON для выборочного импорта: {"proposals":[{"type":"add_item","title":"...","directionId":"...","kind":"habit","inLiteRhythm":true},{"type":"hypothesis","directionId":"...","unknownGap":"..."}]}');
  }
  const fullText = lines.join('\n');
  return fullText.slice(0, Number(opts.maxChars) || 40000);
}

function getRealTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildIcsContent(ev, dateIso) {
  const cleanDate = (dateIso || ev.baseDate || getRealTodayISO()).replace(/-/g, '');
  const cleanTime = (ev.time || '12:00').replace(':', '') + '00';
  const dtStart = `${cleanDate}T${cleanTime}`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LifeGame Hybrid//RU',
    'BEGIN:VEVENT',
    `UID:${ev.id}@lifegame.local`,
    `DTSTART:${dtStart}`,
    `SUMMARY:${String(ev.title || 'Событие').replace(/\n/g, ' ')}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

function getWeeklyRhythmStats(state) {
  const wds = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const bars = [];
  let maxScore = 1;
  let totalMins7 = 0;
  let totalDone7 = 0;
  const touchedDirs = new Set();

  for (let i = 6; i >= 0; i--) {
    const iso = addDaysISO(state.currentDate, -i);
    const dayFacts = state.facts.filter(f => f.date === iso && f.kind !== 'habitStep');
    const dayMins = state.timeLogs.filter(t => t.date === iso).reduce((s, t) => s + (Number(t.minutes) || 0), 0);
    dayFacts.forEach(f => {
      const it = state.items.find(x => x.id === f.itemId);
      if (it && it.directionId) touchedDirs.add(it.directionId);
    });
    state.timeLogs.filter(t => t.date === iso).forEach(tl => {
      const it = state.items.find(x => x.id === tl.itemId);
      if (it && it.directionId) touchedDirs.add(it.directionId);
    });
    totalMins7 += dayMins;
    totalDone7 += dayFacts.length;
    const score = dayFacts.length * 15 + dayMins;
    if (score > maxScore) maxScore = score;
    bars.push({ iso, wd: wds[weekdayUTC(iso)], isToday: i === 0, done: dayFacts.length, mins: dayMins, score });
  }

  bars.forEach(b => {
    b.pct = b.score === 0 ? 6 : Math.max(14, Math.round((b.score / maxScore) * 100));
  });

  const cutoff30 = addDaysISO(state.currentDate, -29);
  const mins30 = state.timeLogs.filter(t => t.date >= cutoff30 && t.date <= state.currentDate).reduce((s, t) => s + (Number(t.minutes) || 0), 0);
  const done30 = state.facts.filter(f => f.date >= cutoff30 && f.date <= state.currentDate && f.kind !== 'habitStep').length;

  return { bars, totalMins7, totalDone7, spheresCount: touchedDirs.size, mins30, done30 };
}

function buildWeeklyShareSummary(state) {
  const wk = getWeeklyRhythmStats(state);
  const lv = levelInfoFromXp(state.wallet.xp);
  const lines = [
    `✨ Мой спокойный итог недели в LifeGame (${state.currentDate})`,
    `• Уровень ${lv.level} (${state.wallet.coins} ● в копилке)`,
    `• За 7 дней: ${wk.totalDone7} завершённых шагов и ${wk.totalMins7} минут живой практики`,
    `• Согрето сфер жизни: ${wk.spheresCount} из ${state.directions.length}`
  ];
  if (state.reflections[0]) {
    lines.push(`• Вечерняя мысль: «${state.reflections[0].text}»`);
  }
  return lines.join('\n');
}
