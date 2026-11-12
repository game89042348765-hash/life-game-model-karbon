(()=>{
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],clone=x=>JSON.parse(JSON.stringify(x));
const fresh=()=>({tab:'levels',stage:0,stages:Array.from({length:3},()=>({done:[],closed:false})),repair:false,reward:0,passed:0});
const memories=new Map(WORLDS.map(w=>[w.id,fresh()]));let selected=0,autoTimers=[],playing=false,busy=false;
const world=()=>WORLDS[selected],state=()=>memories.get(world().id),done=()=>state().stages[state().stage].done;
const emit=(name,detail={})=>document.dispatchEvent(new CustomEvent('demo:'+name,{detail:{...detail,state:getState(),animationLayer:fxLayer}}));
function getState(){const s=clone(state());return {...s,done:[...s.stages[s.stage].done,...(s.repair?['missed-1']:[])]}}
function status(s){$('#status').textContent=s}
function stopAuto(){autoTimers.forEach(clearTimeout);autoTimers=[];playing=false;$('#play').textContent='▶ Сценарий'}
function settle(){clearMotion();busy=false;draw()}
function draw(visual=state()){
 const active=document.activeElement?.dataset?.task,inside=visual.tab==='inside';
 $('#world-panel').setAttribute('aria-labelledby','tab-'+visual.tab);
 $('#scene-slot').innerHTML=renderScene(world().id,visual,visual.tab);
 const root=$('.scene');root.insertAdjacentHTML('beforeend',repairedMaterial(world().id,inside,visual)+completedMaterial(world().id,inside,visual));
 const phase=visual.stages[visual.stage],count=phase.done.length;$('#reward-count').textContent=state().reward;
 $('#phase-name').textContent=`Этап ${visual.stage+1} из 3 · ${['Начать','Закрепить','Жить по-своему'][visual.stage]}`;
 $('#phase-state').textContent=phase.closed?'Пройден':`${count} / 2 действия`;
 $('#next-stage').hidden=!state().stages[state().stage].closed||state().stage===2;
 $('#next-stage').textContent='Открыть следующий этап →';
 $('#finish').disabled=done().length<2||state().stages[state().stage].closed;
 $('#do-task').disabled=state().stages[state().stage].closed;
 $('#do-task').textContent=done().length===2?'Отменить шаг':'Следующий шаг';
 $('#repair').textContent=state().repair?'Отменить возврат':'Вернуть пропущенное';
 for(const tab of ['levels','inside']){$('#tab-'+tab).setAttribute('aria-selected',String(state().tab===tab));$('#tab-'+tab).tabIndex=state().tab===tab?0:-1}
 if(active)document.querySelector(`[data-task="${active}"]`)?.focus({preventScroll:true});
}
function act(id){
 if(!['now-1','now-2','missed-1'].includes(id))return false;
 const s=state(),repair=id==='missed-1';if(!repair&&s.stages[s.stage].closed){status('Этот этап уже в истории. Открой следующий, чтобы продолжить.');return false}
 clearMotion();const before=clone(s),was=repair?s.repair:done().includes(id),reward=id==='now-2'?50:25;
 if(repair)s.repair=!s.repair;else s.stages[s.stage].done=was?done().filter(x=>x!==id):[...done(),id];
 s.reward+=was?-reward:reward;busy=!reduceMotion();draw(reduceMotion()?s:before);
 const verb=repair?world().repair:world().verbs[id==='now-1'?0:1];status(was?'Вклад отменён. Его часть вернулась в незавершённое.':`${verb}. ${repair?'Пропущенная часть возвращается в общий результат.':'Этот вклад останется в твоём маршруте.'}`);
 if(!reduceMotion()){const duration=motion(world().id,was?'undo':repair?'repair':'task',id);later(()=>draw(),1500);later(()=>{clearMotion();busy=false;draw()},duration+100)}
 emit(was?'task-undo':'task-complete',{task:{id,group:repair?'missed':'now',name:verb,reward},sourceAnchor:document.querySelector(`[data-task="${id}"]`),rewardTarget:$('#reward-count')});return true;
}
function completeStage(){const s=state();if(s.stages[s.stage].closed)return false;if(done().length<2){status('Для завершения этапа выполни два его действия. Пропущенное можно вернуть отдельно.');return false}
 clearMotion();const before=clone(s);s.stages[s.stage].closed=true;s.passed++;busy=!reduceMotion();draw(reduceMotion()?s:before);status(s.stage===2?'Все три этапа пройдены. Результат собран из твоих действий.':world().finish+'. Пройденное остаётся частью истории.');
 if(!reduceMotion()){const duration=motion(world().id,'stage');later(()=>draw(),1900);later(()=>{clearMotion();busy=false;draw()},duration+100)}emit('stage-complete',{sourceAnchor:$('.scene'),nextAnchor:$('#next-stage')});return true;
}
function nextStage(){const s=state();if(!s.stages[s.stage].closed||s.stage>=2)return false;clearMotion();busy=false;s.stage++;draw();status('Новый этап открыт. Прежние части маршрута сохранены.');emit('stage-change');return true}
function setTab(tab){if(!['levels','inside'].includes(tab))return false;stopAuto();clearMotion();busy=false;state().tab=tab;draw();status(tab==='inside'?'Внутри этапа. Нажимай на элементы, чтобы делать шаги.':'Весь маршрут. Уже пройденное остаётся видимым.');emit('tab-change',{tab});return true}
function reset(){stopAuto();clearMotion();busy=false;const tab=state().tab;memories.set(world().id,{...fresh(),tab});draw();status('Чистый маршрут. Можно снова собрать результат по шагам.');emit('reset')}
function setWorld(value){const index=typeof value==='number'?value:WORLDS.findIndex(w=>w.id===value);if(index<0||index>=WORLDS.length)return false;stopAuto();clearMotion();busy=false;selected=index;const w=world();document.body.dataset.world=w.id;document.body.dataset.type=w.type;document.documentElement.style.setProperty('--bg',w.bg);document.documentElement.style.setProperty('--ink',w.ink);document.documentElement.style.setProperty('--accent',w.accent);$('#world-select').value=w.id;$('#world-name').textContent=w.name;$('#world-title').textContent=w.title;$('#world-number').textContent=String(index+1).padStart(2,'0');$('#world-group').textContent=(index<5?'СВЕТ':'ДРУГОЙ МИР')+' / '+String(index+1).padStart(2,'0');$('#composition').textContent=w.composition;$('#meaning').textContent=w.meaning;$('#mobile-cause').textContent=w.meaning;$('#cause-task').textContent=w.verbs.join(' → ');$('#cause-repair').textContent=w.repair;$('#cause-stage').textContent=w.finish;$('#previous').disabled=index===0;$('#next').disabled=index===29;$$('.world-pill').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));draw();status('Коснись элементов внутри мира или запусти сценарий.');try{history.replaceState(null,'','#'+w.id)}catch{};$('.world-pill[aria-pressed=true]')?.scrollIntoView({inline:'center',block:'nearest',behavior:'instant'});document.dispatchEvent(new CustomEvent('world:change',{detail:{id:w.id,index}}));return true}
function play(){stopAuto();reset();playing=true;$('#play').textContent='■ Стоп';const sequence=[[200,()=>act('now-1')],[2600,()=>act('missed-1')],[5000,()=>act('now-2')],[7500,completeStage],[11200,nextStage],[12100,()=>act('now-1')],[14600,()=>act('now-2')],[17200,completeStage],[21000,stopAuto]];for(const[ms,fn]of sequence)autoTimers.push(setTimeout(fn,ms))}
$('#world-select').innerHTML=WORLDS.map(w=>`<option value="${w.id}">${String(w.index+1).padStart(2,'0')} · ${esc(w.name)}${w.index<5?' / свет':''}</option>`).join('');
$('#world-chips').innerHTML=WORLDS.map(w=>`<button class="world-pill" data-world="${w.id}" aria-label="Вариант ${w.index+1}: ${esc(w.name)}">${String(w.index+1).padStart(2,'0')} ${esc(w.name)}</button>`).join('');
document.addEventListener('click',e=>{const b=e.target.closest('[data-task],[data-enter],[data-world]');if(!b)return;if(b.dataset.world){setWorld(b.dataset.world);return}stopAuto();if(b.hasAttribute('data-enter'))setTab('inside');else act(b.dataset.task)});
document.addEventListener('keydown',e=>{const b=e.target.closest('[role=button]');if(b&&['Enter',' '].includes(e.key)){e.preventDefault();b.dispatchEvent(new MouseEvent('click',{bubbles:true}))}});
$('#world-select').addEventListener('change',e=>setWorld(e.target.value));$('#previous').onclick=()=>setWorld(Math.max(0,selected-1));$('#next').onclick=()=>setWorld(Math.min(29,selected+1));$('#play').onclick=()=>playing?stopAuto():play();$('#reset').onclick=reset;$('#tab-levels').onclick=()=>setTab('levels');$('#tab-inside').onclick=()=>setTab('inside');$('#next-stage').onclick=()=>{stopAuto();nextStage()};$('#finish').onclick=()=>{stopAuto();completeStage()};$('#repair').onclick=()=>{stopAuto();act('missed-1')};$('#do-task').onclick=()=>{stopAuto();act(['now-1','now-2'].find(id=>!done().includes(id))||'now-2')};
$('.view-tabs').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setTab(state().tab==='levels'?'inside':'levels');$('#tab-'+state().tab).focus()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopAuto();settle()}});let lastWidth=innerWidth;window.addEventListener('resize',()=>{if(innerWidth!==lastWidth){lastWidth=innerWidth;stopAuto();settle()}});
let downloadable='';window.addEventListener('DOMContentLoaded',()=>{downloadable='<!doctype html>\n'+document.documentElement.outerHTML},{once:true});$('#download').onclick=()=>{const url=URL.createObjectURL(new Blob([downloadable],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='strategy-worlds-30.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
window.StageDemo=Object.freeze({completeTask:act,completeStage,reset,setTab,getState});window.StrategyWorlds=Object.freeze({worlds:WORLDS.map(w=>({...w})),setWorld,getWorld:()=>({...world()}),getState,play,stop:()=>{stopAuto();settle()},nextStage,getEffects:()=>({busy,timers:fxTimers.size,animations:fxAnimations.size,auto:autoTimers.length})});
const index=WORLDS.findIndex(w=>w.id===location.hash.slice(1));setWorld(index>=0?index:0);
})();
