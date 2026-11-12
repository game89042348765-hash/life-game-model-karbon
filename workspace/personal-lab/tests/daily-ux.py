#!/usr/bin/env python3
"""LAB-013. Real local UI/storage/PWA checks on fictional data in disposable Chromium.

Test-only hooks are injected into HTTP responses; never shipped in app.js.
The pinned Git baseline is used to test actual old-cache -> current-cache updates.
"""
import argparse
from datetime import datetime, timedelta, timezone
from functools import partial
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import subprocess
import threading
from playwright.sync_api import sync_playwright

LAB = Path(__file__).resolve().parents[1]
REPO = LAB.parent
BASELINE = '50bfec575c6d173be901fd60d38c1fc576668651'
APPS = [
    ('personal-lab', 'lifegame-personal-lab-'),
    ('personal-lab/experiments/ai-strategy', 'lifegame-ai-strategy-lab-'),
    ('personal-lab/experiments/flexible-complexity', 'lifegame-flex-lab-'),
]
HOOK = '''
window.__LAB13={state:()=>S,today,exportFile,dayStats,plan:dayPlan,
run:fn=>runGuarded(()=>tx(fn)),
newItem:(k,p)=>({task:newTask,habit:newHabit,quest:newQuest,cal:newCal}[k])(p),
reset:()=>runGuarded(()=>{closeAllSheets();replaceSpace(makeBlank());goTab('day')}),
go:s=>{closeAllSheets();go(s,{})},replace:s=>runGuarded(()=>{replaceSpace(s);render()}),
startTimer:r=>runGuarded(()=>startTimer(15,get(...pr(r)).title,r))};
'''


class Handler(SimpleHTTPRequestHandler):
    baseline = False
    baseline_files = {}
    def log_message(self, *args):
        pass
    def do_GET(self):
        name = self.path.split('?')[0].lstrip('/')
        if self.baseline and name in self.baseline_files:
            body = self.baseline_files[name]
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    out = args.out or LAB/'verification'/('LAB-013-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    out.mkdir(parents=True, exist_ok=False)
    for name, _ in APPS:
        for file in ['app.js', 'sw.js'] + (['flex-ui.js'] if name.endswith('flexible-complexity') else []):
            path = name+'/'+file
            Handler.baseline_files[path] = subprocess.check_output(['git', 'show', BASELINE+':'+path], cwd=REPO)
    server = ThreadingHTTPServer(('127.0.0.1',0), partial(Handler, directory=str(REPO)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base = 'http://127.0.0.1:'+str(server.server_port)
    start = datetime(2026,11,12,9,tzinfo=timezone.utc)
    checks, errors, external = [], [], []
    page = context = None

    def check(name, fn):
        try:
            detail = fn()
            checks.append({'name':name,'passed':True,'details':detail})
            print('PASS', name, flush=True)
        except Exception as exc:
            checks.append({'name':name,'passed':False,'error':str(exc)})
            print('FAIL', name, str(exc), flush=True)
            try:
                page.screenshot(path=str(out/'failure.png'),full_page=True)
                (out/'failure-state.json').write_text(json.dumps(page.evaluate('__LAB13.state()'),ensure_ascii=False,indent=2))
                context.tracing.stop(path=str(out/'failure-trace.zip'))
            except Exception:
                pass
            raise

    def report():
        files = [REPO/name/file for name,_ in APPS for file in ['app.js','sw.js']]
        files.append(REPO/APPS[2][0]/'flex-ui.js')
        data = {'task':'LAB-013','status':'technical_fictional_checks_not_independent_ai_user_study',
                'baseline':BASELINE,'checks':checks,'passed':sum(c['passed'] for c in checks),
                'page_errors':errors,'external_requests':external,'artifacts':str(out),
                'hashes':{str(p.relative_to(REPO)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}}
        (out/'report.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

    try:
      with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        for app, prefix in APPS:
            key = prefix+'my-v1'
            context = browser.new_context(viewport={'width':390,'height':844}, locale='ru-RU', timezone_id='Europe/Moscow', service_workers='block')
            context.tracing.start(screenshots=True,snapshots=True,sources=True)
            source = (REPO/app/'app.js').read_text().rsplit('})();',1)[0]+HOOK+'})();'
            def route(r):
                if not r.request.url.startswith(base+'/'):
                    external.append(r.request.url)
                    return r.abort()
                if r.request.url.split('?')[0]==base+'/'+app+'/app.js':
                    return r.fulfill(status=200,content_type='text/javascript',body=source)
                r.continue_()
            context.route('**/*',route)
            page = context.new_page()
            page.clock.install(time=start)
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.set_default_timeout(10000)
            page.goto(base+'/'+app+'/',wait_until='networkidle')
            if app.endswith('flexible-complexity'):
                page.locator('[data-act=flex-start][data-view=full]').click()
            else:
                page.locator('[data-act=welcome][data-v=my]').click()
            page.wait_for_function('!!window.__LAB13 && !!__LAB13.state()')

            def state():return page.evaluate('__LAB13.state()')
            def reset():page.evaluate('__LAB13.reset()')
            def seed(target=3, goal=30):
                page.evaluate('''async ({target,goal})=>{await __LAB13.run(()=>{const s=__LAB13.state();s.habits.push(__LAB13.newItem('habit',{id:'practice',title:'Читать десять минут',dailyTarget:target,reward:5,goal:{mode:'total',period:'month',target:goal,reward:50,bonus:[]}}))})}''',{'target':target,'goal':goal})
            def click_saved(selector):
                revision = state()['revision']
                page.locator(selector).filter(visible=True).first.click()
                page.wait_for_function('(r)=>__LAB13.state().revision>r',arg=revision)
            def close_top():page.locator('#layer .overlay').last.locator('.sh-title [data-act=sheet-close]').click()
            def open_time():
                if page.locator('[data-flex-basic]').is_visible():
                    page.locator('[data-act=time-log][data-r="habit:practice"]').click()
                else:
                    page.evaluate('__LAB13.go("day")')
                    page.locator('[data-act=open][data-k=habit][data-id=practice]').first.click()
                    page.locator('[data-act=time-log]').filter(visible=True).last.click()
                page.wait_for_selector('[data-form=manual-time]')
            def submit_minutes(value):
                page.locator('[data-form=manual-time] [name=minutes]').fill(str(value))
                click_saved('[data-form=manual-time] [type=submit]')
                page.wait_for_function('!document.querySelector("[data-form=manual-time]")')
            def balance():return sum(x['coins'] for x in state()['ledger'])

            def planned_habits():
                reset();seed(1)
                click_saved('[data-act=toggle][data-r="habit:practice"]')
                assert balance()==5 and page.locator('h2').filter(has_text='Выполнено вне плана').count()==0
                assert len([f for f in state()['facts'] if f['kind']=='habitStep'])==1
                click_saved('[data-act=toggle][data-r="habit:practice"]')
                assert balance()==0
                reset();seed(3)
                for i in range(3):
                    click_saved('[data-act=toggle][data-r="habit:practice"]')
                    assert page.locator('h2').filter(has_text='Выполнено вне плана').count()==0
                    assert balance()==(5 if i==2 else 0)
                click_saved('[data-act=toggle][data-r="habit:practice"]')
                assert balance()==0 and len([f for f in state()['facts'] if f['kind']=='habitStep' and not f['cancelled']])==2
                return 'norm 1 and 3, partial steps and undo: no false outside-plan row, original single reward'
            check(app+': planned habit steps and undo',planned_habits)

            def calendar_and_milestone():
                reset()
                page.evaluate('''async()=>await __LAB13.run(()=>__LAB13.state().cal.push(__LAB13.newItem('cal',{id:'repeat',title:'Повторяющаяся встреча',repeat:{type:'daily',days:[]},reminder:false,reward:3})))''')
                r='cal:repeat@2026-11-12'
                click_saved('[data-act=toggle][data-r="'+r+'"]')
                assert balance()==3 and page.locator('h2').filter(has_text='Выполнено вне плана').count()==0
                click_saved('[data-act=toggle][data-r="'+r+'"]')
                assert balance()==0
                reset();seed(1,1)
                click_saved('[data-act=toggle][data-r="habit:practice"]')
                assert balance()==55 and page.locator('h2').filter(has_text='Выполнено вне плана').count()==1
                assert 'Цель привычки' in page.locator('#app').inner_text()
                click_saved('[data-act=toggle][data-r="habit:practice"]')
                assert balance()==0
                return 'recurring occurrence matches its plan; separate milestone remains visible and undo preserves reward dependencies'
            check(app+': calendar identity and separate milestones',calendar_and_milestone)

            def manual_time():
                reset();seed()
                page.evaluate('async()=>await __LAB13.run(()=>{__LAB13.state().settings.lite=true})')
                open_time();submit_minutes(5)
                s=state();assert len(s['timeLog'])==1 and s['timeLog'][0]['minutes']==5
                assert not s['facts'] and not s['ledger'] and s['timer']['state']=='ready'
                assert 'Сегодня записано времени: 5 мин.' in page.locator('#layer').inner_text()
                close_top();page.evaluate('__LAB13.go("day")')
                assert 'Записано 5 мин.' in page.locator('#app').inner_text()
                page.wait_for_function('!document.querySelector(".toast") || document.querySelector(".toast").hidden')
                page.screenshot(path=str(out/(prefix+'five-minutes.png')),full_page=True)
                page.reload(wait_until='networkidle');page.wait_for_function('!!window.__LAB13')
                page.evaluate('__LAB13.go("day")')
                assert len(state()['timeLog'])==1 and page.evaluate('__LAB13.dayStats(__LAB13.today()).minutes')==5
                snapshot=page.evaluate('__LAB13.exportFile().data')
                page.evaluate('s=>__LAB13.replace(s)',snapshot)
                assert state()['timeLog']==snapshot['timeLog'] and not state()['ledger']
                open_time();page.locator('[data-act=time-edit]').click()
                page.get_by_role('dialog',name='Исправить время').wait_for();submit_minutes(3)
                assert len(state()['timeLog'])==1 and state()['timeLog'][0]['minutes']==3
                open_time();page.locator('[data-act=time-edit]').click()
                page.get_by_role('dialog',name='Исправить время').wait_for();submit_minutes(0)
                assert len(state()['timeLog'])==1 and state()['timeLog'][0]['minutes']==0
                assert not state()['facts'] and balance()==0
                return 'Lite route: five minutes survive reload/export/import; correction reuses ID, zero clears time amount; no completion/reward'
            check(app+': manual time, correction and roundtrip',manual_time)

            def duplicate_and_quota():
                reset();seed();open_time()
                page.locator('[data-form=manual-time]').evaluate('''f=>{f.elements.minutes.value='5';for(let i=0;i<2;i++)f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))}''')
                page.wait_for_function('__LAB13.state().timeLog.length===1')
                assert len(state()['timeLog'])==1 and not state()['facts']
                reset();seed();open_time()
                page.evaluate('''key=>{window.__originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Injected quota','QuotaExceededError');return __originalSet.call(this,k,v)}}''',key)
                page.locator('[name=minutes]').fill('5');page.locator('[data-form=manual-time] [type=submit]').click()
                page.wait_for_function('document.querySelector(".storage-alert")?.textContent.includes("НЕ сохранено")')
                assert not state()['timeLog'] and not state()['facts'] and balance()==0
                assert page.locator('[name=minutes]').input_value()=='5'
                page.evaluate('()=>{Storage.prototype.setItem=__originalSet}')
                click_saved('[data-form=manual-time] [type=submit]')
                assert len(state()['timeLog'])==1
                return 'rapid double submit records once; quota failure preserves draft and state; retry records once'
            check(app+': duplicate submit and failed storage retry',duplicate_and_quota)

            def stale_tab():
                reset();seed(1);open_time();page.locator('[name=minutes]').fill('5')
                other=context.new_page();other.clock.install(time=start)
                other.goto(base+'/'+app+'/',wait_until='networkidle');other.wait_for_function('!!window.__LAB13')
                other.evaluate('__LAB13.go("day")')
                other.locator('[data-act=toggle][data-r="habit:practice"]').click()
                other.wait_for_function('__LAB13.state().ledger.length===1')
                page.locator('[data-form=manual-time] [type=submit]').click()
                page.wait_for_function('document.querySelector(".storage-alert")?.textContent.includes("вклад")')
                durable=page.evaluate('key=>JSON.parse(localStorage.getItem(key))',key)
                assert not durable['timeLog'] and sum(l['coins'] for l in durable['ledger'])==5
                assert page.locator('[name=minutes]').input_value()=='5'
                other.close();page.reload(wait_until='networkidle');page.wait_for_function('!!window.__LAB13')
                return 'real second tab commits completion; stale time form cannot overwrite it and retains entered minutes'
            check(app+': real second-tab conflict',stale_tab)

            def completed_search():
                reset()
                page.evaluate('''async()=>await __LAB13.run(()=>__LAB13.state().tasks.push(__LAB13.newItem('task',{id:'drawing',title:'Порисовать десять минут',reward:10})))''')
                click_saved('[data-act=toggle][data-r="task:drawing"]')
                page.locator('[data-act=quick-done]').first.click()
                page.locator('[data-qd-q]').fill('рисовать')
                page.wait_for_selector('[data-qd-completed]')
                assert page.locator('[data-qd-completed] [data-act=qd-do]').count()==0
                assert 'Разовое дело уже выполнено' in page.locator('[data-qd-completed]').inner_text()
                page.locator('[data-qd-completed] [data-act=open]').click()
                assert 'Порисовать десять минут' in page.locator('#layer').inner_text()
                assert len(state()['tasks'])==1 and balance()==10
                return 'completed one-off task is found read-only; opening retains original ID and single payout'
            check(app+': completed-task search explains saved state',completed_search)

            def timer_conflict():
                reset();seed();page.evaluate('__LAB13.startTimer("habit:practice")')
                page.evaluate('__LAB13.go("day")')
                page.locator('[data-act=open][data-k=habit][data-id=practice]').first.click()
                page.locator('[data-act=time-log]').click()
                page.wait_for_selector('[data-act=timer-stop]')
                assert page.locator('[data-form=manual-time]').count()==0 and not state()['timeLog']
                click_saved('[data-act=timer-stop]')
                page.locator('[data-form=timer-log] [name=min]').fill('5')
                click_saved('[data-form=timer-log] button.btn.primary')
                assert len(state()['timeLog'])==1 and state()['timeLog'][0]['minutes']==5 and not state()['facts']
                return 'matching active timer uses its existing confirmation; no duplicate manual entry or reward'
            check(app+': active timer handoff',timer_conflict)

            if app.endswith('flexible-complexity'):
                def basic_flow():
                    reset();seed()
                    page.evaluate('''async()=>await __LAB13.run(()=>__LAB13.state().tasks.push(__LAB13.newItem('task',{id:'frozen',title:'Остальная стратегия'})))''')
                    click_saved('[data-act=flex-basic]')
                    page.locator('[name=member][value="habit:practice"]').check()
                    click_saved('[data-form=flex-config] [type=submit]')
                    page.wait_for_selector('[data-flex-basic]')
                    open_time();submit_minutes(5)
                    assert 'записано 5 мин.' in page.locator('[data-flex-basic]').inner_text()
                    assert '0 из 3' in page.locator('[data-flex-basic]').inner_text()
                    assert 'Остальная стратегия' not in page.locator('[data-flex-basic]').inner_text()
                    assert page.locator('[data-wallet]').count()==0 and not state()['facts']
                    page.wait_for_function('!document.querySelector(".toast") || document.querySelector(".toast").hidden')
                    page.screenshot(path=str(out/'basic-five-minutes.png'),full_page=True)
                    click_saved('[data-act=flex-full]')
                    assert page.evaluate('LifeGameFlex.at(__LAB13.state(),__LAB13.today()).policy')=='basic'
                    return 'Basic logs partial time directly, preserves zero approaches, membership, freeze policy and calm view'
                check(app+': Basic daily route with partial time',basic_flow)

            def responsive():
                for width in [375,390,1280]:
                    page.set_viewport_size({'width':width,'height':844});open_time()
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
                    close_top()
                page.set_viewport_size({'width':390,'height':844})
                return {'widths':[375,390,1280]}
            check(app+': manual-time responsive layout',responsive)

            def midnight():
                reset();seed();open_time();page.locator('[name=minutes]').fill('5')
                page.clock.set_system_time(start+timedelta(days=1))
                page.locator('[data-form=manual-time] [type=submit]').click()
                page.wait_for_function('document.querySelector(".toast")?.textContent.includes("Дата изменилась")')
                assert not state()['timeLog'] and not state()['facts'] and balance()==0
                assert page.locator('[name=minutes]').input_value()=='5'
                return 'cross-midnight draft cannot silently move effort to a different day'
            check(app+': date changed while editing',midnight)
            context.tracing.stop(path=str(out/(prefix+'trace.zip')))
            context.close()

        for app,prefix in APPS:
            Handler.baseline=True
            context=browser.new_context(viewport={'width':390,'height':844},locale='ru-RU',timezone_id='Europe/Moscow')
            context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base+'/') else r.abort())
            page=context.new_page();page.clock.install(time=start);page.set_default_timeout(12000)
            page.on('pageerror',lambda e:errors.append(str(e)))
            key=prefix+'my-v1'
            def pwa_update():
                page.goto(base+'/'+app+'/',wait_until='networkidle')
                page.wait_for_function('navigator.serviceWorker.controller!==null')
                if app.endswith('flexible-complexity'):page.locator('[data-act=flex-start][data-view=full]').click()
                else:
                    page.locator('[data-act=welcome][data-v=my]').click()
                    page.locator('#layer .sh-title [data-act=sheet-close]').click()
                page.locator('[data-act=tab][data-v=more]').click();page.locator('[data-act=go][data-s=habits]').click()
                page.locator('[data-act=new][data-k=habit]').click();page.locator('[name=title]').fill('Старое сохранение')
                page.locator('[data-form=item] button.btn.primary').click();page.wait_for_function('document.querySelector("[data-form=item]")===null')
                before=page.evaluate('key=>JSON.parse(localStorage.getItem(key))',key)
                own_cache=re.search(r"const CACHE='([^']+)'",(REPO/app/'sw.js').read_text()).group(1)
                assert own_cache.endswith('v2')
                other_cache='unrelated-app-cache'
                page.evaluate('async key=>{await caches.open(key)}',other_cache)
                page.locator('[data-act=new][data-k=habit]').click();page.locator('[name=title]').fill('Открытый черновик')
                Handler.baseline=False
                page.evaluate('async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()}')
                page.locator('#app-update').wait_for(state='visible')
                dialogs=[];page.on('dialog',lambda d:(dialogs.append(d.message),d.accept()))
                page.locator('#app-update button').click()
                assert dialogs and page.locator('[name=title]').input_value()=='Открытый черновик'
                page.locator('[data-form=item] button.btn.primary').click();page.wait_for_function('!document.querySelector("[data-form=item]")')
                page.locator('#app-update button').click();page.wait_for_function('!document.querySelector("#app-update")')
                page.wait_for_load_state('networkidle')
                current=page.evaluate('key=>JSON.parse(localStorage.getItem(key))',key)
                assert len(current['habits'])==2 and current['habits'][0]['id']==before['habits'][0]['id']
                assert current['ledger']==before['ledger'] and current['facts']==before['facts']
                keys=page.evaluate('caches.keys()');assert own_cache in keys and other_cache in keys
                scope=page.evaluate('async()=>(await navigator.serviceWorker.getRegistration()).scope');assert scope.endswith('/'+app+'/')
                assert page.evaluate('typeof window.__LAB13')=='undefined'
                context.set_offline(True);page.reload(wait_until='load')
                page.locator('#tabs [data-act=tab][data-v=day]').click()
                hid=current['habits'][0]['id'];page.locator('[data-act=open][data-k=habit][data-id="'+hid+'"]').first.click()
                page.locator('[data-act=time-log]').click();page.locator('[name=minutes]').fill('5')
                page.locator('[data-form=manual-time] [type=submit]').click();page.wait_for_function('!document.querySelector("[data-form=manual-time]")')
                page.reload(wait_until='load')
                final=page.evaluate('key=>JSON.parse(localStorage.getItem(key))',key)
                assert len(final['timeLog'])==1 and final['timeLog'][0]['minutes']==5 and not final['ledger']
                return {'scope':scope,'cache':own_cache,'legacy_habit_id_retained':True,'draft_saved_before_update':True,'offline_time_persisted':True,'unrelated_cache_preserved':True}
            check(app+': actual baseline-v1 to v2 update and offline time',pwa_update)
            context.close()
        browser.close()
        assert not errors,errors
        assert not external,external
    finally:
        server.shutdown();report()
    print(json.dumps({'passed':sum(c['passed'] for c in checks),'total':len(checks),'artifacts':str(out)},ensure_ascii=False))


if __name__=='__main__':
    main()
