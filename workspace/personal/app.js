(async function(){
/* ================= CORE: utils, dates, storage, model, plan, misses, economy ================= */
"use strict";
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>crypto.randomUUID?.()||(Date.now().toString(36)+"-"+Math.random().toString(36).slice(2));
const pad=n=>String(n).padStart(2,"0");
const Cal=LifeGamePlanning;
const calParts=id=>String(id||"").split("@");
const CAL_SELECTION=new Map();
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parseD=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parseD(s);d.setDate(d.getDate()+n);return iso(d)};
const realToday=()=>iso(new Date());
const wd=s=>{const g=parseD(s).getDay();return g===0?7:g};
const MONTHS=["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const WDF=["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];
const WD=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const human=s=>{const d=parseD(s);return d.getDate()+" "+MONTHS[d.getMonth()]+", "+WDF[d.getDay()]};
const short=s=>{if(!s)return"";const d=parseD(s);return d.getDate()+" "+MONTHS[d.getMonth()].slice(0,3)};
const daysBetween=(a,b)=>Math.round((parseD(b)-parseD(a))/864e5);
const weekStart=s=>addDays(s,1-wd(s));
const monthKey=s=>s.slice(0,7);
const num=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g," ");
const plural=(n,a,b,c)=>{const m=Math.abs(n)%100,k=m%10;return (m>10&&m<20)?c:k===1?a:(k>=2&&k<=4)?b:c};

/* ---------- spaces & storage ---------- */
const KEYS={meta:"lifegame-personal-meta-v1",demo:"lifegame-personal-demo-v1",my:"lifegame-personal-my-v1"};
const IO=new LifeGamePersistence.Repository();
let META={space:null,offset:0},S=null,storageOk=true,storageIssue='',corruptSpace=false,activeOperation=false;
const cloneState=x=>LifeGamePersistence.clone(x);
function loadMeta(){try{const raw=localStorage.getItem(KEYS.meta);if(raw){const m=JSON.parse(raw);if(!m||!['my','demo',null].includes(m.space))throw Error('Неверные настройки входа');META={space:m.space,offset:Number.isSafeInteger(m.offset)&&m.offset>=0?m.offset:0}}}catch(e){storageIssue='Не удалось прочитать настройки входа. Можно выбрать пространство заново. '+e.message}}
function saveMeta(){localStorage.setItem(KEYS.meta,JSON.stringify(META))}
function loadSpace(space){
  corruptSpace=false;storageIssue='';
  try{const raw=IO.read(KEYS[space]);if(raw)return LifeGamePersistence.upgrade(JSON.parse(raw));return space==='demo'?makeDemo():makeBlank()}
  catch(e){corruptSpace=true;storageOk=false;storageIssue='Сохранение не открыто и не перезаписано. Скачайте исходный файл или восстановите исправную копию. '+e.message;return space==='demo'?makeDemo():makeBlank()}
}
function save(){
  if(!S||!META.space)return;
  if(corruptSpace)throw Error('Сначала восстановите сохранение из файла. Исходные данные оставлены без изменений.');
  locTick();
  const oldRevision=S.revision||0;S.revision=oldRevision+1;
  try{IO.write(KEYS[META.space],S);storageOk=true;storageIssue='';if(activeOperation){['#app','#tabs','#helper','#helper-pop'].forEach(sel=>{const n=$(sel);if(n){n.dataset.revision=S.revision;n.dataset.space=META.space}});$$('#layer [data-revision]').forEach(n=>{n.dataset.revision=S.revision;n.dataset.space=META.space})}}
  catch(e){S.revision=oldRevision;storageOk=false;storageIssue='Изменение НЕ сохранено. Прогресс и награда не изменились. '+e.message;throw e}
}
const today=()=>META.space==='demo'?addDays(realToday(),META.offset||0):realToday();
function dataSignature(s){if(!s)return '';const c={...s};delete c.ui;delete c.recent;delete c.revision;return JSON.stringify(c)}
function tokenOf(el){const root=el?.closest?.('[data-revision]');return {space:root?.dataset.space||META.space,revision:root?Number(root.dataset.revision):(S?.revision||0)}}
function storagePanel(){if(!storageIssue)return '';return '<div class="storage-alert" role="alert"><b>Нужна проверка сохранения</b><p>'+esc(storageIssue)+'</p><div class="row"><button class="btn s" data-act="recovery-export">Скачать исходные данные</button><button class="btn s" data-act="recovery-backup">Скачать предыдущую копию</button><button class="btn s" data-act="restore-backup" data-v="last">Посмотреть копию</button><button class="btn s" data-act="restore-backup" data-v="daily">Копия на начало дня</button><button class="btn s" data-act="load-fresh">Обновить данные</button><button class="btn s" data-act="import">Восстановить из файла</button></div></div>'}
function showStoragePanel(){$$('.storage-alert').forEach(n=>n.remove());if(storageIssue){const target=topSheet()?.querySelector('.sh-body')||$('#app');target.insertAdjacentHTML('afterbegin',storagePanel())}}
async function runGuarded(fn,el,background=false){
  const token=tokenOf(el);
  return IO.exclusive(async()=>{
    if(token.space!==META.space||S&&token.revision!==(S.revision||0)){if(!background){storageIssue='Экран устарел. Черновик оставлен: обновите данные и откройте запись заново.';showStoragePanel();toast(storageIssue)}return false}
    const backup=S?JSON.stringify(S):null,metaBackup={...META},key=META.space?KEYS[META.space]:null,rawBefore=key?IO.snapshots.get(key):null;
    try{
      if(key&&!corruptSpace)IO.assertCurrent(key);
      activeOperation=true;
      if(S&&!corruptSpace){const rollover=processDays(),place=locTick();if(rollover||place)save()}
      const before=dataSignature(S),serial=IO.commitSerial,result=await fn();
      if(S&&!corruptSpace&&dataSignature(S)!==before&&IO.commitSerial===serial)save();
      showStoragePanel();return result;
    }catch(e){
      // A failed UI redraw after a successful commit cannot undo durable progress.
      if(key&&IO.snapshots.get(key)!==rawBefore){try{S=LifeGamePersistence.upgrade(JSON.parse(IO.snapshots.get(key)))}catch{}}
      else{if(backup)S=JSON.parse(backup);else S=null;META=metaBackup}
      if(!e.user){storageIssue=storageIssue||e.message;storageOk=false}
      try{renderRetainingDrafts()}catch{showStoragePanel()}
      if(!background)toast(e.message);return false;
    }finally{activeOperation=false}
  });
}
function downloadFile(content,name){const data=typeof content==='string'?content:JSON.stringify(content,null,2),url=URL.createObjectURL(new Blob([data],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportFile(){LifeGamePersistence.validate(S);return {app:'LifeGame Personal',format:'personal-1',createdAt:new Date().toISOString(),space:META.space,data:cloneState(S)}}
function replaceSpace(value){
  const next=LifeGamePersistence.upgrade(value),old=S;next.space=META.space;next.revision=(old?.revision||0)+1;
  const key=KEYS[META.space];IO.assertCurrent(key);S=next;
  try{processDays();locTick();IO.write(key,S,{replace:true});corruptSpace=false;storageIssue='';storageOk=true}catch(e){S=old;throw e}
}

/* ---------- reference data ---------- */
const BASE_BLOCKS=[
  ["Душевное состояние","🌿"],["Физическое состояние","💪"],["Знания, навыки, опыт","📚"],["Ресурсы и материальное","💰"],
  ["Окружение и отношения","🤝"],["Наполнение и организация","🗂"],["Обстоятельства","🌦"],["Исключить","🚫"]];
const ICONS=["🎸","🌿","💪","📚","💰","🤝","🗂","🌦","🚫","🏠","🎨","💼","❤️","🧠","🏃","✈️","🍳","🧘","👨‍👩‍👧","⭐"];
const SECTIONS=[
  ["ach","Мои достижения"],["fact","Фактический этап"],["cur","Текущий этап"],["plan","Планируемые этапы"],
  ["opt","Оптимальный ориентир"],["unk","Неизвестное"],["lvmg","LVMG"],["dec","Принятые решения"],["missed","Невыполненные"],["sched","Запланированное в календаре"]];
const PRESETS={
  full:{label:"Полная стратегия",secs:SECTIONS.map(s=>s[0])},
  simple:{label:"Упрощённая",secs:SECTIONS.map(s=>s[0]).filter(k=>k!=="unk"&&k!=="lvmg")}
};
const secsFrom=list=>Object.fromEntries(SECTIONS.map(([k])=>[k,list.includes(k)]));
const TEMPO=[["rest","Отдыхаю"],["normal","Обычный"],["hard","Фигачу"]];
const TEMPO_L=Object.fromEntries(TEMPO);
const INTENS=[["aggr","Агрессивная"],["bal","Сбалансированная"],["light","Лайтовая"]];
const INTENS_L=Object.fromEntries(INTENS);
const PRIO=[["high","Высокий"],["mid","Средний"],["low","Низкий"]];
const PRIO_L=Object.fromEntries(PRIO);
const PRIO_N={high:0,mid:1,low:2};
const DEF_REWARD={task:10,habit:5,habitGoal:50,questStep:5,questFinal:100,cal:5};
const KIND_L={task:"Задание",habit:"Привычка",quest:"Квест",cal:"Календарь",offer:"Бонус",treat:"Ништяк",decision:"Решение",note:"Мысль"};
const USE_L={once:"Одноразовый",unlimited:"Безлимитный",limited:"Ограниченный"};

const STYLES=[["quest","Ночной квест",["#0B0B0C","#FFD21F","#2E3035","#F3F2EE"]],["dawn","Рассвет",["#F6F3FA","#D2462B","#6A4BE0","#F2A93B"]],["pop","Стикеры",["#EEEAFF","#FF3D9A","#3A50FF","#D7FF3A"]]];
const LOC_ICONS=["🏠","💼","🚗","🏋️","🛒","🌳","☕","🏫","👨‍👩‍👧","🏥","✈️","📍"];
function newLocation(p){return Object.assign({id:uid(),name:"",icon:"📍",blocks:[],homeHide:[],dayHide:[],widgets:null,muteOther:false,tempo:null,style:null},p||{})}
function defaultLocations(){return LifeGamePersistence.defaultLocations()}
function defaultLocState(){return LifeGamePersistence.defaultLocState()}

/* ---------- current location ----------
   manual choice wins until the next schedule boundary; then schedule; then the "outside schedule" location; else none (everything visible) */
const locById=id=>id?(S.locations||[]).find(l=>l.id===id)||null:null;
const tmin=t=>{const [h,m]=t.split(":").map(Number);return h*60+m};
const nowMinutes=()=>{const n=new Date();return n.getHours()*60+n.getMinutes()};
function ruleActive(r,d,mins){
  const from=tmin(r.from),to=tmin(r.to);
  if(from===to)return false;
  if(from<to)return r.days.includes(wd(d))&&mins>=from&&mins<to;
  return (r.days.includes(wd(d))&&mins>=from)||(r.days.includes(wd(addDays(d,-1)))&&mins<to);
}
function scheduledLoc(d,mins){
  for(const r of S.loc.schedule){if(locById(r.locId)&&ruleActive(r,d,mins))return {id:r.locId,rule:r}}
  return {id:locById(S.loc.fallback)?S.loc.fallback:null,rule:null};
}
let locationBoundaryCache=null;
function nextBoundary(){
  if(!S.loc.schedule.length)return null;
  const start=Math.floor(Date.now()/60000),key=start+'|'+META.space+'|'+META.offset+'|'+JSON.stringify(S.loc.schedule)+'|'+S.loc.fallback;
  if(locationBoundaryCache?.key===key)return locationBoundaryCache.value;
  const idAt=ts=>{const point=new Date(ts),date=META.space==='demo'?addDays(iso(point),META.offset||0):iso(point);return scheduledLoc(date,point.getHours()*60+point.getMinutes()).id};
  const initial=idAt(Date.now());let value=null;
  // Scan actual minutes, so repeated/skipped clock hours are handled as well as overnight rules.
  for(let minute=1;minute<=8*1440;minute++){const ts=(start+minute)*60000;if(idAt(ts)!==initial){value=ts;break}}
  locationBoundaryCache={key,value};return value;
}
function currentLoc(){
  if(!S.loc)return {id:null,source:"none",until:null};
  const m=S.loc.manual;
  if(m&&(m.until===null||m.until>Date.now()))return {id:locById(m.id)?m.id:null,source:"manual",until:m.until};
  const sl=scheduledLoc(today(),nowMinutes());
  return {id:sl.id,source:sl.rule?"schedule":(sl.id?"fallback":"none"),until:nextBoundary(nowMinutes()),rule:sl.rule};
}
const curLocObj=()=>locById(currentLoc().id);
const itemLocOk=(it,locId)=>!locId||!it||!(it.locs&&it.locs.length)||it.locs.includes(locId);
function locHides(it,loc){
  if(!loc||!it)return false;
  if(!itemLocOk(it,loc.id))return true;
  return !!(loc.blocks&&loc.blocks.length&&it.blockId&&!loc.blocks.includes(it.blockId));
}
function noteLocSeen(){
  const r=dayRec(today());const k=currentLoc().id||"*";
  const seen=r.locsSeen||(r.locsSeen=[]);
  if(!seen.includes(k)){seen.push(k);return true}
  return false;
}

function baseState(space){
  const t=today();
  return {
    v:2,space,created:t,lastProcessed:t,
    settings:{lite:false,style:"quest",accent:"blue",motivation:"",reminders:true,
      sessions:{all:true,daily:true,weekly:true,monthly:true},
      onboarding:{on:false,start:t,done:{},skipped:{}}},
    blocks:BASE_BLOCKS.map(([name,icon],i)=>({id:"b"+i,name,icon,meaning:"",priority:"mid",intensity:"bal",
      secs:secsFrom(PRESETS.full.secs),preset:"full",base:true,status:"active",order:i,currentStageId:null,fact:"",optimal:"",unknown:"",lvmg:""})),
    locations:defaultLocations(),loc:defaultLocState(),achievements:[],stages:[],goals:[],tasks:[],habits:[],quests:[],cal:[],decisions:[],
    inbox:[],recent:[],facts:[],ledger:[],offers:[],insts:[],treats:[],misses:[],days:{},
    focus:{on:false,blocks:[],calOther:true,calUnlinked:true},
    creative:{on:false,since:null,mute:false},
    sessions:[],
    widgets:{mine:["timer","firststep","graph","happiness","rhythm","myreward"],inDay:{timer:true,firststep:true}},
    timer:{state:"ready",minutes:15,remaining:900,endsAt:null,label:"",ref:null,startedAt:null},
    timeLog:[],
    graph:{weekday:Array(24).fill(""),weekend:Array(24).fill("")},
    happy:[],myReward:null,rhythm:{target:3,rest:[6,7]},
    ui:{}
  };
}
function makeBlank(){const s=baseState("my");return s}

/* ---------- lookups ---------- */
const COLL={task:"tasks",habit:"habits",quest:"quests",cal:"cal",offer:"offers",treat:"treats",decision:"decisions",block:"blocks",stage:"stages",goal:"goals",inst:"insts"};
const get=(k,id)=>id?(S[COLL[k]]||[]).find(x=>x.id===(k==="cal"?calParts(id)[0]:id)):null;
const rk=(k,id)=>k+":"+id;
const pr=r=>{const i=r.indexOf(":");return [r.slice(0,i),r.slice(i+1)]};
const blockOf=it=>it&&it.blockId?get("block",it.blockId):null;
const stageOf=it=>it&&it.stageId?get("stage",it.stageId):null;
const activeBlocks=()=>S.blocks.filter(b=>b.status==="active").sort((a,b)=>PRIO_N[a.priority]-PRIO_N[b.priority]||a.order-b.order);
const blockStages=bid=>S.stages.filter(s=>s.blockId===bid&&s.status!=="archived").sort((a,b)=>a.order-b.order);
function stageRole(s){
  if(s.status==="done")return "done";
  if(s.status==="archived")return "archived";
  const b=get("block",s.blockId);
  if(b&&b.currentStageId===s.id)return "current";
  const cur=b&&get("stage",b.currentStageId);
  if(cur&&s.order<cur.order)return "before";
  return "planned";
}
const ROLE_L={current:"Текущий",before:"Незавершённый",planned:"Планируемый",done:"Пройден",archived:"В архиве"};
const available=it=>!!it&&it.status==="active"&&(!it.blockId||get("block",it.blockId)?.status==="active")&&(!it.stageId||get("stage",it.stageId)?.status==="open");
const inFocus=it=>!S.focus.on||!it||!it.blockId||S.focus.blocks.includes(it.blockId);
const blockVisible=b=>!S.focus.on||S.focus.blocks.includes(b.id);
function originText(it){
  const b=blockOf(it),s=stageOf(it);
  if(!b&&!s)return "Самостоятельное";
  return (b?b.icon+" "+b.name:"")+(s?" · "+s.name:"");
}
function schedText(s){
  if(!s)return "";
  if(s.type==="once")return s.date?"разово, "+short(s.date):"разово";
  if(s.type==="daily")return "каждый день";
  if(s.type==="weekly")return "раз в неделю ("+WD[(s.days[0]||1)-1]+")";
  if(s.type==="days")return s.days.length===7?"каждый день":s.days.map(n=>WD[n-1]).join(", ");
  if(s.type==="whenever")return "когда хочется";
  if(s.type==="none")return "без расписания";
  return "";
}
const itemTitle=(k,id)=>{const it=get(k,id);return it?(it.title||it.text||it.name):"(удалено)"};

/* ---------- facts ---------- */
const liveFacts=()=>S.facts.filter(f=>!f.cancelled);
const factsOf=(kind,ref)=>S.facts.filter(f=>!f.cancelled&&f.kind===kind&&f.ref===(kind==='cal'?calParts(ref)[0]:ref)&&(!(kind==='cal'&&calParts(ref)[1])||f.occurrence===calParts(ref)[1]));
const calRef=(c,o)=>rk('cal',c.id+(Cal.repeats(c)?'@'+o.key:''));
const calDone=(c,key)=>factsOf('cal',c.id).some(f=>(f.occurrence||c.date)===key);
function calDefault(c){const due=Cal.due(c,today());return due.find(o=>!calDone(c,o.key))?.key||due[0]?.key||Cal.next(c,today())?.key||S.misses.find(m=>m.kind==='cal'&&m.ref===c.id&&m.status==='active'&&!calDone(c,m.occurrence||m.date))?.occurrence||c.date}
const calChosen=c=>CAL_SELECTION.get(c.id)||calDefault(c);
const calView=c=>Cal.occurrence(c,calChosen(c));
function calNext(c){let from=today();for(let n=0;n<10000;n++){const o=Cal.next(c,from);if(!o)return null;const same=Cal.due(c,o.date).find(x=>!calDone(c,x.key));if(same)return same;from=addDays(o.date,1)}return null}
function habitTarget(h,d){const changes=(h.norms||[]).filter(x=>x.from<=d).sort((a,b)=>a.from.localeCompare(b.from));return changes.at(-1)?.target||h.dailyTarget||1}
const habitSteps=(id,d)=>S.facts.filter(f=>!f.cancelled&&f.kind==='habitStep'&&f.ref===id&&f.date===d);
function habitDayTarget(h,d){return S.facts.find(f=>f.kind==='habitStep'&&f.ref===h.id&&f.date===d)?.target||habitTarget(h,d)}
function habitDayProgress(h,d){return doneOn('habit',h.id,d)?habitDayTarget(h,d):habitSteps(h.id,d).length}

function doneOn(k,id,d){
  if(k==="quest")return S.facts.some(f=>!f.cancelled&&f.kind==="questStep"&&f.ref===id&&f.date===d);
  return S.facts.some(f=>!f.cancelled&&f.kind===k&&f.ref===(k==="cal"?calParts(id)[0]:id)&&f.date===d&&(!(k==="cal"&&calParts(id)[1])||(f.occurrence||get("cal",id)?.date)===calParts(id)[1]));
}
const doneEver=(k,id)=>k==='cal'?(get('cal',id)?calDone(get('cal',id),calParts(id)[1]||calChosen(get('cal',id))):false):S.facts.some(f=>!f.cancelled&&f.kind===k&&f.ref===id&&(k!=="task"||(f.cycle||0)===(get("task",id)?.cycle||0)));
function questProgress(q){
  const st=factsOf("questStep",q.id);
  if(q.type==="checklist"){const done=new Set(st.map(f=>f.step));return {done:q.steps.filter(s=>done.has(s.id)).length,total:q.steps.length,doneSet:done}}
  return {done:st.reduce((n,f)=>n+(f.amount||1),0),total:q.target};
}
function habitCount(h,refDate){
  const fs=factsOf("habit",h.id);
  if(h.goal.mode==="period"){
    const d=refDate||today();
    const key=h.goal.period==="week"?weekStart(d):monthKey(d);
    return fs.filter(f=>(h.goal.period==="week"?weekStart(f.date):monthKey(f.date))===key).length;
  }
  return fs.length;
}
const periodKey=(h,d)=>h.goal.mode==="period"?(h.goal.period==="week"?"w"+weekStart(d):"m"+monthKey(d)):"all";

/* ---------- economy ---------- */
const coins=()=>S.ledger.reduce((a,l)=>a+l.coins,0);
const xpTotal=()=>S.ledger.reduce((a,l)=>a+l.xp,0);
const level=()=>{const x=xpTotal();return x<=0?1:Math.floor(x/1000)+1};
function ledger(type,c,x,note,ref,date){
  const l={id:uid(),type,coins:c,xp:x,note,ref:ref||null,date:date||today(),ts:Date.now()};
  S.ledger.push(l);return l.id;
}
function fail(m){const e=new Error(m);e.user=true;throw e}

/* bonuses: reserve / award / revoke */
function reservedFor(k,id){return S.insts.filter(i=>i.status==="reserved"&&i.cond&&i.cond.k===k&&i.cond.id===id)}
function setBonusAssign(k,id,offerIds){
  const it=get(k,id);if(!it)return;
  const target=k==="habit"?it.goal:it;
  const prev=target.bonus||[];target.bonusTerms ||= {};
  // remove reserves for once-offers no longer assigned
  prev.filter(o=>!offerIds.includes(o)).forEach(o=>{
    S.insts=S.insts.filter(i=>!(i.status==="reserved"&&i.offerId===o&&i.cond&&i.cond.k===k&&i.cond.id===id));
  });
  offerIds.filter(o=>!prev.includes(o)).forEach(o=>{
    const of=get("offer",o);if(of)target.bonusTerms[o]={title:of.title,use:of.use,limit:of.use==="once"?1:of.limit};
    if(of&&of.use==="once")S.insts.push({id:uid(),offerId:o,title:of.title,use:"once",limit:1,used:0,uses:[],source:"award",paid:0,cond:{k,id},status:"reserved",date:today()});
  });
  target.bonus=[...offerIds];
}
function award(k,id,d){
  const it=get(k,id);if(!it)return {insts:[],consumed:[]};
  const target=k==="habit"?it.goal:it;
  const list=target.bonus||[];const out=[],consumed=[];
  list.forEach(o=>{
    const of=target.bonusTerms?.[o]||get("offer",o);if(!of)return;
    const res=S.insts.find(i=>i.status==="reserved"&&i.offerId===o&&i.cond&&i.cond.k===k&&i.cond.id===id);
    if(res){res.status="owned";res.date=d;res.fromReserve=true;out.push(res.id);consumed.push(o)}
    else if(of.use!=="once"){
      const n={id:uid(),offerId:o,title:of.title,use:of.use,limit:of.limit||1,used:0,uses:[],source:"award",paid:0,cond:{k,id},status:"owned",date:d};
      S.insts.push(n);out.push(n.id);
    }
  });
  if(consumed.length)target.bonus=list.filter(o=>!consumed.includes(o));
  return {insts:out,consumed};
}
function revokeInsts(f,k,id){
  (f.insts||[]).forEach(iid=>{
    const i=get("inst",iid);if(!i)return;
    if(i.used>0)fail("Нельзя отменить: бонус «"+i.title+"» уже использован");
  });
  (f.insts||[]).forEach(iid=>{
    const i=get("inst",iid);if(!i)return;
    if(i.fromReserve){i.status="reserved";i.fromReserve=false}
    else S.insts=S.insts.filter(x=>x.id!==iid);
  });
  if(f.consumed&&f.consumed.length){
    const it=get(k,id);if(it){const t=k==="habit"?it.goal:it;t.bonus=[...new Set([...(t.bonus||[]),...f.consumed])]}
  }
}
function addFact(kind,ref,d,c,extra){
  const f=Object.assign({id:uid(),kind,ref,date:d,ts:Date.now(),coins:c,xp:c,insts:[],consumed:[],cancelled:false},extra||{});
  if(c)f.ledger=ledger("earn",c,c,(extra&&extra.title)||"",kind+":"+ref,d);
  if(d===today()){const place=curLocObj();f.loc=place?.id||null;f.locationTitle=place?locName(place):"Без локации"}
  S.facts.push(f);return f;
}

/* ---------- completion ---------- */
function complete(k,id,d,opts){
  d=d||today();opts=opts||{};
  const it=get(k,id);if(!it)fail("Запись не найдена");
  if(!available(it))fail("Действие недоступно: восстановите блок, этап или саму запись либо перенесите действие.");
  if(k==="task"){
    if(it.sched.type==="once"&&doneEver("task",id))fail("Разовое задание уже выполнено");
    if(it.sched.type!=="once"&&doneOn("task",id,d))fail("Сегодня уже выполнено");
    const f=addFact("task",id,d,it.reward,{title:it.title,cycle:it.cycle||0});
    const a=award("task",id,d);f.insts=a.insts;f.consumed=a.consumed;
    return f;
  }
  if(k==='habit'){
    if(doneOn('habit',id,d))fail('Дневная норма уже выполнена');
    const snapshot=S.facts.find(f=>f.kind==='habitStep'&&f.ref===id&&f.date===d),target=snapshot?.target||habitTarget(it,d),reward=snapshot?.dayReward??it.reward;
    if(habitSteps(id,d).length>=target)fail('Дневная норма уже набрана');
    const step=addFact('habitStep',id,d,0,{title:it.title+' — подход',target,dayReward:reward});
    if(habitSteps(id,d).length<target)return step;
    const f=addFact('habit',id,d,reward,{title:it.title,parentStep:step.id,target});step.habitFact=f.id;checkHabitGoal(it,d,f);return f;
  }
  if(k==='cal'){
    const key=calParts(id)[1]||opts.occurrence||calChosen(it),o=Cal.occurrence(it,key);
    if(!o)fail('Появление календарного дела не найдено');if(calDone(it,key))fail('Это появление уже выполнено');
    return addFact('cal',it.id,d,it.reward,{title:it.title,occurrence:key,scheduledDate:o.date,scheduledTime:o.time});
  }
  if(k==="quest"){
    const p=questProgress(it);
    let stepId=null;
    if(it.type==="checklist"){
      stepId=opts.step||(it.steps.find(s=>!p.doneSet.has(s.id))||{}).id;
      if(!stepId)fail("Все шаги уже отмечены");
      if(p.doneSet.has(stepId))fail("Этот шаг уже отмечен");
    }else if(p.done>=p.total)fail("Квест уже завершён");
    const stepTitle=stepId?(it.steps.find(s=>s.id===stepId)||{}).title:"";
    const f=addFact("questStep",id,d,it.stepReward,{title:it.title+(stepTitle?" — "+stepTitle:" +1"),step:stepId,amount:1});
    const np=questProgress(it);
    if(np.done>=np.total){
      const fin=addFact("questFinal",id,d,it.finalReward,{title:"Финал квеста: "+it.title,parent:f.id});
      const a=award("quest",id,d);fin.insts=a.insts;fin.consumed=a.consumed;
      it.status="completed";it.completedAt=d;f.final=fin.id;
    }
    return f;
  }
  fail("Неизвестный тип");
}
function checkHabitGoal(h,d,f){
  if(!h.goal||!h.goal.target)return;
  const key=periodKey(h,d)+"|L"+h.level;
  if(S.facts.some(x=>!x.cancelled&&x.kind==="habitGoal"&&x.ref===h.id&&x.pkey===key))return;
  if(habitCount(h,d)>=h.goal.target){
    const g=addFact("habitGoal",h.id,d,h.goal.reward||0,{title:"Цель привычки: "+h.title+" ("+h.goal.target+")",pkey:key,parent:f.id,threshold:h.goal.target,goalMode:h.goal.mode,goalPeriod:h.goal.period,level:h.level});
    const a=award("habit",h.id,d);g.insts=a.insts;g.consumed=a.consumed;
    f.goalFact=g.id;
  }
}
function undoFact(fid){
  const f=S.facts.find(x=>x.id===fid);if(!f||f.cancelled)fail("Отметка не найдена");
  if(f.kind==='habit'&&f.parentStep){const step=habitSteps(f.ref,f.date).at(-1);if(step)return undoFact(step.id)}
  const chain=[f];
  if(f.kind==='habitStep'){const award=factsOf('habit',f.ref).find(x=>x.date===f.date);if(award)chain.push(award)}

  // A final reward depends on the whole completed set, not just its last tick.
  if(f.kind==="questStep"){
    const final=S.facts.find(x=>!x.cancelled&&x.kind==="questFinal"&&x.ref===f.ref);
    if(final)chain.push(final);
  }
  const removedHabit=chain.find(x=>x.kind==="habit");
  if(removedHabit){
    const f=removedHabit;const h=get("habit",f.ref);
    for(const goal of S.facts.filter(x=>!x.cancelled&&x.kind==="habitGoal"&&x.ref===f.ref)){
      const mode=goal.goalMode||(goal.pkey.startsWith("all")?"total":"period"),period=goal.goalPeriod||(goal.pkey.startsWith("w")?"week":"month");
      const belongs=x=>mode==="total"||period==="week"?mode==="total"||weekStart(x.date)===weekStart(goal.date):monthKey(x.date)===monthKey(goal.date);
      const threshold=goal.threshold||(h?.level===Number(goal.pkey.split("|L")[1])?h.goal.target:h?.levelLog.find(l=>l.level===Number(goal.pkey.split("|L")[1]))?.target);
      if(belongs(f)&&threshold&&factsOf("habit",f.ref).filter(belongs).length-1<threshold)chain.push(goal);
    }
  }
  if(f.final){const x=S.facts.find(y=>y.id===f.final&&!y.cancelled);if(x&&!chain.includes(x))chain.push(x)}
  if(f.goalFact&&!removedHabit){const x=S.facts.find(y=>y.id===f.goalFact&&!y.cancelled);if(x&&!chain.includes(x))chain.push(x)}
  const c=chain.reduce((a,x)=>a+(x.ledger?x.coins:0),0),xx=chain.reduce((a,x)=>a+(x.ledger?x.xp:0),0);
  if(c>0&&coins()-c<0)fail("Нельзя отменить: монеты уже потрачены (нужно вернуть "+c+", на балансе "+coins()+")");
  if(xx>0&&xpTotal()-xx<0)fail("Нельзя отменить: не хватает опыта для возврата");
  chain.forEach(x=>{
    const [k,id]=x.kind==="questFinal"?["quest",x.ref]:x.kind==="habitGoal"?["habit",x.ref]:[x.kind,x.ref];
    revokeInsts(x,k,id);
  });
  chain.forEach(x=>{
    x.cancelled=true;x.cancelledAt=Date.now();
    if(x.ledger)ledger("reversal",-x.coins,-x.xp,"Отмена: "+(x.title||""),x.kind+":"+x.ref);
    if(x.kind==="questFinal"){const q=get("quest",x.ref);if(q){if(q.status==="archived")q.prevStatus="active";else q.status="active";delete q.completedAt}}
  });
  return chain;
}
function undoToday(k,id,d){
  d=d||today();
  const kind=k==="quest"?"questStep":k==="habit"&&habitSteps(id,d).length?"habitStep":k;
  const fs=S.facts.filter(f=>!f.cancelled&&f.kind===kind&&f.ref===id&&f.date===d);
  const f=fs[fs.length-1];if(!f)fail("Нет отметки за этот день");
  return undoFact(f.id);
}

/* ---------- day & plan ---------- */
function dayRec(d){return S.days[d]||(S.days[d]={tempo:"normal",added:[],removed:[],forced:[],ritual:false})}
const dayTempo=d=>(S.days[d]&&S.days[d].tempo)||"normal";
function creativeOn(d){
  const r=S.days[d];
  if(r&&r.creative!==undefined&&d!==today())return r.creative;
  return S.creative.on&&S.creative.since&&S.creative.since<=d;
}
function focusFor(d){
  const r=S.days[d];
  if(d!==today()&&r&&r.focus!==undefined)return r.focus;
  return S.focus.on?{blocks:[...S.focus.blocks],calOther:S.focus.calOther,calUnlinked:S.focus.calUnlinked}:null;
}
function snapshotToday(){
  const r=dayRec(today());
  r.locOtherNoMiss=!!S.loc?.otherNoMiss;
  r.focus=S.focus.on?{blocks:[...S.focus.blocks],calOther:S.focus.calOther,calUnlinked:S.focus.calUnlinked}:null;
  r.creative=!!S.creative.on;
}
function schedOn(s,d){
  if(!s)return false;
  if(s.type==="daily"||s.type==="whenever")return true;
  if(s.type==="weekly"||s.type==="days")return (s.days||[]).includes(wd(d));
  return false;
}
const expectedSched=s=>s&&(s.type==="daily"||s.type==="weekly"||s.type==="days");
function candidates(d){
  const out=[];
  S.tasks.forEach(t=>{
    if(!available(t)||!t.inDay||t.created>d)return;
    if(t.sched.type==="once"){
      const fs=factsOf("task",t.id).filter(f=>(f.cycle||0)===(t.cycle||0));
      if(fs.length){if(fs.some(f=>f.date===d))out.push(rk("task",t.id));return}
      if(t.sched.date?t.sched.date===d:d>=t.created&&d>=today())out.push(rk("task",t.id));
      return;
    }
    if(schedOn(t.sched,d))out.push(rk("task",t.id));
  });
  S.habits.forEach(h=>{if(available(h)&&h.inDay&&h.created<=d&&schedOn(h.sched,d))out.push(rk("habit",h.id))});
  S.quests.forEach(q=>{
    if(!q.inDay||q.created>d)return;
    if(available(q)&&schedOn(q.sched,d))out.push(rk("quest",q.id));
    else if(q.status==="completed"&&doneOn("quest",q.id,d))out.push(rk("quest",q.id));
  });
  S.cal.forEach(c=>{if(available(c)&&c.inDay)Cal.due(c,d).forEach(o=>out.push(calRef(c,o)))});
  return out;
}
function isDoneRef(r,d){
  const [k,id]=pr(r);const it=get(k,id);
  if(k==="task"&&it&&it.sched.type==="once")return doneEver("task",id);
  if(k==="cal"){const c=get("cal",id);return !!c&&calDone(c,calParts(id)[1]||Cal.due(c,d)[0]?.key||calChosen(c))}
  return doneOn(k,id,d);
}
function dayPlan(d,opts){
  const day=S.days[d]||{added:[],removed:[],forced:[]};
  const tempo=dayTempo(d),creative=creativeOn(d),focus=focusFor(d);
  const loc=(d===today()&&!opts?.ignoreLoc)?curLocObj():null;
  const normalize=r=>{const [k,id]=pr(r),c=k==='cal'?get(k,id):null;if(c&&Cal.repeats(c)&&!calParts(id)[1])return calRef(c,Cal.due(c,d)[0]||{key:calDefault(c)});return r};
  let refs=candidates(d);
  (day.added||[]).map(normalize).forEach(r=>{const [k,id]=pr(r);const it=get(k,id);if(it&&(available(it)||isDoneRef(r,d))&&!refs.includes(r))refs.push(r)});
  // items done today always show
  liveFacts().filter(f=>f.date===d&&["task","habit","habitStep","cal","questStep"].includes(f.kind)).forEach(f=>{
    const item=get("cal",f.ref);const r=f.kind==="cal"&&item?calRef(item,{key:f.occurrence||item.date}):rk(f.kind==="questStep"?"quest":f.kind==="habitStep"?"habit":f.kind,f.ref);if(!refs.includes(r)&&get(...pr(r)))refs.push(r)});
  const removed=new Set((day.removed||[]).map(normalize)),forced=new Set((day.forced||[]).map(normalize));
  const visible=[],hidden=[];
  refs.forEach(r=>{
    if(removed.has(r)&&!isDoneRef(r,d))return;
    const [k,id]=pr(r);const it=get(k,id);if(!it)return;
    if(isDoneRef(r,d)&&(k!=="task"||it.sched.type!=="once"||doneOn("task",id,d))&&(k!=="cal"||doneOn("cal",id,d))){visible.push(r);return}
    if(forced.has(r)){visible.push(r);return}
    if(k!=="cal"&&creative){hidden.push({r,why:"creative"});return}
    if(focus){
      if(k==="cal"){
        if(it.blockId&&!focus.blocks.includes(it.blockId)&&!focus.calOther){hidden.push({r,why:"focus"});return}
        if(!it.blockId&&!focus.calUnlinked){hidden.push({r,why:"focus"});return}
      }else if(it.blockId&&!focus.blocks.includes(it.blockId)){hidden.push({r,why:"focus"});return}
    }
    if(k!=="cal"&&!(k==="task"&&it.key)&&!(it.fit||[]).includes(tempo)){hidden.push({r,why:"tempo"});return}
    if(loc&&locHides(it,loc)){hidden.push({r,why:"loc"});return}
    visible.push(r);
  });
  return {visible,hidden,tempo,creative,focus,loc};
}
const WHY_L={tempo:"не подходит темпу дня",focus:"скрыто режимом фокуса",creative:"творческий режим",loc:"в другой локации"};

/* ---------- misses (rollover) ---------- */
function addMiss(kind,ref,d,title,occurrence){
  if(S.misses.some(m=>m.kind===kind&&m.ref===ref&&(kind==="cal"?(m.occurrence||m.date)===(occurrence||d):m.date===d)))return;
  S.misses.push({id:uid(),kind,ref,date:d,title,status:"active",note:"",created:Date.now(),...(occurrence?{occurrence}:{})});
}
function finalizeDay(d){
  const p=dayPlan(d,{ignoreLoc:true});
  const rec=dayRec(d);
  const seen=rec.locsSeen||[];
  const excusedByLoc=it=>!!(rec.locOtherNoMiss&&seen.length&&!seen.includes("*")&&it.locs?.length&&!it.locs.some(id=>seen.includes(id)));
  if(rec.creative===undefined)rec.creative=p.creative;
  if(rec.focus===undefined)rec.focus=p.focus;
  p.visible.forEach(r=>{
    const [k,id]=pr(r);const it=get(k,id);if(!it||k==="cal")return;
    if(isDoneRef(r,d)||excusedByLoc(it))return;
    if(k==="task"){
      if(it.sched.type==="once"){if(it.sched.date===d)addMiss("task",id,d,it.title);return}
      if(expectedSched(it.sched))addMiss("task",id,d,it.title);
      return;
    }
    if(k==="habit"&&expectedSched(it.sched))addMiss("habit",id,d,it.title);
    if(k==="quest"&&it.status==="active"&&expectedSched(it.sched))addMiss("quest",id,d,it.title);
  });
  // calendar: commitments regardless of plan or pause
  S.cal.forEach(c=>{if(available(c))for(const o of Cal.due(c,d))if(!calDone(c,o.key))addMiss("cal",c.id,d,c.title,o.key)});
}
function processDays(){
  const t=today();
  if(!S.lastProcessed){S.lastProcessed=t;return true}if(S.lastProcessed>t)return false
  let changed=false,guard=0;
  while(S.lastProcessed<t&&guard<40000){finalizeDay(S.lastProcessed);S.lastProcessed=addDays(S.lastProcessed,1);changed=true;guard++}
  return changed;
}

/* ---------- transactions ---------- */
function renderRetainingDrafts(){
  const forms=$$('form').map(f=>({kind:f.dataset.form,id:f.dataset.id||'',values:[...f.elements].filter(x=>x.name).map(x=>({name:x.name,value:x.value,checked:x.checked})),multi:[...f.querySelectorAll('[aria-pressed]')].map(x=>({v:x.dataset.v,pressed:x.getAttribute('aria-pressed'),group:x.closest('[data-multi]')?.dataset.multi}))}));
  render();
  for(const draft of forms){const f=$$('form').find(f=>f.dataset.form===draft.kind&&(f.dataset.id||'')===draft.id);if(!f)continue;for(const v of draft.values){const x=f.elements.namedItem(v.name);if(x&&'value' in x){x.value=v.value;if(x.type==='checkbox')x.checked=v.checked}}for(const v of draft.multi){if(!v.group)continue;const x=[...f.querySelectorAll('[data-multi] [data-v]')].find(x=>x.closest('[data-multi]').dataset.multi===v.group&&x.dataset.v===v.v);if(x)x.setAttribute('aria-pressed',v.pressed)}}
}
function tx(fn,msg){
  const backup=JSON.stringify(S),oldCoins=coins();let r;
  try{
    if(!activeOperation)throw Error('Операция должна выполняться под защитой записи.');
    r=fn();if(r===false){S=JSON.parse(backup);return false}locTick();save();
  }catch(e){S=JSON.parse(backup);renderRetainingDrafts();toast(e.message);return false}
  render();if(coins()>oldCoins)animateWallet(oldCoins,coins());else if(coins()<oldCoins)stopWallet();if(msg)toast(typeof msg==='function'?msg(r):msg);return r===undefined?true:r;
}


/* ---------- misc model helpers ---------- */
function pushRecent(k,id){S.recent.unshift({k,id,at:Date.now()});S.recent=S.recent.filter(r=>Date.now()-r.at<15*60e3).slice(0,30)}
function newTask(p){return Object.assign({id:uid(),title:"",locs:[],desc:"",reward:DEF_REWARD.task,sched:{type:"once",days:[],date:null},blockId:null,stageId:null,goalId:null,inDay:true,key:false,fit:["normal","hard"],cat:"",tags:[],ifThen:"",bonus:[],status:"active",created:today()},p||{})}
function newHabit(p){return Object.assign({id:uid(),title:"",locs:[],desc:"",reward:DEF_REWARD.habit,dailyTarget:1,norms:[],sched:{type:"daily",days:[]},goal:{mode:"total",period:"month",target:30,reward:DEF_REWARD.habitGoal,bonus:[]},level:1,levelLog:[],blockId:null,stageId:null,goalId:null,inDay:true,fit:["rest","normal","hard"],cat:"",tags:[],ifThen:"",status:"active",created:today()},p||{})}
function newQuest(p){return Object.assign({id:uid(),title:"",locs:[],desc:"",type:"counter",target:10,steps:[],stepReward:DEF_REWARD.questStep,finalReward:DEF_REWARD.questFinal,bonus:[],sched:{type:"whenever",days:[]},blockId:null,stageId:null,goalId:null,inDay:false,fit:["normal","hard"],cat:"",tags:[],ifThen:"",status:"active",created:today()},p||{})}
function newCal(p){return Object.assign({id:uid(),title:"",locs:[],date:today(),time:"",note:"",repeat:{type:"none",days:[]},exceptions:{},retained:[],until:null,reminderLead:15,reminderReceipts:{},reward:DEF_REWARD.cal,blockId:null,stageId:null,inDay:true,reminder:true,status:"active",created:today()},p||{})}
function newOffer(p){return Object.assign({id:uid(),title:"",desc:"",price:100,use:"once",limit:3,cat:"",tags:[],status:"active",created:today()},p||{})}
function newDecision(p){return Object.assign({id:uid(),text:"",stageId:null,deadline:null,priceC:0,priceX:0,status:"active",created:today(),linkedAt:null,closedAt:null},p||{})}
function itemsOfStage(sid){
  return {
    tasks:S.tasks.filter(t=>t.stageId===sid&&t.status!=="archived"),
    habits:S.habits.filter(t=>t.stageId===sid&&t.status!=="archived"),
    quests:S.quests.filter(t=>t.stageId===sid&&t.status!=="archived"),
    cal:S.cal.filter(t=>t.stageId===sid&&t.status!=="archived"),
    goals:S.goals.filter(g=>g.stageId===sid),
    decisions:S.decisions.filter(x=>x.stageId===sid)
  };
}
const isFinished=(k,it)=>k==="task"?(it.status==="closed"||(it.sched.type==="once"&&doneEver("task",it.id))):k==="quest"?(it.status!=="active"):it.status!=="active";
function stageCounters(sid){
  const it=itemsOfStage(sid);
  const t=new Date();const plan=dayPlan(today());const inDay=new Set([...plan.visible,...plan.hidden.map(h=>h.r)]);
  const c={open:{task:0,habit:0,quest:0},done:{task:0,habit:0,quest:0},inDay:0};
  it.tasks.forEach(x=>{isFinished("task",x)?c.done.task++:c.open.task++;if(inDay.has(rk("task",x.id))&&!isFinished("task",x))c.inDay++});
  it.habits.forEach(x=>{isFinished("habit",x)?c.done.habit++:c.open.habit++;if(inDay.has(rk("habit",x.id))&&!isFinished("habit",x))c.inDay++});
  it.quests.forEach(x=>{isFinished("quest",x)?c.done.quest++:c.open.quest++;if(inDay.has(rk("quest",x.id))&&!isFinished("quest",x))c.inDay++});
  return c;
}
/* ================= UI CORE: navigation, header, sheets, dialogs, events ================= */
const ACT={},FORMS={},SCR={};
const NAV={tab:"home",stack:[{s:"home",p:{}}]};
const IC={
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  day:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
  map:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/></svg>',
  inbox:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/></svg>',
  more:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  bolt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M13 3L5 13h6l-1 8 8-10h-6z"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L19 7"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  starOn:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  dots:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>'
};

/* ---------- navigation ---------- */
function go(s,p,replace){
  if(replace)NAV.stack[NAV.stack.length-1]={s,p:p||{}};else NAV.stack.push({s,p:p||{}});
  render();window.scrollTo(0,0);
}
function goTab(tab){
  const map={home:"home",day:"day",map:"map",inbox:"inbox",more:"more"};
  NAV.tab=tab;NAV.stack=[{s:map[tab],p:{}}];render();window.scrollTo(0,0);
}
function goBack(){if(NAV.stack.length>1){NAV.stack.pop();render()}}
const curScr=()=>NAV.stack[NAV.stack.length-1];

/* ---------- toast ---------- */
let toastT;
function toast(msg){
  clearTimeout(toastT);
  let el=$(".toast");
  if(!el){el=document.createElement("div");el.className="toast";el.setAttribute("role","status");document.body.appendChild(el)}
  el.textContent=msg;el.hidden=false;toastT=setTimeout(()=>{el.hidden=true},2800);
}

/* ---------- sheets ---------- */
const SHEETS=[];
function openSheet(title,body,opts){
  opts=opts||{};
  const layer=$("#layer");
  const wrap=document.createElement("div");
  wrap.className="overlay"+(opts.center?" center":"");
  wrap.style.zIndex=20+SHEETS.length*2;
  wrap.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="sh-title"><span>'+esc(title)+'</span><button class="ib x" data-act="sheet-close" aria-label="Закрыть">✕</button></div><div class="sh-body">'+body+'</div></div>';
  wrap.addEventListener("click",e=>{if(e.target===wrap&&!opts.modal)closeSheet()});
  wrap.dataset.revision=S?.revision||0;wrap.dataset.space=META.space||'';wrap.querySelectorAll('form').forEach(f=>{f.dataset.revision=wrap.dataset.revision;f.dataset.space=wrap.dataset.space});
  layer.appendChild(wrap);
  SHEETS.push({el:wrap,onClose:opts.onClose,key:opts.key});
  if(!opts.noFocus){const f=wrap.querySelector("input[type=text]:not([readonly]),textarea");if(f)setTimeout(()=>f.focus(),40)}
  return wrap;
}
function closeSheet(){const s=SHEETS.pop();if(s){s.el.remove();if(s.onClose)s.onClose()}}
function closeAllSheets(){while(SHEETS.length)closeSheet()}
function topSheet(){return SHEETS.length?SHEETS[SHEETS.length-1].el:null}
function refreshSheet(key,bodyFn){const s=SHEETS.find(x=>x.key===key);if(s){s.el.querySelector(".sh-body").innerHTML=bodyFn();s.el.querySelectorAll("form").forEach(f=>{f.dataset.revision=S.revision||0;f.dataset.space=META.space})}}

/* confirm dialog → Promise<boolean|string> */
function ask(o){
  return new Promise(res=>{
    let done=false;
    const body=(o.text?'<p>'+esc(o.text)+'</p>':'')+
      (o.input?'<input type="text" id="ask-in" placeholder="'+esc(o.input)+'" autocomplete="off">':'')+
      '<div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn" data-ask="no">'+esc(o.cancel||"Отмена")+'</button><button class="btn primary'+(o.danger?' danger':'')+'" data-ask="yes">'+esc(o.ok||"Подтвердить")+'</button></div>';
    const el=openSheet(o.title||"Подтверждение",body,{center:true,modal:true,onClose:()=>{if(!done){done=true;res(false)}}});
    el.addEventListener("click",e=>{
      const b=e.target.closest("[data-ask]");if(!b)return;
      const val=b.dataset.ask==="yes"?(o.input?($("#ask-in",el).value||"").trim():true):false;
      if(o.input&&b.dataset.ask==="yes"&&o.match&&val!==o.match){toast("Введите «"+o.match+"» для подтверждения");return}
      done=true;closeSheet();res(val);
    });
  });
}

/* ---------- render ---------- */
function balChip(){
  const c=coins(),x=xpTotal();
  return '<button class="bal" data-act="go" data-s="economy" title="Монеты и опыт"><span data-wallet class="'+(c<0?'neg':'c')+'">● '+num(c)+'</span><span class="'+(x<0?'neg':'x')+'">Ур. '+level()+'</span></button>';
}
function banners(){
  let h="";
  if(S.space==="demo")h+='<div class="banner demo">Демо: вымышленная жизнь, ваши данные не затрагиваются.<button class="btn s" data-act="space-my">К своей жизни</button></div>';
  if(S.creative.on)h+='<div class="banner creative">Творческий режим с '+short(S.creative.since)+'. Система на паузе'+(S.creative.mute?', напоминания отключены':'')+'.<button class="btn s" data-act="creative-off">Вернуться</button></div>';
  if(S.focus.on)h+='<div class="banner focus">Режим фокуса: '+S.focus.blocks.map(id=>{const b=get("block",id);return b?esc(b.icon+" "+b.name):""}).join(", ")+'<button class="btn s" data-act="focus-open">Изменить</button></div>';
  return h;
}
const TITLES={home:"Главная",day:"Конструктор дня",map:"Карта жизни",inbox:"Входящие",more:"Разделы"};
function render(){
  document.documentElement.dataset.style=S?effectiveStyle():"quest";
  delete document.documentElement.dataset.accent;
  const theme=$('meta[name="theme-color"]');if(theme)theme.content=getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  if(!META.space||!S){renderWelcome();showStoragePanel();return}

  const c=curScr();
  const fn=SCR[c.s]||SCR.home;
  let body="";
  try{body=fn(c.p||{})}catch(e){console.error(e);body='<div class="card">Экран не построился: '+esc(e.message)+'</div>'}
  const isRoot=NAV.stack.length<=1;
  const head='<header class="top">'+
    (isRoot?'<div class="grow"><div class="brand">LifeGame</div><div class="sub">'+esc(human(today()))+(META.space==='demo'&&META.offset?' · тест':'')+'</div></div>':
      '<button class="back" data-act="back">←</button><div class="grow"><div class="brand" style="font-size:14px">'+esc(c.title||"")+'</div><div class="sub">'+esc(short(today()))+(META.space==='demo'&&META.offset?' · тест':'')+'</div></div>')+
    balChip()+
    '<button class="hbtn" data-act="quick-done" title="Быстрое выполнение" aria-label="Быстрое выполнение">'+IC.bolt+'</button>'+
    '<button class="hbtn" data-act="search" title="Поиск" aria-label="Поиск">'+IC.search+'</button>'+
    (META.space==='demo'?'<button class="hbtn" data-act="test-menu" title="Тестовая дата">Тест</button>':'')+'</header>';
  $("#app").innerHTML=head+banners()+body;
  const inboxN=S.inbox.length+S.decisions.filter(d=>d.status==="active"&&!d.stageId).length;
  const tabs=[["home","Главная"],["day","День"],["map","Карта"],["inbox","Входящие"],["more","Разделы"]];
  $("#tabs").innerHTML=tabs.map(([k,l])=>'<button data-act="tab" data-v="'+k+'" '+(NAV.tab===k?'aria-current="page"':'')+'>'+IC[k]+'<span>'+l+'</span>'+(k==="inbox"&&inboxN?'<span class="badge">'+inboxN+'</span>':'')+'</button>').join("");
  $("nav.tabs").hidden=false;$("#fab").hidden=false;
  $('#app').dataset.revision=S.revision||0;$('#app').dataset.space=META.space;$('#tabs').dataset.revision=S.revision||0;$('#tabs').dataset.space=META.space;renderMiniTimer();renderHelper();showStoragePanel();
}

/* ---------- event delegation ---------- */
document.addEventListener("click",e=>{
  const el=e.target.closest("[data-act]");if(!el)return;
  const fn=ACT[el.dataset.act];
  if(fn){if(el.tagName==="A")e.preventDefault();if(['sheet-close','seg','chipm','day-btn','recovery-export','recovery-backup','load-fresh'].includes(el.dataset.act))fn(el,e);else runGuarded(()=>fn(el,e),el)}
});
document.addEventListener("submit",e=>{
  const f=e.target;const fn=FORMS[f.dataset.form];
  if(fn){e.preventDefault();runGuarded(()=>fn(f,e),f)}
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&SHEETS.length)closeSheet();
});
ACT["tab"]=el=>{closeAllSheets();goTab(el.dataset.v)};
ACT["back"]=()=>goBack();
ACT["go"]=el=>{closeAllSheets();const same=curScr().s===el.dataset.s;go(el.dataset.s,Object.assign({},el.dataset),same)};
ACT["sheet-close"]=()=>closeSheet();
ACT["noop"]=()=>{};

/* ---------- form helpers ---------- */
const fv=(f,name)=>{const el=f.querySelector('[name="'+name+'"]');return el?(el.type==="checkbox"?el.checked:String(el.value).trim()):""};
const fnum=(f,name,def)=>{const v=parseInt(fv(f,name),10);return isNaN(v)?(def||0):v};
const opt=(v,l,cur)=>'<option value="'+esc(v)+'"'+(String(cur)===String(v)?' selected':'')+'>'+esc(l)+'</option>';
const segBtns=(name,pairs,cur)=>'<div class="seg" role="group" data-seg="'+name+'">'+pairs.map(([v,l])=>'<button type="button" data-act="seg" data-v="'+v+'" aria-pressed="'+(cur===v)+'">'+esc(l)+'</button>').join("")+'</div><input type="hidden" name="'+name+'" value="'+esc(cur)+'">';
ACT["seg"]=el=>{
  const g=el.closest("[data-seg]");g.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b===el));
  const inp=g.nextElementSibling;if(inp&&inp.name===g.dataset.seg){inp.value=el.dataset.v;inp.dispatchEvent(new Event("change",{bubbles:true}))}
};
const chipsMulti=(name,pairs,cur)=>'<div class="chips" data-multi="'+name+'">'+pairs.map(([v,l])=>'<button type="button" class="chip" data-act="chipm" data-v="'+v+'" aria-pressed="'+cur.includes(v)+'">'+esc(l)+'</button>').join("")+'</div>';
ACT["chipm"]=el=>el.setAttribute("aria-pressed",el.getAttribute("aria-pressed")!=="true");
const multiVal=(f,name)=>{const g=f.querySelector('[data-multi="'+name+'"]');return g?[...g.querySelectorAll('[aria-pressed="true"]')].map(b=>b.dataset.v):[]};
function blockSelect(name,cur,withNone){
  return '<select name="'+name+'">'+(withNone!==false?opt("","Без блока",cur||""):"")+S.blocks.filter(b=>b.status==="active"||b.id===cur).map(b=>opt(b.id,b.icon+" "+b.name+(b.status==="archived"?" (в архиве)":""),cur)).join("")+'</select>';
}
function stageSelect(name,blockId,cur){
  const st=blockId?S.stages.filter(s=>s.blockId===blockId&&(s.status==="open"||s.id===cur)).sort((a,b)=>a.order-b.order):[];
  return '<select name="'+name+'">'+opt("","Без этапа",cur||"")+st.map(s=>opt(s.id,s.name+" ("+ROLE_L[stageRole(s)].toLowerCase()+")",cur)).join("")+'</select>';
}
function goalSelect(name,stageId,cur){
  const gs=stageId?S.goals.filter(g=>g.stageId===stageId&&(g.status==="active"||g.id===cur)):[];
  return '<select name="'+name+'">'+opt("","Не ведёт к цели",cur||"")+gs.map(g=>opt(g.id,"Ведёт к цели: "+g.title,cur)).join("")+(stageId&&get("stage",stageId)?.status==='open'?opt("__new","+ Новая цель этапа…",""):"")+'</select>';
}
/* link block→stage→goal selects inside a form */
document.addEventListener("change",e=>{
  const f=e.target.form;if(!f)return;
  if(e.target.name==="blockId"&&f.querySelector('[data-multi="locs"]')){const b=get("block",e.target.value);if(b?.loc)f.querySelectorAll('[data-multi="locs"] [data-v]').forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.v===b.loc)))}
  if(e.target.name==="blockId"&&f.querySelector('[name="stageId"]')){
    f.querySelector('[name="stageId"]').outerHTML=stageSelect("stageId",e.target.value,"");
    const cur=get("block",e.target.value);
    if(cur&&cur.currentStageId){const s=f.querySelector('[name="stageId"]');if([...s.options].some(o=>o.value===cur.currentStageId))s.value=cur.currentStageId}
    const g=f.querySelector('[name="goalId"]');if(g)g.outerHTML=goalSelect("goalId",f.querySelector('[name="stageId"]').value,"");
  }
  if(e.target.name==="goalId"&&e.target.value==="__new"){openGoalDraft(f);return}
  if(["blockId","stageId"].includes(e.target.name))delete f._goalDraft;
  if(e.target.name==="stageId"&&f.querySelector('[name="goalId"]')){
    f.querySelector('[name="goalId"]').outerHTML=goalSelect("goalId",e.target.value,"");
  }
  if(e.target.name==="schedType"){
    const v=e.target.value;
    const dd=f.querySelector("[data-days]"),dt=f.querySelector("[data-date]");
    if(dd)dd.hidden=!(v==="days"||v==="weekly");
    if(dt)dt.hidden=v!=="once";
    if(dd&&v==="weekly"){const on=[...dd.querySelectorAll('[aria-pressed="true"]')];if(on.length!==1){dd.querySelectorAll("button").forEach((b,i)=>b.setAttribute("aria-pressed",String(i===(on.length?+on[0].dataset.v-1:0))))}}
  }
  if(e.target.name==="qtype"){const v=e.target.value;const a=f.querySelector("[data-qcounter]"),b=f.querySelector("[data-qcheck]");if(a)a.hidden=v!=="counter";if(b)b.hidden=v!=="checklist"}
  if(e.target.name==="gmode"){const p=f.querySelector("[data-gperiod]");if(p)p.hidden=e.target.value!=="period"}
  if(e.target.name==="use"){const p=f.querySelector("[data-limit]");if(p)p.hidden=e.target.value!=="limited"}
  if(e.target.name==="key"&&e.target.checked){const c=f.querySelector('[name="inDay"]');if(c&&!c.checked){c.checked=true;toast("Ключевое действие включило «В Конструктор дня». Его можно снять отдельно.")}}
});
ACT["day-btn"]=el=>{
  const g=el.closest("[data-days]");
  const f=el.closest("form");
  const weekly=f&&f.querySelector('[name="schedType"]')&&f.querySelector('[name="schedType"]').value==="weekly";
  if(weekly)g.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b===el)));
  else el.setAttribute("aria-pressed",el.getAttribute("aria-pressed")!=="true");
};
function schedFields(s,types){
  types=types||[["once","Разово"],["daily","Каждый день"],["weekly","Раз в неделю"],["days","По дням"]];
  return '<label class="f">Расписание</label>'+segBtns("schedType",types,s.type)+
    '<div data-days '+((s.type==="days"||s.type==="weekly")?'':'hidden')+'><div class="days">'+WD.map((l,i)=>'<button type="button" data-act="day-btn" data-v="'+(i+1)+'" aria-pressed="'+(s.days||[]).includes(i+1)+'">'+l+'</button>').join("")+'</div></div>'+
    (types.some(t=>t[0]==="once")?'<div data-date '+(s.type==="once"?'':'hidden')+'><label class="f">Дата (необязательно)</label><input type="date" name="date" value="'+(s.date||"")+'"></div>':'');
}
function readSched(f){
  const type=fv(f,"schedType");
  const days=[...f.querySelectorAll("[data-days] [aria-pressed=true]")].map(b=>+b.dataset.v).sort();
  if((type==="days"||type==="weekly")&&!days.length)fail("Выберите день недели");
  return {type,days:(type==="days"||type==="weekly")?days:[],date:type==="once"?(fv(f,"date")||null):null};
}
function fitFields(fit){return '<label class="f">Подходит темпу дня</label>'+chipsMulti("fit",TEMPO,fit)+'<div class="meta" style="margin-top:4px">В дни с другим темпом запись уходит в «Скрыто сегодня» и не становится пропуском.</div>'}
function catTagFields(it){return '<div class="grid2"><div><label class="f">Категория</label><input type="text" name="cat" value="'+esc(it.cat||"")+'"></div><div><label class="f">Теги через запятую</label><input type="text" name="tags" value="'+esc((it.tags||[]).join(", "))+'"></div></div>'}
const readTags=f=>fv(f,"tags").split(",").map(s=>s.trim()).filter(Boolean);
/* ================= LOCATIONS: current place, switching, profiles, schedule ================= */
const HOME_PARTS=[["motivation","Мотивация"],["invites","Приглашения на сессии"],["modes","Фокус и творческий режим"],["upcoming","Ближайшие календарные дела"],["decisions","Решения со сроком"],["grid","Плитки разделов"]];
const DAY_PARTS=[["key","Ключевые действия"],["cal","Календарь"],["task","Задания"],["habit","Привычки"],["quest","Квесты"],["widgets","Виджеты"],["evening","Вечер и итоги"]];
const hhmm=ms=>{const d=new Date(ms);return pad(d.getHours())+":"+pad(d.getMinutes())};
const locName=l=>l?l.icon+" "+l.name:"Везде";
function locStatusText(L){
  if(L.source==="manual")return "выбрано вручную"+(L.until&&L.until-Date.now()<864e5?" до "+hhmm(L.until):"");
  if(L.source==="schedule")return "по расписанию"+(L.until?" до "+hhmm(L.until):"");
  if(L.source==="fallback")return "вне расписания";
  return "все дела видны";
}
function locBar(){
  if(!S.loc||!S.locations.length)return "";
  const L=currentLoc(),loc=locById(L.id);
  return '<div class="locbar"><button class="locchip" data-act="loc-menu" aria-label="Сменить локацию">'+esc(locName(loc))+' <span aria-hidden="true">▾</span></button><span class="meta">'+esc(locStatusText(L))+'</span></div>';
}
/* Guarded bookkeeping: remembers today, applies profile tempo only on a real change. */
function locTick(){
  if(!S||!S.loc)return false;
  const L=currentLoc();let changed=false;
  const id=L.id||null;
  const record=dayRec(today());
  if(S.loc.lastSeen!==id||record.locProfileSeen!==id){
    record.locProfileSeen=id;
    S.loc.lastSeen=id;changed=true;
    const loc=locById(id),r=dayRec(today());
    if(loc&&loc.tempo&&!r.tempoManual&&r.tempo!==loc.tempo){r.tempo=loc.tempo}
  }
  const rec=dayRec(today());if(rec.locOtherNoMiss!==!!S.loc.otherNoMiss){rec.locOtherNoMiss=!!S.loc.otherNoMiss;changed=true}
  if(noteLocSeen())changed=true;
  return changed;
}
function effectiveStyle(){const l=S&&S.loc?curLocObj():null;return (l&&l.style)||(S&&S.settings.style)||"quest"}

/* ---------- switching ---------- */
ACT["loc-menu"]=()=>{
  const L=currentLoc();const sched=scheduledLoc(today(),nowMinutes());
  openSheet("Где вы сейчас",'<p class="meta">Меняет Главную и Конструктор дня: видны дела этой локации и дела без локации. Остальное — в «Скрыто сегодня».</p>'+
    '<div class="grid2" style="margin-top:8px">'+S.locations.map(l=>'<button class="tile" data-act="loc-set" data-id="'+l.id+'" aria-pressed="'+(L.id===l.id)+'" style="'+(L.id===l.id?'border-color:var(--accent);box-shadow:var(--glow)':'')+'"><b style="font-size:16px">'+esc(l.icon+" "+l.name)+'</b><span class="meta">'+esc(locSummary(l))+'</span></button>').join("")+
    '<button class="tile" data-act="loc-set" data-id="" style="'+(!L.id?'border-color:var(--accent);box-shadow:var(--glow)':'')+'"><b style="font-size:16px">Везде</b><span class="meta">Все дела, обычный интерфейс</span></button></div>'+
    (L.source==="manual"?'<button class="btn block" style="margin-top:10px" data-act="loc-auto">Вернуть по расписанию'+(S.loc.schedule.length?' ('+esc(locName(locById(sched.id)))+')':'')+'</button>':'')+
    '<div class="row" style="margin-top:10px"><button class="btn ghost s" data-act="go" data-s="locations">Настроить локации и расписание</button></div>');
};
ACT["loc-set"]=el=>{
  const id=el.dataset.id||null;
  closeAllSheets();
  tx(()=>{
    const sched=scheduledLoc(today(),nowMinutes());
    if(S.loc.schedule.length&&sched.id===id)S.loc.manual=null;
    else S.loc.manual={id,until:nextBoundary()};
  },()=>"Сейчас: "+locName(locById(id)));
};
ACT["loc-auto"]=()=>{closeAllSheets();tx(()=>{S.loc.manual=null},()=>"По расписанию: "+locName(curLocObj()))};

/* ---------- locations screen ---------- */
function locSummary(l){
  const p=[];
  p.push(l.blocks.length?"блоков: "+l.blocks.length:"все блоки");
  const hid=l.homeHide.length+l.dayHide.length;if(hid)p.push("скрыто частей: "+hid);
  if(l.widgets)p.push("свои виджеты");
  if(l.muteOther)p.push("тихо для других");
  if(l.tempo)p.push("темп «"+TEMPO_L[l.tempo]+"»");
  if(l.style)p.push("стиль «"+STYLES.find(x=>x[0]===l.style)[1]+"»");
  return p.join(" · ");
}
const ruleText=r=>{const ds=r.days.length===7?"Каждый день":r.days.length===5&&r.days.every(d=>d<=5)?"Пн–Пт":r.days.length===2&&r.days.includes(6)&&r.days.includes(7)?"Сб–Вс":r.days.map(n=>WD[n-1]).join(", ");return ds+" "+r.from+"–"+r.to};
SCR.locations=()=>{
  curScr().title="Локации";
  const L=currentLoc();
  const cnt=id=>[...S.tasks,...S.habits,...S.quests,...S.cal].filter(x=>x.status!=="archived"&&(x.locs||[]).includes(id)).length;
  let h='<h1>Локации</h1><p class="lead">Где вы сейчас меняет Главную и Конструктор дня: видны дела этой локации и дела без локации, а профиль локации прячет лишнее. Карта, разделы и данные не меняются.</p>';
  h+='<div class="card" style="margin-top:8px"><div class="between"><div><div class="meta">Сейчас</div><b style="font-size:16px">'+esc(locName(locById(L.id)))+'</b><div class="meta">'+esc(locStatusText(L))+'</div></div><button class="btn s primary" data-act="loc-menu">Сменить</button></div></div>';
  h+='<h2>Места <span class="count">'+S.locations.length+'</span></h2><div class="list">'+S.locations.map(l=>'<div class="card"><div class="between"><b style="font-size:15px">'+esc(l.icon+" "+l.name)+'</b><span class="meta">записей: '+cnt(l.id)+'</span></div><div class="meta" style="margin-top:2px">'+esc(locSummary(l))+'</div><div class="row" style="margin-top:8px"><button class="btn s" data-act="loc-edit" data-id="'+l.id+'">Профиль</button><button class="btn s ghost danger" data-act="loc-del" data-id="'+l.id+'">Удалить</button></div></div>').join("")+'</div>';
  h+='<div class="row" style="margin-top:8px"><button class="btn primary" data-act="loc-new">+ Локация</button></div>';
  h+='<h2>Примерный график</h2><div class="card">'+(S.loc.schedule.length?S.loc.schedule.map(r=>'<div class="mini"><div class="t">'+esc(ruleText(r))+' → <b>'+esc(locName(locById(r.locId)))+'</b></div><button class="btn ghost s" data-act="rule-edit" data-id="'+r.id+'">Изменить</button><button class="ib" data-act="rule-del" data-id="'+r.id+'" aria-label="Удалить правило">✕</button></div>').join(""):'<div class="empty">Правил нет: локация меняется только вручную.</div>')+
    '<div class="row" style="margin-top:8px"><button class="btn s" data-act="rule-new">+ Правило</button></div>'+
    '<label class="f">Вне расписания</label><select data-locfallback>'+opt("","Везде — все дела",S.loc.fallback||"")+S.locations.map(l=>opt(l.id,l.icon+" "+l.name,S.loc.fallback||"")).join("")+'</select>'+
    '<p class="meta" style="margin-top:6px">Ручной выбор всегда главнее графика и действует до следующей смены по графику. Если графика нет — пока вы сами не смените локацию.</p></div>';
  h+='<h2>Правила</h2><div class="card">'+
    '<label class="tog" style="margin-top:0"><input type="checkbox" data-locset="otherNoMiss" '+(S.loc.otherNoMiss?'checked':'')+'><span>Дела других локаций не становятся пропусками<small>Если за день вы ни разу не были в локации дела, оно не попадёт в «Невыполненные». По умолчанию выключено: локация меняет только видимость, план дня остаётся прежним.</small></span></label>'+
    '<label class="tog"><input type="checkbox" data-locset="tagNew" '+(S.loc.tagNew?'checked':'')+'><span>Быстрое добавление ставит текущую локацию<small>Записали мысль на работе — она уже «рабочая». Можно сменить при записи.</small></span></label></div>';
  return h;
};
document.addEventListener("change",e=>{
  if(e.target.matches("[data-locfallback]")){const v=e.target.value||null;runGuarded(()=>tx(()=>{S.loc.fallback=v},"Сохранено"),e.target)}
  if(e.target.dataset&&e.target.dataset.locset){const k=e.target.dataset.locset,v=e.target.checked;runGuarded(()=>tx(()=>{S.loc[k]=v},"Сохранено"),e.target)}
});

/* ---------- location profile editor ---------- */
ACT["loc-new"]=()=>locEditor(null);
ACT["loc-edit"]=el=>locEditor(locById(el.dataset.id));
function locEditor(l){
  const isNew=!l;l=l||newLocation({});
  const blocks=S.blocks.filter(b=>b.status==="active");
  const cb=(name,checked,label,sub)=>'<label class="tog" style="margin-top:4px"><input type="checkbox" name="'+name+'" '+(checked?'checked':'')+'><span>'+esc(label)+(sub?'<small>'+esc(sub)+'</small>':'')+'</span></label>';
  openSheet(isNew?"Новая локация":"Профиль: "+l.name,'<form data-form="location" data-id="'+(isNew?"":l.id)+'">'+
    '<label class="f">Название</label><input type="text" name="name" value="'+esc(l.name)+'" required maxlength="60" placeholder="Например: Дача">'+
    '<label class="f">Значок</label><div class="chips">'+LOC_ICONS.map(i=>'<button type="button" class="chip" data-act="icon-pick" data-v="'+i+'" aria-pressed="'+(l.icon===i)+'">'+i+'</button>').join("")+'</div><input type="hidden" name="icon" value="'+esc(l.icon)+'">'+
    '<h2>Видимые блоки</h2><p class="meta">Отметьте направления, о которых думать здесь. Ничего не отмечено — видны все. Дела без блока видны всегда.</p><div class="card flat">'+blocks.map(b=>cb("lb_"+b.id,l.blocks.includes(b.id),b.icon+" "+b.name)).join("")+'</div>'+
    '<h2>Главная: что показывать</h2><div class="card flat">'+HOME_PARTS.map(([k,t])=>cb("lh_"+k,!l.homeHide.includes(k),t)).join("")+'</div>'+
    '<h2>Конструктор: что показывать</h2><div class="card flat">'+DAY_PARTS.map(([k,t])=>cb("ld_"+k,!l.dayHide.includes(k),t)).join("")+'<p class="meta" style="margin-top:6px">Скрытый раздел не отменяет его дела: они остаются в плане дня.</p></div>'+
    '<h2>Виджеты в Конструкторе</h2><div class="card flat">'+cb("lw_own",!!l.widgets,"Свой набор виджетов здесь","Иначе — как в общих настройках виджетов")+
      '<div data-lwlist '+(l.widgets?'':'hidden')+'>'+S.widgets.mine.map(w=>cb("lw_"+w,(l.widgets||[]).includes(w),WIDGETS[w].t)).join("")+(S.widgets.mine.length?'':'<p class="meta">В «Моих виджетах» пусто.</p>')+'</div></div>'+
    '<h2>Напоминания и темп</h2><div class="card flat">'+cb("muteOther",l.muteOther,"Приглушать напоминания других локаций","Календарные напоминания дел другой локации и скрытых блоков здесь не появятся")+
      '<label class="f">Темп дня при переходе сюда</label><select name="tempo">'+opt("","Не менять",l.tempo||"")+TEMPO.map(([v,t])=>opt(v,t,l.tempo||"")).join("")+'</select><p class="meta" style="margin-top:4px">Если вы сегодня уже выбрали темп сами, он не меняется.</p></div>'+
    '<h2>Оформление</h2><div class="card flat"><select name="style">'+opt("","Как в общих настройках",l.style||"")+STYLES.map(([v,t])=>opt(v,t,l.style||"")).join("")+'</select></div>'+
    '<div class="row" style="margin-top:14px"><button class="btn primary">'+(isNew?'Создать':'Сохранить')+'</button><button type="button" class="btn" data-act="sheet-close">Отмена</button></div></form>');
}
document.addEventListener("change",e=>{if(e.target.name==="lw_own"){const f=e.target.form;const box=f.querySelector("[data-lwlist]");if(box)box.hidden=!e.target.checked}});
FORMS.location=f=>{
  const ok=tx(()=>{
    const name=fv(f,"name");if(!name)fail("Введите название");
    if(S.locations.some(x=>x.name.toLowerCase()===name.toLowerCase()&&x.id!==f.dataset.id))fail("Такая локация уже есть");
    const l=locById(f.dataset.id)||newLocation({});
    l.name=name.slice(0,60);l.icon=fv(f,"icon")||"📍";
    l.blocks=S.blocks.filter(b=>b.status==="active"&&fv(f,"lb_"+b.id)).map(b=>b.id);
    l.homeHide=HOME_PARTS.filter(([k])=>!fv(f,"lh_"+k)).map(([k])=>k);
    l.dayHide=DAY_PARTS.filter(([k])=>!fv(f,"ld_"+k)).map(([k])=>k);
    l.widgets=fv(f,"lw_own")?S.widgets.mine.filter(w=>fv(f,"lw_"+w)):null;
    l.muteOther=fv(f,"muteOther");l.tempo=fv(f,"tempo")||null;l.style=fv(f,"style")||null;
    if(!f.dataset.id)S.locations.push(l);
    return l;
  },l=>"Сохранено: "+l.icon+" "+l.name);
  if(ok)closeSheet();
};
ACT["loc-del"]=async el=>{
  const l=locById(el.dataset.id);
  const y=await ask({title:"Удалить «"+l.name+"»?",text:"Записи, привязанные к этой локации, станут видны везде (если у них нет других локаций). Правила графика с ней удалятся. Выполнения и история не меняются.",ok:"Удалить",danger:true});
  if(!y)return;
  tx(()=>{
    [...S.tasks,...S.habits,...S.quests,...S.cal].forEach(x=>{if(x.locs)x.locs=x.locs.filter(i=>i!==l.id)});
    S.blocks.forEach(b=>{if(b.loc===l.id)b.loc=null});
    S.loc.schedule=S.loc.schedule.filter(r=>r.locId!==l.id);
    if(S.loc.fallback===l.id)S.loc.fallback=null;
    if(S.loc.manual&&S.loc.manual.id===l.id)S.loc.manual=null;
    if(S.loc.lastSeen===l.id)S.loc.lastSeen=null;S.inbox.forEach(x=>{if(x.locs)x.locs=x.locs.filter(id=>id!==l.id)});
    S.locations=S.locations.filter(x=>x.id!==l.id);
  },"Локация удалена");
};

/* ---------- schedule rules ---------- */
ACT["rule-new"]=()=>{if(!S.locations.length){toast("Сначала создайте локацию");return}ruleEditor(null)};
ACT["rule-edit"]=el=>ruleEditor(S.loc.schedule.find(r=>r.id===el.dataset.id));
function ruleEditor(r){
  const isNew=!r;r=r||{id:"",locId:S.locations[0].id,days:[1,2,3,4,5],from:"09:00",to:"18:00"};
  openSheet(isNew?"Правило графика":"Изменить правило",'<form data-form="locrule" data-id="'+(isNew?"":r.id)+'">'+
    '<label class="f">Где</label><select name="locId">'+S.locations.map(l=>opt(l.id,l.icon+" "+l.name,r.locId)).join("")+'</select>'+
    '<label class="f">Дни</label><div class="days" data-ruledays>'+WD.map((l,i)=>'<button type="button" data-act="chipday" data-v="'+(i+1)+'" aria-pressed="'+r.days.includes(i+1)+'">'+l+'</button>').join("")+'</div>'+
    '<div class="row" style="margin-top:6px"><button type="button" class="btn ghost s" data-act="rule-preset" data-v="12345">Пн–Пт</button><button type="button" class="btn ghost s" data-act="rule-preset" data-v="67">Сб–Вс</button><button type="button" class="btn ghost s" data-act="rule-preset" data-v="1234567">Каждый день</button></div>'+
    '<div class="grid2"><div><label class="f">С</label><input type="time" name="from" value="'+r.from+'" required></div><div><label class="f">До</label><input type="time" name="to" value="'+r.to+'" required></div></div>'+
    '<p class="meta" style="margin-top:6px">Интервал через полночь тоже можно: например, 22:00–07:00. Если правила пересекаются, действует верхнее в списке.</p>'+
    '<div class="row" style="margin-top:12px"><button class="btn primary">Сохранить</button><button type="button" class="btn" data-act="sheet-close">Отмена</button></div></form>');
}
ACT["rule-preset"]=el=>{const set=el.dataset.v.split("").map(Number);el.closest("form").querySelectorAll("[data-ruledays] button").forEach(b=>b.setAttribute("aria-pressed",String(set.includes(+b.dataset.v))))};
FORMS.locrule=f=>{
  const ok=tx(()=>{
    const days=[...f.querySelectorAll("[data-ruledays] [aria-pressed=true]")].map(b=>+b.dataset.v).sort();
    if(!days.length)fail("Выберите хотя бы один день");
    const from=fv(f,"from"),to=fv(f,"to");
    if(!/^\d{2}:\d{2}$/.test(from)||!/^\d{2}:\d{2}$/.test(to))fail("Укажите время");
    if(from===to)fail("Начало и конец совпадают");
    const data={locId:fv(f,"locId"),days,from,to};
    const r=S.loc.schedule.find(x=>x.id===f.dataset.id);
    if(r)Object.assign(r,data);else S.loc.schedule.push(Object.assign({id:uid()},data));
    S.loc.manual=null;
  },"Правило сохранено");
  if(ok)closeSheet();
};
ACT["rule-del"]=el=>tx(()=>{S.loc.schedule=S.loc.schedule.filter(r=>r.id!==el.dataset.id);S.loc.manual=null},"Правило удалено");

/* ---------- "Где" field for editors and lists ---------- */
function locField(cur){
  if(!S.locations.length)return "";
  return '<label class="f">Где</label>'+chipsMulti("locs",S.locations.map(l=>[l.id,l.icon+" "+l.name]),cur||[])+'<div class="meta" style="margin-top:4px">Ничего не выбрано — видно в любой локации.</div>';
}
const readLocs=f=>multiVal(f,"locs").filter(id=>locById(id));
function locNames(ids){return ids&&ids.length?ids.map(id=>locName(locById(id))).join(", "):"где угодно"}

ACT["chipday"]=el=>el.setAttribute("aria-pressed",el.getAttribute("aria-pressed")!=="true");

/* ================= HOME, CONSTRUCTOR, SUMMARY ================= */
function lite(){return S.settings.lite}

/* ---------- home ---------- */
SCR.home=()=>{
  const x=xpTotal(),c=coins(),lv=level();
  const prog=x<=0?0:(x%1000)/10;
  const t=today();
  const plan=dayPlan(t);
  const doneN=plan.visible.filter(r=>isDoneRef(r,t)).length;
  const earnedToday=liveFacts().filter(f=>f.date===t).reduce((a,f)=>a+(f.ledger?f.coins:0),0);
  let h='<section class="hero" aria-label="Уровень и монеты"><div class="hero-top"><div class="lvl" aria-label="Уровень '+lv+'">'+lv+'</div>'+
    '<div class="grow"><div class="hero-l">Герой · уровень '+lv+'</div><div class="hero-xp">'+num(x)+' <small>XP</small></div></div>'+
    '<div class="hero-c"><div class="hero-l">Монеты</div><div class="hero-coins'+(c<0?' neg':'')+'">'+num(c)+'</div></div></div>'+
    '<div class="xpbar"><i style="width:'+prog+'%"></i></div>'+
    '<div class="hero-foot"><span>до ур. '+(lv+1)+': '+num(x<=0?1000-x:1000-(x%1000))+' XP</span><span>+'+earnedToday+' сегодня</span></div>'+
    (x<0||c<0?'<p class="small" style="margin:0">Отрицательный баланс возник из «Цены слова». Новые заработки погашают долг.</p>':'')+'</section>';
  h+=locBar();
  const L=curLocObj();const hideH=k=>!!(L&&L.homeHide.includes(k));
  if(S.settings.motivation&&!hideH("motivation"))h+='<div class="card flat" style="margin-top:8px"><div class="between"><span>'+esc(S.settings.motivation)+'</span><button class="btn ghost s" data-act="motivation">Изменить</button></div></div>';
  h+=onboardingCard()+backupPrompt();
  if(!hideH("invites"))h+=sessionInvites();
  h+='<div class="grid2" style="margin-top:10px"><button class="tile" data-act="tab" data-v="day"><b>Конструктор дня</b><span class="meta">Сделано '+doneN+' из '+plan.visible.length+' · +'+earnedToday+' монет</span></button>'+
    '<button class="tile" data-act="tab" data-v="map"><b>Стратегическое планирование</b><span class="meta">Карта жизни: '+activeBlocks().filter(blockVisible).length+' блоков</span></button></div>';
  if(!lite()&&!hideH("modes")){
    h+='<div class="grid2" style="margin-top:8px"><button class="tile" data-act="focus-open"><b>Режим фокуса</b><span class="meta">'+(S.focus.on?'Включён: '+S.focus.blocks.length+' '+plural(S.focus.blocks.length,"блок","блока","блоков"):'Выключен')+'</span></button>'+
      '<button class="tile" data-act="'+(S.creative.on?'creative-off':'creative-open')+'"><b>Творческий режим</b><span class="meta">'+(S.creative.on?'Пауза с '+short(S.creative.since):'Поставить систему на паузу')+'</span></button></div>';
  }
  const up=S.cal.filter(e=>available(e)&&!locHides(e,L)).flatMap(e=>Cal.range(e,t,addDays(t,3)).filter(o=>!calDone(e,o.key)).map(o=>({...e,date:o.date,time:o.time,_occ:o.key}))).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  if(!hideH("upcoming"))h+='<h2>Ближайшие календарные дела</h2>'+(up.length?'<div class="list">'+up.map(e=>'<button class="item link" data-act="open" data-k="cal" data-id="'+e.id+'" data-occ="'+(e._occ||e.date)+'"><div class="body"><div class="t">'+esc(e.title)+'</div><div class="meta">'+short(e.date)+(e.time?' '+e.time:'')+' · '+esc(originText(e))+'</div></div></button>').join("")+'</div>':'<div class="empty">На ближайшие три дня ничего нет.</div>');
  if(!lite()&&!hideH("decisions")){
    const ds=S.decisions.filter(d=>d.status==="active"&&d.deadline&&!(L?.blocks.length&&d.stageId&&!L.blocks.includes(get("stage",d.stageId)?.blockId))).sort((a,b)=>a.deadline.localeCompare(b.deadline)).slice(0,2);
    if(ds.length)h+='<h2>Принятые решения со сроком</h2><div class="list">'+ds.map(decisionMini).join("")+'</div>';
  }
  const missN=S.misses.filter(m=>m.status==="active").length;
  if(!hideH("grid"))h+='<h2>Разделы</h2><div class="grid3">'+
    [["tasks","Задания"],["habits","Привычки"],!lite()&&["quests","Квесты"],["calendar","Календарь"],["missed","Невыполненные"+(missN?" ("+missN+")":"")],!lite()&&["shop","Магазин бонусов"],!lite()&&["treats","Ништяки"],!lite()&&["decisions","Решения"],["history","История"]].filter(Boolean)
      .map(([s,l])=>'<button class="tile" data-act="go" data-s="'+s+'"><b>'+esc(l)+'</b></button>').join("")+'</div>';
  return h;
};
ACT["motivation"]=async()=>{
  const v=await ask({title:"Мотивация на главной",text:"Короткая фраза до 120 символов. Пустое поле убирает её.",input:"Например: я строю жизнь, которую выбрал",ok:"Сохранить"});
  if(v===false)return;tx(()=>{S.settings.motivation=String(v).slice(0,120)},"Сохранено");
};

/* ---------- constructor ---------- */
function refSortKey(r){const [k,id]=pr(r);const it=get(k,id);const b=blockOf(it);return (b?PRIO_N[b.priority]:3)+"-"+(it.title||"")}
function dayCard(r,d,opts){
  opts=opts||{};
  const [k,id]=pr(r);const it=get(k,id);if(!it)return"";
  const done=isDoneRef(r,d)&&(k!=="task"||it.sched.type!=="once"||doneOn("task",id,d)||!opts.strictDay);
  let prog="",check='<button class="check'+(done?' on':'')+'" data-act="toggle" data-r="'+r+'" aria-label="'+(done?'Снять отметку':'Отметить выполненным')+'">'+(done?IC.check:'')+'</button>';
  if(k==="quest"){
    const p=questProgress(it);
    prog='<span class="pill acc">'+p.done+'/'+p.total+'</span>';
    check='<button class="check sq'+(done?' on':'')+'" data-act="toggle" data-r="'+r+'" aria-label="'+(done?'Отменить последний шаг сегодня':'Сделать шаг квеста')+'">'+(done?IC.check:'+1')+'</button>';
  }
  if(k==="habit"&&habitDayTarget(it,d)>1){prog+='<span class="pill acc">'+habitDayProgress(it,d)+'/'+habitDayTarget(it,d)+' сегодня</span> ';if(!done)check='<button class="check sq" data-act="toggle" data-r="'+r+'" aria-label="Добавить подход">+1</button>'}
  if(k==="habit"&&it.goal&&it.goal.target)prog+='<span class="pill">'+habitCount(it,d)+'/'+it.goal.target+(it.goal.mode==="period"?(it.goal.period==="week"?" нед.":" мес."):"")+'</span>';
  const rw=k==="quest"?it.stepReward:it.reward;
  const sub=[originText(it)];if(it.locs?.length)sub.push(locNames(it.locs));
  if(k==="cal")sub.unshift((Cal.occurrence(it,calParts(id)[1]||calChosen(it))?.time||"без времени"));
  else sub.push(schedText(it.sched));
  return '<div class="item'+(done?' done':'')+(k==="task"&&it.key?' key':'')+'">'+check+
    '<button class="body link" data-act="open" data-k="'+k+'" data-id="'+id+'"'+(k==='cal'?' data-occ="'+(calParts(id)[1]||calChosen(it))+'"':'')+'><div class="t">'+esc(it.title)+' '+prog+'</div><div class="meta">'+esc(KIND_L[k])+' · '+esc(sub.filter(Boolean).join(" · "))+'</div>'+
    (it.ifThen&&!done?'<div class="ifthen">Если — то: '+esc(it.ifThen)+'</div>':'')+'</button>'+
    (rw?'<span class="rw">+'+rw+'</span>':'')+
    (k==="task"?'<button class="ib'+(it.key?' on':'')+'" data-act="key" data-id="'+id+'" title="Ключевое действие" aria-label="Ключевое действие">'+(it.key?IC.starOn:IC.star)+'</button>':'')+
    '<button class="ib" data-act="day-menu" data-r="'+r+'" aria-label="Ещё">'+IC.dots+'</button></div>';
}
SCR.day=p=>{
  const d=today();
  snapshotToday();
  const plan=dayPlan(d);
  const vis=plan.visible.slice().sort((a,b)=>refSortKey(a).localeCompare(refSortKey(b)));
  const by=k=>vis.filter(r=>r.startsWith(k+":"));
  const keys=by("task").filter(r=>get("task",pr(r)[1]).key);
  const tasks=by("task").filter(r=>!get("task",pr(r)[1]).key);
  const sec=(title,list,empty)=>'<h2>'+title+' <span class="count">'+list.filter(r=>isDoneRef(r,d)).length+'/'+list.length+'</span></h2>'+(list.length?'<div class="list">'+list.map(r=>dayCard(r,d)).join("")+'</div>':'<div class="empty">'+empty+'</div>');
  const L=plan.loc,hideD=k=>!!L?.dayHide.includes(k);
  let h='<h1>Конструктор дня</h1><p class="lead">'+esc(human(d))+'</p>'+locBar();
  h+='<label class="f">Темп сегодняшнего дня</label><div class="seg" role="group">'+TEMPO.map(([v,l])=>'<button data-act="tempo" data-v="'+v+'" aria-pressed="'+(plan.tempo===v)+'">'+l+'</button>').join("")+'</div>';
  const missN=S.misses.filter(m=>m.status==="active").length;
  if(missN)h+='<div class="row" style="margin-top:8px"><button class="btn s" data-act="go" data-s="missed">Невыполненные: '+missN+'</button></div>';
  if(plan.creative)h+='<div class="card flat" style="margin-top:10px">Творческий режим: задания, привычки и квесты сегодня на паузе и не становятся пропусками. Календарные дела остаются. Выполнить что-то всё равно можно через «Быстрое выполнение» или «Скрыто сегодня».</div>';
  if(!hideD("key"))h+=sec("Ключевые действия",keys,"Отметьте звёздочкой важные задания. Ключевое действие включает «В Конструктор» автоматически.");
  if(!hideD("cal"))h+=sec("Календарь",by("cal"),"На сегодня календарных дел нет.");
  if(!hideD("task"))h+=sec("Задания",tasks,"Заданий на сегодня нет.");
  if(!hideD("habit"))h+=sec("Привычки",by("habit"),"Привычек на сегодня нет.");
  if(!lite()&&!hideD("quest"))h+=sec("Квесты",by("quest"),"Квесты в день не добавлены.");
  if(plan.hidden.length){
    const open=!!S.ui.showHidden;
    h+='<h2>Скрыто сегодня <span class="count">'+plan.hidden.length+'</span></h2><div class="card"><div class="between"><span class="small muted">Скрытое темпом, фокусом или паузой не станет пропуском. Для локаций правило пропусков выбирается в настройках локаций; календарь сохраняет обязательства.</span><button class="btn s" data-act="toggle-hidden">'+(open?'Свернуть':'Показать список')+'</button></div>'+
      (open?plan.hidden.map(hh=>{const [k,id]=pr(hh.r);const it=get(k,id);return '<div class="mini"><div class="t">'+esc(it.title)+'<div class="meta">'+KIND_L[k]+' · '+esc(originText(it))+' · '+WHY_L[hh.why]+'</div></div><button class="btn s" data-act="force" data-r="'+hh.r+'">Показать сегодня</button></div>'}).join(""):'')+'</div>';
  }
  if(!lite()&&!hideD("widgets")){
    const ws=L?.widgets?L.widgets.filter(w=>S.widgets.mine.includes(w)):S.widgets.mine.filter(w=>S.widgets.inDay[w]);
    h+='<h2>Виджеты <span class="count">'+ws.length+'</span><button class="btn ghost s" data-act="go" data-s="widgets">Настроить</button></h2>'+(ws.length?'<div class="grid2">'+ws.map(widgetTile).join("")+'</div>':'<div class="empty">Добавьте виджеты из каталога.</div>');
  }
  const extra=liveFacts().filter(f=>f.date===d&&!vis.includes(rk(f.kind==="questStep"?"quest":f.kind,f.ref)));
  if(extra.length)h+='<h2>Выполнено вне плана</h2><div class="list">'+extra.map(factRow).join("")+'</div>';
  h+='<div class="row" style="margin-top:16px"><button class="btn primary" data-act="day-picker">+ Добавить в день</button><button class="btn" data-act="quick-done">Быстрое выполнение</button></div>';
  if(!hideD("evening"))h+='<div class="card" style="margin-top:16px"><div class="between"><div><b>Вечер</b><div class="meta">'+(S.days[d]&&S.days[d].ritual?'День завершён. Можно продолжать работать.':'Итоги дня и необязательный ритуал завершения.')+'</div></div><div class="row"><button class="btn s" data-act="go" data-s="summary">Итоги</button><button class="btn s primary" data-act="ritual">Завершить день</button></div></div></div>';
  return h;
};
ACT["tempo"]=el=>tx(()=>{dayRec(today()).tempo=el.dataset.v;dayRec(today()).tempoManual=true;snapshotToday()},"Темп дня: "+TEMPO_L[el.dataset.v]);
ACT["toggle-hidden"]=()=>{S.ui.showHidden=!S.ui.showHidden;render()};
ACT["force"]=el=>tx(()=>{const r=dayRec(today());if(!r.forced.includes(el.dataset.r))r.forced.push(el.dataset.r);r.removed=r.removed.filter(x=>x!==el.dataset.r)},"Показано только на сегодня. Настройки записи не изменены.");
ACT["toggle"]=el=>{
  const [k,id]=pr(el.dataset.r);const d=today();
  const it=get(k,id);
  if(k==="quest"&&it.type==="checklist"&&!doneOn("quest",id,d)){openItem("quest",id);return}
  if(isDoneRef(el.dataset.r,d)&&(k!=="quest")){
    tx(()=>{if(k==="task"&&it.sched.type==="once"){const f=factsOf("task",id).pop();undoFact(f.id)}else if(k==="cal"){const f=factsOf("cal",it.id).find(f=>(f.occurrence||it.date)===(calParts(id)[1]||calChosen(it)));undoFact(f.id)}else undoToday(k,id,d)},"Отметка снята, награда возвращена");
    return;
  }
  if(k==="quest"&&doneOn("quest",id,d)&&it.status!=="active"){tx(()=>undoToday("quest",id,d),"Последний шаг отменён");return}
  tx(()=>complete(k,id,d),f=>rewardMsg(f));
};
function rewardMsg(f){
  if(!f||!f.kind)return "Отмечено";
  if(f.kind==="habitStep"){const h=get("habit",f.ref);return "Прогресс: "+habitSteps(f.ref,f.date).length+" из "+habitDayTarget(h,f.date)+". Награда — за дневную норму";}
  let m=f.coins?"+"+f.coins+" монет и XP":"Отмечено";
  const extra=S.facts.find(x=>x.id===(f.final||f.goalFact));
  if(extra)m+=". "+(extra.kind==="questFinal"?"Квест завершён":"Цель привычки достигнута")+(extra.coins?": +"+extra.coins:"");
  const insts=[...(f.insts||[]),...(extra?extra.insts:[])];
  if(insts.length)m+=". Получен бонус: "+insts.map(i=>(get("inst",i)||{}).title).join(", ");
  return m;
}
ACT["key"]=el=>tx(()=>{
  const t=get("task",el.dataset.id);t.key=!t.key;
  if(t.key&&!t.inDay){t.inDay=true}
  return {on:t.key};
},result=>result.on?"Ключевое действие. «В Конструктор» включено":"Отметка ключевого снята");
ACT["day-menu"]=el=>{
  const r=el.dataset.r;const [k,id]=pr(r);const it=get(k,id);
  const fs=liveFacts().filter(f=>(f.kind===k||(k==="quest"&&f.kind==="questStep"))&&f.ref===id&&f.date===today());
  openSheet(it.title,'<p class="meta">'+KIND_L[k]+' · '+esc(originText(it))+'</p><div class="list" style="margin-top:8px">'+
    '<button class="btn block" data-act="day-remove" data-r="'+r+'">Убрать из сегодняшнего плана</button>'+
    '<button class="btn block" data-act="open" data-k="'+k+'" data-id="'+id+'">Открыть карточку</button>'+
    '<button class="btn block" data-act="edit" data-k="'+k+'" data-id="'+id+'">Изменить / перенести</button>'+
    (k!=="cal"?'<button class="btn block" data-act="timer-for" data-r="'+r+'">Запустить таймер для этого дела</button>':'')+
    (it.blockId?'<button class="btn block" data-act="go-block" data-id="'+it.blockId+'">Перейти в блок</button>':'')+
    (fs.length?'<button class="btn block danger" data-act="undo-fact" data-id="'+fs[fs.length-1].id+'">Отменить сегодняшнюю отметку</button>':'')+'</div>');
};
ACT["day-remove"]=el=>{closeAllSheets();tx(()=>{const r=dayRec(today());if(!r.removed.includes(el.dataset.r))r.removed.push(el.dataset.r);r.added=r.added.filter(x=>x!==el.dataset.r);r.forced=r.forced.filter(x=>x!==el.dataset.r)},"Убрано только из сегодняшнего плана. Пропуском не станет.")};
ACT["undo-fact"]=el=>{closeAllSheets();tx(()=>undoFact(el.dataset.id),"Отметка отменена, награда возвращена")};
ACT["go-block"]=el=>{closeAllSheets();NAV.tab="map";NAV.stack=[{s:"map",p:{}},{s:"block",p:{id:el.dataset.id}}];render();window.scrollTo(0,0)};
function factRow(f){
  const k=f.kind==="questStep"||f.kind==="questFinal"?"quest":f.kind==="habitGoal"?"habit":f.kind;
  return '<div class="item"><div class="body"><div class="t">'+esc(f.title||itemTitle(k,f.ref))+'</div><div class="meta">'+({task:"Задание",habit:"Привычка",habitStep:"Подход привычки",habitGoal:"Цель привычки",questStep:"Шаг квеста",questFinal:"Финал квеста",cal:"Календарь",stage:"Этап"}[f.kind]||"")+' · '+short(f.date)+'</div></div>'+(f.coins?'<span class="rw">+'+f.coins+'</span>':'')+
    (["task","habit","questStep","cal"].includes(f.kind)?'<button class="btn ghost s" data-act="undo-fact" data-id="'+f.id+'">Отменить</button>':'')+'</div>';
}

/* picker: add anything from any unfinished stage or section */
ACT["day-picker"]=()=>{openSheet("Добавить в день",pickerBody(""),{key:"picker"})};
function pickerBody(q){
  const d=today();const plan=dayPlan(d);const inPlan=new Set(plan.visible);
  const pool=[];
  S.tasks.forEach(t=>{if(t.status==="active"&&!(t.sched.type==="once"&&doneEver("task",t.id)))pool.push(["task",t])});
  S.habits.forEach(t=>{if(t.status==="active")pool.push(["habit",t])});
  if(!lite())S.quests.forEach(t=>{if(t.status==="active")pool.push(["quest",t])});
  S.cal.forEach(t=>{if(t.status==="active"&&Cal.due(t,d).some(o=>!calDone(t,o.key)))for(const o of Cal.due(t,d).filter(o=>!calDone(t,o.key)))pool.push(["cal",{...t,id:t.id+(Cal.repeats(t)?"@"+o.key:"")}])});
  const ql=q.toLowerCase();
  const list=pool.filter(([k,t])=>!inPlan.has(rk(k,t.id))&&(!q||(t.title+" "+(t.tags||[]).join(" ")).toLowerCase().includes(ql)));
  const groups={};
  list.forEach(([k,t])=>{const key=t.blockId||"_";(groups[key]=groups[key]||[]).push([k,t])});
  const order=[...activeBlocks().map(b=>b.id),"_"];
  return '<input type="search" placeholder="Поиск по названию и тегам" value="'+esc(q)+'" data-picker-q autocomplete="off">'+
    '<p class="meta" style="margin-top:6px">Можно взять дело из любого незавершённого этапа, в том числе будущего. Текущий этап менять не нужно.</p>'+
    (list.length?order.filter(k=>groups[k]).map(k=>{const b=get("block",k);return '<h2>'+(b?esc(b.icon+" "+b.name):"Самостоятельные")+'</h2><div class="card">'+groups[k].map(([kk,t])=>'<div class="mini"><div class="t">'+esc(t.title)+'<div class="meta">'+KIND_L[kk]+(t.stageId?' · '+esc((get("stage",t.stageId)||{}).name||""):"")+(kk!=="cal"?' · '+schedText(t.sched):"")+'</div></div><button class="btn s primary" data-act="pick" data-r="'+rk(kk,t.id)+'">Добавить</button></div>').join("")+'</div>'}).join(""):'<p class="empty" style="margin-top:10px">Нечего добавить: всё уже в плане.</p>');
}
document.addEventListener("input",e=>{
  if(e.target.matches("[data-picker-q]")){const v=e.target.value;refreshSheet("picker",()=>pickerBody(v));const i=topSheet().querySelector("[data-picker-q]");i.focus();i.setSelectionRange(v.length,v.length)}
});
ACT["pick"]=el=>{tx(()=>{const r=dayRec(today());const x=el.dataset.r;if(!r.added.includes(x))r.added.push(x);if(!r.forced.includes(x))r.forced.push(x);r.removed=r.removed.filter(y=>y!==x)},"Добавлено в сегодняшний план");const q=(topSheet().querySelector("[data-picker-q]")||{}).value||"";refreshSheet("picker",()=>pickerBody(q))};

/* ---------- summary & ritual ---------- */
function dayStats(d){
  const fs=liveFacts().filter(f=>f.date===d&&f.kind!=="habitStep");
  const earned=fs.reduce((a,f)=>a+(f.ledger?f.coins:0),0);
  const spent=-S.ledger.filter(l=>l.date===d&&l.type==="spend").reduce((a,l)=>a+l.coins,0)-S.ledger.filter(l=>l.date===d&&l.type==="refund").reduce((a,l)=>a+l.coins,0);
  const penalty=-S.ledger.filter(l=>l.date===d&&l.type==="penalty").reduce((a,l)=>a+l.coins,0);
  const minutes=S.timeLog.filter(t=>t.date===d).reduce((a,t)=>a+t.minutes,0);
  const by=k=>fs.filter(f=>f.kind===k).length;
  const plan=dayPlan(d);
  const keyDone=plan.visible.filter(r=>r.startsWith("task:")&&get("task",pr(r)[1]).key&&isDoneRef(r,d)).length;
  const places={};for(const f of fs){const name=f.locationTitle||(f.loc?locName(locById(f.loc)):"Без локации");places[name]=(places[name]||0)+1}const where=Object.entries(places).map(([name,n])=>name+": "+n).join(" · ");
  return {where,fs,earned,spent,penalty,minutes,approaches:liveFacts().filter(f=>f.kind==='habitStep'&&f.date===d).length,tasks:by("task"),habits:by("habit"),steps:by("questStep"),finals:by("questFinal"),cal:by("cal"),goals:by("habitGoal"),stages:by("stage"),goalsAchieved:S.goals.filter(g=>g.status==="achieved"&&g.closedAt===d).length,keyDone,planned:plan.visible.length,doneInPlan:plan.visible.filter(r=>isDoneRef(r,d)).length,misses:S.misses.filter(m=>m.date===d).length};
}
SCR.summary=p=>{
  const d=p.d||today();
  const st=dayStats(d);
  curScr().title="Итоги дня";
  let h='<h1>Итоги дня</h1><div class="row"><button class="btn s" data-act="go" data-s="summary" data-d="'+addDays(d,-1)+'">← '+short(addDays(d,-1))+'</button><b class="grow" style="text-align:center">'+esc(human(d))+'</b>'+(d<today()?'<button class="btn s" data-act="go" data-s="summary" data-d="'+addDays(d,1)+'">'+short(addDays(d,1))+' →</button>':'')+'</div>';
  h+='<div class="grid3" style="margin-top:12px">'+[["Выполнено в плане",st.doneInPlan+" / "+st.planned],["Заработано","+"+st.earned+" ● / XP"],["Потрачено",st.spent+" ●"]].map(([a,b])=>'<div class="card"><div class="meta">'+a+'</div><b>'+b+'</b></div>').join("")+'</div>';
  h+='<div class="card" style="margin-top:8px"><dl class="kv"><dt>Задания</dt><dd>'+st.tasks+'</dd><dt>Привычки</dt><dd>'+st.habits+(st.approaches?' · подходов: '+st.approaches:'')+(st.goals?' · достигнута цель: '+st.goals:'')+'</dd><dt>Шаги квестов</dt><dd>'+st.steps+(st.finals?' · завершено квестов: '+st.finals:'')+'</dd><dt>Календарь</dt><dd>'+st.cal+'</dd><dt>Ключевые</dt><dd>'+st.keyDone+'</dd><dt>Записанное время</dt><dd>'+st.minutes+' мин</dd>'+(st.where?'<dt>Где сделано</dt><dd>'+esc(st.where)+'</dd>':'')+'<dt>Пропуски дня</dt><dd>'+st.misses+'</dd>'+(st.penalty?'<dt>Цена слова</dt><dd>−'+st.penalty+' ●</dd>':'')+'</dl></div>';
  h+='<h2>Факты дня</h2>'+(st.fs.length?'<div class="list">'+st.fs.map(factRow).join("")+'</div>':'<div class="empty">Отметок нет.</div>');
  if(d===today())h+='<div class="row" style="margin-top:14px"><button class="btn primary" data-act="ritual">Завершить день</button>'+(S.settings.sessions.all&&S.settings.sessions.daily?'<button class="btn" data-act="go" data-s="session" data-level="daily">Ежедневная сессия</button>':'')+'</div>';
  return h;
};
const RITUAL={"none":["День без отметок — тоже день. Завтра можно начать с одного маленького шага.","Иногда день просто проживается. Ты всё равно здесь, и это уже движение.","Отдых и тишина тоже нужны. Возвращайся, когда будешь готов.","Сегодня можно было просто восстановить силы. Путь продолжается.","Отдых тоже помогает жить в выбранном темпе.","Не каждый день требует отметок. Завтра будет новый выбор.","Ты можешь оставить этот день спокойным.","Планы могут подождать, когда тебе нужен отдых.","Сегодняшняя пауза не отменяет уже пройденного.","Достаточно заметить, как ты себя чувствуешь.","У жизни есть место и за пределами списков.","Можно вернуться с небольшого шага, когда будешь готов.","Твой маршрут остаётся с тобой и в спокойные дни.","День без отметок тоже был частью твоей жизни.","Пусть сегодня хватит того, что уже произошло.","Ты выбираешь свой ритм. Система подождёт.","Пауза оставляет пространство для нового.","Сейчас можно никуда не торопиться.","Отложить необязательное бывает разумным решением.","Силы можно беречь для того, что действительно важно.","Сегодня достаточно спокойно закончить день.","Будущий шаг может быть совсем маленьким.","Твой прогресс больше одной даты в календаре."],"rest":["День отдыха прожит как день отдыха. Это тоже выполненный план.","Сегодня можно было просто восстановить силы. Путь продолжается.","Отдых тоже помогает жить в выбранном темпе.","Не каждый день требует отметок. Завтра будет новый выбор.","Ты можешь оставить этот день спокойным.","Планы могут подождать, когда тебе нужен отдых.","Сегодняшняя пауза не отменяет уже пройденного.","Достаточно заметить, как ты себя чувствуешь.","У жизни есть место и за пределами списков.","Можно вернуться с небольшого шага, когда будешь готов.","Твой маршрут остаётся с тобой и в спокойные дни.","День без отметок тоже был частью твоей жизни.","Пусть сегодня хватит того, что уже произошло.","Ты выбираешь свой ритм. Система подождёт.","Пауза оставляет пространство для нового.","Сейчас можно никуда не торопиться.","Отложить необязательное бывает разумным решением.","Силы можно беречь для того, что действительно важно.","Сегодня достаточно спокойно закончить день.","Будущий шаг может быть совсем маленьким.","Твой прогресс больше одной даты в календаре."],"one":["Один шаг сделан, и он настоящий. Засчитано.","Маленький шаг лучше большого плана на бумаге. Молодец.","Ты сделал то, что мог сегодня. Этого достаточно.","Сегодня у намерения появилось реальное действие.","Один сделанный шаг уже изменил этот день.","Можно заметить результат и остановиться на сегодня.","Небольшое действие помогает сохранять направление.","Ты нашёл место для своего дела.","Сегодня есть факт, на который можно опереться.","Движение складывается из таких обычных дней.","Сделанное осталось в твоей истории.","Не обязательно добавлять ещё, чтобы признать результат.","Начало уже стало частью пути.","У этой даты есть свой небольшой результат.","Ты попробовал — теперь знаешь чуть больше.","Следующий шаг можно выбрать завтра.","Сегодня получилось приблизить задуманное.","Усилие могло быть незаметным, но оно состоялось.","Можно поблагодарить себя за этот шаг.","Сегодняшнее действие не нужно сравнивать с чужими.","У тебя появился ещё один опыт движения.","Маленький результат тоже заслуживает внимания.","Путь получил продолжение сегодня."],"habit":["Привычка повторена. Повторение — это и есть путь.","Ещё одна отметка в копилку практики. Так навык и растёт.","Ты снова вернулся к выбранной практике.","Ещё одно повторение стало частью твоего опыта.","Регулярность складывается из возвращений.","Сегодня ты поддержал то, что хочешь развивать.","Практика продолжается в твоём темпе.","Повторение сегодня — вклад в знакомое действие.","Ты дал практике место в реальном дне.","Устойчивость может расти без спешки.","Сегодняшнее возвращение уже состоялось.","Можно заметить, что стало немного привычнее.","Каждая практика добавляет собственный опыт.","Твой счётчик хранит реальные повторения.","Сегодня удалось продолжить выбранное.","Знакомое действие снова получило внимание.","Пропущенные дни не отняли это повторение.","Ты поддержал важную для себя привычку.","У этой практики появился ещё один день.","Можно продолжать без требования идеальной серии.","Сегодня ты укреплял свой способ действовать.","Хорошо, что для практики нашлось место."],"key":["Главное дня сделано. Остальное — бонус.","Ключевое действие выполнено — день прожит с фокусом.","Сегодня у намерения появилось реальное действие.","Один сделанный шаг уже изменил этот день.","Можно заметить результат и остановиться на сегодня.","Небольшое действие помогает сохранять направление.","Ты нашёл место для своего дела.","Сегодня есть факт, на который можно опереться.","Движение складывается из таких обычных дней.","Сделанное осталось в твоей истории.","Не обязательно добавлять ещё, чтобы признать результат.","Начало уже стало частью пути.","У этой даты есть свой небольшой результат.","Ты попробовал — теперь знаешь чуть больше.","Следующий шаг можно выбрать завтра.","Сегодня получилось приблизить задуманное.","Усилие могло быть незаметным, но оно состоялось.","Можно поблагодарить себя за этот шаг.","Сегодняшнее действие не нужно сравнивать с чужими.","У тебя появился ещё один опыт движения.","Маленький результат тоже заслуживает внимания.","Путь получил продолжение сегодня."],"mid":["Хороший ровный день: {n} отметок и +{c} монет.","Уверенный день. {n} дел позади, +{c} в копилке.","Стабильный темп — лучший друг больших целей. {n} отметок сегодня.","Сегодня у намерения появилось реальное действие.","Один сделанный шаг уже изменил этот день.","Можно заметить результат и остановиться на сегодня.","Небольшое действие помогает сохранять направление.","Ты нашёл место для своего дела.","Сегодня есть факт, на который можно опереться.","Движение складывается из таких обычных дней.","Сделанное осталось в твоей истории.","Не обязательно добавлять ещё, чтобы признать результат.","Начало уже стало частью пути.","У этой даты есть свой небольшой результат.","Ты попробовал — теперь знаешь чуть больше.","Следующий шаг можно выбрать завтра.","Сегодня получилось приблизить задуманное.","Усилие могло быть незаметным, но оно состоялось.","Можно поблагодарить себя за этот шаг.","Сегодняшнее действие не нужно сравнивать с чужими.","У тебя появился ещё один опыт движения.","Маленький результат тоже заслуживает внимания.","Путь получил продолжение сегодня."],"rich":["Насыщенный день: {n} отметок! Не забудь отдохнуть.","Вот это темп: {n} дел и +{c} монет. Ты молодец.","Мощный день. Сохрани силы и на завтра.","Сегодня получилось многое. Можно закончить день.","Посмотри, сколько реальных действий осталось в истории.","Ты уделил внимание нескольким важным делам.","После насыщенного дня можно восстановить силы.","Сделанное уже сохранено; завтра можно выбрать новый объём.","Сегодня было движение в нескольких направлениях.","Можно признать усилия этого дня без нового списка.","У твоего дня получился насыщенный след.","Важно заметить и результат, и собственное состояние.","Завтрашний темп не обязан повторять сегодняшний.","Ты собрал немало небольших результатов.","Сегодня задуманное несколько раз стало действием.","Пусть у завершения дня будет спокойное место.","Можно отложить оставшееся и посмотреть на сделанное.","Твои действия сегодня были вполне реальными.","Насыщенный день тоже заслуживает мягкого окончания.","Ты поработал с тем, что выбрал для себя.","Теперь можно дать результатам немного времени.","Сделанного достаточно, чтобы заметить этот день.","Сегодня ты многое попробовал и продвинул."],"quest":["Квест завершён! Это большой кусок пути.","Финал квеста — отличный повод себя похвалить.","Сегодня ты прошёл заметный участок своего пути.","Завершённый результат теперь можно рассмотреть целиком.","У твоей стратегии появилось подтверждение действием.","Одна ступень стала частью истории.","Ты можешь выбрать, что взять с собой дальше.","Сегодняшний итог помогает увидеть следующий участок.","Накопленные шаги привели к этому результату.","Можно дать себе время порадоваться завершённому.","Появилась новая точка опоры для дальнейшего выбора.","Твой маршрут стал немного яснее через опыт.","Завершение оставляет место для продолжения.","Ты довёл выбранное до понятного результата.","Эта ступень больше не только в плане.","Можно сохранить, что помогло пройти этот участок.","Сегодняшний результат принадлежит твоим усилиям.","Ты собрал отдельные действия в общий итог.","Дальше можно двигаться с новым опытом.","Пройденное заслуживает спокойного внимания.","Твоя история стала на одну ступень богаче.","Сегодня есть завершение, на которое можно оглянуться."],"progress":["Сегодня ты прошёл заметный участок своего пути.","Завершённый результат теперь можно рассмотреть целиком.","У твоей стратегии появилось подтверждение действием.","Одна ступень стала частью истории.","Ты можешь выбрать, что взять с собой дальше.","Сегодняшний итог помогает увидеть следующий участок.","Накопленные шаги привели к этому результату.","Можно дать себе время порадоваться завершённому.","Появилась новая точка опоры для дальнейшего выбора.","Твой маршрут стал немного яснее через опыт.","Завершение оставляет место для продолжения.","Ты довёл выбранное до понятного результата.","Эта ступень больше не только в плане.","Можно сохранить, что помогло пройти этот участок.","Сегодняшний результат принадлежит твоим усилиям.","Ты собрал отдельные действия в общий итог.","Дальше можно двигаться с новым опытом.","Пройденное заслуживает спокойного внимания.","Твоя история стала на одну ступень богаче.","Сегодня есть завершение, на которое можно оглянуться."]};
function ritualMessage(st,d){
  const n=st.fs.length;let cat="none";
  if(st.finals)cat="quest";else if(st.stages||st.goalsAchieved)cat="progress";else if(n>=6)cat="rich";else if(n>=2)cat=st.keyDone?"key":"mid";else if(n===1)cat=st.habits?"habit":st.keyDone?"key":"one";else if(st.approaches)cat="habit";else if(dayTempo(d)==="rest")cat="rest";
  if(S.days[d]?.ritualText)return S.days[d].ritualText;
  const recent=new Set(Object.entries(S.days).filter(([day])=>day<d&&day>=addDays(d,-7)).map(([,v])=>v.ritualText));const choices=RITUAL[cat].filter(m=>!recent.has(m.replace("{n}",n).replace("{c}",st.earned)));const arr=choices.length?choices:RITUAL[cat],m=arr[(new Date(d).getDate()+n)%arr.length];
  return m.replace("{n}",n).replace("{c}",st.earned);
}
ACT["ritual"]=()=>{
  const d=today();const st=dayStats(d);
  const ok=tx(()=>{const record=dayRec(d);record.ritualText=ritualMessage(st,d);record.ritual=true});if(!ok)return;
  openSheet("Завершение дня",'<div class="ritual">✦</div><p style="text-align:center;font-size:17px">'+esc(ritualMessage(st,d))+'</p>'+
    '<div class="grid3" style="margin-top:14px"><div class="card"><div class="meta">Отметок</div><b>'+st.fs.length+'</b></div><div class="card"><div class="meta">Монет</div><b>+'+st.earned+'</b></div><div class="card"><div class="meta">Время</div><b>'+st.minutes+' мин</b></div></div>'+
    '<p class="meta" style="margin-top:10px;text-align:center">За ритуал ничего не начисляется. День остаётся открытым: можно отметить ещё что-то.</p>'+
    '<div class="row" style="justify-content:center;margin-top:10px"><button class="btn" data-act="sheet-close">Закрыть</button>'+(S.settings.sessions.all&&S.settings.sessions.daily?'<button class="btn primary" data-act="go" data-s="session" data-level="daily">Ответить на вопросы дня</button>':'')+'</div>');
};

/* ---------- economy ---------- */
SCR.economy=p=>{
  curScr().title="Монеты и опыт";
  const all=S.ledger.slice().sort((a,b)=>b.ts-a.ts);
  const n=p.all?all.length:10;
  const L={earn:"Заработок",spend:"Покупка",refund:"Возврат покупки",reversal:"Отмена отметки",penalty:"Цена слова",compensation:"Возврат Цены слова"};
  return '<h1>Монеты и опыт</h1><div class="grid3"><div class="card"><div class="meta">Монеты</div><b>'+num(coins())+'</b></div><div class="card"><div class="meta">Опыт</div><b>'+num(xpTotal())+' XP</b></div><div class="card"><div class="meta">Уровень</div><b>'+level()+'</b></div></div>'+
    '<p class="meta" style="margin-top:8px">Монеты тратятся в магазине. Опыт начисляется вместе с монетами один к одному и не тратится. Каждая тысяча опыта — новый уровень. В минус балансы может увести только «Цена слова».</p>'+
    '<h2>Операции</h2><div class="card">'+(all.length?all.slice(0,n).map(l=>'<div class="mini"><div class="t">'+esc(l.note||L[l.type])+'<div class="meta">'+L[l.type]+' · '+short(l.date)+'</div></div><span class="rw" style="color:'+(l.coins<0?'var(--bad)':'var(--coin)')+'">'+(l.coins>0?'+':'')+l.coins+' ●</span><span class="rw" style="color:var(--xp)">'+(l.xp>0?'+':'')+l.xp+' XP</span></div>').join(""):'<div class="empty">Операций пока нет.</div>')+
    (all.length>10&&!p.all?'<button class="btn ghost s" data-act="go" data-s="economy" data-all="1">Показать все ('+all.length+')</button>':'')+'</div>';
};
/* ================= MAP, BLOCKS, STAGES, GOALS, MODES ================= */
SCR.map=()=>{
  const bl=activeBlocks().filter(blockVisible);
  let h='<h1>Карта жизни</h1><p class="lead">Стратегическое планирование: направления жизни, их этапы и ориентиры.</p>';
  if(!lite())h+='<div class="row" style="margin:8px 0"><button class="btn s" data-act="focus-open">Режим фокуса'+(S.focus.on?' · вкл':'')+'</button>'+
    (S.settings.sessions.all?'<button class="btn s" data-act="go" data-s="sessions">Стратегические сессии</button>':'')+'</div>';
  h+='<div class="list">'+bl.map(b=>{
    const cur=get("stage",b.currentStageId);
    const st=blockStages(b.id);
    const passed=S.stages.filter(s=>s.blockId===b.id&&s.status==="done").length;
    const open=[...S.tasks,...S.habits,...S.quests].filter(x=>x.blockId===b.id&&x.status==="active").length;
    return '<button class="tile" data-act="go" data-s="block" data-id="'+b.id+'"><div class="between"><b style="font-size:15px">'+esc(b.icon+" "+b.name)+'</b><span class="row" style="gap:4px">'+(lite()?'':'<span class="pill">'+PRIO_L[b.priority]+'</span><span class="pill acc">'+INTENS_L[b.intensity]+'</span>')+'</span></div>'+
      '<span class="meta">'+(cur?'Текущий этап: '+esc(cur.name):'Текущий этап не выбран')+' · этапов: '+st.filter(s=>s.status==="open").length+(passed?' · пройдено: '+passed:'')+' · активных записей: '+open+'</span></button>';
  }).join("")+'</div>';
  if(S.focus.on){const hid=activeBlocks().length-bl.length;if(hid)h+='<p class="meta" style="margin-top:8px">Скрыто режимом фокуса: '+hid+' '+plural(hid,"блок","блока","блоков")+'.</p>'}
  h+='<div class="row" style="margin-top:12px"><button class="btn primary" data-act="block-new">+ Блок времени</button><button class="btn" data-act="go" data-s="archive" data-tab="blocks">Архив блоков</button></div>';
  return h;
};

/* ---------- block screen ---------- */
SCR.block=p=>{
  const b=get("block",p.id);if(!b)return '<div class="empty">Блок не найден.</div>';
  curScr().title=b.icon+" "+b.name;
  const view=p.view||S.ui["bview_"+b.id]||"current";
  let h='<h1>'+esc(b.icon+" "+b.name)+'</h1>';
  if(b.meaning)h+='<p class="lead">'+esc(b.meaning)+'</p>';
  if(!lite())h+='<div class="row" style="margin:6px 0 10px"><span class="pill">Приоритет: '+PRIO_L[b.priority]+'</span><span class="pill acc">Стратегия: '+INTENS_L[b.intensity]+'</span></div>';
  h+='<div class="seg" role="group">'+[["current","Текущий этап"],["all","Все этапы"],["settings","Настройки"]].map(([v,l])=>'<button data-act="bview" data-id="'+b.id+'" data-v="'+v+'" aria-pressed="'+(view===v)+'">'+l+'</button>').join("")+'</div>';
  if(view==="current"){
    const cur=get("stage",b.currentStageId);
    if(!b.secs.cur)h+='<p class="empty" style="margin-top:12px">Раздел «Текущий этап» скрыт в настройках блока. Его действия продолжают работать в своих разделах и в Конструкторе.</p>';
    else if(!cur)h+='<div class="card" style="margin-top:12px"><p>Текущий этап не выбран.</p><div class="row"><button class="btn primary s" data-act="stage-new" data-block="'+b.id+'">+ Создать этап</button><button class="btn s" data-act="bview" data-id="'+b.id+'" data-v="all">Все этапы</button></div></div>';
    else h+='<div style="margin-top:12px">'+stageCard(cur,true)+'</div>';
    if(b.secs.fact&&b.fact)h+='<h2>Фактический этап</h2><div class="card flat">'+esc(b.fact)+'</div>';
    return h;
  }
  if(view==="settings")return h+blockSettings(b);
  // all stages
  const sec=(k,title,body)=>b.secs[k]?'<h2>'+title+'</h2>'+body:"";
  const ach=S.achievements.filter(a=>a.blockId===b.id);
  const done=S.stages.filter(s=>s.blockId===b.id&&s.status==="done").sort((a,c)=>a.order-c.order);
  h+=sec("ach","Мои достижения",'<div class="card">'+
    (ach.length||done.length?ach.map(a=>'<div class="mini"><div class="t"><b>'+esc(a.title)+'</b>'+(a.period?' <span class="meta">· '+esc(a.period)+'</span>':'')+(a.text?'<div class="meta">'+esc(a.text)+'</div>':'')+'</div><button class="btn ghost s" data-act="ach-edit" data-id="'+a.id+'">Изменить</button></div>').join("")+
      done.map(s=>'<div class="mini"><div class="t"><b>'+esc(s.name)+'</b> <span class="pill good">пройден '+short(s.closedAt)+'</span></div><button class="btn ghost s" data-act="stage-open-toggle" data-id="'+s.id+'">'+(S.ui["so_"+s.id]?'Свернуть':'Открыть')+'</button><button class="btn ghost s" data-act="stage-reopen" data-id="'+s.id+'">Вернуть в работу</button></div>'+(S.ui["so_"+s.id]?stageBody(s):"")).join("")
      :'<div class="empty">История пути: прошлый опыт до приложения и пройденные этапы.</div>')+
    '<div style="margin-top:6px"><button class="btn s" data-act="ach-new" data-block="'+b.id+'">+ Запись в историю</button></div></div>');
  h+=sec("fact","Фактический этап",'<div class="card"><div class="between"><span>'+(b.fact?esc(b.fact):'<span class="muted">Где я сейчас? Честная отправная точка.</span>')+'</span><button class="btn ghost s" data-act="text-edit" data-id="'+b.id+'" data-f="fact">Изменить</button></div></div>');
  const st=blockStages(b.id).filter(s=>s.status==="open");
  const showSt=st.filter(s=>stageRole(s)==="current"?b.secs.cur:b.secs.plan);
  if(b.secs.cur||b.secs.plan){
    h+='<h2>Этапы <span class="count">'+st.length+'</span></h2><div class="list">'+(showSt.length?showSt.map(s=>stageCard(s,false)).join(""):'<div class="empty">Этапов пока нет.</div>')+'</div>';
    h+='<div style="margin-top:8px"><button class="btn s" data-act="stage-new" data-block="'+b.id+'">+ Этап в конец пути</button></div>';
  }
  h+=sec("opt","Оптимальный ориентир",'<div class="card"><div class="between"><span>'+(b.optimal?esc(b.optimal):'<span class="muted">Какое состояние будет для меня хорошим результатом?</span>')+'</span><button class="btn ghost s" data-act="text-edit" data-id="'+b.id+'" data-f="optimal">Изменить</button></div></div>');
  h+=sec("unk","Неизвестное",'<div class="card"><div class="between"><span>'+(b.unknown?esc(b.unknown):'<span class="muted">Будущее не нужно описывать целиком. Здесь можно оставить место для неожиданного.</span>')+'</span><button class="btn ghost s" data-act="text-edit" data-id="'+b.id+'" data-f="unknown">Изменить</button></div></div>');
  h+=sec("lvmg","LVMG — логически возможный максимум жизни",'<div class="card"><div class="between"><span>'+(b.lvmg?esc(b.lvmg):'<span class="muted">Самый дальний воображаемый горизонт, без обязательства расписывать шаги.</span>')+'</span><button class="btn ghost s" data-act="text-edit" data-id="'+b.id+'" data-f="lvmg">Изменить</button></div></div>');
  if(!lite()){
    const decs=S.decisions.filter(d=>d.status==="active"&&d.stageId&&(get("stage",d.stageId)||{}).blockId===b.id);
    h+=sec("dec","Принятые решения",decs.length?'<div class="list">'+decs.map(decisionMini).join("")+'</div>':'<div class="empty">Решений в этом блоке нет.</div>');
  }
  const ms=S.misses.filter(m=>m.status==="active"&&(get(m.kind,m.ref)||{}).blockId===b.id);
  h+=sec("missed","Невыполненные",ms.length?'<div class="card">'+ms.slice(0,10).map(m=>'<div class="mini"><div class="t">'+esc(m.title)+'<div class="meta">'+esc(KIND_L[m.kind]||m.kind)+' · '+short(m.date)+'</div></div></div>').join("")+'<button class="btn ghost s" data-act="go" data-s="missed">Все невыполненные</button></div>':'<div class="empty">Пропусков нет.</div>');
  const cal=S.cal.filter(c=>c.blockId===b.id&&c.status==="active"&&!!calNext(c)).sort((a,c)=>a.date.localeCompare(c.date));
  h+=sec("sched","Запланированное в календаре",cal.length?'<div class="card">'+cal.map(c=>'<div class="mini"><button class="t link" data-act="open" data-k="cal" data-id="'+c.id+'">'+esc(c.title)+'<div class="meta">'+short(calNext(c)?.date||c.date)+((calNext(c)?.time||c.time)?' '+(calNext(c)?.time||c.time):'')+'</div></button></div>').join("")+'</div>':'<div class="empty">Календарных дел блока нет.</div>');
  return h;
};
ACT["bview"]=el=>{S.ui["bview_"+el.dataset.id]=el.dataset.v;save();const c=curScr();c.p=Object.assign({},c.p,{view:el.dataset.v});render()};

function stageCard(s,expanded){
  const role=stageRole(s);
  const open=expanded||!!S.ui["so_"+s.id];
  const c=stageCounters(s.id);
  const cnt='<span class="cnt"><span class="pill">Незавершённые: '+c.open.task+' зад. · '+c.open.habit+' прив. · '+c.open.quest+' кв.</span><span class="pill">Завершённые: '+c.done.task+' · '+c.done.habit+' · '+c.done.quest+'</span><span class="pill acc">В Конструкторе: '+c.inDay+'</span></span>';
  let h='<div class="sect'+(role==="current"?' cur':'')+'">';
  h+=expanded?'<div class="sect-h"><span class="t">'+esc(s.name)+'</span><span class="pill acc">'+ROLE_L[role]+'</span></div>':
    '<button class="sect-h" data-act="stage-open-toggle" data-id="'+s.id+'" aria-expanded="'+open+'"><span class="t">'+esc(s.name)+cnt+'</span><span class="pill'+(role==="current"?' acc':'')+'">'+ROLE_L[role]+'</span></button>';
  if(open)h+=stageBody(s,expanded?cnt:null);
  return h+'</div>';
}
ACT["stage-open-toggle"]=el=>{S.ui["so_"+el.dataset.id]=!S.ui["so_"+el.dataset.id];save();render()};

function miniItem(k,it){
  const d=today(),o=k==='cal'?(Cal.due(it,d).find(x=>!calDone(it,x.key))||Cal.due(it,d)[0]||calNext(it)||calView(it)):null,r=o?calRef(it,o):rk(k,it.id);
  const fin=isFinished(k,it);
  let right="";
  if(!fin&&k!=="cal")right+='<button class="tg'+(it.inDay?' on':'')+'" data-act="inday" data-k="'+k+'" data-id="'+it.id+'" title="В Конструктор дня">'+(it.inDay?'в Конструкторе':'не в Конструкторе')+'</button>';
  if(k==="task"&&!fin)right+='<button class="ib'+(it.key?' on':'')+'" data-act="key" data-id="'+it.id+'" aria-label="Ключевое">'+(it.key?IC.starOn:IC.star)+'</button>';
  let extra="";
  if(k==="quest"){const p=questProgress(it);extra=' <span class="pill acc">'+p.done+'/'+p.total+'</span>'}
  if(k==="habit"&&it.goal.target)extra=' <span class="pill">'+habitCount(it,d)+'/'+it.goal.target+'</span>';
  const goal=it.goalId?get("goal",it.goalId):null;
  const doneT=k==="cal"?calDone(it,o?.key||it.date):k==="task"&&it.sched.type==="once"?doneEver("task",it.id):k==="quest"?false:doneOn(k,it.id,d);
  const chk=fin&&k!=="task"?'<span class="pill">'+(it.status==="completed"?"завершён":"закрыт")+'</span>':
    '<button class="check'+(k==="quest"?' sq':'')+(doneT?' on':'')+'" style="width:24px;height:24px" data-act="toggle" data-r="'+r+'" aria-label="Отметить">'+(doneT?IC.check:(k==="quest"?'+1':''))+'</button>';
  return '<div class="mini'+(fin?' done':'')+'">'+chk+'<button class="t link" data-act="open" data-k="'+k+'" data-id="'+it.id+'"'+(o?' data-occ="'+o.key+'"':'')+'>'+esc(it.title)+extra+
    '<div class="meta">'+(k==="cal"?short(o?.date||it.date)+(o?.time?' '+o.time:''):schedText(it.sched))+(goal?' · ведёт к цели «'+esc(goal.title)+'»':'')+(it.ifThen?' · если—то':'')+'</div></button>'+right+'</div>';
}
function stageBody(s,cnt){
  const it=itemsOfStage(s.id);
  const role=stageRole(s);
  const editable=s.status==="open";
  let h='<div class="sect-b">';
  if(cnt)h+=cnt;
  if(s.content)h+='<div>'+esc(s.content)+'</div>';
  if(s.meaning||s.reason)h+='<dl class="kv">'+(s.meaning?'<dt>Смысл</dt><dd>'+esc(s.meaning)+'</dd>':'')+(s.reason?'<dt>Причина</dt><dd>'+esc(s.reason)+'</dd>':'')+'</dl>';
  if((s.bonus||[]).length&&!lite())h+='<div class="meta">Награда за этап: '+s.bonus.map(o=>esc((get("offer",o)||{}).title||"")).join(", ")+' (в резерве)</div>';
  // goals
  h+='<div><b class="small">Цели этапа</b>'+(it.goals.length?it.goals.map(g=>'<div class="mini"><div class="t">'+esc(g.title)+' <span class="pill '+({active:"acc",achieved:"good",abandoned:""}[g.status])+'">'+({active:"активна",achieved:"достигнута",abandoned:"отказ"}[g.status])+'</span>'+
    (g.ifThen?'<div class="ifthen">Если — то: '+esc(g.ifThen)+'</div>':'')+
    '<div class="meta">Связанных действий: '+[...S.tasks,...S.habits,...S.quests].filter(x=>x.goalId===g.id).length+'</div></div>'+
    '<button class="ib" data-act="goal-menu" data-id="'+g.id+'" aria-label="Действия с целью">'+IC.dots+'</button></div>').join(""):'<div class="empty small">Целей пока нет.</div>')+'</div>';
  const list=(title,k,arr)=>'<div><b class="small">'+title+'</b>'+(arr.length?arr.map(x=>miniItem(k,x)).join(""):'<div class="empty small">Нет</div>')+'</div>';
  h+=list("Задания","task",it.tasks);
  h+=list("Привычки","habit",it.habits);
  if(!lite())h+=list("Квесты","quest",it.quests);
  h+=list("Календарь","cal",it.cal);
  if(!lite())h+='<div><b class="small">Принятые решения</b>'+(it.decisions.length?it.decisions.map(d=>'<div class="mini"><button class="t link" data-act="decision-open" data-id="'+d.id+'">'+esc(d.text)+' <span class="pill">'+DEC_L[d.status]+'</span></button></div>').join(""):'<div class="empty small">Нет</div>')+'</div>';
  if(editable){
    h+='<div class="row"><button class="btn s" data-act="goal-new" data-stage="'+s.id+'">+ Цель</button><button class="btn s" data-act="new" data-k="task" data-stage="'+s.id+'">+ Задание</button><button class="btn s" data-act="new" data-k="habit" data-stage="'+s.id+'">+ Привычка</button>'+
      (lite()?'':'<button class="btn s" data-act="new" data-k="quest" data-stage="'+s.id+'">+ Квест</button>')+'<button class="btn s" data-act="new" data-k="cal" data-stage="'+s.id+'">+ Календарь</button>'+(lite()?'':'<button class="btn s" data-act="decision-new" data-stage="'+s.id+'">+ Решение</button>')+'</div>';
    h+='<div class="hr"></div><div class="row">'+(role!=="current"?'<button class="btn s primary" data-act="stage-current" data-id="'+s.id+'">Сделать текущим</button>':'')+
      '<button class="btn s" data-act="stage-close" data-id="'+s.id+'" data-mode="done">Завершить этап</button>'+
      '<button class="btn s" data-act="stage-edit" data-id="'+s.id+'">Изменить</button>'+
      '<button class="btn s" data-act="stage-move" data-id="'+s.id+'" data-dir="-1" aria-label="Выше">↑</button><button class="btn s" data-act="stage-move" data-id="'+s.id+'" data-dir="1" aria-label="Ниже">↓</button>'+
      '<button class="btn s" data-act="stage-new" data-block="'+s.blockId+'" data-before="'+s.id+'">Вставить до</button><button class="btn s" data-act="stage-new" data-block="'+s.blockId+'" data-after="'+s.id+'">Вставить после</button>'+
      (role!=="current"?'<button class="btn s danger" data-act="stage-close" data-id="'+s.id+'" data-mode="archive">В архив</button>':'')+'</div>';
  }
  return h+'</div>';
}

/* ---------- stage operations ---------- */
ACT["stage-current"]=el=>tx(()=>{const s=get("stage",el.dataset.id);get("block",s.blockId).currentStageId=s.id},"Этап стал текущим. Прежний остался незавершённым на своём месте.");
ACT["stage-move"]=el=>tx(()=>{
  const s=get("stage",el.dataset.id);const list=blockStages(s.blockId).filter(x=>x.status!=="archived");
  const i=list.indexOf(s),j=i+(+el.dataset.dir);if(j<0||j>=list.length)return false;
  const o=s.order;s.order=list[j].order;list[j].order=o;
});
function normalizeOrder(bid){S.stages.filter(s=>s.blockId===bid).sort((a,b)=>a.order-b.order).forEach((s,i)=>s.order=i+1)}
ACT["stage-new"]=el=>stageEditor(null,el.dataset.block,{before:el.dataset.before,after:el.dataset.after});
ACT["stage-edit"]=el=>{const s=get("stage",el.dataset.id);stageEditor(s,s.blockId)};
function stageEditor(s,bid,pos){
  const isNew=!s;s=s||{name:"",content:"",meaning:"",reason:"",bonus:[]};
  openSheet(isNew?"Новый этап":"Этап",'<form data-form="stage" data-id="'+(s.id||"")+'" data-block="'+bid+'" data-before="'+((pos&&pos.before)||"")+'" data-after="'+((pos&&pos.after)||"")+'">'+
    '<label class="f">Название</label><input type="text" name="name" value="'+esc(s.name)+'" required>'+
    '<label class="f">Содержание: что это за ступень</label><textarea name="content">'+esc(s.content)+'</textarea>'+
    '<label class="f">Смысл: зачем мне этот этап</label><textarea name="meaning">'+esc(s.meaning)+'</textarea>'+
    '<label class="f">Причина: что подтолкнуло действовать</label><textarea name="reason">'+esc(s.reason)+'</textarea>'+
    (lite()?'':bonusField(s.bonus||[],"Награда за завершение этапа"))+
    '<div class="row" style="margin-top:14px"><button class="btn primary">Сохранить</button><button type="button" class="btn" data-act="sheet-close">Отмена</button></div></form>');
}
FORMS.stage=f=>{
  const ok=tx(()=>{
    const data={name:fv(f,"name"),content:fv(f,"content"),meaning:fv(f,"meaning"),reason:fv(f,"reason")};
    if(!data.name)fail("Введите название");
    let s=get("stage",f.dataset.id);
    if(s)Object.assign(s,data);
    else{
      const bid=f.dataset.block;const list=blockStages(bid);
      let order=(list.length?Math.max(...list.map(x=>x.order)):0)+1;
      if(f.dataset.before)order=get("stage",f.dataset.before).order-0.5;
      if(f.dataset.after)order=get("stage",f.dataset.after).order+0.5;
      s={id:uid(),blockId:bid,order,status:"open",bonus:[],created:today(),...data};
      S.stages.push(s);normalizeOrder(bid);
      const b=get("block",bid);if(!b.currentStageId)b.currentStageId=s.id;
      S.ui["so_"+s.id]=true;
    }
    if(f.querySelector('[name="bonus"]'))setBonusAssign("stage",s.id,bonusVal(f));
  },"Этап сохранён");
  if(ok)closeSheet();
};

/* close / archive with fate of each activity */
ACT["stage-close"]=el=>{
  const s=get("stage",el.dataset.id);const mode=el.dataset.mode;
  const b=get("block",s.blockId);
  if(mode==="archive"&&b.currentStageId===s.id){toast("Сначала назначьте текущим другой этап");return}
  const it=itemsOfStage(s.id);
  const acts=[...it.tasks.filter(x=>!isFinished("task",x)).map(x=>["task",x]),...it.habits.filter(x=>x.status==="active").map(x=>["habit",x]),...it.quests.filter(x=>x.status==="active").map(x=>["quest",x]),...it.cal.filter(x=>x.status==="active"&&(Cal.repeats(x)||!doneEver("cal",x.id))).map(x=>["cal",x])];
  const others=blockStages(s.blockId).filter(x=>x.status==="open"&&x.id!==s.id);
  const next=others.find(x=>x.order>s.order)||others[0];
  const sel=(k,x)=>'<select name="fate_'+k+'_'+x.id+'">'+others.map(o=>opt("move:"+o.id,"Перенести в «"+o.name+"»",next&&o.id===next.id?"move:"+o.id:"")).join("")+opt("free","Оставить самостоятельной",next?"":"free")+opt("close","Завершить, сохранив историю","")+'</select>';
  openSheet(mode==="done"?"Завершить этап":"Этап в архив",'<form data-form="stage-close" data-id="'+s.id+'" data-mode="'+mode+'">'+
    '<p>«'+esc(s.name)+'». '+(mode==="done"?'Завершение подтверждаете вы. Выполнение дел само этап не закрывает.':'Этап уйдёт в архив блока. Его можно будет восстановить или удалить окончательно.')+'</p>'+
    (acts.length?'<label class="f">Судьба незавершённых активностей ('+acts.length+')</label>'+acts.map(([k,x])=>'<div class="card" style="margin-top:6px;padding:8px 10px"><div class="small"><b>'+esc(x.title)+'</b> · '+KIND_L[k]+'</div>'+sel(k,x)+'</div>').join(""):'<p class="meta">Незавершённых активностей нет.</p>')+
    (mode==="done"&&(s.bonus||[]).length?'<p class="meta">Будет выдана награда: '+s.bonus.map(o=>esc((get("offer",o)||{}).title||"")).join(", ")+'</p>':'')+
    '<p class="meta">Принятые решения и цели остаются в этапе. Завершённое не будет считаться выполненным и не принесёт наград.</p>'+
    '<div class="row" style="margin-top:12px"><button class="btn primary">'+(mode==="done"?'Завершить этап':'В архив')+'</button><button type="button" class="btn" data-act="sheet-close">Отмена</button></div></form>');
};
FORMS["stage-close"]=f=>{
  const ok=tx(()=>{
    const s=get("stage",f.dataset.id);const mode=f.dataset.mode;const b=get("block",s.blockId);
    $$("select",f).forEach(sel=>{
      const rest=sel.name.slice(5),split=rest.indexOf("_"),k=rest.slice(0,split),id=rest.slice(split+1);const x=get(k,id);if(!x)return;
      const v=sel.value;
      if(v.startsWith("move:")){const ns=get("stage",v.slice(5));x.stageId=ns.id;x.blockId=ns.blockId;if(x.goalId&&(get("goal",x.goalId)||{}).stageId!==ns.id)x.goalId=null}
      else if(v==="free"){x.stageId=null;x.blockId=null;x.goalId=null}
      else{x.status="closed";x.closedAt=today()}
    });
    if(mode==="done"){
      s.status="done";s.closedAt=today();
      const f2=addFact("stage",s.id,today(),0,{title:"Этап пройден: "+s.name});
      const a=award("stage",s.id,today());f2.insts=a.insts;f2.consumed=a.consumed;
    }else{s.status="archived";s.closedAt=today()}
    if(b.currentStageId===s.id){const nx=blockStages(b.id).find(x=>x.status==="open"&&x.order>s.order)||blockStages(b.id).find(x=>x.status==="open");b.currentStageId=nx?nx.id:null}
    return mode;
  },m=>m==="done"?"Этап завершён и перенесён в «Мои достижения»":"Этап в архиве");
  if(ok)closeAllSheets();
};
ACT["stage-reopen"]=async el=>{
  const s=get("stage",el.dataset.id);
  const yes=await ask({title:"Вернуть этап в работу?",text:"Этап вернётся на своё место. Текущий этап не изменится, перенесённые действия не вернутся назад. Если за этап был выдан бонус и он не использован, бонус вернётся в резерв.",ok:"Вернуть"});
  if(!yes)return;
  tx(()=>{
    const f=S.facts.find(x=>!x.cancelled&&x.kind==="stage"&&x.ref===s.id);
    if(f){revokeInsts(f,"stage",s.id);f.cancelled=true}
    s.status="open";delete s.closedAt;
  },"Этап снова в работе");
};

/* ---------- goals ---------- */
ACT["goal-new"]=el=>goalEditor(null,el.dataset.stage);
function goalEditor(g,sid){
  const isNew=!g;g=g||{title:"",ifThen:""};
  openSheet(isNew?"Новая цель этапа":"Цель",'<form data-form="goal" data-id="'+(g.id||"")+'" data-stage="'+(sid||g.stageId)+'">'+
    '<label class="f">Желаемый результат</label><input type="text" name="title" value="'+esc(g.title)+'" required placeholder="Например: уверенно меняю Am → Em → C">'+
    '<label class="f">Если — то (необязательно)</label><input type="text" name="ifThen" value="'+esc(g.ifThen)+'" placeholder="Если устал вечером, то сыграю 5 минут после ужина">'+
    '<div class="row" style="margin-top:14px"><button class="btn primary">Сохранить</button><button type="button" class="btn" data-act="sheet-close">Отмена</button></div></form>');
}
FORMS.goal=f=>{
  const isNew=!f.dataset.id;
  const ok=tx(()=>{const t=fv(f,"title");if(!t)fail("Введите цель");
    let g=get("goal",f.dataset.id);
    if(g){g.title=t;g.ifThen=fv(f,"ifThen")}else{if(get("stage",f.dataset.stage)?.status!=="open")fail("Выберите открытый этап");g={id:uid(),stageId:f.dataset.stage,title:t,ifThen:fv(f,"ifThen"),status:"active",created:today()};S.goals.push(g)}return g},"Цель сохранена");
  if(ok){closeSheet();if(isNew)firstGoalStep(ok)}
};
ACT["goal-menu"]=el=>{
  const g=get("goal",el.dataset.id);
  const linked=[...S.tasks.map(x=>["task",x]),...S.habits.map(x=>["habit",x]),...S.quests.map(x=>["quest",x])].filter(([,x])=>x.goalId===g.id);
  openSheet(g.title,'<p class="meta">Достижение цели и отказ от неё подтверждает человек. Выполнение связанных действий цель не закрывает.</p>'+
    (linked.length?'<p class="small">Связанные действия: '+linked.map(([k,x])=>esc(x.title)).join(", ")+'</p>':'')+
    '<div class="list" style="margin-top:8px">'+
    (g.status==="active"?'<button class="btn block primary" data-act="goal-set" data-id="'+g.id+'" data-v="achieved">Цель достигнута</button><button class="btn block" data-act="goal-set" data-id="'+g.id+'" data-v="abandoned">Отказаться от цели</button>':'<button class="btn block" data-act="goal-set" data-id="'+g.id+'" data-v="active">Вернуть в активные</button>')+
    '<button class="btn block" data-act="goal-edit" data-id="'+g.id+'">Изменить</button></div>');
};
ACT["goal-edit"]=el=>{closeSheet();goalEditor(get("goal",el.dataset.id))};
ACT["goal-set"]=async el=>{
  const g=get("goal",el.dataset.id);const v=el.dataset.v;
  if(v==="abandoned"){const y=await ask({title:"Отказаться от цели?",text:"Это осознанное решение, без штрафа. Цель уйдёт в историю этапа со статусом «отказ». Связанные действия продолжат существовать, их связь с целью сохранится как история.",ok:"Отказаться"});if(!y)return}
  closeAllSheets();
  tx(()=>{g.status=v;g.closedAt=v==="active"?null:today()},{achieved:"Цель отмечена достигнутой",abandoned:"Вы отказались от цели. История сохранена",active:"Цель снова активна"}[v]);
};

/* ---------- achievements & texts ---------- */
ACT["ach-new"]=el=>achEditor(null,el.dataset.block);
ACT["ach-edit"]=el=>{const a=S.achievements.find(x=>x.id===el.dataset.id);achEditor(a,a.blockId)};
function achEditor(a,bid){
  const isNew=!a;a=a||{title:"",text:"",period:""};
  openSheet(isNew?"Запись в историю":"Запись истории",'<form data-form="ach" data-id="'+(a.id||"")+'" data-block="'+bid+'"><label class="f">Что было</label><input type="text" name="title" value="'+esc(a.title)+'" required placeholder="Например: месяц занимался гитарой пять лет назад">'+
    '<label class="f">Когда (свободно)</label><input type="text" name="period" value="'+esc(a.period)+'" placeholder="2021, весна"><label class="f">Подробнее</label><textarea name="text">'+esc(a.text)+'</textarea>'+
    '<p class="meta">Историческая запись не даёт наград.</p><div class="row" style="margin-top:12px"><button class="btn primary">Сохранить</button>'+(isNew?'':'<button type="button" class="btn danger" data-act="ach-del" data-id="'+a.id+'">Удалить</button>')+'</div></form>');
}
FORMS.ach=f=>{const ok=tx(()=>{const t=fv(f,"title");if(!t)fail("Введите запись");const a=S.achievements.find(x=>x.id===f.dataset.id);const data={title:t,period:fv(f,"period"),text:fv(f,"text")};if(a)Object.assign(a,data);else S.achievements.push({id:uid(),blockId:f.dataset.block,...data})},"Сохранено");if(ok)closeSheet()};
ACT["ach-del"]=async el=>{if(await ask({title:"Удалить запись истории?",ok:"Удалить",danger:true})){closeAllSheets();tx(()=>{S.achievements=S.achievements.filter(x=>x.id!==el.dataset.id)},"Удалено")}};
const TEXT_L={fact:"Фактический этап",optimal:"Оптимальный ориентир",unknown:"Неизвестное",lvmg:"LVMG"};
ACT["text-edit"]=el=>{
  const b=get("block",el.dataset.id),k=el.dataset.f;
  openSheet(TEXT_L[k],'<form data-form="block-text" data-id="'+b.id+'" data-f="'+k+'"><textarea name="v" style="min-height:120px">'+esc(b[k])+'</textarea><div class="row" style="margin-top:12px"><button class="btn primary">Сохранить</button></div></form>');
};
FORMS["block-text"]=f=>{if(tx(()=>{get("block",f.dataset.id)[f.dataset.f]=fv(f,"v")},"Сохранено"))closeSheet()};

/* ---------- block create / settings ---------- */
function blockSettings(b){
  const arch=S.stages.filter(s=>s.blockId===b.id&&s.status==="archived");
  return '<form data-form="block" data-id="'+b.id+'" style="margin-top:10px">'+blockFields(b)+
    '<div class="row" style="margin-top:14px"><button class="btn primary">Сохранить настройки</button></div></form>'+
    '<h2>Архив этапов <span class="count">'+arch.length+'</span></h2>'+(arch.length?'<div class="card">'+arch.map(s=>'<div class="mini"><div class="t">'+esc(s.name)+'</div><button class="btn s" data-act="stage-restore" data-id="'+s.id+'">Восстановить</button><button class="btn s danger" data-act="stage-delete" data-id="'+s.id+'">Удалить</button></div>').join("")+'</div>':'<div class="empty">Пусто.</div>')+
    '<div class="row" style="margin-top:16px"><button class="btn danger" data-act="block-archive" data-id="'+b.id+'">Убрать блок в архив</button></div>';
}
function blockFields(b){
  return '<label class="f">Название</label><input type="text" name="name" value="'+esc(b.name)+'" required>'+
    '<label class="f">Значок</label><div class="chips">'+ICONS.map(i=>'<button type="button" class="chip" data-act="icon-pick" data-v="'+i+'" aria-pressed="'+(b.icon===i)+'">'+i+'</button>').join("")+'</div><input type="hidden" name="icon" value="'+esc(b.icon)+'">'+
    '<label class="f">Зачем мне это направление, что хочу изменить</label><textarea name="meaning">'+esc(b.meaning)+'</textarea>'+
    (lite()?'':'<div class="grid2"><div><label class="f">Приоритет блока</label><select name="priority">'+PRIO.map(([v,l])=>opt(v,l,b.priority)).join("")+'</select></div><div><label class="f">Интенсивность стратегии</label><select name="intensity">'+INTENS.map(([v,l])=>opt(v,l,b.intensity)).join("")+'</select></div></div>')+
    '<label class="f">Локация новых записей блока</label><select name="bloc">'+opt("","Без локации",b.loc||"")+S.locations.map(l=>opt(l.id,l.icon+" "+l.name,b.loc||"")).join("")+'</select>'+
    '<label class="f">Состав стратегии</label>'+segBtns("preset",[["full","Полная"],["simple","Упрощённая"],["custom","Свой набор"]],b.preset||"custom")+
    '<div data-secs class="card flat" style="margin-top:6px">'+SECTIONS.map(([k,l])=>'<label class="tog" style="margin-top:4px"><input type="checkbox" name="sec_'+k+'" '+(b.secs[k]?'checked':'')+'><span>'+l+'</span></label>').join("")+
    '<p class="meta" style="margin-top:6px">Выключенная галочка только скрывает раздел внутри блока. Данные, история и связи сохраняются; задания, привычки и квесты продолжают жить в своих разделах и попадать в день.</p></div>';
}
ACT["icon-pick"]=el=>{const g=el.parentNode;g.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b===el));g.nextElementSibling.value=el.dataset.v};
document.addEventListener("change",e=>{
  if(e.target.name==="preset"){const f=e.target.form;const p=PRESETS[e.target.value];if(p)SECTIONS.forEach(([k])=>{f.querySelector('[name="sec_'+k+'"]').checked=p.secs.includes(k)})}
  if(e.target.name&&e.target.name.startsWith("sec_")){const f=e.target.form;const on=SECTIONS.map(([k])=>k).filter(k=>f.querySelector('[name="sec_'+k+'"]').checked);
    const pv=Object.entries(PRESETS).find(([,p])=>p.secs.length===on.length&&p.secs.every(k=>on.includes(k)));const v=pv?pv[0]:"custom";
    const g=f.querySelector('[data-seg="preset"]');g.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===v));f.querySelector('[name="preset"]').value=v}
});
ACT["block-new"]=()=>{
  const b={name:"",icon:"⭐",meaning:"",priority:"mid",intensity:"bal",secs:secsFrom(PRESETS.simple.secs),preset:"simple"};
  openSheet("Новый блок времени",'<form data-form="block">'+blockFields(b)+'<div class="row" style="margin-top:14px"><button class="btn primary">Создать блок</button></div></form>');
};
FORMS.block=f=>{
  const ok=tx(()=>{
    const name=fv(f,"name");if(!name)fail("Введите название");
    const data={name,icon:fv(f,"icon")||"⭐",loc:fv(f,"bloc")||null,meaning:fv(f,"meaning"),preset:fv(f,"preset"),secs:Object.fromEntries(SECTIONS.map(([k])=>[k,fv(f,"sec_"+k)]))};
    if(!lite()){data.priority=fv(f,"priority");data.intensity=fv(f,"intensity")}
    let b=get("block",f.dataset.id);
    if(b)Object.assign(b,data);
    else{b=Object.assign({id:uid(),priority:"mid",intensity:"bal",base:false,status:"active",order:S.blocks.length,currentStageId:null,fact:"",optimal:"",unknown:"",lvmg:""},data);S.blocks.push(b);pushRecent("block",b.id)}
    return b.id;
  },"Блок сохранён");
  if(ok){closeSheet();if(!f.dataset.id)go("block",{id:ok,view:"all"})}
};
ACT["block-archive"]=async el=>{
  const y=await ask({title:"Убрать блок в архив?",text:"Блок скроется с карты. Его этапы, история и действия сохранятся; задания, привычки и квесты останутся в своих разделах. Блок можно восстановить из архива.",ok:"В архив"});
  if(!y)return;tx(()=>{const b=get("block",el.dataset.id);b.status="archived";S.focus.blocks=S.focus.blocks.filter(x=>x!==b.id)},"Блок в архиве");goTab("map");
};
ACT["stage-restore"]=el=>tx(()=>{const s=get("stage",el.dataset.id);s.status="open";delete s.closedAt},"Этап восстановлен на своё место");
ACT["stage-delete"]=async el=>{
  const s=get("stage",el.dataset.id);
  const y=await ask({title:"Удалить этап навсегда?",text:"Этап и его цели будут удалены. Факты выполнений и денежная история сохранятся. Принятые решения этапа вернутся во «Входящие».",ok:"Удалить",danger:true});
  if(!y)return;
  tx(()=>{
    S.goals.filter(g=>g.stageId===s.id).forEach(g=>[...S.tasks,...S.habits,...S.quests].forEach(x=>{if(x.goalId===g.id)x.goalId=null}));
    S.goals=S.goals.filter(g=>g.stageId!==s.id);
    [...S.tasks,...S.habits,...S.quests,...S.cal].forEach(x=>{if(x.stageId===s.id)x.stageId=null});
    S.decisions.forEach(d=>{if(d.stageId===s.id)d.stageId=null});
    S.insts=S.insts.filter(i=>!(i.status==="reserved"&&i.cond&&i.cond.k==="stage"&&i.cond.id===s.id));
    S.stages=S.stages.filter(x=>x.id!==s.id);
  },"Этап удалён");
};

/* ---------- focus mode ---------- */
ACT["focus-open"]=()=>{
  const f=S.focus;
  const sel=f.on?f.blocks:[];
  openSheet("Режим фокуса",'<form data-form="focus"><p class="meta">Выберите направления, на которых сосредоточиться. Остальные блоки и их действия временно скроются из рабочих экранов. Ничего не архивируется и не удаляется.</p>'+
    S.blocks.filter(b=>b.status==="active").map(b=>'<label class="tog"><input type="checkbox" name="fb_'+b.id+'" '+(sel.includes(b.id)?'checked':'')+'><span>'+esc(b.icon+" "+b.name)+'</span></label>').join("")+
    '<h2>Календарь</h2><label class="tog"><input type="checkbox" name="calOther" '+(f.calOther?'checked':'')+'><span>Показывать календарные дела других блоков<small>Сейчас таких дел впереди: '+S.cal.filter(c=>c.status==="active"&&c.blockId&&!!calNext(c)).length+'</small></span></label>'+
    '<label class="tog"><input type="checkbox" name="calUnlinked" '+(f.calUnlinked?'checked':'')+'><span>Показывать календарные дела без привязки к стратегии<small>Сейчас таких дел впереди: '+S.cal.filter(c=>c.status==="active"&&!c.blockId&&!!calNext(c)).length+'</small></span></label>'+
    '<p class="meta">Сам календарь остаётся полным, напоминания не отключаются. Задания, привычки и квесты без блока остаются видимыми.</p>'+
    '<div class="row" style="margin-top:12px"><button class="btn primary">'+(f.on?'Сохранить':'Включить фокус')+'</button>'+(f.on?'<button type="button" class="btn" data-act="focus-off">Выключить режим</button>':'')+'</div></form>');
};
FORMS.focus=f=>{
  const sel=S.blocks.filter(b=>fv(f,"fb_"+b.id)).map(b=>b.id);
  if(!sel.length){toast("Выберите хотя бы один блок");return}
  if(tx(()=>{S.focus={on:true,blocks:sel,calOther:fv(f,"calOther"),calUnlinked:fv(f,"calUnlinked")};snapshotToday()},"Режим фокуса включён"))closeSheet();
};
ACT["focus-off"]=()=>{closeAllSheets();tx(()=>{S.focus.on=false;snapshotToday()},"Режим фокуса выключен")};

/* ---------- creative mode ---------- */
ACT["creative-open"]=()=>{
  const up=S.cal.filter(c=>available(c)).flatMap(c=>Cal.range(c,today(),addDays(today(),14)).filter(o=>!calDone(c,o.key)).map(o=>({...c,date:o.date,time:o.time}))).sort((a,b)=>a.date.localeCompare(b.date));
  openSheet("Творческий режим",'<form data-form="creative"><p>Система встаёт на паузу: задания, привычки и квесты не требуют выполнения и не становятся пропусками. Стратегия, достижения и история остаются на месте.</p>'+
    '<h2>Календарные дела на ближайшие 2 недели <span class="count">'+up.length+'</span></h2>'+(up.length?'<div class="card">'+up.map(c=>'<div class="mini"><div class="t">'+esc(c.title)+'<div class="meta">'+short(calNext(c)?.date||c.date)+((calNext(c)?.time||c.time)?' '+(calNext(c)?.time||c.time):'')+'</div></div></div>').join("")+'</div>':'<div class="empty">Календарных дел нет.</div>')+
    '<p class="meta">Календарные обязательства пауза не отменяет.</p>'+
    '<label class="tog"><input type="checkbox" name="mute"><span>Отключить календарные напоминания на время творческого режима</span></label>'+
    '<div class="row" style="margin-top:12px"><button class="btn primary">Уйти в творческий режим</button><button type="button" class="btn" data-act="sheet-close">Отмена</button></div></form>');
};
FORMS.creative=f=>{if(tx(()=>{S.creative={on:true,since:today(),mute:fv(f,"mute"),prevReminders:S.settings.reminders};if(S.creative.mute)S.settings.reminders=false;snapshotToday()},"Творческий режим включён. Возвращайтесь, когда захочется"))closeSheet()};
ACT["creative-off"]=async()=>{
  const since=S.creative.since;
  const missedCal=S.misses.filter(m=>m.kind==="cal"&&m.date>=since&&m.status==="active");
  const y=await ask({title:"Вернуться из творческого режима?",text:"Обычный режим и напоминания будут восстановлены."+(missedCal.length?" За время паузы пропущено календарных дел: "+missedCal.length+". Они в разделе «Невыполненные».":""),ok:"Вернуться"});
  if(!y)return;
  tx(()=>{if(S.creative.mute)S.settings.reminders=S.creative.prevReminders!==false;S.creative={on:false,since:null,mute:false};snapshotToday()},"С возвращением!");
};
/* ================= TASKS, HABITS, QUESTS, CALENDAR: sections, editors, cards ================= */
const SEC_TITLE={task:"Задания",habit:"Привычки",quest:"Квесты",cal:"Календарь"};
function listFilter(k,p,items){
  const q=(S.ui["q_"+k]||"").toLowerCase(),cat=S.ui["cat_"+k]||"",st=S.ui["st_"+k]||"active";
  return items.filter(it=>{
    if(st==="active"&&(it.status!=="active"||(k==="task"&&it.sched.type==="once"&&doneEver("task",it.id))||(k==="cal"&&(Cal.repeats(it)?!calNext(it):doneEver("cal",it.id)))))return false;
    if(st==="done"&&!((it.status==="completed"||it.status==="closed")||(k==="task"&&it.sched.type==="once"&&doneEver("task",it.id))||(k==="cal"&&(Cal.repeats(it)?!calNext(it):doneEver("cal",it.id)))))return false;
    if(it.status==="archived")return false;
    if(!inFocus(it))return false;
    if(cat&&it.cat!==cat)return false;
    const place=S.ui["locfilter_"+k];if(place&&!itemLocOk(it,place))return false;
    if(q&&!((it.title+" "+(it.tags||[]).join(" ")+" "+(it.cat||"")).toLowerCase().includes(q)))return false;
    return true;
  });
}
function listHeader(k){
  const items=S[COLL[k]];
  const cats=[...new Set(items.map(i=>i.cat).filter(Boolean))];
  const st=S.ui["st_"+k]||"active",cat=S.ui["cat_"+k]||"";
  return '<label class="f">Где</label><select data-location-list="'+k+'">'+opt("","Все локации",S.ui["locfilter_"+k]||"")+S.locations.map(l=>opt(l.id,l.icon+" "+l.name,S.ui["locfilter_"+k]||"")).join("")+'</select><div class="row nw" style="margin-top:6px"><input type="search" placeholder="Поиск по названию, категории, тегам" value="'+esc(S.ui["q_"+k]||"")+'" data-list-q="'+k+'"><button class="btn primary" data-act="new" data-k="'+k+'">+ Новое</button></div>'+
    '<div class="chips" style="margin-top:8px">'+[["active","Активные"],["done","Завершённые"]].map(([v,l])=>'<button class="chip" data-act="list-st" data-k="'+k+'" data-v="'+v+'" aria-pressed="'+(st===v)+'">'+l+'</button>').join("")+
    (cats.length?'<span class="muted small" style="align-self:center">·</span>'+[["","Все категории"],...cats.map(c=>[c,c])].map(([v,l])=>'<button class="chip" data-act="list-cat" data-k="'+k+'" data-v="'+esc(v)+'" aria-pressed="'+(cat===v)+'">'+esc(l)+'</button>').join(""):"")+'</div>';
}
document.addEventListener("input",e=>{
  if(e.target.matches("[data-list-q]")){const k=e.target.dataset.listQ;S.ui["q_"+k]=e.target.value;const pos=e.target.selectionStart;render();const i=$('[data-list-q="'+k+'"]');if(i){i.focus();i.setSelectionRange(pos,pos)}}
});
ACT["list-st"]=el=>{S.ui["st_"+el.dataset.k]=el.dataset.v;render()};
ACT["list-cat"]=el=>{S.ui["cat_"+el.dataset.k]=el.dataset.v;render()};
function sectionScreen(k){
  return p=>{
    curScr().title=SEC_TITLE[k];
    let items=listFilter(k,p,S[COLL[k]]);
    if(k==="cal")items.sort((a,b)=>{const x=calNext(a)||calView(a),y=calNext(b)||calView(b);return (x?.date||"9").localeCompare(y?.date||"9")});
    const intro={task:"Все задания в одном месте: из этапов и самостоятельные. Здесь и в этапе — одна и та же запись.",habit:"Повторяющиеся практики со счётчиком, целью и уровнем.",quest:"Конечное продвижение к результату: счётчик или чек-лист. Завершается автоматически.",cal:"Дела, привязанные к реальной дате."}[k];
    let h='<h1>'+SEC_TITLE[k]+'</h1><p class="lead">'+intro+'</p>'+listHeader(k);
    h+='<div class="list" style="margin-top:10px">'+(items.length?items.map(it=>sectionRow(k,it)).join(""):'<div class="empty">Ничего не найдено.</div>')+'</div>';
    h+=historyBlock(k);
    return h;
  };
}
function sectionRow(k,it){
  const d=today();
  let right="",sub=[originText(it)];if(it.locs?.length)sub.push(locNames(it.locs));
  if(k==="cal"){const o=calNext(it)||calView(it);sub.unshift((o?short(o.date)+(o.time?" "+o.time:""):"Серия завершена")+" · "+calRepeatText(it));}else sub.push(schedText(it.sched));
  if(k==="quest"){const p=questProgress(it);right='<span class="pill acc">'+p.done+'/'+p.total+'</span>'}
  if(k==="habit"&&it.goal.target)right='<span class="pill">'+habitCount(it,d)+'/'+it.goal.target+' · ур. '+it.level+'</span>';
  const rw=k==="quest"?it.stepReward:it.reward;
  const tags=(it.tags||[]).length?' · #'+it.tags.join(" #"):"";
  return '<div class="item'+(k==="task"&&it.key?' key':'')+'"><button class="body link" data-act="open" data-k="'+k+'" data-id="'+it.id+'"><div class="t">'+esc(it.title)+'</div><div class="meta">'+esc(sub.join(" · ")+(it.cat?" · "+it.cat:"")+tags)+'</div></button>'+right+(rw?'<span class="rw">+'+rw+'</span>':'')+
    (k!=="cal"&&it.status==="active"?'<button class="tg'+(it.inDay?' on':'')+'" data-act="inday" data-k="'+k+'" data-id="'+it.id+'" title="В Конструктор дня">'+(it.inDay?'в Конструкторе':'в Конструктор')+'</button>':'')+'</div>';
}
SCR.tasks=sectionScreen("task");SCR.habits=sectionScreen("habit");SCR.quests=sectionScreen("quest");SCR.calendar=sectionScreen("cal");
ACT["inday"]=el=>tx(()=>{const it=get(el.dataset.k,el.dataset.id);it.inDay=!it.inDay;return {on:it.inDay}},result=>result.on?"Включено в Конструктор дня (по расписанию)":"Выключено из Конструктора. Отметка ключевого, если была, сохранена");

/* general history of a section: 10 last, expand */
function historyBlock(k){
  const kinds={task:["task"],habit:["habit","habitGoal"],quest:["questStep","questFinal"],cal:["cal"]}[k];
  const fs=S.facts.filter(f=>kinds.includes(f.kind)).sort((a,b)=>b.ts-a.ts);
  const all=!!S.ui["hall_"+k];
  return '<h2>История выполнения <span class="count">'+fs.length+'</span></h2><div class="card">'+(fs.length?(all?fs:fs.slice(0,10)).map(f=>'<div class="mini'+(f.cancelled?' done':'')+'"><div class="t">'+esc(f.title||"")+'<div class="meta">'+short(f.date)+(f.cancelled?' · отменено':'')+'</div></div>'+(f.coins?'<span class="rw">+'+f.coins+'</span>':'')+'</div>').join(""):'<div class="empty">Пока пусто.</div>')+
    (fs.length>10?'<button class="btn ghost s" data-act="hall" data-k="'+k+'">'+(all?'Свернуть':'Показать всё ('+fs.length+')')+'</button>':'')+'</div>';
}
ACT["hall"]=el=>{S.ui["hall_"+el.dataset.k]=!S.ui["hall_"+el.dataset.k];render()};

/* ---------- item card (detail) ---------- */
ACT["open"]=el=>{closeAllSheets();if(el.dataset.k==="cal"){const c=get("cal",el.dataset.id);CAL_SELECTION.delete(c.id);if(el.dataset.occ)CAL_SELECTION.set(c.id,el.dataset.occ)}openItem(el.dataset.k,el.dataset.id)};
function openItem(k,id){
  if(k==="decision"){openDecision(id);return}
  if(k==="offer"){openOffer(id);return}
  if(k==="treat"){treatEditor(get("treat",id));return}
  const it=get(k,id);if(!it){toast("Запись не найдена");return}
  openSheet(KIND_L[k],itemDetail(k,it),{key:"detail"});
}
function itemDetail(k,it){
  const d=today();
  const goal=it.goalId?get("goal",it.goalId):null;
  let h='<h3 style="font-size:18px">'+esc(it.title)+'</h3>';
  if(it.desc||it.note)h+='<p>'+esc(it.desc||it.note)+'</p>';
  if(k==='cal'&&Cal.repeats(it))h+=calendarAppearances(it);
  h+='<dl class="kv" style="margin-top:6px"><dt>Место</dt><dd>'+esc(originText(it))+'</dd>';
  if(k==="cal"){const o=calView(it);h+='<dt>Дата</dt><dd>'+(o?esc(human(o.date))+(o.time?' · '+o.time:''):'Нет предстоящих появлений')+'</dd><dt>Повторение</dt><dd>'+esc(calRepeatText(it))+'</dd><dt>Напоминание</dt><dd>'+(it.reminder?'за '+(it.reminderLead??15)+' мин':'нет')+'</dd>';}
  else h+='<dt>Расписание</dt><dd>'+esc(schedText(it.sched))+'</dd>';
  if(goal)h+='<dt>Ведёт к цели</dt><dd>'+esc(goal.title)+'</dd>';
  h+='<dt>Конструктор</dt><dd>'+(it.inDay?'включено':'не включено')+'</dd>';
  if(k==="task")h+='<dt>Ключевое</dt><dd>'+(it.key?'да':'нет')+'</dd>';
  if(k!=="cal")h+='<dt>Темп дня</dt><dd>'+(it.fit||[]).map(t=>TEMPO_L[t]).join(", ")+'</dd>';
  if(k==="quest")h+='<dt>Награды</dt><dd>шаг +'+it.stepReward+', финал +'+it.finalReward+'</dd>';
  else if(k==="habit")h+='<dt>Награды</dt><dd>выполнение +'+it.reward+', цель +'+(it.goal.reward||0)+'</dd>';
  else h+='<dt>Награда</dt><dd>+'+it.reward+' монет и XP</dd>';
  const bon=(k==="habit"?it.goal.bonus:it.bonus)||[];
  if(bon.length)h+='<dt>Бонус</dt><dd>'+bon.map(o=>esc((get("offer",o)||{}).title||"")).join(", ")+'</dd>';
  if(it.cat||(it.tags||[]).length)h+='<dt>Категория</dt><dd>'+esc(it.cat||"—")+((it.tags||[]).length?' · #'+esc(it.tags.join(" #")):'')+'</dd>';
  if(it.ifThen)h+='<dt>Если — то</dt><dd>'+esc(it.ifThen)+'</dd>';
  h+='<dt>Статус</dt><dd>'+({active:"активно",closed:"закрыто с этапом",completed:"завершён",archived:"в архиве"}[it.status]||it.status)+'</dd></dl>';
  if(k==="habit"){
    const cnt=habitCount(it,d);
    h+='<div class="card flat" style="margin-top:8px"><b>Сегодня: '+habitDayProgress(it,d)+' из '+habitDayTarget(it,d)+'</b><p class="meta">Награда один раз за дневную норму. Цель считает успешные дни.</p></div>';
    h+='<div class="card flat" style="margin-top:10px"><div class="between"><b>Уровень '+it.level+'</b><span>'+cnt+' / '+it.goal.target+' '+(it.goal.mode==="period"?(it.goal.period==="week"?"за неделю":"за месяц"):"всего")+'</span></div><div class="bar good" style="margin-top:6px"><i style="width:'+Math.min(100,cnt/it.goal.target*100)+'%"></i></div>'+
      '<div class="meta" style="margin-top:6px">Всего выполнений: '+factsOf("habit",it.id).length+'</div>'+
      (cnt>=it.goal.target?'<button class="btn s primary" style="margin-top:8px" data-act="habit-level" data-id="'+it.id+'">Следующий уровень привычки</button>':'')+'</div>';
    let dots="";for(let i=27;i>=0;i--){const dd=addDays(d,-i);const m=S.misses.some(x=>x.kind==="habit"&&x.ref===it.id&&x.date===dd);dots+='<i class="'+(doneOn("habit",it.id,dd)?'on':m?'miss':'')+'" title="'+short(dd)+'"></i>'}
    h+='<label class="f">Последние 4 недели</label><div class="dots">'+dots+'</div>';
  }
  if(k==="quest"){
    const p=questProgress(it);
    h+='<div class="card flat" style="margin-top:10px"><div class="between"><b>Прогресс</b><span>'+p.done+' / '+p.total+'</span></div><div class="bar" style="margin-top:6px"><i style="width:'+(p.total?p.done/p.total*100:0)+'%"></i></div>';
    if(it.type==="checklist")h+=it.steps.map(s=>{const on=p.doneSet.has(s.id);const f=factsOf("questStep",it.id).find(x=>x.step===s.id);return '<div class="mini"><button class="check sq'+(on?' on':'')+'" style="width:24px;height:24px" data-act="qstep" data-id="'+it.id+'" data-step="'+s.id+'" '+(on?'data-fact="'+f.id+'"':'')+' aria-label="Шаг">'+(on?IC.check:'')+'</button><div class="t">'+esc(s.title)+'</div></div>'}).join("");
    else if(it.status==="active")h+='<button class="btn s primary" style="margin-top:8px" data-act="toggle-q" data-id="'+it.id+'">+1 шаг</button>';
    h+='</div>';
  }
  // actions
  const act=it.status==="active";
  h+='<div class="row" style="margin-top:14px">';
  if(act&&k!=="quest"){
    const doneT=k==="cal"?doneEver("cal",it.id):k==="task"&&it.sched.type==="once"?doneEver("task",it.id):doneOn(k,it.id,d);
    h+='<button class="btn '+(doneT?'':'primary')+'" data-act="detail-toggle" data-r="'+rk(k,it.id)+'">'+(doneT?'Снять отметку':k==='habit'&&habitDayTarget(it,d)>1?'+1 подход':'Выполнено сегодня')+'</button>';
  }
  if(act&&k==='habit'&&habitSteps(it.id,d).length&&!doneOn('habit',it.id,d))h+='<button class="btn" data-act="habit-unmark" data-id="'+it.id+'">−1 подход</button>';
  if(act&&k==='cal'&&calView(it)&&!calDone(it,calChosen(it)))h+='<button class="btn" data-act="cal-move" data-id="'+it.id+'" data-occ="'+calChosen(it)+'">Перенести</button>';
  if(act){
    const selectedRef=k==="cal"?calRef(it,calView(it)||{key:calChosen(it)}):rk(k,it.id);const inPlan=dayPlan(d).visible.includes(selectedRef);
    if(!inPlan&&!(k==="task"&&it.sched.type==="once"&&doneEver("task",it.id)))h+='<button class="btn" data-act="pick-close" data-r="'+selectedRef+'">Добавить на сегодня</button>';
  }
  h+='<button class="btn" data-act="edit" data-k="'+k+'" data-id="'+it.id+'">Изменить / перенести</button>';
  h+='<button class="btn" data-act="copy" data-k="'+k+'" data-id="'+it.id+'">Копировать</button>';
  if(it.status==="archived")h+='<button class="btn" data-act="item-restore" data-k="'+k+'" data-id="'+it.id+'">Восстановить</button>';
  else h+='<button class="btn danger" data-act="item-archive" data-k="'+k+'" data-id="'+it.id+'">В архив</button>';
  if(it.status==="closed"||it.status==="completed")h+='<button class="btn" data-act="item-reactivate" data-k="'+k+'" data-id="'+it.id+'">Вернуть в работу</button>';
  h+='</div>';
  const kinds={task:["task"],habit:["habit","habitGoal"],quest:["questStep","questFinal"],cal:["cal"]}[k];
  const fs=S.facts.filter(f=>kinds.includes(f.kind)&&f.ref===it.id&&!f.cancelled).sort((a,b)=>b.ts-a.ts);
  if(fs.length)h+='<h2>Выполнения <span class="count">'+fs.length+'</span></h2><div class="card">'+fs.slice(0,5).map(f=>'<div class="mini"><div class="t">'+esc(f.title)+'<div class="meta">'+short(f.date)+'</div></div>'+(f.coins?'<span class="rw">+'+f.coins+'</span>':'')+'</div>').join("")+'<div class="meta">Полная история — в общем разделе.</div></div>';
  return h;
}
ACT["detail-toggle"]=el=>{
  const [k,id]=pr(el.dataset.r);const it=get(k,id);const d=today();
  const done=k==="cal"?doneEver("cal",id):k==="task"&&it.sched.type==="once"?doneEver("task",id):doneOn(k,id,d);
  if(done)tx(()=>{if(k==="cal"){const f=factsOf("cal",it.id).find(f=>(f.occurrence||it.date)===calChosen(it));undoFact(f.id)}else if(k==="task"&&it.sched.type==="once")undoFact(factsOf(k,id).pop().id);else undoToday(k,id,d)},"Отметка снята, награда возвращена");
  else tx(()=>complete(k,id,d),f=>rewardMsg(f));
  refreshSheet("detail",()=>itemDetail(k,get(k,id)));
};
ACT["habit-unmark"]=el=>{tx(()=>undoToday("habit",el.dataset.id),"Подход отменён");refreshSheet("detail",()=>itemDetail("habit",get("habit",el.dataset.id)))};
ACT["toggle-q"]=el=>{tx(()=>complete("quest",el.dataset.id,today()),f=>rewardMsg(f));refreshSheet("detail",()=>itemDetail("quest",get("quest",el.dataset.id)))};
ACT["qstep"]=el=>{
  const id=el.dataset.id;
  if(el.dataset.fact)tx(()=>undoFact(el.dataset.fact),"Шаг отменён");
  else tx(()=>complete("quest",id,today(),{step:el.dataset.step}),f=>rewardMsg(f));
  refreshSheet("detail",()=>itemDetail("quest",get("quest",id)));
};
ACT["pick-close"]=el=>{tx(()=>{const r=dayRec(today());const x=el.dataset.r;if(!r.added.includes(x))r.added.push(x);if(!r.forced.includes(x))r.forced.push(x);r.removed=r.removed.filter(y=>y!==x)},"Добавлено на сегодня");closeSheet()};
ACT["habit-level"]=async el=>{
  const h=get("habit",el.dataset.id);
  const v=await ask({title:"Следующий уровень привычки",text:"Сейчас цель: "+h.goal.target+". Укажите новую цель. Счётчик и история сохраняются.",input:"Например: "+Math.round(h.goal.target*1.5),ok:"Повысить"});
  if(v===false)return;const n=parseInt(v,10);if(!(n>h.goal.target)){toast("Новая цель должна быть больше текущей");return}
  tx(()=>{h.levelLog.push({level:h.level,target:h.goal.target,date:today()});h.level++;h.goal.target=n},"Уровень "+(h.level+1)+": новая цель "+n);
  refreshSheet("detail",()=>itemDetail("habit",get("habit",h.id)));
};
ACT["copy"]=async el=>{
  const k=el.dataset.k,it=get(k,el.dataset.id);
  const y=await ask({title:"Создать копию?",text:"Копия — самостоятельная запись с теми же настройками, но без истории и прогресса. Назначенные бонусы не копируются. Оригинал остаётся на месте.",ok:"Копировать"});
  if(!y)return;
  closeAllSheets();
  tx(()=>{const c=JSON.parse(JSON.stringify(it));c.id=uid();c.created=today();c.status="active";c.bonus=[];if(c.goal)c.goal.bonus=[];if(k==="habit"){c.level=1;c.levelLog=[];c.dailyTarget=habitTarget(it,today());c.norms=[{from:today(),target:c.dailyTarget}]}if(k==="cal"){c.date=calNext(it)?.date||today();c.exceptions={};c.retained=[];c.until=null;c.reminderReceipts={};c.notifiedDates=[]}if(k==="quest"){c.steps=c.steps.map(s=>({...s,id:uid()}))}S[COLL[k]].push(c);pushRecent(k,c.id)},"Копия создана");
};
ACT["item-archive"]=async el=>{
  const k=el.dataset.k,it=get(k,el.dataset.id);
  const y=await ask({title:"Убрать в архив?",text:"Запись уйдёт из активной работы и дня. История выполнений сохранится. Из архива её можно восстановить или удалить окончательно.",ok:"В архив"});
  if(!y)return;closeAllSheets();
  tx(()=>{it.prevStatus=it.status;it.status="archived";if(k==="task")it.key=false},"В архиве");
};
ACT["item-restore"]=el=>{closeAllSheets();tx(()=>{const it=get(el.dataset.k,el.dataset.id);it.status=it.prevStatus&&it.prevStatus!=="archived"?it.prevStatus:"active"},"Восстановлено")};
ACT["item-reactivate"]=el=>{closeAllSheets();tx(()=>{const it=get(el.dataset.k,el.dataset.id);
  if(el.dataset.k==="quest"){const p=questProgress(it);if(p.done>=p.total)fail("Квест уже выполнен полностью. Создайте копию для нового цикла")}
  it.status="active";delete it.closedAt},"Снова в работе")};

/* ---------- editors ---------- */
ACT["new"]=el=>{
  const k=el.dataset.k;const p={};
  if(el.dataset.stage){const s=get("stage",el.dataset.stage);p.stageId=s.id;p.blockId=s.blockId}
  if(el.dataset.block)p.blockId=el.dataset.block;
  if(el.dataset.title)p.title=el.dataset.title;if(el.dataset.goal)p.goalId=el.dataset.goal;
  if(el.closest('.sheet'))closeSheet();
  editItem(k,null,p);
};
ACT["edit"]=el=>{closeAllSheets();editItem(el.dataset.k,get(el.dataset.k,el.dataset.id))};
function editItem(k,it,preset,fromNote){
  const isNew=!it;
  it=it||({task:newTask,habit:newHabit,quest:newQuest,cal:newCal}[k])(preset||{});
  if(isNew&&!it.locs?.length){const b=get("block",it.blockId);if(b?.loc)it.locs=[b.loc]}
  const link='<div class="grid2"><div><label class="f">Блок</label>'+blockSelect("blockId",it.blockId)+'</div><div><label class="f">Этап</label>'+stageSelect("stageId",it.blockId,it.stageId)+'</div></div>';
  let h='<form data-form="item" data-k="'+k+'" data-id="'+(isNew?"":it.id)+'" data-note="'+(fromNote||"")+'">';
  h+='<label class="f">Название</label><input type="text" name="title" value="'+esc(it.title)+'" required>';
  if(k==="cal"){
    const shown=!isNew&&!Cal.repeats(it)?calView(it):null;
    h+='<div class="grid2"><div><label class="f">Дата</label><input type="date" name="date" value="'+(shown?.date||it.date)+'" required></div><div><label class="f">Время</label><input type="time" name="time" value="'+esc(shown?.time??it.time)+'"></div></div>';
    h+=calendarFields(it);
    h+='<label class="f">Заметка</label><textarea name="note">'+esc(it.note)+'</textarea>'+link;
    h+='<label class="tog"><input type="checkbox" name="inDay" '+(it.inDay?'checked':'')+'><span>Добавить в Конструктор дня</span></label><label class="tog"><input type="checkbox" name="reminder" '+(it.reminder?'checked':'')+'><span>Напоминание</span></label>';
    h+='<label class="f">Награда, монет</label><input type="number" min="0" name="reward" value="'+it.reward+'" style="max-width:140px">';
  }else{
    h+='<label class="f">Описание</label><textarea name="desc">'+esc(it.desc)+'</textarea>';
    if(k==="quest"){
      h+='<label class="f">Тип квеста</label>'+segBtns("qtype",[["counter","Счётчик"],["checklist","Чек-лист"]],it.type);
      const started=!isNew&&factsOf("questStep",it.id).length>0;
      h+='<div data-qcounter '+(it.type==="counter"?'':'hidden')+'><label class="f">Цель счётчика</label><input type="number" min="1" name="target" value="'+it.target+'" style="max-width:140px"></div>';
      h+='<div data-qcheck '+(it.type==="checklist"?'':'hidden')+'><label class="f">Шаги, каждый с новой строки</label><textarea name="steps" style="min-height:100px">'+esc(it.steps.map(s=>s.title).join("\n"))+'</textarea>'+(started?'<p class="meta">Отмеченные шаги сохраняются, если их название не менять.</p>':'')+'</div>';
    }
    h+=link+'<label class="f">Цель этапа</label>'+goalSelect("goalId",it.stageId,it.goalId);
    if(k==="habit")h+=schedFields(it.sched,[["daily","Каждый день"],["weekly","Раз в неделю"],["days","По дням"],["whenever","Когда хочется"]]);
    else if(k==="quest")h+=schedFields(it.sched,[["whenever","Когда хочется"],["daily","Каждый день"],["days","По дням"]]);
    else h+=schedFields(it.sched);
    h+='<label class="tog"><input type="checkbox" name="inDay" '+(it.inDay?'checked':'')+'><span>Добавить в Конструктор дня<small>По расписанию. Без галочки запись остаётся в этапе и своём разделе как подготовленное действие.</small></span></label>';
    if(k==="task")h+='<label class="tog"><input type="checkbox" name="key" '+(it.key?'checked':'')+'><span>Ключевое действие<small>Включает Конструктор автоматически, затем Конструктор можно снять отдельно.</small></span></label>';
    h+=fitFields(it.fit||[]);
    if(k==="habit"){
      h+='<label class="f">Дневная норма (подходов)</label><input type="number" name="dailyTarget" min="1" max="50" value="'+habitTarget(it,isNew?today():addDays(today(),1))+'"><p class="meta">'+(isNew?'Один подход по умолчанию.':'Изменение нормы действует с завтрашнего дня.')+' Награда одна за полную норму.</p>';
      h+='<div class="grid2"><div><label class="f">Награда за выполнение</label><input type="number" min="0" name="reward" value="'+it.reward+'"></div><div><label class="f">Награда за цель</label><input type="number" min="0" name="greward" value="'+(it.goal.reward||0)+'"></div></div>';
      h+='<label class="f">Цель привычки</label>'+segBtns("gmode",[["total","За всё время"],["period","За период"]],it.goal.mode)+
        '<div class="grid2"><div><label class="f">Сколько раз</label><input type="number" min="1" name="gtarget" value="'+it.goal.target+'"></div><div data-gperiod '+(it.goal.mode==="period"?'':'hidden')+'><label class="f">Период</label><select name="gperiod">'+opt("week","Неделя",it.goal.period)+opt("month","Месяц",it.goal.period)+'</select></div></div>';
      if(!lite())h+=bonusField(it.goal.bonus||[],"Бонус за достижение цели привычки");
    }else if(k==="quest"){
      h+='<div class="grid2"><div><label class="f">Награда за шаг</label><input type="number" min="0" name="stepReward" value="'+it.stepReward+'"></div><div><label class="f">Награда за финал</label><input type="number" min="0" name="finalReward" value="'+it.finalReward+'"></div></div>';
      if(!lite())h+=bonusField(it.bonus||[],"Бонус за завершение квеста");
    }else{
      h+='<label class="f">Награда, монет (XP столько же)</label><input type="number" min="0" name="reward" value="'+it.reward+'" style="max-width:140px">';
      if(!lite())h+=bonusField(it.bonus||[],"Бонус за выполнение");
    }
    h+='<label class="f">Если — то (необязательно)</label><input type="text" name="ifThen" value="'+esc(it.ifThen)+'" placeholder="Если устану вечером, то сделаю короткий вариант">';
    h+=catTagFields(it);
  }
  h+=locField(it.locs);
  if(!isNew)h+='<p class="meta" style="margin-top:8px">Новая награда действует на будущие выполнения. Прошлые начисления не меняются.</p>';
  h+='<div class="row" style="margin-top:14px"><button class="btn primary">'+(isNew?'Создать':'Сохранить')+'</button><button type="button" class="btn" data-act="sheet-close">Отмена</button></div></form>';
  openSheet((isNew?"Новое: ":"")+KIND_L[k],h);
}
FORMS.item=async f=>{
  const k=f.dataset.k,id=f.dataset.id;
  const old=id?get(k,id):null;
  // warn when moving away from linked goal's stage
  const newStage=fv(f,"stageId")||null;
  if(old&&old.goalId&&k!=="cal"&&(get("goal",old.goalId)||{}).stageId!==newStage){
    const y=await ask({title:"Связь с целью будет снята",text:"Запись переносится в другой этап, а цель «"+((get("goal",old.goalId)||{}).title||"")+"» относится к прежнему. Продолжить перенос без связи с целью?",ok:"Перенести"});
    if(!y)return;
  }
  const res=tx(()=>{
    const title=fv(f,"title");if(!title)fail("Введите название");
    let it=old||({task:newTask,habit:newHabit,quest:newQuest,cal:newCal}[k])({});
    const previousSchedule=it.sched?.type,previousQuestType=it.type,previousTarget=it.target,previousSteps=JSON.stringify(it.steps||[]);
    if(k==='cal'){
      const data={title,date:fv(f,'date')||today(),time:fv(f,'time'),note:fv(f,'note'),reminder:fv(f,'reminder'),reminderLead:fnum(f,'reminderLead',15),repeat:readCalendarRepeat(f),reward:Math.max(0,fnum(f,'reward')),blockId:fv(f,'blockId')||null,stageId:newStage,inDay:fv(f,'inDay'),locs:readLocs(f)};
      if(old)it=applyCalendarEdit(old,data);else Object.assign(it,data);
    }else{
      it.title=title;it.blockId=fv(f,'blockId')||null;it.stageId=newStage;if(it.stageId&&!it.blockId)it.blockId=get('stage',it.stageId).blockId;it.inDay=fv(f,'inDay');if(f.querySelector('[data-multi="locs"]'))it.locs=readLocs(f);
      it.desc=fv(f,"desc");it.sched=readSched(f);
      const g=fv(f,"goalId");
      if(g==='__draft'){const draft=f._goalDraft;if(!draft||draft.stageId!==it.stageId)fail('Выберите этап для новой цели');const goal={id:uid(),stageId:it.stageId,title:draft.title,ifThen:draft.ifThen,status:'active',created:today()};S.goals.push(goal);it.goalId=goal.id}else it.goalId=g&&(get("goal",g)||{}).stageId===it.stageId?g:null;
      it.fit=multiVal(f,"fit");if(!it.fit.length)fail("Выберите хотя бы один темп дня");
      it.ifThen=fv(f,"ifThen");it.cat=fv(f,"cat");it.tags=readTags(f);
      if(k==="task"){
        if(old&&(previousSchedule==="once")!==(it.sched.type==="once"))it.cycle=(it.cycle||0)+1;
        const wasKey=it.key;it.key=fv(f,"key");
        // The checkbox change enabled inDay once; respect the final explicit value.
        it.reward=Math.max(0,fnum(f,"reward"));
        if(old&&doneEver("task",it.id)&&old.sched.type==="once"&&it.sched.type!=="once"){/* history stays as is */}
      }
      if(k==="habit"){
        const target=Math.max(1,Math.min(50,fnum(f,"dailyTarget",1))),effective=old?addDays(today(),1):today();if(!old){it.dailyTarget=target;it.norms=[{from:effective,target}]}else if(habitTarget(it,effective)!==target){it.norms=(it.norms||[]).filter(x=>x.from!==effective);it.norms.push({from:effective,target})}
        it.reward=Math.max(0,fnum(f,"reward"));it.goal.reward=Math.max(0,fnum(f,"greward"));
        it.goal.mode=fv(f,"gmode");it.goal.period=fv(f,"gperiod")||"month";it.goal.target=Math.max(1,fnum(f,"gtarget",1));
      }
      if(k==="quest"){
        if(old&&factsOf("questStep",it.id).length&&previousQuestType!==fv(f,"qtype"))fail("Тип начатого квеста изменить нельзя. Создайте независимую копию.");
        it.type=fv(f,"qtype");it.stepReward=Math.max(0,fnum(f,"stepReward"));it.finalReward=Math.max(0,fnum(f,"finalReward"));
        if(it.type==="counter"){it.target=Math.max(1,fnum(f,"target",1));const p=questProgress(it);if(old&&p.done>it.target)fail("Цель меньше уже набранного прогресса")}
        else{
          const lines=fv(f,"steps").split("\n").map(s=>s.trim()).filter(Boolean);if(lines.length<1)fail("Добавьте хотя бы один шаг");
          const prev=[...(it.steps||[])];it.steps=lines.map(t=>{const j=prev.findIndex(s=>s.title===t);return j>=0?prev.splice(j,1)[0]:{id:uid(),title:t}});
          const removedDone=factsOf("questStep",it.id).filter(x=>x.step&&!it.steps.some(s=>s.id===x.step));
          if(removedDone.length)fail("Нельзя удалить уже отмеченный шаг: сначала снимите его отметку");
        }
        if(old&&it.status==="completed"&&(it.target!==previousTarget||JSON.stringify(it.steps||[])!==previousSteps))fail("Для изменения завершённого квеста сначала отмените последний шаг или создайте копию.");
      }
    }
    if(!old){S[COLL[k]].push(it);pushRecent(k,it.id);if(f.dataset.note)S.inbox=S.inbox.filter(n=>n.id!==f.dataset.note)}
    if(f.querySelector('[name="bonus"]'))setBonusAssign(k,it.id,bonusVal(f));
    // quest completes automatically if edited target reached
    if(k==="quest"&&it.status==="active"){const p=questProgress(it);if(p.total&&p.done>=p.total&&!S.facts.some(x=>!x.cancelled&&x.kind==="questFinal"&&x.ref===it.id)){const parent=factsOf("questStep",it.id).slice(-1)[0];const fin=addFact("questFinal",it.id,today(),it.finalReward,{title:"Финал квеста: "+it.title,parent:parent?.id});if(parent)parent.final=fin.id;const a=award("quest",it.id,today());fin.insts=a.insts;fin.consumed=a.consumed;it.status="completed";it.completedAt=today()}}
    return it;
  },it=>(old?"Сохранено":"Создано")+(k!=="cal"&&!it.inDay?". Запись не в Конструкторе: её можно взять в день вручную":""));
  if(res)closeSheet();
};

/* Calendar editors share the same recurrence/occurrence identity as the day plan. */
function calRepeatText(c){return {none:'Разово',daily:'Ежедневно',weekly:'Еженедельно',days:'По дням: '+(c.repeat?.days||[]).map(n=>WD[n-1]).join(', '),monthly:'Ежемесячно',yearly:'Ежегодно'}[c.repeat?.type||'none']}
function calendarAppearances(c){
  const keys=new Set([calChosen(c)]);let from=today(),count=0;
  while(count<6){const o=Cal.next(c,from);if(!o)break;for(const v of Cal.due(c,o.date)){keys.add(v.key);count++}from=addDays(o.date,1)}
  S.misses.filter(m=>m.kind==='cal'&&m.ref===c.id&&m.status==='active').slice(-5).forEach(m=>keys.add(m.occurrence||m.date));
  return '<label class="f">Появление события</label><div class="chips">'+[...keys].map(key=>{const o=Cal.occurrence(c,key);return o?'<button class="chip" data-act="cal-occurrence" data-id="'+c.id+'" data-occ="'+key+'" aria-pressed="'+(key===calChosen(c))+'">'+esc(short(o.date)+(o.time?' '+o.time:''))+(calDone(c,key)?' ✓':'')+'</button>':''}).join('')+'</div>';
}
ACT['cal-occurrence']=el=>{const c=get('cal',el.dataset.id);if(Cal.occurrence(c,el.dataset.occ)){CAL_SELECTION.set(c.id,el.dataset.occ);refreshSheet('detail',()=>itemDetail('cal',c))}};
function calendarFields(c){
  const type=c.repeat?.type||'none';
  return '<label class="f">Повторение</label><select name="calRepeat">'+[['none','Разово'],['daily','Ежедневно'],['weekly','Еженедельно'],['days','Выбранные дни'],['monthly','Ежемесячно'],['yearly','Ежегодно']].map(([v,l])=>opt(v,l,type)).join('')+'</select><div data-cal-days '+(type==='days'?'':'hidden')+'>'+chipsMulti('calDays',WD.map((v,i)=>[String(i+1),v]),(c.repeat?.days||[]).map(String))+'</div><p class="meta">Месячный и годовой повтор используют последний день месяца, если нужной даты нет.</p><label class="f">Напомнить</label><select name="reminderLead">'+[[0,'В момент события'],[15,'За 15 минут'],[60,'За час'],[1440,'За сутки']].map(([v,l])=>opt(v,l,c.reminderLead??15)).join('')+'</select>';
}
document.addEventListener('change',e=>{if(e.target.name==='calRepeat'){const box=e.target.form.querySelector('[data-cal-days]');if(box)box.hidden=e.target.value!=='days'}});
function readCalendarRepeat(f){const type=fv(f,'calRepeat')||'none',days=type==='days'?multiVal(f,'calDays').map(Number):[];if(type==='days'&&!days.length)fail('Выберите дни повторения');return {type,days}}
function splitCalendar(c,key,patch,preserveSelected=false){
  const protectedKeys=factsOf('cal',c.id).map(f=>f.occurrence||c.date);if(preserveSelected&&c.exceptions?.[key])protectedKeys.push(key);const fresh=Cal.split(c,key,patch,uid(),protectedKeys);
  fresh.created=today();S.cal.push(fresh);CAL_SELECTION.delete(c.id);return fresh;
}
function applyCalendarEdit(c,data){
  const shown=!Cal.repeats(c)?calView(c):null;
  const changed=data.date!==(shown?.date||c.date)||data.time!==(shown?.time??c.time)||JSON.stringify(data.repeat)!==JSON.stringify(c.repeat);
  if(!Cal.repeats(c)&&calDone(c,c.date)&&changed)fail('Выполненное событие сохраняет свою дату. Создайте копию для нового события.');
  if(!Cal.repeats(c)&&data.repeat.type==='none'){
    if(data.date!==c.date||c.exceptions?.[c.date]){(c.exceptions||={})[c.date]={date:data.date,time:data.time};data={...data,date:c.date}}
    Object.assign(c,data);Cal.validate(c);return c;
  }
  if(Cal.repeats(c)&&(c.date<today()||factsOf('cal',c.id).length)){
    const chosen=calView(c),next=chosen&&chosen.key>=today()&&!calDone(c,chosen.key)?chosen:calNext(c);
    if(!next)fail('У серии нет будущих появлений для изменения. Создайте копию.');
    const patch={...data,date:data.date===c.date?next.key:data.date};
    if(data.date===c.date&&data.repeat.type===c.repeat.type&&['monthly','yearly'].includes(data.repeat.type)){patch.repeat={...data.repeat,anchorDay:c.repeat.anchorDay||Number(c.date.slice(8)),anchorMonth:c.repeat.anchorMonth||Number(c.date.slice(5,7))}}
    if(patch.date<today())fail('Изменение серии применяется с сегодняшнего или будущего дня. Для прошлого появления используйте «Перенести».');
    return splitCalendar(c,next.key,patch,true);
  }
  Object.assign(c,data);Cal.validate(c);return c;
}
function calendarMove(c,key,missId){
  const o=Cal.occurrence(c,key);if(!o||calDone(c,key)){toast('Это появление уже выполнено или отменено');return}
  openSheet('Перенести событие','<form data-form="cal-move" data-id="'+c.id+'" data-occ="'+key+'" data-miss="'+(missId||'')+'"><p>'+esc(c.title)+' · '+esc(short(o.date))+'</p><div class="grid2"><div><label class="f">Дата</label><input type="date" name="date" value="'+(o.date<today()?today():o.date)+'" required></div><div><label class="f">Время</label><input type="time" name="time" value="'+o.time+'"></div></div><label class="f">Что переносим</label><select name="scope">'+opt('one','Только это появление','one')+(Cal.repeats(c)&&key>=today()?opt('following','Это и следующие',''):'')+'</select><p class="meta">Выполненные события и прошлое расписание сохраняются.</p><div class="row"><button class="btn primary">Перенести</button><button type="button" class="btn" data-act="sheet-close">Отмена</button></div></form>');
}
ACT['cal-move']=el=>{const c=get('cal',el.dataset.id);calendarMove(c,el.dataset.occ||calChosen(c))};
FORMS['cal-move']=f=>{
  const ok=tx(()=>{const c=get('cal',f.dataset.id),key=f.dataset.occ,o=Cal.occurrence(c,key),date=fv(f,'date'),time=fv(f,'time');
    if(!o||calDone(c,key))fail('Появление уже выполнено или отменено');if(!Cal.valid(date))fail('Укажите действительную дату');
    if(fv(f,'scope')==='following'){
      if(key<today())fail('Прошлое расписание не меняется');
      const repeat=cloneState(c.repeat),shift=(Cal.weekday(date)-Cal.weekday(key)+7)%7;
      if(repeat.type==='days')repeat.days=repeat.days.map(n=>(n-1+shift)%7+1).sort((a,b)=>a-b);
      splitCalendar(c,key,{date,time,repeat});
    }else{(c.exceptions||={})[key]={date,time};CAL_SELECTION.set(c.id,key)}
    const m=S.misses.find(x=>x.id===f.dataset.miss);if(m)m.note='перенесено на '+short(date);
  },'Перенесено. История и выполненные появления сохранены');
  if(ok){closeSheet();refreshSheet('detail',()=>itemDetail('cal',get('cal',f.dataset.id)))}
};

/* A child goal remains a local draft until the parent item commits successfully. */
let GOAL_PARENT=null;
function openGoalDraft(parent){
  const sid=fv(parent,'stageId');if(!sid||get('stage',sid)?.status!=='open'){toast('Сначала выберите открытый этап');return}
  GOAL_PARENT=parent;const draft=parent._goalDraft||{};
  openSheet('Новая цель этапа','<form data-form="goal-draft" data-stage="'+sid+'"><label class="f">Желаемый результат</label><input name="title" value="'+esc(draft.title||'')+'" required><label class="f">Если — то (необязательно)</label><input name="ifThen" value="'+esc(draft.ifThen||'')+'"><p class="meta">Цель сохранится вместе с действием. Отмена действия отменит и эту новую цель.</p><div class="row"><button class="btn primary">Добавить к действию</button><button type="button" class="btn" data-act="sheet-close">Отмена</button></div></form>',{onClose:()=>{const select=GOAL_PARENT?.querySelector('[name="goalId"]');if(select?.value==='__new')select.value=GOAL_PARENT._goalDraft?'__draft':''}});
}
FORMS['goal-draft']=f=>{
  const parent=GOAL_PARENT,title=fv(f,'title');if(!parent?.isConnected||!title||fv(parent,'stageId')!==f.dataset.stage){toast('Откройте действие заново');return}
  parent._goalDraft={title,ifThen:fv(f,'ifThen'),stageId:f.dataset.stage};
  const select=parent.querySelector('[name="goalId"]');select.querySelector('[value="__draft"]')?.remove();select.insertAdjacentHTML('beforeend',opt('__draft','Новая цель: '+title,'__draft'));select.value='__draft';closeSheet();
};
function firstGoalStep(g){
  const stage=get('stage',g.stageId);
  openSheet('Цель сохранена','<p>'+esc(g.title)+'</p><div class="row"><button class="btn primary" data-act="new" data-k="task" data-stage="'+stage.id+'" data-goal="'+g.id+'">Добавить первый шаг</button><button class="btn" data-act="sheet-close">Позже</button></div>');
}
function creationContext(){const c=curScr();let sid=c.p?.stage||c.p?.stageId||null,bid=c.s==='block'?c.p.id:c.p?.block||null;if(sid){const s=get('stage',sid);if(s?.status==='open')bid=s.blockId;else sid=null}if(bid&&!sid){const s=get('stage',get('block',bid)?.currentStageId);if(s?.status==='open')sid=s.id}return {blockId:bid||null,stageId:sid}}
function captureGoal(title,fromNote,preset={}){
  const p={...creationContext(),...preset};
  openSheet('Новая цель','<form data-form="capture-goal" data-note="'+(fromNote||'')+'"><label class="f">Желаемый результат</label><input name="title" value="'+esc(title||'')+'" required><div class="grid2"><div><label class="f">Блок</label>'+blockSelect('blockId',p.blockId)+'</div><div><label class="f">Этап</label>'+stageSelect('stageId',p.blockId,p.stageId)+'</div></div><label class="f">Если — то (необязательно)</label><input name="ifThen" value="'+esc(p.ifThen||'')+'"><p class="meta">Без этапа цель останется наброском во «Входящих». Награды за создание цели нет.</p><div class="row"><button class="btn primary">Сохранить цель</button><button type="button" class="btn" data-act="sheet-close">Отмена</button></div></form>');
  topSheet().querySelector('form')._sourceLocs=p.locs||[];
}
function saveCapturedGoal(title,sid,bid,locs,ifThen,noteId){
  if(noteId)S.inbox=S.inbox.filter(n=>n.id!==noteId);
  if(!sid){S.inbox.unshift({id:uid(),text:title,date:today(),locs,goalDraft:true,blockId:bid,ifThen});return null}
  const s=get('stage',sid);if(!s||s.status!=='open'||s.blockId!==bid)fail('Выберите открытый этап цели');
  const g={id:uid(),stageId:sid,title,ifThen:ifThen||'',status:'active',created:today()};S.goals.push(g);return g;
}
FORMS['capture-goal']=f=>{
  const result=tx(()=>{const title=fv(f,'title');if(!title)fail('Введите цель');return {goal:saveCapturedGoal(title,fv(f,'stageId')||null,fv(f,'blockId')||null,f._sourceLocs||[],fv(f,'ifThen'),f.dataset.note)}},r=>r.goal?'Цель создана':'Набросок цели во «Входящих»');
  if(result){closeSheet();if(result.goal)firstGoalStep(result.goal)}
};

/* ---------- bonus assignment field + catalog picker ---------- */
function bonusField(ids,label){
  return '<div data-bonus-field><label class="f">'+esc(label)+'</label><input type="hidden" name="bonus" value="'+ids.join(",")+'"><div class="row"><span class="small grow" data-bonus-labels>'+bonusLabels(ids)+'</span><button type="button" class="btn s" data-act="bonus-pick">Выбрать в магазине</button></div><p class="meta">Одноразовый бонус резервируется сразу при назначении.</p></div>';
}
const bonusLabels=ids=>ids.length?ids.map(o=>esc((get("offer",o)||{}).title||"?")).join(", "):'<span class="muted">не назначен</span>';
const bonusVal=f=>(fv(f,"bonus")||"").split(",").filter(Boolean);
let BONUS_TARGET=null;
ACT["bonus-pick"]=el=>{
  BONUS_TARGET=el.closest("[data-bonus-field]");
  const cur=BONUS_TARGET.querySelector('[name="bonus"]').value.split(",").filter(Boolean);
  openSheet("Каталог бонусов",bonusPickerBody(cur),{key:"bpick"});
};
function bonusPickerBody(cur){
  const offers=S.offers.filter(o=>o.status==="active");
  return '<p class="meta">Отметьте один или несколько бонусов и нажмите «Готово». Черновик формы сохранится. Выбор ничего не покупает и не выдаёт.</p>'+
    (offers.length?'<div class="card">'+offers.map(o=>'<label class="tog" style="margin:6px 0"><input type="checkbox" data-bp value="'+o.id+'" '+(cur.includes(o.id)?'checked':'')+'><span>'+esc(o.title)+' <span class="pill">'+USE_L[o.use]+(o.use==="limited"?" ×"+o.limit:"")+'</span><small>Цена в магазине: '+o.price+'</small></span></label>').join("")+'</div>':'<p class="empty">В магазине пока нет бонусов.</p>')+
    '<details style="margin-top:10px"><summary class="small">Создать новый бонус здесь</summary><div class="grid2"><input type="text" id="bp-title" placeholder="Название"><input type="number" id="bp-price" placeholder="Цена" min="0"></div><select id="bp-use" style="margin-top:6px">'+opt("once","Одноразовый","once")+opt("unlimited","Безлимитный","")+opt("limited","Ограниченный (3 использования)","")+'</select><button type="button" class="btn s" style="margin-top:6px" data-act="bp-create">Добавить в магазин</button></details>'+
    '<div class="row" style="margin-top:12px"><button class="btn primary" data-act="bp-done">Готово</button></div>';
}
ACT["bp-create"]=()=>{
  const t=($("#bp-title").value||"").trim();if(!t){toast("Введите название");return}
  const cur=$$("[data-bp]",topSheet()).filter(c=>c.checked).map(c=>c.value);
  const o=newOffer({title:t,price:Math.max(0,parseInt($("#bp-price").value,10)||0),use:$("#bp-use").value,limit:3});
  S.offers.push(o);save();cur.push(o.id);
  refreshSheet("bpick",()=>bonusPickerBody(cur));toast("Бонус добавлен в магазин");
};
ACT["bp-done"]=()=>{
  const ids=$$("[data-bp]",topSheet()).filter(c=>c.checked).map(c=>c.value);
  if(BONUS_TARGET){BONUS_TARGET.querySelector('[name="bonus"]').value=ids.join(",");BONUS_TARGET.querySelector("[data-bonus-labels]").innerHTML=bonusLabels(ids)}
  closeSheet();
};
/* ================= INBOX, QUICK ADD, QUICK DONE, SEARCH, DECISIONS, MISSED, SHOP, TREATS ================= */

/* ---------- inbox ---------- */
SCR.inbox=()=>{
  const now=Date.now();
  S.recent=S.recent.filter(r=>now-r.at<15*60e3&&get(r.k,r.id));
  const decs=S.decisions.filter(d=>d.status==="active"&&!d.stageId);
  let h='<h1>Входящие</h1><p class="lead">Неразобранные мысли без срока и быстрый доступ к только что созданному.</p>';
  h+='<form data-form="note" class="row nw" style="margin-top:8px"><input type="text" name="text" placeholder="Записать мысль…" autocomplete="off"><button class="btn primary">Записать</button></form>';
  h+='<h2>Неразобранное <span class="count">'+S.inbox.length+'</span></h2>'+(S.inbox.length?'<div class="list">'+S.inbox.map(n=>'<div class="item"><div class="body"><div class="t">'+esc(n.text)+'</div><div class="meta">'+(n.goalDraft?'Набросок цели · ':'')+short(n.date||today())+'</div>'+
    '<div class="row" style="margin-top:6px">'+[["goal",n.goalDraft?"Выбрать этап цели":"Цель"],["task","Задание"],["habit","Привычка"],!lite()&&["quest","Квест"],["cal","Календарь"],!lite()&&["offer","Бонус"],!lite()&&["treat","Ништяк"],!lite()&&["decision","Решение"]].filter(Boolean).map(([k,l])=>'<button class="btn s" data-act="note-convert" data-id="'+n.id+'" data-k="'+k+'">'+l+'</button>').join("")+'<button class="btn s ghost danger" data-act="note-del" data-id="'+n.id+'">Удалить</button></div></div></div>').join("")+'</div>':'<div class="empty">Всё разобрано.</div>');
  if(!lite())h+='<h2>Решения без этапа <span class="count">'+decs.length+'</span></h2>'+(decs.length?'<div class="list">'+decs.map(decisionMini).join("")+'</div><p class="meta" style="margin-top:6px">Остаются здесь, пока вы не привяжете их к этапу. Также видны в разделе «Принятые решения».</p>':'<div class="empty">Нет.</div>');
  h+='<h2>Недавно созданное <span class="count">'+S.recent.length+'</span></h2>'+(S.recent.length?'<div class="list">'+S.recent.map(r=>{const it=get(r.k,r.id);const left=Math.max(0,15-Math.floor((now-r.at)/60e3));return '<div class="item"><button class="body link" data-act="'+(r.k==="block"?"go":"open")+'" data-s="block" data-k="'+r.k+'" data-id="'+r.id+'"><div class="t">'+esc(it.title||it.name||it.text)+'</div><div class="meta">'+(KIND_L[r.k]||"Блок")+' · уже в своём разделе · ещё '+left+' мин здесь</div></button><button class="btn s" data-act="'+(r.k==="block"?"go":"recent-edit")+'" data-s="block" data-k="'+r.k+'" data-id="'+r.id+'">Изменить</button></div>'}).join("")+'</div>':'<div class="empty">Созданное через быстрое добавление 15 минут остаётся здесь для быстрой правки.</div>');
  return h;
};
FORMS.note=f=>{const t=fv(f,"text");if(!t)return;tx(()=>{S.inbox.unshift({id:uid(),text:t,date:today()})},"Во входящих");setTimeout(()=>{const i=$('[data-form="note"] input');if(i)i.focus()},0)};
ACT["note-del"]=el=>tx(()=>{S.inbox=S.inbox.filter(n=>n.id!==el.dataset.id)},"Удалено");
ACT["note-convert"]=el=>{
  const n=S.inbox.find(x=>x.id===el.dataset.id);const k=el.dataset.k;
  if(k==='goal')captureGoal(n.text,n.id,{blockId:n.blockId||null,ifThen:n.ifThen||'',locs:n.locs||[]});
  else if(["task","habit","quest","cal"].includes(k))editItem(k,null,{title:n.text,locs:n.locs||[]},n.id);
  else if(k==="offer")offerEditor(null,{title:n.text},n.id);
  else if(k==="treat")treatEditor(null,{title:n.text},n.id);
  else if(k==="decision")decisionEditor(null,{text:n.text},n.id);
};
ACT["recent-edit"]=el=>{const k=el.dataset.k;if(["task","habit","quest","cal"].includes(k))editItem(k,get(k,el.dataset.id));else if(k==="offer")offerEditor(get("offer",el.dataset.id));else if(k==="treat")treatEditor(get("treat",el.dataset.id));else if(k==="decision")decisionEditor(get("decision",el.dataset.id))};

/* ---------- universal quick add ---------- */
$("#fab").addEventListener("click",()=>quickAdd(""));
function quickAdd(text){
  const context=creationContext();
  const main=[['task','Задание'],['goal','Цель'],['cal','Событие'],['note','Мысль']],more=[['habit','Привычка'],!lite()&&['quest','Квест'],!lite()&&['decision','Решение'],!lite()&&['offer','Бонус'],!lite()&&['treat','Ништяк']].filter(Boolean);
  openSheet('Быстрое добавление','<form data-form="quick"><input type="text" name="title" value="'+esc(text)+'" placeholder="Что записать?" autocomplete="off" required><label class="f">Что это</label><div data-seg="qkind"><div class="chips">'+main.map(([v,l])=>'<button type="button" class="chip" data-act="quick-kind" data-v="'+v+'" aria-pressed="'+(v==='note')+'">'+l+'</button>').join('')+'</div><details style="margin-top:8px"><summary class="small">Ещё</summary><div class="chips">'+more.map(([v,l])=>'<button type="button" class="chip" data-act="quick-kind" data-v="'+v+'" aria-pressed="false">'+l+'</button>').join('')+'</div></details></div><input type="hidden" name="qkind" value="note">'+
    '<div data-qopts hidden><div class="grid2"><div><label class="f">Блок (можно позже)</label>'+blockSelect('blockId',context.blockId)+'</div><div><label class="f">Этап</label>'+stageSelect('stageId',context.blockId,context.stageId)+'</div></div><div data-quick-date><label class="f">Дата</label><div class="row nw"><input type="date" name="date"><button type="button" class="btn s" data-act="qa-today">Сегодня</button></div></div><label class="tog" data-quick-day><input type="checkbox" name="inDay" checked><span>В Конструктор дня</span></label></div>'+locField(S.loc.tagNew&&currentLoc().id?[currentLoc().id]:[])+'<p class="meta" data-qhint>Мысль без типа попадёт во «Входящие».</p><div class="row" style="margin-top:12px"><button class="btn primary">Сохранить</button><button type="button" class="btn" data-act="qa-full">Заполнить подробно…</button></div></form>');
}
function segBtnsWrap(name,pairs,cur){return '<div class="chips" data-seg="'+name+'">'+pairs.map(([v,l])=>'<button type="button" class="chip" data-act="seg" data-v="'+v+'" aria-pressed="'+(cur===v)+'">'+esc(l)+'</button>').join('')+'</div><input type="hidden" name="'+name+'" value="'+cur+'">'}
ACT['quick-kind']=el=>{const f=el.closest('form');f.querySelectorAll('[data-act="quick-kind"]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));f.elements.qkind.value=el.dataset.v;f.elements.qkind.dispatchEvent(new Event('change',{bubbles:true}))};
document.addEventListener('change',e=>{
  if(e.target.name!=='qkind')return;const f=e.target.form,v=e.target.value;if(!f.querySelector('[data-qopts]'))return;
  f.querySelector('[data-qopts]').hidden=!['task','cal','habit','quest','goal'].includes(v);
  f.querySelector('[data-quick-date]').hidden=!['task','cal'].includes(v);f.querySelector('[data-quick-day]').hidden=v==='goal';
  f.querySelector('[data-qhint]').textContent={note:'Мысль без типа попадёт во «Входящие».',goal:'Цель сохранится в выбранном этапе. Без этапа — наброском во «Входящих».',task:'Задание с разовым расписанием. Остальное можно настроить позже.',habit:'Привычка на каждый день, дневная норма — один подход.',quest:'Квест-счётчик на 10 шагов. Можно изменить в подробной форме.',cal:'Событие на дату, по умолчанию сегодня. Повторы и напоминания — в подробной форме.',offer:'Бонус появится в магазине. Это не покупка.',treat:'Ништяк появится в списке приятного.',decision:'Решение без этапа останется во «Входящих».'}[v];
});
ACT['qa-today']=el=>{el.closest('form').elements.date.value=today()};
ACT['qa-full']=el=>{
  const f=el.closest('form'),k=fv(f,'qkind'),t=fv(f,'title'),preset={...creationContext(),title:t,blockId:fv(f,'blockId')||null,stageId:fv(f,'stageId')||null,locs:readLocs(f),inDay:fv(f,'inDay')},date=fv(f,'date');
  if(k==='note'){FORMS.quick(f);return}closeSheet();
  if(k==='goal'){captureGoal(t,null,preset);return}
  if(['task','habit','quest','cal'].includes(k)){if(k==='cal')preset.date=date||today();if(k==='task')preset.sched={type:'once',days:[],date:date||null};editItem(k,null,preset)}else if(k==='offer')offerEditor(null,{title:t});else if(k==='treat')treatEditor(null,{title:t});else if(k==='decision')decisionEditor(null,{text:t,stageId:preset.stageId});
};
FORMS.quick=f=>{
  const k=fv(f,'qkind'),t=fv(f,'title');if(!t)return;
  const bid=fv(f,'blockId')||null,sid=fv(f,'stageId')||null,date=fv(f,'date')||null,inDay=fv(f,'inDay'),locs=readLocs(f);let goal=null;
  const ok=tx(()=>{
    if(k==='note'){S.inbox.unshift({id:uid(),text:t,date:today(),locs});return 'Мысль во «Входящих»'}
    if(k==='goal'){goal=saveCapturedGoal(t,sid,bid,locs,'');return goal?'Цель создана':'Набросок цели во «Входящих»'}
    let it;
    const p={title:t,blockId:bid,stageId:sid,locs,inDay};
    if(k==='task'){it=newTask({...p,sched:{type:'once',days:[],date}});S.tasks.push(it)}
    if(k==='habit'){it=newHabit(p);S.habits.push(it)}
    if(k==='quest'){it=newQuest(p);S.quests.push(it)}
    if(k==='cal'){it=newCal({...p,date:date||today()});S.cal.push(it)}
    if(k==='offer'){it=newOffer({title:t});S.offers.push(it)}
    if(k==='treat'){it={id:uid(),title:t,cat:'',desc:'',status:'active',created:today()};S.treats.push(it)}
    if(k==='decision'){it=newDecision({text:t,stageId:sid});S.decisions.push(it)}
    if(!it)fail('Выберите тип записи');pushRecent(k,it.id);return 'Создано: '+KIND_L[k].toLowerCase()+'. 15 минут доступно во «Входящих»';
  },m=>m);
  if(ok){closeSheet();if(goal)firstGoalStep(goal)}
};


/* ---------- quick done & search ---------- */
ACT["quick-done"]=()=>openSheet("Быстрое выполнение",quickDoneBody(""),{key:"qd"});
function quickDoneBody(q){
  const ql=q.toLowerCase();const d=today();
  const pool=[...S.tasks.map(x=>["task",x]),...S.habits.map(x=>["habit",x]),...(lite()?[]:S.quests.map(x=>["quest",x])),...S.cal.flatMap(c=>{const due=Cal.due(c,d),o=calNext(c)||calView(c);return (due.length?due:o?[o]:[]).map(v=>['cal',{...c,id:c.id+(Cal.repeats(c)?'@'+v.key:''),_date:v.date}])})]
    .filter(([k,x])=>x.status==="active"&&!(k==="task"&&x.sched.type==="once"&&doneEver("task",x.id))&&!(k==="cal"&&!Cal.repeats(x)&&doneEver("cal",x.id)))
    .filter(([k,x])=>!q||(x.title+" "+(x.tags||[]).join(" ")).toLowerCase().includes(ql)).slice(0,30);
  return '<p class="meta">Сделали что-то вне плана? Найдите существующую запись и отметьте по её правилам. Новая копия не создаётся.</p><input type="search" data-qd-q value="'+esc(q)+'" placeholder="Начните вводить название" autocomplete="off">'+
    '<div class="list" style="margin-top:8px">'+(pool.length?pool.map(([k,x])=>{
      const done=k==="quest"?false:k==="cal"?doneEver(k,x.id):doneOn(k,x.id,d);
      return '<div class="item"><div class="body"><div class="t">'+esc(x.title)+'</div><div class="meta">'+KIND_L[k]+(x._date?' · '+esc(short(x._date)):'')+' · '+esc(originText(x))+'</div></div>'+(done?'<span class="pill good">сегодня отмечено</span>':'<button class="btn s primary" data-act="qd-do" data-r="'+rk(k,x.id)+'">'+(k==="quest"?(x.type==="checklist"?"Шаг":"+1"):"Выполнено")+'</button>')+'</div>'}).join(""):'<div class="empty">Не найдено.</div>')+'</div>'+
    (q?'<div class="row" style="margin-top:10px"><button class="btn" data-act="qd-create">Нет такой записи — создать «'+esc(q)+'»</button></div>':'');
}
document.addEventListener("input",e=>{
  if(e.target.matches("[data-qd-q]")){const v=e.target.value;refreshSheet("qd",()=>quickDoneBody(v));const i=topSheet().querySelector("[data-qd-q]");i.focus();i.setSelectionRange(v.length,v.length)}
  if(e.target.matches("[data-s-q]")){const v=e.target.value;refreshSheet("search",()=>searchBody(v));const i=topSheet().querySelector("[data-s-q]");i.focus();i.setSelectionRange(v.length,v.length)}
});
ACT["qd-do"]=el=>{const [k,id]=pr(el.dataset.r);const q=(topSheet().querySelector("[data-qd-q]")||{}).value||"";
  if(k==="quest"&&get("quest",id).type==="checklist"){closeSheet();openItem("quest",id);return}
  tx(()=>complete(k,id,today()),f=>rewardMsg(f));refreshSheet("qd",()=>quickDoneBody(q))};
ACT["qd-create"]=()=>{const q=(topSheet().querySelector("[data-qd-q]")||{}).value||"";closeSheet();quickAdd(q)};
ACT["search"]=()=>openSheet("Поиск",searchBody(""),{key:"search"});
function searchBody(q){
  const ql=q.toLowerCase();
  const m=(t)=>t&&t.toLowerCase().includes(ql);
  const groups=[
    ["task",S.tasks.filter(x=>x.status!=="archived"&&(m(x.title)||(x.tags||[]).some(m)))],
    ["habit",S.habits.filter(x=>x.status!=="archived"&&(m(x.title)||(x.tags||[]).some(m)))],
    ["quest",S.quests.filter(x=>x.status!=="archived"&&(m(x.title)||(x.tags||[]).some(m)))],
    ["cal",S.cal.filter(x=>x.status!=="archived"&&m(x.title))],
    ["offer",S.offers.filter(x=>x.status==="active"&&(m(x.title)||(x.tags||[]).some(m)))],
    ["treat",S.treats.filter(x=>x.status==="active"&&(m(x.title)||m(x.cat)))],
    ["decision",S.decisions.filter(x=>m(x.text))]
  ];
  return '<input type="search" data-s-q value="'+esc(q)+'" placeholder="Задания, привычки, квесты, календарь, бонусы, ништяки, решения" autocomplete="off">'+
    (q?groups.filter(g=>g[1].length).map(([k,arr])=>'<h2>'+KIND_L[k]+'</h2><div class="card">'+arr.slice(0,8).map(x=>'<div class="mini"><button class="t link" data-act="open" data-k="'+k+'" data-id="'+x.id+'">'+esc(x.title||x.text)+'<div class="meta">'+(k==="offer"?"Цена "+x.price+" · "+USE_L[x.use]:k==="treat"?(x.cat||"ништяк"):k==="decision"?DEC_L[x.status]:esc(originText(x)))+'</div></button></div>').join("")+'</div>').join("")||'<p class="empty" style="margin-top:8px">Ничего не найдено.</p>':'<p class="meta" style="margin-top:8px">Результат открывает действия своего типа: выполнить, купить, посмотреть, открыть событие.</p>');
}

/* ---------- decisions & Цена слова ---------- */
const DEC_L={active:"Активно",done:"Выполнено",failed:"Не выполнено",cancelled:"Отменено"};
function cdText(deadline){
  const ms=new Date(deadline).getTime()-Date.now()-(META.space==="demo"?(META.offset||0)*864e5:0);
  if(ms<=0)return {t:"срок истёк",cls:"cd-bad"};
  const s=Math.floor(ms/1000),dd=Math.floor(s/86400),hh=Math.floor(s%86400/3600),mm=Math.floor(s%3600/60),ss=s%60;
  return {t:dd+" дн. "+pad(hh)+":"+pad(mm)+":"+pad(ss),cls:ms<=3*864e5?"cd-warn":""};
}
function decisionMini(d){
  const st=d.stageId?get("stage",d.stageId):null;
  let dl="";
  if(d.deadline&&d.status==="active"){const c=cdText(d.deadline);dl='<div class="small '+c.cls+'">До '+esc(d.deadline.replace("T"," "))+' · <span class="countdown" data-cd="'+d.deadline+'">'+c.t+'</span></div>'}
  return '<button class="item link" data-act="decision-open" data-id="'+d.id+'"><div class="body"><div class="t">'+esc(d.text)+'</div><div class="meta">'+(st?esc(originText({blockId:st.blockId,stageId:st.id})):"Во «Входящих», без этапа")+((d.priceC||d.priceX)?' · Цена слова: '+d.priceC+' ● / '+d.priceX+' XP':'')+'</div>'+dl+'</div><span class="pill '+({active:"acc",done:"good",failed:"bad",cancelled:""}[d.status])+'">'+DEC_L[d.status]+'</span></button>';
}
SCR.decisions=p=>{
  curScr().title="Принятые решения";
  const act=S.decisions.filter(d=>d.status==="active").sort((a,b)=>(a.deadline||"9").localeCompare(b.deadline||"9"));
  const hist=S.decisions.filter(d=>d.status!=="active").sort((a,b)=>(b.closedTs||0)-(a.closedTs||0));
  const all=!!S.ui.decAll;
  return '<h1>Принятые решения</h1><p class="lead">Зафиксированные выборы: не задания с галочкой, а слово, данное себе. Исход отмечаете вы.</p>'+
    '<div class="row" style="margin:8px 0"><button class="btn primary" data-act="decision-new">+ Принять решение</button></div>'+
    '<h2>Активные <span class="count">'+act.length+'</span></h2>'+(act.length?'<div class="list">'+act.map(decisionMini).join("")+'</div>':'<div class="empty">Активных решений нет.</div>')+
    '<h2>История <span class="count">'+hist.length+'</span></h2>'+(hist.length?'<div class="list">'+(all?hist:hist.slice(0,10)).map(decisionMini).join("")+'</div>'+(hist.length>10?'<button class="btn ghost s" data-act="dec-all">'+(all?'Свернуть':'Показать всё')+'</button>':''):'<div class="empty">Пока пусто.</div>');
};
ACT["dec-all"]=()=>{S.ui.decAll=!S.ui.decAll;render()};
ACT["decision-new"]=el=>decisionEditor(null,{stageId:el.dataset.stage||null});
function decisionEditor(d,preset,fromNote){
  const isNew=!d;d=d||newDecision(preset||{});
  const st=d.stageId?get("stage",d.stageId):null;
  const bid=st?st.blockId:"";
  const [date,time]=(d.deadline||"T").split("T");
  openSheet(isNew?"Принять решение":"Изменить решение",'<form data-form="decision" data-id="'+(isNew?"":d.id)+'" data-note="'+(fromNote||"")+'">'+
    '<label class="f">Решение</label><textarea name="text" required placeholder="Например: до конца месяца занимаюсь выбранным курсом и не переключаюсь">'+esc(d.text)+'</textarea>'+
    '<div class="grid2"><div><label class="f">Блок</label>'+blockSelect("blockId",bid)+'</div><div><label class="f">Этап</label>'+stageSelect("stageId",bid,d.stageId)+'</div></div>'+
    '<p class="meta">Без этапа решение останется во «Входящих» до привязки.</p>'+
    '<label class="f">Срок (необязательно): дата и точное время</label><div class="grid2"><input type="date" name="ddate" value="'+(date||"")+'"><input type="time" name="dtime" value="'+(time||"")+'"></div>'+
    '<label class="f">Цена слова (необязательно)</label><div class="grid2"><div><input type="number" min="0" name="priceC" value="'+d.priceC+'"><div class="meta">монет</div></div><div><input type="number" min="0" name="priceX" value="'+d.priceX+'"><div class="meta">XP</div></div></div>'+
    '<p class="meta">Цена списывается один раз, только если вы сами отметите «Не выполнено». Только она может увести монеты и опыт в минус. Срок сам ничего не завершает и не штрафует.</p>'+
    '<div class="row" style="margin-top:12px"><button class="btn primary">'+(isNew?'Принять решение':'Сохранить изменения')+'</button><button type="button" class="btn" data-act="sheet-close">Отмена</button></div></form>');
}
FORMS.decision=async f=>{
  const id=f.dataset.id;
  if(id){const y=await ask({title:"Изменить принятое решение?",text:"Вы меняете условия обещания, которое уже дали себе. Проверьте текст, срок и Цену слова. Редактирование не списывает и не начисляет монеты.",ok:"Подтвердить изменения"});if(!y)return}
  const ok=tx(()=>{
    const text=fv(f,"text");if(!text)fail("Введите решение");
    const dd=fv(f,"ddate"),tt=fv(f,"dtime");
    const d=id?get("decision",id):newDecision();
    const ns=fv(f,"stageId")||null;
    if(ns!==d.stageId)d.linkedAt=today();
    Object.assign(d,{text,stageId:ns,deadline:dd?dd+"T"+(tt||"23:59"):null,priceC:Math.max(0,fnum(f,"priceC")),priceX:Math.max(0,fnum(f,"priceX"))});
    if(!id){S.decisions.push(d);pushRecent("decision",d.id);if(f.dataset.note)S.inbox=S.inbox.filter(n=>n.id!==f.dataset.note)}
    return d;
  },d=>d.stageId?"Решение сохранено":"Решение без этапа: оно во «Входящих» до привязки");
  if(ok)closeAllSheets();
};
ACT["decision-open"]=el=>{closeAllSheets();openDecision(el.dataset.id)};
function openDecision(id){
  const d=get("decision",id);
  const st=d.stageId?get("stage",d.stageId):null;
  let h='<h3 style="font-size:18px">'+esc(d.text)+'</h3><dl class="kv"><dt>Статус</dt><dd>'+DEC_L[d.status]+(d.closedAt?' · '+short(d.closedAt):'')+'</dd><dt>Этап</dt><dd>'+(st?esc(originText({blockId:st.blockId,stageId:st.id}))+(d.linkedAt?' · с '+short(d.linkedAt):''):'Во «Входящих»')+'</dd><dt>Принято</dt><dd>'+short(d.created)+'</dd>';
  if(d.deadline){const c=cdText(d.deadline);h+='<dt>Срок</dt><dd class="'+(d.status==="active"?c.cls:"")+'">'+esc(d.deadline.replace("T"," "))+(d.status==="active"?' · <span class="countdown" data-cd="'+d.deadline+'">'+c.t+'</span>':'')+'</dd>'}
  h+='<dt>Цена слова</dt><dd>'+(d.priceC||d.priceX?d.priceC+' монет и '+d.priceX+' XP':'не назначена')+'</dd>';
  if(d.status==="failed")h+='<dt>Списано</dt><dd>'+d.paidC+' монет и '+d.paidX+' XP</dd>';
  h+='</dl><div class="list" style="margin-top:12px">';
  if(d.status==="active")h+='<button class="btn block primary" data-act="dec-out" data-id="'+id+'" data-v="done">Выполнено: слово сдержано</button><button class="btn block danger" data-act="dec-out" data-id="'+id+'" data-v="failed">Не выполнено'+((d.priceC||d.priceX)?': применить Цену слова':'')+'</button><button class="btn block" data-act="dec-out" data-id="'+id+'" data-v="cancelled">Отменить решение (без штрафа)</button><button class="btn block" data-act="dec-edit" data-id="'+id+'">Изменить / перенести в другой этап</button>';
  else h+='<button class="btn block" data-act="dec-undo" data-id="'+id+'">'+(d.status==="failed"?'Отменить ошибочную отметку и вернуть списанное':'Вернуть в активные')+'</button>';
  h+='</div>';
  openSheet("Принятое решение",h,{key:"dec"});
}
ACT["dec-edit"]=el=>{closeSheet();decisionEditor(get("decision",el.dataset.id))};
ACT["dec-out"]=async el=>{
  const d=get("decision",el.dataset.id);const v=el.dataset.v;
  const texts={done:["Слово сдержано?","Решение уйдёт в историю со статусом «Выполнено»."],failed:["Отметить «Не выполнено»?",(d.priceC||d.priceX)?"Будет списано "+d.priceC+" монет и "+d.priceX+" XP. Балансы могут уйти в минус. Ошибочную отметку можно отменить.":"Цена слова не назначена, списаний не будет."],cancelled:["Отменить решение?","Осознанный отказ из-за изменившихся обстоятельств. Без штрафа, запись уйдёт в историю."]};
  const y=await ask({title:texts[v][0],text:texts[v][1],ok:"Подтвердить",danger:v==="failed"});
  if(!y)return;closeAllSheets();
  tx(()=>{
    if(d.status!=="active")fail("Решение уже не активно");
    d.status=v;d.closedAt=today();d.closedTs=Date.now();
    if(v==="failed"){d.paidC=d.priceC;d.paidX=d.priceX;if(d.priceC||d.priceX)d.penalty=ledger("penalty",-d.priceC,-d.priceX,"Цена слова: "+d.text,"decision:"+d.id)}
  },{done:"Слово сдержано. В истории",failed:"Отмечено «Не выполнено»",cancelled:"Решение отменено без штрафа"}[v]);
};
ACT["dec-undo"]=async el=>{
  const d=get("decision",el.dataset.id);
  const y=await ask({title:d.status==="failed"?"Отменить отметку нарушения?":"Вернуть решение в активные?",text:d.status==="failed"?"Вернём ровно списанные "+d.paidC+" монет и "+d.paidX+" XP. Решение снова станет активным.":"Решение снова станет активным с прежней привязкой.",ok:"Вернуть"});
  if(!y)return;closeAllSheets();
  tx(()=>{
    if(d.status==="active")fail("Уже активно");
    if(d.status==="failed"&&d.penalty){ledger("compensation",d.paidC,d.paidX,"Возврат Цены слова: "+d.text,"decision:"+d.id);d.penalty=null}
    d.status="active";d.closedAt=null;d.paidC=0;d.paidX=0;
  },"Решение снова активно");
};

/* ---------- missed ---------- */
SCR.missed=p=>{
  curScr().title="Невыполненные";
  const arch=!!S.ui.missArch;const cat=S.ui.missCat||"";
  const list=S.misses.filter(m=>m.status===(arch?"archived":"active")&&(!cat||m.kind===cat)).sort((a,b)=>b.date.localeCompare(a.date));
  const sel=S.ui.missSel||(S.ui.missSel=[]);
  const selIn=list.filter(m=>sel.includes(m.id));
  let h='<h1>Невыполненные</h1><p class="lead">Каждый пропуск запланированного — отдельный факт со своей датой. Пропуск не штрафует и не обнуляет прогресс.</p>';
  h+='<div class="seg" style="margin-top:6px">'+[["0","Пропуски"],["1","Архив"]].map(([v,l])=>'<button data-act="miss-arch" data-v="'+v+'" aria-pressed="'+(arch===(v==="1"))+'">'+l+'</button>').join("")+'</div>';
  h+='<div class="chips" style="margin-top:8px">'+[["","Все"],["task","Задания"],["habit","Привычки"],!lite()&&["quest","Квесты"],["cal","Календарь"]].filter(Boolean).map(([v,l])=>'<button class="chip" data-act="miss-cat" data-v="'+v+'" aria-pressed="'+(cat===v)+'">'+l+' ('+S.misses.filter(m=>m.status===(arch?"archived":"active")&&(!v||m.kind===v)).length+')</button>').join("")+'</div>';
  if(list.length){
    h+='<div class="row" style="margin-top:10px"><label class="tog" style="margin:0"><input type="checkbox" data-act="miss-all" '+(selIn.length===list.length?'checked':'')+'><span>Выбрать все'+(cat?' в фильтре':'')+' ('+list.length+')</span></label><span class="grow"></span>'+
      (arch?'<button class="btn s" data-act="miss-bulk" data-v="restore" '+(selIn.length?'':'disabled')+'>Восстановить выбранные</button><button class="btn s danger" data-act="miss-bulk" data-v="delete" '+(selIn.length?'':'disabled')+'>Удалить выбранные</button>':'<button class="btn s" data-act="miss-bulk" data-v="archive" '+(selIn.length?'':'disabled')+'>В архив выбранные ('+selIn.length+')</button>')+'</div>';
    h+='<div class="list" style="margin-top:8px">'+list.map(m=>{
      const it=get(m.kind,m.ref);
      let acts="";
      if(!arch&&it&&it.status==="active"){
        if(m.kind==="habit")acts=doneOn("habit",m.ref,today())?'<span class="pill good">сегодня выполнено</span>':'<button class="btn s" data-act="miss-do" data-id="'+m.id+'">Выполнить сегодня</button>';
        else if(m.kind==="quest")acts='<button class="btn s" data-act="miss-do" data-id="'+m.id+'">Шаг сегодня</button>';
        else if(m.kind==="cal"? !calDone(it,m.occurrence||m.date):!(m.kind==="task"&&it.sched.type!=="once")&&!doneEver(m.kind,m.ref))acts='<button class="btn s" data-act="miss-move" data-id="'+m.id+'">Перенести</button><button class="btn s" data-act="miss-do" data-id="'+m.id+'">Выполнить сейчас</button>';
        else if(m.kind==="task")acts=doneOn("task",m.ref,today())?'<span class="pill good">сегодня выполнено</span>':'<button class="btn s" data-act="miss-do" data-id="'+m.id+'">Выполнить сегодня</button>';
      }
      return '<div class="item"><input type="checkbox" data-act="miss-sel" data-id="'+m.id+'" '+(sel.includes(m.id)?'checked':'')+' aria-label="Выбрать" style="width:18px;height:18px;accent-color:var(--accent)"><div class="body"><div class="t">'+esc(it?it.title:m.title)+'</div><div class="meta">'+esc(KIND_L[m.kind]||m.kind)+' · пропуск '+esc(human(m.date))+(m.note?' · '+esc(m.note):'')+(it?' · '+esc(originText(it)):' · запись удалена')+'</div><div class="row" style="margin-top:4px">'+acts+'</div></div></div>';
    }).join("")+'</div>';
  }else h+='<p class="empty" style="margin-top:12px">'+(arch?'Архив пуст.':'Пропусков нет.')+'</p>';
  h+='<p class="meta" style="margin-top:12px">Архив и удаление управляют записями о пропусках, а не самими заданиями, привычками и квестами. Выполнение засчитывается сегодняшней датой, старый пропуск остаётся фактом.</p>';
  return h;
};
ACT["miss-arch"]=el=>{S.ui.missArch=el.dataset.v==="1";S.ui.missSel=[];render()};
ACT["miss-cat"]=el=>{S.ui.missCat=el.dataset.v;render()};
ACT["miss-sel"]=el=>{const s=S.ui.missSel||(S.ui.missSel=[]);const i=s.indexOf(el.dataset.id);if(i>=0)s.splice(i,1);else s.push(el.dataset.id);render()};
ACT["miss-all"]=el=>{
  const arch=!!S.ui.missArch,cat=S.ui.missCat||"";
  const ids=S.misses.filter(m=>m.status===(arch?"archived":"active")&&(!cat||m.kind===cat)).map(m=>m.id);
  S.ui.missSel=el.checked?ids:[];render();
};
ACT["miss-bulk"]=async el=>{
  const v=el.dataset.v;const ids=(S.ui.missSel||[]).filter(id=>S.misses.some(m=>m.id===id&&m.status===(S.ui.missArch?"archived":"active")&&(!S.ui.missCat||m.kind===S.ui.missCat)));
  if(!ids.length)return;
  if(v==="delete"){const y=await ask({title:"Удалить навсегда?",text:"Будет удалено записей о пропусках: "+ids.length+". Задания, привычки и их прогресс не затрагиваются.",ok:"Удалить",danger:true});if(!y)return}
  tx(()=>{
    if(v==="delete")S.misses=S.misses.filter(m=>!ids.includes(m.id));
    else S.misses.forEach(m=>{if(ids.includes(m.id))m.status=v==="archive"?"archived":"active"});
    S.ui.missSel=[];
  },{archive:"Перенесено в архив: ",restore:"Восстановлено с прежней датой: ",delete:"Удалено: "}[v]+ids.length);
};
ACT["miss-do"]=el=>{
  const m=S.misses.find(x=>x.id===el.dataset.id);
  if(m.kind==="quest"&&get("quest",m.ref).type==="checklist"){openItem("quest",m.ref);return}
  tx(()=>{const f=complete(m.kind,m.ref,today(),m.kind==="cal"?{occurrence:m.occurrence||m.date}:{});m.note="выполнено позже, "+short(today());return f},f=>rewardMsg(f)+". Пропуск остаётся фактом");
};
ACT["miss-move"]=async el=>{
  const m=S.misses.find(x=>x.id===el.dataset.id);
  if(m.kind==="cal"){calendarMove(get("cal",m.ref),m.occurrence||m.date,m.id);return}
  const v=await ask({title:"Перенести на дату",text:"Введите дату в формате ГГГГ-ММ-ДД или оставьте пустым для сегодняшнего дня.",input:today(),ok:"Перенести"});
  if(v===false)return;const d=v||today();
  if(!Cal.valid(d)){toast("Неверная дата");return}
  tx(()=>{const it=get(m.kind,m.ref);it.sched.date=d;it.inDay=true;m.note="перенесено на "+short(d)},"Перенесено на "+short(d)+". Запись о пропуске сохранена");
};

/* ---------- shop & bonuses ---------- */
SCR.shop=()=>{
  curScr().title="Магазин бонусов";
  const q=(S.ui.q_offer||"").toLowerCase(),cat=S.ui.cat_offer||"";
  const offers=S.offers.filter(o=>o.status==="active"&&(!cat||o.cat===cat)&&(!q||(o.title+" "+(o.tags||[]).join(" ")+" "+o.cat).toLowerCase().includes(q)));
  const cats=[...new Set(S.offers.map(o=>o.cat).filter(Boolean))];
  const c=coins();
  let h='<h1>Магазин бонусов</h1><p class="lead">Приятные награды: купить за монеты или получить за выполнение назначенного условия.</p>';
  h+='<div class="row" style="margin:6px 0"><span class="pill coin">Баланс: '+num(c)+'</span><button class="btn s" data-act="go" data-s="mybonuses">Мои бонусы ('+S.insts.filter(i=>i.status==="owned").length+')</button></div>';
  h+='<div class="row nw"><input type="search" placeholder="Поиск по названию и тегам" value="'+esc(S.ui.q_offer||"")+'" data-list-q="offer"><button class="btn primary" data-act="offer-new">+ Бонус</button></div>';
  if(cats.length)h+='<div class="chips" style="margin-top:8px">'+[["","Все"],...cats.map(x=>[x,x])].map(([v,l])=>'<button class="chip" data-act="list-cat" data-k="offer" data-v="'+esc(v)+'" aria-pressed="'+(cat===v)+'">'+esc(l)+'</button>').join("")+'</div>';
  h+='<div class="list" style="margin-top:10px">'+(offers.length?offers.map(o=>{
    const res=S.insts.filter(i=>i.offerId===o.id&&i.status==="reserved");
    return '<div class="card"><div class="between"><button class="link" data-act="open" data-k="offer" data-id="'+o.id+'"><b>'+esc(o.title)+'</b></button><span class="rw">'+o.price+' ●</span></div>'+
      '<div class="meta">'+USE_L[o.use]+(o.use==="limited"?' · '+o.limit+' '+plural(o.limit,"использование","использования","использований"):'')+(o.cat?' · '+esc(o.cat):'')+((o.tags||[]).length?' · #'+esc(o.tags.join(" #")):'')+'</div>'+
      (o.desc?'<div class="small">'+esc(o.desc)+'</div>':'')+
      (res.length?'<div class="small" style="margin-top:4px;color:var(--warn)">В резерве: '+res.map(i=>'награда за '+esc(condText(i.cond))+' <button class="btn ghost s" data-act="unreserve" data-id="'+i.id+'">Снять резерв</button>').join("; ")+'</div>':'')+
      '<div class="row" style="margin-top:6px"><button class="btn s primary" data-act="buy" data-id="'+o.id+'" '+(c<o.price?'disabled':'')+'>'+(res.length?'Купить всё равно':'Купить')+'</button><button class="btn s" data-act="offer-edit" data-id="'+o.id+'">Изменить</button><button class="btn s ghost danger" data-act="offer-archive" data-id="'+o.id+'">В архив</button></div></div>';
  }).join(""):'<div class="empty">Бонусов нет. Добавьте то, что вас порадует.</div>')+'</div>';
  const purch=S.insts.filter(i=>i.source==="purchase").sort((a,b)=>(b.ts||0)-(a.ts||0));
  if(purch.length)h+='<h2>История покупок</h2><div class="card">'+(S.ui.buyAll?purch:purch.slice(0,10)).map(i=>'<div class="mini"><div class="t">'+esc(i.title)+'<div class="meta">'+short(i.date)+' · '+({owned:"получен",refunded:"возвращён",spent:"использован"}[i.status]||i.status)+'</div></div><span class="rw">−'+i.paid+'</span></div>').join("")+(purch.length>10?'<button class="btn ghost s" data-act="buy-all">'+(S.ui.buyAll?'Свернуть':'Показать всё')+'</button>':'')+'</div>';
  return h;
};
ACT["buy-all"]=()=>{S.ui.buyAll=!S.ui.buyAll;render()};
function condText(c){if(!c)return "";const it=get(c.k,c.id);const L={task:"задание",habit:"цель привычки",quest:"квест",stage:"этап"};return (L[c.k]||"")+" «"+(it?(it.title||it.name):"?")+"»"}
ACT["buy"]=async el=>{
  const o=get("offer",el.dataset.id);
  const y=await ask({title:"Купить «"+o.title+"»?",text:"Спишется "+o.price+" монет. Купленный бонус можно вернуть до первого использования.",ok:"Купить"});
  if(!y)return;
  tx(()=>{if(coins()<o.price)fail("Не хватает монет");const l=ledger("spend",-o.price,0,"Покупка: "+o.title,"offer:"+o.id);S.insts.push({id:uid(),offerId:o.id,title:o.title,use:o.use,limit:o.use==="once"?1:o.limit||1,used:0,uses:[],source:"purchase",paid:o.price,status:"owned",date:today(),ts:Date.now(),ledger:l})},"Куплено: "+o.title);
};
ACT["unreserve"]=async el=>{
  const i=get("inst",el.dataset.id);
  const y=await ask({title:"Снять резерв?",text:"Бонус перестанет быть наградой за "+condText(i.cond)+". Назначение будет отменено.",ok:"Снять резерв",danger:true});
  if(!y)return;
  tx(()=>{const it=get(i.cond.k,i.cond.id);if(it){const t=i.cond.k==="habit"?it.goal:it;t.bonus=(t.bonus||[]).filter(o=>o!==i.offerId)}S.insts=S.insts.filter(x=>x.id!==i.id)},"Резерв снят");
};
ACT["offer-new"]=()=>offerEditor(null);
ACT["offer-edit"]=el=>offerEditor(get("offer",el.dataset.id));
function openOffer(id){offerEditor(get("offer",id))}
function offerEditor(o,preset,fromNote){
  const isNew=!o;o=o||newOffer(preset||{});
  openSheet(isNew?"Новый бонус":"Бонус в магазине",'<form data-form="offer" data-id="'+(isNew?"":o.id)+'" data-note="'+(fromNote||"")+'"><label class="f">Название</label><input type="text" name="title" value="'+esc(o.title)+'" required>'+
    '<label class="f">Описание</label><textarea name="desc">'+esc(o.desc)+'</textarea><label class="f">Цена, монет</label><input type="number" min="0" name="price" value="'+o.price+'" style="max-width:140px">'+
    '<label class="f">Тип по использованию</label><select name="use">'+opt("once","Одноразовый",o.use)+opt("unlimited","Безлимитный",o.use)+opt("limited","С ограниченным числом использований",o.use)+'</select>'+
    '<div data-limit '+(o.use==="limited"?'':'hidden')+'><label class="f">Сколько использований</label><input type="number" min="1" name="limit" value="'+(o.limit||3)+'" style="max-width:140px"></div>'+catTagFields(o)+
    (isNew?'':'<p class="meta">Изменения влияют на будущие покупки и назначения. Уже полученные экземпляры не меняются.</p>')+
    '<div class="row" style="margin-top:12px"><button class="btn primary">Сохранить</button></div></form>');
}
FORMS.offer=f=>{const ok=tx(()=>{const t=fv(f,"title");if(!t)fail("Введите название");const o=get("offer",f.dataset.id)||newOffer();Object.assign(o,{title:t,desc:fv(f,"desc"),price:Math.max(0,fnum(f,"price")),use:fv(f,"use"),limit:fv(f,"use")==="once"?1:Math.max(1,fnum(f,"limit",1)),cat:fv(f,"cat"),tags:readTags(f)});if(!f.dataset.id){S.offers.push(o);pushRecent("offer",o.id);if(f.dataset.note)S.inbox=S.inbox.filter(n=>n.id!==f.dataset.note)}},"Сохранено");if(ok)closeSheet()};
ACT["offer-archive"]=async el=>{const y=await ask({title:"Убрать бонус из магазина в архив?",text:"Полученные экземпляры и резервы сохранятся.",ok:"В архив"});if(y)tx(()=>{get("offer",el.dataset.id).status="archived"},"В архиве")};

SCR.mybonuses=()=>{
  curScr().title="Мои бонусы";
  const own=S.insts.filter(i=>i.status==="owned");
  const res=S.insts.filter(i=>i.status==="reserved");
  const used=S.insts.filter(i=>i.status==="spent");
  const row=i=>'<div class="card"><div class="between"><b>'+esc(i.title)+'</b><span class="pill">'+USE_L[i.use]+(i.use==="limited"?' · осталось '+(i.limit-i.used):'')+(i.use==="unlimited"&&i.used?' · использован '+i.used:'')+'</span></div>'+
    '<div class="meta">'+(i.source==="purchase"?'Куплен '+short(i.date)+' за '+i.paid:'Получен '+short(i.date)+' за '+esc(condText(i.cond)))+'</div>'+
    (i.uses.length?'<div class="meta">Использования: '+i.uses.map(short).join(", ")+'</div>':'')+
    (i.status==="owned"?'<div class="row" style="margin-top:6px"><button class="btn s primary" data-act="inst-use" data-id="'+i.id+'">Использовать</button>'+(i.source==="purchase"&&i.used===0?'<button class="btn s" data-act="inst-refund" data-id="'+i.id+'">Вернуть (+'+i.paid+')</button>':'')+'<button class="btn s ghost" data-act="inst-edit" data-id="'+i.id+'">Изменить экземпляр</button></div>':'')+'</div>';
  return '<h1>Мои бонусы</h1><p class="lead">Купленные и полученные экземпляры. У каждого свои условия и история.</p>'+
    '<h2>Доступны <span class="count">'+own.length+'</span></h2>'+(own.length?'<div class="list">'+own.map(row).join("")+'</div>':'<div class="empty">Нет доступных бонусов.</div>')+
    '<h2>Обещаны (в резерве) <span class="count">'+res.length+'</span></h2>'+(res.length?'<div class="list">'+res.map(i=>'<div class="card"><b>'+esc(i.title)+'</b><div class="meta">Награда за '+esc(condText(i.cond))+'</div></div>').join("")+'</div>':'<div class="empty">Нет.</div>')+
    '<h2>Использованы <span class="count">'+used.length+'</span></h2>'+(used.length?'<div class="list">'+used.slice(-10).reverse().map(row).join("")+'</div>':'<div class="empty">Нет.</div>');
};
ACT["inst-use"]=el=>tx(()=>{const i=get("inst",el.dataset.id);if(i.status!=="owned")fail("Бонус недоступен");if(i.use==="once"&&i.used)fail("Одноразовый бонус уже использован");i.used++;i.uses.push(today());if(i.use==="once"||i.use!=="unlimited"&&i.used>=i.limit)i.status="spent"},"Приятного! Использование записано");
ACT["inst-refund"]=async el=>{const i=get("inst",el.dataset.id);const y=await ask({title:"Вернуть «"+i.title+"»?",text:"Вернётся фактически уплаченная сумма: "+i.paid+" монет.",ok:"Вернуть"});if(y)tx(()=>{if(i.source!=="purchase"||i.status!=="owned"||i.used>0)fail("Вернуть можно только доступную покупку до первого использования");i.status="refunded";ledger("refund",i.paid,0,"Возврат: "+i.title,"inst:"+i.id)},"Возвращено "+i.paid+" монет")};
ACT["inst-edit"]=el=>{const i=get("inst",el.dataset.id);openSheet("Экземпляр бонуса",'<form data-form="inst" data-id="'+i.id+'"><label class="f">Название</label><input type="text" name="title" value="'+esc(i.title)+'"><label class="f">Тип</label><select name="use">'+opt("once","Одноразовый",i.use)+opt("unlimited","Безлимитный",i.use)+opt("limited","Ограниченный",i.use)+'</select><div data-limit '+(i.use==="limited"?'':'hidden')+'><label class="f">Всего использований</label><input type="number" min="1" name="limit" value="'+i.limit+'"></div><p class="meta">Меняется только этот экземпляр, не предложение в магазине.</p><div class="row" style="margin-top:12px"><button class="btn primary">Сохранить</button></div></form>')};
FORMS.inst=f=>{if(tx(()=>{const i=get("inst",f.dataset.id);if(!["owned","spent"].includes(i.status))fail("Этот экземпляр нельзя изменить");i.title=fv(f,"title")||i.title;i.use=fv(f,"use");i.limit=i.use==="once"?1:Math.max(1,fnum(f,"limit",1));if(i.use!=="unlimited"&&i.used>=i.limit)i.status="spent";else if(i.status==="spent")i.status="owned"},"Экземпляр изменён"))closeSheet()};

/* ---------- treats (ништяки) ---------- */
SCR.treats=()=>{
  curScr().title="Ништяки";
  const arch=!!S.ui.treatArch;const q=(S.ui.q_treat||"").toLowerCase(),cat=S.ui.cat_treat||"";
  const cats=[...new Set(S.treats.map(t=>t.cat).filter(Boolean))];
  const list=S.treats.filter(t=>t.status===(arch?"archived":"active")&&(!cat||t.cat===cat)&&(!q||(t.title+" "+t.cat).toLowerCase().includes(q)));
  return '<h1>Ништяки</h1><p class="lead">Простой список приятного. Бесплатно, многоразово, без счётчиков.</p>'+
    '<div class="seg" style="margin-top:6px">'+[["0","Список"],["1","Архив"]].map(([v,l])=>'<button data-act="treat-arch" data-v="'+v+'" aria-pressed="'+(arch===(v==="1"))+'">'+l+'</button>').join("")+'</div>'+
    '<div class="row nw" style="margin-top:8px"><input type="search" placeholder="Поиск" value="'+esc(S.ui.q_treat||"")+'" data-list-q="treat"><button class="btn primary" data-act="treat-new">+ Ништяк</button></div>'+
    (cats.length?'<div class="chips" style="margin-top:8px">'+[["","Все"],...cats.map(x=>[x,x])].map(([v,l])=>'<button class="chip" data-act="list-cat" data-k="treat" data-v="'+esc(v)+'" aria-pressed="'+(cat===v)+'">'+esc(l)+'</button>').join("")+'</div>':'')+
    '<div class="list" style="margin-top:10px">'+(list.length?list.map(t=>'<div class="item"><button class="body link" data-act="treat-edit" data-id="'+t.id+'"><div class="t">'+esc(t.title)+'</div><div class="meta">'+esc(t.cat||"без категории")+(t.desc?' · '+esc(t.desc):'')+'</div></button>'+
      (arch?'<button class="btn s" data-act="treat-restore" data-id="'+t.id+'">Восстановить</button><button class="btn s danger" data-act="treat-del" data-id="'+t.id+'">Удалить</button>':'<button class="btn s ghost" data-act="treat-archive" data-id="'+t.id+'">В архив</button>')+'</div>').join(""):'<div class="empty">'+(arch?'Архив пуст.':'Добавьте маленькие радости: прогулка, музыка, звонок другу.')+'</div>')+'</div>';
};
ACT["treat-arch"]=el=>{S.ui.treatArch=el.dataset.v==="1";render()};
ACT["treat-new"]=()=>treatEditor(null);
ACT["treat-edit"]=el=>treatEditor(get("treat",el.dataset.id));
function treatEditor(t,preset,fromNote){
  const isNew=!t;t=t||Object.assign({title:"",cat:"",desc:""},preset||{});
  openSheet(isNew?"Новый ништяк":"Ништяк",'<form data-form="treat" data-id="'+(isNew?"":t.id)+'" data-note="'+(fromNote||"")+'"><label class="f">Что порадует</label><input type="text" name="title" value="'+esc(t.title)+'" required><label class="f">Категория</label><input type="text" name="cat" value="'+esc(t.cat)+'" placeholder="Например: природа, музыка"><label class="f">Описание</label><textarea name="desc">'+esc(t.desc)+'</textarea><div class="row" style="margin-top:12px"><button class="btn primary">Сохранить</button></div></form>');
}
FORMS.treat=f=>{const ok=tx(()=>{const t=fv(f,"title");if(!t)fail("Введите название");let x=get("treat",f.dataset.id);if(x)Object.assign(x,{title:t,cat:fv(f,"cat"),desc:fv(f,"desc")});else{x={id:uid(),title:t,cat:fv(f,"cat"),desc:fv(f,"desc"),status:"active",created:today()};S.treats.push(x);pushRecent("treat",x.id);if(f.dataset.note)S.inbox=S.inbox.filter(n=>n.id!==f.dataset.note)}},"Сохранено");if(ok)closeSheet()};
ACT["treat-archive"]=el=>tx(()=>{get("treat",el.dataset.id).status="archived"},"В архиве");
ACT["treat-restore"]=el=>tx(()=>{get("treat",el.dataset.id).status="active"},"Восстановлено");
ACT["treat-del"]=async el=>{if(await ask({title:"Удалить навсегда?",ok:"Удалить",danger:true}))tx(()=>{S.treats=S.treats.filter(t=>t.id!==el.dataset.id)},"Удалено")};
/* ================= DEMO: fictional life ================= */
function makeDemo(){
  const prevS=S;
  S=baseState("demo");
  const t=today(),d=n=>addDays(t,n),created=d(-12);
  const B=i=>S.blocks[i];
  // base blocks content
  Object.assign(B(1),{meaning:"Хочу, чтобы сил хватало до вечера и спина не болела",priority:"high",intensity:"bal",fact:"Сижу весь день за компьютером, сплю по 6 часов, иногда болит спина",optimal:"Энергии хватает до вечера, сон 7+ часов, спина не беспокоит",unknown:"Возможно, спорт станет чем-то большим, чем просто здоровье",lvmg:"Пробежать марафон в 50 лет и чувствовать себя лучше, чем в 30"});
  Object.assign(B(3),{meaning:"Спокойствие за завтрашний день",priority:"high",intensity:"aggr",fact:"Откладываю нерегулярно, подушки нет",optimal:"Подушка на 6 месяцев и понятный бюджет"});
  Object.assign(B(4),{meaning:"Близкие люди рядом",priority:"mid",intensity:"light",fact:"С друзьями вижусь раз в месяц"});
  Object.assign(B(2),{priority:"low",intensity:"light"});
  const g={id:"guitar",name:"Гитара",icon:"🎸",meaning:"Хочу вернуться к музыке и играть любимые песни для себя",priority:"mid",intensity:"bal",secs:secsFrom(PRESETS.simple.secs),preset:"simple",base:false,status:"active",order:8,currentStageId:null,
    fact:"Инструмент есть, знаю два аккорда, регулярно не занимаюсь",optimal:"Самостоятельно разбирать и играть любимые песни",unknown:"",lvmg:""};
  S.blocks.push(g);
  S.achievements.push({id:uid(),blockId:"guitar",title:"Месяц занимался пять лет назад и бросил",period:"2021",text:"Тогда не было понятного плана: не знал, что учить дальше."},
    {id:uid(),blockId:"guitar",title:"Сам выучил короткую мелодию",period:"2022",text:""});
  const st=(id,blockId,order,name,o)=>Object.assign({id,blockId,order,name,content:"",meaning:"",reason:"",status:"open",bonus:[],created},o||{});
  S.stages.push(
    st("gs0","guitar",1,"Купить гитару и аксессуары",{status:"done",closedAt:d(-9),content:"Гитара, тюнер, каподастр"}),
    st("gs1","guitar",2,"Настроить обучение и освоить основу",{content:"Найти, как и у кого учиться, и уверенно взять первые аккорды",meaning:"Хочу уметь сопровождать любимые песни и играть для себя",reason:"Без понятного начала я всё время откладываю занятия"}),
    st("gs2","guitar",3,"Переходы между аккордами",{content:"Менять аккорды без пауз в темпе песни"}),
    st("gs3","guitar",4,"Первые пять песен"),
    st("hs1","b1",1,"Ежедневное движение",{meaning:"Разогнать тело после сидячего дня",reason:"Начала болеть спина"}),
    st("hs2","b1",2,"Режим сна",{content:"Ложиться до 23:30"}),
    st("rs1","b3",1,"Подушка на 3 месяца",{meaning:"Не паниковать при неожиданных расходах"}),
    st("ps1","b4",1,"Видеться с друзьями чаще")
  );
  g.currentStageId="gs1";B(1).currentStageId="hs1";B(3).currentStageId="rs1";B(4).currentStageId="ps1";
  S.facts.push({id:uid(),kind:"stage",ref:"gs0",date:d(-9),ts:Date.now()-9*864e5,coins:0,xp:0,insts:[],consumed:[],cancelled:false,title:"Этап пройден: Купить гитару и аксессуары"});
  S.goals.push(
    {id:"gg1",stageId:"gs1",title:"Выбрать удобный способ обучения",status:"active",ifThen:"",created},
    {id:"gg2",stageId:"gs1",title:"Уверенно меняю Am → Em → C десять раз подряд",status:"active",ifThen:"Если вечером устал, то сыграю пять минут сразу после ужина",created},
    {id:"hg0",stageId:"hs1",title:"Бегать каждое утро",status:"abandoned",ifThen:"",created,closedAt:d(-8)},
    {id:"hg1",stageId:"hs1",title:"Гуляю 30 минут 5 дней в неделю две недели подряд",status:"active",ifThen:"Если дождь, то 15 минут по лестнице дома",created}
  );
  // offers
  S.offers.push(
    newOffer({id:"o1",title:"Поход на живой концерт",price:500,use:"once",cat:"Развлечения",tags:["музыка"],created}),
    newOffer({id:"o2",title:"Вечер кино без дел",price:120,use:"unlimited",cat:"Отдых",tags:["вечер"],created}),
    newOffer({id:"o3",title:"Новые струны",price:150,use:"once",cat:"Гитара",tags:["музыка"],created}),
    newOffer({id:"o4",title:"Массаж спины",price:400,use:"limited",limit:3,cat:"Здоровье",tags:["тело"],created}),
    newOffer({id:"o5",title:"Мороженое",price:40,use:"once",cat:"Вкусное",created})
  );
  // actions
  const T=p=>{const x=newTask(Object.assign({created},p));S.tasks.push(x);return x};
  const H=p=>{const x=newHabit(Object.assign({created},p));S.habits.push(x);return x};
  const Q=p=>{const x=newQuest(Object.assign({created},p));S.quests.push(x);return x};
  const C=p=>{const x=newCal(Object.assign({created},p));S.cal.push(x);return x};
  T({id:"t1",title:"Сравнить два пробных урока",blockId:"guitar",stageId:"gs1",goalId:"gg1",key:true,reward:20,cat:"Обучение",tags:["гитара"]});
  T({id:"t2",title:"10 минут переходов Am → Em",blockId:"guitar",stageId:"gs1",goalId:"gg2",sched:{type:"daily",days:[],date:null},reward:15,ifThen:"Если вечером устал — 3 минуты, просто взять гитару в руки",tags:["гитара","практика"]});
  T({id:"t3",title:"Найти аккорды любимой песни",blockId:"guitar",stageId:"gs3",inDay:false,fit:["rest","normal","hard"],tags:["гитара"]});
  T({id:"t4",title:"Растяжка 10 минут",blockId:"b1",stageId:"hs1",sched:{type:"daily",days:[],date:null},fit:["rest","normal","hard"],reward:10,cat:"Тело"});
  T({id:"t5",title:"Лечь до 23:30",blockId:"b1",stageId:"hs2",sched:{type:"days",days:[1,2,3,4,7],date:null},fit:["rest","normal","hard"],reward:10});
  T({id:"t6",title:"Отложить 10% от поступлений",blockId:"b3",stageId:"rs1",sched:{type:"weekly",days:[5],date:null},reward:20,cat:"Финансы",tags:["деньги"]});
  T({id:"t7",title:"Разобрать подписки и отменить лишние",blockId:"b3",stageId:"rs1",sched:{type:"once",days:[],date:t},reward:15,cat:"Финансы",tags:["деньги"]});
  T({id:"t8",title:"Купить продукты на неделю",fit:["rest","normal","hard"],reward:5,cat:"Быт"});
  T({id:"t9",title:"Разобрать балкон",fit:["hard"],reward:40,cat:"Быт",ifThen:"Если не успею целиком — разберу одну коробку"});
  T({id:"t10",title:"Позвонить в сервис насчёт стиральной машины",sched:{type:"once",days:[],date:d(-1)},reward:5,cat:"Быт"});
  T({id:"t11",title:"Позвонить родителям",blockId:"b4",stageId:"ps1",sched:{type:"weekly",days:[7],date:null},fit:["rest","normal","hard"],reward:10});
  T({id:"t12",title:"Предложить друзьям встречу на выходных",blockId:"b4",stageId:"ps1",reward:10,inDay:false});
  H({id:"h1",title:"Практика гитары",blockId:"guitar",stageId:"gs1",goalId:"gg2",reward:10,goal:{mode:"period",period:"month",target:20,reward:100,bonus:[]},tags:["гитара"]});
  H({id:"h2",title:"Прогулка 30 минут",blockId:"b1",stageId:"hs1",goalId:"hg1",sched:{type:"days",days:[1,2,3,4,5],date:null},reward:10,goal:{mode:"total",period:"month",target:30,reward:150,bonus:[]}});
  H({id:"h3",title:"Чтение 20 минут",blockId:"b2",sched:{type:"whenever",days:[]},reward:5,goal:{mode:"period",period:"week",target:3,reward:30,bonus:[]}});
  Q({id:"q1",title:"Десять тренировок переходов",blockId:"guitar",stageId:"gs1",goalId:"gg2",type:"counter",target:10,inDay:true,stepReward:5,finalReward:100,tags:["гитара"]});
  Q({id:"q2",title:"Собрать домашний спортуголок",blockId:"b1",stageId:"hs1",type:"checklist",steps:[{id:"qs1",title:"Купить коврик"},{id:"qs2",title:"Купить гантели"},{id:"qs3",title:"Освободить угол в комнате"}],inDay:false,stepReward:10,finalReward:80});
  C({id:"c1",title:"Пробный урок гитары",date:d(2),time:"19:00",blockId:"guitar",stageId:"gs1",reward:20});
  C({id:"c2",title:"Оплатить интернет",date:t,time:"12:00",blockId:"b3",reward:5});
  C({id:"c3",title:"Стоматолог",date:d(-2),time:"10:30",reward:10});
  C({id:"c4",title:"День рождения Ани",date:d(5),time:"",blockId:"b4",reward:0});
  setBonusAssign("stage","gs1",["o1"]);
  setBonusAssign("quest","q1",["o3"]);
  setBonusAssign("habit","h1",["o2"]);
  // history of completions over past days
  const doIt=(k,id,day,o)=>{try{complete(k,id,day,o)}catch(e){}};
  for(let i=-11;i<=-1;i++){
    const day=d(i);
    if(i!==-3){doIt("habit","h1",day);doIt("task","t4",day)}
    if(i!==-3&&i!==-5)doIt("task","t2",day);
    if(wd(day)<=5&&i!==-2)doIt("habit","h2",day);
    if([1,2,3,4,7].includes(wd(day))&&i%2===0)doIt("task","t5",day);
    if(wd(day)===5)doIt("task","t6",day);
    if(wd(day)===7)doIt("task","t11",day);
  }
  doIt("quest","q1",d(-6));doIt("quest","q1",d(-4));doIt("quest","q1",d(-2));doIt("quest","q1",d(-1));
  doIt("quest","q2",d(-5),{step:"qs1"});
  doIt("habit","h3",d(-6));doIt("habit","h3",d(-2));
  // day settings: a rest day without debts
  S.days[d(-3)]={tempo:"rest",added:[],removed:[],forced:[],ritual:true};
  S.days[d(-1)]={tempo:"normal",added:[],removed:[],forced:[],ritual:true};
  // purchases
  const buy=(oid,day,used)=>{const o=get("offer",oid);const l=ledger("spend",-o.price,0,"Покупка: "+o.title,"offer:"+o.id,day);S.insts.push({id:uid(),offerId:o.id,title:o.title,use:o.use,limit:o.limit||1,used:used?1:0,uses:used?[day]:[],source:"purchase",paid:o.price,status:"owned",date:day,ts:Date.now(),ledger:l})};
  buy("o2",d(-4),true);buy("o5",d(-1),false);
  // decisions
  const eom=addDays(monthKey(addDays(t,32))+"-01",-1);
  S.decisions.push(
    newDecision({id:"dc1",text:"До конца месяца занимаюсь выбранным курсом и не переключаюсь на новый каждую неделю",stageId:"gs1",deadline:eom+"T23:59",priceC:300,priceX:1000,created:d(-6),linkedAt:d(-6)}),
    newDecision({id:"dc2",text:"Не ем сладкое до пятницы",stageId:"hs1",deadline:d(2)+"T21:00",priceC:100,priceX:200,created:d(-4),linkedAt:d(-4)}),
    newDecision({id:"dc3",text:"Я не сдаюсь, даже если неделя не получилась",stageId:"gs1",created:d(-10),linkedAt:d(-10)}),
    newDecision({id:"dc4",text:"Каждое воскресенье планирую неделю",created:d(-1)}),
    newDecision({id:"dc5",text:"Неделю не покупаю кофе навынос",stageId:"rs1",deadline:d(-5)+"T20:00",priceC:50,priceX:50,status:"failed",closedAt:d(-5),closedTs:Date.now()-5*864e5,paidC:50,paidX:50,created:d(-12)})
  );
  get("decision","dc5").penalty=ledger("penalty",-50,-50,"Цена слова: Неделю не покупаю кофе навынос","decision:dc5",d(-5));
  // treats, inbox, sessions, misc
  [["Прогулка с любимой музыкой","Природа"],["Тёплая ванна с книгой","Отдых"],["Позвонить другу просто так","Люди"],["Любимый фильм под плед","Отдых"],["Кофе на набережной","Город"]].forEach(([title,cat])=>S.treats.push({id:uid(),title,cat,desc:"",status:"active",created}));
  S.inbox.push({id:uid(),text:"Песня из кафе — найти название и разбор",date:d(-1)},{id:uid(),text:"Может, попробовать йогу по утрам?",date:t});
  S.sessions.push({id:uid(),level:"daily",key:d(-1),date:d(-1),ts:Date.now()-864e5,answers:{"Что сегодня получилось?":"Позанимался гитарой 15 минут, прогулка","Что мешало?":"Поздно лёг накануне","Что я понял и хочу изменить?":"Короткие подходы получаются лучше длинных"}});
  S.happy.push({id:uid(),text:"Первый раз сыграл переход без остановки",date:d(-2),fav:true},{id:uid(),text:"Тёплый вечер с друзьями",date:d(-5),fav:false});
  S.timeLog.push({id:uid(),date:d(-1),minutes:15,label:"10 минут переходов Am → Em",ref:"task:t2",ts:Date.now()-864e5},{id:uid(),date:d(-2),minutes:25,label:"Практика гитары",ref:"habit:h1",ts:Date.now()-2*864e5});
  for(let i=0;i<24;i++){const hr=(i+5)%24;const v=(hr>=0&&hr<7)||hr===23?"sleep":hr>=9&&hr<18?"b3":hr===19?"guitar":hr===7?"b1":"";S.graph.weekday[i]=v;S.graph.weekend[i]=(hr>=0&&hr<8)||hr===23?"sleep":hr>=10&&hr<13?"b4":hr===17?"guitar":""}
  S.myReward="o1";
  S.settings.motivation="Маленькие шаги каждый день";
  S.widgets.inDay={timer:true,firststep:true,rhythm:true,myreward:true};
  S.lastProcessed=d(-7);
  processDays();
  const out=S;S=prevS;return out;
}
/* ================= MORE, HISTORY, ARCHIVE, SESSIONS, WIDGETS, SETTINGS, AI, LEARNING, WELCOME ================= */
SCR.more=()=>{
  const missN=S.misses.filter(m=>m.status==="active").length;
  const L=[
    ["Действия",[["tasks","Задания"],["habits","Привычки"],!lite()&&["quests","Квесты"],["calendar","Календарь"],!lite()&&["decisions","Принятые решения"],["missed","Невыполненные"+(missN?" · "+missN:"")]]],
    ["Награды и радости",[!lite()&&["shop","Магазин бонусов"],!lite()&&["mybonuses","Мои бонусы"],!lite()&&["treats","Ништяки"],["economy","Монеты и опыт"]]],
    ["Наблюдение и пересмотр",[["summary","Итоги дня"],["history","История"],!lite()&&S.settings.sessions.all&&["sessions","Стратегические сессии"]]],
    ["Инструменты",[["locations","Локации"],!lite()&&["widgets","Виджеты"],["archive","Архив"],["ai","ИИ-партнёр"],["learn","Обучение и пример"],["settings","Настройки и сохранение"]]]
  ];
  return '<h1>Разделы</h1>'+(lite()?'<p class="lead">Включён LifeGame Lite: показаны основные разделы. Полный набор — в настройках.</p>':'')+
    L.map(([t,items])=>'<h2>'+t+'</h2><div class="grid2">'+items.filter(Boolean).map(([s,l])=>'<button class="tile" data-act="go" data-s="'+s+'"><b>'+esc(l)+'</b></button>').join("")+'</div>').join("");
};

/* ---------- history ---------- */
SCR.history=()=>{
  curScr().title="История";
  const f=S.ui.histF||"all";
  const ev=[];
  S.facts.forEach(x=>ev.push({ts:x.ts,date:x.date,type:"done",t:x.title||"",sub:({task:"Задание",habit:"Привычка",habitStep:"Подход привычки",habitGoal:"Цель привычки",questStep:"Шаг квеста",questFinal:"Финал квеста",cal:"Календарь",stage:"Этап пройден"}[x.kind])+(x.cancelled?" · отменено":""),n:x.coins}));
  S.insts.forEach(i=>{if(i.source==="purchase")ev.push({ts:i.ts||0,date:i.date,type:"bonus",t:"Покупка: "+i.title,sub:i.status==="refunded"?"возвращено":"",n:-i.paid});i.uses.forEach(u=>ev.push({ts:0,date:u,type:"bonus",t:"Использован бонус: "+i.title,sub:""}))});
  S.decisions.filter(d=>d.status!=="active").forEach(d=>ev.push({ts:d.closedTs||0,date:d.closedAt,type:"decision",t:d.text,sub:"Решение: "+DEC_L[d.status]+(d.status==="failed"&&d.paidC?" · −"+d.paidC+" ● / −"+d.paidX+" XP":"")}));
  S.misses.forEach(m=>ev.push({ts:m.created||0,date:m.date,type:"miss",t:m.title,sub:"Пропуск · "+esc(KIND_L[m.kind]||m.kind)+(m.status==="archived"?" · в архиве":"")}));
  S.sessions.forEach(s=>ev.push({ts:s.ts||0,date:s.date,type:"session",t:"Сессия: "+SES[s.level].t,sub:""}));
  const list=ev.filter(e=>f==="all"||e.type===f).sort((a,b)=>b.date.localeCompare(a.date)||b.ts-a.ts);
  const all=!!S.ui.histAll;
  return '<h1>История</h1><p class="lead">Факты прожитого. По умолчанию 10 последних записей.</p><div class="chips" style="margin-top:6px">'+[["all","Всё"],["done","Выполнения"],["bonus","Бонусы"],["decision","Решения"],["miss","Пропуски"],["session","Сессии"]].map(([v,l])=>'<button class="chip" data-act="hist-f" data-v="'+v+'" aria-pressed="'+(f===v)+'">'+l+'</button>').join("")+'</div>'+
    '<div class="card" style="margin-top:10px">'+(list.length?(all?list:list.slice(0,10)).map(e=>'<div class="mini"><div class="t">'+esc(e.t)+'<div class="meta">'+short(e.date)+(e.sub?' · '+esc(e.sub):'')+'</div></div>'+(e.n?'<span class="rw" style="color:'+(e.n<0?'var(--bad)':'var(--coin)')+'">'+(e.n>0?'+':'')+e.n+'</span>':'')+'</div>').join(""):'<div class="empty">Пусто.</div>')+
    (list.length>10?'<button class="btn ghost s" data-act="hist-all">'+(all?'Свернуть':'Показать остальные ('+(list.length-10)+')')+'</button>':'')+'</div>';
};
ACT["hist-f"]=el=>{S.ui.histF=el.dataset.v;render()};
ACT["hist-all"]=()=>{S.ui.histAll=!S.ui.histAll;render()};

/* ---------- archive ---------- */
SCR.archive=p=>{
  curScr().title="Архив";
  const tab=p.tab||S.ui.archTab||"tasks";
  const tabs=[["tasks","Задания","task"],["habits","Привычки","habit"],["quests","Квесты","quest"],["cal","Календарь","cal"],["offers","Бонусы","offer"],["blocks","Блоки","block"]];
  const [,,k]=tabs.find(t=>t[0]===tab);
  const items=(S[COLL[k]]||[]).filter(x=>x.status==="archived");
  return '<h1>Архив</h1><p class="lead">Убранное из активной работы. Восстановить или удалить окончательно. Ништяки и пропуски архивируются в своих разделах.</p>'+
    '<div class="chips" style="margin-top:6px">'+tabs.map(([v,l,kk])=>'<button class="chip" data-act="arch-tab" data-v="'+v+'" aria-pressed="'+(tab===v)+'">'+l+' ('+(S[COLL[kk]]||[]).filter(x=>x.status==="archived").length+')</button>').join("")+'</div>'+
    '<div class="list" style="margin-top:10px">'+(items.length?items.map(x=>'<div class="item"><div class="body"><div class="t">'+esc(x.title||x.name)+'</div><div class="meta">'+(k==="block"?"Блок":esc(originText(x)))+'</div></div><button class="btn s" data-act="arch-restore" data-k="'+k+'" data-id="'+x.id+'">Восстановить</button>'+(k==="block"&&x.base?'':'<button class="btn s danger" data-act="arch-del" data-k="'+k+'" data-id="'+x.id+'">Удалить</button>')+'</div>').join(""):'<div class="empty">Пусто.</div>')+'</div>';
};
ACT["arch-tab"]=el=>{S.ui.archTab=el.dataset.v;const c=curScr();c.p=Object.assign({},c.p,{tab:el.dataset.v});render()};
ACT["arch-restore"]=el=>tx(()=>{const x=get(el.dataset.k,el.dataset.id);x.status=x.prevStatus&&x.prevStatus!=="archived"?x.prevStatus:"active"},"Восстановлено");
ACT["arch-del"]=async el=>{
  const k=el.dataset.k,x=get(k,el.dataset.id);
  const hasFin=S.facts.some(f=>f.ref===x.id)||S.insts.some(i=>i.offerId===x.id);
  const y=await ask({title:"Удалить навсегда?",text:hasFin?"У записи есть история выполнений или покупок. Карточка будет удалена, а факты и денежные операции останутся в истории под прежним названием.":"Запись будет удалена без возможности восстановления.",ok:"Удалить",danger:true});
  if(!y)return;
  tx(()=>{
    if(k==="block"){
      const removedStages=new Set(S.stages.filter(a=>a.blockId===x.id).map(a=>a.id));S.insts=S.insts.filter(i=>!(i.status==="reserved"&&i.cond?.k==="stage"&&removedStages.has(i.cond.id)));for(const tpl of ["weekday","weekend"])S.graph[tpl]=S.graph[tpl].map(id=>id===x.id?"":id);S.focus.blocks=S.focus.blocks.filter(id=>id!==x.id);S.locations.forEach(l=>l.blocks=l.blocks.filter(id=>id!==x.id));
      S.stages.filter(s=>s.blockId===x.id).forEach(s=>{S.goals=S.goals.filter(g=>g.stageId!==s.id);S.decisions.forEach(d=>{if(d.stageId===s.id)d.stageId=null})});
      S.stages=S.stages.filter(s=>s.blockId!==x.id);S.achievements=S.achievements.filter(a=>a.blockId!==x.id);
      [...S.tasks,...S.habits,...S.quests,...S.cal].forEach(i=>{if(i.blockId===x.id){i.blockId=null;i.stageId=null;i.goalId=null}});
    }
    S.insts=S.insts.filter(i=>!(i.status==="reserved"&&i.cond&&i.cond.k===k&&i.cond.id===x.id));
    S[COLL[k]]=S[COLL[k]].filter(y=>y.id!==x.id);
  },"Удалено");
};

/* ---------- strategic sessions ---------- */
const SES={
  daily:{t:"Ежедневная",q:["Что сегодня получилось?","Что мешало?","Что я понял и хочу изменить?"],key:d=>d},
  weekly:{t:"Еженедельная",q:["Как прошла неделя?","Что забирало силы?","Куда я продвинулся?","Что скорректировать в приоритетах?"],key:d=>weekStart(d)},
  monthly:{t:"Ежемесячная",q:["Какие направления сейчас важнее всего?","Какие этапы теперь актуальны, а какие нет?","Что изменить в стратегии на следующий месяц?"],key:d=>monthKey(d)}
};
function sessionDone(level){const k=SES[level].key(today());return S.sessions.some(s=>s.level===level&&s.key===k)}
function sessionInvites(){
  if(lite()||!S.settings.sessions.all)return "";
  const t=today();
  const inv=[];
  if(S.settings.sessions.daily&&!sessionDone("daily"))inv.push(["daily","Вечерние вопросы дня"]);
  if(S.settings.sessions.weekly&&wd(t)>=6&&!sessionDone("weekly"))inv.push(["weekly","Пора оглянуться на неделю"]);
  if(S.settings.sessions.monthly&&(parseD(t).getDate()<=3||monthKey(addDays(t,3))!==monthKey(t))&&!sessionDone("monthly"))inv.push(["monthly","Месячный пересмотр стратегии"]);
  if(!inv.length)return "";
  return '<div class="card flat" style="margin-top:8px"><div class="small muted">Приглашение (можно отключить в настройках)</div>'+inv.map(([l,t])=>'<div class="between" style="margin-top:4px"><span>'+t+'</span><button class="btn s" data-act="go" data-s="session" data-level="'+l+'">Открыть</button></div>').join("")+'</div>';
}
SCR.sessions=()=>{
  curScr().title="Стратегические сессии";
  const past=S.sessions.slice().sort((a,b)=>b.date.localeCompare(a.date));
  return '<h1>Стратегические сессии</h1><p class="lead">Добровольные вопросы трёх масштабов. Решения о плане принимаете вы.</p>'+
    '<div class="grid3" style="margin-top:8px">'+Object.entries(SES).map(([l,s])=>'<button class="tile" data-act="go" data-s="session" data-level="'+l+'"><b>'+s.t+'</b><span class="meta">'+(sessionDone(l)?'пройдена в этом периоде':'не пройдена')+'</span></button>').join("")+'</div>'+
    '<div class="row" style="margin-top:8px"><button class="btn s" data-act="tab" data-v="map">Открыть карту</button><button class="btn s" data-act="go" data-s="settings">Настроить приглашения</button></div>'+
    '<h2>Записанные ответы <span class="count">'+past.length+'</span></h2>'+(past.length?'<div class="list">'+(S.ui.sesAll?past:past.slice(0,10)).map(s=>'<div class="card"><div class="between"><b>'+SES[s.level].t+'</b><span class="meta">'+short(s.date)+'</span></div>'+Object.entries(s.answers).filter(([,a])=>a).map(([q,a])=>'<div class="small" style="margin-top:4px"><span class="muted">'+esc(q)+'</span><br>'+esc(a)+'</div>').join("")+'</div>').join("")+'</div>'+(past.length>10?'<button class="btn ghost s" data-act="ses-all">Показать все</button>':''):'<div class="empty">Пока нет.</div>');
};
ACT["ses-all"]=()=>{S.ui.sesAll=!S.ui.sesAll;render()};
SCR.session=p=>{
  const l=p.level||"daily";const s=SES[l];
  curScr().title=s.t+" сессия";
  const prev=S.sessions.find(x=>x.level===l&&x.key===s.key(today()));
  const st=dayStats(today());
  let facts="";
  if(l==="daily")facts='Сегодня: отметок '+st.fs.length+', +'+st.earned+' монет, записано '+st.minutes+' мин.';
  else{const from=l==="weekly"?weekStart(today()):monthKey(today())+"-01";const fs=liveFacts().filter(f=>f.date>=from);facts='С '+short(from)+': отметок '+fs.length+', заработано '+fs.reduce((a,f)=>a+(f.ledger?f.coins:0),0)+', пропусков '+S.misses.filter(m=>m.date>=from).length+'.'}
  let h='<h1>'+s.t+' сессия</h1><div class="card flat small">'+facts+'</div><form data-form="session" data-level="'+l+'">'+
    s.q.map((q,i)=>'<label class="f">'+esc(q)+'</label><textarea name="q'+i+'">'+esc(prev?prev.answers[q]||"":"")+'</textarea>').join("");
  if(l==="monthly"){
    h+='<h2>Приоритет и интенсивность блоков</h2><div class="list">'+activeBlocks().map(b=>'<div class="card"><b>'+esc(b.icon+" "+b.name)+'</b><div class="grid2" style="margin-top:6px"><select name="prio_'+b.id+'">'+PRIO.map(([v,t])=>opt(v,"Приоритет: "+t,b.priority)).join("")+'</select><select name="int_'+b.id+'">'+INTENS.map(([v,t])=>opt(v,t,b.intensity)).join("")+'</select></div></div>').join("")+'</div>';
  }
  h+='<p class="meta" style="margin-top:8px">Отвечать необязательно. Ответы сохраняются в истории сессий.</p><div class="row" style="margin-top:10px"><button class="btn primary">Сохранить</button><button type="button" class="btn" data-act="tab" data-v="map">Открыть карту</button></div></form>';
  return h;
};
FORMS.session=f=>{
  const l=f.dataset.level,s=SES[l];
  const ok=tx(()=>{
    const answers={};s.q.forEach((q,i)=>answers[q]=fv(f,"q"+i));
    const k=s.key(today());
    S.sessions=S.sessions.filter(x=>!(x.level===l&&x.key===k));
    S.sessions.push({id:uid(),level:l,key:k,date:today(),ts:Date.now(),answers});
    if(l==="monthly")activeBlocks().forEach(b=>{b.priority=fv(f,"prio_"+b.id)||b.priority;b.intensity=fv(f,"int_"+b.id)||b.intensity});
  },"Сессия сохранена");
  if(ok)goBack();
};

/* ---------- widgets ---------- */
const WIDGETS={
  timer:{t:"Время для важного",d:"Таймер подхода. Окончание таймера не выполняет задание: минуты подтверждаются отдельно."},
  firststep:{t:"Первый шаг",d:"Ритуал старта: выбрать дело, назвать маленький шаг и начать с двух минут."},
  graph:{t:"График дня",d:"Шаблон распределения суток по блокам для будней и выходных. План, а не учёт."},
  happiness:{t:"Игра в счастье",d:"Записывайте хорошие моменты и собирайте коллекцию."},
  rhythm:{t:"Ритм недели",d:"Сколько дней на этой неделе было хотя бы одно действие. Дни отдыха без штрафа."},
  myreward:{t:"Моя награда",d:"Выбранный бонус из магазина и сколько монет до него осталось."}
};
SCR.widgets=()=>{
  curScr().title="Виджеты";
  const mine=S.widgets.mine;
  return '<h1>Виджеты</h1><p class="lead">Каталог → Мои виджеты → Конструктор дня по выбору. Удаление виджета не удаляет его данные.</p>'+
    '<h2>Мои виджеты <span class="count">'+mine.length+'</span></h2><div class="list">'+(mine.length?mine.map(w=>'<div class="item"><button class="body link" data-act="widget-open" data-w="'+w+'"><div class="t">'+WIDGETS[w].t+'</div><div class="meta">'+WIDGETS[w].d+'</div></button><button class="tg'+(S.widgets.inDay[w]?' on':'')+'" data-act="widget-day" data-w="'+w+'">'+(S.widgets.inDay[w]?'в Конструкторе':'в Конструктор')+'</button><button class="ib" data-act="widget-rm" data-w="'+w+'" aria-label="Убрать из моих">✕</button></div>').join(""):'<div class="empty">Пусто.</div>')+'</div>'+
    '<h2>Каталог</h2><div class="list">'+Object.entries(WIDGETS).filter(([w])=>!mine.includes(w)).map(([w,x])=>'<div class="item"><div class="body"><div class="t">'+x.t+'</div><div class="meta">'+x.d+'</div></div><button class="btn s primary" data-act="widget-add" data-w="'+w+'">Добавить</button></div>').join("")+'<div class="item dim"><div class="body"><div class="t">Ключевые действия</div><div class="meta">Теперь это отдельная секция Конструктора, а не виджет.</div></div></div></div>';
};
ACT["widget-add"]=el=>tx(()=>{S.widgets.mine.push(el.dataset.w)},"Добавлено в «Мои виджеты»");
ACT["widget-rm"]=el=>tx(()=>{S.widgets.mine=S.widgets.mine.filter(w=>w!==el.dataset.w);S.widgets.inDay[el.dataset.w]=false},"Убрано. Данные виджета сохранены");
ACT["widget-day"]=el=>tx(()=>{S.widgets.inDay[el.dataset.w]=!S.widgets.inDay[el.dataset.w]});
function widgetTile(w){
  let sub="";
  if(w==="timer")sub=S.timer.state==="ready"?"Готов к подходу":S.timer.state==="running"?"Идёт: <span data-timer-left>"+timerLeft()+"</span>":S.timer.state==="paused"?"Пауза":"Подтвердите минуты";
  if(w==="firststep")sub="Начать с двух минут";
  if(w==="graph"){const h=new Date().getHours();const tpl=wd(today())>=6?S.graph.weekend:S.graph.weekday;const v=tpl[(h+19)%24];sub="Сейчас по плану: "+(v==="sleep"?"сон":v?esc((get("block",v)||{}).name||"—"):"не задано")}
  if(w==="happiness")sub="Моментов в коллекции: "+S.happy.length;
  if(w==="rhythm"){const r=weekRhythm();sub=r.days+" из "+S.rhythm.target+" дней"}
  if(w==="myreward"){const o=get("offer",S.myReward);sub=o?esc(o.title)+": "+(coins()>=o.price?"можно купить":"ещё "+(o.price-coins())):"Не выбрана"}
  return '<button class="tile" data-act="widget-open" data-w="'+w+'"><b>'+WIDGETS[w].t+'</b><span class="meta">'+sub+'</span></button>';
}
ACT["widget-open"]=el=>{const w=el.dataset.w;({timer:timerSheet,firststep:firstStepSheet,graph:graphSheet,happiness:happySheet,rhythm:rhythmSheet,myreward:myRewardSheet})[w]()};

/* timer */
function timerLeft(){const t=S.timer;let ms=t.state==="running"?t.endsAt-Date.now():t.remaining*1000;ms=Math.max(0,ms);const s=Math.ceil(ms/1000);return pad(Math.floor(s/60))+":"+pad(s%60)}
function timerSheet(){openSheet("Время для важного",timerBody(),{key:"timer"})}
function timerBody(){
  const t=S.timer;
  if(t.state==="done"){
    const mins=Math.max(1,Math.round(((t.minutes*60)-(t.remaining||0))/60));
    return '<p>Подход «'+esc(t.label||"без названия")+'» закончен. Сколько минут записать?</p><form data-form="timer-log"><input type="number" name="min" min="1" value="'+mins+'" style="max-width:120px"><p class="meta">Запись минут не отмечает дело выполненным. Выполнение — отдельной отметкой.</p><div class="row" style="margin-top:8px"><button class="btn primary">Записать время</button><button type="button" class="btn" data-act="timer-skip">Не записывать</button></div></form>';
  }
  const items=dayPlan(today()).visible.filter(r=>!r.startsWith("cal:")&&!isDoneRef(r,today()));
  return '<div class="big" style="text-align:center;margin:8px 0" data-timer-left>'+timerLeft()+'</div>'+
    (t.state==="ready"?'<div class="chips" style="justify-content:center">'+[5,15,25,45].map(m=>'<button class="chip" data-act="timer-preset" data-v="'+m+'" aria-pressed="'+(t.minutes===m)+'">'+m+' мин</button>').join("")+'</div>'+
      '<label class="f">Своё время, минут</label><input type="number" min="1" max="180" id="timer-custom" value="'+t.minutes+'" style="max-width:120px">'+
      '<label class="f">Для какого дела (необязательно)</label><select id="timer-ref">'+opt("","Без привязки",t.ref||"")+items.map(r=>opt(r,get(...pr(r)).title,t.ref)).join("")+'</select>'+
      '<div class="row" style="margin-top:12px"><button class="btn primary" data-act="timer-start">Старт</button></div>':
     '<p style="text-align:center">'+esc(t.label||"")+'</p><div class="row" style="justify-content:center">'+(t.state==="running"?'<button class="btn" data-act="timer-pause">Пауза</button>':'<button class="btn primary" data-act="timer-resume">Продолжить</button>')+'<button class="btn danger" data-act="timer-stop">Закончить</button></div>');
}
ACT["timer-preset"]=el=>{S.timer.minutes=+el.dataset.v;S.timer.remaining=S.timer.minutes*60;save();refreshSheet("timer",timerBody)};
ACT["timer-start"]=()=>{
  const m=Math.min(180,Math.max(1,parseInt($("#timer-custom").value,10)||S.timer.minutes));const ref=$("#timer-ref").value||null;
  startTimer(m,ref?get(...pr(ref)).title:"",ref);refreshSheet("timer",timerBody);
};
function startTimer(m,label,ref){if(S.timer.state!=="ready")fail("Сначала завершите текущий подход и запишите или пропустите его время");if(ref&&!available(get(...pr(ref))))fail("Дело недоступно");S.timer={state:"running",minutes:m,remaining:m*60,endsAt:Date.now()+m*60e3,label,ref,startedAt:Date.now()};save();render()}
ACT["timer-for"]=el=>{closeAllSheets();const r=el.dataset.r;startTimer(15,get(...pr(r)).title,r);toast("Таймер 15 минут запущен");};
ACT["timer-pause"]=()=>{if(S.timer.state!=="running")return;S.timer.remaining=Math.max(0,Math.ceil((S.timer.endsAt-Date.now())/1000));S.timer.state="paused";save();refreshSheet("timer",timerBody);render()};
ACT["timer-resume"]=()=>{if(S.timer.state!=="paused")return;S.timer.endsAt=Date.now()+S.timer.remaining*1000;S.timer.state="running";save();refreshSheet("timer",timerBody);render()};
ACT["timer-stop"]=()=>{if(S.timer.state==="running")S.timer.remaining=Math.max(0,Math.ceil((S.timer.endsAt-Date.now())/1000));S.timer.state="done";save();refreshSheet("timer",timerBody);render()};
ACT["timer-skip"]=()=>{S.timer=Object.assign(S.timer,{state:"ready",remaining:S.timer.minutes*60,endsAt:null});save();closeSheet();render();toast("Подход завершён без записи времени")};
FORMS["timer-log"]=f=>{const m=Math.min(180,Math.max(1,fnum(f,"min",1)));const ok=tx(()=>{if(S.timer.state!=="done")fail("Этот подход уже записан");S.timeLog.push({id:uid(),date:today(),minutes:m,label:S.timer.label,ref:S.timer.ref,ts:Date.now()});S.timer=Object.assign(S.timer,{state:"ready",remaining:S.timer.minutes*60,endsAt:null})},"Записано "+m+" мин. Выполнение дела отмечается отдельно");if(ok)closeSheet()};
function renderMiniTimer(){
  let el=$(".minitimer");
  const t=S&&S.timer;
  if(!t||t.state==="ready"||(SHEETS.some(s=>s.key==="timer"))){if(el)el.remove();return}
  if(!el){el=document.createElement("div");el.className="minitimer";document.body.appendChild(el)}
  el.innerHTML='<span>'+(t.state==="done"?"Подход закончен":esc(t.label||"Подход"))+'</span><b data-timer-left>'+(t.state==="done"?"":timerLeft())+'</b><button data-act="widget-open" data-w="timer">'+(t.state==="done"?"Записать":"Открыть")+'</button>';
}

/* first step */
function firstStepSheet(){
  const items=dayPlan(today()).visible.filter(r=>!r.startsWith("cal:")&&!isDoneRef(r,today()));
  openSheet("Первый шаг",'<form data-form="firststep"><p>Выберите дело и самый маленький шаг. Затем 5…1 — и две минуты.</p><label class="f">Дело</label><select name="ref">'+opt("","Без привязки","")+items.map(r=>opt(r,get(...pr(r)).title,"")).join("")+'</select><label class="f">Маленький шаг</label><input type="text" name="step" placeholder="Например: достать гитару из чехла"><div class="row" style="margin-top:12px"><button class="btn primary">Начать</button></div></form><div data-countdown class="ritual" hidden></div>',{key:"fs"});
}
FORMS.firststep=f=>{
  if(S.timer.state!=="ready"){toast("Сначала завершите текущий подход");return}
  const ref=fv(f,"ref"),step=fv(f,"step"),sheet=SHEETS[SHEETS.length-1],box=sheet.el.querySelector('[data-countdown]');
  f.hidden=true;box.hidden=false;let n=5;box.textContent=n;
  const iv=setInterval(()=>{if(!sheet.el.isConnected){clearInterval(iv);return}n--;if(n>0){box.textContent=n;return}clearInterval(iv);box.textContent='GO!';
    setTimeout(()=>{if(!sheet.el.isConnected)return;runGuarded(()=>{if(S.timer.state!=="ready")fail("Другой подход уже запущен");startTimer(2,step||(ref?get(...pr(ref)).title:"Первый шаг"),ref||null);closeSheet();toast("Две минуты пошли. Выполнение отмечается отдельно")},box)},600)
  },700);
};

/* day graph */
function graphSheet(){openSheet("График дня",graphBody(S.ui.graphT||"weekday"),{key:"graph"})}
function graphBody(tpl){
  const arr=S.graph[tpl];
  return '<div class="seg">'+[["weekday","Будни"],["weekend","Выходные"]].map(([v,l])=>'<button data-act="graph-t" data-v="'+v+'" aria-pressed="'+(tpl===v)+'">'+l+'</button>').join("")+'</div><p class="meta" style="margin-top:6px">Шаблон суток 05:00–04:00. Это план распределения, не учёт минут и не награда.</p><div class="hours" style="margin-top:8px">'+
    arr.map((v,i)=>'<span>'+pad((i+5)%24)+':00</span><select data-graph="'+tpl+'" data-i="'+i+'">'+opt("","—",v)+opt("sleep","Сон",v)+S.blocks.filter(b=>b.status==="active").map(b=>opt(b.id,b.icon+" "+b.name,v)).join("")+'</select>').join("")+'</div>';
}
ACT["graph-t"]=el=>{S.ui.graphT=el.dataset.v;refreshSheet("graph",()=>graphBody(el.dataset.v))};
document.addEventListener("change",e=>{if(e.target.matches("[data-graph]"))runGuarded(()=>{S.graph[e.target.dataset.graph][+e.target.dataset.i]=e.target.value;save()},e.target)});

/* happiness */
function happySheet(){openSheet("Игра в счастье",happyBody(),{key:"happy"})}
function happyBody(){
  return '<form data-form="happy" class="row nw"><input type="text" name="t" placeholder="Что хорошего случилось?" autocomplete="off"><button class="btn primary">Добавить</button></form><p class="meta" style="margin-top:6px">Без денег и штрафов. Сердечко — в избранное.</p>'+
    '<div class="list" style="margin-top:8px">'+(S.happy.length?S.happy.slice().reverse().map(x=>'<div class="item"><div class="body"><div class="t">'+esc(x.text)+'</div><div class="meta">'+short(x.date)+'</div></div><button class="ib'+(x.fav?' on':'')+'" data-act="happy-fav" data-id="'+x.id+'" aria-label="Избранное">'+(x.fav?'♥':'♡')+'</button><button class="ib" data-act="happy-del" data-id="'+x.id+'" aria-label="Удалить">✕</button></div>').join(""):'<div class="empty">Коллекция пуста.</div>')+'</div>';
}
FORMS.happy=f=>{const t=fv(f,"t");if(!t)return;S.happy.push({id:uid(),text:t,date:today(),fav:false});save();refreshSheet("happy",happyBody);render()};
ACT["happy-fav"]=el=>{const x=S.happy.find(h=>h.id===el.dataset.id);x.fav=!x.fav;save();refreshSheet("happy",happyBody)};
ACT["happy-del"]=el=>{S.happy=S.happy.filter(h=>h.id!==el.dataset.id);save();refreshSheet("happy",happyBody);render()};

/* rhythm */
function weekRhythm(){const ws=weekStart(today());const days=new Set(liveFacts().filter(f=>f.date>=ws&&f.date<=today()).map(f=>f.date));return {days:days.size,set:days,ws}}
function rhythmSheet(){
  const r=weekRhythm();
  openSheet("Ритм недели",'<div class="days">'+WD.map((l,i)=>{const d=addDays(r.ws,i);const on=r.set.has(d);const rest=S.rhythm.rest.includes(i+1);return '<button type="button" style="cursor:default" aria-pressed="'+on+'" title="'+short(d)+'">'+l+(rest&&!on?'·':'')+'</button>'}).join("")+'</div>'+
    '<p style="margin-top:10px">Дней с действием: <b>'+r.days+'</b> из ориентира '+S.rhythm.target+'.</p><p class="meta">Считаются даты с хотя бы одним фактом выполнения. Точка — день отдыха: без штрафа. Серия не требуется.</p>'+
    '<form data-form="rhythm" class="row"><label class="small">Ориентир дней в неделю</label><input type="number" name="t" min="1" max="7" value="'+S.rhythm.target+'" style="max-width:80px"><button class="btn s">Сохранить</button></form>');
}
FORMS.rhythm=f=>{S.rhythm.target=Math.min(7,Math.max(1,fnum(f,"t",3)));save();closeSheet();render()};

/* my reward */
function myRewardSheet(){
  const o=get("offer",S.myReward);
  openSheet("Моя награда",(o?'<p><b>'+esc(o.title)+'</b> — '+o.price+' монет.</p><div class="bar" style="margin:6px 0"><i style="width:'+Math.min(100,Math.max(0,coins())/o.price*100)+'%"></i></div><p class="meta">'+(coins()>=o.price?'Хватает на покупку. Покупка — вручную в магазине.':'Осталось накопить '+(o.price-coins())+'.')+'</p>':'<p class="meta">Выберите бонус, на который копите. Это не резерв и не автоматическая выдача.</p>')+
    '<select data-myreward>'+opt("","Не выбрано",S.myReward||"")+S.offers.filter(x=>x.status==="active").map(x=>opt(x.id,x.title+" — "+x.price,S.myReward)).join("")+'</select><div class="row" style="margin-top:10px"><button class="btn s" data-act="go" data-s="shop">Открыть магазин</button></div>');
}
document.addEventListener("change",e=>{if(e.target.matches("[data-myreward]"))runGuarded(()=>{S.myReward=e.target.value||null;save();closeSheet();render();myRewardSheet()},e.target)});

/* ---------- settings ---------- */
SCR.settings=()=>{
  curScr().title="Настройки";
  const s=S.settings;
  return '<h1>Настройки</h1><p class="meta">Personal 1.2.0</p>'+
    '<h2>Пространство</h2><div class="card"><p>Сейчас: <b>'+(S.space==="demo"?"Демо (вымышленная жизнь)":"Моя жизнь")+'</b>. Пространства хранятся раздельно.</p><div class="row"><button class="btn s" data-act="'+(S.space==="demo"?"space-my":"space-demo")+'">'+(S.space==="demo"?"Перейти к своей жизни":"Открыть демо")+'</button></div></div>'+
    '<h2>Интерфейс</h2><div class="card"><label class="tog"><input type="checkbox" data-set="lite" '+(s.lite?'checked':'')+'><span>LifeGame Lite<small>Простой вход в ту же систему: только основные разделы. Данные остальных сохраняются.</small></span></label>'+
    '<label class="f">Стиль оформления</label><div class="style-pick">'+STYLES.map(([v,l,sw])=>'<button data-act="style" data-v="'+v+'" aria-pressed="'+((s.style||"quest")===v)+'"><div class="sp-sw" style="background:'+sw[0]+'">'+sw.slice(1).map(c=>'<i style="background:'+c+'"></i>').join("")+'</div><div class="sp-l">'+l+'</div></button>').join("")+'</div>'+
    '<div class="row" style="margin-top:8px"><button class="btn s" data-act="motivation">Мотивация на главной</button></div></div>'+
    '<h2>Локации</h2><div class="card"><div class="between"><span>Сейчас: '+esc(locName(curLocObj()))+'</span><button class="btn s" data-act="go" data-s="locations">Настроить</button></div></div>'+
    '<h2>Стратегические сессии</h2><div class="card"><label class="tog"><input type="checkbox" data-set="ses.all" '+(s.sessions.all?'checked':'')+'><span>Сессии и приглашения включены</span></label>'+
    ['daily','weekly','monthly'].map(l=>'<label class="tog"><input type="checkbox" data-set="ses.'+l+'" '+(s.sessions[l]?'checked':'')+' '+(s.sessions.all?'':'disabled')+'><span>'+SES[l].t+' приглашения</span></label>').join("")+'<p class="meta" style="margin-top:6px">Карта и планирование доступны всегда, независимо от вопросов.</p></div>'+
    '<h2>Напоминания</h2><div class="card"><label class="tog"><input type="checkbox" data-set="reminders" '+(s.reminders?'checked':'')+'><span>Календарные напоминания<small>Работают при открытом приложении. При закрытом браузере доставка не гарантируется.</small></span></label></div>'+
    '<div class="row" style="margin-top:8px"><button class="btn s" data-act="request-notifications">Разрешить системные уведомления</button></div>'+
    '<h2>Сопровождение</h2><div class="card"><label class="tog"><input type="checkbox" data-set="onb" '+(s.onboarding.on?'checked':'')+'><span>Семидневное сопровождение маленькими шагами</span></label></div>'+
    '<h2>Установка и офлайн</h2><div class="card"><p class="small">На iPhone: Safari → Поделиться → На экран «Домой». На Android: меню браузера → Установить приложение. После первого открытия основные функции доступны без сети.</p><p class="meta">Данные остаются на этом устройстве. Для переноса используйте экспорт. Автоматической синхронизации между устройствами нет.</p></div>'+
    '<h2>Сохранение</h2><div class="card"><p class="small">Всё хранится в этом браузере. Резервная копия сохраняет связи, прогресс, историю, награды, долги и настройки.</p><div class="row"><button class="btn s" data-act="export">Экспорт</button><button class="btn s" data-act="import">Восстановить из копии</button><button class="btn s danger" data-act="reset">Полный сброс</button></div><div data-export></div>'+backupSettings()+'</div>';
};
document.addEventListener("change",e=>{
  const k=e.target.dataset&&e.target.dataset.set;if(!k)return;runGuarded(()=>{const v=e.target.checked;
  tx(()=>{
    if(k==="lite")S.settings.lite=v;
    else if(k==="reminders")S.settings.reminders=v;
    else if(k==="onb"){S.settings.onboarding.on=v;if(v&&!S.settings.onboarding.start)S.settings.onboarding.start=today()}
    else if(k.startsWith("ses."))S.settings.sessions[k.slice(4)]=v;
  },"Сохранено");},e.target);
});
ACT["accent"]=el=>tx(()=>{S.settings.accent=el.dataset.v});
ACT["style"]=el=>tx(()=>{if(!STYLES.some(x=>x[0]===el.dataset.v))fail("Неизвестный стиль");S.settings.style=el.dataset.v});
document.addEventListener("change",e=>{if(e.target.matches("[data-location-list]")){S.ui["locfilter_"+e.target.dataset.locationList]=e.target.value;render()}});
ACT["export"]=()=>{
  const data=JSON.stringify(exportFile());downloadFile(data,"LifeGame-"+META.space+"-"+today()+".json");
  tx(()=>{S.settings.lastExport=today();delete S.settings.backupSnooze});
  const box=$("[data-export]");
  if(box)box.innerHTML='<label class="f">Скопируйте текст и сохраните в файл</label><textarea readonly style="min-height:120px;font-size:12px">'+esc(data)+'</textarea><button class="btn s" data-act="copy-export">Скопировать</button>';
};
ACT["copy-export"]=()=>{const t=$("[data-export] textarea");try{navigator.clipboard.writeText(t.value).then(()=>toast("Скопировано"),()=>{t.select();toast("Выделено: скопируйте вручную")})}catch(e){t.select();toast("Выделено: скопируйте вручную")}};
ACT["import"]=()=>{openSheet("Восстановление",'<p class="meta">Вставьте текст резервной копии или выберите файл. Текущее пространство будет полностью заменено.</p><textarea id="imp-text" style="min-height:120px"></textarea><input type="file" id="imp-file" accept=".json,.txt" style="margin-top:8px"><div class="row" style="margin-top:10px"><button class="btn primary" data-act="import-do">Восстановить</button></div>')};
document.addEventListener("change",e=>{if(e.target.id==="imp-file"){const fl=e.target.files[0];if(!fl)return;const r=new FileReader();r.onload=()=>{const target=$("#imp-text");if(target)target.value=r.result};if(fl.size>8*1024*1024){toast("Файл слишком большой: максимум 8 МБ");return}r.readAsText(fl)}});
ACT["import-do"]=async()=>{
  let obj;try{obj=JSON.parse($("#imp-text").value)}catch(e){toast("Не удалось прочитать копию");return}
  if(!obj||!((obj.app==="LifeGame"&&obj.format==="demo-2")||(obj.app==="LifeGame Personal"&&obj.format==="personal-1"))||!obj.data){toast("Это не резервная копия этой версии");return}try{LifeGamePersistence.validate(obj.data)}catch(e){toast(e.message);return}
  const y=await ask({title:"Заменить текущее пространство?",text:"Все текущие данные пространства будут заменены данными из копии.",ok:"Заменить",danger:true});if(!y)return;
  replaceSpace(obj.data);closeAllSheets();goTab("home");toast("Восстановлено");
};
ACT["reset"]=async()=>{
  const v=await ask({title:"Полный сброс пространства",text:"Будут удалены все данные «"+(S.space==="demo"?"Демо":"Моей жизни")+"». Восемь базовых блоков вернутся к стандартной структуре. Введите СБРОС.",input:"СБРОС",match:"СБРОС",ok:"Сбросить",danger:true});
  if(v!=="СБРОС")return;
  replaceSpace(META.space==="demo"?makeDemo():makeBlank());goTab("home");toast("Пространство сброшено");
};

/* ---------- spaces ---------- */
ACT["space-my"]=()=>{save();META.space="my";saveMeta();S=loadSpace("my");closeAllSheets();goTab("home");if(!corruptSpace&&!S.settings.onboarding.on&&!S.ui.seenStart){S.ui.seenStart=true;save();startMySheet()}};
ACT["space-demo"]=()=>{save();META.space="demo";saveMeta();S=loadSpace("demo");if(!corruptSpace)save();closeAllSheets();goTab("home")};
function startMySheet(){
  openSheet("Своя жизнь в LifeGame",'<p>Здесь пока пусто: восемь исходных блоков и ничего лишнего. Можно начать с одного направления или просто записать дело.</p><label class="tog"><input type="checkbox" data-set="onb"><span>Включить семидневное сопровождение<small>Маленький шаг в день. Ничего не блокирует, можно пропускать.</small></span></label><label class="tog"><input type="checkbox" data-set="lite"><span>Начать с LifeGame Lite<small>Только основные разделы, остальное — в настройках.</small></span></label><div class="row" style="margin-top:12px"><button class="btn primary" data-act="sheet-close">Начать</button></div>');
}

/* ---------- AI stub ---------- */
SCR.ai=()=>{
  curScr().title="ИИ-партнёр";
  return '<h1>ИИ-партнёр</h1><div class="card"><p>Будущий понимающий голосовой партнёр: знает вашу историю, стратегию и обстоятельства, поддерживает, помогает замечать важное и обсуждать решения. Выбор всегда за вами.</p><p class="meta">В этой демонстрации ИИ — заглушка. Стратегия, выполнение, экономика и пересмотр работают без нейросети.</p></div>'+
    '<div class="card flat" style="margin-top:10px"><div class="row nw"><input type="text" placeholder="Сообщение партнёру (недоступно в демо)" disabled><button class="btn" disabled>🎙</button></div></div>';
};

/* ---------- learning & onboarding ---------- */
const ONB=[
  ["Запишите мысль и выберите темп дня","Нажмите «+» справа внизу и запишите любую мысль — она попадёт во «Входящие». Затем на вкладке «День» выберите темп: Отдыхаю, Обычный или Фигачу.","day","#fab|[data-act=tempo]"],
  ["Отметьте ключевое действие и выполните его","В Конструкторе нажмите звёздочку у задания — оно станет ключевым. Потом отметьте кружок слева: придут монеты и опыт.","day","[data-act=key]|.item .check"],
  ["Добавьте дело в календарь","Дело на реальную дату: встреча, оплата, урок. Нажмите «+ Новое», укажите дату и время.","calendar","[data-act=new][data-k=cal]"],
  ["Создайте привычку","Повторяющаяся практика со счётчиком и целью. Нажмите «+ Новое», выберите расписание и цель привычки.","habits","[data-act=new][data-k=habit]"],
  ["Откройте блок времени","На карте выберите направление или создайте своё. Опишите фактический этап и создайте текущий этап.","map","[data-act=go][data-s=block]|[data-act=block-new]"],
  ["Добавьте цель этапа и свяжите с ней задание","Внутри текущего этапа нажмите «+ Цель». Затем откройте задание и выберите эту цель — оно «ведёт к цели». Там же можно заполнить «если — то».","goal","[data-act=goal-new]|[data-act=stage-new]"],
  ["Завершите день и загляните в недельную сессию","Внизу Конструктора есть «Завершить день» — необязательный приятный ритуал. Вопросы о неделе — в «Разделы» → «Стратегические сессии».","day","[data-act=ritual]"]
];
const HELPER={open:false,idx:null};
const onbNext=()=>{const o=S.settings.onboarding;return ONB.findIndex((_,i)=>!o.done[i]&&!o.skipped[i])};
const HELPER_SVG='<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 8V4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="3.6" r="2" fill="currentColor"/><rect x="6" y="8.5" width="20" height="17" rx="7" stroke="currentColor" stroke-width="2"/><circle cx="12.5" cy="16.5" r="1.9" fill="currentColor"/><circle cx="19.5" cy="16.5" r="1.9" fill="currentColor"/><path d="M12.8 20.6c1.9 1.4 4.5 1.4 6.4 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function renderHelper(){
  let btn=$("#helper"),pop=$("#helper-pop");
  const o=S&&S.settings.onboarding;
  if(!S||!META.space||!o||!o.on){if(btn)btn.remove();if(pop)pop.remove();HELPER.open=false;return}
  const next=onbNext();
  if(!btn){btn=document.createElement("button");btn.id="helper";btn.className="helper";btn.dataset.act="helper";document.body.appendChild(btn)}
  for(const el of [btn,pop].filter(Boolean)){el.dataset.revision=S.revision||0;el.dataset.space=META.space}
  btn.classList.toggle("open",HELPER.open);
  btn.setAttribute("aria-expanded",String(HELPER.open));
  btn.setAttribute("aria-label",next<0?"Помощник: сопровождение пройдено":"Помощник: шаг "+(next+1)+" из 7");
  btn.innerHTML=HELPER_SVG+'<span class="hb">'+(next<0?"✓":(next+1)+"/7")+'</span>';
  if(!HELPER.open){if(pop)pop.remove();return}
  if(!pop){pop=document.createElement("section");pop.id="helper-pop";pop.className="helper-pop";pop.setAttribute("aria-label","Помощник");document.body.appendChild(pop)}
  pop.dataset.revision=S.revision||0;pop.dataset.space=META.space;
  let i=HELPER.idx;if(i===null||i<0||i>6)i=next<0?6:next;HELPER.idx=i;
  const prog='<div class="hp-prog">'+ONB.map((_,k)=>'<i class="'+(o.done[k]?'done':o.skipped[k]?'skip':k===i?'cur':'')+'"></i>').join("")+'</div>';
  const head='<div class="hp-head"><span class="hp-step">Шаг '+(i+1)+' из 7'+(o.done[i]?' · сделано':o.skipped[i]?' · пропущен':'')+'</span><span class="grow"></span>'+
    '<button class="ib" data-act="hp-nav" data-d="-1" aria-label="Предыдущий шаг" '+(i===0?'disabled':'')+'>‹</button><button class="ib" data-act="hp-nav" data-d="1" aria-label="Следующий шаг" '+(i===6?'disabled':'')+'>›</button>'+
    '<button class="ib" data-act="helper" aria-label="Свернуть помощника">✕</button></div>';
  const allDone=next<0;
  pop.innerHTML=head+prog+(allDone&&i===6&&(o.done[6]||o.skipped[6])?
    '<h3>Сопровождение пройдено</h3><p>Все семь шагов позади. Помощник может остаться рядом — листайте шаги стрелками — или исчезнуть.</p><div class="row"><button class="btn primary" data-act="hp-off">Убрать помощника</button><button class="btn" data-act="hp-all">Все шаги</button></div>':
    '<h3>'+esc(ONB[i][0])+'</h3><p>'+esc(ONB[i][1])+'</p><div class="row"><button class="btn primary" data-act="hp-show">Показать где</button>'+
    ((o.done[i]||o.skipped[i])?'<button class="btn" data-act="hp-reset">Вернуть в план</button>':'<button class="btn" data-act="hp-done">Сделано</button><button class="btn ghost" data-act="hp-skip">Пропустить</button>')+'</div>');
}
function helperGo(i){
  const st=ONB[i];
  closeAllSheets();
  if(st[2]==="goal"){
    const b=activeBlocks().find(x=>x.currentStageId&&blockVisible(x));
    if(b){NAV.tab="map";NAV.stack=[{s:"map",p:{}},{s:"block",p:{id:b.id,view:"current"}}];render();window.scrollTo(0,0)}
    else goTab("map");
  }else if(["day","map","inbox","home"].includes(st[2]))goTab(st[2]);
  else{if(curScr().s!==st[2])go(st[2],{})}
  HELPER.open=false;renderHelper();
  setTimeout(()=>{
    st[3].split("|").forEach(sel=>{
      const el=$(sel);if(!el)return;
      el.classList.add("pulse");setTimeout(()=>el.classList.remove("pulse"),6000);
    });
    const first=st[3].split("|").map(sel=>$(sel)).find(Boolean);
    if(first&&first.id!=="fab")first.scrollIntoView({block:"center",behavior:"smooth"});
  },120);
}
ACT["helper"]=()=>{HELPER.open=!HELPER.open;if(HELPER.open)HELPER.idx=null;renderHelper()};
ACT["hp-nav"]=el=>{HELPER.idx=Math.max(0,Math.min(6,(HELPER.idx||0)+(+el.dataset.d)));renderHelper()};
ACT["hp-show"]=()=>helperGo(HELPER.idx);
ACT["hp-done"]=()=>{const i=HELPER.idx;tx(()=>{S.settings.onboarding.done[i]=true;delete S.settings.onboarding.skipped[i]},"Шаг "+(i+1)+" отмечен");HELPER.idx=null;renderHelper()};
ACT["hp-skip"]=()=>{const i=HELPER.idx;tx(()=>{S.settings.onboarding.skipped[i]=true},"Шаг "+(i+1)+" пропущен");HELPER.idx=null;renderHelper()};
ACT["hp-reset"]=()=>{const i=HELPER.idx;tx(()=>{delete S.settings.onboarding.done[i];delete S.settings.onboarding.skipped[i]});HELPER.idx=i;renderHelper()};
ACT["hp-all"]=()=>{HELPER.open=false;closeAllSheets();go("learn",{})};
ACT["hp-off"]=()=>{HELPER.open=false;tx(()=>{S.settings.onboarding.on=false},"Помощник убран. Включить снова — в «Настройках» или «Обучении»")};
ACT["onb-go"]=el=>{HELPER.open=true;HELPER.idx=+el.dataset.i;helperGo(+el.dataset.i)};
ACT["onb-done"]=el=>tx(()=>{S.settings.onboarding.done[el.dataset.i]=true},"Шаг отмечен");
ACT["onb-skip"]=el=>tx(()=>{S.settings.onboarding.skipped[el.dataset.i]=true},"Шаг пропущен. Вернуться можно в «Обучении»");
ACT["onb-reset"]=el=>tx(()=>{delete S.settings.onboarding.done[el.dataset.i];delete S.settings.onboarding.skipped[el.dataset.i]});
function onboardingCard(){return ""}
SCR.learn=()=>{
  curScr().title="Обучение";
  const o=S.settings.onboarding;
  const ch=["Карта жизни и блоки","Этапы: факт, текущий, планируемые","Задания, привычки, квесты","Конструктор дня и темп","Невыполненные и календарь","Монеты, опыт и бонусы","Принятые решения и Цена слова","Стратегические сессии"];
  return '<h1>Обучение</h1><h2>Интерактивный пример</h2><div class="card"><p>Вымышленная жизнь с готовыми блоками, этапами, делами и историей. Ваши данные не затрагиваются.</p><button class="btn s primary" data-act="'+(S.space==="demo"?"tab":"space-demo")+'" data-v="home">'+(S.space==="demo"?"Вы уже в примере":"Открыть пример")+'</button></div>'+
    '<h2>Видеоглавы</h2><div class="list">'+ch.map((c,i)=>'<div class="item dim"><div class="body"><div class="t">'+(i+1)+'. '+c+'</div><div class="meta">Видео готовится</div></div></div>').join("")+'</div>'+
    '<h2>Семидневное сопровождение</h2><div class="card"><label class="tog" style="margin-top:0"><input type="checkbox" data-set="onb" '+(o.on?'checked':'')+'><span>Включено</span></label>'+ONB.map((s,i)=>'<div class="mini"><div class="t"><b>'+(i+1)+'.</b> '+s[0]+'<div class="meta">'+s[1]+'</div></div>'+(o.done[i]?'<span class="pill good">сделано</span>':o.skipped[i]?'<span class="pill">пропущено</span>':'')+((o.done[i]||o.skipped[i])?'<button class="btn ghost s" data-act="onb-reset" data-i="'+i+'">Вернуть</button>':'<button class="btn s" data-act="onb-go" data-i="'+i+'">Показать</button>')+'</div>').join("")+'</div>';
};

/* ---------- welcome (first launch) ---------- */
function renderWelcome(){
  $("nav.tabs").hidden=true;$("#fab").hidden=true;
  $("#app").innerHTML='<div style="padding-top:40px"><div class="brand" style="font-size:26px">LifeGame</div><p class="lead" style="margin-top:8px">Связать представление о желаемой жизни с тем, что делаешь сегодня. Стратегия, день, факты и пересмотр — в одном цикле, с игровыми наградами.</p>'+
    '<div class="list" style="margin-top:20px"><button class="tile" data-act="welcome" data-v="my"><b>Начать свою жизнь в LifeGame</b><span class="meta">Восемь исходных блоков. Можно начать с одного дела.</span></button>'+
    '<button class="tile" data-act="welcome" data-v="demo"><b>Посмотреть пример</b><span class="meta">Вымышленная жизнь с гитарой, здоровьем и историей. Всё можно нажимать.</span></button></div>'+
    '<p class="meta" style="margin-top:16px">Обучающие видео, LifeGame Lite и семидневное сопровождение включаются после выбора.</p></div>';
}
ACT["welcome"]=el=>{META.space=el.dataset.v;saveMeta();S=loadSpace(META.space);if(!corruptSpace)save();goTab("home");if(el.dataset.v==="my"&&!corruptSpace){S.ui.seenStart=true;save();startMySheet()}};

/* Feedback reads the committed ledger; it never changes the amount of a reward. */
let walletMotion=null,walletFrame=0;
function paintWallet(n){$$('[data-wallet]').forEach(el=>el.textContent='● '+num(Math.round(n)));$$('.hero-coins').forEach(el=>el.textContent=num(Math.round(n)))}
function stopWallet(){cancelAnimationFrame(walletFrame);walletMotion=null;$$('.coin-flight').forEach(el=>el.remove());if(S)paintWallet(coins())}
function animateWallet(before,after){
  if(after<=before||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches){stopWallet();return}
  const start=walletMotion?.value??before;cancelAnimationFrame(walletFrame);$$('.coin-flight').forEach(el=>el.remove());
  const target=$('[data-wallet]');if(!target)return;
  const r=target.getBoundingClientRect(),badge=document.createElement('span');badge.className='coin-flight';badge.textContent='+'+num(after-before);badge.setAttribute('aria-hidden','true');badge.style.left=Math.min(innerWidth-75,Math.max(15,r.left-22))+'px';badge.style.top=Math.max(85,r.bottom+90)+'px';document.body.append(badge);
  walletMotion={start,end:after,value:start,at:performance.now(),space:META.space};paintWallet(start);
  const frame=now=>{const m=walletMotion;if(!m)return;if(m.space!==META.space||coins()!==m.end){stopWallet();return}const p=Math.min(1,Math.max(0,(now-m.at-420)/1450));m.value=m.start+(m.end-m.start)*(1-Math.pow(1-p,3));paintWallet(m.value);if(p<1)walletFrame=requestAnimationFrame(frame);else{badge.remove();walletMotion=null}};
  walletFrame=requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopWallet()});
function backupPrompt(){
  if(META.space!=='my'||corruptSpace||S.settings.backupSnooze&&today()<S.settings.backupSnooze||daysBetween(S.settings.lastExport||S.created,today())<7)return '';
  const hasWork=['tasks','habits','quests','cal','goals','inbox','facts','decisions'].some(k=>S[k].length);if(!hasWork)return '';
  return '<div class="card" style="margin-top:10px"><b>Сохранить копию на эти дни?</b><p class="meta">Данные живут в этом браузере. Внешний JSON поможет перенести или восстановить прогресс.</p><div class="row"><button class="btn s" data-act="export">Скачать копию</button><button class="btn s ghost" data-act="backup-later">Через 3 дня</button></div></div>';
}
function backupSettings(){
  let daily='Появится после сохранения',last='Пока нет';try{daily=human(IO.daily(KEYS[META.space]).day)}catch{}try{const data=IO.backup(KEYS[META.space]);last=short(data.lastProcessed)+' · '+data.facts.length+' записей выполнения'}catch{}
  return '<div style="margin-top:10px"><p class="meta">Последний запрос экспорта: '+(S.settings.lastExport?short(S.settings.lastExport):'ещё не было')+'. Файл нужно сохранить на устройстве.</p><p class="small">Копия на начало дня: '+esc(daily)+'</p><button class="btn s" data-act="restore-backup" data-v="daily">Посмотреть дневную копию</button><p class="small">Последняя исправная: '+esc(last)+'</p><button class="btn s" data-act="restore-backup" data-v="last">Посмотреть предыдущую копию</button><p class="meta">Обе копии в этом браузере. Восстановление — только после просмотра и подтверждения.</p></div>';
}
ACT['backup-later']=()=>tx(()=>{S.settings.backupSnooze=addDays(today(),3)},'Напомню через 3 дня');
ACT['restore-backup']=async el=>{
  let data,label;try{if(el.dataset.v==='daily'){const v=IO.daily(KEYS[META.space]);data=v.data;label='На начало '+human(v.day)}else{data=IO.backup(KEYS[META.space]);label='Предыдущая исправная копия, данные до '+human(data.lastProcessed)}}catch(e){toast(e.message);return}
  openSheet('Проверить резервную копию','<p>'+esc(label)+'</p><p class="small">Заданий: '+data.tasks.length+' · привычек: '+data.habits.length+' · календарных дел: '+data.cal.length+' · выполнений: '+data.facts.filter(f=>!f.cancelled).length+'</p><div class="row"><button class="btn" data-act="backup-download">Скачать эту копию</button><button class="btn danger" data-act="backup-apply">Восстановить её</button><button class="btn" data-act="sheet-close">Закрыть</button></div>');
  const sheet=topSheet();sheet._backupData=cloneState(data);sheet._backupLabel=label;
};
ACT['backup-download']=()=>{const el=topSheet();if(el?._backupData)downloadFile({app:'LifeGame Personal',format:'personal-1',data:el._backupData},'LifeGame-backup-'+el._backupData.lastProcessed+'.json')};
ACT['backup-apply']=async()=>{const el=topSheet(),value=el?._backupData;if(!value)return;const ok=await ask({title:'Заменить текущее пространство?',text:el._backupLabel+'. Текущий прогресс будет заменён этой копией. Сначала скачайте текущие данные, если они нужны.',ok:'Восстановить',danger:true});if(!ok)return;replaceSpace(value);closeAllSheets();goTab('home');toast('Восстановлено из выбранной копии')};

/* ---------- test date ---------- */
ACT["test-menu"]=()=>{
  openSheet("Тестовая дата",'<p class="meta">Инструмент демо: сдвигает «сегодня», чтобы проверить расписания, пропуски, сессии и сроки. В настоящем приложении его нет.</p><div class="list" style="margin-top:8px">'+
    '<button class="btn block primary" data-act="next-day">Следующий день → '+esc(human(addDays(today(),1)))+'</button>'+
    '<button class="btn block" data-act="next-week">Через неделю → '+esc(short(addDays(today(),7)))+'</button>'+
    (META.offset?'<button class="btn block" data-act="real-day">Вернуться к настоящей дате</button>':'')+'</div><p class="meta" style="margin-top:8px">Назад во времени перейти нельзя: прошедшие дни уже разобраны на пропуски.</p>');
};
function shiftDays(n){if(META.space!=='demo'){toast('Тестовая дата доступна только в примере');return}META.offset=(META.offset||0)+n;saveMeta();closeAllSheets();S.ui.showHidden=false;processDays();save();render();toast("Сегодня "+human(today()))}
ACT["next-day"]=()=>shiftDays(1);
ACT["next-week"]=()=>shiftDays(7);
ACT["real-day"]=()=>{
  if(addDays(realToday(),0)<S.lastProcessed){toast("Настоящая дата раньше уже разобранных дней. Данные останутся, пропуски не пересчитываются.")}
  META.offset=0;saveMeta();closeAllSheets();if(S.lastProcessed>today())S.lastProcessed=today();render();save();
};

ACT['recovery-export']=()=>{try{const raw=META.space?localStorage.getItem(KEYS[META.space]):localStorage.getItem(KEYS.meta);downloadFile(raw||'','LifeGame-recovery-raw.json')}catch(e){toast(e.message)}};
ACT['recovery-backup']=()=>{try{const data=IO.backup(KEYS[META.space]);downloadFile({app:'LifeGame Personal',format:'personal-1',data},'LifeGame-previous-good.json')}catch(e){toast(e.message)}};
ACT['load-fresh']=async()=>{if(SHEETS.some(s=>s.el.querySelector('form'))&&!await ask({title:'Обновить данные?',text:'Открытые черновики будут закрыты. Скопируйте нужный текст перед обновлением.',ok:'Обновить'}))return;await IO.exclusive(()=>{closeAllSheets();if(META.space)S=loadSpace(META.space);render()})};

ACT['request-notifications']=async()=>{if(!('Notification' in window)){toast('В этом браузере доступны напоминания внутри открытого приложения');return}try{const result=await Notification.requestPermission();toast(result==='granted'?'Системные уведомления разрешены':'Напоминания останутся внутри приложения')}catch{toast('Напоминания внутри приложения доступны; системные зависят от браузера')}};
let reminderBusy=false,lastReminderMinute='';
function showReminder(item){
  let box=$('#calendar-reminder');if(!box){box=document.createElement('div');box.id='calendar-reminder';box.className='reminder-note';box.setAttribute('role','status');document.body.append(box)}
  if(box)box.innerHTML='<b>'+esc(item.title)+'</b><span>'+esc(item.time)+' · календарь</span><button class="btn s">Открыть</button><button class="ib" aria-label="Закрыть напоминание">✕</button>';
  box.querySelector('.btn').onclick=()=>{box.remove();runGuarded(()=>go('calendar',{}))};box.querySelector('.ib').onclick=()=>box.remove();
  if('Notification' in window&&Notification.permission==='granted'){try{navigator.serviceWorker?.ready.then(reg=>reg.showNotification(item.title,{body:'Запланировано в LifeGame на '+item.time,tag:'lifegame-'+item.id,icon:'./icon-192.png',data:{url:new URL('./?view=calendar',location.href).href}})).catch(()=>{})}catch{}}
}
function reminderCandidates(){
  const now=Date.now(),out=[];if(!S.settings.reminders||S.creative.on&&S.creative.mute)return out;
  const loc=curLocObj();
  for(const c of S.cal){if(!available(c)||!c.reminder||loc?.muteOther&&locHides(c,loc))continue;
    for(const o of Cal.range(c,addDays(today(),-1),addDays(today(),1))){if(!o.time||calDone(c,o.key))continue;
      const stamp=new Date(o.date+'T'+o.time+':00').getTime(),lead=c.reminderLead??15,receipt=o.date+'T'+o.time+'|'+lead;
      if(now>=stamp-lead*60000&&now<=stamp+3600000&&c.reminderReceipts?.[o.key]!==receipt&&!(c.notifiedDates||[]).includes(o.key))out.push({id:c.id,key:o.key,receipt,title:c.title,time:o.time,date:o.date});
    }
  }return out;
}
function checkReminders(){
  if(!S||META.space==='demo'||corruptSpace||reminderBusy)return;
  const minute=Math.floor(Date.now()/60000)+'|'+(currentLoc().id||'*');if(minute===lastReminderMinute)return;lastReminderMinute=minute;
  if(!reminderCandidates().length)return;reminderBusy=true;
  runGuarded(()=>{const notifications=reminderCandidates();if(!notifications.length)return;for(const o of notifications){const c=get('cal',o.id);(c.reminderReceipts||={})[o.key]=o.receipt}save();for(const o of notifications)showReminder(o)},null,true).finally(()=>reminderBusy=false);
}
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='OPEN_CALENDAR')runGuarded(()=>go('calendar',{}))});

// UI clocks do not mutate the ledger. Background mutations use the same write lock.
let clockBusy=false;
setInterval(()=>{
  if(!S)return;
  checkReminders();
  $$('[data-cd]').forEach(el=>{el.textContent=cdText(el.dataset.cd).t});
  if(S.timer.state==='running')$$('[data-timer-left]').forEach(el=>el.textContent=timerLeft());
  if(!clockBusy&&(S.lastProcessed<today()||S.loc.lastSeen!==(currentLoc().id||null)||S.days[today()]?.locProfileSeen===undefined||S.timer.state==='running'&&Date.now()>=S.timer.endsAt)){
    clockBusy=true;runGuarded(()=>{
      if(S.timer.state==='running'&&Date.now()>=S.timer.endsAt){S.timer.state='done';S.timer.remaining=0;save();toast('Подход закончен. Подтвердите минуты');if(SHEETS.some(s=>s.key==='timer'))refreshSheet('timer',timerBody)}render();
    },null,true).finally(()=>clockBusy=false);
  }
},1000);
window.addEventListener('storage',e=>{
  if(!META.space||e.key!==KEYS[META.space]||e.newValue===IO.snapshots.get(e.key))return;
  if(activeOperation||SHEETS.some(s=>s.el.querySelector('form'))){storageIssue='Есть изменения из другой вкладки. Черновик оставлен. После копирования нужного текста обновите данные.';showStoragePanel();return}
  const currentSpace=META.space;S=loadSpace(currentSpace);render();if(!corruptSpace)toast('Данные из другой вкладки загружены');
});
loadMeta();
if(META.space){await IO.exclusive(()=>{S=loadSpace(META.space);if(!corruptSpace){try{const rollover=processDays(),place=locTick();if(rollover||place||IO.snapshots.get(KEYS[META.space])===null)save()}catch(e){storageIssue=e.message}}})}
render();if(S&&new URLSearchParams(location.search).get('view')==='calendar')go('calendar',{});
// Offline installation and update notices are implemented in pwa.js.

})();
