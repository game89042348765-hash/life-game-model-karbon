#!/usr/bin/env python3
"""LAB-009 local acceptance. Fictional data; hooks are injected in HTTP responses only."""
from datetime import datetime, timedelta, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import re
import hashlib
import json
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[2]
PREFIX = '/personal-lab/experiments/flexible-complexity/'
KEY = 'lifegame-flex-lab-my-v1'
META = 'lifegame-flex-lab-meta-v1'
HOOK = '''
window.__LAB9={state:()=>S,today,plan:dayPlan,processDays,reminderCandidates,exportFile,
 run:fn=>runGuarded(()=>tx(fn)),get,complete,undoFact,
 newItem:(k,p)=>({task:newTask,habit:newHabit,quest:newQuest,cal:newCal}[k])(p),
 go:s=>{closeAllSheets();go(s,{})},sheets:()=>SHEETS.length,replace:value=>runGuarded(()=>{replaceSpace(value);render()}),
 startTimer:(m)=>runGuarded(()=>startTimer(m,'Проверка',null)),
 enter:()=>runGuarded(()=>tx(()=>Flex.enterBasic(S,today()))),
 configure:(refs,opts)=>runGuarded(()=>tx(()=>Flex.configure(S,today(),refs,opts))),
 force:r=>runGuarded(()=>tx(()=>dayRec(today()).forced.push(r)))};
'''


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--out')
    args = ap.parse_args()
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    out = Path(args.out) if args.out else REPO/'personal-lab/verification'/('LAB-009-'+stamp)
    out.mkdir(parents=True, exist_ok=False)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(REPO)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = 'http://127.0.0.1:'+str(server.server_port)
    source = (ROOT/'app.js').read_text().rsplit('})();', 1)[0]+HOOK+'})();'
    results, errors, external = [], [], []
    p = c = None

    def check(name, fn):
        try:
            detail = fn()
            results.append({'name': name, 'passed': True, 'details': detail})
            print('PASS', name, flush=True)
        except Exception as exc:
            results.append({'name': name, 'passed': False, 'error': str(exc)})
            print('FAIL', name, str(exc), flush=True)
            if p:
                try:
                    p.screenshot(path=str(out/'failure.png'), full_page=True)
                    c.tracing.stop(path=str(out/'failure-trace.zip'))
                except Exception:
                    pass
            raise

    def report():
        value = {'task': 'LAB-009', 'status': 'technical_fictional_checks_not_user_study',
                 'checks': results, 'passed': sum(x['passed'] for x in results),
                 'page_errors': errors, 'external_requests': external, 'artifacts': str(out),
                 'source_product': 'Personal 1.2.0', 'hashes': {
                     name: hashlib.sha256((ROOT/name).read_bytes()).hexdigest()
                     for name in ['app.js', 'flex-model.js', 'flex-ui.js', 'persistence.js', 'style.css', 'sw.js', 'index.html']}}
        (out/'report.json').write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

    try:
      with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        c = browser.new_context(viewport={'width': 390, 'height': 844}, locale='ru-RU', timezone_id='Europe/Moscow', service_workers='block', accept_downloads=True)
        c.tracing.start(screenshots=True, snapshots=True, sources=True)

        def route(r):
            if not r.request.url.startswith(base+'/'):
                external.append(r.request.url)
                return r.abort()
            if r.request.url.split('?')[0] == base+PREFIX+'app.js':
                return r.fulfill(status=200, content_type='text/javascript', body=source)
            r.continue_()

        c.route('**/*', route)
        c.add_init_script('''
window.__crossReads=[];const originalGet=Storage.prototype.getItem;
Storage.prototype.getItem=function(k){if(/^lifegame-(personal|next|ai-strategy)/.test(k))__crossReads.push(k);return originalGet.call(this,k)};
localStorage.setItem('lifegame-personal-my-v1','PARENT_SENTINEL');
localStorage.setItem('lifegame-personal-lab-my-v1','LAB_SENTINEL');
localStorage.setItem('lifegame-ai-strategy-lab-my-v1','AI_SENTINEL');
''')
        p = c.new_page()
        p.on('pageerror', lambda e: errors.append(str(e)))
        p.set_default_timeout(10000)
        start = datetime(2026, 8, 14, 9, 0, tzinfo=timezone.utc)
        p.clock.install(time=start)

        def state():
            return p.evaluate('__LAB9.state()')

        def loaded():
            p.wait_for_function('!!window.__LAB9 && !!__LAB9.state()')

        def close():
            p.locator('#layer [data-act=sheet-close]').filter(visible=True).last.click()

        def saved_click(selector):
            revision = state()['revision']
            p.locator(selector).filter(visible=True).first.click()
            p.wait_for_function('(r)=>JSON.parse(localStorage.getItem("'+KEY+'")).revision>r', arg=revision)

        def set_day(n):
            p.clock.set_system_time(start+timedelta(days=n))
            p.reload(wait_until='networkidle')
            loaded()

        def initial():
            p.goto(base+PREFIX, wait_until='networkidle')
            p.locator('[data-act=flex-start][data-view=basic]').click()
            loaded()
            assert p.locator('[data-form=flex-config]').is_visible()
            assert state()['flex']['options'] == {'calendar': False, 'notifications': False, 'stats': False}
            close()
            assert p.locator('[data-flex-basic]').is_visible()
            assert p.locator('nav.tabs').is_hidden() and p.locator('#fab').is_hidden()
            assert p.locator('[data-wallet]').count() == 0
            assert not state()['tasks'] and not state()['habits'] and not state()['ledger']
            assert p.evaluate('__crossReads') == []
            p.screenshot(path=str(out/'01-empty-basic.png'), full_page=True)
            return 'Basic starts empty, all optional tools off, no full strategy required; parent keys not read'

        check('first entry and isolated empty Basic', initial)

        def add_and_marks():
            p.locator('[data-act=flex-create]').click()
            p.locator('[name=title]').fill('Прочитать пять страниц')
            p.locator('[data-form=flex-create] [type=submit]').click()
            p.wait_for_function('__LAB9.state().tasks.length===1')
            task = state()['tasks'][0]['id']
            assert state()['flex']['members'] == ['task:'+task]
            p.evaluate('''async()=>{await __LAB9.run(()=>{const s=__LAB9.state();s.habits.push(__LAB9.newItem('habit',{id:'three',title:'Три подхода',dailyTarget:3,reward:5}));});await __LAB9.configure([...__LAB9.state().flex.members,'habit:three'],__LAB9.state().flex.options)}''')
            for _ in range(2):
                saved_click('[data-act=flex-toggle][data-r="habit:three"]')
            assert not state()['ledger']
            saved_click('[data-act=flex-undo][data-r="habit:three"]')
            assert len([f for f in state()['facts'] if f['kind']=='habitStep' and not f['cancelled']]) == 1
            for _ in range(2):
                saved_click('[data-act=flex-toggle][data-r="habit:three"]')
            s = state()
            assert sum(x['coins'] for x in s['ledger']) == 5
            assert len([f for f in s['facts'] if f['kind']=='habit' and not f['cancelled']]) == 1
            saved_click('[data-act=flex-toggle][data-r="habit:three"]')
            assert sum(x['coins'] for x in state()['ledger']) == 0
            assert p.locator('.toast').inner_text() == 'Сохранено'
            saved_click('[data-act=flex-toggle][data-r="task:'+task+'"]')
            assert sum(x['coins'] for x in state()['ledger']) == 10
            saved_click('[data-act=flex-toggle][data-r="task:'+task+'"]')
            assert sum(x['coins'] for x in state()['ledger']) == 0
            assert p.locator('[data-wallet]').count() == 0
            return {'real_ui_marks': 'task and 3-step habit; partial undo, completion and reward reversal', 'ledger_net': 0}

        check('Basic quick creation, real marks and unchanged economy rules', add_and_marks)

        def full_editor():
            refs = state()['flex']['members'][:]
            saved_click('[data-act=flex-full]')
            assert p.locator('[data-flex-full]').is_visible()
            assert p.evaluate('LifeGameFlex.at(__LAB9.state(),__LAB9.today()).policy') == 'basic'
            p.locator('[data-act=tab][data-v=more]').click()
            p.locator('[data-act=go][data-s=habits]').click()
            p.locator('[data-act=new][data-k=habit]').click()
            p.wait_for_selector('[data-form=item]')
            p.locator('[data-form=item] [name=title]').fill('Новая привычка из Полного')
            p.locator('[data-form=item] button.btn.primary').click()
            p.wait_for_function('__LAB9.state().habits.length===2')
            assert state()['flex']['members'] == refs
            assert p.evaluate('LifeGameFlex.at(__LAB9.state(),__LAB9.today()).policy') == 'basic'
            p.evaluate('__LAB9.go("home")')
            saved_click('[data-act=flex-basic]')
            assert 'Новая привычка из Полного' not in p.locator('[data-flex-basic]').inner_text()
            return 'real Full item form creates a habit without enrolling it; expectations and IDs retained'

        check('Full editor entry and new habit never resume expectations', full_editor)

        def selection():
            p.evaluate('''async()=>{await __LAB9.run(()=>{const s=__LAB9.state();for(let i=0;i<12;i++)s.tasks.push(__LAB9.newItem('task',{id:'choice_'+i,title:'Выбор '+i}));});}''')
            p.locator('[data-act=flex-config]').click()
            before = state()['flex']['members'][:]
            p.locator('[data-act=flex-suggest]').click()
            assert state()['flex']['members'] == before
            assert p.locator('[name=member]:checked').count() <= 5
            p.locator('[data-flex-search]').fill('Выбор 11')
            assert p.locator('[data-flex-choice]').filter(visible=True).count() == 1
            p.locator('[data-flex-search]').fill('')
            p.locator('[name=member]').evaluate_all('(xs)=>xs.forEach(x=>x.checked=x.value.startsWith("task:choice_"))')
            p.locator('[data-form=flex-config] [type=submit]').click()
            p.wait_for_selector('[data-ask=yes]')
            assert len(state()['flex']['members']) == len(before)
            p.locator('[data-ask=yes]').click()
            p.wait_for_function('__LAB9.state().flex.members.length===12')
            assert len(p.locator('[data-flex-ref]').all()) == 12
            return 'suggestion remains an uncommitted draft; search works; 12 choices accepted after a soft warning'

        check('manual and suggested rhythm with no hard ten-item limit', selection)

        def notifications():
            p.evaluate('''async()=>{await __LAB9.run(()=>{const s=__LAB9.state(),d=__LAB9.today();s.cal.push(__LAB9.newItem('cal',{id:'chosen_cal',title:'Выбранная встреча',date:d,time:'12:00',reminderLead:0}));s.cal.push(__LAB9.newItem('cal',{id:'frozen_cal',title:'Остальной календарь',date:d,time:'12:00',reminderLead:0}));s.settings.reminders=true});await __LAB9.configure(['cal:chosen_cal'],{calendar:true,notifications:false,stats:false})}''')
            assert p.evaluate('__LAB9.reminderCandidates()') == []
            saved_click('[data-act=flex-full]')
            assert p.evaluate('__LAB9.reminderCandidates()') == []
            assert state()['cal'][0]['reminderReceipts'] == {}
            p.evaluate('''async()=>await __LAB9.configure(['cal:chosen_cal'],{calendar:true,notifications:true,stats:false})''')
            assert [x['id'] for x in p.evaluate('__LAB9.reminderCandidates()')] == ['chosen_cal']
            p.evaluate('''async()=>await __LAB9.run(()=>{__LAB9.state().cal[0].reminder=false})''')
            assert p.evaluate('__LAB9.reminderCandidates()') == []
            saved_click('[data-act=flex-basic]')
            p.locator('[data-act=flex-config]').click()
            p.locator('[name=notifications]').uncheck()
            p.locator('[name=stats]').check()
            p.locator('[data-form=flex-config] [type=submit]').click()
            p.wait_for_selector('[data-flex-stats]')
            return 'Basic is muted by default even while editing Full; explicit opt-in targets only the chosen event and respects its own mute'

        check('calendar opt-in and per-event notifications', notifications)

        def modes_and_timer():
            saved_click('[data-act=flex-full]')
            p.evaluate('''async()=>await __LAB9.startTimer(15)''')
            saved_click('[data-act=flex-basic]')
            assert state()['timer']['state'] == 'paused' and state()['timer']['remaining'] == 900
            assert not state()['timeLog']
            assert p.locator('.minitimer').is_hidden()
            p.evaluate('''async()=>{await __LAB9.run(()=>{const s=__LAB9.state();s.habits.push(__LAB9.newItem('habit',{id:'chosen_focus',title:'Выбранный шаг',blockId:'b0'}));s.tasks.push(__LAB9.newItem('task',{id:'force_frozen',title:'На паузе',blockId:'b1'}));s.focus={on:true,blocks:['b1'],calOther:true,calUnlinked:true};});await __LAB9.configure(['habit:chosen_focus'],{calendar:false,notifications:false,stats:false});await __LAB9.force('task:force_frozen')}''')
            plan = p.evaluate('__LAB9.plan(__LAB9.today())')
            assert {'r': 'habit:chosen_focus', 'why': 'focus'} in plan['hidden']
            assert 'task:force_frozen' not in plan['visible']
            p.locator('.flex-day-options summary').click()
            saved_click('[data-act=force][data-r="habit:chosen_focus"]')
            assert 'habit:chosen_focus' in p.evaluate('__LAB9.plan(__LAB9.today()).visible')
            p.evaluate('''async()=>{await __LAB9.run(()=>{const s=__LAB9.state();s.focus.on=false;s.creative={on:true,since:__LAB9.today(),mute:true};s.days[__LAB9.today()].forced=[]})}''')
            assert {'r': 'habit:chosen_focus', 'why': 'creative'} in p.evaluate('__LAB9.plan(__LAB9.today()).hidden')
            p.evaluate('''async()=>{await __LAB9.run(()=>{const s=__LAB9.state();s.creative.on=false;s.habits.find(h=>h.id==='chosen_focus').fit=['hard'];s.days[__LAB9.today()].tempo='rest';s.days[__LAB9.today()].tempoManual=true})}''')
            assert {'r': 'habit:chosen_focus', 'why': 'tempo'} in p.evaluate('__LAB9.plan(__LAB9.today()).hidden')
            p.evaluate('''async()=>{await __LAB9.run(()=>{const s=__LAB9.state();s.habits.find(h=>h.id==='chosen_focus').fit=['rest','normal','hard'];s.habits.find(h=>h.id==='chosen_focus').locs=['work'];s.loc.manual={id:'home',until:null}})}''')
            assert {'r': 'habit:chosen_focus', 'why': 'loc'} in p.evaluate('__LAB9.plan(__LAB9.today()).hidden')
            return 'timer paused with no minutes recorded; outer freeze cannot be bypassed by force; chosen actions retain focus/creative/tempo/location filters'

        check('timer and combinations with Personal day filters', modes_and_timer)

        def freeze_months():
            p.evaluate('''async()=>{await __LAB9.run(()=>{const L=__LAB9,s=L.state();s.loc.manual=null;s.focus.on=false;s.creative.on=false;s.days[L.today()].tempo='normal';s.days[L.today()].tempoManual=true;s.tasks=[];s.habits=[];s.cal=[];
              for(let i=0;i<800;i++)s.tasks.push(L.newItem('task',{id:'frozen_'+i,title:'Обычный план '+i,sched:{type:'daily',days:[]}}));
              s.habits.push(L.newItem('habit',{id:'daily_rhythm',title:'Ежедневный ритм'}));s.habits.push(L.newItem('habit',{id:'weekly_rhythm',title:'Пятничный ритм',sched:{type:'weekly',days:[5]},inDay:false}));
              s.cal.push(L.newItem('cal',{id:'frozen_series',title:'Замороженный календарь',date:L.today(),repeat:{type:'daily',days:[]},reminder:false}));
              s.misses.push({id:'old_miss',kind:'task',ref:'frozen_0',date:'2026-08-13',title:'Старый пропуск',status:'active',note:'',created:Date.now()});
            });await __LAB9.configure(['habit:daily_rhythm','habit:weekly_rhythm'],{calendar:false,notifications:false,stats:false})}''')
            assert len(p.locator('[data-flex-ref]').all()) == 2  # Friday, weekly series kept.
            before = state()
            (out/'before-90-days.json').write_text(json.dumps(before, ensure_ascii=False, indent=2))
            set_day(90)
            s = state()
            assert len(s['tasks']) == 800
            assert len([m for m in s['misses'] if m['ref'].startswith('frozen_') and m['id']!='old_miss']) == 0
            assert len([m for m in s['misses'] if m['id']=='old_miss']) == 1
            assert len([m for m in s['misses'] if m['ref']=='daily_rhythm']) == 90
            assert len([m for m in s['misses'] if m['ref']=='weekly_rhythm']) == 13
            assert s['facts'] == before['facts'] and s['ledger'] == before['ledger']
            assert 'пропуск' not in p.locator('[data-flex-basic]').inner_text().lower()
            assert 'Обычный план' not in p.locator('[data-flex-basic]').inner_text()
            (out/'after-90-days.json').write_text(json.dumps(s, ensure_ascii=False, indent=2))
            p.screenshot(path=str(out/'02-after-90-days.png'), full_page=True)
            return {'frozen_plans': 800, 'closed_app_days': 90, 'frozen_calendar_new_misses': 0, 'selected_daily_misses': 90, 'selected_weekly_misses': 13, 'old_miss_preserved': True, 'ledger_and_facts_unchanged': True}

        check('ninety closed-app days and eight hundred frozen plans', freeze_months)

        def resume():
            saved_click('[data-act=flex-full]')
            p.locator('[data-act=flex-resume]').click()
            p.locator('[data-ask=no]').click()
            assert not [x for x in state()['flex']['changes'] if x['policy']=='full']
            p.locator('[data-act=flex-resume]').click()
            p.locator('[data-ask=yes]').click()
            p.wait_for_function('__LAB9.state().flex.changes.some(e=>e.policy==="full")')
            assert p.evaluate('LifeGameFlex.at(__LAB9.state(),__LAB9.today()).policy') == 'basic'
            saved_click('[data-act=flex-basic]')
            assert not [x for x in state()['flex']['changes'] if x['policy']=='full']
            saved_click('[data-act=flex-full]')
            p.locator('[data-act=flex-resume]').click()
            p.locator('[data-ask=yes]').click()
            p.wait_for_function('__LAB9.state().flex.changes.some(e=>e.policy==="full")')
            set_day(91)
            assert p.evaluate('LifeGameFlex.at(__LAB9.state(),__LAB9.today()).policy') == 'full'
            assert len([m for m in state()['misses'] if m['ref']=='frozen_0' and m['id']!='old_miss']) == 0
            set_day(92)
            fresh = [m for m in state()['misses'] if m['ref']=='frozen_0' and m['id']!='old_miss']
            assert len(fresh)==1 and fresh[0]['date']=='2026-11-13'
            assert len([m for m in state()['misses'] if m['ref']=='frozen_series'])==1
            saved_click('[data-act=flex-basic]')
            return 'cancel leaves policy untouched; resume begins tomorrow; re-entering Basic cancels pending resume; no retroactive frozen-day debt'

        check('explicit resume boundary and cancellation of pending resume', resume)

        def history_and_persistence():
            data = p.evaluate('__LAB9.exportFile().data')
            p.evaluate('value=>__LAB9.replace(value)', data)
            assert state()['flex'] == data['flex']
            original = p.evaluate('localStorage.getItem('+json.dumps(KEY)+')')
            p.evaluate('''()=>{window.__set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='''+json.dumps(KEY)+''')throw new DOMException('Test quota','QuotaExceededError');return __set.call(this,k,v)}}''')
            saved = p.evaluate('''async()=>await __LAB9.configure(['habit:daily_rhythm'],{calendar:false,notifications:false,stats:true})''')
            assert saved is False
            assert state()['flex'] == data['flex']
            assert p.evaluate('localStorage.getItem('+json.dumps(KEY)+')') == original
            p.evaluate('()=>{Storage.prototype.setItem=__set}')
            p.reload(wait_until='networkidle')
            loaded()
            # Make an external revision while a local draft exists; deny stale writes.
            p.locator('[data-act=flex-config]').click()
            p.wait_for_selector('[data-form=flex-config]')
            p.evaluate('''()=>{const k='''+json.dumps(KEY)+''',s=JSON.parse(localStorage.getItem(k));s.revision++;localStorage.setItem(k,JSON.stringify(s))}''')
            before = p.evaluate('localStorage.getItem('+json.dumps(KEY)+')')
            p.locator('[name=stats]').check()
            p.locator('[data-form=flex-config] [type=submit]').click()
            p.wait_for_function('document.querySelector(".storage-alert")?.textContent.includes("вкладке")')
            assert p.evaluate('localStorage.getItem('+json.dumps(KEY)+')') == before
            assert p.locator('[data-form=flex-config] [name=stats]').is_checked()
            p.reload(wait_until='networkidle')
            loaded()
            return 'new export roundtrip exact; quota rolls back mode/config and history; stale revision preserves current durable state and user draft'

        check('export, quota rollback and stale-tab writes', history_and_persistence)

        def archive_upgrade():
            before = state()
            p.evaluate('''async()=>await __LAB9.run(()=>__LAB9.get('habit','weekly_rhythm').status='archived')''')
            assert 'habit:weekly_rhythm' not in state()['flex']['members']
            assert any('habit:weekly_rhythm' in e['refs'] for e in state()['flex']['changes'])
            p.evaluate('''async()=>await __LAB9.run(()=>__LAB9.get('habit','weekly_rhythm').status='active')''')
            assert 'habit:weekly_rhythm' not in state()['flex']['members']
            old = state()
            del old['flex']
            upgraded = p.evaluate('(s)=>LifeGamePersistence.upgrade(s)', old)
            assert upgraded['flex']['view'] == 'full' and upgraded['flex']['changes']==[]
            assert upgraded['facts'] == old['facts'] and upgraded['ledger'] == old['ledger']
            assert upgraded['misses'] == old['misses']
            invalid = state()
            invalid['flex']['options']['notifications'] = 'yes'
            assert p.evaluate('(s)=>{try{LifeGamePersistence.upgrade(s);return false}catch{return true}}', invalid)
            invalid = state()
            invalid['flex']['changes'] = []
            assert p.evaluate('(s)=>{try{LifeGamePersistence.upgrade(s);return false}catch{return true}}', invalid)
            p.evaluate('''()=>{const s=structuredClone(__LAB9.state());s.lastProcessed='2099-01-01';let blocked=false;try{LifeGameFlex.enterBasic(s,__LAB9.today())}catch{blocked=true}if(!blocked)throw Error('backdate accepted')}''')
            assert not p.evaluate('LifeGameFlex.notify(__LAB9.state(),__LAB9.state().cal[0],"2026-11-13")')
            assert state()['facts'] == before['facts'] and state()['ledger'] == before['ledger']
            return 'archive removes current enrollment, restore does not silently enroll; historical membership remains; legacy upgrades Full without economy/history changes; invalid new format and backdated mode changes rejected'

        check('archive membership, legacy saves and invalid history guards', archive_upgrade)

        def checklist():
            p.evaluate('''async()=>{await __LAB9.run(()=>__LAB9.state().quests.push(__LAB9.newItem('quest',{id:'check',title:'Чеклист',type:'checklist',steps:[{id:'one',title:'Первый шаг'},{id:'two',title:'Второй шаг'}],inDay:false})));await __LAB9.configure(['quest:check'],{calendar:false,notifications:false,stats:false})}''')
            coins_before = sum(x['coins'] for x in state()['ledger'])
            p.locator('[data-act=flex-quest]').click()
            for step in ['one','two']:
                saved_click('[data-act=flex-qstep][data-step='+step+']')
            assert state()['quests'][0]['status']=='completed'
            saved_click('[data-act=flex-qstep][data-step=two]')
            assert state()['quests'][0]['status']=='active'
            saved_click('[data-act=flex-qstep][data-step=one]')
            assert sum(x['coins'] for x in state()['ledger']) == coins_before
            assert 'монет' not in p.locator('[data-flex-quest]').inner_text()
            close()
            return 'selected checklist with original inDay=false works; final reward undone with step; original shared identity retained'

        check('checklist steps and dependent reward undo in Basic', checklist)

        def calendar_exceptions():
            p.evaluate('''async()=>{const d=__LAB9.today();await __LAB9.run(()=>{const s=__LAB9.state();s.cal.push(__LAB9.newItem('cal',{id:'monthly',title:'Ежемесячно',date:'2026-08-31',repeat:{type:'monthly',days:[],anchorDay:31},exceptions:{'2026-09-30':{date:'2026-10-01',time:'10:00'}}}));});await __LAB9.configure(['quest:check'],{calendar:false,notifications:false,stats:false})}''')
            before = state()['cal'][-1]
            ranges = p.evaluate('''()=>LifeGamePlanning.range(__LAB9.get('cal','monthly'),'2026-09-01','2026-10-31')''')
            assert any(x['key']=='2026-09-30' and x['date']=='2026-10-01' for x in ranges)
            assert state()['cal'][-1] == before
            assert not p.evaluate('LifeGameFlex.enabled(__LAB9.state(),"cal","monthly","2026-10-01")')
            assert p.evaluate('LifeGameFlex.at(__LAB9.state(),"2026-11-13").policy') == 'full'
            return 'nominal recurrence and moved occurrence remain intact; freeze and Full resumption use recorded local calendar dates'

        check('calendar recurrence exceptions and historical policy', calendar_exceptions)

        def responsive():
            for width in [375,390,1280]:
                p.set_viewport_size({'width':width,'height':844})
                assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'), width
                p.locator('[data-act=flex-config]').click()
                assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'), width
                close()
            p.set_viewport_size({'width':390,'height':844})
            p.screenshot(path=str(out/'03-rhythm-checklist.png'), full_page=True)
            assert p.evaluate('__crossReads') == []
            assert errors == [] and external == []
            return {'widths':[375,390,1280], 'page_errors':0, 'external_requests':0, 'cross_app_reads':0}

        check('mobile layouts and no external requests', responsive)
        saved_state = state()
        c.tracing.stop(path=str(out/'browser-trace.zip'))
        browser.close()

        # Separate uninjected application contexts with real service workers.
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        c = browser.new_context(viewport={'width':390,'height':844}, locale='ru-RU')
        def offline_isolation():
            c.route('**/*', lambda r:r.continue_() if r.request.url.startswith(base+'/') else r.abort())
            p2 = c.new_page()
            p2.goto(base+PREFIX, wait_until='networkidle')
            p2.wait_for_function('navigator.serviceWorker.controller!==null')
            p2.locator('[data-act=flex-start][data-view=basic]').click()
            p2.locator('#layer .sh-title [data-act=sheet-close]').click()
            p2.evaluate('''async()=>{await caches.open('lifegame-personal-lab-shell-sentinel');await caches.open('lifegame-ai-strategy-lab-shell-sentinel')}''')
            scopes = p2.evaluate('''async()=>({scope:(await navigator.serviceWorker.getRegistration()).scope,keys:await caches.keys()})''')
            assert scopes['scope'].endswith(PREFIX)
            assert re.search(r"const CACHE='([^']+)'", (ROOT/'sw.js').read_text()).group(1) in scopes['keys']
            p2.evaluate('''()=>{localStorage.setItem('lifegame-personal-lab-my-v1','KEEP_PARENT');localStorage.setItem('lifegame-ai-strategy-lab-my-v1','KEEP_AI')}''')
            c.set_offline(True)
            p2.reload(wait_until='load')
            p2.wait_for_selector('[data-flex-basic]')
            assert p2.evaluate('localStorage.getItem("lifegame-personal-lab-my-v1")')=='KEEP_PARENT'
            assert p2.evaluate('localStorage.getItem("lifegame-ai-strategy-lab-my-v1")')=='KEEP_AI'
            keys = p2.evaluate('caches.keys()')
            assert 'lifegame-personal-lab-shell-sentinel' in keys and 'lifegame-ai-strategy-lab-shell-sentinel' in keys
            p2.screenshot(path=str(out/'04-offline-uninjected.png'), full_page=True)
            return 'real own service-worker scope, own offline shell, uninjected reload and preserved parent/AI data and caches'

        check('real PWA offline and sibling isolation', offline_isolation)
        c.close()

        def zones_and_legacy():
            for zone in ['America/Los_Angeles','Asia/Tokyo']:
                ctx = browser.new_context(timezone_id=zone, service_workers='block')
                ctx.route('**/*', lambda r:r.continue_() if r.request.url.startswith(base+'/') else r.abort())
                ctx.add_init_script('localStorage.setItem('+json.dumps(KEY)+','+json.dumps(json.dumps(saved_state))+');localStorage.setItem('+json.dumps(META)+',JSON.stringify({space:"my",offset:0}));')
                page = ctx.new_page()
                page.clock.install(time=start+timedelta(days=92))
                page.goto(base+PREFIX, wait_until='networkidle')
                page.wait_for_selector('[data-flex-basic]')
                current = page.evaluate('JSON.parse(localStorage.getItem('+json.dumps(KEY)+'))')
                assert current['flex'] == saved_state['flex']
                assert current['facts'] == saved_state['facts'] and current['ledger'] == saved_state['ledger']
                ctx.close()
            legacy = dict(saved_state)
            del legacy['flex']
            ctx = browser.new_context(timezone_id='Europe/Moscow', service_workers='block')
            ctx.route('**/*', lambda r:r.continue_() if r.request.url.startswith(base+'/') else r.abort())
            ctx.add_init_script('localStorage.setItem('+json.dumps(KEY)+','+json.dumps(json.dumps(legacy))+');localStorage.setItem('+json.dumps(META)+',JSON.stringify({space:"my",offset:0}));')
            page = ctx.new_page()
            page.clock.install(time=start+timedelta(days=92))
            page.goto(base+PREFIX, wait_until='networkidle')
            page.wait_for_selector('[data-flex-full]')
            assert page.locator('[data-wallet]').is_visible() and page.locator('nav.tabs').is_visible()
            page.locator('[data-act=flex-basic]').click()
            page.wait_for_selector('[data-flex-basic]')
            page.wait_for_selector('[data-form=flex-config]')
            current = page.evaluate('JSON.parse(localStorage.getItem('+json.dumps(KEY)+'))')
            assert current['facts'] == legacy['facts'] and current['ledger'] == legacy['ledger']
            assert len(current['flex']['changes']) == 1
            ctx.close()
            return 'uninjected saved Basic loads in Los Angeles and Tokyo without rewriting history/economy; legacy v2 opens Full and can enter Basic safely'

        check('time-zone replay and actual legacy Full startup', zones_and_legacy)

        def backward_date():
            ctx = browser.new_context(timezone_id='America/Los_Angeles', service_workers='block')
            ctx.route('**/*', lambda r:r.continue_() if r.request.url.startswith(base+'/') else r.abort())
            ctx.add_init_script('localStorage.setItem('+json.dumps(KEY)+','+json.dumps(json.dumps(saved_state))+');localStorage.setItem('+json.dumps(META)+',JSON.stringify({space:"my",offset:0}));')
            page = ctx.new_page()
            page.clock.install(time=datetime(2026,11,14,0,30,tzinfo=timezone.utc))
            page.goto(base+PREFIX, wait_until='networkidle')
            page.wait_for_selector('[data-flex-basic]')
            assert 'Обычный план' not in page.locator('[data-flex-basic]').inner_text()
            assert page.evaluate('JSON.parse(localStorage.getItem('+json.dumps(KEY)+')).flex') == saved_state['flex']
            ctx.close()
            ctx = browser.new_context(timezone_id='Europe/Moscow', service_workers='block')
            ctx.route('**/*', lambda r:r.continue_() if r.request.url.startswith(base+'/') else r.abort())
            page = ctx.new_page()
            page.clock.install(time=start)
            page.goto(base+PREFIX, wait_until='networkidle')
            page.locator('[data-act=welcome][data-v=demo]').click()
            page.locator('[data-act=test-menu]').click()
            page.locator('[data-act=next-week]').click()
            page.wait_for_function('JSON.parse(localStorage.getItem('+json.dumps(META)+')).offset===7')
            page.locator('[data-act=flex-basic]').click()
            page.locator('#layer .sh-title [data-act=sheet-close]').click()
            page.locator('[data-act=flex-full]').click()
            page.locator('[data-act=test-menu]').click()
            page.locator('[data-act=real-day]').click()
            page.wait_for_function('document.querySelector(".toast")?.textContent.includes("история режимов")')
            assert page.evaluate('JSON.parse(localStorage.getItem('+json.dumps(META)+')).offset') == 7
            ctx.close()
            return 'a westward date boundary does not expose 800 ordinary plans; Demo cannot reset lastProcessed behind its mode history'

        check('backward date boundaries and Demo history guard', backward_date)
        browser.close()
    finally:
        server.shutdown()
        report()
    print(json.dumps({'passed':sum(x['passed'] for x in results),'checks':len(results),'artifacts':str(out)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
