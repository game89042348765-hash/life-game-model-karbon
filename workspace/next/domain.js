/** LifeGame: pure domain model. Wall time is an explicit argument, never a test UI. */
export const VERSION = 1;
export const APP = 'LifeGame Next';
export const SECTION_NAMES = {achievements:'Достижения',fact:'Фактическое состояние',current:'Текущий этап',planned:'Планируемые этапы',optimal:'Оптимальный ориентир',unknown:'Неизвестное',lvmg:'LVMG',meaning:'Смысл и причина',goals:'Цели',tasks:'Задания',habits:'Привычки',quests:'Квесты',decisions:'Принятые решения',missed:'Невыполненные',scheduled:'Запланированное'};
export const BASE_BLOCKS = [['Душевное состояние','heart'],['Физическое состояние','activity'],['Знания, навыки, опыт','book'],['Ресурсы и материальное','wallet'],['Окружение и отношения','people'],['Наполнение и организация','star'],['Обстоятельства','compass'],['Исключить','circle']];
export const KINDS = {task:'Задание',habit:'Привычка',quest:'Квест',calendar:'Календарное дело',decision:'Решение',treat:'Ништяк',bonus:'Бонус',note:'Мысль'};
export const LOADS = {small:'Небольшая',normal:'Обычная',large:'Большая'};
export const TEMPOS = {rest:'Отдыхаю',normal:'Обычный день',intense:'Фигачу'};
export const TOOL_NAMES = {timer:'Время для важного',firstStep:'Первый шаг',budget:'Посильный план',rhythm:'Ритм недели',goalStep:'Шаг к цели',reward:'Моя награда',dayGraph:'График дня',happy:'Хорошее в жизни'};
const clone = x => structuredClone(x);
const fail = m => { throw new Error(m); };
export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
export const dayKey = (time = new Date()) => {const d=new Date(time);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const dayAdd = (key,n) => {const [y,m,d]=key.split('-').map(Number);return dayKey(new Date(y,m-1,d+n,12));};
export const weekday = key => {const [y,m,d]=key.split('-').map(Number);return new Date(y,m-1,d,12).getDay()||7;};
export const validDay = x => typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&dayAdd(x,0)===x;
export const periodStart = (date,period) => period==='month'?date.slice(0,7)+'-01':period==='week'?dayAdd(date,1-weekday(date)):'all';
const text = (x,max=2000) => String(x??'').trim().slice(0,max);
const number = (x,min=0,max=1000000000) => {const v=Number(x??0);if(!Number.isSafeInteger(v)||v<min||v>max)fail(`Нужно целое число от ${min} до ${max}.`);return v;};
const name = x => text(x,120)||fail('Введите название.');
export const live = x => !!x&&!x.archivedAt&&!x.deletedAt;
export const find = (s,id) => ['items','goals','stages','blocks','bonuses','instances','decisions','treats','notes','missed','moments'].flatMap(k=>s[k]||[]).find(x=>x.id===id)||null;
export const money = s => s.ledger.reduce((v,e)=>({coins:v.coins+e.coins,xp:v.xp+e.xp}),{coins:0,xp:0});
export const hero = s => {const {xp}=money(s);return {level:Math.max(1,Math.floor(Math.max(0,xp)/1000)+1),progress:Math.max(0,xp)%1000,debt:Math.max(0,-xp)};};
export const eventsFor = (s,id,kind) => s.events.filter(e=>e.active&&e.entityId===id&&(!kind||e.kind===kind));
export const itemStage = (s,i) => s.stages.find(x=>x.id===i.stageId)||null;
export const itemBlock = (s,i) => s.blocks.find(x=>x.id===itemStage(s,i)?.blockId)||null;
export const usable = (s,i) => live(i)&&(!i.stageId||live(itemStage(s,i))&&!itemStage(s,i).completedAt&&live(itemBlock(s,i)));
export const completed = (s,i) => ['task','calendar'].includes(i.kind)&&i.schedule.mode==='once'?eventsFor(s,i.id,i.kind).some(e=>e.taskCycle===i.taskCycle):i.kind==='quest'?eventsFor(s,i.id,'quest-final').length>0:!!i.closedAt;
export const progress = (s,i,date=null) => eventsFor(s,i.id,i.kind==='habit'?'habit':i.kind==='quest'?'quest-step':i.kind==='calendar'?'calendar':'task').filter(e=>!date||e.date===date).reduce((v,e)=>v+(e.units||1),0);
export function sections(preset='full') {return Object.fromEntries(Object.keys(SECTION_NAMES).map(k=>[k,preset==='full'||!['unknown','lvmg'].includes(k)]));}
function stage(s,blockId,title,role,now) {let order=s.stages.filter(x=>x.blockId===blockId).length;if(role==='step'){const anchor=s.stages.filter(x=>x.blockId===blockId&&x.role!=='step').sort((a,b)=>a.order-b.order)[0];if(anchor){order=anchor.order;for(const a of s.stages.filter(x=>x.blockId===blockId&&x.order>=order))a.order++;}}const x={id:uid(),blockId,name:title,role,meaning:'',cause:'',description:'',reward:0,bonusIds:[],order,createdAt:now,completedAt:null,archivedAt:null};s.stages.push(x);return x;}
function block(s,values,now) {
  const b={id:uid(),name:name(values.name),icon:values.icon||'star',fact:'',priority:2,intensity:'balanced',sections:sections(values.preset||'simple'),order:s.blocks.length,createdAt:now,archivedAt:null};s.blocks.push(b);
  b.currentStageId=stage(s,b.id,'Сейчас','step',now).id;
  stage(s,b.id,'Следующий этап','step',now);stage(s,b.id,'Оптимальный','optimal',now);stage(s,b.id,'Неизвестное','unknown',now);stage(s,b.id,'LVMG','lvmg',now);
  return b;
}
export function createState(time=new Date()) {
  const now=new Date(time).toISOString(),date=dayKey(time);
  const s={app:APP,version:VERSION,revision:0,createdAt:now,updatedAt:now,lastDay:date,blocks:[],stages:[],goals:[],items:[],events:[],ledger:[],bonuses:[],instances:[],rewardLinks:[],decisions:[],treats:[],notes:[],missed:[],moments:[],days:{},pauses:[],reviews:[],timer:null,timeSessions:[],settings:{sound:false,accent:'gold',focusBlocks:null,focusCalendar:true,focusUnboundCalendar:true,tools:['timer','firstStep','rhythm'],myTools:['timer','firstStep','rhythm'],reviewDismissals:{},reviewDaily:true,reviewWeekly:true,reviewMonthly:true,rewardTargetId:null,graph:{weekday:Array(24).fill(null),weekend:Array(24).fill(null)}}};
  BASE_BLOCKS.forEach(([n,icon])=>block(s,{name:n,icon,preset:'full'},now));
  syncDay(s,date);return s;
}
export function scheduleMatches(i,date) {
  const a=i.schedule;if(!a||a.start>date||(i.createdDate||dayKey(i.createdAt))>date)return false;
  if(a.mode==='any')return false;
  if(a.mode==='once')return a.date===date;
  return a.mode==='daily'||a.days.includes(weekday(date));
}
function paused(s,date) {return s.pauses.some(p=>p.start<=date&&(!p.end||date<=p.end));}
function loadLimit(s,i,date){const tempo=s.days[date]?.tempo||'normal',intensity=itemBlock(s,i)?.intensity||'balanced';if(tempo==='rest')return 0;return Math.min(2,({light:0,balanced:1,aggressive:2}[intensity]??1)+(tempo==='intense'?1:0));}
function day(s,date) {return s.days[date] ||= {tempo:'normal',includes:[],excludes:[],overrides:[],expected:[],budget:60,note:'',good:'',closedAt:null};}
function scheduledCandidates(s,date) {return s.items.filter(i=>usable(s,i)&&!i.closedAt&&(!completed(s,i)||progress(s,i,date)>0)&&scheduleMatches(i,date)&&(i.kind==='calendar'||i.inDay));}
function relieved(s,i,date) {
  const d=day(s,date);if(d.excludes.includes(i.id))return true;
  if(i.kind==='calendar'||d.overrides.includes(i.id))return false;
  if(paused(s,date))return true;
  const max=loadLimit(s,i,date),load={small:0,normal:1,large:2}[i.load]??1;
  return load>max;
}
function syncDay(s,date) {
  const d=day(s,date),candidates=scheduledCandidates(s,date);
  for(const id of d.includes){const i=s.items.find(x=>x.id===id);if(i&&usable(s,i)&&!i.closedAt&&(!completed(s,i)||progress(s,i,date)>0)&&!candidates.includes(i))candidates.push(i);}
  d.expected=candidates.filter(i=>!relieved(s,i,date)).map(i=>({id:i.id,kind:i.kind,name:i.name,units:i.kind==='habit'?i.dailyTarget||1:i.kind==='quest'?1:1}));
  d.materialized=true;
}
export function advance(s,time=new Date()) {
  const today=dayKey(time);if(!validDay(s.lastDay)||s.lastDay>today)return;
  let date=s.lastDay,n=0;
  while(date<today) {
    if(++n>20000)fail('Слишком большой диапазон дат. Проверьте дату устройства.');
    if(!s.days[date]?.materialized)syncDay(s,date);
    for(const e of day(s,date).expected) {
      const i=s.items.find(i=>i.id===e.id);if(!i)continue;
      const done=progress(s,i,date);
      if(done<e.units&&!s.missed.some(m=>m.itemId===i.id&&m.date===date))s.missed.push({id:uid(),itemId:i.id,kind:i.kind,name:e.name,date,stageId:i.stageId,units:e.units-done,archivedAt:null,deletedAt:null});
    }
    date=dayAdd(date,1);
  }
  s.lastDay=today;syncDay(s,today);
}
export function todayItems(s,date=dayKey()) {
  const d=s.days[date]||{includes:[],excludes:[],overrides:[],tempo:'normal'},list=[];
  for(const i of s.items) {
    const done=progress(s,i,date)>=(i.kind==='habit'?i.dailyTarget:1);
    if(!usable(s,i)&&!done)continue;
    const scheduled=scheduleMatches(i,date)&&i.inDay;
    if(!scheduled&&!d.includes.includes(i.id)&&!done)continue;
    if(completed(s,i)&&!done)continue;
    const reasons=[];
    if(d.excludes.includes(i.id)&&!done)reasons.push('Убрано из сегодняшнего плана');
    if(!done&&!d.overrides.includes(i.id)) {
      if(i.kind!=='calendar'&&paused(s,date))reasons.push('Творческая пауза');
      const max=loadLimit(s,i,date);
      if(i.kind!=='calendar'&&({small:0,normal:1,large:2}[i.load]??1)>max)reasons.push(itemBlock(s,i)?.intensity==='light'&&d.tempo!=='rest'?'Лайтовая стратегия направления':'Выбранный темп дня');
      const focus=s.settings.focusBlocks;
      if(focus) {
        const b=itemBlock(s,i);
        if(i.kind==='calendar'){if(b&&!focus.includes(b.id)&&!s.settings.focusCalendar||!b&&!s.settings.focusUnboundCalendar)reasons.push('Фокус на других направлениях');}
        else if(b&&!focus.includes(b.id))reasons.push('Фокус на других направлениях');
      }
    }
    list.push({item:i,done,hidden:reasons.length>0,reasons});
  }
  return list.sort((a,b)=>Number(b.item.key)-Number(a.item.key)||(itemBlock(s,b.item)?.priority||0)-(itemBlock(s,a.item)?.priority||0)||(a.item.order||0)-(b.item.order||0));
}
function schedule(v,now) {
  const a=v.schedule||{};const mode=['once','daily','weekly','days','any'].includes(a.mode)?a.mode:'once';
  const days=[...new Set((a.days||[]).map(x=>number(x,1,7)))].sort();
  if(['weekly','days'].includes(mode)&&!days.length)fail('Выберите дни недели.');
  if(mode==='once'&&!validDay(a.date||dayKey(now)))fail('Неверная дата.');
  return {mode,days:mode==='weekly'?days.slice(0,1):days,date:mode==='once'?(a.date||dayKey(now)):null,start:validDay(a.start)?a.start:dayKey(now)};
}
function checkedStage(s,id) {if(!id)return null;const a=s.stages.find(x=>x.id===id);if(!live(a)||a.completedAt||!live(s.blocks.find(b=>b.id===a.blockId))||['unknown','lvmg'].includes(a.role))fail('Выберите доступный незавершённый этап.');return a.id;}
function reward(s,e,coins,bonusIds=[],slot='main') {
  coins=number(coins);if(coins)s.ledger.push({id:uid(),eventId:e.id,coins,xp:coins,type:'earn',date:e.date,at:e.at,name:e.name});
  for(const bonusId of bonusIds||[]) {
    const b=s.bonuses.find(b=>b.id===bonusId);if(!b)fail('Награда отсутствует в магазине.');
    const link=s.rewardLinks.find(x=>x.sourceId===e.entityId&&x.slot===slot&&x.bonusId===bonusId);
    if(link?.limit===1&&s.instances.some(x=>x.linkId===link.id&&!x.revokedAt))continue;
    const snapshot=link||{name:b.name,limit:b.limit};
    s.instances.push({id:uid(),bonusId:b.id,name:snapshot.name,limit:snapshot.limit,uses:[],paid:0,eventId:e.id,linkId:link?.id||null,acquiredAt:e.at,refundedAt:null,revokedAt:null,archivedAt:null});
  }
}
function event(s,entity,kind,now,extra={}) {const st=entity.stageId?s.stages.find(x=>x.id===entity.stageId):s.stages.find(x=>x.id===entity.id),b=st?s.blocks.find(x=>x.id===st.blockId):null;const e={id:uid(),entityId:entity.id,name:entity.name,kind,date:dayKey(now),at:now,units:1,active:true,stageId:st?.id||null,stageName:st?.name||'',blockId:b?.id||null,blockName:b?.name||'',...extra};s.events.push(e);return e;}
function reverseEvent(s,e,now) {
  if(!e?.active)fail('Эта операция уже отменена.');
  const ins=s.instances.filter(x=>x.eventId===e.id&&!x.revokedAt);
  if(ins.some(x=>x.uses.length))fail('Награда уже использована. Это выполнение отменить нельзя.');
  const rows=s.ledger.filter(x=>x.eventId===e.id&&x.type!=='undo');
  const coins=-rows.reduce((v,x)=>v+x.coins,0),xp=-rows.reduce((v,x)=>v+x.xp,0);
  const before=money(s);
  if((coins<0&&before.coins+coins<0)||(xp<0&&before.xp+xp<0))fail('Награда уже потрачена или опыт в долге. Для отмены восстановите баланс.');
  if(coins||xp)s.ledger.push({id:uid(),eventId:e.id,coins,xp,type:'undo',date:dayKey(now),at:now,name:e.name});
  ins.forEach(x=>x.revokedAt=now);e.active=false;e.undoneAt=now;
}
function bindBonuses(s,sourceId,slot,ids=[]) {
  const selected=[...new Set(ids)];
  const existing=s.rewardLinks.filter(x=>x.sourceId===sourceId&&x.slot===slot);
  for(const id of selected) {
    if(existing.some(x=>x.bonusId===id))continue;
    const b=s.bonuses.find(x=>x.id===id&&live(x));if(!b)fail('Выбранный бонус недоступен.');
    if(b.limit===1&&s.rewardLinks.some(x=>x.bonusId===id&&(x.sourceId!==sourceId||x.slot!==slot)&&!s.instances.some(a=>a.linkId===x.id&&!a.revokedAt)))fail('Одноразовый бонус зарезервирован другой наградой. Сначала снимите резерв.');
    s.rewardLinks.push({id:uid(),sourceId,slot,bonusId:id,name:b.name,limit:b.limit});
  }
  s.rewardLinks=s.rewardLinks.filter(x=>x.sourceId!==sourceId||x.slot!==slot||selected.includes(x.bonusId));
}
function saveItem(s,v,now) {
  let i=s.items.find(x=>x.id===v.id);if(v.id&&!i)fail('Запись не найдена.');
  if(i&&!live(i))fail('Сначала восстановите запись из архива.');
  const kind=i?.kind||v.kind;if(!['task','habit','quest','calendar'].includes(kind))fail('Неизвестный тип действия.');
  const stageId=i&&v.stageId===i.stageId?i.stageId:checkedStage(s,v.stageId);
  const goalId=v.goalId||null;
  if(goalId&&!s.goals.some(g=>(live(g)&&g.status==='active'||i?.goalId===goalId)&&g.id===goalId&&g.stageId===stageId))fail('Цель должна принадлежать выбранному этапу.');
  const old=i?clone(i):null;
  if(!i){i={id:uid(),kind,createdAt:now,createdDate:dayKey(now),archivedAt:null,closedAt:null,order:s.items.length};s.items.push(i);}
  Object.assign(i,{name:name(v.name),description:text(v.description),stageId,goalId,leadsToGoal:!!goalId,inDay:!!v.inDay,key:kind==='task'&&!!v.key,load:Object.hasOwn(LOADS,v.load)?v.load:'normal',estimate:number(v.estimate,0,1440),favorite:!!v.favorite,tags:text(v.tags,300),category:text(v.category,80),schedule:schedule(v,now),reward:number(v.reward),bonusIds:[...new Set(v.bonusIds||[])],ifTrigger:text(v.ifTrigger,400),ifAction:text(v.ifAction,400),updatedAt:now});
  if(['task','calendar'].includes(kind)&&(!old||(old.schedule.mode==='once')!==(i.schedule.mode==='once')))i.taskCycle=uid();
  if(i.key&&!old?.key&&v.inDay!==false)i.inDay=true;
  if(kind==='calendar'){i.time=text(v.time,5);i.inDay=v.inDay!==false;i.remind=!!v.remind;i.notifiedDates ||= [];}
  if(kind==='habit') {
    i.dailyTarget=number(v.dailyTarget||1,1,1000);i.maxDaily=number(v.maxDaily??1,0,1000);
    if(i.maxDaily&&i.maxDaily<i.dailyTarget)fail('Лимит отметок меньше дневной цели.');
    const target=number(v.target),period=['all','week','month'].includes(v.period)?v.period:'all';
    i.milestoneReward=number(v.milestoneReward);i.milestoneBonusIds=v.milestoneBonusIds||[];
    if(!old||target!==old.target||period!==old.period)i.levelId=uid();
    i.target=target;i.period=period;
  }
  if(kind==='quest') {
    i.questType=v.questType==='checklist'?'checklist':'counter';
    i.step=number(v.step||1,1);i.finalReward=number(v.finalReward);i.finalBonusIds=v.finalBonusIds||[];
    const oldSteps=old?.steps||[];
    i.steps=(v.steps||[]).map((x,n)=>({id:x.id||uid(),name:name(x.name||x),order:n}));
    if(i.questType==='checklist'&&!i.steps.length)fail('Добавьте хотя бы один пункт квеста.');
    i.target=i.questType==='checklist'?i.steps.length:number(v.target||1,1);
    const doneSteps=eventsFor(s,i.id,'quest-step').map(e=>e.stepId).filter(Boolean);
    if(doneSteps.some(id=>!i.steps.some(x=>x.id===id)))fail('Нельзя удалить уже выполненный пункт. Сначала отмените его выполнение.');
    if(old&&eventsFor(s,i.id,'quest-step').length&&old.questType!==i.questType)fail('Тип начатого квеста изменить нельзя. Создайте отдельный квест.');
    if(progress(s,i)>i.target)fail('Цель не может быть меньше выполненного.');
    if(old&&completed(s,old)&&(i.target!==old.target||JSON.stringify(oldSteps)!==JSON.stringify(i.steps)))fail('Сначала отмените последний шаг завершённого квеста.');
  }
  bindBonuses(s,i.id,'main',i.bonusIds);
  if(kind==='habit')bindBonuses(s,i.id,'milestone',i.milestoneBonusIds);
  if(kind==='quest')bindBonuses(s,i.id,'final',i.finalBonusIds);
  return i;
}
function completeItem(s,id,now,values={}) {
  const i=s.items.find(x=>x.id===id);if(!i||!usable(s,i)||i.closedAt)fail('Действие недоступно. Восстановите его или откройте этап.');
  const date=dayKey(now);
  if(i.kind==='quest') {
    if(completed(s,i))fail('Квест уже завершён.');
    const amount=i.questType==='checklist'?1:Math.min(i.step,i.target-progress(s,i));
    const stepId=i.questType==='checklist'?(values.stepId||i.steps.find(x=>!eventsFor(s,i.id,'quest-step').some(e=>e.stepId===x.id))?.id):null;
    if(i.questType==='checklist'&&(!i.steps.some(x=>x.id===stepId)||eventsFor(s,i.id,'quest-step').some(e=>e.stepId===stepId)))fail('Этот пункт уже выполнен или удалён.');
    const e=event(s,i,'quest-step',now,{units:amount,stepId});reward(s,e,i.reward,i.bonusIds);
    if(progress(s,i)>=i.target){const f=event(s,i,'quest-final',now,{parentId:e.id});reward(s,f,i.finalReward,i.finalBonusIds,'final');}
  } else {
    if(i.kind==='task'&&(completed(s,i)||progress(s,i,date)))fail('Задание уже выполнено.');
    if(i.kind==='calendar'&&(completed(s,i)||progress(s,i,date)))fail('Дело уже выполнено.');
    if(i.kind==='habit'&&i.maxDaily&&progress(s,i,date)>=i.maxDaily)fail('Дневной лимит отметок достигнут.');
    const e=event(s,i,i.kind,now,['task','calendar'].includes(i.kind)?{taskCycle:i.taskCycle,scheduleMode:i.schedule.mode}:{});reward(s,e,i.reward,i.bonusIds);
    if(i.kind==='habit'&&i.target) {
      const period=periodStart(date,i.period),count=eventsFor(s,i.id,'habit').filter(e=>i.period==='all'||periodStart(e.date,i.period)===period).length;
      const key=`${i.levelId}:${period}`;
      if(count>=i.target&&!eventsFor(s,i.id,'habit-milestone').some(e=>e.milestoneKey===key)){const m=event(s,i,'habit-milestone',now,{parentId:e.id,milestoneKey:key,milestoneTarget:i.target,milestonePeriod:i.period,periodStart:period});reward(s,m,i.milestoneReward,i.milestoneBonusIds,'milestone');}
    }
  }
}
function undoItem(s,id,now) {
  const i=s.items.find(x=>x.id===id);if(!i)fail('Действие не найдено.');
  const kind=i.kind==='quest'?'quest-step':i.kind;
  const e=eventsFor(s,id,kind).at(-1);if(!e)fail('Нет выполнения для отмены.');
  for(const child of s.events.filter(x=>x.active&&x.parentId===e.id).reverse())reverseEvent(s,child,now);
  reverseEvent(s,e,now);
  const expected=s.days[e.date]?.expected.find(x=>x.id===id);if(expected&&e.date<dayKey(now)&&progress(s,i,e.date)<expected.units&&!s.missed.some(m=>m.itemId===id&&m.date===e.date))s.missed.push({id:uid(),itemId:id,kind:i.kind,name:expected.name,date:e.date,stageId:i.stageId,units:expected.units-progress(s,i,e.date),archivedAt:null,deletedAt:null});
}
export function evolve(state,type,v={},time=new Date()) {
  validate(state);const s=clone(state),now=new Date(time).toISOString(),date=dayKey(time);advance(s,time);
  const byId=id=>find(s,id)||fail('Запись не найдена.');
  switch(type) {
    case 'block.save': {
      const b=v.id?s.blocks.find(x=>x.id===v.id):block(s,v,now);if(!b)fail('Блок не найден.');
      Object.assign(b,{name:name(v.name),icon:v.icon||b.icon,fact:text(v.fact),priority:number(v.priority??b.priority,1,3),intensity:['light','balanced','aggressive'].includes(v.intensity)?v.intensity:b.intensity});
      if(v.sections)b.sections=Object.fromEntries(Object.keys(SECTION_NAMES).map(k=>[k,!!v.sections[k]]));break;
    }
    case 'stage.save': {
      const b=s.blocks.find(b=>b.id===v.blockId);if(!live(b))fail('Блок недоступен.');
      const a=v.id?s.stages.find(x=>x.id===v.id&&x.blockId===b.id):stage(s,b.id,name(v.name),v.role||'step',now);if(!a)fail('Этап не найден.');
      Object.assign(a,{name:name(v.name),meaning:text(v.meaning),cause:text(v.cause),description:text(v.description),reward:number(v.reward),bonusIds:v.bonusIds||[]});
      if(!v.id&&v.afterId){const anchor=s.stages.find(x=>x.id===v.afterId&&x.blockId===b.id);if(!anchor)fail('Место вставки этапа изменилось.');const ordered=s.stages.filter(x=>x.blockId===b.id&&x.id!==a.id).sort((x,y)=>x.order-y.order);ordered.splice(ordered.indexOf(anchor)+1,0,a);ordered.forEach((x,j)=>x.order=j);}
      bindBonuses(s,a.id,'main',a.bonusIds);break;
    }
    case 'stage.current': {const a=byId(checkedStage(s,v.id));byId(a.blockId).currentStageId=a.id;break;}
    case 'stage.move': {const a=byId(v.id),siblings=s.stages.filter(x=>x.blockId===a.blockId&&x.role==='step'&&live(x)).sort((a,b)=>a.order-b.order);const index=siblings.indexOf(a),other=siblings[index+Number(v.delta)];if(other)[a.order,other.order]=[other.order,a.order];break;}
    case 'stage.complete': {
      const a=byId(checkedStage(s,v.id));
      for(const i of s.items.filter(i=>i.stageId===a.id&&live(i)&&!i.closedAt&&!completed(s,i))) {
        const choice=v.choices?.[i.id];if(!choice)fail('Выберите, что делать с каждой незавершённой активностью.');
        if(choice.action==='close'){i.closedAt=now;i.closedByStageId=a.id;}
        else {i.stageId=choice.action==='move'?checkedStage(s,choice.stageId):null;i.goalId=null;i.leadsToGoal=false;}
      }
      a.completedAt=now;const e=event(s,a,'stage',now);reward(s,e,a.reward,a.bonusIds);
      const b=byId(a.blockId);if(b.currentStageId===a.id)b.currentStageId=v.nextStageId?checkedStage(s,v.nextStageId):null;break;
    }
    case 'stage.reopen': {const a=byId(v.id);const e=eventsFor(s,a.id,'stage').at(-1);if(e)reverseEvent(s,e,now);a.completedAt=null;for(const i of s.items.filter(i=>i.stageId===a.id&&i.closedByStageId===a.id)){i.closedAt=null;delete i.closedByStageId;}break;}
    case 'stage.past': {const a=stage(s,v.blockId,name(v.name),'step',now);a.description=text(v.description);a.completedAt=validDay(v.date)?v.date+'T12:00:00.000Z':now;a.historical=true;break;}
    case 'goal.save': {
      let g=s.goals.find(x=>x.id===v.id);if(v.id&&!g)fail('Цель не найдена.');const stageId=g&&g.stageId===v.stageId?g.stageId:checkedStage(s,v.stageId);if(!stageId)fail('Выберите этап для цели.');
      if(!g){g={id:uid(),createdAt:now,status:'active',archivedAt:null};s.goals.push(g);}
      if(g.stageId&&g.stageId!==stageId)for(const i of s.items.filter(i=>i.goalId===g.id)){if(v.moveLinked!==false)i.stageId=stageId;else{i.goalId=null;i.leadsToGoal=false;}}
      Object.assign(g,{name:name(v.name),stageId,description:text(v.description),criterion:text(v.criterion,500),ifTrigger:text(v.ifTrigger,400),ifAction:text(v.ifAction,400)});break;
    }
    case 'goal.status': {const g=byId(v.id);if(!['active','achieved','abandoned'].includes(v.status))fail('Неизвестный исход цели.');if(g.status===v.status)fail('Этот исход уже записан.');g.status=v.status;g.closedAt=v.status==='active'?null:now;g.reason=text(v.reason,500);if(v.status==='achieved')event(s,g,'goal',now,{outcome:v.status});else {for(const e of eventsFor(s,g.id,'goal'))e.active=false;event(s,g,'goal-status',now,{outcome:v.status,reason:g.reason});}break;}
    case 'item.save': {if(v.newGoalName?.trim()&&!v.goalId){const stageId=checkedStage(s,v.stageId);const g={id:uid(),name:name(v.newGoalName),stageId,status:'active',createdAt:now,archivedAt:null,description:'',criterion:'',ifTrigger:'',ifAction:''};s.goals.push(g);v={...v,goalId:g.id};}const item=saveItem(s,v,now);if(v.includeToday&&item.inDay){const d=day(s,date);if(!d.includes.includes(item.id))d.includes.push(item.id);if(!d.overrides.includes(item.id))d.overrides.push(item.id);}break;}
    case 'item.plan': {const i=byId(v.id);i.inDay=!!v.value;break;}
    case 'item.key': {const i=byId(v.id);if(i.kind!=='task')fail('Ключевым может быть задание.');i.key=!i.key;if(i.key)i.inDay=true;break;}
    case 'item.close': {const i=byId(v.id);i.closedAt=now;break;}
    case 'item.reopen': {const i=byId(v.id);i.closedAt=null;delete i.closedByStageId;break;}
    case 'item.complete': completeItem(s,v.id,now,v);break;
    case 'item.undo': undoItem(s,v.id,now);break;
    case 'item.move': {const i=byId(v.id);i.stageId=checkedStage(s,v.stageId);i.goalId=v.goalId||null;i.leadsToGoal=!!i.goalId;break;}
    case 'item.copy': {const i=byId(v.id);const values=clone(i);delete values.id;values.name=text(v.name,120)||`${i.name} — копия`;values.stageId=v.stageId===undefined?i.stageId:v.stageId;values.goalId=null;values.bonusIds=[];values.milestoneBonusIds=[];values.finalBonusIds=[];if(values.steps)values.steps=values.steps.map(x=>({name:x.name}));saveItem(s,values,now);break;}
    case 'day.include': {const i=byId(v.id);if(!usable(s,i))fail('Действие недоступно.');const d=day(s,date);if(!d.includes.includes(i.id))d.includes.push(i.id);if(!d.overrides.includes(i.id))d.overrides.push(i.id);d.excludes=d.excludes.filter(x=>x!==i.id);break;}
    case 'day.exclude': {const d=day(s,date);if(!d.excludes.includes(v.id))d.excludes.push(v.id);d.includes=d.includes.filter(x=>x!==v.id);d.overrides=d.overrides.filter(x=>x!==v.id);break;}
    case 'day.excludeMany': {const d=day(s,date);for(const id of v.ids||[]){if(!d.excludes.includes(id))d.excludes.push(id);d.includes=d.includes.filter(x=>x!==id);d.overrides=d.overrides.filter(x=>x!==id);}break;}
    case 'day.move': {const i=byId(v.id);if(!validDay(v.date)||v.date<=date)fail('Выберите будущую дату.');const d=day(s,date);if(!d.excludes.includes(i.id))d.excludes.push(i.id);const future=day(s,v.date);if(!future.includes.includes(i.id))future.includes.push(i.id);future.overrides.push(i.id);break;}
    case 'day.tempo': {if(!Object.hasOwn(TEMPOS,v.value))fail('Неизвестный темп.');day(s,date).tempo=v.value;break;}
    case 'day.close': Object.assign(day(s,date),{note:text(v.note,2000),good:text(v.good,1000),closedAt:now});break;
    case 'day.budget': day(s,date).budget=number(v.minutes,0,1440);break;
    case 'calendar.notified': {const i=byId(v.id);i.notifiedDates ||= [];if(!i.notifiedDates.includes(date))i.notifiedDates.push(date);break;}
    case 'focus.set': s.settings.focusBlocks=v.ids===null?null:[...new Set(v.ids)].filter(id=>s.blocks.some(b=>b.id===id&&live(b)));s.settings.focusCalendar=v.calendar!==false;s.settings.focusUnboundCalendar=v.unbound!==false;break;
    case 'pause': {const open=s.pauses.find(p=>!p.end);if(v.on&&!open)s.pauses.push({id:uid(),start:date,end:null,muteCalendar:!!v.muteCalendar});if(!v.on&&open)open.end=dayAdd(date,-1);break;}
    case 'note.save': {let n=s.notes.find(n=>n.id===v.id);if(!n){n={id:uid(),createdAt:now,archivedAt:null};s.notes.push(n);}n.name=name(v.name);break;}
    case 'note.convert': {const n=byId(v.id);saveItem(s,{...v,id:undefined,name:v.name||n.name},now);n.archivedAt=now;n.converted=true;break;}
    case 'bonus.save': {
      let b=s.bonuses.find(b=>b.id===v.id);if(v.id&&!b)fail('Бонус не найден.');if(!b){b={id:uid(),createdAt:now,archivedAt:null};s.bonuses.push(b);}
      Object.assign(b,{name:name(v.name),description:text(v.description),price:number(v.price,1),limit:v.limit===null?null:number(v.limit||1,1),category:text(v.category,80),tags:text(v.tags,300)});break;
    }
    case 'bonus.buy': {const b=s.bonuses.find(x=>x.id===v.id&&live(x));if(!b)fail('Бонус недоступен.');if(money(s).coins<b.price)fail('Недостаточно монет.');const e=event(s,b,'purchase',now);s.ledger.push({id:uid(),eventId:e.id,coins:-b.price,xp:0,type:'purchase',date,at:now,name:b.name});s.instances.push({id:uid(),bonusId:b.id,name:b.name,limit:b.limit,uses:[],paid:b.price,eventId:e.id,linkId:null,acquiredAt:now,refundedAt:null,revokedAt:null,archivedAt:null});break;}
    case 'bonus.use': {const i=byId(v.id);if(i.refundedAt||i.revokedAt||i.archivedAt)fail('Бонус недоступен.');if(i.limit!==null&&i.uses.length>=i.limit)fail('Все использования закончились.');i.uses.push({id:uid(),at:now,date});break;}
    case 'bonus.undoUse': {const i=byId(v.id);if(!i.uses.length)fail('Нет использования для отмены.');i.uses.pop();break;}
    case 'bonus.refund': {const i=byId(v.id);if(!i.paid||i.refundedAt||i.revokedAt||i.uses.length)fail('Вернуть можно только купленный бонус до первого использования.');s.ledger.push({id:uid(),eventId:i.eventId,coins:i.paid,xp:0,type:'refund',date,at:now,name:i.name});i.refundedAt=now;break;}
    case 'bonus.release': {const link=s.rewardLinks.find(x=>x.id===v.id);if(!link)fail('Резерв не найден.');const source=byId(link.sourceId),key=link.slot==='main'?'bonusIds':link.slot==='final'?'finalBonusIds':'milestoneBonusIds';source[key]=(source[key]||[]).filter(x=>x!==link.bonusId);s.rewardLinks=s.rewardLinks.filter(x=>x.id!==link.id);break;}
    case 'instance.edit': {const i=byId(v.id);const limit=v.limit===null?null:number(v.limit,1);if(limit!==null&&limit<i.uses.length)fail('Лимит меньше уже использованного.');i.name=name(v.name);i.limit=limit;break;}
    case 'decision.save': {
      let d=s.decisions.find(x=>x.id===v.id);if(v.id&&!d)fail('Решение не найдено.');if(d&&d.status!=='active')fail('Завершённое решение сначала нужно вернуть в активные.');
      if(!d){d={id:uid(),createdAt:now,status:'active',archivedAt:null};s.decisions.push(d);}
      const deadline=v.deadline?new Date(v.deadline):null;if(deadline&&!Number.isFinite(+deadline))fail('Неверный срок.');
      Object.assign(d,{name:name(v.name),description:text(v.description),stageId:checkedStage(s,v.stageId),deadline:deadline?.toISOString()||null,priceCoins:number(v.priceCoins),priceXP:number(v.priceXP),linkedAt:now});break;
    }
    case 'decision.status': {const d=byId(v.id);if(d.status!=='active')fail('У решения уже есть исход.');if(!['fulfilled','failed','cancelled'].includes(v.status))fail('Неизвестный исход.');d.status=v.status;d.closedAt=now;const e=event(s,d,'decision',now,{outcome:v.status});if(v.status==='failed')s.ledger.push({id:uid(),eventId:e.id,coins:-d.priceCoins,xp:-d.priceXP,type:'priceWord',date,at:now,name:d.name});break;}
    case 'decision.undo': {const d=byId(v.id),e=eventsFor(s,d.id,'decision').at(-1);if(d.status==='active'||!e)fail('Исход уже отменён.');reverseEvent(s,e,now);d.status='active';d.closedAt=null;break;}
    case 'treat.save': {let t=s.treats.find(x=>x.id===v.id);if(!t){t={id:uid(),createdAt:now,archivedAt:null};s.treats.push(t);}Object.assign(t,{name:name(v.name),description:text(v.description),category:text(v.category,80),tags:text(v.tags,300)});break;}
    case 'review.save': {if(!['daily','weekly','monthly'].includes(v.period))fail('Неизвестный обзор.');const base=v.key||date;if(!validDay(base)||base>date)fail('Неверный период обзора.');const key=v.period==='daily'?base:periodStart(base,v.period==='weekly'?'week':'month');let r=s.reviews.find(r=>r.period===v.period&&r.key===key);if(!r){r={id:uid(),period:v.period,key};s.reviews.push(r);}Object.assign(r,{answers:(v.answers||[]).slice(0,3).map(a=>text(a,2000)),at:now});break;}
    case 'review.dismiss': {if(!['daily','weekly','monthly'].includes(v.period))fail('Неизвестный обзор.');const key=v.period==='daily'?date:periodStart(date,v.period==='weekly'?'week':'month');(s.settings.reviewDismissals||={})[v.period]=key;break;}
    case 'moment.save': {let m=s.moments.find(x=>x.id===v.id);if(!m){m={id:uid(),date,at:now,archivedAt:null};s.moments.push(m);}m.name=name(v.name);m.description=text(v.description);break;}
    case 'timer.start': {if(s.timer&&s.timer.status!=='recorded')fail('Сначала закончите текущий подход.');const i=v.itemId?s.items.find(i=>i.id===v.itemId):null;s.timer={id:uid(),itemId:i?.id||null,name:i?.name||'Время для важного',duration:number(v.minutes||25,1,180)*60,elapsed:0,startedAt:now,endAt:new Date(+new Date(now)+number(v.minutes||25,1,180)*60000).toISOString(),status:'running'};break;}
    case 'timer.pause': {const t=s.timer;if(t?.status!=='running')fail('Таймер не запущен.');t.elapsed=Math.min(t.duration,t.elapsed+(+new Date(now)-+new Date(t.startedAt))/1000);t.status='paused';break;}
    case 'timer.resume': {const t=s.timer;if(t?.status!=='paused')fail('Таймер не на паузе.');t.startedAt=now;t.endAt=new Date(+new Date(now)+(t.duration-t.elapsed)*1000).toISOString();t.status='running';break;}
    case 'timer.finish': {const t=s.timer;if(!t||t.status==='recorded')fail('Нет активного подхода.');if(t.status==='running')t.elapsed=Math.min(t.duration,t.elapsed+(+new Date(now)-+new Date(t.startedAt))/1000);t.status='finished';break;}
    case 'timer.record': {const t=s.timer;if(!t||t.status==='recorded'||s.timeSessions.some(x=>x.timerId===t.id))fail('Время уже обработано.');const minutes=v.skip?0:number(v.minutes,0,180);s.timeSessions.push({id:uid(),timerId:t.id,itemId:t.itemId,name:t.name,minutes,date,at:now,skipped:!!v.skip});t.status='recorded';break;}
    case 'settings': {
      for(const k of ['sound','reviewDaily','reviewWeekly','reviewMonthly'])if(v[k]!==undefined)s.settings[k]=!!v[k];
      if(v.myTools){s.settings.myTools=[...new Set(v.myTools)].filter(x=>Object.hasOwn(TOOL_NAMES,x));s.settings.tools=s.settings.tools.filter(x=>s.settings.myTools.includes(x));}
      if(v.tools){s.settings.tools=[...new Set(v.tools)].filter(x=>Object.hasOwn(TOOL_NAMES,x));s.settings.myTools=[...new Set([...(s.settings.myTools||[]),...s.settings.tools])];}
      if(v.rewardTargetId!==undefined)s.settings.rewardTargetId=v.rewardTargetId||null;
      if(v.graph)s.settings.graph=clone(v.graph);if(v.accent)s.settings.accent=['gold','mint','blue','rose'].includes(v.accent)?v.accent:'gold';break;
    }
    case 'archive': {for(const id of v.ids||[v.id]){const a=byId(id);a.archivedAt=now;}break;}
    case 'restore': {for(const id of v.ids||[v.id]){const a=byId(id);a.archivedAt=null;if(a.kind&&s.items.includes(a))a.inDay=false;}break;}
    case 'delete': {
      for(const id of v.ids||[v.id]) {
        const a=byId(id);if(!a.archivedAt)fail('Окончательное удаление доступно только из архива.');
        if(s.missed.includes(a)||s.instances.includes(a)){a.deletedAt=now;continue;}
        if(s.blocks.includes(a)) {for(const i of s.items.filter(i=>itemBlock(s,i)?.id===a.id)){i.stageId=null;i.goalId=null;i.leadsToGoal=false;}const stageIds=s.stages.filter(x=>x.blockId===a.id).map(x=>x.id),goalIds=s.goals.filter(g=>stageIds.includes(g.stageId)).map(g=>g.id);s.goals=s.goals.filter(g=>!stageIds.includes(g.stageId));s.stages=s.stages.filter(x=>x.blockId!==a.id);s.decisions.forEach(d=>{if(stageIds.includes(d.stageId))d.stageId=null;});s.rewardLinks=s.rewardLinks.filter(l=>!stageIds.includes(l.sourceId)&&!goalIds.includes(l.sourceId));for(const k of ['weekday','weekend'])s.settings.graph[k]=s.settings.graph[k].map(id=>id===a.id?null:id);}
        if(s.stages.includes(a)){if(s.items.some(i=>i.stageId===id)||s.goals.some(g=>g.stageId===id))fail('Перенесите связанные действия и цели перед удалением этапа.');const b=byId(a.blockId);if(b.currentStageId===id)b.currentStageId=null;s.decisions.forEach(d=>{if(d.stageId===id)d.stageId=null;});}
        if(s.goals.includes(a))s.items.forEach(i=>{if(i.goalId===id){i.goalId=null;i.leadsToGoal=false;}});
        if(s.bonuses.includes(a)&&s.rewardLinks.some(x=>x.bonusId===id))fail('Сначала снимите назначения этого бонуса. Полученные экземпляры сохранятся.');
        for(const key of ['blocks','stages','goals','items','bonuses','decisions','treats','notes','moments'])s[key]=s[key].filter(x=>x.id!==id);
        s.rewardLinks=s.rewardLinks.filter(x=>x.sourceId!==id);
      }break;
    }
    case 'tick': break;
    default:fail('Неизвестная операция.');
  }
  syncDay(s,date);s.revision++;s.updatedAt=now;validate(s);return s;
}
export function validate(s) {
  const safeId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(x);
  if(!s||s.app!==APP||s.version!==VERSION||!Number.isSafeInteger(s.revision)||!validDay(s.lastDay))fail('Это не сохранение новой LifeGame или его версия не поддерживается.');
  for(const key of ['blocks','stages','goals','items','events','ledger','bonuses','instances','rewardLinks','decisions','treats','notes','missed','moments','pauses','reviews','timeSessions'])if(!Array.isArray(s[key]))fail('Повреждён раздел сохранения: '+key);
  if(!s.days||typeof s.days!=='object'||Array.isArray(s.days)||!s.settings)fail('Повреждены настройки дня.');
  if(!Array.isArray(s.settings.tools)||s.settings.tools.some(k=>!Object.hasOwn(TOOL_NAMES,k))||s.settings.focusBlocks!==null&&!Array.isArray(s.settings.focusBlocks)||!s.settings.graph||!['weekday','weekend'].every(k=>Array.isArray(s.settings.graph[k])&&s.settings.graph[k].length===24))fail('Повреждены настройки инструментов.');
  if(s.settings.myTools!==undefined&&(!Array.isArray(s.settings.myTools)||s.settings.myTools.some(k=>!Object.hasOwn(TOOL_NAMES,k))||s.settings.tools.some(k=>!s.settings.myTools.includes(k))))fail('Повреждена коллекция инструментов.');
  const ids=new Set();for(const key of ['blocks','stages','goals','items','bonuses','instances','decisions','treats','notes','missed','moments'])for(const x of s[key]){if(!x||!safeId(x.id)||ids.has(x.id)||typeof x.name!=='string')fail('Повреждены записи или идентификаторы.');ids.add(x.id);}
  for(const st of s.stages){if(!s.blocks.some(b=>b.id===st.blockId))fail('У этапа отсутствует блок.');if(!['step','optimal','unknown','lvmg'].includes(st.role))fail('Повреждён тип этапа.');number(st.reward);}
  for(const b of s.blocks)if(!b.sections||Object.keys(SECTION_NAMES).some(k=>typeof b.sections[k]!=='boolean')||!['light','balanced','aggressive'].includes(b.intensity))fail('Повреждена структура блока.');
  for(const b of s.blocks)if(b.currentStageId&&!s.stages.some(x=>x.id===b.currentStageId&&x.blockId===b.id))fail('Неверный текущий этап.');
  for(const g of s.goals)if(!s.stages.some(x=>x.id===g.stageId))fail('У цели отсутствует этап.');
  for(const i of s.items){if(i.stageId&&!s.stages.some(x=>x.id===i.stageId))fail('У действия отсутствует этап.');if(i.goalId&&!s.goals.some(g=>g.id===i.goalId&&g.stageId===i.stageId))fail('Неверная связь задания с целью.');if(!['task','habit','quest','calendar'].includes(i.kind)||!i.schedule||!['once','daily','weekly','days','any'].includes(i.schedule.mode)||!validDay(i.schedule.start)||!Array.isArray(i.schedule.days)||i.schedule.days.some(n=>!Number.isInteger(n)||n<1||n>7)||i.schedule.mode==='once'&&!validDay(i.schedule.date)||!Object.hasOwn(LOADS,i.load)||typeof i.inDay!=='boolean')fail('Повреждено действие или расписание.');number(i.reward);if(i.kind==='habit'){number(i.target);number(i.dailyTarget,1,1000);number(i.maxDaily,0,1000);number(i.milestoneReward);if(!['all','week','month'].includes(i.period))fail('Повреждена цель привычки.');}if(i.kind==='quest'){number(i.target,1);number(i.step,1);number(i.finalReward);if(!['counter','checklist'].includes(i.questType)||!Array.isArray(i.steps)||i.questType==='checklist'&&(!i.steps.length||new Set(i.steps.map(x=>x.id)).size!==i.steps.length))fail('Повреждены пункты квеста.');}}
  for(const i of s.items.filter(i=>i.kind==='quest'))if(i.steps.some(x=>!safeId(x.id)||typeof x.name!=='string'))fail('Повреждены идентификаторы пунктов квеста.');
  const eventKinds=['task','habit','habit-milestone','quest-step','quest-final','calendar','goal','goal-status','stage','decision','purchase'];
  const eventIds=new Set();for(const e of s.events){if(!e||!safeId(e.id)||!safeId(e.entityId)||eventIds.has(e.id)||!eventKinds.includes(e.kind)||!validDay(e.date)||typeof e.at!=='string'||!Number.isFinite(Date.parse(e.at))||typeof e.name!=='string'||typeof e.active!=='boolean')fail('Повреждена история выполнений.');eventIds.add(e.id);}
  const ledgerIds=new Set();let runningCoins=0,runningXP=0;for(const l of s.ledger){if(ledgerIds.has(l.id)||!eventIds.has(l.eventId)||!Number.isSafeInteger(l.coins)||!Number.isSafeInteger(l.xp)||!validDay(l.date)||!['earn','purchase','refund','priceWord','undo'].includes(l.type))fail('Повреждён финансовый журнал.');ledgerIds.add(l.id);runningCoins+=l.coins;runningXP+=l.xp;if(l.type==='earn'&&(l.coins<0||l.coins!==l.xp)||l.type==='purchase'&&(l.coins>=0||l.xp!==0)||l.type==='refund'&&(l.coins<=0||l.xp!==0)||l.type==='priceWord'&&(l.coins>0||l.xp>0||!s.events.some(e=>e.id===l.eventId&&e.kind==='decision'&&e.outcome==='failed'))||l.type!=='priceWord'&&(l.coins<0&&runningCoins<0||l.xp<0&&runningXP<0))fail('Неверная операция с монетами или опытом.');}
  const balances=money(s);if(!Number.isSafeInteger(balances.coins)||!Number.isSafeInteger(balances.xp))fail('Слишком большой баланс.');
  if((balances.coins<0||balances.xp<0)&&!s.ledger.some(l=>l.type==='priceWord'))fail('Отрицательный баланс без Цены слова.');
  for(const i of s.instances){if(!Array.isArray(i.uses)||i.limit!==null&&(!Number.isSafeInteger(i.limit)||i.limit<1||i.uses.length>i.limit))fail('Повреждены использования бонуса.');}
  for(const [d,v]of Object.entries(s.days))if(!validDay(d)||!Object.hasOwn(TEMPOS,v.tempo)||!Array.isArray(v.includes)||!Array.isArray(v.excludes)||!Array.isArray(v.overrides)||!Array.isArray(v.expected)||v.expected.some(x=>typeof x.id!=='string'||!Number.isSafeInteger(x.units)||x.units<1))fail('Повреждён дневной план.');
  for(const m of s.missed)if(!validDay(m.date)||typeof m.itemId!=='string')fail('Повреждена дата пропуска.');
  for(const d of s.decisions)if(!['active','fulfilled','failed','cancelled'].includes(d.status)||d.deadline&&!Number.isFinite(Date.parse(d.deadline)))fail('Повреждены условия решения.');
  for(const r of s.reviews)if(!safeId(r.id)||!['daily','weekly','monthly'].includes(r.period)||!validDay(r.key)||!Array.isArray(r.answers)||r.answers.length>3||r.answers.some(x=>typeof x!=='string'))fail('Повреждён стратегический обзор.');
  return s;
}
export function exportState(s) {validate(s);return {app:APP,version:VERSION,exportedAt:new Date().toISOString(),data:clone(s)};}
export function importState(value) {if(value?.app!==APP||value.version!==VERSION)fail('Выберите резервную копию новой LifeGame. Старый формат не изменяется.');return validate(clone(value.data));}
export function stats(s,date=dayKey()) {const e=s.events.filter(e=>e.active&&e.date===date),l=s.ledger.filter(l=>l.date===date);return {tasks:e.filter(e=>e.kind==='task').length,habits:e.filter(e=>e.kind==='habit').length,questSteps:e.filter(e=>e.kind==='quest-step').length,quests:e.filter(e=>e.kind==='quest-final').length,calendar:e.filter(e=>e.kind==='calendar').length,goals:e.filter(e=>e.kind==='goal').length,stages:e.filter(e=>e.kind==='stage').length,minutes:s.timeSessions.filter(x=>x.date===date&&!x.skipped).reduce((n,x)=>n+x.minutes,0),earned:l.filter(x=>x.type==='earn').reduce((n,x)=>n+x.coins,0),spent:-l.filter(x=>x.type==='purchase').reduce((n,x)=>n+x.coins,0),xp:l.reduce((n,x)=>n+x.xp,0),facts:e.length};}
