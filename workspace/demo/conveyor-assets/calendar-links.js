/* One calendar entity, optional block link, temporary references only. */
'use strict';
(()=>{
 const TTL=300000,kindSet=new Set(['task','calendar']);
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
 const fail=m=>{throw new Error(m)};
 function normalize(data,now=Date.now()){
  const blocks=new Set(data.blocks.map(b=>b.id));
  for(const e of data.calendarEntries){if(e.blockId===undefined)e.blockId=null;if(e.blockId!==null&&(typeof e.blockId!=='string'||!blocks.has(e.blockId)))fail('Календарная запись связана с неизвестным блоком.');}
  if(data.recentCaptures===undefined)data.recentCaptures=[];
  if(!Array.isArray(data.recentCaptures)||data.recentCaptures.length>1000)fail('Повреждён список недавно добавленного.');
  const seen=new Set(),tasks=new Set(data.tasks.map(t=>t.id)),calendar=new Set(data.calendarEntries.map(e=>e.id));
  for(const r of data.recentCaptures){if(!object(r)||!kindSet.has(r.kind)||typeof r.id!=='string'||!r.id||!Number.isSafeInteger(r.until)||r.until<0||r.until>8640000000000000)fail('Повреждена временная ссылка на дело.');const key=r.kind+':'+r.id;if(seen.has(key))fail('Повторная временная ссылка на дело.');seen.add(key);}
  data.recentCaptures=data.recentCaptures.filter(r=>r.until>now&&r.until<=now+TTL&&(r.kind==='task'?tasks:calendar).has(r.id));return data;
 }
 function remember(data,kind,id,now=Date.now()){
  if(!kindSet.has(kind))fail('Неизвестный вид дела.');
  if(!data.recentCaptures)data.recentCaptures=[];
  data.recentCaptures=data.recentCaptures.filter(r=>r.until>now&&(r.kind!==kind||r.id!==id));
  data.recentCaptures.unshift({kind,id,until:now+TTL});data.recentCaptures=data.recentCaptures.slice(0,1000);
 }
 function recent(data,now=Date.now()){
  const tasks=new Map(data.tasks.map(t=>[t.id,t])),calendar=new Map(data.calendarEntries.map(e=>[e.id,e]));
  return (data.recentCaptures||[]).filter(r=>r.until>now&&r.until<=now+TTL).map(r=>({...r,item:(r.kind==='task'?tasks:calendar).get(r.id)})).filter(r=>r.item&&(r.kind!=='task'||r.item.archivedAt===null)).sort((a,b)=>b.until-a.until);
 }
 globalThis.LifeGameCalendarLinks={TTL,normalize,remember,recent};
})();
