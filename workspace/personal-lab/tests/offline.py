#!/usr/bin/env python3
"""Actual service worker tests on a disposable localhost origin, fictional data only."""
import json,threading,re
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'verification';OUT.mkdir(exist_ok=True);checks=[]
class Handler(SimpleHTTPRequestHandler):
 version=1
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT.parent),**kw)
 def log_message(self,*a):pass
 def do_GET(self):
  if self.path.split('?')[0]=='/personal-lab/sw.js':
   body=re.sub(r'shell-v\d+',f'shell-v{self.version}',(ROOT/'sw.js').read_text()).encode();self.send_response(200);self.send_header('Content-Type','application/javascript');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)
  else:super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();BASE=f'http://127.0.0.1:{server.server_port}'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':844},locale='ru-RU',timezone_id='Europe/Moscow');c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE+'/') else r.abort());p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.clock.install(time=datetime(2026,11,11,9,tzinfo=timezone.utc));p.set_default_timeout(8000)
 def a(act,extra=''):p.locator('[data-act="'+act+'"]'+extra).filter(visible=True).first.click();p.wait_for_timeout(90)
 def submit():p.locator('#layer form button:not([type=button])').last.click();p.wait_for_timeout(100)
 def s():return p.evaluate("JSON.parse(localStorage.getItem('lifegame-personal-lab-my-v1'))")
 def check(name,fn):
  try:fn();checks.append({'name':name,'pass':True});print('PASS',name,flush=True)
  except Exception as e:checks.append({'name':name,'pass':False,'error':str(e)});print('FAIL',name,str(e)[:500],flush=True)
 def setup():
  p.goto(BASE+'/personal-lab/',wait_until='networkidle');a('welcome','[data-v=my]');a('sheet-close');p.wait_for_function('!!navigator.serviceWorker.controller');scope=p.evaluate('(async()=>{const r=await navigator.serviceWorker.ready;return r.scope})()');assert scope==BASE+'/personal-lab/'
  a('tab','[data-v=more]');a('go','[data-s=tasks]');a('new','[data-k=task]');p.locator('[name=title]').fill('Дело без сети');submit()
  assert len(s()['tasks'])==1
 check('Install service worker scoped to personal and create task',setup)
 def offline():
  c.set_offline(True);p.reload(wait_until='networkidle');assert p.locator('text=LifeGame').first.is_visible();a('tab','[data-v=day]');a('toggle');assert sum(l['coins'] for l in s()['ledger'])==10;p.reload(wait_until='networkidle');assert len(s()['facts'])==1
 check('Offline reload, completion, persistent reward and second reload',offline)
 def styles_offline():
  a('tab','[data-v=more]');a('go','[data-s=settings]')
  for style in ['quest','dawn','pop']:
   a('style','[data-v='+style+']');p.evaluate('document.fonts.ready');assert p.locator('html').get_attribute('data-style')==style;assert p.evaluate("document.fonts.check('600 16px '+getComputedStyle(document.body).fontFamily.split(',')[0])")
  a('style','[data-v=quest]');assert p.evaluate("(async()=>{const c=await caches.open('lifegame-personal-lab-shell-v1');return (await c.keys()).filter(r=>r.url.endsWith('.woff2')).length})()")==14
 check('All three styles and 14 local fonts are available offline',styles_offline);c.set_offline(False)
 def update():
  a('tab','[data-v=more]');a('go','[data-s=tasks]');a('new','[data-k=task]');p.locator('[name=title]').fill('Не потерять при обновлении');Handler.version=2
  p.evaluate('(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()})()');p.locator('#app-update').wait_for(state='visible');dialog=[];p.on('dialog',lambda d:(dialog.append(d.message),d.accept()));p.locator('#app-update button').click();assert dialog and p.locator('[name=title]').input_value()=='Не потерять при обновлении'
  submit();p.locator('#app-update button').click();p.wait_for_function('!document.querySelector("#app-update")');p.wait_for_load_state('networkidle');assert len(s()['tasks'])==2 and sum(l['coins'] for l in s()['ledger'])==10;assert p.evaluate('caches.keys()')==['lifegame-personal-lab-shell-v2']
 check('PWA update defers reload for open draft and preserves committed data',update)
 def reminder():
  a('tab','[data-v=more]');a('go','[data-s=calendar]');a('new','[data-k=cal]');p.locator('[name=title]').fill('Напоминание об уроке');p.locator('[name=time]').fill('12:01');submit();p.clock.run_for(61000);p.locator('#calendar-reminder').wait_for(state='visible');assert '2026-11-11' in s()['cal'][0]['reminderReceipts'];p.locator('#calendar-reminder .ib').click();p.clock.run_for(60000);assert not p.locator('#calendar-reminder').count();p.reload(wait_until='networkidle');p.clock.run_for(1000);assert not p.locator('#calendar-reminder').count()
 check('Foreground calendar reminder fires once and remains acknowledged on reload',reminder)
 check('No uncaught browser errors',lambda:(_ for _ in ()).throw(AssertionError(errors)) if errors else None)
 b.close()
server.shutdown();(OUT/'offline-report.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2));print(f"{sum(c['pass'] for c in checks)}/{len(checks)} passed");raise SystemExit(0 if all(c['pass'] for c in checks) else 1)
