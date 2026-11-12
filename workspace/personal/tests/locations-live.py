#!/usr/bin/env python3
"""Real-clock location changes and deferred reminders on a disposable localhost profile."""
import ast,json,sys
from pathlib import Path
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8041';OUT=ROOT/'verification'
tree=ast.parse((ROOT/'tests/browser.py').read_text());HOOK=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='HOOK' for t in n.targets));source=(ROOT/'app.js').read_text().rsplit('})();',1)[0]+HOOK+'})();';results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':844},locale='ru-RU',timezone_id='Europe/Moscow',service_workers='block')
 def route(r):
  if not r.request.url.startswith(BASE+'/'):return r.abort()
  if r.request.url.endswith('/personal/app.js'):return r.fulfill(status=200,content_type='text/javascript',body=source)
  r.continue_()
 c.route('**/*',route);p=c.new_page();p.clock.install(time=datetime(2026,11,11,9,tzinfo=timezone.utc));p.set_default_timeout(6000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 def a(n,extra=''):p.locator('[data-act="'+n+'"]'+extra).filter(visible=True).first.click();p.wait_for_timeout(80)
 def s():return p.evaluate('__LG.state()')
 def check(name,fn):
  try:fn();results.append({'name':name,'pass':True});print('PASS',name,flush=True)
  except Exception as e:results.append({'name':name,'pass':False,'error':str(e)});print('FAIL',name,str(e)[:700],flush=True)
 p.goto(BASE+'/personal/',wait_until='networkidle');a('welcome','[data-v=my]');a('sheet-close')
 def clock():
  a('tab','[data-v=more]');a('go','[data-s=locations]');p.locator('[data-locfallback]').select_option('home');p.wait_for_timeout(80);a('rule-new');p.locator('[name=locId]').select_option('work');p.locator('[name=from]').fill('12:01');p.locator('[name=to]').fill('12:02');p.locator('form[data-form=locrule] button:not([type=button])').click();p.wait_for_timeout(80)
  assert p.evaluate('__LG.currentLoc().id')=='home';p.clock.run_for(61000);p.wait_for_timeout(100);assert p.evaluate('__LG.currentLoc().id')=='work';assert s()['loc']['lastSeen']=='work'
  a('loc-menu');a('loc-set','[data-id=road]');until=s()['loc']['manual']['until'];assert datetime.fromtimestamp(until/1000,timezone.utc).minute==2;p.clock.run_for(60000);p.wait_for_timeout(100);assert p.evaluate('__LG.currentLoc().id')=='home';assert s()['loc']['lastSeen']=='home';assert not s()['ledger']
 check('Actual schedule boundaries update the screen; manual choice expires at real next change',clock)
 def reminder():
  p.evaluate('''async()=>{const L=__LG;await L.run(()=>{L.locById('work').muteOther=true;for(const place of ['home','work'])L.state().cal.push(L.newItem('cal',{title:'Напоминание '+place,time:'12:03',locs:[place]}))});await L.act('loc-set',{id:'work'})}''')
  p.clock.run_for(61000);p.wait_for_timeout(100);assert s()['cal'][0].get('notifiedDates') is None;assert '2026-11-11' in s()['cal'][1]['reminderReceipts'];assert 'work' in p.locator('#calendar-reminder').inner_text()
  p.evaluate('__LG.act("loc-set",{id:"home"})');p.clock.run_for(1100);p.wait_for_timeout(100);assert '2026-11-11' in s()['cal'][0]['reminderReceipts'];assert 'home' in p.locator('#calendar-reminder').inner_text();assert not s()['facts'] and not s()['ledger']
 check('Other-place reminders wait without acknowledgement and appear after switching back',reminder)
 if errors:results.append({'name':'No page errors','pass':False,'error':str(errors)})
 b.close()
(OUT/'locations-live-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));raise SystemExit(0 if all(r['pass'] for r in results) else 1)
