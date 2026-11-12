/* Sunrise is an optional UI introduction; it never reads or writes game progress. */
(() => {
  'use strict';
  const KEY = 'lifegame-sunrise-v1';
  const mode = document.getElementById('lg-sunrise-mode');
  const replay = document.getElementById('lg-sunrise-replay');
  const status = document.getElementById('lg-sunrise-status');
  const sounds = document.getElementById('sound-enabled');
  if (!mode || !replay || !status || !sounds) return;
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  let readable = true;
  function readPrefs() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) return {mode:'daily',lastShownDay:null};
      const data = JSON.parse(raw);
      if (!data || !['daily','always','off'].includes(data.mode) ||
          (data.lastShownDay !== null && !/^\d{4}-\d{2}-\d{2}$/.test(data.lastShownDay))) throw new Error('Invalid preference');
      return {mode:data.mode,lastShownDay:data.lastShownDay};
    } catch {
      readable = false;
      status.textContent = 'Не удалось прочитать настройку. Заставку можно посмотреть вручную.';
      return {mode:'off',lastShownDay:null};
    }
  }
  let prefs = readPrefs();
  mode.value = prefs.mode;
  function save(next) {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      prefs = next; readable = true; mode.value = prefs.mode;
      return true;
    } catch {
      status.textContent = 'Не удалось сохранить настройку. Попробуй ещё раз.';
      return false;
    }
  }
  const splash = document.createElement('dialog');
  splash.className = 'lg-sunrise';
  splash.setAttribute('aria-label','Заставка LifeGame. Больше жизни. В каждом дне.');
  splash.setAttribute('tabindex','-1');
  splash.innerHTML = `<div class="lg-sunrise-controls"><button type="button" class="lg-splash-ui lg-splash-snd" data-sunrise="sound" aria-label="Включить звук" aria-pressed="false"></button></div><button type="button" class="lg-sunrise-disable lg-splash-ui lg-splash-skip" data-sunrise="disable">Не показывать при запуске</button>`;
  document.body.append(splash);
  const enableSound = splash.querySelector('[data-sunrise="sound"]');
  let active = false, pending = false, closing = false, generation = 0, scene = null, closeTimer, previousFocus;
  const ART_URL = new URL('images/splash-path.jpg',document.currentScript.src).href;
  splash.style.setProperty('--art',`url("${ART_URL}")`);
  let audio = null, played = false;
  const voices = [];
  let imageReady;
  function artReady() {
    if (!imageReady) imageReady = new Promise((resolve,reject) => {
      const img = new Image();
      img.onload = resolve; img.onerror = reject;
      img.src = ART_URL;
    });
    return imageReady;
  }
  function soundOn() { return sounds.checked && !sounds.disabled; }
  function stopAudio() {
    for (const [osc,gain] of voices.splice(0)) {
      gain.disconnect();
      try { osc.stop(); } catch { /* already ended */ }
    }
    if (audio) { const old = audio; audio = null; old.close().catch(() => {}); }
    played = false;
  }
  function syncSoundButton() {
    const available = !!(window.AudioContext || window.webkitAudioContext) && !sounds.disabled;
    const audible = soundOn() && audio?.state === 'running';
    enableSound.disabled = !available;
    const label = !available ? 'Звук недоступен' : audible ? 'Выключить звук' : 'Включить звук';
    enableSound.setAttribute('aria-label',label);
    enableSound.setAttribute('title',label);
    enableSound.setAttribute('aria-pressed',String(audible));
    enableSound.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z"/><path d="' +
      (audible ? 'M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14' : 'm16 9 5 6m0-6-5 6') + '"/></svg>';
  }
  function playNotes() {
    if (!active || played || !soundOn() || !audio || audio.state !== 'running') return;
    played = true;
    const now = audio.currentTime;
    // A soft, short ascending chord; no downloaded audio or external API.
    [196,293.66,392,523.25].forEach((frequency,i) => {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = 'sine'; osc.frequency.value = frequency;
      const at = now + i * .23;
      gain.gain.setValueAtTime(0,at);
      gain.gain.linearRampToValueAtTime(.045,at+.12);
      gain.gain.exponentialRampToValueAtTime(.0001,at+1.35);
      osc.connect(gain); gain.connect(audio.destination);
      voices.push([osc,gain]); osc.start(at); osc.stop(at+1.45);
    });
    syncSoundButton();
  }
  function requestSound() {
    if (!soundOn()) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audio) audio = new Audio();
      if (audio.state === 'suspended') audio.resume().then(() => { playNotes(); syncSoundButton(); }).catch(() => {});
      playNotes(); syncSoundButton();
    } catch { syncSoundButton(); }
  }
  function finish() {
    clearTimeout(closeTimer);
    generation++;active = false;pending = false;closing = false;
    scene?.stop();scene=null;
    stopAudio();
    splash.classList.remove('is-playing','lg-splash-out');
    if (splash.open) splash.close();
    document.documentElement.classList.remove('lg-sunrise-open');
    if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
  }
  function dismiss(){
    if(!active||closing)return;
    closing=true;clearTimeout(closeTimer);scene?.stop(false);stopAudio();
    splash.classList.add('lg-splash-out');closeTimer=setTimeout(finish,650);
  }
  async function show(manual = false) {
    if (active || pending || closing) return;
    const ticket=++generation;pending = true;
    // Keep this request inside the manual click's user activation.
    if (manual) requestSound();
    try {
      await artReady();
      if(ticket!==generation)return;
      if (document.hidden) { stopAudio(); return; }
      if (!manual) {
        prefs = readPrefs(); mode.value = prefs.mode;
        if (!readable || prefs.mode === 'off' || (prefs.mode === 'daily' && prefs.lastShownDay === today())) return;
        if (!document.getElementById('save-warning')?.hidden) return;
        if (!save({...prefs,lastShownDay:today()})) return;
      }
      previousFocus = document.activeElement;
      splash.showModal();
      splash.focus({preventScroll:true});
      active = true;
      document.documentElement.classList.add('lg-sunrise-open');
      splash.classList.add('is-playing');
      splash.querySelector('[data-sunrise="disable"]').textContent='Не показывать при запуске';
      scene=LifeGameSplashScene.mount(splash,{onComplete:dismiss,onError:()=>{status.textContent='Не удалось показать анимацию. Приложение доступно как обычно.';finish();}});
      requestSound(); playNotes(); syncSoundButton();
      closeTimer = setTimeout(finish,7300);
      scene.start();
    } catch {
      status.textContent = 'Не удалось открыть заставку. Приложение доступно как обычно.';
      finish();
      imageReady = null;
    } finally { if(ticket===generation)pending = false; }
  }
  enableSound.addEventListener('click',() => {
    if (enableSound.getAttribute('aria-pressed') === 'true') {
      if (sounds.checked && !sounds.disabled) sounds.click();
      stopAudio();
    } else {
      if (!sounds.checked && !sounds.disabled) sounds.click();
      requestSound();
    }
    syncSoundButton();
  });
  splash.querySelector('[data-sunrise="disable"]').addEventListener('click',() => {
    if (save({...prefs,mode:'off'})) { status.textContent = 'Автопоказ выключен. Ручной просмотр доступен.'; dismiss(); }
    else splash.querySelector('[data-sunrise="disable"]').textContent = 'Не удалось сохранить · повторить';
  });
  splash.addEventListener('click',e=>{if(!e.target.closest('button'))dismiss();});
  splash.addEventListener('cancel',e => { e.preventDefault(); dismiss(); });
  splash.addEventListener('close',() => { if (active) finish(); });
  splash.addEventListener('animationend',e => { if (e.target === splash && e.animationName === 'lg-splash-out' && closing) finish(); });
  mode.addEventListener('change',() => {
    if (save({...prefs,mode:mode.value})) status.textContent = prefs.mode === 'off' ? 'Автопоказ выключен. Ручной просмотр доступен.' : 'Режим показа сохранён.';
    else mode.value = prefs.mode;
  });
  replay.addEventListener('click',() => show(true));
  sounds.addEventListener('change',() => { if (!soundOn()) stopAudio(); syncSoundButton(); });
  document.addEventListener('visibilitychange',() => { if (document.hidden && active) finish(); });
  window.addEventListener('pagehide',finish);
  window.addEventListener('popstate',() => { if (active) finish(); });
  window.addEventListener('storage',e => {
    if (e.key === KEY || e.key === null) {
      prefs = readPrefs(); mode.value = prefs.mode;
      if (prefs.mode === 'off' && active) finish();
    }
    if (!soundOn()) stopAudio();
    syncSoundButton();
  });
  show();
})();
