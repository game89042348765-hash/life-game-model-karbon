/* Permanent, world-specific traces of recovered work and completed stages. */
function repairedMaterial(id,inside,state){const on=state.repair,op=on?.85:.1,dash=on?'':'stroke-dasharray="3 4"',fill=on?'var(--accent)':'none';let s='';
 switch(id){
 case'beacon':s=G(inside?80:178,inside?354:319,C(0,0,10,fill,'stroke="var(--accent)"')+L('M0-22V0M-8-14H8','var(--accent)',2));break;
 case'prism':s=L(inside?'M0 250H76':'M14 277H97','var(--accent)',4,dash);break;
 case'dawn':s=on?L(inside?'M115 157Q135 142 155 157M205 143Q225 128 245 143':'M112 202Q132 187 152 202M218 183Q238 168 258 183','var(--accent)',1.4):L('M130 201Q147 174 168 195Q182 164 204 190Q235 181 240 204','var(--ink)',7);break;
 case'atlas':s=L(inside?'M82 420 190 300':'M298 233 178 298','var(--accent)',2.8,dash);break;
 case'portal':s=L(inside?'M95 330 180 300 263 330':'M86 355 180 322 274 355','var(--accent)',3,dash);break;
 case'garden':s=L(inside?'M180 345 142 385M180 355 219 390':'M180 418 145 446M180 418 218 446','var(--accent)',2.5,dash);break;
 case'islands':s=G(inside?70:80,inside?380:366,L('M-25 0H28M-20-8V14M0-8V14M21-8V14','var(--accent)',3,dash));break;
 case'loom':s=L('M52 244H307','var(--accent)',5,dash);break;
 case'city':s=L(inside?'M53 350V308H88':'M186 314V270L210 256','var(--accent)',6,dash);break;
 case'mountain':s=L(inside?'M70 335Q100 270 122 211T225 139':'M71 378 182 338','var(--accent)',2.5,dash);break;
 case'clockwork':s=G(inside?202:138,inside?259:284,R(-14,-5,28,10,fill,'stroke="var(--accent)"'));break;
 case'origami':s=L(inside?'M180 204 307 320':'M225 250 270 231','var(--accent)',3,dash);break;
 case'metro':s=C(inside?111:128,inside?293:253,18,'none',`stroke="var(--accent)" stroke-width="4" ${dash}`);break;
 case'orchestra':s=G(inside?180:180,inside?178:237,C(0,0,5,fill,'stroke="var(--accent)"')+L('M5 0V-27L18-22','var(--accent)',2,dash));break;
 case'mosaic':s=P(inside?'148,211 178,222 159,250':'141,205 171,215 157,239',fill,'stroke="var(--accent)"');break;
 case'pottery':s=L(inside?'M178 250 169 276 185 291 176 314':'M247 201 237 222 248 239','var(--accent)',2.5,dash);break;
 case'canal':s=L(inside?'M157 260V308':'M231 195V242','var(--accent)',6,dash);break;
 case'book':s=L(inside?'M49 318H284':'M197 278H302','var(--accent)',2,dash);break;
 case'kitchen':s=G(inside?180:259,inside?207:243,P('-9,0 -3,-12 8,-7 9,6 -2,9',fill,'stroke="var(--accent)"'));break;
 case'lab':s=L(inside?'M161 310 142 272':'M65 285 130 400','var(--accent)',4,dash);break;
 case'launch':s=L(inside?'M155 332 143 361':'M125 330H158','var(--accent)',5,dash);break;
 case'hex':s=L(inside?'M182 281V304':'M126 292H152','var(--accent)',6,dash);break;
 case'elevator':s=G(inside?68:177,inside?92:330,L('M-10 0H-1M1 0H10','var(--accent)',4)+C(0,0,3,fill,'stroke="var(--accent)"'));break;
 case'sand':s=L(inside?'M173 369 183 355 179 341':'M260 326 268 315 263 304','var(--accent)',4,dash);break;
 case'press':s=G(inside?194:108,inside?269:126,R(-13,-17,26,30,fill,'stroke="var(--accent)"')+T(0,5,'Ь',19,`text-anchor="middle" style="fill:${on?'var(--bg)':'var(--ink)'}"`));break;
 case'dance':s=G(inside?150:142,inside?144:220,`<ellipse rx="9" ry="18" fill="${fill}" stroke="var(--accent)" transform="rotate(-30)"/>`);break;
 case'cinema':s=G(inside?180:195,inside?309:235,R(-5,-24,10,48,fill,`stroke="var(--accent)" ${dash}`));break;
 case'domino':s=G(inside?180:167,inside?282:259,R(-9,-35,18,65,fill,'rx="4" stroke="var(--accent)"')+C(0,-17,2,'var(--bg)')+C(0,15,2,'var(--bg)'));break;
 case'maze':s=G(70,inside?100:100,C(0,0,10,'none',`stroke="var(--accent)" stroke-width="3"`)+L('M10 0H35M28 0V8M34 0V8','var(--accent)',3));break;
 case'sculpture':s=P(inside?'126,199 142,226 132,274 114,231':'106,170 127,195 112,237 97,208',fill,'stroke="var(--accent)"');break;
 }
 return `<g data-repaired-material opacity="${op}">${s}</g>`;
}
function completedMaterial(id,inside,state){if(!state.stages[state.stage].closed)return '';let s='';switch(id){
 case'beacon':s=P(inside?'180,215 360,90 360,340':'64,309 280,70 343,153','var(--accent)','opacity=".17"');break;
 case'prism':s=L(inside?'M180 250 347 101M180 250 347 250M180 250 347 399':'M250 256 344 137M250 256H345M250 256 344 380','var(--accent)',5,'opacity=".55"');break;
 case'dawn':s=C(180,inside?151:172,14,'var(--accent)')+L('M150 125Q180 103 210 125','var(--accent)',2);break;
 case'atlas':s=L(inside?'M60 155 278 141 190 300Z':'M53 130 224 86 298 233 178 298 54 375Z','var(--accent)',1.8);break;
 case'portal':s=P('121,163 139,181 139,289 121,297','var(--accent)','opacity=".65"')+P('239,163 221,181 221,289 239,297','var(--accent)','opacity=".65"');break;
 case'garden':s=[0,1,2].map(i=>C((inside?195:213)+i*11-11,(inside?140:118)+(i%2)*10,8,'var(--accent)')).join('');break;
 case'islands':s=G(inside?182:267,inside?94:222,L('M0 0V31','var(--ink)',2)+P('0,0 27,8 0,17','var(--accent)'));break;
 case'loom':s=Array.from({length:18},(_,i)=>L(`M${55+i*14} 406V${421+(i%3)*7}`,'var(--accent)',2)).join('');break;
 case'city':s=inside?L('M38 109H322V367H38Z','var(--accent)',6):P('170,192 210,154 250,192 210,212','var(--accent)');break;
 case'mountain':s=G(inside?174:225,inside?88:203,L('M0 0V36','var(--ink)',2)+P('0,0 28,7 0,16','var(--accent)'));break;
 case'clockwork':s=L(inside?'M142 213 265 294':'M83 328 197 238 279 100','var(--accent)',5,'opacity=".5"');break;
 case'origami':s=P(inside?'180,203 213,180 267,190 221,210 195,238':'249,250 274,222 313,238 279,255 257,279','var(--ink)','opacity=".7"');break;
 case'metro':s=G(inside?180:263,inside?245:180,R(-31,-12,62,24,'var(--accent)','rx="5"')+R(-22,-6,15,9,'var(--bg)')+R(5,-6,15,9,'var(--bg)'));break;
 case'orchestra':s=L(inside?'M110 398H250M246 389V407M254 389V407':'M319 214V250M325 214V250','var(--accent)',3);break;
 case'mosaic':s=L(inside?'M80 348 171 117 278 348Z':'M74 401 175 119 285 407Z','var(--bg)',5,'opacity=".65"');break;
 case'pottery':s=L(inside?'M116 264Q180 290 244 264M112 281Q180 306 248 281':'M211 242Q246 259 281 242','var(--bg)',4,'opacity=".65"');break;
 case'canal':s=G(inside?235:263,inside?157:187,P('-23,0 23,0 13,15 -13,15','var(--ink)')+R(-8,-13,20,13,'var(--bg)'));break;
 case'book':s=G(inside?299:310,inside?24:87,P('0,0 0,53 -11,43 -22,53 -22,0','var(--accent)'));break;
 case'kitchen':s=G(inside?180:259,inside?218:243,L('M0 22V-19','var(--ink)',2)+P('0,3 -20,-8 -20,-19 -3,-11','var(--accent)')+P('0,-3 17,-14 23,-6 7,3','var(--accent)'));break;
 case'lab':s=L(inside?'M180 312 209 328 209 360 180 376 151 360 151 328Z':'M66 132 189 216 291 120 292 343 130 400 65 285Z','var(--accent)',3);break;
 case'launch':s=L(inside?'M133 361H227M142 379H218':'M141 417H219M153 435H207','var(--accent)',5);break;
 case'hex':s=L(inside?'M80 109 180 51 281 109 330 223 281 337 180 395 79 337 30 223Z':'M15 256 48 189 166 121 282 189 322 322 206 390 88 390Z','var(--accent)',3);break;
 case'elevator':s=inside?P('61,87 93,107 93,344 61,365','var(--accent)','opacity=".4"'):L('M139 343V403M215 343V403','var(--bg)',9);break;
 case'sand':s=G(inside?180:265,inside?365:326,P('-45,0 -45,-37 -29,-37 -29,-22 -14,-22 -14,-49 3,-49 3,-22 20,-22 20,-37 37,-37 37,0','var(--accent)'));break;
 case'press':s=G(inside?257:265,inside?331:346,R(-56,-16,92,112,'var(--paper)','stroke="var(--ink)" stroke-opacity=".3"')+T(-47,27,'ПУТЬ',26,'font-weight="900"')+L('M-46 48H21M-46 61H9','var(--accent)',2));break;
 case'dance':s=L(inside?'M113 300Q250 340 221 231T150 144Q190 74 267 98':'M90 361Q260 398 203 318T142 220Q180 136 270 164T193 90','var(--accent)',2);break;
 case'cinema':s=G(inside?180:216,inside?150:240,P('-24,-23 -24,23 22,0','var(--accent)'));break;
 case'domino':s=L(inside?'M30 323H331':'M47 408Q224 385 196 274T279 125','var(--accent)',2);break;
 case'maze':s=L('M312 59V99M312 99H337','var(--accent)',6);break;
 case'sculpture':s=L('M155 220 168 214M196 214 210 220M180 229 176 256 187 256M168 278Q181 286 194 278','var(--ink)',2,'opacity=".5"');break;
 }return `<g data-completed-material>${s}</g>`;}
