#!/usr/bin/env python3
"""Isolated Chromium checks: localhost only, fictional data, no real browser profile.
Run a server at the repo root, then: python personal/tests/browser.py [base URL].
The diagnostic API is injected into a network response only; absent from shipped code.
"""
import json,sys
from pathlib import Path
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8041'
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'verification';OUT.mkdir(exist_ok=True)
HOOK=r'''
const originalAsk=ask;
window.__LG={state:()=>S,clone:cloneState,coll:COLL,key:()=>KEYS[META.space],today,addDays,coins,xp:xpTotal,plan:()=>dayPlan(today()),currentLoc,scheduledLoc,ruleActive,nextBoundary,locById,newLocation,locTick,validate:LifeGamePersistence.validate,
cal:Cal,calDone,habitTarget,habitDayTarget,habitDayProgress,ritualMessage,dayStats,ritualTexts:RITUAL,reminderCandidates,io:IO,quickAdd,
newItem:(k,p)=>({task:newTask,habit:newHabit,quest:newQuest,cal:newCal,offer:newOffer,decision:newDecision}[k])(p),
stage:(bid,name)=>{const x={id:uid(),blockId:bid,name,content:'',meaning:'',reason:'',bonus:[],status:'open',order:S.stages.length+1,created:today()};S.stages.push(x);return x},
run:fn=>runGuarded(()=>tx(fn)),complete,undo:undoFact,assign:setBonusAssign,ledger,
autoAsk:on=>{ask=on?async()=>typeof on==='string'?on:true:originalAsk},
reset:()=>runGuarded(()=>{ask=originalAsk;closeAllSheets();replaceSpace(makeBlank());goTab('home');return true}),
replace:s=>runGuarded(()=>replaceSpace(s)),edit:(k,it,p)=>editItem(k,it,p),
submit:()=>{const f=document.querySelector('#layer .overlay:last-child form');return runGuarded(()=>FORMS[f.dataset.form](f),f)},
act:(act,data={})=>{const el=document.createElement('button');Object.assign(el.dataset,data);return runGuarded(()=>ACT[act](el),el)},
go:(s,p={})=>{closeAllSheets();go(s,p)},exportFile,
};
'''
results=[]
def record(name,fn):
 try: fn();results.append({'name':name,'pass':True});print('PASS',name,flush=True)
 except Exception as e:results.append({'name':name,'pass':False,'error':str(e)});print('FAIL',name,str(e)[:600],flush=True)
def action(p,name,extra=''):
 p.locator('[data-act="'+name+'"]'+extra).filter(visible=True).first.click();p.wait_for_timeout(60)
def boot(p):
 p.goto(BASE+'/personal/',wait_until='networkidle')
 if p.locator('[data-act=welcome][data-v=my]').count():
  action(p,'welcome','[data-v=my]');action(p,'sheet-close')
 p.wait_for_function('!!window.__LG')
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844},locale='ru-RU',timezone_id='Europe/Moscow',service_workers='block');errors=[]
 source=(ROOT/'app.js').read_text();source=source.rsplit('})();',1)[0]+HOOK+'})();'
 def route(r):
  if not r.request.url.startswith(BASE+'/'):return r.abort()
  if r.request.url.split('?')[0].endswith('/personal/app.js'):return r.fulfill(status=200,content_type='text/javascript',body=source)
  r.continue_()
 c.route('**/*',route);c.on('page',lambda p:p.on('pageerror',lambda e:errors.append(str(e))))
 p=c.new_page();p.clock.install(time=datetime(2026,11,11,9,tzinfo=timezone.utc));p.set_default_timeout(6000);boot(p)
 p.add_script_tag(content=(ROOT/'tests/model-cases.js').read_text());model=p.evaluate('runModelCases()');results.extend(model)
 for r in model:print('PASS' if r['pass'] else 'FAIL',r['name'],r.get('error','')[:600],flush=True)
 p.add_script_tag(content=(ROOT/'tests/location-cases.js').read_text());location_cases=p.evaluate('runLocationCases()');results.extend(location_cases)
 for r in location_cases:print('PASS' if r['pass'] else 'FAIL',r['name'],r.get('error','')[:600],flush=True)
 p.add_script_tag(content=(ROOT/'tests/upgrade-cases.js').read_text());upgrades=p.evaluate('runUpgradeCases()');results.extend(upgrades)
 for r in upgrades:print('PASS' if r['pass'] else 'FAIL',r['name'],r.get('error','')[:900],flush=True)
 def reset():p.evaluate('window.__LG.reset()')
 def submit(form='item'):
  p.locator('form[data-form="'+form+'"] button:not([type=button])').last.click();p.wait_for_timeout(90)
 def state():return p.evaluate('window.__LG.state()')
 def confirm():p.locator('[data-ask=yes]').click();p.wait_for_timeout(90)
 def ui_strategy():
  reset();action(p,'tab','[data-v=map]');action(p,'block-new');p.locator('[name=name]').fill('Гитара — личная проверка');submit('block')
  block=state()['blocks'][-1];assert not block['secs']['unk'] and not block['secs']['lvmg']
  action(p,'stage-new');p.locator('[name=name]').fill('Первые аккорды');p.locator('[name=meaning]').fill('Играть для себя');submit('stage');sid=state()['stages'][-1]['id']
  action(p,'bview','[data-v=current]');action(p,'goal-new');p.locator('[name=title]').fill('Переключать Am и Em');p.locator('[name=ifThen]').fill('Если устал — две минуты после ужина');submit('goal')
  action(p,'new','[data-goal]');p.locator('[name=title]').fill('Пять переходов Am → Em');p.locator('[name=goalId]').select_option(state()['goals'][0]['id']);p.locator('[name=key]').check();p.locator('[name=reward]').fill('25');submit()
  task=state()['tasks'][0];assert task['stageId']==sid and task['key'] and task['inDay'] and task['goalId']
  action(p,'tab','[data-v=day]');action(p,'toggle','[data-r="task:'+task['id']+'"]');assert state()['ledger'][-1]['coins']==25
  p.screenshot(path=str(OUT/'guitar-day.png'));p.reload(wait_until='networkidle');assert state()['facts'][0]['ref']==task['id']
 record('UI: create strategy → stage → goal → key task → day → reload',ui_strategy)
 def nested_bonus():
  reset();p.evaluate("__LG.edit('task',null,{title:'Черновик с бонусом'})");action(p,'bonus-pick');p.locator('#layer details').last.locator('summary').click();p.locator('#bp-title').fill('Выходной');p.locator('#bp-price').fill('30');action(p,'bp-create');action(p,'bp-done');assert p.locator('[name=title]').input_value()=='Черновик с бонусом';submit();assert len(state()['tasks'])==1 and state()['insts'][0]['status']=='reserved'
 record('UI: bonus catalog creation preserves parent task draft',nested_bonus)
 def week():
  reset();p.clock.set_system_time(datetime(2026,11,11,9,tzinfo=timezone.utc))
  ids=p.evaluate('''async()=>{const L=__LG;await L.reset();const ids={};await L.run(()=>{for(const [key,k,data]of [
   ['daily','task',{title:'Ежедневный шаг',sched:{type:'daily',days:[]}}],
   ['habit','habit',{title:'Практика',goal:{mode:'total',period:'month',target:3,reward:50,bonus:[]}}],
   ['weekly','task',{title:'Недельный обзор',reward:20,sched:{type:'weekly',days:[3]}}],
   ['quest','quest',{title:'Три песни',target:3,stepReward:2,finalReward:30,inDay:true,sched:{type:'daily',days:[]}}],
   ['once','task',{title:'Заказать струны',reward:11}],
   ['cal','cal',{title:'Урок на дату',date:'2026-11-12',reminder:false}]
  ]){const x=L.newItem(k,data);L.state()[L.coll[k]].push(x);ids[key]=x.id}});return ids}''')
  for day in range(7):
   if day:p.clock.set_system_time(datetime(2026,11,11+day,9,tzinfo=timezone.utc));p.reload(wait_until='networkidle')
   action(p,'tab','[data-v=day]')
   if day==2:action(p,'tempo','[data-v=rest]')
   if day==3:p.evaluate("__LG.act('creative-open')");submit('creative')
   if day==4:action(p,'creative-off');confirm();p.evaluate("__LG.act('day-remove',{r:'task:'+__LG.state().tasks.find(x=>x.title==='Ежедневный шаг').id})")
   selected=[]
   if day in [0,1,6]:selected.append(('task','daily'))
   if day!=3:selected.append(('habit','habit'))
   if day==0:selected.append(('task','weekly'))
   if day in [0,1,4]:selected.append(('quest','quest'))
   if day==6:selected.append(('task','once'))
   for kind,key in selected:action(p,'toggle','[data-r="'+kind+':'+ids[key]+'"]')
   s=state();assert s['lastProcessed']==f'2026-11-{11+day:02}'
  s=state();balance=sum(l['coins'] for l in s['ledger']);assert balance==177,(balance,s['ledger']);assert len(s['misses'])==2,s['misses'];assert {(m['kind'],m['date']) for m in s['misses']}=={('cal','2026-11-12'),('task','2026-11-16')}
  # All three review levels use real page forms.
  for level in ['daily','weekly','monthly']:
   p.evaluate('(l)=>__LG.go("session",{level:l})',level);p.locator('[name=q0]').fill('Продолжить короткие подходы');p.locator('form[data-form=session] button:not([type=button])').click();p.wait_for_timeout(100)
  assert len(state()['sessions'])==3
  p.reload(wait_until='networkidle');assert sum(l['coins'] for l in state()['ledger'])==177
  (OUT/'week-summary.json').write_text(json.dumps({'dates':'2026-11-11…17','balance':177,'misses':[(m['kind'],m['date']) for m in s['misses']],'facts':len(s['facts'])},ensure_ascii=False,indent=2))
 record('Seven actual dates: schedules, rest, pause, remove, rollover and reviews',week)
 def two_tabs():
  reset();q=c.new_page();q.clock.install(time=datetime(2026,11,17,9,tzinfo=timezone.utc));boot(q)
  p.evaluate("__LG.edit('task',null,{title:'Черновик первой вкладки'})")
  q.evaluate("__LG.edit('task',null,{title:'Из второй вкладки'})");q.locator('form[data-form=item] button:not([type=button])').click();q.wait_for_timeout(150);p.wait_for_timeout(150)
  assert p.locator('[name=title]').input_value()=='Черновик первой вкладки';submit();assert p.locator('.storage-alert').count();assert p.locator('[name=title]').input_value()=='Черновик первой вкладки'
  assert len(json.loads(p.evaluate("localStorage.getItem('lifegame-personal-my-v1')"))['tasks'])==1
  p.locator('[data-act=load-fresh]').click();confirm();assert state()['tasks'][0]['title']=='Из второй вкладки';assert p.locator('#layer form').count()==0
  # Simultaneous completion can commit once even if both pages had the old state.
  tid=state()['tasks'][0]['id'];p.evaluate('(id)=>{window.firstWrite=__LG.run(()=>__LG.complete("task",id))}',tid);q.evaluate('(id)=>{window.secondWrite=__LG.run(()=>__LG.complete("task",id))}',tid);p.evaluate('window.firstWrite');q.evaluate('window.secondWrite');q.close();p.wait_for_timeout(100)
  stored=json.loads(p.evaluate("localStorage.getItem('lifegame-personal-my-v1')"));assert len(stored['facts'])==1 and sum(l['coins'] for l in stored['ledger'])==10
 record('Two tabs: stale draft retained/refused and no duplicate payout',two_tabs)
 def backup_roundtrip():
  p.evaluate('__LG.go("settings")')
  with p.expect_download() as dl:action(p,'export')
  target=OUT/'fictional-export.json';dl.value.save_as(target);exported=json.loads(target.read_text());assert exported['data']['tasks']
  reset();p.evaluate('__LG.go("settings")');action(p,'import');p.locator('#imp-file').set_input_files(target);p.wait_for_timeout(100);action(p,'import-do');confirm();assert state()['tasks'][0]['title']==exported['data']['tasks'][0]['title']
 record('UI: real JSON download and file import roundtrip',backup_roundtrip)
 def corrupt():
  t=c.new_page();t.clock.install(time=datetime(2026,11,17,9,tzinfo=timezone.utc));t.goto(BASE+'/personal/',wait_until='networkidle');t.evaluate("localStorage.setItem('lifegame-personal-my-v1','{broken-original')");t.reload(wait_until='networkidle');assert t.locator('.storage-alert').count();assert t.evaluate("localStorage.getItem('lifegame-personal-my-v1')")=='{broken-original'
  with t.expect_download() as dl:action(t,'recovery-export')
  raw=OUT/'broken-raw.json';dl.value.save_as(raw);assert raw.read_text()=='{broken-original'
  action(t,'import');t.locator('#imp-file').set_input_files(OUT/'fictional-export.json');t.wait_for_timeout(100);action(t,'import-do');t.locator('[data-ask=yes]').click();t.wait_for_timeout(100);assert not t.locator('.storage-alert').count();assert json.loads(t.evaluate("localStorage.getItem('lifegame-personal-my-v1')"))['tasks'];t.close();p.reload(wait_until='networkidle')
 record('Corrupt primary is preserved, raw download and recovery import work',corrupt)
 def demo_isolation():
  before=p.evaluate("localStorage.getItem('lifegame-personal-my-v1')");p.evaluate("__LG.go('learn')");action(p,'space-demo');assert state()['space']=='demo' and len(state()['tasks'])>0;action(p,'test-menu');action(p,'next-day');assert state()['lastProcessed']=='2026-11-18';action(p,'space-my');assert state()['space']=='my' and state()['lastProcessed']=='2026-11-17';after=p.evaluate("localStorage.getItem('lifegame-personal-my-v1')");a,before_s=json.loads(after),json.loads(before);assert a['facts']==before_s['facts'] and a['ledger']==before_s['ledger'];assert p.locator('[data-act=test-menu]').count()==0
 record('Demo and test date remain separate from personal data',demo_isolation)
 def mobile():
  for width in [320,375,390,768,1100]:
   p.set_viewport_size({'width':width,'height':844})
   for screen in ['home','day','map','tasks','habits','quests','calendar','shop','mybonuses','decisions','missed','history','summary','sessions','widgets','archive','settings','learn']:
    p.evaluate('(s)=>__LG.go(s)',screen);overflow=p.evaluate('document.documentElement.scrollWidth>innerWidth+1');assert not overflow,(width,screen)
   p.evaluate("__LG.edit('quest',null,{title:'Проверка редактора'})");assert not p.evaluate('document.documentElement.scrollWidth>innerWidth+1');p.screenshot(path=str(OUT/f'editor-{width}.png'),animations='disabled');p.evaluate('__LG.go("home")')
  p.set_viewport_size({'width':390,'height':844});p.emulate_media(color_scheme='dark');p.reload(wait_until='networkidle');p.screenshot(path=str(OUT/'home-dark.png'));p.emulate_media(color_scheme='light')
 record('Mobile/desktop screens and editors: 320/375/390/768/1100px',mobile)

 def location_ui():
  reset();action(p,'tab','[data-v=more]');action(p,'go','[data-s=locations]');action(p,'loc-new');p.locator('[name=name]').fill('Мастерская');p.locator('[name=style]').select_option('pop');p.locator('[name=tempo]').select_option('hard');submit('location');loc=state()['locations'][-1]['id']
  action(p,'loc-menu');action(p,'loc-set','[data-id="'+loc+'"]');assert state()['loc']['manual']['until'] is None;assert p.locator('html').get_attribute('data-style')=='pop'
  p.locator('#fab').click();action(p,'quick-kind','[data-v=task]');p.locator('[name=title]').fill('Собрать стойку');submit('quick');assert state()['tasks'][0]['locs']==[loc]
  action(p,'tab','[data-v=day]');assert p.locator('text=Собрать стойку').first.is_visible();action(p,'loc-menu');action(p,'loc-set','[data-id=home]');assert p.locator('[data-act=toggle][data-r="task:'+state()['tasks'][0]['id']+'"]').count()==0;action(p,'toggle-hidden');assert 'в другой локации' in p.locator('#app').inner_text();action(p,'force');action(p,'toggle');assert state()['facts'][0]['locationTitle']=='🏠 Дом'
  # Only an explicit filter in a section restricts it; location switching itself leaves the section intact.
  action(p,'tab','[data-v=more]');action(p,'go','[data-s=tasks]');action(p,'list-st','[data-v=done]');row=p.locator('[data-act=open][data-k=task][data-id="'+state()['tasks'][0]['id']+'"]');assert row.count()==1,'completed task missing';p.locator('[data-location-list=task]').select_option('home');assert row.count()==0,'explicit location filter failed';p.locator('[data-location-list=task]').select_option('');
  p.reload(wait_until='networkidle');assert state()['loc']['manual']['id']=='home';assert sum(l['coins'] for l in state()['ledger'])==10
 record('UI locations: create profile → quick add → hidden/forced → complete → filter → reload',location_ui)
 def default_block_location():
  reset();p.evaluate("__LG.run(()=>__LG.state().blocks[0].loc='home')");p.evaluate("__LG.edit('task',null,{title:'Дома',blockId:'b0'})");assert p.locator('[data-multi=locs] [data-v=home]').get_attribute('aria-pressed')=='true';submit();assert state()['tasks'][0]['locs']==['home']
 record('UI editor inherits block location without relinking existing tasks',default_block_location)
 def hint_ui():
  reset();p.evaluate('__LG.go("settings")');p.locator('[data-set=onb]').check();p.locator('#helper').wait_for(state='visible');action(p,'helper');assert 'Шаг 1 из 7' in p.locator('#helper-pop').inner_text();action(p,'hp-show');p.clock.run_for(150);assert p.locator('#helper-pop').count()==0;assert p.locator('#fab').evaluate("e=>e.classList.contains('pulse')");action(p,'helper');action(p,'hp-done');assert state()['settings']['onboarding']['done']['0'];p.reload(wait_until='networkidle');assert '2/7' in p.locator('#helper').inner_text();action(p,'helper');action(p,'hp-nav','[data-d="-1"]');action(p,'hp-reset');assert '0' not in state()['settings']['onboarding']['done']
  for style in ['quest','dawn','pop']:
   p.evaluate('(v)=>__LG.act("style",{v})',style);p.set_viewport_size({'width':320,'height':568});assert p.locator('#helper-pop').bounding_box()['y']>=0;p.screenshot(path=str(OUT/f'hint-{style}.png'),animations='disabled')
  p.set_viewport_size({'width':390,'height':844})
 record('UI hints: show target, pulse, complete/reload, reset, compact panel in three styles',hint_ui)
 def all_styles():
  reset()
  for style in ['quest','dawn','pop']:
   p.evaluate('(v)=>__LG.act("style",{v})',style);p.reload(wait_until='networkidle');assert p.locator('html').get_attribute('data-style')==style;p.evaluate('document.fonts.ready');assert p.evaluate("document.fonts.check('600 16px '+getComputedStyle(document.body).fontFamily.split(',')[0])")
   for width in [320,390,900]:
    p.set_viewport_size({'width':width,'height':844})
    for screen in ['home','day','locations','settings']:
     p.evaluate('(s)=>__LG.go(s)',screen);assert not p.evaluate('document.documentElement.scrollWidth>innerWidth+1'),(style,width,screen)
    p.screenshot(path=str(OUT/f'style-{style}-{width}.png'),animations='disabled')
    if width==390:p.evaluate('__LG.act("tab",{v:"home"})');p.screenshot(path=str(OUT/f'home-{style}.png'),animations='disabled')
  p.set_viewport_size({'width':390,'height':844});p.evaluate('__LG.act("style",{v:"quest"})')
 record('Styles: all templates, local fonts, reload, 320/390/900px and location settings',all_styles)
 def dst_boundaries():
  dst=b.new_context(viewport={'width':390,'height':844},locale='ru-RU',timezone_id='America/New_York',service_workers='block');dst.route('**/*',route);q=dst.new_page();q.clock.install(time=datetime(2026,11,1,5,45,tzinfo=timezone.utc));boot(q)
  result=q.evaluate('''async()=>{const L=__LG;await L.run(()=>{L.state().loc.fallback='home';L.state().loc.schedule=[{id:'dst',locId:'work',days:[7],from:'01:00',to:'01:30'}]});return new Date(L.nextBoundary()).toISOString()}''');assert result=='2026-11-01T06:00:00.000Z',result;dst.close()
 record('Locations: fall-back DST repeated hour produces the real next change',dst_boundaries)
 record('No uncaught JavaScript exceptions',lambda: (_ for _ in ()).throw(AssertionError(errors)) if errors else None)
 (OUT/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));b.close()
print(f"{sum(x['pass'] for x in results)}/{len(results)} passed")
sys.exit(0 if all(x['pass'] for x in results) else 1)
