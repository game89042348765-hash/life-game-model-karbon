'use strict';
(() => {
  // Deliberately fictional, disposable examples. No application data, storage, or network APIs.
  const seed=[
    {id:'health',name:'Здоровье',icon:'heart',goal:'Вернуть выносливость',why:'Больше сил для прогулок и путешествий.',steps:[{title:'Прогулка без телефона',time:'15 мин',hint:'Просто выйти из дома. Темп — комфортный.'},{title:'Выбрать день для бассейна',time:'5 мин',hint:'Посмотреть расписание и выбрать удобное время.'}],future:[{title:'Поход в горах',icon:'mountain',note:'Здоровье и бюджет помогут подготовиться к первому походу.',needs:['health','money']},{title:'Пробежать первые 5 км',icon:'compass',note:'Ещё одно возможное направление. Можно выбрать позже.'}]},
    {id:'money',name:'Ресурсы',icon:'wallet',goal:'Собрать резерв на поездку',why:'Путешествовать спокойно, без спешки и долгов.',steps:[{title:'Посмотреть расходы за неделю',time:'10 мин',hint:'Найти одну сумму, которую комфортно отложить.'},{title:'Выбрать сумму первого взноса',time:'5 мин',hint:'Небольшую и посильную. Размер выбираешь сам.'}],future:[{title:'Поездка без кредита',icon:'compass',note:'Резерв поможет спланировать путешествие.'},{title:'Подушка спокойствия',icon:'wallet',note:'Возможное продолжение после первого резерва.'}]},
    {id:'music',name:'Музыка',icon:'music',goal:'Сыграть любимую песню',why:'Музыка для себя. Можно просто получать удовольствие.',steps:[{title:'Разобрать припев',time:'10 мин',hint:'Попробовать небольшой фрагмент, без требования сыграть идеально.'},{title:'Сыграть куплет и припев',time:'10 мин',hint:'Соединить знакомые части в удобном темпе.'}],future:[{title:'Записать исполнение',icon:'music',note:'Сохранить момент, которым хочется поделиться.'},{title:'Сыграть для близких',icon:'heart',note:'Простой повод провести время вместе.'}]}
  ];
  let dirs=structuredClone(seed),done={health:0,money:0,music:0},picked={};
  const views=['cards','map','path'],names={cards:'1 Карточки',map:'2 Карта',path:'3 Путь'};
  const params=new URLSearchParams(location.search),view=views.includes(params.get('view'))?params.get('view'):null;
  let selected=dirs.some(d=>d.id===params.get('focus'))?params.get('focus'):'health',detail=!!params.get('focus');
  const app=document.getElementById('app'),sheet=document.getElementById('sheet'),lab=document.getElementById('lab');
  const paths={heart:'M20.5 5.5c-2-2-5.4-1.8-8.5 1.5-3.1-3.3-6.5-3.5-8.5-1.5-2.6 2.6-1.5 6 1 8.5l7.5 7 7.5-7c2.5-2.5 3.6-5.9 1-8.5Z',wallet:'M20 7H5a2 2 0 0 1 0-4h13v4M3 5v14a2 2 0 0 0 2 2h15V7M20 11h-6v6h6',music:'M9 18V5l12-3v13M9 8l12-3M9 18c0 2-7 4-7 0s7-4 7 0ZM21 15c0 2-7 4-7 0s7-4 7 0Z',arrow:'M5 12h14m-6-6 6 6-6 6',chevron:'m9 5 7 7-7 7',back:'m15 5-7 7 7 7',plus:'M5 12h14M12 5v14',check:'m5 12 4 4L20 5',close:'m6 6 12 12M6 18 18 6',flag:'M5 22V3c5-4 9 4 15 0v11c-6 4-10-4-15 0',mountain:'m2 21 8-17 12 17ZM7 10l3 3 3-4',compass:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 8l-2 6-6 2 2-6Z',root:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',menu:'M4 6h16M4 12h16M4 18h16',history:'M3 10a9 9 0 1 1 0 5M3 4v6h6M12 7v5l3 2'};
  const el=(tag,cls='',text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  function icon(name,cls=''){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');if(cls)s.setAttribute('class',cls);const p=document.createElementNS(s.namespaceURI,'path');p.setAttribute('d',paths[name]||paths.flag);s.append(p);return s;}
  const button=(text,cls,fn,glyph)=>{const b=el('button',cls);b.type='button';if(glyph)b.append(icon(glyph));if(text)b.append(document.createTextNode(text));b.addEventListener('click',fn);return b;};
  const ib=(glyph,label,fn)=>{const b=button('','icon-button',fn,glyph);b.setAttribute('aria-label',label);return b;};
  const dir=()=>dirs.find(d=>d.id===selected),step=d=>d.steps[done[d.id]],tone=d=>'tone-'+d.id;
  const brand=()=>el('div','brand','LIFE / GAME');
  const tile=d=>{const n=el('span','tile-icon '+tone(d));n.append(icon(d.icon));return n;};
  function link(text,href,cls=''){const a=el('a',cls,text);a.href=href;return a;}
  function labNav(){
    lab.replaceChildren();if(!view){lab.hidden=true;return;}
    const home=link('','strategy-mobile.html','lab-home');home.setAttribute('aria-label','Все варианты');home.append(icon('menu'));lab.append(home);
    for(const v of views){const a=link(names[v],'?view='+v);if(v===view)a.setAttribute('aria-current','page');lab.append(a);}
  }
  function navigate(id,toDetail=true){
    selected=id;detail=toDetail;const url=new URL(location.href);if(toDetail)url.searchParams.set('focus',id);else url.searchParams.delete('focus');history.pushState(null,'',url);render();window.scrollTo(0,0);
  }
  function close(){sheet.close();}
  function openSheet(title,build,large=false){
    sheet.replaceChildren();sheet.className='sheet'+(large?' expanded':'');
    const handle=button('','sheet-handle',()=>{if(handle._dragged){handle._dragged=false;return;}sheet.classList.toggle('expanded');});handle.setAttribute('aria-label','Развернуть или свернуть карточку');
    let sy=null;
    handle.addEventListener('pointerdown',e=>{sy=e.clientY;handle._dragged=false;handle.setPointerCapture(e.pointerId);});
    handle.addEventListener('pointerup',e=>{if(sy===null)return;const dy=e.clientY-sy;sy=null;if(Math.abs(dy)>35){handle._dragged=true;if(dy<0)sheet.classList.add('expanded');else if(sheet.classList.contains('expanded'))sheet.classList.remove('expanded');else close();}});
    const header=el('header','sheet-head'),h=el('h2','',title);h.id='sheet-title';header.append(h,ib('close','Закрыть карточку',close));
    const body=el('div','sheet-body'),actions=el('div','sheet-actions');sheet.append(handle,header,body);build(body,actions);if(actions.childElementCount)sheet.append(actions);
    document.body.classList.add('sheet-open');if(!sheet.open)sheet.showModal();
  }
  sheet.addEventListener('close',()=>document.body.classList.remove('sheet-open'));
  sheet.addEventListener('click',e=>{if(e.target===sheet){const r=sheet.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  function reset(){dirs=structuredClone(seed);done={health:0,money:0,music:0};picked={};selected='health';detail=false;const url=new URL(location.href);url.searchParams.delete('focus');history.replaceState(null,'',url);close();render();window.scrollTo(0,0);}
  function complete(d,inSheet=false){done[d.id]=Math.min(d.steps.length,done[d.id]+1);const y=scrollY;render();if(inSheet)peek(d.id);else window.scrollTo(0,y);}
  function historySheet(d){openSheet('Пройденные шаги',(body,actions)=>{
    if(!done[d.id])body.append(el('p','muted','Первый шаг ещё впереди. Здесь появятся сделанные шаги.'));
    for(const s of d.steps.slice(0,done[d.id])){const r=el('div','history-item');r.append(icon('check'),el('span','',s.title));body.append(r);}
    if(done[d.id])actions.append(button('Вернуть последний шаг','secondary',()=>{done[d.id]--;close();render();}));actions.append(button('Закрыть','primary',close));
  });}
  function future(d,i){const idea=d.future[i];openSheet(idea.title,(body,actions)=>{
    const tag=el('div','peek-direction '+tone(d));tag.append(icon(idea.icon),document.createTextNode('Возможное продолжение'));body.append(tag,el('p','muted',idea.note||'Идея для этого направления. Её можно изменить позже.'));
    if(idea.needs){body.append(el('p','eyebrow','Что поможет подготовиться'));for(const id of idea.needs){const x=dirs.find(d=>d.id===id),b=button('','condition '+tone(x),()=>{close();if(view==='map'){selected=id;render();peek(id);}else navigate(id);});const t=el('span','');t.append(el('strong','',x.goal),el('small','',x.name));b.append(icon(x.icon),t,icon('chevron','chevron'));body.append(b);}}
    actions.append(button(picked[d.id]===idea.title?'Выбрано':'Хочу пойти этим путём','primary',()=>{picked[d.id]=idea.title;close();render();}));
  });}
  function ideaForm(){openSheet('Идея на будущее',(body,actions)=>{
    body.append(el('p','muted','Одной фразы достаточно. Подробности можно продумать потом.'));
    const form=el('form'),label=el('label','','В каком направлении?'),select=el('select');select.id='idea-direction';label.htmlFor=select.id;for(const d of dirs)select.append(new Option(d.name,d.id));select.value=selected;
    const nameLabel=el('label','','Что хотелось бы попробовать?'),name=el('input');name.id='idea-name';nameLabel.htmlFor=name.id;name.placeholder='Например, пойти в первый поход';name.maxLength=90;name.required=true;
    const error=el('p','error');error.setAttribute('role','alert');error.hidden=true;form.append(label,select,nameLabel,name,error);body.append(form);
    const save=button('Добавить идею','primary',()=>form.requestSubmit());actions.append(save);
    form.addEventListener('submit',e=>{e.preventDefault();if(!name.value.trim()){error.hidden=false;error.textContent='Напиши хотя бы пару слов.';return;}
      const d=dirs.find(d=>d.id===select.value);d.future.unshift({title:name.value.trim(),icon:'flag',note:'Твоя новая идея в этом примере.'});selected=d.id;close();if(view==='cards')navigate(d.id);else render();
    });
  });}
  function nextRow(d){const next=d.steps[done[d.id]+1];if(!next)return null;
    const b=button('','next-row',()=>openSheet('Следующий шаг',(body,actions)=>{body.append(el('p','',next.title),el('p','muted',next.hint));actions.append(button('Понятно','primary',close));}));
    const copy=el('span','copy');copy.append(el('small','','ДАЛЕЕ'),el('strong','',next.title));b.append(copy,icon('chevron'));return b;
  }
  function futureCards(d,horizontal=false){const list=el('div',horizontal?'branch-scroll':'future-list');
    d.future.forEach((idea,i)=>{const b=button('','future-card '+tone(d)+(picked[d.id]===idea.title?' chosen':''),()=>future(d,i)),copy=el('span','copy');copy.append(el('small','',picked[d.id]===idea.title?'✓ Выбранный путь':'ВОЗМОЖНОЕ БУДУЩЕЕ'),el('strong','',idea.title));b.append(icon(idea.icon),copy,icon('chevron'));list.append(b);});return list;
  }
  function meter(d){const n=el('div','step-meter');n.setAttribute('aria-label','Сделано шагов: '+done[d.id]+' из '+d.steps.length);for(let i=0;i<d.steps.length;i++)n.append(el('span',i<done[d.id]?'done':''));return n;}
  function nowCard(d,inlineAction=false){const s=step(d),n=el('article','now-card '+tone(d));const row=el('div','now-top');row.append(el('span','now-label',s?'Ближайший шаг':'Этап пройден'),el('span','time',s?.time||'✓ '+done[d.id]+' шага'));n.append(row);
    if(s)n.append(el('h2','',s.title),el('p','muted',s.hint));else{const mark=el('div','success-mark');mark.append(icon('check'));n.append(el('h2','','Маленькие шаги уже сделаны'),el('p','muted','Можно выбрать продолжение или вернуться к этому направлению позже.'));}
    n.append(meter(d));if(inlineAction)n.append(button(s?'Шаг сделан':'Выбрать продолжение','primary',()=>s?complete(d):futureChooser(d),s?'check':'arrow'));return n;
  }
  function futureChooser(d){openSheet('Куда дальше?',body=>{body.append(el('p','muted','Можно выбрать направление без обязательства начать прямо сейчас.'),futureCards(d));});}
  function footer(d){const n=el('footer','bottom-bar');if(done[d.id])n.append(ib('history','Пройденные шаги',()=>historySheet(d)));n.append(button(step(d)?'Шаг сделан':'Выбрать продолжение','primary',()=>step(d)?complete(d):futureChooser(d),step(d)?'check':'arrow'));return n;}
  function overview(){const page=el('div','page');const head=el('div','topline');head.append(brand(),ib('plus','Добавить идею',ideaForm));page.append(head);
    const intro=el('header','intro');intro.append(el('p','eyebrow','Моя жизнь сейчас'),el('h1','title','Куда я хочу двигаться'),el('p','muted','Выбери одно направление. Начать можно с малого.'));page.append(intro);
    for(const d of dirs){const b=button('','direction-card '+tone(d),()=>navigate(d.id)),top=el('div','direction-head');top.append(tile(d),el('span','',d.name),icon('chevron','chevron'));b.append(top,el('h2','',d.goal));const next=el('div','next-inline');next.append(icon(step(d)?'arrow':'check'),el('span','',step(d)?.title||'Шаги этапа сделаны · выбрать продолжение'));b.append(next);page.append(b);}
    const foot=el('div','overview-foot');foot.append(el('span','','3 направления · без спешки'),button('Начать пример заново','text-button',reset));page.append(foot);return page;
  }
  function detailPage(){const d=dir(),page=el('div','page '+tone(d)),header=el('header','detail-header');header.append(button('Мои направления','text-button',()=>navigate(d.id,false),'back'),el('span','mini-label',d.name));page.append(header,el('p','eyebrow tone',d.name),el('h1','detail-title',d.goal));const purpose=el('p','purpose');purpose.append(icon('heart'),document.createTextNode(d.why));page.append(purpose,nowCard(d));
    const next=nextRow(d);if(next)page.append(next);const section=el('div','section-head');section.append(el('h2','','А дальше?'),button('＋ Идея','text-button',ideaForm));page.append(section,futureCards(d));if(done[d.id]){const p=button('Сделано шагов: '+done[d.id],'text-button tone',()=>historySheet(d),'check');page.append(p);}page.append(footer(d));return page;
  }
  function peek(id){selected=id;if(view==='map')render();const d=dir();openSheet(d.goal,(body,actions)=>{
    const tag=el('div','peek-direction '+tone(d));tag.append(icon(d.icon),document.createTextNode(d.name));body.append(tag,el('p','muted',d.why),nowCard(d));
    actions.append(button('Весь путь','secondary',()=>mapPath(d)),button(step(d)?'Шаг сделан':'Куда дальше?','primary',()=>step(d)?complete(d,true):futureChooser(d),step(d)?'check':'arrow'));
  });}
  function mapPath(d){openSheet(d.goal,(body,actions)=>{
    body.classList.add(tone(d));body.append(el('p','muted',d.why),nowCard(d));const next=nextRow(d);if(next)body.append(next);body.append(el('div','section-head','Возможное будущее'),futureCards(d));actions.append(button('Назад к шагу','secondary',()=>peek(d.id)),button('Добавить идею','primary',ideaForm));
  },true);}
  function mapPage(){const page=el('div','map-screen'),header=el('header','map-header'),head=el('div');head.append(brand(),el('h1','','Моя стратегия'));header.append(head,ib('plus','Добавить идею',ideaForm));page.append(header);
    const stage=el('div','map-stage');stage.setAttribute('aria-label','Карта трёх направлений');const lines=document.createElementNS('http://www.w3.org/2000/svg','svg');lines.setAttribute('viewBox','0 0 100 100');lines.setAttribute('preserveAspectRatio','none');lines.setAttribute('class','map-lines');lines.setAttribute('aria-hidden','true');
    for(const [to,cls]of [['22 22',''],['78 28',''],['25 70',''],['74 76','future-line']]){const p=document.createElementNS(lines.namespaceURI,'path');p.setAttribute('d','M50 46 L'+to);if(cls)p.setAttribute('class',cls);lines.append(p);}stage.append(lines);
    const root=button('','map-root',()=>openSheet('Мои направления',body=>{for(const d of dirs){const b=button(d.name,'next-row '+tone(d),()=>peek(d.id),d.icon);body.append(b);}}));root.setAttribute('aria-label','Я сейчас — выбрать направление');root.append(icon('root'),el('span','','Я сейчас'));stage.append(root);
    for(const d of dirs){const n=button('','map-node '+d.id+' '+tone(d)+(selected===d.id?' selected':''),()=>peek(d.id));n.setAttribute('aria-label',d.name+': '+d.goal);n.append(icon(d.icon,'map-symbol'),el('strong','',d.name),el('small','',done[d.id]?'✓ '+done[d.id]+' шага':'Есть первый шаг'));stage.append(n);}
    const later=button('','map-future',()=>future(dirs[0],0));later.setAttribute('aria-label','Будущее: Поход в горах');later.append(icon('mountain'),el('strong','','Поход в горах'),el('small','','Идея на потом'));stage.append(later);page.append(stage);
    const foot=el('footer','map-foot');foot.append(el('span','','Нажми на сферу'),button('Сначала','text-button',reset));page.append(foot);return page;
  }
  function pathPage(){const d=dir(),page=el('div','page route-page '+tone(d)),header=el('div','topline');header.append(brand(),ib('plus','Добавить идею',ideaForm));page.append(header);
    const goals=el('nav','goal-switch');goals.setAttribute('aria-label','Направление');for(const x of dirs){const b=button(x.name,tone(x),()=>navigate(x.id),x.icon);b.setAttribute('aria-pressed',String(x.id===selected));goals.append(b);}page.append(goals);
    const goal=el('header','route-goal'),copy=el('div');copy.append(el('h1','',d.goal),el('p','',d.why));goal.append(icon('flag'),copy);page.append(goal);
    const rail=el('div','route-rail');rail.append(el('p','rail-label current','Я сейчас'),nowCard(d));const next=nextRow(d);if(next){rail.append(el('p','rail-label','Следом'));next.querySelector('small').remove();rail.append(next);}rail.append(el('p','rail-label','Могу выбрать дальше'),futureCards(d,true));page.append(rail);
    if(done[d.id]){const p=el('div','completed-note');p.append(icon('check'),document.createTextNode('Уже сделано '+done[d.id]+' из '+d.steps.length+' шагов'));page.append(p);}page.append(footer(d));return page;
  }
  function hub(){const p=el('div','hub');p.append(brand(),el('h1','','Какой Стратегией хочется пользоваться?'),el('p','muted','Три разных способа взаимодействия. Внутри — одинаковые направления и шаги.'));
    const descriptions={cards:['Направления карточками','Сначала видишь сферы и цели. Выбираешь одну — переходишь к следующему шагу.'],map:['Карта на весь экран','Все направления рядом с «Я сейчас». Нажимаешь круг — детали появляются снизу.'],path:['Один понятный путь','Сразу видишь цель, текущий шаг и варианты продолжения. Направления переключаются сверху.']};
    for(const [i,v]of views.entries()){const a=link('','?view='+v,'concept'),head=el('div','concept-head');head.append(el('span','concept-num',String(i+1)),el('h2','',descriptions[v][0]));const open=el('span','open','Попробовать на телефоне');open.append(icon('arrow'));a.append(head,el('p','',descriptions[v][1]),open);p.append(a);}
    p.append(el('p','hub-task','Попробуй: открыть направление → найти ближайший шаг → посмотреть, куда он ведёт.'),el('p','muted','Это вымышленный пример. Можно отмечать шаги и добавлять идеи. При обновлении страницы пример начинается заново.'));return p;
  }
  function render(){app.replaceChildren(!view?hub():view==='cards'?detail?detailPage():overview():view==='map'?mapPage():pathPage());}
  window.addEventListener('popstate',()=>{const p=new URLSearchParams(location.search);const id=p.get('focus');selected=dirs.some(d=>d.id===id)?id:'health';detail=!!id;close();render();});
  labNav();render();
})();
