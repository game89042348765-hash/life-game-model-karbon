(function(root){
'use strict';
const C=root.LifeGameAIContext;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let provider=null,result=null,snapshot=null;
const $=s=>document.querySelector(s);
const categories={strategy:'Стратегия и цели',actions:'Дела и расписания',history:'Отметки, пропуски и записанное время',reflections:'Личные ответы пересмотров и мотивация',economy:'Игровые монеты и XP',locations:'Названия и связи локаций',inbox:'Свободные записи входящих'};
function clear(){result=null;snapshot=null;const p=$('#ai-preview');if(p)p.hidden=true;const c=$('#ai-consent');if(c)c.checked=false;buttons();}
function message(text){const p=$('#ai-feedback');if(p)p.textContent=text;}
function buttons(){document.querySelectorAll('[data-ai-export]').forEach(b=>b.disabled=!result||!$('#ai-consent')?.checked);}
function render(getSource){
  provider=getSource;clear();const source=provider(),today=source.today;
  return '<h1>LifeGame AI</h1><p class="lead">Подготовьте контекст для внешней модели и проверьте данные перед передачей.</p><div class="card ai-intro">Вы работаете в отдельном эксперименте на Personal. Здесь можно составить запрос; ответ модели используйте вручную.</div>'+
    '<form id="ai-context-form" class="card ai-form"><label class="f" for="ai-mode">Что разобрать</label><select id="ai-mode" name="mode">'+Object.entries(C.MODES).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select>'+
    '<label class="f" for="ai-format">Форма ответа</label><select id="ai-format" name="format">'+Object.entries(C.FORMATS).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select>'+
    '<div class="grid2"><div><label class="f" for="ai-from">История с</label><input id="ai-from" name="from" type="date" value="'+C.add(today,-6)+'" max="'+today+'" required></div><div><label class="f" for="ai-to">По</label><input id="ai-to" name="to" type="date" value="'+today+'" max="'+today+'" required></div></div>'+
    '<details class="ai-options"><summary>Выбрать данные и объём</summary><fieldset><legend>Разделы</legend>'+Object.entries(categories).map(([k,v])=>'<label class="ai-check"><input type="checkbox" name="category" value="'+k+'" '+(['strategy','actions','history'].includes(k)?'checked':'')+'> '+v+'</label>').join('')+'</fieldset>'+
    '<fieldset><legend>Направления</legend>'+source.state.blocks.map(b=>'<label class="ai-check"><input type="checkbox" name="blocks" value="'+esc(b.id)+'" checked> '+esc(b.name)+(b.status==='archived'?' (в архиве)':'')+'</label>').join('')+'<label class="ai-check"><input name="unbound" type="checkbox" checked> Самостоятельные дела</label></fieldset>'+
    '<label class="ai-check"><input name="archives" type="checkbox"> Включить архивные записи</label><p class="meta">При выборе отдельных направлений общие личные ответы, входящие и экономика исключаются: у них нет надёжной привязки к направлению. Отбор работает по связям записей; проверьте содержание свободного текста.</p>'+
    '<label class="f" for="ai-detail">Подробность</label><select id="ai-detail" name="detail"><option value="compact">Компактно, без длинных описаний</option><option value="full">С описаниями и условиями</option></select>'+
    '<label class="f" for="ai-size">Размер запроса</label><select id="ai-size" name="maxChars"><option value="20000">До 20 000 знаков</option><option value="60000" selected>До 60 000 знаков</option><option value="120000">До 120 000 знаков</option></select></details>'+
    '<button class="btn primary ai-build" type="submit">Сформировать предпросмотр</button></form><p id="ai-feedback" class="meta" role="status" aria-live="polite"></p>'+
    '<section id="ai-preview" class="card" hidden><h2>Проверьте пакет</h2><p id="ai-size-note" class="meta"></p><p id="ai-coverage" class="meta"></p><label class="f" for="ai-request">Запрос и включённые данные</label><textarea id="ai-request" readonly rows="18" spellcheck="false"></textarea><label class="ai-check ai-consent"><input id="ai-consent" type="checkbox"> Я просмотрел данные и готов передать этот пакет модели</label><div class="row"><button type="button" class="btn primary" data-ai-export="copy" disabled>Скопировать запрос</button><button type="button" class="btn" data-ai-export="download" disabled>Скачать пакет</button></div><p class="meta">Копирование и скачивание выполняются по вашему действию. Передайте пакет выбранной модели самостоятельно. Он не заменяет резервную копию Personal.</p></section>';
}
function options(){const f=$('#ai-context-form'),fd=new FormData(f);return {mode:fd.get('mode'),format:fd.get('format'),from:fd.get('from'),to:fd.get('to'),detail:fd.get('detail'),maxChars:Number(fd.get('maxChars')),blockIds:fd.getAll('blocks'),unbound:fd.has('unbound'),archives:fd.has('archives'),include:Object.fromEntries(Object.keys(categories).map(k=>[k,fd.getAll('category').includes(k)]))};}
document.addEventListener('submit',e=>{
  if(e.target.id!=='ai-context-form')return;e.preventDefault();e.stopImmediatePropagation();clear();
  try{
    const source=provider();if(source.error)throw Error(source.error);
    source.assertCurrent();root.LifeGamePersistence.validate(source.state);
    result=C.build(source.state,options(),source);snapshot={revision:source.state.revision||0,space:source.space,date:source.today};
    $('#ai-request').value=result.request;$('#ai-preview').hidden=false;
    $('#ai-size-note').textContent=result.characters.toLocaleString('ru-RU')+' знаков. Данные на '+source.today+', часовой пояс '+result.packet.meta.timezone+'.';
    const omitted=Object.entries(result.packet.meta.coverage.omitted).filter(([,n])=>n>0);
    $('#ai-coverage').textContent=omitted.length?'Часть подробных записей не вошла из-за размера: '+omitted.map(([k,n])=>k+' — '+n).join(', ')+'. Итоги рассчитаны до усечения.':'Все отобранные записи поместились. Исключённые разделы перечислены в пакете.';
    message('Предпросмотр готов. Ничего не отправлено модели.');buttons();
  }catch(err){clear();message(err.message);}
},true);
document.addEventListener('input',e=>{if(e.target.closest('#ai-context-form')){clear();message('Параметры изменены. Сформируйте новый предпросмотр.');}});
document.addEventListener('change',e=>{if(e.target.id==='ai-consent'){buttons();return;}if(e.target.closest('#ai-context-form')){clear();message('Параметры изменены. Сформируйте новый предпросмотр.');}});
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-ai-export]');if(!b)return;e.preventDefault();
  try{
    if(!result||!$('#ai-consent')?.checked)throw Error('Сначала проверьте пакет и подтвердите передачу.');
    const source=provider();try{source.assertCurrent()}catch(err){clear();throw err}
    if(source.error||(source.state.revision||0)!==snapshot.revision||source.space!==snapshot.space||source.today!==snapshot.date){clear();throw Error('Данные изменились. Сформируйте и проверьте новый пакет.');}
    if(b.dataset.aiExport==='copy'){
      if(!navigator.clipboard?.writeText)throw Error('Автоматическое копирование недоступно. Выделите и скопируйте текст предпросмотра вручную.');
      try{await navigator.clipboard.writeText(result.request);message('Запрос скопирован. Передайте его выбранной модели.');}catch{ $('#ai-request').focus();$('#ai-request').select();throw Error('Браузер не разрешил копирование. Текст выделен: скопируйте его вручную.');}
    }else{
      const url=URL.createObjectURL(new Blob([result.request],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='LifeGame-AI-'+result.packet.meta.mode+'-'+snapshot.date+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Скачивание пакета начато.');
    }
  }catch(err){message(err.message);}
});
root.LifeGameAIUI={render};
})(globalThis);
