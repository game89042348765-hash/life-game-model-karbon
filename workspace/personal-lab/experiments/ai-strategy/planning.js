/* Pure calendar recurrence model. Nominal date identifies an occurrence after a move. */
(function(){'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),iso=d=>d.toISOString().slice(0,10),date=s=>new Date(s+'T12:00:00Z');
const valid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(date(s).getTime())&&iso(date(s))===s;
const add=(s,n)=>{const d=date(s);d.setUTCDate(d.getUTCDate()+n);return iso(d)},weekday=s=>date(s).getUTCDay()||7;
const types=['none','daily','weekly','days','monthly','yearly'];
const repeats=c=>(c.repeat?.type||'none')!=='none';
function base(c,key){if(!valid(key)||key<c.date)return false;const d=date(key),a=date(c.date),r=c.repeat||{type:'none',days:[]},day=r.anchorDay||a.getUTCDate(),month=r.anchorMonth?r.anchorMonth-1:a.getUTCMonth();switch(r.type){case'none':return key===c.date;case'daily':return true;case'weekly':return weekday(key)===weekday(c.date);case'days':return r.days.includes(weekday(key));case'monthly':return d.getUTCDate()===Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate());case'yearly':return d.getUTCMonth()===month&&d.getUTCDate()===Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),month+1,0)).getUTCDate());default:return false}}
function has(c,key){return base(c,key)&&(!c.until||key<=c.until||(c.retained||[]).includes(key))}
function occurrence(c,key){if(!has(c,key))return null;const x=c.exceptions?.[key];if(x?.cancelled)return null;return {key,date:x?.date||key,time:x?.time??c.time??''}}
function due(c,d){const keys=new Set([d,...Object.keys(c.exceptions||{})]);return [...keys].map(k=>occurrence(c,k)).filter(o=>o&&o.date===d).sort((a,b)=>(a.time+a.key).localeCompare(b.time+b.key))}
function next(c,from){
 let best=null;const consider=k=>{const o=occurrence(c,k);if(o&&o.date>=from&&(!best||o.date+o.time+o.key<best.date+best.time+best.key))best=o};
 for(const k of new Set([...Object.keys(c.exceptions||{}),...(c.retained||[])]))consider(k);
 if(!repeats(c)){consider(c.date);return best}
 for(let d=from>c.date?from:c.date,n=0;n<40000;d=add(d,1),n++){if(c.until&&d>c.until)break;if(best&&d>best.date)break;if(base(c,d)){consider(d);if(best&&best.date===d)break}}
 return best;
}
function range(c,from,to){const out=[];for(let d=from;d<=to;d=add(d,1))out.push(...due(c,d));return out.sort((a,b)=>(a.date+a.time+a.key).localeCompare(b.date+b.time+b.key))}
function ordinal(c,from,key){let n=-1;for(let d=from,i=0;d<=key&&i<40000;d=add(d,1),i++)if(base(c,d))n++;return n}
function nth(c,n){for(let d=c.date,i=0,count=0;i<40000;d=add(d,1),i++)if(base(c,d)){if(count++===n)return d;if(!repeats(c))break}return null}
function split(c,key,patch,newId,protectedKeys=[]){
 if(!has(c,key))throw Error('Появление серии не найдено');const old=clone(c),o=occurrence(old,key)||{date:key};
 const fresh={...clone(old),...clone(patch),id:newId,date:patch.date||o.date,exceptions:{},retained:[],notifiedDates:[],reminderReceipts:{}};
 const delta=Math.round((date(fresh.date)-date(key))/864e5);fresh.until=old.until?add(old.until,delta):null;
 const keep=[...new Set([...(old.retained||[]).filter(k=>k>key),...Object.keys(old.exceptions||{}).filter(k=>k>key),...protectedKeys])].filter(k=>k>=key&&has(old,k));
 c.until=!old.until||add(key,-1)<old.until?add(key,-1):old.until;c.retained=[...new Set([...(old.retained||[]),...keep])];
 for(const k of keep){const number=ordinal(old,key,k),mapped=nth(fresh,number);if(mapped)fresh.exceptions[mapped]={cancelled:true}}
 return fresh;
}
function validate(c){
 if(!valid(c.date))throw Error('Неверная дата календарного дела');
 const r=c.repeat;if(r!==undefined&&(!r||!types.includes(r.type)||!Array.isArray(r.days)||r.days.some(d=>!Number.isInteger(d)||d<1||d>7)||new Set(r.days).size!==r.days.length||r.type==='days'&&!r.days.length))throw Error('Неверное повторение календаря');
 if(r&&(r.anchorDay!==undefined&&(!Number.isInteger(r.anchorDay)||r.anchorDay<1||r.anchorDay>31)||r.anchorMonth!==undefined&&(!Number.isInteger(r.anchorMonth)||r.anchorMonth<1||r.anchorMonth>12)))throw Error('Неверная опорная дата повторения');
 if(c.until!=null&&!valid(c.until))throw Error('Неверная граница серии');
 if(c.retained!==undefined&&(!Array.isArray(c.retained)||c.retained.some(k=>!valid(k))))throw Error('Неверные сохранённые появления');
 if(c.exceptions!==undefined){if(!c.exceptions||typeof c.exceptions!=='object'||Array.isArray(c.exceptions))throw Error('Неверные исключения серии');for(const[k,x]of Object.entries(c.exceptions)){if(!valid(k)||!x||typeof x!=='object'||Array.isArray(x)||x.cancelled!==undefined&&typeof x.cancelled!=='boolean'||x.date!==undefined&&!valid(x.date)||x.time!==undefined&&x.time!==''&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time))throw Error('Неверный перенос появления')}}
 if(c.reminderLead!==undefined&&![0,15,60,1440].includes(c.reminderLead))throw Error('Неверное время напоминания');return c;
}
window.LifeGamePlanning={valid,add,weekday,types,repeats,base,has,occurrence,due,next,range,split,validate};
})();
