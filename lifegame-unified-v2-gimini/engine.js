// LifeGame 2.0 Unified — Доменное ядро, безопасное хранилище, звук, экономика, снимки стратегий и ИИ-партнёр

const STORAGE_KEYS = {
  demo: 'lifegame_u2_demo_v1',
  personal: 'lifegame_u2_personal_v1',
  meta: 'lifegame_u2_meta_v1'
};

const MEM_STORE = {};

function safeLoad(key, fallbackFn) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    if (MEM_STORE[key]) return JSON.parse(JSON.stringify(MEM_STORE[key]));
  }
  const fresh = fallbackFn();
  safeSave(key, fresh);
  return fresh;
}

function safeSave(key, value) {
  const serialized = JSON.stringify(value);
  MEM_STORE[key] = JSON.parse(serialized);
  try {
    window.localStorage.setItem(key, serialized);
    window.localStorage.setItem(key + '_last_good', serialized);
  } catch (e) {
    // Canvas / private mode fallback remains in MEM_STORE
  }
}

// Web Audio API gentle sound synthesizer (starts only after user gesture)
const SoundFX = {
  ctx: null,
  muted: false,
  ensure() {
    if (this.muted) return null;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    } catch (e) {
      return null;
    }
  },
  play(kind) {
    const ctx = this.ensure();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (kind === 'complete') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.09);
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.start(now);
        osc.stop(now + 0.34);
      } else if (kind === 'minutes') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(554.37, now + 0.14);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.24);
      } else if (kind === 'waypoint') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(392, now);
        osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.18);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {}
  }
};

function uid(prefix) {
  return prefix + '-' + Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36).slice(-4);
}

function shiftDateISO(isoDate, deltaDays) {
  const parts = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function getLast7Days(currentDate) {
  const res = [];
  const shortNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  for (let i = 6; i >= 0; i--) {
    const iso = shiftDateISO(currentDate, -i);
    const p = iso.split('-').map(Number);
    const wd = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
    res.push({ iso, dayNum: String(p[2]), weekday: shortNames[wd], isToday: i === 0 });
  }
  return res;
}

function formatHumanDate(isoDate) {
  if (!isoDate) return '';
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const weekdays = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
  const p = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return `${weekdays[dt.getUTCDay()]} · ${p[2]} ${months[p[1] - 1]} ${p[0]}`;
}

function computeLevelFromXp(xp) {
  return Math.max(1, Math.floor(Math.max(0, xp) / 100) + 1);
}

function getItemEffortSummary(state, itemId) {
  const days = getLast7Days(state.currentDate);
  let totalWeekMinutes = 0;
  let completedDays = 0;
  let partialDays = 0;

  const strip = days.map(d => {
    const hasFact = state.facts.some(f => f.itemId === itemId && f.date === d.iso);
    const mins = state.timeLogs
      .filter(t => t.itemId === itemId && t.date === d.iso)
      .reduce((acc, t) => acc + (Number(t.minutes) || 0), 0);
    totalWeekMinutes += mins;
    if (hasFact) completedDays++;
    else if (mins > 0) partialDays++;
    return {
      ...d,
      done: hasFact,
      minutes: mins,
      stateClass: hasFact ? 'done' : (mins > 0 ? 'partial' : 'idle')
    };
  });

  const todayDone = state.facts.some(f => f.itemId === itemId && f.date === state.currentDate);
  const todayMinutes = state.timeLogs
    .filter(t => t.itemId === itemId && t.date === state.currentDate)
    .reduce((acc, t) => acc + (Number(t.minutes) || 0), 0);

  return { strip, totalWeekMinutes, completedDays, partialDays, todayDone, todayMinutes };
}

function getVisibleTodayItems(state) {
  const activeItems = state.items.filter(it => it.status === 'active');

  if (state.globalMode === 'pause') {
    // Creative pause: only explicit dated calendar obligations for today
    return activeItems.filter(it => it.kind === 'calendar' && it.dueDate === state.currentDate);
  }

  if (state.globalMode === 'basic') {
    return activeItems.filter(it => it.inBasicRhythm || (it.kind === 'calendar' && it.dueDate === state.currentDate));
  }

  if (state.globalMode === 'red') {
    const focusDir = state.redConfig.directionId;
    return activeItems.filter(it =>
      it.directionId === focusDir ||
      (it.kind === 'calendar' && it.dueDate === state.currentDate)
    );
  }

  // Full mode: respects location & tempo & constructor (while keeping key & today dated items visible)
  const tempoRank = { gentle: 1, normal: 2, intense: 3 };
  const curTempo = tempoRank[state.tempo] || 2;

  return activeItems.filter(it => {
    if (state.locationId !== 'any' && it.locationId !== 'any' && it.locationId !== state.locationId) {
      return false;
    }
    if (it.kind === 'calendar' && it.dueDate === state.currentDate) return true;
    if (it.isKey) return true;
    if (!it.inTodayConstructor) return false;
    const itemRank = tempoRank[it.tempoMin || 'normal'] || 2;
    return itemRank <= curTempo;
  });
}

function createStrategySnapshot(state, customName, note) {
  const snapPayload = {
    directions: JSON.parse(JSON.stringify(state.directions)),
    items: JSON.parse(JSON.stringify(state.items)),
    mapLinks: JSON.parse(JSON.stringify(state.mapLinks)),
    globalMode: state.globalMode,
    redConfig: JSON.parse(JSON.stringify(state.redConfig))
  };
  const snap = {
    id: uid('snap'),
    name: customName || ('Снимок стратегии от ' + state.currentDate),
    createdAt: state.currentDate,
    note: note || 'Сохранено перед изменением стратегии (опыт и факты защищены)',
    directionsCount: state.directions.length,
    itemsCount: state.items.filter(i => i.status === 'active').length,
    payload: snapPayload
  };
  state.snapshots.unshift(snap);
  return snap;
}

function buildAiPromptPackage(state, opts) {
  const modeTitles = {
    daily: 'Оперативный бережный совет на сегодня',
    audit: 'Анализ устойчивости, частичных усилий и препятствий за неделю',
    strategy: 'Стратегический разбор Карты жизни, Оптимума и горизонтов LVMG'
  };
  const formatInstructions = {
    text: 'Дай структурированный, честный и поддерживающий разбор без давления и оценок личности.',
    plan: 'Предложи 2–4 конкретных посильных шага внутри текущих рабочих этапов без перегруза.',
    json: 'В конце ответа обязательно добавь блок JSON формата {"proposals":[{"type":"add_item","title":"...","directionId":"...","kind":"habit","estMinutes":15},{"type":"update_hypothesis","directionId":"...","unknownGap":"..."}]}, чтобы пользователь мог выборочно применить предложения в LifeGame 2.0.'
  };

  const lines = [];
  lines.push('# Контекст пользователя LifeGame 2.0 Unified');
  lines.push(`Дата контекста: ${state.currentDate}`);
  lines.push(`Текущий режим сложности: ${state.globalMode} (темп: ${state.tempo})`);
  lines.push(`Запрос: ${modeTitles[opts.mode] || modeTitles.daily}`);
  lines.push('');

  if (opts.includeDirections) {
    lines.push('## Жизненные направления и горизонты (Факт ≠ Текущий этап → Оптимум → LVMG)');
    state.directions.forEach(d => {
      lines.push(`- **${d.name}** [${d.id}] (${d.status}):`);
      lines.push(`  - Фактическое положение: ${d.fact}`);
      lines.push(`  - Текущий рабочий этап: ${d.currentStage.title} (стратегия этапа: ${d.currentStage.strategy})`);
      lines.push(`  - Оптимальный ориентир (достаточность): ${d.optimal}`);
      lines.push(`  - Неизвестное / разрыв маршрута: ${d.unknownGap}`);
      lines.push(`  - Дальний маяк LVMG: ${d.lvmg}`);
    });
    lines.push('');
  }

  if (opts.includeActions) {
    lines.push('## Активные действия и статистика за 7 дней (включая частичные минуты)');
    state.items.filter(i => i.status === 'active').forEach(it => {
      const eff = getItemEffortSummary(state, it.id);
      lines.push(`- [${it.kind}] "${it.title}" (сфера: ${it.directionId}, в базовом ритме: ${it.inBasicRhythm ? 'да' : 'нет'}${it.dueDate ? ', срок: ' + it.dueDate : ''}) -> за 7 дн.: ${eff.completedDays} полных отметок, ${eff.partialDays} дней частичной практики, всего ${eff.totalWeekMinutes} мин.`);
    });
    lines.push('');
  }

  if (opts.includeReflections && state.reflections.length > 0) {
    lines.push('## Субъективные вечерние рефлексии (разрешено пользователем)');
    state.reflections.slice(0, 5).forEach(r => {
      lines.push(`- ${r.date} [${r.moodLabel}]: "${r.text}"`);
    });
    lines.push('');
  }

  if (opts.includeEconomy) {
    lines.push(`## Игровой баланс: ${state.wallet.coins} монет, ${state.wallet.xp} XP (Уровень ${state.wallet.level})`);
    lines.push('');
  }

  lines.push('## Правила ответа для модели');
  lines.push('1. Помни главный принцип LifeGame: система помогает человеку жить проще и осознаннее, а не подчиняет его планам.');
  lines.push('2. Не обесценивай Оптимум ради LVMG и учитывай частичные минуты практики как реальный вклад.');
  lines.push('3. ' + (formatInstructions[opts.format] || formatInstructions.text));

  return lines.join('\n');
}

function generateLocalAiInsight(state) {
  const totalWeekMins = state.timeLogs
    .filter(t => t.date >= shiftDateISO(state.currentDate, -6) && t.date <= state.currentDate)
    .reduce((s, t) => s + (Number(t.minutes) || 0), 0);
  const weekFacts = state.facts.filter(f => f.date >= shiftDateISO(state.currentDate, -6) && f.date <= state.currentDate).length;
  const todayVisible = getVisibleTodayItems(state);
  const todayPlannedMins = todayVisible.reduce((s, i) => s + (Number(i.estMinutes) || 15), 0);

  const insights = [];
  insights.push(`За последние 7 дней сохранено **${totalWeekMins} мин.** живой практики и **${weekFacts}** полных отметок. Частичные подходы сохранены в истории и работают на устойчивость привычек.`);

  if (state.globalMode === 'red') {
    const dir = state.directions.find(d => d.id === state.redConfig.directionId);
    const careDone = Object.values(state.redConfig.careChecks || {}).filter(Boolean).length;
    insights.push(`Активен **Красный режим (Мобилизация)** вокруг сферы «${dir ? dir.name : 'Приоритет'}». Опоры восстановления сегодня отмечены на **${careDone}/3** — береги сон и короткие паузы, чтобы рывок не перешёл в выгорание.`);
  } else if (todayPlannedMins > 120) {
    insights.push(`Сегодняшний набор в плане тянет примерно на **${todayPlannedMins} мин.** Если день плотный, переключи темп на «Бережно» или оставь 2–3 опорных дела в Базовом ритме.`);
  } else {
    insights.push(`Нагрузка на сегодня соразмерная (**~${todayPlannedMins} мин.** по ${todayVisible.length} делам). Отличный баланс для спокойного движения внутри текущих этапов.`);
  }

  const datedSoon = state.items.filter(i => i.status === 'active' && i.dueDate && i.dueDate >= state.currentDate);
  if (datedSoon.length > 0) {
    insights.push(`На горизонте есть структурные обязательства с датой (${datedSoon.map(d => `«${d.title}» — ${d.dueDate}`).join(', ')}). Они защищены от потери даже при смене режима.`);
  }

  return insights;
}

function parseAiProposalsInput(rawText, state) {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return [];
  // Try extracting JSON block first
  const jsonMatch = trimmed.match(/\{[\s\S]*"proposals"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      if (Array.isArray(obj.proposals)) {
        return obj.proposals.map((p, idx) => ({
          id: 'prop-' + idx,
          accepted: true,
          type: p.type || 'add_item',
          title: p.title || 'Новое действие от ИИ',
          directionId: p.directionId || (state.directions[0] ? state.directions[0].id : 'soul'),
          kind: p.kind || 'task',
          estMinutes: Number(p.estMinutes) || 15,
          unknownGap: p.unknownGap || ''
        }));
      }
    } catch (e) {}
  }
  // Fallback: parse markdown bullet lines into actionable steps
  const bullets = trimmed.split('\n')
    .map(l => l.replace(/^[\s\-*0-9.)]+/, '').trim())
    .filter(l => l.length > 5 && !l.startsWith('#') && !l.startsWith('{'));
  return bullets.slice(0, 5).map((line, idx) => ({
    id: 'prop-b-' + idx,
    accepted: true,
    type: 'add_item',
    title: line.slice(0, 110),
    directionId: state.waypointDirectionId || (state.directions[0] ? state.directions[0].id : 'soul'),
    kind: 'task',
    estMinutes: 15,
    unknownGap: ''
  }));
}
