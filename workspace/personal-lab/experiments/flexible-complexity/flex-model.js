/* LAB-009. Pure policy layer; no storage, clock override, network or economy. */
(function(){
  'use strict';
  const COLL={task:'tasks',habit:'habits',quest:'quests',cal:'cal'};
  const copy=x=>JSON.parse(JSON.stringify(x));
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const validDay=x=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;const [y,m,d]=x.split('-').map(Number),v=new Date(y,m-1,d,12);return v.getFullYear()===y&&v.getMonth()===m-1&&v.getDate()===d};
  const validRef=x=>typeof x==='string'&&/^(task|habit|quest|cal):[A-Za-z0-9_-]{1,120}$/.test(x);
  const baseRef=(k,id)=>k+':'+String(id).split('@')[0];
  const options=()=>({calendar:false,notifications:false,stats:false});
  const defaults=()=>({v:1,view:'full',introduced:false,members:[],options:options(),sequence:0,changes:[]});
  const full=()=>({policy:'full',refs:[],options:options()});
  const ensure=s=>{if(s.flex===undefined)s.flex=defaults();return s.flex};
  function find(s,r){const i=r.indexOf(':');return s[COLL[r.slice(0,i)]]?.find(x=>x.id===r.slice(i+1))}
  function selectable(s,r){
    const x=find(s,r);if(!x||!(x.status==='active'||r.startsWith('quest:')&&x.status==='completed'))return false;
    return (!x.blockId||s.blocks.some(b=>b.id===x.blockId&&b.status==='active'))&&(!x.stageId||s.stages.some(t=>t.id===x.stageId&&t.status==='open'));
  }
  function at(s,date){
    let result=full();for(const e of s.flex?.changes||[]){if(e.from>date)break;result=e}return result;
  }
  const basic=s=>s.flex?.view==='basic';
  function enabled(s,k,id,date){const p=at(s,date);return p.policy==='full'||(k!=='cal'||p.options.calendar)&&p.refs.includes(baseRef(k,id))}
  function inPlan(s,k,item,date){return at(s,date).policy==='full'?!!item.inDay:enabled(s,k,item.id,date)}
  function notify(s,c,date){if(date<s.lastProcessed)return false;const p=at(s,date);return p.policy==='full'?!!s.settings.reminders:p.options.notifications&&enabled(s,'cal',c.id,date)}
  function dateGuard(s,date){
    if(!validDay(date)||date<s.lastProcessed)throw Error('Дата раньше уже обработанной истории. Верните текущую дату перед изменением режима.');
  }
  function record(s,date,policy){
    dateGuard(s,date);const f=ensure(s),old=at(s,date);
    const next={policy,refs:policy==='basic'?[...f.members]:[],options:policy==='basic'?copy(f.options):options()};
    if(JSON.stringify({policy:old.policy,refs:old.refs,options:old.options})===JSON.stringify(next))return;
    f.changes.push({seq:++f.sequence,from:date,at:Date.now(),zone:Intl.DateTimeFormat().resolvedOptions().timeZone,...next});
    f.changes.sort((a,b)=>a.from.localeCompare(b.from)||a.seq-b.seq);
  }
  function enterBasic(s,date){
    dateGuard(s,date);const f=ensure(s);f.changes=f.changes.filter(e=>e.from<=date);f.view='basic';f.introduced=true;
    if(s.timer.state==='running'){s.timer.remaining=Math.max(0,Math.ceil((s.timer.endsAt-Date.now())/1000));s.timer.state='paused';s.timer.endsAt=null}
    record(s,date,'basic');
  }
  function openFull(s){ensure(s).view='full'}
  function resumeFull(s,date,tomorrow){
    dateGuard(s,date);if(!validDay(tomorrow)||tomorrow<=date)throw Error('Неверная дата возобновления.');
    const f=ensure(s);f.changes=f.changes.filter(e=>e.from<=date);f.view='full';record(s,tomorrow,'full');
  }
  function configure(s,date,refs,opts){
    dateGuard(s,date);if(!Array.isArray(refs)||refs.some(r=>!validRef(r)||!selectable(s,r)))throw Error('Некоторые действия больше недоступны. Обновите список ритма.');
    validateOptions(opts);const f=ensure(s);f.members=[...new Set(refs)];f.options=copy(opts);
    if(at(s,date).policy==='basic')record(s,date,'basic');
  }
  function pruneMembers(s,date){
    const f=ensure(s),members=f.members.filter(r=>selectable(s,r));if(members.length===f.members.length)return;
    configure(s,date,members,f.options);
  }
  function suggest(s){
    const out=[];for(const [k,col]of Object.entries(COLL))for(const x of s[col]){
      const ref=baseRef(k,x.id);if(!selectable(s,ref)||x.status!=='active'||k==='cal'&&!s.flex.options.calendar)continue;
      if(k==='task'&&s.facts.some(f=>f.kind==='task'&&f.ref===x.id&&!f.cancelled)&&x.sched.type==='once')continue;
      out.push({ref,rank:(x.key?0:2)+(x.inDay?0:1)+(k==='cal'?2:0)});
    }
    return out.sort((a,b)=>a.rank-b.rank||a.ref.localeCompare(b.ref)).slice(0,5).map(x=>x.ref);
  }
  function validateOptions(o){if(!object(o)||Object.keys(o).length!==3||['calendar','notifications','stats'].some(k=>typeof o[k]!=='boolean'))throw Error('Повреждены опции базового ритма.')}
  function validate(s){
    const f=s.flex;if(f===undefined)return;
    const refs=x=>Array.isArray(x)&&x.every(validRef)&&new Set(x).size===x.length;
    if(!object(f)||f.v!==1||!['basic','full'].includes(f.view)||typeof f.introduced!=='boolean'||!refs(f.members)||!Number.isSafeInteger(f.sequence)||f.sequence<0||!Array.isArray(f.changes))throw Error('Повреждён формат гибкой сложности.');
    validateOptions(f.options);if(f.members.some(r=>!selectable(s,r)))throw Error('Базовый ритм ссылается на недоступное действие.');
    let previous=null;const seq=new Set();
    for(const e of f.changes){
      if(!object(e)||!validDay(e.from)||!Number.isSafeInteger(e.seq)||e.seq<1||e.seq>f.sequence||seq.has(e.seq)||!Number.isSafeInteger(e.at)||e.at<0||typeof e.zone!=='string'||e.zone.length>100||!['basic','full'].includes(e.policy)||!refs(e.refs))throw Error('Повреждена история режимов.');
      validateOptions(e.options);if(e.policy==='full'&&e.refs.length)throw Error('Неверная история полного режима.');
      if(previous&&(e.from<previous.from||e.from===previous.from&&e.seq<=previous.seq))throw Error('Нарушен порядок истории режимов.');
      previous=e;seq.add(e.seq);
    }
    if(f.view==='basic'&&(!previous||previous.policy!=='basic'||previous.refs.length!==f.members.length||previous.refs.some(r=>!f.members.includes(r))||['calendar','notifications','stats'].some(k=>previous.options[k]!==f.options[k])))throw Error('Базовый экран не соответствует сохранённой политике ритма.');
  }
  window.LifeGameFlex={COLL,defaults,ensure,find,selectable,at,basic,enabled,inPlan,notify,enterBasic,openFull,resumeFull,configure,pruneMembers,suggest,validate,baseRef};
})();
