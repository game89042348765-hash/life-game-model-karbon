/* Supplied path-v2 animation frames, with lifecycle cleanup for real application renders. */
'use strict';
(()=>{
let current=null;
function init(line){
  if(current?.line===line)return;
  clear();if(!line)return;
  const back=document.createElement('div');back.className='lg-dawn-back';back.setAttribute('aria-hidden','true');line.prepend(back);
  let disposed=false,busy=false;
  const timers=new Set(),waiters=new Map(),animations=new Set(),frames=new Set();
  const aborted=()=>new DOMException('Path replaced','AbortError');
  const later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);if(!disposed)fn();},ms);timers.add(id);return id;};
  const wait=ms=>new Promise((resolve,reject)=>{if(disposed){reject(aborted());return;}const id=later(()=>{waiters.delete(id);resolve();},ms);waiters.set(id,reject);});
  const requestFrame=fn=>{const id=requestAnimationFrame(t=>{frames.delete(id);if(!disposed)fn(t);});frames.add(id);return id;};
  const animate=(node,keyframes,options)=>{if(disposed)throw aborted();const a=node.animate(keyframes,options);animations.add(a);a.finished.then(()=>animations.delete(a),()=>animations.delete(a));return a;};
const pick=sel=>line.querySelector(':scope>'+sel);
function marker(el){const cs=getComputedStyle(line),rail=parseFloat(cs.getPropertyValue('--lg-path-rail'))||0,lane=parseFloat(cs.getPropertyValue('--lg-path-lane'))||0;
  const box=line.getBoundingClientRect(),r=el.getBoundingClientRect();return {x:r.left-box.left+rail-lane,y:r.top-box.top+26}}
const put=(cls,p)=>{const e=document.createElement('div');e.className=cls;e.style.left=p.x+'px';e.style.top=p.y+'px';e.setAttribute('aria-hidden','true');line.append(e);return e};
const glow=(px,warm=1)=>`drop-shadow(0 0 ${px}px rgba(${warm?'255,213,74':'239,107,116'},1)) drop-shadow(0 0 ${px*2}px rgba(${warm?'255,213,74,.8':'239,107,116,.7'}))`;

// Звезда рождается на линии — на знаке этапа, где выполнено задание («Сейчас» или «Невыполненное»), и летит вниз.
function route(check,article){const p0=marker(article),end=pick('.is-maximum')||[...line.querySelectorAll(':scope>.lg-level')].at(-1),pE=marker(end);
  return {p0,dx:0,dy:0,d:pE.y-p0.y,k:0,end,len:pE.y-p0.y}}
const T=(r,x,y,sc)=>`translate(${x}px,${y}px) scale(${sc})`;
function arrive(end){end.classList.remove('lg-star-arrived');void end.offsetWidth;end.classList.add('lg-star-arrived');later(()=>end.classList.remove('lg-star-arrived'),800)}
const NS='http://www.w3.org/2000/svg';
const ringSvg=(p,r,cls)=>{const s=document.createElementNS(NS,'svg');s.setAttribute('class','lg-fx-ring '+cls);s.setAttribute('viewBox','-30 -30 60 60');s.setAttribute('aria-hidden','true');
  s.style.left=p.x+'px';s.style.top=p.y+'px';const c=document.createElementNS(NS,'circle');c.setAttribute('r',r);c.setAttribute('transform','rotate(-90)');s.append(c);line.append(s);return {s,c}};
const pulse=(el,cls,ms)=>{el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);later(()=>el.classList.remove(cls),ms)};
// Свет бежит по линии от a до b: золотой отрезок растёт, впереди искра.
async function runLight(a,b,ms,cls=''){
  const glowLine=put('lg-rail-glow',a),spark=put('lg-fx-spark '+cls,a),d=Math.max(0,b.y-a.y);
  const o={duration:ms,easing:'cubic-bezier(.45,0,.25,1)',fill:'forwards'};
  animate(glowLine,[{height:'0px'},{height:d+'px'}],o);
  await animate(spark,[{transform:'translate(-50%,-50%) translateY(0) scale(.6)',opacity:.4},{transform:`translate(-50%,-50%) translateY(${d*.5}px) scale(1.1)`,opacity:1,offset:.5},{transform:`translate(-50%,-50%) translateY(${d}px) scale(.7)`,opacity:1}],o).finished;
  spark.remove();return glowLine}
const MODES={
  // «Сейчас» — шаг к цели («Свет сходится»): линия загорается к знаку «Сейчас» с двух сторон, в точке встречи рождается
  // большая звезда с крестом лучей, затем летит к «Моему ориентиру»; в цели — «Сверхновая»: вспышка, 8 лучей, карточка озаряется.
  async NOW(check,article){
    const goal=pick('.is-optimal')||pick('.is-maximum'),p0=marker(article),pG=marker(goal),card=article.querySelector(':scope>.card');
    const wave=(p,from,to,ms,delay=0)=>{const {s}=ringSvg(p,10,'is-out');animate(s,[{transform:`translate(-50%,-50%) scale(${from})`,opacity:1},{transform:`translate(-50%,-50%) scale(${to})`,opacity:0}],{duration:ms,delay,easing:'cubic-bezier(.2,.7,.3,1)',fill:'both'}).onfinish=()=>s.remove();};
    const motes=(p,n,r)=>{for(let k=0;k<n;k++){const m=put('lg-fx-mote',p),ang=k/n*Math.PI*2,d=r*(.6+Math.random()*.6);
      animate(m,[{transform:'translate(-50%,-50%)',opacity:1},{transform:`translate(calc(-50% + ${Math.cos(ang)*d}px),calc(-50% + ${Math.sin(ang)*d}px)) scale(.3)`,opacity:0}],{duration:700+Math.random()*300,easing:'ease-out'}).onfinish=()=>m.remove();}};
    const glowCard=(el,ms)=>{if(el)animate(el,[{boxShadow:'0 0 0 rgba(255,213,74,0)'},{boxShadow:'0 0 34px rgba(255,213,74,.38),inset 0 0 26px rgba(255,213,74,.12)',offset:.3},{boxShadow:'0 0 0 rgba(255,213,74,0)'}],{duration:ms});};
    // «Свет сходится»: линия загорается к «Сейчас» сверху и снизу, в точке встречи рождается большая звезда с крестом лучей
    const half=70,up=put('lg-rail-glow',{x:p0.x,y:p0.y-half}),dn=put('lg-rail-glow lg-fx-up',{x:p0.x,y:p0.y});
    animate(up,[{height:'0px'},{height:half+'px'}],{duration:520,easing:'cubic-bezier(.5,0,.3,1)',fill:'forwards'});
    animate(dn,[{height:half+'px',clipPath:'inset(100% 0 0 0)'},{height:half+'px',clipPath:'inset(0 0 0 0)'}],{duration:520,easing:'cubic-bezier(.5,0,.3,1)',fill:'forwards'});
    await wait(520);
    article.classList.add('lg-fx-now');glowCard(card,1500);
    const star=put('lg-flying-star lg-bright',p0),tail=document.createElement('s'),rays=document.createElement('i'),core=document.createElement('b');star.append(tail,rays,core);
    animate(core,[{transform:'translate(-50%,-50%) scale(.2)',opacity:0,filter:glow(3)},{transform:'translate(-50%,-50%) scale(2.4) rotate(30deg)',opacity:1,filter:glow(16),offset:.4},{transform:'translate(-50%,-50%) scale(1.2)',opacity:1,filter:glow(10)}],{duration:700,easing:'ease-out',fill:'forwards'});
    animate(rays,[{opacity:0,transform:'translate(-50%,-50%) scale(.3)'},{opacity:1,transform:'translate(-50%,-50%) scale(2.2)',offset:.4},{opacity:1,transform:'translate(-50%,-50%) scale(1.6)'}],{duration:700,fill:'forwards'});
    wave(p0,.4,6,900);motes(p0,14,56);
    await wait(700);
    animate(rays,[{transform:'translate(-50%,-50%) scale(1.6) rotate(0)'},{transform:'translate(-50%,-50%) scale(1.35) rotate(8deg)'},{transform:'translate(-50%,-50%) scale(1.6) rotate(0)'}],{duration:700,fill:'forwards'});
    await wait(650);
    for(const n of [up,dn])animate(n,[{opacity:1},{opacity:0}],{duration:600,fill:'forwards'}).onfinish=()=>n.remove();
    animate(rays,[{transform:'translate(-50%,-50%) scale(1.6)'},{transform:'translate(-50%,-50%) scale(1.2)'}],{duration:300,fill:'forwards'});
    later(()=>article.classList.remove('lg-fx-now'),400);
    // полёт к цели: линия загорается, знаки по пути вспыхивают
    const d=pG.y-p0.y,F=Math.min(1600,700+d*.6),o={duration:F,easing:'cubic-bezier(.55,0,.85,.55)',fill:'forwards'};
    const railGlow=put('lg-rail-glow',p0);animate(railGlow,[{height:'0px'},{height:d+'px'}],o);
    animate(core,[{transform:'translate(-50%,-50%) scale(1.2)',filter:glow(10)},{transform:'translate(-50%,-50%) scale(1.7)',filter:glow(16)}],o);
    animate(tail,[{opacity:.5,height:'30px'},{opacity:1,height:'170px',offset:.8},{opacity:.6,height:'60px'}],o);
    const markers=[...line.querySelectorAll(':scope>.lg-level')].filter(el=>el!==article&&el!==goal).map(el=>({el,y:marker(el).y})).filter(m=>m.y>p0.y&&m.y<pG.y);
    const fly=animate(star,[{transform:'translate(0,0)'},{transform:`translate(0,${d}px)`}],o);
    const tick=()=>{if(fly.playState!=='running')return;const y=core.getBoundingClientRect().top+core.getBoundingClientRect().height/2-line.getBoundingClientRect().top;
      for(const m of markers)if(!m.done&&y>=m.y){m.done=true;pulse(m.el,'lg-pass',900);}requestFrame(tick);};requestFrame(tick);
    await fly.finished;
    // «Сверхновая» в цели
    animate(core,[{transform:'translate(-50%,-50%) scale(1.7)'},{transform:'translate(-50%,-50%) scale(2.6) rotate(45deg)',opacity:1,offset:.3},{transform:'translate(-50%,-50%) scale(.2) rotate(90deg)',opacity:0}],{duration:700,fill:'forwards'});
    animate(rays,[{opacity:1,transform:'translate(-50%,-50%) scale(1.2)'},{opacity:1,transform:'translate(-50%,-50%) scale(2.2)',offset:.3},{opacity:0,transform:'translate(-50%,-50%) scale(.6)'}],{duration:800,fill:'forwards'});
    animate(tail,[{opacity:.6},{opacity:0}],{duration:300,fill:'forwards'});
    glowCard(goal.querySelector(':scope>.card'),1600);pulse(goal,'lg-fx-hit',1300);
    for(let k=0;k<8;k++){const r=put('lg-fx-ray',pG);animate(r,[{transform:`rotate(${k*45}deg) scaleX(0)`,opacity:1},{transform:`rotate(${k*45}deg) scaleX(1)`,opacity:1,offset:.4},{transform:`rotate(${k*45}deg) scaleX(1.2)`,opacity:0}],{duration:900,easing:'ease-out'}).onfinish=()=>r.remove();}
    wave(pG,.3,7,1100,80);motes(pG,16,70);
    await wait(850);star.remove();
    animate(railGlow,[{opacity:1},{opacity:0}],{duration:900,fill:'forwards'}).onfinish=()=>railGlow.remove();
    await wait(300);
  },
  // «Невыполненное» — закрыл незавершённое: красное кольцо замыкается золотом по кругу,
  // знак вспыхивает; капля света стекает к «Сейчас» и зажигает его — прошлое догнало настоящее.
  async MISSED(check,article){
    const p0=marker(article),now=pick('.is-current'),pN=now?marker(now):null;
    const {s,c}=ringSvg(p0,11,'is-close');const L=2*Math.PI*11;c.style.strokeDasharray=L;c.style.strokeDashoffset=L;
    animate(c,[{strokeDashoffset:L,stroke:'#ef6b74'},{strokeDashoffset:L*.45,stroke:'#f2a46a',offset:.5},{strokeDashoffset:0,stroke:'#ffd54a'}],{duration:1100,easing:'cubic-bezier(.5,0,.3,1)',fill:'forwards'});
    await wait(1100);
    pulse(article,'lg-fx-paid',1600);
    animate(s,[{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:'translate(-50%,-50%) scale(1.25)',opacity:1,offset:.3},{transform:'translate(-50%,-50%) scale(2.6)',opacity:0}],{duration:800,easing:'ease-out',fill:'forwards'}).onfinish=()=>s.remove();
    const flash=put('lg-charge',p0);animate(flash,[{transform:'scale(.3)',opacity:.9},{transform:'scale(1.6)',opacity:0}],{duration:700,easing:'ease-out'}).onfinish=()=>flash.remove();
    await wait(350);
    if(!pN||pN.y<=p0.y)return;
    const glowLine=await runLight(p0,pN,Math.min(1200,500+(pN.y-p0.y)*.8),'is-drop');
    pulse(now,'lg-fx-now',1200);
    const {s:wave}=ringSvg(pN,10,'is-out');animate(wave,[{transform:'translate(-50%,-50%) scale(.6)',opacity:1},{transform:'translate(-50%,-50%) scale(3)',opacity:0}],{duration:800,easing:'cubic-bezier(.2,.7,.3,1)'}).onfinish=()=>wave.remove();
    await wait(500);
    animate(glowLine,[{opacity:1},{opacity:0}],{duration:800,fill:'forwards'}).onfinish=()=>glowLine.remove();
  }
};

  async function launch(mode){
    if(disposed||busy||!line.isConnected)return;
    const article=typeof mode==='string'?pick(mode==='MISSED'?'.lg-path-missed':'.is-current'):mode?.closest('.lg-path-aesthetics>.lg-level');
    if(!article||!line.contains(article)||!(pick('.is-optimal')||pick('.is-maximum')))return;
    busy=true;
    try{await (article.classList.contains('lg-path-missed')?MODES.MISSED:MODES.NOW)(null,article);}
    catch(error){if(error.name!=='AbortError')console.warn('Эффект пути недоступен:',error);}
    finally{busy=false;}
  }
  function dispose(){
    disposed=true;
    for(const reject of waiters.values())reject(aborted());waiters.clear();
    for(const id of timers)clearTimeout(id);timers.clear();
    for(const id of frames)cancelAnimationFrame(id);frames.clear();
    for(const a of animations)a.cancel();animations.clear();
    line.querySelectorAll('.lg-fx-glint').forEach(n=>n.remove());line.querySelectorAll('.lg-flying-star,.lg-charge,.lg-rail-glow,.lg-dawn-back,.lg-fx-ring,.lg-fx-spark,.lg-fx-ray,.lg-fx-mote,.lg-fx-glint,.lg-fx-up').forEach(n=>n.remove());
    line.querySelectorAll('.lg-pass,.lg-star-arrived,.lg-fx-now,.lg-fx-hit,.lg-fx-paid').forEach(n=>n.classList.remove('lg-pass','lg-star-arrived','lg-fx-now','lg-fx-hit','lg-fx-paid'));
  }
  // Нажатие на кружок знака «Сейчас» или «Невыполненное» на линии запускает его анимацию.
  const onTap=e=>{for(const [sel,mode] of [['.is-current','NOW'],['.lg-path-missed','MISSED']]){const el=pick(sel);if(!el)continue;
    const m=marker(el),b=line.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;
    if(Math.hypot(x-m.x,y-m.y)<=22){e.preventDefault();e.stopPropagation();launch(mode);return;}}};
  line.addEventListener('click',onTap,true);
  const baseDispose=dispose;
  current={line,launch,dispose:()=>{line.removeEventListener('click',onTap,true);baseDispose();}};
}
function clear(){current?.dispose();current=null;}
window.LifeGamePathStar=Object.freeze({init,clear,launch:source=>current?.launch(source)});
})();
