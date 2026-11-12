#!/usr/bin/env python3
"""Local-only Personal AI checks. Fixtures are fictional; hooks exist in test responses only."""
from datetime import datetime, timedelta, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse, hashlib, json, threading
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parents[2]
PREFIX='/personal-lab/experiments/ai-strategy/'
KEY='lifegame-ai-strategy-lab-my-v1'
HOOK='''
window.__LAB7={state:()=>S,go:s=>{closeAllSheets();go(s,{})},today,key:()=>KEYS[META.space],
run:fn=>runGuarded(()=>tx(fn)),complete,undo:undoFact,
newItem:(k,p)=>({task:newTask,habit:newHabit,quest:newQuest,cal:newCal}[k])(p),
source:()=>({today:today(),space:META.space,offset:META.offset,plan:dayPlan(today())})};
'''

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--out')
    args=ap.parse_args()
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    out=Path(args.out) if args.out else REPO/'personal-lab/verification'/('LAB-007-'+stamp)
    out.mkdir(parents=True,exist_ok=False)
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(REPO)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base='http://127.0.0.1:'+str(server.server_port)
    results=[]; errors=[]; external=[]
    source=(ROOT/'app.js').read_text(encoding='utf-8').rsplit('})();',1)[0]+HOOK+'})();'
    def check(name,fn):
        try:
            detail=fn()
            results.append({'name':name,'passed':True,'details':detail})
            print('PASS',name,flush=True)
        except Exception as exc:
            results.append({'name':name,'passed':False,'error':str(exc)})
            print('FAIL',name,str(exc),flush=True)
            try:
                p.screenshot(path=str(out/'failure.png'),full_page=True)
                c.tracing.stop(path=str(out/'failure-trace.zip'))
            except Exception:
                pass
            raise
    def report():
        value={'task':'LAB-007','status':'technical_fictional_checks_not_ai_user_study','checks':results,'passed':sum(x['passed'] for x in results),'page_errors':errors,'external_requests':external,'artifacts':str(out),'source_product':'Personal 1.2.0','hashes':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in ['app.js','ai-context.js','ai-ui.js','persistence.js','sw.js']}}
        (out/'report.json').write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    try:
      with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        c=browser.new_context(viewport={'width':390,'height':844},locale='ru-RU',timezone_id='Europe/Moscow',service_workers='block',accept_downloads=True)
        c.tracing.start(screenshots=True,snapshots=True,sources=True)
        def route(r):
            if not r.request.url.startswith(base+'/'):
                external.append(r.request.url);return r.abort()
            if r.request.url.split('?')[0]==base+PREFIX+'app.js':return r.fulfill(status=200,content_type='text/javascript',body=source)
            r.continue_()
        c.route('**/*',route)
        c.add_init_script('''
window.__crossReads=[];
const originalGet=Storage.prototype.getItem;
Storage.prototype.getItem=function(k){if(/^lifegame-(personal|next)/.test(k))window.__crossReads.push(k);return originalGet.call(this,k)};
localStorage.setItem('lifegame-personal-my-v1','PARENT_SENTINEL');
localStorage.setItem('lifegame-personal-lab-my-v1','PARENT_LAB_SENTINEL');
localStorage.setItem('lifegame-next-v1','NEXT_SENTINEL');
''')
        p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.set_default_timeout(10000)
        start=datetime(2026,10,14,9,tzinfo=timezone.utc)
        p.clock.install(time=start)
        def state():return p.evaluate('__LAB7.state()')
        def toggle(ref):
            revision=state()['revision']
            p.locator('[data-act=toggle][data-r="'+ref+'"]').filter(visible=True).first.click()
            p.wait_for_function('(r)=>JSON.parse(localStorage.getItem("'+KEY+'")).revision>r',arg=revision)
        def ai():p.evaluate('__LAB7.go("ai")')
        def build():p.locator('#ai-context-form button[type=submit]').click();p.wait_for_function('!document.querySelector("#ai-preview").hidden');return p.locator('#ai-request').input_value()
        def packet(text):return json.loads(text.split('ДАННЫЕ PERSONAL (JSON):\n',1)[1])
        def initial():
            p.goto(base+PREFIX,wait_until='networkidle');p.wait_for_function('!!window.__LAB7')
            p.locator('[data-act=welcome][data-v=my]').click()
            p.locator('#layer [data-act=sheet-close]').filter(visible=True).last.click()
            p.wait_for_function('!!__LAB7.state()')
            p.locator('[data-act=tab][data-v=more]').click();p.locator('[data-act=go][data-s=ai]').click()
            result=packet(build());assert result['meta']['source_product']=='LifeGame Personal 1.2.0'
            assert result['records']['actions']==[] and not state()['ledger']
            assert p.evaluate('__crossReads')==[]
            p.screenshot(path=str(out/'empty-personal-ai.png'),full_page=True)
            return {'blank_actions':0,'cross_app_reads':0}
        check('empty Personal and real navigation into AI',initial)
        def consent_readonly():
            before=p.evaluate('localStorage.getItem('+json.dumps(KEY)+')')
            assert p.locator('[data-ai-export=copy]').is_disabled()
            p.locator('#ai-consent').check()
            with p.expect_download() as info:p.locator('[data-ai-export=download]').click()
            download=info.value;download.save_as(str(out/'empty-context.txt'))
            assert Path(download.path()).read_text(encoding='utf-8')==p.locator('#ai-request').input_value()
            c.grant_permissions(['clipboard-read','clipboard-write'],origin=base)
            p.locator('[data-ai-export=copy]').click()
            p.wait_for_function('document.querySelector("#ai-feedback").textContent.includes("скопирован")')
            assert p.evaluate('navigator.clipboard.readText()')==p.locator('#ai-request').input_value()
            assert before==p.evaluate('localStorage.getItem('+json.dumps(KEY)+')')
            p.locator('#ai-format').select_option('map')
            assert p.locator('#ai-preview').is_hidden() and p.locator('[data-ai-export=copy]').is_disabled()
            return 'native clipboard and download match preview; save bytes unchanged; parameter change invalidates consent'
        check('explicit export consent and read-only download',consent_readonly)
        def month():
            p.evaluate('''async()=>{const L=__LAB7;await L.run(()=>{
              const s=L.state(),d=L.today();
              for(const [id,bid,name]of [['selected_stage','b0','Обучение'],['private_stage','b1','PRIVATE_SENTINEL_STAGE']]){
                s.stages.push({id,blockId:bid,name,content:'',meaning:'',reason:'',bonus:[],status:'open',order:1,created:d});s.blocks.find(b=>b.id===bid).currentStageId=id;
              }
              s.blocks.find(b=>b.id==='b1').name='PRIVATE_SENTINEL_BLOCK';
              s.goals.push({id:'selected_goal',stageId:'selected_stage',title:'Понять ритм',ifThen:'',status:'active',created:d});
              s.tasks.push(L.newItem('task',{id:'visible_task',title:'Ежедневный шаг',created:d,blockId:'b0',stageId:'selected_stage',goalId:'selected_goal',reward:10,sched:{type:'daily',days:[]}}));
              s.tasks.push(L.newItem('task',{id:'private_task',title:'PRIVATE_SENTINEL_TASK',created:d,blockId:'b1',stageId:'private_stage',desc:'PRIVATE_SENTINEL_DESC',sched:{type:'daily',days:[]}}));
              s.habits.push(L.newItem('habit',{id:'practice_habit',title:'Три подхода',created:d,dailyTarget:3,blockId:'b0',stageId:'selected_stage',reward:5}));
              s.cal.push(L.newItem('cal',{id:'monthly_cal',title:'Раз в месяц',created:d,date:d,blockId:'b0',stageId:'selected_stage',reminder:false,repeat:{type:'monthly',days:[],anchorDay:14}}));
              s.sessions.push({id:'self_report',level:'daily',key:d,date:d,ts:Date.now(),answers:{'Что мешало?':'PRIVATE_SENTINEL_SELF_REPORT'}});
              s.inbox.push({id:'inbox_note',text:'PRIVATE_SENTINEL_INBOX'});
            });}''')
            for day in range(30):
                p.clock.set_system_time(start+timedelta(days=day));p.reload(wait_until='networkidle');p.wait_for_function('!!window.__LAB7 && !!__LAB7.state()')
                p.evaluate('__LAB7.go("day")')
                if day not in {4,12,23}:
                    toggle('task:visible_task')
                    if day==5:toggle('task:visible_task')
                if day in {0,1}:
                    for _ in range(3 if day==0 else 1):toggle('habit:practice_habit')
                if day==2:p.evaluate('''async()=>{const L=__LAB7;await L.run(()=>{const f=L.state().facts.find(f=>f.kind==='habitStep'&&f.date==='2026-10-15');L.undo(f.id)});}''')
                if day%5==0:p.evaluate('''async()=>{const L=__LAB7;await L.run(()=>L.state().timeLog.push({id:crypto.randomUUID(),date:L.today(),minutes:5,label:'Техническая запись времени',ref:'task:visible_task',ts:Date.now()}));}''')
                assert p.evaluate('__crossReads')==[]
            current=state();assert current['lastProcessed']=='2026-11-12'
            (out/'month-state.json').write_text(json.dumps(current,ensure_ascii=False,indent=2),encoding='utf-8')
            actual=len([f for f in current['facts'] if f['kind']=='task' and not f['cancelled']])
            assert actual==26,{'active_tasks':actual,'cancelled':len([f for f in current['facts'] if f['cancelled']])}
            assert len([f for f in current['facts'] if f['kind']=='habit' and not f['cancelled']])==1
            return {'dates':30,'active_task_marks':26,'successful_habit_days':1,'recorded_minutes':30,'fixture_setup':'model factories in injected test hook; task and habit marks via real UI'}
        check('thirty dates with real UI marks, skips and undo',month)
        def modes():
            ai();p.locator('#ai-from').fill('2026-10-14')
            before=p.evaluate('localStorage.getItem('+json.dumps(KEY)+')')
            for mode in ['daily','progress','strategy']:
                p.locator('#ai-mode').select_option(mode)
                data=packet(build())
                assert data['aggregates']['active_facts_by_kind']['task']==26
                assert data['aggregates']['active_facts_by_kind']['habitStep']==3
                assert data['aggregates']['active_facts_by_kind']['habit']==1
                assert data['aggregates']['cancelled_facts']==2
                assert data['aggregates']['recorded_minutes']==30
                assert 'reflections' not in data['records'] and 'ledger' not in data['records']
                if mode=='daily':assert data['records']['current_plan']['visible']==p.evaluate('__LAB7.source().plan.visible')
            assert p.evaluate('localStorage.getItem('+json.dumps(KEY)+')')==before
            return 'all three modes match source; partial approaches are not successful days; cancelled marks excluded'
        check('correct facts and unchanged state in all three modes',modes)
        def privacy():
            p.locator('.ai-options summary').click()
            for checkbox in p.locator('[name=blocks]').all():checkbox.uncheck()
            p.locator('[name=blocks][value=b0]').check()
            p.locator('[name=unbound]').uncheck()
            for key in ['reflections','economy','locations','inbox']:p.locator('[name=category][value='+key+']').check()
            p.locator('#ai-detail').select_option('full')
            text=build();data=packet(text)
            assert 'PRIVATE_SENTINEL' not in text
            assert not {'reflections','motivation','ledger','inbox'}&set(data['records'])
            assert 'unscoped_reflections' in data['meta']['excluded_categories']
            assert all(x.get('blockId') in {None,'b0'} for x in data['records']['actions'])
            assert data['records']['actions'][-1]['repeat']['type']=='monthly'
            p.screenshot(path=str(out/'scoped-personal-ai.png'),full_page=True)
            return 'excluded direction, history, free answers and global economy do not leak; calendar repeat retained'
        check('scope privacy across linked and unscoped records',privacy)
        def full_reflections():
            for checkbox in p.locator('[name=blocks]').all():checkbox.check()
            p.locator('[name=unbound]').check()
            data=packet(build());assert data['records']['reflections'][0]['answers']['Что мешало?']=='PRIVATE_SENTINEL_SELF_REPORT'
            assert data['records']['inbox'][0]['text']=='PRIVATE_SENTINEL_INBOX'
            assert 'ledger' in data['records']
            return 'explicit opt-in includes actual Personal sessions, not invented days.note/good'
        check('opt-in real Personal reflections and economy',full_reflections)
        def bounds_and_size():
            report=p.evaluate('''()=>{const C=LifeGameAIContext,L=__LAB7,s=structuredClone(L.state()),source=L.source();
              s.facts=[];for(let i=0;i<1600;i++)s.facts.push({id:'synthetic_'+i,kind:'task',ref:'visible_task',date:'2026-11-12',ts:1+i,title:'Большая техническая история '+i,cancelled:false,coins:0,xp:0});
              const before=JSON.stringify(s),r=C.build(s,{mode:'progress',from:'2026-10-14',to:'2026-11-12',maxChars:20000,blockIds:['b0'],unbound:false},source);
              let rejected=false,staleDateRejected=false;try{C.build(s,{from:'2026-11-13'},source)}catch{rejected=true}
              const old=structuredClone(s);old.lastProcessed='2026-11-11';try{C.build(old,{},source)}catch{staleDateRejected=true}
              return {size:r.characters,available:r.packet.meta.coverage.available.facts,included:r.packet.meta.coverage.included.facts,aggregate:r.packet.aggregates.active_facts_by_kind.task,unchanged:before===JSON.stringify(s),rejected,staleDateRejected};}''')
            assert report['size']<=20000 and report['available']==1600 and report['included']<1600 and report['aggregate']==1600
            assert report['unchanged'] and report['rejected'] and report['staleDateRejected']
            return report
        check('bounded valid JSON, transparent truncation and bad dates',bounds_and_size)
        def text_and_empty_scope():
            result=p.evaluate('''()=>{const C=LifeGameAIContext,L=__LAB7,s=structuredClone(L.state());s.tasks[0].title='<img src=x onerror=window.__xss=true>';const r=C.build(s,{blockIds:[],unbound:false},L.source());return {actions:r.packet.records.actions.length,facts:r.packet.records.facts.length};}''')
            assert result=={'actions':0,'facts':0}
            p.locator('#ai-request').evaluate('(e)=>e.value="<img src=x onerror=window.__xss=true>"')
            assert p.locator('#ai-preview img').count()==0 and not p.evaluate('!!window.__xss')
            return 'empty selection remains empty; preview is text, not executable markup'
        check('empty scope and inert text preview',text_and_empty_scope)
        def layout():
            for width in [375,390,1280]:
                p.set_viewport_size({'width':width,'height':844})
                assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
            p.set_viewport_size({'width':390,'height':844});p.screenshot(path=str(out/'mobile-personal-ai.png'),full_page=True)
            return {'widths':[375,390,1280],'horizontal_overflow':False}
        check('mobile and desktop layout',layout)
        def stale():
            build();p.locator('#ai-consent').check()
            p.evaluate('''()=>{const key=__LAB7.key(),s=JSON.parse(localStorage.getItem(key));s.revision++;localStorage.setItem(key,JSON.stringify(s));}''')
            p.locator('[data-ai-export=download]').click()
            assert 'измен' in p.locator('#ai-feedback').inner_text().lower()
            return 'stale external storage refused before exporting'
        check('stale snapshot is refused',stale)
        c.tracing.stop(path=str(out/'browser-trace.zip'));c.close()
        def offline():
            ctx=browser.new_context(viewport={'width':390,'height':844},locale='ru-RU',timezone_id='Europe/Moscow',service_workers='allow')
            ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base+'/') else r.abort())
            page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+PREFIX,wait_until='networkidle')
            page.wait_for_function('navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL.includes("/experiments/ai-strategy/")')
            page.locator('[data-act=welcome][data-v=my]').click()
            page.locator('#layer [data-act=sheet-close]').filter(visible=True).last.click()
            page.locator('[data-act=tab][data-v=more]').click();page.locator('[data-act=go][data-s=ai]').click()
            scope=page.evaluate('navigator.serviceWorker.controller.scriptURL')
            ctx.set_offline(True);page.reload(wait_until='networkidle')
            page.locator('[data-act=tab][data-v=more]').click();page.locator('[data-act=go][data-s=ai]').click()
            page.locator('#ai-context-form button[type=submit]').click()
            assert not page.locator('#ai-preview').is_hidden()
            ctx.close();return {'service_worker':scope,'offline_context_preview':True}
        check('own service-worker scope and offline export preview',offline)
        assert not errors,errors
        assert not external,external
        browser.close()
    finally:
        server.shutdown();server.server_close();report()
    print(json.dumps({'passed':len(results),'artifacts':str(out)},ensure_ascii=False))

if __name__=='__main__':main()
