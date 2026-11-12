/* Injected into the isolated copy of the current app, never into index.html. */
const conveyor=LifeGameConveyor;
const demoTemplates=[
 {optimal:'Спокойный и живой',criterion:'В течение недели нахожу время для восстановления',steps:'Выбрать один источник напряжения | 5\nЗаписать, что я могу изменить | 10\nВыделить время на восстановление | 10\nПроверить, что стало легче | 5'},
 {optimal:'Движение в удовольствие',criterion:'Три прогулки за неделю без перегрузки',steps:'Выбрать удобный маршрут для прогулки | 5\nПройти короткий маршрут | 15\nПовторить прогулку и оценить самочувствие | 15\nЗаписать удобный ритм на следующую неделю | 5'},
 {optimal:'Применяю новый навык',criterion:'Есть один небольшой законченный результат',steps:'Выбрать один навык и маленький результат | 10\nРазобрать один пример | 15\nСделать собственный черновик | 20\nПроверить результат и записать вывод | 10'},
 {optimal:'Материальная устойчивость',criterion:'Понимаю обязательные расходы и ближайшее решение',steps:'Собрать список обязательных расходов | 15\nНайти одну статью, которую могу изменить | 10\nСделать одно выбранное изменение | 15\nПроверить результат через неделю | 10'},
 {optimal:'Тёплые отношения',criterion:'Есть регулярный контакт с важным человеком',steps:'Выбрать человека, с которым хочу быть ближе | 5\nПредложить созвон или встречу | 5\nПровести время вместе | 30\nЗаписать, какой контакт хочу поддерживать | 5'},
 {optimal:'В жизни больше порядка',criterion:'Одна повседневная зона работает удобно',steps:'Выбрать одну зону, которая мешает каждый день | 5\nУбрать лишнее в этой зоне | 15\nНастроить удобное постоянное место | 10\nПроверить удобство через несколько дней | 5'},
 {optimal:'Опираюсь на то, что могу',criterion:'Сделано одно изменение в зоне моего влияния',steps:'Разделить обстоятельства на доступное и недоступное | 10\nВыбрать одно доступное изменение | 5\nВыполнить первый шаг изменения | 15\nПроверить, что получилось | 10'},
 {optimal:'Больше места для важного',criterion:'Одно лишнее обязательство осознанно убрано',steps:'Назвать одно лишнее обязательство | 5\nРешить, как его сократить | 10\nСделать выбранное изменение | 15\nЗаметить, на что освободилось время | 5'}
];
function demoTemplate(b){const n=/^block-(\d)$/.exec(b);return demoTemplates[n?Number(n[1]):5]||demoTemplates[5]}
function cvState(){return conveyor.normalize(state,today())}
function cvChange(fn){return transact(d=>{conveyor.normalize(d,today());fn(d);},false)}
function cvPlan(s){return conveyor.plan(state,s)}
function cvRoute(b){return conveyor.defaults(state,b,today())}
function cvCard(title,text){const c=el('section','card spaced cv-card');if(title)c.append(el('h3','',title));if(text)c.append(el('p','meta',text));return c}
function cvButtons(...buttons){const row=el('div','cv-buttons');row.append(...buttons);return row}
function cvButton(text,fn,primary=false){return btn(text,'button '+(primary?'':'secondary'),fn,true)}
function cvFieldsSteps(p){return p.steps.map(s=>`${s.name} | ${s.minutes} | ${{once:'разово',daily:'ежедневно',weekly:'еженедельно'}[s.repeat]}`).join('\n')}
function cvToolbar(){
 const tools=el('details','cv-demo-tools');tools.append(el('summary','','Демо · '+today()+' · управление временем'));
 tools.append(el('p','meta','Отдельный эксперимент. Прогресс сохраняется в этом демо. Основное приложение не затрагивается.'));
 tools.append(cvButtons(cvButton('Следующий день',()=>cvAdvance(1)),cvButton('Через неделю',()=>cvAdvance(7)),cvButton('Лимиты дня',cvLimits),cvButton('Скачать демо-прогресс',cvExport),cvButton('Загрузить демо-прогресс',cvImport),cvButton('Начать демо заново',cvReset)));
 return tools;
}
function cvAdvance(days){
 if(state.focus.status==='running'||state.focus.status==='paused'){uiFeedback('Сначала заверши или останови таймер.');return;}
 const old=conveyor.clock,next=conveyor.plus(today(),days);conveyor.clock=next;
 const saved=cvChange(d=>{d.conveyor.date=next;ensureDay(d);conveyor.event(d,'day','Открыт день '+next,next)});
 if(!saved)conveyor.clock=state.conveyor?.date||old;
 else{calendarDate=next;calendarMonth=next.slice(0,7);render();uiSaveSignal('Новый день · продолжаем без штрафов');}
}
function cvLimits(){openForm('Посильный план',[
 {key:'budget',label:'Минут на действия в день',type:'number',min:5,max:480,value:cvState().budget},
 {key:'limit',label:'Не больше действий в день',type:'number',min:1,max:20,value:cvState().limit}
],v=>cvChange(d=>{d.conveyor.budget=v.budget;d.conveyor.limit=v.limit;d.dayBudgets[today()]=v.budget;}),'Сохранить');}
function cvExport(){const blob=new Blob([JSON.stringify({format:'lifegame-conveyor-demo',version:1,data:state},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='LifeGame-conveyor-demo-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function cvReset(){openForm('Начать демо заново?',[],()=>{const next=emptyState();next.soundEnabled=false;conveyor.normalize(next,dateKey());const old=conveyor.clock;conveyor.clock=null;const ok=transact(d=>{for(const k of Object.keys(d))delete d[k];Object.assign(d,next)},false);if(!ok)conveyor.clock=state.conveyor?.date||old;return ok;},'Сбросить демо',()=>go('hero'));editor.querySelector('h2').after(el('p','meta','Будут сброшены только данные этого экспериментального демо.'));}
function cvOverview(){
 screen.append(el('h1','','Маршрут → действия'),el('p','meta','Выбери направление, опиши результат этапа и набросай шаги. Конвейер выдаст ближайшее посильное дело.'));
 const start=cvCard('Как попробовать','Начни с готового примера или выбери любой базовый либо созданный блок.');
 start.append(cvButtons(cvButton('Готовый маршрут',cvSeed,true),cvButton('Мои блоки',()=>go('blocks')),cvButton('Действия сегодня',()=>go('quests'))));screen.append(start);
 const c=cvState(),enabled=Object.entries(c.routes).filter(([id,r])=>r.enabled&&blockIsActive(state,id));
 if(!enabled.length)screen.append(cvCard('Пока нет активных направлений','Можно составить маршрут в любом блоке. Не обязательно планировать все сферы сразу.'));
 for(const [id,r]of Object.entries(c.routes)){
  const b=state.blocks.find(b=>b.id===id);if(!b||b.archivedAt!==null)continue;const st=LifeGameStages.current(state,id),p=cvPlan(st.id),remaining=conveyor.remaining(state,st.id,today()).length;
  const card=cvCard(b.name,(r.enabled?'В работе':'На паузе')+' · '+(r.mode==='routine'?'Повседневный блок':'Стратегический маршрут')+' · '+st.name);
  card.append(el('p','meta',p.criterion||'Результат этапа ещё не описан'),el('p','meta','Осталось разовых шагов: '+remaining));
  if(conveyor.elapsed(r.reviewed,today())>=r.reviewEvery)card.append(el('p','meta','Время пересмотреть направление.'));
  card.append(cvButtons(cvButton('Открыть',()=>go('blocks',id)),cvButton('Пересмотреть',()=>cvReview(id)),cvButton(r.enabled?'Пауза':'Продолжить',()=>cvPause(id))));screen.append(card);
 }
 const memo=cvCard('Принцип работы','Смысл → результат этапа → упорядоченные шаги → действие сегодня → проверка результата → следующий этап. Пропуски не обнуляют маршрут.');screen.append(memo);
}
function cvSeed(){
 const b='block-1';if(Object.keys(cvState().routes).length){uiFeedback('Пример доступен в чистом демо. Текущие маршруты сохранены.');go('blocks',b);return;}
 const st=LifeGameStages.current(state,b),t=demoTemplate(b),ids=t.steps.split('\n').map(()=>uid());
 if(cvChange(d=>{
  const current=LifeGameStages.current(d,b),opt=LifeGameStages.optimal(d,b),next=LifeGameStages.list(d,b).find(s=>s.slot==='next');
  d.blockStages.paths[b].fact='Часто сижу, хочу мягко вернуть движение';current.meaning='Хочу больше сил на обычную жизнь';current.name='Возвращаю движение';current.prepared=true;opt.name=t.optimal;
  d.conveyor.routes[b]={enabled:true,mode:'strategic',priority:1,reviewEvery:7,reviewed:today()};
  d.conveyor.plans[current.id]={criterion:t.criterion,confirmed:false,steps:conveyor.parse(t.steps,i=>ids[i])};
  d.conveyor.plans[next.id]={criterion:'Удобный недельный ритм движения',confirmed:false,steps:conveyor.parse('Выбрать три удобных дня | 5\nПогулять в выбранный день | 15 | ежедневно',()=>uid())};next.name='Устойчивый ритм';next.prepared=true;
  conveyor.event(d,'route','Выбран маршрут «Физическое состояние»',today());
 }))go('blocks',b);
}
function cvRouteForm(owner){
 const b=state.blocks.find(x=>x.id===owner),st=displayedStage(owner),r=cvRoute(owner),p=cvPlan(st.id),t=demoTemplate(owner),opt=LifeGameStages.optimal(state,owner),expected=JSON.stringify(state.conveyor);
 openForm('Маршрут: '+b.name,[
 {key:'mode',label:'Для чего этот блок',value:r.mode,options:[['strategic','Стратегия и развитие'],['routine','Повседневные дела, без дальнего маршрута']]},
 {key:'fact',label:'Как у меня сейчас',type:'textarea',required:false,maxLength:2000,value:state.blockStages.paths[owner].fact},
 {key:'meaning',label:'Почему это важно для меня',type:'textarea',required:false,maxLength:2000,value:st.meaning},
 {key:'optimal',label:'Мой оптимальный уровень',maxLength:120,value:opt.name==='Оптимальный'?t.optimal:opt.name},
 {key:'criterion',label:'Как пойму, что этот этап выполнен',type:'textarea',maxLength:2000,value:p.criterion||t.criterion},
 {key:'steps',label:'Шаги по порядку: название | минуты | повторение',type:'textarea',required:false,maxLength:30000,value:p.steps.length?cvFieldsSteps(p):t.steps,hint:'Например: Разобрать один ящик | 10. Повторы: ежедневно или еженедельно третьим полем. Предложения можно полностью заменить.'},
 {key:'priority',label:'Приоритет направления',type:'number',min:1,max:3,value:r.priority},
 {key:'reviewEvery',label:'Пересматривать каждые N дней',type:'number',min:1,max:90,value:r.reviewEvery}
 ],v=>cvChange(d=>{
  if(JSON.stringify(d.conveyor)!==expected)fail('Маршрут изменился. Открой настройку заново.');
  const steps=cvMergeSteps(p.steps,v.steps),s=LifeGameStages.get(d,st.id);if(!s)fail('Этап недоступен.');
  s.meaning=v.meaning;s.prepared=true;d.blockStages.paths[owner].fact=v.fact;LifeGameStages.optimal(d,owner).name=v.optimal;
  d.conveyor.routes[owner]={enabled:true,mode:v.mode,priority:v.priority,reviewEvery:v.reviewEvery,reviewed:today()};
  d.conveyor.plans[st.id]={criterion:v.criterion,confirmed:false,steps};conveyor.event(d,'route','Обновлён маршрут «'+b.name+'»',today());
 }),'Включить маршрут');
}
function cvMergeSteps(old,text){
 const parsed=conveyor.parse(text,()=>uid()),used=new Set();
 // Keep facts attached to existing IDs; editing a queue must never regenerate a paid action.
 for(const s of parsed){const match=old.find(o=>!used.has(o.id)&&o.name===s.name&&o.repeat===s.repeat);if(match){used.add(match.id);s.id=match.id;s.status=match.status;const task=conveyor.taskFor(state,match);if(task&&task.estimateMinutes!==s.minutes)s.minutes=task.estimateMinutes||s.minutes;}}
 for(const s of old)if(!used.has(s.id)&&conveyor.taskFor(state,s))fail('Выданные шаги редактируй или пропускай в «Очереди этапа», чтобы сохранить историю.');
 return parsed;
}
function cvQueue(sid){
 const st=LifeGameStages.get(state,sid),p=cvPlan(sid);openMenu('Очередь: '+st.name,[
 {text:'Добавить шаг в очередь',run:()=>cvStepForm(sid)},
 {text:'Результат и весь маршрут',run:()=>{viewedStageId=sid;cvRouteForm(st.blockId)}},
 ...p.steps.map((s,i)=>({text:(i+1)+'. '+s.name+(s.status==='skip'?' · пропущен':conveyor.taskFor(state,s)&&conveyor.fact(state,conveyor.taskFor(state,s),today())?' · выполнен':''),run:()=>cvStepMenu(sid,s.id)}))
 ]);
}
function cvStepForm(sid,stepId=null){
 const p=cvPlan(sid),step=p.steps.find(s=>s.id===stepId),expected=JSON.stringify(p);openForm(step?'Изменить шаг':'Следующий шаг',[
 nameField(step?.name),{key:'minutes',label:'Минут',type:'number',min:1,max:480,value:step?.minutes||10},
 {key:'repeat',label:'Повторение',value:step?.repeat||'once',options:[['once','Разово'],['daily','Ежедневно'],['weekly','Еженедельно']]}
 ],v=>cvChange(d=>{
  const p=conveyor.plan(d,sid);if(JSON.stringify(p)!==expected)fail('Очередь изменилась.');
  d.conveyor.plans[sid]||=p;
  if(step){const existing=conveyor.taskFor(d,step);if(existing&&v.repeat!==step.repeat)fail('Повторение выданного дела меняется через его редактор.');const s=p.steps.find(s=>s.id===stepId);Object.assign(s,{name:v.name,minutes:v.minutes,repeat:v.repeat});if(existing){existing.name=v.name;existing.estimateMinutes=v.minutes;}}
  else p.steps.push({id:uid(),name:v.name,minutes:v.minutes,repeat:v.repeat,status:'ready'});
 }),'Сохранить');
}
function cvStepMenu(sid,id){const p=cvPlan(sid),s=p.steps.find(s=>s.id===id),at=p.steps.indexOf(s);openMenu(s.name,[
 {text:'Изменить',run:()=>cvStepForm(sid,id)},
 ...(at>0?[{text:'Выше в очереди',run:()=>cvChange(d=>{const steps=d.conveyor.plans[sid].steps;[steps[at],steps[at-1]]=[steps[at-1],steps[at]]})}]:[]),
 ...(at<p.steps.length-1?[{text:'Ниже в очереди',run:()=>cvChange(d=>{const steps=d.conveyor.plans[sid].steps;[steps[at],steps[at+1]]=[steps[at+1],steps[at]]})}]:[]),
 {text:s.status==='skip'?'Вернуть в очередь':'Пропустить этот шаг',run:()=>cvChange(d=>{const s=d.conveyor.plans[sid].steps.find(s=>s.id===id);s.status=s.status==='skip'?'ready':'skip';const t=conveyor.taskFor(d,s);if(t){if(s.status==='skip'){d.conveyor.defer[t.id]='9999-12-31';if(!conveyor.fact(d,t,today()))t.archivedAt=new Date().toISOString();}else{delete d.conveyor.defer[t.id];t.archivedAt=null;}}conveyor.event(d,'queue',(s.status==='skip'?'Пропущен: ':'Возвращён: ')+s.name,today());})}
 ]);}
function cvPause(b){cvChange(d=>{const r=d.conveyor.routes[b];if(!r)fail('Сначала составь маршрут.');r.enabled=!r.enabled;conveyor.event(d,'pause',(r.enabled?'Продолжен':'Приостановлен')+' маршрут «'+d.blocks.find(x=>x.id===b).name+'»',today());});}
function cvReview(b){const r=cvRoute(b);openForm('Пересмотреть маршрут',[
 {key:'note',label:'Что изменилось и что нужно скорректировать?',type:'textarea',required:false,maxLength:2000,value:''},
 {key:'decision',label:'Как продолжим',value:'continue',options:[['continue','Продолжить в прежнем ритме'],['lighter','Облегчить общий план: одно действие в день'],['pause','Взять паузу']]}
 ],v=>cvChange(d=>{d.conveyor.routes[b]||={...r};const route=d.conveyor.routes[b];route.reviewed=today();route.enabled=v.decision!=='pause';if(v.decision==='lighter')d.conveyor.limit=1;d.conveyor.reviews.push({date:today(),blockId:b,note:v.note,decision:v.decision});conveyor.event(d,'review','Пересмотрен маршрут «'+d.blocks.find(x=>x.id===b).name+'»',today());}),'Сохранить итог');}
function cvActions(){
 const c=cvState(),tasks=plannedTasks(state),pending=tasks.filter(t=>!completion(state,t)),done=tasks.filter(t=>completion(state,t));
 screen.append(el('h1','','Действия сегодня'),el('p','meta',today()+' · '+done.length+' выполнено · '+c.limit+' действий / '+c.budget+' минут — ориентир дня'));
 screen.append(cvButtons(cvButton('Выдать ближайшие действия',()=>cvChange(()=>{}),true),cvButton('Быстро добавить',()=>createTask({blockId:INBOX_BLOCK_ID,fromConstructor:true})),cvButton('Лимиты дня',cvLimits)));
 if(c.closed[today()])screen.append(cvCard('День закрыт','Выполненное сохранено. Следующий день продолжит очередь с того места, где ты остановился.'));
 for(const task of pending){const card=taskCard(task),b=state.blocks.find(b=>b.id===task.block);card.prepend(el('p','meta',(b?.name||'Быстрое добавление')+' · '+(task.estimateMinutes||10)+' мин'+(task.conveyorStep?' · следующий шаг маршрута':'')));card.append(cvButtons(cvButton('На завтра',()=>cvDefer(task.id,1)),cvButton('Не подходит',()=>cvTaskDecision(task.id))));screen.append(card);}
 if(!pending.length&&!c.closed[today()]){
  const remaining=Object.entries(c.routes).filter(([b,r])=>r.enabled).flatMap(([b])=>conveyor.remaining(state,LifeGameStages.current(state,b).id,today()));
  screen.append(cvCard(done.length?'Посильная порция на сегодня завершена':'Сейчас нет выданных действий',done.length?'Можно остановиться. Следующий день продолжит маршрут.':remaining.length?'Проверь минуты, паузу или дату переноса. Конвейер не добавляет дела сверх лимита.':'Подготовь шаги активного этапа или проверь его результат.'));
 }
 if(done.length){const history=el('details','card spaced');history.append(el('summary','','Выполнено сегодня · '+done.length));for(const t of done)history.append(taskCard(t));screen.append(history);}
 screen.append(cvButtons(cvButton('Закрыть день',cvCloseDay),cvButton('Мои маршруты',()=>go('hero'))));
}
function cvDefer(id,days){cvChange(d=>{d.conveyor.defer[id]=conveyor.plus(today(),days);d.dayPlans[today()]=(d.dayPlans[today()]||[]).filter(x=>x!==id);d.daySkips[today()]=[...new Set([...(d.daySkips[today()]||[]),id])];conveyor.event(d,'defer','Перенесено: '+d.tasks.find(t=>t.id===id).name,today());});}
function cvTaskDecision(id){const t=state.tasks.find(t=>t.id===id);openMenu(t.name,[{text:'На завтра',run:()=>cvDefer(id,1)},{text:'Через неделю',run:()=>cvDefer(id,7)},...t.conveyorStep?[{text:'Изменить этот шаг',run:()=>cvStepForm(t.stageId,t.conveyorStep)},{text:'Пропустить в маршруте',run:()=>cvStepMenu(t.stageId,t.conveyorStep)}]:[{text:'Редактировать дело',run:()=>editTaskDays(id)}]]);}
function cvCloseDay(){openForm('Закрыть день',[
 {key:'note',label:'Что получилось, что стоит изменить?',type:'textarea',required:false,maxLength:2000,value:''}
 ],v=>cvChange(d=>{d.conveyor.closed[today()]={note:v.note};conveyor.event(d,'day-close',v.note||'День завершён без заметки',today());}),'Сохранить день');editor.querySelector('h2').after(el('p','meta','Незавершённые шаги останутся в очереди и вернутся в следующий день. Без штрафов и обнуления.'));}
function cvJournal(){screen.append(el('h1','','История маршрута'));const c=cvState();screen.append(cvCard('Факты сохраняются','Выполнено действий: '+state.completions.filter(x=>state.tasks.some(t=>t.id===x.taskId)).length+' · пройдено этапов: '+state.blockStages.items.filter(s=>s.passed).length));for(const event of [...c.events].reverse().slice(0,100))screen.append(cvCard(event.date,event.text));for(const review of [...c.reviews].reverse().slice(0,30))screen.append(cvCard('Пересмотр · '+review.date,review.note||'Без заметки'));for(const record of [...state.completions].reverse().filter(r=>state.tasks.some(t=>t.id===r.taskId)).slice(0,100)){const task=state.tasks.find(t=>t.id===record.taskId);screen.append(cvCard(record.date,task.name+' · выполнено · '+record.reward+' монет'));}if(!c.events.length)screen.append(cvCard('Пока всё впереди','Маршруты, пересмотры, переносы и переходы останутся здесь.'));}
function cvStageManage(b){openMenu('Управление этапами',[
 {text:'Добавить этап перед оптимальным',run:()=>blockStageForm(null,b,{anchorId:LifeGameStages.optimal(state,b).id,direction:'before'})},
 ...LifeGameStages.list(state,b).map(s=>({text:s.name+(s.id===LifeGameStages.current(state,b).id?' · текущий':s.passed?' · пройден':''),run:()=>stageMenu(s.id)}))
 ]);}
function cvMoveStage(id){const s=LifeGameStages.get(state,id);openForm('Перенести этап',[
 {key:'before',label:'Перед каким этапом (можно в другом блоке)',value:'',options:[['','Выбери место'],...state.blocks.filter(b=>b.archivedAt===null).flatMap(b=>{const list=LifeGameStages.list(state,b.id),cur=list.indexOf(LifeGameStages.current(state,b.id)),opt=list.indexOf(LifeGameStages.optimal(state,b.id));return list.filter((x,i)=>x.id!==id&&i>cur&&i<=opt).map(x=>[x.id,b.name+' → '+x.name])})]}
 ],v=>cvChange(d=>{const target=LifeGameStages.get(d,v.before);if(!target)fail('Выбери место.');conveyor.move(d,id,target.blockId,target.id);}),'Перенести');editor.querySelector('h2').after(el('p','meta','Смысл, цели, задания и их история останутся связаны с этапом.'));}
function cvRemoveStage(id){const s=LifeGameStages.get(state,id);openForm('Удалить будущий этап',[
 {key:'target',label:'Куда перенести содержимое',value:'',options:[['','Выбери этап'],...LifeGameStages.list(state,s.blockId).filter(x=>x.id!==id&&x.levelKind==='stage').map(x=>[x.id,x.name])]}
 ],v=>cvChange(d=>conveyor.remove(d,id,v.target)),'Удалить и перенести');editor.querySelector('h2').after(el('p','meta','Цели, задания и записи выполнения не удаляются. Снимок этапа остаётся в журнале демо.'));}
function cvComplete(owner){
 const st=LifeGameStages.current(state,owner),p=cvPlan(st.id),left=conveyor.remaining(state,st.id,today()).length;
 if(!p.criterion){uiFeedback('Сначала опиши результат этапа в «Маршруте».');cvRouteForm(owner);return;}
 let confirmed=false;
 openForm('Проверить результат этапа',[
 {key:'remaining',label:'Оставшиеся разовые дела и привычки',value:'move',options:[['move','Перенести в следующий этап'],['keep','Оставить здесь, в невыполненном']]},
 {key:'note',label:'Что получилось?',type:'textarea',required:false,maxLength:2000,value:''}
 ],v=>{
  if(!confirmed){uiFeedback('Подтверди результат этапа.');return false;}
  return cvChange(d=>{
   if(LifeGameStages.current(d,owner)?.id!==st.id)fail('Текущий этап изменился.');
   if(['running','paused'].includes(d.focus.status))fail('Сначала заверши таймер.');
   const plan=conveyor.plan(d,st.id),list=LifeGameStages.list(d,owner),next=list.slice(list.findIndex(s=>s.id===st.id)+1).find(s=>!s.passed);if(!next){plan.confirmed=true;d.conveyor.routes[owner].enabled=false;conveyor.event(d,'stage','Завершён текущий маршрут «'+st.name+'». '+v.note,today());return;}if(!LifeGameStages.unlocked(d,next))fail(LifeGameStages.lockText(d,next));
   plan.confirmed=true;
   if(v.remaining==='move'){
    const unfinished=d.tasks.filter(t=>t.stageId===st.id&&t.archivedAt===null&&(t.type==='daily'||!conveyor.fact(d,t,today())));
    for(const t of unfinished){t.stageId=next.id;t.goalId=null;}
    const moving=plan.steps.filter(s=>s.repeat!=='once'||conveyor.remaining(d,st.id,today()).some(x=>x.id===s.id));
    d.conveyor.plans[next.id]||={criterion:'',confirmed:false,steps:[]};d.conveyor.plans[next.id].steps.unshift(...moving);plan.steps=plan.steps.filter(s=>!moving.includes(s));
   }
   LifeGameStages.switchTo(d,next.id,{passPrevious:true});ensureDay(d);conveyor.event(d,'stage','Пройден этап «'+st.name+'». '+v.note,today());
  });
 },'Подтвердить и перейти',()=>{viewedStageId=LifeGameStages.current(state,owner).id;blockPathViews.set(owner,'work');render();});
 editor.querySelector('h2').after(el('p','meta',p.criterion),el('p','meta','Осталось разовых шагов: '+left+'. Можно завершить этап по результату, даже если список дел изменился. Цели отмечаются отдельно.'));
 editor.querySelector('.form-actions').before(checkbox('Да, результат этого этапа достигнут',false,v=>confirmed=v));
}
// Keep current renderers, forms, rewards and path visuals; add only planning controls.
const cvOriginalBlocks=renderBlocks;
renderHero=cvOverview;renderQuests=cvActions;renderBonuses=cvJournal;renderDay=cvActions;
renderBlocks=function(){
 cvOriginalBlocks();
 if(blockId===null)return;
 const b=blockId,r=cvRoute(b),bar=cvCard('',null);bar.classList.add('cv-route-controls');bar.append(cvButtons(cvButton('Настроить маршрут',()=>cvRouteForm(b)),cvButton('Очередь этапа',()=>cvQueue(displayedStage(b).id)),cvButton('Этапы',()=>cvStageManage(b)),cvButton('Действия',()=>go('quests')),cvButton('Пересмотреть',()=>cvReview(b)),cvButton(r.enabled?'Пауза':'Включить',()=>r.enabled?cvPause(b):cvRouteForm(b))));
 const heading=screen.querySelector('.block-heading');if(heading)heading.after(bar);else screen.prepend(bar);
 screen.classList.toggle('cv-routine',r.mode==='routine');
};
stageMenu=function(id){const s=LifeGameStages.get(state,id),cur=LifeGameStages.current(state,s.blockId),canMove=s.levelKind==='stage'&&s.id!==cur.id&&!s.reached&&!s.passed;openMenu(s.name,[
 {text:'Открыть содержимое',run:()=>{viewedStageId=id;blockPathViews.set(s.blockId,'work');render()}},
 {text:'Настроить этап',run:()=>blockStageForm(id)},
 {text:'Очередь действий',run:()=>cvQueue(id)},
 ...(s.id!==cur.id?[{text:'Сделать текущим без завершения прежнего',run:()=>makeStageCurrent(id,false)}]:[]),
 ...(canMove?[{text:'Переставить / перенести в другой блок',run:()=>cvMoveStage(id)},{text:'Удалить с переносом содержимого',run:()=>cvRemoveStage(id)}]:[])
 ]);};
blockStageNext=function(owner,body){if(cvRoute(owner).mode==='routine'){const box=el('div','lg-stage-preview-footer');box.append(cvButton('Пересмотреть повседневный ритм',()=>cvReview(owner)));body.append(box);return;}const list=LifeGameStages.list(state,owner),cur=LifeGameStages.current(state,owner),next=list.slice(list.indexOf(cur)+1).find(s=>!s.passed),p=cvPlan(cur.id);const box=el('div','lg-stage-preview-footer');box.append(el('span','lg-stage-footer-label','ДАЛЬШЕ ПО ПУТИ'));
 function row(title,hint,icon,fn){const b=btn('','lg-stage-preview-next',fn,true),copy=el('span',''),mark=el('span','lg-stage-next-arrow');copy.append(el('strong','',title),el('small','',hint));const svg=designIcon(icon);svg.innerHTML=icon==='check'?'<path d="m6 12 4 4 8-8"/>':'<path d="M12 4v16m-6-6 6 6 6-6"/>';svg.style.transform='none';mark.append(svg);b.append(copy,mark);return b}
 box.append(row('Этап выполнен',p.criterion?'Проверить результат':'Сначала опиши результат','check',()=>cvComplete(owner)));
 if(next)box.append(row('Следующий этап','Открыть и подготовить','chevron',()=>openStagePreparation(next.id)));
 body.append(box);
};
const cvOriginalToggle=toggleTask;
toggleTask=function(id,context=null){const t=state.tasks.find(t=>t.id===id);if(t&&!conveyor.canComplete(state,t,today())){uiFeedback('Сначала выполни или пропусти предыдущий шаг маршрута.');return;}return cvOriginalToggle(id,context);};
const cvOriginalRender=render;
render=function(){cvOriginalRender();screen.prepend(cvToolbar());};
// Demo-only navigation uses the existing four navigation buttons.
for(const [key,label]of [['hero','Маршрут'],['blocks','Блоки'],['quests','Действия'],['bonuses','История']]){const b=document.querySelector('body>nav [data-page="'+key+'"]');if(b){for(const n of [...b.childNodes])if(n.nodeType===3)n.remove();b.append(document.createTextNode(label));}}
window.LifeGameConveyorDemo={read:()=>clone(state),date:today,advance:cvAdvance,seed:cvSeed,go,queue:cvQueue,route:cvRouteForm,manage:cvStageManage,stage:()=>displayedStage(blockId)?.id};

function cvImport(){const input=document.createElement('input');input.type='file';input.accept='application/json,.json';input.addEventListener('change',async()=>{try{if(!input.files[0])return;const parsed=JSON.parse(await input.files[0].text());if(parsed.format!=='lifegame-conveyor-demo'||parsed.version!==1||!parsed.data?.conveyor)fail('Выбери копию этого демо.');const old=conveyor.clock;openForm('Загрузить демо-прогресс?',[],()=>{conveyor.clock=parsed.data.conveyor.date;let checked;try{checked=normalize(parsed.data)}catch(e){conveyor.clock=old;uiFeedback(e.message);return false;}const ok=transact(d=>{for(const k of Object.keys(d))delete d[k];Object.assign(d,checked)},false);if(!ok)conveyor.clock=state.conveyor?.date||old;return ok;},'Загрузить',()=>go('hero'));}catch(e){uiFeedback(e.message)}});input.click();}

lgSectionLinks=function(){const links=el('div','lg-section-nav-links');for(const [label,dest]of [['Маршрут','hero'],['Действия','quests'],['Блоки','blocks'],['История','bonuses']])links.append(btn(label,'page-link page-link-accent',()=>go(dest)));return links;};

const cvOriginalTogglePlan=togglePlan;
togglePlan=function(id,checked){const t=state.tasks.find(t=>t.id===id);if(!t?.conveyorStep)return cvOriginalTogglePlan(id,checked);if(!checked)return cvDefer(id,1);if(!cvRoute(t.block).enabled){uiFeedback('Сначала продолжи маршрут блока.');return;}return cvChange(d=>{delete d.conveyor.defer[id];d.daySkips[today()]=(d.daySkips[today()]||[]).filter(x=>x!==id);d.dayPlans[today()]=[...new Set([...(d.dayPlans[today()]||[]),id])];});};

function cvSyncRealDay(){
 const real=dateKey(),last=cvState().lastRealDay;
 if(!last){cvChange(d=>{d.conveyor.lastRealDay=real});return;}
 const days=conveyor.elapsed(last,real);
 if(days>0&&state.focus.status!=='running'&&state.focus.status!=='paused'){
  const old=conveyor.clock;conveyor.clock=conveyor.plus(today(),days);
  if(!cvChange(d=>{d.conveyor.date=conveyor.clock;d.conveyor.lastRealDay=real;ensureDay(d)}))conveyor.clock=state.conveyor?.date||old;
 }
}
