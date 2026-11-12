'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
vm.runInThisContext(fs.readFileSync(require('node:path').join(__dirname,'../assets/calendar-links.js'),'utf8'));
const L=globalThis.LifeGameCalendarLinks,copy=x=>JSON.parse(JSON.stringify(x)),now=1000000;
const d={blocks:[{id:'b',archivedAt:null},{id:'archived',archivedAt:'2026-11-01'}],tasks:[{id:'t',block:'b',archivedAt:null,reward:25}],calendarEntries:[{id:'c',date:'2026-11-12',reward:25},{id:'a',blockId:'archived',date:'2026-11-13',reward:0}],completions:[{id:'paid',reward:25}],calendarCompletions:[{id:'fact'}]};
const baseline=copy(d);L.normalize(d,now);assert.equal(d.calendarEntries[0].blockId,null);assert.equal(d.calendarEntries[1].blockId,'archived');assert.deepEqual(d.tasks,baseline.tasks);assert.deepEqual(d.completions,baseline.completions);const stable=copy(d);L.normalize(d,now);assert.deepEqual(d,stable);
const bad=copy(d);bad.calendarEntries[0].blockId='missing';assert.throws(()=>L.normalize(bad,now));bad.calendarEntries[0].blockId=2;assert.throws(()=>L.normalize(bad,now));
L.remember(d,'calendar','c',now);L.remember(d,'task','t',now+1);assert.equal(L.recent(d,now+100).length,2);const until=d.recentCaptures[1].until;L.normalize(d,now+100000);assert.equal(d.recentCaptures[1].until,until);assert.equal(L.recent(d,now+L.TTL+2).length,0);L.normalize(d,now+L.TTL+2);assert.deepEqual(d.recentCaptures,[]);assert.equal(d.calendarEntries.length,2);assert.equal(d.tasks.length,1);assert.deepEqual(d.completions,baseline.completions);
L.remember(d,'calendar','c',now);L.remember(d,'calendar','c',now+100);assert.equal(d.recentCaptures.length,1);d.calendarEntries=d.calendarEntries.filter(e=>e.id!=='c');L.normalize(d,now+100);assert.equal(d.recentCaptures.length,0);assert.deepEqual(d.calendarCompletions,baseline.calendarCompletions);
for(const r of [{kind:'task',id:'t',until:-1},{kind:'unknown',id:'t',until:now+1},{kind:'task',id:'',until:now+1}]){const x=copy(d);x.recentCaptures=[r];assert.throws(()=>L.normalize(x,now));}
const duplicate=copy(d);duplicate.recentCaptures=[{kind:'task',id:'t',until:now+1},{kind:'task',id:'t',until:now+2}];assert.throws(()=>L.normalize(duplicate,now));
console.log('PASS calendar link defaults/archived references/validation, no copies or ledger changes, TTL persistence/expiry, transfer deduplication, deleted-reference cleanup');
