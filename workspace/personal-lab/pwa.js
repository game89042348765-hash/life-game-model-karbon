/* Optional installation/offline shell. User data stays in localStorage, never in this cache. */
(()=>{
  if(!('serviceWorker' in navigator)||location.protocol==='file:')return;
  let refreshing=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing)location.reload()});
  const offer=worker=>{
    if(document.getElementById('app-update'))return;
    const panel=document.createElement('div');panel.id='app-update';panel.className='update-note';
    panel.innerHTML='<span>Доступно обновление LifeGame</span><button class="btn s">Обновить</button>';
    panel.querySelector('button').onclick=()=>{if(document.querySelector('#layer form')){alert('Сначала сохраните или закройте открытый редактор.');return}refreshing=true;worker.postMessage({type:'SKIP_WAITING'})};document.body.append(panel);
  };
  navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(reg=>{
    if(reg.waiting)offer(reg.waiting);
    reg.addEventListener('updatefound',()=>{const w=reg.installing;if(w)w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)offer(w)})});
  }).catch(()=>{/* The online application remains usable without installation support. */});
})();
