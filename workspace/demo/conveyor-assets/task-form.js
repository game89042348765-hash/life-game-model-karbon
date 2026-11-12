/* Form layout and copy from the supplied task-form-final.html. No storage or awards. */
(function(root){
  'use strict';
  const presets=[['once','Разово',[]],['daily','Все дни',[1,2,3,4,5,6,7]],['weekdays','Будни',[1,2,3,4,5]],['weekend','Выходные',[6,7]]];
  const days=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  function create(options={}){
    const form=document.createElement('form');form.id='task-form';form.noValidate=true;
    form.innerHTML=`<h2 class="lg-modal-title" id="editor-title">Новое задание</h2>
      <div class="lg-field"><label class="lg-label" for="task-name-input">Название <span class="lg-req">*</span></label>
      <input id="task-name-input" class="lg-input" type="text" maxlength="120" placeholder="Например: пробежка 3 км" autocomplete="off" required></div>
      <div class="lg-field"><span class="lg-label">Повторение</span>
      <div class="lg-repeat-bar" role="group" aria-label="Режим повторения">${presets.map(([id,label])=>`<button type="button" class="lg-repeat-preset" data-preset="${id}">${label}</button>`).join('')}</div>
      <div class="lg-weekdays-circles" role="group" aria-label="Дни недели">${days.map((name,i)=>`<label class="lg-day-circle"><input type="checkbox" data-day="${i+1}" id="task-day-${i+1}"><span>${name}</span></label>`).join('')}</div>
      <p class="lg-repeat-caption" role="status"></p></div>
      <div id="light-thread-slot"></div>
        <div class="lg-toggle-card lg-light-thread lg-task-option"><div class="lg-toggle-row"><span class="lg-toggle-copy">
          <label class="lg-toggle-title" for="toggle-goal">Этот шаг ведёт тебя к цели?</label>
          <div class="lg-goal-slot"><label class="lg-toggle-sub lg-goal-off" for="toggle-goal"></label>
          <label class="lg-toggle-sub lg-goal-on" for="toggle-goal" style="color:#8e948e">У этого будет тег «<span style="color:#9fe0b6">Шаг к цели</span>»</label></div></span>
          <input id="toggle-goal" class="lg-switch" type="checkbox" role="switch"></div></div>
        <div class="lg-toggle-card lg-light-thread lg-task-option"><label class="lg-toggle-row" for="toggle-day-builder"><span class="lg-toggle-copy">
          <span class="lg-toggle-title lg-constructor-title">Добавить в Конструктор?</span><span class="lg-toggle-sub" id="task-day-hint"></span></span>
          <input id="toggle-day-builder" class="lg-switch" type="checkbox" role="switch"></label></div>
      <p class="lg-error-note" role="alert" hidden></p>
      <div class="lg-actions"><button type="button" class="lg-btn" id="btn-cancel">Отмена</button><button type="submit" class="lg-btn lg-btn-primary">Создать</button></div>`;
    const name=form.querySelector('#task-name-input'),goal=form.querySelector('#toggle-goal'),plan=form.querySelector('#toggle-day-builder');
    form.querySelector('h2').textContent=options.title||'Новое задание';form.querySelector('[type=submit]').textContent=options.submitLabel||'Создать';
    name.value=options.name||'';
    goal.checked=!!options.goalChecked;
    plan.disabled=options.canPlan===false;plan.checked=!!options.inDayBuilder && !plan.disabled;
    form.querySelector('.lg-goal-off').textContent='У каждого дела свой смысл';
    const checks=[...form.querySelectorAll('[data-day]')];
    checks.forEach((c,i)=>c.checked=(options.weekdays||[]).includes(i+1));
    const selected=()=>checks.flatMap((c,i)=>c.checked?[i+1]:[]);
    function update(){
      const values=selected();
      presets.forEach(([id,,target])=>form.querySelector(`[data-preset="${id}"]`).setAttribute('aria-pressed',String(values.length===target.length && target.every(d=>values.includes(d)))));
      form.querySelector('.lg-repeat-caption').textContent=!values.length?'Разовое задание · без повторения':values.length===7?'Повторяется каждый день':'Повторение: '+values.map(d=>days[d-1]).join(', ');
      goal.closest('.lg-toggle-card').classList.toggle('is-active-goal',goal.checked);
      form.querySelector('.lg-goal-slot').classList.toggle('is-open',goal.checked);
      plan.closest('.lg-toggle-card').classList.toggle('is-active-day',plan.checked);
      const dayHint=form.querySelector('#task-day-hint');
      dayHint.replaceChildren();
      if(plan.disabled)dayHint.textContent=options.planDisabledHint||'После перехода к этапу';
      else if(plan.checked){
        const title=document.createElement('span');title.textContent='Конструкторе';title.style.color='var(--accent)';
        dayHint.append(document.createTextNode('Теперь будет в «'),title,document.createTextNode('»'));
      }else dayHint.textContent='Пока будет только в блоке';
    }
    form.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{
      const target=presets.find(p=>p[0]===button.dataset.preset)[2];checks.forEach((c,i)=>c.checked=target.includes(i+1));update();
      checks[0].dispatchEvent(new Event('input',{bubbles:true}));
    }));
    checks.forEach(c=>c.addEventListener('change',update));goal.addEventListener('change',update);plan.addEventListener('change',update);
    const thread=LifeGameLightThread.create({value:options.reward??LifeGameLightThread.DEFAULT_REWARD,id:'task-reward',title:'Награда',onLevel:options.onLevel});
    form.querySelector('#light-thread-slot').replaceWith(thread.element);
    form.querySelector('#btn-cancel').addEventListener('click',()=>options.onCancel?.());
    form.addEventListener('input',()=>{form.querySelector('.lg-error-note').hidden=true;});
    update();
    return {form,thread,refresh:update,values:()=>({name:name.value.trim(),weekdays:selected(),reward:thread.value(),goalChecked:goal.checked,inDayBuilder:plan.checked}),
      error(message,focus=true){const note=form.querySelector('.lg-error-note');note.hidden=focus;note.textContent=focus?'':message;if(focus){name.setAttribute('aria-invalid','true');name.focus();}}};
  }
  root.LifeGameTaskForm=Object.freeze({create});
})(window);
