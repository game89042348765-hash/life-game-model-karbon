/* LAB-009. UI uses the Personal transaction boundary supplied by app.js. */
(function(){
  'use strict';
  const F=LifeGameFlex;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const LABEL={task:'Задания',habit:'Привычки',quest:'Квесты',cal:'Календарь'};
  const button=(act,text,extra='',cls='')=>'<button type="button" class="btn '+cls+'" data-act="'+act+'" '+extra+'>'+text+'</button>';
  function mount(a){
    const state=()=>a.state(),day=()=>a.today();
    function config(){
      const s=state(),f=s.flex;
      let lists='';
      for(const [k,col]of Object.entries(F.COLL)){
        const items=s[col].filter(x=>F.selectable(s,k+':'+x.id));if(!items.length)continue;
        lists+='<details open><summary>'+LABEL[k]+'</summary>'+items.map(x=>{
          const ref=k+':'+x.id,checked=f.members.includes(ref);
          return '<label class="flex-choice" data-flex-choice><input type="checkbox" name="member" value="'+esc(ref)+'" '+(checked?'checked':'')+'><span><b>'+esc(x.title)+'</b><small>'+esc(a.schedule(k,x))+(k==='cal'?' · при включённом календаре':'')+'</small></span></label>';
        }).join('')+'</details>';
      }
      a.openSheet('Мой базовый ритм','<form data-form="flex-config"><p>Оставьте действия, которыми хотите пользоваться сейчас. Остальные планы сохранятся на паузе, когда активен Базовый.</p><p class="meta">Можно не выбирать ничего дополнительного и оставаться в этом режиме сколько угодно.</p><fieldset class="flex-options"><legend>По желанию</legend>'+[
        ['calendar','Календарь: только выбранные события'],['notifications','Напоминания о выбранных событиях'],['stats','Спокойная статистика за неделю']
      ].map(([k,t])=>'<label class="flex-choice"><input type="checkbox" name="'+k+'" '+(f.options[k]?'checked':'')+'><span>'+t+'</span></label>').join('')+'</fieldset><p class="meta">Напоминания работают в открытом приложении. Системные зависят от разрешения браузера; включить его можно в Полном. Встречи во внешнем мире не отменяются.</p>'+button('flex-suggest','Предложить небольшой набор')+'<p class="meta">Предложение по признакам «главное» и «в дне» — это черновой выбор. Проверьте его перед сохранением.</p><label class="f" for="flex-find">Найти своё действие</label><input id="flex-find" type="search" data-flex-search placeholder="Название…"><div class="flex-members">'+(lists||'<p class="meta">Действий пока нет. Их можно добавить прямо в ритм.</p>')+'</div><div class="flex-config-save"><button class="btn primary" type="submit">Сохранить ритм</button>'+button('sheet-close','Отмена')+'</div></form>',{key:'flex-config'});
    }
    function create(){
      const calendar=state().flex.options.calendar;
      a.openSheet('Добавить в ритм','<form data-form="flex-create"><label class="f" for="flex-title">Что хотите сделать</label><input id="flex-title" name="title" type="text" maxlength="120" autocomplete="off" required><label class="f" for="flex-kind">Что это</label><select id="flex-kind" name="kind"><option value="task">Разовое задание</option><option value="habit">Ежедневная привычка</option>'+(calendar?'<option value="cal">Событие календаря</option>':'')+'</select><div data-flex-calendar hidden><label class="f">Дата события</label><input name="date" type="date" value="'+day()+'"><label class="f">Время (по желанию)</label><input name="time" type="time"></div><p class="meta">Это действие сразу войдёт в ваш базовый ритм. Периодичность, дневную норму и связи можно изменить в Полном.</p><div class="row"><button class="btn primary" type="submit">Добавить в ритм</button>'+button('sheet-close','Отмена')+'</div></form>');
    }
    function row(r){
      const [k,id]=a.parts(r),it=a.get(k,id),done=a.done(r,day());
      let note=a.schedule(k,it),control,extra='';
      if(k==='habit'){
        const n=a.habitTarget(it,day()),p=a.habitProgress(it,day());if(n>1)note+=' · '+p+' из '+n+' сегодня';
        if(p>0&&!done)extra=button('flex-undo','Отменить подход','data-r="'+esc(r)+'"','s ghost');
      }
      if(k==='cal'){const o=a.calOccurrence(it,id.split('@')[1]);note=o?.time||'Событие сегодня'}
      if(k==='quest'){
        const p=a.questProgress(it);note=p.done+' из '+p.total;
        control=button(it.type==='checklist'?'flex-quest':'flex-toggle',it.type==='checklist'?'Шаги':done&&it.status==='completed'?'Отменить':'+1 шаг','data-r="'+esc(r)+'"','s');
        if(it.type!=='checklist'&&a.todayFacts('questStep',it.id).length&&it.status==='active')extra=button('flex-undo','Отменить шаг','data-r="'+esc(r)+'"','s ghost');
      }else control='<button class="check'+(done?' on':'')+'" data-act="flex-toggle" data-r="'+esc(r)+'" aria-label="'+esc((done?'Снять отметку: ':'Отметить: ')+it.title)+'">'+(done?'✓':'+')+'</button>';
      const minutes=a.loggedMinutes(r,day());if(minutes)note+=' · записано '+minutes+' мин.';
      if(k!=='cal'&&a.available(it))extra+=button('time-log','Записать время','data-r="'+esc(r)+'"','s ghost');
      return '<div class="flex-action" data-flex-ref="'+esc(r)+'">'+control+'<div class="flex-action-text"><b>'+esc(it.title)+'</b><div class="meta">'+esc(note)+'</div>'+extra+'</div></div>';
    }
    function basic(){
      const s=state(),p=a.plan(day()),valid=r=>{const [k,id]=a.parts(r);return s.flex.members.includes(F.baseRef(k,id))&&F.enabled(s,k,id,day())},visible=p.visible.filter(valid),hidden=p.hidden.filter(x=>valid(x.r));
      let html='<header class="top flex-top"><div class="grow"><div class="brand">Мой ритм</div><div class="sub">'+esc(a.human(day()))+'</div></div>'+button('flex-full','Полный','','s')+'</header><main data-flex-basic><h1 class="flex-title">Сегодня</h1><div class="flex-actions">'+(visible.length?visible.map(row).join(''):'<p class="muted flex-empty">На сегодня здесь свободно.</p>')+'</div>';
      if(hidden.length)html+='<details class="flex-day-options"><summary>Действия с настройками дня</summary><p class="meta">На эти выбранные действия влияют темп, фокус, творческая пауза или локация. При желании их можно показать сегодня.</p>'+hidden.map(x=>'<div class="flex-action"><div class="flex-action-text">'+esc(a.get(...a.parts(x.r)).title)+'<div class="meta">'+esc(a.reason(x.why))+'</div></div>'+button('force','Показать','data-r="'+esc(x.r)+'"','s')+'</div>').join('')+'</details>';
      html+='<div class="row flex-tools">'+button('flex-create','Добавить в ритм','','primary')+button('flex-config','Настроить')+'</div>';
      if(s.flex.options.calendar){
        const future=[];for(const c of s.cal)if(s.flex.members.includes('cal:'+c.id)&&F.enabled(s,'cal',c.id,day())&&a.available(c))for(const o of a.calRange(c,a.addDays(day(),1),a.addDays(day(),7)))future.push({c,o});
        future.sort((x,y)=>(x.o.date+x.o.time).localeCompare(y.o.date+y.o.time));
        if(future.length)html+='<section class="flex-optional"><h2>Ближайшие события</h2>'+future.slice(0,7).map(({c,o})=>'<div class="flex-action"><div class="flex-action-text">'+esc(c.title)+'<div class="meta">'+esc(a.human(o.date))+' '+esc(o.time)+'</div></div></div>').join('')+'</section>';
      }
      if(s.flex.options.stats){
        const refs=new Set(s.flex.members),start=a.addDays(day(),-6),count=s.facts.filter(f=>!f.cancelled&&f.date>=start&&f.date<=day()&&['task','habit','cal','questStep'].includes(f.kind)&&refs.has((f.kind==='questStep'?'quest':f.kind)+':'+f.ref)).length;
        html+='<section class="flex-optional" data-flex-stats><h2>За последние семь дней</h2><p>Отметок в выбранном ритме: '+count+'</p></section>';
      }
      return html+'</main>';
    }
    function fullBanner(){
      const s=state(),p=F.at(s,day()),pending=s.flex.changes.find(e=>e.from>day()&&e.policy==='full');
      return '<div class="flex-modebar" data-flex-full><div><b>Полный режим</b>'+(p.policy==='basic'?'<p class="meta">Редактирование. Ожидания остаются в Базовом ритме.'+(pending?' Вся стратегия возобновится '+esc(a.human(pending.from))+'.':'')+'</p>':'')+'</div><div class="row">'+button('flex-basic','Базовый','','s')+button('flex-config','Настроить ритм','','s')+(p.policy==='basic'&&!pending?button('flex-resume','Возобновить всю стратегию…','','s'):'')+'</div></div>';
    }
    function quest(r){
      const [,id]=a.parts(r),q=a.get('quest',id),p=a.questProgress(q);
      a.openSheet(q.title,'<div data-flex-quest>'+q.steps.map(t=>{const done=p.doneSet.has(t.id),f=a.todayOrEarlierFact('questStep',id,t.id);return '<div class="flex-action"><button class="check'+(done?' on':'')+'" data-act="flex-qstep" data-r="'+esc(r)+'" data-step="'+esc(t.id)+'" '+(done?'data-fact="'+esc(f.id)+'"':'')+' aria-label="'+esc((done?'Отменить: ':'Отметить: ')+t.title)+'">'+(done?'✓':'+')+'</button><div class="flex-action-text">'+esc(t.title)+'</div></div>'}).join('')+'</div>',{key:'flex-quest'});
    }
    function requireMember(r){const [k,id]=a.parts(r);if(!F.enabled(state(),k,id,day()))throw Error('Это действие сейчас вне базового ритма.');return [k,id]}
    a.ACT['flex-config']=config;a.ACT['flex-create']=create;
    a.ACT['flex-basic']=()=>{const first=!state().flex.introduced,ok=a.tx(()=>F.enterBasic(state(),day()),'Базовый ритм включён');if(ok){a.closeAllSheets();document.querySelector('#calendar-reminder')?.remove();if(first)config()}};
    a.ACT['flex-full']=()=>{const ok=a.tx(()=>F.openFull(state()));if(ok)a.closeAllSheets()};
    a.ACT['flex-start']=el=>a.start(el.dataset.view);
    a.ACT['flex-resume']=async()=>{
      if(!await a.ask({title:'Возобновить всю стратегию?',text:'Начиная с завтрашнего дня все активные дела вернутся к прежнему расписанию и учёту пропусков. Период Базового останется на паузе в истории. Настройки фокуса, темпа и творческой паузы сохраняются.',ok:'Возобновить с завтра'}))return;
      a.tx(()=>F.resumeFull(state(),day(),a.addDays(day(),1)),'Стратегия возобновится завтра');
    };
    a.ACT['flex-suggest']=()=>{
      const f=document.querySelector('[data-form="flex-config"]'),draft=JSON.parse(JSON.stringify(state()));draft.flex.options.calendar=f.elements.calendar.checked;
      const refs=F.suggest(draft);f.querySelectorAll('[name="member"]').forEach(x=>x.checked=refs.includes(x.value));a.toast('Предложение выбрано в форме. Проверьте и сохраните, если подходит.');
    };
    a.ACT['flex-toggle']=el=>{const [k,id]=requireMember(el.dataset.r),it=a.get(k,id);if(k==='quest'&&it.type==='checklist')return quest(el.dataset.r);return a.ACT.toggle(el)};
    a.ACT['flex-undo']=el=>{const [k,id]=requireMember(el.dataset.r);a.tx(()=>a.undoToday(k,id,day()),'Отметка отменена')};
    a.ACT['flex-quest']=el=>{requireMember(el.dataset.r);quest(el.dataset.r)};
    a.ACT['flex-qstep']=el=>{const [k,id]=requireMember(el.dataset.r),ok=a.tx(()=>el.dataset.fact?a.undoFact(el.dataset.fact):a.complete(k,id,day(),{step:el.dataset.step}),'Шаг сохранён');if(ok){a.closeAllSheets();quest(el.dataset.r)}};
    a.FORMS['flex-config']=async f=>{
      const refs=[...f.querySelectorAll('[name="member"]:checked')].map(x=>x.value),opts={calendar:f.elements.calendar.checked,notifications:f.elements.notifications.checked,stats:f.elements.stats.checked};
      if(opts.notifications&&!opts.calendar){a.toast('Для напоминаний включите календарь и выберите события.');return}
      if(refs.length>10&&!await a.ask({title:'Оставить '+refs.length+' действий?',text:'Большой ритм может требовать больше внимания. Можно оставить его таким или сократить; ограничения нет.',ok:'Оставить мой выбор'}))return;
      if(a.tx(()=>F.configure(state(),day(),refs,opts),'Ритм сохранён'))a.closeAllSheets();
    };
    a.FORMS['flex-create']=f=>{
      const title=f.elements.title.value.trim(),kind=f.elements.kind.value;if(!title||title.length>120||!['task','habit','cal'].includes(kind))throw Error('Проверьте название и тип действия.');
      if(kind==='cal'&&!state().flex.options.calendar)throw Error('Сначала включите календарь в настройках ритма.');
      if(a.tx(()=>{const s=state(),x=a.newItem(kind,{title});if(kind==='cal'){x.date=f.elements.date.value;x.time=f.elements.time.value;if(!LifeGamePersistence.day(x.date))throw Error('Укажите дату события.')}
        s[F.COLL[kind]].push(x);F.configure(s,day(),[...s.flex.members,kind+':'+x.id],s.flex.options);
      },'Добавлено в ритм'))a.closeAllSheets();
    };
    document.addEventListener('input',e=>{if(!e.target.matches('[data-flex-search]'))return;const q=e.target.value.trim().toLocaleLowerCase();e.target.form.querySelectorAll('[data-flex-choice]').forEach(l=>{l.hidden=!l.textContent.toLocaleLowerCase().includes(q)})});
    document.addEventListener('change',e=>{if(e.target.matches('[data-form="flex-create"] [name="kind"]'))e.target.form.querySelector('[data-flex-calendar]').hidden=e.target.value!=='cal'});
    return {basic,fullBanner,welcome:()=>'<div class="flex-welcome"><div class="brand">LifeGame Ритм Lab</div><h1>Свой уровень сложности</h1><p>Одна жизнь и одна история. Выберите, с чего вам удобнее начать.</p><div class="list">'+button('flex-start','<b>Базовый</b><span>Несколько своих действий. Всё дополнительное — по желанию.</span>','data-view="basic"','tile')+button('flex-start','<b>Полный</b><span>Стратегия, этапы, план дня и все инструменты Personal.</span>','data-view="full"','tile')+button('welcome','<b>Посмотреть пример</b><span>Отдельные вымышленные данные. Можно пробовать.</span>','data-v="demo"','tile')+'</div></div>'};
  }
  window.LifeGameFlexUI={mount};
})();
