// LifeGame 2.0 Unified — Справочники, иконки, послания и начальные миры (Демо 10 земель + Чистая жизнь)

const LG_ICONS = {
  heart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  activity: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  brain: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04Z"/></svg>',
  coins: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>',
  users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  layers: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>',
  compass: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
  guitar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  baby: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/></svg>',
  map: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>',
  sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  zap: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  sparkles: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>',
  gift: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>',
  mic: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
  radar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/><path d="M4 6h.01"/><path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/><path d="M12 18h.01"/><path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"/><circle cx="12" cy="12" r="2"/><path d="m13.41 10.59 5.66-5.66"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  clock: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  pin: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'
};

const EVENING_MESSAGES = (typeof FULL_EVENING_MESSAGES !== 'undefined' && FULL_EVENING_MESSAGES.length) ? FULL_EVENING_MESSAGES : [
  "Пять или восемь честных минут практики значат для живого ритма больше, чем идеальный план на бумаге.",
  "День не обязан быть подвигом. Достаточно того, что ты остался в контакте с тем, что тебе действительно важно.",
  "Даже если сегодня удалось сделать лишь один тихий шаг — опора сохранена, а завтра начнётся без долгов.",
  "Оптимум — это тёплый дом, в котором уже хорошо, а не промежуточная станция на пути к чужим рекордам.",
  "Отдых — не пауза в жизни и не сбой стратегии, а часть самого маршрута.",
  "То, что ты заметил свою усталость вовремя, — признак зрелой навигации, а не слабости.",
  "Большая карта никуда не исчезнет за ночь: сегодня можно спокойно выдохнуть и отпустить список дел.",
  "Каждое записанное наблюдение делает будущую стратегию точнее, даже если день прошёл совсем не по плану."
];

const HAPPINESS_SPARKS = (typeof FULL_HAPPINESS_MESSAGES !== 'undefined' && FULL_HAPPINESS_MESSAGES.length) ? FULL_HAPPINESS_MESSAGES : [
  "Чашка горячего чая у окна без телефона на 7 минут",
  "Прогулка в удобном темпе без наушников — послушать город и ветер",
  "Сыграть три любимых аккорда просто для удовольствия, без метронома",
  "Написать короткое тёплое сообщение близкому человеку",
  "Десять минут тишины с закрытыми глазами посреди дня",
  "Записать одну вещь, которая сегодня неожиданно порадовала",
  "Проветрить комнату и зажечь мягкий вечерний свет"
];

const BASE_LOCATIONS = [
  { id: 'any', name: 'Везде', icon: '🌍' },
  { id: 'home', name: 'Дом', icon: '🏠' },
  { id: 'work', name: 'Работа', icon: '💼' },
  { id: 'road', name: 'В дороге', icon: '🚇' }
];

function createDemoDirections() {
  return [
    {
      id: 'soul',
      name: 'Душевное состояние',
      short: 'Душа',
      icon: 'heart',
      color: '#b48cff',
      nature: 'growth',
      terrain: 'Тихие воды',
      x: 450, y: 420,
      beaconX: 450, beaconY: 115,
      status: 'active',
      horizonRing: 'now',
      fact: 'Знаю свои главные триггеры перегруза, но вечером ещё бывает тревожный фон.',
      currentStage: {
        title: 'Учусь замечать состояние и бережно тормозить',
        strategy: 'Короткие паузы тишины днём и честный вечерний рассказ без самокритики.',
        goals: ['Спокойное засыпание 5 дней в неделю', 'Замечать усталость до срыва']
      },
      nextStage: 'Устойчивый спокойный фон недели без эмоциональных качелей',
      foldedStages: ['Своя система восстановления после сложных разговоров', 'Глубокая практика созерцания'],
      optimal: 'Внутренняя опора и тёплое спокойствие дома с самим собой',
      unknownGap: 'Неизвестно, какие практики подойдут через несколько лет и как изменится ритм жизни.',
      routeKnownToLvmg: false,
      lvmg: 'Ясность и внутренний свет даже в сильный жизненный шторм',
      beyond: 'Пространство за пределами нынешнего понимания тишины и любви'
    },
    {
      id: 'guitar',
      name: 'Гитара',
      short: 'Гитара',
      icon: 'guitar',
      color: '#ffda29',
      nature: 'growth',
      terrain: 'Звучащий каньон',
      x: 690, y: 360,
      beaconX: 775, beaconY: 85,
      status: 'active',
      horizonRing: 'now',
      fact: 'Знаю базовые открытые аккорды (Am, C, Dm, E, G), но сбиваюсь на бое и быстрых переходах.',
      currentStage: {
        title: 'Осваиваю ровный бой, ритм и мягкую смену аккордов',
        strategy: '15–25 минут спокойной игры под метроном 70 BPM без гонки за скоростью.',
        goals: ['Чистый переход Am–C–G–Em без паузы', 'Первая песня целиком ровным боем']
      },
      nextStage: 'Уверенно играю 5 любимых песен от начала до конца',
      foldedStages: ['Подбор простых мелодий на слух', 'Пение под свой аккомпанемент'],
      optimal: 'Душевно играю для 10–20 друзей в тёплой компании — мне этого полностью достаточно',
      unknownGap: 'Между уютным вечером для друзей и большой сценой — неизвестная территория: своя музыка, группа, звук, публика.',
      routeKnownToLvmg: false,
      lvmg: 'Сыграть живой концерт для 10 000 слушателей',
      beyond: 'То, что сейчас невозможно даже вообразить за пределами большой сцены'
    },
    {
      id: 'body',
      name: 'Физическое состояние',
      short: 'Тело',
      icon: 'activity',
      color: '#34d399',
      nature: 'growth',
      terrain: 'Зелёные холмы',
      x: 245, y: 350,
      beaconX: 175, beaconY: 95,
      status: 'active',
      horizonRing: 'now',
      fact: 'Базовая выносливость есть, но сидячая работа даёт скованность в спине и шее.',
      currentStage: {
        title: 'Возвращаю ежедневное движение, воду и режим сна',
        strategy: 'Ходьба без рекордов и короткая разминка спины между рабочими блоками.',
        goals: ['7 500+ шагов в обычные дни', 'Лёгкость в спине по утрам']
      },
      nextStage: 'Регулярные силовые/плавание 2 раза в неделю без перетренированности',
      foldedStages: ['Поход в горы на несколько дней без одышки'],
      optimal: 'Крепкое, живое, выносливое тело без боли и хронической усталости',
      unknownGap: 'Долгосрочная физиология через 15–20 лет пока скрыта временем.',
      routeKnownToLvmg: false,
      lvmg: 'Пиковая форма и свобода движения в любом возрасте',
      beyond: 'Открытый горизонт телесного долголетия'
    },
    {
      id: 'mind',
      name: 'Знания, навыки, опыт',
      short: 'Знания',
      icon: 'brain',
      color: '#38bdf8',
      nature: 'growth',
      terrain: 'Архипелаг смыслов',
      x: 310, y: 555,
      beaconX: 220, beaconY: 165,
      status: 'active',
      horizonRing: 'next',
      fact: 'Сильное продуктовое и системное мышление, опыт проектирования сложных механик.',
      currentStage: {
        title: 'Систематизирую исследовательские находки и чтение без инфошума',
        strategy: 'Спокойное вечернее чтение по 10–15 минут; даже 5 минут засчитываются в копилку внимания.',
        goals: ['Дочитать текущую книгу до конца месяца', 'Превращать идеи в ясные заметки']
      },
      nextStage: 'Собственная методология проектирования человекоцентричных систем',
      foldedStages: ['Публикация авторских эссе и разборов'],
      optimal: 'Глубокое мастерство, приносящее радость созидания и пользу людям',
      unknownGap: 'Новые технологические парадигмы следующих десятилетий ещё не открыты.',
      routeKnownToLvmg: false,
      lvmg: 'Создать продукт-ориентир, меняющий культуру бережной самоорганизации',
      beyond: 'Неведомые пока области знания'
    },
    {
      id: 'wealth',
      name: 'Ресурсы и материальное',
      short: 'Ресурсы',
      icon: 'coins',
      color: '#fbbf24',
      nature: 'growth',
      terrain: 'Каменная гавань',
      x: 595, y: 560,
      beaconX: 675, beaconY: 165,
      status: 'active',
      horizonRing: 'next',
      fact: 'Текущие базовые расходы закрыты, учёт обязательств ведётся аккуратно.',
      currentStage: {
        title: 'Укрепляю финансовую подушку и закрываю проектные поставки в срок',
        strategy: 'Прозрачные даты по счетам и ключевым отправкам без авралов.',
        goals: ['Подушка спокойствия на 6 месяцев', 'Ноль просроченных обязательств']
      },
      nextStage: 'Устойчивый доход от собственных продуктов и сильных проектов',
      foldedStages: ['Диверсифицированный капитал'],
      optimal: 'Спокойный достаток и свобода выбирать проекты по смыслу, а не из нужды',
      unknownGap: 'Масштабирование капитала зависит от будущих рынков и партнёрств.',
      routeKnownToLvmg: false,
      lvmg: 'Полная ресурсная независимость и возможность финансировать смелые замыслы',
      beyond: 'За пределами личной материальной задачи'
    },
    {
      id: 'people',
      name: 'Окружение и отношения',
      short: 'Люди',
      icon: 'users',
      color: '#f472b6',
      nature: 'care',
      terrain: 'Тёплый берег',
      x: 455, y: 650,
      beaconX: 455, beaconY: 205,
      status: 'oasis',
      horizonRing: 'oasis',
      fact: 'Есть близкий круг доверия и взаимного уважения.',
      currentStage: {
        title: 'Берегу живое тепло и не откладываю внимание к близким',
        strategy: 'Живые разговоры и встречи без спешки вместо формальных переписок.',
        goals: ['Еженедельный тёплый вечер с близкими']
      },
      nextStage: 'Новые единомышленники вокруг общих созидательных тем',
      foldedStages: [],
      optimal: 'Глубокие, честные и тёплые отношения — оазис уже ощущается здесь',
      unknownGap: 'Встречи будущих лет нельзя расписать как чертёж — и не нужно.',
      routeKnownToLvmg: false,
      lvmg: 'Сообщество близких по духу людей, где каждый растёт свободно',
      beyond: 'Открытая тайна человеческих встреч'
    },
    {
      id: 'order',
      name: 'Наполнение и организация',
      short: 'Порядок',
      icon: 'layers',
      color: '#a3e635',
      nature: 'growth',
      terrain: 'Ясная терраса',
      x: 195, y: 525,
      beaconX: 120, beaconY: 225,
      status: 'oasis',
      horizonRing: 'oasis',
      fact: 'Убрана лишняя суета, дела разделены на ритм и горизонты.',
      currentStage: {
        title: 'Поддерживаю чистоту рабочего пространства и лёгкий разбор Входящих',
        strategy: 'Раз в неделю спокойный обзор без перегруза.',
        goals: ['Чистый стол и понятный день за 2 минуты утром']
      },
      nextStage: 'Бесшовная связка дома, поездок и творческих периодов',
      foldedStages: [],
      optimal: 'Простая, дышащая организация жизни, которая не требует борьбы',
      unknownGap: 'Формат быта и ритма может естественно меняться.',
      routeKnownToLvmg: true,
      lvmg: 'Идеально соразмерный человеку уклад дня в любой точке мира',
      beyond: 'Естественная простота без инструментов'
    },
    {
      id: 'kids',
      name: 'Дети',
      short: 'Дети',
      icon: 'baby',
      color: '#fb923c',
      nature: 'care',
      terrain: 'Солнечная поляна',
      x: 685, y: 650,
      beaconX: 790, beaconY: 245,
      status: 'active',
      horizonRing: 'now',
      fact: 'Тёплый контакт; важно присутствие, игра и надёжность взрослого рядом (не «прокачка» ребёнка).',
      currentStage: {
        title: 'Качественное совместное время без отвлечения на экраны',
        strategy: 'Совместное чтение, прогулки, искренний интерес к их собственному миру.',
        goals: ['Живой ритуал общения каждый вечер']
      },
      nextStage: 'Поддержка самостоятельности и совместные маленькие приключения',
      foldedStages: [],
      optimal: 'Атмосфера безусловного доверия, безопасности и радости взросления',
      unknownGap: 'У каждого ребёнка свой собственный путь, которым нельзя управлять как проектом.',
      routeKnownToLvmg: false,
      lvmg: 'Взрослая тёплая дружба и взаимная опора через десятилетия',
      beyond: 'Их собственная большая жизнь'
    },
    {
      id: 'context',
      name: 'Обстоятельства',
      short: 'Условия',
      icon: 'compass',
      color: '#94a3b8',
      nature: 'shield',
      terrain: 'Ветреный перевал',
      x: 185, y: 700,
      beaconX: 115, beaconY: 615,
      status: 'paused',
      horizonRing: 'fog',
      fact: 'Внешняя среда переменчива; часть факторов не зависит от личных усилий.',
      currentStage: {
        title: 'Принятие реальности, запас прочности и защита границ',
        strategy: 'Не тратить силы на неподконтрольное; иметь спокойный план Б.',
        goals: ['Резервные копии документов и данных']
      },
      nextStage: 'Гибкая устойчивость к переменам сезона и среды',
      foldedStages: [],
      optimal: 'Спокойная защищённость и ясность действий при любых внешних ветрах',
      unknownGap: 'Внешние события по природе непредсказуемы.',
      routeKnownToLvmg: false,
      lvmg: 'Высокая автономия семьи и дома при любых обстоятельствах',
      beyond: 'Открытый внешний мир'
    },
    {
      id: 'exclude',
      name: 'Исключить',
      short: 'Убрать',
      icon: 'shield',
      color: '#f87171',
      nature: 'reduce',
      terrain: 'Тихий фильтр',
      x: 805, y: 525,
      beaconX: 835, beaconY: 410,
      status: 'active',
      horizonRing: 'now',
      fact: 'Ночной скроллинг ленты и перфекционизм в мелочах крадут вечерний ресурс.',
      currentStage: {
        title: 'Мягко убираю экранный шум за час до сна и лишние обязательства',
        strategy: 'Замещать автоматический скроллинг книгой или гитарой без самобичевания.',
        goals: ['Телефон вне спальни вечером']
      },
      nextStage: 'Свобода от навязанных срочностей и чужих ожиданий',
      foldedStages: [],
      optimal: 'Чистый эфир внимания — в жизни остаётся только подлинное',
      unknownGap: 'Новые соблазны суеты будут появляться, фильтр остаётся живым.',
      routeKnownToLvmg: true,
      lvmg: 'Полная ясность выбора и отсутствие хронических утечек энергии',
      beyond: 'Свободное пространство внимания'
    }
  ];
}

function createCleanDirections() {
  const base8 = [
    ['soul', 'Душевное состояние', 'Душа', 'heart', '#b48cff', 'growth', 'Тихие воды', 450, 420],
    ['body', 'Физическое состояние', 'Тело', 'activity', '#34d399', 'growth', 'Зелёные холмы', 250, 355],
    ['mind', 'Знания, навыки, опыт', 'Знания', 'brain', '#38bdf8', 'growth', 'Архипелаг смыслов', 310, 560],
    ['wealth', 'Ресурсы и материальное', 'Ресурсы', 'coins', '#fbbf24', 'growth', 'Каменная гавань', 600, 560],
    ['people', 'Окружение и отношения', 'Люди', 'users', '#f472b6', 'care', 'Тёплый берег', 455, 650],
    ['order', 'Наполнение и организация', 'Порядок', 'layers', '#a3e635', 'growth', 'Ясная терраса', 195, 535],
    ['context', 'Обстоятельства', 'Условия', 'compass', '#94a3b8', 'shield', 'Ветреный перевал', 205, 700],
    ['exclude', 'Исключить', 'Убрать', 'shield', '#f87171', 'reduce', 'Тихий фильтр', 725, 495]
  ];
  return base8.map(([id, name, short, icon, color, nature, terrain, x, y]) => ({
    id, name, short, icon, color, nature, terrain, x, y,
    beaconX: x, beaconY: Math.max(85, y - 270),
    status: 'active',
    horizonRing: 'now',
    fact: 'Ещё не заполнено — опиши честную точку опоры.',
    currentStage: {
      title: 'Сейчас (рабочий этап)',
      strategy: 'Определи ближайший посильный фокус без перегруза.',
      goals: []
    },
    nextStage: 'Следующий различимый переход',
    foldedStages: [],
    optimal: 'Оптимальный уровень достаточности (оазис)',
    unknownGap: 'Участок пути, который пока не нужно выдумывать заранее.',
    routeKnownToLvmg: false,
    lvmg: 'Дальний вообразимый ориентир (LVMG)',
    beyond: 'Открытый горизонт за пределами нынешнего представления'
  }));
}

function buildDemoWorldState() {
  // Base date: 2026-11-12
  return {
    version: '2.0-unified',
    currentDate: '2026-11-12',
    globalMode: 'full', // 'basic' | 'full' | 'red' | 'pause'
    basicFreezeActive: false,
    theme: 'night', // 'night' | 'dawn' | 'graphite'
    tempo: 'normal', // 'gentle' | 'normal' | 'intense'
    locationId: 'any',
    showMiniRadarOnToday: true,
    strictStageMode: false,
    mapVisualStyle: 'topo', // 'topo' | 'lens'
    showMapLinks: false,
    waypointDirectionId: 'guitar',
    redConfig: {
      directionId: 'guitar',
      goalTitle: 'Сыграть первую песню целиком ровным боем без остановок',
      periodDays: 10,
      startedDate: '2026-11-12',
      careChecks: { sleep: true, water: false, microBreak: false }
    },
    wallet: { coins: 145, xp: 230, level: 3 },
    locations: JSON.parse(JSON.stringify(BASE_LOCATIONS)),
    directions: createDemoDirections(),
    mapLinks: [
      ['soul', 'body'],
      ['soul', 'people'],
      ['body', 'guitar'],
      ['mind', 'wealth'],
      ['people', 'kids'],
      ['exclude', 'soul']
    ],
    items: [
      {
        id: 'act-guitar-rhythm',
        title: 'Гитара: переходы Am–C–G и ровный бой',
        kind: 'habit',
        directionId: 'guitar',
        locationId: 'home',
        inBasicRhythm: true,
        inTodayConstructor: true,
        isKey: true,
        tempoMin: 'gentle',
        schedule: 'daily',
        dailyNorm: 1,
        dueDate: null,
        dueTime: null,
        coins: 15,
        xp: 20,
        estMinutes: 20,
        status: 'active',
        cycle: 1
      },
      {
        id: 'act-reading',
        title: 'Спокойное вечернее чтение книги',
        kind: 'habit',
        directionId: 'mind',
        locationId: 'home',
        inBasicRhythm: true,
        inTodayConstructor: true,
        isKey: false,
        tempoMin: 'gentle',
        schedule: 'daily',
        dailyNorm: 1,
        dueDate: null,
        dueTime: null,
        coins: 10,
        xp: 15,
        estMinutes: 15,
        status: 'active',
        cycle: 1
      },
      {
        id: 'act-walk',
        title: 'Прогулка без наушников и разминка спины',
        kind: 'habit',
        directionId: 'body',
        locationId: 'any',
        inBasicRhythm: true,
        inTodayConstructor: true,
        isKey: false,
        tempoMin: 'normal',
        schedule: 'daily',
        dailyNorm: 1,
        dueDate: null,
        dueTime: null,
        coins: 10,
        xp: 15,
        estMinutes: 25,
        status: 'active',
        cycle: 1
      },
      {
        id: 'act-send-project',
        title: 'Отправить финальный пакет архитектуры проекта',
        kind: 'task',
        directionId: 'wealth',
        locationId: 'work',
        inBasicRhythm: true,
        inTodayConstructor: true,
        isKey: true,
        tempoMin: 'normal',
        schedule: 'once',
        dailyNorm: 1,
        dueDate: '2026-11-14',
        dueTime: '18:00',
        coins: 25,
        xp: 30,
        estMinutes: 40,
        status: 'active',
        cycle: 1
      },
      {
        id: 'act-kids-evening',
        title: 'Живой вечер с детьми без телефонов',
        kind: 'habit',
        directionId: 'kids',
        locationId: 'home',
        inBasicRhythm: false,
        inTodayConstructor: true,
        isKey: false,
        tempoMin: 'normal',
        schedule: 'weekdays_custom',
        daysOfWeek: [2, 4, 6, 0],
        dailyNorm: 1,
        dueDate: null,
        dueTime: '19:30',
        coins: 15,
        xp: 20,
        estMinutes: 30,
        status: 'active',
        cycle: 1
      },
      {
        id: 'act-calendar-call',
        title: 'Созвон по ревью стратегии и бюджета',
        kind: 'calendar',
        directionId: 'wealth',
        locationId: 'work',
        inBasicRhythm: true,
        inTodayConstructor: true,
        isKey: false,
        tempoMin: 'gentle',
        schedule: 'dated',
        dailyNorm: 1,
        dueDate: '2026-11-12',
        dueTime: '16:00',
        coins: 15,
        xp: 15,
        estMinutes: 30,
        status: 'active',
        cycle: 1
      },
      {
        id: 'act-quest-song',
        title: 'Квест: Разобрать первую песню для друзей (4 части)',
        kind: 'quest',
        directionId: 'guitar',
        locationId: 'home',
        inBasicRhythm: false,
        inTodayConstructor: false,
        isKey: false,
        tempoMin: 'intense',
        schedule: 'once',
        dailyNorm: 1,
        questSteps: [
          { id: 'qs1', text: 'Выбрать песню в удобной тональности', done: true },
          { id: 'qs2', text: 'Отработать куплет ровным боем', done: true },
          { id: 'qs3', text: 'Связать куплет и припев без паузы', done: false },
          { id: 'qs4', text: 'Сыграть целиком и записать черновик на диктофон', done: false }
        ],
        coins: 50,
        xp: 60,
        linkedBonusId: 'bon-strings',
        estMinutes: 30,
        status: 'active',
        cycle: 1
      },
      {
        id: 'act-sketch-past',
        title: 'Быстрый скетч карандашом в блокноте',
        kind: 'task',
        directionId: 'soul',
        locationId: 'home',
        inBasicRhythm: false,
        inTodayConstructor: false,
        isKey: false,
        tempoMin: 'normal',
        schedule: 'once',
        dailyNorm: 1,
        dueDate: null,
        dueTime: null,
        coins: 10,
        xp: 12,
        estMinutes: 10,
        status: 'completed',
        cycle: 1
      }
    ],
    // Facts (full completions) & TimeLogs (including partial minutes on non-completed days — LAB-015 F-001!)
    facts: [
      { id: 'f-1', itemId: 'act-reading', date: '2026-11-07', coins: 10, xp: 15, locationName: 'Дом', cycle: 1 },
      { id: 'f-2', itemId: 'act-reading', date: '2026-11-10', coins: 10, xp: 15, locationName: 'Дом', cycle: 1 },
      { id: 'f-3', itemId: 'act-guitar-rhythm', date: '2026-11-08', coins: 15, xp: 20, locationName: 'Дом', cycle: 1 },
      { id: 'f-4', itemId: 'act-guitar-rhythm', date: '2026-11-11', coins: 15, xp: 20, locationName: 'Дом', cycle: 1 },
      { id: 'f-5', itemId: 'act-walk', date: '2026-11-11', coins: 10, xp: 15, locationName: 'Везде', cycle: 1 },
      { id: 'f-6', itemId: 'act-walk', date: '2026-11-12', coins: 10, xp: 15, locationName: 'Везде', cycle: 1 },
      { id: 'f-7', itemId: 'act-sketch-past', date: '2026-11-09', coins: 10, xp: 12, locationName: 'Дом', cycle: 1 }
    ],
    timeLogs: [
      { id: 'tl-1', itemId: 'act-reading', date: '2026-11-07', minutes: 15, note: 'Глава 1' },
      { id: 'tl-2', itemId: 'act-reading', date: '2026-11-08', minutes: 5, note: 'Короткое чтение перед сном (частичное усилие)' },
      { id: 'tl-3', itemId: 'act-reading', date: '2026-11-09', minutes: 8, note: 'В метро и дома (частичное усилие)' },
      { id: 'tl-4', itemId: 'act-reading', date: '2026-11-10', minutes: 14, note: 'Спокойный вечер' },
      { id: 'tl-5', itemId: 'act-reading', date: '2026-11-12', minutes: 6, note: 'Утренние страницы' },
      { id: 'tl-6', itemId: 'act-guitar-rhythm', date: '2026-11-08', minutes: 20, note: 'Метроном 68 BPM' },
      { id: 'tl-7', itemId: 'act-guitar-rhythm', date: '2026-11-09', minutes: 7, note: 'Размял пальцы и связку Am-C' },
      { id: 'tl-8', itemId: 'act-guitar-rhythm', date: '2026-11-11', minutes: 25, note: 'Куплет звучит ровно!' },
      { id: 'tl-9', itemId: 'act-walk', date: '2026-11-12', minutes: 25, note: 'Парк после обеда' }
    ],
    inbox: [
      { id: 'inb-1', text: 'Попробовать каподастр на 2 ладу для мягкого звучания голоса', createdAt: '2026-11-11', tag: 'Гитара' },
      { id: 'inb-2', text: 'Идея: раз в месяц устраивать «день без планов и часов» всей семьёй', createdAt: '2026-11-12', tag: 'Люди' }
    ],
    bonuses: [
      { id: 'bon-coffee', title: 'Утренний фильтр-кофе в любимой тихой кофейне', cost: 40, repeatable: true, targetGoal: true },
      { id: 'bon-strings', title: 'Новый комплект мягких фосфорно-бронзовых струн', cost: 120, repeatable: false, targetGoal: false },
      { id: 'bon-cinema', title: 'Поход в кино или концерт без рабочих чатов', cost: 90, repeatable: true, targetGoal: false }
    ],
    ownedBonuses: [
      { id: 'own-1', bonusId: 'bon-coffee', title: 'Утренний фильтр-кофе в любимой тихой кофейне', paidCost: 40, boughtDate: '2026-11-10', used: false, refunded: false }
    ],
    wordCommitments: [
      { id: 'wc-1', title: 'Не открывать рабочие мессенджеры после 21:30 до конца недели', dueDate: '2026-11-15', stakeCoins: 30, status: 'active' }
    ],
    happyMoments: [
      { id: 'hm-1', date: '2026-11-11', text: 'Впервые получился чистый переход с C на G без взгляда на гриф!' },
      { id: 'hm-2', date: '2026-11-12', text: 'Свежий ноябрьский воздух в парке и тишина в голове.' }
    ],
    reflections: [
      {
        id: 'ref-1',
        date: '2026-11-11',
        mood: 'calm',
        moodLabel: 'Спокойно и тепло',
        text: 'День прошёл ровно. Вечером взял гитару всего на 20 минут, но почувствовал, что рука перестала зажиматься. Очень помогает не гнаться за максимумом.',
        privateOnly: true,
        reply: EVENING_MESSAGES[0]
      }
    ],
    snapshots: [
      {
        id: 'snap-initial',
        name: 'Осенняя стратегия (до экспериментов)',
        createdAt: '2026-11-11 20:00',
        note: 'Базовый снимок 10 направлений и утреннего/вечернего ритма',
        directionsCount: 10,
        itemsCount: 8,
        payload: null // populated lazily or on first snapshot
      }
    ]
  };
}

function buildCleanPersonalState() {
  return {
    version: '2.0-unified',
    currentDate: '2026-11-12',
    globalMode: 'basic',
    basicFreezeActive: true,
    theme: 'night',
    tempo: 'normal',
    locationId: 'any',
    showMiniRadarOnToday: false,
    strictStageMode: false,
    mapVisualStyle: 'topo',
    showMapLinks: false,
    waypointDirectionId: 'soul',
    redConfig: {
      directionId: 'soul',
      goalTitle: '',
      periodDays: 7,
      startedDate: '2026-11-12',
      careChecks: { sleep: false, water: false, microBreak: false }
    },
    wallet: { coins: 0, xp: 0, level: 1 },
    locations: JSON.parse(JSON.stringify(BASE_LOCATIONS)),
    directions: createCleanDirections(),
    mapLinks: [],
    items: [],
    facts: [],
    timeLogs: [],
    inbox: [],
    bonuses: [
      { id: 'bon-rest', title: 'Спокойный вечер с любимым фильмом или книгой', cost: 35, repeatable: true, targetGoal: true }
    ],
    ownedBonuses: [],
    wordCommitments: [],
    happyMoments: [],
    reflections: [],
    snapshots: []
  };
}
