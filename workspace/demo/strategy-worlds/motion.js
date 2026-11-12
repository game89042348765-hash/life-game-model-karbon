/* Finite semantic choreography. Only the selected world owns animations. */
const NS='http://www.w3.org/2000/svg';let fxTimers=new Set(),fxAnimations=new Set(),fxLayer=null,fxEpoch=0;
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function later(fn,ms){const e=fxEpoch,id=setTimeout(()=>{fxTimers.delete(id);if(e===fxEpoch)fn()},ms);fxTimers.add(id);return id}
function clearMotion(){fxEpoch++;fxTimers.forEach(clearTimeout);fxTimers.clear();fxAnimations.forEach(a=>a.cancel());fxAnimations.clear();fxLayer?.remove();fxLayer=null;document.querySelector('.scene')?.getAnimations().forEach(a=>a.cancel())}
function el(tag,attrs={},parent=fxLayer){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));parent.append(n);return n}
function animateFX(n,frames,options={}){const a=n.animate(frames,{duration:1400,fill:'both',easing:'cubic-bezier(.22,.75,.25,1)',...options});fxAnimations.add(a);a.finished.then(()=>fxAnimations.delete(a),()=>fxAnimations.delete(a));return a}
function trace(d,color='var(--accent)',w=2,delay=0,duration=1700){const p=el('path',{d,fill:'none',stroke:color,'stroke-width':w,'stroke-linecap':'round','stroke-linejoin':'round'}),len=p.getTotalLength();animateFX(p,[{strokeDasharray:len,strokeDashoffset:len,opacity:0},{strokeDasharray:len,strokeDashoffset:len*.8,opacity:1,offset:.15},{strokeDasharray:len,strokeDashoffset:0,opacity:1,offset:.8},{strokeDasharray:len,strokeDashoffset:0,opacity:0}],{duration,delay});return p}
function moving(x,y,body,dx,dy,delay=0,kind='arc',duration=1550){const wrap=el('g',{transform:`translate(${x} ${y})`}),n=el('g',{},wrap);n.innerHTML=body;const frames=kind==='fall'?[{opacity:0,transform:'translate(0,-80px) rotate(-25deg)'},{opacity:1,transform:`translate(${dx}px,${dy}px) rotate(0deg)`,offset:.7},{opacity:0,transform:`translate(${dx}px,${dy}px) scale(.6)`}]:kind==='fold'?[{opacity:0,transform:'perspective(300px) rotateY(-90deg) scale(.6)'},{opacity:1,transform:`translate(${dx*.3}px,${dy*.3}px) rotateY(0deg) scale(1.1)`,offset:.4},{opacity:0,transform:`translate(${dx}px,${dy}px) scale(.7)`}]:[{opacity:0,transform:'translate(0,0) scale(.4)'},{opacity:1,transform:`translate(${dx*.25+25}px,${dy*.25-32}px) scale(1.2) rotate(-12deg)`,offset:.3},{opacity:1,transform:`translate(${dx*.8}px,${dy*.8}px) scale(1) rotate(8deg)`,offset:.8},{opacity:0,transform:`translate(${dx}px,${dy}px) scale(.5)`}];animateFX(n,frames,{delay,duration});return n}
function effectBody(html,x,y,frames,opts={}){const wrap=el('g',{transform:`translate(${x} ${y})`}),n=el('g',{},wrap);n.innerHTML=html;animateFX(n,frames,opts);return n}
function expansion(html,x,y,delay=0,duration=2000){return effectBody(html,x,y,[{opacity:0,transform:'scale(.08)'},{opacity:.95,transform:'scale(1)',offset:.45},{opacity:.9,transform:'scale(1)',offset:.75},{opacity:0,transform:'scale(1.06)'}],{delay,duration})}
function readPort(name){const n=document.querySelector(`[data-port="${name}"]`);return n?[+n.getAttribute('cx'),+n.getAttribute('cy')]:[180,250]}
function motion(id,type,taskId){
 const scene=document.querySelector('.scene'),task=document.querySelector(`[data-task="${taskId}"]`);let[fromX,fromY]=task?[+task.dataset.x,+task.dataset.y]:readPort('target'),[tx,ty]=readPort('target');
 fxLayer=el('svg',{class:'fx-scene',viewBox:'0 0 360 520','aria-hidden':'true'},document.querySelector('.world-canvas'));
 const stage=type==='stage',repair=type==='repair'||(type==='undo'&&taskId==='missed-1'),undo=type==='undo';
 const dx=tx-fromX,dy=ty-fromY,A='var(--accent)',I='var(--ink)',B='var(--bg)',curve=`M${fromX} ${fromY}Q${fromX+65} ${Math.min(fromY,ty)-50} ${tx} ${ty}`;
 switch(id){
 case'beacon':{
  const lens=C(0,0,17,'none',`stroke="${A}" stroke-width="3"`)+L('M-12 0H12M0-12V12',A);
  if(repair)moving(fromX,fromY,L('M0-20V10M-9-10H9',A,3)+C(0,6,8,A),dx,dy,0,'fall');else moving(fromX,fromY,lens,dx,dy);
  for(let i=0;i<(stage?7:3);i++)trace(`M${tx} ${ty}L${320-i*13} ${40+i*49}`,A,stage?5:2,i*90,stage?2500:1600);break;}
 case'prism':{
  const colors=['#c8a0ef','#9cddd1','#e6a4b8'];for(let i=0;i<3;i++){trace(`M${fromX} ${fromY}L180 250L${stage?345:tx} ${stage?85+i*170:ty+(i-1)*20}`,colors[i],stage?4:2,i*100,2100);moving(fromX,fromY,P('0,-15 11,9 -11,9',colors[i]),dx+(i-1)*16,dy,i*110,'fold')}
  if(repair)trace('M0 250H180',A,6,0,1700);break;}
 case'dawn':{
  const r=stage?62:24;effectBody(C(0,0,r,A),180,310,[{opacity:0,transform:'translateY(100px)'},{opacity:.9,transform:`translateY(${stage?-180:-100}px)`,offset:.7},{opacity:0,transform:`translateY(${stage?-210:-120}px)`}],{duration:stage?2800:1900});
  if(repair)effectBody(L('M-57 0Q-38-30-17-8Q0-44 22-8Q48-22 60 2',I,12),180,190,[{opacity:.6,transform:'translateX(0)'},{opacity:0,transform:'translateX(140px)'}],{duration:1700});else for(let i=0;i<4;i++)trace(`M${20-i*5} 290Q180 ${140-i*24} ${340+i*5} 290`,A,1.5,i*160);break;}
 case'atlas':{
  const pts=stage?[[48,130],[226,83],[297,231],[178,298],[54,375]]:[[fromX,fromY],[(fromX+tx)/2-20,(fromY+ty)/2-30],[tx,ty]];for(let i=0;i<pts.length;i++){let[x,y]=pts[i];expansion(P('0,-12 3,-3 12,0 3,3 0,12 -3,3 -12,0 -3,-3',A),x,y,i*180,1800);if(i)trace(`M${pts[i-1]}L${x} ${y}`,A,repair?3:1.5,i*180)}break;}
 case'portal':{
  for(let i=0;i<(stage?6:3);i++){const w=280-i*34,h=355-i*34;effectBody(R(-w/2,-h/2,w,h,'none',`stroke="${A}" stroke-width="2" rx="3"`),180,235,[{opacity:0,transform:'scale(.8)'},{opacity:.7,transform:'scale(1)',offset:.4},{opacity:0,transform:stage?'scale(1.7)':'scale(1.1)'}],{delay:i*120,duration:stage?2500:1600})}if(repair)trace('M70 345 180 310 290 345',A,4);break;}
 case'garden':{
  if(repair)trace(`M${tx} 345Q130 359 114 399M${tx} 345Q226 359 245 399`,A,3);else moving(fromX,fromY,`<ellipse rx="6" ry="10" fill="${A}"/>`,dx,dy,0,'fall');
  trace(`M${tx} ${ty+100}Q${tx-28} ${ty+15} ${tx+8} ${ty-70}`,A,3,180,1900);for(let i=0;i<(stage?9:4);i++)expansion(`<path d="M0 0Q-23-25-37-4Q-20 14 0 0Z" fill="${A}" transform="rotate(${i%2?180:0})"/>`,tx+(i%2?5:-5),ty+60-i*15,i*100,1900);if(stage)for(let i=0;i<5;i++)expansion(C(0,0,9,A),tx+Math.cos(i*1.3)*25,ty-55+Math.sin(i*1.3)*15,900+i*70);break;}
 case'islands':{
  const sail=P('0,-30 0,2 24,2',B,`stroke="${I}"`)+P('-17,6 20,6 11,19 -10,19',A)+L('M0-34V10',I,1.5);
  if(repair)for(let i=0;i<5;i++)moving(fromX,fromY,R(-5,-18,10,36,A),dx-28+i*13,dy,70*i,'fall');else moving(stage?70:fromX,stage?360:fromY,sail,stage?195:dx,stage?-112:dy,0,'arc',stage?2700:1800);
  trace(stage?'M70 360Q203 370 267 248':curve,A,1.3,0,2300);break;}
 case'loom':{
  if(repair){trace('M52 244L74 238 96 250 118 238 140 250 162 238 184 250 206 238 228 250 250 238 276 249 308 244',A,2.5,0,2100)}else for(let i=0;i<(stage?12:5);i++){let y=142+i*17;trace(i%2?`M311 ${y}H49`:`M49 ${y}H311`,A,7,i*80,1750);moving(i%2?310:50,y,P('-17,-5 17,0 -17,5',I),i%2?-260:260,0,i*80,'arc',1600)}break;}
 case'city':{
  const module=P('-19,0 0,-11 19,0 0,11',A)+P('-19,0 -19,23 0,34 0,11',I,'opacity=".7"')+P('0,11 19,0 19,23 0,34',A,'opacity=".7"');
  for(let i=0;i<(stage?9:3);i++)moving(fromX+(i%3-1)*38,fromY-100,module,dx,dy+45-Math.floor(i/3)*36,i*100,'fall',1800);if(repair)trace(`M${tx-25} ${ty+90}V${ty+25}`,A,9);break;}
 case'mountain':{
  if(repair)trace('M70 335Q110 255 176 180T237 114',A,3,0,2100);else {for(let i=0;i<(stage?7:3);i++){let x=78+i*27,y=362-i*34;expansion(P('-10,7 -5,-8 12,-2 5,10',A),x,y,i*160);if(i)trace(`M${x-27} ${y+34}L${x} ${y}`,A,1.4,i*160)}}
  if(stage)expansion(L('M0 30V-20',I,2)+P('0,-20 30,-12 0,-4',A),237,114,1100,2200);break;}
 case'clockwork':{
  const count=stage?3:2;for(let i=0;i<count;i++){const x=95+i*89,y=275-i*45;effectBody(gear(0,0,42,12,1),x,y,[{opacity:0,transform:'scale(.3) rotate(0deg)'},{opacity:.9,transform:`scale(1) rotate(${i%2?-120:120}deg)`,offset:.7},{opacity:0,transform:`scale(1) rotate(${i%2?-180:180}deg)`}],{delay:i*160,duration:2300})}if(repair)moving(fromX,fromY,R(-15,-5,30,10,A),dx,dy,0,'fall');break;}
 case'origami':{
  const halves=[P('0,-90 -110,70 0,25',A),P('0,-90 110,70 0,25',I,'opacity=".45"')];halves.forEach((b,i)=>effectBody(b,180,235,[{opacity:0,transform:`perspective(400px) rotateY(${i?80:-80}deg)`},{opacity:.9,transform:`perspective(400px) rotateY(${i?-20:20}deg)`,offset:.55},{opacity:0,transform:`translateY(${stage?-90:0}px) rotateY(0deg)`}],{delay:i*180,duration:stage?2700:1900}));if(repair)trace('M115 305 180 235 278 301',I,2);break;}
 case'metro':{
  if(repair)trace('M105 253A23 23 0 1 1 151 253A23 23 0 1 1 105 253',A,5,0,1700);else{const train=R(-41,-13,82,26,A,'rx="5"')+R(-30,-7,17,10,B)+R(-6,-7,17,10,B)+R(18,-7,15,10,B);moving(stage?31:fromX,stage?394:fromY,train,stage?232:dx,stage?-214:dy,0,'arc',stage?2700:1700);trace(stage?'M31 394H100Q128 394 128 366V214Q128 180 163 180H263':curve,A,7,0,2200)}break;}
 case'orchestra':{
  if(repair)trace(`M${tx-18} ${ty}h10v-13h10v13h10`,A,3);else for(let i=0;i<(stage?10:4);i++){const note=`<ellipse rx="7" ry="4" fill="${A}" transform="rotate(-20)"/>`+L('M7 0V-31L20-24',A,1.5);moving(fromX,fromY,note,dx+(i%5-2)*25,dy+Math.floor(i/5)*35,i*100,'arc',1900)}
  if(stage)for(let i=0;i<5;i++)trace(`M25 ${180+i*9}H335`,A,.8,i*50,2200);break;}
 case'mosaic':{
  for(let i=0;i<(stage?10:repair?1:3);i++){const p=P('-22,-18 24,-11 13,23 -19,19',i%2?I:A);moving(fromX+(i%3-1)*25,fromY,p,dx+(i%3-1)*38,dy+Math.floor(i/3)*32,i*100,'fold',1900)}if(stage)trace('M70 400 175 120 286 407Z',B,5,800,2000);break;}
 case'pottery':{
  const vessel=`<path d="M-42-75Q-38-27-61 11Q-70 83 0 83Q70 83 61 11Q38-27 42-75Z" fill="${A}" opacity=".6"/>`+`<ellipse cy="-75" rx="42" ry="9" fill="none" stroke="${I}"/>`;
  effectBody(vessel,180,232,[{opacity:0,transform:'scale(1,.15)'},{opacity:.85,transform:'scale(1,1)',offset:.6},{opacity:0,transform:stage?'rotateY(180deg)':'scale(.95,1)'}],{duration:stage?2800:2000});if(repair)trace('M179 196 169 228 184 249 177 277',B,5,300,1700);else for(let i=0;i<3;i++)trace(`M123 ${220+i*23}Q180 ${245+i*23} 237 ${220+i*23}`,B,2,i*90);break;}
 case'canal':{
  const water=el('rect',{x:38,y:350,width:284,height:30,fill:A,opacity:.35});animateFX(water,[{height:0,y:380,opacity:0},{height:stage?220:130,y:stage?160:250,opacity:.5,offset:.75},{height:stage?220:130,y:stage?160:250,opacity:0}],{duration:2400});
  if(repair)moving(fromX,fromY,R(-5,-26,10,52,A),dx,dy,0,'fall');if(stage)moving(81,280,P('-27,0 27,0 17,18 -17,18',I)+R(-9,-14,23,14,B),168,-137,850,'arc',2100);break;}
 case'book':{
  if(repair)trace('M49 318H284',A,2,0,1800);else for(let i=0;i<(stage?13:6);i++)trace(`M49 ${177+i*15}H${i%4===3?240:306}`,I,1.4,i*70,1700);
  if(stage)effectBody(R(-130,-170,260,340,B,`stroke="${I}" stroke-opacity=".2"`)+L('M-104-105H96M-104-87H96M-104-69H48',I),180,244,[{opacity:0,transform:'perspective(500px) rotateY(0deg)'},{opacity:.95,transform:'perspective(500px) rotateY(-35deg)',offset:.3},{opacity:0,transform:'perspective(500px) rotateY(-150deg)'}],{delay:800,duration:2300});break;}
 case'kitchen':{
  for(let i=0;i<(stage?9:repair?1:4);i++)moving(fromX,fromY,i%2?P('-7,0 0,-11 9,-1 4,8',A):C(0,0,7,A),dx+(i%3-1)*13,dy+(i%3-1)*10,i*100,'fall',1800);
  if(stage){expansion(C(0,0,67,'none',`stroke="${I}" stroke-width="2"`),tx,ty,500);for(let i=0;i<3;i++)trace(`M${tx-20+i*20} ${ty-44}Q${tx-36+i*20} ${ty-80} ${tx-15+i*20} ${ty-117}`,I,1,800+i*100,1600)}break;}
 case'lab':{
  const points=stage?[[124,220],[180,188],[236,220],[236,284],[180,316],[124,284]]:[[fromX,fromY],[tx-24,ty],[tx+24,ty]];points.forEach(([x,y],i)=>{expansion(C(0,0,15,i%2?I:A),x,y,i*140,2100);if(i)trace(`M${points[i-1]}L${x} ${y}`,A,3,i*140,2100)});if(stage)trace('M124 284V220',A,3,700);if(repair)trace(`M${tx-38} ${ty+20}L${tx+35} ${ty-20}`,A,4);break;}
 case'launch':{
  const rocket=P('0,-60 -16,-32 -16,40 16,40 16,-32',A)+C(0,-15,7,B)+P('-16,13 -29,44 -16,38',I)+P('16,13 29,44 16,38',I);
  if(stage){effectBody(rocket,180,339,[{opacity:0,transform:'translateY(0)'},{opacity:1,transform:'translateY(-30px)',offset:.25},{opacity:1,transform:'translateY(-190px)',offset:.8},{opacity:0,transform:'translateY(-370px) scale(.65)'}],{duration:3000});trace('M180 414V74',I,1,0,2800)}else moving(fromX,fromY,repair?R(-4,-25,8,50,A):R(-16,-22,32,44,A),dx,dy,0,'fall',1900);break;}
 case'hex':{
  const cells=stage?[[180,220],[180,125],[262,172],[262,268],[180,316],[98,268],[98,172]]:[[tx,ty],[tx+55,ty-32]];cells.forEach(([x,y],i)=>{let pts='';for(let j=0;j<6;j++){let a=j*Math.PI/3+Math.PI/6;pts+=`${Math.cos(a)*37},${Math.sin(a)*37} `}expansion(P(pts,A,'opacity=".65"'),x,y,i*140,2100)});if(repair)trace(`M${tx-45} ${ty}H${tx+45}`,I,5);break;}
 case'elevator':{
  if(stage)effectBody(R(-49,-45,98,90,A,'opacity=".7"')+L('M0-45V45',B,1.5),180,350,[{opacity:0,transform:'translateY(0)'},{opacity:.9,transform:'translateY(-40px)',offset:.25},{opacity:.9,transform:'translateY(-160px)',offset:.8},{opacity:0,transform:'translateY(-180px)'}],{duration:2800});else moving(fromX,fromY,repair?L('M-15 0H15M0-9V9',A,4):gear(0,0,24,10,1),dx,dy,0,'fall',1800);trace('M180 75V391',A,2,200,2200);break;}
 case'sand':{
  if(repair)trace(`M${tx-19} ${ty+40}L${tx+19} ${ty+40}`,A,7);else for(let i=0;i<(stage?40:18);i++){const x=180+((i*13)%29)-14;moving(x,155,C(0,0,1.6+(i%3)*.5,A),((i*17)%100)-50,190+(i%5)*9,i*25,'fall',1650)}if(stage)expansion(P('-53,30 -53,-28 -35,-28 -35,-10 -15,-10 -15,-46 5,-46 5,-10 27,-10 27,-28 45,-28 45,30',A),180,350,1100,2000);break;}
 case'press':{
  if(!stage)moving(fromX,fromY,R(-19,-24,38,48,A)+T(0,8,repair?'Ь':'Д',27,`text-anchor="middle" style="fill:${B}"`),dx,dy,0,'fall',1800);
  else{effectBody(R(-95,-22,190,44,I),180,140,[{opacity:0,transform:'translateY(0)'},{opacity:.9,transform:'translateY(110px)',offset:.5},{opacity:.9,transform:'translateY(110px)',offset:.65},{opacity:0,transform:'translateY(0)'}],{duration:2500});effectBody(R(-99,-125,198,250,B,`stroke="${I}"`)+T(0,0,'СВОЙ',44,`text-anchor="middle" font-weight="900" style="fill:${A}"`)+T(0,51,'ПУТЬ',44,`text-anchor="middle" font-weight="900" style="fill:${A}"`),180,276,[{opacity:0,transform:'translateY(0)'},{opacity:0,transform:'translateY(0)',offset:.3},{opacity:1,transform:'translateY(0)',offset:.6},{opacity:0,transform:'translateY(130px) rotate(-12deg)'}],{duration:3000})}break;}
 case'dance':{
  const pts=stage?[[90,361],[203,318],[142,220],[270,164]]:[[fromX,fromY],[tx,ty]];pts.forEach(([x,y],i)=>{effectBody(`<ellipse cy="-7" rx="10" ry="19" fill="${A}"/><ellipse cy="19" rx="8" ry="7" fill="${A}"/>`,x,y,[{opacity:0,transform:'translateY(-30px) rotate(-20deg)'},{opacity:.85,transform:'translateY(0) rotate(15deg)',offset:.4},{opacity:.8,transform:'translateY(0) rotate(15deg)',offset:.7},{opacity:0,transform:'translateY(-4px) rotate(15deg)'}],{delay:i*250,duration:1700});if(i)trace(`M${pts[i-1]}Q${x+45} ${y+35} ${x} ${y}`,A,2,i*250)});break;}
 case'cinema':{
  if(stage){for(let i=0;i<4;i++)effectBody(R(-60,-35,120,70,A)+P('-26,25 4,-21 39,25',B,'opacity=".5"')+Array.from({length:6},(_,j)=>R(-52+j*19,-31,8,5,B)+R(-52+j*19,26,8,5,B)).join(''),-80,240,[{opacity:0,transform:'translateX(0)'},{opacity:1,transform:'translateX(260px)',offset:.45},{opacity:0,transform:'translateX(520px)'}],{delay:i*250,duration:2400})}else moving(fromX,fromY,repair?R(-5,-27,10,54,A):R(-35,-24,70,48,A)+P('-16,17 0,-14 20,17',B),dx,dy,0,'fold',1900);break;}
 case'domino':{
  for(let i=0;i<(stage?8:repair?1:3);i++){const x=stage?38+i*39:tx+(i-1)*26,y=stage?280:ty;effectBody(R(-8,-45,16,67,A,'rx="3"')+C(0,-25,2,B)+C(0,5,2,B),x,y,[{opacity:0,transform:'rotate(0deg)'},{opacity:1,transform:'rotate(0deg)',offset:.2},{opacity:1,transform:`rotate(${stage?76:0}deg)`,offset:.7},{opacity:0,transform:`rotate(${stage?80:0}deg)`}],{delay:i*140,duration:stage?2000:1500})}break;}
 case'maze':{
  if(repair)moving(fromX,fromY,C(-8,0,10,'none',`stroke="${A}" stroke-width="3"`)+L('M2 0H30M22 0V8',A,3),dx,dy,0,'arc');else{effectBody(R(-5,-32,10,64,A),stage?310:188,stage?99:187,[{opacity:0,transform:'rotateY(0deg)'},{opacity:.95,transform:'perspective(250px) rotateY(-15deg)',offset:.3},{opacity:.7,transform:'perspective(250px) rotateY(-85deg)',offset:.8},{opacity:0,transform:'perspective(250px) rotateY(-100deg)'}],{duration:2100});trace(stage?'M66 387V280H152V174H225V98H310':curve,A,4,300,2400)}break;}
 case'sculpture':{
  const pieces=['-30,-25 7,-18 -8,38','-19,-17 29,-31 9,25','-9,-27 25,7 -24,29'];for(let i=0;i<(stage?9:3);i++){const x=110+i%3*67,y=150+Math.floor(i/3)*60;moving(x,y,P(pieces[i%3],A),repair?180-x:(i%2?80:-80),repair?245-y:220+i%3*18,i*85,repair?'fold':'fall',2000)}if(stage)trace('M155 220 168 214M196 214 210 220M180 229 176 256 187 256M168 278Q181 286 194 278',I,2,900,1800);break;}
 }
 // Undo reverses the physical contribution instead of celebrating it again.
 if(undo)for(const a of fxAnimations)a.reverse();
 // Geometry changes in the model remain after the finite material animation leaves.
 return stage?3200:2200;
}
