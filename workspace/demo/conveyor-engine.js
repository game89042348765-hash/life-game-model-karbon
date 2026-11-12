/* Experimental strategy engine. Used only by strategy-conveyor.html. */
(function(root){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x)),own=(o,k)=>Object.hasOwn(o,k),bad=m=>{throw Error(m)},int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
const dateOK=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const plus=(date,days)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const elapsed=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
const stage=(d,id)=>d.blockStages.items.find(s=>s.id===id),current=(d,b)=>stage(d,d.blockStages.current[b]);
const fact=(d,t,date)=>d.completions.some(c=>c.taskId===t.id&&(t.type==='once'||c.date===date));
const active=(d,t)=>t.archivedAt===null&&d.blocks.some(b=>b.id===t.block&&b.archivedAt===null)&&current(d,t.block)?.id===t.stageId;
function normalize(d,day){
 if(d.conveyor===undefined)d.conveyor={version:1,date:day,budget:45,limit:3,routes:{},plans:{},defer:{},closed:{},reviews:[],events:[],archivedStages:[]};
 const c=d.conveyor;
 if(!c||c.version!==1||!dateOK(c.date)||!int(c.budget,5,480)||!int(c.limit,1,20))bad('Повреждены настройки конвейера.');
 if(c.lastRealDay!==undefined&&!dateOK(c.lastRealDay))bad('Повреждён календарь демо.');
 for(const key of ['routes','plans','defer','closed'])if(!c[key]||typeof c[key]!=='object'||Array.isArray(c[key]))bad('Повреждён маршрут.');
 for(const key of ['reviews','events','archivedStages'])if(!Array.isArray(c[key]))bad('Повреждён журнал маршрута.');
 for(const [id,r]of Object.entries(c.routes))if(!d.blocks.some(b=>b.id===id)||!r||!['strategic','routine'].includes(r.mode)||typeof r.enabled!=='boolean'||!int(r.priority,1,3)||!int(r.reviewEvery,1,90)||!dateOK(r.reviewed))bad('Повреждены параметры блока.');
 // Keep queue metadata aligned with edits/transfers made in the existing task editor.
 const linked=new Set();
 for(const t of d.tasks){
  if(!t.conveyorStep)continue;
  if(typeof t.conveyorStep!=='string'||linked.has(t.conveyorStep))bad('Повторная связь шага с заданием.');linked.add(t.conveyorStep);
  const entry=Object.entries(c.plans).find(([,p])=>Array.isArray(p?.steps)&&p.steps.some(s=>s.id===t.conveyorStep));
  if(!entry)bad('Задание потеряло шаг маршрута.');
  const [sid,p]=entry,s=p.steps.find(s=>s.id===t.conveyorStep);
  if(t.stageId!==sid){if(!stage(d,t.stageId))bad('Шаг перенесён в недоступный этап.');p.steps=p.steps.filter(x=>x!==s);c.plans[t.stageId]||={criterion:'',confirmed:false,steps:[]};c.plans[t.stageId].steps.push(s);}
  t.inDayBuilder=false;s.name=t.name;s.minutes=t.estimateMinutes||s.minutes;if(t.type==='once')s.repeat='once';else if(s.repeat==='once')s.repeat='daily';if(t.archivedAt!==null)s.status='skip';
 }
 const ids=new Set();
 for(const [id,p]of Object.entries(c.plans)){
  if(!stage(d,id)||!p||typeof p.criterion!=='string'||p.criterion.length>2000||!Array.isArray(p.steps)||p.steps.length>200||typeof p.confirmed!=='boolean')bad('Повреждён план этапа.');
  for(const s of p.steps){if(!s||typeof s.id!=='string'||!s.id||ids.has(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>120||!int(s.minutes,1,480)||!['once','daily','weekly'].includes(s.repeat)||!['ready','skip'].includes(s.status))bad('Повреждён шаг маршрута.');ids.add(s.id);}
 }
 for(const v of Object.values(c.defer))if(!dateOK(v))bad('Повреждена дата переноса.');
 return c;
}
function defaults(d,b,day){return d.conveyor.routes[b]||{enabled:false,mode:'strategic',priority:2,reviewEvery:7,reviewed:day}}
function plan(d,s){return d.conveyor.plans[s]||{criterion:'',confirmed:false,steps:[]}}
function taskFor(d,step){return d.tasks.find(t=>t.conveyorStep===step.id)||null}
function eligible(d,p,step,date){
 if(step.status==='skip')return false;
 const at=p.steps.indexOf(step);
 return p.steps.slice(0,at).filter(s=>s.repeat==='once'&&s.status!=='skip').every(s=>{const t=taskFor(d,s);return t&&fact(d,t,date)});
}
function canComplete(d,t,date){
 if(!t.conveyorStep||fact(d,t,date))return true;
 const p=d.conveyor.plans[t.stageId],s=p?.steps.find(s=>s.id===t.conveyorStep);
 return !!(p&&s&&eligible(d,p,s,date));
}
function event(d,type,text,date){d.conveyor.events.push({id:'event-'+d.conveyor.events.length+'-'+date,type,text,date})}
function reconcile(d,day){
 const c=normalize(d,day),date=c.date;d.dayPlans[date]||=[];
 for(const t of d.tasks)if(t.conveyorStep&&t.archivedAt===null&&d.completions.some(x=>x.taskId===t.id&&x.date===date)&&!d.dayPlans[date].includes(t.id))d.dayPlans[date].push(t.id);
 // Rebuild only the generated part of today's plan. Completed records stay untouched.
 d.dayPlans[date]=d.dayPlans[date].filter(id=>{
  const t=d.tasks.find(t=>t.id===id);if(!t?.conveyorStep||fact(d,t,date))return true;
  const r=c.routes[t.block],p=c.plans[t.stageId],s=p?.steps.find(s=>s.id===t.conveyorStep);
  return active(d,t)&&r?.enabled&&s&&eligible(d,p,s,date)&&(!c.defer[id]||c.defer[id]<=date)&&!c.closed[date];
 });
 if(c.closed[date])return;
 const routeEntries=Object.entries(c.routes).filter(([b,r])=>r.enabled&&d.blocks.some(x=>x.id===b&&x.archivedAt===null));
 // Preserve a previous commitment; do not keep generating when a count/time limit is reached.
 const committed=()=>d.tasks.filter(t=>active(d,t)&&d.dayPlans[date].includes(t.id)||d.completions.some(x=>x.taskId===t.id&&x.date===date));
 let safe=0;
 while(safe++<c.limit){
  const assigned=committed(),minutes=assigned.reduce((n,t)=>n+(t.estimateMinutes||10),0);
  if(assigned.length>=c.limit||minutes>=c.budget)break;
  const candidates=[];
  for(const [b,r]of routeEntries){
   const st=current(d,b),p=st&&c.plans[st.id];if(!p)continue;
   // One waiting action per direction. Finishing it lets the next action enter today's plan.
   if(assigned.some(t=>t.block===b&&!fact(d,t,date)))continue;
   for(const step of p.steps){
    if(!eligible(d,p,step,date))continue;
    const t=taskFor(d,step);
    if(t&&(t.archivedAt!==null||!active(d,t)||fact(d,t,date)))continue;
    if(t&&c.defer[t.id]&&c.defer[t.id]>date)continue;
    if(step.repeat==='weekly'&&t){const last=d.completions.filter(x=>x.taskId===t.id).map(x=>x.date).sort().at(-1);if(last&&elapsed(last,date)<7)continue;}
    if(step.minutes>c.budget-minutes)continue;
    const last=d.completions.filter(x=>d.tasks.find(t=>t.id===x.taskId)?.block===b&&x.date===date).length;
    candidates.push({b,r,st,p,step,t,last});break;
   }
  }
  candidates.sort((a,b)=>a.last-b.last||a.r.priority-b.r.priority);
  const pick=candidates[0];if(!pick)break;
  let t=pick.t;
  if(!t){
   const step=pick.step,goal=d.goals.find(g=>g.stageId===pick.st.id&&g.completedDate===null);
   t={id:'conveyor-task:'+step.id,conveyorStep:step.id,name:step.name,reward:25,estimateMinutes:step.minutes,type:step.repeat==='once'?'once':'daily',weekdays:step.repeat==='once'?[]:[1,2,3,4,5,6,7],inDayBuilder:false,block:pick.b,stageId:pick.st.id,goalId:goal?.id||null,leadsToGoal:pick.r.mode==='strategic',favorite:false,archivedAt:null};
   if(d.tasks.some(x=>x.id===t.id))bad('Повторный ID шага.');d.tasks.push(t);
  }
  if(!d.dayPlans[date].includes(t.id))d.dayPlans[date].push(t.id);
 }
}
function parse(text,id){
 const rows=text.split('\n').map(s=>s.trim()).filter(Boolean);if(rows.length>200)bad('Не больше 200 шагов в этапе.');
 return rows.map((line,i)=>{const [name,time='10',repeat='разово']=line.split('|').map(x=>x.trim()),minutes=Number(time),kind={'разово':'once','ежедневно':'daily','еженедельно':'weekly'}[repeat.toLowerCase()];if(!name||name.length>120||!int(minutes,1,480)||!kind)bad('Строка '+(i+1)+': название | минуты | разово / ежедневно / еженедельно.');return{id:id(i),name,minutes,repeat:kind,status:'ready'}});
}
function remaining(d,sid,date){const p=plan(d,sid);return p.steps.filter(s=>s.status!=='skip'&&s.repeat==='once'&&(!taskFor(d,s)||!fact(d,taskFor(d,s),date)))}
function move(d,id,targetBlock,beforeId){
 const s=stage(d,id),before=stage(d,beforeId);if(!s||s.levelKind!=='stage'||s.id===current(d,s.blockId)?.id||s.reached||s.passed)bad('Текущий, пройденный этап и ориентиры не перемещаются.');
 if(!before||before.blockId!==targetBlock||s.id===before.id)bad('Выбери другой этап назначения.');
 const list=d.blockStages.items.filter(x=>x.blockId===targetBlock),opt=list.findIndex(x=>x.levelKind==='optimal');if(list.indexOf(before)>opt||list.indexOf(before)<=list.indexOf(current(d,targetBlock)))bad('Перенос доступен среди будущих этапов до оптимального.');
 const target=d.blocks.find(b=>b.id===targetBlock);if(!target||target.archivedAt!==null)bad('Блок недоступен.');
 s.blockId=targetBlock;s.slot=null;for(const t of d.tasks.filter(t=>t.stageId===id))t.block=targetBlock;for(const g of d.goals.filter(g=>g.stageId===id))g.blockId=targetBlock;
 const all=d.blockStages.items;all.splice(all.indexOf(s),1);all.splice(all.indexOf(before),0,s);event(d,'move','Этап «'+s.name+'» перенесён',d.conveyor.date);
}
function remove(d,id,targetId){
 const s=stage(d,id),target=stage(d,targetId);if(!s||s.levelKind!=='stage'||s.id===current(d,s.blockId)?.id||s.reached||s.passed)bad('Текущий этап, историю и ориентиры сохраняем. Можно удалить будущий обычный этап.');
 if(!target||target.id===id||target.blockId!==s.blockId)bad('Выбери этап для содержимого.');
 if(d.blockStages.items.some(x=>x.lock.stageId===id))bad('Сначала измени условия этапов, зависящих от удаляемого.');
 for(const t of d.tasks.filter(t=>t.stageId===id))t.stageId=targetId;
 for(const g of d.goals.filter(g=>g.stageId===id))g.stageId=targetId;
 const p=d.conveyor.plans[id];if(p){d.conveyor.plans[targetId]||={criterion:'',confirmed:false,steps:[]};d.conveyor.plans[targetId].steps.push(...p.steps);delete d.conveyor.plans[id];}
 d.conveyor.archivedStages.push({...copy(s),removedOn:d.conveyor.date,movedTo:targetId,plan:p?copy(p):null});d.blockStages.items=d.blockStages.items.filter(x=>x.id!==id);event(d,'remove','Удалён этап «'+s.name+'», содержимое перенесено',d.conveyor.date);
}
root.LifeGameConveyor={clock:null,normalize,reconcile,parse,plus,elapsed,defaults,plan,taskFor,eligible,canComplete,remaining,fact,event,move,remove,copy};
})(globalThis);
