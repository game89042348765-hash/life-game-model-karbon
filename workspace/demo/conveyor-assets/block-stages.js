/* Block paths v2. IDs, real tasks/goals and economic receipts stay authoritative. */
'use strict';
(()=>{
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x),id=x=>typeof x==='string'&&x.length>0;
 const fail=text=>{throw new Error(text||'Повреждены этапы блоков.')};
 const list=(d,b)=>d.blockStages.items.filter(s=>s.blockId===b),get=(d,id)=>d.blockStages.items.find(s=>s.id===id)||null;
 const current=(d,b)=>get(d,d.blockStages.current[b]);
 const active=(d,item)=>item.block==='lifegame:inbox'?item.stageId===null:!!item.stageId&&d.blockStages.current[item.block??item.blockId]===item.stageId;
 const optimal=(d,b)=>list(d,b).find(s=>s.levelKind==='optimal')||null;
 const horizon=s=>s.levelKind==='hidden'||s.levelKind==='maximum';
 const unlocked=(d,s)=>!!s&&(!horizon(s)||optimal(d,s.blockId)?.reached===true)&&(s.lock.mode==='open'||s.lock.mode==='stage'&&get(d,s.lock.stageId)?.reached===true);
 const lockText=(d,s)=>horizon(s)&&!optimal(d,s.blockId)?.reached?'Откроется после оптимального этапа':s.lock.mode==='manual'?'Этап закрыт вручную':s.lock.mode==='stage'?'Дойти до этапа «'+(get(d,s.lock.stageId)?.name||'Недоступный этап')+'»':'';
 function define(o,k,value){Object.defineProperty(o,k,{value,writable:true,enumerable:true,configurable:true})}
 function newStage(stageId,blockId,name,extra={}){return {id:stageId,blockId,name,meaning:'',description:'',levelKind:'stage',slot:null,passed:false,reached:false,lock:{mode:'open',stageId:null},...extra}}
 function validate(d){
  if(d.blockStages===undefined)d.blockStages={version:1,items:[],current:{}};
  const m=d.blockStages;if(!object(m)||![1,2].includes(m.version)||!Array.isArray(m.items)||!object(m.current))fail();
  if(m.paths===undefined)m.paths={};if(!object(m.paths))fail('Повреждены описания путей.');
  const blocks=new Map(d.blocks.map(b=>[b.id,b])),ids=new Set();
  for(const s of m.items){
   if(!object(s))fail();if(s.prepared!==undefined&&typeof s.prepared!=='boolean')fail('Повреждена подготовка этапа.');
   if(s.description===undefined)s.description='';if(s.levelKind===undefined)s.levelKind='stage';if(s.slot===undefined)s.slot=null;if(s.passed===undefined)s.passed=false;
   if(!object(s)||!id(s.id)||ids.has(s.id)||!blocks.has(s.blockId)||typeof s.name!=='string'||!s.name.trim()||s.name.length>120||typeof s.meaning!=='string'||s.meaning.length>2000||typeof s.description!=='string'||s.description.length>2000||!['stage','optimal','hidden','maximum'].includes(s.levelKind)||(s.slot!==null&&!['next','pre','optimal','hidden','maximum'].includes(s.slot))||typeof s.reached!=='boolean'||typeof s.passed!=='boolean'||!object(s.lock)||!['open','manual','stage'].includes(s.lock.mode)||(s.lock.mode==='stage'?!id(s.lock.stageId):s.lock.stageId!==null))fail();
   ids.add(s.id);s.name=s.name.trim();s.meaning=s.meaning.trim();s.description=s.description.trim();
  }
  const makeId=base=>{let key=base;while(ids.has(key))key='path:'+key;ids.add(key);return key};
  const append=(b,name,kind,slot)=>{const s=newStage(makeId(slot+'-stage:'+b),b,name,{levelKind:kind,slot});const last=m.items.map(x=>x.blockId).lastIndexOf(b);m.items.splice(last+1,0,s);return s};
  for(const b of d.blocks){
   if(!list(d,b.id).length){const s=newStage(makeId('initial-stage:'+b.id),b.id,'Сейчас',{meaning:b.meaning||'',reached:true});m.items.push(s);define(m.current,b.id,s.id)}
   if(!Object.hasOwn(m.current,b.id)||!id(m.current[b.id]))fail('У блока не выбран текущий этап.');
   const s=get(d,m.current[b.id]);if(!s||s.blockId!==b.id||!s.reached)fail('Неверный текущий этап блока.');
   if(!Object.hasOwn(m.paths,b.id)){
    define(m.paths,b.id,{mode:'short',fact:'',configured:false});
    if(list(d,b.id).length===1)append(b.id,'Планируемый','stage','next');
    if(!optimal(d,b.id))append(b.id,'Оптимальный','optimal','optimal');
    if(!list(d,b.id).some(x=>x.levelKind==='hidden'))append(b.id,'Неизвестный','hidden','hidden');
   }
   const p=m.paths[b.id];if(!object(p)||!['short','full'].includes(p.mode)||typeof p.fact!=='string'||p.fact.length>2000||typeof p.configured!=='boolean')fail('Повреждено описание блока.');p.fact=p.fact.trim();for(const key of ['futurePlan','futureOptimal','futureMaximum']){if(p[key]===undefined)p[key]='';if(typeof p[key]!=='string'||p[key].length>2000)fail('Повреждён будущий ориентир.');p[key]=p[key].trim();}
   if(list(d,b.id).filter(s=>s.levelKind==='optimal').length!==1)fail('У блока должен быть один оптимальный этап.');
   b.meaning=s.meaning;
  }
  for(const key of [...Object.keys(m.current),...Object.keys(m.paths)])if(!blocks.has(key))fail('У пути нет блока.');
  const indegree=new Map(m.items.map(s=>[s.id,0])),edges=new Map();
  const edge=(from,to)=>{if(!edges.has(from))edges.set(from,[]);edges.get(from).push(to);indegree.set(to,indegree.get(to)+1)};
  for(const s of m.items){
   if(s.lock.mode==='stage'){const source=get(d,s.lock.stageId);if(!source||source.id===s.id)fail('Выбери другой существующий этап.');edge(source.id,s.id)}
   if(horizon(s))edge(optimal(d,s.blockId).id,s.id);
   if(m.current[s.blockId]===s.id&&!unlocked(d,s))fail('Текущий этап нельзя закрыть. Сначала перейди к другому этапу.');
  }
  const queue=[...indegree].filter(([,n])=>!n).map(([key])=>key);for(let i=0;i<queue.length;i++)for(const to of edges.get(queue[i])||[]){indegree.set(to,indegree.get(to)-1);if(!indegree.get(to))queue.push(to)}if(queue.length!==m.items.length)fail('Условия этапов образуют замкнутый круг.');
  for(const g of d.goals){if(g.stageId===undefined)g.stageId=m.current[g.blockId];const s=get(d,g.stageId);if(!s||s.blockId!==g.blockId)fail('Цель связана с неверным этапом.')}
  const goals=new Map(d.goals.map(g=>[g.id,g]));
  for(const t of d.tasks){if(t.stageId===undefined)t.stageId=t.block==='lifegame:inbox'?null:goals.get(t.goalId)?.stageId||m.current[t.block];const s=t.stageId===null?null:get(d,t.stageId);if(t.block==='lifegame:inbox'?t.stageId!==null:!s||s.blockId!==t.block)fail('Задание связано с неверным этапом.');if(t.goalId&&goals.get(t.goalId)?.stageId!==t.stageId)fail('Задание и его цель должны относиться к одному этапу.')}
  m.version=2;return m;
 }
 function switchTo(d,id,options={}){const s=get(d,id),b=s&&d.blocks.find(b=>b.id===s.blockId);if(!s||!b||b.archivedAt!==null)fail('Этап недоступен.');if(!unlocked(d,s))fail(lockText(d,s));const old=current(d,b.id);if(options.passPrevious&&old&&old.id!==id)old.passed=true;d.blockStages.current[b.id]=s.id;s.reached=true;b.meaning=s.meaning;if(s.levelKind==='optimal')for(const h of list(d,b.id))if(h.levelKind==='hidden'&&['Неизвестный','Скрытые уровни'].includes(h.name))h.name='Следующий за оптимальным';}
 function insert(d,s,anchorId,direction='after'){const anchor=get(d,anchorId);if(!anchor||anchor.blockId!==s.blockId)fail('Место добавления этапа изменилось.');if(get(d,s.id))fail('Этап уже существует.');const at=d.blockStages.items.findIndex(x=>x.id===anchorId);d.blockStages.items.splice(at+(direction==='before'?0:1),0,s)}
 globalThis.LifeGameStages={validate,list,get,current,active,unlocked,lockText,switchTo,newStage,insert,optimal};
})();
