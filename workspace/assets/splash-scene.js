/* Scene from the user's splash-demo HTML. Prefs, sound and game data live outside this renderer. */
'use strict';
(()=>{
function mount(sp,options={}){
  let stopped=false,started=false;
  const owned=[],timers=new Set(),frames=new Set(),animations=new Set(),pending=new Set();
  const abort=()=>new DOMException('Splash closed','AbortError');
  const classes=value=>value.split(/\s+/).map(name=>'lg-splash-'+name).join(' ');
  const h=(t,a={},...k)=>{const e=document.createElement(t);for(const[x,v]of Object.entries(a)){if(x==='class')e.className=classes(v);else if(x==='style')e.style.cssText=v;else if(x==='html')e.innerHTML=v;else e.setAttribute(x,v)}for(const c of k.flat())if(c!=null)e.append(c.nodeType?c:document.createTextNode(c));return e};
  const NS='http://www.w3.org/2000/svg',sv=(t,a)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,k==='class'?classes(a[k]):a[k]);return e};
  const wait=ms=>new Promise((res,reject)=>{if(stopped){reject(abort());return;}pending.add(reject);const id=setTimeout(()=>{timers.delete(id);pending.delete(reject);res()},ms);timers.add(id)});
  const frame=fn=>{const id=requestAnimationFrame(t=>{frames.delete(id);if(!stopped)fn(t)});frames.add(id);return id};
  const animate=(node,kf,o)=>{if(stopped)throw abort();const a=node.animate(kf,o);animations.add(a);a.finished.then(()=>animations.delete(a),()=>animations.delete(a));return a};
  const A=(el,kf,o)=>animate(el,kf,{fill:'both',easing:'cubic-bezier(.25,.6,.2,1)',...o});
  const CX=485,CY=609,R=425,P=a=>[CX+R*Math.cos(a*Math.PI/180),CY+R*Math.sin(a*Math.PI/180)];
  const arc=(a0,a1)=>{const[x0,y0]=P(a0),[x1,y1]=P(a1);return`M${x0} ${y0}A${R} ${R} 0 ${Math.abs(a1-a0)>180?1:0} ${a1>a0?1:0} ${x1} ${y1}`};
  async function play(){
  const fr=h('div',{class:'fr'});const ambient=h('div',{class:'amb'});sp.prepend(ambient,fr);owned.push(ambient,fr);
  const poster=h('div',{class:'poster'});
  const sun=h('div',{class:'sun'},h('div',{class:'sun-rays'}),h('div',{class:'sun-glow'}));
  // кольцо: левая половина рисуется следом за звездой, правая — навстречу
  const svg=sv('svg',{class:'ring',viewBox:'0 0 941 1672',preserveAspectRatio:'none'});
  const halo=sv('path',{class:'halo',d:arc(-150,-30+360)}); // не используется напрямую
  const left=sv('path',{class:'main',d:arc(-130,152)}).cloneNode();left.setAttribute('d',arc(-128,-232+0));
  const L=sv('path',{class:'main',d:arc(-128,-218)}); // верх-лево → вниз по левому боку (против часовой)
  const Lh=sv('path',{class:'halo',d:arc(-128,-218)});
  const Rr=sv('path',{class:'main',d:arc(-128,38)});   // от верха вправо (по часовой)
  const Rh=sv('path',{class:'halo',d:arc(-128,38)});
  const orbit=sv('circle',{class:'orbit',cx:CX,cy:CY,r:R+22});
  const beads=[0,1,2].map(()=>sv('circle',{class:'bead',r:3.2}));
  svg.append(orbit,Lh,Rh,L,Rr,...beads);
  const trail=h('canvas',{class:'trail'}),emb=h('canvas',{class:'embers'});
  const star=h('div',{class:'star'},h('i'),h('b'));
  const logo=h('div',{class:'tx logo'},h('i'),h('span',{},'LIFE'),h('span',{class:'sl'},'/'),h('span',{},'GAME'));
  const title=h('div',{class:'tx title'},h('span',{},'Больше'),' ',h('span',{},'жизни.'),h('br'),h('span',{},'В каждом'),' ',h('span',{},'дне.'));
  const tag=h('div',{class:'tx tagline'},'ТВОЯ ИГРА. ТВОЙ ПУТЬ.');
  const load=h('div',{class:'loading'},h('div',{class:'loading-fill'}));
  fr.append(poster,sun,emb,svg,trail,star,logo,title,tag,h('div',{class:'bar-eraser'}),load);
  const fw=fr.clientWidth,fh=fr.clientHeight,kx=fw/941,ky=fh/1672;
  // подготовка штрихов
  for(const p of [L,Lh,Rr,Rh]){const len=p.getTotalLength();p.style.strokeDasharray=len;p.style.strokeDashoffset=len;p.dataset.len=len}
  // 0) кадр выходит из темноты
  A(poster,[{transform:'scale(1.05)',filter:'brightness(.55) saturate(.72)'},{transform:'scale(1.005)',filter:'brightness(1.05) saturate(1.06)'}],{duration:4400,easing:'ease-out'});
  // угольки (как раньше, но canvas)
  const dpr=Math.min(2,devicePixelRatio||1),ec=emb.getContext('2d');emb.width=fw*dpr;emb.height=fh*dpr;ec.scale(dpr,dpr);
  const ps=[...Array(46)].map(()=>({x:fw*(.05+Math.random()*.9),y:fh*(.42+Math.random()*.4),vy:.15+Math.random()*.4,vx:(Math.random()-.4)*.2,r:.6+Math.random()*1.4,d:600+Math.random()*2200}));
  const t0=performance.now();(function tick(t){if(!emb.isConnected)return;ec.clearRect(0,0,fw,fh);const e=t-t0;for(const p of ps){if(e<p.d)continue;p.y-=p.vy;p.x+=p.vx+Math.sin((e+p.d)/700)*.15;
    const a=Math.min(1,(e-p.d)/700)*Math.max(0,Math.min(1,(p.y-fh*.2)/(fh*.25)));ec.beginPath();ec.arc(p.x,p.y,p.r,0,7);ec.fillStyle=`rgba(255,217,96,${(.7*a).toFixed(3)})`;ec.shadowColor='#ffad00';ec.shadowBlur=7;ec.fill()}frame(tick)})(t0);
  // 1) звезда влетает из левого верхнего угла, ложится на кольцо и ведёт его вниз к солнцу
  await wait(250);
  const core=star.querySelector('b'),rays=star.querySelector('i');
  const tc=trail.getContext('2d');trail.width=fw*dpr;trail.height=fh*dpr;tc.scale(dpr,dpr);
  const[sx,sy]=P(-128),enter=[-0.06*fw,-0.04*fh],sunP=[.436*fw,.508*fh];
  const pathPts=[];for(let i=0;i<=40;i++){const u=i/40;pathPts.push([enter[0]+(sx*kx-enter[0])*u,enter[1]+(sy*ky-enter[1])*u])}  // влёт к кольцу
  for(let a=-128;a>=-218;a-=1.2){const[x,y]=P(a);pathPts.push([x*kx,y*ky])}                                        // по кольцу вниз
  const[ex,ey]=P(-218);for(let i=1;i<=36;i++){const u=i/36,c=1-(1-u)*(1-u);pathPts.push([ex*kx+(sunP[0]-ex*kx)*c,ey*ky+(sunP[1]-ey*ky)*u])} // к солнцу
  const T=2500,start=performance.now(),idxRingStart=41,idxRingEnd=41+Math.round(90/1.2);
  A(core,[{opacity:0,transform:'translate(-50%,-50%) scale(.2)'},{opacity:1,transform:'translate(-50%,-50%) scale(.75)'}],{duration:350});
  A(rays,[{opacity:0},{opacity:.35}],{duration:400});
  const hist=[];
  await new Promise((res,reject)=>{pending.add(reject);const done=()=>{pending.delete(reject);res()};(function step(t){const u=Math.min(1,(t-start)/T),eu=u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2,f=eu*(pathPts.length-1),i=Math.floor(f),r=f-i,
      a=pathPts[i],b=pathPts[Math.min(i+1,pathPts.length-1)],x=a[0]+(b[0]-a[0])*r,y=a[1]+(b[1]-a[1])*r;
      star.style.left=x+'px';star.style.top=y+'px';hist.push([x,y]);if(hist.length>26)hist.shift();
      // хвост
      tc.clearRect(0,0,fw,fh);for(let k=1;k<hist.length;k++){tc.beginPath();tc.moveTo(...hist[k-1]);tc.lineTo(...hist[k]);tc.strokeStyle=`rgba(255,226,140,${(k/hist.length*.75).toFixed(3)})`;tc.lineWidth=1+k/hist.length*2.5;tc.shadowColor='#ffd54a';tc.shadowBlur=8;tc.lineCap='round';tc.stroke()}
      // левая дуга кольца рисуется следом за звездой
      const pr=Math.max(0,Math.min(1,(f-idxRingStart)/(idxRingEnd-idxRingStart)));for(const p of [L,Lh])p.style.strokeDashoffset=p.dataset.len*(1-pr);
      if(u<1)frame(step);else done()})(start)});
  tc.clearRect(0,0,fw,fh);
  // 2) звезда входит в солнце: солнце вспыхивает, еле заметные лучи
  A(core,[{opacity:1,transform:'translate(-50%,-50%) scale(.75)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.8) rotate(25deg)',offset:.4},{opacity:0,transform:'translate(-50%,-50%) scale(.4)'}],{duration:800,easing:'ease-out'});
  A(rays,[{opacity:.35},{opacity:1,offset:.35},{opacity:0}],{duration:900});
  A(sun.children[1],[{opacity:0,transform:'scale(.4)'},{opacity:1,transform:'scale(1.15)',offset:.35},{opacity:.6,transform:'scale(1)'}],{duration:1600,easing:'ease-out'});
  A(sun.children[0],[{opacity:0,transform:'rotate(-4deg)'},{opacity:1,transform:'rotate(5deg)'}],{duration:2600,easing:'ease-out'});
  // 3) правая дуга кольца дорисовывается от верха, по кольцу бегут бусины-огоньки
  for(const p of [Rr,Rh])A(p,[{strokeDashoffset:p.dataset.len},{strokeDashoffset:0}],{duration:1300,easing:'cubic-bezier(.4,0,.2,1)'});
  A(orbit,[{opacity:0},{opacity:1}],{duration:900,delay:500});
  beads.forEach((bd,i)=>{const a0=-128-i*35;const st2=performance.now()+300+i*120;(function bt(t){if(!bd.isConnected)return;const e=Math.max(0,t-st2)/1000,[x,y]=P(a0+e*22);bd.setAttribute('cx',x);bd.setAttribute('cy',y);bd.style.opacity=Math.min(.9,e*1.5);frame(bt)})(performance.now())});
  animate(orbit,[{transform:'rotate(0deg)'},{transform:'rotate(25deg)'}],{duration:5000,fill:'both'});orbit.style.transformOrigin=`${CX}px ${CY}px`;
  // 4) логотип и надпись
  const ls=[...logo.querySelectorAll('span')];
  A(logo.querySelector('i'),[{transform:'scale(0)',boxShadow:'0 0 0 #ffc400'},{transform:'scale(1.6)',offset:.5},{transform:'scale(1)'}],{duration:600,delay:100});
  ls.forEach((s,i)=>A(s,[{opacity:0,transform:'translateY(.6em)',letterSpacing:'.9em',filter:'blur(4px)'},{opacity:1,transform:'none',letterSpacing:'.5em',filter:'blur(0)'}],{duration:800,delay:200+i*110}));
  [...title.children].filter(n=>n.tagName==='SPAN').forEach((s,i)=>A(s,[{opacity:0,transform:'translateY(.35em) scale(.98)',filter:'blur(8px)'},{opacity:1,transform:'none',filter:'blur(0)'}],{duration:800,delay:450+i*150}));
  A(tag,[{opacity:0,letterSpacing:'.7em'},{opacity:1,letterSpacing:'.36em'}],{duration:900,delay:1150});
  await wait(3000);options.onComplete?.();

  }
  function stop(remove=true){
    if(!stopped){
      stopped=true;for(const reject of pending)reject(abort());pending.clear();
      for(const id of timers)clearTimeout(id);timers.clear();
      for(const id of frames)cancelAnimationFrame(id);frames.clear();
    }
    for(const a of animations){if(remove)a.cancel();else a.pause()}
    if(remove){animations.clear();for(const node of owned)node.remove();owned.length=0;}
  }
  return {start(){if(started||stopped)return;started=true;return play().catch(e=>{if(e.name!=='AbortError')options.onError?.(e)})},stop};
}
window.LifeGameSplashScene=Object.freeze({mount});
})();
