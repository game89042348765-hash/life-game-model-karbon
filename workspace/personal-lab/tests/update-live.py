#!/usr/bin/env python3
"""Updated Personal: real DOM/clock/commit feedback, disposable localhost profile."""
import ast,json,sys
from pathlib import Path
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8041';OUT=ROOT/'verification';OUT.mkdir(exist_ok=True)
tree=ast.parse((ROOT/'tests/browser.py').read_text());HOOK=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='HOOK' for t in n.targets))
source=(ROOT/'app.js').read_text().rsplit('})();',1)[0]+HOOK+'})();';results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':844},locale='ru-RU',timezone_id='Europe/Moscow',service_workers='block')
 def route(r):
  if not r.request.url.startswith(BASE+'/'):return r.abort()
  if r.request.url.split('?')[0].endswith('/personal-lab/app.js'):return r.fulfill(status=200,content_type='text/javascript',body=source)
  r.continue_()
 c.route('**/*',route);p=c.new_page();p.clock.install(time=datetime(2026,11,11,9,tzinfo=timezone.utc));p.set_default_timeout(5000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(BASE+'/personal-lab/',wait_until='networkidle')
 def a(n,extra=''):p.locator('[data-act="'+n+'"]'+extra).filter(visible=True).last.click();p.wait_for_timeout(60)
 def s():return p.evaluate('__LG.state()')
 def submit(kind):p.locator('form[data-form="'+kind+'"] button:not([type=button])').last.click();p.wait_for_timeout(90)
 def reset():p.evaluate('__LG.reset()')
 def check(name,fn):
  try:fn();results.append({'name':name,'pass':True});print('PASS',name,flush=True)
  except Exception as e:results.append({'name':name,'pass':False,'error':str(e)});print('FAIL',name,str(e)[:800],flush=True)
 a('welcome','[data-v=my]');a('sheet-close')
 def quick_goal():
  reset();p.locator('#fab').click();a('quick-kind','[data-v=goal]');p.locator('[name=title]').fill('Играть первую песню');submit('quick');assert s()['inbox'][0]['goalDraft'];p.evaluate('''__LG.run(()=>{const st=__LG.stage('b2','Первый куплет');__LG.state().blocks[2].currentStageId=st.id})''');a('tab','[data-v=inbox]');a('note-convert','[data-k=goal]');p.locator('[name=blockId]').select_option('b2');p.locator('[name=stageId]').select_option(s()['stages'][0]['id']);submit('capture-goal');assert not s()['inbox'];a('new','[data-goal]');assert p.locator('[name=goalId]').input_value()==s()['goals'][0]['id'];p.locator('[name=title]').fill('Выучить Am');submit('item');assert s()['tasks'][0]['goalId']==s()['goals'][0]['id'];p.reload(wait_until='networkidle');assert s()['tasks'][0]['title']=='Выучить Am'
 check('UI: Quick goal draft → Inbox → stage → first linked task → reload',quick_goal)
 def inline():
  reset();p.evaluate("__LG.run(()=>__LG.stage('b2','Практика'))");p.evaluate("__LG.edit('habit',null,{title:'Смена аккордов',blockId:'b2',stageId:__LG.state().stages[0].id})");p.locator('[name=goalId]').select_option('__new');p.locator('form[data-form=goal-draft] [name=title]').fill('Менять Am и Em');submit('goal-draft');assert len(s()['goals'])==0;p.locator('[name=dailyTarget]').fill('3');submit('item');assert s()['habits'][0]['goalId']==s()['goals'][0]['id'];a('tab','[data-v=day]');hid=s()['habits'][0]['id'];ref='[data-r="habit:'+hid+'"]'
  for _ in range(2):a('toggle',ref)
  assert sum(l['coins'] for l in s()['ledger'])==0;assert '2/3 сегодня' in p.locator('#app').inner_text();a('toggle',ref);assert sum(l['coins'] for l in s()['ledger'])==5;a('toggle',ref);assert sum(l['coins'] for l in s()['ledger'])==0;assert '2/3 сегодня' in p.locator('#app').inner_text();p.screenshot(path=str(OUT/'updated-habit-day.png'),animations='disabled')
 check('UI: nested goal draft and habit norm +1/+1/reward/undo',inline)
 def calendar():
  reset();p.evaluate('__LG.go("calendar")');a('new','[data-k=cal]');p.locator('[name=title]').fill('Еженедельный урок');p.locator('[name=time]').fill('18:00');p.locator('[name=calRepeat]').select_option('weekly');submit('item');cid=s()['cal'][0]['id'];a('open','[data-k=cal]');a('cal-move');p.locator('form[data-form=cal-move] [name=date]').fill('2026-11-12');submit('cal-move');a('sheet-close');p.evaluate('__LG.go("calendar")');a('open','[data-k=cal]');assert '12 ноября' in p.locator('#layer').inner_text();a('detail-toggle');assert s()['facts'][0]['occurrence']=='2026-11-11';assert s()['facts'][0]['scheduledDate']=='2026-11-12';a('detail-toggle');assert sum(l['coins'] for l in s()['ledger'])==0;p.reload(wait_until='networkidle');assert s()['cal'][0]['exceptions']['2026-11-11']['date']=='2026-11-12'
 check('UI: weekly event → move only this appearance → complete/undo → reload',calendar)
 def following():
  reset();p.evaluate('''__LG.run(()=>__LG.state().cal.push(__LG.newItem('cal',{title:'Уроки среды',time:'18:00',repeat:{type:'weekly',days:[]}})))''');p.evaluate('__LG.go("calendar")');a('open','[data-k=cal]');a('cal-occurrence','[data-occ="2026-11-18"]');a('cal-move');p.locator('[name=date]').fill('2026-11-19');p.locator('[name=scope]').select_option('following');submit('cal-move');assert len(s()['cal'])==2;assert s()['cal'][0]['until']=='2026-11-17';assert s()['cal'][1]['date']=='2026-11-19';assert s()['cal'][0]['date']=='2026-11-11';p.reload(wait_until='networkidle');assert len(s()['cal'])==2
 check('UI: choose future appearance and move this plus following while preserving this week',following)
 def reminders():
  reset();p.evaluate('''__LG.run(()=>{const L=__LG;for(const [title,time,lead,date]of [['Рано','12:15',15,L.today()],['Час','13:00',60,L.today()],['Сутки','12:00',1440,L.addDays(L.today(),1)],['Опоздали','10:59',0,L.today()],['Сейчас','12:00',0,L.today()]])L.state().cal.push(L.newItem('cal',{title,time,reminderLead:lead,date}))})''')
  p.clock.run_for(1100);p.wait_for_timeout(150);items=s()['cal'];assert all('2026-11-11' in x['reminderReceipts'] for x in [items[0],items[1],items[4]]);assert '2026-11-12' in items[2]['reminderReceipts'];assert not items[3]['reminderReceipts'];assert not s()['ledger'];p.reload(wait_until='networkidle');p.clock.run_for(1100);assert p.locator('#calendar-reminder').count()==0
 check('Reminders: lead 0/15/60/1440, late >1h ignored, reload does not repeat',reminders)
 def feedback():
  reset();p.evaluate('''__LG.run(()=>__LG.state().tasks.push(__LG.newItem('task',{title:'Плавно',reward:25})))''');a('tab','[data-v=day]');a('toggle');assert sum(l['coins'] for l in s()['ledger'])==25;assert p.locator('.coin-flight').count()==1;assert p.locator('[data-wallet]').inner_text()=='● 0';p.clock.run_for(850);mid=p.locator('[data-wallet]').inner_text();assert mid not in ['● 0','● 25'],mid;p.clock.run_for(1500);assert p.locator('[data-wallet]').inner_text()=='● 25';assert p.locator('.coin-flight').count()==0
  a('toggle');p.evaluate("()=>{window.testSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===__LG.key())throw Error('quota');return window.testSetItem.call(this,k,v)}}");a('toggle');assert sum(l['coins'] for l in s()['ledger'])==0;assert p.locator('.coin-flight').count()==0;p.evaluate('()=>{Storage.prototype.setItem=window.testSetItem}');c.pages[0].emulate_media(reduced_motion='reduce');a('toggle');assert p.locator('.coin-flight').count()==0;assert p.locator('[data-wallet]').inner_text()=='● 25';p.emulate_media(reduced_motion='no-preference')
 check('Reward feedback: committed first, smooth count, no effect on failed save/reduced motion',feedback)
 def backup_prompt():
  reset();p.evaluate('''__LG.run(()=>{__LG.state().created='2026-11-01';__LG.state().tasks.push(__LG.newItem('task',{title:'Проверить копию'}))})''');p.evaluate('__LG.go("home")');assert 'Сохранить копию на эти дни?' in p.locator('#app').inner_text();a('backup-later');assert s()['settings']['backupSnooze']=='2026-11-14';assert 'Сохранить копию на эти дни?' not in p.locator('#app').inner_text();p.evaluate('__LG.go("settings")');a('restore-backup','[data-v=daily]');assert 'На начало' in p.locator('#layer').inner_text();a('sheet-close');a('export');assert s()['settings']['lastExport']=='2026-11-11'
 check('Backup UI: seven-day reminder, three-day snooze, dated preview and export tracking',backup_prompt)
 def day_copy():
  reset();p.evaluate('''__LG.run(()=>__LG.state().tasks.push(__LG.newItem('task',{title:'До полуночи'})))''');p.clock.set_system_time(datetime(2026,11,12,9,tzinfo=timezone.utc));p.reload(wait_until='networkidle');daily=p.evaluate('__LG.io.daily(__LG.key())');assert daily['day']=='2026-11-12';assert daily['data']['tasks'][0]['title']=='До полуночи';assert daily['data']['lastProcessed']=='2026-11-11';p.evaluate('''__LG.run(()=>__LG.state().tasks.push(__LG.newItem('task',{title:'После полуночи'})))''');assert len(p.evaluate('__LG.io.daily(__LG.key()).data.tasks'))==1
 check('Start-of-day copy freezes prior valid state on actual next date',day_copy)
 def new_week():
  p.clock.set_system_time(datetime(2026,11,11,9,tzinfo=timezone.utc));reset();ids=p.evaluate('''async()=>{let ids;await __LG.run(()=>{const L=__LG,h=L.newItem('habit',{title:'Два подхода',dailyTarget:2,reward:6,goal:{mode:'total',period:'month',target:3,reward:30,bonus:[]}}),c=L.newItem('cal',{title:'Ежедневное событие',reward:4,repeat:{type:'daily',days:[]}});L.state().habits.push(h);L.state().cal.push(c);ids={h:h.id,c:c.id}});return ids}''')
  for day in range(7):
   if day:p.clock.set_system_time(datetime(2026,11,11+day,9,tzinfo=timezone.utc));p.reload(wait_until='networkidle')
   a('tab','[data-v=day]')
   for _ in range(2 if day%2==0 else 1):a('toggle','[data-r="habit:'+ids['h']+'"]')
   if day!=1:a('toggle','[data-r="cal:'+ids['c']+'@2026-11-'+str(11+day)+'"]')
   if day==3:
    p.evaluate('(id)=>__LG.act("miss-do",{id})',s()['misses'][-1]['id'])
  data=s();assert sum(l['coins'] for l in data['ledger'])==82;assert sum(l['xp'] for l in data['ledger'])==82;assert len([f for f in data['facts'] if f['kind']=='habit' and not f['cancelled']])==4;assert len([f for f in data['facts'] if f['kind']=='cal' and not f['cancelled']])==7;assert len([m for m in data['misses'] if m['kind']=='habit'])==3;assert len([m for m in data['misses'] if m['kind']=='cal'])==1
  (OUT/'updated-week-summary.json').write_text(json.dumps({'dates':'2026-11-11…17','coins':82,'xp':82,'successfulHabitDays':4,'habitApproaches':11,'calendarCompletions':7,'historicalMisses':4},ensure_ascii=False,indent=2))
 check('Seven actual dates with partial norms, full daily awards, repeats and late completion',new_week)
 for w in [320,390,430]:
  p.set_viewport_size({'width':w,'height':844});p.evaluate('__LG.quickAdd("Проверка размеров")');assert not p.evaluate('document.documentElement.scrollWidth>innerWidth+1');a('sheet-close')
 check('No JavaScript errors in updated UI paths',lambda: (_ for _ in ()).throw(AssertionError(errors)) if errors else None)
 b.close()
(OUT/'update-live-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print(f"{sum(r['pass'] for r in results)}/{len(results)} passed");raise SystemExit(0 if all(r['pass'] for r in results) else 1)
