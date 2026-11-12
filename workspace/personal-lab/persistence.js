/* Persistence protections adapted from next/store.js for Claude's v2 model. */
(function(){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const bad=m=>{throw Error(m)};
  const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
  const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(x);
  const int=(x,min=0,max=1e9)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
  const day=x=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;const [y,m,d]=x.split('-').map(Number),v=new Date(y,m-1,d,12);return v.getFullYear()===y&&v.getMonth()===m-1&&v.getDate()===d};
  function safeTree(v,depth=0){
    if(depth>40)bad('Слишком сложная структура файла.');
    if(v&&typeof v==='object')for(const k of Object.keys(v)){if(['__proto__','prototype','constructor'].includes(k))bad('Недопустимое поле файла.');safeTree(v[k],depth+1)}
    if(typeof v==='number'&&!Number.isFinite(v))bad('Некорректное число.');
  }
  function defaultLocations(){return [['home','Дом','🏠'],['work','Работа','💼'],['road','В дороге','🚗']].map(([id,name,icon])=>({id,name,icon,blocks:[],homeHide:[],dayHide:[],widgets:null,muteOther:false,tempo:null,style:null}))}
  function defaultLocState(){return {schedule:[],fallback:null,manual:null,otherNoMiss:false,tagNew:true,lastSeen:null}}
  function locationUpgrade(s){
    s.settings.style ||= 'quest';
    if(s.locations===undefined&&s.loc===undefined){s.locations=defaultLocations();s.loc=defaultLocState()}
    for(const items of [s.tasks,s.habits,s.quests,s.cal])for(const x of items)x.locs??=[];
    for(const b of s.blocks)b.loc??=null;
    for(const h of s.habits){h.dailyTarget??=1;h.norms??=[]}for(const c of s.cal){c.repeat??={type:'none',days:[]};c.exceptions??={};c.retained??=[];c.until??=null;c.reminderLead??=15;c.reminderReceipts??={}}
    return s;
  }
  function validate(s){
    safeTree(s);
    if(!obj(s)||s.v!==2||!['my','demo'].includes(s.space)||!day(s.created)||!day(s.lastProcessed))bad('Это не поддерживаемое сохранение LifeGame.');
    for(const k of ['blocks','achievements','stages','goals','tasks','habits','quests','cal','decisions','inbox','recent','facts','ledger','offers','insts','treats','misses','sessions','timeLog','happy'])if(!Array.isArray(s[k]))bad('Повреждён раздел: '+k);
    for(const k of ['settings','days','focus','creative','widgets','timer','graph','rhythm','ui'])if(!obj(s[k]))bad('Повреждены настройки: '+k);
    if(!obj(s.settings.sessions)||!obj(s.settings.onboarding)||!obj(s.settings.onboarding.done)||!obj(s.settings.onboarding.skipped)||!Array.isArray(s.focus.blocks)||!Array.isArray(s.widgets.mine)||!obj(s.widgets.inDay))bad('Повреждены настройки разделов.');
    for(const k of ['weekday','weekend'])if(!Array.isArray(s.graph[k])||s.graph[k].length!==24)bad('В графике должно быть 24 часа.');
    const ids=new Set();for(const k of ['blocks','achievements','stages','goals','tasks','habits','quests','cal','decisions','inbox','facts','ledger','offers','insts','treats','misses','sessions','timeLog','happy'])for(const x of s[k]){if(!obj(x)||!id(x.id)||ids.has(x.id))bad('Повреждены идентификаторы: '+k);ids.add(x.id)}
    const blocks=new Set(s.blocks.map(x=>x.id)),stages=new Set(s.stages.map(x=>x.id)),goals=new Map(s.goals.map(x=>[x.id,x]));
    const title=(x,field)=>{if(typeof x[field]!=='string'||x[field].length>10000)bad('Повреждён текст записи.')};
    const status=(x,list)=>{if(!list.includes(x.status))bad('Неизвестное состояние записи.')};
    const link=x=>{if(x.blockId&&!blocks.has(x.blockId)||x.stageId&&!stages.has(x.stageId))bad('Неверная связь с направлением или этапом.');if(x.stageId&&s.stages.find(a=>a.id===x.stageId).blockId!==x.blockId)bad('Этап другого направления.');if(x.goalId&&(!goals.has(x.goalId)||goals.get(x.goalId).stageId!==x.stageId))bad('Цель другого этапа.')};
    for(const b of s.blocks){title(b,'name');status(b,['active','archived']);if(!obj(b.secs)||['ach','fact','cur','plan','opt','unk','lvmg','dec','missed','sched'].some(k=>typeof b.secs[k]!=='boolean')||!['high','mid','low'].includes(b.priority)||!['aggr','bal','light'].includes(b.intensity))bad('Повреждена структура блока.');if(b.currentStageId&&!s.stages.some(a=>a.id===b.currentStageId&&a.blockId===b.id))bad('Неверный текущий этап.')}
    for(const a of s.stages){title(a,'name');if(!blocks.has(a.blockId)||!Number.isFinite(a.order))bad('Повреждён этап.');status(a,['open','done','archived'])}
    for(const g of s.goals){title(g,'title');if(!stages.has(g.stageId))bad('Цель без этапа.');status(g,['active','achieved','abandoned'])}
    function schedule(x,allowed){const a=x.sched;if(!obj(a)||!allowed.includes(a.type)||!Array.isArray(a.days)||a.days.some(n=>!int(n,1,7))||a.date&&!day(a.date)||['weekly','days'].includes(a.type)&&!a.days.length)bad('Повреждено расписание.');}
    for(const k of ['tasks','habits','quests','cal'])for(const x of s[k]){title(x,'title');link(x);status(x,k==='quests'?['active','completed','closed','archived']:['active','closed','archived']);if(typeof x.inDay!=='boolean'||!day(x.created))bad('Повреждены настройки действия.');if(k==='cal'){if(!day(x.date)||!int(x.reward)||x.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time))bad('Повреждено календарное дело.')}else{schedule(x,k==='tasks'?['once','daily','weekly','days']:k==='habits'?['daily','weekly','days','whenever']:['whenever','daily','days']);if(!Array.isArray(x.fit)||x.fit.some(a=>!['rest','normal','hard'].includes(a))||!Array.isArray(x.tags)||typeof x.cat!=='string')bad('Повреждены фильтры действия.');if(k!=='quests'&&!int(x.reward))bad('Неверная награда.');if(k==='habits'&&(!obj(x.goal)||!['total','period'].includes(x.goal.mode)||!['week','month'].includes(x.goal.period)||!int(x.goal.target,1)||!int(x.goal.reward)||!int(x.level,1)||!Array.isArray(x.levelLog)))bad('Повреждена цель привычки.');if(k==='quests'&&(!['counter','checklist'].includes(x.type)||!int(x.target,1)||!int(x.stepReward)||!int(x.finalReward)||!Array.isArray(x.steps)||x.type==='checklist'&&(!x.steps.length||new Set(x.steps.map(z=>z.id)).size!==x.steps.length)||x.steps.some(z=>!id(z.id)||typeof z.title!=='string')))bad('Повреждены шаги квеста.')}}
    for(const x of s.offers){title(x,'title');status(x,['active','archived']);if(!int(x.price)||!['once','unlimited','limited'].includes(x.use)||!int(x.limit,1)||!Array.isArray(x.tags))bad('Повреждён бонус.')}
    for(const x of s.insts){title(x,'title');status(x,['reserved','owned','spent','refunded']);if(!['once','unlimited','limited'].includes(x.use)||!int(x.limit,1)||!int(x.used)||!int(x.paid)||!Array.isArray(x.uses)||x.uses.some(d=>!day(d))||x.used!==x.uses.length)bad('Повреждены использования бонуса.');if(x.cond&&(!obj(x.cond)||!['task','habit','quest','stage'].includes(x.cond.k)||!id(x.cond.id)))bad('Повреждён резерв.')}
    const factKinds=['task','habit','cal','questStep','questFinal','habitGoal','habitStep','stage'];
    for(const f of s.facts)if(!factKinds.includes(f.kind)||!id(f.ref)||!day(f.date)||!int(f.coins)||!int(f.xp)||typeof f.cancelled!=='boolean'||!Number.isFinite(f.ts)||typeof f.title!=='string'||f.insts&&!Array.isArray(f.insts))bad('Повреждена история выполнений.');
    for(const l of s.ledger)if(!['earn','spend','reversal','penalty','compensation','refund'].includes(l.type)||!int(l.coins,-1e9)||!int(l.xp,-1e9)||!day(l.date)||!Number.isFinite(l.ts))bad('Повреждён финансовый журнал.');
    for(const key of ['coins','xp'])if(!Number.isSafeInteger(s.ledger.reduce((n,l)=>n+l[key],0)))bad('Слишком большой баланс.');
    for(const x of s.decisions){title(x,'text');status(x,['active','done','failed','cancelled']);if(x.stageId&&!stages.has(x.stageId)||!int(x.priceC)||!int(x.priceX)||x.deadline&&!Number.isFinite(Date.parse(x.deadline)))bad('Повреждено решение.')}
    for(const x of s.misses)if(!['task','habit','quest','cal'].includes(x.kind)||!id(x.ref)||!day(x.date)||!['active','archived'].includes(x.status))bad('Повреждён пропуск.');
    for(const [d,v]of Object.entries(s.days))if(!day(d)||!obj(v)||!['rest','normal','hard'].includes(v.tempo)||!['added','removed','forced'].every(k=>Array.isArray(v[k])))bad('Повреждён дневной план.');
    for(const x of s.sessions)if(!['daily','weekly','monthly'].includes(x.level)||typeof x.key!=='string'||!day(x.date)||!obj(x.answers))bad('Повреждена сессия.');
    for(const x of s.timeLog)if(!day(x.date)||!int(x.minutes,0,1440))bad('Повреждено время.');
    for(const x of s.inbox)title(x,'text');for(const x of s.treats){title(x,'title');status(x,['active','archived'])}
    if(!['ready','running','paused','done'].includes(s.timer.state)||!int(s.timer.minutes,1,180)||!Number.isFinite(s.timer.remaining)||s.timer.remaining<0)bad('Повреждён таймер.');
    const bools=(x,keys)=>{if(keys.some(k=>typeof x[k]!=="boolean"))bad("Повреждён переключатель настроек.")};
    const text=(v)=>{if(typeof v!=="string"||v.length>10000)bad("Повреждён текст.")};
    const ref=v=>typeof v==="string"&&/^(task|habit|quest|cal):[A-Za-z0-9_-]{1,120}(@\d{4}-\d{2}-\d{2})?$/.test(v)&&(!v.includes('@')||v.startsWith('cal:')&&day(v.split('@')[1]));
    bools(s.settings,["lite","reminders"]);text(s.settings.motivation);
    if(!["blue","green","purple","orange"].includes(s.settings.accent))bad("Неизвестный акцент.");
    bools(s.settings.sessions,["all","daily","weekly","monthly"]);
    bools(s.settings.onboarding,["on"]);if(!day(s.settings.onboarding.start))bad("Повреждена дата обучения.");
    for(const flags of [s.settings.onboarding.done,s.settings.onboarding.skipped])for(const [k,v]of Object.entries(flags))if(!/^[0-6]$/.test(k)||typeof v!=="boolean")bad("Повреждены шаги обучения.");
    bools(s.focus,["on","calOther","calUnlinked"]);bools(s.creative,["on","mute"]);
    if(s.focus.blocks.some(x=>!blocks.has(x))||s.creative.since!==null&&!day(s.creative.since))bad("Повреждены фокус или пауза.");
    const widgetIds=["timer","firststep","graph","happiness","rhythm","myreward"];
    if(s.widgets.mine.some(x=>!widgetIds.includes(x))||Object.entries(s.widgets.inDay).some(([k,v])=>!widgetIds.includes(k)||typeof v!=="boolean"))bad("Неизвестный виджет.");
    if(s.graph.weekday.concat(s.graph.weekend).some(x=>x!==""&&x!=="sleep"&&!blocks.has(x)))bad("Повреждены направления графика.");
    if(!int(s.rhythm.target,1,7)||!Array.isArray(s.rhythm.rest)||s.rhythm.rest.some(x=>!int(x,1,7)))bad("Повреждён ритм недели.");
    for(const [k,v]of Object.entries(s.ui)){
      if(k.startsWith("q_")||k.startsWith("cat_"))text(v);
      else if(v!==null&&typeof v==="object"&&(!Array.isArray(v)||v.some(x=>typeof x!=="string")))bad("Повреждены настройки экрана.");
    }
    if(s.ui.archTab&&!["tasks","habits","quests","cal","offers","blocks"].includes(s.ui.archTab))bad("Неизвестный раздел архива.");
    if(s.ui.graphT&&!["weekday","weekend"].includes(s.ui.graphT))bad("Неизвестный шаблон суток.");
    text(s.timer.label);if(s.timer.ref!==null&&!ref(s.timer.ref)||s.timer.state==="running"&&!Number.isFinite(s.timer.endsAt)||s.timer.remaining>180*60)bad("Повреждён запущенный таймер.");
    for(const x of s.timeLog){text(x.label);if(x.ref!==null&&!ref(x.ref))bad("Повреждена ссылка учёта времени.")}
    for(const x of s.happy){text(x.text);if(!day(x.date)||typeof x.fav!=="boolean")bad("Повреждена коллекция моментов.")}
    for(const x of s.recent)if(!obj(x)||typeof x.k!=="string"||!id(x.id)||!Number.isFinite(x.at))bad("Повреждены недавние записи.");
    for(const x of s.sessions)for(const [q,a]of Object.entries(x.answers)){text(q);text(a)}
    for(const x of s.decisions){if(x.deadline&&(!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(x.deadline)||!day(x.deadline.slice(0,10))))bad("Неверный срок решения.");if(x.paidC!==undefined&&!int(x.paidC)||x.paidX!==undefined&&!int(x.paidX))bad("Повреждена Цена слова.")}
    for(const x of s.achievements){text(x.title);text(x.text);text(x.period);if(!blocks.has(x.blockId))bad("Достижение без направления.")}
    for(const x of [...s.blocks,...s.stages]){for(const k of x.name!==undefined?["meaning"]:[])text(x[k]);if(x.bonus!==undefined&&!Array.isArray(x.bonus))bad("Повреждено назначение бонуса.")}
    for(const g of s.goals)text(g.review||"");
    for(const x of [...s.tasks,...s.habits,...s.quests]){for(const k of ["desc","ifThen","cat"])text(x[k]);if(x.tags.some(t=>typeof t!=="string"))bad("Повреждён тег.")}
    for(const x of [...s.tasks,...s.quests,...s.stages,...s.habits.map(h=>h.goal)]){
      if(!Array.isArray(x.bonus)||x.bonus.some(o=>!id(o)))bad("Повреждено назначение награды.");
      if(x.bonusTerms!==undefined){if(!obj(x.bonusTerms))bad("Повреждены условия награды.");for(const [oid,t]of Object.entries(x.bonusTerms)){if(!id(oid)||!obj(t)||!int(t.limit,1)||!["once","limited","unlimited"].includes(t.use))bad("Повреждены условия награды.");text(t.title)}}
    }
    for(const x of s.facts){if(x.kind==="habitGoal"&&typeof x.pkey!=="string"||x.insts?.some(i=>!id(i))||x.consumed?.some(i=>!id(i)))bad("Повреждены зависимости выполнения.")}
    for(const d of Object.values(s.days))if([...(d.added||[]),...(d.removed||[]),...(d.forced||[])].some(x=>!ref(x)))bad("Повреждены ссылки дневного плана.");
    for(const l of s.ledger){if(["earn","refund","compensation"].includes(l.type)&&(l.coins<0||l.xp<0)||["spend","reversal","penalty"].includes(l.type)&&(l.coins>0||l.xp>0))bad("Неверное направление финансовой операции.")}
    for(const c of s.cal)LifeGamePlanning.validate(c);
    for(const h of s.habits){if(h.dailyTarget!==undefined&&!int(h.dailyTarget,1,50)||h.norms!==undefined&&(!Array.isArray(h.norms)||h.norms.some(x=>!obj(x)||!day(x.from)||!int(x.target,1,50))||new Set(h.norms.map(x=>x.from)).size!==h.norms.length))bad('Неверная дневная норма привычки.')}
    for(const f of s.facts){if(f.coins!==f.xp)bad('Награда выполнения должна давать одинаковые монеты и XP.');if(f.kind==='habitStep'&&(!int(f.target,1,50)||!int(f.dayReward)||f.coins!==0||f.xp!==0))bad('Неверный прогресс привычки.');if(f.occurrence!==undefined&&!day(f.occurrence)||f.scheduledDate!==undefined&&!day(f.scheduledDate))bad('Неверная дата появления.');if(f.parentStep!==undefined&&!id(f.parentStep)||f.habitFact!==undefined&&!id(f.habitFact))bad('Неверная связь прогресса.')}
    for(const m of s.misses)if(m.occurrence!==undefined&&!day(m.occurrence))bad('Неверное появление пропуска.');
    for(const l of s.ledger){if(l.type==='earn'&&l.coins!==l.xp||l.type==='reversal'&&l.coins!==l.xp||['spend','refund'].includes(l.type)&&l.xp!==0)bad('Неверное соотношение монет и опыта: заработок 1:1, покупки не тратят XP.')}
    for(const c of s.cal)if(c.reminderReceipts!==undefined&&(!obj(c.reminderReceipts)||Object.entries(c.reminderReceipts).some(([key,value])=>!day(key)||typeof value!=='string')))bad('Повреждена история напоминаний.');
    if(s.settings.lastExport!==undefined&&!day(s.settings.lastExport)||s.settings.backupSnooze!==undefined&&!day(s.settings.backupSnooze))bad('Неверная дата резервирования.');
    if(s.settings.style!==undefined&&!['quest','dawn','pop'].includes(s.settings.style))bad('Неизвестный стиль оформления.');
    if(s.locations!==undefined||s.loc!==undefined){
      if(!Array.isArray(s.locations)||!obj(s.loc))bad('Повреждены локации.');
      const lids=new Set();for(const l of s.locations){
        if(!obj(l)||!id(l.id)||lids.has(l.id))bad('Повреждён идентификатор локации.');lids.add(l.id);
        if(typeof l.name!=='string'||!l.name.trim()||l.name.length>60||typeof l.icon!=='string'||l.icon.length>30||!Array.isArray(l.blocks)||l.blocks.some(b=>!blocks.has(b)))bad('Повреждён профиль локации.');
        if(!Array.isArray(l.homeHide)||l.homeHide.some(x=>!['motivation','invites','modes','upcoming','decisions','grid'].includes(x))||!Array.isArray(l.dayHide)||l.dayHide.some(x=>!['key','cal','task','habit','quest','widgets','evening'].includes(x)))bad('Неизвестная часть интерфейса локации.');
        if(l.widgets!==null&&(!Array.isArray(l.widgets)||l.widgets.some(w=>!widgetIds.includes(w)))||typeof l.muteOther!=='boolean'||l.tempo!==null&&!['rest','normal','hard'].includes(l.tempo)||l.style!==null&&!['quest','dawn','pop'].includes(l.style))bad('Повреждены настройки профиля локации.');
      }
      const live=x=>x===null||lids.has(x),clock=x=>typeof x==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x);
      if(!Array.isArray(s.loc.schedule)||!live(s.loc.fallback)||typeof s.loc.otherNoMiss!=='boolean'||typeof s.loc.tagNew!=='boolean'||!live(s.loc.lastSeen))bad('Повреждены правила локаций.');
      const rids=new Set();for(const r of s.loc.schedule){if(!obj(r)||!id(r.id)||rids.has(r.id)||!lids.has(r.locId)||!Array.isArray(r.days)||!r.days.length||r.days.some(d=>!int(d,1,7))||new Set(r.days).size!==r.days.length||!clock(r.from)||!clock(r.to)||r.from===r.to)bad('Повреждено расписание локаций.');rids.add(r.id)}
      if(s.loc.manual!==null&&(!obj(s.loc.manual)||!live(s.loc.manual.id)||s.loc.manual.until!==null&&!int(s.loc.manual.until,0,Number.MAX_SAFE_INTEGER)))bad('Повреждён ручной выбор локации.');
      for(const x of [...s.tasks,...s.habits,...s.quests,...s.cal,...s.inbox])if(x.locs!==undefined&&(!Array.isArray(x.locs)||x.locs.some(l=>!lids.has(l))||new Set(x.locs).size!==x.locs.length))bad('Неверные локации записи.');
      for(const b of s.blocks)if(b.loc!==undefined&&!live(b.loc))bad('Локация блока отсутствует.');
      for(const d of Object.values(s.days))if(d.locsSeen!==undefined&&(!Array.isArray(d.locsSeen)||d.locsSeen.some(l=>l!=='*'&&!id(l)))||d.locOtherNoMiss!==undefined&&typeof d.locOtherNoMiss!=='boolean'||d.tempoManual!==undefined&&typeof d.tempoManual!=='boolean'||d.locProfileSeen!==undefined&&d.locProfileSeen!==null&&!id(d.locProfileSeen))bad('Повреждена история локаций дня.');
      for(const f of s.facts)if(f.loc!==undefined&&f.loc!==null&&!id(f.loc)||f.locationTitle!==undefined&&(typeof f.locationTitle!=='string'||f.locationTitle.length>150))bad('Повреждено место выполнения.');
    }
    if(s.revision!==undefined&&!int(s.revision,0,Number.MAX_SAFE_INTEGER))bad('Повреждена версия записи.');
    return s;
  }
  function upgrade(value){const s=locationUpgrade(clone(validate(value)));validate(s);s.revision ||=0;for(const [kind,items]of [['task',s.tasks],['quest',s.quests],['stage',s.stages],['habit',s.habits]])for(const x of items){const t=kind==='habit'?x.goal:x;t.bonusTerms ||= {};for(const oid of t.bonus||[]){const o=s.offers.find(z=>z.id===oid);if(o&&!t.bonusTerms[oid])t.bonusTerms[oid]={title:o.title,use:o.use,limit:o.use==='once'?1:o.limit}}}return s}
  class Repository{
    constructor(){this.snapshots=new Map();this.queue=Promise.resolve();this.commitSerial=0}
    storage(){try{return localStorage}catch{bad('Браузер запретил сохранения. Разрешите хранение данных и обновите страницу.')}}
    read(key){const raw=this.storage().getItem(key);this.snapshots.set(key,raw);return raw}
    assertCurrent(key){if(this.storage().getItem(key)!==this.snapshots.get(key))bad('Данные изменены в другой вкладке. Черновик оставлен: загрузите свежие данные и откройте запись заново.')}
    write(key,s,{replace=false}={}){
      this.assertCurrent(key);validate(s);const raw=this.snapshots.get(key),next=JSON.stringify(s),now=new Date(),date=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
      let prior=null;if(raw){try{validate(JSON.parse(raw));prior=JSON.parse(raw)}catch{}}
      const dailyRaw=this.storage().getItem(key+'-daily');let dailyDay=null;try{const d=JSON.parse(dailyRaw);if(d?.data){validate(d.data);dailyDay=d.day}}catch{}
      if(dailyDay!==date&&(prior||!raw)){const data=prior||s;this.storage().setItem(key+'-daily',JSON.stringify({day:date,savedAt:now.toISOString(),data}))}
      if(prior)this.storage().setItem(key+'-last-good',raw);
      this.storage().setItem(key,next);this.snapshots.set(key,next);this.commitSerial++;return next;
    }
    daily(key){const raw=this.storage().getItem(key+'-daily');if(!raw)bad('Копии на начало дня пока нет.');const value=JSON.parse(raw);if(!day(value.day))bad('Дата дневной копии повреждена.');return {...value,data:upgrade(value.data)}}

    exclusive(fn){const run=()=>navigator.locks?navigator.locks.request('lifegame-personal-lab-write',fn):fn();const p=this.queue.then(run,run);this.queue=p.catch(()=>{});return p}
    backup(key){const raw=this.storage().getItem(key+'-last-good');if(!raw)bad('Предыдущей исправной копии пока нет.');return upgrade(JSON.parse(raw))}
  }
  window.LifeGamePersistence={Repository,validate,upgrade,clone,day,defaultLocations,defaultLocState};
})();
