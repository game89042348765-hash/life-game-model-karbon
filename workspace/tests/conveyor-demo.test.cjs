'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const p of ['../demo/conveyor-assets/block-stages.js','../demo/conveyor-engine.js'])vm.runInThisContext(fs.readFileSync(require.resolve(p),'utf8'));
const C=LifeGameConveyor,S=LifeGameStages,copy=C.copy;
function fresh(){const d={blocks:[{id:'a',name:'A',meaning:'',archivedAt:null},{id:'b',name:'B',meaning:'',archivedAt:null}],goals:[],tasks:[],completions:[],diamondRecords:[],purchases:[],dayPlans:{}};S.validate(d);C.normalize(d,'2026-01-01');return d}
function route(d,b,n=5,repeat='once'){const s=S.current(d,b);d.conveyor.routes[b]={enabled:true,mode:'strategic',priority:1,reviewEvery:7,reviewed:d.conveyor.date};d.conveyor.plans[s.id]={criterion:'Есть результат',confirmed:false,steps:Array.from({length:n},(_,i)=>({id:b+'-'+i,name:'Шаг '+i,minutes:10,repeat,status:'ready'}))};return s}
function done(d,t){d.completions.push({id:'r'+d.completions.length,taskId:t.id,date:d.conveyor.date,reward:25,taskType:t.type})}
{
 const d=fresh(),s=route(d,'a');C.reconcile(d,d.conveyor.date);assert.equal(d.tasks.length,1);const t=d.tasks[0];C.reconcile(d,d.conveyor.date);assert.equal(d.tasks.length,1,'no duplicate issuance');
 done(d,t);C.reconcile(d,d.conveyor.date);assert.equal(d.tasks.length,2);done(d,d.tasks[1]);C.reconcile(d,d.conveyor.date);done(d,d.tasks[2]);C.reconcile(d,d.conveyor.date);assert.equal(d.tasks.length,3,'daily action limit');
 d.conveyor.date=C.plus(d.conveyor.date,1);C.reconcile(d,d.conveyor.date);assert.equal(d.tasks.length,4,'next day continues');
 d.completions=d.completions.filter(r=>r.taskId!==t.id);C.reconcile(d,d.conveyor.date);assert(!C.canComplete(d,d.tasks[3],d.conveyor.date),'undo restores dependency');assert(d.dayPlans[d.conveyor.date].includes(t.id));
 const future=S.list(d,'a').find(x=>x.slot==='next');d.conveyor.plans[future.id]={criterion:'Позже',confirmed:false,steps:[{id:'later',name:'Позже',minutes:5,repeat:'once',status:'ready'}]};C.reconcile(d,d.conveyor.date);assert(!d.tasks.some(t=>t.conveyorStep==='later'),'future stages never leak into queue');
}
{
 const d=fresh();route(d,'a');route(d,'b');d.conveyor.limit=2;C.reconcile(d,d.conveyor.date);assert.equal(d.tasks.length,2);assert.equal(new Set(d.tasks.map(t=>t.block)).size,2,'several directions get an action');
 d.conveyor.routes.a.enabled=false;C.reconcile(d,d.conveyor.date);assert(!d.dayPlans[d.conveyor.date].some(id=>d.tasks.find(t=>t.id===id)?.block==='a'));assert.equal(d.tasks.length,2,'pause keeps task history');
}
{
 const d=fresh();route(d,'a');d.conveyor.budget=5;C.reconcile(d,d.conveyor.date);assert.equal(d.tasks.length,0,'do not exceed minute budget');d.conveyor.budget=45;C.reconcile(d,d.conveyor.date);const id=d.tasks[0].id;d.conveyor.defer[id]=C.plus(d.conveyor.date,1);d.dayPlans[d.conveyor.date]=[];C.reconcile(d,d.conveyor.date);assert.equal(d.dayPlans[d.conveyor.date].length,0);d.conveyor.date=C.plus(d.conveyor.date,1);C.reconcile(d,d.conveyor.date);assert(d.dayPlans[d.conveyor.date].includes(id));
 d.conveyor.closed[d.conveyor.date]={};C.reconcile(d,d.conveyor.date);assert.equal(d.dayPlans[d.conveyor.date].length,0,'closed day keeps queue for tomorrow');
}
{
 const d=fresh();route(d,'a',1,'daily');for(let day=0;day<120;day++){C.reconcile(d,d.conveyor.date);assert.equal(d.tasks.length,1,'stable habit task ID for months');assert(d.dayPlans[d.conveyor.date].includes(d.tasks[0].id));done(d,d.tasks[0]);C.reconcile(d,d.conveyor.date);d.conveyor.date=C.plus(d.conveyor.date,1)}assert.equal(d.completions.length,120);
}
{
 const d=fresh();route(d,'a',1,'weekly');C.reconcile(d,d.conveyor.date);done(d,d.tasks[0]);for(let i=1;i<7;i++){d.conveyor.date=C.plus('2026-01-01',i);C.reconcile(d,d.conveyor.date);assert.equal(d.dayPlans[d.conveyor.date].length,0,'weekly cadence');}d.conveyor.date='2026-01-08';C.reconcile(d,d.conveyor.date);assert(d.dayPlans[d.conveyor.date].length===1);
}
{
 const d=fresh(),s=route(d,'a',1);C.reconcile(d,d.conveyor.date);done(d,d.tasks[0]);const receipts=copy(d.completions),custom=S.newStage('custom','a','Промежуточный');S.insert(d,custom,S.optimal(d,'a').id,'before');d.conveyor.plans.custom={criterion:'Результат',confirmed:false,steps:[]};
 C.move(d,'custom','b',S.optimal(d,'b').id);assert.equal(S.get(d,'custom').blockId,'b');C.remove(d,'custom',S.current(d,'b').id);assert(!S.get(d,'custom'));assert.equal(d.conveyor.archivedStages.length,1);assert.deepEqual(d.completions,receipts);S.validate(d);C.normalize(d,d.conveyor.date);
 assert.throws(()=>C.remove(d,s.id,S.optimal(d,'a').id));assert.throws(()=>C.move(d,S.optimal(d,'a').id,'b',S.optimal(d,'b').id));
}
{
 const d=fresh();route(d,'a',1);C.reconcile(d,d.conveyor.date);const t=d.tasks[0],old=t.stageId,other=S.list(d,'a').find(s=>s.slot==='next');t.stageId=other.id;t.name='Изменённое дело';C.normalize(d,d.conveyor.date);assert.equal(d.conveyor.plans[old].steps.length,0);assert.equal(d.conveyor.plans[other.id].steps[0].name,t.name,'manual editor transfer stays linked');
}
assert.throws(()=>C.parse('Дело | -2',()=>1));assert.throws(()=>C.parse('Дело | 5 | иногда',()=>1));
console.log('PASS demo conveyor: ordering, limits, idempotency, undo, future, fairness, pause, deferral, closed day, 120 days, weekly cadence, stage move/delete, receipts, editor sync');
